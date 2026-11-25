// New tools (Ben's picks, 2026-11-24): Credit line search and the Watch list.
//
// 1. Credit line search. Now and then, in Keep searching's hours, PageProof asks Google (a normal
//    text search, in a quiet pinned tab of your browser) for pages that print a client's photo
//    credit, like "Photo: Harbor Times". Each page it lists is read without your cookies and its
//    pictures are compared with that client's photos. A match goes to New, tagged
//    "Found by credit search". Pages that name the client but show none of their photos are
//    listed on the Credit search page, to look at by hand. Each wording is searched at most once
//    a week, and never while Google is resting after a robot check (that is never got around).
//
// 2. Watch list. A site or social account with 2 or more copies marked Stolen is watched. Once a
//    week PageProof reads only its NEW posts (the site's news feed or sitemap, or the account's
//    newest posts in a quiet tab) and compares their pictures with every client's photos.
//    Old Stolen pages are never opened again.
//
// Both use the small "look" fingerprints every searched photo already has, like the sweep (4.43).
// Nothing is answered by itself and nothing is sent anywhere except normal visits to the pages.
const PP_WATCH = (() => {
  const api = globalThis.browser || globalThis.chrome;
  const DAY = 864e5, WEEK = 7 * DAY;
  const CLOSE = 7;                     // how near two looks must be (out of 64) to count as the same photo
  const late = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('no answer')), ms))]);
  const get = async (url, kind = 'text', ms = 15000) => { const r = await late(fetch(url, { credentials: 'omit', redirect: 'follow' }), ms); if (!r.ok) throw new Error('answered ' + r.status); return kind === 'blob' ? r.blob() : r.text(); };
  const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  const stat = (k, n) => { if (typeof PP_STATS !== 'undefined') PP_STATS.add(k, n); };
  // Time spent, so the stats can say whether each extra search is worth it.
  const PP_STATS_T = (k, t0) => { if (typeof PP_STATS !== 'undefined') PP_STATS.time(k, Date.now() - t0); };

  // ---------------------------------------------------------------- looks of your photos
  // Kept as two 32-bit numbers each, so a whole library compares fast.
  let LOOKS = null;
  async function looks() {
    if (LOOKS && Date.now() - LOOKS.at < 10 * 60000) return LOOKS.list;
    const list = [];
    for (const p of await FC.DB.all('photos')) if (p.look && !p.gone && p.look.length === 16) list.push({ id: p.id, client: p.client || '', a: parseInt(p.look.slice(0, 8), 16) >>> 0, b: parseInt(p.look.slice(8), 16) >>> 0 });
    LOOKS = { at: Date.now(), list };
    return list;
  }
  const bits = v => { v -= (v >>> 1) & 0x55555555; v = (v & 0x33333333) + ((v >>> 2) & 0x33333333); return (((v + (v >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24; };
  // The nearest photo to this look (only that client's photos when a client is given).
  function nearest(list, look, client) {
    const a = parseInt(look.slice(0, 8), 16) >>> 0, b = parseInt(look.slice(8), 16) >>> 0;
    let best = null, bd = 99;
    for (const p of list) {
      if (client && p.client !== client) continue;
      const d = bits((p.a ^ a) >>> 0) + bits((p.b ^ b) >>> 0);
      if (d < bd) { bd = d; best = p; if (!d) break; }
    }
    return best && bd <= CLOSE ? { photo: best.id, dist: bd } : null;
  }
  // One picture: downloaded (without your cookies), fingerprinted and compared.
  async function checkPic(img, list, client) {
    let blob;
    try { blob = await get(img, 'blob', 12000); } catch (e) { return { failed: true }; }
    if (!blob || blob.size < 4000 || blob.size > 15e6 || !/^image\//.test(blob.type || 'image/')) return {};
    let look;
    try { look = await FC.lookHash(blob); } catch (e) { return {}; }
    return { checked: true, hit: nearest(list, look, client) };
  }
  let LISTS_AT = 0;
  const skipSite = (site, url) => {
    try { if (typeof RS_LISTS !== 'undefined' && RS_LISTS.isHidden(site, url)) return true; } catch (e) { /* lists not loaded */ }
    return typeof PP_SOCIAL !== 'undefined' && PP_SOCIAL.isSocial(site);
  };

  // ================================================================ 1. Credit line search
  const DEFAULT_WORDS = ['"Photo: {name}"', '"Photo by {name}"', '"Credit: {name}"'];
  async function creditCfg() {
    const c = (await FC.meta.get('creditCfg')) || {};
    return { on: c.on !== false, every: c.every || 15, clients: c.clients || {} };
  }
  async function setCreditCfg(cfg) { await FC.meta.set('creditCfg', cfg); FC.touch('credit'); }
  async function creditState() { return (await FC.meta.get('creditState')) || { done: {}, queue: [], seen: {}, nomatch: [], log: [], found: 0, pages: 0 }; }
  async function putCreditState(s) {
    // Keep it small: pages seen in the last 60 days, the last 200 pages with no match, last 60 runs.
    const cut = Date.now() - 60 * DAY;
    for (const [u, t] of Object.entries(s.seen)) if (t < cut) delete s.seen[u];
    s.nomatch = s.nomatch.slice(-200); s.log = s.log.slice(-60); s.queue = s.queue.slice(0, 150);
    await FC.meta.set('creditState', s); FC.touch('credit');
  }
  // The wordings for one client: the ones you typed, or the three usual ones.
  function wordsFor(cfg, name) {
    const c = cfg.clients[name] || {};
    const w = (c.words && c.words.length ? c.words : DEFAULT_WORDS).map(x => String(x).replace(/\{name\}/g, name).trim()).filter(Boolean);
    return [...new Set(w)].slice(0, 8);
  }
  const clientOn = (cfg, cl) => cl.searching !== false && (cfg.clients[cl.name] || {}).on !== false;
  // The next wording that is due (each one once a week), least lately done first.
  async function nextWording(cfg, s) {
    const due = [];
    for (const cl of await FC.DB.all('clients')) {
      if (!clientOn(cfg, cl)) continue;
      for (const w of wordsFor(cfg, cl.name)) {
        const k = cl.name + '\n' + w, t = s.done[k] || 0;
        if (Date.now() - t >= WEEK) due.push({ client: cl.name, words: w, key: k, t, pri: cl.priority ? 0 : 1 });
      }
    }
    due.sort((a, b) => a.t - b.t || a.pri - b.pri);
    return due[0] || null;
  }
  // The text search engines (Ben, 2026-11-25: Google and Bing; a link both find is read once).
  const ENGINES = ['google', 'bing'];
  const ENG_NAME = { google: 'Google', bing: 'Bing' };
  // Each engine's address for a text search (newer than a month after the first search). Tests point it at a local page.
  const searchUrl = (q, first, eng) => (globalThis.PP_CREDIT_URL || ((q2, f, e) => e === 'bing'
    ? 'https://www.bing.com/search?q=' + encodeURIComponent(q2) + (f ? '' : '&filters=ex1%3a%22ez3%22')
    : 'https://www.google.com/search?q=' + encodeURIComponent(q2) + (f ? '' : '&tbs=qdr:m')))(q, first, eng);
  // Runs INSIDE the search tab: the result links, or a robot check.
  function readResultsInTab(eng) {
    const body = (document.body ? document.body.innerText : '').slice(0, 4000);
    if (/\/sorry\/|\/challenge/.test(location.pathname) || /unusual traffic|not a robot|captcha|verify you are (a )?human/i.test(body) || document.querySelector('form#captcha-form, #recaptcha, iframe[src*="recaptcha"], iframe[src*="challenges.cloudflare"], #b_captcha')) return { robot: true };
    const out = [];
    const push = (u, title) => {
      if (!u || !/^https?:/.test(u) || out.some(x => x.url === u)) return;
      try { if (/(^|\.)(google|bing|microsoft|msn)\./.test(new URL(u).hostname)) return; } catch (e) { return; }
      out.push({ url: u, title: String(title || '').trim().slice(0, 160) });
    };
    // Bing wraps links in bing.com/ck/a?...&u=a1<base64>; the real address is inside.
    const unwrap = u => {
      try {
        const x = new URL(u);
        if (/bing\.com$/.test(x.hostname) && x.pathname.startsWith('/ck/')) {
          const v = (x.searchParams.get('u') || '').replace(/^a1/, '').replace(/-/g, '+').replace(/_/g, '/');
          return atob(v + '==='.slice((v.length + 3) % 4));
        }
      } catch (e) { /* keep it */ }
      return u;
    };
    if (eng === 'bing') for (const a of document.querySelectorAll('#b_results li.b_algo h2 a, li.b_algo h2 a')) { push(unwrap(a.href), a.textContent); if (out.length >= 20) break; }
    else for (const h of document.querySelectorAll('#search a h3, #rso a h3, a h3')) { const a = h.closest('a'); push(a && a.href, h.textContent); if (out.length >= 20) break; }
    return { links: out };
  }
  async function engineResting(eng) {
    const r = (await api.storage.local.get('fcRest').catch(() => ({}))).fcRest || {};
    return (r[eng] || 0) > Date.now();
  }
  // Every engine resting after a robot check: nothing to search with.
  async function allResting() { for (const e of ENGINES) if (!(await engineResting(e))) return false; return true; }
  async function restEngine(eng) {
    const r = (await api.storage.local.get('fcRest').catch(() => ({}))).fcRest || {};
    r[eng] = Date.now() + 3600000;
    await api.storage.local.set({ fcRest: r });
    stat('credit.robot'); stat('credit.robot.' + eng);
  }
  // A link the same page under two spellings: compare without #, tracking bits and the end slash.
  const linkKey = u => { try { const x = new URL(u); x.hash = ''; for (const k of [...x.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ocid|msclkid)/i.test(k)) x.searchParams.delete(k); return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '') + (x.search || '')).toLowerCase(); } catch (e) { return u; } };
  async function readEngine(eng, words, first) {
    let tab, res = null;
    try {
      tab = await PP_SOCIAL.openQuiet(searchUrl(words, first, eng));
      await new Promise(r => setTimeout(r, 1200));
      const [r] = await api.scripting.executeScript({ target: { tabId: tab.id }, func: readResultsInTab, args: [eng] });
      res = r && r.result;
    } catch (e) { res = null; } finally { if (tab) PP_SOCIAL.closeQuiet(tab); }
    return res;
  }
  // One wording on Google and Bing: the links go on the queue of pages to read, each page once.
  async function creditSearch(w, s) {
    if (typeof PP_SOCIAL === 'undefined' || !PP_SOCIAL.openQuiet || !api.scripting) return { why: 'no tabs here' };
    const first = !s.done[w.key];
    const by = new Map(), per = {}, used = [];
    let robots = 0, unread = 0;
    for (const eng of ENGINES) {
      if (await engineResting(eng)) continue;
      used.push(eng);
      const res = await readEngine(eng, w.words, first);
      if (!res) { unread++; stat('credit.fail.' + eng); continue; }
      if (res.robot) { robots++; await restEngine(eng); continue; }
      per[eng] = (res.links || []).length;
      stat('credit.search.' + eng); stat('credit.links.' + eng, per[eng]);
      for (const l of res.links || []) {
        const k = linkKey(l.url);
        const had = by.get(k);
        if (had) { if (!had.engines.includes(eng)) had.engines.push(eng); } else by.set(k, { ...l, engines: [eng] });
      }
    }
    if (!used.length || robots + unread === used.length) {
      if (robots) return { robot: true, why: robots === used.length ? '' : 'the search sites could not be read' };
      return { why: used.length ? 'the search sites could not be read' : 'every search site is resting after a robot check' };
    }
    if (typeof RS_LISTS !== 'undefined' && Date.now() - LISTS_AT > 10 * 60000) { try { await RS_LISTS.load(); LISTS_AT = Date.now(); } catch (e) { /* use what is loaded */ } }
    const cl = await FC.DB.get('clients', w.client);
    const licensed = (cl && cl.licensed) || [];
    const own = ((typeof FC_RULES !== 'undefined' ? await FC_RULES.ownSites() : {})[w.client]) || [];
    const seenKeys = new Set([...Object.keys(s.seen).map(linkKey), ...s.queue.map(q => linkKey(q.url))]);
    let added = 0, both = 0;
    for (const l of by.values()) {
      if (l.engines.length > 1) both++;
      const site = hostOf(l.url);
      if (!site || seenKeys.has(linkKey(l.url))) continue;
      const base = FC.baseOf(site);
      if (skipSite(site, l.url) || licensed.some(x => FC.baseOf(x) === base) || own.some(x => FC.baseOf(x) === base)) continue;
      s.queue.push({ url: l.url, title: l.title, client: w.client, words: w.words, engines: l.engines }); added++;
      seenKeys.add(linkKey(l.url));
    }
    s.done[w.key] = Date.now();
    s.log.push({ at: new Date().toISOString(), client: w.client, words: w.words, links: by.size, added, per, both });
    stat('credit.search'); if (both) stat('credit.links.both', both);
    return { added, links: by.size, per, both, robot: robots > 0 };
  }
  // One page from the queue: its pictures compared with that client's photos.
  async function creditPage(q, s) {
    s.seen[q.url] = Date.now(); s.pages = (s.pages || 0) + 1;
    stat('credit.page');
    let html;
    try { html = await get(q.url, 'text', 15000); } catch (e) { stat('credit.pageFail'); return 'fail'; }
    const list = await looks();
    const pics = FC_RULES.pagePics(html, q.url).slice(0, 8);
    let found = 0, known = 0;
    for (const { img } of pics) {
      const r = await checkPic(img, list, q.client);
      stat('credit.pic');
      if (!r.hit) continue;
      if (await FC_RULES.addFound(r.hit.photo, q.url, img, hostOf(q.url), r.hit.dist, { by: 'a credit search for ' + q.words, tag: { via: 'credit' } })) { found++; break; }
      known++;   // their photo is there, but this copy was already in Copies found
    }
    if (found) { s.found = (s.found || 0) + 1; stat('credit.found'); return 'found'; }
    if (known) { stat('credit.known'); return 'known'; }
    stat('credit.none');
    {
      const t = /<title[^>]*>([^<]{1,200})/i.exec(html);
      s.nomatch.push({ url: q.url, title: (q.title || (t && t[1]) || '').trim(), client: q.client, words: q.words, at: new Date().toISOString(), pics: pics.length });
      return 'none';
    }
  }
  // One small step: a page from the queue, else (every `every` minutes) one Google search.
  async function creditStep(opts = {}) {
    const cfg = await creditCfg();
    if (!cfg.on && !opts.force) return false;
    if (!opts.force && await runActive()) return false;   // a "Search now" is running on the Credit search page
    const s = await creditState();
    if (s.queue.length) { const q = s.queue.shift(); await putCreditState(s); await creditPage(q, s); await putCreditState(s); return true; }
    if (!opts.force && Date.now() - (s.lastSearch || 0) < cfg.every * 60000) return false;
    if (await allResting()) return false;
    const w = opts.words ? { client: opts.client, words: opts.words, key: opts.client + '\n' + opts.words } : await nextWording(cfg, s);
    if (!w) return false;
    s.lastSearch = Date.now();
    const r = await creditSearch(w, s);
    await putCreditState(s);
    return !!r;
  }
  // "Search now" (Ben, 2026-11-25): runs right there on the Credit search page, with its own progress,
  // not in the Keep searching tab. Every wording of that client is searched, then every page it listed
  // is read. Keep searching's own credit steps wait while it runs (a shared note with a heartbeat).
  const RUN_KEY = 'fcCreditRun';
  async function runActive() {
    const r = (await api.storage.local.get(RUN_KEY).catch(() => ({})))[RUN_KEY];
    return !!(r && !r.end && Date.now() - (r.beat || 0) < 90000);
  }
  async function runInfo() { return (await api.storage.local.get(RUN_KEY).catch(() => ({})))[RUN_KEY] || null; }
  let RUN = null;
  async function creditRun(client) {
    if (RUN && !RUN.end) return RUN;
    if (await runActive()) return null;
    const cfg = await creditCfg();
    const words = wordsFor(cfg, client);
    stat('credit.now');
    const r = RUN = { client, start: Date.now(), beat: Date.now(), phase: 'search', words: words.length, wDone: 0, now: '', links: 0, pages: 0, read: 0, found: 0, known: 0, failed: 0, nomatch: 0, per: {}, both: 0, end: 0, why: '' };
    const save = async () => { r.beat = Date.now(); await api.storage.local.set({ [RUN_KEY]: { ...r } }).catch(() => {}); };
    await save();
    const tick = setInterval(save, 20000);
    try {
      for (const w of words) {
        if (typeof PP_SOCIAL !== 'undefined' && PP_SOCIAL.halt && PP_SOCIAL.halt.on && !(await api.storage.local.get('fcPause')).fcPause) PP_SOCIAL.halt.on = false;
        if (await allResting()) { r.why = 'robot'; break; }
        r.now = w; await save();
        const st = await creditState();
        const res = await creditSearch({ client, words: w, key: client + '\n' + w }, st);
        await putCreditState(st);
        r.wDone++;
        if (res && res.robot && !res.links) { r.why = 'robot'; break; }
        if (res && res.robot) r.robotOne = true;
        if (res && res.why) { r.why = res.why; }
        if (res && res.per) for (const [e, n] of Object.entries(res.per)) r.per[e] = (r.per[e] || 0) + n;
        r.both += (res && res.both) || 0;
        r.links += (res && res.links) || 0;
        r.pages += (res && res.added) || 0;
        await save();
      }
      r.phase = 'read'; r.now = ''; await save();
      for (;;) {
        const st = await creditState();
        const i = st.queue.findIndex(q => q.client === client);
        if (i < 0) break;
        const [q] = st.queue.splice(i, 1);
        await putCreditState(st);
        r.now = q.url; await save();
        const how = await creditPage(q, st);
        await putCreditState(st);
        r.read++;
        if (how === 'found') r.found++; else if (how === 'known') r.known = (r.known || 0) + 1; else if (how === 'none') r.nomatch++; else r.failed = (r.failed || 0) + 1;
        if (r.read > r.pages) r.pages = r.read;
        await save();
      }
    } catch (e) { r.why = r.why || String(e && e.message || e); }
    finally { clearInterval(tick); PP_STATS_T('credit.step', r.start); r.phase = 'done'; r.now = ''; r.end = Date.now(); await save(); }
    return r;
  }

  // Older "next in line" form (kept for the Keep searching tab): that client's wordings are due straight away.
  async function creditNow(client) {
    const s = await creditState(), cfg = await creditCfg();
    for (const w of wordsFor(cfg, client)) delete s.done[client + '\n' + w];
    s.lastSearch = 0;
    await putCreditState(s);
  }

  // ================================================================ 2. Watch list
  const MIN_STOLEN = 2, PER_CHECK = 30, SEEN_MAX = 500;
  async function watchState() { return (await FC.meta.get('watch')) || { items: {} }; }
  async function putWatch(w) { await FC.meta.set('watch', w); FC.touch('watch'); }
  // Sites and accounts with 2 or more Stolen copies, plus the ones you added by hand.
  async function watchList(copies) {
    const w = await watchState();
    const auto = new Map();
    for (const c of copies || await FC.allCopies()) {
      if (c.status !== 'stolen') continue;
      const soc = typeof PP_SOCIAL !== 'undefined' && PP_SOCIAL.isSocial(c.site);
      if (soc && !(c.acct && c.acct.key && c.acct.url)) continue;
      const key = soc ? 'a:' + c.acct.key : 's:' + FC.baseOf(c.site);
      const e = auto.get(key) || { key, kind: soc ? 'acct' : 'site', base: soc ? '' : FC.baseOf(c.site), url: soc ? c.acct.url : 'https://' + FC.baseOf(c.site), label: soc ? (c.acct.handle || c.acct.key) : FC.baseOf(c.site), plat: soc ? (PP_SOCIAL.platform(c.site) || {}).name || '' : '', stolen: 0 };
      e.stolen++; auto.set(key, e);
    }
    const out = [];
    for (const e of auto.values()) if (e.stolen >= MIN_STOLEN) out.push({ ...e, by: 'auto', ...(w.items[e.key] || {}), stolen: e.stolen });
    for (const it of Object.values(w.items)) if (it.by === 'hand' && !out.some(o => o.key === it.key)) out.push({ stolen: 0, ...(auto.get(it.key) || {}), ...it });
    return out.sort((a, b) => (a.off ? 1 : 0) - (b.off ? 1 : 0) || b.stolen - a.stolen || a.label.localeCompare(b.label));
  }
  async function saveItem(it) {
    const w = await watchState();
    const keep = ['key', 'kind', 'base', 'url', 'label', 'plat', 'by', 'off', 'last', 'seen', 'checks', 'found', 'feed', 'pend', 'newPosts', 'err', 'due'];
    w.items[it.key] = Object.fromEntries(keep.filter(k => it[k] !== undefined).map(k => [k, it[k]]));
    await putWatch(w);
  }
  async function watchAdd(text) {
    const t = String(text || '').trim();
    if (!t) return null;
    let u; try { u = new URL(/^https?:/i.test(t) ? t : 'https://' + t); } catch (e) { return null; }
    const site = u.hostname.replace(/^www\./, '');
    if (!site.includes('.')) return null;
    const soc = typeof PP_SOCIAL !== 'undefined' && PP_SOCIAL.isSocial(site);
    const acct = soc ? PP_SOCIAL.fromUrl(u.href) : null;
    if (soc && !acct) return null;
    const it = soc ? { key: 'a:' + acct.key, kind: 'acct', url: acct.url || u.href, label: acct.handle || acct.key, plat: (PP_SOCIAL.platform(site) || {}).name || '', by: 'hand' }
      : { key: 's:' + FC.baseOf(site), kind: 'site', base: FC.baseOf(site), url: 'https://' + FC.baseOf(site), label: FC.baseOf(site), by: 'hand' };
    const w = await watchState();
    if (w.items[it.key]) { w.items[it.key].off = false; await putWatch(w); return w.items[it.key]; }
    await saveItem(it);
    return it;
  }
  async function watchOff(key, off) {
    const it = (await watchList()).find(x => x.key === key) || (await watchState()).items[key];
    if (it) await saveItem({ ...it, off: !!off });
  }
  async function watchNow(key) { const it = (await watchList()).find(x => x.key === key); if (it) await saveItem({ ...it, due: true }); }
  async function watchDrop(key) { const w = await watchState(); delete w.items[key]; await putWatch(w); }

  // A site's news feed: from its home page, else the usual addresses.
  const FEEDS = ['/feed/', '/rss', '/feed.xml', '/rss.xml', '/atom.xml', '/index.xml'];
  async function findFeed(home) {
    try {
      const html = await get(home + '/', 'text', 12000);
      const m = /<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]*>/i.exec(html);
      if (m) { const h = /href=["']([^"']+)/i.exec(m[0]); if (h) return new URL(h[1].replace(/&amp;/g, '&'), home + '/').href; }
    } catch (e) { /* no home page */ }
    for (const p of FEEDS) {
      try { const x = await get(home + p, 'text', 8000); if (/<(rss|feed|rdf:RDF)[\s>]/i.test(x)) return home + p; } catch (e) { /* next */ }
    }
    return 'sitemap';
  }
  // Reads an RSS or Atom feed: each post's address and the pictures it names.
  function readFeed(xml, base) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const els = (root, n) => [...root.getElementsByTagName('*')].filter(e => e.localName === n);
    const out = [];
    for (const it of [...els(doc, 'item'), ...els(doc, 'entry')]) {
      const ln = els(it, 'link')[0];
      const link = ln ? (ln.getAttribute('href') || ln.textContent || '').trim() : '';
      if (!/^https?:/.test(link)) continue;
      const pics = new Set();
      for (const e of [...els(it, 'content'), ...els(it, 'thumbnail'), ...els(it, 'enclosure')]) {
        const u = e.getAttribute('url'); const ty = e.getAttribute('type') || e.getAttribute('medium') || 'image';
        if (u && /image/i.test(ty)) pics.add(u);
      }
      for (const e of [...els(it, 'description'), ...els(it, 'encoded'), ...els(it, 'summary'), ...els(it, 'content')]) {
        for (const m of (e.textContent || '').matchAll(/<img[^>]+src=["']([^"']+)/gi)) pics.add(m[1].replace(/&amp;/g, '&'));
      }
      out.push({ page: link, imgs: [...pics].map(u => { try { return new URL(u, base).href; } catch (e) { return ''; } }).filter(Boolean).slice(0, 6) });
    }
    return out;
  }
  // The newest pages from the site's sitemaps (when it has no feed).
  async function sitemapPages(home) {
    let maps = [];
    try { const r = await get(home + '/robots.txt', 'text', 8000); maps = [...r.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map(m => m[1]); } catch (e) { /* none */ }
    if (!maps.length) maps = [home + '/news-sitemap.xml', home + '/sitemap.xml'];
    const pages = [];
    for (let i = 0; i < 6 && maps.length; i++) {
      // A sitemap index: the LAST sitemaps it lists are usually the newest.
      try {
        const r = FC_RULES.readMap(await get(maps.shift(), 'text', 12000));
        if (r.maps.length) maps.unshift(...r.maps.slice(-2).reverse());
        for (const p of r.pics) { const e = pages.find(x => x.page === p.page); if (e) e.imgs.push(p.img); else pages.push({ page: p.page, imgs: [p.img] }); }
        for (const p of r.pages) pages.push({ page: p, imgs: [] });
        if (pages.length >= PER_CHECK * 2) break;
      } catch (e) { /* next */ }
    }
    return pages.slice(-PER_CHECK * 2).reverse();
  }
  // A social account's newest posts, read in a quiet pinned tab of your browser.
  async function accountPosts(it) {
    if (typeof PP_REPOST === 'undefined' || typeof PP_SOCIAL === 'undefined' || !api.scripting) return null;
    let tab, res = null;
    try {
      tab = await PP_SOCIAL.openQuiet(it.url);
      await new Promise(r => setTimeout(r, 2500));
      const [r] = await api.scripting.executeScript({ target: { tabId: tab.id }, func: PP_REPOST.scanInTab, args: [{ screens: 4, want: [] }] });
      res = r && r.result;
    } catch (e) { res = null; } finally { if (tab) PP_SOCIAL.closeQuiet(tab); }
    if (!res || (res.wall && !(res.items || []).length)) return { wall: true, posts: [] };
    const p = PP_REPOST.plat(hostOf(it.url));
    const own = PP_SOCIAL.fromUrl(it.url);
    return { posts: (res.items || []).map(item => ({ page: PP_REPOST.postUrlOf(p, item, own, null) || '', imgs: item.imgs.map(i => i.src).filter(u => /^https?:/.test(u)).slice(0, 6) })).filter(x => x.imgs.length) };
  }
  const postKey = p => p.page || (p.imgs[0] || '').split('?')[0];
  // One small step: the next watched site or account that is due, a few posts at a time.
  async function watchStep(opts = {}) {
    const items = (await watchList()).filter(x => !x.off);
    let it = items.find(x => x.pend && x.pend.length) || items.find(x => x.due) || items.filter(x => Date.now() - Date.parse(x.last || 0) >= WEEK).sort((a, b) => Date.parse(a.last || 0) - Date.parse(b.last || 0))[0];
    if (!it) return false;
    it = { ...it, seen: it.seen || [] };
    const t0 = Date.now();
    // Start of a check: the new posts since last time.
    if (!it.pend || !it.pend.length) {
      let posts = [];
      if (it.kind === 'acct') {
        const r = await accountPosts(it);
        if (!r) return false;
        if (r.wall) { stat('watch.wall'); it.err = 'asked to log in'; it.last = new Date().toISOString(); it.due = false; await saveItem(it); return true; }
        posts = r.posts;
      } else {
        const home = (globalThis.PP_WATCH_HOME || (b => 'https://' + b))(it.base);   // tests point it at a local server
        if (!it.feed) it.feed = await findFeed(home);
        if (it.feed !== 'sitemap') { try { posts = readFeed(await get(it.feed, 'text', 15000), home); } catch (e) { it.feed = ''; } }
        if (!posts.length) posts = await sitemapPages(home);
      }
      const seen = new Set(it.seen);
      const fresh = posts.filter(p => postKey(p) && !seen.has(postKey(p))).slice(0, PER_CHECK);
      it.pend = fresh; it.newPosts = fresh.length; it.err = posts.length ? '' : 'no posts found';
      it.seen = [...it.seen, ...fresh.map(postKey)].slice(-SEEN_MAX);
      it.checks = (it.checks || 0) + 1; it.due = false;
      if (!fresh.length) it.last = new Date().toISOString();
      await saveItem(it);
      stat('watch.check');
      return true;
    }
    // Then the pictures of those posts, about 15 seconds at a time.
    const list = await looks();
    while (it.pend.length && Date.now() - t0 < 15000) {
      const p = it.pend.shift();
      stat('watch.post');
      let imgs = p.imgs || [];
      if (!imgs.length && p.page && it.kind === 'site') { try { imgs = FC_RULES.pagePics(await get(p.page, 'text', 12000), p.page).map(x => x.img); } catch (e) { imgs = []; } }
      for (const img of imgs.slice(0, 6)) {
        const r = await checkPic(img, list, '');
        stat('watch.pic');
        if (r.hit && await FC_RULES.addFound(r.hit.photo, p.page || it.url, img, hostOf(p.page || it.url) || it.base, r.hit.dist, { by: 'the watch list (' + it.label + ')', tag: { via: 'watch' } })) { it.found = (it.found || 0) + 1; stat('watch.found'); break; }
        if (!opts.fast) await new Promise(r2 => setTimeout(r2, 800));
      }
    }
    if (!it.pend.length) it.last = new Date().toISOString();
    await saveItem(it);
    return true;
  }

  // Runs from Keep searching's housekeeping (only while it is on and in your hours).
  let busy = false;
  async function step() {
    if (busy) return false;
    busy = true;
    try {
      let t = Date.now();
      const a = await creditStep().catch(e => { console.warn('PageProof credit search:', e); return false; });
      if (a) PP_STATS_T('credit.step', t);
      t = Date.now();
      const b = await watchStep().catch(e => { console.warn('PageProof watch list:', e); return false; });
      if (b) PP_STATS_T('watch.step', t);
      return a || b;
    } finally { busy = false; }
  }

  return { DEFAULT_WORDS, ENGINES, ENG_NAME, creditRun, runInfo, runActive, live: () => RUN, creditCfg, setCreditCfg, creditState, wordsFor, creditStep, creditNow, readResultsInTab, readFeed, findFeed, watchList, watchAdd, watchOff, watchNow, watchDrop, watchStep, step, nearest, looks, dropLooks: () => { LOOKS = null; } };
})();
if (typeof module !== 'undefined') module.exports = PP_WATCH;
