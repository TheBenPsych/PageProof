// 4.14: the shorter menu, Home's "What to do now" list, the status line at the bottom, one blue
// main button per page, Evidence library pictures, Needs a capture, one row for one page under
// several addresses, and closing pop-ups before a capture. Pretend pages only.
const { start } = require('./h.js');
const http = require('http');
const path = require('path');
process.env.NP = 600; process.env.NC = 120;
const { seed } = require('./seed.js');
const SHOTS = process.env.SHOTS || '';
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  // A pretend news page with a cookie notice, a newsletter box, a log-in box and a Subscribe button.
  const html = `<!doctype html><body style="margin:0;font:16px sans-serif"><h1>Story</h1><p>Text</p>
    <div id="ck" style="position:fixed;left:0;right:0;bottom:0;height:120px;background:#333;color:#fff">We use cookies to improve your experience.
      <button id="ckset" onclick="window.bad=1">Manage settings</button><button id="ckok" onclick="ck.remove();window.ck1=1">Accept all</button></div>
    <div id="nl" role="dialog" style="position:fixed;left:30%;top:20%;width:40%;height:220px;background:#fff;border:1px solid #000">Sign up for our newsletter! Enter your email
      <input type="email"><button id="sub" onclick="window.bad=1">Subscribe</button><button id="nlx" aria-label="Close" onclick="nl.remove();window.nl1=1">×</button></div>
    <div id="login" role="dialog" style="position:fixed;left:0;top:0;width:200px;height:200px;background:#eee">Log in to see more <input type="password"><button onclick="window.bad=1">Close</button></div>
  </body>`;
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const site = 'http://127.0.0.1:' + srv.address().port + '/';

  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  const shot = async n => { if (SHOTS) await page.screenshot({ path: SHOTS + '/' + n + '.png', fullPage: false }); };
  const go = async h => { await page.goto(url('app.html#' + h)); await page.waitForTimeout(1300); };
  await go('help'); await seed(page); await page.reload(); await page.waitForTimeout(1200);

  // 1. Menu: six items (UI overhaul batch 6 added Tools)
  const nav = await page.evaluate(() => [...document.querySelectorAll('#side a.nav .t b')].map(b => b.textContent.trim()));
  ok(JSON.stringify(nav) === JSON.stringify(['Home', 'Copies found', 'Clients', 'Evidence', 'Tools', 'Settings']), 'Menu has 6 items: ' + nav.join(', '));
  await go('keep');
  ok(await page.evaluate(() => !!document.querySelector('#side .nav.on') && /Copies found/.test(document.querySelector('#side .nav.on').textContent) && !!document.querySelector('#side .subs a.on[href="#keep"]')), 'Keep searching lives under Copies found');
  await go('inspect');
  ok(await page.evaluate(() => /Tools/.test(document.querySelector('#side .nav.on').textContent) && !!document.querySelector('#side .subs a.on[href="#inspect"]')), 'Inspect a photo lights up Tools');

  // 2. Home: What to do now
  await go('home'); await page.waitForTimeout(800); await shot('414-home');
  const h = await page.evaluate(() => ({ jobs: [...document.querySelectorAll('#homeJobs .job')].map(j => j.className + ' ' + j.textContent.replace(/\s+/g, ' ').slice(0, 80)), newBtn: !!document.querySelector('#jobNew a[href="#review"]'), cap: !!document.querySelector('#jobCapture a[href="#tocapture"]') }));
  console.log(JSON.stringify(h.jobs));
  ok(h.newBtn, 'Home lists new copies to answer with Start');
  ok(h.cap, 'Home lists stolen copies that need a capture');
  const order = h.jobs.map(j => /lvl-bad/.test(j) ? 0 : /lvl-warn/.test(j) ? 1 : /lvl-info/.test(j) ? 2 : 3);
  ok(order.every((v, i) => !i || v >= order[i - 1] || order[i - 1] === 1 && v === 1), 'Home: most urgent first');

  // 3. Status line
  await page.waitForTimeout(1200);
  const sl = await page.evaluate(() => { const e = document.getElementById('statusLine'); return e && !e.hidden ? e.textContent : ''; });
  ok(/Drive connected/.test(sl) && /Keep searching|Searching|Starting/.test(sl), 'Status line shows Drive and searching: ' + sl.replace(/\s+/g, ' '));
  await page.evaluate(() => chrome.storage.local.set({ fcDriveOffline: true })); await page.waitForTimeout(1600);
  ok(await page.evaluate(() => document.getElementById('statusLine').classList.contains('bad') && /Can't reach Google Drive/.test(document.getElementById('statusLine').textContent) && !!document.querySelector('#statusLine .sfix')), 'Status line turns red with Fix it');
  await page.evaluate(() => chrome.storage.local.remove('fcDriveOffline'));

  // 4. Same page under other addresses
  const m = await page.evaluate(async () => {
    const p = (await FC.DB.all('photos')).find(x => x.hash);
    const mk = (u, st) => ({ id: p.id + '|' + RS_UTIL.key(u), photo: p.id, client: p.client, url: u, key: RS_UTIL.key(u), site: RS_SITE.of(u), title: '', engines: ['google'], pct: 90, match: 'same', firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString(), times: 1, status: st, online: 'up' });
    const a = mk('https://www.dupe-news.com/2024/story-9/?utm_source=fb', 'stolen'), b = mk('https://m.dupe-news.com/2024/story-9', 'new'), c = mk('https://dupe-news.com/2024/story-9/amp/', 'new'), d = mk('https://dupe-news.com/2024/other', 'new');
    await FC.DB.putMany('copies', [a, b, c, d]);
    await FC.meta.set('pageMerge', '');
    FC.touch('copies');
    const n = await FC.mergeSamePages();
    const left = (await FC.copiesOf(p.id)).filter(x => /dupe-news/.test(x.url));
    return { n, left: left.length, alts: (left.find(x => x.status === 'stolen') || {}).alts, same: FC.pageKey('https://amp.x.com/a/amp?ref=t') === FC.pageKey('http://x.com/a'), diff: FC.pageKey('https://x.com/a?id=1') !== FC.pageKey('https://x.com/a?id=2'), id: a.id };
  });
  ok(m.n === 2 && m.left === 2 && m.alts && m.alts.length === 2, 'Same page under 3 addresses becomes one copy, answer kept (' + JSON.stringify(m) + ')');
  ok(m.same && m.diff, 'Page key ignores phone/AMP/tracking but keeps real differences');
  await go('found?filter=Stolen'); await page.waitForTimeout(800);
  await page.fill('#ppSearch', 'dupe-news'); await page.waitForTimeout(1200);
  ok(await page.evaluate(() => [...document.querySelectorAll('.altn')].some(t => /\+2 addresses/.test(t.textContent))), 'Row shows "+2 addresses"');
  await page.fill('#ppSearch', ''); await page.waitForTimeout(500);

  // 5. Needs a capture
  await go('tocapture'); await shot('414-tocapture');
  const before = await page.evaluate(() => document.querySelectorAll('#capList .caprow').length);
  ok(before > 0 && await page.evaluate(id => !!document.querySelector(`.caprow[data-id="${CSS.escape(id)}"] [data-act="capturecopy"]`), m.id), 'Needs a capture lists stolen copies with Capture (' + before + ')');
  // a saved pack of the same page (phone address) counts as captured
  await page.evaluate(async () => { const { log = [] } = await chrome.storage.local.get('log'); log.push({ id: 'cap-414', captureId: 'PP-TEST414', time: new Date().toISOString(), url: 'https://m.dupe-news.com/2024/story-9?fbclid=1', title: 'Dupe', saves: [{ at: new Date().toISOString(), caseRef: 'CASE-414', file: 'x.zip' }] }); await chrome.storage.local.set({ log }); });
  await go('home'); await go('tocapture');
  ok(await page.evaluate(id => !document.querySelector(`.caprow[data-id="${CSS.escape(id)}"]`), m.id), 'A saved pack of the same page takes it off the list');
  const first = await page.evaluate(() => document.querySelector('#capList .caprow').dataset.id);
  await page.click(`#capList .caprow [data-act="capdone"]`); await page.waitForTimeout(900);
  ok(await page.evaluate(id => !document.querySelector(`.caprow[data-id="${CSS.escape(id)}"]`), first), 'Already captured takes it off the list');

  // 6. Library cards with a picture, list switch, one blue button last
  await page.evaluate(async () => {
    const c = new OffscreenCanvas(800, 600), x = c.getContext('2d'); x.fillStyle = '#2563EB'; x.fillRect(0, 0, 800, 600); x.fillStyle = '#fff'; x.fillRect(40, 40, 300, 80);
    const b = await c.convertToBlob({ type: 'image/png' });
    const src = await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
    await PP_DB.put({ id: 'cap-414', url: 'https://m.dupe-news.com/2024/story-9', main: { tiles: [{ src }] }, sections: [] });
  });
  await go('library'); await page.waitForTimeout(1500); await shot('414-library');
  const lib = await page.evaluate(() => ({ cards: document.querySelectorAll('.capcard').length, img: !!document.querySelector('.capcard [data-capthumb="cap-414"] img'), caseNo: /CASE-414/.test(document.getElementById('capGrid').textContent),
    prim: document.querySelectorAll('.head .headact .btn.primary').length, last: (document.querySelector('.head .headact').lastElementChild || {}).className }));
  ok(lib.cards >= 1 && lib.img && lib.caseNo, 'Evidence library shows picture cards with the case number');
  ok(lib.prim === 1 && /primary/.test(lib.last), 'Page header has one blue main button, last');
  ok(await page.evaluate(async () => !!(await PP_DB.get('thumb-cap-414'))), 'The card picture is kept after the capture is cleared');
  await page.click('[data-act="libview"][data-v="list"]'); await page.waitForTimeout(800);
  ok(await page.evaluate(() => !!document.querySelector('.card table') && !document.getElementById('capGrid')), 'List switch shows the table');
  await page.click('[data-act="libview"][data-v="cards"]'); await page.waitForTimeout(500);
  // every page with buttons in its header has at most one blue one
  const multi = [];
  for (const r of ['found', 'clients', 'skipped', 'owners', 'health', 'hidden', 'weekly', 'library', 'review']) {
    await go(r);
    const n = await page.evaluate(() => document.querySelectorAll('.head .headact .btn.primary').length);
    if (n > 1) multi.push(r);
  }
  ok(!multi.length, 'At most one blue button in each page header' + (multi.length ? ': ' + multi : ''));

  // 7. Closing pop-ups (the helper that runs inside the page)
  const web = await ctx.newPage();
  await web.goto(site); await web.addScriptTag({ path: path.resolve(__dirname, '../../extension/content.js') });
  const closed = await web.evaluate(() => window.__pageproof.closePopups());
  const res = await web.evaluate(() => ({ ck: !!window.ck1, nl: !!window.nl1, bad: !!window.bad, login: !!document.getElementById('login') }));
  console.log(JSON.stringify(closed));
  ok(res.ck && res.nl, 'Cookie notice and newsletter box are closed with their own buttons');
  ok(!res.bad && res.login, 'Never presses Subscribe or Manage settings, and leaves the log-in box alone');
  ok(closed.length === 2 && closed.some(t => /cookie notice/.test(t)) && closed.some(t => /sign-up box/.test(t)), 'It says what it closed (for the capture log)');
  await web.close();
  // Settings switch
  await go('settings');
  await page.click('#sPopups'); await page.waitForTimeout(400);
  ok(await page.evaluate(async () => (await chrome.storage.local.get('ppPopups')).ppPopups === false), 'Settings › Capturing a page can turn it off');

  await ctx.close(); srv.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL crashed', e); process.exit(1); });
