// UI overhaul batch 2: Copies found answer bar, match pill, client headings that fold, the details
// panel's top and answer strip, the floating bar for ticked rows, and "All caught up". Pretend data only.
const { start } = require('./h.js');
process.env.NP = 300; process.env.NC = 80;
const { seed } = require('./seed.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage(); await page.setViewportSize({ width: 1400, height: 900 });
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(1200);
  await seed(page); await page.goto(url('app.html#found')); await page.waitForTimeout(2200);
  await page.evaluate(() => { state.fView = 'client'; return render(true); }); await page.waitForTimeout(700);
  const r = await page.evaluate(() => ({
    bar: !!document.querySelector('.toolbar.tidy .tabs.ansbar [data-v="Stolen"]'),
    gear: (document.querySelector('[data-dd="cols"] > summary') || {}).getAttribute('aria-label'),
    pill: [...document.querySelectorAll('.crow .mpill')].map(e => e.className),
    heads: document.querySelectorAll('.ghead.chead .cav').length, chips: document.querySelectorAll('.ghead.chead .gchip').length,
  }));
  ok(r.bar, 'Answer types sit in one bar');
  ok(r.gear === 'Columns', 'Columns is a gear button with a name');
  ok(r.pill.length > 0 && r.pill.every(c => /\b(hi|mid|lo)\b/.test(c)), 'Each row has a coloured match pill (' + r.pill.length + ')');
  ok(r.heads > 0 && r.chips >= r.heads * 2, 'Client headings have an initials badge and two count chips');
  const fold = await page.evaluate(async () => { const h = document.querySelector('.ghead.chead'), before = document.querySelectorAll('.crow').length; h.click(); await new Promise(r => setTimeout(r, 600)); const after = document.querySelectorAll('.crow').length; document.querySelector('.ghead.chead').click(); await new Promise(r => setTimeout(r, 600)); return { before, after, back: document.querySelectorAll('.crow').length }; });
  ok(fold.after < fold.before && fold.back === fold.before, 'A client heading folds and opens (' + fold.before + ' → ' + fold.after + ' → ' + fold.back + ')');
  await page.evaluate(() => { state.picked = LIST.slice(0, 3); return render(true); }); await page.waitForTimeout(600);
  const b = await page.evaluate(() => { const e = document.querySelector('.bulk.float'); return e ? { pos: getComputedStyle(e).position, t: e.textContent, n: e.querySelectorAll('[data-act="bulk"]').length } : null; });
  ok(b && b.pos === 'fixed' && /3 picked/.test(b.t) && b.n === 3, 'Ticked rows show a floating bar with Stolen, Licensed and Remove');
  await page.evaluate(() => { state.picked = []; state.open = LIST[1]; return render(true); }); await page.waitForTimeout(1300);
  const d = await page.evaluate(() => { const h = document.querySelector('#drawer .dhead'); return { title: !!h.querySelector('.dtitle'), step: h.querySelectorAll('[data-act="dstep"]').length, foot: document.querySelectorAll('#drawer .dfoot2 [data-act="dstep"]').length, strip: document.querySelectorAll('#drawer .dans.ansstrip [data-act="dverdict"]').length }; });
  ok(d.title && d.step === 0, 'Panel top holds only the site name, tag and Close');
  ok(d.foot === 2 && d.strip === 4, 'Previous / Next sit by the answers; four answers in one strip');
  await page.evaluate(() => { FCD.copies.forEach(c => { if (c.status === 'new') c.status = 'stolen'; }); state.open = null; state.fFilter = 'New'; return render(true); }); await page.waitForTimeout(700);
  const e = await page.evaluate(() => ({ t: (document.querySelector('.cempty.caught') || {}).textContent || '', keep: !!document.querySelector('.cempty.caught a[href="#keep"]') }));
  ok(/All caught up/.test(e.t) && e.keep, 'No new copies: "All caught up" with a Keep searching button');
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e); process.exit(1); });
