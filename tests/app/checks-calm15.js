// The calm look, step 15: Evidence › Overview (was Capture a page). The page shows what has been
// captured: tiles, captures per week, Needs you, newest captures, where captures come from, most
// captured, how captures went, trusted timestamps, where the packs are. Starting a capture sits
// behind How to capture. Also: the small counts a capture now leaves in the log (never in the pack).
process.env.NP = process.env.NP || '2000'; process.env.NC = process.env.NC || '30';   // before seed.js is read
const fs = require('fs'), path = require('path');
const { start } = require('./h.js'); const { seed } = require('./seed.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(1200);
  await seed(page);
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'light', log: [], fcReports: [] }));
  const T = (ms = 500) => page.waitForTimeout(ms);

  // ---- first-time look
  await page.goto(url('app.html#capture')); await page.waitForSelector('#ovEmpty', { timeout: 60000 });
  const e = await page.evaluate(() => ({ h1: document.querySelector('.head h1').textContent.replace(/\s+/g, ' ').trim(), subs: [...document.querySelectorAll('.subs a')].map(a => a.textContent.trim()), t: document.querySelector('#ovEmpty').textContent, steps: document.querySelectorAll('#ovEmpty .cpsteps > div').length, btns: [...document.querySelectorAll('.head .headact .btn')].map(b => b.textContent.trim()), tiles: !!document.querySelector('#ovTiles'), cap: document.querySelector('#capBtn').getAttribute('href') }));
  ok(/Overview/.test(e.h1) && e.subs.join('|') === 'All evidence|Overview|Weekly summary', 'Capture a page is now Evidence › Overview: ' + e.subs.join(' · '));
  ok(/No captures yet/.test(e.t) && e.steps === 3 && !e.tiles && /captured by themselves/.test(e.t), 'With no captures it shows a calm first-time card with three steps');
  ok(e.btns.join('|') === 'How to capture|Verify a pack|Open packs folder' && e.cap === '#capture?how=1', 'The top has How to capture, Verify a pack and Open packs folder: ' + e.btns.join(' · '));

  // ---- 24 captures: 12 of Stolen copies, 12 other; the newer ones carry the new counts
  const S = await page.evaluate(async () => {
    const cs = (await FC.allCopies()).filter(c => c.status !== 'removed').slice(0, 12), now = Date.now(), log = [];
    for (const c of cs) { c.status = 'stolen'; c.answered = new Date(now - 864e5).toISOString(); } await FC.DB.putMany('copies', cs);
    const src = ['stolen', 'popup', 'key', 'menu', 'app', 'link'];
    for (let i = 0; i < 24; i++) {
      const own = i < 12, t = new Date(now - i * 31 * 3600e3 - 3600e3).toISOString(), saved = i % 6 !== 4, caseRef = !saved || i % 5 === 3 ? '' : 'CASE-' + (100 + (i % 3));
      const ts = i % 7 === 2 ? '' : i % 4 === 1 ? 'DigiCert 2026-11-01T10:00:00Z; FreeTSA 2026-11-01T10:00:01Z' : i === 8 ? 'DigiCert x; Sectigo x; GlobalSign x' : 'DigiCert x; Sectigo x; FreeTSA x';
      const x = { id: 'cap-' + i, captureId: 'PP-T' + (1000 + i), time: t, url: own ? cs[i].url : 'https://hand-site-' + (i % 3) + '.example/page/' + i, title: 'Page ' + i, saves: saved ? [{ at: t, file: 'f' + i + '.zip', sha256: 'aa' + i, caseRef, collector: 'Sam', timestamps: ts }] : [] };
      if (i < 16) Object.assign(x, { src: own ? 'stolen' : src[1 + i % 5], ms: 60000 + i * 10000, screens: 2 + i % 5, boxes: i % 4 === 0 ? 2 : 0, popups: i % 3 === 0 ? 1 : 0, ...(i === 5 ? { stopped: 1 } : {}), ...(i === 6 ? { endless: 1 } : {}) });
      log.push(x);
    }
    await chrome.storage.local.set({ log: log.slice().reverse() });
    const sv = log.filter(x => x.saves.length), n = s => s.split(';').filter(Boolean).length;
    return { N: 24, saved: sv.length, not: 24 - sv.length, full: sv.filter(x => n(x.saves[0].timestamps) >= 3).length, part: sv.filter(x => { const k = n(x.saves[0].timestamps); return k > 0 && k < 3; }).length, nots: sv.filter(x => !x.saves[0].timestamps).length, nocase: sv.filter(x => !x.saves[0].caseRef).length,
      week: log.filter(x => now - Date.parse(x.time) < 7 * 864e5).length, digi: sv.filter(x => x.saves[0].timestamps.includes('DigiCert')).length, sect: sv.filter(x => x.saves[0].timestamps.includes('Sectigo')).length, m30: log.filter(x => x.ms).length, boxes: log.filter(x => x.ms).reduce((a, x) => a + x.boxes, 0), pops: log.filter(x => x.ms).reduce((a, x) => a + x.popups, 0) };
  });
  await page.reload(); await page.waitForSelector('#ovTiles', { timeout: 60000 }); await T(800);

  // ---- tip + tiles
  const t = await page.evaluate(() => ({ tip: (document.querySelector('#ovTip') || {}).textContent || '', how: !!document.querySelector('#ovHow'), caphero: !!document.querySelector('.caphero'), packs: document.querySelector('#ovPacks').textContent.replace(/\s+/g, ' '), month: document.querySelector('#ovMonth').textContent.replace(/\s+/g, ' '), st: document.querySelector('#ovStamped').textContent.replace(/\s+/g, ' '), wait: document.querySelector('#ovWaiting').textContent.replace(/\s+/g, ' '), waitHref: document.querySelector('#ovWaiting a').getAttribute('href') }));
  ok(/click the PageProof icon › Capture/.test(t.tip) && /Alt\+Shift\+P/.test(t.tip) && !t.how && !t.caphero, 'The capture tool is gone from the page: one tip bar says how to capture');
  ok(t.packs.startsWith(S.saved + 'Evidence packs saved') && t.packs.includes(Math.round(S.saved / S.N * 100) + '% of captures') && t.month.includes(`${S.week} this week · ${S.N} in all`) && t.st.startsWith(S.full + 'Fully timestamped') && t.st.includes(S.part + ' with fewer') && t.wait.startsWith(S.not + 'Waiting for a pack') && t.waitHref === '#library?filter=Pack%20not%20saved', `Four tiles: captures this month, packs saved (${S.saved}), fully timestamped (${S.full}), waiting for a pack (${S.not})`);

  // ---- chart
  const ch = await page.evaluate(() => ({ cols: document.querySelectorAll('#ovChart .cpcol').length, now: document.querySelector('#ovChart .cpcol.now span').textContent, total: [...document.querySelectorAll('#ovChart .cpst b')].reduce((a, b) => a + (+b.textContent || 0), 0), legend: document.querySelector('#ovChart .cplg').textContent, label: document.querySelector('#ovChart .cpchart').getAttribute('aria-label'), split: [...document.querySelectorAll('#ovChart .cpcol')].some(c => +c.querySelector('i.s').style.flexGrow > 0 && +c.querySelector('i.h').style.flexGrow > 0) }));
  ok(ch.cols === 12 && ch.now === 'This week' && ch.total === 24 && /Of a Stolen copy/.test(ch.legend) && /Other pages/.test(ch.legend) && /This week/.test(ch.label) && ch.split, 'Captures per week: 12 weeks of stacked bars (of a Stolen copy / other pages), with a text version for screen readers');

  // ---- needs you
  const n = await page.evaluate(() => ({ tag: document.querySelector('#ovNeed .kh2 .ktag').textContent, rows: [...document.querySelectorAll('#ovNeed .cpnr')].map(r => r.querySelector('.kn1 b').textContent), save: document.querySelectorAll('#ovNeed [data-act="opencap"]').length, links: [...document.querySelectorAll('#ovNeed a.cpgo')].map(a => a.getAttribute('href')) }));
  ok(+n.tag === S.not + S.part + 2 && n.rows.filter(r => r === 'Pack not saved').length === 3 && n.save === 3 && n.rows.some(r => /Only 2 of 3 timestamps/.test(r)) && n.rows.includes(`${S.nocase} packs have no case number`) && n.rows.includes(`${S.nots} packs have no timestamps`), 'Needs you lists packs not saved (Save the pack), packs with fewer timestamps, and counts with no case number or no timestamps: ' + n.rows.join(' | '));
  ok(n.links.includes('#library?filter=Pack%20not%20saved') && n.links.includes('#library?filter=No%20case%20number') && n.links.includes('#library?filter=No%20timestamps'), 'Each count links to All evidence with the right filter');

  // ---- newest, sources, most captured
  const m = await page.evaluate(() => ({ cards: [...document.querySelectorAll('#ovNewest .cpcard')].filter(c => c.offsetParent).length, first: document.querySelector('#ovNewest .cpcard').dataset.v, tag: document.querySelector('#ovNewest .cpcard .cpimg em').textContent, stat: document.querySelector('#ovNewest .cpcard .cpok').textContent, all: document.querySelector('#ovNewest .kh2 a').getAttribute('href'),
    src: Object.fromEntries([...document.querySelectorAll('#ovFrom .cpr')].map(r => [r.dataset.src, +r.querySelector('.cpn2').textContent])), sites: [...document.querySelectorAll('#ovMost .cpr2')].map(r => r.querySelector('b').textContent + '=' + r.querySelector('.num').textContent) }));
  ok(m.cards === 5 && m.first === 'cap-0' && m.tag === 'From Stolen' && /Pack · 3 timestamps/.test(m.stat) && m.all === '#library', 'Newest captures is one row of cards (five at 1080p) with where each came from and its pack: ' + m.tag);
  ok(m.src.stolen === 12 && m.src.popup + m.src.key + m.src.menu + m.src.app + m.src.link === 4 && m.src.old === 8 && Object.values(m.src).reduce((a, b) => a + b, 0) === 24, 'Where captures come from: Stolen copies count even when captured before the count began, the rest of the old ones say Not counted: ' + JSON.stringify(m.src));
  ok(m.sites.slice(0, 3).every(s => /^hand-site-\d\.example=4$/.test(s)) && m.sites.some(s => /^CASE-10\d=\d+$/.test(s)), 'Most captured lists the top sites and the top cases: ' + m.sites.join(', '));

  // ---- how captures went, time services, where packs are
  const h = await page.evaluate(() => ({ went: [...document.querySelectorAll('#ovWent .cphw > div')].map(d => d.textContent.replace(/\s+/g, ' ').trim()), foot: document.querySelector('#ovWent .kfoot').textContent, tsa: Object.fromEntries([...document.querySelectorAll('#ovTsa .cpts')].map(r => [r.dataset.tsa, r.textContent.replace(/\s+/g, ' ').trim()])), where: document.querySelector('#ovWhere').textContent.replace(/\s+/g, ' '), folder: !!document.querySelector('#ovWhere [data-act="evdownloads"]') }));
  ok(h.went.length === 6 && /^2 min 15 s ?Average time per capture/.test(h.went[0]) && /screens ?Average page length/.test(h.went[1]) && h.went[2].startsWith(String(S.boxes)) && h.went[3].startsWith(String(S.pops)) && /^1 ?Stopped early/.test(h.went[4]) && /^1 ?Endless pages/.test(h.went[5]) && h.foot.includes(`From ${S.m30} captures`), 'How captures went: average time and length, scroll boxes, pop-ups closed, stopped early, endless pages: ' + h.went[0]);
  ok(h.tsa.DigiCert.includes(`Answered ${S.digi} of ${S.saved} packs`) && /Every time|Missed/.test(h.tsa.DigiCert) && h.tsa.Sectigo.includes(`Answered ${S.sect} of ${S.saved}`) && /Missed/.test(h.tsa.Sectigo) && /Stepped in for 1 pack/.test(h.tsa.GlobalSign) && /Spare, used when/.test(h.tsa.Entrust), 'Trusted timestamps shows how often each service answered, and the spares: ' + h.tsa.Sectigo);
  ok(/Downloads › PageProof › case number/.test(h.where) && /kept in this browser/.test(h.where) && h.folder, 'Where your packs are, with Open folder');

  // ---- how to capture (the tool, behind a button), tip closes for good
  await page.click('.head [data-act="ovhow"]'); await page.waitForSelector('#ovHow');
  const hw = await page.evaluate(() => ({ steps: document.querySelectorAll('#ovHow .cpsteps > div').length, last: document.querySelector('#ovHow .cplast').textContent, pressed: document.querySelector('.head [data-act="ovhow"]').getAttribute('aria-expanded') }));
  ok(hw.steps === 3 && /last tab|Open the web page you want/.test(hw.last) && hw.pressed === 'true', 'How to capture opens the three steps and your last tab with Capture this page');
  await page.click('#ovHow .kx'); await T();
  ok(!(await page.$('#ovHow')), 'Its X closes it again');
  await page.goto(url('app.html#home')); await T(800); await page.click('#capBtn'); await page.waitForSelector('#ovHow', { timeout: 30000 });
  ok(await page.evaluate(() => location.hash === '#capture'), 'The blue Capture a page button in the top bar opens Overview with How to capture showing');
  await page.click('#ovTip .kx'); await T(700);
  await page.reload(); await page.waitForSelector('#ovTiles', { timeout: 60000 });
  ok(!(await page.$('#ovTip')) && !(await page.$('#ovHow')), 'The tip stays closed once you close it');

  // ---- a card opens that capture in All evidence
  await page.click('#ovNewest .cpcard'); await page.waitForSelector('#evPanel', { timeout: 30000 });
  ok(await page.evaluate(() => location.hash === '#library' && document.querySelector('.evc.sel').dataset.id === 'cap-0'), 'Clicking a newest capture opens its details in All evidence');
  await page.keyboard.press('Escape');

  // ---- old captures only (no counts yet)
  await page.evaluate(async () => { const { log } = await chrome.storage.local.get('log'); for (const x of log) { delete x.src; delete x.ms; delete x.screens; delete x.boxes; delete x.popups; delete x.stopped; delete x.endless; } await chrome.storage.local.set({ log }); });
  await page.goto(url('app.html#capture')); await page.waitForSelector('#ovTiles', { timeout: 60000 }); await T();
  const o = await page.evaluate(() => ({ none: (document.querySelector('#ovWentNone') || {}).textContent || '', src: Object.fromEntries([...document.querySelectorAll('#ovFrom .cpr')].map(r => [r.dataset.src, +r.querySelector('.cpn2').textContent])) }));
  ok(/counts this from now on/.test(o.none) && o.src.stolen === 12 && o.src.old === 12, 'Captures made before this version: How captures went says it counts from now on, and nothing is made up');

  // ---- the capture code leaves the counts in the log only
  const bg = fs.readFileSync(path.join(__dirname, '../../extension/background.js'), 'utf8');
  const rec = bg.slice(bg.indexOf('const record = {'), bg.indexOf('sections: [],'));
  ok(/src: src \|\| 'link', ms: Date\.now\(\) - began, screens: record\.main\.tiles\.length/.test(bg) && !/\bsrc\b|\bms:/.test(rec), 'A capture writes where it started and how it went to the log line, not into the capture record or the pack');
  ok(/startCapture\(tab, 'key'\)/.test(bg) && /startCapture\(tab, 'menu'\)/.test(bg) && /msg\.src === 'stolen' \? 'stolen' : 'link'/.test(bg), 'The shortcut, the right-click menu and a Stolen copy each say where the capture came from');

  // ---- narrow + dark
  await page.setViewportSize({ width: 1280, height: 800 }); await T();
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'At 1280 wide nothing runs off the side');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => chrome.storage.local.set({ ppTheme: 'dark' })); await page.reload(); await page.waitForSelector('#ovTiles', { timeout: 60000 }); await T();
  const d = await page.evaluate(() => ({ card: getComputedStyle(document.querySelector('#ovChart')).backgroundColor, ink: getComputedStyle(document.querySelector('#ovChart .kh2')).color }));
  ok(d.card === 'rgb(43, 43, 43)' && +d.ink.match(/\d+/)[0] > 220, `Dark: grey cards, light words (${d.card}, ${d.ink})`);
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
