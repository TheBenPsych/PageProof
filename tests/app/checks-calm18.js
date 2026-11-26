// The calm look, step 18 (part 1): Settings. Six pages in the menu, every setting as one row with
// its switch or button on the right, folds for the longer explanations, Find a setting on every
// page, and a small dot in the menu when Backups need a look. General, Searching and Backups and
// team are checked here; the switches must still save exactly what they saved before.
process.env.NP = process.env.NP || '200'; process.env.NC = process.env.NC || '5';   // before seed.js is read
const { start } = require('./h.js'); const { seed } = require('./seed.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(1200);
  await seed(page);
  const go = async (r, ms = 1500) => { await page.goto(url('app.html#' + r)); await page.waitForTimeout(ms); };
  const get = k => page.evaluate(async k => (await chrome.storage.local.get(k))[k], k);

  // ---------- General
  await go('settings');
  const g = await page.evaluate(() => ({
    h1: document.querySelector('.head h1').textContent.replace(/\s+/g, ' ').trim(), crumb: document.getElementById('crumb').textContent,
    subs: [...document.querySelectorAll('.side .subs a')].map(a => [a.textContent.trim(), a.getAttribute('href'), a.classList.contains('on')]),
    groups: [...document.querySelectorAll('.sx-group h3')].map(x => x.textContent), cols: document.querySelectorAll('.sx-cols > .sx-col').length,
    find: !!document.getElementById('sxFind'), old: document.querySelectorAll('.sindex, .ssec, .sline').length,
    name: document.getElementById('sName').value, ver: document.getElementById('sxAbout').textContent, news: !!document.querySelector('#sxAbout a[href="#whatsnew"]'),
    two: (() => { const c = document.querySelectorAll('.sx-cols > .sx-col'); return c[1].getBoundingClientRect().left > c[0].getBoundingClientRect().right; })(),
  }));
  ok(/^Settings ?› ?General$/.test(g.h1) && /Settings › General/.test(g.crumb), 'General: the title says Settings › General (' + g.h1 + ')');
  ok(g.subs.map(x => x[0]).join('|') === 'General|Searching|Site lists|Backups and team|Health|Help and about' && g.subs.map(x => x[1]).join(' ') === '#settings #ssearch #hidden #backups #health #help' && g.subs[0][2], 'The Settings menu has the six new pages, General lit');
  ok(g.groups.join('|') === 'You|Look|Capturing|Toolbar and shortcuts|About' && g.cols === 2 && g.two, 'General: five groups in two columns');
  ok(g.find && g.old === 0, 'General: Find a setting is there, the old index and sections are gone');
  ok(/PageProof \d+\.\d+/.test(g.ver) && g.news && !/up to date/i.test(g.ver), 'About says the version with a What\'s new button, and makes no "up to date" claim');
  await page.fill('#sName', 'Sam Tester'); await page.dispatchEvent('#sName', 'change'); await page.waitForTimeout(500);
  ok(await page.evaluate(async () => (await getName()) === 'Sam Tester'), 'Your name still saves');
  await page.click('#textsize [data-v="large"]'); await page.waitForTimeout(900);
  ok(await get('ppTextSize') === 'large' && await page.evaluate(() => document.querySelector('#textsize [data-v="large"]').classList.contains('on')), 'Text size: Large saves and lights up');
  await page.click('#textsize [data-v="normal"]'); await page.waitForTimeout(900);
  await page.click('#themeSet [data-v="dark"]'); await page.waitForTimeout(900);
  const dark = await page.evaluate(() => ({ t: document.documentElement.dataset.theme, row: getComputedStyle(document.querySelector('.sx-row')).backgroundColor, ink: getComputedStyle(document.querySelector('.sx-tt > b')).color }));
  const lum = c => { const m = c.match(/[\d.]+/g).map(Number); return (m[0] * 299 + m[1] * 587 + m[2] * 114) / 1000; };
  ok(dark.t === 'dark' && lum(dark.row) < 90 && lum(dark.ink) > 170, 'Colours: Dark turns the rows dark with light words');
  await page.click('#themeSet [data-v="light"]'); await page.waitForTimeout(900);
  // the pop-ups switch sits on a row that folds: pressing the switch must not fold the row
  const f0 = await page.evaluate(() => document.getElementById('popSet').open);
  await page.click('#popSet .switch'); await page.waitForTimeout(500);
  ok(await get('ppPopups') === false && await page.evaluate(() => document.querySelector('#popSet .wswl').textContent) === 'Off' && await page.evaluate(() => document.getElementById('popSet').open) === f0, 'Close pop-ups: the switch saves Off, says Off, and leaves its fold alone');
  await page.click('#popSet .switch'); await page.waitForTimeout(400);
  ok(await get('ppPopups') === true, 'and saves On again');
  // folds remember how you left them
  await page.click('#sxPin > summary'); await page.waitForTimeout(300);
  await page.evaluate(() => render(true)); await page.waitForTimeout(800);
  ok(await page.evaluate(() => document.getElementById('sxPin').open && /Open full PageProof/.test(document.getElementById('sxPin').textContent)), 'A fold you opened stays open when the page is drawn again');
  ok(await page.evaluate(() => /On a photo/.test(document.getElementById('sxRc').textContent) && /Capture the linked page/.test(document.getElementById('sxRc').textContent) && !!document.querySelector('#sxShort [data-act="shortcuts"]') && !!document.getElementById('shortcut2')), 'Toolbar and shortcuts: the capture shortcut with Change, and the right-click menu list');

  // ---------- Find a setting
  await page.fill('#sxFind', 'zzzz'); await page.waitForTimeout(250);
  ok(await page.evaluate(() => !document.getElementById('sxFound').hidden && /No setting/.test(document.getElementById('sxFound').textContent)), 'Find a setting: says so when nothing matches');
  await page.fill('#sxFind', 'new computer'); await page.waitForTimeout(250);
  ok(await page.evaluate(() => { const b = document.querySelectorAll('#sxFound button'); return b.length === 1 && /Moving to a new computer/.test(b[0].textContent) && /Backups and team/.test(b[0].textContent); }), 'Find a setting: "new computer" finds Moving to a new computer and names its page');
  await page.keyboard.press('Enter'); await page.waitForTimeout(1800);
  ok(await page.evaluate(() => location.hash === '#backups' && document.getElementById('sxMoving').open && document.getElementById('sxMoving').classList.contains('sx-flash')), 'Enter opens that page, opens the fold and lights the row up');
  await page.fill('#sxFind', 'text size'); await page.waitForTimeout(250); await page.click('#sxFound button'); await page.waitForTimeout(1500);
  ok(await page.evaluate(() => location.hash === '#settings' && document.getElementById('textsize').classList.contains('sx-flash')), 'A click on a result works the same way');

  // ---------- Searching
  await go('ssearch');
  const s = await page.evaluate(() => ({
    h1: document.querySelector('.head h1').textContent.replace(/\s+/g, ' ').trim(), on: (document.querySelector('.side .subs a.on') || {}).textContent,
    groups: [...document.querySelectorAll('.sx-group h3')].map(x => x.textContent), picks: [...document.querySelectorAll('.sx-pick')].map(b => [b.dataset.v, b.classList.contains('on'), b.getAttribute('aria-checked')]),
    tiles: [...document.querySelectorAll('#sxLimits > div')].map(d => d.textContent), pc: document.getElementById('sxPc').textContent, sel: document.getElementById('hwsel').value,
    keep: document.getElementById('sxKeep').getAttribute('href'), back: document.getElementById('sxBack').textContent,
  }));
  ok(/Searching$/.test(s.h1) && /Searching/.test(s.on) && s.groups.join('|') === 'Where searches run|While searching|This computer', 'Searching: its own page with three groups');
  ok(s.picks.length === 2 && s.picks[0][0] === 'window' && s.picks[0][1] && s.picks[0][2] === 'true' && !s.picks[1][1], 'Where searches run: two picture choices, Separate minimized window chosen');
  await page.click('.sx-pick[data-v="pinned"]'); await page.waitForTimeout(900);
  ok(await get('ppSearchPlace') === 'pinned' && await page.evaluate(() => document.querySelector('.sx-pick[data-v="pinned"]').classList.contains('on')), 'Pinned tabs saves and is shown as chosen');
  await page.click('.sx-pick[data-v="window"]'); await page.waitForTimeout(900);
  ok(await get('ppSearchPlace') === 'window', 'and back to the separate window');
  await page.click('#sxAcct .switch'); await page.waitForTimeout(400); await page.click('#sxPages .switch'); await page.waitForTimeout(400);
  ok(await get('ppAcctRead') === false && await get('fcPageAuto') === false && await page.evaluate(() => document.querySelector('#sxAcct .wswl').textContent + document.querySelector('#sxPages .wswl').textContent) === 'OffOff', 'Read account details and Show their pages: both switches save and say Off');
  await page.click('#sxAcct .switch'); await page.click('#sxPages .switch'); await page.waitForTimeout(500);
  ok(await get('ppAcctRead') === true && await get('fcPageAuto') === true, 'and On again');
  ok(s.keep === '#keep' && /cores/.test(s.pc) && /GB memory/.test(s.pc) && /computer/.test(s.pc), 'Keep searching is a row that opens its page; This computer says cores and memory with its level');
  ok(s.tiles.length === 5 && /photo check/.test(s.tiles[0]) && /search tab/.test(s.tiles[1]) && /downloaded at once/.test(s.tiles[2]) && /pace/.test(s.tiles[3]) && /memory/.test(s.tiles[4]), 'Five limit tiles: ' + s.tiles.map(t => t.replace(/([\d.]+|Faster|Steady)(.*)/, '$1')).join(', '));
  ok(s.sel === 'auto' && /safe search speed/.test(s.back) && /battery below 30%/.test(s.back), 'Speed level is a list set to Let PageProof decide; the backs-off fold keeps its notes');
  await page.selectOption('#hwsel', 'Light'); await page.waitForTimeout(1200);
  const li = await page.evaluate(async () => ({ hw: (await chrome.storage.local.get('ppHw')).ppHw, tile: document.querySelector('#sxLimits > div b').textContent, tag: document.querySelector('#sxPc .sx-tag').textContent, warn: document.querySelector('#sxPc .sx-tag').classList.contains('warn') }));
  ok(li.hw.choice === 'Light' && li.tile === '1' && /Light computer/.test(li.tag) && li.warn, 'Picking Light saves, and the tiles and the tag change with it');
  await page.selectOption('#hwsel', 'auto'); await page.waitForTimeout(900);

  // ---------- old addresses
  for (const [from, to, row] of [['browser', '#settings', 'sxPin'], ['computer', '#ssearch', 'sxPc'], ['moving', '#backups', 'sxMoving']]) {
    await go(from, 1600);
    ok(await page.evaluate(([to, row]) => location.hash === to && !!document.getElementById(row), [to, row]), 'The old address #' + from + ' opens ' + to);
  }
  for (const [r, sub] of [['stats', 'Health'], ['whatsnew', 'Help and about'], ['team', 'Backups and team'], ['hidden', 'Site lists']]) {
    await go(r, 1500);
    ok(await page.evaluate(sub => (document.querySelector('.side .subs a.on') || {}).textContent.trim() === sub && document.getElementById('view').textContent.length > 200, sub), '#' + r + ' still opens and lights ' + sub + ' in the menu');
  }
  ok(await page.evaluate(() => { const d = document.getElementById('sxLists'); return !!d && !!d.querySelector('[data-act="popnow"]') && !!d.querySelector('[data-act="badnow"]') && d.previousElementSibling.classList.contains('head'); }), 'Site lists: the popularity list and the known bad site lists sit at the top, each with Download now');

  // ---------- Backups and team: nothing set up yet
  await go('backups', 2200);
  const b0 = await page.evaluate(() => ({
    hero: document.getElementById('sxHero').textContent, btn: !!document.querySelector('#sxHero [data-act="bkpick"]'), big: document.querySelector('#sxHero .sx-big').className,
    groups: [...document.querySelectorAll('.sx-group h3')].map(x => x.textContent), photos: document.getElementById('sxPhotos').textContent, docs: !!document.getElementById('sxDocs'), bkf: document.getElementById('sxBkFolder').textContent,
    team: document.getElementById('sxTeam').textContent, dot: !!document.querySelector('.side .subs a[href="#backups"] .sx-navdot'),
  }));
  ok(/not set up yet/.test(b0.hero) && b0.btn && /warn/.test(b0.big), 'Backups and team, before setup: the top card says so with one button, Pick My Drive');
  ok(b0.groups.join('|') === 'Restore a backup|Team lists|Folders PageProof uses|New computer', 'Four groups: Restore a backup, Team lists, Folders PageProof uses, New computer');
  ok(/read only/.test(b0.photos) && b0.docs && /Not set up/.test(b0.bkf) && /Not set up/.test(b0.team), 'The three folders each have a row (your photos says read only), Team lists says Not set up');
  await page.waitForTimeout(1500);
  ok(await page.evaluate(() => !!document.querySelector('.side .subs a[href="#backups"] .sx-navdot')), 'The menu shows a dot beside Backups and team while the backup needs you');

  // ---------- Backups and team: with a backup folder and 6 backups
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const my = await root.getDirectoryHandle('My Drive', { create: true });
    await RS_DB.put('handles', 'bkDir', await my.getDirectoryHandle('PageProof Backup', { create: true }));
    await PP_SYNC.backupNow();
    const dir = await RS_DB.get('handles', 'bkDir');
    let first = null; for await (const k of dir.keys()) { first = k; break; }
    const text = await (await (await dir.getFileHandle(first)).getFile()).arrayBuffer();
    for (let i = 1; i <= 5; i++) { const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); const fh = await dir.getFileHandle(first.replace(/\d{4}-\d{2}-\d{2}/, d), { create: true }); const w = await fh.createWritable(); await w.write(text); await w.close(); }
    state.bkList = null;
  });
  await go('settings', 800); await go('backups', 2500);
  const b1 = await page.evaluate(() => ({
    hero: document.getElementById('sxHero').textContent, big: document.querySelector('#sxHero .sx-big').className, now: !!document.querySelector('#sxHero [data-act="bknow"]'),
    rows: document.querySelectorAll('#sxRestore [data-act="bklook"]').length, more: (document.querySelector('[data-act="sxbkall"]') || {}).textContent || '', bkf: document.getElementById('sxBkFolder').textContent,
  }));
  ok(/Backed up today at/.test(b1.hero) && /ok/.test(b1.big) && b1.now && /Only you can see it/.test(b1.hero), 'After a backup: the card says Backed up today at the time, with Back up now');
  ok(b1.rows === 4 && /Show all \d+ backups/.test(b1.more) && /Connected/.test(b1.bkf), 'Restore a backup shows the newest four and a Show all row (' + b1.more.trim() + '); the backup folder says Connected');
  await page.click('[data-act="sxbkall"]'); await page.waitForTimeout(900);
  const nAll = await page.evaluate(() => document.querySelectorAll('#sxRestore [data-act="bklook"]').length);
  ok(nAll >= 6 && await page.evaluate(() => /Show fewer/.test(document.querySelector('[data-act="sxbkall"]').textContent)), 'Show all lists every backup (' + nAll + ')');
  await page.click('#sxRestore [data-act="bklook"]'); await page.waitForTimeout(1500);
  ok(await page.evaluate(() => { const p = document.getElementById('bkPreview'); return !!p && /After restoring/.test(p.textContent) && !!p.querySelector('[data-act="bkrestore"]') && !!p.querySelector('[data-act="bkcancel"]'); }), 'Bring it back shows now against after restoring, with Restore and Cancel');
  await page.click('[data-act="bkcancel"]'); await page.waitForTimeout(800);
  ok(await page.evaluate(() => !document.getElementById('bkPreview')), 'Cancel closes it and changes nothing');
  if (!await page.evaluate(() => document.getElementById('sxMoving').open)) await page.click('#sxMoving > summary');
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => { const m = document.getElementById('sxMoving'); return m.open && m.querySelectorAll('.sx-steps > li').length === 3 && /Done today at/.test(m.textContent) && /Install<\/b> folder/.test(m.innerHTML); }), 'Moving to a new computer: three steps, the first one already done today');

  // ---------- narrow window: one column, nothing sticks out
  await page.setViewportSize({ width: 1000, height: 900 }); await page.waitForTimeout(600);
  ok(await page.evaluate(() => { const c = document.querySelectorAll('.sx-cols > .sx-col'); return c[1].getBoundingClientRect().top > c[0].getBoundingClientRect().bottom - 2 && document.documentElement.scrollWidth <= innerWidth + 1; }), 'At 1000 wide the two columns stack and nothing sticks out sideways');

  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
