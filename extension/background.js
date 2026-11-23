// PageProof background script: runs the capture when you click the toolbar icon.
if (typeof PP_DB === 'undefined' && typeof importScripts === 'function') importScripts('db.js');
// 4.8.2: the copy store, so the toolbar dot counts new copies the same way Copies found does.
if (typeof FC === 'undefined' && typeof importScripts === 'function') { try { importScripts('rs-store.js', 'social.js', 'fc-store.js'); } catch (e) { /* old count below */ } }

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

// The progress card is hidden for every screenshot, then shown again.
let ovTab = null;
async function shoot(windowId) {
  const wait = lastShot + MIN_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  if (ovTab) await inPage(ovTab, 'ovHide').catch(() => {});
  lastShot = Date.now();
  try { return await api.tabs.captureVisibleTab(windowId, { format: 'png' }); }
  finally { if (ovTab && ovStep) inPage(ovTab, 'ovShow', ovStep[0], ovStep[1]).catch(() => {}); }
}
let ovStep = null;

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
  ovTab = tabId; ovStep = null;

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
      ovStep = ['Screen ' + (i + 1) + '.', 'Step 1 of 3'];
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
      ovStep = ['Scroll box ' + s.n + ' of ' + info.sections.length + '.', 'Step 2 of 3'];
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
    ovTab = null; ovStep = null;
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
    newBadge();
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
  if (!msg || sender.id !== api.runtime.id) return false;
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
    rcMenu: async () => { showHiddenPictureItems(!!msg.pic); return { ok: true }; },
    showDownload: async () => { try { await api.downloads.show(msg.id); } catch (e) { /* file moved */ } return { ok: true }; },
    inspect: async () => { await openInspector({ mode: 'one', page: msg.page, title: msg.title, items: msg.items }, sender.tab); return { ok: true }; }
  };
  const job = jobs[msg.type];
  if (!job) return false;
  job().catch(err => ({ ok: false, error: String((err && err.message) || err) })).then(sendResponse);
  return true;
});

// Right-click the PageProof icon for its other pages.
// 4.5.1 (Ben): every item starts with a small symbol so it is easy to tell apart at a glance
// (Chrome and Edge do not allow a real icon on each menu item).
const MENU = { openApp: ['🏠 Open full PageProof', 'app.html#home'], found: ['🖼️ Copies found', 'app.html#found'], keep: ['🔄 Keep searching', 'app.html#keep'], library: ['📚 Evidence library', 'app.html#library'], verify: ['✅ Verify a pack', 'app.html#verify'] };
// Right-click on a website: the browser groups these under its own "PageProof" entry.
// Picture choices show only when there is a picture under the mouse:
//  - a normal picture: the browser knows ("image"), so the first set shows by itself;
//  - a picture hidden under a see-through cover (Instagram): rclick.js spots it the moment you
//    right-click and asks for the second set ("h_" ids) to be shown.
const NOT_IMG = ['page', 'selection', 'link', 'video', 'audio', 'frame', 'editable'];
const PIC_ITEMS = [['inspectImage', '🔬 Inspect this photo'], ['reverse', '🔍 Find copies of it'], ['jpgImage', '💾 Save biggest copy…'], ['bnSave', '📰 Save as Breaking News photo…'], ['openImage', '↗️ Open biggest copy in a tab']];
const REV_ITEMS = [['revGoogle', '🟢 Google Lens'], ['revYandex', '🔴 Yandex'], ['revBing', '🔵 Bing'], ['revAll', '🌐 All three']];
api.runtime.onInstalled.addListener(() => {
  try {
    api.contextMenus.removeAll(() => {
      for (const [id, [title]] of Object.entries(MENU)) api.contextMenus.create({ id, title, contexts: ['action'] });
      for (const [pre, contexts, visible] of [['', ['image'], true], ['h_', NOT_IMG, false]]) {
        for (const [id, title] of PIC_ITEMS) api.contextMenus.create({ id: pre + id, title, contexts, visible });
        for (const [id, title] of REV_ITEMS) api.contextMenus.create({ id: pre + id, parentId: pre + 'reverse', title, contexts });
        api.contextMenus.create({ id: pre + 'webSep', type: 'separator', contexts, visible });
      }
      api.contextMenus.create({ id: 'savePage', title: '📸 Capture this page', contexts: ['page', 'selection', 'video', 'audio', 'frame', 'editable', 'image'] });
      api.contextMenus.create({ id: 'saveLink', title: '🔗 Capture the linked page', contexts: ['link'] });
    });
  } catch (e) { /* menus not available */ }
});

