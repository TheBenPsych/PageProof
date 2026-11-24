// Reverse image search: where things are kept.
//  - The browser's own database (IndexedDB) holds each search, the links seen before for
//    each picture, the "My pictures folder" notes, and the link to the Documents folder.
//  - Hidden and allowed sites are ALSO kept as plain text files in Documents\PageProof,
//    so they survive a reinstall and can be edited in Notepad. The files are the master copy.
const RS_DB = {
  open() {
    if (RS_DB._p) return RS_DB._p;
    RS_DB._p = new Promise((resolve, reject) => {
      const req = indexedDB.open('pageproof-rs', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of ['jobs', 'seen', 'folder', 'handles']) db.createObjectStore(s);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return RS_DB._p;
  },
  async run(store, mode, fn) {
    const db = await RS_DB.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = () => reject(tx.error);
    });
  },
  get: (store, key) => RS_DB.run(store, 'readonly', s => s.get(key)),
  put: (store, key, val) => RS_DB.run(store, 'readwrite', s => s.put(val, key)),
  del: (store, key) => RS_DB.run(store, 'readwrite', s => s.delete(key)),
  all: (store) => RS_DB.run(store, 'readonly', s => s.getAll()),
  keys: (store) => RS_DB.run(store, 'readonly', s => s.getAllKeys()),
};

// ---------- site names ----------
const RS_SITE = {
  // "https://m.facebook.com/x" -> "facebook.com"
  of(url) {
    try { return new URL(url).hostname.toLowerCase().replace(/^(www\d?|m|mobile)\./, ''); } catch (e) { return ''; }
  },
  // Turn whatever someone typed ("https://www.Pinterest.com/pin/1") into "pinterest.com".
  // A whole ending works too: ".gov", "*.gov" or "gov.uk" style endings typed with a dot first.
  tidy(text) {
    let t = String(text || '').trim().toLowerCase();
    if (!t || t.startsWith('#')) return '';
    const end = /^\*?\.([a-z0-9-]+(\.[a-z0-9-]+)*)$/.exec(t);
    if (end) return '.' + end[1];
    if (!/^[a-z]+:\/\//.test(t)) t = 'http://' + t;
    const h = RS_SITE.of(t);
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(h)) return '';
    // "x.com/examplesports" or "site.com/forum": only that part of the site.
    let path = '';
    try { path = decodeURIComponent(new URL(t).pathname).replace(/\/+$/, ''); } catch (e) { /* none */ }
    return path && path !== '/' ? h + path : h;
  },
  // Does a link fall under a "site.com/part" entry?
  underPath(url, entry) {
    const i = entry.indexOf('/');
    if (i < 0) return false;
    const host = entry.slice(0, i), path = entry.slice(i);
    let u; try { u = new URL(url); } catch (e) { return false; }
    const site = RS_SITE.of(url);
    if (!(site === host || site.endsWith('.' + host))) return false;
    let p = u.pathname; try { p = decodeURIComponent(p); } catch (e) { /* keep */ }
    p = p.toLowerCase();
    return p === path || p.startsWith(path + '/');
  },
  // The part worth offering to hide: the account on social sites, or a forum section.
  part(url) {
    try {
      const u = new URL(url), seg = u.pathname.split('/').filter(Boolean)[0];
      if (!seg || /^(status|statuses|p|pin|pins|reel|reels|watch|shorts|video|videos|photo|photos|post|posts|news|article|articles|story|stories|search|explore|i|hashtag|tag|tags|en|us|uk|www|amp|images|img|media|wp-content|uploads|\d+)$/i.test(seg) || seg.length > 40 || /\.[a-z]{2,4}$/i.test(seg)) return '';
      return RS_SITE.of(url) + '/' + seg.toLowerCase();
    } catch (e) { return ''; }
  },
  // Does this link's site fall under a listed site? (facebook.com covers m.facebook.com too)
  inList(site, list) { return list.some(d => !d.includes('/') && (d.startsWith('.') ? site.endsWith(d) : site === d || site.endsWith('.' + d))); },
  // The list entry that covers this link (whole site, ending, or site.com/part), if any.
  // Lists can hold thousands of entries, so they are indexed once: whole sites by name, endings
  // (.gov) in a short list, and site parts (x.com/name) grouped by site.
  entryFor(site, url, list) {
    let ix = RS_SITE._ix.get(list);
    if (!ix || ix.n !== list.length) {
      ix = { n: list.length, sites: new Set(), ends: [], parts: new Map() };
      for (const d of list) {
        if (d.includes('/')) { const host = d.slice(0, d.indexOf('/')); if (!ix.parts.has(host)) ix.parts.set(host, []); ix.parts.get(host).push(d); }
        else if (d.startsWith('.')) ix.ends.push(d);
        else ix.sites.add(d);
      }
      RS_SITE._ix.set(list, ix);
    }
    // the site itself, then each shorter ending of it (m.facebook.com -> facebook.com -> com)
    const labels = site.split('.');
    for (let i = 0; i < labels.length - 1; i++) { const d = labels.slice(i).join('.'); if (ix.sites.has(d)) return d; }
    const end = ix.ends.find(e => site.endsWith(e));
    if (end) return end;
    if (url) for (let i = 0; i < labels.length - 1; i++) {
      const ps = ix.parts.get(labels.slice(i).join('.'));
      const hit = ps && ps.find(d => RS_SITE.underPath(url, d));
      if (hit) return hit;
    }
    return undefined;
  },
  _ix: new WeakMap(),
};

