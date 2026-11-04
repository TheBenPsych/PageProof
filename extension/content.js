// Runs inside the web page being captured. The background script calls these
// helpers one step at a time while it takes screenshots.
(() => {
  if (window.__pageproof) return;

  const MAX_SECTIONS = 12;
  const hidden = [];      // fixed/sticky elements we hid, so we can restore them
  const badges = [];      // the numbered labels we drew on the page
  let targets = [];       // scrollable boxes found on the page
  let start = null;       // where the page was scrolled before we began

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
      copy.querySelectorAll('script').forEach(s => s.remove());
      const head = copy.querySelector('head') || copy;
      const base = document.createElement('base');
      base.href = location.href;
      head.prepend(base);
      html = '<!DOCTYPE html>\n<!-- Saved by PageProof from ' + location.href +
        ' on ' + new Date().toString() + ' -->\n' + copy.outerHTML;
    }

    // Find scrollable boxes inside the page, biggest first.
    targets = [...document.querySelectorAll('body *')]
      .filter(isScrollable)
      .sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)
      .slice(0, MAX_SECTIONS)
      .map((el, i) => ({ el, n: i + 1, label: labelFor(el), startTop: el.scrollTop, outline: el.style.outline }));

    // Mark each one with a numbered label so the main capture points to its section below.
    for (const t of targets) {
      t.el.style.outline = '3px dashed #e11d48';
      const r = t.el.getBoundingClientRect();
      const b = document.createElement('div');
      b.textContent = 'Section ' + t.n + ' (see below)';
      b.style.cssText = 'position:absolute;z-index:2147483647;background:#e11d48;color:#fff;' +
        'font:bold 13px/1.4 system-ui,sans-serif;padding:2px 8px;border-radius:0 0 6px 0;' +
        'pointer-events:none;box-shadow:0 1px 3px rgba(0,0,0,.4);';
      b.style.left = (r.left + window.scrollX) + 'px';
      b.style.top = (r.top + window.scrollY) + 'px';
      document.body.appendChild(b);
      badges.push(b);
    }

    return {
      url: location.href,
      title: document.title,
      fullHeight: Math.max(se.scrollHeight, document.body ? document.body.scrollHeight : 0),
      viewWidth: document.documentElement.clientWidth,
      viewHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      sections: targets.map(t => ({ n: t.n, label: t.label })),
      html
    };
  }

  // Scroll the main page and report where it actually landed.
  function scrollPage(y) {
    window.scrollTo({ left: 0, top: y, ...instant });
    return { y: window.scrollY, viewHeight: document.documentElement.clientHeight || window.innerHeight };
  }

  // After the first screenshot, hide headers/bars that stick to the screen,
  // so they don't repeat in every slice. Keep anything holding a section.
  function hideFixed() {
    for (const el of document.querySelectorAll('body *')) {
      if (badges.includes(el)) continue;
      const pos = getComputedStyle(el).position;
      if (pos !== 'fixed' && pos !== 'sticky') continue;
      if (targets.some(t => el.contains(t.el))) continue;
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
    if (start) window.scrollTo({ left: start.x, top: start.y, ...instant });
  }

  window.__pageproof = { prepare, scrollPage, hideFixed, removeBadges, scrollSection, restore };
})();
