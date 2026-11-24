// The toolbar menu (popup.html) and the side panel (sidepanel.html): Capture this page, the
// photos on this page, new copies, Keep searching, and Open full PageProof.
const api = ppApi;
const SIDE = document.body.classList.contains('sidepane');
const $ = id => document.getElementById(id);
const appUrl = h => api.runtime.getURL('app.html#' + h);
const canUse = tab => tab && /^(https?|file):/.test(tab.url || '');
const NOT_HERE = 'PageProof can\'t work on this page. Browser pages (settings, new tab, the add-on store) are protected. Open a normal website and try again.';
const STATE = { closed: ['Stopped: tab closed', ''], running: ['Searching', 'on'], waiting: ['Resting between photos', 'on'], idle: ['Nothing due', 'on'], off: ['Off', ''], paused: ['Paused', ''], hours: ['Outside your hours', ''],
  fifty: ['Paused for a big search', 'warn'], offline: ['Google Drive offline', 'bad'], allow: ['Needs one click', 'warn'], busy: ['Computer busy', 'warn'], resting: ['Search sites resting', 'warn'], setup: ['Not set up', 'warn'] };

function err(t) { const e = $('err'); e.textContent = t; e.hidden = !t; }
async function activeTab() { const [t] = await api.tabs.query({ active: true, lastFocusedWindow: true }); return t; }
async function send(msg) { const r = await api.runtime.sendMessage(msg); if (r && r.ok === false) throw new Error(r.error); return r; }
const done = () => { if (!SIDE) window.close(); };
const open = h => { api.tabs.create({ url: appUrl(h) }); done(); };

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
  $('mini').innerHTML = `
    ${needAllow ? `<div class="msec mfind" role="alert" style="border-color:var(--warn)"><b>One click needed</b><span style="font-size:13.5px">Your browser asks once after it restarts. Press Allow and PageProof can read your photos and start searching.</span><div class="mrow"><button class="btn primary" id="allow">Allow</button></div></div>` : ''}
    ${here ? `<div class="msec mfind" role="alert"><b>This site is in your finds</b><span style="font-size:13.5px">${here.n} ${here.n === 1 ? 'copy' : 'copies'} of your clients' photos on ${esc(site)}${here.stolen ? ', marked stolen' : ''}.</span><div class="mrow"><button class="btn sm" data-go="found?open=${encodeURIComponent(here.first)}">See ${here.n === 1 ? 'it' : 'them'}</button></div></div>` : ''}
    ${busy ? `<button class="mcap stop" id="stop"><span style="font-size:24px">⏹</span><span><b>Stop the capture</b><small>Keeps what's captured so far</small></span></button>`
      : `<button class="mcap" id="cap"${canUse(tab) ? '' : ' disabled data-why="This tab is a browser page (like a new tab or settings), not a website. Open the website you want to capture, then press Capture."'}><span style="font-size:24px">${ic('capture', 26)}</span><span><b>Capture this page</b><small>${site ? esc(site) + ': PDF, web copy, fingerprints, timestamps' : 'Open a website first'}</small></span></button>`}
    <div class="msec"><h3>Photos on this page</h3><div class="mrow"><button class="btn" id="pick">${ic('find', 16)} Inspect one</button><button class="btn" id="all">${ic('photo', 16)} Show them all</button></div><span class="faint" style="font-size:12.5px">Or right-click any photo › PageProof › Find copies of it.</span></div>
    <div class="msec"><h3>Copies found</h3>
      ${drive.done ? `<div class="mline"><span class="dot ${dot}"></span><b>Keep searching</b><span class="muted" style="margin-left:auto">${label}</span></div>
      ${k.on && alive && st.text ? `<span class="muted" style="font-size:12.5px">${esc(st.text)}</span>` : ''}
      <span class="faint" style="font-size:12.5px">Today: ${today.searched} photos searched, ${today.found} new copies</span>
      <div class="mrow">${nNew ? `<button class="btn primary" data-go="review">Review ${nNew} new</button>` : '<span class="muted" style="font-size:13px">No new copies waiting.</span>'}${k.on ? `<button class="btn" id="pause">${store.fcPause ? 'Resume' : 'Pause'}</button>` : '<button class="btn" data-go="keep">Turn on</button>'}</div>`
      : `<span class="muted" style="font-size:13px">Search all your clients' photos, all day, from the shared Google Drive.</span><div class="mrow"><button class="btn" data-go="connect">Connect your photos</button></div>`}
    </div>
    <div class="mrow"><button class="btn primary" data-go="home">Open full PageProof</button>${SIDE ? '' : `<button class="btn" id="panel">${ic('panel', 16)} Keep it open beside this page</button>`}</div>
    ${!SIDE ? '<p class="faint" id="tip" style="margin:0;font-size:12px;text-align:center"></p>' : ''}`;
  const on = (id, f) => { const el = $(id); if (el) el.onclick = f; };
  on('cap', async () => { try { await api.runtime.sendMessage({ type: 'captureTab', tabId: tab.id }); } catch (e) { /* it still starts */ } done(); if (SIDE) setTimeout(draw, 800); });
  on('stop', async () => { await api.runtime.sendMessage({ type: 'stop' }).catch(() => {}); done(); if (SIDE) setTimeout(draw, 800); });
  on('pick', async () => { if (!canUse(tab)) return err(NOT_HERE); try { await send({ type: 'pick', tabId: tab.id }); done(); } catch (e) { err('Could not start the picker: ' + e.message); } });
  on('all', async () => { if (!canUse(tab)) return err(NOT_HERE); $('all').textContent = 'Looking for photos…'; try { await send({ type: 'inspectAll', tabId: tab.id }); done(); } catch (e) { err('Could not read the photos on this page: ' + e.message); } });
  on('allow', async () => {
    // Asking has to happen straight from this click.
    try { if (await FC.allowDrive()) { await api.storage.local.set({ fcNeedsAllow: 0 }); return draw(); } } catch (e) { /* the menu can't ask here */ }
    open('keep');
  });
  on('pause', async () => { const p = (await api.storage.local.get('fcPause')).fcPause; if (p) await api.storage.local.remove('fcPause'); else await api.storage.local.set({ fcPause: Date.now() }); draw(); });
  on('panel', async () => {
    try { await api.sidePanel.open({ windowId: tab.windowId }); done(); }
    catch (e) { err('Your browser has no side panel here. It works in Chrome and Edge.'); }
  });
  for (const b of document.querySelectorAll('[data-go]')) b.onclick = () => open(b.dataset.go);
  if (!SIDE) {
    try {
      const c = (await api.commands.getAll()).find(x => x.name === 'capture-page');
      if (c && c.shortcut) { const t = $('tip'); t.append('Tip: '); c.shortcut.split('+').forEach((x, i) => { if (i) t.append('+'); const kb = document.createElement('kbd'); kb.className = 'kbd'; kb.textContent = x; t.append(kb); }); t.append(' captures straight away'); }
    } catch (e) { /* none */ }
  }
}

$('themeBtn').onclick = () => ppTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
// Never leave the panel blank: say what went wrong instead.
ppTheme().then(draw).catch(e => err('PageProof could not load this panel: ' + (e && e.message || e) + '. Close it and open it again.'));
// The side panel stays open: redraw when the tab, the search or the finds change.
if (SIDE) {
  let t = null;
  const soon = () => { clearTimeout(t); t = setTimeout(() => draw().then(() => err(''), e => err('PageProof could not load this panel: ' + (e && e.message || e))), 300); };
  api.tabs.onActivated.addListener(soon);
  api.tabs.onUpdated.addListener((id, ch) => { if (ch.url || ch.status === 'complete') soon(); });
  api.storage.onChanged.addListener(ch => { if (ch.fcStatus || ch.fcChanged || ch.fcPause || ch.fcKeep || ch.ppTheme || ch.fcNeedsAllow) soon(); });
}
