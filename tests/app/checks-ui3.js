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
  const n = await page.evaluate(() => ({ steps: document.querySelectorAll('.nnew .card').length, side: getComputedStyle(document.getElementById('side')).display, go: !!document.querySelector('#goSearch'), why: (document.querySelector('.pg-why') || {}).textContent || '' }));
  ok(n.steps >= 4 && n.go && n.side === 'none', 'New search: photos, search sites, speed and the Search button, no inner side panel');
  ok(/at least one photo/.test(n.why), 'The Search button says why it cannot start yet (' + n.why + ')');
  await page.goto(url('revsearch.html?view=past')); await page.waitForTimeout(1000);
  ok(await page.evaluate(() => /No searches yet/.test(document.body.textContent) && !!document.querySelector('.aempty a#pastStart')), 'All searches, empty: a Start a new search button');
  await page.goto(url('app.html#help')); await page.waitForTimeout(1000); await seed(page);
  await page.evaluate(async () => {
    const mk = (id, fin) => ({ id, created: new Date().toISOString(), kind: 'fifty', engines: ['google', 'yandex', 'bing'], finished: fin,
      pics: [0, 1, 2].map(i => ({ i, name: 'photo' + i + '.jpg', thumb: '', w: 100, h: 80, ingested: fin, runs: { google: { state: 'done' }, yandex: { state: 'done' }, bing: { state: i ? 'done' : 'skip' } }, links: [] })) });
    await RS_DB.put('jobs', 'j1', mk('j1', true));
    await FC.setKeep({ on: true });
    await chrome.storage.local.set({ fcStatus: { beat: Date.now(), state: 'running', text: 'Searching', current: { name: 'photo9.jpg', sub: 'Client A', thumb: '' } }, fcRest: { bing: Date.now() + 1800000 } });
  });
  const rs = await ctx.newPage(); await rs.goto(url('revsearch.html?view=past')); await rs.waitForTimeout(1200);
  ok(await rs.evaluate(() => document.querySelectorAll('#pastList .arow[data-job]').length === 1 && document.querySelectorAll('#pastList .arow[data-job] .ksq').length === 1), 'All searches: one row per search, with its kind icon');
  await rs.goto(url('revsearch.html?job=j1')); await rs.waitForTimeout(1500);
  const r = await rs.evaluate(() => ({ tiles: document.querySelectorAll('#progCard .nnum').length, rows: document.querySelectorAll('.nstrip .nfp').length, dots: document.querySelectorAll('.nlights .nlight').length, lights: [...document.querySelectorAll('.nlights .nlight')].map(e => e.textContent).join('|'), thrown: !!document.querySelector('details#thrown') && !document.querySelector('details#thrown').open }));
  ok(r.tiles >= 2 && r.rows === 3 && r.dots === 3, 'Search results: numbers on one card, one picture per photo, 3 search site lights (' + r.tiles + '/' + r.rows + '/' + r.dots + ')');
  ok(/Bing.*Some skipped/.test(r.lights), 'Search site lights say when a site skipped photos (' + r.lights + ')');
  ok(r.thrown, 'Thrown out is a quiet folded line');
  // The page redraws while a search runs: the photo list keeps where you scrolled it to.
  await rs.evaluate(async () => { const j = await RS_DB.get('jobs', 'j1'); j.id = 'j2'; j.pics = Array.from({ length: 40 }, (_, i) => ({ ...j.pics[1], i, name: 'photo' + i + '.jpg' })); await RS_DB.put('jobs', 'j2', j); });
  await rs.setViewportSize({ width: 1300, height: 700 });
  await rs.goto(url('revsearch.html?job=j2')); await rs.waitForTimeout(1500);
  const sc = await rs.evaluate(async () => { window.scrollTo(0, 400); const before = window.scrollY; renderResults(); await new Promise(r => setTimeout(r, 100)); return { before, after: window.scrollY }; });
  ok(sc.before > 200 && Math.abs(sc.after - sc.before) < 2, 'Search results: the page keeps its scroll when the page redraws (' + sc.before + ' -> ' + sc.after + ')');
  await page.goto(url('app.html#keep')); await page.waitForTimeout(1800);
  const k = await page.evaluate(() => ({ now: (document.querySelector('#keepNow') || {}).textContent || '', lights: [...document.querySelectorAll('#keepSites .ksr.e')].map(e => e.textContent).join('|'), tiles: document.querySelectorAll('#keepTiles .kt2').length }));
  await page.goto(url('app.html#keep?tab=progress')); await page.waitForTimeout(1500);
  k.info = await page.evaluate(() => document.querySelectorAll('.kinfo[title]').length);
  ok(/Searching now/.test(k.now) && /photo9\.jpg/.test(k.now), 'Keep searching: live card shows the photo being searched');
  ok(/Bing.*rests until/i.test(k.lights) && k.tiles === 4, 'Search site lights (Bing resting) and four number tiles');
  ok(k.info >= 1, 'Long explanations moved into ⓘ notes (' + k.info + ')');
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e); process.exit(1); });
