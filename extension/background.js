// PageProof background script: runs the capture when you click the toolbar icon.
if (typeof PP_DB === 'undefined' && typeof importScripts === 'function') importScripts('db.js');

const api = globalThis.browser || globalThis.chrome;
const MAX_PAGE_SHOTS = 60;     // stop after this many screens on very long pages
const MAX_SECTION_SHOTS = 25;  // per scrollable section
const SETTLE_MS = 350;         // wait for things to draw after each scroll
const MIN_GAP_MS = 600;        // browsers allow only ~2 screenshots per second

const sleep = ms => new Promise(r => setTimeout(r, ms));
let busy = false;
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
  api.action.setBadgeBackgroundColor({ color: '#2563eb' });
  api.action.setBadgeText({ text });
}

async function capture(tab) {
  const tabId = tab.id;
  const windowId = tab.windowId;
  await api.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  const info = await inPage(tabId, 'prepare', true);

  const record = {
    id: 'cap-' + Date.now(),
    url: info.url,
    title: info.title,
    time: new Date().toISOString(),
    viewWidth: info.viewWidth,
    innerWidth: info.innerWidth,
    html: info.html,
    main: { width: info.viewWidth, height: 0, tiles: [], background: info.background },
    sections: [],
    notes: []
  };

  try {
    // 1) The main page, one screen at a time, starting from the very top.
    let y = 0, prevNext = -1;
    for (let i = 0; i < MAX_PAGE_SHOTS; i++) {
      progress(String(i + 1));
      const at = await inPage(tabId, 'scrollPage', y);
      await sleep(i === 0 ? SETTLE_MS * 2 : SETTLE_MS);
      const shot = await shoot(windowId);
      record.main.tiles.push({ src: shot, crop: at.crop, destX: at.crop.x, destY: at.destY });
      record.main.height = Math.max(record.main.height, at.total, at.destY + at.crop.h);
      if (i === 0) await inPage(tabId, 'hideFixed');
      if (at.done || at.next <= prevNext) break;
      prevNext = at.next;
      y = at.next;
      if (i === MAX_PAGE_SHOTS - 1) record.notes.push('This page was very long, so the capture stops after ' + MAX_PAGE_SHOTS + ' screens.');
    }
    record.main.height = Math.min(record.main.height, Math.max(...record.main.tiles.map(t => t.destY + t.crop.h)));

    // 2) Each scrollable box, scrolled from top to bottom.
    await inPage(tabId, 'removeBadges');
    for (const s of info.sections) {
      progress('S' + s.n);
      const sec = { n: s.n, label: s.label, width: 0, height: 0, tiles: [] };
      let top = 0;
      for (let i = 0; i < MAX_SECTION_SHOTS; i++) {
        const at = await inPage(tabId, 'scrollSection', s.n, top, i === 0);
        if (!at) break;
        await sleep(SETTLE_MS);
        const shot = await shoot(windowId);
        sec.tiles.push({ src: shot, crop: at.crop, destY: at.contentY });
        sec.width = Math.max(sec.width, at.crop.w);
        sec.height = Math.max(sec.height, at.contentY + at.crop.h);
        if (at.scrollTop >= at.maxScroll - 1) break;
        top = at.scrollTop + at.crop.h;
      }
      if (sec.tiles.length) record.sections.push(sec);
    }
  } finally {
    await inPage(tabId, 'restore').catch(() => {});
  }

  await PP_DB.put(record);
  await api.tabs.create({ url: api.runtime.getURL('viewer.html?id=' + record.id), index: tab.index + 1 });
}

api.action.onClicked.addListener(async tab => {
  if (busy) return;
  busy = true;
  try {
    await capture(tab);
  } catch (err) {
    const msg = String((err && err.message) || err);
    await api.tabs.create({ url: api.runtime.getURL('viewer.html?error=' + encodeURIComponent(msg)) });
  } finally {
    busy = false;
    api.action.setBadgeText({ text: '' });
  }
});
