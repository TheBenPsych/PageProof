// The calm look, step 18 (part 2): Settings › Site lists and Settings › Help and about.
// Site lists: the two downloaded lists on top, six tabs in one line, one command line, a calm
// list with who added each site. Help and about: the version card, the five newest changes, five
// learn tiles and the keys. Hiding, approving, files and undo must work exactly as before.
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
  const tab = async t => { await page.click(`[data-act="hidtab"][data-v="${t}"]`); await page.waitForTimeout(700); };

  // ---------- Site lists
  await page.evaluate(async () => { await RS_LISTS.load(); RS_LISTS.hidden = ['patch.com', 'x.com/examplenews', 'news.bigsite.com', '.gov']; RS_LISTS.allowed = ['partner-news.com']; await RS_LISTS.save(); await chrome.storage.local.set({ rsImports: [] }); });
  await go('hidden', 1800);
  const s = await page.evaluate(() => ({
    h1: document.querySelector('.head h1').textContent.replace(/\s+/g, ' ').trim(), find: !!document.getElementById('sxFind'),
    dl: [...document.querySelectorAll('#sxLists .sx-row b')].map(b => b.textContent), dlBtns: document.querySelectorAll('#sxLists [data-act="popnow"], #sxLists [data-act="badnow"]').length,
    tabs: [...document.querySelectorAll('.sx-pivot .utabs button')].map(b => b.textContent.replace(/\s+/g, ' ').trim()), on: document.querySelector('.sx-pivot .utabs button.on').dataset.v,
    cmd: [...document.querySelectorAll('.sx-cmd > .btn')].map(b => b.textContent.trim()), main: document.querySelectorAll('.sx-cmd > .btn.primary').length, kinds: [...document.querySelectorAll('[data-act="sxkind"] option')].map(o => o.textContent),
    head: [...document.querySelectorAll('.sx-lhead span')].map(x => x.textContent).filter(Boolean), rows: [...document.querySelectorAll('.sx-lrow')].map(r => [...r.children].slice(0, 3).map(c => c.textContent.trim()).join(' / ')),
    foot: document.querySelector('.sx-more').textContent.trim(), old: document.querySelectorAll('.hidtabs, .hidname, table').length,
  }));
  ok(/Site lists$/.test(s.h1) && s.find, 'Site lists: the title says Settings › Site lists, with Find a setting');
  ok(s.dl.join('|') === 'Site popularity list|Known bad site lists' && s.dlBtns === 2, 'The two lists PageProof downloads sit on top, each with Download now');
  ok(s.tabs.length === 6 && /^Hidden 4$/.test(s.tabs[0]) && /^Approved for every client 1$/.test(s.tabs[1]) && /^Social sites \d+$/.test(s.tabs[5]) && s.on === 'hidden', 'Six tabs in one line, each with its count: ' + s.tabs.join(' · '));
  ok(s.cmd.join('|') === 'Hide a site|Add from a file|Download list|Take out a file’s sites' && s.main === 1 && s.kinds.join('|') === 'All kinds|Whole site|Sub-site|Account or part|Ending', 'One command line: Hide a site (the one blue button), Add from a file, Download list, Take out a file’s sites, and a kinds list');
  ok(s.head.join('|') === 'Site or account|What it covers|Added' && s.rows.join(' ; ') === '.gov / Ending / You ; news.bigsite.com / Sub-site / You ; x.com/examplenews / Account or part / You ; patch.com / Whole site / You', 'The list: newest first, each with what it covers and who added it');
  ok(/Showing 4 of 4/.test(s.foot) && s.old === 0, 'The foot says Showing 4 of 4; the old table is gone');
  // hide a site from the box
  await page.fill('#hidq', 'https://www.Copy-Blog.com/'); await page.waitForTimeout(700); await page.click('[data-act="hidadd"]'); await page.waitForTimeout(900);
  ok(await page.evaluate(async () => { await RS_LISTS.load(); return RS_LISTS.hidden.includes('copy-blog.com') && document.querySelector('.sx-lrow .sx-site').textContent === 'copy-blog.com' && document.getElementById('hidq').value === ''; }), 'Typing a site and pressing Hide a site hides it (tidied to copy-blog.com) and clears the box');
  await page.fill('#hidq', 'patch'); await page.waitForTimeout(900);
  ok(await page.evaluate(() => document.querySelectorAll('.sx-lrow').length === 1 && document.activeElement.id === 'hidq' && /Showing 1 of 1/.test(document.querySelector('.sx-more').textContent)), 'The box also finds: one row left, and the cursor stays in the box');
  await page.fill('#hidq', ''); await page.waitForTimeout(800);
  await page.selectOption('[data-act="sxkind"]', 'Ending'); await page.waitForTimeout(800);
  ok(await page.evaluate(() => [...document.querySelectorAll('.sx-lrow .sx-site')].map(x => x.textContent).join() === '.gov'), 'The kinds list narrows the rows (Ending shows .gov only)');
  await page.selectOption('[data-act="sxkind"]', 'All'); await page.waitForTimeout(800);
  await page.click('.sx-lrow [data-act="hidremove"][data-v="copy-blog.com"]'); await page.waitForTimeout(900);
  ok(await page.evaluate(async () => { await RS_LISTS.load(); return !RS_LISTS.hidden.includes('copy-blog.com'); }), 'Show again takes a site off the hidden list');
  // a file: Added says From a file, and Files you added lists it with Undo
  await page.setInputFiles('#hidLoad', { name: 'links.txt', mimeType: 'text/plain', buffer: Buffer.from('https://alpha-news.com/story/1\nhttps://beta-news.com\n') });
  await page.waitForTimeout(1000);
  const f = await page.evaluate(() => ({ who: [...document.querySelectorAll('.sx-lrow')].filter(r => /alpha-news|beta-news/.test(r.textContent)).map(r => r.querySelector('.sx-who').textContent), files: document.getElementById('sxFiles').textContent, undo: !!document.querySelector('#sxFiles [data-act="impundo"]') }));
  ok(f.who.length === 2 && f.who.every(w => /^From a file/.test(w)) && /links\.txt/.test(f.files) && /Added 2 sites/.test(f.files) && f.undo, 'Add from a file: its sites say From a file with the date, and Files you added lists the file with Undo this import');
  await page.click('#sxFiles [data-act="impundo"]'); await page.waitForTimeout(900);
  ok(await page.evaluate(async () => { await RS_LISTS.load(); return RS_LISTS.hidden.length === 4 && /undone/.test(document.getElementById('sxFiles').textContent); }), 'Undo this import takes only that file\'s sites out');
  // the other tabs
  await tab('allowed');
  ok(await page.evaluate(() => document.querySelector('.sx-cmd > .btn.primary').textContent.trim() === 'Approve a site' && [...document.querySelectorAll('.sx-lrow .sx-site')].map(x => x.textContent).join() === 'partner-news.com' && /Remove/.test(document.querySelector('.sx-lact').textContent)), 'Approved for every client: Approve a site is the blue button, rows have Remove');
  await tab('client');
  ok(await page.evaluate(() => !document.querySelector('[data-act="hidadd"]') && !document.querySelector('[data-act="sxkind"]') && /Approve site/.test(document.querySelector('.sxp-sites > .sx-note').textContent) && [...document.querySelectorAll('.sx-lhead span')].map(x => x.textContent).filter(Boolean).join('|') === 'Site|Approved for'), 'Approved for one client: no add button, a line says how to add one from a copy');
  await tab('rejected');
  ok(await page.evaluate(() => [...document.querySelectorAll('.sx-lhead span')].map(x => x.textContent).filter(Boolean).join('|') === 'Link|Photo' && !document.querySelector('[data-act="hidunload"]')), 'Rejected links: Link and Photo columns');
  await tab('stolen');
  await page.setInputFiles('#hidLoad', { name: 'stolen.txt', mimeType: 'text/plain', buffer: Buffer.from('https://taker.example/page/1\nhttps://taker.example/page/2\n') });
  await page.waitForTimeout(1000);
  ok(await page.evaluate(() => document.querySelector('.sx-cmd > .btn.primary').textContent.trim() === 'Add from a file' && document.querySelectorAll('.sx-lrow a.sx-link[target="_blank"]').length === 2 && /Take off the list/.test(document.querySelector('.sx-lact').textContent) && /Added 2 links/.test(document.getElementById('sxFiles').textContent)), 'Stolen before links: Add from a file is the blue button, links open in a new tab, each with Take off the list');
  await tab('social');
  const so = await page.evaluate(() => ({ rows: document.querySelectorAll('.sx-l2 .sx-lrow').length, first: document.querySelector('.sx-l2 .sx-lrow').textContent, sw: !!document.querySelector('#acctread[data-act="acctread"]'), ph: document.getElementById('hidq').placeholder }));
  ok(so.rows >= 15 && /youtube\.com/.test(so.first) && so.sw && /platform/.test(so.ph), 'Social sites: the platforms with the addresses they cover, and the Read account details switch');
  await page.fill('#hidq', 'tiktok'); await page.waitForTimeout(900);
  ok(await page.evaluate(() => document.querySelectorAll('.sx-l2 .sx-lrow').length === 1), 'Find a platform narrows the list');
  await tab('hidden');
  // dark and narrow
  await page.evaluate(() => ppTheme('dark')); await page.waitForTimeout(900);
  const lum = c => { const m = c.match(/[\d.]+/g).map(Number); return (m[0] * 299 + m[1] * 587 + m[2] * 114) / 1000; };
  const dk = await page.evaluate(() => ({ list: getComputedStyle(document.querySelector('.sx-list')).backgroundColor, ink: getComputedStyle(document.querySelector('.sx-site')).color }));
  ok(lum(dk.list) < 90 && lum(dk.ink) > 170, 'Dark: the list is dark grey with light words (' + dk.list + ', ' + dk.ink + ')');
  await page.evaluate(() => ppTheme('light')); await page.waitForTimeout(600);
  await page.setViewportSize({ width: 1000, height: 900 }); await page.waitForTimeout(600);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'At 1000 wide nothing sticks out sideways');
  await page.setViewportSize({ width: 1920, height: 1080 });

  // ---------- Help and about
  await go('help', 1800);
  const h = await page.evaluate(() => ({
    h1: document.querySelector('.head h1').textContent.replace(/\s+/g, ' ').trim(), on: (document.querySelector('.side .subs a.on') || {}).textContent.trim(),
    about: document.getElementById('sxAboutCard').textContent, logo: !!document.querySelector('#sxAboutCard img'), copy: !!document.querySelector('[data-act="sxcopyver"]'),
    news: document.querySelectorAll('#sxNews .sx-row:not(.sx-morerow)').length, all: document.querySelector('#sxNews a.sx-morerow').textContent.trim(), allHref: document.querySelector('#sxNews a.sx-morerow').getAttribute('href'), total: NEWS.length,
    tiles: [...document.querySelectorAll('#sxLearn .sx-tile')].map(t => [t.querySelector('b').textContent, t.tagName, t.getAttribute('href') || t.dataset.act]),
    keys: [...document.querySelectorAll('#sxKeys .sx-keys > span')].map(k => k.textContent), old: document.querySelectorAll('.helptiles').length,
  }));
  ok(/Help and about$/.test(h.h1) && h.on === 'Help and about', 'Help and about: its own page in the Settings menu');
  ok(/PageProof \d+\.\d+\.\d+/.test(h.about) && h.logo && h.copy && /team lead/.test(h.about) && !/up to date/i.test(h.about), 'The version card: logo, version, Copy version, and no "up to date" claim');
  ok(h.news === 5 && h.all === 'See all ' + h.total + ' changes' && h.allHref === '#whatsnew', 'What\'s new shows the five newest changes and a row to see all ' + h.total);
  ok(h.tiles.map(t => t[0]).join('|') === 'Tutorial|Take the tour|Checking a pack|Run setup again|Keyboard keys' && /TUTORIAL\.md/.test(h.tiles[0][2]) && h.tiles[1][2] === 'tour' && /VERIFYING\.md/.test(h.tiles[2][2]) && h.tiles[3][2] === '#setup' && h.tiles[4][2] === 'keyhelp', 'Five learn tiles, each opening what it opened before');
  ok(h.keys.join('|') === 'YStolen|LLicensed|NRemove|UUndo|/Search|?All keys' && h.old === 0, 'A strip with the six keys; the old tiles are gone');
  await page.click('#sxNews a.sx-morerow'); await page.waitForTimeout(1500);
  const w = await page.evaluate(() => ({ hash: location.hash, rows: document.querySelectorAll('.sxp-news .sx-row').length, total: NEWS.length, got: document.querySelectorAll('[data-act="newsseen"]').length, on: (document.querySelector('.side .subs a.on') || {}).textContent.trim() }));
  ok(w.hash === '#whatsnew' && w.rows === w.total && w.got >= 1 && w.on === 'Help and about', 'See all opens every change (' + w.rows + ' rows) with Got it, under Help and about');
  await page.click('[data-act="newsseen"]'); await page.waitForTimeout(1200);
  ok(await page.evaluate(async () => location.hash === '#home' && (await chrome.storage.local.get('ppSeenVersion')).ppSeenVersion === VERSION), 'Got it marks this version as seen and goes Home');
  await go('help', 1500);
  await page.click('#sxLearn [data-act="tour"]'); await page.waitForTimeout(900);
  ok(await page.evaluate(() => state.tour >= 0), 'Take the tour starts the tour');

  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
