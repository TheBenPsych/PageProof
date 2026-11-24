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
  const WASM_B64 = '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AAEAAQAiEf26ASISIAlBMGr9AAAAIAr9Uf1iIAlBIGr9AAAAIAv9Uf1i/W79fSAR/boBIhP9DQABAgMQERITCAkKCxgZGhsgEiAT/Q0EBQYHFBUWFwwNDg8cHR4f/a4BIhIgCUHQAGr9AAAAIAr9Uf1iIAlBwABq/QAAACAL/VH9Yv1u/X0gEf26ASITIAlB8ABq/QAAACAK/VH9YiAJQeAAav0AAAAgC/1R/WL9bv19IBH9ugEiEf0NAAECAxAREhMICQoLGBkaGyATIBH9DQQFBgcUFRYXDA0ODxwdHh/9rgEiEf0NAAECAwQFBgcQERITFBUWFyASIBH9DQgJCgsMDQ4PGBkaGxwdHh/9rgEiESAM/RH9Of2kAUUNACAR/RsDIg0gEf0bAiIUIBH9GwEiFSAR/RsAIhYgDyAWIA9IIhcbIA8gFiAMSCIYGyIZIBUgGUgiGhsgGSAVIBYgDyAWIA9KGyAMIBgbIgxIIhYbIg8gFCAPSCIbGyAPIBQgFSAZIBUgGUobIAwgFhsiGUgiFRsiDCANIAxIIhwbIAwgDSAUIA8gFCAPShsgGSAVGyIZSCIUGyEPIA0gDCANIAxKGyAZIBQbIQwgECAQQX9qIBBBfmogEEF9aiAOIBcbIA4gGBsiDiAaGyAOIBYbIg4gGxsgDiAVGyIOIBwbIA4gFBshDgsgCUGAAWohCSAQQQRqIhAgAUgNAAsgByENCwJAAkAgDSABSA0AIA8hCQwBCyAAIA1BBXRqIRADQCAQQRBq/QAAACAK/VH9YiAQ/QAAACAL/VH9Yv1u/X39DAEAAQABAAEAAQABAAEAAQD9ugEiEf0bACAR/RsBaiAR/RsCaiAR/RsDaiIJIA8gCSAPShsgDCAJIAxIIhQbIQwgDSAOIAkgD0giFRsgDiAUGyEOIBBBIGohECAJIA8gFRsgDyAUGyIJIQ8gASANQQFqIg1HDQALC0F/IQ8CQCAOQQBIDQAgCUHGAEoNACAMt0QzMzMzMzPrP6IgCbdkRQ0AIA4hDwsgBSADQQJ0IgxqIA82AgAgBiAMaiAJNgIAIANBAWoiAyAERw0ACwsLAIMBBG5hbWUACwphbGlnbi53YXNtAVsMAAVyZXNldAEFYWxsb2MCBG1hcmsDB3JlbGVhc2UEBGJsdXIFBWhwYXNzBgV2cGFzcwcGc2hyaW5rCAdjb3JuZXJzCQVtc29ydAoIZGVzY3JpYmULBW1hdGNoBxIBAA9fX3N0YWNrX3BvaW50ZXIAOAlwcm9kdWNlcnMBDHByb2Nlc3NlZC1ieQEMVWJ1bnR1IGNsYW5nETE4LjEuMyAoMXVidW50dTEpAEIPdGFyZ2V0X2ZlYXR1cmVzBCsLYnVsay1tZW1vcnkrD211dGFibGUtZ2xvYmFscysIc2lnbi1leHQrB3NpbWQxMjg=';
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
        FB = FBplain || features(B, 900); await tick();
        progress('Checking whether the copy was mirrored...');
        ms = (await match(FM, FB)).map(m => ({ ax: FM.mx[m.i], ay: m.ay, bx: FB.mx[m.j], by: m.by, d: m.d }));
      } else {
        FB = features(Bimg, 900); await tick();
        if (!flip) FBplain = FB;
        progress(flip ? 'Checking whether the copy was mirrored...' : 'Pairing up matching details...');
        ms = await match(FA, FB);
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

  return { align, score, changes, spot, repeats, grayOf, place, drawCopy, bounds, reshape, sizes, mapPoint, ready, fast: () => !!W, _t: { features, match, W: () => W, grayOf } };
})();
