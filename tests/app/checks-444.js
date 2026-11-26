// 4.45 Home and evidence release (mechanics review, Ben's picks): Home opens instantly (a kept
// summary), "Look at these first" (strong claims), "Since you were last here", clients falling
// behind, (the who's-behind-it box was removed later). Made-up sites only.
const { start } = require('./h.js');
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
  ok(/While you were away/.test(h.since) && /things? happened since/.test(h.since) && !/2 new copies found/.test(h.since), 'after 5 hours away, Home has a folded "While you were away" line: ' + h.since.replace(/\s+/g, ' ').slice(0, 100));
  await page.click('#jobSince [data-act="sinceshow"]'); await page.waitForTimeout(1500);
  h.since = await page.evaluate(() => (document.getElementById('jobSince') || {}).textContent || '');
  ok(/2 new copies found, 1 on sites you marked Stolen before/.test(h.since), 'after 5 hours away, Home says what changed: ' + h.since.replace(/\s+/g, ' ').slice(0, 140));
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
  const f = await page.evaluate(() => ({ rows: [...document.querySelectorAll('.crow:not(.calmhdr)')].map(r => (r.querySelector('.l1 b') || {}).textContent), tag: document.body.innerText.includes('Strong claims') }));
  ok(f.tag && f.rows.length === 2 && f.rows.includes('thief-example.com') && f.rows.includes('shop-example.com'), 'Look at these first shows only the strong claims: ' + f.rows.join(', '));

  // ---- Who's behind it box: removed (Ben: not useful). The capture page has no box for it.
  const v = await ctx.newPage();
  await v.goto(url('viewer.html')); await v.waitForTimeout(800);
  const gone = await v.evaluate(() => ({ box: !!document.getElementById('whoBox'), fn: typeof whoOffer !== 'undefined' || typeof whoLinks !== 'undefined' }));
  ok(!gone.box && !gone.fn, 'the capture page has no Who\'s behind it box any more');
  await v.close();

  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await ctx.close();
  process.exit(fails ? 1 : 0);
})();
