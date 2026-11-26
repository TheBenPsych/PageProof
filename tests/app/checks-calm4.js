// The calm look, step 4: Keep searching. Four tabs instead of one long page: Now (what is being
// searched, what is next, the search sites and social sites, the last searches), Progress,
// Clients and Settings. Every switch still saves the same setting as before.
process.env.NP = process.env.NP || '3000'; process.env.NC = process.env.NC || '600';
const { start } = require('./h.js'); const { seed } = require('./seed.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(1200);
  await seed(page);
  await page.evaluate(async () => {
    const now = Date.now(), H = 3600000, day = new Date().toDateString();
    const px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    await FC.setKeep({ on: true, pace: 'Faster', hours: 'all' });
    const days = {}; for (let i = 6; i >= 0; i--) { const d = new Date(now - i * 864e5); days[d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')] = { full: 500 + i, first: 100, quick: 900 + i, found: i }; }
    const rec = [2, 0, 0, 1, 0, 0, 0].map((fresh, i) => ({ at: now - i * 61000, id: 'p' + i, name: 'photo-' + (i + 1) + '.jpg', client: 'Client ' + (i + 1), eng: [i % 2 ? 'bing' : 'google'], fresh, links: i === 6 ? 0 : 3, quick: i % 2, thumb: px }));
    await chrome.storage.local.set({ ppTheme: 'light', fcStatus: { beat: now + 600000, state: 'running', text: 'Searching', current: { id: 'x', name: 'now-photo.jpg', sub: 'Client 3 · on Google Lens, Yandex', thumb: px } },
      fcToday: { day, searched: 41, found: 6, quick: 88, eng: { google: 41, yandex: 31, bing: 57 } }, fcRest: { yandex: now + 40 * 60000 }, fcLadder: { g: { step: 2 }, f: { step: 1 } }, fcDays: days, fcRecent: rec,
      ppSiteRest: { 'instagram.com': { until: now + 2 * H, restAt: now - 20 * 60000, strikes: 2, day, n: 212 }, 'facebook.com': { day, n: 118 } } });
  });
  const tabIs = t => page.waitForFunction(x => (document.querySelector('.kpn') || { dataset: {} }).dataset.tab === x, t, { timeout: 60000 });
  await page.goto(url('app.html#keep')); await tabIs('now'); await page.waitForSelector('.knext .knr', { timeout: 30000 }); await page.waitForTimeout(800);

  // ---- Now
  const n = await page.evaluate(() => {
    const q = s => document.querySelector(s), all = s => [...document.querySelectorAll(s)], t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
    const head = q('#view .head');
    return {
      title: t(head.querySelector('h1')), lede: !!head.querySelector('.lede'),
      tabs: all('.kctl .utabs button').map(t), on: all('.kctl .utabs button.on').map(t).join(),
      ctl: ['.utabs', '[data-act="keepon"]', '[data-act="keeppause"]', '[data-act="keepshow"]'].map(s => { const e = q('.kctl ' + s); return e ? Math.round(e.getBoundingClientRect().top) : -1; }),
      hero: t(q('#keepNow .khm')), big: !!q('#keepNow img.kbig'), next: all('.knext .knr').map(r => t(r.querySelector('.kwhy'))),
      eng: all('#keepSites .ksr.e').map(t), soc: all('#keepSites .ksr.s').map(t), more: t(q('#keepSites .kscol + .kscol .kh2')),
      tiles: all('#keepTiles .kt2').map(x => t(x.querySelector('b')) + ' ' + t(x.querySelector('.l'))),
      rec: all('#keepRecent .krr').map(t), recPics: all('#keepRecent .krr img').length,
      fifty: t(q('#keepFifty')), fiftyBtn: !!q('#keepFifty [data-act="fifty"]'), extras: all('#keepExtras .kxr').map(x => t(x.querySelector('b'))),
      old: !!q('.know') || !!q('.keeplive') || !!q('#firstBox') || !!q('#ladderBox'),
    };
  });
  ok(/Copies found ?› ?Keep searching$/.test(n.title) && !n.lede, 'The title is "Copies found › Keep searching" with no sentence under it (' + n.title + ')');
  ok(n.tabs.length === 4 && /^Now$/.test(n.tabs[0]) && n.tabs[1] === 'Progress' && /^Clients \d+$/.test(n.tabs[2]) && n.tabs[3] === 'Settings' && n.on === 'Now', 'Four tabs: Now, Progress, Clients (with how many) and Settings (' + n.tabs.join(', ') + ')');
  ok(n.ctl.every(y => y > 0) && Math.max(...n.ctl) - Math.min(...n.ctl) <= 24, 'The On switch, Pause and Show search window sit on the tab line (' + n.ctl.join(', ') + ')');
  ok(/Searching now/.test(n.hero) && /now-photo\.jpg/.test(n.hero) && /Client 3/.test(n.hero) && /Google Lens, Yandex/.test(n.hero) && /Speed step 3 of 4/.test(n.hero) && n.big, 'Searching now: the photo, its name, its client, the search sites and the speed step');
  ok(n.next.length === 5 && n.next.every(w => w.length > 3), 'Up next lists the next 5 photos, each with why it is next (' + n.next.join(', ') + ')');
  ok(n.eng.length === 3 && /Google Lens.*Working.*41 today/.test(n.eng[0]) && /Yandex.*are you a robot.*Rests until.*31 today/.test(n.eng[1]) && /Bing.*Working.*57 today/.test(n.eng[2]), 'Search sites: a light, a rest time and today\'s count for Google Lens, Yandex and Bing');
  ok(n.soc.length === 4 && /Instagram.*too many requests.*Cooling down until.*212 of 300 today/.test(n.soc[0]) && /Facebook.*1 page every 20 s.*Working.*118 of 400 today/.test(n.soc[1]) && /5 more working/.test(n.more), 'Social media: the pace, today\'s count out of the daily limit, and "Cooling down until" after too many requests');
  ok(n.tiles.length === 4 && /^41 Photos searched today/.test(n.tiles[0]) && /^6 New copies today/.test(n.tiles[1]) && /Photos a day at this speed/.test(n.tiles[2]) && /% Every photo searched once/.test(n.tiles[3]), 'Four number tiles (' + n.tiles.join(' | ') + ')');
  ok(n.rec.length === 7 && n.recPics === 7 && /photo-1\.jpg.*Client 1.*Google Lens.*2 new copies/.test(n.rec[0]) && /Bing · quick look.*Only copies seen before/.test(n.rec[1]) && /Nothing found/.test(n.rec[6]), 'Last searches: time, photo, client, search site and what it found');
  ok(/Today's 50/.test(n.fifty) && /Check 50 now/.test(n.fifty) && n.fiftyBtn && n.extras.join() === 'Sweeps of stolen sites,Credit search,Watching', 'Today\'s 50 card and the three Extra searches rows');
  ok(!n.old, 'The old long page is gone from the Now tab');

  // A real search fills the list and the per-site counts.
  const ing = await page.evaluate(async () => {
    const p = (await FC.DB.all('photos')).find(x => !x.gone && !x.doubleOf);
    await FC.ingest({ fcId: p.id, name: p.name, hash: p.hash, thumb: 'data:image/png;base64,AAAA' }, [], 'Keep searching', { engines: ['google', 'bing'] });
    const s = await chrome.storage.local.get(['fcRecent', 'fcToday']);
    return { top: s.fcRecent[0], n: s.fcRecent.length, eng: s.fcToday.eng, name: p.name };
  });
  ok(ing.top.name === ing.name && ing.top.eng.join() === 'google,bing' && ing.top.fresh === 0 && ing.n === 8 && ing.eng.google === 42 && ing.eng.bing === 58 && ing.eng.yandex === 31, 'A finished search goes on top of Last searches (8 kept) and adds to each search site\'s count for today');

  // ---- Progress
  await page.click('.kctl [data-act="keeptab"][data-v="progress"]'); await tabIs('progress'); await page.waitForTimeout(500);
  const p = await page.evaluate(() => {
    const q = s => document.querySelector(s), all = s => [...document.querySelectorAll(s)], t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
    return { hash: location.hash, first: t(q('#firstBox')), ring: !!q('#firstBox .kring2 svg'), lanes: all('#firstBox .klane').length, minis: all('#firstBox .kmini').length, rings: all('#keepFresh .kgr .kring2').length,
      share: all('#keepShare .sharebar').length, order: all('#keepOrder li').length, days: all('#keepWeek .kday').map(d => t(d.querySelector('.kd'))), bars: all('#keepWeek .kbars span').length, top: scrollY };
  });
  ok(p.hash === '#keep?tab=progress' && p.top === 0, 'A tab keeps its own address, so a reload opens the same tab (' + p.hash + ')');
  ok(/Every photo searched once/.test(p.first) && /photos searched at least once/.test(p.first) && p.ring && p.lanes === 2 && p.minis === 4 && /No goal date set/.test(p.first), 'Progress: the big ring, the Google and Quick look bars, the goal line and four small boxes');
  ok(p.rings === 4 && p.share === 2 && p.order === 6, 'Progress: four Kept up to date rings, how the searches are shared, and which photos go first');
  ok(p.days.length === 7 && p.days[6] === 'Today' && p.bars === 14, 'Progress: the last 7 days as a chart (' + p.days.join(', ') + ')');

  // ---- Clients
  await page.click('.kctl [data-act="keeptab"][data-v="clients"]'); await tabIs('clients'); await page.waitForTimeout(500);
  const c0 = await page.evaluate(() => ({ rows: document.querySelectorAll('#firstClients .kcr').length, head: [...document.querySelectorAll('#firstClients .kch span')].map(s => s.textContent).filter(Boolean).join('|'), tab: +document.querySelector('.kctl .utabs button.on span').textContent, first: document.querySelector('#firstClients .kcr .kcn b').textContent }));
  ok(c0.rows > 3 && c0.rows === c0.tab && c0.head === "Client|Searched once|Never searched|Can't search|Done by", 'Clients: every client on one list (' + c0.rows + '), with searched once, never searched, can\'t search and done by');
  await page.fill('#keepQ', c0.first.slice(0, 8).toLowerCase()); await page.waitForTimeout(300);
  const c1 = await page.evaluate(() => ({ shown: [...document.querySelectorAll('#firstClients .kcr')].filter(r => !r.hidden).length, focus: document.activeElement.id }));
  ok(c1.shown >= 1 && c1.shown < c0.rows && c1.focus === 'keepQ', 'Find a client narrows the list while you type (' + c1.shown + ' of ' + c0.rows + ')');
  await page.fill('#keepQ', ''); await page.click('[data-act="keepcf"][data-v="pri"]'); await page.waitForTimeout(600);
  const c2 = await page.evaluate(() => ({ rows: document.querySelectorAll('#firstClients .kcr').length, stars: document.querySelectorAll('#firstClients .kcr .kstar').length }));
  ok(c2.rows >= 1 && c2.rows === c2.stars && c2.rows < c0.rows, '★ Priority shows only priority clients (' + c2.rows + ')');
  await page.click('[data-act="keepcf"][data-v="all"]'); await page.waitForTimeout(400);
  await page.selectOption('[data-act="keepsort"]', 'name'); await page.waitForTimeout(600);
  const names = await page.evaluate(() => [...document.querySelectorAll('#firstClients .kcr .kcn b')].map(b => b.textContent));
  ok(names.join('|') === [...names].sort((a, b) => a.localeCompare(b)).join('|'), 'Clients can be sorted by name');

  // ---- Settings
  await page.click('.kctl [data-act="keeptab"][data-v="settings"]'); await tabIs('settings'); await page.waitForTimeout(500);
  const s = await page.evaluate(() => ({ groups: [...document.querySelectorAll('.kset .kgh')].map(g => g.textContent).join('|'), rows: document.querySelectorAll('.kset .ksr2').length, ladder: !!document.getElementById('ladderBox'), eng: document.querySelectorAll('#keepEngines [data-act="keepeng"]').length,
    rowH: Math.min(...[...document.querySelectorAll('.kset .ksr2')].map(r => r.getBoundingClientRect().height)) }));
  ok(s.groups === "Speed|When|Search sites|Where and what|Today's 50" && s.rows >= 12 && s.ladder && s.eng === 3 && s.rowH >= 72, 'Settings: rows grouped like Windows Settings (' + s.groups + '), each at least 72 px tall');
  await page.click('[data-act="keepset"][data-v="pace|Steady"]'); await page.waitForTimeout(600);
  ok(await page.evaluate(async () => (await FC.keep()).pace === 'Steady' && !document.getElementById('ladderBox')), 'Pace saves, and the speed ladder row only shows on Faster');
  await page.click('#keepEngines [data-act="keepeng"][data-v="yandex"]'); await page.waitForTimeout(600);
  await page.click('#keepEngines [data-act="keepeng"][data-v="bing"]'); await page.waitForTimeout(600);
  await page.click('#keepEngines [data-act="keepeng"][data-v="google"]'); await page.waitForTimeout(800);
  const e = await page.evaluate(async () => ({ eng: (await chrome.storage.local.get('rsSettings')).rsSettings.engines, on: [...document.querySelectorAll('#keepEngines [data-act="keepeng"]')].map(i => i.checked).join() }));
  ok(e.eng.yandex === false && e.eng.bing === false && e.eng.google === true && e.on === 'true,false,false', 'A search site can be switched off, and the last one always stays on');
  await page.evaluate(() => chrome.storage.local.set({ rsSettings: { engines: { google: true, yandex: true, bing: true } } }));
  await page.reload(); await tabIs('settings');
  ok(true, 'After a reload the Settings tab is still open');

  // ---- stopped and off
  await page.evaluate(() => chrome.storage.local.set({ fcStatus: { state: 'closed', beat: 0 } }));
  await page.goto(url('app.html#keep')); await tabIs('now'); await page.waitForTimeout(800);
  ok(await page.evaluate(() => /Keep searching is stopped/.test((document.querySelector('.kbar.warn') || {}).textContent || '') && !!document.querySelector('.kbar.warn [data-act="keepshow"]')), 'Stopped: one calm info bar with Start it again');
  await page.evaluate(() => FC.setKeep({ on: false })); await page.reload(); await tabIs('now'); await page.waitForTimeout(600);
  const off = await page.evaluate(() => ({ hero: document.querySelector('#keepNow .khm').textContent, pause: !!document.querySelector('.kctl [data-act="keeppause"]'), sw: document.querySelector('.kctl [data-act="keepon"]').checked, lab: document.getElementById('keepState').textContent }));
  ok(/Keep searching is off/.test(off.hero) && !off.pause && !off.sw && off.lab === 'Off', 'Off: the card says so, and Pause and Show search window are put away');

  // ---- dark
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'dark' })); await page.waitForTimeout(900);
  await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
  const d = await page.evaluate(() => ({ card: getComputedStyle(document.querySelector('#keepNow')).backgroundColor, ink: getComputedStyle(document.querySelector('#keepNow h2')).color }));
  ok(d.card === 'rgb(43, 43, 43)' && d.ink === 'rgb(255, 255, 255)', `Dark: grey cards and white words (${d.card}, ${d.ink})`);
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
