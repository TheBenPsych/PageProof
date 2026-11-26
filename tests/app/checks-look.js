// Checks for the 4.2 look: the new Copies found rows, filters, the fold for one site, the undo
// list, the picture of their page and the kept copy. Pretend sites only, served from this computer.
const { start } = require('./h.js');
const http = require('http');
process.env.NP = 3000; process.env.NC = 400;
const { seed } = require('./seed.js');
const SHOTS = process.env.SHOTS || '';
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  // a pretend website that refuses to be shown inside another page, and one picture
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const srv = http.createServer((q, r) => {
    if (q.url.startsWith('/pic')) { r.writeHead(200, { 'content-type': 'image/png', 'access-control-allow-origin': '*' }); return r.end(png); }
    r.writeHead(200, { 'content-type': 'text/html', 'x-frame-options': 'DENY', 'content-security-policy': "frame-ancestors 'none'" });
    r.end('<body style="margin:0;background:#0a7"><h1 style="font:80px sans-serif;color:#fff;padding:60px">Their page</h1></body>');
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  page.on('console', m => { if (m.type() === 'error' && !/TUNNEL|ERR_NAME|net::|Failed to load resource/.test(m.text())) console.log('ERR', m.text().slice(0, 300)); });
  const shot = async n => { if (SHOTS) await page.screenshot({ path: SHOTS + '/' + n + '.png' }); };
  const go = async h => { await page.goto(url('app.html#' + h)); await page.waitForTimeout(1200); };
  await go('help'); await seed(page); await page.reload(); await page.waitForTimeout(1000);

  // ---- the menu and top bar
  const menu = await page.evaluate(() => [...document.querySelectorAll('#side a')].map(a => a.textContent.trim()).join(' | '));
  ok(/Copies found/.test(menu) && /Clients/.test(menu) && /Evidence/.test(menu) && /Settings/.test(menu), 'Menu has the new short list');
  await go('tools');
  const tools = await page.evaluate(() => [...document.querySelectorAll('a.tn-tile')].map(a => a.getAttribute('href')));
  const dead = await page.evaluate(hs => hs.filter(h => !V[h.slice(1)] && !PP_ROUTES[h.slice(1)]), tools);
  ok(tools.length === 6 && !dead.length, 'Tools page lists every tool and each one opens (' + tools.length + ')' + (dead.length ? ' missing: ' + dead : ''));
  await shot('tools');
  await go('home'); await shot('home');
  ok(await page.evaluate(() => document.querySelectorAll('#mostCopied .toprow').length > 0), 'Home shows the most copied photos');

  // ---- Copies found: rows
  await go('found'); await shot('found');
  const f0 = await page.evaluate(() => ({ tab: state.fFilter, rows: document.querySelectorAll('.frow.crow').length, links: document.querySelectorAll('.crow a.curl[href^="https://"]').length, btns: document.querySelectorAll('.crow [data-act="rowans"]').length, more: document.querySelectorAll('.morerow').length }));
  console.log(JSON.stringify(f0));
  ok(f0.tab === 'New' && f0.rows > 0 && f0.links === f0.rows && f0.btns >= f0.rows * 3, 'Copies found opens on New; each row has its link and answer buttons');
  // a row answer, no panel needed
  const id1 = await page.evaluate(() => document.querySelector('.crow [data-act="rowans"]').dataset.v.replace(/^[a-z]+\|/, ''));
  await page.click('.crow [data-act="rowans"]'); await page.waitForTimeout(900);
  ok(await page.evaluate(async id => (await FC.DB.get('copies', id)).status, id1) === 'stolen', 'Stolen button on a row answers it');
  ok(await page.evaluate(id => !document.querySelector(`.crow [data-v="stolen|${CSS.escape(id)}"]`), id1), 'The answered row leaves the New list');
  // three more answers, then the undo list takes back the middle one
  const ids = [];
  for (let i = 0; i < 3; i++) { ids.push(await page.evaluate(() => document.querySelector('.crow [data-act="rowans"][data-v^="licensed|"]').dataset.v.replace(/^[a-z]+\|/, ''))); await page.click('.crow [data-act="rowans"][data-v^="licensed|"]'); await page.waitForTimeout(700); }
  await page.click('#undoBtn [data-undolist]'); await page.waitForTimeout(300); await shot('undo-list');
  const un = await page.evaluate(() => document.querySelectorAll('#undoMenu [data-undo]').length);
  await page.evaluate(() => document.querySelectorAll('#undoMenu [data-undo]')[1].click()); await page.waitForTimeout(900);
  const sts = await page.evaluate(async ids => Promise.all(ids.map(async i => (await FC.DB.get('copies', i)).status)), ids);
  ok(un === 4 && sts.join() === 'licensed,new,licensed', 'Undo list shows the last answers and takes back just the one picked (' + sts.join() + ')');
  // the link on a row opens their page in a new tab and does not open the panel
  await page.waitForTimeout(1500);
  const before = ctx.pages().length;
  await page.click('.crow a.curl'); await page.waitForTimeout(1500);
  ok(ctx.pages().length === before + 1 && await page.evaluate(() => !state.open), 'The link on a row opens their page in a new tab');
  for (const p of ctx.pages().slice(before)) await p.close();
  // ⋯ menu
  await page.click('.crow [data-act="rowmenu"]'); await page.waitForTimeout(300); await shot('row-menu');
  const mi = await page.evaluate(() => [...document.querySelectorAll('#rowMenu button')].map(b => b.textContent.trim()));
  ok(mi.some(t => /every client/i.test(t)) && mi.some(t => /Compare/.test(t)) && mi.some(t => /evidence report/i.test(t)) && mi.some(t => /Capture/.test(t)) && await page.evaluate(() => document.querySelectorAll('#rowMenu [data-act="mhide"]').length > 0), 'The ⋯ menu has approve, hide, compare, evidence and capture');
  const mid = await page.evaluate(() => document.querySelector('#rowMenu [data-act="mdo"][data-v^="okall|"]').dataset.v.replace(/^[a-z]+\|/, ''));
  await page.click('#rowMenu [data-act="mdo"][data-v^="okall|"]'); await page.waitForTimeout(1200);
  ok(await page.evaluate(async id => (await FC.DB.get('copies', id)).status, mid) === 'licensed' && await page.evaluate(() => !document.getElementById('rowMenu')), 'Approve site from the ⋯ menu works and the menu closes');
  await page.keyboard.press('u'); await page.waitForTimeout(900);

  // ---- filters
  const cnt = () => page.evaluate(() => LIST.length);
  const all = await cnt();
  await page.click('[data-act="qtoggle"][data-v="sus"]'); await page.waitForTimeout(500);
  const sus = await page.evaluate(() => ({ n: LIST.length, okAll: LIST.every(id => FCD.copies.find(c => c.id === id).risk.level === 'sus') }));
  ok(sus.n > 0 && sus.n < all && sus.okAll, 'Quick filter "Suspicious sites" shows only those (' + sus.n + ' of ' + all + ')');
  await shot('found-chip');
  await page.click('[data-act="qtoggle"][data-v="sus"]'); await page.waitForTimeout(400);
  ok(await cnt() === all, 'Clicking the chip again takes the filter off');
  await page.evaluate(() => { state.showFilters = true; return render(true); }); await page.waitForTimeout(400);   // calm look: Found and Match live in Filters
  for (const [k, v, test, name] of [
    ['fWhen', 'week', `c => Date.now() - new Date(c.firstSeen) < 7 * 864e5 + 6e4`, 'Found: this week'],
    ['fMatch', 'exact', `c => matchKind(c) === 'exact'`, 'Match: Exact'],
  ]) {
    await page.click(`[data-dd="${k}"] > summary`); await page.click(`[data-act="fset"][data-v="${k}|${v}"]`); await page.waitForTimeout(500);
    const r = await page.evaluate(t => ({ n: LIST.length, good: LIST.every(id => (0, eval)('(' + t + ')')(FCD.copies.find(c => c.id === id))) }), test).catch(async () => page.evaluate(() => ({ n: LIST.length, good: null })));
    ok(r.n > 0 && r.n < all && r.good !== false, name + ' narrows the list (' + r.n + ')');
    await page.evaluate(k => { state[k] = 'any'; render(true); }, k); await page.waitForTimeout(400);
  }
  for (const g of ['photo', 'site', 'owner', 'list', 'client']) {
    const has = await page.evaluate(g => !!document.querySelector(`[data-act="fset"][data-v="fView|${g}"]`), g);
    if (!has) continue;
    await page.click('[data-dd="fView"] > summary'); await page.click(`[data-act="fset"][data-v="fView|${g}"]`); await page.waitForTimeout(600);
    const r = await page.evaluate(() => ({ heads: document.querySelectorAll('.ghead:not(.weakhead)').length, rows: document.querySelectorAll('.crow').length }));
    ok(r.rows > 0 && (g === 'list' ? r.heads === 0 : r.heads > 0), 'Group by ' + g + ': ' + r.heads + ' groups, ' + r.rows + ' rows');
    if (g === 'photo') await shot('found-by-photo');
  }
  // year and quarter
  const yq = await page.evaluate(() => { const c = FCD.copies.find(c => c.status === 'new'); const p = FCD.photos.get ? FCD.photos.get(c.photo) : null; return p ? { y: p.year, q: p.quarter } : null; });
  if (yq) {
    await page.evaluate(y => { state.fYear = String(y.y); state.fQuarter = String(y.q); render(true); }, yq); await page.waitForTimeout(500);
    const r = await page.evaluate(y => ({ n: LIST.length, good: LIST.every(id => { const p = FCD.photos.get(FCD.copies.find(c => c.id === id).photo); return p.year == y.y && p.quarter == y.q; }) }), yq);
    ok(r.n > 0 && r.good, 'Year and quarter filter shows only ' + yq.y + ' Q' + yq.q + ' (' + r.n + ')');
    await page.evaluate(() => { state.fYear = 'Any'; state.fQuarter = 'Any'; render(true); });
  } else ok(false, 'Year and quarter filter (could not read a photo)');

  // ---- many copies on one site fold up, and can be answered together
  const fold = await page.evaluate(async () => {
    const news = FCD.copies.filter(c => c.status === 'new').slice(0, 6);
    for (const [i, n] of news.entries()) { const r = await FC.DB.get('copies', n.id); r.site = 'bigblog.example'; r.country = ''; r.match = 'same'; r.pct = 92; r.url = 'https://bigblog.example/post/' + i; r.key = 'bigblog.example/post/' + i; await FC.DB.put('copies', r); }
    FCD = null; await loadFC(); state.open = ''; state.exp = []; state.fView = 'list'; state.fq = 'bigblog.example'; state.fFilter = 'New'; render(true);
    await new Promise(r => setTimeout(r, 700));
    return { ids: news.map(n => n.id), rows: document.querySelectorAll('.crow').length, more: (document.querySelector('.morerow') || {}).textContent || '' };
  });
  console.log(JSON.stringify({ rows: fold.rows, more: fold.more.slice(0, 80) }));
  ok(fold.rows < 6 && /more from/i.test(fold.more), 'Six copies on one site fold into "more from this site"');
  await shot('found-fold');
  await page.click('.morerow [data-act="siteall"][data-v^="stolen"]'); await page.waitForTimeout(1200);
  const fs = await page.evaluate(async ids => (await Promise.all(ids.map(i => FC.DB.get('copies', i)))).map(c => c.status), fold.ids);
  ok(fs.every(s => s === 'stolen'), 'One click answers every copy from that site (' + fs.filter(s => s === 'stolen').length + ' of 6)');
  await page.keyboard.press('u'); await page.waitForTimeout(1000);
  const fb = await page.evaluate(async ids => (await Promise.all(ids.map(i => FC.DB.get('copies', i)))).map(c => c.status), fold.ids);
  ok(fb.every(s => s === 'new'), 'and one Undo puts them all back');

  // ---- top search box
  await page.evaluate(() => { state.fq = ''; render(true); });
  await page.fill('#ppSearch', 'bigblog'); await page.waitForTimeout(800);
  ok(await page.evaluate(() => LIST.length >= 1 && LIST.every(id => FCD.copies.find(c => c.id === id).site === 'bigblog.example') && /5 more from bigblog/.test(document.querySelector('.morerow').textContent)), 'The search box at the top finds copies by site');
  await page.fill('#ppSearch', ''); await page.waitForTimeout(600);
  // ---- group by site: each site gets its strip
  await page.evaluate(() => { state.fView = 'site'; state.fFilter = 'New'; render(true); }); await page.waitForTimeout(700);
  const strip = await page.evaluate(() => ({ n: document.querySelectorAll('.ghead .strip').length, txt: (document.querySelector('.ghead .strip') || {}).textContent || '', btn: !!document.querySelector('.ghead [data-act="stripok"]') }));
  ok(strip.n > 0 && strip.btn, 'Group by site: each site has its strip with Approve site (' + strip.txt.replace(/\s+/g, ' ').slice(0, 70) + ')');
  await shot('found-by-site');
  await page.evaluate(() => { state.fView = 'list'; render(true); });

  // ---- details panel: site strip, their page, the kept copy
  const one = await page.evaluate(async b => {
    const c = FCD.copies.find(c => c.status === 'new' && c.site === 'bigblog.example');
    const r = await FC.DB.get('copies', c.id); r.url = b + '/story'; r.img = b + '/pic.png'; await FC.DB.put('copies', r);
    FCD = null; await loadFC(); state.fq = 'bigblog.example'; state.dView = 'page'; state.open = c.id; render(true);
    return c.id;
  }, base);
  await page.waitForTimeout(6000);
  await shot('panel');
  const pn = await page.evaluate(async id => ({ frame: !!document.querySelector('#pgframe'), cover: !!document.querySelector('#pgcover'), saved: await FC.pages.get(id).catch(() => null), nav: document.querySelectorAll('#drawer [data-act="dstep"]').length }), one);
  ok(pn.nav === 2, 'Details panel has previous and next');
  ok(pn.frame && !pn.cover, 'Their page shows inside the panel, even though the site refuses to be framed');
  ok(pn.saved && /^data:image\/jpeg/.test(pn.saved.pic || ''), 'A small picture of their page is kept (' + (pn.saved ? Math.round(pn.saved.pic.length * 0.75 / 1024) + ' KB' : 'none') + ')');
  const frameOk = await page.frames().find(f => f.url().startsWith(base)); ok(!!frameOk, 'The small window really loaded their page');
  await page.evaluate(() => { state.open = ''; render(true); }); await page.waitForTimeout(300);
  await page.evaluate(id => { state.open = id; render(true); }, one); await page.waitForTimeout(1200);
  ok(await page.evaluate(() => !!document.querySelector('#pgbox .pgshot img') && !document.querySelector('#pgframe')), 'Next time the saved picture shows straight away, no reload of their page');
  await shot('panel-saved');
  await page.click('[data-act="keptnow"]'); await page.waitForTimeout(1500);
  const kp = await page.evaluate(async id => { const k = await FC.kept.get(id); return k ? { size: k.size, sha: k.sha.length, type: k.type, line: document.getElementById('keptline').textContent } : null; }, one);
  ok(kp && kp.size > 0 && kp.sha === 64 && /kept/i.test(kp.line), 'Keep it now saves their copy with its fingerprint');
  // a new find keeps their picture by itself
  const auto = await page.evaluate(async b => {
    const p = (await FC.DB.all('photos')).find(p => p.hash);
    await FC.ingest({ fcId: p.id, name: p.name, hash: p.hash, w: 10, h: 10 }, [{ url: 'https://fresh.example/a', key: 'fresh.example/a', site: 'fresh.example', img: b + '/pic.png?2', engines: ['google'], verdict: 'same', pct: 90 }], 'a search');
    for (let i = 0; i < 40; i++) { const k = await FC.kept.get(p.id + '|fresh.example/a'); if (k) return { size: k.size }; await new Promise(r => setTimeout(r, 250)); }
    return null;
  }, base);
  ok(!!auto, 'A new find keeps their picture by itself');
  const pr = await page.evaluate(async id => {
    const r = await FC.DB.get('copies', id); r.status = 'removed'; r.answered = new Date(Date.now() - 9 * 864e5).toISOString(); await FC.DB.put('copies', r);
    const n = await FC.pruneKept(); return { n, left: !!(await FC.kept.get(id)) };
  }, one);
  ok(!pr.left, 'A kept picture is deleted a week after its copy is removed');

  // ---- sister sites: the same photo on another site of the same owner is offered together
  await go('found');
  const sis = await page.evaluate(async () => {
    await loadFC();
    const o = [...new Set(FCD.ownerOf.values())].find(o => o.real && o.sites.length >= 2);
    if (!o) return null;
    const two = FCD.copies.filter(c => c.status === 'new').slice(0, 2);
    for (const [i, c] of two.entries()) { const r = await FC.DB.get('copies', c.id); r.site = o.sites[i]; r.photo = two[0].photo; r.client = two[0].client; r.url = 'https://' + o.sites[i] + '/same-story'; await FC.DB.put('copies', r); }
    FCD = null; await loadFC(); Object.assign(state, { fView: 'list', fFilter: 'New', fq: o.sites[0], open: '', exp: [] }); render(true);
    await new Promise(r => setTimeout(r, 700));
    return { a: two[0].id, b: two[1].id, owner: o.name };
  });
  if (sis) {
    await page.click('.crow [data-act="rowans"][data-v^="stolen|"]'); await page.waitForTimeout(1000);
    const bar = await page.evaluate(() => (document.querySelector('.bulk.sis') || {}).textContent || '');
    ok(/sister site/.test(bar), 'After Stolen, the same photo on a sister site is offered (' + bar.replace(/\s+/g, ' ').slice(0, 60) + ')');
    await shot('sister');
    await page.click('.bulk.sis [data-act="sisall"]'); await page.waitForTimeout(1000);
    ok(await page.evaluate(async id => (await FC.DB.get('copies', id)).status, sis.b) === 'stolen', 'One click marks the sister-site copy stolen too');
  } else ok(false, 'Sister sites (no owner with two sites in the pretend library)');

  // ---- a narrow window (half a screen) gives the page the whole width, and the older tools wear the new look
  await page.setViewportSize({ width: 880, height: 800 }); await go('found');
  const nw = await page.evaluate(() => ({ view: document.getElementById('view').getBoundingClientRect().width, over: document.documentElement.scrollWidth > innerWidth + 2 }));
  ok(nw.view > 700 && !nw.over, 'Narrow window: the page uses the full width (' + Math.round(nw.view) + ' px) and does not scroll sideways');
  await page.setViewportSize({ width: 1440, height: 900 }); await go('inspect');
  const tf = page.frames().find(f => /inspect\.html/.test(f.url()));
  const tl = tf ? await tf.evaluate(() => ({ bg: getComputedStyle(document.getElementById('side')).backgroundImage, brand: getComputedStyle(document.querySelector('#side .brand')).display })) : null;
  ok(tl && tl.bg === 'none' && tl.brand === 'none', 'Older tools: the side panel has the new look and no second logo inside PageProof');

  // ---- one at a time, and both themes on the main pages
  await go('review'); await shot('review');
  ok(await page.evaluate(() => !!document.querySelector('.pair img, .swipe img')), 'One at a time still shows both pictures');
  for (const th of ['dark', 'light']) {
    await page.evaluate(t => { document.documentElement.dataset.theme = t; }, th);
    for (const h of ['home', 'found', 'clients', 'keep', 'tools']) { await page.evaluate(h => { location.hash = h; }, h); await page.waitForTimeout(900); await shot(th + '-' + h); }
  }
  await ctx.close(); srv.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
