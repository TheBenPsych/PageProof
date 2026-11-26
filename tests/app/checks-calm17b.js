// The calm look, step 17 (part 2): Tools › Inspect a photo.
// One calm page: a drop card while nothing is open; then the file on a command line with the
// buttons, the picture on the left and "What the file says", the label rows and the folds on the
// right. Save evidence pack asks for the case details first. Nothing that Inspect could do is lost.
process.env.NP = process.env.NP || '200'; process.env.NC = process.env.NC || '5';   // before seed.js is read
const { start } = require('./h.js'); const { seed } = require('./seed.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(1200);
  await seed(page);
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'light', ppToolsRecent: [] }));
  const T = (ms = 500) => page.waitForTimeout(ms);
  const png = Buffer.from(await page.evaluate(async () => { const c = new OffscreenCanvas(640, 420), g = c.getContext('2d'); g.fillStyle = '#2f5f8f'; g.fillRect(0, 0, 640, 420); g.fillStyle = '#f2c14e'; g.fillRect(120, 90, 200, 160); return [...new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer())]; }));

  // ---- nothing open yet
  await page.goto(url('app.html#inspect')); await T(2500);
  const fr = page.frames().find(f => /inspect\.html/.test(f.url()));
  ok(!!fr, 'Inspect a photo opens inside PageProof');
  const e0 = await fr.evaluate(() => { const vis = id => { const e = document.getElementById(id); return !!e && !!e.offsetParent; }; return { h1: document.querySelector('.nhead h1, .nhead').textContent.replace(/\s+/g, ' ').trim(), heads: document.querySelectorAll('h1').length, oldHead: vis('tpHead'), side: vis('side'), drop: vis('iPick'), found: vis('iFromFound'), what: /What Inspect reads/.test(document.getElementById('iEmpty').textContent), shown: vis('iShown'), over: document.documentElement.scrollWidth > innerWidth + 2 }; });
  ok(/Inspect a photo/.test(e0.h1) && !e0.oldHead && !e0.side, 'One calm title, the old heading and side column are gone: ' + e0.h1);
  ok(e0.drop && e0.found && e0.what && !e0.shown && !e0.over, 'Nothing open: a drop card with Choose a file and Pick from Copies found, and what Inspect reads');

  // ---- one photo
  await fr.setInputFiles('#pick', { name: 'photo.png', mimeType: 'image/png', buffer: png }); await T(2500);
  const s1 = await fr.evaluate(() => {
    const vis = id => { const e = document.getElementById(id); return !!e && !!e.offsetParent; }, box = id => document.getElementById(id).getBoundingClientRect();
    return { empty: vis('iEmpty'), chip: document.getElementById('iChip').textContent, btns: [...document.querySelectorAll('#iCmd > .nbtn, #iCmd .tn-morew > .nbtn')].filter(b => b.offsetParent).map(b => b.textContent.trim()), more: !document.getElementById('iMore').hidden,
      picLeft: box('iPic').right <= box('iSay').left + 2, img: document.getElementById('shownImg').naturalWidth, keys: [...document.querySelectorAll('#iKeys .tn-k')].map(k => k.textContent.trim()), rows: [...document.querySelectorAll('#iFacts .tn-fr .l')].map(l => l.textContent),
      size: document.querySelector('#iFacts .tn-fr:nth-last-child(2) .v').textContent, caseOpen: document.getElementById('iCase').open, folds: document.querySelectorAll('#iFolds details').length, pack: getComputedStyle(document.getElementById('iBtnPack')).backgroundColor, off: document.getElementById('iBtnPack').disabled, over: document.documentElement.scrollWidth > innerWidth + 2 };
  });
  ok(!s1.empty && /photo\.png/.test(s1.chip) && /From your computer/.test(s1.chip) && /PP-/.test(s1.chip), 'The file sits on the command line with where it came from and its ID: ' + s1.chip.replace(/\s+/g, ' ').slice(0, 90));
  ok(s1.btns.join('|') === 'Inspect another|Compare with the original|Mark up|Copy the details|More|Save evidence pack' && !s1.more, 'The buttons: ' + s1.btns.join(' · '));
  ok(s1.picLeft && s1.img === 640 && !s1.over, 'The picture on the left, the answers on the right, nothing scrolls sideways');
  ok(s1.keys.length === 5 && s1.keys.includes('No creator') && s1.keys.includes('No copyright notice'), 'Five yes or no chips: ' + s1.keys.join(' · '));
  ok(['Camera', 'Taken', 'Place', 'Edited with', 'Creator', 'Copyright', 'Size', 'Fingerprint'].every(l => s1.rows.includes(l)) && /640 × 420/.test(s1.size), 'Label rows, with Not saved where the file has nothing: ' + s1.rows.join(', '));
  ok(!s1.caseOpen && s1.folds >= 2 && !s1.off && /rgb\(0, (94|95|112), (153|184)\)/.test(s1.pack), 'Case details starts closed, the rest of the hidden data stays in folds, Save evidence pack is blue');

  // More keeps the three buttons the new design had no room for
  await fr.click('#iMoreBtn'); await T(200);
  const mo = await fr.evaluate(() => [...document.querySelectorAll('#iMore .nbtn')].filter(b => b.offsetParent && !b.disabled).map(b => b.textContent.trim()));
  ok(mo.join('|') === 'Save as PDF|Copy the picture|Download the original file', 'More: ' + mo.join(' · '));
  await fr.press('body', 'Escape'); await T(200);
  ok(await fr.evaluate(() => document.getElementById('iMore').hidden), 'Esc closes More');

  // Copy the details
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await fr.evaluate(() => { window.__copied = ''; navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); }; });
  await fr.click('#iCopy'); await T(300);
  const cp = await fr.evaluate(() => ({ t: window.__copied, st: document.getElementById('status').textContent }));
  ok(/^photo\.png\n/.test(cp.t) && /Fingerprint: [0-9a-f]{64}/.test(cp.t) && /Creator: Not saved/.test(cp.t) && /Details copied/.test(cp.st), 'Copy the details copies the name, every row and the whole fingerprint');

  // Save evidence pack: the first press opens Case details, the second saves
  await fr.evaluate(() => { window.__saved = []; download = (blob, name) => { window.__saved.push(name); }; });   // eslint-disable-line no-global-assign
  await fr.click('#iBtnPack'); await T(700);
  const a1 = await fr.evaluate(() => ({ open: document.getElementById('iCase').open, hint: !document.getElementById('iCaseHint').hidden, saved: window.__saved.length, focus: document.activeElement.id }));
  ok(a1.open && a1.hint && !a1.saved && a1.focus === 'caseRef', 'First press of Save evidence pack opens Case details and waits on the case number');
  await fr.fill('#caseRef', 'T-1001'); await fr.fill('#collector', 'Sam Tester'); await T(200);
  ok(/Collected by Sam Tester · case T-1001/.test(await fr.evaluate(() => document.querySelector('#iCase summary').textContent)), 'The fold line shows who and which case');
  await fr.click('#iPack2');
  await fr.waitForFunction(() => window.__saved.length > 0, null, { timeout: 90000 }).catch(() => {});
  const sv = await fr.evaluate(() => window.__saved);
  ok(sv.length === 1 && /\.zip$/.test(sv[0]), 'The second press saves the pack: ' + sv.join());

  // ---- dark, and in its own tab
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'dark' })); await T(900);
  const dk = await fr.evaluate(() => { const lum = c => { const m = c.match(/[\d.]+/g).map(Number); return m.length > 3 && m[3] === 0 ? -1 : (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; }; return [...document.querySelectorAll('#iRoot *')].filter(e => e.offsetParent && !e.closest('img,.tn-pw,input,textarea') && e.getBoundingClientRect().width > 30 && lum(getComputedStyle(e).backgroundColor) > 0.85).slice(0, 3).map(e => e.tagName + '.' + e.className); });
  ok(!dk.length, 'Dark: nothing is left white ' + dk.join(', '));
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'light' }));
  const own = await ctx.newPage(); own.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await own.setViewportSize({ width: 1000, height: 800 }); await own.goto(url('inspect.html')); await own.waitForTimeout(1200);
  await own.setInputFiles('#pick', { name: 'photo.png', mimeType: 'image/png', buffer: png }); await own.waitForTimeout(2500);
  const ow = await own.evaluate(() => ({ found: !!document.getElementById('iFromFound'), shown: !!document.getElementById('iShown').offsetParent, over: document.documentElement.scrollWidth > innerWidth + 2, stack: document.getElementById('iPic').getBoundingClientRect().bottom <= document.getElementById('iSay').getBoundingClientRect().top + 2 }));
  ok(ow.shown && !ow.over && ow.stack, 'In its own tab at 1000 px wide: the picture stacks above the answers and nothing scrolls sideways');

  // ---- Opened lately on All tools
  await page.goto(url('app.html#tools')); await page.waitForSelector('#tlTiles', { timeout: 60000 }); await T(700);
  const rec = await page.evaluate(() => [...document.querySelectorAll('#tlRecent .tn-rr')].map(r => r.textContent.replace(/\s+/g, ' ').trim()));
  ok(rec.some(r => /photo\.png/.test(r) && /Inspect/.test(r)), 'The photo shows under Opened lately on All tools: ' + (rec[0] || '').slice(0, 80));

  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
