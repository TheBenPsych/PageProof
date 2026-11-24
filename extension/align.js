// PP_ALIGN: finds where a copy sits on the original, even when the copy is cropped,
// much bigger or smaller, recompressed, colour-shifted, or has headlines and logos
// printed over part of it (a newspaper front page, a social media post, a thumbnail).
//
// How it works, in plain words:
//  1. Find "corner" points (sharp details) in both pictures, at many sizes.
//  2. Give each point a fingerprint made from the pixels around it (BRIEF).
//  3. Pair up points whose fingerprints are nearly the same.
//  4. Many pairs are wrong (headlines, faces that look alike). RANSAC tries thousands of
//     guesses and keeps the one size + position that the most pairs agree on.
//  5. Fine-tune by a pixel or two by comparing small squares of the two pictures.
// Nothing leaves the computer. No libraries.
const PP_ALIGN = (() => {
  // ---------- small helpers ----------
  // A drawing surface. On a page it is a normal canvas; in a background worker (no page)
  // it is an OffscreenCanvas, which works the same way.
  // A short breather so a long check doesn't lock up the page. Browsers slow page timers down
  // to about once a minute when the window is minimized, so this does not use a timer. In a
  // background worker nothing is waiting on the screen, so it doesn't pause at all.
  const pause = typeof document === 'undefined'
    ? () => Promise.resolve()
    : () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => { c.port1.close(); r(); }; c.port2.postMessage(0); });
  function mkCanvas(w, h) {
    if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
    return new OffscreenCanvas(w, h);
  }
  // One reusable drawing surface per size for the line-up checks (refine draws the copy
  // 30 to 60 times per check; a new canvas each time was a lot of memory churn).
  const SURF = new Map();
  function surface(w, h) {
    const k = w + 'x' + h;
    let ctx = SURF.get(k);
    if (!ctx) {
      if (SURF.size > 6) SURF.delete(SURF.keys().next().value);
      ctx = mkCanvas(w, h).getContext('2d', { willReadFrequently: true });
      SURF.set(k, ctx);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return ctx;
  }
  function grayOf(bitmap, w, h) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    const c = mkCanvas(w, h);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);   // see-through parts count as white
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data, g = new Float32Array(w * h);
    for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    return { w, h, g };
  }
  // Halve-ish an image by a factor (bilinear), used to build the pyramid of sizes.
  function shrink(im, f) {
    const w = Math.max(1, Math.round(im.w * f)), h = Math.max(1, Math.round(im.h * f)), g = new Float32Array(w * h);
    const sx = im.w / w, sy = im.h / h;
    for (let y = 0; y < h; y++) {
      const fy = Math.min(im.h - 1.001, (y + 0.5) * sy - 0.5), y0 = Math.max(0, Math.floor(fy)), ty = Math.max(0, fy - y0);
      for (let x = 0; x < w; x++) {
        const fx = Math.min(im.w - 1.001, (x + 0.5) * sx - 0.5), x0 = Math.max(0, Math.floor(fx)), tx = Math.max(0, fx - x0);
        const i = y0 * im.w + x0;
        g[y * w + x] = (im.g[i] * (1 - tx) + im.g[i + 1] * tx) * (1 - ty) + (im.g[i + im.w] * (1 - tx) + im.g[i + im.w + 1] * tx) * ty;
      }
    }
    return { w, h, g };
  }
  // Box blur (radius r), run twice, close to a Gaussian.
  function blur(im, r) {
    const { w, h } = im; let src = im.g, tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < h; y++) {
        let acc = 0; const row = y * w;
        for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
        for (let x = 0; x < w; x++) {
          tmp[row + x] = acc / (2 * r + 1);
          acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
        }
      }
      for (let x = 0; x < w; x++) {
        let acc = 0;
        for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
        for (let y = 0; y < h; y++) {
          out[y * w + x] = acc / (2 * r + 1);
          acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
        }
      }
      src = out; out = pass === 0 ? new Float32Array(w * h) : out;
    }
    return { w, h, g: src };
  }

  // ---------- 1. corner points (Shi-Tomasi) ----------
  const R = 15;                                   // fingerprint patch radius
  function corners(im, max) {
    const { w, h, g } = im, n = w * h;
    const xx = new Float32Array(n), yy = new Float32Array(n), xy = new Float32Array(n);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, gx = (g[i + 1] - g[i - 1]) / 2, gy = (g[i + w] - g[i - w]) / 2;
      xx[i] = gx * gx; yy[i] = gy * gy; xy[i] = gx * gy;
    }
    const sxx = blur({ w, h, g: xx }, 2).g, syy = blur({ w, h, g: yy }, 2).g, sxy = blur({ w, h, g: xy }, 2).g;
    const resp = new Float32Array(n); let top = 0;
    for (let i = 0; i < n; i++) {
      const a = sxx[i], c = syy[i], b = sxy[i];
      const r = (a + c) / 2 - Math.sqrt(((a - c) / 2) ** 2 + b * b);   // smaller eigenvalue
      resp[i] = r; if (r > top) top = r;
    }
    const pts = [], B = R + 2, floor = top * 0.005;
    for (let y = B; y < h - B; y++) for (let x = B; x < w - B; x++) {
      const i = y * w + x, r = resp[i];
      if (r <= floor) continue;
      let peak = true;
      for (let dy = -2; dy <= 2 && peak; dy++) for (let dx = -2; dx <= 2; dx++) if ((dx || dy) && resp[i + dy * w + dx] > r) { peak = false; break; }
      if (peak) pts.push({ x, y, r });
    }
    pts.sort((p, q) => q.r - p.r);
    // Spread the points out: at most 3 per 20 x 20 square.
    const cell = 20, cols = Math.ceil(w / cell), used = new Uint8Array(cols * Math.ceil(h / cell)), out = [];
    for (const p of pts) {
      const k = Math.floor(p.y / cell) * cols + Math.floor(p.x / cell);
      if (used[k] >= 3) continue;
      used[k]++; out.push(p);
      if (out.length >= max) break;
    }
    return out;
  }

  // ---------- 2. fingerprints (BRIEF, 256 bits, upright) ----------
  const PAIRS = (() => {
    let s = 0x9e3779b9;
    const rnd = () => { s |= 0; s = s + 0x6d2b79f5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const gauss = () => { const u = Math.max(1e-9, rnd()), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const c = v => Math.max(-R, Math.min(R, Math.round(v)));
    const p = new Int8Array(256 * 4);
    for (let i = 0; i < 256; i++) { p[i * 4] = c(gauss() * 6.2); p[i * 4 + 1] = c(gauss() * 6.2); p[i * 4 + 2] = c(gauss() * 6.2); p[i * 4 + 3] = c(gauss() * 6.2); }
    return p;
  })();
  function describe(sm, pts) {
    const d = new Uint32Array(pts.length * 8), w = sm.w, g = sm.g;
    for (let k = 0; k < pts.length; k++) {
      const c = pts[k].y * w + pts[k].x;
      for (let i = 0; i < 256; i++) {
        const a = g[c + PAIRS[i * 4 + 1] * w + PAIRS[i * 4]], b = g[c + PAIRS[i * 4 + 3] * w + PAIRS[i * 4 + 2]];
        if (a < b) d[k * 8 + (i >> 5)] |= 1 << (i & 31);
      }
    }
    return d;
  }
  // ---------- the fast checker (WebAssembly) ----------
  // The sums in corners, blur, shrink, describe and match also exist in C (tools/wasm/align.c),
  // compiled to WebAssembly: a pre-translated language every Chrome, Edge and Firefox runs much
  // faster than JavaScript for this kind of number crunching. They do exactly the same sums in
  // the same order, so the answers are the same (tests/align/wasm_same.js checks it). If it
  // can't load, everything below simply uses the JavaScript versions.
  // WASM-START
  const WASM_B64 = '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';
  // WASM-END
  let W = null, PAIRS_BYTES = null;
  const ready = (async () => {
    try {
      if (typeof WebAssembly === 'undefined' || !WASM_B64 || (typeof self !== 'undefined' && self.PP_NO_WASM)) return false;
      const bin = Uint8Array.from(atob(WASM_B64), c => c.charCodeAt(0));
      const { instance } = await WebAssembly.instantiate(bin, {});
      PAIRS_BYTES = new Uint8Array(PAIRS.buffer.slice(0));
      W = instance.exports;
      return true;
    } catch (e) { W = null; return false; }
  })();
  const mem = () => W.memory.buffer;
  function featuresW(im, f0, xs, ys, mx, descs) {
    W.reset();
    const pairs = W.alloc(1024); new Uint8Array(mem(), pairs, 1024).set(PAIRS_BYTES);
    const MAX = 700, xyP = W.alloc(MAX * 8), rP = W.alloc(MAX * 4);
    let w = im.w, h = im.h, g = W.alloc(w * h * 4);
    new Float32Array(mem(), g, w * h).set(im.g);
    for (let lv = 0, scale = f0; lv < 12; lv++) {
      if (Math.min(w, h) < 2 * R + 20) break;
      const n = W.corners(g, w, h, MAX, xyP, rP), m = W.mark();
      const bl = W.alloc(w * h * 4), tmp = W.alloc(w * h * 4), mid = W.alloc(w * h * 4), dP = W.alloc(n * 32 + 32);
      W.blur(g, bl, tmp, mid, w, h, 1);
      W.describe(bl, w, xyP, n, pairs, dP);
      const XY = new Int32Array(mem(), xyP, n * 2);
      for (let k = 0; k < n; k++) { xs.push(XY[k * 2] / scale); ys.push(XY[k * 2 + 1] / scale); mx.push((w - 1 - XY[k * 2]) / scale); }
      descs.push(new Uint32Array(mem(), dP, n * 8).slice());
      W.release(m);
      const nw = Math.max(1, Math.round(w * (1 / 1.3))), nh = Math.max(1, Math.round(h * (1 / 1.3))), g2 = W.alloc(nw * nh * 4);
      W.shrink(g, w, h, g2, nw, nh);
      g = g2; w = nw; h = nh; scale /= 1.3;
    }
  }
  // Points + fingerprints at many sizes. x, y are given back in the full picture's pixels.
  // mx: where each point would be in the picture flipped left-right (for the mirror check).
  function features(bitmap, maxSide, opts = {}) {
    // Big pictures are shrunk to save time; very small ones (thumbnails) are enlarged so their
    // details are big enough to fingerprint.
    const big = Math.max(bitmap.width, bitmap.height), f0 = big < 450 ? 450 / big : Math.min(1, maxSide / big);
    let im = grayOf(bitmap, bitmap.width * f0, bitmap.height * f0);
    const xs = [], ys = [], mx = [], descs = [];
    if (W && !opts.js) featuresW(im, f0, xs, ys, mx, descs);
    else for (let lv = 0, scale = f0; lv < 12; lv++) {
      if (Math.min(im.w, im.h) < 2 * R + 20) break;
      const pts = corners(im, 700);
      const d = describe(blur(im, 1), pts);
      for (const p of pts) { xs.push(p.x / scale); ys.push(p.y / scale); mx.push((im.w - 1 - p.x) / scale); }
      descs.push(d);
      im = shrink(im, 1 / 1.3); scale /= 1.3;
    }
    const all = new Uint32Array(descs.reduce((n, d) => n + d.length, 0)); let o = 0;
    for (const d of descs) { all.set(d, o); o += d.length; }
    return { x: Float64Array.from(xs), y: Float64Array.from(ys), mx: Float64Array.from(mx), d: all, n: xs.length, f0 };
  }

  // ---------- 3. pairing up fingerprints ----------
  function pop(v) { v -= (v >>> 1) & 0x55555555; v = (v & 0x33333333) + ((v >>> 2) & 0x33333333); return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; }
  // i, j: the two details' numbers (in A and in B).
  async function match(A, B, opts = {}) {
    const out = [];
    if (W && !opts.js) {
      W.reset();
      const aP = W.alloc(A.n * 32 + 32), bP = W.alloc(B.n * 32 + 32), iP = W.alloc(B.n * 4 + 4), dP = W.alloc(B.n * 4 + 4);
      new Uint32Array(mem(), aP, A.n * 8).set(A.d); new Uint32Array(mem(), bP, B.n * 8).set(B.d);
      W.match(aP, A.n, bP, 0, B.n, iP, dP);            // fast enough to run in one go
      const I = new Int32Array(mem(), iP, B.n), D = new Int32Array(mem(), dP, B.n);
      for (let j = 0; j < B.n; j++) { const bi = I[j]; if (bi >= 0) out.push({ ax: A.x[bi], ay: A.y[bi], bx: B.x[j], by: B.y[j], d: D[j], i: bi, j }); }
      return out;
    }
    for (let j = 0; j < B.n; j++) {
      let best = 999, second = 999, bi = -1; const bo = j * 8;
      for (let i = 0; i < A.n; i++) {
        const ao = i * 8;
        let dist = pop(A.d[ao] ^ B.d[bo]) + pop(A.d[ao + 1] ^ B.d[bo + 1]) + pop(A.d[ao + 2] ^ B.d[bo + 2]) + pop(A.d[ao + 3] ^ B.d[bo + 3]);
        if (dist >= second) continue;
        dist += pop(A.d[ao + 4] ^ B.d[bo + 4]) + pop(A.d[ao + 5] ^ B.d[bo + 5]) + pop(A.d[ao + 6] ^ B.d[bo + 6]) + pop(A.d[ao + 7] ^ B.d[bo + 7]);
        if (dist < best) { second = best; best = dist; bi = i; } else if (dist < second) second = dist;
      }
      if (bi >= 0 && best <= 70 && best < 0.85 * second) out.push({ ax: A.x[bi], ay: A.y[bi], bx: B.x[j], by: B.y[j], d: best, i: bi, j });
      if (j % 300 === 299) await pause();
    }
    return out;
  }

  // ---------- placements ----------
  // Where the copy sits on the original, in the original's pixels:
  //   s    = overall size, w / h = extra stretch sideways / up-down (1 = none),
  //   r    = turn in degrees (around the copy's centre), k = slant (0 = none),
  //   flip = mirrored left-right, x, y = top-left corner of the copy before turning.
  const place = (o = {}) => ({ s: 1, w: 1, h: 1, r: 0, k: 0, flip: false, x: 0, y: 0, ...o });
  const sizes = (T, B) => ({ bw: B.width * T.s * T.w, bh: B.height * T.s * T.h });
  // Draws the copy onto ctx. k = canvas pixels per original pixel, (ox, oy) = where the original's corner is.
  function drawCopy(ctx, B, T, k, ox = 0, oy = 0, outline = false) {
    const { bw, bh } = sizes(T, B);
    ctx.save();
    ctx.translate((ox + T.x + bw / 2) * k, (oy + T.y + bh / 2) * k);
    ctx.rotate(T.r * Math.PI / 180);
    if (T.k) ctx.transform(1, 0, T.k, 1, 0, 0);
    if (outline) ctx.strokeRect(-bw * k / 2, -bh * k / 2, bw * k, bh * k);
    else { if (T.flip) ctx.scale(-1, 1); ctx.drawImage(B, -bw * k / 2, -bh * k / 2, bw * k, bh * k); }
    ctx.restore();
  }
  // The box (in the original's pixels) that holds the copy, turned or not.
  // Where a point (u, v) of the copy lands on the original.
  function mapPoint(T, B, u, v) {
    const { bw, bh } = sizes(T, B), a = T.r * Math.PI / 180;
    const uu = T.flip ? B.width - u : u;
    let lx = (uu / B.width - 0.5) * bw, ly = (v / B.height - 0.5) * bh;
    lx += T.k * ly;
    return { x: T.x + bw / 2 + lx * Math.cos(a) - ly * Math.sin(a), y: T.y + bh / 2 + lx * Math.sin(a) + ly * Math.cos(a) };
  }
  function bounds(T, B) {
    const ps = [[0, 0], [B.width, 0], [0, B.height], [B.width, B.height]].map(([u, v]) => mapPoint(T, B, u, v));
    return { x0: Math.min(...ps.map(p => p.x)), y0: Math.min(...ps.map(p => p.y)), x1: Math.max(...ps.map(p => p.x)), y1: Math.max(...ps.map(p => p.y)) };
  }
  // Change size / shape / turn while keeping the copy's centre where it is.
  function reshape(T, B, change) {
    const o = sizes(T, B), cx = T.x + o.bw / 2, cy = T.y + o.bh / 2, N = { ...T, ...change }, n = sizes(N, B);
    N.x = cx - n.bw / 2; N.y = cy - n.bh / 2;
    return N;
  }

  // ---------- 4. RANSAC: the one size + shape + position most pairs agree on ----------
  // Model (affine): a point (bx, by) on the copy lands at (a*bx + b*by + tx, c*bx + d*by + ty).
  function solve3(M, v) {   // 3 x 3 linear system
    const [a, b, c, d, e, f, g, h, i] = M, det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    if (Math.abs(det) < 1e-9) return null;
    return [(v[0] * (e * i - f * h) - b * (v[1] * i - f * v[2]) + c * (v[1] * h - e * v[2])) / det,
      (a * (v[1] * i - f * v[2]) - v[0] * (d * i - f * g) + c * (d * v[2] - v[1] * g)) / det,
      (a * (e * v[2] - v[1] * h) - b * (d * v[2] - v[1] * g) + v[0] * (d * h - e * g)) / det];
  }
  function fitAffine(ms) {
    let xx = 0, xy = 0, yy = 0, x1 = 0, y1 = 0, n = ms.length, ux = 0, uy = 0, u1 = 0, vx = 0, vy = 0, v1 = 0;
    for (const m of ms) {
      xx += m.bx * m.bx; xy += m.bx * m.by; yy += m.by * m.by; x1 += m.bx; y1 += m.by;
      ux += m.ax * m.bx; uy += m.ax * m.by; u1 += m.ax; vx += m.ay * m.bx; vy += m.ay * m.by; v1 += m.ay;
    }
    const N = [xx, xy, x1, xy, yy, y1, x1, y1, n], p = solve3(N, [ux, uy, u1]), q = solve3(N, [vx, vy, v1]);
    return p && q ? { a: p[0], b: p[1], tx: p[2], c: q[0], d: q[1], ty: q[2] } : null;
  }
  // Only resized and moved: a point lands at (s*bx + tx, s*by + ty).
  function fitUniform(ms) {
    if (ms.length < 2) return null;
    let ax = 0, ay = 0, bx = 0, by = 0;
    for (const m of ms) { ax += m.ax; ay += m.ay; bx += m.bx; by += m.by; }
    ax /= ms.length; ay /= ms.length; bx /= ms.length; by /= ms.length;
    let num = 0, den = 0;
    for (const m of ms) { num += (m.bx - bx) * (m.ax - ax) + (m.by - by) * (m.ay - ay); den += (m.bx - bx) ** 2 + (m.by - by) ** 2; }
    if (!(den > 0) || num <= 0) return null;
    const s = num / den;
    return { a: s, b: 0, c: 0, d: s, tx: ax - s * bx, ty: ay - s * by };
  }
  // How far a pair lands from where the guess puts it, squared (compared with thr * thr: the
  // same answer as the distance itself, without the slow square root).
  const err2 = (M, m) => { const dx = M.a * m.bx + M.b * m.by + M.tx - m.ax, dy = M.c * m.bx + M.d * m.by + M.ty - m.ay; return dx * dx + dy * dy; };
  // Turns an affine model into a placement: size, stretch, turn. Tiny turns and stretches are
  // set to exactly none, so a plain copy reads as plainly resized.
  function toPlace(M, B, flip) {
    // M = turn(r) x [[sx, sh], [0, sy]]: size, stretch, slant, then turn. Any affine fits this exactly.
    let r = Math.atan2(M.c, M.a), sx, sy, sh;
    if (Math.abs(r) < 0.2 * Math.PI / 180) { r = 0; sx = M.a; sh = M.b; sy = M.d; }
    else { sx = Math.hypot(M.a, M.c); sh = (M.a * M.b + M.c * M.d) / sx; sy = (M.a * M.d - M.b * M.c) / sx; }
    let k = sy ? sh / sy : 0;
    if (Math.abs(k) < 0.004) k = 0;
    const cxA = M.a * B.width / 2 + M.b * B.height / 2 + M.tx, cyA = M.c * B.width / 2 + M.d * B.height / 2 + M.ty;
    const T = Math.abs(sx / sy - 1) < 0.005 ? place({ s: Math.sqrt(sx * sy), r: r * 180 / Math.PI, k, flip })
      : place({ s: sy, w: sx / sy, r: r * 180 / Math.PI, k, flip });
    const { bw, bh } = sizes(T, B);
    T.x = cxA - bw / 2; T.y = cyA - bh / 2;
    T.ok = sx > 0 && sy > 0 && sx / sy > 0.5 && sx / sy < 2 && Math.abs(r) < 0.35 && Math.abs(k) < 0.3;
    return T;
  }
  // minScale: the smallest size the copy may be shrunk to. Without it, a guess that shrinks the
  // whole copy to a dot "agrees" with every match that happens to land on that dot, and two
  // different photos end up compared over two tiny squares (and could score 100%).
  function ransac(ms, thr, minDist, minScale = 0.02) {
    if (ms.length < 4) return null;
    let s0 = 0x2545f491;
    const rnd = n => { s0 ^= s0 << 13; s0 ^= s0 >>> 17; s0 ^= s0 << 5; return (s0 >>> 0) % n; };
    let best = null, bestN = 0;
    const thr2 = thr * thr;
    for (let it = 0; it < 6000; it++) {
      const p = ms[rnd(ms.length)], q = ms[rnd(ms.length)];
      const dbx = q.bx - p.bx, dby = q.by - p.by, dax = q.ax - p.ax, day = q.ay - p.ay;
      const db = Math.hypot(dbx, dby), da = Math.hypot(dax, day);
      if (db < minDist || da < 1) continue;
      let M;
      if (it % 2 === 0) {
        // guess 1: resized and maybe turned a little (up to 20 degrees)
        const s = da / db, ang = Math.atan2(day, dax) - Math.atan2(dby, dbx), r = Math.atan2(Math.sin(ang), Math.cos(ang));
        if (s < minScale || s > 50 || Math.abs(r) > 0.35) continue;
        const cs = s * Math.cos(r), sn = s * Math.sin(r);
        M = { a: cs, b: -sn, c: sn, d: cs };
      } else {
        // guess 2: stretched wider or taller, not turned
        if (Math.abs(dbx) < minDist || Math.abs(dby) < minDist) continue;
        const sx = dax / dbx, sy = day / dby;
        if (sx < minScale || sy < minScale || sx / sy < 0.5 || sx / sy > 2) continue;
        M = { a: sx, b: 0, c: 0, d: sy };
      }
      M.tx = p.ax - M.a * p.bx - M.b * p.by; M.ty = p.ay - M.c * p.bx - M.d * p.by;
      // Count the pairs that agree. Stops early once this guess can no longer beat the best
      // one (same result, much less work: most guesses are wrong).
      let n = 0;
      const { a, b, c, d, tx, ty } = M;
      for (let i = 0, left = ms.length; i < ms.length; i++, left--) {
        if (n + left <= bestN) break;
        const m = ms[i], dx = a * m.bx + b * m.by + tx - m.ax, dy = c * m.bx + d * m.by + ty - m.ay;
        if (dx * dx + dy * dy < thr2) n++;
      }
      if (n > bestN) { bestN = n; best = M; }
    }
    if (!best) return null;
    let M = best, inl = ms.filter(m => err2(M, m) < thr2);
    for (let k = 0; k < 4 && inl.length >= 4; k++) {
      const F = fitAffine(inl); if (!F) break;
      const t = thr * (k ? 0.6 : 1);
      M = F; inl = ms.filter(m => err2(M, m) < t * t);
    }
    if (Math.sqrt(Math.abs(M.a * M.d - M.b * M.c)) < minScale) return null;
    return { M, inl, inliers: inl.length, matches: ms.length };
  }

  // ---------- 5. how well they line up: small squares compared one by one ----------
  // The copy is drawn onto a canvas the size of the original, exactly where it sits.
  // Only the area where the two overlap counts, and a square where the copy has something
  // printed over it (a headline, a logo) simply doesn't match; it doesn't drag the rest down.
  function render(B, T, w, h, f) {
    const ctx = surface(w, h);
    ctx.imageSmoothingQuality = 'high';
    drawCopy(ctx, B, T, f);
    const d = ctx.getImageData(0, 0, w, h).data, g = new Float32Array(w * h), m = new Uint8Array(w * h);
    for (let i = 0, j = 0; j < g.length; i += 4, j++) {
      g[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      m[j] = d[i + 3] > 250 ? 1 : 0;
    }
    return { w, h, g, m };
  }
  function tiles(a, b, size) {
    // midTex/midMatched: the same count for the middle of the original only, where the subject
    // usually is. Two different photos taken in front of the same backdrop (sponsor wall, logo
    // pattern) line up around the edges but not in the middle.
    const res = { textured: 0, matched: 0, flat: 0, flatSame: 0, sumR: 0, inside: 0, midTex: 0, midMatched: 0 };
    for (let ty = 0; ty + size <= a.h; ty += size) for (let tx = 0; tx + size <= a.w; tx += size) {
      let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, out = false;
      for (let y = ty; y < ty + size && !out; y++) {
        const row = y * a.w;
        for (let x = tx; x < tx + size; x++) {
          const i = row + x;
          if (!b.m[i]) { out = true; break; }
          const p = a.g[i], q = b.g[i]; n++; sa += p; sb += q; saa += p * p; sbb += q * q; sab += p * q;
        }
      }
      if (out) continue;
      res.inside++;
      const ma = sa / n, mb = sb / n, va = saa / n - ma * ma, vb = sbb / n - mb * mb;
      if (va < 25 && vb < 25) { res.flat++; if (Math.abs(ma - mb) < 25) res.flatSame++; continue; }
      res.textured++;
      const r = va > 4 && vb > 4 ? (sab / n - ma * mb) / Math.sqrt(va * vb) : 0;
      if (r > 0.6) { res.matched++; res.sumR += r; }
      const cx = (tx + size / 2) / a.w, cy = (ty + size / 2) / a.h;
      if (cx > 0.3 && cx < 0.7 && cy > 0.2 && cy < 0.8) { res.midTex++; if (r > 0.6) res.midMatched++; }
    }
    return res;
  }
  // A grade for a placement: the share of the shared area whose details line up.
  function grade(t) {
    const total = t.textured + t.flat * 0.25;
    return total ? (t.matched + t.flatSame * 0.25) / total : 0;
  }
  // Score a placement T (in the original's pixels).
  // The original in grey at one size, worked out once per original (it is the same every time).
  const grayCache = new WeakMap();
  function grayAt(Abm, f) {
    let m = grayCache.get(Abm);
    if (!m) grayCache.set(Abm, m = new Map());
    const k = Math.round(Abm.width * f) + 'x' + Math.round(Abm.height * f);
    if (!m.has(k)) { if (m.size > 3) m.delete(m.keys().next().value); m.set(k, grayOf(Abm, Abm.width * f, Abm.height * f)); }
    return m.get(k);
  }
  function score(Abm, Bbm, T, side = 480) {
    const f = side / Math.max(Abm.width, Abm.height);
    const a = grayAt(Abm, f), b = render(Bbm, T, a.w, a.h, f);
    const t = tiles(a, b, 12);
    let inside = 0; for (let i = 0; i < b.m.length; i++) inside += b.m[i];
    const { bw, bh } = sizes(T, Bbm);
    return { ...t, overlap: inside / Math.max(1, bw * bh * f * f), overlapA: inside / (a.w * a.h), lines: grade(t), strength: t.matched ? t.sumR / t.matched : 0 };
  }

  // ---------- 6. which parts are the same photo, and which were added or redrawn ----------
  // The shared area is split into small squares (as in score). A square counts towards "same photo"
  // when most squares around it (5 x 5) line up; that way a redrawn face, an added object or a
  // headline band shows as one red area, and the untouched photo as one green area around it.
  // Two different photos score (almost) no green: their few chance matches are scattered.
  // reg: one value per square, 0 = outside the shared area, 1 = same photo, 2 = added or changed.
  function changes(Abm, Bbm, T, side = 480, S = 12) {
    const f = side / Math.max(Abm.width, Abm.height);
    const a = grayAt(Abm, f), b = render(Bbm, T, a.w, a.h, f);
    const gw = Math.floor(a.w / S), gh = Math.floor(a.h / S), st = new Uint8Array(gw * gh); // 0 out, 1 match, 2 miss, 3 flat same, 4 flat different
    for (let ty = 0; ty < gh; ty++) for (let tx = 0; tx < gw; tx++) {
      let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, out = false;
      for (let y = ty * S; y < ty * S + S && !out; y++) for (let x = tx * S; x < tx * S + S; x++) {
        const i = y * a.w + x;
        if (!b.m[i]) { out = true; break; }
        const p = a.g[i], q = b.g[i]; n++; sa += p; sb += q; saa += p * p; sbb += q * q; sab += p * q;
      }
      const k = ty * gw + tx;
      if (out) continue;
      const ma = sa / n, mb = sb / n, va = saa / n - ma * ma, vb = sbb / n - mb * mb;
      if (va < 25 && vb < 25) { st[k] = Math.abs(ma - mb) < 25 ? 3 : 4; continue; }
      const r = va > 4 && vb > 4 ? (sab / n - ma * mb) / Math.sqrt(va * vb) : 0;
      st[k] = r > 0.6 ? 1 : 2;
    }
    const reg = new Uint8Array(gw * gh);
    let inside = 0, same = 0, matchedIn = 0, texIn = 0;
    for (let ty = 0; ty < gh; ty++) for (let tx = 0; tx < gw; tx++) {
      const k = ty * gw + tx; if (!st[k]) continue;
      let m = 0, t = 0;
      for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
        const x = tx + i, y = ty + j; if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
        const v = st[y * gw + x];
        if (v === 1) { m++; t++; } else if (v === 2) t++; else if (v === 3) { m += 0.5; t += 0.5; } else if (v === 4) t += 0.5;
      }
      reg[k] = t && m / t >= 0.35 ? 1 : 2;
      inside++;
      if (reg[k] === 1) { same++; if (st[k] === 1) { matchedIn++; texIn++; } else if (st[k] === 2) texIn++; }
    }
    return { gw, gh, cell: S / f, reg, inside, same, sameShare: inside ? same / inside : 0, changedShare: inside ? 1 - same / inside : 0, untouchedLines: texIn ? matchedIn / texIn : 0 };
  }

  // ---------- 8. repeating backdrops (press walls, "step and repeat") ----------
  // At press events people stand in front of a wall printed with the same logos over and over.
  // A different shot in front of the same wall lines up on those logos, and on nothing else.
  // For each square that lines up, this looks for the same detail somewhere else in the
  // original. If (nearly) every square that lines up is a logo printed again elsewhere, only
  // the backdrop matches: backdropOnly. Fine detail only (a blurred copy is subtracted), so
  // smooth sky or walls count as "plain", neither repeated nor unique.
  function repeats(Abm, Bbm, T, side = 240, S = 12) {
    const f = side / Math.max(Abm.width, Abm.height);
    const a = grayAt(Abm, f), b = render(Bbm, T, a.w, a.h, f), w = a.w, h = a.h;
    const bl = blur(a, 2), hp = new Float32Array(w * h);
    for (let i = 0; i < hp.length; i++) hp[i] = a.g[i] - bl.g[i];
    // integral images of hp and hp*hp, so any square's sum and spread are quick to get
    const I = new Float64Array((w + 1) * (h + 1)), I2 = new Float64Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) { let r = 0, r2 = 0; for (let x = 0; x < w; x++) { const v = hp[y * w + x]; r += v; r2 += v * v; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + r; I2[(y + 1) * (w + 1) + x + 1] = I2[y * (w + 1) + x + 1] + r2; } }
    const box = (A2, x, y) => A2[(y + S) * (w + 1) + x + S] - A2[y * (w + 1) + x + S] - A2[(y + S) * (w + 1) + x] + A2[y * (w + 1) + x];
    const n = S * S;
    // the squares that line up (same test as score)
    const matched = [];
    for (let ty = 0; ty + S <= h; ty += S) for (let tx = 0; tx + S <= w; tx += S) {
      let k = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, out = false;
      for (let y = ty; y < ty + S && !out; y++) for (let x = tx; x < tx + S; x++) {
        const i = y * w + x; if (!b.m[i]) { out = true; break; }
        const p = a.g[i], q = b.g[i]; k++; sa += p; sb += q; saa += p * p; sbb += q * q; sab += p * q;
      }
      if (out) continue;
      const ma = sa / k, mb = sb / k, va = saa / k - ma * ma, vb = sbb / k - mb * mb;
      if (va < 25 && vb < 25) continue;
      const r = va > 4 && vb > 4 ? (sab / k - ma * mb) / Math.sqrt(va * vb) : 0;
      if (r > 0.6) matched.push([tx, ty]);
    }
    const res = { checked: 0, repeated: 0, unique: 0, plain: 0, matched: matched.length };
    const step = Math.max(1, Math.ceil(matched.length / 40));
    for (let m = 0; m < matched.length; m += step) {
      const [tx, ty] = matched[m];
      const s0 = box(I, tx, ty), e0 = box(I2, tx, ty) - s0 * s0 / n;
      if (e0 / n < 12) { res.plain++; continue; }       // no fine detail to go on
      res.checked++;
      const ncc = (x, y) => {
        const s1 = box(I, x, y), e1 = box(I2, x, y) - s1 * s1 / n; if (e1 / n < 6) return 0;
        let sab = 0;
        for (let j = 0; j < S; j++) { const ra = (ty + j) * w + tx, rb = (y + j) * w + x; for (let i = 0; i < S; i++) sab += hp[ra + i] * hp[rb + i]; }
        return (sab - s0 * s1 / n) / Math.sqrt(e0 * e1);
      };
      let best = 0, bx = 0, by = 0;
      for (let y = 0; y + S <= h; y += 2) for (let x = 0; x + S <= w; x += 2) {
        if (Math.abs(x - tx) < S * 1.5 && Math.abs(y - ty) < S * 1.5) continue;   // itself
        const r = ncc(x, y); if (r > best) { best = r; bx = x; by = y; }
      }
      if (best > 0.5) for (let y = Math.max(0, by - 1); y <= Math.min(h - S, by + 1); y++) for (let x = Math.max(0, bx - 1); x <= Math.min(w - S, bx + 1); x++) {
        if (Math.abs(x - tx) < S * 1.5 && Math.abs(y - ty) < S * 1.5) continue;
        best = Math.max(best, ncc(x, y));
      }
      if (best > 0.75) res.repeated++; else res.unique++;
    }
    // Only the backdrop lines up: hardly any square that lines up is one of a kind.
    res.backdropOnly = res.checked >= 6 && res.unique <= Math.max(2, 0.2 * res.checked);
    return res;
  }

  // ---------- 7. one spot (a face, a logo) compared on its own ----------
  // box = { x, y, w, h } in the original's pixels. The same spot is cut from the lined-up copy,
  // allowing it to have moved a little (AI edits often nudge people), and the two cut-outs are
  // compared. r: 1 = identical. dx, dy: how far it moved in the copy, in the original's pixels.
  function spot(Abm, Bbm, T, box) {
    const m = Math.round(0.04 * Math.max(Abm.width, Abm.height));
    const f = Math.min(1, 96 / Math.max(box.w, box.h));
    const rx = box.x - m, ry = box.y - m, W = Math.max(1, Math.round((box.w + 2 * m) * f)), H = Math.max(1, Math.round((box.h + 2 * m) * f));
    const grab = drawIt => {
      const ctx = surface(W, H); ctx.imageSmoothingQuality = 'high'; drawIt(ctx);
      const d = ctx.getImageData(0, 0, W, H).data, g = new Float32Array(W * H), a = new Uint8Array(W * H);
      for (let i = 0, j = 0; j < g.length; i += 4, j++) { g[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; a[j] = d[i + 3] > 250 ? 1 : 0; }
      return { w: W, h: H, g, a };
    };
    const A0 = grab(ctx => ctx.drawImage(Abm, -rx * f, -ry * f, Abm.width * f, Abm.height * f));
    const B0 = grab(ctx => drawCopy(ctx, Bbm, T, f, -rx, -ry));
    const a = blur(A0, 1).g, b = blur(B0, 1).g;
    const M = Math.round(m * f), bw = Math.round(box.w * f), bh = Math.round(box.h * f);
    let n0 = 0, s0 = 0, ss0 = 0;
    for (let y = M; y < M + bh; y++) for (let x = M; x < M + bw; x++) { const p = a[y * W + x]; n0++; s0 += p; ss0 += p * p; }
    const ma = s0 / n0, va = ss0 / n0 - ma * ma;
    if (va < 30) return { flat: true };
    let best = { r: -2, dx: 0, dy: 0, v: -9 }, covered = false;
    const at = (dx, dy) => {
      let n = 0, sb = 0, sbb = 0, sab = 0, out = 0;
      for (let y = M; y < M + bh; y++) {
        const ra = y * W, rb = (y + dy) * W + dx;
        for (let x = M; x < M + bw; x++) {
          if (!B0.a[rb + x]) { out++; continue; }
          const p = a[ra + x], q = b[rb + x]; n++; sb += q; sbb += q * q; sab += p * q;
        }
      }
      if (out > n0 * 0.05 || n < 16) return;
      covered = true;
      const mb = sb / n, vb = sbb / n - mb * mb; if (vb < 4) return;
      const r = (sab / n - ma * mb) / Math.sqrt(va * vb);
      // a small bonus for staying put, so a plain area doesn't wander off to a chance match
      const v = r - Math.hypot(dx, dy) / (M + 1) * 0.02;
      if (v > best.v) best = { r, dx, dy, v };
    };
    // every 2nd position first, then every position around the best one
    for (let dy = -M; dy <= M; dy += 2) for (let dx = -M; dx <= M; dx += 2) at(dx, dy);
    const cx = best.dx, cy = best.dy;
    for (let dy = Math.max(-M, cy - 2); dy <= Math.min(M, cy + 2); dy++) for (let dx = Math.max(-M, cx - 2); dx <= Math.min(M, cx + 2); dx++) at(dx, dy);
    if (!covered) return { outside: true };
    return { r: Math.max(0, Math.min(1, best.r)), dx: best.dx / f, dy: best.dy / f };
  }

  // Nudge the position, size, stretch and turn a little at a time, keeping whatever lines up best.
  // from: start at a later round (smaller steps), for the last polish after the graphics card.
  async function refine(Abm, Bbm, T0, from = 0) {
    const side = Math.min(720, Math.max(Abm.width, Abm.height)), f = side / Math.max(Abm.width, Abm.height);
    const a = grayAt(Abm, f);
    const val = T => tiles(a, render(Bbm, T, a.w, a.h, f), 16).sumR;
    if (Array.isArray(T0)) return T0.map(val);
    let T = { ...T0 }, best = val(T);
    const steps = { x: 2 / f, y: 2 / f, s: 0.006, w: T.w !== 1 ? 0.006 : 0, r: T.r !== 0 ? 0.3 : 0, k: T.k !== 0 ? 0.005 : 0 };
    for (const k in steps) steps[k] /= 2 ** from;
    for (let round = from; round < 5; round++) {
      for (const k of ['x', 'y', 's', 'w', 'r', 'k']) {
        if (!steps[k]) continue;
        for (const dir of [1, -1]) {
          const ch = k === 's' || k === 'w' ? { [k]: T[k] * (1 + dir * steps[k]) } : { [k]: T[k] + dir * steps[k] };
          const N = k === 'x' || k === 'y' ? { ...T, ...ch } : reshape(T, Bbm, ch), v = val(N);
          if (v > best) { best = v; T = N; break; }
        }
      }
      for (const k in steps) steps[k] /= 2;
      await pause();
    }
    return T;
  }

  // ---------- the graphics card (WebGPU) for the fine-tuning ----------
  // Fine-tuning (refine) draws the copy 30 to 60 times in slightly different places and compares
  // it square by square with your photo. On the graphics card all the squares are compared at
  // the same time, and both "a bit more / a bit less" tries of each step in one go. It is used
  // for reverse searches only (opts.fast), on computers whose browser offers a real graphics card;
  // otherwise, or if anything goes wrong, the normal fine-tuning above runs. The final match
  // numbers (score) are always worked out the normal way, so they mean the same as before.
  const GPU = { state: 'off', dev: null, pipe: null, aBuf: new WeakMap(), why: '' };
  const WGSL = `
struct Prm { a: vec4f, b: vec4f, d: vec4f };
@group(0) @binding(0) var<storage, read> A: array<f32>;
@group(0) @binding(1) var Bt: texture_2d<f32>;
@group(0) @binding(2) var smp: sampler;
@group(0) @binding(3) var<storage, read> prm: array<Prm>;
@group(0) @binding(4) var<storage, read_write> outp: array<vec4f>;
var<workgroup> s: array<vec4f, 256>;
@compute @workgroup_size(16, 16)
fn main(@builtin(workgroup_id) wg: vec3u, @builtin(local_invocation_id) l: vec3u, @builtin(local_invocation_index) li: u32) {
  let m = prm[wg.z];
  let aw = u32(m.d.z); let ntx = u32(m.d.w); let nty = u32(m.b.w);
  let x = wg.x * 16u + l.x; let y = wg.y * 16u + l.y;
  let p = A[y * aw + x];
  let px = f32(x) + m.a.w; let py = f32(y) + m.a.w;
  let u = m.a.x * px + m.a.y * py + m.a.z; let v = m.b.x * px + m.b.y * py + m.b.z;
  let c = textureSampleLevel(Bt, smp, vec2f(u / m.d.x, v / m.d.y), 0.0);
  let inside = u >= 0.5 && v >= 0.5 && u <= m.d.x - 0.5 && v <= m.d.y - 0.5 && c.a > 0.981;
  let q = dot(c.rgb * 255.0, vec3f(0.299, 0.587, 0.114));
  s[li] = vec4f(p, q, select(0.0, 1.0, inside), 0.0);
  workgroupBarrier();
  for (var k = 128u; k > 0u; k = k >> 1u) { if (li < k) { s[li] = s[li] + s[li + k]; } workgroupBarrier(); }
  let tot = s[0];
  workgroupBarrier();
  let ma = tot.x / 256.0; let mb = tot.y / 256.0;
  let dp = p - ma; let dq = q - mb;
  s[li] = vec4f(dp * dp, dq * dq, dp * dq, 0.0);
  workgroupBarrier();
  for (var k = 128u; k > 0u; k = k >> 1u) { if (li < k) { s[li] = s[li] + s[li + k]; } workgroupBarrier(); }
  if (li == 0u) {
    let o = (wg.z * ntx * nty + wg.y * ntx + wg.x) * 2u;
    outp[o] = vec4f(select(0.0, 1.0, tot.z > 255.5), ma, mb, 0.0);
    outp[o + 1u] = s[0] / 256.0;
  }
}`;
  async function gpuReady() {
    if (GPU.state === 'on') return GPU;
    if (GPU.state === 'failed') return null;
    if (!GPU.starting) GPU.starting = (async () => {
      try {
        const nav = typeof navigator !== 'undefined' ? navigator : null;
        if (!nav || !nav.gpu) throw new Error('no WebGPU in this browser');
        const ad = await nav.gpu.requestAdapter({ powerPreference: 'high-performance' });
        if (!ad) throw new Error('no graphics card offered');
        // A "fallback" adapter is the processor pretending to be a graphics card: slower than the normal way.
        if (ad.info && ad.info.isFallbackAdapter && !(typeof self !== 'undefined' && self.PP_GPU_ANY)) throw new Error('only a software graphics card');
        const dev = await ad.requestDevice();
        dev.lost.then(() => { GPU.state = 'failed'; GPU.why = 'graphics card lost'; });
        const mod = dev.createShaderModule({ code: WGSL });
        GPU.pipe = await dev.createComputePipelineAsync({ layout: 'auto', compute: { module: mod, entryPoint: 'main' } });
        GPU.smp = dev.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
        GPU.dev = dev; GPU.state = 'on'; GPU.why = (ad.info && [ad.info.vendor, ad.info.architecture].filter(Boolean).join(' ')) || 'yes';
      } catch (e) { GPU.state = 'failed'; GPU.why = String(e && e.message || e); }
    })();
    await GPU.starting;
    return GPU.state === 'on' ? GPU : null;
  }
  // Your photo in grey, on the graphics card (kept for the next picture).
  function gpuA(Abm, a) {
    let m = GPU.aBuf.get(Abm); const k = a.w + 'x' + a.h;
    if (m && m.k === k) return m.buf;
    if (m) m.buf.destroy();
    const buf = GPU.dev.createBuffer({ size: a.g.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    GPU.dev.queue.writeBuffer(buf, 0, a.g);
    GPU.aBuf.set(Abm, { k, buf });
    return buf;
  }
  // Where the copy's picture Bs sits for placement T: the same steps as drawCopy, turned around
  // so each square's pixel can look up its spot in the copy.
  function invFor(T, Bbm, Bs, k) {
    const { bw, bh } = sizes(T, Bbm);
    let m = new DOMMatrix().translate((T.x + bw / 2) * k, (T.y + bh / 2) * k).rotate(T.r);
    if (T.k) m = m.multiply(new DOMMatrix([1, 0, T.k, 1, 0, 0]));
    if (T.flip) m = m.scale(-1, 1);
    m = m.translate(-bw * k / 2, -bh * k / 2).scale(bw * k / Bs.width, bh * k / Bs.height);
    return m.inverse();
  }
  async function refineGPU(Abm, Bbm, T0, probe) {
    const G = await gpuReady(); if (!G) return null;
    const side = Math.min(720, Math.max(Abm.width, Abm.height)), f = side / Math.max(Abm.width, Abm.height);
    const a = grayAt(Abm, f), dev = G.dev;
    const ntx = Math.floor(a.w / 16), nty = Math.floor(a.h / 16);
    if (!ntx || !nty) return null;
    const Bs = Bbm;
    const tex = dev.createTexture({ size: [Bs.width, Bs.height], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
    const MAXC = 2, outSize = MAXC * ntx * nty * 32;
    const prm = dev.createBuffer({ size: MAXC * 48, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const out = dev.createBuffer({ size: outSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const rd = dev.createBuffer({ size: outSize, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    try {
      dev.queue.copyExternalImageToTexture({ source: Bs }, { texture: tex }, [Bs.width, Bs.height]);
      const bind = dev.createBindGroup({ layout: G.pipe.getBindGroupLayout(0), entries: [
        { binding: 0, resource: { buffer: gpuA(Abm, a) } }, { binding: 1, resource: tex.createView() }, { binding: 2, resource: G.smp },
        { binding: 3, resource: { buffer: prm } }, { binding: 4, resource: { buffer: out } }] });
      // Each try: the same sum as tiles(..., 16).sumR (only the squares that line up add to it).
      const vals = async Ts => {
        const P = new Float32Array(MAXC * 12);
        Ts.forEach((T, c) => { const M = invFor(T, Bbm, Bs, f); P.set([M.a, M.c, M.e, 0.5, M.b, M.d, M.f, nty, Bs.width, Bs.height, a.w, ntx], c * 12); });
        dev.queue.writeBuffer(prm, 0, P);
        const enc = dev.createCommandEncoder(), pass = enc.beginComputePass();
        pass.setPipeline(G.pipe); pass.setBindGroup(0, bind); pass.dispatchWorkgroups(ntx, nty, Ts.length); pass.end();
        enc.copyBufferToBuffer(out, 0, rd, 0, Ts.length * ntx * nty * 32);
        dev.queue.submit([enc.finish()]);
        await rd.mapAsync(GPUMapMode.READ, 0, Ts.length * ntx * nty * 32);
        const R = new Float32Array(rd.getMappedRange(0, Ts.length * ntx * nty * 32)).slice();
        rd.unmap();
        return Ts.map((T, c) => {
          let sum = 0;
          for (let t = 0, o = c * ntx * nty * 8; t < ntx * nty; t++, o += 8) {
            if (R[o] < 0.5) continue;
            const va = R[o + 4], vb = R[o + 5], cov = R[o + 6];
            if (va < 25 && vb < 25) continue;
            const r = va > 4 && vb > 4 ? cov / Math.sqrt(va * vb) : 0;
            if (r > 0.6) sum += r;
          }
          return sum;
        });
      };
      if (probe) { const o = []; for (let i = 0; i < probe.length; i += 2) o.push(...await vals(probe.slice(i, i + 2))); return o; }
      // The same fine-tuning steps as refine(); both directions of a step are tried at once.
      let T = { ...T0 }, best = (await vals([T]))[0];
      const steps = { x: 2 / f, y: 2 / f, s: 0.006, w: T.w !== 1 ? 0.006 : 0, r: T.r !== 0 ? 0.3 : 0, k: T.k !== 0 ? 0.005 : 0 };
      for (let round = 0; round < 5; round++) {
        for (const k of ['x', 'y', 's', 'w', 'r', 'k']) {
          if (!steps[k]) continue;
          const Ns = [1, -1].map(dir => {
            const ch = k === 's' || k === 'w' ? { [k]: T[k] * (1 + dir * steps[k]) } : { [k]: T[k] + dir * steps[k] };
            return k === 'x' || k === 'y' ? { ...T, ...ch } : reshape(T, Bbm, ch);
          });
          const vs = await vals(Ns);
          for (let i = 0; i < 2; i++) if (vs[i] > best) { best = vs[i]; T = Ns[i]; break; }
        }
        for (const k in steps) steps[k] /= 2;
      }
      return T;
    } finally {
      tex.destroy(); prm.destroy(); out.destroy(); rd.destroy();
    }
  }
  // ---------- the graphics card for "find the details" (step 1) and the pairing up ----------
  // Every found picture goes through these, so they matter most. The graphics card works out how
  // "cornery" every pixel is (and the blurred picture the fingerprints are read from) for all the
  // sizes at once; the strongest corners and their fingerprints are then picked exactly as before
  // (WebAssembly). The graphics card counts in slightly less exact numbers, so a corner or two
  // can differ; the 730 test checks give the same Same / Maybe / Different answers.
  // Pairing up on the graphics card gives exactly the same pairs (whole numbers only).
  const WGSL_F = `
struct P { w: u32, h: u32, r: i32, nw: u32, nh: u32 };
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> i0: array<f32>;
@group(0) @binding(2) var<storage, read> i1: array<f32>;
@group(0) @binding(3) var<storage, read> i2: array<f32>;
@group(0) @binding(4) var<storage, read_write> o0: array<f32>;
@group(0) @binding(5) var<storage, read_write> o1: array<f32>;
@group(0) @binding(6) var<storage, read_write> o2: array<f32>;
fn cx(x: i32) -> u32 { return u32(clamp(x, 0, i32(p.w) - 1)); }
fn cy(y: i32) -> u32 { return u32(clamp(y, 0, i32(p.h) - 1)); }
@compute @workgroup_size(16, 16) fn grad(@builtin(global_invocation_id) g: vec3u) {
  if (g.x >= p.w || g.y >= p.h) { return; }
  let i = g.y * p.w + g.x;
  if (g.x < 1u || g.y < 1u || g.x + 1u >= p.w || g.y + 1u >= p.h) { o0[i] = 0.0; o1[i] = 0.0; o2[i] = 0.0; return; }
  let gx = (i0[i + 1u] - i0[i - 1u]) / 2.0; let gy = (i0[i + p.w] - i0[i - p.w]) / 2.0;
  o0[i] = gx * gx; o1[i] = gy * gy; o2[i] = gx * gy;
}
@compute @workgroup_size(16, 16) fn hbox3(@builtin(global_invocation_id) g: vec3u) {
  if (g.x >= p.w || g.y >= p.h) { return; }
  var a = 0.0; var b = 0.0; var c = 0.0; let row = g.y * p.w;
  for (var k = -p.r; k <= p.r; k++) { let j = row + cx(i32(g.x) + k); a += i0[j]; b += i1[j]; c += i2[j]; }
  let n = f32(2 * p.r + 1); let i = row + g.x; o0[i] = a / n; o1[i] = b / n; o2[i] = c / n;
}
@compute @workgroup_size(16, 16) fn vbox3(@builtin(global_invocation_id) g: vec3u) {
  if (g.x >= p.w || g.y >= p.h) { return; }
  var a = 0.0; var b = 0.0; var c = 0.0;
  for (var k = -p.r; k <= p.r; k++) { let j = cy(i32(g.y) + k) * p.w + g.x; a += i0[j]; b += i1[j]; c += i2[j]; }
  let n = f32(2 * p.r + 1); let i = g.y * p.w + g.x; o0[i] = a / n; o1[i] = b / n; o2[i] = c / n;
}
@compute @workgroup_size(16, 16) fn hbox1(@builtin(global_invocation_id) g: vec3u) {
  if (g.x >= p.w || g.y >= p.h) { return; }
  var a = 0.0; let row = g.y * p.w;
  for (var k = -p.r; k <= p.r; k++) { a += i0[row + cx(i32(g.x) + k)]; }
  o0[row + g.x] = a / f32(2 * p.r + 1);
}
@compute @workgroup_size(16, 16) fn vbox1(@builtin(global_invocation_id) g: vec3u) {
  if (g.x >= p.w || g.y >= p.h) { return; }
  var a = 0.0;
  for (var k = -p.r; k <= p.r; k++) { a += i0[cy(i32(g.y) + k) * p.w + g.x]; }
  o0[g.y * p.w + g.x] = a / f32(2 * p.r + 1);
}
@compute @workgroup_size(16, 16) fn resp(@builtin(global_invocation_id) g: vec3u) {
  if (g.x >= p.w || g.y >= p.h) { return; }
  let i = g.y * p.w + g.x; let a = i0[i]; let c = i1[i]; let b = i2[i]; let hd = (a - c) / 2.0;
  o0[i] = (a + c) / 2.0 - sqrt(hd * hd + b * b);
}
@compute @workgroup_size(16, 16) fn shrink(@builtin(global_invocation_id) g: vec3u) {
  if (g.x >= p.nw || g.y >= p.nh) { return; }
  let sx = f32(p.w) / f32(p.nw); let sy = f32(p.h) / f32(p.nh);
  let fy = min(f32(p.h) - 1.001, (f32(g.y) + 0.5) * sy - 0.5); let y0 = u32(max(0.0, floor(fy))); let ty = max(0.0, fy - f32(y0));
  let fx = min(f32(p.w) - 1.001, (f32(g.x) + 0.5) * sx - 0.5); let x0 = u32(max(0.0, floor(fx))); let tx = max(0.0, fx - f32(x0));
  let i = y0 * p.w + x0;
  o0[g.y * p.nw + g.x] = (i0[i] * (1.0 - tx) + i0[i + 1u] * tx) * (1.0 - ty) + (i0[i + p.w] * (1.0 - tx) + i0[i + p.w + 1u] * tx) * ty;
}`;
  const WGSL_M = `
@group(0) @binding(0) var<uniform> mp: vec4u;
@group(0) @binding(1) var<storage, read> A: array<u32>;
@group(0) @binding(2) var<storage, read> B: array<u32>;
@group(0) @binding(3) var<storage, read_write> outp: array<vec4u>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3u) {
  let j = id.x; if (j >= mp.y) { return; }
  var b: array<u32, 8>; for (var k = 0u; k < 8u; k++) { b[k] = B[j * 8u + k]; }
  var best = 999u; var second = 999u; var bi = 0xffffffffu;
  for (var i = 0u; i < mp.x; i++) {
    var d = 0u; for (var k = 0u; k < 8u; k++) { d += countOneBits(A[i * 8u + k] ^ b[k]); }
    if (d < second) { if (d < best) { second = best; best = d; bi = i; } else { second = d; } }
  }
  outp[j] = vec4u(bi, best, second, 0u);
}`;
  function gpuPipes(G) {
    if (G.fp) return G.fp;
    const dev = G.dev, S = GPUShaderStage.COMPUTE;
    const ent = [{ binding: 0, visibility: S, buffer: { type: 'uniform', hasDynamicOffset: true } },
      ...[1, 2, 3].map(b => ({ binding: b, visibility: S, buffer: { type: 'read-only-storage' } })),
      ...[4, 5, 6].map(b => ({ binding: b, visibility: S, buffer: { type: 'storage' } }))];
    const bgl = dev.createBindGroupLayout({ entries: ent }), layout = dev.createPipelineLayout({ bindGroupLayouts: [bgl] });
    const mod = dev.createShaderModule({ code: WGSL_F }), mm = dev.createShaderModule({ code: WGSL_M });
    const k = {}; for (const e of ['grad', 'hbox3', 'vbox3', 'hbox1', 'vbox1', 'resp', 'shrink']) k[e] = dev.createComputePipeline({ layout, compute: { module: mod, entryPoint: e } });
    G.fp = { bgl, k, match: dev.createComputePipeline({ layout: 'auto', compute: { module: mm, entryPoint: 'main' } }), aDesc: new WeakMap() };
    return G.fp;
  }
  async function featuresGPU(bitmap, maxSide) {
    const G = await gpuReady(); if (!G || !W) return null;
    const FP = gpuPipes(G), dev = G.dev;
    const big = Math.max(bitmap.width, bitmap.height), f0 = big < 450 ? 450 / big : Math.min(1, maxSide / big);
    const im = grayOf(bitmap, bitmap.width * f0, bitmap.height * f0);
    const L = [];
    for (let lv = 0, w = im.w, h = im.h, scale = f0; lv < 12; lv++) {
      if (Math.min(w, h) < 2 * R + 20) break;
      L.push({ w, h, scale });
      const nw = Math.max(1, Math.round(w * (1 / 1.3))), nh = Math.max(1, Math.round(h * (1 / 1.3)));
      w = nw; h = nh; scale /= 1.3;
    }
    if (!L.length) return null;
    const n0 = im.w * im.h * 4, U = GPUBufferUsage;
    const mk = (size, extra = 0) => dev.createBuffer({ size: Math.max(16, size), usage: U.STORAGE | U.COPY_SRC | U.COPY_DST | extra });
    const bufs = [], keep = b => (bufs.push(b), b);
    const S = Array.from({ length: 9 }, () => keep(mk(n0)));
    const gl = L.map((l, i) => keep(i ? mk(l.w * l.h * 4) : mk(n0)));
    dev.queue.writeBuffer(gl[0], 0, im.g);
    let outOff = 0; for (const l of L) { l.off = outOff; outOff += l.w * l.h * 8; }
    const out = keep(mk(outOff)), rd = keep(dev.createBuffer({ size: outOff, usage: U.MAP_READ | U.COPY_DST }));
    const steps = [];
    for (let i = 0; i < L.length; i++) {
      const { w, h } = L[i], g = gl[i], [X, Y, XY, T1, T2, T3, SX, SY, SXY] = S;
      const nl = i + 1 < L.length ? L[i + 1] : null;
      steps.push(['grad', [w, h, 0], [g, g, g], [X, Y, XY]]);
      steps.push(['hbox3', [w, h, 2], [X, Y, XY], [T1, T2, T3]], ['vbox3', [w, h, 2], [T1, T2, T3], [SX, SY, SXY]]);
      steps.push(['hbox3', [w, h, 2], [SX, SY, SXY], [T1, T2, T3]], ['vbox3', [w, h, 2], [T1, T2, T3], [SX, SY, SXY]]);
      steps.push(['resp', [w, h, 0], [SX, SY, SXY], [X, T1, T2]]);
      steps.push(['copy', X, l => l.off, L[i]]);
      steps.push(['hbox1', [w, h, 1], [g, g, g], [Y, T1, T2]], ['vbox1', [w, h, 1], [Y, Y, Y], [XY, T1, T2]]);
      steps.push(['hbox1', [w, h, 1], [XY, XY, XY], [Y, T1, T2]], ['vbox1', [w, h, 1], [Y, Y, Y], [XY, T1, T2]]);
      steps.push(['copy', XY, l => l.off + l.w * l.h * 4, L[i]]);
      if (nl) steps.push(['shrink', [w, h, 0, nl.w, nl.h], [g, g, g], [gl[i + 1], T1, T2]]);
    }
    const nd = steps.filter(x => x[0] !== 'copy').length;
    const ub = keep(dev.createBuffer({ size: nd * 256, usage: U.UNIFORM | U.COPY_DST })), UB = new Int32Array(nd * 64);
    const enc = dev.createCommandEncoder();
    let d = 0;
    for (const st of steps) {
      if (st[0] === 'copy') { const l = st[3]; enc.copyBufferToBuffer(st[1], 0, out, st[2](l), l.w * l.h * 4); continue; }
      const [k, pr, ins, outs] = st; UB.set(pr, d * 64);
      const bg = dev.createBindGroup({ layout: FP.bgl, entries: [{ binding: 0, resource: { buffer: ub, size: 32 } },
        ...ins.map((b, j) => ({ binding: 1 + j, resource: { buffer: b } })), ...outs.map((b, j) => ({ binding: 4 + j, resource: { buffer: b } }))] });
      const pass = enc.beginComputePass(); pass.setPipeline(FP.k[k]); pass.setBindGroup(0, bg, [d * 256]);
      const ww = k === 'shrink' ? pr[3] : pr[0], hh = k === 'shrink' ? pr[4] : pr[1];
      pass.dispatchWorkgroups(Math.ceil(ww / 16), Math.ceil(hh / 16)); pass.end(); d++;
    }
    enc.copyBufferToBuffer(out, 0, rd, 0, outOff);
    dev.queue.writeBuffer(ub, 0, UB);
    dev.queue.submit([enc.finish()]);
    try {
      await rd.mapAsync(GPUMapMode.READ);
      const all = new Float32Array(rd.getMappedRange().slice(0));
      rd.unmap();
      // The strongest corners and their fingerprints, as in featuresW.
      W.reset();
      const pairs = W.alloc(1024); new Uint8Array(mem(), pairs, 1024).set(PAIRS_BYTES);
      const MAX = 700, xyP = W.alloc(MAX * 8), rP = W.alloc(MAX * 4);
      const xs = [], ys = [], mx = [], descs = [];
      for (const l of L) {
        const n = l.w * l.h, m = W.mark(), rp = W.alloc(n * 4), bp = W.alloc(n * 4);
        new Float32Array(mem(), rp, n).set(all.subarray(l.off / 4, l.off / 4 + n));
        new Float32Array(mem(), bp, n).set(all.subarray(l.off / 4 + n, l.off / 4 + 2 * n));
        const k = W.pick(rp, l.w, l.h, -1, MAX, xyP, rP), dP = W.alloc(k * 32 + 32);
        W.describe(bp, l.w, xyP, k, pairs, dP);
        const XY = new Int32Array(mem(), xyP, k * 2);
        for (let q = 0; q < k; q++) { xs.push(XY[q * 2] / l.scale); ys.push(XY[q * 2 + 1] / l.scale); mx.push((l.w - 1 - XY[q * 2]) / l.scale); }
        descs.push(new Uint32Array(mem(), dP, k * 8).slice());
        W.release(m);
      }
      const allD = new Uint32Array(descs.reduce((a, x) => a + x.length, 0)); let o = 0;
      for (const x of descs) { allD.set(x, o); o += x.length; }
      return { x: Float64Array.from(xs), y: Float64Array.from(ys), mx: Float64Array.from(mx), d: allD, n: xs.length, f0 };
    } finally { for (const b of bufs) b.destroy(); }
  }
  async function matchGPU(A, B) {
    const G = await gpuReady(); if (!G) return null;
    if (!A.n || !B.n) return [];
    const FP = gpuPipes(G), dev = G.dev, U = GPUBufferUsage;
    let a = FP.aDesc.get(A);
    if (!a) { a = dev.createBuffer({ size: A.d.byteLength, usage: U.STORAGE | U.COPY_DST }); dev.queue.writeBuffer(a, 0, A.d); FP.aDesc.set(A, a); }
    const b = dev.createBuffer({ size: B.d.byteLength, usage: U.STORAGE | U.COPY_DST });
    const ub = dev.createBuffer({ size: 16, usage: U.UNIFORM | U.COPY_DST });
    const ob = dev.createBuffer({ size: B.n * 16, usage: U.STORAGE | U.COPY_SRC });
    const rd = dev.createBuffer({ size: B.n * 16, usage: U.MAP_READ | U.COPY_DST });
    try {
      dev.queue.writeBuffer(b, 0, B.d); dev.queue.writeBuffer(ub, 0, new Uint32Array([A.n, B.n, 0, 0]));
      const bg = dev.createBindGroup({ layout: FP.match.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ub } }, { binding: 1, resource: { buffer: a } }, { binding: 2, resource: { buffer: b } }, { binding: 3, resource: { buffer: ob } }] });
      const enc = dev.createCommandEncoder(), pass = enc.beginComputePass();
      pass.setPipeline(FP.match); pass.setBindGroup(0, bg); pass.dispatchWorkgroups(Math.ceil(B.n / 64)); pass.end();
      enc.copyBufferToBuffer(ob, 0, rd, 0, B.n * 16); dev.queue.submit([enc.finish()]);
      await rd.mapAsync(GPUMapMode.READ);
      const O = new Uint32Array(rd.getMappedRange().slice(0)); rd.unmap();
      const out = [];
      for (let j = 0; j < B.n; j++) {
        const bi = O[j * 4], best = O[j * 4 + 1], second = O[j * 4 + 2];
        if (bi !== 0xffffffff && best <= 70 && best < 0.85 * second) out.push({ ax: A.x[bi], ay: A.y[bi], bx: B.x[j], by: B.y[j], d: best, i: bi, j });
      }
      return out;
    } finally { b.destroy(); ub.destroy(); ob.destroy(); rd.destroy(); }
  }
  // Each computer checks for itself, per step: the first 3 times both ways (the normal answer is
  // used), then the graphics card only if it was clearly quicker.
  const CAL = {};
  async function either(kind, gpuFn, cpuFn) {
    const c = CAL[kind] || (CAL[kind] = { tries: 0, g: 0, c: 0, off: false });
    if (c.off || GPU.state === 'failed' || (typeof self !== 'undefined' && self.PP_NO_GPU)) return cpuFn();
    try {
      if (c.tries < 3) {
        let t = performance.now(); const G = await gpuFn(); const g = performance.now() - t;
        t = performance.now(); const C = await cpuFn(); const cc = performance.now() - t;
        if (G === null) { c.off = true; return C; }
        c.tries++; c.g += g; c.c += cc;
        if (c.tries === 3 && c.g > 0.8 * c.c && !(typeof self !== 'undefined' && self.PP_GPU_ANY)) c.off = true;
        return C;
      }
      const G = await gpuFn();
      if (G !== null) return G;
    } catch (e) { c.off = true; GPU.why = kind + ': ' + String(e && e.message || e); }
    return cpuFn();
  }
  const featFast = Bm => either('details', () => featuresGPU(Bm, 900), () => features(Bm, 900));
  const matchFast = (A, B) => either('pairs', () => matchGPU(A, B), () => match(A, B));

  // Line-up on the graphics card, then a last small polish the normal way so the final position
  // matches the normal way closely.
  const POLISH = 4;
  const refineFast = (A, B, T0) => either('lineup', async () => { const T = await refineGPU(A, B, T0); return T ? refine(A, B, T, POLISH) : null; }, () => refine(A, B, T0));
  // For "Where the time goes": true = the graphics card is in use for at least one step,
  // false = not available or slower here, null = not tried yet.
  function gpuInUse() {
    if (GPU.state === 'failed') return false;
    const k = Object.values(CAL);
    if (k.some(c => !c.off && c.tries >= 3)) return true;
    if (k.length && k.every(c => c.off)) return false;
    return null;
  }

  // ---------- the old way, kept as a backup: whole-picture search ----------
  function cost(a, b, ox, oy, stride, minFrac) {
    const x0 = Math.max(0, ox), x1 = Math.min(a.w, ox + b.w), y0 = Math.max(0, oy), y1 = Math.min(a.h, oy + b.h);
    if (x1 <= x0 || y1 <= y0) return Infinity;
    if ((x1 - x0) * (y1 - y0) < minFrac * Math.min(a.w * a.h, b.w * b.h)) return Infinity;
    let sum = 0, n = 0;
    for (let y = y0; y < y1; y += stride) {
      const ar = y * a.w, br = (y - oy) * b.w - ox;
      for (let x = x0; x < x1; x += stride) { sum += Math.abs(a.g[ar + x] - b.g[br + x]); n++; }
    }
    return sum / n;
  }
  async function wholeSearch(A, B) {
    const big = Math.max(A.width, A.height);
    const levels = [{ L: 48, sRange: [0.2, 1.6], sSteps: 34, stride: 1 },
      { L: 160, sSpan: 0.06, sSteps: 13, off: 6, stride: 2 },
      { L: 420, sSpan: 0.015, sSteps: 7, off: 3, stride: 2 }];
    let best = null;
    for (const lv of levels) {
      const f = lv.L / big, a = grayOf(A, A.width * f, A.height * f), fitW = A.width / B.width, scales = [];
      if (!best) {
        const [lo, hi] = lv.sRange;
        for (let i = 0; i < lv.sSteps; i++) scales.push(fitW * lo * Math.pow(hi / lo, i / (lv.sSteps - 1)));
        scales.push(fitW, A.height / B.height);
      } else for (let i = 0; i < lv.sSteps; i++) scales.push(best.s * (1 - lv.sSpan + 2 * lv.sSpan * i / (lv.sSteps - 1)));
      let lvBest = null;
      for (const s of scales) {
        const b = grayOf(B, B.width * s * f, B.height * s * f);
        if (b.w < 4 || b.h < 4) continue;
        let xs, ys;
        if (!best) { xs = [-Math.floor(b.w * 0.6), a.w - Math.ceil(b.w * 0.4)]; ys = [-Math.floor(b.h * 0.6), a.h - Math.ceil(b.h * 0.4)]; }
        else { const cx = Math.round(best.x * f), cy = Math.round(best.y * f); xs = [cx - lv.off, cx + lv.off]; ys = [cy - lv.off, cy + lv.off]; }
        for (let oy = ys[0]; oy <= ys[1]; oy++) for (let ox = xs[0]; ox <= xs[1]; ox++) {
          const c = cost(a, b, ox, oy, lv.stride, 0.35);
          if (!lvBest || c < lvBest.c) lvBest = { c, s, x: ox / f, y: oy / f };
        }
        await pause();
      }
      if (lvBest) best = lvBest;
    }
    return best && isFinite(best.c) ? place({ s: best.s, x: best.x, y: best.y }) : null;
  }

  // ---------- putting it together ----------
  function mirrored(B) {
    const c = mkCanvas(B.width, B.height);
    const ctx = c.getContext('2d'); ctx.translate(B.width, 0); ctx.scale(-1, 1); ctx.drawImage(B, 0, 0);
    return createImageBitmap(c);
  }
  // Returns a placement plus { how, inliers, sc } or null. progress(text) gets plain-English updates.
  // opts.fast (reverse search, many copies to check): reuse the original's details between
  // calls and skip the slow whole-picture search, which only helps plain copies with few details.
  const featCache = new WeakMap(), featMirCache = new WeakMap();
  const FAST_MIN_INLIERS = 10;
  async function align(A, B, progress = () => {}, opts = {}) {
    const tries = [], tick = pause;
    progress('Finding details in both pictures...');
    let FA = opts.fast && featCache.get(A);
    if (!FA) { FA = features(A, 900); if (opts.fast) featCache.set(A, FA); }
    await tick();
    const thr = Math.max(3 / FA.f0, Math.max(A.width, A.height) * 0.012);
    let FBplain = null;
    const viaDetails = async (Bimg, flip) => {
      let FB, ms;
      if (flip && opts.fast) {
        // Mirror check, the quick way: instead of flipping every found picture and finding its
        // details all over again, your photo is flipped once (kept for the next picture) and the
        // found picture's details are reused. The pairs come out the same, in the same pixels as
        // the flipped picture would give, for about half the work.
        let FM = featMirCache.get(A);
        if (!FM) { const Am = await mirrored(A); try { FM = features(Am, 900); } finally { try { Am.close && Am.close(); } catch (e) { /* freed */ } } featMirCache.set(A, FM); }
        FB = FBplain || await featFast(B); await tick();
        progress('Checking whether the copy was mirrored...');
        ms = (await matchFast(FM, FB)).map(m => ({ ax: FM.mx[m.i], ay: m.ay, bx: FB.mx[m.j], by: m.by, d: m.d }));
      } else {
        FB = opts.fast ? await featFast(Bimg) : features(Bimg, 900); await tick();
        if (!flip) FBplain = FB;
        progress(flip ? 'Checking whether the copy was mirrored...' : 'Pairing up matching details...');
        ms = await (opts.fast ? matchFast : match)(FA, FB);
      }
      // The copy must cover at least 8% of the original's width or height once lined up.
      const R1 = ransac(ms, thr, 20 / FB.f0, Math.max(0.02, 0.08 * Math.max(A.width, A.height) / Math.max(Bimg.width, Bimg.height)));
      // Reverse search (fast) needs at least 10 matching details to call anything a copy (see
      // verdict() in revsearch.js), so a guess with fewer is not fine-tuned: that fine-tuning was
      // most of the time spent on the many different photos a search turns up.
      if (!R1 || R1.inliers < (opts.fast ? FAST_MIN_INLIERS : 6)) return;
      progress('Fine-tuning the position...');
      const T0 = toPlace(R1.M, B, flip), cands = [];
      if (T0.ok) cands.push(T0);
      // Also try the plain answer (only resized and moved). With few details to go on, a
      // stretch or turn can be noise, so the plain answer wins unless the other lines up clearly better.
      if (!T0.ok || T0.w !== 1 || T0.r !== 0 || T0.k) {
        const U = fitUniform(R1.inl); if (U) cands.push(toPlace(U, B, flip));
      }
      let pick = null;
      for (const C of cands) {
        const T = await (opts.fast ? refineFast : refine)(A, B, C), sc = score(A, B, T);
        const plain = T.w === 1 && T.r === 0 && !T.k;
        if (!pick || sc.lines > pick.sc.lines + (plain ? -0.02 : 0.02)) pick = { ...T, sc };
      }
      if (pick) tries.push({ ...pick, how: 'details', inliers: R1.inliers, matches: R1.matches });
    };
    const best = () => tries.reduce((p, q) => (!p || q.sc.lines > p.sc.lines ? q : p), null);
    // Many matching details that line up closely = no doubt; no need to try the slower ways.
    const sure = () => { const b = best(); return b && (b.sc.lines >= 0.5 || (b.inliers >= 40 && b.sc.strength >= 0.85 && b.sc.lines >= 0.25)); };
    await viaDetails(B, false);
    // Copies are sometimes mirrored to dodge detection. Try that if the straight way didn't fit well.
    if (!sure()) {
      if (opts.fast) await viaDetails(B, true);          // B is only measured; no flipped copy needed
      else {
        const M = await mirrored(B);
        try { await viaDetails(M, true); } finally { try { M.close && M.close(); } catch (e) { /* already freed */ } }
      }
    }
    // Backup: the whole-picture search, for plain resized copies with few sharp details.
    if (!sure() && !opts.fast) {
      progress('Trying different sizes and positions...');
      const W = await wholeSearch(A, B);
      if (W) tries.push({ ...W, how: 'whole', sc: score(A, B, W) });
    }
    return best();
  }

  return { align, score, changes, spot, repeats, grayOf, place, drawCopy, bounds, reshape, sizes, mapPoint, ready, fast: () => !!W, gpu: gpuInUse, gpuWhy: () => GPU.why + (Object.keys(CAL).length ? ' [' + Object.entries(CAL).map(([k, c]) => k + ' ' + (c.off ? 'off' : 'on') + (c.tries ? ' ' + Math.round(c.g / c.tries) + '/' + Math.round(c.c / c.tries) + ' ms' : '')).join(', ') + ']' : ''), _t: { features, match, W: () => W, grayOf, refine, refineGPU, gpuReady, featuresGPU, matchGPU, CAL } };
})();
