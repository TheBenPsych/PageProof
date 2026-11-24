// Checks that the fast checker (WebAssembly, tools/wasm/align.c) gives EXACTLY the same details,
// fingerprints and pairs as the JavaScript one, on every test picture.
// Usage: python3 tests/align/make_test_copies.py /tmp/copies && node tests/align/wasm_same.js /tmp/copies
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const DIR = process.argv[2];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.setContent('<html><body></body></html>');
  await p.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../../extension/align.js'), 'utf8') + ';window.PP_ALIGN=PP_ALIGN;' });
  if (!(await p.evaluate(() => PP_ALIGN.ready))) { console.log('FAIL: WebAssembly did not load'); process.exit(1); }
  const man = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json')));
  const data = f => 'data:image/png;base64,' + fs.readFileSync(path.join(DIR, f)).toString('base64');
  let bad = 0, n = 0, tJ = 0, tW = 0;
  for (const m of man) {
    const r = await p.evaluate(async ([da, dc]) => {
      const bm = async s => { const x = await createImageBitmap(await (await fetch(s)).blob()); const f = Math.min(1, 640 / Math.max(x.width, x.height)); return createImageBitmap(x, { resizeWidth: Math.max(1, Math.round(x.width * f)), resizeHeight: Math.max(1, Math.round(x.height * f)) }); };
      const A = await bm(da), B = await bm(dc), T = PP_ALIGN._t;
      let t = performance.now();
      const FAj = T.features(A, 900, { js: true }), FBj = T.features(B, 900, { js: true }), Mj = await T.match(FAj, FBj, { js: true });
      const tJ = performance.now() - t; t = performance.now();
      const FAw = T.features(A, 900), FBw = T.features(B, 900), Mw = await T.match(FAw, FBw);
      const tW = performance.now() - t;
      const same = (a, b) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
      const fs = (P, Q) => P.n === Q.n && same(P.x, Q.x) && same(P.y, Q.y) && same(P.mx, Q.mx) && same(P.d, Q.d);
      const ms = Mj.length === Mw.length && Mj.every((a, i) => a.i === Mw[i].i && a.j === Mw[i].j && a.d === Mw[i].d);
      return { ok: fs(FAj, FAw) && fs(FBj, FBw) && ms, why: [fs(FAj, FAw), fs(FBj, FBw), ms, FAj.n, FAw.n, Mj.length, Mw.length].join(' '), tJ, tW };
    }, [data(m.orig), data(m.copy)]);
    n++; tJ += r.tJ; tW += r.tW;
    if (!r.ok) { bad++; console.log('DIFFERENT', m.copy, r.why); }
  }
  console.log(`${n - bad}/${n} identical. Details + pairing: JavaScript ${Math.round(tJ / n)} ms, WebAssembly ${Math.round(tW / n)} ms per picture pair (${(tJ / tW).toFixed(1)}x faster).`);
  await b.close(); process.exit(bad ? 1 : 0);
})();
