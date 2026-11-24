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
  const unclamped = [];   // descriptions we un-shortened, so we can put them back
  let single = false;     // feeds that show one post per screen (Instagram Reels, TikTok): capture only the one on screen
  let locked = false;     // 4.17: the page can't be scrolled (a pop-up window is open and the site locked the page behind it)
  let endEl = null, endGap = 0; // 4.17: the last thing on the page when capture began, to tell pictures loading in from endless new posts
  const unstuck = [];     // 4.17: "sticky" bars and headings turned back into ordinary parts of the page, so they show once, in place
  let calm = null;        // 4.17: the style that switches off fade-in and slide-in animations while the capture runs

  const instant = { behavior: 'instant' };
  const scroller = () => document.scrollingElement || document.documentElement;

  // A box that scrolls up and down on its own (like the comments on an Instagram post).
  function scrollAxes(el) {
    if (el === document.body || el === document.documentElement) return null;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return null;
    const y = /(auto|scroll|overlay)/.test(cs.overflowY) && el.scrollHeight - el.clientHeight >= 20 && el.clientHeight >= 60;
    if (!y || el.clientWidth < 100) return null;
    return { x: false, y: true };
  }
  const isScrollable = el => !!scrollAxes(el);

  function isShown(el) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 4 && r.height > 4 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity !== 0;
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
      const out = r.bottom < 0 || r.top > window.innerHeight || r.width === 0 || getComputedStyle(t.el).visibility === 'hidden';
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

  // Social sites shorten post descriptions with a "... more" button. Click it so the
  // full description shows. Only on screen, and only on these sites, so nothing else changes.
  const SOCIAL = /(^|\.)(instagram|facebook|tiktok|threads|youtube)\.(com|net)$/i;
  // Pages that show one short video per screen: Instagram and Facebook Reels, YouTube Shorts, TikTok.
  function isReelPage() {
    const h = location.hostname, p = location.pathname;
    return (/(^|\.)(instagram|facebook)\.com$/i.test(h) && /^\/reels?\//.test(p))
      || (/(^|\.)youtube\.com$/i.test(h) && /^\/shorts\//.test(p))
      || (/(^|\.)tiktok\.com$/i.test(h) && (/\/video\//.test(p) || /^\/(foryou|following|explore)?\/?$/.test(p)));
  }
  function expandMore() {
    if (!SOCIAL.test(location.hostname)) return 0;
    const vh = window.innerHeight, vw = document.documentElement.clientWidth;
    let n = 0;
    for (const el of document.querySelectorAll('span, div, button, a[role="button"], [role="button"]')) {
      if (n >= 5) break;
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      // "... more", "See more", or (newer Instagram) just "…" at the end of a description.
      if (!/^((…|\.\.\.)?\s*(more|see more|show more)|…|\.\.\.)$/i.test(text)) continue;
      if (el.querySelector('svg') || /option|menu/i.test(el.getAttribute('aria-label') || '')) continue; // not the "more options" menu
      if (isMenuButton(el)) continue;
      if (el.closest('a[href]:not([href="#"])')) continue;            // never follow a link
      if ([...el.children].some(c => (c.textContent || '').trim() === text)) continue; // click the innermost one
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
      try { el.click(); n++; } catch (e) { /* ignore */ }
    }
    // Descriptions cut short by styling (the "…" is drawn by the browser): click the
    // description itself, the way a person would, so the site opens it with its own animation.
    // Only on Reels/Shorts pages, so ordinary feeds (where a click might open a link) are left alone.
    if (!n && isReelPage()) {
      for (const el of clampedOnScreen()) {
        if (n >= 3) break;
        let target = el;
        for (let up = el, i = 0; up && i < 5; up = up.parentElement, i++) {
          if (up.getAttribute('role') === 'button' || getComputedStyle(up).cursor === 'pointer') { target = up; break; }
        }
        if (target.closest('a[href]:not([href="#"])')) continue;
        if (isMenuButton(target)) continue;
        try { target.click(); n++; } catch (e) { /* ignore */ }
      }
    }
    // Fallback: a clickable description whose text simply ends in "…".
    if (!n && isReelPage()) {
      for (const el of document.querySelectorAll('[role="button"], span, div')) {
        if (n >= 3) break;
        const text = (el.textContent || '').trim();
        if (text.length < 20 || text.length > 800 || !/(…|\.\.\.)$/.test(text)) continue;
        if (getComputedStyle(el).cursor !== 'pointer' && el.getAttribute('role') !== 'button') continue;
        if (el.closest('a[href]:not([href="#"])') || el.querySelector('svg, a[href], video')) continue;
        if (isMenuButton(el)) continue;
        if ([...el.children].some(c => (c.textContent || '').trim() === text)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
        try { el.click(); n++; } catch (e) { /* ignore */ }
      }
    }
    return n;
  }

  // 4.14: close pop-ups that cover the page before the first screen: cookie notices, newsletter
  // sign-up boxes, "allow notifications" boxes, "open in the app" banners and ad-blocker messages.
  // PageProof only presses the site's OWN close / accept button (never a link that leaves the
  // page, never Subscribe, Sign up, Log in or Settings), and returns what it pressed so the
  // capture log can say so. Log-in walls are left alone.
  const POP_KINDS = [
    ['cookie notice', /cookie|consent|we value your privacy|privacy (choices|settings|preferences)|gdpr|ccpa|your privacy/i],
    ['sign-up box', /newsletter|subscribe to|sign up for (our|the)|join our (mailing )?list|get (our|the) (latest|daily|weekly)|enter your email/i],
    ['notifications box', /(allow|turn on|enable|get) (push )?notifications|stay (up to date|updated) with notifications/i],
    ['app banner', /open in (the )?app|get the app|download (the|our) app|continue in app/i],
    ['ad-blocker message', /ad ?block(er)?|disable your ad|whitelist (us|our site)/i],
  ];
  const POP_KNOWN = ['#onetrust-accept-btn-handler', '#onetrust-close-btn-container button', '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll', '#CybotCookiebotDialogBodyButtonAccept',
    '#didomi-notice-agree-button', '#truste-consent-button', '.qc-cmp2-summary-buttons button[mode="primary"]', '.fc-cta-consent', '.osano-cm-accept-all', '.cc-window .cc-btn.cc-dismiss', '.cc-window .cc-allow',
    '#cookie_action_close_header', '.cky-btn-accept', '#wt-cli-accept-all-btn', '.iubenda-cs-accept-btn', '#axeptio_btn_acceptAll', '.cmplz-accept', '#hs-eu-confirmation-button', '.js-cookie-consent-agree', 'button[data-cookiebanner="accept_button"]'];
  const POP_CLOSE = /^(×|✕|✖|╳|x|close|close this|dismiss|no,? thanks?|no thank you|not now|maybe later|skip|continue without (accepting|agreeing)|i('|’)?ll pass|stay on (the )?(web|site|browser)|not interested|later)$/i;
  const POP_ACCEPT = /^(accept( all)?( cookies)?|accept (and|&) (close|continue)|i accept|agree( and (close|continue))?|i agree|allow( all)?( cookies)?|got it!?|ok(ay)?!?|understood|continue|i understand|confirm( my)? choices)$/i;
  const POP_NEVER = /subscribe|sign ?up|submit|log ?in|sign ?in|register|buy|purchase|settings|manage|customi[sz]e|preferences|options|learn more|more info|details|install|download|open app|reject all|turn on|allow notifications|enable/i;
  function popText(el) { return ((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '') + ' ' + (el.getAttribute('title') || '') + ' ' + (el.value || '')).replace(/\s+/g, ' ').trim(); }
  function clickable(el) {
    if (!isShown(el)) return false;
    const a = el.closest('a[href]');
    if (a && !/^(#|javascript:)/i.test(a.getAttribute('href') || '')) return false; // never leave the page
    return true;
  }
  function popButton(box, kind) {
    const btns = [...box.querySelectorAll('button, [role="button"], a[href^="#"], a[href^="javascript"], a:not([href]), input[type="button"], input[type="submit"], [aria-label*="close" i], [class*="close" i]')].filter(clickable);
    let best = null, score = 0;
    for (const b of btns) {
      const t = popText(b), label = (b.getAttribute('aria-label') || b.getAttribute('title') || '').trim();
      if (t.length > 60) continue;
      let sc = 0;
      if (POP_CLOSE.test(t) || /^(close|dismiss)\b/i.test(label) || (!t && /close|dismiss/i.test(b.className || ''))) sc = 3;
      else if (kind === 'cookie notice' && POP_ACCEPT.test(t)) sc = 2;
      if (!sc || (sc < 3 && POP_NEVER.test(t))) continue;
      if (sc > score) { best = b; score = sc; }
    }
    return best;
  }
  function closePopups() {
    const done = [], vw = innerWidth, vh = innerHeight;
    const press = (b, kind) => {
      const lab = (b.getAttribute('aria-label') || b.getAttribute('title') || '').trim(), txt = ((b.textContent || b.value || '')).replace(/\s+/g, ' ').trim();
      const t = (lab || (/^[×✕✖╳xX]$/.test(txt) ? 'close' : txt) || 'close').slice(0, 40);
      try { b.click(); done.push(kind + ' (pressed "' + t + '")'); return true; } catch (e) { return false; }
    };
    for (const sel of POP_KNOWN) {
      if (done.length >= 4) break;
      let el = null; try { el = document.querySelector(sel); } catch (e) { /* odd selector */ }
      if (el && clickable(el)) press(el, 'cookie notice');
    }
    const boxes = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      const modal = el.getAttribute('role') === 'dialog' || el.getAttribute('aria-modal') === 'true' || el.tagName === 'DIALOG';
      if (!modal && cs.position !== 'fixed' && cs.position !== 'sticky') continue;
      if (!isShown(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width * r.height < vw * vh * 0.02 || r.bottom <= 0 || r.top >= vh) continue;
      if (boxes.some(b => b.contains(el))) continue;
      boxes.push(el);
    }
    for (const box of boxes) {
      if (done.length >= 4) break;
      if (box.querySelector('video, article, main, input[type="password"]')) continue; // the page itself, or a log-in wall
      const text = (box.innerText || '').slice(0, 1500);
      if (text.length > 1500 || !text) continue;
      const kind = (POP_KINDS.find(([, re]) => re.test(text)) || [])[0];
      if (!kind) continue;
      const b = popButton(box, kind);
      if (b) press(b, kind);
    }
    return done;
  }

  // Side bars and menus have their own "More" buttons (TikTok's opens a settings panel). Skip them.
  function isMenuButton(el) {
    if (el.closest('nav, aside, header, [role="navigation"], [role="menu"], [role="menubar"], [role="tablist"]')) return true;
    for (let up = el, i = 0; up && i < 4; up = up.parentElement, i++) {
      if (up.hasAttribute('aria-haspopup')) return true;
      const clickable = /^(BUTTON|A)$/.test(up.tagName) || up.getAttribute('role') === 'button';
      if (clickable && up.querySelector('svg, img')) return true;   // icon + "More" = a menu item
    }
    return false;
  }

  function isClamped(el) {
    const cs = getComputedStyle(el);
    const clamp = cs.webkitLineClamp && cs.webkitLineClamp !== 'none';
    const ellipsis = cs.textOverflow === 'ellipsis' && cs.overflow !== 'visible';
    if (!clamp && !ellipsis) return false;
    if ((el.textContent || '').trim().length < 30 || el.querySelector('video, img, svg')) return false;
    return el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2;
  }
  function clampedOnScreen() {
    const vh = window.innerHeight, vw = document.documentElement.clientWidth;
    return [...document.querySelectorAll('span, div, h1, p')].filter(el => {
      if (!isClamped(el)) return false;
      const r = el.getBoundingClientRect();
      return r.width >= 4 && r.bottom >= 0 && r.top <= vh && r.right >= 0 && r.left <= vw;
    });
  }
  // Last resort, if the site did not open it: lift the styling limit so the full text shows.
  function unclamp() {
    if (!SOCIAL.test(location.hostname) || !isReelPage()) return 0;
    let n = 0;
    for (const el of clampedOnScreen()) {
      unclamped.push([el, el.getAttribute('style')]);
      for (const [k, v] of [['-webkit-line-clamp', 'unset'], ['line-clamp', 'unset'], ['max-height', 'none'], ['overflow', 'visible'], ['text-overflow', 'clip'], ['white-space', 'normal']]) el.style.setProperty(k, v, 'important');
      n++;
    }
    return n;
  }

  // Does this element snap one item per screen when scrolled up and down?
  function snapsVertically(el) {
    const t = getComputedStyle(el).scrollSnapType || '';
    return /\b(y|block|both)\b/.test(t);
  }

  // 4.17: is this big scrolling box the page itself? A details panel that slid in from the side
  // (like a business search result opening on the right) is NOT: it becomes a numbered section,
  // and the page around it is kept as it looks, instead of a narrow strip with blank space beside it.
  function looksLikePage(el, vw) {
    const r = el.getBoundingClientRect();
    return r.width >= 0.6 * vw && r.left <= 0.25 * vw;
  }

  // 4.17: pages with a pop-up window open often lock the page behind it so it can't scroll.
  function rootLocked() {
    const h = getComputedStyle(document.documentElement).overflowY, b = document.body ? getComputedStyle(document.body).overflowY : '';
    return /hidden|clip/.test(h) || (/hidden|clip/.test(b) && h === 'visible');
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
    const body = document.body;
    // 4.17: some sites make <body> itself the scrolling box (the window stays still).
    if (body && se !== body && se.scrollHeight <= vh + 5 && /(auto|scroll|overlay)/.test(getComputedStyle(body).overflowY) && body.scrollHeight - body.clientHeight >= 20) {
      pageEl = body;
      pageElStart = body.scrollTop;
    } else if (found.length && se.scrollHeight <= vh + 5 && visibleArea(found[0]) >= 0.4 * vw * vh && looksLikePage(found[0], vw)) {
      pageEl = found.shift();
      pageElStart = pageEl.scrollTop;
    }
    // One-post-per-screen feeds (Instagram/Facebook Reels, YouTube Shorts, TikTok): scrolling only brings the next post,
    // so keep the post on screen and capture just that.
    const reelUrl = isReelPage();
    // Only on social sites: ordinary websites with full-screen snapping sections are still captured in full.
    const snaps = (pageEl && snapsVertically(pageEl)) || snapsVertically(se) || (document.body && snapsVertically(document.body));
    single = (SOCIAL.test(location.hostname) && snaps)
      || (reelUrl && (pageEl || se.scrollHeight <= vh + 5 || [...found].some(el => el.scrollHeight >= 2 * el.clientHeight && visibleArea(el) >= 0.3 * vw * vh)));
    if (single && !pageEl && found.length && visibleArea(found[0]) >= 0.3 * vw * vh && found[0].scrollHeight >= 2 * found[0].clientHeight) {
      pageEl = found.shift();  // the feed box itself is not a section
      pageElStart = pageEl.scrollTop;
    }

    locked = !single && !pageEl && se.scrollHeight > vh + 5 && rootLocked();
    found = found.filter(el => visibleArea(el) > 0 || el.getBoundingClientRect().height > 0).slice(0, MAX_SECTIONS);
    targets = found.map(el => {
      const ax = scrollAxes(el);
      return { kind: 'scroll', el, axes: ax, label: labelFor(el), startTop: el.scrollTop, startLeft: el.scrollLeft };
    });

    // Dropdown lists: write out every choice.
    for (const sel of [...document.querySelectorAll('select')].filter(isShown).slice(0, 20)) {
      const lab = (sel.labels && sel.labels[0] && sel.labels[0].textContent) || sel.getAttribute('aria-label') || sel.name || sel.id || 'Dropdown list';
      targets.push({ kind: 'select', el: sel, label: lab.replace(/\s+/g, ' ').trim().slice(0, 70),
        options: [...sel.options].slice(0, 300).map(o => ({ text: o.text.trim() || o.value, selected: o.selected, disabled: o.disabled })) });
    }

    targets.forEach((t, i) => { t.n = i + 1; t.outline = t.el.style.outline; });
    startTotal = pageEl ? pageEl.scrollHeight : Math.max(se.scrollHeight, document.body ? document.body.scrollHeight : 0);
    findEnd();
    calmOn();

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
      single,
      locked,
      sections: targets.map(t => ({ n: t.n, kind: t.kind, label: t.label, axes: t.axes, options: t.options })),
      html,
      blocked: blockedSigns()
    };
  }

  // 4.15: does this look like a page that is NOT the real page? (A login wall, "page not found",
  // a robot check, "access denied", or an empty page.) Only words actually on screen count.
  function blockedSigns() {
    try {
      const vis = el => { const r = el.getBoundingClientRect(); const st = getComputedStyle(el); return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none'; };
      const text = ((document.body && document.body.innerText) || '').replace(/\s+/g, ' ').trim();
      const head = [document.title, ...[...document.querySelectorAll('h1, h2, [role="heading"]')].filter(vis).slice(0, 6).map(h => h.innerText)].join(' | ');
      const top = head + ' | ' + text.slice(0, 1500);
      const pics = [...document.images].filter(i => i.naturalWidth >= 150 && vis(i)).length;
      const robot = /(verify(ing)? (that )?you are (a )?human|are you a robot|i'?m not a robot|checking (if the site connection is secure|your browser)|just a moment\.\.\.|press (&|and) hold|unusual traffic from your|attention required|captcha)/i;
      if (robot.test(top) || document.querySelector('iframe[src*="captcha"], iframe[src*="challenges.cloudflare"], #challenge-form')) return { kind: 'robot', why: 'a robot check ("are you human?") covering the page' };
      if (/\b(access denied|403 forbidden|you don'?t have permission to access|request blocked|you have been blocked)\b/i.test(top)) return { kind: 'denied', why: 'an "Access denied" message instead of the page' };
      if (/\b(404|page not found|page (does not|doesn'?t) exist|this page (isn'?t|is not) available|content (isn'?t|is not) available|no longer available|post (isn'?t|is not) available|sorry, this page|we couldn'?t find (that|this) page|video unavailable|account suspended|this account doesn'?t exist)\b/i.test(head + ' | ' + text.slice(0, 600))) return { kind: 'gone', why: 'a "page not found" or "not available" message' };
      const login = /((log|sign) ?in|create an account|sign up) (to (continue|see|view|read|keep)|for (full )?access)|you must (log|sign) ?in|(log|sign) ?in to (instagram|facebook|x|twitter|linkedin|pinterest|tiktok)|subscribe to (continue|keep) reading|this content is for subscribers/i;
      const pass = [...document.querySelectorAll('input[type="password"]')].some(vis);
      if (login.test(top) && (pass || pics < 3 || text.length < 3000)) return { kind: 'login', why: 'a "log in to continue" or subscriber wall covering the page' };
      if (text.length < 40 && pics === 0) return { kind: 'empty', why: 'an empty page (no words or pictures showed)' };
    } catch (e) { /* page too odd to read */ }
    return null;
  }

  // Allow some growth (pictures loading in), but not endless new articles.
  // 4.17: pictures loading in can make a page much more than a quarter taller. So the end follows
  // whatever was LAST on the page when capture began: things added after it (new posts) are left
  // out, but anything above it growing taller just pushes it (and the end) further down.
  const cap = (h, view) => (endEl && endEl.isConnected ? Math.max(h, endNow()) : Math.max(h * 1.25, h + view));
  function findEnd() {
    endEl = null;
    const box = pageEl || document.body;
    if (!box) return;
    let el = box;
    for (let depth = 0; depth < 40; depth++) {
      const kids = [...el.children].filter(c => {
        if (badges.includes(c) || /^(SCRIPT|STYLE|LINK|META|TEMPLATE|NOSCRIPT)$/.test(c.tagName)) return false;
        const cs = getComputedStyle(c), r = c.getBoundingClientRect();
        return cs.display !== 'none' && r.height > 0 && cs.position !== 'fixed' && cs.position !== 'absolute';
      });
      if (!kids.length) break;
      el = kids.reduce((a, b) => (b.getBoundingClientRect().bottom >= a.getBoundingClientRect().bottom ? b : a));
    }
    if (el === box) return;
    const gap = startTotal - docBottom(el);
    // Only trust it if it really sat at the end (within half a screen of the bottom).
    if (gap < -2 || gap > 0.5 * (pageEl ? pageEl.clientHeight : window.innerHeight)) return;
    endEl = el;
    endGap = Math.max(0, gap);
  }
  function docBottom(el) {
    const r = el.getBoundingClientRect();
    if (pageEl) return r.bottom - pageEl.getBoundingClientRect().top - pageEl.clientTop + pageEl.scrollTop;
    return r.bottom + window.scrollY;
  }
  function endNow() {
    if (!endEl || !endEl.isConnected) return 0;
    return Math.ceil(docBottom(endEl) + endGap);
  }

  // 4.17: wide bars stuck to the bottom of the screen (cookie bars, "Add to cart", chat bars) cover
  // the last bit of the first screen. Leave that bit for the next screen, where the bar is hidden.
  function bottomCover() {
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    let top = vh;
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
      if (badges.includes(el) || cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
      if (targets.some(t => el.contains(t.el)) || (pageEl && el.contains(pageEl))) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom < vh - 2 || r.top < vh * 0.6 || r.width < 0.5 * vw || r.height < 8) continue;
      top = Math.min(top, Math.max(0, Math.floor(r.top)));
    }
    return vh - top;
  }

  // Scroll the main page to y and say which part of the screen to keep,
  // where it goes in the final picture, and where to scroll next.
  function scrollPage(y) {
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    let res;
    if (single || locked) {
      // Leave the feed exactly where it is: one screen only. (Or the page is locked behind a pop-up window.)
      res = { crop: { x: 0, y: 0, w: vw, h: vh }, destY: 0, total: vh, next: vh, done: true, grew: false };
    } else if (!pageEl) {
      const se = scroller();
      window.scrollTo({ left: 0, top: y, ...instant });
      const live = Math.max(se.scrollHeight, document.body ? document.body.scrollHeight : 0);
      const total = Math.min(live, cap(startTotal, vh));
      const at = window.scrollY;
      const cover = at + vh >= total - 1 ? 0 : bottomCover();
      res = { crop: { x: 0, y: 0, w: vw, h: vh - cover }, destY: at, total, next: at + vh - cover, done: at + vh >= total - 1, grew: live > total };
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
  // 4.17: "sticky" things (headings in long lists, table column titles, side columns) are turned
  // back into ordinary parts of the page instead of hidden, so each shows once in its own place
  // (hiding them left blank bands all down the page). Fixed side panels that slid in are hidden
  // too (their contents are captured as a numbered section, where they are shown again).
  // Big empty backgrounds and dimmed backdrops stay, so later screens don't turn blank.
  function hideFixed() {
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    for (const el of document.querySelectorAll('body *')) {
      if (badges.includes(el) || hidden.some(h => h[0] === el) || unstuck.some(u => u[0] === el)) continue;
      const pos = getComputedStyle(el).position;
      if (pos !== 'fixed' && pos !== 'sticky') continue;
      if (pageEl && el.contains(pageEl)) continue;
      if (pos === 'sticky') {
        unstuck.push([el, el.getAttribute('style')]);
        for (const [k, v] of [['position', 'relative'], ['top', 'auto'], ['bottom', 'auto'], ['left', 'auto'], ['right', 'auto'], ['inset', 'auto']]) el.style.setProperty(k, v, 'important');
        continue;
      }
      if (isBackdrop(el, vw, vh)) continue;
      hidden.push([el, el.style.visibility]);
      el.style.setProperty('visibility', 'hidden', 'important');
    }
  }
  // A big fixed layer with nothing to read in it: a background picture/colour or a dimmed backdrop.
  function isBackdrop(el, vw, vh) {
    const r = el.getBoundingClientRect();
    if (r.width * r.height < 0.5 * vw * vh) return false;
    if (targets.some(t => el.contains(t.el))) return false;
    return !(el.innerText || '').trim() && !el.querySelector('input, button, a[href], select, textarea, iframe');
  }
  // Put back anything hidden that holds this section, so the section can be photographed.
  function showFor(el) {
    for (let i = hidden.length - 1; i >= 0; i--) {
      const [h, v] = hidden[i];
      if (h.contains(el)) { h.style.visibility = v; hidden.splice(i, 1); }
    }
  }

  // 4.17: fade-ins and slide-ins (boxes that glide in from the sides as you scroll) are finished
  // straight away while the capture runs, so no screen catches them half-way (blank or faded).
  function calmOn() {
    if (calm) return;
    calm = document.createElement('style');
    calm.textContent = '*,*::before,*::after{transition-duration:0s!important;transition-delay:0s!important;animation-duration:0s!important;animation-delay:0s!important;animation-iteration-count:1!important;scroll-behavior:auto!important}';
    document.documentElement.appendChild(calm);
    finishAnims();
  }
  function finishAnims() {
    try {
      for (const a of document.getAnimations()) {
        const end = a.effect && a.effect.getComputedTiming().endTime;
        if (end && isFinite(end) && a.playState === 'running') a.finish();
      }
    } catch (e) { /* older browser */ }
  }
  const frames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  // 4.17: after each scroll, wait (up to 3 seconds) for pictures on screen to finish loading and the
  // page to stop changing, so late pictures don't come out blank.
  async function settle() {
    const t0 = Date.now(), vw = document.documentElement.clientWidth, vh = window.innerHeight;
    let last = Date.now();
    const mo = new MutationObserver(() => { last = Date.now(); });
    try { mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'srcset', 'style', 'class'] }); } catch (e) { /* none */ }
    const onScreen = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw; };
    // Pictures set as backgrounds: load each one on screen again (it comes from the browser's
    // memory once the page has it), and wait for that.
    const bgs = new Map();
    const bgScan = () => {
      for (const el of document.querySelectorAll('body *')) {
        if (bgs.size >= 80) break;
        const bi = el.style.backgroundImage || (el.childElementCount < 4 ? getComputedStyle(el).backgroundImage : '');
        const m = bi && bi.match(/url\(["']?([^"')]+)["']?\)/);
        if (!m || bgs.has(m[1]) || m[1].startsWith('data:') || !onScreen(el)) continue;
        const im = new Image(); im.src = m[1]; bgs.set(m[1], im);
      }
    };
    try {
      for (;;) {
        finishAnims();
        if (Date.now() - t0 < 1500) bgScan();
        const waiting = [...document.images].some(i => !i.complete && onScreen(i)) || [...bgs.values()].some(i => !i.complete);
        if ((!waiting && Date.now() - last >= 250) || Date.now() - t0 > 3000) break;
        await new Promise(r => setTimeout(r, 80));
      }
    } finally { mo.disconnect(); }
    finishAnims();
    await frames();
    return true;
  }

  // 4.17: after the last screen's pictures loaded, is there now more page below it? (Pictures
  // loading in on the last screen can push the end down.)
  function moreBelow(bottom) {
    if (single || locked) return false;
    let total;
    if (pageEl) total = Math.min(pageEl.scrollHeight, cap(startTotal, pageEl.clientHeight)) + Math.max(0, pageEl.getBoundingClientRect().top);
    else { const se = scroller(); total = Math.min(Math.max(se.scrollHeight, document.body ? document.body.scrollHeight : 0), cap(startTotal, window.innerHeight)); }
    return total > bottom + 1;
  }

  function grewNow() {
    if (single) return false;
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
    if (first) { showFor(t.el); t.el.scrollIntoView({ block: 'start', inline: 'nearest', ...instant }); }
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

  function restore() {
    guardOff();
    ovRemove();
    removeBadges();
    hidden.forEach(([el, v]) => { el.style.visibility = v; });
    hidden.length = 0;
    unstuck.forEach(([el, st]) => { if (st === null) el.removeAttribute('style'); else el.setAttribute('style', st); });
    unstuck.length = 0;
    if (calm) { calm.remove(); calm = null; }
    locked = false; endEl = null;
    unclamped.forEach(([el, st]) => { if (st === null) el.removeAttribute('style'); else el.setAttribute('style', st); });
    unclamped.length = 0;
    targets.forEach(t => {
      if (!t.el.isConnected) return;
      if (t.kind === 'scroll') { t.el.scrollTop = t.startTop; t.el.scrollLeft = t.startLeft; }
    });
    if (pageEl && pageEl.isConnected && !single) pageEl.scrollTop = pageElStart;
    if (start) window.scrollTo({ left: start.x, top: start.y, ...instant });
  }

  // The progress card in the corner while a capture runs. It sits outside <body> in its own
  // closed shadow, so the page's styles can't change it, and it is hidden before every screenshot.
  let ov = null, ovText = null, ovSteps = null, ovCount = null, ovBox = null;
  // UI overhaul batch 8: four steps filling in, "Screen 6 of 14", a calmer outlined Stop, and the
  // light or dark look you picked in PageProof.
  const OV_STEPS = ['Screens', 'Scroll boxes', 'Pictures', 'PDF and timestamps'];
  function ovShow(title, step) {
    if (!ov) {
      ov = document.createElement('pageproof-progress');
      ov.style.cssText = 'all:initial;position:fixed;z-index:2147483647;right:16px;bottom:16px;display:block';
      const sh = ov.attachShadow({ mode: 'closed' });
      sh.innerHTML = '<style>' +
        '.c{--bg:#FFFFFF;--ink:#22252E;--mut:#5E6582;--line:#D9DCE5;--acc:#0077C2;--ok:#11795A;--bad:#BF2A3F;font:14px/1.4 system-ui,Segoe UI,Arial,sans-serif;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:16px;padding:14px 16px;box-shadow:0 12px 40px rgba(0,0,0,.25);display:flex;flex-direction:column;gap:10px;width:330px;box-sizing:border-box}' +
        '.c.dark{--bg:#191C24;--ink:#FFFFFF;--mut:#AEB3CA;--line:#2C2E33;--acc:#0090E7;--ok:#00D25B;--bad:#FC424A}' +
        '.t{display:flex;align-items:center;gap:10px}i.sp{width:16px;height:16px;border-radius:50%;border:2px solid var(--line);border-top-color:var(--acc);animation:s .8s linear infinite;flex-shrink:0}@keyframes s{to{transform:rotate(360deg)}}' +
        'b{display:block;font-size:14.5px;white-space:nowrap}.n{color:var(--acc);font-weight:700;font-variant-numeric:tabular-nums;margin-left:auto;white-space:nowrap;font-size:13px}' +
        'ol{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,1fr);gap:6px}' +
        'li{display:flex;flex-direction:column;gap:4px;font-size:11.5px;color:var(--mut)}li::before{content:"";height:4px;border-radius:4px;background:var(--line)}' +
        'li.on{color:var(--ink);font-weight:600}li.on::before{background:var(--acc)}li.done::before{background:var(--ok)}' +
        '.m{color:var(--mut);font-size:12.5px;margin:0}' +
        'button{font:inherit;font-weight:600;font-size:13px;align-self:flex-start;background:transparent;color:var(--bad);border:1.5px solid var(--bad);border-radius:9px;padding:5px 14px;cursor:pointer}button:hover{background:color-mix(in srgb,var(--bad) 10%,transparent)}</style>' +
        '<div class="c" role="status"><div class="t"><i class="sp"></i><b>PageProof is capturing</b><span class="n"></span></div><ol>' + OV_STEPS.map(t => '<li>' + t + '</li>').join('') + '</ol><p class="m"></p><button type="button">Stop</button></div>';
      ovBox = sh.querySelector('.c'); ovText = sh.querySelector('.m'); ovSteps = [...sh.querySelectorAll('li')]; ovCount = sh.querySelector('.n');
      try { chrome.storage.local.get('ppTheme').then(r => { if (ovBox) ovBox.classList.toggle('dark', r.ppTheme === 'dark'); }).catch(() => {}); } catch (e) { /* light */ }
      sh.querySelector('button').onclick = () => { try { chrome.runtime.sendMessage({ type: 'stop' }); } catch (e) { /* reloaded */ } ovText.textContent = 'Stopping, keeping what was captured…'; };
      document.documentElement.appendChild(ov);
    }
    // step: the step number (1 = Screens, 2 = Scroll boxes); title: "Screen 6 of 14"
    const n = typeof step === 'number' ? step : /Step 2/.test(String(step || '')) ? 2 : 1;
    ovSteps.forEach((li, i) => { li.className = i + 1 < n ? 'done' : i + 1 === n ? 'on' : ''; });
    ovCount.textContent = title || '';
    ovText.textContent = 'Keep this tab open. This card is never in the screenshots.';
    ov.style.display = 'block';
  }
  // Hidden, and the browser has drawn the page without it.
  function ovHide() {
    if (ov) ov.style.display = 'none';
    return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))));
  }
  function ovRemove() { if (ov) ov.remove(); ov = null; }

  // 4.15 hands off: while a capture runs, your mouse wheel and scrolling keys don't move the page
  // (PageProof is scrolling it), and anything else you do (dragging the scroll bar, clicking) is
  // noticed, so that screen is taken again instead of making a broken join in the evidence.
  let touched = 0, guarding = false;
  const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar']);
  const stopScroll = e => {
    if (!e.isTrusted) return;
    if (e.type === 'keydown' && !SCROLL_KEYS.has(e.key)) return;
    e.preventDefault(); touched = Date.now();
    if (ovText) ovText.textContent = 'Hands off for a moment: PageProof is scrolling the page for you.';
  };
  const noticed = e => { if (e.isTrusted && !(ov && e.composedPath && e.composedPath().includes(ov))) touched = Date.now(); };
  function guardOn() {
    if (guarding) return; guarding = true;
    for (const t of ['wheel', 'touchmove', 'keydown']) addEventListener(t, stopScroll, { capture: true, passive: false });
    addEventListener('mousedown', noticed, true);
  }
  function guardOff() {
    if (!guarding) return; guarding = false;
    for (const t of ['wheel', 'touchmove', 'keydown']) removeEventListener(t, stopScroll, { capture: true, passive: false });
    removeEventListener('mousedown', noticed, true);
  }
  const touchedAt = () => touched;
  function ovNote(text) { if (ovText) ovText.textContent = text; }

  window.__pageproof = { settle, moreBelow, closePopups, expandMore, unclamp, prepare, scrollPage, hideFixed, removeBadges, scrollSection, grewNow, restore, ovShow, ovHide, ovRemove, guardOn, guardOff, touchedAt, ovNote };
})();
