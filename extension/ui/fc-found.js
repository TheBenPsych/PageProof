// Find copies › All copies found, the copy details panel, and Review new copies.
// Every copy found by every search, Keep searching and today's 50, with your answer for each
// (Stolen, Licensed, Remove, Skip), undo for every answer, hiding sites and countries, and
// grouping by client, photo, site or site owner.
Object.assign(state, {
  open: '', picked: [], fFilter: 'All', fView: 'client', fSort: 'act', fClient: 'Any', fUse: 'Any', fRisk: 'Any', fCredit: 'Any', fShop: false, fOwner: '',
  showFilters: false, exp: [], more: 250, qi: 0, cmpMode: 'side', cut: 50, rvTab: 'review', recentHides: [],
});
const HIST = [];         // every answer and hide, newest last, so each one can be undone in turn
let FCD = null;          // what's loaded from the copies database (cleared when anything changes)
api.storage.onChanged.addListener(ch => { if (ch.fcChanged || ch.rsHidden || ch.fcHiddenCountries) FCD = null; });

const STATUS = { new: ['New', 'copy'], stolen: ['Stolen', 'bad'], licensed: ['Licensed', 'ok'], removed: ['Removed', 'grey'] };
const RISK = { ok: ['Looks normal', ''], watch: ['Worth a look', 'warn'], sus: ['Suspicious', 'bad'] };
const CREDIT = { kept: 'Credits your client', removed: 'Credit removed', '': 'Not checked yet' };
const FLAG_ICON = {
  sus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5v.01"/></svg>',
  watch: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>',
  cmi: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M15 9.5a4 4 0 1 0 0 5"/><path d="M4 20L20 4"/></svg>',
  sell: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 3v18"/><path d="M16.5 7.5c-.8-1.2-2.4-2-4.5-2-2.6 0-4.3 1.3-4.3 3.2 0 4.6 9.1 2.3 9.1 7 0 1.9-1.9 3.3-4.6 3.3-2.3 0-4-.9-4.9-2.3"/></svg>',
};
const shortDate = iso => { if (!iso) return ''; const d = new Date(iso); const t = new Date(); if (d.toDateString() === t.toDateString()) return 'Today'; const y = new Date(t - 86400000); if (d.toDateString() === y.toDateString()) return 'Yesterday'; return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === t.getFullYear() ? undefined : 'numeric' }); };
const plural = (n, a, b) => n + ' ' + (n === 1 ? a : (b || a + 's'));

async function loadFC() {
  if (FCD) return FCD;
  const [copies, clients, countries, sites] = [await FC.allCopies(), await FC.DB.all('clients'), await FC.hiddenCountries(), await FC.DB.all('sites')];
  const ids = new Set(copies.map(c => c.photo));
  const photos = new Map();
  const idList = [...ids];
  (await FC.DB.getMany('photos', idList)).forEach((p, i) => { if (p) photos.set(idList[i], p); });
  const facts = new Map(sites.map(f => [f.site, f]));
  for (const c of copies) {
    if (!STATUS[c.status]) c.status = 'new';     // a line edited by hand in found-copies.txt
    c.risk = FC.riskOf(c, facts.get(c.site));
    c.use = c.use || FC.useOf(c);
    const p = photos.get(c.photo);
    c.photoName = p ? p.name : c.photoName || 'Photo';
    c.clientName = (p && p.client) || c.client || '';
  }
  const ownerList = await FC.owners([...new Set(copies.filter(c => c.status !== 'removed').map(c => c.site))]);
  const ownerOf = new Map();
  for (const o of ownerList) for (const s of o.sites) ownerOf.set(s, o);
  FCD = { copies, photos, clients: new Map(clients.map(c => [c.name, c])), countries, facts, owners: ownerList, ownerOf };
  return FCD;
}
const siteHidden = c => RS_LISTS.isHidden(c.site, c.url);
const actScore = c => (c.status === 'new' || c.status === 'stolen' ? 40 : 0) + (c.online === 'back' ? 45 : c.online === 'up' ? 20 : 0) + (c.use === 'shop' ? 20 : 0) + (c.credit === 'removed' ? 12 : 0) + (c.risk.level === 'sus' ? -6 : 0) + (c.pct || 0) / 10;
const onlineText = c => c.online === 'back' ? 'Back online' + (c.backAt ? ' ' + shortDate(c.backAt) : '') : c.online === 'gone' ? 'Gone' + (c.goneAt ? ' since ' + shortDate(c.goneAt) : '') : 'Still up';
const tagFor = c => `<span class="tag ${STATUS[c.status][1]}">${STATUS[c.status][0]}</span>`;
const lineBar = p => p == null || p < 0 ? '<span class="faint" style="font-size:12.5px">—</span>' : `<div class="row" style="gap:8px;flex-wrap:nowrap"><span class="num" style="width:34px;text-align:right;font-weight:600">${p}%</span><span class="bar" style="width:46px;flex-shrink:0"><i style="width:${p}%;background:${p >= 80 ? 'var(--bad)' : p >= 60 ? 'var(--warn)' : 'var(--faint)'}"></i></span></div>`;
const onDot = c => c.status === 'removed' ? '<span class="faint">—</span>' : c.online === 'back' ? '<span class="tag bad" style="font-size:12px" data-gloss="Back online">Back!</span>'
  : `<span class="row" style="gap:6px;flex-wrap:nowrap;font-size:13px;color:var(--${c.online === 'gone' ? 'warn' : 'muted'})" data-gloss="${c.online === 'gone' ? 'Gone' : 'Still online'}"><span class="dot" style="color:var(--${c.online === 'gone' ? 'warn' : 'ok'})"></span>${c.online === 'gone' ? 'Gone' : 'Up'}</span>`;
function flagsFor(c) {
  const f = [];
  if (c.risk.level === 'sus') f.push(['sus', 'bad', 'Suspicious site: ' + c.risk.why.join(', ')]);
  if (c.risk.level === 'watch') f.push(['watch', 'warn', 'Worth a look: ' + c.risk.why.join(', ')]);
  if (c.credit === 'removed') f.push(['cmi', 'copy', 'Credit removed: your client\'s photo has a copyright line in its hidden data and their copy does not']);
  if (c.use === 'shop') f.push(['sell', 'ok', 'Selling something with it']);
  return f.map(([k, col, t]) => `<span class="flag" style="color:var(--${col});background:var(--${col}-soft)" title="${esc(t)}" aria-label="${esc(t)}">${FLAG_ICON[k]}</span>`).join('') || '<span class="faint" style="font-size:12px">—</span>';
}
// Preview pictures live in their own small database (FC.pics). A picture already looked at is
// drawn straight away; otherwise the <img> gets data-th and ppLoadPics() fills it in a moment later.
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
const lazyPic = (rec, fallback) => `${BLANK}" data-th="${esc(rec.id)}${fallback ? `" data-fb="${fallback}` : ''}`;   // goes inside src="…"; fallback is already made safe
const theirImg = c => c.thumb ? safeImg(c.thumb) : c.th ? (FC.pics.seen(c.id) || lazyPic(c, safeImg(c.img))) : safeImg(c.img);
async function ppLoadPics(root = document) {
  const imgs = [...root.querySelectorAll('img[data-th]')];
  if (!imgs.length) return;
  const got = await FC.pics.getMany(imgs.map(i => i.dataset.th)).catch(() => []);
  imgs.forEach((img, i) => { const src = got[i] || img.dataset.fb; if (src) img.src = src; img.removeAttribute('data-th'); });
}
// Your client's photo: the small copy kept with the finds, swapped for the real file from Drive.
const OURS = new Map();
const oursImg = p => (p && OURS.get(p.id)) || (p && p.thumb && safeImg(p.thumb)) || (p && p.th && (FC.pics.seen(p.id) || lazyPic(p, 'icons/icon48.png'))) || 'icons/icon48.png';
async function loadOurs(root = document) {
  for (const img of root.querySelectorAll('img[data-our]')) {
    const id = img.dataset.our;
    if (OURS.has(id)) { img.src = OURS.get(id); continue; }
    const p = FCD && FCD.photos.get(id) || await FC.DB.get('photos', id);
    if (!p || !p.rel) continue;
    try {
      const f = await FC.fileFor(p);
      const b = await createImageBitmap(f);
      const s = Math.min(1, 900 / Math.max(b.width, b.height));
      const c = new OffscreenCanvas(Math.round(b.width * s), Math.round(b.height * s));
      c.getContext('2d').drawImage(b, 0, 0, c.width, c.height); b.close && b.close();
      const url = URL.createObjectURL(await c.convertToBlob({ type: 'image/jpeg', quality: 0.85 }));
      OURS.set(id, url);
      for (const i2 of document.querySelectorAll(`img[data-our="${CSS.escape(id)}"]`)) i2.src = url;
    } catch (e) { /* Drive not reachable: the small copy stays */ }
  }
}