// A folder or drive that never answers must not freeze PageProof: give up after ms and use the fallback.
const RS_LATE = (p, ms, fallback) => Promise.race([Promise.resolve(p), new Promise(r => setTimeout(() => r(fallback), ms))]);

// ---------- the Documents\PageProof folder ----------
const RS_DOCS = {
  supported: typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function',
  _slowUntil: 0, // the folder stopped answering: leave it alone until then
  async handle() { try { return await RS_DB.get('handles', 'docs'); } catch (e) { return null; } },
  // 'granted', 'prompt' (needs one click on Allow), or 'none' (never linked, or reinstalled)
  async state() {
    const h = await RS_DOCS.handle();
    if (!h) return 'none';
    if (Date.now() < RS_DOCS._slowUntil) return 'none';
    try {
      const p = await RS_LATE(h.queryPermission({ mode: 'readwrite' }), 4000, 'slow');
      if (p === 'slow') { RS_DOCS._slowUntil = Date.now() + 120000; return 'none'; }
      return p;
    } catch (e) { return 'none'; }
  },
  // Must be called from a click.
  async allow() {
    const h = await RS_DOCS.handle();
    if (!h) return false;
    return (await h.requestPermission({ mode: 'readwrite' })) === 'granted';
  },
  // Must be called from a click. The picker opens in Documents; whatever folder is picked,
  // PageProof uses (or makes) a "PageProof" folder inside it, unless it already is one.
  async choose() {
    const picked = await window.showDirectoryPicker({ id: 'pageproof-docs', mode: 'readwrite', startIn: 'documents' });
    // Never inside (or around) the photos folders: PageProof only ever READS those.
    if (await RS_DOCS.touchesPhotos(picked)) { const e = new Error('That folder is part of your photos folder. PageProof never writes there. Pick a folder in Documents instead.'); e.name = 'PhotosFolder'; throw e; }
    // Never inside PageProof's own program files (Documents\PageProof\Install). Windows Defender
    // flagged PageProof once when it wrote into its own folder, so the data stays next to it, not in it.
    if (await RS_DOCS.isInstall(picked)) { const e = new Error('That is the folder PageProof is installed in. PageProof never writes there. Pick the PageProof folder one level up (Documents › PageProof) instead.'); e.name = 'InstallFolder'; throw e; }
    const dir = /^pageproof$/i.test(picked.name) ? picked : await picked.getDirectoryHandle('PageProof', { create: true });
    try { await dir.getDirectoryHandle('My pictures', { create: true }); } catch (e) { /* made later instead */ }
    await RS_DB.put('handles', 'docs', dir);
    return dir;
  },
  // True for PageProof's own program folder: it is named Install, or it holds a manifest.json.
  async isInstall(d) {
    if (!d) return false;
    if (/^install$/i.test(d.name)) return true;
    try { return !!(await RS_LATE(d.getFileHandle('manifest.json'), 3000, null)); } catch (e) { return false; }
  },
  async dir() {
    if ((await RS_DOCS.state()) !== 'granted') return null;
    // The "not inside the photos" check runs only when a folder is picked (here and in Find copies
    // setup). Running it again and again (4.3.2) asked Google Drive questions it could get stuck on.
    return RS_DOCS.handle();
  },
  // True when a folder is one of the picked photos folders, sits inside one, or contains one.
  async photoHandles() {
    const out = [];
    try {
      const keys = await RS_DB.keys('handles');
      for (const k of keys) if (k === 'fcRoot' || String(k).startsWith('fcExtra:')) { const h = await RS_DB.get('handles', k); if (h) out.push(h); }
    } catch (e) { /* none */ }
    return out;
  },
  // Each folder question gets 2 seconds and the whole check 4 seconds: a slow drive (Google Drive)
  // can leave the browser's answer hanging, and that froze PageProof's main page in 4.3.2. If the
  // browser cannot tell in time, the folder counts as safe (it was already checked when it was picked).
  async touchesPhotos(d) {
    if (!d) return false;
    const late = (p, ms, v) => Promise.race([p, new Promise(r => setTimeout(() => r(v), ms))]);
    return late(RS_DOCS._touches(d, late), 4000, false);
  },
  async _touches(d, late) {
    for (const p of await late(RS_DOCS.photoHandles(), 2000, [])) {
      try {
        if (await late(p.isSameEntry(d), 2000, false)) return true;
        if ((await late(p.resolve(d), 2000, null)) !== null) return true;   // picked folder is inside the photos
        if ((await late(d.resolve(p), 2000, null)) !== null) return true;   // picked folder holds the photos
      } catch (e) { /* can't tell for this one */ }
    }
    return false;
  },
  async readText(name) {
    const d = await RS_DOCS.dir();
    if (!d) return null;
    // null = the file is not there; undefined = the folder did not answer in time (leave the file alone).
    if (Date.now() < RS_DOCS._slowUntil) return undefined;
    try {
      const t = await RS_LATE((async () => (await (await d.getFileHandle(name)).getFile()).text())(), 8000, undefined);
      if (t === undefined) RS_DOCS._slowUntil = Date.now() + 120000;   // skip the folder for 2 minutes
      return t;
    } catch (e) { return null; }
  },
  async writeText(name, text) {
    const d = await RS_DOCS.dir();
    if (!d || Date.now() < RS_DOCS._slowUntil) return false;
    return RS_LATE((async () => {
      const w = await (await d.getFileHandle(name, { create: true })).createWritable();
      await w.write(text); await w.close();
      return true;
    })(), 15000, false);
  },
};

