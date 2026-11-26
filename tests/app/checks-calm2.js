// The calm look, step 2: All copies and the copy panel. A short title, one command bar, the
// column names once above the list (click Match or Found to sort), rows as cards with a tick box
// for all, no clock button on rows, and a copy panel with three tabs, a facts line and a width
// you can drag.
const { start } = require('./h.js'); const { seed } = require('./seed.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1920, height: 1000 });
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(1200);
  await seed(page);
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'light' }));
  await page.goto(url('app.html#found')); await page.waitForSelector('.frow[data-act="openrow"]', { timeout: 30000 }); await page.waitForTimeout(800);
  await page.evaluate(() => { state.fView = 'list'; return render(true); }); await page.waitForTimeout(600);

  const h = await page.evaluate(() => {
    const head = document.querySelector('#view .head.foundhead'), bar = document.querySelector('.found-card');
    const x = s => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().x) : -1; };
    return {
      title: head ? head.querySelector('h1').textContent.replace(/\s+/g, ' ').trim() : '', lede: !!(head && head.querySelector('.lede')), tabs: !!(head && head.querySelector('.bigtabs')),
      cmd: [...document.querySelectorAll('.found-card .ddb')].map(b => b.textContent.replace(/\s+/g, ' ').trim().split(' ')[0]),
      dl: !!(bar && bar.querySelector('[data-act="fcsv"]')), dlHead: !!(head && head.querySelector('[data-act="fcsv"]')),
      names: [...document.querySelectorAll('#colHead .ccols > span')].map(s => s.textContent.replace(/[↕↓]/g, '').trim()),
      rowLabels: [...document.querySelectorAll('.frow .ccols .cl')].filter(e => e.offsetWidth > 0).length,
      hx: x('#colHead .cc-pct'), rx: x('.frow[data-act="openrow"] .cc-pct'), hd: x('#colHead .cc-dmg'), rd: x('.frow[data-act="openrow"] .cc-dmg'),
      clock: document.querySelectorAll('.frow [data-act="rowans"][data-v^="later|"]').length, keys: !!document.querySelector('.cfoot'),
      country: !!document.querySelector('.frow .cc-country'),
    };
  });
  ok(/All copies$/.test(h.title) && !h.lede && h.tabs, 'The title is "Copies found › All copies" with the Websites / Social media tabs beside it and no sentence under it (' + h.title + ')');
  ok(['Group', 'Filters', 'Sort', 'Download', 'Columns'].every(n => h.cmd.includes(n)) && h.dl && !h.dlHead, 'One command bar: Group, Filters, Sort, Download, Columns (' + h.cmd.join(', ') + ')');
  ok(h.names.includes('Match') && h.names.includes('Damages') && h.rowLabels === 0, 'Column names show once above the list, not on every row (' + h.names.join(', ') + ')');
  ok(h.hx > 0 && Math.abs(h.hx - h.rx) <= 1 && Math.abs(h.hd - h.rd) <= 1, `The names line up with their columns (${h.hx}/${h.rx}, ${h.hd}/${h.rd})`);
  ok(h.clock === 0 && !h.keys && !h.country, 'Rows have no clock button, the keys line is gone and Country starts hidden');

  // Click a column name to sort, click again to go back.
  await page.click('#colHead .cc-pct .hsort'); await page.waitForTimeout(700);
  const s1 = await page.evaluate(() => ({ sort: state.fSort, on: !!document.querySelector('#colHead .cc-pct .hsort.on'), pcts: LIST.slice(0, 12).map(id => { const c = FCD.copies.find(x => x.id === id); return c.pct == null ? -1 : c.pct; }) }));
  ok(s1.sort === 'pct' && s1.on && s1.pcts.every((p, i) => !i || p <= s1.pcts[i - 1]), 'Clicking Match sorts by the best match first (' + s1.pcts.slice(0, 5).join(', ') + ')');
  await page.click('#colHead .cc-pct .hsort'); await page.waitForTimeout(700);
  ok(await page.evaluate(() => state.fSort === 'act'), 'Clicking it again goes back to Best to act on');

  // The tick box above the list picks every copy showing.
  await page.click('#colHead .cpickall'); await page.waitForTimeout(600);
  const pk = await page.evaluate(() => ({ n: state.picked.length, all: LIST.length, box: document.querySelector('#colHead .cpickall').checked }));
  ok(pk.n === pk.all && pk.n > 1 && pk.box, `The tick box above the list picks every copy showing (${pk.n})`);
  await page.click('#colHead .cpickall'); await page.waitForTimeout(600);
  ok(await page.evaluate(() => state.picked.length === 0), 'Clicking it again clears the picks');

  // Filters: Found and Match live inside the Filters panel.
  await page.click('.ddb.cmd:has-text("Filters")'); await page.waitForTimeout(500);
  ok(await page.evaluate(() => !!document.querySelector('.fpanel [data-dd="fWhen"]') && !!document.querySelector('.fpanel [data-dd="fMatch"]')), 'Filters holds the Found and Match choices');
  await page.click('.ddb.cmd:has-text("Filters")'); await page.waitForTimeout(400);

  // The copy panel.
  await page.locator('.frow[data-act="openrow"] .l3').first().click(); await page.waitForSelector('#drawer', { timeout: 10000 }); await page.waitForTimeout(900);
  const d = await page.evaluate(() => {
    const d = document.getElementById('drawer');
    return {
      tabs: [...d.querySelectorAll('.dtabs button')].map(b => b.textContent.replace(/\d+/g, '').trim()), facts: d.querySelectorAll('.factline .fchip').length,
      caps: (d.querySelector('.calm-caps') || {}).textContent || '', kbd: d.querySelectorAll('.dfoot .kbd').length, ans: d.querySelectorAll('.dfoot [data-act="dverdict"]').length,
      w: Math.round(d.getBoundingClientRect().width), grip: !!d.querySelector('#dgrip'), used: /How it.s used/.test(d.querySelector('.dpane[data-tab="sum"]').textContent),
    };
  });
  ok(d.tabs.join() === 'This copy,Claim,The site', 'The panel has three tabs: This copy, Claim, The site');
  ok(d.facts >= 2 && /Your client's/.test(d.caps) && /Theirs/.test(d.caps), `A line of facts sits under the pictures, which are named "Your client's" and "Theirs" (${d.facts} facts)`);
  ok(d.ans >= 3 && d.kbd === 0 && !d.used, 'The answer buttons have no key letters on them, and "How it\'s used" is not repeated in the list');
  // Drag the left edge to make the panel wider; it is remembered.
  const g = await page.evaluate(() => { const r = document.getElementById('dgrip').getBoundingClientRect(); return [r.x + r.width / 2, r.y + 200]; });
  await page.mouse.move(g[0], g[1]); await page.mouse.down(); await page.mouse.move(g[0] - 120, g[1], { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(500); await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
  const w2 = await page.evaluate(async () => ({ w: Math.round(document.getElementById('drawer').getBoundingClientRect().width), saved: (await chrome.storage.local.get('fcDrawerW')).fcDrawerW }));
  ok(d.grip && w2.w >= d.w + 100 && w2.saved === w2.w, `Dragging the panel's left edge makes it wider and it is remembered (${d.w} to ${w2.w})`);
  await page.reload(); await page.waitForSelector('.frow[data-act="openrow"]', { timeout: 30000 });
  await page.locator('.frow[data-act="openrow"] .l3').first().click(); await page.waitForSelector('#drawer', { timeout: 10000 }); await page.waitForTimeout(600); await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
  ok(await page.evaluate(w => Math.abs(document.getElementById('drawer').getBoundingClientRect().width - w) <= 1, w2.w), 'The panel opens at that width next time');

  // Grouped by client: the Client column is not repeated on the rows.
  await page.keyboard.press('Escape'); await page.evaluate(() => { state.open = null; state.fView = 'client'; return render(true); }); await page.waitForTimeout(700);
  ok(await page.evaluate(() => !!document.querySelector('.ghead') && !document.querySelector('.frow .cc-client') && !document.querySelector('#colHead .cc-client')), 'Grouped by client, the Client column is left out (the group already names it)');

  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL crashed ' + String(e).slice(0, 400)); process.exit(1); });
