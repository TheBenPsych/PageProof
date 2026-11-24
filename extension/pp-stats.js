// How PageProof is doing (Settings › How PageProof is doing): a day-by-day record of what
// PageProof did on this computer. Every page that searches, checks or reads Google Drive adds
// to it with a few small calls:
//   PP_STATS.add('eng.google.n')          count something (by 1, or by n)
//   PP_STATS.time('chk.same', 340)        how long something took (ms)
//   PP_STATS.max('mem.page', 610)         the highest value of the day
//   PP_STATS.site('example.com', 'f')     a website that failed (f), was too slow (s) or blocked us (b)
//   PP_STATS.minute('running')            one minute of Keep searching in this state (runner.js)
// Numbers only: never a photo's name, a client's name, a folder or a link. Websites are kept as
// their plain name (example.com), for the "Problems by website" list.
// Stored in the browser (storage.local "ppStats"), one entry per day, the last 31 days, about
// 10 KB a day. Pages write it at most every 15 seconds, one page at a time.
const PP_STATS = (() => {
  const api = globalThis.browser || globalThis.chrome;
  const KEY = 'ppStats', KEEP = 31, SITES = 120;
  // Time buckets (ms): "usual" is worked out from these, without keeping every single time.
  const B = [50, 100, 200, 350, 500, 750, 1000, 1500, 2000, 3000, 5000, 7500, 10000, 15000, 20000, 30000, 45000, 60000, 90000, 120000, 180000, 300000, 600000, Infinity];
  const pad = n => String(n).padStart(2, '0');
  const dayKey = (d = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const blank = () => ({ c: {}, t: {}, x: {}, k: {}, s: {} });
  let buf = blank(), dirty = false, timer = null;

  const soon = () => { dirty = true; if (!timer) timer = setTimeout(() => { timer = null; flush(); }, 15000); };
  function add(k, n = 1) { if (!k || !n) return; buf.c[k] = (buf.c[k] || 0) + n; soon(); }
  function bucket(ms) { let i = 0; while (ms > B[i]) i++; return i; }
  function time(k, ms) {
    if (!k || !(ms >= 0) || ms > 864e5) return;
    const t = buf.t[k] || (buf.t[k] = { n: 0, s: 0, x: 0, h: [] });
    t.n++; t.s += Math.round(ms); t.x = Math.max(t.x, Math.round(ms));
    const b = bucket(ms); t.h[b] = (t.h[b] || 0) + 1;
    soon();
  }
  function max(k, v) { if (!k || !(v >= 0)) return; buf.x[k] = Math.max(buf.x[k] || 0, v); soon(); }
  // A website, as its plain name only (never the page or the picture address).
  function siteName(s) {
    try { s = /^https?:/i.test(s) ? new URL(s).hostname : String(s || ''); } catch (e) { return ''; }
    s = s.toLowerCase().replace(/^www\./, '');
    return /^[a-z0-9.-]{1,80}$/.test(s) && s.includes('.') ? s : '';
  }
  function site(s, kind) {
    const n = siteName(s); if (!n || !'fsb'.includes(kind)) return;
    const v = buf.s[n] || (buf.s[n] = { f: 0, s: 0, b: 0 }); v[kind]++; soon();
  }
  function minute(st, d = new Date()) {
    if (!st) return;
    const h = buf.k[d.getHours()] || (buf.k[d.getHours()] = {});
    h[st] = (h[st] || 0) + 1; soon();
  }

  function mergeInto(D, b) {
    for (const [k, n] of Object.entries(b.c)) D.c[k] = (D.c[k] || 0) + n;
    for (const [k, t] of Object.entries(b.t)) {
      const o = D.t[k] || (D.t[k] = { n: 0, s: 0, x: 0, h: [] });
      o.n += t.n; o.s += t.s; o.x = Math.max(o.x, t.x);
      t.h.forEach((v, i) => { if (v) o.h[i] = (o.h[i] || 0) + v; });
      for (let i = 0; i < o.h.length; i++) if (o.h[i] == null) o.h[i] = 0;
    }
    for (const [k, v] of Object.entries(b.x)) D.x[k] = Math.max(D.x[k] || 0, v);
    for (const [h, m] of Object.entries(b.k)) { const o = D.k[h] || (D.k[h] = {}); for (const [s, n] of Object.entries(m)) o[s] = (o[s] || 0) + n; }
    for (const [s, v] of Object.entries(b.s)) { const o = D.s[s] || (D.s[s] = { f: 0, s: 0, b: 0 }); o.f += v.f; o.s += v.s; o.b += v.b; }
    const names = Object.keys(D.s);
    if (names.length > SITES) {
      names.sort((a, b) => (D.s[b].f + D.s[b].s + D.s[b].b) - (D.s[a].f + D.s[a].s + D.s[a].b));
      for (const n of names.slice(SITES)) delete D.s[n];
    }
    return D;
  }
  const locked = fn => (globalThis.navigator && navigator.locks ? navigator.locks.request('pp-stats', fn) : fn());
  async function flush() {
    if (!dirty) return;
    const b = buf; buf = blank(); dirty = false;
    clearTimeout(timer); timer = null;
    try {
      await locked(async () => {
        const st = (await api.storage.local.get(KEY))[KEY] || { v: 1, days: {} };
        st.days = st.days || {};
        const day = dayKey();
        st.days[day] = mergeInto(st.days[day] || blank(), b);
        for (const k of Object.keys(st.days).sort().slice(0, -KEEP)) delete st.days[k];
        await api.storage.local.set({ [KEY]: st });
      });
    } catch (e) { /* a help page: never worth breaking a search for */ }
  }
  async function all() { await flush(); try { return (await api.storage.local.get(KEY))[KEY] || { v: 1, days: {} }; } catch (e) { return { v: 1, days: {} }; } }
  async function setMeta(name, v) {
    await locked(async () => {
      const st = (await api.storage.local.get(KEY))[KEY] || { v: 1, days: {} };
      st[name] = v; await api.storage.local.set({ [KEY]: st });
    });
  }
  // Several days added together (for 7 days / 30 days).
  function sum(days) { const D = blank(); for (const d of days) if (d) mergeInto(D, { c: d.c || {}, t: d.t || {}, x: d.x || {}, k: d.k || {}, s: d.s || {} }); return D; }
  // The usual time: the middle one (half took longer, half less), from the buckets.
  function usual(t) {
    if (!t || !t.n) return null;
    let seen = 0; const half = t.n / 2;
    for (let i = 0; i < B.length; i++) {
      const v = t.h[i] || 0;
      if (seen + v >= half) {
        const lo = i ? B[i - 1] : 0, hi = B[i] === Infinity ? Math.max(lo * 2, t.x) : B[i];
        return Math.round(Math.min(t.x, lo + (hi - lo) * ((half - seen) / Math.max(1, v))));
      }
      seen += v;
    }
    return Math.round(t.s / t.n);
  }
  const avg = t => (t && t.n ? Math.round(t.s / t.n) : null);
  // The page's own memory, once a minute (Chrome and Edge only), for "Computer strain".
  try {
    if (globalThis.performance && performance.memory && typeof setInterval === 'function') {
      setInterval(() => { try { max('mem.page', Math.round(performance.memory.usedJSHeapSize / 1048576)); } catch (e) { /* gone */ } }, 60000);
    }
  } catch (e) { /* none */ }
  try { addEventListener('pagehide', () => { flush(); }); addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); }); } catch (e) { /* worker */ }
  return { add, time, max, site, siteName, minute, flush, all, sum, usual, avg, dayKey, setMeta, B, _buf: () => buf };
})();
