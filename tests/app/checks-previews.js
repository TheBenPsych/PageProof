const { start } = require('./h.js');
process.env.NP = process.env.NP || 3000; process.env.NC = process.env.NC || 400;
const { seed } = require('./seed.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error' && !/TUNNEL|ERR_NAME|net::/.test(m.text())) console.log('ERR', m.text().slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  await page.evaluate(() => FC.meta.set('picsMoved', null));
  await seed(page);
  const r = await page.evaluate(async () => {
    await FC.DB.del('meta', 'picsMoved');
    const t0 = performance.now(); const moved = await FC.movePics(); const ms = Math.round(performance.now() - t0);
    const cs = await FC.DB.all('copies'), ps = (await FC.DB.all('photos'));
    return { moved, ms, inline: cs.filter(c => c.thumb && c.thumb.startsWith('data:')).length + ps.filter(c => c.thumb).length, th: cs.filter(c => c.th).length, pth: ps.filter(p => p.th).length, pics: await FC.pics.count(), one: (await FC.thumbOf(cs[0])).slice(0, 22) };
  });
  console.log(JSON.stringify(r));
  ok(r.inline === 0 && r.pics === r.th + r.pth && r.one.startsWith('data:image/jpeg'), 'previews moved to their own store');
  await page.goto(url('app.html#found')); await page.waitForTimeout(1500);
  const f = await page.evaluate(() => ({ rows: document.querySelectorAll('.frow').length, real: [...document.querySelectorAll('.frow img.thumb')].filter(i => i.src.startsWith('data:image/jpeg')).length, left: document.querySelectorAll('img[data-th]').length }));
  console.log(JSON.stringify(f)); ok(f.rows > 0 && f.real === f.rows && f.left === 0, 'All copies found shows every preview');
  await page.click('.frow .l1'); await page.waitForTimeout(700);
  const d = await page.evaluate(() => [...document.querySelectorAll('#drawer .pair img')].map(i => i.src.slice(0, 15)));
  console.log(d); ok(d.every(s => s.startsWith('data:image/jpe') || s.startsWith('blob:')), 'details panel shows both pictures');
  await page.goto(url('app.html#review')); await page.waitForTimeout(1200);
  const rv = await page.evaluate(() => [...document.querySelectorAll('.pair img, .swipe img')].map(i => i.src.slice(0, 15)));
  console.log(rv); ok(rv.length && rv.every(s => s.startsWith('data:image/jpe') || s.startsWith('blob:')), 'Review shows both pictures');
  await page.goto(url('app.html#photos')); await page.waitForTimeout(1200);
  const ph = await page.evaluate(() => ({ n: document.querySelectorAll('.pcard img').length, real: [...document.querySelectorAll('.pcard img')].filter(i => i.src.startsWith('data:image/jpeg')).length }));
  console.log(JSON.stringify(ph)); ok(ph.real > 0, 'Photos page shows stored previews');
  // ingest new copy with data thumb
  const ing = await page.evaluate(async () => {
    const p = (await FC.DB.all('photos')).find(p => p.hash);
    const th = await FC.pics.get((await FC.DB.all('copies'))[0].id);
    await FC.ingest({ fcId: p.id, name: p.name, hash: p.hash, w: 10, h: 10, thumb: th }, [{ url: 'https://newsite.example/a', key: 'newsite.example/a', site: 'newsite.example', thumb: th, img: '', engines: ['google'], verdict: 'same', pct: 90 }], 'a search');
    const c = await FC.DB.get('copies', p.id + '|newsite.example/a');
    return { thumb: c.thumb, th: c.th, pic: (await FC.thumbOf(c)).length };
  });
  console.log(JSON.stringify(ing)); ok(ing.thumb === '' && ing.th === 1 && ing.pic > 1000, 'a new find keeps its preview in the separate store');
  await ctx.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
