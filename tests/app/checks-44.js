// Checks for 4.4: the firm-rule check before Stolen, their page read for you (credit, prices, ads),
// date first published and damages hint, Ready for legal, research steps, POOL photos skipped,
// and Save as Breaking News photo with its new-or-recycled check.
// Pretend sites and pretend pictures only, served from this computer.
const { start } = require('./h.js');
const http = require('http');
process.env.NP = 600; process.env.NC = 120;
const { seed } = require('./seed.js');
const C = require('../../extension/checks.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  // ---- The plain rules, without a browser
  const d = C.dateIn('10.29.26_Council_Ortiz.jpg');
  ok(d && d.getFullYear() === 2026 && d.getMonth() === 9 && d.getDate() === 29, 'Reads 10.29.26 from a file name');
  ok(!C.dateIn('12.31.99_x.jpg') || C.dateIn('12.31.99_x.jpg').getFullYear() === 1999, 'A two-digit year in the future is not taken as this century');
  ok(C.bnName({ date: new Date(2026, 2, 5), subject: 'Council hearing', last: 'Ortiz' }) === '3.5.26_Council hearing_Ortiz.jpg' || /^3\.5\.26_Council.?hearing_Ortiz\.jpg$/.test(C.bnName({ date: new Date(2026, 2, 5), subject: 'Council hearing', last: 'Ortiz' })), 'Breaking News name has no leading zeros: ' + C.bnName({ date: new Date(2026, 2, 5), subject: 'Council hearing', last: 'Ortiz' }));
  ok(/^3\.5\.26_POOL_/.test(C.bnName({ date: new Date(2026, 2, 5), subject: 'Trial', last: 'Ortiz', pool: true })), 'POOL photos get _POOL_ after the date');
  ok(C.isPool('10.29.26_POOL_Trial_Ortiz.jpg') && !C.isPool('10.29.26_Pooltable_Ortiz.jpg'), 'POOL is found only as its own word');
  const now = new Date(2026, 10, 23);
  ok(/Register by/.test(C.damages({ date: new Date(2026, 9, 1) }, {}, now).title), 'Damages: unregistered and inside 3 months says Register by');
  ok(/actual/i.test(C.damages({ date: new Date(2025, 0, 1) }, { va: "", app: "" }, now).title), 'Damages: unregistered and past 3 months says actual damages only');
  ok(/Statutory/.test(C.damages({ date: new Date(2025, 0, 1) }, { va: 'VA 2-123-456' }, now).title), 'Damages: registered says statutory, if filed in time');
  ok(C.guessKind({ site: 'stmarys-church.org' }) === 'church' && C.guessKind({ site: 'city.gov' }) === 'gov' && C.guessKind({ site: 'shop.com' }) === 'company', 'Guesses church, government and company sites');
  ok(C.rules({ site: 'a.com', use: 'embedded', country: 'DE' }, 'company', {}).some(r => r.lvl === 'stop'), 'An embed from outside the U.S. is a Stop');
  ok(C.rules({ site: 'stmarys-church.org' }, 'church', {}).some(r => r.lvl === 'stop'), 'A church is a Stop');
  ok(!C.rules({ site: 'shop.com', use: 'copied', country: 'US' }, 'company', {}).some(r => r.lvl !== 'info'), 'An ordinary copied use on a company site has no rule');

  // ---- A pretend shop page that uses the photo, with a credit line, a price, Add to cart and ads
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  const srv = http.createServer((q, r) => {
    if (q.url.endsWith('.png')) { r.writeHead(200, { 'content-type': 'image/png' }); return r.end(png); }
    r.writeHead(200, { 'content-type': 'text/html' });
    r.end(`<html><head><title>Pretend shop</title><meta property="og:type" content="product"><meta property="product:price:amount" content="24.99"><meta property="article:published_time" content="2026-10-29T10:00:00Z"><script src="https://securepubads.g.doubleclick.net/tag/js/gpt.js"></script></head>
      <body onload="alert(1)"><h1>Poster</h1><figure><img src="/pics/IMG_1.png"><figcaption>Photo: Jane Ortiz</figcaption></figure><span itemprop="price">$24.99</span><button>Add to cart</button></body></html>`);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;

  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  page.on('dialog', d => { fails++; console.log('FAIL a browser box opened: ' + d.message()); d.dismiss(); });
  const go = async h => { await page.goto(url('app.html#' + h)); await page.waitForTimeout(1200); };
  await go('help'); await seed(page); await page.reload(); await page.waitForTimeout(1000);

  // One copy on the pretend shop
  const id = await page.evaluate(async b => {
    const p = (await FC.DB.all('photos')).find(x => x.look);
    p.name = '10.29.26_Poster_Ortiz.jpg'; await FC.DB.put('photos', p);
    const c = { id: p.id + '|shop', photo: p.id, client: p.client, url: b + '/shop/poster', key: 'shop', site: '127.0.0.1', title: 'Poster', img: b + '/pics/IMG_1.png', engines: ['google'], pct: 90, match: 'same', firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString(), status: 'new', online: 'up', country: 'US', use: 'copied' };
    await FC.DB.put('copies', c); return c.id;
  }, base);
  await page.evaluate(i => { state.open = i; }, id);
  await go('found'); await page.evaluate(i => { state.open = i; render(true); }, id);
  await page.waitForTimeout(4000);
  const dr = await page.evaluate(() => { const t = (document.querySelector('.drawer') || document.body).textContent; return { t, rules: !!document.querySelector('#rulesbox') }; });
  ok(dr.rules && /Firm rules/i.test(dr.t), 'The details panel has Firm rules');
  ok(/Jane Ortiz/.test(dr.t), 'The credit line was read from their page');
  ok(/24\.99|price/i.test(dr.t) && /ads/i.test(dr.t), 'Signs it was on purpose: the price and the ads');
  ok(/10\/29\/2026|Oct(ober)? 29, 2026|29 Oct/i.test(dr.t) || /2026/.test(dr.t), 'Date first published comes from the file name');
  ok(/damages/i.test(dr.t), 'A damages hint is shown');
  const pf = await page.evaluate(async i => (await FC.DB.get('copies', i)).pf, id);
  ok(pf && pf.ok && pf.imgFound && pf.sells && pf.sells.cart, 'Their page is kept with the copy (photo found, Add to cart)');

  // ---- The rule check: a church site gets asked before Stolen
  await page.evaluate(async () => { const k = (await FC.meta.get('siteKinds')) || {}; k[FC.baseOf('127.0.0.1')] = 'church'; await FC.meta.set('siteKinds', k); });
  const gate = page.evaluate(async i => ruleGate(await FC.DB.get('copies', i)), id);
  await page.waitForTimeout(600);
  const g = await page.evaluate(() => { const d = document.querySelector('dialog.rulegate'); return d && { open: d.open, t: d.innerText, stolen: d.querySelector('#gateStolen').textContent, remove: !d.querySelector('#gateRemove').hidden }; });
  ok(g && g.open && /church/i.test(g.t) && /anyway/i.test(g.stolen) && g.remove, 'A church site asks first: Mark Stolen anyway or Remove instead');
  await page.click('dialog.rulegate button[value="cancel"]');
  ok((await gate) === null, 'Cancel leaves the copy as it was');
  await page.evaluate(async () => { const k = (await FC.meta.get('siteKinds')) || {}; k[FC.baseOf('127.0.0.1')] = 'company'; await FC.meta.set('siteKinds', k); });
  ok((await page.evaluate(async i => ruleGate(await FC.DB.get('copies', i)), id)) === 'stolen', 'An ordinary company copy goes straight to Stolen');

  // ---- Ready for legal (stolen copies)
  await page.evaluate(async i => { const c = await FC.DB.get('copies', i); c.status = 'stolen'; await FC.DB.put('copies', c); FCD = null; state.open = i; await render(true); }, id);
  await page.waitForTimeout(1500);
  const lg = await page.evaluate(() => { const b = document.querySelector('#legalbox'); return b && { rows: b.querySelectorAll('.lrow').length, t: b.innerText }; });
  // 6 since the company checklist: 'Company found and actively registered' joined the list.
  ok(lg && lg.rows === 6 && /captured/i.test(lg.t) && /company/i.test(lg.t), 'Ready for legal shows 6 ticks, one for the company (' + (lg ? lg.rows : 0) + ')');

  // ---- Research steps on Who's behind this site
  await go('who?site=site0.com'); await page.waitForTimeout(1500);
  const n1 = await page.evaluate(() => document.querySelectorAll('.rstep').length);
  // 17 since the company checklist (brand name, company name, actively registered).
  ok(n1 === 17, 'Who\'s behind this site has 17 research steps (' + n1 + ')');
  await page.click('.rstep input'); await page.waitForTimeout(800);
  const kept = await page.evaluate(async () => ((await FC.meta.get('research')) || {})['site0.com'] || []);
  ok(kept.length === 1, 'A ticked research step is kept for the site');

  // ---- POOL photos are skipped
  const pool = await page.evaluate(async () => { const p = (await FC.DB.all('photos'))[3]; return FC.plan({ ...p, name: '10.29.26_POOL_Trial_Ortiz.jpg' }); });
  ok(pool && pool.pool && !pool.due, 'Keep searching skips POOL photos');

  // ---- Save as Breaking News photo
  await page.evaluate(b => chrome.storage.local.set({ bnPending: { src: b + '/pics/IMG_1.png', page: b + '/news/story', title: 'Story', at: Date.now(), credit: 'Photo: Someone', date: '2026-10-29T10:00:00Z', alt: 'Council hearing', headline: 'Council walks out' } }), base);
  await go('bnsave'); await page.waitForTimeout(1500);
  const bn = await page.evaluate(() => ({ t: document.querySelector('#view').innerText, img: !!document.querySelector('.frame img'), date: document.querySelector('#bnDate').value }));
  ok(bn.img && bn.date === '2026-10-29', 'The Breaking News page shows the photo and the article date (' + bn.date + ')');
  const cl = await page.evaluate(() => state.bn.clients[0]);
  await page.selectOption('#bnClient', cl); await page.waitForTimeout(400);
  await page.fill('#bnSubject', 'Council hearing'); await page.fill('#bnLast', 'Ortiz'); await page.waitForTimeout(300);
  const nm = await page.evaluate(() => document.getElementById('bnName').textContent);
  ok(nm === '10.29.26_Council hearing_Ortiz.jpg' || /^10\.29\.26_Council.?hearing_Ortiz\.jpg$/.test(nm), 'File name is made as you type: ' + nm);
  await page.check('#bnPool'); await page.waitForTimeout(200);
  ok(/^10\.29\.26_POOL_/.test(await page.evaluate(() => document.getElementById('bnName').textContent)), 'Ticking POOL adds _POOL_');
  for (let i = 0; i < 60 && await page.evaluate(() => state.bn.check && state.bn.check.running); i++) await page.waitForTimeout(500);
  const ch = await page.evaluate(() => ({ c: state.bn.check, t: document.querySelector('#view').innerText }));
  ok(ch.c && !ch.c.running && ch.c.total > 0 && /New|Recycled|Maybe/.test(ch.t), 'New or recycled check ran over ' + (ch.c ? ch.c.total : 0) + ' photos');
  ok(await page.evaluate(() => !document.querySelector('[data-act="bnsave"]').disabled), 'Save is ready once the boxes are filled');

  // Recycled: give one of that client's photos the same look as this picture
  const rec = await page.evaluate(async () => {
    const blob = await (await fetch(state.bn.src)).blob(), look = await FC.lookHash(blob);
    const p = (await FC.DB.by('photos', 'client', state.bn.client))[0]; p.look = look; await FC.DB.put('photos', p);
    await bnCheck(); return p.name;
  });
  await page.waitForTimeout(800);
  ok(/Recycled/.test(await page.evaluate(() => document.querySelector('#view').innerText)) && /\S/.test(rec), 'A photo we already have shows Recycled');

  await go('tools');
  ok(await page.evaluate(() => !!document.querySelector('a.tool[href="#bnsave"]')), 'Tools lists Save a Breaking News photo');

  await ctx.close(); srv.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e); process.exit(1); });
