// The calm look, step 1 (the shared look): the Lexend font, the Windows 11 colours in light and
// dark, Windows buttons and tick boxes, coloured menu icons with a cogwheel for Settings, the
// "Copies found › Keep searching" page title and the three status tiles at the top right.
const fs = require('fs'), path = require('path');
const { start } = require('./h.js'); const { seed } = require('./seed.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const ext = path.resolve(__dirname, '../../extension');
  // Every page with its own look loads the shared look last.
  for (const f of ['app.html', 'popup.html', 'runner.html', 'compare.html', 'convert.html', 'inspect.html', 'markup.html', 'revsearch.html', 'verify.html']) {
    const links = [...fs.readFileSync(path.join(ext, f), 'utf8').matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m => m[1]);
    const own = links.filter(l => l !== 'ui/calm.css');   // the page layouts of the calm look (app.html) build on the shared look
    ok(own[own.length - 1] === 'ui/win11.css' && links.indexOf('ui/calm.css') !== 0, f + ' loads the shared calm look last');
  }
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(1200);
  await seed(page);
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'light' }));
  await page.goto(url('app.html#hidden')); await page.waitForTimeout(2500);
  const css = v => page.evaluate(n => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), v);
  const r = await page.evaluate(async () => {
    await document.fonts.load('15px Lexend'); await document.fonts.ready;
    const cs = (sel, p) => { const e = document.querySelector(sel); return e ? getComputedStyle(e)[p] : ''; };
    return {
      font: document.fonts.check('15px Lexend'), bodyFont: getComputedStyle(document.body).fontFamily, h1Font: cs('.head h1', 'fontFamily'), btnFont: cs('.btn', 'fontFamily'),
      h1: (document.querySelector('.head h1') || {}).textContent || '', bc: !!document.querySelector('.head h1 .bc'),
      eyebrow: cs('.head .eyebrow', 'display'),
      navRadius: cs('.nav', 'borderTopLeftRadius'), btnRadius: cs('.btn', 'borderTopLeftRadius'), cardRadius: cs('.card', 'borderTopLeftRadius'),
      cog: /19\.4 15a1\.65/.test((document.querySelector('.side a.nav[href="#settings"] svg') || {}).innerHTML || ''),
      icons: ['home', 'found', 'clients', 'library', 'tools', 'settings'].map(h => cs(`.side a.nav[href="#${h}"] svg`, 'color')),
      sideBg: cs('.side', 'backgroundColor'),
    };
  });
  ok(r.font && /^Lexend/.test(r.bodyFont) && /^Lexend/.test(r.h1Font) && /^Lexend/.test(r.btnFont), 'Lexend is loaded and used for text, titles and buttons');
  ok(await css('--bg') === '#F3F3F3' && await css('--surface') === '#FBFBFB' && await css('--accent') === '#005FB8' && await css('--ink') === '#1B1B1B', 'Light uses the Windows 11 colours');
  ok(r.bc && /Settings\s*›\s*Hidden and approved sites/.test(r.h1.replace(/\s+/g, ' ')) && r.eyebrow === 'none', 'The page title reads "Settings › Hidden and approved sites" on one line: ' + r.h1.replace(/\s+/g, ' ').slice(0, 60));
  ok(r.navRadius === '4px' && r.btnRadius === '4px' && r.cardRadius === '8px', `Controls have 4 px corners and cards 8 px (${r.navRadius}, ${r.btnRadius}, ${r.cardRadius})`);
  ok(r.cog, 'Settings has the cogwheel icon');
  ok(new Set(r.icons).size === 6, 'Each menu item has its own icon colour');
  ok(r.sideBg === 'rgba(0, 0, 0, 0)', 'The menu has no panel behind it');
  // Status tiles: top right beside the title, name + one line each.
  await page.waitForTimeout(1500);
  const t = await page.evaluate(() => { const e = document.getElementById('statusLine'); return { inHead: !!e.closest('.head .headact'), first: e.parentNode.firstElementChild === e, n: e.querySelectorAll('.stile').length, names: [...e.querySelectorAll('.stile .stx > b')].map(b => b.textContent), signs: e.querySelectorAll('.stile .sico').length }; });
  ok(t.inHead && t.first && t.n === 3 && t.signs === 3, `Three status tiles sit at the top right beside the title (${t.n})`);
  ok(t.names.join('|') === 'Google Drive|Keep searching|Search sites', 'The tiles are Google Drive, Keep searching and Search sites: ' + t.names.join(', '));
  // A page with no title line (a tool page) shows them in the top bar instead.
  await page.goto(url('app.html#inspect')); await page.waitForTimeout(2000);
  ok(await page.evaluate(() => !!document.querySelector('.top .topr #statusLine .stile')), 'On a page without a title line the tiles move to the top bar');
  await page.goto(url('app.html#home')); await page.waitForTimeout(2500);
  ok(await page.evaluate(() => !!document.querySelector('.head #statusLine .stile') && !document.querySelector('.head h1 .bc')), 'Back on Home the tiles are beside the title again, and Home has no "›" in its title');
  // Tick boxes are Windows ones.
  await page.goto(url('app.html#found')); await page.waitForSelector('input.cpick', { timeout: 20000 });
  const cb = await page.evaluate(() => { const c = document.querySelector('input.cpick'); const s = getComputedStyle(c); return { w: s.width, r: s.borderTopLeftRadius, a: s.appearance || s.webkitAppearance, o: s.opacity }; });
  ok(cb.w === '20px' && cb.r === '4px' && cb.a === 'none' && cb.o === '1', `Tick boxes are 20 px Windows boxes (${cb.w}, ${cb.r})`);
  // Dark.
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'dark' })); await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark', null, { timeout: 10000 }); await page.waitForTimeout(300);
  ok(await css('--bg') === '#202020' && await css('--surface') === '#2B2B2B' && await css('--accent') === '#60CDFF' && await css('--accent-ink') === '#000000', 'Dark uses the Windows 11 dark colours (grey, not black)');
  await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));   // colour fades finish first
  const d = await page.evaluate(() => { const b = document.querySelector('.btn.primary, #capBtn'); const s = getComputedStyle(b); return { bg: s.backgroundColor, ink: s.color }; });
  ok(d.bg === 'rgb(96, 205, 255)' && d.ink === 'rgb(0, 0, 0)', `Dark: blue buttons have black words (${d.bg}, ${d.ink})`);
  // The tool pages (their own files) follow the same colours.
  const tool = await ctx.newPage();
  await tool.goto(url('inspect.html')); await tool.waitForFunction(() => document.documentElement.dataset.theme === 'dark', null, { timeout: 10000 }); await tool.waitForTimeout(300);
  const tv = await tool.evaluate(() => { const g = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim(); const probe = document.createElement('i'); probe.style.color = 'var(--t-surface)'; document.body.append(probe); const c = getComputedStyle(probe).color; probe.remove(); return { surf: c, font: getComputedStyle(document.body).fontFamily, bg: g('--bg') }; });
  ok(tv.surf === 'rgb(43, 43, 43)' && /^Lexend/.test(tv.font) && tv.bg === '#202020', 'Tool pages use the same colours and font: ' + tv.surf);
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'light' }));
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e); process.exit(1); });
