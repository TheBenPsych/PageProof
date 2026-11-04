// Runs inside the web page being captured. The background script calls these
// helpers one step at a time while it takes screenshots.
(() => {
  if (window.__pageproof) return;

  const MAX_SECTIONS = 12;
  const hidden = [];      // fixed/sticky elements we hid, so we can restore them
  const badges = [];      // the numbered labels we drew on the page
  let targets = [];       // scrollable boxes found on the page
  let start = null;       // where the page was scrolled before we began
  let pageEl = null;      // on sites where the page scrolls inside a big box instead of the window
  let pageElStart = 0;

  const instant = { behavior: 'instant' };
  const scroller = () => document.scrollingElement || document.documentElement;

  function isScrollable(el) {
    if (el === document.body || el === document.documentElement) return false;
    const cs = getComputedStyle(el);
    if (!/(auto|scroll|overlay)/.test(cs.overflowY)) return false;
    if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    if (el.scrollHeight - el.clientHeight < 20) return false;
    return el.clientHeight >= 60 && el.clientWidth >= 100;
  }

  function visibleArea(el) {
    const r = el.getBoundingClientRect();
    const w = Math.min(r.right, document.documentElement.clientWidth) - Math.max(r.left, 0);
    const h = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
    return w > 0 && h > 0 ? w * h : 0;
  }

  function pageBackground() {
    for (const el of [pageEl, document.body, document.documentElement]) {
      if (!el) continue;
      const c = getComputedStyle(el).backgroundColor;
      if (c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c)) return c;
    }
    return '#ffffff';
  }

  // Keep each "Section N" label pinned to the top-left corner of its box as we scroll.
  function placeBadges() {
    for (const t of targets) {
      const r = t.el.getBoundingClientRect();
      const out = r.bottom < 0 || r.top > window.innerHeight || r.width === 0;
      t.badge.style.display = out ? 'none' : 'block';
      t.badge.style.left = Math.max(0, r.left) + 'px';
      t.badge.style.top = r.top + 'px';
    }
  }

  function labelFor(el) {
    const text = el.getAttribute('aria-label') || el.getAttribute('title') ||
      el.querySelector('h1,h2,h3,h4,h5,h6,caption,legend')?.textContent ||
      (el.id ? '#' + el.id : '') ||
      (el.innerText || '').split('\n').find(t => t.trim()) || el.tagName.toLowerCase();
    const clean = text.replace(/\s+/g, ' ').trim();
    return clean.length > 70 ? clean.slice(0, 67) + '...' : clean;
  }

  function prepare(wantHtml) {
    const se = scroller();
    start = { x: window.scrollX, y: window.scrollY };

    // Save a copy of the page's HTML before we add any labels.
    let html = null;
    if (wantHtml) {
      const copy = document.documentElement.cloneNode(true);
      // Point every picture at the exact file the browser is showing right now.
      const origImgs = document.querySelectorAll('img'), copyImgs = copy.querySelectorAll('img');
      origImgs.forEach((img, i) => {
        const c = copyImgs[i];
        if (!c) return;
        const src = img.currentSrc || img.src;
        if (src) c.setAttribute('src', src);
        c.removeAttribute('srcset');
        c.removeAttribute('sizes');
        c.removeAttribute('loading');
      });
      copy.querySelectorAll('picture source').forEach(s => s.remove());
      // Drawings on <canvas> are turned into pictures where the browser allows it.
      const origCanvas = document.querySelectorAll('canvas'), copyCanvas = copy.querySelectorAll('canvas');
      origCanvas.forEach((cv, i) => {
        try {
          const img = document.createElement('img');
          img.src = cv.toDataURL('image/png');
          img.width = cv.clientWidth; img.height = cv.clientHeight;
          copyCanvas[i] && copyCanvas[i].replaceWith(img);
        } catch (e) { /* protected canvas, leave it */ }
      });
      document.querySelectorAll('video').forEach((v, i) => {
        const c = copy.querySelectorAll('video')[i];
        if (c && v.poster) c.setAttribute('poster', v.poster);
      });
      copy.querySelectorAll('script, noscript').forEach(s => s.remove());
      const head = copy.querySelector('head') || copy;
      const base = document.createElement('base');
      base.href = location.href;
      head.prepend(base);
      html = '<!DOCTYPE html>\n<!-- Saved by PageProof from ' + location.href +
        ' on ' + new Date().toString() + ' -->\n' + copy.outerHTML;
    }

    // Find scrollable boxes inside the page, biggest first.
    let found = [...document.querySelectorAll('body *')]
      .filter(isScrollable)
      .sort((a, b) => visibleArea(b) - visibleArea(a));

    // Some sites (web apps) keep the window still and scroll the whole page inside one
    // big box. Treat that box as the page itself, not as a separate section.
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    pageEl = null;
    if (found.length && se.scrollHeight <= vh + 5 && visibleArea(found[0]) >= 0.4 * vw * vh) {
      pageEl = found.shift();
      pageElStart = pageEl.scrollTop;
    }

    targets = found
      .filter(el => visibleArea(el) > 0 || el.getBoundingClientRect().height > 0)
      .slice(0, MAX_SECTIONS)
      .map((el, i) => ({ el, n: i + 1, label: labelFor(el), startTop: el.scrollTop, outline: el.style.outline }));

    // Mark each one with a numbered label so the main capture points to its section below.
    for (const t of targets) {
      t.el.style.outline = '3px dashed #e11d48';
      const b = document.createElement('div');
      b.textContent = 'Section ' + t.n + ' (see below)';
      b.style.cssText = 'position:fixed;z-index:2147483647;background:#e11d48;color:#fff;' +
        'font:bold 13px/1.4 system-ui,sans-serif;padding:2px 8px;border-radius:0 0 6px 0;' +
        'pointer-events:none;box-shadow:0 1px 3px rgba(0,0,0,.4);';
      document.documentElement.appendChild(b);
      badges.push(b);
      t.badge = b;
    }

    return {
      url: location.href,
      title: document.title,
      viewWidth: document.documentElement.clientWidth,
      viewHeight: window.innerHeight,
      userAgent: navigator.userAgent,
      background: pageBackground(),
      innerWidth: window.innerWidth,
      sections: targets.map(t => ({ n: t.n, label: t.label })),
      html
    };
  }

  // Scroll the main page to y and say which part of the screen to keep,
  // where it goes in the final picture, and where to scroll next.
  function scrollPage(y) {
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    let res;
    if (!pageEl) {
      const se = scroller();
      window.scrollTo({ left: 0, top: y, ...instant });
      const at = window.scrollY, total = Math.max(se.scrollHeight, document.body ? document.body.scrollHeight : 0);
      res = { crop: { x: 0, y: 0, w: vw, h: vh }, destY: at, total, next: at + vh, done: at + vh >= total - 1 };
    } else {
      pageEl.scrollTo({ top: y, ...instant });
      const st = pageEl.scrollTop, max = pageEl.scrollHeight - pageEl.clientHeight;
      const r = pageEl.getBoundingClientRect();
      const top = Math.ceil(Math.max(0, r.top + pageEl.clientTop));
      const bottom = Math.floor(Math.min(vh, r.top + pageEl.clientTop + pageEl.clientHeight));
      const left = Math.ceil(Math.max(0, r.left + pageEl.clientLeft));
      const right = Math.floor(Math.min(vw, r.left + pageEl.clientLeft + pageEl.clientWidth));
      const total = top + pageEl.scrollHeight + Math.max(0, vh - bottom);
      // The first screen keeps everything (header, side menu). After that, only the scrolling box.
      res = st === 0
        ? { crop: { x: 0, y: 0, w: vw, h: vh }, destY: 0 }
        : { crop: { x: left, y: top, w: right - left, h: bottom - top }, destY: top + st };
      Object.assign(res, { total, next: st + (bottom - top), done: st >= max - 1 });
    }
    placeBadges();
    return res;
  }

  // After the first screenshot, hide headers/bars that stick to the screen,
  // so they don't repeat in every slice. Keep anything holding a section.
  function hideFixed() {
    for (const el of document.querySelectorAll('body *')) {
      if (badges.includes(el)) continue;
      const pos = getComputedStyle(el).position;
      if (pos !== 'fixed' && pos !== 'sticky') continue;
      if (targets.some(t => el.contains(t.el)) || (pageEl && el.contains(pageEl))) continue;
      hidden.push([el, el.style.visibility]);
      el.style.setProperty('visibility', 'hidden', 'important');
    }
  }

  function removeBadges() {
    badges.forEach(b => b.remove());
    badges.length = 0;
    targets.forEach(t => { t.el.style.outline = t.outline; });
  }

  // Bring a section into view and scroll inside it. Returns the part of the
  // screen to cut out and where that part sits inside the section's contents.
  function scrollSection(n, top, first) {
    const t = targets.find(x => x.n === n);
    if (!t || !t.el.isConnected) return null;
    if (first) t.el.scrollIntoView({ block: 'start', inline: 'nearest', ...instant });
    t.el.scrollTo({ top, ...instant });
    const r = t.el.getBoundingClientRect();
    const innerLeft = r.left + t.el.clientLeft;
    const innerTop = r.top + t.el.clientTop;
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const x0 = Math.ceil(Math.max(0, innerLeft)), y0 = Math.ceil(Math.max(0, innerTop));
    const x1 = Math.floor(Math.min(vw, innerLeft + t.el.clientWidth)), y1 = Math.floor(Math.min(vh, innerTop + t.el.clientHeight));
    if (x1 - x0 < 10 || y1 - y0 < 10) return null;
    return {
      crop: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
      contentY: t.el.scrollTop + (y0 - innerTop),
      contentHeight: t.el.scrollHeight,
      scrollTop: t.el.scrollTop,
      maxScroll: t.el.scrollHeight - t.el.clientHeight
    };
  }

  function restore() {
    removeBadges();
    hidden.forEach(([el, v]) => { el.style.visibility = v; });
    hidden.length = 0;
    targets.forEach(t => { if (t.el.isConnected) t.el.scrollTop = t.startTop; });
    if (pageEl && pageEl.isConnected) pageEl.scrollTop = pageElStart;
    if (start) window.scrollTo({ left: start.x, top: start.y, ...instant });
  }

  window.__pageproof = { prepare, scrollPage, hideFixed, removeBadges, scrollSection, restore };
})();
