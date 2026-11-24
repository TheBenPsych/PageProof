// 4.32: reposts and shares on social media. A link to an account page is followed to the exact post
// that holds the photo, and a share or repost of someone else's post is tagged, hidden unless
// "Show reposts and shares" is ticked, and points to the original post. Nothing is answered by itself.
const { start } = require('./h.js');
process.env.NP = 300; process.env.NC = 80;
const { seed } = require('./seed.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const PNG = require('fs').readFileSync(require('path').resolve(__dirname, '../../extension/icons/icon128.png'));
// A made-up Facebook page: a share of another person's post (like Ben's example), then the page's
// own post tagging someone ("is with"), which is NOT a share.
const FB = `<!doctype html><html><body><div role="main">
<div role="article" aria-posinset="1">
  <h2><a href="https://www.facebook.com/SampleFanPageNYC/">Sample Fan Page</a></h2>
  <a href="https://www.facebook.com/SampleFanPageNYC/posts/pfbid0AAA">November 2 at 3:26 PM</a>
  <div>YUP</div>
  <a href="https://www.facebook.com/photo/?fbid=1111&set=a.2222"><img src="https://scontent.xx.fbcdn.net/v/t39/468012345_111_222_n.jpg?stp=x" style="width:400px;height:300px"></a>
  <h3><a href="https://www.facebook.com/jane.sample.1">Jane Sample</a> is with <a href="https://www.facebook.com/joe.other">Joe Other</a></h3>
  <a href="https://www.facebook.com/jane.sample.1/posts/pfbid0BBB">November 2 at 2:47 PM</a>
  <div role="article" aria-label="Comment by Pat Person"><a href="https://www.facebook.com/pat.person">Pat Person</a> nice <a href="https://www.facebook.com/pat.person/posts/1">3w</a></div>
</div>
<div role="article" aria-posinset="2">
  <h2><a href="https://www.facebook.com/SampleFanPageNYC/">Sample Fan Page</a> is with <a href="https://www.facebook.com/joe.other">Joe Other</a></h2>
  <a href="https://www.facebook.com/SampleFanPageNYC/posts/pfbid0CCC">October 30 at 1:00 PM</a>
  <img src="https://scontent.xx.fbcdn.net/v/t39/999_888_777_n.jpg" style="width:400px;height:300px">
</div></div></body></html>`;
(async () => {
  const { ctx, url } = await start();
  await ctx.route('https://www.facebook.com/**', r => r.fulfill({ contentType: 'text/html', body: FB }));
  await ctx.route('https://scontent.xx.fbcdn.net/**', r => r.fulfill({ contentType: 'image/png', body: PNG }));
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  await seed(page); await page.reload(); await page.waitForTimeout(1500);

  // Which links are account pages.
  const prof = await page.evaluate(() => [
    'https://www.facebook.com/SampleFanPageNYC/', 'https://www.facebook.com/SampleFanPageNYC/posts/pfbid0AAA', 'https://www.facebook.com/photo/?fbid=1',
    'https://x.com/someone', 'https://x.com/someone/status/123', 'https://www.instagram.com/some.one/', 'https://www.instagram.com/p/AbC/', 'https://www.tiktok.com/@some', 'https://www.threads.net/@some/post/Abc',
  ].map(u => PP_REPOST.profileOnly({ url: u, site: new URL(u).hostname.replace(/^www\./, '') })));
  ok(prof.join() === 'true,false,false,true,false,true,false,true,false', 'Account-page links are told apart from post links (' + prof.join() + ')');

  // The scan runs on the made-up page, and the share is read from it.
  const fbPage = await ctx.newPage();
  await fbPage.goto('https://www.facebook.com/SampleFanPageNYC/'); await fbPage.waitForTimeout(500);
  const src = await page.evaluate(() => PP_REPOST.scanInTab.toString());
  const scan = await fbPage.evaluate(`(${src})({ screens: 2, want: ['468012345_111_222_n.jpg'] })`);
  ok(scan.plat === 'fb' && scan.items.length === 2, 'Both posts on the page are read (' + scan.items.length + ')');
  const j = await page.evaluate(scan => {
    const own = PP_SOCIAL.fromUrl('https://www.facebook.com/SampleFanPageNYC/');
    const a = PP_REPOST.judge('fb', scan.items[0], own, 0), b = PP_REPOST.judge('fb', scan.items[1], own, 0);
    return { a, b, post: PP_REPOST.postUrlOf('fb', scan.items[0], own, a), commentLeft: !scan.items[0].links.some(l => /pat\.person/.test(l.h)) };
  }, scan);
  ok(j.a && j.a.kind === 'share' && j.a.orig && /jane\.sample\.1/.test(j.a.orig.key), 'The share is spotted and names the original poster (' + (j.a && j.a.orig && j.a.orig.handle) + ')');
  ok(j.a && /jane\.sample\.1\/posts\/pfbid0BBB/.test(j.a.origPost), 'It points to the original post');
  ok(/SampleFanPageNYC\/posts\/pfbid0AAA/.test(j.post), 'The exact post on the account page is found');
  ok(j.b === null, 'The page\'s own post that tags someone ("is with") is not called a share');
  ok(j.commentLeft, 'Comment links are left out');

  // X: "reposted" over a post, and a quoted post holding the picture.
  const x = await page.evaluate(() => {
    const own = PP_SOCIAL.fromUrl('https://x.com/fanacct');
    const rep = PP_REPOST.judge('x', { lab: 'fanacct reposted', imgs: [{ src: 'https://pbs.twimg.com/media/A.jpg' }], links: [{ h: 'https://x.com/realphotog', head: true }, { h: 'https://x.com/realphotog/status/55', head: false }] }, own, 0);
    const own2 = PP_REPOST.judge('x', { lab: '', imgs: [{ src: 'https://pbs.twimg.com/media/A.jpg' }], links: [{ h: 'https://x.com/fanacct', head: true }, { h: 'https://x.com/fanacct/status/56' }] }, own, 0);
    const ig = PP_REPOST.judge('ig', { href: 'https://www.instagram.com/realphotog/p/AbC/', imgs: [{ src: 'a' }], links: [] }, PP_SOCIAL.fromUrl('https://www.instagram.com/fanacct/'), 0);
    return { rep: rep && rep.orig.handle, own2, ig: ig && ig.orig.handle };
  });
  ok(x.rep === '@realphotog', 'An X repost names the original account');
  ok(x.own2 === null, 'An X account\'s own post is not a repost');
  ok(x.ig === '@realphotog', 'An Instagram grid link to someone else\'s post is a repost');

  // The whole check on a real copy. The quiet background tab is stood in for by the scan above
  // (the test browser can't load made-up Facebook pages in tabs PageProof opens itself).
  const full = await page.evaluate(async scan => {
    PP_SOCIAL.openQuiet = async () => ({ id: -1 }); PP_SOCIAL.closeQuiet = () => {};
    const real = api.scripting.executeScript; api.scripting.executeScript = async o => o.target.tabId === -1 ? [{ result: scan }] : real.call(api.scripting, o);
    FCD = null; await loadFC();
    const c = FCD.copies.find(c => isSoc(c) && c.status === 'new') || FCD.copies.find(c => c.status === 'new' && !c.spam);
    const r = await FC.DB.get('copies', c.id);
    r.site = 'facebook.com'; r.url = 'https://www.facebook.com/SampleFanPageNYC/'; r.img = 'https://scontent.xx.fbcdn.net/v/t39/468012345_111_222_n.jpg?stp=y';
    r.acct = { ...PP_SOCIAL.fromUrl(r.url), from: 'link', sure: 'sure' };
    await FC.DB.put('copies', r); FC.dropCache && FC.dropCache();
    FCD = null; await loadFC();
    const before = await FC.countNew();
    const cc = FCD.copies.find(x => x.id === c.id);
    const rp = await rpCheck(cc);
    const after = await FC.countNew();
    const saved = await FC.DB.get('copies', c.id);
    return { id: c.id, rp, status: saved.status, before, after };
  }, scan);
  ok(full.rp && full.rp.state === 'repost' && full.rp.kind === 'share', 'The copy is checked in a background tab and saved as a share');
  ok(full.rp && /pfbid0AAA/.test(full.rp.post), 'The copy keeps the exact post link');
  ok(full.status === 'new', 'Its answer is not changed by itself');
  ok(full.after === full.before - 1, 'The new-copies count leaves it out (' + full.before + ' -> ' + full.after + ')');

  // Copies found › Social media: hidden until "Show reposts and shares" is ticked.
  await page.goto(url('app.html#found')); await page.waitForTimeout(1500);
  await page.evaluate(() => { switchTab('social'); state.fFilter = 'All'; render(true); }); await page.waitForTimeout(800);
  const inList = () => page.evaluate(id => LIST.includes(id), full.id);
  ok(!(await inList()), 'It is hidden from the list by default');
  ok(/Show reposts and shares\s*\(1 hidden\)/.test(await page.textContent('.acctfilters')), 'The tick box says 1 hidden');
  await page.click('[data-act="frepost"]'); await page.waitForTimeout(800);
  ok(await inList(), 'Ticking it shows the copy again');
  ok(/Share of/.test(await page.textContent(`[data-id="${full.id}"]`).catch(() => '') || await page.evaluate(id => rpTags(FCD.copies.find(c => c.id === id)), full.id)), 'The row says "Share of …"');
  const box = await page.evaluate(id => rpBox(FCD.copies.find(c => c.id === id)), full.id);
  ok(/Open the original post/.test(box) && /pfbid0BBB/.test(box), 'The copy\'s panel links the original post');
  await page.evaluate(() => api.storage.local.remove('ppShowReposts'));
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
