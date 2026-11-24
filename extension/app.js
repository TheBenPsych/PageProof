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
    // Keep at most 4 open; drop the oldest that isn't busy (a search still running is never dropped).
    const busy = fr => { try { return !!(fr.contentWindow && fr.contentWindow.ppBusy && fr.contentWindow.ppBusy()); } catch (e) { return false; } };
    while (LIVE.size > 4) {
      const old = [...LIVE.entries()].find(([k, fr]) => k !== id && !busy(fr));
      if (!old) break;
      old[1].remove(); LIVE.delete(old[0]);
    }
  }
  for (const [k, f] of LIVE) f.hidden = k !== id;
  box.style.display = id ? '' : 'none'; view.style.display = id ? 'none' : '';
}

// Only the newest redraw is put on screen. Drawing a page can take a moment (reading thousands of
// copies), so a redraw that started earlier, for example one from Keep searching, could finish
// after the one that follows a click and put old rows back (4.9.1). An older one now waits for the
// newest instead.
let RENDER_N = 0, RENDER_P = null;
function render(keep) { const me = ++RENDER_N; const p = render1(keep, me); RENDER_P = p; return p; }
async function render1(keep, me) {
  const old = () => me !== RENDER_N;
  let r = route();
  if (!V[r] && !FRAMES[r]) r = 'home';
  ppRenderSide(r);
  document.getElementById('crumb').innerHTML = `<b>PageProof</b> › ${PP_CRUMBS[r] || ''}`;
  document.body.classList.toggle('framed', !!FRAMES[r]);
  if (V[r] && V[r].guard) { const g = await V[r].guard(); if (g) r = g; }
  if (old()) return RENDER_P;
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
    if (old()) return RENDER_P;
    view.innerHTML = html;
    if (typeof ppLoadPics === 'function') ppLoadPics(view);
    if (keep) {
      window.scrollTo(0, sy);
      if (main) main.scrollTop = my;
      view.querySelectorAll(SCROLLERS).forEach((e, i) => { if (inner[i]) { e.scrollTop = inner[i][0]; e.scrollLeft = inner[i][1]; } });
    }
    ppAddHelp(view); ppTidyHead(view);
    if (V[r].after) V[r].after();
  }
  document.getElementById('side').classList.remove('open');
  if (!keep) window.scrollTo(0, 0);
  if (state.tour >= 0) drawTour();
  if (typeof ppTopBar === 'function') ppTopBar();
  ppBadges();
}
window.addEventListener('hashchange', () => render());
const ppDaysSince = iso => { const t = Date.parse(iso || ''); return isNaN(t) ? 0 : Math.max(0, Math.floor((Date.now() - t) / 86400000)); };
// The number of new copies next to Find copies in the menu.
async function ppBadges() {
  try {
    const n = await FC.countNew();
    let t = 0, loud = ''; try { const up = (await needsCapture()).up; t = up.length; const d = up.length ? ppDaysSince(up[0].answered || up[0].firstSeen) : 0; if (d >= 7) loud = `A stolen copy has waited ${d} days for a capture`; } catch (e) { /* none */ }
    if (PP_BADGES.newCopies !== n || PP_BADGES.toCapture !== t || PP_BADGES.toCaptureUrgent !== loud) { PP_BADGES.newCopies = n || 0; PP_BADGES.toCapture = t; PP_BADGES.toCaptureUrgent = loud; ppRenderSide(PP_ROUTES[route()] ? route() : 'home'); }
  } catch (e) { /* no copies yet */ }
}
// Another PageProof page (the search window, Keep searching) changed something: redraw.
let redrawT = null;
// Keep searching writes a heartbeat every 30 seconds. Only what you can see counts as a change.
const statusLook = s => (s ? [s.state, s.text, s.current && s.current.id].join('|') : '');
api.storage.onChanged.addListener(ch => {
  if (ch.fcEngines && ['home', 'health'].includes(state.shown)) { clearTimeout(redrawT); redrawT = setTimeout(() => render(true), 600); return; }
  if (!ch.fcChanged && !ch.fcStatus) return;
  if (!ch.fcChanged && statusLook(ch.fcStatus.oldValue) === statusLook(ch.fcStatus.newValue)) return;
  if (ch.fcStatus && !['keep', 'home'].includes(state.shown)) return;
  // Don't redraw under someone typing. A ticked checkbox or a pressed button keeps focus too, but
  // must not stop the page from showing what changed (4.6.1).
  const fe = document.activeElement;
  if (fe && (fe.tagName === 'TEXTAREA' || fe.tagName === 'SELECT' || (fe.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|range|color|file)$/i.test(fe.type)))) return;
  if (document.querySelector('dialog[open]')) return;
  clearTimeout(redrawT);
  // state.shown, not route(): a guard can show another page (setup) under this address (see 4.0.10).
  redrawT = setTimeout(() => { const s = state.shown || route(); if (!FRAMES[route()] && V[s] && !V[s].noAutoRedraw) render(true); }, ch.fcStatus ? 400 : 1500);
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
  const [name, seen] = [await getName(), (await api.storage.local.get('ppSeenVersion')).ppSeenVersion];
  const hr = new Date().getHours(), hello = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const fc = await homeFinds();
  const news = seen !== VERSION ? `<div class="banner info">${ic('ideas', 20)}<div style="flex:1 1 260px;min-width:0"><b>PageProof was updated to ${VERSION}</b> <span class="muted" style="font-size:13.5px">All your captures, settings and lists are still here.</span></div><a class="btn" href="#whatsnew">See what's new</a></div>` : '';
  const todo = fc.jobs.filter(j => j.lvl !== 'ok');
  // 4.40: only the most urgent job keeps a solid blue button; the rest are plain.
  let mainUsed = false;
  for (const j of fc.jobs) if (j.btn && j.btn.main) { if (mainUsed) j.btn = { ...j.btn, main: 0 }; mainUsed = true; }
  return `${news}
  ${head(today, hello + (name ? ', ' + esc(name.split(' ')[0]) : ''), todo.length ? 'Here is what needs you, most urgent first.' : 'Nothing needs you right now. Searching carries on by itself.', `<button class="btn" data-act="tour">Take the tour</button>`)}
  ${homeTiles(fc.stats)}
  <section class="card jobs" id="homeJobs" aria-label="What to do now">
    <div class="pad row jobhead"><h2>What to do now</h2><span class="faint" style="margin-left:auto;font-size:13px">${todo.length ? todo.length + ' to do' : 'All done'}</span></div>
    ${fc.jobs.map(jobRow).join('')}
    ${todo.length ? '' : `<div class="job lvl-ok" id="allDone"><span class="jdot">${ic('check', 16, 3)}</span><div class="jt"><b>All done for today</b><span>New copies will show up here as Keep searching finds them.</span></div></div>`}
  </section>
  <section class="home3 quick" aria-label="Start something new">
    <a class="start" href="#capture"><span class="ic">${ic('capture', 18)}</span><span class="qt"><b>Capture a page</b><span>PDF, web copy, fingerprints, timestamps</span></span><span class="go" aria-hidden="true">›</span></a>
    <a class="start" href="#search"><span class="ic">${ic('find', 18)}</span><span class="qt"><b>Find copies of a photo</b><span>Google Lens, Yandex and Bing</span></span><span class="go" aria-hidden="true">›</span></a>
    <a class="start" href="#tools"><span class="ic">${ic('tools', 18)}</span><span class="qt"><b>Look closer at a photo</b><span>Hidden data, compare, mark up</span></span><span class="go" aria-hidden="true">›</span></a>
  </section>
  ${fc.more ? `<div class="home3 homemore">${fc.more}</div>` : ''}`;
};
// 4.40: four number tiles at the top of Home. Each one is a click to the matching list.
function homeTiles(s) {
  if (!s) return '';
  const F = s.first || {}, pct = F.total ? Math.floor(F.done / F.total * 100) : null;
  const ring = `<svg class="ring" width="52" height="52" viewBox="0 0 54 54" aria-hidden="true"><circle cx="27" cy="27" r="22" fill="none" stroke="var(--sunk)" stroke-width="7"/><circle cx="27" cy="27" r="22" fill="none" stroke="var(--accent)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(138.2 * (pct || 0) / 100).toFixed(1)} 138.2" transform="rotate(-90 27 27)"/></svg>`;
  const t = (href, icon, label, n, sub, extra = '') => `<a class="card htile" href="${href}"><span class="hl">${ic(icon, 14)}${label}</span><span class="hn num">${n}</span><span class="hs">${sub}</span>${extra}</a>`;
  return `<section class="htiles" id="homeTiles" aria-label="Today in numbers">
    ${t('#found', 'copies', 'New copies to answer', s.nNew.toLocaleString(), s.newToday ? `<b class="up">+${s.newToday.toLocaleString()}</b> in the last day` : 'none in the last day')}
    ${t('#tocapture', 'capture', 'Stolen, need a capture', s.caps.toLocaleString(), s.caps ? (s.oldest ? `Oldest waited ${s.oldest} ${s.oldest === 1 ? 'day' : 'days'}` : 'Marked today') : 'All captured')}
    ${t('#keep', 'find', 'Photos searched today', s.searched.toLocaleString(), s.found ? `${s.found} new ${s.found === 1 ? 'copy' : 'copies'} found` : 'no new copies yet')}
    <a class="card htile hring" href="#keep?clients=1" id="homeFirstTile"><span><span class="hl">Every photo searched once</span><span class="hn num">${pct == null ? '…' : pct + '%'}</span><span class="hs">${F.total ? F.done.toLocaleString() + ' of ' + F.total.toLocaleString() : 'Counting your photos'}</span></span>${ring}</a>
  </section>`;
}
// One line of Home's "What to do now" list: a coloured dot, what it is, and one button.
function jobRow(j) {
  const b = j.btn ? (j.btn.href ? `<a class="btn${j.btn.main ? ' primary' : ''}" href="${j.btn.href}"${j.btn.act ? ` data-act="${j.btn.act}"` : ''}>${j.btn.label}</a>` : `<button class="btn${j.btn.main ? ' primary' : ''}" data-act="${j.btn.act}"${j.btn.v != null ? ` data-v="${esc(j.btn.v)}"` : ''}>${j.btn.label}</button>`) : '';
  const b2 = j.btn2 ? `<button class="btn ghost" data-act="${j.btn2.act}">${j.btn2.label}</button>` : '';
  return `<div class="job lvl-${j.lvl}"${j.id ? ` id="${j.id}"` : ''}${j.lvl === 'bad' ? ' role="alert"' : ''}><span class="jdot">${ic(j.icon || (j.lvl === 'ok' ? 'check' : 'warn'), 16, j.lvl === 'ok' ? 3 : 2)}</span><div class="jt"><b>${j.title}</b>${j.sub ? `<span>${j.sub}</span>` : ''}</div><div class="jb">${b}${b2}</div></div>`;
}
// Home's jobs (most urgent first) and the small cards under them: Keep searching, every photo
// searched once, most copied photos.
async function homeFinds() {
  const jobs = [];
  const caps = await needsCapture().catch(() => ({ up: [] }));
  const d = await FC.drive();
  if (!d.done) {
    jobs.push({ lvl: 'warn', icon: 'find', title: 'Connect your clients\' photos', sub: 'One-time setup so PageProof can search the shared Google Drive all day.', btn: { href: '#connect', label: 'Connect them', main: 1 } });
    if (caps.up.length) jobs.push(capJob(caps.up));
    return { jobs, more: '' };
  }
  const [copies, st, k, store] = [await FC.allCopies(), (await api.storage.local.get('fcStatus')).fcStatus, await FC.keep(), await api.storage.local.get(['fcToday', 'fcDriveBack', 'fcDriveOffline', 'fcPause', 'fcFirst', 'fcFirstSeen'])];
  const hw = await ppHardware();
  const vis = copies.filter(c => !FC.hiddenCopy(c, RS_LISTS.hidden));
  const nNew = vis.filter(c => c.status === 'new').length;
  const by = {};
  for (const c of vis) if (c.status === 'new') by[c.client || 'Client unknown'] = (by[c.client || 'Client unknown'] || 0) + 1;
  const top = Object.entries(by).sort((a, b) => b[1] - a[1]);
  const today = store.fcToday && store.fcToday.day === new Date().toDateString() ? store.fcToday : { searched: 0, found: 0 };
  const alive = st && Date.now() - st.beat < 90000;
  const ds = await FC.driveState(false);
  // 1. things that are stopped
  if (store.fcDriveOffline) jobs.push({ lvl: 'bad', title: 'Can\'t reach Google Drive, so searching is paused', sub: 'Drive for desktop is signed out or not running. Searching picks up where it left off.', btn: { href: '#keep', label: 'Keep searching', main: 1 } });
  else if (ds === 'prompt') jobs.push({ lvl: 'warn', title: 'One click needed: let PageProof read your photos again', sub: 'Your browser asks once after it restarts.', btn: { act: 'driveallow', label: 'Allow', main: 1 } });
  if (k.on && !store.fcPause && st && st.state === 'closed') jobs.push({ lvl: 'bad', title: 'Keep searching is stopped', sub: 'Its pinned PageProof tab was closed, so no new photos are being searched.', btn: { act: 'keepshow', label: 'Start it again', main: 1 } });
  // How PageProof is doing: something changed a lot compared with this computer's usual numbers.
  try {
    const al = typeof PP_REPORT !== 'undefined' ? (await PP_REPORT.model('7', { light: true })).alerts : [];
    if (al.length) jobs.push({ lvl: al.some(a => a[0] === 'bad') ? 'bad' : 'warn', title: al.length === 1 ? al[0][1] : al.length + ' things look off in PageProof\'s stats', sub: al.length === 1 ? al[0][2] : al.map(a => a[1]).slice(0, 3).join('. ') + '.', btn: { href: '#stats', label: 'See the stats' } });
  } catch (e) { /* stats are only a help */ }
  for (const [e, until] of Object.entries(await FC.brokenEngines())) jobs.push({ lvl: 'bad', title: `${FC.ENGINE_NAME[e]} may have stopped working`, sub: `It gave nothing for many photos in a row, so it rests until ${new Date(until).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}. The other search sites carry on.`, btn: { href: '#health', label: 'See details' } });
  // 4.15: the searching tab came back by itself, and the computer clock check.
  const reo = (await api.storage.local.get('fcReopened')).fcReopened;
  if (reo && reo.at && !reo.seen && Date.now() - reo.at < 3 * 3600000) jobs.push({ lvl: 'info', id: 'keepReopened', icon: 'check', title: 'The searching tab was closed, so PageProof opened it again', sub: `It's the small pinned tab at the far left, and it carried on where it was at ${new Date(reo.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}. Nothing was lost.`, btn: { act: 'reopenok', label: 'OK' }, btn2: { act: 'reopenpause', label: 'Pause searching' } });
  const clk = (await api.storage.local.get('ppClockOff')).ppClockOff;
  if (clk && Math.abs(clk.off) > 120 && Date.now() - clk.at < 14 * 86400000) jobs.push({ lvl: 'bad', title: `This computer's clock is ${Math.round(Math.abs(clk.off) / 60)} minutes ${clk.off > 0 ? 'fast' : 'slow'}`, sub: 'Times written in your evidence won\'t match the trusted timestamp. Fix: Windows Settings › Time &amp; language › Date &amp; time › turn on "Set time automatically" and press "Sync now".', btn: { href: '#health', label: 'Details' } });
  // 2. copies that need you
  if (caps.up.length) jobs.push(capJob(caps.up));
  if (nNew) jobs.push({ lvl: 'warn', icon: 'copies', id: 'jobNew', title: `${nNew.toLocaleString()} new ${nNew === 1 ? 'copy' : 'copies'} to answer`,
    sub: top.slice(0, 4).map(([n, v]) => `<a href="#found?client=${encodeURIComponent(n)}">${esc(n)} ${v}</a>`).join(' · ') + (top.length > 4 ? ` · ${top.length - 4} more clients` : ''),
    btn: { href: '#review', label: 'Start', main: 1 } });
  // 3. good news and updates
  const fin = (await FC.firstNotes()).filter(n => n.at > (store.fcFirstSeen || '') && Date.now() - Date.parse(n.at) < 14 * 86400000);
  if (fin.length) jobs.push({ lvl: 'info', id: 'firstDone', icon: 'check', title: fin.length === 1 ? esc(fin[0].name) + ': every photo searched at least once' : fin.length + ' clients now have every photo searched at least once',
    sub: esc(fin.map(n => n.name + ' (' + n.n.toLocaleString() + ' photos)').slice(0, 4).join(', ')) + (fin.length > 4 ? ' and more' : '') + '. New photos still get their first search when they arrive.', btn: { href: '#keep', label: 'See progress' }, btn2: { act: 'firstseen', label: 'OK' } });
  // 4. all is well: one quiet line saying searching is running
  if (k.on && !store.fcPause && alive) jobs.push({ lvl: 'ok', title: 'Keep searching is running', sub: esc(st.text || '') + ` · today ${today.searched} ${today.searched === 1 ? 'photo' : 'photos'} searched, ${today.found} new`, btn: { href: '#keep', label: 'Open' } });
  else if (!k.on) jobs.push({ lvl: 'warn', title: 'Keep searching is off', sub: 'Turn it on to search your clients\' photos all day.', btn: { href: '#keep', label: 'Turn it on' } });
  // The small cards under the jobs.
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
  // 4.40: new copies by client, so the bottom row of Home is always three cards.
  let byHtml = '';
  if (top.length) {
    const mx = top[0][1];
    byHtml = `<section class="card pad" id="homeByClient" style="display:flex;flex-direction:column;gap:8px"><div class="row"><h2>New copies by client</h2><a class="faint" href="#found" style="margin-left:auto;font-size:13px">See all</a></div>
      ${top.slice(0, 5).map(([n, v]) => `<a class="byrow" href="#found?client=${encodeURIComponent(n)}"><span>${esc(n)}</span><span class="bar"><i style="width:${v / mx * 100}%"></i></span><b class="num">${v}</b></a>`).join('')}</section>`;
  }
  const dayAgo = Date.now() - 86400000;
  const stats = { nNew, newToday: vis.filter(c => c.status === 'new' && Date.parse(c.firstSeen || '') > dayAgo).length, caps: caps.up.length, oldest: caps.up.length ? ppDaysSince(caps.up[0].answered || caps.up[0].firstSeen) : 0, searched: today.searched || 0, found: today.found || 0, first: store.fcFirst };
  return { jobs, stats, more: homeFirst(store.fcFirst, k, hw) + mostHtml + byHtml };
}
function capJob(up) {
  return { lvl: 'warn', icon: 'capture', id: 'jobCapture', title: `${up.length} stolen ${up.length === 1 ? 'copy needs' : 'copies need'} a capture`, sub: 'Capture them before the site takes them down. Oldest first: ' + esc([...new Set(up.map(c => c.site))].slice(0, 3).join(', ')), btn: { href: '#tocapture', label: 'Capture them', main: 1 } };
}
// Home card: every photo searched once. Uses the small copy saved by the last count, so Home
// never reads every photo; a count older than an hour is redone after Home has drawn.
function homeFirst(F, k, hw) {
  if (!F || !F.total) return `<section class="card pad firsthome" id="homeFirst" style="display:flex;flex-direction:column;gap:8px"><h2>Every photo searched once</h2><span class="muted" style="font-size:14px">Counting your photos…</span></section>`;
  const pct = Math.floor(F.done / F.total * 100);
  let by = '';
  try { by = firstDoneBy(F.never, firstPerDay(k, hw, F.week)) || ''; } catch (e) { /* no date */ }
  return `<section class="card pad firsthome" id="homeFirst" style="display:flex;flex-direction:column;gap:8px">
    <div class="row"><h2>Every photo searched once</h2><span class="faint num" style="margin-left:auto;font-size:13px">${pct}%</span></div>
    <span class="bar${F.never ? '' : ' okbar'}"><i style="width:${F.done / F.total * 100}%"></i></span>
    <span class="muted num" style="font-size:13.5px">${F.done.toLocaleString()} of ${F.total.toLocaleString()} · ${F.never ? F.never.toLocaleString() + ' to go' + (by && by !== 'Done' ? ' · done ' + esc(by) : '') : 'all done, new photos join by themselves'}</span>
    <a class="btn" href="#keep?clients=1">See by client</a></section>`;
}
V.home.after = async () => {
  try {
    const F = (await api.storage.local.get('fcFirst')).fcFirst;
    if ((await FC.drive()).done && (!F || Date.now() - F.at > 3600000)) {
      await FC.coverage();
      const n = (await api.storage.local.get('fcFirst')).fcFirst, el = document.getElementById('homeFirst');
      if (el && n && state.shown === 'home') el.outerHTML = homeFirst(n, await FC.keep(), await ppHardware());
      const tl = document.getElementById('homeFirstTile');
      if (tl && n && n.total && state.shown === 'home') { const p = Math.floor(n.done / n.total * 100); tl.querySelector('.hn').textContent = p + '%'; tl.querySelector('.hs').textContent = n.done.toLocaleString() + ' of ' + n.total.toLocaleString(); const c = tl.querySelectorAll('circle')[1]; if (c) c.setAttribute('stroke-dasharray', (138.2 * p / 100).toFixed(1) + ' 138.2'); }
    }
  } catch (e) { /* counted next time */ }
  try { const c = (await api.commands.getAll()).find(x => x.name === 'capture-page'); if (c && c.shortcut) document.getElementById('shortcut').textContent = c.shortcut; } catch (e) { /* none */ }
};

