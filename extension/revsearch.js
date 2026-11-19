// Reverse image search: search many pictures on Google Lens, Yandex and Bing at once.
// One page, five views:
//   revsearch.html                -> pick pictures and press Search
//   revsearch.html?job=ID         -> the results window (also runs the searches)
//   revsearch.html?view=folder    -> "My pictures folder"
//   revsearch.html?view=lists     -> hidden and allowed sites
//   revsearch.html?view=past      -> past searches
// The searches run in normal tabs of your own browser. rsearch.js (on the Google, Yandex
// and Bing pages) hands each picture over and reads the links back.
const api = globalThis.browser || globalThis.chrome;
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
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
const page = q => api.runtime.getURL('revsearch.html' + (q ? '?' + q : ''));

async function getSettings() {
  const s = (await api.storage.local.get('rsSettings')).rsSettings || {};
  return { engines: { google: true, yandex: true, bing: true, ...(s.engines || {}) }, speed: SPEED[s.speed] ? s.speed : 'normal', closeTabs: !!s.closeTabs };
}
const setSettings = s => api.storage.local.set({ rsSettings: s });

// ---------- the Documents\PageProof folder banner ----------
async function docsBanner(after) {
  if (!RS_DOCS.supported) return false;
  const st = await RS_DOCS.state();
  if (st === 'granted') return false;
  if (sessionStorage.getItem('rsDocsLater') && VIEW !== 'lists' && VIEW !== 'folder') return false;
  const done = async () => { banner(null); await RS_LISTS.load(); if (after) after(); };
  if (st === 'prompt') {
    banner([h('span', {}, h('b', { text: 'One click needed: ' }), 'PageProof needs your OK to use its Documents\\PageProof folder (your hidden and allowed sites, and your pictures folder).'),
      h('span', { class: 'sp' }), h('button', { text: 'Allow', onclick: async () => { if (await RS_DOCS.allow()) done(); } })]);
  } else {
    banner([h('span', {}, h('b', { text: 'Keep your site lists safe: ' }), 'PageProof saves your hidden and allowed sites as text files in Documents\\PageProof, so updates and reinstalls never lose them. Press the button, then just press "Select Folder" (it opens in Documents). If the folder is already there from before, PageProof picks your lists straight back up.'),
      h('span', { class: 'sp' }), h('button', { text: '📂 Use Documents', onclick: async () => { try { await RS_DOCS.choose(); done(); } catch (e) { /* closed the picker */ } } }),
      VIEW !== 'lists' && VIEW !== 'folder' ? h('button', { class: 'btn', text: 'Not now', onclick: () => { sessionStorage.setItem('rsDocsLater', '1'); banner(null); } }) : null], 'info');
  }
  return true;
}

// =====================================================================================
// Getting pictures ready
// =====================================================================================
async function prepare(file, extra) {
  let bmp;
  try { bmp = await createImageBitmap(file); } catch (e) { return { error: file.name + ' could not be opened (HEIC and TIFF pictures need converting to JPG first, with Convert files)' }; }
  const w = bmp.width, hgt = bmp.height;
  // The copy sent to the search sites: big pictures are made smaller (the sites shrink them anyway).
  let blob = file;
  const max = 2000;
  if (Math.max(w, hgt) > max || file.size > 4e6 || !/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
    const f = Math.min(1, max / Math.max(w, hgt));
    const c = h('canvas', { width: Math.round(w * f), height: Math.round(hgt * f) });
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
    blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
  }
  const tf = Math.min(1, 240 / Math.max(w, hgt));
  const tc = h('canvas', { width: Math.max(1, Math.round(w * tf)), height: Math.max(1, Math.round(hgt * tf)) });
  tc.getContext('2d').drawImage(bmp, 0, 0, tc.width, tc.height);
  bmp.close && bmp.close();
  return { name: file.name, size: file.size, w, h: hgt, hash: await RS_UTIL.sha256(file), blob, thumb: tc.toDataURL('image/jpeg', 0.8), ...(extra || {}) };
}

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

// Start a search with these pictures: save it, then open the results window.
async function startJob(pics, opts) {
  const s = await getSettings();
  const engines = Object.keys(ENGINES).filter(e => s.engines[e]);
  if (!engines.length) { alert('Tick at least one site to search on.'); return null; }
  const job = {
    id: 'rs' + Date.now(), created: new Date().toISOString(), engines, speed: s.speed, closeTabs: s.closeTabs,
    folder: !!(opts && opts.folder), started: false,
    pics: pics.map((p, i) => ({ ...p, i, links: [], runs: Object.fromEntries(engines.map(e => [e, { state: 'wait' }])) })),
  };
  await RS_DB.put('jobs', job.id, job);
  // Keep the last 40 searches.
  try {
    const keys = (await RS_DB.keys('jobs')).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - 40))) await RS_DB.del('jobs', k);
  } catch (e) { /* ignore */ }
  await api.windows.create({ url: page('job=' + job.id), focused: true, width: Math.min(1500, screen.availWidth), height: Math.min(1000, screen.availHeight) });
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
  const tabs = h('div', { class: 'card' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: s.closeTabs, onchange: ev => { s.closeTabs = ev.target.checked; save(); } }), 'Close search tabs when done'),
    h('p', { class: 'hint', text: s.closeTabs ? 'On: only the PageProof results tab stays open. You can still open each search again from the results.' : 'Off: you keep a Google, Yandex and Bing tab for each picture, grouped by colour.' }));
  const n = draft.length, nEng = Object.values(s.engines).filter(Boolean).length;
  const secs = Math.round(n * (SPEED[s.speed].gap[0] + SPEED[s.speed].gap[1]) / 2000 / SPEED[s.speed].per + 15);
  const go = h('button', { class: 'big', disabled: !n || !nEng, text: '🔎 Search ' + (n ? plural(n, 'picture') : 'pictures'), onclick: async () => {
    go.disabled = true;
    const job = await startJob(draft.slice());
    if (job) { draft.length = 0; draftNotes = ['Search started in a new window. You can add more pictures for another search here.']; renderSetup(); }
    else go.disabled = false;
  } });
  side(h('div', {}, h('div', { id: 'domain', text: 'Reverse image search' }), h('div', { id: 'sub', text: 'Search many pictures at once on Google, Yandex and Bing.' })),
    engines, speed, tabs, go,
    n ? h('p', { class: 'hint', style: 'margin:-4px 0 0;text-align:center', text: 'About ' + (secs < 90 ? secs + ' seconds' : Math.round(secs / 60) + ' minutes') + ' for ' + plural(n, 'picture') + ' on ' + plural(nEng, 'site') }) : null,
    h('div', { class: 'links' },
      h('a', { href: page('view=folder'), text: '📂 My pictures folder' }),
      h('a', { href: page('view=past'), text: '📒 Past searches' }),
      h('a', { href: page('view=lists'), text: '🚫 Hidden and allowed sites' }),
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
      h('button', { class: 'btn', style: 'font-size:14px;padding:8px 16px', text: '📂 Or use my pictures folder', onclick: () => { location.href = page('view=folder'); } }),
      h('div', { class: 'ways' }, h('span', { text: 'Or drag pictures or a whole folder onto this page' }), h('span', { text: 'Or paste pictures or picture links (Ctrl+V)' }), h('span', { text: 'Up to ' + MAX_PICS + ' at once' })),
      h('div', { class: 'howbox' }, h('b', { text: 'What happens next:' }), h('ol', {},
        h('li', { text: 'PageProof opens one new window. Each picture gets its own coloured tab group with a Google, Yandex and Bing tab.' }),
        h('li', { text: 'The pictures are searched a few at a time, with short pauses, in your own browser. That keeps "are you a robot" checks away.' }),
        h('li', { text: 'Every link found is listed on one results page, with a % match. Hide the sites you never care about.' })))));
    return;
  }
  $('main').replaceChildren(
    h('div', {}, h('h1', { text: plural(draft.length, 'picture') + (busy ? ' (adding more…)' : ' ready') }), h('p', { class: 'lead', text: 'Numbers match the tab groups in the results window. Press ✕ to take a picture out.' })),
    notes,
    h('div', { class: 'pics' }, draft.map((p, i) => h('div', { class: 'pic' },
      h('img', { src: p.thumb, alt: '' }), h('span', { class: 'num', text: i + 1 }),
      h('button', { class: 'x', title: 'Take this picture out', text: '✕', onclick: () => { draft.splice(i, 1); renderSetup(); } }),
      h('div', { class: 'nm', text: p.name, title: p.name }), h('div', { class: 'sz', text: p.w + ' × ' + p.h + ' · ' + (p.size / 1e6).toFixed(1) + ' MB' })))),
    draft.length < MAX_PICS ? h('button', { class: 'addbtn small', text: '＋ Add more pictures', onclick: () => $('filePick').click() }) : null);
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
  groups: {}, prev: {}, sel: 0, filter: 'all', engineFilter: new Set(), text: '', showHidden: false, ticked: new Set(), scoreQ: [], scoring: false, origBmp: {} };

