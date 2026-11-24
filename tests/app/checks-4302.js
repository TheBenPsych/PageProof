// Checks for 4.30.2 (Ben): Pause and Off stop everything PageProof does by itself, and Resume picks
// up where it stopped. The account details reader (which opens a profile in a quiet pinned tab)
// waits while paused, switched off or outside the hours, closes its tab at once on Pause, and
// says how far it is. The Keep searching tab says Paused clearly. Pretend accounts only; the
// profile reader is stubbed (no real sites are opened).
const { start } = require('./h.js');
process.env.NP = 120; process.env.NC = 20;
const { seed } = require('./seed.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e.stack || e).slice(0, 900)); });
  const go = async h => { await page.goto(url('app.html#' + h)); await page.waitForTimeout(1200); };
  await go('help'); await seed(page);
  await page.evaluate(() => api.storage.local.set({ ppAcctRead: false, fcKeep: { on: true, hours: 'all' }, fcPause: Date.now() }));
  await page.reload(); await page.waitForTimeout(1000);
  await page.evaluate(async () => {
    const photos = (await FC.allCopies()).map(c => c.photo);
    const p1 = photos[0], cl = p1.slice(2).split('/')[0];
    const now = new Date().toISOString();
    const urls = ['https://www.facebook.com/examplepageone/posts/1', 'https://www.instagram.com/example.two/p/AAA/', 'https://x.com/ExampleThree/status/3'];
    const xs = urls.map((u, i) => ({ id: 'p' + i, photo: p1, client: cl, url: u, key: RS_UTIL.key(u), site: RS_SITE.of(u), title: '', thumb: '', img: '', engines: ['google'], pct: 91, match: 'same', w: 1080, h: 1080, firstSeen: now, lastSeen: now, times: 1, by: 'Keep searching', status: 'new' }));
    for (const c of xs) { c.country = FC.countryOf(c.site); c.use = FC.useOf(c); const a = PP_SOCIAL.fromUrl(c.url); if (a) c.acct = { ...a, from: 'link', sure: 'sure' }; }
    await FC.DB.putMany('copies', xs);
  });
  await go('found');
  await page.evaluate(() => {
    window.READS = [];
    globalThis.PP_INFO_GAP = 800; globalThis.PP_SITE_GAP = 0;
    PP_SOCIAL.readProfile = async a => { window.READS.push(a.key); await new Promise(r => setTimeout(r, 50)); return [{ kind: 'profile', text: 'Example\n2K followers\n', data: [] }]; };
    PP_CHECKS.readPage = async () => ({ ok: false, at: new Date().toISOString(), why: 'stubbed' });
    PP_SOCIAL.unshort = async () => ''; PP_SOCIAL.publicInfo = async () => null;
    if (typeof PP_REPOST !== 'undefined') PP_REPOST.due = () => false;   // the repost check (its own checks) stays out of these tab counts
    return api.storage.local.set({ ppAcctRead: true });
  });
  const acct = () => page.evaluate(async () => ({ reads: window.READS.length, st: (await api.storage.local.get('fcAcctRead')).fcAcctRead || {} }));

  // ---- paused: nothing is read
  await page.evaluate(() => { infoQueue(); });
  await page.waitForTimeout(2500);
  let a = await acct();
  ok(a.reads === 0 && a.st.state === 'held' && a.st.why === 'paused', 'Paused: no account is read (' + a.reads + ' reads, ' + a.st.state + '/' + a.st.why + ')');

  // ---- switched off and outside the hours: also nothing
  await page.evaluate(() => api.storage.local.set({ fcPause: 0, fcKeep: { on: false } }));
  await page.waitForTimeout(1500);
  a = await acct();
  ok(a.reads === 0 && a.st.why === 'off', 'Keep searching off: no account is read (' + a.st.why + ')');
  const h = new Date().getHours();
  await page.evaluate(h => api.storage.local.set({ fcKeep: { on: true, hours: 'work', weekdays: false, from: (h + 2) % 24, to: (h + 3) % 24 } }), h);
  await page.waitForTimeout(1500);
  a = await acct();
  ok(a.reads === 0 && a.st.why === 'hours', 'Outside the hours: no account is read (' + a.st.why + ')');

  // ---- Resume: it carries on by itself, one account at a time, and says how far it is
  await page.evaluate(() => api.storage.local.set({ fcKeep: { on: true, hours: 'all' } }));
  let seen = '';
  for (let i = 0; i < 20; i++) { await page.waitForTimeout(300); const s = await acct(); if (s.st.state === 'resting' || s.st.state === 'reading') seen = seen || JSON.stringify(s.st); if (s.st.state === 'done') break; }
  a = await acct();
  ok(a.reads === 3 && a.st.state === 'done', 'Resumed: every account is read, once each (' + a.reads + ' reads, ' + a.st.state + ')');
  ok(/"total":3/.test(seen), 'It says how far it is (' + seen.slice(0, 120) + ')');

  // ---- Pause closes a quiet tab at once
  const before = (await ctx.pages()).length;
  await page.evaluate(() => { PP_SOCIAL.openQuiet('data:text/html,<title>x</title>hello', 20000); });
  await page.waitForTimeout(800);
  const mid = (await ctx.pages()).length;
  await page.evaluate(() => api.storage.local.set({ fcPause: Date.now() }));
  await page.waitForTimeout(1200);
  const after = (await ctx.pages()).length;
  ok(mid === before + 1 && after === before && (await page.evaluate(() => PP_SOCIAL.halt.on)), 'Pause closes the quiet profile tab straight away (' + [before, mid, after].join(' → ') + ')');

  // ---- per-site limits: two empty X pages = X left alone for 6 hours; X capped at 30 a day
  const lim = await page.evaluate(async () => {
    await api.storage.local.remove('fcAcctLimits');
    await siteNote('x', false); await siteNote('x', false);
    let L = await siteLimits();
    const rest = siteWait(L, 'x') - Date.now();
    await api.storage.local.set({ fcAcctLimits: { x: { day: new Date().toDateString(), n: 30, last: 0 }, 'facebook.com': { day: new Date().toDateString(), n: 3, last: 0 } } });
    L = await siteLimits();
    const capped = siteWait(L, 'x') > Date.now(), fbOk = siteWait(L, 'facebook.com') === 0;
    L.x.day = 'yesterday'; await api.storage.local.set({ fcAcctLimits: L });
    const nextDay = siteWait(await siteLimits(), 'x') === 0;
    await api.storage.local.remove('fcAcctLimits');
    return { rest, capped, fbOk, nextDay, x: acctSite(PP_SOCIAL.fromUrl('https://x.com/ExampleThree')) };
  });
  ok(lim.rest > 5.9 * 3600000 && lim.capped && lim.fbOk && lim.nextDay && lim.x === 'x', 'Site limits: 2 empty X pages = 6 hour rest, 30 X profiles a day then wait for tomorrow, other sites unaffected (' + JSON.stringify(lim) + ')');

  // ---- the Keep searching tab says Paused, clearly
  const r = await ctx.newPage();
  await r.goto(url('runner.html')); await r.waitForTimeout(2500);
  const txt = await r.evaluate(() => document.getElementById('state').textContent + ' | ' + document.getElementById('text').textContent + ' | ' + document.getElementById('pause').textContent);
  ok(/^Paused/.test(txt) && /Nothing is searched or checked/.test(txt) && /picks up where it stopped/.test(txt) && /Resume$/.test(txt), 'Keep searching tab: ' + txt);
  // Resume from the tab
  await r.click('#pause'); await r.waitForTimeout(2500);
  const st2 = await r.evaluate(() => document.getElementById('state').textContent);
  ok(!/Paused/.test(st2) && !(await page.evaluate(async () => (await api.storage.local.get('fcPause')).fcPause)), 'Resume from the tab: not paused any more (' + st2 + ')');

  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await ctx.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e); process.exit(1); });
