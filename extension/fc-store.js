// Find copies: where PageProof keeps your clients, their photos and every copy found.
//  - Your photos stay in the shared Google Drive (Drive for desktop shows it as G:). PageProof
//    only remembers each photo's path, how new it is, and when it was searched.
//  - Copies found, clients, flags and site facts live in the browser's own database (IndexedDB
//    "pageproof-fc"), with a plain-text copy in Documents\PageProof (found-copies.txt and
//    pageproof-settings.json), so a reinstall never loses them.
// Used by the full PageProof page, the search results window and the Keep searching window.
const FC = (() => {
  const api = globalThis.browser || globalThis.chrome;
  const DAY = 86400000;
  const FRESH_MAX = 300;   // 4.42: more new photos than this at once is a bulk upload, not the fast lane

  // ---------------------------------------------------------------- database
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open('pageproof-fc', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        const ph = db.createObjectStore('photos', { keyPath: 'id' });
        ph.createIndex('client', 'client');
        ph.createIndex('hash', 'hash');
        const cp = db.createObjectStore('copies', { keyPath: 'id' });
        cp.createIndex('photo', 'photo');
        cp.createIndex('status', 'status');
        db.createObjectStore('clients', { keyPath: 'name' });
        db.createObjectStore('sites', { keyPath: 'site' });
        db.createObjectStore('meta');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }
  async function tx(store, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const r = fn(t.objectStore(store));
      t.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }
  const DB = {
    get: (s, k) => tx(s, 'readonly', o => o.get(k)),
    put: (s, v, k) => { stale(s); return tx(s, 'readwrite', o => (k === undefined ? o.put(v) : o.put(v, k))); },
    del: (s, k) => { stale(s); return tx(s, 'readwrite', o => o.delete(k)); },
    all: s => tx(s, 'readonly', o => o.getAll()),
    count: s => tx(s, 'readonly', o => o.count()),
    by: (s, index, v) => tx(s, 'readonly', o => o.index(index).getAll(v)),
    // How many (without reading them), and several by id in one go.
    countBy: (s, index, v) => tx(s, 'readonly', o => o.index(index).count(v)),
    async getMany(s, keys) {
      if (!keys.length) return [];
      const db = await open();
      return new Promise((resolve, reject) => {
        const t = db.transaction(s, 'readonly'), o = t.objectStore(s), out = new Array(keys.length);
        keys.forEach((k, i) => { o.get(k).onsuccess = e => { out[i] = e.target.result; }; });
        t.oncomplete = () => resolve(out); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error);
      });
    },
    prefix: (s, p) => tx(s, 'readonly', o => o.getAll(IDBKeyRange.bound(p, p + '\uffff'))),
    async putMany(s, list) {
      if (!list.length) return;
      stale(s);
      const db = await open();
      await new Promise((resolve, reject) => {
        const t = db.transaction(s, 'readwrite'), o = t.objectStore(s);
        for (const v of list) o.put(v);
        t.oncomplete = resolve; t.onerror = () => reject(t.error); t.onabort = () => reject(t.error || new Error('The browser could not save (is the disk full?)'));
      });
    },
    async delMany(s, keys) {
      if (!keys.length) return;
      stale(s);
      const db = await open();
      await new Promise((resolve, reject) => {
        const t = db.transaction(s, 'readwrite'), o = t.objectStore(s);
        for (const k of keys) o.delete(k);
        t.oncomplete = resolve; t.onerror = () => reject(t.error); t.onabort = () => reject(t.error || new Error('The browser could not save'));
      });
    },
  };
  const meta = { get: k => DB.get('meta', k), set: (k, v) => DB.put('meta', v, k) };

  // ---------------------------------------------------------------- small preview pictures
  // Preview pictures are kept in their own small database ("pageproof-fc-pics"), one per copy or
  // photo, so lists of thousands of copies load without them. A record that has one says th: 1.
  let picsP = null;
  function picsOpen() {
    if (picsP) return picsP;
    picsP = new Promise((resolve, reject) => {
      // Version 2 adds two more drawers: "kept" (their copy of the photo, exactly as downloaded
      // the moment it was found) and "pages" (a small picture of their page).
      const req = indexedDB.open('pageproof-fc-pics', 2);
      req.onupgradeneeded = () => { for (const n of ['p', 'kept', 'pages']) if (!req.result.objectStoreNames.contains(n)) req.result.createObjectStore(n); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { picsP = null; reject(req.error); };
    });
    return picsP;
  }
  const PICMEM = new Map();                    // the last few hundred shown, so a redraw doesn't flicker
  const remember = (id, v) => { PICMEM.delete(id); PICMEM.set(id, v); if (PICMEM.size > 900) PICMEM.delete(PICMEM.keys().next().value); };
  const pics = {
    seen: id => PICMEM.get(id) || '',
    async getMany(ids) {
      const need = ids.filter(id => !PICMEM.has(id));
      if (need.length) {
        const db = await picsOpen();
        await new Promise((resolve, reject) => {
          const t = db.transaction('p', 'readonly'), o = t.objectStore('p');
          need.forEach(id => { o.get(id).onsuccess = e => { if (e.target.result) remember(id, e.target.result); }; });
          t.oncomplete = resolve; t.onerror = () => reject(t.error); t.onabort = () => reject(t.error);
        });
      }
      return ids.map(id => PICMEM.get(id) || '');
    },
    get: async id => (await pics.getMany([id]))[0],
    async putMany(list) {                      // [[id, dataUrl], …]
      if (!list.length) return;
      const db = await picsOpen();
      await new Promise((resolve, reject) => {
        const t = db.transaction('p', 'readwrite'), o = t.objectStore('p');
        for (const [id, v] of list) { o.put(v, id); if (PICMEM.has(id)) remember(id, v); }
        t.oncomplete = resolve; t.onerror = () => reject(t.error); t.onabort = () => reject(t.error || new Error('The browser could not save a preview picture'));
      });
    },
    async count() { const db = await picsOpen(); return new Promise((res, rej) => { const r = db.transaction('p', 'readonly').objectStore('p').count(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },    // How many previews there are and roughly how much room they take (for the storage meter).
    async stats() {
      const db = await picsOpen();
      return new Promise((res, rej) => {
        let n = 0, bytes = 0;
        const r = db.transaction('p', 'readonly').objectStore('p').openCursor();
        r.onsuccess = () => { const c = r.result; if (!c) return res({ n, bytes }); n++; bytes += typeof c.value === 'string' ? Math.round(c.value.length * 0.75) : 0; c.continue(); };
        r.onerror = () => rej(r.error);
      });
    },
  };
  // ---------------------------------------------------------------- their copy and their page, kept
  // "kept": their copy of the photo, saved the moment a search finds it, so it is still here if
  // they delete it later. { blob, type, size, sha, at, from }. "pages": a small picture of their
  // page, taken the first time you look at the copy. { pic (a small JPEG), at }.
  const KEEP_MAX = 4 * 1024 * 1024;            // a bigger file than this is not kept (the preview still is)
  const box = name => ({
    async get(id) { const db = await picsOpen(); return new Promise((res, rej) => { const r = db.transaction(name, 'readonly').objectStore(name).get(id); r.onsuccess = () => res(r.result || null); r.onerror = () => rej(r.error); }); },
    async put(id, v) { const db = await picsOpen(); return new Promise((res, rej) => { const t = db.transaction(name, 'readwrite'); t.objectStore(name).put(v, id); t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); },
    async del(ids) { const db = await picsOpen(); return new Promise((res, rej) => { const t = db.transaction(name, 'readwrite'), o = t.objectStore(name); [].concat(ids).forEach(id => o.delete(id)); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); },
    async stats() {                            // how many, and how much room they take
      const db = await picsOpen();
      return new Promise((res, rej) => {
        let n = 0, bytes = 0; const ids = [], each = [];
        const r = db.transaction(name, 'readonly').objectStore(name).openCursor();
        r.onsuccess = () => { const c = r.result; if (!c) return res({ n, bytes, ids, each }); n++; ids.push(c.key); const v = c.value || {}; const b = v.size || (v.pic ? Math.round(v.pic.length * 0.75) : 0); bytes += b; each.push([c.key, b, v.at || '']); c.continue(); };
        r.onerror = () => rej(r.error);
      });
    },
    async clear() { const db = await picsOpen(); return new Promise((res, rej) => { const t = db.transaction(name, 'readwrite'); t.objectStore(name).clear(); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); },
  });
  const kept = box('kept'), pages = box('pages');
  async function shaHex(buf) { const d = await crypto.subtle.digest('SHA-256', buf); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join(''); }
  // Download their copy once and keep it. Quietly gives up if the site refuses or the file is huge.
  async function keepOriginal(c) {
    if (!c || !/^https?:/i.test(c.img || '')) return false;
    try {
      if (await kept.get(c.id)) return true;
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
      const r = await fetch(c.img, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctl.signal });
      clearTimeout(t);
      if (!r.ok) return false;
      const type = (r.headers.get('content-type') || '').split(';')[0];
      if (type && !/^image\//i.test(type)) return false;
      const buf = await r.arrayBuffer();
      if (!buf.byteLength || buf.byteLength > KEEP_MAX) return false;
      await kept.put(c.id, { blob: new Blob([buf], { type: type || 'image/jpeg' }), type: type || 'image/jpeg', size: buf.byteLength, sha: await shaHex(buf), at: new Date().toISOString(), from: c.img });
      return true;
    } catch (e) { return false; }
  }
  // After a search: keep each new find's picture, one at a time so the search isn't slowed.
  let keepChain = Promise.resolve();
  function keepSoon(list) { for (const c of list) keepChain = keepChain.then(() => keepOriginal(c)).catch(() => {}); return keepChain; }
  // Tidy up: copies you removed more than a week ago (so Undo still works) lose their kept
  // picture and page picture. Everything else stays.
  async function pruneKept() {
    try {
      const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
      for (const b of [kept, pages]) {
        const { ids } = await b.stats();
        if (!ids.length) continue;
        const recs = await DB.getMany('copies', ids);
        const dead = ids.filter((id, i) => !recs[i] || (recs[i].status === 'removed' && (recs[i].answered || '') < weekAgo));
        if (dead.length) await b.del(dead);
      }
    } catch (e) { /* tidy next time */ }
  }

  // Take the preview out of a record before it is saved. Returns [id, picture] to save, or null.
  // (A preview that is just a web address stays where it is: it is tiny.)
  function splitPic(rec) {
    const t = rec && rec.thumb;
    if (typeof t !== 'string' || !t.startsWith('data:')) return null;
    rec.thumb = ''; rec.th = 1;
    return [rec.id, t];
  }
  // A record's preview picture, wherever it is kept.
  async function thumbOf(rec) {
    if (!rec) return '';
    if (rec.thumb) return rec.thumb;
    return rec.th ? pics.get(rec.id) : '';
  }
  async function setThumb(store, rec, dataUrl) {
    rec.thumb = dataUrl;
    const pair = splitPic(rec);
    if (pair) await pics.putMany([pair]);
    await DB.put(store, rec);
  }
  // One time, after updating from a version that kept previews inside each record: move them.
  // A few hundred at a time, so the pages stay quick while it runs. Safe to stop part-way.
  async function movePics(progress) {
    if (await meta.get('picsMoved')) return 0;
    const run = async () => {
      if (await meta.get('picsMoved')) return 0;
      let moved = 0;
      for (const [store, step] of [['copies', 300], ['photos', 3000]]) {
        let last = null;
        for (;;) {
          const part = await tx(store, 'readonly', o => o.getAll(last === null ? null : IDBKeyRange.lowerBound(last, true), step));
          if (!part.length) break;
          last = part[part.length - 1].id;
          const pairs = [], changed = [];
          for (const r of part) { const pr = splitPic(r); if (pr) { pairs.push(pr); changed.push(r); } }
          if (pairs.length) {
            await pics.putMany(pairs);
            // Only records nobody changed in the meantime are written back.
            const now = await DB.getMany(store, changed.map(r => r.id));
            const safe = now.filter(r => r && typeof r.thumb === 'string' && r.thumb.startsWith('data:'));
            for (const r of safe) splitPic(r);
            await DB.putMany(store, safe);
            moved += safe.length;
          }
          if (progress) progress(moved);
          await new Promise(r => setTimeout(r, 0));
        }
      }
      await meta.set('picsMoved', new Date().toISOString());
      if (moved) touch('pics');
      return moved;
    };
    if (globalThis.navigator && navigator.locks) return navigator.locks.request('pageproof-move-pics', run);
    return run();
  }
  // The copies list and the "how up to date" numbers are kept in this page's memory between
  // looks, because reading thousands of copies or hundreds of thousands of photos takes seconds.
  // They are dropped the moment anything changes them, here or in another PageProof page.
  let COPIES = null, COPIES_GEN = 0, COVER = null;
  function stale(store) {
    if (store === 'copies') { COPIES = null; COPIES_GEN++; }
    if (store === 'photos' || store === 'clients') COVER = null;
  }
  try {
    api.storage.onChanged.addListener(ch => {
      if (ch.fcChanged) { COPIES = null; COPIES_GEN++; COVER = null; }
      if (ch.fcQueueDirty) COVER = null;
    });
  } catch (e) { /* no storage events here */ }
  // Tell every open PageProof page that something changed (they redraw).
  const touch = what => api.storage.local.set({ fcChanged: { what, at: Date.now() } }).catch(() => {});

  // ---------------------------------------------------------------- settings
  const KEEP_DEFAULT = { on: false, pace: 'Steady', hours: 'work', from: 8, to: 18, weekdays: true, fiftyTime: '09:00', fiftyAuto: false, perDay: 50, firstShare: 3, fiftyWhich: 'next', ladder: true, ladderTop: 40 };
  const PACE = { Gentle: 10, Steady: 5, Faster: 2 };      // minutes between photos
  // Speed ladder (Ben's pick): on Faster, Keep searching climbs one step after every calm hour
  // (no "are you a robot" check on that lane's sites): one photo every 2 minutes, then 90, 60,
  // 40 seconds (30 if picked). A robot check still rests that site for an hour (PageProof never
  // tries to get past one), and its lane comes back two steps slower and stays there for the
  // rest of the day. The next day starts one step below where the day before ended.
  // Two lanes: g = Google, f = Yandex and Bing (their photos come twice as often as Google's).
  const LADDER = [120, 90, 60, 40, 30];                      // seconds between photos
  const LADDER_LANES = { g: ['google'], f: ['yandex', 'bing'] };
  const ladderTop = k => LADDER.indexOf([60, 40, 30].includes(+k.ladderTop) ? +k.ladderTop : 40);
  async function ladder(k, now = Date.now()) {
    const st = await api.storage.local.get(['fcLadder', 'fcRobotAt']);
    const L = st.fcLadder || {}, robot = st.fcRobotAt || {};
    const day = new Date(now).toDateString(), top = ladderTop(k);
    let changed = false;
    for (const lane of ['g', 'f']) {
      let s = L[lane];
      if (!s || typeof s.step !== 'number') { s = { step: 0, at: now, cap: top, day }; changed = true; }
      if (s.day !== day) { s = { step: Math.max(0, Math.min(s.step, top) - 1), at: now, cap: top, day }; changed = true; }
      const hit = Math.max(0, ...LADDER_LANES[lane].map(e => robot[e] || 0));
      if (hit > s.at) {
        s = { ...s, step: Math.max(0, s.step - 2), at: now, drops: (s.drops || 0) + 1 }; s.cap = s.step; changed = true;
        if (typeof PP_STATS !== 'undefined') PP_STATS.add('keep.ladder.down');
      } else if (s.step < Math.min(s.cap, top) && now - s.at >= 3600000) {
        s = { ...s, step: s.step + 1, at: now }; changed = true;
        if (typeof PP_STATS !== 'undefined') PP_STATS.add('keep.ladder.up');
      }
      if (s.step > top) { s = { ...s, step: top }; changed = true; }
      L[lane] = s;
    }
    if (changed) await api.storage.local.set({ fcLadder: L });
    return { g: L.g, f: L.f, top, gSec: LADDER[L.g.step], fSec: LADDER[L.f.step] };
  }
  async function keep() { return { ...KEEP_DEFAULT, ...((await api.storage.local.get('fcKeep')).fcKeep || {}) }; }
  // Inside the hours picked on Keep searching (8 AM to 6 PM on weekdays unless changed).
  function inHours(k, d = new Date()) {
    if (k.hours === 'all') return true;
    const day = d.getDay(), hr = d.getHours() + d.getMinutes() / 60;
    if (k.weekdays !== false && (day === 0 || day === 6)) return false;
    return hr >= (k.from ?? 8) && hr < (k.to ?? 18);
  }
  // 4.30.2 (Ben): may PageProof do quiet work by itself (read account details, open pinned tabs)?
  // Only while Keep searching is on, not paused, and inside its hours.
  async function quietOK() {
    const k = await keep();
    const st = await api.storage.local.get('fcPause');
    if (!k.on) return { ok: false, why: 'off' };
    if (st.fcPause) return { ok: false, why: 'paused' };
    if (!inHours(k)) return { ok: false, why: 'hours' };
    return { ok: true };
  }
  // 4.42 (Ben's pick): a goal instead of a pace. "Every photo searched once by <date>": the work
  // minutes left (your hours, weekdays) are shared out over the photos still never searched (each
  // takes share searches, as 1 in share searches go to them). Never faster than Faster or this
  // computer's limit, never slower than Gentle. Says if it is on track and, if not, when it would end.
  function workMinutes(k, from, to) {
    let n = 0;
    const d = new Date(from);
    for (let i = 0; i < 800 && d < to; i++) {
      const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const open = k.hours === 'all' ? 0 : (k.from ?? 8), shut = k.hours === 'all' ? 24 : (k.to ?? 18);
      const weekend = k.hours !== 'all' && k.weekdays !== false && (day.getDay() === 0 || day.getDay() === 6);
      if (!weekend) {
        const a = Math.max(+day + open * 3600000, +d), b = Math.min(+day + shut * 3600000, +to);
        if (b > a) n += (b - a) / 60000;
      }
      d.setTime(+day + DAY + 3600000); d.setHours(0, 0, 0, 0);
    }
    return n;
  }
  function goalPlan(k, never, fastest = 'Faster', now = new Date()) {
    if (!k.goal || !/^\d{4}-\d{2}-\d{2}$/.test(k.goal)) return null;
    const share = [2, 3, 4].includes(k.firstShare) ? k.firstShare : 3;
    const end = new Date(k.goal + 'T23:59:00');
    const left = workMinutes(k, now, end);
    const fast = PACE[fastest] || PACE.Faster, slow = PACE.Gentle;
    if (!never) return { done: true, gap: null, never: 0, goal: k.goal };
    const need = never * share;
    const want = left / need;
    const gap = Math.max(fast, Math.min(slow, want));
    const hpd = Math.max(1, k.hours === 'all' ? 24 : (k.to ?? 18) - (k.from ?? 8));
    const days = Math.max(1, Math.round(left / (hpd * 60)));
    let eta = null;
    if (want < fast) {
      // When it would end at the fastest safe pace.
      let mins = need * fast; const d = new Date(now);
      for (let i = 0; i < 2000 && mins > 0; i++) { const next = new Date(+d + DAY); mins -= workMinutes(k, d, next); d.setTime(+next); }
      eta = d.toISOString().slice(0, 10);
    }
    return { done: false, gap, onTrack: want >= fast, never, perDay: Math.ceil(never / days), eta, goal: k.goal, left: Math.round(left) };
  }
  async function setKeep(ch) { const k = { ...(await keep()), ...ch }; await api.storage.local.set({ fcKeep: k }); backupSoon(); return k; }
  async function drive() { return { label: 'G:\\Shared drives\\Photos', done: false, ...((await api.storage.local.get('fcDrive')).fcDrive || {}) }; }
  async function setDrive(ch) { const d = { ...(await drive()), ...ch }; await api.storage.local.set({ fcDrive: d }); backupSoon(); return d; }

  // ---------------------------------------------------------------- the Drive folder
  // The handle to G:\Shared drives\Photos (or wherever it is) is kept in the same place as the
  // Documents\PageProof handle. Extra folders (outside Photos) are kept as "extra:<client>".
  async function rootHandle() { try { return await RS_DB.get('handles', 'fcRoot'); } catch (e) { return null; } }
  async function extraHandles() {
    const out = [];
    try {
      const keys = await RS_DB.keys('handles');
      for (const k of keys) if (String(k).startsWith('fcExtra:')) { const h = await RS_DB.get('handles', k); if (h) out.push({ client: String(k).slice(8), h }); }
    } catch (e) { /* none */ }
    return out;
  }
  // 'granted', 'prompt' (one click on Allow, usually after the browser restarts), 'none', or
  // 'offline' (allowed, but the folder can't be opened: Drive for desktop isn't running).
  async function driveState(check) {
    const h = await rootHandle();
    if (!h) return 'none';
    let p;
    const t00 = Date.now();
    try { p = await RS_LATE(h.queryPermission({ mode: 'read' }), check ? 20000 : 4000, 'slow'); } catch (e) { return 'none'; }
    if (p === 'slow') { if (check) driveWhy('The browser gave no answer when asked if PageProof may still read the folder "' + h.name + '" (waited 20 s).'); return 'offline'; }
    if (p !== 'granted') return 'prompt';
    if (check) {
      const t0 = Date.now();
      // Ask Drive for ONE folder you ticked, not for the whole top folder: listing every shared
      // drive can take a minute, which made pages slow (4.3.3) or wrongly "not answering" (4.3.4).
      // A missing folder answers at once (NotFoundError) when Drive is up, so that still counts as up.
      let first = '';
      try { const pk = await picked(); first = pk && pk.length ? String(pk[0]).split('/')[0] : ''; } catch (e) { /* none */ }
      const what = first ? 'the folder "' + first + '"' : 'the list of folders';
      const probe = first
        ? h.getDirectoryHandle(first).then(() => true, e => e && e.name === 'NotFoundError' ? true : Promise.reject(e))
        : h.entries().next().then(() => true);
      try {
        const ok = await RS_LATE(probe, 45000, false);
        if (!ok) { driveWhy('Asked Drive for ' + what + ' in "' + h.name + '": no answer in 45 s.'); return 'offline'; }
      } catch (e) { driveWhy('Asked Drive for ' + what + ' in "' + h.name + '": ' + ((e && e.name) || 'Error') + ': ' + ((e && e.message) || String(e)) + ' (after ' + Math.round((Date.now() - t00) / 1000) + ' s)'); return 'offline'; }
      perf('driveAnswer', Date.now() - t0);
      driveWhy('');
    }
    return 'granted';
  }
  // Why the last Drive check failed, in plain words, for the red bar and Copy details for support.
  function driveWhy(why) { api.storage.local.set({ fcDriveWhy: why ? { why, at: Date.now() } : null }).catch(() => {}); }
  // Pages never wait for Google Drive. They show the last answer at once; a fresh check runs in
  // the background (one at a time) and the page is redrawn if the answer changed.
  // fresh = "Try again": wait for a new answer.
  let driveSeen = null, driveAsk = null;
  function driveAskNow() {
    if (!driveAsk) driveAsk = driveState(true).then(st => {
      const was = driveSeen && driveSeen.st;
      driveSeen = { at: Date.now(), st };
      if (st !== (was || 'granted')) touch('drive');
      // Drive answers again: clear the red "can't reach" notes at once (4.3.8: they stayed up
      // after Allow until Keep searching next looked).
      if (st === 'granted') api.storage.local.get('fcDriveOffline').then(o => { if (o.fcDriveOffline) api.storage.local.set({ fcDriveOffline: 0, fcDriveBack: Date.now(), fcDriveWhy: null }); }).catch(() => {});
      return st;
    }).finally(() => { driveAsk = null; });
    return driveAsk;
  }
  async function driveStateSoft(fresh) {
    if (fresh) return driveAskNow();
    if (!driveSeen || Date.now() - driveSeen.at > 60000) {
      const ask = driveAskNow();
      if (!driveSeen) {
        // First look on this page: wait a moment for a quick answer, else assume it's fine for now.
        const quick = await RS_LATE(ask, 1500, null);
        if (quick) return quick;
        const p = await driveState(false);
        return p === 'granted' ? 'granted' : p;
      }
    }
    return driveSeen.st;
  }
  // Must be called from a click.
  async function allowDrive() {
    driveSeen = null;
    const h = await rootHandle();
    if (h && (await h.requestPermission({ mode: 'read' })) !== 'granted') return false;
    for (const x of await extraHandles()) { try { await x.h.requestPermission({ mode: 'read' }); } catch (e) { /* skip */ } }
    if (h) driveAskNow().catch(() => {});      // a fresh check clears any red "can't reach" note
    return !!h;
  }
  // PageProof only ever READS the photos. If the Documents › PageProof folder turns out to be inside a
  // photos folder (or to hold one), PageProof forgets it and saves nothing there. Checked only when a
  // folder is picked: asking again and again could get stuck on a slow Google Drive (4.3.2).
  async function docsAwayFromPhotos() {
    try { const d = await RS_DOCS.handle(); if (d && await RS_DOCS.touchesPhotos(d)) await RS_DB.del('handles', 'docs'); } catch (e) { /* can't tell */ }
  }
  async function pickRoot() {
    const h = await window.showDirectoryPicker({ id: 'pageproof-photos', mode: 'read' });
    await RS_DB.put('handles', 'fcRoot', h);
    await docsAwayFromPhotos();
    return h;
  }
  async function pickExtra(client) {
    const h = await window.showDirectoryPicker({ id: 'pageproof-extra', mode: 'read' });
    const name = tidyClient(client || h.name);
    await RS_DB.put('handles', 'fcExtra:' + name, h);
    await docsAwayFromPhotos();
    return { name, h };
  }
  const tidyClient = s => String(s || '').replace(/[\\/|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Client';

  // Walk a path like "Sample Client/Registered images/2026/Q4/x.jpg" down from its top folder.
  async function fileFor(photo) {
    const parts = photo.rel.split('/');
    let dir;
    if (photo.extra) { const x = (await extraHandles()).find(e => e.client === photo.client); dir = x && x.h; parts.shift(); }
    else dir = await rootHandle();
    if (!dir) throw new Error('The photos folder is not connected');
    for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p);
    return (await dir.getFileHandle(parts[parts.length - 1])).getFile();
  }

  // ---------------------------------------------------------------- folder names
  const IMAGE = /\.(jpe?g|png|webp|gif|bmp|avif|tiff?|heic|heif)$/i;
  const SHEET = /\.(xlsx|xlsm|xls|csv|ods|pdf|docx?)$/i;
  const yearOf = s => { const m = /(?:^|[^\d])((?:19|20)\d{2})(?:[^\d]|$)/.exec(s); return m ? +m[1] : 0; };
  const quarterOf = s => { const m = /(?:^|[^a-z0-9])q([1-4])(?:[^a-z0-9]|$)/i.exec(s) || /(?:^|\s)([1-4])(?:st|nd|rd|th)\s+quarter/i.exec(s); return m ? +m[1] : 0; };
  // "6.18.22", "11.18.26_Farrington", "2024-05-03", "May 3": a day, as a sortable number (month*40+day).
  function dayOf(s) {
    let m = /(?:^|[^\d])(\d{1,2})[.\-_](\d{1,2})[.\-_](\d{2}|\d{4})(?:[^\d]|$)/.exec(s);
    if (m && +m[1] <= 12 && +m[2] <= 31) return +m[1] * 40 + +m[2];
    m = /((?:19|20)\d{2})[.\-_](\d{1,2})[.\-_](\d{1,2})/.exec(s);
    if (m && +m[2] <= 12) return +m[2] * 40 + +m[3];
    m = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b/i.exec(s);
    if (m) return ('janfebmaraprmayjunjulaugsepoctnovdec'.indexOf(m[1].toLowerCase()) / 3 + 1) * 40 + +m[2];
    return 0;
  }
  // Copyright Office numbers. "VA0001234567" or "VA 1-234-567" = registered (the registration number).
  // "1-12345678901" = the application (case) number.
  function regIn(s) {
    const out = {};
    const va = /(?:^|[^a-z])VA([\s\-_.]*u)?[\s\-_.]*((?:\d[\s\-]?){6,10})(?!\d)/i.exec(s);
    if (va) {
      const d = va[2].replace(/\D/g, '').replace(/^0+/, '');
      if (d.length >= 6) out.va = (va[1] ? 'VAu ' : 'VA ') + (d.length > 6 ? d.slice(0, d.length - 6) + '-' : '') + d.slice(-6, -3) + '-' + d.slice(-3);
    }
    const app = /(?:^|[^\d])(1-\d{9,12})(?:[^\d]|$)/.exec(s);
    if (app) out.app = app[1];
    return out.va || out.app ? out : null;
  }

  // ---------------------------------------------------------------- scanning the folders
  // Client folders are the folders straight inside Photos. Inside each, only "Registered images"
  // is searched (if a client has no such folder, the whole client folder is used).
  // Each photo gets: client, year, quarter, day, and a "newness" number for newest-first.
  const SCAN = { busy: false };
  // client_info.txt (client_id=…) names the client for a folder and everything inside it.
  // client_info_ignore.txt (ignore_client=true) means: don't search this folder or anything inside it.
  // The same files your other monitoring platform reads.
  const INFO = 'client_info.txt', IGNORE = 'client_info_ignore.txt';
  function parseInfo(text) {
    const o = {};
    for (const line of String(text || '').slice(0, 20000).split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_]+)\s*[=:]\s*(.*?)\s*$/);
      if (m) o[m[1].toLowerCase()] = m[2];
    }
    return o;
  }
  async function readInfo(dir, names) {
    const out = {};
    const read = async n => { try { return parseInfo(await (await (await dir.getFileHandle(n)).getFile()).text()); } catch (e) { return null; } };
    const has = n => (names ? names.find(x => x.toLowerCase() === n) : n);
    const ign = has(IGNORE), inf = has(INFO);
    if (ign) { const o = await read(ign); if (o !== null && !/^(false|no|0)$/i.test(o.ignore_client || '')) { out.ignore = true; out.ignoreId = o.client_id || ''; } }
    if (inf) { const o = await read(inf); if (o && o.client_id) out.id = tidyClient(o.client_id); }
    return out;
  }
  async function listDirs(dir) {
    const out = [];
    for await (const [name, h] of dir.entries()) if (h.kind === 'directory' && !/^[.$~]/.test(name)) out.push([name, h]);
    return out.sort((a, b) => a[0].localeCompare(b[0]));
  }
  // A folder inside the top folder, by its path ("Group G-H/Sample Client").
  async function dirAt(rel) {
    let d = await rootHandle();
    if (!d) throw new Error('The photos folder is not connected');
    for (const p of String(rel || '').split('/').filter(Boolean)) d = await d.getDirectoryHandle(p);
    return d;
  }
  // The folders inside one folder, for the folder tree in setup. [{ name, rel }]
  // Quick: names only. folderInfo() reads the client_info files of one folder (slower on Drive).
  async function subfolders(rel) {
    const d = await dirAt(rel);
    return (await listDirs(d)).map(([name]) => ({ name, rel: (rel ? rel + '/' : '') + name }));
  }
  async function folderInfo(rel) {
    // Asks for the two file names directly, so a folder full of photos is never listed.
    return readInfo(await dirAt(rel));
  }
  // The folders you ticked (paths inside the top folder). null = never picked (older setups:
  // every folder directly inside the top folder is a client).
  async function picked() { const p = await meta.get('picked'); return Array.isArray(p) ? p : null; }
  // 4.47.3: folders you UNticked inside a ticked folder (for example a "No longer monitoring"
  // folder you don't want searched). They are left out with everything inside them.
  async function unpicked() { const p = await meta.get('unpicked'); return Array.isArray(p) ? p : []; }
  const tidyRels = list => [...new Set((list || []).map(r => String(r).replace(/^\/+|\/+$/g, '')).filter(Boolean))].sort();
  // 4.47.5: folders with client_info_ignore.txt that you ticked anyway (inside a ticked folder).
  // 4.51.1: folders a person set aside by name. Inside a ticked folder they are skipped (shown as
  // Skipped in setup), unless ticked there by hand. "No longer monitoring" is NOT set aside: Ben searches it in ticked clients.
  const SET_ASIDE = /\b(not to use|do not use|don'?t use|recycled?|recycle bin|should not have been)\b/i;
  async function forced() { const p = await meta.get('forced'); return Array.isArray(p) ? p : []; }
  async function setPicked(list, unlist, forceList) {
    // A folder inside another ticked folder is already included.
    const clean = tidyRels(list);
    const keep = clean.filter(r => !clean.some(o => o !== r && r.startsWith(o + '/')));
    await meta.set('picked', keep);
    if (unlist) {
      // Only unticks that sit inside a ticked folder (and not inside another untick) matter.
      const un = tidyRels(unlist).filter(r => keep.some(o => r.startsWith(o + '/')));
      await meta.set('unpicked', un.filter(r => !un.some(o => o !== r && r.startsWith(o + '/'))));
    }
    if (forceList) await meta.set('forced', tidyRels(forceList).filter(r => keep.some(o => r.startsWith(o + '/'))));
    queueDirty(); backupSoon();
    return keep;
  }
  // Add one folder with the folder window. Inside the top folder: its path is ticked. Anywhere
  // else: it is added as its own folder (asks for a client name).
  async function pickInside() {
    const root = await rootHandle();
    const h = await window.showDirectoryPicker({ id: 'pageproof-add', mode: 'read' });
    const path = root ? await root.resolve(h).catch(() => null) : null;
    return { h, rel: path ? path.join('/') : null };
  }
  // Every client folder, with its Registered images folder. Quick: no photos read.
  // A ticked folder called "Registered images" belongs to the folder above it.
  async function clientFolders() {
    const root = await rootHandle();
    const out = [];
    if (root) {
      const picks = await picked();
      const list = [];
      // Only ticked folders. (Nothing ticked = nothing read: never the whole drive.)
      // 4.39: a ticked folder that Drive says is not there any more (renamed, moved or deleted) is
      // written down, so Home and Clients can say so instead of the client quietly going quiet.
      const missing = [], unpick = await unpicked(), force = await forced();
      for (const rel of picks || []) { try { list.push([rel, await dirAt(rel)]); } catch (e) { if (e && (e.name === 'NotFoundError' || /not (be )?found/i.test(e.message || ''))) missing.push(rel); /* else Drive offline */ } }
      const was = (await meta.get('missingPicks')) || [];
      const now = missing.map(rel => was.find(m => m.rel === rel) || { rel, since: new Date().toISOString() });
      if (JSON.stringify(now) !== JSON.stringify(was)) await meta.set('missingPicks', now);
      for (const [rel, h] of list) {
        const parts = rel.split('/');
        let base = null, baseName = '', name = parts[parts.length - 1], folderRel = rel;
        if (/^registered/i.test(name) && parts.length > 1) { base = h; name = parts[parts.length - 2]; folderRel = parts.slice(0, -1).join('/'); }
        else for (const [n2, h2] of await listDirs(h)) if (/^registered/i.test(n2)) { base = h2; baseName = n2; break; }
        const info = { ...(await readInfo(h)), ...(base && base !== h ? await readInfo(base) : {}) };
        if (info.id) name = info.id;
        out.push({ skip: unpick.filter(r => r.startsWith(rel + '/')), force: force.filter(r => r.startsWith(rel + '/')), name: tidyClient(name), folder: folderRel, base: base || h, baseName: base === h ? '' : baseName, rel: rel + (baseName && base !== h ? '/' + baseName : ''), pick: rel });
      }
      // Two ticked folders with the same name: add the folder above to tell them apart.
      const count = {};
      for (const c of out) count[c.name] = (count[c.name] || 0) + 1;
      for (const c of out) if (count[c.name] > 1) { const up = c.folder.split('/').slice(-2, -1)[0]; if (up) c.name = tidyClient(up + ' › ' + c.name); }
    }
    for (const x of await extraHandles()) out.push({ name: x.client, folder: x.h.name, base: x.h, baseName: '', rel: x.client, extra: true });
    return out;
  }
  // Read one client's photos. "only" = a list of year/quarter keys to look in (the hourly check
  // looks at this quarter and last quarter only). onFile(photoFields) for each photo.
  async function walkClient(cf, onFile, only, onDir) {
    const regs = {};
    const walk = async (dir, rel, depth, ctx) => {
      if (cf.check) await cf.check();
      let files = [], dirs = [], txt = [];
      // 4.47.1: one folder Google Drive can't list (a hiccup) no longer stops the whole read.
      // It is tried twice, then left out and counted, so the photos already in the list stay.
      for (let tries = 0; ; tries++) {
        files = []; dirs = []; txt = [];
        try {
          for await (const [name, h] of dir.entries()) {
            if (/^[.$~]/.test(name)) continue;
            if (h.kind === 'directory') dirs.push([name, h]);
            else if (IMAGE.test(name)) files.push(name);
            else if (/^client_info(_ignore)?\.txt$/i.test(name)) txt.push(name);
            else if (SHEET.test(name)) { const r = regIn(name); if (r) regs[rel] = { ...(regs[rel] || {}), ...r, from: 'File name in this folder: ' + name }; }
          }
          break;
        } catch (e) {
          if (tries >= 1) {
            cf.errors = (cf.errors || 0) + 1;
            // 4.51.1: say what Drive actually answered ("[object DOMException]" told nothing). A very
            // long folder path (Windows stops at about 260 letters) is the usual cause.
            console.warn('PageProof could not read a folder: ' + ((e && e.name) || 'Error') + (e && e.message ? ' (' + e.message + ')' : '') + '. Left out: ' + rel);
            return;
          }
          await new Promise(r => setTimeout(r, 1500));
        }
      }
      if (txt.length) {
        const info = await readInfo(dir, txt);
        if (info.ignore && !(cf.force || []).includes(rel)) { if (onDir) onDir(rel, 0, true); return; }
        if (info.id) ctx = { ...ctx, client: info.id };
      }
      const own = regIn(dir.name);
      if (own && depth > 0) regs[rel] = { ...own, ...(regs[rel] || {}), from: regs[rel] ? regs[rel].from : 'Folder name: ' + dir.name };
      if (onDir) onDir(rel, files.length);
      for (const f of files) {
        onFile({ rel: rel + '/' + f, name: f, folder: rel, year: ctx.year || yearOf(f), quarter: ctx.quarter || 0, day: dayOf(f) || ctx.day || 0, client: ctx.client || '' });
      }
      if (depth >= 8) return;
      for (const [name, h] of dirs) {
        // 4.47.3: a folder you unticked in setup is left out, with everything inside it.
        if (cf.skip && cf.skip.includes(rel + '/' + name)) { if (onDir) onDir(rel + '/' + name, 0, true); continue; }
        // 4.51.1: set-aside folders ("Image not to use", "recycled") are left
        // out unless ticked by hand in setup.
        if (SET_ASIDE.test(name) && !(cf.force || []).includes(rel + '/' + name)) { if (onDir) onDir(rel + '/' + name, 0, true); continue; }
        const c2 = { ...ctx };
        const y = yearOf(name), q = quarterOf(name), d = dayOf(name);
        // A folder that is clearly a year ("2024", "2024 Q1", "Year 2024"), at any depth. Right
        // under the client folder, any year in the name counts (as before).
        const yearDir = y && !ctx.year && (depth === 0 || YEAR_DIR.test(name));
        if (y && !c2.year) c2.year = y;
        if (yearDir) c2.yearDir = true;
        if (q) c2.quarter = q;
        if (d && (c2.quarter || c2.year)) c2.day = d;
        // The hourly look only opens this and last quarter's folders. (It used to stop only at
        // year folders straight inside the client folder, so a ticked folder holding several
        // clients, each with its own year folders, was read from top to bottom every hour.)
        if (only && yearDir && !only.some(k => k.year === c2.year)) continue;
        if (only && q && c2.yearDir && !only.some(k => k.year === c2.year && (!k.quarter || k.quarter === c2.quarter))) continue;
        await walk(h, rel + '/' + name, depth + 1, c2);
      }
    };
    await walk(cf.base, cf.rel, 0, { year: 0, quarter: 0, day: 0 });
    return regs;
  }
  const YEAR_DIR = /^\s*(?:year|fy)?[\s._-]*(?:19|20)\d{2}(?!\d)/i;
  const newness = p => p.year ? p.year * 1000 + (p.quarter || 0) * 200 + (p.day || 0) : (p.exifY || 0) * 1000 + (p.exifQ || 0) * 200;
  // This quarter and last quarter (for the hourly look for new photos).
  function recentQuarters(d = new Date()) {
    const y = d.getFullYear(), q = Math.floor(d.getMonth() / 3) + 1;
    return [{ year: y, quarter: q }, q === 1 ? { year: y - 1, quarter: 4 } : { year: y, quarter: q - 1 }];
  }
  // Look through the folders and update the photo list. full = every folder (the weekly check, or
  // "Look for new photos"); otherwise only this and last quarter's folders.
  // Returns { clients, photos, added, removed }. progress(text) is called as it goes.
  // background = the automatic checks of Keep searching. They wait (and stop part-way) while the
  // folder setup page is open, so Google Drive is free to list folders quickly.
  const setupOpen = async () => { try { return Date.now() - ((await api.storage.local.get('fcSetupAt')).fcSetupAt || 0) < 90000; } catch (e) { return false; } };
  async function scan({ full = true, clients: onlyClients = null, progress, background = false } = {}) {
    if (SCAN.busy) return { busy: true };
    if (background && await setupOpen()) return { busy: true };
    SCAN.busy = true;
    const scanT0 = Date.now();
    let lastCheck = Date.now();
    const check = !background ? null : async () => {
      if (Date.now() - lastCheck < 3000) return;
      lastCheck = Date.now();
      if (await setupOpen()) throw new Error('Paused: folder setup is open');
    };
    try {
      const st = await driveState(true);
      if (st !== 'granted') return { state: st };
      const folders = await clientFolders();
      const alias = (await meta.get('photoAlias')) || {};
      const pres = [];
      const known = new Map((await DB.all('clients')).map(c => [c.name, c]));
      const regs = (await meta.get('regs')) || {};
      const gen = Date.now();
      let added = 0, removed = 0, total = 0;
      const only = full ? null : recentQuarters();
      for (const cf of folders) {
        cf.check = check;
        const old = known.get(cf.name);
        const client = { name: cf.name, folder: cf.folder, rel: cf.rel, baseName: cf.baseName, extra: !!cf.extra, searching: old ? old.searching : null, priority: old ? !!old.priority : false,
          photos: old ? old.photos : 0, licensed: old ? old.licensed || [] : [], scanned: old && old.scanned, lastSearched: old && old.lastSearched };
        if (onlyClients && !onlyClients.includes(cf.name)) { await DB.put('clients', client); continue; }
        // The hourly look skips clients nobody searches. A ticked folder that holds several
        // clients (each named by its client_info.txt) is still read if any of those is searched.
        if (!full && client.searching !== true && ![...known.values()].some(c => c.from === cf.name && c.searching === true)) continue;
        // 4.47.1: a client whose folders were never read all the way through (the first read was
        // cut short: page closed, Drive busy) gets a full read now, every year, not just the
        // hourly look at this and last quarter. Before, such a client only ever showed its two
        // newest quarters until the weekly check, which itself waits a week after setup.
        const fullC = full || !(old && old.scanned);
        cf.errors = 0;
        const pre = 'd:' + (cf.extra ? '+' : '') + cf.rel + '/';
        pres.push(pre);
        const seen = new Set(), batch = [], subs = {}, subsNew = {}, found = [], newOnes = [];
        let n = 0, skipped = 0, mineNew = 0;
        if (progress) progress('Reading ' + cf.name + '…');
        const r = await walkClient(cf, f => { found.push(f); }, fullC ? null : only, (rel, k, ignored) => { if (ignored) skipped++; });
        // What's already known about these photos, so flags and search history stay. The weekly
        // check reads all of this client's photos (to spot the ones that are gone); the hourly
        // look only reads the few it found, not the whole library.
        // 4.39: photos that moved (folder renamed or moved) keep their first address as their id.
        for (const f of found) { const id0 = 'd:' + (cf.extra ? '+' : '') + f.rel; f.id = alias[id0] || id0; }
        const have = fullC ? new Map((await DB.prefix('photos', pre)).map(p => [p.id, p]))
          : new Map((await DB.getMany('photos', found.map(f => f.id))).filter(Boolean).map(p => [p.id, p]));
        const away = found.filter(f => f.id !== 'd:' + (cf.extra ? '+' : '') + f.rel && !have.has(f.id));
        if (away.length) for (const p of (await DB.getMany('photos', away.map(f => f.id))).filter(Boolean)) have.set(p.id, p);
        for (const f of found) {
          const id = f.id;
          delete f.id;
          // A client_info.txt further down names a different client for those photos.
          const who = f.client || cf.name;
          delete f.client;
          seen.add(id);
          if (who === cf.name) n++; else subs[who] = (subs[who] || 0) + 1;
          const p = have.get(id);
          if (p) { if (p.year !== f.year || p.quarter !== f.quarter || p.day !== f.day || p.gone || p.client !== who) { Object.assign(p, f, { gone: false, client: who }); p.order = newness(p); batch.push(p); } continue; }
          const np = { id, client: who, extra: !!cf.extra, ...f, flag: '', searches: 0, empty: 0, copies: 0, stolen: 0, added: gen };
          np.order = newness(np);
          batch.push(np); added++; newOnes.push(np);
          if (who === cf.name) mineNew++; else subsNew[who] = (subsNew[who] || 0) + 1;
        }
        // Clients named by a client_info.txt inside this folder: searched like the folder they're in.
        for (const [name, cnt] of Object.entries(subs)) {
          const o = known.get(name) || (await DB.get('clients', name));
          await DB.put('clients', { ...(o || {}), name, searching: o ? o.searching : client.searching, priority: o ? !!o.priority : client.priority, photos: fullC ? cnt : ((o && o.photos) || 0) + (subsNew[name] || 0), licensed: o ? o.licensed || [] : [], from: cf.name, scanned: fullC ? new Date().toISOString() : o && o.scanned });
        }
        // 4.42 new photo fast lane: photos that arrive in a client PageProof already knows (not
        // the first big read, not a whole new shoot library of hundreds) are searched first.
        if (old && old.scanned && newOnes.length && newOnes.length <= FRESH_MAX) for (const np of newOnes) np.fresh = gen;
        client.ignored = skipped;
        for (const [k, v] of Object.entries(r)) regs[k] = { ...v, ...(regs[k] && regs[k].manual ? regs[k] : {}) };
        await DB.putMany('photos', batch);
        if (fullC) {
          // Photos no longer in the folder are kept (their copies matter) but marked gone.
          // (Not when a folder couldn't be read: its photos are still there, just unread.)
          const gone = [];
          if (!cf.errors) for (const [id, p] of have) if (!seen.has(id) && !p.gone) { p.gone = true; gone.push(p); }
          removed += gone.length;
          await DB.putMany('photos', gone);
          client.photos = n + (cf.errors ? [...have.values()].filter(p => !seen.has(p.id) && !p.gone && p.client === cf.name).length : 0);
        } else client.photos = (old ? old.photos : 0) + mineNew;
        if (fullC) client.scanned = new Date().toISOString();
        client.readErrors = cf.errors || 0;
        total += client.photos;
        await DB.put('clients', client);
        // 4.47.4: each client's photos show on the open pages as soon as that client is read
        // (before, nothing changed on screen until every client was done).
        touch('photos');
      }
      await meta.set('regs', regs);
      let moved = 0;
      if (full && (added || removed)) { moved = await followMoves(gen, pres, alias).catch(e => { console.warn('PageProof moved photos:', e); return 0; }); added -= moved; removed = Math.max(0, removed - moved); }
      await meta.set('scan', { at: new Date().toISOString(), full, added, removed, total, moved });
      if (full) await meta.set('fullScan', new Date().toISOString());
      queueDirty();
      await findDoubles().catch(() => {});
      await applyPendingFlags().catch(() => {});
      touch('photos');
      perf(full ? 'readEveryFolder' : 'readNewFolders', Date.now() - scanT0, total);
      return { clients: folders.length, photos: total, added, removed, moved };
    } finally { SCAN.busy = false; }
  }
  // 4.39 (Ben's pick): a photo that disappeared from its old place and turned up in a new one
  // (same file name, one of a kind on both sides) is the same photo moved. The new address is
  // pointed at the old record, so its copies, answers, flags and search dates all stay, and it
  // is not searched again as if it were new. Only full checks do this (they see what is gone).
  async function followMoves(gen, pres, alias) {
    const all = await DB.all('photos');
    const young = p => p.added === gen || (Date.now() - (p.added || 0) < 8 * DAY && !p.searches && !p.copies && !p.lastSearched);
    const fresh = all.filter(p => !p.gone && young(p) && !Object.values(alias).includes(p.id));
    if (!fresh.length) return 0;
    const under = p => pres.some(x => p.id.startsWith(x)) || Object.values(alias).includes(p.id);
    const olds = all.filter(p => !young(p) && !p.movedTo && (p.gone || !under(p)) && (p.searches || p.lastSearched || p.copies || p.flag));
    if (!olds.length) return 0;
    const key = p => String(p.name || '').toLowerCase();
    const count = list => { const m = new Map(); for (const p of list) m.set(key(p), (m.get(key(p)) || 0) + 1); return m; };
    const nf = count(fresh), no = count(olds.concat(all.filter(p => !p.gone && !young(p) && under(p))));
    const byName = new Map(olds.map(p => [key(p), p]));
    const put = [], del = [];
    for (const n of fresh) {
      const k = key(n);
      if (!k || nf.get(k) !== 1 || no.get(k) !== 1) continue;
      const o = byName.get(k);
      if (!o || !!o.extra !== !!n.extra) continue;
      alias[n.id] = o.id;
      for (const [a, b] of Object.entries(alias)) if (b === n.id) alias[a] = o.id;
      Object.assign(o, { rel: n.rel, name: n.name, folder: n.folder, year: n.year, quarter: n.quarter, day: n.day, client: n.client, extra: n.extra, gone: false, movedAt: new Date().toISOString() });
      o.order = newness(o);
      if (n.lastSearched > (o.lastSearched || '')) o.lastSearched = n.lastSearched;
      o.searches = (o.searches || 0) + (n.searches || 0);
      put.push(o); del.push(n.id);
    }
    if (!put.length) return 0;
    await DB.putMany('photos', put);
    await DB.delMany('photos', del);
    await meta.set('photoAlias', alias);
    await meta.set('movedNote', { at: new Date().toISOString(), n: put.length, seen: false });
    return put.length;
  }
  async function missingPicks() { return (await meta.get('missingPicks')) || []; }
  // 4.42 (Ben's pick): new client folders. Once a week the first two levels of the top folder are
  // listed (names only, nothing inside is read) and compared with last week. A new folder that
  // isn't ticked (or inside a ticked one) and has no client_info_ignore.txt shows on Home.
  async function watchFolders() {
    const names = [];
    for (const t of await subfolders('')) {
      names.push(t.rel);
      try { for (const s2 of await subfolders(t.rel)) names.push(s2.rel); } catch (e) { /* that folder could not be listed */ }
    }
    const base = await meta.get('folderBase');
    await meta.set('folderBase', names);
    if (!Array.isArray(base)) return [];               // the first time it only remembers what is there
    const pk = (await picked()) || [], had = new Set(base);
    const covered = r => pk.some(x => r === x || r.startsWith(x + '/') || x.startsWith(r + '/'));
    let fresh = names.filter(n => !had.has(n) && !covered(n));
    fresh = fresh.filter(n => !fresh.some(o => o !== n && n.startsWith(o + '/')));     // a new group: just the group
    const out = [];
    for (const rel of fresh.slice(0, 40)) {
      const info = await folderInfo(rel).catch(() => ({}));
      if (info.ignore) continue;
      out.push({ rel, id: info.id || '', at: new Date().toISOString() });
    }
    const was = ((await meta.get('newFolders')) || []).filter(f => names.includes(f.rel) && !covered(f.rel));
    const all = was.concat(out.filter(o => !was.some(w => w.rel === o.rel)));
    await meta.set('newFolders', all);
    if (out.length && typeof PP_STATS !== 'undefined') PP_STATS.add('drive.newFolders', out.length);
    return out;
  }
  async function newFolders() {
    const pk = (await picked()) || [];
    const covered = r => pk.some(x => r === x || r.startsWith(x + '/') || x.startsWith(r + '/'));
    return ((await meta.get('newFolders')) || []).filter(f => !f.seen && !covered(f.rel));
  }
  async function newFoldersSeen() { await meta.set('newFolders', ((await meta.get('newFolders')) || []).map(f => ({ ...f, seen: true }))); }
  async function movedNote() { return meta.get('movedNote'); }
  // Just the client folders and a photo count for each (setup step 3). Fast-ish.
  async function quickClients(progress) {
    const folders = await clientFolders();
    const known = new Map((await DB.all('clients')).map(c => [c.name, c]));
    const out = [];
    for (const cf of folders) {
      const old = known.get(cf.name);
      out.push({ name: cf.name, folder: cf.folder, rel: cf.rel, baseName: cf.baseName, extra: !!cf.extra, pick: cf.pick || '', searching: old ? old.searching : null, priority: old ? !!old.priority : false, photos: old ? old.photos : 0, licensed: old ? old.licensed || [] : [] });
      if (progress) progress(out.length, folders.length);
    }
    await DB.putMany('clients', out.map(c => ({ ...(known.get(c.name) || {}), ...c })));
    return out;
  }

  // ---------------------------------------------------------------- registration numbers
  // The nearest folder (this one, or one above it) with a VA or 1-… number.
  async function regFor(photo) {
    const regs = (await meta.get('regs')) || {};
    let rel = photo.folder || '';
    const found = {};
    while (rel) {
      const r = regs[rel];
      if (r) {
        if (r.va && !found.va) { found.va = r.va; found.vaFrom = r.from; }
        if (r.app && !found.app) { found.app = r.app; found.appFrom = r.from; }
        if (found.va && found.app) break;
      }
      rel = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
    }
    return found.va || found.app ? { va: found.va, app: found.app, from: found.vaFrom || found.appFrom, manual: false } : null;
  }
  // "Add the number": typed once, it sticks for the whole folder.
  async function setReg(folder, text) {
    const regs = (await meta.get('regs')) || {};
    const r = regIn(text) || {};
    if (!r.va && !r.app) return false;
    regs[folder] = { ...r, from: 'Typed in by you for this folder', manual: true };
    await meta.set('regs', regs);
    backupSoon(); touch('regs');
    return true;
  }

  // ---------------------------------------------------------------- doubles (the same picture twice)
  // A tiny "look" fingerprint (64-bit difference hash) of each photo, made when it is searched.
  // Two photos of one client whose fingerprints are almost the same are the same picture:
  // the older one is searched, the other is noted, and every copy says which it matches.
  async function lookHash(blob) {
    const b = await createImageBitmap(blob);
    const c = new OffscreenCanvas(9, 8), x = c.getContext('2d');
    x.drawImage(b, 0, 0, 9, 8);
    b.close && b.close();
    const d = x.getImageData(0, 0, 9, 8).data;
    let bits = '';
    for (let y = 0; y < 8; y++) for (let i = 0; i < 8; i++) {
      const a = (y * 9 + i) * 4, b2 = a + 4;
      bits += (d[a] * 3 + d[a + 1] * 6 + d[a + 2]) > (d[b2] * 3 + d[b2 + 1] * 6 + d[b2 + 2]) ? '1' : '0';
    }
    return parseInt(bits.slice(0, 32), 2).toString(16).padStart(8, '0') + parseInt(bits.slice(32), 2).toString(16).padStart(8, '0');
  }
  const hamming = (a, b) => { let n = 0; for (let i = 0; i < 16; i += 8) { let v = (parseInt(a.slice(i, i + 8), 16) ^ parseInt(b.slice(i, i + 8), 16)) >>> 0; while (v) { n += v & 1; v >>>= 1; } } return n; };
  async function findDoubles() {
    // Photos get their "look" together with their fingerprint, so the fingerprint list holds
    // every photo that can be compared (a small part of a big library).
    const all = (await tx('photos', 'readonly', o => o.index('hash').getAll())).filter(p => p.look && !p.gone);
    const byClient = {};
    for (const p of all) (byClient[p.client] = byClient[p.client] || []).push(p);
    const changed = [];
    for (const list of Object.values(byClient)) {
      list.sort((a, b) => (a.order - b.order) || a.rel.localeCompare(b.rel));
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (p.notDouble) continue;
        let main = null;
        for (let j = 0; j < i; j++) if (!list[j].doubleOf && !list[j].notDouble && hamming(p.look, list[j].look) <= 5 && Math.abs((p.w / p.h) - (list[j].w / list[j].h)) < 0.35) { main = list[j]; break; }
        const want = main ? main.id : null;
        if ((p.doubleOf || null) !== want) { p.doubleOf = want; changed.push(p); }
      }
    }
    await DB.putMany('photos', changed);
    return changed.length;
  }
  async function doublesOf(photo) {
    const mainId = photo.doubleOf || photo.id;
    const all = await DB.by('photos', 'client', photo.client);
    return all.filter(p => p.id === mainId || p.doubleOf === mainId);
  }

  // ---------------------------------------------------------------- which photo next
  // 1 High priority (next, then every 3 days) · 2 priority clients · 3 newest photos ·
  // 4 Popular and stolen before (every 7 days) · 5 everything else · quiet photos last.
  const ageDays = iso => iso ? (Date.now() - Date.parse(iso)) / DAY : Infinity;
  function monthsOld(p, now = new Date()) {
    const y = p.year || p.exifY, q = p.year ? p.quarter : p.exifQ;     // 4.42: EXIF date when the folders have none
    if (!y) return 999;
    const m = (now.getFullYear() - y) * 12 + now.getMonth() - ((q || 4) * 3 - 1);
    return Math.max(0, m);
  }
  // POOL photos (court photos shared with other papers, named like 10.29.26_POOL_Subject_Name.jpg)
  // may be used by others on purpose, so they are never searched. Rename without POOL to search.
  const isPool = name => /(^|[_\s.-])POOL([_\s.-]|$)/.test(String(name || ''));
  function plan(p, client) {
    if (isPool(p.name)) return { tier: 7, due: false, pool: true };
    // Stopped by hand ("Stop searching this photo", Ben 4.52): never searched by Keep searching or
    // Today's 50 until someone turns it back on. Its copies found so far stay.
    if (p.stopped) return { tier: 7, due: false, stopped: true };
    const since = ageDays(p.lastSearched);
    if (p.retry) return { tier: 0, due: true };                       // "Try again" on the Skipped photos page
    // A photo that could not be opened is tried again every 3 months (never, if it is a kind
    // of file that can't be searched).
    if (p.unreadable) return { tier: 6, due: p.skip !== 'type' && since > 90, quiet: true };
    if (p.flag === 'hi' && (since > 3 || !p.lastSearched || (p.flagged && p.flagged > (p.lastSearched || '')))) return { tier: 0, due: true };
    // 4.42 hot shoot: a photo from the same shoot as one just marked Stolen goes next (once).
    if (p.hot && p.hot > (p.lastSearched || '')) return { tier: 0, due: true, hot: true };
    // 4.42 new photo fast lane: a photo that arrived in Drive (not in the first big read) is
    // searched within the hour, then again 3, 7 and 14 days after its first search.
    if (p.fresh && !p.lastSearched) return { tier: 0, due: true, fresh: true };
    if (p.fresh && p.firstAt) {
      const a = ageDays(p.firstAt), cp = [14, 7, 3].find(d => a >= d);
      if (a <= 30 && cp && Date.parse(p.lastSearched) < Date.parse(p.firstAt) + (cp - 0.5) * DAY) return { tier: 1, due: true, fresh: true };
    }
    const quiet = p.empty >= 10 ? 90 : p.empty >= 5 ? 30 : 0;
    if (quiet && !p.flag) return { tier: 6, due: since > quiet, quiet: true };
    if ((p.flag === 'pop' || p.stolen > 0) && since > 7) return { tier: 3, due: true };
    const age = monthsOld(p);
    const every = age <= 3 ? 30 : age <= 12 ? 180 : 365;
    const due = !p.lastSearched || since > every;
    if (client && client.priority) return { tier: 1, due: due || (since > 7 && age <= 3) };
    return { tier: age <= 3 ? 2 : 4, due };
  }
  let QUEUE = null, QUEUE_AT = 0, FIRST = [], QUICKED = new Set();
  // quiet = only this page's list (a photo was just searched: the Keep searching window skips it
  // anyway). Otherwise every page rebuilds its list (flags, clients or folders changed).
  function queueDirty(quiet) { QUEUE = null; if (!quiet) api.storage.local.set({ fcQueueDirty: Date.now() }).catch(() => {}); }
  function resetQueue() { QUEUE = null; }
  // Searched at least once (a photo that could not be opened does not count).
  const searchedOnce = p => (p.searches || 0) > 0 || (!!p.lastSearched && !p.unreadable);
  // Can never be searched as it is: POOL photos, and files that would not open.
  const cantSearch = p => isPool(p.name) || !!p.unreadable;
  async function buildQueue() {
    const t0 = Date.now();
    const clients = new Map((await DB.all('clients')).map(c => [c.name, c]));
    const photos = await DB.all('photos');
    const out = [], fresh = new Map(), waitBurst = [], quicked = new Set();
    for (const p of photos) {
      if (p.gone || p.doubleOf) continue;
      const c = clients.get(p.client);
      if (!c || c.searching !== true) continue;
      if (p.stopped) continue;
      // Never searched yet: the "every photo once" line (4.10, Ben).
      // 4.42 bursts: a frame that looks almost the same as one already searched (with nothing found)
      // waits until every other photo has had its first search.
      if (!searchedOnce(p) && !cantSearch(p) && p.quickAt) quicked.add(p.id);
      if (!searchedOnce(p) && !cantSearch(p)) { if (p.burstWait) { waitBurst.push(p); continue; } if (!fresh.has(p.client)) fresh.set(p.client, []); fresh.get(p.client).push(p); }
      const pl = plan(p, c);
      // Only photos that are due. (Photos that are not due used to sit at the end of the line,
      // so once everything due was done, quiet photos, photos searched last week and TIFF/HEIC
      // files that can never be searched were tried anyway, one after another.)
      if (!pl.due) continue;
      out.push({ id: p.id, tier: pl.tier, order: p.order || 0, last: p.lastSearched || '' });
    }
    // Inside each tier: never searched first, then newest folders, then searched longest ago.
    out.sort((a, b) => a.tier - b.tier || (!!a.last - !!b.last) || b.order - a.order || a.last.localeCompare(b.last));
    QUEUE = out; QUEUE_AT = Date.now();
    FIRST = firstLine(fresh, clients).concat(waitBurst.sort((a, b) => (b.order || 0) - (a.order || 0)).map(p => p.id));
    QUICKED = quicked;
    perf('searchLine', Date.now() - t0, photos.length);
    return out;
  }
  // The never-searched line: ★ priority clients first, then the clients take turns (one photo
  // each, round and round) so no client stays at 0% while another finishes. Newest photos first
  // inside each client.
  // Random years (Ben): inside each client, 2 of every 3 first searches are its newest photos
  // and 1 comes from a randomly picked older year, so every year gets looked at from the start.
  const yearOfP = p => p.year || p.exifY || 0;
  function mixYears(list, rnd = Math.random) {
    const years = new Map();
    for (const p of list) { const y = yearOfP(p); if (!years.has(y)) years.set(y, []); years.get(y).push(p); }
    if (years.size < 2) return list;
    const used = new Set(), out = [];
    let ni = 0;
    const nextNew = () => { while (ni < list.length && used.has(list[ni].id)) ni++; return list[ni]; };
    while (out.length < list.length) {
      let p = null;
      if (out.length % 3 === 2) {
        const head = nextNew(), hy = head ? yearOfP(head) : null;
        const left = [...years.entries()].filter(([y, l]) => y !== hy && l.some(o => !used.has(o.id)));
        if (left.length) { const [, l] = left[Math.floor(rnd() * left.length)]; p = l.find(o => !used.has(o.id)); }
      }
      p = p || nextNew();
      if (!p) break;
      used.add(p.id); out.push(p);
    }
    return out;
  }
  // Ben (4.49 follow-up): with many clients taking turns, each client's own 1-in-3 older pick
  // came too late, so a batch of 10 was all this year. Now the whole line mixes: after every 2
  // newest photos comes 1 random photo (any spot, not just the newest) from a random older year
  // of a random client. Only the first part of the line is mixed (that is what gets searched).
  function mixLine(list, rnd = Math.random, upto = 6000) {
    const head = list.slice(0, upto), rest = list.slice(upto);
    const buckets = new Map(); // client -> Map(year -> [photos])
    for (const p of head) {
      if (!buckets.has(p.client)) buckets.set(p.client, new Map());
      const ys = buckets.get(p.client), y = yearOfP(p);
      if (!ys.has(y)) ys.set(y, []);
      ys.get(y).push(p);
    }
    const used = new Set(), out = [];
    let ni = 0;
    const nextNew = () => { while (ni < head.length && used.has(head[ni].id)) ni++; return head[ni]; };
    const live = l => { while (l.length && used.has(l[l.length - 1].id)) l.pop(); return l.length > 0; };
    while (out.length < head.length) {
      let p = null;
      if (out.length % 3 === 2) {
        const nw = nextNew(), cands = [];
        for (const [c, ys] of buckets) {
          // A client's "newest" year is the year of its next newest photo; the other years are older.
          let top = null;
          for (const [y, l] of ys) if (live(l) && (top === null || y > top)) top = y;
          for (const [y, l] of ys) if (y !== top && l.length) cands.push(l);
        }
        for (let t = 0; !p && cands.length && t < 40; t++) {
          const l = cands[Math.floor(rnd() * cands.length)];
          if (!l.length) continue;
          const i = Math.floor(rnd() * l.length), q = l[i];
          l[i] = l[l.length - 1]; l.pop();
          if (!used.has(q.id)) p = q;
        }
      }
      p = p || nextNew();
      if (!p) break;
      used.add(p.id); out.push(p);
    }
    return out.concat(rest);
  }
  function firstLine(fresh, clients) {
    const turns = names => {
      const lists = names.map(n => fresh.get(n).sort((a, b) => (b.order || 0) - (a.order || 0)));
      const ps = [];
      for (let i = 0, any = true; any; i++) { any = false; for (const l of lists) if (i < l.length) { ps.push(l[i]); any = true; } }
      return mixLine(ps).map(p => p.id);
    };
    const names = [...fresh.keys()].sort();
    const pri = names.filter(n => clients.get(n) && clients.get(n).priority);
    return turns(pri).concat(turns(names.filter(n => !pri.includes(n))));
  }
  // The next n photos to search (skipping ids in "skip": already running or just done).
  // Every share-th search (1 in 3 unless changed) is a photo never searched before, until there
  // are none left. ⚑ High priority photos (and "Try again") always go first.
  // first = true (Today's 50 set to "Never searched first"): never-searched photos first, then
  // the normal line.
  // 4.51.2 (Ben): a photo another search already has is never picked again. Two searches
  // started minutes apart (Today's 50 "Next in line", then "Never searched first") both began
  // with the same photos: the first search was still checking its matches, and each page keeps
  // its own copy of the line for up to an hour, so neither knew. Now every pick leaves out
  // (1) photos in a search from the last day that are waiting, searching or being checked, and
  // (2) photos searched or quick-looked since this page made its line.
  let CLAIM = null;
  async function claimed() {
    if (CLAIM && Date.now() - CLAIM.at < 3000) return CLAIM.ids;
    const ids = new Set(), cut = Date.now() - DAY;
    // Photos a big search is still getting ready from Google Drive (its search isn't saved yet).
    try { const h = (await api.storage.local.get('fcHold')).fcHold; if (h && Date.now() - h.at < 15 * 60000) for (const id of h.ids || []) ids.add(id); } catch (e) { /* none */ }
    try {
      if (typeof RS_DB !== 'undefined') for (const j of await (RS_DB.since ? RS_DB.since('jobs', cut) : RS_DB.all('jobs'))) {
        if (!j || !Array.isArray(j.pics) || (Date.parse(j.created) || 0) < cut) continue;
        const live = !j.finished && !j.stoppedAt;
        for (const q of [...j.pics, ...(j.alike || [])]) {
          if (!q || !q.fcId || q.ingested) continue;
          const searched = q.runs && Object.values(q.runs).some(r => r && r.state === 'done');
          if (live || searched) ids.add(q.fcId);
        }
      }
    } catch (e) { /* no searches saved yet */ }
    CLAIM = { at: Date.now(), ids };
    return ids;
  }
  function claimReset() { CLAIM = null; }
  async function next(n = 1, skip = new Set(), opts = {}) {
    const used = new Set(skip);
    for (const id of await claimed()) used.add(id);
    const out = [];
    let stale = false;
    for (let round = 0; round < 6 && out.length < n; round++) {
      const got = await pickLine(n - out.length, used, { ...opts, solo: n === 1 && !opts.first });
      if (!got.length) break;
      const since = new Date(QUEUE_AT || 0).toISOString();
      for (const p of got) {
        used.add(p.id);
        // Searched (or quick-looked) by another page since this line was made: skip it.
        if ((p.lastSearched || '') > since || (p.quickAt || '') > since || (p.alikeAt || '') > since) { stale = true; continue; }
        out.push(p);
      }
    }
    if (stale) QUEUE = null;
    // A big search (Today's 50, New search) holds its photos while they are read from Drive.
    if (opts.hold && out.length) await api.storage.local.set({ fcHold: { at: Date.now(), ids: out.map(p => p.id) } }).catch(() => {});
    return out;
  }
  async function pickLine(n = 1, skip = new Set(), opts = {}) {
    if (!QUEUE || Date.now() - QUEUE_AT > 3600000) await buildQueue();
    const k = await keep();
    const share = [2, 3, 4].includes(k.firstShare) ? k.firstShare : 3;
    // Keep searching (one photo at a time) remembers whose turn it is between photos.
    const solo = opts.solo != null ? opts.solo : n === 1 && !opts.first;
    let turn = solo ? ((await api.storage.local.get('fcFirstTurn')).fcFirstTurn || 0) : 0;
    const used = new Set(skip);
    let qi = 0, fi = 0;
    // 4.42 per-site lanes: Yandex and Bing's extra photos are re-searches only (photos searched
    // before, not ⚑ High, new or hot), so every first search still gets all three sites.
    // Speed-ups: the Yandex and Bing lane's quick looks. Photos never searched and never quick-
    // looked, in the same order as the first-search line (then re-searches, below).
    if (opts.quick) {
      const ids = [];
      // Google resting or off: ⚑ High priority photos (and "Try again") are not left waiting.
      if (opts.high) for (const q of QUEUE) { if (ids.length >= n || q.tier > 0) break; if (!used.has(q.id)) { ids.push(q.id); used.add(q.id); } }
      for (const id of FIRST) { if (ids.length >= n) break; if (!used.has(id) && !QUICKED.has(id)) { ids.push(id); used.add(id); } }
      if (ids.length) return (await DB.getMany('photos', ids)).filter(Boolean);
      opts = { ...opts, repeat: true };
    }
    if (opts.repeat) {
      const ids = [];
      for (const q of QUEUE) { if (ids.length >= n) break; if (q.tier > 0 && q.last && !used.has(q.id)) { ids.push(q.id); used.add(q.id); } }
      return (await DB.getMany('photos', ids)).filter(Boolean);
    }
    const nq = () => { while (qi < QUEUE.length && used.has(QUEUE[qi].id)) qi++; return QUEUE[qi]; };
    const nf = () => { while (fi < FIRST.length && used.has(FIRST[fi])) fi++; return FIRST[fi]; };
    const ids = [];
    while (ids.length < n) {
      const q = nq(), f = nf();
      if (!q && !f) break;
      let id;
      if (q && q.tier === 0) id = q.id;
      else if (f && (opts.first || !q || turn % share === share - 1)) { id = f; turn++; }
      else { id = q.id; turn++; }
      used.add(id); ids.push(id);
    }
    if (solo && ids.length) api.storage.local.set({ fcFirstTurn: turn % 1200 }).catch(() => {});
    const got = [];
    for (const id of ids) { const p = await DB.get('photos', id); if (p) got.push(p); }
    return got;
  }
  // How up to date each group is ("Where the searches go").
  async function coverage() {
    if (COVER && Date.now() - COVER.at < 600000) return COVER.v;
    const clients = new Map((await DB.all('clients')).map(c => [c.name, c]));
    const g = { top: [0, 0], recent: [0, 0], year: [0, 0], older: [0, 0] };
    let quiet = 0, doubles = 0, total = 0;
    // Every photo searched at least once (4.10): per client [searched once, can be searched, can't].
    const first = { done: 0, total: 0, stopped: 0, cant: 0, pool: 0, broken: 0, week: 0, quick: 0, clients: {} };
    const weekAgo = new Date(Date.now() - 7 * DAY).toISOString();
    for (const p of await DB.all('photos')) {
      if (p.gone) continue;
      if (p.doubleOf) { doubles++; continue; }
      const c = clients.get(p.client);
      if (!c || c.searching !== true) continue;
      if (p.stopped) { first.stopped++; continue; }
      total++;
      // [searched once (with Google), can be searched, can't, quick look or more (any site)]
      const fc = first.clients[p.client] = first.clients[p.client] || [0, 0, 0, 0];
      if (cantSearch(p)) { first.cant++; fc[2]++; if (isPool(p.name)) first.pool++; else first.broken++; }
      else { first.total++; fc[1]++; if (searchedOnce(p)) { first.done++; fc[0]++; } if (searchedOnce(p) || p.quickAt) { first.quick++; fc[3]++; } }
      if (p.firstAt && p.firstAt > weekAgo) first.week++;
      const since = ageDays(p.lastSearched), age = monthsOld(p);
      const k = p.flag === 'hi' || (c && c.priority) ? 'top' : age <= 3 ? 'recent' : age <= 12 ? 'year' : 'older';
      const ok = k === 'top' ? since <= 7 : k === 'recent' ? since <= 30 : k === 'year' ? since <= 183 : since <= 365;
      g[k][1]++; if (ok) g[k][0]++;
      if (p.empty >= 5) quiet++;
    }
    first.never = first.total - first.done;
    first.pri = [...clients.values()].filter(c => c.priority).map(c => c.name);
    await firstFinished(first.clients).catch(() => {});
    COVER = { at: Date.now(), v: { groups: g, total, quiet, doubles, first } };
    // A small copy for Home, so Home never has to read every photo.
    api.storage.local.set({ fcFirst: { at: Date.now(), done: first.done, total: first.total, never: first.never, cant: first.cant, week: first.week, pri: first.pri, clients: first.clients } }).catch(() => {});
    return COVER.v;
  }
  // A client just reached 100% (every photo searched at least once): a note for Home and the
  // weekly summary. New photos can take a client below 100% again; it gets a new note when it
  // gets back to 100%. The first time this runs, it only remembers where everyone is.
  async function firstFinished(per) {
    const was = (await meta.get('firstState')) || null, now = {}, notes = (await meta.get('firstNotes')) || [];
    let added = false;
    for (const [name, [d, t]] of Object.entries(per)) {
      now[name] = t > 0 && d >= t;
      if (was && now[name] && was[name] === false) { notes.unshift({ name, n: t, at: new Date().toISOString() }); added = true; }
    }
    await meta.set('firstState', now);
    if (added) { await meta.set('firstNotes', notes.slice(0, 50)); touch('firstNotes'); }
  }
  async function firstNotes() { return (await meta.get('firstNotes')) || []; }

  // ---------------------------------------------------------------- photos that could not be searched
  // Kept as a short list (newest first) so the Skipped photos page never has to read every photo.
  const SKIP_WHY = {
    type: 'TIFF and HEIC photos can\'t be searched. Save a JPG copy in the same folder and that copy is searched.',
    gone: 'The file is no longer in that Drive folder (moved, renamed or deleted).',
    empty: 'The file is empty (0 bytes). Google Drive may still be uploading it.',
    broken: 'The file would not open as a picture. It may be damaged, or not really a photo.',
  };
  const SKIP_LABEL = { type: 'Kind of file', gone: 'File not found', empty: 'Empty file', broken: 'Would not open' };
  async function skipped() { const l = await meta.get('skipped'); return Array.isArray(l) ? l : []; }
  async function noteSkip(p, kind) {
    p.unreadable = SKIP_WHY[kind] || SKIP_WHY.broken; p.skip = kind;
    p.lastSearched = new Date().toISOString(); delete p.retry;
    await DB.put('photos', p);
    const list = (await skipped()).filter(x => x[0] !== p.id);
    list.unshift([p.id, p.name, p.client || '', kind, p.lastSearched]);
    await meta.set('skipped', list.slice(0, 5000));
    queueDirty(true); touch('skipped');
  }
  async function clearSkip(ids) {
    const drop = new Set(ids);
    const list = await skipped();
    if (list.some(x => drop.has(x[0]))) { await meta.set('skipped', list.filter(x => !drop.has(x[0]))); touch('skipped'); }
  }
  // "Try again": the photos go to the front of the line.
  async function retrySkipped(ids) {
    const all = await skipped();
    const want = ids ? all.filter(x => ids.includes(x[0])) : all.filter(x => x[3] !== 'type');
    const got = (await DB.getMany('photos', want.map(x => x[0]))).filter(Boolean);
    for (const p of got) { delete p.unreadable; delete p.skip; p.retry = 1; }
    await DB.putMany('photos', got);
    await clearSkip(want.map(x => x[0]));
    queueDirty();
    return got.length;
  }
  // Open one photo from Drive, ready to search. Never throws: { error, soft } when it can't.
  // soft = nothing wrong with the photo (Drive can't be reached): it is simply tried again later.
  // The date the camera wrote (EXIF DateTimeOriginal looks like 2026:11:22 14:03:11).
  function exifDate(bytes) {
    let t = '';
    for (let i = 0; i < bytes.length; i += 8192) t += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    const m = /((?:19|20)\d\d):(0[1-9]|1[0-2]):(0[1-9]|[12]\d|3[01]) [0-2]\d:[0-5]\d:[0-5]\d/.exec(t);
    if (!m) return null;
    const y = +m[1];
    return y > new Date().getFullYear() ? null : { y, m: +m[2], d: +m[3] };
  }
  // Another frame of the same burst: same folder, looks almost the same, searched with nothing found.
  const folderOf = id => String(id).slice(0, String(id).lastIndexOf('/') + 1);
  // How alike two frames' "look" fingerprints must be (of 64 bits): 10 before the speed-ups,
  // now 14, because a waiting frame is also checked against its twin's finds (alikeFrames).
  const ALIKE = 14;
  // Speed-ups (Ben's pick): look-alike frames share one search. Before a photo's search, up to
  // 6 never-searched photos next to it in the same folder are opened; those that look almost
  // the same (and the ones already waiting behind it) come along: every link the search finds
  // is checked against them too, and they wait for their own search until every other photo had
  // its first search. Returns up to 3 ready pictures (with fcId), for RS_JOB.create's alike.
  async function alikeFrames(p, look) {
    if (!look) return [];
    const dir = folderOf(p.id);
    const all = (await DB.prefix('photos', dir)).filter(o => folderOf(o.id) === dir && !o.gone).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const at = all.findIndex(o => o.id === p.id);
    const near = all.filter((o, i) => o.id !== p.id && Math.abs(i - at) <= 3 && !searchedOnce(o) && !cantSearch(o) && !o.doubleOf && (!o.burstWait || o.burstWait === p.id))
      .sort((a, b) => (a.burstWait === p.id ? 0 : 1) - (b.burstWait === p.id ? 0 : 1));
    const out = [];
    for (const o of near) {
      if (out.length >= 3) break;
      try {
        const file = await fileFor(o);
        if (!o.look) { o.look = await lookHash(file); await DB.put('photos', o); }
        if (o.burstWait !== p.id && hamming(o.look, look) > ALIKE) continue;
        const pic = await RS_JOB.prepare(file, { fcId: o.id, folderKey: o.rel });
        if (!pic || pic.error) continue;
        if (o.burstWait !== p.id) { o.burstWait = p.id; o.burstChecked = 1; await DB.put('photos', o); queueDirty(true); }
        out.push(pic);
      } catch (e) { /* not readable now: it gets its own search */ }
    }
    if (out.length && typeof PP_STATS !== 'undefined') PP_STATS.add('keep.alike.n', out.length);
    return out;
  }
  async function burstSibling(p) {
    if (!p.look) return null;
    const dir = folderOf(p.id);
    for (const o of await DB.prefix('photos', dir)) {
      if (o.id === p.id || o.gone || !o.look || folderOf(o.id) !== dir || !searchedOnce(o) || o.copies || o.stolen) continue;
      if (hamming(o.look, p.look) <= ALIKE && (!o.w || !p.w || Math.abs(o.w / o.h - p.w / p.h) < 0.2)) return o;
    }
    return null;
  }
  async function readPhoto(p, opts = {}) {
    const t0 = Date.now();
    if (/\.(tiff?|heic|heif)$/i.test(p.name || '')) { await noteSkip(p, 'type'); return { error: SKIP_WHY.type }; }
    let file;
    try { file = await fileFor(p); }
    catch (e) {
      if (e && e.name === 'NotFoundError' && (await driveState(true)) === 'granted') { await noteSkip(p, 'gone'); return { error: SKIP_WHY.gone }; }
      if (typeof PP_STATS !== 'undefined') PP_STATS.add('drive.openFailed');
      return { error: 'Google Drive could not be reached for this photo.', soft: true };
    }
    if (!file.size) { await noteSkip(p, 'empty'); return { error: SKIP_WHY.empty }; }
    let pic;
    try { pic = await RS_JOB.prepare(file, { fcId: p.id, folderKey: p.rel }); } catch (e) { pic = { error: String(e && e.message || e) }; }
    if (pic.error) { await noteSkip(p, 'broken'); return { error: SKIP_WHY.broken }; }
    if (p.unreadable || p.skip) { delete p.unreadable; delete p.skip; await DB.put('photos', p); await clearSkip([p.id]); }
    // 4.42: a photo whose folders give no year gets its date from the camera (EXIF), once.
    if (!p.year && !p.exifY && !p.exifTried) {
      p.exifTried = 1;
      try { const d = exifDate(new Uint8Array(await file.slice(0, 131072).arrayBuffer())); if (d) { p.exifY = d.y; p.exifQ = Math.ceil(d.m / 3); p.order = newness(p); } } catch (e) { /* no date */ }
      await DB.put('photos', p); queueDirty(true);
    }
    // 4.42 bursts: a frame that looks almost the same as one from the same folder that was
    // already searched and found nothing waits until every other photo has had its first search.
    if (opts.burst && !searchedOnce(p) && !p.burstWait && !p.burstChecked && pic.blob) {
      p.burstChecked = 1;
      try {
        p.look = p.look || await lookHash(pic.blob);
        const sib = await burstSibling(p);
        if (sib) { p.burstWait = sib.id; await DB.put('photos', p); queueDirty(true); if (typeof PP_STATS !== 'undefined') PP_STATS.add('keep.burstWait'); perf('openPhoto', Date.now() - t0, Math.round(file.size / 1024)); return { error: 'Looks the same as ' + sib.name + ' (same burst), which found nothing. It waits until every other photo has had its first search.', burst: true, soft: true }; }
      } catch (e) { /* search it */ }
      await DB.put('photos', p);
    }
    perf('openPhoto', Date.now() - t0, Math.round(file.size / 1024));
    return pic;
  }

  // ---------------------------------------------------------------- are the search sites working?
  // Each search site keeps a tally: how many photos in a row came back with nothing at all, or
  // with no answer. Past the limit the site is treated as broken (its page has probably changed):
  // it rests for 6 hours, you are told, and the empty results of that run are not held against
  // the photos (a photo with 5 empty searches is otherwise searched only monthly).
  const ENGINE_LIMIT = { google: 10, yandex: 30, bing: 30 }, FAIL_LIMIT = 8, ENGINE_REST = 6 * 3600000;
  const ENGINE_NAME = { google: 'Google Lens', yandex: 'Yandex', bing: 'Bing' };
  async function engines() { return (await api.storage.local.get('fcEngines')).fcEngines || {}; }
  // results: { google: 12, yandex: 0, bing: -1 } = links read off each site (-1 = no answer).
  // emptied = this photo's search found no copies at all (so its "empty" count went up).
  async function engineResults(results, photoId, emptied) {
    const all = await engines(), now = Date.now();
    const anyAnswer = Object.values(results).some(n => n >= 0);
    const broke = [];
    for (const [e, n] of Object.entries(results)) {
      const h = all[e] = { zeros: 0, fails: 0, ids: [], ...(all[e] || {}) };
      h.last = now;
      if (n > 0) { all[e] = { ok: now, zeros: 0, fails: 0, ids: [], last: now }; continue; }
      if (n === 0) { h.zeros++; h.fails = 0; if (emptied && photoId) h.ids = [...h.ids, photoId].slice(-40); }
      // No answer only counts when another site did answer, or the computer says it is online
      // (otherwise it is the internet connection, not the site).
      else if (anyAnswer || (globalThis.navigator && navigator.onLine)) h.fails++;
      const why = h.zeros >= (ENGINE_LIMIT[e] || 30) ? 'zeros' : h.fails >= FAIL_LIMIT ? 'fails' : '';
      if (why && !(h.until > now)) {
        h.until = now + ENGINE_REST; h.brokenAt = now; h.why = why;
        if (typeof PP_STATS !== 'undefined') { PP_STATS.add('eng.' + e + '.broke'); PP_STATS.add('eng.' + e + '.restMin', Math.round(ENGINE_REST / 60000)); }
        broke.push([e, h.ids.slice(), why === 'zeros' ? h.zeros : h.fails, why]);
        h.ids = [];
      }
    }
    await api.storage.local.set({ fcEngines: all });
    for (const [e, ids, n, why] of broke) {
      // Take back the "found nothing" marks of that run.
      const ps = (await DB.getMany('photos', [...new Set(ids)])).filter(p => p && p.empty > 0);
      for (const p of ps) p.empty--;
      await DB.putMany('photos', ps);
      queueDirty();
      try {
        api.notifications.create('fcEngine:' + e, { type: 'basic', iconUrl: api.runtime.getURL('icons/icon128.png'), title: ENGINE_NAME[e] + ' may have stopped working',
          message: (why === 'zeros' ? 'It found nothing at all for ' + n + ' photos in a row.' : 'It gave no answer for ' + n + ' photos in a row.') + ' PageProof is resting it for 6 hours. Those empty results are not counted against your photos.', priority: 1 });
      } catch (err) { /* no notifications here */ }
    }
    return broke.map(b => b[0]);
  }
  // Sites resting because they look broken: { google: untilTime }.
  async function brokenEngines() {
    const now = Date.now();
    return Object.fromEntries(Object.entries(await engines()).filter(([, h]) => h.until > now).map(([e, h]) => [e, h.until]));
  }
  // "Try it now": the very next photo tests the site again.
  async function retryEngine(e) {
    const all = await engines();
    if (all[e]) { delete all[e].until; all[e].zeros = Math.max(0, (ENGINE_LIMIT[e] || 30) - 1) * (all[e].why === 'zeros' ? 1 : 0); all[e].fails = all[e].why === 'fails' ? FAIL_LIMIT - 1 : 0; await api.storage.local.set({ fcEngines: all }); }
  }

  // ---------------------------------------------------------------- how long things take
  // The last time and the slowest time of a few jobs, for "Is everything working?" and
  // "Copy details for support". Numbers only: never a file name or a client's name.
  let perfBuf = null, perfT = null;
  function perf(name, ms, n) {
    if (typeof PP_STATS !== 'undefined') PP_STATS.time('drive.' + name, ms);
    perfBuf = perfBuf || {};
    perfBuf[name] = { ms: Math.round(ms), n: n == null ? undefined : n };
    clearTimeout(perfT);
    perfT = setTimeout(async () => {
      const buf = perfBuf; perfBuf = null;
      try {
        const all = (await api.storage.local.get('fcPerf')).fcPerf || {};
        for (const [k, v] of Object.entries(buf)) { const o = all[k] || { max: 0, runs: 0 }; all[k] = { ms: v.ms, n: v.n, at: Date.now(), max: Math.max(o.max || 0, v.ms), runs: (o.runs || 0) + 1 }; }
        await api.storage.local.set({ fcPerf: all });
      } catch (e) { /* not important */ }
    }, 1500);
  }
  const timed = async (name, fn, count) => { const t0 = Date.now(); const r = await fn(); perf(name, Date.now() - t0, count ? count(r) : undefined); return r; };

  // ---------------------------------------------------------------- photos from a search
  // A photo you searched that is not in Drive (dragged in, pasted) is kept by its fingerprint.
  // Its client: a client's name in the file name, else "Client unknown" until you set it once.
  async function photoForPic(pic) {
    if (pic.fcId) { const p = await DB.get('photos', pic.fcId); if (p) return p; }
    const same = pic.hash ? await DB.by('photos', 'hash', pic.hash) : [];
    if (same.length) return same.find(p => !p.gone) || same[0];
    const id = 'h:' + pic.hash;
    const old = await DB.get('photos', id);
    if (old) return old;
    const names = (await DB.all('clients')).map(c => c.name).sort((a, b) => b.length - a.length);
    const low = pic.name.toLowerCase();
    const client = names.find(n => n.length > 2 && low.includes(n.toLowerCase())) || '';
    const p = { id, client, name: pic.name, rel: '', folder: '', year: yearOf(pic.name), quarter: 0, day: dayOf(pic.name), flag: '', searches: 0, empty: 0, copies: 0, stolen: 0, added: Date.now(), uploaded: true };
    p.order = newness(p);
    return p;
  }

  // ---------------------------------------------------------------- copies found
  // A copy is one link for one photo. status: new · stolen · licensed · removed
  // (skip keeps it new, but puts it at the back of the review line).
  // online: up · gone · back
  const SOCIAL = /(^|\.)(facebook|fb|instagram|twitter|x|threads|tiktok|pinterest|reddit|tumblr|linkedin|vk|weibo|youtube|flickr|snapchat|telegram|t)\.(com|net|me|org|ru)$/;
  const CDN_SOCIAL = /(fbcdn\.net|cdninstagram\.com|twimg\.com|pinimg\.com|redd\.it|tiktokcdn|vkuserphoto|sinaimg)/;
  const SHOP = /(^|\.)(etsy|amazon|ebay|redbubble|teepublic|zazzle|aliexpress|temu|shein|walmart|society6|cafepress|spreadshirt|teespring|printful|shopify|mercari|poshmark|depop|wish)\./;
  const BAD_END = /\.(xyz|top|shop|online|site|buzz|click|icu|cyou|rest|monster|lol|cfd|sbs|bond|live|fun|space|store|vip|win|loan|work|info|biz|pw|tk|ml|ga|cf|gq)$/;
  // Country-code endings (.fr, .lt, .com.tr ...). Endings that many sites use outside their country
  // (.io, .co, .tv, .me, .ai, .fm, .ly ...) are left out on purpose: they don't say where a site is.
  const SHOWN_START = ['United States', 'Puerto Rico'];   // 4.24: countries shown in Copies found to start
  const COUNTRY = { ru: 'Russia', su: 'Russia', cn: 'China', vn: 'Vietnam', in: 'India', id: 'Indonesia', tr: 'Turkey', br: 'Brazil', uk: 'United Kingdom', gb: 'United Kingdom', ca: 'Canada', au: 'Australia', de: 'Germany', fr: 'France', it: 'Italy', es: 'Spain', nl: 'Netherlands',
    pl: 'Poland', ua: 'Ukraine', jp: 'Japan', kr: 'South Korea', mx: 'Mexico', ar: 'Argentina', ph: 'Philippines', pk: 'Pakistan', bd: 'Bangladesh', ng: 'Nigeria', za: 'South Africa', ir: 'Iran', th: 'Thailand', my: 'Malaysia', sg: 'Singapore',
    hk: 'Hong Kong', tw: 'Taiwan', ie: 'Ireland', nz: 'New Zealand', se: 'Sweden', no: 'Norway', dk: 'Denmark', fi: 'Finland', be: 'Belgium', ch: 'Switzerland', at: 'Austria', pt: 'Portugal', gr: 'Greece', cz: 'Czechia', ro: 'Romania',
    hu: 'Hungary', il: 'Israel', ae: 'United Arab Emirates', sa: 'Saudi Arabia', eg: 'Egypt', cl: 'Chile', pe: 'Peru', by: 'Belarus', kz: 'Kazakhstan', rs: 'Serbia', bg: 'Bulgaria', hr: 'Croatia', sk: 'Slovakia', lt: 'Lithuania', lv: 'Latvia', ee: 'Estonia', us: 'United States',
    si: 'Slovenia', ba: 'Bosnia and Herzegovina', mk: 'North Macedonia', al: 'Albania', md: 'Moldova', ge: 'Georgia', am: 'Armenia', az: 'Azerbaijan', uz: 'Uzbekistan', kg: 'Kyrgyzstan', tj: 'Tajikistan', tm: 'Turkmenistan',
    mn: 'Mongolia', lu: 'Luxembourg', is: 'Iceland', mt: 'Malta', cy: 'Cyprus', mc: 'Monaco', li: 'Liechtenstein', ad: 'Andorra', sm: 'San Marino', ve: 'Venezuela', ec: 'Ecuador', bo: 'Bolivia', py: 'Paraguay', uy: 'Uruguay',
    cr: 'Costa Rica', pa: 'Panama', gt: 'Guatemala', hn: 'Honduras', sv: 'El Salvador', ni: 'Nicaragua', do: 'Dominican Republic', cu: 'Cuba', jm: 'Jamaica', pr: 'Puerto Rico', tt: 'Trinidad and Tobago',
    ma: 'Morocco', dz: 'Algeria', tn: 'Tunisia', ke: 'Kenya', gh: 'Ghana', et: 'Ethiopia', tz: 'Tanzania', ug: 'Uganda', zw: 'Zimbabwe', zm: 'Zambia', sn: 'Senegal', ci: 'Ivory Coast', cm: 'Cameroon', ao: 'Angola', mz: 'Mozambique', na: 'Namibia', bw: 'Botswana', rw: 'Rwanda',
    qa: 'Qatar', kw: 'Kuwait', bh: 'Bahrain', om: 'Oman', jo: 'Jordan', lb: 'Lebanon', iq: 'Iraq', sy: 'Syria', ye: 'Yemen', af: 'Afghanistan', np: 'Nepal', lk: 'Sri Lanka', mm: 'Myanmar', kh: 'Cambodia', mo: 'Macau', kp: 'North Korea' };
  const baseOf = site => String(site || '').split('.').slice(/\.(co|com|net|org|gov|edu|ac|ltd|plc|me|or|ne|go)\.[a-z]{2}$/.test(site) ? -3 : -2).join('.');
  function countryOf(site) { const end = String(site || '').toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '').split('.').pop(); return COUNTRY[end] || ''; }
  function useOf(c) {
    const site = c.site || '';
    let ih = ''; try { ih = c.img && /^https?:/.test(c.img) ? new URL(c.img).hostname.replace(/^www\./, '') : ''; } catch (e) { /* none */ }
    // 4.9: social = the page itself is on a social site. A website showing an Instagram or X post
    // stays a website copy (Websites tab); its embedded post's account is read from its page.
    if (typeof PP_SOCIAL !== 'undefined' ? PP_SOCIAL.isSocial(site) : SOCIAL.test(site)) return 'social';
    if (CDN_SOCIAL.test(ih) && typeof PP_SOCIAL === 'undefined') return 'social';
    if (SHOP.test(site) || /\/(products?|shop|store|item|listing|buy)\//i.test(c.url || '') || /\.shop$|\.store$/.test(site)) return 'shop';
    if (!ih) return 'unknown';
    if (baseOf(ih) === baseOf(site) || /(wp\.com|cloudfront\.net|akamaized\.net|cloudinary\.com|imgix\.net|squarespace-cdn\.com|wixstatic\.com|shopify\.com|ggpht\.com|googleusercontent\.com|bp\.blogspot\.com|amazonaws\.com|fastly|cdn\.)/.test(ih)) return 'copied';
    return 'embedded';
  }
  const USE = { copied: ['Copied onto their site', 'They saved the photo on their own server.'], embedded: ['Shown from another site', 'Their page shows the photo straight from another website (hotlinked or embedded).'],
    social: ['Social post', 'Posted on Facebook, Instagram, X or a similar site.'], shop: ['Shop or ad', 'A shop page, product listing or ad. Commercial use.'], unknown: ['Not known', 'The search site didn\'t say where the photo file lives.'] };
  // Signs a site may be a copycat or fly-by-night. Only things PageProof can actually see.
  function riskOf(c, facts) {
    const why = [], site = c.site || '';
    if (BAD_END.test(site)) why.push('Ends in .' + site.split('.').pop());
    if ((site.match(/-/g) || []).length >= 2 || /\d{2,}/.test(site.replace(/\.[a-z]+$/, ''))) why.push('Odd name');
    if (/(viral|trend|buzz|news24|daily24|wallpaper|free-?photo|hdwall|clip-?art)/.test(site)) why.push('Name used by copycat sites');
    if (facts && facts.created && ageDays(facts.created) < 365) why.push('Site is ' + Math.max(1, Math.round(ageDays(facts.created) / 30)) + ' months old');
    if (facts && facts.domainHidden) why.push('Owner hidden');
    const strong = why.filter(w => /Ends in|months old|copycat/.test(w)).length;
    return { level: strong >= 1 && why.length >= 2 ? 'sus' : why.length ? 'watch' : 'ok', why };
  }
  // 4.24: spam blog farms. Throwaway sites with a made-up name (serecoun.blog, adfomusto.blog) that
  // put each copy on a random-looking address of their own (ass4c61.serecoun.blog). Only signs
  // PageProof can see in the links; nothing is answered by itself. Returns Map copy id -> reasons.
  const SPAM_END = /\.(blog|xyz|top|shop|online|site|buzz|click|icu|cyou|rest|monster|lol|cfd|sbs|bond|live|fun|space|store|vip|win|loan|work|info|biz|pw|tk|ml|ga|cf|gq|life|world|today|club|website|pics|homes|beauty|hair|quest|autos|boats|mom|skin|makeup|cam|bar|uno|press|digital|ink|wiki|link|asia|mobi|cc|ws)$/;
  // Big blog and website hosts: everyone there gets their own sub-address, so these are never a farm.
  const BLOG_HOSTS = /(^|\.)(wordpress\.com|blogspot\.[a-z.]+|blogger\.com|tumblr\.com|medium\.com|substack\.com|wixsite\.com|weebly\.com|github\.io|netlify\.app|vercel\.app|pages\.dev|squarespace\.com|webflow\.io|jimdofree\.com|jimdosite\.com|over-blog\.com|livejournal\.com|ghost\.io|typepad\.com|home\.blog|art\.blog|travel\.blog|food\.blog|music\.blog|photo\.blog|business\.blog|news\.blog|fashion\.blog|data\.blog|video\.blog|car\.blog|game\.blog|design\.blog|family\.blog|school\.blog|health\.blog|film\.blog|sport\.blog|tech\.blog)$/;
  // A random-looking name part: letters and numbers mixed up (ass4c61, kl77lfl, vemv18u0g), or a long
  // run of letters with no vowels (xkqztr). "news24" or "blog2" (number only at the end) don't count.
  function randomLabel(l) {
    l = String(l || '').toLowerCase();
    if (!/^[a-z0-9]{5,24}$/.test(l)) return false;
    const flips = (l.match(/[a-z](?=\d)|\d(?=[a-z])/g) || []).length;
    if (/\d/.test(l) && /[a-z]/.test(l) && flips >= 2) return true;
    return l.length >= 6 && /[bcdfghjklmnpqrstvwxz]{5,}/.test(l);
  }
  const homeOnly = u => { try { const x = new URL(u); return /^\/?(index\.(html?|php))?$/i.test(x.pathname) && !x.search; } catch (e) { return false; } };
  function spamMarks(copies) {
    const out = new Map(), subs = new Map();
    const parts = c => {
      const site = String(c.site || '').toLowerCase().replace(/^www\./, ''), base = baseOf(site);
      return { site, base, sub: site.length > base.length ? site.slice(0, site.length - base.length - 1) : '' };
    };
    const skip = (c, p) => !p.site || BLOG_HOSTS.test(p.site) || c.use === 'social' || (typeof PP_SOCIAL !== 'undefined' ? PP_SOCIAL.isSocial(p.site) : SOCIAL.test(p.site));
    for (const c of copies) {
      const p = parts(c);
      if (skip(c, p) || !p.sub) continue;
      if (!subs.has(p.base)) subs.set(p.base, new Set());
      subs.get(p.base).add(p.sub);
    }
    for (const c of copies) {
      const p = parts(c);
      if (skip(c, p)) continue;
      const first = p.sub.split('.')[0], rnd = !!first && randomLabel(first);
      const cheap = SPAM_END.test(p.base), home = homeOnly(c.url), farm = (subs.get(p.base) || new Set()).size;
      const randomFarm = farm >= 3 && [...subs.get(p.base)].filter(x => randomLabel(x.split('.')[0])).length >= 2;
      if (!(rnd && (cheap || home || farm >= 3)) && !(randomFarm && (cheap || home))) continue;
      const why = [];
      if (rnd) why.push('Random-looking address (' + first + ')');
      if (cheap) why.push('Throwaway ending .' + p.base.split('.').pop());
      if (farm >= 3) why.push(p.base + ' shows up under ' + farm + ' different made-up addresses');
      if (home) why.push('Only the home page, no article');
      out.set(c.id, why);
    }
    return out;
  }
  async function copiesOf(photoId) { return DB.by('copies', 'photo', photoId); }
  async function allCopies() {
    if (COPIES) return COPIES;
    const t0 = Date.now(), gen = COPIES_GEN, list = await DB.all('copies');
    if (gen === COPIES_GEN) COPIES = list;      // nothing changed while reading
    perf('readCopies', Date.now() - t0, list.length);
    return list;
  }
  // 4.8.2: the "new copies" number (menu, toolbar dot, side panel) counts only the new copies
  // Copies found shows: copies on hidden sites or from hidden countries stay out of it. Before,
  // it counted every new copy in the store, so hidden ones kept the number up after "All caught up".
  // 4.23.1: the hidden list is read once and kept until it changes (a long list made every page slow).
  let HID = null;
  try { api.storage.onChanged.addListener(ch => { if (ch.rsHidden) HID = null; }); } catch (e) { /* no storage events here */ }
  // 4.24: also leaves out website copies from countries not shown, and government accounts
  // (unless Show government is on), the same as Copies found.
  async function countNew() {
    const st = await api.storage.local.get(HID ? ['fcShownCountries', 'ppShowGov', 'ppShowReposts', 'ppShowPerson'] : ['rsHidden', 'fcShownCountries', 'ppShowGov', 'ppShowReposts', 'ppShowPerson']);
    if (!HID) HID = st.rsHidden || [];
    const hidden = HID, shown = Array.isArray(st.fcShownCountries) ? st.fcShownCountries : SHOWN_START;
    const every = await allCopies(), fresh = every.filter(c => c.status === 'new');
    // 4.24: spam blog copies are hidden on Copies found until you show them, so they don't count here.
    const spam = spamMarks(every);
    let info = {}, mine = {}, links = new Map();
    const kinds = typeof PP_SOCIAL !== 'undefined' && PP_SOCIAL.kindOf;
    if ((!st.ppShowGov || !st.ppShowPerson) && fresh.some(c => c.acct)) {
      info = (await meta.get('acctInfo').catch(() => null)) || {};
      mine = (await meta.get('acctType').catch(() => null)) || {};
      for (const g of ((await meta.get('acctLinks').catch(() => null)) || [])) for (const k of g) links.set(k, g[0]);
    }
    return fresh.filter(c => {
      if (spam.has(c.id) || hiddenCopy(c, hidden)) return false;
      // 4.32: reposts and shares of someone else's post are hidden until you show them.
      if (!st.ppShowReposts && c.rp && c.rp.state === 'repost') return false;
      const ct = c.country || countryOf(c.site);
      if (c.use !== 'social' && ct && !shown.includes(ct)) return false;
      if (!c.acct) return true;
      const i = info[c.acct.key];
      // 4.35: government and personal accounts, worked out the same way as Copies found. Details
      // that could hold the viewer's own data (X before 4.24, Meta/TikTok before 4.30.1) are not used.
      const stale = i && i.ok && ((/^(x|twitter)\.com$/.test(c.acct.plat || '') && !i.v) || (/^(instagram\.com|facebook\.com|threads\.net|threads\.com|tiktok\.com)$/.test(c.acct.plat || '') && (i.v || 0) < 4));
      const t = kinds ? (kinds(c.acct, stale ? null : i, c.title, mine[links.get(c.acct.key) || c.acct.key]) || {}).type : i && i.v && !stale && i.type;
      if (t === 'Government' && !st.ppShowGov) return false;
      if (t === 'Person' && !st.ppShowPerson) return false;
      return true;
    }).length;
  }
  // Is this copy on a hidden site, or posted by a hidden account? (4.9: an Instagram /p/ link has
  // no account in it, so "Hide this account" is matched against the account PageProof found.)
  function hiddenCopy(c, list) {
    if (typeof RS_SITE === 'undefined') return false;
    // 4.15 (Ben's idea 11): copies you marked Stolen are never hidden by a hidden site or account.
    if (c && c.status === 'stolen') return false;
    list = list || (typeof RS_LISTS !== 'undefined' ? RS_LISTS.hidden : []);
    // Forums (Reddit...) are never pursued, so their copies never show.
    if (typeof RS_FORUM !== 'undefined' && RS_FORUM.is(c.site, c.url)) return true;
    if (RS_SITE.entryFor(c.site, c.url, list)) return true;
    const k = c.acct && c.acct.key;
    return !!k && (RS_SITE.has(list, k) || RS_SITE.has(list, RS_SITE.tidy(k)));
  }
  // Is this account approved (for every client, or for this copy's client)?
  function acctApproved(acct, client) {
    if (!acct || !acct.key) return '';
    try { if (RS_LISTS.allowed.includes(acct.key)) return 'all'; } catch (e) { /* lists not loaded */ }
    if (client && (client.licensedAcc || []).includes(acct.key)) return 'client';
    return '';
  }
  // Approve one account (4.9): like Approve site, but only that account's posts.
  async function approveAccount(acct, client, alsoId) {
    let had = false;
    if (client) {
      const c = (await DB.get('clients', client)) || { name: client, searching: null, priority: false, photos: 0 };
      const s = new Set(c.licensedAcc || []); had = s.has(acct.key); s.add(acct.key); c.licensedAcc = [...s];
      await DB.put('clients', c); backupSoon();
    } else { await RS_LISTS.load(); had = RS_LISTS.allowed.includes(acct.key); await RS_LISTS.add('allowed', acct.key); }
    const ids = (await DB.by('copies', 'status', 'new')).filter(c => c.acct && c.acct.key === acct.key && (!client || c.client === client)).map(c => c.id);
    if (alsoId && !ids.includes(alsoId)) ids.push(alsoId);
    const undoAns = ids.length ? await answer(ids, 'licensed', { auto: client ? 'Approved account for this client' : 'Approved account for every client' }) : null;
    touch('approved');
    return async () => {
      if (undoAns) await undoAns();
      if (!had) {
        if (client) { const c = await DB.get('clients', client); if (c) { c.licensedAcc = (c.licensedAcc || []).filter(k => k !== acct.key); await DB.put('clients', c); backupSoon(); } }
        else { await RS_LISTS.load(); await RS_LISTS.remove('allowed', acct.key); }
      }
      touch('approved');
    };
  }
  // Save the account found for a copy (and, when you typed it, keep it for the backup too).
  async function setAcct(id, acct, post) {
    const c = await DB.get('copies', id);
    if (!c) return null;
    const before = { acct: c.acct, post: c.post, acctTry: c.acctTry };
    if (acct) c.acct = acct; else if (acct === null) delete c.acct;
    if (post) c.post = { ...(c.post || {}), ...post };
    c.acctTry = Date.now();
    // An account you already approved: its copy is licensed straight away.
    if (c.acct && c.status === 'new') {
      const cl = c.client ? await DB.get('clients', c.client) : null;
      const ok = acctApproved(c.acct, cl);
      if (ok) { c.status = 'licensed'; c.answered = new Date().toISOString(); c.auto = ok === 'all' ? 'Approved account for every client' : 'Approved account for this client'; }
    }
    await DB.put('copies', c);
    if (acct && (acct.from === 'you' || acct.from === 'browser')) {
      const m = (await meta.get('acctKept')) || {};
      m[c.key || c.url] = { key: acct.key, handle: acct.handle, url: acct.url, plat: acct.plat, from: acct.from };
      await meta.set('acctKept', m); backupSoon();
    }
    touch('acct');
    return async () => { const x = await DB.get('copies', id); if (!x) return; for (const k of Object.keys(before)) { if (before[k] === undefined) delete x[k]; else x[k] = before[k]; } await DB.put('copies', x); touch('acct'); };
  }
  // Is this website in your finds? Read from a small list (site -> how many copies), so the
  // toolbar menu and side panel never have to read every copy.
  async function siteFinds(site) {
    const ix = (await api.storage.local.get('fcSiteIx')).fcSiteIx;
    if (ix) { const e = ix[site]; return e ? { n: e[0], stolen: !!e[1], first: e[2] } : null; }
    const here = (await allCopies()).filter(c => c.site === site && c.status !== 'removed');
    siteIndexSoon();
    return here.length ? { n: here.length, stolen: here.some(c => c.status === 'stolen'), first: here[0].id } : null;
  }
  let siteIxT = null;
  function siteIndexSoon() { clearTimeout(siteIxT); siteIxT = setTimeout(() => writeSiteIndex().catch(() => {}), 4000); }
  async function writeSiteIndex(all) {
    const ix = {};
    for (const c of all || await allCopies()) {
      if (c.status === 'removed' || !c.site) continue;
      const e = ix[c.site] || (ix[c.site] = [0, 0, c.id]);
      e[0]++; if (c.status === 'stolen') e[1] = 1;
    }
    await api.storage.local.set({ fcSiteIx: ix });
  }

  // Add what one photo's search found. links = the search's links for that photo, with their
  // match result (verdict 'same' or 'maybe'). by = 'Keep searching' | 'Daily 50' | 'New search'.
  // opts.engines: the search sites that really searched this photo. A photo's first search
  // without Google (Yandex and Bing's quick-look lane, or Google resting) is a "quick look": its
  // copies are added, but it still counts as never searched until Google has searched it too
  // (unless Google is switched off). opts.shared: a look-alike frame checked against another
  // frame's search: its copies are added, it gets its own search later.
  async function ingest(pic, links, by, opts = {}) {
    const p = await photoForPic(pic);
    p.hash = p.hash || pic.hash; p.w = p.w || pic.w; p.h = p.h || pic.h; p.size = p.size || pic.size;
    if (!p.look && pic.blob) { try { p.look = await lookHash(pic.blob); } catch (e) { /* skip */ } }
    const now = new Date().toISOString();
    const client = p.client ? await DB.get('clients', p.client) : null;
    const lic = new Set((client && client.licensed) || []);
    const old = new Map((await copiesOf(p.id)).map(c => [c.id, c]));
    const out = [];
    let fresh = 0;
    const oldList = [...old.values()];
    for (const l of links) {
      // A link from a forum (Reddit...) is dropped: Ben's team never pursues forums.
      if (typeof RS_FORUM !== 'undefined' && RS_FORUM.is(l.site, l.url)) continue;
      const id = p.id + '|' + l.key;
      // The same page under another address (phone version, tracking bits) is that copy (4.14).
      let c = old.get(id);
      if (!c) {
        c = samePage(oldList.concat(out.filter(x => !old.has(x.id))), l.url);
        if (c) { addAlt(c, l.url); if (out.includes(c)) continue; }
      }
      const other = c && c.key !== l.key;      // found under another address: keep the copy's own
      // A small picture that is too big to keep is left out (cutting it short would break it).
      const th = String(l.thumb || '');
      const base = { url: other ? c.url : l.url, key: other ? c.key : l.key, pk: pageKey(other ? c.url : l.url), site: other ? c.site : l.site, title: l.title || '', thumb: th.length <= 60000 ? th : '', img: l.img || '', engines: l.engines || [], exact: !!l.exact,
        pct: l.pct, inl: l.inl, tiles: l.tiles, str: l.str, mid: l.mid, match: l.verdict, w: l.w, h: l.h, from: l.from || '', onPage: l.onPage || '', cover: l.cover ? 1 : 0, coverImg: l.cover ? l.coverImg || '' : '' };
      if (c) {
        if (!base.thumb && c.thumb) base.thumb = c.thumb;
        if (!base.thumb && !c.thumb && c.th) delete base.thumb;      // its preview is already kept
        if (!base.img && c.img) base.img = c.img;
        Object.assign(c, base, { lastSeen: now, times: (c.times || 1) + 1 });
        out.push(c);
      } else {
        const n = { id, photo: p.id, client: p.client || '', ...base, firstSeen: now, lastSeen: now, times: 1, by, status: 'new', online: 'up' };
        if (lic.has(baseOf(l.site)) || lic.has(l.site)) { n.status = 'licensed'; n.auto = 'Approved site for this client'; }
        else if (approvedForAll(l.site)) { n.status = 'licensed'; n.auto = 'Approved site for every client'; }
        n.country = countryOf(l.site); n.use = useOf(n);
        if (n.use === 'social' && typeof PP_SOCIAL !== 'undefined') {
          const a = PP_SOCIAL.fromUrl(n.url);
          if (a) { n.acct = { ...a, from: 'link', sure: 'sure' }; if (n.status === 'new') { const ok = acctApproved(n.acct, client); if (ok) { n.status = 'licensed'; n.auto = ok === 'all' ? 'Approved account for every client' : 'Approved account for this client'; } } }
        }
        out.push(n); fresh++;
      }
    }
    const newPics = out.map(splitPic).filter(Boolean);
    await pics.putMany(newPics);
    await DB.putMany('copies', out);
    // Their copy of the photo is kept the moment it is found (not for sites already approved).
    keepSoon(out.filter(c => c.times === 1 && c.status === 'new'));
    const all = await copiesOf(p.id);
    const firstTime = !searchedOnce(p);
    let gOn = true;
    if (opts.engines) try { gOn = (((await api.storage.local.get('rsSettings')).rsSettings || {}).engines || {}).google !== false; } catch (e) { /* default on */ }
    const quick = !opts.shared && !!opts.engines && firstTime && gOn && !opts.engines.includes('google');
    if (opts.shared) {
      // A look-alike frame: a copy of it turned up in its twin's search, so it goes next.
      p.alikeAt = now;
      if (fresh > 0) { delete p.burstWait; p.hot = now; }
    } else if (quick) {
      p.quickAt = now; p.quickN = (p.quickN || 0) + 1;
      delete p.retry;
      // The quick look found a copy: Google searches it next.
      if (fresh > 0) { p.hot = now; await wakeBurst(p).catch(() => {}); }
    } else {
      if (firstTime) p.firstAt = now;            // its first search ever (the "every photo once" count)
      p.searches = (p.searches || 0) + 1;
      p.lastSearched = now;
      delete p.retry;
      p.empty = links.length ? 0 : (p.empty || 0) + 1;
      // A hot shoot photo has had its turn.
      if (p.hot) delete p.hot;
      // 4.42 bursts: this frame found copies, so the frames that waited behind it go now.
      if (fresh > 0) await wakeBurst(p).catch(() => {});
    }
    p.copies = all.filter(c => c.status !== 'removed').length;
    p.stolen = all.filter(c => c.status === 'stolen').length;
    if (all.length && pic.thumb && !p.thumb && !p.th) { p.thumb = pic.thumb; const pr = splitPic(p); if (pr) await pics.putMany([pr]); }
    await DB.put('photos', p);
    if (client) { client.lastSearched = now; await DB.put('clients', client); }
    // Keep today's tally for the side panel and Home.
    const day = new Date().toDateString();
    const t = (await api.storage.local.get('fcToday')).fcToday || {};
    const today = t.day === day ? t : { day, searched: 0, found: 0 };
    if (quick) today.quick = (today.quick || 0) + 1; else if (!opts.shared) today.searched++;
    today.found += fresh;
    await api.storage.local.set({ fcToday: today, fcLastSearch: Date.now() });
    if (!opts.shared) await dayLog(quick ? { quick: 1 } : { full: 1, first: firstTime ? 1 : 0 });
    await logWeek({ searched: quick || opts.shared ? 0 : 1, found: fresh, first: firstTime && !quick && !opts.shared ? 1 : 0, client: p.client || '' });
    queueDirty(true); backupCopiesSoon(); touch('copies');
    return { photo: p, fresh };
  }
  // Add ONE link to the copies of a photo by hand (a link the checker threw out that you say is
  // a copy). Unlike ingest(), it doesn't count as a search.
  async function rescue(pic, l, by) {
    if (typeof PP_STATS !== 'undefined') PP_STATS.add('ans.rescued');
    const p = await photoForPic(pic);
    const id = p.id + '|' + l.key, now = new Date().toISOString();
    if (await DB.get('copies', id)) return;
    const same = samePage(await copiesOf(p.id), l.url);
    if (same) { addAlt(same, l.url); await DB.put('copies', same); touch('copies'); return; }
    const n = { id, photo: p.id, client: p.client || '', url: l.url, key: l.key, pk: pageKey(l.url), site: l.site, title: l.title || '', thumb: String(l.thumb || '').slice(0, 60000), img: l.img || '',
      engines: l.engines || [], exact: !!l.exact, pct: l.pct, inl: l.inl, tiles: l.tiles, str: l.str, mid: l.mid, match: l.verdict || 'maybe', w: l.w, h: l.h,
      firstSeen: now, lastSeen: now, times: 1, by: (by || 'a search') + ' (added by hand)', status: 'new', online: 'up' };
    n.country = countryOf(l.site); n.use = useOf(n);
    const np = splitPic(n);
    if (np) await pics.putMany([np]);
    await DB.put('copies', n);
    // 4.47: a link the checker threw out that you say is a copy goes into your own checker test set.
    if (typeof PP_CTESTS !== 'undefined') PP_CTESTS.keep({ ...n, match: 'no' }, 'copy', pic && pic.blob);
    p.copies = (await copiesOf(p.id)).filter(c => c.status !== 'removed').length;
    if (pic.thumb && !p.thumb && !p.th) { p.thumb = pic.thumb; const pr = splitPic(p); if (pr) await pics.putMany([pr]); }
    await DB.put('photos', p);
    queueDirty(true); backupCopiesSoon(); touch('copies');
  }
  // ---------------------------------------------------------------- same page, other address (4.14)
  // Search sites often give one page under several addresses: the phone version (m.), the AMP
  // version, share and tracking bits on the end. pageKey() is the same for all of them, so they
  // show as ONE copy: you answer once, and one use is never counted as three. The copy keeps its
  // first address; the others are listed in c.alts. (The copy's own key, RS_UTIL.key, is left as
  // it was, so nothing already saved changes its name.)
  const TRACK = /^(utm_|fbclid|gclid|dclid|msclkid|igsh|mc_cid|mc_eid|_ga|_gl|ocid|cmpid|cmp$|smid|share$|shared$|s$|ref$|ref_src|ref_url|src$|source$|via$|si$|spm$|xtor|ito$|ns_|taid$|mbid$|output$|outputtype$|amp$|__twitter_impression|ncid$|soc_src|soc_trk|feature$)/i;
  function pageKey(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.toLowerCase().replace(/^(www\d?|m|mobile|amp)\./, '').replace(/\.cdn\.ampproject\.org$/, '');
      const path = u.pathname.replace(/\/(index\.html?|amp\.html?)$/i, '/').replace(/\/amp\/?$/i, '/').replace(/^\/amp\//i, '/').replace(/\.amp(\.html?)?$/i, '$1').replace(/\/+$/, '');
      const q = [...u.searchParams.entries()].filter(([k]) => !TRACK.test(k)).sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]));
      return (host + path + (q.length ? '?' + q.map(([k, v]) => k + '=' + v).join('&') : '')).toLowerCase();
    } catch (e) { return String(url || '').toLowerCase(); }
  }
  // The copy in `list` that is the same page as `url`, if there is one.
  function samePage(list, url) {
    const k = pageKey(url);
    return list.find(c => (c.pk || pageKey(c.url)) === k) || null;
  }
  function addAlt(c, url) {
    if (!url || url === c.url) return;
    c.alts = c.alts || [];
    if (!c.alts.includes(url) && c.alts.length < 20) c.alts.push(url);
  }
  // One time (4.14): fold copies already saved that are the same page. The answered one is kept
  // (or the oldest one if none is answered); a group with two different answers is left alone.
  const RANK = { stolen: 4, licensed: 3, removed: 2, new: 1 };
  async function mergeSamePages() {
    if (await meta.get('pageMerge')) return 0;
    return navigator.locks.request('pp-page-merge', async () => {
      if (await meta.get('pageMerge')) return 0;
      const groups = new Map();
      for (const c of await allCopies()) {
        const g = c.photo + '|' + pageKey(c.url);
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(c);
      }
      const keep = [], drop = [], photos = new Set();
      for (const list of groups.values()) {
        if (list.length < 2) continue;
        const answered = new Set(list.filter(c => c.status !== 'new').map(c => c.status));
        if (answered.size > 1) continue;
        list.sort((a, b) => (RANK[b.status] || 0) - (RANK[a.status] || 0) || String(a.firstSeen).localeCompare(String(b.firstSeen)));
        const k = list[0];
        k.pk = pageKey(k.url);
        for (const o of list.slice(1)) {
          addAlt(k, o.url); for (const u of o.alts || []) addAlt(k, u);
          k.times = (k.times || 1) + (o.times || 1);
          if (String(o.lastSeen) > String(k.lastSeen)) k.lastSeen = o.lastSeen;
          if (!k.thumb && !k.th && o.thumb) k.thumb = o.thumb;
          drop.push(o.id);
        }
        keep.push(k); photos.add(k.photo);
      }
      if (keep.length) await DB.putMany('copies', keep);
      if (drop.length) { await DB.delMany('copies', drop); await recount(photos); backupCopiesSoon(); touch('copies'); }
      await meta.set('pageMerge', new Date().toISOString());
      return drop.length;
    });
  }
  // One time (4.2.2): the photo check could shrink their picture to a dot and compare it over a
  // couple of tiny squares, which showed different photos as "100% lines up". Copies it let in
  // that way (fewer than 12 matching squares) and that nobody has answered yet go to Removed,
  // where "Put back" still works. Copies you added by hand or already answered are left alone.
  async function dropDotMatches() {
    if (await meta.get('dotFix')) return 0;
    return navigator.locks.request('pp-dot-fix', async () => {
      if (await meta.get('dotFix')) return 0;
      const now = new Date().toISOString(), bad = [], photos = new Set();
      for (const c of await allCopies()) {
        if (c.status !== 'new' || typeof c.tiles !== 'number' || c.tiles >= 12 || /by hand/.test(c.by || '')) continue;
        c.status = 'removed'; c.answered = now; c.removedBy = 'checker'; bad.push(c); photos.add(c.photo);
      }
      if (bad.length) { await DB.putMany('copies', bad); await recount(photos); backupCopiesSoon(); touch('copies'); }
      await meta.set('dotFix', now);
      return bad.length;
    });
  }
  // 4.31: the photo check found an unanswered copy is another photo of the same place (only
  // logos / lettering line up, or a building from a few steps away). It goes to Removed, where
  // Put back still works. Only copies still waiting for an answer, never ones added by hand.
  async function checkerRemove(id, pct) {
    const c = await DB.get('copies', id);
    if (!c || c.status !== 'new' || /by hand/.test(c.by || '')) return false;
    c.status = 'removed'; c.answered = new Date().toISOString(); c.removedBy = 'checker'; c.otherShot = 1;
    if (typeof pct === 'number') c.pct = pct;
    await DB.put('copies', c); await recount(new Set([c.photo])); backupCopiesSoon(); touch('copies');
    return true;
  }
  // 4.14: an evidence pack was saved from a capture of this copy (Evidence › Needs a capture).
  // how: 'pack' (saved through PageProof) or 'hand' (you say it was captured another way).
  async function markCaptured(id, how = 'pack') {
    const c = await DB.get('copies', id);
    if (!c) return null;
    const before = JSON.parse(JSON.stringify(c));
    c.packAt = new Date().toISOString(); c.packHow = how;
    await DB.put('copies', c); backupCopiesSoon(); touch('copies');
    return async () => { await DB.put('copies', before); touch('copies'); };
  }
  // Mark a photo as searched with nothing found (so it moves down the line).
  async function searchedNothing(pic, by) { return ingest(pic, [], by); }

  // ---------------------------------------------------------------- your answers
  // Each change returns an "undo" that puts every touched copy back exactly as it was.
  async function wakeBurst(p) {
    const waiting = (await DB.prefix('photos', folderOf(p.id))).filter(o => o.burstWait && (o.burstWait === p.id || (p.look && o.look && hamming(o.look, p.look) <= ALIKE)));
    for (const o of waiting) { delete o.burstWait; o.hot = new Date().toISOString(); }
    if (waiting.length) { await DB.putMany('photos', waiting); queueDirty(); }
    return waiting.length;
  }
  // 4.42 hot shoots (Ben's pick): a photo marked Stolen means its shoot is being used. The other
  // photos from the same folder and day (same day in the file name when the folder has many
  // days) are searched next, once. Returns the photos it marked.
  const dayInName = n => { const m = /(\d{1,2})[._-](\d{1,2})[._-](\d{2,4})/.exec(String(n || '')); return m ? m[1] + '.' + m[2] + '.' + m[3].slice(-2) : ''; };
  async function heatShoot(photoIds) {
    const at = new Date().toISOString(), marked = [];
    for (const id of new Set(photoIds)) {
      const p = await DB.get('photos', id);
      if (!p) continue;
      const day = p.day ? '' : dayInName(p.name);
      for (const o of await DB.prefix('photos', folderOf(p.id))) {
        if (o.id === p.id || o.gone || o.doubleOf || folderOf(o.id) !== folderOf(p.id) || cantSearch(o) || o.stolen) continue;
        if (o.day !== p.day || (day && dayInName(o.name) !== day)) continue;
        if (o.lastSearched && ageDays(o.lastSearched) < 1) continue;     // searched today already
        if (marked.some(m => m.id === o.id)) continue;
        marked.push({ id: o.id, was: o.hot || null });
        o.hot = at; if (o.burstWait) { o.wasBurst = o.burstWait; delete o.burstWait; }
        await DB.put('photos', o);
        if (marked.length >= 60) break;
      }
    }
    if (marked.length) { queueDirty(); if (typeof PP_STATS !== 'undefined') PP_STATS.add('keep.hotShoot'); }
    return marked;
  }
  async function coolShoot(marked) {
    for (const m of marked) { const o = await DB.get('photos', m.id); if (!o) continue; if (m.was) o.hot = m.was; else delete o.hot; if (o.wasBurst) { o.burstWait = o.wasBurst; delete o.wasBurst; } await DB.put('photos', o); }
    if (marked.length) queueDirty();
  }
  async function answer(ids, status, extra = {}) {
    const before = [];
    const now = new Date().toISOString();
    const touchedPhotos = new Set();
    const got = (await DB.getMany('copies', [].concat(ids))).filter(Boolean);
    const names = new Map();                    // photo id -> file name (for the rejected-links list)
    const tally = {};                           // client -> how many, for the weekly summary
    let rejects = 0;
    for (const c of got) {
      before.push(JSON.parse(JSON.stringify(c)));
      // How PageProof is doing: your answers, answers changed later and copies put back.
      // 4.43: weak Maybes put away by themselves are not your answers (not counted, not learned from).
      if (typeof PP_STATS !== 'undefined' && status !== 'skip' && c.status !== status && extra.removedBy !== 'weakmaybe') {
        PP_STATS.add('ans.' + status);
        if (c.status === 'removed' && status === 'new') PP_STATS.add('ans.putBack' + (c.removedBy ? '.' + c.removedBy : ''));
        else if (c.status !== 'new') PP_STATS.add('ans.changed');
      }
      if (status === 'skip') { c.skipped = now; }
      else { c.status = status; c.answered = now; delete c.skipped; }
      Object.assign(c, extra);
      touchedPhotos.add(c.photo);
      if (status === 'removed' && extra.removedBy !== 'weakmaybe') {
        if (!names.has(c.photo)) { const p = await DB.get('photos', c.photo); names.set(c.photo, p ? p.name : ''); }
        try { if (!RS_REJECT.find(c.url, names.get(c.photo), '')) { RS_REJECT.items.push({ url: c.url, pic: names.get(c.photo) || '', why: '' }); RS_REJECT.noteKey(c.url, names.get(c.photo) || '', ''); rejects++; } } catch (e) { /* lists not loaded */ }
      }
      if (status === 'stolen' || status === 'licensed' || status === 'removed') tally[c.client || ''] = (tally[c.client || ''] || 0) + 1;
      // 4.47: a Same photo you removed goes into your own checker test set (on this computer only).
      // Not for big bulk removes (a whole site at once), which say little about the checker.
      // 4.52 (Ben's pick): every kind of answer is kept (Stolen and Licensed as real copies, removed
      // Same and Maybe as different pictures), so the checker can be tuned on both.
      const was = before[before.length - 1].status;
      if (got.length <= 5 && !extra.removedBy && was !== status && ['same', 'maybe'].includes(c.match) && typeof PP_CTESTS !== 'undefined') {
        if (status === 'removed') PP_CTESTS.keep(c, 'different');
        else if ((status === 'stolen' || status === 'licensed') && was === 'new') PP_CTESTS.keep(c, 'copy');
      }
    }
    await DB.putMany('copies', got);
    if (rejects) { try { await RS_REJECT.save(); } catch (e) { /* lists not loaded */ } }
    for (const [client, n] of Object.entries(tally)) await logWeek({ [status]: n, client });
    await recount(touchedPhotos);
    backupCopiesSoon(); touch('copies');
    if (status === 'stolen') queueDirty();
    const hot = status === 'stolen' ? await heatShoot(before.filter(c => c.status !== 'stolen').map(c => c.photo)).catch(() => []) : [];
    const undo = async () => {
      if (hot.length) await coolShoot(hot).catch(() => {});
      await DB.putMany('copies', before);
      if (status === 'removed') {
        try {
          for (const c of before) { const k = RS_UTIL.key(c.url), pic = names.get(c.photo) || ''; RS_REJECT.items = RS_REJECT.items.filter(r => !(RS_UTIL.key(r.url) === k && (!r.pic || r.pic === pic) && !(r.why || ''))); }
          await RS_REJECT.save();
        } catch (e) { /* ignore */ }
      }
      for (const [client, n] of Object.entries(tally)) await logWeek({ [status]: -n, client });
      await recount(touchedPhotos);
      backupCopiesSoon(); touch('copies');
    };
    undo.hot = hot.length;
    return undo;
  }
  async function recount(photoIds) {
    for (const id of photoIds) {
      const p = await DB.get('photos', id);
      if (!p) continue;
      const all = await copiesOf(id);
      p.copies = all.filter(c => c.status !== 'removed').length;
      p.stolen = all.filter(c => c.status === 'stolen').length;
      await DB.put('photos', p);
    }
    queueDirty(true);
  }
  // Licensed: this site may use this client's photos. Future copies there are licensed too.
  async function licenseSite(clientName, site, on = true) {
    if (!clientName) return;
    const c = (await DB.get('clients', clientName)) || { name: clientName, searching: null, priority: false, photos: 0 };
    const s = new Set(c.licensed || []);
    if (on) s.add(baseOf(site)); else s.delete(baseOf(site));
    c.licensed = [...s];
    await DB.put('clients', c); backupSoon();
  }
  // Approved sites: allowed to use the photos. client = one client's name, or '' for every client.
  // Every copy on the site that is still New becomes Licensed (later finds too: see ingest).
  // Returns an undo.
  const approvedForAll = site => { try { return RS_LISTS.isAllowed(site, 'https://' + site + '/'); } catch (e) { return false; } };
  async function approveSite(site, client, alsoId) {
    const base = baseOf(site);
    let had = false;
    if (client) {
      const c = await DB.get('clients', client);
      had = !!c && (c.licensed || []).includes(base);
      await licenseSite(client, base, true);
    } else { await RS_LISTS.load(); had = RS_LISTS.allowed.includes(base); await RS_LISTS.add('allowed', base); }
    const ids = (await DB.by('copies', 'status', 'new')).filter(c => baseOf(c.site) === base && (!client || c.client === client)).map(c => c.id);
    if (alsoId && !ids.includes(alsoId)) ids.push(alsoId);        // the copy you were looking at, whatever it said before
    const undoAns = ids.length ? await answer(ids, 'licensed', { auto: client ? 'Approved site for this client' : 'Approved site for every client' }) : null;
    touch('approved');
    return async () => {
      if (undoAns) await undoAns();
      if (!had) { if (client) await licenseSite(client, base, false); else { await RS_LISTS.load(); await RS_LISTS.remove('allowed', base); } }
      touch('approved');
    };
  }
  async function setClientOf(photoId, clientName) {
    const p = await DB.get('photos', photoId);
    if (!p) return;
    const was = p.client;
    p.client = tidyClient(clientName);
    await DB.put('photos', p);
    const cs = await copiesOf(photoId);
    for (const c of cs) c.client = p.client;
    await DB.putMany('copies', cs);
    if (!(await DB.get('clients', p.client))) await DB.put('clients', { name: p.client, searching: null, priority: false, photos: 0, licensed: [], manual: true });
    touch('copies'); backupCopiesSoon();
    return async () => { p.client = was; await DB.put('photos', p); for (const c of cs) c.client = was; await DB.putMany('copies', cs); touch('copies'); };
  }
  async function setFlag(photoId, flag) {
    const p = await DB.get('photos', photoId);
    if (!p) return;
    p.flag = p.flag === flag ? '' : flag;
    p.flagged = new Date().toISOString();
    await DB.put('photos', p);
    queueDirty(); backupSoon(true);
    return p.flag;
  }
  // Stop searching these photos (on = true) or search them again (on = false). Gives back an
  // undo that puts every photo back the way it was.
  async function setStopped(ids, on) {
    const was = [];
    for (const id of new Set(ids)) {
      const p = await DB.get('photos', id);
      if (!p) continue;
      was.push([id, p.stopped || '']);
      if (on) p.stopped = p.stopped || new Date().toISOString(); else delete p.stopped;
      await DB.put('photos', p);
    }
    COVER = null; queueDirty(); backupSoon(true);
    return async () => {
      for (const [id, st] of was) { const p = await DB.get('photos', id); if (!p) continue; if (st) p.stopped = st; else delete p.stopped; await DB.put('photos', p); }
      COVER = null; queueDirty(); backupSoon(true);
    };
  }
  async function setClients(names, ch) {
    for (const n of names) {
      const c = await DB.get('clients', n);
      if (!c) continue;
      Object.assign(c, ch);
      await DB.put('clients', c);
    }
    queueDirty(); backupSoon(); touch('clients');
  }

  // ---------------------------------------------------------------- the week, for the weekly summary
  const weekKey = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.toISOString().slice(0, 10); };
  // Speed meter (Ben's pick): searches per day for the last 3 weeks. full = searched with
  // Google (or every site switched on), first = of those, first searches, quick = quick looks.
  async function dayLog(add, d = new Date()) {
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const all = (await api.storage.local.get('fcDays')).fcDays || {};
    const o = all[key] = all[key] || { full: 0, first: 0, quick: 0 };
    for (const k of ['full', 'first', 'quick']) if (add[k]) o[k] = (o[k] || 0) + add[k];
    for (const k of Object.keys(all).sort().slice(0, -21)) delete all[k];
    await api.storage.local.set({ fcDays: all });
  }
  // This week's speed: the average per day over the last 7 days that had any searches.
  async function speed() {
    const all = (await api.storage.local.get('fcDays')).fcDays || {};
    const cut = new Date(Date.now() - 7 * DAY), key = cut.getFullYear() + '-' + String(cut.getMonth() + 1).padStart(2, '0') + '-' + String(cut.getDate()).padStart(2, '0');
    const days = Object.entries(all).filter(([k, v]) => k > key && (v.full || v.quick));
    const sum = f => days.reduce((a, [, v]) => a + (v[f] || 0), 0);
    const n = days.length;
    return { days: n, full: n ? sum('full') / n : 0, first: n ? sum('first') / n : 0, quick: n ? sum('quick') / n : 0, today: all[Object.keys(all).sort().pop()] || null };
  }
  async function logWeek(add) {
    const k = 'week:' + weekKey();
    const w = (await meta.get(k)) || { searched: 0, found: 0, stolen: 0, licensed: 0, removed: 0, wentOffline: 0, backOnline: 0, clients: {}, offline: [], back: [] };
    for (const f of ['searched', 'found', 'first', 'stolen', 'licensed', 'removed', 'wentOffline', 'backOnline']) if (add[f]) w[f] = Math.max(0, (w[f] || 0) + add[f]);
    if (add.client !== undefined) {
      const c = w.clients[add.client || 'Client unknown'] = w.clients[add.client || 'Client unknown'] || { searched: 0, found: 0, stolen: 0 };
      if (add.searched) c.searched += add.searched; if (add.found) c.found += add.found; if (add.stolen) c.stolen = Math.max(0, c.stolen + add.stolen);
    }
    if (add.wentOffline && add.site) w.offline.push([add.site, new Date().toISOString()]);
    if (add.backOnline && add.site) w.back.push([add.site, new Date().toISOString()]);
    await meta.set(k, w);
  }
  const week = key => meta.get('week:' + (key || weekKey()));

  // ---------------------------------------------------------------- countries shown (4.24)
  // Ben: website copies show only from the countries picked here, United States and Puerto Rico
  // to start. Copies whose country isn't known always show. (Before 4.24 it was a list of
  // countries to hide, fcHiddenCountries, which is no longer used.)
  async function shownCountries() { const v = (await api.storage.local.get('fcShownCountries')).fcShownCountries; return Array.isArray(v) ? v : SHOWN_START.slice(); }
  async function setShownCountries(list) {
    list = [...new Set(list)];
    await api.storage.local.set({ fcShownCountries: list });
    try { await RS_DOCS.writeText('shown-countries.txt', '# PageProof countries shown in Copies found > Websites, one per line. Copies on sites from other countries are not shown. Sites whose country is not known always show.\n' + list.join('\n') + '\n'); } catch (e) { /* folder not set up */ }
    backupSoon();
  }

  // ---------------------------------------------------------------- site facts and owners
  // Built-in groups: only the company names and sites PageProof is sure of. Anything else is
  // grouped only from facts read off the sites themselves.
  const GROUPS = {
    'Gannett (USA TODAY Network)': ['usatoday.com', 'indystar.com', 'freep.com', 'azcentral.com', 'jsonline.com', 'tennessean.com', 'desmoinesregister.com', 'cincinnati.com', 'courier-journal.com', 'democratandchronicle.com', 'lohud.com', 'northjersey.com', 'app.com', 'news-press.com', 'commercialappeal.com', 'detroitnews.com', 'palmbeachpost.com', 'statesman.com', 'dispatch.com', 'oklahoman.com'],
    'Advance Local': ['nj.com', 'silive.com', 'masslive.com', 'syracuse.com', 'pennlive.com', 'cleveland.com', 'mlive.com', 'al.com', 'oregonlive.com', 'lehighvalleylive.com'],
    'Hearst Newspapers': ['sfchronicle.com', 'houstonchronicle.com', 'chron.com', 'timesunion.com', 'ctpost.com', 'expressnews.com', 'mysanantonio.com', 'seattlepi.com', 'sfgate.com', 'nhregister.com', 'stamfordadvocate.com', 'greenwichtime.com'],
    'McClatchy': ['miamiherald.com', 'kansascity.com', 'sacbee.com', 'charlotteobserver.com', 'star-telegram.com', 'newsobserver.com', 'kentucky.com', 'thestate.com', 'fresnobee.com', 'idahostatesman.com'],
    'Lee Enterprises': ['stltoday.com', 'buffalonews.com', 'omaha.com', 'richmond.com', 'tulsaworld.com', 'madison.com'],
    'DMG Media (Daily Mail)': ['dailymail.co.uk', 'metro.co.uk', 'thisismoney.co.uk'],
    'Reach plc': ['mirror.co.uk', 'express.co.uk', 'dailystar.co.uk', 'manchestereveningnews.co.uk', 'liverpoolecho.co.uk', 'birminghammail.co.uk', 'walesonline.co.uk', 'dailyrecord.co.uk'],
    'Patch Media': ['patch.com'],
  };
  // Words many unrelated sites put after the © sign. They never count as a company name.
  const GENERIC_NAME = /^(the|all|this|our|copyright|by|blog|news|admin|home|website|web ?site|site|company|inc|llc|team|staff|editor|author|media|press|magazine|daily|online|official|wordpress|blogger|untitled|my (blog|site|website)|all rights reserved)$/i;
  const FOOTER_COMPANIES = ['Townsquare Media', 'iHeartMedia', 'Cumulus Media', 'Audacy', 'Gannett', 'Hearst', 'Advance Local', 'Nexstar', 'Sinclair', 'TEGNA', 'Gray Media', 'Gray Television', 'Patch Media', 'McClatchy', 'Lee Enterprises', 'Alden Global Capital', 'MediaNews Group', 'Tribune Publishing', 'Daily Mail', 'Reach plc', 'News Corp', 'Future plc', 'Dotdash Meredith', 'Vox Media', 'BuzzFeed', 'Bustle Digital Group', 'Penske Media', 'Condé Nast', 'Valnet', 'Salem Media', 'Beasley Media', 'Entercom', 'Graham Media', 'Scripps'];
  function groupOf(site) {
    for (const [g, list] of Object.entries(GROUPS)) for (const d of list) if (site === d || site.endsWith('.' + d)) return { name: g, how: site === d ? 'On PageProof\'s list of big media groups' : 'A sub-site of ' + d };
    return null;
  }
  async function facts(site) { return DB.get('sites', site); }
  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
  // Read the site: home page, the copy's page, and its About / Contact / Privacy pages.
  // Everything is read as text with DOMParser (nothing from the site is run).
  async function lookup(site, pageUrl) {
    const t0 = Date.now();
    try { return await lookupNow(site, pageUrl); } finally { if (typeof PP_STATS !== 'undefined') { PP_STATS.add('job.owner.n'); PP_STATS.time('job.owner', Date.now() - t0); } }
  }
  async function lookupNow(site, pageUrl) {
    const f = { site, at: new Date().toISOString(), names: [], emails: [], phones: [], social: [], ids: [], pages: [], clues: [] };
    const seen = new Set();
    const read = async (url, label) => {
      if (seen.has(url) || f.pages.length >= 8) return null;
      seen.add(url);
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
        const r = await fetch(url, { credentials: 'omit', redirect: 'follow', signal: ctl.signal });
        clearTimeout(t);
        if (!r.ok || !/html/i.test(r.headers.get('content-type') || 'html')) return null;
        const html = (await r.text()).slice(0, 3e6);
        f.pages.push({ url: r.url || url, label });
        // Nothing in it ever runs, but the browser still logs a red "inline event handler" error for every
        // onclick= / onload= on their page. Renaming those first keeps the Errors list clean.
        return { html, doc: new DOMParser().parseFromString(html.replace(/\son([a-z]+\s*=)/gi, ' data-pp-on$1'), 'text/html'), url: r.url || url, label };
      } catch (e) { return null; }
    };
    const addClue = (kind, title, value, src) => { if (value && !f.clues.some(c => c.kind === kind && c.value === value)) f.clues.push({ kind, title, value, src }); };
    const scrape = pg => {
      if (!pg) return;
      const { html, doc, label } = pg;
      for (const m of html.matchAll(/\b(G-[A-Z0-9]{8,12}|UA-\d{4,10}-\d{1,3}|GTM-[A-Z0-9]{5,8}|ca-pub-\d{10,20}|pub-\d{14,20})\b/g)) if (!f.ids.includes(m[1])) f.ids.push(m[1]);
      for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          const walk = o => {
            if (!o || typeof o !== 'object') return;
            if (Array.isArray(o)) return o.forEach(walk);
            const ty = [].concat(o['@type'] || []).join(' ');
            if (/Organization|NewsMediaOrganization|Corporation|LocalBusiness/.test(ty) && o.name) {
              const n = clean(typeof o.name === 'string' ? o.name : '');
              if (n && !f.names.includes(n)) f.names.push(n);
              const a = o.address; if (a && typeof a === 'object' && !f.address) f.address = clean([a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, a.addressCountry && (a.addressCountry.name || a.addressCountry)].filter(x => typeof x === 'string').join(', '));
              addClue('doc', 'Named in the site\'s own data', n, label);
            }
            if (o.publisher) walk(o.publisher);
            if (o['@graph']) walk(o['@graph']);
          };
          walk(JSON.parse(s.textContent));
        } catch (e) { /* not valid */ }
      }
      const text = clean((doc.body && doc.body.textContent) || '');
      for (const m of text.matchAll(/(?:©|\(c\)|copyright)\s*(?:(?:19|20)\d{2}\s*(?:[-–]\s*(?:19|20)?\d{2,4})?\s*,?\s*)?([A-Z][A-Za-z0-9&.,' -]{2,70}?)(?=\s*(?:\.|\||All rights|$|Powered|Privacy|Terms|·|-\s))/g)) {
        const n = clean(m[1]).replace(/[.,\s-]+$/, '');
        if (n.length > 2 && !GENERIC_NAME.test(n) && !f.names.includes(n)) { f.names.push(n); addClue('doc', 'Company name in the footer', '“© ' + n + '”', label); }
      }
      for (const co of FOOTER_COMPANIES) if (text.includes(co) && !f.names.includes(co) && /(©|copyright|owned|operated|part of|a division|member of|network)/i.test(text.slice(Math.max(0, text.indexOf(co) - 200), text.indexOf(co) + 200))) { f.names.push(co); addClue('doc', 'Company named on the site', co, label); }
      for (const a of doc.querySelectorAll('a[href]')) {
        const href = a.getAttribute('href') || '';
        if (/^mailto:/i.test(href)) { const e = clean(href.slice(7).split('?')[0]); if (e && !f.emails.includes(e) && f.emails.length < 6) f.emails.push(e); }
        else if (/^tel:/i.test(href)) { const p = clean(href.slice(4)); if (p && !f.phones.includes(p) && f.phones.length < 4) f.phones.push(p); }
        else if (/^https?:\/\/(www\.)?(facebook|instagram|twitter|x|linkedin|youtube|tiktok|pinterest|threads)\.(com|net)\/[A-Za-z0-9_.\-/]+/i.test(href)) {
          const u = href.split(/[?#]/)[0].replace(/\/$/, '');
          if (!/\/(sharer|share|intent|dialog|plugins|tr)\b/.test(u) && !f.social.includes(u) && f.social.length < 8) f.social.push(u);
        }
      }
      // 5a (Ben's way of finding the company): Terms, Privacy, About and Contact pages often say who
      // runs the site: "operated by Example Media LLC", "Example Inc. (\"we\", \"us\")".
      if (/Terms|Privacy|About|Contact/.test(label)) {
        const addCo = (n, how) => {
          n = clean(n).replace(/^(the|by)\s+/i, '').replace(/[,;:\s]+$/, '');
          if (n.length < 4 || n.length > 80 || GENERIC_NAME.test(n) || f.names.includes(n)) return;
          f.names.push(n); (f.nameFrom = f.nameFrom || {})[n] = label;
          addClue('doc', how + ' (' + label + ')', n, label);
        };
        const CO = "((?:[A-Z0-9][\\w&'’-]*,?\\s){0,6}?(?:LLC|L\\.L\\.C\\.|Inc\\.?|Incorporated|Ltd\\.?|Limited|Corp\\.?|Corporation|LLP|PLLC|PLC|L\\.P\\.|LP|GmbH))(?![\\w])";
        for (const m of text.matchAll(new RegExp("(?:operated|owned|run|published|managed|provided)\\s+by\\s+" + CO, 'g'))) addCo(m[1], 'Runs the site');
        for (const m of text.matchAll(new RegExp(CO + "\\s*\\(\\s*[\"“]?(?:[Ww]e|[Uu]s|[Cc]ompany|[Tt]he [Cc]ompany)\\b", 'g'))) addCo(m[1], 'Calls itself "we"');
        for (const m of text.matchAll(/\b(?:d\/b\/a|dba|doing business as|trading as)\s+["“]?([A-Z][\w&'’ .-]{2,50}?)["”]?(?=[,.;)]|\s+(?:and|or)\b)/g)) addCo(m[1], 'Trades as');
        if (!/Runs the site|Calls itself/.test(JSON.stringify(f.clues))) { const m = new RegExp(CO).exec(text); if (m) addCo(m[1], 'Company named'); }
      }
      const og = doc.querySelector('meta[property="og:site_name"]');
      if (og && og.content && !f.siteName) f.siteName = clean(og.content).slice(0, 80);
      return doc;
    };
    const home = (globalThis.PP_LOOKUP_HOME || (s2 => 'https://' + s2))(site) + '/';     // tests point it at a local server
    const hp = await read(home, 'Home page');
    const doc = scrape(hp);
    if (pageUrl && /^https?:/.test(pageUrl)) scrape(await read(pageUrl, 'The page with the copy'));
    // About, contact and privacy pages: the links the home page itself gives, else the usual names.
    const want = { about: /about|who-we-are|our-story|company/i, contact: /contact|impressum|imprint/i, privacy: /privacy/i, terms: /terms|conditions|\btos\b|legal/i };
    const LABEL = { about: 'About page', contact: 'Contact page', privacy: 'Privacy policy', terms: 'Terms of service' };
    for (const [k, re] of Object.entries(want)) {
      let url = '';
      if (doc) for (const a of doc.querySelectorAll('a[href]')) {
        const t = (a.textContent || '') + ' ' + a.getAttribute('href');
        if (re.test(t)) { try { const u = new URL(a.getAttribute('href'), hp.url); if (u.hostname.replace(/^www\./, '') === site.replace(/^www\./, '') || u.hostname.endsWith('.' + baseOf(site))) { url = u.href; break; } } catch (e) { /* bad link */ } }
      }
      if (!url) url = home + (k === 'about' ? 'about' : k === 'contact' ? 'contact' : k === 'terms' ? 'terms' : 'privacy-policy');
      const pg = await read(url, LABEL[k]);
      if (pg) { f[k] = pg.url; scrape(pg); }
    }
    if (f.emails.length || f.phones.length) addClue('mail', 'Contact details', [...f.emails, ...f.phones].join(' · '), 'Links on the site');
    if (f.address) addClue('doc', 'Address', f.address, 'The site\'s own data');
    if (f.social.length) addClue('owner', 'Social accounts', f.social.join(' · '), 'Links on the site');
    // Domain records (RDAP, the official replacement for WHOIS).
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
      const r = await fetch('https://rdap.org/domain/' + encodeURIComponent(baseOf(site)), { signal: ctl.signal, credentials: 'omit', headers: { Accept: 'application/rdap+json, application/json' } });
      clearTimeout(t);
      if (r.ok) {
        const j = await r.json();
        const ev = a => ((j.events || []).find(e => e.eventAction === a) || {}).eventDate || '';
        f.created = ev('registration');
        const role = (ents, want2) => { for (const e of ents || []) { if ((e.roles || []).includes(want2)) return e; const i = role(e.entities, want2); if (i) return i; } return null; };
        const vc = e => { const v = e && e.vcardArray && e.vcardArray[1]; const o = {}; for (const x of v || []) { if ((x[0] === 'fn' || x[0] === 'org') && !o.name) o.name = String(x[3]); } return o; };
        const reg = role(j.entities, 'registrar'), own = role(j.entities, 'registrant');
        f.registrar = reg ? vc(reg).name || '' : '';
        const on = own ? vc(own).name || '' : '';
        f.domainHidden = !on || /privacy|redacted|proxy|protect|withheld|domains by proxy|whoisguard|not disclosed/i.test(on);
        if (on && !f.domainHidden) { f.registrant = on; if (!f.names.includes(on)) f.names.push(on); }
        const age = f.created ? ageDays(f.created) : null;
        addClue('globe', 'Domain', [f.created ? 'Registered ' + new Date(f.created).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) + (age < 365 ? ' (' + Math.max(1, Math.round(age / 30)) + ' months ago)' : '') : '', f.registrar ? 'with ' + f.registrar : '', f.domainHidden ? 'Owner hidden by a privacy service.' : on ? 'Owner: ' + on : ''].filter(Boolean).join(' '), 'Domain records');
      }
    } catch (e) { /* no record */ }
    f.group = groupOf(site);
    await DB.put('sites', f);
    return f;
  }
  // Put sites that share an owner together. Only real signs count: a built-in media group, the
  // same company in the footer / privacy page / domain record, the same Analytics or ad ID, or
  // sub-sites of one domain.
  async function owners(sites) {
    const allFacts = new Map((await DB.all('sites')).map(f => [f.site, f]));
    const parent = new Map();
    const find = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
    const join = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
    const how = new Map();
    const note = (s, t) => { if (!how.has(s)) how.set(s, new Set()); how.get(s).add(t); };
    const keyOf = new Map();
    for (const s of sites) parent.set(s, s);
    const claim = (s, key, t) => { if (keyOf.has(key)) { join(s, keyOf.get(key)); note(s, t); note(keyOf.get(key), t); } else keyOf.set(key, s); };
    const NAMES = new Map();
    for (const s of sites) {
      const g = groupOf(s);
      if (g) { claim(s, 'g:' + g.name, g.how); NAMES.set('g:' + g.name, g.name); note(s, g.how); }
      const b = baseOf(s);
      if (b !== s) claim(s, 'b:' + b, 'Sub-sites of ' + b);
      else claim(s, 'b:' + b, 'Sub-sites of ' + b);
      const f = allFacts.get(s);
      if (!f) continue;
      for (const id of f.ids || []) claim(s, 'id:' + id.replace(/^ca-pub-|^pub-/, 'pub-'), /^G-|^UA-|^GTM-/.test(id) ? 'Same Google Analytics ID' : 'Same ad account');
      for (const n of f.names || []) { const k = 'n:' + n.toLowerCase().replace(/[,.]|\b(inc|llc|ltd|plc|corp|co|limited|company|gmbh|the)\b/g, '').replace(/\s+/g, ' ').trim(); if (k.length > 4 && !GENERIC_NAME.test(k.slice(2))) { claim(s, k, 'Same company named on their sites'); if (!NAMES.has(k)) NAMES.set(k, n); } }
    }
    const groups = new Map();
    for (const s of sites) { const r = find(s); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(s); }
    const out = [];
    for (const list of groups.values()) {
      const hows = new Set(); for (const s of list) for (const t of how.get(s) || []) hows.add(t);
      // A name: the built-in group, else the company named most often, else the main domain.
      let name = '', kind = '';
      for (const s of list) { const g = groupOf(s); if (g) { name = g.name; kind = 'Media group'; break; } }
      if (!name) {
        const count = new Map();
        for (const s of list) for (const n of (allFacts.get(s) || {}).names || []) count.set(n, (count.get(n) || 0) + 1);
        const best = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
        if (best && (list.length > 1 || hows.size)) { name = best[0]; kind = list.length > 1 ? 'Owns several sites' : 'Company'; }
      }
      const real = list.length > 1 || !!name;
      out.push({ key: list.slice().sort()[0], name: name || (list.length > 1 ? baseOf(list[0]) : ''), kind: kind || (list.length > 1 ? 'Sub-sites of one domain' : ''), sites: list, how: [...hows], real });
    }
    return out;
  }

  // What to show about a site's owner on a copy and in its evidence report.
  async function ownerFor(site) {
    const f = await facts(site);
    const g = groupOf(site);
    const clues = f ? f.clues || [] : [];
    const name = g ? g.name : f && f.names && f.names[0] || '';
    if (!name && !clues.length) return null;
    return { name, kind: g ? 'Media group' : '', how: g ? [g.how] : [], clues };
  }
  // The full place of a photo in Drive, as you'd type it in File Explorer.
  async function pathOf(p) {
    if (!p || !p.rel) return '';
    if (p.extra) return '(folder you added for ' + p.client + ') \\ ' + p.rel.split('/').slice(1).join(' \\ ');
    const d = await drive();
    return (d.label || 'G:\\Shared drives\\Photos').replace(/[\\/]+$/, '') + '\\' + p.rel.replace(/\//g, '\\');
  }
  // Evidence reports made, for the Evidence library.
  async function logReport(r) {
    const list = (await api.storage.local.get('fcReports')).fcReports || [];
    list.push({ ...r, at: new Date().toISOString() });
    await api.storage.local.set({ fcReports: list.slice(-2000) });
  }

  // ---------------------------------------------------------------- text copies in Documents\PageProof
  // found-copies.txt: one line per copy. pageproof-settings.json: everything you set.
  let copiesT = null, settingsT = null;
  function backupCopiesSoon() { clearTimeout(copiesT); copiesT = setTimeout(writeCopies, 5000); }
  async function writeCopies() {
    try {
      const all = await allCopies();
      writeSiteIndex(all).catch(() => {});
      if ((await RS_DOCS.state()) !== 'granted') return;
      // A Drive photo's id is its path. Only photos searched from the computer need looking up.
      const up = [...new Set(all.map(c => c.photo).filter(id => !String(id).startsWith('d:')))];
      const upNames = new Map((await DB.getMany('photos', up)).map((p, i) => [up[i], p && p.name]));
      const nameOf = c => (String(c.photo).startsWith('d:') ? String(c.photo).slice(2).replace(/^\+/, '') : upNames.get(c.photo) || c.photoName || c.photo);
      const lines = all.map(c => [c.status, c.online, c.client || '', nameOf(c), c.url, c.pct == null ? '' : c.pct, (c.firstSeen || '').slice(0, 10), (c.lastSeen || '').slice(0, 10), c.photo, /^https?:/i.test(c.img || '') ? c.img : ''].map(v => String(v).replace(/[\t\r\n]+/g, ' ')).join('\t'));
      await RS_DOCS.writeText('found-copies.txt', '# PageProof copies found, one per line (tab separated):\n# status\tonline\tclient\tphoto\tpage\tlines up %\tfirst seen\tlast seen\tphoto id\ttheir picture\n' + lines.join('\n') + '\n');
    } catch (e) { /* folder not set up */ }
  }
  // Bring copies back from found-copies.txt after a reinstall.
  async function restoreCopies() {
    if ((await DB.count('copies')) > 0) return 0;
    const t = await RS_DOCS.readText('found-copies.txt');
    if (!t) return 0;
    const acctKept = await meta.get('acctKept');
    const out = [];
    for (const line of t.split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      const [status, online, client, photoName, url, pct, first, last, photo, img] = line.split('\t');
      if (!/^https?:\/\//.test(url || '') || !photo) continue;
      const key = RS_UTIL.key(url);
      out.push({ id: photo + '|' + key, photo, client, url, key, site: RS_SITE.of(url), title: '', thumb: '', img: /^https?:\/\//.test(img || '') ? img : '', engines: [], pct: pct === '' ? null : +pct, match: 'same', firstSeen: first, lastSeen: last, times: 1, status: status || 'new', online: online || 'up', restored: true, photoName });
      const r = out[out.length - 1]; r.country = countryOf(r.site); r.use = useOf(r);
      // 4.9: the account comes back from the link, or from the accounts you typed or found in your browser.
      const kept = (acctKept || {})[key];
      const a = kept ? { ...kept, sure: 'sure' } : (r.use === 'social' && typeof PP_SOCIAL !== 'undefined' ? PP_SOCIAL.fromUrl(url) : null);
      if (a) r.acct = kept ? a : { ...a, from: 'link', sure: 'sure' };
    }
    await DB.putMany('copies', out);
    siteIndexSoon();
    return out.length;
  }
  // flags = true when a photo's flag (or "not a double") changed: only then is every photo read
  // again for the backup. Otherwise the list of flagged photos from last time is reused.
  let flagsDirty = false;
  function backupSoon(flags) { if (flags) flagsDirty = true; clearTimeout(settingsT); settingsT = setTimeout(writeSettings, 3000); }
  async function flagList() {
    let list = flagsDirty ? null : await meta.get('flagsBackup');
    if (!Array.isArray(list)) {
      flagsDirty = false;
      list = (await DB.all('photos')).filter(p => p.flag || p.notDouble || p.stopped).map(p => [p.id, p.flag || '', p.notDouble ? 1 : 0, p.stopped ? 1 : 0]);
      await meta.set('flagsBackup', list);
    }
    return list;
  }
  // 4.39 (Ben's pick): which photos were searched, and when, so a restore or a new computer
  // carries on instead of searching every photo again. [id, last searched, searches, empty
  // searches, first searched]. Rebuilt at most every 6 hours (it reads every photo).
  async function histList() {
    const c = await meta.get('histBackup');
    if (c && Array.isArray(c.list) && Date.now() - c.at < 6 * 3600000) return c.list;
    const list = (await DB.all('photos')).filter(p => p.lastSearched && !p.unreadable).map(p => [p.id, p.lastSearched, p.searches || 0, p.empty || 0, p.firstAt || '']);
    await meta.set('histBackup', { at: Date.now(), list });
    return list;
  }
  async function settingsSnapshot() {
    const st = await api.storage.local.get(['lastCase', 'ppTheme', 'rsSettings', 'fcKeep', 'fcDrive', 'fcShownCountries', 'ppShowGov', 'ppShowPerson', 'ppHw', 'ppSocialSites']);
    const clients = await DB.all('clients');
    const flags = await flagList();
    const regs = Object.fromEntries(Object.entries((await meta.get('regs')) || {}).filter(([, v]) => v.manual));
    return { app: 'PageProof', version: api.runtime.getManifest().version, saved: new Date().toISOString(), name: (st.lastCase || {}).collector || '', theme: st.ppTheme || 'light',
      search: st.rsSettings || null, keep: st.fcKeep || null, drive: st.fcDrive || null, shownCountries: Array.isArray(st.fcShownCountries) ? st.fcShownCountries : SHOWN_START, showGov: !!st.ppShowGov, showPerson: !!st.ppShowPerson, hardware: st.ppHw || null,
      clients: clients.map(c => ({ name: c.name, searching: c.searching, priority: !!c.priority, licensed: c.licensed || [], licensedAcc: c.licensedAcc || [] })), flags, regs, picked: await picked(), unpicked: await unpicked(), forced: await forced(), hist: await histList(), alias: (await meta.get('photoAlias')) || {},
      socialSites: st.ppSocialSites || {}, accounts: (await meta.get('acctKept')) || {}, acctLinks: (await meta.get('acctLinks')) || [], acctType: (await meta.get('acctType')) || {},
      // New tools (Ben's picks): the company cards, credit search wordings and the watch list you set.
      entities: (await meta.get('entities')) || {}, creditCfg: (await meta.get('creditCfg')) || null,
      watch: Object.values(((await meta.get('watch')) || {}).items || {}).filter(i => i.by === 'hand' || i.off).map(i => ({ key: i.key, kind: i.kind, base: i.base || '', url: i.url || '', label: i.label || '', plat: i.plat || '', by: i.by, off: !!i.off })) };
  }
  async function writeSettings() {
    try { await RS_DOCS.writeText('pageproof-settings.json', JSON.stringify(await settingsSnapshot(), null, 1)); await api.storage.local.set({ ppBackupAt: new Date().toISOString() }); } catch (e) { /* folder not set up */ }
  }
  async function readBackup() {
    try { const t = await RS_DOCS.readText('pageproof-settings.json'); const j = t && JSON.parse(t); return j && j.app === 'PageProof' ? j : null; } catch (e) { return null; }
  }
  async function restore(j) {
    const str = v => (typeof v === 'string' ? v.slice(0, 200) : '');
    const set = {};
    if (j.name) { const lc = (await api.storage.local.get('lastCase')).lastCase || {}; set.lastCase = { ...lc, collector: str(j.name) }; }
    if (j.theme === 'dark' || j.theme === 'light') set.ppTheme = j.theme;
    if (j.search && typeof j.search === 'object') {
      const e = j.search.engines && typeof j.search.engines === 'object' ? j.search.engines : {};
      set.rsSettings = { engines: { google: e.google !== false, yandex: e.yandex !== false, bing: e.bing !== false }, speed: ['careful', 'normal', 'quick'].includes(j.search.speed) ? j.search.speed : 'normal' };
    }
    if (j.keep && typeof j.keep === 'object') {
      const k = j.keep, hr = v => (Number.isInteger(v) && v >= 0 && v <= 23 ? v : null);
      set.fcKeep = { ...KEEP_DEFAULT, on: false, pace: PACE[k.pace] ? k.pace : KEEP_DEFAULT.pace, hours: k.hours === 'all' ? 'all' : 'work', from: hr(k.from) ?? KEEP_DEFAULT.from, to: hr(k.to) ?? KEEP_DEFAULT.to,
        weekdays: k.weekdays !== false, fiftyTime: /^\d\d:\d\d$/.test(k.fiftyTime || '') ? k.fiftyTime : KEEP_DEFAULT.fiftyTime, fiftyAuto: k.fiftyAuto === true, perDay: [10, 25, 50, 75, 100].includes(k.perDay) ? k.perDay : 50,
        firstShare: [2, 3, 4].includes(k.firstShare) ? k.firstShare : 3, fiftyWhich: k.fiftyWhich === 'first' ? 'first' : 'next', goal: /^\d{4}-\d{2}-\d{2}$/.test(k.goal || '') ? k.goal : '' };
    }
    if (j.drive && typeof j.drive === 'object') set.fcDrive = { label: str(j.drive.label) || 'G:\\Shared drives\\Photos', done: false };
    if (Array.isArray(j.shownCountries)) set.fcShownCountries = j.shownCountries.map(str).filter(Boolean);
    if (typeof j.showGov === 'boolean') set.ppShowGov = j.showGov;
    if (typeof j.showPerson === 'boolean') set.ppShowPerson = j.showPerson;
    if (j.socialSites && typeof j.socialSites === 'object') set.ppSocialSites = Object.fromEntries(Object.entries(j.socialSites).filter(([k, v]) => typeof k === 'string' && (v === 'social' || v === 'web')).map(([k, v]) => [k.slice(0, 200), v]));
    if (j.hardware && typeof j.hardware === 'object') set.ppHw = { choice: ['auto', 'Light', 'Normal', 'Strong'].includes(j.hardware.choice) ? j.hardware.choice : 'auto' };
    await api.storage.local.set(set);
    if (Array.isArray(j.clients)) await DB.putMany('clients', j.clients.filter(c => c && typeof c.name === 'string').map(c => ({ name: tidyClient(c.name), searching: c.searching === true ? true : c.searching === false ? false : null, priority: !!c.priority, licensed: Array.isArray(c.licensed) ? c.licensed.map(str) : [], licensedAcc: Array.isArray(c.licensedAcc) ? c.licensedAcc.map(str) : [], photos: 0 })));
    if (j.accounts && typeof j.accounts === 'object') { const a = {}; for (const [k, v] of Object.entries(j.accounts)) if (v && typeof v.key === 'string') a[str(k)] = { key: str(v.key), handle: str(v.handle), url: /^https?:\/\//.test(v.url || '') ? str(v.url) : '', plat: str(v.plat), from: v.from === 'browser' ? 'browser' : 'you' }; await meta.set('acctKept', a); }
    if (j.acctType && typeof j.acctType === 'object') { const TY = ['Business', 'Creator', 'Organisation', 'Government', 'News or media', 'Fan page', 'Group', 'Person']; await meta.set('acctType', Object.fromEntries(Object.entries(j.acctType).filter(([k, v]) => typeof k === 'string' && TY.includes(v)).map(([k, v]) => [str(k), v]))); }
    if (j.entities && typeof j.entities === 'object') { const E = {}; for (const [k, v] of Object.entries(j.entities)) if (v && typeof v === 'object') E[str(k)] = Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === 'string').map(([f, x]) => [str(f), str(x)])); await meta.set('entities', E); }
    if (j.creditCfg && typeof j.creditCfg === 'object') { const cl = {}; for (const [k, v] of Object.entries(j.creditCfg.clients || {})) if (v && typeof v === 'object') cl[str(k)] = { on: v.on !== false, words: Array.isArray(v.words) ? v.words.filter(w => typeof w === 'string').map(str).slice(0, 8) : [] }; await meta.set('creditCfg', { on: j.creditCfg.on !== false, every: Number.isInteger(j.creditCfg.every) && j.creditCfg.every >= 5 ? j.creditCfg.every : 15, clients: cl }); }
    if (Array.isArray(j.watch)) { const items = {}; for (const i of j.watch) if (i && typeof i.key === 'string' && /^[as]:/.test(i.key)) items[str(i.key)] = { key: str(i.key), kind: i.kind === 'acct' ? 'acct' : 'site', base: str(i.base), url: /^https?:\/\//.test(i.url || '') ? str(i.url) : '', label: str(i.label), plat: str(i.plat), by: i.by === 'hand' ? 'hand' : 'auto', off: !!i.off }; await meta.set('watch', { items }); }
    if (Array.isArray(j.acctLinks)) await meta.set('acctLinks', j.acctLinks.filter(Array.isArray).map(g => g.filter(k => typeof k === 'string').map(str)).filter(g => g.length > 1));
    if (Array.isArray(j.forced)) await meta.set('forced', j.forced.filter(r => typeof r === 'string' && r && !r.split('/').includes('..')).map(r => r.slice(0, 1000)));
    if (Array.isArray(j.unpicked)) await meta.set('unpicked', j.unpicked.filter(r => typeof r === 'string' && r && !r.split('/').includes('..')).map(r => r.slice(0, 1000)));
    if (Array.isArray(j.picked)) await meta.set('picked', j.picked.filter(r => typeof r === 'string' && r && !r.split('/').includes('..')).map(r => r.slice(0, 1000)));
    if (Array.isArray(j.flags)) await meta.set('pendingFlags', j.flags.filter(f => Array.isArray(f) && typeof f[0] === 'string').map(f => [f[0].slice(0, 2000), ['hi', 'pop'].includes(f[1]) ? f[1] : '', f[2] ? 1 : 0, f[3] ? 1 : 0]));
    if (Array.isArray(j.hist)) {
      const iso = v => (typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) ? v.slice(0, 30) : '');
      const n = v => (Number.isFinite(v) && v >= 0 ? Math.min(v, 1e6) : 0);
      await meta.set('pendingHist', j.hist.filter(h => Array.isArray(h) && typeof h[0] === 'string' && iso(h[1])).map(h => [h[0].slice(0, 2000), iso(h[1]), n(h[2]), n(h[3]), iso(h[4])]));
    }
    if (j.alias && typeof j.alias === 'object') { const a = (await meta.get('photoAlias')) || {}; for (const [k, v] of Object.entries(j.alias)) if (typeof k === 'string' && typeof v === 'string') a[k.slice(0, 2000)] = v.slice(0, 2000); await meta.set('photoAlias', a); }
    if (j.regs && typeof j.regs === 'object') { const regs = (await meta.get('regs')) || {}; for (const [k, v] of Object.entries(j.regs)) if (v && typeof v === 'object') regs[str(k)] = { va: str(v.va), app: str(v.app), from: 'Typed in by you for this folder', manual: true }; await meta.set('regs', regs); }
    await restoreCopies();
    await applyPendingFlags().catch(() => {});
  }
  // Flags restored from a backup are put back on the photos once the folders are read again.
  async function applyPendingFlags() {
    const alias = (await meta.get('photoAlias')) || {};
    const list = await meta.get('pendingFlags');
    if (list && list.length) {
      const left = [];
      for (const [id, flag, nd, st] of list) { const p = await DB.get('photos', alias[id] || id); if (p) { p.flag = flag; if (nd) p.notDouble = true; if (st && !p.stopped) p.stopped = new Date().toISOString(); await DB.put('photos', p); } else left.push([id, flag, nd, st]); }
      await meta.set('pendingFlags', left);
      if (left.length !== list.length) backupSoon(true);
    }
    // 4.39: search history from a backup. The newer of the two dates wins, so a photo searched
    // here since the backup keeps its own date.
    const hist = await meta.get('pendingHist');
    if (hist && hist.length) {
      const left = [], put = [];
      const recs = await DB.getMany('photos', hist.map(h => alias[h[0]] || h[0]));
      hist.forEach((h, i) => {
        const p = recs[i];
        if (!p) { left.push(h); return; }
        if ((h[1] || '') > (p.lastSearched || '')) { p.lastSearched = h[1]; p.empty = h[3]; }
        p.searches = Math.max(p.searches || 0, h[2] || 0);
        if (h[4] && (!p.firstAt || h[4] < p.firstAt)) p.firstAt = h[4];
        put.push(p);
      });
      await DB.putMany('photos', put);
      await meta.set('pendingHist', left);
      if (put.length) { queueDirty(); COVER = null; }
    }
  }

  return { claimed, claimReset, SET_ASIDE, DB, meta, open, touch, pics, dropDotMatches, checkerRemove, pageKey, mergeSamePages, markCaptured, kept, pages, keepOriginal, keepSoon, pruneKept, thumbOf, setThumb, movePics, skipped, retrySkipped, readPhoto, SKIP_LABEL, SKIP_WHY, engines, engineResults, brokenEngines, retryEngine, ENGINE_NAME, perf, timed, countNew, siteFinds, driveStateSoft, keep, setKeep, inHours, quietOK, PACE, drive, setDrive, driveState, allowDrive, pickRoot, pickExtra, rootHandle, extraHandles, fileFor, tidyClient,
    regIn, regFor, setReg, scan, quickClients, clientFolders, dirAt, subfolders, folderInfo, picked, unpicked, forced, setPicked, pickInside, SCAN, applyPendingFlags, missingPicks, movedNote, followMoves, watchFolders, newFolders, newFoldersSeen, goalPlan, workMinutes, exifDate, heatShoot, coolShoot, burstSibling, wakeBurst, lookHash, findDoubles, doublesOf, plan, next, buildQueue, queueDirty, resetQueue, coverage,
    photoForPic, ingest, rescue, searchedNothing, copiesOf, allCopies, answer, licenseSite, approveSite, approveAccount, acctApproved, setAcct, hiddenCopy, setClientOf, setFlag, setStopped, setClients, logWeek, week, weekKey, firstNotes, searchedOnce, dayLog, speed, ladder, LADDER, alikeFrames, mixYears, mixLine,
    isPool, shownCountries, setShownCountries, SHOWN_START, ownerFor, pathOf, logReport, USE, useOf, riskOf, spamMarks, randomLabel, countryOf, COUNTRY, baseOf, groupOf, facts, lookup, owners,
    backupSoon, backupCopiesSoon, writeSettings, writeCopies, readBackup, restore, restoreCopies, settingsSnapshot, monthsOld, newness, yearOf, quarterOf, dayOf };
})();
