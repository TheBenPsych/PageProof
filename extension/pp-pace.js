// Site pace and "too many requests" rests (Ben, 2026-11-25: Instagram showed him "HTTP ERROR 429"
// on /p/ post links in his own browser, because PageProof had read many Instagram posts in a row).
//
// 1. Instagram and Threads pages are read at most one every 30 seconds by ALL of PageProof together
//    (search page checks, post checks, account reader, repost check, quiet tabs), and at most
//    300 a day. Every other site goes as fast as before.
// 2. When any site answers 429 ("too many requests"), PageProof leaves that site alone for a while:
//    1 hour the first time, then 2, 4, 8, at most 12 hours if it happens again within a day.
//    The background page also sees a 429 in your own tabs (Instagram, Facebook, Threads), so when
//    Instagram is unhappy with you, PageProof backs off too. It clears by itself.
// Shared by every PageProof page through storage.local "ppSiteRest" (and a browser lock so two
// pages never read Instagram at the same moment).
(() => {
  const api = globalThis.browser || globalThis.chrome;
  const KEY = 'ppSiteRest';
  const GAP = { 'instagram.com': 30000, 'threads.net': 30000 };
  const DAY = { 'instagram.com': 300, 'threads.net': 300 };
  const H = 3600000, FIRST = H, MOST = 12 * H;
  const NAME = { 'instagram.com': 'Instagram', 'threads.net': 'Threads', 'facebook.com': 'Facebook', 'tiktok.com': 'TikTok', 'x.com': 'X' };
  let cache = {};

  // instagram.com, threads.net, facebook.com... or the plain site for anything else.
  function siteOf(url) {
    let h = '';
    try { h = new URL(url).hostname.toLowerCase(); } catch (e) { h = String(url || '').toLowerCase().replace(/^www\./, ''); }
    if (/(^|\.)(instagram\.com|instagr\.am)$/.test(h)) return 'instagram.com';
    if (/(^|\.)threads\.(net|com)$/.test(h)) return 'threads.net';
    if (/(^|\.)(facebook\.com|fb\.com|fb\.watch|fb\.me)$/.test(h)) return 'facebook.com';
    if (/(^|\.)(x|twitter)\.com$/.test(h)) return 'x.com';
    if (/(^|\.)tiktok\.com$/.test(h)) return 'tiktok.com';
    return h.replace(/^(www|m|mobile)\./, '');
  }
  const nameOf = s => NAME[s] || s;
  const today = () => new Date().toDateString();
  async function load() { try { cache = (await api.storage.local.get(KEY))[KEY] || {}; } catch (e) { /* no storage here */ } return cache; }
  async function save(all) { cache = all; try { await api.storage.local.set({ [KEY]: all }); } catch (e) { /* no storage here */ } }
  try { api.storage.onChanged.addListener((ch, area) => { if (ch[KEY] && (!area || area === 'local')) cache = ch[KEY].newValue || {}; }); } catch (e) { /* no storage here */ }
  load();

  // When the site may be read again (0 = now). Uses the last known state, so it is instant.
  function restUntil(urlOrSite) {
    const s = /^[a-z0-9.-]+$/i.test(urlOrSite || '') && !/^https?:/i.test(urlOrSite) ? urlOrSite : siteOf(urlOrSite);
    const v = cache[s];
    return v && v.until > Date.now() ? v.until : 0;
  }
  const resting = u => !!restUntil(u);
  // Every site resting now: [{ site, name, until, why }].
  function rests() {
    const now = Date.now();
    return Object.entries(cache).filter(([, v]) => v.until > now).map(([site, v]) => ({ site, name: nameOf(site), until: v.until, why: v.why || '' }));
  }

  const locked = (site, fn) => globalThis.navigator && navigator.locks ? navigator.locks.request('pp-pace-' + site, fn) : fn();

  // The site said "too many requests": leave it alone for a while (longer each time today).
  async function rest(urlOrSite, why = '429') {
    const site = /^https?:/i.test(urlOrSite || '') ? siteOf(urlOrSite) : siteOf('https://' + urlOrSite + '/');
    return locked(site, async () => {
      const all = await load(), now = Date.now();
      const v = all[site] || {};
      if (v.until > now) return v.until;                  // already resting: one 429 storm = one strike
      const again = v.restAt && now - v.restAt < 24 * H;
      v.strikes = again ? (v.strikes || 0) + 1 : 1;
      v.restAt = now;
      v.until = now + Math.min(FIRST * 2 ** (v.strikes - 1), MOST);
      v.why = why;
      all[site] = v;
      await save(all);
      try { if (typeof PP_STATS !== 'undefined') PP_STATS.add('limit.429.' + (site.replace(/\.(com|net)$/, '').replace(/[^a-z]/g, '') || 'other')); } catch (e) { /* no stats */ }
      return v.until;
    });
  }
  // A page answered: a 429 starts a rest.
  function note(url, status) { if (status === 429) return rest(url, '429'); return null; }

  // Waits for this site's turn. false = don't read it now (resting, had enough today, or the wait
  // would be longer than maxWait). Sites without a pace are always true at once (unless resting).
  async function turn(url, maxWait = 2 * 60000) {
    const site = siteOf(url);
    if (restUntil(site)) return false;
    const gap = GAP[site] ? (globalThis.PP_PACE_GAP ?? GAP[site]) : 0;
    if (!gap) return true;
    const t0 = Date.now();
    for (;;) {
      const wait = await locked(site, async () => {
        const all = await load(), now = Date.now();
        const v = all[site] || (all[site] = {});
        if (v.until > now) return -1;
        if (v.day !== today()) { v.day = today(); v.n = 0; }
        if ((v.n || 0) >= (DAY[site] || Infinity)) return -1;
        const next = (v.last || 0) + gap;
        if (next > now) return next - now;
        v.last = now; v.n = (v.n || 0) + 1;
        await save(all);
        return 0;
      });
      if (wait === 0) return true;
      if (wait < 0 || Date.now() - t0 + wait > maxWait) return false;
      await new Promise(r => setTimeout(r, Math.min(wait + 50, 5000)));
    }
  }
  // fetch() with the site's pace: resolves to null when the site may not be read now.
  async function pfetch(url, opts, maxWait) {
    if (!(await turn(url, maxWait))) return null;
    const r = await fetch(url, opts);
    if (r && r.status === 429) note(r.url || url, 429);
    return r;
  }

  // Background page only: watch for 429 answers from the social sites, in PageProof's own reads and
  // in your own tabs.
  function watch() {
    try {
      api.webRequest.onCompleted.addListener(d => { if (d.statusCode === 429) rest(d.url, '429'); },
        { urls: ['*://*.instagram.com/*', '*://*.threads.net/*', '*://*.threads.com/*', '*://*.facebook.com/*'], types: ['main_frame', 'sub_frame', 'xmlhttprequest'] });
    } catch (e) { /* no webRequest here */ }
  }

  globalThis.PP_PACE = { siteOf, nameOf, restUntil, resting, rests, rest, note, turn, fetch: pfetch, watch, load, GAP, DAY };
})();
