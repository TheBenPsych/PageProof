// Find copies › Connect your photos (setup), Clients and photos, a client's photos, and
// Keep searching with today's 50.
Object.assign(state, { cs: 0, csClients: null, csBusy: '', csTree: new Map(), csInfo: new Map(), csOpen: new Set(), csPick: null, csStar: new Set(), cTab: 'All', cQ: '', cSort: 'name', cPicked: [], phClient: '', phQ: '', phStop: false, phMore: 50, phPicked: [], phOpen: [] });

// ---------------------------------------------------------------- Connect your photos
const CS_STEPS = ['Install Drive for desktop', 'Stream your files', 'Pick your clients', 'Check and start'];
// 4.56 (Ben's pick): the folder layout, drawn once and shown in first-time setup and on the
// folder step. Made-up names only.
function ppFolderGuide() {
  const L = (lvl, icon, name, note, cls = '') => `<div class="fl" style="padding-left:${lvl * 22}px"><span class="fi" aria-hidden="true">${icon}</span><span class="fn ${cls}">${name}</span>${note ? `<span class="fnote">${note}</span>` : ''}</div>`;
  return `<div class="fltree" role="img" aria-label="Example folder layout: top folder, client, Registered images, year, quarter with registration number, photos">
    ${L(0, '📁', 'G:\\Shared drives\\Photos', 'the top folder you pick')}
    ${L(1, '📁', '<b>Example Client</b>', 'one folder per client = the client\'s name')}
    ${L(2, '📁', 'Registered images', '')}
    ${L(3, '📁', '2026', 'year')}
    ${L(4, '📁', '<b class="flok">VA 2-123-456</b> Q4', 'registration number in the name (or 1-… while it is still an application)')}
    ${L(5, '🖼', 'photo.jpg', '')}
    ${L(1, '📁', 'No longer monitoring', '<span class="tag bad">Skipped</span> has client_info_ignore.txt', 'flskip')}
    ${L(1, '📁', 'Recycled - not to use', '<span class="tag bad">Skipped</span> the name says not to use or recycled', 'flskip')}
  </div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px">
    <div class="ppchk"><b>Do</b><ul class="hwlist"><li>One folder per client</li><li>A year folder, then a quarter (or day) folder</li><li>Put the VA or 1- number in the quarter folder's name, <i>or</i> keep an Excel file named with the number in that folder</li></ul></div>
    <div class="ppchk"><b>PageProof skips</b><ul class="hwlist"><li>Folders with <b>client_info_ignore.txt</b></li><li>Names with "not to use", "do not use" or "recycled"</li><li>Anything you leave unticked</li></ul></div>
  </div>`;
}

