// 4.22: every "Add from a file" is remembered and can be undone, taking out only the sites that file
// added. A file added before 4.22 can be taken out by picking the same file again.
const { start } = require('./h.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#hidden')); await page.waitForTimeout(1200);
  const reset = async extra => page.evaluate(async ([t, extra]) => {
    await RS_LISTS.load(); RS_LISTS.hidden = ['patch.com', 'old-one.com'];
    if (t) { for (const s of RS_LISTS.parse(t)) if (!RS_LISTS.hidden.includes(s)) RS_LISTS.hidden.push(s); RS_LISTS.hidden.push('later.com'); }
    await RS_LISTS.save(); await chrome.storage.local.set({ rsImports: [] }); await render(true);
  }, [extra || '', 0]);
  const hidden = () => page.evaluate(async () => { await RS_LISTS.load(); return RS_LISTS.hidden; });
  const file = 'https://www.alpha-news.com/story/1, https://beta-news.com/a\nhttps://old-one.com\nhttps://gamma.org/x/y\n';
  await reset();
  // 1. Add from a file, then Undo this import.
  await page.setInputFiles('#hidLoad', { name: 'links.txt', mimeType: 'text/plain', buffer: Buffer.from(file) });
  await page.waitForTimeout(800);
  let h = await hidden();
  ok(h.length === 5 && h.includes('alpha-news.com/story/1') && h.includes('beta-news.com/a'), 'A line with two links adds two sites');
  const txt = await page.textContent('main');
  ok(/Files you added/.test(txt) && /links\.txt/.test(txt), 'The import shows under Files you added');
  await page.click('[data-act="impundo"]'); await page.waitForTimeout(800);
  h = await hidden();
  ok(h.join() === 'patch.com,old-one.com', 'Undo this import takes out only what it added (old-one.com was there before and stays)');
  await page.click('[data-act="impundo"]'); await page.waitForTimeout(800);
  ok((await hidden()).length === 5, 'Add them again puts them back');
  // 2. An import made before 4.22 (nothing remembered): take out the sites in the same file.
  await reset(file);
  await page.setInputFiles('#hidUnload', { name: 'links.txt', mimeType: 'text/plain', buffer: Buffer.from(file) });
  await page.waitForTimeout(800);
  h = await hidden();
  ok(h.join() === 'patch.com,old-one.com,later.com', 'Take out the sites in a file takes out only that old import (sites from before and after stay)');
  ok((await page.$$('[data-act="impundo"]')).length === 1, 'The take-out is listed and can be put back');
  // 3. 4.22.1: a hidden list of 25,000 pages stays quick (Ben's list made every page slow).
  const ms = await page.evaluate(() => {
    const list = [];
    for (let i = 0; i < 25000; i++) list.push(['facebook.com', 'instagram.com', 'news' + (i % 500) + '.com'][i % 3] + '/page/' + i);
    list.push('facebook.com/hidden-account');
    const t0 = performance.now(); let hits = 0;
    for (let i = 0; i < 9000; i++) {
      const site = ['facebook.com', 'instagram.com', 'news7.com'][i % 3];
      if (RS_SITE.entryFor(site, 'https://www.' + site + '/other/' + i, list)) hits++;
    }
    const hit = RS_SITE.entryFor('facebook.com', 'https://m.facebook.com/hidden-account/posts/5', list);
    return { ms: performance.now() - t0, hits, hit };
  });
  ok(ms.ms < 1500 && ms.hits === 0 && ms.hit === 'facebook.com/hidden-account', `9,000 copies checked against 25,000 hidden pages in ${Math.round(ms.ms)} ms, still finds a hidden account`);
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log("ERR", e); process.exit(1); });
