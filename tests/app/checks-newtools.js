// New tools (Ben's picks, 2026-11-24): Credit search, Watching, Registrations and Find the company
// (names it goes by, the research steps, the company card and its status on copies).
// Made-up sites and names only.
const { start } = require('./h.js');
const http = require('http');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  const day = n => new Date(Date.now() - n * 864e5).toISOString();
  // Two pictures: "ours" (the client's photo) and "other".
  const pics = await page.evaluate(async ({ d1, d10 }) => {
    await chrome.storage.local.set({ ppSetupDone: true, ppTourDone: true, ppSeenVersion: chrome.runtime.getManifest().version, ppReconnectVer: chrome.runtime.getManifest().version,
      ppCheckup: { ver: chrome.runtime.getManifest().version, at: Date.now(), items: [], ok: true, seen: true }, fcDrive: { label: 'G:\\Shared drives\\Photos', done: true } });
    const mk = async seed => { const c = new OffscreenCanvas(640, 480), x = c.getContext('2d'); let s = seed; for (let i = 0; i < 640; i += 8) for (let j = 0; j < 480; j += 8) { s = (s * 16807) % 2147483647; x.fillStyle = `rgb(${s % 256},${(s >> 8) % 256},${(s >> 16) % 256})`; x.fillRect(i, j, 8, 8); } x.fillStyle = '#fff'; x.fillRect(0, 0, 320, 480); return c.convertToBlob({ type: 'image/jpeg', quality: 0.95 }); };
    const ours = await mk(7), other = await mk(99), third = await mk(1234);
    const look = await FC.lookHash(ours), look3 = await FC.lookHash(third);
    await FC.DB.put('clients', { name: 'Harbor Times', searching: true, priority: false, licensed: [], photos: 3 });
    const P = (n, extra) => ({ id: 'd:Harbor Times/2026/Q4/' + n, client: 'Harbor Times', name: n, rel: 'Harbor Times/2026/Q4/' + n, folder: 'Harbor Times/2026/Q4', year: 2026, quarter: 4, flag: '', searches: 1, empty: 0, copies: 1, stolen: 0, added: 1, lastSearched: d10, ...extra });
    await FC.DB.putMany('photos', [P('a.jpg', { look }), P('b.jpg', { folder: 'Harbor Times/2026/Q3' }), P('c.jpg', { folder: 'Harbor Times/2026/Q2 VA 2-412-118', look: look3 })]);
    let i = 0;
    const C = (photo, site, extra) => { i++; const u = 'https://' + site + '/story-' + i; return { id: 'd:Harbor Times/2026/Q4/' + photo + '|' + site + '/story-' + i, photo: 'd:Harbor Times/2026/Q4/' + photo, client: 'Harbor Times', url: u, key: site + '/story-' + i, pk: site + '/story-' + i, site, title: '', thumb: '', img: '', engines: [], pct: 90, match: 'same', firstSeen: d1, lastSeen: d1, times: 1, status: 'new', online: 'up', use: 'copied', ...extra }; };
    await FC.DB.putMany('copies', [
      C('a.jpg', 'watched-example.com', { status: 'stolen', answered: d1 }), C('b.jpg', 'watched-example.com', { status: 'stolen', answered: d1 }),
      C('b.jpg', 'onestolen-example.com', { status: 'stolen', answered: d1 }), C('c.jpg', 'newsblog-example.com'),
    ]);
    await FC.meta.set('regs', { 'Harbor Times/2026/Q3': { app: '1-14100259930', from: 'Folder name' }, 'Harbor Times/2026/Q2 VA 2-412-118': { va: 'VA 2-412-118', from: 'Folder name' } });
    FC.touch('copies');
    return { ours: [...new Uint8Array(await ours.arrayBuffer())], other: [...new Uint8Array(await other.arrayBuffer())], third: [...new Uint8Array(await third.arrayBuffer())] };
  }, { d1: day(1), d10: day(10) });

  let base = '';
  const hits = [];
  const srv = http.createServer((q, r) => {
    hits.push(q.url);
    const send = (type, body) => { r.writeHead(200, { 'content-type': type }); r.end(body); };
    // a fake Google results page, and one that asks for a robot check
    if (q.url.startsWith('/search?q=robot')) return send('text/html', '<html><body>Our systems have detected unusual traffic from your computer network.</body></html>');
    if (q.url.startsWith('/search')) return send('text/html', `<html><body><div id="search"><a href="${base}/credited-1"><h3>Harbor parade story</h3></a><a href="${base}/credited-2"><h3>Another story</h3></a><a href="https://www.google.com/x"><h3>Google itself</h3></a></div></body></html>`);
    if (q.url === '/credited-1') return send('text/html', `<html><head><title>Parade</title><meta property="og:image" content="${base}/img/ours.jpg"></head><body>Photo: Harbor Times</body></html>`);
    if (q.url === '/credited-2') return send('text/html', `<html><head><title>Another story</title><meta property="og:image" content="${base}/img/other.jpg"></head><body>Photo: Harbor Times</body></html>`);
    // a watched site with a news feed
    if (q.url === '/') return send('text/html', `<html><head><link rel="alternate" type="application/rss+xml" href="${base}/feed.xml"></head><body>Home</body></html>`);
    if (q.url === '/feed.xml') return send('application/rss+xml', `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>Watched</title>
      <item><title>New story</title><link>${base}/2026/new-story</link><media:content url="${base}/img/third.jpg" medium="image"/></item>
      <item><title>Plain story</title><link>${base}/2026/plain</link><description>No picture here</description></item></channel></rss>`);
    if (q.url === '/2026/plain') return send('text/html', `<html><head><meta property="og:image" content="${base}/img/other.jpg"></head></html>`);
    // a site to read for "Who's behind this site"
    if (q.url === '/terms') return send('text/html', '<html><body><h1>Terms</h1><p>This website is operated by Metro Daily Media LLC, a company in Ohio. Metro Daily is a brand of ours.</p><footer>© 2026 Metro Daily</footer></body></html>');
    if (q.url.startsWith('/img/')) return send('image/jpeg', Buffer.from(pics[q.url.slice(5).replace('.jpg', '')]));
    r.writeHead(404); r.end();
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + srv.address().port;

  // ---- 1 Credit search
  const cr = await page.evaluate(async base => {
    globalThis.PP_CREDIT_URL = q => base + '/search?q=' + encodeURIComponent(q);
    const cfg = await PP_WATCH.creditCfg();
    const words = PP_WATCH.wordsFor(cfg, 'Harbor Times');
    for (let i = 0; i < 4; i++) await PP_WATCH.creditStep({ force: true, client: 'Harbor Times', words: words[0] });
    const s = await PP_WATCH.creditState();
    const found = (await FC.allCopies()).filter(c => c.via === 'credit').map(c => c.url.replace(base, '') + ' ' + c.photo.split('/').pop());
    return { words, found, nomatch: s.nomatch.map(n => n.url.replace(base, '')), queue: s.queue.length, log: s.log.length };
  }, base);
  ok(cr.words.join('|') === '"Photo: Harbor Times"|"Photo by Harbor Times"|"Credit: Harbor Times"', 'the usual wordings are made from the client name: ' + cr.words.join(' · '));
  ok(cr.found.length === 1 && cr.found[0] === '/credited-1 a.jpg', 'a credited page showing the client\'s photo goes to New, tagged credit: ' + cr.found.join(', '));
  ok(cr.nomatch.includes('/credited-2') && cr.queue === 0 && cr.log >= 1, 'a credited page with none of their photos is listed to look at by hand; Google\'s own links are skipped: ' + JSON.stringify(cr));
  const rb = await page.evaluate(async () => { await PP_WATCH.creditStep({ force: true, client: 'Harbor Times', words: 'robot' }); const r = (await chrome.storage.local.get('fcRest')).fcRest || {}; const again = await PP_WATCH.creditStep({ client: 'Harbor Times', words: 'x' }); return { rest: (r.google || 0) > Date.now(), again }; });
  ok(rb.rest && rb.again === false, 'a robot check makes Google rest for an hour, and no more credit searches run meanwhile');
  await page.evaluate(() => chrome.storage.local.set({ fcRest: {} }));
  await page.goto(url('app.html#credit')); await page.waitForTimeout(1500);
  const cp = await page.evaluate(() => document.body.innerText);
  ok(/Credit search/.test(cp) && /Harbor Times/.test(cp) && /show none of their photos/.test(cp) && /Another story/.test(cp), 'the Credit search page shows clients, wordings and pages with no match' + '');

  // ---- 2 Watching
  const wl = await page.evaluate(async () => (await PP_WATCH.watchList()).map(x => x.key + ':' + x.stolen));
  ok(wl.length === 1 && wl[0] === 's:watched-example.com:2', 'a site with 2 Stolen copies is watched by itself (1 Stolen copy is not): ' + wl.join(', '));
  const wt = await page.evaluate(async base => {
    globalThis.PP_WATCH_HOME = () => base;
    for (let i = 0; i < 4; i++) await PP_WATCH.watchStep({ fast: true });
    const it = (await PP_WATCH.watchList())[0];
    const found = (await FC.allCopies()).filter(c => c.via === 'watch').map(c => c.url.replace(base, '') + ' ' + c.photo.split('/').pop());
    await PP_WATCH.watchNow(it.key);
    await PP_WATCH.watchStep({ fast: true });
    const it2 = (await PP_WATCH.watchList())[0];
    return { feed: it.feed.replace(base, ''), newPosts: it.newPosts, found, seen: it.seen.length, again: it2.newPosts, pend: (it2.pend || []).length };
  }, base);
  ok(wt.feed === '/feed.xml' && wt.newPosts === 2, 'the site\'s news feed is found from its home page and its new posts are read: ' + JSON.stringify(wt));
  ok(wt.found.length === 1 && wt.found[0] === '/2026/new-story c.jpg', 'a new post with any client\'s photo goes to New, tagged watch list: ' + wt.found.join(', '));
  ok(wt.again === 0 && wt.pend === 0, 'the next check reads only posts it has not seen before (none)');
  const wa = await page.evaluate(async () => { const a = await PP_WATCH.watchAdd('https://www.instagram.com/some.shop.example/'); const b = await PP_WATCH.watchAdd('another-example.com'); await PP_WATCH.watchOff('s:watched-example.com', true); return { a: a && a.key, b: b && b.key, list: (await PP_WATCH.watchList()).map(x => x.key + (x.off ? ' off' : '')) }; });
  ok(wa.a === 'a:instagram.com/some.shop.example' || /^a:/.test(wa.a || ''), 'an Instagram account can be added by hand: ' + wa.a);
  ok(wa.list.includes('s:another-example.com') && wa.list.includes('s:watched-example.com off'), 'a site can be added by hand, and a watched site switched off: ' + wa.list.join(', '));
  await page.goto(url('app.html#watching')); await page.waitForTimeout(1500);
  ok(/Watching/.test(await page.evaluate(() => document.body.innerText)) && /watched-example\.com/.test(await page.evaluate(() => document.body.innerText)), 'the Watching page lists them');

  // ---- 3 Registrations
  await page.goto(url('app.html#regs')); await page.waitForTimeout(2000);
  const rg = await page.evaluate(() => document.body.innerText);
  ok(/Not registered \(1\)/.test(rg) && /Applied, no VA yet \(1\)/.test(rg) && /a\.jpg/.test(rg), 'Registrations: one photo with no number, one with only an application number');
  await page.fill('input[data-act="regset"]', 'VA 2-500-001'); await page.press('input[data-act="regset"]', 'Tab'); await page.waitForTimeout(1200);
  const rg2 = await page.evaluate(() => document.body.innerText);
  ok(/Not registered \(0\)/.test(rg2) && /Registered lately \(1\)/.test(rg2), 'typing the VA number moves it to Registered lately');

  // ---- 5 Find the company
  const lk = await page.evaluate(async base => { globalThis.PP_LOOKUP_HOME = () => base; const f = await FC.lookup('newsblog-example.com', ''); return { names: f.names, from: f.nameFrom, terms: f.terms }; }, base);
  ok(lk.names.includes('Metro Daily Media LLC') && lk.from['Metro Daily Media LLC'] === 'Terms of service', 'the Terms page is read and "operated by … LLC" gives the company: ' + JSON.stringify(lk));
  await page.goto(url('app.html#who?site=newsblog-example.com')); await page.waitForTimeout(2000);
  const wh = await page.evaluate(() => document.body.innerText);
  ok(/Step 1 · Names it goes by/i.test(wh) && /Metro Daily Media LLC/.test(wh) && /Step 2 · Brand to company/i.test(wh) && /Delaware business search \(always last\)/i.test(wh) && /The company behind newsblog-example\.com/i.test(wh), 'Who\'s behind this site shows the names, the 3-step checklist and the company card' + '');
  await page.click('[data-act="entuse"][data-v*="Metro Daily Media LLC"]'); await page.waitForTimeout(800);
  await page.selectOption('select[data-v="newsblog-example.com|state"]', 'Ohio'); await page.waitForTimeout(800);
  await page.click('[data-act="entstatus"][data-v="newsblog-example.com|Seemingly viable"]'); await page.waitForTimeout(800);
  const ent = await page.evaluate(async () => (await FC.meta.get('entities'))['newsblog-example.com']);
  ok(ent && ent.entity === 'Metro Daily Media LLC' && ent.state === 'Ohio' && ent.status === 'Seemingly viable' && ent.nameType === 'Company name', 'the company card saves the entity, state and status: ' + JSON.stringify(ent));
  await page.goto(url('app.html#found?filter=All')); await page.waitForTimeout(3000);
  const fd = await page.evaluate(() => document.body.innerText);
  ok(/✓ Seemingly viable/.test(fd) && /Found by credit search/.test(fd), 'copies show the company status and how they were found');
  const legal = await page.evaluate(async () => { const c = (await FC.allCopies()).find(x => x.site === 'watched-example.com' && x.status === 'stolen'); return ppEntLegal(c); });
  ok(legal && legal[0] === false && /not found yet/.test(legal[1]), 'Ready for legal asks for the company on a site with none yet');
  await page.evaluate(async () => { const all = await FC.meta.get('entities'); all['watched-example.com'] = { status: 'Not a viable entity' }; await FC.meta.set('entities', all); await entsLoad(); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(500); await page.goto(url('app.html#found?filter=All')); await page.waitForTimeout(3000);
  const order = await page.evaluate(() => [...document.querySelectorAll('.crow .l1 b')].map(b => b.textContent));
  ok(order.length && order[order.length - 1] === 'watched-example.com', 'copies on a "Not a viable entity" site go to the bottom: ' + order.join(', '));

  // backup carries the new settings
  const bk = await page.evaluate(async () => { const s = await FC.settingsSnapshot(); return { e: Object.keys(s.entities || {}).length, w: (s.watch || []).length }; });
  ok(bk.e === 2 && bk.w >= 2, 'the settings backup keeps company cards and the watch list you set: ' + JSON.stringify(bk));

  srv.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await ctx.close();
  process.exit(fails ? 1 : 0);
})();
