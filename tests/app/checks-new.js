const { start } = require('./h.js');
process.env.NP = 3000; process.env.NC = 400;
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

  // ---- skipped photos
  const sk = await page.evaluate(async () => {
    const root = await RS_DB.get('handles', 'fcRoot');
    const ps = (await FC.DB.all('photos')).slice(0, 4);
    // p0: missing file -> gone. p1: empty file. p2: junk bytes. p3: real jpeg.
    const mk = async (p, bytes) => { let d = root; const parts = p.rel.split('/'); for (const x of parts.slice(0, -1)) d = await d.getDirectoryHandle(x, { create: true }); const fh = await d.getFileHandle(parts.at(-1), { create: true }); const w = await fh.createWritable(); if (bytes) await w.write(bytes); await w.close(); };
    await mk(ps[1], null); await mk(ps[2], new Uint8Array([1, 2, 3, 4, 5]));
    const c = new OffscreenCanvas(300, 200); c.getContext('2d').fillRect(0, 0, 50, 50); await mk(ps[3], await c.convertToBlob({ type: 'image/jpeg' }));
    const tiff = { ...ps[0], id: ps[0].id + '.tif', name: 'x.tif', rel: ps[0].rel + '.tif' }; await FC.DB.put('photos', tiff);
    const out = [];
    for (const p of [ps[0], ps[1], ps[2], ps[3], tiff]) { const r = await FC.readPhoto(p); out.push(r.error ? (await FC.DB.get('photos', p.id)).skip : 'ok'); }
    const list = await FC.skipped();
    const plan = FC.plan(await FC.DB.get('photos', tiff.id), { searching: true });
    const n = await FC.retrySkipped([ps[1].id]);
    const after = await FC.DB.get('photos', ps[1].id);
    return { out, list: list.length, plan, n, retry: after.retry, left: (await FC.skipped()).length, planRetry: FC.plan(after, {}) };
  });
  console.log(JSON.stringify(sk));
  ok(sk.out.join() === 'gone,empty,broken,ok,type' && sk.list === 4, 'Skipped: each reason is recognised and listed');
  ok(sk.plan.due === false && sk.n === 1 && sk.retry === 1 && sk.left === 3 && sk.planRetry.tier === 0, 'Skipped: TIFF never retried, Try again puts a photo at the front');
  await page.goto(url('app.html#skipped')); await page.waitForTimeout(900);
  ok(await page.evaluate(() => document.querySelectorAll('.scroll tbody tr').length) === 3, 'Skipped photos page lists them');

  // ---- broken engine
  const en = await page.evaluate(async () => {
    await chrome.storage.local.remove('fcEngines');
    const ps = (await FC.DB.all('photos')).slice(10, 22);
    for (const p of ps) { p.empty = 1; } await FC.DB.putMany('photos', ps);
    let broke = [];
    for (let i = 0; i < 10; i++) broke = await FC.engineResults({ google: 0, yandex: 3 }, ps[i].id, true);
    const e1 = await FC.engines(), b1 = await FC.brokenEngines();
    const emptied = (await FC.DB.getMany('photos', ps.map(p => p.id))).map(p => p.empty);
    const job = await RS_JOB.create([{ name: 'a', links: [] }], { kind: 'keep' });
    await FC.retryEngine('google');
    const b2 = await FC.brokenEngines();
    const again = await FC.engineResults({ google: 0 }, null, false);
    await FC.engineResults({ google: 5 }, null, false);
    const e3 = await FC.engines();
    return { broke, zeros: e1.google.zeros, b1: Object.keys(b1), emptied, jobEngines: job.engines, b2: Object.keys(b2), again, okNow: !!e3.google.ok, z3: e3.google.zeros };
  });
  console.log(JSON.stringify(en));
  ok(en.broke.join() === 'google' && en.b1.join() === 'google' && en.emptied.slice(0, 10).every(x => x === 0) && en.emptied[10] === 1, 'Engine: 10 empty Google results rest it and take back the empty marks');
  ok(!en.jobEngines.includes('google') && en.jobEngines.includes('yandex'), 'Engine: Keep searching leaves the broken site out');
  ok(en.b2.length === 0 && en.again.join() === 'google' && en.okNow && en.z3 === 0, 'Engine: Try it now tests once; a good result clears it');

  // ---- repeat offenders + approve site
  const rp = await page.evaluate(async () => {
    await RS_LISTS.load(); FCD = null; await loadFC();
    { const st = FCD.copies.find(c => c.status === 'stolen'); const nw = FCD.copies.filter(c => c.status === 'new').slice(-2); for (const n of nw) { const r = await FC.DB.get('copies', n.id); r.site = st.site; await FC.DB.put('copies', r); } FCD = null; await loadFC(); }
    const news = FCD.copies.filter(c => c.status === 'new');
    const withRepeat = FCD.copies.filter(c => c.repeat && c.status === 'new');
    const q = reviewQueue();
    const firstNon = q.findIndex(c => !c.repeat), lastRep = q.map(c => !!c.repeat).lastIndexOf(true);
    return { n: withRepeat.length, order: lastRep < firstNon || firstNon === -1, sample: withRepeat[0] && [withRepeat[0].repeat, withRepeat[0].repeatWho] };
  });
  console.log(JSON.stringify(rp));
  ok(rp.n > 0 && rp.order, 'Repeat offenders are flagged and come first in Review');
  await page.goto(url('app.html#found')); await page.waitForTimeout(1500);
  await page.click('[data-act="ffilter"][data-v="New"]'); await page.waitForTimeout(500);
  await page.click('.frow .l1'); await page.waitForTimeout(600);
  ok(await page.evaluate(() => !/No registration number found/.test(document.getElementById('drawer').textContent)), 'Details panel: the "No registration number found" box is gone');
  const ap = await page.evaluate(async () => {
    const c = FCD.copies.find(x => x.id === state.open); const base = FC.baseOf(c.site);
    const before = FCD.copies.filter(x => FC.baseOf(x.site) === base && x.status === 'new');
    ACTS.openok();
    await new Promise(r => setTimeout(r, 200));
    document.querySelector('[data-act="approvesite"][data-v="client"]').click();
    await new Promise(r => setTimeout(r, 1200));
    const cl = await FC.DB.get('clients', c.clientName);
    const mine = (await FC.allCopies()).filter(x => FC.baseOf(x.site) === base && x.client === c.clientName);
    const others = (await FC.allCopies()).filter(x => FC.baseOf(x.site) === base && x.client !== c.clientName && before.some(b => b.id === x.id));
    // a later find on that site for that client is licensed by itself
    const p = await FC.DB.get('photos', c.photo);
    await FC.ingest({ fcId: p.id, name: p.name, hash: p.hash }, [{ url: 'https://' + base + '/zz', key: base + '/zz', site: base, engines: ['google'], verdict: 'same', pct: 90 }], 'a search');
    const nw = await FC.DB.get('copies', p.id + '|' + base + '/zz');
    return { base, lic: (cl.licensed || []).includes(base), mine: mine.filter(x => before.some(b => b.id === x.id)).every(x => x.status === 'licensed'), others: others.every(x => x.status === 'new'), nw: nw.status, id: c.id, next: state.open };
  });
  console.log(JSON.stringify(ap));
  ok(ap.lic && ap.mine && ap.others && ap.nw === 'licensed', 'Approve for one client: that client\'s copies there become Licensed, others stay, later finds too');
  await page.keyboard.press('u'); await page.waitForTimeout(1000);
  const un = await page.evaluate(async a => ({ st: (await FC.DB.get('copies', a.id)).status, lic: ((await FC.DB.get('clients', (await FC.DB.get('copies', a.id)).client)).licensed || []).includes(a.base) }), ap);
  ok(un.st === 'new' && !un.lic, 'Approve: Undo puts it all back');
  const all = await page.evaluate(async () => {
    FCD = null; await loadFC();
    const c = FCD.copies.find(x => x.status === 'new' && x.site.split('.').length === 2); const base = FC.baseOf(c.site);
    const undo = await FC.approveSite(base, '');
    await RS_LISTS.load();
    const st = (await FC.allCopies()).filter(x => FC.baseOf(x.site) === base && x.status === 'new').length;
    const p = await FC.DB.get('photos', c.photo);
    await FC.ingest({ fcId: p.id, name: p.name, hash: p.hash }, [{ url: 'https://' + base + '/yy', key: base + '/yy', site: base, engines: ['google'], verdict: 'same', pct: 90 }], 'a search');
    const nw = (await FC.DB.get('copies', p.id + '|' + base + '/yy'));
    return { allowed: RS_LISTS.allowed.includes(base), st, nw: nw.status, auto: nw.auto };
  });
  console.log(JSON.stringify(all));
  ok(all.allowed && all.st === 0 && all.nw === 'licensed', 'Approve for every client works, and later finds are Licensed');
  await page.goto(url('app.html#hidden')); await page.waitForTimeout(800);
  await page.click('[data-act="hidtab"][data-v="client"]'); await page.waitForTimeout(400);

  // ---- health page + copy details
  await page.goto(url('app.html#health')); await page.waitForTimeout(1500);
  const lights = await page.evaluate(() => [...document.querySelectorAll('.htile .ht b')].map(b => b.textContent));
  console.log(lights.join(' | '));
  ok(lights.includes('Google Drive photos') && lights.includes('Google Lens') && lights.includes('PageProof version'), 'Health page shows the lights');
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await page.click('[data-act="supportcopy"]'); await page.waitForTimeout(2000);
  const sup = await page.evaluate(() => state.support);
  console.log(sup.split('\n').slice(0, 40).join('\n'));
  ok(sup.includes('Photos: 3,00') && !/Client [A-Z] Media|IMG_0|site\d+\./.test(sup), 'Copy details: numbers only, no client, photo or site names');

  // ---- photo check: a copy compared over a tiny shared area is never "Same photo"
  const rsSrc = require('fs').readFileSync(require('path').resolve(__dirname, '../../extension/revsearch.js'), 'utf8');
  const vSrc = rsSrc.slice(rsSrc.indexOf('const SCORE_VERSION'), rsSrc.indexOf('const VERDICT ='));
  const vd = await page.evaluate(src => {
    const job = null; const RS_REJECT = { notMatch: () => false };
    const verdict = new Function('job', 'RS_REJECT', src + '; return verdict;')(job, RS_REJECT);
    const sv = new Function(src + '; return SCORE_VERSION;')();
    return {
      dot: verdict({ sv, pct: 100, inl: 81, tiles: 2, str: 0.9, mid: null, n: 2 }),           // the case Ben saw: 2 squares compared
      oldDot: verdict({ sv, pct: 100, inl: 40, tiles: 3, str: 0.9, mid: null }),             // stored before n existed
      real: verdict({ sv, pct: 92, inl: 300, tiles: 600, str: 0.95, mid: 0.9, n: 1100 }),
      headline: verdict({ sv, pct: 55, inl: 120, tiles: 300, str: 0.93, mid: 0.6, n: 1000 }),
    };
  }, vSrc);
  console.log(JSON.stringify(vd));
  ok(vd.dot === 'no' && vd.oldDot === 'no' && vd.real === 'same' && vd.headline === 'maybe', 'Photo check: a tiny shared area is Different photo; real copies still Same / Maybe');
  const dot = await page.evaluate(async () => {
    const cs = (await FC.DB.all('copies')).filter(c => c.status === 'new').slice(0, 3);
    const st = (await FC.DB.all('copies')).find(c => c.status === 'stolen');
    cs[0].tiles = 2; cs[0].pct = 100; cs[1].tiles = 2; cs[1].by = 'a search (added by hand)'; st.tiles = 2;
    await FC.DB.putMany('copies', [cs[0], cs[1], st]); FC.touch('copies');
    await FC.meta.set('dotFix', ''); const n = await FC.dropDotMatches(), again = await FC.dropDotMatches();
    const g = id => FC.DB.get('copies', id).then(c => c.status);
    return { n, again, a: await g(cs[0].id), b: await g(cs[1].id), c: await g(cs[2].id), s: await g(st.id) };
  });
  console.log(JSON.stringify(dot));
  ok(dot.n === 1 && dot.again === 0 && dot.a === 'removed' && dot.b === 'new' && dot.c === 'new' && dot.s === 'stolen', 'Photo check: wrong "dot" matches already found go to Removed once; answered and hand-added copies stay');

  // ---- 4.13.1: no update check at all (Ben hands out new versions himself)
  ok(await page.evaluate(() => typeof ppUpCheck === 'undefined' && typeof PP_UPDATE === 'undefined'), 'Update: PageProof has no update check');
  await page.goto(url('app.html#health')); await page.waitForTimeout(900);
  ok(await page.evaluate(() => !document.querySelector('#updates,[data-act="upzip"],[data-act="upcheck"],[data-act="upgo"]')), 'Update: Is everything working? has no Updates card or Update button');
  // every page still draws
  for (const r of ['home', 'found', 'review', 'clients', 'photos', 'keep', 'owners', 'weekly', 'hidden', 'library', 'settings', 'health', 'skipped', 'whatsnew']) {
    await page.goto(url('app.html#' + r)); await page.waitForTimeout(700);
    const t = await page.evaluate(() => document.getElementById('view').textContent.length);
    if (t < 100) ok(false, 'page ' + r + ' is empty');
  }
  await page.goto(url('app.html#home')); await page.waitForTimeout(900);
  const pop = await ctx.newPage(); await pop.setViewportSize({ width: 380, height: 640 });
  await page.evaluate(() => chrome.storage.local.set({ fcNeedsAllow: Date.now() }));
  await pop.goto(url('popup.html')); await pop.waitForTimeout(1200);
  ok(await pop.evaluate(() => !!document.getElementById('allow')), 'Toolbar menu shows the Allow button when Drive needs its click');
  // 4.13.1: an old saved "newer version" note shows nothing
  await page.evaluate(() => chrome.storage.local.set({ ppUpdate: { at: Date.now(), latest: '99.0.0', has: true, error: '' } }));
  await pop.reload(); await pop.waitForTimeout(1200);
  ok(await pop.evaluate(() => !/is ready|Update/.test(document.body.innerText)), 'Toolbar menu never offers an update');
  // 4.3.3: a folder question the browser never answers must not leave the main page blank
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    await RS_DB.put('handles', 'docs', await root.getDirectoryHandle('PageProof', { create: true }));
    await RS_DB.put('handles', 'fcExtra:Hang test', await root.getDirectoryHandle('Photos', { create: true }));
  });
  const hang = await ctx.newPage();
  await hang.addInitScript(() => { FileSystemHandle.prototype.isSameEntry = () => new Promise(() => {}); FileSystemDirectoryHandle.prototype.resolve = () => new Promise(() => {}); });
  await hang.goto(url('app.html#home')); await hang.waitForTimeout(6000);
  ok(await hang.evaluate(() => document.getElementById('side').textContent.length > 20 && document.getElementById('view').textContent.length > 100), 'Main page draws even when the browser never answers a folder question');
  await hang.close();
  // 4.3.4: Google Drive (or the Documents folder) stops answering every question: every page still opens
  const stuck = await ctx.newPage();
  await stuck.addInitScript(() => {
    const never = () => new Promise(() => {});
    const H = FileSystemHandle.prototype, D = FileSystemDirectoryHandle.prototype;
    H.isSameEntry = never; H.queryPermission = never; D.resolve = never; D.getFileHandle = never; D.getDirectoryHandle = never;
    D.entries = function () { return { next: never, [Symbol.asyncIterator]() { return this; } }; };
    D.values = D.entries; D.keys = D.entries;
  });
  for (const r of ['home', 'found', 'review', 'searches', 'clients', 'skipped', 'keep', 'settings', 'health']) {
    await stuck.goto(url('app.html#' + r)); await stuck.waitForTimeout(r === 'home' ? 14000 : 10000);
    const fr = stuck.frames().find(x => /revsearch\.html/.test(x.url()));
    const t = r === 'searches' && fr ? await fr.evaluate(() => document.body.innerText.length) : await stuck.evaluate(() => document.getElementById('view').textContent.length);
    ok(t > 100, 'Page ' + r + ' opens even when Google Drive never answers');
  }
  // 4.4.3: Keep searching runs in a pinned tab (no extra window); closing it shows Start it again
  {
    const sw = ctx.serviceWorkers()[0];
    const kv = await page.evaluate(async () => (await chrome.storage.local.get('fcKeep')).fcKeep);
    await page.evaluate(() => chrome.storage.local.set({ ppSearchPlace: 'pinned', fcKeep: { ...(window.__k = {}), on: true } }));   // 4.57: the pinned-tabs choice (window is checked in checks-searchwin.js)
    await page.waitForTimeout(2000);
    await sw.evaluate(() => keepAlive(false, true)); await page.waitForTimeout(4000);
    const info = await sw.evaluate(async () => ({ pinned: (await chrome.tabs.query({ pinned: true })).length, popups: (await chrome.windows.getAll({ windowTypes: ['popup'] })).length }));
    ok(info.pinned >= 1 && info.popups === 0, 'Keep searching opens as a pinned tab, not a separate window');
    // 4.15: closed by hand it comes back by itself; closed three times in 10 minutes it stays closed.
    for (let i = 0; i < 3; i++) {
      let rp = null; for (let t = 0; t < 16 && !rp; t++) { rp = ctx.pages().find(x => x.url().includes('runner.html')); if (!rp) await page.waitForTimeout(500); }
      if (rp) await rp.close();
      await page.waitForTimeout(3000);
    }
    await page.goto(url('app.html#keep')); await page.waitForTimeout(2000);
    ok(await page.evaluate(() => /Keep searching is stopped/.test(document.body.textContent) && !!document.querySelector('.kbar [data-act="keepshow"]')), 'Closing the pinned tab shows Keep searching is stopped with Start it again');
    await page.evaluate(() => document.querySelector('.kbar [data-act="keepshow"]').click()); await page.waitForTimeout(4000);
    ok(ctx.pages().some(x => x.url().includes('runner.html')), 'Start it again opens the pinned tab again');
    for (const x of ctx.pages()) if (x.url().includes('runner.html')) await x.close();
    await page.evaluate(k => chrome.storage.local.set({ fcKeep: k || { on: false } }), kv);
  }
  // 4.3.7: after an update, the folders are checked first
  await page.evaluate(() => chrome.storage.local.set({ ppReconnectVer: '0.0.1' }));
  const rc = await ctx.newPage();
  await rc.goto(url('app.html#found')); await rc.waitForTimeout(4000);
  ok(await rc.evaluate(() => location.hash === '#reconnect' && /Reconnect your folders/.test(document.body.textContent) && /Connected/.test(document.getElementById('view').textContent)), 'After an update PageProof opens Reconnect your folders and shows Drive connected');
  await rc.evaluate(() => document.querySelector('[data-act="rcdone"]').click()); await rc.waitForTimeout(1500);
  ok(await rc.evaluate(async () => location.hash === '#home' && (await chrome.storage.local.get('ppReconnectVer')).ppReconnectVer === chrome.runtime.getManifest().version), 'Continue goes Home and is not asked again for this version');
  await rc.close();
  // 4.3.6: when Drive answers with an error, the red bar says what it was
  const bad = await ctx.newPage();
  await bad.addInitScript(() => {
    const D = FileSystemDirectoryHandle.prototype;
    const boom = () => Promise.reject(new DOMException('The drive is not ready (test)', 'NotReadableError'));
    D.getDirectoryHandle = boom; D.entries = function () { return { next: boom, [Symbol.asyncIterator]() { return this; } }; };
  });
  await bad.goto(url('app.html#found')); await bad.waitForTimeout(1500);
  await bad.evaluate(() => ACTS.driveretry()); await bad.waitForTimeout(1500);
  ok(await bad.evaluate(() => /What happened:.*NotReadableError/.test(document.getElementById('view').textContent) && !!document.querySelector('[data-act="drivepick"]')), 'Red bar shows what Drive answered and offers Pick the photos folder again');
  await bad.close();
  await stuck.close();
  // 4.3.5: Drive is up but listing the top folder is slow (a minute on a big shared drive): pages draw at once, no red bar
  const slow = await ctx.newPage();
  await slow.addInitScript(() => {
    const D = FileSystemDirectoryHandle.prototype, orig = D.entries;
    D.entries = function () { const it = orig.call(this); return { next: () => new Promise(r => setTimeout(() => r(it.next()), 20000)), [Symbol.asyncIterator]() { return this; } }; };
  });
  for (const r of ['found', 'clients', 'keep']) {
    const t0 = Date.now();
    await slow.goto(url('app.html#' + r));
    await slow.waitForFunction(() => document.getElementById('view').textContent.length > 100, null, { timeout: 15000 }).catch(() => {});
    const ms = Date.now() - t0, txt = await slow.evaluate(() => document.getElementById('view').textContent);
    ok(ms < 6000 && !/isn't answering/.test(txt), 'Page ' + r + ' opens quickly with no red bar when Drive is only slow (' + ms + ' ms)');
  }
  await slow.close();
  await page.evaluate(async () => { await RS_DB.del('handles', 'docs'); await RS_DB.del('handles', 'fcExtra:Hang test'); });
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await ctx.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
