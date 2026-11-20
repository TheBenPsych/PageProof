// Keep searching: searches the photos in the shared Google Drive one at a time, all day, in this
// small window (it can be minimised). The background opens it when Keep searching is on.
//  - Rests between photos (the pace), only in the hours you picked.
//  - Waits while today's 50 run, while Google Drive can't be reached, while the computer is busy
//    or on low battery, and gives a search site an hour's rest if it asks "are you a robot".
//  - Looks for new photos every hour (this and last quarter's folders), every folder once a week
//    (on a weekday, 8 AM to 6 PM, when the office computers are on).
//  - Checks once a week that copies marked Stolen are still online, and reads who is behind new sites.
const api = globalThis.browser || globalThis.chrome;
const $ = id => document.getElementById(id);
const S = { job: null, tab: null, started: 0, last: 0, skip: new Set(), win: null, cpu: null, busyTicks: 0, ticking: false, allowAsked: 0 };
const NAMES = { google: 'Google', yandex: 'Yandex', bing: 'Bing' };
const time = t => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

async function status(state, text, extra = {}) {
  const st = { state, text, beat: Date.now(), win: S.win, ...extra };
  await api.storage.local.set({ fcStatus: st });
  const LABEL = { running: ['Searching', 'ok'], waiting: ['Resting', 'ok'], off: ['Off', 'grey'], paused: ['Paused', 'grey'], hours: ['Outside your hours', 'grey'], fifty: ['Paused for today\'s 50', 'warn'],
    offline: ['Google Drive offline', 'bad'], allow: ['Needs one click', 'warn'], busy: ['Computer busy', 'warn'], resting: ['Search sites resting', 'warn'], setup: ['Not set up', 'warn'], idle: ['Nothing due', 'ok'] };
  const [l, c] = LABEL[state] || ['Working', 'grey'];
  $('state').textContent = l; $('state').className = 'tag ' + c;
  $('text').textContent = text;
  $('now').hidden = !extra.current;
  if (extra.current) { $('nowName').textContent = extra.current.name; $('nowSub').textContent = extra.current.sub || ''; $('nowImg').src = extra.current.thumb || 'icons/icon48.png'; }
  $('pause').textContent = state === 'paused' ? 'Resume' : 'Pause';
}

// Is the computer busy? Processor over 80% for about a minute, memory nearly full, or a laptop
// on battery below 30%.
async function computerBusy() {
  try {
    if (api.system && api.system.cpu) {
      const info = await api.system.cpu.getInfo();
      const t = info.processors.reduce((a, p) => ({ busy: a.busy + p.usage.user + p.usage.kernel, total: a.total + p.usage.total }), { busy: 0, total: 0 });
      if (S.cpu) {
        const use = (t.busy - S.cpu.busy) / Math.max(1, t.total - S.cpu.total);
        S.busyTicks = use > 0.8 ? S.busyTicks + 1 : 0;
      }
      S.cpu = t;
      if (S.busyTicks >= 2) return 'The processor has been very busy for a minute';
    }
  } catch (e) { /* not allowed */ }
  try {
    if (api.system && api.system.memory) {
      const m = await api.system.memory.getInfo();
      if (m.availableCapacity / m.capacity < 0.1) return 'Almost all of the memory is in use';
    }
  } catch (e) { /* not allowed */ }
  try {
    if (navigator.getBattery) {
      const b = await navigator.getBattery();
      if (!b.charging && b.level < 0.3) return 'The laptop is on battery below 30%';
    }
  } catch (e) { /* no battery info */ }
  return '';
}

function inHours(k, d = new Date()) {
  if (k.hours === 'all') return true;
  const day = d.getDay(), hr = d.getHours() + d.getMinutes() / 60;
  if (k.weekdays !== false && (day === 0 || day === 6)) return false;
  return hr >= (k.from ?? 8) && hr < (k.to ?? 18);
}

