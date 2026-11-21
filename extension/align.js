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
  // Points + fingerprints at many sizes. x, y are given back in the full picture's pixels.
  function features(bitmap, maxSide) {
    // Big pictures are shrunk to save time; very small ones (thumbnails) are enlarged so their
    // details are big enough to fingerprint.
    const big = Math.max(bitmap.width, bitmap.height), f0 = big < 450 ? 450 / big : Math.min(1, maxSide / big);
    let im = grayOf(bitmap, bitmap.width * f0, bitmap.height * f0);
    const xs = [], ys = [], descs = [];
    for (let lv = 0, scale = f0; lv < 12; lv++) {
      if (Math.min(im.w, im.h) < 2 * R + 20) break;
      const pts = corners(im, 700);
      const d = describe(blur(im, 1), pts);
      for (const p of pts) { xs.push(p.x / scale); ys.push(p.y / scale); }
      descs.push(d);
      im = shrink(im, 1 / 1.3); scale /= 1.3;
    }
    const all = new Uint32Array(descs.reduce((n, d) => n + d.length, 0)); let o = 0;
    for (const d of descs) { all.set(d, o); o += d.length; }
    return { x: Float64Array.from(xs), y: Float64Array.from(ys), d: all, n: xs.length, f0 };
  }

  // ---------- 3. pairing up fingerprints ----------
  function pop(v) { v -= (v >>> 1) & 0x55555555; v = (v & 0x33333333) + ((v >>> 2) & 0x33333333); return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; }
  async function match(A, B) {
    const out = [];
    for (let j = 0; j < B.n; j++) {
      let best = 999, second = 999, bi = -1; const bo = j * 8;
      for (let i = 0; i < A.n; i++) {
        const ao = i * 8;
        let dist = pop(A.d[ao] ^ B.d[bo]) + pop(A.d[ao + 1] ^ B.d[bo + 1]) + pop(A.d[ao + 2] ^ B.d[bo + 2]) + pop(A.d[ao + 3] ^ B.d[bo + 3]);
        if (dist >= second) continue;
        dist += pop(A.d[ao + 4] ^ B.d[bo + 4]) + pop(A.d[ao + 5] ^ B.d[bo + 5]) + pop(A.d[ao + 6] ^ B.d[bo + 6]) + pop(A.d[ao + 7] ^ B.d[bo + 7]);
        if (dist < best) { second = best; best = dist; bi = i; } else if (dist < second) second = dist;
      }
      if (bi >= 0 && best <= 70 && best < 0.85 * second) out.push({ ax: A.x[bi], ay: A.y[bi], bx: B.x[j], by: B.y[j], d: best });
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

  // Nudge the position, size, stretch and turn a little at a time, keeping whatever lines up best.
  async function refine(Abm, Bbm, T0) {
    const side = Math.min(720, Math.max(Abm.width, Abm.height)), f = side / Math.max(Abm.width, Abm.height);
    const a = grayAt(Abm, f);
    const val = T => tiles(a, render(Bbm, T, a.w, a.h, f), 16).sumR;
    let T = { ...T0 }, best = val(T);
    const steps = { x: 2 / f, y: 2 / f, s: 0.006, w: T.w !== 1 ? 0.006 : 0, r: T.r !== 0 ? 0.3 : 0, k: T.k !== 0 ? 0.005 : 0 };
    for (let round = 0; round < 5; round++) {
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
  const featCache = new WeakMap();
  const FAST_MIN_INLIERS = 10;
  async function align(A, B, progress = () => {}, opts = {}) {
    const tries = [], tick = pause;
    progress('Finding details in both pictures...');
    let FA = opts.fast && featCache.get(A);
    if (!FA) { FA = features(A, 900); if (opts.fast) featCache.set(A, FA); }
    await tick();
    const thr = Math.max(3 / FA.f0, Math.max(A.width, A.height) * 0.012);
    const viaDetails = async (Bimg, flip) => {
      const FB = features(Bimg, 900); await tick();
      progress(flip ? 'Checking whether the copy was mirrored...' : 'Pairing up matching details...');
      const ms = await match(FA, FB);
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
        const T = await refine(A, B, C), sc = score(A, B, T);
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
      const M = await mirrored(B);
      try { await viaDetails(M, true); } finally { try { M.close && M.close(); } catch (e) { /* already freed */ } }
    }
    // Backup: the whole-picture search, for plain resized copies with few sharp details.
    if (!sure() && !opts.fast) {
      progress('Trying different sizes and positions...');
      const W = await wholeSearch(A, B);
      if (W) tries.push({ ...W, how: 'whole', sc: score(A, B, W) });
    }
    return best();
  }

  return { align, score, grayOf, place, drawCopy, bounds, reshape, sizes, mapPoint };
})();
