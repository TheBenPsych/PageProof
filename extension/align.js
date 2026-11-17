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
  function grayOf(bitmap, w, h) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
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
    const f0 = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
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
      if (j % 300 === 299) await new Promise(r => setTimeout(r, 0));
    }
    return out;
  }

  // ---------- 4. RANSAC: the one size + position most pairs agree on ----------
  // Model: a point (bx, by) on the copy lands at (s*bx + tx, s*by + ty) on the original.
  function fit(ms) {
    let ax = 0, ay = 0, bx = 0, by = 0;
    for (const m of ms) { ax += m.ax; ay += m.ay; bx += m.bx; by += m.by; }
    ax /= ms.length; ay /= ms.length; bx /= ms.length; by /= ms.length;
    let num = 0, den = 0;
    for (const m of ms) { num += (m.bx - bx) * (m.ax - ax) + (m.by - by) * (m.ay - ay); den += (m.bx - bx) ** 2 + (m.by - by) ** 2; }
    const s = den > 0 ? num / den : 1;
    return { s, x: ax - s * bx, y: ay - s * by };
  }
  const inliersOf = (ms, M, thr) => ms.filter(m => Math.hypot(M.s * m.bx + M.x - m.ax, M.s * m.by + M.y - m.ay) < thr);
  function ransac(ms, thr, minDist) {
    if (ms.length < 4) return null;
    let s0 = 0x2545f491;
    const rnd = n => { s0 ^= s0 << 13; s0 ^= s0 >>> 17; s0 ^= s0 << 5; return (s0 >>> 0) % n; };
    let best = null, bestN = 0;
    for (let it = 0; it < 4000; it++) {
      const p = ms[rnd(ms.length)], q = ms[rnd(ms.length)];
      const db = Math.hypot(p.bx - q.bx, p.by - q.by), da = Math.hypot(p.ax - q.ax, p.ay - q.ay);
      if (db < minDist || da < 1) continue;
      const s = da / db;
      if (s < 0.02 || s > 50) continue;
      // Pictures here are never turned, so both pairs must point the same way.
      const ang = Math.atan2(p.ay - q.ay, p.ax - q.ax) - Math.atan2(p.by - q.by, p.bx - q.bx);
      if (Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang))) > 0.08) continue;
      const M = { s, x: p.ax - s * p.bx, y: p.ay - s * p.by };
      let n = 0;
      for (const m of ms) if (Math.hypot(s * m.bx + M.x - m.ax, s * m.by + M.y - m.ay) < thr) n++;
      if (n > bestN) { bestN = n; best = M; }
    }
    if (!best) return null;
    let inl = inliersOf(ms, best, thr), M = best;
    for (let k = 0; k < 3 && inl.length >= 3; k++) { M = fit(inl); inl = inliersOf(ms, M, thr * (k ? 0.6 : 1)); }
    return { ...M, inliers: inl.length, matches: ms.length };
  }

  // ---------- 5. how well they line up: small squares compared one by one ----------
  // Only the area where the two pictures overlap counts, and a square where the copy has
  // something printed over it (a headline, a logo) simply doesn't match; it doesn't drag
  // the matching squares down.
  function tiles(a, b, ox, oy, size) {
    const x0 = Math.max(0, ox), x1 = Math.min(a.w, ox + b.w), y0 = Math.max(0, oy), y1 = Math.min(a.h, oy + b.h);
    const res = { textured: 0, matched: 0, flat: 0, flatSame: 0, sumR: 0, overlap: 0, overlapA: 0 };
    if (x1 - x0 < size || y1 - y0 < size) return res;
    res.overlap = ((x1 - x0) * (y1 - y0)) / (b.w * b.h); res.overlapA = ((x1 - x0) * (y1 - y0)) / (a.w * a.h);
    for (let ty = y0; ty + size <= y1; ty += size) for (let tx = x0; tx + size <= x1; tx += size) {
      let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
      for (let y = ty; y < ty + size; y++) {
        const ar = y * a.w, br = (y - oy) * b.w - ox;
        for (let x = tx; x < tx + size; x++) { const p = a.g[ar + x], q = b.g[br + x]; n++; sa += p; sb += q; saa += p * p; sbb += q * q; sab += p * q; }
      }
      const ma = sa / n, mb = sb / n, va = saa / n - ma * ma, vb = sbb / n - mb * mb;
      if (va < 25 && vb < 25) { res.flat++; if (Math.abs(ma - mb) < 25) res.flatSame++; continue; }
      res.textured++;
      const r = va > 4 && vb > 4 ? (sab / n - ma * mb) / Math.sqrt(va * vb) : 0;
      if (r > 0.6) { res.matched++; res.sumR += r; }
    }
    return res;
  }
  // A grade for a placement: the share of the shared area whose details line up.
  function grade(t) {
    const total = t.textured + t.flat * 0.25;
    return total ? (t.matched + t.flatSame * 0.25) / total : 0;
  }
  // Score a placement T = {s, x, y} (in the original's pixels).
  function score(Abm, Bbm, T, side = 480) {
    const f = side / Math.max(Abm.width, Abm.height);
    const a = grayOf(Abm, Abm.width * f, Abm.height * f), b = grayOf(Bbm, Bbm.width * T.s * f, Bbm.height * T.s * f);
    const t = tiles(a, b, Math.round(T.x * f), Math.round(T.y * f), 12);
    return { ...t, lines: grade(t), strength: t.matched ? t.sumR / t.matched : 0 };
  }

  // Nudge the size and position by a pixel or two, keeping whatever lines up best.
  async function refine(Abm, Bbm, T) {
    const side = Math.min(900, Math.max(Abm.width, Abm.height)), f = side / Math.max(Abm.width, Abm.height);
    const a = grayOf(Abm, Abm.width * f, Abm.height * f);
    let best = { ...T, v: -1 };
    for (const ds of [-0.006, -0.003, 0, 0.003, 0.006]) {
      const s = T.s * (1 + ds), b = grayOf(Bbm, Bbm.width * s * f, Bbm.height * s * f);
      // keep the copy's centre fixed while changing its size
      const cx = T.x + Bbm.width * T.s / 2, cy = T.y + Bbm.height * T.s / 2;
      const bx = (cx - Bbm.width * s / 2) * f, by = (cy - Bbm.height * s / 2) * f;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const ox = Math.round(bx) + dx, oy = Math.round(by) + dy;
        const t = tiles(a, b, ox, oy, 16), v = t.sumR;
        if (v > best.v) best = { s, x: ox / f, y: oy / f, v };
      }
      await new Promise(r => setTimeout(r, 0));
    }
    return best.v > 0 ? { s: best.s, x: best.x, y: best.y } : T;
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
        await new Promise(r => setTimeout(r, 0));
      }
      if (lvBest) best = lvBest;
    }
    return best && isFinite(best.c) ? { s: best.s, x: best.x, y: best.y } : null;
  }

  // ---------- putting it together ----------
  // Returns { s, x, y, how, inliers, sc } or null. progress(text) gets plain-English updates.
  async function align(A, B, progress = () => {}) {
    const tries = [];
    progress('Finding details in both pictures...');
    const FA = features(A, 900); await new Promise(r => setTimeout(r, 0));
    const FB = features(B, 900);
    progress('Pairing up matching details...');
    const ms = await match(FA, FB);
    const thr = Math.max(3 / FA.f0, Math.max(A.width, A.height) * 0.012);
    const R1 = ransac(ms, thr, 20 / FB.f0);
    if (R1 && R1.inliers >= 6) {
      progress('Fine-tuning the position...');
      const T = await refine(A, B, R1);
      tries.push({ ...T, how: 'details', inliers: R1.inliers, matches: R1.matches, sc: score(A, B, T) });
    }
    // Backup: the whole-picture search, for plain resized copies with few sharp details.
    if (!tries.length || tries[0].sc.lines < 0.5) {
      progress('Trying different sizes and positions...');
      const W = await wholeSearch(A, B);
      if (W) tries.push({ ...W, how: 'whole', sc: score(A, B, W) });
    }
    if (!tries.length) return null;
    tries.sort((p, q) => q.sc.lines - p.sc.lines);
    return tries[0];
  }

  return { align, score, grayOf };
})();
