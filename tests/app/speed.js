// Speed check with a big pretend library: 50,000 photos and 5,000 copies found.
// Each page must draw inside its limit, so a change that makes PageProof slow is caught
// before it is released. (The limits are loose: test computers are slower than office ones.)
const { start } = require('./h.js');
process.env.NP = process.env.NP || 50000; process.env.NC = process.env.NC || 5000;
const { seed } = require('./seed.js');
const LIMIT = { home: [6000, 1500], found: [8000, 2500], review: [6000, 2500], clients: [5000, 1500], photos: [6000, 2500], keep: [6000, 1500], owners: [6000, 2500], health: [6000, 3000] };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  let fails = 0;
  page.on('pageerror', e => { fails++; console.log('PAGE ERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  console.log('library', JSON.stringify(await seed(page)));
  await page.evaluate(async () => { await FC.DB.del('meta', 'picsMoved'); await FC.movePics(); });
  await page.reload(); await page.waitForTimeout(1500);
  for (const [r, [first, again]] of Object.entries(LIMIT)) {
    await page.evaluate(() => { location.hash = 'help'; }); await page.waitForTimeout(300);
    const a = await page.evaluate(async r => { const t0 = performance.now(); history.replaceState(null, '', '#' + r); await render(); return Math.round(performance.now() - t0); }, r);
    const b = await page.evaluate(async () => { const t0 = performance.now(); await render(true); return Math.round(performance.now() - t0); });
    const good = a <= first && b <= again; if (!good) fails++;
    console.log((good ? 'PASS ' : 'FAIL ') + r.padEnd(8) + ' first ' + a + ' ms (limit ' + first + '), again ' + b + ' ms (limit ' + again + ')');
  }
  const mem = await page.evaluate(() => performance.memory && Math.round(performance.memory.usedJSHeapSize / 1e6));
  const memOk = !mem || mem < 250; if (!memOk) fails++;
  console.log((memOk ? 'PASS ' : 'FAIL ') + 'page memory ' + mem + ' MB (limit 250)');
  await ctx.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