// The body of one Connect your photos step. nav() draws the Back / Next row (empty in first-time setup,
// which has its own).
async function csBody(s, nav) {
  const d = await FC.drive();
  const st = await FC.driveState(false);
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
      state.csUnpick = new Set(await FC.unpicked());
      state.csForce = new Set(await FC.forced());
      state.csStar = new Set((await FC.DB.all('clients')).filter(c => c.priority && c.pick).map(c => c.pick));
      for (const r of state.csPick) { const parts = r.split('/'); for (let k = 1; k < parts.length; k++) state.csOpen.add(parts.slice(0, k).join('/')); }
    }
    // Tell the automatic photo checks to wait while this page is open (they keep Google Drive busy).
    if (Date.now() - csHoldAt > 20000) { csHoldAt = Date.now(); ppApi.storage.local.set({ fcSetupAt: csHoldAt }).catch(() => {}); }
    // Folders are opened in the background, so the page never waits on a big folder.
    if (root && st === 'granted') { csLoad(''); for (const r of state.csOpen) csLoad(r); }
    const pick = state.csPick || new Set();
    const under = r => [...pick].some(p => r.startsWith(p + '/'));
    // 4.47.3: a folder inside a ticked folder can be unticked (left out). "out" = it or a folder above it was.
    const unp = state.csUnpick || new Set();
    const out = r => [...unp].some(u => r === u || r.startsWith(u + '/'));
    const rows = [];
    const walk = (rel, depth) => {
      const kids = state.csTree.get(rel);
      if (kids && kids.error) { rows.push(`<div style="padding:6px 0 6px ${20 + depth * 22}px;font-size:13px;color:var(--bad)">This folder could not be opened. Is Google Drive running? <button class="btn ghost sm" data-act="csretry" data-v="${esc(rel)}">Try again</button></div>`); return; }
      for (const f0 of Array.isArray(kids) ? kids : []) {
        const f = { ...f0, ...(state.csInfo.get(f0.rel) || {}) };
        // 4.51.1: inside a ticked folder, a folder set aside by its name ("not to use", "recycled")
        // is skipped like client_info_ignore.txt, and can be ticked by hand.
        if (!f.ignore && under(f.rel) && FC.SET_ASIDE.test(f.name)) { f.ignore = true; f.aside = true; }
        const why = f.aside ? 'its name says it is set aside (not to use or recycled)' : 'it has client_info_ignore.txt';
        const on = pick.has(f.rel) && !f.ignore, inherited = under(f.rel), left = inherited && out(f.rel), byAbove = left && !unp.has(f.rel);
        // 4.47.5: a folder with client_info_ignore.txt inside a ticked folder can be ticked anyway.
        const canForce = !!f.ignore && inherited && !left, force = canForce && (state.csForce || new Set()).has(f.rel), ign = f.ignore && !force;
        const open = state.csOpen.has(f.rel) && !ign;
        rows.push(`<div class="crow" style="padding-left:${10 + depth * 22}px">
          <button class="btn ghost sm" style="min-height:28px;width:28px;padding:0" data-act="csopen" data-v="${esc(f.rel)}" aria-label="${open ? 'Close' : 'Open'} ${esc(f.name)}" aria-expanded="${open}">${open ? '▾' : '▸'}</button>
          <label style="display:flex;gap:10px;align-items:center;flex:1;min-width:0;cursor:pointer"><input type="checkbox" data-act="${canForce ? 'csforce' : 'cspk'}" data-v="${esc(f.rel)}" ${(on || inherited) && !left && !ign ? 'checked' : ''} ${canForce ? `title="${force ? 'Searched even though ' + why + '. Untick to skip it again.' : 'Skipped: ' + why + '. Tick to search it anyway.'}"` : f.ignore ? 'disabled data-why="Skipped: this folder has client_info_ignore.txt, so it and everything inside it are never searched." title="Skipped: this folder has client_info_ignore.txt"' : byAbove ? 'disabled data-why="Left out: a folder above it is unticked." title="Left out: a folder above it is unticked"' : inherited ? `title="${left ? 'Left out. Tick to search it again.' : 'Included because the folder above it is ticked. Untick to leave it out.'}"` : ''}><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap${on ? ';font-weight:700' : ''}${ign || left ? ';text-decoration:line-through;color:var(--faint)' : ''}">${esc(f.name)}</span>${left && !byAbove ? '<span class="tag grey" style="font-size:11px;flex-shrink:0" title="You unticked this folder, so it and everything inside it are not searched">Left out</span>' : ''}${force ? `<span class="tag ok" style="font-size:11px;flex-shrink:0" title="Skipped because ${why}, but you ticked it, so it is searched">Searched anyway</span>` : f.ignore ? `<span class="tag grey" style="font-size:11px;flex-shrink:0" title="Skipped because ${why}, so it and everything inside it is not searched${canForce ? '. Tick it to search it anyway.' : ''}">Skipped</span>` : f.id ? `<span class="tag ok" style="font-size:11px;flex-shrink:0" title="client_info.txt names this client">ID: ${esc(f.id)}</span>` : ''}</label>
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
    <details><summary class="muted" style="cursor:pointer;font-weight:600">How should the folders look?</summary><div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">${ppFolderGuide()}</div></details>
    <p class="faint" style="margin:0;font-size:13px">PageProof reads the same text files as your other platform: a folder with <b>client_info.txt</b> gets that client ID as its name (also for folders deeper inside a ticked folder), and a folder with <b>client_info_ignore.txt</b> is skipped with everything inside it. The ID and Skipped tags appear a moment after a folder opens.</p>
    <div class="row"><button class="btn${root ? '' : ' primary'}" data-act="cspick">${ic('files', 18)} ${root ? 'Choose a different top folder' : 'Choose the top folder'}</button>${root && st === 'granted' ? `<button class="btn primary" data-act="csaddone">＋ Add one folder</button>` : ''}${st === 'prompt' ? '<button class="btn primary" data-act="csallow">Allow PageProof to read it</button>' : ''}${state.csBusy ? `<span class="muted">${esc(state.csBusy)}</span>` : ''}</div>
    ${root ? `<span class="faint" style="font-size:12.5px;margin-top:-6px">Top folder: <b>${esc(root.name)}</b>. "Add one folder" opens the folder window so you can go straight to a big folder and pick it.</span>` : ''}
    <label class="field" for="csLabel">Where the top folder is, as File Explorer shows it<input id="csLabel" value="${esc(d.label)}" placeholder="G:\\Shared drives"><span class="faint" style="font-size:12.5px">Your browser can't see the full path, so it's typed here once. It goes in the evidence report next to the photo.</span></label>
    ${rows.length ? `<div class="row"><b>${plural(pick.size + extras.length, 'folder')} ticked</b>${pick.size ? '<button class="btn ghost sm" data-act="csnone">Untick all</button>' : ''}<span class="faint" style="font-size:12.5px;margin-left:auto">Ticking a folder includes every folder inside it. Untick one inside to leave it out.</span></div>
      <div class="cpick" style="max-height:440px">${rows.join('')}</div>` : ''}
    ${[...pick].filter(r => state.csNew && state.csNew.has(r) && !(state.csOk && state.csOk.has(r))).map(r => [r, csWarnFor(r)]).filter(x => x[1]).slice(0, 3).map(([r, w]) => `<div class="banner warn" role="alert" style="margin:0"><div style="flex:1 1 260px;min-width:0;font-size:13.5px">${w}</div><button class="btn" data-act="cswarnun" data-v="${esc(r)}">Untick it</button><button class="btn primary" data-act="cswarnok" data-v="${esc(r)}">Yes, use it</button></div>`).join('')}
    ${pick.size ? `<div class="chips">${[...pick].sort().map(r => `<button class="chip" data-act="cspk" data-v="${esc(r)}" title="Untick">${state.csStar.has(r) ? '★ ' : ''}${esc(r.split('/').pop())} ✕</button>`).join('')}</div>` : ''}
    ${extras.length ? `<div class="faint" style="font-size:13px">Folders outside the top folder: ${extras.map(x => `<b>${esc(x.client)}</b>`).join(', ')}</div>` : ''}
    <details><summary class="muted" style="cursor:pointer">A client's photos are outside the top folder?</summary><div class="row" style="margin-top:8px"><input id="csExtra" class="chip" style="min-height:36px;padding:0 10px;font-size:14px;flex:1 1 200px" placeholder="Client name"><button class="btn" data-act="csextra">Add their folder</button></div></details>
    ${nav(true, pick.size || extras.length ? 'cssave' : '')}`;
  } else {
    const list = state.csClients || [];
    const on = list.filter(c => c.searching);
    body = `<h2>4. Check your folders and start</h2>
    <p class="muted" style="margin:0">PageProof looked through the client folders you ticked (folder names only, the newest 3 years). Nothing in Drive is changed.</p>
    ${await csCheckHtml()}
    <dl class="facts"><dt>Searching for</dt><dd>${on.length ? esc(on.map(c => c.name).slice(0, 8).join(', ')) + (on.length > 8 ? ' and ' + (on.length - 8) + ' more' : '') : '<span style="color:var(--warn)">No clients ticked</span>'}</dd><dt>Priority</dt><dd>${esc(on.filter(c => c.priority).map(c => c.name).join(', ') || 'None')}</dd><dt>Then</dt><dd>PageProof reads every folder once (this can take a while with lots of photos), then Keep searching starts. A ! or ✕ never stops the search: it only tells you what to fix. You can change all of this later in Clients and photos.</dd></dl>
    ${nav(true, on.length ? 'csstart' : '', 'Yes, start searching')}`;
  }
  return body;
}
V.connect = async () => {
  const s = state.cs;
  const dots = `<ol class="steps csteps" aria-label="Steps">${CS_STEPS.map((t, i) => `<li class="${i < s ? 'done' : i === s ? 'cur' : 'wait'}"${i === s ? ' aria-current="step"' : ''}><span class="s">${i < s ? '✓' : i + 1}</span>${t}</li>`).join('')}</ol>`;
  const nav = (back, next, nextLabel = 'Next') => `<div class="row" style="margin-top:6px">${back ? '<button class="btn" data-act="csgo" data-v="-1">Back</button>' : ''}${next ? `<button class="btn primary" style="margin-left:auto" data-act="${next}" data-v="1">${nextLabel}</button>` : ''}</div>`;
  const body = await csBody(s, nav);
  return `${head('Find copies', 'Connect your photos', 'One-time setup so PageProof can search your clients\' photos from the shared Google Drive.')}
  ${dots}<section class="card pad wiz" style="display:flex;flex-direction:column;gap:14px;max-width:820px">${body}</section>
  <p class="faint" style="font-size:13px">Just want to search a few photos from your computer? <a href="#search">New search</a> works without this.</p>`;
};
V.connect.noAutoRedraw = true;
// The folders inside one folder (read once, then kept while setup is open).
// Open a folder in the background: its folders show first, then the client_info tags fill in
// a few at a time. The page is redrawn as things arrive.
let csDrawT = null, csHoldAt = 0;
// Is the folder-ticking step on screen (on Connect your photos, or inside first-time setup)?
const csPickOn = () => (state.shown === 'connect' && state.cs === 2) || (state.shown === 'setup' && !!(SETUP[state.setup] || {}).pick);
// Keep saying "setup is open" while someone sits on the folder step.
setInterval(() => { if (csPickOn() && !document.hidden) { csHoldAt = Date.now(); ppApi.storage.local.set({ fcSetupAt: csHoldAt }).catch(() => {}); } }, 30000);
// Redraw at most every 300 ms. (It must not keep pushing the redraw back while tags are still
// being read, or a big folder shows nothing until every tag is in.)
const csDraw = now => {
  const go = () => { csDrawT = null; if (csPickOn()) render(true); };
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
// 4.15 (Ben's idea 14): after you tick a folder, say in plain words how it will be used, and
// warn about the usual slips (a year or quarter folder instead of the client, or a big group
// folder that would become one client). Only folder names are read, never the photos.
const CS_PART = /^(registered images?|\d{4}|q[1-4]|\d{4}[ _.-]*q[1-4]|q[1-4][ _.-]*\d{4}|quarter ?[1-4]|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*( \d{4})?|\d{1,2}[-_.]\d{1,2}([-_.]\d{2,4})?|\d{4}[-_.]\d{1,2}([-_.]\d{1,2})?)$/i;
function csWarnFor(rel) {
  if (!rel) return '';
  const name = rel.split('/').pop(), info = state.csInfo.get(rel) || {};
  if (info.id || info.ignore) return '';
  if (CS_PART.test(name.trim())) return `<b>“${esc(name)}” looks like one ${/registered/i.test(name) ? 'part' : 'year, quarter or day'} of a client's photos, not the whole client.</b> Only the photos inside it would be searched, under the client name “${esc(name)}”. Usually you tick the client's own folder (the one above it) instead.`;
  const kids = state.csTree.get(rel);
  if (Array.isArray(kids) && kids.length >= 8 && !rel.includes('/')) return `<b>“${esc(name)}” holds ${kids.length} folders.</b> Ticked as it is, everything inside counts as ONE client called “${esc(name)}”, except folders inside that have their own client_info.txt. If these are separate clients, open it with ▸ and tick each client instead.`;
  return '';
}
// ---------------------------------------------------------------- 4.56: check the ticked folders
// After ticking, each client folder is looked at quickly (folder names, and the files of the newest
// quarter folders): are there photos, year folders, a registration number for each quarter? Nothing
// is changed and it never stops the search; it only says what to fix. At most 15 seconds a client,
// newest 3 years only, so a client with years of photos on a slow Drive never holds anything up.
const CK_IMG = /\.(jpe?g|png|webp|gif|bmp|avif|tiff?|heic|heif)$/i, CK_SHEET = /\.(xlsx|xlsm|xls|csv|ods|pdf|docx?)$/i;
const CK_YEAR = /^\s*(?:year|fy)?[\s._-]*((?:19|20)\d{2})(?!\d)/i;
async function csCheckOne(cf) {
  const t0 = Date.now(), late = () => Date.now() - t0 > 15000;
  const r = { name: cf.name, photos: false, years: [], quarters: 0, numbered: 0, missing: [], partial: false, noReg: false, err: '' };
  const ls = async h => { const d = [], f = []; for await (const [n, x] of h.entries()) { if (/^[.$~]/.test(n)) continue; if (x.kind === 'directory') { if (!FC.SET_ASIDE.test(n)) d.push([n, x]); } else f.push(n); } return { d, f }; };
  const regFile = f => f.some(n => CK_SHEET.test(n) && FC.regIn(n));
  try {
    if (!cf.extra && !cf.baseName && !/^registered/i.test(String(cf.rel || '').split('/').pop())) r.noReg = true;
    const top = await ls(cf.base);
    if (top.f.some(n => CK_IMG.test(n))) r.photos = true;
    const upReg = !!(FC.regIn(cf.folder || '') || FC.regIn(cf.baseName || '') || regFile(top.f));
    const years = top.d.filter(([n]) => CK_YEAR.test(n)).sort((a, b) => b[0].localeCompare(a[0]));
    r.years = years.map(([n]) => +CK_YEAR.exec(n)[1]);
    for (const [yn, yh] of years.slice(0, 3)) {
      if (late()) { r.partial = true; break; }
      const y = await ls(yh);
      if (y.f.some(n => CK_IMG.test(n))) r.photos = true;
      const yReg = upReg || !!FC.regIn(yn) || regFile(y.f);
      if (!y.d.length) { r.quarters++; if (yReg) r.numbered++; else r.missing.push(yn); continue; }
      for (const [qn, qh] of y.d) {
        if (late()) { r.partial = true; break; }
        r.quarters++;
        let ok = yReg || !!FC.regIn(qn);
        if (!ok || !r.photos) { const q = await ls(qh); if (q.f.some(n => CK_IMG.test(n))) r.photos = true; if (regFile(q.f)) ok = true; }
        if (ok) r.numbered++; else r.missing.push(yn + ' › ' + qn);
      }
    }
    // Photos kept somewhere else (day folders, no year folders): look a little deeper for just one.
    if (!r.photos) {
      const queue = [[cf.base, 0]];
      let seen = 0;
      while (queue.length && !r.photos && !late() && seen < 40) {
        const [h, dep] = queue.shift(); seen++;
        const x = await ls(h);
        if (x.f.some(n => CK_IMG.test(n))) r.photos = true;
        if (dep < 4) for (const [, h2] of x.d) queue.push([h2, dep + 1]);
      }
      if (!r.photos && late()) r.partial = true;
    }
  } catch (e) { r.err = 'Google Drive could not open this folder (' + ((e && e.name) || 'error') + ').'; }
  return r;
}
// What one check says: [level ok|warn|bad, headline, details].
function csCheckSay(r) {
  if (r.err) return ['bad', 'Could not be read', r.err + ' Is Google Drive running?'];
  if (!r.photos) return r.partial ? ['warn', 'No photos found yet', 'PageProof looked for 15 seconds and found none. The full read will look everywhere.'] : ['bad', 'No photos found', 'This folder has no photos in it. Was the right folder ticked?'];
  const notes = [];
  let lvl = 'ok';
  if (!r.years.length) { lvl = 'warn'; notes.push('No year folders, so PageProof can\'t tell which photos are newest. They are searched in name order.'); }
  if (r.missing.length) { lvl = 'warn'; notes.push(`${plural(r.missing.length, 'folder has', 'folders have')} no VA or 1- number in the name and no Excel file named with one: ${esc(r.missing.slice(0, 4).join(', '))}${r.missing.length > 4 ? ' and more' : ''}. Photos there are still searched; their evidence report will say "No registration number found".`); }
  if (r.noReg) notes.push('No Registered images folder, so everything in the client folder is searched.');
  if (lvl === 'ok') {
    const ys = r.years.length ? `Years ${Math.min(...r.years)}${r.years.length > 1 ? '-' + Math.max(...r.years) : ''} found.` : '';
    notes.unshift(`${ys} ${r.quarters ? 'A registration number on every folder checked.' : ''}`.trim() || 'Photos found.');
  }
  return [lvl, lvl === 'ok' ? 'Looks good' : r.missing.length && r.years.length ? plural(r.missing.length, 'folder', 'folders') + ' with no number' : !r.years.length ? 'No year folders' : 'Check this', notes.join(' ')];
}
function csCheckStart() {
  if (state.csCheck) return;
  state.csCheck = { busy: true, res: new Map() };
  const ck = state.csCheck;
  (async () => {
    let list = [];
    try { list = await FC.clientFolders(); } catch (e) { ck.err = String(e.message || e); }
    const want = new Set((state.csClients || []).filter(c => c.searching).map(c => c.name));
    list = list.filter(c => !want.size || want.has(c.name));
    ck.total = list.length;
    let i = 0;
    const worker = async () => { while (i < list.length && state.csCheck === ck) { const cf = list[i++]; ck.res.set(cf.name, await csCheckOne(cf)); if (csCheckOn()) render(true); } };
    await Promise.all(Array.from({ length: Math.min(3, list.length) }, worker));
    ck.busy = false;
    if (state.csCheck === ck && csCheckOn()) render(true);
  })();
}
const csCheckOn = () => (state.shown === 'connect' && state.cs === 3) || (state.shown === 'setup' && !!(SETUP[state.setup] || {}).check);
async function csCheckHtml() {
  csCheckStart();
  const ck = state.csCheck;
  const docs = await RS_DOCS.state(), root = await FC.rootHandle(), drv = await FC.driveState(false);
  const row = (lvl, title, text) => `<div class="ckrow"><span class="ckic ${lvl}" aria-hidden="true">${lvl === 'ok' ? '✓' : lvl === 'warn' ? '!' : lvl === 'bad' ? '✕' : '…'}</span><div style="flex:1;min-width:0"><b>${title}</b><br><span class="muted" style="font-size:13.5px">${text}</span></div></div>`;
  const rows = [
    root && drv === 'granted' ? row('ok', 'Google Drive is connected', `PageProof can read ${esc(root.name)}.`) : row('bad', 'Google Drive is not connected', 'Go back a step and choose the top folder.'),
    docs === 'granted' ? row('ok', 'Documents › PageProof is ready', 'Your lists and backups are kept there.') : row('warn', 'Documents › PageProof is not set up', 'Your lists will only be kept inside the browser. Set it up later in Settings › Backups.'),
  ];
  for (const [name, r] of [...ck.res].sort((x, y) => x[0].localeCompare(y[0]))) { const [lvl, t, d] = csCheckSay(r); rows.push(row(lvl, `${esc(name)} <span class="tag ${lvl === 'ok' ? 'ok' : lvl === 'warn' ? 'warn' : 'bad'}" style="margin-left:4px">${esc(t)}</span>`, d)); }
  if (ck.busy) rows.push(row('wait', `Checking ${ck.total ? (ck.res.size + 1) + ' of ' + ck.total : 'your clients'}…`, 'About 15 seconds a client at most.'));
  const bad = [...ck.res.values()].filter(r => csCheckSay(r)[0] !== 'ok').length;
  return `<div class="ckbox">${rows.join('')}</div>
    ${!ck.busy ? `<div class="row" style="gap:8px"><span class="muted" style="font-size:13.5px">${bad ? plural(bad, 'client needs', 'clients need') + ' a look. You can fix the folders in Drive and check again, or start anyway.' : 'Everything looks good.'}</span><button class="btn sm" data-act="cscheck" style="margin-left:auto">Check again</button></div>` : ''}`;
}
function csReset() { state.csTree = new Map(); state.csInfo = new Map(); state.csOpen = new Set(); state.csPick = null; state.csUnpick = null; state.csForce = null; state.csStar = new Set(); state.csBusy = ''; }
Object.assign(ACTS, {
  cscheck: () => { state.csCheck = null; render(true); },
  csgo: v => {
    const l = document.getElementById('csLabel');
    if (l) FC.setDrive({ label: l.value.trim() || 'G:\\Shared drives\\Photos' });
    state.cs = Math.max(0, Math.min(3, state.cs + Number(v))); render(true);
  },
  cspick: async () => {
    // Picking the SAME top folder again (after a reinstall, or when the browser lost it) keeps the
    // ticked folders and the remembered list. Only a different top folder starts the ticks over.
    const before = await FC.rootHandle(), label = ((await FC.drive()).label || '').replace(/[\\/]+$/, '');
    let h;
    try { h = await FC.pickRoot(); } catch (e) { if (e.name !== 'AbortError') toast('That folder could not be opened.'); return; }
    const same = before ? before.name === h.name : label.split(/[\\/]/).pop().toLowerCase() === String(h.name).toLowerCase();
    if (same) { csReset(); toast('Same top folder: your ticked folders are kept.'); render(true); return; }
    await csCacheClear(); csReset(); state.csPick = new Set(); render(true);
  },
  csallow: async () => { if (await FC.allowDrive()) { csReset(); render(true); } },
  csopen: v => {
    if (state.csOpen.has(v)) state.csOpen.delete(v); else { state.csOpen.add(v); csLoad(v); csInfoOne(v); }
    render(true);
  },
  csretry: v => { state.csTree.delete(v); csLoad(v); render(true); },
  csforce: v => {
    const fs = state.csForce || (state.csForce = new Set());
    if (fs.has(v)) fs.delete(v); else { fs.add(v); csLoad(v); }
    render(true);
  },
  cspk: v => {
    const p = state.csPick || (state.csPick = new Set());
    const un = state.csUnpick || (state.csUnpick = new Set());
    // A folder inside a ticked folder: untick = leave it out, tick again = search it again.
    if (!p.has(v) && [...p].some(o => v.startsWith(o + '/'))) {
      if (un.has(v)) un.delete(v); else { un.add(v); for (const o of [...un]) if (o.startsWith(v + '/')) un.delete(o); }
      return render(true);
    }
    if (p.has(v)) { p.delete(v); state.csStar.delete(v); for (const o of [...un]) if (o.startsWith(v + '/')) un.delete(o); }
    else { p.add(v); for (const o of [...p]) if (o.startsWith(v + '/')) { p.delete(o); state.csStar.delete(o); } csInfoOne(v); csLoad(v); (state.csNew = state.csNew || new Set()).add(v); }
    render(true);
  },
  cswarnok: v => { (state.csOk = state.csOk || new Set()).add(v); render(true); },
  cswarnun: v => { ACTS.cspk(v); toast('Unticked. Open the folder above it with ▸ and tick the client\'s own folder.'); },
  csnone: () => { state.csPick = new Set(); state.csUnpick = new Set(); state.csForce = new Set(); state.csStar = new Set(); render(true); },
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
  cssave: async v => {
    const l = document.getElementById('csLabel');
    if (l) await FC.setDrive({ label: l.value.trim() || 'G:\\Shared drives' });
    state.csBusy = 'Reading the folders you ticked…'; render(true);
    try {
      const picks = await FC.setPicked([...(state.csPick || [])], [...(state.csUnpick || [])], [...(state.csForce || [])]);
      const list = await FC.quickClients();
      state.csClients = list.map(c => ({ ...c, searching: c.extra || picks.includes(c.pick), priority: c.extra ? c.priority : state.csStar.has(c.pick) }));
      state.csBusy = ''; state.cs = 3; state.csCheck = null;
    } catch (e) { state.csBusy = 'Those folders could not be read: ' + (e.message || e); }
    if (v !== 'quiet') render(true);
    return !state.csBusy;
  },
  csstart: async v => {
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
    // From first-time setup: stay in setup (its last step follows). Otherwise show Keep searching.
    if (v !== 'setup') location.hash = 'keep';
    toast('Reading your photo folders. Keep searching starts as soon as there are photos to search.');
    FC.scan({ full: true, progress: t => { state.scanText = t; } }).then(r => { state.scanText = ''; if (r && r.photos != null) toast(r.photos.toLocaleString() + ' photos found in ' + plural(r.clients, 'client folder') + '.'); render(true); });
  },
});

// ---------------------------------------------------------------- Clients and photos
// UI overhaul (batch 4): a round badge with a client's (or company's) initials, the same colour every time.
const AV_COLS = ['#2E6BE6', '#7C3AED', '#0F8A6A', '#C2410C', '#BE185D', '#0E7490', '#4D7C0F', '#9333EA', '#B45309', '#1D4ED8'];
const avColor = n => { let h = 0; for (const ch of String(n)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return AV_COLS[h % AV_COLS.length]; };
const initials = n => String(n || '?').replace(/^(the)\s+/i, '').split(/[\s&,.\-_/]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
const avatar = (n, size) => `<span class="cav" style="background:${avColor(n)}${size ? `;width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px` : ''}" aria-hidden="true">${esc(initials(n))}</span>`;
// The Clients and photos page itself (V.clients) is drawn in ui/pp-clients.js (calm look).
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
// A client can have tens of thousands of photos, so the list is read once and kept while you
// tick, flag and scroll. It is read again when another page or a search changes the photos.
let PH = null;
api.storage.onChanged.addListener(ch => { if (ch.fcChanged || ch.fcQueueDirty) PH = null; });
const phFolder = p => String(p.year || 'No year') + ' ' + (p.quarter ? 'Q' + p.quarter : 'Other');
// One client's page (V.photos) is drawn in ui/pp-clients.js (calm look).
// Rest the mouse on a photo for a moment: a bigger preview pops up beside it.
function hoverPreviews() {
  let tip = document.getElementById('hovpic'), timer = 0;
  if (!tip) { tip = document.createElement('div'); tip.id = 'hovpic'; tip.className = 'hovpic'; tip.setAttribute('aria-hidden', 'true'); document.body.append(tip); }
  const hide = () => { clearTimeout(timer); tip.classList.remove('on'); };
  view.querySelectorAll('.pcard .ptile').forEach(fr => {
    fr.onmouseenter = () => { clearTimeout(timer); timer = setTimeout(() => {
      const img = fr.querySelector('img'); if (!img || fr.classList.contains('noimg') || !/^(data:|blob:)/.test(img.src)) return;
      tip.innerHTML = ''; const big = new Image(); big.src = img.src; big.alt = ''; tip.append(big);
      const r = fr.getBoundingClientRect(), w = 340, left = r.right + 12 + w < innerWidth ? r.right + 12 : Math.max(8, r.left - 12 - w);
      tip.style.left = left + 'px'; tip.style.top = Math.max(8, Math.min(innerHeight - 260, r.top - 20)) + 'px'; tip.classList.add('on');
    }, 700); };
    fr.onmouseleave = hide;
  });
  window.addEventListener('scroll', hide, { passive: true, once: true });
}
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
        if (!p || p.thumb || p.th) return;
        const f = await FC.fileFor(p);
        const pic = await RS_JOB.prepare(f);
        if (pic.error) return;
        p.w = pic.w; p.h = pic.h; p.hash = p.hash || pic.hash;
        try { p.look = await FC.lookHash(pic.blob); } catch (e) { /* skip */ }
        await FC.setThumb('photos', p, pic.thumb);
        const kept = PH && PH.list.find(x => x.id === p.id);
        if (kept) Object.assign(kept, { thumb: p.thumb, th: p.th, w: p.w, h: p.h, hash: p.hash, look: p.look });
        img.src = pic.thumb; img.style.objectFit = 'cover'; if (img.parentElement) img.parentElement.classList.remove('noimg');
      })().catch(() => {}).finally(() => { busy--; pump(); });
    }
  };
  THUMB_OBS = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting && !e.target.src.startsWith('data:')) { THUMB_OBS.unobserve(e.target); queue.push(e.target); } pump(); }, { rootMargin: '300px' });
  view.querySelectorAll('img[data-lazy]').forEach(i => THUMB_OBS.observe(i));
}
Object.assign(ACTS, {
  phclient: (v, el) => { state.phClient = el.value; state.phMore = 50; state.phPicked = []; state.phYear = ''; state.phStop = false; render(); },
  phmore: () => { state.phMore += 50; render(true); },
  phyear: v => { state.phYear = state.phYear === v ? '' : v; state.phMore = 50; render(true); },
  phpick: v => { const i = state.phPicked.indexOf(v); if (i >= 0) state.phPicked.splice(i, 1); else state.phPicked.push(v); render(true); },
  phclear: () => { state.phPicked = []; render(true); },
  phflag: async v => {
    const [id, fl] = [v.slice(0, v.lastIndexOf('|')), v.slice(v.lastIndexOf('|') + 1)];
    const was = (await FC.DB.get('photos', id) || {}).flag || '';
    const now = await FC.setFlag(id, fl);
    PH = null;
    HIST.push({ label: 'flag changed', undo: async () => { const p = await FC.DB.get('photos', id); p.flag = was; await FC.DB.put('photos', p); PH = null; FC.queueDirty(); FC.backupSoon(true); } });
    toast(now === 'hi' ? 'High priority: searched next, then every 3 days.' : now === 'pop' ? 'Popular: searched every 7 days.' : 'Flag removed.', undoLast);
    render(true);
  },
  phbulkflag: async v => {
    const ids = state.phPicked.slice(), was = [];
    for (const id of ids) { const p = await FC.DB.get('photos', id); if (!p) continue; was.push([id, p.flag || '']); p.flag = v; p.flagged = new Date().toISOString(); await FC.DB.put('photos', p); }
    PH = null; FC.queueDirty(); FC.backupSoon(true); state.phPicked = [];
    HIST.push({ label: 'flags changed', undo: async () => { for (const [id, f] of was) { const p = await FC.DB.get('photos', id); p.flag = f; await FC.DB.put('photos', p); } PH = null; FC.queueDirty(); FC.backupSoon(true); } });
    toast(plural(ids.length, 'photo') + ' changed.', undoLast); render(true);
  },
  // Stop searching / search again: one photo (id|0) or the picked photos (|1, |0). Undo puts them back.
  phstop: async v => {
    const i = v.lastIndexOf('|'), one = v.slice(0, i), on = v.slice(i + 1) === '1';
    const ids = one ? [one] : state.phPicked.slice();
    if (!ids.length) return;
    if (on) {
      const cs = (await Promise.all(ids.map(id => FC.copiesOf(id)))).flat();
      const cnt = { open: cs.filter(x => ['new', 'later'].includes(x.status)).length, kept: cs.filter(x => ['stolen', 'licensed'].includes(x.status)).length };
      if (!(await askStop(PH && PH.list ? ids.map(id => (PH.list.find(p => p.id === id) || {}).name || id) : ids, '', cnt))) return;
    }
    const undo = await FC.setStopped(ids, on);
    PH = null; if (!one) state.phPicked = [];
    HIST.push({ label: (on ? 'stopped searching ' : 'searching again ') + plural(ids.length, 'photo'), undo: async () => { await undo(); PH = null; } });
    const moved = undo.moved || 0;
    if (typeof dropFC === 'function') dropFC();
    toast(on ? plural(ids.length, 'photo') + ' won\'t be searched any more.' + (moved ? ' ' + plural(moved, 'match', 'matches') + ' moved to Removed.' : '') : plural(ids.length, 'photo') + (ids.length === 1 ? ' is' : ' are') + ' searched again from now on.' + (moved ? ' ' + plural(moved, 'match', 'matches') + ' back in New.' : ''), undoLast);
    render(true);
  },
  phstopshow: () => { state.phStop = !state.phStop; state.phMore = 50; render(true); },
  phnotdouble: async v => { const p = await FC.DB.get('photos', v); p.notDouble = true; p.doubleOf = null; await FC.DB.put('photos', p); await FC.findDoubles(); PH = null; FC.queueDirty(); FC.backupSoon(true); toast('Kept as a separate photo. It gets its own searches.'); render(true); },
  phsearch: async () => {
    const ids = state.phPicked.slice(0, 50);
    toast('Getting ' + plural(ids.length, 'photo') + ' ready…');
    const pics = [];
    for (const id of ids) {
      const p = await FC.DB.get('photos', id);
      { const pic = await FC.readPhoto(p); if (!pic.error) pics.push(pic); }
    }
    if (!pics.length) return toast('Those photos could not be read. Check that Google Drive is running.');
    const job = await RS_JOB.create(pics, { kind: 'new' });
    if (!job) return toast('Turn on at least one search site in New search first.');
    state.phPicked = []; await RS_JOB.open(job); render(true);
  },
});