let saveTimer = null;
function saveJob(now) {
  clearTimeout(saveTimer);
  const go = () => RS_DB.put('jobs', job.id, job).catch(() => {});
  if (now) return go();
  saveTimer = setTimeout(go, 800);
}
let renderTimer = null;
function renderSoon() { if (renderTimer) return; renderTimer = setTimeout(() => { renderTimer = null; renderResults(); }, 250); }

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
  if (msg.type === 'rsStage') t.stage = msg.stage;
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
  try { tab = await api.tabs.create({ windowId: R.winId, url: ENGINES[engine].start, active: false }); }
  catch (e) { run.state = 'fail'; run.why = 'Could not open a tab'; renderSoon(); return; }
  run.tabId = tab.id;
  await groupTab(p, tab.id);
  await new Promise(done => R.tasks.set(tab.id, { p, engine, tabId: tab.id, stage: 'upload', deadline: Date.now() + TASK_TIMEOUT, done }));
}

function finishTask(t, state, why) {
  if (!R.tasks.has(t.tabId)) return;
  R.tasks.delete(t.tabId);
  const run = t.p.runs[t.engine];
  run.state = state;
  if (why) run.why = why; else delete run.why;
  if (t.captcha) { t.captcha = false; updatePause(t.engine); }
  if (picDone(t.p)) folderNote(t.p);
  saveJob(); renderSoon();
  if (job.closeTabs && state === 'done') api.tabs.remove(t.tabId).catch(() => {});
  t.done();
}

function updatePause(engine) {
  R.paused[engine] = [...R.tasks.values()].some(x => x.engine === engine && x.captcha);
  if (![...R.tasks.values()].some(x => x.captcha)) banner(null);
}

async function onCaptcha(t) {
  if (t.captcha) return;
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
  if (cur.pct === undefined && !R.scoreQ.includes(cur)) { cur.pic = p.i; R.scoreQ.push(cur); }
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
    const rec = (await RS_DB.get('seen', p.hash)) || { urls: {} };
    const today = RS_UTIL.today();
    for (const l of p.links) if (!rec.urls[l.key]) rec.urls[l.key] = today;
    rec.lastSearched = job.created;
    await RS_DB.put('seen', p.hash, rec);
  } catch (e) { /* ignore */ }
}

// Pictures that came from "My pictures folder": note when they were checked.
async function folderNote(p) {
  if (!job.folder) return;
  try {
    const old = (await RS_DB.get('folder', p.name)) || {};
    await RS_DB.put('folder', p.name, { ...old, hash: p.hash, lastChecked: job.created, links: p.links.length, newLinks: p.links.filter(l => l.isNew).length });
  } catch (e) { /* ignore */ }
}

// ---------- % match: line up each found picture with yours (same work as the Compare page) ----------
async function origBitmap(p) {
  if (R.origBmp[p.i]) return R.origBmp[p.i];
  const b = await createImageBitmap(p.blob);
  const f = Math.min(1, 640 / Math.max(b.width, b.height));
  const s = await createImageBitmap(b, { resizeWidth: Math.max(1, Math.round(b.width * f)), resizeHeight: Math.max(1, Math.round(b.height * f)), resizeQuality: 'high' });
  return (R.origBmp[p.i] = s);
}
async function fetchPicture(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(url, { signal: ctl.signal, credentials: 'omit' });
    if (!r.ok) return null;
    const b = await r.blob();
    if (b.size > 25e6) return null;
    return await createImageBitmap(b);
  } catch (e) { return null; } finally { clearTimeout(timer); }
}
async function scoreLink(l) {
  const p = job.pics[l.pic];
  let bmp = null, fromFull = false;
  if (l.img) { bmp = await fetchPicture(l.img); fromFull = !!bmp; }
  if (!bmp && l.thumb) bmp = await fetchPicture(l.thumb);
  if (!bmp) { l.pct = -1; return; }
  if (fromFull && !l.w) { l.w = bmp.width; l.h = bmp.height; }
  const f = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
  const small = f < 1 ? await createImageBitmap(bmp, { resizeWidth: Math.round(bmp.width * f), resizeHeight: Math.round(bmp.height * f), resizeQuality: 'high' }) : bmp;
  try {
    const best = await PP_ALIGN.align(await origBitmap(p), small);
    l.pct = best ? Math.max(0, Math.min(100, Math.round(best.sc.lines * 100))) : 0;
  } catch (e) { l.pct = 0; }
}
async function scoreAll() {
  if (R.scoring) return;
  R.scoring = true;
  try {
    while (R.scoreQ.length) {
      // Exact matches and the picture on screen go first.
      R.scoreQ.sort((a, b) => (b.pic === R.sel) - (a.pic === R.sel) || b.exact - a.exact);
      const l = R.scoreQ.shift();
      if (l.pct !== undefined) continue;
      const p = job.pics[l.pic];
      if (p.links.filter(x => x.pct !== undefined).length >= 60) { l.pct = null; continue; }   // enough for one picture
      await scoreLink(l);
      saveJob(); renderSoon();
      await sleep(30);
    }
  } finally { R.scoring = false; }
}

