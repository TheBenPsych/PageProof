// Checks for 4.58: site popularity (Tranco list) and known bad site lists. Made-up lists and
// copies only; the real lists are never downloaded here.
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
  const v = await page.evaluate(async () => {
    // A made-up "top sites" list: 3000 filler sites plus the ones the checks use.
    const lines = ['1,bignews.example', '50,instagram.com', '60,blogspot.com', '5000,midsite.example', '80000,smallish.example', '500000,tiny.example'];
    for (let i = 0; i < 3000; i++) lines.push((600000 + i) + ',filler' + i + '.example');
    await PP_POP.save(lines.join('\r\n'), new Date().toISOString());
    await PP_BAD.load({ 'blp-piracy': '# Title: test\npiratemovies.example\nfree.blogspot.com\n', 'blp-scam': 'scammy.example\n', 'blp-fraud': '', 'blp-phishing': '', urlhaus: '127.0.0.1\tbignews.example\n127.0.0.1\tbadhost.example\n', openphish: 'https://login-bank.example/x\n' });
    const R = await PP_POP.ranks(['bignews.example', 'www.midsite.example', 'shop.smallish.example', 'nobody.example', 'www.instagram.com', 'me.blogspot.com']);
    const pid = 'd:Test Client/2026/Q4/a.jpg', now = new Date().toISOString();
    await FC.DB.put('clients', { name: 'Test Client', searching: true, licensed: [], photos: 1 });
    await FC.DB.put('photos', { id: pid, client: 'Test Client', name: 'a.jpg', rel: '', searches: 1 });
    for (const c of await FC.allCopies()) await FC.DB.del('copies', c.id);
    const C = site => ({ id: pid + '|' + site, photo: pid, client: 'Test Client', url: 'https://' + site + '/p', key: site + '/p', site, img: '', thumb: '', engines: ['bing'], match: 'same', pct: 96, inl: 200, tiles: 60, str: 0.9, firstSeen: now, status: 'new' });
    for (const s of ['bignews.example', 'midsite.example', 'smallish.example', 'nobody.example', 'piratemovies.example', 'free.blogspot.com', 'login-bank.example']) await FC.DB.put('copies', C(s));
    location.hash = '#found'; await new Promise(r => setTimeout(r, 800)); FCD = null; await loadFC(); state.fTab = 'web'; state.fView = 'list'; state.open = ''; state.fSort = 'pop'; render(true);
    await new Promise(r => setTimeout(r, 700));
    const rows = () => [...document.querySelectorAll('.crow:not(.calmhdr)')].map(r => ({ site: r.querySelector('.l1 b').textContent, tags: [...r.querySelectorAll('.l1 .tag')].map(t => t.textContent.trim()).join('|'), big: r.classList.contains('bigsite') }));
    const sorted = rows();
    const qf = [...document.querySelectorAll('.qf')].map(b => b.textContent.trim());
    state.fPop = '10k'; render(true); await new Promise(r => setTimeout(r, 500));
    const top = rows().map(r => r.site);
    state.fPop = 'Any'; state.fBad = true; render(true); await new Promise(r => setTimeout(r, 500));
    const bad = rows().map(r => r.site);
    state.fBad = false; state.fRisk = 'sus'; render(true); await new Promise(r => setTimeout(r, 500));
    const sus = rows().map(r => r.site);
    state.fRisk = 'Any'; location.hash = '#hidden'; await new Promise(r => setTimeout(r, 900));
    const set = document.body.textContent;
    location.hash = '#stats'; await new Promise(r => setTimeout(r, 1500));
    const stats = /Copies by site popularity/.test(document.body.textContent);
    location.hash = '#found'; await new Promise(r => setTimeout(r, 1200));
    return { stats, R: [...R.entries()], sorted, qf, top, bad, sus, set: /Site popularity list/.test(set) && /Known bad site lists/.test(set) && /URLhaus/.test(set) };
  });
  const R = new Map(v.R);
  ok(R.get('bignews.example') === 1 && R.get('www.midsite.example') === 5000 && R.get('shop.smallish.example') === 80000 && R.get('nobody.example') === 0, 'ranks: exact, www., sub-site counts as its main site, unknown = 0 ' + JSON.stringify(v.R));
  ok(!R.has('www.instagram.com') && !R.has('me.blogspot.com'), 'social sites and free blog hosts get no rank');
  const T = Object.fromEntries(v.sorted.map(r => [r.site, r]));
  ok(v.sorted[0].site === 'bignews.example' && v.sorted[1].site === 'midsite.example' && v.sorted[2].site === 'smallish.example', 'Sort "Most popular site" puts the biggest first: ' + v.sorted.map(r => r.site).join(', '));
  ok(/Top 1K/.test(T['bignews.example'].tags) && T['bignews.example'].big && /Top 10K/.test(T['midsite.example'].tags) && /Top 100K/.test(T['smallish.example'].tags) && !T['smallish.example'].big && !/Top/.test(T['nobody.example'].tags), 'row tags and gold edge: ' + JSON.stringify(T));
  ok(!/Known/.test(T['bignews.example'].tags), 'a top 10K site on the malware list is not called a malware site');
  ok(/Known piracy site/.test(T['piratemovies.example'].tags) && /Known piracy site/.test(T['free.blogspot.com'].tags) && /Known phishing site/.test(T['login-bank.example'].tags), 'known bad sites get red tags (piracy, phishing; exact blog address)');
  ok(v.qf.some(t => /Big sites \(top 10K\)\s*2/.test(t)) && v.qf.some(t => /Known bad sites\s*3/.test(t)), 'quick filters Big sites and Known bad sites with counts: ' + v.qf.join(' / '));
  ok(v.top.length === 2 && v.top.includes('bignews.example') && v.top.includes('midsite.example'), 'Top 10K filter shows only the big sites: ' + v.top.join(', '));
  ok(v.bad.length === 3 && v.sus.includes('piratemovies.example') && v.sus.includes('login-bank.example'), 'Known bad filter, and they count as Suspicious: ' + v.bad.join(', ') + ' / ' + v.sus.join(', '));
  ok(v.set, 'Settings › Site lists shows both lists');
  ok(v.stats, 'Stats page has the Copies by site popularity card');
  if (process.env.SHOT) { await page.setViewportSize({ width: 1300, height: 760 }); await page.waitForTimeout(500); await page.screenshot({ path: process.env.SHOT }); }
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
