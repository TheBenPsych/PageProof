// After 4.49 (Ben: "Skipped? Is that because I stopped it manually?"): a search you stop says
// "stopped by you" (not "skipped"), the photo shows as not finished, and the links already found
// are still checked. Made-up names only.
const fs = require('fs'), path = require('path');
const { start } = require('./h.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const rs = await ctx.newPage();
  rs.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await rs.goto(url('revsearch.html?job=none')); await rs.waitForTimeout(800);
  const r = await rs.evaluate(() => {
    const run = (state, why) => ({ state, why });
    job = { engines: ['google', 'yandex', 'bing'], pics: [] };
    const stopped = { i: 41, links: [], runs: { google: run('skip', STOPPED), yandex: run('done'), bing: run('done') } };
    const before = { i: 42, links: [], runs: { google: run('skip', STOPPED_BEFORE), yandex: run('skip', STOPPED_BEFORE), bing: run('skip', STOPPED_BEFORE) } };
    const other = { i: 43, links: [], runs: { google: run('skip', 'Google was skipped. Use "Search the rest" later.'), yandex: run('done'), bing: run('done') } };
    return { a: sqState(stopped, 0), b: sqState(before, 0), c: sqState(other, 0), by: [byYou(stopped.runs.google), byYou(other.runs.google), byYou(stopped.runs.yandex)] };
  });
  ok(r.a[1] === 'not finished: stopped by you' && r.b[1] === 'not finished: stopped by you', 'a photo you stopped shows as not finished, stopped by you: ' + r.a[1]);
  ok(r.c[1] === 'skipped on a search site', 'a site that skipped by itself still says skipped');
  ok(r.by.join() === 'true,false,false', 'only your Stop counts as stopped by you');
  const src = fs.readFileSync(path.join(__dirname, '../../extension/revsearch.js'), 'utf8');
  ok(!/finishTask\(t, 'skip', 'Stopped'\)/.test(src) && (src.match(/finishTask\(t, 'skip', STOPPED\)/g) || []).length === 2, 'both Stop buttons say Stopped by you');
  ok(/stopped by you on/.test(src) && /'stopped by you'/.test(src) && /You stopped this search, so/.test(src), 'the timeline, the site chip and the note say stopped by you');
  ok(/if \(R\.stop && R\.scoreQ\.length\) scoreAll\(\)/.test(src), 'after Stop the links already found are still checked');
  const run = fs.readFileSync(path.join(__dirname, '../../extension/runner.js'), 'utf8');
  ok(/const hold = job\.stoppedAt \|\| \(job\.finished && \(await bgList\(\)\)\.some\(x => x !== job\.id\)\) \? 3 : 10;/.test(run) && /job\.finished && Date\.now\(\) - Date\.parse\(job\.finished\) > hold \* 60000/.test(run), 'a search you stopped lets the next big search start after 3 minutes');
  ok((src.match(/job\.stoppedAt = new Date/g) || []).length === 2, 'both Stop buttons mark the search as stopped');
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
