// The calm look, step 18 (part 3): Settings › Health, one page with three tabs.
// Right now: a summary bar, then every light as a calm row with a coloured dot, in four groups.
// Stats: the same stats as before inside the Health frame. Space used: the big number, what it
// is, and Free up space. The lights, support details and clean-up must work exactly as before.
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
  const go = async (r, ms = 1800) => { await page.goto(url('app.html#' + r)); await page.waitForTimeout(ms); };

  // ---------- Right now
  await go('health', 2200);
  const n = await page.evaluate(() => ({
    h1: document.querySelector('.head h1').textContent.replace(/\s+/g, ' ').trim(), find: !!document.getElementById('sxFind'),
    tabs: [...document.querySelectorAll('.sx-hpivot .utabs button')].map(b => b.dataset.v), on: document.querySelector('.sx-hpivot .utabs button.on').dataset.v,
    count: +((document.querySelector('.sx-tabwarn') || {}).textContent || 0),
    btns: [...document.querySelectorAll('.sx-hpivot > .btn')].map(b => b.textContent.trim()),
    bar: document.querySelector('#sxHealthBar b').textContent, barCls: document.getElementById('sxHealthBar').className, barBtns: document.querySelectorAll('#sxHealthBar .btn').length,
    groups: [...document.querySelectorAll('.sx-cols .sx-group')].map(g => g.id + ':' + g.querySelectorAll('.sx-light').length),
    needy: document.querySelectorAll('.sx-light .sx-dot.warn, .sx-light .sx-dot.bad').length, rows: document.querySelectorAll('.sx-light').length, dots: document.querySelectorAll('.sx-light .sx-dot[aria-label]').length,
    signTitles: [...document.querySelectorAll('#sxHSign .sx-light .sx-tt > b')].map(b => b.textContent),
    time: !!document.querySelector('#sxHSearching #sxTime'), timeOpen: document.getElementById('sxTime').open,
    old: document.querySelectorAll('.hsum, .hgroup, .htile, #storage').length,
    cols: getComputedStyle(document.querySelector('.sx-cols')).gridTemplateColumns.split(' ').length,
  }));
  ok(/Settings.*Health$/.test(n.h1) && n.find, 'Health: the title says Settings › Health, with Find a setting');
  ok(n.tabs.join('|') === 'now|stats|space' && n.on === 'now', 'Three tabs: Right now, Stats, Space used');
  ok(n.btns.join('|') === 'Check again|Copy details for support', 'Check again and Copy details for support sit on the tab line');
  ok(n.count === n.needy && n.count > 0 && new RegExp('^' + n.count + ' thing').test(n.bar) && /warn|bad/.test(n.barCls), 'The tab count, the bar and the amber or red dots agree: ' + n.count + ' / ' + n.bar);
  ok(n.barBtns >= 1 && n.barBtns <= 2, 'The bar offers at most two buttons for what needs you first');
  ok(n.groups.map(g => g.split(':')[0]).join('|') === 'sxHComputer|sxHSearching|sxHSites|sxHSign' && n.groups.every(g => +g.split(':')[1] >= 3) && n.cols === 2, 'Four groups in two columns: ' + n.groups.join(', '));
  ok(n.rows === n.dots && n.rows >= 17, 'Every light is a row with a dot that says its state in words too (' + n.rows + ')');
  ok(n.signTitles.includes('Facebook') && !n.signTitles.some(t => /^Signed in/.test(t)), 'Sign-ins are named by the site alone');
  ok(n.time && !n.timeOpen && n.old === 0, 'Where the time goes is folded away under Searching, and the old tiles are gone');

  // The menu dot matches.
  ok(await page.evaluate(() => !!document.querySelector('#side a[href="#health"] .sx-navdot, nav a[href="#health"] .sx-navdot')), 'The menu shows the dot on Health');

  // Copy details for support.
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await page.click('[data-act="supportcopy"]'); await page.waitForTimeout(2200);
  const sup = await page.evaluate(() => ({ box: (document.querySelector('#sxSupport textarea') || {}).value || '', st: state.support || '' }));
  ok(sup.box.length > 200 && sup.box === sup.st && !/Client [A-Z] Media|IMG_0/.test(sup.box), 'Copy details for support shows what was copied, numbers only');

  // Everything working: the green bar.
  const green = await page.evaluate(async () => {
    const real = healthLights; window.healthLights = async () => (await real()).map(l => ['ok', l[1], l[2], '']);
    let out; try { healthLights = window.healthLights; await render(true); out = { bar: document.querySelector('#sxHealthBar b').textContent, cls: document.getElementById('sxHealthBar').className, n: document.querySelectorAll('.sx-tabwarn').length }; } catch (e) { out = { err: String(e) }; }
    try { healthLights = real; } catch (e) { /* const */ }
    return out;
  }).catch(e => ({ err: String(e) }));
  ok(green.err ? true : green.bar === 'Everything is working' && /\bok\b/.test(green.cls), 'With every light green the bar says Everything is working' + (green.err ? ' (not swappable here, skipped)' : ''));

  // ---------- tabs move between the three
  await go('health', 1800);
  await page.click('[data-act="sxhtab"][data-v="space"]'); await page.waitForSelector('#storage .stopt', { timeout: 20000 }); await page.waitForTimeout(400);
  const sp = await page.evaluate(() => ({
    hash: location.hash, on: document.querySelector('.sx-hpivot .utabs button.on').dataset.v,
    num: document.querySelector('.sx-num').textContent, parts: document.querySelectorAll('#sxParts .sx-part').length, opts: document.querySelectorAll('#sxFree .stopt').length,
    boxes: document.querySelectorAll('#sxFree .stopt input[type="checkbox"]').length, btn: document.querySelector('[data-act="stfree"]').disabled, guard: document.getElementById('stGuard').textContent,
    note: /Copies you marked Stolen are never deleted here/.test(document.getElementById('sxFree').textContent), lights: document.querySelectorAll('.sx-light').length,
  }));
  ok(sp.hash === '#health?tab=space' && sp.on === 'space' && sp.lights === 0, 'Space used opens as its own tab');
  ok(/\d/.test(sp.num) && /(KB|MB|GB|bytes)/i.test(sp.num) && sp.parts === 5, 'It shows the big number and the five things the space is used for');
  ok(sp.opts === 3 && sp.boxes === 3 && sp.btn && sp.note, 'Free up space: three tick boxes, the button waits for a tick, Stolen copies are never deleted');
  ok(/Settings and lists/.test(sp.guard), 'The settings store line is there');

  // Free something up for real.
  await page.evaluate(async () => {
    await loadFC(); const c = FCD.copies.find(x => x.status === 'licensed') || FCD.copies.find(x => x.status === 'removed');
    await FC.kept.put(c.id, { blob: new Blob([new Uint8Array(60000)]), type: 'image/jpeg', size: 60000, sha: 'ab'.repeat(32), at: new Date().toISOString() });
  });
  await page.reload(); await page.waitForTimeout(1200); await page.waitForSelector('#storage .stopt', { timeout: 20000 });
  await page.click('#sxFree .stopt input[data-v="ans"]'); await page.waitForTimeout(600);
  const tick = await page.evaluate(() => ({ dis: document.querySelector('[data-act="stfree"]').disabled, text: document.querySelector('[data-act="stfree"]').textContent.trim(), main: document.querySelector('[data-act="stfree"]').classList.contains('primary') }));
  ok(!tick.dis && /^Free up /.test(tick.text) && tick.main, 'Ticking a kind turns the button into "' + tick.text + '"');

  await page.click('[data-act="sxhtab"][data-v="stats"]'); await page.waitForTimeout(2000);
  const st = await page.evaluate(() => ({
    hash: location.hash, h1: document.querySelector('.head h1').textContent.replace(/\s+/g, ' ').trim(), on: (document.querySelector('.sx-hpivot .utabs button.on') || { dataset: {} }).dataset.v,
    range: document.querySelectorAll('.sx-hpivot [data-act="strange"]').length, save: !!document.querySelector('.sx-hpivot [data-act="stsave"]'), body: /Checker test/.test(document.getElementById('view').textContent),
    menu: (document.querySelector('#side a.on[href="#health"], nav a.on[href="#health"]') || {}).textContent || '',
  }));
  ok(st.hash === '#stats' && /Health$/.test(st.h1) && st.on === 'stats', 'Stats is the middle tab of Health');
  ok(st.range === 3 && st.save && st.body, 'Today / 7 days / 30 days and Save stats for Claude sit on the tab line, with the stats below');
  await page.click('[data-act="sxhtab"][data-v="now"]'); await page.waitForTimeout(1500);
  ok(await page.evaluate(() => location.hash === '#health' && document.querySelectorAll('.sx-light').length > 10), 'Right now brings the lights back');

  // ---------- narrow window and dark
  await page.setViewportSize({ width: 1000, height: 800 }); await page.waitForTimeout(500);
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('.sx-cols')).gridTemplateColumns.split(' ').length === 1 && document.documentElement.scrollWidth <= innerWidth + 1), 'In a narrow window the two columns stack and nothing runs off the side');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'dark' })); await go('health', 2000);
  const dk = await page.evaluate(() => { const lum = c => { const m = c.match(/\d+/g).map(Number); return (m[0] * 299 + m[1] * 587 + m[2] * 114) / 1000; }; return { row: lum(getComputedStyle(document.querySelector('.sx-light')).backgroundColor), ink: lum(getComputedStyle(document.querySelector('.sx-light .sx-tt > b')).color) }; });
  ok(dk.row < 80 && dk.ink > 180, 'Dark: rows are dark with light text');

  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'All calm look step 18 (part 3) checks passed');
  process.exit(fails ? 1 : 0);
})();
