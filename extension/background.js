// PageProof background script: runs the capture when you click the toolbar icon.
if (typeof PP_DB === 'undefined' && typeof importScripts === 'function') importScripts('db.js');

const api = globalThis.browser || globalThis.chrome;
const MAX_PAGE_SHOTS = 60;     // stop after this many screens on very long pages
const MAX_SECTION_SHOTS = 40;  // per scrollable section
const SETTLE_MS = 350;         // wait for things to draw after each scroll
const MIN_GAP_MS = 600;        // browsers allow only ~2 screenshots per second

const sleep = ms => new Promise(r => setTimeout(r, ms));
let busy = false;
let stopRequested = false;
let lastShot = 0;

async function inPage(tabId, name, ...args) {
  const [res] = await api.scripting.executeScript({
    target: { tabId },
    func: (name, args) => window.__pageproof[name](...args),
    args: [name, args]
  });
  return res ? res.result : undefined;
}

async function shoot(windowId) {
  const wait = lastShot + MIN_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastShot = Date.now();
  return api.tabs.captureVisibleTab(windowId, { format: 'png' });
}

function progress(text) {
  if (stopRequested) return;
  api.action.setBadgeBackgroundColor({ color: '#2563eb' });
  api.action.setBadgeText({ text });
}

// Ask the website's server for the page again, to record the server's own
// details (address, clock, response headers) and the page source exactly as sent.
async function serverCheck(url) {
  const out = { requestedAt: new Date().toISOString() };
  let ip = null;
  const onDone = d => { if (d.tabId === -1 && d.ip) ip = d.ip; };
  try { api.webRequest.onCompleted.addListener(onDone, { urls: ['<all_urls>'] }); } catch (e) { /* not available */ }
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20000);
    const res = await fetch(url, { credentials: 'include', cache: 'no-store', redirect: 'follow', signal: ctl.signal });
    clearTimeout(timer);
    out.status = res.status + ' ' + res.statusText;
    out.finalUrl = res.url;
    out.headers = [...res.headers.entries()];
    const buf = new Uint8Array(await res.arrayBuffer());
    out.source = buf.length <= 30e6 ? buf : null;
    out.sourceBytes = buf.length;
  } catch (e) {
    out.error = String((e && e.message) || e);
  } finally {
    await sleep(200);
    try { api.webRequest.onCompleted.removeListener(onDone); } catch (e) { /* ignore */ }
  }
  out.ip = ip;
  return out;
}

async function addLog(entry) {
  const { log = [] } = await api.storage.local.get('log');
  log.push(entry);
  await api.storage.local.set({ log });
}

