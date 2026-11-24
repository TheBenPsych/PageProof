// UI overhaul batch 1: Home number tiles, one main button on Home, status inside the menu,
// grouped top bar buttons. Pretend data only.
const { start } = require('./h.js');
process.env.NP = 300; process.env.NC = 80;
const { seed } = require('./seed.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(1200);
  await seed(page); await page.goto(url('app.html#home')); await page.waitForTimeout(2500);
  const r = await page.evaluate(() => ({
    tiles: document.querySelectorAll('#homeTiles .htile').length,
    ring: !!document.querySelector('#homeFirstTile svg'),
    mains: document.querySelectorAll('#homeJobs .btn.primary').length,
    status: !!document.querySelector('#side #statusLine'),
    group: document.querySelectorAll('.top .tgroup button, .top .tgroup a').length,
    undoLabel: (document.querySelector('#undoBtn') || {}).getAttribute ? document.querySelector('#undoBtn').getAttribute('aria-label') : '',
  }));
  ok(r.tiles === 4, 'Home shows 4 number tiles (' + r.tiles + ')');
  ok(r.ring, 'The "searched once" tile has its ring');
  ok(r.mains <= 1, 'At most one big blue button in the job list (' + r.mains + ')');
  ok(r.status, 'The status line sits inside the menu');
  ok(r.group >= 2, 'Undo, help and colours are grouped in the top bar (' + r.group + ')');
  ok(r.undoLabel === 'Undo', 'The icon-only Undo button still has a name for screen readers');
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e); process.exit(1); });
