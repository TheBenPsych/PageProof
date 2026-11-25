// 4.56: One at a time can go through Websites only, Social media only, or All; the choice is remembered.
const { start } = require('./h.js');
process.env.NP = 300; process.env.NC = 120;
const { seed } = require('./seed.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  await seed(page);
  // The pretend library has only websites: add a few Instagram copies.
  await page.evaluate(async () => {
    const src = (await FC.DB.all('copies')).filter(c => c.status === 'new').slice(0, 5);
    await FC.DB.putMany('copies', src.map((c, i) => { const url = `https://www.instagram.com/acct${i}/p/POST${i}/`; const x = Object.assign({}, c, { id: c.photo + '|instagram.com/acct' + i + '/p/POST' + i, url, key: 'instagram.com/acct' + i + '/p/POST' + i, site: 'instagram.com', country: '' }); x.use = FC.useOf(x); return x; }));
  });
  await page.reload(); await page.waitForTimeout(1200);
  const n = await page.evaluate(async () => { await RS_LISTS.load(); await loadFC(); return { web: reviewQueue('web').length, soc: reviewQueue('social').length, all: reviewQueue('all').length }; });
  ok(n.web > 0 && n.soc > 0 && n.web + n.soc === n.all, `Pretend library has both kinds (web ${n.web}, social ${n.soc})`);
  await page.goto(url('app.html#review')); await page.waitForTimeout(1500);
  ok(await page.locator('.rvkind button').count() === 3, 'Switch shows All / Websites / Social media');
  ok(/All/.test(await page.textContent('.rvkind .on')), 'Starts on All');
  const soc = () => page.evaluate(() => { const c = FCD.copies.find(x => x.id === state.rvCurrent); return c && isSoc(c); });
  await page.locator('.rvkind [data-v="social"]').click(); await page.waitForTimeout(800);
  ok(await soc() === true && new RegExp(n.soc + '$').test((await page.textContent('.rvprog b')).trim()), 'Social media: only social copies, counted right');
  await page.locator('.rvans [data-v="skip"]').click(); await page.waitForTimeout(800);
  ok(await soc() === true, 'After an answer the next copy is still social');
  await page.locator('.rvkind [data-v="web"]').click(); await page.waitForTimeout(800);
  ok(await soc() === false, 'Websites: only website copies');
  await page.reload(); await page.waitForTimeout(1500);
  ok(/Websites/.test(await page.textContent('.rvkind .on')), 'Choice remembered after reopening');
  // From the Copies found Social media tab, One at a time starts on Social media.
  await page.goto(url('app.html#found')); await page.waitForTimeout(1200);
  await page.locator('[data-act="ftab"][data-v="social"]').click(); await page.waitForTimeout(800);
  await page.locator('a[href^="#review?kind"]').first().click(); await page.waitForTimeout(1500);
  ok(/Social media/.test(await page.textContent('.rvkind .on')) && await soc() === true, 'One at a time from the Social media tab starts on Social media');
  await ctx.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