// ---------- hidden and allowed sites ----------
const RS_LISTS = {
  hidden: [], allowed: [], fileState: 'none',
  FILES: { hidden: 'hidden-sites.txt', allowed: 'allowed-sites.txt' },
  HEAD: {
    hidden: '# PageProof hidden sites, one per line.\n# Links from these sites never show in reverse search results.\n# Start a line with a dot to hide a whole ending, for example .gov or .edu\n# Add a part after the site to hide only that part, for example x.com/examplesports or example.com/forum\n# Lines starting with # are notes and are ignored.\n',
    allowed: '# PageProof allowed sites, one per line (your own site, licensees...).\n# Links from these sites still show, with a green "Allowed" label.\n# Lines starting with # are notes and are ignored.\n',
  },
  parse(text) { return [...new Set(String(text || '').split(/\r?\n/).map(RS_SITE.tidy).filter(Boolean))]; },
  text(kind) { return RS_LISTS.HEAD[kind] + RS_LISTS[kind].join('\n') + '\n'; },
  // Read the lists: from the text files when they can be reached, otherwise the browser's copy.
  async load() {
    const api = globalThis.browser || globalThis.chrome;
    const st = await api.storage.local.get(['rsHidden', 'rsAllowed']);
    RS_LISTS.hidden = st.rsHidden || [];
    RS_LISTS.allowed = st.rsAllowed || [];
    RS_LISTS.fileState = await RS_DOCS.state();
    if (RS_LISTS.fileState === 'granted') {
      let wrote = false;
      for (const kind of ['hidden', 'allowed']) {
        const t = await RS_DOCS.readText(RS_LISTS.FILES[kind]);
        if (t === undefined) continue;                              // folder too slow: keep the browser's copy
        if (t !== null) RS_LISTS[kind] = RS_LISTS.parse(t);       // the file wins
        else { await RS_DOCS.writeText(RS_LISTS.FILES[kind], RS_LISTS.text(kind)); wrote = true; }
      }
      await api.storage.local.set({ rsHidden: RS_LISTS.hidden, rsAllowed: RS_LISTS.allowed });
      RS_LISTS.wrote = wrote;
    }
    // 4.9.4: social sites hidden whole before are shown again (only accounts can be hidden now).
    const whole = RS_LISTS.hidden.filter(d => RS_LISTS.wholeSocial(d));
    if (whole.length) {
      RS_LISTS.hidden = RS_LISTS.hidden.filter(d => !whole.includes(d));
      const old = (await api.storage.local.get('ppSocialUnhid')).ppSocialUnhid || [];
      await api.storage.local.set({ ppSocialUnhid: [...new Set(old.concat(whole))] });
      await RS_LISTS.save();
    }
    await RS_REJECT.load();
    return RS_LISTS;
  },
  async save() {
    const api = globalThis.browser || globalThis.chrome;
    await api.storage.local.set({ rsHidden: RS_LISTS.hidden, rsAllowed: RS_LISTS.allowed, rsListsSaved: Date.now() });
    if ((await RS_DOCS.state()) === 'granted') {
      for (const kind of ['hidden', 'allowed']) await RS_DOCS.writeText(RS_LISTS.FILES[kind], RS_LISTS.text(kind));
      RS_LISTS.fileState = 'granted';
    }
  },
  // 4.9.4: a whole social site (x.com, instagram.com...) can never be hidden, only its accounts.
  wholeSocial(entry) {
    const e = String(entry || '');
    const S = globalThis.PP_SOCIAL;
    if (!S || !e || e.includes('/') || e.startsWith('.')) return false;
    if (S.mineFor(e) === 'web') return false;
    const L = S.listed(e);
    if (L) return e === L || !S.fromUrl('https://' + e + '/');
    return S.mineFor(e) === 'social';
  },
  async add(kind, site) {
    site = RS_SITE.tidy(site);
    if (!site) return false;
    if (kind === 'hidden' && RS_LISTS.wholeSocial(site)) return false;
    const other = kind === 'hidden' ? 'allowed' : 'hidden';
    RS_LISTS[other] = RS_LISTS[other].filter(d => d !== site);
    if (!RS_LISTS[kind].includes(site)) RS_LISTS[kind].push(site);
    await RS_LISTS.save();
    return true;
  },
  async remove(kind, site) {
    RS_LISTS[kind] = RS_LISTS[kind].filter(d => d !== site);
    await RS_LISTS.save();
  },
  isHidden: (site, url) => !!RS_SITE.entryFor(site, url, RS_LISTS.hidden),
  isAllowed: (site, url) => !!RS_SITE.entryFor(site, url, RS_LISTS.allowed),
};

