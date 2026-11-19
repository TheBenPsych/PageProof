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
  const imgSrc = img => {
    if (!img) return '';
    const s = img.currentSrc || img.src || img.getAttribute('data-src') || '';
    return /^(https?:|data:image)/.test(s) && s.length < 200000 ? new URL(s, location.href).href : '';
  };
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
  function bingLinks() {
    const out = [];
    for (const it of document.querySelectorAll('.vs-erci')) {
      const a = it.querySelector('a.vs-erlink, a[href]');
      const url = a && external(a.href);
      if (!url) continue;
      const t = it.querySelector('.vs-et');
      out.push({ url, title: clean(t ? t.textContent : a.textContent), thumb: imgSrc(it.querySelector('.vs-eri img')) || imgSrc(it.querySelector('img:not([src*="favicon"])')),
        ...sizeIn((it.querySelector('.vs-eod') || it).textContent), exact: true });
    }
    for (const it of document.querySelectorAll('.iacfmit')) {
      const a = it.querySelector('.iacf_tt a') || it.querySelector('a.iacf_imglnk');
      const url = a && external(a.href);
      if (!url) continue;
      out.push({ url, title: clean(a.getAttribute('title') || a.textContent), thumb: imgSrc(it.querySelector('img')), exact: false });
    }
    return out;
  }
  // Works on any layout: every link that leaves the search site, with the text and picture
  // nearest to it. Used for Google, and as a backup when the other sites change their pages.
  function genericLinks(exact) {
    const byUrl = new Map();
    for (const a of document.querySelectorAll('a[href]')) {
      const url = external(a.href);
      if (!url || a.closest('header, footer, nav, [role="navigation"]')) continue;
      // The block around this link: grow until it would also hold a different result.
      let box = a;
      while (box.parentElement && box.parentElement !== document.body) {
        const p = box.parentElement;
        const others = [...p.querySelectorAll('a[href]')].some(o => { const u = external(o.href); return u && u !== url; });
        if (others) break;
        box = p;
      }
      const cur = byUrl.get(url) || { url, title: '', thumb: '', exact };
      const heading = box.querySelector('h3, h2, [role="heading"]');
      const text = clean(heading ? heading.textContent : (a.getAttribute('aria-label') || a.textContent));
      if (text.length > cur.title.length && !/^https?:/.test(text)) cur.title = text;
      if (!cur.thumb) cur.thumb = imgSrc([...box.querySelectorAll('img')].find(i => !/favicon/i.test(i.src) && (i.naturalWidth || i.width || 0) > 40));
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
    if (!links.length) links = genericLinks(engine !== 'bing');
    // Drop duplicates and tiny junk.
    const seen = new Set();
    links = links.filter(l => l.url && !seen.has(l.url) && seen.add(l.url)).slice(0, 150);
    await send({ type: 'rsResults', links, pageUrl: location.href });
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
    if (u.pathname.startsWith('/images/search') && /detailv2/.test(u.search)) return 'read';
    return 'wait';
  }

  async function main() {
    const hi = await send({ type: 'rsHello', engine, url: location.href });
    if (!hi || !hi.task) return;                       // not one of PageProof's search tabs
    if (document.readyState === 'loading') await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
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
