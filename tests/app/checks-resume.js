// After an update everything that was running carries on (4.61, Ben): PageProof pages you had open
// come back where they were, a paused search stays paused, a cut-off Credit search "Search now"
// carries on, a page the credit search was reading is not lost, and a small note says what carried on.
const { start } = require('./h.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const { ctx, sw, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  await page.evaluate(() => chrome.storage.local.set({ ppSetupDone: true, ppTourDone: true, ppSeenVersion: chrome.runtime.getManifest().version, ppReconnectVer: chrome.runtime.getManifest().version }));
  await page.reload(); await page.waitForTimeout(1200);
  for (const p of ctx.pages()) if (/#setup/.test(p.url())) await p.close();   // the first-run setup tab
  await wait(3500);
  const b = await ctx.newPage(); await b.goto(url('app.html#settings')); await b.waitForTimeout(1200);
  const c = await ctx.newPage(); await c.goto(url('app.html#tools')); await c.waitForTimeout(1200);
  const notes = await sw.evaluate(async () => { const all = await chrome.storage.local.get(null); return Object.entries(all).filter(([k]) => k.startsWith('ppPage:')).map(([k, v]) => ({ id: +k.slice(7), hash: v.hash })); });
  ok(notes.length === 3 && ['help', 'settings', 'tools'].every(h => notes.some(n => n.hash === h)), 'each open PageProof page notes where it is (' + notes.map(n => n.hash).join(', ') + ')');
  await b.close(); await wait(4500);
  const left = await sw.evaluate(async () => Object.keys(await chrome.storage.local.get(null)).filter(k => k.startsWith('ppPage:')).length);
  ok(left === 2, 'a page you close yourself is forgotten (' + left + ' left)');

  // A page the credit search was reading when PageProof stopped goes back in line (not lost).
  const cs = await page.evaluate(async () => {
    await FC.meta.set('creditState', { done: {}, queue: [], seen: {}, nomatch: [], log: [], found: 0, pages: 0, cur: { q: { url: 'https://x.example/p', client: 'Client A' }, at: Date.now() - 10 * 60000 } });
    const s = await PP_WATCH.creditState();
    const fresh = await (async () => { await FC.meta.set('creditState', { done: {}, queue: [], seen: {}, nomatch: [], log: [], found: 0, pages: 0, cur: { q: { url: 'https://x.example/p', client: 'Client A' }, at: Date.now() } }); return PP_WATCH.creditState(); })();
    await FC.meta.set('creditState', { done: {}, queue: [], seen: {}, nomatch: [], log: [], found: 0, pages: 0 });
    return { back: s.queue.length === 1 && s.queue[0].url === 'https://x.example/p' && s.queue[0].tries === 1 && !s.cur, busy: !fresh.queue.length && !!fresh.cur };
  });
  ok(cs.back, 'a credit search page cut off half way goes back to the front of the line');
  ok(cs.busy, 'a page that is being read right now is left alone');

  // The update: paused, one big search in line, a Credit search "Search now" in its reading part.
  const info = await sw.evaluate(async (ids) => {
    await chrome.storage.local.set({ fcPause: Date.now(), fcBgJobs: ['rsTestJob'], fcCreditRun: { client: 'Client A', start: Date.now() - 60000, beat: Date.now() - 5000, phase: 'read', words: 2, wDone: 2, links: 4, pages: 3, read: 1, found: 2, known: 0, failed: 0, nomatch: 0, per: {}, both: 0, end: 0, why: '' } });
    const all = await chrome.storage.local.get(null);
    // The browser closes the PageProof tabs (one of them stays, cut off: it is loaded again).
    const help = ids.find(x => x.hash === 'help');
    await chrome.tabs.remove(help.id);
    await pickUpAfterUpdate('4.0.0', all);
    return (await chrome.storage.local.get('ppPickedUp')).ppPickedUp;
  }, notes.filter(n => n.hash !== 'settings'));
  ok(info && info.from === '4.0.0' && info.paused, 'the update note is saved, and knows things were paused');
  ok(info && info.items.some(i => /big search.*still paused/i.test(i)), 'it lists the big search as still paused');
  ok(info && info.items.some(i => /Credit search for Client A/.test(i)), 'it lists the Credit search');
  ok(info && info.items.some(i => /PageProof pages you had open/.test(i)), 'it lists the pages opened again (' + (info && info.items.join(' | ')) + ')');
  await wait(3500);
  const apps = ctx.pages().filter(p => /app\.html/.test(p.url()));
  const back = apps.find(p => /#help$/.test(p.url()));
  ok(apps.length === 2, 'no doubles: 2 PageProof pages, as before the update (' + apps.map(p => p.url().split('/').pop()).join(', ') + ')');
  ok(!!back && !/back=1/.test(back.url()), 'the closed page came back at the same place (#help)');
  ok(/#home$/.test(c.url()) || /#tools$/.test(c.url()), 'the page still open was loaded again with the new code (' + c.url().split('/').pop() + ')');
  if (back) {
    back.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
    const note = await back.evaluate(() => { const n = document.getElementById('ppPicked'); return n ? n.innerText : ''; }).catch(() => '');
    ok(/Picked up after the update/.test(note) && /Paused things stay paused/.test(note), 'the page shows the small "Picked up after the update" note');
    await back.evaluate(() => document.querySelector('[data-pp-picked]') && document.querySelector('[data-pp-picked]').click());
    await wait(500);
    const seen = await back.evaluate(async () => ({ gone: !document.getElementById('ppPicked'), seen: (await chrome.storage.local.get('ppPickedUp')).ppPickedUp.seen }));
    ok(seen.gone && seen.seen, 'OK closes the note, and it is not shown again');
  }
  // The Credit search carried on in the page that opened (its old page was gone), with its counts.
  await wait(2500);
  const cr = await sw.evaluate(async () => (await chrome.storage.local.get('fcCreditRun')).fcCreditRun);
  ok(cr && cr.end > 0 && cr.resumed === 1 && cr.found === 2 && cr.read === 1, 'the cut-off Credit search carried on and finished, keeping its counts (' + JSON.stringify(cr && { end: !!cr.end, resumed: cr.resumed, found: cr.found }) + ')');
  // Paused stays paused: the big search is still in line, not started or dropped.
  const q = await sw.evaluate(async () => (await chrome.storage.local.get(['fcBgJobs', 'fcPause'])));
  ok(q.fcPause && (q.fcBgJobs || []).includes('rsTestJob'), 'a paused big search stays paused and in line');

  // A list download cut off half way is tried again, not left for 6 hours.
  await ctx.route('**/*tranco*/**', r => r.fulfill({ status: 503, body: '' }));
  const pp = await (back || c).evaluate(async () => {
    await chrome.storage.local.set({ ppPop: { tried: Date.now() - 10 * 60000 } });
    const cut = await PP_POP.refresh();
    await chrome.storage.local.set({ ppPop: { tried: Date.now() - 10 * 60000, ended: Date.now() - 9 * 60000, err: 'x' } });
    const done = await PP_POP.refresh();
    return { cut, done };
  }).catch(e => ({ err: String(e).slice(0, 100) }));
  ok(pp.cut && !pp.cut.waiting, 'popularity list: a download cut off half way is tried again (' + JSON.stringify(pp.cut) + ')');
  ok(pp.done && pp.done.waiting, 'popularity list: a download that ended with an error still waits 6 hours');
  await ctx.close().catch(() => {});
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
