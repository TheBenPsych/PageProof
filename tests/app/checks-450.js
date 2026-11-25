// Checks for 4.50 (search pipeline review, Ben's picks): the background clock for search tabs,
// Google exact matches read on their page, posts whose cover is another picture kept for the post
// check, no slow second look for plainly different Yandex/Bing links, the download reused for the
// second look, and the numbers-only answers table in the stats file.
// Pretend sites only (answered by the test, the internet is never used).
const { start } = require('./h.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e.stack || e).slice(0, 600)); });
  await page.goto(url('revsearch.html?job=none')); await page.waitForTimeout(800);

  // ---- 1. the background clock answers a search tab's "wake me in N ms"
  const clk = await page.evaluate(async () => { const t0 = Date.now(); const r = await chrome.runtime.sendMessage({ type: 'rsSleep', ms: 300 }); return { r, ms: Date.now() - t0 }; });
  ok(clk.r === true && clk.ms >= 280 && clk.ms < 2000, 'the background clock answers after the wait asked for (' + clk.ms + ' ms)');

  // Pictures made in the page: "ours" (the client's photo), a crop of it, and "other".
  const pics = await page.evaluate(async () => {
    const draw = async (seedN, crop) => { let s = seedN; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647; const cv = new OffscreenCanvas(800, 600), g = cv.getContext('2d'); g.fillStyle = '#ddd'; g.fillRect(0, 0, 800, 600); for (let i = 0; i < 400; i++) { g.fillStyle = `hsl(${rnd() * 360},70%,${25 + rnd() * 50}%)`; g.fillRect(rnd() * 800, rnd() * 600, 8 + rnd() * 50, 8 + rnd() * 50); } if (!crop) return cv.convertToBlob({ type: 'image/jpeg', quality: 0.9 }); const c2 = new OffscreenCanvas(560, 420); c2.getContext('2d').drawImage(cv, 120, 90, 560, 420, 0, 0, 560, 420); return c2.convertToBlob({ type: 'image/jpeg', quality: 0.9 }); };
    const b64 = async b => btoa(String.fromCharCode(...new Uint8Array(await b.arrayBuffer())));
    const ours = await draw(7), crop = await draw(7, true), other = await draw(99);
    window.__ours = ours;
    return { ours: await b64(ours), crop: await b64(crop), other: await b64(other) };
  });
  const IMG = { crop: Buffer.from(pics.crop, 'base64'), other: Buffer.from(pics.other, 'base64') };
  let fetched = {};
  await ctx.route(/^https:\/\/(news\.example|pics\.example|www\.instagram\.com)\//, route => {
    const u = route.request().url();
    fetched[u] = (fetched[u] || 0) + 1;
    if (/crop\.jpg/.test(u)) return route.fulfill({ status: 200, contentType: 'image/jpeg', body: IMG.crop });
    if (/other\.jpg/.test(u)) return route.fulfill({ status: 200, contentType: 'image/jpeg', body: IMG.other });
    if (u === 'https://news.example/story') return route.fulfill({ status: 200, contentType: 'text/html', body: '<html><head><meta property="og:image" content="/img/other.jpg"></head><body><article><img src="/img/crop.jpg" width="800" height="600"></article></body></html>' });
    return route.fulfill({ status: 404, contentType: 'text/html', body: 'no' });
  });

  const r = await page.evaluate(async () => {
    job = { id: 't', pics: [{ i: 0, name: 'ours.jpg', blob: __ours, links: [], runs: {} }], engines: ['google', 'yandex'] };
    const p = job.pics[0];
    const mk = (u, extra) => ({ url: u, key: u, site: new URL(u).hostname, pic: 0, title: '', thumb: '', img: '', engines: ['google'], ...extra });
    // 2. Google said exact; its preview showed a few matching details but does not line up, and the
    // article has ours. (4.52: only when the fast check saw some details.)
    const a = mk('https://news.example/story', { exact: true, gx: true, thumb: 'https://pics.example/other.jpg' });
    const fastFew = { pct: 0, inl: 8, tiles: 8, str: 0.5, mid: null, n: 100, sv: SCORE_VERSION };
    Object.assign(a, { from: 'preview' }, await secondLook(p, a, fastFew, null));
    // 2b. Google said exact, but nothing at all lines up: no slow look, their page is not read.
    const a2 = mk('https://news.example/story2', { exact: true, gx: true, thumb: 'https://pics.example/other.jpg?a2' });
    await scoreLink(a2);
    // 3. An Instagram post that a search site listed, whose cover is another photo.
    const b = mk('https://www.instagram.com/p/ABC123/', { exact: true, engines: ['yandex'], img: 'https://pics.example/other.jpg?ig' });
    await scoreLink(b);
    // ...but an account page (not a post) is not kept that way.
    const b2 = mk('https://www.instagram.com/someone/', { exact: true, engines: ['yandex'], img: 'https://pics.example/other.jpg?acct' });
    await scoreLink(b2);
    // 4. Yandex "exact" link that is plainly another photo: no slow second look.
    const c = mk('https://pics.example/c', { exact: true, engines: ['yandex'], img: 'https://pics.example/other.jpg?y' });
    await scoreLink(c);
    // 5. A close call: the second look opens the same download again, it is not downloaded twice.
    const d = mk('https://pics.example/d', { engines: ['bing'], img: 'https://pics.example/crop.jpg?d' });
    const fast = { pct: 78, inl: 16, tiles: 25, str: 0.9, mid: 0.8, n: 100, sv: SCORE_VERSION };
    const pic = await fetchPicture(d.img);
    const dd = await secondLook(p, d, fast, { url: d.img, pic });
    return {
      a: [a.second, verdict(a), a.from, a.img, a.onPage],
      a2: [verdict(a2), a2.second || ''],
      b: [verdict(b), b.cover, b.img, b.coverImg, b.onPage],
      b2: [verdict(b2), !!b2.cover],
      c: [verdict(c), c.second || ''],
      d: [dd.second, PP_VERDICT.score(dd)],
    };
  });
  ok(r.a[0] === 'page' && ['same', 'maybe'].includes(r.a[1]) && r.a[2] === 'page' && /crop\.jpg$/.test(r.a[3]) && r.a[4] === 'seen', 'Google said exact but its preview is another photo: their page is read and the article picture is the copy (' + r.a.join(' ') + ')');
  ok(r.a2[0] === 'no' && r.a2[1] === '' && !fetched['https://news.example/story2'], 'Google said exact but nothing lines up: no slow look and their page is not read (' + r.a2.join(' ') + ')');
  ok(r.b[0] === 'maybe' && r.b[1] === 1 && r.b[2] === '' && /other\.jpg/.test(r.b[3]) && r.b[4] === 'postOnly', 'a post listed by a search site whose cover is another photo is kept as Maybe for the post check (' + r.b.join(' ') + ')');
  ok(r.b2[0] === 'no' && !r.b2[1], 'an account page with another photo is still thrown out (' + r.b2.join(' ') + ')');
  ok(r.c[0] === 'no' && r.c[1] === '', 'a Yandex "exact" link that is plainly another photo gets no slow second look (' + r.c.join(' ') + ')');
  ok(r.d[0] === 'kept' && r.d[1] === 'same', 'the second look on a close call keeps a real copy (' + r.d.join(' ') + ')');
  ok(fetched['https://pics.example/crop.jpg?d'] === 1, 'the picture is downloaded once for both looks (' + (fetched['https://pics.example/crop.jpg?d'] || 0) + ')');
  ok(!fetched['https://pics.example/other.jpg?y'] || fetched['https://pics.example/other.jpg?y'] === 1, 'the plainly different Yandex picture is downloaded once');

  // The cover flag is remembered with the scores, so a later search keeps it.
  const kept = await page.evaluate(() => SAVE_FIELDS.includes('cover') && SAVE_FIELDS.includes('coverImg'));
  ok(kept, 'the post cover mark is saved with the link\'s scores');

  // ---- 6. Copies found: such a post says "Checking the post" until the post check has looked.
  const app = await ctx.newPage();
  app.on('pageerror', e => { fails++; console.log('PAGEERROR app', String(e.stack || e).slice(0, 600)); });
  await app.goto(url('app.html#help')); await app.waitForTimeout(800);
  const cw = await app.evaluate(() => {
    const c = { id: 'x', url: 'https://www.instagram.com/p/ABC123/', site: 'instagram.com', use: 'social', cover: 1, img: '', status: 'new', match: 'maybe', risk: { level: '', why: [] } };
    const done = { ...c, postChk: { v: POSTCHK_V, state: 'unsure' } };
    return { wait: coverWait(c), after: coverWait(done), sig: signals(c).map(x => x[3]).join(','), pic: theirImg({ ...c, coverImg: 'https://pics.example/cover.jpg' }) };
  });
  ok(cw.wait && !cw.after && /Checking the post/.test(cw.sig), 'Copies found shows "Checking the post" until the post check has looked (' + cw.sig + ')');
  ok(/cover\.jpg/.test(cw.pic), 'while it checks, the row shows the post\'s cover picture instead of a blank (' + cw.pic + ')');

  // ---- 7. the stats file has the checker's numbers for answered copies, with no sites or addresses
  const st = await app.evaluate(async () => {
    const pid = 'd:Test Client/2026/Q4/a.jpg';
    await FC.DB.put('photos', { id: pid, client: 'Test Client', name: 'a.jpg', rel: '', searches: 1 });
    const C = (site, status, extra) => ({ id: pid + '|' + site, photo: pid, client: 'Test Client', url: 'https://' + site + '/p', key: site + '/p', site, img: '', thumb: '', engines: ['google', 'yandex'], exact: true, match: 'same', pct: 81, inl: 22, tiles: 30, str: 0.9, mid: 0.7, from: 'image', firstSeen: new Date().toISOString(), status: 'new', ...extra });
    await FC.DB.put('copies', C('secret-site.example', 'new'));
    await FC.DB.put('copies', C('other-secret.example', 'new', { match: 'maybe', pct: 51 }));
    await FC.answer([pid + '|secret-site.example'], 'stolen');
    await FC.answer([pid + '|other-secret.example'], 'removed');
    const m = await PP_REPORT.model('7');
    const t = await PP_REPORT.text(m);
    return { rows: m.copies.answers, hasSite: /secret-site|other-secret|Test Client|a\.jpg/.test(JSON.stringify(m.copies.answers)), inText: /"answers":\[\[/.test(t), second: /Second looks:/.test(t) };
  });
  ok(st.rows && st.rows.length === 2 && st.rows.some(r => r[0] === 'S' && r[1] === 's' && r[2] === 81) && st.rows.some(r => r[0] === 'R' && r[1] === 'm'), 'answered copies are in the stats with the checker\'s numbers: ' + JSON.stringify(st.rows));
  ok(!st.hasSite && st.inText, 'the answers table has no site, address, client or photo name, and is in the file for Claude');
  ok(st.second, 'the stats file lists the second looks, including those found on their page');

  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
