// Runs PP_ALIGN (extension/align.js) on every test copy and checks it lands within 8 pixels.
// Usage: python3 tests/align/make_test_copies.py /tmp/copies && node tests/align/run_tests.js /tmp/copies
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const DIR = process.argv[2], filter = process.argv[3] || '';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.setContent('<html><body></body></html>');
  await p.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../../extension/align.js'), 'utf8') + ';window.PP_ALIGN=PP_ALIGN;' });
  const man = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'))).filter(m => m.copy.includes(filter));
  let pass = 0, fail = [], tms = 0;
  for (const m of man) {
    const da = 'data:image/png;base64,' + fs.readFileSync(path.join(DIR, m.orig)).toString('base64');
    const dc = 'data:image/png;base64,' + fs.readFileSync(path.join(DIR, m.copy)).toString('base64');
    const r = await p.evaluate(async ([da, dc, G]) => {
      const bm = async s => createImageBitmap(await (await fetch(s)).blob());
      const A = await bm(da), B = await bm(dc), t0 = performance.now();
      const T = await PP_ALIGN.align(A, B);
      const ms = performance.now() - t0;
      if (!T) return { ms, none: true };
      let errs = [];
      if (G) {
        for (let i = 1; i < 10; i++) for (let j = 1; j < 10; j++) {
          const u = B.width * i / 10, v = B.height * j / 10;
          const gx = G[0][0] * u + G[0][1] * v + G[0][2], gy = G[1][0] * u + G[1][1] * v + G[1][2];
          if (gx < 0 || gy < 0 || gx > A.width || gy > A.height) continue;
          const q = PP_ALIGN.mapPoint(T, B, u, v), px = q.x, py = q.y;
          errs.push(Math.hypot(px - gx, py - gy));
        }
      }
      errs.sort((x, y) => x - y);
      const C = PP_ALIGN.changes(A, B, T);
      return { ms, how: T.how, inl: T.inliers, s: T.s, w: T.w, r: T.r, k: T.k, flip: T.flip, lines: T.sc.lines, str: T.sc.strength, same: C.sameShare, untouched: C.untouchedLines, med: errs[errs.length >> 1], max: errs[errs.length - 1], n: errs.length };
    }, [da, dc, m.G]);
    tms += r.ms;
    const tol = 0.012 * Math.max(...[800]);
    let ok, verdict;
    const lines = r.lines || 0;
    // Different photos: low score and (almost) no area marked as the same photo.
    if (!m.G) { ok = (!r.lines || r.lines < 0.25) && !(r.same > 0.1); verdict = 'negative'; }
    // AI-edited post (big added object + caption band): the untouched part must show as the same photo.
    else if (m.copy.includes('ai-added')) ok = !r.none && r.n > 0 && r.max < 8 && r.same >= 0.3 && r.same <= 0.9 && r.untouched >= 0.6;
    else if (m.copy.includes('perspective')) ok = !r.none && lines >= 0.5;
    else ok = !r.none && r.n > 0 && r.max < 8 && lines >= 0.25;
    if (ok) pass++; else fail.push(m.copy);
    console.log((ok ? 'PASS ' : 'FAIL ') + m.copy.padEnd(42) + ' ' + JSON.stringify({ how: r.how, inl: r.inl, s: r.s && +r.s.toFixed(3), w: r.w && +r.w.toFixed(3), r: r.r && +r.r.toFixed(2), k: r.k && +r.k.toFixed(3), flip: r.flip, lines: +(lines).toFixed(2), same: r.same != null ? +r.same.toFixed(2) : undefined, untouched: r.untouched != null ? +r.untouched.toFixed(2) : undefined, str: r.str && +r.str.toFixed(2), med: r.med && +r.med.toFixed(1), max: r.max && +r.max.toFixed(1), ms: Math.round(r.ms) }));
  }
  console.log(`\n${pass}/${man.length} passed, avg ${Math.round(tms / man.length)} ms`); if (fail.length) console.log('failed:', fail.join(', '));
  await b.close();
})();
