// UI overhaul batch 7: Settings in sections with an index and one setting per line, switches,
// Light/Dark in Settings; Is everything working summary + grouped tiles; the funnel; hidden sites
// with letter badges and coloured kinds; Help as even tiles.
const { start } = require('./h.js');
process.env.NP = 200; process.env.NC = 60;
const { seed } = require('./seed.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage(); await page.setViewportSize({ width: 1400, height: 900 });
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(1000); await seed(page);

  await page.goto(url('app.html#settings')); await page.waitForTimeout(1500);
  const s = await page.evaluate(() => ({
    subs: [...document.querySelectorAll('.side .subs a')].map(a => a.textContent.trim()), groups: [...document.querySelectorAll('.sx-group h3')].map(x => x.textContent),
    rows: document.querySelectorAll('.sx-page .sx-row').length, ticks: document.querySelectorAll('.sx-page input[type=checkbox]:not(.switch input)').length,
    switches: document.querySelectorAll('.sx-page .switch input').length, theme: !!document.querySelector('#themeSet [data-v="dark"]'),
  }));
  ok(s.subs.join('|') === 'General|Searching|Site lists|Backups and team|Health|Help and about', 'Settings: six pages in the menu: ' + s.subs.join(', '));
  ok(s.groups.join('|') === 'You|Look|Capturing|Toolbar and shortcuts|About' && s.rows >= 8, 'Settings › General: one setting per row, in 5 groups (' + s.rows + ' rows)');
  ok(s.ticks === 0 && s.switches >= 1, 'Settings: on/off settings are switches (' + s.switches + '), no tick boxes');
  await page.click('#themeSet [data-v="dark"]'); await page.waitForTimeout(700);
  ok(await page.evaluate(async () => document.documentElement.dataset.theme === 'dark' && (await chrome.storage.local.get('ppTheme')).ppTheme === 'dark'), 'Settings › Colours › Dark switches to dark');
  await page.click('#themeSet [data-v="light"]'); await page.waitForTimeout(700);
  await page.fill('#sxFind', 'speed level'); await page.waitForTimeout(300); await page.keyboard.press('Enter'); await page.waitForTimeout(1200);
  ok(await page.evaluate(() => location.hash === '#ssearch' && !!document.querySelector('#sxSpeed.sx-flash')), 'Find a setting jumps to the setting on its page');

  await page.goto(url('app.html#health')); await page.waitForTimeout(2500);
  const h = await page.evaluate(() => ({ sum: !!document.querySelector('.hsum b'), groups: [...document.querySelectorAll('.hgroup h2')].map(x => x.textContent), tiles: document.querySelectorAll('.htile').length, edge: getComputedStyle(document.querySelector('.htile')).borderLeftWidth }));
  ok(h.sum && h.groups.join('|') === 'Your computer|Searching|Search sites' && h.tiles > 8 && h.edge === '4px', 'Is everything working: summary banner, then tiles in 3 groups with a coloured edge');

  await page.goto(url('app.html#stats')); await page.waitForTimeout(2000);
  ok(await page.evaluate(() => document.querySelectorAll('.st-funnel .fun-r').length === 5), 'How PageProof is doing: From search to copy is a funnel of 5 bars');

  await page.goto(url('app.html#hidden')); await page.waitForTimeout(1800);
  const hd = await page.evaluate(() => { const n = document.querySelector('.hidname'); return { badge: !!(n && n.querySelector('.sl')), mono: n ? /mono/i.test(getComputedStyle(n).fontFamily) : true, kind: !!document.querySelector('.kind.k-whole, .kind.k-sub, .kind.k-acct, .kind.k-end'), bar: !!document.querySelector('.hidtabs .tabs') }; });
  ok(hd.badge && !hd.mono && hd.kind && hd.bar, 'Hidden sites: normal letters with a letter badge, coloured kind chips, tabs in one switch bar');

  await page.goto(url('app.html#help')); await page.waitForTimeout(2500);
  const hp = await page.evaluate(() => { const t = [...document.querySelectorAll('.helptiles .start')]; return { n: t.length, row: new Set(t.map(x => Math.round(x.offsetTop / 20))).size, keys: t.some(x => /Keyboard keys/.test(x.textContent)) }; });
  ok(hp.n === 5 && hp.row === 1 && hp.keys, 'Help: 5 even tiles in one row, with Keyboard keys');
  await page.click('.helptiles [data-act="keyhelp"]'); await page.waitForTimeout(500);
  ok(await page.evaluate(() => { const k = document.getElementById('keyhelp'); return !!k && !k.hidden; }), 'The Keyboard keys tile opens the keys help');
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e); process.exit(1); });
