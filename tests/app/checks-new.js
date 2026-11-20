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
  await page.click('tr.frow'); await page.waitForTimeout(600);
  ok(await page.evaluate(() => !/No registration number found/.test(document.getElementById('drawer').textContent)), 'Details panel: the "No registration number found" box is gone');
  const ap = await page.evaluate(async () => {
    const c = FCD.copies.find(x => x.id === state.open); const base = FC.baseOf(c.site);
    const before = FCD.copies.filter(x => FC.baseOf(x.site) === base && x.status === 'new');
    document.querySelector('[data-act="openok"]').click();
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
  const lights = await page.evaluate(() => [...document.querySelectorAll('.card .row b')].map(b => b.textContent));
  console.log(lights.join(' | '));
  ok(lights.includes('Google Drive photos') && lights.includes('Google Lens') && lights.includes('PageProof version'), 'Health page shows the lights');
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await page.click('[data-act="supportcopy"]'); await page.waitForTimeout(2000);
  const sup = await page.evaluate(() => state.support);
  console.log(sup.split('\n').slice(0, 40).join('\n'));
  ok(sup.includes('Photos: 3,00') && !/Client [A-Z] Media|IMG_0|site\d+\./.test(sup), 'Copy details: numbers only, no client, photo or site names');

  // ---- update: unpack checks + write into a folder (a pretend install folder)
  const up = await page.evaluate(async () => {
    const enc = s => new TextEncoder().encode(s);
    const mine = await (await fetch(chrome.runtime.getURL('manifest.json'))).text();
    const root = await navigator.storage.getDirectory();
    const inst = await root.getDirectoryHandle('install', { create: true });
    const w = await (await inst.getFileHandle('manifest.json', { create: true })).createWritable(); await w.write(mine); await w.close();
    const same = await PP_UPDATE.isInstallFolder(inst);
    const other = await root.getDirectoryHandle('other', { create: true });
    const notSame = await PP_UPDATE.isInstallFolder(other);
    await RS_DB.put('handles', 'ppInstall', inst);
    return { same, notSame, newer: [PP_UPDATE.newer('4.1.1', '4.1.0'), PP_UPDATE.newer('4.1.0', '4.1.0'), PP_UPDATE.newer('4.0.15', '4.1.0'), PP_UPDATE.newer('4.10.0', '4.9.9')] };
  });
  console.log(JSON.stringify(up));
  ok(up.same && !up.notSame && up.newer.join() === 'true,false,false,true', 'Update: only the real install folder is accepted; version compare is right');
  const fs = require('fs'), cp = require('child_process');
  // Two zips: one that says it is a much newer version (with one extra file), one that is the same version.
  const EXT = require('path').resolve(__dirname, '../../extension'), TMP = fs.mkdtempSync(require('path').join(require('os').tmpdir(), 'ppzip-'));
  cp.execSync(`cp -r "${EXT}" "${TMP}/e"`);
  const man = JSON.parse(fs.readFileSync(TMP + '/e/manifest.json', 'utf8')); man.version = '99.0.0'; fs.writeFileSync(TMP + '/e/manifest.json', JSON.stringify(man, null, 2));
  fs.writeFileSync(TMP + '/e/ui/brand-new.js', '// new file\n');
  cp.execSync(`cd "${TMP}/e" && zip -qr ../new.zip . && cd "${EXT}" && zip -qr "${TMP}/same.zip" .`);
  await ctx.route('**/releases/download/latest/PageProof.zip*', r => r.fulfill({ status: 200, contentType: 'application/zip', body: fs.readFileSync(TMP + '/new.zip') }));
  await ctx.route('**/raw.githubusercontent.com/**', r => r.fulfill({ status: 200, contentType: 'text/plain', body: fs.readFileSync(TMP + '/e/manifest.json') }));
  const chk = await page.evaluate(() => PP_UPDATE.check());
  console.log(JSON.stringify(chk));
  ok(chk.has && chk.latest === '99.0.0', 'Update: a newer version on GitHub is noticed');
  await page.reload(); await page.waitForTimeout(1200);
  const ap2 = await page.evaluate(async () => {
    const t0 = performance.now();
    const r = await PP_UPDATE.apply(null, { noReload: true });
    const root = await navigator.storage.getDirectory(); const inst = await root.getDirectoryHandle('install');
    const m = JSON.parse(await (await (await inst.getFileHandle('manifest.json')).getFile()).text());
    const ui = await inst.getDirectoryHandle('ui'); const nf = await (await (await ui.getFileHandle('brand-new.js')).getFile()).text();
    const lib = await inst.getDirectoryHandle('lib'); let n = 0; for await (const x of lib.keys()) n++;
    const app = (await (await inst.getFileHandle('app.js')).getFile()).size, real = (await (await fetch(chrome.runtime.getURL('app.js'))).blob()).size;
    return { r, v: m.version, nf: nf.trim(), lib: n, sameSize: app === real, ms: Math.round(performance.now() - t0), flag: (await chrome.storage.local.get('ppUpdated')).ppUpdated.to };
  });
  console.log(JSON.stringify(ap2));
  ok(ap2.v === '99.0.0' && ap2.nf === '// new file' && ap2.lib > 3 && ap2.sameSize && ap2.flag === '99.0.0', 'Update now: downloads, unpacks and writes every file into the folder (' + ap2.r.files + ' files, ' + ap2.ms + ' ms)');
  await ctx.unroute('**/releases/download/latest/PageProof.zip*');
  await ctx.route('**/releases/download/latest/PageProof.zip*', r => r.fulfill({ status: 200, contentType: 'application/zip', body: fs.readFileSync(TMP + '/same.zip') }));
  const stale = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory(); const inst = await root.getDirectoryHandle('install');
    const mine = await (await fetch(chrome.runtime.getURL('manifest.json'))).text();
    const w = await (await inst.getFileHandle('manifest.json', { create: true })).createWritable(); await w.write(mine); await w.close();
    try { await PP_UPDATE.apply(null, { noReload: true }); return 'applied'; } catch (e) { return e.message; }
  });
  console.log(stale); ok(/still packing/.test(stale), 'Update: a zip that is not newer is refused');
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
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await ctx.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