// ---------- running the whole search ----------
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
          await runOne(p, e);
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
const isExact = l => l.exact || (l.pct != null && l.pct >= 85);
function linkScore(l) { return (l.isNew ? 1000 : 0) + (l.pct > 0 ? l.pct : 0) + (isExact(l) ? 50 : 0); }

function visibleLinks(p, opts = {}) {
  return p.links.filter(l => {
    const hidden = RS_LISTS.isHidden(l.site);
    if (hidden && !(opts.withHidden ?? R.showHidden)) return false;
    if (opts.raw) return true;
    if (R.filter === 'new' && !l.isNew) return false;
    if (R.filter === 'exact' && !isExact(l)) return false;
    if (R.filter === 'similar' && isExact(l)) return false;
    if (R.engineFilter.size && !l.engines.some(e => R.engineFilter.has(e))) return false;
    if (R.text) { const q = R.text.toLowerCase(); if (!(l.site + ' ' + l.title + ' ' + l.url).toLowerCase().includes(q)) return false; }
    return true;
  });
}
const shownCount = p => visibleLinks(p, { raw: true, withHidden: false }).length;

function statusLine(p) {
  const bits = job.engines.map(e => {
    const r = p.runs[e], n = ENGINES[e].short;
    if (r.state === 'done') return n + ' ' + p.links.filter(l => l.engines.includes(e) && !RS_LISTS.isHidden(l.site)).length;
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
      h('p', { class: 'hint', text: 'You can keep working in your other windows. Leave this window open until it finishes.' }))
    : h('div', {}, h('div', { id: 'domain', text: plural(total, 'picture') + ' searched' }),
      h('div', { id: 'sub', text: when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) + ' · ' + plural(links, 'link') + ' on ' + plural(sites, 'site') }));
  const list = h('div', { class: 'card plist' }, job.pics.map(p => {
    const n = shownCount(p), nNew = p.links.filter(l => l.isNew && !RS_LISTS.isHidden(l.site)).length;
    const state = picDone(p) ? h('span', { class: 'cnt' + (n ? '' : ' z') + (nNew ? ' newc' : ''), text: nNew ? n + ' · ' + nNew + ' new' : n })
      : runList(p).some(r => r.state === 'captcha') ? h('span', { class: 'st bad', text: 'Check!' })
      : picBusy(p) ? h('span', { class: 'st go', text: 'Searching' }) : h('span', { class: 'st wait', text: 'Waiting' });
    return h('button', { class: 'pitem' + (p.i === R.sel ? ' on' : ''), onclick: () => { R.sel = p.i; R.ticked.clear(); renderResults(); scoreAll(); window.scrollTo(0, 0); } },
      h('img', { src: p.thumb, alt: '' }), h('div', { class: 'n' }, h('b', { text: (p.i + 1) + '. ' + p.name }), h('small', { text: statusLine(p) })), state);
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
    h('a', { href: page(), target: '_blank', text: '🔎 New search' }),
    h('a', { href: page('view=lists'), target: '_blank', text: '🚫 Hidden and allowed sites' }),
    h('a', { href: page('view=past'), target: '_blank', text: '📒 Past searches' })));
}

function rowFor(p, l) {
  const hidden = RS_LISTS.isHidden(l.site), allowed = RS_LISTS.isAllowed(l.site);
  const id = p.i + '|' + l.key;
  const pct = l.pct === undefined ? h('span', { class: 'pct no', text: 'Checking match…' })
    : l.pct === null ? h('span', { class: 'pct no', text: 'Not checked' })
    : l.pct < 0 ? h('span', { class: 'pct no', title: 'The site would not let PageProof download the picture', text: 'Picture blocked, no %' })
    : h('span', { class: 'pct ' + (l.pct >= 85 ? 'hi' : l.pct >= 40 ? 'mid' : 'lo'), title: 'How much of the area the two pictures share lines up detail for detail (like the Compare page)', text: l.pct + '% match' });
  const sz = sizeNote(p, l);
  return h('div', { class: 'row' + (l.firstSeen ? ' seen' : '') + (allowed ? ' allowed' : '') },
    h('input', { type: 'checkbox', checked: R.ticked.has(id), onchange: e => { if (e.target.checked) R.ticked.add(id); else R.ticked.delete(id); renderSelbar(); } }),
    l.thumb ? h('img', { class: 'th', src: l.thumb, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer', onerror: e => e.target.replaceWith(h('div', { class: 'th' })) }) : h('div', { class: 'th' }),
    h('div', { class: 't' }, h('a', { href: l.url, target: '_blank', rel: 'noreferrer', text: l.title || l.url, title: l.title || l.url }),
      h('small', { text: (l.firstSeen ? 'Seen before, first found ' + RS_UTIL.niceDate(l.firstSeen) + ' · ' : '') + l.url })),
    h('div', { class: 'mt' }, pct, h('small', {}, l.w ? l.w + ' × ' + l.h : 'size unknown', sz.text ? ' · ' : '', sz.strong ? h('b', { text: sz.text }) : sz.text)),
    h('div', { class: 'tags' },
      hidden ? h('span', { class: 'tag hid', text: 'Hidden' }) : null,
      l.isNew ? h('span', { class: 'tag new', text: 'New' }) : null,
      h('span', { class: 'tag ' + (isExact(l) ? 'ex' : 'sim'), text: isExact(l) ? 'Exact match' : 'Similar' }),
      l.engines.map(e => h('span', { class: 'tag ' + e, text: ENGINES[e].short })),
      h('span', { class: 'act' }, h('button', { text: 'Open', onclick: () => openTab(l.url) }),
        h('button', { text: '📸 Capture', title: 'Save this page as an evidence pack (batch capture)', onclick: () => captureLinks([l.url]) }))));
}

function renderSelbar() {
  const bar = $('selbar');
  if (!bar) return;
  const p = job.pics[R.sel];
  const urls = p.links.filter(l => R.ticked.has(p.i + '|' + l.key)).map(l => l.url);
  bar.hidden = !urls.length;
  bar.replaceChildren(h('span', {}, '✓ ', h('b', { text: plural(urls.length, 'link') + ' ticked' })), h('span', { class: 'sp' }),
    h('button', { class: 'btn', text: 'Untick all', onclick: () => { R.ticked.clear(); renderResults(); } }),
    h('button', { class: 'btn', text: 'Copy links', onclick: () => navigator.clipboard.writeText(urls.join('\n')) }),
    h('button', { class: 'btn green', text: '📸 Capture ' + plural(urls.length, 'ticked page'), onclick: () => captureLinks(urls) }));
}

function renderList() {
  const p = job.pics[R.sel];
  const links = visibleLinks(p);
  const bySite = new Map();
  for (const l of links) { if (!bySite.has(l.site)) bySite.set(l.site, []); bySite.get(l.site).push(l); }
  const groups = [...bySite.entries()].map(([site, ls]) => [site, ls.sort((a, b) => linkScore(b) - linkScore(a))])
    .sort((a, b) => linkScore(b[1][0]) - linkScore(a[1][0]));
  const box = $('rlist');
  if (!groups.length) {
    const searching = picBusy(p) || runList(p).some(r => r.state === 'wait');
    box.replaceChildren(h('div', { class: 'none', text: searching ? 'Searching… links appear here as each site answers.' : p.links.length ? 'No links match these filters.' : 'No matches found for this picture.' }));
    return;
  }
  box.replaceChildren(...groups.map(([site, ls]) => {
    const hidden = RS_LISTS.isHidden(site), allowed = RS_LISTS.isAllowed(site);
    const after = () => { renderResults(); };
    return h('div', { class: 'site' + (allowed ? ' allowed' : '') + (hidden ? ' hiddenSite' : '') },
      h('div', { class: 'sh' }, h('b', { text: site }), allowed ? h('span', { class: 'tag ok', text: '✓ Allowed' }) : null, h('span', { class: 'n', text: plural(ls.length, 'link') }),
        h('span', { class: 'acts' },
          hidden ? h('button', { class: 'allowB', text: 'Show again', onclick: () => RS_LISTS.remove('hidden', site).then(after) })
            : allowed ? h('button', { class: 'allowB', text: 'Remove from allowed', onclick: () => RS_LISTS.remove('allowed', site).then(after) })
              : [h('button', { class: 'allowB', title: 'Your own site or a licensee: keep showing it, with a green label', text: '✓ Mark allowed', onclick: () => RS_LISTS.add('allowed', site).then(after) }),
                h('button', { class: 'hideB', title: 'Never show links from ' + site + ' again, for any picture', text: '🚫 Hide this site', onclick: () => RS_LISTS.add('hidden', site).then(after) })])),
      ls.map(l => rowFor(p, l)));
  }));
}

function renderResults() {
  if (!job) return;
  resultsSide();
  const p = job.pics[R.sel];
  // While typing in the search box, only redraw the list.
  if (document.activeElement && document.activeElement.id === 'rtext' && $('rlist')) { renderList(); renderSelbar(); return; }
  const all = visibleLinks(p, { raw: true, withHidden: false });
  const nNew = all.filter(l => l.isNew).length, nEx = all.filter(isExact).length;
  const prev = R.prev[p.i] && R.prev[p.i].lastSearched;
  const hiddenHere = [...new Set(p.links.filter(l => RS_LISTS.isHidden(l.site)).map(l => RS_LISTS.hidden.find(d => RS_SITE.inList(l.site, [d]))))];
  const nHiddenLinks = p.links.filter(l => RS_LISTS.isHidden(l.site)).length;
  const fbtn = (k, label, cls) => h('button', { class: (cls || '') + (R.filter === k ? ' on' : ''), text: label, onclick: () => { R.filter = k; renderResults(); } });
  const tabBtn = e => {
    const r = p.runs[e];
    if (!r || (!r.tabId && !r.pageUrl)) return null;
    return h('button', { class: 'btn', onclick: async () => {
      try { if (r.tabId) { await api.tabs.update(r.tabId, { active: true }); return; } } catch (err) { /* closed */ }
      if (r.pageUrl) openTab(r.pageUrl);
    } }, fav(e), ' ' + ENGINES[e].short + ' tab');
  };
  const problems = job.engines.map(e => p.runs[e]).filter(r => r.why && r.state !== 'done').map(r => r.why);
  $('main').replaceChildren(
    h('div', { class: 'rhead' }, h('img', { src: p.thumb, alt: '' }), h('div', { class: 'meta' },
      h('h1', { text: (p.i + 1) + '. ' + p.name }),
      h('p', { class: 'lead' }, h('b', { text: plural(all.length, 'link') }), ' on ', h('b', { text: plural(new Set(all.map(l => l.site)).size, 'site') }),
        prev ? [' · ', h('b', { style: 'color:#92400e', text: nNew + ' new' }), ' since ' + RS_UTIL.niceDate(prev)] : ' · first search for this picture',
        ' · your file is ' + p.w + ' × ' + p.h),
      h('div', { class: 'btns' }, job.engines.map(tabBtn), h('small', { text: 'Sorted: new first, then best match' })),
      problems.length ? h('p', { class: 'note', text: [...new Set(problems)].join(' ') }) : null)),
    h('div', { class: 'ftabs' }, fbtn('all', 'All ' + all.length), fbtn('new', '⭐ New ' + nNew, 'newf'), fbtn('exact', 'Exact matches ' + nEx), fbtn('similar', 'Similar ' + (all.length - nEx)),
      h('span', { class: 'sp' }),
      job.engines.map(e => h('button', { class: R.engineFilter.has(e) ? 'on' : '', text: ENGINES[e].short, title: 'Only links found by ' + ENGINES[e].short + ' (click again to undo)',
        onclick: () => { if (R.engineFilter.has(e)) R.engineFilter.delete(e); else R.engineFilter.add(e); renderResults(); } })),
      h('input', { id: 'rtext', type: 'search', placeholder: '🔎 Find a site or word', value: R.text, oninput: e => { R.text = e.target.value; renderList(); } })),
    h('div', { class: 'hidebar' }, '🚫 Hidden sites:',
      hiddenHere.length ? hiddenHere.map(d => h('span', { class: 'chip' }, d, h('button', { title: 'Show ' + d + ' again', text: '✕', onclick: () => RS_LISTS.remove('hidden', d).then(renderResults) })))
        : h('span', { text: RS_LISTS.hidden.length ? ' none for this picture' : ' none yet. Press "Hide this site" on any site you never care about.' }),
      nHiddenLinks ? h('span', { style: 'color:#64748b', text: '· ' + plural(nHiddenLinks, 'link') + ' hidden for this picture' }) : null,
      nHiddenLinks ? h('button', { class: 'lnk', text: R.showHidden ? 'Hide them again' : 'Show them', onclick: () => { R.showHidden = !R.showHidden; renderResults(); } })
        : h('a', { class: 'lnk', href: page('view=lists'), target: '_blank', text: 'Manage lists', style: 'margin-left:auto;font-weight:600;text-decoration:none' })),
    h('div', { class: 'list', id: 'rlist' }),
    h('div', { class: 'selbar', id: 'selbar', hidden: true }));
  renderList(); renderSelbar();
}

async function captureLinks(urls) {
  await api.storage.local.set({ batchPrefill: urls });
  openTab(api.runtime.getURL('batch.html'));
}

// ---------- saving the results ----------
const stamp = () => new Date(job.created).toISOString().slice(0, 16).replace(/[:T]/g, '-');
function saveCsv() {
  const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const rows = [['Picture #', 'Picture', 'Site', 'Page title', 'Link', 'Found by', 'Exact or similar', '% match', 'Copy size', 'Size note', 'New', 'Allowed site', 'First found', 'Searched']];
  for (const p of job.pics) {
    for (const l of visibleLinks(p, { raw: true, withHidden: false }).sort((a, b) => linkScore(b) - linkScore(a))) {
      rows.push([p.i + 1, p.name, l.site, l.title, l.url, l.engines.map(e => ENGINES[e].short).join(' + '), isExact(l) ? 'Exact' : 'Similar',
        l.pct > 0 || l.pct === 0 ? l.pct + '%' : '', l.w ? l.w + ' x ' + l.h : '', sizeNote(p, l).text, l.isNew ? 'New' : '', RS_LISTS.isAllowed(l.site) ? 'Allowed' : '',
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
  x.fillText('% match = how much of the area the two pictures share lines up detail for detail (a guide; check by eye).', M, y); y += 40;
  for (const p of job.pics) {
    const links = visibleLinks(p, { raw: true, withHidden: false }).sort((a, b) => linkScore(b) - linkScore(a));
    if (y > H - 260) newPage();
    const img = await loadImg(p.thumb);
    if (img) { const s = Math.min(120 / img.width, 120 / img.height); x.drawImage(img, M, y, img.width * s, img.height * s); }
    x.fillStyle = '#0f172a'; x.font = 'bold 26px system-ui, sans-serif'; x.fillText(fit((p.i + 1) + '. ' + p.name, W - 2 * M - 140), M + 140, y + 30);
    x.font = '19px system-ui, sans-serif'; x.fillStyle = '#475569';
    x.fillText(p.w + ' × ' + p.h + ' · ' + plural(links.length, 'link') + ' on ' + plural(new Set(links.map(l => l.site)).size, 'site') + ' · ' + links.filter(l => l.isNew).length + ' new', M + 140, y + 62);
    x.fillText('SHA-256 ' + p.hash.slice(0, 32) + '…', M + 140, y + 90);
    y += 140;
    if (!links.length) { x.fillText('No matches found.', M, y); y += 40; }
    for (const l of links) {
      if (y > H - 90) newPage();
      x.fillStyle = l.isNew ? '#92400e' : '#0f172a'; x.font = 'bold 19px system-ui, sans-serif';
      x.fillText(fit((l.isNew ? '[NEW] ' : '') + (RS_LISTS.isAllowed(l.site) ? '[ALLOWED] ' : '') + (l.title || l.site), W - 2 * M - 260), M, y);
      x.textAlign = 'right'; x.font = 'bold 19px system-ui, sans-serif';
      x.fillStyle = l.pct >= 85 ? '#15803d' : l.pct >= 40 ? '#b45309' : '#64748b';
      x.fillText(l.pct >= 0 && l.pct !== null && l.pct !== undefined ? l.pct + '% match' : 'no %', W - M, y);
      x.textAlign = 'left'; x.font = '16px system-ui, sans-serif'; x.fillStyle = '#2563eb';
      x.fillText(fit(l.url, W - 2 * M), M, y + 24);
      x.fillStyle = '#64748b';
      const sz = sizeNote(p, l);
      x.fillText(fit([isExact(l) ? 'Exact match' : 'Similar', 'found by ' + l.engines.map(e => ENGINES[e].short).join(' + '), l.w ? l.w + ' × ' + l.h + (sz.text ? ' (' + sz.text + ')' : '') : '', l.firstSeen ? 'first found ' + RS_UTIL.niceDate(l.firstSeen) : ''].filter(Boolean).join(' · '), W - 2 * M), M, y + 46);
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
  try { const me = await api.tabs.getCurrent(); R.myTab = me.id; R.winId = me.windowId; } catch (e) { /* ignore */ }
  for (const p of job.pics) {
    try {
      const rec = await RS_DB.get('seen', p.hash);
      // Only links found BEFORE this search count as "seen before".
      if (rec && rec.lastSearched && rec.lastSearched < job.created) R.prev[p.i] = rec;
      else if (rec && p.prevSnapshot) R.prev[p.i] = p.prevSnapshot;
    } catch (e) { /* ignore */ }
    if (!p.prevSnapshot && R.prev[p.i]) p.prevSnapshot = { lastSearched: R.prev[p.i].lastSearched, urls: R.prev[p.i].urls };
    for (const l of p.links) { l.pic = p.i; if (l.pct === undefined) R.scoreQ.push(l); }
  }
  // Pages reopened later: anything that was mid-search is marked as not finished.
  for (const p of job.pics) for (const e of job.engines) if (['go', 'captcha'].includes(p.runs[e].state)) { p.runs[e].state = 'fail'; p.runs[e].why = 'The results window was closed or reloaded during this search.'; }
  await docsBanner(renderResults);
  renderResults();
  scoreAll();
  if (!job.started) runJob();
  window.addEventListener('beforeunload', e => { if (R.running) { e.preventDefault(); e.returnValue = ''; } });
}

// =====================================================================================
// View 3: My pictures folder
// =====================================================================================
async function picsDir() {
  const custom = await RS_DB.get('handles', 'pics').catch(() => null);
  if (custom) {
    const st = await custom.queryPermission({ mode: 'readwrite' }).catch(() => 'denied');
    return { dir: st === 'granted' ? custom : null, state: st, custom, label: custom.name };
  }
  const st = await RS_DOCS.state();
  if (st !== 'granted') return { dir: null, state: st, label: 'Documents\\PageProof\\My pictures' };
  const docs = await RS_DOCS.handle();
  return { dir: await docs.getDirectoryHandle('My pictures', { create: true }), state: 'granted', label: 'Documents\\PageProof\\My pictures' };
}

async function folderPictures(dir) {
  const out = [];
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === 'file' && RS_UTIL.IMAGE_EXT.test(name)) out.push({ name, handle, note: (await RS_DB.get('folder', name).catch(() => null)) || {} });
  }
  // Due order: never checked first, then the ones checked longest ago.
  out.sort((a, b) => (a.note.lastChecked || '').localeCompare(b.note.lastChecked || '') || a.name.localeCompare(b.name));
  return out;
}

async function getDaily() {
  const d = (await api.storage.local.get('rsDaily')).rsDaily || {};
  return { mode: d.mode || 'remind', time: d.time || '09:00', perDay: d.perDay || 30, lastRun: d.lastRun || '' };
}

let folderFilter = 'all';
async function renderFolder(autoStart) {
  const F = await picsDir();
  const daily = await getDaily();
  const setDaily = async ch => { await api.storage.local.set({ rsDaily: { ...daily, ...ch } }); renderFolder(); };
  const today = RS_UTIL.today();
  if (!F.dir) {
    side(h('div', {}, h('div', { id: 'domain', text: 'My pictures folder' }), h('div', { id: 'sub', text: 'Keep your pictures in one folder on this PC. PageProof checks some of them each day, only when you say so.' })),
      h('div', { class: 'links' }, h('a', { href: page(), text: '🔎 Reverse image search' }), h('a', { href: page('view=lists'), text: '🚫 Hidden and allowed sites' })));
    const needAllow = F.state === 'prompt';
    $('main').replaceChildren(h('div', { class: 'empty' }, h('div', { class: 'ic', text: '📂' }),
      h('h1', { text: needAllow ? 'One click to open your pictures folder' : 'Set up your pictures folder' }),
      h('p', { class: 'lead', text: needAllow ? 'Your browser asks once after it restarts. Press Allow and PageProof opens ' + F.label + '.'
        : 'Press the button, then press "Select Folder". It opens in Documents. PageProof makes a PageProof\\My pictures folder there (or uses the one you already have).' }),
      !RS_DOCS.supported ? h('p', { class: 'note', text: 'This needs Chrome or Edge. Firefox does not let extensions use folders on your computer.' })
        : h('button', { class: 'addbtn', text: needAllow ? 'Allow' : '📂 Use Documents', onclick: async () => {
          try {
            if (needAllow) { if (F.custom) await F.custom.requestPermission({ mode: 'readwrite' }); else await RS_DOCS.allow(); }
            else await RS_DOCS.choose();
            await RS_LISTS.load(); banner(null); renderFolder(autoStart);
          } catch (e) { /* closed the picker */ }
        } }),
      h('button', { class: 'btn', text: 'Use a different folder instead', onclick: chooseOtherFolder })));
    if (autoStart) banner([h('b', { text: 'Time for today\'s picture check. ' }), 'Press Allow above and it starts.'], 'info');
    return;
  }
  if (!(await api.storage.local.get('rsDaily')).rsDaily) await api.storage.local.set({ rsDaily: daily });   // turns the daily reminder on
  const pics = await folderPictures(F.dir);
  const checkedToday = pics.filter(x => (x.note.lastChecked || '').slice(0, 10) === today).length;
  const due = pics.filter(x => (x.note.lastChecked || '').slice(0, 10) !== today);
  const todays = due.slice(0, Math.max(0, daily.perDay - checkedToday));
  const never = pics.filter(x => !x.note.lastChecked).length;
  const withNew = pics.filter(x => x.note.newLinks > 0).length;
  const last = pics.map(x => x.note.lastChecked || '').sort().pop();
  const cycle = Math.max(1, Math.ceil(pics.length / daily.perDay));
  const start = async () => {
    banner([h('b', { text: 'Getting ' + plural(todays.length, 'picture') + ' ready…' })], 'info');
    const ready = [];
    for (const x of todays) {
      try { const p = await prepare(await x.handle.getFile()); if (!p.error) ready.push(p); } catch (e) { /* unreadable */ }
    }
    if (!ready.length) { banner([h('b', { text: 'None of today\'s pictures could be opened.' })], 'bad'); return; }
    await api.storage.local.set({ rsDaily: { ...daily, lastRun: today } });
    await startJob(ready, { folder: true });
    banner([h('b', { text: 'Search started in a new window. ' }), 'This list updates as each picture finishes. Press Refresh to see it.', h('span', { class: 'sp' }), h('button', { text: 'Refresh', onclick: () => { banner(null); renderFolder(); } })], 'info');
  };
  side(h('div', {}, h('div', { id: 'domain', text: 'My pictures folder' }), h('div', { id: 'sub', class: 'path', text: '📂 ' + F.label })),
    h('div', { class: 'card' }, h('div', { style: 'font-size:14px' }, h('b', { text: plural(pics.length, 'picture') }), never ? ' · ' + never + ' never checked' : ''),
      h('div', { class: 'hint', style: 'margin-top:2px', text: last ? 'Last check: ' + new Date(last).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not checked yet' })),
    h('button', { class: 'big', disabled: !todays.length, text: todays.length ? '🔎 Check today\'s ' + todays.length : '✓ All done for today', onclick: start }),
    h('p', { class: 'hint', style: 'margin:-4px 0 0;text-align:center', text: 'New pictures first, then the ones checked longest ago.' + (pics.length ? ' All ' + pics.length + ' get checked ' + (cycle === 1 ? 'every day' : 'every ' + cycle + ' days') + '.' : '') }),
    h('div', { class: 'card' }, h('h3', { text: 'Every day' }), h('div', { class: 'radio' },
      h('label', {}, h('input', { type: 'radio', name: 'dm', checked: daily.mode === 'remind', onchange: () => setDaily({ mode: 'remind' }) }), 'Remind me at'),
      h('label', {}, h('input', { type: 'radio', name: 'dm', checked: daily.mode === 'auto', onchange: () => setDaily({ mode: 'auto' }) }), 'Start by itself at'),
      h('label', {}, h('input', { type: 'radio', name: 'dm', checked: daily.mode === 'off', onchange: () => setDaily({ mode: 'off' }) }), 'Only when I press the button')),
      daily.mode !== 'off' ? h('div', { style: 'margin-top:6px;font-size:13px' }, 'Time: ', h('input', { type: 'time', value: daily.time, onchange: e => e.target.value && setDaily({ time: e.target.value }) })) : null,
      h('p', { class: 'hint', text: 'Chrome has to be open. A reminder is safest: you are there if Google asks for a robot check.' })),
    h('div', { class: 'card' }, h('h3', { text: 'Pictures per day' }), h('div', { class: 'seg' }, [15, 30, 50].map(n => h('button', { class: daily.perDay === n ? 'on' : '', text: n, onclick: () => setDaily({ perDay: n }) })))),
    h('div', { class: 'links' },
      h('button', { text: '📂 Use a different folder', onclick: chooseOtherFolder }),
      F.custom ? h('button', { text: '📂 Go back to Documents\\PageProof\\My pictures', onclick: async () => { await RS_DB.del('handles', 'pics'); renderFolder(); } }) : null,
      h('a', { href: page(), text: '🔎 Reverse image search' }),
      h('a', { href: page('view=lists'), text: '🚫 Hidden and allowed sites' }),
      h('a', { href: page('view=past'), text: '📒 Past searches' })));

  const addFiles = async files => {
    const list = [...files].filter(f => /^image\//.test(f.type) || RS_UTIL.IMAGE_EXT.test(f.name));
    if (!list.length) return;
    banner([h('b', { text: 'Adding ' + plural(list.length, 'picture') + ' to your folder…' })], 'info');
    let added = 0, same = 0;
    for (const f of list) {
      let name = f.name.replace(/[\\/:*?"<>|]/g, '_');
      try {
        const exists = await F.dir.getFileHandle(name).then(x => x.getFile()).catch(() => null);
        if (exists && exists.size === f.size) { same++; continue; }
        if (exists) { const dot = name.lastIndexOf('.'); name = name.slice(0, dot) + ' (' + Date.now().toString(36) + ')' + name.slice(dot); }
        const w = await (await F.dir.getFileHandle(name, { create: true })).createWritable();
        await w.write(f); await w.close(); added++;
      } catch (e) { /* skip */ }
    }
    banner(added ? [h('b', { text: plural(added, 'picture') + ' added to ' + F.label + '.' }), same ? ' ' + plural(same, 'picture was', 'pictures were') + ' already there.' : '', ' New pictures are checked first.']
      : [h('b', { text: same === 1 ? 'That picture is already in your folder.' : 'Those pictures are already in your folder.' })], 'info');
    renderFolder();
  };
  folderAddFiles = addFiles;
  const nextCheck = idx => {
    const x = pics[idx];
    if ((x.note.lastChecked || '').slice(0, 10) === today) return 'Checked today';
    const pos = due.indexOf(x);
    const d = Math.floor((pos + checkedToday) / daily.perDay);
    return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : 'In ' + d + ' days';
  };
  const shown = pics.map((x, i) => [x, i]).filter(([x]) => folderFilter === 'all' || (folderFilter === 'new' && x.note.newLinks > 0) || (folderFilter === 'never' && !x.note.lastChecked) || (folderFilter === 'today' && todays.includes(x)));
  const fb = (k, label, cls) => h('button', { class: (cls || '') + (folderFilter === k ? ' on' : ''), text: label, onclick: () => { folderFilter = k; renderFolder(); } });
  $('main').replaceChildren(
    h('div', {}, h('h1', { text: plural(pics.length, 'picture') + ' in your folder' }),
      h('p', { class: 'lead', text: 'Add pictures with the button, by dragging them onto this page, or straight into the folder in File Explorer.' })),
    h('button', { class: 'addbtn', text: '＋ Add pictures to this folder', onclick: () => $('folderAdd').click() }),
    h('div', { class: 'ftabs' }, fb('all', 'All ' + pics.length), fb('new', '⭐ Have new links ' + withNew, 'newf'), fb('never', 'Never checked ' + never), fb('today', 'Due today ' + todays.length)),
    shown.length ? h('div', { class: 'tbl' },
      h('div', { class: 'tr h' }, h('span'), h('span', { text: 'Picture' }), h('span', { text: 'Last checked' }), h('span', { text: 'Links found' }), h('span', { text: 'Next check' }), h('span')),
      shown.map(([x, i]) => {
        const img = h('img', { alt: '', loading: 'lazy' });
        x.handle.getFile().then(f => { img.src = URL.createObjectURL(f); }).catch(() => {});
        return h('div', { class: 'tr' }, img, h('b', { text: x.name, title: x.name }),
          x.note.lastChecked ? h('span', { text: RS_UTIL.niceDate(x.note.lastChecked) }) : h('span', {}, h('span', { class: 'tag new', text: 'Never checked' })),
          h('span', {}, x.note.lastChecked ? String(x.note.links || 0) : '·', x.note.newLinks ? [' ', h('span', { class: 'tag new', text: '+' + x.note.newLinks + ' new' })] : ''),
          h('span', { class: /^Today/.test(nextCheck(i)) ? 'due' : '', text: nextCheck(i) }), h('span'));
      })) : h('div', { class: 'none', text: pics.length ? 'No pictures match this filter.' : 'Your folder is empty. Add some pictures to get started.' }));
  if (autoStart && todays.length && daily.lastRun !== today) start();
}
let folderAddFiles = null;

async function chooseOtherFolder() {
  try {
    const d = await window.showDirectoryPicker({ id: 'pageproof-pics', mode: 'readwrite', startIn: 'pictures' });
    await RS_DB.put('handles', 'pics', d);
    renderFolder();
  } catch (e) { /* closed the picker */ }
}

// =====================================================================================
// View 4: hidden and allowed sites
// =====================================================================================
async function renderLists() {
  await RS_LISTS.load();
  const st = RS_LISTS.fileState;
  const fileCard = h('div', { class: 'card' }, h('h3', { text: 'Saved files' }),
    h('div', { class: 'path' }, '📄 Documents\\PageProof\\hidden-sites.txt', h('br'), '📄 Documents\\PageProof\\allowed-sites.txt'),
    h('div', { class: st === 'granted' ? 'ok' : 'warn', style: 'margin-top:4px;font-size:13px', text: st === 'granted' ? '✓ Found and in use' : st === 'prompt' ? 'Needs one click on Allow' : RS_DOCS.supported ? 'Not set up yet' : 'Not available in this browser' }),
    h('p', { class: 'hint', text: st === 'granted' ? 'PageProof reads both files every time it searches, so changes you make in Notepad count straight away.' : 'Until then the lists are kept inside the browser only.' }));
  const firstBtn = !RS_DOCS.supported ? null : st === 'granted'
    ? h('button', { class: 'big', text: '📂 Use a different folder', onclick: async () => { try { await RS_DOCS.choose(); renderLists(); } catch (e) { /* closed */ } } })
    : st === 'prompt' ? h('button', { class: 'big', text: 'Allow', onclick: async () => { await RS_DOCS.allow(); banner(null); renderLists(); } })
      : h('button', { class: 'big', text: '📂 Use Documents', onclick: async () => { try { await RS_DOCS.choose(); banner(null); renderLists(); } catch (e) { /* closed */ } } });
  side(h('div', {}, h('div', { id: 'domain', text: 'Hidden and allowed sites' }), h('div', { id: 'sub', text: 'Hidden sites never show. Allowed sites show with a green label.' })),
    fileCard, firstBtn,
    h('div', { class: 'grid2' },
      h('button', { class: 'ghost', text: '💾 Save a copy', onclick: () => { download(new Blob([RS_LISTS.text('hidden')], { type: 'text/plain' }), 'hidden-sites.txt'); setTimeout(() => download(new Blob([RS_LISTS.text('allowed')], { type: 'text/plain' }), 'allowed-sites.txt'), 400); } }),
      h('button', { class: 'ghost', text: '📂 Load a file', title: 'Adds the sites in a hidden-sites.txt or allowed-sites.txt file', onclick: () => $('listLoad').click() })),
    h('p', { class: 'hint', text: 'Load a file adds its sites (a file called allowed-sites.txt goes to Allowed, anything else to Hidden). Nothing is removed unless you press ✕.' }),
    h('div', { class: 'links' }, h('a', { href: page(), text: '🔎 Reverse image search' }), h('a', { href: page('view=folder'), text: '📂 My pictures folder' })));
  const input = h('input', { type: 'text', placeholder: 'Type a site, like pinterest.com' });
  const add = async kind => { if (await RS_LISTS.add(kind, input.value)) { input.value = ''; renderLists(); } else input.focus(); };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') add('hidden'); });
  const rows = (kind, empty) => RS_LISTS[kind].length ? h('div', { class: 'site' + (kind === 'allowed' ? ' allowed' : '') },
    RS_LISTS[kind].map(d => h('div', { class: 'lrow' }, h('b', { text: d }), h('button', { class: 'btn', text: kind === 'hidden' ? '✕ Show again' : '✕ Remove', onclick: () => RS_LISTS.remove(kind, d).then(renderLists) }))))
    : h('div', { class: 'none', text: empty });
  $('main').replaceChildren(
    h('div', {}, h('h1', { text: plural(RS_LISTS.hidden.length, 'hidden site') }), h('p', { class: 'lead', text: 'Each site is one line in the text file. A whole site is hidden, including its www and mobile versions (m.facebook.com).' })),
    h('div', { class: 'addsite' }, input, h('button', { class: 'btn blue', text: '🚫 Hide it', onclick: () => add('hidden') }), h('button', { class: 'btn', style: 'color:#166534;border-color:#86efac', text: '✓ Allow it', onclick: () => add('allowed') })),
    rows('hidden', 'No hidden sites yet. Type one above, or press "Hide this site" in your results.'),
    h('h2', { class: 'sec' }, plural(RS_LISTS.allowed.length, 'allowed site'), ' ', h('span', { class: 'tag ok', text: '✓ Allowed' })),
    h('p', { class: 'lead', text: 'Your own site, licensees and anyone else allowed to use the pictures. Their links still show, with a green label, so real copies stand out.' }),
    rows('allowed', 'No allowed sites yet.'),
    h('div', { class: 'howbox', style: 'max-width:none' }, h('b', { text: 'What hidden-sites.txt looks like' }), ' (open it in Notepad to read or change it):', h('pre', { class: 'txt', text: RS_LISTS.text('hidden') })));
}

// =====================================================================================
// View 5: past searches
// =====================================================================================
async function renderPast() {
  const jobs = (await RS_DB.all('jobs')).sort((a, b) => b.created.localeCompare(a.created));
  await RS_LISTS.load();
  side(h('div', {}, h('div', { id: 'domain', text: 'Past searches' }), h('div', { id: 'sub', text: 'The last 40 searches are kept.' })),
    h('div', { class: 'links' }, h('a', { href: page(), text: '🔎 New search' }), h('a', { href: page('view=folder'), text: '📂 My pictures folder' }), h('a', { href: page('view=lists'), text: '🚫 Hidden and allowed sites' })));
  $('main').replaceChildren(h('h1', { text: plural(jobs.length, 'past search', 'past searches') }),
    jobs.length ? h('div', { class: 'tbl' }, jobs.map(j => {
      const links = j.pics.reduce((a, p) => a + p.links.filter(l => !RS_LISTS.isHidden(l.site)).length, 0);
      const nNew = j.pics.reduce((a, p) => a + p.links.filter(l => l.isNew && !RS_LISTS.isHidden(l.site)).length, 0);
      return h('div', { class: 'tr' }, h('img', { src: j.pics[0] && j.pics[0].thumb, alt: '' }),
        h('b', { text: new Date(j.created).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) + (j.folder ? ' · from my folder' : '') }),
        h('span', { text: plural(j.pics.length, 'picture') }), h('span', {}, plural(links, 'link'), nNew ? [' ', h('span', { class: 'tag new', text: nNew + ' new' })] : ''),
        h('span', {}, h('button', { class: 'btn', text: 'Open', onclick: () => openTab(page('job=' + j.id)) })),
        h('button', { class: 'del', title: 'Delete this search', text: '🗑', onclick: async () => { if (confirm('Delete this search from the list? This cannot be undone.')) { await RS_DB.del('jobs', j.id); renderPast(); } } }));
    })) : h('div', { class: 'none', text: 'No searches yet.' }));
}

// =====================================================================================
// Start
// =====================================================================================
$('filePick').addEventListener('change', e => { const f = [...e.target.files]; e.target.value = ''; addToDraft(f); });
$('folderAdd').addEventListener('change', e => { const f = [...e.target.files]; e.target.value = ''; if (folderAddFiles) folderAddFiles(f); });
$('listLoad').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  const kind = /allow/i.test(f.name) ? 'allowed' : 'hidden';
  const sites = RS_LISTS.parse(await f.text());
  for (const s of sites) if (!RS_LISTS[kind].includes(s)) RS_LISTS[kind].push(s);
  await RS_LISTS.save();
  renderLists();
});

(async () => {
  await RS_LISTS.load();
  if (VIEW === 'results') return initResults();
  if (VIEW === 'folder') {
    document.title = 'PageProof: my pictures folder';
    setupDropAndPaste(files => folderAddFiles && folderAddFiles(files));
    await renderFolder(PARAMS.get('auto') === '1');
    return;
  }
  if (VIEW === 'lists') { document.title = 'PageProof: hidden and allowed sites'; return renderLists(); }
  if (VIEW === 'past') { document.title = 'PageProof: past searches'; return renderPast(); }
  setupDropAndPaste(addToDraft);
  renderSetup();
  docsBanner();
})();
