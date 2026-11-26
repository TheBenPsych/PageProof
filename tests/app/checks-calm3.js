// The calm look, step 3: One at a time. A short title, one control line, the two pictures with
// their names on them, five big answer buttons, a command row, and a side card with the site,
// the match, the Page and Picture links and two tabs (Their page / About this copy).
const { start } = require('./h.js'); const { seed } = require('./seed.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(1200);
  await seed(page);
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'light', fcRvKind: 'web' }));
  await page.goto(url('app.html#review')); await page.waitForSelector('.rvn-ans', { timeout: 30000 }); await page.waitForTimeout(1200);

  const r = await page.evaluate(() => {
    const q = s => document.querySelector(s), box = s => { const e = q(s); return e ? e.getBoundingClientRect() : null; };
    const head = q('#view .head'), ctl = box('.rvn-ctl'), main = box('.rvn-main'), side = box('.rvn-side'), ans = box('.rvn-ans'), cmd = box('.rvn-cmd');
    return {
      title: head.querySelector('h1').textContent.replace(/\s+/g, ' ').trim(), lede: !!head.querySelector('.lede'), allBtn: !!head.querySelector('a.btn[href="#found"]'),
      ctlKids: ['.utabs', '.rvkind', '.rvprog', '[data-act="undo"]', '.vseg'].map(s => { const b = box('.rvn-ctl ' + s); return b ? Math.round(b.top + b.height / 2) : -1; }), ctlH: ctl ? Math.round(ctl.height) : 0,
      tags: [...document.querySelectorAll('.rvn-pics .ptag')].map(t => t.textContent.replace(/\d.*$/, '').trim()), zoom: document.querySelectorAll('.rvn-pics .zoom').length,
      ans: [...document.querySelectorAll('.rvn-ans button')].map(b => b.querySelector('span').textContent), ansH: Math.round(q('.rvn-ans button').getBoundingClientRect().height), ansIcons: document.querySelectorAll('.rvn-ans button svg').length,
      stolenBg: getComputedStyle(q('.rvn-ans .a-st')).backgroundColor, licBg: getComputedStyle(q('.rvn-ans .a-li')).backgroundColor,
      cmd: [...document.querySelectorAll('.rvn-cmd > .btn, .rvn-cmd > details > summary')].map(b => (b.textContent.trim() || b.getAttribute('aria-label') || '').replace(/\s+/g, ' ')),
      stopInMenu: !!q('.rvn-cmd .rvdots [data-act="stopphoto"]') && !q('.rvn-cmd > [data-act="stopphoto"]'),
      site: (q('.rvn-side .rvsite h2') || {}).textContent, match: (q('.rvn-side .mbox') || {}).textContent.replace(/\s+/g, ' ').trim(), chips: document.querySelectorAll('.rvn-side .cchip').length,
      links: [...document.querySelectorAll('.rvn-side .ul')].map(u => u.querySelector('.ulab').textContent.trim() + ':' + (u.querySelector('a.curl') ? 'open' : '') + (u.querySelector('[data-act="copytext"]') ? '+copy' : '')),
      tabs: [...document.querySelectorAll('.rvn-side .stabs button')].map(b => b.textContent.trim()), pane: !!q('.rvn-side .tpane #pgbox'),
      keys: [...document.querySelectorAll('#view p')].some(p => /^Keys:/.test(p.textContent.trim())),
      fits: main && side && Math.abs(main.height - side.height) <= 2 && main.bottom <= innerHeight + 1 && cmd.bottom <= innerHeight, sideW: side ? Math.round(side.width) : 0,
    };
  });
  ok(/Copies found ?› ?One at a time$/.test(r.title) && !r.lede && !r.allBtn, 'The title is "Copies found › One at a time" with no sentence or button beside it (' + r.title + ')');
  ok(r.ctlKids.every(y => y > 0) && Math.max(...r.ctlKids) - Math.min(...r.ctlKids) <= 12 && r.ctlH < 70, 'One control line: the two tabs, All / Websites / Social media, the progress, Undo and the view switch (' + r.ctlKids.join(', ') + ')');
  ok(r.tags.join('|') === "Your client's photo|Their copy" && r.zoom === 2, 'Each picture has its name on its corner and a See it bigger button');
  ok(r.ans.join() === 'Stolen,Licensed,Remove,Check later,Skip' && r.ansH === 60 && r.ansIcons === 5, `Five answer buttons, 60 px tall, each with an icon (${r.ansH})`);
  ok(r.stolenBg === 'rgb(196, 43, 28)' && r.licBg === 'rgb(15, 123, 15)', `Stolen is solid red and Licensed solid green (${r.stolenBg}, ${r.licBg})`);
  ok(['Compare', 'Evidence report', 'Capture', 'Approve site', 'Hide site'].every(n => r.cmd.includes(n)) && r.stopInMenu, 'The command row has Compare, Evidence report, Capture, Approve site, Hide site, and Stop searching this photo is in the ⋯ menu (' + r.cmd.join(', ') + ')');
  ok(r.site && /lines up/.test(r.match) && /Same photo|Maybe the same/.test(r.match) && r.chips === 2, `The side card names the site, the match (${r.match}) and has the client and photo chips`);
  ok(r.links.join() === 'Page:open+copy,Picture:open+copy', 'Page link and Picture link, each with open and copy (' + r.links.join() + ')');
  ok(r.tabs.join() === 'Their page,About this copy' && r.pane, 'The side card has two tabs, Their page first');
  ok(!r.keys, 'The Keys line at the foot is gone');
  ok(r.fits && r.sideW === 560, `Both cards are the same height and fit a 1080p window without scrolling (side ${r.sideW} px)`);

  // About this copy.
  await page.click('[data-act="rvside"][data-v="about"]'); await page.waitForTimeout(500);
  const a = await page.evaluate(() => ({ rows: [...document.querySelectorAll('.rvn-side .rfacts .fk')].map(e => e.textContent), page: !!document.querySelector('.rvn-side #pgbox') }));
  ok(['Found by', 'Seen', 'Site check', 'Country'].every(k => a.rows.includes(k)) && !a.page, 'About this copy lists Found by, Seen, Site check, Country (' + a.rows.join(', ') + ')');
  // The copy button copies the page address.
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const want = await page.evaluate(() => document.querySelector('.rvn-side .ul [data-act="copytext"]').dataset.v);
  await page.click('.rvn-side .ul [data-act="copytext"]'); await page.waitForTimeout(400);
  ok(/Copied/.test(await page.textContent('#toast')) && /^https?:/.test(want), 'The copy button next to the Page link copies its address');
  // The keys still work, and the side tab stays where you left it.
  const before = await page.evaluate(() => state.rvCurrent);
  await page.keyboard.press('ArrowRight'); await page.waitForFunction(b => state.rvCurrent !== b, before, { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ id: state.rvCurrent, about: !!document.querySelector('.rvn-side .tpane.det') }));
  ok(after.id !== before && after.about, 'The → key skips to the next copy even while the page is still redrawing, and About this copy stays open');
  // Swipe view.
  await page.click('.vseg [data-v="swipe"]'); await page.waitForTimeout(600);
  ok(await page.evaluate(() => !!document.querySelector('.rvn-pics #swipe') && !!document.getElementById('cut')), 'Swipe shows one picture with a slider');
  await page.click('.vseg [data-v="side"]'); await page.waitForTimeout(400);

  // By site and company: a list.
  await page.click('[data-act="rvtab"][data-v="sites"]'); await page.waitForTimeout(700);
  const s = await page.evaluate(() => ({ rows: document.querySelectorAll('.slist .srow').length, btn: document.querySelectorAll('.slist .srow [data-act="rvall"]').length, hd: (document.querySelector('.slist .shd') || {}).textContent, grid: !!document.querySelector('#view .grid.g2') }));
  ok(s.rows > 3 && s.btn === s.rows && /Site or company/.test(s.hd) && !s.grid, `By site and company is a list with Mark all stolen on each line (${s.rows} lines)`);

  // Dark.
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'dark' })); await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark', null, { timeout: 10000 });
  await page.click('[data-act="rvtab"][data-v="review"]'); await page.waitForSelector('.rvn-ans'); await page.waitForTimeout(500);
  await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
  const d = await page.evaluate(() => { const s = getComputedStyle(document.querySelector('.rvn-ans .a-st')); return { bg: s.backgroundColor, ink: s.color }; });
  ok(d.bg === 'rgb(255, 153, 164)' && d.ink === 'rgb(0, 0, 0)', `Dark: Stolen is the soft red with black words (${d.bg}, ${d.ink})`);

  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL crashed ' + String(e).slice(0, 400)); process.exit(1); });
