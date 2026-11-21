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
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Lets other work run for a moment without a timer: browsers slow timers right down while the
// window is minimized, which used to stall the photo checks for hours.
const breathe = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => { c.port1.close(); r(); }; c.port2.postMessage(0); });
const rand = ([a, b]) => a + Math.random() * (b - a);
const PARAMS = new URLSearchParams(location.search);
const VIEW = PARAMS.get('job') ? 'results' : (PARAMS.get('view') || 'setup');

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
      h('span', { class: 'sp' }), h('button', { text: '📂 Set up PageProof folder', onclick: async () => { try { await RS_DOCS.choose(); done(); } catch (e) { /* closed the picker */ } } }),
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

async function setupSide() {
  const s = await getSettings();
  const save = () => setSettings(s).then(setupSide);
  const engines = h('div', { class: 'card' }, h('h3', { text: 'Search on' }),
    Object.entries(ENGINES).map(([k, e]) => h('label', { class: 'chk' },
      h('input', { type: 'checkbox', checked: s.engines[k], onchange: ev => { s.engines[k] = ev.target.checked; save(); } }), fav(k), e.name, h('small', { text: e.what }))));
  const speed = h('div', { class: 'card' }, h('h3', { text: 'Speed' }),
    h('div', { class: 'seg' }, Object.entries(SPEED).map(([k, v]) => h('button', { class: s.speed === k ? 'on' : '', text: v.label, onclick: () => { s.speed = k; save(); } }))),
    h('p', { class: 'hint', text: SPEED[s.speed].hint }));
  const n = draft.length, nEng = Object.values(s.engines).filter(Boolean).length;
  const secs = Math.round(n * (SPEED[s.speed].gap[0] + SPEED[s.speed].gap[1]) / 2000 / SPEED[s.speed].per + 15);
  const go = h('button', { class: 'big', disabled: !n || !nEng, text: '🔎 Search ' + (n ? plural(n, 'picture') : 'pictures'), onclick: async () => {
    go.disabled = true;
    const job = await startJob(draft.slice());
    if (job) { draft.length = 0; draftNotes = ['Search started. You can add more pictures for another search here.']; renderSetup(); }
    else go.disabled = false;
  } });
  side(h('div', {}, h('div', { id: 'domain', text: 'Reverse image search' }), h('div', { id: 'sub', text: 'Search many pictures at once on Google, Yandex and Bing.' })),
    engines, speed, go,
    n ? h('p', { class: 'hint', style: 'margin:-4px 0 0;text-align:center', text: 'About ' + (secs < 90 ? secs + ' seconds' : Math.round(secs / 60) + ' minutes') + ' for ' + plural(n, 'picture') + ' on ' + plural(nEng, 'site') }) : null,
    h('div', { class: 'links' },
      appLink('keep', '📂 Today\'s 50 and Keep searching'),
      appLink('searches', '📒 All searches'),
      appLink('hidden', '🚫 Hidden and approved sites'),
      h('a', { href: 'https://github.com/TheBenPsych/PageProof/blob/main/TUTORIAL.md#16-search-many-pictures-at-once-reverse-image-search', target: '_blank', text: '❔ How this works' })));
}

function renderSetup(busy) {
  setupSide();
  const notes = draftNotes.length ? h('div', { class: 'howbox', style: 'max-width:none' }, draftNotes.map(t => h('div', { text: t }))) : null;
  if (!draft.length) {
    $('main').replaceChildren(h('div', { class: 'empty' },
      notes,
      h('div', { class: 'ic', text: '🖼️' }),
      h('h1', { text: busy ? 'Getting your pictures ready…' : 'Which pictures do you want to search?' }),
      h('button', { class: 'addbtn', text: '📁 Add pictures', onclick: () => $('filePick').click() }),
      h('button', { class: 'btn', style: 'font-size:14px;padding:8px 16px', text: '📂 Or pick from my clients\' photos', onclick: e => goApp('clients', e) }),
      h('div', { class: 'ways' }, h('span', { text: 'Or drag pictures or a whole folder onto this page' }), h('span', { text: 'Or paste pictures or picture links (Ctrl+V)' }), h('span', { text: 'Up to ' + MAX_PICS + ' at once' })),
      h('div', { class: 'howbox' }, h('b', { text: 'What happens next:' }), h('ol', {},
        h('li', { text: 'PageProof shows the results right here in PageProof. The Google, Yandex and Bing search tabs open as small pinned tabs at the left of the tab bar, and close by themselves when done.' }),
        h('li', { text: 'The pictures are searched a few at a time, with short pauses, in your own browser. That keeps "are you a robot" checks away.' }),
        h('li', { text: 'Every link found is listed on one results page, with a % match. Hide the sites you never care about.' })))));
    return;
  }
  $('main').replaceChildren(...[
    h('div', {}, h('h1', { text: plural(draft.length, 'picture') + (busy ? ' (adding more…)' : ' ready') }), h('p', { class: 'lead', text: 'Numbers match the pictures in the results window. Press ✕ to take a picture out.' })),
    notes,
    h('div', { class: 'pics' }, draft.map((p, i) => h('div', { class: 'pic' },
      h('img', { src: p.thumb, alt: '' }), h('span', { class: 'num', text: i + 1 }),
      h('button', { class: 'x', title: 'Take this picture out', text: '✕', onclick: () => { draft.splice(i, 1); renderSetup(); } }),
      h('div', { class: 'nm', text: p.name, title: p.name }), h('div', { class: 'sz', text: p.w + ' × ' + p.h + ' · ' + (p.size / 1e6).toFixed(1) + ' MB' })))),
    draft.length < MAX_PICS ? h('button', { class: 'addbtn small', text: '＋ Add more pictures', onclick: () => $('filePick').click() }) : null].filter(Boolean));
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
  groups: {}, prev: {}, sel: 0, filter: 'same', engineFilter: new Set(), text: '', showHidden: false, ticked: new Set(), scoreQ: [], scoring: false, origBmp: {}, known: {} };

