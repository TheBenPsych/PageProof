// Find copies › Site owners, Who's behind this site, and the Weekly summary.
Object.assign(state, { ownerSel: '', ownerQ: '', who: null, whoBusy: false, wkKey: '' });

// ---------------------------------------------------------------- Site owners (calm look, design batch 13)
// Copies found › Site owners. Two tabs: Owners (the list, and everything about the chosen owner)
// and Look up a site (Who's behind this site, address #who).
const OWI = (() => {
  const s = (p, z = 16) => `<svg viewBox="0 0 16 16" width="${z}" height="${z}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  return {
    ban: s('<circle cx="8" cy="8" r="6"/><path d="M3.8 3.8l8.4 8.4"/>'),
    check: s('<path d="m3 8.5 3.2 3L13 4.5"/>'),
    build: s('<path d="M2 14h12M3.5 14V4.5L8 2l4.5 2.5V14M6 6.5h4M6 9h4M6 11.5h4"/>'),
    tag: s('<path d="M2 2.5h5.5L14 9l-5 5-6.5-6.5z"/><circle cx="5.2" cy="5.6" r="1"/>'),
    link: s('<path d="M6.5 9.5l3-3M7 4.5l1-1a2.8 2.8 0 0 1 4 4l-1 1M9 11.5l-1 1a2.8 2.8 0 0 1-4-4l1-1"/>'),
    globe: s('<circle cx="8" cy="8" r="6.2"/><path d="M1.8 8h12.4M8 1.8c1.8 2 2.6 4 2.6 6.2S9.8 12.2 8 14.2M8 1.8C6.2 3.8 5.4 5.8 5.4 8s.8 4.2 2.6 6.2"/>'),
    mail: s('<rect x="1.8" y="3.5" width="12.4" height="9" rx="1"/><path d="m2.2 4 5.8 4.6L13.8 4"/>'),
    pin: s('<path d="M8 14.2s4.5-4.3 4.5-7.7A4.5 4.5 0 0 0 3.5 6.5c0 3.4 4.5 7.7 4.5 7.7z"/><circle cx="8" cy="6.5" r="1.6"/>'),
    id: s('<rect x="1.8" y="3" width="12.4" height="10" rx="1.2"/><circle cx="5.6" cy="7.2" r="1.6"/><path d="M3.4 11c.4-1.2 1.2-1.8 2.2-1.8s1.8.6 2.2 1.8M9.5 6.5h3M9.5 9h3"/>'),
    stolen: s('<path d="M8 1.8 13.5 4v4c0 3.2-2.4 5.4-5.5 6.2C4.9 13.4 2.5 11.2 2.5 8V4z"/><path d="M8 5v3.5M8 10.6v.2"/>'),
    lic: s('<path d="M8 1.8 13.5 4v4c0 3.2-2.4 5.4-5.5 6.2C4.9 13.4 2.5 11.2 2.5 8V4z"/><path d="m5.5 8 1.8 1.8L10.8 6.3"/>'),
    fresh: s('<path d="M8 2v2.5M8 11.5V14M2 8h2.5M11.5 8H14M3.8 3.8l1.8 1.8M10.4 10.4l1.8 1.8M3.8 12.2l1.8-1.8M10.4 5.6l1.8-1.8"/>'),
    clip: s('<rect x="4" y="3" width="8" height="11" rx="1"/><path d="M6 3V2h4v1M6 7h4M6 9.5h4"/>'),
    read: s('<path d="M2 3.5c2-.6 4-.4 6 1 2-1.4 4-1.6 6-1v9c-2-.6-4-.4-6 1-2-1.4-4-1.6-6-1z"/><path d="M8 4.5v9"/>'),
    x: s('<path d="M4 4l8 8M12 4l-8 8"/>', 14),
  };
})();
Object.assign(state, { ownerKind: 'all', ownerSort: 'copies', ownerBarOff: false, ownerMore: 40, ownerSitesAll: '' });
const owHue = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
// Initials from real words only: "Gannett (USA TODAY Network)" is G, never "G(".
const owIni = s => { const w = String(s).replace(/\(.*?\)/g, ' ').replace(/\.(com|net|org|co|us|news|info)$/i, '').split(/[\s.\-_/]+/).filter(x => /^[A-Za-z0-9]/.test(x) && !/^(LLC|Inc|Ltd|plc|Co|Corp)\.?$/i.test(x)); return ((w[0] || '?')[0] + (w[1] ? w[1][0] : '')).toUpperCase(); };
const owAv = (s, z = 24) => `<span class="kav oav" style="--h:${owHue(s)};width:${z}px;height:${z}px;font-size:${Math.round(z * .4)}px" aria-hidden="true">${esc(owIni(s))}</span>`;
const owSl = s => `<span class="osl" style="--h:${owHue(FC.baseOf(s))}" aria-hidden="true">${esc((FC.baseOf(s)[0] || '?').toUpperCase())}</span>`;
// What links them, named right (a shared Analytics ID is not "sub-sites of one domain").
const owKind = o => { const h = (o.how || []).join('|');
  if (/big media groups/.test(h) || o.kind === 'Media group') return ['Media group', KC.blue, OWI.build, 'Media group'];
  if (/Same company named/.test(h)) return ['Same company', KC.purple, OWI.tag, 'Same company'];
  if (/Analytics/.test(h)) return ['Same Analytics ID', KC.amber, OWI.id, 'Linked by an ID'];
  if (/ad account/.test(h)) return ['Same ad account', KC.amber, OWI.id, 'Linked by an ID'];
  return ['Sub-sites', KC.grey, OWI.link, 'Sub-sites']; };
const owChip = o => { const [l, c] = owKind(o); return `<span class="okind" style="--c:${c}">${l}</span>`; };
const owAgo = iso => { const d = Math.round((Date.now() - new Date(iso)) / 864e5); return !(d > 0) ? 'Today' : d === 1 ? 'Yesterday' : d + ' days ago'; };
const owTabs = (tab, n) => `<div class="utabs" role="tablist" aria-label="Site owners"><button role="tab" aria-selected="${tab === 'owners'}" class="${tab === 'owners' ? 'on' : ''}" data-act="otab" data-v="owners">Owners${n != null ? ` <span>${n}</span>` : ''}</button><button role="tab" aria-selected="${tab === 'lookup'}" class="${tab === 'lookup' ? 'on' : ''}" data-act="otab" data-v="who">Look up a site</button></div>`;
// Everything PageProof knows about one owner, worked out once for the page and for Copy owner details.
function owFacts(sel) {
  const facts = sel.sites.map(s => FCD.facts.get(s)).filter(Boolean);
  const all = []; for (const f of facts) for (const c of f.clues || []) all.push({ ...c, site: f.site });
  const names = [...new Set(facts.flatMap(f => f.names || []))];
  const contact = all.filter(c => c.kind === 'mail' || /mail|contact|phone/i.test(c.title || ''));
  const addr = all.filter(c => /address/i.test(c.title || ''));
  const doms = facts.filter(f => f.created).map(f => ({ s: f.site, y: new Date(f.created).getFullYear(), v: (all.find(c => c.site === f.site && (c.kind === 'globe' || /domain/i.test(c.title || ''))) || {}).value || '' })).filter(d => d.y > 1980);
  const ids = [...new Set(facts.flatMap(f => f.ids || []))];
  const nameN = n => facts.filter(f => (f.names || []).includes(n)).length;
  const why = [], subs = [];
  for (const h of (sel.how && sel.how.length ? sel.how : ['Sub-sites of one domain'])) {
    if (/big media groups/.test(h)) why.push([KC.blue, OWI.build, h, sel.name + ' is on the built-in list of media groups']);
    else if (/Same company/.test(h)) { const n = names.slice().sort((a, b) => nameN(b) - nameN(a))[0] || sel.name; why.push([KC.purple, OWI.tag, 'Same company named on their sites', `“${n}” on ${nameN(n) || sel.sites.length} of ${sel.sites.length} sites`]); }
    else if (/Analytics/.test(h)) why.push([KC.amber, OWI.id, 'Same Google Analytics ID', `${ids.find(i => /^(UA-|G-)/.test(i)) || ids[0] || 'One ID'} on their sites`]);
    else if (/ad account/.test(h)) why.push([KC.amber, OWI.id, 'Same ad account', `${ids.find(i => /pub-/.test(i)) || ids[0] || 'One account'} on their sites`]);
    else subs.push(h);
  }
  // Sub-site lines only matter when nothing stronger links them.
  if (!why.length) for (const h of subs.slice(0, 3)) { const b = (/of (\S+)$/.exec(h) || [])[1], ss = b ? sel.sites.filter(x => x === b || x.endsWith('.' + b)) : sel.sites; why.push([KC.grey, OWI.link, h, (ss.length ? ss : sel.sites).slice(0, 4).join(', ') + (ss.length > 4 ? ' and ' + (ss.length - 4) + ' more' : '')]); }
  const hidden = doms.filter(d => /hidden|privacy|redacted/i.test(d.v)).length;
  const onRec = [...new Set(doms.map(d => (/Owner: (.*)$/.exec(d.v) || [])[1]).filter(Boolean))];
  const say = [];
  if (names.length) say.push([KC.purple, OWI.tag, 'Company names', names.join(' · '), plural(facts.filter(f => (f.names || []).length).length, 'site names it', 'sites name it')]);
  if (contact.length) say.push([KC.teal, OWI.mail, 'Contact', contact[0].value, contact[0].site]);
  if (addr.length) say.push([KC.green, OWI.pin, 'Address', addr[0].value, addr[0].site]);
  if (doms.length) { const a = Math.min(...doms.map(d => d.y)), b = Math.max(...doms.map(d => d.y)); say.push([KC.blue, OWI.globe, 'Domains', `${doms.length} registered ${a}${b > a ? '–' + b : ''}`, onRec.length ? 'Owner on record: ' + onRec[0] : hidden ? 'Owner hidden by a privacy service on ' + plural(hidden, 'site') : '']); }
  if (ids.length) say.push([KC.amber, OWI.id, 'Tracking and ad IDs', ids.join(' · '), 'Sites with the same ID are usually run by the same people']);
  return { facts, why, say };
}
const owHow = () => `<section class="card chow" id="ownerHow" aria-label="How owners are found"><div class="kh2">How owners are found</div>
  ${[[KC.blue, OWI.build, 'A big media group', 'on PageProof\'s own list, like Gannett or Hearst'], [KC.purple, OWI.tag, 'The same company named', 'in the footer, privacy page or domain record'], [KC.amber, OWI.id, 'The same Analytics or ad ID', 'hidden in the page, used by one owner'], [KC.grey, OWI.link, 'Sub-sites of one domain', 'like local.newsbreak.com and newsbreak.com']].map(([c, i, b, t]) => `<div class="chs">${kSq(c, i, 32)}<span class="kn1"><b>${b}</b><span>${t}</span></span></div>`).join('')}
  <p class="kfoot">Only facts PageProof actually found are used. Check them before you rely on them.</p></section>`;

V.owners = async () => {
  await loadFC();
  const live = FCD.copies.filter(c => c.status !== 'removed' && visible(c));
  const cnt = (o, s) => o.copies.filter(c => c.status === s).length;
  const groups = FCD.owners.filter(o => o.real).map(o => ({ ...o, copies: live.filter(c => o.sites.includes(c.site)) })).filter(o => o.copies.length).sort((a, b) => b.copies.length - a.copies.length);
  const unread = [...new Set(live.map(c => c.site))].filter(s => !FCD.facts.has(s));
  const kinds = {}; for (const o of groups) { const k = owKind(o)[3]; kinds[k] = (kinds[k] || 0) + 1; }
  const withStolen = groups.filter(o => cnt(o, 'stolen')).length;
  const K = state.ownerKind;
  let shown = groups.filter(o => K === 'all' || (K === 'stolen' ? cnt(o, 'stolen') : owKind(o)[3] === K));
  if (state.ownerSort === 'stolen') shown.sort((a, b) => cnt(b, 'stolen') - cnt(a, 'stolen') || b.copies.length - a.copies.length);
  else if (state.ownerSort === 'sites') shown.sort((a, b) => b.sites.length - a.sites.length);
  else if (state.ownerSort === 'name') shown.sort((a, b) => a.name.localeCompare(b.name));
  const sel = groups.find(o => o.key === state.ownerSel) || shown[0];
  const reading = state.whoBusy;
  const readBtn = (label, cls = '') => `<button class="btn kbtn ${cls}" data-act="oreadall"${reading ? ' disabled data-why="PageProof is already reading a site. Wait a moment."' : ''}>${OWI.read}${reading ? 'Reading…' : label}</button>`;

  const ctl = `<div class="rvn-ctl kctl">${owTabs('owners', groups.length)}<span class="sp"></span>
    <button class="btn kbtn" data-act="ohow">${KI.info}How owners are found</button>${unread.length ? readBtn('Read ' + Math.min(20, unread.length) + ' more sites') : ''}</div>`;
  const bar = unread.length && !state.ownerBarOff ? `<div class="kbar info" id="ownerBar" role="status">${kSq(KC.blue, OWI.read, 28)}<div><b>${plural(unread.length, 'site with copies has', 'sites with copies have')} not been read yet</b><span>Keep searching reads one new site every couple of minutes. Owners show up here once their sites are read.</span></div><span class="sp"></span>${readBtn('Read ' + Math.min(20, unread.length) + ' now')}<button class="kx" data-act="obarx" title="Close" aria-label="Close">${OWI.x}</button></div>` : '';
  const segs = [['all', `All <span>${groups.length}</span>`], ...['Media group', 'Same company', 'Linked by an ID', 'Sub-sites'].filter(k => kinds[k]).map(k => [k, `${k === 'Media group' ? 'Media groups' : k} <span>${kinds[k]}</span>`]), ...(withStolen ? [['stolen', `Has Stolen <span>${withStolen}</span>`]] : [])];
  const cmd = `<div class="ccmd ocmd"><label class="ksearch">${KI.search}<input type="search" id="ownerQ" placeholder="Find a company or site" aria-label="Find a company or site" value="${esc(state.ownerQ)}"></label>
    ${kSeg('Which owners', 'okind', segs, K)}<span class="sp"></span>
    <label class="ksort"><span class="kfaint">Sort</span><select data-act="osort" aria-label="Sort owners">${[['copies', 'Most copies'], ['stolen', 'Most Stolen'], ['sites', 'Most sites'], ['name', 'Name A to Z']].map(([v, l]) => `<option value="${v}" ${state.ownerSort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>`;
  const orow = o => `<button class="olr${sel && o.key === sel.key ? ' sel' : ''}" data-act="osel" data-v="${esc(o.key)}" data-name="${esc((o.name + ' ' + o.sites.join(' ')).toLowerCase())}" aria-pressed="${!!(sel && o.key === sel.key)}"><span class="cname">${owAv(o.name, 32)}<span class="kn1"><b>${esc(o.name)}</b><span>${owChip(o)}</span></span></span><span class="r num">${o.sites.length}</span><span class="r num">${o.copies.length}</span><span class="r num">${cnt(o, 'new') ? `<span class="onew">${cnt(o, 'new')}</span>` : '<span class="kfaint">0</span>'}</span><span class="r num">${cnt(o, 'stolen') ? `<span class="ostol">${cnt(o, 'stolen')}</span>` : '<span class="kfaint">0</span>'}</span>${KI.chev}</button>`;
  const list = `<section class="card olist" id="ownerList" aria-label="Owners"><div class="olh"><span>Owner</span><span class="r">Sites</span><span class="r">Copies</span><span class="r">New</span><span class="r">Stolen</span><span></span></div>${shown.slice(0, Math.max(state.ownerMore, sel ? shown.indexOf(sel) + 1 : 0)).map(orow).join('') || `<p class="kmuted" style="padding:16px 0">${groups.length ? 'No owners of that kind.' : 'No shared owners found yet. They show up once the sites with copies have been read.'}</p>`}<p class="kmuted" id="ownerNoMatch" style="padding:16px 0" hidden>No company or site matches that.</p>${shown.length > state.ownerMore ? `<div class="wmore2">Showing ${Math.min(state.ownerMore, shown.length)} of ${shown.length.toLocaleString()} · <a data-act="omore" href="#owners" role="button">Show more</a></div>` : ''}</section>`;

  let det = '';
  if (sel) {
    const { why, say } = owFacts(sel), k = esc(sel.key);
    const hit = {}; for (const c of sel.copies) { const n = c.clientName || c.client || 'No client'; hit[n] = (hit[n] || 0) + 1; }
    const cl = Object.entries(hit).sort((a, b) => b[1] - a[1]), max = cl[0] ? cl[0][1] : 1;
    const hdr = `<div class="odh" id="ownerHead">${owAv(sel.name, 56)}<span class="kn1"><b>${esc(sel.name)}</b><span>${owChip(sel)} <span class="kfaint">${plural(sel.sites.length, 'site')} · copied ${plural(cl.length, 'client')}</span></span></span><span class="sp"></span><button class="btn kbtn" data-act="ocopy" data-v="${k}">${OWI.clip}Copy owner details</button><button class="btn kbtn" data-act="ohideall" data-v="${k}">${OWI.ban}Hide all their sites</button><button class="btn primary kbtn" data-act="oseecopies" data-v="${k}">${KI.copies}See their ${plural(sel.copies.length, 'copy', 'copies')}</button></div>`;
    const tiles = `<div class="otiles" id="ownerTiles">${[[KC.blue, KI.copies, sel.copies.length, 'Copies', 'All'], [KC.teal, OWI.fresh, cnt(sel, 'new'), 'New to answer', 'New'], [KC.red, OWI.stolen, cnt(sel, 'stolen'), 'Stolen', 'Stolen'], [KC.green, OWI.lic, cnt(sel, 'licensed'), 'Licensed', 'Licensed']].map(([c, i, n, l, f]) => `<button class="otile" data-act="oseecopies" data-v="${k}" data-f="${f}" title="See these in All copies">${kSq(c, i, 36)}<span><b class="num">${n}</b><span>${l}</span></span>${KI.chev}</button>`).join('')}</div>`;
    const whyC = `<section class="card opad" id="ownerWhy"><div class="kh2">Why they're one owner</div>${why.map(([c, i, b, t]) => `<div class="owhy">${kSq(c, i, 32)}<span class="kn1"><b>${esc(b)}</b><span>${esc(t)}</span></span><span class="okc">${OWI.check} Found</span></div>`).join('')}<p class="kfoot">Only facts PageProof actually found. Check them before you rely on them.</p></section>`;
    const srows = sel.sites.map(s => ({ s, c: sel.copies.filter(x => x.site === s), f: FCD.facts.get(s) })).sort((a, b) => b.c.length - a.c.length);
    const sitesC = `<section class="card opad" id="ownerSites"><div class="kh2">Their sites <span class="kfaint">${sel.sites.length}</span></div><div class="osh"><span>Site</span><span class="r">Copies</span><span class="r">New</span><span class="r">Stolen</span><span>Read</span><span></span></div>
      ${(state.ownerSitesAll === sel.key ? srows : srows.slice(0, 12)).map(({ s, c, f }) => { const st = c.filter(x => x.status === 'stolen').length; return `<div class="osr"><span class="cname">${owSl(s)}<b>${esc(s)}</b></span><span class="r num">${c.length}</span><span class="r num">${c.filter(x => x.status === 'new').length || '<span class="kfaint">0</span>'}</span><span class="r num">${st ? `<span class="ostol">${st}</span>` : '<span class="kfaint">0</span>'}</span><span class="kfaint">${f && f.at ? owAgo(f.at) : 'Not yet'}</span><button class="olook wbt" data-act="owho" data-v="${esc(s)}">Look up ${KI.chev}</button></div>`; }).join('')}${srows.length > 12 && state.ownerSitesAll !== sel.key ? `<div class="wmore2"><a data-act="ositesall" data-v="${k}" href="#owners" role="button">Show all ${srows.length} sites</a></div>` : ''}</section>`;
    const sayC = say.length ? `<section class="card opad" id="ownerSay"><div class="kh2">What their sites say</div>${say.map(([c, i, b, v, t]) => `<div class="osay">${kSq(c, i, 32)}<span class="kn1"><span class="olab">${b}</span><b>${esc(v)}</b>${t ? `<span>${esc(t)}</span>` : ''}</span></div>`).join('')}</section>` : '';
    const clC = `<section class="card opad" id="ownerClients"><div class="kh2">Clients they copied <span class="kfaint">${cl.length}</span></div>${cl.slice(0, 12).map(([n, x]) => `<div class="ocl"><span class="cname">${owAv(n)}<b>${esc(n)}</b></span><span class="cbar"><i style="width:${x / max * 100}%"></i></span><span class="r num">${x}</span></div>`).join('')}${cl.length > 12 ? `<p class="kfaint">And ${cl.length - 12} more.</p>` : ''}<p class="kfoot">Handy when one claim covers every client this company copied.</p></section>`;
    det = `<div class="odet">${hdr}${tiles}<div class="kgrid two"><div class="kstack">${whyC}${sitesC}</div><div class="kstack">${sayC}${clC}</div></div></div>`;
  }
  return head('Copies found', 'Site owners', '') + `<div class="rvn kpn crn own">${ctl}${bar}${cmd}<div class="ogrid"><div class="kstack">${list}${owHow()}</div>${det}</div></div>`;
};
V.owners.guard = V.found.guard;
V.owners.after = () => {
  const i = document.getElementById('ownerQ');
  if (!i) return;
  const run = () => { const q = i.value.trim().toLowerCase(); state.ownerQ = i.value; let n = 0; for (const r of document.querySelectorAll('#ownerList .olr')) { const hit = !q || (r.dataset.name || '').includes(q); r.hidden = !hit; if (hit) n++; }
    const none = document.getElementById('ownerNoMatch'); if (none) none.hidden = !(q && !n); };
  i.addEventListener('input', run); run();
};
Object.assign(ACTS, {
  osel: v => { state.ownerSel = v; render(true); },
  otab: v => { if (v === 'who') { state.who = null; if (state.shown === 'who') return render(true); } location.hash = v === 'who' ? 'who' : 'owners'; },
  omore: () => { state.ownerMore += 40; render(true); },
  ositesall: v => { state.ownerSitesAll = v; render(true); },
  okind: v => { state.ownerKind = v; state.ownerSel = ''; state.ownerMore = 40; render(true); },
  osort: (v, el) => { state.ownerSort = el.value; render(true); },
  obarx: () => { state.ownerBarOff = true; render(true); },
  ohow: () => { const h = document.getElementById('ownerHow'); if (h) { h.scrollIntoView({ block: 'center', behavior: 'smooth' }); h.classList.add('flash'); setTimeout(() => h.classList.remove('flash'), 1600); } },
  oseecopies: (v, el) => { state.fOwner = v; state.fFilter = (el && el.dataset.f) || 'All'; state.fView = 'owner'; location.hash = 'found'; },
  owho: v => { state.who = { site: v, url: '' }; if (state.shown === 'who') render(true); else location.hash = 'who'; },
  ocopy: async v => {
    const o = FCD.owners.find(x => x.key === v);
    if (!o) return;
    const live = FCD.copies.filter(c => c.status !== 'removed' && visible(c) && o.sites.includes(c.site));
    const { why, say } = owFacts(o), n = s => live.filter(c => c.status === s).length;
    const text = [o.name, owKind(o)[0] + ' · ' + plural(o.sites.length, 'site'), '', 'Copies: ' + live.length + ' (new ' + n('new') + ', stolen ' + n('stolen') + ', licensed ' + n('licensed') + ')', '',
      'Why they are one owner:', ...why.map(w => '- ' + w[2] + ': ' + w[3]), '', 'Their sites:', ...o.sites.map(s => '- ' + s + ' (' + plural(live.filter(c => c.site === s).length, 'copy', 'copies') + ')'),
      ...(say.length ? ['', 'What their sites say:', ...say.map(s => '- ' + s[2] + ': ' + s[3] + (s[4] ? ' (' + s[4] + ')' : ''))] : []), '', 'Only facts PageProof found on the sites. Check them before relying on them.'].join('\n');
    await ntCopy(text, 'Owner details copied');
  },
  ohideall: async v => {
    const o = FCD.owners.find(x => x.key === v);
    if (!o) return;
    await RS_LISTS.load();
    const added = o.sites.filter(s => !RS_SITE.has(RS_LISTS.hidden, s) && !RS_LISTS.wholeSocial(s));
    for (const s of added) await RS_LISTS.add('hidden', s);
    HIST.push({ label: 'All ' + o.name + ' sites hidden', undo: async () => { await RS_LISTS.load(); for (const s of added) await RS_LISTS.remove('hidden', s); } });
    dropFC(); toast(plural(added.length, 'site') + ' of ' + o.name + ' hidden.', undoLast); render(true);
  },
  oreadall: async () => {
    state.whoBusy = true; render(true);
    const sites = [...new Set(FCD.copies.filter(c => c.status !== 'removed').map(c => c.site))].filter(s => !FCD.facts.has(s)).slice(0, 20);
    for (const s of sites) { const c = FCD.copies.find(x => x.site === s); try { await FC.lookup(s, c && c.url); } catch (e) { /* next */ } }
    state.whoBusy = false; dropFC(); toast('Read ' + plural(sites.length, 'site') + '.'); render(true);
  },
});

// ---------------------------------------------------------------- Who's behind this site
V.who = async () => {
  if (routeArg('site')) { state.who = { site: RS_SITE.tidy(routeArg('site')) || '', url: routeArg('url') || '' }; history.replaceState(null, '', '#who'); }
  const w = state.who;
  const form = `<section class="card olookup" id="whoForm"><div class="kh2">Who's behind a site?</div><div class="olin"><label class="ksearch wide">${OWI.globe}<input id="whoIn" placeholder="A site, like example.com, or a page address" value="${esc(w ? w.site : '')}" aria-label="Site"></label><button class="btn primary kbtn" data-act="whogo">${KI.search}Look it up</button></div><p class="kfoot">Reads the home page, About, Contact and Privacy pages and the domain record. Nothing is sent to the site except a normal visit, without your cookies.</p></section>`;
  const hd = head('Copies found', 'Site owners', '') + `<div class="rvn kpn crn own whotab"><div class="rvn-ctl kctl">${owTabs('lookup')}<span class="sp"></span>${w && w.site ? `<button class="btn kbtn" data-act="whoclear">${OWI.x}Look up another site</button>` : ''}</div>`;
  const end = '</div>';
  if (!w || !w.site) {
    // Sites read lately, newest first, with the owner each one names and its group.
    let lately = '';
    try {
      await loadFC();
      const live = FCD.copies.filter(c => c.status !== 'removed');
      const read = [...FCD.facts.values()].filter(f => f.at).sort((x, y) => (y.at > x.at ? 1 : -1)).slice(0, 12);
      if (read.length) lately = `<section class="card opad" id="whoLately"><div class="kh2">Sites read lately <span class="kfaint">${FCD.facts.size.toLocaleString()} read in all</span></div><div class="orh"><span>Site</span><span>Owner named</span><span>Owner group</span><span class="r">Copies</span><span>Read</span><span></span></div>
        ${read.map(f => { const o = FCD.ownerOf.get(f.site), n = (f.names || [])[0]; return `<div class="orr"><span class="cname">${owSl(f.site)}<b>${esc(f.site)}</b></span><span>${n ? esc(n) : '<span class="kfaint">Not named</span>'}</span><span>${o && o.real ? `<span class="okind" style="--c:${owKind(o)[1]}">${esc(o.name)}</span>` : '<span class="kfaint">On its own</span>'}</span><span class="r num">${live.filter(x => x.site === f.site).length}</span><span class="kfaint">${owAgo(f.at)}</span><button class="olook wbt" data-act="owho" data-v="${esc(f.site)}">Open ${KI.chev}</button></div>`; }).join('')}</section>`;
    } catch (e) { lately = ''; }
    return hd + form + lately + end;
  }
  const f0 = await FC.facts(w.site), f = f0 || {};
  const g = FC.groupOf(w.site);
  const name = (g && g.name) || (f.names || [])[0] || '';
  const enc = encodeURIComponent;
  const base = FC.baseOf(w.site), q = name || f.siteName || base;
  // 5b (Ben's way, in the firm's order): names it goes by, then brand to company, then is it active.
  // Ticks are kept per site on this computer.
  const research = await ntResearch(w, f, base, name, q);
  if (!f0) return `${hd}${form}<div class="grid g2"><section class="card pad" style="display:flex;flex-direction:column;gap:10px;align-items:flex-start"><h2>${esc(w.site)}</h2><p class="muted" style="margin:0">Not read yet. PageProof opens the home page, the page with the copy, and the About, Contact and Privacy pages, and reads the domain record.</p><button class="btn primary" data-act="whoread"${state.whoBusy ? ' disabled data-why="PageProof is already reading a site. Wait a moment."' : ''}>${state.whoBusy ? 'Reading the site…' : 'Read the site now'}</button></section>
    ${research}</div>${await ntEntityCard(base, f)}${end}`;
  const pages = [['about', 'About page'], ['contact', 'Contact page'], ['privacy', 'Privacy policy'], ['terms', 'Terms of service']].filter(([k]) => f[k]);
  return `${hd}${form}
  <section class="card pad" style="display:flex;flex-direction:column;gap:14px">
    <div class="row"><h2 style="overflow-wrap:anywhere">${esc(w.site)}</h2>${name ? `<span class="tag ok">Probably ${esc(name)}</span>` : '<span class="tag grey">No owner named</span>'}<button class="btn ghost sm" style="margin-left:auto" data-act="whoread"${state.whoBusy ? ' disabled data-why="PageProof is already reading a site. Wait a moment."' : ''}>${state.whoBusy ? 'Reading…' : 'Read again'}</button></div>
    <span class="faint" style="font-size:12.5px">Read ${fmtDate(f.at)} from ${plural((f.pages || []).length, 'page')}. Only what was actually found is shown.</span>
    ${g ? `<div class="banner info" style="padding:10px 12px"><span><b>${esc(g.name)}</b>: ${esc(g.how)}</span></div>` : ''}
    <div class="grid g2">${(f.clues || []).map(c => `<div class="clue"><b>${esc(c.title)}</b><span style="overflow-wrap:anywhere">${esc(c.value)}</span><span class="faint" style="font-size:12px">From: ${esc(c.src || '')}</span></div>`).join('') || '<p class="muted">The site doesn\'t name its owner anywhere PageProof looked.</p>'}</div>
    ${(f.ids || []).length ? `<div><div class="dsh">Tracking and ad IDs</div><p class="muted" style="margin:4px 0 0;font-size:13.5px">Sites with the same ID are usually run by the same people. <span class="mono">${(f.ids || []).map(esc).join(' · ')}</span></p></div>` : ''}
  </section>
  ${ntNames(f, base)}
  ${await ntEntityCard(base, f)}
  <div class="grid g2">
    ${research}
    <section class="card pad" style="display:flex;flex-direction:column;gap:10px"><h2>Capture their pages</h2><p class="muted" style="margin:0;font-size:14px">Save the pages that name the owner as evidence too. Each one opens and is captured like any other page.</p>
      ${pages.map(([k, l]) => `<div class="row"><span style="flex:1;min-width:0"><b>${l}</b><br><span class="mono faint" style="font-size:12px;overflow-wrap:anywhere">${esc(f[k])}</span></span><button class="btn sm" data-act="whocap" data-v="${esc(f[k])}">${ic('capture', 16)} Capture</button></div>`).join('') || '<p class="faint" style="margin:0">No About, Contact or Privacy page found.</p>'}</section>
  </div>${end}`;
};
V.who.noAutoRedraw = true;
V.who.after = () => { const i = document.getElementById('whoIn'); if (i) i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ACTS.whogo(); } }); };
Object.assign(ACTS, {
  rstep: async (v, el) => {
    const i = v.lastIndexOf('|'), base = v.slice(0, i), k = v.slice(i + 1);
    const all = (await FC.meta.get('research')) || {};
    const t = new Set(all[base] || []);
    el.checked ? t.add(k) : t.delete(k);
    all[base] = [...t]; await FC.meta.set('research', all);
    render(true);
  },
  whoclear: () => { state.who = null; render(true); },
  whogo: () => {
    const v = (document.getElementById('whoIn') || {}).value || '';
    let site = '', url = '';
    try { const u = new URL(/^https?:/i.test(v.trim()) ? v.trim() : 'https://' + v.trim()); site = u.hostname.replace(/^www\./, ''); url = /^https?:/i.test(v.trim()) ? u.href : ''; } catch (e) { /* bad */ }
    if (!site || !site.includes('.')) return toast('Type a site like example.com');
    state.who = { site, url }; render(true);
  },
  whoread: async () => {
    state.whoBusy = true; render(true);
    try { await FC.lookup(state.who.site, state.who.url); } catch (e) { toast('The site could not be read.'); }
    state.whoBusy = false; dropFC(); render(true);
  },
  whocap: async v => { await api.runtime.sendMessage({ type: 'captureUrl', url: v }).catch(() => {}); toast('Opening the page to capture it…'); },
});

