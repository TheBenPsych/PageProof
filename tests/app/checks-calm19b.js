// Calm look batch 19 (Ben, 2026-11-26): the capture page. Blue Save evidence pack, the four single
// parts in one row under "Or just one part" (Markup is now "Mark up"), no trusted timestamp shown
// as an amber bar with what each service said folded underneath, and Fit the window / Real size.
// The capture's own files are not touched by any of this.
const { start } = require('./h.js');
const http = require('http');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>Harbor news</title><body style="margin:0;font:18px Georgia,serif"><h1>Harbor plan wins council vote</h1><p>' + 'The council voted to approve the plan. '.repeat(200) + '</p></body>'); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const { ctx, sw } = await start();
  const site = await ctx.newPage(); await site.setViewportSize({ width: 1400, height: 900 });
  await site.goto('http://127.0.0.1:' + srv.address().port + '/story'); await site.waitForTimeout(600); await site.bringToFront();
  const [v] = await Promise.all([ctx.waitForEvent('page', { predicate: x => x.url().includes('viewer.html'), timeout: 60000 }), sw.evaluate(async () => { const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); capture(t); })]);
  v.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await v.setViewportSize({ width: 1400, height: 900 });
  await v.waitForSelector('#pack'); await v.waitForFunction(() => !document.getElementById('pack').disabled, null, { timeout: 120000 });
  await v.waitForTimeout(800);
  const a = await v.evaluate(() => {
    const p = document.getElementById('pack'), g = document.querySelector('#saveBox .grid');
    return { bg: getComputedStyle(p).backgroundColor, one: (document.querySelector('#saveBox .onepart') || {}).textContent, cols: getComputedStyle(g).gridTemplateColumns.split(' ').length, tiles: [...g.querySelectorAll('.tile')].map(t => t.textContent.trim()), tops: [...g.querySelectorAll('.tile')].map(t => Math.round(t.getBoundingClientRect().top)) };
  });
  ok(a.bg === 'rgb(0, 95, 184)', 'Save evidence pack is blue: ' + a.bg);
  ok(a.one === 'Or just one part' && a.cols === 4 && a.tiles.join('|') === 'Copy|Mark up|PDF|HTML' && new Set(a.tops).size === 1, 'Copy, Mark up, PDF and HTML sit in one row under "Or just one part": ' + JSON.stringify(a));
  // The test computer can't reach the timestamp services, so none answers.
  const t = await v.evaluate(() => { const b = document.getElementById('tsBar'); return { shown: !b.hidden, txt: b.innerText, li: b.querySelectorAll('details li').length, open: b.querySelector('details').open, status: document.getElementById('status').textContent, proof: document.getElementById('pfStamp').className }; });
  ok(t.proof === 'bad' && t.shown && /No trusted timestamp could be added/.test(t.txt) && /Everything else is saved\. For a timestamp, capture the page again in a minute\./.test(t.txt) && !t.open && t.li >= 3, 'no timestamp shows an amber bar in plain words, with each service folded: ' + JSON.stringify({ ...t, txt: t.txt.slice(0, 160) }));
  ok(!/No trusted timestamp could be added/.test(t.status), 'the blue status line no longer repeats it');
  const z = await v.evaluate(() => { const b = document.getElementById('zoomBar'); return { shown: !b.hidden, txt: b.innerText, fit: document.getElementById('zFit').classList.contains('on') }; });
  ok(z.shown && z.fit && /Fit the window/.test(z.txt) && /Real size/.test(z.txt) && /1 section · [\d,]+ × [\d,]+ px/.test(z.txt), 'the preview has Fit the window / Real size and the size: ' + z.txt.replace(/\n/g, ' '));
  const w0 = await v.evaluate(() => document.querySelector('#preview img').getBoundingClientRect().width);
  await v.click('#zReal'); await v.waitForTimeout(300);
  const w1 = await v.evaluate(() => ({ w: document.querySelector('#preview img').getBoundingClientRect().width, nat: document.querySelector('#preview img').width, real: document.getElementById('preview').classList.contains('real'), pressed: document.getElementById('zReal').getAttribute('aria-pressed') }));
  ok(w1.real && w1.pressed === 'true' && Math.abs(w1.w - w1.nat) < 2 && w1.w > w0, 'Real size shows the capture at its real width (' + Math.round(w0) + ' → ' + Math.round(w1.w) + ' px)');
  await v.click('#zFit'); await v.waitForTimeout(300);
  ok(await v.evaluate(w0 => Math.abs(document.querySelector('#preview img').getBoundingClientRect().width - w0) < 2 && !document.getElementById('preview').classList.contains('real'), w0), 'Fit the window brings it back');
  await v.evaluate(() => { document.documentElement.dataset.theme = 'dark'; }); await v.waitForTimeout(200);
  ok(await v.evaluate(() => getComputedStyle(document.getElementById('pack')).backgroundColor === 'rgb(96, 205, 255)'), 'in dark the Save button is light blue with dark text');
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await ctx.close(); srv.close(); process.exit(fails ? 1 : 0);
})();
