// Keep searching: searches the photos in the shared Google Drive one at a time, all day, in this
// small pinned PageProof tab. The background opens it when Keep searching is on.
//  - Rests between photos (the pace), only in the hours you picked.
//  - Keeps going (at half speed) while today's 50 run. Waits while Google Drive can't be reached, while the computer is busy
//    or on low battery, and gives a search site an hour's rest if it asks "are you a robot".
//  - Looks for new photos every hour (this and last quarter's folders), every folder once a week
//    (on a weekday, 8 AM to 6 PM, when the office computers are on).
//  - Reads who is behind new sites.
const api = globalThis.browser || globalThis.chrome;
const $ = id => document.getElementById(id);
// 4.42: jobs = the one-photo searches running now (at most 2: one with Google, and Yandex and Bing
// on another photo while Google is still busy). lastG / lastF = when Google / Yandex and Bing last
// started a photo. bgSkip = the photos a big search is doing (Keep searching leaves them alone).
// 4.50: this pinned tab is in the background, where the browser slows its timers (to once a
// minute after 5 minutes hidden), so the speed ladder's short gaps came late. Its waits come from a
// worker's clock instead (timer-worker.js, the same one a running search uses).
const RCLOCK = (() => {
  let w = null, n = 0;
  const cbs = new Map();
  try { w = new Worker('timer-worker.js'); w.onmessage = e => { const c = cbs.get(e.data.id); if (c) { if (c.once) cbs.delete(e.data.id); c.fn(); } }; } catch (e) { w = null; }
  return {
    after(ms, fn) { if (!w) return setTimeout(fn, ms); const id = 'w' + (++n); cbs.set(id, { fn, once: true }); w.postMessage({ type: 'after', id, ms }); return id; },
    every(ms, fn) { if (!w) return setInterval(fn, ms); const id = 'w' + (++n); cbs.set(id, { fn }); w.postMessage({ type: 'every', id, ms }); return id; },
    cancel(id) { if (typeof id === 'string' && w) { cbs.delete(id); w.postMessage({ type: 'cancel', id }); } else { clearTimeout(id); clearInterval(id); } },
  };
})();
const S = { me: null, jobs: [], lastG: 0, lastF: 0, bgSkip: new Set(), skip: new Set(), win: null, cpu: null, busyTicks: 0, ticking: false, allowAsked: 0 };
const NAMES = { google: 'Google', yandex: 'Yandex', bing: 'Bing' };
const MY_VER = api.runtime.getManifest().version;
// Is this tab running old code? After an update (or Reload) this page can keep the old version, or
// lose its link to PageProof altogether. Then it loads itself again, which gives it the new code.
let reloading = false;
async function stale() {
  if (reloading) return true;
  let now = '';
  try {
    if (!api.runtime || !api.runtime.id) throw new Error('cut off');
    now = (await api.storage.local.get('ppRunVer')).ppRunVer || '';
  } catch (e) { reloading = true; location.reload(); return true; }
  if (!now || now === MY_VER) return false;
  reloading = true;
  try { await stopJob('PageProof was updated'); } catch (e) { /* closed */ }
  location.reload();
  return true;
}
const time = t => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const secText = sec => sec >= 120 ? Math.round(sec / 60) + ' minutes' : sec >= 60 && sec % 60 === 0 ? (sec / 60) + (sec === 60 ? ' minute' : ' minutes') : sec + ' seconds';

