// Reverse image search: search many pictures on Google Lens, Yandex and Bing at once.
// One page, three views:
//   revsearch.html                -> pick photos and press Search (shown inside the full PageProof page)
//   revsearch.html?job=ID         -> the results window (also runs the searches)
//   revsearch.html?view=past      -> all searches (shown inside the full PageProof page)
// Today's 50 and Keep searching (photos from the shared Google Drive) live on the full PageProof
// page (app.html#keep); hidden and approved sites on app.html#hidden.
// The searches run in normal tabs of your own browser. rsearch.js (on the Google, Yandex
// and Bing pages) hands each picture over and reads the links back.
const api = globalThis.browser || globalThis.chrome;
const $ = id => document.getElementById(id);
// Timers come from a small worker (timer-worker.js): a hidden page's own timers are slowed to
// about once a minute, which made a big search stall when its page was not on screen.
const CLOCK = (() => {
  let w = null, n = 0;
  const cbs = new Map();
  try {
    w = new Worker('timer-worker.js');
    w.onmessage = e => { const c = cbs.get(e.data.id); if (c) { if (c.once) cbs.delete(e.data.id); c.fn(); } };
  } catch (e) { w = null; }
  return {
    after(ms, fn) { if (!w) return setTimeout(fn, ms); const id = ++n; cbs.set(id, { fn, once: true }); w.postMessage({ type: 'after', id, ms }); return id; },
    every(ms, fn) { if (!w) return setInterval(fn, ms); const id = ++n; cbs.set(id, { fn }); w.postMessage({ type: 'every', id, ms }); return id; },
  };
})();
const sleep = ms => new Promise(r => CLOCK.after(ms, r));
// Lets other work run for a moment without a timer: browsers slow timers right down while the
// window is minimized, which used to stall the photo checks for hours.
const breathe = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => { c.port1.close(); r(); }; c.port2.postMessage(0); });
const rand = ([a, b]) => a + Math.random() * (b - a);
const PARAMS = new URLSearchParams(location.search);
const VIEW = PARAMS.get('job') ? 'results' : (PARAMS.get('view') || 'setup');
// Big searches you start yourself (4.11, Ben) run inside the pinned Keep searching tab, in a hidden
// frame (revsearch.html?job=ID&bg=1), so no PageProof tab has to stay open and nothing pulls you
// away from your work. Any results page you open for such a search only WATCHES it: it reads the
// saved search every 2 seconds and never runs or saves it itself.
const BG = PARAMS.get('bg') === '1';
const BG_LIST = 'fcBgJobs';
async function bgQueued(id) { try { return ((await api.storage.local.get(BG_LIST))[BG_LIST] || []).includes(id); } catch (e) { return false; } }
async function bgQueue(id) {
  const q = (await api.storage.local.get(BG_LIST))[BG_LIST] || [];
  if (!q.includes(id)) q.push(id);
  await api.storage.local.set({ [BG_LIST]: q });
  api.runtime.sendMessage({ type: 'fcBgStart' }).catch(() => {});
}

const ENGINES = {
  google: { name: 'Google Lens', short: 'Google', start: 'https://www.google.com/imghp?hl=en', what: 'exact matches', letter: '' },
  yandex: { name: 'Yandex', short: 'Yandex', start: 'https://yandex.com/images/search?rpt=imageview', what: 'sites with this picture', letter: 'Y' },
  bing: { name: 'Bing', short: 'Bing', start: 'https://www.bing.com/images', what: 'pages with this picture', letter: 'b' },
};
// "per": searches at the same time on each site. "gap": pause before the next one (ms).
const SPEED = {
  careful: { label: 'Careful', per: 1, gap: [6000, 10000], hint: 'Careful: one at a time per site, longer pauses. Slowest, safest.' },
  normal: { label: 'Normal', per: 2, gap: [3000, 6000], hint: 'Normal: 2 at a time per site (the 3 sites run side by side), short random pauses. Fewest robot checks for the speed.' },
  quick: { label: 'Quick', per: 3, gap: [1000, 2500], hint: 'Quick: 3 at a time per site, very short pauses. More likely to get a robot check.' },
};
const MAX_PICS = 50;
const TASK_TIMEOUT = 75000;
const GROUP_COLORS = ['blue', 'red', 'green', 'purple', 'orange', 'cyan', 'pink', 'yellow', 'grey'];

// ---------- tiny DOM helper (text from web pages always goes in as text, never as HTML) ----------
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
const fav = e => h('span', { class: 'fav ' + e, text: ENGINES[e].letter });
const plural = (n, word, many) => n + ' ' + (n === 1 ? word : (many || word + 's'));
function side(...kids) {
  $('side').replaceChildren(h('div', { class: 'brand' }, h('img', { src: 'icons/icon48.png', alt: '', width: 22, height: 22 }), ' PageProof'), ...kids.flat().filter(Boolean));
  backLink();
}
function banner(kids, cls) {
  const b = $('banner');
  if (!kids) { b.hidden = true; b.replaceChildren(); return; }
  b.className = cls || '';
  b.replaceChildren(...[].concat(kids).filter(Boolean));
  b.hidden = false;
}
function download(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
const openTab = url => api.tabs.create({ url });
// Go to a search's results: switch to its tab if it is already open (a search keeps running
// in that tab, so we never open a second copy of it), otherwise open it.
async function goResults(id) {
  const hash = 'results?job=' + encodeURIComponent(id);
  // Inside the full PageProof page: just switch to that search there.
  try { if (window.top !== window && /\/app\.html$/.test(window.top.location.pathname)) { window.top.location.hash = hash; return; } } catch (e) { /* not inside PageProof */ }
  try {
    const o = (await api.storage.local.get('rsOpenJob')).rsOpenJob;
    if (o && o.id === id) {
      const t = await api.tabs.get(o.tab);                 // fails if that tab was closed
      await api.tabs.update(t.id, /app\.html/.test(t.url || '') ? { active: true, url: appUrl(hash) } : { active: true }); await api.windows.update(t.windowId, { focused: true });
      return;
    }
  } catch (e) { /* not open any more */ }
  openTab(appUrl(hash));
}
// On the other PageProof pages, offer a way back to the search that is open.
async function backLink() {
  if (VIEW === 'results') return;
  try {
    const o = (await api.storage.local.get('rsOpenJob')).rsOpenJob;
    if (!o || !o.tab) return;
    await api.tabs.get(o.tab);                             // still open?
    const links = document.querySelector('#side .links');
    if (!links || links.querySelector('.back')) return;
    links.prepend(h('a', { class: 'back', href: '#', text: '↩ Back to search results', onclick: e => { e.preventDefault(); goResults(o.id); } }));
  } catch (e) { /* ignore */ }
}
const page = q => api.runtime.getURL('revsearch.html' + (q ? '?' + q : ''));
// A page of the full PageProof page (app.html#route). Inside it, just switch page; in the
// results window, open it in a new tab.
const appUrl = r => api.runtime.getURL('app.html#' + r);
function goApp(r, e) {
  if (e) e.preventDefault();
  if (window.top !== window) { window.top.location.hash = r; return; }
  openTab(appUrl(r));
}
const appLink = (r, text) => h('a', { href: appUrl(r), text, onclick: e => goApp(r, e) });

async function getSettings() {
  const s = (await api.storage.local.get('rsSettings')).rsSettings || {};
  return { engines: { google: true, yandex: true, bing: true, ...(s.engines || {}) }, speed: SPEED[s.speed] ? s.speed : 'normal', closeTabs: true };   // always: every open search tab costs memory
}
const setSettings = s => api.storage.local.set({ rsSettings: s });

// ---------- the Documents\PageProof folder banner ----------
// Chrome will not let extensions use Documents itself (it calls it a "system" folder),
// but a folder inside Documents is fine, so we ask for a PageProof folder there.
const SETUP_STEPS = 'Press "Set up PageProof folder". The window opens in Documents: click "New folder", name it PageProof, then click "Select Folder". If you already have a PageProof folder, just pick it and your lists come back.';
async function docsBanner(after) {
  if (!RS_DOCS.supported) return false;
  const st = await RS_DOCS.state();
  if (st === 'granted') return false;
  if (sessionStorage.getItem('rsDocsLater') && VIEW !== 'lists' && VIEW !== 'folder') return false;
  const done = async () => { banner(null); await RS_LISTS.load(); if (after) after(); };
  if (st === 'prompt') {
    banner([h('span', {}, h('b', { text: 'One click needed: ' }), 'PageProof needs your OK to use its Documents\\PageProof folder (your hidden and approved sites, and your pictures folder).'),
      h('span', { class: 'sp' }), h('button', { text: 'Allow', onclick: async () => { if (await RS_DOCS.allow()) done(); } })]);
  } else {
    banner([h('span', {}, h('b', { text: 'Keep your site lists safe: ' }), 'PageProof saves your hidden and approved sites (and your pictures folder) in Documents\\PageProof, so updates and reinstalls never lose them. ' + SETUP_STEPS),
      h('span', { class: 'sp' }), h('button', { text: '📂 Set up PageProof folder', onclick: async () => { try { await RS_DOCS.choose(); done(); } catch (e) { if (e.name === 'PhotosFolder' || e.name === 'InstallFolder') banner([h('span', { text: e.message })], 'info'); /* else: closed the picker */ } } }),
      VIEW !== 'lists' && VIEW !== 'folder' ? h('button', { class: 'btn', text: 'Not now', onclick: () => { sessionStorage.setItem('rsDocsLater', '1'); banner(null); } }) : null], 'info');
  }
  return true;
}

// =====================================================================================
// Getting pictures ready
// =====================================================================================
const prepare = (file, extra) => RS_JOB.prepare(file, extra);

async function filesFromDrop(dt) {
  const out = [];
  const walk = async entry => {
    if (entry.isFile) { const f = await new Promise((res, rej) => entry.file(res, rej)).catch(() => null); if (f) out.push(f); return; }
    if (entry.isDirectory) {
      const reader = entry.createReader();
      for (;;) {
        const batch = await new Promise(res => reader.readEntries(res, () => res([])));
        if (!batch.length) break;
        for (const e of batch) await walk(e);
      }
    }
  };
  const entries = [...(dt.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
  if (entries.length) { for (const e of entries) await walk(e); } else out.push(...dt.files);
  return out.filter(f => /^image\//.test(f.type) || RS_UTIL.IMAGE_EXT.test(f.name));
}

async function fileFromUrl(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const b = await r.blob();
  if (!/^image\//.test(b.type)) throw new Error('not a picture');
  let name = decodeURIComponent((new URL(url).pathname.split('/').pop() || 'picture').slice(0, 80));
  if (!RS_UTIL.IMAGE_EXT.test(name)) name += '.' + (b.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  return new File([b], name, { type: b.type });
}

// Start a search with these photos: save it, then open the results window.
async function startJob(pics, opts) {
  const job = await RS_JOB.create(pics, opts);
  if (!job) { banner([h('b', { text: 'Tick at least one site to search on.' })], 'bad'); return null; }
  await RS_JOB.open(job);
  return job;
}

// =====================================================================================
// View 1: pick pictures
// =====================================================================================
const draft = [];
let draftNotes = [];

async function addToDraft(files) {
  const room = MAX_PICS - draft.length;
  const list = [...files].filter(f => /^image\//.test(f.type) || RS_UTIL.IMAGE_EXT.test(f.name));
  if (!list.length) return;
  draftNotes = [];
  if (list.length > room) draftNotes.push('Only ' + MAX_PICS + ' pictures fit in one search. ' + (list.length - room) + ' were left out.');
  renderSetup(true);
  for (const f of list.slice(0, room)) {
    const p = await prepare(f);
    if (p.error) draftNotes.push(p.error);
    else if (draft.some(d => d.hash === p.hash)) draftNotes.push(p.name + ' is already in the list.');
    else draft.push(p);
    renderSetup(true);
  }
  renderSetup();
}

// UI overhaul (batch 3): New search, All searches and Search results use the main PageProof look
// (page heading, cards, tiles) with no inner side panel of their own.
function plain(on, wide) { document.body.classList.toggle('plain', on); document.body.classList.toggle('with-side', !on); document.body.classList.toggle('wide', !!(on && wide)); }
// ---- calm look (batch 6): icons and small builders for New search and Search results.
// The icons are fixed drawings from this file; text from web pages still only goes in as text.
const NIC = {
  cal: '<rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 6.5h12M5 1.8v2.4M11 1.8v2.4M5 9h1.5M7.3 9h1.5M9.6 9h1.5M5 11.3h1.5M7.3 11.3h1.5"/>',
  loop: '<path d="M13 6.5A5 5 0 0 0 3.6 5M3 9.5A5 5 0 0 0 12.4 11"/><path d="M3.3 2.4 3.6 5l2.6-.4M12.7 13.6l-.3-2.6-2.6.4"/>',
  trash: '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5"/>',
  star: '<path d="m8 1.8 1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z"/>',
  up: '<path d="M4 10l4-4 4 4"/>',
  add: '<path d="M8 3v10M3 8h10"/>',
  photo: '<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><circle cx="5.5" cy="6.3" r="1.3"/><path d="m2 12 3.8-3.6 2.7 2.4 2.2-1.8L14 12"/>',
  folder: '<path d="M1.5 4.5a1 1 0 0 1 1-1h3.3l1.4 1.5h6.3a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z"/>',
  link: '<path d="M6.5 9.5 9.5 6.5M7 4.5l1.2-1.2a2.6 2.6 0 0 1 3.7 3.7L10.7 8.2M9 11.5l-1.2 1.2a2.6 2.6 0 0 1-3.7-3.7L5.3 7.8"/>',
  clear: '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5"/>',
  search: '<circle cx="7" cy="7" r="4.5"/><path d="M10.4 10.4 14 14"/>',
  x: '<path d="M4 4l8 8M12 4l-8 8"/>',
  tabs: '<rect x="1.5" y="4.5" width="13" height="9" rx="1.5"/><path d="M1.5 7.5h13M4 2.5h8"/>',
  check: '<path d="M3 8.5 6.5 12 13 4.5"/>',
  copies: '<rect x="2" y="4.5" width="8" height="9" rx="1"/><path d="M5 4.5V3a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-3"/>',
  stop: '<rect x="4" y="4" width="8" height="8" rx="1"/>',
  again: '<path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v2.6h2.6"/>',
  pdf: '<path d="M4 1.5h5.5L12.5 4.5v10h-8.5z"/><path d="M9.5 1.5v3h3M6 9h4.5M6 11.5h4.5"/>',
  sheet: '<rect x="2" y="2.5" width="12" height="11" rx="1"/><path d="M2 6h12M2 9.5h12M6 2.5v11"/>',
  review: '<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>',
  chev: '<path d="m6 3.5 4.5 4.5L6 12.5"/>',
  dn: '<path d="M4 6l4 4 4-4"/>',
  clock: '<circle cx="8" cy="8" r="6.2"/><path d="M8 4.6V8l2.4 1.6"/>',
  open: '<path d="M9 2.5h4.5V7M13.5 2.5 7.5 8.5M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3"/>',
  compare: '<rect x="1.5" y="3" width="6" height="10" rx="1"/><rect x="8.5" y="3" width="6" height="10" rx="1"/>',
  info: '<circle cx="8" cy="8" r="6.2"/><path d="M8 7.2v4M8 4.8v.1"/>',
  pin: '<path d="M6 2.5h4l-.6 4 2.1 2H4.5l2.1-2zM8 8.5v5"/>',
  play: '<path d="M5 3.2v9.6L12.6 8z"/>',
};
function ni(name, z = 16) {
  const t = document.createElement('template');
  t.innerHTML = `<svg viewBox="0 0 16 16" width="${+z}" height="${+z}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${NIC[name] || ''}</svg>`;
  return t.content.firstChild;
}
const nbtn = (icon, text, cls, props) => h('button', { class: 'nbtn ' + (cls || ''), ...(props || {}) }, icon ? ni(icon) : null, text);
const nsq = (color, icon, z = 36) => h('span', { class: 'ksq', style: `--c:${color};width:${z}px;height:${z}px` }, ni(icon));
const NENG = { google: ['G', 'g'], yandex: ['Y', 'y'], bing: ['B', 'b'] };
const nbadge = (e, big) => h('span', { class: 'keng ' + NENG[e][1] + (big ? ' big' : ''), 'aria-hidden': 'true', text: NENG[e][0] });
const kn1 = (title, sub) => h('span', { class: 'kn1' }, h('b', {}, title), sub != null ? h('span', {}, sub) : null);
const nhead = (crumb, title, ...right) => h('div', { class: 'nhead' }, h('h1', {}, h('span', { class: 'bc', text: crumb + ' ›' }), ' ' + title), h('span', { class: 'sp' }), ...right);
const nthumb = (src, cls) => src ? h('img', { class: cls || '', src, alt: '' }) : h('span', { class: 'nnoimg ' + (cls || '') }, ni('photo', 22));
const SETUP = { link: false };

let setupN = 0;     // only the newest drawing goes on screen
async function renderSetup(busy) {
  plain(true);
  const me = ++setupN;
  const s = await getSettings();
  let recentJobs = [];
  try { recentJobs = (await RS_DB.all('jobs')).filter(j => !(j.kind === 'keep' && j.pics.length === 1)).sort((a, b) => b.created.localeCompare(a.created)).slice(0, 3); } catch (e) { /* none yet */ }
  if (me !== setupN) return;
  const save = () => setSettings(s).then(() => renderSetup());
  const n = draft.length, nEng = Object.values(s.engines).filter(Boolean).length;
  const secs = Math.round(n * (SPEED[s.speed].gap[0] + SPEED[s.speed].gap[1]) / 2000 / SPEED[s.speed].per + 15);
  const notes = draftNotes.length ? h('div', { class: 'kbar info nnotes', role: 'status' }, h('span', { class: 'nbi' }, ni('info', 20)), h('div', {}, draftNotes.map(t => h('span', { text: t }))),
    h('button', { class: 'kx', title: 'Close', 'aria-label': 'Close', onclick: () => { draftNotes = []; renderSetup(); } }, ni('x', 12))) : null;
  const pick = () => $('filePick').click();
  const addLink = async input => {
    const u = input.value.trim();
    if (!/^https?:\/\//i.test(u)) { input.focus(); return; }
    SETUP.link = false;
    try { await addToDraft([await fileFromUrl(u)]); } catch (err) { draftNotes = ['Could not get a picture from ' + u.slice(0, 80) + ' (' + err.message + ')']; renderSetup(); }
  };
  const cmd = big => [
    nbtn('add', 'Add photos', (n ? '' : 'acc') + (big ? ' big' : ''), { disabled: n >= MAX_PICS, id: 'addPhotos', onclick: pick }),
    nbtn('folder', 'From my clients\' photos', big ? 'big' : '', { onclick: e => goApp('clients', e) }),
    nbtn('link', 'Paste a link', big ? 'big' : '', { id: 'pasteLink', disabled: n >= MAX_PICS, onclick: () => { SETUP.link = !SETUP.link; renderSetup().then(() => { const i = $('linkIn'); if (i) i.focus(); }); } })];
  const linkRow = SETUP.link ? h('form', { class: 'nlinkrow', onsubmit: e => { e.preventDefault(); addLink($('linkIn')); } },
    h('input', { type: 'url', id: 'linkIn', placeholder: 'https://… the address of a picture', 'aria-label': 'Address of a picture' }),
    nbtn('add', 'Add', 'acc', { type: 'submit' }), nbtn('', 'Cancel', 'ghost', { type: 'button', onclick: () => { SETUP.link = false; renderSetup(); } })) : null;
  const photos = n || busy
    ? h('section', { class: 'card npcard', 'aria-label': 'Photos' },
      h('div', { class: 'nph' }, h('h2', {}, busy ? 'Getting your pictures ready…' : 'Photos', ' ', h('span', { class: 'kfaint', text: n + ' of ' + MAX_PICS })), h('span', { class: 'sp' }),
        h('div', { class: 'ncmd' }, cmd(false), h('span', { class: 'cmdsep' }), nbtn('clear', 'Clear all', 'ghost', { id: 'clearAll', disabled: !n, onclick: () => { draft.length = 0; draftNotes = []; renderSetup(); } }))),
      linkRow,
      h('div', { class: 'ngrid', id: 'draftGrid' }, draft.map((p, i) => h('figure', { class: 'nt', title: p.name + ' · ' + p.w + ' × ' + p.h },
        h('div', { class: 'ni' }, h('img', { src: p.thumb, alt: '' }), h('span', { class: 'nbn', text: i + 1 }),
          h('button', { class: 'nx', title: 'Take this photo out', 'aria-label': 'Take ' + p.name + ' out', onclick: () => { draft.splice(i, 1); renderSetup(); } }, ni('x', 12))),
        h('figcaption', {}, h('b', { text: p.name }), h('span', { text: p.w.toLocaleString() + ' × ' + p.h.toLocaleString() })))),
        n < MAX_PICS ? h('button', { class: 'nt nadd', onclick: pick }, h('span', {}, ni('add', 28)), 'Add more') : null),
      h('div', { class: 'ndropline' }, ni('photo'), h('span', { text: 'Drop more photos or a whole folder anywhere on this page, or paste them with Ctrl+V.' })))
    : h('section', { class: 'card npcard isempty', 'aria-label': 'Photos' },
      h('div', { class: 'nph' }, h('h2', {}, 'Photos ', h('span', { class: 'kfaint', text: '0 of ' + MAX_PICS }))),
      h('div', { class: 'ndrop' }, h('span', { class: 'nbigic' }, ni('photo', 56)),
        h('h3', { text: 'Drop photos or a folder here' }), h('p', { class: 'kmuted', text: 'Up to ' + MAX_PICS + ' photos at once. JPG, PNG, HEIC, TIFF and AVIF.' }),
        h('div', { class: 'nbtns' }, cmd(true)), linkRow,
        h('p', { class: 'kfaint', text: 'You can also paste pictures or links with Ctrl+V.' })));
  const ENG_WHAT = { google: 'Full search of every photo. Finds exact matches.', yandex: 'Finds sites with this picture. Good at faces and crops.', bing: 'Finds pages with this picture. Good at news and shop sites.' };
  const sites = h('section', { class: 'card nset', id: 'searchOn', 'aria-label': 'Search on' }, h('h2', { class: 'kh2' }, 'Search on ', h('span', { class: 'kfaint', text: nEng + ' of 3' })),
    Object.entries(ENGINES).map(([k, e]) => h('label', { class: 'nsr' }, nbadge(k, true), kn1(e.name, ENG_WHAT[k]),
      h('span', { class: 'wswl', text: s.engines[k] ? 'On' : 'Off' }),
      h('span', { class: 'nsw' }, h('input', { type: 'checkbox', checked: s.engines[k], 'aria-label': e.name, onchange: ev => { s.engines[k] = ev.target.checked; save(); } }), h('i')))));
  const SP = { careful: 'One photo at a time on each site, longer pauses. Slowest, safest.', normal: '2 at a time on each site, short pauses. Fewest robot checks for the speed.', quick: '3 at a time on each site. More likely to get a robot check.' };
  const speed = h('section', { class: 'card nset', id: 'speedCard', role: 'radiogroup', 'aria-label': 'Speed' }, h('h2', { class: 'kh2', text: 'Speed' }),
    Object.entries(SPEED).map(([k, v]) => h('label', { class: 'nrad' + (s.speed === k ? ' on' : '') },
      h('input', { type: 'radio', name: 'speed', value: k, checked: s.speed === k, onchange: () => { s.speed = k; save(); } }), h('span', { class: 'wrad' }, h('i')),
      h('span', { class: 'kn1' }, h('b', {}, v.label, k === 'normal' ? h('span', { class: 'ktag', text: 'Best for most' }) : null), h('span', { text: SP[k] })))));
  const why = !n ? 'Add at least one photo first.' : !nEng ? 'Turn on at least one search site.' : '';
  const go = nbtn('search', 'Search ' + (n ? plural(n, 'photo') : 'photos'), 'acc huge', { id: 'goSearch', disabled: !!why, title: why, onclick: async () => {
    go.disabled = true;
    const job = await startJob(draft.slice());
    if (job) { draft.length = 0; draftNotes = ['Search started. You can add more photos for another search here.']; renderSetup(); }
    else go.disabled = false;
  } });
  const start = h('section', { class: 'card nstart' }, go,
    h('p', { class: 'kmuted nwhy' + (why ? ' pg-why' : ''), text: why || 'About ' + (secs < 90 ? secs + ' seconds' : Math.round(secs / 60) + ' minutes') + ' for ' + plural(n, 'photo') + ' on ' + plural(nEng, 'site') + '. The results show right here.' }));
  const how = h('section', { class: 'card nhow nhowstrip', 'aria-label': 'What happens when you press Search' }, h('h2', { class: 'kh2', text: 'What happens when you press Search' }),
    h('div', { class: 'nsteps' }, [['tabs', '#005FB8', 'Small search tabs open', 'Out of your way, a few at a time with short pauses. They close by themselves when done.'], ['compare', '#8764B8', 'Each picture is checked', 'Every picture found is laid over yours, detail for detail.'], ['copies', '#0F7B0F', 'Copies go to Copies found', 'Same photo or Maybe, each with its % match.']]
      .map(([ic, c, b, t]) => h('div', { class: 'nstep' }, nsq(c, ic), kn1(b, t)))),
    h('a', { class: 'nhowlink', href: 'https://github.com/TheBenPsych/PageProof/blob/main/TUTORIAL.md#16-search-many-pictures-at-once-reverse-image-search', target: '_blank', text: 'How this works' }));
  const KIND = { keep: 'Keep searching', fifty: 'Today\'s 50' };
  const recent = recentJobs.length ? h('section', { class: 'card nrecent', id: 'recentCard', 'aria-label': 'Recent searches' },
    h('h2', { class: 'kh2' }, 'Recent searches', h('a', { href: appUrl('searches'), onclick: e => goApp('searches', e), text: 'All searches ›' })),
    recentJobs.map(j => {
      let found = 0;
      for (const p of j.pics) for (const l of p.links || []) if (!RS_LISTS.isHidden(l.site, l.url) && ['same', 'maybe'].includes(verdict(l))) found++;
      const d = new Date(j.created), running = j.bg && !j.finished;
      const open = () => goResults(j.id);
      return h('div', { class: 'nrr', role: 'button', tabindex: 0, title: 'Open this search', onclick: open, onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } } },
        h('span', { class: 'nstack', 'aria-hidden': 'true' }, j.pics.filter(p => p.thumb).slice(0, 3).map(p => h('img', { src: p.thumb, alt: '' }))),
        kn1(plural(j.pics.length, 'photo') + (KIND[j.kind] ? ' · ' + KIND[j.kind] : ''), (d.toDateString() === new Date().toDateString() ? 'Today' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })) + ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })),
        h('span', { class: 'ktag' + (running || found ? ' acc' : ''), text: running ? 'Running' : found ? plural(found, 'copy', 'copies') + ' found' : 'Nothing found' }), ni('chev', 14));
    })) : null;
  $('main').replaceChildren(h('div', { class: 'nnew' }, nhead('Copies found', 'New search'), notes,
    h('div', { class: 'ngridtop' }, h('div', { class: 'kstack' }, photos, how, recent), h('div', { class: 'kstack nright' }, sites, speed, start))));
}

function setupDropAndPaste(onFiles) {
  let depth = 0;
  document.addEventListener('dragenter', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { depth++; document.body.classList.add('over'); } });
  document.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; document.body.classList.remove('over'); } });
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', async e => {
    e.preventDefault(); depth = 0; document.body.classList.remove('over');
    onFiles(await filesFromDrop(e.dataTransfer));
  });
  document.addEventListener('paste', async e => {
    if (/^(INPUT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName)) return;
    const files = [...(e.clipboardData.files || [])];
    if (files.length) { onFiles(files); return; }
    const urls = (e.clipboardData.getData('text') || '').split(/\s+/).filter(u => /^https?:\/\//i.test(u));
    const got = [];
    for (const u of urls.slice(0, MAX_PICS)) {
      try { got.push(await fileFromUrl(u)); } catch (err) { draftNotes.push('Could not get a picture from ' + u.slice(0, 80) + ' (' + err.message + ')'); }
    }
    onFiles(got);
  });
}

