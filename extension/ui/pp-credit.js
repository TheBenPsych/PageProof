// Copies found › Credit search in the calm look (design batch 8). Three tabs: Overview (the live
// search, the search sites, four tiles, the last searches, wordings that find copies), Clients
// (every client with its wordings, a panel per client) and Credit but no photo.
// The searching itself is PP_WATCH in fc-watch.js; this file only shows it and saves the settings.
const CREDIT_TABS = ['overview', 'clients', 'nophoto'];
const CR = { cf: 'all', sort: 'pri', q: '', nq: '', ncl: '', nsort: 'new', usualEdit: false, barOff: false, how: false, allLog: false };
const CRI = (() => {
  const s = (p, z = 16) => `<svg viewBox="0 0 16 16" width="${z}" height="${z}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  return {
    page: s('<path d="M4 1.8h5.5L12.5 5v9.2H4z"/><path d="M9.5 1.8V5h3M6 8h4.5M6 10.5h4.5"/>'),
    queue: s('<path d="M2.5 4h11M2.5 8h11M2.5 12h7"/><circle cx="13" cy="12" r="1.2"/>'),
    stop: s('<rect x="4" y="4" width="8" height="8" rx="1"/>'),
    play: s('<path d="M5 3.2v9.6L12.6 8z"/>'),
    ext: s('<path d="M9 2.5h4.5V7M13.5 2.5 7.5 8.5M12 9.5V13a.5.5 0 0 1-.5.5h-8.5a.5.5 0 0 1-.5-.5V4.5a.5.5 0 0 1 .5-.5H7"/>'),
    x: s('<path d="M4 4l8 8M12 4l-8 8"/>', 14),
    plus: s('<path d="M8 3v10M3 8h10"/>'),
    edit: s('<path d="M10.5 2.5l3 3L6 13H3v-3z"/>'),
    look: s('<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><circle cx="7" cy="8" r="2.5"/><path d="m9 10 2 2"/>'),
    check: s('<path d="m3 8.5 3.2 3L13 4.5"/>'),
    bulb: s('<path d="M6 12.5h4M6.5 14.5h3M8 1.8a4.2 4.2 0 0 0-2.4 7.7c.5.4.9 1 .9 1.6v.4h3v-.4c0-.6.4-1.2.9-1.6A4.2 4.2 0 0 0 8 1.8z"/>'),
  };
})();
const crAgo = t => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; const h = Math.round(m / 60); if (h < 24) return h + ' h ago'; const d = Math.round(h / 24); return d === 1 ? 'Yesterday' : d + ' days ago'; };
const crWhen = iso => { const d = new Date(iso), t = new Date(), tm = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); if (d.toDateString() === t.toDateString()) return 'Today ' + tm; if (d.toDateString() === new Date(t - 864e5).toDateString()) return 'Yesterday ' + tm; return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + tm; };
const crUnq = w => String(w).replace(/^"|"$/g, '');
const crChip = (w, own) => `<span class="cwc${own ? ' own' : ''}" title="${esc(crUnq(w))}">${esc(crUnq(w))}</span>`;
const crHost = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return String(u); } };
const crAvBig = name => kAv(name).replace('class="kav"', 'class="kav big"');

// The live card: a search that is running (ring, two steps, the page in hand, Stop), or the one
// that just finished.
function crRunCard(r) {
  if (!r) return '';
  const done = r.phase === 'done' || !!r.end;
  const total = (r.words || 0) + Math.max(r.pages || 0, r.read || 0), at = (r.wDone || 0) + (r.read || 0);
  const per = r.per || {}, lst = PP_WATCH.ENGINES.map(e => PP_WATCH.ENG_NAME[e] + ' listed ' + (per[e] || 0)).join(', ');
  const boxes = (a, b) => `<div class="cbox ok"><b class="num">${r.found || 0}</b><span>${a}</span></div><div class="cbox"><b class="num">${r.nomatch || 0}</b><span>${b}</span></div>`;
  if (!done) {
    const f = total ? at / total : 0, pct = Math.max(3, Math.round(f * 100));
    const s1 = r.phase !== 'search', stopping = !!r.stop;
    return `<section class="card crun" id="creditLive" aria-label="Searching now">
      <div class="crl">${kRing2(f, 150, 12, pct + '%', pct + '% done')}</div>
      <div class="crm">
        <span class="klive"><span class="kpulse2"></span>${stopping ? 'Stopping…' : 'Searching now'} · started ${crAgo(r.start)}</span>
        <h2 class="crh">${crAvBig(r.client)}<span>Searching ${esc(r.client)}'s credit lines</span></h2>
        <div class="crss">
          <div class="crs ${s1 ? 'done' : 'now'}">${kSq(s1 ? KC.green : KC.blue, s1 ? CRI.check : KI.search, 28)}<span class="kn1"><b>Ask Google and Bing</b><span>${r.wDone || 0} of ${r.words || 0} wordings searched · ${esc(lst)}${r.both ? ', ' + r.both + ' by both' : ''}</span></span></div>
          <div class="crs ${s1 ? 'now' : ''}">${kSq(s1 ? KC.blue : KC.grey, CRI.page, 28)}<span class="kn1"><b>Read the credited pages</b><span>${r.read || 0} of ${r.pages || 0} new pages read · pages read before are skipped</span></span></div>
        </div>
        ${r.now ? `<div class="cnow">${s1 ? CRI.page : KI.search}<span class="mono">${esc(r.now)}</span></div>` : ''}
      </div>
      <div class="crr">${boxes('Copies found', 'Credit but no photo')}
        <div class="crb"><button class="btn kbtn" data-act="creditstop"${stopping ? ' disabled' : ''} title="Finish the page in hand, then stop. Pages not read yet are read later.">${CRI.stop}${stopping ? 'Stopping…' : 'Stop'}</button></div></div>
      <p class="kfoot cfootl">You can use other pages while this runs. Keep this PageProof tab open.</p></section>`;
  }
  const mins = Math.max(1, Math.round(((r.end || Date.now()) - r.start) / 60000));
  const note = r.why === 'robot' ? 'Google and Bing both asked for a robot check, so this stopped. They rest for an hour. PageProof never tries to get past one.'
    : r.why === 'stopped' ? 'You stopped this search.' + (r.left ? ' ' + plural(r.left, 'page') + ' it had listed ' + (r.left === 1 ? 'is' : 'are') + ' read later, with the weekly searches.' : '')
    : r.why ? 'Something went wrong: ' + r.why + '.'
    : r.robotOne ? 'One search site asked for a robot check and rests for an hour. The other carried on.' : '';
  const stopped = r.why === 'stopped';
  return `<section class="card crun done" id="creditLive" aria-label="Search finished">
    <div class="crl">${kRing2(1, 150, 12, stopped ? '■' : '✓', stopped ? 'Stopped' : 'Finished')}</div>
    <div class="crm">
      <span class="klive ok">${stopped ? 'Stopped' : 'Finished'} ${crAgo(r.end || Date.now())} · took about ${plural(mins, 'minute')}</span>
      <h2 class="crh">${crAvBig(r.client)}<span>Search for ${esc(r.client)} ${stopped ? 'stopped' : 'finished'}</span></h2>
      <div class="kchips cchips">${PP_WATCH.ENGINES.map(e => `<span class="kchip"><span class="keng ${e[0]}">${e[0].toUpperCase()}</span>${PP_WATCH.ENG_NAME[e]} listed ${per[e] || 0}</span>`).join('')}
        <span class="kchip pl">${r.wDone || 0} of ${r.words || 0} wordings</span>${r.both ? `<span class="kchip pl">${r.both} found by both (read once)</span>` : ''}<span class="kchip pl">${r.read || 0} of ${r.pages || 0} new pages read</span>${r.known ? `<span class="kchip pl">${r.known} already in Copies found</span>` : ''}${r.failed ? `<span class="kchip pl">${r.failed} would not open</span>` : ''}</div>
      ${note ? `<p class="kmuted">${esc(note)}</p>` : ''}
    </div>
    <div class="crr">${boxes('New copies found', 'Credit but no photo')}
      <div class="crb">${r.found ? `<a class="btn primary kbtn" href="#found?via=credit">${KI.copies}See the ${plural(r.found, 'copy', 'copies')}</a>` : ''}</div></div></section>`;
}
let CR_RUN_T = null;
function crRunWatch() {
  clearInterval(CR_RUN_T);
  CR_RUN_T = setInterval(async () => {
    if (state.shown !== 'credit') { clearInterval(CR_RUN_T); return; }
    const el = document.getElementById('creditrun');
    const r = PP_WATCH.live() || await PP_WATCH.runInfo();
    if (!el || !r) return;
    // Only when something changed, so the Stop button is not swapped out from under a click.
    const html = crRunCard(r);
    if (html !== CR.liveHtml) { CR.liveHtml = html; el.innerHTML = html; }
    if (r.end) { clearInterval(CR_RUN_T); render(true); }
  }, 1000);
}
const crHow = () => `<section class="card chow" id="creditHow" aria-label="How it works"><div class="kh2">How it works</div>
  ${[[KC.blue, KI.search, 'Ask Google and Bing', 'for pages that print a credit, like "Photo: Harbor Times"'], [KC.purple, CRI.page, 'Read each page once', 'a page both of them list is read once, without your cookies'], [KC.green, KI.copies, 'Compare its pictures', 'with that client\'s photos. Finds heavy crops and edits a picture search misses']]
    .map(([c, i, b, t], k) => `<div class="chs"><span class="chn">${k + 1}</span>${kSq(c, i, 32)}<span class="kn1"><b>${b}</b><span>${t}</span></span></div>`).join('')}
  <p class="kfoot">Each wording is searched once a week, in your hours, alongside Keep searching.</p></section>`;

V.credit = async () => {
  if (!CREDIT_TABS.includes(routeArg('tab') || 'overview')) history.replaceState(null, '', '#credit');
  const TAB = state.creditTab = CREDIT_TABS.includes(routeArg('tab')) ? routeArg('tab') : 'overview';
  const [cfg, S] = [await PP_WATCH.creditCfg(), await PP_WATCH.creditState()];
  const clients = (await FC.DB.all('clients')).filter(c => c.searching !== false).sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0) || a.name.localeCompare(b.name));
  const R = (await api.storage.local.get('fcRest').catch(() => ({}))).fcRest || {};
  const isOn = cl => (cfg.clients[cl.name] || {}).on !== false, ownOf = cl => ((cfg.clients[cl.name] || {}).words || []).length;
  const onCount = clients.filter(isOn).length, ownCount = clients.filter(ownOf).length;
  const nm = S.nomatch.slice().reverse();
  const usual = PP_WATCH.usualWords(cfg);
  const W30 = PP_WATCH.wordStats(S, 30), W7 = PP_WATCH.wordStats(S, 7);
  const openName = TAB === 'clients' ? routeArg('client') : '';
  const openCl = openName ? clients.find(c => c.name === openName) : null;

  // ---- the tab line: tabs, then On, How it works, See what it found
  const tabs = [['overview', 'Overview'], ['clients', 'Clients', clients.length], ['nophoto', 'Credit but no photo', nm.length]];
  const ctl = `<div class="rvn-ctl kctl"><div class="utabs" role="tablist" aria-label="Credit search">${tabs.map(([v, l, c]) => `<button role="tab" aria-selected="${v === TAB}" class="${v === TAB ? 'on' : ''}" data-act="credittab" data-v="${v}">${l}${c ? ` <span>${c}</span>` : ''}</button>`).join('')}</div><span class="sp"></span>
    <div class="konoff">${kSwitch('data-act="crediton"', cfg.on, 'Credit search on')}</div>
    <button class="btn kbtn" data-act="credithow" aria-expanded="${CR.how}">${KI.info}How it works</button><a class="btn kbtn" href="#found?via=credit">${KI.copies}See what it found</a></div>`;

  // ---- info bar: why the weekly searches are waiting
  let bar = '';
  try {
    const q = await FC.quietOK();
    if (!q.ok && cfg.on && !CR.barOff) {
      const [b, t, btn] = q.why === 'paused' ? ['Keep searching is paused, so the weekly searches wait', 'They carry on when you press Resume. Search now still works any time.', 'Keep searching']
        : q.why === 'hours' ? ['Outside your hours, so the weekly searches wait until your hours start', 'Search now still works any time. Credit search runs alongside Keep searching, in its hours.', 'Change hours']
        : ['Keep searching is off, so the weekly searches do not run', 'Credit search runs alongside Keep searching. Turn it on to use it. Search now still works any time.', 'Keep searching'];
      bar = `<div class="kbar info" id="creditBar" role="status">${kSq(KC.blue, KI.clock, 28)}<div><b>${b}</b><span>${t}</span></div><span class="sp"></span><a class="btn kbtn" href="#keep${q.why === 'hours' ? '?tab=settings' : ''}">${KI.clock}${btn}</a><button class="kx" data-act="creditbarx" title="Close" aria-label="Close">${CRI.x}</button></div>`;
    }
  } catch (e) { /* no note */ }
  const how = CR.how && TAB !== 'overview' ? crHow() : '';

  let body = '', panel = '';
  if (TAB === 'overview') {
    const run = PP_WATCH.live() || await PP_WATCH.runInfo();
    const showRun = run && (!run.end || Date.now() - run.end < 30 * 60000);
    if (showRun && !run.end) crRunWatch();
    // Search sites: a light each, and when the next weekly search is due
    const site = e => {
      const rest = (R[e] || 0) > Date.now();
      return `<div class="ksr"><span class="keng big ${e[0]}">${e[0].toUpperCase()}</span><span class="kn1"><b>${PP_WATCH.ENG_NAME[e]}</b><span>${rest ? 'Asked "are you a robot?" at ' + kClock(R[e] - 3600000) : 'Text search for the credit wordings'}</span></span><span class="cst ${rest ? 'warn' : 'ok'}">${rest ? 'Rests until ' + kClock(R[e]) : 'Working'}</span></div>`;
    };
    let next = 'Off';
    if (cfg.on) { let q = { ok: true }; try { q = await FC.quietOK(); } catch (e) { /* assume fine */ }
      next = !q.ok ? (q.why === 'hours' ? 'When your hours start' : q.why === 'paused' ? 'When you press Resume' : 'Keep searching is off') : S.queue.length ? 'After the waiting pages' : kClock(Math.max(Date.now(), (S.lastSearch || 0) + cfg.every * 60000)); }
    const sites = `<section class="card csites" id="creditSites" aria-label="Search sites"><div class="kh2">Search sites</div>${PP_WATCH.ENGINES.map(site).join('')}
      <div class="ksr">${kSq(KC.grey, KI.clock)}<span class="kn1"><b>Next weekly search</b><span>One wording at most every ${cfg.every} min, in your hours</span></span><span class="cst plain" id="creditNext">${esc(next)}</span></div>
      <p class="kfoot">PageProof never tries to get past a robot check. That site rests and the other carries on.</p></section>`;
    const wkPages = Object.values(W7).reduce((a, o) => a + o.pages, 0);
    const tiles = `<div class="ktiles2" id="creditTiles">${[[KC.green, KI.copies, (S.found || 0).toLocaleString(), 'Copies found by a credit', '<a href="#found?via=credit">See them in All copies ›</a>'], [KC.blue, CRI.page, (S.pages || 0).toLocaleString(), 'Credited pages read', wkPages.toLocaleString() + ' this week'],
      [KC.amber, CRI.queue, S.queue.length.toLocaleString(), 'Pages waiting to be read', S.queue.length ? 'Read one at a time, alongside Keep searching' : 'Nothing waiting'], [KC.purple, KI.acct, onCount + ' of ' + clients.length, 'Clients searched', `${clients.length - onCount} off · ${ownCount} with their own wordings`]]
      .map(([c, i, b, l, s]) => `<div class="card kt2">${kSq(c, i, 40)}<span><b class="num">${b}</b><span class="l">${l}</span><span class="s">${s}</span></span></div>`).join('')}</div>`;
    const logAll = S.log.slice().reverse(), week = logAll.filter(l => Date.now() - Date.parse(l.at) < 7 * 864e5).length, last = logAll.slice(0, CR.allLog ? 60 : 7);
    const lastC = `<section class="card clast" id="creditLast" aria-label="Last searches"><div class="kh2">Last searches <span class="kfaint">${week} this week</span>${logAll.length > 7 ? `<a data-act="creditalllog" href="#credit" role="button">${CR.allLog ? 'Show fewer ›' : 'All of them ›'}</a>` : ''}</div>
      ${last.length ? `<div class="clh"><span>When</span><span>Client</span><span>Wording</span><span class="r">Google</span><span class="r">Bing</span><span class="r">By both</span><span class="r">New to read</span></div>
      ${last.map(l => `<div class="clr"><span class="kfaint num">${esc(crWhen(l.at))}</span><span class="cname">${kAv(l.client)}<b>${esc(l.client)}</b></span><span class="cw1">${crChip(l.words, 1)}</span><span class="r num">${(l.per || {}).google || 0}</span><span class="r num">${(l.per || {}).bing || 0}</span><span class="r num kfaint">${l.both || 0}</span><span class="r">${l.added ? `<span class="ktag acc">${l.added} new</span>` : '<span class="ktag">Nothing new</span>'}</span></div>`).join('')}`
        : '<p class="kmuted">No searches yet. Open Clients and press Search now next to a client to run one here, or leave it on and it runs within about 15 minutes alongside Keep searching.</p>'}</section>`;
    const bestRows = Object.entries(W30).map(([k, o]) => ({ client: k.split('\n')[0], words: k.split('\n')[1] || '', ...o })).sort((a, b) => b.found - a.found || b.pages - a.pages).slice(0, 5);
    const mx = Math.max(1, ...bestRows.map(b => b.found));
    const best = `<section class="card cbest" id="creditBest" aria-label="Wordings that find copies"><div class="kh2">Wordings that find copies <span class="kfaint">last 30 days</span></div>
      ${bestRows.length ? bestRows.map(b => `<div class="cbr">${crChip(b.words, 1)}<span class="kfaint cbc">${esc(b.client)}</span><span class="cbar"><i style="width:${Math.round(b.found / mx * 100)}%"></i></span><b class="num">${b.found}</b><span class="kfaint num">${plural(b.pages, 'page')}</span></div>`).join('') + '<p class="kfoot">A wording that finds nothing for a month could be changed or switched off.</p>'
        : '<p class="kmuted">This fills in as credited pages are read: which wordings lead to copies, and which find nothing.</p>'}</section>`;
    const nmSmall = `<section class="card cnms" id="creditNmSmall" aria-label="Credit but no photo"><div class="kh2">Credit but no photo <span class="kfaint">${nm.length} to look at</span>${nm.length ? '<a data-act="credittab" data-v="nophoto" href="#credit?tab=nophoto">See all ›</a>' : ''}</div>
      ${nm.length ? nm.slice(0, 4).map(n => `<a class="cnr" href="${safeUrl(n.url)}" target="_blank" rel="noreferrer" title="Open this page"><span class="kn1"><b>${esc(n.title || n.url)}</b><span><span class="csite">${esc(crHost(n.url))}</span> · ${esc(n.client)} · ${crChip(n.words)}</span></span><span class="kfaint">${esc(crAgo(Date.parse(n.at)))}</span>${KI.chev}</a>`).join('')
        : '<p class="kmuted">Pages that name a client but show none of their photos are listed here to look at by hand.</p>'}</section>`;
    body = `<div class="kgrid cg1"><div id="creditrun">${showRun ? crRunCard(run) : ''}</div>${showRun ? '' : crHow()}<div>${sites}</div></div>${tiles}
      <div class="kgrid now2"><div class="kstack">${lastC}${best}</div><div class="kstack">${nmSmall}${showRun ? crHow() : ''}</div></div>`;
    if (!showRun) body = body.replace('<div id="creditrun"></div>', '<div id="creditrun" hidden></div>');
  } else if (TAB === 'clients') {
    const words = cl => PP_WATCH.wordsFor(cfg, cl.name);
    const lastAt = cl => Math.max(0, ...words(cl).map(w => S.done[cl.name + '\n' + w] || 0));
    const foundOf = cl => Object.entries(W30).filter(([k]) => k.startsWith(cl.name + '\n')).reduce((a, [, o]) => a + o.found, 0);
    const cf = ['all', 'on', 'off', 'own'].includes(CR.cf) ? CR.cf : 'all';
    let list = clients.filter(cl => cf === 'all' || (cf === 'on' ? isOn(cl) : cf === 'off' ? !isOn(cl) : ownOf(cl)));
    if (CR.sort === 'name') list = list.slice().sort((a, b) => a.name.localeCompare(b.name));
    else if (CR.sort === 'old') list = list.slice().sort((a, b) => lastAt(a) - lastAt(b));
    else if (CR.sort === 'found') list = list.slice().sort((a, b) => foundOf(b) - foundOf(a));
    const cmd = `<div class="ccmd"><label class="ksearch">${KI.search}<input type="search" id="creditQ" placeholder="Find a client" aria-label="Find a client" value="${esc(CR.q)}"></label>
      ${kSeg('Which clients', 'creditcf', [['all', 'All <span>' + clients.length + '</span>'], ['on', 'On <span>' + onCount + '</span>'], ['off', 'Off <span>' + (clients.length - onCount) + '</span>'], ['own', 'Own wordings <span>' + ownCount + '</span>']], cf)}
      <span class="sp"></span><label class="ksort"><span class="kfaint">Sort</span><select data-act="creditsort" aria-label="Sort clients">${[['pri', 'Priority, then A to Z'], ['name', 'Name A to Z'], ['old', 'Searched longest ago'], ['found', 'Most copies found']].map(([v, l]) => `<option value="${v}" ${CR.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <button class="btn kbtn" data-act="creditusualedit" aria-expanded="${CR.usualEdit}">${CRI.edit}Change the usual wordings</button></div>`;
    const std = usual.join('|') === PP_WATCH.DEFAULT_WORDS.join('|');
    const usualBox = CR.usualEdit
      ? `<section class="card cuedit" id="creditUsual" aria-label="The usual wordings"><div class="kh2">The usual wordings <span class="kfaint">${usual.length} of 8 · for every client without their own</span></div>
        <div class="cuw">${usual.map((w, i) => `<span class="cwc own ed"><span>${esc(crUnq(w))}</span><button class="kx" data-act="creditusualdel" data-v="${i}" title="Remove this wording" aria-label="Remove ${esc(crUnq(w))}">${CRI.x}</button></span>`).join('')}</div>
        <div class="cpadd"><input id="creditUsualNew" placeholder="Add a wording, for example Photo courtesy of {name}" aria-label="Add a usual wording" maxlength="80"><button class="btn kbtn" data-act="creditusualadd">${CRI.plus}Add</button></div>
        <div class="cptip">${CRI.bulb}<span>Write <b>{name}</b> where the client's name goes. Quotes are added for you, so the words stay together.</span></div>
        <div class="row" style="gap:10px">${std ? '' : '<button class="btn kbtn" data-act="creditusualreset">Back to the standard 3</button>'}<span class="sp"></span><button class="btn primary kbtn" data-act="creditusualedit">Done</button></div></section>`
      : `<div class="cusual" id="creditUsual">${KI.info}<span>Clients without their own wordings use the <b>usual ${usual.length}</b>: ${usual.map(w => crChip(w)).join(' ')} <span class="kfaint">{name} becomes the client's name.</span></span></div>`;
    const row = cl => { const on = isOn(cl), own = ownOf(cl), la = lastAt(cl), sel = openCl && openCl.name === cl.name, v = esc(cl.name);
      return `<div class="ccr${on ? '' : ' off'}${sel ? ' sel' : ''}" data-name="${esc(cl.name.toLowerCase())}">
        <button class="cname cbt" data-act="creditopen" data-v="${v}" title="Open ${v}'s wordings">${kAv(cl.name)}<b>${v}</b>${cl.priority ? `<span class="cpri" title="Priority client">${KI.star}</span>` : ''}</button>
        <button class="cwords cbt" data-act="creditopen" data-v="${v}" tabindex="-1" aria-hidden="true">${own ? words(cl).map(w => crChip(w, 1)).join('') : `<span class="cusualtag">Usual ${usual.length} wordings</span>`}</button>
        <span class="kfaint num">${on ? (la ? esc(crAgo(la)) : 'Not searched yet') : 'Off'}</span>
        <span><label class="switch"><input type="checkbox" data-act="creditcl" data-v="${v}" aria-label="Search credits for ${v}" ${on ? 'checked' : ''}><span></span></label></span>
        <span><button class="btn kbtn" data-act="creditnow" data-v="${v}"${on ? '' : ' disabled data-why="Turn this client on first."'}>${CRI.play}Search now</button></span>
        <button class="cchev cbt" data-act="creditopen" data-v="${v}" aria-label="Open ${v}">${KI.chev}</button></div>`; };
    body = `${cmd}${usualBox}<section class="card cclist" id="creditClients" aria-label="Clients"><div class="cch"><span>Client</span><span>Credit wordings</span><span>Last searched</span><span>On</span><span></span><span></span></div>
      ${list.map(row).join('') || `<p class="kmuted" style="padding:18px 0">${clients.length ? 'No clients match.' : 'No clients are being searched yet.'}</p>`}<p class="kmuted" id="creditNoMatch" style="padding:18px 0" hidden>No client matches that name.</p></section>`;
    if (openCl) {
      const cl = openCl, ws = words(cl), v = esc(cl.name), on = isOn(cl);
      const pre = cl.name + '\n';
      const sum = Object.entries(W30).filter(([k]) => k.startsWith(pre)).reduce((a, [, o]) => ({ found: a.found + o.found, pages: a.pages + o.pages }), { found: 0, pages: 0 });
      const lastLog = w => S.log.slice().reverse().find(l => l.client === cl.name && l.words === w);
      panel = `<aside class="cpanel" id="creditPanel" aria-label="${v}">
        <div class="cph">${crAvBig(cl.name)}<span class="kn1"><b>${v}</b><span>${cl.priority ? '★ Priority client · ' : ''}${(cl.photos || 0).toLocaleString()} photos</span></span><span class="sp"></span>
          <label class="switch"><input type="checkbox" data-act="creditcl" data-v="${v}" aria-label="Search credits for ${v}" ${on ? 'checked' : ''}><span></span></label><span class="wswl">${on ? 'On' : 'Off'}</span>
          <button class="kx" data-act="creditclose" title="Close" aria-label="Close">${CRI.x}</button></div>
        <div class="kh2">Credit wordings <span class="kfaint">${ws.length} of 8${ownOf(cl) ? '' : ' · the usual ones'}</span></div>
        ${ws.map(w => { const l = lastLog(w), st = W7[pre + w], f = st ? st.found : 0;
          return `<div class="cpw"><span class="kn1"><b>${esc(crUnq(w))}</b><span>${l ? `Last search: Google ${(l.per || {}).google || 0} · Bing ${(l.per || {}).bing || 0} · ` + (f ? `<span class="okc">${plural(f, 'copy', 'copies')} found this week</span>` : 'no copies this week') : 'Not searched yet'}</span></span>
            <button class="kx" data-act="creditdelw" data-v="${v}" data-w="${esc(w)}" title="Remove this wording" aria-label="Remove ${esc(crUnq(w))}"${ws.length < 2 ? ' disabled' : ''}>${CRI.x}</button></div>`; }).join('')}
        ${ws.length < 8 ? `<div class="cpadd"><input id="creditNewW" data-v="${v}" placeholder="Add a wording, for example Harbus/Harbor Times" aria-label="Add a wording" maxlength="80"><button class="btn kbtn" data-act="creditaddw" data-v="${v}">${CRI.plus}Add</button></div>` : '<p class="kmuted">8 wordings is the most a client can have. Remove one to add another.</p>'}
        <div class="cptip">${CRI.bulb}<span>Copy the credit exactly as it is printed under the client's photos on a news site. Quotes are added for you.${ownOf(cl) ? ` <a data-act="creditusual3" data-v="${v}" href="#credit" role="button">Use the usual ${usual.length} again</a>` : ''}</span></div>
        <div class="kh2">What it found for this client <span class="kfaint">last 30 days</span></div>
        <div class="cpbox"><div class="cbox ok"><b class="num">${sum.found}</b><span>Copies found</span></div><div class="cbox"><b class="num">${nm.filter(n => n.client === cl.name).length}</b><span>Credit but no photo</span></div><div class="cbox"><b class="num">${sum.pages}</b><span>Pages read</span></div></div>
        <div class="cpfoot"><button class="btn primary kbtn" data-act="creditnow" data-v="${v}"${on ? '' : ' disabled data-why="Turn this client on first."'}>${CRI.play}Search now</button><a class="btn kbtn" href="#found?via=credit">${KI.copies}See the copies</a></div></aside>`;
    }
  } else {
    const names = [...new Set(nm.map(n => n.client))].sort();
    let list = nm.filter(n => !CR.ncl || n.client === CR.ncl);
    if (CR.nsort === 'old') list = list.slice().reverse();
    else if (CR.nsort === 'site') list = list.slice().sort((a, b) => crHost(a.url).localeCompare(crHost(b.url)));
    body = `<div class="kbar info">${kSq(KC.blue, KI.info, 28)}<div><b>These pages name your client, but none of that client's photos were found on them</b><span>It may be a licensed use, a photo not in Google Drive, or a picture PageProof couldn't download. Worth a quick look.</span></div></div>
      <div class="ccmd"><label class="ksearch">${KI.search}<input type="search" id="creditNQ" placeholder="Find a site or page" aria-label="Find a site or page" value="${esc(CR.nq)}"></label>
        <label class="ksort"><select data-act="creditncl" aria-label="Which client"><option value="">All clients</option>${names.map(n => `<option value="${esc(n)}" ${CR.ncl === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label><span class="sp"></span>
        <label class="ksort"><span class="kfaint">Sort</span><select data-act="creditnsort" aria-label="Sort pages">${[['new', 'Newest first'], ['old', 'Oldest first'], ['site', 'Site A to Z']].map(([v, l]) => `<option value="${v}" ${CR.nsort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <section class="card cnfull" id="creditNoPhoto" aria-label="Credit but no photo"><div class="cnh"><span>Page</span><span>Found</span><span></span></div>
      ${list.slice(0, 200).map(n => `<div class="cnr big" data-name="${esc((n.title + ' ' + n.url + ' ' + n.client).toLowerCase())}"><span class="kn1"><b>${esc(n.title || n.url)}</b><span><span class="csite">${esc(crHost(n.url))}</span> · ${esc(n.client)} · ${crChip(n.words)}</span></span><span class="kfaint num">${esc(crWhen(n.at))}</span>
        <span class="cnb"><a class="btn kbtn" href="${safeUrl(n.url)}" target="_blank" rel="noreferrer">${CRI.ext}Open page</a><button class="btn kbtn" data-act="creditlook" data-v="${esc(n.url)}" data-t="${esc(n.title || '')}" title="Open this page's pictures in Inspect a photo">${CRI.look}Look closer</button><button class="btn kbtn" data-act="creditdrop" data-v="${esc(n.url)}" title="Take this page off the list">${CRI.x}Take off</button></span></div>`).join('')
        || '<p class="kmuted" style="padding:18px 4px">Nothing here. Pages that name a client but show none of their photos are listed here to look at by hand.</p>'}
      <p class="kmuted" id="creditNoMatch" style="padding:18px 4px" hidden>No page matches that.</p></section>`;
  }
  document.body.classList.toggle('cpopen', !!panel);
  return head('Copies found', 'Credit search', '') + `<div class="rvn kpn crn${panel ? ' withpanel' : ''}" data-tab="${TAB}">${ctl}${how}${TAB === 'overview' ? bar : ''}${body}</div>${panel}`;
};
// Find boxes filter the rows in place (no redraw, so the cursor stays put); Enter adds a wording.
V.credit.after = () => {
  const wire = (id, key, rows) => {
    const i = document.getElementById(id); if (!i) return;
    const run = () => { const q = i.value.trim().toLowerCase(); CR[key] = i.value; let n = 0; for (const r of document.querySelectorAll(rows)) { const hit = !q || (r.dataset.name || '').includes(q); r.hidden = !hit; if (hit) n++; }
      const none = document.getElementById('creditNoMatch'); if (none) none.hidden = !(q && !n); };
    i.addEventListener('input', run); run();
  };
  wire('creditQ', 'q', '#creditClients .ccr'); wire('creditNQ', 'nq', '#creditNoPhoto .cnr');
  const enter = (id, act) => { const i = document.getElementById(id); if (i) i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ACTS[act](i.dataset.v || '', i); } }); };
  enter('creditNewW', 'creditaddw'); enter('creditUsualNew', 'creditusualadd');
  if (state.shown === 'credit' && !document.getElementById('creditPanel')) document.body.classList.remove('cpopen');
};
const crGo = (tab, client) => { history.replaceState(null, '', '#credit' + (tab && tab !== 'overview' ? '?tab=' + tab + (client ? '&client=' + encodeURIComponent(client) : '') : '')); render(true); };
const crSetWords = async (name, list) => {
  const c = await PP_WATCH.creditCfg();
  const usual = PP_WATCH.usualWords(c).map(x => x.replace(/\{name\}/g, name));
  const words = [...new Set(list)].slice(0, 8);
  c.clients[name] = { ...(c.clients[name] || {}), words: words.join('\n') === usual.join('\n') ? [] : words };
  await PP_WATCH.setCreditCfg(c);
};
Object.assign(ACTS, {
  credittab: v => { CR.how = false; crGo(CREDIT_TABS.includes(v) ? v : 'overview'); },
  credithow: () => { if (state.creditTab === 'overview') { const h = document.getElementById('creditHow'); if (h) { h.scrollIntoView({ block: 'center', behavior: 'smooth' }); h.classList.add('flash'); setTimeout(() => h.classList.remove('flash'), 1600); } return; } CR.how = !CR.how; render(true); },
  creditbarx: () => { CR.barOff = true; render(true); },
  creditalllog: () => { CR.allLog = !CR.allLog; render(true); },
  crediton: async (v, el) => { const c = await PP_WATCH.creditCfg(); c.on = !!el.checked; await PP_WATCH.setCreditCfg(c); toast(c.on ? 'Credit search is on.' : 'Credit search is off.'); render(true); },
  creditcl: async (v, el) => { const c = await PP_WATCH.creditCfg(); c.clients[v] = { ...(c.clients[v] || {}), on: !!el.checked }; await PP_WATCH.setCreditCfg(c); render(true); },
  creditcf: v => { CR.cf = v; render(true); },
  creditsort: (v, el) => { CR.sort = el.value; render(true); },
  creditncl: (v, el) => { CR.ncl = el.value; render(true); },
  creditnsort: (v, el) => { CR.nsort = el.value; render(true); },
  creditopen: v => crGo('clients', routeArg('client') === v ? '' : v),
  creditclose: () => crGo('clients'),
  creditaddw: async v => {
    const i = document.getElementById('creditNewW'), w = PP_WATCH.quoteWord(i && i.value);
    if (!w) { if (i) i.focus(); return; }
    const have = PP_WATCH.wordsFor(await PP_WATCH.creditCfg(), v);
    if (have.some(x => x.toLowerCase() === w.toLowerCase())) { toast('That wording is already on the list.'); return; }
    if (have.length >= 8) { toast('8 wordings is the most a client can have.'); return; }
    await crSetWords(v, [...have, w]); toast('Added ' + w + ' for ' + v + '.'); await render(true);
    const n = document.getElementById('creditNewW'); if (n) n.focus();
  },
  creditdelw: async (v, el) => {
    const have = PP_WATCH.wordsFor(await PP_WATCH.creditCfg(), v), left = have.filter(x => x !== el.dataset.w);
    if (!left.length) { toast('A client needs at least one wording. Switch the client off instead.'); return; }
    await crSetWords(v, left); toast('Removed ' + el.dataset.w + '.'); render(true);
  },
  creditusual3: async v => { const c = await PP_WATCH.creditCfg(); c.clients[v] = { ...(c.clients[v] || {}), words: [] }; await PP_WATCH.setCreditCfg(c); toast(v + ' uses the usual wordings again.'); render(true); },
  creditusualedit: () => { CR.usualEdit = !CR.usualEdit; render(true); },
  creditusualadd: async () => {
    const i = document.getElementById('creditUsualNew'), w = PP_WATCH.quoteWord(i && i.value);
    if (!w) { if (i) i.focus(); return; }
    const c = await PP_WATCH.creditCfg(), have = PP_WATCH.usualWords(c).slice();
    if (have.some(x => x.toLowerCase() === w.toLowerCase())) { toast('That wording is already on the list.'); return; }
    if (have.length >= 8) { toast('8 usual wordings is the most.'); return; }
    c.usual = [...have, w]; await PP_WATCH.setCreditCfg(c); toast('Added ' + w + ' for every client without their own wordings.'); await render(true);
    const n = document.getElementById('creditUsualNew'); if (n) n.focus();
  },
  creditusualdel: async v => {
    const c = await PP_WATCH.creditCfg(), have = PP_WATCH.usualWords(c).slice();
    if (have.length < 2) { toast('Keep at least one usual wording.'); return; }
    have.splice(+v, 1);
    c.usual = have.join('|') === PP_WATCH.DEFAULT_WORDS.join('|') ? [] : have; await PP_WATCH.setCreditCfg(c); render(true);
  },
  creditusualreset: async () => { const c = await PP_WATCH.creditCfg(); c.usual = []; await PP_WATCH.setCreditCfg(c); toast('Back to the standard 3 wordings.'); render(true); },
  creditnow: async v => {
    if (await PP_WATCH.runActive() || (PP_WATCH.live() && !PP_WATCH.live().end)) { toast('A credit search is already running. Its progress is on the Overview tab.'); return; }
    const p = PP_WATCH.creditRun(v);
    setTimeout(() => { crGo('overview'); window.scrollTo({ top: 0, behavior: 'smooth' }); }, 150);
    await p; if (state.shown === 'credit') render(true);
  },
  creditstop: async (v, el) => { el.disabled = true; await PP_WATCH.creditStop(); toast('Stopping after the page in hand. Pages not read yet are read later.'); },
  creditdrop: async v => { const s = await PP_WATCH.creditState(); s.nomatch = s.nomatch.filter(n => n.url !== v); await FC.meta.set('creditState', s); render(true); },
  // Look closer: the pictures on that page, opened in Inspect a photo (read without your cookies).
  creditlook: async (v, el) => {
    el.disabled = true;
    try {
      toast('Getting the pictures on that page…');
      const r = await Promise.race([fetch(v, { credentials: 'omit', redirect: 'follow' }), new Promise((_, no) => setTimeout(() => no(new Error('late')), 15000))]);
      if (!r.ok) throw new Error('answered ' + r.status);
      const items = FC_RULES.pagePics(await r.text(), v).map(p => ({ src: p.img, alt: '' }));
      if (!items.length) { toast('No pictures could be read from that page. Use Open page to look yourself.'); return; }
      const id = 'insp-' + Date.now();
      await PP_DB.put({ id, time: new Date().toISOString(), mode: 'all', page: v, title: el.dataset.t || '', items });
      window.open(api.runtime.getURL('inspect.html?id=' + id), '_blank');
    } catch (e) { toast('That page would not open from here. Use Open page instead.'); }
    finally { el.disabled = false; }
  },
});
