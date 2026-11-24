// 4.15 (Ben's idea 18): no dead buttons. A greyed-out button with data-why says WHY it is off and
// what to do, in a small note, when you point at it or click it. (Browsers don't send clicks to
// switched-off buttons, so PageProof looks at what is under the mouse instead.)
(() => {
  let tip = null, cur = null, hideT = 0, raf = 0;
  const off = el => el && el.dataset && el.dataset.why && (el.disabled || el.getAttribute('aria-disabled') === 'true');
  function show(el) {
    if (cur === el && tip && tip.isConnected) return;
    cur = el;
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'ppWhy'; tip.setAttribute('role', 'tooltip');
      tip.style.cssText = 'position:fixed;z-index:2147483646;max-width:280px;padding:8px 11px;border-radius:9px;font:13px/1.4 system-ui,Segoe UI,sans-serif;background:#191C24;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.3);pointer-events:none';
    }
    tip.innerHTML = '<b style="display:block;margin-bottom:2px">Why is this off?</b><span></span>';
    tip.lastChild.textContent = el.dataset.why;
    document.body.appendChild(tip);
    const r = el.getBoundingClientRect(), t = tip.getBoundingClientRect();
    let x = Math.min(Math.max(8, r.left + r.width / 2 - t.width / 2), innerWidth - t.width - 8);
    let y = r.bottom + 8; if (y + t.height > innerHeight - 8) y = Math.max(8, r.top - t.height - 8);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hide() { cur = null; if (tip) tip.remove(); }
  const under = (x, y) => { for (const e of document.elementsFromPoint(x, y)) { const b = e.closest && e.closest('[data-why]'); if (off(b)) return b; } return null; };
  document.addEventListener('pointermove', e => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; const b = under(e.clientX, e.clientY); if (b) { clearTimeout(hideT); show(b); } else if (cur) { clearTimeout(hideT); hideT = setTimeout(hide, 150); } });
  }, { passive: true });
  // aria-disabled buttons still get clicks: explain instead of doing nothing.
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[aria-disabled="true"][data-why]');
    if (!b) return;
    e.preventDefault(); e.stopImmediatePropagation(); show(b);
    clearTimeout(hideT); hideT = setTimeout(hide, 4000);
  }, true);
  document.addEventListener('pointerdown', e => { const b = under(e.clientX, e.clientY); if (b) { show(b); clearTimeout(hideT); hideT = setTimeout(hide, 4000); } }, true);
  document.addEventListener('focusin', e => { if (off(e.target)) show(e.target); else if (cur) hide(); });
  addEventListener('scroll', hide, true);
  addEventListener('blur', hide);
  // Switched-off buttons get a "?" pointer so it is clear they can explain themselves.
  const st = document.createElement('style');
  st.textContent = 'button:disabled[data-why],[aria-disabled="true"][data-why]{cursor:help}';
  (document.head || document.documentElement).appendChild(st);
})();
