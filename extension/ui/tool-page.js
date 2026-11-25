// UI overhaul batch 6: the tool pages (Inspect, Compare, Mark up, Convert) use the same page layout as
// the rest of PageProof: a page heading with the main buttons on the right, the picture in the middle
// and the controls in one column. The page's own buttons keep working: they are only moved, not copied.
(() => {
  const act = document.getElementById('tpAct');
  if (!act) return;
  const ids = (document.body.dataset.head || '').split(',').filter(Boolean);
  const first = act.firstChild;
  for (const id of ids) { const el = document.getElementById(id); if (el) act.insertBefore(el, first); }
  // A list of links that is now empty goes away.
  for (const nav of document.querySelectorAll('#side nav.links')) if (!nav.querySelector('a,button,label')) nav.remove();
})();
