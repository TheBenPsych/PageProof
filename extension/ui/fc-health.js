// Settings › Is everything working? (green and red lights, Copy details for support)
// and Find copies › Skipped photos (photos that could not be searched, and why).
Object.assign(state, { skTab: 'All', skMore: 100, support: '' });
const agoText = t => {
  if (!t) return 'never';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now'; if (m < 60) return m + ' min ago';
  if (m < 48 * 60) return Math.round(m / 60) + ' hours ago';
  return Math.round(m / 1440) + ' days ago';
};
const clock = t => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const msText = ms => ms == null ? '' : ms < 1000 ? ms + ' ms' : (ms / 1000).toFixed(1) + ' seconds';

// ---------------------------------------------------------------- the lights
// Each light: [colour, title, what it says, optional button html]
async function healthLights() {
  const st = await api.storage.local.get(['fcStatus', 'fcPause', 'fcRest', 'fcLastSearch', 'ppBackupAt', 'fcPerf', 'ppClockOff']);
  const [k, d, ds, docs, eng, rs, skipped, moved] = [await FC.keep(), await FC.drive(), await FC.driveStateSoft(true), await RS_DOCS.state(), await FC.engines(), await RS_JOB.settings(), await FC.skipped(), await FC.meta.get('picsMoved')];
  const perf = st.fcPerf || {}, now = Date.now(), L = [];
  // Google Drive
  if (!d.done) L.push(['grey', 'Google Drive photos', 'Not connected yet.', '<a class="btn sm" href="#connect">Connect your photos</a>']);
  else if (ds === 'granted') L.push(['ok', 'Google Drive photos', 'Connected' + (perf.driveAnswer ? '. Drive answered in ' + msText(perf.driveAnswer.ms) + '.' : '.')]);
  else if (ds === 'prompt') L.push(['warn', 'Google Drive photos', 'Your browser needs one click before PageProof can read the photos (it asks after every restart).', '<button class="btn primary sm" data-act="driveallow">Allow</button>']);
  else if (ds === 'offline') L.push(['bad', 'Google Drive photos', 'Can\'t be reached. Drive for desktop is signed out or not running.', '<button class="btn sm" data-act="driveretry">Try again</button>']);
  else L.push(['bad', 'Google Drive photos', 'The photos folder is no longer linked.', '<a class="btn sm" href="#connect">Connect again</a>']);
  // 4.15: this computer's clock, compared with the trusted timestamp at the last capture.
  const ck = st.ppClockOff;
  if (!ck) L.push(['grey', 'Computer clock', 'Checked at your next capture (against the trusted timestamp).']);
  else if (Math.abs(ck.off) > 120) L.push(['bad', 'Computer clock', `${Math.round(Math.abs(ck.off) / 60)} minutes ${ck.off > 0 ? 'fast' : 'slow'} at your last capture (${agoText(ck.at)}). Times written in evidence won't match the trusted timestamp. Fix: Windows Settings › Time & language › Date & time › turn on "Set time automatically", then press "Sync now".`]);
  else L.push(['ok', 'Computer clock', 'Right to within ' + Math.max(1, Math.abs(ck.off)) + ' seconds at your last capture (' + agoText(ck.at) + ').']);
  // Keep searching
  const s = st.fcStatus, alive = s && now - s.beat < 90000;
  if (!d.done) L.push(['grey', 'Keep searching', 'Waiting for the photos to be connected.']);
  else if (!k.on) L.push(['grey', 'Keep searching', 'Switched off.', '<a class="btn sm" href="#keep">Open Keep searching</a>']);
  else if (st.fcPause) L.push(['warn', 'Keep searching', 'Paused by you.', '<a class="btn sm" href="#keep">Open Keep searching</a>']);
  else if (!alive) L.push(['warn', 'Keep searching', 'Switched on, but its pinned tab is not running.', '<button class="btn sm" data-act="keepshow">Start it</button>']);
  else L.push([['offline', 'allow', 'setup'].includes(s.state) ? 'warn' : 'ok', 'Keep searching', s.text || 'Running.']);
  // Last photo searched
  const last = st.fcLastSearch;
  const inHours = k.hours === 'all' || (!(k.weekdays !== false && [0, 6].includes(new Date().getDay())) && new Date().getHours() >= (k.from ?? 8) && new Date().getHours() < (k.to ?? 18));
  if (d.done) L.push([!last ? 'grey' : k.on && alive && inHours && !st.fcPause && now - last > 2 * 3600000 ? 'warn' : 'ok', 'Last photo searched', last ? agoText(last) + (k.on && alive && inHours && now - last > 2 * 3600000 ? '. That is a long gap while Keep searching is on.' : '.') : 'No photo has been searched yet.']);
  // Search sites
  for (const e of RS_JOB.ENGINES) {
    const h = eng[e] || {}, name = FC.ENGINE_NAME[e];
    if (!rs.engines[e]) L.push(['grey', name, 'Switched off in New search.']);
    else if (h.until > now) L.push(['bad', name, (h.why === 'fails' ? 'Gave no answer for several photos in a row' : 'Found nothing at all for several photos in a row') + ', so it may have changed its page. Resting until ' + clock(h.until) + '. Those empty results were not counted against your photos.', `<button class="btn sm" data-act="engretry" data-v="${e}">Try it now</button>`]);
    else if ((st.fcRest || {})[e] > now) L.push(['warn', name, 'Resting until ' + clock(st.fcRest[e]) + ' after an "are you a robot" check.']);
    else if (h.ok) L.push(['ok', name, 'Last gave results ' + agoText(h.ok) + '.' + (h.zeros >= 3 ? ' Nothing for the last ' + h.zeros + ' photos.' : '')]);
    else L.push(['grey', name, h.last ? 'Has not given any results yet (' + (h.zeros || 0) + ' photos tried).' : 'Not used yet.']);
  }
  // Backup
  if (docs === 'granted') { const at = st.ppBackupAt ? Date.parse(st.ppBackupAt) : 0; L.push([at ? 'ok' : 'grey', 'Backup in Documents › PageProof', at ? 'Settings saved ' + agoText(at) + '.' : 'Nothing has been saved there yet.']); }
  else if (docs === 'prompt') L.push(['warn', 'Backup in Documents › PageProof', 'Needs one click before PageProof can save there.', '<button class="btn primary sm" data-act="docsallow">Allow</button>']);
  else L.push(['warn', 'Backup in Documents › PageProof', 'Not set up, so a reinstall would lose your hidden sites and finds.', '<a class="btn sm" href="#settings">Set it up</a>']);
  // Skipped photos
  if (d.done) L.push([skipped.length ? 'warn' : 'ok', 'Skipped photos', skipped.length ? skipped.length.toLocaleString() + (skipped.length >= 5000 ? '+' : '') + ' photos could not be searched.' : 'Every photo tried so far could be opened.', skipped.length ? '<a class="btn sm" href="#skipped">See them</a>' : '']);
  // Preview pictures
  L.push([moved ? 'ok' : 'warn', 'Preview pictures', moved ? 'Kept in their own small store.' : 'Still being tidied after the update. This finishes by itself.']);
  // Version
  L.push(['ok', 'PageProof version', 'You have ' + VERSION + '. New versions come from your team lead.']);
  return L;
}
const LIGHT = { ok: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--bad)', grey: 'var(--faint)' };

