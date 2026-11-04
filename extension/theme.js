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
    const bar = document.querySelector('header .buttons');
    if (bar) bar.append(btn);
  });
})();