// ---------------------------------------------------------------- every photo searched once (4.10)
// How many first searches a day: Keep searching gives 1 in N of its photos to never-searched
// photos, Today's 50 (if it starts by itself) too, or all 50 when set to "Never searched first".
// Speed-ups: sp = FC.speed() (what really happened this week), lad = the speed ladder's steps
// (storage fcLadder). Google's lane sets the full searches, Yandex and Bing's the quick looks.
function firstPerDay(k, hw, week, sp = {}, lad = null) {
  const ORDER = ['Gentle', 'Steady', 'Faster'];
  const pace = ORDER[Math.min(ORDER.indexOf(k.pace), ORDER.indexOf(hw.limits.pace))] || 'Steady';
  const hrs = k.hours === 'all' ? 24 : Math.max(1, k.to - k.from);
  const share = [2, 3, 4].includes(k.firstShare) ? k.firstShare : 3;
  const ladOn = k.ladder !== false && pace === 'Faster';
  const gSec = ladOn && lad && lad.g ? FC.LADDER[lad.g.step] || 120 : FC.PACE[pace] * 60;
  const fSec = ladOn && lad && lad.f ? (FC.LADDER[lad.f.step] || 120) / 2 : FC.PACE[pace] * 30;
  const googlePerDay = k.on ? hrs * 3600 / gSec : 0;
  let n = googlePerDay / share;
  if (k.fiftyAuto) n += k.fiftyWhich === 'first' ? k.perDay : k.perDay / share;
  // What really happened this week counts too (Today's 50 started by hand, other searches).
  const days = k.weekdays ? 5 : 7;
  return { perDay: Math.max(n, sp.first || 0, (week || 0) / days), weekdays: !!k.weekdays, quickPerDay: Math.max(k.on ? hrs * 3600 / fSec : 0, sp.quick || 0),
    googlePerDay, gSec, fSec, ladOn, sp };
}
const secWords = sec => sec >= 120 ? Math.round(sec / 60) + ' min' : sec + ' s';
// The day "left" first searches are done, at "perDay" a day (weekends skipped if weekdays only).
function firstDoneBy(left, rate) {
  if (left <= 0) return 'Done';
  if (!rate.perDay) return null;
  let days = Math.ceil(left / rate.perDay);
  if (days > 3650) return 'over 10 years';
  const d = new Date();
  while (days > 0) { d.setDate(d.getDate() + 1); if (!rate.weekdays || (d.getDay() % 6)) days--; }
  const soon = d.getTime() - Date.now() < 60 * 86400000;
  return '~ ' + d.toLocaleDateString(undefined, soon ? { month: 'short', day: 'numeric' } : { month: 'long', year: 'numeric' });
}
// Done-by for each client. Clients take turns, ★ priority clients first, so a client with r left
// is done after every earlier group's photos plus min(r, r of each client in its own group).
function firstClientRows(F) {
  const rows = Object.entries(F.clients || {}).filter(([, [, t]]) => t > 0).map(([name, [d, t, cant]]) => ({ name, d, t, cant: cant || 0, left: t - d, pri: (F.pri || []).includes(name) }));
  const pri = rows.filter(r => r.pri), rest = rows.filter(r => !r.pri);
  const before = pri.reduce((a, r) => a + r.left, 0);
  for (const r of pri) r.need = pri.reduce((a, o) => a + Math.min(o.left, r.left), 0);
  for (const r of rest) r.need = before + rest.reduce((a, o) => a + Math.min(o.left, r.left), 0);
  return rows.sort((a, b) => a.d / a.t - b.d / b.t || b.left - a.left);
}


