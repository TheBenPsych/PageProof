// Find copies › Site owners, Who's behind this site, and the Weekly summary.
Object.assign(state, { ownerSel: '', ownerQ: '', who: null, whoBusy: false, wkKey: '' });

// ---------------------------------------------------------------- Site owners
V.owners = async () => {
  await loadFC();
  const live = FCD.copies.filter(c => c.status !== 'removed' && visible(c));
  const groups = FCD.owners.filter(o => o.real).map(o => ({ ...o, copies: live.filter(c => o.sites.includes(c.site)) })).filter(o => o.copies.length).sort((a, b) => b.copies.length - a.copies.length);
  const q = state.ownerQ.toLowerCase();
  const shown = groups.filter(o => !q || o.name.toLowerCase().includes(q) || o.sites.some(s => s.includes(q)));
  const sel = groups.find(o => o.key === state.ownerSel) || shown[0];
  const unread = [...new Set(live.map(c => c.site))].filter(s => !FCD.facts.has(s));
  const detail = sel ? (() => {
    const facts = sel.sites.map(s => FCD.facts.get(s)).filter(Boolean);
    const clues = []; for (const f of facts) for (const c of f.clues || []) if (!clues.some(x => x.value === c.value)) clues.push({ ...c, site: f.site });
    const st = n => sel.copies.filter(c => c.status === n).length;
    return `<section class="card pad" style="flex:3 1 480px;display:flex;flex-direction:column;gap:14px;min-width:0">
      <div class="row" style="gap:12px"><span class="oav" style="width:44px;height:44px;font-size:20px">${esc(sel.name[0] || '?')}</span><div style="min-width:0"><h2>${esc(sel.name)}</h2><span class="muted" style="font-size:13.5px">${esc(sel.kind)} · ${plural(sel.sites.length, 'site')}</span></div></div>
      <div class="big4 themed"><div><b>${sel.copies.length}</b><span>copies</span></div><div><b style="color:var(--copy)">${st('new')}</b><span>new</span></div><div><b style="color:var(--bad)">${st('stolen')}</b><span>stolen</span></div><div><b style="color:var(--ok)">${st('licensed')}</b><span>licensed</span></div></div>
      <div><div class="dsh">Why PageProof thinks they're one owner</div><ul style="margin:6px 0 0;padding-left:20px;font-size:14px">${sel.how.map(h => `<li>${esc(h)}</li>`).join('') || '<li>Sub-sites of one domain</li>'}</ul><p class="faint" style="font-size:12.5px;margin:6px 0 0">Only facts PageProof actually found are shown. Check them before you rely on them.</p></div>
      <div><div class="dsh">Their sites</div><div class="row" style="gap:6px;margin-top:6px">${sel.sites.map(s => `<span class="chip">${esc(s)} <span class="faint">${live.filter(c => c.site === s).length}</span></span>`).join('')}</div></div>
      ${clues.length ? `<div><div class="dsh">What their sites say</div><div class="ofacts" style="margin-top:6px">${clues.slice(0, 12).map(c => `<div class="ofact"><b>${esc(c.title)}</b><span style="overflow-wrap:anywhere">${esc(c.value)}</span><span class="faint" style="font-size:12px">${esc(c.site)} · ${esc(c.src || '')}</span></div>`).join('')}</div></div>` : ''}
      <div class="row"><button class="btn primary" data-act="oseecopies" data-v="${esc(sel.key)}">See their copies</button><button class="btn" data-act="owho" data-v="${esc(sel.sites[0])}">Who's behind this site</button><button class="btn" data-act="ohideall" data-v="${esc(sel.key)}">${ic('ban', 16)} Hide all their sites</button></div>
    </section>`;
  })() : '';
  return `${head('Find copies', 'Site owners', 'Sites that belong to one company, put together: a media group, the same company in the footer, the same Google Analytics or ad ID, or sub-sites of one domain.', unread.length ? `<button class="btn" data-act="oreadall"${state.whoBusy ? ' disabled' : ''}>${state.whoBusy ? 'Reading…' : 'Read ' + Math.min(20, unread.length) + ' more sites'}</button>` : '')}
  <p class="faint" style="margin:0;font-size:13px">${unread.length ? plural(unread.length, 'site has', 'sites have') + ' not been read yet. Keep searching reads one new site every couple of minutes.' : 'Every site with a copy has been read.'}</p>
  <div class="split">
    <section class="card" style="flex:2 1 300px;align-self:flex-start;overflow:hidden">
      <div class="pad" style="border-bottom:1px solid var(--line)"><input type="search" id="ownerQ" class="chip" style="min-height:36px;padding:0 10px;font-size:14px;width:100%" placeholder="Find a company or site" value="${esc(state.ownerQ)}" aria-label="Find a company or site"></div>
      ${shown.map(o => `<button class="orow${sel && o.key === sel.key ? ' on' : ''}" data-act="osel" data-v="${esc(o.key)}"><span class="oav">${esc(o.name[0] || '?')}</span><span style="min-width:0;flex:1;text-align:left"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(o.name)}</b><span class="faint" style="font-size:12.5px">${plural(o.sites.length, 'site')} · ${esc(o.kind)}</span></span><span class="tag ${o.copies.some(c => c.status === 'new') ? 'copy' : 'grey'}">${o.copies.length}</span></button>`).join('') || '<div class="pad muted">No shared owners found yet.</div>'}
    </section>
    ${detail}
  </div>`;
};
V.owners.guard = V.found.guard;
V.owners.after = () => {
  const i = document.getElementById('ownerQ');
  if (i) i.oninput = () => { state.ownerQ = i.value; clearTimeout(i._t); i._t = setTimeout(() => render(true).then(() => { const j = document.getElementById('ownerQ'); if (j) { j.focus(); j.setSelectionRange(j.value.length, j.value.length); } }), 250); };
};
Object.assign(ACTS, {
  osel: v => { state.ownerSel = v; render(true); },
  oseecopies: v => { state.fOwner = v; state.fFilter = 'All'; state.fView = 'owner'; location.hash = 'found'; },
  owho: v => { state.who = { site: v, url: '' }; location.hash = 'who'; },
  ohideall: async v => {
    const o = FCD.owners.find(x => x.key === v);
    if (!o) return;
    await RS_LISTS.load();
    const added = o.sites.filter(s => !RS_LISTS.hidden.includes(s) && !RS_LISTS.wholeSocial(s));
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
  const form = `<section class="card pad row" style="gap:10px"><input id="whoIn" class="chip" style="min-height:40px;padding:0 12px;font-size:15px;flex:1 1 260px" placeholder="A site, like example.com, or a page address" value="${esc(w ? w.site : '')}" aria-label="Site"><button class="btn primary" data-act="whogo">Look it up</button></section>`;
  const hd = head('Find copies', 'Who\'s behind this site', 'Names, contacts and domain facts read off the site itself, plus quick links to look the company up. Nothing is sent to the site except a normal visit, without your cookies.');
  if (!w || !w.site) return hd + form;
  const f0 = await FC.facts(w.site), f = f0 || {};
  const g = FC.groupOf(w.site);
  const name = (g && g.name) || (f.names || [])[0] || '';
  const enc = encodeURIComponent;
  const base = FC.baseOf(w.site), q = name || f.siteName || base;
  // The firm's research steps, in order, as tick boxes. Ticks are kept per site on this computer.
  const steps = [
    ['pages', 'Footer, Terms, Privacy and About pages', 'Look for a company name or address you can then search for', 'https://' + base],
    ['owners', 'Already in Site owners?', 'Check if this company is already known', '#owners'],
    ['justia', 'Trademark search (Justia)', 'Sometimes shows the address and state of the company', 'https://trademarks.justia.com/search?q=' + enc(q)],
    ['uspto', 'USPTO trademarks', 'Who owns the brand name', 'https://tmsearch.uspto.gov/search/search-results?query=' + enc(f.siteName || name || base.split('.')[0])],
    ['opencorp', 'OpenCorporates', 'Companies registered with this name', 'https://opencorporates.com/companies?q=' + enc(q)],
    ['state', 'State business search', 'Look the company up on its state\'s business website', 'https://www.google.com/search?q=' + enc('"' + q + '" secretary of state business entity search')],
    ['delaware', 'Delaware business search (do this last)', 'Many companies are formed in Delaware', 'https://icis.corp.delaware.gov/ecorp/entitysearch/namesearch.aspx'],
    ['whois', 'Who registered the domain', 'whois.com and the official ICANN record', 'https://www.whois.com/whois/' + enc(base)],
    ['archive', 'Old contact pages on archive.org', 'Addresses and names the site has since removed', 'https://web.archive.org/web/*/' + enc(base) + '/*contact*'],
    ['courts', 'Past lawsuits', 'Court records that name the company', 'https://www.courtlistener.com/?q=' + enc('"' + q + '"')],
    ['google', 'Google', 'Search for the owner', 'https://www.google.com/search?q=' + enc('"' + base + '" owner OR "owned by" OR "operated by"')],
    ['linkedin', 'LinkedIn', 'People who work there', 'https://www.linkedin.com/search/results/companies/?keywords=' + enc(q)],
  ];
  const ticks = ((await FC.meta.get('research')) || {})[base] || [];
  const done = steps.filter(x => ticks.includes(x[0])).length;
  const research = `    <section class="card pad" style="display:flex;flex-direction:column;gap:8px"><div class="row"><h2>Research steps</h2><span class="tag ${done === steps.length ? 'ok' : 'blue'}" style="margin-left:auto">${done} of ${steps.length} done</span></div>
      <p class="muted" style="margin:0;font-size:13.5px">Go through them in order. Tick each one when it's done. Ticks are saved for ${esc(base)}.</p>
      ${steps.map(([k, t, d, u]) => `<div class="rstep${ticks.includes(k) ? ' done' : ''}"><input type="checkbox" id="rs-${k}" data-act="rstep" data-v="${esc(base)}|${k}" ${ticks.includes(k) ? 'checked' : ''} aria-label="${esc(t)} done"><label for="rs-${k}"><b>${esc(t)}</b><span class="muted">${esc(d)}</span></label><a class="btn ghost sm" href="${safeUrl(u)}"${u.startsWith('#') ? '' : ' target="_blank" rel="noreferrer"'}>Open${u.startsWith('#') ? '' : ' ↗'}</a></div>`).join('')}
    </section>`;
  if (!f0) return `${hd}${form}<div class="grid g2"><section class="card pad" style="display:flex;flex-direction:column;gap:10px;align-items:flex-start"><h2>${esc(w.site)}</h2><p class="muted" style="margin:0">Not read yet. PageProof opens the home page, the page with the copy, and the About, Contact and Privacy pages, and reads the domain record.</p><button class="btn primary" data-act="whoread"${state.whoBusy ? ' disabled' : ''}>${state.whoBusy ? 'Reading the site…' : 'Read the site now'}</button></section>
    ${research}</div>`;
  const pages = [['about', 'About page'], ['contact', 'Contact page'], ['privacy', 'Privacy policy']].filter(([k]) => f[k]);
  return `${hd}${form}
  <section class="card pad" style="display:flex;flex-direction:column;gap:14px">
    <div class="row"><h2 style="overflow-wrap:anywhere">${esc(w.site)}</h2>${name ? `<span class="tag ok">Probably ${esc(name)}</span>` : '<span class="tag grey">No owner named</span>'}<button class="btn ghost sm" style="margin-left:auto" data-act="whoread"${state.whoBusy ? ' disabled' : ''}>${state.whoBusy ? 'Reading…' : 'Read again'}</button></div>
    <span class="faint" style="font-size:12.5px">Read ${fmtDate(f.at)} from ${plural((f.pages || []).length, 'page')}. Only what was actually found is shown.</span>
    ${g ? `<div class="banner info" style="padding:10px 12px"><span><b>${esc(g.name)}</b>: ${esc(g.how)}</span></div>` : ''}
    <div class="grid g2">${(f.clues || []).map(c => `<div class="clue"><b>${esc(c.title)}</b><span style="overflow-wrap:anywhere">${esc(c.value)}</span><span class="faint" style="font-size:12px">From: ${esc(c.src || '')}</span></div>`).join('') || '<p class="muted">The site doesn\'t name its owner anywhere PageProof looked.</p>'}</div>
    ${(f.ids || []).length ? `<div><div class="dsh">Tracking and ad IDs</div><p class="muted" style="margin:4px 0 0;font-size:13.5px">Sites with the same ID are usually run by the same people. <span class="mono">${(f.ids || []).map(esc).join(' · ')}</span></p></div>` : ''}
  </section>
  <div class="grid g2">
    ${research}
    <section class="card pad" style="display:flex;flex-direction:column;gap:10px"><h2>Capture their pages</h2><p class="muted" style="margin:0;font-size:14px">Save the pages that name the owner as evidence too. Each one opens and is captured like any other page.</p>
      ${pages.map(([k, l]) => `<div class="row"><span style="flex:1;min-width:0"><b>${l}</b><br><span class="mono faint" style="font-size:12px;overflow-wrap:anywhere">${esc(f[k])}</span></span><button class="btn sm" data-act="whocap" data-v="${esc(f[k])}">${ic('capture', 16)} Capture</button></div>`).join('') || '<p class="faint" style="margin:0">No About, Contact or Privacy page found.</p>'}</section>
  </div>`;
};
V.who.noAutoRedraw = true;
Object.assign(ACTS, {
  rstep: async (v, el) => {
    const i = v.lastIndexOf('|'), base = v.slice(0, i), k = v.slice(i + 1);
    const all = (await FC.meta.get('research')) || {};
    const t = new Set(all[base] || []);
    el.checked ? t.add(k) : t.delete(k);
    all[base] = [...t]; await FC.meta.set('research', all);
    render(true);
  },
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
  const reports = ((await api.storage.local.get('fcReports')).fcReports || []).filter(r => r.at >= key && r.at < next);
  return `${head('Library', 'Weekly summary', 'What PageProof did this week, ready to print or send to your manager.', `<button class="btn" data-act="wk" data-v="${prev}">‹ Week before</button>${next <= FC.weekKey() ? `<button class="btn" data-act="wk" data-v="${next}">Next week ›</button>` : ''}<button class="btn primary" data-act="wkpdf">${ic('down', 18)} Save as PDF</button>`)}
  <section class="paper" style="max-width:860px">
    <div class="row"><img src="icons/icon48.png" width="28" height="28" alt=""><b>PageProof weekly summary</b><span class="muted" style="margin-left:auto">${esc(w.label)}</span></div>
    <div class="big4"><div><b>${w.searched}</b><span>photos searched</span></div><div><b>${w.found}</b><span>new copies found</span></div><div><b style="color:var(--bad)">${w.stolen}</b><span>marked stolen</span></div><div><b style="color:var(--ok)">${w.licensed}</b><span>licensed</span></div></div>
    <div class="big4"><div><b>${w.removed}</b><span>removed</span></div><div><b>${w.wentOffline}</b><span>went offline</span></div><div><b style="color:var(--bad)">${w.backOnline}</b><span>came back online</span></div><div><b>${reports.length}</b><span>evidence reports</span></div></div>
    <h3>By client</h3>
    ${clients.length ? `<table><thead><tr><th>Client</th><th>Searched</th><th>Found</th><th>Stolen</th></tr></thead><tbody>${clients.map(([n, c]) => `<tr><td>${esc(n)}</td><td class="num">${c.searched}</td><td class="num">${c.found}</td><td class="num">${c.stolen}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Nothing searched this week.</p>'}
    <h3>Every photo searched once</h3>
    <p style="margin:0">${w.first.toLocaleString()} ${w.first === 1 ? 'photo was' : 'photos were'} searched for the first time this week.${w.finished.length ? ' Every photo now searched at least once: ' + esc(w.finished.map(n => n.name + ' (' + n.n.toLocaleString() + ' photos)').join(', ')) + '.' : ''}</p>
    ${w.back.length ? `<h3>Came back online</h3><ul>${w.back.map(([s, t]) => `<li>${esc(s)} · ${fmtDate(t)}</li>`).join('')}</ul>` : ''}
    ${w.offline.length ? `<h3>Went offline</h3><ul>${w.offline.slice(0, 30).map(([s, t]) => `<li>${esc(s)} · ${fmtDate(t)}</li>`).join('')}</ul>` : ''}
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
    [[w.searched, 'photos searched'], [w.found, 'new copies'], [w.stolen, 'marked stolen', '#C62828'], [w.licensed, 'licensed', '#1B7F3B'], [w.removed, 'removed'], [w.wentOffline, 'went offline'], [w.backOnline, 'back online', '#C62828']].forEach((b, i) => box(i, ...b));
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
