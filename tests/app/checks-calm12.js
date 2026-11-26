// The calm look, step 12: Clients and photos, with Registrations inside it. The client list
// (tiles, command bar, one line per client, picked bar), the Registrations panel (three tabs,
// a number per folder, Copy for the registrar, opened from a copy), one client's page (controls,
// tiles, folders with their number lights, Registrations card, filters, photo cards, photo panel).
process.env.NP = process.env.NP || '2000'; process.env.NC = process.env.NC || '30';   // before seed.js is read
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
  // Photos with copies; one folder with only an application number.
  const S = await page.evaluate(async () => {
    await chrome.storage.local.set({ ppTheme: 'light' });
    const cs = (await FC.DB.all('copies')).filter(c => c.status !== 'removed').slice(0, 60), ps = new Map();
    for (const c of cs) { const p = ps.get(c.photo) || await FC.DB.get('photos', c.photo); if (p) { p.copies = (p.copies || 0) + 1; ps.set(p.id, p); } }
    const arr = [...ps.values()]; arr[3].stopped = new Date().toISOString(); arr[5].doubleOf = arr[4].id;
    await FC.DB.putMany('photos', arr);
    const fs = [...new Set(arr.map(p => p.folder))];
    await FC.setReg(fs[1], '1-12345678901');
    await FC.meta.set('scan', { at: new Date(Date.now() - 42 * 60000).toISOString(), added: 38 });
    return { client: arr[0].client, photo: arr[0].id, folder0: fs[0], appFolder: fs[1], nClients: (await FC.DB.all('clients')).length };
  });
  const T = async sel => ((await page.locator(sel).first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  const wait = ms => page.waitForTimeout(ms);

  // ---------- every client
  await page.goto(url('app.html#clients')); await page.waitForSelector('#clientList .clr2', { timeout: 60000 }); await wait(800);
  ok(/Clients\s*›\s*Clients and photos/.test(await T('.head h1')), 'title reads Clients › Clients and photos');
  const menu = await page.$$eval('.side a', a => a.map(x => x.textContent.trim()));
  ok(menu.includes('Skipped photos') && !menu.includes('Registrations'), 'the menu has Clients and photos and Skipped photos, no Registrations of its own');
  const tiles = await page.$$eval('#clientTiles .kt2', t => t.map(x => x.querySelector('.l').textContent));
  ok(tiles.join('|') === 'Clients searched|Photos|Searched once|Need a registration|Skipped photos', 'five tiles: ' + tiles.join(' | '));
  ok(/\d+ of \d+/.test(await T('#clientTiles .kt2')) && /38 new · looked 4\d min ago/.test(await T('#clientTiles')), 'the tiles say how many clients are searched and when PageProof last looked for photos');
  const cols = await page.$$eval('#clientList .clh2 span', x => x.map(e => e.textContent.trim()).filter(Boolean));
  ok(cols.join('|') === 'Client|Photos|Searched once|Done by|Copies|New|Registration|Searching', 'list columns: ' + cols.join('|'));
  const order = await page.$$eval('#clientList .clr2', r => r.map(x => x.classList.contains('off')));
  ok(order.length === S.nClients && order.indexOf(true) > 0 && !order.slice(order.indexOf(true)).includes(false), 'one line per client, clients switched off are grey at the bottom');
  ok(await page.locator('#clientList .rgchip.none').count() > 0 && await page.locator('#clientList .rgchip.app').count() === 1, 'the Registration column says who needs a number and who has only applied');
  ok(/Last looked for new photos/.test(await T('#clientFoot')), 'the last-looked line sits under the list');
  // the tabs, find and sort
  await page.click('#clientCmd [data-v="Not searching"]'); await wait(700);
  ok(await page.$$eval('#clientList .clr2', r => r.length > 0 && r.every(x => x.classList.contains('off'))), 'Not searching shows only clients that are switched off');
  await page.click('#clientCmd [data-v="All"]'); await wait(600);
  await page.fill('#cQ', S.client.toLowerCase()); await wait(900);
  ok(await page.locator('#clientList .clr2').count() === 1 && await page.evaluate(() => document.activeElement.id === 'cQ'), 'Find a client narrows the list and keeps the cursor in the box');
  await page.fill('#cQ', ''); await wait(900);
  // the ⋯ menu holds Change folder
  await page.click('#clientCmd [data-act="cmenu"]'); await wait(500);
  ok(/Change folder/.test(await T('#clientMenu')), 'Change folder moved into the ⋯ menu');
  await page.keyboard.press('Escape'); await wait(500);
  ok(!(await page.$('#clientMenu')), 'Escape closes the menu');
  // switch, priority, picked bar
  const first = await page.evaluate(() => document.querySelector('#clientList .clr2').dataset.name);
  await page.click('#clientList .clr2 .clsw .switch'); await wait(1200);
  ok(await page.evaluate(async n => (await FC.DB.get('clients', n)).searching === false && location.hash === '#clients', first), 'the switch stops searching a client without opening it');
  await page.evaluate(() => undoLast()); await wait(1000);
  await page.click('#clientList .clr2 input[data-act="cpick"]'); await page.click('#clientList .clr2:nth-of-type(3) input[data-act="cpick"]'); await wait(600);
  const bulk = await page.$$eval('#clientBulk .clcb', b => b.map(x => x.textContent.trim()));
  ok(/^2 picked/.test(await T('#clientBulk')) && bulk.join('|') === 'Start searching|Stop searching|Make priority|Make normal|Clear', 'ticking clients shows the floating bar: ' + bulk.join(' | '));
  await page.click('#clientBulk [data-v="clear"]'); await wait(600);
  ok(!(await page.$('#clientBulk')), 'Clear puts the bar away');

  // ---------- Registrations panel
  await page.click('#regBtn'); await page.waitForSelector('#regPanel'); await wait(500);
  ok(/reg=none/.test(page.url()) && await page.locator('#regBtn[aria-pressed="true"]').count() === 1, 'the Registrations button opens the panel (the address says so)');
  const rt = await page.$$eval('#regPanel .rgtabs button', b => b.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  ok(rt.length === 3 && /^Not registered \d+$/.test(rt[0]) && rt[1] === 'Applied, no VA yet 1' && /^Registered lately 0$/.test(rt[2]), 'three tabs with counts: ' + rt.join(' | '));
  ok(await page.locator('#regPanel .rgf .rgin input').count() > 0 && await page.locator('#regPanel .rgp-row .rgth').count() > 0 && /cop(y|ies)/.test(await T('#regPanel .rgp-row')), 'each folder has one number box, its photos show a picture and their copies');
  ok(/How numbers are found/.test(await T('#regHow')), 'How numbers are found sits at the bottom');
  await page.click('#regPanel [data-act="regcopy"]'); await wait(600);
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  ok(/^Client\tPhoto\tFolder\tCopies found\tStolen\tApplication number\n/.test(clip) && clip.split('\n').length > 2, 'Copy for the registrar copies the list (' + (clip.split('\n').length - 1) + ' photos)');
  await page.click('#regPanel .rgtabs [data-v="app"]'); await wait(900);
  ok(/reg=app/.test(page.url()) && /Applied\s*1-12345678901/.test(await T('#regPanel .rgf')) && await page.locator('#regPanel .rgf').count() === 1, 'Applied shows the 1-… number once per folder');
  await page.fill('#regPanel .rgf .rgin input', 'not a number'); await page.click('#regPanel .rgf [data-act="regsave"]'); await wait(900);
  ok(await page.locator('#regPanel .rgf').count() === 1, 'a wrong number is not saved');
  await page.fill('#regPanel .rgf .rgin input', 'VA 2-500-001'); await page.press('#regPanel .rgf .rgin input', 'Enter'); await wait(1500);
  const rt2 = await page.$$eval('#regPanel .rgtabs button', b => b.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  ok(rt2[1] === 'Applied, no VA yet 0' && rt2[2] === 'Registered lately 1' && !!(await page.$('#regEmpty')), 'typing the VA number and Enter moves the folder to Registered lately: ' + rt2.join(' | '));
  await page.click('#regPanel .rgtabs [data-v="done"]'); await wait(900);
  ok(/VA\s?2-500-001/.test(await T('#regPanel .rgf .rgst.ok')) && /Typed in by you · today/.test(await T('#regPanel .rgfrom')), 'Registered lately says the number, where it came from and when');
  await page.click('#regPanel [data-act="regclose"]'); await wait(700);
  ok(!(await page.$('#regPanel')) && page.url().endsWith('#clients'), '✕ closes the panel');
  // opened from a copy's Claim tab: that folder is lit and first
  await page.goto(url('app.html#clients?reg=none&folder=' + encodeURIComponent(S.folder0))); await page.waitForSelector('#regPanel .rgf', { timeout: 60000 }); await wait(600);
  ok(await page.evaluate(f => { const a = document.querySelector('#regPanel .rgf'); return a.classList.contains('hl') && a.dataset.folder === f && /Opened from a copy/.test(a.textContent); }, S.folder0), 'opened from a copy, that photo\'s folder is first and lit');
  // the old address still works
  await page.goto(url('app.html#regs')); await page.waitForSelector('#regPanel', { timeout: 60000 });
  ok(/#clients\?reg=none/.test(page.url()), 'the old #regs address opens the panel inside Clients and photos');
  // a chip in the list opens the panel for that client
  await page.click('#clientList .rgchip.none'); await wait(1000);
  ok(await page.evaluate(() => new Set([...document.querySelectorAll('#regPanel .rgch b')].map(b => b.textContent)).size === 1 && !!document.querySelector('#regPanel select[data-act="regclient"]').value), 'a "need a number" chip opens the panel for that client only');
  await page.keyboard.press('Escape'); await wait(700);
  ok(!(await page.$('#regPanel')), 'Escape closes the panel');

  // ---------- one client's page
  await page.evaluate(n => { const r = [...document.querySelectorAll('#clientList .clr2')].find(x => x.dataset.name === n); r.querySelector('.r.num').click(); }, S.client);
  await page.waitForSelector('#photoTree', { timeout: 60000 }); await wait(900);
  ok(await page.evaluate(n => location.hash.startsWith('#photos') && state.phClient === n, S.client) && /Clients and photos ›/.test(await T('.clph')) && !!(await page.$('.clhead select[data-act="phclient"]')) && !!(await page.$('.clph .clback')), 'clicking a line opens that client: back arrow, breadcrumb, the client pick');
  const ctl = await T('#photoCtl');
  ok(/Searching/.test(ctl) && /Priority client/.test(ctl) && /See its copies/.test(ctl) && /Look for new photos/.test(ctl) && /What ⚑ and ★ mean/.test(ctl), 'the controls: Searching switch, Priority client, See its copies, Look for new photos, What ⚑ and ★ mean');
  await page.click('#photoCtl [data-act="phhelp"]'); await wait(500);
  ok(/High priority: searched next, then every 3 days/.test(await T('#photoHelp')), 'What ⚑ and ★ mean opens a short note');
  await page.click('#photoHelp .kx'); await wait(400);
  const pt = await page.$$eval('#photoTiles .kt2 .l', t => t.map(x => x.textContent));
  ok(pt.join('|') === 'Photos|Searched once|Copies found|Need a registration', 'four tiles: ' + pt.join(' | '));
  ok(await page.locator('#photoTree .ctr.q .rgc').count() > 0 && await page.locator('#photoTree .ctr.on').count() === 1, 'folders: years and quarters, each quarter with its number light');
  ok(await page.locator('#photoRegs .rgcf').count() > 0 && await page.locator('#photoRegs .rgin input').count() > 0 && /All registrations/.test(await T('#photoRegs')), 'the Registrations card lists this client\'s folders with copies and a number box');
  const seg = await page.$$eval('#photoCmd .wseg button', b => b.map(x => x.textContent.replace(/\s*[\d,]+$/, '').trim()));
  ok(seg.join('|') === 'All|High priority|Popular|Has copies|Not searched yet|Not searched any more|Doubles', 'photo filters: ' + seg.join(' | '));
  ok(await page.locator('.clgrp .clgh').count() > 0 && /\d{4} · Q\d/.test(await T('.clgrp .clgh')) && await page.locator('.clgh .rgc').count() > 0, 'photos are grouped under folder headings with the folder\'s number');
  const cards = await page.evaluate(() => ({ n: document.querySelectorAll('.pcard').length, lit: [...document.querySelectorAll('.pcard .flagbtn')].filter(b => getComputedStyle(b).opacity === '1').length, on: document.querySelectorAll('.pcard .flagbtn.on').length, chips: document.querySelectorAll('.pcard .clpm .rgc').length }));
  ok(cards.n > 0 && cards.n <= 50 && cards.lit === cards.on && cards.chips === cards.n, `quiet photo cards: ${cards.n} shown, flags lit only when set (${cards.on}), each with its registration`);
  await page.click('#photoCmd [data-v="copies"]'); await wait(800);
  const hc = await page.evaluate(() => ({ n: document.querySelectorAll('.pcard').length, all: [...document.querySelectorAll('.pcard')].every(c => c.querySelector('.clcp')), showing: (document.querySelector('.clshowing') || {}).textContent || '' }));
  ok(hc.n > 0 && hc.all && /Showing \d+ of/.test(hc.showing), 'Has copies shows only photos with copies: ' + hc.showing.replace(/\s+/g, ' ').trim());
  // the photo panel
  await page.click('.pcard .clopen'); await page.waitForSelector('#photoPanel'); await wait(600);
  const pp = await page.evaluate(() => ({ facts: [...document.querySelectorAll('#photoFacts > span')].map(x => x.textContent), copies: document.querySelectorAll('#photoCopies .clcpr').length, foot: [...document.querySelectorAll('#photoPanel .cpfoot button')].map(b => b.textContent.trim()), sel: document.querySelectorAll('.pcard.sel').length, flags: [...document.querySelectorAll('#photoPanel .clfl2 .clcb')].map(b => b.textContent.trim()) }));
  ok(['Registration', 'Folder', 'Searched', 'Next search'].every(f => pp.facts.includes(f)) && pp.copies > 0 && pp.sel === 1, 'the photo panel: facts (' + pp.facts.join(', ') + ') and its copies');
  ok(pp.flags.join('|') === 'High priority|Popular|Search now' && pp.foot.join('|') === 'Copy where the file is|Stop searching this photo', 'panel buttons: ' + pp.flags.concat(pp.foot).join(' | '));
  const was = await page.evaluate(() => !!document.querySelector('#photoPanel .clfl2 .clcb.on.hi'));
  await page.click('#photoPanel .clfl2 [data-v$="|hi"]'); await wait(1200);
  ok(await page.evaluate(w => !!document.querySelector('#photoPanel .clfl2 .clcb.on.hi') === !w && !!document.querySelector('.pcard.sel .flagbtn.on.hi') === !w, was), 'High priority in the panel switches the flag, and the card shows it straight away');
  await page.evaluate(() => undoLast()); await wait(900);
  await page.click('#photoPanel [data-act="phpath"]'); await wait(500);
  ok(/Registered images\/.+\.jpg$/.test(await page.evaluate(() => navigator.clipboard.readText().catch(() => ''))), 'Copy where the file is copies the Drive path');
  await page.keyboard.press('Escape'); await wait(700);
  ok(!(await page.$('#photoPanel')), 'Escape closes the photo panel');
  await page.click('#photoCmd [data-v="all"]'); await wait(700);
  // picked photos bar, size, sort
  await page.locator('.pcard [data-act="phpick"]').first().check({ force: true }); await wait(600);
  const pb = await page.$$eval('#photoBulk .clcb', b => b.map(x => x.textContent.trim()));
  ok(pb.join('|') === 'Search now|High priority|Popular|No flag|Stop searching|Search again|Clear', 'ticking a photo shows the floating bar: ' + pb.join(' | '));
  await page.click('#photoBulk [data-act="phclear"]'); await wait(500);
  await page.selectOption('#photoCmd select[data-act="phsize"]', 's'); await wait(700);
  ok(!!(await page.$('.clgrid.sz-s')), 'the size pick makes the pictures smaller');
  await page.selectOption('#photoCmd select[data-act="phsize"]', 'l'); await wait(500);
  // a year folder, then a quarter
  await page.click('#photoTree .ctr.q'); await wait(800);
  ok(await page.locator('.clgrp').count() === 1 && await page.locator('#photoTree .ctr.q.on').count() === 1 && /✕/.test(await T('.clshowing')), 'clicking a quarter shows only that folder');

  // ---------- 1000 px and dark
  await page.setViewportSize({ width: 1000, height: 900 }); await wait(700);
  const nar = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await page.goto(url('app.html#clients')); await page.waitForSelector('#clientList .clr2', { timeout: 60000 }); await wait(700);
  const nar2 = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(nar <= 0 && nar2 <= 0, `at 1000 px wide neither page scrolls sideways (${nar}, ${nar2})`);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'dark' })); await page.goto(url('app.html#clients?reg=none')); await page.waitForSelector('#regPanel .rgf', { timeout: 60000 });
  await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
  const d = await page.evaluate(() => ({ card: getComputedStyle(document.querySelector('#clientList')).backgroundColor, panel: getComputedStyle(document.querySelector('#regPanel')).backgroundColor, ink: getComputedStyle(document.querySelector('#clientList .clr2 .cname b')).color }));
  ok(d.card === 'rgb(43, 43, 43)' && d.panel === 'rgb(43, 43, 43)' && +d.ink.match(/\d+/)[0] > 220, `Dark: grey cards and panel, light words (${d.card}, ${d.ink})`);
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
