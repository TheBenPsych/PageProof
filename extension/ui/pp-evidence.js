// Evidence › All evidence in the calm look (step 14): app.html#library
// Two tabs (Captures, Evidence reports), Pictures or List, a find box with quick filters, a
// "waiting for a capture" bar and filter (what is left of the old Needs a capture page), cards
// grouped by week and month, a details panel per capture, and grouping by case number.
// This page only shows what was captured. It never changes a capture or an evidence pack.
const EVI = (() => {
  const s = (p, z = 16) => `<svg viewBox="0 0 16 16" width="${z}" height="${z}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  return {
    down: s('<path d="M8 2.5v8M4.5 7.5 8 11l3.5-3.5M3 13.5h10"/>'),
    grid: s('<rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/>'),
    list: s('<path d="M5.5 4h8.5M5.5 8h8.5M5.5 12h8.5"/><circle cx="2.6" cy="4" r=".7"/><circle cx="2.6" cy="8" r=".7"/><circle cx="2.6" cy="12" r=".7"/>'),
    chev: s('<path d="m6 3.5 4.5 4.5L6 12.5"/>', 14),
    fold: s('<path d="m4 6 4 4 4-4"/>', 14),
    check: s('<path d="m3 8.5 3.2 3L13 4.5"/>'),
    cap: s('<rect x="2" y="3.5" width="12" height="9.5" rx="1.5"/><path d="M5.5 3.5 6.5 2h3l1 1.5"/><circle cx="8" cy="8.2" r="2.4"/>'),
    ext: s('<path d="M9 2.5h4.5V7M13.5 2.5 7.5 8.5M12 9.5V13a.5.5 0 0 1-.5.5h-8.5a.5.5 0 0 1-.5-.5V4.5a.5.5 0 0 1 .5-.5H7"/>'),
    copy: s('<rect x="5" y="5" width="8.5" height="8.5" rx="1"/><path d="M3 10.5V3.5a1 1 0 0 1 1-1h6.5"/>'),
    open: s('<rect x="1.8" y="2.5" width="12.4" height="11" rx="1.5"/><path d="M1.8 5.5h12.4"/>'),
    shield: s('<path d="M8 1.8 13.2 4v4c0 3-2.2 5.2-5.2 6.2C5 13.2 2.8 11 2.8 8V4z"/><path d="m5.8 8 1.6 1.6 3-3"/>'),
    clock: s('<circle cx="8" cy="8" r="6.2"/><path d="M8 4.6V8l2.4 1.6"/>'),
    doc: s('<path d="M4 1.8h5.5L12.5 5v9.2H4z"/><path d="M9.5 1.8V5h3M6 8h4.5M6 10.5h4.5"/>'),
    info: s('<circle cx="8" cy="8" r="6.2"/><path d="M8 7.2v4M8 4.9v.2"/>'),
    copies: s('<rect x="2" y="4.5" width="8" height="9" rx="1"/><path d="M5 4.5V3a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-3"/>'),
    save: s('<path d="M3 2.5h8l2.5 2.5v8.5H3z"/><path d="M5.5 2.5v3.5h5V2.5M5.5 13.5v-4h5v4"/>'),
    tag: s('<path d="M2.2 2.2h5.6l6 6-5.6 5.6-6-6z"/><circle cx="5.2" cy="5.2" r="1"/>'),
  };
})();
// The quick filters. The names are the ones other pages link to (#library?filter=…).
const EV_FILTERS = [['all', 'All', ''], ['nosave', 'Pack not saved', EVI.save], ['nocase', 'No case number', EVI.tag], ['nots', 'No timestamps', EVI.clock], ['waiting', 'Waiting for a capture', EVI.cap]];
Object.assign(state, { evTab: 'captures', evF: 'all', evClient: '', evSort: 'new', evSel: '', evMore: 120, evOpen: null });
const evHue = v => { let h = 0; for (const ch of String(v)) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
const evSl = h => `<span class="esl" style="--h:${evHue(h)}" aria-hidden="true">${esc((String(h).replace(/^www\./, '')[0] || '?').toUpperCase())}</span>`;
const evTm = d => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const evWhen = iso => { const d = new Date(iso), t = new Date(); if (isNaN(d)) return ''; if (d.toDateString() === t.toDateString()) return 'Today ' + evTm(d); if (d.toDateString() === new Date(t - 864e5).toDateString()) return 'Yesterday ' + evTm(d); return d.toLocaleDateString([], { month: 'short', day: 'numeric', ...(d.getFullYear() !== t.getFullYear() ? { year: 'numeric' } : {}) }) + ' ' + evTm(d); };
const evDay = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString([], { month: 'short', day: 'numeric' }); };
const evFull = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); };
const evShort = u => String(u || '').replace(/^https?:\/\/(www\.)?/, '');
const evClientChip = n => n ? `<span class="evcl">${kAv(n)}<span>${esc(n)}</span></span>` : '';
const evCase = (v, saved, big) => v ? `<span class="evcase${big ? ' big' : ''}">${esc(v)}</span>` : saved ? `<span class="evcase none${big ? ' big' : ''}">No case number</span>` : '<span class="evcase dash">—</span>';
// The trusted time stamps of one save, as a list of names.
const evStamps = s => !s ? [] : s.timestamps ? String(s.timestamps).split(';').map(x => x.trim()).filter(Boolean) : s.timestamp ? [s.tsa || 'Timestamp'] : [];
const evWeek = iso => { const d = new Date(iso), t = new Date(); t.setHours(0, 0, 0, 0); const n = Math.floor((t - new Date(d).setHours(0, 0, 0, 0)) / 864e5); if (n < 7) return 'This week'; if (n < 14) return 'Last week'; return d.toLocaleDateString([], { month: 'long', ...(d.getFullYear() !== t.getFullYear() ? { year: 'numeric' } : {}) }); };
const evCopyPic = c => safeImg((c && (c.thumb || (c.th && FC.pics.seen(c.id)))) || 'icons/icon48.png');
const evPair = (p, c, big) => `<span class="evpair${big ? ' big' : ''}">${p ? `<img src="${lazyPic(p)}" alt="Client photo">` : '<img src="icons/icon48.png" alt="">'}<img src="${evCopyPic(c)}" alt="Their copy" referrerpolicy="no-referrer"></span>`;

// Everything the page shows, read once per draw.
async function evData() {
  const [log, st, copies] = await Promise.all([getLog(), api.storage.local.get('fcReports'), FC.allCopies().catch(() => [])]);
  const byKey = new Map();
  for (const c of copies) for (const u of [c.url, ...(c.alts || [])]) { const k = FC.pageKey(u); if (!byKey.has(k) || c.status === 'stolen') byKey.set(k, c); }
  const photos = new Map((await FC.DB.getMany('photos', [...new Set(copies.filter(c => c.status === 'stolen').map(c => c.photo))])).filter(Boolean).map(p => [p.id, p]));
  const items = [...log].reverse().map(x => {
    const saves = (x.saves || []).filter(s => s && s.at), s = saves[saves.length - 1] || null, c = byKey.get(FC.pageKey(x.url)) || null;
    return { x, s, c, saved: !!s, caseRef: (s && s.caseRef) || '', ts: evStamps(s), n: saves.length, client: c ? (c.client || '') : '', p: c ? photos.get(c.photo) || null : null, host: site(x.url) };
  });
  const reports = ((st.fcReports || []).slice()).sort((a, b) => String(b.at).localeCompare(String(a.at))).map(r => { const c = byKey.get(FC.pageKey(r.url)) || null; return { r, c, p: c ? photos.get(c.photo) || null : null }; });
  const waiting = (await needsCapture().catch(() => ({ up: [] }))).up;
  for (const c of waiting) if (!photos.has(c.photo)) { const p = await FC.DB.get('photos', c.photo); if (p) photos.set(p.id, p); }
  return { items, reports, waiting, photos };
}
const evHit = (r, q) => !q || [r.x.url, r.x.title, r.caseRef, r.s && r.s.collector, r.x.captureId, r.client].join(' ').toLowerCase().includes(q);
const evRepHit = (o, q) => !q || [o.r.site, o.r.url, o.r.caseNo, o.r.photo, o.r.client, o.r.id].join(' ').toLowerCase().includes(q);
const evPass = { all: () => true, nosave: r => !r.saved, nocase: r => r.saved && !r.caseRef, nots: r => r.saved && !r.ts.length };

function evBadge(r) {
  return !r.saved ? `<span class="evb warn">${EVI.save}Pack not saved</span>` : !r.caseRef ? `<span class="evb warn">${EVI.tag}No case number</span>` : !r.ts.length ? `<span class="evb warn">${EVI.clock}No timestamps</span>` : `<span class="evb ok">${EVI.check}Pack saved</span>`;
}
function evPanel(r) {
  const s = r.s, c = r.c, kv = (k, v) => `<div class="evkv"><span>${k}</span><span>${v}</span></div>`;
  const cp = (v, what) => `<button class="kx" data-act="evcopy" data-v="${esc(v)}" data-what="${esc(what)}" aria-label="Copy ${esc(what)}" title="Copy">${EVI.copy}</button>`;
  return `<aside class="cpanel evpanel" id="evPanel" aria-label="${esc(r.host)}"><div class="cph">${evSl(r.host)}<span class="kn1"><b>${esc(r.host)}</b><span title="${esc(r.x.title || '')}">${esc(r.x.title || r.x.url)}</span></span><span class="sp"></span><button class="kx" data-act="evsel" data-v="" aria-label="Close" title="Close">✕</button></div>
    <div class="evbig"><span class="evph" data-capthumb="${esc(r.x.id)}"><b>${esc((r.host[0] || '?').toUpperCase())}</b></span>${evBadge(r)}</div>
    <div class="evpb"><button class="btn kbtn primary" data-act="opencap" data-v="${esc(r.x.id)}">${EVI.open}Open the capture</button><a class="btn kbtn" href="${safeUrl(r.x.url)}" target="_blank" rel="noreferrer">${EVI.ext}Their page</a></div>
    <div class="kh2">This capture</div>
    <div id="evFacts">${kv('Case number', evCase(r.caseRef, r.saved))}${kv('Captured', esc(evFull(r.x.time)) + (s && s.collector ? ' · by ' + esc(s.collector) : ''))}
    ${kv('Address', `<span class="evurl" title="${esc(r.x.url)}">${esc(evShort(r.x.url))}</span>${cp(r.x.url, 'address')}`)}${r.x.captureId ? kv('Capture ID', `<span class="mono">${esc(r.x.captureId)}</span>${cp(r.x.captureId, 'capture ID')}`) : ''}</div>
    <div class="kh2">Evidence pack</div>
    ${s ? `<div id="evPack">${kv('Saved', esc(evFull(s.at)) + (r.n > 1 ? ` · saved ${r.n} times` : ''))}${s.file ? kv('File', `<span class="evurl" title="${esc(s.file)}">${esc(s.file)}</span>`) : ''}
      ${s.sha256 ? kv('Fingerprint', `<span class="mono" title="${esc(s.sha256)}">${esc(String(s.sha256).slice(0, 16))}…</span>${cp(s.sha256, 'fingerprint')}`) : ''}
      ${kv('Trusted time', r.ts.length ? `<span class="evst ok">${EVI.check}${r.ts.length} ${r.ts.length === 1 ? 'stamp' : 'stamps'}</span><span class="kfaint evurl" title="${esc(r.ts.join(', '))}">${esc(r.ts.map(t => t.replace(/\s+\d{4}-.*$/, '').replace(/\s*\(.*$/, '')).join(', '))}</span>` : `<span class="evst warn">${EVI.clock}None</span>`)}
      ${s.notes ? kv('Notes', `<span>${esc(s.notes)}</span>`) : ''}</div>`
      : `<div class="kbar warn" id="evPack"><div><b>The evidence pack is not saved yet</b><span>Open the capture, type the case number and press Save evidence pack.</span></div></div>`}
    ${c && c.status === 'stolen' ? `<div class="kh2">The Stolen copy</div><div class="evcopy" id="evCopy">${evPair(r.p, c, 1)}<span class="kn1">${evClientChip(r.client)}<span class="kfaint">${esc((r.p && r.p.name) || 'Photo')}${c.pct != null && c.pct >= 0 ? ' · ' + Math.round(c.pct) + '% lines up' : ''}</span></span></div>` : ''}
    <div class="cpfoot">${c ? `<a class="btn kbtn" href="#found?open=${encodeURIComponent(c.id)}">${EVI.copies}Open in Copies found</a>` : ''}${s ? `<a class="btn kbtn" href="#verify" title="Check that a saved pack has not been changed (Tools › Verify a pack)">${EVI.shield}Check this pack</a>` : ''}<button class="btn kbtn" data-act="opencap" data-v="${esc(r.x.id)}">${EVI.save}${s ? 'Save the pack again' : 'Save the pack'}</button></div></aside>`;
}
V.library = async () => {
  // links from other pages: #library?filter=Pack%20not%20saved, #library?tab=reports
  if (routeArg('filter') || routeArg('tab')) {
    const f = EV_FILTERS.find(x => x[1].toLowerCase() === (routeArg('filter') || '').toLowerCase());
    if (f) { state.evF = f[0]; state.evTab = 'captures'; state.evSel = ''; }
    if (routeArg('tab') === 'reports') state.evTab = 'reports';
    history.replaceState(null, '', '#library');
  }
  const D = await evData(), q = (state.libQ || '').trim().toLowerCase();
  const view = state.libView || (await api.storage.local.get('ppLibView')).ppLibView || 'cards';
  const tab = state.evTab === 'reports' ? 'reports' : 'captures';
  if (state.evF === 'waiting' && !D.waiting.length) state.evF = 'all';
  const F = state.evF, items = D.items;
  const clients = [...new Set([...items.map(r => r.client), ...D.reports.map(o => o.r.client || ''), ...D.waiting.map(c => c.client || '')].filter(Boolean))].sort((a, b) => a.localeCompare(b));
  if (state.evClient && !clients.includes(state.evClient)) state.evClient = '';
  const cl = r => !state.evClient || r.client === state.evClient;
  const n = Object.fromEntries(['all', 'nosave', 'nocase', 'nots'].map(k => [k, items.filter(evPass[k]).length]));
  let rows = F === 'waiting' ? [] : items.filter(r => evPass[F](r) && cl(r) && evHit(r, q));
  if (state.evSort === 'old') rows = rows.slice().reverse();
  const reps = D.reports.filter(o => (!state.evClient || (o.r.client || '') === state.evClient) && evRepHit(o, q));
  const sel = tab === 'captures' && state.evSel ? items.find(r => r.x.id === state.evSel) : null;
  if (!sel) state.evSel = '';

  const ctl = `<div class="rvn-ctl kctl" id="evCtl"><div class="utabs" role="tablist"><button role="tab" aria-selected="${tab === 'captures'}" class="${tab === 'captures' ? 'on' : ''}" data-act="evtab" data-v="captures">Captures <span>${items.length.toLocaleString()}</span></button><button role="tab" aria-selected="${tab === 'reports'}" class="${tab === 'reports' ? 'on' : ''}" data-act="evtab" data-v="reports">Evidence reports <span>${D.reports.length.toLocaleString()}</span></button></div><span class="sp"></span>
    ${tab === 'captures' ? `<div class="wseg evview" role="group" aria-label="Show as"><button class="${view === 'cards' ? 'on' : ''}" aria-pressed="${view === 'cards'}" data-act="libview" data-v="cards">${EVI.grid}Pictures</button><button class="${view === 'list' ? 'on' : ''}" aria-pressed="${view === 'list'}" data-act="libview" data-v="list">${EVI.list}List</button></div>` : ''}
    <button class="clcb evdl" data-act="${tab === 'captures' ? 'libcsv' : 'evrepcsv'}" title="Save this list as a spreadsheet file (CSV) in your Downloads folder">${EVI.down}<span>Download list</span></button></div>`;

  // What is left of Needs a capture: one bar, and the Waiting for a capture filter.
  const oldest = D.waiting.length ? ppDaysSince(D.waiting[0].answered || D.waiting[0].firstSeen) : 0;
  const bar = tab === 'captures' && D.waiting.length && F !== 'waiting' ? `<div class="kbar warn evbar" id="evWaitBar">${kSq(KC.amber, EVI.cap, 28)}<div><b>${D.waiting.length} Stolen ${D.waiting.length === 1 ? 'copy is' : 'copies are'} waiting for a capture</b><span>${oldest >= 1 ? `The oldest has waited ${plural(oldest, 'day')}. ` : ''}Capture ${D.waiting.length === 1 ? 'it' : 'them'} before the ${D.waiting.length === 1 ? 'site takes it' : 'sites take them'} down (${esc([...new Set(D.waiting.map(c => c.site))].slice(0, 3).join(', '))}${new Set(D.waiting.map(c => c.site)).size > 3 ? '…' : ''}).</span></div><span class="sp"></span><button class="btn kbtn primary" data-act="capturecopy" data-v="${esc(D.waiting[0].id)}">${EVI.cap}Capture the oldest</button><button class="btn kbtn" data-act="evfilter" data-v="waiting">See them</button><a class="btn kbtn" href="#found?filter=${encodeURIComponent('Not finished')}">${EVI.copies}Open Not finished</a></div>` : '';

  const sel2 = (act, label, opts, cur) => `<label class="ksort"><select data-act="${act}" aria-label="${label}">${opts.map(([k, l]) => `<option value="${esc(k)}" ${cur === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  const cmd = `<div class="clcmd evcmd" id="evCmd"><label class="ksearch">${KI.search}<input type="search" id="libq" placeholder="${tab === 'captures' ? 'Find a case number, site, client or capture ID' : 'Find a case number, site, client or Match ID'}" aria-label="Find evidence" value="${esc(state.libQ || '')}"></label>
    ${tab === 'captures' ? `<div class="wseg kseg evfil" role="radiogroup" aria-label="Quick filters">${EV_FILTERS.map(([k, l, i]) => { const c = k === 'waiting' ? D.waiting.length : n[k]; return `<button role="radio" aria-checked="${F === k}" class="${F === k ? 'on' : ''}" data-act="evfilter" data-v="${k}"${k !== 'all' && !c ? ' disabled' : ''}>${i}${l} <span>${c.toLocaleString()}</span></button>`; }).join('')}</div>` : ''}
    <span class="sp"></span>${clients.length ? sel2('evclient', 'Client', [['', 'All clients'], ...clients.map(c => [c, c])], state.evClient) : ''}
    ${tab === 'captures' && F !== 'waiting' ? sel2('evsort', 'Sort', [['new', 'Newest first'], ['old', 'Oldest first'], ['case', 'Group: Case number']], state.evSort) : ''}</div>`;

  const pic = r => `<span class="evph" data-capthumb="${esc(r.x.id)}"><b>${esc((r.host[0] || '?').toUpperCase())}</b></span>`;
  const card = r => `<div class="card evc${sel === r ? ' sel' : ''}${r.saved ? '' : ' todo'}" data-act="evsel" data-v="${esc(r.x.id)}" data-id="${esc(r.x.id)}" role="button" tabindex="0" title="${esc(r.x.url)}"><div class="evpic">${pic(r)}${evBadge(r)}</div>
    <div class="evt"><div class="evs">${evSl(r.host)}<b>${esc(r.host)}</b></div><span class="evtitle">${esc(r.x.title || evShort(r.x.url))}</span>
    <div class="evm">${r.saved ? evCase(r.caseRef, true) : ''}${evClientChip(r.client)}</div>
    <span class="kfaint evwhen">${esc(evWhen(r.x.time))}${r.n > 1 ? ` · saved ${r.n} times` : ''}</span>
    ${r.saved ? '' : `<div class="evfix"><button class="btn kbtn primary" data-act="opencap" data-v="${esc(r.x.id)}">${EVI.save}Save the pack</button></div>`}</div></div>`;
  const row = r => `<div class="evr${sel === r ? ' sel' : ''}" data-act="evsel" data-v="${esc(r.x.id)}" data-id="${esc(r.x.id)}" role="button" tabindex="0"><span class="evthumb">${pic(r)}</span>
    <span class="kfaint num">${esc(evWhen(r.x.time))}</span>
    <span class="kn1"><b>${esc(r.host)}</b><span>${esc(r.x.title || evShort(r.x.url))}</span></span>
    <span>${r.client ? evClientChip(r.client) : '<span class="kfaint">Not from Copies found</span>'}</span>
    <span>${evCase(r.caseRef, r.saved)}</span>
    <span>${r.saved ? `<span class="evst ok">${EVI.check}Saved ${esc(evDay(r.s.at))}</span>` : `<span class="evst warn">${EVI.save}Not saved</span>`}</span>
    <span>${r.saved ? (r.ts.length ? `<span class="evst ok">${EVI.clock}${r.ts.length} ${r.ts.length === 1 ? 'stamp' : 'stamps'}</span>` : `<span class="evst warn">${EVI.clock}None</span>`) : ''}</span>
    <span class="mono kfaint">${esc(r.x.captureId || '')}</span>${EVI.chev}</div>`;
  const listHead = `<div class="evr evh"><span></span><span>Captured</span><span>Site and page</span><span>Client</span><span>Case</span><span>Evidence pack</span><span>Trusted time</span><span>Capture ID</span><span></span></div>`;
  const none = (t, sub = '') => `<section class="card evnone" id="evNone"><b>${t}</b>${sub ? `<span class="kmuted">${sub}</span>` : ''}</section>`;
  const cut = rows.slice(0, state.evMore), more = rows.length > cut.length ? `<div class="evmore"><button class="btn kbtn" data-act="evmore">Show ${Math.min(120, rows.length - cut.length)} more</button></div>` : '';
  const groups = []; for (const r of cut) { const g = evWeek(r.x.time); let G = groups[groups.length - 1]; if (!G || G.g !== g) groups.push(G = { g, rows: [] }); G.rows.push(r); }

  let body;
  if (tab === 'reports') {
    const rr = o => { const r = o.r; return `<div class="evrr" data-id="${esc(r.id || '')}">${evPair(o.p, o.c)}
      <span class="kfaint num">${esc(evWhen(r.at))}</span><span class="kn1"><b>${esc(r.site || site(r.url))}</b><span title="${esc(r.url)}">${esc(evShort(r.url))}</span></span>
      <span class="kn1">${evClientChip(r.client || '') || '<span class="kfaint">Client unknown</span>'}<span class="kfaint">${esc(r.photo || '')}</span></span>
      <span>${evCase(r.caseNo, true)}</span>
      <span class="evmid"><span class="mono" title="${esc(r.id || '')}">${esc(r.id || '')}</span>${r.id ? `<button class="kx" data-act="evcopy" data-v="${esc(r.id)}" data-what="Match ID" aria-label="Copy Match ID" title="Copy">${EVI.copy}</button>` : ''}</span>
      <span class="cnb"><a class="btn kbtn" href="${safeUrl(r.url)}" target="_blank" rel="noreferrer">${EVI.ext}Their page</a>${o.c ? `<a class="btn kbtn" href="#found?open=${encodeURIComponent(o.c.id)}">${EVI.copies}The copy</a>` : ''}</span></div>`; };
    body = reps.length ? `<section class="card evreps" id="evReports"><div class="evrr evh"><span>Client photo · their copy</span><span>Made</span><span>Site and page</span><span>Client and photo</span><span>Case</span><span>Match ID</span><span></span></div>${reps.slice(0, state.evMore).map(rr).join('')}${reps.length > state.evMore ? `<div class="evmore"><button class="btn kbtn" data-act="evmore">Show more</button></div>` : ''}</section>`
      : none(D.reports.length ? 'Nothing matches.' : 'No evidence reports yet', D.reports.length ? '' : 'A report is made when you save the capture of a Stolen copy, or from a copy in Copies found.');
  } else if (F === 'waiting') {
    const ws = D.waiting.filter(c => (!state.evClient || (c.client || '') === state.evClient) && (!q || [c.site, c.url, c.title, c.client].join(' ').toLowerCase().includes(q)));
    body = `<section class="card evwait" id="evWaiting"><div class="kh2">Waiting for a capture <span class="kfaint">Stolen copies with no evidence pack yet, oldest first</span></div>${ws.map((c, i) => { const p = D.photos.get(c.photo), d = ppDaysSince(c.answered || c.firstSeen); return `<div class="evwr" data-id="${esc(c.id)}">${evPair(p, c)}<span class="kn1"><b>${esc(c.site)}</b><a href="${safeUrl(c.url)}" target="_blank" rel="noreferrer" title="${esc(c.url)}">${esc(evShort(c.url))}</a></span>${evClientChip((p && p.client) || c.client || '') || '<span class="kfaint">Client unknown</span>'}<span class="evwd${d >= 7 ? ' r' : d >= 3 ? ' a' : ''}">${d >= 1 ? 'Waiting ' + plural(d, 'day') : 'Marked Stolen today'}</span><span class="cnb"><button class="btn kbtn" data-act="capdone" data-v="${esc(c.id)}" title="It was captured another way (another computer, another tool)">${EVI.check}Captured another way</button><button class="btn kbtn${i ? '' : ' primary'}" data-act="capturecopy" data-v="${esc(c.id)}">${EVI.cap}Capture now</button></span></div>`; }).join('') || '<p class="kmuted" style="margin:0;padding:18px 0">Nothing matches.</p>'}<p class="kfoot">${KI.clock}<span>Each one also sits in Copies found › Not finished, at the Capture step. When its pack is saved it leaves this list by itself.</span></p></section>`;
  } else if (!rows.length) {
    body = none(items.length ? 'Nothing matches.' : 'Nothing captured yet', items.length ? '<button class="klink" data-act="evclear">Show everything</button>' : 'Open a web page, click the PageProof icon, then <b>Capture this page</b>.');
  } else if (state.evSort === 'case') {
    const cs = []; for (const r of rows) { const k = r.caseRef || ''; let G = cs.find(x => x.k === k); if (!G) cs.push(G = { k, rows: [] }); G.rows.push(r); }
    cs.sort((a, b) => (!a.k) - (!b.k));
    if (!state.evOpen) state.evOpen = Object.fromEntries(cs.slice(0, 3).map(G => [G.k, 1]));
    body = cs.map(G => { const rr = reps.filter(o => (o.r.caseNo || '') === G.k), cls = [...new Set(G.rows.map(r => r.client).filter(Boolean))], op = !!state.evOpen[G.k] || G.rows.includes(sel);
      return `<section class="card evcase-g${op ? ' open' : ''}" data-case="${esc(G.k)}"><div class="evgh" data-act="evfold" data-v="${esc(G.k)}" role="button" tabindex="0" aria-expanded="${op}">${op ? EVI.fold : EVI.chev}${evCase(G.k, true, 1)}<span class="kfaint">${plural(G.rows.length, 'capture')} · ${plural(rr.length, 'report')}${cls.length ? ' · ' + esc(cls.join(', ')) : ''}</span><span class="sp"></span><span class="kfaint">Last ${esc(evWhen(G.rows[0].x.time))}</span></div>
      ${op ? `<div class="evgrid inner">${G.rows.map(card).join('')}${rr.map(o => `<div class="card evc rep" data-rep="${esc(o.r.id || '')}"><div class="evpic rep">${kSq(KC.purple, EVI.doc, 44)}<span>Evidence report</span></div><div class="evt"><div class="evs">${evSl(o.r.site || '')}<b>${esc(o.r.site || '')}</b></div><span class="evtitle mono">${esc(o.r.id || '')}</span><span class="kfaint evwhen">${esc(evWhen(o.r.at))}</span></div></div>`).join('')}</div>` : ''}</section>`; }).join('') + more;
  } else if (view === 'list') {
    body = `<section class="card evlist" id="evList">${listHead}${groups.map(G => `<div class="evgl">${esc(G.g)} <span>${G.rows.length}</span></div>${G.rows.map(row).join('')}`).join('')}${more}</section>`;
  } else {
    body = `<div id="capGrid" class="evgroups">${groups.map(G => `<div class="evg"><div class="evgl">${esc(G.g)} <span>${G.rows.length}</span></div><div class="evgrid">${G.rows.map(card).join('')}</div></div>`).join('')}${more}</div>`;
  }
  const foot = `<p class="kfoot evfoot" id="evFoot">${EVI.info}<span>Captures are kept in this browser. Evidence packs and report PDFs are saved in your Downloads folder.</span><button class="klink" data-act="evdownloads">Show in Downloads</button></p>`;
  const panel = sel ? evPanel(sel) : '';
  document.body.classList.toggle('cpopen', !!panel);
  return head('Evidence', 'All evidence', '') + `<div class="rvn kpn crn evn${panel ? ' withpanel' : ''}">${ctl}${bar}${cmd}${body}${foot}</div>${panel}`;
};
V.library.after = () => {
  clKeepFocus('libq', v => { state.libQ = v; state.evMore = 120; });
  capThumbs(); lazyThumbs();
};
// Copies found › Not finished shows this bar on top: how many Stolen copies still have no capture,
// and how long the oldest has waited (the warning the old Needs a capture page gave).
async function evWaitBar() {
  const up = (await needsCapture().catch(() => ({ up: [] }))).up;
  if (!up.length) return '';
  const d = ppDaysSince(up[0].answered || up[0].firstSeen);
  return `<div class="kbar warn evbar${d >= 3 ? ' late' : ''}" id="nfWait">${kSq(d >= 3 ? KC.red : KC.amber, EVI.cap, 28)}<div><b>${up.length} Stolen ${up.length === 1 ? 'copy is' : 'copies are'} waiting for a capture</b><span>${d >= 1 ? `The oldest has waited ${plural(d, 'day')}. ` : ''}Capture ${up.length === 1 ? 'it' : 'them'} before the ${up.length === 1 ? 'site takes it' : 'sites take them'} down.</span></div><span class="sp"></span><button class="btn kbtn primary" data-act="capturecopy" data-v="${esc(up[0].id)}">${EVI.cap}Capture the oldest</button><a class="btn kbtn" href="#library?filter=${encodeURIComponent('Waiting for a capture')}">See all ${up.length}</a></div>`;
}
// The old Needs a capture page is gone: a copy marked Stolen is captured right away, and the ones
// still waiting sit in Copies found › Not finished and behind the Waiting for a capture filter here.
V.tocapture = async () => { setTimeout(() => location.replace('#library?filter=' + encodeURIComponent('Waiting for a capture')), 0); return ''; };
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || state.shown !== 'library' || /^(INPUT|SELECT|TEXTAREA)$/.test((e.target || {}).tagName || '')) return;
  if (state.evSel) { state.evSel = ''; render(true); }
});
Object.assign(ACTS, {
  evtab: v => { state.evTab = v; state.evSel = ''; state.evMore = 120; render(true); },
  evfilter: v => { state.evF = state.evF === v && v !== 'all' ? 'all' : v; state.evSel = ''; state.evMore = 120; render(true); },
  evclient: (v, el) => { state.evClient = el.value; state.evMore = 120; render(true); },
  evsort: (v, el) => { state.evSort = el.value; state.evOpen = null; render(true); },
  evsel: v => { state.evSel = state.evSel === v ? '' : v; render(true); },
  evfold: v => { state.evOpen = state.evOpen || {}; if (state.evOpen[v]) delete state.evOpen[v]; else state.evOpen[v] = 1; render(true); },
  evmore: () => { state.evMore += 120; render(true); },
  evclear: () => { state.libQ = ''; state.evF = 'all'; state.evClient = ''; render(true); },
  evcopy: (v, el) => ntCopy(v, (el.dataset.what || 'Text').replace(/^./, c => c.toUpperCase()) + ' copied'),
  evdownloads: () => { try { api.downloads.showDefaultFolder(); } catch (e) { toast('Open your Downloads folder to see the saved packs.'); } },
  evrepcsv: async () => {
    const reps = ((await api.storage.local.get('fcReports')).fcReports || []).slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const q = v => { let t = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
    const lines = [['Made', 'Site', 'Web address', 'Client', 'Photo', 'Case / ref', 'Match ID'], ...reps.map(r => [fmtDate(r.at), r.site || '', r.url || '', r.client || '', r.photo || '', r.caseNo || '', r.id || ''])];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + lines.map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv' }));
    a.download = 'PageProof_evidence_reports.csv'; document.body.append(a); a.click(); a.remove();
  },
});
