// Checks for 4.15 (mistake-proofing): the "Before you save" check, the blocked page warning,
// "is your photo on the capture", the capture pausing when you switch tabs, held keys and the
// "That was quick" note, Stolen copies kept when a site is hidden or copies are removed in a
// group, the folder notes in setup, greyed-out buttons that explain themselves, and the Keep
// searching tab coming back when it is closed by mistake.
// Pretend sites and pretend pictures only, served from this computer.
const { start } = require('./h.js');
const http = require('http');
process.env.NP = 3000; process.env.NC = 400;
const { seed } = require('./seed.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };

// The same made-up "photo" drawn on the pretend site and handed to PageProof as the client's photo.
const DRAW = `(seed, w, h) => { let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.fillStyle = '#ddd'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) { x.fillStyle = 'hsl(' + Math.floor(r() * 360) + ',70%,' + Math.floor(20 + r() * 60) + '%)';
    const k = r(); if (k < .4) x.fillRect(r() * w, r() * h, 8 + r() * 60, 8 + r() * 60); else if (k < .8) { x.beginPath(); x.arc(r() * w, r() * h, 4 + r() * 30, 0, 7); x.fill(); } else { x.font = (10 + r() * 30) + 'px sans-serif'; x.fillText('PP' + i, r() * w, r() * h); } }
  return c.toDataURL('image/jpeg', .92); }`;

(async () => {
  const srv = http.createServer((q, r) => {
    r.writeHead(200, { 'content-type': 'text/html' });
    if (q.url.startsWith('/login')) return r.end('<title>Instagram</title><body style="font:18px sans-serif;margin:40px"><h1>Log in to see photos and videos from friends.</h1><input type="password"><p>Short page.</p></body>');
    if (q.url.startsWith('/photo')) return r.end(`<title>Pretend blog</title><body style="font:18px sans-serif;margin:40px"><h1>Pretend blog post</h1><p>${'Words about something. '.repeat(40)}</p><img id="i" width="700" height="460"><p>${'More words. '.repeat(400)}</p><script>document.getElementById('i').src = (${DRAW})(12345, 700, 460);</script></body>`);
    if (q.url.startsWith('/long')) return r.end(`<title>Long page</title><body style="font:18px sans-serif;margin:40px">${Array.from({ length: 40 }, (_, i) => '<h2>Part ' + i + '</h2><p>' + 'Text '.repeat(200) + '</p>').join('')}</body>`);
    r.end('<title>Pretend shop</title><body><h1>Pretend shop</h1><p>' + 'Some words. '.repeat(300) + '</p></body>');
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const { ctx, sw, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  const go = async h => { await page.goto(url('app.html#' + h)); await page.waitForTimeout(1200); };
  await go('help'); await seed(page); await page.reload(); await page.waitForTimeout(1000);

  const captureOf = async (path, before) => {
    const site = await ctx.newPage(); await site.goto(base + path); await site.waitForTimeout(900); await site.bringToFront();
    const [v] = await Promise.all([
      ctx.waitForEvent('page', { predicate: x => x.url().includes('viewer.html'), timeout: 120000 }),
      (async () => { if (before) await before(site); })(),
      sw.evaluate(async () => { const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); startCapture(t); }),
    ]);
    v.on('pageerror', e => { fails++; console.log('PAGEERROR viewer', String(e).slice(0, 300)); });
    await v.waitForSelector('#pack');
    await v.waitForFunction(() => !document.getElementById('pack').disabled, null, { timeout: 180000 });
    return { v, site };
  };

  // ---- 1 + 3: a login wall, and Save with no case number
  {
    const { v, site } = await captureOf('/login');
    const w = await v.evaluate(() => ({ shown: !document.getElementById('warnBox').hidden, text: document.getElementById('warnBox').textContent }));
    ok(w.shown && /log in/i.test(w.text) && /Capture again/.test(w.text), 'A login wall gets the red "may not show the real page" box: ' + w.text.slice(0, 90));
    await v.click('#pack'); await v.waitForTimeout(800);
    const c = await v.evaluate(() => ({ shown: !document.getElementById('checkBox').hidden, text: document.getElementById('checkBox').textContent, miss: document.getElementById('caseRef').classList.contains('miss'), focus: document.activeElement && document.activeElement.id }));
    ok(c.shown && /case number is empty/i.test(c.text) && /not the real page|real page/i.test(c.text) && /Save anyway/.test(c.text), 'Save first shows "Before you save" with the empty case number and the blocked page');
    ok(c.miss && c.focus === 'caseRef', 'The case number box is lit up and has the cursor');
    const dl = v.waitForEvent('download', { timeout: 20000 }).catch(() => null);
    await v.click('#ckAnyway');
    ok(!!(await dl), 'Save anyway saves the pack');
    await v.close(); await site.close();
  }

  // ---- 1: a normal page with a case number saves straight away
  {
    const { v, site } = await captureOf('/');
    ok(await v.evaluate(() => document.getElementById('warnBox').hidden), 'A normal page gets no blocked-page box');
    await v.fill('#caseRef', 'CASE-0001');
    const dl = v.waitForEvent('download', { timeout: 20000 }).catch(() => null);
    await v.click('#pack');
    ok(!!(await dl) && await v.evaluate(() => document.getElementById('checkBox').hidden), 'With a case number and name, Save saves at once (no list)');
    await v.close(); await site.close();
  }

  // ---- 2: is the client's photo on the capture?
  for (const [seedN, want] of [[12345, 'ok'], [999, 'part']]) {
    await page.bringToFront();
    const pic = await page.evaluate(`(${DRAW})(${seedN}, 640, 420)`);
    await page.evaluate(([u, pic]) => chrome.storage.local.set({ fcCapFor: { url: u, id: 'x', at: Date.now(), pic } }), [base + '/photo', pic]);
    const { v, site } = await captureOf('/photo');
    await v.waitForFunction(() => !document.getElementById('pfOurs').hidden && document.getElementById('pfOurs').className !== 'wait', null, { timeout: 120000 });
    const o = await v.evaluate(() => ({ cls: document.getElementById('pfOurs').className, text: document.getElementById('pfOurs').textContent }));
    ok(o.cls === want, (want === 'ok' ? 'The same photo is found on the capture: ' : 'A different photo is reported missing: ') + o.text.slice(0, 80));
    await v.close(); await site.close();
  }
  await page.evaluate(() => chrome.storage.local.remove('fcCapFor'));

  // ---- 23: switching tabs mid-capture pauses it, and it carries on
  {
    const other = await ctx.newPage(); await other.goto(base + '/');
    const { v, site } = await captureOf('/long', async s => {
      await s.waitForTimeout(1500);
      await other.bringToFront();
      await other.waitForTimeout(2500);
      const badge = await sw.evaluate(() => chrome.action.getBadgeText({}));
      ok(badge === 'WAIT', 'Switching tabs mid-capture pauses it (badge ' + badge + ')');
      await s.bringToFront();
    });
    const d = await v.evaluate(() => document.getElementById('details').textContent);
    ok(/You switched tabs during this capture/.test(d), 'The capture finished after coming back, and its record says it was paused');
    const shots = await v.evaluate(() => document.querySelectorAll('#preview img').length);
    ok(shots >= 1, 'The long page was still captured');
    await v.close(); await site.close(); await other.close();
  }

  // ---- 10: held keys, and the "That was quick" note
  await page.bringToFront();
  await go('found');
  const k = await page.evaluate(async () => {
    const id = LIST[0]; state.open = id; await render(true); await new Promise(r => setTimeout(r, 400));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', repeat: true, bubbles: true }));
    await new Promise(r => setTimeout(r, 800));
    return { id, st: (await FC.DB.get('copies', id)).status };
  });
  ok(k.st === 'new', 'A held-down Y (key repeat) does not answer the copy');
  const fast = await page.evaluate(async () => {
    const ids = FCD.copies.filter(c => c.status === 'new').slice(0, 13).map(c => c.id);
    for (const id of ids) await answerCopies([id], 'removed', 'test');
    const a = document.getElementById('fastAsk');
    return { shown: !!a, text: a ? a.textContent : '', ids };
  });
  ok(fast.shown && /That was quick/.test(fast.text), 'After 12 quick answers, "That was quick" offers a look: ' + fast.text.slice(0, 60));
  await page.click('[data-act="fastlook"]'); await page.waitForTimeout(800);
  const fl = await page.evaluate(() => { const d = document.querySelector('dialog.fastlook'); return d ? d.querySelectorAll('[data-fopen]').length : 0; });
  ok(fl >= 12, 'Look at the last answers lists them with Change (' + fl + ')');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);

  // ---- 11: Stolen copies are kept when their site is hidden or picked copies are removed
  const st = await page.evaluate(async () => {
    const c = FCD.copies.find(x => x.status === 'new' && !isSoc(x));
    await answerCopies([c.id], 'stolen', 'test');
    const other = FCD.copies.find(x => x.status === 'new' && x.site === c.site && x.id !== c.id) || FCD.copies.find(x => x.status === 'new' && x.id !== c.id);
    await hideSite(c.site, c.site);
    const after = await FC.DB.get('copies', c.id);
    const hidden = FC.hiddenCopy(after, RS_LISTS.hidden);
    await RS_LISTS.remove('hidden', RS_SITE.tidy(c.site) || c.site);
    // Remove in a group: the Stolen one stays Stolen.
    dropFC(); await loadFC();
    state.picked = [c.id, other.id];
    await ACTS.bulk('removed');
    return { hidden, stolen: (await FC.DB.get('copies', c.id)).status, other: (await FC.DB.get('copies', other.id)).status };
  });
  ok(!st.hidden, 'Hiding the site of a Stolen copy does not hide that copy');
  ok(st.stolen === 'stolen' && st.other === 'removed', 'Remove on picked copies skips the Stolen one (' + st.stolen + ', other ' + st.other + ')');

  // ---- 14: folder notes in setup
  const cw = await page.evaluate(() => {
    state.csTree.set('Big group', Array.from({ length: 10 }, (_, i) => ({ name: 'C' + i, rel: 'Big group/C' + i })));
    return { q: csWarnFor('Client A/Registered images/2024'), big: csWarnFor('Big group'), fine: csWarnFor('Client A') };
  });
  ok(/year, quarter or day/.test(cw.q) && /10 folders/.test(cw.big) && !cw.fine, 'Setup explains a year folder and a big group folder, and says nothing for a client folder');

  // ---- 18: greyed-out buttons explain themselves
  const why = await page.evaluate(async () => {
    const b = document.createElement('button'); b.textContent = 'Test'; b.disabled = true; b.dataset.why = 'Because of a test.';
    b.style.cssText = 'position:fixed;left:40px;top:40px;width:120px;height:40px;z-index:99999'; document.body.appendChild(b);
    return true;
  });
  await page.mouse.move(100, 60); await page.waitForTimeout(150); await page.mouse.move(102, 61); await page.waitForTimeout(400);
  const tip = await page.evaluate(() => { const t = document.getElementById('ppWhy'); return t && t.isConnected ? t.textContent : ''; });
  ok(why && /Why is this off\?/.test(tip) && /Because of a test/.test(tip), 'Pointing at a greyed-out button shows why: ' + tip);

  // ---- 22: the Keep searching tab comes back when closed by hand
  await page.evaluate(() => chrome.storage.local.set({ fcKeep: { on: true }, fcPause: Date.now() }));
  await sw.evaluate(() => keepAlive(false, true));
  const runner = () => ctx.pages().find(p => p.url().includes('runner.html'));
  for (let i = 0; i < 20 && !runner(); i++) await page.waitForTimeout(500);
  ok(!!runner() && /leave open/.test(await runner().title()), 'The Keep searching tab says "leave open" in its title');
  await page.waitForTimeout(2000);
  await runner().close();
  let back = null; for (let i = 0; i < 20 && !back; i++) { await page.waitForTimeout(500); back = runner(); }
  const ro = await page.evaluate(() => chrome.storage.local.get('fcReopened'));
  ok(!!back && ro.fcReopened && ro.fcReopened.at, 'Closing it by hand opens it again by itself');
  await go('home');
  ok(/searching tab was closed, so PageProof opened it again/.test(await page.evaluate(() => document.body.textContent)), 'Home says it was opened again, with Pause searching');
  await page.waitForTimeout(2000);
  await back.close(); back = null; for (let i = 0; i < 12 && !back; i++) { await page.waitForTimeout(500); back = runner(); }
  ok(!!back, 'A second close brings it back too');
  await page.waitForTimeout(2000);
  await back.close(); back = null; for (let i = 0; i < 8 && !back; i++) { await page.waitForTimeout(500); back = runner(); }
  ok(!back, 'Closed three times in 10 minutes: it stays closed (someone really wants it closed)');

  // ---- the "still online" check is gone
  const gone = await page.evaluate(() => ({ fn: typeof FC.checkOnline, text: document.body.textContent }));
  ok(gone.fn === 'undefined' && !/Still online\?/.test(gone.text), 'The "still online" check is gone');

  await ctx.close(); srv.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