let saveTimer = null;
function saveJob(now) {
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
  return { dataUrl, name: p.name.replace(/\.(heic|heif|tiff?|bmp|avif)$/i, '.jpg') };
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
  let tab;
  const opts = { windowId: R.winId, url: ENGINES[engine].start, active: false };
  try { try { tab = await api.tabs.create({ ...opts, pinned: true }); } catch (e) { tab = await api.tabs.create(opts); } }
  catch (e) { run.state = 'fail'; run.why = 'Could not open a tab'; renderSoon(); return; }
  run.tabId = tab.id;
  // Search tabs are pinned (small icons at the left of the tab bar) so they don't fill it. A
  // pinned tab can't be in a tab group, so the old coloured groups are no longer made.
  await new Promise(done => R.tasks.set(tab.id, { p, engine, tabId: tab.id, stage: 'upload', deadline: Date.now() + TASK_TIMEOUT, done }));
}

function finishTask(t, state, why) {
  if (!R.tasks.has(t.tabId)) return;
  R.tasks.delete(t.tabId);
  const run = t.p.runs[t.engine];
  run.state = state;
  if (why) run.why = why; else delete run.why;
  if (t.captcha) { t.captcha = false; updatePause(t.engine); }
  if (picDone(t.p)) maybeIngest(t.p);
  saveJob(); renderSoon();
  // Search tabs are the big memory cost (each one is a full Google/Yandex/Bing page), so a
  // finished one is closed at once. A failed one is kept so you can look at it, but put to
  // sleep (discarded): it stays in the tab strip and uses almost no memory until clicked.
  if (state === 'fail') { if (api.tabs.discard) api.tabs.discard(t.tabId).then(d => { if (d) run.tabId = d.id; }).catch(() => {}); }
  else api.tabs.remove(t.tabId).catch(() => {});
  t.done();
}

function updatePause(engine) {
  R.paused[engine] = [...R.tasks.values()].some(x => x.engine === engine && x.captcha);
  if (![...R.tasks.values()].some(x => x.captcha)) banner(null);
}

async function onCaptcha(t) {
  if (t.captcha) return;
  if (job.auto) {
    // Nobody is watching: that site rests for an hour and the others carry on.
    const rest = (await api.storage.local.get('fcRest')).fcRest || {};
    rest[t.engine] = Date.now() + 3600000;
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
      await api.tabs.update(t.tabId, { active: true });
      await api.windows.update(R.winId, { focused: true });
      if (R.groups[t.p.i] != null && api.tabGroups) await api.tabGroups.update(R.groups[t.p.i], { collapsed: false });
    } catch (e) { /* tab gone */ }
  };
  banner([h('span', {}, h('b', { text: name + ' wants a quick check. ' }), 'Tick the box (or solve the puzzle) in the ' + name + ' tab and PageProof carries on by itself. ' +
      (job.engines.length > 1 ? 'The other sites keep searching meanwhile.' : '') + (R.captchas[t.engine] >= 3 ? ' ' + name + ' has asked ' + R.captchas[t.engine] + ' times now; you can skip it and try again later.' : '')),
    h('span', { class: 'sp' }), h('button', { text: 'Show me the tab', onclick: show }),
    h('button', { class: 'btn', text: 'Skip ' + name + ' for now', onclick: () => giveUp(t.engine) })]);
  show();
}

