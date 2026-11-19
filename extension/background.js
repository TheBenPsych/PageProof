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
    showDownload: async () => { try { await api.downloads.show(msg.id); } catch (e) { /* file moved */ } return { ok: true }; },
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
// Right-click on a website: the browser groups these under its own "PageProof" entry.
const WEB = ['page', 'selection', 'link', 'image', 'video', 'audio', 'frame', 'editable'];
api.runtime.onInstalled.addListener(() => {
  try {
    api.contextMenus.removeAll(() => {
      for (const [id, [title]] of Object.entries(MENU)) api.contextMenus.create({ id, title, contexts: ['action'] });
      api.contextMenus.create({ id: 'inspectImage', title: 'Inspect picture', contexts: WEB });
      api.contextMenus.create({ id: 'jpgImage', title: 'Save picture as JPG', contexts: WEB });
      api.contextMenus.create({ id: 'openImage', title: 'Open picture in new tab', contexts: WEB });
      api.contextMenus.create({ id: 'webSep', type: 'separator', contexts: WEB });
      api.contextMenus.create({ id: 'savePage', title: 'Save page as evidence', contexts: WEB });
    });
  } catch (e) { /* menus not available */ }
});

// Run a small job inside the frame that was right-clicked.
async function inFrame(tab, frameId, files, func, args = []) {
  const target = { tabId: tab.id, frameIds: [frameId || 0] };
  if (files) await api.scripting.executeScript({ target, files });
  if (!func) return undefined;
  const [r] = await api.scripting.executeScript({ target, func, args });
  return r ? r.result : undefined;
}
const note = (tab, frameId, o) => inFrame(tab, 0, ['rclick.js'], o2 => window.__ppRC.toast(o2), [o]).catch(() => {});

// Which picture was right-clicked? Either the browser tells us (a normal picture), or we look
// under the spot that was clicked (pictures hidden under a see-through cover, like Instagram).
async function rightClickedPicture(info, tab) {
  const frameId = info.frameId || 0;
  if (info.mediaType === 'image' && info.srcUrl) {
    let src = info.srcUrl;
    if (src.startsWith('blob:')) {
      try {
        const r = await inFrame(tab, frameId, null, async u => {
          const b = await (await fetch(u)).blob();
          return new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });
        }, [src]);
        if (r) src = r;
      } catch (e) { /* keep the blob address */ }
    }
    let item = { src };
    if (!src.startsWith('data:')) {
      try {
        const r = await inFrame(tab, frameId, ['picker.js'], u => window.__ppPick.bestFor(u), [src]);
        if (r) item = { ...r, src };
      } catch (e) { /* use the address as it is */ }
    }
    return { item };
  }
  try {
    return await inFrame(tab, frameId, ['rclick.js', 'picker.js'], async () => {
      const p = window.__ppRC.point();
      if (!p) return { error: 'nopoint' };
      const item = await window.__ppPick.under(p.x, p.y);
      return item ? { item } : { error: 'none' };
    }) || { error: 'none' };
  } catch (e) {
    return { error: 'blocked' };
  }
}

const NO_PICTURE = {
  none: ['No picture found here', 'Right-click right on top of the picture and try again.'],
  nopoint: ['Please reload this page once', 'PageProof was just installed or updated, so it missed your right-click. Reload the page (F5), then right-click the picture again.'],
  blocked: ['PageProof can\'t reach this page', 'Browsers don\'t let extensions work on some pages (like the Chrome Web Store or the browser\'s own pages).']
};

// Get a picture's file. The extension can usually download it directly; if the website refuses,
// ask the page itself (it is already allowed to see its own pictures).
async function pictureFile(url, tab, frameId) {
  try {
    const r = await fetch(url, { credentials: 'include' });
    if (r.ok) { const b = await r.blob(); if (b.size) return b; }
  } catch (e) { /* try from the page */ }
  const dataUrl = await inFrame(tab, frameId, null, async u => {
    try {
      const b = await (await fetch(u)).blob();
      return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });
    } catch (e) { return ''; }
  }, [url]).catch(() => '');
  if (!dataUrl) throw new Error('The website would not let PageProof download this picture.');
  return await (await fetch(dataUrl)).blob();
}

const blobToDataUrl = b => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b); });