async function stopJob(why) {
  if (S.tab) { try { await api.tabs.remove(S.tab); } catch (e) { /* closed */ } }
  S.job = null; S.tab = null;
  if (why) console.info('PageProof Keep searching:', why);
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
    // Once a week: are the copies marked Stolen still online? A few at a time.
    if (now - (m.online || 0) > 7 * 86400000) {
      const due = (await FC.DB.by('copies', 'status', 'stolen')).filter(c => !c.checked || now - Date.parse(c.checked) > 6.5 * 86400000);
      for (const c of due.slice(0, 5)) await FC.checkOnline(c);
      if (due.length <= 5) ch.online = now;
    }
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
  S.ticking = true;
  try { await step(); } catch (e) { console.warn('PageProof Keep searching', e); await status('waiting', 'Something went wrong. Trying again in a minute.'); } finally { S.ticking = false; }
}
async function step() {
  const k = await FC.keep();
  const st = await api.storage.local.get(['fcPause', 'fcFifty', 'fcToday']);
  const today = st.fcToday && st.fcToday.day === new Date().toDateString() ? st.fcToday : { searched: 0, found: 0 };
  const tally = today.searched + ' photos searched today' + (today.found ? ', ' + today.found + ' new copies' : '');
  if (!k.on) { await stopJob(); return status('off', 'Keep searching is off. Turn it on in Find copies › Keep searching.'); }
  if (st.fcPause) { await stopJob(); return status('paused', 'Paused. Press Resume and it picks up with the next photo. ' + tally + '.'); }
  // A search is running: wait for it (at most 12 minutes).
  if (S.job) {
    if (Date.now() - S.started > 12 * 60000) await stopJob('took too long');
    else return status('running', 'Searching one photo. ' + tally + '.', { current: S.current });
  }
  if (!inHours(k)) return status('hours', 'Waiting for your hours (' + (k.hours === 'all' ? 'all day' : (k.from ?? 8) + ':00 to ' + (k.to ?? 18) + ':00' + (k.weekdays !== false ? ', weekdays' : '')) + '). ' + tally + '.');
  if (st.fcFifty && Date.now() - st.fcFifty.beat < 60000) return status('fifty', 'Today\'s 50 are running. Keep searching carries on by itself when they finish.');
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
  await chores();
  const busy = await computerBusy();
  if (busy) return status('busy', busy + ', so PageProof is waiting. It carries on when the computer calms down.');
  const rest = await RS_JOB.resting();
  const s = await RS_JOB.settings();
  const on = RS_JOB.ENGINES.filter(e => s.engines[e]);
  const restingNow = on.filter(e => rest[e]);
  const restText = restingNow.map(e => NAMES[e] + ' is resting until ' + time(rest[e])).join('. ');
  if (on.length && restingNow.length === on.length) return status('resting', restText + '. Search sites rest for an hour after an "are you a robot" check. PageProof never tries to get past it.');
  // The pace: minutes between photos (never faster than this computer allows).
  const hw = await ppHardware();
  const order = ['Gentle', 'Steady', 'Faster'];
  const pace = order[Math.min(order.indexOf(k.pace), order.indexOf(hw.limits.pace))] || 'Steady';
  const gap = FC.PACE[pace] * 60000;
  const wait = S.last + gap - Date.now();
  if (wait > 0) return status('waiting', 'Next photo at ' + time(Date.now() + wait) + ' (' + pace + ' pace). ' + tally + '.' + (restText ? ' ' + restText + '.' : ''), { nextAt: Date.now() + wait });
  // The next photo in line.
  const [p] = await FC.next(1, S.skip);
  if (!p) return status('idle', 'Every photo is up to date. PageProof looks again every hour. ' + tally + '.');
  S.skip.add(p.id);
  let pic;
  try {
    pic = await RS_JOB.prepare(await FC.fileFor(p), { fcId: p.id, folderKey: p.rel });
  } catch (e) { pic = { error: String(e && e.message || e) }; }
  if (pic.error) {
    // Unreadable (deleted, or not a real photo): note it so it doesn't hold up the line.
    p.unreadable = pic.error; p.lastSearched = new Date().toISOString(); p.searches = (p.searches || 0) + 1;
    await FC.DB.put('photos', p); FC.queueDirty();
    return status('waiting', 'Skipped ' + p.name + ': it could not be opened.');
  }
  const job = await RS_JOB.create([pic], { kind: 'keep', auto: true });
  if (!job) return status('resting', restText || 'No search sites are switched on. Tick them in Find copies › New search.');
  S.job = job.id; S.started = Date.now(); S.last = Date.now();
  S.current = { id: p.id, name: p.name, sub: (p.client || 'Client unknown') + ' · on ' + job.engines.map(e => NAMES[e]).join(', '), thumb: pic.thumb };
  const t = await api.tabs.create({ windowId: S.win, url: api.runtime.getURL('revsearch.html?job=' + job.id), active: false });
  S.tab = t.id;
  await status('running', 'Searching one photo. ' + tally + '.', { current: S.current });
}

api.runtime.onMessage.addListener(msg => {
  if (msg && msg.type === 'fcAutoDone' && msg.job === S.job) {
    S.job = null; S.tab = null; setTimeout(tick, 2000);
    // The search tab closes straight away, so this window writes the text copy of the finds
    // (Documents › PageProof › found-copies.txt).
    FC.backupCopiesSoon();
  }
  if (msg && msg.type === 'fcRunnerPing') return Promise.resolve({ ok: true, win: S.win });
  return false;
});
api.tabs.onRemoved.addListener(id => { if (id === S.tab) { S.job = null; S.tab = null; } });
api.storage.onChanged.addListener(ch => {
  // Flags, priority clients or folders changed: work out the line again.
  if (ch.fcQueueDirty) { FC.resetQueue(); S.skip = new Set(S.current && S.job ? [S.current.id] : []); }
  if (ch.fcKeep && ch.fcKeep.newValue && !ch.fcKeep.newValue.on) { stopJob().finally(() => window.close()); return; }
  if (ch.fcKeep || ch.fcPause) tick();
});
// Every hour the line is worked out again from scratch.
setInterval(() => { FC.resetQueue(); S.skip = new Set(S.current && S.job ? [S.current.id] : []); }, 3600000);
$('pause').onclick = async () => {
  const p = (await api.storage.local.get('fcPause')).fcPause;
  await api.storage.local.set({ fcPause: p ? 0 : Date.now() });
};
$('open').onclick = e => { e.preventDefault(); api.tabs.create({ url: api.runtime.getURL('app.html#keep') }); };

(async () => {
  // Only one Keep searching window at a time: if another one holds the lock, this one closes.
  if (navigator.locks) {
    const mine = await new Promise(res => navigator.locks.request('pageproof-keep-searching', { ifAvailable: true }, lock => { res(!!lock); return lock ? new Promise(() => {}) : null; }));
    if (!mine) { window.close(); return; }
  }
  try { const me = await api.tabs.getCurrent(); S.win = me.windowId; } catch (e) { /* not in a tab */ }
  await RS_LISTS.load().catch(() => {});
  tick();
  setInterval(tick, 30000);
})();
