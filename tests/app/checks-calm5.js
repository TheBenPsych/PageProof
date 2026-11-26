// The calm look, step 5: New search and Search results. New search has the photos on the left
// (real, unsquashed thumbnails) and Search on, Speed and the Search button on the right. Search
// results has one progress card, every photo as a real picture, the picked photo and What's happening.
const { start } = require('./h.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('revsearch.html')); await page.waitForSelector('#goSearch');
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'light' }));
  // ---- New search, nothing picked
  let s = await page.evaluate(() => ({ h1: document.querySelector('.nhead h1').textContent, drop: !!document.querySelector('.ndrop'), go: document.getElementById('goSearch').disabled,
    why: document.querySelector('.nwhy').textContent, sites: document.querySelectorAll('#searchOn .nsr').length, speeds: document.querySelectorAll('#speedCard .nrad').length,
    on: (document.querySelector('#speedCard .nrad.on') || {}).textContent || '', cols: getComputedStyle(document.querySelector('.ngridtop')).gridTemplateColumns.split(' ').length,
    font: getComputedStyle(document.body).fontFamily }));
  ok(/Copies found ›\s*New search/.test(s.h1), 'New search: the title says where you are (' + s.h1 + ')');
  ok(s.drop && s.go && /at least one photo/.test(s.why), 'Nothing picked: a big drop area, and the Search button says why it is off');
  ok(s.sites === 3 && s.speeds === 3 && /Normal/.test(s.on) && /Best for most/.test(s.on), 'Search on has 3 sites, Speed has 3 choices with Normal picked');
  ok(s.cols === 2, 'Two columns on a wide screen: photos, then the settings and Search');
  ok(/Lexend/.test(s.font), 'The calm font is used');
  // ---- pick three photos (one tall, one wide) : thumbnails keep their shape
  const png = (w, hh) => page.evaluate(async ([w, hh]) => { const c = document.createElement('canvas'); c.width = w; c.height = hh; const x = c.getContext('2d'); x.fillStyle = '#' + ((w * 7919) % 0xffffff).toString(16).padStart(6, '0'); x.fillRect(0, 0, w, hh); x.fillStyle = '#fff'; x.fillRect(w / 4, hh / 4, w / 3, hh / 3); return c.toDataURL('image/png').split(',')[1]; }, [w, hh]);
  const files = [];
  for (const [n, w, hh] of [['wide.png', 900, 400], ['tall.png', 400, 900], ['square.png', 600, 600]]) files.push({ name: n, mimeType: 'image/png', buffer: Buffer.from(await png(w, hh), 'base64') });
  await page.setInputFiles('#filePick', files);
  await page.waitForSelector('#draftGrid .nt:nth-child(3)');
  s = await page.evaluate(() => ({ boxes: [...document.querySelectorAll('#draftGrid .nt img')].map(i => { const r = i.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }),
    go: document.getElementById('goSearch'), goTxt: document.getElementById('goSearch').textContent, off: document.getElementById('goSearch').disabled, why: document.querySelector('.nwhy').textContent,
    cmd: ['addPhotos', 'pasteLink', 'clearAll'].every(i => document.getElementById(i)), count: document.querySelector('.nph h2').textContent }));
  ok(s.boxes.length === 3 && s.boxes.every(([w, hh]) => w >= 90 && hh >= 90), 'Picked photos show as real thumbnails, not squashed dots (' + JSON.stringify(s.boxes) + ')');
  ok(/Search 3 photos/.test(s.goTxt) && !s.off && /About .* for 3 photos on 3 sites/.test(s.why), 'The Search button counts the photos and says about how long (' + s.why.slice(0, 60) + ')');
  ok(s.cmd && /3 of/.test(s.count), 'Add photos, Paste a link and Clear all sit above the photos');
  await page.click('#pasteLink'); await page.waitForSelector('#linkIn');
  ok(await page.evaluate(() => document.activeElement === document.getElementById('linkIn')), 'Paste a link opens a box on the page (no pop-up window) with the cursor in it');
  await page.click('.nlinkrow .nbtn.ghost'); await page.waitForTimeout(300);
  await page.click('#draftGrid .nt:nth-child(2) .nx'); await page.waitForTimeout(400);
  ok(await page.evaluate(() => document.querySelectorAll('#draftGrid figure.nt').length === 2 && /Search 2 photos/.test(document.getElementById('goSearch').textContent)), 'The x on a photo takes it out');
  // ---- switches save the same settings as before
  await page.click('#searchOn .nsr:nth-child(3) input'); await page.waitForTimeout(400);
  let st = await page.evaluate(async () => ({ s: (await chrome.storage.local.get('rsSettings')).rsSettings, head: document.querySelector('#searchOn h2').textContent }));
  ok(st.s.engines.yandex === false && /2 of 3/.test(st.head), 'Switching a search site off saves it (' + st.head + ')');
  await page.click('#speedCard .nrad:nth-child(2) input', { force: true }); await page.waitForTimeout(400);
  st = await page.evaluate(async () => (await chrome.storage.local.get('rsSettings')).rsSettings);
  ok(st.speed === 'careful', 'Picking a speed saves it (' + st.speed + ')');
  for (const i of [2, 4]) await page.click('#searchOn .nsr:nth-child(' + i + ') input');
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => document.getElementById('goSearch').disabled && /at least one search site/.test(document.querySelector('.nwhy').textContent)), 'Every site off: the Search button says to turn one on');
  await page.click('#clearAll'); await page.waitForTimeout(400);
  ok(await page.evaluate(() => !!document.querySelector('.ndrop') && !document.getElementById('draftGrid')), 'Clear all brings the drop area back');
  await page.evaluate(() => chrome.storage.local.remove('rsSettings'));

  // ---- Search results
  await page.evaluate(async () => {
    const px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const t = Date.now() - 600000, E = ['google', 'yandex', 'bing'];
    const link = (i, v, e) => ({ url: 'https://site' + i + '.example/p', site: 'site' + i + '.example', title: 'Page ' + i, thumb: '', engines: [e], fake: v, pct: v === 'same' ? 97 : 61 });
    const pic = (i, links, skip) => ({ i, name: 'photo' + i + '.jpg', thumb: px, w: 1200, h: 800, size: 204800, ingested: true, t0: t + i * 20000, t1: t + i * 20000 + 15000, links,
      runs: Object.fromEntries(E.map(e => [e, { state: skip && e === 'bing' ? 'skip' : 'done', why: skip && e === 'bing' ? 'Bing took too long.' : '', at: t + i * 20000 + 12000 }])) });
    await RS_DB.put('jobs', 'c5', { id: 'c5', created: new Date(t).toISOString(), kind: '', engines: E, started: new Date(t).toISOString(), finished: true, pics: [
      pic(0, [link(1, 'same', 'google'), link(2, 'maybe', 'yandex'), link(3, 'no', 'bing'), link(4, 'no', 'google')]), pic(1, [link(5, 'maybe', 'bing')]), pic(2, []), pic(3, [], true)] });
  });
  await page.goto(url('revsearch.html?job=c5')); await page.waitForSelector('#selcard');
  await page.evaluate(() => { const real = verdict; verdict = l => l.fake || real(l); renderResults(); });
  await page.waitForTimeout(600);
  let r = await page.evaluate(() => ({ h1: document.querySelector('.nhead h1').textContent, big: document.querySelector('#progCard .nbig b').textContent,
    kept: document.querySelector('#numKept .num').textContent, out: document.querySelector('#numOut .num').textContent,
    lights: [...document.querySelectorAll('.nlights .nlight')].map(e => e.textContent), cls: [...document.querySelectorAll('.nstrip .nfp')].map(b => b.className.match(/s-(\w+)/)[1]),
    keys: [...document.querySelectorAll('.nkey')].map(k => k.textContent), rest: (document.getElementById('restBtn') || {}).textContent || '', stop: !!document.getElementById('stopBtn'),
    pdf: document.getElementById('pdfBtn').disabled, h2: document.querySelector('#selcard h2').textContent, okTxt: document.querySelector('#selcard .nok').textContent,
    engs: [...document.querySelectorAll('.nengs .neng')].map(e => e.textContent), finds: [...document.querySelectorAll('.nfinds .nfind .ktag')].map(e => e.textContent),
    thrownOpen: document.getElementById('thrown').open, thrown: document.querySelector('#thrown summary').textContent, feed: document.querySelectorAll('.nfeed .nev').length,
    facts: document.querySelector('.nfacts').textContent, old: document.querySelectorAll('.pg-tiles,.res-strip,.res-list,.pg-eng').length }));
  ok(/All searches ›\s*4 photos searched/.test(r.h1) && /4 of 4 photos done/.test(r.big), 'Search results: the title and one progress card (' + r.big + ')');
  ok(r.kept === '3' && r.out === '2', 'The card counts what went to Copies found and what was thrown out (' + r.kept + ', ' + r.out + ')');
  ok(r.lights.length === 3 && /Google.*Done/.test(r.lights[0]) && /Bing.*Some skipped/.test(r.lights[2]), 'A light per search site, Bing says some were skipped');
  ok(r.cls.join() === 'same,maybe,none,bad', 'Every photo is a picture with what it found (' + r.cls.join() + ')');
  ok(r.keys.includes('Skipped') && r.keys.includes('Same photo'), 'The colour key lists Skipped only when a photo was skipped');
  ok(/Search the rest \(1\)/.test(r.rest) && !r.stop && !r.pdf, 'Finished: Search the rest (1), no Stop button, PDF report ready');
  ok(/1\. photo0\.jpg/.test(r.h2) && /2 copies sent to Copies found/.test(r.okTxt) && /1 same photo, 1 maybe/.test(r.okTxt), 'The picked photo says what it found (' + r.okTxt + ')');
  ok(/1,200 × 800/.test(r.facts) && /200 KB/.test(r.facts), 'Its facts list the file size');
  ok(r.engs.length === 3 && /Google.*2 found · 1 kept/.test(r.engs[0]), 'One line per search site with found and kept (' + r.engs[0] + ')');
  ok(r.finds.length === 2 && /Same photo · 97%/.test(r.finds[0]) && /Maybe · 61%/.test(r.finds[1]), 'Copies it found, best first (' + r.finds.join(' | ') + ')');
  ok(!r.thrownOpen && /Thrown out\s*2/.test(r.thrown) && /Different photo 2/.test(r.thrown), 'Thrown out is one folded line with its count');
  ok(r.feed >= 6 && r.old === 0, 'What\'s happening lists the search; none of the old page pieces are left');
  await page.click('#thrown summary'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.querySelectorAll('#thrown .in .list .row, #thrown .in .list .site > *').length >= 2), 'Opening Thrown out shows the two links');
  await page.evaluate(() => renderResults());
  ok(await page.evaluate(() => document.getElementById('thrown').open), 'It stays open when the page redraws');
  await page.click('.nstrip .nfp[data-i="3"]'); await page.waitForTimeout(400);
  r = await page.evaluate(() => ({ h2: document.querySelector('#selcard h2').textContent, on: document.querySelector('.nstrip .nfp.on').dataset.i, prob: (document.querySelector('.nproblem') || {}).textContent || '', pressed: document.querySelector('.nstrip .nfp[data-i="3"]').getAttribute('aria-pressed') }));
  ok(/4\. photo3\.jpg/.test(r.h2) && r.on === '3' && r.pressed === 'true', 'Clicking a photo opens it');
  ok(/Bing took too long/.test(r.prob), 'A skipped photo says why (' + r.prob + ')');
  // ---- sizes, narrow and dark
  const fit = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, strip: [...document.querySelectorAll('.nstrip .nfp')].every(b => b.getBoundingClientRect().width >= 90), cols: getComputedStyle(document.querySelector('.nresgrid')).gridTemplateColumns.split(' ').length }));
  ok(fit.over <= 0 && fit.strip && fit.cols === 2, 'Wide screen: nothing runs off the side, two columns under the photos');
  await page.setViewportSize({ width: 700, height: 900 }); await page.waitForTimeout(300);
  const nar = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, cols: getComputedStyle(document.querySelector('.nresgrid')).gridTemplateColumns.split(' ').length }));
  ok(nar.over <= 0 && nar.cols === 1, 'Narrow window: one column, nothing runs off the side (' + nar.over + ')');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'dark' })); await page.reload(); await page.waitForSelector('#selcard');
  await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
  const d = await page.evaluate(() => ({ card: getComputedStyle(document.querySelector('#progCard')).backgroundColor, ink: getComputedStyle(document.querySelector('#progCard .nbig b')).color }));
  ok(d.card === 'rgb(43, 43, 43)' && +d.ink.match(/\d+/)[0] > 220, `Dark: grey cards and light words (${d.card}, ${d.ink})`);
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
