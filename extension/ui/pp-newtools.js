// New tools and tabs (Ben's picks, 2026-11-24):
//  1. Copies found › Credit search   (#credit)   PP_WATCH credit line search
//  2. Copies found › Watching        (#watching) PP_WATCH watch list
//  3. Clients › Registrations        (#regs)     photos with copies but no VA number yet
//  5. Site panel and Who's behind this site: names it goes by, brand to company, is it active
//     (Ben's way of finding the company behind a site; only actively registered companies are pursued)
const NT = { regTab: 'none', regMore: 200, creditOpen: '' };
const ntDate = iso => { if (!iso) return ''; const d = new Date(typeof iso === 'number' ? iso : iso); return isNaN(d) ? '' : d.toLocaleDateString('en-US'); };
async function ntCopy(text, what) {
  try { await navigator.clipboard.writeText(text); toast((what || 'Copied') + '.'); }
  catch (e) { toast('Copy did not work here. Select the text and press Ctrl+C.'); }
}
const ntCard = (title, body, right = '') => `<section class="card pad" style="display:flex;flex-direction:column;gap:12px"><div class="row" style="gap:10px;flex-wrap:wrap"><h2 style="margin:0">${title}</h2><span style="margin-left:auto" class="row">${right}</span></div>${body}</section>`;
async function ntKeepNote() {
  try { const q = await FC.quietOK(); if (q.ok) return ''; return `<div class="banner info" style="padding:10px 12px"><span>${q.why === 'paused' ? 'Keep searching is paused, so this waits until you press Resume.' : q.why === 'hours' ? 'Outside your hours: this carries on when your hours start.' : 'Keep searching is off. This runs alongside Keep searching, so turn it on to use it.'} <a href="#keep">Keep searching</a></span></div>`; } catch (e) { return ''; }
}