// The account details reader (main PageProof page, 4.30.2) says how far it is in fcAcctRead.
function acctLine() {
  const a = S.acct;
  if (!a || Date.now() - (a.beat || 0) > 10 * 60000 || !a.total) return '';
  if (a.state === 'reading' || a.state === 'resting') return ' Reading account details ' + Math.min(a.done + 1, a.total) + ' of ' + a.total + '.';
  if (a.state === 'held' && a.why === 'site' && a.sites && a.sites.length) return ' Account details: ' + a.sites.map(x => x === 'x' ? 'X' : x).join(', ') + ' showed empty pages, so ' + (a.sites.length > 1 ? 'they are' : 'it is') + ' left alone until ' + time(a.until) + '.';
  return '';
}
// How PageProof is doing: what stopped Keep searching (counted each time it starts waiting).
const PAUSES = ['paused', 'fifty', 'offline', 'allow', 'busy', 'resting', 'setup'];
async function status(state, text, extra = {}) {
  if (state !== S.statState) { if (PAUSES.includes(state)) PP_STATS.add('keep.pause.' + state); S.statState = state; }
  S.lastText = text; S.lastExtra = extra;
  if (state !== 'paused' && state !== 'off') text += acctLine();
  const st = { state, text, beat: Date.now(), win: S.win, tabId: S.me, jobTab: S.jobs[0] ? S.jobs[0].tab : null, jobs: S.jobs.length, ver: MY_VER, ...extra };
  S.lastSt = st;
  await api.storage.local.set({ fcStatus: st });
  const LABEL = { running: ['Searching', 'ok'], waiting: ['Resting', 'ok'], off: ['Off', 'grey'], paused: ['Paused', 'grey'], hours: ['Outside your hours', 'grey'], fifty: ['Big search running', 'ok'],
    offline: ['Google Drive offline', 'bad'], allow: ['Needs one click', 'warn'], busy: ['Computer busy', 'warn'], resting: ['Search sites resting', 'warn'], setup: ['Not set up', 'warn'], idle: ['Nothing due', 'ok'] };
  const [l, c] = LABEL[state] || ['Working', 'grey'];
  $('state').textContent = l; $('state').className = 'tag ' + c;
  $('text').textContent = text;
  $('now').hidden = !extra.current;
  if (extra.current) { $('nowName').textContent = extra.current.name; $('nowSub').textContent = extra.current.sub || ''; $('nowImg').src = extra.current.thumb || 'icons/icon48.png'; }
  $('pause').textContent = state === 'paused' ? 'Resume' : 'Pause';
}

// Is the computer busy? (ui/hardware.js) Keep searching waits until it calms down.
const computerBusy = () => ppBusy(S);

// Today's 50 (or another big Drive search) is running: it says so every 20 seconds and says
// "finished" at the end. 5 minutes of silence also counts as finished (its page was closed), so a
// slow moment on a busy computer no longer lets Keep searching start in the middle of it.
const fiftyRunning = f => !!(f && f.beat && f.running !== false && Date.now() - f.beat < 5 * 60000);
const inHours = (k, d) => FC.inHours(k, d);

// 4.30.2 (Ben): Pause stops everything at once. The one-photo search closes with its search site
// tabs, a big search (today's 50, New search...) stops and closes its tabs too, and the account
// details reader closes its tab (ui/fc-social.js). Nothing is lost: the photo that was being
// searched is still due, and the big search keeps the photos it finished and carries on with the
// rest after Resume.
async function pauseAll() {
  // The photo that was being searched goes back in line (first after Resume).
  for (const j of S.jobs) S.skip.delete(j.photoId);
  await stopJob('paused');
  await bgHold();
}
async function bgHold() {
  if (!BG.id) return;
  const id = BG.id, text = BG.text;
  if (BG.frame) BG.frame.remove();
  Object.assign(BG, { id: null, frame: null, text: '' });
  $('big').hidden = true;
  try {
    const all = await api.storage.local.get(null);
    for (const [k, v] of Object.entries(all)) if (k.startsWith('rsTabL:') && v === id) { await api.tabs.remove(+k.slice(7)).catch(() => {}); await api.storage.local.remove(k); }
  } catch (e) { /* nothing marked */ }
  S.held = { id, text };
  await api.storage.local.set({ fcFifty: { id, beat: 0, running: false } }).catch(() => {});
}
async function pausedText(tally) {
  const waiting = (await bgList()).length;
  const big = S.held && S.held.text ? ' The big search stopped at ' + S.held.text + ' and carries on from there.' : waiting ? ' ' + waiting + (waiting === 1 ? ' big search waits' : ' big searches wait') + ' too.' : '';
  return 'Paused. Nothing is searched or checked, and no tabs open, until you press Resume. Then it picks up where it stopped.' + big + ' ' + tally + '.';
}

// Stops one running photo search (only), or all of them.
async function stopJob(why, only) {
  const list = only ? [only] : S.jobs.slice();
  S.jobs = S.jobs.filter(j => !list.includes(j));
  for (const j of list) {
    if (j.tab) { try { await api.tabs.remove(j.tab); } catch (e) { /* closed */ } }
    // Its search site tabs too (closing the photo's page does not close them).
    try {
      const all = await api.storage.local.get(null);
      for (const [k, v] of Object.entries(all)) if (k.startsWith('rsTabL:') && v === j.id) { await api.tabs.remove(+k.slice(7)).catch(() => {}); await api.storage.local.remove(k); }
    } catch (e) { /* nothing marked */ }
  }
  if (why && list.length) console.info('PageProof Keep searching:', why);
}
const firstCurrent = () => (S.jobs[0] && S.jobs[0].current) || null;
// What is running, in a sentence.
function runningText(tally) {
  const big = BG.id ? ' A big search runs alongside' + (BG.text ? ' (' + BG.text + ')' : '') + ', so Keep searching goes at half speed.' : '';
  if (S.jobs.length > 1) return 'Searching 2 photos: ' + S.jobs.map(j => j.current.name + ' on ' + j.engines.map(e => NAMES[e]).join(' and ')).join(', ') + '. ' + tally + '.' + big;
  return 'Searching one photo. ' + tally + '.' + big;
}

