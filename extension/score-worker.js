// Background photo checker for reverse image search. It lines one found picture up with
// yours (align.js, the same check the Compare page uses) away from the results page, so the
// page never freezes while hundreds of links are checked. Nothing leaves the computer.
importScripts('align.js');

const originals = new Map();   // picture number -> your picture (kept so its details are found once)

self.onmessage = async e => {
  const m = e.data;
  if (m.type === 'orig') { originals.set(m.key, m.bmp); return; }
  if (m.type === 'forget') { originals.delete(m.key); return; }   // not closed: a check may still be using it
  if (m.type !== 'check') return;
  await PP_ALIGN.ready;                       // the fast checker (WebAssembly) loads in a moment
  const A = originals.get(m.key);
  let out = null, err = null;
  try {
    if (!A) throw new Error('no original');
    const best = await PP_ALIGN.align(A, m.bmp, undefined, { fast: true });
    out = best ? { lines: best.sc.lines, inliers: best.inliers || 0, matched: best.sc.matched, strength: best.sc.strength, midTex: best.sc.midTex, midMatched: best.sc.midMatched, inside: best.sc.inside } : { none: true };
    // Could count as a copy: check it isn't only a repeating press wall that lines up.
    if (best && best.sc.lines >= 0.3) { const R = PP_ALIGN.repeats(A, m.bmp, best); out.uniq = R.unique; out.rep = R.repeated; out.backdrop = R.backdropOnly; }
  } catch (x) { err = String(x && x.message || x); }
  try { m.bmp.close && m.bmp.close(); } catch (x) { /* already freed */ }
  self.postMessage({ id: m.id, out, err, fast: PP_ALIGN.fast(), gpu: PP_ALIGN.gpu(), gpuWhy: PP_ALIGN.gpuWhy() });
};
