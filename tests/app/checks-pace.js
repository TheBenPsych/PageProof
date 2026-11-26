// Instagram "too many requests" (4.64, Ben saw HTTP ERROR 429 on instagram.com/p/ links): Instagram
// pages at most one every 30 seconds for all of PageProof, a 429 makes that site rest (1 hour, then
// longer), the background page sees a 429 in any tab, and a resting site is not read at all.
// Pretend Instagram pages only.
const { start } = require('./h.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  let hits = 0, code = 200;
  await ctx.route('https://www.instagram.com/**', r => { hits++; r.fulfill({ status: code, contentType: 'text/html', body: code === 200 ? '<html><head><meta property="og:image" content="https://scontent.cdninstagram.com/a.jpg"></head><body>post</body></html>' : '' }); });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(1200);
  await page.evaluate(() => chrome.storage.local.remove('ppSiteRest'));

  // ---- 1. the pace: one Instagram page per gap, other sites at once
  const p1 = await page.evaluate(async () => {
    globalThis.PP_PACE_GAP = 1500;
    const t0 = Date.now();
    const a = await PP_PACE.turn('https://www.instagram.com/p/AAA/');
    const b = await PP_PACE.turn('https://www.instagram.com/p/BBB/', 200);       // would wait 1.5 s: refused
    const c = await PP_PACE.turn('https://www.instagram.com/p/CCC/');            // waits its turn
    const waited = Date.now() - t0;
    const d = await PP_PACE.turn('https://www.example.com/x');                   // other sites: no pace
    globalThis.PP_PACE_GAP = 0;
    return { a, b, c, d, waited, site: PP_PACE.siteOf('https://instagr.am/p/x'), th: PP_PACE.siteOf('https://www.threads.com/@a') };
  });
  ok(p1.a && !p1.b && p1.c && p1.d && p1.waited >= 1300, 'Instagram pages wait their turn, a too-long wait is refused, other sites go at once: ' + JSON.stringify(p1));
  ok(p1.site === 'instagram.com' && p1.th === 'threads.net', 'instagr.am and threads.com count as Instagram and Threads');
  const p1b = await page.evaluate(async () => ({
    gaps: ['facebook.com', 'x.com', 'tiktok.com', 'linkedin.com', 'youtube.com'].map(s => PP_PACE.GAP[s] / 1000),
    sites: ['https://m.facebook.com/a', 'https://twitter.com/a', 'https://www.pinterest.co.uk/pin/1', 'https://youtu.be/x', 'https://www.linkedin.com/in/a'].map(PP_PACE.siteOf),
    news: PP_PACE.GAP['nytimes.com'] || 0,
  }));
  ok(p1b.gaps.join() === '20,15,15,30,5' && p1b.sites.join() === 'facebook.com,x.com,pinterest.com,youtube.com,linkedin.com' && !p1b.news, 'other social sites have their own pace, news sites none: ' + JSON.stringify(p1b));
  const p1c = await page.evaluate(async () => {
    globalThis.PP_PACE_GAP = 60000;
    const a = await PP_PACE.turn('https://www.tiktok.com/@a/video/1', 0);
    const t0 = Date.now(); const b = await PP_PACE.turn('https://www.tiktok.com/@a/video/2', 0);
    globalThis.PP_PACE_GAP = 0;
    return { a, b, ms: Date.now() - t0 };
  });
  ok(p1c.a && !p1c.b && p1c.ms < 500, 'a search never waits: a busy site is refused at once (' + p1c.ms + ' ms)');
  const p1d = await page.evaluate(async () => { await PP_PACE.note('https://www.linkedin.com/posts/x', 999); await PP_PACE.load(); const r = PP_PACE.resting('linkedin.com'); await chrome.storage.local.remove('ppSiteRest'); await PP_PACE.load(); return r; });
  ok(p1d, "LinkedIn's 999 answer counts as too many requests");

  // ---- 2. a 429 from their page: Instagram rests 1 hour, and nothing is fetched while it rests
  code = 429; hits = 0;
  const p2 = await page.evaluate(async () => {
    const first = await PP_CHECKS.readPage({ url: 'https://www.instagram.com/p/DDD/' });
    await new Promise(r => setTimeout(r, 300));
    await PP_PACE.load();
    const until = PP_PACE.restUntil('instagram.com');
    const second = await PP_CHECKS.readPage({ url: 'https://www.instagram.com/p/EEE/' });
    return { first, second, mins: Math.round((until - Date.now()) / 60000), resting: PP_PACE.resting('https://www.instagram.com/reel/x/'), fb: PP_PACE.resting('https://www.facebook.com/x') };
  });
  ok(!p2.first.ok && p2.first.paced && p2.mins >= 58 && p2.mins <= 60 && p2.resting && !p2.fb, 'a 429 makes Instagram (only Instagram) rest 1 hour: ' + JSON.stringify(p2));
  ok(hits === 1 && p2.second.paced && /slow down/.test(p2.second.why), 'while it rests Instagram is not asked again (asked ' + hits + ' time)');

  // ---- 3. a second 429 within a day rests longer (2 hours), at most 12 hours
  const p3 = await page.evaluate(async () => {
    const all = (await chrome.storage.local.get('ppSiteRest')).ppSiteRest;
    all['instagram.com'].until = Date.now() - 1000; await chrome.storage.local.set({ ppSiteRest: all }); await PP_PACE.load();
    const u2 = await PP_PACE.rest('instagram.com');
    const all2 = (await chrome.storage.local.get('ppSiteRest')).ppSiteRest;
    all2['instagram.com'].until = Date.now() - 1000; all2['instagram.com'].strikes = 9; await chrome.storage.local.set({ ppSiteRest: all2 }); await PP_PACE.load();
    const u3 = await PP_PACE.rest('instagram.com');
    return { h2: Math.round((u2 - Date.now()) / 360000) / 10, h3: Math.round((u3 - Date.now()) / 360000) / 10 };
  });
  ok(p3.h2 === 2 && p3.h3 === 12, 'a second 429 the same day rests 2 hours, never more than 12: ' + JSON.stringify(p3));

  // ---- 4. a 429 in any tab (your own browsing too) is seen by the background page
  await page.evaluate(() => chrome.storage.local.remove('ppSiteRest'));
  const tab = await ctx.newPage();
  await tab.goto('https://www.instagram.com/p/FFF/').catch(() => {});
  await page.waitForTimeout(1500);
  const p4 = await page.evaluate(async () => { await PP_PACE.load(); return PP_PACE.resting('instagram.com'); });
  ok(p4, 'a 429 page in a normal tab makes PageProof leave Instagram alone');
  await tab.close();

  // ---- 5. the account reader's settings line names the rest
  const p5 = await page.evaluate(async () => { await PP_PACE.load(); return typeof keepAcctInfo === 'function' ? (await keepAcctInfo()).now : 'none'; });
  ok(/Instagram until .*too many requests/.test(p5), 'Settings says Instagram is resting and why');

  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