// Housekeeping that only needs doing now and then.
async function chores() {
  const m = await FC.meta.get('chores') || {};
  const now = Date.now(), d = new Date();
  const ch = { ...m };
  try {
    // Once a week (Monday to Friday, 8 AM to 6 PM, when the computers are on): read every folder.
    // Otherwise every hour: this and last quarter's folders.
    const workTime = d.getDay() >= 1 && d.getDay() <= 5 && d.getHours() >= 8 && d.getHours() < 18;
    // Setup has just read every folder, so the first weekly check is a week after the first run.
    if (!m.full) ch.full = now;
    else if (workTime && now - m.full > 6.5 * 86400000) {
      await status('running', 'Reading every folder in Google Drive for new photos (weekly check)…');
      const r = await FC.scan({ full: true, background: true }); if (!r.busy && !r.state) ch.full = now;
      await FC.applyPendingFlags();
    } else if (now - (m.quick || 0) > 3600000) {
      const r = await FC.scan({ full: false, background: true }); if (!r.busy && !r.state) ch.quick = now;
    }
    // 4.42: new client folders (the top two levels of folder names only), once a week.
    if (workTime && now - (m.watch || 0) > 6.5 * 86400000) {
      await FC.watchFolders(); ch.watch = now;
    }
    // 4.43: weak Maybes nobody answered in 30 days put themselves away (once a day).
    if (typeof FC_RULES !== 'undefined' && now - (m.weak || 0) > 20 * 3600000) { await FC_RULES.tidyWeak(); ch.weak = now; }
    // 4.43: a sweep of a Stolen site, one small step at a time (about 20 seconds at most).
    if (typeof FC_RULES !== 'undefined') await FC_RULES.sweepStep().catch(e => console.warn('PageProof sweep:', e));
    // New tools (Ben's picks): a credit line search and the watch list, one small step at a time,
    // only while Keep searching is on and in your hours. Not waited for: a slow Google page must never
    // hold up the Keep searching tab (PP_WATCH.step skips itself while the last one is still going).
    if (typeof PP_WATCH !== 'undefined' && (await FC.quietOK()).ok) PP_WATCH.step().catch(e => console.warn('PageProof watch:', e));
    // Who's behind new sites: one site at a time, only sites with copies you still care about.
    if (now - (m.owner || 0) > 120000) {
      ch.owner = now;
      const known = new Set((await FC.DB.all('sites')).map(f => f.site));
      const want = (await FC.allCopies()).find(c => c.status !== 'removed' && !known.has(c.site));
      if (want) await FC.lookup(want.site, want.url);
    }
  } catch (e) { console.warn('PageProof chores', e); }
  await FC.meta.set('chores', ch);
}

