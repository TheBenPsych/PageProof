// 4.44 Home and evidence release (mechanics review, Ben's picks): Home opens instantly (a kept
// summary), "Look at these first" (strong claims), "Since you were last here", clients falling
// behind, and who's behind it captured into the same evidence pack. Made-up sites only.
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
  await page.evaluate(async ({ d1, d12, h2 }) => {
    await chrome.storage.local.set({ ppSetupDone: true, ppTourDone: true, ppSeenVersion: chrome.runtime.getManifest().version, ppReconnectVer: chrome.runtime.getManifest().version,
      ppCheckup: { ver: chrome.runtime.getManifest().version, at: Date.now(), items: [], ok: true, seen: true }, fcDrive: { label: 'G:\\Shared drives\\Photos', done: true } });
    await FC.DB.put('clients', { name: 'Harbor Times', searching: true, priority: true, licensed: [], photos: 3, lastSearched: d12, rel: 'Harbor Times' });
    await FC.DB.put('clients', { name: 'Lakeside Weekly', searching: false, priority: true, licensed: [], photos: 2, rel: 'Lakeside Weekly' });
    const P = n => ({ id: 'd:Harbor Times/2026/Q4/' + n, client: 'Harbor Times', name: n, rel: 'Harbor Times/2026/Q4/' + n, folder: 'x', year: 2026, quarter: 4, flag: '', searches: 1, empty: 0, copies: 1, stolen: 0, added: 1 });
    await FC.DB.putMany('photos', [P('a.jpg'), P('b.jpg'), P('c.jpg')]);
    const C = (photo, site, extra) => ({ id: 'd:Harbor Times/2026/Q4/' + photo + '|' + site + '/s', photo: 'd:Harbor Times/2026/Q4/' + photo, client: 'Harbor Times', url: 'https://' + site + '/s', key: site + '/s', pk: site + '/s', site, title: '', thumb: '', img: '', engines: [], pct: 95, match: 'same', firstSeen: d1, lastSeen: d1, times: 1, status: 'new', online: 'up', use: 'copied', ...extra });
    await FC.DB.putMany('copies', [
      C('a.jpg', 'thief-example.com', { status: 'stolen', answered: d1, packAt: d1 }),
      C('b.jpg', 'thief-example.com', { firstSeen: h2 }),                       // same photo on a site stolen from before: strong
      C('c.jpg', 'shop-example.com', { use: 'shop', url: 'https://shop-example.com/product/12', firstSeen: h2 }),            // a shop: strong
      C('a.jpg', 'blog-example.com', { match: 'maybe', pct: 60 }),               // weak match: not strong
      C('b.jpg', 'news-example.com', {}),                                        // plain copy: not strong
    ]);
    FC.touch('copies');
    await chrome.storage.local.set({ ppLastHome: Date.now() - 5 * 3600000, ppSince: null, ppHomeSum: null });
  }, { d1: day(1), d12: day(12), h2: new Date(Date.now() - 2 * 3600000).toISOString() });

  // ---- Home: strong claims, since you were last here, falling behind
  await page.goto(url('app.html#home')); await page.waitForTimeout(4500);
  const h = await page.evaluate(() => ({ strong: (document.getElementById('jobStrong') || {}).textContent || '', nw: (document.getElementById('jobNew') || {}).textContent || '', since: (document.getElementById('jobSince') || {}).textContent || '', behind: (document.getElementById('jobBehind') || {}).textContent || '' }));
  ok(/2 copies look like a strong claim/.test(h.strong), 'Home puts the 2 strong claims first: ' + h.strong.replace(/\s+/g, ' ').slice(0, 90));
  ok(/2 other new copies to answer/.test(h.nw), 'the other new copies are a line of their own: ' + h.nw.replace(/\s+/g, ' ').slice(0, 60));
  ok(/Since you were last here/.test(h.since) && /2 new copies found, 1 on sites you marked Stolen before/.test(h.since), 'after 5 hours away, Home says what changed: ' + h.since.replace(/\s+/g, ' ').slice(0, 140));
  ok(/2 ★ priority clients are falling behind/.test(h.behind) && /not searched for 12 days/.test(h.behind) && /switched off/.test(h.behind), 'priority clients falling behind are named with the reason: ' + h.behind.replace(/\s+/g, ' ').slice(0, 160));
  await page.click('#jobSince [data-act="sinceok"]'); await page.waitForTimeout(1200);
  ok(!(await page.$('#jobSince')), 'OK puts the "since you were last here" card away');

  // ---- Home opens instantly: the summary is kept, and redone only when something changes
  const sm = await page.evaluate(async () => {
    const a = (await chrome.storage.local.get('ppHomeSum')).ppHomeSum;
    const b = await homeSum();
    await FC.DB.put('copies', { id: 'x|y', photo: 'd:Harbor Times/2026/Q4/c.jpg', client: 'Harbor Times', url: 'https://other-example.com/y', key: 'other-example.com/y', site: 'other-example.com', firstSeen: new Date().toISOString(), status: 'new', match: 'maybe', pct: 40 });
    FC.touch('copies'); await new Promise(r => setTimeout(r, 300));
    const c = await homeSum();
    return { same: a && b && a.at === b.at, n1: b.nNew, n2: c.nNew, redone: c.at !== b.at };
  });
  ok(sm.same, 'opening Home again uses the kept summary (no copies read)');
  ok(sm.redone && sm.n2 === sm.n1 + 1, 'a new copy makes the summary be worked out again');

  // ---- Look at these first: the filter on Copies found
  await page.goto(url('app.html#found?strong=1')); await page.waitForTimeout(3000);
  const f = await page.evaluate(() => ({ rows: [...document.querySelectorAll('.crow')].map(r => (r.querySelector('.l1 b') || {}).textContent), tag: document.body.innerText.includes('Strong claims') }));
  ok(f.tag && f.rows.length === 2 && f.rows.includes('thief-example.com') && f.rows.includes('shop-example.com'), 'Look at these first shows only the strong claims: ' + f.rows.join(', '));

  // ---- Who's behind it: the links on the captured page, and capturing them into the pack
  let base = '';
  const srv = http.createServer((q, r) => {
    r.writeHead(200, { 'content-type': 'text/html' });
    if (q.url === '/about-us') return r.end('<html><body style="background:#cde"><h1>About Example News</h1><p>Owned by Example Media LLC.</p></body></html>');
    r.end('<html><body><h1>Story</h1><a href="/about-us">About us</a> <a href="/contact">Contact</a> <a href="/privacy-policy">Privacy</a> <a href="https://elsewhere.com/about">Other</a></body></html>');
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + srv.address().port;
  const v = await ctx.newPage();
  await v.goto(url('viewer.html')); await v.waitForTimeout(800);
  const links = await v.evaluate(base => ({
    site: whoLinks({ url: base + '/story', html: '<a href="/about-us">About us</a> <a href="/contact">Contact</a> <a href="/privacy-policy">Privacy</a> <a href="https://elsewhere.com/about">Other</a>' }).map(w => w.kind + (w.on ? '+' : '-') + ' ' + w.url.replace(base, '')),
    soc: whoLinks({ url: 'https://x.com/sample_account/status/123', html: '' }).map(w => w.kind + ' ' + w.url),
  }), base);
  ok(links.site.join(',') === 'about+ /about-us,contact+ /contact,privacy- /privacy-policy', 'a website gives its About and Contact pages (ticked) and Privacy (not ticked): ' + links.site.join(', '));
  ok(links.soc.length === 1 && /x\.com\/sample_account$/.test(links.soc[0]), 'a social post gives the account\'s profile page: ' + links.soc.join(', '));
  const w = await v.evaluate(async base => {
    const r = await chrome.runtime.sendMessage({ type: 'captureWho', list: [['about', base + '/about-us']] });
    const g = r && r.pages && r.pages[0];
    const wr = g && g.id ? await PP_DB.get(g.id) : null;
    const pdf = wr ? await whoPdf(wr) : null;
    const log = (await chrome.storage.local.get('log')).log || [];
    return { ok: r && r.ok, err: g && g.error, who: wr && wr.who, pdf: pdf ? pdf.size : 0, inLog: log.some(e => g && e.id === g.id) };
  }, base);
  ok(w.ok && w.who === 'about' && w.pdf > 1000, 'the About page is captured like any page and becomes its own PDF: ' + JSON.stringify(w));
  ok(!w.inLog, 'it is not listed as a capture of its own (it belongs to the main pack)');
  // The whole flow on the capture page: capture the story, add its About and Contact pages, save.
  const sw = ctx.serviceWorkers()[0];
  const site = await ctx.newPage(); await site.goto(base + '/story'); await site.waitForTimeout(900); await site.bringToFront();
  const [cv] = await Promise.all([
    ctx.waitForEvent('page', { predicate: x => x.url().includes('viewer.html?id'), timeout: 120000 }),
    sw.evaluate(async () => { const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); startCapture(t); }),
  ]);
  cv.on('pageerror', e => { fails++; console.log('PAGEERROR viewer', String(e).slice(0, 300)); });
  await cv.waitForSelector('#pack');
  await cv.waitForFunction(() => !document.getElementById('pack').disabled, null, { timeout: 180000 });
  const box = await cv.evaluate(() => ({ shown: !document.getElementById('whoBox').hidden, rows: [...document.querySelectorAll('#whoList .whorow')].map(r => r.textContent.trim() + (r.querySelector('input').checked ? ' ✓' : '')) }));
  ok(box.shown && box.rows.includes('About page ✓') && box.rows.includes('Contact page ✓'), 'the capture page offers Who\'s behind it: ' + box.rows.join(', '));
  await cv.click('#whoAdd');
  await cv.waitForFunction(() => /Added|Try again/.test(document.getElementById('whoAdd').textContent), null, { timeout: 240000 });
  const after = await cv.evaluate(() => ({ note: document.getElementById('whoNote').textContent, details: document.getElementById('details').textContent }));
  ok(/Added to this pack: About page, Contact page/.test(after.note) && /who\/about\.pdf/.test(after.details) && /who\/contact\.pdf/.test(after.details), 'both pages go into the pack and its fingerprints: ' + after.note.slice(0, 120));
  await cv.fill('#caseRef', 'CASE-0002'); await cv.fill('#collector', 'Tester');
  const dl = cv.waitForEvent('download', { timeout: 30000 }).catch(() => null);
  await cv.click('#pack'); await cv.waitForTimeout(600);
  if (await cv.evaluate(() => !document.getElementById('checkBox').hidden)) await cv.click('#ckAnyway');      // the made-up story page is short
  const d = await dl;
  const zip = d ? require('fs').readFileSync(await d.path()) : Buffer.alloc(0);
  ok(zip.includes('who/about.pdf') && zip.includes('who/contact.pdf') && zip.includes('README.txt'), 'the saved evidence pack holds who/about.pdf and who/contact.pdf' + (d ? '' : ' (no download: ' + await cv.evaluate(() => document.getElementById('checkBox').textContent + ' | ' + document.getElementById('status').textContent) + ')'));
  await cv.close(); await site.close();
  const rd = await v.evaluate(() => ppReadme({ captureId: 'PP-TEST', version: '1', url: 'https://site.com', time: new Date().toISOString(), base: 'x', stamps: [], notes: [], who: [{ label: 'About page', name: 'who/about.pdf' }] }));
  ok(/who\//.test(rd) && /About page \(about\.pdf\)/.test(rd), 'README explains the who/ folder');
  srv.close();

  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await ctx.close();
  process.exit(fails ? 1 : 0);
})();
