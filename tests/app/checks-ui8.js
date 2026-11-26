// UI overhaul batch 8: the toolbar pop-up (capture card names the page, three number
// tiles, Keep searching switch, photos on the page as small pictures) and the
// capture progress card (four steps, "Screen N of M", outlined Stop, light or dark).
const { start } = require('./h.js');
process.env.NP = 120; process.env.NC = 40;
const { seed } = require('./seed.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800); await seed(page);
  await page.evaluate(() => FC.setKeep({ on: true }));
  const png = Buffer.from(await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 300; c.height = 200; const x = c.getContext('2d'); x.fillStyle = '#3a7'; x.fillRect(0, 0, 300, 200); return c.toDataURL('image/png').split(',')[1]; }), 'base64');
  await ctx.route('https://www.example-news.com/**', r => /\.png/.test(r.request().url()) ? r.fulfill({ contentType: 'image/png', body: png }) : r.fulfill({ contentType: 'text/html', body: '<title>An example story</title><h1>News</h1>' + [1, 2, 3, 4, 5, 6, 7].map(i => '<img src="/p' + i + '.png">').join('') }));
  const web = await ctx.newPage(); await web.goto('https://www.example-news.com/story'); await web.waitForTimeout(600);

  const sp = await ctx.newPage(); await sp.setViewportSize({ width: 400, height: 760 });
  sp.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await sp.goto(url('popup.html')); await web.bringToFront(); await sp.waitForTimeout(300);
  await sp.evaluate(() => draw()); await sp.waitForTimeout(1500); // draw again now the website is the active tab
  const r = await sp.evaluate(() => ({
    cap: (document.querySelector('#cap small') || {}).textContent || '', title: (document.querySelector('#cap') || {}).title || '',
    rows: [...document.querySelectorAll('#nums .nrow')].map(t => t.dataset.go), sw: !!document.querySelector('.krow #keepon'),
    tools: [...document.querySelectorAll('#tools .ntool')].map(t => t.dataset.go), photos: /Photos on this page/.test(document.body.textContent), panel: !!document.getElementById('panel'),
  }));
  ok(r.cap === 'example-news.com' && r.title === 'An example story', 'Capture card names the site (the page title is its tip): ' + r.cap);
  ok(r.rows.join(',') === 'review,tocapture,keep', 'Three number rows: new copies, to capture, searched today');
  ok(r.sw, 'Keep searching is one row with a switch');
  ok(r.tools.join(',') === 'inspect,compare,markup,files,openfiles' && !r.photos, 'Five tool buttons took the place of Photos on this page');
  ok(!r.panel, 'The side panel is gone: no "Keep it open beside this page" button');
  await sp.click('#keepon'); await sp.waitForTimeout(900);
  ok(await sp.evaluate(async () => (await FC.keep()).on === false), 'The switch turns Keep searching off');
  await sp.close();

  // The capture progress card, in light and dark.
  for (const th of ['light', 'dark']) {
    const w = await ctx.newPage(); await w.goto('https://www.example-news.com/story');
    await page.evaluate(t => chrome.storage.local.set({ ppTheme: t }), th);
    await w.evaluate(() => { window.chrome = window.chrome || {}; });
    await w.addScriptTag({ path: require('path').join(__dirname, '../../extension/content.js') });
    const o = await w.evaluate(async () => { window.__pageproof.ovShow('Screen 6 of 14', 1); const el = document.querySelector('pageproof-progress'); return { shown: !!el && el.style.display === 'block' }; });
    await w.evaluate(() => window.__pageproof.ovHide());
    const hid = await w.evaluate(() => document.querySelector('pageproof-progress').style.display === 'none');
    ok(o.shown && hid, th + ': the progress card shows during the capture and hides for every screenshot');
    await w.close();
  }
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e); process.exit(1); });