// =====================================================================================
// View 2: results window (runs the searches)
// =====================================================================================
let job = null;
const R = { tasks: new Map(), paused: {}, captchas: {}, gaveUp: {}, queues: {}, stop: false, running: false, winId: null, myTab: null,
  groups: {}, prev: {}, sel: 0, filter: 'same', engineFilter: new Set(), text: '', showHidden: false, ticked: new Set(), scoreQ: [], scoring: false, origBmp: {}, known: {}, parked: new Set() };

let saveTimer = null;
function saveJob(now) {
  if (R.watch) return;                              // the pinned tab saves it
  clearTimeout(saveTimer);
  const go = () => RS_DB.put('jobs', job.id, job).catch(() => {});
  if (now) return go();
  saveTimer = setTimeout(go, 4000);                 // the search holds your pictures, so saving it is not free
}
let renderTimer = null;
// Not drawn while nobody can see it (a background tab, a minimized window, or kept hidden inside
// PageProof while you look at another page): it catches up within a second of coming back.
// The search and the photo checks carry on either way.
function offScreen() {
  if (document.visibilityState === 'hidden') return true;
  try { const fe = window.frameElement; return !!fe && fe.getClientRects().length === 0; } catch (e) { return false; }
}
function renderSoon() { if (renderTimer) return; renderTimer = setTimeout(() => { renderTimer = null; if (offScreen()) renderSoon(); else renderResults(); }, 1000); }

const runList = p => job.engines.map(e => p.runs[e]);
const picDone = p => runList(p).every(r => !['wait', 'go', 'captcha'].includes(r.state));
const picBusy = p => runList(p).some(r => ['go', 'captcha'].includes(r.state));

async function picPayload(p) {
  const dataUrl = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(p.blob); });
  // A plain name: the search sites never see the photo's real file name.
  return { dataUrl, name: 'photo.jpg' };
}

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (VIEW !== 'results' || !msg || typeof msg.type !== 'string' || !msg.type.startsWith('rs') || !sender.tab) return false;
  const t = R.tasks.get(sender.tab.id);
  if (!t) return false;
  if (msg.type === 'rsHello') {
    if (t.captcha) captchaCleared(t);
    if (t.stage === 'upload') { picPayload(t.p).then(pic => sendResponse({ task: true, stage: 'upload', pic })); return true; }
    sendResponse({ task: true, stage: t.stage });
    return false;
  }
  if (msg.type === 'rsStage') { t.stage = msg.stage; if (msg.more) t.deadline = Date.now() + TASK_TIMEOUT; }
  else if (msg.type === 'rsCaptcha') onCaptcha(t);
  else if (msg.type === 'rsResults') onResults(t, msg);
  else if (msg.type === 'rsFail') finishTask(t, 'fail', msg.why || 'Something went wrong on the page');
  return false;
});

api.tabs.onRemoved.addListener(tabId => {
  const t = R.tasks.get(tabId);
  if (t) finishTask(t, 'fail', 'The tab was closed before the results were read');
});

// One group per picture. Searches for the same picture can start at the same moment, so
// they queue up here instead of each making its own group.
const groupLocks = {};
function groupTab(p, tabId) {
  groupLocks[p.i] = (groupLocks[p.i] || Promise.resolve()).then(() => groupTabNow(p, tabId));
  return groupLocks[p.i];
}
async function groupTabNow(p, tabId) {
  if (!api.tabs.group || !api.tabGroups) return;
  try {
    if (R.groups[p.i] != null) { await api.tabs.group({ groupId: R.groups[p.i], tabIds: [tabId] }); return; }
  } catch (e) { delete R.groups[p.i]; }
  try {
    const gid = await api.tabs.group({ tabIds: [tabId], createProperties: { windowId: R.winId } });
    R.groups[p.i] = gid;
    const short = p.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 18);
    await api.tabGroups.update(gid, { title: (p.i + 1) + ' · ' + short, color: GROUP_COLORS[p.i % GROUP_COLORS.length], collapsed: true });
  } catch (e) { /* tab groups not available (Firefox) */ }
}

async function runOne(p, engine) {
  const run = p.runs[engine];
  run.state = 'go'; delete run.why; renderSoon();
  if (!p.t0) p.t0 = Date.now();                     // for "Whole photo, start to done"
  if (!R.statPhoto) R.statPhoto = Date.now();
  let tab;
  try { tab = await ppOpenSearchTab(ENGINES[engine].start, R.winId); }   // searching window, or pinned (4.57)
  catch (e) { run.state = 'fail'; run.why = 'Could not open a tab'; renderSoon(); return; }
  run.tabId = tab.id;
  tagTab(tab.id);
  // Search tabs are pinned (small icons at the left of the tab bar) so they don't fill it. A
  // pinned tab can't be in a tab group, so the old coloured groups are no longer made.
  await new Promise(done => R.tasks.set(tab.id, { p, engine, tabId: tab.id, stage: 'upload', deadline: Date.now() + TASK_TIMEOUT, done, start: Date.now() }));
}

// Marks PageProof's own search tabs, so rsearch.js puts the PageProof logo on them straight away
// (even before this page answers it) and never on tabs you opened yourself.
// The mark holds the search's id, so a reloaded results page can find and close its own old tabs.
// A second mark (rsTabL:) is kept in local storage, which survives an update, so the background
// can close search tabs left over from before an update (session storage is wiped by one).
const tagTab = id => {
  try { api.storage.session && api.storage.session.set({ ['rsTab:' + id]: job.id }).catch(() => {}); } catch (e) { /* Firefox without session storage */ }
  api.storage.local.set({ ['rsTabL:' + id]: job.id }).catch(() => {});
};
const untagTab = id => {
  try { api.storage.session && api.storage.session.remove('rsTab:' + id).catch(() => {}); } catch (e) { /* ignore */ }
  api.storage.local.remove('rsTabL:' + id).catch(() => {});
};
function finishTask(t, state, why) {
  if (!R.tasks.has(t.tabId)) return;
  R.tasks.delete(t.tabId);
  const run = t.p.runs[t.engine];
  run.state = state; run.at = Date.now();          // for What's happening and Time left
  if (picDone(t.p) && !t.p.t1) t.p.t1 = Date.now();
  if (state === 'done' && t.start) timeAdd('search', Date.now() - t.start);
  statEngine(t, state, why);
  if (why) run.why = why; else delete run.why;
  if (t.captcha) { t.captcha = false; updatePause(t.engine); }
  if (picDone(t.p)) maybeIngest(t.p);
  saveJob(); renderSoon();
  // Search tabs are the big memory cost (each one is a full Google/Yandex/Bing page), so every
  // search tab closes when it is done, failed ones too (a failed tab put to sleep lost the
  // PageProof logo and showed the site's own icon among the pinned tabs). A failed one's address
  // is kept, so its "Yandex tab" button opens that page again.
  untagTab(t.tabId);
  const close = () => api.tabs.remove(t.tabId).catch(() => {});
  if (state === 'fail') api.tabs.get(t.tabId).then(tab => { if (!run.pageUrl && tab && /^https?:/.test(tab.url || '')) { run.pageUrl = tab.url; saveJob(); } }).catch(() => {}).finally(close);
  else close();
  delete run.tabId;
  t.done();
}

// Each search site, for How PageProof is doing: searches, how long, links, empty, no answer.
function statEngine(t, state, why) {
  const k = 'eng.' + t.engine + '.';
  if (state === 'done') {
    const n = t.p.runs[t.engine].count || 0;
    PP_STATS.add(k + 'n'); PP_STATS.add(k + 'links', n); if (!n) PP_STATS.add(k + 'empty');
    if (t.start) PP_STATS.time(k + 'ms', Date.now() - t.start);
  } else if (state === 'fail') {
    PP_STATS.add(k + 'n'); PP_STATS.add(k + (/No answer/.test(why || '') ? 'noAnswer' : 'fail'));
  } else if (state === 'skip' && /robot/.test(why || '')) PP_STATS.add(k + 'robotSkip');
}

function updatePause(engine) {
  R.paused[engine] = [...R.tasks.values()].some(x => x.engine === engine && x.captcha);
  if (![...R.tasks.values()].some(x => x.captcha)) banner(null);
}

async function onCaptcha(t) {
  if (t.captcha) return;
  PP_STATS.add('eng.' + t.engine + '.robot');
  // The speed ladder (Keep searching) steps down after any robot check on this site.
  try { const ra = (await api.storage.local.get('fcRobotAt')).fcRobotAt || {}; ra[t.engine] = Date.now(); await api.storage.local.set({ fcRobotAt: ra }); } catch (e) { /* only for the ladder */ }
  if (job.auto) {
    // Nobody is watching: that site rests for an hour and the others carry on.
    const rest = (await api.storage.local.get('fcRest')).fcRest || {};
    rest[t.engine] = Date.now() + 3600000;
    PP_STATS.add('eng.' + t.engine + '.restMin', 60);
    await api.storage.local.set({ fcRest: rest });
    t.captcha = true;
    giveUp(t.engine);
    return;
  }
  t.captcha = true;
  R.paused[t.engine] = true;
  R.captchas[t.engine] = (R.captchas[t.engine] || 0) + 1;
  t.p.runs[t.engine].state = 'captcha';
  renderSoon();
  const name = ENGINES[t.engine].short;
  const show = async () => {
    try {
      await ppShowTab(t.tabId);   // opens the minimized searching window too
      if (R.groups[t.p.i] != null && api.tabGroups) await api.tabGroups.update(R.groups[t.p.i], { collapsed: false });
    } catch (e) { /* tab gone */ }
  };
  banner([h('span', {}, h('b', { text: name + ' wants a quick check. ' }), 'Tick the box (or solve the puzzle) in the ' + name + ' tab and PageProof carries on by itself. ' +
      (job.engines.length > 1 ? 'The other sites keep searching meanwhile.' : '') + (R.captchas[t.engine] >= 3 ? ' ' + name + ' has asked ' + R.captchas[t.engine] + ' times now; you can skip it and try again later.' : '')),
    h('span', { class: 'sp' }), h('button', { text: 'Show me the tab', onclick: show }),
    h('button', { class: 'btn', text: 'Skip ' + name + ' for now', onclick: () => giveUp(t.engine) })]);
  if (!BG) { show(); return; }
  // In the pinned tab nobody sees this page: a small notice instead of jumping to the tab, so you
  // are not pulled away from your work. Click it (or "Show me the tab" in All searches) when ready.
  saveJob(true);
  if (api.notifications) api.notifications.create('rsCaptcha:' + t.tabId, { type: 'basic', iconUrl: api.runtime.getURL('icons/icon128.png'), title: name + ' wants a quick check', message: 'Click here, then tick the box in the ' + name + ' tab. Your search carries on by itself. The other sites keep searching meanwhile.', priority: 1 });
}