// ---------------------------------------------------------------- the filters
function passMain(c) {
  return (state.fClient === 'Any' || (c.clientName || 'Client unknown') === state.fClient) && (state.fUse === 'Any' || c.use === state.fUse) &&
    (state.fRisk === 'Any' || c.risk.level === state.fRisk) && (state.fCredit === 'Any' || (c.credit || '') === state.fCredit) && (!state.fShop || c.use === 'shop') &&
    (!state.fOwner || (FCD.ownerOf.get(c.site) || {}).key === state.fOwner);
}
function passStatus(c, f = state.fFilter) {
  if (f === 'Removed') return c.status === 'removed';
  if (c.status === 'removed') return false;
  if (f === 'All') return true;
  if (f === 'Still online') return c.online !== 'gone';
  if (f === 'Back online') return c.online === 'back';
  if (f === 'Gone') return c.online === 'gone';
  return STATUS[c.status][0] === f;
}
const visible = c => !siteHidden(c) && !FCD.countries.includes(c.country);

// ---------------------------------------------------------------- the copy details panel
function regBox(p, reg) {
  if (!p || !p.rel) return '<div class="regbox none"><span class="muted" style="font-size:13px">This photo was searched from your computer, not from Google Drive, so there are no Drive folders to look in.</span></div>';
  if (!reg) return `<div class="regbox none"><b>No registration number found</b><span class="muted" style="font-size:13px">PageProof looked in the folder names and for an Excel file named like 1-… or VA… in this folder and the folders above it.</span>
    <div class="ask-row"><input id="regIn" class="chip" style="min-height:34px;padding:0 10px;font-size:14px;flex:1 1 180px" placeholder="VA 2-318-552 or 1-11583920471" aria-label="Registration or application number"><button class="btn sm" data-act="addreg" data-v="${esc(p.folder)}">Add the number</button></div>
    <span class="faint" style="font-size:12.5px">Typed once, it sticks for the whole folder.</span></div>`;
  return `<div class="regbox">${reg.va ? `<div class="row" style="gap:8px"><span class="tag ok" data-gloss="Registered">Registered</span><b class="mono" style="font-size:15px">${esc(reg.va)}</b><button class="btn ghost cpy" data-act="copytext" data-v="${esc(reg.va)}">Copy</button></div>` : ''}
    ${reg.app ? `<div class="row" style="gap:8px"><span class="tag ${reg.va ? 'grey' : 'warn'}" data-gloss="Application">${reg.va ? 'Application' : 'Applied, not registered yet'}</span><b class="mono" style="font-size:${reg.va ? 13.5 : 15}px">${esc(reg.app)}</b><button class="btn ghost cpy" data-act="copytext" data-v="${esc(reg.app)}">Copy</button></div>` : ''}
    <span class="faint" style="font-size:12.5px">Found in: ${esc(reg.from || '')}</span></div>`;
}
function pathBox(path) {
  if (!path) return '';
  const parts = path.split('\\').filter(Boolean);
  return `<div class="dpath"><div class="mono">${parts.map((x, i) => i === parts.length - 1 ? `<b>${esc(x)}</b>` : `<span>${esc(x)}</span>`).join('<i>›</i>')}</div>
    <div class="row" style="gap:6px"><button class="btn sm" data-act="copytext" data-v="${esc(path)}">Copy path</button><span class="faint" style="font-size:12.5px">Paste it into File Explorer's address bar to open the folder.</span></div></div>`;
}
function hideChoices(c) {
  const out = [];
  const part = RS_SITE.part(c.url);
  if (part) out.push([part, 'Only this account', 'Other accounts and pages on ' + c.site + ' still show']);
  const base = FC.baseOf(c.site);
  if (base !== c.site) out.push([c.site, 'Only ' + c.site, 'Other parts of ' + base + ' still show']);
  out.push([base, 'All of ' + base, part ? 'Every account and page on it' : 'Every page and sub-site']);
  return out;
}
async function drawer(list) {
  if (!state.open) return '';
  const c = FCD.copies.find(x => x.id === state.open);
  if (!c) return '';
  const p = FCD.photos.get(c.photo);
  const [reg, path, doubles] = [p ? await FC.regFor(p) : null, p ? await FC.pathOf(p) : '', p ? await FC.doublesOf(p) : []];
  const o = FCD.ownerOf.get(c.site);
  const f = FCD.facts.get(c.site);
  const clients = [...FCD.clients.keys()].sort();
  const sz = c.w && p && p.w ? (Math.abs(c.w / c.h - p.w / p.h) / (p.w / p.h) > 0.06 ? 'cropped' : (c.w * c.h) / (p.w * p.h) > 1.15 ? 'bigger than your client\'s' : (c.w * c.h) / (p.w * p.h) < 0.85 ? 'smaller' : 'same size') : '';
  const idx = list.indexOf(c.id);
  const last = HIST[HIST.length - 1];
  return `<aside class="drawer" aria-label="Copy details" id="drawer">
  <div class="row" style="flex-wrap:nowrap"><div style="min-width:0;flex:1"><div class="eyebrow" style="margin:0">${esc(FC.USE[c.use][0])}${idx >= 0 ? ` · ${idx + 1} of ${list.length}` : ''}</div><h2 style="font-size:20px;overflow-wrap:anywhere">${esc(c.site)}</h2></div><button class="btn" data-act="closedrawer" aria-label="Close">✕</button></div>
  ${last ? `<button class="btn" style="min-height:34px;justify-content:flex-start;font-size:13.5px;border-color:var(--accent);color:var(--accent)" data-act="undo">↶ Undo: ${esc(last.label)}<span class="kbd" style="margin-left:auto">U</span></button>` : ''}
  <div class="pair"><div class="frame ours"><img data-our="${esc(c.photo)}" src="${oursImg(p)}" alt="Your client's photo"><span class="lab">Your client's</span></div><div class="frame theirs"><img src="${theirImg(c)}" alt="Their copy" referrerpolicy="no-referrer"><span class="lab">Theirs</span></div></div>
  <div class="row">${tagFor(c)}${c.pct >= 0 && c.pct != null ? `<b style="color:${c.pct >= 80 ? 'var(--bad)' : 'var(--warn)'}" data-gloss="Lines up">${c.pct}% lines up</b>` : ''}${c.match === 'maybe' ? '<span class="tag warn" data-gloss="Maybe">Maybe</span>' : ''}<button class="btn ghost sm" style="margin-left:auto" data-act="compare">Compare closely</button></div>
  ${p && p.rel ? `<section class="dsec"><div class="dsh">Copyright registration</div>${regBox(p, reg)}</section><section class="dsec"><div class="dsh">Your client's photo in Drive</div>${pathBox(path)}</section>` : ''}
  <dl class="facts">
    <dt>Page</dt><dd class="mono" style="font-size:12px;overflow-wrap:anywhere"><a href="${safeUrl(c.url)}" target="_blank" rel="noreferrer">${esc(c.url)}</a></dd>
    ${c.title ? `<dt>Title</dt><dd>${esc(c.title)}</dd>` : ''}
    <dt>Photo</dt><dd>${esc(c.photoName)}${p && p.w ? `<br><span class="muted" style="font-size:13px">${p.w} × ${p.h}</span>` : ''}</dd>
    <dt>Client</dt><dd>${c.clientName ? esc(c.clientName) : `<span style="color:var(--warn);font-weight:600">Client unknown</span> <select data-act="setclient" aria-label="Set the client" style="border:1px solid var(--line);border-radius:6px;background:var(--surface);font-size:13px;padding:2px 4px"><option value="">Set…</option>${clients.map(n => `<option>${esc(n)}</option>`).join('')}</select>`}</dd>
    ${o && o.real ? `<dt>Site owner</dt><dd><a href="#owners" data-act="gowner" data-v="${esc(o.key)}" style="font-weight:600">${esc(o.name)}</a><br><span class="muted" style="font-size:13px">${esc(o.kind)}${o.sites.length > 1 ? ' · ' + FCD.copies.filter(x => o.sites.includes(x.site) && x.status !== 'removed').length + ' copies on their sites' : ''}</span></dd>` : ''}
    ${doubles.length > 1 ? `<dt>Double</dt><dd><div style="border:1px solid var(--accent);background:var(--accent-soft);border-radius:10px;padding:8px 10px;font-size:13.5px"><b>You have ${doubles.length} versions of this photo</b>${doubles.map(d => `<br>${esc(d.name)}${d.w ? ' (' + d.w + ' × ' + d.h + ')' : ''}${d.id === p.id ? ' · <b>this one</b>' : ''}`).join('')}<br><b style="color:var(--copy)">Note them all in the claim.</b></div></dd>` : ''}
    <dt>How it's used</dt><dd>${esc(FC.USE[c.use][0])}<br><span class="muted" style="font-size:13px">${esc(FC.USE[c.use][1])}</span></dd>
    <dt>Site check</dt><dd>${RISK[c.risk.level][0]}${c.risk.why.length ? `<br><span class="muted" style="font-size:13px">${esc(c.risk.why.join(' · '))}</span>` : ''}</dd>
    <dt>Credit</dt><dd>${c.credit ? CREDIT[c.credit] : `<button class="btn ghost sm" data-act="checkcredit">Check the hidden data</button>`}</dd>
    ${c.country ? `<dt>Country</dt><dd>${esc(c.country)} <button class="btn ghost sm" data-act="hidecountry" data-v="${esc(c.country)}">Hide this country</button></dd>` : ''}
    <dt>Seen</dt><dd>${shortDate(c.firstSeen)}${c.lastSeen && c.lastSeen !== c.firstSeen ? ' → ' + shortDate(c.lastSeen) : ''}, ${c.times > 1 ? c.times + ' times' : 'once'}${c.by ? `<br><span class="muted" style="font-size:13px">First found by ${esc(c.by)}${c.engines && c.engines.length ? ' on ' + c.engines.map(e => ({ google: 'Google Lens', yandex: 'Yandex', bing: 'Bing' }[e] || esc(e))).join(', ') : ''}</span>` : ''}</dd>
    <dt>Online now</dt><dd>${onlineText(c)}${c.checked ? `<br><span class="muted" style="font-size:13px">Checked ${shortDate(c.checked)}${c.onlineWhy ? ': ' + esc(c.onlineWhy) : ''}</span>` : ''} <button class="btn ghost sm" data-act="checkonline">Check now</button></dd>
    ${c.w ? `<dt>Their size</dt><dd>${c.w} × ${c.h}${sz ? ' · ' + sz : ''}</dd>` : ''}
  </dl>
  <a class="lookup" href="#who" data-act="gowho" data-v="${esc(c.id)}">${ic('owner', 18)}<span><b>Who's behind this site</b><br><span class="muted" style="font-size:13px">${f ? esc(f.names && f.names[0] ? 'Probably ' + f.names[0] : 'Names, contacts and domain facts') : 'Read names, contacts and domain facts off the site'}</span></span><span style="margin-left:auto">${ic('chev', 16)}</span></a>
  <details class="hidebox" id="hidebox"><summary><b>Don't want results from this site?</b> <span class="muted" style="font-size:13px">Hide it</span></summary>
    <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">${hideChoices(c).map(([v, l, d]) => `<button class="lookup" style="text-align:left;cursor:pointer" data-act="hidesite" data-v="${esc(v)}"><span style="font-size:18px">🚫</span><span><b>${esc(l)}</b><br><span class="muted" style="font-size:12.5px">${esc(d)}</span></span></button>`).join('')}
    <span class="faint" style="font-size:12.5px">Hidden sites never show again in any search. Bring them back from the Sites chips above the list, or Settings › Hidden and allowed sites.</span></div></details>
  <div class="dacts" style="display:flex;flex-direction:column;gap:8px;margin-top:auto">
  ${c.status === 'removed' ? `<div class="banner info" style="padding:10px 12px"><span style="flex:1;font-size:14px"><b>Removed</b><br><span class="muted">Hidden from your results. It won't come back for this photo.</span></span><button class="btn" data-act="putback">Put back</button></div>` : `
    ${['stolen', 'licensed'].includes(c.status) ? `<div class="row" style="gap:8px;font-size:13.5px"><span>Your answer: ${tagFor(c)}</span><button class="btn ghost sm" style="margin-left:auto" data-act="changeans">Change answer</button></div>` : ''}
    <span class="faint" style="font-size:12.5px">Choose one and the next copy opens here</span>
    <div class="grid" style="grid-template-columns:repeat(4,1fr);gap:6px">
      <button class="btn" style="flex-direction:column;gap:0;min-height:52px;border-color:var(--bad);color:var(--bad)" data-act="dverdict" data-v="stolen"><b>Stolen</b><span class="kbd">Y</span></button>
      <button class="btn" style="flex-direction:column;gap:0;min-height:52px;border-color:var(--ok);color:var(--ok)" data-act="dverdict" data-v="licensed"><b>Licensed</b><span class="kbd">L</span></button>
      <button class="btn" style="flex-direction:column;gap:0;min-height:52px" data-act="dverdict" data-v="removed"><b>🗑 Remove</b><span class="kbd">N</span></button>
      <button class="btn" style="flex-direction:column;gap:0;min-height:52px" data-act="dverdict" data-v="skip"><b>Skip</b><span class="kbd">→</span></button>
    </div>`}
    <div class="grid" style="grid-template-columns:1fr 1fr 1fr;gap:6px"><a class="btn" href="${safeUrl(c.url)}" target="_blank" rel="noreferrer">Open page</a><button class="btn" data-act="capturecopy">${ic('capture', 16)} Capture</button><button class="btn" data-act="openhide">🚫 Hide site</button></div>
    <button class="btn primary" data-act="evidence">${ic('doc', 18)} Evidence report</button>
  </div></aside>`;
}

// ---------------------------------------------------------------- All copies found
let LIST = [];           // the copies in the order they're shown, so an answer can open the next one
V.found = async () => {
  await loadFC();
  if (routeArg('open')) { state.open = routeArg('open'); history.replaceState(null, '', '#found'); }
  if (routeArg('client')) { state.fClient = routeArg('client'); state.fFilter = 'All'; history.replaceState(null, '', '#found'); }
  if (routeArg('filter')) { state.fFilter = routeArg('filter'); history.replaceState(null, '', '#found'); }
  const everything = FCD.copies;
  const hiddenN = everything.filter(c => c.status !== 'removed' && !siteHidden(c) && FCD.countries.includes(c.country)).length;
  const all = everything.filter(visible);
  const sorters = { act: (a, b) => actScore(b) - actScore(a), pct: (a, b) => (b.pct || 0) - (a.pct || 0), risk: (a, b) => ({ sus: 2, watch: 1, ok: 0 }[b.risk.level] - { sus: 2, watch: 1, ok: 0 }[a.risk.level]), newest: (a, b) => (b.firstSeen || '').localeCompare(a.firstSeen || '') };
  const rows = all.filter(c => passMain(c) && passStatus(c)).sort(sorters[state.fSort] || sorters.act);
  const cnt = f => all.filter(passMain).filter(c => passStatus(c, f)).length;
  const row = c => `<tr class="frow${state.open === c.id ? ' on' : ''}" data-act="openrow" data-v="${esc(c.id)}">
    <td style="width:34px;padding-right:0" data-stop="1"><input type="checkbox" aria-label="Pick ${esc(c.site)}" data-act="pick" data-v="${esc(c.id)}" ${state.picked.includes(c.id) ? 'checked' : ''}></td>
    <td><div class="row" style="flex-wrap:nowrap;gap:12px"><img class="thumb" src="${theirImg(c)}" width="52" height="36" alt="" loading="lazy" referrerpolicy="no-referrer" data-hover="${esc(c.id)}"><div style="min-width:0"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px">${esc(c.site)}</div><div class="faint" style="font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px">${esc(c.photoName)}${c.country ? ' · ' + esc(c.country) : ''} · ${shortDate(c.firstSeen)}</div></div></div></td>
    <td class="muted" style="white-space:nowrap">${esc(FC.USE[c.use][0])}</td>
    <td><div class="row" style="gap:4px;flex-wrap:nowrap">${flagsFor(c)}</div></td>
    <td>${lineBar(c.pct)}</td>
    <td>${tagFor(c)}${c.match === 'maybe' ? ' <span class="tag warn" style="font-size:11.5px">Maybe</span>' : ''}</td>
    <td>${onDot(c)}</td>
    <td style="width:28px;color:var(--faint)">${ic('chev', 16)}</td></tr>`;
  const groupHead = (key, html, n, foldable) => {
    const open = !foldable || state.exp.includes(key) || n <= 3;
    return { open, html: `<tr class="ghead${foldable && n > 3 ? ' fold' : ''}" ${foldable && n > 3 ? `data-act="gtoggle" data-v="${esc(key)}"` : ''}><td colspan="8"><div class="row" style="gap:12px">${foldable && n > 3 ? `<span class="caret${open ? ' on' : ''}">▸</span>` : ''}${html}<span class="faint" style="margin-left:auto;font-size:13px">${plural(n, 'copy', 'copies')}${foldable && n > 3 ? (open ? ' · click to fold' : ' · click to open') : ''}</span></div></td></tr>` };
  };
  const groups = [];
  const by = (keyFn) => { const m = new Map(); for (const c of rows) { const k = keyFn(c); if (!m.has(k)) m.set(k, []); m.get(k).push(c); } return m; };
  if (state.fView === 'client') {
    const m = by(c => c.clientName || 'Client unknown');
    for (const [k, xs] of [...m.entries()].sort((a, b) => (a[0] === 'Client unknown') - (b[0] === 'Client unknown') || a[0].localeCompare(b[0]))) {
      const cl = FCD.clients.get(k);
      groups.push([k, `<b style="font-size:14px;color:${k === 'Client unknown' ? 'var(--warn)' : 'var(--accent)'}">${cl && cl.priority ? '<span style="color:var(--warn)">★</span> ' : ''}${esc(k)}</b><span class="faint" style="font-size:12.5px">${plural(new Set(xs.map(x => x.photo)).size, 'photo')}</span>`, xs, false]);
    }
  } else if (state.fView === 'photo') {
    const m = by(c => c.photo);
    for (const [k, xs] of m) {
      const p = FCD.photos.get(k);
      groups.push(['p:' + k, `<div class="frame ours" style="width:54px;aspect-ratio:3/2;border-radius:6px;flex-shrink:0;outline-width:2px;outline-offset:-2px"><img src="${oursImg(p)}" data-our="${esc(k)}" alt=""></div><div style="min-width:0"><b style="font-size:14px">${esc(xs[0].photoName)}</b><div style="font-size:12.5px">${xs[0].clientName ? `<span style="color:var(--accent);font-weight:600">${esc(xs[0].clientName)}</span>` : '<span style="color:var(--warn);font-weight:600">Client unknown</span>'}</div></div>`, xs, false]);
    }
  } else if (state.fView === 'site') {
    const m = by(c => FC.baseOf(c.site));
    for (const [k, xs] of [...m.entries()].sort((a, b) => b[1].length - a[1].length)) groups.push(['s:' + k, `<b style="font-size:14px">${esc(k)}</b><span class="faint" style="font-size:12.5px">${plural(new Set(xs.map(x => x.photo)).size, 'of your photos', 'of your photos')}</span>`, xs, true]);
  } else if (state.fView === 'owner') {
    const m = by(c => { const o = FCD.ownerOf.get(c.site); return o && o.real ? o.key : '~'; });
    for (const [k, xs] of [...m.entries()].sort((a, b) => (a[0] === '~') - (b[0] === '~') || b[1].length - a[1].length)) {
      const o = k === '~' ? null : FCD.owners.find(z => z.key === k);
      const sites = new Set(xs.map(x => x.site));
      groups.push(['o:' + k, o ? `<span class="oav">${esc(o.name[0] || '?')}</span><div style="min-width:0"><b style="font-size:14px">${esc(o.name)}</b> <span class="faint" style="font-size:12.5px">${esc(o.kind)}</span><div class="faint" style="font-size:12.5px">${plural(sites.size, 'of their sites has copies', 'of their sites have copies')}${o.how[0] ? ' · ' + esc(o.how[0]) : ''}</div></div><button class="btn sm" data-act="gowner" data-v="${esc(o.key)}" data-stop="1">About them</button>`
        : `<span class="oav grey">?</span><div style="min-width:0"><b style="font-size:14px">Other sites</b><div class="faint" style="font-size:12.5px">${plural(sites.size, 'site')} with no shared owner found</div></div>`, xs, true]);
    }
  } else groups.push(['', '', rows, false]);
  LIST = [];
  let shown = 0, body = '';
  for (const [k, html, xs, fold] of groups) {
    if (shown >= state.more) break;
    if (html) { const g = groupHead(k, html, xs.length, fold); body += g.html; if (!g.open && !xs.some(x => x.id === state.open)) continue; }
    for (const c of xs) { if (shown >= state.more) break; body += row(c); LIST.push(c.id); shown++; }
  }
  if (rows.length > shown) body += `<tr class="more-row"><td colspan="8"><button class="btn" data-act="fmore">Show ${Math.min(250, rows.length - shown)} more (${rows.length - shown} not shown)</button></td></tr>`;
  const active = [['fClient', state.fClient], ['fUse', state.fUse === 'Any' ? 'Any' : FC.USE[state.fUse][0]], ['fRisk', state.fRisk === 'Any' ? 'Any' : RISK[state.fRisk][0]], ['fCredit', state.fCredit === 'Any' ? 'Any' : CREDIT[state.fCredit]]].filter(([, v]) => v !== 'Any');
  if (state.fShop) active.push(['fShop', 'Selling something']);
  if (state.fOwner) { const o = FCD.owners.find(z => z.key === state.fOwner); active.push(['fOwner', 'Owner: ' + (o ? o.name : '?')]); }
  const sel = (id, label, opts, cur) => `<label>${label}<select data-act="fsel" data-v="${id}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  const quick = (label, n, col, act, v) => `<button class="qstat" data-act="${act}" data-v="${v}"><b style="color:${col}">${n}</b><span>${label}</span></button>`;
  const live = all.filter(c => c.status !== 'removed');
  const countryList = [...new Set([...everything.map(c => c.country).filter(Boolean), 'Russia', 'China', 'Vietnam', 'India', 'Indonesia', 'Turkey', 'Brazil'])].filter(c => !FCD.countries.includes(c)).sort();
  const recent = state.recentHides.filter(h => RS_LISTS.hidden.includes(h));
  const nNew = live.filter(c => c.status === 'new').length;
  if (!everything.length) {
    return `${head('Find copies', 'All copies found', 'Every copy found by every search, Keep searching and today\'s 50.')}
    ${await driveBanner()}
    <section class="card pad" style="text-align:center;padding:48px 22px;display:flex;flex-direction:column;align-items:center;gap:12px"><h2>Nothing found yet</h2><p class="muted" style="margin:0;max-width:56ch">Copies show up here as soon as a search finds them. Turn on Keep searching, run today's 50, or search a few photos now.</p>
    <div class="row" style="justify-content:center"><a class="btn primary" href="#keep">Keep searching</a><a class="btn" href="#search">New search</a></div></section>`;
  }
  return `${head('Find copies', 'All copies found', 'Every copy found by every search, Keep searching and today\'s 50. Click a row for the full story.', `<button class="btn" data-act="fcsv">${ic('down', 18)} Download</button><a class="btn primary" href="#review">Review ${nNew} new</a>`)}
  ${await driveBanner()}
  <div class="row" style="gap:10px">
    ${quick('back online', live.filter(c => c.online === 'back').length, 'var(--bad)', 'ffilter', 'Back online')}
    ${quick('waiting for you', nNew, 'var(--copy)', 'ffilter', 'New')}
    ${quick('selling something', live.filter(c => c.use === 'shop').length, 'var(--ok)', 'qshop', '')}
    ${quick('on suspicious sites', live.filter(c => c.risk.level === 'sus').length, 'var(--bad)', 'qrisk', 'sus')}
    ${quick('credit removed', live.filter(c => c.credit === 'removed').length, 'var(--copy)', 'qcredit', 'removed')}
    ${quick('gone offline', live.filter(c => c.online === 'gone').length, 'var(--muted)', 'ffilter', 'Gone')}
  </div>
  <details class="keyfold"><summary>What do the flags and colours mean?</summary><section class="key" aria-label="What the flags mean" style="margin-top:10px">
    <div class="kitem"><span class="flag" style="color:var(--bad);background:var(--bad-soft)">${FLAG_ICON.sus}</span><div><b>Suspicious site</b><span>Young site, hidden owner, odd ending like .xyz, or a name copycat sites use.</span></div></div>
    <div class="kitem"><span class="flag" style="color:var(--warn);background:var(--warn-soft)">${FLAG_ICON.watch}</span><div><b>Worth a look</b><span>Something is a bit off. Not a clear warning.</span></div></div>
    <div class="kitem"><span class="flag" style="color:var(--copy);background:var(--copy-soft)">${FLAG_ICON.cmi}</span><div><b>Credit removed</b><span>Your client's photo has a copyright line in its hidden data. Their copy doesn't.</span></div></div>
    <div class="kitem"><span class="flag" style="color:var(--ok);background:var(--ok-soft)">${FLAG_ICON.sell}</span><div><b>Selling something</b><span>A shop page, product listing or ad. Commercial use.</span></div></div>
  </section></details>
  <section class="card" style="overflow:hidden">
    <div class="countries">
      <span style="font-weight:600;font-size:14px">Countries</span>
      ${FCD.countries.length ? `<span class="faint" style="font-size:13px">Hiding</span>${FCD.countries.map(c => `<button class="chip" style="cursor:pointer;text-decoration:line-through;text-decoration-color:var(--faint)" data-act="showcountry" data-v="${esc(c)}" title="Show ${esc(c)} again">${esc(c)} <span style="text-decoration:none">↺</span></button>`).join('')}` : '<span class="faint" style="font-size:13px">Showing every country</span>'}
      <select aria-label="Hide a country" data-act="hidecountrysel" class="chip" style="cursor:pointer;min-height:28px"><option value="">＋ Hide a country</option>${countryList.map(c => `<option>${esc(c)}</option>`).join('')}</select>
      ${recent.length ? `<span style="width:1px;height:20px;background:var(--line);margin:0 4px"></span><span style="font-weight:600;font-size:14px">Sites</span><span class="faint" style="font-size:13px">Hiding</span>${recent.map(h => `<button class="chip" style="cursor:pointer;text-decoration:line-through;text-decoration-color:var(--faint)" data-act="showsite" data-v="${esc(h)}" title="Show ${esc(h)} again">${esc(h)} <span style="text-decoration:none">↺</span></button>`).join('')}` : ''}
      <a href="#hidden" style="font-size:13px;font-weight:600;margin-left:${hiddenN ? '0' : 'auto'}">All hidden sites ›</a>
      ${hiddenN ? `<span class="faint" style="font-size:13px;margin-left:auto">${plural(hiddenN, 'copy', 'copies')} hidden by country · click a country to bring it back</span>` : ''}
    </div>
    <div class="toolbar">
      <div class="tabs" role="tablist" aria-label="Status">${['All', 'New', 'Stolen', 'Licensed', 'Still online', 'Back online', 'Gone', 'Removed'].map(f => `<button role="tab" aria-selected="${state.fFilter === f}" class="${state.fFilter === f ? 'on' : ''}" data-act="ffilter" data-v="${f}">${f} <span>${cnt(f)}</span></button>`).join('')}</div>
      <div class="row" style="gap:8px;margin-left:auto">
        <label class="mini">Group<select data-act="fsel" data-v="fView">${[['client', 'By client'], ['photo', 'By photo'], ['site', 'By site'], ['owner', 'By site owner'], ['list', 'No groups']].map(([k, l]) => `<option value="${k}" ${state.fView === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="mini">Sort<select data-act="fsel" data-v="fSort">${[['act', 'Best to act on'], ['pct', 'Lines up most'], ['risk', 'Most suspicious'], ['newest', 'Newest']].map(([k, l]) => `<option value="${k}" ${state.fSort === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        ${HIST.length ? `<button class="btn" style="min-height:36px" data-act="undo" title="Undo: ${esc(HIST[HIST.length - 1].label)}">↶ Undo</button>` : ''}
        <button class="btn" style="min-height:36px" data-act="togglefilters" aria-expanded="${state.showFilters}">Filters${active.length ? ` <span class="pill-n" style="background:var(--accent);margin:0">${active.length}</span>` : ''}</button>
      </div>
    </div>
    ${state.showFilters ? `<div class="filters" style="padding:12px 18px;border-bottom:1px solid var(--line);background:var(--sunk)">
      ${sel('fClient', 'Client', [['Any', 'Any'], ...[...new Set(everything.map(c => c.clientName || 'Client unknown'))].sort().map(n => [n, n])], state.fClient)}
      ${sel('fUse', 'Used as', [['Any', 'Any'], ...Object.entries(FC.USE).map(([k, v]) => [k, v[0]])], state.fUse)}
      ${sel('fRisk', 'Site check', [['Any', 'Any'], ['ok', 'Looks normal'], ['watch', 'Worth a look'], ['sus', 'Suspicious']], state.fRisk)}
      ${sel('fCredit', 'Credit', [['Any', 'Any'], ['kept', 'Credits your client'], ['removed', 'Credit removed'], ['', 'Not checked yet']], state.fCredit)}
      <label style="flex-direction:row;align-items:center;gap:8px;min-height:38px;color:var(--ink);font-size:14px;font-weight:500"><input type="checkbox" data-act="fshop" ${state.fShop ? 'checked' : ''}> Selling something</label></div>` : ''}
    ${active.length ? `<div class="row" style="gap:6px;padding:10px 18px;border-bottom:1px solid var(--line)">${active.map(([k, v]) => `<button class="chip" style="cursor:pointer" data-act="unfilter" data-v="${k}">${esc(v)} ✕</button>`).join('')}<button class="btn ghost" style="min-height:28px;padding:0 6px;font-size:13px" data-act="unfilter" data-v="all">Clear all</button></div>` : ''}
    <div class="scroll"><table class="ftable"><thead><tr><th></th><th>Where</th><th>Used as</th><th>Flags</th><th>Lines up</th><th>Status</th><th>Online</th><th></th></tr></thead><tbody>${body || '<tr><td colspan="8" class="muted" style="padding:28px;text-align:center">Nothing matches. Try clearing a filter.</td></tr>'}</tbody></table></div>
    <div class="row faint" style="gap:14px;padding:10px 18px;border-top:1px solid var(--line);font-size:12.5px"><span>Also kept in Documents › PageProof › found-copies.txt, so a reinstall never loses them. Hidden countries are in hidden-countries.txt.</span></div>
  </section>
  ${state.picked.length ? `<div class="bulk"><b>${state.picked.length} picked</b><button class="btn" style="margin-left:auto" data-act="bulkhide">🚫 Hide these sites</button><button class="btn" data-act="bulk" data-v="removed">🗑 Remove</button><button class="btn" data-act="bulk" data-v="stolen">Mark stolen</button><button class="btn" data-act="clearpick">Clear</button></div>` : ''}
  ${await drawer(LIST)}`;
};
V.found.guard = async () => ((await FC.drive()).done ? null : 'connect');
V.found.after = () => { loadOurs(); bindHover(); };

// Hovering a copy's thumbnail shows it next to your client's photo.
function bindHover() {
  let card = null;
  view.querySelectorAll('img[data-hover]').forEach(img => {
    img.addEventListener('mouseenter', () => {
      const c = FCD && FCD.copies.find(x => x.id === img.dataset.hover);
      if (!c) return;
      const p = FCD.photos.get(c.photo);
      card = document.createElement('div'); card.className = 'hovcard';
      card.innerHTML = `<div class="pair"><div class="frame ours"><img src="${oursImg(p)}" alt=""><span class="lab">Your client's</span></div><div class="frame theirs"><img src="${theirImg(c)}" alt="" referrerpolicy="no-referrer"><span class="lab">Theirs</span></div></div>
        <div class="row" style="gap:8px;font-size:13px"><b>${esc(c.site)}</b>${c.pct >= 0 && c.pct != null ? `<span class="muted">${c.pct}% lines up</span>` : ''}${c.w ? `<span class="faint" style="margin-left:auto">${c.w} × ${c.h}</span>` : ''}</div>`;
      document.body.appendChild(card);
      ppLoadPics(card);
      const b = img.getBoundingClientRect();
      card.style.left = Math.min(innerWidth - card.offsetWidth - 12, b.right + 12) + 'px';
      card.style.top = Math.max(12, Math.min(innerHeight - card.offsetHeight - 12, b.top - 40)) + 'px';
    });
    img.addEventListener('mouseleave', () => { if (card) card.remove(); card = null; });
  });
}

// ---------------------------------------------------------------- answers, with undo
const VERB = { stolen: 'marked stolen', licensed: 'marked licensed', removed: 'removed', skip: 'skipped', new: 'put back as new' };
async function answerCopies(ids, status, label) {
  const undo = await FC.answer(ids, status === 'new' ? 'new' : status);
  // Licensed: this site may use this client's photos, so later copies there are licensed too.
  let undoLic = null;
  if (status === 'licensed') {
    const c = FCD.copies.find(x => x.id === ids[0]);
    const cl = c && c.clientName && await FC.DB.get('clients', c.clientName);
    const had = cl && (cl.licensed || []).includes(FC.baseOf(c.site));
    if (c && c.clientName && !had) { await FC.licenseSite(c.clientName, c.site, true); undoLic = () => FC.licenseSite(c.clientName, c.site, false); }
  }
  if (status === 'removed') {
    for (const id of ids) { const c = FCD.copies.find(x => x.id === id); if (c) learn(c); }
  }
  const h = { label, undo: async () => { await undo(); if (undoLic) await undoLic(); }, open: ids.length === 1 ? ids[0] : '' };
  HIST.push(h);
  FCD = null;
  return h;
}
// "Remove" teaches the photo check quietly: the numbers are kept to tune it later.
async function learn(c) {
  try {
    const st = (await api.storage.local.get('rsLearn')).rsLearn || [];
    st.push({ pct: c.pct, inl: c.inl, tiles: c.tiles, str: c.str, mid: c.mid, was: c.match, site: c.site, at: Date.now() });
    await api.storage.local.set({ rsLearn: st.slice(-500) });
  } catch (e) { /* not important */ }
}
async function undoLast() {
  const h = HIST.pop();
  if (!h) return toast('Nothing to undo.');
  await h.undo();
  FCD = null;
  if (h.open) state.open = h.open;
  toast('Undone: ' + h.label + '. It\'s back the way it was.');
  render(true);
}
function toastUndo(msg) { toast(msg, undoLast); }

// In the details panel: answer, then open the next copy in the same list.
let answering = false;    // a second key press while the first answer is still being saved is ignored
async function drawerVerdict(status) {
  const id = state.open;
  const c = FCD && FCD.copies.find(x => x.id === id);
  if (!c || answering) return;
  answering = true;
  try { await drawerVerdict2(status, id, c); } finally { answering = false; }
}
async function drawerVerdict2(status, id, c) {
  const i = LIST.indexOf(id);
  const nextId = LIST.slice(i + 1).find(x => x !== id) || LIST.slice(0, Math.max(0, i)).reverse().find(x => x !== id) || '';
  await answerCopies([id], status, c.site + ' ' + VERB[status]);
  state.open = nextId;
  toastUndo(c.site + ' ' + VERB[status] + (status === 'stolen' ? '. Save its Evidence report when you\'re ready.' : '.') + (nextId ? ' Next copy opened.' : ''));
  await render(true);
}

async function hideSite(entry, label) {
  await RS_LISTS.load(); await RS_LISTS.add('hidden', entry);
  if (!state.recentHides.includes(entry)) state.recentHides.push(entry);
  FCD = null;
  HIST.push({ label: (label || entry) + ' hidden', undo: async () => { await RS_LISTS.load(); await RS_LISTS.remove('hidden', entry); } });
  toastUndo(entry + ' hidden. It never shows again in any search.');
}

// The current copy's photo file (from Drive), or the small copy if Drive can't be reached.
async function ourBlob(p) {
  try { if (p && p.rel) return await FC.fileFor(p); } catch (e) { /* not reachable */ }
  const th = await FC.thumbOf(p);
  if (th) return (await fetch(th)).blob();
  throw new Error('Your client\'s photo can\'t be opened right now. Check that Google Drive is running.');
}

Object.assign(ACTS, {
  openrow: v => { state.open = v; render(true); },
  closedrawer: () => { state.open = ''; render(true); },
  dverdict: v => drawerVerdict(v),
  undo: () => undoLast(),
  pick: v => { const i = state.picked.indexOf(v); if (i >= 0) state.picked.splice(i, 1); else state.picked.push(v); render(true); },
  clearpick: () => { state.picked = []; render(true); },
  bulk: async v => {
    const ids = state.picked.slice();
    await answerCopies(ids, v, plural(ids.length, 'copy', 'copies') + ' ' + VERB[v]);
    state.picked = [];
    toastUndo(plural(ids.length, 'copy', 'copies') + ' ' + VERB[v] + '.');
    render(true);
  },
  bulkhide: async () => {
    await loadFC();
    const sites = [...new Set(state.picked.map(id => (FCD.copies.find(c => c.id === id) || {}).site).filter(Boolean))];
    await RS_LISTS.load();
    for (const s of sites) { await RS_LISTS.add('hidden', s); if (!state.recentHides.includes(s)) state.recentHides.push(s); }
    HIST.push({ label: plural(sites.length, 'site') + ' hidden', undo: async () => { await RS_LISTS.load(); for (const s of sites) await RS_LISTS.remove('hidden', s); } });
    state.picked = []; FCD = null;
    toastUndo(plural(sites.length, 'site') + ' hidden.');
    render(true);
  },
  gtoggle: v => { const i = state.exp.indexOf(v); if (i >= 0) state.exp.splice(i, 1); else state.exp.push(v); render(true); },
  fmore: () => { state.more += 250; render(true); },
  ffilter: v => { state.fFilter = v; state.more = 250; if (route() !== 'found') location.hash = 'found'; else render(true); },
  qshop: () => { state.fShop = true; state.fFilter = 'All'; render(true); },
  qrisk: v => { state.fRisk = v; state.fFilter = 'All'; render(true); },
  qcredit: v => { state.fCredit = v; state.fFilter = 'All'; render(true); },
  togglefilters: () => { state.showFilters = !state.showFilters; render(true); },
  unfilter: v => { if (v === 'all') Object.assign(state, { fClient: 'Any', fUse: 'Any', fRisk: 'Any', fCredit: 'Any', fShop: false, fOwner: '' }); else state[v] = v === 'fShop' ? false : v === 'fOwner' ? '' : 'Any'; render(true); },
  hidesite: async v => { await hideSite(v); render(true); },
  openhide: () => { const d = document.getElementById('hidebox'); if (d) { d.open = true; d.scrollIntoView({ block: 'center', behavior: 'smooth' }); } },
  showsite: async v => {
    await RS_LISTS.load(); await RS_LISTS.remove('hidden', v); FCD = null;
    HIST.push({ label: v + ' shown again', undo: async () => { await RS_LISTS.load(); await RS_LISTS.add('hidden', v); } });
    toastUndo(v + ' shows again.'); render(true);
  },
  hidecountry: async v => {
    const list = await FC.hiddenCountries();
    if (!list.includes(v)) { await FC.setHiddenCountries([...list, v]); }
    HIST.push({ label: v + ' hidden', undo: async () => FC.setHiddenCountries((await FC.hiddenCountries()).filter(x => x !== v)) });
    FCD = null; state.open = ''; toastUndo('Copies on sites from ' + v + ' are hidden.'); render(true);
  },
  showcountry: async v => {
    await FC.setHiddenCountries((await FC.hiddenCountries()).filter(x => x !== v));
    HIST.push({ label: v + ' shown again', undo: async () => FC.setHiddenCountries([...(await FC.hiddenCountries()), v]) });
    FCD = null; toastUndo(v + ' shows again.'); render(true);
  },
  putback: async () => { const c = FCD.copies.find(x => x.id === state.open); await answerCopies([state.open], 'new', (c ? c.site : 'Copy') + ' put back'); toastUndo('Put back as new.'); render(true); },
  changeans: async () => { const c = FCD.copies.find(x => x.id === state.open); await answerCopies([state.open], 'new', (c ? c.site : 'Copy') + ' answer cleared'); toastUndo('Answer cleared. Choose a new one.'); render(true); },
  copytext: async v => { try { await navigator.clipboard.writeText(v); toast('Copied ' + (v.length > 40 ? 'the full path' : v)); } catch (e) { toast('Could not copy. Select the text and press Ctrl+C.'); } },
  addreg: async v => {
    const i = document.getElementById('regIn');
    if (!i || !(await FC.setReg(v, i.value))) return toast('Type a number like VA 2-318-552 or 1-11583920471.');
    toast('Saved for the whole folder.'); render(true);
  },
  checkonline: async () => {
    const c = await FC.DB.get('copies', state.open);
    if (!c) return;
    toast('Checking ' + c.site + '…');
    const r = await FC.checkOnline(c);
    FCD = null; toast(r.online === 'gone' ? 'Gone: ' + (r.onlineWhy || 'the photo is not on the page') : r.online === 'back' ? 'Back online!' : 'Still online.'); render(true);
  },
  checkcredit: async () => {
    const c = await FC.DB.get('copies', state.open);
    const p = c && await FC.DB.get('photos', c.photo);
    if (!c) return;
    toast('Reading the hidden data in both photos…');
    try {
      const ours = await ourBlob(p);
      const om = (await PP_META.read(new Uint8Array(await ours.arrayBuffer()))).summary;
      const theirs = await PP_EVIDENCE.grabCopy(c);
      const res = PP_EVIDENCE.credit(om, theirs && theirs.meta && theirs.meta.summary);
      if (theirs && theirs.bmp.close) theirs.bmp.close();
      if (!res) { toast(om && (om.copyright || om.creator) ? 'Their copy could not be downloaded.' : 'Your client\'s photo has no copyright line in its hidden data, so there is nothing to compare.'); return; }
      c.credit = res; await FC.DB.put('copies', c); FCD = null;
      toast(res === 'removed' ? 'Credit removed: their copy has no copyright line.' : 'Their copy still credits your client.'); render(true);
    } catch (e) { toast(String(e.message || e)); }
  },
  setclient: async (v, el) => {
    const name = el.value; if (!name) return;
    const c = FCD.copies.find(x => x.id === state.open);
    const undo = await FC.setClientOf(c.photo, name);
    HIST.push({ label: 'client set to ' + name, undo, open: c.id });
    FCD = null; toastUndo('Client set to ' + name + ' for this photo.'); render(true);
  },
  compare: async () => {
    const c = FCD.copies.find(x => x.id === state.open);
    const p = FCD.photos.get(c.photo);
    try {
      const a = await ourBlob(p);
      let b = null, src = '';
      for (const u of [c.img, await FC.thumbOf(c)].filter(Boolean)) { try { const r = await fetch(u, { credentials: 'omit' }); if (r.ok) { b = await r.blob(); src = u; break; } } catch (e) { /* next */ } }
      if (!b) return toast('Their copy could not be downloaded. Open the page and save the photo instead.');
      await PP_DB.put({ id: 'compare-rs', a: { blob: a, name: c.photoName }, b: { blob: b, name: c.site + ' copy', src: src.startsWith('data:') ? c.url : src } });
      api.tabs.create({ url: api.runtime.getURL('compare.html?from=revsearch') });
    } catch (e) { toast(String(e.message || e)); }
  },
  capturecopy: async () => { const c = FCD.copies.find(x => x.id === state.open); if (c) { await api.runtime.sendMessage({ type: 'captureUrl', url: c.url }).catch(() => {}); toast('Opening ' + c.site + ' to capture it…'); } },
  evidence: async v => {
    const c = FCD.copies.find(x => x.id === (v || state.open));
    if (!c) return;
    const caseNo = await PP_EVIDENCE.ask();
    if (caseNo === null) return;
    toast('Making the evidence report…');
    try {
      const p = FCD.photos.get(c.photo);
      const blob = await ourBlob(p);
      const r = await PP_EVIDENCE.make({ blob, name: c.photoName, w: p && p.w, h: p && p.h, hash: (p && p.hash) || await RS_UTIL.sha256(blob), client: c.clientName, path: await FC.pathOf(p), reg: p ? await FC.regFor(p) : null },
        { ...c, use: FC.USE[c.use][0] }, { caseNo, collector: await getName(), owner: await ownerSummary(c.site) });
      const a = document.createElement('a'); a.href = URL.createObjectURL(r.blob); a.download = r.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      await FC.logReport({ id: r.id, file: r.name, url: c.url, site: c.site, photo: c.photoName, client: c.clientName, caseNo });
      if (r.credit) { const cc = await FC.DB.get('copies', c.id); if (cc) { cc.credit = r.credit; await FC.DB.put('copies', cc); } }
      toast('Saved ' + r.name);
    } catch (e) { toast('The report could not be made: ' + (e.message || e)); }
  },
  fsel: (v, el) => { state[v] = el.value; state.more = 250; render(true); },
  fshop: (v, el) => { state.fShop = el.checked; render(true); },
  hidecountrysel: (v, el) => el.value && ACTS.hidecountry(el.value),
  gowner: v => { state.ownerSel = v; location.hash = 'owners'; },
  gowho: v => { const c = FCD.copies.find(x => x.id === v); if (c) { state.who = { site: c.site, url: c.url, copy: c.id }; location.hash = 'who'; } },
  fcsv: async () => {
    await loadFC();
    const head = ['Status', 'Online', 'Client', 'Photo', 'Site', 'Page', 'Lines up %', 'Match', 'Used as', 'Site check', 'Country', 'First seen', 'Last seen', 'Times seen', 'Found by'];
    const rows = FCD.copies.map(c => [STATUS[c.status][0], onlineText(c), c.clientName, c.photoName, c.site, c.url, c.pct == null ? '' : c.pct, c.match, FC.USE[c.use][0], RISK[c.risk.level][0], c.country || '', (c.firstSeen || '').slice(0, 10), (c.lastSeen || '').slice(0, 10), c.times || 1, c.by || '']);
    // Spreadsheet programs run cells that start with = + - @ as formulas, so those get a ' first.
    const q = v => { let t = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + [head, ...rows].map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv' }));
    a.download = 'PageProof_copies_found.csv'; a.click();
  },
});
async function ownerSummary(site) {
  const o = FCD && FCD.ownerOf.get(site);
  const f = FCD && FCD.facts.get(site);
  if (!(o && o.real) && !(f && f.clues && f.clues.length)) return null;
  return { name: o && o.real ? o.name : (f.names || [])[0] || '', kind: o && o.real ? o.kind : '', how: o && o.real ? o.how : [], clues: f ? f.clues : [] };
}

// ---------------------------------------------------------------- Review new copies
function reviewQueue() {
  return FCD.copies.filter(c => c.status === 'new' && visible(c))
    .sort((a, b) => (!!a.skipped - !!b.skipped) || (a.skipped || '').localeCompare(b.skipped || '') || (b.match === 'same') - (a.match === 'same') || (b.pct || 0) - (a.pct || 0));
}
V.review = async () => {
  await loadFC();
  const Q = reviewQueue();
  const hd = head('Find copies', 'Review new copies', 'PageProof found these and checked each one against your client\'s photo. Decide what each one is. Anything marked stolen is watched every week.', `<a class="btn" href="#found">All copies found</a>`);
  const tabs = `<div class="seg" role="tablist" aria-label="Show">${[['review', `To review (${Q.length})`], ['sites', 'By site and company']].map(([k, l]) => `<button role="tab" aria-selected="${state.rvTab === k}" class="${state.rvTab === k ? 'on' : ''}" data-act="rvtab" data-v="${k}">${l}</button>`).join('')}</div>`;
  if (state.rvTab === 'sites') {
    const by = new Map();
    for (const c of Q) { const o = FCD.ownerOf.get(c.site); const k = o && o.real ? o.key : FC.baseOf(c.site); if (!by.has(k)) by.set(k, { o: o && o.real ? o : null, name: o && o.real ? o.name : FC.baseOf(c.site), xs: [] }); by.get(k).xs.push(c); }
    const cards = [...by.values()].sort((a, b) => b.xs.length - a.xs.length).map(g => `<section class="card pad" style="display:flex;flex-direction:column;gap:10px"><div class="row"><h2>${esc(g.name)}</h2><span class="tag grey">${plural(new Set(g.xs.map(x => x.site)).size, 'site')}</span>${g.o ? `<span class="faint" style="font-size:12.5px">${esc(g.o.kind)}</span>` : ''}</div>
      <p class="muted" style="margin:0;font-size:14px;overflow-wrap:anywhere">${esc([...new Set(g.xs.map(x => x.site))].slice(0, 6).join(', '))}${new Set(g.xs.map(x => x.site)).size > 6 ? '…' : ''}</p>
      <div class="row"><span class="tag copy">${plural(g.xs.length, 'new copy', 'new copies')}</span><button class="btn sm" style="margin-left:auto" data-act="rvall" data-v="${esc(g.xs.map(x => x.id).join('\n'))}">Mark all stolen</button></div></section>`).join('');
    return `${hd}${tabs}<div class="grid g2">${cards || '<p class="muted">Nothing waiting for you.</p>'}</div>`;
  }
  if (!Q.length) return `${hd}${tabs}<section class="card pad" style="text-align:center;padding:48px 22px;display:flex;flex-direction:column;align-items:center;gap:12px"><span class="tag ok" style="font-size:14px;padding:6px 14px">${ic('check', 16, 3)} All new copies reviewed</span><h2>Nothing left to review</h2><p class="muted" style="margin:0;max-width:52ch">The ones you marked as stolen are checked every week to see they are still online. Save their evidence reports from All copies found.</p><div class="row" style="justify-content:center">${HIST.length ? `<button class="btn" data-act="undo">↶ Undo: ${esc(HIST[HIST.length - 1].label)}</button>` : ''}<a class="btn primary" href="#found">All copies found</a></div></section>`;
  state.qi = Math.min(state.qi, Q.length - 1);
  const c = Q[0];
  const p = FCD.photos.get(c.photo);
  const o = FCD.ownerOf.get(c.site);
  const id = p && p.hash ? await PP_EVIDENCE.matchId(p.hash, c.url) : '';
  state.rvCurrent = c.id;
  const pics = state.cmpMode === 'swipe'
    ? `<div class="swipe" id="swipe" style="--cut:${state.cut}%"><img data-our="${esc(c.photo)}" src="${oursImg(p)}" alt="Your client's photo"><img class="top-img" src="${theirImg(c)}" alt="Their copy" referrerpolicy="no-referrer"><div class="handle"></div><span class="l1">Your client's</span><span class="l2">Their copy</span></div>
      <input type="range" min="0" max="100" value="${state.cut}" id="cut" aria-label="Slide between your client's photo and their copy">`
    : `<div class="pair"><div class="frame ours"><img data-our="${esc(c.photo)}" src="${oursImg(p)}" alt="Your client's photo" style="object-fit:contain"><span class="lab">Your client's</span></div><div class="frame theirs"><img src="${theirImg(c)}" alt="Their copy" referrerpolicy="no-referrer" style="object-fit:contain"><span class="lab">Their copy</span></div></div>`;
  return `${hd}${tabs}
  <div class="row"><div class="queue" aria-label="Review progress">${Q.slice(0, 40).map((_, i) => `<i class="${i === 0 ? 'cur' : ''}"></i>`).join('')}</div><span class="muted" style="font-size:13.5px">${plural(Q.length, 'new copy', 'new copies')} to go${c.skipped ? ' · skipped before' : ''}</span>
  <div class="seg" style="margin-left:auto" role="radiogroup" aria-label="View">${[['side', 'Side by side'], ['swipe', 'Swipe']].map(([k, l]) => `<button role="radio" aria-checked="${state.cmpMode === k}" class="${state.cmpMode === k ? 'on' : ''}" data-act="cmode" data-v="${k}">${l}</button>`).join('')}</div></div>
  <div class="split">
    <section class="card pad review-cap" style="flex:3 1 520px;display:flex;flex-direction:column;gap:14px" aria-label="Your client's photo and their copy">
      ${pics}
      ${HIST.length ? `<button class="btn" style="min-height:34px;justify-content:flex-start;font-size:13.5px;width:100%" data-act="undo">↶ Undo: ${esc(HIST[HIST.length - 1].label)}<span class="kbd" style="margin-left:auto">U</span></button>` : ''}
      <div class="verdicts">
        <button class="vbtn stolen" data-act="rverdict" data-v="stolen"><b>Stolen <span class="kbd">Y</span></b><span>Watch it, save evidence</span></button>
        <button class="vbtn" data-act="rverdict" data-v="licensed"><b>Licensed <span class="kbd">L</span></b><span>OK for ${esc(c.clientName || 'this client')} only</span></button>
        <button class="vbtn" data-act="rverdict" data-v="removed"><b>🗑 Remove <span class="kbd">N</span></b><span>Not wanted, hide it</span></button>
        <button class="vbtn" data-act="rverdict" data-v="skip"><b>Skip <span class="kbd">→</span></b><span>Decide later</span></button>
      </div>
    </section>
    <aside class="card pad" style="flex:2 1 320px;display:flex;flex-direction:column;gap:16px" aria-label="About this copy">
      <div><div class="row" style="gap:8px"><h2 style="overflow-wrap:anywhere">${esc(c.site)}</h2><span class="tag ${c.match === 'same' ? 'bad' : 'warn'}">${c.match === 'same' ? 'Same photo' : 'Maybe'}${c.pct >= 0 && c.pct != null ? ' · ' + c.pct + '% lines up' : ''}</span></div><a href="${safeUrl(c.url)}" target="_blank" rel="noreferrer" class="mono" style="overflow-wrap:anywhere;display:block;margin-top:4px">${esc(c.url)}</a></div>
      <dl class="facts">
        <dt>Your client's photo</dt><dd>${esc(c.photoName)}<br><span class="muted">${p && p.w ? p.w + ' × ' + p.h + ' · ' : ''}${esc(c.clientName || 'Client unknown')}</span></dd>
        <dt>Their copy</dt><dd>${c.w ? c.w + ' × ' + c.h : 'Size not known'} · ${esc(FC.USE[c.use][0])}</dd>
        <dt>Found by</dt><dd>${esc(c.by || 'a search')} · ${shortDate(c.firstSeen)}</dd>
        <dt>History</dt><dd>${c.times > 1 ? 'Seen ' + c.times + ' times, last ' + shortDate(c.lastSeen) : 'First time seen'}</dd>
        <dt>Site check</dt><dd>${RISK[c.risk.level][0]}${c.risk.why.length ? ' · ' + esc(c.risk.why.join(', ')) : ''}</dd>
        ${o && o.real ? `<dt>Company</dt><dd>${esc(o.name)}${o.sites.length > 1 ? `<br><span class="muted" style="font-size:13px">${Q.filter(x => o.sites.includes(x.site)).length} new copies on their sites. Use "By site and company" to mark them all at once.</span>` : ''}</dd>` : ''}
        ${id ? `<dt>Match ID</dt><dd class="mono">${id}</dd>` : ''}
      </dl>
      <div class="row"><button class="btn primary" data-act="evidence" data-v="${esc(c.id)}">${ic('doc', 18)} Evidence report</button><button class="btn" data-act="rvcompare">Compare closely</button><a class="btn" href="${safeUrl(c.url)}" target="_blank" rel="noreferrer">${ic('link', 16)} Open page</a></div>
    </aside>
  </div>
  <p class="faint" style="font-size:13px;margin:0">Keyboard: <span class="kbd">Y</span> stolen, <span class="kbd">L</span> licensed, <span class="kbd">N</span> remove, <span class="kbd">→</span> skip, <span class="kbd">U</span> undo, <span class="kbd">S</span> switch view.</p>`;
};
V.review.guard = V.found.guard;
V.review.after = () => {
  loadOurs();
  const cut = document.getElementById('cut');
  if (cut) cut.oninput = () => { state.cut = +cut.value; document.getElementById('swipe').style.setProperty('--cut', cut.value + '%'); };
};
Object.assign(ACTS, {
  rvtab: v => { state.rvTab = v; render(true); },
  cmode: v => { state.cmpMode = v; render(true); },
  rverdict: async v => {
    const c = FCD && FCD.copies.find(x => x.id === state.rvCurrent);
    if (!c || answering) return;
    answering = true;
    try {
      await answerCopies([c.id], v, c.site + ' ' + VERB[v]);
      toastUndo(c.site + ' ' + VERB[v] + '.');
      await render(true);
    } finally { answering = false; }
  },
  rvall: async v => {
    const ids = v.split('\n').filter(Boolean);
    await answerCopies(ids, 'stolen', plural(ids.length, 'copy', 'copies') + ' marked stolen');
    toastUndo(plural(ids.length, 'copy', 'copies') + ' marked stolen.'); render(true);
  },
  rvcompare: () => { state.open = state.rvCurrent; return ACTS.compare(); },
});

// Keyboard: answers in the details panel and on Review.
document.addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) return;
  if (document.querySelector('dialog[open]')) return;
  const r = route();
  if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) { if (HIST.length && ['found', 'review', 'owners'].includes(r)) { e.preventDefault(); undoLast(); } return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const map = { y: 'stolen', l: 'licensed', n: 'removed', Delete: 'removed', ArrowRight: 'skip' };
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === 'u' && HIST.length && ['found', 'review'].includes(r)) { e.preventDefault(); undoLast(); return; }
  if (r === 'found' && state.open) {
    if (k === 'Escape') { state.open = ''; render(true); return; }
    const c = FCD && FCD.copies.find(x => x.id === state.open);
    if (map[k] && c && c.status !== 'removed') { e.preventDefault(); drawerVerdict(map[k]); }
  } else if (r === 'review' && state.rvTab === 'review') {
    if (map[k]) { e.preventDefault(); ACTS.rverdict(map[k]); }
    else if (k === 's') { state.cmpMode = state.cmpMode === 'side' ? 'swipe' : 'side'; render(true); }
  }
});