function captchaCleared(t) {
  t.captcha = false;
  t.p.runs[t.engine].state = 'go';
  t.deadline = Date.now() + TASK_TIMEOUT;
  updatePause(t.engine);
  if (R.myTab) api.tabs.update(R.myTab, { active: true }).catch(() => {});
  renderSoon();
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
const SAVE_FIELDS = ['pct', 'inl', 'tiles', 'str', 'mid', 'w', 'h'];
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
async function fetchPicture(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 7000);
  try {
    const r = await fetch(url, { signal: ctl.signal, credentials: 'omit' });
    if (!r.ok) return null;
    const b = await r.blob();
    if (b.size > 25e6) return null;
    // Shrink straight away and free the full-size copy: a big photo takes 50-100 MB of memory
    // once opened, and the check only ever looks at it 640 pixels wide.
    const big = await createImageBitmap(b);
    const f = Math.min(1, 640 / Math.max(big.width, big.height));
    if (f >= 1) return { bmp: big, w: big.width, h: big.height };
    const bmp = await createImageBitmap(big, { resizeWidth: Math.max(1, Math.round(big.width * f)), resizeHeight: Math.max(1, Math.round(big.height * f)), resizeQuality: 'high' });
    const out = { bmp, w: big.width, h: big.height };
    big.close && big.close();
    return out;
  } catch (e) { return null; } finally { clearTimeout(timer); }
}
const freePic = x => { try { x && x.bmp.close && x.bmp.close(); } catch (e) { /* already freed */ } };
// Line one found picture up with yours and note how well it fits.
// The checking itself runs in background workers (score-worker.js), one per spare processor
// core up to 4, so the results page stays smooth. A check that hangs (a strange picture) is
// stopped after 30 seconds and its worker replaced, so one bad picture can't freeze anything.
// If workers aren't available the check runs on the page as before.
const POOL = { list: [], next: 1, failed: false };
let POOL_SIZE = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));   // lowered to the computer's limit when a search opens
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
function freeWorker() { while (POOL_WAIT.length && (POOL.list.length < POOL_SIZE || POOL.list.some(x => !x.busy))) POOL_WAIT.shift()(); }
async function idleWorker() {
  for (;;) {
    while (POOL.list.length < POOL_SIZE) POOL.list.push(newWorker());
    const w = POOL.list.find(x => !x.busy);
    if (w) return w;
    await new Promise(r => POOL_WAIT.push(r));
  }
}
async function checkInWorker(p, bmp) {
  if (POOL.failed || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return null;
  let w;
  try { w = await idleWorker(); } catch (e) { POOL.failed = true; return null; }
  w.busy++;                                            // taken before any waiting below
  try {
    if (!w.sent.has(p.i)) {
      const o = await origBitmap(p);
      const copy = await createImageBitmap(o);
      w.worker.postMessage({ type: 'orig', key: p.i, bmp: copy }, [copy]);
      w.sent.add(p.i);
      if (w.sent.size > 8) { const old = w.sent.values().next().value; w.sent.delete(old); w.worker.postMessage({ type: 'forget', key: old }); }   // keep memory small
    } else { w.sent.delete(p.i); w.sent.add(p.i); }   // most recently used goes last
  } catch (e) { w.busy--; freeWorker(); throw e; }
  const id = POOL.next++;
  const res = await new Promise(resolve => {
    w.waits.set(id, resolve);
    w.worker.postMessage({ type: 'check', id, key: p.i, bmp }, [bmp]);
    setTimeout(() => { if (w.waits.has(id)) killWorker(w); }, 30000);
  });
  if (res.err) return { stuck: true };                // the picture was handed over, so no second try here
  return res.out;
}

async function measure(p, bmp) {
  const f = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
  const small = f < 1 ? await createImageBitmap(bmp, { resizeWidth: Math.round(bmp.width * f), resizeHeight: Math.round(bmp.height * f), resizeQuality: 'high' }) : bmp;
  try {
    const w = await checkInWorker(p, small);
    if (w && w.stuck) return { pct: -1, sv: SCORE_VERSION };        // took too long: shown as "Can't check"
    const best = w ? (w.none ? null : { inliers: w.inliers, sc: w })
      : await PP_ALIGN.align(await origBitmap(p), small, undefined, { fast: true });
    return {
      pct: best ? Math.max(0, Math.min(100, Math.round(best.sc.lines * 100))) : 0,
      inl: best && best.inliers || 0,                       // matching details found in both pictures
      tiles: best ? best.sc.matched : 0,                    // small squares that line up
      str: best ? +best.sc.strength.toFixed(2) : 0,         // how closely they line up
      // Share of the middle of your picture (where the subject usually is) that lines up.
      mid: best && best.sc.midTex >= 8 ? +(best.sc.midMatched / best.sc.midTex).toFixed(2) : null,
      n: best ? best.sc.inside || 0 : 0,                   // small squares compared at all (the shared area)
      sv: SCORE_VERSION,
    };
  } catch (e) { return { pct: 0, inl: 0, tiles: 0, str: 0, mid: null, sv: SCORE_VERSION }; }
}
// Quick first look with the search site's small preview (fast to download). A clear
// "different photo" stops there; anything else is checked again with the full picture.
async function scoreLink(l) {
  const p = job.pics[l.pic];
  let quick = null;
  if (l.thumb && l.thumb !== l.img) {
    const tb = await fetchPicture(l.thumb);
    if (tb && Math.min(tb.w, tb.h) >= 80) quick = await measure(p, tb.bmp);
    freePic(tb);
    if (quick && verdict(quick) === 'no') { Object.assign(l, quick); return; }
  }
  const full = l.img ? await fetchPicture(l.img) : null;
  if (full) {
    if (!l.w) { l.w = full.w; l.h = full.h; }
    const m = await measure(p, full.bmp);
    freePic(full);
    Object.assign(l, m);
    return;
  }
  if (quick) { Object.assign(l, quick); return; }
  const tb = l.thumb ? await fetchPicture(l.thumb) : null;
  if (tb) { const m = await measure(p, tb.bmp); freePic(tb); Object.assign(l, m); return; }
  l.pct = -1; l.sv = SCORE_VERSION;
}

// Is it the same photo? Tested on real copies (cropped, resized, colour-graded, mirrored, tiny
// thumbnails, a headline printed over 40% of it) against different photos of the same kind:
// real copies share dozens of matching details (31 to 400+), different photos share under 10.
// Two different photos in front of the same backdrop (sponsor wall, logo pattern) line up
// around the edges but not in the middle: real copies 0.49 to 1.0 there (0.49 = headline over
// the middle), same-backdrop different photos about 0.3.
// Version 4: a copy shrunk to a dot no longer counts (it was compared over two tiny squares and
// could show 100%); at least 40 squares must be compared and 12 must match for Same photo.
const SCORE_VERSION = 4;
const userNo = l => !!(l.url && job && job.pics[l.pic] && RS_REJECT.notMatch(l.url, job.pics[l.pic].name));
function verdict(l) {
  if (l.rescued) return 'maybe';          // you said it is a copy
  if (userNo(l)) return 'no';
  if (l.sv !== SCORE_VERSION) return l.pct === null ? 'cant' : 'pending';
  if (l.pct === null || l.pct < 0) return 'cant';
  if (l.n != null && l.n < 40) return 'no';   // shared area too small to say anything
  if (!(l.tiles >= 12)) return 'no';           // too few matching squares, whatever the %
  if (l.mid !== null && l.mid !== undefined && l.mid < 0.35) return 'no';
  const midOk = l.mid === null || l.mid === undefined || l.mid >= 0.42;
  // Most of the shared area must line up. Copies with a big headline over them (about 55%)
  // land in Maybe, as do different shots in front of the same logo wall (about 50%).
  if (midOk && l.str >= 0.8 && ((l.pct >= 75 && l.inl >= 15 && l.tiles >= 20) || (l.pct >= 85 && l.inl >= 10))) return 'same';
  // A high % on its own means nothing: two different photos can "line up" over a tiny shared patch.
  if (l.inl >= 11 && l.tiles >= 12 && l.pct >= 40) return 'maybe';
  return 'no';
}
const VERDICT = {
  same: { tag: 'Same photo', cls: 'ex', rank: 4 },
  maybe: { tag: 'Maybe', cls: 'maybe', rank: 3 },
  pending: { tag: 'Checking…', cls: 'sim', rank: 2 },
  cant: { tag: "Can't check", cls: 'sim', rank: 1 },
  no: { tag: 'Different photo', cls: 'sim', rank: 0 },
};
// Checks every picture's links in the background, three at a time, the picture on screen first.
async function scoreAll() {
  if (R.scoring) return;
  R.scoring = true;
  // 6 at a time: downloads overlap well; more than that mostly waits on the computer itself.
  const run = () => Promise.all(Array.from({ length: Math.max(3, POOL_SIZE * 2) }, scoreWorker));
  // Holding a lock while checking tells Chrome and Edge this page is busy, so they don't put it
  // to sleep when the window is minimized or left in the background.
  try { await (navigator.locks ? navigator.locks.request('pageproof-photo-checks', run) : run()); } finally { R.scoring = false; }
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
        R.scoreQ.sort((a, b) => (b.pic === R.sel) - (a.pic === R.sel) || a.pic - b.pic || b.exact - a.exact);
        R.qSorted = (R.scoreQ.length - 1) + ':' + R.sel;
      } else R.qSorted = (R.scoreQ.length - 1) + ':' + R.sel;
      const l = R.scoreQ.shift();
      if (l.sv === SCORE_VERSION) continue;
      const p = job.pics[l.pic];
      await scoreLink(l);
      saveScoresSoon(job.pics[l.pic]);
      maybeIngest(job.pics[l.pic]);
      saveJob(); renderSoon();
      await breathe();
    }
  }
}