function captchaCleared(t) {
  t.captcha = false;
  t.p.runs[t.engine].state = 'go';
  t.deadline = Date.now() + TASK_TIMEOUT;
  updatePause(t.engine);
  if (R.myTab && !BG) api.tabs.update(R.myTab, { active: true }).catch(() => {});
  if (BG && api.notifications) api.notifications.clear('rsCaptcha:' + t.tabId).catch(() => {});
  saveJob(); renderSoon();
}

function giveUp(engine) {
  R.gaveUp[engine] = true;
  for (const p of R.queues[engine] || []) { p.runs[engine].state = 'skip'; p.runs[engine].why = ENGINES[engine].short + ' was skipped. Use "Search the rest" later.'; }
  if (R.queues[engine]) R.queues[engine].length = 0;
  for (const t of [...R.tasks.values()]) if (t.engine === engine && t.captcha) finishTask(t, 'skip', ENGINES[engine].short + ' was skipped after a robot check');
  updatePause(engine);
  saveJob(); renderSoon();
}

function addLink(p, l, engine) {
  if (!l || !/^https?:/i.test(l.url || '')) return;
  const key = RS_UTIL.key(l.url);
  let cur = p.links.find(x => x.key === key);
  if (!cur) {
    cur = { key, url: l.url, site: RS_SITE.of(l.url), title: '', thumb: '', img: '', engines: [], exact: false, firstSeen: R.prev[p.i] && R.prev[p.i].urls[key] || null };
    cur.isNew = !!(R.prev[p.i] && R.prev[p.i].lastSearched && !cur.firstSeen);
    p.links.push(cur);
  }
  if (l.url.length < cur.url.length && RS_UTIL.key(l.url) === key) cur.url = l.url;   // keep the tidier address
  if (!cur.engines.includes(engine)) cur.engines.push(engine);
  cur.exact = cur.exact || !!l.exact;
  if (engine === 'google' && l.exact) cur.gx = true;      // on Google's own "Exact matches" list
  if ((l.title || '').length > cur.title.length) cur.title = String(l.title).slice(0, 300);
  if (!cur.thumb && l.thumb) cur.thumb = String(l.thumb);
  if (!cur.img && l.img && /^https?:/.test(l.img)) cur.img = l.img;
  if (!cur.w && l.w > 0 && l.h > 0) { cur.w = l.w; cur.h = l.h; }
  cur.pic = p.i;
  if (cur.sv !== SCORE_VERSION && !knownScore(p, cur) && !R.scoreQ.includes(cur)) R.scoreQ.push(cur);
}

function onResults(t, msg) {
  const p = t.p;
  for (const l of (msg.links || []).slice(0, 150)) addLink(p, l, t.engine);
  const run = p.runs[t.engine];
  run.count = (msg.links || []).length;
  run.pageUrl = msg.pageUrl;
  run.pageOk = !!msg.pageOk;            // Bing showed its real results page (0 links = nothing found)
  rememberSeen(p);
  finishTask(t, 'done');
  scoreAll();
}

// Remember every link found for this picture, so next time new ones can be marked "New".
async function rememberSeen(p) {
  try {
    const rec = (await RS_MEM.get(p.hash)) || { urls: {} };
    const today = RS_UTIL.today();
    for (const l of p.links) if (!rec.urls[l.key]) rec.urls[l.key] = today;
    rec.lastSearched = job.created;
    addScores(rec, p);
    await RS_MEM.put(p.hash, rec);
  } catch (e) { /* ignore */ }
}
// Match results are remembered per picture, so a link already checked is never downloaded
// and compared again in a later search.
const SAVE_FIELDS = ['pct', 'inl', 'tiles', 'str', 'mid', 'w', 'h', 'from', 'onPage', 'pv', 'img', 'cover', 'coverImg', 'second'];   // 4.35: and what their page check found; 4.50: post covers
function addScores(rec, p) {
  rec.scores = rec.scores || {};
  for (const l of p.links) if (l.sv === SCORE_VERSION && l.pct >= 0 && !l.fromMemory) {
    const o = { sv: l.sv }; for (const k of SAVE_FIELDS) if (l[k] !== undefined && l[k] !== null) o[k] = l[k];
    rec.scores[l.key] = o;
  }
}
function knownScore(p, l) {
  const m = R.known[p.i] && R.known[p.i][l.key];
  if (!m || m.sv !== SCORE_VERSION) return false;
  for (const k of SAVE_FIELDS) if (m[k] !== undefined && (k !== 'w' && k !== 'h' || !l[k])) l[k] = m[k];
  if (m.mid === undefined) l.mid = null;
  l.sv = m.sv; l.fromMemory = true;
  return true;
}
const scoreSaveQ = new Set();
let scoreSaveT = null;
function saveScoresSoon(p) {
  scoreSaveQ.add(p);
  clearTimeout(scoreSaveT);
  scoreSaveT = setTimeout(async () => {
    const ps = [...scoreSaveQ]; scoreSaveQ.clear();
    for (const q of ps) {
      try { const rec = (await RS_MEM.get(q.hash)) || { urls: {} }; addScores(rec, q); await RS_MEM.put(q.hash, rec); } catch (e) { /* ignore */ }
    }
  }, 4000);
}

// ---------- % match: line up each found picture with yours (same work as the Compare page) ----------
async function origBitmap(p) {
  if (R.origBmp[p.i]) return R.origBmp[p.i];
  const b = await createImageBitmap(p.blob);
  const f = Math.min(1, 640 / Math.max(b.width, b.height));
  const s = await createImageBitmap(b, { resizeWidth: Math.max(1, Math.round(b.width * f)), resizeHeight: Math.max(1, Math.round(b.height * f)), resizeQuality: 'high' });
  b.close && b.close();
  return (R.origBmp[p.i] = s);
}
// 4.47: your photo for the second, full-size look (close calls, Google's exact matches). Only
// the photo being checked is kept, so memory stays small.
const DEEP = 1200;
async function bigBitmap(p) {
  if (R.bigBmp && R.bigBmp.i === p.i) return R.bigBmp.bmp;
  const b = await createImageBitmap(p.blob);
  const f = Math.min(1, DEEP / Math.max(b.width, b.height));
  const s = f < 1 ? await createImageBitmap(b, { resizeWidth: Math.max(1, Math.round(b.width * f)), resizeHeight: Math.max(1, Math.round(b.height * f)), resizeQuality: 'high' }) : b;
  if (s !== b) b.close && b.close();
  if (R.bigBmp) try { R.bigBmp.bmp.close && R.bigBmp.bmp.close(); } catch (e) { /* freed */ }
  R.bigBmp = { i: p.i, bmp: s };
  return s;
}
async function fetchPicture(url, max) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 7000);
  try {
    const t0 = Date.now();
    const r = await fetch(url, { signal: ctl.signal, credentials: 'omit' });
    // "Problems by website" (How PageProof is doing): the website's plain name only, never the address.
    if (!r.ok) { const blocked = [401, 403, 429, 451].includes(r.status); PP_STATS.add(blocked ? 'dl.blocked' : 'dl.failed'); PP_STATS.site(url, blocked ? 'b' : 'f'); return null; }
    const b = await r.blob();
    timeAdd('dl', Date.now() - t0); PP_STATS.time('dl', Date.now() - t0);
    if (b.size > 25e6) { PP_STATS.add('dl.tooBig'); return null; }
    const out = await decodeTurn(() => shrinkPicture(b, max));
    if (!out) PP_STATS.add('dl.unreadable');
    else out.blob = b;               // 4.50: kept for the second look, so it isn't downloaded again
    return out;
  } catch (e) {
    const slow = ctl.signal.aborted;
    PP_STATS.add(slow ? 'dl.slow' : 'dl.failed'); PP_STATS.site(url, slow ? 's' : 'f');
    return null;
  } finally { clearTimeout(timer); }
}
// Downloads run several more at a time than the photo checks (the internet is the slow part of a
// download, not the computer), but opening a big picture takes 50-100 MB for a moment, so only a
// few are opened at once.
const DECODE = { busy: 0, wait: [] };
async function decodeTurn(fn) {
  while (DECODE.busy >= liveDecode()) await new Promise(r => DECODE.wait.push(r));
  DECODE.busy++;
  try { return await fn(); } finally { DECODE.busy--; const n = DECODE.wait.shift(); if (n) n(); }
}
async function shrinkPicture(b, max = 640) {
  try {
    // Shrink straight away and free the full-size copy: a big photo takes 50-100 MB of memory
    // once opened, and the check only ever looks at it 640 pixels wide.
    const big = await createImageBitmap(b);
    const f = Math.min(1, max / Math.max(big.width, big.height));
    if (f >= 1) return { bmp: big, w: big.width, h: big.height };
    const bmp = await createImageBitmap(big, { resizeWidth: Math.max(1, Math.round(big.width * f)), resizeHeight: Math.max(1, Math.round(big.height * f)), resizeQuality: 'high' });
    const out = { bmp, w: big.width, h: big.height };
    big.close && big.close();
    return out;
  } catch (e) { return null; }
}
const freePic = x => { try { x && x.bmp.close && x.bmp.close(); } catch (e) { /* already freed */ } };
// Line one found picture up with yours and note how well it fits.
// The checking itself runs in background workers (score-worker.js), one per spare processor
// core up to 4, so the results page stays smooth. A check that hangs (a strange picture) is
// stopped after 30 seconds and its worker replaced, so one bad picture can't freeze anything.
// If workers aren't available the check runs on the page as before.
const POOL = { list: [], next: 1, failed: false };
let POOL_SIZE = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));   // set to the computer's limit when a search opens
// This computer's limits (ui/hardware.js), read fresh each time a search opens, so a new speed
// level in Settings › Your computer counts from the next search on.
let LIM = { checks: POOL_SIZE, tabs: 3, dl: POOL_SIZE + 4, decode: POOL_SIZE + 1 };
// Easing off: while the computer is busy (memory nearly full, a
// laptop low on battery) a running search drops to ONE photo check, ONE picture opened and ONE
// search tab, and goes back to full speed a minute after the computer calms down. It never stops,
// so today's 50 still finishes. (Only the work on this computer changes; how fast the search sites
// are asked never goes up.)
const EASE = { on: false, why: '', calm: 0, st: {}, since: 0, timer: null };
const liveChecks = () => (EASE.on ? 1 : POOL_SIZE);
const liveDecode = () => (EASE.on ? 1 : Math.max(1, LIM.decode || POOL_SIZE + 1));
const liveTabs = () => (EASE.on ? 1 : Math.max(1, LIM.tabs || 3));
async function easeTick() {
  if (!job || (!R.running && !R.scoring)) { EASE.st = {}; if (EASE.on) easeSet(false); return; }
  const why = await ppBusy(EASE.st);
  if (why) { EASE.calm = 0; EASE.why = why; if (!EASE.on) easeSet(true); }
  else if (EASE.on && ++EASE.calm >= 2) easeSet(false);
}
function easeSet(on) {
  EASE.on = on; EASE.calm = 0;
  if (on) { EASE.since = Date.now(); TIMES.eased++; timesSoon(); PP_STATS.add('strain.eased'); PP_STATS.add('strain.eased.' + (/memory/i.test(EASE.why) ? 'memory' : /battery/i.test(EASE.why) ? 'battery' : 'busy')); }
  else { EASE.why = ''; freeWorker(); freeSlots(); const n = DECODE.wait.splice(0); n.forEach(f => f()); }
  trimWorkers(); renderSoon();
}
// Workers above the live limit are closed when idle (each holds its own memory).
function trimWorkers() {
  for (const w of POOL.list.filter(x => !x.busy).slice(0, Math.max(0, POOL.list.length - liveChecks()))) {
    try { w.worker.terminate(); } catch (e) { /* gone */ }
    POOL.list.splice(POOL.list.indexOf(w), 1);
  }
}
function newWorker() {
  const w = { worker: new Worker('score-worker.js'), busy: 0, sent: new Set(), waits: new Map() };
  w.worker.onmessage = e => { const r = w.waits.get(e.data.id); if (r) { w.waits.delete(e.data.id); w.busy--; r(e.data); freeWorker(); } };
  w.worker.onerror = () => killWorker(w);
  return w;
}
function killWorker(w) {
  try { w.worker.terminate(); } catch (e) { /* gone */ }
  for (const r of w.waits.values()) r({ err: 'stopped' });
  w.waits.clear();
  const i = POOL.list.indexOf(w); if (i >= 0) POOL.list.splice(i, 1);
  freeWorker();
}
// Each worker gets ONE check at a time; the others wait here. (Before, several checks queued up
// inside one worker, and the 30-second "stuck" timer ran while they waited, so on a slower
// computer good checks were stopped and shown as "Can't check".)
const POOL_WAIT = [];
const busyWorkers = () => POOL.list.filter(x => x.busy).length;
function freeWorker() { while (POOL_WAIT.length && busyWorkers() < liveChecks() && (POOL.list.length < liveChecks() || POOL.list.some(x => !x.busy))) POOL_WAIT.shift()(); }
async function idleWorker() {
  for (;;) {
    if (busyWorkers() < liveChecks()) {
      while (POOL.list.length < liveChecks()) POOL.list.push(newWorker());
      const w = POOL.list.find(x => !x.busy);
      if (w) return w;
    }
    await new Promise(r => POOL_WAIT.push(r));
  }
}
async function checkInWorker(p, bmp, deep) {
  if (POOL.failed || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return null;
  let w;
  const tw = Date.now();
  try { w = await idleWorker(); } catch (e) { POOL.failed = true; return null; }
  const waited = Date.now() - tw;
  timeAdd('wait', waited); PP_STATS.time('chk.wait', waited);
  w.busy++;                                            // taken before any waiting below
  const key = deep ? 'big' + p.i : p.i;
  try {
    if (!w.sent.has(key)) {
      const o = deep ? await bigBitmap(p) : await origBitmap(p);
      const copy = await createImageBitmap(o);
      w.worker.postMessage({ type: 'orig', key, bmp: copy }, [copy]);
      w.sent.add(key);
      if (w.sent.size > 8) { const old = w.sent.values().next().value; w.sent.delete(old); w.worker.postMessage({ type: 'forget', key: old }); }   // keep memory small
    } else { w.sent.delete(key); w.sent.add(key); }   // most recently used goes last
  } catch (e) { w.busy--; freeWorker(); throw e; }
  const id = POOL.next++, tc = Date.now();
  const res = await new Promise(resolve => {
    w.waits.set(id, resolve);
    w.worker.postMessage({ type: 'check', id, key, bmp, deep: !!deep }, [bmp]);
    setTimeout(() => { if (w.waits.has(id)) killWorker(w); }, deep ? 60000 : 30000);
  });
  if (res.err) return { stuck: true };                // the picture was handed over, so no second try here
  timeAdd('check', Date.now() - tc);
  if (res.fast !== undefined) TIMES.fast = res.fast;
  if (res.gpu !== undefined && res.gpu !== null) { TIMES.gpu = res.gpu; TIMES.gpuWhy = res.gpuWhy || ''; }
  if (res.out) res.out._w = waited;
  return res.out;
}

async function measure(p, bmp, deep) {
  const f = Math.min(1, (deep ? DEEP : 640) / Math.max(bmp.width, bmp.height));
  const small = f < 1 ? await createImageBitmap(bmp, { resizeWidth: Math.round(bmp.width * f), resizeHeight: Math.round(bmp.height * f), resizeQuality: 'high' }) : bmp;
  const t0 = Date.now();
  try {
    const w = await checkInWorker(p, small, deep);
    if (w && w.stuck) { PP_STATS.add('chk.stuck'); return { pct: -1, sv: SCORE_VERSION }; }       // took too long: shown as "Can't check"
    let best = w ? PP_VERDICT.fromWorker(w)
      : await PP_ALIGN.align(deep ? await bigBitmap(p) : await origBitmap(p), small, undefined, { fast: !deep });
    if (best && !w && best.sc.lines >= 0.3) {
      const A = deep ? await bigBitmap(p) : await origBitmap(p), Sh = PP_ALIGN.shot(A, small, best);
      Object.assign(best, { backdrop: Sh.backdrop, logos: Sh.logos, place: Sh.place, spot: Sh.emblem || Sh.slice || Sh.pattern, photo: Sh.photo });
    }
    const out = PP_VERDICT.fields(best, SCORE_VERSION);
    if (!deep) statCheck(out, Date.now() - t0 - (w && w._w || 0)); else PP_STATS.time('chk.deep', Date.now() - t0 - (w && w._w || 0));
    return out;
  } catch (e) { PP_STATS.add('chk.error'); return { pct: 0, inl: 0, tiles: 0, str: 0, mid: null, sv: SCORE_VERSION }; }
}
// How long one photo check took, by its answer (Settings › How PageProof is doing).
function statCheck(m, ms) { const v = PP_VERDICT.score(m); PP_STATS.time('chk.' + v, ms); PP_STATS.time('chk.all', ms); }
// Quick first look with the search site's small preview (fast to download). A clear
// "different photo" stops there; anything else is checked again with the full picture.
async function scoreLink(l) {
  const p = job.pics[l.pic];
  await scoreLinkNow(p, l);
  markCover(p, l);
}
// 4.50: a downloaded picture's file is kept (fetchPicture), so the slower second look opens the
// same download again at full size (it used to be downloaded a second time).
const measureKeep = (p, pic) => measure(p, pic.bmp);
async function scoreLinkNow(p, l) {
  let quick = null, tb = null;
  try {
    if (l.thumb && l.thumb !== l.img) {
      tb = await fetchPicture(l.thumb);
      if (tb && Math.min(tb.w, tb.h) >= 80) quick = await measureKeep(p, tb);
      // 4.47: Google's exact matches are never thrown out on the small preview alone.
      if (quick && verdict(quick) === 'no' && !l.exact) { Object.assign(l, quick); return; }
    }
    if (l.img) {
      const full = await fetchPicture(l.img);
      if (full) {
        try {
          if (!l.w) { l.w = full.w; l.h = full.h; }
          const m = await measureKeep(p, full);
          Object.assign(l, { from: 'image' }, await secondLook(p, l, m, { url: l.img, pic: full }));
        } finally { freePic(full); }
        return;
      }
    }
    // 4.35: only the search site's small preview was checked (Google never gives the picture's
    // own address). pageCheck() then looks for the photo on their page itself.
    if (quick) { Object.assign(l, { from: 'preview' }, await secondLook(p, l, quick, { url: l.thumb, pic: tb })); return; }
    if (!tb && l.thumb) tb = await fetchPicture(l.thumb);
    if (tb) { const m = await measureKeep(p, tb); Object.assign(l, { from: 'preview' }, await secondLook(p, l, m, { url: l.thumb, pic: tb })); return; }
    // 4.37.2: the search site gave no picture that could be downloaded. Before giving up
    // ("Picture blocked"), read their page once (signed out, like anyone visiting) and check its
    // own pictures: the share picture first, then the pictures in the article.
    if (await ownPageCheck(l, p)) return;
    l.pct = -1; l.sv = SCORE_VERSION;
  } finally { freePic(tb); }
}
// 4.50 (Ben's pick): a post with several pictures (an Instagram carousel, a Facebook album, TikTok
// slides, an X post with 4 photos). The search site shows the post's cover, so when your photo is
// picture 3 the cover is "a different photo" and the post used to be thrown out. When a search
// site listed the post itself as a match, it is kept as a Maybe ("Checking the post") instead, and
// Copies found's post check looks at every picture in your signed-in browser: it stays only if
// your photo is one of them, otherwise it is moved to Removed by itself, as post checks do.
const POST_URL = /\/(p|reel|reels|tv|status|posts|videos?|permalink|photos?)\/[^/?#]+|story_fbid=|[?&]fbid=|\/share\/[pr]\//i;
const COVER_MAX = 8;
function markCover(p, l) {
  if (l.cover || !l.exact || l.rescued || l.sv !== SCORE_VERSION || baseVerdict(l) !== 'no' || userNo(l) || cardOf(l)) return;
  let host = '';
  try { host = new URL(l.url).hostname; } catch (e) { return; }
  if (!(globalThis.PP_SOCIAL && PP_SOCIAL.isSocial(host)) || !POST_URL.test(l.url)) return;
  if (typeof RS_FORUM !== 'undefined' && RS_FORUM.is(l.site, l.url)) return;
  if ((p.covers = (p.covers || 0) + 1) > COVER_MAX) return;
  l.cover = 1; l.coverImg = l.img || ''; l.img = '';
  l.from = 'preview'; l.onPage = 'postOnly'; l.pv = PV;
  PP_STATS.add('chk.cover');
}
// 4.47 (Ben's picks): the second look. A Same photo with a thin margin, or a link Google listed
// under "Exact matches" that the fast check threw out, is checked again more slowly with both
// pictures at full size (up to 1200 pixels) before it is kept or thrown out. l.second says what
// happened: kept / maybe / out (a close Same that was not), saved (an exact match the fast check
// missed), page (4.50: found on their page), exactNo (still thrown out: "Google said exact").
// 4.50 (Ben's pick): Yandex and Bing mark every link as exact, so a plainly different photo from
// them (hardly any matching details) no longer gets the slow look.
// 4.52: Google's own exact list too: Ben's stats showed about 1,750 such looks in a day and a half
// that saved none, and reading their page found 1 copy in 41 tries at about 22 seconds each.
const someDetails = m => (m.inl || 0) >= 6 || (m.tiles || 0) >= 6;
async function secondLook(p, l, m, have) {
  const v0 = PP_VERDICT.score(m);
  const missed = l.exact && (v0 === 'no' || v0 === 'cant') && !cardOf(l) && !userNo(l) && someDetails(m);
  const want = PP_VERDICT.close(m) || missed;
  if (!want || !p.blob) return m;
  let deep = null;
  for (const u of [l.img, l.thumb]) {
    if (!u) continue;
    // 4.50: the picture already downloaded for the first check is opened again at full size.
    const pic = have && have.url === u && have.pic && have.pic.blob ? await decodeTurn(() => shrinkPicture(have.pic.blob, DEEP)) : await fetchPicture(u, DEEP);
    if (!pic) continue;
    try {
      if (Math.min(pic.w, pic.h) < 60) continue;
      // measure() may hand the picture itself to the checker, so the checker gets a copy.
      deep = await measure(p, await createImageBitmap(pic.bmp), true);
    } finally { freePic(pic); }
    if (PP_VERDICT.score(deep) !== 'cant') break;
  }
  const r = PP_VERDICT.second(m, deep, !!l.exact);
  // 4.50 (Ben's pick): Google said exact, but its small preview still doesn't line up (a headline
  // over it, a crop). Google never gives the picture itself, so their page is read and its own
  // pictures are checked at full size (4.52: up to 3 such links a photo, 8 pictures each).
  if (l.gx && !l.img && (r.how === 'exactNo' || (!r.how && missed))) {
    const hit = await exactOnPage(p, l);
    if (hit) { PP_STATS.add('chk.second.page'); return { ...hit.m, second: 'page', fastPct: m.pct, from: 'page', img: hit.u, onPage: hit.card ? 'card' : 'seen', pv: PV, ...(l.w ? {} : { w: hit.w, h: hit.h }) }; }
  }
  if (r.how) PP_STATS.add('chk.second.' + r.how);
  return { ...r.keep, second: r.how || undefined, fastPct: r.keep === m ? undefined : m.pct };
}
const EXACT_PAGE_MAX = 3, EXACT_PAGE_PICS = 8;
async function exactOnPage(p, l) {
  if ((p.exactPages = (p.exactPages || 0) + 1) > EXACT_PAGE_MAX) return null;
  let social = false;
  try { social = !!(globalThis.PP_SOCIAL && PP_SOCIAL.isSocial(new URL(l.url).hostname)); } catch (e) { return null; }
  if (social) return null;            // posts: the post check in your browser does this (markCover)
  const t0 = Date.now();
  let hit = null;
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
    const r = await fetch(l.url, { credentials: 'omit', redirect: 'follow', signal: ctl.signal });
    const html = r.ok && /html/i.test(r.headers.get('content-type') || 'html') ? (await r.text()).slice(0, 3e6) : '';
    clearTimeout(t);
    if (html) {
      const doc = new DOMParser().parseFromString(html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son([a-z]+\s*=)/gi, ' data-pp-on$1'), 'text/html');
      for (const u of pagePictures(doc, r.url || l.url, false).slice(0, EXACT_PAGE_PICS)) {
        if (R.stop && !BG) break;
        const pic = await fetchPicture(u, DEEP);
        if (!pic) continue;
        let m;
        try { m = await measure(p, await createImageBitmap(pic.bmp), true); } finally { freePic(pic); }
        if (['same', 'maybe'].includes(PP_VERDICT.score(m))) { hit = { m, u, w: pic.w, h: pic.h }; break; }
      }
    }
  } catch (e) { PP_STATS.site(l.url, 'f'); }
  PP_STATS.add('job.exact.n'); PP_STATS.add('job.exact.' + (hit ? 'ok' : 'fail')); PP_STATS.time('job.exact', Date.now() - t0);
  return hit;
}
async function ownPageCheck(l, p) {
  let social = false;
  try { social = !!(globalThis.PP_SOCIAL && PP_SOCIAL.isSocial(new URL(l.url).hostname)); } catch (e) { return false; }
  const t0 = Date.now();
  let best = null, bestUrl = '', bw = 0, bh = 0;
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
    const r = await fetch(l.url, { credentials: 'omit', redirect: 'follow', signal: ctl.signal });
    const html = r.ok && /html/i.test(r.headers.get('content-type') || 'html') ? (await r.text()).slice(0, 3e6) : '';
    clearTimeout(t);
    if (!html) { PP_STATS.add('job.own.n'); PP_STATS.add('job.own.fail'); return false; }
    const doc = new DOMParser().parseFromString(html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son([a-z]+\s*=)/gi, ' data-pp-on$1'), 'text/html');
    for (const u of pagePictures(doc, r.url || l.url, social).slice(0, 4)) {
      if (R.stop && !BG) break;
      const pic = await fetchPicture(u);
      if (!pic) continue;
      const m = await measure(p, pic.bmp);
      if (!best || (m.pct || 0) > (best.pct || 0)) { best = m; bestUrl = u; bw = pic.w; bh = pic.h; }
      freePic(pic);
      if (['same', 'maybe'].includes(baseVerdict({ ...m }))) break;
    }
  } catch (e) { PP_STATS.site(l.url, 'f'); }
  PP_STATS.time('job.own', Date.now() - t0);
  if (!best) { PP_STATS.add('job.own.n'); PP_STATS.add('job.own.fail'); return false; }
  PP_STATS.add('job.own.n'); PP_STATS.add('job.own.ok');
  // A picture of their page itself: it counts as seen on the page (a link preview card still doesn't).
  Object.assign(l, best, { from: 'page', img: bestUrl, onPage: social && PP_SOCIAL.cardPic(bestUrl) ? 'card' : 'seen', pv: PV });
  if (!l.w) { l.w = bw; l.h = bh; }
  return true;
}

