// The 4.2 look: the top bar (search, Undo with its list, light/dark, Capture), the small
// "Searching now" card in the menu, the Tools page, the ⋯ menu on each copy, and the picture
// of their page in the copy details panel.

// ---------------------------------------------------------------- top bar
const $id = id => document.getElementById(id);
function ppTopBar() {
  const u = $id('undoBtn');
  if (!u) return;
  const n = typeof HIST === 'undefined' ? 0 : HIST.length;
  u.disabled = !n;
  u.innerHTML = `${ic('undo', 16)} Undo${n > 1 ? ` <span class="caret-d" data-undolist="1" title="Your last answers">▾</span>` : ''}`;
  u.title = n ? 'Undo: ' + HIST[n - 1].label + ' (U)' : 'Nothing to undo yet';
  const s = $id('ppSearch');
  if (s && document.activeElement !== s && s.value !== (state.fq || '')) s.value = state.fq || '';
}
function undoMenu(show) {
  const m = $id('undoMenu');
  if (!show || !HIST.length) { m.hidden = true; return; }
  const last = HIST.slice(-10).map((h, i, a) => [h, HIST.length - a.length + i]).reverse();
  m.innerHTML = `<small>Your last ${last.length === 1 ? 'answer' : last.length + ' answers'}</small>` +
    last.map(([h, i]) => `<button data-undo="${i}"><span>${esc(h.label)}</span><b>Undo</b></button>`).join('');
  m.hidden = false;
}
// Take back one answer from the list, wherever it is in the list.
async function undoAt(i) {
  const h = HIST[i];
  if (!h) return;
  HIST.splice(i, 1);
  await h.undo();
  if (typeof dropFC === 'function') dropFC();
  toast('Undone: ' + h.label + '.');
  render(true);
}
document.addEventListener('DOMContentLoaded', () => {
  $id('topSearchIc').innerHTML = ic('find', 16);
  $id('capBtn').innerHTML = `${ic('cam', 16)}<span>Capture a page</span>`;
  $id('undoBtn').addEventListener('click', e => {
    if (e.target.closest('[data-undolist]')) { undoMenu($id('undoMenu').hidden); return; }
    undoMenu(false); undoLast();
  });
  $id('undoMenu').addEventListener('click', e => { const b = e.target.closest('[data-undo]'); if (b) { undoMenu(false); undoAt(+b.dataset.undo); } });
  let t = null;
  $id('ppSearch').addEventListener('input', e => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.fq = e.target.value.trim().toLowerCase(); state.more = 250; state.open = '';
      if (state.fq && state.fFilter === 'New') state.fFilter = 'All';   // a search looks at every copy, answered or not
      if (route() !== 'found') location.hash = 'found'; else render(true);
    }, 220);
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.undo-wrap')) undoMenu(false);
    if (!e.target.closest('.tmenu') && !e.target.closest('[data-act="rowmenu"],[data-act="stripok"],[data-act="dmore"]')) closeRowMenu();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { undoMenu(false); closeRowMenu(); } });
});

// ---------------------------------------------------------------- "Searching now" in the menu
let SIDE_LIVE = '';
async function ppSideLive() {
  const el = $id('sideLive');
  if (!el) return;
  el.innerHTML = SIDE_LIVE;
  try {
    const d = await FC.drive();
    if (!d.done) { SIDE_LIVE = ''; el.innerHTML = ''; return; }
    const [k, st] = [await FC.keep(), await api.storage.local.get(['fcStatus', 'fcPause', 'fcToday'])];
    const alive = st.fcStatus && Date.now() - st.fcStatus.beat < 90000;
    const today = st.fcToday && st.fcToday.day === new Date().toDateString() ? st.fcToday : { searched: 0, found: 0 };
    const [label, on] = !k.on ? ['Keep searching is off', 0] : st.fcPause ? ['Search paused', 0] : alive && st.fcStatus.state === 'running' ? ['Searching now', 1] : alive ? ['Keep searching is on', 1] : ['Keep searching is on', 1];
    SIDE_LIVE = `<a class="sidelive" href="#keep"><b><span class="ldot${on ? ' on' : ''}"></span>${label}</b><span>${today.searched} ${today.searched === 1 ? 'photo' : 'photos'} searched today${today.found ? ', ' + today.found + ' new' : ''}</span></a>`;
    const now = $id('sideLive'); if (now) now.innerHTML = SIDE_LIVE;
  } catch (e) { /* nothing to show yet */ }
}

