// The calm look, step 17 (part 1): Tools › All tools and Verify a pack.
// All tools: the six real tools, one "drop any file" box that opens the right tool, and Opened
// lately (kept only on this computer). Verify a pack: in the Tools menu, one calm page with a big
// answer, four tiles, label rows and folds. The copy of the checker inside every evidence pack
// keeps its plain look.
process.env.NP = process.env.NP || '200'; process.env.NC = process.env.NC || '5';   // before seed.js is read
const { start } = require('./h.js'); const { seed } = require('./seed.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(1200);
  await seed(page);
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'light', ppToolsRecent: [] }));
  const T = (ms = 500) => page.waitForTimeout(ms);
  const frame = name => page.frames().find(f => f.url().includes(name));

  // ---- All tools
  await page.goto(url('app.html#tools')); await page.waitForSelector('#tlTiles', { timeout: 60000 }); await T();
  const hub = await page.evaluate(() => ({ h1: document.querySelector('.head h1').textContent.trim(), lede: !!document.querySelector('.head .lede'), subs: [...document.querySelectorAll('.subs a')].map(a => a.textContent.trim()), tiles: [...document.querySelectorAll('#tlTiles .tn-tile')].map(a => [a.getAttribute('href'), a.querySelector('b').textContent, a.querySelector('.tk').textContent]), drop: document.querySelector('#tlDrop').textContent.replace(/\s+/g, ' '), none: (document.querySelector('#tlNone') || {}).textContent || '', old: document.querySelectorAll('.toolsec, a.tool').length, ev: [...document.querySelectorAll('.side a')].some(a => a.getAttribute('href') === '#verify') }));
  ok(hub.h1 === 'Tools' && !hub.lede && hub.subs.join('|') === 'All tools|Inspect a photo|Compare two photos|Mark up a copy|Convert files|Verify a pack', 'The Tools menu: ' + hub.subs.join(' · '));
  ok(hub.tiles.length === 6 && !hub.old && hub.tiles.map(t => t[0]).join() === '#inspect,#compare,#markup,#files,#openfiles,#verify' && hub.tiles.every(t => /^Takes: /.test(t[2])), 'All tools shows only the six real tools, each saying what it takes: ' + hub.tiles.map(t => t[1]).join(', '));
  ok(/Drop any file here to start/.test(hub.drop) && /Choose a file/.test(hub.drop) && /show here/.test(hub.none), 'One box to drop any file, and a calm line while nothing was opened yet');
  const which = await page.evaluate(() => { const f = (n, t) => new File(['x'], n, { type: t || '' }); return [PP_TOOLS.toolFor([f('a.jpg', 'image/jpeg')]), PP_TOOLS.toolFor([f('a.jpg'), f('b.png')]), PP_TOOLS.toolFor([f('pack.zip')]), PP_TOOLS.toolFor([f('PageProof_site_2026.pdf')]), PP_TOOLS.toolFor([f('letter.pdf')]), PP_TOOLS.toolFor([f('a.heic')]), PP_TOOLS.toolFor([f('a.jpg'), f('b.jpg'), f('c.jpg')]), PP_TOOLS.toolFor([f('notes.docx')])].join(); });
  ok(which === 'inspect,compare,verify,markup,files,inspect,files,files', 'A dropped file opens the right tool (photo, two photos, pack, capture PDF, anything else): ' + which);

  // ---- a pack dropped on All tools opens Verify and is checked there
  const made = await page.evaluate(async () => {
    const enc = new TextEncoder(), hex = async b => [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map(x => x.toString(16).padStart(2, '0')).join('');
    await new Promise((ok, bad) => { const s = document.createElement('script'); s.src = 'zip.js'; s.onload = ok; s.onerror = bad; document.head.append(s); });
    const base = 'PageProof_harbortimes-example.com_2026-11-24_1932';
    const build = async change => {
      const files = [[base + '.pdf', 'pdf bytes'], [base + '.html', '<html>'], [base + '_source.html', '<html>src'], ['images/img-01.jpg', 'jpg1'], ['images/img-02.png', 'png2'], ['image-data.txt', 'data'], ['VERIFY-THIS-PACK.html', 'checker']].map(([n, t]) => ({ name: n, bytes: enc.encode(t) }));
      let fp = ''; for (const f of files) fp += (await hex(f.bytes)) + '  ' + f.name + '\n';
      const all = [...files, { name: 'fingerprints.sha256', bytes: enc.encode(fp) }, { name: 'capture-details.txt', bytes: enc.encode('Capture ID:    PP-7KQ2M9\nWeb address:   https://harbortimes-example.com/2026/11/council-harbor-plan\nCaptured UTC:  2026-11-24T19:32:10.000Z\nCase / ref:    2026-HT-0417\nCollected by:  Sam Tester\n') }, ...['freetsa', 'digicert', 'sectigo'].map(n => ({ name: 'timestamps/' + n + '.tsr', bytes: enc.encode('x') }))];
      if (change === 'bad') { all[3].bytes = enc.encode('changed!'); all.splice(5, 1); all.push({ name: 'extra-note.txt', bytes: enc.encode('later') }); }
      if (change === 'nots') all.splice(-3, 3);
      const z = await PP_ZIP(all); return z instanceof Blob ? new Uint8Array(await z.arrayBuffer()) : z;
    };
    window.__packs = { good: await build(), bad: await build('bad'), nots: await build('nots'), base };
    await chrome.storage.local.set({ log: [{ id: 'cap-x', captureId: 'PP-7KQ2M9', time: '2026-11-24T19:32:10.000Z', url: 'https://harbortimes-example.com/x', saves: [{ at: '2026-11-24T19:33:00.000Z', sha256: await hex(window.__packs.good), collector: 'Sam Tester' }] }] });
    return base;
  });
  // the page looks first (nothing open), then gets the pack
  await page.goto(url('app.html#verify')); await page.waitForFunction(() => { const f = document.querySelector('iframe.tool'); return f && f.contentDocument && f.contentDocument.querySelector('#vRoot .tn-drop'); }, null, { timeout: 30000 });
  let v = frame('verify.html');
  const e = await v.evaluate(() => ({ h1: document.querySelector('#vRoot .nhead h1').textContent.replace(/\s+/g, ' ').trim(), drop: document.querySelector('.tn-drop').textContent, btns: [...document.querySelectorAll('.tn-drop .nbtn')].map(b => b.textContent), what: document.querySelector('.tn-what').textContent, oldHidden: getComputedStyle(document.querySelector('#main > .pg-head')).display === 'none' && getComputedStyle(document.querySelector('#out')).display === 'none', recent: !!document.querySelector('.tn-recent') }));
  ok(e.h1 === 'Tools › Verify a pack' && /Drop an evidence pack \(\.zip\) here/.test(e.drop) && e.btns.join('|') === 'Choose a pack|Choose a folder' && /What Verify checks/.test(e.what) && e.oldHidden && !e.recent, 'Verify a pack with nothing open: one big drop card, Choose a pack, Choose a folder, and what it checks');
  // real timestamp receipts can't be made in a test: the service check is swapped for a stand-in
  const stub = () => { let i = 0; window.__TS = async () => { const n = ['freetsa.org TSA', 'DigiCert Timestamp Responder', 'Sectigo Time Stamping Signer'][i++ % 3]; return { ok: true, time: '2026-11-24T19:32:' + (11 + i) + 'Z', signer: n, issuer: 'Root' }; }; (0, eval)('checkFiles = ' + checkFiles.toString().replace('PP_TSVERIFY(', '__TS(')); };
  await v.evaluate(stub);
  await page.evaluate(() => { location.hash = 'tools'; }); await page.waitForSelector('#tlTiles'); await T(300);
  await page.evaluate(() => PP_TOOLS.take([new File([window.__packs.good], window.__packs.base + '.zip', { type: 'application/zip' })]));
  await page.waitForFunction(() => location.hash === '#verify'); await T(800);
  v = frame('verify.html');
  // the frame was made again, so it checked with the real service check: the made-up receipts fail
  const real = await v.waitForSelector('#vAnswer', { timeout: 30000 }).then(() => v.evaluate(() => ({ cls: document.querySelector('#vAnswer').className, t: document.querySelector('#vAnswer').textContent, stamps: document.querySelector('#vtStamps').textContent })));
  ok(/bad/.test(real.cls) && /3 timestamps failed/.test(real.t) && /0 of 3/.test(real.stamps), 'A pack dropped on All tools opens Verify a pack and is checked there (made-up timestamp receipts are refused)');

  // ---- a good pack
  await v.evaluate(stub);
  await v.evaluate(() => handle(new File([parent.__packs.good], parent.__packs.base + '.zip', { type: 'application/zip' })));
  await v.waitForSelector('#vAnswer.good', { timeout: 30000 });
  const g = await v.evaluate(() => ({ ans: document.querySelector('#vAnswer').textContent.replace(/\s+/g, ' '), chip: document.querySelector('.tn-cmd .tn-fchip').textContent.replace(/\s+/g, ' '), btns: [...document.querySelectorAll('.tn-cmd .nbtn')].map(b => b.textContent), tiles: [...document.querySelectorAll('#vTiles .kt2')].map(t => t.textContent.replace(/\s+/g, ' ')), about: [...document.querySelectorAll('#vAbout .tn-lr')].map(r => r.querySelector('.l').textContent + '=' + r.querySelector('.v').textContent), link: document.querySelector('#vAbout a').getAttribute('href'), ts: [...document.querySelectorAll('#vStamps .tn-tr')].map(r => r.querySelector('b').textContent + '/' + r.querySelector('.kn1 span').textContent), fold: document.querySelector('#vFiles summary').textContent.replace(/\s+/g, ' '), open: document.querySelector('#vFiles').open, files: document.querySelectorAll('#vFileList li.ok').length, extras: !!document.querySelector('#vExtras'), zipTitle: document.querySelector('#vAbout .mono').title.length }));
  ok(/Nothing has changed since it was made/.test(g.ans) && /All 7 files match their fingerprints, and 3 outside timestamp services signed them on /.test(g.ans), 'A good pack gets one big green answer: ' + g.ans.slice(0, 90));
  ok(g.chip.includes(made + '.zip') && /KB · checked /.test(g.chip) && g.btns.join('|') === 'Check another pack|Check a folder|Check one file|Open the capture', 'The line under the title names the pack and holds the buttons: ' + g.btns.join(' · '));
  ok(g.tiles.length === 4 && /^7 of 7 ?Files match ?Nothing added or changed/.test(g.tiles[0]) && /^3 of 3 ?Timestamps signed ?FreeTSA, DigiCert, Sectigo/.test(g.tiles[1]) && /Captured .* ?Your time \(UTC 19:32\)/.test(g.tiles[2]) && /^Same zip ?As in your capture log ?Saved by Sam Tester/.test(g.tiles[3]), 'Four tiles: files, timestamps, when it was captured, and that it is the same zip as in the capture log');
  ok(g.about.some(x => x === 'Capture ID=PP-7KQ2M9') && g.about.some(x => x === 'Case=2026-HT-0417') && g.about.some(x => x === 'Collected by=Sam Tester') && g.about.some(x => /^Captured=.*\(19:32 UTC\)$/.test(x)) && g.link === 'https://harbortimes-example.com/2026/11/council-harbor-plan' && g.zipTitle === 64, 'About this capture is label rows, with the whole zip fingerprint to copy');
  ok(g.ts.length === 3 && g.ts[1] === 'DigiCert/DigiCert Timestamp Responder' && /^7 files, all match/.test(g.fold) && !g.open && g.files === 7 && !g.extras, 'Timestamps as rows, and the seven file names tucked in a "7 files, all match" fold');

  // ---- a changed pack
  await v.evaluate(() => handle(new File([parent.__packs.bad], 'changed.zip', { type: 'application/zip' })));
  await v.waitForSelector('#vAnswer.bad', { timeout: 30000 });
  const b = await v.evaluate(() => ({ ans: document.querySelector('#vAnswer').textContent.replace(/\s+/g, ' '), files: document.querySelector('#vtFiles').textContent.replace(/\s+/g, ' '), zip: document.querySelector('#vtZip').textContent, open: document.querySelector('#vFiles').open, first: [...document.querySelectorAll('#vFileList li')].slice(0, 2).map(l => l.className + ':' + l.textContent), extras: document.querySelector('#vExtras').textContent, openBtn: !!document.querySelector('#vOpen') }));
  ok(/Warning: this pack has been changed/.test(b.ans) && /1 file was changed, 1 file is missing/.test(b.ans) && /^5 of 7 ?Files match ?1 changed, 1 missing/.test(b.files), 'A changed pack gets a red warning that says what is wrong: ' + b.ans.slice(0, 100));
  ok(b.open && b.first.every(x => /^no:(CHANGED|MISSING): /.test(x)) && /1 file is not covered by the fingerprints/.test(b.extras) && /extra-note\.txt/.test(b.extras) && /Not in the log/.test(b.zip) && !b.openBtn, 'The file list opens by itself with the bad files on top, and an added file is called out');
  // ---- no timestamps
  await v.evaluate(() => handle(new File([parent.__packs.nots], 'nots.zip', { type: 'application/zip' })));
  await v.waitForSelector('#vAnswer.warn', { timeout: 30000 });
  ok(await v.evaluate(() => /The files match, but nothing proves when/.test(document.querySelector('#vAnswer').textContent) && /No timestamp receipts/.test(document.querySelector('#vStamps').textContent)), 'A pack without timestamps gets a yellow answer');
  // ---- one file, then something that is not a pack
  await v.evaluate(() => handle(new File(['jpg1'], 'img-01.jpg')));
  await v.waitForSelector('#vOneFile', { timeout: 30000 });
  const o = await v.evaluate(() => ({ ans: document.querySelector('#vAnswer').textContent, fp: document.querySelector('#vOneFile .mono').textContent.length }));
  ok(/This file is in the pack you checked/.test(o.ans) && /images\/img-01\.jpg/.test(o.ans) && o.fp === 64, 'One file dropped after a pack: its fingerprint, and that it is in that pack');
  await v.evaluate(() => handle(new File([new Uint8Array([0x50, 0x4b, 3, 4, 0, 0])], 'broken.zip')));
  await v.waitForFunction(() => /This could not be checked/.test((document.querySelector('#vAnswer') || {}).textContent || ''), null, { timeout: 30000 });
  ok(true, 'A file that is not a pack says so calmly');

  // ---- Opened lately
  await page.evaluate(() => { location.hash = 'tools'; }); await page.waitForSelector('#tlRecent .tn-rr', { timeout: 30000 }); await T();
  const r = await page.evaluate(async () => ({ rows: [...document.querySelectorAll('#tlRecent .tn-rr')].map(x => x.querySelector('b').textContent + ' / ' + x.querySelector('.kn1 > span').textContent.replace(/\s+/g, ' ').trim()), stored: (await chrome.storage.local.get('ppToolsRecent')).ppToolsRecent.map(x => Object.keys(x).sort().join()) }));
  ok(r.rows.length === 4 && r.rows[0].startsWith('broken.zip / Verify a pack · Today ') && r.rows.some(x => x.startsWith(made + '.zip / Verify a pack')) && r.stored.every(k => k === 'again,at,id,names,thumb,tool'), 'Opened lately lists the files opened in a tool, newest first, with the tool and the time: ' + r.rows[0]);
  await page.click('#tlRecent .tn-rr [data-act="tlforget"]'); await T(600);
  ok(await page.evaluate(() => document.querySelectorAll('#tlRecent .tn-rr').length) === 3, 'The X takes a file off the list');
  await page.click('#tlRecent .tn-rr [data-act="tlagain"]'); await page.waitForFunction(() => location.hash === '#verify', null, { timeout: 20000 }); await T(600);
  ok(await page.evaluate(() => /again here/.test((document.querySelector('.toast, #toast') || document.body).textContent)), 'Open again opens the tool; a file the browser has no pass for is asked for again');
  // a photo: a tiny picture in the list, and the list shows on a tool's empty page
  await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 600; c.height = 400; const x = c.getContext('2d'); x.fillStyle = '#246'; x.fillRect(0, 0, 600, 400); const blob = await new Promise(r => c.toBlob(r, 'image/jpeg')); await PP_TOOLS.note('inspect', [new File([blob], 'harbour.jpg', { type: 'image/jpeg' })]); });
  await page.evaluate(() => { location.hash = 'tools'; }); await page.waitForSelector('#tlRecent .tn-rr img', { timeout: 20000 });
  const ph = await page.evaluate(async () => ({ row: document.querySelector('#tlRecent .tn-rr').textContent.replace(/\s+/g, ' '), thumb: (await chrome.storage.local.get('ppToolsRecent')).ppToolsRecent[0].thumb.length }));
  ok(/harbour\.jpg ?Inspect a photo/.test(ph.row) && ph.thumb > 200 && ph.thumb < 12000, 'A photo gets a tiny picture in the list (' + ph.thumb + ' letters, never the photo itself)');
  await page.goto(url('app.html#verify')); await page.waitForFunction(() => { const f = document.querySelector('iframe.tool'); return f && f.contentDocument && f.contentDocument.querySelector('#vRoot .tn-recent'); }, null, { timeout: 30000 });
  ok(await frame('verify.html').evaluate(() => document.querySelectorAll('.tn-recent .tn-rr').length >= 3 && /harbour\.jpg/.test(document.querySelector('.tn-recent').textContent)), 'Opened lately also shows on a tool that has nothing open');
  const bk = await page.evaluate(() => fetch('pp-backup.js').then(r => r.text()));
  ok(!/ppToolsRecent/.test(bk), 'The list stays on this computer: it is not part of the backup');

  // ---- the checker inside a pack keeps its plain look
  const st = await page.evaluate(async () => { await new Promise((ok, bad) => { const s = document.createElement('script'); s.src = 'checker.js'; s.onload = ok; s.onerror = bad; document.head.append(s); }); const html = await standaloneChecker(); return { calm: /<script src="ui\/|calm-(tools|search)\.css/.test(html), alone: /PP_STANDALONE = true/.test(html), check: /async function checkFiles/.test(html), drop: /Drop a PageProof evidence pack/.test(html) }; });
  ok(!st.calm && st.alone && st.check && st.drop, 'The checker placed inside every evidence pack does not carry the new look: it stays as it was');

  // ---- narrow + dark
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(url('app.html#tools')); await page.waitForSelector('#tlTiles'); await T();
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'All tools at 1280 wide: nothing runs off the side');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'dark' })); await page.reload(); await page.waitForSelector('#tlTiles'); await T();
  const d = await page.evaluate(() => ({ card: getComputedStyle(document.querySelector('.tn-tile')).backgroundColor, ink: getComputedStyle(document.querySelector('.tn-tile b')).color }));
  ok(d.card === 'rgb(43, 43, 43)' && +d.ink.match(/\d+/)[0] > 220, `Dark: grey cards, light words (${d.card}, ${d.ink})`);
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
