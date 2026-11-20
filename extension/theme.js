// Light or dark for every PageProof page. Light is the default; the choice is shared by all pages
// (the switch sits in the top bar of the full PageProof page) and changes open pages straight away.
(() => {
  const api = globalThis.browser || globalThis.chrome;
  const root = document.documentElement;
  const set = t => { root.dataset.theme = t === 'dark' ? 'dark' : 'light'; };
  // A quick first guess from this page's own memory, so the page doesn't flash white first.
  try { set(localStorage.getItem('pp-theme2') || 'light'); } catch (e) { set('light'); }
  try {
    api.storage.local.get('ppTheme').then(r => { set(r.ppTheme); try { localStorage.setItem('pp-theme2', r.ppTheme || 'light'); } catch (e) { /* blocked */ } });
    api.storage.onChanged.addListener(ch => { if (ch.ppTheme) { set(ch.ppTheme.newValue); try { localStorage.setItem('pp-theme2', ch.ppTheme.newValue || 'light'); } catch (e) { /* blocked */ } } });
  } catch (e) { /* not inside the extension */ }
  // Close any open "more" menu when clicking anywhere else.
  document.addEventListener('click', e => {
    for (const d of document.querySelectorAll('details.more[open]')) if (!d.contains(e.target)) d.open = false;
  });
})();
