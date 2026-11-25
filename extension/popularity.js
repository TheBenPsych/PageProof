// 4.58: How popular is the site a copy is on? PageProof downloads the free Tranco list
// (tranco-list.eu: the world's top 1 million websites, made from several traffic rankings) about
// once a week and keeps it on this computer. Looking a site up then happens here, offline: no
// site name is ever sent anywhere.
//
// Kept in its own small database (pageproof-pop):
//   'list'  - every ranked site, sorted A-Z, as one block of text, plus each one's rank (~18 MB)
//   'cache' - the ranks of the sites already looked up, so Copies found doesn't need the big list
//             every time (a few KB)
// Big shared platforms (social sites, free blog hosts, marketplaces) get no rank: the platform is
// huge, but the account or shop on it usually isn't.
const PP_POP = (() => {
  const URL_ZIP = 'https://tranco-list.eu/top-1m.csv.zip';
  const WEEK = 7 * 864e5, RETRY = 6 * 36e5;
  const TIERS = [[1000, '1k', 'Top 1K', 'One of the 1,000 most visited websites in the world'], [10000, '10k', 'Top 10K', 'One of the 10,000 most visited websites in the world'],
    [100000, '100k', 'Top 100K', 'One of the 100,000 most visited websites in the world'], [1000000, '1m', 'Top 1M', 'One of the 1 million most visited websites in the world']];
  const SMALL = ['small', 'Small site', 'Not in the world\'s top 1 million websites'];
  // Shared platforms: the page belongs to a user, a seller or a blogger, not the platform.
  const PLATFORM = /(^|\.)(wordpress\.com|blogspot\.[a-z.]+|blogger\.com|tumblr\.com|medium\.com|substack\.com|wixsite\.com|weebly\.com|github\.io|netlify\.app|vercel\.app|pages\.dev|squarespace\.com|webflow\.io|jimdofree\.com|jimdosite\.com|over-blog\.com|livejournal\.com|ghost\.io|typepad\.com|[a-z]+\.blog|sites\.google\.com|etsy\.com|ebay\.[a-z.]+|amazon\.[a-z.]+|aliexpress\.[a-z.]+|alibaba\.com|redbubble\.com|teepublic\.com|zazzle\.[a-z.]+|society6\.com|spreadshirt\.[a-z.]+|cafepress\.com|walmart\.com|temu\.com|shein\.com|wish\.com|mercari\.com|poshmark\.com|depop\.com|vinted\.[a-z.]+|deviantart\.com|behance\.net|flickr\.com|imgur\.com|500px\.com|issuu\.com|scribd\.com|slideshare\.net|quora\.com|patreon\.com|onlyfans\.com|linktr\.ee|carrd\.co|canva\.site|myshopify\.com)$/;
  const SOCIAL = /(^|\.)(facebook|fb|instagram|twitter|x|threads|tiktok|pinterest|reddit|tumblr|linkedin|vk|weibo|youtube|flickr|snapchat|telegram|t|bsky|mastodon)\.(com|net|me|org|ru|app|social)$/;

  // ------------------------------------------------------------ the little database
  let dbP = null;
  function db() {
    if (!dbP) dbP = new Promise((ok, no) => {
      const r = indexedDB.open('pageproof-pop', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => ok(r.result); r.onerror = () => { dbP = null; no(r.error); };
    });
    return dbP;
  }
  async function get(k) { const d = await db(); return new Promise((ok, no) => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error); }); }
  async function put(k, v) { const d = await db(); return new Promise((ok, no) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => ok(); t.onerror = () => no(t.error); }); }
  const local = () => (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) || null;
  async function info() { const s = local(); return s ? ((await s.get('ppPop').catch(() => ({}))).ppPop || {}) : {}; }
  async function setInfo(x) { const s = local(); if (s) await s.set({ ppPop: Object.assign(await info(), x) }).catch(() => {}); }

  // ------------------------------------------------------------ reading the list
  // The CSV is "rank,domain" a line. Kept sorted A-Z so a site is found by halving (no 1M-entry Map).
  function build(csv) {
    const rows = [];
    for (const line of csv.split('\n')) {
      const i = line.indexOf(','); if (i < 1) continue;
      const r = parseInt(line.slice(0, i), 10), d = line.slice(i + 1).trim().toLowerCase();
      if (r > 0 && d) rows.push([d, r]);
    }
    rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    const ranks = new Uint32Array(rows.length);
    rows.forEach((x, i) => { ranks[i] = x[1]; });
    return { names: rows.map(x => x[0]).join('\n'), ranks: ranks.buffer, n: rows.length };
  }
  let LIST = null, LIST_P = null;
  function index(rec) {
    const t = rec.names, starts = new Uint32Array(rec.n + 1);
    let k = 0; starts[k++] = 0;
    for (let i = t.indexOf('\n'); i >= 0 && k <= rec.n; i = t.indexOf('\n', i + 1)) starts[k++] = i + 1;
    starts[rec.n] = t.length + 1;
    return { t, starts, ranks: new Uint32Array(rec.ranks), n: rec.n };
  }
  function find(L, d) {
    let lo = 0, hi = L.n - 1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1, s = L.t.slice(L.starts[m], L.starts[m + 1] - 1);
      if (s === d) return L.ranks[m];
      if (s < d) lo = m + 1; else hi = m - 1;
    }
    return 0;
  }
  async function list() {
    if (LIST) return LIST;
    if (!LIST_P) LIST_P = get('list').then(rec => (LIST = rec && rec.n ? index(rec) : null)).finally(() => { LIST_P = null; });
    return LIST_P;
  }
  // The big list is let go a minute after the last look-up, so it doesn't sit in memory.
  let dropT = 0;
  const later = () => { clearTimeout(dropT); dropT = setTimeout(() => { LIST = null; }, 60000); };

  // ------------------------------------------------------------ the public part
  const clean = s => String(s || '').toLowerCase().replace(/^www\d?\./, '').replace(/\.$/, '');
  const baseOf = s => (typeof FC !== 'undefined' && FC.baseOf ? FC.baseOf(s) : s.split('.').slice(/\.(co|com|net|org|gov|edu|ac|ltd|plc|me|or|ne|go)\.[a-z]{2}$/.test(s) ? -3 : -2).join('.'));
  function platform(site) {
    const s = clean(site);
    return PLATFORM.test(s) || SOCIAL.test(s) || (typeof PP_SOCIAL !== 'undefined' && PP_SOCIAL.isSocial && PP_SOCIAL.isSocial(s));
  }
  let CACHE = null;
  async function cache() {
    if (CACHE) return CACHE;
    const [c, i] = [await get('cache').catch(() => null), await info()];
    CACHE = c && c.date === i.date ? c : { date: i.date || '', map: {} };
    return CACHE;
  }
  // site -> rank (1 = most visited; 0 = not in the top 1 million). Sites on a shared platform and
  // every site while no list was downloaded yet are left out of the answer.
  async function ranks(sites) {
    const out = new Map(), i = await info();
    if (!i.date) return out;
    const C = await cache(), miss = [];
    for (const raw of new Set(sites)) {
      const s = clean(raw); if (!s || platform(s)) continue;
      if (s in C.map) out.set(raw, C.map[s]); else miss.push([raw, s]);
    }
    if (miss.length) {
      const L = await list().catch(() => null);
      if (L) {
        for (const [raw, s] of miss) {
          // The list holds a site's main name (example.co.uk). A sub-site counts as its main site,
          // unless the sub-site is ranked itself (news.example.com).
          const r = find(L, s) || (baseOf(s) !== s ? find(L, baseOf(s)) : 0);
          C.map[s] = r; out.set(raw, r);
        }
        later();
        await put('cache', C).catch(() => {});
      }
    }
    return out;
  }
  function tier(rank) {
    if (rank == null) return null;
    if (!rank) return { key: SMALL[0], label: SMALL[1], why: SMALL[2], rank: 0 };
    const t = TIERS.find(x => rank <= x[0]);
    return t ? { key: t[1], label: t[2], why: t[3] + ' (number ' + rank.toLocaleString() + ').', rank } : { key: SMALL[0], label: SMALL[1], why: SMALL[2], rank: 0 };
  }
  // How many 'big' it is, for sorting and the filter: 1K=4, 10K=3, 100K=2, 1M=1, small=0, none=-1.
  const level = rank => rank == null ? -1 : !rank ? 0 : rank <= 1000 ? 4 : rank <= 10000 ? 3 : rank <= 100000 ? 2 : rank <= 1000000 ? 1 : 0;
  async function save(csv, date) {
    const rec = build(csv);
    if (rec.n < 1000) throw new Error('The list looked empty.');
    await put('list', rec);
    LIST = null; CACHE = { date, map: {} };
    await put('cache', CACHE).catch(() => {});
    const t = Date.now(); await setInfo({ date, n: rec.n, tried: t, ended: t, err: '' });
    return rec.n;
  }
  // Downloads the newest list, if the one here is a week old (or there is none). force = now.
  let BUSY = null;
  function refresh(force) {
    if (BUSY) return BUSY;
    BUSY = (async () => {
      const i = await info();
      if (!force && i.date && Date.now() - Date.parse(i.date) < WEEK) return { fresh: true };
      // 4.61: a download cut off half way (an update closed the page) is tried again, not left 6 hours.
      const cut = i.tried && !(i.ended >= i.tried) && Date.now() - i.tried > 3 * 60000;
      if (!force && i.tried && Date.now() - i.tried < RETRY && !cut) return { waiting: true };
      await setInfo({ tried: Date.now() });
      try {
        const r = await fetch(URL_ZIP, { credentials: 'omit', cache: 'no-store' });
        if (!r.ok) throw new Error('The list site answered ' + r.status + '.');
        const files = await ppUnzip(new Uint8Array(await r.arrayBuffer()));
        const csv = [...files.entries()].find(([n]) => /\.csv$/i.test(n));
        if (!csv) throw new Error('No list inside the download.');
        const n = await save(new TextDecoder().decode(csv[1]), new Date().toISOString());
        return { n };
      } catch (e) {
        await setInfo({ err: String(e && e.message || e), ended: Date.now() });
        return { err: String(e && e.message || e) };
      }
    })().finally(() => { BUSY = null; });
    return BUSY;
  }
  const busy = () => !!BUSY;
  return { ranks, tier, level, platform, refresh, busy, info, save, build, TIERS, SMALL, URL_ZIP };
})();