// ---------------------------------------------------------------- Tools
V.tools = async () => {
  const T = [
    ['Capture and prove', [
      ['capture', 'cam', 'Capture a page', 'Save a whole web page as an evidence pack.'],
      ['verify', 'verify', 'Verify a pack', 'Show that a pack has not been changed.'],
      ['library', 'library', 'Evidence library', 'Every capture and report you have made.'],
      ['weekly', 'doc', 'Weekly summary', 'What was searched, found and answered each week.'],
    ]],
    ['Look closer at a photo', [
      ['inspect', 'eye', 'Inspect a photo', 'Read the hidden data inside any photo.'],
      ['compare', 'layers', 'Compare two photos', 'Lay a copy over the original.'],
      ['markup', 'pen', 'Mark up a copy', 'Highlight, box and arrow on a capture.'],
      ['files', 'swap', 'Convert files', 'Turn photos and documents into PDF or JPG.'],
      ['openfiles', 'files', 'Open odd files', 'View files your computer cannot open.'],
    ]],
    ['Find copies', [
      ['search', 'find', 'New search', 'Search a few photos right now.'],
      ['searches', 'loop', 'All searches', 'Every search you have run.'],
      ['skipped', 'flag', 'Skipped photos', 'Photos the search could not use, and why.'],
      ['bnsave', 'down', 'Save a Breaking News photo', 'Name it the firm\'s way and check if it is new or recycled.'],
      ['owners', 'owner', 'Site owners', 'Sites that belong to one company.'],
      ['hidden', 'ban', 'Hidden and approved sites', 'Sites you never want, and sites that are allowed.'],
      ['health', 'check', 'Is everything working?', 'Lights for each part, and updates.'],
    ]],
  ];
  return `${head('', 'Tools', 'Everything else PageProof can do, in one place.')}
  ${T.map(([g, items]) => `<section class="toolsec"><h2>${g}</h2><div class="toolgrid">${items.map(([r, i, t, d]) => `<a class="card tool" href="#${r}"><span class="ic">${ic(i, 20)}</span><b>${t}</b><span>${d}</span></a>`).join('')}</div></section>`).join('')}`;
};

// ---------------------------------------------------------------- the ⋯ menu on a copy
function closeRowMenu() { const m = $id('rowMenu'); if (m) m.remove(); }
function openRowMenu(el, html) {
  closeRowMenu();
  const m = document.createElement('div');
  m.className = 'tmenu rowmenu'; m.id = 'rowMenu'; m.setAttribute('role', 'menu'); m.innerHTML = html;
  document.body.appendChild(m);
  const r = el.getBoundingClientRect(), h = m.offsetHeight, w = m.offsetWidth;
  m.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px';
  m.style.top = (r.bottom + h + 8 > innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + 'px';
}
document.addEventListener('scroll', closeRowMenu, true);

// ---------------------------------------------------------------- a picture of their page
// The copy details panel shows their page in a small window (a live view, about 3 times
// smaller), then keeps one small picture of it (about 30 KB) so it is there next time even if
// the page changes. Websites normally refuse to be shown inside another page; for the PageProof
// tab only, that refusal is taken off, and the small window can't open pop-ups or leave.
const PAGE_RULE = 9142;
let pageRuleOn = false;
async function allowFraming() {
  if (pageRuleOn) return true;
  try {
    const tab = await api.tabs.getCurrent();
    await api.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [PAGE_RULE],
      addRules: [{ id: PAGE_RULE, priority: 1,
        action: { type: 'modifyHeaders', responseHeaders: ['x-frame-options', 'content-security-policy', 'content-security-policy-report-only'].map(h => ({ header: h, operation: 'remove' })) },
        condition: { resourceTypes: ['sub_frame'], tabIds: [tab.id] } }],
    });
    pageRuleOn = true;
  } catch (e) { pageRuleOn = false; }
  return pageRuleOn;
}
const pageAuto = async () => (await api.storage.local.get('fcPageAuto')).fcPageAuto !== false;
function pageBoxHtml(c) {
  return `<section class="dsec"><div class="dsh">Their page</div><div class="pgbox" id="pgbox" data-id="${esc(c.id)}"><div class="pgwait">Looking for a saved picture…</div></div></section>`;
}
let pageBusy = '';
async function ppPagePic(force) {
  const box = $id('pgbox');
  if (!box || typeof FCD === 'undefined' || !FCD) return;
  const id = box.dataset.id, c = FCD.copies.find(x => x.id === id);
  if (!c) return;
  const saved = force ? null : await FC.pages.get(id).catch(() => null);
  if ($id('pgbox') !== box) return;                       // the panel moved on while we looked
  const auto = await pageAuto();
  const foot = more => `<div class="pgfoot"><span class="faint">${more}</span><label class="pgauto"><input type="checkbox" data-act="pageauto" ${auto ? 'checked' : ''}> Show pages by themselves</label></div>`;
  if (saved && saved.pic) {
    box.innerHTML = `<a class="pgshot" href="${safeUrl(c.url)}" target="_blank" rel="noreferrer" title="Open the page"><img src="${safeImg(saved.pic)}" alt="A picture of their page"></a>${foot('Picture taken ' + shortDate(saved.at) + ' · <button class="linkbtn" data-act="pageagain">Take again</button>')}`;
    return;
  }
  if (!auto && !force) { box.innerHTML = `<button class="btn" data-act="pageagain" style="align-self:flex-start">${ic('eye', 16)} Show their page</button>${foot('Loads the page in a small window here and keeps a small picture of it.')}`; return; }
  if (!/^https?:/i.test(c.url || '')) { box.innerHTML = '<div class="pgwait">This copy has no page link.</div>'; return; }
  if (!(await allowFraming())) { box.innerHTML = `<div class="pgwait">Your browser can't show pages here. <a href="${safeUrl(c.url)}" target="_blank" rel="noreferrer">Open the page</a> instead.</div>`; return; }
  if ($id('pgbox') !== box) return;
  pageBusy = id;
  box.innerHTML = `<div class="pglive"><iframe id="pgframe" sandbox="allow-scripts allow-same-origin allow-forms" referrerpolicy="no-referrer" loading="eager" title="Their page, live" src="${safeUrl(c.url)}"></iframe><div class="pgcover" id="pgcover">Loading their page…</div></div>${foot('This is their page, live. Scroll inside it to look around.')}`;
  const f = $id('pgframe'), live = box.querySelector('.pglive');
  const scale = live.clientWidth / 1280;
  f.style.transform = `scale(${scale})`; live.style.height = Math.round(800 * scale) + 'px';
  let done = false;
  const giveUp = setTimeout(() => { if (!done && $id('pgframe') === f) { $id('pgcover').innerHTML = 'Still loading. Some sites are slow, or will not show here.'; } }, 20000);
  f.addEventListener('load', () => {
    if ($id('pgframe') !== f) return;
    const cover = $id('pgcover'); if (cover) cover.remove();
    // Give pictures on their page a moment, then keep one small picture of it.
    setTimeout(async () => {
      if (done || $id('pgframe') !== f || document.hidden) return;
      done = true; clearTimeout(giveUp);
      try {
        const pic = await snapFrame(f);
        if (pic) await FC.pages.put(id, { pic, at: new Date().toISOString() });
      } catch (e) { /* the live view is still there */ }
      if (pageBusy === id) pageBusy = '';
    }, 2500);
  }, { once: true });
}
// A picture of what the small window shows: a photo of the PageProof tab, cut to the window.
async function snapFrame(f) {
  const r = f.getBoundingClientRect();
  if (r.width < 40 || r.top < 0 || r.bottom > innerHeight + 1 || r.right > innerWidth + 1) return '';   // not fully on screen
  const shot = await api.tabs.captureVisibleTab({ format: 'jpeg', quality: 80 });
  const img = await createImageBitmap(await (await fetch(shot)).blob());
  const k = img.width / innerWidth;
  const w = 640, h = Math.round(w * r.height / r.width);
  const cv = new OffscreenCanvas(w, h);
  cv.getContext('2d').drawImage(img, r.left * k, r.top * k, r.width * k, r.height * k, 0, 0, w, h);
  img.close && img.close();
  const blob = await cv.convertToBlob({ type: 'image/jpeg', quality: 0.62 });
  return new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(''); fr.readAsDataURL(blob); });
}
Object.assign(ACTS, {
  pageagain: () => ppPagePic(true),
  pageauto: async (v, el) => { await api.storage.local.set({ fcPageAuto: !!el.checked }); if (el.checked) ppPagePic(); },
});

