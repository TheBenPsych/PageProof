// The calm look, step 6: All searches. A command bar (New search, which kind, only found copies,
// Find, one Delete), the last 7 days as tiles and a chart, a Running now card, and the list with
// named columns, a heading per day, tick boxes and Keep searching's fold opening as a photo grid.
const { start } = require('./h.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('revsearch.html?view=past')); await page.waitForSelector('.nhead');
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'light' }));
  ok(await page.evaluate(() => /No searches yet/.test(document.querySelector('.aempty').textContent) && !!document.getElementById('pastStart') && !document.querySelector('.acmd')), 'Nothing searched yet: one card with Start a new search, no empty tools');
  const seedJobs = () => page.evaluate(async () => {
    const px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const noon = new Date().setHours(12, 0, 0, 0), now = Math.min(Date.now(), noon) - 3600000 * 0, base = new Date().setHours(0, 0, 0, 0) + 60000, E = ['google', 'yandex', 'bing'];
    const link = (i, v, nw) => ({ url: 'https://s' + i + '.example/p', site: 's' + i + '.example', title: 'x', thumb: '', engines: ['google'], fake: v, isNew: !!nw });
    const pic = (i, t0, done, links, name) => ({ i, name: name || 'photo' + i + '.jpg', folderKey: 'Client ' + (i % 2 ? 'Odd' : 'Even') + '/photo' + i + '.jpg', thumb: px, w: 100, h: 80, t0: done ? t0 : undefined, t1: done ? t0 + 90000 : undefined, links: links || [], runs: Object.fromEntries(E.map(e => [e, { state: done ? 'done' : 'wait' }])) });
    const put = j => RS_DB.put('jobs', j.id, j);
    // today (just after midnight, so "today" holds at any hour): a running search, 5 one-photo searches, a Today's 50
    await put({ id: 'run', created: new Date(base + 50000).toISOString(), kind: '', engines: E, bg: true, started: true, pics: Array.from({ length: 14 }, (_, i) => pic(i, base, i < 7, i === 0 ? [link(1, 'same')] : [])) });
    for (let k = 0; k < 5; k++) await put({ id: 'k' + k, created: new Date(base + 40000 - k * 1000).toISOString(), kind: 'keep', engines: ['bing'], finished: true, pics: [pic(k, base, k !== 3, k === 1 ? [link(10, 'same', true)] : k === 2 ? [link(11, 'maybe')] : [], 'keep' + k + '.jpg')] });
    await put({ id: 'f1', created: new Date(base + 1000).toISOString(), kind: 'fifty', engines: E, finished: true, pics: Array.from({ length: 9 }, (_, i) => pic(i, base, true, i < 3 ? [link(20 + i, 'same', i === 0)] : [])) });
    // yesterday: a new search that did not finish; 3 days ago: a search that found nothing
    await put({ id: 'n1', created: new Date(base - 86400000 + 3600000).toISOString(), kind: '', engines: E, finished: true, started: true, pics: Array.from({ length: 8 }, (_, i) => pic(i, base - 86400000, i < 5, i === 1 ? [link(30, 'maybe')] : [], 'harbor' + i + '.jpg')) });
    await put({ id: 'n2', created: new Date(base - 3 * 86400000 + 3600000).toISOString(), kind: '', engines: ['google', 'bing'], finished: true, pics: [pic(0, base - 3 * 86400000, true, []), pic(1, base - 3 * 86400000, true, [])] });
  });
  await seedJobs();
  await page.reload(); await page.waitForSelector('.nhead');
  await page.evaluate(async () => { const real = verdict; verdict = l => l.fake || real(l); await renderPast(); });
  let a = await page.evaluate(() => ({ h1: document.querySelector('.nhead h1').textContent, seg: [...document.querySelectorAll('.aseg button')].map(b => b.textContent.replace(/\s+/g, ' ').trim()),
    tiles: [...document.querySelectorAll('#pastTiles .atile')].map(t => t.textContent), bars: document.querySelectorAll('#pastChart .abar').length, today: document.querySelector('#pastChart .abar:last-child').title,
    run: (document.querySelector('.arun') || {}).textContent || '', strip: document.querySelectorAll('.arun .arp').length, hit: document.querySelectorAll('.arun .arp.s-hit').length,
    cols: [...document.querySelectorAll('.ahead span')].map(s => s.textContent).filter(Boolean).join('|'), days: [...document.querySelectorAll('.aday')].map(d => d.textContent),
    rows: [...document.querySelectorAll('#pastList .arow[data-job]')].map(r => r.dataset.job), fold: (document.querySelector('.afold') || {}).textContent || '', del: document.getElementById('pastDel').disabled,
    foot: document.querySelector('.afoot').textContent, old: document.querySelectorAll('.pg-row,.pg-tiles,.pg-head,.pg-chip').length, emoji: /[🔎🗑▸▾]/u.test(document.getElementById('main').textContent) }));
  ok(/Copies found ›\s*All searches/.test(a.h1), 'The title says where you are');
  ok(a.seg.join('|') === 'All 8|New searches 2|Today\'s 50 1|Keep searching 5', 'The command bar counts each kind of search (' + a.seg.join('|') + ')');
  ok(a.tiles.length === 4 && /^9searches in the last 7 days/.test(a.tiles[0]) && /copies found · 2 new/.test(a.tiles[2]) && /Found the most.*Today's 50.*3 copies/.test(a.tiles[3]), 'Four tiles for the last 7 days, the last says which search found the most (' + a.tiles[3] + ')');
  ok(a.bars === 7 && /photos searched, \d+ cop/.test(a.today), 'Last 7 days chart: a bar per day (' + a.today + ')');
  ok(/Running now/.test(a.run) && /New search · 14 photos/.test(a.run) && /7 of 14 photos done/.test(a.run) && /50%/.test(a.run), 'Running now card shows how far the search is');
  ok(a.strip === 13 && a.hit === 1 && /\+2 more/.test(a.run), 'Its strip shows the first 12 photos and what each found');
  ok(a.cols === 'When|Search|Photos|Sites|Took|Same photo|Maybe|New', 'The list has named columns (' + a.cols + ')');
  ok(a.days.length === 3 && /^Today6 searches · 5 copies found/.test(a.days[0]) && /^Yesterday1 search · 1 copy found/.test(a.days[1]), 'A heading per day with its totals (' + a.days.join(' / ') + ')');
  ok(a.rows.join() === 'f1,n1,n2' && /5 one-photo searches · 1 did not finish/.test(a.fold), 'One line per search; Keep searching\'s one-photo searches fold into one line');
  ok(a.del && /90 days/.test(a.foot) && a.old === 0 && !a.emoji, 'Delete is off until something is ticked, the keep-times line is at the bottom, no old pieces or emoji left');
  const row = await page.evaluate(() => { const r = document.querySelector('.arow[data-job="n1"]'); return { txt: r.textContent, rest: (r.querySelector('.arest') || {}).textContent || '', thumbs: r.querySelectorAll('.athumbs img').length, more: (r.querySelector('.amore') || {}).textContent, sites: r.querySelectorAll('.asites .keng').length,
    f1: [...document.querySelectorAll('.arow[data-job="f1"] .r')].map(e => e.textContent).join('|'), took: document.querySelector('.arow[data-job="f1"] .atook').textContent }; });
  ok(/Not finished: 5 of 8 done/.test(row.txt) && /Search the last 3/.test(row.rest), 'A search that did not finish says so and offers Search the last 3');
  ok(row.thumbs === 5 && row.more === '+3' && row.sites === 3, 'Real thumbnails with +N, and a badge per search site');
  ok(row.f1 === '3|–|1 new' && /min|s/.test(row.took), 'Numbers instead of chips: same photo, maybe, new (' + row.f1 + '), and how long it took (' + row.took + ')');
  // ---- the fold opens as a grid of photos
  await page.click('.afold .awhat'); await page.waitForSelector('.agrid');
  a = await page.evaluate(() => ({ n: document.querySelectorAll('.agrid .agt').length, tags: [...document.querySelectorAll('.agrid .agt .ktag')].map(t => t.textContent).join('|'), exp: document.querySelector('.afold').getAttribute('aria-expanded'), t: document.querySelector('.afold .afoldt').textContent }));
  ok(a.n === 5 && a.tags === 'No copies|1 same|1 maybe|Not finished|No copies' && a.exp === 'true' && a.t === 'Hide', 'The Keep searching line opens as a grid of photos, each with what it found (' + a.tags + ')');
  // ---- the kind buttons, only found copies, Find
  await page.click('.aseg [data-kind="new"]'); await page.waitForTimeout(250);
  ok(await page.evaluate(() => [...document.querySelectorAll('#pastList .arow[data-job]')].map(r => r.dataset.job).join() === 'n1,n2' && !document.querySelector('.afold') && document.querySelector('.aseg [data-kind="new"]').getAttribute('aria-pressed') === 'true'), 'New searches shows only those');
  await page.check('#pastFound'); await page.waitForTimeout(250);
  ok(await page.evaluate(() => [...document.querySelectorAll('#pastList .arow[data-job]')].map(r => r.dataset.job).join() === 'n1'), 'Only searches that found copies hides the empty ones');
  await page.uncheck('#pastFound'); await page.click('.aseg [data-kind="all"]');
  await page.click('#pastFind'); await page.keyboard.type('harbor', { delay: 30 }); await page.waitForTimeout(500);
  a = await page.evaluate(() => ({ rows: [...document.querySelectorAll('#pastList .arow[data-job]')].map(r => r.dataset.job).join(), focus: document.activeElement.id, v: document.getElementById('pastFind').value }));
  ok(a.rows === 'n1' && a.focus === 'pastFind' && a.v === 'harbor', 'Find a photo or client filters while you type and keeps the cursor in the box');
  await page.fill('#pastFind', 'zzzz'); await page.waitForTimeout(500);
  ok(await page.evaluate(() => /No searches match/.test(document.querySelector('.anone').textContent)), 'Nothing matches: the list says so');
  await page.click('#pastClear'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.querySelectorAll('#pastList .arow[data-job]').length === 3 && document.getElementById('pastFind').value === ''), 'Show all searches clears the filters');
  // ---- tick boxes and one Delete, with Undo
  await page.click('.arow[data-job="n2"] .achkb input'); await page.waitForTimeout(250);
  ok(await page.evaluate(() => /Delete \(1\)/.test(document.getElementById('pastDel').textContent) && !document.getElementById('pastDel').disabled && document.querySelector('.arow[data-job="n2"]').classList.contains('sel') && !/results/.test(location.href)), 'Ticking a search turns Delete on and does not open the search');
  await page.click('.afold .achkb input'); await page.waitForTimeout(250);
  ok(await page.evaluate(() => /Delete \(6\)/.test(document.getElementById('pastDel').textContent) && document.querySelectorAll('.agt.sel').length === 5), 'Ticking the folded line ticks all its searches');
  await page.click('#pastDel'); await page.waitForTimeout(500);
  a = await page.evaluate(async () => ({ left: (await RS_DB.all('jobs')).map(j => j.id).sort().join(), bar: document.getElementById('banner').textContent, seg: document.querySelector('.aseg [data-kind="all"]').textContent.replace(/\s+/g, ' ') }));
  ok(a.left === 'f1,n1,run' && /6 searches deleted/.test(a.bar) && /still in Copies found/.test(a.bar) && /All 2/.test(a.seg), 'Delete removes the ticked searches and says the copies stay (' + a.bar.slice(0, 40) + ')');
  await page.click('#undoDel'); await page.waitForTimeout(500);
  ok(await page.evaluate(async () => (await RS_DB.all('jobs')).length === 9 && document.getElementById('banner').hidden && /All 8/.test(document.querySelector('.aseg [data-kind="all"]').textContent.replace(/\s+/g, ' '))), 'Undo brings them all back');
  await page.click('.ahead .achkb input'); await page.waitForTimeout(250);
  ok(await page.evaluate(() => /Delete \(8\)/.test(document.getElementById('pastDel').textContent)), 'The tick box in the heading ticks every search shown (never the running one)');
  await page.click('.ahead .achkb input'); await page.waitForTimeout(250);
  // ---- sizes and dark
  const fit = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await page.setViewportSize({ width: 700, height: 900 }); await page.waitForTimeout(300);
  const nar = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(fit <= 0 && nar <= 0, 'Nothing runs off the side, wide or narrow (' + fit + ', ' + nar + ')');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'dark' })); await page.reload(); await page.waitForSelector('#pastList');
  await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
  const d = await page.evaluate(() => ({ card: getComputedStyle(document.querySelector('#pastList')).backgroundColor, ink: getComputedStyle(document.querySelector('.aday b')).color }));
  ok(d.card === 'rgb(43, 43, 43)' && +d.ink.match(/\d+/)[0] > 220, `Dark: grey cards and light words (${d.card}, ${d.ink})`);
  // ---- Search the last N opens the search and carries on with the rest
  await page.evaluate(() => { window.__went = ''; goResults = id => { window.__went = id; }; });
  await page.click('.arow[data-job="n1"] .arest'); await page.waitForTimeout(200);
  ok(await page.evaluate(() => window.__went === 'n1' && sessionStorage.getItem('ppRest') === 'n1'), 'Search the last 3 opens that search and asks it to search the rest');
  await page.evaluate(() => sessionStorage.removeItem('ppRest'));
  await page.click('.arow[data-job="f1"] .awhat'); await page.waitForTimeout(200);
  ok(await page.evaluate(() => window.__went === 'f1'), 'Clicking a line opens that search');
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