// ---------- running the whole search ----------
// The computer check sets how many search tabs may be open at once (all sites together).
const SLOTS = { free: 3, wait: [] };
const takeSlot = () => (SLOTS.free > 0 ? (SLOTS.free--, Promise.resolve()) : new Promise(r => SLOTS.wait.push(r)));
const giveSlot = () => { const n = SLOTS.wait.shift(); if (n) n(); else SLOTS.free++; };
async function runJob(onlyEngines) {
  R.running = true; R.stop = false;
  job.started = true; saveJob(true);
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
  if (R.stop) for (const p of job.pics) for (const e of job.engines) if (p.runs[e].state === 'wait') { p.runs[e].state = 'skip'; p.runs[e].why = 'Stopped before this search started'; }
  R.running = false;
  job.finished = new Date().toISOString();
  saveJob(true); renderSoon();
  for (const p of job.pics) maybeIngest(p);
  autoDone();
}

// ---------- every find goes into All copies found ----------
// When a photo has been searched and every link checked, its Same photo and Maybe links are
// added to the copies list (Find copies › All copies found), with the photo's client.
const BY = { keep: 'Keep searching', fifty: 'today\'s 50', new: 'a search' };
function maybeIngest(p) {
  if (!p || p.ingested || !picDone(p)) return;
  // What each search site gave back, for "is this site still working?" (-1 = no answer).
  const health = {};
  for (const e of job.engines) { const st = p.runs[e].state; if (st === 'done') health[e] = p.links.filter(l => (l.engines || []).includes(e)).length; else if (st === 'fail') health[e] = -1; }
  if (!job.engines.some(e => p.runs[e].state === 'done')) {                // nothing actually searched
    if (!p.healthNoted && Object.keys(health).length) { p.healthNoted = true; FC.engineResults(health, null, false).catch(() => {}); }
    return;
  }
  if (p.links.some(l => verdict(l) === 'pending' && !RS_LISTS.isHidden(l.site, l.url))) return;
  p.ingested = true;
  const links = p.links.filter(l => ['same', 'maybe'].includes(verdict(l)) && !RS_LISTS.isHidden(l.site, l.url) && !isRejected(p, l))
    .map(l => ({ ...l, verdict: verdict(l) }));
  FC.ingest(p, links, BY[job.kind] || 'a search').then(r => { if (!p.healthNoted) { p.healthNoted = true; return FC.engineResults(health, r.photo.id, !links.length); } })
    .catch(err => { p.ingested = false; console.warn('PageProof: could not add the copies', err); })
    .finally(() => { saveJob(); autoDone(); });
}
// Keep searching runs a search in a background window: when it's finished, tell that window and close.
let autoClosing = false;
function autoDone() {
  if (!job || !job.auto || autoClosing || R.running) return;
  if (!job.pics.every(p => p.ingested || picDone(p) && !job.engines.some(e => p.runs[e].state === 'done'))) return;
  if (job.pics.some(p => !p.ingested && job.engines.some(e => p.runs[e].state === 'done'))) return;
  autoClosing = true;
  saveJob(true).finally(() => {
    api.runtime.sendMessage({ type: 'fcAutoDone', job: job.id, found: job.pics.reduce((a, p) => a + p.links.filter(isSame).length, 0) }).catch(() => {});
    setTimeout(() => window.close(), 300);
  });
}
// Give up on tabs that never answer.
setInterval(() => {
  const now = Date.now();
  for (const t of [...R.tasks.values()]) if (!t.captcha && now > t.deadline) finishTask(t, 'fail', 'No answer from the page. Open the tab to look at it yourself.');
}, 1000);

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

