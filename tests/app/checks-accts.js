// Checks for 4.12: account details on social copies. PageProof reads each account's profile
// by itself (stubbed here: the network and real tabs are never used) and works out followers,
// verified, account type (with an automatic business check), country and owner company.
// Filters, row badges, Sort by followers, the Accounts list columns and the panel follow.
// Pretend accounts only.
const { start } = require('./h.js');
process.env.NP = 300; process.env.NC = 60;
const { seed } = require('./seed.js');
const SHOTS = process.env.SHOTS || '';
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e.stack || e).slice(0, 900)); });
  const shot = async n => { if (SHOTS) await page.screenshot({ path: SHOTS + '/' + n + '.png' }); };
  const go = async h => { await page.goto(url('app.html#' + h)); await page.waitForTimeout(1300); };
  await go('help'); await seed(page); await page.reload(); await page.waitForTimeout(1000);

  // ---- the profile reader on its own (what each site shows, turned into facts)
  const unit = await page.evaluate(() => {
    const S = PP_SOCIAL;
    const ig = S.fromUrl('https://www.instagram.com/pinecrest.bakery/');
    const fb = S.fromUrl('https://www.facebook.com/harborlightoutfitters');
    const fan = S.fromUrl('https://www.facebook.com/coastalsunsetsfans');
    const xo = S.fromUrl('https://x.com/DailyExNews');
    const grp = { key: 'facebook.com/groups/shorephotoswap', handle: 'Shore Photo Swap', url: 'https://www.facebook.com/groups/shorephotoswap', plat: 'facebook.com' };
    const guess = S.fromUrl('https://www.instagram.com/seaside.goods/');
    const nothing = S.fromUrl('https://www.tiktok.com/@quickclips');
    return {
      nums: ['12.5K', '1,204', '1.2M', '3 B', '48 200'].map(S.big).join(','),
      pages: S.profilePages(fb).map(p => p.url).concat(S.profilePages(xo).map(p => p.url)).join(' '),
      ig: S.profileFacts(ig, [{ kind: 'profile', desc: '9,812 Followers, 300 Following, 120 Posts - See Instagram photos and videos from Pinecrest Bakery (@pinecrest.bakery)', text: '', data: [['is_business_account', 'true'], ['category_name', '"Bakery"'], ['is_verified', 'false']], about: 'About this account\nDate joined\nMarch 2019\nAccount based in\nUnited States\nFormer usernames\n@pinecrest_old\n' }]),
      fb: S.profileFacts(fb, [{ kind: 'profile', text: 'Harbor Light Outfitters\n48K likes • 52K followers\nPage · Clothing store\n', data: [], badge: ['Verified account'], links: ['https://l.facebook.com/l.php?u=https%3A%2F%2Fharborlight.example%2F'], buttons: ['Shop now'] },
        { kind: 'transparency', text: 'Page transparency\nConfirmed Page owner\nHarbor Light Outfitters LLC\n12 Pier St, Portland, ME 04101\nPage created - March 4, 2015\nPrimary country/region location for people who manage this Page\nUnited States (3)\n' }]),
      fan: S.profileFacts(fan, [{ kind: 'profile', text: 'Coastal Sunsets Fans\n3.1K followers\nPage · Fan Page\n', data: [] }]),
      xo: S.profileFacts(xo, [{ kind: 'profile', text: 'Daily Example News\n1.4M Followers', data: [['verified_type', '"Business"'], ['followers_count', '1450000']], x: { name: 'Daily Example News', check: 'gold', followers: '1.4M Followers', bio: 'News all day' } }, { kind: 'transparency', text: 'About this account\nAccount based in\nCanada\n' }]),
      // 4.24 (Ben's screenshots): X's page data is the viewer's (0 followers, a check) and its
      // footer says "© 2026 X Corp." Neither may end up on the account.
      xs: S.profileFacts(S.fromUrl('https://x.com/ExampleRep'), [{ kind: 'profile', text: 'Pat Example\n@ExampleRep\nTerms of Service\n© 2026 X Corp.', data: [['followers_count', '0'], ['is_blue_verified', 'true']], x: { name: 'Pat Example', check: 'blue', followers: '1M Followers', bio: 'Mom | NY99 Congresswoman | Author', url: 'https://linktr.ee/example' } }, { kind: 'transparency', text: 'About this account\n© 2026 X Corp.', data: [['followers_count', '0']] }]),
      xc: S.profileFacts(S.fromUrl('https://x.com/examplecouncil'), [{ kind: 'profile', text: '© 2026 X Corp.', data: [['followers_count', '0'], ['verified', 'true']], x: { name: 'Sam Example', check: '', followers: '12.6K Followers', category: 'Media Personality', bio: 'From radio to City Hall | Staten Island', url: 'https://sampleforcouncil.example' } }]),
      fbn: S.profileFacts(S.fromUrl('https://www.facebook.com/61500000000001/photos/123/'), [{ kind: 'profile', h1: 'Jo Example', ogTitle: '', text: 'Jo Example\n44K followers • 92 following\nDigital creator\nAll\nAbout\nDetails\nBoston, MA, United States\nLinks\n', data: [] }, { kind: 'transparency', text: 'Page transparency\nPeople who manage this Page\nPrimary country/region location for people who manage this Page includes:\nUnited States (1)\n' }]),
      fbp: S.profileFacts(S.fromUrl('https://www.facebook.com/61500000000002'), [{ kind: 'profile', h1: 'Lee Example', text: 'Lee Example\n2K followers\nDetails\nAustin, Texas\n', data: [] }]),
      pages2: S.profilePages(S.fromUrl('https://www.facebook.com/61500000000001/photos/123/')).map(p => p.url).join(' '),
      xp: S.profileFacts(S.fromUrl('https://x.com/plainperson'), [{ kind: 'profile', text: '', data: [], x: { name: 'Plain Person', check: 'blue', followers: '830 Followers', bio: 'Photos of the coast' } }]),
      grp: S.profileFacts(grp, [{ kind: 'profile', text: 'Shore Photo Swap\nPublic group · 12.4K members', data: [] }]),
      // No category shown: the automatic business check adds up the signs.
      guess: S.addShopSign(S.profileFacts(guess, [{ kind: 'profile', desc: '2,100 Followers - Seaside Goods (@seaside.goods)', text: '', data: [['biography', '"Handmade home decor. hello@seaside.example"'], ['is_business_account', 'null']], links: ['https://seasidegoods.example/'], buttons: [] }]), { ok: true, sells: { cart: true } }),
      nothing: S.profileFacts(nothing, [{ kind: 'profile', text: 'Log in to TikTok', desc: '', data: [] }]),
    };
  });
  ok(unit.nums === '12500,1204,1200000,3000000000,48200', 'Follower numbers like 12.5K, 1.2M and 48 200 are read right (' + unit.nums + ')');
  ok(/facebook\.com\/harborlightoutfitters\/about_profile_transparency/.test(unit.pages) && /x\.com\/DailyExNews\/about/.test(unit.pages), 'Facebook Page transparency and X "About this account" are read too');
  ok(unit.ig.followers === 9812 && unit.ig.verified === 'no' && unit.ig.type === 'Business' && unit.ig.typeSure === 'sure' && unit.ig.country === 'United States' && unit.ig.created === 'March 2019' && unit.ig.oldNames[0] === '@pinecrest_old',
    'Instagram: followers, not verified, Business (Bakery), based in, date joined, old names');
  ok(unit.fb.followers === 52000 && unit.fb.verified === 'meta' && unit.fb.company === 'Harbor Light Outfitters LLC' && /ME 04101/.test(unit.fb.address) && unit.fb.country === 'United States' && unit.fb.type === 'Business' && unit.fb.website === 'https://harborlight.example/',
    'Facebook: followers (not likes), check mark, owner company and address from Page transparency, country, website');
  ok(unit.fan.type === 'Fan page' && unit.grp.type === 'Group' && unit.grp.fw === 'members' && unit.grp.followers === 12400, 'Facebook fan page and group are told apart (' + unit.fan.type + ', ' + unit.grp.type + ' ' + unit.grp.followers + ' ' + unit.grp.fw + ')');
  ok(unit.xo.verified === 'gold' && unit.xo.type === 'Organisation' && unit.xo.followers === 1400000 && unit.xo.country === 'Canada', 'X: gold check = Organisation, followers, based in');
  ok(unit.xs.followers === 1000000 && unit.xs.verified === 'paid' && unit.xs.type === 'Government' && !unit.xs.company, 'X: followers from the profile not the viewer, blue check = Paid, Congresswoman = Government, no "X Corp." company (' + [unit.xs.followers, unit.xs.verified, unit.xs.type, unit.xs.company].join(' / ') + ')');
  ok(unit.xc.followers === 12600 && unit.xc.verified === 'no' && unit.xc.type === 'Government' && /forcouncil/.test(unit.xc.gov), 'X: no check stays No, a "for council" website = Government (' + [unit.xc.followers, unit.xc.verified, unit.xc.type, unit.xc.gov].join(' / ') + ')');
  ok(unit.fbn.name === 'Jo Example' && unit.fbn.followers === 44000 && unit.fbn.country === 'United States', 'Facebook number link: real name, followers, country from Page transparency (' + [unit.fbn.name, unit.fbn.followers, unit.fbn.country].join(' / ') + ')');
  ok(unit.fbp.country === 'United States' && unit.fbp.place === 'Austin, Texas', 'Facebook: country from the place on the profile (' + unit.fbp.country + ', ' + unit.fbp.place + ')');
  ok(/profile\.php\?id=61500000000001&sk=about_profile_transparency/.test(unit.pages2), 'A Facebook number link reads Page transparency too (' + unit.pages2 + ')');
  ok(unit.xp.verified === 'paid' && unit.xp.type !== 'Government' && unit.xp.followers === 830, 'X: an ordinary paid-check account is not Government');
  ok(unit.guess.type === 'Business' && unit.guess.typeSure === 'guess' && unit.guess.signs.length >= 3 && unit.guess.signs.includes('its website sells things'), 'No category: the business check adds up the signs (' + unit.guess.signs.join('; ') + ')');
  ok(!unit.nothing.ok && unit.nothing.type === '' && unit.nothing.verified === '' && unit.nothing.followers == null, 'A login wall gives "Not known", never a guess');

  // ---- pretend social copies, with the profile reader stubbed
  await page.evaluate(async () => {
    const photos = (await FC.allCopies()).map(c => c.photo);
    const p1 = photos[0], cl = p1.slice(2).split('/')[0];
    const day = d => new Date(Date.now() - d * 864e5).toISOString();
    const mk = (id, u, extra = {}) => ({ id, photo: p1, client: cl, url: u, key: RS_UTIL.key(u), site: RS_SITE.of(u), title: '', thumb: '', img: '', engines: ['google'], pct: 91, match: 'same', w: 1080, h: 1080, firstSeen: day(1), lastSeen: day(0), times: 1, by: 'Keep searching', status: 'new', online: 'up', ...extra });
    const xs = [
      mk('a1', 'https://www.facebook.com/harborlightoutfitters/posts/1'),
      mk('a2', 'https://www.facebook.com/coastalsunsetsfans/posts/2'),
      mk('a3', 'https://www.instagram.com/pinecrest.bakery/p/AAA/'),
      mk('a4', 'https://x.com/DailyExNews/status/4'),
      mk('a5', 'https://www.tiktok.com/@quickclips/video/5'),
    ];
    for (const c of xs) { c.country = FC.countryOf(c.site); c.use = FC.useOf(c); const a = PP_SOCIAL.fromUrl(c.url); if (a) c.acct = { ...a, from: 'link', sure: 'sure' }; }
    await FC.DB.putMany('copies', xs);
  });
  const STUB = (S = PP_SOCIAL) => {
    const P = {
      'facebook.com/harborlightoutfitters': [{ kind: 'profile', text: 'Harbor Light Outfitters\n52K followers\nPage · Clothing store\n', data: [], badge: ['Verified'], buttons: ['Shop now'] }, { kind: 'transparency', text: 'Confirmed Page owner\nHarbor Light Outfitters LLC\n12 Pier St, Portland, ME 04101\nPrimary country/region location for people who manage this Page\nUnited States (3)\n' }],
      'facebook.com/coastalsunsetsfans': [{ kind: 'profile', text: 'Coastal Sunsets Fans\n3.1K followers\nPage · Fan Page\n', data: [] }],
      'instagram.com/pinecrest.bakery': [{ kind: 'profile', desc: '9,812 Followers, 300 Following', text: '', data: [['is_business_account', 'true'], ['category_name', '"Bakery"'], ['is_verified', 'false']] }],
      'x.com/dailyexnews': [{ kind: 'profile', text: '', data: [['verified_type', '"Business"'], ['followers_count', '1450000']], x: { name: 'Daily Example News', check: 'gold', followers: '1.4M Followers' } }, { kind: 'transparency', text: 'Account based in\nCanada\n' }],
      'tiktok.com/@quickclips': [{ kind: 'profile', text: 'Log in', data: [] }],
    };
    window.READS = window.READS || [];
    S.readProfile = async a => { window.READS.push(a.key); await new Promise(r => setTimeout(r, 30)); return P[a.key] || []; };
    if (typeof PP_CHECKS !== 'undefined') PP_CHECKS.readPage = async () => ({ ok: false, at: new Date().toISOString(), why: 'stubbed' });
    S.unshort = async () => ''; S.publicInfo = async () => null;
  };
  // Applied the moment the page's scripts have run (before Copies found starts reading).
  // Extension pages don't run Playwright's start-up scripts, so the reader is switched off
  // (Settings) while the page loads, stubbed, then switched on again.
  await page.evaluate(() => api.storage.local.set({ ppAcctRead: false }));
  await go('found'); await page.evaluate(STUB);
  await page.evaluate(() => api.storage.local.set({ ppAcctRead: true }));
  await page.evaluate(() => { FCD = null; state.fFilter = 'All'; return render(true); }); await page.waitForTimeout(600);
  await page.click('.bigtabs [data-v="social"]'); await page.waitForTimeout(500);
  await page.evaluate(() => { state.fView = 'list'; state.fFilter = 'All'; return render(true); });
  await page.evaluate(() => infoQueue());
  // The reader goes one account at a time by itself (4 s apart).
  for (let i = 0; i < 40; i++) { await page.waitForTimeout(1000); const n = await page.evaluate(async () => Object.keys((await FC.meta.get('acctInfo')) || {}).length); if (n >= 5) break; }
  await page.waitForTimeout(3500);
  const info = await page.evaluate(async () => ({ reads: window.READS.slice(), all: (await FC.meta.get('acctInfo')) || {} }));
  ok(Object.keys(info.all).length === 5 && new Set(info.reads).size === info.reads.length, 'Every account is read by itself, once each (' + info.reads.join(' ') + ' / ' + Object.entries(info.all).map(([k, v]) => k + ':' + v.ok).join(' ') + ')');
  ok(info.all['tiktok.com/@quickclips'] && !info.all['tiktok.com/@quickclips'].ok && info.all['tiktok.com/@quickclips'].failAt, 'A profile that didn\'t show is marked to try again later');

  await page.evaluate(() => { FCD = null; return render(true); }); await page.waitForTimeout(700);
  const rows = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.crow')].map(r => [r.dataset.v, r.textContent.replace(/\s+/g, ' ')])));
  ok(/Meta check/.test(rows.a1 || '') && /Business/.test(rows.a1) && /52k followers/.test(rows.a1) && /Harbor Light Outfitters LLC/.test(rows.a1), 'A row shows the check mark, type, followers and company (' + (rows.a1 || '').slice(0, 160) + ')');
  ok(/Verified organisation/.test(rows.a4 || '') && /1\.4M followers/.test(rows.a4), 'X organisation row: gold check and followers');
  const dds = await page.evaluate(() => [...document.querySelectorAll('.acctfilters summary')].map(s => s.textContent.replace(/\s+/g, ' ').trim()));
  ok(dds.length === 4 && /^Verified/.test(dds[0]) && /^Followers/.test(dds[1]) && /^Account type/.test(dds[2]) && /^Country/.test(dds[3]), 'Four account filters on the Social media tab (' + dds.join(' | ') + ')');
  await shot('410-social');

  const pick = async (k, v) => { await page.evaluate(([k, v]) => { state[k] = v; return render(true); }, [k, v]); await page.waitForTimeout(400); return page.evaluate(() => LIST.filter(id => /^a\d$/.test(id)).sort().join(',')); };
  ok((await pick('fType', 'Business')) === 'a1,a3', 'Account type: Business shows the clothing store and the bakery');
  ok((await pick('fType', 'Fan page')) === 'a2', 'Account type: Fan page');
  ok((await pick('fType', 'nk')) === 'a5', 'Account type: Not known (the profile that didn\'t show)');
  await pick('fType', 'Any');
  ok((await pick('fVer', 'real')) === 'a4', 'Verified: really verified (the gold check, not the Meta check)');
  ok((await pick('fVer', 'meta')) === 'a1', 'Verified: Instagram/Facebook check');
  ok((await pick('fVer', 'no')) === 'a3', 'Verified: not verified');
  await pick('fVer', 'Any');
  ok((await pick('fFol', '1')) === 'a2,a3', 'Followers 1k–10k');
  ok((await pick('fFol', '4')) === 'a4', 'Followers over 1M');
  await pick('fFol', 'Any');
  ok((await pick('fCountry', 'Canada')) === 'a4', 'Country: Canada');
  const chip = await page.evaluate(() => [...document.querySelectorAll('.showing .stag')].map(b => b.textContent.trim()).join(' | '));
  ok(/Country: Canada/.test(chip), 'The filter shows as a chip you can clear (' + chip + ')');
  await page.click('.showing [data-act="unfilter"][data-v="fCountry"]'); await page.waitForTimeout(400);
  ok(await page.evaluate(() => state.fCountry === 'Any'), 'Clearing the chip clears the filter');
  // Websites tab: no account filters, and its copies aren't filtered by them.
  await page.evaluate(() => { state.fType = 'Business'; return render(true); }); await page.waitForTimeout(300);
  await page.click('.bigtabs [data-v="web"]'); await page.waitForTimeout(500);
  ok(await page.evaluate(() => !document.querySelector('.acctfilters') && state.fType === 'Any'), 'The Websites tab has no account filters');
  await page.click('.bigtabs [data-v="social"]'); await page.waitForTimeout(500);
  await page.evaluate(() => { state.fType = 'Any'; state.fSort = 'fol'; state.fFilter = 'All'; state.fView = 'list'; return render(true); }); await page.waitForTimeout(400);
  const order = await page.evaluate(() => LIST.filter(id => /^a\d$/.test(id)).join(','));
  ok(order.startsWith('a4,a1,a3,a2'), 'Sort: Most followers puts the biggest accounts first (' + order + ')');

  // ---- Accounts list: columns and sorting
  await page.evaluate(() => { state.sView = 'accounts'; return render(true); }); await page.waitForTimeout(500);
  const head = await page.evaluate(() => [...document.querySelectorAll('table.accts th')].map(t => t.textContent.trim()).join(','));
  ok(/Followers.*Verified.*Type.*Country/.test(head), 'Accounts list has Followers, Verified, Type and Country (' + head + ')');
  await page.click('table.accts [data-act="asort"][data-v="fol"]'); await page.waitForTimeout(400);
  const first = await page.evaluate(() => (document.querySelector('table.accts tbody tr') || {}).textContent || '');
  ok(/DailyExNews/.test(first), 'Sorting the Accounts list by Followers puts the biggest first');
  await shot('410-accounts');

  // ---- the panel: About this account, with ready-made searches for the company
  await page.evaluate(() => { state.sView = 'copies'; state.open = 'a1'; state.dTabFor = 'a1'; state.dTab = 'acct'; return render(true); }); await page.waitForTimeout(700);
  const ab = await page.evaluate(() => { const s = document.getElementById('acctabout'); return s ? { t: s.textContent.replace(/\s+/g, ' '), links: [...s.querySelectorAll('a')].map(a => a.href) } : { t: '', links: [] }; });
  ok(/Followers ?52,000 followers/.test(ab.t) && /Company ?Harbor Light Outfitters LLC/.test(ab.t) && /Based in ?United States/.test(ab.t), 'About this account lists followers, company and country (' + ab.t.slice(0, 160) + ')');
  ok(ab.links.some(u => /opencorporates\.com\/companies\/us_me\?q=Harbor/.test(u)) && ab.links.some(u => /uspto/.test(u)), 'The company gets Maine business register and trademark searches');
  const menuWho = await page.evaluate(() => { ACTS.rowmenu('a1', document.querySelector('.crow')); const m = document.getElementById('rowMenu'); const t = m ? m.textContent : ''; if (typeof closeRowMenu === 'function') closeRowMenu(); return t; });
  ok(/Who's behind Harbor Light Outfitters|Who's behind harborlightoutfitters/i.test(menuWho) && !/Who's behind facebook\.com/.test(menuWho), 'The row menu offers "Who\'s behind" the account, not the whole site');
  await shot('410-panel');

  // ---- the switch in Settings
  await page.evaluate(() => { state.hidTab = 'social'; state.hidQ = ''; }); await go('hidden'); await page.waitForTimeout(500);
  await page.click('#acctread'); await page.waitForTimeout(400);
  ok(await page.evaluate(async () => (await api.storage.local.get('ppAcctRead')).ppAcctRead === false), 'Settings can turn the automatic reading off');
  await page.click('#acctread'); await page.waitForTimeout(400);

  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await ctx.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e); process.exit(1); });