// A short, safe file name: website_picturename.jpg
function jpgName(url, page) {
  let host = '', base = '';
  try { host = new URL(page).hostname.replace(/^www\./, ''); } catch (e) { /* none */ }
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') base = decodeURIComponent(u.pathname.split('/').pop() || '');
  } catch (e) { /* none */ }
  base = base.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[^\w\-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '_');
  return ((host || 'picture') + '_' + (base || 'picture-' + stamp)).replace(/[^\w.\-]+/g, '_') + '.jpg';
}

async function saveAsJpg(item, info, tab) {
  const frameId = info.frameId || 0;
  const url = item.best || item.src;
  const blob = await pictureFile(url, tab, frameId);
  let bmp;
  try { bmp = await createImageBitmap(blob); } catch (e) { throw new Error('This picture is in a format PageProof can\'t turn into a JPG (' + (blob.type || 'unknown type') + ').'); }
  const { width: w, height: h } = bmp;
  const was = (blob.type.split('/')[1] || 'picture').replace('jpeg', 'jpg').replace('svg+xml', 'svg').toUpperCase();
  let jpg = blob;
  if (blob.type !== 'image/jpeg') {
    // See-through parts become white, like a printed page.
    const c = new OffscreenCanvas(w, h), g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(bmp, 0, 0);
    jpg = await c.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
  }
  // A small preview for the note in the corner.
  const tw = 128, th = Math.max(1, Math.round(h * tw / w));
  const tc = new OffscreenCanvas(tw, th), tg = tc.getContext('2d');
  tg.fillStyle = '#fff'; tg.fillRect(0, 0, tw, th); tg.drawImage(bmp, 0, 0, tw, th);
  const thumb = await blobToDataUrl(await tc.convertToBlob({ type: 'image/jpeg', quality: 0.7 }));
  bmp.close && bmp.close();

  const filename = jpgName(url, info.pageUrl || tab.url);
  const href = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(jpg) : await blobToDataUrl(jpg);
  const id = await api.downloads.download({ url: href, filename, conflictAction: 'uniquify', saveAs: false });
  if (href.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(href), 120000);
  const kb = jpg.size >= 1048576 ? (jpg.size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(jpg.size / 1024)) + ' KB';
  note(tab, frameId, {
    kind: 'ok', title: '✓ Saved as JPG', thumb,
    lines: [filename, `${w} × ${h} · ${kb} · in your Downloads folder`, blob.type === 'image/jpeg' ? 'It was already a JPG, so it was saved untouched.' : `Turned from ${was} into JPG.`],
    links: [{ label: 'Show in folder', msg: { type: 'showDownload', id } },
      { label: 'Inspect it', msg: { type: 'inspect', page: info.pageUrl || tab.url, title: tab.title, items: [item] } }]
  });
}

try {
  api.contextMenus.onClicked.addListener(async (info, tab) => {
    const id = info.menuItemId;
    if (id === 'savePage') {
      if (!tab) return;
      if (busy) return note(tab, 0, { kind: 'bad', title: 'A capture is already running', lines: ['Wait for it to finish, or click the PageProof icon to stop it.'] });
      return startCapture(tab);
    }
    if (id === 'inspectImage' || id === 'jpgImage' || id === 'openImage') {
      if (!tab) return;
      const found = await rightClickedPicture(info, tab);
      if (!found.item) {
        const [t, l] = NO_PICTURE[found.error] || NO_PICTURE.none;
        return note(tab, info.frameId, { kind: 'bad', title: t, lines: [l] });
      }
      const item = found.item;
      if (id === 'inspectImage') return openInspector({ mode: 'one', page: info.pageUrl, title: tab.title, items: [item] }, tab);
      if (id === 'openImage') {
        const url = item.best || item.src;
        if (url.startsWith('blob:')) return openInspector({ mode: 'one', page: info.pageUrl, title: tab.title, items: [item] }, tab);
        return api.tabs.create({ url, index: tab.index + 1, windowId: tab.windowId, openerTabId: tab.id });
      }
      try { await saveAsJpg(item, info, tab); } catch (err) {
        note(tab, info.frameId, { kind: 'bad', title: 'Could not save as JPG', lines: [String((err && err.message) || err), 'You can still use Inspect picture, or the browser\'s own "Save image as...".'] });
      }
      return;
    }
    const m = MENU[id];
    if (m) api.tabs.create({ url: api.runtime.getURL(m[1]) });
  });
} catch (e) { /* menus not available */ }
