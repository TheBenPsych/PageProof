// 4.43 Copies found release (mechanics review, Ben's picks from batch 2): rule suggestions from
// your answers, each client's own sites and partners, one row per page, syndicated stories, weak
// Maybes put away after 30 days, and sweeping a Stolen site via its sitemap. Made-up sites only.
const { start } = require('./h.js');
const http = require('http');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  const day = n => new Date(Date.now() - n * 864e5).toISOString();
  await page.evaluate(async ({ d1, d2, d40, d10 }) => {
    await chrome.storage.local.set({ ppSetupDone: true, ppTourDone: true, ppSeenVersion: chrome.runtime.getManifest().version, ppReconnectVer: chrome.runtime.getManifest().version,
      ppCheckup: { ver: chrome.runtime.getManifest().version, at: Date.now(), items: [], ok: true, seen: true }, fcDrive: { label: 'G:\\Shared drives\\Photos', done: true } });
    await FC.DB.put('clients', { name: 'Harbor Times', searching: true, priority: false, licensed: [], photos: 6 });
    const P = (n, extra) => ({ id: 'd:Harbor Times/2026/Q4/' + n, client: 'Harbor Times', name: n, rel: 'Harbor Times/2026/Q4/' + n, folder: 'x', year: 2026, quarter: 4, flag: '', searches: 1, empty: 0, copies: 1, stolen: 0, added: 1, lastSearched: d10, ...extra });
    await FC.DB.putMany('photos', ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg', 'f.jpg'].map(n => P(n)));
    let i = 0;
    const C = (photo, site, extra) => { i++; const u = 'https://' + site + '/story-' + i; return { id: 'd:Harbor Times/2026/Q4/' + photo + '|' + site + '/story-' + i, photo: 'd:Harbor Times/2026/Q4/' + photo, client: 'Harbor Times', url: u, key: site + '/story-' + i, pk: site + '/story-' + i, site, title: '', thumb: '', img: '', engines: [], pct: 90, match: 'same', firstSeen: d1, lastSeen: d1, times: 1, status: 'new', online: 'up', use: 'copied', ...extra }; };
    const list = [];
    for (let k = 0; k < 5; k++) list.push(C('a.jpg', 'stockpics-example.com', { status: 'removed', answered: d2 }));
    for (let k = 0; k < 3; k++) list.push(C('b.jpg', 'regionalwire-example.com', { status: 'licensed', answered: d2 }));
    list.push(C('c.jpg', 'regionalwire-example.com'));
    list.push(C('c.jpg', 'harbortimes-example.com'));
    list.push(C('d.jpg', 'newsblog-example.com', { status: 'stolen', answered: d1 }));
    // weak Maybes
    list.push(C('e.jpg', 'weak-example.com', { match: 'maybe', pct: 30, firstSeen: d40 }));
    list.push(C('e.jpg', 'newsblog-example.com', { match: 'maybe', pct: 30, firstSeen: d40 }));      // site with a Stolen copy: stays
    list.push(C('e.jpg', 'strong-example.com', { match: 'maybe', pct: 70, firstSeen: d40 }));        // over 50%: stays
    list.push(C('e.jpg', 'young-example.com', { match: 'maybe', pct: 30, firstSeen: d10 }));         // only 10 days: stays
    // one page with 2 photos, and one story on 3 sites
    list.push({ ...C('a.jpg', 'citynews-example.com'), url: 'https://citynews-example.com/parade', key: 'citynews-example.com/parade', pk: 'citynews-example.com/parade', id: 'd:Harbor Times/2026/Q4/a.jpg|citynews-example.com/parade' });
    list.push({ ...C('f.jpg', 'citynews-example.com'), url: 'https://citynews-example.com/parade', key: 'citynews-example.com/parade', pk: 'citynews-example.com/parade', id: 'd:Harbor Times/2026/Q4/f.jpg|citynews-example.com/parade' });
    for (const s of ['towna-example.com', 'townb-example.com', 'townc-example.com']) list.push(C('f.jpg', s, { title: 'Harbor parade draws record crowd downtown - ' + s }));
    await FC.DB.putMany('copies', list);
    FC.touch('copies');
  }, { d1: day(1), d2: day(2), d40: day(40), d10: day(10) });

  // ---- 1 + 2 rule suggestions
  const sg = await page.evaluate(async () => (await FC_RULES.suggestions(Date.now())).map(s => s.kind + ':' + s.site));
  ok(sg.includes('own:harbortimes-example.com') && sg.includes('partner:regionalwire-example.com') && sg.includes('sweep:newsblog-example.com'), 'own site, partner and sweep are suggested (top 3): ' + sg.join(', '));
  const all = await page.evaluate(async () => { const s = await FC_RULES.suggestions(Date.now()); for (const x of s.filter(y => y.kind !== 'hide')) await FC_RULES.later(x); return (await FC_RULES.suggestions(Date.now())).map(x => x.kind + ':' + x.site); });
  ok(all.includes('hide:stockpics-example.com') && !all.some(x => /^own|^partner|^sweep/.test(x)), '"Not now" puts a suggestion away for a week; 5 Removes on one site suggest hiding it: ' + all.join(', '));
  const pa = await page.evaluate(async () => {
    await FC.meta.set('ruleAsked', {});
    const s = (await FC_RULES.suggestions(Date.now())).find(x => x.kind === 'partner');
    const undo = await FC_RULES.accept(s);
    const c1 = (await FC.allCopies()).find(c => c.site === 'regionalwire-example.com' && c.photo.endsWith('c.jpg'));
    const lic = (await FC.DB.get('clients', 'Harbor Times')).licensed;
    const again = (await FC_RULES.suggestions(Date.now())).some(x => x.kind === 'partner');
    await undo();
    const c2 = (await FC.DB.get('copies', c1.id));
    return { st: c1.status, lic, again, back: c2.status, lic2: (await FC.DB.get('clients', 'Harbor Times')).licensed };
  });
  ok(pa.st === 'licensed' && pa.lic.includes('regionalwire-example.com') && !pa.again, 'approving a partner licenses its new copy for that client and stops asking');
  ok(pa.back === 'new' && !pa.lic2.includes('regionalwire-example.com'), 'Undo puts both back');

  // ---- 4 weak Maybes
  const wk = await page.evaluate(async () => {
    const n = await FC_RULES.tidyWeak();
    const by = s => (async () => (await FC.allCopies()).find(c => c.site === s && c.photo.endsWith('e.jpg')))();
    return { n, weak: await by('weak-example.com'), stolenSite: (await by('newsblog-example.com')).status, strong: (await by('strong-example.com')).status, young: (await by('young-example.com')).status, note: await FC_RULES.weakNote(), rej: RS_REJECT.items.some(r => /weak-example/.test(r.url)) };
  });
  ok(wk.n === 1 && wk.weak.status === 'removed' && wk.weak.removedBy === 'weakmaybe', 'a Maybe under 50% that nobody answered in 30 days moves to Removed by itself');
  ok(wk.stolenSite === 'new' && wk.strong === 'new' && wk.young === 'new', 'Maybes on a site with a Stolen copy, over 50%, or under 30 days old stay');
  ok(wk.note && wk.note.n === 1 && !wk.rej, 'Home gets a note, and it is not learned as your answer');

  // ---- 3 + 5 one row per page, one row per story; rule banner
  await page.goto(url('app.html#found')); await page.waitForTimeout(3500);
  const fd = await page.evaluate(() => ({ text: document.body.innerText, groups: [...document.querySelectorAll('[data-group]')].map(e => e.dataset.group.slice(0, 3)) }));
  ok(/2 of your photos on this page/.test(fd.text) && fd.groups.includes('pg:'), 'two photos on one page show as one row');
  ok(/Same story on 3 sites/.test(fd.text) && fd.groups.includes('st:'), 'one story on 3 sites shows as one row');
  ok(/Is harbortimes-example\.com Harbor Times's own site\?/.test(fd.text), 'the own site question shows above the list');
  await page.click('[data-group^="pg:"] [data-act="siteall"][data-v^="stolen"]'); await page.waitForTimeout(1500);
  const pg = await page.evaluate(async () => (await FC.allCopies()).filter(c => c.pk === 'citynews-example.com/parade').map(c => c.status));
  ok(pg.length === 2 && pg.every(s => s === 'stolen'), 'one answer covers every photo on that page');
  await page.goto(url('app.html#home')); await page.waitForTimeout(3000);
  ok(/weak Maybe put away by themselves/.test(await page.evaluate(() => (document.getElementById('jobWeak') || {}).textContent || '')), 'Home says the weak Maybe was put away');

  // ---- 8 sweep a Stolen site via its sitemap
  const pics = await page.evaluate(async () => {
    const mk = async seed => { const c = new OffscreenCanvas(640, 480), x = c.getContext('2d'); let s = seed; for (let i = 0; i < 640; i += 8) for (let j = 0; j < 480; j += 8) { s = (s * 16807) % 2147483647; x.fillStyle = `rgb(${s % 256},${(s >> 8) % 256},${(s >> 16) % 256})`; x.fillRect(i, j, 8, 8); } x.fillStyle = '#fff'; x.fillRect(0, 0, 320, 480); return c.convertToBlob({ type: 'image/jpeg', quality: 0.95 }); };
    const ours = await mk(7), other = await mk(99);
    const look = await FC.lookHash(ours);
    const p = await FC.DB.get('photos', 'd:Harbor Times/2026/Q4/c.jpg'); p.look = look; await FC.DB.put('photos', p);
    const q = await FC.DB.get('photos', 'd:Harbor Times/2026/Q4/b.jpg'); q.look = (parseInt(look.slice(0, 8), 16) ^ 0xffffffff >>> 0).toString(16).padStart(8, '0') + look.slice(8); await FC.DB.put('photos', q);
    return { ours: [...new Uint8Array(await ours.arrayBuffer())], other: [...new Uint8Array(await other.arrayBuffer())] };
  });
  let base = '';
  const srv = http.createServer((q, r) => {
    const send = (type, body) => { r.writeHead(200, { 'content-type': type }); r.end(body); };
    if (q.url === '/robots.txt') return send('text/plain', 'User-agent: *\nSitemap: ' + base + '/map-index.xml\n');
    if (q.url === '/map-index.xml') return send('application/xml', `<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${base}/map-1.xml</loc></sitemap><sitemap><loc>${base}/map-2.xml</loc></sitemap></sitemapindex>`);
    if (q.url === '/map-1.xml') return send('application/xml', `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"><url><loc>${base}/2026/stolen-again</loc><image:image><image:loc>${base}/img/ours.jpg</image:loc></image:image></url><url><loc>${base}/2026/other</loc><image:image><image:loc>${base}/img/other.jpg</image:loc></image:image></url></urlset>`);
    if (q.url === '/map-2.xml') return send('application/xml', `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}/2026/page-only</loc></url></urlset>`);
    if (q.url === '/img/ours.jpg') return send('image/jpeg', Buffer.from(pics.ours));
    if (q.url === '/img/other.jpg') return send('image/jpeg', Buffer.from(pics.other));
    r.writeHead(404); r.end();
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + srv.address().port;
  const sw = await page.evaluate(async base => {
    globalThis.PP_SWEEP_HOME = () => base;
    await FC_RULES.queueSweep('newsblog-example.com', 'Harbor Times');
    for (let i = 0; i < 12; i++) { const s = await FC_RULES.sweepOf('newsblog-example.com'); if (s.state === 'done') break; await FC_RULES.sweepStep(); }
    const s = await FC_RULES.sweepOf('newsblog-example.com');
    const found = (await FC.allCopies()).filter(c => c.sweep);
    return { s: { state: s.state, checked: s.checked, found: s.found, looks: s.looks, seen: s.seen, failed: s.failed, pics: s.pics.length, pages: s.pages.length, mapsRead: s.mapsRead }, found: found.map(c => c.photo.split('/').pop() + ' ' + c.url.replace(base, '')) };
  }, base);
  ok(sw.s.state === 'done' && sw.s.checked === 2, 'the sweep reads robots.txt, the sitemap index and the image sitemap, and checks each picture: ' + JSON.stringify(sw.s));
  ok(sw.found.length === 1 && /^c\.jpg \/2026\/stolen-again/.test(sw.found[0]), 'the client\'s photo is found on another page of that site (and nothing else): ' + sw.found.join(', '));
  const parse = await page.evaluate(() => ({ m: FC_RULES.pagePics('<meta property="og:image" content="/a/big.jpg"><img src="/b/pic.jpg?x=1&amp;y=2">', 'https://site.com/story').map(x => x.img) }));
  ok(parse.m.includes('https://site.com/a/big.jpg') && parse.m.includes('https://site.com/b/pic.jpg?x=1&y=2'), 'a page without a picture list gives its share picture and story pictures');
  srv.close();

  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await ctx.close();
  process.exit(fails ? 1 : 0);
})();
