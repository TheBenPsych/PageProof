// The calm look, step 10: Home. Number-first tiles, no Start row, jobs and Most copied photos on
// one level, the Clients board, chips for clients and sites, the folded "While you were away"
// line, the waiting-for-a-capture warning, and the photo panel from a most copied photo.
const { start } = require('./h.js'); const { seed } = require('./seed.js');
process.env.NP = process.env.NP || '2000'; process.env.NC = process.env.NC || '30';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(1200);
  await seed(page);
  // The seed has Stolen copies waiting for a capture. One copy answered today, 5 hours away from Home.
  await page.evaluate(async () => {
    const c = (await FC.DB.all('copies')).find(x => !x.status || x.status === 'new');
    c.status = 'licensed'; c.answered = new Date().toISOString();
    // Two photos that were copied more than once (the seed has one copy per photo).
    const nw = (await FC.DB.all('copies')).filter(x => x.status === 'new' && x.id !== c.id).slice(0, 5);
    nw.forEach((x, i) => { x.photo = i < 3 ? nw[0].photo : nw[3].photo; });
    await FC.DB.putMany('copies', [c, ...nw]); FC.touch('copies');
    await chrome.storage.local.set({ ppTheme: 'light', ppLastHome: Date.now() - 5 * 3600000, ppSince: null, ppHomeSum: null });
  });
  await page.goto(url('app.html#home')); await page.waitForSelector('#mostCopied .toprow', { timeout: 60000 }); await page.waitForTimeout(2500);
  const T = async sel => ((await page.locator(sel).first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();

  const tiles = await page.$$eval('.hnew .htile', t => t.map(x => ({ first: (x.querySelector('.hn') || {}).textContent || '', firstEl: x.querySelector('.hn') && x.querySelector('.hl') && (x.querySelector('.hn').compareDocumentPosition(x.querySelector('.hl')) & 4) ? 'hn' : '', txt: x.textContent.replace(/\s+/g, ' ').trim(), icon: !!x.querySelector('.hi, .ki') })));
  ok(tiles.length === 4 && tiles.every(t => /hn/.test(t.firstEl || '') && /^[\d,.…%]+$/.test(t.first.trim())), 'four tiles, each starts with its number: ' + tiles.map(t => t.first.trim()).join(' | '));
  ok(/answered today/.test(tiles[0].txt), 'the first tile says how many were answered today: ' + tiles[0].txt.slice(0, 80));
  ok(/Oldest has waited \d+ days?/.test(tiles[1].txt), 'the capture tile says how long the oldest has waited: ' + tiles[1].txt.slice(0, 80));
  ok(/Every photo searched once/.test(tiles[3].txt) && !!(await page.$('#homeFirstTile svg')), 'the last tile is Every photo searched once, with its ring');
  ok(!(await page.$('.hstart, #homeStart, #homeFirst, #homeByClient')), 'the Start row, the old searched-once card and the by-client list are gone');
  ok(!/Keep searching is running/.test(await T('#homeJobs')), 'no "Keep searching is running" line when all is well');

  const lv = await page.evaluate(() => { const a = document.querySelector('.hlevel .hcol'), b = document.querySelector('#mostCopied'); if (!a || !b) return null; const ra = a.getBoundingClientRect(), rb = (b.closest('.hcol') || b).getBoundingClientRect(); return { top: Math.abs(ra.top - rb.top), side: rb.left >= ra.right - 1 }; });
  ok(lv && lv.top < 3 && lv.side, 'What needs you and Most copied photos start on the same level, side by side');
  const cap = await T('#jobCapture');
  ok(/need[s]? a capture/.test(cap) && /The oldest has waited \d+ days\./.test(cap) && await page.locator('#jobCapture.lvl-bad[role=alert]').count() === 1 && !/\d{4} stolen/.test(cap), 'Stolen copies waiting 3 days or more for a capture are a red warning: ' + cap.slice(0, 110));
  ok(await page.locator('#homeJobs .hchips .hchip').count() > 0, 'clients and sites are shown as chips');
  const chipOver = await page.$$eval('#homeJobs .hchips', l => l.every(x => x.querySelectorAll('.hchip').length <= 7));
  ok(chipOver, 'a line never has more than a handful of chips (the rest is "+N more")');

  // While you were away: folded, Show opens it, OK puts it away.
  const s1 = await T('#jobSince');
  ok(/While you were away/.test(s1) && /\d+ things? happened since/.test(s1) && !(await page.$('#jobSince .hsince')), 'While you were away is one folded line: ' + s1.slice(0, 90));
  await page.click('#jobSince [data-act="sinceshow"]'); await page.waitForSelector('#jobSince .hsince a');
  ok(await page.locator('#jobSince .hsince a').count() > 0 && /Hide/.test(await T('#jobSince [data-act="sinceshow"]')), 'Show opens the list and turns into Hide');
  await page.click('#jobSince [data-act="sinceshow"]'); await page.waitForTimeout(900);
  ok(!(await page.$('#jobSince .hsince')), 'Hide folds it again');
  await page.click('#jobSince [data-act="sinceok"]'); await page.waitForTimeout(1500);
  ok(!(await page.$('#jobSince')), 'OK puts it away');

  // Clients board.
  const bd = await page.evaluate(() => { const b = document.getElementById('hBoard'); return b && { n: b.querySelectorAll('.hbc').length, head: b.querySelector('.hch').textContent.replace(/\s+/g, ' '), links: [...b.querySelectorAll('a.hbc')].every(a => /^#/.test(a.getAttribute('href') || '')) }; });
  ok(bd && bd.n > 0 && bd.n <= 31 && /Clients/.test(bd.head) && /being searched/.test(bd.head), 'the Clients board shows each client being searched (' + (bd && bd.n) + '): ' + (bd && bd.head.trim().slice(0, 70)));

  // Most copied photos open a panel.
  const rows = await page.$$eval('#mostCopied .toprow', r => r.map(x => x.tagName + ':' + x.dataset.act));
  ok(rows.length > 0 && rows.every(x => x === 'BUTTON:homephoto'), 'each most copied photo is a button (' + rows.length + ')');
  await page.click('#mostCopied .toprow'); await page.waitForSelector('#hPhoto');
  const pn = await page.evaluate(() => { const p = document.getElementById('hPhoto'); return { nums: p.querySelectorAll('.hpnums > *').length, list: p.querySelectorAll('.hplist > *').length, txt: p.textContent.replace(/\s+/g, ' ').slice(0, 160), sel: document.querySelectorAll('#mostCopied .toprow.hsel').length, right: Math.round(document.documentElement.clientWidth - p.getBoundingClientRect().right) }; });
  ok(pn.nums === 4 && pn.list > 0 && pn.list <= 5 && pn.sel === 1 && pn.right <= 1, 'the photo panel opens on the right with four numbers and its newest copies: ' + [pn.nums, pn.list, pn.sel, pn.right].join(' ') + pn.txt.slice(0, 90));
  await page.keyboard.press('Escape'); await page.waitForTimeout(900);
  ok(!(await page.$('#hPhoto')), 'Escape closes the panel');
  await page.click('#mostCopied .toprow'); await page.waitForSelector('#hPhoto');
  await page.click('#hPhoto .hx'); await page.waitForTimeout(900);
  ok(!(await page.$('#hPhoto')), 'the ✕ closes it too');
  await page.click('#mostCopied .toprow'); await page.waitForSelector('#hPhoto');
  await page.mouse.click(300, 600); await page.waitForTimeout(900);
  ok(!(await page.$('#hPhoto')), 'and so does a click beside it');

  // 1000 px wide: nothing sticks out, the two columns stack.
  await page.setViewportSize({ width: 1000, height: 900 }); await page.waitForTimeout(700);
  const nar = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, wide: [...document.querySelectorAll('.hnew *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).length }));
  ok(nar.over <= 0 && nar.wide === 0, `at 1000 px wide nothing sticks out (${nar.over}, ${nar.wide})`);

  // Dark.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'dark' })); await page.reload(); await page.waitForSelector('#mostCopied .toprow', { timeout: 60000 });
  await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
  const d = await page.evaluate(() => ({ card: getComputedStyle(document.querySelector('.hnew .htile')).backgroundColor, ink: getComputedStyle(document.querySelector('.hnew .htile .hn')).color }));
  ok(d.card === 'rgb(43, 43, 43)' && +d.ink.match(/\d+/)[0] > 220, `Dark: grey tiles and light numbers (${d.card}, ${d.ink})`);
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
