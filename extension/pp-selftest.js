// The Checker test (Settings › How PageProof is doing): PageProof draws its own made-up test
// pictures (no real photos, nothing downloaded), makes copies of them the way copies are made on
// the internet (smaller and re-saved, colour changed, cropped, a headline over it, mirrored,
// tilted) and checks each copy against its picture with the same photo checker a real search
// uses (score-worker.js and the same answer rules, pp-verdict.js). Different pictures must come
// out Different. Because the pictures are drawn the same way on every computer, the answers
// should be the same everywhere: a computer that gets fewer right, or is much slower, shows up.
const PP_SELFTEST = (() => {
  const W = 720, H = 540, BASES = 8;
  const rnd = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const canvas = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));
  const WORDS = ['SUMMIT', 'HARBOR', 'TONIGHT', 'RIVERSIDE', 'MARKET', 'GALA', 'FINAL', 'NORTH', 'OPEN', 'ARENA', 'PARADE', 'STUDIO'];
  // One made-up "photo": a sky-to-ground gradient, shapes of every size, a few words and fine grain.
  function draw(seed) {
    const r = rnd(seed * 7919 + 13), c = canvas(W, H), x = c.getContext('2d');
    const col = (a = 1) => `hsla(${Math.floor(r() * 360)},${30 + Math.floor(r() * 60)}%,${20 + Math.floor(r() * 60)}%,${a})`;
    const g = x.createLinearGradient(0, 0, r() * W, H); g.addColorStop(0, col()); g.addColorStop(1, col()); x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) {
      x.fillStyle = col(0.5 + r() * 0.5); x.beginPath();
      const cx = r() * W, cy = r() * H, s = 10 + r() * 120;
      if (i % 3 === 0) x.ellipse(cx, cy, s, s * (0.3 + r()), r() * 3, 0, Math.PI * 2);
      else { const n = 3 + Math.floor(r() * 4); for (let k = 0; k < n; k++) x.lineTo(cx + (r() - 0.5) * s * 2, cy + (r() - 0.5) * s * 2); x.closePath(); }
      x.fill();
    }
    x.lineCap = 'round';
    for (let i = 0; i < 12; i++) { x.strokeStyle = col(0.8); x.lineWidth = 2 + r() * 10; x.beginPath(); x.moveTo(r() * W, r() * H); x.lineTo(r() * W, r() * H); x.stroke(); }
    for (let i = 0; i < 4; i++) { x.fillStyle = col(); x.font = `bold ${18 + Math.floor(r() * 40)}px sans-serif`; x.fillText(WORDS[Math.floor(r() * WORDS.length)], r() * W * 0.7, 40 + r() * (H - 60)); }
    for (let i = 0; i < 1500; i++) { x.fillStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},${0.08 + r() * 0.15})`; x.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 3); }
    return c;
  }
  // A copy, made the way copies are made on the internet.
  function copyOf(src, kind, seed) {
    const r = rnd(seed * 31 + 7);
    let w = W, h = H, c, x;
    if (kind === 'small') { w = Math.round(W * 0.55); h = Math.round(H * 0.55); c = canvas(w, h); x = c.getContext('2d'); x.drawImage(src, 0, 0, w, h); return { c, q: 0.6 }; }
    if (kind === 'colour') { c = canvas(w, h); x = c.getContext('2d'); x.filter = 'saturate(1.5) brightness(1.12) contrast(1.1)'; x.drawImage(src, 0, 0); x.filter = 'none'; return { c, q: 0.85 }; }
    if (kind === 'crop') {
      const f = 0.7 + r() * 0.1, cw = Math.round(W * f), ch = Math.round(H * f), ox = Math.round(r() * (W - cw)), oy = Math.round(r() * (H - ch));
      c = canvas(cw, ch); c.getContext('2d').drawImage(src, ox, oy, cw, ch, 0, 0, cw, ch); return { c, q: 0.85 };
    }
    if (kind === 'headline') {
      c = canvas(w, h); x = c.getContext('2d'); x.drawImage(src, 0, 0);
      x.fillStyle = 'rgba(10,10,20,0.88)'; x.fillRect(0, H * 0.78, W, H * 0.22);
      x.fillStyle = '#fff'; x.font = 'bold 34px sans-serif'; x.fillText('BREAKING: ' + WORDS[seed % WORDS.length] + ' TONIGHT', 24, H * 0.9);
      return { c, q: 0.8 };
    }
    if (kind === 'mirror') { c = canvas(w, h); x = c.getContext('2d'); x.translate(W, 0); x.scale(-1, 1); x.drawImage(src, 0, 0); return { c, q: 0.85 }; }
    if (kind === 'tilt') {
      const a = (r() > 0.5 ? 1 : -1) * (3 + r() * 3) * Math.PI / 180;
      c = canvas(w, h); x = c.getContext('2d'); x.translate(W / 2, H / 2); x.rotate(a); x.scale(1.15, 1.15); x.drawImage(src, -W / 2, -H / 2); return { c, q: 0.85 };
    }
    return { c: src, q: 0.9 };
  }
  async function toBitmap(c, q) {
    // Saved as a JPEG and opened again, like a picture downloaded from a website.
    const blob = c.convertToBlob ? await c.convertToBlob({ type: 'image/jpeg', quality: q }) : await new Promise(res => c.toBlob(res, 'image/jpeg', q));
    const big = await createImageBitmap(blob);
    const f = Math.min(1, 640 / Math.max(big.width, big.height));
    if (f >= 1) return big;
    const s = await createImageBitmap(big, { resizeWidth: Math.round(big.width * f), resizeHeight: Math.round(big.height * f), resizeQuality: 'high' });
    big.close && big.close();
    return s;
  }
  const GROUPS = [
    ['resaved', 'Smaller, re-saved or colour changed', ['small', 'colour'], true],
    ['cropped', 'Cropped or with a headline over it', ['crop', 'headline'], true],
    ['flipped', 'Mirrored or tilted', ['mirror', 'tilt'], true],
    ['different', 'Different pictures', null, false],
  ];
  // The cases: every picture with each kind of copy, and pairs of different pictures.
  function cases() {
    const out = [];
    for (const [g, , kinds, copy] of GROUPS) {
      for (let b = 0; b < BASES; b++) {
        if (copy) for (const k of kinds) out.push({ g, base: b, kind: k, copy });
        else for (const d of [1, 3, 5]) out.push({ g, base: b, other: (b + d) % BASES + BASES, copy });
      }
    }
    return out;
  }
  // One checker in a background worker, like a real search (the page's own checker if workers can't run).
  function checker() {
    let w = null, next = 1; const waits = new Map();
    try {
      w = new Worker('score-worker.js');
      w.onmessage = e => { const f = waits.get(e.data.id); if (f) { waits.delete(e.data.id); f(e.data); } };
    } catch (e) { w = null; }
    return {
      worker: !!w,
      orig(key, bmp) { if (w) w.postMessage({ type: 'orig', key, bmp }, [bmp]); },
      async check(key, A, bmp) {
        if (!w) {
          await PP_ALIGN.ready;
          const best = await PP_ALIGN.align(A, bmp, undefined, { fast: true });
          if (best && best.sc.lines >= 0.3) { const Sh = PP_ALIGN.shot(A, bmp, best); best.backdrop = PP_ALIGN.repeats(A, bmp, best).backdropOnly && Sh.graphic >= 0.6; Object.assign(best, { logos: Sh.logos, place: Sh.place, photo: Sh.photo }); }
          return { best, fast: PP_ALIGN.fast(), gpu: PP_ALIGN.gpu() };
        }
        const id = next++;
        const res = await new Promise(r => { waits.set(id, r); w.postMessage({ type: 'check', id, key, bmp }, [bmp]); setTimeout(() => { if (waits.has(id)) { waits.delete(id); r({ err: 'took over 30 seconds' }); } }, 30000); });
        if (res.err) return { err: res.err };
        return { best: PP_VERDICT.fromWorker(res.out), fast: res.fast, gpu: res.gpu };
      },
      stop() { try { w && w.terminate(); } catch (e) { /* gone */ } },
    };
  }
  // Runs every case. onStep(done, total) is called as it goes.
  async function run(onStep) {
    const list = cases(), C = checker(), t0 = Date.now();
    const bases = new Map(), groups = {};
    for (const [g, label] of GROUPS) groups[g] = { label, n: 0, right: 0, same: 0, maybe: 0, no: 0, cant: 0 };
    let fast = null, gpu = null, ms = 0, n = 0, done = 0;
    const baseOf = async i => { if (!bases.has(i)) { const c = draw(i); bases.set(i, { c, bmp: await toBitmap(c, 0.9) }); if (C.worker) C.orig(i, await toBitmap(c, 0.9)); } return bases.get(i); };
    try {
      for (const k of list) {
        const A = await baseOf(k.base);
        const B = k.copy ? copyOf(A.c, k.kind, k.base) : { c: (await baseOf(k.other)).c, q: 0.85 };
        const bmp = await toBitmap(B.c, B.q);
        const tc = performance.now();
        const res = await C.check(k.base, A.bmp, bmp);
        const took = performance.now() - tc;
        let v = 'cant';
        if (!res.err) { v = PP_VERDICT.score(PP_VERDICT.fields(res.best, 0)); ms += took; n++; if (res.fast != null) fast = res.fast; if (res.gpu != null) gpu = res.gpu; }
        const G = groups[k.g]; G.n++; G[v]++;
        if (k.copy ? v === 'same' || v === 'maybe' : v === 'no') G.right++;
        if (!C.worker) bmp.close && bmp.close();
        done++; if (onStep) onStep(done, list.length);
        await new Promise(r => setTimeout(r, 0));
      }
    } finally { C.stop(); for (const b of bases.values()) b.bmp.close && b.bmp.close(); }
    const right = Object.values(groups).reduce((a, g) => a + g.right, 0);
    return { at: Date.now(), n: list.length, right, groups, ms: n ? Math.round(ms / n) : null, total: Date.now() - t0, fast, gpu, worker: C.worker, v: 1 };
  }
  return { run, cases, draw, copyOf, GROUPS };
})();