async function tick() {
  if (S.ticking) return;
  if (await stale()) return;
  S.ticking = true;
  try { await step(); } catch (e) { console.warn('PageProof Keep searching', e); await status('waiting', 'Something went wrong. Trying again in a minute.'); } finally { S.ticking = false; }
}
async function step() {
  const k = await FC.keep();
  const st = await api.storage.local.get(['fcPause', 'fcFifty', 'fcToday']);
  const today = st.fcToday && st.fcToday.day === new Date().toDateString() ? st.fcToday : { searched: 0, found: 0 };
  const tally = today.searched + ' photos searched today' + (today.found ? ', ' + today.found + ' new copies' : '');
  if (st.fcPause) { await pauseAll(); return status('paused', await pausedText(tally)); }
  S.held = null;
  if (!k.on) {
    await stopJob();
    if (BG.id) return status('fifty', 'A big search is running in this tab' + (BG.text ? ' (' + BG.text + ')' : '') + '. You can leave this tab and carry on working.');
    return status('off', 'Keep searching is off. Turn it on in Find copies › Keep searching.');
  }
  // 4.42 one search line (Ben's pick): a big search (today's 50, New search, photos you picked)
  // no longer stops Keep searching. Both run; Keep searching goes at half speed meanwhile, and
  // skips the photos the big search is doing.
  const big = !!BG.id || fiftyRunning(st.fcFifty);
  // A search that runs over 12 minutes is stopped (its photo stays due).
  for (const j of S.jobs.slice()) if (Date.now() - j.started > 12 * 60000) await stopJob('took too long', j);
  const hw = await ppHardware();
  const most = big || (hw.limits.tabs || 1) < 2 ? 1 : 2;
  if (S.jobs.length >= most) return status('running', runningText(tally), { current: firstCurrent() });
  if (!inHours(k)) return status(S.jobs.length ? 'running' : 'hours', S.jobs.length ? runningText(tally) : 'Waiting for your hours (' + (k.hours === 'all' ? 'all day' : (k.from ?? 8) + ':00 to ' + (k.to ?? 18) + ':00' + (k.weekdays !== false ? ', weekdays' : '')) + '). ' + tally + '.', { current: firstCurrent() });
  const ds = await FC.driveState(true);
  if (ds === 'none') return status('setup', 'Connect your photos first: open Find copies and follow the 4 steps.');
  if (ds === 'prompt') {
    if (Date.now() - S.allowAsked > 3 * 3600000 && api.notifications) {
      S.allowAsked = Date.now();
      api.notifications.create('fcAllow', { type: 'basic', iconUrl: api.runtime.getURL('icons/icon128.png'), title: 'PageProof needs one click', message: 'Your browser asks once after it restarts. Click here, then Allow, and Keep searching carries on.', priority: 1 });
    }
    return status('allow', 'Your browser needs one click to let PageProof read the photos again (it asks after every restart). Open Find copies and press Allow.');
  }
  if (ds === 'offline') { await api.storage.local.set({ fcDriveOffline: Date.now() }); return status('offline', 'Can\'t reach Google Drive, so searching is paused. Nothing is lost: it picks up where it left off.'); }
  const was = (await api.storage.local.get('fcDriveOffline')).fcDriveOffline;
  if (was) await api.storage.local.set({ fcDriveOffline: 0, fcDriveBack: Date.now() });
  if (!S.jobs.length) await chores();
  const busy = await computerBusy();
  if (busy) return status(S.jobs.length ? 'running' : 'busy', S.jobs.length ? runningText(tally) : busy + ', so PageProof is waiting. It carries on when the computer calms down.', { current: firstCurrent() });
  const rest = await RS_JOB.resting();
  const s = await RS_JOB.settings();
  const on = RS_JOB.ENGINES.filter(e => s.engines[e]);
  const broken = await FC.brokenEngines();
  const restingNow = on.filter(e => rest[e] || broken[e]);
  const restText = restingNow.map(e => NAMES[e] + (broken[e] ? ' looks broken and is resting until ' + time(broken[e]) : ' is resting until ' + time(rest[e]))).join('. ');
  if (on.length && restingNow.length === on.length && !S.jobs.length) return status('resting', restText + '. A search site rests for an hour after an "are you a robot" check (PageProof never tries to get past it), and for 6 hours if it stops giving results.');
  // The pace: minutes between photos (never faster than this computer allows), or the pace the
  // goal needs (4.42). Half speed while a big search runs.
  const order = ['Gentle', 'Steady', 'Faster'];
  const pace = order[Math.min(order.indexOf(k.pace), order.indexOf(hw.limits.pace))] || 'Steady';
  let gapMin = FC.PACE[pace], why = pace + ' pace';
  if (k.goal) {
    try {
      const cov = await FC.coverage();
      const g = FC.goalPlan(k, cov.first.never, hw.limits.pace);
      if (g && !g.done) { gapMin = g.gap; why = 'pace for your goal'; }
    } catch (e) { console.warn('PageProof Keep searching goal:', e); }
  }
  // Speed-ups: per-site lanes. Google keeps the pace; Yandex and Bing get a photo every half
  // pace. The speed ladder (Ben's pick, on Faster) makes both lanes faster after every calm hour
  // and slower after a robot check (FC.ladder).
  let gapG = gapMin * 60000, gapF = (on.includes('google') ? gapMin / 2 : gapMin) * 60000, lad = null;
  if (k.ladder !== false && pace === 'Faster' && gapMin <= FC.PACE.Faster) {
    lad = await FC.ladder(k);
    gapG = lad.gSec * 1000; gapF = (on.includes('google') ? lad.fSec / 2 : lad.fSec) * 1000;
    why = 'speed step ' + (lad.g.step + 1) + ' of ' + (lad.top + 1) + ', 1 photo every ' + secText(lad.gSec);
  }
  if (big) { gapG *= 2; gapF *= 2; why += ', half speed during the big search'; }
  const ladExtra = lad ? { ladder: { g: lad.g.step, f: lad.f.step, top: lad.top, gSec: lad.gSec, fSec: lad.fSec, cap: lad.g.cap } } : {};
  const usable = on.filter(e => !rest[e] && !broken[e]);
  const busyE = new Set(S.jobs.flatMap(j => j.engines));
  const g = usable.includes('google'), fastE = usable.filter(e => e !== 'google');
  const now = Date.now();
  const gAt = S.lastG + gapG, fAt = S.lastF + gapF;
  const gReady = g && !busyE.has('google') && now >= gAt;
  const fReady = fastE.length > 0 && !fastE.some(e => busyE.has(e)) && now >= fAt;
  // The Google lane takes the next photo in line. The Yandex and Bing lane (Speed-ups, Ben's
  // pick) gives never-searched photos a quick look, in the same order, then re-searches.
  const skip = new Set([...S.skip, ...S.bgSkip, ...S.jobs.map(j => j.photoId)]);
  let lane = null, p = null;
  if (gReady) { [p] = await FC.next(1, skip); if (p) lane = 'google'; }
  if (!lane && fReady && (most > 1 || !S.jobs.length)) { [p] = await FC.next(1, skip, { quick: true, high: !g }); if (p) lane = 'fast'; }
  if (!lane) {
    if (S.jobs.length) return status('running', runningText(tally), { current: firstCurrent(), ...ladExtra });
    if ((gReady || !g) && (fReady || !fastE.length)) return status('idle', 'Every photo is up to date. PageProof looks again every hour. ' + tally + '.', ladExtra);
    const at = Math.max(now + 1000, Math.min(g ? gAt : Infinity, fastE.length ? fAt : Infinity));
    // The ladder's short gaps (20 to 60 seconds) are shorter than the 30-second check: wake up on time.
    RCLOCK.cancel(S.wake); if (at - now < 30000) S.wake = RCLOCK.after(at - now + 200, tick);
    return status('waiting', 'Next photo at ' + time(at) + ' (' + why + '). ' + tally + '.' + (restText ? ' ' + restText + '.' : ''), { nextAt: at, ...ladExtra });
  }
  S.skip.add(p.id);
  const pic = await FC.readPhoto(p, { burst: true });
  if (pic.error) {
    // Could not be opened: it goes on the Skipped photos list (with the reason) and the line moves on.
    // A burst frame that waits behind its twin goes straight on to the next photo.
    if (pic.burst) return RCLOCK.after(1500, tick);
    return status(S.jobs.length ? 'running' : 'waiting', pic.soft ? 'Google Drive did not hand over ' + p.name + '. It is tried again later.' : 'Skipped ' + p.name + '. See why in Find copies › Skipped photos.', { current: firstCurrent() });
  }
  // Pause pressed while the photo was being read: it is not searched (and stays due).
  if ((await api.storage.local.get('fcPause')).fcPause) { S.skip.delete(p.id); return; }
  // Which sites: the Yandex and Bing lane uses those two. The Google lane adds them when they are
  // free, unless they gave this never-searched photo a quick look in the last 60 days.
  const firstTime = !FC.searchedOnce(p);
  const looked = firstTime && p.quickAt && Date.now() - Date.parse(p.quickAt) < 60 * 864e5;
  const engines = lane === 'fast' ? fastE : ['google', ...(fReady && !looked ? fastE : [])];
  // Look-alike frames (Speed-ups, Ben's pick): frames from the same shoot that look almost the
  // same come along, and every link found is checked against them too.
  let alike = [];
  if (firstTime) {
    try { p.look = p.look || await FC.lookHash(pic.blob); alike = await FC.alikeFrames(p, p.look); } catch (e) { console.warn('PageProof look-alike frames:', e); }
  }
  const job = await RS_JOB.create([pic], { kind: 'keep', auto: true, engines, alike });
  if (!job) return status('resting', restText || 'No search sites are switched on. Tick them in Find copies › New search.');
  const j = { id: job.id, tab: null, started: Date.now(), photoId: p.id, engines: job.engines,
    current: { id: p.id, name: p.name, sub: (p.client || 'Client unknown') + ' · ' + (lane === 'fast' && firstTime ? 'quick look on ' : 'on ') + job.engines.map(e => NAMES[e]).join(', ') + (alike.length ? ' · with ' + alike.length + ' look-alike frame' + (alike.length > 1 ? 's' : '') : ''), thumb: pic.thumb } };
  S.jobs.push(j);
  if (job.engines.includes('google')) S.lastG = Date.now();
  if (job.engines.some(e => e !== 'google')) S.lastF = Date.now();
  if (typeof PP_STATS !== 'undefined') PP_STATS.add('keep.lane.' + (lane === 'fast' ? (firstTime ? 'quick' : 'fast') : job.engines.length > 1 ? 'all' : 'google'));
  // Pinned: a small icon at the left of the tab bar instead of a full tab.
  try { S.win = (await api.tabs.getCurrent()).windowId; } catch (e) { /* not in a tab */ }   // the tab may have been dragged to another window
  const opts = { windowId: S.win, url: api.runtime.getURL('revsearch.html?job=' + job.id), active: false };
  let t;
  try { t = await api.tabs.create({ ...opts, pinned: true }); } catch (e) { t = await api.tabs.create(opts); }
  j.tab = t.id;
  if ((await api.storage.local.get('fcPause')).fcPause) { await stopJob('paused'); return; }
  await status('running', runningText(tally), { current: firstCurrent(), ...ladExtra });
  // The other lane may be free straight away (Google busy, Yandex and Bing due).
  if (S.jobs.length < most) RCLOCK.after(3000, tick);
}

