// The calm look, step 17 (part 4): Tools › Convert files, with Open odd files as its second tab.
// The calm title, two tabs with Add more files and Start over on their line, a calm page while
// nothing is open, and the column on the right as numbered steps. Converting is unchanged.
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
  const pics = (await page.evaluate(async () => { const out = []; for (const col of ['#2f5f8f', '#8f2f5f']) { const c = new OffscreenCanvas(640, 420), g = c.getContext('2d'); g.fillStyle = col; g.fillRect(0, 0, 640, 420); g.fillStyle = '#f2c14e'; g.fillRect(120, 90, 200, 160); out.push([...new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer())]); } return out; })).map(a => Buffer.from(a));
  const files = [{ name: 'one.png', mimeType: 'image/png', buffer: pics[0] }, { name: 'two.png', mimeType: 'image/png', buffer: pics[1] }];
  const state = () => { const vis = id => { const e = document.getElementById(id); return !!e && !!e.offsetParent; }; return { h1: document.querySelector('#fTop .nhead').textContent.replace(/\s+/g, ' ').trim(), tabs: [...document.querySelectorAll('#fTop .utabs button')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')), old: vis('tpHead') || vis('switchMode'), add: vis('fAdd'), start: vis('fStart'), empty: vis('fEmpty'), pick: vis('fPick'), what: (document.querySelector('#fEmpty .tn-what .kh2') || {}).textContent || '', main: vis('fMain'), side: vis('side'), over: document.documentElement.scrollWidth > innerWidth + 2 }; };

  // ---- nothing open yet
  await page.goto(url('app.html#files')); await T(2500);
  const fr = page.frames().find(f => /convert\.html/.test(f.url()));
  ok(!!fr, 'Convert files opens inside PageProof');
  const e0 = await fr.evaluate(state);
  ok(/Convert files/.test(e0.h1) && !e0.old && e0.tabs.join('|') === 'Convert files*|Open odd files', 'One calm title and two tabs: ' + e0.tabs.join(' · '));
  ok(e0.empty && e0.pick && e0.what === 'What Convert can do' && !e0.main && !e0.side && !e0.add && !e0.start && !e0.over, 'Nothing open: one drop card with Add files and what Convert can do, no empty column on the right');

  // ---- the Open odd files tab
  await fr.click('#fTabOpen'); await T(500);
  const e1 = await fr.evaluate(state);
  ok(e1.tabs.join('|') === 'Convert files|Open odd files*' && e1.what === 'What Open odd files can open' && /\?open=1$/.test(fr.url()), 'Open odd files is the second tab, with its own list of what it opens');
  await fr.click('#fTabConvert'); await T(500);

  // ---- two pictures
  await fr.setInputFiles('#pick', files); await T(2200);
  const s1 = await fr.evaluate(() => {
    const vis = id => { const e = document.getElementById(id); return !!e && !!e.offsetParent; }, box = id => document.getElementById(id).getBoundingClientRect();
    const steps = [...document.querySelectorAll('#side > section')].filter(x => x.offsetParent && x.id !== 'fOpens').map((x, i) => (/counter\(fstep\)/.test(getComputedStyle(x, '::before').content) ? i + 1 : '?') + ' ' + (x.querySelector('h3, .lab') || {}).textContent);
    return { empty: vis('fEmpty'), sum: document.getElementById('fSum').textContent, cards: document.querySelectorAll('#view .fc').length, add: vis('fAdd'), start: vis('fStart'), left: box('fMain').right <= box('side').left + 2, steps, tasks: [...document.querySelectorAll('#tasks .task b')].map(b => b.textContent), go: document.getElementById('go').textContent.replace(/^[^A-Za-z]+/, '').trim(), opens: vis('fOpens'), over: document.documentElement.scrollWidth > innerWidth + 2 };
  });
  ok(!s1.empty && /^2 pictures \d+ KB in all$/.test(s1.sum) && s1.cards === 2 && s1.add && s1.start, 'Two pictures in: "' + s1.sum + '", Add more files and Start over on the tab line');
  ok(s1.left && !s1.over && s1.steps.join('|') === '1 What do you want to do?|2 Turn them into|3 How to save them', 'The column on the right is three numbered steps: ' + s1.steps.join(' · '));
  ok(s1.tasks.join('|') === 'Change the file type|Make them smaller|Rotate, crop or resize|Put them in one PDF' && /Convert and save all 2/.test(s1.go) && !s1.opens, 'Step 1 lists the four jobs, the big button says: ' + s1.go);

  // converting still works
  await fr.evaluate(() => { window.__saved = []; download = async (blob, name) => { window.__saved.push(name); }; });   // eslint-disable-line no-global-assign
  await fr.click('#go'); await fr.waitForFunction(() => window.__saved.length >= 2 || document.querySelectorAll('#view .fc .res a[data-a=save]').length >= 2, null, { timeout: 60000 }).catch(() => {}); await T(500);
  const cv = await fr.evaluate(() => ({ saved: window.__saved, rows: [...document.querySelectorAll('#view .fc .res span:first-child')].map(x => x.textContent.trim()) }));
  ok(cv.rows.filter(r => /one\.jpg|two\.jpg/.test(r)).length === 2, 'Convert and save all turns both into JPG: ' + cv.rows.join(' | ').slice(0, 120));

  // another job renumbers the steps
  await fr.click('#tasks .task:nth-child(4)'); await T(700);
  const s2 = await fr.evaluate(() => [...document.querySelectorAll('#side > section')].filter(x => x.offsetParent && x.id !== 'fOpens').map((x, i) => (/counter\(fstep\)/.test(getComputedStyle(x, '::before').content) ? i + 1 : '?') + ' ' + (x.querySelector('h3, .lab') || {}).textContent));
  ok(s2.join('|') === '1 What do you want to do?|2 Name of the new PDF', 'Put them in one PDF has two steps: ' + s2.join(' · '));

  // the Open odd files tab with files in
  await fr.click('#fTabOpen'); await T(900);
  const s3 = await fr.evaluate(() => ({ tabs: [...document.querySelectorAll('#fTop .utabs button')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')), h3: document.querySelector('#taskBox h3').textContent, tasks: [...document.querySelectorAll('#tasks .task b')].map(b => b.textContent), opens: !!document.getElementById('fOpens').offsetParent, chips: document.querySelectorAll('#fOpens .ktag').length, list: document.querySelectorAll('#view .odd .li').length }));
  ok(s3.tabs[1] === 'Open odd files*' && s3.h3 === 'What you can do' && s3.tasks.join('|') === 'Open and look inside|Save as PDF' && s3.opens && s3.chips >= 10 && s3.list === 2, 'Open odd files keeps the files: What you can do, and the kinds of file it opens');

  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'dark' })); await T(2200);   // the job buttons fade to the new colour
  const dk = await fr.evaluate(() => { const lum = c => { const m = c.match(/[\d.]+/g).map(Number); return m.length > 3 && m[3] < 0.5 ? -1 : (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; }; return [...document.querySelectorAll('body *')].filter(e => e.offsetParent && !e.closest('img,canvas,input,textarea,.pane') && e.getBoundingClientRect().width > 30 && lum(getComputedStyle(e).backgroundColor) > 0.85).slice(0, 3).map(e => e.tagName + '.' + e.className + ' ' + getComputedStyle(e).backgroundColor); });
  ok(!dk.length, 'Dark: nothing is left white ' + dk.join(', '));
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'light' }));

  // Start over
  await fr.click('#fStart'); await T(600);
  const e2 = await fr.evaluate(state);
  ok(e2.empty && !e2.main && !e2.add && e2.what === 'What Open odd files can open', 'Start over goes back to the calm empty page of the tab you are on');

  // ---- narrow, in its own tab
  const own = await ctx.newPage(); own.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await own.setViewportSize({ width: 1000, height: 800 }); await own.goto(url('convert.html')); await own.waitForTimeout(1000);
  await own.setInputFiles('#pick', files); await own.waitForTimeout(2000);
  const nw = await own.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth + 2, stack: document.getElementById('fMain').getBoundingClientRect().bottom <= document.getElementById('side').getBoundingClientRect().top + 2 }));
  ok(!nw.over && nw.stack, 'At 1000 px wide the steps go under the files and nothing scrolls sideways');

  // ---- the Open odd files link still lands on its tab
  await page.goto(url('app.html#openfiles')); await T(2500);
  const of = page.frames().find(f => /convert\.html/.test(f.url()));
  const o1 = of ? await of.evaluate(state) : { tabs: [] };
  ok(o1.tabs.join('|') === 'Convert files|Open odd files*' && await page.evaluate(() => !!document.querySelector('#side .subs a.on[href="#files"]')), 'The Open odd files link opens Convert files on its second tab');

  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
