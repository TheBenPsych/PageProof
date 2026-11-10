// Light / dark mode switch for PageProof's own pages. Light by default; remembers your choice.
(() => {
  const root = document.documentElement;
  let saved = null;
  try { saved = localStorage.getItem('pp-theme'); } catch (e) { /* storage blocked */ }
  if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
  const current = () => root.dataset.theme || 'light'; // light unless you switch
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.createElement('button');
    btn.className = 'theme';
    const label = () => { btn.textContent = current() === 'dark' ? '\u2600\ufe0f Light mode' : '\ud83c\udf19 Dark mode'; };
    btn.onclick = () => {
      root.dataset.theme = current() === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('pp-theme', root.dataset.theme); } catch (e) { /* ignore */ }
      label();
    };
    label();
    // Goes in the "more" menu when the page has one, otherwise at the end of the top bar.
    const menu = document.getElementById('themeSlot') || document.querySelector('header details.more .menu');
    if (menu) { btn.className = ''; menu.append(btn); }
    else { const bar = document.querySelector('header .buttons'); if (bar) bar.append(btn); }
    // Close the "more" menu when clicking anywhere else.
    document.addEventListener('click', e => {
      for (const d of document.querySelectorAll('details.more[open]')) if (!d.contains(e.target)) d.open = false;
    });
  });
})();
