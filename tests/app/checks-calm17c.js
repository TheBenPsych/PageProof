// The calm look, step 17 (part 3): Tools › Compare two photos and Mark up a copy.
// Compare: the two files and Line them up on one line, the picture with its view bar floating at
// the bottom, the result card and three folds on the right. Mark up: one toolbar across the top
// of the picture. What both tools do is unchanged, so their own buttons are pressed from here.
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
  // A made-up photo with plenty of detail, and a smaller copy of it.
  const [big, small] = (await page.evaluate(async () => {
    const c = new OffscreenCanvas(900, 600), x = c.getContext('2d'); let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    x.fillStyle = '#345'; x.fillRect(0, 0, 900, 600);
    for (let i = 0; i < 500; i++) { x.fillStyle = `hsl(${rnd() * 360},70%,${30 + rnd() * 50}%)`; x.fillRect(rnd() * 900, rnd() * 600, 5 + rnd() * 70, 5 + rnd() * 70); }
    const d = new OffscreenCanvas(600, 400); d.getContext('2d').drawImage(c, 0, 0, 600, 400);
    const bytes = async cv => [...new Uint8Array(await (await cv.convertToBlob({ type: 'image/png' })).arrayBuffer())];
    return [await bytes(c), await bytes(d)];
  })).map(a => Buffer.from(a));
  const lum = `c => { const m = c.match(/[\\d.]+/g).map(Number); return m.length > 3 && m[3] === 0 ? -1 : (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; }`;
  const white = sel => `(() => { const lum = ${lum}; return [...document.querySelectorAll('${sel} *')].filter(e => e.offsetParent && !e.closest('img,canvas,input,textarea,.swatch,.tn-stage,.tn-board') && e.getBoundingClientRect().width > 30 && lum(getComputedStyle(e).backgroundColor) > 0.85).slice(0, 3).map(e => e.tagName + '.' + e.className); })()`;

  // =============================================================== Compare two photos
  await page.goto(url('app.html#compare')); await T(2500);
  const cf = page.frames().find(f => /compare\.html/.test(f.url()));
  ok(!!cf, 'Compare two photos opens inside PageProof');
  const c0 = await cf.evaluate(() => { const vis = id => { const e = document.getElementById(id); return !!e && !!e.offsetParent; }; return { h1: document.querySelector('#cRoot .nhead').textContent.replace(/\s+/g, ' ').trim(), old: vis('tpHead') || vis('side') || vis('slotA'), cmd: vis('cCmd'), a: vis('cPickA'), b: vis('cPickB'), what: /What Compare shows/.test(document.getElementById('cEmpty').textContent), shown: vis('cShown') }; });
  ok(/Compare two photos/.test(c0.h1) && !c0.old, 'One calm title, the old heading, side column and boxes are gone: ' + c0.h1);
  ok(c0.a && c0.b && c0.what && !c0.cmd && !c0.shown, 'Nothing open: one drop card with Choose the original and Choose the copy, and what Compare shows');

  await cf.setInputFiles('#slotA input', { name: 'original.png', mimeType: 'image/png', buffer: big }); await T(1500);
  const c1 = await cf.evaluate(() => { const vis = id => { const e = document.getElementById(id); return !!e && !!e.offsetParent; }; return { cmd: vis('cCmd'), a: document.getElementById('cA').textContent, b: document.getElementById('cB').textContent, next: document.querySelector('#cEmpty .tn-dt b').textContent, pickA: vis('cPickA'), pickB: vis('cPickB'), auto: document.getElementById('cBtnAuto').disabled, why: document.getElementById('cBtnAuto').title, swap: document.getElementById('cSwap').disabled, st: document.getElementById('status').textContent }; });
  ok(c1.cmd && /original\.png · 900 × 600/.test(c1.a) && /Choose the one found online/.test(c1.b), 'The original sits on the command line, the copy chip waits: ' + c1.a + ' | ' + c1.b);
  ok(c1.next === 'Now add the copy' && c1.pickB && !c1.pickA && c1.auto && /both pictures/.test(c1.why) && c1.swap && !/box/.test(c1.st), 'The card asks for the copy, and Line them up is grey and says why');

  await cf.setInputFiles('#slotB input', { name: 'copy.png', mimeType: 'image/png', buffer: small }); await T(2000);
  const c2 = await cf.evaluate(() => {
    const vis = id => { const e = document.getElementById(id); return !!e && !!e.offsetParent; }, box = id => document.getElementById(id).getBoundingClientRect();
    return { empty: vis('cEmpty'), btns: [...document.querySelectorAll('#cCmd > .nbtn')].filter(b => b.offsetParent).map(b => b.textContent.trim() + (b.disabled ? ' (off)' : '')), near: vis('cNear'), left: box('cView').right <= box('cRes').left + 2, canvas: vis('view'), inStage: !!document.querySelector('.tn-stage #view'),
      float: box('tpFloat').top > box('view').top && box('tpFloat').bottom <= box('cView').bottom, modes: [...document.querySelectorAll('#modes button')].map(b => b.textContent.trim() + (b.classList.contains('on') ? '*' : '')), not: vis('cNot'), score: vis('score'),
      folds: [...document.querySelectorAll('#cShown details.tn-exp')].map(d => d.querySelector('b').textContent + (d.open ? ' (open)' : '')), move: [...document.querySelectorAll('#cMove .nbtn')].map(b => b.textContent.trim()), moved: document.querySelector('#cMove summary').textContent, shape: document.getElementById('cShapeSub').textContent, over: document.documentElement.scrollWidth > innerWidth + 2 };
  });
  ok(!c2.empty && c2.btns.join('|') === 'Line them up automatically|Save picture|Save as PDF|Make a video' && c2.near, 'Both in: ' + c2.btns.join(' · ') + ', and Check nearby shots');
  ok(c2.left && c2.canvas && c2.inStage && c2.float && !c2.over, 'The picture on the left with the view bar floating at its bottom, nothing scrolls sideways');
  ok(c2.modes.join('|') === 'Overlay*|Difference|Colour check|Side by side', 'The view bar: ' + c2.modes.join(' · '));
  ok(c2.not && !c2.score && c2.folds.join('|') === 'Move the copy (open)|Size and shape|Compare a spot', 'Not lined up yet, and three folds: ' + c2.folds.join(' · '));
  ok(c2.move.join('|') === 'Slide aside and back|Play fade|− Smaller|Bigger' && /Moved 0, 0 px/.test(c2.moved) && /^150% · not stretched · not turned$/.test(c2.shape), 'Move the copy has its four buttons, Size and shape says: ' + c2.shape);

  await cf.click('#cBtnAuto');
  await cf.waitForFunction(() => !document.getElementById('score').hidden, null, { timeout: 90000 }).catch(() => {}); await T(600);
  const c3 = await cf.evaluate(() => ({ not: !!document.getElementById('cNot').offsetParent, v: document.getElementById('cRes').dataset.v, head: document.querySelector('#score b').textContent, pct: document.querySelector('#score .pct').textContent, col: getComputedStyle(document.querySelector('#score .pct')).color, shape: document.getElementById('cShapeSub').textContent }));
  ok(!c3.not && c3.v === 'good' && /same photo/.test(c3.head) && /\d+% lines up/.test(c3.pct), 'Lined up: the result card says "' + c3.head + '", ' + c3.pct);
  ok(/^(149|150|151)(\.\d)?% · not stretched/.test(c3.shape), 'Size and shape follows the copy: ' + c3.shape);

  // the moved controls still work
  await cf.click('#modes button[data-mode="diff"]'); await T(200);
  const c4 = await cf.evaluate(() => ({ on: document.querySelector('#modes button.on').dataset.mode, val: document.getElementById('opVal').textContent, vis: !!document.getElementById('opVal').offsetParent }));
  ok(c4.on === 'diff' && /Difference view/.test(c4.val) && c4.vis, 'Difference in the view bar switches the view: ' + c4.val);
  await cf.click('#modes button[data-mode="overlay"]');
  await cf.click('#cShape summary'); await T(200);
  await cf.evaluate(() => { const r = document.getElementById('shR'); r.value = 20; r.dispatchEvent(new Event('input', { bubbles: true })); }); await T(300);
  const c5 = await cf.evaluate(() => ({ sub: document.getElementById('cShapeSub').textContent, rows: document.querySelectorAll('#cShape .shRow').length, reset: !!document.querySelector('#cShape #shReset').offsetParent }));
  ok(c5.rows === 4 && c5.reset && /turned 2\.0°/.test(c5.sub), 'Size and shape holds the four sliders and Reset shape, and its line follows: ' + c5.sub);
  await cf.click('#shReset'); await T(300);
  await cf.click('#cBtnFade'); await T(400);
  const f1 = await cf.evaluate(() => document.getElementById('cBtnFade').textContent.trim());
  await cf.click('#cBtnFade'); await T(400);
  const f2 = await cf.evaluate(() => document.getElementById('cBtnFade').textContent.trim());
  ok(f1 === 'Stop fade' && f2 === 'Play fade', 'Play fade turns into Stop fade and back');
  await cf.click('#cSpots summary'); await T(200); await cf.click('#cBtnSpotBtn'); await T(200);
  const sp = await cf.evaluate(() => ({ t: document.getElementById('cBtnSpotBtn').textContent.trim(), cur: document.getElementById('view').classList.contains('spotting') }));
  ok(sp.t === 'Cancel picking' && sp.cur, 'Pick a spot turns picking on');
  await cf.click('#cBtnSpotBtn');

  // swap
  await cf.click('#cSwap'); await T(2500);
  const sw = await cf.evaluate(() => ({ a: document.getElementById('cA').textContent, b: document.getElementById('cB').textContent, not: !!document.getElementById('cNot').offsetParent }));
  ok(/copy\.png · 600 × 400/.test(sw.a) && /original\.png · 900 × 600/.test(sw.b) && sw.not, 'Swap turns the two round and starts again: ' + sw.a + ' | ' + sw.b);

  // saving still goes through the page's own button
  await cf.evaluate(() => { window.__saved = []; download = (blob, name) => { window.__saved.push(name); }; });   // eslint-disable-line no-global-assign
  await cf.click('#cBtnSPng'); await cf.waitForFunction(() => window.__saved.length > 0, null, { timeout: 30000 }).catch(() => {});
  const saved = await cf.evaluate(() => window.__saved);
  ok(saved.length === 1 && /^PageProof_compare_.*\.png$/.test(saved[0]), 'Save picture saves ' + saved.join());

  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'dark' })); await T(900);
  const cd = await cf.evaluate(white('#cRoot'));
  ok(!cd.length, 'Compare, dark: nothing is left white ' + cd.join(', '));
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'light' }));

  // =============================================================== Mark up a copy
  await page.goto(url('app.html#markup')); await T(2500);
  const mf = page.frames().find(f => /markup\.html/.test(f.url()));
  ok(!!mf, 'Mark up a copy opens inside PageProof');
  const m0 = await mf.evaluate(() => { const vis = id => { const e = document.getElementById(id); return !!e && !!e.offsetParent; }; return { h1: document.querySelector('#mRoot .nhead').textContent.replace(/\s+/g, ' ').trim(), old: vis('tpHead') || vis('side') || vis('drop'), pick: vis('mPick'), cmd: vis('mCmd'), what: /What you can do/.test(document.getElementById('mEmpty').textContent) }; });
  ok(/Mark up a copy/.test(m0.h1) && !m0.old && m0.pick && !m0.cmd && m0.what, 'Nothing open: one calm title and one drop card: ' + m0.h1);

  await mf.setInputFiles('#pick', { name: 'theirpage.png', mimeType: 'image/png', buffer: big }); await T(2200);
  const m1 = await mf.evaluate(() => {
    const vis = id => { const e = document.getElementById(id); return !!e && !!e.offsetParent; }, box = id => document.getElementById(id).getBoundingClientRect();
    return { empty: vis('mEmpty'), chip: document.getElementById('mChip').textContent, btns: [...document.querySelectorAll('#mCmd > .nbtn')].map(b => b.textContent.trim() + (b.disabled ? ' (off)' : '')), tools: [...document.querySelectorAll('#mBar .tn-tb')].map(b => b.dataset.tool + (b.classList.contains('on') ? '*' : '')), label: [...document.querySelectorAll('#mBar .tn-tb')].filter(b => b.querySelector('span').offsetParent).map(b => b.textContent.trim()),
      cols: document.querySelectorAll('#mBar .swatch').length, sizes: [...document.querySelectorAll('#mBar #sizes button')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')), above: box('mBar').bottom <= box('board').top + 2, oneRow: box('mBar').height < 70, tick: !!document.querySelector('#mBar #label') && document.getElementById('label').checked,
      del: document.getElementById('mBtnDel').disabled, whole: document.getElementById('mBtnClearArea').hidden, note: /separate copy/.test(document.querySelector('.tn-note').textContent), over: document.documentElement.scrollWidth > innerWidth + 2 };
  });
  ok(!m1.empty && /theirpage\.png/.test(m1.chip) && /900 × 600/.test(m1.chip) && m1.btns.join('|') === 'Open a different capture|Save as PNG|Save as PDF|Copy image', 'The file and its buttons on one line: ' + m1.btns.join(' · '));
  ok(m1.tools.join() === 'highlight*,rect,ellipse,arrow,text,move,area' && m1.label.join() === 'Highlight' && m1.cols === 6 && m1.sizes.join() === 'Thin,Medium*,Thick', 'One toolbar: seven tools (only the chosen one spelled out), six colours, three sizes');
  ok(m1.above && m1.oneRow && m1.tick && m1.del && m1.whole && m1.note && !m1.over, 'The toolbar sits in one row above the picture, with the label tick box and the note under the picture');

  // draw a box with the new toolbar, then undo and redo
  await mf.click('#mBar .tn-tb[data-tool="rect"]'); await mf.click('#mBar .swatch[title="Blue"]'); await mf.click('#mBar #sizes button[data-size="3"]'); await T(200);
  const ink = await (await mf.$('#ink')).boundingBox();
  await page.mouse.move(ink.x + ink.width * 0.3, ink.y + ink.height * 0.3); await page.mouse.down(); await page.mouse.move(ink.x + ink.width * 0.6, ink.y + ink.height * 0.6, { steps: 5 }); await page.mouse.up(); await T(300);
  const m2 = await mf.evaluate(() => ({ n: marks.length, m: marks[0] && [marks[0].type, marks[0].color, Math.round(marks[0].lw / Math.max(1, base.width / 1000))].join(), on: document.querySelector('#mBar .tn-tb.on').dataset.tool, old: document.querySelector('#tools [data-tool="rect"]').classList.contains('on') }));
  ok(m2.n === 1 && m2.m === 'rect,#2563eb,10' && m2.on === 'rect' && m2.old, 'Box, blue and Thick from the toolbar draw a thick blue box: ' + m2.m);
  await mf.click('#mBtnUndo'); await T(200); const u1 = await mf.evaluate(() => marks.length);
  await mf.click('#mBtnRedo'); await T(200); const u2 = await mf.evaluate(() => marks.length);
  await mf.click('#mBtnClearAll'); await T(200); const u3 = await mf.evaluate(() => marks.length);
  ok(u1 === 0 && u2 === 1 && u3 === 0, 'Undo, Redo and Clear all work from the toolbar');
  await mf.evaluate(() => { window.__saved = []; download = (blob, name) => { window.__saved.push(name); }; });   // eslint-disable-line no-global-assign
  await mf.click('#mBtnPng'); await mf.waitForFunction(() => window.__saved.length > 0, null, { timeout: 30000 }).catch(() => {});
  const ms = await mf.evaluate(() => window.__saved);
  ok(ms.length === 1 && /\.png$/.test(ms[0]), 'Save as PNG saves ' + ms.join());

  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'dark' })); await T(900);
  const md = await mf.evaluate(white('#mRoot'));
  ok(!md.length, 'Mark up, dark: nothing is left white ' + md.join(', '));
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'light' }));

  // ---- narrow, in their own tab
  const own = await ctx.newPage(); own.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await own.setViewportSize({ width: 1000, height: 800 });
  await own.goto(url('compare.html')); await own.waitForTimeout(1000);
  await own.setInputFiles('#slotA input', { name: 'original.png', mimeType: 'image/png', buffer: big }); await own.waitForTimeout(1200);
  await own.setInputFiles('#slotB input', { name: 'copy.png', mimeType: 'image/png', buffer: small }); await own.waitForTimeout(1800);
  const n1 = await own.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth + 2, stack: document.getElementById('cView').getBoundingClientRect().bottom <= document.getElementById('cRes').getBoundingClientRect().top + 2 }));
  ok(!n1.over && n1.stack, 'Compare at 1000 px wide: the picture stacks above the result and nothing scrolls sideways');
  await own.goto(url('markup.html')); await own.waitForTimeout(1000);
  await own.setInputFiles('#pick', { name: 'theirpage.png', mimeType: 'image/png', buffer: big }); await own.waitForTimeout(1800);
  ok(!(await own.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)), 'Mark up at 1000 px wide: the toolbar wraps and nothing scrolls sideways');

  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
