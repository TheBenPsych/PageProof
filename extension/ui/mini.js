// The toolbar menu (popup.html): Capture this page, the
// photos on this page, new copies, Keep searching, and Open full PageProof.
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

// The biggest photos on the page (up to 4 to show) and how many there are.
async function pagePics(tab) {
  try {
    const [r] = await api.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
      const seen = new Set(), out = [];
      for (const el of document.images) {
        const src = el.currentSrc || el.src;
        if (!/^https?:/.test(src || '') || seen.has(src) || (el.naturalWidth || 0) < 120 || (el.naturalHeight || 0) < 120) continue;
        seen.add(src); out.push({ src, best: '', w: el.naturalWidth, h: el.naturalHeight, alt: (el.alt || '').slice(0, 300), kind: 'image' });
      }
      out.sort((a, b) => b.w * b.h - a.w * a.h);
      return { n: out.length, items: out.slice(0, 4) };
    } });
    return r && r.result ? r.result : null;
  } catch (e) { return null; }
}

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
  // UI overhaul batch 8: the capture card names the page; three number tiles; a Keep searching
  // switch with a live line; the photos on this page as small pictures.
  let nStolen = 0;
  try { nStolen = (await FC.allCopies()).filter(c => c.status === 'stolen' && !c.packAt).length; } catch (e) { /* none */ }
  const pics = canUse(tab) && /^https?:/.test(tab.url) ? await pagePics(tab) : null;
  const title = tab && tab.title && canUse(tab) ? tab.title : '';
  const live = !k.on ? 'Off. Switch it on to search your photos all day.' : store.fcPause ? 'Paused by you.' : alive && st.text ? st.text : label;
  $('mini').innerHTML = `
    ${needAllow ? `<div class="msec mfind" role="alert" style="border-color:var(--warn)"><b>One click needed</b><span style="font-size:13.5px">Your browser asks once after it restarts. Press Allow and PageProof can read your photos and start searching.</span><div class="mrow"><button class="btn primary" id="allow">Allow</button></div></div>` : ''}
    ${here ? `<div class="msec mfind" role="alert"><b>This site is in your finds</b><span style="font-size:13.5px">${here.n} ${here.n === 1 ? 'copy' : 'copies'} of your clients' photos on ${esc(site)}${here.stolen ? ', marked stolen' : ''}.</span><div class="mrow"><button class="btn sm" data-go="found?open=${encodeURIComponent(here.first)}">See ${here.n === 1 ? 'it' : 'them'}</button></div></div>` : ''}
    ${busy ? `<button class="mcap stop" id="stop"><span style="font-size:24px">⏹</span><span><b>Stop the capture</b><small>Keeps what's captured so far</small></span></button>`
      : `<button class="mcap" id="cap"${canUse(tab) ? '' : ' disabled data-why="This tab is a browser page (like a new tab or settings), not a website. Open the website you want to capture, then press Capture."'}>${site ? `<span class="msl" aria-hidden="true">${esc(site.replace(/^www\./, '')[0] || '?')}</span>` : `<span style="font-size:24px">${ic('capture', 26)}</span>`}<span class="mct"><b>Capture this page</b><small>${site ? esc(site) + (title ? ' · ' + esc(title) : '') : 'Open a website first'}</small></span>${site ? ic('capture', 22) : ''}</button>`}
    ${drive.done ? `<div class="mtiles">
      <button class="mtile${nNew ? ' blue' : ''}" data-go="review"><b>${nNew.toLocaleString()}</b><span>new ${nNew === 1 ? 'copy' : 'copies'}</span></button>
      <button class="mtile${nStolen ? ' amber' : ''}" data-go="tocapture"><b>${nStolen.toLocaleString()}</b><span>to capture</span></button>
      <button class="mtile" data-go="keep"><b>${today.searched.toLocaleString()}</b><span>searched today</span></button></div>` : ''}
    <div class="msec"><h3>Photos on this page</h3>
      ${pics && pics.items.length ? `<div class="mthumbs">${pics.items.map((p, i) => `<button class="mth" data-pic="${i}" title="Inspect this photo"><img src="${esc(p.src)}" alt="" loading="lazy" referrerpolicy="no-referrer"></button>`).join('')}${pics.n > pics.items.length ? `<button class="mth more" id="all" title="Show them all">+${pics.n - pics.items.length}</button>` : ''}</div>
        <span class="faint" style="font-size:12.5px">Click one to inspect it. Or right-click any photo › PageProof › Find copies of it.</span>`
      : `<div class="mrow"><button class="btn" id="pick">${ic('find', 16)} Inspect one</button><button class="btn" id="all">${ic('photo', 16)} Show them all</button></div><span class="faint" style="font-size:12.5px">${pics ? 'No big photos found on this page yet. ' : ''}Or right-click any photo › PageProof › Find copies of it.</span>`}</div>
    <div class="msec">
      ${drive.done ? `<div class="mline"><label class="switch"><input type="checkbox" id="keepon" ${k.on ? 'checked' : ''} aria-label="Keep searching"><span></span></label><b>Keep searching</b><span class="tag ${dot === 'on' ? 'ok' : dot || 'grey'}" style="margin-left:auto">${esc(k.on ? label : 'Off')}</span></div>
      ${live !== label ? `<span class="muted mlive">${esc(live)}${today.found ? ' · ' + today.found + ' new today' : ''}</span>` : today.found ? `<span class="muted mlive">${today.found} new today</span>` : ''}
      ${k.on ? `<div class="mrow"><button class="btn sm" id="pause">${store.fcPause ? 'Resume' : 'Pause'}</button></div>` : ''}`
      : `<h3>Copies found</h3><span class="muted" style="font-size:13px">Search all your clients' photos, all day, from the shared Google Drive.</span><div class="mrow"><button class="btn" data-go="connect">Connect your photos</button></div>`}
    </div>
    <div class="mrow"><button class="btn primary" data-go="home">Open full PageProof</button></div>
    <p class="faint" id="tip" style="margin:0;font-size:12px;text-align:center"></p>`;
  for (const b of document.querySelectorAll('[data-pic]')) b.onclick = async () => {
    const p = pics.items[+b.dataset.pic];
    try { await send({ type: 'inspect', mode: 'one', page: tab.url, title: tab.title || '', items: [p] }); done(); } catch (e) { err('Could not open the Inspector: ' + e.message); }
  };
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
  on('pick', async () => { if (!canUse(tab)) return err(NOT_HERE); try { await send({ type: 'pick', tabId: tab.id }); done(); } catch (e) { err('Could not start the picker: ' + e.message); } });
  on('all', async () => { if (!canUse(tab)) return err(NOT_HERE); $('all').textContent = 'Looking for photos…'; try { await send({ type: 'inspectAll', tabId: tab.id }); done(); } catch (e) { err('Could not read the photos on this page: ' + e.message); } });
  on('allow', async () => {
    // Asking has to happen straight from this click.
    try { if (await FC.allowDrive()) { await api.storage.local.set({ fcNeedsAllow: 0 }); return draw(); } } catch (e) { /* the menu can't ask here */ }
    open('keep');
  });
  on('pause', async () => { const p = (await api.storage.local.get('fcPause')).fcPause; if (p) await api.storage.local.remove('fcPause'); else await api.storage.local.set({ fcPause: Date.now() }); draw(); });
  for (const b of document.querySelectorAll('[data-go]')) b.onclick = () => open(b.dataset.go);
  try {
    const c = (await api.commands.getAll()).find(x => x.name === 'capture-page');
    if (c && c.shortcut) { const t = $('tip'); t.append('Tip: '); c.shortcut.split('+').forEach((x, i) => { if (i) t.append('+'); const kb = document.createElement('kbd'); kb.className = 'kbd'; kb.textContent = x; t.append(kb); }); t.append(' captures straight away'); }
  } catch (e) { /* none */ }
}

$('themeBtn').onclick = () => ppTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
// Never leave the panel blank: say what went wrong instead.
ppTheme().then(draw).catch(e => err('PageProof could not load this panel: ' + (e && e.message || e) + '. Close it and open it again.'));