// Is it the same photo? Tested on real copies (cropped, resized, colour-graded, mirrored, tiny
// thumbnails, a headline printed over 40% of it) against different photos of the same kind:
// real copies share dozens of matching details (31 to 400+), different photos share under 10.
// Two different photos in front of the same backdrop (sponsor wall, logo pattern) line up
// around the edges but not in the middle: real copies 0.49 to 1.0 there (0.49 = headline over
// the middle), same-backdrop different photos about 0.3.
// Version 4: a copy shrunk to a dot no longer counts (it was compared over two tiny squares and
// could show 100%); at least 40 squares must be compared and 12 must match for Same photo.
const SCORE_VERSION = 8;   // 5: press-wall check (4.8.3); 6: only-logos + same-place check (4.31.0); 7: only a seal / slice / pattern; 8: collages (findCut)
const userNo = l => !!(l.url && job && job.pics[l.pic] && RS_REJECT.notMatch(l.url, job.pics[l.pic].name));
function baseVerdict(l) {
  if (l.rescued) return 'maybe';          // you said it is a copy
  if (userNo(l)) return 'no';
  if (l.sv !== SCORE_VERSION) return l.pct === null ? 'cant' : 'pending';
  return PP_VERDICT.score(l);
}
// 4.35 (Ben): a match only counts when the photo is on their page itself, never only in a
// comment, a link preview, a "related posts" box or a suggested post. A match made on the search
// site's preview waits ("Checking…") until their page is read:
//   seen     the photo is one of the page's own pictures: kept, with that picture's address
//   notSeen  the page was read and none of its own pictures is the photo: thrown out
//   postOnly a social post whose main picture is different: kept as Maybe; Copies found then
//            looks at every picture of the post in your signed-in browser (multi-picture posts)
//   unknown  the page could not be read (login wall, blocked): kept, but only as Maybe
const PV = 1;
const needsPage = l => l.from === 'preview' && l.pv !== PV && !l.rescued && ['same', 'maybe'].includes(baseVerdict(l));
// 4.35 (Ben): on LinkedIn, X and Facebook a shared article shows as a link preview card with the
// article's picture. That picture is not posted by the account, so it never counts as a copy.
const cardOf = l => !l.rescued && globalThis.PP_SOCIAL && PP_SOCIAL.cardPic ? PP_SOCIAL.cardPic(l.img) : '';
function verdict(l) {
  const v = baseVerdict(l);
  // 4.50: a post whose cover is another picture, listed by a search site: Maybe until the post check looks.
  if (v === 'no' && l.cover && !l.rescued && !userNo(l)) return l.onPage === 'notSeen' ? 'no' : 'maybe';
  if (['same', 'maybe'].includes(v) && cardOf(l)) return 'no';
  if (l.rescued || l.from !== 'preview' || !['same', 'maybe'].includes(v)) return v;
  if (l.pv !== PV) return 'pending';
  if (l.onPage === 'notSeen' || l.onPage === 'card') return 'no';
  if (l.onPage === 'seen') return v;
  return 'maybe';
}
// The page's own pictures, best first: its share picture, then pictures in the article itself.
// Pictures in comments, sidebars, "related" boxes, menus and footers are not the page's own.
const NOT_OWN = 'aside, nav, footer, form, [class*="related" i], [id*="related" i], [class*="sidebar" i], [id*="sidebar" i], [class*="widget" i], [class*="comment" i], [id*="comment" i], [class*="recommend" i], [class*="trending" i], [class*="popular" i], [class*="more-stories" i], [class*="newsletter" i], [class*="advert" i], [class*="promo" i]';
const JUNK_IMG = /(^data:|\.svg(\?|$)|\.gif(\?|$)|logo|icon|avatar|sprite|placeholder|blank|spacer|pixel|gravatar|emoji|badge|\/ads?\/)/i;
function pagePictures(doc, base, social) {
  const out = [];
  const add = u => { if (!u) return; try { const h = new URL(u.trim(), base).href; if (/^https?:/i.test(h) && !JUNK_IMG.test(h) && !out.includes(h)) out.push(h); } catch (e) { /* not an address */ } };
  const meta = n => { const m = doc.querySelector(`meta[property="${n}"], meta[name="${n}"]`); return m ? m.getAttribute('content') || '' : ''; };
  add(meta('og:image:secure_url') || meta('og:image')); add(meta('twitter:image')); add(meta('twitter:image:src'));
  const ls = doc.querySelector('link[rel="image_src"]'); if (ls) add(ls.getAttribute('href'));
  if (social) return out.slice(0, 3);          // a post page's own picture; the rest is the site around it
  const biggest = ss => { let best = '', bw = 0; for (const part of String(ss || '').split(',')) { const [u, w] = part.trim().split(/\s+/); const n = parseInt(w, 10) || 1; if (u && n >= bw) { best = u; bw = n; } } return best; };
  const main = doc.querySelector('article, main, [role="main"], .entry-content, .post-content, .article-body') || doc.body;
  const imgs = [...(main ? main.querySelectorAll('img, source') : []), ...doc.querySelectorAll('img')];
  for (const im of imgs) {
    if (out.length >= 10) break;
    if (im.closest(NOT_OWN) || (im.closest('header') && !im.closest('article, main, [role="main"]'))) continue;
    const w = parseInt(im.getAttribute('width'), 10), h = parseInt(im.getAttribute('height'), 10);
    if ((w && w < 150) || (h && h < 150)) continue;
    add(biggest(im.getAttribute('srcset') || im.getAttribute('data-srcset')) || im.getAttribute('data-src') || im.getAttribute('data-lazy-src') || im.getAttribute('data-original') || im.getAttribute('src'));
  }
  return out.slice(0, 8);
}
async function pageCheck(l) {
  const p = job.pics[l.pic];
  let social = false;
  try { social = !!(globalThis.PP_SOCIAL && PP_SOCIAL.isSocial(new URL(l.url).hostname)); } catch (e) { /* bad address */ }
  let state = 'unknown';
  const t0 = Date.now();
  try {
    // 4.64 (Ben): social sites are read at their own safe pace (Instagram one page every 30 seconds...)
    // and not at all while one rests after "too many requests". The search never waits for that: a
    // link whose site isn't free right now stays a Maybe, and Copies found checks the post later.
    if (globalThis.PP_PACE && !(await PP_PACE.turn(l.url, 0))) throw new Error('paced');
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
    const r = await fetch(l.url, { credentials: 'omit', redirect: 'follow', signal: ctl.signal });
    if (globalThis.PP_PACE) PP_PACE.note(r.url || l.url, r.status);
    const type = r.headers.get('content-type') || 'html';
    const html = r.ok && /html/i.test(type) ? (await r.text()).slice(0, 3e6) : '';
    clearTimeout(t);
    if (html) {
      const doc = new DOMParser().parseFromString(html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son([a-z]+\s*=)/gi, ' data-pp-on$1'), 'text/html');
      const pics = pagePictures(doc, r.url || l.url, social);
      let tried = 0;
      for (const u of pics) {
        if (R.stop && !BG) break;
        const pic = await fetchPicture(u);
        if (!pic) continue;
        tried++;
        const m = await measure(p, pic.bmp);
        const w = pic.w, h = pic.h;
        freePic(pic);
        if (['same', 'maybe'].includes(baseVerdict({ ...m }))) {
          state = social && PP_SOCIAL.cardPic(u) ? 'card' : 'seen'; l.img = u; if (!l.w) { l.w = w; l.h = h; }
          if (m.pct > l.pct) Object.assign(l, m);
          break;
        }
      }
      if (state !== 'seen' && state !== 'card' && tried) state = social ? 'postOnly' : 'notSeen';
      TIMES.pages = (TIMES.pages || 0) + 1;
    }
  } catch (e) { /* their page did not answer (or Instagram has to wait): unknown */ if (!e || e.message !== 'paced') PP_STATS.site(l.url, 'f'); }
  l.onPage = state; l.pv = PV;
  PP_STATS.add('job.page.n'); PP_STATS.add('job.page.' + (state === 'unknown' ? 'fail' : 'ok')); PP_STATS.time('job.page', Date.now() - t0);
}
const VERDICT = {
  same: { tag: 'Same photo', cls: 'ex', rank: 4 },
  maybe: { tag: 'Maybe', cls: 'maybe', rank: 3 },
  pending: { tag: 'Checking…', cls: 'sim', rank: 2 },
  cant: { tag: "Can't check", cls: 'sim', rank: 1 },
  no: { tag: 'Different photo', cls: 'sim', rank: 0 },
};
// A site was shown again: its links that were skipped while hidden get checked now.
function unpark() {
  let n = 0;
  for (const l of [...R.parked]) if (!RS_LISTS.isHidden(l.site, l.url)) { R.parked.delete(l); if (l.sv !== SCORE_VERSION && !R.scoreQ.includes(l)) { R.scoreQ.push(l); n++; } }
  if (n) scoreAll();
}
// "Where the time goes" (Settings › Is everything working?): how long each kind of work takes
// on this computer, added up per day for the last 7 days. Numbers only.
const TIMES = { search: [0, 0], dl: [0, 0], check: [0, 0], wait: [0, 0], skipped: 0, eased: 0, fast: null, gpu: null, gpuWhy: '' };
function timeAdd(k, ms) { TIMES[k][0]++; TIMES[k][1] += Math.max(0, ms); timesSoon(); }
let timesT = null;
function timesSoon() {
  if (timesT) return;
  timesT = CLOCK.after(30000, async () => {
    timesT = null;
    try {
      const day = RS_UTIL.today(), st = (await api.storage.local.get('rsTiming')).rsTiming || { days: {} };
      const d = st.days[day] || (st.days[day] = { search: [0, 0], dl: [0, 0], check: [0, 0], wait: [0, 0], skipped: 0 });
      for (const k of ['search', 'dl', 'check', 'wait']) { d[k][0] += TIMES[k][0]; d[k][1] += TIMES[k][1]; TIMES[k] = [0, 0]; }
      d.skipped += TIMES.skipped; TIMES.skipped = 0;
      d.eased = (d.eased || 0) + TIMES.eased; TIMES.eased = 0;
      if (TIMES.fast !== null) st.fast = TIMES.fast;
      if (TIMES.gpu !== null) { st.gpu = TIMES.gpu; st.gpuWhy = TIMES.gpuWhy; }
      st.checks = POOL_SIZE; st.level = LIM.level || ''; st.at = Date.now();
      for (const k of Object.keys(st.days).sort().slice(0, -7)) delete st.days[k];
      await api.storage.local.set({ rsTiming: st });
    } catch (e) { /* only numbers for a help page */ }
  });
}

// Checks every picture's links in the background, three at a time, the picture on screen first.
async function scoreAll() {
  if (R.scoring || R.watch) return;                 // the pinned tab does the checks
  R.scoring = true;
  // Downloads overlap: a few more than the checks that can run at once (the computer check sets
  // how many), so a check never waits on the internet (pictures are opened a few at a time, see
  // decodeTurn).
  const run = () => Promise.all(Array.from({ length: Math.max(POOL_SIZE + 1, LIM.dl || POOL_SIZE + 4) }, scoreWorker));
  // Holding a lock while checking tells Chrome and Edge this page is busy, so they don't put it
  // to sleep when the window is minimized or left in the background. One lock per search: a
  // single shared lock made every other open search (and Keep searching) wait for this one's
  // checks to finish, so their photos sat at "Checking matches".
  try { await (navigator.locks ? navigator.locks.request('pageproof-photo-checks-' + job.id, run) : run()); } finally { R.scoring = false; }
}
// Coming back to the window: carry on with anything still waiting, in case the browser paused us.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && job && R.scoreQ.length) scoreAll(); });
async function scoreWorker() {
  {
    while (R.scoreQ.length) {
      // Exact matches and the picture on screen go first.
      // The picture on screen first, then the others in order, finishing one list before the next.
      // (Sorted only when something was added or another picture was picked: sorting thousands
      // of links before every single check was slow.)
      if (R.qSorted !== R.scoreQ.length + ':' + R.sel) {
        // Links on your approved sites are checked last for each picture (they are still checked:
        // their copies go into All copies found as Licensed).
        const al = new Map(R.scoreQ.map(l => [l, RS_LISTS.isAllowed(l.site, l.url) ? 1 : 0]));
        R.scoreQ.sort((a, b) => (b.pic === R.sel) - (a.pic === R.sel) || a.pic - b.pic || al.get(a) - al.get(b) || b.exact - a.exact);
        R.qSorted = (R.scoreQ.length - 1) + ':' + R.sel;
      } else R.qSorted = (R.scoreQ.length - 1) + ':' + R.sel;
      const l = R.scoreQ.shift();
      if (l.sv === SCORE_VERSION && !needsPage(l)) continue;
      // Links on your hidden sites are never shown, so they are not downloaded or checked. If you
      // show a site again, its links are checked then (unpark).
      if (!l.rescued && RS_LISTS.isHidden(l.site, l.url)) { R.parked.add(l); TIMES.skipped++; timesSoon(); continue; }
      const p = job.pics[l.pic];
      if (l.sv !== SCORE_VERSION) await scoreLink(l);
      if (needsPage(l)) await pageCheck(l);
      saveScoresSoon(job.pics[l.pic]);
      maybeIngest(job.pics[l.pic]);
      saveJob(); renderSoon();
      await breathe();
    }
  }
}

