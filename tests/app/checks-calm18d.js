// The calm look, step 18 (part 4): Settings › Health › Stats with the new charts.
// Info bars on top, four tiles with a trend and a two-week line, Jump to, then five groups of
// cards (funnel in four steps, a card per search site, speed bars, rings, a week grid, status
// rows in place of tables), a "What is this?" fold on every card, and the weekly file as a
// switch row. The numbers themselves are worked out as before (pp-report.js).
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
  const go = async (r, ms = 2500) => { await page.goto(url('app.html#' + r)); await page.waitForTimeout(ms); };

  // ---------- nothing recorded yet
  await go('stats');
  const e = await page.evaluate(() => ({
    bar: document.querySelector('#ssAlerts .ss-ib.ok b').textContent, tiles: document.querySelectorAll('#ssTiles .ss-tile').length,
    groups: [...document.querySelectorAll('.ss-group > h2')].map(h => h.textContent), cards: document.querySelectorAll('.ss-card').length,
    none: document.querySelectorAll('.ss-card .ss-none').length, old: document.querySelectorAll('.st-card, .st-t, .st-tile, .fun, .st-bars').length,
  }));
  ok(e.bar === 'Nothing looks off' && e.tiles === 4, 'With nothing recorded: a green "Nothing looks off" bar and four tiles');
  ok(e.groups.join('|') === 'What it found|Search sites|The checker|This computer|Extra searches and helpers', 'Five groups: ' + e.groups.join(', '));
  ok(e.none >= 4 && e.old === 0, 'Empty cards say so in words, and none of the old cards or tables are left');

  // ---------- 14 days of numbers
  await page.evaluate(async () => {
    const st = await PP_STATS.all(); st.days = st.days || {};
    const T = (n, ms, x) => { const o = { n, s: n * ms, x, h: new Array(24).fill(0) }; const B = [50, 100, 200, 350, 500, 750, 1000, 1500, 2000, 3000, 5000, 7500, 10000, 15000, 20000, 30000, 45000, 60000, 90000, 120000, 180000, 300000, 600000, Infinity]; o.h[B.findIndex(b => ms <= b)] = n; return o; };
    for (let i = 13; i >= 0; i--) {
      const k = PP_STATS.dayKey(new Date(Date.now() - i * 864e5)), f = i < 7 ? 1 : 2;
      const hours = {}; for (let h = 8; h < 18; h++) hours[h] = h === 12 ? { paused: 50, running: 10 } : h === 10 ? { fifty: 48, running: 12 } : { running: 60 };
      st.days[k] = { x: { 'mem.page': 400 }, k: hours,
        c: { photos: 100 * f, 'photos.keep': 100 * f, 'photos.withLinks': 70, 'photos.withNew': 5, links: 800, 'copies.new': 3 + (i % 4), 'kept.same': 6, 'kept.maybe': 2, 'drop.different': 500, 'drop.cant': 120, 'drop.hidden': 100, 'drop.logos': 40, 'drop.forum': 20, 'drop.card': 6, 'drop.notInPost': 4,
          'eng.google.n': 100, 'eng.google.links': 500, 'eng.google.empty': 10, 'eng.bing.n': 100, 'eng.bing.links': 200, 'eng.bing.robot': 2, 'eng.bing.restMin': 60, 'eng.yandex.n': 100, 'eng.yandex.links': 100,
          'engv.google.same': 5, 'engv.google.maybe': 2, 'engv.google.different': 400, 'engv.google.cant': 40, 'engv.bing.same': 1, 'engv.bing.different': 100, 'engv.bing.cant': 30, 'engv.yandex.different': 80, 'engv.yandex.cant': 10,
          'ans.stolen': 2, 'ans.licensed': 1, 'ans.removed': 1, 'job.page.n': 40, 'job.page.fail': 2, 'job.post.n': 10, 'job.post.fail': 5, 'strain.eased.busy': 1 },
        t: { 'photo.one': T(100, 45000, 200000), 'chk.all': T(700, 700, 3300), 'chk.no': T(600, 600, 2000), 'chk.same': T(8, 1600, 3300), 'chk.wait': T(700, 400, 900), dl: T(700, 1000, 4700), 'eng.google.ms': T(100, 8400, 39000), 'eng.bing.ms': T(100, 6800, 32000), 'eng.yandex.ms': T(100, 11000, 51000), 'drive.openPhoto': T(100, 470, 2100), 'drive.driveAnswer': T(20, 9000, 12000), 'job.page': T(40, 3000, 8000), 'job.post': T(10, 12000, 20000) },
        s: { 'patch.example': { f: 3, s: 1, b: 0 }, 'news.example': { f: 1, s: 4, b: 0 }, 'm.example': { f: 0, s: 2, b: 1 }, 'a.example': { f: 1, s: 0, b: 0 }, 'b.example': { f: 1, s: 0, b: 0 }, 'c.example': { f: 1, s: 0, b: 0 }, 'd.example': { f: 1, s: 0, b: 0 } } };
    }
    st.test = { at: Date.now() - 864e5, n: 72, right: 70, ms: 480, fast: true, gpu: false, groups: { small: { label: 'Smaller copy', n: 12, right: 12 }, tilt: { label: 'Tilted', n: 12, right: 10, same: 8, maybe: 2, no: 2, cant: 0 } } };
    await chrome.storage.local.set({ ppStats: st });
  });
  await page.reload(); await page.waitForTimeout(3000);
  const s = await page.evaluate(() => {
    const q = (x, r = document) => r.querySelector(x), qa = (x, r = document) => [...r.querySelectorAll(x)];
    return {
      tiles: qa('#ssTiles .ss-tile').map(t => ({ v: q('.ss-tv', t).textContent, tr: (q('.ss-tr', t) || {}).className || '', spark: !!q('svg.ss-spark path.l', t), ic: !!q('.ss-ti svg', t) })),
      jump: qa('#ssJump button').map(b => b.textContent), steps: qa('#ssFound .ss-step').map(x => q('small', x).textContent + ' ' + q('b', x).textContent), cols: qa('#ssFound .ss-col').length, now: qa('#ssFound .ss-col.now').length,
      engs: qa('#ssEngines .ss-eng').map(x => q('.ss-engh b', x).textContent + ':' + q('.ss-pill', x).textContent.trim() + ':' + qa('.ss-split i', x).length),
      speed: qa('#ssSpeed .ss-rr:not(.ax)').length, speedTot: qa('#ssSpeed .ss-rr.tot').length, axis: qa('#ssSpeed .ss-rax small').length,
      drops: qa('#ssDrops > .ss-cb > .ss-hbs .ss-hb').length, dropMore: (q('#ssDrops .ss-fold summary') || {}).textContent || '', dropFirst: q('#ssDrops .ss-hb span').textContent,
      sites: qa('#ssSites > .ss-cb > .ss-list .ss-li').length, siteMore: (q('#ssSites .ss-fold summary') || {}).textContent || '',
      ring: q('#ssTest .ss-ring b').textContent, ringCls: q('#ssTest .ss-ring').className, chips: qa('#ssTest .ss-chip').map(x => x.className.replace('ss-chip ', '')), runBtn: q('#ssTest [data-act="sttest"]').textContent.trim(),
      heatRows: qa('#ssKeep .ss-hr:not(.hd)').length, heatCells: qa('#ssKeep .ss-hr:not(.hd) i').length, heatKinds: [...new Set(qa('#ssKeep .ss-hr:not(.hd) i').map(i => i.className))].sort().join(','),
      drive: qa('#ssDrive .ss-li').map(x => q('.ss-st', x).textContent), helpers: qa('#ssHelpers .ss-li').map(x => q('.ss-dot', x).className.replace('ss-dot ', '')), extra: qa('#ssExtra .ss-li').length,
      cover: !!q('#ssCover .ss-ring') || !!q('#ssCover .ss-none'), whats: qa('.ss-card').every(c => !!q('.ss-what', c) || c.id === 'ssCover'), tables: qa('.ss table').length,
      weekly: !!q('#ssWeekly input[data-act="stweekly"]'), weeklyOn: (q('#ssWeekly input') || {}).checked, copy: !!q('#ssCopy [data-act="stcopy"]'), saveCard: /One file: a plain summary on top/.test(q('.ss').textContent),
      wide: qa('.ss-card.ss-wide').map(c => c.id).join(','),
    };
  });
  ok(s.tiles.length === 4 && s.tiles.every(t => t.spark && t.ic) && s.tiles[0].v === '700' && /bad/.test(s.tiles[0].tr), 'Tiles: icon, big number, trend against the week before, and a two-week line (' + s.tiles.map(t => t.v).join(', ') + ')');
  ok(s.jump.length === 5, 'Jump to has the five groups');
  ok(s.steps.length === 4 && /^Links found 5,600/.test(s.steps[0]) && /^New copies/.test(s.steps[3]) && s.cols === 14 && s.now === 1, 'From search to copy: four steps in a line and 14 day columns, today darker: ' + s.steps.join(' > '));
  ok(s.engs.length === 3 && s.engs.some(x => /^Bing:Rested/.test(x)) && s.engs.some(x => /^Google Lens:Fine/.test(x)), 'A card per search site with its state: ' + s.engs.join(' | '));
  ok(s.speed >= 6 && s.speedTot === 1 && s.axis === 5, 'How fast: a bar per step on one stretched scale, the whole photo set apart');
  ok(s.drops === 6 && /Show all 7 reasons/.test(s.dropMore) && s.dropFirst === 'Different photo', 'Links thrown out: the top six, biggest first, the rest behind "' + s.dropMore.trim() + '"');
  ok(s.sites === 6 && /Show all 7 websites/.test(s.siteMore), 'Problems by website: six rows with split bars, the rest folded');
  ok(/^70\/72$/.test(s.ring) && /warn/.test(s.ringCls) && s.chips.join(',') === 'ok,warn' && s.runBtn === 'Run the test again', 'Checker test: a ring (' + s.ring + '), a chip per kind of copy, Run the test again');
  ok(s.heatRows === 7 && s.heatCells === 77 && /big/.test(s.heatKinds) && /stop/.test(s.heatKinds) && /work/.test(s.heatKinds), 'Keep searching: a week grid, a square per hour (' + s.heatKinds + ')');
  ok(s.drive.includes('Slow') && s.drive.includes('Fine') && s.helpers.join(',') === 'ok,warn' && s.extra === 3, 'Tables became status rows: Drive ' + s.drive.join('/') + ', helpers ' + s.helpers.join('/'));
  ok(s.whats && s.tables === 0 && s.cover, 'Every card has a "What is this?" fold and there is no table left');
  ok(s.weekly && s.weeklyOn && s.copy && !s.saveCard, 'The Save card is gone: the weekly file is a switch row, with Copy beside it');
  ok(s.wide === 'ssFound,ssEngines,ssKeep', 'The three wide cards span both columns');

  // What is this? opens; Show all opens; Jump to scrolls.
  await page.click('#ssDrops .ss-what summary'); await page.click('#ssDrops .ss-fold summary'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.querySelector('#ssDrops .ss-what').open && document.querySelectorAll('#ssDrops .ss-hb').length === 7), '"What is this?" opens and "Show all" shows every reason');
  await page.click('#ssJump [data-v="pc"]'); await page.waitForTimeout(900);
  ok(await page.evaluate(() => { const r = document.getElementById('ssg-pc').getBoundingClientRect(); return r.top >= -5 && r.top < innerHeight / 2 && location.hash === '#stats'; }), 'Jump to brings This computer into view and stays on the page');

  // Range and the weekly switch still work.
  await page.click('[data-act="strange"][data-v="30"]'); await page.waitForTimeout(1500);
  ok(await page.evaluate(() => state.stRange === '30' && document.querySelector('.st-range .on').textContent === '30 days' && /in the last 30 days/.test(document.querySelector('#ssFound .ss-ct p').textContent) && document.querySelector('#ssTiles .ss-tv').textContent === '2,100'), '30 days changes the numbers and the wording');
  await page.click('#ssWeekly label.switch'); await page.waitForTimeout(600);
  ok(await page.evaluate(async () => (await PP_STATS.all()).weeklyOff === true), 'The weekly switch turns the Friday file off');
  await page.click('#ssWeekly label.switch'); await page.waitForTimeout(400);

  // An alert shows as an info bar.
  await page.evaluate(async () => { const st = await PP_STATS.all(), k = PP_STATS.dayKey(); st.days[k].c['eng.bing.robot'] = 9; await chrome.storage.local.set({ ppStats: st }); });
  await page.reload(); await page.waitForTimeout(2500);
  const al = await page.evaluate(() => [...document.querySelectorAll('#ssAlerts .ss-ib')].map(x => x.className.replace('ss-ib ', '') + ':' + x.querySelector('b').textContent));
  ok(al.length >= 1 && al.every(a => /^(warn|bad):/.test(a)), 'Something off shows as a slim bar on top: ' + al.join(' | '));

  // ---------- narrow window and dark
  await page.setViewportSize({ width: 1000, height: 800 }); await page.waitForTimeout(500);
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('.ss-grid')).gridTemplateColumns.split(' ').length === 1 && document.documentElement.scrollWidth <= innerWidth + 1), 'In a narrow window the cards stack and nothing runs off the side');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'dark' })); await page.reload(); await page.waitForTimeout(2500);
  const dk = await page.evaluate(() => { const lum = c => { const m = c.match(/\d+/g).map(Number); return (m[0] * 299 + m[1] * 587 + m[2] * 114) / 1000; }; return { card: lum(getComputedStyle(document.querySelector('.ss-card')).backgroundColor), ink: lum(getComputedStyle(document.querySelector('.ss-tv')).color), blue: getComputedStyle(document.querySelector('.ss')).getPropertyValue('--c-blue').trim() }; });
  ok(dk.card < 80 && dk.ink > 180 && dk.blue.toUpperCase() === '#60CDFF', 'Dark: dark cards, light numbers, and the chart colours tuned for dark');

  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'All calm look step 18 (part 4) checks passed');
  process.exit(fails ? 1 : 0);
})();