// ---------------------------------------------------------------- Copy details for support
// Numbers and settings only. Never a photo's name, a client's name, a site or a folder path.
async function supportDetails() {
  const t = async f => { const t0 = performance.now(); const r = await f(); return [Math.round(performance.now() - t0), r]; };
  const st = await api.storage.local.get(['fcPerf', 'fcToday', 'fcStatus', 'rsHidden', 'rsAllowed']);
  const hw = await ppHardware(), k = await FC.keep();
  const [msPhotos, nPhotos] = await t(() => FC.DB.count('photos'));
  const [msCopies, copies] = await t(() => FC.allCopies());
  const [msClients, clients] = await t(() => FC.DB.all('clients'));
  const [msDrive, drive] = await t(() => FC.driveStateSoft(true));
  const by = {}; for (const c of copies) by[c.status] = (by[c.status] || 0) + 1;
  const skipped = await FC.skipped(); const sk = {}; for (const x of skipped) sk[x[3]] = (sk[x[3]] || 0) + 1;
  let est = {}; try { est = await navigator.storage.estimate(); } catch (e) { /* none */ }
  const eng = await FC.engines();
  const lights = await healthLights();
  const perf = st.fcPerf || {};
  const NAME = { openPhoto: 'Open one photo from Drive (n = its size in KB)', searchLine: 'Work out which photo is next (n = photos)', readCopies: 'Read all copies found (n = copies)', readEveryFolder: 'Read every folder (n = photos)', readNewFolders: 'Read this and last quarter\'s folders (n = photos)', driveAnswer: 'Google Drive answers' };
  const lines = [
    'PageProof details for support', 'Made ' + new Date().toString(), '',
    'Version: ' + VERSION,
    'Browser: ' + navigator.userAgent,
    'Computer: ' + hw.cores + ' cores, ' + hw.memGB + ' GB memory, rated ' + hw.level + ' (' + hw.limits.checks + ' photo checks, ' + hw.limits.tabs + ' search tabs at once)',
    'Page memory in use: ' + (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) + ' MB' : 'not known'),
    'Browser storage used by PageProof: ' + (est.usage ? Math.round(est.usage / 1e6) + ' MB' : 'not known'), '',
    'How much it holds',
    '  Clients: ' + clients.length + ' (' + clients.filter(c => c.searching === true).length + ' being searched, ' + clients.filter(c => c.priority).length + ' priority)',
    '  Photos: ' + nPhotos.toLocaleString(),
    '  Copies found: ' + copies.length.toLocaleString() + ' (' + Object.entries(by).map(([s, n]) => n + ' ' + s).join(', ') + ')',
    '  Preview pictures stored: ' + (await FC.pics.count().catch(() => '?')),
    '  Hidden sites: ' + (st.rsHidden || []).length + ', approved sites: ' + (st.rsAllowed || []).length,
    '  Skipped photos: ' + skipped.length + (skipped.length ? ' (' + Object.entries(sk).map(([s, n]) => n + ' ' + (FC.SKIP_LABEL[s] || s).toLowerCase()).join(', ') + ')' : ''), '',
    'How long things take right now',
    '  Count the photos: ' + msText(msPhotos),
    '  Read all copies found: ' + msText(msCopies),
    '  Read the clients: ' + msText(msClients),
    '  Ask Google Drive if it is there: ' + msText(msDrive) + ' (' + drive + ')', '',
    'How long things took earlier (last time, slowest time, how often)',
    ...(Object.keys(perf).length ? Object.entries(perf).map(([n, v]) => '  ' + (NAME[n] || n) + ': last ' + msText(v.ms) + ', slowest ' + msText(v.max) + ', ' + v.runs + ' times' + (v.n != null ? ', n = ' + Number(v.n).toLocaleString() : '') + ', ' + agoText(v.at)) : ['  Nothing measured yet.']), '',
    'Keep searching: ' + (k.on ? 'on' : 'off') + ', pace ' + k.pace + ', hours ' + (k.hours === 'all' ? 'all day' : (k.from ?? 8) + ' to ' + (k.to ?? 18) + (k.weekdays !== false ? ' weekdays' : '')) + ', ' + k.perDay + ' a day' + (k.fiftyAuto ? ' starting by itself at ' + k.fiftyTime : ''),
    'Today: ' + ((st.fcToday || {}).searched || 0) + ' photos searched, ' + ((st.fcToday || {}).found || 0) + ' new copies',
    'Search sites: ' + RS_JOB.ENGINES.map(e => e + ' ' + JSON.stringify({ lastGood: eng[e] && eng[e].ok ? agoText(eng[e].ok) : 'never', emptyInARow: (eng[e] || {}).zeros || 0, noAnswerInARow: (eng[e] || {}).fails || 0, resting: !!(eng[e] && eng[e].until > Date.now()) })).join('; '), '',
    'The lights',
    ...lights.map(([c, title, text]) => '  [' + ({ ok: 'green', warn: 'yellow', bad: 'red', grey: 'grey' }[c]) + '] ' + title + ': ' + text),
  ];
  return lines.join('\n');
}

