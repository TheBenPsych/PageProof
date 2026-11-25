// Searching speed-ups (Ben's picks 1, 3, 4, 5, 8 + random years): the speed ladder, the Yandex
// and Bing quick-look lane, look-alike frames sharing one search, Normal and Light computers at
// full speed, the speed meter and done-by dates, and first searches mixing in random older years.
// Made-up clients and photos only.
const { start } = require('./h.js');
process.env.NP = 20; process.env.NC = 5;
const { seed } = require('./seed.js');
const fs = require('fs');
const path = require('path');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  await seed(page); await page.reload(); await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    await chrome.storage.local.set({ ppSetupDone: true, ppTourDone: true, ppSeenVersion: chrome.runtime.getManifest().version, ppReconnectVer: chrome.runtime.getManifest().version,
      ppCheckup: { ver: chrome.runtime.getManifest().version, at: Date.now(), items: [], ok: true, seen: true }, ppHw: { choice: 'Strong' } });
  });

  // ---- 5. Normal and Light computers at full speed
  const hw = await page.evaluate(() => ({ n: ppHwLimits('Normal', 4, 8).pace, l: ppHwLimits('Light', 2, 4).pace, s: ppHwLimits('Strong', 16, 32).pace }));
  ok(hw.n === 'Faster' && hw.l === 'Steady' && hw.s === 'Faster', 'a Normal computer may go Faster, a Light one Steady: ' + JSON.stringify(hw));

  // ---- 1. the speed ladder
  const ld = await page.evaluate(async () => {
    await chrome.storage.local.remove(['fcLadder', 'fcRobotAt']);
    const k = await FC.keep(), H = 3600000, t0 = new Date(2026, 10, 24, 9, 0).getTime();
    const out = [];
    const at = async t => { const l = await FC.ladder(k, t); out.push(l.g.step + '/' + l.f.step); return l; };
    await at(t0);                       // starts at step 1 (2 minutes)
    await at(t0 + 30 * 60000);          // half an hour: no change
    await at(t0 + H + 1000);            // a calm hour: one step up
    await at(t0 + 2 * H + 2000);
    const l3 = await at(t0 + 3 * H + 3000);
    await at(t0 + 4 * H + 4000);        // the top (40 s) is step 4: no further
    // Google asks "are you a robot": its lane drops two steps and stays there today; Yandex and Bing go on.
    await chrome.storage.local.set({ fcRobotAt: { google: t0 + 4 * H + 5000 } });
    const drop = await at(t0 + 4 * H + 6000);
    await at(t0 + 6 * H);
    // The next morning: one step below where it ended.
    const next = await at(t0 + 24 * H);
    const top30 = await FC.ladder({ ...k, ladderTop: 30 }, t0 + 25 * H + 1000);
    return { out, l3: l3.gSec, drop: [drop.g.step, drop.g.cap, drop.f.step], next: [next.g.step, next.f.step], top30: top30.top };
  });
  console.log(JSON.stringify(ld));
  ok(ld.out.slice(0, 6).join() === '0/0,0/0,1/1,2/2,3/3,3/3' && ld.l3 === 40, 'the ladder climbs one step each calm hour, up to 1 photo every 40 seconds: ' + ld.out.join(' '));
  ok(ld.drop.join() === '1,1,3' && ld.out[7] === '1/3', 'a robot check on Google drops only Google\'s lane two steps, for the rest of the day');
  ok(ld.next.join() === '0,2' && ld.top30 === 4, 'the next day starts one step lower; 30 seconds can be picked as the top step');
  const src = fs.readFileSync(path.join(__dirname, '../../extension/runner.js'), 'utf8');
  const rs = fs.readFileSync(path.join(__dirname, '../../extension/revsearch.js'), 'utf8');
  ok(/FC\.ladder\(k\)/.test(src) && /fcRobotAt/.test(rs) && /pace === 'Faster'/.test(src), 'Keep searching uses the ladder only on Faster, and every robot check is noted for it');

  // ---- 3. quick looks (Yandex and Bing) and full searches (with Google)
  const q = await page.evaluate(async () => {
    for (const p of await FC.DB.all('photos')) await FC.DB.del('photos', p.id);
    for (const c of await FC.DB.all('clients')) await FC.DB.del('clients', c.name);
    await chrome.storage.local.remove(['fcDays', 'fcToday', 'rsSettings']);
    await FC.DB.put('clients', { name: 'Client Q', searching: true, priority: false, licensed: [], photos: 4 });
    const P = (n, extra) => ({ id: 'd:Client Q/2026/Q4/' + n + '.jpg', client: 'Client Q', name: n + '.jpg', rel: 'Client Q/2026/Q4/' + n + '.jpg', year: 2026, quarter: 4, order: 100 - n.charCodeAt(0), flag: '', searches: 0, empty: 0, copies: 0, stolen: 0, added: 1, ...extra });
    await FC.DB.putMany('photos', [P('a'), P('b'), P('c'), P('d', { searches: 1, lastSearched: new Date(Date.now() - 400 * 864e5).toISOString(), year: 2019, order: 1 })]);
    FC.resetQueue();
    const pic = id => ({ fcId: 'd:Client Q/2026/Q4/' + id + '.jpg', name: id + '.jpg' });
    await FC.ingest(pic('a'), [], 'Keep searching', { engines: ['yandex', 'bing'] });
    const a1 = await FC.DB.get('photos', 'd:Client Q/2026/Q4/a.jpg');
    FC.resetQueue();
    const nq = (await FC.next(2, new Set(), { quick: true })).map(p => p.name);
    const cov1 = (await FC.coverage()).first;
    await FC.ingest(pic('a'), [], 'Keep searching', { engines: ['google'] });
    const a2 = await FC.DB.get('photos', 'd:Client Q/2026/Q4/a.jpg');
    // Google switched off: Yandex and Bing count as the full search.
    await chrome.storage.local.set({ rsSettings: { engines: { google: false, yandex: true, bing: true } } });
    await FC.ingest(pic('b'), [], 'Keep searching', { engines: ['yandex', 'bing'] });
    const b = await FC.DB.get('photos', 'd:Client Q/2026/Q4/b.jpg');
    await chrome.storage.local.remove('rsSettings');
    // A quick look that finds a copy sends the photo to Google next.
    await FC.ingest(pic('c'), [{ url: 'https://example-news.test/story', key: 'example-news.test/story', site: 'example-news.test', verdict: 'same', pct: 90 }], 'Keep searching', { engines: ['yandex'] });
    const c = await FC.DB.get('photos', 'd:Client Q/2026/Q4/c.jpg');
    FC.resetQueue();
    const nextG = (await FC.next(1, new Set()))[0];
    // Every never-searched photo had a quick look: the lane goes on to re-searches.
    FC.resetQueue();
    const rep = (await FC.next(1, new Set(['d:Client Q/2026/Q4/c.jpg']), { quick: true })).map(p => p.name);
    const sp = await FC.speed();
    const today = (await chrome.storage.local.get('fcToday')).fcToday;
    return { a1: [a1.searches, !!a1.quickAt, !!a1.firstAt], nq, cov1: [cov1.done, cov1.quick, cov1.clients['Client Q'].join()], a2: [a2.searches, !!a2.firstAt], b: b.searches, c: [c.searches, !!c.hot, c.copies], nextG: nextG && nextG.name, rep, sp, today };
  });
  console.log(JSON.stringify(q));
  ok(q.a1.join() === '0,true,false' && q.cov1[0] === 1 && q.cov1[1] === 2, 'a quick look is counted apart: the photo still counts as never searched until Google has searched it');
  ok(q.nq.join() === 'b.jpg,c.jpg', 'the quick-look lane takes the never-searched photos it has not looked at yet: ' + q.nq.join(', '));
  ok(q.a2.join() === '1,true', 'Google\'s search makes it searched once');
  ok(q.b === 1, 'with Google switched off, Yandex and Bing count as the full search');
  ok(q.c[0] === 0 && q.c[1] && q.c[2] === 1 && q.nextG === 'c.jpg', 'a copy found in a quick look sends the photo to Google next');
  ok(q.rep.join() === 'd.jpg', 'when every photo had its quick look, the lane goes on to re-searches');
  ok(q.today.quick === 2 && q.today.searched === 2 && q.sp.days === 1 && q.sp.full === 2 && q.sp.quick === 2 && q.sp.first === 2, 'the speed meter counts full searches, first searches and quick looks per day: ' + JSON.stringify(q.sp));

  // ---- 4. look-alike frames share one search
  const al = await page.evaluate(async () => {
    const id = 'd:Client Q/2026/Q4/e.jpg';
    await FC.DB.put('photos', { id, client: 'Client Q', name: 'e.jpg', rel: 'Client Q/2026/Q4/e.jpg', year: 2026, quarter: 4, order: 50, flag: '', searches: 0, empty: 0, copies: 0, stolen: 0, added: 1, burstWait: 'd:Client Q/2026/Q4/a.jpg' });
    await FC.ingest({ fcId: id, name: 'e.jpg' }, [], 'Keep searching (look-alike frame)', { shared: true });
    const e1 = await FC.DB.get('photos', id);
    await FC.ingest({ fcId: id, name: 'e.jpg' }, [{ url: 'https://example-blog.test/p', key: 'example-blog.test/p', site: 'example-blog.test', verdict: 'maybe', pct: 70 }], 'Keep searching (look-alike frame)', { shared: true });
    const e2 = await FC.DB.get('photos', id);
    return { e1: [e1.searches, !!e1.burstWait, !!e1.hot, !!e1.alikeAt], e2: [e2.searches, !!e2.burstWait, !!e2.hot, e2.copies] };
  });
  ok(al.e1.join() === '0,true,false,true', 'a look-alike frame with nothing found keeps waiting for its own search');
  ok(al.e2.join() === '0,false,true,1', 'a copy of the look-alike frame found in its twin\'s search is added to it, and it goes next');
  ok(/alikeFrames\(p, p\.look\)/.test(src) && /async function alikeCheck/.test(rs) && /alike: \(opts\.alike/.test(fs.readFileSync(path.join(__dirname, '../../extension/rs-job.js'), 'utf8')), 'Keep searching brings look-alike frames along and checks the finds against them');

  // ---- random years
  const mx = await page.evaluate(() => {
    const L = [['n1', 2026], ['n2', 2026], ['n3', 2026], ['n4', 2026], ['n5', 2026], ['o1', 2019], ['o2', 2019], ['p1', 2017]].map(([id, year], i) => ({ id, year, order: 100 - i }));
    const r = FC.mixYears(L, () => 0).map(p => p.id);
    const one = FC.mixYears(L.slice(0, 3), () => 0).map(p => p.id);
    return { r, one };
  });
  ok(mx.r.join() === 'n1,n2,o1,n3,n4,o2,n5,p1' && mx.one.join() === 'n1,n2,n3', 'first searches: 2 newest, then 1 from a random older year, and so on: ' + mx.r.join(', '));

  // ---- 8. the pages: ladder, quick-look bar, lanes, speed meter and done-by dates
  await page.evaluate(async () => {
    await FC.setKeep({ on: true, pace: 'Faster', ladder: true, ladderTop: 40 });
    await chrome.storage.local.set({ fcLadder: { g: { step: 2, at: Date.now(), cap: 3, day: new Date().toDateString() }, f: { step: 3, at: Date.now(), cap: 3, day: new Date().toDateString() } } });
  });
  await page.goto(url('app.html#keep')); await page.waitForTimeout(1800);
  const kp = await page.evaluate(() => ({
    ladder: (document.getElementById('ladderBox') || {}).textContent || '',
    on: document.querySelectorAll('#ladderBox .ladder span.on').length,
    quick: (document.getElementById('quickRow') || {}).textContent || '',
    lane: !!document.getElementById('quickLane'),
    speed: (document.getElementById('speedStat') || {}).textContent || '',
  }));
  console.log(JSON.stringify(kp).slice(0, 600));
  ok(/Step 3 of 4/.test(kp.ladder) && kp.on === 3 && /Google 1 photo every 60 s, Yandex and Bing every 20 s/.test(kp.ladder), 'Keep searching shows the speed ladder and where it is now');
  ok(/Quick look/.test(kp.quick) && /4 of 5/.test(kp.quick) && kp.lane, 'Keep searching shows the quick-look bar and the two lanes: ' + kp.quick.replace(/\s+/g, ' '));
  ok(/^2\s*photos/.test(kp.speed.trim()) && /photos searched a day this week/.test(kp.speed), 'Keep searching shows this week\'s speed');
  await page.click('[data-act="laddertop"][data-v="30"]'); await page.waitForTimeout(600);
  ok(await page.evaluate(async () => (await FC.keep()).ladderTop) === 30 && /Step 3 of 5/.test(await page.textContent('#ladderBox')), 'the fastest step can be set to 30 seconds');
  await page.click('#ladderBox [data-act="keepladder"]'); await page.waitForTimeout(600);
  ok(await page.evaluate(async () => (await FC.keep()).ladder) === false && /Off/.test(await page.textContent('#ladderBox')), 'the ladder can be switched off');
  await page.goto(url('app.html#clients')); await page.waitForTimeout(1800);
  const cp = await page.evaluate(() => ({ head: (document.getElementById('clientSpeed') || {}).textContent || '', by: [...document.querySelectorAll('.cdone')].map(e => e.textContent) }));
  console.log(JSON.stringify(cp));
  ok(/2 photos a day this week/.test(cp.head) && /Every photo searched once/.test(cp.head), 'Clients and photos shows this week\'s speed and when every photo is searched once');
  ok(cp.by.length === 1 && /^done by /.test(cp.by[0]), 'each client not finished shows its done-by date');
  for (const dark of [true]) {
    await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light' });
    await page.goto(url('app.html#keep')); await page.waitForTimeout(1500);
  }

  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await ctx.close();
  process.exit(fails ? 1 : 0);
})();
