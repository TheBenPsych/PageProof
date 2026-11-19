// Runs in every page. Remembers where you last right-clicked, so the PageProof right-click menu
// can find a picture that a website hides under a see-through cover (Instagram, Facebook...).
// Also shows the small "Saved as JPG" note in the corner of the page.
(() => {
  if (window.__ppRC) return;
  const api = globalThis.browser || globalThis.chrome;
  let last = null;
  // Is there a picture hidden under the spot you right-clicked (one the browser can't see)?
  function hiddenPicture(e) {
    if (e.target && e.target.tagName === 'IMG') return false; // the browser sees this one itself
    for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
      if (el === document.documentElement || el === document.body || /^PAGEPROOF-/.test(el.tagName)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 40) continue;
      if (el.tagName === 'IMG' && (el.currentSrc || el.src)) return true;
      if (el.tagName === 'VIDEO' && el.poster) return true;
      if (el.tagName === 'image') return true;
      const bg = getComputedStyle(el).backgroundImage;
      if (bg && bg !== 'none' && /url\(/.test(bg) && !/data:image\/svg/.test(bg)) return true;
    }
    return false;
  }
  addEventListener('contextmenu', e => {
    last = { x: e.clientX, y: e.clientY, sx: scrollX, sy: scrollY, t: Date.now() };
    let pic = false;
    try { pic = hiddenPicture(e); } catch (err) { /* ignore */ }
    try { const p = api.runtime.sendMessage({ type: 'rcMenu', pic }); if (p && p.catch) p.catch(() => {}); } catch (err) { /* extension reloaded */ }
  }, true);

  // The spot you right-clicked, adjusted if the page has scrolled since.
  function point() {
    if (!last || Date.now() - last.t > 10 * 60 * 1000) return null;
    return { x: last.x - (scrollX - last.sx), y: last.y - (scrollY - last.sy) };
  }

  let host = null, timer = 0;
  // kind: 'ok' (green) or 'bad' (red). links: [{ label, msg }] sent back to PageProof when clicked.
  function toast({ kind = 'ok', title, lines = [], thumb = '', links = [] }) {
    if (host) host.remove();
    clearTimeout(timer);
    host = document.createElement('pageproof-note');
    host.style.cssText = 'all: initial; position: fixed; right: 20px; bottom: 20px; z-index: 2147483647;';
    const root = host.attachShadow({ mode: 'closed' });
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    root.innerHTML = `<style>
      .t { display: flex; gap: 12px; width: 360px; box-sizing: border-box; background: #fff; color: #0f172a; border: 1px solid ${kind === 'ok' ? '#86efac' : '#fecaca'};
        border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,.2); padding: 14px 16px; font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
      img { width: 64px; height: 48px; object-fit: cover; border-radius: 6px; flex: none; background: #e2e8f0; }
      b { color: ${kind === 'ok' ? '#166534' : '#b91c1c'}; }
      .m { font-size: 12.5px; color: #475569; overflow-wrap: anywhere; }
      .l { margin-top: 6px; font-size: 13px; }
      .l a { color: #2563eb; margin-right: 12px; font-weight: 600; cursor: pointer; text-decoration: none; }
      .x { margin-left: auto; align-self: flex-start; border: 0; background: none; color: #94a3b8; font-size: 18px; cursor: pointer; padding: 0 0 0 6px; line-height: 1; }
    </style>
    <div class="t">${thumb ? `<img src="${esc(thumb)}" alt="">` : ''}<div><b>${esc(title)}</b>
      ${lines.map(l => `<div class="m">${esc(l)}</div>`).join('')}
      ${links.length ? `<div class="l">${links.map((k, i) => `<a data-i="${i}">${esc(k.label)}</a>`).join('')}</div>` : ''}</div>
      <button class="x" title="Close">×</button></div>`;
    root.querySelector('.x').onclick = () => host.remove();
    root.querySelectorAll('.l a').forEach(a => a.onclick = () => {
      try { api.runtime.sendMessage(links[a.dataset.i].msg); } catch (e) { /* extension reloaded */ }
      host.remove();
    });
    const t = root.querySelector('.t');
    t.onmouseenter = () => clearTimeout(timer);
    t.onmouseleave = () => { timer = setTimeout(() => host && host.remove(), 4000); };
    document.documentElement.appendChild(host);
    timer = setTimeout(() => host && host.remove(), kind === 'ok' ? 6000 : 9000);
  }

  const hide = () => { clearTimeout(timer); if (host) host.remove(); host = null; };
  window.__ppRC = { point, toast, hide };
})();
