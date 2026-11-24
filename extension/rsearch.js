// Reverse image search helper. Runs on Google, Yandex and Bing pages, but only does
// anything in a tab that PageProof's reverse search page opened (it asks first).
// It hands the picture to the site's own upload box, then reads the links from the results.
(() => {
  if (window.__ppRs || window.top !== window) return;
  window.__ppRs = true;
  const api = globalThis.browser || globalThis.chrome;
  const host = location.hostname;
  const engine = /(^|\.)google\.[a-z.]+$/.test(host) ? 'google' : /(^|\.)yandex\.[a-z.]+$/.test(host) ? 'yandex' : /(^|\.)bing\.com$/.test(host) ? 'bing' : null;
  if (!engine) return;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const send = msg => { try { return api.runtime.sendMessage(msg); } catch (e) { return Promise.resolve(null); } };

  // Sites that belong to the search engines themselves never count as a match.
  const OWN = /(^|\.)(google\.[a-z.]+|gstatic\.com|googleusercontent\.com|googleapis\.com|googlesyndication\.com|doubleclick\.net|yandex\.[a-z.]+|ya\.ru|yastatic\.net|yandex\.net|bing\.com|bing\.net|bingapis\.com|microsoft\.com|msn\.com|live\.com|microsoftonline\.com)$/i;

  // ---------- spotting "are you a robot" checks ----------
  function robotCheck() {
    const p = location.pathname, t = (document.title + ' ' + (document.body ? document.body.innerText.slice(0, 1500) : '')).toLowerCase();
    if (engine === 'google') return p.startsWith('/sorry') || !!document.querySelector('#captcha-form, form[action*="sorry"]');
    if (engine === 'yandex') return /showcaptcha|checkcaptcha/.test(p) || !!document.querySelector('.CheckboxCaptcha, .AdvancedCaptcha, form[action*="captcha"]');
    return !!document.querySelector('#b_captcha, iframe[src*="challenges.cloudflare"], iframe[src*="captcha"]') || /verify you are a human|one last step|solve the challenge/.test(t);
  }

  // ---------- handing the picture over ----------
  async function pictureFile(pic) {
    const blob = await (await fetch(pic.dataUrl)).blob();
    return new File([blob], pic.name || 'picture.jpg', { type: blob.type || 'image/jpeg' });
  }
  function setFile(input, file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  async function findInput(selectors, buttons, ms) {
    const until = Date.now() + ms;
    let clicked = false;
    while (Date.now() < until) {
      for (const s of selectors) { const el = document.querySelector(s); if (el) return el; }
      if (!clicked && Date.now() > until - ms / 2) {
        for (const s of buttons) { const b = document.querySelector(s); if (b) { b.click(); clicked = true; break; } }
      }
      await sleep(300);
    }
    return null;
  }

  async function upload(pic) {
    const file = await pictureFile(pic);
    try { sessionStorage.removeItem('ppGoogleExact'); } catch (e) { /* fine */ }
    await send({ type: 'rsStage', stage: 'results' });
    if (engine === 'google') {
      // Google Lens's own upload form. Same thing that happens when you drop a picture on Lens.
      const form = document.createElement('form');
      form.method = 'POST';
      form.enctype = 'multipart/form-data';
      form.action = 'https://lens.google.com/v3/upload?hl=en&re=df&st=' + Date.now() + '&ep=gisbubb';
      const input = document.createElement('input');
      input.type = 'file'; input.name = 'encoded_image'; input.hidden = true;
      form.append(input);
      document.documentElement.append(form);
      const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files;
      form.submit();
      return;
    }
    if (engine === 'yandex') {
      const input = await findInput(['input.CbirCore-FileInput', 'input[type=file][accept*="image"]', 'input[type=file]'],
        ['[class*="CbirButton"]', 'button[aria-label*="image" i]', '[class*="cbir" i] button'], 10000);
      if (!input) throw new Error('Yandex upload box not found');
      setFile(input, file);
      return;
    }
    const input = await findInput(['#sb_fileinput', 'input[type=file][accept*="image"]', 'input[type=file]'],
      ['#sbi_b', '[aria-label*="Search using an image" i]', '[aria-label*="visual search" i]'], 10000);
    if (!input) throw new Error('Bing upload box not found');
    sessionStorage.removeItem('ppBingHop');
    setFile(input, file);
  }

  // ---------- reading the links ----------
  const realUrl = href => {
    try {
      const u = new URL(href, location.href);
      if (/google\./.test(u.hostname) && u.pathname === '/url') return u.searchParams.get('q') || u.searchParams.get('url') || '';
      if (/bing\.com$/.test(u.hostname) && u.pathname.startsWith('/ck/')) {
        const v = u.searchParams.get('u') || '';
        if (v.startsWith('a1')) return atob(v.slice(2).replace(/-/g, '+').replace(/_/g, '/'));
        return '';
      }
      return u.href;
    } catch (e) { return ''; }
  };
  const external = href => {
    const r = realUrl(href);
    if (!/^https?:/i.test(r)) return '';
    try { return OWN.test(new URL(r).hostname) ? '' : r; } catch (e) { return ''; }
  };
  const sizeIn = text => {
    // "1,024x682" or "1024 × 682". Ignore numbers glued to other digits (post ids and so on).
    const n = '(\\d{1,2},\\d{3}|\\d{2,5})';
    for (const m of String(text || '').matchAll(new RegExp('(?<![\\d,.])' + n + '\\s*[×xX]\\s*' + n + '(?![\\d,])', 'g'))) {
      const w = +m[1].replace(',', ''), h = +m[2].replace(',', '');
      if (w >= 50 && h >= 50 && w <= 20000 && h <= 20000) return { w, h };
    }
    return {};
  };
  // 4.37.2: Google (and Yandex) put a tiny blank placeholder in a result's picture until it is
  // scrolled into view, and keep the real one in a data-... attribute. A placeholder is not a
  // picture: the real one is used instead, or nothing (so it is never mistaken for the thumb).
  const PLACEHOLDER = s => /^data:/i.test(s) && s.length < 400;
  const imgSrc = img => {
    if (!img) return '';
    const tries = [img.currentSrc, img.src, img.getAttribute('data-src'), img.getAttribute('data-iurl'), img.getAttribute('data-lazy-src'), img.getAttribute('data-original')];
    for (const s of tries) {
      if (!s || PLACEHOLDER(s) || !/^(https?:|data:image)/.test(s) || s.length >= 200000) continue;
      try { return new URL(s, location.href).href; } catch (e) { /* not an address */ }
    }
    return '';
  };
  // Big enough to be a result's picture (not an icon), even before it has loaded.
  const bigEnough = i => Math.max(i.naturalWidth || 0, i.width || 0, +i.getAttribute('width') || 0, i.getBoundingClientRect().width || 0) > 40;
  const RS_HOST = u => { try { return new URL(u).hostname.replace(/^(www|m|mobile)\./, ''); } catch (e) { return ''; } };
  const clean = s => (s || '').replace(/\s+/g, ' ').trim().slice(0, 300);

  function yandexLinks() {
    const out = [];
    for (const it of document.querySelectorAll('.CbirSites-Item')) {
      const a = it.querySelector('.CbirSites-ItemTitle a') || it.querySelector('a.CbirSites-ItemDomain');
      const url = a && external(a.href);
      if (!url) continue;
      const thumbA = it.querySelector('.CbirSites-ItemThumb a');
      const mark = it.querySelector('.Thumb-Mark');
      out.push({ url, title: clean(a.textContent), thumb: imgSrc(it.querySelector('img')), img: thumbA ? realUrl(thumbA.href) : '',
        ...sizeIn(mark && mark.textContent), exact: true });
    }
    return out;
  }
  // Bing. Two lists are read off its results page:
  //  1. "Pages with this image" (.vs-erci): pages Bing itself says show the same picture.
  //  2. 4.37.1: "Visual matches" (.iacfmit), top 60, the same way Google's are read. Each one
  //     carries the picture's own address (mediaurl), so PageProof's checker can compare it and
  //     throw out the look-alikes as "Different photo". (4.36.1 left these out; before that they
  //     were read without their pictures, which showed as "Picture blocked".)
  // Nothing else on the page is read.
  function bingLinks() {
    const out = [];
    for (const it of bingDocs().flatMap(d => [...d.querySelectorAll('.vs-erci')])) {
      const a = it.querySelector('a.vs-erlink, a[href]');
      const url = a && external(a.href);
      if (!url) continue;
      const t = it.querySelector('.vs-et');
      out.push({ url, title: clean(t ? t.textContent : a.textContent), thumb: imgSrc(it.querySelector('.vs-eri img')) || imgSrc(it.querySelector('img:not([src*="favicon"])')),
        ...sizeIn((it.querySelector('.vs-eod') || it).textContent), exact: true });
    }
    // Bing changed the list's look: still only the links inside that one section.
    const sec = bingDocs().map(d => d.querySelector('.vs-ema')).find(Boolean);
    if (!out.length && sec) {
      for (const a of sec.querySelectorAll('a[href]')) {
        const url = external(a.href);
        if (url) out.push({ url, title: clean(a.textContent), thumb: imgSrc(a.querySelector('img:not([src*="favicon"])')), exact: true });
      }
    }
    if (location.pathname === '/search') out.push(...bingVisual().slice(0, 60));
    return out;
  }
  function bingVisual() {
    const out = [];
    for (const it of document.querySelectorAll('.iacfmit')) {
      const a = it.querySelector('a[m]');
      let m = {};
      try { m = JSON.parse(a ? a.getAttribute('m') : '{}') || {}; } catch (e) { /* no details */ }
      let url = m.purl ? external(m.purl) : '';
      if (!url) { const d = it.querySelector('a.iacf_dm, .iacf_info a[href]'); url = d ? external(d.href) : ''; }
      if (!url) continue;
      let img = m.murl || '';
      if (!img) for (const h of [m.url, a && a.getAttribute('href')]) {
        try { const v = h && new URL(h, location.href).searchParams.get('mediaurl'); if (v) { img = v; break; } } catch (e) { /* not an address */ }
      }
      if (!/^https?:/i.test(img)) img = '';
      const q = h => { try { return new URL(String(h || ''), location.href).searchParams; } catch (e) { return new URLSearchParams(); } };
      const sp = q(m.url || (a && a.getAttribute('href'))), w = +sp.get('expw'), h = +sp.get('exph');
      out.push({ url, title: clean(m.t || (a && a.getAttribute('aria-label')) || ''), thumb: imgSrc(it.querySelector('img')), img,
        ...(w > 0 && h > 0 ? { w, h } : {}), exact: false });
    }
    return out;
  }
  // Bing's own results page is showing (its "Pages with this image" tab is there), so no links
  // means Bing found no pages with this picture, not that Bing is broken.
  const bingPageOk = () => location.pathname === '/search' && !!(document.querySelector('.vs-ema') || document.querySelector('a[href*="vsa=3"]'));
  // Works on any layout: every link that leaves the search site, with the text and picture
  // nearest to it. Used for Google, and as a backup when the other sites change their pages.
  function genericLinks(exact) {
    const byUrl = new Map();
    // Each link's real address is worked out once. (It was worked out again for every link
    // around every link, which took seconds on Google's long "Visual matches" pages.)
    const memo = new Map();
    const extOf = a => { let v = memo.get(a); if (v === undefined) { v = external(a.href); memo.set(a, v); } return v; };
    for (const a of document.querySelectorAll('a[href]')) {
      const url = extOf(a);
      if (!url || a.closest('header, footer, nav, [role="navigation"]')) continue;
      // The block around this link: grow until it would also hold a different result.
      let box = a;
      while (box.parentElement && box.parentElement !== document.body) {
        const p = box.parentElement;
        const others = [...p.querySelectorAll('a[href]')].some(o => { const u = extOf(o); return u && u !== url; });
        if (others) break;
        box = p;
      }
      const cur = byUrl.get(url) || { url, title: '', thumb: '', exact };
      const heading = box.querySelector('h3, h2, [role="heading"]');
      const text = clean(heading ? heading.textContent : (a.getAttribute('aria-label') || a.textContent));
      if (text.length > cur.title.length && !/^https?:/.test(text)) cur.title = text;
      // 4.30: a picture inside a link to somewhere else belongs to that other result (or to
      // Google's own preview of your upload), never to this link.
      const mine = i => {
        if (/favicon/i.test(i.src) || !bigEnough(i) || !imgSrc(i)) return false;
        const own = i.closest('a[href]');
        return !own || own === a || extOf(own) === url;
      };
      if (!cur.thumb) cur.thumb = imgSrc([...box.querySelectorAll('img')].find(mine));
      // 4.37.2: some results (Facebook posts, X posts, YouTube videos) carry a second link, to
      // the group, account or channel, so the block above stops at the link itself and its
      // picture sits just outside. Look a few steps further out, but only where this result is
      // the only one around and there is exactly one picture that can be its own.
      if (!cur.thumb) {
        let up = box;
        for (let k = 0; k < 4 && up.parentElement && up.parentElement !== document.body; k++) {
          up = up.parentElement;
          const urls = new Set([...up.querySelectorAll('a[href]')].map(extOf).filter(Boolean));
          if ([...urls].some(u => RS_HOST(u) !== RS_HOST(url))) break;     // another result is in here
          // The result's own title link decides whose picture it is (not the group or account link).
          const h = up.querySelector('a[href] h3, a[href] h2, a[href] [role="heading"]'), titleA = h && h.closest('a[href]');
          if (titleA && extOf(titleA) !== url) break;
          const pics = [...up.querySelectorAll('img')].filter(mine);
          if (pics.length === 1) { cur.thumb = imgSrc(pics[0]); break; }
          if (pics.length > 1) break;
        }
      }
      if (!cur.w) Object.assign(cur, sizeIn(box.textContent));
      byUrl.set(url, cur);
    }
    return [...byUrl.values()];
  }

  async function settle() {
    // Let the results appear, and scroll down a little so more of them load.
    let last = -1, same = 0;
    for (let i = 0; i < 24; i++) {
      const n = document.querySelectorAll('a[href]').length;
      if (n === last && n > 30) { if (++same >= 3) break; } else same = 0;
      last = n;
      if (i === 6 || i === 10) window.scrollTo(0, document.body.scrollHeight);
      await sleep(500);
    }
    // 4.37.2: walk down the whole list one screen at a time. Pictures only load when they come
    // into view; jumping straight to the bottom skipped the middle, and those results were read
    // with no picture ("Picture blocked").
    const stepH = Math.max(300, Math.round(innerHeight * 0.8));
    for (let y = 0, n = 0; y < document.body.scrollHeight && n < 60; y += stepH, n++) { window.scrollTo(0, y); await sleep(150); }
    await sleep(400);
    window.scrollTo(0, 0);
  }

  async function readResults() {
    await settle();
    if (robotCheck()) return send({ type: 'rsCaptcha' });
    let links = engine === 'yandex' ? yandexLinks() : engine === 'bing' ? bingLinks() : [];
    if (engine === 'google') {
      const u = new URL(location.href);
      if (u.searchParams.get('udm') === '48') {
        sessionStorage.setItem('ppGoogleExact', JSON.stringify(genericLinks(true)));
        send({ type: 'rsStage', stage: 'results', more: true });
        u.searchParams.set('udm', '26'); location.replace(u.href); return;
      }
      let exact = [];
      try { exact = JSON.parse(sessionStorage.getItem('ppGoogleExact') || '[]'); } catch (e) { /* none */ }
      sessionStorage.removeItem('ppGoogleExact');
      // Visual matches can be long and mostly look-alikes: keep the top 60. The line-up check hides the different photos.
      links = exact.concat(genericLinks(false).slice(0, 60));
    }
    // Never on Bing: the rest of its page is look-alike photos and related pages, not matches.
    if (!links.length && engine !== 'bing') links = genericLinks(true);
    // Drop duplicates and tiny junk.
    const seen = new Set();
    links = links.filter(l => l.url && !seen.has(l.url) && seen.add(l.url)).slice(0, 150);
    await send({ type: 'rsResults', links, pageUrl: location.href, pageOk: engine === 'bing' && bingPageOk() });
  }

  // ---------- which step are we on? ----------
  async function onResultsPage() {
    const u = new URL(location.href);
    if (engine === 'google') {
      if (u.hostname.startsWith('lens.')) return 'wait';
      if (u.pathname !== '/search') return 'wait';
      // Two pages: first Google's "Exact matches" (udm=48), then its "Visual matches" (udm=26),
      // which lists many more pages. PageProof's own line-up check sorts out which are really the same photo.
      const udm = u.searchParams.get('udm');
      const haveExact = sessionStorage.getItem('ppGoogleExact') !== null;
      if (udm === '48' || (udm === '26' && haveExact)) return 'read';
      u.searchParams.set('udm', haveExact ? '26' : '48');
      location.replace(u.href); return 'moved';
    }
    if (engine === 'yandex') {
      if (!u.searchParams.get('cbir_id')) return 'wait';
      if (u.searchParams.get('cbir_page') !== 'sites') { u.searchParams.set('cbir_page', 'sites'); location.replace(u.href); return 'moved'; }
      return 'read';
    }
    if (u.pathname === '/search' && u.searchParams.get('bcid')) {
      if (u.searchParams.get('vsa') !== '3') { u.searchParams.set('vsa', '3'); location.replace(u.href); return 'moved'; }
      return 'read';
    }
    // 4.37.1: a picture search on Bing first opens the picture in a pop-up box (view=detailV2)
    // over the Bing Images front page. The front page behind it is Bing's trending pictures
    // (sports news and so on), not results: that is what was being read before. The real list
    // is on Bing's results page (/search?...bcid...), reached from the box's "Visual search".
    if (u.pathname.startsWith('/images/search') && /detailv2/i.test(u.search)) return bingHop();
    return 'wait';
  }
  const bingBox = () => { try { const f = document.querySelector('#OverlayIFrame'); return f && f.contentDocument; } catch (e) { return null; } };
  const bingDocs = () => [document, bingBox()].filter(Boolean);
  let hopSince = 0;
  function bingHop() {
    if (!hopSince) hopSince = Date.now();
    // The box's own "Visual search" button: Bing's results page for this very picture.
    const box = bingBox();
    const btn = box && box.querySelector('.mivsb, [aria-label*="Visual search" i]');
    const tries = +(sessionStorage.getItem('ppBingHop') || 0);
    if (btn && tries < 2) {
      if (Date.now() - hopSince < 1500) return 'wait';           // let the box finish loading
      sessionStorage.setItem('ppBingHop', String(tries + 1));
      btn.click(); hopSince = Date.now() + 6000; return 'wait';
    }
    // No button: a link in the box to that results page.
    if (box) for (const a of box.querySelectorAll('a[href*="bcid="]')) {
      try {
        const t = new URL(a.getAttribute('href'), location.href);
        if (t.hostname.endsWith('bing.com') && t.pathname === '/search' && t.searchParams.get('bcid')) {
          t.searchParams.set('vsa', '3'); location.assign(t.href); return 'moved';
        }
      } catch (e) { /* not an address */ }
    }
    // Still here after 15 seconds: read whatever "Pages with this image" the box itself shows.
    return Date.now() - hopSince > 15000 ? 'read' : 'wait';
  }

  // PageProof's search tabs show the PageProof logo and name in the tab bar, so it is clear they
  // are PageProof's (and not tabs you opened). The site keeps trying to put its own icon back.
  const LOGO = 'data:image/png;base64,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';
  const ENGINE_NAME = { google: 'Google Lens', yandex: 'Yandex', bing: 'Bing' };
  let branded = false;
  function brand() {
    if (branded) return;
    branded = true;
    const want = '🔒 PageProof · ' + ENGINE_NAME[engine] + ' · leave open';
    const fix = () => {
      if (!document.head) return;
      // Every icon the site gives (some put theirs outside the head, or as a "shortcut icon"
      // or "apple-touch-icon"), not only the ones in the head.
      const links = document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="mask-icon"]');
      if (links.length !== 1 || links[0].href !== LOGO || links[0].parentNode !== document.head) {
        links.forEach(l => l.remove());
        const l = document.createElement('link'); l.rel = 'icon'; l.type = 'image/png'; l.href = LOGO; document.head.appendChild(l);
      }
      if (document.title !== want) document.title = want;
    };
    fix();
    if (!document.head) return;
    const opts = { childList: true, subtree: true, characterData: true };
    const mo = new MutationObserver(() => { mo.disconnect(); fix(); mo.observe(document.head, opts); });
    mo.observe(document.head, opts);
    // Yandex and Bing change the page without reloading it and can put their icon back from
    // outside the head: a cheap look every 2 seconds catches that too.
    setInterval(fix, 2000);
  }

  async function main() {
    // The logo goes on straight away when the background says this is one of PageProof's search
    // tabs (it used to wait for the results page's answer, which could come late or not at all).
    send({ type: 'rsIsMine' }).then(r => { if (r && r.mine) { if (document.head) brand(); else document.addEventListener('DOMContentLoaded', brand, { once: true }); } }).catch(() => {});
    const hi = await send({ type: 'rsHello', engine, url: location.href });
    if (!hi || !hi.task) return;                       // not one of PageProof's search tabs
    if (document.readyState === 'loading') await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
    brand();
    await sleep(800);
    if (robotCheck()) { send({ type: 'rsCaptcha' }); return; }
    try {
      if (hi.stage === 'upload') { await upload(hi.pic); }
      // Pages that change without reloading (Yandex, Bing): keep checking the address.
      const until = Date.now() + 40000;
      while (Date.now() < until) {
        if (robotCheck()) { send({ type: 'rsCaptcha' }); return; }
        const step = await onResultsPage();
        if (step === 'moved') return;
        if (step === 'read') { await readResults(); return; }
        await sleep(700);
      }
      if (hi.stage !== 'upload') send({ type: 'rsFail', why: 'The results page never appeared' });
    } catch (e) {
      send({ type: 'rsFail', why: String(e && e.message || e) });
    }
  }
  main();
})();
