// The calm look, step 16: Evidence › Weekly summary. A week picker and Save as PDF on top, six
// tiles compared with the week before, the last 8 weeks as a chart you can click, a table by
// client you can sort, first searches, evidence reports, clients not searched, and a PDF that
// shows the same things as the screen.
process.env.NP = process.env.NP || '2000'; process.env.NC = process.env.NC || '30';   // before seed.js is read
const { start } = require('./h.js'); const { seed } = require('./seed.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(1200);
  await seed(page);
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'light', fcReports: [] }));
  const T = (ms = 500) => page.waitForTimeout(ms);

  // ---- 8 weeks of counts, reports, finished clients
  const S = await page.evaluate(async () => {
    const DY = 864e5, now = Date.now(), k0 = FC.weekKey(), s0 = new Date(k0 + 'T00:00:00').getTime();
    const names = (await FC.DB.all('clients')).map(c => c.name), keys = [];
    const mk = (seed, n) => { const clients = {}; let S = 0, F = 0, St = 0; names.slice(0, n).forEach((nm, i) => { const s = 40 + ((i * 37 + seed * 13) % 300), f = 1 + (i * 7 + seed) % 23, st = f > 15 ? 1 + (i + seed) % 3 : 0; clients[nm] = { searched: s, found: f, stolen: st }; S += s; F += f; St += st; }); return { clients, S, F, St }; };
    const wk = [];
    for (let i = 0; i < 8; i++) {
      const c = mk(i + 1, Math.max(4, 22 - i * 2)), k = FC.weekKey(new Date(s0 - 7 * i * DY + DY)); keys.push(k); wk.push(c);
      await FC.meta.set('week:' + k, { searched: c.S, found: c.F, first: 2100 - i * 150, stolen: c.St, licensed: 18 - i, removed: 112 - i * 9, wentOffline: i === 3 ? 4 : 0, backOnline: i === 3 ? 2 : 0, clients: c.clients, offline: i === 3 ? [['gone-site.example', new Date(s0 - 20 * DY).toISOString()]] : [], back: i === 3 ? [['back-site.example', new Date(s0 - 20 * DY).toISOString()]] : [] });
    }
    const reps = []; for (let i = 0; i < 9; i++) reps.push({ site: 'copy-site-' + i + '.example', client: names[i], photo: 'photo_' + (100 + i) + '.jpg', caseNo: i % 3 === 1 ? '' : 'CASE-' + (200 + i), at: new Date(s0 + 60000 + i * 1000).toISOString() });
    for (let i = 0; i < 4; i++) reps.push({ site: 'old-site-' + i + '.example', client: names[i], photo: 'p' + i + '.jpg', caseNo: 'CASE-9' + i, at: new Date(s0 - (2 + i) * DY).toISOString() });
    await chrome.storage.local.set({ fcReports: reps });
    await FC.meta.set('firstNotes', [{ name: names[2], n: 1840, at: new Date(s0 + 2000).toISOString() }]);
    const top = Object.entries(wk[0].clients).sort((a, b) => b[1].found - a[1].found || a[0].localeCompare(b[0]));
    return { keys, n: wk.map(c => ({ S: c.S, F: c.F, St: c.St, n: Object.keys(c.clients).length })), names: names.length, top: top[0][0], topFound: top[0][1].found, fin: names[2], az: Object.keys(wk[0].clients).sort((a, b) => a.localeCompare(b))[0] };
  });
  await page.goto(url('app.html#weekly')); await page.waitForSelector('#wkTiles', { timeout: 60000 }); await T(800);

  // ---- top of the page
  const h = await page.evaluate(() => ({ h1: document.querySelector('.head h1').textContent.replace(/\s+/g, ' ').trim(), pick: document.querySelector('#wkPick').textContent.replace(/\s+/g, ' '), next: document.querySelector('.wk-lr[aria-label="Next week"]').disabled, btns: [...document.querySelectorAll('#wkCtl .btn')].map(b => b.textContent.trim()), paper: !!document.querySelector('.paper'), copy: /Copy as text/.test(document.body.textContent), menuHidden: document.querySelector('#wkMenu').hidden }));
  ok(/Weekly summary/.test(h.h1) && /This week so far/.test(h.pick) && /of 7 days/.test(h.pick) && h.next && h.menuHidden, 'The top line is a week picker: ' + h.pick.trim());
  ok(h.btns.join('|') === 'Save as PDF' && !h.copy && !h.paper, 'Save as PDF is the one button (no Copy as text), and the narrow paper sheet is gone');

  // ---- six tiles
  const t = await page.evaluate(() => [...document.querySelectorAll('#wkTiles .wk-t')].map(x => ({ n: x.querySelector('b').textContent, l: x.querySelector('.l').textContent, d: x.querySelector('.wk-d').textContent.trim(), cls: x.querySelector('.wk-d').className, one: getComputedStyle(document.querySelector('#wkTiles')).gridTemplateColumns.split(' ').length })));
  const pct = Math.round((S.n[0].F - S.n[1].F) / S.n[1].F * 100);
  ok(t.length === 6 && t[0].one === 6 && t.map(x => x.l).join('|') === 'Photos searched|New copies found|Marked stolen|Licensed|Removed|Evidence reports', 'Six tiles in one row at 1080p: ' + t.map(x => x.l).join(' · '));
  ok(t[0].n === S.n[0].S.toLocaleString() && t[1].n === String(S.n[0].F) && t[2].n === String(S.n[0].St) && t[5].n === '9' && t[1].d === Math.abs(pct) + '% vs all of last week' && t[1].cls.includes(pct > 0 ? 'up' : 'dn') && /125% vs all of last week/.test(t[5].d), `Each tile has its number and an up or down arrow against all of last week (${t[1].n} found, ${t[1].d})`);

  // ---- chart
  const c = await page.evaluate(() => ({ bars: [...document.querySelectorAll('#wkChart .wk-b8')].map(b => [b.dataset.v, b.querySelector('b').textContent, b.classList.contains('cur'), b.querySelector('.wk-l').textContent]), label: document.querySelector('#wkChart .wk-bars8').getAttribute('aria-label'), tall: document.querySelector('#wkChart .wk-b8.cur .wk-col').getBoundingClientRect().height, red: document.querySelector('#wkChart .wk-b8.cur .wk-col i.s').getBoundingClientRect().height }));
  ok(c.bars.length === 8 && c.bars[7][0] === S.keys[0] && c.bars[7][2] && c.bars[7][3] === 'This week' && c.bars[0][0] === S.keys[7] && c.bars.map(b => b[1]).join() === S.n.map(x => String(x.F)).reverse().join() && c.tall > 100 && c.red > 2 && /This week so far: \d+ found, \d+ stolen/.test(c.label), 'Last 8 weeks: one bar per week with stolen in red, this week marked, and a text version for screen readers');

  // ---- by client
  const b = await page.evaluate(() => ({ sub: document.querySelector('#wkClients .kh2').textContent.replace(/\s+/g, ' '), rows: [...document.querySelectorAll('#wkClients .wk-cr')].map(r => [r.querySelector('.wk-name b').textContent, r.querySelectorAll('.num')[1].textContent, r.getAttribute('href')]), more: document.querySelector('#wkClients .wk-more').textContent.trim(), none: document.querySelector('#wkNone').textContent.replace(/\s+/g, ' '), noneLink: document.querySelector('#wkNone a').getAttribute('href'), sort: document.querySelector('#wkClients .wk-ch .on').textContent.trim() }));
  ok(/22 clients searched this week/.test(b.sub) && b.rows.length === 14 && b.rows[0][0] === S.top && b.rows[0][1] === String(S.topFound) && b.sort === 'Copies found' && b.more === 'Show all 22 clients', 'By client: the top 14 by copies found, with Show all 22 clients');
  ok(b.rows[0][2] === '#found?client=' + encodeURIComponent(S.top), 'A client row opens that client in Copies found');
  ok(/Not searched this week: /.test(b.none) && /and \d+ more|Media/.test(b.none) && b.noneLink === '#keep?tab=clients', 'Clients that were not searched this week are named in one line: ' + b.none.slice(0, 90));
  await page.click('#wkClients .wk-more'); await T();
  ok(await page.evaluate(() => document.querySelectorAll('#wkClients .wk-cr').length) === 22, 'Show all lists every client');
  await page.click('#wkClients .wk-ch [data-v="name"]'); await T();
  const az = await page.evaluate(() => ({ first: document.querySelector('#wkClients .wk-cr .wk-name b').textContent, aria: document.querySelector('#wkClients .wk-ch [data-v="name"]').getAttribute('aria-sort') }));
  ok(az.first === S.az && az.aria === 'ascending', 'Click a column heading to sort by it (Client: A to Z)');
  await page.click('#wkClients .wk-ch [data-v="found"]'); await T();

  // ---- right column
  const r = await page.evaluate(() => ({ first: document.querySelector('#wkFirst').textContent.replace(/\s+/g, ' '), reps: [...document.querySelectorAll('#wkReports .wk-rr')].map(x => x.querySelector('.ktag').textContent), sub: document.querySelector('#wkReports .kh2').textContent.replace(/\s+/g, ' '), more: document.querySelector('#wkReports .kfoot').textContent, all: document.querySelector('#wkReports .kh2 a').getAttribute('href'), sites: !!document.querySelector('#wkSites') }));
  ok(/2,100 photos ?searched for the first time this week · 1,950 the week before/.test(r.first) && r.first.includes(S.fin) && /All 1,840 photos searched at least once/.test(r.first), 'Every photo searched once: first searches this week and the clients that finished');
  ok(/9 this week/.test(r.sub) && r.reps.length === 6 && r.reps.filter(x => x === 'No case number').length === 2 && r.reps.some(x => /^Case CASE-20\d$/.test(x)) && /And 3 more/.test(r.more) && r.all === '#library?tab=reports', 'Evidence reports: the newest six with a case tag or a yellow No case number, and a link to all of them');
  ok(!r.sites, 'Sites up and down stays away in a week with no such counts');

  // ---- the week picker
  await page.click('#wkPick'); await T(300);
  const m = await page.evaluate(() => ({ open: !document.querySelector('#wkMenu').hidden, rows: [...document.querySelectorAll('#wkMenu button')].map(x => x.textContent.replace(/\s+/g, ' ').trim()), on: document.querySelector('#wkMenu .on').textContent, exp: document.querySelector('#wkPick').getAttribute('aria-expanded') }));
  ok(m.open && m.exp === 'true' && m.rows.length === 8 && /^This week so far ?\d+ found$/.test(m.rows[0]) && /^Last week ?\d+ found$/.test(m.rows[1]) && /This week so far/.test(m.on), 'The picker opens a list of weeks with how many copies each found: ' + m.rows.slice(0, 3).join(' | '));
  await page.keyboard.press('Escape'); await T(200);
  ok(await page.evaluate(() => document.querySelector('#wkMenu').hidden), 'Esc closes the list');
  await page.click('#wkPick'); await page.click('#wkMenu button:nth-child(2)'); await page.waitForFunction(() => /Last week/.test(document.querySelector('#wkPick').textContent)); await T();
  const l = await page.evaluate(() => ({ d: document.querySelector('#wkTiles .wk-d.up, #wkTiles .wk-d.dn').textContent, next: document.querySelector('.wk-lr[aria-label="Next week"]').disabled, n: document.querySelectorAll('#wkTiles b')[1].textContent, sub: document.querySelector('#wkClients .kh2').textContent, cur: document.querySelector('#wkChart .wk-b8.cur').dataset.v, last: document.querySelector('#wkChart .wk-b8:last-child .wk-l').textContent }));
  ok(l.n === String(S.n[1].F) && /vs the week before/.test(l.d) && !l.next && /that week/.test(l.sub) && l.cur === S.keys[1], 'Last week shows its own numbers, compared with the week before it');
  // a bar opens its week; an old week with offline counts shows the Sites card
  await page.click(`#wkChart .wk-b8[data-v="${S.keys[3]}"]`); await page.waitForSelector('#wkSites', { timeout: 20000 });
  const o = await page.evaluate(() => document.querySelector('#wkSites').textContent.replace(/\s+/g, ' '));
  ok(/4 went offline/.test(o) && /gone-site\.example/.test(o) && /2 came back online/.test(o) && /back-site\.example/.test(o), 'Clicking a bar opens that week, and a week that has them shows Sites up and down');
  await page.click('.wk-lr[aria-label="Next week"]'); await T(600);
  ok(await page.evaluate(k => document.querySelector('#wkChart .wk-b8.cur').dataset.v === k, S.keys[2]), 'The arrows step one week at a time');

  // ---- the PDF shows the same things
  await page.evaluate(k => ACTS.wk(k), S.keys[0]); await T(700);
  const p = await page.evaluate(async () => {
    const D = await wkAll(FC.weekKey()), seen = [];
    const orig = OffscreenCanvasRenderingContext2D.prototype.fillText;
    OffscreenCanvasRenderingContext2D.prototype.fillText = function (t, ...a) { seen.push(String(t)); return orig.call(this, t, ...a); };
    const pages = await wkPdfPages(D, 'Sam Tester');
    OffscreenCanvasRenderingContext2D.prototype.fillText = orig;
    return { n: pages.length, w: pages[0].width, h: pages[0].height, text: seen.join(' | '), clients: Object.keys(D.w.clients).filter(c => seen.includes(c)).length };
  });
  ok(p.n === 2 && p.w === 1240 && p.h === 1754 && /PageProof weekly summary/.test(p.text) && /Made by Sam Tester/.test(p.text) && /Page 2 of 2/.test(p.text), 'Save as PDF makes A4 pages with a heading, who made it and page numbers');
  ok(['Photos searched', 'New copies found', 'Marked stolen', 'Licensed', 'Removed', 'Evidence reports', 'Last 8 weeks', 'By client', 'Clients not searched', 'Every photo searched once'].every(x => p.text.includes(x)) && p.clients === 22 && /copy-site-0\.example/.test(p.text) && /No case number/.test(p.text) && /% vs all of last week/.test(p.text), 'The PDF has what the screen has: six tiles with arrows, the 8 week chart, every client, clients not searched, first searches and the reports');
  const dl = page.waitForEvent('download', { timeout: 20000 }).catch(() => null);
  await page.click('[data-act="wkpdf"]'); const d = await dl;
  ok(d && d.suggestedFilename() === 'PageProof_weekly_' + S.keys[0] + '.pdf', 'It saves as ' + (d && d.suggestedFilename()));

  // ---- an empty week
  await page.evaluate(async k => { await FC.meta.set('week:' + k, null); await chrome.storage.local.set({ fcReports: [] }); await FC.meta.set('firstNotes', []); }, S.keys[0]);
  await page.reload(); await page.waitForSelector('#wkTiles', { timeout: 60000 }); await T();
  const e = await page.evaluate(() => ({ t: (document.querySelector('#wkNothing') || {}).textContent || '', rep: document.querySelector('#wkReports').textContent, none: !!document.querySelector('#wkNone'), n: document.querySelector('#wkTiles b').textContent }));
  ok(/Nothing was searched this week yet/.test(e.t) && /No evidence reports were made/.test(e.rep) && !e.none && e.n === '0', 'A week with nothing in it says so calmly');

  // ---- narrow + dark
  await page.evaluate(k => ACTS.wk(k), S.keys[1]); await T(700);
  await page.setViewportSize({ width: 1280, height: 800 }); await T();
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'At 1280 wide nothing runs off the side');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'dark' })); await page.reload(); await page.waitForSelector('#wkTiles', { timeout: 60000 }); await T();
  const dk = await page.evaluate(() => ({ card: getComputedStyle(document.querySelector('#wkChart')).backgroundColor, ink: getComputedStyle(document.querySelector('#wkChart .kh2')).color }));
  ok(dk.card === 'rgb(43, 43, 43)' && +dk.ink.match(/\d+/)[0] > 220, `Dark: grey cards, light words (${dk.card}, ${dk.ink})`);
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
