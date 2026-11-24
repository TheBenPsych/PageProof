// 4.23: links stolen before. Brought in from a file on Settings › Hidden and approved sites; a copy
// on one of those exact pages gets a "Stolen before" tag and the quick filter shows only those;
// other pages on the same website count as a repeat offender. Nothing is answered by itself.
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
  // Two new website copies: the first one's exact page goes on the list; the second gets moved to the same site.
  const pick = await page.evaluate(async () => {
    FCD = null; await loadFC();
    const nw = FCD.copies.filter(c => c.status === 'new' && !isSoc(c) && !siteHidden(c));
    const a = nw[0], b = nw.find(c => c.site !== a.site);
    const r = await FC.DB.get('copies', b.id); r.site = a.site; r.url = 'https://' + a.site + '/another/page'; r.pk = FC.pageKey(r.url); await FC.DB.put('copies', r);
    return { a: a.id, aUrl: a.url, b: b.id, status: a.status };
  });
  // 1. Add the list from a file on the Stolen before links tab.
  await page.goto(url('app.html#hidden')); await page.waitForTimeout(1000);
  await page.click('[data-act="hidtab"][data-v="stolen"]'); await page.waitForTimeout(500);
  const file = pick.aUrl.replace('https://', 'https://www.') + '?utm_source=x, https://example-other.com/p/1\nhttps://example-third.org/a\n';
  await page.setInputFiles('#hidLoad', { name: 'stolen.txt', mimeType: 'text/plain', buffer: Buffer.from(file) });
  await page.waitForTimeout(800);
  const n = await page.evaluate(async () => (await RS_STOLEN.load()).items.length);
  ok(n === 3, 'Add from a file on Stolen before links adds 3 links (two on one line)');
  ok(/stolen\.txt/.test(await page.textContent('main')), 'The file shows under Files you added, with Undo');
  const hid = await page.evaluate(async () => (await RS_LISTS.load()).hidden.length);
  ok(hid === 0 || !(await page.evaluate(async () => RS_LISTS.hidden.some(h => /example-third/.test(h)))), 'Nothing went into Hidden sites');
  // 2. Copies found: the tag, repeat offender, the filter.
  const r = await page.evaluate(async ([a, b]) => {
    FCD = null; await loadFC();
    const ca = FCD.copies.find(c => c.id === a), cb = FCD.copies.find(c => c.id === b);
    return { aKnown: ca.known, aStatus: ca.status, bKnown: cb.known, bRepeat: cb.repeat, tag: sigIcons(ca).includes('Stolen before') };
  }, [pick.a, pick.b]);
  ok(r.aKnown && r.tag, 'The copy on a listed page (www. and utm_ added) gets the red Stolen before tag');
  ok(r.aStatus === 'new', 'Its answer is not changed by itself');
  ok(!r.bKnown && r.bRepeat > 0, 'Another page on the same site counts as a repeat offender');
  await page.goto(url('app.html#found')); await page.waitForTimeout(1500);
  const qf = await page.$('[data-act="qtoggle"][data-v="known"]');
  ok(!!qf, 'Quick filter "Stolen before" shows');
  if (qf) {
    await qf.click(); await page.waitForTimeout(600);
    const shown = await page.evaluate(() => { const ids = LIST.map(x => (typeof x === 'string' ? x : x.id)); return { n: ids.length, all: ids.every(id => (FCD.copies.find(c => c.id === id) || {}).known) }; });
    ok(shown.n >= 1 && shown.all, 'The filter shows only copies on the stolen before list');
  }
  // 3. Undo the import.
  await page.goto(url('app.html#hidden')); await page.waitForTimeout(800);
  await page.click('[data-act="hidtab"][data-v="stolen"]'); await page.waitForTimeout(500);
  await page.click('[data-act="impundo"]'); await page.waitForTimeout(800);
  ok((await page.evaluate(async () => (await RS_STOLEN.load()).items.length)) === 0, 'Undo this import empties the list again');
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e); process.exit(1); });
