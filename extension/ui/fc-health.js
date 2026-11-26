// Settings › Health (green and red lights, Copy details for support, space used)
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
  // 4.37.2: signed in to the social sites? Only whether the site's sign-in cookie is there is
  // looked at, never what is in it, and nothing is saved or sent anywhere.
  L.push(...await signInLights());
  // Backup
  if (docs === 'granted') { const at = st.ppBackupAt ? Date.parse(st.ppBackupAt) : 0; L.push([at ? 'ok' : 'grey', 'Backup in Documents › PageProof', at ? 'Settings saved ' + agoText(at) + '.' : 'Nothing has been saved there yet.']); }
  else if (docs === 'prompt') L.push(['warn', 'Backup in Documents › PageProof', 'Needs one click before PageProof can save there.', '<button class="btn primary sm" data-act="docsallow">Allow</button>']);
  else L.push(['warn', 'Backup in Documents › PageProof', 'Not set up, so a reinstall would lose your hidden sites and finds.', '<a class="btn sm" href="#settings">Set it up</a>']);
  // Skipped photos
  if (d.done) L.push([skipped.length ? 'warn' : 'ok', 'Skipped photos', skipped.length ? skipped.length.toLocaleString() + (skipped.length >= 5000 ? '+' : '') + ' photos could not be searched.' : 'Every photo tried so far could be opened.', skipped.length ? '<a class="btn sm" href="#skipped">See them</a>' : '']);
  // Preview pictures
  L.push([moved ? 'ok' : 'warn', 'Preview pictures', moved ? 'Kept in their own small store.' : 'Still being tidied after the update. This finishes by itself.']);
  // How PageProof is doing (the stats page's "Something looks off")
  try {
    const al = typeof PP_REPORT !== 'undefined' ? (await PP_REPORT.model('7', { light: true })).alerts : [];
    L.push([al.some(a => a[0] === 'bad') ? 'bad' : al.length ? 'warn' : 'ok', 'Stats', al.length ? al.map(a => a[1]).join('. ') + '.' : 'Nothing looks off compared with this computer\'s usual numbers.', '<a class="btn sm" href="#stats">See the stats</a>']);
  } catch (e) { /* stats are only a help */ }
  // Version
  L.push(['ok', 'PageProof version', 'You have ' + VERSION + '. New versions come from your team lead.']);
  return L;
}
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
    'Computer: ' + hw.cores + ' cores, ' + hw.memGB + ' GB memory, rated ' + hw.level + ' (' + hw.limits.checks + ' photo checks, ' + hw.limits.tabs + ' search tabs, ' + hw.limits.dl + ' downloads, ' + hw.limits.decode + ' pictures opened at once)',
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
    'Where the time goes (last 7 days, average each)',
    ...(await (async () => { const t = await timeSums(); if (!t) return ['  Nothing measured yet.']; return [
      '  Fast checker (WebAssembly): ' + (t.fast == null ? 'not known' : t.fast ? 'on' : 'off'),
      '  Graphics card: ' + (t.gpu == null ? 'not used yet' : t.gpu ? 'in use' : 'not available') + (t.gpuWhy ? ' (' + t.gpuWhy + ')' : ''),
      ...[['search', 'Search site, one photo'], ['dl', 'Download a found picture'], ['check', 'Check a found picture'], ['wait', 'Wait for a free checker']].map(([k, l]) => '  ' + l + ': ' + (t.avg(k) == null ? '–' : msText(t.avg(k))) + ' (' + t.sum[k][0] + ' times)'),
      '  Hidden-site links skipped: ' + t.sum.skipped]; })()), '',
    'The lights',
    ...lights.map(([c, title, text]) => '  [' + ({ ok: 'green', warn: 'yellow', bad: 'red', grey: 'grey' }[c]) + '] ' + title + ': ' + text),
  ];
  return lines.join('\n');
}