// ---------------------------------------------------------------- big searches (4.11, Ben)
// Searches you start yourself (New search, today's 50, photos picked in Your photos) run here, in a
// hidden frame, one at a time, in the order they were started. Nothing opens in front of you, and
// the page you started them from can be closed. All searches shows how far each one is.
const BG = { id: null, frame: null, since: 0, text: '' };
async function bgList() { return (await api.storage.local.get('fcBgJobs')).fcBgJobs || []; }
async function bgDrop(id) { const q = (await bgList()).filter(x => x !== id); await api.storage.local.set({ fcBgJobs: q }); }
function bgDone() {
  if (BG.frame) BG.frame.remove();
  const id = BG.id;
  Object.assign(BG, { id: null, frame: null, text: '' });
  S.bgSkip = new Set();
  $('big').hidden = true;
  api.storage.local.set({ fcFifty: { id, beat: 0, running: false } }).catch(() => {});
  FC.backupCopiesSoon();
  bgDrop(id).then(() => RCLOCK.after(2000, () => { bgNext(); tick(); }));
}
let bgBusy = false;
async function bgNext() {
  if (bgBusy || reloading) return;
  if ((await api.storage.local.get('fcPause')).fcPause) return;
  bgBusy = true;
  try {
    await fiftyWanted();
    if (BG.id) return;
    for (const id of await bgList()) {
      const job = await RS_DB.get('jobs', id).catch(() => null);
      // Deleted, or already finished (its frame said so just before a reload): off the list.
      if (!job || (job.finished && job.pics.every(p => p.ingested || !job.engines.some(e => p.runs[e].state === 'done')))) { await bgDrop(id); continue; }
      // 4.42: Keep searching carries on (at half speed) and leaves this search's photos alone.
      S.bgSkip = new Set(job.pics.map(p => p.fcId).filter(Boolean));
      if ((await api.storage.local.get('fcPause')).fcPause) return;
      Object.assign(BG, { id, since: Date.now(), text: '' });
      const f = document.createElement('iframe');
      f.src = 'revsearch.html?job=' + encodeURIComponent(id) + '&bg=1';
      f.title = 'Big search'; f.style.display = 'none';
      document.body.append(f); BG.frame = f;
      bgShow(job);
      setTimeout(tick, 1000);
      return;
    }
    closeIfIdle();
  } finally { bgBusy = false; }
}
// The card shows how far the big search is.
async function bgShow(job) {
  if (!BG.id) return;
  job = job || await RS_DB.get('jobs', BG.id).catch(() => null);
  if (!job) return;
  const done = job.pics.filter(p => Object.values(p.runs).every(r => !['wait', 'go', 'captcha'].includes(r.state))).length;
  const check = job.pics.some(p => Object.values(p.runs).some(r => r.state === 'captcha'));
  BG.text = done + ' of ' + job.pics.length + ' photos done';
  $('big').hidden = false;
  $('bigText').textContent = (job.kind === 'fifty' ? 'Today\'s ' + job.pics.length : 'A search of ' + job.pics.length + (job.pics.length === 1 ? ' photo' : ' photos')) + ': ' + BG.text + (check ? '. A search site wants a quick check (see the notice, or All searches).' : '.');
  $('bigBar').style.width = Math.round(done / Math.max(1, job.pics.length) * 100) + '%';
  // A search that finished but never said so (for example its last photo could not be added):
  // after 10 minutes it is let go, so the line never gets stuck. A search you stopped is let go
  // after 3 minutes (Ben: his next search sat "waiting for the pinned tab" behind a stopped one
  // that was still checking links). Links not checked by then are checked when you open it.
  // Another search waiting in line is let through after 3 minutes too.
  const hold = job.stoppedAt || (job.finished && (await bgList()).some(x => x !== job.id)) ? 3 : 10;
  if (job.finished && Date.now() - Date.parse(job.finished) > hold * 60000) bgDone();
}
// Keep searching switched off and no big search left: this tab is not needed.
async function closeIfIdle() {
  if (BG.id || (await bgList()).length || (await api.storage.local.get('fcFiftyWant')).fcFiftyWant) return;
  const k = await FC.keep();
  if (!k.on) window.close();
}
// Today's 50 at the time you picked: the background asks this tab to start it, so no PageProof
// page has to open (4.11). Needs Google Drive's OK (once after each browser restart).
async function fiftyWanted() {
  const w = (await api.storage.local.get('fcFiftyWant')).fcFiftyWant;
  if (!w) return;
  if (Date.now() - w > 12 * 3600000) { await api.storage.local.remove('fcFiftyWant'); return; }
  const ds = await FC.driveState(true);
  if (ds !== 'granted') {
    if (ds === 'prompt' && Date.now() - S.allowAsked > 3 * 3600000 && api.notifications) {
      S.allowAsked = Date.now();
      api.notifications.create('fcAllow', { type: 'basic', iconUrl: api.runtime.getURL('icons/icon128.png'), title: 'Today\'s 50 is waiting for one click', message: 'Your browser asks once after it restarts. Click here, then Allow, and today\'s 50 starts by itself.', priority: 1 });
    }
    return;
  }
  await api.storage.local.remove('fcFiftyWant');
  const k = await FC.keep();
  const n = Math.min(k.perDay, 100);
  await status('running', 'Getting today\'s ' + n + ' photos ready from Google Drive…');
  const ps = await FC.next(n + 10, new Set(), { first: k.fiftyWhich === 'first', hold: true });
  const pics = [];
  for (const p of ps) {
    if (pics.length >= n) break;
    const pic = await FC.readPhoto(p);
    if (!pic.error) pics.push(pic);
  }
  if (!pics.length) { await api.storage.local.remove('fcHold').catch(() => {}); return; }
  const job = await RS_JOB.create(pics, { kind: 'fifty' });
  api.storage.local.remove('fcHold').catch(() => {});
  if (job) await RS_JOB.queue(job.id);
}

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const done = msg && msg.type === 'fcAutoDone' && S.jobs.find(j => j.id === msg.job);
  if (done) {
    S.jobs = S.jobs.filter(j => j !== done); RCLOCK.after(2000, tick);
    // The search tab closes straight away, so this window writes the text copy of the finds
    // (Documents › PageProof › found-copies.txt).
    FC.backupCopiesSoon();
  }
  if (msg && msg.type === 'fcBgDone' && msg.job === BG.id) bgDone();
  if (msg && msg.type === 'fcRunnerPing') { sendResponse({ ok: true, win: S.win, ver: MY_VER, tab: S.me }); return false; }
  return false;
});
api.tabs.onRemoved.addListener(id => { S.jobs = S.jobs.filter(j => j.tab !== id); });
api.storage.onChanged.addListener(ch => {
  // Flags, priority clients or folders changed: work out the line again.
  if (ch.fcQueueDirty) { FC.resetQueue(); S.skip = new Set(S.jobs.map(j => j.photoId)); }
  if (ch.fcKeep && ch.fcKeep.newValue && !ch.fcKeep.newValue.on) { stopJob().finally(closeIfIdle); return; }
  if (ch.fcBgJobs || ch.fcFiftyWant) bgNext();
  // Pause: stop at once (even in the middle of a step). Resume: carry on straight away.
  if (ch.fcPause) {
    if (ch.fcPause.newValue) pauseAll().then(async () => { const t = (await api.storage.local.get('fcToday')).fcToday; const n = t && t.day === new Date().toDateString() ? t.searched : 0; status('paused', await pausedText(n + ' photos searched today')); });
    else { S.held = null; bgNext(); }
  }
  if (ch.fcAcctRead) { S.acct = ch.fcAcctRead.newValue; if (S.lastSt && !S.ticking) status(S.lastSt.state, S.lastText, S.lastExtra || {}); }
  if (ch.fcKeep || ch.fcPause) tick();
});
// Every hour the line is worked out again from scratch.
// The "every photo once" count is redone too, so Home and the client-finished note stay fresh.
setInterval(() => { FC.resetQueue(); S.skip = new Set(S.jobs.map(j => j.photoId)); FC.coverage().catch(() => {}); }, 3600000);
$('pause').onclick = async () => {
  const p = (await api.storage.local.get('fcPause')).fcPause;
  await api.storage.local.set({ fcPause: p ? 0 : Date.now() });
};
$('open').onclick = e => { e.preventDefault(); api.tabs.create({ url: api.runtime.getURL('app.html#keep') }); };

