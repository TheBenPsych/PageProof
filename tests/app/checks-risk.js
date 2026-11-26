// 4.92 (Ben, 2026-11-26: "Worth a look seems used too often"): a hidden owner alone never makes a
// site yellow, real outlets with a number or two dashes in their name are fine, popular sites
// (top 100,000) are never "Worth a look", and the tag says why in a few words.
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
  const r = await page.evaluate(() => {
    const L = (site, facts) => { const x = FC.riskOf({ site }, facts); return x.level + ':' + x.why.join('|'); };
    const old = new Date(Date.now() - 5 * 365 * 864e5).toISOString(), young = new Date(Date.now() - 90 * 864e5).toISOString();
    return {
      hidden: L('harbortimes.example', { domainHidden: true, created: old }),
      news18: L('news18.com'), radio: L('1027kord.com'), dash2: L('the-daily-post.com'),
      dash3: L('my-best-pic-site.com'), digits: L('pics20241122.com'),
      ending: L('harbor.info'), endingHidden: L('harbor.info', { domainHidden: true }),
      young: L('harbornews.com', { created: young }),
      short: FC.riskShort(['Ends in .info', 'Site is 3 months old', 'Odd name', 'Name used by copycat sites', 'Owner hidden']),
    };
  });
  ok(r.hidden === 'ok:Owner hidden', 'a hidden owner alone is not "Worth a look": ' + r.hidden);
  ok(r.news18 === 'ok:' && r.radio === 'ok:' && r.dash2 === 'ok:', 'news18.com, 1027kord.com and the-daily-post.com are fine: ' + [r.news18, r.radio, r.dash2].join(' '));
  ok(r.dash3 === 'watch:Odd name' && r.digits === 'watch:Odd name', 'three dashes or a long run of digits is still an odd name: ' + [r.dash3, r.digits].join(' '));
  ok(r.ending === 'watch:Ends in .info' && /^sus:/.test(r.endingHidden) && r.young === 'watch:Site is 3 months old', 'an odd ending or a young site is still yellow, and with a hidden owner red: ' + [r.ending, r.endingHidden, r.young].join(' '));
  ok(r.short === '.info ending, new site, odd name, copycat name, owner hidden', 'the signs in a few words: ' + r.short);
  // On Copies found: a popular .info site is not yellow; a small one says why on its tag.
  const v = await page.evaluate(async () => {
    const lines = ['5000,popular.info']; for (let i = 0; i < 3000; i++) lines.push((600000 + i) + ',filler' + i + '.example');
    await PP_POP.save(lines.join('\r\n'), new Date().toISOString());
    const pid = 'd:Test Client/2026/Q4/a.jpg', now = new Date().toISOString();
    await FC.DB.put('clients', { name: 'Test Client', searching: true, licensed: [], photos: 1 });
    await FC.DB.put('photos', { id: pid, client: 'Test Client', name: 'a.jpg', rel: '', searches: 1 });
    for (const c of await FC.allCopies()) await FC.DB.del('copies', c.id);
    const C = site => ({ id: pid + '|' + site, photo: pid, client: 'Test Client', url: 'https://' + site + '/p', key: site + '/p', site, img: '', thumb: '', engines: ['bing'], match: 'same', pct: 96, inl: 200, tiles: 60, str: 0.9, firstSeen: now, status: 'new' });
    for (const s of ['popular.info', 'unknown.info', 'news18.com']) await FC.DB.put('copies', C(s));
    location.hash = '#found'; await new Promise(r => setTimeout(r, 800)); FCD = null; await loadFC(); state.fTab = 'web'; state.fView = 'list'; state.open = ''; render(true);
    await new Promise(r => setTimeout(r, 800));
    const out = {};
    for (const r of document.querySelectorAll('.crow:not(.calmhdr)')) { const b = r.querySelector('.l1 b'); if (b) out[b.textContent] = [...r.querySelectorAll('.l1 .tag')].map(t => t.textContent.trim()).join('|'); }
    return out;
  });
  ok(v['unknown.info'] && /Worth a look: \.info ending/.test(v['unknown.info']), 'a small .info site\'s tag says why: ' + v['unknown.info']);
  ok(v['popular.info'] !== undefined && !/Worth a look/.test(v['popular.info']), 'a top 100,000 site is never "Worth a look": ' + v['popular.info']);
  ok(v['news18.com'] !== undefined && !/Worth a look|Suspicious/.test(v['news18.com']), 'news18.com has no warning tag: ' + v['news18.com']);
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await ctx.close(); process.exit(fails ? 1 : 0);
})();
