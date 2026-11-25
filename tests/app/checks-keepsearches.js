// All searches keeps big searches apart from Keep searching's one-photo searches (4.53.1, Ben):
// before, only the last 40 were kept, so a busy hour of Keep searching pushed every big search out.
const { start } = require('./h.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  const r = await page.evaluate(async () => {
    const now = Date.now(), H = 3600e3, D = 864e5;
    const put = (ms, kind, n, extra = {}) => { const id = 'rs' + ms + Math.random().toString(36).slice(2, 5); return RS_DB.put('jobs', id, { id, created: new Date(ms).toISOString(), kind, engines: ['google'], finished: new Date(ms).toISOString(), pics: Array.from({ length: n }, (_, i) => ({ i, links: [], runs: { google: { state: 'done' } } })), ...extra }).then(() => id); };
    const big = [];
    for (let k = 0; k < 30; k++) big.push(await put(now - 5 * D - k * H, k % 2 ? 'new' : 'fifty', 10));
    const ancient = await put(now - 120 * D, 'new', 100);
    for (let k = 0; k < 200; k++) await put(now - k * 60e3, 'keep', 1);
    const oldSmall = await put(now - 3 * D, 'keep', 1);
    const running = await put(now - 3 * H, 'new', 50, { finished: null });
    await RS_JOB.prune(true);
    const keys = await RS_DB.keys('jobs');
    const out = { bigKept: big.filter(id => keys.includes(id)).length, ancient: keys.includes(ancient), oldSmall: keys.includes(oldSmall), running: keys.includes(running), total: keys.length };
    // 700 more one-photo searches: capped at 600, big ones untouched.
    for (let k = 0; k < 700; k++) await put(now - 1000 - k * 1000, 'keep', 1);
    await RS_JOB.prune(true);
    const all = await RS_DB.all('jobs');
    out.small = all.filter(j => j.kind === 'keep').length; out.big2 = all.filter(j => j.kind !== 'keep').length;
    out.since = (await RS_DB.since('jobs', now - 2 * H)).length;
    return out;
  });
  ok(r.bigKept === 30, 'all 30 big searches kept next to 200 one-photo searches (' + r.bigKept + ')');
  ok(!r.ancient, 'a big search older than 90 days is removed');
  ok(!r.oldSmall, 'a one-photo search older than 2 days is removed');
  ok(r.running, 'a running search is never removed');
  ok(r.small === 600, 'one-photo searches capped at 600 (' + r.small + ')');
  ok(r.big2 === 31, 'big searches untouched by the cap (' + r.big2 + ')');
  ok(r.since > 100 && r.since < 900, 'RS_DB.since reads only recent searches (' + r.since + ')');
  await page.goto(url('app.html#searches')); await page.waitForTimeout(1500);
  const txt = (await Promise.all(page.frames().map(f => f.evaluate(() => document.body ? document.body.innerText : '').catch(() => '')))).join(' ');
  ok(/kept for 90 days/.test(txt), 'All searches says how long searches are kept');
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
