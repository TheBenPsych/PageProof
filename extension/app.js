// The full PageProof page: one tab with the menu on the left. Each page lives after the # in the
// address (app.html#settings). Older tools (Inspect, Compare, Mark up, Open files, Verify, reverse
// search) open inside this frame, so the menu stays put.
const api = ppApi;
const view = document.getElementById('view');
const VERSION = api.runtime.getManifest().version;
const route = () => (location.hash.slice(1).split('?')[0] || 'home');
const V = {};        // pages: V[route]() returns the page's HTML (other files add more pages)
const ACTS = {};     // buttons: data-act="name" runs ACTS[name](value, element)
const state = { hidTab: 'hidden', hidQ: '', hidKind: 'All', setup: 0, tour: -1 };
const routeArg = k => new URLSearchParams(location.hash.split('?')[1] || '').get(k);

// ---------- pages that are older tools, shown inside the frame ----------
const FRAMES = {
  search: 'revsearch.html', searches: 'revsearch.html?view=past',
  inspect: 'inspect.html', compare: 'compare.html', markup: 'markup.html',
  files: 'convert.html', openfiles: 'convert.html?open=1', verify: 'verify.html',
  results: 'revsearch.html' // a search's results; see LIVE below
};
// Results of a search that is running or was just opened (#results?job=ID). Each one lives in its
// own frame that is kept (hidden) while you look at other PageProof pages, so the search carries
// on. Closing the PageProof tab stops it, as closing its window used to.
const LIVE = new Map();
function showLive(id) {
  const box = document.getElementById('live');
  if (id && !LIVE.has(id)) {
    const f = document.createElement('iframe');
    f.className = 'tool'; f.title = 'Search results'; f.src = 'revsearch.html?job=' + encodeURIComponent(id);
    box.append(f); LIVE.set(id, f);
    // Keep at most 4 open; drop the oldest.
    while (LIVE.size > 4) { const [k, old] = LIVE.entries().next().value; old.remove(); LIVE.delete(k); }
  }
  for (const [k, f] of LIVE) f.hidden = k !== id;
  box.style.display = id ? '' : 'none'; view.style.display = id ? 'none' : '';
}