// ---------- 4.22: files you added to a list, and undoing them ----------
// Each "Add from a file" (and each "Take out the sites in a file") is remembered with the exact
// sites it changed, so it can be undone later without touching sites that were there before.
const RS_IMPORTS = {
  KEY: 'rsImports', KEEP: 6,
  // One link per line. A line holding several links ("https://a.com/x, https://b.com/y") counts as several.
  parseFile(text) {
    const out = [];
    for (const line of String(text || '').split(/\r?\n/)) for (const part of line.split(/,\s*(?=[a-z]+:\/\/)/i)) out.push(part);
    return RS_LISTS.parse(out.join('\n'));
  },
  async all() {
    const api = globalThis.browser || globalThis.chrome;
    return (await api.storage.local.get(RS_IMPORTS.KEY))[RS_IMPORTS.KEY] || [];
  },
  async record(e) {
    const api = globalThis.browser || globalThis.chrome;
    const list = await RS_IMPORTS.all();
    list.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: Date.now(), undone: 0, ...e });
    await api.storage.local.set({ [RS_IMPORTS.KEY]: list.slice(0, RS_IMPORTS.KEEP) });
  },
  // Undo (or redo) one entry. Returns how many sites changed.
  async toggle(id) {
    const api = globalThis.browser || globalThis.chrome;
    const list = await RS_IMPORTS.all();
    const e = list.find(x => x.id === id);
    if (!e) return 0;
    await RS_LISTS.load();
    const takeOut = (e.op === 'add') === !e.undone;
    const n = takeOut ? RS_IMPORTS.takeOut(e.kind, e.sites) : RS_IMPORTS.putIn(e.kind, e.sites);
    await RS_LISTS.save();
    e.undone = e.undone ? 0 : Date.now();
    await api.storage.local.set({ [RS_IMPORTS.KEY]: list });
    return n;
  },
  takeOut(kind, sites) {
    const gone = new Set(sites), before = RS_LISTS[kind].length;
    RS_LISTS[kind] = RS_LISTS[kind].filter(d => !gone.has(d));
    return before - RS_LISTS[kind].length;
  },
  putIn(kind, sites) {
    const have = new Set(RS_LISTS[kind]); let n = 0;
    for (const s of sites) if (!have.has(s) && !(kind === 'hidden' && RS_LISTS.wholeSocial(s))) { have.add(s); RS_LISTS[kind].push(s); n++; }
    return n;
  },
  // For a file added before 4.22 (nothing was remembered then): which sites in the list did that file add?
  // "Add from a file" put the new sites at the END of the list, in the file's order, and skipped sites
  // already there. So the import is the last run of the list made of the file's sites in the file's order.
  // Sites from the file that sit earlier in the list were there before, and stay.
  fromFile(text, list) {
    let best = { added: [], before: [] };
    for (const parsed of [RS_LISTS.parse(text), RS_IMPORTS.parseFile(text)]) {
      const pos = new Map(parsed.map((s, i) => [s, i]));
      let i = list.length - 1, seen = false, last = Infinity;
      const added = [];
      for (; i >= 0; i--) {
        const p = pos.get(list[i]);
        if (p === undefined) { if (seen) break; continue; }   // sites added after the import are skipped
        if (p > last) break;                                  // out of file order: was there before
        last = p; seen = true; added.push(list[i]);
      }
      const before = list.slice(0, i + 1).filter(s => pos.has(s));
      if (added.length > best.added.length) best = { added: added.reverse(), before };
    }
    return best;
  },
};

