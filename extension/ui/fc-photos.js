// Find copies › Connect your photos (setup), Clients and photos, a client's photos, and
// Keep searching with today's 50.
Object.assign(state, { cs: 0, csClients: null, csBusy: '', csTree: new Map(), csInfo: new Map(), csOpen: new Set(), csPick: null, csStar: new Set(), cTab: 'All', cQ: '', cSort: 'name', cPicked: [], phClient: '', phQ: '', phMore: 50, phPicked: [], phOpen: [] });

// ---------------------------------------------------------------- Connect your photos
const CS_STEPS = ['Install Drive for desktop', 'Stream your files', 'Pick your clients', 'Check and start'];
V.connect = async () => {
  const d = await FC.drive();
  const st = await FC.driveState(false);
  const s = state.cs;
  const dots = `<ol class="steps csteps" aria-label="Steps">${CS_STEPS.map((t, i) => `<li class="${i < s ? 'done' : i === s ? 'cur' : 'wait'}"${i === s ? ' aria-current="step"' : ''}><span class="s">${i < s ? '✓' : i + 1}</span>${t}</li>`).join('')}</ol>`;
  const nav = (back, next, nextLabel = 'Next') => `<div class="row" style="margin-top:6px">${back ? '<button class="btn" data-act="csgo" data-v="-1">Back</button>' : ''}${next ? `<button class="btn primary" style="margin-left:auto" data-act="${next}" data-v="1">${nextLabel}</button>` : ''}</div>`;
  let body = '';
  if (s === 0) body = `<h2>1. Install Google Drive for desktop</h2>
    <p class="muted" style="margin:0">PageProof reads your company's photos straight from the shared Google Drive, through the Drive app on this computer. Nothing is uploaded anywhere and nothing in Drive is changed: PageProof only reads.</p>
    <ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px">
      <li>Download it from <a href="https://www.google.com/drive/download/" target="_blank" rel="noreferrer">google.com/drive/download</a> and run the installer.</li>
      <li>Sign in with your work Google account.</li>
      <li>Open File Explorer. You should see a new drive called <b>Google Drive (G:)</b> with <b>Shared drives</b> inside it.</li>
    </ol>
    <div class="banner info" style="padding:10px 12px;font-size:14px"><span>Already have it? Click Next.</span></div>${nav(false, 'csgo')}`;
  else if (s === 1) body = `<h2>2. Set Drive to stream files</h2>
    <p class="muted" style="margin:0">Streaming keeps the photos in the cloud and only downloads one when PageProof reads it, so your disk doesn't fill up with 100,000 photos.</p>
    <ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px">
      <li>Click the Drive icon near the clock (bottom right), then the ⚙ gear, then <b>Preferences</b>.</li>
      <li>Click <b>Google Drive</b> on the left and choose <b>Stream files</b>.</li>
      <li>Click <b>Save</b>.</li>
    </ol>${nav(true, 'csgo')}`;
  else if (s === 2) {
    const root = await FC.rootHandle();
    if (root && st === 'granted' && !state.csPick) {
      // Coming back to this step: show what was ticked before, with its folders opened.
      state.csPick = new Set((await FC.picked()) || []);
      state.csStar = new Set((await FC.DB.all('clients')).filter(c => c.priority && c.pick).map(c => c.pick));
      for (const r of state.csPick) { const parts = r.split('/'); for (let k = 1; k < parts.length; k++) state.csOpen.add(parts.slice(0, k).join('/')); }
    }
    // Tell the automatic photo checks to wait while this page is open (they keep Google Drive busy).
    if (Date.now() - csHoldAt > 20000) { csHoldAt = Date.now(); ppApi.storage.local.set({ fcSetupAt: csHoldAt }).catch(() => {}); }
    // Folders are opened in the background, so the page never waits on a big folder.
    if (root && st === 'granted') { csLoad(''); for (const r of state.csOpen) csLoad(r); }
    const pick = state.csPick || new Set();
    const under = r => [...pick].some(p => r.startsWith(p + '/'));
    const rows = [];
    const walk = (rel, depth) => {
      const kids = state.csTree.get(rel);
      if (kids && kids.error) { rows.push(`<div style="padding:6px 0 6px ${20 + depth * 22}px;font-size:13px;color:var(--bad)">This folder could not be opened. Is Google Drive running? <button class="btn ghost sm" data-act="csretry" data-v="${esc(rel)}">Try again</button></div>`); return; }
      for (const f0 of Array.isArray(kids) ? kids : []) {
        const f = { ...f0, ...(state.csInfo.get(f0.rel) || {}) };
        const on = pick.has(f.rel) && !f.ignore, inherited = under(f.rel), open = state.csOpen.has(f.rel) && !f.ignore;
        rows.push(`<div class="crow" style="padding-left:${10 + depth * 22}px">
          <button class="btn ghost sm" style="min-height:28px;width:28px;padding:0" data-act="csopen" data-v="${esc(f.rel)}" aria-label="${open ? 'Close' : 'Open'} ${esc(f.name)}" aria-expanded="${open}">${open ? '▾' : '▸'}</button>
          <label style="display:flex;gap:10px;align-items:center;flex:1;min-width:0;cursor:pointer"><input type="checkbox" data-act="cspk" data-v="${esc(f.rel)}" ${(on || inherited) && !f.ignore ? 'checked' : ''} ${f.ignore ? 'disabled title="Skipped: this folder has client_info_ignore.txt"' : inherited ? 'disabled title="Included: the folder above it is ticked"' : ''}><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap${on ? ';font-weight:700' : ''}${f.ignore ? ';text-decoration:line-through;color:var(--faint)' : ''}">${esc(f.name)}</span>${f.ignore ? '<span class="tag grey" style="font-size:11px;flex-shrink:0" title="client_info_ignore.txt is in this folder, so it and everything inside it is never searched">Skipped</span>' : f.id ? `<span class="tag ok" style="font-size:11px;flex-shrink:0" title="client_info.txt names this client">ID: ${esc(f.id)}</span>` : ''}</label>
          ${on ? `<button class="starbtn${state.csStar.has(f.rel) ? ' on' : ''}" data-act="csstar" data-v="${esc(f.rel)}" aria-label="Priority client" title="Priority: searched right after High priority photos">★</button>` : ''}</div>`);
        if (open) {
          if (!Array.isArray(state.csTree.get(f.rel)) && !(state.csTree.get(f.rel) || {}).error) rows.push(`<div class="faint" style="padding:6px 0 6px ${42 + depth * 22}px;font-size:13px">Opening…</div>`);
          else if (Array.isArray(state.csTree.get(f.rel)) && !state.csTree.get(f.rel).length) rows.push(`<div class="faint" style="padding:6px 0 6px ${42 + depth * 22}px;font-size:13px">No folders inside</div>`);
          else walk(f.rel, depth + 1);
        }
      }
    };
    walk('', 0);
    if (root && st === 'granted' && !Array.isArray(state.csTree.get(''))) rows.push('<div class="faint" style="padding:10px;font-size:13px">Opening the top folder… The first time, Google Drive can take a minute to list a big shared drive. PageProof remembers the list after that.</div>');
    const extras = await FC.extraHandles();
    body = `<h2>3. Pick your clients</h2>
    <p class="muted" style="margin:0">Choose the top folder (for example G: › Shared drives, or one shared drive). Then click <b>▸</b> to open a folder and <b>tick only the folders you search</b>. Each ticked folder is one client, and everything inside it is searched. Star the ones that matter most.</p>
    <p class="faint" style="margin:0;font-size:13px">PageProof reads the same text files as your other platform: a folder with <b>client_info.txt</b> gets that client ID as its name (also for folders deeper inside a ticked folder), and a folder with <b>client_info_ignore.txt</b> is skipped with everything inside it. The ID and Skipped tags appear a moment after a folder opens.</p>
    <div class="row"><button class="btn${root ? '' : ' primary'}" data-act="cspick">${ic('files', 18)} ${root ? 'Choose a different top folder' : 'Choose the top folder'}</button>${root && st === 'granted' ? `<button class="btn primary" data-act="csaddone">＋ Add one folder</button>` : ''}${st === 'prompt' ? '<button class="btn primary" data-act="csallow">Allow PageProof to read it</button>' : ''}${state.csBusy ? `<span class="muted">${esc(state.csBusy)}</span>` : ''}</div>
    ${root ? `<span class="faint" style="font-size:12.5px;margin-top:-6px">Top folder: <b>${esc(root.name)}</b>. "Add one folder" opens the folder window so you can go straight to a big folder and pick it.</span>` : ''}
    <label class="field" for="csLabel">Where the top folder is, as File Explorer shows it<input id="csLabel" value="${esc(d.label)}" placeholder="G:\\Shared drives"><span class="faint" style="font-size:12.5px">Your browser can't see the full path, so it's typed here once. It goes in the evidence report next to the photo.</span></label>
    ${rows.length ? `<div class="row"><b>${plural(pick.size + extras.length, 'folder')} ticked</b>${pick.size ? '<button class="btn ghost sm" data-act="csnone">Untick all</button>' : ''}<span class="faint" style="font-size:12.5px;margin-left:auto">Ticking a folder includes every folder inside it.</span></div>
      <div class="cpick" style="max-height:440px">${rows.join('')}</div>` : ''}
    ${pick.size ? `<div class="chips">${[...pick].sort().map(r => `<button class="chip" data-act="cspk" data-v="${esc(r)}" title="Untick">${state.csStar.has(r) ? '★ ' : ''}${esc(r.split('/').pop())} ✕</button>`).join('')}</div>` : ''}
    ${extras.length ? `<div class="faint" style="font-size:13px">Folders outside the top folder: ${extras.map(x => `<b>${esc(x.client)}</b>`).join(', ')}</div>` : ''}
    <details><summary class="muted" style="cursor:pointer">A client's photos are outside the top folder?</summary><div class="row" style="margin-top:8px"><input id="csExtra" class="chip" style="min-height:36px;padding:0 10px;font-size:14px;flex:1 1 200px" placeholder="Client name"><button class="btn" data-act="csextra">Add their folder</button></div></details>
    ${nav(true, pick.size || extras.length ? 'cssave' : '')}`;
  } else {
    const list = state.csClients || [];
    const on = list.filter(c => c.searching);
    body = `<h2>4. Check and start</h2>
    <p class="muted" style="margin:0">PageProof expects each client's folder to look like this. Other layouts work too; dates are read from folder names.</p>
    <div class="tree mono" style="font-size:13px">Photos<br>&nbsp;› <b>Client name</b><br>&nbsp;&nbsp;&nbsp;› Registered images<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;› 2026<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;› Q4 (or 1-11583920471 Q4)<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;› photo.jpg</div>
    <dl class="facts"><dt>Searching for</dt><dd>${on.length ? esc(on.map(c => c.name).slice(0, 8).join(', ')) + (on.length > 8 ? ' and ' + (on.length - 8) + ' more' : '') : '<span style="color:var(--warn)">No clients ticked</span>'}</dd><dt>Priority</dt><dd>${esc(on.filter(c => c.priority).map(c => c.name).join(', ') || 'None')}</dd><dt>Then</dt><dd>PageProof reads every folder once (this can take a while with lots of photos), then Keep searching starts. You can change all of this later in Clients and photos.</dd></dl>
    ${nav(true, on.length ? 'csstart' : '', 'Yes, start searching')}`;
  }
  return `${head('Find copies', 'Connect your photos', 'One-time setup so PageProof can search your clients\' photos from the shared Google Drive.')}
  ${dots}<section class="card pad wiz" style="display:flex;flex-direction:column;gap:14px;max-width:820px">${body}</section>
  <p class="faint" style="font-size:13px">Just want to search a few photos from your computer? <a href="#search">New search</a> works without this.</p>`;
};
V.connect.noAutoRedraw = true;
// The folders inside one folder (read once, then kept while setup is open).
// Open a folder in the background: its folders show first, then the client_info tags fill in
// a few at a time. The page is redrawn as things arrive.
let csDrawT = null, csHoldAt = 0;
// Keep saying "setup is open" while someone sits on the folder step.
setInterval(() => { if (state.shown === 'connect' && state.cs === 2 && !document.hidden) { csHoldAt = Date.now(); ppApi.storage.local.set({ fcSetupAt: csHoldAt }).catch(() => {}); } }, 30000);
// Redraw at most every 300 ms. (It must not keep pushing the redraw back while tags are still
// being read, or a big folder shows nothing until every tag is in.)
const csDraw = now => {
  const go = () => { csDrawT = null; if (state.shown === 'connect' && state.cs === 2) render(true); };
  if (now) { clearTimeout(csDrawT); go(); } else if (!csDrawT) csDrawT = setTimeout(go, 300);
};
// The folder list is remembered (names and client_info tags), so opening a folder again shows it
// at once. Google Drive can take a minute to list a big shared drive; the fresh list replaces the
// remembered one in the background.
const CS_CACHE = 'fcTreeCache';
let csCache = null, csSaveT = null;
async function csCacheGet() {
  if (!csCache) { try { csCache = (await ppApi.storage.local.get(CS_CACHE))[CS_CACHE] || {}; } catch (e) { csCache = {}; } }
  return csCache;
}
function csCacheSave() {
  clearTimeout(csSaveT);
  csSaveT = setTimeout(() => { ppApi.storage.local.set({ [CS_CACHE]: csCache }).catch(() => {}); }, 1000);
}
async function csCacheClear() { csCache = {}; await ppApi.storage.local.remove(CS_CACHE).catch(() => {}); }
async function csLoad(rel) {
  if (state.csTree.has(rel)) return;
  state.csTree.set(rel, 'loading');
  const cache = await csCacheGet();
  const kidsOf = names => names.map(name => ({ name, rel: (rel ? rel + '/' : '') + name }));
  const had = cache[rel];
  if (had && Array.isArray(had.kids)) {
    state.csTree.set(rel, kidsOf(had.kids));
    for (const [name, info] of Object.entries(had.info || {})) { const r = (rel ? rel + '/' : '') + name; if (!state.csInfo.has(r)) state.csInfo.set(r, info); }
    csDraw(true);
  }
  let kids;
  try { kids = await FC.subfolders(rel); } catch (e) { if (!had) { state.csTree.set(rel, { error: String(e.message || e) }); csDraw(); } return; }
  state.csTree.set(rel, kids);
  const entry = { kids: kids.map(k => k.name), info: {} };
  for (const k of kids) { const old = had && had.info && had.info[k.name]; if (old) entry.info[k.name] = old; }
  cache[rel] = entry; csCacheSave();
  csDraw(true);
  // Then read each folder's client_info tag (ID / Skipped), three at a time so Drive isn't flooded.
  let i = 0;
  const worker = async () => {
    while (i < kids.length) {
      const k = kids[i++];
      let info = {};
      try { info = await FC.folderInfo(k.rel); } catch (e) { continue; }
      state.csInfo.set(k.rel, info);
      if (info.ignore && state.csPick) state.csPick.delete(k.rel);
      if (Object.keys(info).length) entry.info[k.name] = info; else delete entry.info[k.name];
      csDraw();
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, kids.length) }, worker));
  csCacheSave();
  csDraw();
}
// The client_info tag of ONE folder, read only when you tick or open it. (Reading it for every
// folder in a list made Google Drive crawl: asking Drive for a file that isn't there is slow.)
async function csInfoOne(rel) {
  if (!rel || state.csInfo.has(rel)) return;
  state.csInfo.set(rel, {});
  let info = {};
  try { info = await FC.folderInfo(rel); } catch (e) { return; }
  state.csInfo.set(rel, info);
  if (!Object.keys(info).length) return;
  if (info.ignore && state.csPick) state.csPick.delete(rel);
  const cache = await csCacheGet(), i = rel.lastIndexOf('/'), par = cache[i < 0 ? '' : rel.slice(0, i)];
  if (par) { (par.info = par.info || {})[rel.slice(i + 1)] = info; csCacheSave(); }
  csDraw(true);
}
function csReset() { state.csTree = new Map(); state.csInfo = new Map(); state.csOpen = new Set(); state.csPick = null; state.csStar = new Set(); state.csBusy = ''; }
Object.assign(ACTS, {
  csgo: v => {
    const l = document.getElementById('csLabel');
    if (l) FC.setDrive({ label: l.value.trim() || 'G:\\Shared drives\\Photos' });
    state.cs = Math.max(0, Math.min(3, state.cs + Number(v))); render(true);
  },
  cspick: async () => {
    try { await FC.pickRoot(); } catch (e) { if (e.name !== 'AbortError') toast('That folder could not be opened.'); return; }
    await csCacheClear(); csReset(); state.csPick = new Set(); render(true);
  },
  csallow: async () => { if (await FC.allowDrive()) { csReset(); render(true); } },
  csopen: v => {
    if (state.csOpen.has(v)) state.csOpen.delete(v); else { state.csOpen.add(v); csLoad(v); csInfoOne(v); }
    render(true);
  },
  csretry: v => { state.csTree.delete(v); csLoad(v); render(true); },
  cspk: v => {
    const p = state.csPick || (state.csPick = new Set());
    if (p.has(v)) { p.delete(v); state.csStar.delete(v); }
    else { p.add(v); for (const o of [...p]) if (o.startsWith(v + '/')) { p.delete(o); state.csStar.delete(o); } csInfoOne(v); }
    render(true);
  },
  csnone: () => { state.csPick = new Set(); state.csStar = new Set(); render(true); },
  csstar: v => { if (state.csStar.has(v)) state.csStar.delete(v); else state.csStar.add(v); render(true); },
  csaddone: async () => {
    let r;
    try { r = await FC.pickInside(); } catch (e) { if (e.name !== 'AbortError') toast('That folder could not be opened.'); return; }
    if (r.rel === null) return toast('That folder is not inside the top folder. Use "A client\'s photos are outside the top folder?" below.');
    if (!r.rel) return toast('That is the top folder itself. Pick a folder inside it.');
    ACTS.cspk(r.rel);
    const parts = r.rel.split('/');
    for (let k = 1; k < parts.length; k++) state.csOpen.add(parts.slice(0, k).join('/'));
    toast(parts[parts.length - 1] + ' ticked.');
    render(true);
  },
  csextra: async () => {
    const n = (document.getElementById('csExtra') || {}).value || '';
    if (!n.trim()) return toast('Type the client\'s name first.');
    try { await FC.pickExtra(n); render(true); } catch (e) { if (e.name !== 'AbortError') toast('That folder could not be opened.'); }
  },
  cssave: async () => {
    const l = document.getElementById('csLabel');
    if (l) await FC.setDrive({ label: l.value.trim() || 'G:\\Shared drives' });
    state.csBusy = 'Reading the folders you ticked…'; render(true);
    try {
      const picks = await FC.setPicked([...(state.csPick || [])]);
      const list = await FC.quickClients();
      state.csClients = list.map(c => ({ ...c, searching: c.extra || picks.includes(c.pick), priority: c.extra ? c.priority : state.csStar.has(c.pick) }));
      state.csBusy = ''; state.cs = 3;
    } catch (e) { state.csBusy = 'Those folders could not be read: ' + (e.message || e); }
    render(true);
  },
  csstart: async () => {
    const list = state.csClients || [];
    const names = new Set(list.map(c => c.name));
    // Folders you didn't tick: forgotten if nothing was found for them, otherwise kept (not searched).
    const copies = await FC.allCopies();
    for (const c of await FC.DB.all('clients')) {
      if (names.has(c.name) || (c.from && names.has(c.from))) continue;
      if (!copies.some(x => x.client === c.name)) {
        const ps = await FC.DB.by('photos', 'client', c.name);
        await FC.DB.delMany('photos', ps.map(p => p.id));
        await FC.DB.del('clients', c.name);
      } else if (c.searching === true) { c.searching = false; await FC.DB.put('clients', c); }
    }
    for (const c of list) { const old = (await FC.DB.get('clients', c.name)) || {}; await FC.DB.put('clients', { ...old, ...c }); }
    FC.queueDirty();
    await FC.setDrive({ done: true });
    await FC.setKeep({ on: true });
    state.csClients = null; state.cs = 0; csReset();
    api.runtime.sendMessage({ type: 'fcKeepWake' }).catch(() => {});
    location.hash = 'keep';
    toast('Reading your photo folders. Keep searching starts as soon as there are photos to search.');
    FC.scan({ full: true, progress: t => { state.scanText = t; } }).then(r => { state.scanText = ''; if (r && r.photos != null) toast(r.photos.toLocaleString() + ' photos found in ' + plural(r.clients, 'client folder') + '.'); render(true); });
  },
});

