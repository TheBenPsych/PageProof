// Settings › How PageProof is doing: the day-by-day stats (pp-stats.js), what a search records
// (links thrown out and why, each search site, problems by website), the page, the "Something
// looks off" alerts (a search site whose pictures can't be checked), Save stats for Claude (no
// client names, photo names or paths in the file), the weekly file, and the Checker test.
// Pretend sites and made-up pictures only.
const { start } = require('./h.js');
process.env.NP = 600; process.env.NC = 120;
const { seed } = require('./seed.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  // ---- a search records what happened to its links
  const rs = await ctx.newPage();
  rs.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e.stack || e).slice(0, 600)); });
  await ctx.route(/^https:\/\/(blocked\.example|gone\.example)\//, route => route.fulfill({ status: /blocked/.test(route.request().url()) ? 403 : 500, body: 'no' }));
  await rs.goto(url('revsearch.html?job=none')); await rs.waitForTimeout(800);
  const s1 = await rs.evaluate(async () => {
    await RS_LISTS.load();
    job = { id: 't', kind: 'keep', pics: [{ i: 0, name: 'IMG_secret.jpg', links: [], runs: {} }], engines: ['google', 'bing'] };
    const base = { pic: 0, sv: SCORE_VERSION, from: 'image', n: 100, wall: 0 };
    const mk = (u, e, sc) => ({ ...base, url: u, key: u, site: new URL(u).hostname, engines: e, ...sc });
    const SAME = { pct: 100, inl: 60, tiles: 40, str: 1, mid: 1 }, DIFF = { pct: 5, inl: 2, tiles: 1, str: 0.2, mid: 0.1 }, CANT = { pct: -1 };
    const p = job.pics[0];
    p.links = [mk('https://a.example/1', ['google'], SAME), mk('https://b.example/2', ['google', 'bing'], DIFF), mk('https://c.example/3', ['bing'], CANT), mk('https://d.example/4', ['bing'], CANT), mk('https://www.reddit.com/r/x/5', ['google'], SAME)];
    p.t0 = Date.now() - 42000;
    statPhoto(p, 1);
    // Each search site's answer.
    statEngine({ engine: 'google', p: { runs: { google: { count: 3 } } }, start: Date.now() - 9000 }, 'done');
    statEngine({ engine: 'bing', p: { runs: { bing: { count: 0 } } }, start: Date.now() - 5000 }, 'done');
    statEngine({ engine: 'bing', p: { runs: {} } }, 'fail', 'No answer from the page. Open the tab to look at it yourself.');
    // Pictures that can't be downloaded: only the website's name is kept.
    await fetchPicture('https://blocked.example/pics/IMG_secret.jpg');
    await fetchPicture('https://gone.example/pics/x.jpg');
    await PP_STATS.flush();
    const st = await PP_STATS.all(), D = st.days[PP_STATS.dayKey()];
    return { c: D.c, s: D.s, t: Object.keys(D.t), raw: JSON.stringify(st) };
  });
  ok(s1.c.photos === 1 && s1.c['photos.keep'] === 1 && s1.c.links === 5 && s1.c['copies.new'] === 1, 'A finished photo counts as searched, with its links and new copies');
  ok(s1.c['kept.same'] === 1 && s1.c['drop.different'] === 1 && s1.c['drop.cant'] === 2 && s1.c['drop.forum'] === 1, 'Thrown-out links are counted by reason (different, could not check, forum) ' + JSON.stringify(s1.c));
  ok(s1.c['engv.bing.cant'] === 2 && s1.c['engv.bing.cantOnly'] === 2 && s1.c['engv.google.same'] === 1 && s1.c['engv.bing.different'] === 1, 'Each search site\'s links are counted by what they turned out to be');
  ok(s1.c['eng.google.n'] === 1 && s1.c['eng.google.links'] === 3 && s1.c['eng.bing.empty'] === 1 && s1.c['eng.bing.noAnswer'] === 1, 'Searches, links, empty results and no answers per site');
  ok(s1.t.includes('photo.one') && s1.t.includes('eng.google.ms') && s1.t.includes('dl') === false, 'Times are kept for the whole photo and each site');
  ok(s1.s['blocked.example'] && s1.s['blocked.example'].b === 1 && s1.s['gone.example'].f === 1 && s1.c['dl.blocked'] === 1, 'A blocked download and a failed one are listed under their website');
  ok(!/IMG_secret|\/pics\//.test(s1.raw), 'No picture address or photo name is stored');
  await rs.close();

  // ---- the page
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e.stack || e).slice(0, 600)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  await seed(page); await page.reload(); await page.waitForTimeout(1500);
  // Three days where most of Bing's links could not be checked, and 2 days of no Bing results before that.
  await page.evaluate(async () => {
    const st = await PP_STATS.all();
    for (let i = 0; i < 3; i++) {
      const k = PP_STATS.dayKey(new Date(Date.now() - i * 864e5)), d = st.days[k] || (st.days[k] = { c: {}, t: {}, x: {}, k: {}, s: {} });
      Object.assign(d.c, { photos: 80, 'photos.keep': 80, links: 900, 'copies.new': 6, 'kept.same': 20, 'drop.cant': 300, 'drop.different': 500, 'engv.bing.cant': 60, 'engv.bing.cantOnly': 50, 'engv.bing.same': 2, 'engv.bing.different': 10, 'engv.google.same': 18, 'engv.google.different': 400, 'eng.google.n': 80, 'eng.google.links': 700, 'eng.bing.n': 80, 'eng.bing.links': 200, 'ans.stolen': 3 });
      d.k = { 9: { running: 20, waiting: 40 }, 10: { offline: 60 } };
    }
    await chrome.storage.local.set({ ppStats: st });
  });
  await page.goto(url('app.html#stats')); await page.waitForTimeout(2500);
  const txt = await page.textContent('#view');
  ok(/How PageProof is doing/.test(txt) && /Checker test/.test(txt) && /From search to copy/.test(txt) && /Each search site/.test(txt) && /Links thrown out/.test(txt) && /Problems by website/.test(txt), 'The page shows its sections');
  ok(/Keep searching: on time and pauses/.test(txt) && /Google Drive speed/.test(txt) && /Photos covered/.test(txt) && /Computer strain/.test(txt) && /Post check, account reader/.test(txt) && /Save stats for Claude/.test(txt), 'and the rest of them');
  ok(/of Bing's links could not be checked in the last 3 days/.test(txt), 'A red alert says most of Bing\'s links could not be checked');
  ok(await page.$('.st-alert.bad') !== null, 'It shows in red at the top');
  ok(await page.evaluate(() => [...document.querySelectorAll('.side .subs a')].some(a => a.getAttribute('href') === '#health' && a.classList.contains('on'))), 'The stats page lights up Health in the Settings menu');
  await page.click('[data-act="strange"][data-v="30"]'); await page.waitForTimeout(1500);
  ok(await page.evaluate(() => state.stRange === '30' && document.querySelector('.st-range .on').textContent === '30 days'), 'The 30 days switch works');

  // ---- the file
  const file = await page.evaluate(async () => {
    const m = await PP_REPORT.model('7');
    const t = await PP_REPORT.text(m);
    const photos = (await FC.DB.all('photos')).slice(0, 50).map(p => p.name), clients = (await FC.DB.all('clients')).map(c => c.name);
    const copies = (await FC.allCopies()).slice(0, 50).map(c => c.url);
    const [top, raw] = t.split('----- full numbers (for Claude) -----');
    let j = null; try { j = JSON.parse(raw); } catch (e) { /* bad */ }
    const scrubbed = await PP_REPORT.scrub('site of Client A Media and ben tester');
    return { t, top, j: !!j && !!j.days, names: clients.filter(n => t.includes(n)), photos: photos.filter(n => t.includes(n)), links: copies.filter(u => t.includes(u)), scrubbed, len: t.length };
  });
  ok(/PageProof stats for support/.test(file.top) && /Looks off/.test(file.top) && /Bing: .* could not be checked/.test(file.top), 'The file starts with a plain summary, with Bing\'s line');
  ok(file.j, 'Its second half is the full numbers, readable by a program');
  ok(!file.names.length && !file.photos.length && !file.links.length && !/Ben Tester|Shared drives|Registered images/.test(file.t), 'No client names, photo names, links, your name or folder paths in it');
  ok(file.scrubbed === 'site of [name] and [name]', 'Anything that looks like a client name or your name is blanked (' + file.scrubbed + ')');
  await page.click('.headact [data-act="stsave"]'); await page.waitForTimeout(2500);
  const saved = await page.evaluate(async () => { const d = await RS_DOCS.dir(); const s = await d.getDirectoryHandle('stats'); const out = []; for await (const [n] of s.entries()) out.push(n); return out; });
  ok(saved.some(n => /^pageproof-stats-\d{4}-\d\d-\d\d-\d{4}\.txt$/.test(n)), 'Save stats for Claude saves into Documents › PageProof › stats (' + saved.join(', ') + ')');

  // ---- the weekly file
  const wk = await page.evaluate(async () => {
    const due = PP_REPORT.weeklyDue(new Date('2026-11-25T10:00:00'));       // a Wednesday
    const fri = PP_REPORT.weeklyDue(new Date('2026-11-27T18:00:00'));       // Friday evening
    const sat = new Date('2026-11-28T09:00:00'), name = await PP_REPORT.weeklyMaybe(sat), again = await PP_REPORT.weeklyMaybe(sat);
    return { due: due.toString(), fri: fri.toString(), name, again };
  });
  ok(/Fri Nov 20 2026 17:30/.test(wk.due) && /Fri Nov 27 2026 17:30/.test(wk.fri), 'The weekly file is due Friday at 5:30 PM');
  ok(/^pageproof-stats-week-/.test(wk.name) && wk.again === '', 'It is saved once a week, not again (' + wk.name + ')');

  // ---- your answers count
  const ans = await page.evaluate(async () => {
    const c = (await FC.allCopies()).find(x => x.status === 'new');
    await FC.answer([c.id], 'stolen'); await FC.answer([c.id], 'licensed');
    await PP_STATS.flush(); const D = (await PP_STATS.all()).days[PP_STATS.dayKey()];
    return [D.c['ans.stolen'], D.c['ans.licensed'], D.c['ans.changed']];
  });
  ok(ans[0] === 4 && ans[1] === 1 && ans[2] === 1, 'Answers are counted, and a changed answer too (' + ans + ')');

  // ---- Is everything working and Home
  await page.goto(url('app.html#health')); await page.waitForTimeout(2500);
  ok(/Stats/.test(await page.textContent('#view')) && await page.$('#view a[href="#stats"]') !== null, 'Is everything working has a Stats light that opens the page');
  await page.goto(url('app.html#home')); await page.waitForTimeout(2500);
  ok(await page.$('#view a[href="#stats"]') !== null, 'Home says something looks off, with a button to the stats');

  // ---- the checker test (made-up pictures, the real photo checker)
  await page.goto(url('app.html#stats')); await page.waitForTimeout(2000);
  await page.click('[data-act="sttest"]');
  await page.waitForFunction(() => !state.stTest, null, { timeout: 180000 });
  const test = await page.evaluate(async () => (await PP_STATS.all()).test);
  ok(test && test.n === 72 && test.right === 72, 'The checker test gets all ' + (test && test.n) + ' right (' + (test && test.right) + ', ' + (test && test.ms) + ' ms each)');
  await page.waitForTimeout(800);
  ok(/72 of 72 right/.test(await page.textContent('#view')), 'The page shows the result');
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e); process.exit(1); });
