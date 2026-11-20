// Making a reverse image search: getting photos ready and saving the search, so the results
// window (revsearch.html?job=…) can run it. Used by New search, today's 50, Keep searching and
// the right-click menu.
const RS_JOB = (() => {
  const api = globalThis.browser || globalThis.chrome;
  const ENGINES = ['google', 'yandex', 'bing'];

  // One photo, ready to search: a smaller copy for the search sites, a thumbnail, a fingerprint.
  async function prepare(file, extra) {
    let bmp;
    try { bmp = await createImageBitmap(file); } catch (e) { return { error: (file.name || 'A photo') + ' could not be opened (HEIC and TIFF photos need converting to JPG first, with Open files › Convert files)' }; }
    const w = bmp.width, hgt = bmp.height;
    let blob = file;
    const max = 2000;
    if (Math.max(w, hgt) > max || file.size > 4e6 || !/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      const f = Math.min(1, max / Math.max(w, hgt));
      const c = new OffscreenCanvas(Math.max(1, Math.round(w * f)), Math.max(1, Math.round(hgt * f)));
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
      blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
    }
    const tf = Math.min(1, 240 / Math.max(w, hgt));
    const tc = new OffscreenCanvas(Math.max(1, Math.round(w * tf)), Math.max(1, Math.round(hgt * tf)));
    tc.getContext('2d').drawImage(bmp, 0, 0, tc.width, tc.height);
    bmp.close && bmp.close();
    const tb = await tc.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
    const thumb = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(tb); });
    return { name: file.name || 'photo.jpg', size: file.size, w, h: hgt, hash: await RS_UTIL.sha256(file), blob, thumb, ...(extra || {}) };
  }

  async function settings() {
    const s = (await api.storage.local.get('rsSettings')).rsSettings || {};
    return { engines: { google: true, yandex: true, bing: true, ...(s.engines || {}) }, speed: ['careful', 'normal', 'quick'].includes(s.speed) ? s.speed : 'normal' };
  }
  // Engines resting after a robot check (Keep searching never tries to get past one).
  async function resting() {
    const r = (await api.storage.local.get('fcRest')).fcRest || {};
    const now = Date.now();
    return Object.fromEntries(Object.entries(r).filter(([, t]) => t > now));
  }

  // Save a search. opts: { kind: 'new' | 'fifty' | 'keep', engines, speed, auto }
  async function create(pics, opts = {}) {
    const s = await settings();
    let engines = opts.engines || ENGINES.filter(e => s.engines[e]);
    if (opts.kind === 'keep') { const r = await resting(); engines = engines.filter(e => !r[e]); }
    if (!engines.length) return null;
    const hw = typeof ppHardware === 'function' ? await ppHardware() : { limits: { tabs: 3, checks: 4 } };
    const job = {
      id: 'rs' + Date.now() + Math.random().toString(36).slice(2, 5), created: new Date().toISOString(), engines,
      speed: opts.speed || (opts.kind === 'keep' ? 'careful' : s.speed), closeTabs: true, kind: opts.kind || 'new', folder: opts.kind === 'fifty', auto: !!opts.auto, started: false,
      limits: { tabs: hw.limits.tabs, checks: hw.limits.checks },
      pics: pics.map((p, i) => ({ ...p, i, links: [], runs: Object.fromEntries(engines.map(e => [e, { state: 'wait' }])) })),
    };
    await RS_DB.put('jobs', job.id, job);
    try {
      const keys = (await RS_DB.keys('jobs')).sort();
      for (const k of keys.slice(0, Math.max(0, keys.length - 40))) await RS_DB.del('jobs', k);
    } catch (e) { /* ignore */ }
    return job;
  }
  // Show its results (where the searches run) inside the full PageProof page, as
  // app.html#results?job=ID. No separate window: from PageProof itself the page just switches;
  // from anywhere else a PageProof tab opens next to the tab you're in. The search tabs open as
  // small pinned tabs in that same browser window.
  async function open(job) {
    const hash = 'results?job=' + encodeURIComponent(job.id);
    try { if (/\/app\.html$/.test(window.top.location.pathname)) { window.top.location.hash = hash; return; } } catch (e) { /* not inside PageProof */ }
    const url = api.runtime.getURL('app.html#' + hash);
    let here = null;
    try { here = await api.tabs.getCurrent(); } catch (e) { /* not in a tab */ }
    try { await api.tabs.create(here ? { url, windowId: here.windowId, index: here.index + 1, active: true } : { url, active: true }); }
    catch (e) { await api.tabs.create({ url, active: true }); }
  }
  return { prepare, create, open, settings, resting, ENGINES };
})();