function resultsSide() {
  const done = job.pics.filter(picDone).length, total = job.pics.length;
  const busy = R.running;
  const links = job.pics.reduce((a, p) => a + shownCount(p), 0);
  const sites = new Set(job.pics.flatMap(p => visibleLinks(p, { raw: true, withHidden: false }).map(l => l.site))).size;
  const when = new Date(job.created);
  const left = job.pics.filter(p => job.engines.some(e => ['wait', 'skip', 'fail'].includes(p.runs[e].state))).length;
  const head = busy
    ? h('div', {}, h('div', { id: 'domain', text: 'Searching ' + plural(total, 'picture') }),
      h('div', { id: 'sub', text: done + ' done · ' + job.pics.filter(picBusy).length + ' searching · ' + (total - done - job.pics.filter(picBusy).length) + ' waiting' }),
      h('div', { class: 'prog' }, h('i', { style: 'width:' + Math.round(done / total * 100) + '%' })),
      h('p', { class: 'hint', text: 'You can use other PageProof pages and other tabs meanwhile. Keep the PageProof tab open until it finishes.' }))
    : h('div', {}, h('div', { id: 'domain', text: plural(total, 'picture') + ' searched' }),
      h('div', { id: 'sub', text: when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) + ' · ' + plural(job.pics.reduce((a, p) => a + sameCount(p), 0), 'same-photo link') + ' (of ' + links + ' found)' + (job.pics.some(checking) ? ' · still checking matches…' : '') }));
  const list = h('div', { class: 'card plist' }, job.pics.map(p => {
    const n = sameCount(p), nNew = p.links.filter(l => l.isNew && isSame(l) && !RS_LISTS.isHidden(l.site, l.url)).length;
    const state = picDone(p) ? h('span', { class: 'cnt' + (n ? '' : ' z') + (nNew ? ' newc' : ''), title: 'Links that show the same photo', text: (nNew ? n + ' · ' + nNew + ' new' : n) + (checking(p) ? '…' : '') })
      : runList(p).some(r => r.state === 'captcha') ? h('span', { class: 'st bad', text: 'Check!' })
      : picBusy(p) ? h('span', { class: 'st go', text: 'Searching' }) : h('span', { class: 'st wait', text: 'Waiting' });
    return h('button', { class: 'pitem' + (p.i === R.sel ? ' on' : ''), onclick: () => { R.sel = p.i; renderResults(); scoreAll(); window.scrollTo(0, 0); } },
      h('img', { src: p.thumb, alt: '' }), h('div', { class: 'n' }, h('b', { text: (p.i + 1) + '. ' + p.name }), h('small', { text: statusLine(p) }), checkLine(p)), state);
  }));
  const actions = busy
    ? [h('button', { class: 'big stop', text: '⏹ Stop and keep results so far', onclick: () => { R.stop = true; for (const t of [...R.tasks.values()]) finishTask(t, 'skip', 'Stopped'); } })]
    : [h('button', { class: 'big', text: '💾 Save results', onclick: () => { saveCsv(); savePdf(); } }),
      h('div', { class: 'grid2' }, h('button', { class: 'ghost', text: '📄 PDF report', onclick: savePdf }), h('button', { class: 'ghost', text: '📊 Spreadsheet', onclick: saveCsv })),
      left ? h('button', { class: 'ghost', text: '🔁 Search the rest (' + left + ')', onclick: () => {
        for (const p of job.pics) for (const e of job.engines) if (['skip', 'fail'].includes(p.runs[e].state)) p.runs[e].state = 'wait';
        runJob();
      } }) : null];
  side(head, list, ...actions, h('div', { class: 'links' },
    appLink('found', '🗂 All copies found'),
    appLink('search', '🔎 New search'),
    appLink('hidden', '🚫 Hidden and approved sites'),
    appLink('searches', '📒 All searches')));
}

