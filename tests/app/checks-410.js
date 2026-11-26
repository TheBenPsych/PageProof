// 4.10: every photo searched at least once. The never-searched share in the search line, client
// turns, the counts (done / never / can't), the client-finished note, and the pages that show it.
const { start } = require('./h.js');
process.env.NP = 300; process.env.NC = 50;
const { seed } = require('./seed.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  page.on('console', m => { if (m.type() === 'error' && !/TUNNEL|ERR_NAME|net::|Failed to load resource/.test(m.text())) console.log('ERR', m.text().slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  await seed(page); await page.reload(); await page.waitForTimeout(1500);

  // A small made-up library: A (★ priority) 3 never searched, B 4 never, C 1 never + 1 POOL +
  // 1 that would not open, plus 6 old photos (searched 400 days ago, so due) in the normal line.
  const r = await page.evaluate(async () => {
    for (const p of await FC.DB.all('photos')) await FC.DB.del('photos', p.id);
    for (const c of await FC.DB.all('clients')) await FC.DB.del('clients', c.name);
    await FC.DB.putMany('clients', [['A', true], ['B', false], ['C', false]].map(([name, priority]) => ({ name, searching: true, priority, photos: 0, licensed: [] })));
    const old = new Date(Date.now() - 400 * 864e5).toISOString();
    const mk = (client, i, extra) => ({ id: 'd:' + client + '/' + i + '.jpg', client, rel: client + '/' + i + '.jpg', name: client + '_' + i + '.jpg', year: 2019, quarter: 1, order: i, searches: 0, empty: 0, ...extra });
    const ps = [];
    for (let i = 0; i < 3; i++) ps.push(mk('A', i));
    for (let i = 0; i < 4; i++) ps.push(mk('B', i));
    ps.push(mk('C', 0));
    ps.push(mk('C', 1, { name: '10.29.26_POOL_Court.jpg' }));
    ps.push(mk('C', 2, { unreadable: 'x', skip: 'broken', lastSearched: old }));
    for (let i = 0; i < 6; i++) ps.push(mk('C', 10 + i, { searches: 1, lastSearched: old }));
    // Newest photos, searched 40 days ago: due again, and they sit above old never-searched
    // photos in the normal line (this is what used to keep those waiting forever).
    const now = new Date(), q = Math.floor(now.getMonth() / 3) + 1;
    for (let i = 0; i < 6; i++) ps.push(mk('C', 'R' + i, { year: now.getFullYear(), quarter: q, order: 1000 - i, searches: 1, lastSearched: new Date(Date.now() - 40 * 864e5).toISOString() }));
    await FC.DB.putMany('photos', ps);
    await chrome.storage.local.remove(['fcFirstTurn', 'fcFirst']);
    await FC.setKeep({ firstShare: 3, fiftyWhich: 'next' });
    FC.resetQueue(); await FC.buildQueue();
    const batch = (await FC.next(9)).map(p => p.id.replace('d:', ''));
    const firstOnly = (await FC.next(5, new Set(), { first: true })).map(p => p.id.replace('d:', ''));
    // One at a time (Keep searching): every third pick is a never-searched photo.
    const solo = [], skip = new Set();
    for (let i = 0; i < 6; i++) { const [p] = await FC.next(1, skip); skip.add(p.id); solo.push(p.id.replace('d:', '')); }
    // ⚑ High priority jumps the line.
    const hi = await FC.DB.get('photos', 'd:C/15.jpg'); hi.flag = 'hi'; await FC.DB.put('photos', hi);
    FC.resetQueue();
    const [h] = await FC.next(1, new Set());
    hi.flag = ''; await FC.DB.put('photos', hi);
    const cov = (await FC.coverage()).first;
    return { batch, firstOnly, solo, hi: h.id, cov };
  });
  console.log(JSON.stringify(r));
  const recent = i => /^C\/R\d\.jpg$/.test(r.batch[i]);
  ok(r.batch.slice(0, 3).every(x => x.startsWith('A/')), 'Line: ★ priority client\'s never-searched photos first');
  ok(r.batch[5] === 'B/3.jpg' && r.batch[8] === 'C/0.jpg' && [3, 4, 6, 7].every(recent), 'Line: every 3rd photo is one never searched, even with newer photos due (clients take turns)');
  ok(r.firstOnly.slice(0, 3).every(x => x.startsWith('A/')) && r.firstOnly[3].startsWith('B/') && r.firstOnly[4].startsWith('C/0'), 'Today\'s 50 "Never searched first": priority client, then clients take turns');
  ok(r.solo[5] === 'B/3.jpg' && /C\/R/.test(r.solo[3]), 'Keep searching remembers the turn between photos');
  ok(r.hi === 'd:C/15.jpg', '⚑ High priority still goes first');
  ok(r.cov.done === 12 && r.cov.total === 20 && r.cov.never === 8 && r.cov.cant === 2 && r.cov.clients.C.join() === '12,13,2,12' && r.cov.clients.A.join() === '0,3,0,0', 'Counts: searched once, never searched, can\'t be searched (POOL, broken) apart');

  // A search marks the first time; a client reaching 100% leaves a note.
  const f = await page.evaluate(async () => {
    const p = await FC.DB.get('photos', 'd:C/0.jpg');
    const first = !FC.searchedOnce(p);
    p.searches = 1; p.lastSearched = new Date().toISOString(); p.firstAt = p.lastSearched; await FC.DB.put('photos', p);
    const cov = (await FC.coverage()).first;
    await FC.logWeek({ first: 1, searched: 1, client: 'C' });
    return { first, notes: await FC.firstNotes(), week: cov.week, store: (await chrome.storage.local.get('fcFirst')).fcFirst };
  });
  console.log(JSON.stringify({ notes: f.notes, week: f.week }));
  ok(f.first && f.notes.length === 1 && f.notes[0].name === 'C' && f.notes[0].n === 13 && f.week === 1, 'Client C reached 100%: one note, first searches this week counted');
  ok(f.store && f.store.done === 13 && f.store.never === 7, 'A small count is saved for Home');

  // Keep searching page.
  // Calm look: the page has four tabs (Progress, Clients and Settings are used here).
  await page.goto(url('app.html#keep?tab=clients')); await page.waitForTimeout(1500);
  const k = { rows: await page.evaluate(() => [...document.querySelectorAll('#firstClients .kcr')].map(t => t.querySelector('.kcn').textContent.replace(/\s+/g, ' ').trim() + ' ' + t.textContent.replace(/\s+/g, ' ').trim())) };
  await page.goto(url('app.html#keep?tab=settings')); await page.waitForTimeout(1200);
  k.which = await page.evaluate(() => document.querySelectorAll('[data-act="fiftywhich"]').length === 2);
  await page.click('[data-act="fiftywhich"][data-v="first"]'); await page.waitForTimeout(500);
  k.whichSaved = await page.evaluate(async () => (await FC.keep()).fiftyWhich);
  await page.goto(url('app.html#keep?tab=progress')); await page.waitForTimeout(1200);
  Object.assign(k, await page.evaluate(() => ({
    box: document.getElementById('firstBox') && document.getElementById('firstBox').textContent.replace(/\s+/g, ' '),
    share: document.querySelector('[data-act="firstshare"].on') && document.querySelector('[data-act="firstshare"].on').textContent,
  })));
  console.log(JSON.stringify(k));
  ok(k.box && /13\s*of 20 photos searched at least once/.test(k.box) && k.box.includes("can't be searched"), 'Keep searching: big first-search block');
  ok(k.rows.length === 3 && k.rows[0].startsWith('B') && k.rows[1].startsWith('★A') && /^C.*All searched once/.test(k.rows[2]), 'Keep searching: client table, lowest first, finished client marked');
  ok(k.share === '1 in 3' && k.which, 'Keep searching: share switch and Today\'s 50 choice');
  await page.click('[data-act="firstshare"][data-v="2"]'); await page.waitForTimeout(700);
  ok(await page.evaluate(async () => (await FC.keep()).firstShare) === 2 && /1 in 2/.test(await page.textContent('.sharebar')), 'Share switch saves 1 in 2');
  ok(k.whichSaved === 'first', 'Today\'s 50 choice saved');

  // Home: card + client finished note.
  await page.goto(url('app.html#home')); await page.waitForTimeout(1500);
  const hm = await page.evaluate(() => ({ card: document.getElementById('homeFirst') && document.getElementById('homeFirst').textContent.replace(/\s+/g, ' '), note: document.getElementById('firstDone') && document.getElementById('firstDone').textContent }));
  console.log(JSON.stringify(hm));
  ok(hm.card && hm.card.includes('13 of 20') && hm.card.includes('7 to go'), 'Home: every photo searched once card');
  ok(hm.note && hm.note.includes('C: every photo searched at least once'), 'Home: client finished note');
  await page.click('#firstDone [data-act="firstseen"]'); await page.waitForTimeout(300);
  await page.reload(); await page.waitForTimeout(1500);
  ok(!(await page.$('#firstDone')), 'Home: OK hides the note for good');

  // Weekly summary.
  await page.goto(url('app.html#weekly')); await page.waitForTimeout(1200);
  const wk = await page.evaluate(() => document.querySelector('.paper').textContent.replace(/\s+/g, ' '));
  ok(/1 photo was searched for the first time this week/.test(wk) && /C \(13 photos\)/.test(wk), 'Weekly summary: first searches and finished clients');

  // Dark mode: the new block reads well.
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
