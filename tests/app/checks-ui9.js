// UI follow-up (Batch 9): Search results and All searches filled out. A square for every photo,
// a time-left tile, the picked photo with one card per search site and its copies as pictures,
// What's happening, wider pages; All searches with this week's numbers, day headings, folded
// Keep searching runs and small pictures. Plus: blocked pictures don't flash on every refresh.
const { start } = require('./h.js');
process.env.NP = 40; process.env.NC = 10;
const { seed } = require('./seed.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800); await seed(page);
  await page.evaluate(async () => {
    const now = Date.now(), E = ['google', 'yandex', 'bing'];
    const link = (i, k, fake, e) => ({ url: 'https://s' + i + k + '.example/p', site: 's' + i + k + '.example', title: 't', thumb: k === 1 ? 'https://blocked.example/x.jpg' : '', engines: [e], fake, pct: 50 });
    const pics = Array.from({ length: 20 }, (_, i) => {
      const done = i < 4, t0 = now - (30 - i * 5) * 60000;
      return { i, name: 'photo' + i + '.jpg', thumb: '', w: 10, h: 10, t0: done || i === 4 ? t0 : undefined, t1: done ? t0 + 120000 : undefined,
        links: done ? [0, 1, 2, 3].map(k => link(i, k, i === 1 && k < 2 ? (k ? 'maybe' : 'same') : 'no', E[k % 3])) : [],
        runs: Object.fromEntries(E.map((e, k) => [e, done ? { state: 'done', at: t0 + k * 30000 } : i === 4 ? { state: 'go' } : { state: 'wait' }])) };
    });
    await RS_DB.put('jobs', 'jb', { id: 'jb', created: new Date(now - 31 * 60000).toISOString(), kind: 'fifty', engines: E, bg: true, started: true, pics });
    for (let k = 0; k < 4; k++) await RS_DB.put('jobs', 'k' + k, { id: 'k' + k, created: new Date(new Date().setHours(0, 0, 0, 0) - 12 * 3600e3 + k * 60000).toISOString(), kind: 'keep', engines: E, finished: true, pics: [{ i: 0, name: 'p.jpg', thumb: '', links: [], runs: { google: { state: 'done' } } }] });
  });
  const rs = await ctx.newPage(); await rs.setViewportSize({ width: 1900, height: 1100 });
  rs.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await rs.route('https://blocked.example/**', r => r.abort());
  await rs.goto(url('revsearch.html?job=jb')); await rs.waitForTimeout(500);
  await rs.evaluate(() => { const real = verdict; verdict = l => l.fake || real(l); R.sel = 1; renderResults(); });
  await rs.waitForTimeout(1200);
  const r = await rs.evaluate(() => ({
    wide: document.getElementById('main').getBoundingClientRect().width,
    sq: document.querySelectorAll('.res-strip .sq button').length, same: document.querySelectorAll('.res-strip .sq .same').length,
    tiles: document.querySelectorAll('.pg-tiles.four .pg-tile').length, left: (document.querySelectorAll('.pg-tiles .pg-tile')[3] || {}).textContent || '',
    engs: document.querySelectorAll('.res-engs .res-eng').length, finds: document.querySelectorAll('.res-fgrid .res-find').length,
    feed: [...document.querySelectorAll('.res-feed .e')].map(e => e.textContent),
    cols: getComputedStyle(document.querySelector('.res-grid')).gridTemplateColumns.split(' ').length,
  }));
  ok(r.wide > 1300, 'Wider page on a big screen (' + Math.round(r.wide) + 'px)');
  ok(r.sq === 20 && r.same === 1, 'A square for every photo, coloured by what it found');
  ok(r.tiles === 4 && /left/.test(r.left), 'A fourth tile says about how long is left: ' + r.left);
  ok(r.engs === 3, 'One card per search site for the picked photo');
  ok(r.finds === 2, 'The copies it found show as small pictures (' + r.finds + ')');
  ok(r.feed.length >= 5 && r.feed.some(t => /sent to Copies found/.test(t)), 'What\'s happening lists the search, newest first');
  ok(r.cols === 3, 'Three columns: photos, the picked photo, What\'s happening');
  await rs.click('.res-strip .sq button:nth-child(4)'); await rs.waitForTimeout(400);
  ok(await rs.evaluate(() => /photo3\.jpg/.test(document.querySelector('#selcard h2').textContent)), 'Clicking a square opens that photo');
  // A blocked picture is shown as a grey box straight away on the next refresh (no flash).
  await rs.evaluate(() => { R.sel = 1; renderResults(); document.getElementById('thrown').open = true; renderResults(); });
  await rs.waitForTimeout(800);
  ok(await rs.evaluate(() => { BAD_THUMBS.size; renderResults(); return BAD_THUMBS.size >= 1 && !document.querySelector('img[src="https://blocked.example/x.jpg"]'); }), 'A blocked picture is not tried again on every refresh');

  await rs.goto(url('revsearch.html?view=past')); await rs.waitForTimeout(1200);
  const a = await rs.evaluate(() => ({ tiles: document.querySelectorAll('.pg-tiles.four .pg-tile').length, days: document.querySelectorAll('.pg-day').length,
    fold: (document.querySelector('.pg-row.fold') || {}).textContent || '', rows: document.querySelectorAll('.pg-row.past').length, thumbs: !!document.querySelector('.pg-thumbs') }));
  ok(a.tiles === 4, 'All searches: this week in numbers');
  ok(a.days >= 1 && a.thumbs, 'All searches: day headings and small pictures');
  ok(/4 one-photo searches/.test(a.fold) && a.rows === 2, 'Keep searching\'s one-photo searches fold into one line');
  await rs.click('.pg-row.fold'); await rs.waitForTimeout(500);
  ok(await rs.evaluate(() => document.querySelectorAll('.pg-row.inner').length === 4), 'Clicking the folded line shows each search');
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e); process.exit(1); });
