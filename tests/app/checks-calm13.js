// The calm look, step 13: Clients › Skipped photos. Four reason cards that filter, the command bar
// (find, group, sort, Download list, Try all again), client folds, calm rows, tick boxes with a
// floating bar (lock on files PageProof can't read), the photo panel, Take off this list with Undo,
// the "N skipped" chip on Clients and photos, the calm empty page, and TIFF / HEIC photos read by
// PageProof itself, in memory only (pp-rawpic.js).
process.env.NP = process.env.NP || '2000'; process.env.NC = process.env.NC || '30';   // before seed.js is read
const fs = require('fs'), path = require('path');
const { start } = require('./h.js'); const { seed } = require('./seed.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const { ctx, url } = await start();
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(1200);
  await seed(page);
  const S = await page.evaluate(async () => {
    await chrome.storage.local.set({ ppTheme: 'light' });
    await FC.meta.set('rawRead', 1);
    const ps = (await FC.DB.all('photos')).slice(0, 90), kinds = ['gone', 'gone', 'empty', 'broken', 'type', 'gone', 'broken'];
    const list = ps.map((p, i) => [p.id, kinds[i % 7] === 'type' ? p.name.replace(/\.\w+$/, '.tif') : p.name, i % 23 === 0 ? '' : p.client, kinds[i % 7], new Date(Date.now() - i * 7.3 * 3600e3).toISOString()]);
    await FC.meta.set('skipped', list);
    const n = {}; for (const x of list) n[x[3]] = (n[x[3]] || 0) + 1;
    const by = {}; for (const x of list) by[x[2]] = (by[x[2]] || 0) + 1;
    return { n, total: list.length, top: Object.entries(by).filter(e => e[0]).sort((a, b) => b[1] - a[1])[0] };
  });
  const T = () => page.waitForTimeout(500);
  await page.goto(url('app.html#skipped')); await page.waitForSelector('#skipList .skr', { timeout: 60000 });

  // ---- top, reason cards
  const top = await page.evaluate(() => ({ h1: document.querySelector('.head h1').textContent.replace(/\s+/g, ' ').trim(), cards: [...document.querySelectorAll('#skipCards .skc')].map(c => [c.querySelector('.skcm b').textContent, c.querySelector('.skcn').textContent.trim()]), tabs: !!document.querySelector('.tabs [data-act="sktab"]'), jpg: /JPG copy|Convert files/i.test(document.querySelector('#content, main, body').textContent), menu: [...document.querySelectorAll('.subs a')].map(a => a.textContent.trim()) }));
  ok(/Skipped photos/.test(top.h1) && !top.tabs, 'Skipped photos has the calm top and no tab strip: ' + top.h1);
  ok(JSON.stringify(top.cards) === JSON.stringify([['TIFF or HEIC', String(S.n.type)], ['Moved or deleted', String(S.n.gone)], ['Empty file', String(S.n.empty)], ['Won\'t open', String(S.n.broken)]]), 'Four reason cards in plain words with their counts: ' + JSON.stringify(top.cards));
  ok(!top.jpg, 'Nothing tells anyone to save a JPG copy or convert the files');
  const tc = await page.evaluate(() => ({ type: document.querySelector('#skipCard-type').textContent, btn: !!document.querySelector('#skipCard-type [data-act="skretrykind"]'), gone: !!document.querySelector('#skipCard-gone [data-act="skretrykind"]') }));
  ok(/Left out of searches/.test(tc.type) && /Nothing in Drive is changed/.test(tc.type) && !tc.btn && tc.gone, 'The TIFF or HEIC card has no button (Left out of searches); the others have Try these again');

  // ---- click a card = filter
  await page.click('#skipCard-gone .skcn'); await T();
  let f = await page.evaluate(() => ({ on: document.querySelector('#skipCard-gone').classList.contains('on'), kinds: [...new Set([...document.querySelectorAll('.skr')].map(r => r.dataset.kind))], chip: (document.querySelector('.skfil') || {}).textContent, all: (document.querySelector('#skipRetryAll') || {}).textContent, foot: document.querySelector('#skipFoot').textContent }));
  ok(f.on && f.kinds.join() === 'gone' && /Moved or deleted/.test(f.chip) && f.all.includes('Try all ' + S.n.gone + ' again') && f.foot.includes(`Showing ${S.n.gone} of ${S.total}`), 'Clicking a reason card filters the list, shows a chip, and Try all counts just those: ' + f.all.trim());
  await page.click('.skfil .kx'); await T();
  f = await page.evaluate(() => ({ on: !!document.querySelector('.skc.on'), all: document.querySelector('.skall').textContent, retry: document.querySelector('#skipRetryAll').textContent }));
  ok(!f.on && f.all.includes(S.total + ' photos') && f.retry.includes(String(S.total - S.n.type)), 'The chip\'s X clears the filter; Try all leaves the TIFF or HEIC ones out: ' + f.retry.trim());

  // ---- client folds, rows
  const g = await page.evaluate(() => ({ groups: [...document.querySelectorAll('.skg')].map(x => [x.dataset.client, x.classList.contains('open'), x.querySelector('.skgn').textContent]), firstRows: document.querySelectorAll('.skg.open')[0].querySelectorAll('.skr').length, more: (document.querySelector('.skg.open [data-act="skallof"]') || {}).textContent, row: (() => { const r = document.querySelector('.skr[data-kind="gone"]'); return { ft: r.querySelector('.skft').textContent, folder: r.querySelector('.kn1 > span').textContent.trim(), why: r.querySelector('.skrs').textContent, when: r.querySelector('.skwh').textContent, again: !!r.querySelector('[data-act="skretry"]') }; })(), lock: (() => { const r = document.querySelector('.skr[data-kind="type"]'); return { box: !!r.querySelector('input'), lock: !!r.querySelector('.skck.lock'), txt: r.querySelector('.skra').textContent }; })() }));
  ok(g.groups.length > 1 && g.groups[0][1] && g.groups[1][1] && g.groups.slice(2).every(x => !x[1]) && g.firstRows === 6 && /Show all/.test(g.more || ''), 'Photos are grouped by client; the first two folds are open and show six rows with Show all: ' + g.groups.length + ' clients');
  ok(g.row.ft === 'JPG' && g.row.why === 'Moved or deleted' && /ago|Just now|Yesterday/.test(g.row.when) && g.row.again && !g.row.folder.startsWith(g.groups[0][0]), 'A row shows a file badge, the folder without the client name, the reason and how long ago: ' + JSON.stringify(g.row));
  ok(!g.lock.box && g.lock.lock && /Left out/.test(g.lock.txt), 'A file PageProof can\'t read has a lock, no tick box, and says Left out');
  await page.click('.skg:nth-of-type(3) .skgh'); await T();
  ok(await page.evaluate(() => document.querySelectorAll('.skg')[2].classList.contains('open')), 'Clicking a client line opens its fold');
  await page.click('.skg.open [data-act="skallof"]'); await T();
  ok(await page.evaluate(() => document.querySelectorAll('.skg.open')[0].querySelectorAll('.skr').length) > 6, 'Show all lists every photo from that client');

  // ---- find, group, sort
  await page.fill('#skQ', g.groups[1][0].slice(0, 9)); await page.waitForTimeout(900);
  let q = await page.evaluate(() => ({ groups: [...document.querySelectorAll('.skg')].map(x => x.dataset.client), focus: document.activeElement && document.activeElement.id }));
  ok(q.groups.length >= 1 && q.groups.includes(g.groups[1][0]) && q.focus === 'skQ', 'The find box narrows by client, folder or photo and keeps the cursor: ' + q.groups.join(', '));
  await page.fill('#skQ', 'zzzz-nothing'); await page.waitForTimeout(900);
  ok(await page.evaluate(() => !!document.querySelector('#skipNone [data-act="skclear"]')), 'Nothing found says so, with Show all skipped photos');
  await page.click('#skipNone [data-act="skclear"]'); await T();
  await page.selectOption('select[data-act="skgroup"]', 'none'); await T();
  await page.selectOption('select[data-act="sksort"]', 'old'); await T();
  const fl = await page.evaluate(() => ({ groups: document.querySelectorAll('.skg').length, client: !!document.querySelector('.skr.flat .skcl'), hd: document.querySelector('.skhd.flat').textContent, n: document.querySelectorAll('.skr').length, firstWhen: document.querySelector('.skr .skwh').title, lastWhen: [...document.querySelectorAll('.skr .skwh')].pop().title, unk: [...document.querySelectorAll('.skcl')].some(c => /Client unknown/.test(c.textContent)) }));
  ok(!fl.groups && fl.client && /Client/.test(fl.hd) && fl.n === S.total && new Date(fl.firstWhen) <= new Date(fl.lastWhen) && fl.unk, 'Group: None is one flat list with a Client column (Client unknown when there is none); Oldest first sorts it');
  await page.selectOption('select[data-act="skgroup"]', 'client'); await page.selectOption('select[data-act="sksort"]', 'new'); await T();

  // ---- download list
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('[data-act="skcsv"]')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8').replace(/^﻿/, '').split('\r\n');
  ok(/^PageProof_skipped-photos_\d{4}-\d\d-\d\d\.csv$/.test(dl.suggestedFilename()) && csv[0] === '"Photo","Client","Folder","Why","Skipped"' && csv.length === S.total + 1 && /"Moved or deleted"|"TIFF or HEIC"/.test(csv[1]), 'Download list saves a CSV with one line per photo: ' + dl.suggestedFilename());

  // ---- tick boxes + floating bar
  const picks = await page.evaluate(() => [...document.querySelectorAll('.skr input.skpick')].slice(0, 3).map(i => i.dataset.v));
  for (const id of picks) { await page.evaluate(v => document.querySelector(`.skr input.skpick[data-v="${CSS.escape(v)}"]`).click(), id); await page.waitForTimeout(250); }
  let b = await page.evaluate(() => ({ txt: (document.querySelector('#skipBulk') || {}).textContent, pan: !!document.querySelector('#skipPanel'), tk: document.querySelectorAll('.skr.tk').length }));
  ok(/3 picked/.test(b.txt || '') && /Try again/.test(b.txt) && /Copy folder paths/.test(b.txt) && /Take off this list/.test(b.txt) && !b.pan && b.tk === 3, 'Ticking photos shows a floating bar (Try again, Copy folder paths, Take off this list) and does not open the panel');
  await page.click('#skipBulk [data-v="paths"]'); await T();
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  ok(clip.split('\n').length >= 1 && clip.includes('/') && !/\.jpg/i.test(clip), 'Copy folder paths copies the folders, not the files: ' + clip.split('\n')[0]);
  await page.click('#skipBulk [data-v="off"]'); await T();
  let o = await page.evaluate(async ids => ({ left: (await FC.skipped()).length, there: (await FC.skipped()).some(x => ids.includes(x[0])), photos: (await FC.DB.getMany('photos', ids)).filter(Boolean).length, bar: !!document.querySelector('#skipBulk'), toast: (document.querySelector('.toast') || document.querySelector('#toast') || {}).textContent || '' }), picks);
  ok(o.left === S.total - 3 && !o.there && o.photos === 3 && !o.bar && /taken off this list/.test(o.toast) && /not touched/.test(o.toast), 'Take off this list removes the rows only (the photos stay): ' + o.toast.trim().slice(0, 90));
  await page.evaluate(() => undoLast()); await T();
  ok(await page.evaluate(async () => (await FC.skipped()).length) === S.total, 'Undo puts them back on the list');

  // ---- panel
  const pid = await page.evaluate(() => document.querySelector('.skr[data-kind="gone"]').dataset.id);
  await page.evaluate(v => document.querySelector(`.skr[data-id="${CSS.escape(v)}"] .kn1 b`).click(), pid); await page.waitForSelector('#skipPanel');
  const p = await page.evaluate(() => { const a = document.querySelector('#skipPanel'); return { txt: a.textContent.replace(/\s+/g, ' '), steps: a.querySelectorAll('.sksteps li').length, facts: a.querySelector('#skipFacts').textContent, btns: [...a.querySelectorAll('.skpb .btn')].map(x => x.textContent.trim()), sel: document.querySelectorAll('.skr.sel').length, body: document.body.classList.contains('cpopen') }; });
  ok(/Moved or deleted/.test(p.txt) && /What to do/.test(p.txt) && p.steps === 3 && /Next try by itself/.test(p.facts) && p.btns.join('|') === 'Try again now|Copy folder path|Take off this list' && p.sel === 1 && p.body, 'Clicking a row opens its panel: why, What to do in three steps, details, and three buttons');
  await page.click('#skipPanel [data-act="skpath"]'); await T();
  ok((await page.evaluate(() => navigator.clipboard.readText().catch(() => ''))).length > 3, 'Copy folder path copies where the photo lives');
  await page.keyboard.press('Escape'); await T();
  ok(!(await page.$('#skipPanel')), 'Escape closes the panel');
  const tid = await page.evaluate(() => document.querySelector('.skr[data-kind="type"]').dataset.id);
  await page.evaluate(v => ACTS.skpan(v), tid); await page.waitForSelector('#skipPanel');
  const tp = await page.evaluate(() => ({ btns: [...document.querySelectorAll('#skipPanel .skpb .btn')].map(x => x.textContent.trim()), facts: document.querySelector('#skipFacts').textContent, txt: document.querySelector('#skipPanel').textContent }));
  ok(tp.btns.join('|') === 'Copy folder path|Take off this list' && /Not tried again/.test(tp.facts) && !/JPG copy|Convert/i.test(tp.txt), 'A TIFF or HEIC photo\'s panel has no Try again and never says to convert it');
  await page.evaluate(() => ACTS.skpan(''));

  // ---- try again
  await page.evaluate(v => ACTS.skretry(v), pid); await T();
  let r = await page.evaluate(async v => ({ p: await FC.DB.get('photos', v), there: (await FC.skipped()).some(x => x[0] === v) }), pid);
  ok(r.p && r.p.retry === 1 && !r.p.unreadable && !r.there, 'Try again sends the photo to the front of the line and takes it off the list');
  await page.click('#skipCard-empty [data-act="skretrykind"]'); await T();
  r = await page.evaluate(async () => ({ empty: (await FC.skipped()).filter(x => x[3] === 'empty').length, on: !!document.querySelector('.skc.on'), zero: document.querySelector('#skipCard-empty').classList.contains('zero') }));
  ok(r.empty === 0 && !r.on && r.zero, 'Try these again on a card sends that whole reason and the card goes quiet (None right now)');

  // ---- idea 12: chip on Clients and photos
  await page.goto(url('app.html#clients')); await page.waitForSelector('#clientList .clr2', { timeout: 60000 });
  const chip = await page.evaluate(n => { const r = [...document.querySelectorAll('#clientList .clr2')].find(x => x.dataset.name === n); const c = r && r.querySelector('.skchip'); return c ? c.textContent : ''; }, S.top[0]);
  ok(/\d+ skipped ›/.test(chip), 'Clients and photos shows "N skipped ›" on a client with skipped photos: ' + chip);
  await page.evaluate(n => [...document.querySelectorAll('#clientList .clr2')].find(x => x.dataset.name === n).querySelector('.skchip').click(), S.top[0]);
  await page.waitForSelector('#skipList', { timeout: 30000 }); await T();
  const cf = await page.evaluate(() => ({ hash: location.hash, groups: [...document.querySelectorAll('.skg')].map(x => x.dataset.client), chip: (document.querySelector('.skfil') || {}).textContent }));
  ok(/^#skipped\?client=/.test(cf.hash) && cf.groups.length === 1 && cf.groups[0] === S.top[0] && cf.chip.includes(S.top[0]), 'The chip opens Skipped photos on just that client');

  // ---- narrow + dark
  await page.setViewportSize({ width: 1280, height: 800 }); await T();
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'At 1280 wide nothing runs off the side');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'dark' })); await page.reload(); await page.waitForSelector('#skipList', { timeout: 60000 }); await T();
  const d = await page.evaluate(() => ({ card: getComputedStyle(document.querySelector('#skipList')).backgroundColor, ink: getComputedStyle(document.querySelector('.skr .kn1 b')).color }));
  ok(d.card === 'rgb(43, 43, 43)' && +d.ink.match(/\d+/)[0] > 220, `Dark: grey card, light words (${d.card}, ${d.ink})`);
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'light' }));

  // ---- idea 11: TIFF and HEIC are read by PageProof itself, in memory only
  const raw = await page.evaluate(async () => {
    const add = s => new Promise((y, n) => { const e = document.createElement('script'); e.src = s; e.onload = y; e.onerror = n; document.head.append(e); });
    await add('lib/pako.min.js'); await add('lib/UTIF.js');
    const w = 320, h = 200, px = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; px[i] = x < w / 2 ? 220 : 20; px[i + 1] = y < h / 2 ? 200 : 40; px[i + 2] = 90; px[i + 3] = 255; }
    const tif = new File([UTIF.encodeImage(px, w, h)], 'Shoot_0001.tif', { type: 'image/tiff' });
    let native = true; try { await createImageBitmap(tif); } catch (e) { native = false; }
    const pic = await RS_JOB.prepare(tif, { fcId: 'x' });
    let mid = null;
    if (!pic.error) { const b = await createImageBitmap(pic.blob); const c = new OffscreenCanvas(b.width, b.height); c.getContext('2d').drawImage(b, 0, 0); mid = [...c.getContext('2d').getImageData(20, 20, 1, 1).data]; }
    let big = ''; try { await PP_RAW.bitmap({ name: 'huge.tif', size: PP_RAW.LIMIT.tiff + 1, arrayBuffer: async () => new ArrayBuffer(8) }); } catch (e) { big = e.message; }
    const junkT = await RS_JOB.prepare(new File([new Uint8Array(4000)], 'broken.tiff'));
    const junkH = await RS_JOB.prepare(new File([new Uint8Array(4000).fill(7)], 'IMG_0001.HEIC'));
    const junkJ = await RS_JOB.prepare(new File([new Uint8Array(4000)], 'photo.jpg'));
    return { native, err: pic.error || '', w: pic.w, h: pic.h, type: pic.blob && pic.blob.type, thumb: /^data:image\/jpeg/.test(pic.thumb || ''), mid, big, junkT, junkH, junkJ, heif: typeof libheif !== 'undefined' };
  });
  ok(!raw.native && !raw.err && raw.w === 320 && raw.h === 200 && raw.type === 'image/jpeg' && raw.thumb && raw.mid && raw.mid[0] > 180 && raw.mid[1] > 160, 'A TIFF photo the browser can\'t draw is read by PageProof and made ready to search (' + raw.w + ' x ' + raw.h + ', ' + JSON.stringify(raw.mid) + ') ' + raw.err);
  ok(/too big/.test(raw.big), 'A TIFF over the size limit is left out, not loaded: ' + raw.big);
  ok(raw.junkT.error && raw.junkT.raw === 1 && raw.junkH.error && raw.junkH.raw === 1 && raw.heif && raw.junkJ.error && !raw.junkJ.raw, 'A damaged TIFF or HEIC fails quietly (the HEIC reader loads); a damaged JPG is not counted as one');
  const src = fs.readFileSync(path.join(__dirname, '../../extension/pp-rawpic.js'), 'utf8'), store = fs.readFileSync(path.join(__dirname, '../../extension/fc-store.js'), 'utf8');
  ok(!/createWritable|getFileHandle\([^)]*create|showSaveFilePicker|\.write\(/.test(src), 'The TIFF / HEIC reader never writes a file (read only)');
  ok(!/Save a JPG copy/.test(store) && /const k = raw \? 'type' : 'broken'/.test(store), 'A TIFF or HEIC photo is tried first and only skipped when it really can\'t be read');
  const once = await page.evaluate(async () => {
    const ps = (await FC.DB.all('photos')).slice(100, 103); for (const p of ps) { p.unreadable = 'x'; p.skip = 'type'; } await FC.DB.putMany('photos', ps);
    await FC.meta.set('skipped', ps.map(p => [p.id, 'a.tif', p.client, 'type', new Date().toISOString()])); await FC.meta.set('rawRead', 0);
    const n = await FC.rawOnce(), again = await FC.rawOnce(); const after = await FC.DB.getMany('photos', ps.map(p => p.id));
    return { n, again, retry: after.every(p => p.retry === 1 && !p.unreadable), left: (await FC.skipped()).length };
  });
  ok(once.n === 3 && once.again === 0 && once.retry && once.left === 0, 'Once after the update, TIFF and HEIC photos skipped before go back to the line');

  // ---- empty page
  await page.goto(url('app.html#skipped')); await page.waitForSelector('#skipEmpty', { timeout: 60000 });
  const e = await page.evaluate(() => ({ t: document.querySelector('#skipEmpty').textContent, cards: !!document.querySelector('#skipCards') }));
  ok(/No skipped photos/.test(e.t) && /0 moved or deleted/.test(e.t) && !e.cards, 'With nothing skipped the page is one calm card: No skipped photos');
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
