// After a move or reinstall the browser's preview pictures are gone. Copies found must bring them
// back by itself: your photo from Drive, their copy from its picture address or, when only the page
// link is known, from the picture on their page that lines up with your photo. A copy's picture
// address must also be in found-copies.txt so the next reinstall has it.
const { start } = require('./h.js');
const http = require('http');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  // Make the pictures in the browser: your photo, their (smaller) copy of it, and an unrelated one.
  const pics = await page.evaluate(async () => {
    const draw = async (w, h, seed, type = 'image/jpeg') => {
      const c = new OffscreenCanvas(w, h), x = c.getContext('2d');
      for (let i = 0; i < 900; i++) { x.fillStyle = `hsl(${(seed * 47 + i * 31) % 360} 70% ${20 + (i * 13) % 60}%)`; x.fillRect(((i * 97 + seed * 7) % 100) / 100 * w, ((i * 61) % 100) / 100 * h, w / 9, h / 11); }
      return new Uint8Array(await (await c.convertToBlob({ type, quality: 0.9 })).arrayBuffer());
    };
    const ours = await draw(1200, 800, 3);
    const bmp = await createImageBitmap(new Blob([ours]));
    const c = new OffscreenCanvas(600, 400); c.getContext('2d').drawImage(bmp, 0, 0, 600, 400);
    const theirs = new Uint8Array(await (await c.convertToBlob({ type: 'image/jpeg', quality: 0.8 })).arrayBuffer());
    const oc = new OffscreenCanvas(600, 400), ox = oc.getContext('2d');
    ox.fillStyle = '#dde'; ox.fillRect(0, 0, 600, 400);
    for (let i = 0; i < 60; i++) { ox.beginPath(); ox.arc((i * 137) % 600, (i * 89) % 400, 10 + (i * 7) % 40, 0, 7); ox.fillStyle = `hsl(${i * 23 % 360} 80% 45%)`; ox.fill(); }
    ox.font = 'bold 60px sans-serif'; ox.fillStyle = '#111'; ox.fillText('Other picture', 60, 220);
    const other = new Uint8Array(await (await oc.convertToBlob({ type: 'image/jpeg', quality: 0.9 })).arrayBuffer());
    return { ours: [...ours], theirs: [...theirs], other: [...other] };
  });
  const srv = http.createServer((q, r) => {
    if (q.url === '/page.html') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end('<html><body><img src="/other.jpg"><p>story</p><img data-src="/theirs.jpg"></body></html>'); }
    if (q.url === '/nomatch.html') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end('<html><head><meta property="og:image" content="/other.jpg"></head></html>'); }
    const m = { '/theirs.jpg': pics.theirs, '/other.jpg': pics.other }[q.url];
    if (m) { r.writeHead(200, { 'content-type': 'image/jpeg' }); return r.end(Buffer.from(m)); }
    r.writeHead(404); r.end();
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  await page.evaluate(async ({ ours, base }) => {
    const root = await navigator.storage.getDirectory();
    const photos = await root.getDirectoryHandle('Photos', { create: true });
    await RS_DB.put('handles', 'fcRoot', photos);
    const docs = await root.getDirectoryHandle('PageProof', { create: true });
    await RS_DB.put('handles', 'docs', docs);
    const cl = await photos.getDirectoryHandle('Client A', { create: true });
    const w = await (await cl.getFileHandle('x.jpg', { create: true })).createWritable(); await w.write(new Uint8Array(ours)); await w.close();
    await chrome.storage.local.set({ ppSetupDone: true, ppTourDone: true, ppSeenVersion: chrome.runtime.getManifest().version, ppReconnectVer: chrome.runtime.getManifest().version, fcDrive: { label: 'G:\\Shared drives\\Photos', done: true } });
    await FC.DB.put('clients', { name: 'Client A', searching: true, priority: false, licensed: [], photos: 1, pick: 'Client A' });
    await FC.DB.put('photos', { id: 'd:Client A/x.jpg', client: 'Client A', extra: false, rel: 'Client A/x.jpg', name: 'x.jpg', folder: 'Client A', year: 0, quarter: 0, day: 0, flag: '', searches: 1, empty: 0, copies: 2, stolen: 0, added: 1, order: 1 });
    const mk = (path, extra) => ({ id: 'd:Client A/x.jpg|127.0.0.1' + path, photo: 'd:Client A/x.jpg', client: 'Client A', url: base + path, key: '127.0.0.1' + path, site: '127.0.0.1', title: '', thumb: '', img: '', engines: [], pct: 90, match: 'same', firstSeen: '2026-11-19', lastSeen: '2026-11-19', times: 1, status: 'new', online: 'up', restored: true, photoName: 'x.jpg', ...extra });
    await FC.DB.put('copies', mk('/page.html'));
    await FC.DB.put('copies', mk('/nomatch.html'));
    await FC.DB.put('copies', mk('/direct', { img: base + '/theirs.jpg' }));
  }, { ours: pics.ours, base });
  await page.reload(); await page.waitForTimeout(800);
  await page.evaluate(() => { location.hash = 'found'; });
  let st = null;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1000);
    st = await page.evaluate(async () => { const cs = await FC.DB.all('copies'); const p = await FC.DB.get('photos', 'd:Client A/x.jpg'); return { p: !!(p.th || p.thumb), cs: Object.fromEntries(cs.map(c => [c.url.split('/').pop(), { th: !!(c.th || c.thumb), img: c.img, tried: !!c.thTried }])) }; });
    if (st.cs['page.html'].tried && st.cs['nomatch.html'].tried && st.cs['direct'].tried) break;
  }
  ok(st.p, 'Your client\'s photo gets its preview back from Drive');
  ok(st.cs['direct'].th, 'A copy with a known picture address gets its preview back');
  ok(st.cs['page.html'].th && /theirs\.jpg$/.test(st.cs['page.html'].img), 'A copy with only a page link: the picture on their page that lines up is found and kept ' + JSON.stringify(st.cs['page.html']));
  ok(!st.cs['nomatch.html'].th && st.cs['nomatch.html'].tried, 'No matching picture on their page: the placeholder stays (no wrong picture)');
  await page.waitForTimeout(2500);
  // (The three copies are on one site, so they fold into one row.)
  const shown = await page.evaluate(() => { const r = document.querySelector('.cpair'); return r ? { ours: !/icon48/.test(r.querySelector('img.ours').src), theirs: !/icon48|^data:image\/gif/.test(r.querySelector('img.thumb').src) } : null; });
  ok(shown && shown.ours && shown.theirs, 'Copies found shows both rebuilt pictures without leaving the page ' + JSON.stringify(shown));
  // found-copies.txt keeps their picture address for next time.
  const txt = await page.evaluate(async () => { await FC.writeCopies(); return RS_DOCS.readText('found-copies.txt'); });
  ok(/theirs\.jpg/.test(txt || ''), 'found-copies.txt keeps their picture address');
  const back = await page.evaluate(async () => { const all = await FC.DB.all('copies'); await FC.DB.delMany('copies', all.map(c => c.id)); await FC.restoreCopies(); return (await FC.DB.all('copies')).filter(c => /theirs\.jpg$/.test(c.img)).length; });
  ok(back >= 2, 'After a reinstall the picture address comes back from found-copies.txt (' + back + ')');
  srv.close(); await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
