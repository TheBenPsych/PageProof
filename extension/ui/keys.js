// Keyboard help (press ?) and the keys for moving around Copies found without the mouse:
// / jumps to the search box, the up and down arrows move between copies, Enter opens one.
(() => {
  const KEYS = [
    ['Answer a copy', [['Y', 'Stolen'], ['L', 'Licensed'], ['N', 'Remove (Delete works too)'], ['C', 'Check later (not sure yet)'], ['→', 'Skip for now'], ['U', 'Undo your last answer (Ctrl+Z works too)']]],
    ['Move around', [['↑ ↓', 'Go to the copy above or below'], ['Enter', 'Open the copy’s details'], ['Esc', 'Close the details or this help'], ['/', 'Jump to the search box']]],
    ['Anywhere', [['Alt+Shift+P', 'Capture the page you are on'], ['S', 'One at a time: switch Side by side and Swipe'], ['?', 'Show or hide this help']]],
  ];
  const kbd = k => k.split(/( |\+)/).map(x => x === ' ' ? ' ' : x === '+' ? '<i>+</i>' : `<kbd>${x}</kbd>`).join('');
  let box = null, cur = '';
  const isOpen = () => box && !box.hidden;
  function show(on) {
    if (!box) {
      box = document.createElement('div'); box.id = 'keyhelp'; box.hidden = true;
      box.innerHTML = `<div class="kh" role="dialog" aria-modal="true" aria-labelledby="khT"><div class="khhead"><h2 id="khT">Keyboard keys</h2><button class="btn" id="khX" aria-label="Close">Close <kbd>Esc</kbd></button></div>
        <div class="khcols">${KEYS.map(([t, rows]) => `<section><h3>${t}</h3>${rows.map(([k, l]) => `<div class="khrow"><span class="khk">${kbd(k)}</span><span>${l}</span></div>`).join('')}</section>`).join('')}</div>
        <p class="khfoot">The answer keys work in Copies found (with a copy open) and in One at a time. They are switched off while you are typing in a box.</p></div>`;
      document.body.append(box);
      box.addEventListener('click', e => { if (e.target === box || e.target.closest('#khX')) show(false); });
    }
    box.hidden = !on;
    if (on) box.querySelector('#khX').focus();
  }
  window.ppKeyHelp = show;
  const rows = () => [...document.querySelectorAll('#view .frow.crow[data-v]')];
  function mark(id) {
    cur = id;
    for (const r of rows()) r.classList.toggle('cur', r.dataset.v === id);
    const el = rows().find(r => r.dataset.v === id);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }
  document.addEventListener('keydown', e => {
    if (isOpen()) { if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); e.stopImmediatePropagation(); show(false); } else if (e.key !== 'Tab') e.stopImmediatePropagation(); return; }
    if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) { if (e.key === 'Escape' && e.target.id === 'ppSearch') e.target.blur(); return; }
    if (document.querySelector('dialog[open]') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '?') { e.preventDefault(); show(true); return; }
    if (e.key === '/') { const s = document.getElementById('ppSearch'); if (s && s.offsetParent) { e.preventDefault(); s.focus(); s.select(); } return; }
    if (state.shown !== 'found') return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const step = e.key === 'ArrowDown' ? 1 : -1;
      if (state.open) { e.preventDefault(); ACTS.dstep(step); return; }
      const ids = rows().map(r => r.dataset.v); if (!ids.length) return;
      e.preventDefault();
      const i = ids.indexOf(cur);
      mark(ids[i < 0 ? (step > 0 ? 0 : ids.length - 1) : Math.max(0, Math.min(ids.length - 1, i + step))]);
    } else if (e.key === 'Enter' && !state.open && cur && rows().some(r => r.dataset.v === cur) && !e.target.closest('button,a')) {
      e.preventDefault(); state.open = cur; render(true);
    }
  }, true);
  document.addEventListener('DOMContentLoaded', () => { const b = document.getElementById('keysBtn'); if (b) { b.innerHTML = ic('help', 20); b.addEventListener('click', () => show(true)); } });
})();
