// UI overhaul batch 4: clients table badges, star and "Searched once" bar, whole row opens the
// client; photos page headed by the client, corner flags, tag dots, striped "not loaded" tiles;
// site owners ticks. Pretend data only.
const { start } = require('./h.js');
process.env.NP = 200; process.env.NC = 40;
const { seed } = require('./seed.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage(); await page.setViewportSize({ width: 1400, height: 900 });
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(1000); await seed(page);
  await page.goto(url('app.html#clients')); await page.waitForTimeout(2500);
  const c = await page.evaluate(() => ({ av: document.querySelectorAll('.ctable .cav').length, star: document.querySelectorAll('.ctable .starplain').length, rows: document.querySelectorAll('.ctable tr.rowlink').length, old: document.querySelectorAll('.ctable .starbtn, .ctable a.btn').length, name: (document.querySelectorAll('.ctable tr.rowlink .cname')[1] || {}).textContent }));
  ok(c.av > 0 && c.av === c.rows && c.star === c.rows && !c.old, 'Clients: initials badge and plain star on every row, no boxed buttons');
  await page.click('.ctable tr.rowlink:nth-child(2) td.num'); await page.waitForTimeout(1500);
  ok(await page.evaluate(n => location.hash.startsWith('#photos') && state.phClient === n, c.name), 'Clicking a row opens that client\'s photos (' + c.name + ')');
  const p = await page.evaluate(() => ({ head: !!document.querySelector('.clhead select[data-act="phclient"]'), av: !!document.querySelector('.clhead .cav'), corner: document.querySelectorAll('.pcard .ptile .cflags .flagbtn').length, cards: document.querySelectorAll('.pcard').length, dots: document.querySelectorAll('.pcard .tdots .td').length }));
  ok(p.head && p.av, 'Photos page: the heading is the client, with a badge and a switch');
  ok(p.cards > 0 && p.corner === p.cards * 2 && p.dots >= p.cards, 'Photos: ⚑ and ★ on each picture\'s corner, tags as dots');
  await page.goto(url('app.html#owners')); await page.waitForSelector('#ownerSites', { timeout: 60000 });
  ok(await page.evaluate(() => document.querySelectorAll('#ownerWhy .owhy .okc').length > 0 && document.querySelectorAll('#ownerSites .osr .osl').length > 0), 'Site owners: green ticks and letter badges on their sites');
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e); process.exit(1); });
