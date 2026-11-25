// Checks for 4.52 (Ben's picks from his answers): a Same with under 40 matching details is a Maybe
// (the full-size look can still make it Same), and website Maybes under 60% fold into "Weak Maybes"
// at the bottom of All copies found. Made-up copies only.
const { start } = require('./h.js');
process.env.NP = 4; process.env.NC = 1;
const { seed } = require('./seed.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  await seed(page); await page.reload(); await page.waitForTimeout(1200);
  const v = await page.evaluate(() => {
    const S = PP_VERDICT.score, base = { tiles: 60, str: 0.9, mid: null, n: 200 };
    return {
      few: S({ ...base, pct: 88, inl: 14 }), small: S({ ...base, pct: 77, inl: 25 }), many: S({ ...base, pct: 82, inl: 250 }),
      fewClose: PP_VERDICT.close({ ...base, pct: 88, inl: 14 }),
      deepSame: PP_VERDICT.second({ ...base, pct: 88, inl: 14 }, { ...base, pct: 90, inl: 120 }, false).how,
      deepNo: PP_VERDICT.second({ ...base, pct: 88, inl: 14 }, { ...base, pct: 10, inl: 3 }, false).how,
    };
  });
  ok(v.few === 'maybe' && v.small === 'maybe' && v.many === 'same', 'a Same with under 40 matching details is a Maybe, with many it stays Same: ' + [v.few, v.small, v.many].join(' '));
  ok(v.fewClose && v.deepSame === 'kept' && v.deepNo === 'out', 'those get the full-size look, which makes them Same or throws them out: ' + [v.fewClose, v.deepSame, v.deepNo].join(' '));

  const w = await page.evaluate(async () => {
    const pid = 'd:Test Client/2026/Q4/a.jpg', now = new Date().toISOString();
    await FC.DB.put('clients', { name: 'Test Client', searching: true, licensed: [], photos: 1 });
    await FC.DB.put('photos', { id: pid, client: 'Test Client', name: 'a.jpg', rel: '', searches: 1 });
    const C = (site, match, pct, extra) => ({ id: pid + '|' + site, photo: pid, client: 'Test Client', url: 'https://' + site + '/p', key: site + '/p', site, img: '', thumb: '', engines: ['bing'], match, pct, inl: 50, tiles: 60, str: 0.9, firstSeen: now, status: 'new', ...extra });
    for (const c of await FC.allCopies()) await FC.DB.del('copies', c.id);
    for (const c of [C('strong.example', 'same', 95), C('mid.example', 'maybe', 72), C('weak1.example', 'maybe', 45), C('weak2.example', 'maybe', 55), C('www.instagram.com', 'maybe', 45, { url: 'https://www.instagram.com/p/X1/', use: 'social' })]) await FC.DB.put('copies', c);
    location.hash = '#found'; await new Promise(r => setTimeout(r, 800)); FCD = null; await loadFC(); state.fTab = 'web'; state.fView = 'list'; state.exp = []; state.open = ''; render(true);
    await new Promise(r => setTimeout(r, 600));
    const head = document.querySelector('.ghead.weakhead');
    const shownSites = [...document.querySelectorAll('.crow')].map(r => r.textContent);
    const before = { head: head ? head.textContent : '', weakShown: shownSites.some(t => /weak1|weak2/.test(t)), strong: shownSites.some(t => /strong\.example/.test(t)), mid: shownSites.some(t => /mid\.example/.test(t)) };
    head && head.click(); await new Promise(r => setTimeout(r, 600));
    const after = [...document.querySelectorAll('.crow')].map(r => r.textContent).filter(t => /weak1|weak2/.test(t)).length;
    return { before, after, last: LIST[LIST.length - 1] };
  });
  ok(/Weak Maybes/.test(w.before.head) && /2 copies/.test(w.before.head) && !w.before.weakShown && w.before.strong && w.before.mid, 'website Maybes under 60% fold into "Weak Maybes" at the bottom, closed (' + w.before.head.replace(/\s+/g, ' ').trim() + ')');
  ok(w.after === 2 && /weak/.test(w.last), 'one click opens them, at the end of the list');
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