// ---------- running the whole search ----------
// The computer check sets how many search tabs may be open at once (all sites together).
// While the computer is busy only one is open (liveTabs).
const SLOTS = { used: 0, wait: [] };
const takeSlot = () => (SLOTS.used < liveTabs() ? (SLOTS.used++, Promise.resolve()) : new Promise(r => SLOTS.wait.push(r)));
const giveSlot = () => { SLOTS.used--; freeSlots(); };
function freeSlots() { while (SLOTS.wait.length && SLOTS.used < liveTabs()) { SLOTS.used++; SLOTS.wait.shift()(); } }
// Keeps a running search awake when its page is not on screen: the tab may not be put to sleep
// (discarded) by the browser, and holding a lock tells Chrome and Edge the page is busy, so they
// don't freeze it. Both are undone when the search ends.
function stayAwake(on) {
  if (R.myTab && !BG) api.tabs.update(R.myTab, { autoDiscardable: !on }).catch(() => {});   // the pinned tab is always kept awake
  if (on && navigator.locks && !R.awake) navigator.locks.request('pageproof-search-running-' + job.id, () => new Promise(r => { R.awake = r; })).catch(() => {});
  if (!on && R.awake) { R.awake(); R.awake = null; }
}
// While today's 50 runs, Keep searching waits. This says "still running" every 20 seconds (from
// the worker clock, so it keeps coming when the page is hidden) and "finished" at the end.
function fiftyBeat(running) {
  if (!job || (job.kind !== 'fifty' && !BG)) return;   // any big search in the pinned tab
  api.storage.local.set({ fcFifty: { id: job.id, beat: running ? Date.now() : 0, running: !!running } }).catch(() => {});
}
// Ben (after 4.49): a search you stop says so in plain words, so a stopped site is never
// mistaken for one that skipped a photo by itself.
const STOPPED = 'Stopped by you while this site was searching the photo';
const STOPPED_BEFORE = 'Stopped by you before this site searched the photo';
const byYou = r => r && r.state === 'skip' && /^Stopped/.test(r.why || '');
async function runJob(onlyEngines) {
  R.running = true; R.stop = false;
  job.started = true; delete job.finished; saveJob(true);
  stayAwake(true); fiftyBeat(true);
  const sp = SPEED[job.speed] || SPEED.normal;
  const workers = [];
  for (const e of onlyEngines || job.engines) {
    R.gaveUp[e] = false; R.captchas[e] = 0;
    const q = R.queues[e] = job.pics.filter(p => p.runs[e].state === 'wait');
    for (let w = 0; w < sp.per; w++) {
      workers.push((async () => {
        await sleep(w * rand(sp.gap));
        while (q.length && !R.stop && !R.gaveUp[e]) {
          while (R.paused[e] && !R.stop && !R.gaveUp[e]) await sleep(500);
          const p = q.shift();
          if (!p || R.stop || R.gaveUp[e]) { if (p) q.unshift(p); break; }
          await takeSlot();
          try { await runOne(p, e); } finally { giveSlot(); }
          if (q.length) await sleep(rand(sp.gap));
        }
      })());
    }
  }
  renderSoon();
  await Promise.all(workers);
  if (R.stop) for (const p of job.pics) for (const e of job.engines) if (p.runs[e].state === 'wait') { p.runs[e].state = 'skip'; p.runs[e].why = STOPPED_BEFORE; }
  // Stop keeps the results so far: the links already found are still checked (and their copies
  // go to Copies found), so make sure the checks carry on.
  if (R.stop && R.scoreQ.length) scoreAll();
  R.running = false;
  job.finished = new Date().toISOString();
  saveJob(true); renderSoon();
  fiftyBeat(false); stayAwake(false);
  for (const p of job.pics) maybeIngest(p);
  autoDone();
}

// ---------- every find goes into All copies found ----------
// When a photo has been searched and every link checked, its Same photo and Maybe links are
// added to the copies list (Find copies › All copies found), with the photo's client.
const BY = { keep: 'Keep searching', fifty: 'today\'s 50', new: 'a search' };
function maybeIngest(p) {
  if (!p || p.ingested || !picDone(p) || R.watch) return;
  // What each search site gave back, for "is this site still working?" (-1 = no answer).
  const health = {};
  for (const e of job.engines) { const st = p.runs[e].state; if (st === 'done') { const n = p.links.filter(l => (l.engines || []).includes(e)).length; if (n || !p.runs[e].pageOk) health[e] = n; } else if (st === 'fail') health[e] = -1; }
  if (!job.engines.some(e => p.runs[e].state === 'done')) {                // nothing actually searched
    if (!p.healthNoted && Object.keys(health).length) { p.healthNoted = true; FC.engineResults(health, null, false).catch(() => {}); }
    return;
  }
  if (p.links.some(l => verdict(l) === 'pending' && !RS_LISTS.isHidden(l.site, l.url))) return;
  p.ingested = true;
  const links = p.links.filter(l => ['same', 'maybe'].includes(verdict(l)) && !RS_LISTS.isHidden(l.site, l.url) && !isRejected(p, l))
    .map(l => ({ ...l, verdict: verdict(l) }));
  const done = job.engines.filter(e => p.runs[e].state === 'done');
  FC.ingest(p, links, BY[job.kind] || 'a search', { engines: done }).then(r => { statPhoto(p, r && r.fresh || 0); if (!p.healthNoted) { p.healthNoted = true; return FC.engineResults(health, r.photo.id, !links.length); } })
    .catch(err => { p.ingested = false; console.warn('PageProof: could not add the copies', err); })
    .then(() => alikeCheck(p))
    .finally(() => { saveJob(); autoDone(); });
}
// From search to copy, and why each link was thrown out (How PageProof is doing). Counts only.
function statPhoto(p, fresh) {
  if (p.statDone) return;
  p.statDone = true;
  const S = PP_STATS, why = {};
  let same = 0, maybe = 0;
  for (const l of p.links) {
    let k = '';
    if (typeof RS_FORUM !== 'undefined' && RS_FORUM.is(l.site, l.url)) k = 'forum';
    else if (!l.rescued && RS_LISTS.isHidden(l.site, l.url)) k = 'hidden';
    else {
      const v = verdict(l);
      if (v === 'cant') k = 'cant';
      else if (v === 'no') k = cardOf(l) ? 'card' : l.onPage === 'notSeen' || l.onPage === 'card' ? 'notInPost' : userNo(l) ? 'removedBefore' : (l.wall || l.logos || l.place || l.spot) ? 'logos' : 'different';
      else if (v === 'same' || v === 'maybe') {
        if (isRejected(p, l)) k = 'removedBefore';
        else { if (RS_LISTS.isAllowed(l.site, l.url)) S.add('drop.approved'); if (v === 'same') same++; else maybe++; }
      } else k = 'other';
    }
    if (k) why[k] = (why[k] || 0) + 1;
    // Per search site: what its links turned out to be, so one broken site stands out.
    const v = k || verdict(l);
    for (const e of l.engines || []) S.add('engv.' + e + '.' + v);
    if (k === 'cant' && (l.engines || []).length === 1) S.add('engv.' + l.engines[0] + '.cantOnly');
  }
  S.add('photos'); S.add('photos.' + (job.kind || 'new'));
  S.add('links', p.links.length); if (p.links.length) S.add('photos.withLinks');
  for (const [k, n] of Object.entries(why)) S.add('drop.' + k, n);
  S.add('kept.same', same); S.add('kept.maybe', maybe);
  S.add('copies.new', fresh); if (fresh) S.add('photos.withNew');
  if (p.t0 && Date.now() - p.t0 < 4 * 3600000) S.time('photo.' + (job.kind === 'fifty' || job.kind === 'new' ? 'big' : 'one'), Date.now() - p.t0);
}
// Speed-ups (Ben's pick): look-alike frames share one search. The links this photo's search threw
// out as a different photo are checked against the look-alike frames from the same shoot
// (job.alike, at most 3). A frame that matches gets the copy (FC.ingest with shared), and its
// own search moves to the front of the line. Most similar links first, at most 60 links.
async function alikeCheck(p) {
  const A = job && job.alike;
  if (!A || !A.length || p.alikeDone || p.i !== 0) { if (p) p.alikeDone = true; return; }
  const cand = p.links.filter(l => l.sv === SCORE_VERSION && baseVerdict(l) === 'no' && !userNo(l) && !cardOf(l) && (l.img || l.thumb) && (l.pct || 0) >= 0
    && !RS_LISTS.isHidden(l.site, l.url) && !(typeof RS_FORUM !== 'undefined' && RS_FORUM.is(l.site, l.url)))
    .sort((a, b) => (b.pct || 0) - (a.pct || 0)).slice(0, 60);
  const found = A.map(() => []);
  for (const l of cand) {
    if (R.stop && !BG) break;
    const pic = await fetchPicture(l.img || l.thumb);
    if (!pic) continue;
    for (let k = 0; k < A.length; k++) {
      let bmp;
      try { bmp = await createImageBitmap(pic.bmp); } catch (e) { break; }
      const m = await measure(A[k], bmp);
      try { bmp.close && bmp.close(); } catch (e) { /* handed to the checker */ }
      const v = PP_VERDICT.score(m);
      if (v === 'same' || v === 'maybe') {
        // Matched on the search site's small preview only: kept as Maybe (nobody read their page).
        const verdict = l.img ? v : 'maybe';
        found[k].push({ ...l, ...m, pic: A[k].i, verdict, from: l.img ? 'image' : 'preview', alikeOf: p.name });
        break;
      }
    }
    freePic(pic);
    await breathe();
  }
  for (let k = 0; k < A.length; k++) {
    PP_STATS.add('keep.alike.checked');
    if (found[k].length) PP_STATS.add('keep.alike.found');
    try { await FC.ingest(A[k], found[k], (BY[job.kind] || 'a search') + ' (look-alike frame)', { shared: true }); } catch (e) { console.warn('PageProof look-alike frame:', e); }
  }
  p.alikeDone = true;
}
// Keep searching runs a search in a background window: when it's finished, tell that window and close.
let autoClosing = false;
function autoDone() {
  if (!job || !(job.auto || BG) || autoClosing || R.running) return;
  if (job.alike && job.alike.length && job.pics.some(p => p.ingested && !p.alikeDone)) return;
  if (!job.pics.every(p => p.ingested || picDone(p) && !job.engines.some(e => p.runs[e].state === 'done'))) return;
  if (job.pics.some(p => !p.ingested && job.engines.some(e => p.runs[e].state === 'done'))) return;
  autoClosing = true;
  saveJob(true).finally(() => {
    // In the pinned tab: tell it this search is finished, so it closes the frame and starts the next.
    if (BG) { api.runtime.sendMessage({ type: 'fcBgDone', job: job.id }).catch(() => {}); return; }
    api.runtime.sendMessage({ type: 'fcAutoDone', job: job.id, found: job.pics.reduce((a, p) => a + p.links.filter(isSame).length, 0) }).catch(() => {});
    setTimeout(() => window.close(), 300);
  });
}
// Give up on tabs that never answer.
CLOCK.every(1000, () => {
  const now = Date.now();
  for (const t of [...R.tasks.values()]) if (!t.captcha && now > t.deadline) finishTask(t, 'fail', 'No answer from the page. Open the tab to look at it yourself.');
});

// ---------- what to show ----------
function sizeNote(p, l) {
  if (!l.w || !l.h) return { text: '' };
  const r1 = p.w / p.h, r2 = l.w / l.h, area = (l.w * l.h) / (p.w * p.h);
  if (Math.abs(r1 - r2) / r1 > 0.06) return { text: 'cropped', strong: true };
  if (area > 1.15) return { text: 'bigger than yours', strong: true };
  if (area < 0.85) return { text: 'smaller' };
  return { text: 'same size' };
}
const isSame = l => verdict(l) === 'same';
function linkScore(l) { return VERDICT[verdict(l)].rank * 1000 + (l.isNew ? 500 : 0) + (l.pct > 0 ? l.pct : 0); }

const isRejected = (p, l) => RS_REJECT.is(l.url, p.name);
// Keep the numbers of links you said were not a match, to tune the checker from later.
async function learnFrom(l, was) {
  try {
    const st = (await api.storage.local.get('rsLearn')).rsLearn || [];
    st.push({ pct: l.pct, inl: l.inl, tiles: l.tiles, str: l.str, mid: l.mid, was, site: l.site, at: Date.now() });
    await api.storage.local.set({ rsLearn: st.slice(-500) });
  } catch (e) { /* not important */ }
}
function visibleLinks(p, opts = {}) {
  return p.links.filter(l => {
    if (isRejected(p, l) !== (R.filter === 'rejected' && !opts.raw)) return false;
    const hidden = RS_LISTS.isHidden(l.site, l.url);
    if (hidden && !(opts.withHidden ?? R.showHidden)) return false;
    if (opts.raw) return true;
    const v = verdict(l);
    if (R.filter === 'new' && !(l.isNew && v !== 'no')) return false;
    if (R.filter === 'same' && v !== 'same' && v !== 'pending') return false;
    if (R.filter === 'maybe' && v !== 'maybe') return false;
    if (R.filter === 'cant' && v !== 'cant') return false;
    if (R.filter === 'no' && v !== 'no') return false;
    if (R.engineFilter.size && !l.engines.some(e => R.engineFilter.has(e))) return false;
    if (R.text) { const q = R.text.toLowerCase(); if (!(l.site + ' ' + l.title + ' ' + l.url).toLowerCase().includes(q)) return false; }
    return true;
  });
}
const shownCount = p => visibleLinks(p, { raw: true, withHidden: false }).length;
const sameCount = p => visibleLinks(p, { raw: true, withHidden: false }).filter(isSame).length;
const checking = p => p.links.some(l => verdict(l) === 'pending' && !RS_LISTS.isHidden(l.site, l.url));

// Is this picture ready to review? (searched, and every link found has been checked)
function checkLine(p) {
  if (!picDone(p)) return null;
  const left = p.links.filter(l => verdict(l) === 'pending' && !RS_LISTS.isHidden(l.site, l.url) && !isRejected(p, l)).length;
  return left ? h('span', { class: 'ck busy', text: '⏳ Checking matches · ' + left + ' left' })
    : h('span', { class: 'ck ready', text: '✓ All checked · ready to review' });
}
function statusLine(p) {
  const bits = job.engines.map(e => {
    const r = p.runs[e], n = ENGINES[e].short;
    if (r.state === 'done') return n + ' ' + p.links.filter(l => l.engines.includes(e) && !RS_LISTS.isHidden(l.site, l.url)).length;
    if (r.state === 'go') return n + '…';
    if (r.state === 'captcha') return n + ' check!';
    if (r.state === 'wait') return n + ' waiting';
    return n + ' ✕';
  });
  return bits.join(' · ');
}

