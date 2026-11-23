// Checks for 4.7: the calmer details panel (Look at these, tabs, picture views, pinned answers,
// More menu) and the Copies found list (Quick filters, chosen = blue, Showing line, dropdowns, Damages + Client columns,
// Columns menu, sticky group headings). Pretend photos and sites only.
const { start } = require('./h.js');
process.env.NP = 400; process.env.NC = 120;
const { seed } = require('./seed.js');
const SHOTS = process.env.SHOTS || '';
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start({ viewport: { width: 1920, height: 1000 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  const shot = async n => { if (SHOTS) await page.screenshot({ path: SHOTS + '/' + n + '.png' }); };
  const go = async h => { await page.goto(url('app.html#' + h)); await page.waitForTimeout(1300); };
  await go('help'); await seed(page); await page.reload(); await page.waitForTimeout(1000);
  // Two photos get firm-style dated names: one published last week, one long ago.
  const ids = await page.evaluate(async () => {
    const cs = (await FC.allCopies()).filter(c => c.status === 'new');
    const a = cs[0], b = cs.find(c => c.photo !== a.photo);
    const d = new Date(Date.now() - 7 * 864e5);
    const pa = await FC.DB.get('photos', a.photo); pa.name = `${d.getMonth() + 1}.${d.getDate()}.${String(d.getFullYear()).slice(2)}_Parade_Doe.jpg`; await FC.DB.put('photos', pa);
    const pb = await FC.DB.get('photos', b.photo); pb.name = '3.4.19_Harbor_Roe.jpg'; await FC.DB.put('photos', pb);
    const regs = (await FC.meta.get('regs')) || {}; delete regs[pb.folder]; for (const k of Object.keys(regs)) if (pb.folder.startsWith(k)) delete regs[k]; await FC.meta.set('regs', regs);
    const nod = cs.find(c => c.photo !== a.photo && c.photo !== b.photo);
    return { fresh: a.id, old: b.id, nodate: nod.id };
  });
  await go('found'); await page.evaluate(() => { FCD = null; state.fView = 'list'; return render(true); }); await page.waitForTimeout(900);
  await shot('47-found');

  // ---- list
  const t = await page.evaluate(() => [...document.querySelectorAll('.qf')].map(b => b.textContent.replace(/\s+/g, ' ').trim()));
  ok(t.length === 4 && /Found today/.test(t[0]) && /last 3 months/.test(t[3]), 'Four Quick filter buttons (' + t.join(' | ') + ')');
  await page.click('.qf[data-v="fresh"]'); await page.waitForTimeout(600);
  const fr = await page.evaluate(id => ({ n: LIST.length, has: LIST.includes(id) }), ids.fresh);
  ok(fr.n >= 1 && fr.has, 'The "Published in the last 3 months" tile filters to recent photos (' + fr.n + ')');
  const on = await page.evaluate(() => { const b = document.querySelector('.qf[data-v="fresh"]'); return { on: b.classList.contains('on'), tick: !!b.querySelector('.tick'), bg: getComputedStyle(b).backgroundColor, showing: (document.querySelector('.showing') || {}).textContent || '' }; });
  ok(on.on && on.tick && !/255, 255, 255/.test(on.bg) && /Published in the last 3 months/.test(on.showing) && /Clear filters/.test(on.showing), 'A chosen Quick filter is solid blue with a tick, and the Showing line names it (' + on.bg + ')');
  await page.click('.qf[data-v="fresh"]'); await page.waitForTimeout(500);
  ok(await page.evaluate(() => !document.querySelector('.showing')), 'The Showing line goes away when nothing is filtered');
  if (SHOTS) { await page.evaluate(() => { state.fMatch = 'strong'; state.fFresh = true; state.fView = 'client'; return render(true); }); await page.waitForTimeout(500); await page.screenshot({ path: SHOTS + '/411-filters.png', clip: { x: 0, y: 0, width: 1920, height: 620 } });
    await page.evaluate(() => { state.fFresh = false; state.fView = 'list'; return render(true); }); }
  await page.evaluate(() => { state.fMatch = 'strong'; return render(true); }); await page.waitForTimeout(400);
  const ch = await page.evaluate(() => ({ n: document.querySelectorAll('.ddb.chosen').length, x: !!document.querySelector('[data-dd="fMatch"] .ddx'), tab: (document.querySelector('.found-card .tabs button.on .tick') || {}).textContent }));
  ok(ch.n === 1 && ch.x && ch.tab === '✓', 'A changed dropdown lights up with an ✕, and the chosen status tab has a tick');
  await page.click('[data-dd="fMatch"] .ddx'); await page.waitForTimeout(400);
  ok(await page.evaluate(() => state.fMatch === 'any' && !document.querySelector('.ddb.chosen')), 'The ✕ puts the dropdown back to normal');
  const dm = await page.evaluate(ids => {
    const cell = id => { const r = document.querySelector(`.crow[data-v="${CSS.escape(id)}"] .cc-dmg`); return r ? r.textContent.trim() : null; };
    return { fresh: cell(ids.fresh), old: cell(ids.old), nodate: cell(ids.nodate) };
  }, ids);
  ok(/Statutory|Register by/.test(dm.fresh || ''), 'Damages column for a new photo: ' + dm.fresh);
  ok(/Actual only|Statutory/.test(dm.old || ''), 'Damages column for an old photo: ' + dm.old);
  ok(dm.nodate === '', 'No date in the file name: the Damages cell is empty');
  ok(await page.evaluate(() => [...document.querySelectorAll('.crow .cc-client')].every(e => e.offsetWidth > 0)), 'Client column shows on a wide window');
  ok(await page.evaluate(() => document.querySelectorAll('.crow .sig .tag svg').length > 0 && !document.querySelector('.crow .l1 .tag.bad:not(.sig .tag)')), 'Rows use small warning icons instead of word tags');
  ok(await page.evaluate(() => !!document.querySelector('.crow .lu u')), 'Lines-up bar on each row');
  // Columns menu: turn Country off, it stays off after reload
  await page.click('[data-dd="cols"] > summary'); await page.click('[data-act="fcol"][data-v="country"]'); await page.waitForTimeout(700);
  ok(await page.evaluate(() => !document.querySelector('.crow .cc-country') && document.querySelector('[data-dd="cols"]').open), 'Columns menu turns a column off and stays open');
  await page.reload(); await page.waitForTimeout(1500);
  ok(await page.evaluate(() => !document.querySelector('.crow .cc-country')), 'The column choice is remembered');
  await page.evaluate(() => { state.fCols.country = true; api.storage.local.set({ fcCols: state.fCols }); });
  // dropdowns: one tidy line
  await page.click('[data-dd="fView"] > summary'); await page.click('[data-act="fset"][data-v="fView|client"]'); await page.waitForTimeout(600);
  ok(await page.evaluate(() => state.fView === 'client' && document.querySelectorAll('.ghead').length > 0 && !document.querySelector('.segbar')), 'Group is a dropdown on the same line as the tabs');
  const sticky = await page.evaluate(async () => { const h = document.querySelector('.cbody>.ghead'); window.scrollTo(0, 900); await new Promise(r => setTimeout(r, 200)); const cs = getComputedStyle(h); window.scrollTo(0, 0); return cs.position; });
  ok(sticky === 'sticky', 'Group headings stay at the top while scrolling');

  // ---- panel
  await page.evaluate(id => { state.dView = 'side'; state.open = id; return render(true); }, ids.fresh); await page.waitForTimeout(1500);
  await shot('47-panel');
  const p = await page.evaluate(() => {
    const d = document.getElementById('drawer'), f = d.querySelector('.dfoot').getBoundingClientRect();
    return { look: !!d.querySelector('#lookbox'), tabs: [...d.querySelectorAll('.dtabs button')].map(b => b.textContent.trim()), shown: [...d.querySelectorAll('.dpane')].filter(p => !p.hidden).map(p => p.dataset.tab), pinned: f.bottom <= innerHeight + 1 && f.top > innerHeight / 2, ans: d.querySelectorAll('.dfoot [data-act="dverdict"]').length, noReg: !d.querySelector('#regIn') };
  });
  ok(p.look, 'Panel has the "Look at these" box');
  ok(p.tabs.join() === 'Summary,Their page,Claim,Site' && p.shown.join() === 'sum', 'Four tabs, Summary open first');
  ok(p.pinned && p.ans === 4, 'Answer buttons are pinned at the bottom of the panel');
  ok(p.noReg, 'Still no "Add the number" box in the panel');
  await page.click('.dtabs [data-v="claim"]'); await page.waitForTimeout(300);
  const cl = await page.evaluate(() => ({ shown: [...document.querySelectorAll('.dpane')].filter(p => !p.hidden).map(p => p.dataset.tab).join(), rules: !!document.querySelector('.dpane[data-tab="claim"] #rulesbox'), dmg: /Dates and damages/.test(document.querySelector('.dpane[data-tab="claim"]').textContent) }));
  ok(cl.shown === 'claim' && cl.rules && cl.dmg, 'Claim tab has firm rules and dates and damages');
  await page.evaluate(id => { state.open = id; return render(true); }, ids.nodate); await page.waitForTimeout(1200);
  ok(await page.evaluate(() => state.dTab === 'sum' && !/Dates and damages/.test(document.getElementById('drawer').textContent)), 'Next copy opens on Summary; no publish date means no damages section');
  // picture views
  await page.click('[data-act="dview"][data-v="slide"]'); await page.waitForTimeout(700);
  const sl = await page.evaluate(() => ({ imgs: document.querySelectorAll('.dslide img').length }));
  await page.fill('.dslide input', '20'); await page.waitForTimeout(100);
  const cut = await page.evaluate(() => document.querySelector('.dslide').style.getPropertyValue('--cut'));
  ok(sl.imgs === 2 && cut === '20%', 'Slider view shows both pictures and moves (' + cut + ')');
  ok(await page.evaluate(async () => (await api.storage.local.get('fcDView')).fcDView === 'slide'), 'The picture view is remembered');
  await page.click('[data-act="dview"][data-v="side"]'); await page.waitForTimeout(500);
  // More menu has every hide choice and approve
  await page.click('.dfoot [data-act="dmore"]'); await page.waitForTimeout(300);
  const mm = await page.evaluate(() => { const m = document.getElementById('rowMenu'); return m ? { hide: m.querySelectorAll('[data-act="mhide"]').length, ok: m.querySelectorAll('[data-v^="okall|"]').length } : null; });
  ok(mm && mm.hide >= 1 && mm.ok === 1, 'More menu has Approve site and the Hide site choices');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  // answer from the panel: the next copy opens, Undo brings it back
  const before = ids.nodate;
  await page.evaluate(id => { state.open = id; return render(true); }, before); await page.waitForTimeout(500);
  await page.click('.dfoot [data-act="dverdict"][data-v="licensed"]'); await page.waitForTimeout(1200);
  const af = await page.evaluate(async id => ({ open: state.open, st: (await FC.DB.get('copies', id)).status, undo: !!document.querySelector('.dfoot .undoline') }), before);
  ok(af.st === 'licensed' && af.open && af.open !== before && af.undo, 'Answer in the panel opens the next copy, Undo shows at the bottom');
  await page.click('.dfoot .undoline'); await page.waitForTimeout(1000);
  ok(await page.evaluate(async id => (await FC.DB.get('copies', id)).status, before) === 'new', 'Undo puts it back');
  // Hide site from the panel: the next copy opens
  await page.evaluate(id => { state.fView = 'list'; state.open = id; return render(true); }, ids.nodate); await page.waitForTimeout(800);
  const h0 = await page.evaluate(() => FCD.copies.find(x => x.id === state.open).site);
  await page.click('.dtabs [data-v="site"]'); await page.evaluate(() => { document.getElementById('hidebox').open = true; });
  await page.click('#hidebox [data-act="hidesite"] >> nth=-1'); await page.waitForTimeout(1200);
  const h1 = await page.evaluate(() => ({ open: state.open, site: state.open && FCD.copies.find(x => x.id === state.open).site }));
  ok(h1.open && h1.site !== h0, 'Hide site in the panel opens the next copy (' + h0 + ' -> ' + h1.site + ')');
  await page.click('.dfoot .undoline'); await page.waitForTimeout(1200);
  ok(await page.evaluate(id => state.open === id, ids.nodate), 'Undo shows the site again and reopens its copy');
  // One at a time: Hide site, then the next copy; Undo brings it back
  await go('review'); await page.waitForTimeout(800);
  const r0 = await page.evaluate(() => { const c = FCD.copies.find(x => x.id === state.rvCurrent); return { id: state.rvCurrent, site: c && c.site, n: document.querySelectorAll('[data-act="rvhide"]').length }; });
  ok(r0.n >= 1, 'One at a time has Hide site choices (' + r0.n + ')');
  await page.evaluate(() => { document.querySelectorAll('details.rvok')[1].open = true; });
  await page.click('[data-act="rvhide"] >> nth=-1'); await page.waitForTimeout(1200);
  const r1 = await page.evaluate(() => { const c = FCD.copies.find(x => x.id === state.rvCurrent); return { id: state.rvCurrent, site: c && c.site }; });
  ok(r1.id && r1.id !== r0.id && r1.site !== r0.site, 'Hiding the site moves to the next copy (' + r0.site + ' -> ' + r1.site + ')');
  await page.keyboard.press('u'); await page.waitForTimeout(1200);
  ok(await page.evaluate(s => !RS_LISTS.isHidden(s, 'https://' + s + '/'), r0.site), 'Undo shows the site again');
  await go('found'); await page.evaluate(id => { state.open = id; return render(true); }, before); await page.waitForTimeout(800);
  // dark mode: no white boxes in the panel
  await page.evaluate(() => { const st = document.createElement('style'); st.textContent = '*{transition:none!important}'; document.head.appendChild(st); document.documentElement.dataset.theme = 'dark'; }); await page.waitForTimeout(500);
  await shot('47-panel-dark');
  const white = await page.evaluate(() => { const lum = c => { const m = c.match(/[\d.]+/g).map(Number); return m.length > 3 && m[3] === 0 ? -1 : (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; }; return [...document.querySelectorAll('#drawer *, .qfrow *, .toolbar *')].filter(e => e.offsetParent && !e.closest('img,.handle') && e.getBoundingClientRect().width > 30 && lum(getComputedStyle(e).backgroundColor) > 0.85).map(e => e.className + '@' + (e.closest('[id]') || {}).id + ':' + getComputedStyle(e).backgroundColor + ':' + e.textContent.trim().slice(0,10)).slice(0, 3); });
  ok(!white.length, 'Nothing white in dark mode ' + white.join(', '));
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
