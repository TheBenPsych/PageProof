// 4.42 searching release (mechanics review, Ben's picks): one search line (big searches no longer
// stop Keep searching), per-site lanes, new photo fast lane, a goal date instead of a pace, new
// client folders spotted, hot shoots, camera (EXIF) dates and bursts. Made-up photos only.
const { start } = require('./h.js');
const fs = require('fs');
const path = require('path');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  await page.evaluate(async () => {
    await chrome.storage.local.set({ ppSetupDone: true, ppTourDone: true, ppSeenVersion: chrome.runtime.getManifest().version, ppReconnectVer: chrome.runtime.getManifest().version,
      ppCheckup: { ver: chrome.runtime.getManifest().version, at: Date.now(), items: [], ok: true, seen: true } });
  });
  const day = n => new Date(Date.now() - n * 864e5).toISOString();

  // ---- 1. new photo fast lane: searched first, then again on day 3, 7 and 14
  const fl = await page.evaluate(({ d0, d4, d1, d8 }) => {
    const c = { name: 'Client A', searching: true };
    const P = x => ({ id: 'd:Client A/2026/Q4/a.jpg', name: 'a.jpg', client: 'Client A', year: 2026, quarter: 4, flag: '', searches: 0, empty: 0, ...x });
    return {
      fresh: FC.plan(P({ fresh: 1 }), c),
      old: FC.plan(P({}), c),
      day4: FC.plan(P({ fresh: 1, firstAt: d4, lastSearched: d4, searches: 1 }), c),
      day1: FC.plan(P({ fresh: 1, firstAt: d1, lastSearched: d1, searches: 1 }), c),
      day8: FC.plan(P({ fresh: 1, firstAt: d8, lastSearched: d4, searches: 2 }), c),
      done3: FC.plan(P({ fresh: 1, firstAt: d4, lastSearched: d0, searches: 2 }), c),
      hot: FC.plan(P({ hot: d0, lastSearched: d1, searches: 1 }), c),
    };
  }, { d0: day(0), d4: day(4), d1: day(1), d8: day(8) });
  ok(fl.fresh.tier === 0 && fl.fresh.due && fl.old.tier !== 0, 'a photo that just arrived in Drive goes to the front of the line (an older never-searched photo does not)');
  ok(fl.day4.due && fl.day4.tier === 1 && !fl.day1.fresh && fl.day8.due && !fl.done3.fresh, 'it is searched again on day 3 and day 7 (not on day 1, not twice for day 3)');
  ok(fl.hot.tier === 0 && fl.hot.due, 'a hot shoot photo goes to the front of the line');

  // ---- 2. camera dates (EXIF) when the folders have no year
  const ex = await page.evaluate(() => {
    const b = new TextEncoder().encode('JFIF....Exif..II*.....2025:06:14 10:11:12....');
    const later = new TextEncoder().encode('3021:01:01 00:00:00');
    return { d: FC.exifDate(b), none: FC.exifDate(new TextEncoder().encode('no date here')), future: FC.exifDate(later) };
  });
  ok(ex.d && ex.d.y === 2025 && ex.d.m === 6 && !ex.none && !ex.future, 'the camera date is read from the photo (and a date in the future is ignored): ' + JSON.stringify(ex.d));

  // ---- 3. hot shoots: marking a copy Stolen moves the rest of that shoot to the front (Undo too)
  const hs = await page.evaluate(async () => {
    const P = (id, extra) => ({ id, client: 'Client A', name: id.split('/').pop(), rel: id.slice(2), folder: 'x', year: 2026, quarter: 4, day: 22, flag: '', searches: 1, empty: 1, copies: 0, stolen: 0, added: 1, lastSearched: '2026-10-01T10:00:00.000Z', ...extra });
    await FC.DB.put('clients', { name: 'Client A', searching: true, priority: false, licensed: [], photos: 4 });
    await FC.DB.putMany('photos', [P('d:Client A/2026/Q4/22/p1.jpg', { copies: 1 }), P('d:Client A/2026/Q4/22/p2.jpg'), P('d:Client A/2026/Q4/22/p3.jpg'), P('d:Client A/2026/Q4/23/q1.jpg', { day: 23 })]);
    await FC.DB.put('copies', { id: 'd:Client A/2026/Q4/22/p1.jpg|site.com/s', photo: 'd:Client A/2026/Q4/22/p1.jpg', client: 'Client A', url: 'https://site.com/s', key: 'site.com/s', site: 'site.com', status: 'new', firstSeen: '2026-11-20', lastSeen: '2026-11-20', times: 1 });
    const undo = await FC.answer(['d:Client A/2026/Q4/22/p1.jpg|site.com/s'], 'stolen');
    const got = await FC.DB.getMany('photos', ['d:Client A/2026/Q4/22/p2.jpg', 'd:Client A/2026/Q4/22/p3.jpg', 'd:Client A/2026/Q4/23/q1.jpg']);
    FC.resetQueue();
    const nxt = (await FC.next(2)).map(p => p.id);
    await undo();
    const after = await FC.DB.getMany('photos', ['d:Client A/2026/Q4/22/p2.jpg', 'd:Client A/2026/Q4/22/p3.jpg']);
    return { n: undo.hot, hot: got.map(p => !!p.hot), nxt, after: after.map(p => !!p.hot) };
  });
  ok(hs.n === 2 && hs.hot[0] && hs.hot[1] && !hs.hot[2], 'Stolen marks the 2 other photos of that shoot (same folder and day), not the next day\'s: ' + JSON.stringify(hs.hot));
  ok(hs.nxt.length === 2 && hs.nxt.every(id => /\/22\/p[23]/.test(id)), 'they are the next photos searched: ' + hs.nxt.join(', '));
  ok(hs.after.every(h => !h), 'Undo puts them back in their old place in the line');

  // ---- 4. bursts: a near-identical frame waits until every other photo had its first search
  const bu = await page.evaluate(async () => {
    const P = (id, extra) => ({ id, client: 'Client B', name: id.split('/').pop(), rel: id.slice(2), folder: 'x', year: 2026, quarter: 4, day: 0, flag: '', searches: 0, empty: 0, copies: 0, stolen: 0, added: 1, order: 2026800, ...extra });
    await FC.DB.put('clients', { name: 'Client B', searching: true, priority: false, licensed: [], photos: 3 });
    await FC.DB.putMany('photos', [
      P('d:Client B/2026/Q4/b1.jpg', { look: 'ffff0000ffff0000', searches: 1, empty: 1, lastSearched: '2026-11-20T10:00:00.000Z', firstAt: '2026-11-20T10:00:00.000Z' }),
      P('d:Client B/2026/Q4/b2.jpg', { look: 'ffff0000ffff0003' }),
      P('d:Client B/2026/Q4/c1.jpg', { order: 2026000 }),
    ]);
    const sib = await FC.burstSibling(await FC.DB.get('photos', 'd:Client B/2026/Q4/b2.jpg'));
    const far = await FC.burstSibling({ id: 'd:Client B/2026/Q4/z.jpg', look: '0000ffff0000ffff' });
    const b2 = await FC.DB.get('photos', 'd:Client B/2026/Q4/b2.jpg'); b2.burstWait = sib && sib.id; await FC.DB.put('photos', b2);
    await FC.DB.put('clients', { name: 'Client A', searching: false, priority: false, licensed: [], photos: 4 });
    FC.resetQueue();
    const order = (await FC.next(5, new Set(), { first: true })).map(p => p.name);
    // b1 is searched again and finds a copy: the frame waiting behind it goes now.
    const b1 = await FC.DB.get('photos', 'd:Client B/2026/Q4/b1.jpg');
    const woke = await FC.wakeBurst(b1);
    const b2b = await FC.DB.get('photos', 'd:Client B/2026/Q4/b2.jpg');
    await FC.DB.put('clients', { name: 'Client B', searching: false, priority: false, licensed: [], photos: 3 });
    return { sib: sib && sib.name, far: !!far, order, woke, wait: !!b2b.burstWait, hot: !!b2b.hot };
  });
  ok(bu.sib === 'b1.jpg' && !bu.far, 'a frame that looks almost the same as one searched with nothing found is spotted (a different photo is not)');
  ok(bu.order.indexOf('b2.jpg') > bu.order.indexOf('c1.jpg'), 'it waits behind every other never-searched photo: ' + bu.order.join(', '));
  ok(bu.woke === 1 && !bu.wait && bu.hot, 'when its twin finds copies, the waiting frame goes to the front');

  // ---- 5. a goal date instead of a pace
  const go = await page.evaluate(() => {
    const k = { hours: 'work', from: 8, to: 18, weekdays: true, firstShare: 3 };
    const mon = new Date(2026, 10, 23, 0, 0, 0);       // a Monday
    const wk = FC.workMinutes(k, mon, new Date(2026, 10, 30, 0, 0, 0));
    const ahead = new Date(+mon + 60 * 864e5).toISOString().slice(0, 10);
    const near = new Date(+mon + 7 * 864e5).toISOString().slice(0, 10);
    return { wk, easy: FC.goalPlan({ ...k, goal: ahead }, 100, 'Faster', mon), hard: FC.goalPlan({ ...k, goal: near }, 5000, 'Faster', mon), done: FC.goalPlan({ ...k, goal: ahead }, 0, 'Faster', mon), none: FC.goalPlan(k, 100) };
  });
  ok(go.wk === 3000, 'a work week is 5 days of 10 hours (3,000 minutes): ' + go.wk);
  ok(go.easy.onTrack && go.easy.gap === 10, 'an easy goal is on track and goes no faster than Gentle: ' + JSON.stringify(go.easy));
  ok(!go.hard.onTrack && go.hard.gap === 2 && go.hard.eta > go.hard.goal, 'a goal too close goes at the fastest safe pace and says when it would really end: ' + go.hard.eta);
  ok(go.done.done && go.none === null, 'a met goal (or no goal) leaves the pace you picked');
  await page.evaluate(() => chrome.storage.local.set({ fcDrive: { label: 'G:\\Shared drives\\Photos', done: true } }));
  await page.evaluate(() => FC.setKeep({ goal: new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10) }));
  await page.goto(url('app.html#keep?tab=settings')); await page.waitForTimeout(2500);
  const kp = await page.evaluate(() => ({ input: !!document.querySelector('input[type=date][data-act=keepgoal]'), text: document.body.innerText }));
  ok(kp.input && /On track|Behind|Goal met/.test(kp.text), 'the Keep searching page has the goal date and says on track or behind');
  ok(/goes at half speed while it runs/.test(kp.text), 'Today\'s 50 no longer says Keep searching pauses');

  // ---- 6. new client folders spotted once a week
  const nf = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const top = await root.getDirectoryHandle('Shared drives', { create: true });
    const g = await top.getDirectoryHandle('10. Group G-H', { create: true });
    await g.getDirectoryHandle('Client G', { create: true });
    await RS_DB.put('handles', 'fcRoot', top);
    await FC.meta.set('picked', ['10. Group G-H/Client G']);
    const first = await FC.watchFolders();                    // remembers what is there
    await g.getDirectoryHandle('Client H', { create: true });
    const skip = await g.getDirectoryHandle('Old stuff', { create: true });
    const w = await (await skip.getFileHandle('client_info_ignore.txt', { create: true })).createWritable(); await w.write('client_id=Old\nignore_client=true'); await w.close();
    const grp = await top.getDirectoryHandle('11. Group I-J', { create: true });
    await grp.getDirectoryHandle('Client I', { create: true });
    const second = await FC.watchFolders();
    const list = await FC.newFolders();
    return { first: first.length, second: second.map(f => f.rel), list: list.length };
  });
  ok(nf.first === 0, 'the first look only remembers which folders are there');
  ok(nf.second.includes('10. Group G-H/Client H') && nf.second.includes('11. Group I-J') && !nf.second.some(r => /Old stuff|Client I$/.test(r)), 'a week later the new folders show (a new group once, skipped folders never): ' + nf.second.join(', '));
  await page.goto(url('app.html#home')); await page.waitForTimeout(3000);
  const hm = await page.evaluate(() => (document.getElementById('jobNewFolders') || {}).textContent || '');
  ok(/new folders appeared/.test(hm) && /Client H/.test(hm), 'Home says new folders appeared, with a link to tick them: ' + hm.replace(/\s+/g, ' ').slice(0, 120));
  await page.evaluate(() => FC.newFoldersSeen());
  ok((await page.evaluate(() => FC.newFolders())).length === 0, '"Not clients" hides them');

  // ---- 7. Keep searching keeps going while a big search runs, and uses the lanes
  const src = fs.readFileSync(path.join(__dirname, '../../extension/runner.js'), 'utf8');
  ok(!/a big search starts'\)/.test(src) && /const big = !!BG\.id \|\| fiftyRunning/.test(src) && /gapG \*= 2; gapF \*= 2/.test(src), 'a big search no longer stops Keep searching; it goes at half speed');
  ok(/lane = 'fast'/.test(src) && /quick: true/.test(src) && /S\.bgSkip/.test(src), 'Yandex and Bing take a quick look (then re-searches) while Google is busy; the big search\'s photos are skipped');
  const rp = await page.evaluate(async () => {
    await FC.DB.put('clients', { name: 'Client B', searching: true, priority: false, licensed: [], photos: 3 });
    const b1 = await FC.DB.get('photos', 'd:Client B/2026/Q4/b1.jpg'); b1.lastSearched = new Date(Date.now() - 60 * 864e5).toISOString(); await FC.DB.put('photos', b1);
    FC.resetQueue();
    return (await FC.next(3, new Set(), { repeat: true })).map(p => p.name);
  });
  ok(rp.length >= 1 && rp.every(n => n === 'b1.jpg'), 'the Yandex and Bing lane only takes photos searched before: ' + rp.join(', '));

  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await ctx.close();
  process.exit(fails ? 1 : 0);
})();