async function render(keep) {
  let r = route();
  if (!V[r] && !FRAMES[r]) r = 'home';
  ppRenderSide(r);
  document.getElementById('crumb').innerHTML = `<b>PageProof</b> › ${PP_CRUMBS[r] || ''}`;
  document.body.classList.toggle('framed', !!FRAMES[r]);
  if (V[r] && V[r].guard) { const g = await V[r].guard(); if (g) r = g; }
  state.shown = r; // the page really on screen (a guard can show setup under another page's address)
  if (r === 'results') {
    const id = routeArg('job') || state.liveJob;
    if (!id) { location.hash = 'searches'; return; }
    state.liveJob = id; showLive(id);
    document.getElementById('side').classList.remove('open');
    return;
  }
  showLive(null);
  if (FRAMES[r]) {
    const want = FRAMES[r];
    const f = view.querySelector('iframe.tool');
    if (!f || f.dataset.src !== want) view.innerHTML = `<iframe class="tool" data-src="${want}" src="${want}" title="${esc(PP_CRUMBS[r])}"></iframe>`;
  } else {
    view.classList.toggle('still', !!keep);
    // Keep every scroll position (the page and boxes that scroll inside it, like the folder list)
    // when a page is drawn again after a click.
    const SCROLLERS = '.cpick, .scroll, .drawer, .pgrid';
    const sy = window.scrollY, main = document.querySelector('.main'), my = main ? main.scrollTop : 0;
    const inner = keep ? [...view.querySelectorAll(SCROLLERS)].map(e => [e.scrollTop, e.scrollLeft]) : [];
    const html = await V[r]();
    view.innerHTML = html;
    if (typeof ppLoadPics === 'function') ppLoadPics(view);
    if (keep) {
      window.scrollTo(0, sy);
      if (main) main.scrollTop = my;
      view.querySelectorAll(SCROLLERS).forEach((e, i) => { if (inner[i]) { e.scrollTop = inner[i][0]; e.scrollLeft = inner[i][1]; } });
    }
    ppAddHelp(view);
    if (V[r].after) V[r].after();
  }
  document.getElementById('side').classList.remove('open');
  if (!keep) window.scrollTo(0, 0);
  if (state.tour >= 0) drawTour();
  if (typeof ppTopBar === 'function') ppTopBar();
  ppBadges();
}
window.addEventListener('hashchange', () => render());
// The number of new copies next to Find copies in the menu.
async function ppBadges() {
  try {
    const n = await FC.countNew();
    if (PP_BADGES.newCopies !== n) { PP_BADGES.newCopies = n || 0; ppRenderSide(PP_ROUTES[route()] ? route() : 'home'); }
  } catch (e) { /* no copies yet */ }
}
// Another PageProof page (the search window, Keep searching) changed something: redraw.
let redrawT = null;
// Keep searching writes a heartbeat every 30 seconds. Only what you can see counts as a change.
const statusLook = s => (s ? [s.state, s.text, s.current && s.current.id].join('|') : '');
api.storage.onChanged.addListener(ch => {
  if ((ch.fcEngines || ch.ppUpdate) && ['home', 'health'].includes(route()) && !state.upBusy) { clearTimeout(redrawT); redrawT = setTimeout(() => render(true), 600); return; }
  if (!ch.fcChanged && !ch.fcStatus) return;
  if (!ch.fcChanged && statusLook(ch.fcStatus.oldValue) === statusLook(ch.fcStatus.newValue)) return;
  if (ch.fcStatus && !['keep', 'home'].includes(route())) return;
  if (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
  if (document.querySelector('dialog[open]')) return;
  clearTimeout(redrawT);
  redrawT = setTimeout(() => { if (!FRAMES[route()] && V[route()] && !V[route()].noAutoRedraw) render(true); }, ch.fcStatus ? 400 : 1500);
});
document.getElementById('themeBtn').onclick = () => ppTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
document.getElementById('menuBtn').onclick = () => document.getElementById('side').classList.toggle('open');
api.storage.onChanged.addListener(ch => { if (ch.ppTheme) ppTheme(); });

// ---------- shared data ----------
const getName = async () => (((await api.storage.local.get('lastCase')).lastCase || {}).collector || '');
const setName = async n => { const lc = (await api.storage.local.get('lastCase')).lastCase || {}; await api.storage.local.set({ lastCase: { ...lc, collector: n } }); };
const getLog = async () => ((await api.storage.local.get('log')).log || []);
async function recentSearches(n) {
  try { return (await RS_DB.all('jobs')).sort((a, b) => b.created.localeCompare(a.created)).slice(0, n); } catch (e) { return []; }
}

// The website tab you were on before opening PageProof (the newest normal web page in this window).
async function lastWebTab() {
  const tabs = await api.tabs.query({ currentWindow: true });
  const web = tabs.filter(t => /^https?:/.test(t.url || ''));
  web.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  return web[0] || null;
}

// =====================================================================================
// Home
// =====================================================================================
V.home = async () => {
  const [name, log, jobs, seen] = [await getName(), await getLog(), await recentSearches(3), (await api.storage.local.get('ppSeenVersion')).ppSeenVersion];
  const hr = new Date().getHours(), hello = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const caps = [...log].reverse().slice(0, 5);
  const fc = await homeFinds();
  const news = seen !== VERSION ? `<div class="banner info">${ic('ideas', 20)}<div style="flex:1 1 260px;min-width:0"><b>PageProof was updated to ${VERSION}</b> <span class="muted" style="font-size:13.5px">All your captures, settings and lists are still here.</span></div><a class="btn" href="#whatsnew">See what's new</a></div>` : '';
  return `${news}${fc.alerts}
  ${head(today, hello + (name ? ', ' + esc(name.split(' ')[0]) : ''), 'Pick up where you left off, or start something new. Your evidence is saved on this computer.', `<button class="btn" data-act="tour">Take the tour</button>`)}
  <section class="grid g3" aria-label="Start">
    <a class="start hero" href="#capture"><span class="ic">${ic('capture', 22)}</span><b>Capture a page</b><span>The whole page as proof: PDF, web copy, fingerprints and three trusted timestamps.</span></a>
    <a class="start" href="#search"><span class="ic">${ic('find', 22)}</span><b>Find copies of my photos</b><span>Search Google Lens, Yandex and Bing, and check every result against your original.</span></a>
    <a class="start" href="#inspect"><span class="ic">${ic('tools', 22)}</span><b>Look closer at a photo</b><span>Read its hidden data, lay a copy over the original, or mark it up for a client.</span></a>
  </section>
  <div class="split">
    <div style="flex:2 1 520px;display:flex;flex-direction:column;gap:20px;min-width:0">
      ${fc.main}
      <section class="card">
        <div class="pad row" style="border-bottom:1px solid var(--line)"><h2>Recent searches</h2><a class="btn ghost" style="margin-left:auto" href="#searches">All searches</a><a class="btn primary" href="#search">New search</a></div>
        ${jobs.length ? jobs.map(j => {
          const links = j.pics.reduce((a, p) => a + (p.links || []).length, 0), nNew = j.pics.reduce((a, p) => a + (p.links || []).filter(l => l.isNew).length, 0);
          return `<a class="list-item" href="#searches" style="border-radius:0;padding:12px 22px;border-bottom:1px solid var(--line)"><img class="thumb" src="${esc(j.pics[0] && j.pics[0].thumb)}" width="64" height="44" alt=""><div style="min-width:0;flex:1"><b>${j.pics.length} ${j.pics.length === 1 ? 'photo' : 'photos'}${j.folder ? ' · daily 50' : ''}</b><div class="muted" style="font-size:13.5px">${fmtDate(j.created)} · ${links} links found</div></div>${nNew ? `<span class="tag copy">${nNew} new</span>` : ''}</a>`;
        }).join('') : `<div class="pad muted">No searches yet. <a href="#search">Search your first photos</a>.</div>`}
      </section>
      <section class="card">
        <div class="pad row" style="border-bottom:1px solid var(--line)"><h2>Recent evidence</h2><a class="btn ghost" style="margin-left:auto" href="#library">Open the library</a></div>
        ${caps.length ? `<div class="scroll"><table><thead><tr><th>Site</th><th>Case</th><th>When</th><th style="text-align:right">Open</th></tr></thead><tbody>
          ${caps.map(e => { const s = (e.saves || [])[e.saves ? e.saves.length - 1 : 0] || {}; return `<tr><td><b>${esc(site(e.url))}</b><div class="faint" style="font-size:12.5px;max-width:340px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.title || '')}</div></td><td class="mono">${esc(s.caseRef || '—')}</td><td class="muted">${fmtDate(e.time)}</td><td style="text-align:right"><button class="btn" style="min-height:32px;font-size:13px" data-act="opencap" data-v="${esc(e.id)}">Open</button></td></tr>`; }).join('')}
        </tbody></table></div>` : `<div class="pad muted">Nothing captured yet. Open a web page, click the PageProof icon, then <b>Capture this page</b>.</div>`}
      </section>
    </div>
    <div style="flex:1 1 300px;display:flex;flex-direction:column;gap:20px">
      ${fc.side}
      <section class="card pad" style="display:flex;flex-direction:column;gap:10px">
        <h2>Capture the page you were on</h2>
        <p class="muted" style="margin:0;font-size:14px">Or click the PageProof icon on any page. The keyboard shortcut is <span class="kbd" id="shortcut">Alt+Shift+P</span>.</p>
        <button class="btn primary" data-act="capturelast">${ic('capture', 18)} Capture it now</button>
      </section>
      <section class="card pad" style="display:flex;flex-direction:column;gap:10px">
        <h2>Keep it handy</h2>
        <p class="muted" style="margin:0;font-size:14px">Pin the PageProof icon, and open the side panel to keep PageProof beside every website.</p>
        <a class="btn" href="#browser">${ic('panel', 18)} How to pin it</a>
      </section>
    </div>
  </div>`;
};
// Home's Find copies cards: new copies waiting, Keep searching, still online, by client.
async function homeFinds() {
  const d = await FC.drive();
  if (!d.done) return { alerts: '', side: '', main: `<section class="card pad row" style="gap:14px"><span class="ic" style="color:var(--accent)">${ic('find', 26)}</span><div style="flex:1 1 260px"><h2>Search all your clients' photos, all day</h2><span class="muted" style="font-size:14px">Connect the shared Google Drive once and PageProof keeps looking for copies by itself.</span></div><a class="btn primary" href="#connect">Connect your photos</a></section>` };
  const [copies, st, k, store] = [await FC.allCopies(), (await api.storage.local.get('fcStatus')).fcStatus, await FC.keep(), await api.storage.local.get(['fcToday', 'fcDriveBack', 'fcDriveOffline', 'fcPause'])];
  const vis = copies.filter(c => !RS_LISTS.isHidden(c.site, c.url));
  const nNew = vis.filter(c => c.status === 'new').length;
  const back = vis.filter(c => c.status !== 'removed' && c.online === 'back');
  const stolen = vis.filter(c => c.status === 'stolen');
  const up = stolen.filter(c => c.online !== 'gone').length;
  const by = {};
  for (const c of vis) if (c.status === 'new') by[c.client || 'Client unknown'] = (by[c.client || 'Client unknown'] || 0) + 1;
  const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = top.length ? top[0][1] : 1;
  const today = store.fcToday && store.fcToday.day === new Date().toDateString() ? store.fcToday : { searched: 0, found: 0 };
  const alive = st && Date.now() - st.beat < 90000;
  const ds = await FC.driveState(false);
  let alerts = '';
  if (store.fcDriveOffline) alerts += `<div class="banner bad" role="alert">${ic('help', 22)}<div style="flex:1 1 260px"><b>Can't reach Google Drive. Searching is paused.</b><div style="font-size:13.5px;color:var(--ink)">Drive for desktop is signed out or not running. It picks up where it left off.</div></div><a class="btn" href="#keep">Keep searching</a></div>`;
  else if (ds === 'prompt') alerts += `<div class="banner warn" role="alert">${ic('help', 22)}<div style="flex:1 1 260px"><b>One click needed: let PageProof read your photos again</b></div><button class="btn primary" data-act="driveallow">Allow</button></div>`;
  const upd = await ppUpState();
  if (upd && upd.has) alerts += `<div class="banner info" role="status"><div style="flex:1 1 260px"><b>PageProof ${esc(upd.latest)} is ready</b><div style="font-size:13.5px">You have ${VERSION}. Updating keeps everything you have.</div></div><a class="btn primary" href="#health" data-act="upgo">Update</a></div>`;
  for (const [e, until] of Object.entries(await FC.brokenEngines())) alerts += `<div class="banner bad" role="alert">${ic('help', 22)}<div style="flex:1 1 260px"><b>${FC.ENGINE_NAME[e]} may have stopped working</b><div style="font-size:13.5px;color:var(--ink)">It gave nothing for many photos in a row, so PageProof is resting it until ${new Date(until).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}. Those empty results are not counted against your photos. The other search sites carry on.</div></div><a class="btn" href="#health">See details</a></div>`;
  if (back.length) alerts += `<div class="banner bad" role="alert"><div style="flex:1 1 260px"><b>${back.length} ${back.length === 1 ? 'copy is' : 'copies are'} back online</b><div style="font-size:13.5px;color:var(--ink)">They had gone, and came back: ${esc([...new Set(back.map(c => c.site))].slice(0, 3).join(', '))}</div></div><a class="btn primary" href="#found?filter=Back%20online">See them</a></div>`;
  const main = `<section class="card pad" style="display:flex;flex-direction:column;gap:12px">
    <div class="row"><h2>New copies by client</h2><a class="btn ghost" style="margin-left:auto" href="#found">Copies found</a>${nNew ? `<a class="btn primary" href="#review">One at a time (${nNew})</a>` : ''}</div>
    ${top.length ? top.map(([n, v]) => `<a href="#found?client=${encodeURIComponent(n)}" class="row" style="gap:10px;color:inherit;text-decoration:none;flex-wrap:nowrap"><span style="width:160px;flex-shrink:0;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(n)}</span><span class="bar" style="flex:1"><i style="width:${v / max * 100}%;background:var(--copy)"></i></span><span class="num" style="width:40px;text-align:right">${v}</span></a>`).join('') : '<p class="muted" style="margin:0">Nothing new to review. Well done.</p>'}
  </section>`;
  const side = `<section class="card pad" style="display:flex;flex-direction:column;gap:8px">
    <div class="row"><h2>Keep searching</h2><span class="tag ${k.on && !store.fcPause ? 'ok' : 'grey'}" style="margin-left:auto">${!k.on ? 'Off' : store.fcPause ? 'Paused' : alive ? 'On' : 'Starting'}</span></div>
    <span class="muted" style="font-size:14px">${k.on && alive ? esc(st.text) : k.on ? 'The search window is starting.' : 'Turn it on to search all day.'}</span>
    <span class="faint" style="font-size:13px">Today: ${today.searched} ${today.searched === 1 ? 'photo' : 'photos'} searched, ${today.found} new ${today.found === 1 ? 'copy' : 'copies'}</span>
    <a class="btn" href="#keep">Open Keep searching</a></section>
    <section class="card pad" style="display:flex;flex-direction:column;gap:8px"><h2>Still online?</h2>
    <span class="muted" style="font-size:14px">${stolen.length ? `${up} of ${stolen.length} copies you marked stolen are still up. They're checked every week.` : 'Copies you mark stolen are checked every week.'}</span>
    <div class="row"><a class="btn" href="#found?filter=Stolen">Stolen copies</a><a class="btn ghost" href="#weekly">Weekly summary</a></div></section>`;
  // Most copied photos: your photos that turn up on the most pages.
  const per = new Map();
  for (const c of vis) if (c.status !== 'removed' && c.status !== 'licensed') per.set(c.photo, (per.get(c.photo) || 0) + 1);
  const most = [...per.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 5);
  let mostHtml = '';
  if (most.length) {
    const ps = await FC.DB.getMany('photos', most.map(m => m[0]));
    const mx = most[0][1];
    mostHtml = `<section class="card pad" id="mostCopied" style="display:flex;flex-direction:column;gap:6px"><div class="row"><h2>Most copied photos</h2><span class="faint" style="margin-left:auto;font-size:13px">Pages each one is on</span></div>
      ${most.map(([id, n], i) => { const p = ps[i] || { id, name: 'Photo' }; const src = p.thumb ? esc(p.thumb) : p.th ? (FC.pics.seen(p.id) || `data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" data-th="${esc(p.id)}`) : 'icons/icon48.png';
        return `<a class="toprow" href="#found?photo=${encodeURIComponent(id)}"><img src="${src}" alt=""><span style="min-width:0"><b>${esc(p.name || 'Photo')}</b><span class="faint" style="font-size:12.5px">${esc(p.client || 'Client unknown')}</span></span><span class="bar"><i style="width:${n / mx * 100}%;background:var(--copy)"></i></span><b class="num" style="text-align:right">${n}</b></a>`; }).join('')}
    </section>`;
  }
  const hero = nNew ? `<a class="homehero" href="#found"><div class="n">${nNew}</div><div style="flex:1;min-width:200px"><h2>new ${nNew === 1 ? 'copy' : 'copies'} to look at</h2><p>${top.length === 1 ? 'One client has' : top.length + ' clients have'} photos found on other sites.</p></div><span class="btn">Review them ›</span></a>` : '';
  return { alerts, main: hero + main + mostHtml, side };
}
V.home.after = async () => {
  try { const c = (await api.commands.getAll()).find(x => x.name === 'capture-page'); if (c && c.shortcut) document.getElementById('shortcut').textContent = c.shortcut; } catch (e) { /* none */ }
};

// =====================================================================================
// Capture a page
// =====================================================================================
V.capture = async () => {
  const log = await getLog();
  const caps = [...log].reverse().slice(0, 12);
  const t = await lastWebTab();
  return `${head('Collect evidence', 'Capture a page', 'PageProof saves the whole web page from top to bottom as a PDF and a web copy, with fingerprints and three trusted timestamps.')}
  <div class="split" style="align-items:flex-start">
    <section class="card pad" style="flex:1 1 360px;display:flex;flex-direction:column;gap:12px">
      <h2>Capture a page now</h2>
      ${t ? `<div class="row" style="gap:10px;flex-wrap:nowrap"><img src="${esc(t.favIconUrl || 'icons/icon32.png')}" width="20" height="20" alt=""><div style="min-width:0"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.title || site(t.url))}</b><span class="faint mono" style="font-size:12px">${esc(site(t.url))}</span></div></div>
      <button class="btn primary big" data-act="capturelast">${ic('capture', 20)} Capture this page</button>` : `<p class="muted" style="margin:0">Open the web page you want in another tab first.</p>`}
      <ol class="muted" style="margin:0;padding-left:20px;font-size:14px;display:flex;flex-direction:column;gap:4px">
        <li>Open the page and let it finish loading.</li>
        <li>Click the PageProof icon, then <b>Capture this page</b>. Or press <span class="kbd">Alt+Shift+P</span>.</li>
        <li>Don't scroll while it works. A box on the page shows each step.</li>
        <li>The capture opens in a new tab. Type the case number and press <b>Save evidence pack</b>.</li>
      </ol>
    </section>
    <section class="card" style="flex:2 1 520px;min-width:0">
      <div class="pad row" style="border-bottom:1px solid var(--line)"><h2>Your last captures</h2><a class="btn ghost" style="margin-left:auto" href="#library">All evidence</a></div>
      ${caps.length ? caps.map(e => `<button class="list-item" style="border-radius:0;padding:12px 22px;border-bottom:1px solid var(--line)" data-act="opencap" data-v="${esc(e.id)}"><span class="ic" style="color:var(--accent)">${ic('capture', 20)}</span><span style="min-width:0;flex:1"><b>${esc(site(e.url))}</b><span class="faint" style="display:block;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.title || '')}</span></span><span class="muted" style="font-size:13px">${fmtDate(e.time)}</span>${(e.saves || []).length ? '<span class="tag ok">Saved</span>' : '<span class="tag grey">Not saved</span>'}</button>`).join('') : '<div class="pad muted">No captures yet.</div>'}
    </section>
  </div>`;
};

// =====================================================================================
// Evidence library
// =====================================================================================
function libRows(log) {
  const rows = [];
  for (const e of [...log].reverse()) {
    const saves = e.saves && e.saves.length ? e.saves : [{}];
    for (const s of saves) rows.push({ e, s });
  }
  return rows;
}
V.library = async () => {
  const rows = libRows(await getLog());
  const q = (state.libQ || '').toLowerCase();
  const shown = rows.filter(({ e, s }) => !q || [e.url, e.title, s.caseRef, s.collector, e.captureId].join(' ').toLowerCase().includes(q));
  const reps = ((await api.storage.local.get('fcReports')).fcReports || []).slice().reverse().filter(r => !q || [r.site, r.url, r.caseNo, r.photo, r.client, r.id].join(' ').toLowerCase().includes(q));
  return `${head('Keep and prove', 'Evidence library', 'Every page you captured on this computer, and every evidence pack saved from it.', `<button class="btn" data-act="libcsv">${ic('down', 18)} Download list (CSV)</button><a class="btn" href="#verify">${ic('verify', 18)} Verify a pack</a>`)}
  <section class="card" style="overflow:hidden">
    <div class="row" style="gap:10px;padding:12px 18px;border-bottom:1px solid var(--line);background:var(--bg)">
      <input id="libq" class="chip" style="min-height:38px;padding:0 12px;font-size:14px;flex:1 1 260px" placeholder="Find by site, case number, name or capture ID" value="${esc(state.libQ || '')}" aria-label="Find evidence">
      <span class="faint" style="font-size:13px">${shown.length} of ${rows.length}</span></div>
    <div class="scroll"><table><thead><tr><th>Captured</th><th>Page</th><th>Case</th><th>Collected by</th><th>Evidence pack</th><th style="text-align:right">Open</th></tr></thead><tbody>
    ${shown.map(({ e, s }) => `<tr><td class="muted" style="white-space:nowrap">${fmtDate(e.time)}<div class="mono faint" style="font-size:11.5px">${esc(e.captureId || '')}</div></td>
      <td style="max-width:360px"><b>${esc(site(e.url))}</b><div class="faint" style="font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.title || e.url)}</div></td>
      <td class="mono">${esc(s.caseRef || '—')}</td><td>${esc(s.collector || '—')}</td>
      <td>${s.at ? `<span class="tag ok">Saved</span> <span class="faint" style="font-size:12.5px">${fmtDate(s.at)}</span>` : '<span class="tag grey">Not saved</span>'}</td>
      <td style="text-align:right;white-space:nowrap"><button class="btn" style="min-height:32px;font-size:13px" data-act="opencap" data-v="${esc(e.id)}">Open</button></td></tr>`).join('') || `<tr><td colspan="6" class="muted" style="padding:28px;text-align:center">${rows.length ? 'Nothing matches.' : 'Nothing captured yet.'}</td></tr>`}
    </tbody></table></div>
  </section>
  <section class="card" style="overflow:hidden">
    <div class="pad row" style="border-bottom:1px solid var(--line)"><h2>Evidence reports</h2><span class="faint" style="font-size:13px">From Copies found: one report per copy</span><a class="btn ghost" style="margin-left:auto" href="#weekly">Weekly summary</a></div>
    <div class="scroll"><table><thead><tr><th>Made</th><th>Copy</th><th>Client's photo</th><th>Case</th><th>Match ID</th><th style="text-align:right">Open</th></tr></thead><tbody>
    ${reps.slice(0, 300).map(r => `<tr><td class="muted" style="white-space:nowrap">${fmtDate(r.at)}</td><td style="max-width:300px"><b>${esc(r.site)}</b><div class="faint" style="font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.url)}</div></td><td>${esc(r.photo || '')}<div class="faint" style="font-size:12.5px">${esc(r.client || '')}</div></td><td class="mono">${esc(r.caseNo || '—')}</td><td class="mono">${esc(r.id || '')}</td><td style="text-align:right"><a class="btn" style="min-height:32px;font-size:13px" href="${safeUrl(r.url)}" target="_blank" rel="noreferrer">Page</a></td></tr>`).join('') || '<tr><td colspan="6" class="muted" style="padding:22px;text-align:center">No evidence reports yet. Make one from a copy in All copies found.</td></tr>'}
    </tbody></table></div>
    <div class="pad faint" style="font-size:12.5px;border-top:1px solid var(--line)">The PDF files themselves are in your Downloads folder, named PageProof_evidence_….</div>
  </section>
  <p class="faint" style="margin:0;font-size:12.5px">Captures are kept inside this browser. The evidence packs you saved are in your Downloads folder (or wherever you chose).</p>`;
};
V.library.after = () => {
  const i = document.getElementById('libq');
  i.oninput = () => { state.libQ = i.value; render(true).then(() => { const j = document.getElementById('libq'); j.focus(); j.setSelectionRange(j.value.length, j.value.length); }); };
};
async function libCsv() {
  const head = ['Captured', 'Capture ID', 'Web address', 'Page title', 'Case / ref', 'Collected by', 'Evidence pack saved', 'Pack SHA-256', 'Trusted timestamps', 'Notes'];
  const rows = libRows(await getLog()).map(({ e, s }) => [fmtDate(e.time), e.captureId || '', e.url, e.title || '', s.caseRef || '', s.collector || '',
    s.at ? fmtDate(s.at) + ' - ' + s.file : '(not saved)', s.sha256 || '', s.timestamps || (s.timestamp ? s.timestamp + ' (' + s.tsa + ')' : ''), s.notes || '']);
  // Spreadsheet programs run cells that start with = + - @ as formulas, so those get a ' first.
  const q = v => { let t = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + [head, ...rows].map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv' }));
  a.download = 'PageProof_evidence_list.csv'; a.click();
}

// =====================================================================================
// Toolbar and side panel
// =====================================================================================
V.browser = async () => `${head('In your browser', 'Toolbar and side panel', 'Keep PageProof one click away on every website.')}
  <div class="grid g2">
    <section class="card pad" style="display:flex;flex-direction:column;gap:10px"><h2>1. Pin the icon</h2>
      <p class="muted" style="margin:0">Click the jigsaw piece ${ic('files', 14)} next to the address bar, then the pin beside <b>PageProof</b>. The icon then stays in the toolbar.</p>
      <p class="muted" style="margin:0">Click the icon for the toolbar menu: <b>Capture this page</b>, the photos on the page, and <b>Open full PageProof</b>.</p></section>
    <section class="card pad" style="display:flex;flex-direction:column;gap:10px"><h2>2. Keep it open beside the page</h2>
      <p class="muted" style="margin:0">The side panel stays open while you browse. It shows what PageProof knows about the page you're on, with Capture and the photos on the page.</p>
      <button class="btn primary" data-act="sidepanel" style="align-self:flex-start">${ic('panel', 18)} Open the side panel</button>
      <span class="faint" style="font-size:12.5px">Works in Chrome and Edge.</span></section>
    <section class="card pad" style="display:flex;flex-direction:column;gap:10px"><h2>Keyboard shortcut</h2>
      <p class="muted" style="margin:0"><span class="kbd" id="shortcut2">Alt+Shift+P</span> captures the page you're on straight away.</p>
      <button class="btn" data-act="shortcuts" style="align-self:flex-start">Change the shortcut</button></section>
    <section class="card pad" style="display:flex;flex-direction:column;gap:10px"><h2>Right-click menu</h2>
      <p class="muted" style="margin:0">Right-click a photo, the page or a link and look for <b>PageProof</b>:</p>
      <ul class="hwlist"><li><b>On a photo:</b> Inspect this photo, Find copies of it (Google Lens, Yandex, Bing or all three), Save biggest copy, Open biggest copy in a tab</li><li><b>Anywhere on the page:</b> Capture this page</li><li><b>On a link:</b> Capture the linked page</li></ul></section>
  </div>`;
V.browser.after = async () => {
  try { const c = (await api.commands.getAll()).find(x => x.name === 'capture-page'); if (c && c.shortcut) document.getElementById('shortcut2').textContent = c.shortcut; } catch (e) { /* none */ }
};

// =====================================================================================
// Settings
// =====================================================================================
// Text size: the browser's own zoom, set for every PageProof page at once (the browser keeps it
// per site, and all of PageProof counts as one site), so layouts stay right at every size.
const TEXT_SIZES = [['normal', 'Normal', 1], ['large', 'Large', 1.1], ['larger', 'Larger', 1.25]];
async function ppZoomKey() {
  let z = 1;
  try { z = await api.tabs.getZoom(); } catch (e) { /* not available: say Normal */ }
  return TEXT_SIZES.reduce((best, t) => Math.abs(t[2] - z) < Math.abs(best[2] - z) ? t : best)[0];
}
ACTS.textsize = async v => {
  const t = TEXT_SIZES.find(x => x[0] === v); if (!t) return;
  try { await api.tabs.setZoom(t[2]); await api.storage.local.set({ ppTextSize: v }); toast('Text size: ' + t[1] + '.'); }
  catch (e) { toast('Could not change the size here. Hold Ctrl and press + instead.'); }
  render(true);
};
V.settings = async () => {
  const [name, hw, docs] = [await getName(), await ppHardware(), await RS_DOCS.state()];
  await RS_LISTS.load();
  const upd = await ppUpState();
  const zoomKey = await ppZoomKey();
  return `${head('Settings', 'Settings', 'These apply to everything in PageProof and are saved on this computer.')}
  <div class="grid g2">
    <section class="card pad" style="display:flex;flex-direction:column;gap:12px"><h2>You</h2>
      <label class="field" for="sName">Your name on every pack and report<input id="sName" value="${esc(name)}" placeholder="For example, Ben"></label>
      <div class="dsh" style="margin-top:6px">Version</div>
      <p class="muted" style="margin:0;font-size:14px">PageProof ${VERSION}${upd && upd.has ? ` · <b style="color:var(--warn)">version ${esc(upd.latest)} is ready</b>` : ''}</p>
      <div class="row" style="gap:8px"><a class="btn${upd && upd.has ? ' primary' : ''}" href="#health" data-act="upgo">${upd && upd.has ? 'Get the update' : 'Updates'}</a><a class="btn" href="#whatsnew">What's new</a><button class="btn" data-act="tour">Take the tour again</button></div></section>
    <section class="card pad" id="textsize" style="display:flex;flex-direction:column;gap:12px"><h2>Text size</h2>
      <p class="muted" style="margin:0;font-size:14px">Makes everything in PageProof bigger: words, buttons and pictures. Saved on this computer only.</p>
      <div class="seg" role="group" aria-label="Text size">${TEXT_SIZES.map(([k, l, z]) => `<button class="${zoomKey === k ? 'on' : ''}" aria-pressed="${zoomKey === k}" data-act="textsize" data-v="${k}"><span style="font-size:${Math.round(14 * z)}px">${l}</span></button>`).join('')}</div>
      <span class="faint" style="font-size:12.5px">Ctrl and + or − also works on any PageProof page, and PageProof remembers it.</span></section>
    <section class="card pad" style="display:flex;flex-direction:column;gap:12px"><h2>Is everything working?</h2>
      <p class="muted" style="margin:0;font-size:14px">Green and red lights for Google Drive, Keep searching, each search site and your backup. One button copies the details to send for support.</p>
      <a class="btn" style="align-self:flex-start" href="#health">Check now</a></section>
    <section class="card pad" style="display:flex;flex-direction:column;gap:12px"><h2>PageProof folder</h2>
      <p class="muted" style="margin:0;font-size:14px">Documents › PageProof. Holds your hidden and approved sites and rejected links as text files, so they survive updates and reinstalls.</p>
      ${docs === 'granted' ? `<span class="tag ok" style="align-self:flex-start">${ic('check', 13, 3)} Connected</span><button class="btn" style="align-self:flex-start" data-act="docschoose">Change folder</button>`
        : docs === 'prompt' ? `<span class="tag warn" style="align-self:flex-start">Needs one click</span><button class="btn primary" style="align-self:flex-start" data-act="docsallow">Allow PageProof to use it</button>`
        : `<span class="tag warn" style="align-self:flex-start">Not set up</span><button class="btn primary" style="align-self:flex-start" data-act="docschoose">Set up the PageProof folder</button><span class="faint" style="font-size:12.5px">Pick Documents in the window that opens. PageProof makes a PageProof folder inside it.</span>`}</section>
    <section class="card pad" style="display:flex;flex-direction:column;gap:12px"><h2>Hidden and approved sites</h2>
      <p class="muted" style="margin:0;font-size:14px">${RS_LISTS.hidden.length.toLocaleString()} hidden · ${RS_LISTS.allowed.length.toLocaleString()} approved · ${RS_REJECT.items.length.toLocaleString()} rejected links.</p>
      <a class="btn" style="align-self:flex-start" href="#hidden">See and edit the lists</a></section>
    <section class="card pad" style="display:flex;flex-direction:column;gap:12px"><div class="row"><h2>Your computer</h2><span class="tag ${hw.level === 'Light' ? 'warn' : 'ok'}" style="margin-left:auto">${hw.level}</span></div>
      <p class="muted" style="margin:0;font-size:14px">${hw.cores} cores, ${hw.memGB} GB memory. Up to ${hw.limits.checks} photo ${hw.limits.checks > 1 ? 'checks' : 'check'} and ${hw.limits.tabs} search ${hw.limits.tabs > 1 ? 'tabs' : 'tab'} at once.</p>
      <a class="btn" style="align-self:flex-start" href="#computer">See limits</a></section>
  </div>`;
};
V.settings.after = () => {
  const n = document.getElementById('sName');
  n.onchange = async () => { await setName(n.value.trim()); toast('Saved. New packs say "Collected by ' + (n.value.trim() || '…') + '".'); };
};

// =====================================================================================
// Hidden and approved sites
// =====================================================================================
const kindOf = s => s.startsWith('.') ? 'Ending' : s.includes('/') ? 'Account or part' : s.split('.').length > 2 && !/\.(co|com|org|net|gov|ac)\.[a-z]{2}$/.test(s) ? 'Sub-site' : 'Whole site';
V.hidden = async () => {
  await RS_LISTS.load();
  const tab = state.hidTab, q = state.hidQ.toLowerCase();
  // Approved for one client: kept with each client (site | client).
  const perClient = [];
  for (const c of await FC.DB.all('clients')) for (const s of c.licensed || []) perClient.push(s + ' | ' + c.name);
  const list = tab === 'rejected' ? RS_REJECT.items.map(r => r.url) : tab === 'client' ? perClient.sort().reverse() : RS_LISTS[tab];
  const rows = [...list].reverse().filter(s => s.toLowerCase().includes(q) && (tab === 'rejected' || tab === 'client' || state.hidKind === 'All' || kindOf(s) === state.hidKind));
  const T = [['hidden', 'Hidden sites', RS_LISTS.hidden.length], ['allowed', 'Approved for every client', RS_LISTS.allowed.length], ['client', 'Approved for one client', perClient.length], ['rejected', 'Rejected links', RS_REJECT.items.length]];
  const flat = tab === 'rejected' || tab === 'client';
  const page = rows.slice(0, state.hidMore || 100);
  return `${head('Settings', 'Hidden and approved sites', 'Hidden sites never show up in any search. Approved sites may use the photos: copies found there are marked Licensed by themselves.', `<button class="btn" data-act="hidsave">${ic('down', 18)} Download list</button><button class="btn" data-act="hidload">Add from a file</button>`)}
  <section class="card" style="overflow:hidden">
    <div class="toolbar"><div class="tabs" role="tablist">${T.map(([k, l, n]) => `<button role="tab" class="${tab === k ? 'on' : ''}" aria-selected="${tab === k}" data-act="hidtab" data-v="${k}">${l} <span>${n.toLocaleString()}</span></button>`).join('')}</div></div>
    <div class="row" style="gap:10px;padding:12px 18px;border-bottom:1px solid var(--line);background:var(--bg)">
      <input id="hidq" class="chip" style="min-height:38px;padding:0 12px;font-size:14px;flex:1 1 260px" placeholder="${tab === 'rejected' ? 'Find a rejected link' : tab === 'client' ? 'Find a site or a client' : 'Find or add a site, like patch.com or x.com/nypost'}" value="${esc(state.hidQ)}" aria-label="Find a site">
      ${tab === 'client' ? '<span class="faint" style="font-size:13px">Add one from a copy: open it in Copies found and press Approve site.</span>' : ''}${!flat ? `<button class="btn primary" data-act="hidadd">＋ ${tab === 'hidden' ? 'Hide' : 'Approve'} it</button>
      <div class="seg">${['All', 'Whole site', 'Sub-site', 'Account or part', 'Ending'].map(k => `<button class="${state.hidKind === k ? 'on' : ''}" data-act="hidkind" data-v="${k}">${k}</button>`).join('')}</div>` : ''}</div>
    <div class="scroll"><table><thead><tr><th>${tab === 'rejected' ? 'Link' : tab === 'client' ? 'Site' : 'Site or account'}</th>${tab === 'rejected' ? '<th>Photo</th>' : tab === 'client' ? '<th>Approved for</th>' : '<th>What it covers</th>'}<th></th></tr></thead><tbody>
      ${page.map(h => { const r = tab === 'rejected' ? RS_REJECT.items.find(x => x.url === h) : null; if (tab === 'client') { const [site, who] = h.split(' | '); return `<tr><td><b class="mono" style="font-size:13px;overflow-wrap:anywhere">${esc(site)}</b></td><td>${esc(who)}</td><td style="text-align:right"><button class="btn" style="min-height:32px;font-size:13px" data-act="hidremove" data-v="${esc(h)}">↺ Remove</button></td></tr>`; }
        return `<tr><td><b class="mono" style="font-size:13px;overflow-wrap:anywhere">${esc(h)}</b></td><td>${r ? esc(r.pic || 'every photo') : `<span class="tag grey">${kindOf(h)}</span>`}</td><td style="text-align:right"><button class="btn" style="min-height:32px;font-size:13px" data-act="hidremove" data-v="${esc(h)}">↺ ${tab === 'hidden' ? 'Show again' : tab === 'allowed' ? 'Remove' : 'Bring back'}</button></td></tr>`; }).join('') || `<tr><td colspan="3" class="muted" style="padding:28px;text-align:center">${q ? (flat ? 'Nothing matches.' : 'Nothing matches. Press the button to add it.') : 'This list is empty.'}</td></tr>`}
    </tbody></table></div>
    <div class="row faint" style="padding:10px 18px;border-top:1px solid var(--line);font-size:12.5px;gap:12px"><span>Showing ${page.length.toLocaleString()} of ${rows.length.toLocaleString()}.</span>${rows.length > page.length ? '<button class="btn" style="min-height:30px;font-size:13px;margin-left:auto" data-act="hidmore">Show more</button>' : ''}</div>
  </section>
  <p class="faint" style="margin:0;font-size:12.5px">${RS_LISTS.fileState === 'granted' ? 'Saved in Documents › PageProof as hidden-sites.txt, allowed-sites.txt and rejected-links.txt.' : 'Saved in this browser. <a href="#settings">Set up the PageProof folder</a> to also keep them as text files that survive a reinstall.'}</p>`;
};
V.hidden.after = () => {
  const i = document.getElementById('hidq');
  i.oninput = () => { state.hidQ = i.value; state.hidMore = 0; render(true).then(() => { const j = document.getElementById('hidq'); j.focus(); j.setSelectionRange(j.value.length, j.value.length); }); };
  i.onkeydown = e => { if (e.key === 'Enter' && !['rejected', 'client'].includes(state.hidTab)) act('hidadd'); };
};
document.getElementById('hidLoad').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  await RS_LISTS.load();
  const kind = state.hidTab === 'allowed' ? 'allowed' : 'hidden';
  const have = new Set(RS_LISTS[kind]); let n = 0;
  for (const s of RS_LISTS.parse(await f.text())) if (!have.has(s)) { have.add(s); RS_LISTS[kind].push(s); n++; }
  await RS_LISTS.save();
  toast(n + ' ' + (n === 1 ? 'site' : 'sites') + ' added');
  render(true);
});

// =====================================================================================
// Your computer
// =====================================================================================
V.computer = async () => {
  const h = await ppHardware(), L = h.limits;
  return `${head('Settings', 'Your computer', 'PageProof checks how strong this computer is and sets its own limits, so searching never slows down your work. These numbers are read from the computer you\'re on now.')}
  <section class="card pad" style="display:flex;flex-direction:column;gap:14px">
    <div class="row" style="gap:10px"><h2>This computer</h2><span class="tag ${h.level === 'Light' ? 'warn' : 'ok'}" style="margin-left:auto">${h.level} computer</span></div>
    <div class="ofacts">
      <div class="ofact"><span>Processor</span><b>${h.cores} cores</b></div>
      <div class="ofact"><span>Memory</span><b>${h.memGB} GB${h.freeGB !== null ? ` (${h.freeGB} GB free now)` : ''}</b></div>
      <div class="ofact"><span>System</span><b>${esc(h.system)}</b></div>
      <div class="ofact"><span>Checked</span><b>Just now, again every week</b></div></div>
    <div class="dsec"><div class="dsh">So PageProof will use at most</div>
    <div class="hwlim">
      <div><b>${L.checks}</b><span>photo ${L.checks > 1 ? 'checks' : 'check'} at a time</span></div>
      <div><b>${L.tabs}</b><span>search ${L.tabs > 1 ? 'tabs' : 'tab'} open at once</span></div>
      <div><b>${L.pace}</b><span>fastest Keep searching pace</span></div>
      <div><b>${L.ram}</b><span>of memory</span></div></div>
    <span class="muted" style="font-size:13.5px">The daily 50 takes ${L.fifty} at this level.</span></div>
    <div class="dsec"><div class="dsh">It also backs off by itself</div>
      <ul class="hwlist"><li>Pauses when the computer is busy for a minute (processor over 80%), and picks up again when it calms down.</li><li>Pauses on a laptop running on battery below 30%.</li><li>Waits while most of the memory is in use, for example during a video call.</li><li>Never goes over the limits above, even if you pick a faster pace.</li></ul></div>
    <label class="field" style="max-width:420px">Speed level<select id="hwsel">${[['auto', `Let PageProof decide (${h.auto})`], ['Light', 'Light: older or busy computer'], ['Normal', 'Normal'], ['Strong', 'Strong: fast computer']].map(([k, l]) => `<option value="${k}" ${h.choice === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  </section>`;
};
V.computer.after = () => {
  document.getElementById('hwsel').onchange = async e => { await api.storage.local.set({ ppHw: { choice: e.target.value } }); toast('Speed level saved'); render(true); };
};

// =====================================================================================
// What's new, help
// =====================================================================================
const NEWS = [
  ['Search tabs show the PageProof logo', 'The small pinned Google Lens, Yandex and Bing tabs now show the PageProof logo and name, so they are easy to tell apart from your own tabs. The red Google Drive bar also clears the moment you press Allow.'],
  ['A rule check before you mark Stolen', 'Pick what kind of site it is (company, church, public university, person, user-posted article and more). PageProof stops and asks before marking Stolen on uses that usually can\'t be pursued, like YouTube embeds or embeds from outside the U.S. You can still go ahead, or Remove it instead.'],
  ['Their page, read for you', 'The copy details now show the photo credit next to the picture on their page, signs it was on purpose (prices, Add to cart, ads), the date first published (from the photo\'s file name), a damages hint, and a Ready for legal checklist. The Evidence report gets a new "About this use" box.'],
  ['Research steps on Who\'s behind this site', 'A 12-step tick list (their pages, site owners, Justia, USPTO, OpenCorporates, state and Delaware business search, WHOIS, the Wayback Machine, court records, Google, LinkedIn). Your ticks are kept per site.'],
  ['Save as Breaking News photo', 'Right-click a newspaper photo › PageProof › Save as Breaking News photo. It names the file the firm\'s way (11.23.26_Subject_Lastname.jpg, with POOL for pool photos) and checks it against that photographer\'s photos first: New, or Recycled with the earlier file name.'],
  ['POOL photos are not searched', 'Photos with _POOL_ in their name are shared with other papers, so Keep searching skips them. They show a "POOL, not searched" tag.'],
  ['Reconnect your folders after an update', 'The first time you open PageProof after an update, it checks your Google Drive photos folder and Documents › PageProof first, with an Allow or Pick again button right there if the browser needs one.'],
  ['When Google Drive isn\'t answering, PageProof says why', 'The red bar now shows what Drive actually answered, and has a "Pick the photos folder again" button. Pick the same top folder as before: your ticked folders and photos stay.'],
  ['Pages open fast again', 'Pages no longer wait for Google Drive. PageProof checks Drive in the background by asking for one of your ticked folders (not the whole shared drive list, which can take a minute), and only shows "Google Drive isn\'t answering" when it really doesn\'t answer.'],
  ['Pages open even when Google Drive is stuck', 'When Google Drive for desktop stopped answering, Home, Copies found, Clients and photos, Keep searching and Settings stayed blank while they waited for it. Now they wait 8 seconds at most, then open with a red "Google Drive isn\'t answering" bar and a Try again button.'],
  ['Main page and update notice fixed', 'The main PageProof page could stay blank (only the top bar showed) while your browser was slow to answer a question about your folders. It now always opens within a few seconds. The toolbar menu no longer offers an update to the version you already have.'],
  ['Your Drive photos: read only, double-checked', 'PageProof only ever reads your Google Drive photos. It never changes, moves, renames, deletes or adds anything there. Now it also refuses to use a folder inside your photos for its own lists, and the search sites get a clean copy of each photo with no hidden data and a plain name (photo.jpg).'],
  ['Finding copies is faster and steadier', 'The photo check is about a third faster on copies and almost twice as fast on the many different photos a search turns up, with the same answers. On slower computers, good checks are no longer stopped and shown as "Can\'t check". The hourly look for new photos only opens this and last quarter\'s folders again, also inside a folder that holds several clients. Keep searching no longer tries photos that are not due yet, and its small window no longer opens and closes by itself during the weekly folder check.'],
  ['Capture page: a proof checklist and two clear steps', 'The Capture page shows four green ticks as the proof is made (whole page, pictures, fingerprints, trusted timestamps), then step 1 Case details and step 2 Save. Every button is still there.'],
  ['One at a time matches Copies found', 'A progress bar, Undo, big Stolen / Licensed / Remove / Skip buttons, the page link in view, and Their page on the right. Compare, Evidence report, Capture and Approve site sit underneath.'],
  ['Dark mode all the way through, with matching icons', 'Inspect, Compare, Markup, Convert and New search are now dark inside as well, not only their side panels. Their buttons use the same line icons as the rest of PageProof.'],
  ['See the space PageProof uses', 'Settings › Is everything working? shows what takes room and lets you free some. Copies you marked Stolen are never deleted there.'],
  ['Keyboard help and bigger text', 'Press ? for every key. New keys in Copies found: up and down arrows move between copies, Enter opens one, / jumps to the search box. Settings › Text size makes everything bigger.'],
  ['Every page double-checked', 'The older tools (Inspect, Compare, Markup, Convert, Verify, New search) now match the new look, in light and dark. PageProof no longer squashes into a thin strip in a narrow window. One blue to match the shield, and old menu names are gone from page titles.'],
  ['No more false "100% lines up"', 'The photo check could shrink a found picture to a dot and call two different photos a 100% match. It now needs a real shared area. Wrong matches it had let in, that you had not answered yet, were moved to Removed.'],
  ['Updating is a plain download now', 'PageProof no longer changes its own files (Windows security did not like that). When a new version is out, Settings › Is everything working? gives you the download and three steps.'],
  ['A new look', 'A shorter menu, a search box and Undo at the top, a Tools page for everything else, and a new shield logo. Nothing was taken away: Tools has every older page.'],
  ['Answer right on the row', 'Copies found has Stolen, Licensed and Remove on every row, with the page link in view. The ⋯ menu has Approve site, Hide site, Compare, Evidence report and Capture.'],
  ['Quick filters', 'One-click chips (Back online, Repeat offenders, Suspicious sites and more), plus Found (today, this week, this month), Match (exact, strong, loose) and the photo\'s year and quarter.'],
  ['Many copies on one site fold up', 'The first shows, the rest wait under "N more from this site", with buttons to answer them all in one go. After Stolen, PageProof offers the same article on sister sites.'],
  ['A picture of their page', 'The details panel shows their page in a small window and keeps one small picture of it (about 30 KB), so it is there next time. Untick "Show pages by themselves" to load it only when you ask.'],
  ['Their picture is kept when found', 'PageProof saves their copy of the photo (up to 4 MB) with its fingerprint the moment it is found, in case they take it down. It is deleted a week after you remove a copy.'],
  ['Undo list', 'The ▾ next to Undo lists your last ten answers. Take back any one of them, not only the last.'],
  ['Most copied photos', 'Home shows the photos with the most copies. Click one to see all of its copies.'],
  ['Told when there is an update', 'PageProof tells you when a newer version is out. Settings › Is everything working? has the download button and the three steps.'],
  ['Is everything working?', 'Green, yellow and red lights for Google Drive, Keep searching, each search site and your backup. "Copy details for support" copies numbers only, never names.'],
  ['A broken search site is spotted', 'If Google, Yandex or Bing suddenly gives nothing for many photos in a row, PageProof rests it, tells you, and does not count those empty results against your photos.'],
  ['Skipped photos', 'Find copies › Skipped photos lists every photo that could not be searched, with the reason and a Try again button.'],
  ['Repeat offenders first', 'A new copy on a site (or site owner) you already marked Stolen gets a "stolen before" badge and comes first in Review.'],
  ['Approve a site', 'In a copy\'s panel, Approve site lets a site use one client\'s photos or every client\'s. Its copies are marked Licensed by themselves from then on.'],
  ['Lighter and faster', 'Preview pictures now live in their own small store, so big lists use far less memory.'],
  ['Find copies, all day', 'Connect the shared Google Drive once. Keep searching then looks for copies of your clients\' photos one at a time, gently, and today\'s 50 runs a bigger batch.'],
  ['All copies found', 'Every copy in one list: group by client, photo, site or site owner, filter by how it\'s used, suspicious sites or credit removed, and hover for a quick side-by-side.'],
  ['Answer and move on', 'Stolen, Licensed, Remove or Skip opens the next copy. Every answer can be undone (U or Ctrl+Z).'],
  ['Registration numbers and Drive paths', 'Each copy shows the VA or application number found in the folders, and the exact Drive path of your client\'s photo.'],
  ['Evidence report', 'One PDF per copy, with both photos, the match check, hidden data compared and fingerprints. The case number is asked when you save.'],
  ['Site owners and Who\'s behind this site', 'Sites run by one company are put together, and each site is read for names, contacts and domain facts.'],
  ['Weekly summary', 'What was searched, found and marked each week, as a page or a PDF.'],
  ['A new home for everything', 'One PageProof page with the menu on the left: Collect evidence, Look closer, Keep and prove.'],
  ['Light and dark', 'Switch at the top right. Both are softer on the eyes. Reports always print white.'],
  ['New toolbar menu and side panel', 'Capture is the big button. Keep PageProof open beside any website.'],
  ['Tidier right-click menu', 'One PageProof item with Inspect, Find copies (Google Lens, Yandex, Bing or all three), Save biggest copy and Capture.'],
  ['Hidden and approved sites page', 'Search thousands of hidden sites, filter by kind, and bring any back with one click.'],
  ['Your computer', 'PageProof checks how strong your computer is and sets its own limits.'],
  ['Hover help', 'Hover a word with a dotted underline to see what it means.'],
  ['Batch capture removed', 'It wasn\'t reliable. Capture pages one at a time from the icon or the right-click menu.'],
];
// After every update: reconnect the folders first (the browser can lose its permission or its
// link to a folder when PageProof is replaced). Ben's idea, 4.3.7.
V.reconnect = async () => {
  const rc = state.rc || {};
  const row = (title, what, st, btns) => {
    const look = st === 'ok' ? ['ok', 'Connected'] : st === 'checking' ? ['grey', 'Checking…'] : st === 'none' ? ['grey', 'Not set up'] : ['bad', 'Needs you'];
    return `<div class="row" style="gap:14px;align-items:flex-start;padding:14px 0;border-bottom:1px solid var(--line)"><div style="flex:1 1 260px;min-width:0"><b>${title}</b><div class="muted" style="font-size:13.5px">${what}</div></div><span class="tag ${look[0]}">${look[1]}</span>${st === 'ok' || st === 'checking' ? '' : btns}</div>`;
  };
  const d = rc.drive || 'checking', o = rc.docs || 'checking';
  const driveRow = row('Your photos on Google Drive', d === 'prompt' ? 'Your browser wants one click before PageProof may read the photos again.' : d === 'offline' ? 'The browser lost its link to the folder. Pick the same top folder as before (for example H:\\Shared drives). Your ticked folders and photos stay.' + (rc.why ? '<br><span class="mono" style="font-size:12.5px">' + esc(rc.why) + '</span>' : '') : 'PageProof only ever reads this folder.',
    d, d === 'prompt' ? '<button class="btn primary" data-act="driveallow">Allow</button>' : '<button class="btn primary" data-act="drivepick">Pick the folder again</button>');
  const docsRow = row('Documents › PageProof', o === 'prompt' ? 'Your browser wants one click before PageProof may save its lists and backup there.' : o === 'none' ? 'Where PageProof keeps its lists and a backup of your settings. Pick (or make) a PageProof folder in Documents.' : 'Lists of hidden and approved sites, and a backup of your settings.',
    o, o === 'prompt' ? '<button class="btn primary" data-act="docsallow">Allow</button>' : '<button class="btn primary" data-act="docschoose">Pick folder</button>');
  const done = d === 'ok' && (o === 'ok' || o === 'none');
  return `${head('Settings', 'Reconnect your folders', 'PageProof was updated to ' + VERSION + '. Browsers sometimes need you to allow the folders again after an update, so this is checked first.')}
  <section class="card pad">${driveRow}${docsRow}
    <div class="row" style="margin-top:16px;gap:10px">${done ? `<b style="color:var(--ok)">All connected.</b>` : ''}<button class="btn${done ? ' primary' : ''}" style="margin-left:auto" data-act="rcdone">${done ? 'Continue' : 'Skip for now'}</button></div></section>`;
};
V.reconnect.after = async () => {
  if (state.rcBusy) return;
  state.rcBusy = true;
  try {
    const was = JSON.stringify(state.rc || {});
    const dr = (await FC.drive()).done ? await FC.driveStateSoft(true) : 'none';
    const docs = await RS_DOCS.state();
    const why = dr === 'offline' ? (((await api.storage.local.get('fcDriveWhy')).fcDriveWhy || {}).why || '') : '';
    state.rc = { drive: dr === 'granted' ? 'ok' : dr, docs: docs === 'granted' ? 'ok' : docs, why };
    if (JSON.stringify(state.rc) !== was && state.shown === 'reconnect') render(true);
  } finally { state.rcBusy = false; }
};
V.whatsnew = async () => `${head('Settings', 'What\'s new in PageProof ' + VERSION, 'Shown once after each update. Your captures, settings and lists carry over.')}
  <section class="card" style="overflow:hidden">${NEWS.map(([t, d]) => `<div class="row" style="padding:14px 18px;border-bottom:1px solid var(--line);flex-wrap:nowrap;gap:14px"><span class="newbadge" style="margin:0">New</span><span><b>${t}</b><br><span class="muted" style="font-size:14px">${d}</span></span></div>`).join('')}</section>
  <button class="btn primary" style="align-self:flex-start" data-act="newsseen">Got it</button>`;
V.help = async () => `${head('Help', 'Help and tutorial', 'Step-by-step guides for everything PageProof does.')}
  <div class="grid g2">
    <a class="start" href="https://github.com/TheBenPsych/PageProof/blob/main/TUTORIAL.md" target="_blank"><span class="ic">${ic('help', 22)}</span><b>Tutorial</b><span>Capture, find copies, inspect, compare, mark up and more, one step at a time.</span></a>
    <a class="start" href="https://github.com/TheBenPsych/PageProof/blob/main/VERIFYING.md" target="_blank"><span class="ic">${ic('verify', 22)}</span><b>Checking a pack</b><span>How anyone can check that an evidence pack was not changed.</span></a>
    <button class="start" data-act="tour" style="text-align:left;cursor:pointer;font:inherit"><span class="ic">${ic('home', 22)}</span><b>Take the tour</b><span>Five quick stops around this page.</span></button>
    <a class="start" href="#setup"><span class="ic">${ic('settings', 22)}</span><b>Run first-time setup again</b><span>Your name, the PageProof folder, a computer check, and keeping PageProof handy.</span></a>
  </div>`;

// =====================================================================================
// First-time setup (opens by itself after installing)
// =====================================================================================
const SETUP = [
  async () => `<div class="eyebrow" style="margin:0">Step 1 of 4</div><h2 style="font-size:24px">Welcome to PageProof</h2>
    <p class="muted" style="margin:0">Four quick steps. You can change everything later in Settings.</p>
    <label class="field" for="suName">Your name<input id="suName" placeholder="For example, Ben" value="${esc(await getName())}"></label>
    <p class="faint" style="margin:0;font-size:13px">It goes on every evidence pack and report as "Collected by".</p>`,
  async () => { const s = await RS_DOCS.state(); return `<div class="eyebrow" style="margin:0">Step 2 of 4</div><h2 style="font-size:24px">Where should PageProof keep its lists?</h2>
    <p class="muted" style="margin:0">Your hidden sites, copies found and settings are kept as small text files in Documents › PageProof, so they survive updates and reinstalls.</p>
    ${s === 'granted' ? `<span class="tag ok" style="align-self:flex-start">${ic('check', 13, 3)} Folder ready</span>${(state.backup = await FC.readBackup()) ? `<div class="banner info" style="padding:10px 12px"><span style="flex:1;font-size:14px"><b>Found your PageProof settings from ${fmtDate(state.backup.saved)}</b><br><span class="muted">Your name, clients, flags, hidden countries and copies found. Bring them back?</span></span><button class="btn primary" data-act="surestore">Bring them back</button></div>` : ''}` : s === 'prompt' ? `<button class="btn primary" style="align-self:flex-start" data-act="docsallow">Allow PageProof to use it</button>` : `<button class="btn primary" style="align-self:flex-start" data-act="docschoose">Pick Documents</button><span class="faint" style="font-size:13px">In the window that opens, click Documents, then Select Folder. If Chrome says it can't use Documents, make a new folder called PageProof inside it and pick that.</span>`}`; },
  async () => { const h = await ppHardware(), L = h.limits; return `<div class="eyebrow" style="margin:0">Step 3 of 4</div><h2 style="font-size:24px">Checking your computer</h2><p class="muted" style="margin:0">So PageProof never slows it down. Nothing to do here.</p>
    <div class="ofacts"><div class="ofact"><span>Processor</span><b>${h.cores} cores</b></div><div class="ofact"><span>Memory</span><b>${h.memGB} GB</b></div><div class="ofact"><span>System</span><b>${esc(h.system)}</b></div></div>
    <div class="banner info" style="padding:10px 12px"><span class="tag ${h.level === 'Light' ? 'warn' : 'ok'}">${h.level}</span><span style="flex:1;font-size:14px">Up to <b>${L.checks}</b> photo ${L.checks > 1 ? 'checks' : 'check'} and <b>${L.tabs}</b> search ${L.tabs > 1 ? 'tabs' : 'tab'} at once. It pauses by itself when the computer is busy.</span></div>`; },
  async () => `<div style="text-align:center;display:flex;flex-direction:column;gap:10px;align-items:center"><span class="tag ok" style="font-size:14px;padding:4px 12px">✓ You're set</span><h2 style="font-size:24px">Two things to keep it handy</h2></div>
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px">
      <div class="card pad" style="display:flex;flex-direction:column;gap:6px"><b>1. Pin the icon</b><span class="muted" style="font-size:14px">Click the jigsaw piece next to the address bar, then the pin beside PageProof.</span></div>
      <div class="card pad" style="display:flex;flex-direction:column;gap:6px"><b>2. Open the side panel</b><span class="muted" style="font-size:14px">Click the PageProof icon, then "Keep it open beside this page".</span></div>
    </div>`
];
V.setup = async () => `${head('Welcome', 'First-time setup', '')}
  <div class="desk"><section class="card pad wiz" style="display:flex;flex-direction:column;gap:14px;padding:28px">
    <div class="wdots" aria-hidden="true">${SETUP.map((_, i) => `<i class="${i <= state.setup ? 'on' : ''}"></i>`).join('')}</div>
    ${await SETUP[state.setup]()}
    <div class="row" style="gap:8px;margin-top:6px">${state.setup > 0 ? '<button class="btn" data-act="setup" data-v="-1">Back</button>' : ''}<button class="btn primary" style="margin-left:auto" data-act="setup" data-v="${state.setup < SETUP.length - 1 ? '1' : 'done'}">${state.setup === 0 ? 'Start' : state.setup < SETUP.length - 1 ? 'Next' : 'Open PageProof'}</button></div>
  </section></div>`;

// =====================================================================================
// The tour
// =====================================================================================
const TOUR = [
  ['capture', 'Capture a page', 'Saves the page you are on as proof: PDF, web copy, fingerprints and timestamps. Also the big button in the toolbar menu.'],
  ['found', 'Copies found', 'Everything PageProof has found for your clients, from the daily 50 and Keep searching. The number shows new ones.'],
  ['library', 'Evidence library', 'Every capture and evidence report, with case numbers, and the weekly summary.'],
  ['browser', 'Keep it beside every page', 'Open the side panel and PageProof stays next to every website, showing the search as it runs.'],
  ['settings', 'Settings', 'Your name, the PageProof folder, hidden sites and your computer\'s limits.'],
];
function drawTour() {
  document.querySelectorAll('.tourring,.tourtip').forEach(x => x.remove());
  if (state.tour < 0) return;
  const [href, t, d] = TOUR[state.tour];
  const el = document.querySelector(`#side a[href="#${href}"]`);
  const r = el && el.offsetParent !== null ? el.getBoundingClientRect() : null;
  const ring = document.createElement('div'); ring.className = 'tourring';
  if (r && r.width) ring.style.cssText = `left:${r.left - 6}px;top:${r.top - 6}px;width:${r.width + 12}px;height:${r.height + 12}px`;
  else ring.style.cssText = 'left:50%;top:40%;width:0;height:0';
  const tip = document.createElement('div'); tip.className = 'tourtip'; tip.setAttribute('role', 'dialog'); tip.setAttribute('aria-label', 'Tour');
  tip.innerHTML = `<span class="faint" style="font-size:12px">${state.tour + 1} of ${TOUR.length}</span><b style="font-size:16px">${t}</b><span class="muted" style="font-size:14px">${d}</span>
    <div class="row" style="gap:6px;margin-top:4px"><button class="btn ghost" data-act="tourend" style="min-height:34px">Skip</button>${state.tour > 0 ? '<button class="btn" data-act="tourback" style="min-height:34px;margin-left:auto">Back</button>' : ''}<button class="btn primary" data-act="tournext" style="min-height:34px;${state.tour > 0 ? '' : 'margin-left:auto'}">${state.tour < TOUR.length - 1 ? 'Next' : 'Done'}</button></div>`;
  document.body.append(ring, tip);
  const W = tip.offsetWidth, H = tip.offsetHeight;
  let x, y;
  if (r && r.width) { x = r.right + 18; y = r.top; if (x + W > innerWidth - 12) { x = Math.max(12, Math.min(r.left, innerWidth - W - 12)); y = r.bottom + 14; } if (y + H > innerHeight - 12) y = Math.max(12, r.top - H - 14); }
  else { x = (innerWidth - W) / 2; y = (innerHeight - H) / 2; }
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
  if (innerWidth < 900) document.getElementById('side').classList.add('open');
}

// =====================================================================================
// Buttons
// =====================================================================================
async function openCapture(id) {
  const rec = await PP_DB.get(id).catch(() => null);
  if (!rec) return toast('This capture is no longer in the browser. Look for its evidence pack in your Downloads.');
  api.tabs.create({ url: api.runtime.getURL('viewer.html?id=' + encodeURIComponent(id)) });
}
async function act(a, v, el) {
  if (a === 'tour') { state.tour = 0; if (route() !== 'home') location.hash = 'home'; else drawTour(); }
  else if (a === 'tournext') { state.tour = state.tour < TOUR.length - 1 ? state.tour + 1 : -1; drawTour(); if (state.tour < 0) { api.storage.local.set({ ppTourDone: true }); document.getElementById('side').classList.remove('open'); } }
  else if (a === 'tourback') { state.tour = Math.max(0, state.tour - 1); drawTour(); }
  else if (a === 'tourend') { state.tour = -1; drawTour(); api.storage.local.set({ ppTourDone: true }); document.getElementById('side').classList.remove('open'); }
  else if (a === 'opencap') openCapture(v);
  else if (a === 'capturelast') {
    const t = await lastWebTab();
    if (!t) return toast('Open the web page you want in another tab first.');
    await api.tabs.update(t.id, { active: true });
    api.runtime.sendMessage({ type: 'captureTab', tabId: t.id });
  }
  else if (a === 'libcsv') libCsv();
  else if (a === 'sidepanel') {
    try { const w = await api.windows.getCurrent(); await api.sidePanel.open({ windowId: w.id }); } catch (e) { toast('Your browser has no side panel. Use Chrome or Edge.'); }
  }
  else if (a === 'shortcuts') api.tabs.create({ url: /Edg\//.test(navigator.userAgent) ? 'edge://extensions/shortcuts' : 'chrome://extensions/shortcuts' });
  else if (a === 'docschoose') { try { await RS_DOCS.choose(); await RS_LISTS.load(); await RS_LISTS.save(); toast('PageProof folder ready'); } catch (e) { if (e.name === 'PhotosFolder') toast(e.message); else if (e.name !== 'AbortError') toast('Chrome refused that folder. Make a new folder called PageProof inside Documents and pick that.'); } render(true); }
  else if (a === 'docsallow') { await RS_DOCS.allow(); render(true); }
  else if (a === 'hidtab') { state.hidTab = v; state.hidQ = ''; state.hidMore = 0; render(true); }
  else if (a === 'hidkind') { state.hidKind = v; render(true); }
  else if (a === 'hidmore') { state.hidMore = (state.hidMore || 100) + 200; render(true); }
  else if (a === 'hidadd') {
    const kind = state.hidTab;
    const s = RS_SITE.tidy(state.hidQ);
    if (!s) return toast('Type a site like patch.com, x.com/nypost or .gov');
    await RS_LISTS.load(); await RS_LISTS.add(kind, s);
    state.hidQ = '';
    toast(s + (kind === 'hidden' ? ' hidden' : ' approved for every client'), async () => { await RS_LISTS.load(); await RS_LISTS.remove(kind, s); render(true); });
    render(true);
  }
  else if (a === 'hidremove') {
    await RS_LISTS.load();
    if (state.hidTab === 'client') {
      const [site, who] = v.split(' | ');
      await FC.licenseSite(who, site, false);
      toast(site + ' is no longer approved for ' + who, async () => { await FC.licenseSite(who, site, true); render(true); });
    } else if (state.hidTab === 'rejected') {
      const r = RS_REJECT.items.find(x => x.url === v);
      RS_REJECT.items = RS_REJECT.items.filter(x => x !== r); await RS_REJECT.save();
      toast('Brought back', async () => { await RS_LISTS.load(); RS_REJECT.items.push(r); await RS_REJECT.save(); render(true); });
    } else {
      const kind = state.hidTab;
      await RS_LISTS.remove(kind, v);
      toast(kind === 'hidden' ? v + ' shows again' : v + ' is no longer approved', async () => { await RS_LISTS.load(); await RS_LISTS.add(kind, v); render(true); });
    }
    render(true);
  }
  else if (a === 'hidsave') {
    await RS_LISTS.load();
    const kind = state.hidTab === 'allowed' ? 'allowed' : 'hidden';
    const a2 = document.createElement('a');
    a2.href = URL.createObjectURL(new Blob([RS_LISTS.text(kind)], { type: 'text/plain' }));
    a2.download = RS_LISTS.FILES[kind]; a2.click();
  }
  else if (a === 'hidload') document.getElementById('hidLoad').click();
  else if (a === 'surestore') {
    if (!state.backup) return;
    await FC.restore(state.backup); state.backup = null;
    toast('Your settings are back. Connect your photos again in Clients and photos to pick up where you left off.');
    render(true);
  }
  else if (a === 'rcdone') { await api.storage.local.set({ ppReconnectVer: VERSION }); state.rc = null; location.hash = 'home'; }
  else if (a === 'newsseen') { await api.storage.local.set({ ppSeenVersion: VERSION }); location.hash = 'home'; }
  else if (a === 'setup') {
    const n = document.getElementById('suName');
    if (n) await setName(n.value.trim());
    if (v === 'done') { await api.storage.local.set({ ppSetupDone: true, ppSeenVersion: VERSION, ppReconnectVer: VERSION }); state.setup = 0; location.hash = 'home'; if (!(await api.storage.local.get('ppTourDone')).ppTourDone) setTimeout(() => act('tour'), 300); return; }
    state.setup = Math.max(0, Math.min(SETUP.length - 1, state.setup + Number(v)));
    render(true);
  }
  else if (ACTS[a]) await ACTS[a](v, el);
}
const ON_CHANGE = el => el.tagName === 'SELECT' || (el.tagName === 'INPUT' && !/^(checkbox|radio|button|submit)$/.test(el.type));
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || ON_CHANGE(b)) return;
  if (b.dataset.act === 'openlink') return;      // a plain link inside a row you can click: just open it
  if (b.tagName === 'A') e.preventDefault();
  act(b.dataset.act, b.dataset.v, b);
});

// Lists, times and typed boxes act when they change, not when clicked.
document.addEventListener('change', e => {
  const b = e.target;
  if (b && b.dataset && b.dataset.act && ON_CHANGE(b)) act(b.dataset.act, b.dataset.v, b);
});

// Start once every page file has loaded.
document.addEventListener('DOMContentLoaded', async () => {
  await ppTheme();
  // Never let a slow folder keep the page blank: draw after 3 seconds at most, and again once the lists are in.
  let listsIn = false;
  const lists = RS_LISTS.load().catch(() => {}).then(() => { listsIn = true; });
  await Promise.race([lists, new Promise(r => setTimeout(r, 3000))]);
  if (!listsIn) lists.then(() => render(true));
  const st = await api.storage.local.get(['ppSetupDone', 'ppReconnectVer', 'fcDrive']);
  if (!st.ppSetupDone && (!location.hash || location.hash === '#home')) location.hash = 'setup';
  // First time the full page opens after an update: check the folders before anything else.
  else if (st.ppSetupDone && st.ppReconnectVer !== VERSION && st.fcDrive && st.fcDrive.done && !/^#(setup|reconnect)/.test(location.hash)) location.hash = 'reconnect';
  render();
  // One time after an update: preview pictures move to their own small database.
  // 4.1 kept a link to PageProof's own folder for the old self-updater. That is gone; forget the folder.
  try { RS_DB.del('handles', 'ppInstall').catch(() => {}); api.storage.local.remove('ppUpdated'); } catch (e) { /* none */ }
  FC.movePics().catch(e => console.warn('PageProof: moving preview pictures', e));
  FC.dropDotMatches().then(n => { if (n) { toast(plural(n, 'wrong match was', 'wrong matches were') + ' moved to Removed (the photo check had scored them too high). Put back is still there.'); render(true); } }).catch(e => console.warn('PageProof: wrong matches', e));
});
