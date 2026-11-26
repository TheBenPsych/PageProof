// The calm look, step 9: Site owners, now under Copies found. Two tabs (Owners, Look up a site),
// the command bar, the list with columns, the chosen owner (tiles, why, their sites, what their
// sites say, clients they copied), Copy owner details, right initials and kind names.
const { start } = require('./h.js'); const { seed } = require('./seed.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const { ctx, url } = await start();
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(1200);
  await seed(page);
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'light' }));
  const un = await page.evaluate(() => ({ a: owIni('Gannett (USA TODAY Network)'), b: owIni('Harbor Times Media LLC'), c: owIni('site12.com'), k1: owKind({ how: ['Same Google Analytics ID', 'Sub-sites of x.com'], kind: 'Sub-sites of one domain' })[0], k2: owKind({ how: ['One of the big media groups'], kind: 'Media group' })[0], k3: owKind({ how: ['Sub-sites of x.com'] })[0] }));
  ok(un.a === 'G' || un.a === 'GU' ? !/\(/.test(un.a) : false, 'initials come from real words, never "G(": ' + [un.a, un.b, un.c].join(', '));
  ok(un.k1 === 'Same Analytics ID' && un.k2 === 'Media group' && un.k3 === 'Sub-sites', 'what links them is named right: ' + [un.k1, un.k2, un.k3].join(', '));

  await page.goto(url('app.html#owners')); await page.waitForSelector('.own #ownerList .olr', { timeout: 60000 });
  const T = async sel => (await page.locator(sel).first().textContent()).replace(/\s+/g, ' ').trim();
  ok(/Copies found\s*›\s*Site owners/.test(await T('.head h1')), 'title reads Copies found › Site owners');
  const nav = await page.evaluate(() => { const a = [...document.querySelectorAll('.side a, .side button, nav a')].find(x => /^Site owners$/.test(x.textContent.trim())); const w = [...document.querySelectorAll('.side a, .side button, nav a')].find(x => /^Watching$/.test(x.textContent.trim())); return !!a && !!w && a.parentElement === w.parentElement; });
  ok(nav, 'Site owners sits in the menu under Copies found, next to Watching');
  const tabs = await page.$$eval('.utabs button', b => b.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  ok(tabs.length === 2 && /^Owners \d+$/.test(tabs[0]) && tabs[1] === 'Look up a site', 'two tabs: ' + tabs.join(' | '));
  const head = await page.$$eval('#ownerList .olh span', x => x.map(e => e.textContent.trim()).filter(Boolean));
  ok(head.join('|') === 'Owner|Sites|Copies|New|Stolen', 'list columns: ' + head.join('|'));
  ok(await page.locator('#ownerList .olr').count() <= 40 && await page.locator('#ownerList .olr.sel').count() === 1 && await page.locator('#ownerList .olr .okind').count() > 0, 'the list shows at most 40 owners at a time, the first one chosen, each with its kind');
  ok(await page.locator('#ownerHead').count() === 1 && await page.locator('#ownerTiles .otile').count() === 4 && /Copies/.test(await T('#ownerTiles')) && /New to answer/.test(await T('#ownerTiles')), 'the chosen owner has a header and four tiles');
  ok(await page.locator('#ownerWhy .owhy').count() > 0 && /Found/.test(await T('#ownerWhy .owhy')) && await page.locator('#ownerSites .osr .osl').count() > 0, 'why they are one owner (with proof) and their sites with letter badges');
  ok(await page.locator('#ownerSites .osr').count() <= 12 && await page.locator('#ownerClients .ocl').count() > 0 && await page.locator('#ownerHow .chs').count() === 4, 'their sites (12 at a time), clients they copied, How owners are found');
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over <= 0, 'nothing sticks out sideways at 1920: ' + over);

  // choose another owner, filter, sort, find
  const second = await page.locator('#ownerList .olr').nth(1).getAttribute('data-v');
  await page.locator('#ownerList .olr').nth(1).click(); await page.waitForTimeout(600);
  ok(await page.locator('#ownerList .olr.sel').getAttribute('data-v') === second, 'clicking a row opens that owner');
  const segs = await page.$$eval('.ocmd .kseg button', b => b.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  ok(/^All \d+$/.test(segs[0]) && segs.length >= 2, 'kinds to pick from: ' + segs.join(' | '));
  await page.locator('.ocmd .kseg button').nth(1).click(); await page.waitForTimeout(600);
  const want = +segs[1].match(/(\d+)$/)[1];
  ok(await page.locator('#ownerList .olr').count() === Math.min(40, want), `picking a kind shows only those (${want})`);
  await page.locator('.ocmd .kseg button').first().click(); await page.waitForTimeout(500);
  await page.selectOption('[data-act="osort"]', 'name'); await page.waitForTimeout(600);
  const names = await page.$$eval('#ownerList .olr .kn1 b', b => b.map(x => x.textContent));
  ok(names.join() === names.slice().sort((a, b) => a.localeCompare(b)).join(), 'Sort by name works');
  await page.selectOption('[data-act="osort"]', 'copies'); await page.waitForTimeout(500);
  await page.fill('#ownerQ', 'zzzzzz'); await page.waitForTimeout(200);
  ok(await page.locator('#ownerNoMatch').isVisible() && await page.locator('#ownerList .olr:visible').count() === 0, 'Find narrows the list as you type and says when nothing matches');
  await page.fill('#ownerQ', '');

  // copy owner details
  await page.click('[data-act="ocopy"]'); await page.waitForTimeout(500);
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  ok(/Why they are one owner:/.test(clip) && /Their sites:/.test(clip) && /Copies: \d+/.test(clip), 'Copy owner details puts the facts on the clipboard: ' + clip.split('\n').slice(0, 2).join(' / '));

  // tile -> All copies with that owner
  await page.locator('#ownerTiles .otile').first().click(); await page.waitForTimeout(1500);
  ok(await page.evaluate(() => location.hash.startsWith('#found') && !!state.fOwner && state.fFilter === 'All'), 'a tile opens All copies for that owner');

  // Look up a site tab
  await page.goto(url('app.html#owners')); await page.waitForSelector('.own #ownerList .olr', { timeout: 60000 });
  await page.click('.utabs [data-v="who"]'); await page.waitForSelector('#whoForm');
  ok(/#who/.test(await page.evaluate(() => location.hash)) && await page.locator('.utabs button.on').textContent() === 'Look up a site' && await page.locator('#whoIn').count() === 1, 'Look up a site is a tab of Site owners');
  ok(await page.locator('#whoLately .orr').count() > 0 && /Sites read lately/.test(await T('#whoLately')), 'it lists the sites read lately');
  const site = await page.locator('#whoLately .orr .cname b').first().textContent();
  await page.locator('#whoLately .orr [data-act="owho"]').first().click(); await page.waitForTimeout(1500);
  ok((await page.evaluate(() => document.body.innerText)).includes(site) && await page.locator('[data-act="whoclear"]').count() === 1, 'Open shows that site, with Look up another site: ' + site);
  await page.click('[data-act="whoclear"]'); await page.waitForSelector('#whoLately');
  ok(true, 'Look up another site goes back to the form');
  await page.click('.utabs [data-v="owners"]'); await page.waitForSelector('#ownerList .olr', { timeout: 60000 });

  // narrow + dark
  await page.setViewportSize({ width: 1000, height: 900 }); await page.waitForTimeout(400);
  const over2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over2 <= 0, 'fits a 1000 px window: ' + over2);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'dark' })); await page.reload(); await page.waitForSelector('#ownerList .olr', { timeout: 60000 });
  await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
  const d = await page.evaluate(() => ({ card: getComputedStyle(document.querySelector('#ownerList')).backgroundColor, ink: getComputedStyle(document.querySelector('#ownerList .olr .kn1 b')).color }));
  ok(d.card === 'rgb(43, 43, 43)' && +d.ink.match(/\d+/)[0] > 220, `Dark: grey cards and light words (${d.card}, ${d.ink})`);
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
