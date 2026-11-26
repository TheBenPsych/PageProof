// The toolbar menu (popup.html): Capture this page, the numbers, the five tools, Keep searching,
// and a bottom bar with Open full PageProof and light/dark.
const api = ppApi;
const $ = id => document.getElementById(id);
const appUrl = h => api.runtime.getURL('app.html#' + h);
const canUse = tab => tab && /^(https?|file):/.test(tab.url || '');
const NOT_HERE = 'PageProof can\'t work on this page. Browser pages (settings, new tab, the add-on store) are protected. Open a normal website and try again.';
const STATE = { closed: ['Stopped: tab closed', ''], running: ['Searching', 'on'], waiting: ['Resting between photos', 'on'], idle: ['Nothing due', 'on'], off: ['Off', ''], paused: ['Paused', ''], hours: ['Outside your hours', ''],
  fifty: ['Big search running', 'ok'], offline: ['Google Drive offline', 'bad'], allow: ['Needs one click', 'warn'], busy: ['Computer busy', 'warn'], resting: ['Search sites resting', 'warn'], setup: ['Not set up', 'warn'] };

function err(t) { const e = $('err'); e.textContent = t; e.hidden = !t; }
async function activeTab() { const [t] = await api.tabs.query({ active: true, lastFocusedWindow: true }); return t; }
async function send(msg) { const r = await api.runtime.sendMessage(msg); if (r && r.ok === false) throw new Error(r.error); return r; }
const done = () => window.close();
const open = h => { api.tabs.create({ url: appUrl(h) }); done(); };

// The five tools of the Tools page, one press away (calm look: they took the place of "Photos on
// this page", which was hidden on browser pages and pushed the pop-up past the browser's height).
const TOOLS = [['inspect', 'Inspect', 'Inspect a photo', '<path d="M13 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6"/><path d="M3 15l4-4 4 4"/><circle cx="13.5" cy="8.5" r="1.3"/><circle cx="17" cy="17" r="3"/><path d="M19.2 19.2L22 22"/>'],
  ['compare', 'Compare', 'Compare two photos', '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'],
  ['markup', 'Mark up', 'Mark up a copy', '<path d="M4 20l4-1L19 8l-3-3L5 16z"/>'],
  ['files', 'Convert', 'Convert files', '<path d="M4 8h14l-3-3M20 16H6l3 3"/>'],
  ['openfiles', 'Open file', 'Open odd files', '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>']];

