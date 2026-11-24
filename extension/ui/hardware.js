// How strong is this computer? PageProof reads the processor and memory and picks a level,
// so photo checks and search tabs never slow the computer down. Used by the pages and the background.
//
// The level only sets how much work PageProof does ON THIS COMPUTER at once (photo checks,
// pictures downloaded and opened, search tabs open). It never makes the search sites get asked
// faster than the chosen search speed allows: that is limited on purpose so they don't show
// "are you a robot" checks, and PageProof never tries to get past one.
//   checks: photo checks at a time (one background worker each)
//   tabs:   search tabs open at once (all sites together; each tab costs 150-300 MB)
//   dl:     found pictures downloaded at once (waiting on the internet costs almost nothing)
//   decode: found pictures opened at once (a big picture takes 50-100 MB for a moment)
//   pace:   fastest Keep searching pace allowed
const PP_HW_LIMITS = {
  Light:  { checks: 1, tabs: 1, dl: 3, decode: 1, pace: 'Gentle', ram: 'up to 300 MB', fifty: 'about 45 minutes' },
  Normal: { checks: 2, tabs: 2, dl: 5, decode: 2, pace: 'Steady', ram: 'up to 600 MB', fifty: 'about 25 minutes' },
  Strong: { checks: 4, tabs: 3, dl: 8, decode: 3, pace: 'Faster', ram: 'up to 1 GB',   fifty: 'about 15 minutes' },
};
// The limits for this exact computer. A Strong computer with lots of cores and memory gets more
// photo checks (up to 6), and photo checks never go above "cores minus one", even if someone
// picks Strong by hand on a small computer, so one core is always left for the person's work.
function ppHwLimits(level, cores, memGB) {
  const L = { ...(PP_HW_LIMITS[level] || PP_HW_LIMITS.Normal) };
  if (level === 'Strong' && cores >= 12 && memGB >= 16) { L.checks = Math.min(6, Math.floor(cores / 2)); L.dl = L.checks + 4; L.ram = 'up to 1.5 GB'; L.fifty = 'about 10 minutes'; }
  L.checks = Math.max(1, Math.min(L.checks, cores - 1));
  L.decode = Math.min(L.decode, L.checks + 1);
  L.dl = Math.max(L.dl, L.checks + 1);
  return L;
}
async function ppHardware() {
  const api = globalThis.browser || globalThis.chrome;
  const nav = globalThis.navigator || {};
  let cores = nav.hardwareConcurrency || 4;
  let memGB = nav.deviceMemory || 0;          // the browser rounds this and stops at 8
  let freeGB = null;
  try { if (api.system && api.system.cpu) cores = (await api.system.cpu.getInfo()).numOfProcessors || cores; } catch (e) { /* not allowed */ }
  try {
    if (api.system && api.system.memory) {
      const m = await api.system.memory.getInfo();
      memGB = Math.round(m.capacity / 1073741824);
      freeGB = Math.round(m.availableCapacity / 1073741824 * 10) / 10;
    }
  } catch (e) { /* not allowed */ }
  if (!memGB) memGB = 8;
  const ua = nav.userAgent || '';
  const system = /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows PC' : /CrOS/.test(ua) ? 'Chromebook' : 'Linux PC';
  const auto = cores >= 8 && memGB >= 8 ? 'Strong' : cores >= 4 && memGB >= 4 ? 'Normal' : 'Light';
  let choice = 'auto';
  try { choice = ((await api.storage.local.get('ppHw')).ppHw || {}).choice || 'auto'; } catch (e) { /* default */ }
  const level = choice === 'auto' ? auto : choice;
  return { cores, memGB, freeGB, system, auto, choice, level, limits: ppHwLimits(level, cores, memGB) };
}

// Is the computer busy right now? Call it about every 30 seconds with the same state object.
// Busy = processor over 80% for about a minute, less than 10% of the memory free, or a laptop on
// battery below 30%. Returns the reason in plain words, or '' when the computer is fine.
// Keep searching waits while it is busy; a big search (today's 50, a 100-photo search) slows
// down to one photo check and one search tab instead, so it still finishes.
async function ppBusy(state) {
  const api = globalThis.browser || globalThis.chrome;
  try {
    if (api.system && api.system.cpu) {
      const info = await api.system.cpu.getInfo();
      const t = info.processors.reduce((a, p) => ({ busy: a.busy + p.usage.user + p.usage.kernel, total: a.total + p.usage.total }), { busy: 0, total: 0 });
      if (state.cpu) {
        const use = (t.busy - state.cpu.busy) / Math.max(1, t.total - state.cpu.total);
        state.busyTicks = use > 0.8 ? (state.busyTicks || 0) + 1 : 0;
      }
      state.cpu = t;
      if (state.busyTicks >= 2) return 'The processor has been very busy for a minute';
    }
  } catch (e) { /* not allowed */ }
  try {
    if (api.system && api.system.memory) {
      const m = await api.system.memory.getInfo();
      if (m.availableCapacity / m.capacity < 0.1) return 'Almost all of the memory is in use';
    }
  } catch (e) { /* not allowed */ }
  try {
    if (globalThis.navigator && navigator.getBattery) {
      const b = await navigator.getBattery();
      if (!b.charging && b.level < 0.3) return 'The laptop is on battery below 30%';
    }
  } catch (e) { /* no battery info */ }
  return '';
}
