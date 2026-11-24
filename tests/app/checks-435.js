// Checks for 4.35: personal accounts (just a person's name) and politicians are hidden on the
// Social media tab until you tick Show; the type can be set by hand; matches that are only a
// link preview card of another site's article (LinkedIn, X, Facebook shares) go to Removed.
// Pretend accounts only; the profile reader and their pages are stubbed.
const { start } = require('./h.js');
process.env.NP = 200; process.env.NC = 40;
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

  // ---- the rules on their own
  const u = await page.evaluate(() => {
    const S = PP_SOCIAL;
    const xf = (key, x) => S.profileFacts({ plat: 'x.com', key, handle: '@' + key }, [{ kind: 'profile', text: '', data: [], x }]);
    return {
      names: ['Pat Q. Example', 'Robin Sample ⚜️♛', 'Lee Example (Smith)', 'Brooklyn Example Paper', 'Channel 12 News', 'Rep. Pat Example'].map(S.personName).join(','),
      gov1: xf('PatExample', { name: 'Rep. Pat Example', check: 'grey', followers: '6.8M Followers', bio: "Proudly serving Ohio's beautiful Fourth District. Chairman @ExampleGOP." }),
      gov2: xf('PatExample', { name: 'Pat Example', check: '', followers: '6.8M Followers', bio: "Proudly serving Ohio's beautiful Fourth District." }),
      gov3: S.quickType({ plat: 'x.com', key: 'RepPatExample', handle: '@RepPatExample' }),
      gov4: S.quickType({ plat: 'x.com', key: 'pex', handle: '@pex' }, 'Rep. Pat Example on X: "Today we…"'),
      gov5: xf('pex2', { name: 'Pat Example', check: 'blue', followers: '20K Followers', bio: 'Husband, dad. (R-Ohio)' }),
      p1: xf('pqe31', { name: 'Pat Q. Example', check: 'blue', followers: '19K Followers', bio: 'Ex-newspaper editor and columnist. Longtime radio host.' }),
      p2: xf('robin1974', { name: 'Robin Sample ⚜️♛', check: 'blue', followers: '4,724 Followers', bio: 'Vous savez qui je suis.' }),
      notP1: xf('examplepaper', { name: 'Brooklyn Example', check: '', followers: '40K Followers', bio: 'Local news', url: 'https://example-paper.example/' }),
      notP2: xf('bigname', { name: 'Famous Example', check: 'blue', followers: '2.1M Followers', bio: 'Actor' }),
      fb: S.profileFacts({ plat: 'facebook.com', key: 'lee.example', handle: 'lee.example', url: 'https://www.facebook.com/lee.example' }, [{ kind: 'profile', h1: 'Lee Example (Smith)', text: 'Lee Example (Smith)\n162 friends\nGarfield, AR\nMessage\nAll\nAbout\nPersonal details\nLives in Garfield, Arkansas\n', data: [], buttons: ['Message'] }]),
      fbPage: S.profileFacts({ plat: 'facebook.com', key: 'examplebakery', handle: 'examplebakery', url: 'https://www.facebook.com/examplebakery' }, [{ kind: 'profile', h1: 'Example Bakery', text: 'Example Bakery\n2K likes • 2.2K followers\nPage · Bakery\n', data: [] }]),
      li: S.quickType(S.fromUrl('https://www.linkedin.com/posts/patexample_could-faster-share-7530609408981123072-ybzb/')),
      liIn: S.quickType(S.fromUrl('https://www.linkedin.com/in/pat-example-123/')),
      liCo: S.quickType(S.fromUrl('https://www.linkedin.com/company/example-co/')),
      cards: ['https://media.licdn.com/dms/image/v2/D4E10AQ/articleshare-shrink_800/B4EZ/0/1?e=1', 'https://pbs.twimg.com/card_img/1/abc?format=jpg', 'https://external.fhou1-1.fna.fbcdn.net/emg1/v/t13/123?url=x', 'https://media.licdn.com/dms/image/v2/D4E22AQ/feedshare-shrink_800/0/1', 'https://pbs.twimg.com/media/ABC.jpg', 'https://scontent.xx.fbcdn.net/v/t39/1.jpg'].map(x => S.cardPic(x) ? 'card' : 'own').join(','),
      kindMine: S.kindOf({ plat: 'x.com', key: 'x' }, { ok: true, name: 'Pat Example', type: 'Business', typeSure: 'guess' }, '', 'Person').type,
      kindOld: S.kindOf({ plat: 'x.com', key: 'x' }, { ok: true, v: 2, name: 'Robin Sample', followers: 800, signs: [], verified: 'paid' }).type,
    };
  });
  ok(u.names === 'true,true,true,false,false,false', 'A person\'s name is told apart from outlets and offices (' + u.names + ')');
  ok(u.gov1.type === 'Government' && u.gov2.type === 'Government' && /Fourth District/.test(u.gov2.gov), 'Politician: grey check, and "serving … Fourth District" with no check, are Government (' + u.gov2.gov + ')');
  ok(u.gov3 && u.gov3.type === 'Government' && u.gov4 && u.gov4.type === 'Government' && u.gov5.type === 'Government', 'Politician known before the profile is read: @Rep… handle, "Rep." in the post title, "(R-Ohio)" in the bio');
  ok(u.p1.type === 'Person' && u.p1.typeSure === 'guess' && u.p2.type === 'Person', 'X: just a name, no website or contact, under 100k followers = Person, even with a paid check (' + u.p1.personWhy + ')');
  ok(u.notP1.type !== 'Person' && u.notP2.type !== 'Person', 'Not Person: an outlet with its own website, or a famous account with over 100k followers');
  ok(u.fb.type === 'Person' && u.fb.typeSure === 'sure' && u.fbPage.type !== 'Person', 'Facebook: a friends count / Personal details = Person; a Page is not (' + u.fb.personWhy + ')');
  ok(u.li && u.li.type === 'Person' && u.liIn.type === 'Person' && u.liCo.type === 'Business', 'LinkedIn: a person\'s post or /in/ profile = Person, /company/ = Business');
  ok(u.cards === 'card,card,card,own,own,own', 'Link preview card pictures (LinkedIn articleshare, X card_img, Facebook external) are told from posted pictures (' + u.cards + ')');
  ok(u.kindMine === 'Person' && u.kindOld === 'Person', 'Type set by hand wins; accounts read before 4.35 are sorted without a new read');

  // ---- pretend social copies
  const CARD = 'https://media.licdn.com/dms/image/v2/D4E10AQ/articleshare-shrink_800/B4EZ/0/1?e=1';
  await page.evaluate(async CARD => {
    const photos = (await FC.allCopies()).map(c => c.photo);
    const p1 = photos[0], cl = p1.slice(2).split('/')[0];
    const day = d => new Date(Date.now() - d * 864e5).toISOString();
    const mk = (id, u, extra = {}) => ({ id, photo: p1, client: cl, url: u, key: RS_UTIL.key(u), site: RS_SITE.of(u), title: '', thumb: '', img: '', engines: ['google'], pct: 91, match: 'same', w: 1080, h: 1080, firstSeen: day(1), lastSeen: day(0), times: 1, by: 'Keep searching', status: 'new', online: 'up', ...extra });
    const xs = [
      mk('b1', 'https://x.com/pqe31/status/1'),                          // a person (read)
      mk('b2', 'https://x.com/pex/status/2', { title: 'Rep. Pat Example on X: "Today we…"' }),   // politician, not read
      mk('b3', 'https://www.linkedin.com/in/pat-example-123/recent-activity/'),   // LinkedIn person
      mk('b4', 'https://www.instagram.com/examplebakery/p/BBB/'),          // a business (read)
      mk('b5', 'https://www.linkedin.com/company/example-co/posts/', { img: CARD }),   // link preview card only
      mk('b6', 'https://www.linkedin.com/in/sam-example-9/recent-activity/', { status: 'stolen' }),   // a person's copy you marked stolen
    ];
    for (const c of xs) { c.country = FC.countryOf(c.site); c.use = FC.useOf(c); const a = PP_SOCIAL.fromUrl(c.url); if (a) c.acct = { ...a, from: 'link', sure: 'sure' }; }
    await FC.DB.putMany('copies', xs);
    const at = new Date().toISOString();
    await FC.meta.set('acctInfo', {
      'x.com/pqe31': { ok: true, v: 5, at, name: 'Pat Q. Example', followers: 19000, fw: 'followers', verified: 'paid', type: 'Person', typeSure: 'guess', personWhy: 'only a person\'s name', signs: [] },
      'instagram.com/examplebakery': { ok: true, v: 5, at, name: 'Example Bakery', followers: 2200, fw: 'followers', verified: 'no', type: 'Business', typeSure: 'sure', category: 'Bakery', signs: [] },
      'x.com/pex': { ok: false, at, failAt: at, tries: 1 },
      'linkedin.com/in/pat-example-123': { ok: false, at, failAt: at, tries: 1 },
      'linkedin.com/company/example-co': { ok: false, at, failAt: at, tries: 1 },
    });
  }, CARD);
  const badge0 = await page.evaluate(() => FC.countNew());
  await page.evaluate(() => api.storage.local.set({ ppAcctRead: false }));
  await go('found');
  await page.evaluate(() => { PP_SOCIAL.readProfile = async () => []; PP_CHECKS.readPage = async () => ({ ok: false, at: new Date().toISOString(), why: 'stubbed' }); PP_SOCIAL.unshort = async () => ''; PP_SOCIAL.publicInfo = async () => null; });
  await page.evaluate(() => { FCD = null; state.fFilter = 'All'; return render(true); }); await page.waitForTimeout(700);
  await page.click('.bigtabs [data-v="social"]'); await page.waitForTimeout(500);
  await page.evaluate(() => { state.fView = 'list'; state.fFilter = 'All'; return render(true); }); await page.waitForTimeout(400);
  await page.evaluate(() => socQueue()); await page.waitForTimeout(1500);
  await page.evaluate(() => { FCD = null; return render(true); }); await page.waitForTimeout(700);
  const shown = () => page.evaluate(() => LIST.filter(id => /^b\d$/.test(id)).sort().join(','));
  const s1 = await shown();
  ok(s1 === 'b4,b6', 'Social media tab hides the personal accounts, the politician and the link preview; a copy you marked Stolen stays (' + s1 + ')');
  const b5 = await page.evaluate(async () => { const c = await FC.DB.get('copies', 'b5'); return c.status + '/' + c.removedBy; });
  ok(b5 === 'removed/linkcard', 'The LinkedIn link preview match went to Removed by itself (' + b5 + ')');
  const chips = await page.evaluate(() => [...document.querySelectorAll('.acctfilters label.chip')].map(l => l.textContent.replace(/\s+/g, ' ').trim()).join(' | '));
  ok(/Show government \(1 hidden\)/.test(chips) && /Show personal accounts \(2 hidden\)/.test(chips), 'The Show government and Show personal accounts ticks say how many are hidden (' + chips + ')');
  // Ben: "Socials shows 9 matches but I see none" - the tab number and the Quick filter numbers
  // count only copies you can see (hidden government, personal and repost copies don't count).
  const nums = await page.evaluate(() => { const t = s => (document.querySelector(s) || {}).textContent || ''; const qf = [...document.querySelectorAll('.qfrow .qf')].map(b => +(b.querySelector('.num') || {}).textContent || 0); return { tab: +t('.bigtabs [data-v="social"] .n'), fresh: +t('.tabs [data-v="New"] span'), qmax: Math.max(0, ...qf) }; });
  ok(nums.tab === nums.fresh && nums.qmax <= nums.fresh, 'Social media tab number and Quick filters count only the copies that show (tab ' + nums.tab + ', New ' + nums.fresh + ', biggest Quick filter ' + nums.qmax + ')');
  await shot('435-social');
  await page.click('[data-act="fperson"]'); await page.waitForTimeout(500);
  ok((await shown()) === 'b1,b3,b4,b6', 'Show personal accounts brings them back (' + (await shown()) + ' ' + JSON.stringify(await page.evaluate(() => [state.fView, state.fFilter, state.fPerson, state.fTab, state.open])) + ')');
  ok(await page.evaluate(async () => (await api.storage.local.get('ppShowPerson')).ppShowPerson === true), 'The tick is remembered');
  const row = await page.evaluate(() => { const r = document.querySelector('.crow[data-v="b3"]'); return r ? r.textContent.replace(/\s+/g, ' ') : ''; });
  ok(/Person/.test(row), 'A LinkedIn /in/ row shows the Person type before its profile is read');
  await page.click('[data-act="fperson"]'); await page.waitForTimeout(500);

  // ---- the type set by hand
  await page.evaluate(() => { state.fPerson = false; state.open = 'b4'; state.dTabFor = 'b4'; state.dTab = 'acct'; return render(true); }); await page.waitForTimeout(700);
  ok(await page.evaluate(() => !!document.querySelector('#acctabout select[data-act="settype"]')), 'About this account has "Type is wrong?" to set it by hand');
  await page.selectOption('#acctabout select[data-act="settype"]', 'Person'); await page.waitForTimeout(600);
  const s2 = await page.evaluate(async () => ({ list: LIST.filter(id => /^b\d$/.test(id)).sort().join(','), mine: (await FC.meta.get('acctType')) || {} }));
  ok(s2.mine['instagram.com/examplebakery'] === 'Person' && s2.list === 'b6', 'Set to Person by hand: kept, and its copies hide with the other personal accounts (' + s2.list + ')');
  const bk = await page.evaluate(() => FC.settingsJson ? FC.settingsJson() : null).catch(() => null);
  if (bk) ok(bk.acctType && bk.acctType['instagram.com/examplebakery'] === 'Person', 'The type set by hand is in the settings backup');

  // ---- the new-copies number leaves them out too
  const cnt = await page.evaluate(async () => { await api.storage.local.set({ ppShowPerson: true, ppShowGov: true }); const a = await FC.countNew(); await api.storage.local.set({ ppShowPerson: false, ppShowGov: false }); const b = await FC.countNew(); return [a, b]; });
  ok(cnt[0] - cnt[1] === 4, 'The new-copies number leaves out the personal accounts and the politician, like Copies found (' + cnt.join(' -> ') + ')');
  ok(badge0 >= cnt[1], 'The removed link preview no longer counts (' + badge0 + ' -> ' + cnt[1] + ')');

  // ---- Put back stays put back
  await page.evaluate(async () => { await FC.answer(['b5'], 'new'); FCD = null; await loadFC(); await cardSweep(); });
  const b5b = await page.evaluate(async () => (await FC.DB.get('copies', 'b5')).status);
  ok(b5b === 'new', 'A link preview you Put back is not removed again (' + b5b + ')');

  // ---- the search: a social match found only on the link preview card is thrown out

  // ---- during a search: a LinkedIn post whose only matching picture is the link preview card
  const rp = await ctx.newPage();
  rp.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e.stack || e).slice(0, 600)); });
  await rp.goto(url('revsearch.html?job=none')); await rp.waitForTimeout(800);
  const pic = await rp.evaluate(async () => {
    const draw = async seedN => { let s = seedN; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647; const cv = new OffscreenCanvas(800, 600), g = cv.getContext('2d'); g.fillStyle = '#ddd'; g.fillRect(0, 0, 800, 600); for (let i = 0; i < 400; i++) { g.fillStyle = `hsl(${rnd() * 360},70%,${25 + rnd() * 50}%)`; g.fillRect(rnd() * 800, rnd() * 600, 8 + rnd() * 50, 8 + rnd() * 50); } return cv.convertToBlob({ type: 'image/jpeg', quality: 0.9 }); };
    window.__ours = await draw(7);
    return btoa(String.fromCharCode(...new Uint8Array(await __ours.arrayBuffer())));
  });
  const OURS = Buffer.from(pic, 'base64');
  const POST = 'https://www.linkedin.com/posts/patexample_could-faster-share-7000000000000000000-abcd/';
  await ctx.route(/^https:\/\/(www\.linkedin\.com|media\.licdn\.com)\//, route => {
    const u = route.request().url();
    if (/media\.licdn\.com/.test(u)) return route.fulfill({ status: 200, contentType: 'image/jpeg', body: OURS });
    if (u === POST) return route.fulfill({ status: 200, contentType: 'text/html', body: '<html><head><meta property="og:image" content="https://media.licdn.com/dms/image/v2/X/articleshare-shrink_800/ours.jpg"><meta property="og:description" content="Today\'s paper raises a point… nypost.com"></head><body><article><a class="main-feed-card__article" data-tracking-control-name="public_post_feed-article-content" href="https://www.linkedin.com/redir/redirect?url=https%3A%2F%2Fnypost.example%2F2026%2Fstory"><img src="https://media.licdn.com/dms/image/v2/X/articleshare-shrink_800/ours.jpg"></a></article></body></html>' });
    return route.fulfill({ status: 404, body: '' });
  });
  const rv = await rp.evaluate(async POST => {
    job = { id: 't', pics: [{ i: 0, name: 'ours.jpg', blob: __ours, links: [] }], engines: ['google'] };
    const l = { url: POST, key: POST, site: 'linkedin.com', pic: 0, from: 'preview', pct: 100, inl: 60, tiles: 40, str: 1, mid: 1, n: 100, wall: 0, sv: SCORE_VERSION, engines: ['google'] };
    const np = needsPage(l); if (np) await pageCheck(l);
    const bing = { url: 'https://x.com/a/status/1', key: 'k', site: 'x.com', pic: 0, from: 'image', img: 'https://pbs.twimg.com/card_img/1/abc?format=jpg', pct: 100, inl: 60, tiles: 40, str: 1, mid: 1, n: 100, wall: 0, sv: SCORE_VERSION, engines: ['bing'] };
    return l.onPage + ':' + verdict(l) + ' / ' + verdict(bing);
  }, POST);
  ok(rv === 'card:no / no', 'During a search, a match that is only a link preview card is thrown out (LinkedIn page, X card picture) (' + rv + ')');
  const ap = await ctx.newPage(); await ap.goto(url('app.html#help')); await ap.waitForTimeout(800);
  const card = await ap.evaluate(async POST => { const pf = await PP_CHECKS.readPage({ url: POST, site: 'linkedin.com' }); return pf.card; }, POST);
  ok(card && card.site === 'nypost.example' && card.only, 'Reading the post page names the shared article\'s site (' + JSON.stringify(card) + ')');
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await ctx.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e); process.exit(1); });
