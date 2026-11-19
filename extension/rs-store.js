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
    // "x.com/nypostsports" or "site.com/forum": only that part of the site.
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
  entryFor(site, url, list) { return list.find(d => d.includes('/') ? !!url && RS_SITE.underPath(url, d) : RS_SITE.inList(site, [d])); },
};

// ---------- the Documents\PageProof folder ----------
const RS_DOCS = {
  supported: typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function',
  async handle() { try { return await RS_DB.get('handles', 'docs'); } catch (e) { return null; } },
  // 'granted', 'prompt' (needs one click on Allow), or 'none' (never linked, or reinstalled)
  async state() {
    const h = await RS_DOCS.handle();
    if (!h) return 'none';
    try { return await h.queryPermission({ mode: 'readwrite' }); } catch (e) { return 'none'; }
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
    const dir = /^pageproof$/i.test(picked.name) ? picked : await picked.getDirectoryHandle('PageProof', { create: true });
    try { await dir.getDirectoryHandle('My pictures', { create: true }); } catch (e) { /* made later instead */ }
    await RS_DB.put('handles', 'docs', dir);
    return dir;
  },
  async dir() {
    if ((await RS_DOCS.state()) !== 'granted') return null;
    return RS_DOCS.handle();
  },
  async readText(name) {
    const d = await RS_DOCS.dir();
    if (!d) return null;
    try { return await (await (await d.getFileHandle(name)).getFile()).text(); } catch (e) { return null; }
  },
  async writeText(name, text) {
    const d = await RS_DOCS.dir();
    if (!d) return false;
    const w = await (await d.getFileHandle(name, { create: true })).createWritable();
    await w.write(text); await w.close();
    return true;
  },
};

// ---------- hidden and allowed sites ----------
const RS_LISTS = {
  hidden: [], allowed: [], fileState: 'none',
  FILES: { hidden: 'hidden-sites.txt', allowed: 'allowed-sites.txt' },
  HEAD: {
    hidden: '# PageProof hidden sites, one per line.\n# Links from these sites never show in reverse search results.\n# Start a line with a dot to hide a whole ending, for example .gov or .edu\n# Add a part after the site to hide only that part, for example x.com/nypostsports or example.com/forum\n# Lines starting with # are notes and are ignored.\n',
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
        if (t !== null) RS_LISTS[kind] = RS_LISTS.parse(t);       // the file wins
        else { await RS_DOCS.writeText(RS_LISTS.FILES[kind], RS_LISTS.text(kind)); wrote = true; }
      }
      await api.storage.local.set({ rsHidden: RS_LISTS.hidden, rsAllowed: RS_LISTS.allowed });
      RS_LISTS.wrote = wrote;
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
  async add(kind, site) {
    site = RS_SITE.tidy(site);
    if (!site) return false;
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

// ---------- rejected links (the trash can) ----------
// One line per link you have looked at and ruled out: "link | picture name".
// Kept in rejected-links.txt next to the site lists, so it survives updates too.
const RS_REJECT = {
  items: [], FILE: 'rejected-links.txt',
  HEAD: '# PageProof rejected links, one per line: link | picture name\n# These links never show again for that picture (leave the picture name off to reject the link for every picture).\n# Delete a line to bring a link back. Lines starting with # are notes.\n',
  parse(text) {
    const out = [];
    for (const line of String(text || '').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const [url, pic] = t.split(/\s+\|\s+/);
      if (/^https?:\/\//i.test(url)) out.push({ url, pic: (pic || '').trim() });
    }
    return out;
  },
  text() { return RS_REJECT.HEAD + RS_REJECT.items.map(r => r.url + (r.pic ? ' | ' + r.pic : '')).join('\n') + '\n'; },
  async load() {
    const api = globalThis.browser || globalThis.chrome;
    RS_REJECT.items = (await api.storage.local.get('rsRejected')).rsRejected || [];
    if ((await RS_DOCS.state()) === 'granted') {
      const t = await RS_DOCS.readText(RS_REJECT.FILE);
      if (t !== null) RS_REJECT.items = RS_REJECT.parse(t);
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
  is(url, pic) {
    if (!RS_REJECT._keys) RS_REJECT._keys = RS_REJECT.items.map(r => ({ k: RS_UTIL.key(r.url), pic: r.pic }));
    const k = RS_UTIL.key(url);
    return RS_REJECT._keys.some(r => r.k === k && (!r.pic || r.pic === pic));
  },
  async add(url, pic) { if (!RS_REJECT.is(url, pic)) RS_REJECT.items.push({ url, pic: pic || '' }); await RS_REJECT.save(); },
  async remove(url, pic) {
    const k = RS_UTIL.key(url);
    RS_REJECT.items = RS_REJECT.items.filter(r => !(RS_UTIL.key(r.url) === k && (!r.pic || r.pic === pic)));
    await RS_REJECT.save();
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
