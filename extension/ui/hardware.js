// How strong is this computer? PageProof reads the processor and memory and picks a level,
// so photo checks and search tabs never slow the computer down. Used by the pages and the background.
const PP_HW_LIMITS = {
  Light:  { checks: 1, tabs: 1, pace: 'Gentle', ram: 'up to 300 MB', fifty: 'about 45 minutes' },
  Normal: { checks: 2, tabs: 2, pace: 'Steady', ram: 'up to 600 MB', fifty: 'about 25 minutes' },
  Strong: { checks: 4, tabs: 3, pace: 'Faster', ram: 'up to 1 GB',   fifty: 'about 15 minutes' },
};
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
  return { cores, memGB, freeGB, system, auto, choice, level, limits: PP_HW_LIMITS[level] };
}