// ---------------------------------------------------------------- how much room PageProof takes
// Measured only when this page is open (it reads every stored picture's size, which takes a
// moment on a big list). Copies marked Stolen are never offered for clearing.
const STORE_PARTS = [['kept', 'Kept copies of their pictures', '#2563EB'], ['pages', 'Pictures of their pages', '#0EA5E9'], ['prev', 'Preview pictures', '#93C5FD'], ['caps', 'Captures waiting in the browser', '#15803D'], ['rest', 'Lists and settings', '#94A3B8']];
const sizeText = n => n >= 1073741824 ? (n / 1073741824).toFixed(1) + ' GB' : n >= 1048576 ? (n / 1048576).toFixed(n >= 104857600 ? 0 : 1) + ' MB' : n >= 1024 ? Math.round(n / 1024) + ' KB' : n ? '1 KB' : '0 KB';
async function ppStorage() {
  const [kept, pages, prev, est, capKeys] = await Promise.all([FC.kept.stats(), FC.pages.stats(), FC.pics.stats(), navigator.storage && navigator.storage.estimate ? navigator.storage.estimate().catch(() => ({})) : {}, PP_DB.keys().catch(() => [])]);
  const caps = { n: 0, bytes: 0, old: [], oldBytes: 0 };
  const dayAgo = Date.now() - 864e5;
  for (const k of capKeys.filter(k => String(k).startsWith('cap-'))) {
    const rec = await PP_DB.get(k).catch(() => null); if (!rec) continue;
    let b = (rec.html || '').length;
    for (const part of [rec.main, ...(rec.sections || [])]) for (const t of (part && part.tiles) || []) b += Math.round((t.src || '').length * 0.75);
    caps.n++; caps.bytes += b;
    if (new Date(rec.time).getTime() < dayAgo) { caps.old.push(k); caps.oldBytes += b; }
  }
  // What may be cleared: only things that belong to copies you did NOT mark Stolen.
  const ids = [...new Set([...kept.ids, ...pages.ids])];
  const recs = await FC.DB.getMany('copies', ids);
  const status = new Map(ids.map((id, i) => [id, recs[i] ? recs[i].status : 'gone']));
  const ans = { kept: [], pages: [], bytes: 0 }, old = { pages: [], bytes: 0 };
  const cut = new Date(Date.now() - 90 * 864e5).toISOString();
  for (const [id, b] of kept.each) if (['licensed', 'removed', 'gone'].includes(status.get(id))) { ans.kept.push(id); ans.bytes += b; }
  for (const [id, b, at] of pages.each) {
    const st = status.get(id);
    if (['licensed', 'removed', 'gone'].includes(st)) { ans.pages.push(id); ans.bytes += b; }
    else if (st !== 'stolen' && at && at < cut) { old.pages.push(id); old.bytes += b; }
  }
  const known = kept.bytes + pages.bytes + prev.bytes + caps.bytes;
  const used = Math.max(est.usage || 0, known);
  return { kept, pages, prev, caps, ans, old, used, quota: est.quota || 0, sizes: { kept: kept.bytes, pages: pages.bytes, prev: prev.bytes, caps: caps.bytes, rest: Math.max(0, used - known) }, at: Date.now() };
}
function storageCard() {
  const s = state.storage;
  if (!s) {
    if (!state.storageBusy) { state.storageBusy = true; ppStorage().then(r => { state.storage = r; }, e => { state.storage = { error: e.message || String(e) }; }).then(() => { state.storageBusy = false; if (state.shown === 'health') render(true); }); }
    return `<section class="card pad" id="storage"><div class="row"><h2>Space PageProof is using</h2></div><div class="scanbar" style="margin-top:10px"><span class="spin"></span>Measuring…</div></section>`;
  }
  if (s.error) return `<section class="card pad" id="storage"><h2>Space PageProof is using</h2><p class="muted" style="margin:8px 0 0">Could not measure it right now (${esc(s.error)}).</p></section>`;
  const pick = state.stPick || (state.stPick = {});
  const opts = [
    ['ans', 'Kept pictures for copies you answered Licensed or Removed', s.ans.kept.length + s.ans.pages.length, s.ans.bytes, 'Their copy and the picture of their page. The answer itself and the link stay in your list.'],
    ['old', 'Pictures of their pages older than 3 months', s.old.pages.length, s.old.bytes, 'Only for copies you have not answered yet. PageProof can take the picture again when you open the copy.'],
    ['caps', 'Captures from before today that are still held in the browser', s.caps.old.length, s.caps.oldBytes, 'The evidence packs you saved are files on your computer. They are not touched.'],
  ];
  const chosen = opts.filter(o => pick[o[0]] && o[2]);
  const total = chosen.reduce((a, o) => a + o[3], 0);
  const pct = s.quota ? Math.min(100, s.used / s.quota * 100) : 0;
  return `<section class="card pad" id="storage" style="display:flex;flex-direction:column;gap:14px">
    <div class="row"><h2>Space PageProof is using</h2><span class="tag ${pct > 80 ? 'warn' : 'ok'}" style="margin-left:auto">${pct > 80 ? 'Getting full' : 'Plenty of room'}</span></div>
    <div><div class="row" style="align-items:baseline;gap:8px"><b style="font-size:26px;letter-spacing:-.02em">${sizeText(s.used)}</b>${s.quota ? `<span class="muted">used of the ${sizeText(s.quota)} your browser allows on this computer</span>` : ''}</div>
      <div class="stbar" role="img" aria-label="What the space is used for">${STORE_PARTS.map(([k, l, c]) => s.sizes[k] ? `<i style="flex:${Math.max(s.sizes[k], s.used / 150)} 0 0;background:${c}" title="${l}: ${sizeText(s.sizes[k])}"></i>` : '').join('')}</div></div>
    <div class="stlist">${STORE_PARTS.map(([k, l, c]) => `<div><i style="background:${c}"></i><span>${l}${{ kept: ' (' + s.kept.n.toLocaleString() + ')', pages: ' (' + s.pages.n.toLocaleString() + ')', prev: ' (' + s.prev.n.toLocaleString() + ')', caps: ' (' + s.caps.n + ' of the 10 most recent)' }[k] || ''}</span><b>${sizeText(s.sizes[k])}</b></div>`).join('')}</div>
    <div style="border-top:1px solid var(--line);padding-top:14px;display:flex;flex-direction:column;gap:10px">
      <h3 style="margin:0;font-size:15px">Free up space</h3>
      ${opts.map(([k, l, n, b, why]) => `<label class="stopt${n ? '' : ' none'}"><input type="checkbox" data-act="stpick" data-v="${k}"${pick[k] && n ? ' checked' : ''}${n ? '' : ' disabled data-why="There is nothing of this kind to clear right now."'}><span><b>${l}</b><small>${n ? n.toLocaleString() + (n === 1 ? ' item, ' : ' items, ') + sizeText(b) + '. ' : 'Nothing to clear. '}${why}</small></span></label>`).join('')}
      <div class="row" style="gap:12px"><button class="btn primary" data-act="stfree"${chosen.length ? '' : ' disabled data-why="Tick at least one kind of saved data above first."'}>${chosen.length ? 'Free up ' + sizeText(total) : 'Tick what to clear'}</button>
        <span class="muted" style="font-size:13.5px;display:inline-flex;align-items:center;gap:6px">${ic('check', 16)} Copies you marked Stolen are never deleted here.</span></div>
    </div>
  </section>`;
}

