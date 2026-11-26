// The calm look, step 14: Evidence › All evidence. Captures / Evidence reports tabs, Pictures or
// List, the find box and quick filters, the "waiting for a capture" bar and filter (Needs a capture
// is gone), week and month groups, the details panel, grouping by case number, the reports tab,
// the footer, and the same waiting warning on Copies found › Not finished and on Home.
process.env.NP = process.env.NP || '2000'; process.env.NC = process.env.NC || '30';   // before seed.js is read
const fs = require('fs');
const { start } = require('./h.js'); const { seed } = require('./seed.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const { ctx, url } = await start();
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(1200);
  await seed(page);
  // 24 captures over a month (12 of Stolen copies, 12 by hand), 4 without a pack, some without a
  // case number or time stamps, reports for the saved ones, and Stolen copies with no capture.
  const S = await page.evaluate(async () => {
    await chrome.storage.local.set({ ppTheme: 'light' }); await FC.meta.set('rawRead', 1);
    const cs = (await FC.allCopies()).filter(c => c.status !== 'removed').slice(0, 14), now = Date.now(), log = [], reps = [];
    for (let i = 0; i < 14; i++) { const c = cs[i]; c.status = 'stolen'; c.answered = new Date(now - (i + 1) * 26 * 3600e3).toISOString(); }
    await FC.DB.putMany('copies', cs);
    for (let i = 0; i < 24; i++) {
      const c = cs[i % 12], own = i < 12, t = new Date(now - i * 31 * 3600e3 - 3600e3).toISOString();
      const saved = i % 6 !== 4, caseRef = !saved || i % 5 === 3 ? '' : 'CASE-' + (100 + (i % 4));
      log.push({ id: 'cap-' + i, captureId: 'PP-T' + String(1000 + i), time: t, url: own ? c.url : 'https://other-site-' + i + '.example/page/' + i, title: own ? (c.title || 'Story ' + i) : 'A page captured by hand ' + i,
        saves: saved ? [{ at: t, file: (caseRef || 'nocase') + '_site_' + i + '.zip', sha256: 'ab12cd34ef56'.repeat(5) + i, caseRef, collector: 'Sam Tester', timestamps: i % 7 === 2 ? '' : 'FreeTSA (ok); DigiCert (ok)', notes: i === 0 ? 'First look' : '' }] : [] });
      if (own && saved) reps.push({ id: 'PPM-' + String(5000 + i), at: t, site: c.site, url: c.url, caseNo: caseRef, photo: 'IMG_' + i + '.jpg', client: c.client });
    }
    await chrome.storage.local.set({ log: log.reverse(), fcReports: reps.reverse() });
    const up = (await needsCapture()).up;
    const n = { all: 24, nosave: log.filter(x => !x.saves.length).length, nocase: log.filter(x => x.saves.length && !x.saves[0].caseRef).length, nots: log.filter(x => x.saves.length && !x.saves[0].timestamps).length, notsOnly: log.filter(x => x.saves.length && x.saves[0].caseRef && !x.saves[0].timestamps).length };
    return { n, reps: reps.length, waiting: up.map(c => c.id), days: ppDaysSince(up[0].answered || up[0].firstSeen), client0: cs[0].client, copy0: cs[0].id, site0: cs[0].site };
  });
  const T = (ms = 500) => page.waitForTimeout(ms);
  await page.goto(url('app.html#library')); await page.waitForSelector('#capGrid .evc', { timeout: 60000 });

  // ---- menu + top
  const top = await page.evaluate(() => ({ h1: document.querySelector('.head h1').textContent.replace(/\s+/g, ' ').trim(), subs: [...document.querySelectorAll('.subs a')].map(a => a.textContent.trim()), badge: !![...document.querySelectorAll('#side .nav')].find(n => /Evidence/.test(n.textContent)).querySelector('.pill-n'), tabs: [...document.querySelectorAll('#evCtl .utabs button')].map(b => b.textContent.replace(/\s+/g, ' ').trim()), headBtns: document.querySelectorAll('.head .headact .btn').length, view: [...document.querySelectorAll('.evview button')].map(b => b.textContent.trim() + (b.classList.contains('on') ? '*' : '')) }));
  ok(/All evidence/.test(top.h1) && !top.subs.includes('Needs a capture') && !top.subs.includes('Verify a pack') && top.subs[0] === 'All evidence' && top.subs.includes('Weekly summary') && !top.badge, 'Evidence menu: Needs a capture and Verify a pack are gone, and so is the number on Evidence: ' + top.subs.join(' · '));
  ok(top.tabs.join('|') === `Captures 24|Evidence reports ${S.reps}` && top.view.join('|') === 'Pictures*|List' && !top.headBtns, 'Two tabs with their counts, a Pictures / List switch, no buttons in the page header');

  // ---- waiting bar (A1: the waiting warning stays)
  const bar = await page.evaluate(() => { const b = document.querySelector('#evWaitBar'); return b ? { t: b.textContent.replace(/\s+/g, ' '), v: b.querySelector('[data-act="capturecopy"]').dataset.v, nf: b.querySelector('a[href^="#found?filter="]').getAttribute('href') } : null; });
  ok(bar && bar.t.includes(`${S.waiting.length} Stolen copies are waiting for a capture`) && bar.t.includes(`The oldest has waited ${S.days} days`) && bar.v === S.waiting[0] && bar.nf === '#found?filter=Not%20finished', 'A bar says how many Stolen copies wait for a capture and how long the oldest has waited, with Capture the oldest: ' + (bar && bar.t.slice(0, 90)));

  // ---- cards
  const c = await page.evaluate(() => ({ n: document.querySelectorAll('#capGrid .evc').length, groups: [...document.querySelectorAll('#capGrid .evgl')].map(g => g.textContent.replace(/\s+/g, ' ').trim()), cols: getComputedStyle(document.querySelector('.evgrid')).gridTemplateColumns.split(' ').length,
    first: (() => { const e = document.querySelector('.evc[data-id="cap-0"]'); return { badge: e.querySelector('.evb').textContent.trim(), cls: e.querySelector('.evb').className, case: (e.querySelector('.evcase') || {}).textContent, client: (e.querySelector('.evcl') || {}).textContent, when: e.querySelector('.evwhen').textContent }; })(),
    todo: (() => { const e = document.querySelector('.evc.todo'); return { badge: e.querySelector('.evb').textContent.trim(), btn: (e.querySelector('.evfix [data-act="opencap"]') || {}).textContent, yellow: getComputedStyle(e.querySelector('.evb')).backgroundColor }; })(),
    nocase: [...document.querySelectorAll('.evc .evb')].filter(b => /No case number/.test(b.textContent)).length, nots: [...document.querySelectorAll('.evc .evb')].filter(b => /No timestamps/.test(b.textContent)).length }));
  ok(c.n === 24 && c.groups[0].startsWith('This week') && c.groups.length >= 3 && c.cols === 5, `Cards are grouped by week and month, five across at 1080p: ${c.groups.join(' · ')}`);
  ok(c.first.badge === 'Pack saved' && /ok/.test(c.first.cls) && c.first.case === 'CASE-100' && c.first.client.includes(S.client0) && /Today/.test(c.first.when), 'A finished card shows Pack saved, its case number, and the client from the Stolen copy of that page: ' + JSON.stringify(c.first));
  ok(c.todo.badge === 'Pack not saved' && /Save the pack/.test(c.todo.btn || '') && c.todo.yellow === 'rgb(252, 225, 0)' && c.nocase === S.n.nocase && c.nots === S.n.notsOnly, 'Unfinished cards have a yellow badge (Pack not saved with a Save the pack button, No case number, No timestamps): ' + JSON.stringify(c.todo) + ' ' + c.nocase + ' ' + c.nots);

  // ---- quick filters + find + client
  const fl = await page.evaluate(() => [...document.querySelectorAll('.evfil button')].map(b => b.textContent.replace(/\s+/g, ' ').trim()));
  ok(fl.join('|') === `All 24|Pack not saved ${S.n.nosave}|No case number ${S.n.nocase}|No timestamps ${S.n.nots}|Waiting for a capture ${S.waiting.length}`, 'Quick filters with their counts: ' + fl.join(' | '));
  await page.click('.evfil [data-v="nosave"]'); await T();
  ok(await page.evaluate(() => document.querySelectorAll('.evc').length) === S.n.nosave && await page.evaluate(() => [...document.querySelectorAll('.evc .evb')].every(b => /Pack not saved/.test(b.textContent))), 'Pack not saved shows only those');
  await page.goto(url('app.html#library?filter=No%20case%20number')); await page.waitForSelector('.evc', { timeout: 30000 }); await T();
  const lk = await page.evaluate(() => ({ on: document.querySelector('.evfil .on').dataset.v, n: document.querySelectorAll('.evc').length, hash: location.hash }));
  ok(lk.on === 'nocase' && lk.n === S.n.nocase && lk.hash === '#library', 'A link from another page can open a filter by its name (#library?filter=No case number)');
  await page.click('.evfil [data-v="all"]'); await T();
  await page.fill('#libq', 'pp-t1005'); await T(900);
  let q = await page.evaluate(() => ({ ids: [...document.querySelectorAll('.evc')].map(e => e.dataset.id), focus: document.activeElement && document.activeElement.id }));
  ok(q.ids.join() === 'cap-5' && q.focus === 'libq', 'The find box finds a capture by its capture ID and keeps the cursor');
  await page.fill('#libq', 'zzz-none'); await T(900);
  ok(await page.evaluate(() => /Nothing matches/.test((document.querySelector('#evNone') || {}).textContent || '')), 'Nothing found says so');
  await page.click('#evNone [data-act="evclear"]'); await T();
  await page.selectOption('select[data-act="evclient"]', S.client0); await T();
  ok(await page.evaluate(n => { const cs = [...document.querySelectorAll('.evc .evcl')]; return cs.length > 0 && cs.length === document.querySelectorAll('.evc').length && cs.every(x => x.textContent.includes(n)); }, S.client0), 'The client pick shows only that client\'s captures');
  await page.selectOption('select[data-act="evclient"]', ''); await T();

  // ---- list
  await page.click('[data-act="libview"][data-v="list"]'); await T(800);
  const l = await page.evaluate(() => ({ head: [...document.querySelectorAll('#evList .evh span')].map(s => s.textContent).filter(Boolean), rows: document.querySelectorAll('#evList .evr:not(.evh)').length, groups: document.querySelectorAll('#evList .evgl').length, r0: document.querySelector('#evList .evr[data-id="cap-0"]').textContent.replace(/\s+/g, ' '), r4: document.querySelector('#evList .evr[data-id="cap-4"]').textContent.replace(/\s+/g, ' '), grid: !!document.getElementById('capGrid') }));
  ok(l.head.join('|') === 'Captured|Site and page|Client|Case|Evidence pack|Trusted time|Capture ID' && l.rows === 24 && l.groups >= 3 && !l.grid, 'List is a table with pack and trusted time columns: ' + l.head.join(' · '));
  ok(/Saved/.test(l.r0) && /2 stamps/.test(l.r0) && /PP-T1000/.test(l.r0) && /Not saved/.test(l.r4), 'A row shows Saved with the date, the stamps and the capture ID; an unfinished one says Not saved');
  await page.click('[data-act="libview"][data-v="cards"]'); await T(800);

  // ---- panel
  await page.click('.evc[data-id="cap-0"] .evtitle'); await page.waitForSelector('#evPanel');
  const p = await page.evaluate(() => { const a = document.querySelector('#evPanel'); return { facts: a.querySelector('#evFacts').textContent.replace(/\s+/g, ' '), pack: a.querySelector('#evPack').textContent.replace(/\s+/g, ' '), copy: (a.querySelector('#evCopy') || {}).textContent || '', open: !!a.querySelector('.evpb [data-act="opencap"][data-v="cap-0"]'), their: (a.querySelector('.evpb a[target="_blank"]') || {}).href || '', foot: [...a.querySelectorAll('.cpfoot .btn')].map(b => b.textContent.trim()), verify: (a.querySelector('.cpfoot a[href="#verify"]') || {}).textContent, found: (a.querySelector('.cpfoot a[href^="#found?open="]') || { getAttribute: () => '' }).getAttribute('href'), sel: document.querySelectorAll('.evc.sel').length, body: document.body.classList.contains('cpopen') }; });
  ok(/CASE-100/.test(p.facts) && /by Sam Tester/.test(p.facts) && /PP-T1000/.test(p.facts) && /Fingerprint\s*ab12cd34ef56ab12…/.test(p.pack) && /2 stamps/.test(p.pack) && /FreeTSA, DigiCert/.test(p.pack) && /First look/.test(p.pack), 'Clicking a card opens its panel: case, who captured it, capture ID, the pack\'s fingerprint, time stamps and notes: ' + p.facts + ' || ' + p.pack);
  ok(p.open && /^https?:/.test(p.their) && p.copy.includes(S.client0) && p.foot.join('|') === 'Open in Copies found|Check this pack|Save the pack again' && p.found === '#found?open=' + encodeURIComponent(S.copy0) && p.sel === 1 && p.body, 'The panel has Open the capture, Their page, the Stolen copy pair and three buttons: ' + p.foot.join(' · '));
  await page.click('#evPack [data-what="fingerprint"]'); await T();
  ok((await page.evaluate(() => navigator.clipboard.readText().catch(() => ''))).startsWith('ab12cd34ef56ab12cd34'), 'The copy button next to the fingerprint copies all of it');
  await page.keyboard.press('Escape'); await T();
  ok(!(await page.$('#evPanel')), 'Escape closes the panel');
  await page.click('.evc.todo .evtitle'); await page.waitForSelector('#evPanel');
  const p2 = await page.evaluate(() => ({ pack: document.querySelector('#evPack').textContent, foot: [...document.querySelectorAll('#evPanel .cpfoot .btn')].map(b => b.textContent.trim()) }));
  ok(/not saved yet/.test(p2.pack) && p2.foot.includes('Save the pack') && !p2.foot.includes('Check this pack'), 'An unsaved capture\'s panel says the pack is not saved yet and offers Save the pack');
  await page.evaluate(() => ACTS.evsel(state.evSel)); await T();

  // ---- waiting filter (what is left of Needs a capture)
  await page.click('#evWaitBar [data-act="evfilter"]'); await page.waitForSelector('#evWaiting .evwr');
  const w = await page.evaluate(() => ({ ids: [...document.querySelectorAll('#evWaiting .evwr')].map(r => r.dataset.id), solid: document.querySelectorAll('#evWaiting .btn.primary').length, ages: [...document.querySelectorAll('#evWaiting .evwd')].map(a => a.textContent), bar: !!document.querySelector('#evWaitBar'), foot: document.querySelector('#evWaiting .kfoot').textContent, sort: !!document.querySelector('select[data-act="evsort"]') }));
  ok(w.ids.join() === S.waiting.join() && w.solid === 1 && w.ages.every(a => /Waiting \d+ days?|Marked Stolen today/.test(a)) && !w.bar && /Not finished/.test(w.foot), 'Waiting for a capture lists them oldest first, each with how long it has waited, one solid Capture now');
  await page.click('#evWaiting .evwr [data-act="capdone"]'); await T(900);
  const w2 = await page.evaluate(async id => ({ there: !!document.querySelector(`.evwr[data-id="${CSS.escape(id)}"]`), n: document.querySelectorAll('#evWaiting .evwr').length, toast: (document.querySelector('.toast') || document.querySelector('#toast') || {}).textContent || '' }), S.waiting[0]);
  ok(!w2.there && w2.n === S.waiting.length - 1 && /waiting list/.test(w2.toast), 'Captured another way takes a copy off the waiting list: ' + w2.toast.trim().slice(0, 60));
  await page.goto(url('app.html#tocapture')); await T(2500);
  ok(await page.evaluate(() => location.hash === '#library' && !!document.querySelector('#evWaiting')), 'The old Needs a capture address opens All evidence on Waiting for a capture');
  await page.click('.evfil [data-v="all"]'); await T();

  // ---- group by case number
  await page.selectOption('select[data-act="evsort"]', 'case'); await T(800);
  const g = await page.evaluate(() => ({ cases: [...document.querySelectorAll('.evcase-g')].map(s => [s.dataset.case, s.classList.contains('open'), s.querySelector('.evgh').textContent.replace(/\s+/g, ' ').trim()]), rep: document.querySelectorAll('.evcase-g.open .evc.rep').length, last: [...document.querySelectorAll('.evcase-g')].pop().querySelector('.evcase').textContent }));
  ok(g.cases.length === 5 && g.cases[0][0] === 'CASE-100' && g.cases.slice(0, 3).every(x => x[1]) && !g.cases[3][1] && /captures? · \d+ reports?/.test(g.cases[0][2]) && g.rep > 0 && g.last === 'No case number', 'Group: Case number puts captures and reports of one case together; No case number comes last: ' + g.cases.map(x => x[0] || 'none').join(', '));
  await page.click('.evcase-g:not(.open) .evgh'); await T();
  ok(await page.evaluate(() => document.querySelectorAll('.evcase-g.open').length) === 4, 'Clicking a case line opens it');
  await page.selectOption('select[data-act="evsort"]', 'old'); await T(800);
  ok(await page.evaluate(() => document.querySelector('.evc').dataset.id) === 'cap-23', 'Oldest first turns the order round');
  await page.selectOption('select[data-act="evsort"]', 'new'); await T();

  // ---- download list
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('#evCtl [data-act="libcsv"]')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8').split('\r\n');
  ok(dl.suggestedFilename() === 'PageProof_evidence_list.csv' && /Capture ID/.test(csv[0]) && csv.length === 25, 'Download list saves every capture as a CSV');

  // ---- reports tab
  await page.click('#evCtl .utabs [data-v="reports"]'); await page.waitForSelector('#evReports .evrr');
  const r = await page.evaluate(() => ({ head: [...document.querySelectorAll('#evReports .evh span')].map(s => s.textContent).filter(Boolean), rows: document.querySelectorAll('#evReports .evrr:not(.evh)').length, r0: (() => { const e = document.querySelector('#evReports .evrr:not(.evh)'); return { pair: e.querySelectorAll('.evpair img').length, id: e.querySelector('.evmid .mono').textContent, copyBtn: !!e.querySelector('.evmid [data-act="evcopy"]'), btns: [...e.querySelectorAll('.cnb .btn')].map(b => b.textContent.trim()), txt: e.textContent }; })(), view: !!document.querySelector('.evview'), filters: !!document.querySelector('.evfil'), bar: !!document.querySelector('#evWaitBar'), ph: document.querySelector('#libq').placeholder }));
  ok(r.head.join('|') === 'Client photo · their copy|Made|Site and page|Client and photo|Case|Match ID' && r.rows === S.reps && !r.view && !r.filters && !r.bar && /Match ID/.test(r.ph), 'Evidence reports is its own tab with one line per report: ' + r.rows);
  ok(r.r0.pair === 2 && r.r0.id === 'PPM-5000' && r.r0.copyBtn && r.r0.btns.join('|') === 'Their page|The copy' && r.r0.txt.includes(S.client0), 'A report shows the photo pair, the client, the Match ID with a copy button, Their page and The copy');
  await page.click('#evReports .evmid [data-act="evcopy"]'); await T();
  ok(await page.evaluate(() => navigator.clipboard.readText().catch(() => '')) === 'PPM-5000', 'The Match ID copies with one click');
  const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('#evCtl [data-act="evrepcsv"]')]);
  ok(dl2.suggestedFilename() === 'PageProof_evidence_reports.csv', 'Download list on this tab saves the reports');
  await page.goto(url('app.html#library?tab=reports')); await page.waitForSelector('#evReports', { timeout: 30000 });
  ok(true, 'A link can open the Evidence reports tab');
  const foot = await page.evaluate(() => ({ t: document.querySelector('#evFoot').textContent.replace(/\s+/g, ' '), btn: !!document.querySelector('#evFoot [data-act="evdownloads"]') }));
  ok(/kept in this browser/.test(foot.t) && /Downloads folder/.test(foot.t) && foot.btn, 'One footer line says where things are kept, with Show in Downloads');
  await page.click('#evCtl .utabs [data-v="captures"]'); await T();

  // ---- Not finished tab + Home keep the waiting warning (A1)
  await page.goto(url('app.html#found?filter=Not%20finished')); await page.waitForSelector('#nfWait', { timeout: 60000 });
  const nf = await page.evaluate(() => { const b = document.querySelector('#nfWait'); return { t: b.textContent.replace(/\s+/g, ' '), cap: !!b.querySelector('[data-act="capturecopy"]'), see: b.querySelector('a').getAttribute('href'), tab: document.querySelector('.ansbar .on').textContent }; });
  ok(/waiting for a capture/.test(nf.t) && /The oldest has waited \d+ days/.test(nf.t) && nf.cap && /^#library\?filter=Waiting/.test(nf.see) && /Not finished/.test(nf.tab), 'Copies found › Not finished shows the waiting warning with Capture the oldest: ' + nf.t.slice(0, 80));
  await page.click('.ansbar [data-v="New"]'); await T(900);
  ok(!(await page.$('#nfWait')), 'The warning is only on the Not finished tab');
  await page.goto(url('app.html#home')); await page.waitForSelector('#jobCapture', { timeout: 60000 });
  const hm = await page.evaluate(() => ({ t: document.querySelector('#jobCapture').textContent.replace(/\s+/g, ' '), href: document.querySelector('#jobCapture a.btn').getAttribute('href'), old: !!document.querySelector('a[href="#tocapture"]') }));
  ok(/need a capture|needs a capture/.test(hm.t) && /The oldest has waited \d+ days/.test(hm.t) && hm.href === '#found?filter=Not%20finished' && !hm.old, 'Home still warns how long the oldest has waited, and its button opens Not finished');

  // ---- narrow, dark, empty
  await page.goto(url('app.html#library')); await page.waitForSelector('#capGrid .evc', { timeout: 60000 });
  await page.setViewportSize({ width: 1280, height: 800 }); await T();
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'At 1280 wide nothing runs off the side');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'dark' })); await page.reload(); await page.waitForSelector('#capGrid .evc', { timeout: 60000 }); await T();
  const d = await page.evaluate(() => ({ card: getComputedStyle(document.querySelector('.evc')).backgroundColor, ink: getComputedStyle(document.querySelector('.evs b')).color }));
  ok(d.card === 'rgb(43, 43, 43)' && +d.ink.match(/\d+/)[0] > 220, `Dark: grey cards, light words (${d.card}, ${d.ink})`);
  await page.evaluate(async () => { await chrome.storage.local.set({ ppTheme: 'light', log: [], fcReports: [] }); const cs = (await FC.allCopies()).filter(c => c.status === 'stolen'); for (const c of cs) c.packAt = new Date().toISOString(); await FC.DB.putMany('copies', cs); });
  await page.reload(); await page.waitForSelector('#evNone', { timeout: 60000 });
  const e = await page.evaluate(() => ({ t: document.querySelector('#evNone').textContent, bar: !!document.querySelector('#evWaitBar'), dis: document.querySelector('.evfil [data-v="waiting"]').disabled }));
  ok(/Nothing captured yet/.test(e.t) && !e.bar && e.dis, 'With nothing captured the page says so, and there is no waiting bar when nothing waits');
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
