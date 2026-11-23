// 4.8.2: the "new copies" number (menu badge, toolbar dot, side panel) must match Copies found.
// Copies on hidden sites or from hidden countries are not shown, so they must not be counted.
const { start } = require('./h.js');
process.env.NP = 200; process.env.NC = 60;
const { seed } = require('./seed.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, sw, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  await seed(page); await page.reload(); await page.waitForTimeout(1500);
  ok(await sw.evaluate(() => typeof FC !== 'undefined' && typeof FC.countNew === 'function'), 'Background has the copy store');
  // Answer every visible new copy, then put new copies on a hidden site and a hidden country.
  const r = await page.evaluate(async () => {
    const all = await FC.DB.all('copies');
    for (const c of all) if (c.status === 'new') { c.status = 'removed'; await FC.DB.put('copies', c); }
    const base = all[0];
    const mk = (id, site) => ({ ...base, id: base.photo + '|' + id, site, url: 'https://' + site + '/x/' + id, status: 'new', country: '' });
    await FC.DB.put('copies', mk('h1', 'hiddenexample.com'));
    await FC.DB.put('copies', mk('h2', 'hiddenexample.com'));
    await FC.DB.put('copies', mk('r1', 'example.ru'));
    const ru = await FC.countryOf('example.ru');
    await chrome.storage.local.set({ rsHidden: ['hiddenexample.com'], fcHiddenCountries: [ru] });
    await FC.touch('test');
    await new Promise(r => setTimeout(r, 300));
    return { ru, n: await FC.countNew() };
  });
  ok(!!r.ru && r.n === 0, 'Hidden-site and hidden-country copies are not counted (got ' + r.n + ')');
  await page.waitForTimeout(2600);
  ok(await sw.evaluate(() => FC.countNew()) === 0, 'Toolbar count is 0 too');
  await page.goto(url('app.html#found')); await page.waitForTimeout(1500);
  const side = await page.evaluate(() => { const a = [...document.querySelectorAll('#side a, #side button')].find(x => /Copies found/.test(x.textContent)); return a ? a.textContent.replace(/\s+/g, ' ').trim() : ''; });
  ok(!/\d/.test(side), 'Menu shows no number when all caught up ("' + side + '")');
  // Showing the site again brings its copies back into the number.
  await page.evaluate(() => chrome.storage.local.set({ rsHidden: [] }));
  ok(await page.evaluate(() => FC.countNew()) === 2, 'Showing the site again counts its 2 copies');
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