// ---------------------------------------------------------------- the page
V.health = async () => {
  const lights = await healthLights();
  const bad = lights.filter(l => l[0] === 'bad').length, warn = lights.filter(l => l[0] === 'warn').length;
  return `${head('Settings', 'Is everything working?', 'A quick look at every part of PageProof. Green is fine, yellow needs a look, red is stopped.', `<button class="btn" data-act="healthagain">${ic('refresh', 18)} Check again</button><button class="btn primary" data-act="supportcopy">${ic('doc', 18)} Copy details for support</button>`)}
  <div class="banner ${bad ? 'bad' : warn ? 'warn' : 'info'}" style="font-size:15px"><b>${bad ? plural(bad, 'thing has', 'things have') + ' stopped' : warn ? plural(warn, 'thing needs', 'things need') + ' a look' : 'Everything is working'}</b>${bad && warn ? `<span class="muted">and ${warn} more ${warn === 1 ? 'needs' : 'need'} a look</span>` : ''}</div>
  <section class="card" style="overflow:hidden">
    ${lights.map(([c, title, text, btn]) => `<div class="row" style="gap:14px;padding:14px 20px;border-bottom:1px solid var(--line);flex-wrap:nowrap;align-items:center">
      <span style="width:14px;height:14px;border-radius:50%;flex-shrink:0;background:${LIGHT[c]}" role="img" aria-label="${{ ok: 'Working', warn: 'Needs a look', bad: 'Stopped', grey: 'Not in use' }[c]}"></span>
      <div style="flex:1;min-width:0"><b>${esc(title)}</b><div class="muted" style="font-size:13.5px">${esc(text)}</div></div>${btn || ''}</div>`).join('')}
  </section>
  ${storageCard()}
  ${state.support ? `<section class="card pad" style="display:flex;flex-direction:column;gap:10px"><div class="row"><h2>Details for support</h2><span class="tag ok" style="margin-left:auto">Copied</span></div>
    <p class="muted" style="margin:0;font-size:14px">This is exactly what was copied. Paste it into a message. It has numbers and settings only: no photo names, client names, sites or folder paths.</p>
    <textarea readonly style="width:100%;min-height:260px;font-family:var(--mono,monospace);font-size:12.5px;border:1px solid var(--line);border-radius:10px;padding:12px;background:var(--sunk);color:var(--ink)">${esc(state.support)}</textarea></section>` : ''}`;
};
// ---------------------------------------------------------------- Skipped photos
V.skipped = async () => {
  const all = await FC.skipped();
  const kinds = {}; for (const x of all) kinds[x[3]] = (kinds[x[3]] || 0) + 1;
  const rows = all.filter(x => state.skTab === 'All' || x[3] === state.skTab);
  const page = rows.slice(0, state.skMore);
  const canRetry = all.some(x => x[3] !== 'type');
  return `${head('Find copies', 'Skipped photos', 'Photos PageProof could not search, and why. They are tried again by themselves every 3 months.', `<a class="btn" href="#clients">Clients and photos</a>${canRetry ? `<button class="btn primary" data-act="skretry" data-v="">Try them all again</button>` : ''}`)}
  ${await driveBanner()}
  ${!all.length ? `<section class="card pad" style="text-align:center;padding:48px 22px"><h2>No skipped photos</h2><p class="muted" style="margin:8px 0 0">Every photo PageProof has tried so far could be opened and searched.</p></section>` : `
  <section class="card" style="overflow:hidden">
    <div class="toolbar"><div class="tabs" role="tablist">${[['All', 'All', all.length], ...Object.keys(FC.SKIP_LABEL).filter(k => kinds[k]).map(k => [k, FC.SKIP_LABEL[k], kinds[k]])].map(([k, l, n]) => `<button role="tab" class="${state.skTab === k ? 'on' : ''}" aria-selected="${state.skTab === k}" data-act="sktab" data-v="${k}">${l} <span>${n.toLocaleString()}</span></button>`).join('')}</div></div>
    ${state.skTab !== 'All' ? `<div style="padding:12px 18px;border-bottom:1px solid var(--line);background:var(--sunk);font-size:14px">${esc(FC.SKIP_WHY[state.skTab])}</div>` : ''}
    <div class="scroll"><table><thead><tr><th>Photo</th><th>Client</th><th>Why</th><th>When</th><th></th></tr></thead><tbody>
      ${page.map(([id, name, client, kind, at]) => `<tr><td><b style="overflow-wrap:anywhere">${esc(name)}</b><div class="faint mono" style="font-size:12px;overflow-wrap:anywhere">${esc(String(id).replace(/^d:\+?/, '').split('/').slice(0, -1).join(' › '))}</div></td><td>${esc(client || 'Client unknown')}</td><td><span class="tag ${kind === 'type' ? 'grey' : 'warn'}" title="${esc(FC.SKIP_WHY[kind] || '')}">${esc(FC.SKIP_LABEL[kind] || kind)}</span></td><td class="muted" style="white-space:nowrap">${esc(fmtDate(at))}</td><td style="text-align:right">${kind === 'type' ? '' : `<button class="btn" style="min-height:32px;font-size:13px" data-act="skretry" data-v="${esc(id)}">Try again</button>`}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="row faint" style="padding:10px 18px;border-top:1px solid var(--line);font-size:12.5px;gap:12px"><span>Showing ${page.length.toLocaleString()} of ${rows.length.toLocaleString()}${all.length >= 5000 ? ' (the newest 5,000 are kept)' : ''}.</span>${rows.length > page.length ? '<button class="btn" style="min-height:30px;font-size:13px;margin-left:auto" data-act="skmore">Show more</button>' : ''}</div>
  </section>`}`;
};
V.skipped.guard = async () => ((await FC.drive()).done ? null : 'connect');

Object.assign(ACTS, {
  healthagain: async () => { state.support = ''; state.storage = null; toast('Checked again.'); render(true); },
  stpick: (v, el) => { (state.stPick || (state.stPick = {}))[v] = el.checked; render(true); },
  stfree: async () => {
    const s = state.storage, p = state.stPick || {}; if (!s || s.error) return;
    let bytes = 0;
    if (p.ans) { await FC.kept.del(s.ans.kept); await FC.pages.del(s.ans.pages); bytes += s.ans.bytes; }
    if (p.old) { await FC.pages.del(s.old.pages); bytes += s.old.bytes; }
    if (p.caps) { for (const k of s.caps.old) await PP_DB.del(k).catch(() => {}); bytes += s.caps.oldBytes; }
    state.stPick = {}; state.storage = null;
    toast('Freed ' + sizeText(bytes) + '. Nothing marked Stolen was touched.');
    render(true);
  },
  supportcopy: async () => {
    toast('Measuring…');
    state.support = await supportDetails();
    try { await navigator.clipboard.writeText(state.support); toast('Copied. Paste it into a message to send it.'); } catch (e) { toast('Could not copy by itself. Select the text in the box and copy it.'); }
    await render(true);
    const b = view.querySelector('textarea'); if (b) b.scrollIntoView({ block: 'center', behavior: 'smooth' });
  },
  engretry: async v => { await FC.retryEngine(v); toast(FC.ENGINE_NAME[v] + ' is tried again with the next photo.'); render(true); },
  sktab: v => { state.skTab = v; state.skMore = 100; render(true); },
  skmore: () => { state.skMore += 200; render(true); },
  skretry: async v => { const n = await FC.retrySkipped(v ? [v] : null); toast(n ? plural(n, 'photo goes', 'photos go') + ' to the front of the line.' : 'Nothing to try again.'); render(true); },
});
