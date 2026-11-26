// Clients › Clients and photos in the calm look (step 12), with Registrations inside it.
//   #clients                       every client: tiles, command bar, one calm line per client
//   #clients?reg=none|app|done     the same page with the Registrations panel open
//   #clients?reg=none&folder=…     … opened from a copy's Claim tab: that photo's folder is lit
//   #photos                        one client's photos: folders with their numbers, filters, a photo panel
// The workings (FC.setClients, FC.setFlag, FC.setStopped, FC.setReg, FC.scan) are the same as before;
// this file only draws the pages and adds the few new buttons. Loaded after fc-photos.js and
// pp-newtools.js, so the V.clients / V.photos / V.regs here are the ones used.
const CLI = (() => {
  const s = (p, z = 16) => `<svg viewBox="0 0 16 16" width="${z}" height="${z}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const f = p => `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">${p}</svg>`;
  return {
    people: s('<circle cx="6" cy="5.5" r="2.4"/><path d="M1.8 13.5c.5-2.5 2.2-3.8 4.2-3.8s3.7 1.3 4.2 3.8"/><path d="M10.5 3.4a2.3 2.3 0 0 1 0 4.4M12 9.9c1.2.5 2 1.7 2.3 3.6"/>'),
    skip: s('<circle cx="8" cy="8" r="6.2"/><path d="M3.6 12.4 12.4 3.6"/>'),
    doc: s('<path d="M4 1.8h5.5L12.5 5v9.2H4z"/><path d="M9.5 1.8V5h3M6 8.5l1.5 1.5L10.5 7"/>'),
    refresh: s('<path d="M13.5 8A5.5 5.5 0 1 1 11.6 3.8"/><path d="M13.5 2.5v3.2h-3.2"/>'),
    folder: s('<path d="M1.8 4.2a1 1 0 0 1 1-1h3.4l1.4 1.6h5.6a1 1 0 0 1 1 1v6.9a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1z"/>'),
    more: s('<circle cx="3.5" cy="8" r=".9" fill="currentColor"/><circle cx="8" cy="8" r=".9" fill="currentColor"/><circle cx="12.5" cy="8" r=".9" fill="currentColor"/>'),
    star: s('<path d="m8 2 1.8 3.8 4.1.5-3 2.8.8 4.1L8 11.2 4.3 13.2l.8-4.1-3-2.8 4.1-.5z"/>'),
    starf: f('<path fill="currentColor" d="m8 2 1.8 3.8 4.1.5-3 2.8.8 4.1L8 11.2 4.3 13.2l.8-4.1-3-2.8 4.1-.5z"/>'),
    flag: s('<path d="M3.5 14V2.5M3.5 3h8l-1.8 3 1.8 3h-8"/>'),
    flagf: f('<path d="M3.5 14V2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path fill="currentColor" d="M3.5 3h8l-1.8 3 1.8 3h-8z"/>'),
    stop: s('<rect x="4" y="4" width="8" height="8" rx="1"/>'),
    chevd: s('<path d="m3.5 6 4.5 4.5L12.5 6"/>', 14),
    back: s('<path d="M13 8H3M7 4 3 8l4 4"/>'),
    help: s('<circle cx="8" cy="8" r="6.2"/><path d="M6.3 6.2a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1v.4M8 11.4v.1"/>'),
    twin: s('<rect x="1.5" y="4" width="7" height="8" rx="1"/><rect x="7.5" y="4" width="7" height="8" rx="1"/>'),
    x: s('<path d="M4 4l8 8M12 4l-8 8"/>'),
    check: s('<path d="m3 8.5 3.2 3L13 4.5"/>'),
    copy: s('<rect x="5" y="5" width="8.5" height="8.5" rx="1"/><path d="M11 5V3.5a1 1 0 0 0-1-1H3.5a1 1 0 0 0-1 1V10a1 1 0 0 0 1 1H5"/>'),
    sheet: s('<rect x="2" y="2.5" width="12" height="11" rx="1.2"/><path d="M2 6h12M2 9.5h12M6 2.5v11"/>'),
    hint: s('<path d="M5.6 11.2a4.2 4.2 0 1 1 4.8 0v1.3H5.6z"/><path d="M6.3 14.3h3.4"/>'),
  };
})();
Object.assign(state, { cSel: '', cMenu: false, cShow: 60, phFilter: 'all', phSort: 'new', phSize: 'l', phSel: '', phHelp: false, phBarX: {}, regQ: '', regClient: '', regMore: 60 });
const clBtn = (i, t, act, v, cls = '', extra = '') => `<button class="clcb ${cls}" data-act="${act}"${v != null ? ` data-v="${esc(v)}"` : ''}${extra}>${i || ''}${t ? `<span>${t}</span>` : ''}</button>`;
const clAv = (n, z) => kAv(n).replace('class="kav"', `class="kav cav"${z ? ` data-z="${z}"` : ''}`).replace('style="', `style="${z ? `width:${z}px;height:${z}px;font-size:${Math.round(z * 0.38)}px;` : ''}`);
const clTile = (c, i, b, l, s, attrs = '') => `<div class="card kt2"${attrs}>${kSq(c, i, 40)}<span><b class="num">${b}</b><span class="l">${l}</span><span class="s">${s}</span></span></div>`;
const clAgo = iso => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return !iso || isNaN(m) ? '' : m < 2 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) === 1 ? 'yesterday' : Math.round(m / 1440) + ' days ago'; };
const clDays = iso => { const d = Math.round((Date.now() - Date.parse(iso)) / 864e5); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago'; };
// "…/Registered images/2024/Q3 1-123" reads "2024 › Q3"
const regShort = f => String(f || '').split('/Registered images/').pop().replace(/\s+(1-\d+|VA[\d -]+)$/i, '').split('/').slice(-2).join(' › ') || 'No folder';
const regChip = r => r && r.va ? `<span class="rgc ok" title="Registered: ${esc(r.va)}">${esc(r.va)}</span>` : r && r.app ? `<span class="rgc warn" title="Applied for: ${esc(r.app)}">Applied</span>` : '<span class="rgc bad" title="No registration number found">No number</span>';
const regArg = () => state.shown === 'clients' ? routeArg('reg') || '' : '';

// ---------------------------------------------------------------- Registrations (panel + card)
async function regData() {
  const rows = await ntRegRows(), cut = Date.now() - 30 * 864e5;
  return { rows, none: rows.filter(r => r.st === 'none'), app: rows.filter(r => r.st === 'app'), done: rows.filter(r => r.st === 'va' && r.vaAt && Date.parse(r.vaAt) > cut) };
}
function regNumberBox(folder, st, lit) {
  if (!folder) return '<span class="kfaint">No folder</span>';
  return `<span class="rgin${lit ? ' focus' : ''}"><input placeholder="${st === 'app' ? 'Add the VA number' : 'VA… or 1-… number'}" data-reg="${esc(folder)}" aria-label="Registration number for this folder"><button class="btn kbtn" data-act="regsave" data-v="${esc(folder)}">${CLI.check}Save</button></span>`;
}
async function regPanel(R, tab) {
  const RM = (await FC.meta.get('regs')) || {};
  const q = state.regQ.trim().toLowerCase(), hl = routeArg('folder') || '';
  const clients = [...new Set(R.rows.map(r => r.p.client || 'Client unknown'))].sort((a, b) => a.localeCompare(b));
  const list = R[tab].filter(r => (!state.regClient || (r.p.client || 'Client unknown') === state.regClient) && (!q || r.p.name.toLowerCase().includes(q) || String(r.p.folder || '').toLowerCase().includes(q)))
    .sort((a, b) => (hl ? (b.p.folder === hl) - (a.p.folder === hl) : 0) || b.stolen - a.stolen || b.copies - a.copies || String(b.last).localeCompare(String(a.last)));
  const shown = list.slice(0, state.regMore), byCl = new Map();
  for (const r of shown) { const k = r.p.client || 'Client unknown'; if (!byCl.has(k)) byCl.set(k, new Map()); const m = byCl.get(k), f = r.p.folder || ''; if (!m.has(f)) m.set(f, []); m.get(f).push(r); }
  const prow = r => `<div class="rgp-row"><img class="rgth" src="${r.p.thumb ? safeImg(r.p.thumb) : r.p.th ? (FC.pics.seen(r.p.id) || lazyPic(r.p)) : 'icons/icon48.png'}" alt="" loading="lazy"><span class="kn1"><b title="${esc(r.p.name)}">${esc(r.p.name)}</b></span>
    <span class="rgv"><b class="num">${r.copies}</b><span>${r.copies === 1 ? 'copy' : 'copies'}</span></span>
    <span class="rgv ${r.stolen ? 'bad' : 'zero'}">${r.stolen ? `<b class="num">${r.stolen}</b><span>Stolen</span>` : ''}</span>
    <a class="rgcp" href="#found?photo=${encodeURIComponent(r.p.id)}">Copies ${KI.chev}</a></div>`;
  const fhead = (f, rs) => {
    const r = rs[0].r || {}, from = (RM[f] || {}).from || '', lit = !!hl && f === hl;
    const st = tab === 'none' ? '<span class="rgst none">No number</span>' : tab === 'app' ? `<span class="rgst app">Applied <span class="mono">${esc(r.app || '')}</span></span>` : `<span class="rgst ok">${CLI.check}<span class="mono">${esc(r.va || '')}</span></span>`;
    const box = tab === 'done' ? `<span class="rgfrom">${/Excel/i.test(from) ? CLI.sheet : CLI.folder}<span>${/Excel/i.test(from) ? 'Found in the Excel file' : /Typed/i.test(from) ? 'Typed in by you' : 'Found in the folder name'} · ${clDays(rs[0].vaAt)}</span></span>` : regNumberBox(f, tab, lit);
    return `<div class="rgf${lit ? ' hl' : ''}" data-folder="${esc(f)}"><div class="rgfh">${CLI.folder}<span class="kn1"><b title="${esc(f)}">${esc(regShort(f))}</b><span>${plural(rs.length, 'photo')} with copies</span></span>${st}${box}</div>
      ${lit ? `<div class="rghl">${KI.info}<span>Opened from a copy's Claim tab: this is that photo's folder.</span></div>` : ''}${rs.map(prow).join('')}</div>`;
  };
  const groups = [...byCl].map(([cl, fm]) => { const all = [...fm.values()].flat(), s = all.reduce((a, r) => a + r.stolen, 0);
    return `<section class="rgg"><div class="rgch">${kAv(cl)}<b>${esc(cl)}</b><span class="kfaint">${plural(all.length, 'photo')}${s ? ` · <span class="badc">${s} Stolen</span>` : ''}</span></div>${[...fm].map(([f, rs]) => fhead(f, rs)).join('')}</section>`; }).join('');
  const empty = `<div class="rgempty" id="regEmpty">${kSq(KC.green, CLI.check, 44)}<b>${q || state.regClient ? 'Nothing matches' : tab === 'done' ? 'No photo with copies got its VA number in the last 30 days' : 'Every photo with copies has a number'}</b><span class="kfaint">${q || state.regClient ? 'Try another word or pick All clients.' : 'Nothing to do here.'}</span></div>`;
  const tabs = `<div class="utabs rgtabs" role="tablist">${[['none', 'Not registered'], ['app', 'Applied, no VA yet'], ['done', 'Registered lately']].map(([k, l]) => `<button role="tab" aria-selected="${k === tab}" class="${k === tab ? 'on' : ''}" data-act="regtab" data-v="${k}">${l} <span>${R[k].length}</span></button>`).join('')}</div>`;
  const cmd = `<div class="rgcmd"><label class="ksearch">${KI.search}<input type="search" id="regQ" placeholder="Find a photo or folder" aria-label="Find a photo or folder" value="${esc(state.regQ)}"></label>
    <label class="ksort"><select data-act="regclient" aria-label="Which client"><option value="">All clients</option>${clients.map(c => `<option ${c === state.regClient ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label><span class="sp"></span>
    ${tab !== 'done' && list.length ? `<button class="btn kbtn" data-act="regcopy" data-v="${tab}">${CLI.copy}Copy for the registrar</button>` : ''}</div>`;
  const how = `<div class="rghow" id="regHow">${CLI.hint}<span><b>How numbers are found.</b> PageProof reads VA… and 1-… numbers from folder names and Excel files in the photo's folder, every time it looks for new photos. When a VA number turns up, the photo moves to Registered lately by itself. A number typed here counts for the whole folder.</span></div>`;
  return `<aside class="cpanel rgpanel" id="regPanel" aria-label="Registrations"><div class="rgph2">${kSq(KC.purple, CLI.doc, 36)}<span class="kn1"><b>Registrations</b><span>Photos with copies found but no VA number yet</span></span><span class="sp"></span><button class="kx" data-act="regclose" aria-label="Close" title="Close">✕</button></div>
    ${tabs}${cmd}<div class="rgscroll" id="regList">${groups || empty}${list.length > shown.length ? `<button class="btn kbtn" data-act="regmore2" style="align-self:center">Show ${Math.min(60, list.length - shown.length)} more</button>` : ''}${how}</div></aside>`;
}

// ---------------------------------------------------------------- every client
V.clients = async () => {
  const clients = await FC.DB.all('clients');
  const copies = await FC.allCopies();
  const nNew = {}, nAll = {};
  for (const c of copies) { const k = c.client || ''; if (c.status === 'new') nNew[k] = (nNew[k] || 0) + 1; if (c.status !== 'removed') nAll[k] = (nAll[k] || 0) + 1; }
  const q = state.cQ.toLowerCase();
  const tabs = { All: () => true, Priority: c => c.priority, 'With new copies': c => nNew[c.name], 'Not searching': c => c.searching !== true };
  if (!tabs[state.cTab]) state.cTab = 'All';
  const off = c => c.searching !== true;
  const list = clients.filter(tabs[state.cTab]).filter(c => !q || c.name.toLowerCase().includes(q))
    .sort((a, b) => (off(a) - off(b)) || (state.cSort === 'new' ? (nNew[b.name] || 0) - (nNew[a.name] || 0) : state.cSort === 'photos' ? (b.photos || 0) - (a.photos || 0) : (b.priority - a.priority)) || a.name.localeCompare(b.name));
  const sc = await FC.meta.get('scan');
  const nSkipped = (await FC.skipped()).length;
  const F1 = ((await FC.coverage().catch(() => null)) || {}).first || {}, once = (F1.clients || {});
  const spC = await FC.speed();
  const rateC = firstPerDay(await FC.keep(), await ppHardware(), F1.week || 0, spC, (await api.storage.local.get('fcLadder')).fcLadder || null);
  const doneBy = Object.fromEntries(firstClientRows(F1).map(r => [r.name, r.left <= 0 ? 'Done' : firstDoneBy(r.need, rateC)]));
  const allBy = F1.never ? firstDoneBy(F1.never, rateC) : '';
  const R = await regData(), tab = ['none', 'app', 'done'].includes(regArg()) ? regArg() : '';
  const per = {}; for (const k of ['none', 'app']) for (const r of R[k]) { const c = r.p.client || ''; (per[c] = per[c] || { none: 0, app: 0 })[k]++; }
  const onN = clients.filter(c => !off(c)).length, tot = clients.reduce((a, c) => a + (c.photos || 0), 0), pctAll = F1.total ? Math.floor(F1.done / F1.total * 100) : 0;

  const tiles = `<div class="ktiles2 cltiles" id="clientTiles">
    ${clTile(KC.purple, CLI.people, onN + ' of ' + clients.length, 'Clients searched', clients.filter(c => c.priority).length + ' priority · ' + (clients.length - onN) + ' switched off')}
    ${clTile(KC.blue, KI.photo, tot.toLocaleString(), 'Photos', sc ? (sc.added ? sc.added.toLocaleString() + ' new · ' : '') + 'looked ' + clAgo(sc.at) : 'Not looked yet')}
    ${clTile(KC.green, KI.ring, F1.total ? pctAll + '%' : '…', 'Searched once', F1.total ? (allBy ? 'Every photo ' + esc(allBy.replace('~ ', 'by about ')) : F1.done >= F1.total ? 'Every photo has been searched' : 'Speed shows after a day') : 'Counting your photos', ' id="clientSpeed"' + (spC.days ? ` title="${Math.round(spC.full).toLocaleString()} photos a day this week${spC.quick ? ', plus ' + Math.round(spC.quick).toLocaleString() + ' quick looks a day' : ''}"` : ' title="Speed shows after a day of searching"'))}
    <button class="card kt2 rgtile${tab ? ' on' : ''}" id="regTile" data-act="regopen" data-v="none">${kSq(KC.purple, CLI.doc, 40)}<span><b class="num">${R.none.length}</b><span class="l">Need a registration</span><span class="s">${R.app.length} applied, waiting for VA</span></span></button>
    <a class="card kt2" id="skipTile" href="#skipped">${kSq(nSkipped ? KC.amber : KC.grey, CLI.skip, 40)}<span><b class="num">${nSkipped.toLocaleString()}</b><span class="l">Skipped photos</span><span class="s">${nSkipped ? 'See why ›' : 'Nothing skipped'}</span></span></a></div>`;
  const cmd = `<div class="clcmd" id="clientCmd">
    <button class="clcb" data-act="cscan"${FC.SCAN.busy ? ' disabled data-why="PageProof is already looking for new photos. Wait for it to finish."' : ''}>${CLI.refresh}<span>${FC.SCAN.busy ? 'Looking…' : 'Look for new photos'}</span></button>
    <button class="clcb rgbtn${tab ? ' on' : ''}" id="regBtn" data-act="regopen" data-v="${tab ? '' : 'none'}" aria-pressed="${!!tab}">${CLI.doc}<span>Registrations</span>${R.none.length ? `<span class="rgbadge">${R.none.length}</span>` : ''}</button><span class="clsep"></span>
    <div class="wseg kseg" role="tablist" aria-label="Which clients">${[['All', 'All'], ['Priority', 'Priority'], ['With new copies', 'New copies'], ['Not searching', 'Not searching']].map(([t, l]) => `<button role="tab" aria-selected="${state.cTab === t}" class="${state.cTab === t ? 'on' : ''}" data-act="ctab" data-v="${t}">${l} <span>${clients.filter(tabs[t]).length}</span></button>`).join('')}</div><span class="sp"></span>
    <label class="ksearch">${KI.search}<input type="search" id="cQ" placeholder="Find a client" aria-label="Find a client" value="${esc(state.cQ)}"></label>
    <label class="ksort"><select data-act="csort" aria-label="Sort clients">${[['name', 'Priority, then A to Z'], ['new', 'Most new copies'], ['photos', 'Most photos']].map(([k, l]) => `<option value="${k}" ${state.cSort === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <span class="clmenu"><button class="clcb ico" data-act="cmenu" aria-label="More" aria-expanded="${!!state.cMenu}" title="More">${CLI.more}</button>${state.cMenu ? `<div class="wmenu" role="menu" id="clientMenu"><a role="menuitem" href="#connect" data-act="csreset">${CLI.folder}Change folder</a></div>` : ''}</span></div>`;
  const row = c => { const [d, t] = once[c.name] || [0, 0], pct = t ? Math.floor(d / t * 100) : 0, o = !off(c), x = per[c.name] || {}, sel = state.cPicked.includes(c.name);
    return `<div class="clr2${o ? '' : ' off'}${sel ? ' sel' : ''}" data-act="cphotos" data-v="${esc(c.name)}" data-name="${esc(c.name)}" title="Open ${esc(c.name)}'s photos">
      <input type="checkbox" data-act="cpick" data-v="${esc(c.name)}" ${sel ? 'checked' : ''} aria-label="Pick ${esc(c.name)}">
      <span class="cname">${clAv(c.name, 32)}<a href="#photos" data-act="cphotos" data-v="${esc(c.name)}"><b>${esc(c.name)}</b></a><button class="cpri${c.priority ? ' on' : ''}" data-act="cstar" data-v="${esc(c.name)}" aria-pressed="${!!c.priority}" aria-label="Priority client" title="${c.priority ? 'Priority client: searched right after High priority photos' : 'Make a priority client'}">${c.priority ? CLI.starf : CLI.star}</button>${c.extra ? '<span class="ktag">Own folder</span>' : ''}</span>
      <span class="r num">${(c.photos || 0).toLocaleString()}</span>
      ${t ? `<span class="clbar" title="${d.toLocaleString()} of ${t.toLocaleString()} photos searched at least once"><span class="cbar"><i style="width:${pct}%"></i></span><b class="num">${pct}%</b></span>` : '<span class="kfaint">Not counted yet</span>'}
      <span class="kfaint num cdone">${!o ? 'Paused' : t ? esc(String(doneBy[c.name] || '').replace('~ ', '')) : ''}</span>
      <span class="r num">${(nAll[c.name] || 0).toLocaleString()}</span>
      <span>${nNew[c.name] ? `<a class="ktag acc" href="#found" data-act="cfound" data-v="${esc(c.name)}">${nNew[c.name].toLocaleString()} new</a>` : ''}</span>
      <span class="rgcol">${x.none ? `<button class="rgchip none" data-act="regopen" data-v="none|${esc(c.name)}">${x.none} need a number</button>` : ''}${x.app ? `<button class="rgchip app" data-act="regopen" data-v="app|${esc(c.name)}">${x.app} applied</button>` : ''}</span>
      <span class="clsw"><label class="switch"><input type="checkbox" data-act="csearch" data-v="${esc(c.name)}" aria-label="Search for ${esc(c.name)}" ${o ? 'checked' : ''}><span></span></label><span class="wswl">${o ? 'On' : 'Off'}</span></span>${KI.chev}</div>`; };
  const shown = list.slice(0, state.cShow);
  const tbl = `<section class="card cllist" id="clientList"><div class="clh2"><span></span><span>Client</span><span class="r">Photos</span><span>Searched once</span><span>Done by</span><span class="r">Copies</span><span>New</span><span>Registration</span><span>Searching</span><span></span></div>
    ${shown.map(row).join('') || '<p class="kmuted" id="clientNone" style="padding:24px 0;text-align:center;margin:0">No clients here.</p>'}
    ${list.length > shown.length ? `<div class="clshow"><button class="btn kbtn" data-act="cmore">Show ${Math.min(60, list.length - shown.length)} more clients</button></div>` : ''}</section>`;
  const foot = state.scanText ? `<div class="scanbar"><span class="spin"></span>${esc(state.scanText)}</div>`
    : `<p class="kfoot clfoot" id="clientFoot">${KI.clock}<span>${sc ? `Last looked for new photos ${fmtDate(sc.at)}${sc.added ? ' and found ' + sc.added.toLocaleString() : ''}. ` : ''}PageProof looks in this and last quarter's folders every hour, and in every folder once a week on a weekday (8 AM to 6 PM).</span></p>`;
  const n = state.cPicked.length;
  const bulk = n ? `<div class="clfloat" id="clientBulk"><b>${n} picked</b><span class="clsep"></span>${clBtn(KI.play, 'Start searching', 'cbulk', 'start')}${clBtn(KI.pause, 'Stop searching', 'cbulk', 'stop')}${clBtn(CLI.star, 'Make priority', 'cbulk', 'pri')}${clBtn(CLI.people, 'Make normal', 'cbulk', 'norm')}<span class="clsep"></span>${clBtn(CLI.x, 'Clear', 'cbulk', 'clear')}</div>` : '';
  const panel = tab ? await regPanel(R, tab) : '';
  document.body.classList.toggle('cpopen', !!panel);
  return head('Clients', 'Clients and photos', '') + (await driveBanner()) + `<div class="rvn kpn crn cln${panel ? ' withpanel rgopen' : ''}">${tiles}${cmd}${tbl}${foot}</div>${bulk}${panel}`;
};
V.clients.guard = V.found.guard;
const clKeepFocus = (id, set, more) => { const i = document.getElementById(id); if (i) i.oninput = () => { set(i.value); clearTimeout(i._t); i._t = setTimeout(() => render(true).then(() => { const j = document.getElementById(id); if (j) { j.focus(); j.setSelectionRange(j.value.length, j.value.length); } }), 250); }; };
V.clients.after = () => {
  clKeepFocus('cQ', v => { state.cQ = v; state.cShow = 60; });
  clKeepFocus('regQ', v => { state.regQ = v; state.regMore = 60; });
  document.querySelectorAll('#regPanel input[data-reg]').forEach(i => { i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); ACTS.regsave(i.dataset.reg); } }; });
  const lit = document.querySelector('#regPanel .rgf.hl'); if (lit && !lit.dataset.seen) { lit.dataset.seen = 1; lit.scrollIntoView({ block: 'nearest' }); }
  if (typeof lazyThumbsIn === 'function') lazyThumbsIn(document.getElementById('regPanel'));
};
const regGo = (tab, folder) => { const h = 'clients' + (tab ? '?reg=' + tab + (folder ? '&folder=' + encodeURIComponent(folder) : '') : ''); if (location.hash === '#' + h) return render(true); history.replaceState(null, '', '#' + h); render(true); };
// The old address still works: #regs opens Clients and photos with the panel.
V.regs = async () => { setTimeout(() => location.replace('#clients?reg=none'), 0); return ''; };
Object.assign(ACTS, {
  cmore: () => { state.cShow += 60; render(true); },
  cmenu: () => { state.cMenu = !state.cMenu; render(true); },
  regopen: v => { const [tab, client] = String(v || '').split('|'); state.regClient = client || ''; state.regQ = ''; state.regMore = 60; state.cMenu = false; regGo(tab); },
  regclose: () => regGo(''),
  regtab: v => { state.regMore = 60; regGo(v); },
  regclient: (v, el) => { state.regClient = el.value; state.regMore = 60; render(true); },
  regmore2: () => { state.regMore += 60; render(true); },
  regsave: async v => {
    const el = [...document.querySelectorAll('input[data-reg]')].find(i => i.dataset.reg === v);
    if (!el || !el.value.trim()) return toast('Type the VA number or the 1-… application number first.');
    if (!(await FC.setReg(v, el.value))) return toast('That doesn\'t look like a VA number or a 1-… application number.');
    PH = null; toast('Saved for the whole folder.'); render(true);
  },
  regcopy: async v => {
    const R = await regData(), q = state.regQ.trim().toLowerCase();
    const rows = R[v === 'app' ? 'app' : 'none'].filter(r => (!state.regClient || (r.p.client || 'Client unknown') === state.regClient) && (!q || r.p.name.toLowerCase().includes(q) || String(r.p.folder || '').toLowerCase().includes(q))).sort((a, b) => b.stolen - a.stolen || b.copies - a.copies);
    ntCopy(['Client\tPhoto\tFolder\tCopies found\tStolen\tApplication number', ...rows.map(r => [r.p.client || '', r.p.name, r.p.folder || '', r.copies, r.stolen, (r.r && r.r.app) || ''].join('\t'))].join('\n'), plural(rows.length, 'photo') + ' copied. Paste it into an email or a spreadsheet');
  },
});

