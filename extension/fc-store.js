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
  const KEEP_DEFAULT = { on: false, pace: 'Steady', hours: 'work', from: 8, to: 18, weekdays: true, fiftyTime: '09:00', fiftyAuto: false, perDay: 50 };
  const PACE = { Gentle: 10, Steady: 5, Faster: 2 };      // minutes between photos
  async function keep() { return { ...KEEP_DEFAULT, ...((await api.storage.local.get('fcKeep')).fcKeep || {}) }; }
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

  // Walk a path like "NY Post/Registered images/2026/Q4/x.jpg" down from its top folder.
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
  // Copyright Office numbers. "VA0002318552" or "VA 2-318-552" = registered (the registration number).
  // "1-11583920471" = the application (case) number.
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
  // A folder inside the top folder, by its path ("Every Other - G-H/NY Post").
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
  async function setPicked(list) {
    // A folder inside another ticked folder is already included.
    const clean = [...new Set(list.map(r => String(r).replace(/^\/+|\/+$/g, '')).filter(Boolean))].sort();
    const keep = clean.filter(r => !clean.some(o => o !== r && r.startsWith(o + '/')));
    await meta.set('picked', keep); queueDirty(); backupSoon();
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
      for (const rel of picks || []) { try { list.push([rel, await dirAt(rel)]); } catch (e) { /* folder gone or Drive offline */ } }
      for (const [rel, h] of list) {
        const parts = rel.split('/');
        let base = null, baseName = '', name = parts[parts.length - 1], folderRel = rel;
        if (/^registered/i.test(name) && parts.length > 1) { base = h; name = parts[parts.length - 2]; folderRel = parts.slice(0, -1).join('/'); }
        else for (const [n2, h2] of await listDirs(h)) if (/^registered/i.test(n2)) { base = h2; baseName = n2; break; }
        const info = { ...(await readInfo(h)), ...(base && base !== h ? await readInfo(base) : {}) };
        if (info.id) name = info.id;
        out.push({ name: tidyClient(name), folder: folderRel, base: base || h, baseName: base === h ? '' : baseName, rel: rel + (baseName && base !== h ? '/' + baseName : ''), pick: rel });
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
      const files = [], dirs = [], txt = [];
      for await (const [name, h] of dir.entries()) {
        if (/^[.$~]/.test(name)) continue;
        if (h.kind === 'directory') dirs.push([name, h]);
        else if (IMAGE.test(name)) files.push(name);
        else if (/^client_info(_ignore)?\.txt$/i.test(name)) txt.push(name);
        else if (SHEET.test(name)) { const r = regIn(name); if (r) regs[rel] = { ...(regs[rel] || {}), ...r, from: 'File name in this folder: ' + name }; }
      }
      if (txt.length) {
        const info = await readInfo(dir, txt);
        if (info.ignore) { if (onDir) onDir(rel, 0, true); return; }
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
  const newness = p => (p.year || 0) * 1000 + (p.quarter || 0) * 200 + (p.day || 0);
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
        const pre = 'd:' + (cf.extra ? '+' : '') + cf.rel + '/';
        const seen = new Set(), batch = [], subs = {}, subsNew = {}, found = [];
        let n = 0, skipped = 0, mineNew = 0;
        if (progress) progress('Reading ' + cf.name + '…');
        const r = await walkClient(cf, f => { found.push(f); }, only, (rel, k, ignored) => { if (ignored) skipped++; });
        // What's already known about these photos, so flags and search history stay. The weekly
        // check reads all of this client's photos (to spot the ones that are gone); the hourly
        // look only reads the few it found, not the whole library.
        const have = full ? new Map((await DB.prefix('photos', pre)).map(p => [p.id, p]))
          : new Map((await DB.getMany('photos', found.map(f => 'd:' + (cf.extra ? '+' : '') + f.rel))).filter(Boolean).map(p => [p.id, p]));
        for (const f of found) {
          const id = 'd:' + (cf.extra ? '+' : '') + f.rel;
          // A client_info.txt further down names a different client for those photos.
          const who = f.client || cf.name;
          delete f.client;
          seen.add(id);
          if (who === cf.name) n++; else subs[who] = (subs[who] || 0) + 1;
          const p = have.get(id);
          if (p) { if (p.year !== f.year || p.quarter !== f.quarter || p.day !== f.day || p.gone || p.client !== who) { Object.assign(p, f, { gone: false, client: who }); p.order = newness(p); batch.push(p); } continue; }
          const np = { id, client: who, extra: !!cf.extra, ...f, flag: '', searches: 0, empty: 0, copies: 0, stolen: 0, added: gen };
          np.order = newness(np);
          batch.push(np); added++;
          if (who === cf.name) mineNew++; else subsNew[who] = (subsNew[who] || 0) + 1;
        }
        // Clients named by a client_info.txt inside this folder: searched like the folder they're in.
        for (const [name, cnt] of Object.entries(subs)) {
          const o = known.get(name) || (await DB.get('clients', name));
          await DB.put('clients', { ...(o || {}), name, searching: o ? o.searching : client.searching, priority: o ? !!o.priority : client.priority, photos: full ? cnt : ((o && o.photos) || 0) + (subsNew[name] || 0), licensed: o ? o.licensed || [] : [], from: cf.name, scanned: full || !o ? new Date().toISOString() : o.scanned });
        }
        client.ignored = skipped;
        for (const [k, v] of Object.entries(r)) regs[k] = { ...v, ...(regs[k] && regs[k].manual ? regs[k] : {}) };
        await DB.putMany('photos', batch);
        if (full) {
          // Photos no longer in the folder are kept (their copies matter) but marked gone.
          const gone = [];
          for (const [id, p] of have) if (!seen.has(id) && !p.gone) { p.gone = true; gone.push(p); }
          removed += gone.length;
          await DB.putMany('photos', gone);
          client.photos = n;
        } else client.photos = (old ? old.photos : 0) + mineNew;
        if (full) client.scanned = new Date().toISOString();
        total += client.photos;
        await DB.put('clients', client);
      }
      await meta.set('regs', regs);
      await meta.set('scan', { at: new Date().toISOString(), full, added, removed, total });
      if (full) await meta.set('fullScan', new Date().toISOString());
      queueDirty();
      await findDoubles().catch(() => {});
      touch('photos');
      perf(full ? 'readEveryFolder' : 'readNewFolders', Date.now() - scanT0, total);
      return { clients: folders.length, photos: total, added, removed };
    } finally { SCAN.busy = false; }
  }
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
    if (!p.year) return 999;
    const m = (now.getFullYear() - p.year) * 12 + now.getMonth() - ((p.quarter || 4) * 3 - 1);
    return Math.max(0, m);
  }
  // POOL photos (court photos shared with other papers, named like 10.29.26_POOL_Subject_Name.jpg)
  // may be used by others on purpose, so they are never searched. Rename without POOL to search.
  const isPool = name => /(^|[_\s.-])POOL([_\s.-]|$)/.test(String(name || ''));
  function plan(p, client) {
    if (isPool(p.name)) return { tier: 7, due: false, pool: true };
    const since = ageDays(p.lastSearched);
    if (p.retry) return { tier: 0, due: true };                       // "Try again" on the Skipped photos page
    // A photo that could not be opened is tried again every 3 months (never, if it is a kind
    // of file that can't be searched).
    if (p.unreadable) return { tier: 6, due: p.skip !== 'type' && since > 90, quiet: true };
    if (p.flag === 'hi' && (since > 3 || !p.lastSearched || (p.flagged && p.flagged > (p.lastSearched || '')))) return { tier: 0, due: true };
    const quiet = p.empty >= 10 ? 90 : p.empty >= 5 ? 30 : 0;
    if (quiet && !p.flag) return { tier: 6, due: since > quiet, quiet: true };
    if ((p.flag === 'pop' || p.stolen > 0) && since > 7) return { tier: 3, due: true };
    const age = monthsOld(p);
    const every = age <= 3 ? 30 : age <= 12 ? 180 : 365;
    const due = !p.lastSearched || since > every;
    if (client && client.priority) return { tier: 1, due: due || (since > 7 && age <= 3) };
    return { tier: age <= 3 ? 2 : 4, due };
  }
  let QUEUE = null, QUEUE_AT = 0;
  // quiet = only this page's list (a photo was just searched: the Keep searching window skips it
  // anyway). Otherwise every page rebuilds its list (flags, clients or folders changed).
  function queueDirty(quiet) { QUEUE = null; if (!quiet) api.storage.local.set({ fcQueueDirty: Date.now() }).catch(() => {}); }
  function resetQueue() { QUEUE = null; }
  async function buildQueue() {
    const t0 = Date.now();
    const clients = new Map((await DB.all('clients')).map(c => [c.name, c]));
    const photos = await DB.all('photos');
    const out = [];
    for (const p of photos) {
      if (p.gone || p.doubleOf) continue;
      const c = clients.get(p.client);
      if (!c || c.searching !== true) continue;
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
    perf('searchLine', Date.now() - t0, photos.length);
    return out;
  }
  // The next n photos to search (skipping ids in "skip": already running or just done).
  async function next(n = 1, skip = new Set()) {
    if (!QUEUE || Date.now() - QUEUE_AT > 3600000) await buildQueue();
    const ids = [];
    for (const q of QUEUE) { if (ids.length >= n) break; if (!skip.has(q.id)) ids.push(q.id); }
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
    for (const p of await DB.all('photos')) {
      if (p.gone) continue;
      if (p.doubleOf) { doubles++; continue; }
      const c = clients.get(p.client);
      if (!c || c.searching !== true) continue;
      total++;
      const since = ageDays(p.lastSearched), age = monthsOld(p);
      const k = p.flag === 'hi' || (c && c.priority) ? 'top' : age <= 3 ? 'recent' : age <= 12 ? 'year' : 'older';
      const ok = k === 'top' ? since <= 7 : k === 'recent' ? since <= 30 : k === 'year' ? since <= 183 : since <= 365;
      g[k][1]++; if (ok) g[k][0]++;
      if (p.empty >= 5) quiet++;
    }
    COVER = { at: Date.now(), v: { groups: g, total, quiet, doubles } };
    return COVER.v;
  }

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
  async function readPhoto(p) {
    const t0 = Date.now();
    if (/\.(tiff?|heic|heif)$/i.test(p.name || '')) { await noteSkip(p, 'type'); return { error: SKIP_WHY.type }; }
    let file;
    try { file = await fileFor(p); }
    catch (e) {
      if (e && e.name === 'NotFoundError' && (await driveState(true)) === 'granted') { await noteSkip(p, 'gone'); return { error: SKIP_WHY.gone }; }
      return { error: 'Google Drive could not be reached for this photo.', soft: true };
    }
    if (!file.size) { await noteSkip(p, 'empty'); return { error: SKIP_WHY.empty }; }
    let pic;
    try { pic = await RS_JOB.prepare(file, { fcId: p.id, folderKey: p.rel }); } catch (e) { pic = { error: String(e && e.message || e) }; }
    if (pic.error) { await noteSkip(p, 'broken'); return { error: SKIP_WHY.broken }; }
    if (p.unreadable || p.skip) { delete p.unreadable; delete p.skip; await DB.put('photos', p); await clearSkip([p.id]); }
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
    if (SOCIAL.test(site) || CDN_SOCIAL.test(ih)) return 'social';
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
  async function copiesOf(photoId) { return DB.by('copies', 'photo', photoId); }
  async function allCopies() {
    if (COPIES) return COPIES;
    const t0 = Date.now(), gen = COPIES_GEN, list = await DB.all('copies');
    if (gen === COPIES_GEN) COPIES = list;      // nothing changed while reading
    perf('readCopies', Date.now() - t0, list.length);
    return list;
  }
  const countNew = () => DB.countBy('copies', 'status', 'new');
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
  async function ingest(pic, links, by) {
    const p = await photoForPic(pic);
    p.hash = p.hash || pic.hash; p.w = p.w || pic.w; p.h = p.h || pic.h; p.size = p.size || pic.size;
    if (!p.look && pic.blob) { try { p.look = await lookHash(pic.blob); } catch (e) { /* skip */ } }
    const now = new Date().toISOString();
    const client = p.client ? await DB.get('clients', p.client) : null;
    const lic = new Set((client && client.licensed) || []);
    const old = new Map((await copiesOf(p.id)).map(c => [c.id, c]));
    const out = [];
    let fresh = 0;
    for (const l of links) {
      const id = p.id + '|' + l.key;
      const c = old.get(id);
      // A small picture that is too big to keep is left out (cutting it short would break it).
      const th = String(l.thumb || '');
      const base = { url: l.url, key: l.key, site: l.site, title: l.title || '', thumb: th.length <= 60000 ? th : '', img: l.img || '', engines: l.engines || [], exact: !!l.exact,
        pct: l.pct, inl: l.inl, tiles: l.tiles, str: l.str, mid: l.mid, match: l.verdict, w: l.w, h: l.h };
      if (c) {
        if (!base.thumb && c.thumb) base.thumb = c.thumb;
        if (!base.thumb && !c.thumb && c.th) delete base.thumb;      // its preview is already kept
        if (!base.img && c.img) base.img = c.img;
        Object.assign(c, base, { lastSeen: now, times: (c.times || 1) + 1 });
        if (c.online === 'gone') { c.online = 'back'; c.backAt = now; }
        out.push(c);
      } else {
        const n = { id, photo: p.id, client: p.client || '', ...base, firstSeen: now, lastSeen: now, times: 1, by, status: 'new', online: 'up' };
        if (lic.has(baseOf(l.site)) || lic.has(l.site)) { n.status = 'licensed'; n.auto = 'Approved site for this client'; }
        else if (approvedForAll(l.site)) { n.status = 'licensed'; n.auto = 'Approved site for every client'; }
        n.country = countryOf(l.site); n.use = useOf(n);
        out.push(n); fresh++;
      }
    }
    const newPics = out.map(splitPic).filter(Boolean);
    await pics.putMany(newPics);
    await DB.putMany('copies', out);
    // Their copy of the photo is kept the moment it is found (not for sites already approved).
    keepSoon(out.filter(c => c.times === 1 && c.status === 'new'));
    const all = await copiesOf(p.id);
    p.searches = (p.searches || 0) + 1;
    p.lastSearched = now;
    delete p.retry;
    p.empty = links.length ? 0 : (p.empty || 0) + 1;
    p.copies = all.filter(c => c.status !== 'removed').length;
    p.stolen = all.filter(c => c.status === 'stolen').length;
    if (all.length && pic.thumb && !p.thumb && !p.th) { p.thumb = pic.thumb; const pr = splitPic(p); if (pr) await pics.putMany([pr]); }
    await DB.put('photos', p);
    if (client) { client.lastSearched = now; await DB.put('clients', client); }
    // Keep today's tally for the side panel and Home.
    const day = new Date().toDateString();
    const t = (await api.storage.local.get('fcToday')).fcToday || {};
    const today = t.day === day ? t : { day, searched: 0, found: 0 };
    today.searched++; today.found += fresh;
    await api.storage.local.set({ fcToday: today, fcLastSearch: Date.now() });
    await logWeek({ searched: 1, found: fresh, client: p.client || '' });
    queueDirty(true); backupCopiesSoon(); touch('copies');
    return { photo: p, fresh };
  }
  // Add ONE link to the copies of a photo by hand (a link the checker threw out that you say is
  // a copy). Unlike ingest(), it doesn't count as a search.
  async function rescue(pic, l, by) {
    const p = await photoForPic(pic);
    const id = p.id + '|' + l.key, now = new Date().toISOString();
    if (await DB.get('copies', id)) return;
    const n = { id, photo: p.id, client: p.client || '', url: l.url, key: l.key, site: l.site, title: l.title || '', thumb: String(l.thumb || '').slice(0, 60000), img: l.img || '',
      engines: l.engines || [], exact: !!l.exact, pct: l.pct, inl: l.inl, tiles: l.tiles, str: l.str, mid: l.mid, match: l.verdict || 'maybe', w: l.w, h: l.h,
      firstSeen: now, lastSeen: now, times: 1, by: (by || 'a search') + ' (added by hand)', status: 'new', online: 'up' };
    n.country = countryOf(l.site); n.use = useOf(n);
    const np = splitPic(n);
    if (np) await pics.putMany([np]);
    await DB.put('copies', n);
    p.copies = (await copiesOf(p.id)).filter(c => c.status !== 'removed').length;
    if (pic.thumb && !p.thumb && !p.th) { p.thumb = pic.thumb; const pr = splitPic(p); if (pr) await pics.putMany([pr]); }
    await DB.put('photos', p);
    queueDirty(true); backupCopiesSoon(); touch('copies');
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
  // Mark a photo as searched with nothing found (so it moves down the line).
  async function searchedNothing(pic, by) { return ingest(pic, [], by); }

  // ---------------------------------------------------------------- your answers
  // Each change returns an "undo" that puts every touched copy back exactly as it was.
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
      if (status === 'skip') { c.skipped = now; }
      else { c.status = status; c.answered = now; delete c.skipped; }
      Object.assign(c, extra);
      touchedPhotos.add(c.photo);
      if (status === 'removed') {
        if (!names.has(c.photo)) { const p = await DB.get('photos', c.photo); names.set(c.photo, p ? p.name : ''); }
        try { if (!RS_REJECT.find(c.url, names.get(c.photo), '')) { RS_REJECT.items.push({ url: c.url, pic: names.get(c.photo) || '', why: '' }); RS_REJECT.noteKey(c.url, names.get(c.photo) || '', ''); rejects++; } } catch (e) { /* lists not loaded */ }
      }
      if (status === 'stolen' || status === 'licensed' || status === 'removed') tally[c.client || ''] = (tally[c.client || ''] || 0) + 1;
    }
    await DB.putMany('copies', got);
    if (rejects) { try { await RS_REJECT.save(); } catch (e) { /* lists not loaded */ } }
    for (const [client, n] of Object.entries(tally)) await logWeek({ [status]: n, client });
    await recount(touchedPhotos);
    backupCopiesSoon(); touch('copies');
    if (status === 'stolen') queueDirty();
    return async () => {
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
  async function setClients(names, ch) {
    for (const n of names) {
      const c = await DB.get('clients', n);
      if (!c) continue;
      Object.assign(c, ch);
      await DB.put('clients', c);
    }
    queueDirty(); backupSoon(); touch('clients');
  }

  // ---------------------------------------------------------------- still online?
  // Opens the page (without your cookies) and looks for the photo's file name in it.
  async function checkOnline(c) {
    let state = 'up', why = '';
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
      const r = await fetch(c.url, { credentials: 'omit', redirect: 'follow', signal: ctl.signal });
      clearTimeout(t);
      if (r.status === 404 || r.status === 410) { state = 'gone'; why = 'The page is gone (' + r.status + ')'; }
      else if (r.ok) {
        const html = (await r.text()).slice(0, 4e6);
        let file = '';
        try { file = c.img ? decodeURIComponent(new URL(c.img).pathname.split('/').pop()).replace(/\.[a-z0-9]+$/i, '').replace(/[-_]\d{2,4}x\d{2,4}$/, '') : ''; } catch (e) { /* none */ }
        if (file && file.length >= 6 && !html.includes(file)) { state = 'gone'; why = 'The page is there, but the photo is not on it any more'; }
      } else { why = 'The site answered ' + r.status + '. Checked again next week.'; state = c.online || 'up'; }
    } catch (e) { why = 'The site did not answer. Checked again next week.'; state = c.online || 'up'; }
    const was = c.online;
    c.checked = new Date().toISOString();
    if (state === 'gone' && was !== 'gone') { c.goneAt = c.checked; await logWeek({ wentOffline: 1, site: c.site }); }
    if (state === 'up' && was === 'gone') { state = 'back'; c.backAt = c.checked; await logWeek({ backOnline: 1, site: c.site }); }
    if (state === 'up' && was === 'back') state = 'back';
    c.online = state; c.onlineWhy = why;
    await DB.put('copies', c);
    touch('copies');
    return c;
  }

  // ---------------------------------------------------------------- the week, for the weekly summary
  const weekKey = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.toISOString().slice(0, 10); };
  async function logWeek(add) {
    const k = 'week:' + weekKey();
    const w = (await meta.get(k)) || { searched: 0, found: 0, stolen: 0, licensed: 0, removed: 0, wentOffline: 0, backOnline: 0, clients: {}, offline: [], back: [] };
    for (const f of ['searched', 'found', 'stolen', 'licensed', 'removed', 'wentOffline', 'backOnline']) if (add[f]) w[f] = Math.max(0, (w[f] || 0) + add[f]);
    if (add.client !== undefined) {
      const c = w.clients[add.client || 'Client unknown'] = w.clients[add.client || 'Client unknown'] || { searched: 0, found: 0, stolen: 0 };
      if (add.searched) c.searched += add.searched; if (add.found) c.found += add.found; if (add.stolen) c.stolen = Math.max(0, c.stolen + add.stolen);
    }
    if (add.wentOffline && add.site) w.offline.push([add.site, new Date().toISOString()]);
    if (add.backOnline && add.site) w.back.push([add.site, new Date().toISOString()]);
    await meta.set(k, w);
  }
  const week = key => meta.get('week:' + (key || weekKey()));

  // ---------------------------------------------------------------- hidden countries
  async function hiddenCountries() { return (await api.storage.local.get('fcHiddenCountries')).fcHiddenCountries || []; }
  async function setHiddenCountries(list) {
    await api.storage.local.set({ fcHiddenCountries: list });
    try { await RS_DOCS.writeText('hidden-countries.txt', '# PageProof hidden countries, one per line. Copies on sites from these countries are not shown.\n' + list.join('\n') + '\n'); } catch (e) { /* folder not set up */ }
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
    const f = { site, at: new Date().toISOString(), names: [], emails: [], phones: [], social: [], ids: [], pages: [], clues: [] };
    const seen = new Set();
    const read = async (url, label) => {
      if (seen.has(url) || f.pages.length >= 6) return null;
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
      const og = doc.querySelector('meta[property="og:site_name"]');
      if (og && og.content && !f.siteName) f.siteName = clean(og.content).slice(0, 80);
      return doc;
    };
    const home = 'https://' + site + '/';
    const hp = await read(home, 'Home page');
    const doc = scrape(hp);
    if (pageUrl && /^https?:/.test(pageUrl)) scrape(await read(pageUrl, 'The page with the copy'));
    // About, contact and privacy pages: the links the home page itself gives, else the usual names.
    const want = { about: /about|who-we-are|our-story|company/i, contact: /contact|impressum|imprint/i, privacy: /privacy|legal|terms/i };
    const LABEL = { about: 'About page', contact: 'Contact page', privacy: 'Privacy policy' };
    for (const [k, re] of Object.entries(want)) {
      let url = '';
      if (doc) for (const a of doc.querySelectorAll('a[href]')) {
        const t = (a.textContent || '') + ' ' + a.getAttribute('href');
        if (re.test(t)) { try { const u = new URL(a.getAttribute('href'), hp.url); if (u.hostname.replace(/^www\./, '') === site.replace(/^www\./, '') || u.hostname.endsWith('.' + baseOf(site))) { url = u.href; break; } } catch (e) { /* bad link */ } }
      }
      if (!url) url = home + (k === 'about' ? 'about' : k === 'contact' ? 'contact' : 'privacy-policy');
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
    const out = [];
    for (const line of t.split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      const [status, online, client, photoName, url, pct, first, last, photo, img] = line.split('\t');
      if (!/^https?:\/\//.test(url || '') || !photo) continue;
      const key = RS_UTIL.key(url);
      out.push({ id: photo + '|' + key, photo, client, url, key, site: RS_SITE.of(url), title: '', thumb: '', img: /^https?:\/\//.test(img || '') ? img : '', engines: [], pct: pct === '' ? null : +pct, match: 'same', firstSeen: first, lastSeen: last, times: 1, status: status || 'new', online: online || 'up', restored: true, photoName });
      const r = out[out.length - 1]; r.country = countryOf(r.site); r.use = useOf(r);
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
      list = (await DB.all('photos')).filter(p => p.flag || p.notDouble).map(p => [p.id, p.flag || '', p.notDouble ? 1 : 0]);
      await meta.set('flagsBackup', list);
    }
    return list;
  }
  async function settingsSnapshot() {
    const st = await api.storage.local.get(['lastCase', 'ppTheme', 'rsSettings', 'fcKeep', 'fcDrive', 'fcHiddenCountries', 'ppHw']);
    const clients = await DB.all('clients');
    const flags = await flagList();
    const regs = Object.fromEntries(Object.entries((await meta.get('regs')) || {}).filter(([, v]) => v.manual));
    return { app: 'PageProof', version: api.runtime.getManifest().version, saved: new Date().toISOString(), name: (st.lastCase || {}).collector || '', theme: st.ppTheme || 'light',
      search: st.rsSettings || null, keep: st.fcKeep || null, drive: st.fcDrive || null, hiddenCountries: st.fcHiddenCountries || [], hardware: st.ppHw || null,
      clients: clients.map(c => ({ name: c.name, searching: c.searching, priority: !!c.priority, licensed: c.licensed || [] })), flags, regs, picked: await picked() };
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
        weekdays: k.weekdays !== false, fiftyTime: /^\d\d:\d\d$/.test(k.fiftyTime || '') ? k.fiftyTime : KEEP_DEFAULT.fiftyTime, fiftyAuto: k.fiftyAuto === true, perDay: [10, 25, 50, 75, 100].includes(k.perDay) ? k.perDay : 50 };
    }
    if (j.drive && typeof j.drive === 'object') set.fcDrive = { label: str(j.drive.label) || 'G:\\Shared drives\\Photos', done: false };
    if (Array.isArray(j.hiddenCountries)) set.fcHiddenCountries = j.hiddenCountries.map(str).filter(Boolean);
    if (j.hardware && typeof j.hardware === 'object') set.ppHw = { choice: ['auto', 'Light', 'Normal', 'Strong'].includes(j.hardware.choice) ? j.hardware.choice : 'auto' };
    await api.storage.local.set(set);
    if (Array.isArray(j.clients)) await DB.putMany('clients', j.clients.filter(c => c && typeof c.name === 'string').map(c => ({ name: tidyClient(c.name), searching: c.searching === true ? true : c.searching === false ? false : null, priority: !!c.priority, licensed: Array.isArray(c.licensed) ? c.licensed.map(str) : [], photos: 0 })));
    if (Array.isArray(j.picked)) await meta.set('picked', j.picked.filter(r => typeof r === 'string' && r && !r.split('/').includes('..')).map(r => r.slice(0, 1000)));
    if (Array.isArray(j.flags)) await meta.set('pendingFlags', j.flags.filter(f => Array.isArray(f) && typeof f[0] === 'string').map(f => [f[0].slice(0, 2000), ['hi', 'pop'].includes(f[1]) ? f[1] : '', f[2] ? 1 : 0]));
    if (j.regs && typeof j.regs === 'object') { const regs = (await meta.get('regs')) || {}; for (const [k, v] of Object.entries(j.regs)) if (v && typeof v === 'object') regs[str(k)] = { va: str(v.va), app: str(v.app), from: 'Typed in by you for this folder', manual: true }; await meta.set('regs', regs); }
    await restoreCopies();
  }
  // Flags restored from a backup are put back on the photos once the folders are read again.
  async function applyPendingFlags() {
    const list = await meta.get('pendingFlags');
    if (!list || !list.length) return;
    const left = [];
    for (const [id, flag, nd] of list) { const p = await DB.get('photos', id); if (p) { p.flag = flag; if (nd) p.notDouble = true; await DB.put('photos', p); } else left.push([id, flag, nd]); }
    await meta.set('pendingFlags', left);
    if (left.length !== list.length) backupSoon(true);
  }

  return { DB, meta, open, touch, pics, dropDotMatches, kept, pages, keepOriginal, keepSoon, pruneKept, thumbOf, setThumb, movePics, skipped, retrySkipped, readPhoto, SKIP_LABEL, SKIP_WHY, engines, engineResults, brokenEngines, retryEngine, ENGINE_NAME, perf, timed, countNew, siteFinds, driveStateSoft, keep, setKeep, PACE, drive, setDrive, driveState, allowDrive, pickRoot, pickExtra, rootHandle, extraHandles, fileFor, tidyClient,
    regIn, regFor, setReg, scan, quickClients, clientFolders, dirAt, subfolders, folderInfo, picked, setPicked, pickInside, SCAN, applyPendingFlags, lookHash, findDoubles, doublesOf, plan, next, buildQueue, queueDirty, resetQueue, coverage,
    photoForPic, ingest, rescue, searchedNothing, copiesOf, allCopies, answer, licenseSite, approveSite, setClientOf, setFlag, setClients, checkOnline, logWeek, week, weekKey,
    isPool, hiddenCountries, setHiddenCountries, ownerFor, pathOf, logReport, USE, useOf, riskOf, countryOf, COUNTRY, baseOf, groupOf, facts, lookup, owners,
    backupSoon, backupCopiesSoon, writeSettings, writeCopies, readBackup, restore, restoreCopies, settingsSnapshot, monthsOld, newness, yearOf, quarterOf, dayOf };
})();