function showHiddenPictureItems(show) {
  for (const id of ['inspectImage', 'reverse', 'jpgImage', 'bnSave', 'openImage', 'webSep']) {
    try { api.contextMenus.update('h_' + id, { visible: show }, () => void api.runtime.lastError); } catch (e) { /* old browser */ }
  }
  try { api.contextMenus.refresh && api.contextMenus.refresh(); } catch (e) { /* Chrome has no refresh */ }
}

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
    item.others = await inFrame(tab, frameId, ['picker.js'], (a, b) => window.__ppPick.variants([a, b].filter(Boolean)), [item.src, item.best || '']).catch(() => []) || [];
    return { item };
  }
  try {
    return await inFrame(tab, frameId, ['rclick.js', 'picker.js'], async () => {
      const p = window.__ppRC.point();
      if (!p) return { error: 'nopoint' };
      const item = await window.__ppPick.under(p.x, p.y);
      if (item) item.others = window.__ppPick.variants([item.src, item.best].filter(Boolean));
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

// The same picture is often on the page in several sizes. Download each one and keep the biggest.
// Download with a time limit, so one slow copy can't hold everything up.
async function quickFetch(url, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { credentials: 'include', signal: ctl.signal });
    if (!r.ok) throw new Error('no');
    return await r.blob();
  } finally { clearTimeout(t); }
}

async function largest(item, tab, frameId) {
  const first = [item.best, item.src].filter(Boolean);
  const urls = [...new Set([...first, ...(item.others || [])])].slice(0, 12);
  // Fetch all the copies at the same time.
  const got = await Promise.all(urls.map(async url => {
    const mine = first.includes(url);
    try {
      let blob;
      if (mine) {
        try { blob = await quickFetch(url, 8000); } catch (e) { blob = await pictureFile(url, tab, frameId); }
      } else blob = await quickFetch(url, 5000);
      const bmp = await createImageBitmap(blob);
      return { url, blob, bmp, mine, area: bmp.width * bmp.height, ratio: bmp.width / bmp.height };
    } catch (e) { return null; } // not a picture, too slow, or blocked: skip it
  }));
  const ok = got.filter(Boolean);
  const ref = ok.find(g => g.mine);
  // Only count other copies with the same shape, so a different picture with a similar name is never picked.
  const fits = ok.filter(g => g.mine || (ref && Math.abs(g.ratio - ref.ratio) / ref.ratio <= 0.03));
  let win = null;
  for (const g of fits) if (!win || g.area > win.area || (g.area === win.area && g.blob.size > win.blob.size)) win = g;
  for (const g of ok) if (g !== win && g.bmp.close) g.bmp.close();
  if (win) win.tried = fits.length;
  return win;
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

// Wait (up to 10 minutes, while you choose a name) until the download finishes or is cancelled.
function waitForDownload(id) {
  return new Promise(resolve => {
    let over = false;
    const finish = async () => {
      if (over) return;
      const [d] = await api.downloads.search({ id });
      if (!d || d.state === 'complete' || d.state === 'interrupted') { over = true; api.downloads.onChanged.removeListener(onCh); clearTimeout(t); resolve(d || null); }
    };
    const onCh = ch => { if (ch.id === id && ch.state) finish(); };
    const t = setTimeout(() => { over = true; api.downloads.onChanged.removeListener(onCh); resolve(null); }, 600000);
    api.downloads.onChanged.addListener(onCh);
    finish();
  });
}

async function saveAsJpg(item, info, tab, big) {
  const frameId = info.frameId || 0;
  if (!big) throw new Error('The website would not let PageProof download this picture.');
  const { url, blob, bmp } = big;
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
  // The Save As window opens so you can pick the folder and rename the file.
  let id;
  try { id = await api.downloads.download({ url: href, filename, conflictAction: 'uniquify', saveAs: true }); } catch (e) { return; /* you pressed Cancel */ }
  if (href.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(href), 600000);
  const done = await waitForDownload(id);
  if (!done || done.state !== 'complete') return; // cancelled in the Save As window
  const savedAs = (done.filename || filename).split(/[\\/]/).pop();
  const kb = jpg.size >= 1048576 ? (jpg.size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(jpg.size / 1024)) + ' KB';
  note(tab, frameId, {
    kind: 'ok', title: '✓ Saved as JPG', thumb,
    lines: [savedAs, `${w} × ${h} · ${kb}` + (big.tried > 1 ? ` · biggest of ${big.tried} copies on the page` : ''), blob.type === 'image/jpeg' ? 'It was already a JPG, so it was saved untouched.' : `Turned from ${was} into JPG.`],
    links: [{ label: 'Show in folder', msg: { type: 'showDownload', id } },
      { label: 'Inspect it', msg: { type: 'inspect', page: info.pageUrl || tab.url, title: tab.title, items: [item] } }]
  });
}

try {
  api.contextMenus.onClicked.addListener(async (info, tab) => {
    const id = String(info.menuItemId).replace(/^h_/, '');
    if (id === 'savePage') {
      if (!tab) return;
      if (busy) return note(tab, 0, { kind: 'bad', title: 'A capture is already running', lines: ['Wait for it to finish, or click the PageProof icon to stop it.'] });
      return startCapture(tab);
    }
    if (id === 'saveLink') {
      if (/^https?:\/\//i.test(info.linkUrl || '')) captureUrl(info.linkUrl, tab);
      return;
    }
    if (['inspectImage', 'jpgImage', 'bnSave', 'openImage', 'revGoogle', 'revYandex', 'revBing', 'revAll'].includes(id)) {
      if (!tab) return;
      const found = await rightClickedPicture(info, tab);
      if (!found.item) {
        const [t, l] = NO_PICTURE[found.error] || NO_PICTURE.none;
        return note(tab, info.frameId, { kind: 'bad', title: t, lines: [l] });
      }
      const item = found.item;
      // Show a note if finding the biggest copy takes more than a moment.
      const wait = setTimeout(() => note(tab, 0, { kind: 'ok', title: '⏳ Finding the biggest copy of this picture...', lines: ['This takes a few seconds on busy pages.'] }), 500);
      const big = await largest(item, tab, info.frameId || 0);
      clearTimeout(wait);
      if (id !== 'jpgImage') inFrame(tab, 0, null, () => window.__ppRC && window.__ppRC.hide()).catch(() => {});
      if (big && !big.url.startsWith('data:') && big.url !== item.src) item.best = big.url;
      delete item.others;
      if (big && id !== 'jpgImage' && big.bmp.close) big.bmp.close();
      if (id === 'inspectImage') return openInspector({ mode: 'one', page: info.pageUrl, title: tab.title, items: [item] }, tab);
      if (id === 'bnSave') return openBreakingNews(item, info, tab);
      if (id === 'openImage') {
        const url = item.best || item.src;
        if (url.startsWith('blob:')) return openInspector({ mode: 'one', page: info.pageUrl, title: tab.title, items: [item] }, tab);
        return api.tabs.create({ url, index: tab.index + 1, windowId: tab.windowId, openerTabId: tab.id });
      }
      if (id.startsWith('rev')) {
        // The search sites download the picture from its web address, so it needs a real one.
        const url = /^https?:/.test(item.best || '') ? item.best : item.src;
        if (!/^https?:/.test(url)) {
          return note(tab, 0, { kind: 'bad', title: 'This picture has no web address to search', lines: ['It only exists inside this page. Use Save biggest copy, then drop the file on New search in PageProof.'] });
        }
        const e = encodeURIComponent(url);
        const sites = { revGoogle: ['https://lens.google.com/uploadbyurl?url=' + e], revYandex: ['https://yandex.com/images/search?rpt=imageview&url=' + e],
          revBing: ['https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:' + e] };
        sites.revAll = [sites.revBing[0], sites.revYandex[0], sites.revGoogle[0]];
        for (const s2 of sites[id]) await api.tabs.create({ url: s2, index: tab.index + 1, windowId: tab.windowId, openerTabId: tab.id });
        return;
      }
      try { await saveAsJpg(item, info, tab, big); } catch (err) {
        note(tab, info.frameId, { kind: 'bad', title: 'Could not save the picture', lines: [String((err && err.message) || err), 'You can still use Inspect this photo, or the browser\'s own "Save image as...".'] });
      }
      return;
    }
    const m = MENU[id];
    if (m) api.tabs.create({ url: api.runtime.getURL(m[1]) });
  });
} catch (e) { /* menus not available */ }

// ---------- Save as Breaking News photo ----------
// Reads the article's date and the credit line under the picture, then opens PageProof's
// "Save a Breaking News photo" page, which names the file the firm's way and checks it first.
async function openBreakingNews(item, info, tab) {
  let facts = {};
  try {
    facts = await inFrame(tab, info.frameId || 0, null, src => {
      const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
      const key = (() => { try { return decodeURIComponent(new URL(src, location.href).pathname.split('/').pop() || '').toLowerCase(); } catch (e) { return ''; } })();
      const img = [...document.images].find(i => i.currentSrc === src || i.src === src) || (key.length > 4 ? [...document.images].find(i => (i.currentSrc || i.src || '').toLowerCase().includes(key)) : null);
      let credit = '';
      if (img) {
        const fig = img.closest('figure');
        const cands = [...(fig ? fig.querySelectorAll('figcaption, [class*="credit" i], [class*="caption" i]') : [])];
        let up = img.parentElement;
        for (let i = 0; up && i < 4; i++, up = up.parentElement) cands.push(...up.querySelectorAll('[class*="credit" i], [class*="caption" i], small, cite'));
        for (const c of cands) { const t = clean(c.textContent); if (t && t.length < 300 && /(photo|image|credit|courtesy|©)/i.test(t)) { credit = t; break; } }
        if (!credit && fig) { const fc = fig.querySelector('figcaption'); if (fc) credit = clean(fc.textContent).slice(0, 300); }
      }
      const meta = n => { const m = document.querySelector(`meta[property="${n}"], meta[name="${n}"], meta[itemprop="${n}"]`); return m ? m.getAttribute('content') || '' : ''; };
      let date = meta('article:published_time') || meta('datePublished') || meta('og:article:published_time') || meta('parsely-pub-date') || meta('pubdate') || '';
      if (!date) for (const s of document.querySelectorAll('script[type="application/ld+json"]')) { const m = /"datePublished"\s*:\s*"([^"]+)"/.exec(s.textContent || ''); if (m) { date = m[1]; break; } }
      if (!date) { const t = document.querySelector('time[datetime]'); if (t) date = t.getAttribute('datetime'); }
      if (!date) { const m = /\/(20\d\d)\/(\d{1,2})\/(\d{1,2})\//.exec(location.pathname); if (m) date = m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0'); }
      return { credit: credit.slice(0, 300), date, alt: img ? clean(img.alt).slice(0, 200) : '', headline: clean(meta('og:title') || document.title).slice(0, 200) };
    }, [item.src]) || {};
  } catch (e) { /* the page would not answer: the date and credit stay empty */ }
  await api.storage.local.set({ bnPending: { src: item.src, best: item.best || '', page: info.pageUrl || '', title: tab.title || '', at: new Date().toISOString(), ...facts } });
  inFrame(tab, 0, null, () => window.__ppRC && window.__ppRC.hide()).catch(() => {});
  return api.tabs.create({ url: api.runtime.getURL('app.html#bnsave'), index: tab.index + 1, windowId: tab.windowId, openerTabId: tab.id });
}

// ---------- Capture a link: open it in a new tab, wait for it to load, then capture ----------
async function captureUrl(url, near) {
  if (!/^https?:\/\//i.test(String(url || ''))) return { ok: false, error: 'Only web pages (http or https) can be captured.' };
  if (busy) return { ok: false, error: 'A capture is already running.' };
  const opts = { url, active: true };
  if (near && near.windowId) { opts.windowId = near.windowId; opts.index = near.index + 1; }
  const tab = await api.tabs.create(opts);
  await new Promise(resolve => {
    const t = setTimeout(done, 30000);
    function done() { clearTimeout(t); api.tabs.onUpdated.removeListener(on); resolve(); }
    function on(id, ch) { if (id === tab.id && ch.status === 'complete') done(); }
    api.tabs.onUpdated.addListener(on);
  });
  await sleep(1500);   // let the page finish drawing
  startCapture(await api.tabs.get(tab.id));
  return { ok: true };
}

// ---------- Keep searching: keep its pinned tab open ----------
// The helper (runner.html) lives in a small pinned PageProof tab (4.4.3, Ben's pick: no extra
// window or taskbar icon). It writes a heartbeat (fcStatus.beat) every 30 seconds. If that stops
// while Keep searching is on, the tab is opened again. If you close it yourself, it stays closed
// (PageProof shows a "Start it again" button) until the browser is opened again.
async function keepAlive(show, force) {
  const st = await api.storage.local.get(['fcKeep', 'fcStatus', 'fcDrive']);
  if (!st.fcKeep || !st.fcKeep.on || !st.fcDrive || !st.fcDrive.done) return;
  const ss = api.storage.session ? await api.storage.session.get('fcClosed').catch(() => ({})) : {};
  if (ss.fcClosed && !force) return;
  // Never open it when every browser window is closed (the browser can keep running in the background).
  const wins = await normalWindows();
  if (!wins.length) return;
  if (api.storage.session) await api.storage.session.remove('fcClosed').catch(() => {});
  // Already open? (Its heartbeat is fresh and its tab is still there.)
  const s = st.fcStatus;
  if (s && s.tabId && Date.now() - s.beat < 90000) {
    try { const t = await api.tabs.get(s.tabId); if (show) { await api.tabs.update(t.id, { active: true }); await api.windows.update(t.windowId, { focused: true }); } return; } catch (e) { /* closed */ }
  }
  // A second helper closes itself if one is already running (see runner.js).
  const win = wins.find(w => w.focused) || wins[0];
  const t = await api.tabs.create({ windowId: win.id, url: api.runtime.getURL('runner.html'), pinned: true, index: 0, active: !!show });
  // Browsers put quiet tabs to sleep to save memory; this one must stay awake to keep searching.
  api.tabs.update(t.id, { autoDiscardable: false }).catch(() => {});
  runnerTab = t.id;
}
let runnerTab = null;
const normalWindows = async () => { try { return await api.windows.getAll({ windowTypes: ['normal'] }); } catch (e) { return [{ id: undefined }]; } };
// You closed the helper tab yourself (not by closing the whole window): it stays closed until the
// browser opens again, or you press Start it again in PageProof.
api.tabs.onRemoved.addListener(async (id, info) => {
  const st = (await api.storage.local.get('fcStatus')).fcStatus;
  if (id !== runnerTab && !(st && st.tabId === id)) return;
  runnerTab = null;
  await api.storage.local.set({ fcStatus: { ...(st || {}), state: 'closed', beat: 0 } }).catch(() => {});
  if (!info.isWindowClosing && api.storage.session) api.storage.session.set({ fcClosed: Date.now() }).catch(() => {});
});
// A browser window opened again: start Keep searching again (it closed with the last window).
api.windows.onCreated.addListener(w => { if (w && w.type === 'normal') setTimeout(() => keepAlive(false), 3000); });
// Today's 50 at the time you picked (weekdays), if "Start by itself" is on.
async function fiftySchedule() {
  if (!api.alarms) return;
  await api.alarms.clear('fcFifty');
  const k = (await api.storage.local.get('fcKeep')).fcKeep;
  if (!k || !k.fiftyAuto) return;
  const [hh, mm] = String(k.fiftyTime || '09:00').split(':').map(Number);
  const when = new Date(); when.setHours(hh || 0, mm || 0, 0, 0);
  if (when.getTime() <= Date.now()) when.setDate(when.getDate() + 1);
  api.alarms.create('fcFifty', { when: when.getTime(), periodInMinutes: 1440 });
}
// The number of new copies on the toolbar icon (when no capture is running).
async function newBadge() {
  if (busy) return;
  try {
    const n = typeof FC !== 'undefined' ? await FC.countNew() : await new Promise((res, rej) => {
      const r = indexedDB.open('pageproof-fc');
      r.onerror = () => rej(r.error);
      r.onupgradeneeded = () => { r.transaction.abort(); rej(new Error('none')); };
      r.onsuccess = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('copies')) { db.close(); return res(0); }
        const q = db.transaction('copies').objectStore('copies').index('status').count('new');
        q.onsuccess = () => { db.close(); res(q.result); }; q.onerror = () => { db.close(); rej(q.error); };
      };
    });
    // A red "!" wins: Google Drive is waiting for its one click (see driveNudge).
    if ((await api.storage.local.get('fcNeedsAllow')).fcNeedsAllow) { api.action.setBadgeBackgroundColor({ color: '#E11D48' }); api.action.setBadgeText({ text: '!' }); return; }
    // 4.5 (Ben): a small red dot in the top-right corner of the logo instead of a number, so the
    // logo stays visible. The count is in the icon's tooltip.
    api.action.setBadgeText({ text: '' });
    await dotIcon(n > 0);
    api.action.setTitle({ title: n ? 'PageProof: ' + n + ' new ' + (n === 1 ? 'copy' : 'copies') + ' found' : 'PageProof' });
  } catch (e) { /* nothing found yet */ }
}
// The toolbar icon, with or without the red "new copies found" dot (top right, white ring).
let dotNow = null;
async function dotIcon(on) {
  if (dotNow === on) return;
  const imageData = {};
  for (const size of [16, 32]) {
    const bmp = await createImageBitmap(await (await fetch(api.runtime.getURL('icons/icon' + size + '.png'))).blob());
    const c = new OffscreenCanvas(size, size), x = c.getContext('2d');
    x.drawImage(bmp, 0, 0, size, size);
    if (on) {
      const r = size * 0.16, cx = size - r - size * 0.04, cy = r + size * 0.04;
      x.beginPath(); x.arc(cx, cy, r + size * 0.06, 0, 7); x.fillStyle = '#fff'; x.fill();
      x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fillStyle = '#E11D48'; x.fill();
    }
    imageData[size] = x.getImageData(0, 0, size, size);
  }
  await api.action.setIcon({ imageData });
  dotNow = on;
}
// ---------- the morning nudge: Google Drive needs one click after the browser restarts ----------
// The browser forgets PageProof's permission to read the photos folder when it closes. Until
// someone clicks Allow, nothing can be searched. So when searching is switched on (Keep searching
// or today's batch starting by itself), the toolbar icon shows a red "!" and, once after the
// browser starts, a notification says so.
async function driveNeedsClick() {
  try {
    const h = await new Promise((res, rej) => {
      const r = indexedDB.open('pageproof-rs');
      r.onerror = () => rej(r.error);
      r.onupgradeneeded = () => { r.transaction.abort(); rej(new Error('none')); };
      r.onsuccess = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('handles')) { db.close(); return res(null); }
        const q = db.transaction('handles').objectStore('handles').get('fcRoot');
        q.onsuccess = () => { db.close(); res(q.result); }; q.onerror = () => { db.close(); rej(q.error); };
      };
    });
    if (!h || !h.queryPermission) return false;
    return (await h.queryPermission({ mode: 'read' })) !== 'granted';
  } catch (e) { return false; }
}
async function driveNudge(notify) {
  const st = await api.storage.local.get(['fcKeep', 'fcDrive', 'fcNeedsAllow']);
  const wanted = st.fcDrive && st.fcDrive.done && st.fcKeep && (st.fcKeep.on || st.fcKeep.fiftyAuto);
  const need = wanted ? await driveNeedsClick() : false;
  if (!!st.fcNeedsAllow !== need) { await api.storage.local.set({ fcNeedsAllow: need ? Date.now() : 0 }); newBadge(); }
  if (need && notify && api.notifications) {
    api.notifications.create('fcAllow', { type: 'basic', iconUrl: api.runtime.getURL('icons/icon128.png'), title: 'PageProof: one click to start today\'s search',
      message: 'Your browser asks once after it restarts. Click here, then press Allow, and PageProof starts searching your photos.', priority: 2, requireInteraction: true });
  }
}
// ---------- is there a newer PageProof? Asked once a day, on a weekday morning or when the browser starts ----------
async function updateCheck(force) {
  try {
    api.storage.local.remove('ppGhToken'); // left over from 4.1.0, when the code was private
    const u = (await api.storage.local.get('ppUpdate')).ppUpdate;
    if (!force && u && Date.now() - u.at < 20 * 3600000) return;
    const cur = api.runtime.getManifest().version;
    const st = { at: Date.now(), latest: '', has: false, error: '' };
    const REPO = 'TheBenPsych/PageProof';
    let m = null;
    try { const r = await fetch('https://raw.githubusercontent.com/' + REPO + '/main/extension/manifest.json?t=' + Date.now(), { cache: 'no-store', credentials: 'omit' }); if (r.ok) m = await r.json(); } catch (e) { /* offline */ }
    if (m && /^\d+(\.\d+){1,3}$/.test(m.version || '')) {
      const a = m.version.split('.').map(Number), b = cur.split('.').map(Number);
      for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) { st.has = d > 0; break; } }
      st.latest = m.version;
    } else st.error = 'PageProof could not reach GitHub just now. It will try again later.';
    const told = u && u.has && u.latest === st.latest;
    await api.storage.local.set({ ppUpdate: st });
    if (st.has && !told && api.notifications) api.notifications.create('ppUpdate', { type: 'basic', iconUrl: api.runtime.getURL('icons/icon128.png'), title: 'PageProof ' + st.latest + ' is ready', message: 'Click here for the download and the three steps. It keeps everything you have.', priority: 1 });
  } catch (e) { /* tried again tomorrow */ }
}
if (api.alarms) {
  api.alarms.create('fcKeep', { periodInMinutes: 1 });
  api.alarms.onAlarm.addListener(async a => {
    if (a.name === 'fcKeep') {
      newBadge(); driveNudge(false); updateCheck(false);
      const st = (await api.storage.local.get('fcStatus')).fcStatus;
      if (!st || Date.now() - st.beat > 90000) keepAlive(false);
    }
    if (a.name === 'fcFifty') {
      const d = new Date().getDay();
      if (d === 0 || d === 6) return;
      api.tabs.create({ url: api.runtime.getURL('app.html#keep?start50=1') });
    }
  });
}
api.storage.onChanged.addListener(ch => {
  if (ch.fcKeep) { fiftySchedule(); driveNudge(false); }
  if (ch.fcNeedsAllow) newBadge();
  if (ch.fcChanged || ch.rsHidden || ch.fcHiddenCountries) { clearTimeout(badgeT); badgeT = setTimeout(newBadge, 2000); }
});
let badgeT = null;
api.runtime.onStartup.addListener(() => { fiftySchedule(); keepAlive(false); newBadge(); driveNudge(true); updateCheck(false); });
api.runtime.onInstalled.addListener(d => {
  fiftySchedule(); newBadge();
  if (d.reason === 'install') api.tabs.create({ url: api.runtime.getURL('app.html#setup') });
  // After an update the saved "version X is ready" note is old news: forget it and ask GitHub again.
  if (d.reason === 'update') api.storage.local.remove('ppUpdate').then(() => updateCheck(true)).catch(() => {});
  try { api.sidePanel && api.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }); } catch (e) { /* no side panel */ }
  if (api.alarms) api.alarms.clear('rsDaily');
});
// A search site tab asks "am I one of PageProof's search tabs?" (rsearch.js), to show the
// PageProof logo. The results page marks its tabs in session storage (rsTab:<id>).
api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'rsIsMine' || !sender.tab || sender.id !== api.runtime.id) return false;
  if (!api.storage.session) { sendResponse({ mine: false }); return false; }
  const k = 'rsTab:' + sender.tab.id;
  api.storage.session.get(k).then(r => sendResponse({ mine: !!r[k] })).catch(() => sendResponse({ mine: false }));
  return true;
});
// Messages from PageProof's own pages (never from websites).
api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || sender.id !== api.runtime.id) return false;
  const jobs = {
    captureUrl: () => captureUrl(msg.url, sender.tab),
    fcKeepWake: async () => { await keepAlive(!!msg.show, true); return { ok: true }; },
    fcKeepStop: async () => ({ ok: true }),   // the window closes itself when Keep searching is turned off
    fcFiftyAlarm: async () => { await fiftySchedule(); return { ok: true }; },
  };
  const job = jobs[msg.type];
  if (!job) return false;
  job().catch(err => ({ ok: false, error: String((err && err.message) || err) })).then(sendResponse);
  return true;
});
if (api.notifications) {
  api.notifications.onClicked.addListener(id => {
    api.notifications.clear(id);
    if (id === 'fcAllow' || id === 'fcDrive') api.tabs.create({ url: api.runtime.getURL('app.html#keep') });
    if (id === 'ppUpdate' || id.startsWith('fcEngine:')) api.tabs.create({ url: api.runtime.getURL('app.html#health') });
  });
}
