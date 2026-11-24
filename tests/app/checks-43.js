// Checks for 4.3: the Capture page's proof checklist, line icons and dark colours in the tools,
// the storage meter, keyboard help and keys, text size, and the new One at a time page.
// Pretend sites and pretend pictures only, served from this computer.
const { start } = require('./h.js');
const http = require('http');
process.env.NP = 3000; process.env.NC = 400;
const { seed } = require('./seed.js');
const SHOTS = process.env.SHOTS || '';
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  const srv = http.createServer((q, r) => {
    if (q.url.endsWith('.png')) { r.writeHead(200, { 'content-type': 'image/png' }); return r.end(png); }
    r.writeHead(200, { 'content-type': 'text/html' });
    r.end('<title>Pretend shop</title><body style="font:18px sans-serif;margin:40px"><h1>Pretend shop</h1><img src="/a.png" width="300" height="200"><p>' + 'Some words about a product. '.repeat(150) + '</p></body>');
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const { ctx, sw, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  const shot = async (n, p) => { if (SHOTS) await (p || page).screenshot({ path: SHOTS + '/' + n + '.png' }); };
  const go = async h => { await page.goto(url('app.html#' + h)); await page.waitForTimeout(1200); };
  await go('help'); await seed(page); await page.reload(); await page.waitForTimeout(1000);
  await page.evaluate(() => chrome.storage.local.set({ ppSetupDone: true }));

  // ---- One at a time
  await go('review');
  const rv = await page.evaluate(() => ({ ans: [...document.querySelectorAll('.rvans button')].map(b => b.textContent.replace(/\s+/g, ' ').trim()), prog: (document.querySelector('.rvprog b') || {}).textContent, link: !!document.querySelector('.rvsite a.curl'), page: !!document.querySelector('#pgbox'), more: [...document.querySelectorAll('.rvmore .btn')].map(b => b.textContent.trim()).join('|'), site: document.querySelector('.rvsite h2').textContent }));
  ok(rv.ans.length === 4 && /^Stolen ?Y$/.test(rv.ans[0]) && /^Skip/.test(rv.ans[3]), 'One at a time has the wide answer row: ' + rv.ans.join(', '));
  ok(/^1 of \d/.test(rv.prog) && rv.link && rv.page, 'One at a time shows progress, the page link and Their page (' + rv.prog + ')');
  ok(/Compare/.test(rv.more) && /Evidence report/.test(rv.more) && /Capture/.test(rv.more) && /Approve site/.test(rv.more), 'One at a time has Compare, Evidence report, Capture and Approve site');
  await shot('review');
  await page.keyboard.press('y'); await page.waitForTimeout(1200);
  const rv2 = await page.evaluate(() => ({ prog: document.querySelector('.rvprog b').textContent, site: document.querySelector('.rvsite h2').textContent, undo: !document.querySelector('.rvtop [data-act="undo"]').disabled }));
  ok(/^2 of /.test(rv2.prog) && rv2.undo, 'Answering with Y moves the progress on to ' + rv2.prog + ' and switches Undo on');
  await page.keyboard.press('u'); await page.waitForTimeout(1200);
  ok((await page.evaluate(() => document.querySelector('.rvsite h2').textContent)) === rv.site, 'U brings the answered copy back');
  await page.keyboard.press('s'); await page.waitForTimeout(600);
  ok(await page.evaluate(() => !!document.querySelector('#swipe')), 'S still switches to Swipe');
  await page.keyboard.press('s'); await page.waitForTimeout(400);

  // ---- keyboard help and keys
  await go('found');
  await page.keyboard.press('?'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => { const k = document.getElementById('keyhelp'); return k && !k.hidden && /Jump to the search box/.test(k.textContent) && /Stolen/.test(k.textContent); }), 'Pressing ? opens the keyboard help');
  await shot('keys');
  await page.keyboard.press('y'); await page.waitForTimeout(200);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.getElementById('keyhelp').hidden && !HIST.length), 'Esc closes it, and keys pressed while it is open answer nothing');
  await page.evaluate(() => { state.open = ''; return render(true); }); await page.waitForTimeout(600);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(200);
  const cur = await page.evaluate(() => { const rows = [...document.querySelectorAll('#view .frow.crow')]; return { i: rows.findIndex(r => r.classList.contains('cur')), id: (rows.find(r => r.classList.contains('cur')) || { dataset: {} }).dataset.v }; });
  ok(cur.i === 1, 'Down arrow moves a marker down the list (row ' + (cur.i + 1) + ')');
  await page.keyboard.press('Enter'); await page.waitForTimeout(1000);
  ok(await page.evaluate(id => state.open === id && !!document.querySelector('.drawer'), cur.id), 'Enter opens that copy');
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(900);
  ok(await page.evaluate(id => state.open && state.open !== id, cur.id), 'With a copy open, the down arrow goes to the next copy');
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  await page.keyboard.press('/'); await page.waitForTimeout(200);
  ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'ppSearch'), '/ jumps to the search box');
  await page.keyboard.type('y?'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.getElementById('ppSearch').value === 'y?' && document.getElementById('keyhelp').hidden && !HIST.length), 'Typing in the search box is just typing');
  await page.evaluate(() => { const s = document.getElementById('ppSearch'); s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); s.blur(); }); await page.waitForTimeout(900);

  // ---- storage meter: Licensed and Removed may be cleared, Stolen never
  const ids = await page.evaluate(async () => {
    await loadFC();
    const pick = s => FCD.copies.find(c => c.status === s).id;
    const ids = { stolen: pick('stolen'), licensed: pick('licensed'), removed: pick('removed') };
    for (const id of Object.values(ids)) { await FC.kept.put(id, { blob: new Blob([new Uint8Array(50000)]), type: 'image/jpeg', size: 50000, sha: 'ab'.repeat(32), at: new Date().toISOString() }); await FC.pages.put(id, { pic: 'data:image/jpeg;base64,' + 'A'.repeat(20000), at: new Date().toISOString() }); }
    return ids;
  });
  await go('health');
  await page.waitForSelector('#storage .stopt', { timeout: 20000 }).catch(async () => console.log('storage card says: ' + await page.evaluate(() => (document.querySelector('#storage') || document.body).textContent.slice(0, 300) + ' | route ' + location.hash + ' shown ' + state.shown)));
  const st = await page.evaluate(() => ({ text: document.querySelector('#storage').textContent, opts: document.querySelectorAll('#storage .stopt').length, btn: document.querySelector('[data-act="stfree"]').disabled }));
  ok(st.opts === 3 && /Kept copies of their pictures \(3\)/.test(st.text) && /never deleted here/.test(st.text) && st.btn, 'Storage meter lists what takes room, and the button waits for a tick');
  await page.evaluate(() => document.getElementById('storage').scrollIntoView()); await shot('storage');
  await page.click('#storage .stopt input[data-v="ans"]'); await page.waitForTimeout(500);
  ok(await page.evaluate(() => /^Free up \d/.test(document.querySelector('[data-act="stfree"]').textContent)), 'Ticking a box says how much will be freed');
  await page.click('[data-act="stfree"]'); await page.waitForSelector('#storage .stopt', { timeout: 20000 }); await page.waitForTimeout(500);
  const left = await page.evaluate(async ids => ({ stolen: !!(await FC.kept.get(ids.stolen)) && !!(await FC.pages.get(ids.stolen)), licensed: !!(await FC.kept.get(ids.licensed)) || !!(await FC.pages.get(ids.licensed)), removed: !!(await FC.kept.get(ids.removed)) }), ids);
  ok(left.stolen && !left.licensed && !left.removed, 'Free up space clears Licensed and Removed pictures and leaves the Stolen one alone');

  // ---- text size
  await go('settings');
  await page.click('#textsize [data-v="large"]'); await page.waitForTimeout(800);
  const z = await page.evaluate(async () => ({ z: await chrome.tabs.getZoom(), on: document.querySelector('#textsize .on').dataset.v }));
  ok(Math.abs(z.z - 1.1) < 0.01 && z.on === 'large', 'Text size Large makes PageProof 10% bigger (zoom ' + z.z + ')');
  await shot('textsize');
  await page.click('#textsize [data-v="normal"]'); await page.waitForTimeout(600);
  ok(Math.abs(await page.evaluate(() => chrome.tabs.getZoom()) - 1) < 0.01, 'Normal puts it back');

  // ---- line icons and dark colours in the tools
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2B07}\u{2705}\u{270F}\u{2702}\u{2709}]/u;
  for (const f of ['inspect.html', 'compare.html', 'markup.html', 'convert.html', 'revsearch.html']) {
    const p = await ctx.newPage(); await p.goto(url(f)); await p.evaluate(() => { document.documentElement.dataset.theme = 'dark'; }); await p.waitForTimeout(700);
    const r = await p.evaluate(() => {
      const lum = c => { const m = c.match(/[\d.]+/g).map(Number); return m.length > 3 && m[3] === 0 ? -1 : (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };
      const light = [...document.querySelectorAll('body *')].filter(e => e.offsetParent && !e.closest('canvas,img,.tic,#board,#view,input') && e.getBoundingClientRect().width > 30 && lum(getComputedStyle(e).backgroundColor) > 0.85);
      return { labels: [...document.querySelectorAll('button,a,summary,h1,h2,h3')].filter(e => e.offsetParent).map(e => e.textContent).join(' '), icons: document.querySelectorAll('.tic svg').length, light: light.slice(0, 3).map(e => e.tagName + '.' + e.className) };
    });
    ok(!EMOJI.test(r.labels) && r.icons > 2, f + ': buttons use line icons, no emoji (' + r.icons + ' icons)');
    ok(!r.light.length, f + ': nothing is left white in dark mode ' + r.light.join(', '));
    await shot('dark-' + f.replace('.html', ''), p);
    await p.close();
  }

  // ---- Capture page: proof checklist and the two numbered steps
  const site = await ctx.newPage(); await site.goto('http://127.0.0.1:' + srv.address().port + '/'); await site.waitForTimeout(800); await site.bringToFront();
  const [v] = await Promise.all([
    ctx.waitForEvent('page', { predicate: x => x.url().includes('viewer.html'), timeout: 60000 }),
    sw.evaluate(async () => { const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); capture(t); }),
  ]);
  await v.waitForSelector('#pack');
  await v.waitForFunction(() => !document.getElementById('pack').disabled, null, { timeout: 120000 });
  const cap = await v.evaluate(() => ({
    proof: [...document.querySelectorAll('#proof li:not([hidden])')].map(l => l.className + ':' + l.textContent.trim()),
    order: [...document.querySelectorAll('#side > *')].filter(e => !e.hidden).map(e => e.id).filter(Boolean).join(' '),
    steps: [...document.querySelectorAll('#side h3')].map(h => h.textContent.trim()).join(' | '),
    fields: [...document.querySelectorAll('#caseBox label')].map(l => l.textContent.trim().split(' ')[0]).join(' '),
    tiles: [...document.querySelectorAll('#saveBox .tile')].map(b => b.textContent.trim()).join(' '),
    emoji: document.getElementById('side').textContent,
    sheet: !!document.querySelector('#preview img'),
  }));
  ok(cap.proof.length === 4 && /^ok:Whole page captured/.test(cap.proof[0]) && /^ok:1 picture saved/.test(cap.proof[1]) && /^ok:Fingerprints made for \d+ files/.test(cap.proof[2]) && !/^wait/.test(cap.proof[3]), 'Capture page proof checklist: ' + cap.proof.join('; '));
  ok(/proof caseBox saveBox/.test(cap.order) && /1\s*Case details \| 2\s*Save/.test(cap.steps) && cap.fields === 'Case Notes Collected', 'Capture page: step 1 Case details comes before step 2 Save (' + cap.steps + ')');
  ok(cap.tiles === 'Copy Markup PDF HTML' && !EMOJI.test(cap.emoji) && cap.sheet, 'Capture page keeps Copy, Markup, PDF and HTML, with line icons');
  await shot('capture', v);

  await ctx.close(); srv.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
