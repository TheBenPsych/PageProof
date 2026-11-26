// The calm look, step 8: Watching. The turns (every week, month, 3 months) and why, lighter checks
// for quiet turns, Stop for a running check, the shared slot of minutes an hour with its cap per
// computer, 5 social accounts an hour, the stolen before list offer, and the page itself: tabs,
// Checking now, Needs a look, tiles, Turns, This hour, the list, the row menu, the panel, adding.
process.env.NP = process.env.NP || '2000'; process.env.NC = process.env.NC || '30';
const http = require('http');
const { start } = require('./h.js'); const { seed } = require('./seed.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const srv = http.createServer((q, r) => {
    const base = 'http://127.0.0.1:' + srv.address().port;
    if (q.url === '/') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end(`<html><head><link rel="alternate" type="application/rss+xml" href="${base}/feed.xml"></head></html>`); }
    if (q.url === '/feed.xml') { r.writeHead(200, { 'content-type': 'application/rss+xml' }); return r.end(`<?xml version="1.0"?><rss version="2.0"><channel>${Array.from({ length: 20 }, (_, i) => `<item><title>P${i}</title><link>${base}/post-${i}</link></item>`).join('')}</channel></rss>`); }
    r.writeHead(404); r.end();
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(1200);
  await seed(page);

  // ---- the turns, in plain rules
  const t = await page.evaluate(() => {
    const now = Date.now(), iso = d => new Date(now - d * 864e5).toISOString(), T = x => PP_WATCH.turnOf(x, now);
    return { hand: T({ by: 'hand', empty: 9 }), found: T({ by: 'auto', lastFound: iso(9), empty: 0, recent: 2 }), e3: T({ by: 'auto', empty: 3, recent: 5 }), e6: T({ by: 'auto', empty: 6, recent: 5 }),
      list: T({ by: 'list' }), old: T({ by: 'auto', recent: 0, stolen: 4 }), many: T({ by: 'auto', recent: 3, added: iso(200) }), fresh: T({ by: 'auto', recent: 2, added: iso(5) }), two: T({ by: 'auto', recent: 2, added: iso(60) }),
      back: T({ by: 'auto', empty: 0, lastFound: iso(1), recent: 2, added: iso(300) }) };
  });
  ok(t.hand[0] === 'w' && /Added by you/.test(t.hand[1]), 'one you added is always checked every week: ' + t.hand[1]);
  ok(t.found[0] === 'w' && t.found[1] === 'Found a copy 9 days ago' && t.back[0] === 'w', 'a copy found by watching keeps it (or puts it back) on every week: ' + t.found[1]);
  ok(t.e3[0] === 'm' && t.e6[0] === 'q', 'after 3 checks with nothing new it moves to every month, after 6 to every 3 months: ' + t.e3[1] + ' / ' + t.e6[1]);
  ok(t.list[0] === 'q' && t.old[0] === 'q', 'stolen before list sites and old cases are checked every 3 months: ' + t.list[1] + ' / ' + t.old[1]);
  ok(t.many[0] === 'w' && t.fresh[0] === 'w' && t.two[0] === 'm', '3 Stolen lately or new this month is weekly, only 2 Stolen after the first month is monthly: ' + [t.many[1], t.fresh[1], t.two[1]].join(' / '));

  // ---- the shared slot and the cap per computer
  const s = await page.evaluate(async () => {
    const h = Math.floor(Date.now() / 3600000), M = 60000, set = o => chrome.storage.local.set({ ppSlot: { h, sweep: 0, credit: 0, watch: 0, accts: 0, ...o } });
    const out = {};
    await chrome.storage.local.set({ ppHw: { choice: 'Normal' } }); await chrome.storage.local.remove(['fcRest', 'ppWatchCap']);
    out.normal = await PP_WATCH.slotInfo();
    await set({}); out.empty = await PP_WATCH.slotOK('watch');
    await set({ watch: 6.1 * M }); out.capped = await PP_WATCH.slotOK('watch'); out.creditStill = await PP_WATCH.slotOK('credit');
    await set({ sweep: 5 * M, credit: 5 * M, watch: 2.1 * M }); out.full = [await PP_WATCH.slotOK('watch'), await PP_WATCH.slotOK('credit'), await PP_WATCH.slotOK('sweep')];
    await chrome.storage.local.set({ fcRest: { google: Date.now() + 30 * M } }); out.resting = await PP_WATCH.slotOK('watch');
    await set({ watch: 12.1 * M }); out.restingCap = await PP_WATCH.slotOK('watch');
    await chrome.storage.local.remove('fcRest');
    await chrome.storage.local.set({ ppSlot: { h: h - 1, watch: 50 * M } }); out.newHour = await PP_WATCH.slotOK('watch');
    await chrome.storage.local.set({ ppHw: { choice: 'Light' } }); out.light = await PP_WATCH.slotInfo();
    await chrome.storage.local.set({ ppHw: { choice: 'Strong' } }); out.strong = await PP_WATCH.slotInfo();
    await PP_WATCH.setWatchCap(3); out.own = (await PP_WATCH.slotInfo()).watchMax; await PP_WATCH.setWatchCap(0);
    await chrome.storage.local.set({ ppHw: { choice: 'Normal' } }); await set({ sweep: 210000, credit: 240000, watch: 270000, accts: 2 });
    return out;
  });
  ok(s.normal.max === 12 && s.normal.watchMax === 6 && s.light.max === 6 && s.light.watchMax === 3 && s.strong.watchMax === 12, `the slot is 12 minutes an hour (6 on a Light PC), Watching gets 3, 6 or 12: ${s.light.watchMax}/${s.normal.watchMax}/${s.strong.watchMax}`);
  ok(s.empty === true && s.capped === false && s.creditStill === true, 'Watching stops for the hour once its own minutes are used, Credit search carries on');
  ok(s.full.join() === 'false,false,false', 'when the shared slot is full, sweeps, credit and watching all wait for the next hour');
  ok(s.resting === true && s.restingCap === false, 'while Google or Bing rest, Watching may use as much again, and no more');
  ok(s.newHour === true && s.own === 3, 'a new hour starts a new slot, and the minutes can be set by hand for this PC');

  // ---- stolen before list offer, lighter checks, Stop
  const m = await page.evaluate(async base => {
    globalThis.PP_WATCH_HOME = () => base;
    await FC.setKeep({ on: true, hours: 'all' });
    for (const it of await PP_WATCH.watchList()) await PP_WATCH.watchOff(it.key, true);
    const links = ['https://quietsite-example.com/a', 'https://www.quietsite-example.com/b', 'https://quietsite-example.com/c', 'https://onelink-example.com/a'];
    await chrome.storage.local.set({ rsStolen: links }); RS_STOLEN.items = links;
    const out = { n: await PP_WATCH.listCount(), before: (await PP_WATCH.watchList()).some(x => x.by === 'list') };
    await PP_WATCH.setWatchList(true);
    const it = (await PP_WATCH.watchList()).find(x => x.by === 'list');
    out.it = it && { key: it.key, turn: it.turn, links: it.links, why: it.why };
    await PP_WATCH.watchStep({ fast: true });
    const a = (await PP_WATCH.watchList()).find(x => x.by === 'list');
    out.posts = a.newPosts; out.lite = a.lite; out.pend = a.pend.length; out.seen = a.seen.length;
    await PP_WATCH.watchStop(a.key);
    const b = (await PP_WATCH.watchList()).find(x => x.by === 'list');
    out.after = { pend: (b.pend || []).length, seen: b.seen.length, hist: b.hist, empty: b.empty || 0, last: !!b.last };
    out.snap = (await FC.settingsSnapshot()).watchStolenList;
    return out;
  }, base);
  ok(m.n === 1 && m.before === false, 'the stolen before list is only counted (sites with 2 or more links), never watched before you say yes: ' + m.n);
  ok(m.it && m.it.key === 's:quietsite-example.com' && m.it.turn === 'q' && m.it.links === 3, 'after yes they are watched every 3 months: ' + JSON.stringify(m.it));
  ok(m.posts === 10 && m.lite === true && m.pend === 10, `a 3-monthly check reads at most 10 new posts, main picture only (${m.posts} of 20)`);
  ok(m.after.pend === 0 && m.after.seen === 0 && m.after.hist.length === 1 && m.after.hist[0][4] === 1 && m.after.empty === 0 && m.after.last, 'Stop ends the check, keeps the unread posts for next time and writes it in the last checks: ' + JSON.stringify(m.after.hist));
  ok(m.snap === true, 'the backup remembers that the stolen before list is watched');

  // ---- the page
  await page.evaluate(async () => {
    const now = Date.now(), iso = d => new Date(now - d * 864e5).toISOString();
    const w = await FC.meta.get('watch');
    const hist = [[iso(2), 12, 1, 30, 0], [iso(9), 9, 2, 22, 0], [iso(16), 15, 0, 40, 0]];
    Object.assign(w.items, {
      's:dailyrumble-example.net': { key: 's:dailyrumble-example.net', kind: 'site', base: 'dailyrumble-example.net', url: 'https://dailyrumble-example.net', label: 'dailyrumble-example.net', by: 'hand', feed: 'https://dailyrumble-example.net/feed/', last: iso(2), checks: 6, newPosts: 12, found: 3, lastFound: iso(2), hist, added: iso(60) },
      's:busy-example.com': { key: 's:busy-example.com', kind: 'site', base: 'busy-example.com', url: 'https://busy-example.com', label: 'busy-example.com', by: 'hand', feed: 'sitemap', last: iso(8), checks: 4, newPosts: 30, found: 2, t0: now - 6 * 60000, cp: 41, cf: 1, cur: 'https://busy-example.com/2026/11/gala-night', pend: Array.from({ length: 18 }, (_, i) => ({ page: 'https://busy-example.com/p' + i, imgs: [] })), added: iso(60) },
      'a:facebook:rimemes': { key: 'a:facebook:rimemes', kind: 'acct', url: 'https://www.facebook.com/rimemes', label: 'RI Memes', plat: 'Facebook', by: 'hand', last: iso(3), checks: 3, err: 'asked to log in', added: iso(60) },
      's:gone-example.co': { key: 's:gone-example.co', kind: 'site', base: 'gone-example.co', url: 'https://gone-example.co', label: 'gone-example.co', by: 'hand', feed: 'sitemap', last: iso(3), checks: 2, newPosts: 0, err: 'no posts found', added: iso(60) },
      'a:instagram:streetstyle.example': { key: 'a:instagram:streetstyle.example', kind: 'acct', url: 'https://www.instagram.com/streetstyle.example/', label: '@streetstyle.example', plat: 'Instagram', by: 'hand', added: iso(1) },
      's:stopped-example.net': { key: 's:stopped-example.net', kind: 'site', base: 'stopped-example.net', url: 'https://stopped-example.net', label: 'stopped-example.net', by: 'hand', off: true, last: iso(30), added: iso(60) },
    });
    w.list = false; w.avg = 28000;
    await FC.meta.set('watch', w);
    await chrome.storage.local.set({ ppTheme: 'light' });
    await FC.setKeep({ on: true, hours: 'all' });
  });
  await page.goto(url('app.html#watching')); await page.waitForSelector('.wan #watchList .wr');
  const T = async sel => (await page.locator(sel).first().textContent()).replace(/\s+/g, ' ').trim();
  ok(/Copies found\s*›\s*Watching/.test(await T('.head h1')), 'title reads Copies found › Watching');
  const tabs = await page.$$eval('.utabs button', b => b.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  ok(tabs.length === 4 && /^All 5$/.test(tabs[0]) && /^Websites 3$/.test(tabs[1]) && /^Social accounts 2$/.test(tabs[2]) && /^Not watching \d+$/.test(tabs[3]), 'four tabs with counts: ' + tabs.join(' | '));
  ok(/1 site or account on your stolen before list has 2 or more links/.test(await T('#watchListBar')), 'the stolen before list offer bar: ' + (await T('#watchListBar b')));
  const live = await T('#watchLive');
  ok(/Checking now · started 6 min ago/.test(live) && /busy-example\.com/.test(live) && /12 of 30 posts · 41 pictures compared/.test(live) && /40%/.test(live) && /18\s*Posts left/.test(live) && /1\s*New copy found/.test(live), 'Checking now card: ring, two steps, the post in hand, numbers');
  ok(await page.locator('#watchLive [data-act="watchstop"]').count() === 1 && /gala-night/.test(await T('#watchLive .cnow')), 'it has a Stop button and shows the page being read');
  const need = await T('#watchNeeds');
  ok(/Needs a look 2/.test(need) && /Facebook asked to log in/.test(need) && /Log in on Facebook/.test(need) && /No new posts found/.test(need) && /Try again/.test(need), 'Needs a look lists the two problems with their fix buttons');
  const tiles = await page.$$eval('#watchTiles .kt2', x => x.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  ok(tiles.length === 4 && /^5\s*Sites and accounts watched\s*3 websites · 2 social accounts/.test(tiles[0]) && /^12\s*New posts checked\s*This week · 30 pictures compared/.test(tiles[1]), 'four tiles: ' + tiles.join(' | '));
  ok(/^5\s*Copies found by watching/.test(tiles[2]) && /Next check/.test(tiles[3]), 'copies found by watching and the next check: ' + tiles[2] + ' | ' + tiles[3]);
  const turns = await T('#watchTurns');
  ok(/5\s*Every week/.test(turns) && /This PC \(Normal\) gives Watching up to 6 minutes an hour/.test(turns) && /checks a week/.test(turns) && /every site stays on its turn/.test(turns), 'Turns card: who is on which turn, this PC\'s minutes and the forecast');
  const hour = await T('#watchHour');
  ok(/Sweeps of Stolen sites\s*3\.5 min/.test(hour) && /Credit search\s*4 min/.test(hour) && /Watching\s*2 of 5 social accounts\s*4\.5 min/.test(hour) && /at most 12 minutes an hour/.test(hour), 'This hour on this PC shows the shared slot: ' + hour.slice(0, 160));
  const head = await page.$$eval('#watchList .wh span', x => x.map(e => e.textContent.trim()).filter(Boolean));
  ok(head.join('|') === 'Site or account|Clients|Stolen there|Last checked|New posts|Found|How often', 'named columns: ' + head.join('|'));
  const row = await T('#watchList .wr[data-key="s:dailyrumble-example.net"]');
  ok(/dailyrumble-example\.net\s*Added by you/.test(row) && /reads its news feed/.test(row) && /2 days ago/.test(row) && /3 found/.test(row) && /Every week/.test(row) && /Added by you: always weekly/.test(row) && /Check now/.test(row), 'a row: name, Added by you, how it is read, last check, found, turn and why: ' + row.slice(0, 200));
  ok(await page.locator('#watchList .wr .wpi').count() === 5 && /Asked to log in/.test(await T('#watchList .wr[data-key="a:facebook:rimemes"]')) && /Checking now/.test(await T('#watchList .wr[data-key="s:busy-example.com"]')), 'platform pictures on every row, problems and the running check marked');
  ok(/Not watching/.test(await T('#watchOff')) && /stopped-example\.net/.test(await T('#watchOff')) && /How it works/.test(await T('#watchHow')) && await page.locator('#watchHow .chs').count() === 3, 'Not watching fold and How it works in 3 steps');
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over <= 0, 'nothing sticks out sideways at 1920: ' + over);

  // find, sort
  await page.fill('#watchQ', 'rumble'); await page.waitForTimeout(150);
  ok(await page.locator('#watchList .wr:visible').count() === 1, 'Find narrows the list as you type');
  await page.fill('#watchQ', 'zzzz'); ok(await page.locator('#watchNoMatch').isVisible(), 'no match says so');
  await page.fill('#watchQ', '');
  await page.selectOption('[data-act="watchsort"]', 'name'); await page.waitForTimeout(400);
  const names = await page.$$eval('#watchList .wr', r => r.map(x => x.dataset.name));
  ok(names.join() === names.slice().sort((a, b) => a.localeCompare(b)).join(), 'Sort by name: ' + names.join(', '));
  await page.selectOption('[data-act="watchsort"]', 'stolen'); await page.waitForTimeout(300);

  // row menu
  await page.click('.wr[data-key="s:dailyrumble-example.net"] [data-act="watchmenu"]'); await page.waitForSelector('#watchMenu');
  const menu = await T('#watchMenu');
  ok(/Open the site/.test(menu) && /See what watching found/.test(menu) && /Stop watching/.test(menu) && /Remove/.test(menu), 'the ⋯ menu: ' + menu);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  ok(await page.locator('#watchMenu').count() === 0, 'Escape closes the menu');

  // panel
  await page.click('.wr[data-key="s:dailyrumble-example.net"] [data-act="watchopen"]'); await page.waitForSelector('#watchPanel');
  const pn = await T('#watchPanel');
  ok(/open=/.test(await page.evaluate(() => location.hash)) && /3\s*Found by watching/.test(pn) && /6\s*Checks so far/.test(pn) && /Its news feed/.test(pn) && /Turn:\s*Every week/.test(pn) && /A new copy moves it back to every week/.test(pn), 'the panel: boxes, how it is read, the turn and why');
  ok(await page.locator('#watchHist > div').count() === 3 && /12 new posts\s*1 found/.test(await T('#watchHist')) && /Nothing new/.test(await T('#watchHist')), 'the panel lists the last checks: ' + (await T('#watchHist')));
  await page.reload(); await page.waitForSelector('#watchPanel');
  ok(true, 'the panel stays open after a reload');
  await page.click('#watchPanel [data-act="watchnow"]'); await page.waitForTimeout(500);
  ok(await page.evaluate(async () => (await FC.meta.get('watch')).items['s:dailyrumble-example.net'].due === true) && /First in line/.test(await T('#watchPanel .cpfoot')), 'Check now puts it first in line');
  await page.click('#watchPanel [data-act="watchclose"]'); await page.waitForTimeout(400);
  ok(await page.locator('#watchPanel').count() === 0 && !await page.evaluate(() => document.body.classList.contains('cpopen')), 'the panel closes');

  // tabs
  await page.click('.utabs [data-v="accts"]'); await page.waitForTimeout(500);
  ok(/tab=accts/.test(await page.evaluate(() => location.hash)) && await page.locator('#watchList .wr').count() === 2 && await page.locator('#watchTiles').count() === 0, 'Social accounts tab shows only accounts, and the tab is in the address');
  await page.click('.utabs [data-v="off"]'); await page.waitForTimeout(500);
  ok(/stopped-example\.net/.test(await T('#watchList')) && await page.locator('#watchList [data-act="watchon"]').count() >= 1, 'Not watching tab offers Watch again');
  await page.click('.wr[data-key="s:stopped-example.net"] [data-act="watchon"]'); await page.waitForTimeout(500);
  ok(await page.evaluate(async () => (await FC.meta.get('watch')).items['s:stopped-example.net'].off === false), 'Watch again switches it back on');
  await page.click('.utabs [data-v="all"]'); await page.waitForSelector('#watchTiles');

  // add, stop watching, remove
  await page.fill('#watchIn', 'not a site'); await page.click('[data-act="watchadd"]'); await page.waitForTimeout(300);
  ok(await page.locator('.wr[data-key^="s:not"]').count() === 0, 'something that is not a site is not added');
  await page.fill('#watchIn', 'https://www.newone-example.org/some/page'); await page.keyboard.press('Enter'); await page.waitForSelector('.wr[data-key="s:newone-example.org"]');
  ok(/Added by you/.test(await T('.wr[data-key="s:newone-example.org"]')) && /Not checked yet/.test(await T('.wr[data-key="s:newone-example.org"]')), 'a site is added from the short box with Enter');
  await page.click('.wr[data-key="s:newone-example.org"] [data-act="watchmenu"]'); await page.click('#watchMenu [data-act="watchdrop"]'); await page.waitForTimeout(500);
  ok(await page.locator('.wr[data-key="s:newone-example.org"]').count() === 0, 'Remove takes away one you added');

  // stolen before offer + Stop on the page + cap
  await page.click('#watchListBar [data-v="yes"]'); await page.waitForSelector('.wr[data-key="s:quietsite-example.com"]');
  const lr = await T('.wr[data-key="s:quietsite-example.com"]');
  ok(/Stolen before list/.test(lr) && /Every 3 months/.test(lr) && await page.locator('#watchListBar').count() === 0, 'Watch them every 3 months adds them with their chip and turn: ' + lr.slice(0, 140));
  await page.selectOption('[data-act="watchcap"]', '3'); await page.waitForTimeout(500);
  ok(/up to 3 minutes an hour/.test(await T('#watchCap')) && await page.evaluate(async () => (await chrome.storage.local.get('ppWatchCap')).ppWatchCap === 3), 'the minutes an hour can be changed for this PC');
  await page.click('#watchLive [data-act="watchstop"]'); await page.waitForTimeout(800);
  const st = await page.evaluate(async () => { const it = (await FC.meta.get('watch')).items['s:busy-example.com']; return { pend: (it.pend || []).length, h: it.hist && it.hist[0] }; });
  ok(st.pend === 0 && st.h && st.h[4] === 1 && await page.locator('#watchLive').count() === 0, 'Stop on the card ends the check: ' + JSON.stringify(st.h));

  // empty page
  await page.evaluate(async () => { const real = PP_WATCH.watchList; PP_WATCH.watchList = async () => []; await render(true); PP_WATCH.watchList = real; });
  await page.waitForSelector('#watchEmpty');
  ok(/Nothing watched yet/.test(await T('#watchEmpty')) && await page.locator('#watchEmpty #watchIn').count() === 1 && await page.locator('#watchHow').count() === 1, 'empty page explains and offers the add box');

  // narrow + dark
  await page.setViewportSize({ width: 1000, height: 900 }); await page.goto(url('app.html#watching')); await page.waitForSelector('#watchList .wr');
  const over2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over2 <= 0, 'fits a 1000 px window: ' + over2);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'dark' })); await page.reload(); await page.waitForSelector('#watchList .wr');
  await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
  const d = await page.evaluate(() => ({ card: getComputedStyle(document.querySelector('#watchList')).backgroundColor, ink: getComputedStyle(document.querySelector('#watchList .wr .kn1 b')).color }));
  ok(d.card === 'rgb(43, 43, 43)' && +d.ink.match(/\d+/)[0] > 220, `Dark: grey cards and light words (${d.card}, ${d.ink})`);
  await ctx.close(); srv.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