async function capture(tab, auto) {
  const tabId = tab.id;
  const windowId = tab.windowId;
  await api.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  // Open shortened post descriptions, and give the site's opening animation time to finish.
  let expanded = await inPage(tabId, 'expandMore');
  if (expanded) await sleep(1500);
  const lifted = await inPage(tabId, 'unclamp');
  if (lifted) { expanded += lifted; await sleep(400); }
  const info = await inPage(tabId, 'prepare', true);

  const record = {
    id: 'cap-' + Date.now(),
    captureId: 'PP-' + [...crypto.getRandomValues(new Uint8Array(6))].map(b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join(''),
    url: info.url,
    title: info.title,
    time: new Date().toISOString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    viewHeight: info.viewHeight,
    userAgent: info.userAgent,
    version: api.runtime.getManifest().version,
    viewWidth: info.viewWidth,
    innerWidth: info.innerWidth,
    html: info.html,
    main: { width: info.viewWidth, height: 0, tiles: [], background: info.background },
    sections: [],
    notes: []
  };

  if (expanded) record.notes.push('PageProof clicked "more" to show the full post description.');
  if (info.single) record.notes.push('This page shows one post per screen (like Instagram Reels), so only the post on screen was captured, not the ones after it.');

  const server = serverCheck(info.url);

  try {
    // 1) The main page, one screen at a time, starting from the very top.
    let y = 0, prevNext = -1;
    for (let i = 0; i < MAX_PAGE_SHOTS; i++) {
      progress(String(i + 1));
      const at = await inPage(tabId, 'scrollPage', y);
      await sleep(i === 0 ? SETTLE_MS * 2 : SETTLE_MS);
      // Some sites (like Google) only make their top bar "stick" after you scroll, so check again before every later screen.
      if (i > 0) await inPage(tabId, 'hideFixed');
      const shot = await shoot(windowId);
      record.main.tiles.push({ src: shot, crop: at.crop, destX: at.crop.x, destY: at.destY });
      record.main.height = Math.max(record.main.height, at.total, at.destY + at.crop.h);
      if (i === 0) await inPage(tabId, 'hideFixed');
      if (at.grew && !record.notes.some(n => n.includes('kept loading'))) record.notes.push('This page kept loading more content as it scrolled (endless scrolling), so the capture stopped where the page ended when you clicked.');
      if (stopRequested || at.done || at.next <= prevNext) break;
      prevNext = at.next;
      y = at.next;
      if (i === MAX_PAGE_SHOTS - 1) record.notes.push('This page was very long, so the capture stops after ' + MAX_PAGE_SHOTS + ' screens.');
    }
    await sleep(400);
    if (!record.notes.some(n => n.includes('kept loading')) && await inPage(tabId, 'grewNow')) record.notes.push('This page kept loading more content as it scrolled (endless scrolling), so the capture stopped where the page ended when you clicked.');
    record.main.height = Math.min(record.main.height, Math.max(...record.main.tiles.map(t => t.destY + t.crop.h)));

    // 2) Extra sections: scroll boxes and dropdown lists.
    await inPage(tabId, 'removeBadges');
    for (const s of info.sections) {
      if (stopRequested) break;
      progress('S' + s.n);
      const sec = { n: s.n, kind: s.kind, label: s.label, axes: s.axes, width: 0, height: 0, tiles: [] };
      const add = (shot, at, x, y) => {
        sec.tiles.push({ src: shot, crop: at.crop, destX: x, destY: y });
        sec.width = Math.max(sec.width, x + at.crop.w);
        sec.height = Math.max(sec.height, y + at.crop.h);
      };

      if (s.kind === 'select') {
        sec.options = s.options;
        record.sections.push(sec);
        continue;
      }

      if (s.kind === 'scroll') {
        // Scroll down row by row, and across each row for sideways boxes.
        let top = 0, shots = 0;
        rows: for (;;) {
          let left = 0, at = null;
          for (;;) {
            if (stopRequested || shots++ >= MAX_SECTION_SHOTS) break rows;
            at = await inPage(tabId, 'scrollSection', s.n, left, top, shots === 1);
            if (!at) break rows;
            await sleep(SETTLE_MS);
            add(await shoot(windowId), at, at.contentX, at.contentY);
            if (at.scrollLeft >= at.maxX - 1) break;
            left = at.scrollLeft + at.crop.w;
          }
          if (at.scrollTop >= at.maxY - 1) break;
          top = at.scrollTop + at.crop.h;
        }
      }

      if (sec.tiles.length) record.sections.push(sec);
    }
    if (stopRequested) record.notes.push('You stopped this capture early, so it holds only what was captured up to that point.');
  } finally {
    await inPage(tabId, 'restore').catch(() => {});
  }

  record.server = await server;
  await PP_DB.put(record);
  await addLog({ id: record.id, captureId: record.captureId, time: record.time, url: record.url, title: record.title });
  const q = new URLSearchParams({ id: record.id, ...(auto || {}) });
  await api.tabs.create({ url: api.runtime.getURL('viewer.html?' + q), index: tab.index + 1, windowId: tab.windowId, active: !auto });
  return record.id;
}

function requestStop() {
  // Stopping a capture keeps what was captured so far.
  stopRequested = true;
  api.action.setBadgeBackgroundColor({ color: '#e11d48' });
  api.action.setBadgeText({ text: 'STOP' });
}

async function startCapture(tab) {
  if (busy) return requestStop();
  busy = true;
  stopRequested = false;
  try {
    await capture(tab);
  } catch (err) {
    const msg = String((err && err.message) || err);
    await api.tabs.create({ url: api.runtime.getURL('viewer.html?error=' + encodeURIComponent(msg)) });
  } finally {
    busy = false;
    stopRequested = false;
    api.action.setBadgeText({ text: '' });
  }
}

// The keyboard shortcut (Alt+Shift+P) captures straight away, without the menu.
try {
  api.commands.onCommand.addListener(async cmd => {
    if (cmd !== 'capture-page') return;
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (tab) startCapture(tab);
  });
} catch (e) { /* no shortcuts */ }

// ---------- Image Inspector ----------
// Save the picture list and open the Inspector page next to the website's tab.
async function openInspector(rec, tab) {
  const id = 'insp-' + Date.now();
  await PP_DB.put({ id, time: new Date().toISOString(), ...rec });
  const keys = (await PP_DB.keys()).filter(k => String(k).startsWith('insp-')).sort();
  for (const k of keys.slice(0, -20)) await PP_DB.del(k);
  const opts = { url: api.runtime.getURL('inspect.html?id=' + id) };
  if (tab) { opts.index = tab.index + 1; opts.windowId = tab.windowId; }
  await api.tabs.create(opts);
}

async function inPicker(tabId, fn) {
  await api.scripting.executeScript({ target: { tabId }, files: ['picker.js'] });
  const [res] = await api.scripting.executeScript({ target: { tabId }, func: fn });
  return res ? res.result : undefined;
}

// Messages from the icon menu and the picture picker.
api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return false;
  const jobs = {
    status: async () => ({ busy }),
    stop: async () => { if (busy) requestStop(); return { ok: true }; },
    captureTab: async () => { startCapture(await api.tabs.get(msg.tabId)); return { ok: true }; },
    pick: async () => { await inPicker(msg.tabId, () => window.__ppPick.start()); return { ok: true }; },
    inspectAll: async () => {
      const tab = await api.tabs.get(msg.tabId);
      const found = await inPicker(msg.tabId, () => window.__ppPick.all());
      await openInspector({ mode: 'all', ...found }, tab);
      return { ok: true };
    },
    inspect: async () => { await openInspector({ mode: 'one', page: msg.page, title: msg.title, items: msg.items }, sender.tab); return { ok: true }; }
  };
  const job = jobs[msg.type];
  if (!job) return false;
  job().catch(err => ({ ok: false, error: String((err && err.message) || err) })).then(sendResponse);
  return true;
});