// ---------- rejected links (the trash can) ----------
// One line per link you have looked at and ruled out: "link | picture name".
// Kept in rejected-links.txt next to the site lists, so it survives updates too.
const RS_REJECT = {
  items: [], FILE: 'rejected-links.txt',
  HEAD: '# PageProof rejected links, one per line: link | picture name | reason\n# Reason "not a match" = you said it is a different photo (it moves to Different photo).\n# No reason = you do not want it (it never shows again for that picture).\n# Leave the picture name empty to apply to every picture.\n# Delete a line to bring a link back. Lines starting with # are notes.\n',
  parse(text) {
    const out = [];
    for (const line of String(text || '').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const [url, pic, why] = t.split(/\s*\|\s*/);
      if (/^https?:\/\//i.test(url)) out.push({ url, pic: (pic || '').trim(), why: /not a match/i.test(why || '') ? 'nomatch' : '' });
    }
    return out;
  },
  text() { return RS_REJECT.HEAD + RS_REJECT.items.map(r => r.url + ' | ' + (r.pic || '') + (r.why === 'nomatch' ? ' | not a match' : '')).join('\n') + '\n'; },
  async load() {
    const api = globalThis.browser || globalThis.chrome;
    RS_REJECT.items = (await api.storage.local.get('rsRejected')).rsRejected || [];
    if ((await RS_DOCS.state()) === 'granted') {
      const t = await RS_DOCS.readText(RS_REJECT.FILE);
      if (t === undefined) { /* folder too slow: keep the browser's copy */ }
      else if (t !== null) RS_REJECT.items = RS_REJECT.parse(t);
      else await RS_DOCS.writeText(RS_REJECT.FILE, RS_REJECT.text());
      await api.storage.local.set({ rsRejected: RS_REJECT.items });
    }
    RS_REJECT._keys = null;
  },
  async save() {
    const api = globalThis.browser || globalThis.chrome;
    RS_REJECT._keys = null;
    await api.storage.local.set({ rsRejected: RS_REJECT.items });
    if ((await RS_DOCS.state()) === 'granted') await RS_DOCS.writeText(RS_REJECT.FILE, RS_REJECT.text());
  },
  // why: '' = trash (do not want it), 'nomatch' = not the same photo.
  // The list grows with every "Remove", and this is asked for every link each time a results
  // page is drawn, so it is looked up by link instead of read from top to bottom.
  find(url, pic, why) {
    if (!RS_REJECT._keys) {
      RS_REJECT._keys = new Map();
      for (const r of RS_REJECT.items) {
        const k = RS_UTIL.key(r.url);
        if (!RS_REJECT._keys.has(k)) RS_REJECT._keys.set(k, []);
        RS_REJECT._keys.get(k).push({ pic: r.pic, why: r.why || '' });
      }
    }
    const list = RS_REJECT._keys.get(RS_UTIL.key(url));
    return !!list && list.some(r => (!r.pic || r.pic === pic) && r.why === (why || ''));
  },
  // A line was just added to items: add it to the look-up too (instead of building it again).
  noteKey(url, pic, why) {
    if (!RS_REJECT._keys) return;
    const k = RS_UTIL.key(url);
    if (!RS_REJECT._keys.has(k)) RS_REJECT._keys.set(k, []);
    RS_REJECT._keys.get(k).push({ pic: pic || '', why: why || '' });
  },
  is(url, pic) { return RS_REJECT.find(url, pic, ''); },
  notMatch(url, pic) { return RS_REJECT.find(url, pic, 'nomatch'); },
  async add(url, pic, why) { if (!RS_REJECT.find(url, pic, why)) RS_REJECT.items.push({ url, pic: pic || '', why: why || '' }); await RS_REJECT.save(); },
  async remove(url, pic, why) {
    const k = RS_UTIL.key(url);
    RS_REJECT.items = RS_REJECT.items.filter(r => !(RS_UTIL.key(r.url) === k && (!r.pic || r.pic === pic) && (r.why || '') === (why || '')));
    await RS_REJECT.save();
  },
};

// ---------- what PageProof remembers about each picture ----------
// For each picture (by its fingerprint): every link found before, when it was first seen, and
// how well its picture matched. Kept in the browser AND as one small file per picture in
// Documents\PageProof\Memory, so updates or even a reinstall never lose it.
const RS_MEM = {
  async dir() {
    const d = await RS_DOCS.dir();
    if (!d) return null;
    try { return await d.getDirectoryHandle('Memory', { create: true }); } catch (e) { return null; }
  },
  async get(hash) {
    let rec = null;
    try { rec = await RS_DB.get('seen', hash); } catch (e) { /* none */ }
    if (rec) return rec;
    try {                                                   // not in the browser (reinstalled?): read the file
      const d = await RS_MEM.dir();
      if (!d) return null;
      rec = JSON.parse(await (await (await d.getFileHandle(hash.slice(0, 32) + '.json')).getFile()).text());
      if (rec && rec.urls) { await RS_DB.put('seen', hash, rec); return rec; }
    } catch (e) { /* no file */ }
    return null;
  },
  async put(hash, rec) {
    await RS_DB.put('seen', hash, rec);
    try {
      const d = await RS_MEM.dir();
      if (!d) return;
      const w = await (await d.getFileHandle(hash.slice(0, 32) + '.json', { create: true })).createWritable();
      await w.write(JSON.stringify(rec)); await w.close();
    } catch (e) { /* file copy is a backup only */ }
  },
};

// ---------- small helpers ----------
const RS_UTIL = {
  async sha256(blob) {
    const d = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
  },
  // Links are the same page even if the tracking bits on the end differ.
  key(url) {
    const hit = RS_UTIL._keyMemo.get(url);
    if (hit !== undefined) return hit;
    const k = RS_UTIL._key(url);
    if (RS_UTIL._keyMemo.size > 20000) RS_UTIL._keyMemo.clear();
    RS_UTIL._keyMemo.set(url, k);
    return k;
  },
  _keyMemo: new Map(),
  _key(url) {
    try {
      const u = new URL(url);
      for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|igsh|ref$|ref_src|si$)/i.test(k)) u.searchParams.delete(k);
      u.hash = '';
      return (u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '') + (u.search || '')).toLowerCase();
    } catch (e) { return url; }
  },
  today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
  niceDate(iso) {
    if (!iso) return '';
    const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  },
  IMAGE_EXT: /\.(jpe?g|png|webp|gif|bmp|avif|tiff?|heic|heif)$/i,
};