// A link the checker threw out (Different photo / Can't check). These are NOT added to All copies
// found; "It is a copy" rescues one that really is your photo.
// A found link's picture. One the site won't hand over is remembered, so the page's refresh every
// few seconds shows the grey box straight away instead of trying again (which flashed a shadow).
const BAD_THUMBS = new Set();
function thumbOf(l, imgClass, boxClass) {
  const src = l.thumb || l.img;
  if (!src || BAD_THUMBS.has(src)) return h('div', { class: boxClass });
  return h('img', { class: imgClass, src, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer', onerror: e => { BAD_THUMBS.add(src); e.target.replaceWith(h('div', { class: boxClass })); } });
}
function rowFor(p, l) {
  const v = verdict(l);
  const why = userNo(l) ? 'You: not a match' : cardOf(l) ? 'Only in a link preview' : v === 'cant' ? (l.pct === null ? 'Not checked' : !l.thumb && !l.img ? 'No picture' : 'Picture blocked') : l.second === 'out' ? 'Different on a closer look' : 'Different photo';
  return h('div', { class: 'row' },
    thumbOf(l, 'th', 'th'),
    h('div', { class: 't' }, h('a', { href: l.url, target: '_blank', rel: 'noreferrer', text: l.title || l.url, title: l.title || l.url }),
      h('small', { text: l.site + ' · ' + l.url })),
    h('div', { class: 'mt' }, h('span', { class: 'pct ' + (v === 'cant' ? 'no' : 'lo'),
      title: v === 'cant' ? (!l.thumb && !l.img ? 'The search site showed no picture for this link, and their page could not be read (Facebook and X often hide posts from anyone not signed in). Open it to look yourself.' : 'The site would not let PageProof download its picture, so it could not be compared. Open it to look yourself.') : 'The two pictures did not line up detail for detail.',
      text: why }), h('small', {}, l.w ? l.w + ' × ' + l.h : 'size unknown')),
    h('div', { class: 'tags' },
      l.engines.map(e => h('span', { class: 'tag ' + e, text: ENGINES[e].short })),
      // 4.47: Google listed it under "Exact matches" and it was checked twice, both pictures at full size.
      l.exact ? h('span', { class: 'tag exact', text: 'Google said exact', title: l.second === 'exactNo' ? 'Google listed this under "Exact matches". PageProof checked it a second time at full size and still found a different photo.' : 'Google listed this under "Exact matches".' }) : null,
      h('span', { class: 'act' }, h('button', { text: 'Open', onclick: () => openTab(l.url) }),
        v !== 'cant' ? h('button', { text: '🔀 Compare', title: 'Lay this picture over yours on the Compare page', onclick: () => compareLink(p, l) }) : null,
        h('button', { class: 'evid', text: '＋ It is a copy', title: 'The checker got it wrong: add this link to All copies found for this photo',
          onclick: async e => {
            e.target.disabled = true;
            try {
              if (userNo(l)) await RS_REJECT.remove(l.url, p.name, 'nomatch');
              await FC.rescue(p, { ...l, verdict: 'maybe' }, BY[job.kind] || 'a search');
              l.rescued = true; saveJob(); renderResults();
            } catch (err) { e.target.disabled = false; banner([h('span', { text: 'Could not add it: ' + (err && err.message || err) })]); }
          } }))));
}

// ---- Search results helpers (Batch 9: a square per photo, time left, photo facts, What's happening)
R.facts = new Map();
function fmtDur(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return 'under a minute';
  if (m < 60) return m + ' min';
  return Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '');
}
const clock = t => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
// How long the search has taken, and (while it runs) about how long is left, from when photos started and finished.
function searchPace(done, total) {
  const starts = job.pics.map(q => q.t0).filter(Boolean), ends = job.pics.map(q => q.t1).filter(Boolean);
  if (!starts.length) return null;
  const first = Math.min(...starts);
  const per = done ? (Date.now() - first) / done : 0;
  return { first, per, left: done && done < total ? per * (total - done) : 0, took: ends.length ? Math.max(...ends) - first : 0 };
}
function sqState(q, kept) {
  if (picBusy(q)) return ['go', 'Searching'];
  if (!picDone(q)) return ['wait', 'Waiting'];
  const n = sameCount(q);
  if (n) return ['same', n + ' same' + (kept > n ? ' · ' + (kept - n) + ' maybe' : '')];
  if (kept) return ['maybe', kept + ' maybe'];
  if (job.engines.some(e => byYou(q.runs[e]))) return ['bad', 'Stopped by you'];
  if (job.engines.some(e => ['skip', 'fail'].includes(q.runs[e].state))) return ['bad', 'Skipped'];
  return ['none', 'No copies'];
}
function pickPhoto(i) {
  R.sel = i; renderResults(); scoreAll();
  const d = $('selcard'); if (d && d.scrollIntoView) d.scrollIntoView({ block: 'nearest' });
}
// The photo's facts from Your photos (client, folder, how often searched, copies). Read once per
// photo, and again when that photo finishes (its counts change).
function loadFacts(p) {
  R.facts.set(p.i, { t1: p.t1, loading: true });
  if (typeof FC === 'undefined' || !p.fcId) return;
  (async () => {
    const ph = await FC.photoForPic(p);
    const f = { t1: p.t1, client: ph.client || '', path: await FC.pathOf(ph).catch(() => ''), searches: ph.searches || 0,
      last: ph.lastSearched ? new Date(ph.lastSearched).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '', copies: ph.copies || 0, stolen: ph.stolen || 0 };
    R.facts.set(p.i, f); renderSoon();
  })().catch(() => {});
}
// What's happening: the search so far, newest first, from the times saved with each photo and site.
function feedCard(busy, done, total) {
  const ev = [[Date.parse(job.created), 'Search started', plural(total, 'photo') + ' on ' + plural(job.engines.length, 'site'), 'acc']];
  for (const q of job.pics) {
    const n = 'photo ' + (q.i + 1);
    if (q.t0) ev.push([q.t0, 'Searching ' + n, q.name, '']);
    for (const e of job.engines) {
      const r = q.runs[e];
      if (!r.at) continue;
      if (r.state === 'done') ev.push([r.at, ENGINES[e].short + ': ' + plural(q.links.filter(l => l.engines.includes(e)).length, 'link') + ' for ' + n, '', '']);
      else if (byYou(r)) ev.push([r.at, ENGINES[e].short + ' stopped by you on ' + n, '', '']);
      else if (['skip', 'fail'].includes(r.state)) ev.push([r.at, ENGINES[e].short + ' skipped ' + n, r.why || '', 'warn']);
    }
    if (q.t1) {
      const vis = visibleLinks(q, { raw: true, withHidden: false });
      const k = vis.filter(l => ['same', 'maybe'].includes(verdict(l))), ns = k.filter(isSame).length, pend = vis.filter(l => verdict(l) === 'pending').length;
      ev.push([q.t1 + 1, pend && !k.length ? 'Photo ' + (q.i + 1) + ': checking ' + plural(pend, 'picture') + ' found' : k.length ? 'Photo ' + (q.i + 1) + ': ' + (ns ? ns + ' same' + (k.length > ns ? ', ' : '') : '') + (k.length > ns ? (k.length - ns) + ' maybe' : '') : 'Photo ' + (q.i + 1) + ': nothing found',
        k.length ? 'Sent to Copies found' : pend ? '' : 'Every site searched', k.length ? 'hit' : '']);
    }
  }
  ev.sort((a, b) => b[0] - a[0]);
  const pc = searchPace(done, total);
  const foot = busy && pc && pc.left ? 'About ' + fmtDur(pc.left) + ' left · ' + fmtDur(pc.per) + ' a photo' : !busy && pc && pc.took ? 'Finished in ' + fmtDur(pc.took) : busy ? 'The time left shows once the first photo is done.' : '';
  return h('section', { class: 'card nfeed', 'aria-label': 'What\'s happening' }, h('h2', { class: 'kh2', text: 'What\'s happening' }),
    h('div', { class: 'ntl' }, ev.slice(0, 14).map(([t, a, b, c]) => h('div', { class: 'nev ' + c }, h('span', { class: 'nt1', text: clock(t) }), h('i'), kn1(a, b || null)))),
    foot ? h('p', { class: 'kfoot', text: foot }) : null);
}

function renderResults() {
  if (!job) return;
  plain(true, true);
  const busy = R.running || (R.watch && !job.finished);
  const total = job.pics.length, done = job.pics.filter(picDone).length, nBusy = job.pics.filter(picBusy).length;
  const when = new Date(job.created);
  const whenTxt = (when.toDateString() === new Date().toDateString() ? '' : when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ') + when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const left = job.pics.filter(p => job.engines.some(e => ['wait', 'skip', 'fail'].includes(p.runs[e].state))).length;
  const keptOf = q => visibleLinks(q, { raw: true, withHidden: false }).filter(l => ['same', 'maybe'].includes(verdict(l))).length;
  const outOf = q => visibleLinks(q, { raw: true, withHidden: false }).filter(l => ['no', 'cant'].includes(verdict(l))).length;
  const totalKept = job.pics.reduce((a, q) => a + keptOf(q), 0), totalOut = job.pics.reduce((a, q) => a + outOf(q), 0);
  const allIn = !R.running && job.pics.every(q => q.ingested || !job.engines.some(e => q.runs[e].state === 'done'));
  const stillChecking = job.pics.some(checking);
  // ---- the title and its buttons
  const stop = () => {
    if (R.watch) { api.runtime.sendMessage({ type: 'ppBgStop', job: job.id }).catch(() => {}); banner([h('b', { text: 'Stopping… ' }), 'The searches already running finish their page, then it stops.'], 'info'); return; }
    R.stop = true; job.stoppedAt = new Date().toISOString(); for (const t of [...R.tasks.values()]) finishTask(t, 'skip', STOPPED);
  };
  const rest = () => {
    for (const p of job.pics) for (const e of job.engines) if (['skip', 'fail'].includes(p.runs[e].state)) p.runs[e].state = 'wait';
    // A pinned-tab search: back into the pinned tab's line, and this page watches it again.
    if (job.bg && !BG) { delete job.finished; saveJob(true).then(() => bgQueue(job.id)).then(() => watch()); return; }
    runJob();
  };
  const notYet = busy ? 'Ready when the search is done' : '';
  const head = nhead('All searches', busy ? 'Searching ' + plural(total, 'photo') : plural(total, 'photo') + ' searched',
    h('div', { class: 'ncmd' },
      h('a', { class: 'nbtn acc', id: 'reviewBtn', href: appUrl('review'), onclick: e => goApp('review', e) }, ni('review'), 'Review new copies'),
      h('a', { class: 'nbtn', href: appUrl('found'), onclick: e => goApp('found', e) }, ni('copies'), 'Copies found'),
      h('span', { class: 'cmdsep' }),
      nbtn('pdf', 'PDF report', '', { id: 'pdfBtn', disabled: busy, title: notYet, onclick: savePdf }), nbtn('sheet', 'Spreadsheet', '', { id: 'csvBtn', disabled: busy, title: notYet, onclick: saveCsv }),
      busy || left ? h('span', { class: 'cmdsep' }) : null,
      busy ? nbtn('stop', 'Stop', 'stop', { id: 'stopBtn', title: 'Stop and keep the results so far', onclick: stop }) : left ? nbtn('again', 'Search the rest (' + left + ')', '', { id: 'restBtn', onclick: rest }) : null));
  // ---- info bars
  const bars = [];
  if (busy && job.bg && !R.barOff) bars.push(h('div', { class: 'kbar info', id: 'bgBar', role: 'status' }, h('span', { class: 'nbi' }, ni('pin', 20)),
    job.started ? h('div', {}, h('b', { text: 'This search runs in the small pinned PageProof tab' }), h('span', { text: 'You can close this page and keep working. Started ' + whenTxt + '.' }))
      : h('div', {}, h('b', { text: 'Waiting for the small pinned PageProof tab to start this search' }), h('span', { text: 'It runs one big search at a time.' })),
    h('span', { class: 'sp' }), job.started ? null : nbtn('play', 'Start it now', '', { onclick: () => api.runtime.sendMessage({ type: 'fcBgStart' }).catch(() => {}) }),
    h('button', { class: 'kx', title: 'Close', 'aria-label': 'Close', onclick: () => { R.barOff = true; renderResults(); } }, ni('x', 12))));
  if (EASE.on && (R.running || R.scoring)) bars.push(h('div', { class: 'kbar warn ease', role: 'status' }, h('span', { class: 'nbi' }, ni('info', 20)),
    h('div', {}, h('b', { text: 'PageProof slowed down' }), h('span', { text: EASE.why + ', so it does one photo check and one search tab at a time. Full speed again when the computer calms down.' }))));
  // ---- one progress card: ring, numbers, search site lights
  const pc = searchPace(done, total);
  const lights = job.engines.map(e => {
    const skipped = job.pics.some(p => ['skip', 'fail'].includes(p.runs[e].state));
    if (R.gaveUp[e]) return [e, 'bad', 'Skipped'];
    if (R.paused[e] || job.pics.some(p => p.runs[e].state === 'captcha')) return [e, 'warn', 'Robot check'];
    if (job.pics.every(p => !['wait', 'go', 'captcha'].includes(p.runs[e].state))) return [e, skipped ? 'warn' : 'ok', skipped ? 'Some skipped' : 'Done'];
    return job.pics.some(p => p.runs[e].state === 'go') ? [e, 'go', 'Searching'] : [e, 'wait', 'Waiting'];
  });
  const f = total ? done / total : 0, rr = 34, cc = 2 * Math.PI * rr;
  const ringEl = h('div', { class: 'nring', role: 'img', 'aria-label': done + ' of ' + total + ' photos done' });
  ringEl.innerHTML = `<svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="${rr}" fill="none" stroke="var(--sunk)" stroke-width="8"/><circle cx="42" cy="42" r="${rr}" fill="none" stroke="var(--accent)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(cc * f).toFixed(1)} ${cc.toFixed(1)}" transform="rotate(-90 42 42)"/></svg><b>${Math.round(f * 100)}%</b>`;
  const num = (c, ic, n, label, id) => h('div', { class: 'nnum', id }, nsq(c, ic), h('span', { class: 'kn1' }, h('b', { class: 'num', text: n }), h('span', { text: label })));
  const prog = h('section', { class: 'card nprog', id: 'progCard', 'aria-label': 'How far the search is' }, ringEl,
    h('div', { class: 'kn1 nbig' }, h('b', { text: done + ' of ' + total + ' photos done' }),
      h('span', { text: busy ? nBusy + ' searching · ' + (total - done - nBusy) + ' waiting' : whenTxt + (stillChecking ? ' · still checking matches…' : allIn ? ' · the copies are in Copies found' : '') })),
    num('#C42B1C', 'copies', totalKept.toLocaleString(), 'sent to Copies found', 'numKept'),
    num('#6E6E6E', 'clear', totalOut.toLocaleString(), 'thrown out by the checker', 'numOut'),
    busy && pc && pc.left ? num('#8764B8', 'clock', fmtDur(pc.left), 'left · ' + fmtDur(pc.per) + ' a photo', 'numTime')
      : !busy && pc && pc.took && done >= total ? num('#8764B8', 'clock', fmtDur(pc.took), 'start to finish', 'numTime') : null,
    h('div', { class: 'nlights', role: 'list', 'aria-label': 'Search sites' }, lights.map(([e, c, t]) => h('div', { class: 'nlight', role: 'listitem' }, nbadge(e), kn1(ENGINES[e].short, t), h('i', { class: c })))));
  // ---- every photo in the search, as real pictures
  const used = new Set(job.pics.map(q => sqState(q, keptOf(q))[0]));
  const film = h('section', { class: 'card nfilm', 'aria-label': 'Photos in this search' },
    h('div', { class: 'nfh' }, h('h2', { class: 'kh2', text: 'Photos in this search' }), h('span', { class: 'sp' }),
      [['same', 'Same photo'], ['maybe', 'Maybe'], ['none', 'No copies'], ['go', 'Searching'], ['wait', 'Waiting'], ['bad', 'Skipped']].filter(([k]) => k !== 'bad' || used.has('bad')).map(([k, t]) => h('span', { class: 'nkey' }, h('i', { class: 's-' + k }), t))),
    h('div', { class: 'nstrip' }, job.pics.map(q => {
      const [k, t] = sqState(q, keptOf(q)), cap = runList(q).some(r => r.state === 'captcha');
      return h('button', { class: 'nfp s-' + k + (q.i === R.sel ? ' on' : ''), 'data-i': q.i, 'aria-pressed': String(q.i === R.sel), title: (q.i + 1) + '. ' + q.name + ': ' + t + ' · ' + statusLine(q), onclick: () => pickPhoto(q.i) },
        nthumb(q.thumb), h('span', { class: 'nfn', text: q.i + 1 }), h('span', { class: 'nfs' }, h('i'), cap ? 'Robot check' : t + (picDone(q) && checking(q) ? '…' : '')));
    })));
  // ---- the picked photo
  const p = job.pics[R.sel];
  const all = visibleLinks(p, { raw: true, withHidden: false });
  const cnt = k => all.filter(l => verdict(l) === k).length;
  const nSame = cnt('same'), nMaybe = cnt('maybe'), nPend = cnt('pending'), kept = nSame + nMaybe;
  const out = all.filter(l => ['no', 'cant'].includes(verdict(l))).sort((a, b) => linkScore(b) - linkScore(a));
  const nNo = out.filter(l => verdict(l) === 'no').length;
  const searching = !picDone(p);
  const tabBtn = e => {
    const r = p.runs[e];
    if (!r || (!r.tabId && !r.pageUrl)) return null;
    return nbtn('open', 'Open tab', 'sm', { title: 'Open the ' + ENGINES[e].short + ' search for this photo', onclick: async () => {
      try { if (r.tabId) { await api.tabs.update(r.tabId, { active: true }); return; } } catch (err) { /* closed */ }
      if (r.pageUrl) openTab(r.pageUrl);
    } });
  };
  const stoppedE = job.engines.filter(e => byYou(p.runs[e])).map(e => ENGINES[e].short);
  const problems = job.engines.map(e => p.runs[e]).filter(r => r.why && r.state !== 'done' && !byYou(r)).map(r => r.why);
  if (stoppedE.length) problems.unshift('You stopped this search, so ' + stoppedE.join(' and ') + ' did not search this photo. ' + (job.engines.some(e => p.runs[e].state === 'done') ? 'The links the other sites found are still checked. ' : '') + 'Press "Search the rest" to search it on ' + stoppedE.join(' and ') + ' too.');
  const good = kept && !searching && !nPend;
  const state = searching ? 'Searching… ' + statusLine(p)
    : stoppedE.length && !kept && !nPend ? 'Not finished: stopped by you'
    : nPend ? (stoppedE.length ? 'Stopped by you. ' : '') + 'Checking ' + plural(nPend, 'picture') + ' found against yours…'
      : kept ? plural(kept, 'copy', 'copies') + ' ' + (p.ingested ? 'sent to' : 'going to') + ' Copies found'
        : 'No copies found for this photo';
  const wasOpen = $('thrown') ? $('thrown').open : false;
  let facts = R.facts.get(p.i);
  if (!facts || (facts.t1 !== p.t1 && !facts.loading)) { loadFacts(p); facts = R.facts.get(p.i); }
  const fact = (k, v) => v || v === 0 ? [h('dt', { text: k }), h('dd', { text: String(v) })] : [];
  const keptLinks = all.filter(l => ['same', 'maybe'].includes(verdict(l))).sort((a, b) => linkScore(b) - linkScore(a));
  const sel = h('section', { class: 'card nsel', id: 'selcard' },
    h('div', { class: 'nsh' }, nthumb(p.thumb, 'nbigp'), h('div', { class: 'kn1 nsm' },
      h('h2', { text: (p.i + 1) + '. ' + p.name }),
      h('span', { class: 'nok' + (good ? ' ok' : '') }, good ? ni('check') : null, state, good ? h('span', { class: 'kfaint', text: ' · ' + nSame + ' same photo, ' + nMaybe + ' maybe' }) : null),
      h('dl', { class: 'nfacts' }, ...fact('Client', facts && facts.client), ...fact('Your file', p.w.toLocaleString() + ' × ' + p.h.toLocaleString() + (p.size ? ' · ' + Math.round(p.size / 1024).toLocaleString() + ' KB' : '')),
        ...fact('Folder', facts && facts.path), ...fact('Searched before', facts && facts.searches ? plural(facts.searches, 'time') + (facts.last ? ' · last ' + facts.last : '') : null),
        ...fact('In Copies found', facts && facts.copies ? plural(facts.copies, 'copy', 'copies') + (facts.stolen ? ' · ' + facts.stolen + ' Stolen' : '') : null)))),
    problems.length ? h('p', { class: 'nproblem', text: [...new Set(problems)].join(' ') }) : null,
    // ---- one small card per search site
    h('div', { class: 'nengs' }, job.engines.map(e => {
      const mine = all.filter(l => l.engines.includes(e)), r = p.runs[e];
      const ns = mine.filter(l => verdict(l) === 'same').length, nm = mine.filter(l => verdict(l) === 'maybe').length, no = mine.filter(l => ['no', 'cant'].includes(verdict(l))).length;
      const st = byYou(r) ? 'Stopped by you' : { done: '', go: 'Searching', captcha: 'Robot check', wait: 'Waiting', skip: 'Skipped', fail: 'Failed' }[r.state] || '';
      return h('div', { class: 'neng', title: ns + ' same · ' + nm + ' maybe · ' + no + ' thrown out' }, nbadge(e),
        kn1(h('span', {}, ENGINES[e].short, st ? h('span', { class: 'ktag' + (['skip', 'fail', 'captcha'].includes(r.state) ? ' warn' : ''), text: st }) : null), r.state === 'done' ? mine.length + ' found · ' + (ns + nm) + ' kept' : mine.length ? mine.length + ' found so far' : 'Nothing yet'),
        tabBtn(e),
        h('span', { class: 'nbar' }, h('b', { style: 'flex:' + ns }), h('em', { style: 'flex:' + nm }), h('u', { style: 'flex:' + (no || (mine.length ? 0 : 1)) })));
    })),
    // ---- the copies it found
    kept ? h('div', { class: 'nfindsbox' }, h('h2', { class: 'kh2' }, 'Copies it found ', h('span', { class: 'kfaint', text: kept }),
      h('a', { href: appUrl('found'), onclick: e => goApp('found', e), text: 'Review them in Copies found ›' })),
      h('div', { class: 'nfinds' }, keptLinks.slice(0, 12).map(l => {
        const v = verdict(l);
        return h('a', { class: 'nfind', href: l.url, target: '_blank', rel: 'noreferrer', title: l.title || l.url },
          thumbOf(l, '', 'ph'), kn1(l.site, l.title || l.url),
          h('span', { class: 'ktag ' + (v === 'same' ? 'bad' : 'warn'), text: (v === 'same' ? 'Same photo' : 'Maybe') + (typeof l.pct === 'number' ? ' · ' + Math.round(l.pct) + '%' : '') }));
      })),
      keptLinks.length > 12 ? h('p', { class: 'kfaint', style: 'margin:10px 0 0', text: 'And ' + (keptLinks.length - 12) + ' more in Copies found.' }) : null) : null,
    // ---- thrown out, folded
    h('details', { class: 'nthrown', id: 'thrown', open: wasOpen },
      h('summary', { class: 'nexp' }, nsq('#6E6E6E', 'clear', 32),
        h('span', { class: 'kn1' }, h('b', {}, 'Thrown out ', h('span', { class: 'kfaint', text: out.length })), h('span', { text: (out.length ? 'Different photo ' + nNo + ' · Can\'t check ' + (out.length - nNo) + '. ' : '') + 'Not added to Copies found. Open to rescue one with "It is a copy".' })), ni('dn', 14)),
      h('div', { class: 'in' }, out.length ? h('div', { class: 'list' }, h('div', { class: 'site' }, out.map(l => rowFor(p, l)))) : h('div', { class: 'none', text: searching || nPend ? 'Nothing thrown out yet.' : 'Nothing was thrown out for this photo.' }))));
  const feed = feedCard(busy, done, total);
  // The page redraws every few seconds while a search runs: keep where the thrown-out list was
  // scrolled to, so scrolling isn't thrown back to the top.
  const oldIn = document.querySelector('#thrown .list');
  const keepIn = oldIn ? oldIn.scrollTop : 0, pageY = window.scrollY;
  $('main').replaceChildren(h('div', { class: 'nnew nres' }, head, bars, prog, total > 1 ? film : null, h('div', { class: 'nresgrid' }, sel, feed)));
  const newIn = document.querySelector('#thrown .list'); if (newIn && keepIn) newIn.scrollTop = keepIn;
  if (window.scrollY !== pageY) window.scrollTo(0, pageY);
}

// ---------- the Evidence report (one PDF for one use) ----------
// Made by evidence.js, the same report as the copy details on All copies found.
async function saveSighting(p, l) {
  const caseNo = await PP_EVIDENCE.ask();
  if (caseNo === null) return;
  banner([h('b', { text: 'Making the evidence report…' })], 'info');
  try {
    const ph = await FC.photoForPic(p);
    const st = await api.storage.local.get('lastCase');
    const r = await PP_EVIDENCE.make({ blob: p.blob, name: p.name, w: p.w, h: p.h, hash: p.hash, client: ph.client || '', path: await FC.pathOf(ph), reg: await FC.regFor(ph) },
      { ...l, match: verdict(l), by: job.kind === 'keep' ? 'Keep searching' : job.kind === 'fifty' ? 'today\'s 50' : 'a search', firstSeen: l.firstSeen || job.created, use: FC.USE[FC.useOf(l)][0] },
      { caseNo, collector: (st.lastCase || {}).collector || '', owner: await FC.ownerFor(l.site) });
    download(r.blob, r.name);
    await FC.logReport({ id: r.id, file: r.name, url: l.url, site: l.site, photo: p.name, caseNo });
    banner(null);
  } catch (e) { banner([h('b', { text: 'The report could not be made: ' }), String(e && e.message || e)], 'bad'); }
}
async function compareLink(p, l) {
  let blob = null, src = '';
  for (const u of [l.img, l.thumb].filter(Boolean)) {
    try { const r = await fetch(u, { credentials: 'omit' }); if (r.ok) { blob = await r.blob(); src = u; break; } } catch (e) { /* next */ }
  }
  if (!blob) { alert('That picture could not be downloaded. Open the page and save the picture instead.'); return; }
  await PP_DB.put({ id: 'compare-rs', a: { blob: p.blob, name: p.name }, b: { blob, name: l.site + ' copy', src: src.startsWith('data:') ? l.url : src } });
  openTab(api.runtime.getURL('compare.html?from=revsearch'));
}

// Opens the page in a new tab and captures it (the evidence pack opens when it's done).
async function captureLinks(urls) {
  for (const url of urls.slice(0, 1)) { try { await api.runtime.sendMessage({ type: 'captureUrl', url }); } catch (e) { openTab(url); } }
}

// ---------- saving the results ----------
const stamp = () => new Date(job.created).toISOString().slice(0, 16).replace(/[:T]/g, '-');
function saveCsv() {
  const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const rows = [['Picture #', 'Picture', 'Site', 'Page title', 'Link', 'Found by', 'Same photo?', '% lines up', 'Matching details', 'Copy size', 'Size note', 'New', 'Allowed site', 'First found', 'Searched']];
  for (const p of job.pics) {
    for (const l of visibleLinks(p, { raw: true, withHidden: false }).sort((a, b) => linkScore(b) - linkScore(a))) {
      rows.push([p.i + 1, p.name, l.site, l.title, l.url, l.engines.map(e => ENGINES[e].short).join(' + '), VERDICT[verdict(l)].tag,
        l.pct >= 0 && l.sv === SCORE_VERSION ? l.pct + '%' : '', l.inl ?? '', l.w ? l.w + ' x ' + l.h : '', sizeNote(p, l).text, l.isNew ? 'New' : '', RS_LISTS.isAllowed(l.site, l.url) ? 'Allowed' : '',
        l.firstSeen || RS_UTIL.today(), job.created]);
    }
  }
  download(new Blob(['﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv' }), 'PageProof_reverse-search_' + stamp() + '.csv');
}

async function savePdf() {
  const W = 1240, H = 1754, M = 70;
  const pages = [];
  let c, x, y;
  const newPage = () => {
    c = h('canvas', { width: W, height: H }); x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#0f172a'; x.fillRect(0, 0, W, 64);
    x.fillStyle = '#fff'; x.font = 'bold 26px system-ui, sans-serif'; x.fillText('PageProof reverse image search', M, 42);
    x.font = '18px system-ui, sans-serif'; x.textAlign = 'right';
    x.fillText(new Date(job.created).toLocaleString() + '  ·  page ' + (pages.length + 1), W - M, 42); x.textAlign = 'left';
    pages.push(c); y = 110;
  };
  const fit = (t, maxW) => { t = String(t || ''); if (x.measureText(t).width <= maxW) return t; while (t.length > 3 && x.measureText(t + '…').width > maxW) t = t.slice(0, -1); return t + '…'; };
  const loadImg = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  newPage();
  x.fillStyle = '#334155'; x.font = '20px system-ui, sans-serif';
  x.fillText('Searched on ' + job.engines.map(e => ENGINES[e].name).join(', ') + '. ' + plural(job.pics.length, 'picture') + '. Hidden sites are left out.', M, y); y += 30;
  x.fillText('Each picture found was downloaded and lined up with the original. Different photos are left out.', M, y); y += 30;
  x.fillText('% = how much of the area the two share lines up detail for detail (a guide; check by eye).', M, y); y += 40;
  for (const p of job.pics) {
    const found = visibleLinks(p, { raw: true, withHidden: false });
    const links = found.filter(l => ['same', 'maybe', 'cant'].includes(verdict(l))).sort((a, b) => linkScore(b) - linkScore(a));
    if (y > H - 260) newPage();
    const img = await loadImg(p.thumb);
    if (img) { const s = Math.min(120 / img.width, 120 / img.height); x.drawImage(img, M, y, img.width * s, img.height * s); }
    x.fillStyle = '#0f172a'; x.font = 'bold 26px system-ui, sans-serif'; x.fillText(fit((p.i + 1) + '. ' + p.name, W - 2 * M - 140), M + 140, y + 30);
    x.font = '19px system-ui, sans-serif'; x.fillStyle = '#475569';
    x.fillText(p.w + ' × ' + p.h + ' · ' + plural(links.filter(isSame).length, 'link') + ' with the same photo · ' + links.filter(l => l.isNew && isSame(l)).length + ' new · ' + found.filter(l => verdict(l) === 'no').length + ' different photos left out', M + 140, y + 62);
    x.fillText('SHA-256 ' + p.hash.slice(0, 32) + '…', M + 140, y + 90);
    y += 140;
    if (!links.length) { x.fillText('No matches found.', M, y); y += 40; }
    for (const l of links) {
      if (y > H - 90) newPage();
      x.fillStyle = l.isNew ? '#92400e' : '#0f172a'; x.font = 'bold 19px system-ui, sans-serif';
      x.fillText(fit((l.isNew ? '[NEW] ' : '') + (RS_LISTS.isAllowed(l.site, l.url) ? '[ALLOWED] ' : '') + (l.title || l.site), W - 2 * M - 260), M, y);
      x.textAlign = 'right'; x.font = 'bold 19px system-ui, sans-serif';
      const v = verdict(l);
      x.fillStyle = v === 'same' ? '#15803d' : v === 'maybe' ? '#b45309' : '#64748b';
      x.fillText(VERDICT[v].tag + (l.pct >= 0 && l.sv === SCORE_VERSION ? ' · ' + l.pct + '%' : ''), W - M, y);
      x.textAlign = 'left'; x.font = '16px system-ui, sans-serif'; x.fillStyle = '#2563eb';
      x.fillText(fit(l.url, W - 2 * M), M, y + 24);
      x.fillStyle = '#64748b';
      const sz = sizeNote(p, l);
      x.fillText(fit(['found by ' + l.engines.map(e => ENGINES[e].short).join(' + '), l.w ? l.w + ' × ' + l.h + (sz.text ? ' (' + sz.text + ')' : '') : '', l.firstSeen ? 'first found ' + RS_UTIL.niceDate(l.firstSeen) : ''].filter(Boolean).join(' · '), W - 2 * M), M, y + 46);
      y += 74;
    }
    y += 20;
  }
  download(makePdf(await PP_REPORT.pdfPages(pages), { title: 'PageProof reverse image search', subject: plural(job.pics.length, 'picture') + ' searched ' + job.created }), 'PageProof_reverse-search_' + stamp() + '.pdf');
}

// Closes search tabs left over from an earlier copy of this results page (before a reload).
async function closeOldTabs() {
  // Only tabs marked in this browser session (tab numbers start again after a restart, so an old
  // number could now be one of your own tabs).
  const ids = new Set();
  try {
    if (api.storage.session) {
      const all = await api.storage.session.get(null);
      for (const [k, v] of Object.entries(all)) if (k.startsWith('rsTab:') && v === job.id) ids.add(+k.slice(6));
    }
  } catch (e) { /* no session storage */ }
  for (const id of ids) {
    if (R.tasks.has(id)) continue;
    untagTab(id);
    try { const t = await api.tabs.get(id); await api.tabs.remove(id); } catch (e) { /* already closed */ }
  }
}
// Watching a search that runs in the pinned tab: read it again every 2 seconds. When it has
// finished and left the pinned tab's line, this page becomes an ordinary results page.
let watchTimer = null;
function watch() {
  R.watch = true;
  clearInterval(watchTimer);
  const look = async () => {
    const fresh = await RS_DB.get('jobs', job.id).catch(() => null);
    if (!fresh) return;
    const sel = R.sel; job = fresh; R.sel = Math.min(sel, job.pics.length - 1);
    for (const p of job.pics) for (const l of p.links) l.pic = p.i;
    const capt = [];
    for (const p of job.pics) for (const e of job.engines) if (p.runs[e].state === 'captcha' && p.runs[e].tabId) capt.push([e, p.runs[e].tabId]);
    if (capt.length) {
      const [e, tabId] = capt[0];
      banner([h('span', {}, h('b', { text: ENGINES[e].short + ' wants a quick check. ' }), 'Tick the box in the ' + ENGINES[e].short + ' tab and the search carries on by itself. The other sites keep searching meanwhile.'),
        h('span', { class: 'sp' }), h('button', { text: 'Show me the tab', onclick: async () => { try { await ppShowTab(tabId); } catch (err) { /* gone */ } } })]);
    } else if (R.capt) banner(null);
    R.capt = capt.length > 0;
    if (job.finished && !(await bgQueued(job.id))) {
      clearInterval(watchTimer); R.watch = false;
      renderResults(); scoreAll(); for (const p of job.pics) maybeIngest(p);
      return;
    }
    renderSoon();
  };
  watchTimer = setInterval(look, 2000);
  look();
}
async function initResults() {
  job = await RS_DB.get('jobs', PARAMS.get('job'));
  if (!job) { $('main').replaceChildren(h('div', { class: 'none', text: 'This search was not found. It may have been deleted.' })); side(); return; }
  document.title = 'Reverse search results · ' + plural(job.pics.length, 'picture');

  // Lists changed on another PageProof page: show the change here straight away.
  api.storage.onChanged.addListener((ch, area) => {
    if (area === 'local' && (ch.rsHidden || ch.rsAllowed || ch.rsRejected)) RS_LISTS.load().then(() => { unpark(); renderResults(); });
  });
  try { const me = await api.tabs.getCurrent(); R.myTab = me.id; R.winId = me.windowId; } catch (e) { /* ignore */ }
  if (R.myTab && !job.auto && !job.bg) api.storage.local.set({ rsOpenJob: { id: job.id, tab: R.myTab } });
  // Never more tabs or photo checks than this computer can take.
  try { const hw = await ppHardware(); LIM = { ...hw.limits, level: hw.level }; } catch (e) { LIM = { ...LIM, ...(job.limits || {}) }; }
  POOL_SIZE = Math.max(1, LIM.checks || 1);
  if (!EASE.timer) EASE.timer = CLOCK.every(30000, () => easeTick().catch(() => {}));
  if (job.kind === 'fifty' || BG) CLOCK.every(20000, () => { if (R.running) fiftyBeat(true); });
  for (const p of job.pics) {
    try {
      const rec = await RS_MEM.get(p.hash);
      R.known[p.i] = (rec && rec.scores) || {};
      // Only links found BEFORE this search count as "seen before".
      if (rec && rec.lastSearched && rec.lastSearched < job.created) R.prev[p.i] = rec;
      else if (rec && p.prevSnapshot) R.prev[p.i] = p.prevSnapshot;
    } catch (e) { /* ignore */ }
    if (!p.prevSnapshot && R.prev[p.i]) p.prevSnapshot = { lastSearched: R.prev[p.i].lastSearched, urls: R.prev[p.i].urls };
    for (const l of p.links) { l.pic = p.i; if (((l.sv !== SCORE_VERSION || l.pct === null) && !knownScore(p, l)) || needsPage(l)) R.scoreQ.push(l); }   // older searches (and links an old version skipped) get checked
  }
  // Only one page runs a search: if it is already running in another PageProof tab, this one
  // just shows it.
  // A pinned-tab search still in its line: this page only watches (and never takes its lock, or
  // the pinned tab could not run it).
  if (job.bg && !BG && (!job.finished || await bgQueued(job.id))) { renderResults(); watch(); return; }
  let mine = true;
  if (navigator.locks) mine = await new Promise(res => navigator.locks.request('pageproof-job-' + job.id, { ifAvailable: true }, lock => { res(!!lock); return lock ? new Promise(() => {}) : null; }));
  // A search that was cut off (its page closed, reloaded or put to sleep by the browser) carries
  // on where it stopped: photos that were mid-search are searched again, then the rest.
  const unfinished = mine && !job.auto && job.started && !job.finished;
  // The search tabs the old page had open are closed first (they no longer report to anyone and
  // only sat there frozen), so a reload never leaves a pile of pinned tabs or searches twice.
  if (mine) await closeOldTabs();
  for (const p of job.pics) for (const e of job.engines) if (['go', 'captcha'].includes(p.runs[e].state)) {
    delete p.runs[e].tabId;
    if (unfinished) { p.runs[e].state = 'wait'; delete p.runs[e].why; }
    else { p.runs[e].state = 'fail'; p.runs[e].why = 'The results window was closed or reloaded during this search.'; }
  }
  if (!job.auto && !BG) await docsBanner(renderResults);
  renderResults();
  scoreAll();
  for (const p of job.pics) maybeIngest(p);
  if (unfinished) PP_STATS.add('strain.resumed');        // the page was reloaded or crashed mid-search
  if (mine && (!job.started || unfinished)) runJob();
  // All searches' "Search the last N" button opens this page and asks for the rest straight away.
  try { if (sessionStorage.getItem('ppRest') === job.id) { sessionStorage.removeItem('ppRest'); const b = $('restBtn'); if (b && !R.running) b.click(); } } catch (e) { /* private window */ }
  // 4.30.2: the browser only shows "Leave site?" after someone clicked in the tab, and logs an error
  // (shown on edge://extensions) when a page asks without that click. So it only asks after one.
  const clicked = () => !navigator.userActivation || navigator.userActivation.hasBeenActive;
  if (!BG) window.addEventListener('beforeunload', e => { if (R.running && clicked()) { e.preventDefault(); e.returnValue = ''; } });
  if (BG) api.runtime.onMessage.addListener(msg => {
    if (msg && msg.type === 'ppBgStop' && msg.job === job.id && R.running) { R.stop = true; job.stoppedAt = new Date().toISOString(); for (const t of [...R.tasks.values()]) finishTask(t, 'skip', STOPPED); }
    return false;
  });
  window.addEventListener('pagehide', () => { if (saveTimer) saveJob(true); });
  // Asked by the full PageProof page before it drops an old results frame (it never drops a busy one).
  window.ppBusy = () => R.running || R.scoring || R.tasks.size > 0;
}

// =====================================================================================
// View 3: all searches
// =====================================================================================
async function renderPast() {
  plain(true, true);
  const me = ++PAST.n;
  const jobs = (await RS_DB.all('jobs')).sort((a, b) => b.created.localeCompare(a.created));
  await RS_LISTS.load();
  if (me !== PAST.n) return;
  const KIND = { new: ['New search', 'search', '#005FB8'], fifty: ['Today\'s 50', 'cal', '#8764B8'], keep: ['Keep searching', 'loop', '#0F7B0F'] };
  const kindOf = j => j.kind === 'keep' ? 'keep' : j.kind === 'fifty' || j.folder ? 'fifty' : 'new';
  const kico = (k, z = 36) => nsq(KIND[k][2], KIND[k][1], z);
  const tm = d => new Date(d).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const isDone = p => Object.values(p.runs).every(r => !['wait', 'go', 'captcha'].includes(r.state));
  // What each search found, worked out once.
  const info = j => {
    let same = 0, maybe = 0, nNew = 0;
    for (const p of j.pics) for (const l of p.links) { if (RS_LISTS.isHidden(l.site, l.url)) continue; const v = verdict(l); if (v === 'same') { same++; if (l.isNew) nNew++; } else if (v === 'maybe') maybe++; }
    return { same, maybe, nNew, done: j.pics.filter(isDone).length, running: !!(j.bg && !j.finished) };
  };
  const I = new Map(jobs.map(j => [j.id, info(j)]));
  for (const id of [...PAST.sel]) if (!I.has(id)) PAST.sel.delete(id);
  const took = j => { const x = I.get(j.id), st = j.pics.map(q => q.t0).filter(Boolean), en = j.pics.map(q => q.t1).filter(Boolean); return st.length && en.length && !x.running && x.done >= j.pics.length ? fmtDur(Math.max(...en) - Math.min(...st)) : '–'; };
  const num = (n, c) => h('span', { class: 'anum ' + (n ? c : 'zero'), text: n || '–' });
  const newTag = n => n ? h('span', { class: 'anewt', text: n + ' new' }) : h('span', { class: 'anum zero', text: '–' });
  const thumbs = (pics, max = 5) => { const t = pics.filter(p => p.thumb); return h('span', { class: 'athumbs', 'aria-hidden': 'true' }, t.slice(0, max).map(p => h('img', { src: p.thumb, alt: '' })), t.length > max ? h('span', { class: 'amore', text: '+' + (t.length - max) }) : null); };
  const sitesOf = es => h('span', { class: 'asites' }, (es || []).filter(e => ENGINES[e]).map(e => { const b = nbadge(e); b.title = ENGINES[e].name; return b; }));
  const tick = (on, label, set, some) => { const i = h('input', { type: 'checkbox', checked: on, 'aria-label': label, onclick: e => e.stopPropagation(), onchange: e => { set(e.target.checked); renderPast(); } }); if (some) i.indeterminate = true; return h('label', { class: 'achkb', title: label, onclick: e => e.stopPropagation() }, i); };
  const running = jobs.filter(j => I.get(j.id).running);
  const list = jobs.filter(j => !I.get(j.id).running);
  // ---- what the command bar asks for
  const q = PAST.q.trim().toLowerCase();
  const hit = j => (PAST.kind === 'all' || kindOf(j) === PAST.kind) && (!PAST.found || I.get(j.id).same + I.get(j.id).maybe > 0)
    && (!q || j.pics.some(p => ((p.name || '') + ' ' + (p.folderKey || '') + ' ' + (p.client || '')).toLowerCase().includes(q)) || String(j.folder || '').toLowerCase().includes(q));
  const shown = list.filter(hit);
  const cnt = k => list.filter(j => k === 'all' || kindOf(j) === k).length;
  const sel = shown.filter(j => PAST.sel.has(j.id));
  const del = async () => {
    const gone = sel.slice(); if (!gone.length) return;
    for (const j of gone) { await RS_DB.del('jobs', j.id); PAST.sel.delete(j.id); }
    renderPast();
    banner([h('b', { text: plural(gone.length, 'search', 'searches') + ' deleted. ' }), 'The copies ' + (gone.length > 1 ? 'they' : 'it') + ' found are still in Copies found.', h('span', { class: 'sp' }),
      h('button', { id: 'undoDel', text: '↶ Undo', onclick: async () => { for (const j of gone) await RS_DB.put('jobs', j.id, j); banner(null); renderPast(); } })], 'info');
  };
  const find = h('input', { type: 'search', id: 'pastFind', placeholder: 'Find a photo or client', 'aria-label': 'Find a photo or client', value: PAST.q, autocomplete: 'off',
    oninput: e => { PAST.q = e.target.value; clearTimeout(PAST.typing); PAST.typing = setTimeout(renderPast, 180); } });
  const cmd = h('div', { class: 'acmd' },
    h('a', { class: 'nbtn acc', id: 'pastNew', href: appUrl('search'), onclick: e => goApp('search', e) }, ni('search'), 'New search'), h('span', { class: 'cmdsep' }),
    h('div', { class: 'aseg', role: 'group', 'aria-label': 'Which searches' }, [['all', 'All'], ['new', 'New searches'], ['fifty', 'Today\'s 50'], ['keep', 'Keep searching']].map(([k, t]) =>
      h('button', { class: PAST.kind === k ? 'on' : '', 'data-kind': k, 'aria-pressed': String(PAST.kind === k), onclick: () => { PAST.kind = k; renderPast(); } }, t + ' ', h('span', { text: cnt(k) })))),
    h('label', { class: 'achk' }, h('input', { type: 'checkbox', id: 'pastFound', checked: PAST.found, onchange: e => { PAST.found = e.target.checked; renderPast(); } }), 'Only searches that found copies'),
    h('span', { class: 'sp' }), h('label', { class: 'afind' }, ni('search'), find), h('span', { class: 'cmdsep' }),
    nbtn('trash', sel.length ? 'Delete (' + sel.length + ')' : 'Delete', 'ghost', { id: 'pastDel', disabled: !sel.length, title: sel.length ? 'Delete the ticked searches from this list. The copies they found stay in Copies found.' : 'Tick the searches to delete first', onclick: del }));
  // ---- the last 7 days in numbers, and as a chart
  const week = jobs.filter(j => Date.now() - Date.parse(j.created) < 7 * 864e5), wk = week.map(j => [j, I.get(j.id)]);
  const best = wk.filter(([, x]) => x.same + x.maybe).sort((a, b) => (b[1].same + b[1].maybe) - (a[1].same + a[1].maybe))[0];
  const tile = (ic, c, n, t) => h('div', { class: 'card atile' }, nsq(c, ic, 40), h('span', { class: 'kn1' }, h('b', { class: 'num', text: n }), h('span', { text: t })));
  const bestPic = best && (best[0].pics.find(p => p.thumb && p.links.length) || best[0].pics.find(p => p.thumb));
  const tiles = h('div', { class: 'atiles', id: 'pastTiles' },
    tile('search', '#005FB8', week.length.toLocaleString(), 'searches in the last 7 days'),
    tile('photo', '#8764B8', wk.reduce((a, [, x]) => a + x.done, 0).toLocaleString(), 'photos searched'),
    tile('copies', '#C42B1C', wk.reduce((a, [, x]) => a + x.same + x.maybe, 0).toLocaleString(), 'copies found · ' + wk.reduce((a, [, x]) => a + x.nNew, 0) + ' new'),
    best ? h('div', { class: 'card atile best', role: 'button', tabindex: 0, title: 'Open this search', onclick: () => goResults(best[0].id), onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goResults(best[0].id); } } },
      bestPic ? h('img', { src: bestPic.thumb, alt: '' }) : nsq('#986F0B', 'star', 40),
      h('span', { class: 'kn1' }, h('span', { class: 'aover' }, ni('star', 14), 'Found the most'), h('b', { text: KIND[kindOf(best[0])][0] + ', ' + new Date(best[0].created).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + plural(best[1].same + best[1].maybe, 'copy', 'copies') })), ni('chev', 14))
      : h('div', { class: 'card atile' }, nsq('#6E6E6E', 'star', 40), h('span', { class: 'kn1' }, h('b', { text: 'No copies yet' }), h('span', { text: 'found in the last 7 days' }))));
  const days = [];
  for (let d = 6; d >= 0; d--) {
    const day = new Date(Date.now() - d * 864e5), k = day.toDateString(), js = jobs.filter(j => new Date(j.created).toDateString() === k);
    days.push([day.toLocaleDateString(undefined, { weekday: 'short' }), js.reduce((a, j) => a + I.get(j.id).done, 0), js.reduce((a, j) => a + I.get(j.id).same + I.get(j.id).maybe, 0), day.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })]);
  }
  const mx = Math.max(...days.map(d => d[1]), 1);
  const chart = h('section', { class: 'card achart', id: 'pastChart', 'aria-label': 'Last 7 days' }, h('h2', { class: 'kh2' }, 'Last 7 days ', h('span', { class: 'kfaint', text: 'photos searched · copies found' })),
    h('div', { class: 'abars' }, days.map(([l, p, c, full]) => h('div', { class: 'abar', title: full + ': ' + plural(p, 'photo') + ' searched, ' + plural(c, 'copy', 'copies') + ' found' },
      h('span', { class: 'kfaint num', text: p.toLocaleString() }), h('i', { style: 'height:' + (Math.round(p / mx * 110) + 4) + 'px' }, h('em', { style: 'height:' + (p ? Math.min(100, Math.round(c / p * 100)) : 0) + '%' })), h('b', { text: l })))));
  // ---- Running now: one card per search in the small pinned tab
  const runCards = running.map(j => {
    const x = I.get(j.id), n = j.pics.length, f = n ? x.done / n : 0, k = kindOf(j);
    const st = j.pics.map(p => p.t0).filter(Boolean), per = x.done && st.length ? (Date.now() - Math.min(...st)) / x.done : 0;
    const left = per && x.done < n ? ' · about ' + fmtDur(per * (n - x.done)) + ' left' : '';
    const stop = e => { e.stopPropagation(); api.runtime.sendMessage({ type: 'ppBgStop', job: j.id }).catch(() => {}); banner([h('b', { text: 'Stopping… ' }), 'The searches already running finish their page, then it stops.'], 'info'); };
    const firstWait = j.pics.findIndex(p => !isDone(p));
    return h('section', { class: 'card arun', 'data-job': j.id, 'aria-label': 'Running now' },
      h('div', { class: 'arunh' }, kico(k, 40), h('span', { class: 'kn1' }, h('span', { class: 'aover' }, h('i', { class: 'alive' }), j.started ? 'Running now' : 'Waiting to start'), h('b', { text: KIND[k][0] + ' · ' + plural(n, 'photo') + ' · started ' + tm(j.created) })),
        h('span', { class: 'sp' }), sitesOf(j.engines), h('span', { class: 'arnums' }, num(x.same, 'bad'), h('small', { text: 'same' }), num(x.maybe, 'warn'), h('small', { text: 'maybe' })),
        nbtn('open', 'Open', 'acc', { onclick: () => goResults(j.id) }), nbtn('stop', 'Stop', 'stop', { title: 'Stop and keep the results so far', onclick: stop })),
      h('div', { class: 'arprog' }, h('span', { class: 'kn1' }, h('b', { text: x.done + ' of ' + n + ' photos done' }), h('span', {}, ni('pin', 14), (j.started ? 'In the small pinned PageProof tab' : 'Waiting for the small pinned PageProof tab') + left)),
        h('div', { class: 'arbar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': n, 'aria-valuenow': x.done }, h('i', { style: 'width:' + (f * 100).toFixed(1) + '%' })), h('b', { class: 'num', text: Math.round(f * 100) + '%' })),
      h('div', { class: 'arstrip' }, j.pics.slice(0, 12).map((p, i) => {
        const d = isDone(p), go = !d && (Object.values(p.runs).some(r => r.state === 'go') || i === firstWait);
        const kept = p.links.filter(l => !RS_LISTS.isHidden(l.site, l.url) && ['same', 'maybe'].includes(verdict(l))).length;
        return h('span', { class: 'arp s-' + (d ? (kept ? 'hit' : 'nil') : go ? 'go' : 'wait'), title: p.name }, nthumb(p.thumb), h('em', { text: d ? (kept ? kept + ' found' : 'None') : go ? 'Searching' : 'Waiting' }));
      }), n > 12 ? h('span', { class: 'arp more', text: '+' + (n - 12) + ' more' }) : null));
  });
  // ---- the list: named columns, a heading per day, one line per search
  const openRow = (fn, title) => ({ role: 'button', tabindex: 0, title, onclick: fn, onkeydown: e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fn(); } } });
  const restOf = j => e => { e.stopPropagation(); try { sessionStorage.setItem('ppRest', j.id); } catch (err) { /* private window */ } goResults(j.id); };
  const rowOf = j => {
    const x = I.get(j.id), k = kindOf(j), n = j.pics.length, unf = x.done < n;
    return h('div', { class: 'arow' + (PAST.sel.has(j.id) ? ' sel' : ''), 'data-job': j.id, ...openRow(() => goResults(j.id), 'Open this search') },
      tick(PAST.sel.has(j.id), 'Tick this search', on => { if (on) PAST.sel.add(j.id); else PAST.sel.delete(j.id); }),
      h('span', { class: 'awhen num', text: tm(j.created) }),
      h('span', { class: 'awhat' }, kico(k), h('span', { class: 'kn1' }, h('b', { text: KIND[k][0] }), h('span', {}, plural(n, 'photo'), unf ? ' · ' : null, unf ? h('em', { class: 'awarn', text: 'Not finished: ' + x.done + ' of ' + n + ' done' }) : null))),
      thumbs(j.pics), sitesOf(j.engines), h('span', { class: 'atook num', text: took(j) }),
      h('span', { class: 'r' }, num(x.same, 'bad')), h('span', { class: 'r' }, num(x.maybe, 'warn')), h('span', { class: 'r' }, newTag(x.nNew)),
      h('span', { class: 'aend' }, unf ? nbtn('again', 'Search the last ' + (n - x.done), 'sm arest', { title: 'Search the photos this search did not get to', onclick: restOf(j) }) : null, ni('chev', 14)));
  };
  // Keep searching's one-photo searches: 3 or more in a row fold into one line, which opens as a grid of photos.
  const small = j => j.kind === 'keep' && j.pics.length === 1;
  const foldOf = (js, key) => {
    const xs = js.map(j => I.get(j.id)), s = a => xs.reduce((t, x) => t + x[a], 0), unf = xs.filter((x, i) => x.done < js[i].pics.length).length;
    const isOpen = PAST.open.has(key), nSel = js.filter(j => PAST.sel.has(j.id)).length;
    const toggle = () => { if (isOpen) PAST.open.delete(key); else PAST.open.add(key); renderPast(); };
    const r = h('div', { class: 'arow afold' + (isOpen ? ' open' : ''), 'aria-expanded': String(isOpen), ...openRow(toggle, isOpen ? 'Fold these searches again' : 'Show each of these searches') },
      tick(nSel === js.length, 'Tick these ' + js.length + ' searches', on => { for (const j of js) { if (on) PAST.sel.add(j.id); else PAST.sel.delete(j.id); } }, nSel > 0 && nSel < js.length),
      h('span', { class: 'awhen num' }, tm(js[js.length - 1].created), h('small', { text: 'to ' + tm(js[0].created) })),
      h('span', { class: 'awhat' }, kico('keep'), h('span', { class: 'kn1' }, h('b', { text: 'Keep searching' }), h('span', {}, js.length + ' one-photo searches', unf ? ' · ' : null, unf ? h('em', { class: 'awarn', text: unf + ' did not finish' }) : null))),
      thumbs(js.flatMap(j => j.pics)), sitesOf([...new Set(js.flatMap(j => j.engines || []))]), h('span', { class: 'atook num', text: '–' }),
      h('span', { class: 'r' }, num(s('same'), 'bad')), h('span', { class: 'r' }, num(s('maybe'), 'warn')), h('span', { class: 'r' }, newTag(s('nNew'))),
      h('span', { class: 'aend' }, h('span', { class: 'afoldt', text: isOpen ? 'Hide' : 'Show all' }), ni(isOpen ? 'up' : 'dn', 14)));
    if (!isOpen) return [r];
    return [r, h('div', { class: 'agrid' }, js.map(j => {
      const x = I.get(j.id), p = j.pics[0], u = x.done < 1, t = u ? ['', 'Not finished'] : x.same ? ['bad', x.same + ' same'] : x.maybe ? ['warn', x.maybe + ' maybe'] : ['', 'No copies'];
      return h('div', { class: 'agt' + (u ? ' unf' : '') + (PAST.sel.has(j.id) ? ' sel' : ''), 'data-job': j.id, ...openRow(() => goResults(j.id), p.name + ': open this search') },
        h('span', { class: 'agi' }, nthumb(p.thumb), (j.engines || []).filter(e => ENGINES[e]).slice(0, 1).map(e => nbadge(e)),
          tick(PAST.sel.has(j.id), 'Tick this search', on => { if (on) PAST.sel.add(j.id); else PAST.sel.delete(j.id); })),
        h('span', { class: 'agl' }, h('b', { class: 'num', text: tm(j.created) }), h('span', { class: 'ktag ' + t[0], text: t[1] })));
    }))];
  };
  const dayKey = d => new Date(d).toDateString(), today = new Date().toDateString(), yest = new Date(Date.now() - 864e5).toDateString();
  const dayName = k => k === today ? 'Today' : k === yest ? 'Yesterday' : new Date(k).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const body = [];
  for (let k = 0; k < shown.length;) {
    const d = dayKey(shown[k].created);
    let end = k; while (end < shown.length && dayKey(shown[end].created) === d) end++;
    const dj = shown.slice(k, end), found = dj.reduce((a, j) => a + I.get(j.id).same + I.get(j.id).maybe, 0);
    body.push(h('div', { class: 'aday' }, h('b', { text: dayName(d) }), h('span', { text: plural(dj.length, 'search', 'searches') + ' · ' + plural(found, 'copy', 'copies') + ' found' })));
    for (let a = 0; a < dj.length;) {
      if (small(dj[a])) { let m = a; while (m < dj.length && small(dj[m])) m++; if (m - a >= 3) { body.push(...foldOf(dj.slice(a, m), dj[a].id)); a = m; continue; } }
      body.push(rowOf(dj[a])); a++;
    }
    k = end;
  }
  const allSel = shown.length > 0 && sel.length === shown.length;
  const cols = h('div', { class: 'arow ahead' }, tick(allSel, 'Tick every search shown', on => { for (const j of shown) { if (on) PAST.sel.add(j.id); else PAST.sel.delete(j.id); } }, sel.length > 0 && !allSel),
    h('span', { text: 'When' }), h('span', { text: 'Search' }), h('span', { text: 'Photos' }), h('span', { text: 'Sites' }), h('span', { text: 'Took' }),
    h('span', { class: 'r', text: 'Same photo' }), h('span', { class: 'r', text: 'Maybe' }), h('span', { class: 'r', text: 'New' }), h('span'));
  const listCard = h('section', { class: 'card alist', id: 'pastList', 'aria-label': 'Searches' }, cols,
    body.length ? body : h('div', { class: 'anone' }, h('b', { text: 'No searches match' }), h('span', { text: 'Try another word, or show every kind of search.' }),
      nbtn('clear', 'Show all searches', '', { id: 'pastClear', onclick: () => { PAST.q = ''; PAST.kind = 'all'; PAST.found = false; renderPast(); } })));
  const foot = h('p', { class: 'afoot' }, ni('info'), 'Big searches are kept for 90 days, Keep searching\'s one-photo searches for 2 days. Every copy they found is also in Copies found.');
  const empty = h('section', { class: 'card aempty' }, h('span', { class: 'nbigic' }, ni('search', 56)), h('h3', { text: 'No searches yet' }),
    h('p', { class: 'kmuted', text: 'Search a few photos on Google Lens, Yandex and Bing. Keep searching and Today\'s 50 also show their searches here.' }),
    h('a', { class: 'nbtn acc big', id: 'pastStart', href: appUrl('search'), onclick: e => goApp('search', e) }, ni('search'), 'Start a new search'));
  // The page redraws now and then (a running search, typing in Find): keep the cursor and the scroll.
  const hadFocus = document.activeElement && document.activeElement.id === 'pastFind', caret = hadFocus ? document.activeElement.selectionStart : 0, pageY = window.scrollY;
  $('main').replaceChildren(h('div', { class: 'nnew anew2' }, nhead('Copies found', 'All searches'),
    ...(jobs.length ? [cmd, h('div', { class: 'atop' }, tiles, chart), ...runCards, list.length ? listCard : null, foot] : [empty])));
  if (hadFocus && $('pastFind')) { $('pastFind').focus(); try { $('pastFind').setSelectionRange(caret, caret); } catch (e) { /* not a text box */ } }
  if (window.scrollY !== pageY) window.scrollTo(0, pageY);
  // A search running in the pinned tab: the list shows how far it is, so it is read again now and then.
  clearTimeout(pastTimer);
  if (running.length) pastTimer = setTimeout(renderPast, 15000);
}
const PAST = { open: new Set(), sel: new Set(), kind: 'all', found: false, q: '', n: 0, typing: null };
let pastTimer = null;

// =====================================================================================
// Start
// =====================================================================================
$('filePick').addEventListener('change', e => { const f = [...e.target.files]; e.target.value = ''; addToDraft(f); });

(async () => {
  await RS_LISTS.load();
  if (VIEW === 'results') return initResults();
  // Old addresses (bookmarks, the old menu) go to their new pages.
  if (VIEW === 'folder') { location.replace(appUrl('keep')); return; }
  if (VIEW === 'lists') { location.replace(appUrl('hidden')); return; }
  if (VIEW === 'past') { document.title = 'PageProof: all searches'; return renderPast(); }
  setupDropAndPaste(addToDraft);
  renderSetup();
  docsBanner();
})();