// Batch capture: the batch page asks for one tab to be captured at a time.
api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'capture') return false;
  (async () => {
    if (busy) return { ok: false, error: 'another capture is still running' };
    busy = true;
    stopRequested = false;
    try {
      const tab = await api.tabs.get(msg.tabId);
      const id = await capture(tab, msg.auto);
      return { ok: true, id };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    } finally {
      busy = false;
      api.action.setBadgeText({ text: '' });
    }
  })().then(sendResponse);
  return true;
});

// Right-click the PageProof icon for its other pages.
const MENU = { batch: ['Batch capture (many links)...', 'batch.html'], log: ['Capture log', 'log.html'], verify: ['Verify a pack', 'verify.html'] };
api.runtime.onInstalled.addListener(() => {
  try {
    api.contextMenus.removeAll(() => {
      for (const [id, [title]] of Object.entries(MENU)) api.contextMenus.create({ id, title, contexts: ['action'] });
      api.contextMenus.create({ id: 'inspectImage', title: 'Inspect with PageProof', contexts: ['image'] });
    });
  } catch (e) { /* menus not available */ }
});
try {
  api.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'inspectImage') {
      let src = info.srcUrl;
      // Pictures that only exist inside the page must be read there.
      if (src && src.startsWith('blob:') && tab) {
        try {
          const [r] = await api.scripting.executeScript({ target: { tabId: tab.id }, args: [src], func: async u => {
            const b = await (await fetch(u)).blob();
            return new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });
          } });
          if (r && r.result) src = r.result;
        } catch (e) { /* keep the blob address */ }
      }
      let item = { src };
      if (tab && !src.startsWith('data:')) {
        try {
          await api.scripting.executeScript({ target: { tabId: tab.id }, files: ['picker.js'] });
          const [r] = await api.scripting.executeScript({ target: { tabId: tab.id }, args: [src], func: u => window.__ppPick.bestFor(u) });
          if (r && r.result) item = { ...r.result, src };
        } catch (e) { /* use the address as it is */ }
      }
      return openInspector({ mode: 'one', page: info.pageUrl, title: tab ? tab.title : '', items: [item] }, tab);
    }
    const m = MENU[info.menuItemId];
    if (m) api.tabs.create({ url: api.runtime.getURL(m[1]) });
  });
} catch (e) { /* menus not available */ }