async function draw() {
  const tab = await activeTab();
  let busy = false;
  try { busy = !!(await api.runtime.sendMessage({ type: 'status' }) || {}).busy; } catch (e) { /* not busy */ }
  const [k, store, drive] = [await FC.keep(), await api.storage.local.get(['fcStatus', 'fcPause', 'fcToday']), await FC.drive()];
  let nNew = 0, here = null;
  try {
    nNew = await FC.countNew();
    if (canUse(tab) && /^https?:/.test(tab.url)) here = await FC.siteFinds(RS_SITE.of(tab.url));
  } catch (e) { /* nothing found yet */ }
  const st = store.fcStatus, alive = st && Date.now() - st.beat < 90000;
  const s = !k.on ? 'off' : store.fcPause ? 'paused' : alive ? st.state : st && st.state === 'closed' ? 'closed' : 'waiting';
  const [label, dot] = STATE[s] || ['Starting', ''];
  const today = store.fcToday && store.fcToday.day === new Date().toDateString() ? store.fcToday : { searched: 0, found: 0 };
  const site = canUse(tab) && /^https?:/.test(tab.url) ? RS_SITE.of(tab.url) : '';
  const extra = await api.storage.local.get(['fcNeedsAllow']);
  const needAllow = drive.done && (extra.fcNeedsAllow || (alive && st.state === 'allow'));
  let nStolen = 0;
  try { nStolen = (await FC.allCopies()).filter(c => c.status === 'stolen' && !c.packAt).length; } catch (e) { /* none */ }
  const title = tab && tab.title && canUse(tab) ? tab.title : '';
  const live = !k.on ? 'Off. Switch it on to search your photos all day.' : store.fcPause ? 'Paused by you.' : alive && st.text ? st.text : label;
  let keys = '';
  try { const c = (await api.commands.getAll()).find(x => x.name === 'capture-page'); keys = (c && c.shortcut) || ''; } catch (e) { /* none set */ }
  const row = (go, cls, icon, name, n) => `<button class="nrow" data-go="${go}"><span class="ico ${cls}">${ic(icon, 18)}</span><span class="nl1">${name}</span><b class="num${n ? '' : ' zero'}">${n.toLocaleString()}</b><span class="chev" aria-hidden="true">›</span></button>`;
  // Calm look: warnings are slim bars, the numbers are a list like Windows Settings, the five
  // tools sit in one row, Keep searching is one row with its switch on the right, and Open full
  // PageProof and the light/dark button live in a bar at the bottom.
  $('mini').innerHTML = `
    ${needAllow ? `<div class="ibar warn${here ? ' two' : ''}" role="alert"><span class="ii" aria-hidden="true">!</span><span class="it"><b>Drive needs one click</b>${here ? '' : '<span class="i2">to start searching</span>'}</span><button class="btn primary" id="allow">Allow</button></div>` : ''}
    ${here ? `<div class="ibar bad mfind${needAllow ? ' two' : ''}" role="alert"><span class="ii" aria-hidden="true">!</span><span class="it">${needAllow ? `<b>${here.n} ${here.stolen ? 'stolen ' : ''}${here.n === 1 ? 'copy' : 'copies'} ${here.stolen ? 'here' : 'on this site'}</b>` : `<b>Found on this site</b><span class="i2">${here.n} ${here.n === 1 ? 'copy' : 'copies'}${here.stolen ? ' · stolen' : ''}</span>`}</span><button class="btn" data-go="found?open=${encodeURIComponent(here.first)}">See ${here.n === 1 ? 'it' : 'them'}</button></div>` : ''}
    ${busy ? `<button class="mcap stop" id="stop"><span class="cico" aria-hidden="true">⏹</span><span class="mct"><b>Stop the capture</b><small>Keeps what's captured so far</small></span></button>`
      : `<button class="mcap" id="cap"${canUse(tab) ? '' : ' disabled data-why="This tab is a browser page (like a new tab or settings), not a website. Open the website you want to capture, then press Capture."'}${title ? ` title="${esc(title)}"` : ''}><span class="cico" aria-hidden="true">${ic('capture', 22)}</span><span class="mct"><b>Capture this page</b><small>${site ? esc(site.replace(/^www\./, '')) : 'Open a website first'}</small></span>${keys && canUse(tab) ? `<span class="kc">${esc(keys)}</span>` : ''}</button>`}
    ${drive.done ? `<div class="nrows" id="nums">
      ${row('review', 'i-new', 'eye', 'New copies', nNew)}
      ${row('tocapture', 'i-cap', 'capture', 'To capture', nStolen)}
      ${row('keep', 'i-srch', 'find', 'Searched today', today.searched)}</div>` : ''}
    <div class="ntools" id="tools">${TOOLS.map(t => `<button class="ntool" data-go="${t[0]}" title="${t[2]}" aria-label="${t[2]}"><span class="ti"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${t[3]}</svg></span><span class="tl">${t[1]}</span></button>`).join('')}</div>
    <div class="msec">
      ${drive.done ? `<div class="krow"><div class="kt"><b>Keep searching</b><span id="klive">${esc(String(live).replace('Resting between photos. Next photo in', 'Resting · next photo in'))}</span>${k.on ? `<span class="k2">${today.found ? today.found.toLocaleString() + ' new today · ' : ''}<button class="lk" id="pause">${store.fcPause ? 'Resume' : 'Pause'}</button></span>` : ''}</div><label class="switch"><input type="checkbox" id="keepon" ${k.on ? 'checked' : ''} aria-label="Keep searching"><span></span></label></div>`
      : `<h3>Copies found</h3><span class="muted" style="font-size:13px">Search all your clients' photos, all day, from the shared Google Drive.</span><div class="mrow"><button class="btn" data-go="connect">Connect your photos</button></div>`}
    </div>`;
  const ko = $('keepon');
  if (ko) ko.onchange = async () => {
    await FC.setKeep({ on: ko.checked });
    if (ko.checked) { await api.storage.local.remove('fcPause'); api.runtime.sendMessage({ type: 'fcKeepWake' }).catch(() => {}); }
    else api.runtime.sendMessage({ type: 'fcKeepStop' }).catch(() => {});
    draw();
  };
  const on = (id, f) => { const el = $(id); if (el) el.onclick = f; };
  on('cap', async () => { try { await api.runtime.sendMessage({ type: 'captureTab', tabId: tab.id }); } catch (e) { /* it still starts */ } done(); });
  on('stop', async () => { await api.runtime.sendMessage({ type: 'stop' }).catch(() => {}); done(); });
  on('allow', async () => {
    // Asking has to happen straight from this click.
    try { if (await FC.allowDrive()) { await api.storage.local.set({ fcNeedsAllow: 0 }); return draw(); } } catch (e) { /* the menu can't ask here */ }
    open('keep');
  });
  on('pause', async () => { const p = (await api.storage.local.get('fcPause')).fcPause; if (p) await api.storage.local.remove('fcPause'); else await api.storage.local.set({ fcPause: Date.now() }); draw(); });
  for (const b of document.querySelectorAll('[data-go]')) b.onclick = () => open(b.dataset.go);
}

$('openFull').onclick = () => open('home');
$('openIco').innerHTML = ic('ext', 18);
$('themeBtn').onclick = () => ppTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
// Never leave the panel blank: say what went wrong instead.
ppTheme().then(draw).catch(e => err('PageProof could not load this panel: ' + (e && e.message || e) + '. Close it and open it again.'));
