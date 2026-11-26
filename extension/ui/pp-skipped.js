// Clients › Skipped photos in the calm look (step 13): app.html#skipped
// Four reason cards (click one to filter), a command bar, client folds, tick boxes with a floating
// bar and a panel per photo. Everything here only reads: nothing in Google Drive is ever changed.
// "Take off this list" removes the row from PageProof's own list, never the file.
const SKI = (() => {
  const s = (p, z = 16) => `<svg viewBox="0 0 16 16" width="${z}" height="${z}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  return {
    retry: s('<path d="M13 8a5 5 0 1 1-1.5-3.6"/><path d="M13 2.5v3h-3"/>'),
    type: s('<path d="M4 1.8h5.5L12.5 5v9.2H4z"/><path d="M9.5 1.8V5h3"/><path d="m6.2 8.2 3.6 3.6M9.8 8.2l-3.6 3.6"/>'),
    gone: s('<path d="M4 1.8h5.5L12.5 5v9.2H4z" stroke-dasharray="2 1.6"/><path d="M7 9.2a1.4 1.4 0 1 1 1.8 1.3c-.5.2-.8.5-.8 1v.3M8 13.2v.1"/>'),
    empty: s('<path d="M4 1.8h5.5L12.5 5v9.2H4z"/><path d="M9.5 1.8V5h3"/><circle cx="8.2" cy="10" r="2"/>'),
    broken: s('<rect x="2" y="3" width="12" height="10" rx="1.2"/><path d="m2.5 11 3.2-3.2 2 2M9 3l-1.5 3.2L10 8l-1.6 5"/>'),
    dl: s('<path d="M8 2v8.5M4.5 7 8 10.5 11.5 7M2.5 13.5h11"/>'),
    copy: s('<rect x="5" y="5" width="8.5" height="9" rx="1"/><path d="M3 11V3a1 1 0 0 1 1-1h6"/>'),
    folder: s('<path d="M1.8 4a1 1 0 0 1 1-1h3.4l1.4 1.6h5.6a1 1 0 0 1 1 1v6.9a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1z"/>'),
    hide: s('<path d="M2 2l12 12M6.6 6.7a2 2 0 0 0 2.7 2.7M4.2 4.4C2.9 5.3 2 6.6 1.6 8c1 3 3.6 4.8 6.4 4.8 1.2 0 2.4-.3 3.4-1M8 3.2c2.8 0 5.4 1.8 6.4 4.8-.3.9-.8 1.7-1.4 2.4"/>'),
    check: s('<path d="m3 8.5 3.2 3L13 4.5"/>'),
    chev: s('<path d="m6 3.5 4.5 4.5L6 12.5"/>', 14),
    down: s('<path d="m3.5 6 4.5 4.5L12.5 6"/>', 14),
    lock: s('<rect x="3.5" y="7" width="9" height="7" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>', 14),
    x: s('<path d="M4 4l8 8M12 4l-8 8"/>'),
  };
})();
// The four reasons, in plain words. b = can be tried again.
const SK_KIND = {
  type: { n: 'TIFF or HEIC', c: KC.purple, i: SKI.type, t: 'Too big, or an unusual kind, for PageProof to read, so they are left out of searching. Nothing in Drive is changed.', low: 'TIFF or HEIC' },
  gone: { n: 'Moved or deleted', c: KC.red, i: SKI.gone, t: 'No longer in that Drive folder. It was moved, renamed or deleted.', b: 1, low: 'moved or deleted' },
  empty: { n: 'Empty file', c: KC.amber, i: SKI.empty, t: '0 bytes. Google Drive may still have been uploading it.', b: 1, low: 'empty' },
  broken: { n: 'Won\'t open', c: KC.grey, i: SKI.broken, t: 'Would not open as a picture. Damaged, or not really a photo.', b: 1, low: 'won\'t open' },
};
const SK_STEPS = {
  type: [['Nothing to do.', 'PageProof reads most TIFF and HEIC photos by itself. This one is too big or an unusual kind, so it is left out.'], ['The client\'s other photos are searched as usual.', 'Only this file is left out.'], ['Don\'t want to see it here?', 'Take it off this list. The file stays where it is.']],
  gone: [['Look in the client\'s folder.', 'It may have been renamed or moved to another folder.'], ['Found it somewhere else?', 'PageProof picks it up on its next look for new photos, under its new name.'], ['Gone for good?', 'Take it off this list so it stops showing.']],
  empty: [['Wait for Google Drive.', 'A file that is still uploading shows as empty for a while.'], ['Try again.', 'Once Drive has the whole file it opens and goes to the line.'], ['Still empty after a day?', 'The upload failed. Whoever added it can upload it again.']],
  broken: [['Open the file yourself.', 'If your computer can\'t open it either, the file is damaged.'], ['Opens fine for you?', 'Press Try again now. Drive may have been busy.'], ['Not really a photo?', 'Take it off this list so it stops showing.']],
};
Object.assign(state, { skF: '', skQ: '', skGroup: 'client', skSort: 'new', skOpen: null, skAll: {}, skSel: [], skPan: '', skClient: '' });
const skExt = n => (/\.([a-z0-9]+)$/i.exec(n || '') || [0, '?'])[1].toUpperCase().replace('JPEG', 'JPG').replace('TIFF', 'TIF').slice(0, 4);
const skFolder = (id, all) => String(id).replace(/^d:\+?/, '').split('/').slice(all ? 0 : 1, -1).join(' › ');
const skAgo = iso => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); if (isNaN(m)) return ''; if (m < 2) return 'Just now'; if (m < 60) return m + ' min ago'; const h = Math.round(m / 60); if (h < 24) return h + ' h ago'; const d = Math.round(h / 24); if (d === 1) return 'Yesterday'; if (d < 14) return d + ' days ago'; if (d < 60) return Math.round(d / 7) + ' weeks ago'; return Math.round(d / 30) + ' months ago'; };
const skDay = (iso, add = 0) => { const t = Date.parse(iso); return isNaN(t) ? '' : new Date(t + add * 864e5).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }); };
const skWhy = (k, n) => `<span class="skrs" style="--c:${SK_KIND[k].c}"><i></i>${n == null ? SK_KIND[k].n : n + ' ' + SK_KIND[k].low}</span>`;
// The rows on screen: reason card, client chip and the find box all narrow the list.
function skRows(all) {
  const q = state.skQ.trim().toLowerCase();
  const rows = all.filter(x => SK_KIND[x[3]] && (!state.skF || x[3] === state.skF) && (!state.skClient || (x[2] || '') === state.skClient)
    && (!q || (x[1] + ' ' + x[2] + ' ' + skFolder(x[0], 1)).toLowerCase().includes(q)));
  const by = { new: (a, b) => String(b[4]).localeCompare(String(a[4])), old: (a, b) => String(a[4]).localeCompare(String(b[4])), name: (a, b) => String(a[1]).localeCompare(String(b[1])) }[state.skSort];
  return rows.sort(by);
}
function skPanel(x) {
  const o = SK_KIND[x[3]];
  return `<aside class="cpanel skpanel" id="skipPanel" aria-label="${esc(x[1])}"><div class="cph"><span class="skft big" style="--c:${o.c}">${esc(skExt(x[1]))}</span><span class="kn1"><b title="${esc(x[1])}">${esc(x[1])}</b><span>${esc(x[2] || 'Client unknown')}</span></span><span class="sp"></span><button class="kx" data-act="skpan" data-v="" aria-label="Close" title="Close">✕</button></div>
    <div class="skwhy" style="--c:${o.c}">${kSq(o.c, o.i, 36)}<div><b>${o.n}</b><span>${o.t}</span></div></div>
    <div class="kh3">What to do</div>
    <ol class="sksteps">${SK_STEPS[x[3]].map(([b, t]) => `<li><b>${b}</b><span>${t}</span></li>`).join('')}</ol>
    <div class="kh3">Details</div>
    <div class="skdl" id="skipFacts"><span>Client</span><b>${esc(x[2] || 'Client unknown')}</b><span>Folder</span><b>${esc(skFolder(x[0], 1))}</b><span>Skipped</span><b>${esc(skDay(x[4]))} · ${esc(skAgo(x[4]).toLowerCase())}</b><span>Next try by itself</span><b>${o.b ? esc(skDay(x[4], 90)) : 'Not tried again'}</b></div>
    <div class="skpb">${o.b ? `<button class="btn kbtn primary" data-act="skretry" data-v="${esc(x[0])}">${SKI.retry}Try again now</button>` : ''}<button class="btn kbtn" data-act="skpath" data-v="${esc(x[0])}">${SKI.copy}Copy folder path</button><button class="btn kbtn" data-act="skoff" data-v="${esc(x[0])}">${SKI.hide}Take off this list</button></div></aside>`;
}
V.skipped = async () => {
  const all = (await FC.skipped()).filter(x => SK_KIND[x[3]]);
  if (!routeArg('client')) state.skArg = '';
  if (routeArg('client') && state.skArg !== routeArg('client')) { state.skArg = state.skClient = routeArg('client'); state.skF = ''; state.skQ = ''; }
  const kinds = {}; for (const x of all) kinds[x[3]] = (kinds[x[3]] || 0) + 1;
  if (state.skF && !kinds[state.skF]) state.skF = '';
  if (state.skClient && !all.some(x => (x[2] || '') === state.skClient)) state.skClient = '';
  const rows = skRows(all), ids = new Set(all.map(x => x[0]));
  state.skSel = state.skSel.filter(id => ids.has(id));
  if (!ids.has(state.skPan)) state.skPan = '';
  const canRetry = rows.filter(x => SK_KIND[x[3]].b).length;
  const pri = new Set((await FC.DB.all('clients')).filter(c => c.priority).map(c => c.name));
  const flat = state.skGroup === 'none';

  const card = k => { const o = SK_KIND[k], n = kinds[k] || 0;
    if (k === 'type' && !n) return `<div class="skc ok" id="skipCard-type">${kSq(KC.green, SKI.check, 40)}<span class="skcm"><b>TIFF and HEIC</b><span class="skct">PageProof reads these itself. Read only: nothing in Drive changes and no copy is saved.</span></span><span class="skcn ok">${SKI.check}</span></div>`;
    return `<button class="skc${state.skF === k ? ' on' : ''}${n ? '' : ' zero'}" id="skipCard-${k}" data-act="skfilter" data-v="${k}" aria-pressed="${state.skF === k}"${n ? '' : ' disabled'}>${kSq(o.c, o.i, 40)}<span class="skcm"><b>${o.n}</b><span class="skct">${o.t}</span><span class="skcb">${!n ? '<span class="kfaint">None right now</span>' : o.b ? `<span class="btn kbtn sm" role="button" tabindex="0" data-act="skretrykind" data-v="${k}">${SKI.retry}Try these again</span>` : '<span class="kfaint">Left out of searches</span>'}</span></span><span class="skcn num">${n.toLocaleString()}</span></button>`; };
  const cards = `<div class="skcards" id="skipCards">${Object.keys(SK_KIND).map(card).join('')}</div>`;

  const chip = (t, act) => `<span class="skfil">${esc(t)} <button class="kx" data-act="${act}" data-v="" aria-label="Clear ${esc(t)}" title="Clear">✕</button></span>`;
  const cmd = `<div class="clcmd skcmd" id="skipCmd"><label class="ksearch">${KI.search}<input type="search" id="skQ" placeholder="Find a photo, folder or client" aria-label="Find a photo, folder or client" value="${esc(state.skQ)}"></label>
    ${state.skF ? chip(SK_KIND[state.skF].n, 'skfilter') : ''}${state.skClient ? chip(state.skClient, 'skclient') : ''}${!state.skF && !state.skClient ? `<span class="kfaint skall">All reasons · <b class="num">${all.length.toLocaleString()}</b> ${all.length === 1 ? 'photo' : 'photos'}</span>` : ''}
    <span class="sp"></span>
    <label class="ksort"><select data-act="skgroup" aria-label="Group">${[['client', 'Group: By client'], ['none', 'Group: None']].map(([k, l]) => `<option value="${k}" ${state.skGroup === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="ksort"><select data-act="sksort" aria-label="Sort">${[['new', 'Newest first'], ['old', 'Oldest first'], ['name', 'File name A to Z']].map(([k, l]) => `<option value="${k}" ${state.skSort === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <button class="clcb" data-act="skcsv" title="Save this list as a spreadsheet file (CSV) in your Downloads folder">${SKI.dl}<span>Download list</span></button>
    ${canRetry ? `<button class="clcb accb" id="skipRetryAll" data-act="skretryall">${SKI.retry}<span>Try all ${canRetry.toLocaleString()} again</span></button>` : ''}</div>`;

  const tick = x => !SK_KIND[x[3]].b ? `<span class="skck lock" title="Left out of searches. PageProof can't read this file.">${SKI.lock}</span>`
    : `<input type="checkbox" class="skpick" data-act="skpick" data-v="${esc(x[0])}" ${state.skSel.includes(x[0]) ? 'checked' : ''} aria-label="Pick ${esc(x[1])}">`;
  const prow = x => { const o = SK_KIND[x[3]], f = skFolder(x[0]);
    return `<div class="skr${state.skPan === x[0] ? ' sel' : ''}${state.skSel.includes(x[0]) ? ' tk' : ''}${flat ? ' flat' : ''}" data-act="skpan" data-v="${esc(x[0])}" data-id="${esc(x[0])}" data-kind="${x[3]}">${tick(x)}<span class="skft" style="--c:${o.c}">${esc(skExt(x[1]))}</span>
      <span class="kn1"><b title="${esc(x[1])}">${esc(x[1])}</b><span title="${esc(f)}">${SKI.folder} ${esc(f || 'Top of the client folder')}</span></span>
      ${flat ? `<span class="skcl">${x[2] ? kAv(x[2]) : '<span class="kav unk">?</span>'}<span>${esc(x[2] || 'Client unknown')}</span></span>` : ''}
      ${skWhy(x[3])}<span class="skwh" title="${esc(fmtDate(x[4]))}">${esc(skAgo(x[4]))}</span>
      <span class="skra">${o.b ? `<button class="klink" data-act="skretry" data-v="${esc(x[0])}">${SKI.retry}Try again</button>` : '<span class="kfaint">Left out</span>'}</span>${SKI.chev}</div>`; };
  const hd = `<div class="skhd${flat ? ' flat' : ''}"><span></span><span></span><span>Photo and folder</span>${flat ? '<span>Client</span>' : ''}<span>Why</span><span>Skipped</span><span></span><span></span></div>`;

  let list;
  if (!rows.length) list = `<section class="card sklist" id="skipList"><p class="kmuted" id="skipNone" style="padding:28px 0;text-align:center;margin:0">Nothing here matches. <button class="klink" data-act="skclear">Show all skipped photos</button></p></section>`;
  else if (flat) { const shown = rows.slice(0, state.skMore);
    list = `<section class="card sklist" id="skipList">${hd}${shown.map(prow).join('')}${rows.length > shown.length ? `<div class="skmore"><button class="btn kbtn" data-act="skmore">Show ${Math.min(200, rows.length - shown.length)} more</button></div>` : ''}</section>`;
  } else {
    const by = new Map(); for (const x of rows) { const k = x[2] || ''; if (!by.has(k)) by.set(k, []); by.get(k).push(x); }
    const groups = [...by.entries()].sort((a, b) => (pri.has(b[0]) - pri.has(a[0])) || b[1].length - a[1].length || a[0].localeCompare(b[0]));
    if (!state.skOpen) state.skOpen = Object.fromEntries(groups.slice(0, 2).map(g => [g[0], 1]));
    const panC = state.skPan ? (all.find(x => x[0] === state.skPan) || [])[2] || '' : null;
    list = `<section class="card sklist" id="skipList">${groups.map(([c, xs]) => { const op = !!state.skOpen[c] || panC === c || !!state.skClient || !!state.skQ.trim() || groups.length === 1;
      const kc = {}; for (const x of xs) kc[x[3]] = (kc[x[3]] || 0) + 1; const rt = xs.filter(x => SK_KIND[x[3]].b).length, n = state.skAll[c] ? xs.length : 6;
      return `<div class="skg${op ? ' open' : ''}" data-client="${esc(c)}"><div class="skgh" data-act="skfold" data-v="${esc(c)}" role="button" tabindex="0" aria-expanded="${op}"><span class="skgc">${op ? SKI.down : SKI.chev}</span>${c ? kAv(c).replace('class="kav"', 'class="kav big"') : '<span class="kav big unk">?</span>'}<span class="kn1"><b>${pri.has(c) ? '<span class="skstar" title="Priority client">★</span> ' : ''}${esc(c || 'Client unknown')}</b></span>
        <span class="skgk">${Object.keys(SK_KIND).filter(k => kc[k]).map(k => skWhy(k, kc[k])).join('')}</span>
        <span class="skgn num">${plural(xs.length, 'photo')}</span><span class="skgb">${rt ? `<button class="klink" data-act="skretryclient" data-v="${esc(c)}">${SKI.retry}Try ${rt.toLocaleString()} again</button>` : ''}</span></div>
        ${op ? `<div class="skgb2">${hd}${xs.slice(0, n).map(prow).join('')}${xs.length > n ? `<div class="skmore"><button class="klink" data-act="skallof" data-v="${esc(c)}">Show all ${xs.length.toLocaleString()} from this client</button></div>` : ''}</div>` : ''}</div>`; }).join('')}</section>`;
  }
  const nSel = state.skSel.length;
  const bar = nSel ? `<div class="clfloat" id="skipBulk"><b>${nSel} picked</b><span class="clsep"></span>${clBtn(SKI.retry, 'Try again', 'skbulk', 'retry', 'accb')}${clBtn(SKI.copy, 'Copy folder paths', 'skbulk', 'paths')}${clBtn(SKI.hide, 'Take off this list', 'skbulk', 'off')}<span class="clsep"></span>${clBtn(SKI.x, 'Clear', 'skbulk', 'clear')}</div>` : '';
  const foot = `<p class="kfoot skfoot" id="skipFoot">${KI.clock}<span>Moved, empty and won't-open photos are tried again by themselves 3 months after they were skipped. Showing ${rows.length.toLocaleString()} of ${all.length.toLocaleString()}${all.length >= 5000 ? ' (the newest 5,000 are kept)' : ''}.</span></p>`;
  const none = `<section class="card skempty" id="skipEmpty"><span class="skok">${SKI.check}</span><h2>No skipped photos</h2><p class="kmuted">Every photo PageProof has tried so far could be opened and searched.</p><div class="skel">${Object.keys(SK_KIND).map(k => skWhy(k, 0)).join('')}</div></section>`;
  const pan = state.skPan ? all.find(x => x[0] === state.skPan) : null, panel = pan ? skPanel(pan) : '';
  document.body.classList.toggle('cpopen', !!panel);
  return head('Clients', 'Skipped photos', '') + (await driveBanner()) + `<div class="rvn kpn crn skn${panel ? ' withpanel' : ''}">${all.length ? cards + cmd + list + foot : none}</div>${bar}${panel}`;
};
V.skipped.guard = async () => ((await FC.drive()).done ? null : 'connect');
V.skipped.after = () => { clKeepFocus('skQ', v => { state.skQ = v; state.skMore = 100; }); };
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || state.shown !== 'skipped' || /^(INPUT|SELECT|TEXTAREA)$/.test((e.target || {}).tagName || '')) return;
  if (state.skPan) { state.skPan = ''; render(true); }
});
// Try again, with a plain message. ids = null means every row that can be tried again.
async function skRetry(ids) {
  const all = await FC.skipped(), can = new Set(all.filter(x => SK_KIND[x[3]] && SK_KIND[x[3]].b).map(x => x[0]));
  const want = (ids || [...can]).filter(id => can.has(id));
  const n = want.length ? await FC.retrySkipped(want) : 0;
  state.skSel = state.skSel.filter(id => !want.includes(id));
  if (want.includes(state.skPan)) state.skPan = '';
  toast(n ? plural(n, 'photo goes', 'photos go') + ' to the front of the line.' : 'Nothing to try again.');
  render(true);
}
// Take off this list: only PageProof's own list changes. Undo puts the rows back.
async function skOff(ids) {
  const gone = await FC.skipTakeOff(ids);
  state.skSel = state.skSel.filter(id => !ids.includes(id));
  if (ids.includes(state.skPan)) state.skPan = '';
  if (gone.length) {
    HIST.push({ label: plural(gone.length, 'photo') + ' taken off the skipped list', undo: async () => { await FC.skipPutBack(gone); } });
    toastUndo(plural(gone.length, 'photo') + ' taken off this list. The ' + (gone.length === 1 ? 'file is' : 'files are') + ' not touched.');
  }
  render(true);
}
Object.assign(ACTS, {
  cskip: v => { state.skArg = ''; location.hash = 'skipped?client=' + encodeURIComponent(v); },
  skfilter: v => { state.skF = state.skF === v ? '' : v; state.skMore = 100; render(true); },
  skclient: () => { state.skClient = ''; render(true); },
  skclear: () => { state.skF = ''; state.skClient = ''; state.skQ = ''; render(true); },
  skgroup: (v, el) => { state.skGroup = el.value; state.skMore = 100; render(true); },
  sksort: (v, el) => { state.skSort = el.value; render(true); },
  skfold: v => { state.skOpen = state.skOpen || {}; if (state.skOpen[v]) delete state.skOpen[v]; else state.skOpen[v] = 1; render(true); },
  skallof: v => { state.skAll[v] = 1; render(true); },
  skmore: () => { state.skMore += 200; render(true); },
  skpick: (v, el) => { state.skSel = el.checked ? [...new Set([...state.skSel, v])] : state.skSel.filter(x => x !== v); render(true); },
  skpan: v => { state.skPan = state.skPan === v ? '' : v; render(true); },
  skretry: v => skRetry(v ? [v] : null),
  skretryall: async () => skRetry(skRows(await FC.skipped()).map(x => x[0])),
  skretrykind: async v => skRetry((await FC.skipped()).filter(x => x[3] === v).map(x => x[0])),
  skretryclient: async v => skRetry(skRows(await FC.skipped()).filter(x => (x[2] || '') === v).map(x => x[0])),
  skoff: v => skOff([v]),
  skpath: v => ntCopy(String(v).replace(/^d:\+?/, '').split('/').slice(0, -1).join('/'), 'Folder path copied'),
  skbulk: async v => {
    const ids = [...state.skSel];
    if (v === 'clear') { state.skSel = []; return render(true); }
    if (v === 'retry') return skRetry(ids);
    if (v === 'off') return skOff(ids);
    if (v === 'paths') return ntCopy([...new Set(ids.map(id => String(id).replace(/^d:\+?/, '').split('/').slice(0, -1).join('/')))].join('\n'), plural(ids.length, 'folder path') + ' copied');
  },
  skcsv: async () => {
    const rows = skRows(await FC.skipped());
    const q = s => '"' + String(s == null ? '' : s).replace(/"/g, '""').replace(/^([=+\-@])/, "'$1") + '"';
    const lines = [['Photo', 'Client', 'Folder', 'Why', 'Skipped'], ...rows.map(x => [x[1], x[2] || 'Client unknown', skFolder(x[0], 1), SK_KIND[x[3]].n, String(x[4]).slice(0, 10)])];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + lines.map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv' }));
    a.download = 'PageProof_skipped-photos_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast(plural(rows.length, 'row') + ' saved to your Downloads folder.');
  },
});
