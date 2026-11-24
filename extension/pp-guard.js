// Safety nets that every PageProof page (and the background) loads first (4.39, Ben's picks):
//  1. Room to grow: asks the browser to keep PageProof's data ("persist"), and notices when a
//     save to the browser's storage fails. Most saves ignore their errors, so before this a full
//     storage meant changes quietly stopped saving. The last failure is kept (outside that
//     storage, so it can be written even when the storage is full) and shown on Home and on
//     Is everything working.
//  2. Error diary: problems PageProof handles quietly (warnings, errors, crashes in a page) are
//     counted by where they happened, with the first message and time, for "Save stats for
//     Claude". Messages are cleaned first: links, folder paths and anything in quotes are taken
//     out, so no client name, photo name or link is kept.
// Stored in its own small database (IndexedDB "pp-guard"), 14 days, at most 60 places a day.
const PP_GUARD = (() => {
  const api = globalThis.browser || globalThis.chrome;
  const DAYS = 14, PLACES = 60;
  const pad = n => String(n).padStart(2, '0');
  const dayKey = (d = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

  // ---------------------------------------------------------------- tiny store
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      try {
        const r = indexedDB.open('pp-guard', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    });
    dbp.catch(() => { dbp = null; });
    return dbp;
  }
  async function get(k) {
    try { const d = await db(); return await new Promise(res => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); }); } catch (e) { return undefined; }
  }
  async function put(k, v) {
    try { const d = await db(); await new Promise(res => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = res; t.onabort = res; }); } catch (e) { /* nothing more we can do */ }
  }

  // ---------------------------------------------------------------- cleaning messages
  function clean(s) {
    return String(s == null ? '' : s)
      .replace(/(?:https?|chrome-extension|moz-extension|file|blob|data):[^\s'")\]]*/gi, '<link>')
      .replace(/[A-Za-z]:\\[^\n'"]*/g, '<path>')
      .replace(/\/\/[^\s'"]+/g, '<link>')
      .replace(/"[^"]{1,200}"|'[^']{1,200}'|“[^”]{1,200}”/g, '<…>')
      .replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, '<email>')
      .replace(/\s+/g, ' ').trim().slice(0, 160);
  }
  // Where it happened: the text before the first ":" ("PageProof Keep searching: …"), else the
  // first few words, without anything that could be a name.
  function placeOf(first) {
    let p = String(first == null ? '' : first);
    const i = p.indexOf(':');
    if (i > 0 && i < 60) p = p.slice(0, i);
    else p = p.split(/\s+/).slice(0, 5).join(' ');
    return clean(p).replace(/<[^>]*>/g, '').trim().slice(0, 60) || 'Unnamed';
  }
  const text = a => (a && a.message) ? a.name + ': ' + a.message : typeof a === 'object' ? (() => { try { return JSON.stringify(a).slice(0, 200); } catch (e) { return String(a); } })() : String(a);

  // ---------------------------------------------------------------- the diary
  let buf = {}, timer = null;
  function note(place, msg, kind = 'warn') {
    try {
      const k = String(place || 'Unnamed').slice(0, 60);
      const e = buf[k] || (buf[k] = { n: 0, first: Date.now(), msg: clean(msg), kind });
      e.n++;
      if (kind === 'error') e.kind = 'error';
      if (!timer) timer = setTimeout(flush, 20000);
    } catch (e) { /* never let the diary break anything */ }
  }
  async function flush() {
    timer = null;
    const b = buf; buf = {};
    if (!Object.keys(b).length) return;
    const lock = fn => (globalThis.navigator && navigator.locks ? navigator.locks.request('pp-guard', fn) : fn());
    await lock(async () => {
      const all = (await get('diary')) || {};
      const day = dayKey(), d = all[day] || (all[day] = {});
      for (const [k, v] of Object.entries(b)) {
        if (d[k]) d[k].n += v.n;
        else if (Object.keys(d).length < PLACES) d[k] = v;
        else { const o = d['Other places'] || (d['Other places'] = { n: 0, first: v.first, msg: '', kind: 'warn' }); o.n += v.n; }
        if (v.kind === 'error' && d[k]) d[k].kind = 'error';
      }
      for (const k of Object.keys(all).sort().slice(0, -DAYS)) delete all[k];
      await put('diary', all);
    });
  }
  // The diary for the last n days, merged: [{ place, n, first, msg, kind, days }] most first.
  async function diary(n = 7) {
    await flush();
    const all = (await get('diary')) || {};
    const keys = Object.keys(all).sort().slice(-n), m = new Map();
    for (const day of keys) for (const [k, v] of Object.entries(all[day])) {
      const o = m.get(k) || { place: k, n: 0, first: v.first, msg: v.msg, kind: v.kind, days: 0 };
      o.n += v.n; o.days++; if (v.first < o.first) { o.first = v.first; o.msg = v.msg; } if (v.kind === 'error') o.kind = 'error';
      m.set(k, o);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }

  // Warnings and errors PageProof writes to the console (that's where its quiet catches go).
  const IGNORE = /^(\[HMR\]|Download the React|DevTools)/;
  for (const kind of ['warn', 'error']) {
    try {
      const orig = console[kind].bind(console);
      console[kind] = (...a) => {
        try { const first = a[0] instanceof Error ? a[0].name : a[0]; if (!IGNORE.test(String(first))) note(placeOf(first), a.slice(a[0] instanceof Error ? 0 : 1).map(text).join(' ') || text(a[0]), kind); } catch (e) { /* fine */ }
        return orig(...a);
      };
    } catch (e) { /* console locked */ }
  }
  try {
    globalThis.addEventListener('error', e => note('Page crash', (e.error && e.error.message) || e.message || 'error', 'error'));
    globalThis.addEventListener('unhandledrejection', e => { const r = e.reason; note('Unfinished task', (r && r.message) || String(r), 'error'); });
  } catch (e) { /* not a page */ }

  // ---------------------------------------------------------------- saves that fail
  async function saveFailed(err) {
    const msg = clean((err && err.message) || err);
    note('Saving to the browser', msg, 'error');
    const o = (await get('saveFail')) || { n: 0 };
    await put('saveFail', { n: (o.n || 0) + 1, at: Date.now(), first: o.first || Date.now(), msg, quota: /quota|space|QUOTA_BYTES/i.test(msg) });
  }
  async function lastFail() { return (await get('saveFail')) || null; }
  async function clearFail() { await put('saveFail', null); }
  try {
    const area = api && api.storage && api.storage.local;
    if (area && !area.__ppGuard) {
      const orig = area.set.bind(area);
      const wrapped = function (items, cb) {
        const p = orig(items);
        if (p && typeof p.then === 'function') {
          p.catch(saveFailed);
          if (typeof cb === 'function') p.then(() => cb(), () => cb());
          return p;
        }
        return p;
      };
      try { area.set = wrapped; area.__ppGuard = true; } catch (e) { /* read-only in this browser */ }
    }
  } catch (e) { /* no storage here */ }
  // Ask the browser to keep PageProof's data even when the disk gets full (once per page).
  try { if (globalThis.navigator && navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(p => p || navigator.storage.persist()).catch(() => {}); } catch (e) { /* fine */ }
  // How much is stored, for Is everything working: [settings and lists, everything].
  async function usage() {
    const out = { local: null, all: null, persisted: null };
    try { out.local = await api.storage.local.getBytesInUse(null); } catch (e) { /* Firefox */ }
    try { const e = await navigator.storage.estimate(); out.all = e.usage; } catch (e) { /* fine */ }
    try { out.persisted = await navigator.storage.persisted(); } catch (e) { /* fine */ }
    return out;
  }
  try { globalThis.addEventListener('pagehide', () => { flush(); }); } catch (e) { /* fine */ }

  return { note, flush, diary, clean, placeOf, saveFailed, lastFail, clearFail, usage };
})();
