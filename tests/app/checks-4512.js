// Two searches never pick the same photos (4.51.2, Ben): Today's 50 "Next in line" then
// "Never searched first" started minutes apart both began with the same photos. Made-up photos only.
const { start } = require('./h.js');
process.env.NP = 20; process.env.NC = 3;
const { seed } = require('./seed.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  await seed(page); await page.reload(); await page.waitForTimeout(1200);
  const r = await page.evaluate(async () => {
    const out = {};
    const ids = ps => ps.map(p => p.id);
    const job = (id, pics, extra = {}) => RS_DB.put('jobs', id, { id, created: new Date().toISOString(), engines: ['google'], pics: pics.map((p, i) => ({ fcId: p.id, i, runs: { google: { state: 'wait' } } })), ...extra });
    // 1. A first search of 10 is running: a second search started now gets other photos.
    const a = await FC.next(10);
    await job('rsA', a); FC.claimReset();
    const b = await FC.next(10, new Set(), { first: true });
    out.overlapRunning = ids(b).filter(x => ids(a).includes(x)).length;
    out.bLen = b.length;
    // 2. Search finished but still checking matches (searched, not yet added to Copies found).
    const j = await RS_DB.get('jobs', 'rsA');
    j.finished = new Date().toISOString(); for (const p of j.pics) p.runs.google.state = 'done';
    await RS_DB.put('jobs', 'rsA', j); FC.claimReset();
    const c = await FC.next(10, new Set(), { first: true });
    out.overlapChecking = ids(c).filter(x => ids(a).includes(x)).length;
    // 3. Matches added (photos marked searched by another page; this page's line is old).
    for (const p of j.pics) p.ingested = true;
    await RS_DB.put('jobs', 'rsA', j);
    const now = new Date(Date.now() + 1000).toISOString();
    const got = await FC.DB.getMany('photos', ids(a));
    for (const p of got) { p.lastSearched = now; p.firstAt = now; }
    await FC.DB.putMany('photos', got); FC.claimReset();
    const d = await FC.next(10, new Set(), { first: true });
    out.overlapDone = ids(d).filter(x => ids(a).includes(x)).length;
    // 4. A stopped search lets go of photos it never searched.
    await RS_DB.del('jobs', 'rsA');
    const e = await FC.next(3);
    await job('rsB', e, { stoppedAt: new Date().toISOString() }); FC.claimReset();
    const f = await FC.next(3);
    out.stoppedFree = ids(f).filter(x => ids(e).includes(x)).length;
    await RS_DB.del('jobs', 'rsB');
    // 5. Photos being read from Drive for a big search are held from Keep searching.
    const g = await FC.next(4, new Set(), { hold: true }); FC.claimReset();
    const h = await FC.next(4);
    out.overlapHold = ids(h).filter(x => ids(g).includes(x)).length;
    await chrome.storage.local.remove('fcHold');
    return out;
  });
  ok(r.bLen > 0 && r.overlapRunning === 0, 'a second search started while the first runs gets other photos: ' + JSON.stringify(r));
  ok(r.overlapChecking === 0, 'still checking matches: those photos are still left out');
  ok(r.overlapDone === 0, 'searched by another page since the line was made: left out');
  ok(r.stoppedFree === 3, 'a stopped search lets go of the photos it never searched');
  ok(r.overlapHold === 0, 'photos being got ready from Drive for a big search are held');
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
