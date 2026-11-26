// The calm look, step 7: Credit search. Three tabs (Overview, Clients, Credit but no photo), the
// live search card with Stop, the search sites, four tiles, last searches, wordings that find
// copies, the client panel (add and remove wordings), and changing the usual wordings for everyone.
process.env.NP = process.env.NP || '2000'; process.env.NC = process.env.NC || '30';
const { start } = require('./h.js'); const { seed } = require('./seed.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(1200);
  await seed(page);
  const N = await page.evaluate(async () => {
    const now = Date.now(), H = 3600000;
    await chrome.storage.local.set({ ppTheme: 'light', fcRest: { bing: now + 40 * 60000 } });
    await FC.setKeep({ on: true, hours: 'all' });
    const cl = (await FC.DB.all('clients')).filter(c => c.searching !== false).sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0) || a.name.localeCompare(b.name));
    const A = cl[0].name, B = cl[1].name, C = cl[2].name;
    const cfg = await PP_WATCH.creditCfg();
    cfg.on = true; cfg.usual = []; cfg.clients = { [A]: { words: ['"Photo: ' + A + '"', '"' + A + '/Harbor Times"'] }, [cl[4].name]: { on: false } };
    await PP_WATCH.setCreditCfg(cfg);
    const W1 = '"Photo: ' + A + '"', W2 = '"' + A + '/Harbor Times"';
    const s = { done: {}, queue: [], seen: {}, nomatch: [], log: [], found: 47, pages: 1284, lastSearch: now - 5 * 60000, wlog: [] };
    s.queue = Array.from({ length: 23 }, (_, i) => ({ url: 'https://q' + i + '.example/p', client: C, words: 'x' }));
    s.log = Array.from({ length: 9 }, (_, i) => ({ at: new Date(now - (i * 30 + 1) * H).toISOString(), client: i % 2 ? B : A, words: i % 2 ? '"Photo: ' + B + '"' : (i ? W2 : W1), links: 20, added: i === 2 ? 0 : i + 1, per: { google: 18 - i, bing: 11 }, both: 4 })).reverse();
    for (const l of s.log) s.done[l.client + '\n' + l.words] = Date.parse(l.at);
    const add = (k, f, n) => { for (let i = 0; i < f; i++) s.wlog.push([now - i * H, k, 'f']); for (let i = 0; i < n; i++) s.wlog.push([now - i * 2 * H, k, 'n']); };
    add(A + '\n' + W2, 9, 22); add(A + '\n' + W1, 5, 47); add(B + '\n"Photo: ' + B + '"', 0, 17);
    s.nomatch = [['City council votes on harbor plan', 'harbortimes-daily.example/council', A, W1, 2], ['Fire on Water Street', 'newsbreak.example/fire', A, W2, 11], ['Parade route for Saturday', 'patch.example/parade', B, '"Photo: ' + B + '"', 20]].reverse().map(([t, u, c, w, h]) => ({ url: 'https://' + u, title: t, client: c, words: w, at: new Date(now - h * H).toISOString(), pics: 3 }));
    await FC.meta.set('creditState', s);
    await chrome.storage.local.set({ fcCreditRun: { client: A, start: now - 3 * 60000, beat: now + 600000, phase: 'read', words: 2, wDone: 2, now: 'https://harbortimes-daily.example/2026/11/plan', links: 26, pages: 14, read: 6, found: 2, known: 0, failed: 0, nomatch: 1, per: { google: 18, bing: 13 }, both: 5, end: 0, why: '' } });
    return { A, B, C, off: cl[4].name, n: cl.length };
  });
  const go = async h => { await page.goto(url('app.html#' + h)); await page.evaluate(() => render(true)); await page.waitForSelector('.crn'); await page.waitForTimeout(500); };
  // ---- Overview
  await go('credit');
  let o = await page.evaluate(() => ({ h1: document.querySelector('.head h1').textContent, tabs: [...document.querySelectorAll('.utabs button')].map(b => b.textContent.replace(/\s+/g, ' ').trim()).join('|'), on: document.querySelector('.utabs .on').textContent.trim(),
    live: document.getElementById('creditLive').textContent.replace(/\s+/g, ' '), stop: !!document.querySelector('[data-act="creditstop"]'), ring: document.querySelector('#creditLive .kring2 b').textContent,
    sites: [...document.querySelectorAll('#creditSites .ksr')].map(r => r.textContent.replace(/\s+/g, ' ')), tiles: [...document.querySelectorAll('#creditTiles .kt2')].map(t => t.textContent.replace(/\s+/g, ' ').trim()),
    lastHead: document.querySelector('#creditLast .kh2').textContent, lastRows: document.querySelectorAll('#creditLast .clr').length, cols: document.querySelector('#creditLast .clh').textContent,
    best: [...document.querySelectorAll('#creditBest .cbr')].map(r => r.textContent.replace(/\s+/g, ' ').trim()), nm: document.querySelectorAll('#creditNmSmall .cnr').length, how: document.querySelectorAll('#creditHow .chs').length,
    lede: !!document.querySelector('.head .lede') && document.querySelector('.head .lede').textContent.length > 5, sw: document.querySelector('[data-act="crediton"]').checked }));
  ok(/Copies found\s*›\s*Credit search/.test(o.h1) && !o.lede, 'The title says where you are, with no long paragraph under it');
  ok(new RegExp('^Overview\\|Clients ' + N.n + '\\|Credit but no photo 3$').test(o.tabs) && o.on === 'Overview' && o.sw, 'Three tabs with counts, and the On switch on the tab line (' + o.tabs + ')');
  ok(/Searching now · started 3 min ago/.test(o.live) && o.live.includes('Searching ' + N.A + '\'s credit lines') && /2 of 2 wordings searched/.test(o.live) && /6 of 14 new pages read/.test(o.live) && /harbortimes-daily\.example/.test(o.live) && o.stop && o.ring === '50%', 'The live card shows the search: both steps, the page in hand, a ring and Stop (' + o.ring + ')');
  ok(o.sites.length === 3 && /Google.*Working/.test(o.sites[0]) && /Bing.*are you a robot.*Rests until/.test(o.sites[1]) && /Next weekly search.*every 15 min.*After the waiting pages/.test(o.sites[2]), 'Search sites: a light each, when Bing comes back, and the next weekly search');
  ok(o.tiles.length === 4 && /^47\s*Copies found by a credit/.test(o.tiles[0]) && /^1,284\s*Credited pages read\s*\d+ this week/.test(o.tiles[1]) && /^23\s*Pages waiting/.test(o.tiles[2]) && new RegExp('^' + (N.n - 1) + ' of ' + N.n + '\\s*Clients searched\\s*1 off · 1 with their own wordings').test(o.tiles[3]), 'Four tiles (' + o.tiles[3] + ')');
  ok(o.lastRows === 7 && /All of them/.test(o.lastHead) && /WhenClientWordingGoogleBingBy bothNew to read/.test(o.cols), 'Last searches: the newest 7 in named columns');
  ok(o.best.length === 3 && o.best[0].includes(N.A + '/Harbor Times') && /9\s*31 pages$/.test(o.best[0]) && /0\s*17 pages$/.test(o.best[2]), 'Wordings that find copies, best first (' + o.best[0] + ')');
  ok(o.nm === 3 && o.how === 3, 'Credit but no photo shows the newest pages, How it works has 3 steps');
  await page.click('#creditLast [data-act="creditalllog"]'); await page.waitForTimeout(400);
  ok(await page.evaluate(() => document.querySelectorAll('#creditLast .clr').length === 9), 'All of them shows every search kept');
  // ---- Stop
  await page.click('[data-act="creditstop"]'); await page.waitForTimeout(300);
  ok(await page.evaluate(async () => ((await chrome.storage.local.get('fcCreditStop')).fcCreditStop || 0) > Date.now() - 5000), 'Stop asks the running search to stop');
  await page.evaluate(async () => { const r = (await chrome.storage.local.get('fcCreditRun')).fcCreditRun; await chrome.storage.local.set({ fcCreditRun: { ...r, phase: 'done', end: Date.now() - 60000, why: 'stopped', left: 8 } }); });
  await go('credit');
  o = await page.evaluate(() => document.getElementById('creditLive').textContent.replace(/\s+/g, ' '));
  ok(/Stopped 1 min ago/.test(o) && /You stopped this search\. 8 pages it had listed are read later/.test(o) && /See the 2 copies/.test(o) && /Google listed 18/.test(o), 'A stopped search says so, and that the unread pages are read later');
  // ---- the bar when the weekly searches wait
  await page.evaluate(async () => { await chrome.storage.local.remove('fcCreditRun'); await FC.setKeep({ on: false }); });
  await go('credit');
  o = await page.evaluate(() => ({ bar: (document.getElementById('creditBar') || {}).textContent || '', run: document.getElementById('creditrun').hidden, next: document.getElementById('creditNext').textContent, how: !!document.querySelector('.cg1 #creditHow') }));
  ok(/Keep searching is off, so the weekly searches do not run/.test(o.bar) && o.run && /Keep searching is off/.test(o.next) && o.how, 'Keep searching off: one calm bar says the weekly searches wait; with no search running How it works takes its place');
  await page.click('[data-act="creditbarx"]'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => !document.getElementById('creditBar')), 'The bar can be closed');
  await page.evaluate(() => FC.setKeep({ on: true, hours: 'all' }));
  // ---- Clients
  await page.click('.utabs [data-v="clients"]'); await page.waitForSelector('#creditClients');
  let c = await page.evaluate(N => { const rows = [...document.querySelectorAll('#creditClients .ccr')], r = n => rows.find(x => x.querySelector('.cname b').textContent === n);
    return { hash: location.hash, n: rows.length, seg: [...document.querySelectorAll('.ccmd .kseg button')].map(b => b.textContent.replace(/\s+/g, ' ').trim()).join('|'), usual: document.getElementById('creditUsual').textContent.replace(/\s+/g, ' '),
      a: [...r(N.A).querySelectorAll('.cwc')].map(x => x.textContent).join('|'), b: r(N.B).querySelector('.cwords').textContent.trim(), off: r(N.off).classList.contains('off') && r(N.off).querySelector('[data-act="creditnow"]').disabled, first: rows[0].querySelector('.cname b').textContent,
      input: document.querySelectorAll('#creditClients input[type="text"], #creditClients input.sinput').length }; }, N);
  ok(c.hash === '#credit?tab=clients' && c.n === N.n && c.first === N.A, 'Clients tab: the address says the tab, one row per client, priority first');
  ok(c.seg === `All ${N.n}|On ${N.n - 1}|Off 1|Own wordings 1`, 'Find, All / On / Off / Own wordings with counts (' + c.seg + ')');
  ok(/usual 3: Photo: \{name\} Photo by \{name\} Credit: \{name\}/.test(c.usual), 'The usual 3 wordings are shown once, above the list');
  ok(c.a === 'Photo: ' + N.A + '|' + N.A + '/Harbor Times' && c.b === 'Usual 3 wordings' && c.off && c.input === 0, 'Rows show a client\'s own wordings as chips, or "Usual 3 wordings"; an Off client is dimmed; no long text boxes');
  await page.click('.ccmd .kseg [data-v="own"]'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.querySelectorAll('#creditClients .ccr').length === 1), 'Own wordings shows only those clients');
  await page.click('.ccmd .kseg [data-v="all"]'); await page.waitForTimeout(300);
  await page.fill('#creditQ', N.B.slice(0, 8).toLowerCase()); await page.waitForTimeout(200);
  ok(await page.evaluate(B => { const v = [...document.querySelectorAll('#creditClients .ccr')].filter(r => !r.hidden); return v.length >= 1 && v.some(r => r.querySelector('.cname b').textContent === B) && document.activeElement.id === 'creditQ'; }, N.B), 'Find a client filters while you type');
  await page.fill('#creditQ', ''); await page.selectOption('[data-act="creditsort"]', 'name'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => { const n = [...document.querySelectorAll('#creditClients .ccr .cname b')].map(b => b.textContent); return n.join() === n.slice().sort((a, b) => a.localeCompare(b)).join(); }), 'Sort: Name A to Z');
  await page.selectOption('[data-act="creditsort"]', 'pri'); await page.waitForTimeout(300);
  // switch a client off from its row
  await page.evaluate(B => [...document.querySelectorAll('#creditClients .ccr')].find(r => r.querySelector('.cname b').textContent === B).querySelector('[data-act="creditcl"]').click(), N.B); await page.waitForTimeout(400);
  ok(await page.evaluate(async B => (await PP_WATCH.creditCfg()).clients[B].on === false, N.B), 'The switch on a row saves the same setting as before');
  await page.evaluate(B => [...document.querySelectorAll('#creditClients .ccr')].find(r => r.querySelector('.cname b').textContent === B).querySelector('[data-act="creditcl"]').click(), N.B); await page.waitForTimeout(400);
  // ---- change the usual wordings
  await page.click('[data-act="creditusualedit"]'); await page.waitForSelector('#creditUsualNew');
  await page.fill('#creditUsualNew', 'Photo courtesy of {name}'); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
  let u = await page.evaluate(async B => ({ usual: (await PP_WATCH.creditCfg()).usual.join('|'), w: PP_WATCH.wordsFor(await PP_WATCH.creditCfg(), B).join('|'), chips: document.querySelectorAll('#creditUsual .cwc.ed').length, tag: [...document.querySelectorAll('#creditClients .ccr')].find(r => r.querySelector('.cname b').textContent === B).querySelector('.cwords').textContent.trim(), focus: document.activeElement.id }), N.B);
  ok(u.chips === 4 && /"Photo courtesy of \{name\}"$/.test(u.usual) && u.w.endsWith('"Photo courtesy of ' + N.B + '"') && u.tag === 'Usual 4 wordings' && u.focus === 'creditUsualNew', 'Change the usual wordings: adding one (Enter) changes every client without their own (' + u.tag + ')');
  await page.click('#creditUsual [data-act="creditusualdel"][data-v="0"]'); await page.waitForTimeout(400);
  ok(await page.evaluate(async () => (await PP_WATCH.creditCfg()).usual.length === 3 && document.querySelectorAll('#creditUsual .cwc.ed').length === 3), 'A usual wording can be removed');
  await page.click('[data-act="creditusualreset"]'); await page.waitForTimeout(400);
  ok(await page.evaluate(async () => (await PP_WATCH.creditCfg()).usual.length === 0 && PP_WATCH.usualWords(await PP_WATCH.creditCfg()).join() === PP_WATCH.DEFAULT_WORDS.join() && !document.querySelector('[data-act="creditusualreset"]')), 'Back to the standard 3 puts them back');
  await page.click('#creditUsual .btn.primary'); await page.waitForTimeout(300);
  // ---- the client panel
  await page.evaluate(A => [...document.querySelectorAll('#creditClients .ccr')].find(r => r.querySelector('.cname b').textContent === A).querySelector('.cname').click(), N.A); await page.waitForSelector('#creditPanel');
  let p = await page.evaluate(() => ({ hash: decodeURIComponent(location.hash), head: document.querySelector('#creditPanel .cph').textContent.replace(/\s+/g, ' '), ws: [...document.querySelectorAll('#creditPanel .cpw')].map(w => w.textContent.replace(/\s+/g, ' ').trim()), boxes: [...document.querySelectorAll('#creditPanel .cpbox .cbox')].map(b => b.textContent.replace(/\s+/g, ' ').trim()).join('|'),
    sel: document.querySelectorAll('#creditClients .ccr.sel').length, over: document.documentElement.scrollWidth - innerWidth, usualLink: !!document.querySelector('[data-act="creditusual3"]') }));
  ok(p.hash === '#credit?tab=clients&client=' + N.A && p.head.includes(N.A) && /photos/.test(p.head) && p.sel === 1, 'Clicking a client opens its panel; the address remembers it');
  ok(p.ws.length === 2 && /^Photo: .*Last search: Google \d+ · Bing 11 · 5 copies found this week/.test(p.ws[0]) && /Harbor Times.*9 copies found this week/.test(p.ws[1]), 'One box per wording with its last search and what it found (' + p.ws[0].slice(0, 80) + ')');
  ok(p.boxes.replace(/\s/g, '') === '14Copiesfound|2Creditbutnophoto|83Pagesread' && p.usualLink && p.over <= 0, 'What it found for this client (' + p.boxes + ')');
  await page.fill('#creditNewW', 'Harbus / Harbor Times'); await page.click('#creditPanel [data-act="creditaddw"]'); await page.waitForTimeout(500);
  p = await page.evaluate(async A => ({ w: (await PP_WATCH.creditCfg()).clients[A].words, n: document.querySelectorAll('#creditPanel .cpw').length, last: [...document.querySelectorAll('#creditPanel .cpw')].pop().textContent }), N.A);
  ok(p.w.length === 3 && p.w[2] === '"Harbus / Harbor Times"' && p.n === 3 && /Not searched yet/.test(p.last), 'Add a wording: quotes are added for you and it shows as not searched yet');
  await page.evaluate(() => [...document.querySelectorAll('#creditPanel .cpw')].pop().querySelector('[data-act="creditdelw"]').click()); await page.waitForTimeout(400);
  ok(await page.evaluate(async A => (await PP_WATCH.creditCfg()).clients[A].words.length === 2, N.A), 'The x on a wording removes it');
  await page.click('[data-act="creditusual3"]'); await page.waitForTimeout(400);
  p = await page.evaluate(async A => ({ w: (await PP_WATCH.creditCfg()).clients[A].words.length, n: document.querySelectorAll('#creditPanel .cpw').length, link: !!document.querySelector('[data-act="creditusual3"]'), sub: document.querySelector('#creditPanel .kh2 .kfaint').textContent }), N.A);
  ok(p.w === 0 && p.n === 3 && !p.link && /the usual ones/.test(p.sub), 'Use the usual 3 again clears a client\'s own wordings');
  await page.click('#creditPanel [data-act="creditclose"]'); await page.waitForTimeout(400);
  ok(await page.evaluate(() => !document.getElementById('creditPanel') && location.hash === '#credit?tab=clients' && !document.body.classList.contains('cpopen')), 'The panel closes');
  // ---- Credit but no photo
  await page.click('.utabs [data-v="nophoto"]'); await page.waitForSelector('#creditNoPhoto');
  let n = await page.evaluate(() => ({ rows: [...document.querySelectorAll('#creditNoPhoto .cnr')].map(r => r.querySelector('b').textContent), btns: [...document.querySelector('#creditNoPhoto .cnr .cnb').children].map(b => b.textContent.trim()).join('|'), href: document.querySelector('#creditNoPhoto .cnb a').href, bar: document.querySelector('.crn .kbar').textContent }));
  ok(n.rows.length === 3 && n.rows[0] === 'City council votes on harbor plan' && n.btns === 'Open page|Look closer|Take off' && /harbortimes-daily\.example/.test(n.href) && /none of that client's photos/.test(n.bar), 'Credit but no photo has its own tab: newest first, with Open page, Look closer and Take off');
  await page.selectOption('[data-act="creditncl"]', N.B); await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.querySelectorAll('#creditNoPhoto .cnr').length === 1), 'The client box narrows the list');
  await page.selectOption('[data-act="creditncl"]', ''); await page.waitForTimeout(300);
  await page.fill('#creditNQ', 'newsbreak'); await page.waitForTimeout(200);
  ok(await page.evaluate(() => [...document.querySelectorAll('#creditNoPhoto .cnr')].filter(r => !r.hidden).length === 1), 'Find a site or page filters while you type');
  await page.fill('#creditNQ', '');
  await page.route('https://newsbreak.example/**', r => r.fulfill({ contentType: 'text/html', body: '<html><head><title>Fire</title><meta property="og:image" content="https://newsbreak.example/a.jpg"></head><body><img src="/b.png"></body></html>' }));
  const [insp] = await Promise.all([ctx.waitForEvent('page'), page.evaluate(() => document.querySelectorAll('#creditNoPhoto .cnr')[1].querySelector('[data-act="creditlook"]').click())]);
  await insp.waitForTimeout(600);
  const rec = await insp.evaluate(async () => { const id = new URLSearchParams(location.search).get('id'); const r = await PP_DB.get(id); return { path: location.pathname, mode: r.mode, page: r.page, n: r.items.length, first: r.items[0].src }; });
  ok(/inspect\.html$/.test(rec.path) && rec.mode === 'all' && rec.page === 'https://newsbreak.example/fire' && rec.n === 2 && rec.first === 'https://newsbreak.example/a.jpg', 'Look closer opens that page\'s pictures in Inspect a photo (' + rec.n + ' pictures)');
  await insp.close();
  await page.click('#creditNoPhoto .cnr [data-act="creditdrop"]'); await page.waitForTimeout(400);
  ok(await page.evaluate(async () => (await PP_WATCH.creditState()).nomatch.length === 2 && document.querySelectorAll('#creditNoPhoto .cnr').length === 2), 'Take off removes a page from the list');
  await page.click('[data-act="credithow"]'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.querySelectorAll('#creditHow .chs').length === 3), 'How it works opens from the button on any tab');
  // ---- an unknown tab, narrow, dark
  await go('credit?tab=nope');
  ok(await page.evaluate(() => location.hash === '#credit' && document.querySelector('.utabs .on').textContent.trim() === 'Overview'), 'An unknown tab opens Overview');
  await page.setViewportSize({ width: 760, height: 900 }); await page.waitForTimeout(300);
  const nar = [];
  for (const t of ['credit', 'credit?tab=clients', 'credit?tab=nophoto']) { await go(t); nar.push(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)); }
  ok(nar.every(x => x <= 0), 'Narrow window: nothing runs off the side on any tab (' + nar.join(', ') + ')');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'dark' })); await page.reload(); await page.waitForSelector('.crn');
  await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
  const d = await page.evaluate(() => ({ card: getComputedStyle(document.querySelector('#creditNoPhoto')).backgroundColor, ink: getComputedStyle(document.querySelector('#creditNoPhoto .cnr b')).color }));
  ok(d.card === 'rgb(43, 43, 43)' && +d.ink.match(/\d+/)[0] > 220, `Dark: grey cards and light words (${d.card}, ${d.ink})`);
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