// =====================================================================================
// Capture a page
// =====================================================================================
V.capture = async () => {
  const log = await getLog();
  const caps = [...log].reverse().slice(0, 12);
  const t = await lastWebTab();
  const step = (n, icon, t, d) => `<div class="cstep"><span class="ci">${ic(icon, 20)}</span><b><em>${n}</em> ${t}</b><span>${d}</span></div>`;
  const capCard = e => {
    const sv = e.saves && e.saves.length ? e.saves[e.saves.length - 1] : null, ts = sv && (sv.timestamps || sv.timestamp);
    return `<button class="capcard lc" data-act="opencap" data-v="${esc(e.id)}" title="${esc(e.url)}">
      <span class="capimg" data-capthumb="${esc(e.id)}"><b>${esc((site(e.url)[0] || '?').toUpperCase())}</b></span>
      <span class="capt"><b class="capsite">${esc(site(e.url))}</b><span class="faint">${fmtDate(e.time)}</span></span>
      <span class="lcok">${sv ? `<span class="okline">${ic('check', 12, 3)} Pack saved</span>${ts ? `<span class="okline">${ic('check', 12, 3)} Timestamped</span>` : ''}` : '<span class="tag warn">Pack not saved</span>'}</span></button>`;
  };
  return `${head('Collect evidence', 'Capture a page', 'PageProof saves the whole web page from top to bottom as a PDF and a web copy, with fingerprints and three trusted timestamps.')}
  <section class="card pad caphero">
    ${t ? `<span class="sitebig" style="background:${avColor(site(t.url))}" aria-hidden="true">${esc((site(t.url).replace(/^www\./, '')[0] || '?').toUpperCase())}</span>
      <div class="ct"><span class="faint" style="font-size:12.5px">Your last tab</span><b>${esc(t.title || site(t.url))}</b><span class="faint mono" style="font-size:12.5px">${esc(site(t.url))}</span></div>
      <button class="btn go big" data-act="capturelast">${ic('capture', 20)} Capture this page</button>`
    : `<span class="sitebig" style="background:var(--faint)" aria-hidden="true">?</span><div class="ct"><b>Open the web page you want in another tab first</b><span class="faint" style="font-size:13px">Then come back here, or click the PageProof icon on that page.</span></div>`}
  </section>
  <div class="csteps">
    ${step(1, 'globe', 'Open the page', 'Let it finish loading.')}
    ${step(2, 'capture', 'Press Capture', 'Here, on the PageProof icon, or Alt+Shift+P.')}
    ${step(3, 'pause', 'Hands off', 'Don\'t scroll while it works. A box shows each step.')}
    ${step(4, 'down', 'Save the pack', 'Type the case number and press Save evidence pack.')}
  </div>
  <section class="card" style="min-width:0;overflow:hidden">
    <div class="pad row" style="border-bottom:1px solid var(--line)"><h2>Your last captures</h2><a class="btn ghost" style="margin-left:auto" href="#library">All evidence</a></div>
    ${caps.length ? `<div class="capgrid lcgrid">${caps.map(capCard).join('')}</div>` : '<div class="pad muted">No captures yet. They show here after your first one.</div>'}
  </section>`;
};
V.capture.after = () => capThumbs();

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
// 4.14: the library shows a small picture of every capture (cards), or the old table (list).
V.library = async () => {
  const log = await getLog(), rows = libRows(log);
  const q = (state.libQ || '').toLowerCase();
  const view = state.libView || (await api.storage.local.get('ppLibView')).ppLibView || 'cards';
  const hit = (e, s) => !q || [e.url, e.title, s.caseRef, s.collector, e.captureId].join(' ').toLowerCase().includes(q);
  const shown = rows.filter(({ e, s }) => hit(e, s));
  const caps = [...log].reverse().filter(e => (e.saves && e.saves.length ? e.saves : [{}]).some(s => hit(e, s)));
  const reps = ((await api.storage.local.get('fcReports')).fcReports || []).slice().reverse().filter(r => !q || [r.site, r.url, r.caseNo, r.photo, r.client, r.id].join(' ').toLowerCase().includes(q));
  const nCap = (await needsCapture().catch(() => ({ up: [] }))).up.length;
  const card = e => {
    const sv = e.saves && e.saves.length ? e.saves[e.saves.length - 1] : null;
    return `<button class="capcard" data-act="opencap" data-v="${esc(e.id)}" title="${esc(e.url)}">
      <span class="capimg" data-capthumb="${esc(e.id)}"><b>${esc((site(e.url)[0] || '?').toUpperCase())}</b></span>
      <span class="capt"><b class="mono">${esc((sv && sv.caseRef) || 'No case number')}</b><span class="capsite">${esc(site(e.url))}</span><span class="faint">${fmtDate(e.time)}</span></span>
      ${sv ? `<span class="tag ok">${ic('check', 12, 3)} Pack saved</span>` : '<span class="tag grey">Not saved yet</span>'}</button>`;
  };
  return `${head('', 'Evidence library', 'Every page you captured on this computer, and every evidence pack saved from it.', `<button class="btn" data-act="libcsv">${ic('down', 18)} Download list (CSV)</button><a class="btn" href="#verify">${ic('verify', 18)} Verify a pack</a><a class="btn primary" href="#capture">${ic('capture', 18)} Capture a page</a>`)}
  ${nCap ? `<a class="banner warn" href="#tocapture" style="text-decoration:none;color:inherit">${ic('capture', 20)}<div style="flex:1 1 260px"><b>${nCap} stolen ${nCap === 1 ? 'copy needs' : 'copies need'} a capture</b><div style="font-size:13.5px">They have no evidence pack yet.</div></div><span class="btn">See them</span></a>` : ''}
  <section class="card" style="overflow:hidden">
    <div class="row" style="gap:10px;padding:12px 18px;border-bottom:1px solid var(--line);background:var(--bg)">
      <input id="libq" class="chip" style="min-height:38px;padding:0 12px;font-size:14px;flex:1 1 260px" placeholder="Find by case number, site, name or capture ID" value="${esc(state.libQ || '')}" aria-label="Find evidence">
      <span class="faint" style="font-size:13px">${view === 'cards' ? caps.length + ' of ' + log.length : shown.length + ' of ' + rows.length}</span>
      <div class="seg" role="group" aria-label="Show as"><button class="${view === 'cards' ? 'on' : ''}" data-act="libview" data-v="cards">Pictures</button><button class="${view === 'list' ? 'on' : ''}" data-act="libview" data-v="list">List</button></div></div>
    ${view === 'cards' ? `<div class="capgrid" id="capGrid">${caps.slice(0, 300).map(card).join('') || `<div class="muted" style="padding:28px;text-align:center;grid-column:1/-1">${log.length ? 'Nothing matches.' : 'Nothing captured yet. Open a web page, click the PageProof icon, then <b>Capture this page</b>.'}</div>`}</div>`
    : `<div class="scroll"><table><thead><tr><th>Captured</th><th>Page</th><th>Case</th><th>Collected by</th><th>Evidence pack</th><th style="text-align:right">Open</th></tr></thead><tbody>
    ${shown.map(({ e, s }) => `<tr><td class="muted" style="white-space:nowrap">${fmtDate(e.time)}<div class="mono faint" style="font-size:11.5px">${esc(e.captureId || '')}</div></td>
      <td style="max-width:360px"><b>${esc(site(e.url))}</b><div class="faint" style="font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.title || e.url)}</div></td>
      <td class="mono">${esc(s.caseRef || '—')}</td><td>${esc(s.collector || '—')}</td>
      <td>${s.at ? `<span class="tag ok">Saved</span> <span class="faint" style="font-size:12.5px">${fmtDate(s.at)}</span>` : '<span class="tag grey">Not saved</span>'}</td>
      <td style="text-align:right;white-space:nowrap"><button class="btn" style="min-height:32px;font-size:13px" data-act="opencap" data-v="${esc(e.id)}">Open</button></td></tr>`).join('') || `<tr><td colspan="6" class="muted" style="padding:28px;text-align:center">${rows.length ? 'Nothing matches.' : 'Nothing captured yet.'}</td></tr>`}
    </tbody></table></div>`}
  </section>
  <section class="card" style="overflow:hidden">
    <div class="pad row" style="border-bottom:1px solid var(--line)"><h2>Evidence reports</h2><span class="faint" style="font-size:13px">From Copies found: one report per copy</span><a class="btn ghost" style="margin-left:auto" href="#weekly">Weekly summary</a></div>
    <div class="scroll"><table><thead><tr><th>Made</th><th>Copy</th><th>Client's photo</th><th>Case</th><th>Match ID</th><th style="text-align:right">Open</th></tr></thead><tbody>
    ${reps.slice(0, 300).map(r => `<tr><td class="muted" style="white-space:nowrap">${fmtDate(r.at)}</td><td style="max-width:300px"><b>${esc(r.site)}</b><div class="faint" style="font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.url)}</div></td><td>${esc(r.photo || '')}<div class="faint" style="font-size:12.5px">${esc(r.client || '')}</div></td><td class="mono">${esc(r.caseNo || '—')}</td><td class="mono" style="font-size:12.5px">${esc(r.id || '')}</td><td style="text-align:right"><a class="btn" style="min-height:32px;font-size:13px" href="${safeUrl(r.url)}" target="_blank" rel="noreferrer">Their page</a></td></tr>`).join('') || `<tr><td colspan="6" class="muted" style="padding:28px;text-align:center">No evidence reports yet. Make one from a copy in Copies found.</td></tr>`}
    </tbody></table></div>
    <div class="pad faint" style="font-size:12.5px;border-top:1px solid var(--line)">The PDF files themselves are in your Downloads folder, named PageProof_evidence_….</div>
  </section>
  <p class="faint" style="margin:0;font-size:12.5px">Captures are kept inside this browser. The evidence packs you saved are in your Downloads folder (or wherever you chose).</p>`;
};
V.library.after = () => {
  const i = document.getElementById('libq');
  i.oninput = () => { state.libQ = i.value; render(true).then(() => { const j = document.getElementById('libq'); j.focus(); j.setSelectionRange(j.value.length, j.value.length); }); };
  capThumbs();
};
ACTS.libview = async v => { state.libView = v; try { await api.storage.local.set({ ppLibView: v }); } catch (e) { /* only this time */ } render(true); };
// Fill in each card's picture: the small picture saved when the capture was opened, or one made
// now from the capture itself while the browser still holds it (it keeps the last 10).
async function capThumbs() {
  for (const el of document.querySelectorAll('[data-capthumb]')) {
    if (!['library', 'capture'].includes(state.shown)) return;
    const id = el.dataset.capthumb;
    try {
      let t = await PP_DB.get('thumb-' + id);
      if (!t) { const rec = await PP_DB.get(id); if (rec) t = await PP_DB.makeThumb(rec); }
      if (t && t.src) el.innerHTML = `<img src="${safeImg(t.src)}" alt="">`;
    } catch (e) { /* the letter stays */ }
  }
}

// =====================================================================================
// Evidence › Needs a capture (4.14): stolen copies with no evidence pack yet
// =====================================================================================
// A copy counts as captured when an evidence pack was saved from a capture of it (Capture on the
// copy), when a saved pack in the log is of the same page (any of its addresses), or when you
// said it was captured another way.
async function needsCapture() {
  const [copies, log] = await Promise.all([FC.allCopies(), getLog()]);
  const saved = new Set();
  for (const e of log) if (e.saves && e.saves.some(s => s.at)) saved.add(FC.pageKey(e.url));
  const list = copies.filter(c => c.status === 'stolen' && !c.packAt && !FC.hiddenCopy(c, RS_LISTS.hidden) && ![c.url, ...(c.alts || [])].some(u => saved.has(FC.pageKey(u))))
    .sort((a, b) => String(a.answered || a.firstSeen).localeCompare(String(b.answered || b.firstSeen)));
  return { up: list };   // 4.15: no "still online" check any more, so no Gone group
}
V.tocapture = async () => {
  const { up } = await needsCapture();
  const ps = new Map((await FC.DB.getMany('photos', [...new Set(up.map(c => c.photo))])).filter(Boolean).map(p => [p.id, p]));
  const row = (c, can, top) => { const p = ps.get(c.photo) || {}, d = ppDaysSince(c.answered || c.firstSeen); return `<div class="caprow" data-id="${esc(c.id)}">
    <img class="thumb" src="${safeImg(c.thumb || (c.th && FC.pics.seen(c.id)) || 'icons/icon48.png')}" alt="" referrerpolicy="no-referrer">
    <div style="min-width:0;flex:1"><div class="row" style="gap:8px;flex-wrap:nowrap"><span class="sl" style="background:${avColor(FC.baseOf(c.site))}" aria-hidden="true">${esc((FC.baseOf(c.site)[0] || '?').toUpperCase())}</span><b>${esc(c.site)}</b><span class="agechip ${d >= 7 ? 'r' : d >= 3 ? 'a' : ''}">${d >= 1 ? 'Waiting ' + plural(d, 'day') : 'Today'}</span></div><a class="curl" href="${safeUrl(c.url)}" target="_blank" rel="noreferrer"><span>${esc(String(c.url || '').replace(/^https?:\/\/(www\.)?/, ''))}</span>${ic('ext', 13)}</a>
      <div class="faint" style="font-size:12.5px">${esc(p.client || c.client || 'Client unknown')} · ${esc(p.name || 'Photo')} · marked stolen ${esc(fmtDate(c.answered || c.firstSeen))}</div></div>
    <div class="row" style="gap:6px">${can ? `<button class="btn" data-act="capdone" data-v="${esc(c.id)}" title="It was captured another way (another computer, another tool)">Already captured</button><button class="btn${top ? ' primary' : ''}" data-act="capturecopy" data-v="${esc(c.id)}">${ic('capture', 16)} Capture</button>` : `<button class="btn" data-act="capdone" data-v="${esc(c.id)}">Take off this list</button>`}</div></div>`; };
  return `${head('', 'Needs a capture', 'Copies you marked Stolen that have no evidence pack yet, oldest first. Capture each one before the site takes it down. When you save its evidence pack, it leaves this list by itself.', `<a class="btn" href="#found?filter=Stolen">All stolen copies</a>${up.length ? `<button class="btn primary" data-act="capturecopy" data-v="${esc(up[0].id)}">${ic('capture', 16)} Capture the oldest</button>` : ''}`)}
  <section class="card" id="capList">
    ${up.length ? up.map((c, i) => row(c, true, i === 0)).join('') : `<div class="job lvl-ok"><span class="jdot">${ic('check', 16, 3)}</span><div class="jt"><b>Every stolen copy has an evidence pack</b><span>Copies you mark Stolen show up here until they are captured.</span></div></div>`}
  </section>`;
};
ACTS.capdone = async v => {
  const undo = await FC.markCaptured(v, 'hand');
  render(true);
  toast('Taken off Needs a capture.', undo ? async () => { await undo(); render(true); } : null);
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
  const zoomKey = await ppZoomKey();
  const pops = (await api.storage.local.get('ppPopups')).ppPopups !== false;
  return `${head('Settings', 'Settings', 'These apply to everything in PageProof and are saved on this computer.')}
  <div class="grid g2">
    <section class="card pad" style="display:flex;flex-direction:column;gap:12px"><h2>You</h2>
      <label class="field" for="sName">Your name on every pack and report<input id="sName" value="${esc(name)}" placeholder="For example, Ben"></label>
      <div class="dsh" style="margin-top:6px">Version</div>
      <p class="muted" style="margin:0;font-size:14px">PageProof ${VERSION}</p>
      <div class="row" style="gap:8px"><a class="btn" href="#whatsnew">What's new</a><button class="btn" data-act="tour">Take the tour again</button></div></section>
    <section class="card pad" id="textsize" style="display:flex;flex-direction:column;gap:12px"><h2>Text size</h2>
      <p class="muted" style="margin:0;font-size:14px">Makes everything in PageProof bigger: words, buttons and pictures. Saved on this computer only.</p>
      <div class="seg" role="group" aria-label="Text size">${TEXT_SIZES.map(([k, l, z]) => `<button class="${zoomKey === k ? 'on' : ''}" aria-pressed="${zoomKey === k}" data-act="textsize" data-v="${k}"><span style="font-size:${Math.round(14 * z)}px">${l}</span></button>`).join('')}</div>
      <span class="faint" style="font-size:12.5px">Ctrl and + or − also works on any PageProof page, and PageProof remembers it.</span></section>
    <section class="card pad" id="popSet" style="display:flex;flex-direction:column;gap:12px"><h2>Capturing a page</h2>
      <label class="row" style="gap:10px;flex-wrap:nowrap;cursor:pointer"><input type="checkbox" id="sPopups" ${pops ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--accent)"><span><b>Close pop-ups before the first screen</b><span class="muted" style="display:block;font-size:13.5px">Cookie notices, newsletter boxes, "allow notifications" and "open in the app" boxes. PageProof presses the site's own close or accept button, and the capture log says what it closed. Log-in walls are left alone.</span></span></label></section>
    <section class="card pad" style="display:flex;flex-direction:column;gap:12px"><h2>Is everything working?</h2>
      <p class="muted" style="margin:0;font-size:14px">Green and red lights for Google Drive, Keep searching, each search site and your backup. One button copies the details to send for support.</p>
      <a class="btn" style="align-self:flex-start" href="#health">Check now</a></section>
    <section class="card pad" style="display:flex;flex-direction:column;gap:12px"><h2>How PageProof is doing</h2>
      <p class="muted" style="margin:0;font-size:14px">Day-by-day stats for this computer: what was found, how fast, what went wrong, and a checker test. Save them as a file to send to Claude for help.</p>
      <a class="btn" style="align-self:flex-start" href="#stats">See the stats</a></section>
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
  const pp = document.getElementById('sPopups');
  pp.onchange = async () => { await api.storage.local.set({ ppPopups: pp.checked }); toast(pp.checked ? 'Pop-ups will be closed before each capture.' : 'Pop-ups are left as they are.'); };
};

