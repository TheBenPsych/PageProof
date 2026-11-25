// The "Keep searching" yellow flag (Ben, 4.51): big searches you start and pauses you make are not
// counted as Keep searching being held up, and hours before PageProof started recording are not counted.
const { start } = require('./h.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const today = PP_REPORT.lastDays(1)[0];
    const day = PP_REPORT.lastDays(8).reverse().find(k => k !== today && ![0, 6].includes(new Date(k + 'T12:00').getDay()));
    const flag = k => { const st = { days: { [day]: { c: {}, t: {}, x: {}, s: {}, k } } }; return PP_REPORT.alerts(st, { keep: { on: true } }).filter(a => /Keep searching/.test(a[1])).map(a => a[1] + ' | ' + a[2]); };
    return {
      // Ben's Tuesday: recording began at 4 PM, mostly big searches and his own pauses.
      ben: flag({ 16: { fifty: 17, paused: 9 }, 17: { fifty: 56, running: 1, waiting: 1 }, 18: { fifty: 55, hours: 5 }, 19: { hours: 8, paused: 21, running: 5, waiting: 19 } }),
      paused: flag({ 9: { paused: 60 }, 10: { paused: 60 }, 11: { paused: 60 }, 12: { running: 30, waiting: 30 } }),
      busy: flag({ 9: { busy: 60 }, 10: { busy: 50, running: 10 }, 11: { running: 30, waiting: 30 }, 12: { running: 30, waiting: 30 } }),
    };
  });
  ok(r.ben.length === 0, 'Ben\'s Tuesday (big searches, his own pauses, recording from 4 PM) raises no flag: ' + JSON.stringify(r.ben));
  ok(r.paused.length === 0, 'three hours paused by you raise no flag');
  ok(r.busy.length === 1 && /held up 1\.8 hours/.test(r.busy[0]) && /computer busy/.test(r.busy[0]), 'two hours of a busy computer do raise it, with the reason: ' + JSON.stringify(r.busy));
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