// Their copy, kept from the moment it was found.
function keptBoxHtml(c) { return `<div class="keptline" id="keptline" data-id="${esc(c.id)}"></div>`; }
async function ppKeptLine() {
  const el = $id('keptline');
  if (!el) return;
  const k = await FC.kept.get(el.dataset.id).catch(() => null);
  if ($id('keptline') !== el) return;
  const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  el.innerHTML = k ? `<span class="tag ok">Their copy is kept</span><span class="muted">Saved ${shortDate(k.at)} · ${kb(k.size)}</span><button class="linkbtn" data-act="keptsave" data-v="${esc(el.dataset.id)}">Download it</button><span class="faint mono" title="SHA-256 fingerprint of the kept file">${esc(k.sha.slice(0, 16))}…</span>`
    : `<span class="muted">Their copy isn't kept yet.</span><button class="linkbtn" data-act="keptnow" data-v="${esc(el.dataset.id)}">Keep it now</button>`;
}
Object.assign(ACTS, {
  keptnow: async v => {
    const c = FCD && FCD.copies.find(x => x.id === v);
    toast('Downloading their copy…');
    const ok = c && await FC.keepOriginal(c);
    toast(ok ? 'Their copy is kept on this computer.' : 'Their site would not give the photo. The small preview is still kept.');
    ppKeptLine();
  },
  keptsave: async v => {
    const k = await FC.kept.get(v);
    if (!k) return;
    const c = FCD && FCD.copies.find(x => x.id === v);
    const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' })[k.type] || 'jpg';
    const a = document.createElement('a'); a.href = URL.createObjectURL(k.blob);
    a.download = 'their-copy_' + String(c ? c.site : 'site').replace(/[^a-z0-9.-]+/gi, '_') + '_' + k.sha.slice(0, 8) + '.' + ext; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  },
});
// Once a day: tidy kept pictures of copies removed more than a week ago.
document.addEventListener('DOMContentLoaded', () => setTimeout(async () => {
  try {
    const last = (await api.storage.local.get('fcPruned')).fcPruned || 0;
    if (Date.now() - last > 864e5) { await FC.pruneKept(); await api.storage.local.set({ fcPruned: Date.now() }); }
  } catch (e) { /* next time */ }
}, 15000));