// =====================================================================================
// Hidden and approved sites
// =====================================================================================
const kindOf = s => s.startsWith('.') ? 'Ending' : s.includes('/') ? 'Account or part' : s.split('.').length > 2 && !/\.(co|com|org|net|gov|ac)\.[a-z]{2}$/.test(s) ? 'Sub-site' : 'Whole site';
V.hidden = async () => {
  await RS_LISTS.load();
  const tab = state.hidTab, q = state.hidQ.toLowerCase();
  // 4.9: which sites are social media (their copies go on the Social media tab of Copies found).
  if (tab === 'social') {
    await PP_SOCIAL.ready;
    // 4.25.0: a fixed list of platforms (16 now: Reddit was taken out, it is a forum). Every other site goes on the Websites tab.
    const plats = new Map();
    for (const [d, [name]] of Object.entries(PP_SOCIAL.SITES)) { if (!plats.has(name)) plats.set(name, []); plats.get(name).push(d); }
    const rows = [...plats].filter(([n, ds]) => !q || n.toLowerCase().includes(q) || ds.some(d => d.includes(q)));
    const readOn = (await api.storage.local.get('ppAcctRead')).ppAcctRead !== false;
    return `${head('Settings', 'Hidden and approved sites', 'Hidden sites never show up in any search. Approved sites may use the photos: copies found there are marked Licensed by themselves.')}
    <section class="card" style="overflow:hidden">
      <div class="toolbar"><div class="tabs" role="tablist">${[['hidden', 'Hidden sites'], ['allowed', 'Approved for every client'], ['client', 'Approved for one client'], ['rejected', 'Rejected links'], ['stolen', 'Stolen before links'], ['social', 'Social sites']].map(([k, l]) => `<button role="tab" class="${tab === k ? 'on' : ''}" aria-selected="${tab === k}" data-act="hidtab" data-v="${k}">${l}</button>`).join('')}</div></div>
      <div class="row" style="gap:10px;padding:12px 18px;border-bottom:1px solid var(--line);background:var(--bg)">
        <input id="hidq" class="chip" style="min-height:38px;padding:0 12px;font-size:14px;flex:1 1 260px" placeholder="Find a platform, like vimeo" value="${esc(state.hidQ)}" aria-label="Find a platform"></div>
      <p class="muted" style="margin:0;padding:12px 18px;font-size:13.5px;border-bottom:1px solid var(--line)">Only these ${plats.size} platforms count as social media. Every other site (blogs, video sites, forums, chat apps...) shows on the Websites tab like any website, and can be hidden as a whole site.</p>
      <div class="scroll"><table><thead><tr><th>Platform</th><th>Web addresses it covers</th></tr></thead><tbody>
        ${rows.map(([n, ds]) => `<tr><td><b>${esc(n)}</b></td><td class="mono" style="font-size:12.5px">${esc(ds.join(', '))}${n === 'Pinterest' || n === 'Nextdoor' ? ' <span class="faint">+ country sites</span>' : ''}<br><span class="faint">and their mobile and sub-sites (m., mobile., www.)</span></td></tr>`).join('') || '<tr><td colspan="2" class="faint">No platform matches. That site counts as a website.</td></tr>'}
      </tbody></table></div>
    </section>
    <section class="card pad"><label class="row" style="gap:10px;align-items:flex-start;cursor:pointer"><input type="checkbox" id="acctread" data-act="acctread" ${readOn ? 'checked' : ''} style="margin-top:4px"><span><b>Read account details by itself</b><br><span class="muted" style="font-size:13px">Followers, verified, account type, country and owner company. PageProof opens each account's profile in a background tab of your browser for a few seconds, one account a minute (X: one every 2 minutes, 30 a day), every 90 days, only for copies still to review, only while Keep searching is on and inside its hours (Pause stops it too). Off: only when you press "Read again now" on an account.</span></span></label></section>
    <p class="faint" style="margin:0;font-size:12.5px">Copies on social sites go on the Social media tab of Copies found, where Stolen, Hide and Approve work per account. Saved with your settings backup.</p>`;
  }
  // Approved for one client: kept with each client (site | client).
  const perClient = [];
  for (const c of await FC.DB.all('clients')) for (const s of c.licensed || []) perClient.push(s + ' | ' + c.name);
  await RS_STOLEN.load();
  const list = tab === 'rejected' ? RS_REJECT.items.map(r => r.url) : tab === 'client' ? perClient.sort().reverse() : tab === 'stolen' ? RS_STOLEN.items : RS_LISTS[tab];
  const rows = [...list].reverse().filter(s => s.toLowerCase().includes(q) && (tab === 'rejected' || tab === 'client' || tab === 'stolen' || state.hidKind === 'All' || kindOf(s) === state.hidKind));
  const T = [['hidden', 'Hidden sites', RS_LISTS.hidden.length], ['allowed', 'Approved for every client', RS_LISTS.allowed.length], ['client', 'Approved for one client', perClient.length], ['rejected', 'Rejected links', RS_REJECT.items.length], ['stolen', 'Stolen before links', RS_STOLEN.items.length], ['social', 'Social sites', new Set(Object.values(PP_SOCIAL.SITES).map(x => x[0])).size]];
  const flat = tab === 'rejected' || tab === 'client' || tab === 'stolen';
  const page = rows.slice(0, state.hidMore || 100);
  return `${head('Settings', 'Hidden and approved sites', 'Hidden sites never show up in any search. Approved sites may use the photos: copies found there are marked Licensed by themselves.', `<button class="btn" data-act="hidsave">${ic('down', 18)} Download list</button><button class="btn" data-act="hidload">Add from a file</button>`)}
  <section class="card" style="overflow:hidden">
    <div class="toolbar"><div class="tabs" role="tablist">${T.map(([k, l, n]) => `<button role="tab" class="${tab === k ? 'on' : ''}" aria-selected="${tab === k}" data-act="hidtab" data-v="${k}">${l} <span>${n.toLocaleString()}</span></button>`).join('')}</div></div>
    <div class="row" style="gap:10px;padding:12px 18px;border-bottom:1px solid var(--line);background:var(--bg)">
      <input id="hidq" class="chip" style="min-height:38px;padding:0 12px;font-size:14px;flex:1 1 260px" placeholder="${tab === 'stolen' ? 'Find a link' : tab === 'rejected' ? 'Find a rejected link' : tab === 'client' ? 'Find a site or a client' : 'Find or add a site, like patch.com or x.com/examplenews'}" value="${esc(state.hidQ)}" aria-label="Find a site">
      ${tab === 'client' ? '<span class="faint" style="font-size:13px">Add one from a copy: open it in Copies found and press Approve site.</span>' : ''}${tab === 'stolen' ? '<span class="faint" style="font-size:13px;flex:1 1 300px">Pages you already dealt with. A copy found on one of them gets a red Stolen before tag in Copies found, and its site counts as a repeat offender. Add them with Add from a file.</span>' : ''}${!flat ? `<button class="btn primary" data-act="hidadd">＋ ${tab === 'hidden' ? 'Hide' : 'Approve'} it</button>
      <div class="seg">${['All', 'Whole site', 'Sub-site', 'Account or part', 'Ending'].map(k => `<button class="${state.hidKind === k ? 'on' : ''}" data-act="hidkind" data-v="${k}">${k}</button>`).join('')}</div>` : ''}</div>
    <div class="scroll"><table><thead><tr><th>${tab === 'rejected' || tab === 'stolen' ? 'Link' : tab === 'client' ? 'Site' : 'Site or account'}</th>${tab === 'stolen' ? '<th></th>' : tab === 'rejected' ? '<th>Photo</th>' : tab === 'client' ? '<th>Approved for</th>' : '<th>What it covers</th>'}<th></th></tr></thead><tbody>
      ${page.map(h => { if (tab === 'stolen') return `<tr><td><a class="mono" style="font-size:13px;overflow-wrap:anywhere" href="${esc(h)}" target="_blank" rel="noreferrer">${esc(h)}</a></td><td></td><td style="text-align:right"><button class="btn" style="min-height:32px;font-size:13px" data-act="hidremove" data-v="${esc(h)}">↺ Take off the list</button></td></tr>`;
        const r = tab === 'rejected' ? RS_REJECT.items.find(x => x.url === h) : null; if (tab === 'client') { const [site, who] = h.split(' | '); return `<tr><td><b class="mono" style="font-size:13px;overflow-wrap:anywhere">${esc(site)}</b></td><td>${esc(who)}</td><td style="text-align:right"><button class="btn" style="min-height:32px;font-size:13px" data-act="hidremove" data-v="${esc(h)}">↺ Remove</button></td></tr>`; }
        return `<tr><td><b class="mono" style="font-size:13px;overflow-wrap:anywhere">${esc(h)}</b></td><td>${r ? esc(r.pic || 'every photo') : `<span class="tag grey">${kindOf(h)}</span>${typeof ppTeamTag === 'function' ? ppTeamTag(h, tab) : ''}`}</td><td style="text-align:right">${!r && typeof ppTeamBtn === 'function' ? ppTeamBtn(h, tab) : ''}<button class="btn" style="min-height:32px;font-size:13px" data-act="hidremove" data-v="${esc(h)}">↺ ${tab === 'hidden' ? 'Show again' : tab === 'allowed' ? 'Remove' : 'Bring back'}</button></td></tr>`; }).join('') || `<tr><td colspan="3" class="muted" style="padding:28px;text-align:center">${q ? (flat ? 'Nothing matches.' : 'Nothing matches. Press the button to add it.') : 'This list is empty.'}</td></tr>`}
    </tbody></table></div>
    <div class="row faint" style="padding:10px 18px;border-top:1px solid var(--line);font-size:12.5px;gap:12px"><span>Showing ${page.length.toLocaleString()} of ${rows.length.toLocaleString()}.</span>${rows.length > page.length ? '<button class="btn" style="min-height:30px;font-size:13px;margin-left:auto" data-act="hidmore">Show more</button>' : ''}</div>
  </section>
  ${flat && tab !== 'stolen' ? '' : impCard((await RS_IMPORTS.all()).filter(e => e.kind === tab), tab)}
  <p class="faint" style="margin:0;font-size:12.5px">${RS_LISTS.fileState === 'granted' ? 'Saved in Documents › PageProof as hidden-sites.txt, allowed-sites.txt, rejected-links.txt and stolen-links.txt.' : 'Saved in this browser. <a href="#settings">Set up the PageProof folder</a> to also keep them as text files that survive a reinstall.'}</p>`;
};
// 4.22: files added to this list, each with Undo this import.
const impCard = (list, tab) => `<section class="card" style="overflow:hidden">
  <div class="row" style="padding:14px 18px;border-bottom:1px solid var(--line);gap:10px"><b style="flex:1">Files you added</b><button class="btn" style="min-height:32px;font-size:13px" data-act="hidunload">Take out the sites in a file…</button></div>
  ${list.map(e => { const live = (e.op === 'add') === !e.undone; return `<div class="row" style="padding:12px 18px;border-bottom:1px solid var(--line);gap:12px;flex-wrap:nowrap"><span style="flex:1;min-width:0"><b style="overflow-wrap:anywhere">${esc(e.name)}</b><br><span class="muted" style="font-size:13px">${e.op === 'add' ? 'Added' : 'Took out'} ${e.sites.length.toLocaleString()} ${tab === 'stolen' ? 'links' : 'sites'} · ${fmtDate(e.at)}${e.undone ? ' · <b>undone ' + fmtDate(e.undone) + '</b>' : ''}</span></span><button class="btn${live && e.op === 'add' ? ' primary' : ''}" style="min-height:32px;font-size:13px;white-space:nowrap" data-act="impundo" data-v="${esc(e.id)}">${e.op === 'add' ? (live ? '↶ Undo this import' : 'Add them again') : (live ? '↶ Put them back' : 'Take them out again')}</button></div>`; }).join('')}
  <p class="faint" style="margin:0;padding:10px 18px;font-size:12.5px">${list.length ? 'Undo takes out only the sites that file added. Sites that were on the list before stay.' : 'No files added yet.'} Added a file before PageProof kept this list? Press "Take out the sites in a file" and pick the same file: only the sites it added come out.</p>
</section>`;
V.hidden.after = () => {
  const i = document.getElementById('hidq');
  i.oninput = () => { state.hidQ = i.value; state.hidMore = 0; render(true).then(() => { const j = document.getElementById('hidq'); j.focus(); j.setSelectionRange(j.value.length, j.value.length); }); };
  i.onkeydown = e => { if (e.key === 'Enter' && state.hidTab === 'social') return; else if (e.key === 'Enter' && !['rejected', 'client'].includes(state.hidTab)) act('hidadd'); };
};
Object.assign(ACTS, {
  socadd: async v => {
    const site = RS_SITE.tidy(state.hidQ || '').split('/')[0];
    if (!site || site.startsWith('.')) return toast('Type a site, like photoverse.social');
    await PP_SOCIAL.setMine(site, v); FC.backupSoon(); state.hidQ = '';
    toast(site + (v === 'social' ? ' goes on the Social media tab now.' : ' goes on the Websites tab now.')); render(true);
  },
  acctread: async (v, el) => { await api.storage.local.set({ ppAcctRead: !!(el && el.checked) }); toast(el && el.checked ? 'PageProof reads account details by itself.' : 'Account details are only read when you ask.'); },
  socforget: async v => { await PP_SOCIAL.setMine(v, ''); FC.backupSoon(); toast('Forgot your choice for ' + v + '.'); render(true); },
});
document.getElementById('hidLoad').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  const kind = state.hidTab === 'allowed' ? 'allowed' : state.hidTab === 'stolen' ? 'stolen' : 'hidden';
  const L = kind === 'stolen' ? RS_STOLEN : RS_LISTS;
  await L.load();
  const arr = RS_IMPORTS.arr(kind), have = new Set(arr), added = [], text = await f.text();
  for (const s of (kind === 'stolen' ? RS_STOLEN.parse(text) : RS_IMPORTS.parseFile(text))) if (!have.has(s) && !(kind === 'hidden' && RS_LISTS.wholeSocial(s))) { have.add(s); arr.push(s); added.push(s); }
  await L.save();
  if (added.length) await RS_IMPORTS.record({ op: 'add', kind, name: f.name, sites: added });
  const n = added.length;
  toast(n.toLocaleString() + ' ' + (kind === 'stolen' ? (n === 1 ? 'link' : 'links') : n === 1 ? 'site' : 'sites') + ' added', n ? async () => { const l = await RS_IMPORTS.all(); if (l[0]) await RS_IMPORTS.toggle(l[0].id); render(true); } : null);
  render(true);
});
// 4.22: take out the sites a file added (for files added before PageProof remembered imports).
document.getElementById('hidUnload').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  const kind = state.hidTab === 'allowed' ? 'allowed' : state.hidTab === 'stolen' ? 'stolen' : 'hidden';
  const L = kind === 'stolen' ? RS_STOLEN : RS_LISTS;
  await L.load();
  const { added, before } = RS_IMPORTS.fromFile(await f.text(), RS_IMPORTS.arr(kind));
  if (!added.length) return toast('None of the sites in ' + f.name + ' were added to this list by that file.');
  const n = RS_IMPORTS.takeOut(kind, added);
  await L.save();
  await RS_IMPORTS.record({ op: 'remove', kind, name: f.name, sites: added });
  toast('Took out ' + n.toLocaleString() + ' sites added by ' + f.name + (before.length ? '. ' + before.length.toLocaleString() + ' were there before it, so they stay.' : '.'), async () => { const l = await RS_IMPORTS.all(); if (l[0]) await RS_IMPORTS.toggle(l[0].id); render(true); });
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
      <div><b>${L.dl}</b><span>found pictures downloaded at once</span></div>
      <div><b>${L.pace}</b><span>fastest Keep searching pace</span></div>
      <div><b>${L.ram}</b><span>of memory</span></div></div>
    <span class="muted" style="font-size:13.5px">The daily 50 takes ${L.fifty} at this level.</span></div>
    <div class="dsec"><div class="dsh">It also backs off by itself</div>
      <ul class="hwlist"><li>Keep searching pauses when the computer is busy for a minute (processor over 80%), and picks up again when it calms down.</li><li>Big searches (today's 50, a search you start) slow down to one photo check and one search tab while the computer is busy, so they still finish, and go back to full speed a minute after it calms down.</li><li>The same happens on a laptop running on battery below 30%, and while most of the memory is in use, for example during a video call.</li><li>Never goes over the limits above, even if you pick a faster pace or search speed.</li><li>This only sets how much work your computer does. How often Google, Yandex and Bing are asked stays at the safe search speed, so a stronger computer never causes more robot checks.</li></ul></div>
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
  ['Cleaner menu, top bar and Home', 'Home now opens with four number tiles (new copies, waiting for a capture, searched today, every photo searched once), only one big blue button, coloured edges on urgent jobs and a "New copies by client" card. The status line moved to the bottom of the menu, menu numbers are calmer (orange when a stolen copy has waited a week for a capture), and the top bar buttons sit together in one group.'],
  ['Seals, crests and patterns no longer count as copies', 'A different photo that only shares a seal on a podium, a crest on the wall, a small corner of the picture, or a pattern like a chain-link fence or a checkered floor is now called "Different photo" with a low %, in new searches, in Copies found (unanswered copies are checked once more) and in Compare.'],
  ['Far fewer "Picture blocked" links', 'Most "Picture blocked" links were never blocked: Google had not loaded their small picture yet when PageProof read the page, or the picture sat beside a second link (a Facebook group, an X account). PageProof now scrolls through the whole results list so every picture loads, finds pictures next to those links, and when a search site still gives no picture it reads the page itself and checks its own pictures. Links with nothing to check now say "No picture" instead of "Picture blocked". New: Settings › Is everything working? now shows whether this browser is signed in to Facebook, Instagram and X (and the optional sites), because those sites hide posts from anyone signed out and PageProof checks posts in your browser.'],
  ['Bing finds copies again', 'Bing now also brings back its "Visual matches" (top 60), each with the picture\'s own address, so PageProof\'s checker compares them and keeps only real copies. Before this, Bing came back empty whenever it listed no "Pages with this image". If Bing opens the picture in a pop-up box first, PageProof now goes on to Bing\'s results page instead of reading the page behind the box.'],
  ['How PageProof is doing', 'A new page, Settings › How PageProof is doing, keeps day-by-day stats for this computer: what searches found, how fast each step is, links thrown out and why, each search site (including how many of its pictures could not be checked), Keep searching on-time and pauses, Google Drive speed, photos covered and computer strain. A one-click Checker test runs made-up test pictures through the photo checker. "Save stats for Claude" saves one file (numbers and website names only, never client names, photo names or links), and a weekly file is saved by itself on Fridays. Anything that looks off shows at the top, on Home and on Is everything working.'],
  ['Social media number counts only what you can see', 'The number on the Social media tab and the Quick filter numbers no longer count copies hidden by Show government, Show reposts and shares or Show personal accounts. "Accounts still being read" now counts only accounts with a copy waiting for your answer.'],
  ['Bing only brings back real matches', 'When Bing found no pages with your photo, PageProof used to read every link on Bing\'s page instead, which is Bing\'s "look-alike photos" grid (other players, other games). Those showed as "Picture blocked" with a grey box. Now only Bing\'s "Pages with this image" list is read, and a Bing search that finds nothing no longer counts against Bing as "may have stopped working".'],
  ['Personal accounts hidden, politicians caught more often, link previews are not copies', 'Social media copies from someone\'s own account (just a person\'s name, no company, website or contact details: a Facebook profile with friends, a LinkedIn /in/ profile, an X account with only a name) are hidden until you tick "Show personal accounts". Stolen copies always stay, and "Type is wrong?" in About this account sets the type by hand. Politicians are also caught by "serving … District", "(R-Ohio)", committee badges, @Rep… handles and "Rep." in the post title, even before the profile is read. A match that is only the picture in a link preview card (a LinkedIn, X or Facebook post sharing an article) is thrown out during the search, or moved to Removed ("Only in a link preview"; Put back works).'],
  ['The photo must be on their page itself', 'Every Google match is now checked against their page before it shows up. It only counts when your client\'s photo is one of the page\'s own pictures: comments, link previews, "related posts", sidebars and "More posts from…" grids don\'t count. For Facebook, Instagram and X, PageProof opens the post in a quiet pinned tab of your signed-in browser and looks at every picture (albums too) before removing a match. A page that can\'t be read stays a Maybe.'],
  ['Reddit and forums taken out', 'Your team never goes after forums, so Reddit is gone: it is no longer a social media platform (16 now), and links from reddit.com, old.reddit.com, redd.it, i.redd.it and preview.redd.it are dropped from searches. Clear forum addresses go too: forum.*, forums.* or boards.* sites, and pages under /forum/, /forums/ or /threads/ or made by phpBB, vBulletin or Discourse. Reddit and forum copies found before are off Copies found. Copies you already marked Stolen stay.'],
  ['Picture links, and TikTok slideshows read slide by slide', 'Every copy now shows the web address of their picture itself (Picture link, with Copy link and Open) when PageProof knows it, and the Evidence report lists it. TikTok photo posts (slideshows) are opened and every slide is checked, so a photo on slide 3 is found and shown as "Slide 3 of 4" with that slide\'s link. Right-click any picture for the new "Copy picture link", and a Capture of a TikTok slideshow lists every slide\'s link in post-pictures.txt. TikTok\'s picture links stop working after about two days, so save the picture to keep it.'],
  ['One-click update file for the whole team', 'Update-PageProof.cmd is now on the download page next to PageProof.zip. Keep it in Documents › PageProof and double-click it to install or update PageProof, then press Reload. It works for anyone on the team.'],
  ['Reposts and shares spotted', 'When an account only shared, reposted, quoted or reblogged someone else\'s post (Facebook shares, X reposts and quotes, Instagram, Threads, TikTok and Bluesky reposts, Tumblr reblogs), the copy now says "Share of …" or "Repost of …", names the original poster as the lead with buttons to open the original post and account, and is hidden on the Social media tab until you tick "Show reposts and shares". When the search only linked an account\'s main page, PageProof scrolls that page in a small background tab, finds the exact post that holds the photo, and Capture captures that post. Nothing is answered for you.'],
  ['New versions arrive faster', 'A finished fix or feature now reaches the download page about a minute after it is done (it used to take about 20 minutes), and the download page title shows the version number.'],
  ['Logos and buildings no longer count as copies', 'Two different photos can line up where they show the same printed things: the sponsor wall behind a coach, a red carpet backdrop, a shop sign, or a famous building. The photo check now looks at what lines up. If it is only logos, signs or lettering, it says "Different photo, only the logos match". If the scene lines up but things at different distances shift against each other (columns and the wall behind them, a pole), it says "Different photo of the same place". Both are thrown out of searches, and their % now shows only what lines up of the photo itself, so they show low. Copies already in Copies found that you have not answered are checked again quietly while the page is open; the ones that turn out to be another photo move to Removed, where Put back still works.'],
  ['Pause really stops everything', 'Pause (or switching Keep searching off) now stops at once: the photo being searched, a big search like today\'s 50, and the account details reader. Any search or profile tab it had open closes. Press Resume and it picks up where it stopped. The account details reader now only reads accounts with copies still to review (or the one you open), keeps what it read for 90 days, works only in your Keep searching hours, and has hard limits per site so sites like X don\'t block you: X at most one profile every 2 minutes and 30 a day, and a site that shows empty pages is left alone for 6 hours. For X, Instagram and Threads only the profile itself is opened ("About this account" is skipped). Its on/off switch is on the Keep searching page.'],
  ['X account details fixed', 'Followers, the check mark and the account type on X now come from the account itself. Before, PageProof could pick up your own account\'s numbers (so it said 0 followers), a check it didn\'t have, and "2026 X Corp." from the bottom of X\'s page as a company, which also made people show as Business. Every account is read again once by itself, X ones first.'],
  ['Check marks drawn like the site draws them', 'X: blue check = Paid (anyone can buy it), gold check = Verified organisation, grey check = Government. Instagram and Facebook: Meta check (Meta uses the same check for paid Meta Verified and earned verification). TikTok, YouTube and others: Verified. The Verified filter has "Really verified (not bought)".'],
  ['Government accounts hidden', 'Anyone in or running for public office (Congresswoman, Councilman, "for Council", campaign or .gov websites, a grey check or a government label) is now the account type Government. Their copies are hidden from Copies found and the new-copies number. Tick "Show government" on the Social media tab to see them.'],
  ['Real names on social accounts', 'Accounts now show their real name (like "Matt Thibodeau") with the number or handle from the link in small grey beside it. Works for Facebook number links, YouTube channel/UC… links and the rest. The search box finds accounts by name too. A country is also filled in from Facebook\'s Page transparency or the place on the profile (like Boston, MA, United States).'],
  ['Countries: pick the ones to show', 'Websites now show copies only from the countries you pick: United States and Puerto Rico to start. Add another with "+ Show a country", and press the ✕ on a country to stop showing it. Sites whose country isn\'t known (most .com sites) always show.'],
  ['Social media means the 17 main platforms only', 'Only YouTube, Facebook, Instagram, TikTok, X, LinkedIn, Pinterest, Threads, Reddit, Snapchat, Tumblr, Bluesky, Substack, Nextdoor, Truth Social, Vimeo and Behance go on the Social media tab (with their mobile and short links, like m.facebook.com, youtu.be, twitter.com and threads.com). Every other site, like Naver Blog, note, Twitch, Quora, Medium or Flickr, now shows on the Websites tab like any website: country filter, and Hide site hides the whole site again. Copies found before moved over by themselves. Sites on your hidden list that were shown again in 4.9.5 because they counted as social are hidden again. The list is in Settings › Hidden and approved sites › Social sites.'],
  ['Spam blogs hidden', 'Copies on spam blog farms (random addresses on throwaway sites, like ab3cd9.madeupname.blog) are now kept out of Copies found and One at a time, and get a grey Spam blog tag. A line above the list says how many are hidden, with Show them, Only them, and Hide all of those sites (the whole site, so its next made-up addresses stay out too, with Undo). Nothing is answered for you.'],
  ['Take out the sites in a file: takes out all of them', 'Take out the sites in a file now takes out every page that came from the file. Only whole sites (like patch.com) that were hidden before the file stay, since those are the ones you hide by hand. Before, it guessed from the order of the list and left most of a big file in.'],
  ['Stolen before links', 'Bring in your list of links stolen before: Settings › Hidden and approved sites › Stolen before links › Add from a file. A copy found on one of those exact pages gets a red Stolen before tag in Copies found, and other pages on the same site (or by the same social account) count as a repeat offender and come first. The Stolen before quick filter shows only them, and More filters can hide them. Nothing is answered by itself.'],
  ['Quick again with a long hidden list', 'A hidden sites list with tens of thousands of pages made every PageProof page slow: each copy was checked against every page on the list. Now it is looked up in one step, about 100 times faster, so a big list no longer slows down clicks, scrolling or Copies found.'],
  ['Undo a file you added', 'Hidden and approved sites now lists every file you added with "Add from a file", each with Undo this import. Undo takes out only the sites that file added, so sites that were on the list before stay. For a file added before this version, press "Take out the sites in a file" and pick the same file. A line with several links separated by commas now counts as several links.'],
  ['Searching matched to your computer', 'The computer check now sets every part of a search on this computer: photo checks at a time (up to 6 on a very strong computer), search tabs open, and found pictures downloaded and opened at once. A new speed level in Settings › Your computer counts from the next search. How often the search sites are asked does not change, so a stronger computer never means more robot checks.'],
  ['Big searches ease off when you are busy', 'While the computer is flat out, memory is nearly full or a laptop is low on battery, today\'s 50 and searches you start slow down to one photo check and one search tab instead of carrying on at full speed. They still finish, and go back to full speed a minute after the computer calms down. Is everything working shows how often it happened.'],
  ['Owner checks stay out of your way', 'When PageProof opens an account or post in your browser to see who is behind it, it now opens as a small pinned tab at the far left with the PageProof logo and "checking owner". It stays in the background, never jumps in front of your work, and closes by itself when the check is done.'],
  ['Full-page captures on tricky sites', 'Details panels that slide in from the side (like a business search result) no longer leave a narrow strip with blank space beside it: the page is kept as it looks and the panel is written out in full as a numbered section. Boxes that fade or slide in as you scroll, late pictures, sticky headings and column titles, "Add to cart" and cookie bars at the bottom, pop-up windows and pages that grow as pictures load now come out whole, with nothing blank or doubled.'],
  ['Daily backup to your own Google Drive', 'Once a day (Monday to Friday, 8 to 6) PageProof saves a copy of your work into My Drive › PageProof Backup: copies found, answers, hidden and approved sites, clients, settings and the capture log. Only you can see it. The last 14 are kept. Settings › Backups has Back up now and the time of the last backup, which turns red after 3 work days without one.'],
  ['Safe restore', 'Pick any backup by date and see what would change before anything does. Your data right now is saved first as a "Before a restore" backup, so you can always go back.'],
  ['Team lists', 'Share hidden and approved sites and accounts with your team through one PageProof Team folder on Google Drive. Each person\'s PageProof saves only its own file, so nobody\'s answers get lost. Hidden and approved sites says who on the team added each one, and Show for me shows a site a teammate hid on your computer only.'],
  ['When the team disagrees', 'If one person hid a site and another approved it, PageProof flags it on Home and in Settings › Team lists so you can pick the answer everyone uses.'],
  ['Google Drive isn\'t syncing', 'If Google Drive for desktop stops answering, Home says so plainly. Your backup and team changes wait and go out by themselves when Drive is back.'],
  ['Moving to a new computer', 'Settings › Backups › Moving to a new computer walks you through it: back up on the old one, install, restore on the new one. First-time setup has a new Back up and share step too.'],
  ['Uses your graphics card', 'On computers with a graphics card, PageProof now uses it to find the details in each found picture, pair them up and line up real copies. Each computer tests itself on its first few pictures and only keeps the graphics card where it is quicker. Settings › Is everything working? shows whether it is in use.'],
  ['A faster photo checker', 'The part that checks each found picture against your photo now runs in WebAssembly, a faster language built into Chrome and Edge. Same answers as before, worked out about twice as fast (the pairing-up step about 5 times). Nothing to install.'],
  ['Mirror check with half the work', 'To catch copies flipped left to right, PageProof now flips your photo once and reuses it, instead of flipping every found picture and starting over.'],
  ['Hidden sites are not checked', 'Links on your hidden sites are no longer downloaded or checked, since you never see them. Show a site again and its links are checked then. Links on approved sites are checked last.'],
  ['Where the time goes', 'Settings › Is everything working? now shows how long the search sites, downloads and photo checks take on this computer, and which one is the slow part.'],
  ['A check before you save', 'Pressing Save evidence pack first checks what people forget: an empty case number or name, a page that looks blocked, your photo missing from the capture, or a wrong computer clock. If all is fine it saves straight away; if not, you see a short list with Fix buttons and Save anyway.'],
  ['Is your photo on the capture?', 'When you capture a page from Copies found, PageProof looks for your client\'s photo on the captured screens and ticks it off ("on screen 2"), or warns you before you save if it isn\'t there.'],
  ['Blocked page warning', 'If a capture shows a login wall, "page not found", "access denied", a robot check or an empty page, a red box says so straight away, with Capture again.'],
  ['Computer clock check', 'Each capture compares this computer\'s clock with the trusted timestamp. More than 2 minutes off shows on Home and Is everything working, with the Windows steps to fix it.'],
  ['Hands off during a capture', 'If you switch tabs or minimise the window mid-capture, PageProof pauses and carries on when you come back (it used to photograph the wrong tab). Scrolling the page mid-capture no longer spoils the joins.'],
  ['Closed the searching tab by mistake? It comes back', 'The pinned Keep searching tab reopens by itself and carries on, with a note on Home and a Pause button if you meant to stop. Its tab now says "leave open", and asks before closing.'],
  ['Stolen copies are protected', 'Hiding a site or account, or removing a group of picked copies, never hides or removes copies you marked Stolen.'],
  ['No more racing through by accident', 'Holding a key down gives one answer, not one after another. After 12 answers in 20 seconds PageProof offers a quick look at them, with Change on each.'],
  ['Clear notes when ticking folders', 'Ticking a year or quarter folder, or a big group folder, in Connect your photos now explains how it will be used, with Untick it and Yes, use it.'],
  ['Greyed-out buttons explain themselves', 'Point at a switched-off button to see why it is off and what to do.'],
  ['"Still online" checks removed', 'PageProof no longer revisits Stolen pages every week to see if they are still up, so no computer time is spent on it. The Still online card, Back online and Gone tags and filters are gone.'],
  ['A shorter menu', 'Five items instead of nine: Home, Copies found, Clients, Evidence and Settings. Keep searching is under Copies found, the photo tools and Verify are under Evidence, and Is everything working, hidden sites and Help are under Settings.'],
  ['Home is a list of what to do now', 'The most urgent job comes first, each with one button: a stopped search, new copies to answer, stolen copies that need a capture. When nothing needs you, it says All done.'],
  ['Pop-ups are closed before a capture', 'Cookie notices, newsletter boxes and "allow notifications" boxes are closed with the site\'s own button before the first screen, and the capture log says what was closed. Turn it off in Settings › Capturing a page.'],
  ['One row for one page', 'A page found under several addresses (its phone version, share links, tracking bits on the end) is now one copy with "+2 addresses", so you answer once.'],
  ['Needs a capture', 'Evidence › Needs a capture lists every copy you marked Stolen that has no evidence pack yet, oldest first, with a Capture button. Saving its pack takes it off the list.'],
  ['A status line at the bottom', 'Every page shows whether Drive is connected, Keep searching is running and the search sites are working. Anything stopped turns red with a Fix it button.'],
  ['Evidence library with pictures', 'Each capture shows a small picture with its case number and site. Switch to List for the old table.'],
  ['No more update notices', 'PageProof no longer checks GitHub for new versions or shows an Update button. New versions now come straight from your team lead.'],
  ['Big searches run quietly in the pinned tab', 'A search you start (New search, Today\'s 50, or photos picked in Your photos) now runs in the small pinned PageProof tab, the same one Keep searching uses. No new tab opens in front of you, and you can close the PageProof page while it works. To see how far it is, open All searches (or the search itself). If a search site wants a quick "are you a robot" check, a small notice pops up instead of jumping to that tab. Today\'s 50 at its set time no longer opens a PageProof page either.'],
  ['Followers, verified and account type on social copies', 'PageProof reads each account\'s profile by itself (in a background tab of your browser, one account at a time, once a month): followers, the check mark, and what kind of account it is. The Social media tab gets Verified, Followers, Account type and Country filters, Sort by Most followers, and the Accounts list shows and sorts by them.'],
  ['Spots business accounts by itself', 'When a site doesn\'t say what kind of account it is, PageProof adds up the signs: a shop or company word, a Shop now or Contact button, an email or phone number, its own website and whether that site sells things. Two or more signs = Business (guess). A company named on Facebook\'s Page transparency, or the country in Instagram\'s and X\'s About this account, shows on the account, with ready-made business register and trademark searches.'],
  ['Every photo gets searched at least once', 'Before, older photos that were never searched could wait forever behind newer and priority photos. Now 1 in 3 searches (you can pick 1 in 4 or 1 in 2 on Keep searching) goes to a photo that was never searched, until there are none left. ⚑ High priority photos still go first. ★ Priority clients get their first searches first, then the clients take turns, newest photos first. New photos you add to Drive join by themselves.'],
  ['See what has been searched', 'Keep searching shows how many photos were searched at least once (for example 12,400 of 18,000), how many are left, the first searches this week and a "done by" date at your pace, plus a table client by client, lowest first. Photos that can\'t be searched (POOL, TIFF, HEIC, broken) are counted apart. Home has the same bar, and a note when a client reaches 100%. The weekly summary says how many photos had their first search.'],
  ['Today\'s 50 can pick never-searched photos', 'On Keep searching › Today\'s 50, choose "Never searched first" to spend the whole batch on photos that have never been searched.'],
  ['Social sites: only accounts can be hidden', 'A whole social site like x.com or instagram.com can no longer be hidden, only the accounts on it. Any social site you hid before shows again, with a note on Copies found.'],
  ['Keep searching starts fresh after every update', 'After an update (or Reload), the old pinned Keep searching tab could keep running old code and quietly stop searching. Now PageProof closes the old Keep searching tab and any search tabs left over from before, and opens a fresh Keep searching tab by itself. If an old tab is still around, it notices it is out of date and loads itself again.'],
  ['Reloading a big search carries on', 'Reloading the page of a running search (like today\'s 50) no longer leaves its old search tabs frozen in the tab bar and opens new ones on top. The old tabs close, and the search carries on with the photos it had not finished. Photo checks of one search also no longer wait for another open search (or Keep searching) to finish its own checks, so photos move past "Checking matches" sooner.'],
  ['An answer always takes the copy off the list', 'In Copies found, pressing Stolen, Licensed, Remove, Hide site, "All N stolen" or an answer in the details panel now takes the row off the list straight away, every time. Before, a page redraw that was already under way (for example while Keep searching was running) could put the answered row back. Clicking answers quickly on several rows also works now: none is lost. Undo still brings a row back.'],
  ['Websites and Social media tabs', 'Copies found now has two tabs. On Social media each copy leads with the account that posted it, with one chip per platform, Group by account and an Accounts list. Each tab keeps its own filters.'],
  ['Stolen, Hide and Approve work per account', 'Marking a social post Stolen remembers the account: its next posts say "Marked stolen before" and come first. Hide and Approve on social posts are for that one account. A whole social site can never be hidden.'],
  ['The account, even when the link hides it', 'For Instagram /p/ links, TikTok short links and Facebook share links, PageProof follows the link, asks the site\'s public post info and reads the post page. Still missing? "Look in your browser" or paste the profile link.'],
  ['The post instead of the live preview', 'Social sites block the live page preview, so social copies show the caption, date, likes and comments with Open post and Capture buttons.'],
  ['New social sites caught', 'About 80 social sites are known. A new one (links like /@name/1234) is asked about once. Change any site in Settings › Hidden and approved sites › Social sites.'],
  ['The same account elsewhere', 'The Account tab shows the same photo posted on other platforms, accounts with the same name elsewhere, and quick links to look for the name. "Same person" joins accounts so stolen counts add up.'],
  ['Big searches keep going in the background', 'A search of many photos (like today\'s 50) slowed to a stop when its page was not on screen, and Keep searching then started its one-photo searches in the middle of it. The search now keeps its own clock, so it carries on while you work in other tabs or pages, and the browser may not put it to sleep. Keep searching waits until it has really finished. If its page is closed or reloaded halfway, opening it again carries on where it stopped.'],
  ['PageProof logo on every search tab', 'Some pinned search tabs showed the Yandex or Bing picture icon instead of the PageProof logo. The logo now goes on as soon as the tab opens and stays on. Search tabs that fail now close too (they used to stay as sleeping tabs, which lost the logo); the tab button on the results page opens that page again.'],
  ['No more matches on the same press wall', 'Two different shots in front of the same sponsor wall (the same logos printed over and over) could line up on the logos and show as a copy. The photo check now looks at what lines up: if it is only logos that repeat elsewhere on the wall, it is a different photo. Compare says "Different photo, same backdrop". Copies already in your list are not changed, so remove the wrong ones once.'],
  ['Missing pictures come back by themselves', 'After moving or reinstalling PageProof, Copies found showed the logo instead of the pictures. It now rebuilds them quietly in the background while Copies found is open: your client\'s photo from Google Drive, and their copy from its picture address or, if only the page link was kept, from the picture on their page that lines up with your photo. If nothing on their page lines up, the logo stays rather than a wrong picture. found-copies.txt now also keeps each copy\'s picture address, so a future reinstall gets them straight back.'],
  ['Folder list in Connect your photos shows again', 'In step 3 of Connect your photos the list of folders had shrunk to a tiny faint box, so there was nothing to tick. It is back to full size. And choosing the same top folder again (after a reinstall) now keeps the folders you had ticked instead of starting over. Pages also no longer wait for you to click somewhere else before showing what changed after you tick a box.'],
  ['Compare spots AI edits', 'After lining up, Compare draws a green line round the part that is your photo and tints red what was added or redrawn (a new object, changed faces, a headline). Turn it off with Show changes. Heavily edited copies get their own verdict, "Same photo, heavily edited", and the big number then only judges the part that was not painted over.'],
  ['Compare one face at a time', 'In Compare, click Pick a spot, then click a face or detail (or drag a box round it). PageProof cuts it from both pictures and scores it on its own, and says if it moved. Every spot goes in the PDF.'],
  ['Which shot did they use?', 'Took many shots of one scene? In Compare, click Check nearby shots and pick them all. PageProof lines each one up with the copy and puts the best one in box 1, or says when two are too close to call.'],
  ['A calmer details panel', 'The copy details panel now shows the pictures first, then a short "Look at these" list with only the things that need you. Everything else sits in four small tabs: Summary, Their page, Claim and Site. Stolen, Licensed, Remove, Skip and Undo stay pinned at the bottom, and Approve site and Hide site are in the More menu.'],
  ['Slide between the two pictures', 'Under the pictures, pick Side by side, Slider (drag across to compare) or Their page (a live look at their page). PageProof remembers your choice.'],
  ['Copies found at a glance', 'Number tiles at the top (New, Found today, Suspicious sites, Back online, Published in the last 3 months) filter the list with one click. Group, Found, Match and Sort are now small dropdowns on one line, and the other quick filters are under Filters.'],
  ['New columns, your choice', 'Rows now show a coloured Lines up bar, the Client, and a Damages column (Statutory, Register by a date, or Actual only). Small icons replace the coloured warning tags; hover one to read it. Pick the columns you want from the Columns menu. Group headings stay at the top while you scroll.'],
  ['Hidden countries work again', 'Copies from countries you hide (like France or Lithuania) are hidden again, and the Country column shows the country from the web address ending (.fr, .lt, .com.tr). Endings used all over the world, like .com, .io, .co, .tv, .me and .ai, never count as a country.'],
  ['The side panel shows again', 'The PageProof side panel (beside the page in Chrome and Edge) opened empty, because it borrowed a name from the main page\'s left menu and was slid out of sight on narrow screens. It now shows Capture this page, Photos on this page and Copies found again. If it ever can\'t load, it says why instead of staying blank.'],
  ['Home lines up', 'The boxes on Home now sit in the same three columns as the three big cards at the top, so every edge lines up. On a narrow window they stack in one column.'],
  ['One PageProof folder', 'PageProof can now live in the same folder as your saved work: the program goes in Documents › PageProof › Install, and your finds, settings and lists stay in Documents › PageProof. PageProof never writes inside Install, and it refuses that folder if you pick it by mistake. From this version PageProof also keeps the same ID wherever its folder is, so moving or reinstalling it no longer loses what is stored in the browser.'],
  ['Symbols in the right-click menu', 'Every PageProof item in the right-click menu now starts with a small symbol, like 📸 Capture this page or 🔍 Find copies of it, so you can tell them apart at a glance.'],
  ['A red dot instead of a number', 'The PageProof icon in the toolbar now shows a small red dot in its top-right corner when new copies are waiting, so the logo stays visible. Hover the icon to see how many.'],
  ['PageProof fills wide screens', 'Every page now uses the whole window. On a big screen the copy details panel is wider, the pictures on each Copies found row are bigger, each row shows Lines up, Use, Country and Found in lined-up columns, and Home spreads into three columns.'],
  ['Capture a copy, get the match report too', 'When you capture a copy\'s page from Copies found and save the evidence pack, the Evidence report PDF (the match PageProof found, side by side, with its Match ID) is saved next to it as its own file, with the same case number.'],
  ['Hover preview no longer gets stuck', 'The picture that pops up when you hover a row now always goes away when you move off it, scroll, click or change page.'],
  ['Keep searching lives in a pinned tab', 'No more separate window or taskbar icon: Keep searching now runs in a small pinned PageProof tab that stays awake and closes with the browser. If you close that tab, Home and Keep searching show "Keep searching is stopped" with a Start it again button.'],
  ['The Keep searching window closes with the browser', 'When you close your last browser window, the small Keep searching window closes too, so nothing is left in the taskbar. It opens again, minimised, with your next browser window.'],
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
  async () => `<div class="eyebrow" style="margin:0">Step 1 of 5</div><h2 style="font-size:24px">Welcome to PageProof</h2>
    <p class="muted" style="margin:0">Five quick steps. You can change everything later in Settings.</p>
    <label class="field" for="suName">Your name<input id="suName" placeholder="For example, Ben" value="${esc(await getName())}"></label>
    <p class="faint" style="margin:0;font-size:13px">It goes on every evidence pack and report as "Collected by".</p>`,
  async () => { const s = await RS_DOCS.state(); return `<div class="eyebrow" style="margin:0">Step 2 of 5</div><h2 style="font-size:24px">Where should PageProof keep its lists?</h2>
    <p class="muted" style="margin:0">Your hidden sites, copies found and settings are kept as small text files in Documents › PageProof, so they survive updates and reinstalls.</p>
    ${s === 'granted' ? `<span class="tag ok" style="align-self:flex-start">${ic('check', 13, 3)} Folder ready</span>${(state.backup = await FC.readBackup()) ? `<div class="banner info" style="padding:10px 12px"><span style="flex:1;font-size:14px"><b>Found your PageProof settings from ${fmtDate(state.backup.saved)}</b><br><span class="muted">Your name, clients, flags, countries shown and copies found. Bring them back?</span></span><button class="btn primary" data-act="surestore">Bring them back</button></div>` : ''}` : s === 'prompt' ? `<button class="btn primary" style="align-self:flex-start" data-act="docsallow">Allow PageProof to use it</button>` : `<button class="btn primary" style="align-self:flex-start" data-act="docschoose">Pick Documents</button><span class="faint" style="font-size:13px">In the window that opens, click Documents, then Select Folder. If Chrome says it can't use Documents, make a new folder called PageProof inside it and pick that.</span>`}`; },
  async () => { const h = await ppHardware(), L = h.limits; return `<div class="eyebrow" style="margin:0">Step 4 of 5</div><h2 style="font-size:24px">Checking your computer</h2><p class="muted" style="margin:0">So PageProof never slows it down. Nothing to do here.</p>
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
  ['home', 'Home', 'Your jobs for today, most urgent first, each with one button. When nothing needs you, it says All done.'],
  ['found', 'Copies found', 'Everything PageProof has found for your clients. The number shows new ones. Keep searching lives here too.'],
  ['clients', 'Clients', 'Pick which clients you search for, star the ones that matter most, and flag photos.'],
  ['library', 'Evidence', 'Every capture and evidence report, stolen copies that still need a capture, and the photo tools.'],
  ['settings', 'Settings', 'Your name, pop-ups, hidden sites, Is everything working, and how to keep PageProof beside every page.'],
]
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
  else if (a === 'docschoose') { try { await RS_DOCS.choose(); await RS_LISTS.load(); await RS_LISTS.save(); toast('PageProof folder ready'); } catch (e) { if (e.name === 'PhotosFolder' || e.name === 'InstallFolder') toast(e.message); else if (e.name !== 'AbortError') toast('Chrome refused that folder. Make a new folder called PageProof inside Documents and pick that.'); } render(true); }
  else if (a === 'docsallow') { await RS_DOCS.allow(); render(true); }
  else if (a === 'hidtab') { state.hidTab = v; state.hidQ = ''; state.hidMore = 0; render(true); }
  else if (a === 'hidkind') { state.hidKind = v; render(true); }
  else if (a === 'hidmore') { state.hidMore = (state.hidMore || 100) + 200; render(true); }
  else if (a === 'hidadd') {
    const kind = state.hidTab;
    const s = RS_SITE.tidy(state.hidQ);
    if (!s) return toast('Type a site like patch.com, x.com/examplenews or .gov');
    if (kind === 'hidden' && RS_LISTS.wholeSocial(s)) return toast('A whole social site can\'t be hidden. Type an account instead, like ' + s + '/examplenews');
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
    } else if (state.hidTab === 'stolen') {
      await RS_STOLEN.load(); RS_STOLEN.items = RS_STOLEN.items.filter(x => x !== v); await RS_STOLEN.save();
      toast('Taken off the stolen before list', async () => { await RS_STOLEN.load(); RS_STOLEN.items.push(v); await RS_STOLEN.save(); render(true); });
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
    const kind = state.hidTab === 'allowed' ? 'allowed' : state.hidTab === 'stolen' ? 'stolen' : 'hidden';
    if (kind === 'stolen') await RS_STOLEN.load();
    const a2 = document.createElement('a');
    a2.href = URL.createObjectURL(new Blob([kind === 'stolen' ? RS_STOLEN.text() : RS_LISTS.text(kind)], { type: 'text/plain' }));
    a2.download = kind === 'stolen' ? RS_STOLEN.FILE : RS_LISTS.FILES[kind]; a2.click();
  }
  else if (a === 'hidload') document.getElementById('hidLoad').click();
  else if (a === 'hidunload') document.getElementById('hidUnload').click();
  else if (a === 'impundo') {
    const l = await RS_IMPORTS.all(), e = l.find(x => x.id === v);
    if (!e) return;
    const out = (e.op === 'add') === !e.undone;
    const n = await RS_IMPORTS.toggle(v);
    toast((out ? 'Took out ' : 'Put back ') + n.toLocaleString() + ' sites from ' + e.name, async () => { await RS_IMPORTS.toggle(v); render(true); });
    render(true);
  }
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
  FC.mergeSamePages().then(n => { if (n) { toast(plural(n, 'copy was', 'copies were') + ' the same page as another copy (phone version or tracking bits on the address), so they are now one row each.'); render(true); } }).catch(e => console.warn('PageProof: same pages', e));
  FC.dropDotMatches().then(n => { if (n) { toast(plural(n, 'wrong match was', 'wrong matches were') + ' moved to Removed (the photo check had scored them too high). Put back is still there.'); render(true); } }).catch(e => console.warn('PageProof: wrong matches', e));
});
