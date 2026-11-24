// 4.31: another photo of the same place is not a copy. A different shot in front of the same
// sponsor wall lines up only on the printed logos: the photo check must say so, and a copy like
// that already sitting unanswered in Copies found must be checked again and moved to Removed
// (Put back works). A real (resized) copy of the same photo must stay.
const { start } = require('./h.js');
const http = require('http');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  if (!await page.evaluate(() => typeof PP_ALIGN !== 'undefined')) await page.addScriptTag({ url: url('align.js') });   // the photo check (Copies found uses it in a worker)
  // A made-up press wall (logo boxes printed over and over) with someone standing in front.
  const pics = await page.evaluate(async () => {
    const shot = async (dx, dy, seed, w = 1200, h = 800) => {
      const c = new OffscreenCanvas(w, h), x = c.getContext('2d');
      x.fillStyle = '#1c3caa'; x.fillRect(0, 0, w, h);
      for (let j = -1; j < 7; j++) for (let i = -1; i < 7; i++) {
        const px = i * 230 + (j % 2 ? 115 : 0) + dx, py = j * 150 + dy;
        if ((i + j) % 2) { x.fillStyle = '#f5f5f5'; x.fillRect(px + 10, py + 10, 180, 100); x.fillStyle = '#146e3c'; x.font = 'bold 44px sans-serif'; x.fillText('QUBIT', px + 26, py + 72); }
        else { x.strokeStyle = '#fff'; x.lineWidth = 5; for (let k = 0; k < 6; k++) { x.beginPath(); x.arc(px + 60 + 26 * Math.cos(k), py + 40 + 26 * Math.sin(k), 9, 0, 7); x.stroke(); } x.fillStyle = '#fff'; x.font = '22px serif'; x.fillText('Harbor Health', px + 10, py + 100); }
      }
      // the person: soft photographic texture, different every shot
      let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 2500; i++) {
        const a = rnd() * 6.28, r = Math.sqrt(rnd()), cx = 520 + Math.cos(a) * r * 230, cy = 470 + Math.sin(a) * r * 330;
        x.fillStyle = `hsla(${20 + rnd() * 30}, ${30 + rnd() * 40}%, ${25 + rnd() * 50}%, 0.6)`;
        x.beginPath(); x.ellipse(cx, cy, 6 + rnd() * 22, 4 + rnd() * 14, rnd() * 3, 0, 7); x.fill();
      }
      return c;
    };
    const jpg = async c => new Uint8Array(await (await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 })).arrayBuffer());
    const ours = await shot(0, 0, 7), other = await shot(9, 5, 99);
    const small = new OffscreenCanvas(600, 400); small.getContext('2d').drawImage(ours, 0, 0, 600, 400);
    // the photo check itself, straight away
    const bm = async c => createImageBitmap(await c.convertToBlob());
    const A = await bm(ours), B = await bm(other), C = await bm(small);
    const T1 = await PP_ALIGN.align(A, B), T2 = await PP_ALIGN.align(A, C);
    const s1 = T1 && PP_ALIGN.shot(A, B, T1), s2 = T2 && PP_ALIGN.shot(A, C, T2);
    return { ours: [...await jpg(ours)], other: [...await jpg(other)], real: [...await jpg(small)],
      other1: s1 && { logos: s1.logos, place: s1.place, photo: s1.photo, lines: T1.sc.lines, graphic: s1.graphic }, real1: s2 && { logos: s2.logos, place: s2.place, lines: T2.sc.lines } };
  });
  ok(pics.other1 && (pics.other1.logos || pics.other1.place), 'Another shot in front of the same logo wall is found out ' + JSON.stringify(pics.other1));
  ok(pics.other1 && pics.other1.photo !== null && pics.other1.photo < 0.3, 'Its % is what lines up of the photo itself, so it shows low');
  ok(pics.real1 && !pics.real1.logos && !pics.real1.place && pics.real1.lines > 0.8, 'A real copy of the same photo still lines up ' + JSON.stringify(pics.real1));
  const srv = http.createServer((q, r) => {
    const m = { '/other.jpg': pics.other, '/real.jpg': pics.real }[q.url];
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
    await FC.DB.put('photos', { id: 'd:Client A/x.jpg', client: 'Client A', extra: false, rel: 'Client A/x.jpg', name: 'x.jpg', folder: 'Client A', year: 0, quarter: 0, day: 0, flag: '', searches: 1, empty: 0, copies: 3, stolen: 0, added: 1, order: 1 });
    const mk = (site, img, extra) => ({ id: 'd:Client A/x.jpg|' + site, photo: 'd:Client A/x.jpg', client: 'Client A', url: 'https://' + site + '/story', key: site + '/story', site, title: '', thumb: '', img, engines: [], pct: 77, match: 'maybe', firstSeen: '2026-11-19', lastSeen: '2026-11-19', times: 1, status: 'new', online: 'up', photoName: 'x.jpg', ...extra });
    await FC.DB.put('copies', mk('other-shot.com', base + '/other.jpg'));
    await FC.DB.put('copies', mk('real-copy.com', base + '/real.jpg'));
    await FC.DB.put('copies', mk('answered.com', base + '/other.jpg', { status: 'stolen' }));   // already answered: left alone
  }, { ours: pics.ours, base });
  await page.reload(); await page.waitForTimeout(800);
  await page.evaluate(() => { FC_PREV.recheckWait = 500; location.hash = 'found'; });
  let st = null;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(1000);
    st = await page.evaluate(async () => { const done = (await FC.meta.get('shotChecked')) || {}; return Object.fromEntries((await FC.DB.all('copies')).map(c => [c.site, { status: c.status, by: c.removedBy || '', pct: c.pct, checked: done[c.id] || 0 }])); });
    if (st['other-shot.com'].status !== 'new' && st['real-copy.com'].checked) break;
  }
  ok(st['other-shot.com'].status === 'removed' && st['other-shot.com'].by === 'checker', 'An unanswered copy that is another shot moves to Removed ' + JSON.stringify(st['other-shot.com']));
  ok(st['other-shot.com'].pct < 30, 'Its % is lowered to what lines up of the photo itself');
  ok(st['real-copy.com'].status === 'new' && st['real-copy.com'].checked === 6, 'A real copy is checked once and stays ' + JSON.stringify(st['real-copy.com']));
  ok(st['answered.com'].status === 'stolen', 'A copy you already answered is never changed');
  // Put back works.
  const back = await page.evaluate(async () => { await FC.answer(['d:Client A/x.jpg|other-shot.com'], 'new'); return (await FC.DB.get('copies', 'd:Client A/x.jpg|other-shot.com')).status; });
  ok(back === 'new', 'Put back brings it back');
  srv.close(); await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
