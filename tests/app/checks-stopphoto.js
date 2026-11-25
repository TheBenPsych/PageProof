// 4.52: "Stop searching this photo" from Copies found (details panel, More menu, One at a time).
// Keep searching and Today's 50 skip it; copies stay; Undo (U) and the client's photos page
// turn it back on.
const { start } = require('./h.js');
process.env.NP = 300; process.env.NC = 60;
const { seed } = require('./seed.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  await seed(page); await page.reload(); await page.waitForTimeout(1200);
  const c = await page.evaluate(async () => {
    await RS_LISTS.load(); await loadFC();
    const c = FCD.copies.find(x => x.status === 'new' && visible(x) && FCD.photos.get(x.photo) && !FCD.photos.get(x.photo).doubleOf);
    // Make sure the photo would be searched (due) before we stop it.
    const p = await FC.DB.get('photos', c.photo); p.lastSearched = new Date(Date.now() - 400 * 864e5).toISOString(); p.flag = 'hi'; await FC.DB.put('photos', p);
    const cl = await FC.DB.get('clients', p.client); cl.searching = true; await FC.DB.put('clients', cl);
    FC.resetQueue(); await FC.buildQueue();
    return { id: c.id, photo: c.photo, client: p.client, inLine: (await FC.next(400)).some(x => x.id === c.photo) };
  });
  ok(c.inLine, 'Before: the photo is in the search line');
  await page.goto(url('app.html#found?open=' + encodeURIComponent(c.id))); await page.waitForTimeout(1500);
  const btn = page.locator('.drawer [data-act="stopphoto"]');
  ok(await btn.count() === 1 && /Stop searching this photo/.test(await btn.textContent()), 'Details panel shows "Stop searching this photo"');
  await btn.click(); await page.waitForTimeout(500);
  // The "are you sure" box: Stop is greyed out until the box is ticked; Cancel changes nothing.
  ok(await page.locator('dialog.stopask .stopgo').isDisabled(), 'Are-you-sure box: Stop searching is greyed out until ticked');
  await page.locator('dialog.stopask button[value="no"]').click(); await page.waitForTimeout(500);
  ok(await page.evaluate(async c => !(await FC.DB.get('photos', c.photo)).stopped, c), 'Cancel leaves the photo searched');
  await btn.click(); await page.waitForTimeout(500);
  await page.locator('dialog.stopask .stopok').check(); await page.locator('dialog.stopask .stopgo').click(); await page.waitForTimeout(1200);
  const s1 = await page.evaluate(async c => { FC.resetQueue(); const p = await FC.DB.get('photos', c.photo); return { stopped: !!p.stopped, inLine: (await FC.next(400)).some(x => x.id === c.photo), first: (await FC.next(400, new Set(), { first: true })).some(x => x.id === c.photo), plan: FC.plan(p, { priority: true }), copy: !!(await FC.DB.get('copies', c.id)), panel: document.querySelector('.drawer') ? document.querySelector('.drawer').textContent : '' }; }, c);
  ok(s1.stopped && !s1.inLine && !s1.first && !s1.plan.due, 'Stopped: not in Keep searching or Today\'s 50 lines');
  ok(s1.copy, 'Its copy is still there');
  ok(/Not searched any more/.test(s1.panel) && /Search it again/.test(s1.panel), 'Panel says "Not searched any more" with Search it again');
  ok(/won't be searched any more/.test(await page.textContent('body')), 'Toast says it won\'t be searched');
  await page.keyboard.press('u'); await page.waitForTimeout(1200);
  const s2 = await page.evaluate(async c => { FC.resetQueue(); const p = await FC.DB.get('photos', c.photo); return { stopped: !!p.stopped, inLine: (await FC.next(400)).some(x => x.id === c.photo) }; }, c);
  ok(!s2.stopped && s2.inLine, 'U undoes it: back in the search line');
  // More menu
  await page.locator('.drawer [data-act="dmore"]').click(); await page.waitForTimeout(400);
  const mi = page.locator('#rowMenu [data-act="stopphoto"]');
  ok(await mi.count() === 1, 'More menu has Stop searching this photo');
  // The panel can redraw while it reads their page, so click it straight away (as other checks do).
  await page.evaluate(() => document.querySelector('#rowMenu [data-act="stopphoto"]').click()); await page.waitForTimeout(500);
  await page.locator('dialog.stopask .stopok').check(); await page.locator('dialog.stopask .stopgo').click(); await page.waitForTimeout(1000);
  ok(await page.evaluate(async c => !!(await FC.DB.get('photos', c.photo)).stopped, c), 'More menu stops it');
  // Backup carries it
  ok(await page.evaluate(async c => { FC.backupSoon(true); const s = await FC.settingsSnapshot(); return JSON.stringify(s.flags || []).includes(c.photo); }, c).catch(() => false), 'Settings backup lists the stopped photo');
  // Client's photos page: banner, badge, Search again
  await page.evaluate(n => { state.phClient = n; }, c.client);
  await page.goto(url('app.html#photos')); await page.waitForTimeout(1500);
  await page.evaluate(n => { state.phClient = n; state.phStop = false; return render(); }, c.client); await page.waitForTimeout(800);
  const t = await page.textContent('main');
  ok(/1 photo is not searched any more/.test(t), 'Photos page banner counts the stopped photo');
  await page.locator('[data-act="phstopshow"]').click(); await page.waitForTimeout(800);
  ok(await page.locator('.pcard').count() === 1, 'Show it lists only the stopped photo');
  await page.locator(`.pcard [data-act="phstop"]`).click(); await page.waitForTimeout(1000);
  ok(await page.evaluate(async c => !(await FC.DB.get('photos', c.photo)).stopped, c), 'Search again turns it back on');
  // Bulk on the photos page
  await page.evaluate(() => { state.phStop = false; return render(); }); await page.waitForTimeout(600);
  await page.locator('.pcard [data-act="phpick"]').first().check(); await page.waitForTimeout(400);
  await page.locator('.bulk [data-act="phstop"][data-v="|1"]').click(); await page.waitForTimeout(500);
  await page.locator('dialog.stopask .stopok').check(); await page.locator('dialog.stopask .stopgo').click(); await page.waitForTimeout(900);
  ok(await page.evaluate(async n => (await FC.DB.by('photos', 'client', n)).filter(p => p.stopped).length === 1, c.client), 'Bulk Stop searching stops the picked photo');
  // One at a time
  await page.goto(url('app.html#review')); await page.waitForTimeout(1500);
  ok(await page.locator('.rvmore [data-act="stopphoto"]').count() === 1, 'One at a time has the button too');
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await ctx.close(); process.exit(fails ? 1 : 0);
})();
