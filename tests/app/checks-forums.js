// Checks for the forums rule: forums are never pursued. Reddit (every address) and clear forum addresses
// are dropped from search results, never land in Copies found, and copies found before stay off
// the list (Stolen ones stay). Reddit is no longer a social media platform.
// Pretend copies only; the network is never used.
const { start } = require('./h.js');
process.env.NP = 200; process.env.NC = 60;
const { seed } = require('./seed.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e.stack || e).slice(0, 900)); });
  const go = async h => { await page.goto(url('app.html#' + h)); await page.waitForTimeout(1300); };
  await go('help'); await seed(page); await page.reload(); await page.waitForTimeout(1000);

  // ---- the rule on its own
  const r = await page.evaluate(() => {
    const yes = ['https://www.reddit.com/r/pics/comments/abc/x/', 'https://old.reddit.com/r/a/', 'https://redd.it/abc', 'https://i.redd.it/x.jpg', 'https://preview.redd.it/x.jpg?w=1',
      'https://external-preview.redd.it/x.jpg', 'https://b.thumbs.redditmedia.com/x.jpg', 'https://forums.example.com/topic/1', 'https://forum.example.org/', 'https://boards.example.net/a',
      'https://example.com/forum/photo-thread-123', 'https://example.com/forums/general/', 'https://example.com/threads/my-car.12345/', 'https://example.com/viewtopic.php?t=12',
      'https://example.com/showthread.php?t=99', 'https://example.com/forumdisplay.php?f=3', 'https://example.com/index.php?topic=55.0', 'https://community.example.com/t/my-photo/4521'];
    const no = ['https://www.nytimes.com/2026/11/01/photo.html', 'https://www.threads.net/@someone/post/abc', 'https://www.threads.com/@someone', 'https://example.com/news/forum-of-ideas',
      'https://example.com/t/abc', 'https://example.com/tag/forums', 'https://notreddit.com/x', 'https://www.instagram.com/p/x/', 'https://example.com/threads-and-yarn/', 'https://reddit.example.com/x'];
    return { yes: yes.filter(u => !RS_FORUM.is(RS_SITE.of(u), u)), no: no.filter(u => RS_FORUM.is(RS_SITE.of(u), u)),
      hidden: RS_LISTS.isHidden('reddit.com', 'https://www.reddit.com/r/x/'), social: PP_SOCIAL.isSocial('reddit.com') || PP_SOCIAL.isSocial('redd.it'),
      acct: (PP_SOCIAL.fromUrl('https://www.reddit.com/user/someone/') || {}).key || '' };
  });
  ok(!r.yes.length, 'Reddit and forum addresses are caught (missed: ' + r.yes.join(' ') + ')');
  ok(!r.no.length, 'Normal sites, Threads and look-alikes are not caught (wrong: ' + r.no.join(' ') + ')');
  ok(r.hidden, 'Reddit links count as hidden in search results');
  ok(!r.social, 'Reddit is no longer social media');

  // ---- a new search: forum links never become copies
  const ing = await page.evaluate(async () => {
    const p = await FC.DB.get('photos', (await FC.allCopies())[0].photo);
    const before = (await FC.allCopies()).length;
    const L = u => ({ url: u, key: RS_UTIL.key(u), site: RS_SITE.of(u), title: '', thumb: '', engines: ['google'], pct: 100, verdict: 'same' });
    const pic = { id: p.id, name: p.name, client: p.client, path: p.path, hash: p.hash, w: p.w, h: p.h, size: p.size };
    await FC.ingest(pic, [L('https://www.reddit.com/r/pics/comments/zz/new/'), L('https://i.redd.it/newpic.jpg'), L('https://example.com/threads/car.991/'), L('https://brand-new-site-431.example/photo')], 'test');
    const all = await FC.allCopies();
    return { added: all.length - before, kept: all.filter(c => /reddit|redd\.it|threads\/car/.test(c.url)).length, normal: all.some(c => c.url === 'https://brand-new-site-431.example/photo') };
  });
  ok(ing.kept === 0 && ing.normal && ing.added === 1, 'A search keeps the normal link and drops the 3 forum links (' + JSON.stringify(ing) + ')');

  // ---- copies found before 4.31 stay off Copies found (Stolen stays)
  await page.evaluate(async () => {
    const base = (await FC.allCopies())[0];
    const mk = (id, u, status) => ({ ...base, id, url: u, key: RS_UTIL.key(u), site: RS_SITE.of(u), status, acct: undefined, use: 'web', country: '', spam: false, alts: [] });
    await FC.DB.putMany('copies', [mk('rd-old', 'https://www.reddit.com/r/old/comments/1/', 'new'), mk('rd-stolen', 'https://www.reddit.com/r/old/comments/2/', 'stolen'), mk('fo-old', 'https://forums.example.com/topic/7', 'new')]);
  });
  await go('found');
  const shown = await page.evaluate(async () => { FCD = null; await loadFC(); await render(true); await new Promise(r => setTimeout(r, 500));
    const cs = FCD.copies || (await FC.allCopies()); return { hid: ['rd-old', 'fo-old'].map(id => FC.hiddenCopy(cs.find(c => c.id === id))), stolen: FC.hiddenCopy(cs.find(c => c.id === 'rd-stolen')),
      rows: [...document.querySelectorAll('[data-id]')].map(e => e.dataset.id).filter(id => ['rd-old', 'fo-old'].includes(id)).length }; });
  ok(shown.hid.every(Boolean) && shown.rows === 0, 'Reddit and forum copies found before are off Copies found (' + JSON.stringify(shown) + ')');
  ok(shown.stolen === false, 'A Reddit copy already marked Stolen is kept');
  const n = await page.evaluate(async () => { const all = await FC.allCopies(); return all.filter(c => ['rd-old', 'fo-old'].includes(c.id) && c.status === 'new').length; });
  ok(n === 2, 'Their saved answers are left untouched (nothing to undo)');

  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e); process.exit(1); });