// ---------------------------------------------------------------- Clients and photos
V.clients = async () => {
  const clients = await FC.DB.all('clients');
  const copies = await FC.allCopies();
  const nNew = {}, nAll = {};
  for (const c of copies) { const k = c.client || ''; if (c.status === 'new') nNew[k] = (nNew[k] || 0) + 1; if (c.status !== 'removed') nAll[k] = (nAll[k] || 0) + 1; }
  const q = state.cQ.toLowerCase();
  const tabs = { All: () => true, Priority: c => c.priority, 'With new copies': c => nNew[c.name], 'Not searching': c => c.searching !== true };
  const list = clients.filter(tabs[state.cTab] || tabs.All).filter(c => !q || c.name.toLowerCase().includes(q))
    .sort((a, b) => state.cSort === 'new' ? (nNew[b.name] || 0) - (nNew[a.name] || 0) : state.cSort === 'photos' ? (b.photos || 0) - (a.photos || 0) : (b.priority - a.priority) || a.name.localeCompare(b.name));
  const sc = await FC.meta.get('scan');
  return `${head('Find copies', 'Clients and photos', 'Every client folder in your shared Google Drive. Pick which clients you search for, and star the ones that matter most.', `<button class="btn" data-act="cscan"${FC.SCAN.busy ? ' disabled' : ''}>🔄 ${FC.SCAN.busy ? 'Looking…' : 'Look for new photos'}</button><a class="btn" href="#connect" data-act="csreset">Change folder</a>`)}
  ${await driveBanner()}
  ${state.scanText ? `<div class="scanbar"><span class="spin"></span>${esc(state.scanText)}</div>` : sc ? `<p class="faint" style="margin:0;font-size:13px">Last looked ${fmtDate(sc.at)}${sc.added ? ' · ' + sc.added + ' new photos' : ''}. PageProof looks in this and last quarter's folders every hour, and every folder once a week on a weekday (8 AM to 6 PM).</p>` : ''}
  <section class="card" style="overflow:hidden">
    <div class="toolbar">
      <div class="tabs" role="tablist">${Object.keys(tabs).map(t => `<button role="tab" aria-selected="${state.cTab === t}" class="${state.cTab === t ? 'on' : ''}" data-act="ctab" data-v="${t}">${t} <span>${clients.filter(tabs[t]).length}</span></button>`).join('')}</div>
      <div class="row" style="gap:8px;margin-left:auto"><input type="search" id="cQ" class="chip" style="min-height:36px;padding:0 10px;font-size:14px" placeholder="Search clients" value="${esc(state.cQ)}" aria-label="Search clients">
      <label class="mini">Sort<select data-act="csort">${[['name', 'Priority, then A–Z'], ['new', 'Most new copies'], ['photos', 'Most photos']].map(([k, l]) => `<option value="${k}" ${state.cSort === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
    </div>
    <div class="scroll"><table class="ctable"><thead><tr><th style="width:34px"></th><th style="width:34px" title="Priority">★</th><th>Client</th><th>Photos</th><th>Copies found</th><th>New</th><th>Searching</th><th></th></tr></thead><tbody>
    ${list.map(c => `<tr><td><input type="checkbox" data-act="cpick" data-v="${esc(c.name)}" ${state.cPicked.includes(c.name) ? 'checked' : ''} aria-label="Pick ${esc(c.name)}"></td>
      <td><button class="starbtn${c.priority ? ' on' : ''}" data-act="cstar" data-v="${esc(c.name)}" aria-label="Priority" title="${c.priority ? 'Priority client: searched right after High priority photos' : 'Make a priority client'}">★</button></td>
      <td><a href="#photos" data-act="cphotos" data-v="${esc(c.name)}" style="font-weight:600">${esc(c.name)}</a>${c.extra ? ' <span class="tag grey" style="font-size:11.5px">Own folder</span>' : ''}</td>
      <td class="num">${(c.photos || 0).toLocaleString()}</td><td class="num">${nAll[c.name] || 0}</td>
      <td>${nNew[c.name] ? `<a class="tag copy" href="#found" data-act="cfound" data-v="${esc(c.name)}">${nNew[c.name]} new</a>` : '<span class="faint">—</span>'}</td>
      <td><button class="btn sm${c.searching === true ? '' : ' ghost'}" data-act="csearch" data-v="${esc(c.name)}" aria-pressed="${c.searching === true}">${c.searching === true ? '● On' : '○ Off'}</button></td>
      <td><a class="btn ghost sm" href="#photos" data-act="cphotos" data-v="${esc(c.name)}">Photos ›</a></td></tr>`).join('') || '<tr><td colspan="8" class="muted" style="padding:24px;text-align:center">No clients here.</td></tr>'}
    </tbody></table></div>
  </section>
  ${state.cPicked.length ? `<div class="bulk"><b>${state.cPicked.length} picked</b><button class="btn" style="margin-left:auto" data-act="cbulk" data-v="start">Start searching</button><button class="btn" data-act="cbulk" data-v="stop">Stop searching</button><button class="btn" data-act="cbulk" data-v="pri">★ Make priority</button><button class="btn" data-act="cbulk" data-v="norm">Make normal</button><button class="btn" data-act="cbulk" data-v="clear">Clear</button></div>` : ''}`;
};
V.clients.guard = V.found.guard;
V.clients.after = () => {
  const i = document.getElementById('cQ');
  if (i) i.oninput = () => { state.cQ = i.value; clearTimeout(i._t); i._t = setTimeout(() => { render(true).then(() => { const j = document.getElementById('cQ'); if (j) { j.focus(); j.setSelectionRange(j.value.length, j.value.length); } }); }, 250); };
};
async function clientUndo(names, ch, label) {
  const before = [];
  for (const n of names) { const c = await FC.DB.get('clients', n); if (c) before.push([n, { searching: c.searching, priority: c.priority }]); }
  await FC.setClients(names, ch);
  HIST.push({ label, undo: async () => { for (const [n, b] of before) await FC.setClients([n], b); } });
  toast(label + '.', async () => { await undoLast(); });
  render(true);
}
Object.assign(ACTS, {
  ctab: v => { state.cTab = v; render(true); },
  csort: (v, el) => { state.cSort = el.value; render(true); },
  cpick: v => { const i = state.cPicked.indexOf(v); if (i >= 0) state.cPicked.splice(i, 1); else state.cPicked.push(v); render(true); },
  cstar: async v => { const c = await FC.DB.get('clients', v); await clientUndo([v], { priority: !c.priority, ...(c.priority ? {} : { searching: true }) }, c.priority ? v + ' is a normal client again' : v + ' is a priority client'); },
  csearch: async v => { const c = await FC.DB.get('clients', v); await clientUndo([v], { searching: c.searching !== true }, (c.searching === true ? 'Stopped searching ' : 'Searching ') + v); },
  cbulk: async v => {
    const names = state.cPicked.slice();
    if (v === 'clear') { state.cPicked = []; return render(true); }
    state.cPicked = [];
    const ch = { start: { searching: true }, stop: { searching: false }, pri: { priority: true, searching: true }, norm: { priority: false } }[v];
    const lab = { start: 'Searching', stop: 'Stopped searching', pri: 'Made priority:', norm: 'Made normal:' }[v];
    await clientUndo(names, ch, lab + ' ' + plural(names.length, 'client'));
  },
  cphotos: v => { state.phClient = v; state.phMore = 50; state.phQ = ''; location.hash = 'photos'; },
  cfound: v => { location.hash = 'found?client=' + encodeURIComponent(v); },
  csreset: () => { state.cs = 2; csReset(); location.hash = 'connect'; },
  cscan: async () => {
    toast('Looking through every folder for new photos…');
    const r = await FC.scan({ full: true, progress: t => { state.scanText = t; const b = document.querySelector('.scanbar'); if (b) b.lastChild.textContent = t; } });
    state.scanText = '';
    if (r.busy) toast('Already looking. It will finish by itself.');
    else if (r.state) toast(r.state === 'offline' ? 'Can\'t reach Google Drive.' : 'PageProof needs your OK to read the photos folder first.');
    else toast(r.added ? r.added + ' new photos found.' : 'No new photos.');
    render(true);
  },
});

// ---------------------------------------------------------------- one client's photos
V.photos = async () => {
  const clients = (await FC.DB.all('clients')).sort((a, b) => a.name.localeCompare(b.name));
  if (!state.phClient || !clients.some(c => c.name === state.phClient)) state.phClient = (clients.find(c => c.searching === true) || clients[0] || {}).name || '';
  const cl = clients.find(c => c.name === state.phClient);
  const all = (await FC.DB.by('photos', 'client', state.phClient)).filter(p => !p.gone);
  const q = state.phQ.toLowerCase();
  const list = all.filter(p => !q || p.name.toLowerCase().includes(q) || (p.rel || '').toLowerCase().includes(q)).sort((a, b) => (b.flag === 'hi') - (a.flag === 'hi') || (b.order || 0) - (a.order || 0) || a.name.localeCompare(b.name));
  const doubles = all.filter(p => p.doubleOf);
  const show = list.slice(0, state.phMore);
  const regs = new Map();
  for (const p of show) if (!regs.has(p.folder)) regs.set(p.folder, await FC.regFor(p));
  // The year › quarter tree
  const tree = {};
  for (const p of all) { const y = p.year || 'No year', qq = p.quarter ? 'Q' + p.quarter : 'Other'; (tree[y] = tree[y] || {})[qq] = ((tree[y] || {})[qq] || 0) + 1; }
  const due = p => { const pl = FC.plan(p, cl); return pl.due ? (pl.tier === 0 ? 'Next' : 'Due') : ''; };
  const card = p => {
    const r = regs.get(p.folder);
    return `<div class="pcard${state.phPicked.includes(p.id) ? ' on' : ''}">
      <label class="tick"><input type="checkbox" data-act="phpick" data-v="${esc(p.id)}" ${state.phPicked.includes(p.id) ? 'checked' : ''} aria-label="Pick ${esc(p.name)}"></label>
      <div class="frame ours" style="aspect-ratio:3/2;border-radius:8px"><img data-lazy="${esc(p.id)}" src="${p.thumb ? safeImg(p.thumb) : 'icons/icon48.png'}" alt="" loading="lazy" style="object-fit:${p.thumb ? 'cover' : 'scale-down'}"></div>
      <b style="font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(p.name)}">${esc(p.name)}</b>
      <span class="faint" style="font-size:12px">${p.year || ''}${p.quarter ? ' Q' + p.quarter : ''}${p.searches ? ' · searched ' + plural(p.searches, 'time') : ' · not searched yet'}${p.copies ? ' · ' + plural(p.copies, 'copy', 'copies') : ''}</span>
      <div class="row" style="gap:4px">${r && r.va ? `<span class="tag ok" style="font-size:11px">${esc(r.va)}</span>` : r && r.app ? `<span class="tag warn" style="font-size:11px">Applied</span>` : '<span class="tag grey" style="font-size:11px">No number</span>'}${p.doubleOf ? '<span class="tag grey" style="font-size:11px">Double</span>' : ''}${p.empty >= 5 ? `<span class="tag grey" style="font-size:11px" title="${p.empty} searches found nothing: searched ${p.empty >= 10 ? 'every 3 months' : 'monthly'}">Quiet</span>` : ''}${due(p) ? `<span class="tag copy" style="font-size:11px">${due(p)}</span>` : ''}</div>
      <div class="row" style="gap:4px"><button class="flagbtn${p.flag === 'hi' ? ' on hi' : ''}" data-act="phflag" data-v="${esc(p.id)}|hi" title="High priority: searched next, then every 3 days">⚑ High</button><button class="flagbtn${p.flag === 'pop' ? ' on pop' : ''}" data-act="phflag" data-v="${esc(p.id)}|pop" title="Popular: searched every 7 days">★ Popular</button>${p.doubleOf ? `<button class="flagbtn" data-act="phnotdouble" data-v="${esc(p.id)}" title="These are different photos">Not the same</button>` : ''}</div>
    </div>`;
  };
  return `${head('Find copies › Clients and photos', 'Photos', 'Flag the photos that matter: ⚑ High priority are searched next and every 3 days, ★ Popular every 7 days.', `<a class="btn" href="#clients">All clients</a>`)}
  ${await driveBanner()}
  <div class="clientbar row" style="gap:10px">
    <label class="mini">Client<select data-act="phclient">${clients.map(c => `<option ${c.name === state.phClient ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
    ${cl ? `<span class="tag ${cl.searching === true ? 'ok' : 'grey'}">${cl.searching === true ? 'Searching' : 'Not searching'}</span>${cl.priority ? '<span class="tag warn">★ Priority</span>' : ''}<span class="muted" style="font-size:13.5px">${all.length.toLocaleString()} photos</span>` : ''}
    <input type="search" id="phQ" class="chip" style="min-height:36px;padding:0 10px;font-size:14px;margin-left:auto" placeholder="Find a photo by name" value="${esc(state.phQ)}" aria-label="Find a photo by name">
  </div>
  ${doubles.length ? `<div class="banner info"><span style="flex:1"><b>${plural(doubles.length, 'photo looks', 'photos look')} the same as another of this client's photos</b><br><span class="muted" style="font-size:13.5px">Doubles are searched once, and every copy is checked against both. If two are really different photos, click "Not the same".</span></span></div>` : ''}
  <div class="split">
    <aside class="card pad" style="flex:0 1 220px;display:flex;flex-direction:column;gap:6px;align-self:flex-start" aria-label="Folders">
      <b style="font-size:14px">Folders</b>
      ${Object.keys(tree).sort((a, b) => String(b).localeCompare(String(a))).map(y => `<div><button class="btn ghost sm" data-act="phyear" data-v="${y}" style="width:100%;justify-content:flex-start">${y} <span class="faint" style="margin-left:auto">${Object.values(tree[y]).reduce((a, b) => a + b, 0)}</span></button>${Object.entries(tree[y]).sort().map(([qq, n]) => `<button class="btn ghost sm" data-act="phyear" data-v="${y} ${qq}" style="width:100%;justify-content:flex-start;padding-left:22px;font-weight:400">${qq} <span class="faint" style="margin-left:auto">${n}</span></button>`).join('')}</div>`).join('') || '<span class="faint" style="font-size:13px">No photos read yet.</span>'}
    </aside>
    <div style="flex:4 1 520px;min-width:0;display:flex;flex-direction:column;gap:14px">
      <div class="pgrid">${show.map(card).join('') || '<p class="muted">No photos found. Try "Look for new photos" on Clients and photos.</p>'}</div>
      ${list.length > show.length ? `<button class="btn" style="align-self:center" data-act="phmore">Show 50 more (${(list.length - show.length).toLocaleString()} not shown)</button>` : ''}
    </div>
  </div>
  ${state.phPicked.length ? `<div class="bulk"><b>${state.phPicked.length} picked</b><button class="btn primary" style="margin-left:auto" data-act="phsearch">Search now</button><button class="btn" data-act="phbulkflag" data-v="hi">⚑ High priority</button><button class="btn" data-act="phbulkflag" data-v="pop">★ Popular</button><button class="btn" data-act="phbulkflag" data-v="">No flag</button><button class="btn" data-act="phclear">Clear</button></div>` : ''}`;
};
V.photos.guard = V.found.guard;
V.photos.after = () => {
  const i = document.getElementById('phQ');
  if (i) i.oninput = () => { state.phQ = i.value; state.phMore = 50; clearTimeout(i._t); i._t = setTimeout(() => render(true).then(() => { const j = document.getElementById('phQ'); if (j) { j.focus(); j.setSelectionRange(j.value.length, j.value.length); } }), 300); };
  lazyThumbs();
};
// Small pictures are read from Drive as they scroll into view, and kept (with a "look"
// fingerprint, so doubles can be found).
let THUMB_OBS = null;
function lazyThumbs() {
  if (THUMB_OBS) THUMB_OBS.disconnect();
  const queue = [];
  let busy = 0;
  const pump = async () => {
    while (busy < 3 && queue.length) {
      const img = queue.shift(); busy++;
      (async () => {
        const p = await FC.DB.get('photos', img.dataset.lazy);
        if (!p || p.thumb) return;
        const f = await FC.fileFor(p);
        const pic = await RS_JOB.prepare(f);
        if (pic.error) return;
        p.thumb = pic.thumb; p.w = pic.w; p.h = pic.h; p.hash = p.hash || pic.hash;
        try { p.look = await FC.lookHash(pic.blob); } catch (e) { /* skip */ }
        await FC.DB.put('photos', p);
        img.src = pic.thumb; img.style.objectFit = 'cover';
      })().catch(() => {}).finally(() => { busy--; pump(); });
    }
  };
  THUMB_OBS = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting && !e.target.src.startsWith('data:')) { THUMB_OBS.unobserve(e.target); queue.push(e.target); } pump(); }, { rootMargin: '300px' });
  view.querySelectorAll('img[data-lazy]').forEach(i => THUMB_OBS.observe(i));
}
Object.assign(ACTS, {
  phclient: (v, el) => { state.phClient = el.value; state.phMore = 50; state.phPicked = []; render(); },
  phmore: () => { state.phMore += 50; render(true); },
  phyear: v => { state.phQ = ''; const [y, qq] = v.split(' '); state.phYear = v; const el = document.getElementById('phQ'); render(true).then(() => { const first = [...view.querySelectorAll('.pcard .faint')].find(s => s.textContent.startsWith(y + (qq ? ' ' + qq : ''))); if (first) first.closest('.pcard').scrollIntoView({ behavior: 'smooth', block: 'center' }); else toast('Click "Show 50 more" to reach ' + v + '.'); }); },
  phpick: v => { const i = state.phPicked.indexOf(v); if (i >= 0) state.phPicked.splice(i, 1); else state.phPicked.push(v); render(true); },
  phclear: () => { state.phPicked = []; render(true); },
  phflag: async v => {
    const [id, fl] = [v.slice(0, v.lastIndexOf('|')), v.slice(v.lastIndexOf('|') + 1)];
    const was = (await FC.DB.get('photos', id) || {}).flag || '';
    const now = await FC.setFlag(id, fl);
    HIST.push({ label: 'flag changed', undo: async () => { const p = await FC.DB.get('photos', id); p.flag = was; await FC.DB.put('photos', p); FC.queueDirty(); } });
    toast(now === 'hi' ? 'High priority: searched next, then every 3 days.' : now === 'pop' ? 'Popular: searched every 7 days.' : 'Flag removed.', undoLast);
    render(true);
  },
  phbulkflag: async v => {
    const ids = state.phPicked.slice(), was = [];
    for (const id of ids) { const p = await FC.DB.get('photos', id); if (!p) continue; was.push([id, p.flag || '']); p.flag = v; p.flagged = new Date().toISOString(); await FC.DB.put('photos', p); }
    FC.queueDirty(); FC.backupSoon(); state.phPicked = [];
    HIST.push({ label: 'flags changed', undo: async () => { for (const [id, f] of was) { const p = await FC.DB.get('photos', id); p.flag = f; await FC.DB.put('photos', p); } FC.queueDirty(); } });
    toast(plural(ids.length, 'photo') + ' changed.', undoLast); render(true);
  },
  phnotdouble: async v => { const p = await FC.DB.get('photos', v); p.notDouble = true; p.doubleOf = null; await FC.DB.put('photos', p); await FC.findDoubles(); FC.queueDirty(); toast('Kept as a separate photo. It gets its own searches.'); render(true); },
  phsearch: async () => {
    const ids = state.phPicked.slice(0, 50);
    toast('Getting ' + plural(ids.length, 'photo') + ' ready…');
    const pics = [];
    for (const id of ids) {
      const p = await FC.DB.get('photos', id);
      try { const pic = await RS_JOB.prepare(await FC.fileFor(p), { fcId: p.id, folderKey: p.rel }); if (!pic.error) pics.push(pic); } catch (e) { /* skip unreadable */ }
    }
    if (!pics.length) return toast('Those photos could not be read. Check that Google Drive is running.');
    const job = await RS_JOB.create(pics, { kind: 'new' });
    if (!job) return toast('Turn on at least one search site in New search first.');
    state.phPicked = []; await RS_JOB.open(job); render(true);
  },
});

// ---------------------------------------------------------------- Keep searching and today's 50
const STATE_TAG = { running: ['Searching', 'ok'], waiting: ['Resting between photos', 'ok'], off: ['Off', 'grey'], paused: ['Paused', 'grey'], hours: ['Outside your hours', 'grey'], fifty: ['Paused while today\'s 50 run', 'warn'],
  offline: ['Google Drive offline', 'bad'], allow: ['Needs one click', 'warn'], busy: ['Computer busy', 'warn'], resting: ['Search sites resting', 'warn'], setup: ['Not set up', 'warn'], idle: ['Nothing due right now', 'ok'] };
V.keep = async () => {
  if (routeArg('start50')) { history.replaceState(null, '', '#keep'); setTimeout(() => ACTS.fifty(), 300); }
  const [k, st, cov, hw, store] = [await FC.keep(), (await api.storage.local.get('fcStatus')).fcStatus, await FC.coverage(), await ppHardware(), await api.storage.local.get(['fcToday', 'fcRest', 'fcPause', 'fcFifty'])];
  const alive = st && Date.now() - st.beat < 90000;
  const s = !k.on ? 'off' : store.fcPause ? 'paused' : alive ? st.state : 'waiting';
  const [tl, tc] = STATE_TAG[s] || ['Starting', 'grey'];
  const today = store.fcToday && store.fcToday.day === new Date().toDateString() ? store.fcToday : { searched: 0, found: 0 };
  const rest = Object.entries(store.fcRest || {}).filter(([, t]) => t > Date.now());
  const ORDER = ['Gentle', 'Steady', 'Faster'];
  const pace = ORDER[Math.min(ORDER.indexOf(k.pace), ORDER.indexOf(hw.limits.pace))] || 'Steady';
  const perHour = 60 / FC.PACE[pace];
  const hrs = k.hours === 'all' ? 24 : Math.max(1, k.to - k.from);
  const G = cov.groups;
  const bar = (label, [a, b], note) => `<div style="display:flex;flex-direction:column;gap:4px"><div class="row" style="font-size:14px"><b>${label}</b><span class="faint" style="margin-left:auto">${b ? Math.round(a / b * 100) : 100}% up to date · ${a.toLocaleString()} of ${b.toLocaleString()}</span></div><span class="bar"><i style="width:${b ? a / b * 100 : 100}%"></i></span><span class="faint" style="font-size:12.5px">${note}</span></div>`;
  const fifty = store.fcFifty && Date.now() - store.fcFifty.beat < 60000;
  const hourOpts = Array.from({ length: 24 }, (_, h) => h);
  const hlabel = h => new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' });
  return `${head('Find copies', 'Keep searching', 'Searches your clients\' photos one at a time, all day, in a small window you can minimise. It goes gently so the search sites don\'t block you.')}
  ${await driveBanner()}
  <section class="card pad" style="display:flex;flex-direction:column;gap:14px">
    <div class="row"><label class="switch"><input type="checkbox" data-act="keepon" ${k.on ? 'checked' : ''}><span></span></label><h2>Keep searching is ${k.on ? 'on' : 'off'}</h2><span class="tag ${tc}" style="margin-left:auto">${tl}</span></div>
    ${k.on ? `<p class="muted" style="margin:0">${esc(alive ? st.text : 'Starting the search window…')}</p>
      ${alive && st.current ? `<div class="row" style="gap:10px"><img class="thumb" src="${safeImg(st.current.thumb) || 'icons/icon48.png'}" width="64" height="44" alt=""><div><b>${esc(st.current.name)}</b><div class="muted" style="font-size:13px">${esc(st.current.sub || '')}</div></div></div>` : ''}
      <div class="row"><button class="btn" data-act="keeppause">${store.fcPause ? 'Resume' : 'Pause'}</button><button class="btn" data-act="keepshow">Show the search window</button>${rest.length ? `<span class="muted" style="font-size:13.5px">Resting after a robot check: ${rest.map(([e, t]) => esc({ google: 'Google', yandex: 'Yandex', bing: 'Bing' }[e] || e) + ' until ' + new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })).join(', ')}</span>` : ''}</div>`
    : '<p class="muted" style="margin:0">Turn it on and PageProof searches in the background while you work. You can stop it any time.</p>'}
    <div class="grid g3">
      <div class="stat"><b>${today.searched}</b><span>photos searched today</span></div>
      <div class="stat"><b>${today.found}</b><span>new copies found today</span></div>
      <div class="stat"><b>~${Math.round(perHour * hrs)}</b><span>photos a day at this pace</span></div>
    </div>
  </section>
  <div class="grid g2">
    <section class="card pad" style="display:flex;flex-direction:column;gap:12px">
      <h2>Pace and hours</h2>
      <div class="seg" role="radiogroup" aria-label="Pace">${Object.entries(FC.PACE).map(([p, m]) => `<button role="radio" aria-checked="${k.pace === p}" class="${k.pace === p ? 'on' : ''}" data-act="keepset" data-v="pace|${p}">${p}<span class="faint" style="font-size:12px;display:block">1 photo every ${m} min</span></button>`).join('')}</div>
      <p class="faint" style="margin:0;font-size:13px">Your computer is <b>${esc(hw.level)}</b>${pace !== k.pace ? `, so PageProof goes at the ${pace} pace (1 photo every ${FC.PACE[pace]} minutes)` : ''}. <a href="#computer">Computer check</a></p>
      <div class="seg" role="radiogroup" aria-label="Hours">${[['work', 'Work hours'], ['all', 'All day and night']].map(([h, l]) => `<button role="radio" aria-checked="${k.hours === h}" class="${k.hours === h ? 'on' : ''}" data-act="keepset" data-v="hours|${h}">${l}</button>`).join('')}</div>
      ${k.hours === 'work' ? `<div class="row"><label class="mini">From<select data-act="keepnum" data-v="from">${hourOpts.map(h => `<option value="${h}" ${k.from === h ? 'selected' : ''}>${hlabel(h)}</option>`).join('')}</select></label><label class="mini">To<select data-act="keepnum" data-v="to">${hourOpts.map(h => `<option value="${h}" ${k.to === h ? 'selected' : ''}>${hlabel(h)}</option>`).join('')}</select></label><label style="display:flex;gap:6px;align-items:center;font-size:14px"><input type="checkbox" data-act="keepwd" ${k.weekdays ? 'checked' : ''}> Weekdays only</label></div>` : ''}
      <p class="faint" style="margin:0;font-size:13px">If a search site asks "are you a robot?", PageProof never tries to get past it. That site rests for an hour and the others carry on.</p>
    </section>
    <section class="card pad" style="display:flex;flex-direction:column;gap:12px">
      <div class="row"><h2>Today's 50</h2>${fifty ? '<span class="tag ok" style="margin-left:auto">Running now</span>' : ''}</div>
      <p class="muted" style="margin:0;font-size:14px">A bigger batch at once, in a window you can watch. Keep searching pauses while it runs, then carries on. The 50 are the next photos in line.</p>
      <div class="row"><label class="mini">How many<select data-act="keepnum" data-v="perDay">${[10, 25, 50, 75, 100].map(n => `<option value="${n}" ${k.perDay === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label><button class="btn primary" data-act="fifty"${fifty ? ' disabled' : ''}>Check ${k.perDay} now</button></div>
      <label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" data-act="keepauto" ${k.fiftyAuto ? 'checked' : ''}> Start by itself every weekday at <input type="time" value="${esc(k.fiftyTime)}" data-act="keeptime" style="border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--ink);padding:2px 6px"></label>
      <p class="faint" style="margin:0;font-size:13px">On this computer 50 photos take ${esc(hw.limits.fifty)}.</p>
    </section>
  </div>
  <section class="card pad" style="display:flex;flex-direction:column;gap:14px">
    <h2>Where the searches go</h2>
    <p class="muted" style="margin:0;font-size:14px">${cov.total.toLocaleString()} photos are searched for ${plural((await FC.DB.all('clients')).filter(c => c.searching === true).length, 'client')}. With lots of photos, not every photo is searched often: the most important ones are kept up to date first.</p>
    ${bar('⚑ High priority and ★ priority clients', G.top, 'Searched every 3 to 7 days')}
    ${bar('Newest photos (this and last quarter)', G.recent, 'Searched every month')}
    ${bar('This year', G.year, 'Searched every 6 months')}
    ${bar('Older photos', G.older, 'Searched once a year')}
    <div class="row faint" style="font-size:13px;gap:16px"><span>${cov.quiet.toLocaleString()} quiet photos (nothing found 5 times: searched monthly, 10 times: every 3 months)</span><span>${cov.doubles.toLocaleString()} doubles searched once with their twin</span></div>
    <details><summary class="muted" style="cursor:pointer">Which photos go first?</summary><ol style="margin:8px 0 0;padding-left:20px;font-size:14px;display:flex;flex-direction:column;gap:4px">
      <li><b>⚑ High priority</b> photos: next in line, then every 3 days.</li><li><b>★ Priority clients</b>: their photos come right after.</li><li><b>Newest photos</b>, by year, quarter and day.</li><li><b>★ Popular</b> photos and photos stolen before: every 7 days.</li><li>Everything else, the longest-waiting first.</li><li>Quiet photos last.</li></ol></details>
  </section>`;
};
V.keep.guard = V.found.guard;
Object.assign(ACTS, {
  keepon: async (v, el) => {
    await FC.setKeep({ on: el.checked });
    if (el.checked) { await api.storage.local.remove('fcPause'); api.runtime.sendMessage({ type: 'fcKeepWake' }).catch(() => {}); }
    else api.runtime.sendMessage({ type: 'fcKeepStop' }).catch(() => {});
    toast(el.checked ? 'Keep searching is on. A small search window opens; you can minimise it.' : 'Keep searching is off.');
    render(true);
  },
  keeppause: async () => { const p = (await api.storage.local.get('fcPause')).fcPause; if (p) await api.storage.local.remove('fcPause'); else await api.storage.local.set({ fcPause: Date.now() }); render(true); },
  keepshow: async () => { const st = (await api.storage.local.get('fcStatus')).fcStatus; try { if (st && st.win) { await api.windows.update(st.win, { focused: true, state: 'normal' }); return; } } catch (e) { /* closed */ } api.runtime.sendMessage({ type: 'fcKeepWake', show: true }).catch(() => {}); },
  keepset: async v => { const [f, x] = v.split('|'); await FC.setKeep({ [f]: x }); render(true); },
  keepnum: async (v, el) => { await FC.setKeep({ [v]: +el.value }); render(true); },
  keepwd: async (v, el) => { await FC.setKeep({ weekdays: el.checked }); },
  keepauto: async (v, el) => { await FC.setKeep({ fiftyAuto: el.checked }); api.runtime.sendMessage({ type: 'fcFiftyAlarm' }).catch(() => {}); toast(el.checked ? 'Today\'s 50 starts by itself on weekdays.' : 'Today\'s 50 only starts when you click.'); },
  keeptime: async (v, el) => { if (/^\d\d:\d\d$/.test(el.value)) { await FC.setKeep({ fiftyTime: el.value }); api.runtime.sendMessage({ type: 'fcFiftyAlarm' }).catch(() => {}); } },
  fifty: async () => {
    const st = await FC.driveState(true);
    if (st !== 'granted') { toast(st === 'offline' ? 'Can\'t reach Google Drive.' : 'Click Allow first so PageProof can read your photos.'); return render(true); }
    const k = await FC.keep();
    const n = Math.min(k.perDay, 100);
    toast('Getting the next ' + n + ' photos ready…');
    const ps = await FC.next(n + 10);
    const pics = [];
    for (const p of ps) {
      if (pics.length >= n) break;
      try { const pic = await RS_JOB.prepare(await FC.fileFor(p), { fcId: p.id, folderKey: p.rel }); if (!pic.error) pics.push(pic); } catch (e) { /* skip */ }
    }
    if (!pics.length) return toast('Nothing to search right now. Every photo is up to date.');
    const job = await RS_JOB.create(pics, { kind: 'fifty' });
    if (!job) return toast('Turn on at least one search site in New search first.');
    await RS_JOB.open(job);
  },
});
