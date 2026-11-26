// UI overhaul batch 6: Tools is its own menu item; Inspect, Compare, Mark up and Convert use the main
// page layout (heading with buttons on the right, no second logo or link list), blue main buttons,
// one drop card, Compare's floating bar, Inspect's fact cards, Convert's tiles, Tools' Used lately.
const { start } = require('./h.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage(); await page.setViewportSize({ width: 1400, height: 900 });
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(1000);
  const png = Buffer.from(await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 300; c.height = 200; const x = c.getContext('2d'); for (let i = 0; i < 60; i++) { x.fillStyle = 'hsl(' + i * 37 + ',70%,50%)'; x.fillRect((i * 53) % 280, (i * 31) % 180, 30, 30); } return c.toDataURL('image/png').split(',')[1]; }), 'base64');

  // Tools menu item with the four tools under it
  await page.goto(url('app.html#compare')); await page.waitForTimeout(1500);
  const m = await page.evaluate(() => ({ on: (document.querySelector('#side .nav.on') || {}).textContent || '', sub: [...document.querySelectorAll('#side .subs a')].map(a => a.textContent.trim()), cur: !!document.querySelector('#side .subs a.on[href="#compare"]') }));
  ok(/Tools/.test(m.on) && m.cur && ['Inspect a photo', 'Compare two photos', 'Mark up a copy', 'Convert files'].every(t => m.sub.includes(t)), 'Tools menu item lists Inspect, Compare, Mark up, Convert: ' + m.sub.join(', '));

  // Each tool: page heading, no logo, no link list, blue main button
  for (const [f, h1] of [['inspect', 'Inspect a photo'], ['compare', 'Compare two photos'], ['markup', 'Mark up a copy'], ['convert', 'Convert files']]) {
    await page.goto(url(f + '.html')); await page.waitForTimeout(900);
    const r = await page.evaluate(() => ({
      h1: (document.querySelector('.tp-head h1') || {}).textContent || '', acts: document.querySelectorAll('#tpAct > *').length,
      brand: getComputedStyle(document.querySelector('#side .brand')).display, blank: document.querySelectorAll('#side a[target=_blank]').length,
      drop: !!document.querySelector('.tp-drop'),
    }));
    if (f !== 'convert') {   // Inspect, Compare and Mark up have the calm look (checks-calm17b.js, checks-calm17c.js): their own title and drop card
      const c = await page.evaluate(() => ({ h1: document.querySelector('.tn .nhead').textContent, old: !!document.getElementById('tpHead').offsetParent || !!document.getElementById('side').offsetParent, drop: !!document.querySelector('.tn .tn-drop .nbtn').offsetParent }));
      ok(c.h1.includes(h1) && !c.old && r.blank === 0, f + ': calm page title, no second logo or link list');
      ok(c.drop, f + ': starts with the drop card');
      continue;
    }
    ok(r.h1.trim() === h1 && r.acts >= 1 && r.brand === 'none' && r.blank === 0, f + ': page heading "' + r.h1 + '" with ' + r.acts + ' buttons on the right, no second logo or link list');
    ok(r.drop, f + ': starts with the shared drop card');
  }

  // Inspect: plain sentence + six fact cards after adding a picture
  await page.goto(url('inspect.html')); await page.waitForTimeout(800);
  await page.setInputFiles('#pick', { name: 'photo.png', mimeType: 'image/png', buffer: png }); await page.waitForTimeout(2500);
  const fc = await page.evaluate(() => ({ n: document.querySelectorAll('#iFacts .tn-fr').length, shown: !!document.getElementById('iFacts').offsetParent, blue: getComputedStyle(document.getElementById('iBtnPack')).backgroundColor }));
  ok(fc.shown && fc.n >= 6, 'Inspect: the facts as label rows beside the picture (' + fc.n + ')');
  ok(!/rgb\(2[0-9], 1[2-6][0-9], [4-7][0-9]\)/.test(fc.blue) && /rgb\(0, (94|95|112), (153|184)\)/.test(fc.blue), 'Inspect: Save evidence pack is PageProof blue, not green (' + fc.blue + ')');

  // Compare: the two files above the picture; a button that is not ready is grey and says why
  await page.goto(url('compare.html')); await page.waitForTimeout(800);
  await page.setInputFiles('#slotA input', { name: 'photo.png', mimeType: 'image/png', buffer: png }); await page.waitForTimeout(1500);
  const dis = await page.evaluate(() => { const b = document.getElementById('cBtnAuto'); return { off: b.disabled, why: b.title, bg: getComputedStyle(b).backgroundColor }; });
  ok(dis.off && dis.why && !/rgb\(1[2-9]\d, 2\d\d, 1\d\d\)/.test(dis.bg), 'A button that is not ready is grey (not pale green) and says why');
  await page.setInputFiles('#slotB input', { name: 'copy.png', mimeType: 'image/png', buffer: png }); await page.waitForTimeout(2000);
  const cp = await page.evaluate(() => { const s = document.getElementById('cCmd').getBoundingClientRect(), st = document.getElementById('view').getBoundingClientRect(), fl = document.getElementById('tpFloat').getBoundingClientRect(); return { slotsAbove: s.bottom <= st.top + 2, floatBelow: fl.top >= st.top, modes: !!document.querySelector('#tpFloat #modes'), op: !!document.querySelector('#tpFloat #opacity') }; });
  ok(cp.slotsAbove && cp.floatBelow && cp.modes && cp.op, 'Compare: Original and Copy above the picture, modes and slider in the floating bar');

  // Mark up: one toolbar across the top of the picture
  await page.goto(url('markup.html')); await page.waitForTimeout(800);
  await page.setInputFiles('#pick', { name: 'photo.png', mimeType: 'image/png', buffer: png }); await page.waitForTimeout(2000);
  const mk = await page.evaluate(() => { const s = document.getElementById('mBar').getBoundingClientRect(), st = document.getElementById('board').getBoundingClientRect(); return { above: s.bottom <= st.top + 2, slim: s.height < 120 }; });
  ok(mk.above && mk.slim, 'Mark up: one slim toolbar above the picture');

  // Convert: what it can do as tiles
  await page.goto(url('convert.html')); await page.waitForTimeout(800);
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('.tp-drop .can')).display === 'grid' && document.querySelectorAll('.tp-drop .can span').length >= 6), 'Convert: what it can do is a grid of tiles');

  // Tools page: the six real tools (Opened lately is checked in checks-calm17.js)
  await page.goto(url('app.html#tools')); await page.waitForTimeout(1200);
  const tl = await page.evaluate(() => [...document.querySelectorAll('#tlTiles .tn-tile')].map(a => a.dataset.tool));
  ok(tl.join() === 'inspect,compare,markup,files,openfiles,verify', 'Tools: the six tools: ' + tl.join(', '));
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e); process.exit(1); });
