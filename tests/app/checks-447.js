// 4.47 photo checker release (mechanics review, Ben's picks): the second look for close Same
// calls, a second chance for Google's exact matches, your own real test set (kept in
// Documents\PageProof\checker-tests, here a made-up folder), checker vs your answers by kind of
// site, and the match picture in the Evidence report. Made-up pictures only (pp-selftest.js).
const { start } = require('./h.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  page.on('console', m => { if (m.type() === 'error') console.log('console:', m.text().slice(0, 200)); });

  // ---- the answer rules
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const S = { pct: 92, inl: 40, tiles: 60, str: 0.9, mid: 0.8, n: 100 };
    const thin = { ...S, pct: 78, inl: 16, tiles: 25 };
    const no = { pct: 5, inl: 2, tiles: 3, str: 0.5, mid: 0.1, n: 100 };
    const may = { pct: 55, inl: 14, tiles: 20, str: 0.85, mid: 0.6, n: 100 };
    return {
      sure: PP_VERDICT.close(S), thin: PP_VERDICT.close(thin), notSame: PP_VERDICT.close(may),
      kept: PP_VERDICT.second(thin, S, false).how, out: PP_VERDICT.second(thin, no, false).how, maybe: PP_VERDICT.second(thin, may, false).how,
      saved: PP_VERDICT.second(no, S, true).how, exactNo: PP_VERDICT.second(no, no, true).how, plainNo: PP_VERDICT.second(no, S, false).how,
      noDeep: PP_VERDICT.second(thin, null, false).how,
    };
  });
  ok(!r.sure && r.thin && !r.notSame, 'only a Same photo with a thin margin gets the second look');
  ok(r.kept === 'kept' && r.out === 'out' && r.maybe === 'maybe', 'the second look keeps it, makes it Maybe or throws it out: ' + [r.kept, r.out, r.maybe].join(', '));
  ok(r.saved === 'saved' && r.exactNo === 'exactNo' && r.plainNo === '' && r.noDeep === '', 'an exact match the fast check missed is saved; others are left alone: ' + [r.saved, r.exactNo, r.plainNo || '-', r.noDeep || '-'].join(', '));

  // ---- the second look with real (made-up) pictures, on the search results page
  const rs = await ctx.newPage();
  rs.on('pageerror', e => { fails++; console.log('PAGEERROR revsearch', String(e).slice(0, 300)); });
  await rs.goto(url('revsearch.html')); await rs.waitForTimeout(1200);
  await rs.addScriptTag({ url: url('pp-selftest.js') });
  const sl = await rs.evaluate(async () => {
    const jpeg = async c => new Blob([await (await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 })).arrayBuffer()], { type: 'image/jpeg' });
    const dataUrl = b => new Promise(res => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(b); });
    const A = PP_SELFTEST.draw(2), other = PP_SELFTEST.draw(11);
    const crop = PP_SELFTEST.copyOf(A, 'crop', 2).c;
    // A tiny thumbnail of a tight crop: the kind of picture Google calls exact and a fast check can miss.
    const tiny = new OffscreenCanvas(150, Math.round(150 * crop.height / crop.width)); tiny.getContext('2d').drawImage(crop, 0, 0, tiny.width, tiny.height);
    const p = { i: 0, blob: await jpeg(A), links: [], runs: {} };
    const fakeNo = { pct: 0, inl: 0, tiles: 0, str: 0, mid: null, n: 0, sv: SCORE_VERSION };
    // 4.52: the slow look only when the fast check saw a few matching details.
    const fewNo = { pct: 0, inl: 8, tiles: 8, str: 0.5, mid: null, n: 100, sv: SCORE_VERSION };
    const thin = { pct: 78, inl: 16, tiles: 25, str: 0.9, mid: 0.8, n: 100, sv: SCORE_VERSION };
    const cropUrl = await dataUrl(await jpeg(crop)), otherUrl = await dataUrl(await jpeg(other)), tinyUrl = await dataUrl(await jpeg(tiny));
    const a = await secondLook(p, { url: 'https://news-example.com/a', img: '', thumb: tinyUrl, exact: true, gx: true, engines: ['google'] }, fewNo);
    const a0 = await secondLook(p, { url: 'https://news-example.com/a0', img: '', thumb: tinyUrl, exact: true, gx: true, engines: ['google'] }, fakeNo);
    const b = await secondLook(p, { url: 'https://blog-example.com/b', img: otherUrl, engines: ['bing'] }, thin);
    const c = await secondLook(p, { url: 'https://blog-example.com/c', img: cropUrl, engines: ['bing'] }, thin);
    const d = await secondLook(p, { url: 'https://blog-example.com/d', img: otherUrl, exact: true, gx: true, engines: ['google'] }, fewNo);
    const e = await secondLook(p, { url: 'https://blog-example.com/e', img: otherUrl, engines: ['bing'] }, fakeNo);
    return { a0: a0 === fakeNo, a: [a.second, PP_VERDICT.score(a), a.pct], b: [b.second, PP_VERDICT.score(b), b.pct], c: [c.second, PP_VERDICT.score(c), c.pct], d: [d.second, PP_VERDICT.score(d)], e: [e.second || '', e === fakeNo] };
  });
  ok(sl.a[0] === 'saved' && ['same', 'maybe'].includes(sl.a[1]), 'Google said exact, the fast check said Different: the full-size look saves it: ' + sl.a.join(' '));
  ok(sl.a0, 'Google said exact but nothing at all lined up: no slow second look (4.52)');
  ok(sl.b[0] === 'out' && sl.b[1] === 'no', 'a close Same that is another picture is thrown out on the second look: ' + sl.b.join(' '));
  ok(sl.c[0] === 'kept' && sl.c[1] === 'same', 'a close Same that is a real copy is kept: ' + sl.c.join(' '));
  ok(sl.d[0] === 'exactNo' && sl.d[1] === 'no', 'an exact match that really is another picture stays thrown out, marked: ' + sl.d.join(' '));
  ok(sl.e[0] === '' && sl.e[1], 'a plain Different (not exact) gets no second look');
  // The thrown-out list says "Google said exact".
  const tag = await rs.evaluate(() => { const row = rowFor({ name: 'x.jpg' }, { url: 'https://n.example.com/a', site: 'n.example.com', engines: ['google'], exact: true, second: 'exactNo', pct: 3, inl: 1, tiles: 2, str: 0.4, mid: 0.1, n: 90, sv: SCORE_VERSION }); return row.textContent; });
  ok(/Google said exact/.test(tag) && /Different photo/.test(tag), 'the thrown-out row says "Google said exact": ' + tag.replace(/\s+/g, ' ').slice(0, 90));
  await rs.close();

  // ---- your own real test set
  const ct = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const docs = await root.getDirectoryHandle('PageProof', { create: true });
    await RS_DB.put('handles', 'docs', docs);
    const jpeg = async c => new Blob([await (await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 })).arrayBuffer()], { type: 'image/jpeg' });
    const dataUrl = b => new Promise(res => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(b); });
    const A = PP_SELFTEST.draw(3), other = PP_SELFTEST.draw(12), copy = PP_SELFTEST.copyOf(A, 'small', 3).c;
    const pid = 'd:Test Client/2026/Q4/a.jpg';
    await FC.DB.put('clients', { name: 'Test Client', searching: true, licensed: [], photos: 1 });
    await FC.DB.put('photos', { id: pid, client: 'Test Client', name: 'a.jpg', rel: '', thumb: await dataUrl(await jpeg(A)), searches: 1 });
    const C = (site, img, extra) => ({ id: pid + '|' + site + '/p', photo: pid, client: 'Test Client', url: 'https://' + site + '/p', key: site + '/p', site, img, thumb: '', engines: ['bing'], match: 'same', pct: 80, firstSeen: new Date().toISOString(), status: 'new', ...extra });
    // 1. You remove a Same photo that is really another picture: a "different" pair.
    await FC.DB.put('copies', C('wrong-example.com', await dataUrl(await jpeg(other))));
    await FC.answer([pid + '|wrong-example.com/p'], 'removed');
    // 2. "It is a copy" on one the checker threw out: a "copy" pair (your photo comes from the search page).
    await FC.rescue({ i: 0, name: 'a.jpg', client: 'Test Client', blob: await jpeg(A), rel: 'Test Client/2026/Q4/a.jpg' }, { url: 'https://missed-example.com/p', key: 'missed-example.com/p', site: 'missed-example.com', img: await dataUrl(await jpeg(copy)), engines: ['google'], pct: 10 }, 'a search').catch(e => 'rescue: ' + e.message);
    // 3. A Remove that is undone later: its pair is left out of the test.
    await FC.DB.put('copies', C('undone-example.com', await dataUrl(await jpeg(other))));
    const undo = await FC.answer([pid + '|undone-example.com/p'], 'removed');
    // 4. (4.52) Stolen on a Same photo: kept too, as a real copy.
    await FC.DB.put('copies', C('thief-example.com', await dataUrl(await jpeg(copy))));
    await FC.answer([pid + '|thief-example.com/p'], 'stolen');
    await PP_CTESTS._drain();
    await undo();
    const dir = await PP_CTESTS.folder(false);
    const names = []; for await (const [n] of dir.entries()) names.push(n);
    const list = await PP_CTESTS.list();
    const run = await PP_CTESTS.run();
    return { n: names.length, files: list.length ? (await (async () => { const f = []; for await (const [n] of list[0].dir.entries()) f.push(n); return f.sort().join(','); })()) : '', truths: list.map(x => x.info.truth).sort().join(','), kinds: list.map(x => x.info.kind).join(','), run, count: await PP_CTESTS.count() };
  });
  ok(ct.n === 4 && ct.files === 'ours.jpg,pair.json,theirs.jpg', 'each answer keeps a small pair in Documents\\PageProof\\checker-tests: ' + ct.n + ' pairs (' + ct.files + ')');
  ok(ct.truths === 'copy,copy,different,different', 'what you said is kept with each pair: ' + ct.truths);
  ok(ct.run.n === 3 && ct.run.skipped === 1, 'the test runs the pairs you still agree with (the undone Remove is left out): ' + JSON.stringify(ct.run));
  ok(ct.run.right === 3, 'the checker gets all real pairs right: ' + ct.run.right + ' of ' + ct.run.n);

  // ---- How PageProof is doing: real pairs in the checker test, and where the checker goes wrong
  await page.evaluate(async () => {
    const pid = 'd:Test Client/2026/Q4/a.jpg', now = new Date().toISOString();
    const C = (site, status, match, extra) => ({ id: pid + '|' + site, photo: pid, client: 'Test Client', url: 'https://' + site + '/x', key: site, site, engines: ['bing'], match, pct: 90, firstSeen: now, answered: now, status, ...extra });
    const rows = [];
    for (let i = 0; i < 6; i++) rows.push(C('dailynews' + i + '-example.com', i < 5 ? 'stolen' : 'removed', 'same'));
    for (let i = 0; i < 6; i++) rows.push(C('instagram.com', i < 3 ? 'stolen' : 'removed', 'same', { id: pid + '|ig' + i, url: 'https://instagram.com/p/' + i }));
    rows.push(C('shop-example.com/product/1', 'stolen', 'maybe', { url: 'https://shop-example.com/product/1' }));
    await FC.DB.putMany('copies', rows); FC.touch('copies');
    await PP_STATS.setMeta('realtest', { n: 10, right: 8, wrongKept: 1, missed: 1, byKind: { news: { n: 6, right: 5 }, social: { n: 4, right: 3 } }, at: Date.now() });
    await PP_STATS.setMeta('test', { at: Date.now(), n: 72, right: 72, groups: {}, ms: 100, fast: true, gpu: false, v: 1 });
  });
  await page.goto(url('app.html#stats')); await page.waitForTimeout(3500);
  const st = await page.evaluate(() => document.body.innerText);
  ok(/Your real pairs/.test(st) && /8 of 10 right/.test(st) && /News sites 5 of 6/.test(st), 'the checker test card shows your real pairs');
  ok(/Where the checker goes wrong/.test(st) && /Social media/.test(st) && /News sites/.test(st) && /Shops and ads/.test(st), 'the table shows the checker\'s answers next to yours by kind of site');
  ok(/Most room to improve: Social media/.test(st), 'it names the kind of site with the most wrong Same answers');
  const file = await page.evaluate(async () => PP_REPORT.text ? PP_REPORT.text(await PP_REPORT.model('30')) : '');
  if (file) ok(/Your real pairs: 8 of 10/.test(file) && /by kind of site/.test(file), 'the stats file for Claude has both (numbers only)');

  // ---- the match picture in the Evidence report
  const ev = await page.evaluate(async () => {
    const jpeg = async c => new Blob([await (await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 })).arrayBuffer()], { type: 'image/jpeg' });
    const dataUrl = b => new Promise(res => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(b); });
    const A = PP_SELFTEST.draw(4), copy = PP_SELFTEST.copyOf(A, 'headline', 4).c, other = PP_SELFTEST.draw(13);
    const ours = { blob: await jpeg(A), name: 'a.jpg', w: A.width, h: A.height, hash: 'ab'.repeat(32), client: 'Test Client', meta: null };
    const base = { url: 'https://news-example.com/story', site: 'news-example.com', engines: ['bing'], firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString(), times: 1, match: 'same', pct: 88 };
    const r1 = await PP_EVIDENCE.make(ours, { ...base, img: await dataUrl(await jpeg(copy)) });
    const r2 = await PP_EVIDENCE.make(ours, { ...base, img: await dataUrl(await jpeg(other)) });
    const pages = async b => ((await b.text()).match(/\/Type\s*\/Page[^s]/g) || []).length;
    return { m: r1.match, p1: await pages(r1.blob), p2: await pages(r2.blob), m2: r2.match };
  });
  ok(ev.m && ev.m.details >= 20 && ev.m.pct >= 50 && ev.p1 === 2, 'the report gets a second page with the match: ' + JSON.stringify(ev));
  ok(!ev.m2 && ev.p2 === 1, 'two different pictures get no match page');

  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await ctx.close();
  process.exit(fails ? 1 : 0);
})();