// ---------------------------------------------------------------- Weekly summary
async function weekData(key) {
  const w = (await FC.week(key)) || { searched: 0, found: 0, stolen: 0, licensed: 0, removed: 0, wentOffline: 0, backOnline: 0, clients: {}, offline: [], back: [] };
  const start = new Date(key + 'T00:00:00'), end = new Date(start.getTime() + 6 * 86400000);
  // Clients that reached "every photo searched at least once" this week (4.10).
  const endKey = new Date(start.getTime() + 7 * 86400000).toISOString();
  const finished = (await FC.firstNotes()).filter(n => n.at >= start.toISOString() && n.at < endKey);
  return { ...w, first: w.first || 0, finished, start, end, label: start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' – ' + end.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) };
}
V.weekly = async () => {
  const key = state.wkKey || FC.weekKey();
  const w = await weekData(key);
  const prev = FC.weekKey(new Date(w.start.getTime() - 86400000)), next = FC.weekKey(new Date(w.start.getTime() + 8 * 86400000));
  const clients = Object.entries(w.clients).sort((a, b) => b[1].found - a[1].found);
  const allReports = (await api.storage.local.get('fcReports')).fcReports || [];
  const reports = allReports.filter(r => r.at >= key && r.at < next), prevReports = allReports.filter(r => r.at >= prev && r.at < key).length;
  const pw = await weekData(prev);
  return `${head('Library', 'Weekly summary', 'What PageProof did this week, ready to print or send to your manager.', `<button class="btn" data-act="wk" data-v="${prev}">‹ Week before</button>${next <= FC.weekKey() ? `<button class="btn" data-act="wk" data-v="${next}">Next week ›</button>` : ''}<button class="btn primary" data-act="wkpdf">${ic('down', 18)} Save as PDF</button>`)}
  <section class="paper" style="max-width:860px">
    <div class="row"><img src="icons/icon48.png" width="28" height="28" alt=""><b>PageProof weekly summary</b><span class="muted" style="margin-left:auto">${esc(w.label)}</span></div>
    <div class="wtiles">${[[w.searched, pw.searched, 'photos searched'], [w.found, pw.found, 'new copies found'], [w.stolen, pw.stolen, 'marked stolen', 'bad'], [w.licensed, pw.licensed, 'licensed', 'ok'], [w.removed, pw.removed, 'removed'], [reports.length, prevReports, 'evidence reports']].map(([n, b, l, col]) => {
      const d = b ? Math.round((n - b) / b * 100) : n ? null : 0;
      return `<div class="wtile"><b class="num"${col ? ` style="color:var(--${col})"` : ''}>${n.toLocaleString()}</b><span>${l}</span><small class="${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d === null ? 'new this week' : d === 0 ? 'same as last week' : (d > 0 ? '▲ ' : '▼ ') + Math.abs(d) + '% vs last week'}</small></div>`; }).join('')}</div>
    <h3>By client</h3>
    ${clients.length ? `<div class="wbars"><div class="wleg"><span><i class="s"></i>Stolen</span><span><i class="f"></i>Other copies found</span><span class="faint">Bar length = copies found · number = photos searched</span></div>${clients.slice(0, 20).map(([n, c]) => { const max = Math.max(1, ...clients.map(([, x]) => x.found)); return `<div class="wbar"><span class="wn" title="${esc(n)}">${esc(n)}</span><span class="wtrack"><i class="s" style="width:${(c.stolen / max * 100).toFixed(1)}%"></i><i class="f" style="width:${(Math.max(0, c.found - c.stolen) / max * 100).toFixed(1)}%"></i></span><span class="num wv">${c.found} found · ${c.stolen} stolen · ${c.searched} searched</span></div>`; }).join('')}</div>` : '<p class="muted">Nothing searched this week.</p>'}
    <h3>Every photo searched once</h3>
    <p style="margin:0">${w.first.toLocaleString()} ${w.first === 1 ? 'photo was' : 'photos were'} searched for the first time this week.${w.finished.length ? ' Every photo now searched at least once: ' + esc(w.finished.map(n => n.name + ' (' + n.n.toLocaleString() + ' photos)').join(', ')) + '.' : ''}</p>
    ${reports.length ? `<h3>Evidence reports</h3><ul>${reports.slice(0, 40).map(r => `<li>${esc(r.site)} · ${esc(r.photo || '')}${r.caseNo ? ' · case ' + esc(r.caseNo) : ''}</li>`).join('')}</ul>` : ''}
  </section>`;
};
Object.assign(ACTS, {
  wk: v => { state.wkKey = v; render(true); },
  wkpdf: async () => {
    const w = await weekData(state.wkKey || FC.weekKey());
    const W = 1240, H = 1754, c = new OffscreenCanvas(W, H), x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#22252E'; x.font = 'bold 44px Arial'; x.fillText('PageProof weekly summary', 80, 130);
    x.font = '28px Arial'; x.fillStyle = '#5E6582'; x.fillText(w.label, 80, 180);
    const box = (i, n, l, col) => { const bx = 80 + (i % 4) * 275, by = 240 + Math.floor(i / 4) * 170; x.strokeStyle = '#D6DBE3'; x.lineWidth = 2; x.strokeRect(bx, by, 255, 145); x.fillStyle = col || '#22252E'; x.font = 'bold 56px Arial'; x.fillText(String(n), bx + 22, by + 76); x.fillStyle = '#5E6582'; x.font = '24px Arial'; x.fillText(l, bx + 22, by + 118); };
    [[w.searched, 'photos searched'], [w.found, 'new copies'], [w.stolen, 'marked stolen', '#C62828'], [w.licensed, 'licensed', '#1B7F3B'], [w.removed, 'removed']].forEach((b, i) => box(i, ...b));
    let y = 650;
    x.fillStyle = '#22252E'; x.font = 'bold 32px Arial'; x.fillText('By client', 80, y); y += 50;
    x.font = 'bold 24px Arial'; ['Client', 'Searched', 'Found', 'Stolen'].forEach((t, i) => x.fillText(t, [80, 700, 860, 1020][i], y)); y += 14;
    x.fillStyle = '#D6DBE3'; x.fillRect(80, y, 1080, 2); y += 36;
    x.font = '24px Arial'; x.fillStyle = '#22252E';
    for (const [n, cc] of Object.entries(w.clients).sort((a, b) => b[1].found - a[1].found).slice(0, 28)) {
      x.fillText(n.length > 44 ? n.slice(0, 43) + '…' : n, 80, y); x.fillText(String(cc.searched), 700, y); x.fillText(String(cc.found), 860, y); x.fillText(String(cc.stolen), 1020, y); y += 38;
    }
    if (y < H - 220) {
      y += 30; x.font = 'bold 32px Arial'; x.fillStyle = '#22252E'; x.fillText('Every photo searched once', 80, y); y += 44; x.font = '24px Arial';
      x.fillText(w.first.toLocaleString() + ' photos searched for the first time this week.', 80, y); y += 34;
      for (const n of w.finished.slice(0, 4)) { if (y > H - 200) break; x.fillText('• ' + (n.name.length > 50 ? n.name.slice(0, 49) + '…' : n.name) + ': all ' + n.n.toLocaleString() + ' photos searched at least once', 80, y); y += 34; }
    }
    if (w.back.length && y < H - 200) { y += 30; x.font = 'bold 32px Arial'; x.fillText('Came back online', 80, y); y += 44; x.font = '24px Arial'; for (const [s] of w.back.slice(0, Math.floor((H - 150 - y) / 34))) { x.fillText('• ' + s, 80, y); y += 34; } }
    x.fillStyle = '#5E6582'; x.font = '20px Arial'; x.fillText('Made by PageProof ' + VERSION + ' on ' + new Date().toLocaleString(), 80, H - 70);
    const jpg = new Uint8Array(await (await c.convertToBlob({ type: 'image/jpeg', quality: 0.92 })).arrayBuffer());
    const pdf = makePdf([{ jpeg: jpg, width: W, height: H }], { title: 'PageProof weekly summary', subject: w.label });
    const a = document.createElement('a'); a.href = URL.createObjectURL(pdf); a.download = 'PageProof_weekly_' + (state.wkKey || FC.weekKey()) + '.pdf'; a.click();
  },
});
