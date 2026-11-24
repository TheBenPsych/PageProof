// UI overhaul batch 5: Needs a capture (Capture the oldest, waiting chips, one solid button),
// Capture a page (last tab card, 4 steps), Weekly tiles with "vs last week", Verify in the main look.
const { start } = require('./h.js');
process.env.NP = 200; process.env.NC = 60;
const { seed } = require('./seed.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage(); await page.setViewportSize({ width: 1400, height: 900 });
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(1000); await seed(page);
  await page.goto(url('app.html#tocapture')); await page.waitForTimeout(2500);
  const t = await page.evaluate(() => ({ oldest: !!document.querySelector('.headact [data-act="capturecopy"]'), first: (document.querySelector('.headact [data-act="capturecopy"]') || {}).dataset.v === (document.querySelector('#capList .caprow') || { dataset: {} }).dataset.id, rows: document.querySelectorAll('#capList .caprow').length, solid: document.querySelectorAll('#capList .btn.primary').length, ages: document.querySelectorAll('#capList .agechip').length }));
  ok(t.oldest && t.first, '"Capture the oldest" opens the top (oldest) copy');
  ok(t.rows > 1 && t.solid === 1 && t.ages === t.rows, 'Only the top row has a solid Capture button; every row says how long it has waited');
  await page.goto(url('app.html#capture')); await page.waitForTimeout(1500);
  ok(await page.evaluate(() => document.querySelectorAll('.csteps .cstep').length === 4 && !!document.querySelector('.caphero')), 'Capture a page: last-tab card and four picture steps');
  await page.goto(url('app.html#weekly')); await page.waitForTimeout(1500);
  ok(await page.evaluate(() => document.querySelectorAll('.wtiles .wtile').length === 6 && /last week/.test(document.querySelector('.wtiles').textContent)), 'Weekly: six tiles, each compared with last week');
  await page.goto(url('verify.html')); await page.waitForTimeout(800);
  ok(await page.evaluate(() => document.body.classList.contains('plain') && !document.querySelector('header') && /Verify a pack/.test(document.querySelector('.pg-head h1').textContent)), 'Verify a pack: normal page heading, no old header');
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e); process.exit(1); });
