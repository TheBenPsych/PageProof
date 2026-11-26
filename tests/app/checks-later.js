// 4.57: "Check later" moves a copy out of New into its own Check later tab. Undo (U) brings it back.
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
  const st = id => page.evaluate(async id => (await FC.DB.get('copies', id)).status, id);
  const tabN = f => page.evaluate(f => { const b = [...document.querySelectorAll('[data-act="ffilter"]')].find(x => x.dataset.v === f); return b ? +b.querySelector('span').textContent : -1; }, f);
  // One at a time: the button and the C key.
  await page.goto(url('app.html#review')); await page.waitForTimeout(1500);
  ok(await page.locator('.rvans [data-v="later"]').count() === 1, 'One at a time has a Check later button');
  let id = await page.evaluate(() => state.rvCurrent);
  await page.locator('.rvans [data-v="later"]').click(); await page.waitForTimeout(900);
  ok(await st(id) === 'later', 'Check later saves the copy as later');
  ok(await page.evaluate(id => state.rvCurrent !== id && !reviewQueue().some(c => c.id === id), id), 'It leaves the To review list and the next copy shows');
  await page.keyboard.press('u'); await page.waitForTimeout(900);
  ok(await st(id) === 'new', 'U puts it back as New');
  const id2 = await page.evaluate(() => state.rvCurrent);
  await page.keyboard.press('c'); await page.waitForTimeout(900);
  ok(await st(id2) === 'later', 'C key = Check later');
  // Copies found: the tab, the row button, the details panel.
  await page.goto(url('app.html#found')); await page.waitForTimeout(1500);
  ok(await tabN('Check later') === 1, 'Copies found has a Check later tab with 1 copy');
  const newBefore = await tabN('New');
  ok(await page.locator('.frow [data-act="rowans"][data-v^="later|"]').count() === 0, 'Rows have no clock button (calm look): Check later is in the row\'s ⋯ menu');
  await page.locator('.frow [data-act="rowmenu"]').first().click(); await page.waitForTimeout(300);
  const rowBtn = page.locator('[data-act="mdo"][data-v^="later|"]').first();
  const v3 = await rowBtn.getAttribute('data-v'), id3 = v3.slice(v3.indexOf('|') + 1);
  await rowBtn.click(); await page.waitForTimeout(900);
  ok(await st(id3) === 'later' && await tabN('Check later') === 2 && await tabN('New') === newBefore - 1, 'Check later in the row menu moves a copy to Check later');
  await page.locator('[data-act="ffilter"][data-v="Check later"]').click(); await page.waitForTimeout(900);
  ok(await page.locator('.frow[data-act="openrow"]').count() === 2, 'Check later tab lists them');
  ok(await page.locator('.frow [data-act="rowans"][data-v^="stolen|"]').count() === 2, 'They still have the Stolen / Licensed / Remove buttons');
  await page.locator('.frow[data-act="openrow"] .cinfo').first().click(); await page.waitForTimeout(900);
  ok(await page.locator('.dfoot [data-v="later"]').count() === 0 && /Back to New/.test(await page.textContent('.dfoot')), 'Panel of a Check later copy says so, offers Back to New');
  const open = await page.evaluate(() => state.open);
  await page.locator('.dfoot [data-act="dverdict"][data-v="licensed"]').click(); await page.waitForTimeout(1200);
  ok(await st(open) === 'licensed' && await tabN('Check later') === 1, 'Answering it from Check later works');
  await page.keyboard.press('u'); await page.waitForTimeout(1200);
  ok(await st(open) === 'later', 'Undo returns it to Check later');
  // From New, the panel button.
  await page.locator('[data-act="ffilter"][data-v="New"]').click(); await page.waitForTimeout(900);
  const id4 = await page.locator('.frow[data-act="openrow"]').first().getAttribute('data-v');
  await page.evaluate(id => ACTS.openrow(id), id4); await page.waitForTimeout(900);
  await page.locator('.dfoot [data-act="dverdict"][data-v="later"]').click(); await page.waitForTimeout(1200);
  ok(await st(id4) === 'later' && await page.evaluate(id => state.open && state.open !== id, id4), 'Panel Check later saves it and opens the next copy');
  await ctx.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
