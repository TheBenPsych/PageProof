// PageProof's own pages always use light mode. (The old dark mode switch was removed in 3.2.2.)
(() => {
  try { localStorage.removeItem('pp-theme'); } catch (e) { /* storage blocked */ }
  document.documentElement.dataset.theme = 'light';
  // Close any open "more" menu when clicking anywhere else.
  document.addEventListener('click', e => {
    for (const d of document.querySelectorAll('details.more[open]')) if (!d.contains(e.target)) d.open = false;
  });
})();
