// Runs inside the web page for the Image Inspector:
//  - start(): point-and-click picker. Pictures light up under the mouse; click one to inspect it.
//  - all():   lists every picture on the page, biggest first.
(() => {
  if (window.__ppPick) return;
  const api = globalThis.browser || globalThis.chrome;
  let active = null;

  const urlOfBg = el => {
    const bg = getComputedStyle(el).backgroundImage;
    const m = bg && bg !== 'none' && /url\(\s*(['"]?)(.*?)\1\s*\)/.exec(bg);
    return m ? m[2] : '';
  };
  // Websites often show a small version of a picture and keep a bigger one in the page's code
  // (srcset, "zoom" or "original" attributes, or a link around the picture). Find the biggest.
  const IMG_EXT = /\.(jpe?g|png|webp|gif|avif|heic|heif|tiff?|jxl)(\?|#|$)/i;
  function bestOf(img) {
    const abs = u => { try { return new URL(u, location.href).href; } catch (e) { return ''; } };
    const link = img.closest('a[href]');
    if (link && IMG_EXT.test(link.getAttribute('href'))) return abs(link.getAttribute('href'));
    for (const a of ['data-orig-file', 'data-large-file', 'data-zoom-image', 'data-zoom-src', 'data-full-url', 'data-full', 'data-hi-res-src', 'data-highres', 'data-large_image', 'data-original']) {
      const v = img.getAttribute(a);
      if (v && !v.startsWith('{')) return abs(v);
    }
    let best = '', bestW = 0;
    const sets = [img.getAttribute('srcset'), img.getAttribute('data-srcset')];
    const pic = img.parentElement && img.parentElement.tagName === 'PICTURE' ? img.parentElement : null;
    if (pic) for (const s of pic.querySelectorAll('source')) sets.push(s.getAttribute('srcset'), s.getAttribute('data-srcset'));
    for (const set of sets) {
      if (!set) continue;
      for (const part of set.split(/,\s+(?=\S)/)) {
        const [u, d = '1x'] = part.trim().split(/\s+/);
        const n = parseFloat(d);
        const w = /w$/i.test(d) ? n : /x$/i.test(d) ? n * (img.naturalWidth || 1000) : 0;
        if (u && w > bestW) { bestW = w; best = abs(u); }
      }
    }
    if (best && bestW > (img.naturalWidth || 0)) return best;
    return '';
  }

  const lazySrc = img => img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original') || '';

  // What picture (if any) does this element show?
  function pictureOf(el) {
    if (!el || el.nodeType !== 1) return null;
    const r = el.getBoundingClientRect();
    if (el.tagName === 'IMG' || (el.tagName === 'INPUT' && el.type === 'image')) {
      const src = el.currentSrc || el.src || lazySrc(el);
      if (!src) return null;
      const best = el.tagName === 'IMG' ? bestOf(el) : '';
      return { el, src, best: best && best !== src ? best : '', w: el.naturalWidth || Math.round(r.width), h: el.naturalHeight || Math.round(r.height), alt: el.alt || '', kind: 'image', rect: r };
    }
    if (el.tagName === 'PICTURE') return pictureOf(el.querySelector('img'));
    if (el.tagName === 'VIDEO' && el.poster) return { el, src: el.poster, w: Math.round(r.width), h: Math.round(r.height), alt: 'video cover picture', kind: 'video poster', rect: r };
    if (el.tagName === 'image' && el.href && el.href.baseVal) return { el, src: new URL(el.href.baseVal, location.href).href, w: Math.round(r.width), h: Math.round(r.height), alt: '', kind: 'image', rect: r };
    if (r.width >= 40 && r.height >= 40) {
      const u = urlOfBg(el);
      if (u && !u.startsWith('data:image/svg')) return { el, src: new URL(u, location.href).href, w: Math.round(r.width), h: Math.round(r.height), alt: el.getAttribute('aria-label') || '', kind: 'background picture', rect: r };
    }
    return null;
  }

  // Pictures that only exist inside the page (blob: addresses) can't be downloaded later, so read them now.
  async function portable(src) {
    if (!src.startsWith('blob:')) return src;
    try {
      const blob = await (await fetch(src)).blob();
      return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
    } catch (e) { return src; }
  }
  const clean = p => ({ src: p.src, best: p.best || '', w: p.w, h: p.h, alt: (p.alt || '').slice(0, 300), kind: p.kind });

  async function all() {
    const seen = new Set(), out = [];
    const add = p => {
      if (!p || !p.src || seen.has(p.src)) return;
      const big = (p.w >= 100 && p.h >= 100) || (p.rect.width >= 60 && p.rect.height >= 60);
      if (!big) return;
      seen.add(p.src);
      out.push(p);
    };
    document.querySelectorAll('img, input[type=image], video[poster], svg image').forEach(el => add(pictureOf(el)));
    let n = 0;
    for (const el of document.querySelectorAll('body *')) {
      if (++n > 6000) break;
      if (/^(IMG|VIDEO|SCRIPT|STYLE|svg|path)$/.test(el.tagName)) continue;
      if (urlOfBg(el)) add(pictureOf(el));
    }
    out.sort((a, b) => b.w * b.h - a.w * a.h);
    const list = out.slice(0, 200);
    for (const p of list) p.src = await portable(p.src);
    return { page: location.href, title: document.title, items: list.map(clean) };
  }

  function start() {
    if (active) return;
    const host = document.createElement('pageproof-picker');
    host.style.cssText = 'all: initial; position: fixed; inset: 0; z-index: 2147483647;';
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>
      .catch { position: fixed; inset: 0; cursor: crosshair; background: rgba(15,23,42,.08); }
      .box { position: fixed; display: none; border: 3px solid #2563eb; background: rgba(37,99,235,.14); border-radius: 6px; pointer-events: none; transition: all .12s; box-sizing: border-box; }
      .box.ok { border-color: #16a34a; background: rgba(22,163,74,.2); }
      .tag { position: absolute; left: -3px; bottom: 100%; margin-bottom: 4px; background: #2563eb; color: #fff; font: 600 12px/1.4 system-ui, sans-serif; padding: 4px 9px; border-radius: 6px; white-space: nowrap; }
      .box.low .tag { bottom: auto; top: 4px; left: 4px; margin: 0; }
      .box.ok .tag { background: #16a34a; }
      .bar { position: fixed; top: 14px; left: 50%; transform: translateX(-50%); display: flex; gap: 12px; align-items: center; background: #1e3a8a; color: #fff;
        font: 600 14px/1.4 system-ui, sans-serif; padding: 9px 10px 9px 16px; border-radius: 99px; box-shadow: 0 6px 20px rgba(0,0,0,.3); white-space: nowrap; }
      .bar button { font: inherit; font-size: 13px; border: 0; border-radius: 99px; padding: 5px 12px; background: rgba(255,255,255,.18); color: #fff; cursor: pointer; }
      .bar button:hover { background: rgba(255,255,255,.3); }
      .hint { position: fixed; display: none; background: #0f172a; color: #fff; font: 12px system-ui, sans-serif; padding: 4px 8px; border-radius: 6px; pointer-events: none; }
    </style>
    <div class="catch"></div>
    <div class="box"><div class="tag"></div></div>
    <div class="hint">Not a picture. Point at a picture.</div>
    <div class="bar">🎯 Click the picture you want to inspect <button>Cancel (Esc)</button></div>`;
    const box = root.querySelector('.box'), tag = root.querySelector('.tag'), hint = root.querySelector('.hint'), catcher = root.querySelector('.catch');
    let current = null, lastXY = [0, 0];

    const find = (x, y) => {
      for (const el of document.elementsFromPoint(x, y)) {
        if (el === host || el === document.documentElement || el === document.body) continue;
        const p = pictureOf(el);
        if (p) return p;
      }
      return null;
    };
    const show = () => {
      const [x, y] = lastXY;
      current = find(x, y);
      if (!current) {
        box.style.display = 'none';
        hint.style.display = 'block'; hint.style.left = (x + 14) + 'px'; hint.style.top = (y + 16) + 'px';
        return;
      }
      hint.style.display = 'none';
      const r = current.el.getBoundingClientRect();
      Object.assign(box.style, { display: 'block', left: (r.left - 3) + 'px', top: (r.top - 3) + 'px', width: (r.width + 6) + 'px', height: (r.height + 6) + 'px' });
      box.classList.toggle('low', r.top < 70);
      tag.textContent = '🖼️ ' + (current.w && current.h ? current.w + ' × ' + current.h : 'picture') + ' · click to inspect';
    };
    const onMove = e => { lastXY = [e.clientX, e.clientY]; show(); };
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); stop(); } };
    const onScroll = () => show();
    const onClick = async e => {
      e.preventDefault(); e.stopPropagation();
      lastXY = [e.clientX, e.clientY];
      show();
      if (!current) return;
      const picked = current;
      box.classList.add('ok'); tag.textContent = '✓ Got it. Opening the Inspector...';
      const item = clean(picked);
      item.src = await portable(item.src);
      try { await api.runtime.sendMessage({ type: 'inspect', mode: 'one', page: location.href, title: document.title, items: [item] }); } catch (err) { /* extension reloaded */ }
      setTimeout(stop, 500);
    };
    catcher.addEventListener('mousemove', onMove);
    catcher.addEventListener('click', onClick, true);
    root.querySelector('.bar button').addEventListener('click', e => { e.stopPropagation(); stop(); });
    addEventListener('keydown', onKey, true);
    addEventListener('scroll', onScroll, true);
    document.documentElement.appendChild(host);
    function stop() {
      removeEventListener('keydown', onKey, true);
      removeEventListener('scroll', onScroll, true);
      host.remove();
      active = null;
    }
    active = { stop };
  }

  // For the right-click menu: the picture with this address, and its biggest version.
  function bestFor(src) {
    const img = [...document.images].find(i => i.currentSrc === src || i.src === src);
    if (!img) return null;
    const p = pictureOf(img);
    return p ? clean(p) : null;
  }

  // For the right-click menu on sites that hide pictures under a see-through cover (Instagram):
  // look through everything stacked under the spot that was right-clicked and take the first picture.
  async function under(x, y) {
    for (const el of document.elementsFromPoint(x, y)) {
      if (/^PAGEPROOF-/.test(el.tagName) || el === document.documentElement || el === document.body) continue;
      const p = pictureOf(el);
      if (p) { const c = clean(p); c.src = await portable(c.src); return c; }
    }
    // Some covers switch off "pointer" hits for the picture itself; check every picture on screen too.
    const hits = [...document.querySelectorAll('img, video[poster]')].filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 30 && r.height > 30 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    }).map(pictureOf).filter(Boolean).sort((a, b) => a.rect.width * a.rect.height - b.rect.width * b.rect.height);
    if (hits[0]) { const c = clean(hits[0]); c.src = await portable(c.src); return c; }
    return null;
  }

  // Every address on this page that looks like another size of the same picture
  // (same file name, maybe with a size tag like -300x200 or @2x, or different size settings after the "?").
  function variants(urls) {
    const key = u => {
      try {
        const x = new URL(u, location.href);
        if (!/^https?:$/.test(x.protocol)) return '';
        let f = decodeURIComponent(x.pathname.split('/').pop() || '').toLowerCase();
        f = f.replace(/\.[a-z0-9]{2,5}$/, '').replace(/([-_@](\d{2,5}x\d{0,5}|\d{2,5}w|\dx|scaled|thumb|small|medium|large))+$/, '');
        return f.length >= 4 ? f : '';
      } catch (e) { return ''; }
    };
    const want = new Set(urls.map(key).filter(Boolean));
    if (!want.size) return [];
    const found = new Set();
    const add = u => { if (!u) return; try { const a = new URL(u, location.href).href; if (want.has(key(a))) found.add(a); } catch (e) { /* skip */ } };
    const addSet = set => { if (set) for (const part of set.split(/,\s+(?=\S)/)) add(part.trim().split(/\s+/)[0]); };
    for (const img of document.images) {
      add(img.currentSrc); add(img.src); addSet(img.getAttribute('srcset')); addSet(img.getAttribute('data-srcset'));
      for (const a of ['data-src', 'data-orig-file', 'data-large-file', 'data-zoom-image', 'data-full-url', 'data-original']) add(img.getAttribute(a));
    }
    document.querySelectorAll('source[srcset], source[data-srcset]').forEach(s => { addSet(s.getAttribute('srcset')); addSet(s.getAttribute('data-srcset')); });
    document.querySelectorAll('a[href]').forEach(a => { if (IMG_EXT.test(a.getAttribute('href'))) add(a.href); });
    document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"], link[rel="image_src"]').forEach(m => add(m.content || m.href));
    try { for (const e of performance.getEntriesByType('resource')) if (e.initiatorType === 'img' || IMG_EXT.test(e.name)) add(e.name); } catch (e) { /* none */ }
    return [...found].slice(0, 12);
  }

  window.__ppPick = { start, all, bestFor, under, variants, stop: () => active && active.stop() };
})();
