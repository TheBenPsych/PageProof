// Checks for 4.9: Copies found split into Websites and Social media. Social posts are about the
// ACCOUNT: the account is found even when the link hides it, Stolen / Hide / Approve work per
// account, the live preview gives way to "The post", new social sites are asked about once.
// Pretend accounts and photos only; the network is never used (the finder's steps are stubbed).
const { start } = require('./h.js');
process.env.NP = 400; process.env.NC = 120;
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

  // ---- the link reader on its own
  const parsed = await page.evaluate(() => [
    'https://www.instagram.com/p/C9xQ2fLsA1k/', 'https://www.instagram.com/harbor.light/p/AAA/', 'https://www.tiktok.com/@quickclips/video/1', 'https://x.com/morningwire/status/1',
    'https://www.facebook.com/story.php?story_fbid=1&id=1000123', 'https://www.facebook.com/share/p/1Bq8/', 'https://www.reddit.com/user/someone/comments/x/'].map(u => (PP_SOCIAL.fromUrl(u) || {}).key || ''));
  ok(parsed.join(',') === ',instagram.com/harbor.light,tiktok.com/@quickclips,x.com/morningwire,facebook.com/id.1000123,,reddit.com/user/someone', 'Accounts read from links, none invented for /p/ and share links (' + parsed.join(',') + ')');
  ok(await page.evaluate(() => PP_SOCIAL.isSocial('m.facebook.com') && PP_SOCIAL.isSocial('pinterest.co.uk') && !PP_SOCIAL.isSocial('site1.com') && PP_SOCIAL.isShort('https://vm.tiktok.com/ZMh7/') && !!PP_SOCIAL.shapeOf('https://photoverse.example/@jane/123456789')), 'Social sites, short links and profile-shaped links are recognised');

  // ---- pretend social copies
  const ids = await page.evaluate(async () => {
    const photos = (await FC.allCopies()).map(c => c.photo);
    const p1 = photos[0], p2 = photos[1], cl = p1.slice(2).split('/')[0], cl2 = p2.slice(2).split('/')[0];
    const day = d => new Date(Date.now() - d * 864e5).toISOString();
    const mk = (id, photo, client, u, extra = {}) => ({ id, photo, client, url: u, key: RS_UTIL.key(u), site: RS_SITE.of(u), title: '', thumb: '', img: '', engines: ['google'], pct: 91, match: 'same', w: 1080, h: 1080, firstSeen: day(1), lastSeen: day(0), times: 1, by: 'Keep searching', status: 'new', online: 'up', ...extra });
    const xs = [
      mk('s1', p1, cl, 'https://www.instagram.com/harbor.light/p/OLD1/', { status: 'stolen', answered: day(9) }),
      mk('s2', p1, cl, 'https://www.instagram.com/p/NEWPOST1/'),                    // account only on the page
      mk('s3', p2, cl2, 'https://www.instagram.com/harbor.light/reel/REEL2/'),
      mk('s4', p2, cl2, 'https://www.instagram.com/other.pics/p/XYZ/'),
      mk('s5', p1, cl, 'https://vm.tiktok.com/ZMshort1/'),                           // short link
      mk('s6', p1, cl, 'https://www.facebook.com/share/p/1Bq8sXk3/'),                // nothing works: set by hand
      mk('s7', p2, cl2, 'https://photoverse.example/@jane/123456789'),               // a new social site
      mk('w1', p2, cl2, 'https://dailynews.example/2026/11/harbor', { pf: { ok: true, at: day(0), embeds: [{ key: 'instagram.com/harbor.light', handle: '@harbor.light', url: 'https://www.instagram.com/harbor.light/', plat: 'instagram.com' }] } }),
    ];
    for (const c of xs) { c.country = FC.countryOf(c.site); c.use = FC.useOf(c); const a = c.use === 'social' && PP_SOCIAL.fromUrl(c.url); if (a) c.acct = { ...a, from: 'link', sure: 'sure' }; }
    await FC.DB.putMany('copies', xs);
    return { uses: xs.map(c => c.id + ':' + c.use).join(' ') };
  });
  ok(/s1:social s2:social .*s6:social s7:copied|s7:unknown|s7:embedded/.test(ids.uses) && /w1:(unknown|copied|embedded)/.test(ids.uses), 'Social posts are "social", a website with an embedded post is not (' + ids.uses + ')');

  // The finder's network steps, stubbed: the short link leads to @quickclips; the post page of
  // NEWPOST1 says it is harbor.light's; Facebook shows nothing.
  const STUB = () => {
    PP_SOCIAL.unshort = async u => /ZMshort1/.test(u) ? 'https://www.tiktok.com/@quickclips/video/7312' : '';
    PP_SOCIAL.publicInfo = async u => /tiktok/.test(u) ? { acct: null, post: { caption: 'Clip of the harbor' } } : null;
    PP_CHECKS.readPage = async c => /NEWPOST1/.test(c.url) ? { ok: true, at: new Date().toISOString(), url: c.url, sells: {}, ads: [], soc: { desc: '1,204 likes, 38 comments - harbor.light on November 20, 2025: "Sunset over the old pier"', title: '' } }
      : { ok: false, at: new Date().toISOString(), why: 'The page answered 403' };
  };
  // Applied to every page load (before Copies found starts looking), and to this page now.
  await ctx.addInitScript(`window.addEventListener('DOMContentLoaded', () => { if (window.PP_SOCIAL && window.PP_CHECKS) (${STUB.toString()})(); });`);
  const stub = () => page.evaluate(STUB);
  await stub();

  // ---- Websites tab: no social posts there
  await go('found'); await stub(); await page.evaluate(() => { FCD = null; state.fView = 'list'; state.fFilter = 'All'; return render(true); }); await page.waitForTimeout(800);
  const web = await page.evaluate(() => ({ tabs: [...document.querySelectorAll('.bigtabs button')].map(b => b.textContent.replace(/\s+/g, ' ').trim()), social: LIST.filter(id => /^s[1-6]$/.test(id)).length, w1: !!document.querySelector('.crow[data-v="w1"]'), emb: (document.querySelector('.crow[data-v="w1"] .l1') || {}).textContent || '' }));
  ok(web.tabs.length === 2 && /^Websites \d+$/.test(web.tabs[0]) && /^Social media \d+$/.test(web.tabs[1]), 'Two tabs with counts (' + web.tabs.join(' | ') + ')');
  ok(web.social === 0 && web.w1, 'The Websites tab has no social posts, and keeps the website with an embedded post');
  ok(/Embedded post by @harbor\.light/.test(web.emb), 'A website showing an embedded post names its account');
  await page.evaluate(() => { state.fClient = 'Client B Media'; });

  // ---- Social media tab
  await page.click('.bigtabs [data-v="social"]'); await page.waitForTimeout(900);
  await page.evaluate(() => { state.fView = 'list'; state.fFilter = 'All'; return render(true); }); await page.waitForTimeout(600);
  const s0 = await page.evaluate(() => ({ dbg: state.fView + ' rows:' + [...document.querySelectorAll('.crow')].map(r => r.dataset.v).join(',') + ' more:' + [...document.querySelectorAll('.morerow')].map(r => r.textContent.trim()).join('|'), list: LIST.slice(), fClient: state.fClient, chips: [...document.querySelectorAll('.platchips .pchip')].map(b => b.textContent.replace(/\s+/g, ' ').trim()), tiles: [...document.querySelectorAll('.qf')].map(b => b.textContent.replace(/\s+/g, ' ').trim()) }));
  ok(s0.list.every(id => /^s[1-6]$/.test(id)) && s0.list.includes('s4') && !s0.list.includes('w1'), 'The Social media tab shows only social posts (' + s0.list.join(',') + ') ' + s0.dbg);
  ok(s0.fClient === 'Any', 'Each tab keeps its own filters (the Websites client filter is not on Social media)');
  ok(s0.chips.some(t => /Instagram 4$/.test(t)) && s0.chips.some(t => /TikTok 1/.test(t)), 'Platform chips with counts (' + s0.chips.join(' | ') + ')');
  ok(s0.tiles.some(t => /Known stolen accounts/.test(t)), 'The Social media tab counts known stolen accounts');
  // Posts by one account fold together ("2 more from @harbor.light on Instagram"), never per platform.
  const fold = await page.evaluate(() => [...document.querySelectorAll('.morerow')].map(r => r.textContent.replace(/\s+/g, ' ').trim()));
  ok(fold.some(t => /more from @harbor\.light on Instagram/.test(t)) && !fold.some(t => /instagram\.com/.test(t)), 'Posts fold per account, not per platform (' + fold.join(' | ') + ')');
  await page.click('.morerow'); await page.waitForTimeout(600);
  const s3 = await page.evaluate(() => document.querySelector('.crow[data-v="s3"] .l1').textContent.replace(/\s+/g, ' '));
  ok(/@harbor\.light/.test(s3) && /Instagram reel/.test(s3) && /Marked stolen once before/.test(s3), 'A row leads with the account and says it was marked stolen before (' + s3.trim().slice(0, 90) + ')');
  ok(await page.evaluate(() => !/Marked stolen/.test(document.querySelector('.crow[data-v="s4"] .l1').textContent)), 'Another account on the same platform is NOT a repeat offender');

  // ---- the finder fills in the hidden accounts by itself
  await page.waitForFunction(() => FCD && ['s2', 's5', 's6'].every(id => { const c = FCD.copies.find(x => x.id === id); return c && c.acctTry; }), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3500);
  const found = await page.evaluate(async () => Object.fromEntries(await Promise.all(['s2', 's5', 's6'].map(async id => { const c = await FC.DB.get('copies', id); return [id, c.acct ? c.acct.handle + '|' + c.acct.from + '|' + c.acct.sure : '']; }))));
  ok(found.s2 === '@harbor.light|page|likely', 'Instagram /p/ link: account read from the post page (' + found.s2 + ')');
  ok(found.s5 === '@quickclips|short|sure', 'TikTok short link: account from its real address (' + found.s5 + ')');
  ok(found.s6 === '', 'Facebook share link: nothing invented when nothing is found');
  await page.evaluate(() => { FCD = null; return render(true); }); await page.waitForTimeout(700);
  const s6 = await page.evaluate(() => document.querySelector('.crow[data-v="s6"] .l1').textContent.replace(/\s+/g, ' '));
  ok(/Account not found yet/.test(s6) && /Set account/.test(s6), 'A post without an account says so, with Set account');
  await shot('49-social');

  // ---- the panel: The post instead of the live page, the Account tab, set the account by hand
  await page.evaluate(() => { state.dView = 'page'; }); await page.click('.crow[data-v="s6"] [data-act="openacct"]'); await page.waitForTimeout(900);
  const d = await page.evaluate(() => { const d = document.getElementById('drawer'); return { tabs: [...d.querySelectorAll('.dtabs button')].map(b => b.textContent.trim()), shown: [...d.querySelectorAll('.dpane')].filter(p => !p.hidden).map(p => p.dataset.tab), post: !!d.querySelector('.dview .postcard'), live: !!d.querySelector('#pgbox'), look: d.querySelector('#lookbox').textContent }; });
  ok(d.tabs.join(',') === 'Summary,The post,Account,Claim' && d.shown.join() === 'acct', 'Social panel tabs: Summary, The post, Account, Claim; Set account opens the Account tab');
  ok(d.post && !d.live, '"The post" shows instead of the live page');
  ok(/Account not found yet/.test(d.look), 'Look at these says the account is not found yet');
  await page.fill('#acctIn', 'facebook.com/harborlightfans'); await page.click('[data-act="saveacct"]'); await page.waitForTimeout(900);
  const set = await page.evaluate(async () => { const c = await FC.DB.get('copies', 's6'); const kept = await FC.meta.get('acctKept'); return { a: c.acct && c.acct.key + '|' + c.acct.from, kept: Object.values(kept || {}).map(k => k.key) }; });
  ok(set.a === 'facebook.com/harborlightfans|you' && set.kept.includes('facebook.com/harborlightfans'), 'Set account saves it and keeps it for the backup (' + set.a + ')');
  await page.click('[data-act="undo"]'); await page.waitForTimeout(800);
  ok(await page.evaluate(async () => !(await FC.DB.get('copies', 's6')).acct), 'Undo takes the typed account back off');

  // ---- Stolen remembers the account; Hide works per account (also for /p/ links)
  await page.evaluate(() => { state.open = 's4'; return render(true); }); await page.waitForTimeout(700);
  await page.keyboard.press('y'); await page.waitForTimeout(1200);
  const toastT = await page.evaluate(() => (document.querySelector('.toast') || {}).textContent || '');
  ok(/@other\.pics is now a known account/.test(toastT), 'Stolen on a social post says the account is now known (' + toastT.slice(0, 90) + ')');
  await page.evaluate(async () => { await hideSite('instagram.com/harbor.light'); FCD = null; return render(true); }); await page.waitForTimeout(800);
  const hid = await page.evaluate(() => ({ list: LIST.slice(), hidden: RS_LISTS.hidden.includes('instagram.com/harbor.light') }));
  ok(hid.hidden && !hid.list.includes('s2') && !hid.list.includes('s3'), 'Hiding @harbor.light hides its posts, including the /p/ link that doesn\'t show the account');
  ok(await page.evaluate(() => { state.fFilter = 'All'; return true; }) && !hid.list.includes('s1'), 'Its stolen post is hidden too');
  const n = await page.evaluate(() => FC.countNew());
  const nVis = await page.evaluate(async () => (await FC.allCopies()).filter(c => c.status === 'new' && !FC.hiddenCopy(c, RS_LISTS.hidden) && !FCD.countries.includes(c.country)).length);
  ok(n === nVis, 'The new-copies number leaves out hidden accounts (' + n + ' = ' + nVis + ')');
  const choices = await page.evaluate(() => hideChoices(FCD.copies.find(c => c.id === 's5')).map(x => x[1]));
  ok(choices.length === 1 && choices[0] === 'Hide @quickclips', 'Hide choices on a social post: only the account (' + choices.join(' | ') + ')');
  // 4.9.4: a whole social site can never be hidden; one hidden before shows again with a note.
  const whole = await page.evaluate(async () => {
    await RS_LISTS.load();
    const refused = !(await RS_LISTS.add('hidden', 'tiktok.com')) && !(await RS_LISTS.add('hidden', 'https://www.instagram.com/')) && !RS_LISTS.hidden.includes('tiktok.com');
    const acctOk = await RS_LISTS.add('hidden', 'tiktok.com/@someoneelse'); await RS_LISTS.remove('hidden', 'tiktok.com/@someoneelse');
    const webOk = await RS_LISTS.add('hidden', 'example-news.test'); await RS_LISTS.remove('hidden', 'example-news.test');
    const api = globalThis.browser || chrome;
    RS_LISTS.hidden.push('x.com'); await RS_LISTS.save();   // as an older version would have saved it
    await RS_LISTS.load();
    const un = (await api.storage.local.get('ppSocialUnhid')).ppSocialUnhid || [];
    return { refused, acctOk, webOk, gone: !RS_LISTS.hidden.includes('x.com'), un };
  });
  ok(whole.refused && whole.acctOk && whole.webOk, 'tiktok.com and instagram.com can\'t be hidden; an account or a website still can');
  ok(whole.gone && whole.un.includes('x.com'), 'x.com hidden before is shown again and noted (' + whole.un.join(', ') + ')');
  await page.evaluate(() => { FCD = null; return render(true); }); await page.waitForTimeout(700);
  const note = await page.evaluate(() => [...document.querySelectorAll('.banner')].map(b => b.textContent).join(' | '));
  ok(/x\.com shows again/.test(note) && /only its accounts/.test(note), 'Copies found says x.com shows again');
  await page.click('[data-act="unhidok"]'); await page.waitForTimeout(500);
  ok(!(await page.evaluate(() => [...document.querySelectorAll('.banner')].some(b => /shows again/.test(b.textContent)))), '"Got it" removes the note');
  await page.click('[data-act="undo"]'); await page.waitForTimeout(800);
  ok(await page.evaluate(() => !RS_LISTS.hidden.includes('instagram.com/harbor.light')), 'Undo shows the account again');

  // ---- Approve one account
  await page.evaluate(async () => { FCD = null; await render(true); state.open = 's5'; await render(true); await ACTS.approveacct('all'); }); await page.waitForTimeout(900);
  const appr = await page.evaluate(async () => ({ st: (await FC.DB.get('copies', 's5')).status, allowed: RS_LISTS.allowed.includes('tiktok.com/@quickclips'), other: (await FC.DB.get('copies', 's2')).status }));
  ok(appr.st === 'licensed' && appr.allowed && appr.other === 'new', 'Approve @quickclips licenses only that account\'s posts');

  // ---- Group by account, the Accounts list, same name elsewhere
  await page.evaluate(() => { state.fView = 'account'; state.fFilter = 'All'; return render(true); }); await page.waitForTimeout(700);
  const g = await page.evaluate(() => [...document.querySelectorAll('.ghead .gname')].map(x => x.textContent.trim()));
  ok(g.includes('@harbor.light') && g.includes('@other.pics'), 'Group by account (' + g.join(', ') + ')');
  await page.click('[data-act="sview"][data-v="accounts"]'); await page.waitForTimeout(700);
  const acc = await page.evaluate(() => [...document.querySelectorAll('table.accts tbody tr')].map(r => r.textContent.replace(/\s+/g, ' ').trim()));
  ok(acc.some(r => /@harbor\.light/.test(r) && /Known stolen/.test(r)) && acc.some(r => /@quickclips/.test(r) && /Approved/.test(r)), 'Accounts list: one line per account with its status (' + acc.length + ' lines)');
  await shot('49-accounts');
  await page.evaluate(() => { state.sView = 'copies'; state.open = 's2'; state.dTabFor = 's2'; state.dTab = 'acct'; FCD = null; return render(true); }); await page.waitForTimeout(800);
  const ap = await page.evaluate(() => document.querySelector('.dpane[data-tab="acct"]').textContent.replace(/\s+/g, ' '));
  ok(/Same photo on other platforms/.test(ap) && /Look for @harbor\.light on/.test(ap) && /Stolen before ?1 time/.test(ap), 'Account tab: stolen before, the same photo elsewhere, and where to look for the name (' + ap.slice(0, 160) + ')');
  await shot('49-account-tab');

  // ---- a new social site is asked about once
  await page.evaluate(() => { state.open = ''; return render(true); }); await page.waitForTimeout(500);
  await page.click('.bigtabs [data-v="web"]'); await page.waitForTimeout(800);
  const back = await page.evaluate(() => ({ ask: (document.querySelector('.socask') || {}).textContent || '', fClient: state.fClient }));
  ok(back.fClient === 'Client B Media', 'Back on Websites, its own filters are still there');
  ok(/photoverse\.example/.test(back.ask), 'A new social site is asked about (' + back.ask.trim().slice(0, 60) + ')');
  await page.click('.socask [data-act="socmark"][data-v="photoverse.example|social"]'); await page.waitForTimeout(900);
  const moved = await page.evaluate(async () => ({ use: FC.useOf(await FC.DB.get('copies', 's7')), ask: !!document.querySelector('.socask') }));
  ok(moved.use === 'social' && !moved.ask, 'Answering "Yes, social" moves it to the Social media tab and stops asking');

  // ---- Settings › Social sites
  await page.evaluate(() => { state.hidTab = 'social'; state.hidQ = ''; }); await go('hidden'); await page.waitForTimeout(500);
  const set2 = await page.evaluate(() => document.querySelector('main, #app, body').textContent.replace(/\s+/g, ' '));
  ok(/photoverse\.example/.test(set2) && /social sites PageProof already knows/.test(set2), 'Settings lists your social-site choices and the built-in ones');
  const snap = await page.evaluate(() => FC.settingsSnapshot());
  ok(snap.socialSites && snap.socialSites['photoverse.example'] === 'social' && snap.accounts, 'Social-site choices and typed accounts are in the settings backup');

  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await ctx.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e); process.exit(1); });