// A link the checker threw out (Different photo / Can't check). These are NOT added to All copies
// found; "It is a copy" rescues one that really is your photo.
function rowFor(p, l) {
  const v = verdict(l);
  const why = userNo(l) ? 'You: not a match' : v === 'cant' ? (l.pct === null ? 'Not checked' : 'Picture blocked') : 'Different photo';
  return h('div', { class: 'row' },
    (l.thumb || l.img) ? h('img', { class: 'th', src: l.thumb || l.img, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer', onerror: e => e.target.replaceWith(h('div', { class: 'th' })) }) : h('div', { class: 'th' }),
    h('div', { class: 't' }, h('a', { href: l.url, target: '_blank', rel: 'noreferrer', text: l.title || l.url, title: l.title || l.url }),
      h('small', { text: l.site + ' · ' + l.url })),
    h('div', { class: 'mt' }, h('span', { class: 'pct ' + (v === 'cant' ? 'no' : 'lo'),
      title: v === 'cant' ? 'The site would not let PageProof download its picture, so it could not be compared. Open it to look yourself.' : 'The two pictures did not line up detail for detail.',
      text: why }), h('small', {}, l.w ? l.w + ' × ' + l.h : 'size unknown')),
    h('div', { class: 'tags' },
      l.engines.map(e => h('span', { class: 'tag ' + e, text: ENGINES[e].short })),
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

function renderResults() {
  if (!job) return;
  resultsSide();
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
    return h('button', { class: 'btn', onclick: async () => {
      try { if (r.tabId) { await api.tabs.update(r.tabId, { active: true }); return; } } catch (err) { /* closed */ }
      if (r.pageUrl) openTab(r.pageUrl);
    } }, fav(e), ' ' + ENGINES[e].short + ' tab');
  };
  const problems = job.engines.map(e => p.runs[e]).filter(r => r.why && r.state !== 'done').map(r => r.why);
  // The whole search: one button to the review, which lives in All copies found.
  const totalKept = job.pics.reduce((a, q) => a + visibleLinks(q, { raw: true, withHidden: false }).filter(l => ['same', 'maybe'].includes(verdict(l))).length, 0);
  const allIn = !R.running && job.pics.every(q => q.ingested || !job.engines.some(e => q.runs[e].state === 'done'));
  const top = h('div', { class: 'sumcard' },
    h('div', {}, h('b', { text: R.running ? 'Searching… ' + plural(totalKept, 'copy', 'copies') + ' found so far' : plural(totalKept, 'copy', 'copies') + ' found in this search' }),
      h('small', { text: allIn ? 'They are in All copies found, with each photo\'s client. Review them there: Stolen, Licensed or Remove.'
        : 'Each photo\'s copies go to All copies found as soon as that photo is searched and checked. You review them there.' })),
    h('a', { class: 'btn blue', href: appUrl('review'), onclick: e => goApp('review', e), text: 'Review new copies' }),
    h('a', { class: 'btn', href: appUrl('found'), onclick: e => goApp('found', e), text: 'All copies found' }));
  const state = searching ? 'Searching… ' + statusLine(p)
    : nPend ? 'Checking ' + plural(nPend, 'picture') + ' found against yours…'
      : kept ? plural(kept, 'copy', 'copies') + ' of this photo ' + (p.ingested ? 'added to' : 'going to') + ' All copies found (' + nSame + ' same photo, ' + nMaybe + ' maybe)'
        : 'No copies found for this photo';
  const wasOpen = $('thrown') ? $('thrown').open : false;
  $('main').replaceChildren(top,
    h('div', { class: 'rhead' }, h('img', { src: p.thumb, alt: '' }), h('div', { class: 'meta' },
      h('h1', { text: (p.i + 1) + '. ' + p.name }),
      h('p', { class: 'lead' }, h('b', { style: kept && !searching && !nPend ? 'color:#15803d' : '', text: state }), ' · your file is ' + p.w + ' × ' + p.h),
      h('div', { class: 'btns' }, job.engines.map(tabBtn)),
      problems.length ? h('p', { class: 'note', text: [...new Set(problems)].join(' ') }) : null)),
    h('details', { class: 'thrown', id: 'thrown', open: wasOpen },
      h('summary', {}, h('b', { text: 'Thrown out by the checker: ' + out.length }), ' · ' + nNo + ' different photo · ' + (out.length - nNo) + " can't check"),
      h('p', { class: 'hint', text: 'These were not added to All copies found. If one really is your photo, press "＋ It is a copy" and it goes there.' }),
      out.length ? h('div', { class: 'list' }, h('div', { class: 'site' }, out.map(l => rowFor(p, l)))) : h('div', { class: 'none', text: searching || nPend ? 'Nothing thrown out yet.' : 'Nothing was thrown out for this photo.' })));
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

async function initResults() {
  job = await RS_DB.get('jobs', PARAMS.get('job'));
  if (!job) { $('main').replaceChildren(h('div', { class: 'none', text: 'This search was not found. It may have been deleted.' })); side(); return; }
  document.title = 'Reverse search results · ' + plural(job.pics.length, 'picture');

  // Lists changed on another PageProof page: show the change here straight away.
  api.storage.onChanged.addListener((ch, area) => {
    if (area === 'local' && (ch.rsHidden || ch.rsAllowed || ch.rsRejected)) RS_LISTS.load().then(() => renderResults());
  });
  try { const me = await api.tabs.getCurrent(); R.myTab = me.id; R.winId = me.windowId; } catch (e) { /* ignore */ }
  if (R.myTab && !job.auto) api.storage.local.set({ rsOpenJob: { id: job.id, tab: R.myTab } });
  // Never more tabs or photo checks than this computer can take.
  const lim = job.limits || (await ppHardware()).limits;
  SLOTS.free = Math.max(1, lim.tabs || 3);
  POOL_SIZE = Math.max(1, Math.min(POOL_SIZE, lim.checks || 4));
  // While today's 50 runs, Keep searching waits.
  if (job.kind === 'fifty') {
    const beat = () => { if (R.running) api.storage.local.set({ fcFifty: { id: job.id, beat: Date.now() } }); };
    beat(); setInterval(beat, 20000);
  }
  for (const p of job.pics) {
    try {
      const rec = await RS_MEM.get(p.hash);
      R.known[p.i] = (rec && rec.scores) || {};
      // Only links found BEFORE this search count as "seen before".
      if (rec && rec.lastSearched && rec.lastSearched < job.created) R.prev[p.i] = rec;
      else if (rec && p.prevSnapshot) R.prev[p.i] = p.prevSnapshot;
    } catch (e) { /* ignore */ }
    if (!p.prevSnapshot && R.prev[p.i]) p.prevSnapshot = { lastSearched: R.prev[p.i].lastSearched, urls: R.prev[p.i].urls };
    for (const l of p.links) { l.pic = p.i; if ((l.sv !== SCORE_VERSION || l.pct === null) && !knownScore(p, l)) R.scoreQ.push(l); }   // older searches (and links an old version skipped) get checked
  }
  // Pages reopened later: anything that was mid-search is marked as not finished.
  for (const p of job.pics) for (const e of job.engines) if (['go', 'captcha'].includes(p.runs[e].state)) { p.runs[e].state = 'fail'; p.runs[e].why = 'The results window was closed or reloaded during this search.'; }
  if (!job.auto) await docsBanner(renderResults);
  renderResults();
  scoreAll();
  for (const p of job.pics) maybeIngest(p);
  if (!job.started) runJob();
  window.addEventListener('beforeunload', e => { if (R.running) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('pagehide', () => { if (saveTimer) saveJob(true); });
}

// =====================================================================================
// View 3: all searches
// =====================================================================================
async function renderPast() {
  const jobs = (await RS_DB.all('jobs')).sort((a, b) => b.created.localeCompare(a.created));
  await RS_LISTS.load();
  side(h('div', {}, h('div', { id: 'domain', text: 'All searches' }), h('div', { id: 'sub', text: 'The last 40 searches are kept. Every copy they found is also in All copies found.' })),
    h('div', { class: 'links' }, appLink('search', '🔎 New search'), appLink('found', '🗂 All copies found'), appLink('keep', '📂 Today\'s 50 and Keep searching')));
  const KIND = { keep: ' · Keep searching', fifty: ' · today\'s 50' };
  $('main').replaceChildren(h('h1', { text: plural(jobs.length, 'search', 'searches') }),
    jobs.length ? h('div', { class: 'tbl' }, jobs.map(j => {
      const links = j.pics.reduce((a, p) => a + p.links.filter(l => !RS_LISTS.isHidden(l.site, l.url) && isSame(l)).length, 0);
      const nNew = j.pics.reduce((a, p) => a + p.links.filter(l => l.isNew && isSame(l) && !RS_LISTS.isHidden(l.site, l.url)).length, 0);
      return h('div', { class: 'tr' }, h('img', { src: j.pics[0] && j.pics[0].thumb, alt: '' }),
        h('b', { text: new Date(j.created).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) + (KIND[j.kind] || (j.folder ? ' · daily 50' : '')) }),
        h('span', { text: plural(j.pics.length, 'picture') }), h('span', {}, plural(links, 'same-photo link'), nNew ? [' ', h('span', { class: 'tag new', text: nNew + ' new' })] : ''),
        h('span', {}, h('button', { class: 'btn', text: 'Open', onclick: () => goResults(j.id) })),
        h('button', { class: 'del', title: 'Delete this search from the list (the copies it found stay in All copies found)', text: '🗑', onclick: async () => {
          await RS_DB.del('jobs', j.id); renderPast();
          banner([h('b', { text: 'Search deleted. ' }), 'The copies it found are still in All copies found.', h('span', { class: 'sp' }), h('button', { text: '↶ Undo', onclick: async () => { await RS_DB.put('jobs', j.id, j); banner(null); renderPast(); } })], 'info');
        } }));
    })) : h('div', { class: 'none', text: 'No searches yet.' }));
}

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
