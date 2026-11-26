// Calm look batch 19 (Ben, 2026-11-26): Finish this claim in the Windows 11 Settings look.
// A header card with "Step N of 5" and one bar, each step a row that folds open, checks as rows,
// Part 2 rows locked until Part 1 is done, and the legal portal form as rows where Copy turns
// into "Copied" and the count at the top goes up.
const { start } = require('./h.js');
process.env.NP = 300; process.env.NC = 120;
const { seed } = require('./seed.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1600, height: 1000 });
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  await seed(page);
  await page.evaluate(async () => { const k = {}; for (const c of await FC.allCopies()) k[FC.baseOf(c.site)] = 'company'; await FC.meta.set('siteKinds', k); });
  await page.goto(url('app.html#found')); await page.waitForTimeout(1800);
  const id = await page.locator('.frow[data-act="openrow"]').first().getAttribute('data-v');
  await page.evaluate(id => ACTS.openrow(id), id); await page.waitForTimeout(900);
  await page.locator('.dfoot [data-act="dverdict"][data-v="stolen"]').click(); await page.waitForTimeout(1500);
  const a = await page.evaluate(() => { const b = document.getElementById('claimsteps'); const h = b.querySelector('.cshero'); return { cls: b.className, hero: h && h.innerText, bar: b.querySelectorAll('.csbar').length, rows: b.querySelectorAll('.clstep > .sx-row').length, groups: b.querySelectorAll('.sx-group').length, t: b.innerText, lock: [...b.querySelectorAll('.clstep.lock')].map(x => x.innerText), checks: b.querySelectorAll('.clstep.on .csck').length, next: (b.querySelector('.clstep.on .sx-tag') || {}).textContent }; });
  ok(/Finish this claim/.test(a.hero) && /Step 1 of 5/.test(a.hero) && /0 of 5 steps done/.test(a.hero) && a.bar === 1, 'the header card says Step 1 of 5 and 0 of 5 steps done, with one bar: ' + JSON.stringify(a.hero));
  ok(!/of 4 done/.test(a.t), 'no more "of 4 done" with 5 steps');
  ok(a.rows === 5 && a.groups === 2, 'each step is a Settings row, in 2 groups');
  ok(a.lock.length === 3 && a.lock.every(t => /Opens after Part 1/.test(t)) && /Opens when Part 1 is done/.test(a.t), 'Part 2 rows are locked and say they open after Part 1');
  ok(a.checks === 4 && /Next step/.test(a.next || ''), 'the open step shows its 4 checks as rows and a Next step tag');
  // Fold another step open and shut by its row
  await page.locator('#claimsteps .clstep[data-step="owner"] > .sx-row').click(); await page.waitForTimeout(700);
  ok(await page.evaluate(() => !!document.querySelector('#claimsteps .clstep[data-step="owner"].on .csfold')), 'pressing a step row folds it open');
  // Part 1 done, skip capture and report: the portal form
  await page.evaluate(async id => { await clSet(id, { same: 'yes', onPage: 'yes' }); const c = FCD.copies.find(x => x.id === id); await entSet(FC.baseOf(c.site), { status: 'Seemingly viable' }); await render(true); }, id); await page.waitForTimeout(900);
  const b = await page.evaluate(() => { const h = document.querySelector('#claimsteps .cshero'); return { hero: h.innerText, done: document.querySelectorAll('#claimsteps .clstep.y .csdone').length, lock: document.querySelectorAll('#claimsteps .clstep.lock').length }; });
  ok(/Step 3 of 5/.test(b.hero) && /2 of 5 steps done/.test(b.hero) && b.done === 2 && b.lock === 0, 'with Part 1 done: Step 3 of 5, 2 done with green ticks, nothing locked');
  for (let i = 0; i < 2; i++) { await page.locator('#claimsteps .clstep.on [data-act="clskip"]').click(); await page.waitForTimeout(900); }
  ok(await page.evaluate(() => document.querySelectorAll('#claimsteps .clstep.s .csskip').length === 2 && /Skipped/.test(document.querySelector('#claimsteps .clstep.s').innerText)), 'skipped steps show a grey dash and Skipped');
  const p0 = await page.evaluate(() => { const p = document.getElementById('portalcard'); return { cnt: p.querySelector('.pcount').textContent, copy: p.querySelectorAll('.prow:not(.empty) .pcbtn').length, all: p.querySelectorAll('.prow:not(.empty)').length, drop: p.querySelectorAll('.prow .pick').length }; });
  ok(new RegExp('^0 of ' + p0.all + ' lines copied').test(p0.cnt) && p0.copy === p0.all && p0.drop >= 3, 'the portal form starts at 0 of N lines copied, every line has Copy, drop-downs are marked: ' + JSON.stringify(p0));
  await page.locator('#portalcard [data-act="pcopy"][data-v="page"]').click(); await page.waitForTimeout(500);
  await page.locator('#portalcard [data-act="pcopy"][data-v="domain"]').click(); await page.waitForTimeout(500);
  const p1 = await page.evaluate(() => { const p = document.getElementById('portalcard'); return { cnt: p.querySelector('.pcount').textContent, copied: [...p.querySelectorAll('.prow .sx-tag.ok')].map(x => x.closest('.prow').dataset.v) }; });
  ok(new RegExp('^2 of ' + p0.all + ' lines copied').test(p1.cnt) && p1.copied.join() === 'domain,page', 'copied lines show Copied and the count goes up: ' + JSON.stringify(p1));
  await page.evaluate(() => render(true)); await page.waitForTimeout(900);
  ok(await page.evaluate(() => document.querySelectorAll('#portalcard .prow .sx-tag.ok').length === 2), 'Copied stays after the panel redraws');
  // Not finished rows: a step chip and Continue (Change answer moves into the ··· menu)
  await page.locator('.dfoot [data-act="cllater"]').click(); await page.waitForTimeout(1200);
  await page.keyboard.press('Escape').catch(() => {});
  await page.evaluate(() => { state.open = ''; location.hash = '#found'; }); await page.waitForTimeout(800);
  await page.locator('[data-act="ffilter"][data-v="Not finished"]').click(); await page.waitForTimeout(1200);
  const nf = await page.evaluate(id => { const r = document.querySelector(`.frow[data-v="${id}"]`); return r && { chip: (r.querySelector('.clchip') || {}).innerText, cont: !!r.querySelector('.acts [data-act="openrow"]'), cont2: (r.querySelector('.acts [data-act="openrow"]') || {}).textContent, change: !!r.querySelector('.acts [data-act="rowans"]') }; }, id);
  ok(nf && /^5 of 5/.test(nf.chip || '') && /legal portal/.test(nf.chip) && nf.cont && nf.cont2 === 'Continue' && !nf.change, 'a Not finished row shows "5 of 5 · Put it in the legal portal" and Continue: ' + JSON.stringify(nf));
  await page.locator(`.frow[data-v="${id}"] [data-act="rowmenu"]`).click(); await page.waitForTimeout(400);
  ok(await page.evaluate(id => !!document.querySelector(`#rowMenu [data-act="mdo"][data-v="changeans|${id}"]`), id), 'Change answer is in the ··· menu');
  await page.keyboard.press('Escape'); await page.mouse.click(5, 500); await page.waitForTimeout(300);
  await page.locator(`.frow[data-v="${id}"] .acts [data-act="openrow"]`).click(); await page.waitForTimeout(1000);
  ok(await page.evaluate(id => state.open === id && !!document.querySelector('#claimsteps #portalcard'), id), 'Continue opens the claim at the step it was left on');
  await page.keyboard.press('Escape').catch(() => {}); await page.evaluate(() => { state.open = ''; }); await page.waitForTimeout(300);
  // The sweep questions fold into one line
  const sw = await page.evaluate(async () => {
    const all = await FC.allCopies(); const st = all.filter(c => c.status === 'stolen').slice(0, 3);
    window.__sug = FC_RULES.suggestions; FC_RULES.suggestions = async () => st.map((c, i) => ({ kind: 'sweep', site: 'sweepme' + i + '-example.com', client: 'Client A', n: 1 }));
    await render(true); await new Promise(r => setTimeout(r, 900));
    const f = document.getElementById('sweepfold');
    return { line: f && f.innerText, boxes: document.querySelectorAll('[data-act="ruleyes"]').length };
  });
  ok(/3 sites could be swept for more of your clients' photos/.test(sw.line || '') && /sweepme0-example\.com, sweepme1-example\.com/.test(sw.line) && sw.boxes === 0, 'three sweep questions fold into one line: ' + JSON.stringify(sw));
  await page.locator('[data-act="sweepfold"][data-v="1"]').click(); await page.waitForTimeout(900);
  ok(await page.evaluate(() => document.querySelectorAll('[data-act="ruleyes"]').length === 3 && /Fold them away/.test(document.getElementById('sweepfold').innerText)), 'Look at them shows the three questions');
  await page.locator('[data-act="sweepfold"][data-v=""]').click(); await page.waitForTimeout(900);
  ok(await page.evaluate(() => document.querySelectorAll('[data-act="ruleyes"]').length === 0), 'Fold them away puts them back in one line');
  await page.evaluate(() => { FC_RULES.suggestions = window.__sug; });
  // Dark theme: the header and rows still read
  await page.evaluate(id => ACTS.openrow(id), id); await page.waitForTimeout(1000);
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'dark' })); await page.waitForTimeout(800);
  ok(await page.evaluate(() => { const r = document.querySelector('#claimsteps .clstep > .sx-row'); return getComputedStyle(r).backgroundColor !== getComputedStyle(r).color; }), 'rows have their own colours in dark');
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await ctx.close(); process.exit(fails ? 1 : 0);
})();
