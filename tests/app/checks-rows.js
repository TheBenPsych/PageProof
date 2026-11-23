// Copies found: every answer and hide takes the row off the list straight away, and Undo puts it back.
// Keep searching is "running" the whole time (it tells the page something changed every
// 300 ms, and reading the copies is made slow on purpose), because that is when a late redraw
// used to put an answered row back on screen (4.9.1).
const { start } = require('./h.js');
process.env.NP = 3000; process.env.NC = 400;
const { seed } = require('./seed.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 300)));
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  await seed(page);
  // A few extra copies: three new ones on one site (for "All 3 stolen"), and a social post (for "Only this account").
  await page.evaluate(async () => {
    const base = (await FC.allCopies()).find(c => c.status === 'new');
    const extra = [1, 2, 3].map(i => ({ ...base, id: base.photo + '|cluster.com/p/' + i, key: 'cluster.com/p/' + i, site: 'cluster.com', url: 'https://cluster.com/p/' + i, status: 'new', pct: 99 }));
    extra.push({ ...base, id: base.photo + '|threads.com/@someone/post/1', key: 'threads.com/@someone/post/1', site: 'threads.com', url: 'https://www.threads.com/@someone/post/Df-QHxB', status: 'new', pct: 99, use: 'social' });
    extra.push({ ...base, id: base.photo + '|threads.com/@other/post/2', key: 'threads.com/@other/post/2', site: 'threads.com', url: 'https://www.threads.com/@other/post/Zz', status: 'new', pct: 98, use: 'social' });
    for (const c of extra) { c.use = FC.useOf(c); const a = c.use === 'social' && typeof PP_SOCIAL !== 'undefined' && PP_SOCIAL.fromUrl(c.url); if (a) c.acct = { ...a, from: 'link', sure: 'sure' }; }
    await FC.DB.putMany('copies', extra);
    await chrome.storage.local.set({ fcChanged: { what: 'test', at: Date.now() } });
  });
  await page.goto(url('app.html#found')); await page.waitForTimeout(1500);
  // Make it like a big library while Keep searching runs: slow reads, and "something changed" pings.
  await page.evaluate(() => {
    const real = FC.allCopies;
    FC.allCopies = async (...a) => { await new Promise(r => setTimeout(r, 150 + Math.random() * 500)); return real(...a); };
    window.__ping = setInterval(() => chrome.storage.local.set({ fcChanged: { what: 'keep', at: Date.now() } }), 300);
    // Stolen may ask first (firm rules): always say Mark Stolen.
    new MutationObserver(() => { const b = document.querySelector('dialog[open] #gateStolen'); if (b) b.click(); }).observe(document.body, { childList: true, subtree: true });
  });
  const sel = id => `.frow[data-v="${id.replace(/"/g, '\\"')}"]`;
  const onScreen = id => page.evaluate(s => !!document.querySelector(s), sel(id));
  const status = id => page.evaluate(async id => (await FC.DB.get('copies', id)).status, id);
  const fresh = (n, not = []) => page.evaluate(({ n, not }) => [...document.querySelectorAll('.frow[data-act="openrow"]')].map(r => r.dataset.v).filter(v => !not.includes(v) && FCD.copies.find(c => c.id === v && c.status === 'new' && c.site !== 'cluster.com' && c.site !== 'threads.com')).slice(0, n), { n, not });
  const used = [];
  // A redraw can swap the row under the mouse; like a person, try again on the row now on screen.
  const click = async s => {
    for (let t = 0; ; t++) {
      try { await page.locator(s).first().scrollIntoViewIfNeeded({ timeout: 3000 }); await page.locator(s).first().click({ force: true, timeout: 3000 }); return; }
      catch (e) { if (t >= 3) throw e; await page.waitForTimeout(100); }
    }
  };
  // Gone at once: checked 150 ms after the click (before the slow redraw could finish), and again after the redraws settle.
  const goneNowAndLater = async (ids, what) => {
    await page.waitForTimeout(150);
    const now = !(await Promise.all(ids.map(onScreen))).some(Boolean);
    await page.waitForTimeout(2600);
    const later = !(await Promise.all(ids.map(onScreen))).some(Boolean);
    ok(now, what + ': row gone at once');
    ok(later, what + ': row stays gone after the page redraws');
  };

  // 1-3: each answer button on a row
  for (const ans of ['stolen', 'licensed', 'removed']) {
    const [id] = await fresh(1, used); used.push(id);
    await click(`${sel(id)} button[data-act="rowans"][data-v^="${ans}|"]`);
    await goneNowAndLater([id], 'Row ' + ans);
    ok(await status(id) === ans, 'Row ' + ans + ': saved as ' + ans);
  }
  // Undo brings the last one back
  await click('.toast button, #toast button');
  await page.waitForTimeout(2600);
  ok(await onScreen(used[2]) && await status(used[2]) === 'new', 'Undo: the removed row is back as new');
  used.pop();
  // Undo opened that copy in the details panel; close it so the rows show their buttons again.
  await page.evaluate(() => { state.open = ''; return render(true); }); await page.waitForTimeout(600);

  // 4: three rows answered fast, one after another (no click is lost)
  const three = await fresh(3, used); used.push(...three);
  for (const [i, id] of three.entries()) { await click(`${sel(id)} button[data-act="rowans"][data-v^="${['removed', 'licensed', 'stolen'][i]}|"]`); await page.waitForTimeout(80); }
  await page.waitForTimeout(3500);
  ok(!(await Promise.all(three.map(onScreen))).some(Boolean), 'Three fast answers: all three rows gone');
  ok((await Promise.all(three.map(status))).every(s => s !== 'new'), 'Three fast answers: all three saved');

  // 5: the row that is open in the details panel, answered from its row
  // (a wide window: rows keep their answer buttons while the panel is open)
  await page.setViewportSize({ width: 1800, height: 900 });
  const [op] = await fresh(1, used); used.push(op);
  await click(`${sel(op)} .l1`); await page.waitForTimeout(1500);
  await click(`${sel(op)} button[data-act="rowans"][data-v^="removed|"]`);
  await goneNowAndLater([op], 'Open row Remove');
  await page.setViewportSize({ width: 1440, height: 900 });

  // 6: an answer in the details panel
  const [pd] = await fresh(1, used); used.push(pd);
  await click(`${sel(pd)} .l1`); await page.waitForTimeout(1500);
  await click('#drawer button[data-act="dverdict"][data-v="licensed"]');
  await goneNowAndLater([pd], 'Panel Licensed');
  ok(await status(pd) === 'licensed', 'Panel Licensed: saved');
  await page.evaluate(() => { state.open = ''; return render(true); }); await page.waitForTimeout(600);

  // 7: "All 3 stolen" on a folded site group
  const cl = await page.evaluate(() => FCD.copies.filter(c => c.site === 'cluster.com').map(c => c.id));
  await click('.morerow button[data-act="siteall"][data-v^="stolen"]');
  await goneNowAndLater(cl, 'All 3 stolen');
  ok((await Promise.all(cl.map(status))).every(s => s === 'stolen'), 'All 3 stolen: saved');

  // 8: Hide site, Only this account (the threads.com case)
  // (social posts have their own tab since 4.9)
  await click('.bigtabs [data-act="ftab"][data-v="social"]'); await page.waitForTimeout(1500);
  const th = await page.evaluate(() => FCD.copies.filter(c => c.site === 'threads.com').map(c => c.id).sort((a, b) => !!document.querySelector(`.frow[data-v="${b}"]`) - !!document.querySelector(`.frow[data-v="${a}"]`)));
  await click(`${sel(th[0])} button[data-act="rowmenu"]`); await page.waitForTimeout(300);
  const acct = await page.evaluate(() => document.querySelector('#rowMenu button[data-act="mhide"]').dataset.v);
  await click('#rowMenu button[data-act="mhide"]');
  await goneNowAndLater([th[0]], 'Hide only this account (' + acct + ')');
  ok(await onScreen(th[1]), 'Hide only this account: the other account on threads.com still shows');
  await click('.bigtabs [data-act="ftab"][data-v="web"]'); await page.waitForTimeout(1500);

  // 9: Hide the whole site from the ⋯ menu
  const [hs] = await fresh(1, used); used.push(hs);
  const base = await page.evaluate(id => FC.baseOf(FCD.copies.find(c => c.id === id).site), hs);
  await click(`${sel(hs)} button[data-act="rowmenu"]`); await page.waitForTimeout(300);
  await click(`#rowMenu button[data-act="mhide"][data-v="${base}"]`);
  await goneNowAndLater([hs], 'Hide whole site');
  await click('.toast button, #toast button'); await page.waitForTimeout(2600);
  ok(await onScreen(hs), 'Undo hide: the row is back');

  // 10: picked rows, Remove
  const two = await fresh(2, used); used.push(...two);
  for (const id of two) await click(`${sel(id)} input.cpick`);
  await page.waitForTimeout(800);
  await click('.bulk button[data-act="bulk"][data-v="removed"]');
  await goneNowAndLater(two, 'Picked rows Remove');

  await page.evaluate(() => clearInterval(window.__ping));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await ctx.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL crashed', e); process.exit(1); });
