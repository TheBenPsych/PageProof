// The calm look, step 11: the pop-up. Blue Capture button with the site only, the numbers as a
// list, five tool buttons, Keep searching as one row (switch right, Pause as a link), a bottom
// bar with Open full PageProof and light/dark, slim warning bars, and a height under the
// browser's 600 px limit even with two warnings.
const { start } = require('./h.js'); const { seed } = require('./seed.js');
process.env.NP = process.env.NP || '300'; process.env.NC = process.env.NC || '6';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(1200);
  await seed(page);
  await page.evaluate(async () => { await FC.setKeep({ on: true }); await chrome.storage.local.set({ ppTheme: 'light', fcNeedsAllow: 0 }); });
  await ctx.route('https://www.example-news.com/**', r => r.fulfill({ contentType: 'text/html', body: '<title>An example story</title><h1>News</h1>' }));
  const web = await ctx.newPage(); await web.goto('https://www.example-news.com/story');
  const pop = async (front, pre) => {
    const sp = await ctx.newPage(); await sp.setViewportSize({ width: 340, height: 300 });
    sp.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
    await sp.goto(url('popup.html')); await sp.waitForSelector('#tools'); // the first draw is done
    if (front) { await web.bringToFront(); await sp.waitForTimeout(300); }
    if (pre) await sp.evaluate(pre);
    await sp.evaluate(() => draw()); await sp.waitForTimeout(300);
    return sp;
  };
  const tall = sp => sp.evaluate(() => document.documentElement.scrollHeight);

  let sp = await pop(true);
  const r = await sp.evaluate(() => {
    const cs = getComputedStyle(document.documentElement), cap = document.getElementById('cap');
    return { capBg: getComputedStyle(cap).backgroundColor, cap: cap.textContent.replace(/\s+/g, ' ').trim(), small: cap.querySelector('small').textContent,
      rows: [...document.querySelectorAll('#nums .nrow')].map(x => x.querySelector('.nl1').textContent + '=' + x.dataset.go), icos: [...document.querySelectorAll('#nums .nrow .ico')].map(x => getComputedStyle(x).color),
      tools: [...document.querySelectorAll('#tools .ntool')].map(x => x.querySelector('.tl').textContent + '=' + x.dataset.go + '=' + x.title), toolCols: new Set([...document.querySelectorAll('#tools .ntool .ti')].map(x => getComputedStyle(x).color)).size,
      photos: /Photos on this page/.test(document.body.textContent), tip: !!document.getElementById('tip'),
      sw: (() => { const k = document.querySelector('.krow'), s = k.querySelector('.switch'), t = k.querySelector('.kt'); return s.getBoundingClientRect().left > t.getBoundingClientRect().right - 1; })(),
      pause: (document.getElementById('pause') || {}).className + ':' + (document.getElementById('pause') || {}).textContent,
      foot: (() => { const f = document.querySelector('.nfoot'), o = document.getElementById('openFull'), th = document.getElementById('themeBtn'); return { txt: o.textContent.trim(), themeIn: f.contains(th), icon: !!th.querySelector('svg'), bottom: Math.round(document.documentElement.scrollHeight - f.getBoundingClientRect().bottom), headTheme: !!document.querySelector('.mhead #themeBtn') }; })(),
      font: getComputedStyle(document.body).fontFamily, over: document.documentElement.scrollWidth - innerWidth };
  });
  ok(r.capBg === 'rgb(0, 95, 184)' && /^Capture this page/.test(r.cap) && r.small === 'example-news.com', 'Capture this page is the blue button and names the site only: ' + r.cap);
  ok(r.rows.join('|') === 'New copies=review|To capture=found?filter=Not%20finished|Searched today=keep' && new Set(r.icos).size === 3, 'the numbers are three rows, each with its own coloured icon: ' + r.rows.join(' | '));
  ok(r.tools.map(t => t.split('=')[0]).join('|') === 'Inspect|Compare|Mark up|Convert|Open file' && r.tools[0] === 'Inspect=inspect=Inspect a photo' && r.tools[4] === 'Open file=openfiles=Open odd files' && r.toolCols === 5, 'five tool buttons with full names as tips and five colours');
  ok(!r.photos && !r.tip, '"Photos on this page" and the tip line are gone');
  ok(r.sw && r.pause === 'lk:Pause', 'Keep searching is one row, switch on the right, Pause is a link');
  ok(r.foot.txt === 'Open full PageProof' && r.foot.themeIn && r.foot.icon && !r.foot.headTheme && r.foot.bottom === 0, 'the bottom bar holds Open full PageProof and the light/dark button');
  ok(/Lexend/.test(r.font) && r.over <= 0, 'Lexend font, nothing wider than the pop-up');
  const h1 = await tall(sp);
  ok(h1 <= 520, 'the pop-up is ' + h1 + ' px tall (the browser allows 600)');

  // Buttons work: Pause / Resume, the switch, light/dark, a tool, Open full.
  await sp.click('#pause'); await sp.waitForTimeout(900);
  ok(await sp.evaluate(async () => !!(await chrome.storage.local.get('fcPause')).fcPause && document.getElementById('pause').textContent === 'Resume' && /Paused by you/.test(document.getElementById('klive').textContent)), 'Pause pauses and turns into Resume');
  await sp.click('#pause'); await sp.waitForTimeout(900);
  ok(await sp.evaluate(async () => !(await chrome.storage.local.get('fcPause')).fcPause), 'Resume carries on');
  await sp.click('.krow .switch'); await sp.waitForTimeout(900);
  ok(await sp.evaluate(async () => (await FC.keep()).on === false && !document.getElementById('pause') && /^Off\./.test(document.getElementById('klive').textContent)), 'the switch turns Keep searching off, and Pause goes');
  await sp.click('.krow .switch'); await sp.waitForTimeout(900);
  ok(await sp.evaluate(async () => (await FC.keep()).on === true), 'and on again');
  await sp.click('#themeBtn'); await sp.waitForTimeout(700);
  await sp.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
  const dk = await sp.evaluate(() => ({ th: document.documentElement.dataset.theme, bg: getComputedStyle(document.body).backgroundColor, card: getComputedStyle(document.querySelector('.nrows')).backgroundColor, cap: getComputedStyle(document.getElementById('cap')).backgroundColor, capInk: getComputedStyle(document.getElementById('cap')).color }));
  ok(dk.th === 'dark' && dk.bg === 'rgb(32, 32, 32)' && dk.card === 'rgb(43, 43, 43)' && dk.capInk === 'rgb(0, 0, 0)', `the button in the bottom bar switches to dark (${dk.bg}, ${dk.card}, button ${dk.cap} with ${dk.capInk} words)`);
  await sp.click('#themeBtn'); await sp.waitForTimeout(500);
  const [t1] = await Promise.all([ctx.waitForEvent('page'), sp.evaluate(() => { window.close = () => {}; document.querySelector('#tools .ntool[data-go="compare"]').click(); })]);
  ok(/app\.html#compare$/.test(t1.url()), 'a tool button opens that tool: ' + t1.url().split('/').pop()); await t1.close();
  const [t2] = await Promise.all([ctx.waitForEvent('page'), sp.evaluate(() => document.getElementById('openFull').click())]);
  ok(/app\.html#home$/.test(t2.url()), 'Open full PageProof opens Home'); await t2.close();
  await sp.close();

  // A browser page: Capture is switched off, the tools are still there.
  sp = await pop(false);
  const b = await sp.evaluate(() => ({ dis: document.getElementById('cap').disabled, txt: document.getElementById('cap').textContent, tools: document.querySelectorAll('#tools .ntool').length, kc: !!document.querySelector('#cap .kc') }));
  ok(b.dis && /Open a website first/.test(b.txt) && b.tools === 5 && !b.kc, 'on a browser page Capture is off and says why, the five tools stay');
  await sp.close();

  // One warning is two lines; two warnings fold to one line each and stay under 600 px.
  // (the background page clears the flag when Drive is fine, so it is set right before drawing)
  // (and the test names the website tab itself: which tab is in front is not steady here)
  sp = await pop(false, () => { window.activeTab = async () => ({ id: 1, url: 'https://www.example-news.com/story', title: 'An example story' }); return chrome.storage.local.set({ fcNeedsAllow: Date.now() }); });
  const w1 = await sp.evaluate(() => ({ n: document.querySelectorAll('.ibar').length, two: document.querySelectorAll('.ibar.two').length, txt: document.querySelector('.ibar').textContent.replace(/\s+/g, ' '), allow: !!document.querySelector('.ibar #allow') }));
  ok(w1.n === 1 && !w1.two && /Drive needs one click\s*to start searching/.test(w1.txt) && w1.allow, 'Drive needs its click: one slim bar with Allow');
  await sp.close();
  sp = await pop(false, () => { window.activeTab = async () => ({ id: 1, url: 'https://www.example-news.com/story', title: 'An example story' }); FC.siteFinds = async () => ({ n: 3, stolen: 1, first: 'x' }); return chrome.storage.local.set({ fcNeedsAllow: Date.now() }); });
  const w2 = await sp.evaluate(() => ({ n: document.querySelectorAll('.ibar.two').length, txt: [...document.querySelectorAll('.ibar .it')].map(x => x.textContent.trim()), cut: [...document.querySelectorAll('.ibar .it')].some(x => x.scrollWidth > x.clientWidth + 1), go: (document.querySelector('.ibar.bad [data-go]') || {}).dataset }));
  const h2 = await tall(sp);
  ok(w2.n === 2 && w2.txt.join('|') === 'Drive needs one click|3 stolen copies here' && !w2.cut && w2.go && /^found\?open=/.test(w2.go.go), 'two warnings are one line each, nothing cut off: ' + w2.txt.join(' | '));
  ok(h2 < 600, 'with two warnings the pop-up is ' + h2 + ' px tall, under the 600 the browser allows');
  await sp.close();
  sp = await pop(false, () => { window.activeTab = async () => ({ id: 1, url: 'https://www.example-news.com/story', title: 'An example story' }); FC.siteFinds = async () => ({ n: 1, stolen: 0, first: 'x' }); return chrome.storage.local.set({ fcNeedsAllow: 0 }); });
  ok(/Found on this site\s*1 copy$/.test(await sp.evaluate(() => document.querySelector('.ibar.bad .it').textContent.replace(/\s+/g, ' ').trim())) && await sp.evaluate(() => document.querySelector('.ibar.bad .btn').textContent) === 'See it', 'a copy on this site: "Found on this site, 1 copy" with See it');
  await sp.close();
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
