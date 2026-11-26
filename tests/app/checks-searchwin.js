// Search tabs in one separate minimized "PageProof searching" window (4.57, Ben), with a
// setting to go back to pinned tabs in your own window.
const { start } = require('./h.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, sw, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  const a = await sw.evaluate(async () => {
    const out = {};
    const id = await ppSearchWindowBg();
    await new Promise(r => setTimeout(r, 600));
    const w = await chrome.windows.get(id, { populate: true });
    out.made = id != null; out.state = w.state; out.info = w.tabs.some(t => (t.url || t.pendingUrl || '').includes('searchwin.html'));
    out.same = (await ppSearchWindowBg()) === id;
    const both = await Promise.all([ppSearchWindowBg(), ppSearchWindowBg()]);
    out.one = both.every(x => x === id) && (await chrome.windows.getAll()).length === 2;
    out.own = (await normalWindows()).every(x => x.id !== id) && (await normalWindows()).length === 1;
    return out;
  });
  ok(a.made && a.info, 'the searching window opens with its "leave minimized" page');
  ok(a.state === 'minimized', 'it is minimized (' + a.state + ')');
  ok(a.same && a.one, 'asking again (even twice at once) uses the same window, never a second one');
  ok(a.own, 'the searching window does not count as one of your own windows');
  // From a PageProof page: search tabs go there, not pinned.
  const b = await page.evaluate(async () => {
    const me = await chrome.tabs.getCurrent();
    const sw = await ppSearchWindow();
    const t = await ppOpenSearchTab('about:blank#s1', me.windowId);
    return { inSw: t.windowId === sw && t.windowId !== me.windowId, pinned: t.pinned, active: t.active, tab: t.id };
  });
  ok(b.inSw && !b.pinned && !b.active, 'a search tab opened from a page goes into the searching window, in the background, not pinned');
  const c = await page.evaluate(async tab => { const t = await ppShowTab(tab); const w = await chrome.windows.get(t.windowId); return w.state; }, b.tab);
  ok(c !== 'minimized', 'Show me the tab (robot check) opens the minimized window (' + c + ')');
  // Closed by hand: a new one opens next time.
  const d = await sw.evaluate(async () => {
    const id = await ppSearchWindowBg(); await chrome.windows.remove(id); await new Promise(r => setTimeout(r, 800));
    const id2 = await ppSearchWindowBg(); return { again: id2 != null && id2 !== id };
  });
  ok(d.again, 'closed by hand: a fresh searching window opens the next time');
  // Keep searching's own tab lives in the searching window, and comes back when that window is closed by hand.
  await page.evaluate(() => chrome.storage.local.set({ fcKeep: { on: true }, fcDrive: { label: 'G:\\Photos', done: true } }));
  const k = await sw.evaluate(async () => {
    await keepAlive(false, true); await new Promise(r => setTimeout(r, 2500));
    const id = await ppSearchWindowBg();
    const run = async () => (await chrome.tabs.query({})).filter(t => /runner\.html/.test(t.url || t.pendingUrl || ''));
    const r1 = await run();
    const out = { inSw: r1.length === 1 && r1[0].windowId === id && !r1[0].pinned };
    await chrome.windows.remove(id); await new Promise(r => setTimeout(r, 4500));
    const r2 = await run(); const id2 = await ppSearchWindowBg(false);
    out.back = r2.length === 1 && id2 != null && r2[0].windowId === id2;
    const w2 = await chrome.windows.get(id2); out.min = w2.state;
    await chrome.storage.local.set({ fcKeep: { on: false }, ppRunnerQuit: Date.now() }); for (const t of r2) await chrome.tabs.remove(t.id).catch(() => {});
    return out;
  });
  ok(k.inSw, 'Keep searching opens in the searching window, not as a pinned tab in yours');
  ok(k.back && k.min === 'minimized', 'searching window closed by hand: Keep searching comes back in a new minimized one (' + k.min + ')');
  // Setting: pinned tabs.
  await page.evaluate(() => chrome.storage.local.set({ ppSearchPlace: 'pinned' }));
  await page.waitForTimeout(1500);
  const e = await page.evaluate(async () => {
    const me = await chrome.tabs.getCurrent();
    const t = await ppOpenSearchTab('about:blank#s2', me.windowId);
    return { gone: (await chrome.windows.getAll()).length === 1, pinned: t.pinned, here: t.windowId === me.windowId, none: (await ppSearchWindow()) == null };
  });
  ok(e.gone, 'switching to pinned tabs closes the searching window');
  ok(e.pinned && e.here && e.none, 'pinned tabs: search tabs open pinned in your own window as before');
  // The setting row on Keep searching.
  await page.evaluate(() => chrome.storage.local.set({ ppSearchPlace: 'window', fcDrive: { label: 'G:\\Shared drives\\Photos', done: true } }));
  await page.goto(url('app.html#keep?tab=settings')); await page.waitForTimeout(2500);
  const txt = await page.evaluate(() => document.body.innerText);
  ok(/Where searches run/.test(txt) && /Separate minimized window/.test(txt) && /Pinned tabs/.test(txt), 'Keep searching shows the Where searches run setting');
  const f = await page.evaluate(async () => { const b = [...document.querySelectorAll('[data-act="searchplace"]')].find(x => /Pinned/.test(x.textContent)); if (!b) return 'none'; b.click(); await new Promise(r => setTimeout(r, 500)); return (await chrome.storage.local.get('ppSearchPlace')).ppSearchPlace; });
  ok(f === 'pinned', 'clicking Pinned tabs saves the choice (' + f + ')');
  await page.goto(url('app.html#ssearch')); await page.waitForTimeout(2000);
  const sset = await page.evaluate(async () => { const b = [...document.querySelectorAll('#sxPlace [data-act="searchplace"]')]; const w = b.find(x => /Separate/.test(x.textContent)); if (!w) return 'none'; w.click(); await new Promise(r => setTimeout(r, 500)); return (await chrome.storage.local.get('ppSearchPlace')).ppSearchPlace; });
  ok(sset === 'window', 'Settings › Searching has Where searches run too, and it saves (' + sset + ')');
  // Your last own window closes: the searching window closes too.
  await page.evaluate(() => chrome.storage.local.set({ ppSearchPlace: 'window' })); await page.waitForTimeout(1500);
  const g = await sw.evaluate(async () => {
    const id = await ppSearchWindowBg();
    const mine = (await normalWindows()).map(w => w.id);
    for (const w of mine) await chrome.windows.remove(w);
    await new Promise(r => setTimeout(r, 1500));
    let left = true; try { await chrome.windows.get(id); } catch (e) { left = false; }
    return { left };
  }).catch(err => ({ left: 'browser closed: ' + String(err).slice(0, 60) }));
  ok(g.left === false || /browser closed/.test(String(g.left)), 'closing your last own window closes the searching window too (' + g.left + ')');
  await ctx.close().catch(() => {});
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
