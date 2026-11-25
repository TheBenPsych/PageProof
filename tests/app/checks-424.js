// 4.24: spam blog farms. Copies on random-looking addresses of throwaway sites (ab3cd9.madeupname.blog)
// get a grey Spam blog tag and stay out of Copies found and One at a time until you show them.
// Hide all of those sites hides the whole site. Nothing is answered by itself.
const { start } = require('./h.js');
process.env.NP = 600; process.env.NC = 120;
const { seed } = require('./seed.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  await seed(page); await page.reload(); await page.waitForTimeout(1500);
  // The name checks on their own.
  const lab = await page.evaluate(() => ['ass4c61', 'kl77lfl', 'vemv18u0g', 'news24', 'blog2', 'johnsmith'].map(FC.randomLabel));
  ok(lab.join() === 'true,true,true,false,false,false', 'Random-looking names are spotted, news24 / blog2 / plain words are not');
  // the ones that got through before (a word joined to the random part, a made-up site name,
  // "amphtml" in the address), while real news sites and Yandex's own utm_source=yasmartcamera tag stay clear.
  const more = await page.evaluate(() => {
    const u = ['https://uqumo2us-amphtml.beauty-glam.makeup/', 'https://fw65mw.fit/', 'https://talkcorner.forum/amphtml/post-123',
      'https://www.standartnews.com/a/b?utm_source=yasmartcamera', 'https://nypost.com/2026/11/01/x/amp/', 'https://k9dog.fit/', 'https://www.bbc.co.uk/news/x',
      'https://radioalacalle.com/kay+proctor+onlyfans+nude?utm_source=yasmartcamera', 'https://nypost.com/2026/11/01/us-news/onlyfans-model-sues-x/', 'https://www.etsy.com/market/red+wedding+dress'];
    const m = FC.spamMarks(u.map((x, i) => ({ id: 'u' + i, url: x, site: new URL(x).hostname.replace(/^www\./, '') })));
    return u.map((x, i) => m.has('u' + i));
  });
  ok(more.join() === 'true,true,true,false,false,false,false,true,false,false', 'amphtml, made-up site names and search-words pages are caught, real news sites and shop searches are not (' + more.join() + ')');
  // Three new website copies move to a made-up farm: two on one throwaway site, one on another.
  const pick = await page.evaluate(async () => {
    FCD = null; await loadFC();
    const nw = FCD.copies.filter(c => c.status === 'new' && !isSoc(c) && !siteHidden(c)).slice(0, 4);
    const to = ['ab3cd9.madeupname.blog', 'qz77kpl.madeupname.blog', 'x9t4fm2.othername.blog'];
    for (let i = 0; i < 3; i++) { const r = await FC.DB.get('copies', nw[i].id); r.site = to[i]; r.url = 'https://' + to[i] + '/'; r.country = ''; await FC.DB.put('copies', r); }
    FC.dropCache && FC.dropCache();
    return { ids: nw.slice(0, 3).map(c => c.id), normal: nw[3].id, before: await FC.countNew() };
  });
  const r = await page.evaluate(async ([ids, normal]) => {
    FCD = null; await loadFC();
    const cs = ids.map(id => FCD.copies.find(c => c.id === id)), n = FCD.copies.find(c => c.id === normal);
    return { spam: cs.every(c => c.spam && c.spam.length), normal: !n.spam, status: cs.every(c => c.status === 'new'), tag: sigIcons(cs[0]).includes('Spam blog'), inQueue: reviewQueue().some(c => ids.includes(c.id)) };
  }, [pick.ids, pick.normal]);
  ok(r.spam && r.normal, 'The three farm copies are marked spam, an ordinary copy is not');
  ok(r.status, 'Their answers are not changed by themselves');
  ok(r.tag, 'The row shows a Spam blog tag');
  ok(!r.inQueue, 'One at a time leaves them out');
  await page.goto(url('app.html#found')); await page.waitForTimeout(1500);
  const listed = () => page.evaluate(ids => LIST.filter(id => ids.includes(id)).length, pick.ids);
  ok((await listed()) === 0, 'Copies found hides them by default');
  ok(/3 spam blog copies hidden/.test(await page.textContent('.spamline') || ''), 'The line says 3 spam blog copies hidden');
  await page.click('[data-act="spamshow"][data-v="show"]'); await page.waitForTimeout(600);
  const shownN = await listed(); ok(shownN >= 2, 'Show them brings them back (' + shownN + ' listed; two share one site, so one folds under it)');
  await page.click('[data-act="qtoggle"][data-v="spam"]'); await page.waitForTimeout(600);
  const only = await page.evaluate(() => LIST.every(id => (FCD.copies.find(c => c.id === id) || {}).spam));
  ok(only && (await listed()) >= 2, 'The Spam blogs quick filter shows only them');
  // Hide all of those sites: the whole site goes on the hidden list.
  await page.click('.spamline [data-act="spamhide"]'); await page.waitForTimeout(1200);
  const hid = await page.evaluate(async () => (await RS_LISTS.load()).hidden);
  ok(hid.includes('madeupname.blog') && hid.includes('othername.blog'), 'Hide all hides both whole spam sites');
  ok(await page.evaluate(() => RS_LISTS.isHidden('newaddr1.madeupname.blog', 'https://newaddr1.madeupname.blog/')), 'A new made-up address on the same site is hidden too');
  await page.evaluate(() => ACTS.undo()); await page.waitForTimeout(1200);
  const back = await page.evaluate(async () => (await RS_LISTS.load()).hidden.includes('madeupname.blog'));
  ok(!back, 'Undo takes the spam sites off the hidden list');
  ok((await page.evaluate(() => FC.countNew())) <= pick.before, 'The new-copies number leaves spam blog copies out');
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e); process.exit(1); });
