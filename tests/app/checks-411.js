// 4.11: searches you start run in the pinned Keep searching tab (a hidden frame there), never in a
// new tab in front of you. A results page only watches such a search, and never runs it itself.
const { start } = require('./h.js');
const { seed } = require('./seed.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  await seed(page); await page.reload(); await page.waitForTimeout(1500);
  const pin = () => ctx.pages().filter(p => /runner\.html/.test(p.url())).length;
  const others = () => ctx.pages().filter(p => !/runner\.html/.test(p.url())).length;
  const before = others();

  // 1. A search that is waiting: the results page only watches it (it must not start it).
  const w = await page.evaluate(async () => {
    const pic = { name: 'a.jpg', size: 1, w: 10, h: 10, hash: 'h411a', thumb: '' };
    const job = await RS_JOB.create([pic], { kind: 'new', engines: ['google'] });
    return { id: job.id, bg: job.bg };
  });
  ok(w.bg === true, 'A search you start is marked to run in the pinned tab');
  await page.goto(url('app.html#results?job=' + w.id)); await page.waitForTimeout(3000);
  const v = await page.evaluate(async id => {
    const j = await RS_DB.get('jobs', id);
    const f = document.querySelector('#live iframe:not([hidden])');
    return { started: j.started, text: f ? f.contentDocument.body.textContent : '' };
  }, w.id);
  ok(!v.started && /Waiting for the small pinned PageProof tab/.test(v.text), 'Results page only watches: it does not run the search itself');
  await page.evaluate(async id => RS_DB.del('jobs', id), w.id);

  // 2. Start a search (its one photo already searched, so no search site is opened): it goes to
  // the pinned tab, nothing opens in front, and the pinned tab finishes it and lets it go.
  await page.goto(url('app.html#search')); await page.waitForTimeout(1500);
  const id = await page.evaluate(async () => {
    const pic = { name: 'b.jpg', size: 1, w: 10, h: 10, hash: 'h411b', thumb: '' };
    const job = await RS_JOB.create([pic], { kind: 'new', engines: ['google'] });
    job.pics[0].runs.google = { state: 'done', count: 0 };
    await RS_DB.put('jobs', job.id, job);
    await RS_JOB.open(job);
    return job.id;
  });
  let gone = false, j = null, sawPin = 0;
  for (let i = 0; i < 30 && !gone; i++) {
    await page.waitForTimeout(1000);
    sawPin = Math.max(sawPin, pin());
    const r = await page.evaluate(async id => ({ q: (await chrome.storage.local.get('fcBgJobs')).fcBgJobs || [], j: await RS_DB.get('jobs', id) }), id);
    j = r.j; gone = !r.q.includes(id) && j && j.finished;
  }
  ok(sawPin === 1, 'The pinned Keep searching tab opened for it');
  ok(others() === before, 'No new tab opened in front of you (' + others() + ' pages, was ' + before + ')');
  ok(/results\?job=/.test(page.url()), 'Inside PageProof the page switches to its progress');
  ok(gone && j.started, 'The pinned tab ran the search and let it go when finished');
  // Keep searching is off here, so with nothing left to do the pinned tab closes again.
  await page.waitForTimeout(3000);
  ok(pin() === 0, 'With Keep searching off, the pinned tab closes once the search is done');

  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await ctx.close();
  process.exit(fails ? 1 : 0);
})();