// Shown on Find copies pages when Google Drive can't be reached or needs a click.
async function driveBanner() {
  const st = await FC.driveStateSoft();
  if (st === 'prompt') return `<div class="banner warn" role="alert">${ic('help', 22)}<div style="flex:1 1 260px;min-width:0"><b>One click needed: let PageProof read your photos again</b><div style="font-size:13.5px">Your browser asks once after it restarts. Searching waits until you press Allow.</div></div><button class="btn primary" data-act="driveallow">Allow</button></div>`;
  if (st === 'offline') return `<div class="banner bad" role="alert">${ic('help', 22)}<div style="flex:1 1 260px;min-width:0"><b>Can't reach Google Drive. Searching is paused.</b><div style="font-size:13.5px;color:var(--ink)">Drive for desktop is signed out or not running, so the photos folder is missing. Nothing is lost: it picks up where it left off.</div></div><button class="btn primary" data-act="driveretry">Try again</button></div>`;
  return '';
}
Object.assign(ACTS, {
  driveallow: async () => { if (await FC.allowDrive()) { toast('Thanks. PageProof can read your photos again.'); } render(true); },
  driveretry: async () => { const st = await FC.driveStateSoft(true); toast(st === 'granted' ? 'Google Drive is back. Searching carries on.' : 'Still can\'t reach Google Drive.'); render(true); },
});
