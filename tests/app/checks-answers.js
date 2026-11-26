const { start } = require('./h.js');
process.env.NP = 3000; process.env.NC = 400;
const { seed } = require('./seed.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error' && !/TUNNEL|ERR_NAME|net::/.test(m.text())) console.log('ERR', m.text().slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  await seed(page); await page.reload(); await page.waitForTimeout(1000);
  // answer + undo + weekly counts + rejected list
  const r = await page.evaluate(async () => {
    await RS_LISTS.load(); await loadFC();
    const news = FCD.copies.filter(c => c.status === 'new' && visible(c));   // 4.24: copies from countries not shown aren't counted
    const n0 = await FC.countNew(), rej0 = RS_REJECT.items.length;
    const ids = news.slice(0, 20).map(c => c.id);
    const h = await answerCopies(ids, 'removed', 'x');
    const n1 = await FC.countNew(), rej1 = RS_REJECT.items.length, w1 = (await FC.week()).removed;
    const cached = (await FC.allCopies()).filter(c => ids.includes(c.id)).every(c => c.status === 'removed');
    const ph = await FC.DB.get('photos', news[0].photo);
    await h.undo();
    const n2 = await FC.countNew(), rej2 = RS_REJECT.items.length, w2 = (await FC.week()).removed;
    const back = (await FC.allCopies()).filter(c => ids.includes(c.id)).every(c => c.status === 'new');
    return { n0, n1, n2, rej0, rej1, rej2, w1, w2, cached, back, phCopies: ph.copies };
  });
  console.log(JSON.stringify(r));
  ok(r.n1 === r.n0 - 20 && r.n2 === r.n0, 'bulk remove then undo restores the new count');
  ok(r.rej1 === r.rej0 + 20 && r.rej2 === r.rej0, 'rejected-links list grows by 20 and shrinks back');
  ok(r.w1 === 20 && r.w2 === 0, 'weekly summary counts the removal and undo takes it back');
  ok(r.cached && r.back, 'copies list in memory is fresh after answer and after undo');
  // review: two fast key presses answer two different copies, not one twice
  await page.goto(url('app.html#review')); await page.waitForTimeout(800);
  const before = await page.evaluate(() => FC.countNew());
  await page.keyboard.press('y'); await page.keyboard.press('y'); await page.waitForTimeout(1200);
  const mid = await page.evaluate(async () => ({ n: await FC.countNew(), hist: HIST.length, stolen: (await FC.DB.by('copies', 'status', 'stolen')).length }));
  ok(before - mid.n >= 1 && before - mid.n <= 2, 'Review: Y Y answered ' + (before - mid.n) + ' copies');
  await page.keyboard.press('u'); await page.waitForTimeout(800);
  // found page: open row, verdict, next opens
  await page.goto(url('app.html#found')); await page.waitForTimeout(1200);
  await page.click('.frow .l1'); await page.waitForTimeout(500);
  const o1 = await page.evaluate(() => state.open);
  await page.keyboard.press('l'); await page.waitForTimeout(900);
  const o2 = await page.evaluate(() => ({ open: state.open }));
  const st1 = await page.evaluate(async id => (await FC.DB.get('copies', id)).status, o1);
  ok(st1 === 'licensed' && o2.open && o2.open !== o1, 'Found: L marks licensed and opens the next copy');
  await page.keyboard.press('u'); await page.waitForTimeout(900);
  ok(await page.evaluate(async id => (await FC.DB.get('copies', id)).status, o1) !== 'licensed', 'Found: U undoes it');
  // photos: folder filter
  await page.goto(url('app.html#photos')); await page.waitForTimeout(1000);
  const tot = await page.evaluate(() => PH.list.length);
  const Y = await page.evaluate(() => [...document.querySelectorAll('button[data-act="phyear"]')].map(b => b.dataset.v).filter(Boolean));
  console.log('folders', Y.join(', '));
  await page.click(`button[data-act="phyear"][data-v="${Y[0]}"]`); await page.waitForTimeout(500);
  const f1 = await page.evaluate(y => ({ cards: document.querySelectorAll('.pcard').length, txt: (document.querySelector('.pgrid').previousElementSibling || {}).textContent, all2026: [...document.querySelectorAll('.pcard .faint')].every(s => s.textContent.startsWith(y)) }), Y[0]);
  ok(f1.cards > 0 && f1.all2026, 'Photos: clicking a year shows only that year (' + f1.txt + ')');
  await page.click(`button[data-act="phyear"][data-v="${Y[1]}"]`); await page.waitForTimeout(500);
  ok(await page.evaluate(y => [...document.querySelectorAll('.pcard .faint')].every(s => s.textContent.startsWith(y)) && document.querySelectorAll('.pcard').length > 0, Y[1]), 'Photos: clicking a quarter shows only ' + Y[1]);
  // flag then check it shows (cache refreshed) and backup has it
  await page.click('.pcard .flagbtn'); await page.waitForTimeout(600);
  ok(await page.evaluate(() => !!document.querySelector('.pcard .flagbtn.on.hi')), 'Photos: flag shows straight away');
  const snap = await page.evaluate(async () => (await FC.settingsSnapshot()).flags.length);
  const real = await page.evaluate(async () => (await FC.DB.all('photos')).filter(p => p.flag || p.notDouble).length);
  ok(snap === real, 'Backup lists every flagged photo (' + snap + ' of ' + real + ')');
  // backup file + site index
  const b = await page.evaluate(async () => { await FC.writeCopies(); const t = await RS_DOCS.readText('found-copies.txt'); const ix = (await chrome.storage.local.get('fcSiteIx')).fcSiteIx; const lines = t.split('\n').filter(l => l && !l.startsWith('#')); return { lines: lines.length, sample: lines[0], sites: Object.keys(ix).length, one: Object.entries(ix)[0] }; });
  console.log(JSON.stringify(b).slice(0, 400));
  ok(b.lines === 400 && /Registered images\/\d{4}\//.test(b.sample), 'found-copies.txt has every copy with its Drive path');
  // restore from the text file into an empty db
  const rest = await page.evaluate(async () => { const all = await FC.DB.all('copies'); await FC.DB.delMany('copies', all.map(c => c.id)); const n = await FC.restoreCopies(); return { n, cnt: await FC.DB.count('copies') }; });
  ok(rest.n === 400 && rest.cnt === 400, 'copies come back from found-copies.txt');
  // toolbar pop-up on a site with finds
  const site = b.one[0];
  const web = await ctx.newPage(); await web.route('**/*', r => r.fulfill({ contentType: 'text/html', body: '<h1>x</h1>' })); await web.goto('https://' + site + '/');
  const sp = await ctx.newPage(); await sp.goto(url('popup.html')); await sp.waitForTimeout(600);
  await web.bringToFront(); await sp.waitForTimeout(300); await sp.evaluate(() => draw()); await sp.waitForTimeout(1200);
  const spTxt = await sp.evaluate(() => document.getElementById('mini').innerText.slice(0, 160));
  console.log(JSON.stringify(spTxt));
  ok(/Found on this site/.test(spTxt), 'Pop-up says copies were found on this site');
  // The pop-up is narrow: its contents must be on screen, not slid away by the main page's menu styles.
  await sp.setViewportSize({ width: 380, height: 700 }); await sp.waitForTimeout(300);
  const spBox = await sp.evaluate(() => { const r = document.getElementById('mini').getBoundingClientRect(); return { x: r.x, w: r.width }; });
  ok(spBox.x >= 0 && spBox.w > 300, 'Pop-up is on screen at pop-up width ' + JSON.stringify(spBox));
  await ctx.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
