// 4.58: Known bad websites. PageProof downloads a few free public lists and keeps them on this
// computer, so a copy's site is checked here, offline (no site name is sent anywhere):
//   - The Block List Project (github.com/blocklistproject/Lists): piracy, scam, fraud and
//     phishing lists, about once a week
//   - URLhaus by abuse.ch: sites spreading malware right now, about once a day
//   - OpenPhish (free feed): phishing pages right now, about once a day
// A site on one of them gets a red tag on its copies ("Known piracy site", ...) and counts as a
// Suspicious site. Big shared platforms (Blogger, Google Sites ...) are only flagged by their exact
// address, never as a whole.
const PP_BAD = (() => {
  const DAY = 864e5, RETRY = 6 * 36e5;
  const BLP = k => 'https://raw.githubusercontent.com/blocklistproject/Lists/master/alt-version/' + k + '-nl.txt';
  // bit, key, label, why
  const KIND = { piracy: [1, 'Known piracy site', 'Piracy or illegal streaming'], scam: [2, 'Known scam site', 'Scam or fraud'], phish: [4, 'Known phishing site', 'Phishing: fake log-in or bank pages'], malware: [8, 'Known malware site', 'Spreads harmful downloads'] };
  const SOURCES = [
    { id: 'blp-piracy', name: 'The Block List Project (piracy)', url: BLP('piracy'), kind: 'piracy', every: 7 * DAY, form: 'domains' },
    { id: 'blp-scam', name: 'The Block List Project (scam)', url: BLP('scam'), kind: 'scam', every: 7 * DAY, form: 'domains' },
    { id: 'blp-fraud', name: 'The Block List Project (fraud)', url: BLP('fraud'), kind: 'scam', every: 7 * DAY, form: 'domains' },
    { id: 'blp-phishing', name: 'The Block List Project (phishing)', url: BLP('phishing'), kind: 'phish', every: 7 * DAY, form: 'domains' },
    { id: 'urlhaus', name: 'URLhaus (abuse.ch)', url: 'https://urlhaus.abuse.ch/downloads/hostfile/', kind: 'malware', every: DAY, form: 'hosts', exact: true },
    { id: 'openphish', name: 'OpenPhish', url: 'https://openphish.com/feed.txt', kind: 'phish', every: DAY, form: 'urls', exact: true },
  ];

  let dbP = null;
  function db() {
    if (!dbP) dbP = new Promise((ok, no) => {
      const r = indexedDB.open('pageproof-bad', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => ok(r.result); r.onerror = () => { dbP = null; no(r.error); };
    });
    return dbP;
  }
  async function get(k) { const d = await db(); return new Promise((ok, no) => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error); }); }
  async function put(k, v) { const d = await db(); return new Promise((ok, no) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => ok(); t.onerror = () => no(t.error); }); }
  const local = () => (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) || null;
  async function info() { const s = local(); return s ? ((await s.get('ppBad').catch(() => ({}))).ppBad || {}) : {}; }
  async function setInfo(x) { const s = local(); if (s) { const i = await info(); await s.set({ ppBad: Object.assign(i, x, { src: Object.assign(i.src || {}, x.src || {}) }) }).catch(() => {}); } }

  const clean = s => String(s || '').toLowerCase().trim().replace(/^www\d?\./, '').replace(/\.$/, '');
  // Reads one downloaded list into plain site names.
  function parse(text, form) {
    const out = new Set();
    for (let line of text.split('\n')) {
      line = line.trim();
      if (!line || line[0] === '#' || line[0] === '!') continue;
      let h = '';
      if (form === 'urls') { try { h = new URL(line).hostname; } catch (e) { continue; } }
      else if (form === 'hosts') { const p = line.split(/\s+/); h = p.length > 1 ? p[1] : p[0]; }
      else h = line.split(/\s+/)[0];
      h = clean(h);
      if (h && h.includes('.') && !/^[\d.]+$/.test(h) && h !== 'localhost') out.add(h);
    }
    return [...out];
  }
  // Every list together: one A-Z block of names plus a byte saying which kinds of list each is on.
  // exact = the name only counts for that exact address (bit 16).
  function combine(parts) {
    const m = new Map();
    for (const { names, bit, exact } of parts) for (const n of names) m.set(n, (m.get(n) || 0) | bit | (exact ? 16 : 0));
    const keys = [...m.keys()].sort();
    const codes = new Uint8Array(keys.length);
    keys.forEach((k, i) => { codes[i] = m.get(k); });
    return { names: keys.join('\n'), codes: codes.buffer, n: keys.length };
  }
  let LIST = null, LIST_P = null, dropT = 0;
  function index(rec) {
    const t = rec.names, starts = new Uint32Array(rec.n + 1);
    let k = 1;
    for (let i = t.indexOf('\n'); i >= 0 && k < rec.n; i = t.indexOf('\n', i + 1)) starts[k++] = i + 1;
    starts[rec.n] = t.length + 1;
    return { t, starts, codes: new Uint8Array(rec.codes), n: rec.n };
  }
  function find(L, d) {
    let lo = 0, hi = L.n - 1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1, s = L.t.slice(L.starts[m], L.starts[m + 1] - 1);
      if (s === d) return L.codes[m];
      if (s < d) lo = m + 1; else hi = m - 1;
    }
    return 0;
  }
  async function list() {
    if (LIST) return LIST;
    if (!LIST_P) LIST_P = get('all').then(rec => (LIST = rec && rec.n ? index(rec) : null)).finally(() => { LIST_P = null; });
    return LIST_P;
  }
  // What a code means: the worst kind first.
  function meaning(code) {
    for (const k of ['malware', 'phish', 'scam', 'piracy']) if (code & KIND[k][0]) return { kind: k, label: KIND[k][1], why: KIND[k][2] };
    return null;
  }
  const baseOf = s => (typeof FC !== 'undefined' && FC.baseOf ? FC.baseOf(s) : s.split('.').slice(-2).join('.'));
  const isPlatform = s => typeof PP_POP !== 'undefined' && PP_POP.platform(s);

  // Sites already looked up (for this version of the lists), so Copies found doesn't load the big
  // list every time. MAP holds site -> code (0 = on no list).
  let MAP = {}, VER = -1;
  async function prepare(sites) {
    const i = await info();
    if (!i.ver) { MAP = {}; return; }
    if (VER !== i.ver) { const c = await get('cache').catch(() => null); MAP = c && c.ver === i.ver ? c.map : {}; VER = i.ver; }
    const miss = [...new Set(sites.map(clean))].filter(s => s && !(s in MAP));
    if (!miss.length) return;
    const L = await list().catch(() => null);
    if (!L) return;
    for (const s of miss) {
      let code = find(L, s);
      // A sub-site of a listed site counts too (pirate.example.to -> example.to), but never the
      // whole of a shared platform, and never for a list of exact addresses (URLhaus, OpenPhish).
      if (!code) { const b = baseOf(s); if (b !== s && !isPlatform(s)) { const bc = find(L, b); if (bc && !(bc & 16)) code = bc; } }
      MAP[s] = code & 15;
    }
    clearTimeout(dropT); dropT = setTimeout(() => { LIST = null; }, 60000);
    await put('cache', { ver: i.ver, map: MAP }).catch(() => {});
  }
  // { kind, label, why } for a site on a list, or null. Call prepare() with the sites first.
  // rank (from PP_POP): one of the 10,000 most visited sites is only flagged as a piracy site; a
  // big real site on a malware or phishing list was usually hacked for a day, not a bad site.
  function of(site, rank) {
    let code = MAP[clean(site)] || 0;
    if (rank && rank <= 10000) code &= 1;
    const m = meaning(code);
    if (!m) return null;
    const src = SOURCES.filter(x => code & KIND[x.kind][0]).map(x => x.name.replace(/ \(.*\)$/, ''));
    return { ...m, why: m.why + '. On the free public list' + ([...new Set(src)].length > 1 ? 's' : '') + ' from ' + [...new Set(src)].join(' and ') + '.' };
  }

  // Downloads any list that is due, then puts them all together again.
  let BUSY = null;
  function refresh(force) {
    if (BUSY) return BUSY;
    BUSY = (async () => {
      const i = await info(), src = i.src || {}, now = Date.now();
      // 4.64: a download cut off half way (an update closed the page) is tried again, not left 6 hours.
      const cut = x => x.tried && !(x.ended >= x.tried) && now - x.tried > 3 * 60000;
      const due = SOURCES.filter(s => force || !src[s.id] || (!src[s.id].at || now - src[s.id].at > s.every) && (!src[s.id].tried || now - src[s.id].tried > RETRY || cut(src[s.id])));
      if (!due.length) return { fresh: true };
      let changed = 0; const errs = [];
      for (const s of due) {
        await setInfo({ src: { [s.id]: Object.assign({}, src[s.id], { tried: Date.now() }) } });
        try {
          const r = await fetch(s.url, { credentials: 'omit', cache: 'no-store' });
          if (!r.ok) throw new Error('answered ' + r.status);
          const names = parse(await r.text(), s.form);
          if (!names.length) throw new Error('the list was empty');
          await put('src:' + s.id, names.join('\n'));
          const t = Date.now(); await setInfo({ src: { [s.id]: { at: t, tried: t, ended: t, n: names.length, err: '' } } });
          changed++;
        } catch (e) {
          errs.push(s.name + ': ' + (e && e.message || e));
          await setInfo({ src: { [s.id]: Object.assign({}, (await info()).src[s.id], { err: String(e && e.message || e), ended: Date.now() }) } });
        }
      }
      if (changed) await rebuild();
      return { n: changed, errs };
    })().finally(() => { BUSY = null; });
    return BUSY;
  }
  async function rebuild() {
    const parts = [];
    for (const s of SOURCES) {
      const t = await get('src:' + s.id).catch(() => null);
      if (t) parts.push({ names: t.split('\n'), bit: KIND[s.kind][0], exact: !!s.exact });
    }
    const rec = combine(parts);
    await put('all', rec);
    LIST = null; MAP = {}; VER = -1;
    await setInfo({ ver: Date.now(), n: rec.n, date: new Date().toISOString() });
    return rec.n;
  }
  // For tests: put lists in by hand, as { 'blp-piracy': 'text of the list', ... }.
  async function load(texts) {
    for (const s of SOURCES) if (texts[s.id] != null) {
      const names = parse(texts[s.id], s.form);
      await put('src:' + s.id, names.join('\n'));
      await setInfo({ src: { [s.id]: { at: Date.now(), tried: Date.now(), n: names.length, err: '' } } });
    }
    return rebuild();
  }
  return { prepare, of, refresh, busy: () => !!BUSY, info, load, parse, SOURCES, KIND };
})();