// ================================================================ 1. Credit search
const ntPer = per => { const p = Object.entries(per || {}); return p.length ? p.map(([e, n]) => (PP_WATCH.ENG_NAME[e] || e) + ' listed ' + n).join(', ') : 'Nothing listed'; };
// "Search now" runs here, on this page, with its own progress card (Ben, 2026-11-25).
function ntRunCard(r) {
  if (!r) return '';
  const done = r.phase === 'done';
  const total = (r.words || 0) + Math.max(r.pages || 0, r.read || 0);
  const at = (r.wDone || 0) + (r.read || 0);
  const pct = done ? 100 : total ? Math.max(3, Math.round(at / total * 100)) : 3;
  const step = done ? '' : r.phase === 'search'
    ? `Searching Google and Bing for wording ${Math.min((r.wDone || 0) + 1, r.words)} of ${r.words}: <span class="mono">${esc(r.now || '')}</span>`
    : `Reading credited page ${Math.min((r.read || 0) + 1, r.pages || 1)} of ${r.pages || 0}: <span class="mono" style="overflow-wrap:anywhere">${esc(r.now || '')}</span>`;
  const mins = Math.max(1, Math.round(((r.end || Date.now()) - r.start) / 60000));
  const why = r.why === 'robot' ? '<div class="banner warn" style="padding:10px 12px"><span>Google and Bing both asked for a robot check, so this stopped. They rest for an hour. PageProof never tries to get past one.</span></div>'
    : r.why ? `<div class="banner warn" style="padding:10px 12px"><span>Something went wrong: ${esc(r.why)}.</span></div>` : '';
  return ntCard(done ? `Search for ${esc(r.client)} finished` : `Searching ${esc(r.client)}'s credit lines`, `
    <div class="row" style="gap:10px;flex-wrap:nowrap"><span class="bar" style="flex:1;height:10px"><i style="width:${pct}%${done ? ';background:var(--ok)' : ''}"></i></span><b class="num">${pct}%</b></div>
    ${step ? `<p class="muted" style="margin:0;font-size:13.5px">${step}</p>` : ''}
    <div class="grid g4" style="gap:10px">
      <div class="clue"><b>${r.wDone || 0} of ${r.words || 0}</b><span class="muted">wordings searched</span></div>
      <div class="clue"><b>${r.read || 0} of ${r.pages || 0}</b><span class="muted">new pages read</span></div>
      <div class="clue"><b>${r.found || 0}</b><span class="muted">copies found</span></div>
      <div class="clue"><b>${r.nomatch || 0}</b><span class="muted">credit but none of their photos</span></div></div>
    ${done ? `<p class="faint" style="margin:0;font-size:12.5px">Took about ${plural(mins, 'minute')}. ${ntPer(r.per)}${r.both ? ', ' + r.both + ' found by both (read once)' : ''}; pages read before were skipped.${r.robotOne ? ' One search site asked for a robot check and rests for an hour; the other carried on.' : ''}${r.known ? ' ' + plural(r.known, 'page') + ' showed a copy already in Copies found.' : ''}${r.failed ? ' ' + plural(r.failed, 'page') + ' would not open.' : ''}</p>` : '<p class="faint" style="margin:0;font-size:12.5px">You can use other pages while this runs. Keep this PageProof tab open.</p>'}
    ${why}`, done && r.found ? `<a class="btn primary" href="#found?via=credit">See the ${plural(r.found, 'copy', 'copies')}</a>` : '');
}
let NT_RUN_T = null;
function ntRunWatch() {
  clearInterval(NT_RUN_T);
  NT_RUN_T = setInterval(async () => {
    if (state.shown !== 'credit') return;
    const el = document.getElementById('creditrun');
    const r = PP_WATCH.live() || await PP_WATCH.runInfo();
    if (!el || !r) return;
    el.innerHTML = ntRunCard(r);
    if (r.end) { clearInterval(NT_RUN_T); render(true); }
  }, 1000);
}
V.credit = async () => {
  const [cfg, s, clients] = [await PP_WATCH.creditCfg(), await PP_WATCH.creditState(), (await FC.DB.all('clients')).filter(c => c.searching !== false).sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0) || a.name.localeCompare(b.name))];
  const R = (await api.storage.local.get('fcRest').catch(() => ({}))).fcRest || {};
  const resting = PP_WATCH.ENGINES.filter(e => (R[e] || 0) > Date.now());
  const hd = head('Copies found', 'Credit search', 'PageProof asks Google and Bing for pages that print a client\'s photo credit, like "Photo: Harbor Times", then compares the pictures on those pages with that client\'s photos. A page both of them find is read once. This finds heavy crops and edits a picture search can miss. Each wording is searched once a week, in your hours, alongside Keep searching.',
    `<label class="row" style="gap:8px;font-weight:600">${sSwitch('data-act="crediton"', cfg.on, 'Credit search on')} ${cfg.on ? 'On' : 'Off'}</label>`);
  const last = s.log.slice(-5).reverse();
  const status = ntCard('What it has done', `<div class="grid g3" style="gap:10px">
      <div class="clue"><b>${(s.found || 0).toLocaleString()}</b><span class="muted">copies found by a credit</span></div>
      <div class="clue"><b>${(s.pages || 0).toLocaleString()}</b><span class="muted">credited pages read</span></div>
      <div class="clue"><b>${s.queue.length}</b><span class="muted">pages waiting to be read</span></div></div>
    ${resting.map(e => `<div class="banner warn" style="padding:10px 12px"><span>${PP_WATCH.ENG_NAME[e]} asked for a robot check, so it rests until ${new Date(R[e]).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${resting.length < PP_WATCH.ENGINES.length ? ' and the other search site carries on' : ''}. PageProof never tries to get past one.</span></div>`).join('')}
    ${last.length ? `<table class="ntt">${last.map(l => `<tr><td>${esc(shortDate(l.at))}</td><td><b>${esc(l.client)}</b> <span class="mono">${esc(l.words)}</span></td><td>${l.per ? esc(ntPer(l.per)) + (l.both ? ' · ' + l.both + ' by both' : '') : plural(l.links, 'page') + ' listed'} · ${l.added} new to read</td></tr>`).join('')}</table>` : '<p class="muted" style="margin:0">No searches yet. Press Search now next to a client to run one here, or leave it on and it runs within about 15 minutes alongside Keep searching.</p>'}`, `<a class="btn" href="#found?via=credit">See what it found</a>`);
  const rows = clients.map(cl => {
    const c = cfg.clients[cl.name] || {}, on = c.on !== false;
    const words = PP_WATCH.wordsFor(cfg, cl.name);
    const lastAt = Math.max(0, ...words.map(w => s.done[cl.name + '\n' + w] || 0));
    return `<tr><td>${sSwitch(`data-act="creditcl" data-v="${esc(cl.name)}"`, on, 'Search credits for ' + cl.name)}</td><td><b>${esc(cl.name)}</b>${cl.priority ? ' <span class="tag blue">★</span>' : ''}<div class="faint" style="font-size:12px">${lastAt ? 'Last searched ' + esc(shortDate(new Date(lastAt).toISOString())) : 'Not searched yet'}</div></td>
      <td style="min-width:0;width:55%"><input class="sinput" style="width:100%" data-act="creditwords" data-v="${esc(cl.name)}" value="${esc((c.words && c.words.length ? c.words : PP_WATCH.DEFAULT_WORDS).join(', '))}" aria-label="Wordings for ${esc(cl.name)}"></td>
      <td><button class="btn sm" data-act="creditnow" data-v="${esc(cl.name)}"${on ? '' : ' disabled data-why="Turn this client on first."'}>Search now</button></td></tr>`;
  }).join('');
  const table = ntCard('Clients and their credit lines', `<p class="muted" style="margin:0;font-size:13.5px">Wordings are separated by commas. Quotes keep the words together. {name} is the client's name. Change them to how your clients are really credited, for example "Harbor Times/Agency".</p>
    <div style="overflow-x:auto"><table class="ntt">${rows || '<tr><td class="muted">No clients are being searched yet.</td></tr>'}</table></div>`);
  const nm = s.nomatch.slice().reverse().slice(0, 60);
  const nomatch = ntCard('Pages that credit a client but show none of their photos', `<p class="muted" style="margin:0;font-size:13.5px">The page names your client, but PageProof found none of that client's photos on it. It may be a licensed use, a photo not in Google Drive, or a picture PageProof couldn't download. Worth a quick look.</p>
    ${nm.length ? `<div style="overflow-x:auto"><table class="ntt">${nm.map(n => `<tr><td style="min-width:0"><a href="${safeUrl(n.url)}" target="_blank" rel="noreferrer"><b>${esc(n.title || n.url)}</b></a><div class="mono faint" style="font-size:12px;overflow-wrap:anywhere">${esc(n.url)}</div></td><td>${esc(n.client)}<div class="faint" style="font-size:12px">${esc(n.words)}</div></td><td>${esc(shortDate(n.at))}</td><td><button class="btn ghost sm" data-act="creditdrop" data-v="${esc(n.url)}">Take off the list</button></td></tr>`).join('')}</table></div>` : '<p class="faint" style="margin:0">Nothing here yet.</p>'}`);
  const run = PP_WATCH.live() || await PP_WATCH.runInfo();
  const showRun = run && (!run.end || Date.now() - run.end < 30 * 60000);
  if (showRun && !run.end) ntRunWatch();
  return hd + `<div id="creditrun">${showRun ? ntRunCard(run) : ''}</div>` + (await ntKeepNote()) + status + table + nomatch;
};
Object.assign(ACTS, {
  crediton: async (v, el) => { const c = await PP_WATCH.creditCfg(); c.on = !!el.checked; await PP_WATCH.setCreditCfg(c); toast(c.on ? 'Credit search is on.' : 'Credit search is off.'); render(true); },
  creditcl: async (v, el) => { const c = await PP_WATCH.creditCfg(); c.clients[v] = { ...(c.clients[v] || {}), on: !!el.checked }; await PP_WATCH.setCreditCfg(c); render(true); },
  creditwords: async (v, el) => {
    const c = await PP_WATCH.creditCfg();
    // Split on commas that are not inside quotes.
    const words = (String(el.value || '').match(/"[^"]*"|[^,]+/g) || []).map(x => x.trim()).filter(Boolean);
    c.clients[v] = { ...(c.clients[v] || {}), words: words.join(',') === PP_WATCH.DEFAULT_WORDS.join(',') ? [] : words };
    await PP_WATCH.setCreditCfg(c); toast('Saved the wordings for ' + v + '.');
  },
  creditnow: async v => {
    if (await PP_WATCH.runActive() || (PP_WATCH.live() && !PP_WATCH.live().end)) { toast('A credit search is already running. Its progress is at the top of this page.'); return; }
    const p = PP_WATCH.creditRun(v);
    setTimeout(() => { render(true); ntRunWatch(); window.scrollTo({ top: 0, behavior: 'smooth' }); }, 150);
    await p; render(true);
  },
  creditdrop: async v => { const s = await PP_WATCH.creditState(); s.nomatch = s.nomatch.filter(n => n.url !== v); await FC.meta.set('creditState', s); render(true); },
});

// ================================================================ Extra searches: progress and "is it worth it?"
// (Ben, 2026-11-25: "We need stats for almost everything".) Sweeps, Credit search and Watching each
// count what they did and how long it took, in PP_STATS (numbers only). The same numbers show on
// Keep searching (last 7 days) and on Settings › How PageProof is doing (Today / 7 / 30 days).
function ntExtraRows(D) {
  const c = k => (D && D.c && D.c[k]) || 0, mins = k => Math.round(((D && D.t && D.t[k] && D.t[k].s) || 0) / 60000);
  const per = (m, n) => n ? (m / n < 1 ? 'under 1 min' : '~' + Math.round(m / n).toLocaleString() + ' min') + ' a copy' : 'no copies yet';
  return [
    { k: 'sweep', name: 'Sweeps of stolen sites', work: `${c('sweep.pic').toLocaleString()} pictures checked · ${c('sweep.page').toLocaleString()} pages · ${c('sweep.map').toLocaleString()} sitemaps`, found: c('sweep.found'), mins: mins('sweep.step'), runs: c('sweep.done') },
    { k: 'credit', name: 'Credit search', work: `${c('credit.search').toLocaleString()} searches (Google ${c('credit.search.google').toLocaleString()}, Bing ${c('credit.search.bing').toLocaleString()}) · links Google ${c('credit.links.google').toLocaleString()}, Bing ${c('credit.links.bing').toLocaleString()}, both ${c('credit.links.both').toLocaleString()} · ${c('credit.page').toLocaleString()} pages read · ${c('credit.none').toLocaleString()} credit but no photo${c('credit.known') ? ' · ' + c('credit.known').toLocaleString() + ' already known' : ''}${c('credit.robot') ? ' · robot checks: Google ' + c('credit.robot.google') + ', Bing ' + c('credit.robot.bing') : ''}`, found: c('credit.found'), mins: mins('credit.step'), runs: c('credit.search') },
    { k: 'watch', name: 'Watching', work: `${c('watch.check').toLocaleString()} checks · ${c('watch.post').toLocaleString()} new posts · ${c('watch.pic').toLocaleString()} pictures${c('watch.wall') ? ' · ' + c('watch.wall') + ' asked to log in' : ''}`, found: c('watch.found'), mins: mins('watch.step'), runs: c('watch.check') },
  ].map(r => ({ ...r, worth: per(r.mins, r.found) }));
}
async function ntStatsDays(n) {
  try {
    const all = await PP_STATS.all(), out = [];
    for (let i = 0; i < n; i++) { const d = new Date(Date.now() - i * 864e5); out.push(all.days[PP_STATS.dayKey(d)]); }
    return PP_STATS.sum(out);
  } catch (e) { return { c: {}, t: {} }; }
}
// The card on Keep searching: what each one is doing now, and its last 7 days.
async function ntKeepExtras() {
  let sweepNow = 'Nothing to sweep right now. A sweep starts when you say yes to sweeping a site with a Stolen copy.', creditNow = '', watchNow = '';
  try {
    const sw = Object.values(await FC_RULES.sweeps());
    const run = sw.find(x => x.state === 'running'), q = sw.filter(x => x.state === 'queued').length;
    if (run) sweepNow = `<b>Sweeping ${esc(run.base)}</b> for more of ${esc(run.client)}'s photos: ${(run.checked || 0).toLocaleString()} pictures checked${run.found ? ', ' + plural(run.found, 'match', 'matches') + ' so far' : ''}.${q ? ' ' + q + ' more waiting.' : ''}`;
    else if (q) sweepNow = `${plural(q, 'sweep')} waiting to start.`;
  } catch (e) { /* none */ }
  try {
    const cfg = await PP_WATCH.creditCfg(), st = await PP_WATCH.creditState(), live = PP_WATCH.live() || await PP_WATCH.runInfo();
    const last = st.log[st.log.length - 1];
    if (live && !live.end) creditNow = `<b>Searching ${esc(live.client)}'s credit lines</b> on the Credit search page: ${live.wDone} of ${live.words} wordings, ${live.read} of ${live.pages} pages read.`;
    else if (!cfg.on) creditNow = 'Off. Turn it on from the Credit search page.';
    else creditNow = (st.queue.length ? `<b>${plural(st.queue.length, 'credited page')} waiting to be read.</b> ` : '') + (last ? `Last search ${esc(shortDate(last.at))}: ${esc(last.client)}, <span class="mono">${esc(last.words)}</span> (${last.per ? esc(ntPer(last.per)) : plural(last.links, 'page') + ' listed'}).` : 'No searches yet.') + ` One wording on Google and Bing every ${cfg.every} minutes at most.`;
  } catch (e) { /* none */ }
  try {
    const items = (await PP_WATCH.watchList()).filter(x => !x.off);
    const busy = items.find(x => x.pend && x.pend.length);
    const lastAt = Math.max(0, ...items.map(x => Date.parse(x.last || 0) || 0));
    watchNow = !items.length ? 'Nothing watched yet. Sites and accounts with 2 or more Stolen copies are added by themselves.'
      : busy ? `<b>Checking ${esc(busy.label)}</b>: ${plural(busy.pend.length, 'new post')} left to look at.`
      : `${plural(items.length, 'site or account', 'sites and accounts')} watched, each checked once a week.${lastAt ? ' Last check ' + esc(shortDate(new Date(lastAt).toISOString())) + '.' : ''}`;
  } catch (e) { /* none */ }
  const now = { sweep: sweepNow, credit: creditNow, watch: watchNow }, link = { sweep: '#found', credit: '#credit', watch: '#watching' };
  const rows = ntExtraRows(await ntStatsDays(7));
  return `<section class="card pad" style="display:flex;flex-direction:column;gap:12px">
    <div class="row" style="gap:10px"><h2 style="margin:0">Extra searches</h2><span class="faint" style="margin-left:auto;font-size:13px">They run between photo searches, one small step at a time</span></div>
    <div style="overflow-x:auto"><table class="ntt">
      <tr><th>Search</th><th>Right now</th><th>Last 7 days</th><th>Copies found</th><th>Time spent</th></tr>
      ${rows.map(r => `<tr><td><a href="${link[r.k]}"><b>${r.name}</b></a></td><td style="min-width:220px;font-size:13.5px">${now[r.k]}</td><td class="faint" style="font-size:12.5px;min-width:180px">${r.work}</td><td><b class="num">${r.found.toLocaleString()}</b></td><td class="num">${r.mins.toLocaleString()} min<div class="faint" style="font-size:12px">${r.worth}</div></td></tr>`).join('')}
    </table></div>
    <p class="faint" style="margin:0;font-size:12.5px">The same numbers for today, 7 days and 30 days are in <a href="#stats">How PageProof is doing</a>, and in the stats file you save for Claude.</p>
  </section>`;
}

// ================================================================ 2. Watching
V.watching = async () => {
  const list = await PP_WATCH.watchList();
  const hd = head('Copies found', 'Watching', 'A site or social account with 2 or more copies marked Stolen is watched. Once a week PageProof reads only its new posts and compares their pictures with every client\'s photos. Old Stolen pages are never opened again.');
  const add = `<section class="card pad row" style="gap:10px"><input id="watchIn" class="chip" style="min-height:40px;padding:0 12px;font-size:15px;flex:1 1 260px" placeholder="Watch another site or account, like example.com or an Instagram link" aria-label="Site or account to watch"><button class="btn primary" data-act="watchadd">＋ Watch it</button></section>`;
  const row = it => {
    const when = it.last ? 'Checked ' + shortDate(it.last) : 'Not checked yet';
    const busy = it.pend && it.pend.length;
    return `<tr class="${it.off ? 'off' : ''}"><td style="min-width:0"><b>${esc(it.label)}</b> <span class="tag grey">${it.kind === 'acct' ? esc(it.plat || 'Account') : 'Website'}</span>${it.by === 'hand' ? ' <span class="tag blue">Added by you</span>' : ''}${it.off ? ' <span class="tag grey">Not watching</span>' : ''}
        <div class="faint" style="font-size:12px">${it.stolen ? plural(it.stolen, 'copy', 'copies') + ' marked Stolen' : 'No Stolen copies yet'}${it.kind === 'site' && it.feed ? ' · reads ' + (it.feed === 'sitemap' ? 'its sitemap' : 'its news feed') : ''}</div></td>
      <td>${busy ? `<span class="tag blue">Checking ${plural(it.pend.length, 'post')}…</span>` : esc(when)}${it.err ? `<div class="faint" style="font-size:12px">${esc(it.err === 'asked to log in' ? 'The site asked to log in. Log in in this browser.' : 'No posts found last time.')}</div>` : ''}</td>
      <td>${it.newPosts != null ? plural(it.newPosts, 'new post') + ' last time' : ''}${it.found ? `<div><span class="tag bad">${plural(it.found, 'copy', 'copies')} found</span></div>` : ''}</td>
      <td class="row" style="gap:6px;justify-content:flex-end">${it.off ? `<button class="btn sm" data-act="watchon" data-v="${esc(it.key)}">Watch again</button>` : `<button class="btn sm" data-act="watchnow" data-v="${esc(it.key)}">Check now</button><button class="btn ghost sm" data-act="watchoff" data-v="${esc(it.key)}">Stop watching</button>`}${it.by === 'hand' ? `<button class="btn ghost sm" data-act="watchdrop" data-v="${esc(it.key)}">Remove</button>` : ''}</td></tr>`;
  };
  const on = list.filter(x => !x.off).length;
  return hd + (await ntKeepNote()) + add + ntCard(`${plural(on, 'site or account', 'sites and accounts')} watched`, list.length ? `<div style="overflow-x:auto"><table class="ntt">${list.map(row).join('')}</table></div>` : '<p class="muted" style="margin:0">Nothing yet. Sites and accounts join by themselves once 2 copies there are marked Stolen.</p>', '<a class="btn" href="#found?via=watch">See what it found</a>');
};
Object.assign(ACTS, {
  watchadd: async () => {
    const v = (document.getElementById('watchIn') || {}).value || '';
    const it = await PP_WATCH.watchAdd(v);
    if (!it) return toast('Type a site like example.com, or paste a link to a social account.');
    toast('Watching ' + it.label + '. Its new posts are checked within the hour while Keep searching is on.'); render(true);
  },
  watchnow: async v => { await PP_WATCH.watchNow(v); toast('Checking it next, in the Keep searching tab.'); render(true); },
  watchoff: async v => { await PP_WATCH.watchOff(v, true); toast('Stopped watching.', async () => { await PP_WATCH.watchOff(v, false); render(true); }); render(true); },
  watchon: async v => { await PP_WATCH.watchOff(v, false); render(true); },
  watchdrop: async v => { await PP_WATCH.watchDrop(v); render(true); },
});

// ================================================================ 3. Registrations
async function ntRegRows() {
  const copies = (await FC.allCopies()).filter(c => c.status !== 'removed');
  const by = new Map();
  for (const c of copies) { const e = by.get(c.photo) || { copies: 0, stolen: 0, last: '' }; e.copies++; if (c.status === 'stolen') e.stolen++; if ((c.firstSeen || '') > e.last) e.last = c.firstSeen || ''; by.set(c.photo, e); }
  const photos = (await FC.DB.getMany('photos', [...by.keys()])).filter(Boolean);
  const regs = (await FC.meta.get('regs')) || {};
  const seen = (await FC.meta.get('regSeen')) || {};
  let changed = false;
  const now = new Date().toISOString();
  const rows = photos.map(p => {
    const r = regSync(p, regs);
    const st = r && r.va ? 'va' : r && r.app ? 'app' : 'none';
    const was = seen[p.id];
    // Remember when a photo became registered, to show "Registered lately" for 30 days.
    if (!was || was.st !== st) { seen[p.id] = { st, at: was ? now : '', vaAt: st === 'va' && was && was.st !== 'va' ? now : (was && was.vaAt) || '' }; changed = true; }
    return { p, r, st, vaAt: seen[p.id].vaAt, ...by.get(p.id) };
  });
  if (changed) await FC.meta.set('regSeen', seen);
  return rows;
}
V.regs = async () => {
  const rows = await ntRegRows();
  const cut = Date.now() - 30 * 864e5;
  const tabs = { none: rows.filter(r => r.st === 'none'), app: rows.filter(r => r.st === 'app'), done: rows.filter(r => r.st === 'va' && r.vaAt && Date.parse(r.vaAt) > cut) };
  const show = (tabs[NT.regTab] || tabs.none).sort((a, b) => b.stolen - a.stolen || b.copies - a.copies || String(b.last).localeCompare(String(a.last)));
  const hd = head('Clients', 'Registrations', 'Photos that have copies found but no VA registration number yet: only an application number, or nothing at all. Stolen ones are at the top. When a VA number turns up in the photo\'s folder (folder name or Excel file), it moves to Registered lately by itself.',
    show.length && NT.regTab !== 'done' ? '<button class="btn primary" data-act="regcopy">Copy the list for the registrar</button>' : '');
  const seg = `<div class="seg" role="group" aria-label="Which photos">${[['none', 'Not registered'], ['app', 'Applied, no VA yet'], ['done', 'Registered lately']].map(([k, l]) => `<button class="${NT.regTab === k ? 'on' : ''}" aria-pressed="${NT.regTab === k}" data-act="regtab" data-v="${k}">${l} (${tabs[k].length})</button>`).join('')}</div>`;
  const groups = new Map();
  for (const r of show.slice(0, NT.regMore)) { const k = r.p.client || 'Client unknown'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
  const line = r => `<tr><td style="min-width:0"><b>${esc(r.p.name)}</b><div class="mono faint" style="font-size:12px;overflow-wrap:anywhere">${esc(r.p.folder || '')}</div></td>
    <td>${r.stolen ? `<span class="tag bad">${r.stolen} Stolen</span> ` : ''}<span class="tag grey">${plural(r.copies, 'copy', 'copies')}</span></td>
    <td>${r.st === 'va' ? `<span class="tag ok">${esc(r.r.va)} ✓</span>` : r.st === 'app' ? `<span class="tag warn">Applied ${esc(r.r.app)}</span>` : '<span class="tag grey">No number</span>'}</td>
    <td>${r.st === 'va' ? '' : `<input class="sinput" style="width:170px" placeholder="Add the number" data-act="regset" data-v="${esc(r.p.folder || '')}" aria-label="Registration number for this folder">`}</td>
    <td><a class="btn ghost sm" href="#found?photo=${encodeURIComponent(r.p.id)}">Copies</a></td></tr>`;
  const body = show.length ? [...groups].map(([cl, rs]) => `<section class="card pad" style="display:flex;flex-direction:column;gap:8px"><div class="row"><h2 style="margin:0">${esc(cl)}</h2><span class="tag grey" style="margin-left:auto">${plural(rs.length, 'photo')}</span></div><div style="overflow-x:auto"><table class="ntt">${rs.map(line).join('')}</table></div></section>`).join('')
    + (show.length > NT.regMore ? `<button class="btn" data-act="regmore">Show ${Math.min(200, show.length - NT.regMore)} more</button>` : '')
    : `<section class="card pad"><p class="muted" style="margin:0">${NT.regTab === 'done' ? 'No photo with copies got its VA number in the last 30 days.' : 'Nothing here: every photo with copies found has a number.'}</p></section>`;
  return `${hd}<div class="row" style="margin-bottom:4px">${seg}</div>
  <p class="faint" style="margin:0;font-size:12.5px">A number typed here sticks for the whole folder, like "Add the number" in a copy's Claim tab.</p>${body}`;
};
Object.assign(ACTS, {
  regtab: v => { NT.regTab = v; NT.regMore = 200; render(true); },
  regmore: () => { NT.regMore += 200; render(true); },
  regset: async (v, el) => {
    if (!v) return toast('This photo has no folder, so the number can\'t be saved for it.');
    if (!(await FC.setReg(v, el.value || ''))) return toast('That doesn\'t look like a VA number or a 1-… application number.');
    toast('Saved for the whole folder.'); render(true);
  },
  regcopy: async () => {
    const rows = (await ntRegRows()).filter(r => r.st === (NT.regTab === 'app' ? 'app' : 'none')).sort((a, b) => b.stolen - a.stolen || b.copies - a.copies);
    const text = ['Client\tPhoto\tFolder\tCopies found\tStolen\tApplication number', ...rows.map(r => [r.p.client || '', r.p.name, r.p.folder || '', r.copies, r.stolen, (r.r && r.r.app) || ''].join('\t'))].join('\n');
    ntCopy(text, plural(rows.length, 'photo') + ' copied. Paste it into an email or a spreadsheet');
  },
});


// ================================================================ 5. Find the company (Ben's way)
// Names it goes by → brand to company → is it active. The firm only pursues companies that are
// actively registered, so every site gets the firm's own status words, the same ones the firm's
// system uses: Seemingly viable, Not a viable entity, Not checked yet.
const ENT_STATUS = ['Seemingly viable', 'Not a viable entity', 'Not checked yet'];
const ENT_TYPES = ['Company name', 'Seller name (DBA)', 'Individual'];
const ENT_REG = ['Active', 'Inactive', 'Not found'];
const ENT_DMCA = ['Unknown', 'Yes', 'No', 'Not applicable'];
const US_STATES = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Puerto Rico', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming', 'Outside the U.S.'];
const IS_CO = /\b(LLC|L\.L\.C\.|Inc\.?|Incorporated|Ltd\.?|Limited|Corp\.?|Corporation|Co\.|LLP|PLLC|PLC|LP|L\.P\.|GmbH)$/i;
let PP_ENTS = {};
const entsLoad = () => FC.meta.get('entities').then(e => { PP_ENTS = e || {}; }).catch(() => {});
entsLoad();
async function entSet(base, patch) {
  const all = (await FC.meta.get('entities')) || {};
  const e = { status: 'Not checked yet', ...(all[base] || {}), ...patch, checked: new Date().toISOString() };
  try { e.by = (typeof getName === 'function' ? await getName() : '') || e.by || ''; } catch (x) { /* no name */ }
  all[base] = e; PP_ENTS = all;
  await FC.meta.set('entities', all); FC.touch('entities');
  if (typeof FC.backupSoon === 'function') FC.backupSoon();
  return e;
}
const entOf = site => PP_ENTS[FC.baseOf(site || '')] || null;
const entSoc = c => typeof PP_SOCIAL !== 'undefined' && PP_SOCIAL.isSocial(c.site);
// Copies found: the row tags, the order, and the Ready for legal line.
function ppRowTags(c) {
  let h = '';
  if (c.via === 'credit') h += '<span class="tag blue" title="Found because the page prints your client\'s photo credit (Credit search)">Found by credit search</span>';
  if (c.via === 'watch') h += '<span class="tag blue" title="A new post on a site or account you marked Stolen before (Watching)">Found by the watch list</span>';
  const e = !entSoc(c) && entOf(c.site);
  if (e && e.status === 'Seemingly viable') h += `<span class="tag ok" title="${esc(e.entity || 'The company')} is actively registered${e.state ? ' in ' + esc(e.state) : ''}">✓ Seemingly viable</span>`;
  if (e && e.status === 'Not a viable entity') h += '<span class="tag bad" title="No actively registered company was found behind this site">Not a viable entity</span>';
  return h;
}
const ppEntLow = c => !entSoc(c) && (entOf(c.site) || {}).status === 'Not a viable entity';
function ppEntLegal(c) {
  if (entSoc(c)) return null;
  const e = entOf(c.site) || {};
  if (e.status === 'Seemingly viable') return [true, 'Company found and active' + (e.entity ? ' (' + e.entity + (e.state ? ', ' + e.state : '') + ')' : ''), ''];
  if (e.status === 'Not a viable entity') return [false, 'Not a viable entity: no actively registered company found', 'who'];
  return [false, 'Company behind the site not found yet', 'who'];
}

// 5a: every name the site goes by, where it came from, brand or company.
function ntNames(f, base) {
  const src = n => (f.nameFrom || {})[n] || ((f.clues || []).find(c => String(c.value).includes(n)) || {}).src || (n === f.registrant ? 'Domain records' : n === f.fbCompany ? 'Facebook Page transparency' : 'The site');
  const names = [...new Set([...(f.names || []), f.fbCompany, f.siteName].filter(Boolean))].slice(0, 12);
  const enc = encodeURIComponent;
  const rows = names.map(n => {
    const co = IS_CO.test(n.trim());
    return `<tr><td style="min-width:0"><b>${esc(n)}</b> <span class="tag ${co ? 'ok' : 'grey'}">${co ? 'company' : 'brand or DBA'}</span><div class="faint" style="font-size:12px">From: ${esc(n === f.siteName && !(f.names || []).includes(n) ? 'The site\'s own name' : src(n))}</div></td>
      <td class="row" style="gap:6px;justify-content:flex-end;flex-wrap:wrap">${co ? '' : `<a class="btn ghost sm" target="_blank" rel="noreferrer" href="https://tmsearch.uspto.gov/search/search-results?query=${enc(n)}">USPTO ↗</a>`}<a class="btn ghost sm" target="_blank" rel="noreferrer" href="https://opencorporates.com/companies?q=${enc(n)}">OpenCorporates ↗</a><button class="btn sm" data-act="entuse" data-v="${esc(base)}|${esc(n)}|${co ? 'Company name' : 'Seller name (DBA)'}">Use this name</button></td></tr>`;
  }).join('');
  const fb = (f.social || []).find(u => /facebook\.com/i.test(u));
  return `<section class="card pad" style="display:flex;flex-direction:column;gap:10px" id="whoNames"><div class="row"><h2 style="margin:0">Step 1 · Names it goes by</h2><span class="tag blue" style="margin-left:auto">${plural(names.length, 'name')}</span></div>
    <p class="muted" style="margin:0;font-size:13.5px">Read for you from the footer, Terms, Privacy, About and Contact pages, the site's own data and the domain record. A brand or DBA is not a company yet: search it in OpenCorporates and the USPTO until a registered company turns up.</p>
    ${rows ? `<div style="overflow-x:auto"><table class="ntt">${rows}</table></div>` : '<p class="faint" style="margin:0">No name found on the site itself. Try the social pages and Google below.</p>'}
    <div class="row" style="gap:8px;flex-wrap:wrap">${fb ? `<button class="btn" data-act="whofb" data-v="${esc(base)}|${esc(fb)}"${NT.fbBusy ? ' disabled' : ''}>${NT.fbBusy ? 'Reading their Facebook page…' : 'Read their Facebook Page transparency'}</button>` : ''}<input class="sinput" style="flex:1 1 220px" placeholder="Found another name? Type it and press Enter" data-act="whoaddname" data-v="${esc(base)}" aria-label="Add a name"></div>
    ${fb ? '<span class="faint" style="font-size:12px">Opens their Facebook page in a quiet tab of your own browser (you need to be logged in to Facebook).</span>' : ''}</section>`;
}
// 5b: the checklist, in three steps. Old ticks keep their keys.
async function ntResearch(w, f, base, name, q) {
  const enc = encodeURIComponent, e = PP_ENTS[base] || {};
  const ent = e.entity || q;
  const fb = (f.social || []).find(u => /facebook\.com/i.test(u));
  const g = t => 'https://www.google.com/search?q=' + enc(t);
  const stages = [
    ['Step 1 · Names it goes by', [
      ['pages', 'Footer, Terms, Privacy and About pages', 'Who runs the site, an address, "operated by…"', 'https://' + base],
      ['owners', 'Already known?', 'Site owners and other sites you checked with the same names', '#owners'],
      ['social', 'Their social media pages', 'A location, an owner, a company in the bio', fb || g('"' + q + '" facebook OR instagram OR linkedin')],
      ['fbt', 'Facebook Page transparency', 'Facebook often names the page owner company here', fb ? fb.replace(/\/+$/, '') + '/about_profile_transparency' : g('"' + q + '" facebook')],
      ['google', 'Google, "exact phrase"', 'Owners, editors, emails', g('"' + base + '" owner OR "owned by" OR "operated by"' + (f.emails && f.emails[0] ? ' OR "' + f.emails[0] + '"' : ''))],
      ['linkedin', 'LinkedIn', 'People who work there', 'https://www.linkedin.com/search/results/companies/?keywords=' + enc(q)],
      ['whois', 'Who registered the domain', 'whois.com and the official ICANN record', 'https://www.whois.com/whois/' + enc(base)],
      ['archive', 'Old pages on archive.org', 'Addresses and names the site has since removed', 'https://web.archive.org/web/*/' + enc(base) + '/*contact*'],
    ]],
    ['Step 2 · Brand to company', [
      ['justia', 'Trademark search (Justia)', 'Often shows the owner company, its address and state', 'https://trademarks.justia.com/search?q=' + enc(q)],
      ['uspto', 'USPTO trademarks', 'The owner line names the real company behind a brand', 'https://tmsearch.uspto.gov/search/search-results?query=' + enc(f.siteName || name || base.split('.')[0])],
      ['opencorp', 'OpenCorporates', 'Companies registered with this name or DBA', 'https://opencorporates.com/companies?q=' + enc(ent)],
      ['sec', 'SEC EDGAR', 'When it looks like a real, bigger business', 'https://www.sec.gov/cgi-bin/browse-edgar?company=' + enc(ent) + '&owner=include&action=getcompany'],
      ['muck', 'Muck Rack', 'For the article\'s author', 'https://muckrack.com/'],
    ]],
    ['Step 3 · Is it active? (once you know the company\'s name)', [
      ['state', 'State business search' + (e.state && e.state !== 'Outside the U.S.' ? ' (' + e.state + ')' : ''), 'Active or not, the entity number and the registered agent', g('"' + ent + '" ' + (e.state && e.state !== 'Outside the U.S.' ? e.state + ' ' : '') + 'secretary of state business entity search')],
      ['courts', 'Past lawsuits', 'Court records that name the company', 'https://www.courtlistener.com/?q=' + enc('"' + ent + '"')],
      ['dmca', 'DMCA designated agent directory', 'Is the site registered for safe harbor?', 'https://dmca.copyright.gov/osp/'],
      ['delaware', 'Delaware business search (always last)', 'Many companies are formed in Delaware', 'https://icis.corp.delaware.gov/ecorp/entitysearch/namesearch.aspx'],
    ]],
  ];
  const ticks = ((await FC.meta.get('research')) || {})[base] || [];
  const all = stages.flatMap(s => s[1]), done = all.filter(x => ticks.includes(x[0])).length;
  return `<section class="card pad" style="display:flex;flex-direction:column;gap:8px"><div class="row"><h2>Research steps</h2><span class="tag ${done === all.length ? 'ok' : 'blue'}" style="margin-left:auto">${done} of ${all.length} done</span></div>
    <p class="muted" style="margin:0;font-size:13.5px">Try every channel before choosing the company. Tick each one when it's done. Ticks are saved for ${esc(base)}.</p>
    ${stages.map(([t, steps]) => `<div class="dsh" style="margin-top:6px">${esc(t)}</div>${steps.map(([k, tt, d, u]) => `<div class="rstep${ticks.includes(k) ? ' done' : ''}"><input type="checkbox" id="rs-${k}" data-act="rstep" data-v="${esc(base)}|${k}" ${ticks.includes(k) ? 'checked' : ''} aria-label="${esc(tt)} done"><label for="rs-${k}"><b>${esc(tt)}</b><span class="muted">${esc(d)}</span></label><a class="btn ghost sm" href="${u.startsWith('#') ? esc(u) : safeUrl(u)}"${u.startsWith('#') ? '' : ' target="_blank" rel="noreferrer"'}>Open${u.startsWith('#') ? '' : ' ↗'}</a></div>`).join('')}`).join('')}
  </section>`;
}
// 5c: the company card, with the firm's own fields.
async function ntEntityCard(base, f) {
  const e = { status: 'Not checked yet', nameType: 'Company name', regStatus: '', dmca: 'Unknown', ...(PP_ENTS[base] || {}) };
  const inp = (k, label, ph) => `<label class="efld"><span>${label}</span><input class="sinput" data-act="entset" data-v="${esc(base)}|${k}" value="${esc(e[k] || '')}" placeholder="${esc(ph || '')}"></label>`;
  const sel = (k, label, opts) => `<label class="efld"><span>${label}</span><select class="sinput" data-act="entset" data-v="${esc(base)}|${k}"><option value="">Pick one…</option>${opts.map(o => `<option${e[k] === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
  const tone = { 'Seemingly viable': 'ok', 'Not a viable entity': 'bad', 'Not checked yet': 'grey' };
  const n = (await FC.allCopies()).filter(c => c.status !== 'removed' && FC.baseOf(c.site) === base).length;
  return `<section class="card pad" style="display:flex;flex-direction:column;gap:12px" id="entCard"><div class="row" style="flex-wrap:wrap;gap:8px"><h2 style="margin:0">The company behind ${esc(base)}</h2><span class="tag ${tone[e.status]}" style="margin-left:auto">${esc(e.status)}</span></div>
    <p class="muted" style="margin:0;font-size:13.5px">Fill this in as you find it. The status shows on ${plural(n, 'copy', 'copies')} from this site, and Ready for legal needs "Seemingly viable". Copies on a site that is "Not a viable entity" go to the bottom of Copies found.</p>
    <div class="efields">${sel('nameType', 'Entity name type', ENT_TYPES)}${inp('entity', 'Entity name', 'Example Media LLC')}${inp('other', 'Other names (DBA)', 'Brands it trades as')}${sel('state', 'State of incorporation', US_STATES)}${inp('number', 'Entity number', 'From the state registry')}${sel('regStatus', 'State registry says', ENT_REG)}${inp('agent', 'Registered agent', '')}${inp('phys', 'Physical address', '')}${inp('svc', 'Service address', '')}${sel('dmca', 'DMCA agent registered', ENT_DMCA)}</div>
    <div class="row" style="gap:8px;flex-wrap:wrap"><b style="font-size:13.5px">Infringer status:</b>${ENT_STATUS.map(s => `<button class="btn sm${e.status === s ? ' primary' : ''}" aria-pressed="${e.status === s}" data-act="entstatus" data-v="${esc(base)}|${esc(s)}">${esc(s)}</button>`).join('')}</div>
    ${e.regStatus === 'Active' && e.status !== 'Seemingly viable' ? '<div class="banner info" style="padding:10px 12px"><span>The state registry says Active. If everything else checks out, mark it Seemingly viable.</span></div>' : ''}
    ${(e.regStatus === 'Inactive' || e.regStatus === 'Not found') && e.status === 'Seemingly viable' ? '<div class="banner warn" style="padding:10px 12px"><span>The state registry doesn\'t show an active company, but the status says Seemingly viable. Check it again.</span></div>' : ''}
    <div class="row" style="gap:8px;flex-wrap:wrap"><input class="sinput" id="regUrl" style="flex:1 1 260px" placeholder="Paste the state registry page's address to capture it as evidence" aria-label="State registry page address"><button class="btn" data-act="entcap">${ic('capture', 16)} Capture the registry page</button></div>
    <span class="faint" style="font-size:12px">${e.checked ? 'Last changed ' + esc(fmtDate(e.checked)) + (e.by ? ' by ' + esc(e.by) : '') + '. ' : ''}If the registry page has no address of its own (a search result), open it and press PageProof's Capture button on it instead.</span></section>`;
}
Object.assign(ACTS, {
  entset: async (v, el) => { const i = v.indexOf('|'); await entSet(v.slice(0, i), { [v.slice(i + 1)]: String(el.value || '').trim() }); render(true); },
  entstatus: async v => { const i = v.indexOf('|'); const e = await entSet(v.slice(0, i), { status: v.slice(i + 1) }); toast(v.slice(0, i) + ': ' + e.status + '.'); if (typeof dropFC === 'function') dropFC(); render(true); },
  entuse: async v => { const [base, n, t] = v.split('|'); await entSet(base, { entity: n, nameType: t }); toast('"' + n + '" is now the entity name. Check it in the state registry.'); render(true); const c = document.getElementById('entCard'); if (c) c.scrollIntoView({ block: 'start', behavior: 'smooth' }); },
  entcap: async () => {
    const u = ((document.getElementById('regUrl') || {}).value || '').trim();
    if (!/^https?:\/\//i.test(u)) return toast('Paste the registry page\'s address first (it starts with https://).');
    await api.runtime.sendMessage({ type: 'captureUrl', url: u }).catch(() => {});
    toast('Opening the registry page to capture it…');
  },
  whoaddname: async (v, el) => {
    const n = String(el.value || '').trim(); if (n.length < 2) return;
    const f = await FC.facts(v) || await FC.facts(state.who && state.who.site);
    if (!f) return toast('Read the site first.');
    f.names = [...new Set([...(f.names || []), n])]; (f.nameFrom = f.nameFrom || {})[n] = 'Added by you';
    await FC.DB.put('sites', f); render(true);
  },
  whofb: async v => {
    const i = v.indexOf('|'), base = v.slice(0, i), url = v.slice(i + 1);
    if (typeof PP_SOCIAL === 'undefined' || !PP_SOCIAL.readProfile) return;
    const acct = PP_SOCIAL.fromUrl(url); if (!acct) return toast('That Facebook link could not be read.');
    NT.fbBusy = true; render(true);
    try {
      PP_SOCIAL.halt.on = false;
      const pages = await PP_SOCIAL.readProfile(acct);
      const pf = PP_SOCIAL.profileFacts(acct, pages);
      const site = state.who && state.who.site;
      const f = (site && await FC.facts(site)) || await FC.facts(base);
      if (f && pf && pf.company) { f.fbCompany = pf.company; f.names = [...new Set([...(f.names || []), pf.company])]; (f.nameFrom = f.nameFrom || {})[pf.company] = 'Facebook Page transparency'; await FC.DB.put('sites', f); toast('Facebook says the page owner is ' + pf.company + '.'); }
      else toast(pf && pf.ok ? 'Facebook doesn\'t name a page owner for this page.' : 'Facebook didn\'t show the page. Log in to Facebook in this browser, then try again.');
    } catch (e) { toast('Facebook could not be read.'); }
    NT.fbBusy = false; render(true);
  },
});
