// UI overhaul batch 3: New search as 3 steps, All searches list (and its empty page), Search
// results with tiles and one row per photo, Keep searching live card with search site lights.
// Pretend data only.
const { start } = require('./h.js');
process.env.NP = 200; process.env.NC = 40;
const { seed } = require('./seed.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage(); await page.setViewportSize({ width: 1400, height: 900 });
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('revsearch.html')); await page.waitForTimeout(1200);
  const n = await page.evaluate(() => ({ steps: document.querySelectorAll('.pg-steps .pg-step').length, side: getComputedStyle(document.getElementById('side')).display, go: document.querySelector('.pg-step .pg-btn.big'), why: (document.querySelector('.pg-why') || {}).textContent || '' }));
  ok(n.steps === 3 && n.side === 'none', 'New search: three step cards, no inner side panel');
  ok(/at least one picture/.test(n.why), 'The Search button says why it cannot start yet (' + n.why + ')');
  await page.goto(url('revsearch.html?view=past')); await page.waitForTimeout(1000);
  ok(await page.evaluate(() => /No searches yet/.test(document.body.textContent) && !!document.querySelector('.pg-empty a.pg-btn')), 'All searches, empty: a Start a new search button');
  await page.goto(url('app.html#help')); await page.waitForTimeout(1000); await seed(page);
  await page.evaluate(async () => {
    const mk = (id, fin) => ({ id, created: new Date().toISOString(), kind: 'fifty', engines: ['google', 'yandex', 'bing'], finished: fin,
      pics: [0, 1, 2].map(i => ({ i, name: 'photo' + i + '.jpg', thumb: '', w: 100, h: 80, ingested: fin, runs: { google: { state: 'done' }, yandex: { state: 'done' }, bing: { state: i ? 'done' : 'skip' } }, links: [] })) });
    await RS_DB.put('jobs', 'j1', mk('j1', true));
    await FC.setKeep({ on: true });
    await chrome.storage.local.set({ fcStatus: { beat: Date.now(), state: 'running', text: 'Searching', current: { name: 'photo9.jpg', sub: 'Client A', thumb: '' } }, fcRest: { bing: Date.now() + 1800000 } });
  });
  const rs = await ctx.newPage(); await rs.goto(url('revsearch.html?view=past')); await rs.waitForTimeout(1200);
  ok(await rs.evaluate(() => document.querySelectorAll('.pg-list .pg-row .pg-ring').length === 1), 'All searches: one row per search, with a ring');
  await rs.goto(url('revsearch.html?job=j1')); await rs.waitForTimeout(1500);
  const r = await rs.evaluate(() => ({ tiles: document.querySelectorAll('.pg-tiles .pg-tile').length, rows: document.querySelectorAll('.res-list .pg-row').length, dots: document.querySelectorAll('.res-list .pg-row .pg-dots span').length, lights: [...document.querySelectorAll('.pg-eng .e')].map(e => e.textContent).join('|'), thrown: !!document.querySelector('details.pg-thrown') }));
  ok(r.tiles === 3 && r.rows === 3 && r.dots === 9, 'Search results: 3 tiles, one row per photo with 3 search site lights');
  ok(/Bing.*some skipped/.test(r.lights), 'Search site lights say when a site skipped photos (' + r.lights + ')');
  ok(r.thrown, 'Thrown out is a quiet folded line');
  await page.goto(url('app.html#keep')); await page.waitForTimeout(1800);
  const k = await page.evaluate(() => ({ now: (document.querySelector('.know') || {}).textContent || '', lights: [...document.querySelectorAll('.englights .e')].map(e => e.textContent).join('|'), tiles: document.querySelectorAll('.ktiles .ktile').length, info: document.querySelectorAll('.kinfo[title]').length }));
  ok(/Searching now/.test(k.now) && /photo9\.jpg/.test(k.now), 'Keep searching: live card shows the photo being searched');
  ok(/Bing.*rests until/.test(k.lights) && k.tiles === 3, 'Search site lights (Bing resting) and three small tiles');
  ok(k.info >= 2, 'Long explanations moved into ⓘ notes (' + k.info + ')');
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e); process.exit(1); });