// ---------------------------------------------------------------- one client's photos
const PH_FILTERS = [['all', 'All', () => true], ['hi', 'High priority', p => p.flag === 'hi', 'flagf'], ['pop', 'Popular', p => p.flag === 'pop', 'starf'], ['copies', 'Has copies', p => p.copies > 0], ['never', 'Not searched yet', p => !p.searches && !p.stopped], ['stopped', 'Not searched any more', p => !!p.stopped], ['doubles', 'Doubles', p => !!p.doubleOf]];
const PH_SORTS = [['new', 'Newest first', (a, b) => (b.order || 0) - (a.order || 0) || a.name.localeCompare(b.name)], ['copies', 'Most copies', (a, b) => (b.copies || 0) - (a.copies || 0) || (b.order || 0) - (a.order || 0)], ['searched', 'Searched longest ago', (a, b) => String(a.lastSearched || '').localeCompare(String(b.lastSearched || ''))], ['name', 'Name A to Z', (a, b) => a.name.localeCompare(b.name)]];
async function photoPanel(p, cl, r) {
  const cs = (await FC.copiesOf(p.id)).filter(c => c.status !== 'removed').sort((a, b) => String(b.firstSeen || '').localeCompare(String(a.firstSeen || '')));
  const pl = FC.plan(p, cl), ST = { new: 'New', stolen: 'Stolen', licensed: 'Licensed', later: 'Check later' };
  const next = p.stopped ? 'Never: you stopped searching it' : pl.pool ? 'Never: POOL photos are shared with other papers' : !cl || cl.searching !== true ? 'Not while this client is switched off' : pl.due ? (pl.tier === 0 ? 'Next in line' : 'Due now') : 'Not due yet';
  return `<aside class="cpanel clpanel" id="photoPanel" aria-label="${esc(p.name)}"><div class="cph"><span class="kn1"><b title="${esc(p.name)}">${esc(p.name)}</b><span>${esc([p.year, p.quarter ? 'Q' + p.quarter : '', p.client].filter(Boolean).join(' · '))}</span></span><span class="sp"></span><button class="kx" data-act="phsel" data-v="" aria-label="Close" title="Close">✕</button></div>
    <img class="clbig" src="${p.thumb ? safeImg(p.thumb) : p.th ? (FC.pics.seen(p.id) || lazyPic(p)) : 'icons/icon48.png'}" alt="">
    <div class="clfl2">${clBtn(p.flag === 'hi' ? CLI.flagf : CLI.flag, 'High priority', 'phflag', p.id + '|hi', p.flag === 'hi' ? 'on hi' : '', ` aria-pressed="${p.flag === 'hi'}" title="Searched next, then every 3 days"`)}${clBtn(p.flag === 'pop' ? CLI.starf : CLI.star, 'Popular', 'phflag', p.id + '|pop', p.flag === 'pop' ? 'on star' : '', ` aria-pressed="${p.flag === 'pop'}" title="Searched every 7 days"`)}<span class="sp"></span>${p.stopped || FC.isPool(p.name) ? '' : clBtn(KI.play, 'Search now', 'phsearch1', p.id, 'accb')}</div>
    <div class="cldl" id="photoFacts"><span>Registration</span><b>${r && r.va ? esc(r.va) : r && r.app ? 'Applied ' + esc(r.app) : 'No number'}</b>
      <span>Folder</span><b title="${esc(p.folder || '')}">${esc(regShort(p.folder))}</b>
      ${p.w && p.h ? `<span>Size</span><b class="num">${p.w.toLocaleString()} × ${p.h.toLocaleString()}</b>` : ''}
      <span>Searched</span><b>${p.searches ? plural(p.searches, 'time') + (p.lastSearched ? ' · last ' + clDays(p.lastSearched) : '') : 'Not yet'}</b>
      <span>Next search</span><b>${next}</b>
      ${p.doubleOf ? '<span>Double</span><b>Looks the same as another photo of this client <button class="lk" data-act="phnotdouble" data-v="' + esc(p.id) + '">Not the same</button></b>' : ''}</div>
    <div class="kh2">Copies found <span class="kfaint">${cs.length}</span>${cs.length ? `<a href="#found?photo=${encodeURIComponent(p.id)}">See all in Copies found ›</a>` : ''}</div>
    <div class="clcps" id="photoCopies">${cs.slice(0, 4).map(c => `<a class="clcpr" href="#found?open=${encodeURIComponent(c.id)}"><img src="${safeImg(c.thumb || c.img)}" alt="" loading="lazy"><span class="kn1"><b>${esc(c.site)}</b><span>${ST[c.status] || esc(c.status)}${c.firstSeen ? ' · found ' + clDays(c.firstSeen) : ''}</span></span>${KI.chev}</a>`).join('') || '<p class="kmuted" style="margin:0">No copies found so far.</p>'}</div>
    <div class="cpfoot"><button class="btn kbtn" data-act="phpath" data-v="${esc(p.id)}">${CLI.copy}Copy where the file is</button><button class="btn kbtn" data-act="phstop" data-v="${esc(p.id)}|${p.stopped ? 0 : 1}">${p.stopped ? KI.play + 'Search this photo again' : KI.pause + 'Stop searching this photo'}</button></div></aside>`;
}
V.photos = async () => {
  const clients = (await FC.DB.all('clients')).sort((a, b) => a.name.localeCompare(b.name));
  const want = routeArg('client');
  if (want && clients.some(c => c.name === want)) state.phClient = want;
  if (!state.phClient || !clients.some(c => c.name === state.phClient)) state.phClient = (clients.find(c => c.searching === true) || clients[0] || {}).name || '';
  const cl = clients.find(c => c.name === state.phClient);
  if (!PH || PH.client !== state.phClient) PH = { client: state.phClient, list: (await FC.DB.by('photos', 'client', state.phClient)).filter(p => !p.gone) };
  const all = PH.list, regs = (await FC.meta.get('regs')) || {}, rg = p => regSync(p, regs);
  if (state.phStop) { state.phFilter = 'stopped'; state.phStop = false; }   // the old "Show them" switch
  const q = state.phQ.toLowerCase(), fy = state.phYear || '';
  const inFolder = p => !fy || (fy.includes(' ') ? phFolder(p) === fy : String(p.year || 'No year') === fy);
  // The last stopped photo (or double) was put right: go back to every photo instead of an empty list.
  if ((state.phFilter === 'stopped' && !all.some(p => p.stopped)) || (state.phFilter === 'doubles' && !all.some(p => p.doubleOf))) state.phFilter = 'all';
  const flt = PH_FILTERS.find(f => f[0] === state.phFilter) || PH_FILTERS[0], srt = PH_SORTS.find(s => s[0] === state.phSort) || PH_SORTS[0];
  const list = all.filter(p => inFolder(p) && flt[2](p) && (!q || p.name.toLowerCase().includes(q) || (p.rel || '').toLowerCase().includes(q))).sort((a, b) => (b.flag === 'hi') - (a.flag === 'hi') || srt[2](a, b));
  const show = list.slice(0, state.phMore);
  const doubles = all.filter(p => p.doubleOf).length, stopped = all.filter(p => p.stopped).length, withCopies = all.filter(p => p.copies > 0), noNum = withCopies.filter(p => !(rg(p) || {}).va).length;
  const copies = cl ? (await FC.DB.by('copies', 'client', cl.name).catch(() => [])).filter(c => c.status !== 'removed') : [];
  const nNew = copies.filter(c => c.status === 'new').length;
  const F1 = ((await FC.coverage().catch(() => null)) || {}).first || {}, [d1, t1] = (F1.clients || {})[state.phClient] || [0, 0];
  let by = '';
  try { const rate = firstPerDay(await FC.keep(), await ppHardware(), F1.week || 0, await FC.speed(), (await api.storage.local.get('fcLadder')).fcLadder || null); const r = firstClientRows(F1).find(x => x.name === state.phClient); by = r ? (r.left <= 0 ? 'All searched' : 'All done ' + String(firstDoneBy(r.need, rate)).replace('~ ', 'by about ')) : ''; } catch (e) { /* no speed yet */ }
  const thisYear = all.filter(p => String(p.year) === String(new Date().getFullYear())).length;
  const on = !!cl && cl.searching === true;

  const hd = `<div class="head clhead rvhead"><div class="l"><div class="clph"><a class="clback" href="#clients" aria-label="Back to all clients" title="All clients">${CLI.back}</a><a class="bc" href="#clients">Clients and photos ›</a>${clAv(state.phClient || '?', 40)}
    <h1 class="clsel"><select data-act="phclient" aria-label="Client">${clients.map(c => `<option ${c.name === state.phClient ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></h1></div></div><div class="row headact"></div></div>`;
  const ctl = cl ? `<div class="clctl" id="photoCtl"><span class="konoff"><label class="switch"><input type="checkbox" data-act="csearch" data-v="${esc(cl.name)}" aria-label="Search for ${esc(cl.name)}" ${on ? 'checked' : ''}><span></span></label><span class="wswl">${on ? 'Searching' : 'Not searching'}</span></span>
    ${clBtn(cl.priority ? CLI.starf : CLI.star, 'Priority client', 'cstar', cl.name, cl.priority ? 'on star' : '', ` aria-pressed="${!!cl.priority}" title="${cl.priority ? 'Searched right after High priority photos. Click to make it a normal client.' : 'Make this a priority client'}"`)}<span class="sp"></span>
    <a class="clcb" href="#found?client=${encodeURIComponent(cl.name)}">${KI.copies}<span>See its copies</span></a>
    <button class="clcb" data-act="cscan"${FC.SCAN.busy ? ' disabled data-why="PageProof is already looking for new photos. Wait for it to finish."' : ''}>${CLI.refresh}<span>${FC.SCAN.busy ? 'Looking…' : 'Look for new photos'}</span></button>
    ${clBtn(CLI.help, 'What ⚑ and ★ mean', 'phhelp', '', state.phHelp ? 'on' : '', ` aria-expanded="${!!state.phHelp}"`)}</div>
    ${state.phHelp ? `<div class="kbar info slim" id="photoHelp">${kSq(KC.blue, CLI.help, 28)}<div><b>⚑ High priority: searched next, then every 3 days. ★ Popular: searched every 7 days.</b><span>Every other photo is searched in turn. A ★ priority client's photos go right after High priority photos.</span></div><button class="kx" data-act="phhelp" aria-label="Close">✕</button></div>` : ''}` : '';
  const tiles = `<div class="ktiles2 cltiles4" id="photoTiles">
    ${clTile(KC.blue, KI.photo, all.length.toLocaleString(), 'Photos', thisYear.toLocaleString() + ' this year · ' + (on ? 'Searching' : 'Not searching'))}
    ${clTile(KC.green, KI.ring, t1 ? Math.floor(d1 / t1 * 100) + '%' : '…', 'Searched once', t1 ? esc(by) : 'Not counted yet')}
    ${clTile(KC.teal, KI.copies, copies.length.toLocaleString(), 'Copies found', nNew ? `<a href="#found?client=${encodeURIComponent(state.phClient)}">${nNew.toLocaleString()} new to answer ›</a>` : 'None to answer')}
    ${clTile(KC.purple, CLI.doc, noNum.toLocaleString(), 'Need a registration', plural(withCopies.length, 'photo has', 'photos have') + ' copies')}</div>`;
  const bars = `${doubles && !state.phBarX.d ? `<div class="kbar info slim" id="photoDoubles">${kSq(KC.blue, CLI.twin, 28)}<div><b>${plural(doubles, 'photo looks', 'photos look')} the same as another of this client's photos</b><span>Searched once, every copy is checked against both.</span></div><button class="btn kbtn" data-act="phfilter" data-v="doubles">Show ${doubles === 1 ? 'it' : 'them'}</button><button class="kx" data-act="phbarx" data-v="d" aria-label="Hide this note">✕</button></div>` : ''}
    ${stopped && !state.phBarX.s ? `<div class="kbar info slim" id="photoStopped">${kSq(KC.grey, KI.pause, 28)}<div><b>${plural(stopped, 'photo is', 'photos are')} not searched any more</b><span>Someone chose Stop searching this photo.</span></div><button class="btn kbtn" data-act="phstopshow">Show ${stopped === 1 ? 'it' : 'them'}</button><button class="kx" data-act="phbarx" data-v="s" aria-label="Hide this note">✕</button></div>` : ''}`;
  // folders: year › quarter, each quarter with its number light
  const tree = {};
  for (const p of all) { const y = String(p.year || 'No year'), qq = p.quarter ? 'Q' + p.quarter : 'Other'; const t = (tree[y] = tree[y] || {}); t[qq] = t[qq] || { n: 0, p }; t[qq].n++; }
  const years = Object.keys(tree).sort((a, b) => b.localeCompare(a));
  if (!state.phOpenY) state.phOpenY = new Set(years.slice(0, 2));
  const side = `<aside class="card cltree" id="photoTree" aria-label="Folders">${years.length ? `<button class="ctr${fy ? '' : ' on'}" data-act="phyear" data-v="" aria-pressed="${!fy}">${CLI.folder}<span>All folders</span><b class="num">${all.length.toLocaleString()}</b></button>` : '<span class="kfaint" style="padding:8px 10px">No photos read yet.</span>'}
    ${years.map(y => { const open = state.phOpenY.has(y) || fy.startsWith(y + ' ');
      return `<div class="ctry"><button class="ctw" data-act="phopeny" data-v="${esc(y)}" aria-expanded="${open}" aria-label="${open ? 'Fold' : 'Open'} ${esc(y)}">${open ? CLI.chevd : KI.chev}</button><button class="ctr y${fy === y ? ' on' : ''}" data-act="phyear" data-v="${esc(y)}" aria-pressed="${fy === y}"><span>${esc(y)}</span><b class="num">${Object.values(tree[y]).reduce((a, b) => a + b.n, 0).toLocaleString()}</b></button></div>
      ${open ? Object.keys(tree[y]).sort().reverse().map(qq => `<button class="ctr q${fy === y + ' ' + qq ? ' on' : ''}" data-act="phyear" data-v="${esc(y + ' ' + qq)}" aria-pressed="${fy === y + ' ' + qq}">${CLI.folder}<span>${qq}</span>${regChip(rg(tree[y][qq].p)).replace(/>(VA[^<]*)</, '>VA<')}<b class="num">${tree[y][qq].n.toLocaleString()}</b></button>`).join('') : ''}`; }).join('')}</aside>`;
  // this client's folders with copies and their numbers
  const fm = new Map();
  for (const p of withCopies) { const f = p.folder || ''; const e = fm.get(f) || { n: 0, copies: 0, p }; e.n++; e.copies += p.copies || 0; fm.set(f, e); }
  const fr = [...fm].sort((a, b) => { const sa = rg(a[1].p) || {}, sb = rg(b[1].p) || {}; return (!!sa.va - !!sb.va) || (!!sa.app - !!sb.app) || b[1].copies - a[1].copies; }).slice(0, 8).map(([f, e]) => { const r = rg(e.p) || {};
    return `<div class="rgcf" data-folder="${esc(f)}"><span class="rgfn">${CLI.folder}<b title="${esc(f)}">${esc(regShort(f))}</b></span><span class="kfaint num">${plural(e.n, 'photo')} · ${plural(e.copies, 'copy', 'copies')}</span>
      ${r.va ? `<span class="rgst ok">${CLI.check}<span class="mono">${esc(r.va)}</span></span>` : (r.app ? `<span class="rgst app">Applied <span class="mono">${esc(r.app)}</span></span>` : '<span class="rgst none">No number</span>') + regNumberBox(f, r.app ? 'app' : 'none')}</div>`; }).join('');
  const regCard = `<section class="card clreg" id="photoRegs"><div class="kh2">${kSq(KC.purple, CLI.doc, 28)}Registrations</div>${fr || '<p class="kmuted">No copies found for this client yet, so no folder needs a number.</p>'}
    <a class="clregall" href="#clients?reg=none" data-act="regopenall" data-v="${esc(state.phClient)}">All registrations ›</a></section>`;
  const cmd = `<div class="clcmd" id="photoCmd"><div class="wseg kseg" role="tablist" aria-label="Which photos">${PH_FILTERS.map(([k, l, f, ico]) => `<button role="tab" aria-selected="${flt[0] === k}" class="${flt[0] === k ? 'on' : ''}${ico ? ' f-' + k : ''}" data-act="phfilter" data-v="${k}">${ico ? CLI[ico] : ''}${l} <span>${all.filter(f).length.toLocaleString()}</span></button>`).join('')}</div><span class="sp"></span>
    <label class="ksearch">${KI.search}<input type="search" id="phQ" placeholder="Find a photo by name" aria-label="Find a photo by name" value="${esc(state.phQ)}"></label>
    <label class="ksort"><select data-act="phsort" aria-label="Sort photos">${PH_SORTS.map(([k, l]) => `<option value="${k}" ${srt[0] === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="ksort"><select data-act="phsize" aria-label="Picture size">${[['l', 'Large'], ['m', 'Medium'], ['s', 'Small']].map(([k, l]) => `<option value="${k}" ${state.phSize === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>`;
  const due = p => { const pl = FC.plan(p, cl); return pl.due ? (pl.tier === 0 ? 'Next' : 'Due') : ''; };
  const card = p => { const r = rg(p), pk = state.phPicked.includes(p.id);
    return `<div class="pcard clp${pk ? ' on pk' : ''}${state.phSel === p.id ? ' sel' : ''}" data-id="${esc(p.id)}">
      <div class="clpi ptile${p.thumb || p.th ? '' : ' noimg'}"><button class="clopen" data-act="phsel" data-v="${esc(p.id)}" aria-label="Open ${esc(p.name)}"><img data-lazy="${esc(p.id)}" src="${p.thumb ? safeImg(p.thumb) : p.th ? (FC.pics.seen(p.id) || lazyPic(p)) : 'icons/icon48.png'}" alt="" loading="lazy" style="object-fit:${p.thumb || p.th ? 'cover' : 'scale-down'}"></button><span class="nolab">Picture not loaded yet</span>
        <label class="tick"><input type="checkbox" data-act="phpick" data-v="${esc(p.id)}" ${pk ? 'checked' : ''} aria-label="Pick ${esc(p.name)}"></label>
        <span class="clfl cflags"><button class="flagbtn clf${p.flag === 'hi' ? ' on hi' : ''}" data-act="phflag" data-v="${esc(p.id)}|hi" aria-pressed="${p.flag === 'hi'}" aria-label="High priority" title="High priority: searched next, then every 3 days">${p.flag === 'hi' ? CLI.flagf : CLI.flag}</button><button class="flagbtn clf${p.flag === 'pop' ? ' on pop' : ''}" data-act="phflag" data-v="${esc(p.id)}|pop" aria-pressed="${p.flag === 'pop'}" aria-label="Popular" title="Popular: searched every 7 days">${p.flag === 'pop' ? CLI.starf : CLI.star}</button></span>
        ${p.copies ? `<a class="clcp" href="#found?photo=${encodeURIComponent(p.id)}" title="${plural(p.copies, 'copy', 'copies')} found">${KI.copies}${p.copies}</a>` : ''}</div>
      <b title="${esc(p.name)}">${esc(p.name.replace(/\.(jpe?g|png)$/i, ''))}</b>
      <span class="clpm tdots">${regChip(r)}<span class="kfaint">${p.searches ? plural(p.searches, 'search', 'searches') : 'Not searched yet'}</span>${p.doubleOf ? '<span class="ktag" title="Looks the same as another photo of this client">Double</span>' : ''}${FC.isPool(p.name) ? '<span class="ktag warn" title="POOL: shared with other papers, so it is never searched. Rename it without POOL to search it.">POOL</span>' : ''}${p.empty >= 5 ? `<span class="ktag" title="${p.empty} searches found nothing: searched ${p.empty >= 10 ? 'every 3 months' : 'monthly'}">Quiet</span>` : ''}${due(p) ? `<span class="ktag acc" title="Due for a search">${due(p)}</span>` : ''}${p.stopped ? `<span class="ktag" title="You stopped searching this photo on ${esc(new Date(p.stopped).toLocaleDateString())}. Keep searching and Today's 50 skip it. Its copies found so far stay.">Not searched</span><button class="lk" data-act="phstop" data-v="${esc(p.id)}|0" title="Keep searching and Today's 50 will search it again">Search again</button>` : ''}</span></div>`; };
  const groups = new Map(); for (const p of show) { const k = phFolder(p); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
  const grid = show.length ? [...groups].map(([k, ps]) => { const p0 = ps[0], r = rg(p0), tn = ((tree[String(p0.year || 'No year')] || {})[p0.quarter ? 'Q' + p0.quarter : 'Other'] || {}).n || ps.length;
    return `<div class="clgrp"><div class="clgh"><b>${esc(String(p0.year || 'No year'))}${p0.quarter ? ' · Q' + p0.quarter : ''}</b>${r && r.va ? `<span class="rgc ok">${esc(r.va)}</span>` : r && r.app ? `<span class="rgc warn">Applied ${esc(r.app)}</span>` : '<span class="rgc bad">No number</span>'}<span class="kfaint">${plural(tn, 'photo')}</span></div><div class="pgrid clgrid sz-${esc(state.phSize)}">${ps.map(card).join('')}</div></div>`; }).join('')
    : `<p class="kmuted" id="photoNone">${fy || q || flt[0] !== 'all' ? 'No photos match.' : 'No photos found. Try "Look for new photos".'}</p>`;
  const sel = state.phSel && all.find(p => p.id === state.phSel);
  if (state.phSel && !sel) state.phSel = '';
  const panel = sel ? await photoPanel(sel, cl, rg(sel)) : '';
  document.body.classList.toggle('cpopen', !!panel);
  const n = state.phPicked.length;
  const bulk = n ? `<div class="clfloat" id="photoBulk"><b>${n} picked</b><span class="clsep"></span>${clBtn(KI.play, 'Search now', 'phsearch', '', 'accb')}${clBtn(CLI.flag, 'High priority', 'phbulkflag', 'hi')}${clBtn(CLI.star, 'Popular', 'phbulkflag', 'pop')}${clBtn(CLI.x, 'No flag', 'phbulkflag', '')}${clBtn(KI.pause, 'Stop searching', 'phstop', '|1')}${clBtn(KI.play, 'Search again', 'phstop', '|0')}<span class="clsep"></span>${clBtn(CLI.x, 'Clear', 'phclear', '')}</div>` : '';
  return hd + (await driveBanner()) + `<div class="rvn kpn crn cln clpg${panel ? ' withpanel' : ''}">${ctl}${tiles}${bars.trim() ? `<div class="clbars">${bars}</div>` : ''}
    <div class="clsplit"><div class="clleft">${side}${regCard}</div><div class="clmain">${cmd}
      ${fy || q || flt[0] !== 'all' ? `<div class="clshowing"><span class="kmuted">Showing ${list.length.toLocaleString()} of ${all.length.toLocaleString()} photos</span>${fy ? `<button class="kchip" data-act="phyear" data-v="">${esc(fy)} ✕</button>` : ''}${flt[0] !== 'all' ? `<button class="kchip" data-act="phfilter" data-v="all">${flt[1]} ✕</button>` : ''}</div>` : ''}
      ${grid}${list.length > show.length ? `<button class="btn kbtn" style="align-self:center" data-act="phmore">Show 50 more (${(list.length - show.length).toLocaleString()} not shown)</button>` : ''}</div></div></div>${bulk}${panel}`;
};
V.photos.guard = V.found.guard;
V.photos.after = () => {
  hoverPreviews();
  clKeepFocus('phQ', v => { state.phQ = v; state.phMore = 50; });
  document.querySelectorAll('#photoRegs input[data-reg]').forEach(i => { i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); ACTS.regsave(i.dataset.reg); } }; });
  lazyThumbs();
};
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || /^(INPUT|SELECT|TEXTAREA)$/.test((e.target || {}).tagName || '')) return;
  if (state.shown === 'photos' && state.phSel) { state.phSel = ''; render(true); }
  else if (state.shown === 'clients' && regArg()) regGo('');
  else if (state.shown === 'clients' && state.cMenu) { state.cMenu = false; render(true); }
});
Object.assign(ACTS, {
  cphotos: v => { state.phClient = v; state.phMore = 50; state.phQ = ''; state.phYear = ''; state.phFilter = 'all'; state.phSel = ''; state.phPicked = []; state.phOpenY = null; location.hash = 'photos'; },
  phclient: (v, el) => { state.phClient = el.value; state.phMore = 50; state.phPicked = []; state.phYear = ''; state.phFilter = 'all'; state.phSel = ''; state.phOpenY = null; state.phBarX = {}; render(); },
  phfilter: v => { state.phFilter = state.phFilter === v ? 'all' : v; state.phMore = 50; render(true); },
  phstopshow: () => { state.phFilter = state.phFilter === 'stopped' ? 'all' : 'stopped'; state.phMore = 50; render(true); },
  phsort: (v, el) => { state.phSort = el.value; render(true); },
  phsize: (v, el) => { state.phSize = el.value; render(true); },
  phhelp: () => { state.phHelp = !state.phHelp; render(true); },
  phbarx: v => { state.phBarX[v] = 1; render(true); },
  phopeny: v => { if (!state.phOpenY) state.phOpenY = new Set(); if (state.phOpenY.has(v)) state.phOpenY.delete(v); else state.phOpenY.add(v); render(true); },
  phsel: v => { state.phSel = state.phSel === v ? '' : v; render(true); },
  phpath: async v => { const p = await FC.DB.get('photos', v); if (p) ntCopy(p.rel || ((p.folder ? p.folder + '/' : '') + p.name), 'Where the file is in Google Drive copied'); },
  phsearch1: async v => { const was = state.phPicked; state.phPicked = [v]; try { await ACTS.phsearch(); } finally { state.phPicked = was.filter(x => x !== v); } },
  regopenall: v => { state.regClient = v || ''; state.regQ = ''; state.regMore = 60; },
});
