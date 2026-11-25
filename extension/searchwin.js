// The first tab of the minimized "PageProof searching" window (4.57). It only explains the window.
(() => {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  document.getElementById('min').addEventListener('click', async () => {
    try { const w = await api.windows.getCurrent(); await api.windows.update(w.id, { state: 'minimized' }); } catch (e) { /* ignore */ }
  });
})();