(async () => {
  // Only one Keep searching window at a time: if another one holds the lock, this one closes.
  if (navigator.locks) {
    const hold = opts => new Promise(res => navigator.locks.request('pageproof-keep-searching', opts, lock => { res(!!lock); return lock ? new Promise(() => {}) : null; }));
    let mine = await hold({ ifAvailable: true });
    if (!mine) {
      // Another Keep searching tab has it. If that one answers and runs this same version, it
      // carries on and this one closes. If it is silent or on an old version (left over from
      // before an update), this one takes over.
      const other = await Promise.race([api.runtime.sendMessage({ type: 'fcRunnerPing' }).catch(() => null), new Promise(r => setTimeout(() => r(null), 3000))]);
      if (other && other.ok && other.ver === MY_VER) { window.close(); return; }
      mine = await hold({ steal: true });
    }
  }
  try { const me = await api.tabs.getCurrent(); S.win = me.windowId; S.me = me.id; } catch (e) { /* not in a tab */ }
  // Close any other Keep searching tab (an old one from before an update).
  try { const me = api.runtime.getURL('runner.html'); const others = (await api.tabs.query({})).filter(t => t.id !== S.me && (t.url || '').startsWith(me)); if (others.length) { await api.storage.local.set({ ppRunnerQuit: Date.now() }); await new Promise(r => setTimeout(r, 300)); } for (const t of others) if (t.id !== S.me && (t.url || '').startsWith(me)) api.tabs.remove(t.id).catch(() => {}); } catch (e) { /* no tab list */ }
  if (!(await api.storage.local.get('ppRunVer')).ppRunVer) await api.storage.local.set({ ppRunVer: MY_VER });
  await RS_LISTS.load().catch(() => {});
  S.acct = (await api.storage.local.get('fcAcctRead')).fcAcctRead || null;
  FC.movePics().catch(() => {});
  // 4.15: closing this tab asks first ("Leave site?"). The browser only shows that box after
  // someone has clicked in the tab. PageProof itself closing or reloading it never asks.
  // 4.30.2: the browser only shows "Leave site?" after someone clicked in the tab, and logs an error
  // (shown on edge://extensions) when a page asks without that click. So it only asks after one.
  const clicked = () => !navigator.userActivation || navigator.userActivation.hasBeenActive;
  addEventListener('beforeunload', e => { if (!reloading && !S.quit && clicked()) { e.preventDefault(); e.returnValue = ''; } });
  api.storage.onChanged.addListener(ch => { if (ch.ppRunnerQuit) S.quit = true; });
  tick();
  RCLOCK.every(30000, tick);
  bgNext();
  RCLOCK.every(10000, () => { if (BG.id) bgShow(); else bgNext(); });
  // "Still here", every 30 seconds, even in the middle of a long job (the weekly read of every
  // folder can take many minutes). Without it the background thought this window had closed and
  // kept opening a new one, which closed itself again straight away, about once a minute.
  setInterval(() => { if (S.lastSt) api.storage.local.set({ fcStatus: { ...S.lastSt, beat: Date.now() } }).catch(() => {}); }, 30000);
  // One minute at a time, what Keep searching was doing (How PageProof is doing › Keep searching).
  setInterval(() => { if (S.lastSt && !reloading) PP_STATS.minute(S.lastSt.state); }, 60000);
  // The weekly stats file (Friday at 5:30 PM, or the next time this tab runs after that).
  setInterval(() => { if (typeof PP_REPORT !== 'undefined') PP_REPORT.weeklyMaybe().catch(() => {}); }, 15 * 60000);
  setTimeout(() => { if (typeof PP_REPORT !== 'undefined') PP_REPORT.weeklyMaybe().catch(() => {}); }, 90000);
})();
