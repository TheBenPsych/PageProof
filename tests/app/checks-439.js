// 4.39 safety release (mechanics review, Ben's picks): room to grow (unlimited storage, failed
// saves noticed), error diary in the stats, backups keep the search history, moved or renamed
// photos keep their history, a ticked folder that went missing, timestamp retries + spares, and
// the check-up after every update. Made-up photos and sites only; no real Drive or services.
const { start } = require('./h.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  await page.evaluate(async () => {
    await chrome.storage.local.set({ ppSetupDone: true, ppTourDone: true, ppSeenVersion: chrome.runtime.getManifest().version, ppReconnectVer: chrome.runtime.getManifest().version,
      ppCheckup: { ver: chrome.runtime.getManifest().version, at: Date.now(), items: [['Saving to the browser', true, '']], ok: true, seen: true } });
  });

  // ---- 1. room to grow
  const g = await page.evaluate(async () => ({ perm: chrome.runtime.getManifest().permissions.includes('unlimitedStorage'), guard: typeof PP_GUARD, wrapped: !!chrome.storage.local.__ppGuard }));
  ok(g.perm, 'the manifest asks for unlimited storage (no new warning when installing)');
  ok(g.guard === 'object' && g.wrapped, 'every page loads the safety nets, and saves to the browser are watched');
  const f = await page.evaluate(async () => {
    await PP_GUARD.saveFailed(new Error('QUOTA_BYTES quota exceeded'));
    const a = await PP_GUARD.lastFail();
    const m = await PP_REPORT.model('7', { light: true });
    return { a, alert: m.alerts.find(x => /could not save/.test(x[1])) };
  });
  ok(f.a && f.a.n === 1 && f.a.quota, 'a failed save is written down (outside the full storage), and a full storage is recognised');
  ok(f.alert && f.alert[0] === 'bad' && /full/.test(f.alert[2]), 'a failed save becomes a red "looks off" line (shown on Home): ' + (f.alert && f.alert[1]));
  await page.goto(url('app.html#health?tab=space')); await page.waitForTimeout(3500);
  const h = await page.evaluate(() => ({ g: (document.getElementById('stGuard') || {}).textContent || '', fail: !!document.getElementById('stFail') }));
  ok(/no size limit/.test(h.g) && h.fail, 'Is everything working shows the storage line and the failed save: ' + h.g.replace(/\s+/g, ' '));
  await page.evaluate(() => PP_GUARD.clearFail());

  // ---- 2. error diary
  const d = await page.evaluate(async () => {
    console.warn('PageProof test place:', new Error('Could not read "Secret Client Name" at https://example.com/a.jpg from C:\\Users\\Me\\photo.jpg'));
    console.warn('PageProof test place:', 'again');
    await PP_GUARD.flush();
    const list = await PP_GUARD.diary(7);
    const m = await PP_REPORT.model('7');
    return { e: list.find(x => x.place === 'PageProof test place'), text: await PP_REPORT.text(m) };
  });
  ok(d.e && d.e.n === 2, 'quiet warnings are counted by where they happened: ' + JSON.stringify(d.e));
  ok(d.e && !/Secret|example\.com|Users/.test(d.e.msg) && /<…>/.test(d.e.msg), 'names, links and folder paths are taken out of the message: ' + (d.e && d.e.msg));
  ok(/What went wrong/.test(d.text) && /PageProof test place: 2 times/.test(d.text) && /Storage/.test(d.text), 'Save stats for Claude has a What went wrong section and a Storage line');

  // ---- 3. backups keep the search history
  const b = await page.evaluate(async () => {
    const P = (id, extra) => ({ id, client: 'Client A', name: id.split('/').pop(), rel: id.slice(2), folder: 'x', year: 2026, quarter: 3, flag: '', searches: 0, empty: 0, copies: 0, stolen: 0, added: 1, ...extra });
    await FC.DB.put('clients', { name: 'Client A', searching: true, priority: false, licensed: [], photos: 3 });
    await FC.DB.putMany('photos', [P('d:Client A/2026/Q3/one.jpg', { lastSearched: '2026-11-20T10:00:00.000Z', searches: 3, empty: 1, firstAt: '2026-10-01T10:00:00.000Z' }), P('d:Client A/2026/Q3/two.jpg', { lastSearched: '2026-11-21T10:00:00.000Z', searches: 1 }), P('d:Client A/2026/Q3/three.jpg')]);
    await FC.meta.set('histBackup', null);
    const snap = await FC.settingsSnapshot();
    // A new computer: photos not read yet.
    await FC.DB.delMany('photos', ['d:Client A/2026/Q3/one.jpg', 'd:Client A/2026/Q3/two.jpg', 'd:Client A/2026/Q3/three.jpg']);
    await FC.restore(JSON.parse(JSON.stringify(snap)));
    const pending = ((await FC.meta.get('pendingHist')) || []).length;
    // The folders are read: the photos come back with no history, then the history is put back.
    await FC.DB.putMany('photos', [P('d:Client A/2026/Q3/one.jpg'), P('d:Client A/2026/Q3/two.jpg', { lastSearched: '2026-11-23T10:00:00.000Z', searches: 2 }), P('d:Client A/2026/Q3/three.jpg')]);
    await FC.applyPendingFlags();
    const [one, two, three] = await FC.DB.getMany('photos', ['d:Client A/2026/Q3/one.jpg', 'd:Client A/2026/Q3/two.jpg', 'd:Client A/2026/Q3/three.jpg']);
    return { n: snap.hist.length, pending, one, two, three, left: ((await FC.meta.get('pendingHist')) || []).length };
  });
  ok(b.n === 2, 'the backup holds when each searched photo was searched (2 of 3)');
  ok(b.pending === 2 && b.left === 0, 'restored before the folders are read, the history waits and is put back afterwards');
  ok(b.one.lastSearched === '2026-11-20T10:00:00.000Z' && b.one.searches === 3 && b.one.empty === 1 && b.one.firstAt === '2026-10-01T10:00:00.000Z', 'a restored photo counts as searched, with its dates and counts');
  ok(b.two.lastSearched === '2026-11-23T10:00:00.000Z' && b.two.searches === 2, 'a photo searched here since the backup keeps its own newer date');
  ok(!b.three.lastSearched, 'a photo never searched stays never searched');

  // ---- 4. moved or renamed photos keep their history
  const mv = await page.evaluate(async () => {
    const P = (id, extra) => ({ id, client: 'Client A', name: id.split('/').pop(), rel: id.slice(2), folder: 'x', year: 2026, quarter: 3, flag: '', searches: 0, empty: 0, copies: 0, stolen: 0, ...extra });
    const gen = Date.now();
    await FC.DB.putMany('photos', [
      P('d:Client A/2026/Q3/parade 01.jpg', { added: 1, gone: true, lastSearched: '2026-11-10T10:00:00.000Z', searches: 2, copies: 1, flag: 'hi' }),
      P('d:Client A/2026/Q3/IMG_0001.jpg', { added: 1, gone: true, lastSearched: '2026-11-10T10:00:00.000Z', searches: 1 }),
      P('d:Client A/2026/Q3 - Sports/parade 01.jpg', { added: gen }),
      P('d:Client A/2026/Q3 - Sports/IMG_0001.jpg', { added: gen }),
      P('d:Client A/2026/Q4/IMG_0001.jpg', { added: gen }),
    ]);
    await FC.DB.put('copies', { id: 'd:Client A/2026/Q3/parade 01.jpg|site.com/p', photo: 'd:Client A/2026/Q3/parade 01.jpg', client: 'Client A', url: 'https://site.com/p', key: 'site.com/p', site: 'site.com', status: 'stolen' });
    const n = await FC.followMoves(gen, ['d:Client A/'], {});
    const old = await FC.DB.get('photos', 'd:Client A/2026/Q3/parade 01.jpg');
    const dup = await FC.DB.get('photos', 'd:Client A/2026/Q3 - Sports/parade 01.jpg');
    const img = await FC.DB.get('photos', 'd:Client A/2026/Q3 - Sports/IMG_0001.jpg');
    return { n, old, dup: !!dup, img: !!img, alias: await FC.meta.get('photoAlias'), note: await FC.movedNote(), copies: (await FC.copiesOf(old)).length };
  });
  ok(mv.n === 1 && !mv.dup, 'a photo that moved (one of a kind by name) is recognised, and no second record is made');
  ok(mv.old.rel === 'Client A/2026/Q3 - Sports/parade 01.jpg' && !mv.old.gone && mv.old.flag === 'hi' && mv.old.searches === 2 && mv.old.lastSearched, 'it keeps its flag, search dates and counts, at its new address');
  ok(mv.alias['d:Client A/2026/Q3 - Sports/parade 01.jpg'] === 'd:Client A/2026/Q3/parade 01.jpg', 'the new address points at the old record for later folder reads');
  ok(mv.copies === 1, 'its copies (a Stolen one) still belong to it');
  ok(mv.img, 'a file name used more than once (IMG_0001.jpg) is never guessed');
  ok(mv.note && mv.note.n === 1, 'Home is told how many photos moved');
  await page.evaluate(() => FC.meta.set('missingPicks', [{ rel: 'Photos/24. Lakeside Weekly', since: new Date().toISOString() }]));
  await page.goto(url('app.html#home')); await page.waitForTimeout(2500);
  const jobs = await page.evaluate(() => [...document.querySelectorAll('#homeJobs .job')].map(j => j.id + ' ' + j.className + ' ' + j.textContent.replace(/\s+/g, ' ').slice(0, 90)));
  ok(jobs.some(j => /^jobMissing .*lvl-bad.*can't be found.*Lakeside Weekly/.test(j)), 'Home shows a red line for a ticked folder that went missing');
  ok(jobs.some(j => /^jobMoved .*lvl-info.*moved or renamed/.test(j)), 'Home says photos moved and kept their history');
  const order = jobs.map(j => /lvl-bad/.test(j) ? 0 : /lvl-warn/.test(j) ? 1 : /lvl-info/.test(j) ? 2 : 3);
  ok(order.every((v, i) => !i || v >= order[i - 1]), 'Home lines stay most urgent first: ' + order.join(''));

  // ---- 5. timestamps: tries again, then spares
  const t = await page.evaluate(async () => {
    let calls = {};
    const realFetch = window.fetch;
    window.fetch = async (u, o) => {
      calls[u] = (calls[u] || 0) + 1;
      if (/slow/.test(u) && calls[u] < 3) throw new Error('timeout');
      if (/dead/.test(u)) throw new Error('no answer');
      return new Response(new Uint8Array([0x30, 5, 0x30, 3, 2, 1, 0]), { status: 200 });
    };
    globalThis.PP_TSA_WAITS = [5, 5];
    globalThis.PP_TSA_SERVICES = [{ name: 'A', file: 'a', url: 'http://ok.test/' }, { name: 'B', file: 'b', url: 'http://slow.test/' }, { name: 'C', file: 'c', url: 'http://dead.test/' }];
    globalThis.PP_TSA_SPARES = [{ name: 'S1', file: 's1', url: 'http://dead2.test/' }, { name: 'S2', file: 's2', url: 'http://spare.test/' }];
    const r = await PP_TSA.stampAll(new Uint8Array(32));
    window.fetch = realFetch;
    delete globalThis.PP_TSA_SERVICES; delete globalThis.PP_TSA_SPARES; delete globalThis.PP_TSA_WAITS;
    return { r: r.map(x => [x.service, !x.error, x.tries, !!x.spare]), calls };
  });
  const by = Object.fromEntries(t.r.map(x => [x[0], x]));
  ok(by.B && by.B[1] && by.B[2] === 3, 'a slow service is asked again and its stamp is kept on the 3rd try');
  ok(by.C && !by.C[1] && by.C[2] === 3, 'a dead service is tried 3 times, then left out with its error');
  ok(by.S1 && !by.S1[1] && by.S2 && by.S2[1] && by.S2[3], 'spares are asked one by one until there are 3 stamps: ' + JSON.stringify(t.r));
  const rd = await page.evaluate(() => fetch('readme-template.js').then(r => r.text()));
  ok(/GlobalSign Root CA/.test(rd) && /Entrust Root/.test(rd), 'the README names the spare services\' root certificates');

  // ---- 6. check-up after an update
  await page.goto(url('app.html#home')); await page.waitForTimeout(800);
  await page.evaluate(async () => {
    await chrome.storage.local.remove('ppCheckup');
    globalThis.PP_TSA_SERVICES = [{ name: 'A', file: 'a', url: 'http://127.0.0.1:9/' }];
    globalThis.PP_TSA_WAITS = [];
    globalThis.PP_TSA_SPARES = [];
    window.fetch = async u => (/127\.0\.0\.1/.test(u) ? Promise.reject(new Error('no answer')) : new Response('ok', { status: 200 }));
    await PP_CHECKUP.run();
  });
  await page.waitForTimeout(1500);
  const cu = await page.evaluate(async () => ({ c: (await chrome.storage.local.get('ppCheckup')).ppCheckup, line: (document.getElementById('checkupBad') || {}).textContent || '' }));
  const names = (cu.c && cu.c.items || []).map(i => i[0] + (i[1] ? ' ok' : ' FAILED'));
  ok(cu.c && cu.c.ver && names.some(n => /Photo checker test ok/.test(n)) && names.some(n => /Saving to the browser ok/.test(n)) && names.some(n => /Bing page ok/.test(n)), 'the check-up runs the checker test, a save and the search site pages: ' + names.join(', '));
  ok(cu.c && !cu.c.ok && /Trusted timestamps/.test(cu.line) && /did not work/.test(cu.line), 'what failed is named on Home in red: ' + cu.line.replace(/\s+/g, ' ').slice(0, 140));

  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await ctx.close();
  process.exit(fails ? 1 : 0);
})();
