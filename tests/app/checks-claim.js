// 4.63 (Ben): pressing Stolen opens the claim steps right in the copy details panel.
// Part 1 (good case) before Part 2 (capture, report, portal); Sent to legal opens the next copy;
// Finish later keeps it in the Not finished tab; Not a viable entity closes it; One at a time too.
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
  // Every site is an ordinary company, so the firm-rule question never stops Stolen.
  await page.evaluate(async () => { const k = {}; for (const c of await FC.allCopies()) k[FC.baseOf(c.site)] = 'company'; await FC.meta.set('siteKinds', k); });
  const st = id => page.evaluate(async id => (await FC.DB.get('copies', id)).status, id);
  const cl = id => page.evaluate(async id => ((await FC.meta.get('claims')) || {})[id] || {}, id);
  const tabN = f => page.evaluate(f => { const b = [...document.querySelectorAll('[data-act="ffilter"]')].find(x => x.dataset.v === f); return b ? +b.querySelector('span').textContent : -1; }, f);
  await page.goto(url('app.html#found')); await page.waitForTimeout(1800);
  const nf0 = await tabN('Not finished');
  ok(nf0 >= 0, 'Copies found has a Not finished tab (' + nf0 + ')');
  const id = await page.locator('.frow[data-act="openrow"]').first().getAttribute('data-v');
  await page.evaluate(id => ACTS.openrow(id), id); await page.waitForTimeout(900);
  await page.locator('.dfoot [data-act="dverdict"][data-v="stolen"]').click(); await page.waitForTimeout(1500);
  ok(await st(id) === 'stolen', 'Stolen is saved');
  ok(await page.evaluate(id => state.open === id, id), 'the same copy stays open after Stolen');
  const card = await page.evaluate(() => { const b = document.getElementById('claimsteps'); return b && { steps: b.querySelectorAll('.clstep').length, t: b.innerText, parts: b.querySelectorAll('.clpart').length }; });
  ok(card && card.steps === 5 && card.parts === 2 && /Is it a good case/i.test(card.t) && /Build the case/i.test(card.t), 'Finish this claim shows 5 steps in 2 parts');
  ok(await page.evaluate(() => { const s = [...document.querySelectorAll('#claimsteps .clstep')]; return s[0].classList.contains('on') && s[2].classList.contains('lock'); }), 'Part 1 is open first and Part 2 waits');
  ok(await page.locator('.dfoot [data-act="dverdict"]').count() === 0 && await page.locator('.dfoot [data-act="clsent"][disabled]').count() === 1, 'the answer buttons give way to Sent to legal (greyed until the steps are done) and Finish later');
  ok(await tabN('Not finished') === nf0 + 1, 'it counts in Not finished');
  // Finish later: the next copy opens, the claim waits.
  await page.locator('.dfoot [data-act="cllater"]').click(); await page.waitForTimeout(1200);
  ok(await page.evaluate(id => state.open && state.open !== id, id), 'Finish later opens the next copy');
  await page.locator('[data-act="ffilter"][data-v="Not finished"]').click(); await page.waitForTimeout(1000);
  ok(await page.locator(`.frow[data-v="${id}"]`).count() === 1, 'the claim is listed in Not finished');
  // Do the steps: same photo + on page by hand, the company, then skip capture and report.
  await page.evaluate(id => ACTS.openrow(id), id); await page.waitForTimeout(1000);
  await page.evaluate(async id => { await clSet(id, { same: 'yes', onPage: 'yes' }); const c = FCD.copies.find(x => x.id === id); await entSet(FC.baseOf(c.site), { status: 'Seemingly viable' }); await render(true); }, id); await page.waitForTimeout(900);
  ok(await page.evaluate(() => { const s = [...document.querySelectorAll('#claimsteps .clstep')]; return s[0].classList.contains('y') && s[1].classList.contains('y') && !s[2].classList.contains('lock') && s[2].classList.contains('on'); }), 'with Part 1 done, Capture their page is next');
  for (let i = 0; i < 2; i++) { await page.locator('#claimsteps .clstep.on [data-act="clskip"]').click(); await page.waitForTimeout(900); }
  ok(await page.evaluate(() => !!document.querySelector('#claimsteps .clstep.on #portalcard')), 'the legal portal card is the last step');
  ok(await page.locator('.dfoot [data-act="clsent"]:not([disabled])').count() === 1, 'Sent to legal can be pressed');
  await page.locator('.dfoot [data-act="clsent"]').click(); await page.waitForTimeout(1200);
  const c1 = await cl(id);
  ok(!!c1.sent && await page.evaluate(id => state.open !== id, id), 'Sent to legal saves the date and opens the next copy');
  ok(await tabN('Not finished') === nf0, 'it leaves Not finished');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  await page.keyboard.press('u'); await page.waitForTimeout(1200);
  ok(!(await cl(id)).sent, 'Undo takes Sent to legal back');
  // Not a viable entity closes a claim.
  await page.locator('[data-act="ffilter"][data-v="New"]').click(); await page.waitForTimeout(900);
  const id2 = await page.locator('.frow[data-act="openrow"]').first().getAttribute('data-v');
  await page.evaluate(id => ACTS.openrow(id), id2); await page.waitForTimeout(900);
  await page.locator('.dfoot [data-act="dverdict"][data-v="stolen"]').click(); await page.waitForTimeout(1500);
  await page.evaluate(() => { ACTS.clstep('owner'); }); await page.waitForTimeout(900);
  await page.locator('#claimsteps [data-act="clnotviable"]').first().click(); await page.waitForTimeout(1200);
  const c2 = await cl(id2);
  ok(c2.closed === 'notviable' && await page.evaluate(id => state.open !== id, id2), 'Not a viable entity closes the claim and moves on');
  // One at a time: Stolen opens the same steps, Finish later goes back.
  await page.goto(url('app.html#review')); await page.waitForTimeout(1500);
  const id3 = await page.evaluate(() => state.rvCurrent);
  await page.locator('.rvans [data-v="stolen"]').click(); await page.waitForTimeout(1800);
  ok(await page.evaluate(id => location.hash.startsWith('#found') && state.open === id && !!document.getElementById('claimsteps'), id3), 'One at a time: Stolen opens the claim steps');
  await page.locator('.dfoot [data-act="cllater"]').click(); await page.waitForTimeout(1500);
  ok(await page.evaluate(() => location.hash === '#review'), 'Finish later goes back to One at a time');
  // The backup carries the claims.
  ok(await page.evaluate(async () => Object.keys((await FC.settingsSnapshot()).claims || {}).length >= 2), 'the settings backup keeps the claims');
  await ctx.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