// ---------------------------------------------------------------- Keep searching and today's 50 (the page itself is in fc-keep.js)
const STATE_TAG = { running: ['Searching', 'ok'], waiting: ['Resting between photos', 'ok'], off: ['Off', 'grey'], paused: ['Paused', 'grey'], hours: ['Outside your hours', 'grey'], fifty: ['Big search running', 'ok'],
  offline: ['Google Drive offline', 'bad'], allow: ['Needs one click', 'warn'], busy: ['Computer busy', 'warn'], resting: ['Search sites resting', 'warn'], setup: ['Not set up', 'warn'], idle: ['Nothing due right now', 'ok'], closed: ['Stopped', 'bad'] };
// UI overhaul (batch 3): small helpers for Keep searching.
const kInfo = t => `<span class="kinfo" tabindex="0" role="note" title="${esc(t)}" aria-label="${esc(t)}">ⓘ</span>`;
const kClock = t => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
// 4.57 (Ben): search tabs in one separate minimized window (default) or pinned in your own window.
async function searchPlaceRow() {
  const place = (await api.storage.local.get('ppSearchPlace').catch(() => ({}))).ppSearchPlace === 'pinned' ? 'pinned' : 'window';
  return `<div class="kline"><span class="kl">Where searches run ${kInfo('Separate minimized window: every search tab opens in one small PageProof searching window, kept minimized, so your own window stays clear. It closes with your last browser window. If a search site asks "are you a robot?", that window opens for you. Pinned tabs: search tabs open as small pinned tabs at the left of your own window, like before.')}</span>
    <div class="seg" role="radiogroup" aria-label="Where searches run">${[['window', 'Separate minimized window'], ['pinned', 'Pinned tabs']].map(([v, l]) => `<button role="radio" aria-checked="${place === v}" class="${place === v ? 'on' : ''}" data-act="searchplace" data-v="${v}">${l}</button>`).join('')}</div></div>`;
}
Object.assign(ACTS, {
  searchplace: async v => {
    await api.storage.local.set({ ppSearchPlace: v === 'pinned' ? 'pinned' : 'window' });
    toast(v === 'pinned' ? 'Searches now run in pinned tabs in your own window.' : 'Searches now run in a separate minimized PageProof window.');
    setTimeout(() => render(true), 300);
  },
  keepon: async (v, el) => {
    await FC.setKeep({ on: el.checked });
    if (el.checked) { await api.storage.local.remove('fcPause'); api.runtime.sendMessage({ type: 'fcKeepWake' }).catch(() => {}); }
    else api.runtime.sendMessage({ type: 'fcKeepStop' }).catch(() => {});
    toast(el.checked ? 'Keep searching is on. It runs in the background.' : 'Keep searching is off.');
    render(true);
  },
  keeppause: async () => { const p = (await api.storage.local.get('fcPause')).fcPause; if (p) await api.storage.local.remove('fcPause'); else await api.storage.local.set({ fcPause: Date.now() }); render(true); },
  keepshow: async () => { await api.runtime.sendMessage({ type: 'fcKeepWake', show: true }).catch(() => {}); setTimeout(() => render(true), 1500); },
  keepset: async v => { const [f, x] = v.split('|'); await FC.setKeep({ [f]: x }); render(true); },
  keepgoal: async (v, el) => { const d = el.value; if (/^\d{4}-\d{2}-\d{2}$/.test(d)) { await FC.setKeep({ goal: d }); toast('Goal set. PageProof works out the pace from now on.'); render(true); } },
  keepgoaloff: async () => { await FC.setKeep({ goal: '' }); toast('No goal: the pace you picked is used.'); render(true); },
  keepladder: async (v, el) => { await FC.setKeep({ ladder: el.checked }); toast(el.checked ? 'Speed ladder on: Keep searching speeds up while the sites stay calm.' : 'Speed ladder off: 1 photo every 2 minutes on Faster.'); render(true); },
  laddertop: async v => { await FC.setKeep({ ladderTop: +v }); toast('Fastest step: 1 photo every ' + v + ' seconds.'); render(true); },
  keepnum: async (v, el) => { await FC.setKeep({ [v]: +el.value }); render(true); },
  firstshare: async v => { await FC.setKeep({ firstShare: +v }); toast('1 in ' + v + ' searches now go to photos never searched.'); render(true); },
  keepset2: async (v, el) => { await FC.setKeep({ [v]: el.value }); render(true); },
  fiftywhich: async v => { await FC.setKeep({ fiftyWhich: v === 'first' ? 'first' : 'next' }); render(true); },
  firstall: () => { state.firstAll = true; render(true); },
  firstseen: async () => { await api.storage.local.set({ fcFirstSeen: new Date().toISOString() }); const el = document.getElementById('firstDone'); if (el) el.remove(); },
  keepwd: async (v, el) => { await FC.setKeep({ weekdays: el.checked }); },
  keepauto: async (v, el) => { await FC.setKeep({ fiftyAuto: el.checked }); api.runtime.sendMessage({ type: 'fcFiftyAlarm' }).catch(() => {}); toast(el.checked ? 'Today\'s 50 starts by itself on weekdays.' : 'Today\'s 50 only starts when you click.'); },
  keeptime: async (v, el) => { if (/^\d\d:\d\d$/.test(el.value)) { await FC.setKeep({ fiftyTime: el.value }); api.runtime.sendMessage({ type: 'fcFiftyAlarm' }).catch(() => {}); } },
  fifty: async () => {
    const st = await FC.driveState(true);
    if (st !== 'granted') { if (st === 'prompt') state.wantFifty = true; toast(st === 'offline' ? 'Can\'t reach Google Drive.' : 'Press Allow (the yellow bar at the top) and today\'s ' + (await FC.keep()).perDay + ' start by themselves.'); return render(true); }
    const k = await FC.keep();
    const n = Math.min(k.perDay, 100);
    toast('Getting the next ' + n + ' photos ready…');
    const ps = await FC.next(n + 10, new Set(), { first: k.fiftyWhich === 'first', hold: true });
    const pics = [];
    for (const p of ps) {
      if (pics.length >= n) break;
      // Each photo is downloaded from Google Drive first, so say how far along it is.
      toast('Getting photo ' + (pics.length + 1) + ' of ' + Math.min(n, ps.length) + ' ready from Google Drive…');
      { const pic = await FC.readPhoto(p); if (!pic.error) pics.push(pic); }
    }
    if (!pics.length) { api.storage.local.remove('fcHold').catch(() => {}); return toast('Nothing to search right now. Every photo is up to date.'); }
    const job = await RS_JOB.create(pics, { kind: 'fifty' });
    api.storage.local.remove('fcHold').catch(() => {});
    if (!job) return toast('Turn on at least one search site in New search first.');
    await RS_JOB.open(job);
  },
});

Object.assign(ACTS, {
  reopenok: async () => { const r = (await api.storage.local.get('fcReopened')).fcReopened || {}; await api.storage.local.set({ fcReopened: { ...r, seen: true } }); render(true); },
  reopenpause: async () => { const r = (await api.storage.local.get('fcReopened')).fcReopened || {}; await api.storage.local.set({ fcPause: Date.now(), fcReopened: { ...r, seen: true } }); toast('Searching is paused. Press Resume on Keep searching to start again.'); render(true); },
});
