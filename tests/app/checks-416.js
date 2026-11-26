// 4.16: the fast photo checker (WebAssembly) starts inside PageProof, in a page and in the
// background photo-check worker, and gives the same answer as before; Is everything working
// shows "Where the time goes".
const { start } = require('./h.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });

  // 1. On a PageProof page (the Compare page loads align.js) the fast checker starts.
  await page.goto(url('compare.html')); await page.waitForTimeout(800);
  const r = await page.evaluate(async () => {
    const loaded = await PP_ALIGN.ready;
    // A made-up photo: soft shapes and noise, so it has details to find.
    const c = document.createElement('canvas'); c.width = 600; c.height = 400; const x = c.getContext('2d');
    let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 400; i++) { x.fillStyle = `hsl(${rnd() * 360},70%,${30 + rnd() * 50}%)`; x.fillRect(rnd() * 600, rnd() * 400, 5 + rnd() * 60, 5 + rnd() * 60); }
    const A = await createImageBitmap(c);
    const d = document.createElement('canvas'); d.width = 420; d.height = 280; const y = d.getContext('2d'); y.drawImage(c, 0, 0, 420, 280);
    const B = await createImageBitmap(d);
    const T = PP_ALIGN._t;
    const same = (a, b) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
    const Fj = T.features(B, 900, { js: true }), Fw = T.features(B, 900);
    const fast = await PP_ALIGN.align(A, B, undefined, { fast: true });
    // The background worker does the same.
    const w = new Worker('score-worker.js');
    const ans = await new Promise(res => { w.onmessage = e => res(e.data); w.postMessage({ type: 'orig', key: 1, bmp: A }, [A]); w.postMessage({ type: 'check', id: 9, key: 1, bmp: B }, [B]); });
    w.terminate();
    return { loaded, on: PP_ALIGN.fast(), identical: Fj.n > 50 && same(Fj.x, Fw.x) && same(Fj.d, Fw.d), lines: fast && fast.sc.lines, worker: ans };
  });
  ok(r.loaded && r.on, 'The fast checker (WebAssembly) starts on a PageProof page');
  ok(r.identical, 'It finds exactly the same details and fingerprints as the JavaScript checker');
  ok(r.lines > 0.8, 'A resized copy still lines up (' + Math.round((r.lines || 0) * 100) + '%)');
  ok(r.worker && r.worker.fast === true && r.worker.out && r.worker.out.lines > 0.8, 'The background photo-check worker uses it too and gives the same answer');
  // 4.17: without a graphics card (as on this test computer) the checks still work and say so.
  ok(r.worker && 'gpu' in r.worker && r.worker.gpu !== true, 'No graphics card here: the worker carries on the normal way (graphics card: ' + (r.worker && r.worker.gpu) + ')');

  // 2. Where the time goes, on Is everything working.
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  await page.evaluate(async () => {
    const day = new Date().toISOString().slice(0, 10);
    await chrome.storage.local.set({ rsTiming: { fast: true, checks: 2, at: Date.now(), days: { [day]: { search: [10, 180000], dl: [400, 360000], check: [400, 48000], wait: [400, 8000], skipped: 37 } } } });
  });
  await page.goto(url('app.html#health')); await page.waitForTimeout(2500);
  await page.click('#sxTime summary'); await page.waitForTimeout(300);
  const t = await page.evaluate(() => document.body.innerText);
  ok(/Where the time goes/.test(t) && /Fast checker on/.test(t), 'Is everything working shows Where the time goes, with the fast checker on');
  ok(/18\.0 seconds each/.test(t) && /120 ms each/.test(t) && /37/.test(t), 'It shows the average for each step and the skipped hidden-site links');
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'All 4.16 checks passed');
  process.exit(fails ? 1 : 0);
})();