// ---------------------------------------------------------------- where the time goes (4.16)
// Written by the search results page (revsearch.js timeAdd): per day, how many and how long.
async function timeSums() {
  const st = (await api.storage.local.get('rsTiming')).rsTiming;
  if (!st || !st.days) return null;
  const sum = { search: [0, 0], dl: [0, 0], check: [0, 0], wait: [0, 0], skipped: 0, eased: 0 };
  for (const d of Object.values(st.days)) { for (const k of ['search', 'dl', 'check', 'wait']) { sum[k][0] += d[k][0]; sum[k][1] += d[k][1]; } sum.skipped += d.skipped || 0; sum.eased += d.eased || 0; }
  const avg = k => sum[k][0] ? Math.round(sum[k][1] / sum[k][0]) : null;
  return { sum, avg, fast: st.fast, gpu: st.gpu, gpuWhy: st.gpuWhy || '', checks: st.checks || 1 };
}
function timeSlowest(t) {
  const c = t.avg('check'), w = t.avg('wait'), d = t.avg('dl');
  if (c == null) return '';
  if (w != null && w > c) return 'On this computer the photo checks are the slow part: pictures wait for a free checker.';
  if (d != null && d > c * t.checks) return 'On this computer the internet is the slow part: the checker waits for pictures to download.';
  return 'Downloads and photo checks keep pace with each other on this computer.';
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
  const guard = typeof PP_GUARD !== 'undefined' ? { u: await PP_GUARD.usage().catch(() => ({})), fail: await PP_GUARD.lastFail().catch(() => null) } : { u: {}, fail: null };
  return { guard, kept, pages, prev, caps, ans, old, used, quota: est.quota || 0, sizes: { kept: kept.bytes, pages: pages.bytes, prev: prev.bytes, caps: caps.bytes, rest: Math.max(0, used - known) }, at: Date.now() };
}
// The Space used tab itself is drawn in ui/pp-settings.js (sxSpace).

// ---------------------------------------------------------------- signed in to the sites?
// Facebook, Instagram and X hide many posts and pictures from anyone who is not signed in.
// PageProof's post check, account reader and Capture look at posts in THIS browser, so they see
// what you see: signed out, they often get a sign-in wall instead of the post.
// [name, sites, sign-in cookie, needed?, why, where to sign in]
const SIGNIN = [
  ['Facebook', ['facebook.com'], 'c_user', true, 'Facebook hides most posts and pictures from anyone not signed in.', 'https://www.facebook.com/'],
  ['Instagram', ['instagram.com'], 'ds_user_id', true, 'Instagram shows a sign-in wall instead of posts.', 'https://www.instagram.com/'],
  ['X (Twitter)', ['x.com', 'twitter.com'], 'twid', true, 'X hides posts, replies and pictures from anyone not signed in.', 'https://x.com/login'],
  ['TikTok', ['tiktok.com'], 'sessionid', false, 'Some TikTok videos only show when signed in.', 'https://www.tiktok.com/login'],
  ['LinkedIn', ['linkedin.com'], 'li_at', false, 'LinkedIn hides most posts from anyone not signed in.', 'https://www.linkedin.com/login'],
  ['Google (Lens and YouTube)', ['google.com'], 'SID', false, 'Signed in, Google asks "are you a robot?" less often.', 'https://accounts.google.com/'],
  ['Bing', ['bing.com'], '_U', false, 'Signed in, Bing asks "are you a robot?" less often.', 'https://www.bing.com/'],
];
async function signedIn(sites, name) {
  if (!api.cookies) return null;                          // the browser doesn't allow the check
  try {
    for (const domain of sites) if ((await api.cookies.getAll({ domain, name })).length) return true;
    return false;
  } catch (e) { return null; }
}
async function signInLights() {
  const out = [];
  for (const [title, sites, cookie, needed, why, href] of SIGNIN) {
    const on = await signedIn(sites, cookie);
    const btn = `<a class="btn sm" href="${href}" target="_blank" rel="noreferrer">${on ? 'Open' : 'Sign in'}</a>`;
    if (on === null) out.push(['grey', 'Signed in: ' + title, 'This browser would not let PageProof check. ' + why]);
    else if (on) out.push(['ok', 'Signed in: ' + title, 'Yes, in this browser.']);
    else out.push([needed ? 'warn' : 'grey', 'Signed in: ' + title, 'Not signed in. ' + why + (needed ? ' PageProof checks posts in this browser, so sign in here (any account you use for work).' : ' Optional.'), btn]);
  }
  return out;
}

// The Health page itself is drawn in ui/pp-settings.js (calm look).
// Skipped photos moved to ui/pp-skipped.js (calm look step 13).

Object.assign(ACTS, {
  stfailok: async () => { if (typeof PP_GUARD !== 'undefined') await PP_GUARD.clearFail(); state.storage = null; render(true); },
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
});
