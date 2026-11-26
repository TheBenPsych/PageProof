// The calm look, step 20: page names match everywhere. The tour walks all six menu items
// (Tools was missing) and its words use today's page names; Find a setting still finds Health
// and Help and about by their old names; no screen hint,
// tour line or Find a setting entry still names a page that no longer exists.
process.env.NP = process.env.NP || '200'; process.env.NC = process.env.NC || '5';   // before seed.js is read
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
  const OLD = /Hidden and approved sites|Is everything working|How PageProof is doing|Help and tutorial|beside every page|Needs a capture/;

  // ---------- the tour
  await page.goto(url('app.html#home')); await page.waitForTimeout(1500);
  await page.evaluate(() => { ACTS.tour ? ACTS.tour() : document.body.insertAdjacentHTML('beforeend', '<button id="tt" data-act="tour">t</button>'); });
  if (await page.$('#tt')) await page.click('#tt');
  await page.waitForTimeout(700);
  const stops = [];
  for (let i = 0; i < 8; i++) {
    const s = await page.evaluate(() => { const t = document.querySelector('.tourtip'); return t ? { n: t.querySelector('.faint').textContent, t: t.querySelector('b').textContent, d: t.querySelector('.muted').textContent, ring: !!document.querySelector('.tourring') } : null; });
    if (!s) break; stops.push(s);
    await page.click('.tourtip [data-act="tournext"]'); await page.waitForTimeout(350);
  }
  ok(stops.map(s => s.t).join('|') === 'Home|Copies found|Clients|Evidence|Tools|Settings' && stops[0].n === '1 of 6', 'The tour walks all six menu items, Tools included: ' + stops.map(s => s.t).join('|'));
  ok(stops.every(s => s.ring), 'Every tour stop rings its menu item');
  ok(stops.every(s => !OLD.test(s.d)) && /Site lists/i.test(stops[5].d) && /Health/.test(stops[5].d) && /Verify/i.test(stops[4].d), 'The tour uses today\'s page names: ' + stops[5].d);

  // ---------- Find a setting
  await page.goto(url('app.html#settings')); await page.waitForTimeout(1500);
  const find = async q => { await page.fill('#sxFind', q); await page.waitForTimeout(350); return page.evaluate(() => [...document.querySelectorAll('#sxFound a, #sxFound button')].map(x => x.textContent.replace(/\s+/g, ' ').trim())); };
  const f1 = await find('everything working'), f2 = await find('tutorial'), f3 = await find('health');
  ok(f1.some(x => /^Right now\s*Health/.test(x)) && !f1.some(x => OLD.test(x)), 'Find a setting: "everything working" finds Right now on Health: ' + f1.join(' / '));
  ok(f2.some(x => /Help and about$/.test(x)) && !f2.some(x => OLD.test(x)), 'Find a setting: "tutorial" finds Help and about: ' + f2.join(' / '));
  ok(f3.some(x => /Health$/.test(x)), 'Find a setting: "health" finds Health');

  // ---------- no old page name left in the words people see
  const root = path.join(__dirname, '..', '..', 'extension');
  const left = [];
  for (const f of ['ui/fc-found.js', 'ui/fc-social.js', 'ui/pp-checkup.js', 'ui/pp-sync-ui.js', 'ui/fc-photos.js', 'ui/shell.js', 'ui/pp-settings.js', 'pp-report.js']) {
    fs.readFileSync(path.join(root, f), 'utf8').split('\n').forEach((l, i) => {
      if (/^\s*\/\//.test(l)) return;
      const code = l.replace(/\s\/\/ .*$/, '');
      if (/Settings › (Hidden and approved sites|Is everything working|How PageProof is doing|Backups[.'`<]|Team lists[.'`<]|Your computer)/.test(code) || /'(Is everything working\?|How PageProof is doing|Help and tutorial)'/.test(code)) left.push(f + ':' + (i + 1));
    });
  }
  ok(!left.length, 'No hint or menu line names an old Settings page' + (left.length ? ': ' + left.join(', ') : ''));

  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'All calm look step 20 checks passed');
  process.exit(fails ? 1 : 0);
})();
