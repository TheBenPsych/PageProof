// 4.60 (Ben): Copies found and One at a time stay put while you look. New copies wait behind a
// "N new copies came in" button, a background change never moves or removes a row under you,
// and One at a time keeps the copy on screen until you answer it.
const { start } = require('./h.js');
process.env.NP = 400; process.env.NC = 200;
const { seed } = require('./seed.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const ping = page => page.evaluate(() => chrome.storage.local.set({ fcChanged: { what: 'keep', at: Date.now() } }));
// New copies that sort to the very top (100% match, a repeat site).
const addTop = (page, n, tag) => page.evaluate(async ([n, tag]) => {
  const base = (await FC.allCopies()).find(c => c.status === 'new' && c.use !== 'social');
  const xs = [];
  for (let i = 0; i < n; i++) { const site = tag + i + '.com'; const c = { ...base, id: base.photo + '|' + site + '/p', key: site + '/p', site, url: 'https://' + site + '/p', status: 'new', pct: 100, match: 'same', firstSeen: new Date().toISOString() }; c.use = FC.useOf(c); xs.push(c); }
  await FC.DB.putMany('copies', xs);
  return xs.map(c => c.id);
}, [n, tag]);
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  await seed(page);
  await page.goto(url('app.html#found')); await page.waitForTimeout(1500);
  await page.evaluate(() => { state.fView = 'list'; state.fSort = 'pct'; }); await page.evaluate(() => render(true)); await page.waitForTimeout(800);
  // Scroll down a bit and remember the row at the top of the screen.
  await page.evaluate(() => window.scrollTo(0, 900)); await page.waitForTimeout(300);
  const look = () => page.evaluate(() => { const r = [...document.querySelectorAll('.crow[data-v]')].find(e => e.getBoundingClientRect().top > 80); return r ? { id: r.dataset.v, top: Math.round(r.getBoundingClientRect().top), n: document.querySelectorAll('.crow[data-v]').length } : null; });
  const before = await look();
  ok(!!before, 'A row is on screen after scrolling');
  // Keep searching finds 3 copies that would sort to the top.
  const ids = await addTop(page, 3, 'zztop');
  await ping(page); await page.waitForTimeout(2600);
  const after = await look();
  ok(after && after.id === before.id && Math.abs(after.top - before.top) <= 2, `The same row stays at the same place (${before.top} → ${after && after.top})`);
  ok(await page.evaluate(ids => ids.every(id => !document.querySelector(`.crow[data-v="${CSS.escape(id)}"]`)), ids), 'New copies are not put in the list by themselves');
  ok(/3 new copies came in/.test(await page.textContent('.holdbar').catch(() => '')), 'The "3 new copies came in" button shows');
  // A background check removes a row on screen: it stays until you click something.
  const gone = after.id;
  await page.evaluate(async id => { const c = await FC.DB.get('copies', id); c.status = 'removed'; c.removedBy = 'postcheck'; await FC.DB.put('copies', c); }, gone);
  await ping(page); await page.waitForTimeout(2600);
  const a2 = await look();
  ok(a2 && a2.id === gone && Math.abs(a2.top - before.top) <= 2, 'A row a background check removed stays where it was');
  // Your own answer still takes a row off at once.
  const other = await page.evaluate(gone => [...document.querySelectorAll('.crow[data-v]')].map(e => e.dataset.v).filter(v => v !== gone)[3], gone);
  await page.evaluate(id => answerCopies([id], 'licensed', 'test'), other); await page.evaluate(() => render(true)); await page.waitForTimeout(800);
  ok(await page.evaluate(id => !document.querySelector(`.crow[data-v="${CSS.escape(id)}"]`), other), 'Your own answer still takes the row off');
  await ping(page); await page.waitForTimeout(2600);
  ok(await page.evaluate(id => !document.querySelector(`.crow[data-v="${CSS.escape(id)}"]`), other), '...and a background redraw does not bring it back');
  // Show them: the new copies are in, the removed one is gone.
  await page.click('.holdbar [data-act="holdshow"]'); await page.waitForTimeout(1000);
  ok(await page.evaluate(ids => ids.every(id => state.fz.ids.includes(id)), ids), 'Show them puts the new copies in the list');
  ok(await page.evaluate(id => !document.querySelector(`.crow[data-v="${CSS.escape(id)}"]`), gone), 'The removed copy leaves when you ask for a fresh list');
  ok(!(await page.$('.holdbar')), 'The button goes away');
  // A filter change shows everything fresh (new copies included).
  const ids2 = await addTop(page, 2, 'yytop');
  await ping(page); await page.waitForTimeout(2600);
  ok(/2 new copies/.test(await page.textContent('.holdbar').catch(() => '')), 'Two more new copies wait behind the button');
  await page.evaluate(() => ACTS.fset('fSort|newest')); await page.waitForTimeout(1000);
  ok(await page.evaluate(ids => ids.every(id => state.fz.ids.includes(id)), ids2) && !(await page.$('.holdbar')), 'Changing the sort shows them');

  // One at a time keeps the copy on screen.
  await page.goto(url('app.html#review')); await page.waitForTimeout(1500);
  const cur = await page.evaluate(() => state.rvCurrent);
  const ids3 = await addTop(page, 2, 'xxtop');
  await page.evaluate(async ids => { for (const id of ids) { const c = await FC.DB.get('copies', id); c.repeat = 3; await FC.DB.put('copies', c); } }, ids3);
  await ping(page); await page.waitForTimeout(2600);
  ok(await page.evaluate(() => state.rvCurrent) === cur, 'One at a time: a new copy that sorts first does not replace the one on screen');
  await page.evaluate(() => { state.cmpMode = 'swipe'; return render(true); }); await page.waitForTimeout(600);
  ok(await page.evaluate(() => state.rvCurrent) === cur, 'Switching the view keeps the same copy');
  await page.evaluate(async id => { const c = await FC.DB.get('copies', id); c.status = 'removed'; await FC.DB.put('copies', c); }, cur);
  await ping(page); await page.waitForTimeout(2600);
  ok(await page.evaluate(() => state.rvCurrent) === cur && /Now Removed/.test(await page.textContent('.rvprog')), 'A copy a background check removed stays on screen with a note');
  await page.click('[data-act="rvnext"]'); await page.waitForTimeout(1000);
  const nx = await page.evaluate(() => state.rvCurrent);
  ok(nx !== cur, 'Next copy moves on');
  await page.locator('.rvans [data-v="skip"]').click(); await page.waitForTimeout(1000);
  ok(await page.evaluate(() => state.rvCurrent) !== nx, 'Skip moves on to another copy');
  await ctx.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
