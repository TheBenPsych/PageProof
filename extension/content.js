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
  let startTotal = 0;     // how tall the page was when capture began (to stop endless scrolling)

  const instant = { behavior: 'instant' };
  const scroller = () => document.scrollingElement || document.documentElement;

  // A box that scrolls on its own: up/down, sideways, or both.
  function scrollAxes(el) {
    if (el === document.body || el === document.documentElement) return null;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return null;
    const y = /(auto|scroll|overlay)/.test(cs.overflowY) && el.scrollHeight - el.clientHeight >= 20 && el.clientHeight >= 60;
    const x = /(auto|scroll|overlay)/.test(cs.overflowX) && el.scrollWidth - el.clientWidth >= 20 && el.clientHeight >= 40;
    if (!(x || y) || el.clientWidth < 100) return null;
    return { x, y };
  }
  const isScrollable = el => !!scrollAxes(el);

  // Carousels that move with "next" arrows instead of scrolling.
  const CAROUSEL = '[aria-roledescription="carousel" i], .swiper, .swiper-container, .slick-slider, .splide, .glide, ' +
    '.flickity-enabled, .owl-carousel, .carousel, [class*="carousel" i], [class*="slider" i], [class*="slideshow" i]';
  const NEXT = '.swiper-button-next, .slick-next, .splide__arrow--next, .glide__arrow--right, .flickity-prev-next-button.next, ' +
    '.owl-next, .carousel-control-next, [data-slide="next"], [data-bs-slide="next"], [aria-label*="next" i], [title*="next" i], ' +
    '[class*="next" i], [aria-label*="forward" i], [class*="arrow-right" i], [class*="right-arrow" i]';

  function isShown(el) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 4 && r.height > 4 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity !== 0;
  }

  function nextButton(box) {
    for (const scope of [box, box.parentElement, box.parentElement && box.parentElement.parentElement]) {
      if (!scope) continue;
      const btn = [...scope.querySelectorAll(NEXT)].find(b => {
        if (!isShown(b)) return false;
        const link = b.closest('a[href]');
        if (link && !/^(#|javascript:)/i.test(link.getAttribute('href'))) return false; // never follow real links
        return !/prev|back|left/i.test((b.className && b.className.baseVal !== undefined ? b.className.baseVal : b.className) + ' ' + (b.getAttribute('aria-label') || ''));
      });
      if (btn) return btn;
    }
    return null;
  }

  function isDisabled(btn) {
    return btn.disabled || btn.getAttribute('aria-disabled') === 'true' || /disabled/i.test(String(btn.className)) || !isShown(btn);
  }

  // What the carousel is showing right now, to notice when it loops back.
  function carouselLook(box) {
    const r = box.getBoundingClientRect();
    const inView = el => { const q = el.getBoundingClientRect(); return q.right > r.left + 5 && q.left < r.right - 5 && q.bottom > r.top && q.top < r.bottom && q.width > 0; };
    const imgs = [...box.querySelectorAll('img')].filter(inView).map(i => i.currentSrc || i.src).join('|');
    const text = [...box.querySelectorAll('h1,h2,h3,h4,p,span,a,figcaption')].filter(inView).map(e => e.textContent.trim()).filter(Boolean).join('|').slice(0, 2000);
    return imgs + '#' + text;
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
      // Sit just above the box where possible, so the label doesn't cover what's inside it.
      t.badge.style.left = Math.max(0, r.left) + 'px';
      t.badge.style.top = (r.top >= 22 ? r.top - 21 : r.top) + 'px';
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

    found = found.filter(el => visibleArea(el) > 0 || el.getBoundingClientRect().height > 0).slice(0, MAX_SECTIONS);
    targets = found.map(el => {
      const ax = scrollAxes(el);
      return { kind: 'scroll', el, axes: ax, label: labelFor(el), startTop: el.scrollTop, startLeft: el.scrollLeft };
    });

    // Carousels with a "next" button (skip ones that are already a sideways scroll box).
    const inTargets = el => targets.some(t => t.el === el || t.el.contains(el) || el.contains(t.el));
    const carousels = [];
    for (const box of document.querySelectorAll(CAROUSEL)) {
      if (carousels.length >= 6) break;
      const r = box.getBoundingClientRect();
      if (r.width < 150 || r.height < 80 || !isShown(box) || box === pageEl) continue;
      if (inTargets(box) || carousels.some(c => c.el.contains(box) || box.contains(c.el))) continue;
      const btn = nextButton(box);
      if (btn) carousels.push({ kind: 'carousel', el: box, btn, label: labelFor(box) });
    }
    targets.push(...carousels);

    // Fold-out areas that are closed.
    for (const d of [...document.querySelectorAll('details:not([open])')].filter(isShown).slice(0, 10)) {
      const sum = d.querySelector('summary');
      targets.push({ kind: 'details', el: d, label: (sum ? sum.textContent : labelFor(d)).replace(/\s+/g, ' ').trim().slice(0, 70) || 'Fold-out area' });
    }

    // Dropdown lists: write out every choice.
    for (const sel of [...document.querySelectorAll('select')].filter(isShown).slice(0, 20)) {
      const lab = (sel.labels && sel.labels[0] && sel.labels[0].textContent) || sel.getAttribute('aria-label') || sel.name || sel.id || 'Dropdown list';
      targets.push({ kind: 'select', el: sel, label: lab.replace(/\s+/g, ' ').trim().slice(0, 70),
        options: [...sel.options].slice(0, 300).map(o => ({ text: o.text.trim() || o.value, selected: o.selected, disabled: o.disabled })) });
    }

    targets.forEach((t, i) => { t.n = i + 1; t.outline = t.el.style.outline; });
    startTotal = pageEl ? pageEl.scrollHeight : Math.max(se.scrollHeight, document.body ? document.body.scrollHeight : 0);

    // Mark each one with a numbered label so the main capture points to its section below.
    for (const t of targets) {
      t.el.style.outline = '3px dashed #e11d48';
      const b = document.createElement('div');
      b.textContent = 'Section ' + t.n;
      b.style.cssText = 'position:fixed;z-index:2147483647;background:#e11d48;color:#fff;' +
        'font:bold 12px/1.5 system-ui,sans-serif;padding:1px 7px;border-radius:5px 5px 0 0;' +
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
      sections: targets.map(t => ({ n: t.n, kind: t.kind, label: t.label, axes: t.axes, options: t.options })),
      html
    };
  }

  // Allow some growth (pictures loading in), but not endless new articles.
  const cap = (h, view) => Math.max(h * 1.25, h + view);

  // Scroll the main page to y and say which part of the screen to keep,
  // where it goes in the final picture, and where to scroll next.
  function scrollPage(y) {
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    let res;
    if (!pageEl) {
      const se = scroller();
      window.scrollTo({ left: 0, top: y, ...instant });
      const live = Math.max(se.scrollHeight, document.body ? document.body.scrollHeight : 0);
      const total = Math.min(live, cap(startTotal, vh));
      const at = window.scrollY;
      res = { crop: { x: 0, y: 0, w: vw, h: vh }, destY: at, total, next: at + vh, done: at + vh >= total - 1, grew: live > total };
    } else {
      pageEl.scrollTo({ top: y, ...instant });
      const limit = Math.min(pageEl.scrollHeight, cap(startTotal, pageEl.clientHeight));
      const st = pageEl.scrollTop, max = limit - pageEl.clientHeight;
      const r = pageEl.getBoundingClientRect();
      const top = Math.ceil(Math.max(0, r.top + pageEl.clientTop));
      const bottom = Math.floor(Math.min(vh, r.top + pageEl.clientTop + pageEl.clientHeight));
      const left = Math.ceil(Math.max(0, r.left + pageEl.clientLeft));
      const right = Math.floor(Math.min(vw, r.left + pageEl.clientLeft + pageEl.clientWidth));
      const total = top + limit + Math.max(0, vh - bottom);
      // The first screen keeps everything (header, side menu). After that, only the scrolling box.
      res = st === 0
        ? { crop: { x: 0, y: 0, w: vw, h: vh }, destY: 0 }
        : { crop: { x: left, y: top, w: right - left, h: bottom - top }, destY: top + st };
      Object.assign(res, { total, next: st + (bottom - top), done: st >= max - 1, grew: pageEl.scrollHeight > limit });
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

  function grewNow() {
    if (pageEl) return pageEl.scrollHeight > cap(startTotal, pageEl.clientHeight);
    const se = scroller();
    return Math.max(se.scrollHeight, document.body ? document.body.scrollHeight : 0) > cap(startTotal, window.innerHeight);
  }

  function removeBadges() {
    badges.forEach(b => b.remove());
    badges.length = 0;
    targets.forEach(t => { t.el.style.outline = t.outline; });
  }

  // Bring a section into view and scroll inside it. Returns the part of the
  // screen to cut out and where that part sits inside the section's contents.
  function scrollSection(n, left, top, first) {
    const t = targets.find(x => x.n === n);
    if (!t || !t.el.isConnected) return null;
    if (first) t.el.scrollIntoView({ block: 'start', inline: 'nearest', ...instant });
    t.el.scrollTo({ left, top, ...instant });
    const r = t.el.getBoundingClientRect();
    const innerLeft = r.left + t.el.clientLeft;
    const innerTop = r.top + t.el.clientTop;
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const x0 = Math.ceil(Math.max(0, innerLeft)), y0 = Math.ceil(Math.max(0, innerTop));
    const x1 = Math.floor(Math.min(vw, innerLeft + t.el.clientWidth)), y1 = Math.floor(Math.min(vh, innerTop + t.el.clientHeight));
    if (x1 - x0 < 10 || y1 - y0 < 10) return null;
    return {
      crop: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
      contentX: t.el.scrollLeft + (x0 - innerLeft),
      contentY: t.el.scrollTop + (y0 - innerTop),
      scrollLeft: t.el.scrollLeft,
      scrollTop: t.el.scrollTop,
      maxX: t.el.scrollWidth - t.el.clientWidth,
      maxY: t.el.scrollHeight - t.el.clientHeight
    };
  }

  // Capture a whole element (opened fold-out, carousel slide), scrolling the window if it's tall.
  function elementPart(t, step) {
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    if (step === 0) t.el.scrollIntoView({ block: 'start', inline: 'nearest', ...instant });
    else window.scrollBy({ top: vh, ...instant });
    const r = t.el.getBoundingClientRect();
    const x0 = Math.ceil(Math.max(0, r.left)), y0 = Math.ceil(Math.max(0, r.top));
    const x1 = Math.floor(Math.min(vw, r.right)), y1 = Math.floor(Math.min(vh, r.bottom));
    if (x1 - x0 < 10 || y1 - y0 < 10) return null;
    return { crop: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, contentX: x0 - r.left, contentY: y0 - r.top,
      width: r.width, height: r.height, done: r.bottom <= vh + 1 };
  }

  function openDetails(n) {
    const t = targets.find(x => x.n === n);
    if (!t || !t.el.isConnected) return false;
    t.el.open = true;
    t.opened = true;
    return true;
  }

  function closeDetails(n) {
    const t = targets.find(x => x.n === n);
    if (t && t.opened) { t.el.open = false; t.opened = false; }
  }

  function sectionPart(n, step) {
    const t = targets.find(x => x.n === n);
    return t && t.el.isConnected ? elementPart(t, step) : null;
  }

  // Move a carousel to its next slide. Says whether a new, unseen slide is showing.
  function carouselNext(n) {
    const t = targets.find(x => x.n === n);
    if (!t || !t.el.isConnected) return { ok: false };
    t.seen = t.seen || new Set([carouselLook(t.el)]);
    const btn = t.btn.isConnected ? t.btn : nextButton(t.el);
    if (!btn || isDisabled(btn)) return { ok: false };
    btn.click();
    return { ok: true };
  }

  function carouselIsNew(n) {
    const t = targets.find(x => x.n === n);
    if (!t) return false;
    const look = carouselLook(t.el);
    if (t.seen.has(look)) return false;
    t.seen.add(look);
    return true;
  }

  function restore() {
    removeBadges();
    hidden.forEach(([el, v]) => { el.style.visibility = v; });
    hidden.length = 0;
    targets.forEach(t => {
      if (!t.el.isConnected) return;
      if (t.kind === 'scroll') { t.el.scrollTop = t.startTop; t.el.scrollLeft = t.startLeft; }
      if (t.opened) t.el.open = false;
    });
    if (pageEl && pageEl.isConnected) pageEl.scrollTop = pageElStart;
    if (start) window.scrollTo({ left: start.x, top: start.y, ...instant });
  }

  window.__pageproof = { prepare, scrollPage, hideFixed, removeBadges, scrollSection, sectionPart,
    openDetails, closeDetails, grewNow, carouselNext, carouselIsNew, restore };
})();
