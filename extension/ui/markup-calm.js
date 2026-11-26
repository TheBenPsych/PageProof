// Mark up a copy in the calm look (step 17). Drawing, saving and copying are all markup.js,
// untouched. This file lays the page out anew: the title, one line with the file and the save
// buttons, one toolbar across the top (tools, colours, sizes, undo) and the picture under it.
// The page's own buttons, colour dots and boxes are kept and moved or pressed from here.
(() => {
  if (typeof TK === 'undefined') return;
  const { h, ic, sq, btn, kn1, C } = TK;
  document.body.className = 'plain mcalm';
  const root = h('div', { class: 'nnew tn tn-markup', id: 'mRoot' });
  document.body.append(root);
  const status = $('status');
  const press = id => () => $(id).click();
  const plain = t => t.replace(/^[^A-Za-z]+/, '').trim();
  // A button here that presses one of the page's own buttons, and is greyed out or hidden with it.
  const twin = (id, icon, cls, text, iconOnly) => {
    const old = $(id), label = text || plain(old.textContent);
    const b = iconOnly ? h('button', { class: 'tn-ib', type: 'button', 'aria-label': label, onclick: press(id) }, ic(icon)) : btn(icon, label, cls, { onclick: press(id) });
    b.id = 'mBtn' + id[0].toUpperCase() + id.slice(1);
    const sync = () => { b.disabled = old.disabled; b.hidden = old.hidden; b.title = old.disabled ? (old.dataset.why || '') : (old.title || label); };
    new MutationObserver(sync).observe(old, { attributes: true, attributeFilter: ['disabled', 'title', 'hidden'] }); sync();
    return b;
  };

  // ---------- nothing open yet ----------
  const emptyView = h('div', { class: 'tn-view', id: 'mEmpty' });
  async function drawEmpty() {
    const rec = await TK.recent(4).catch(() => null);
    if (base) return;
    emptyView.replaceChildren(
      TK.drop(C.orange, 'markup', 'Drop a capture or picture here', 'A picture, a PageProof evidence pack (.zip) or a PageProof PDF. Or paste with Ctrl+V. Your evidence pack is never changed.',
        btn('folder', 'Open a capture or picture', 'acc big', { id: 'mPick', onclick: press('pick') })),
      h('div', { class: 'tn-two' + (rec ? '' : ' one') }, rec, TK.what('What you can do', [
        ['hl', 'Highlight', 'Run a see-through marker over a line or a photo'],
        ['box', 'Box, circle and arrow', 'Point at the part that matters'],
        ['text', 'Type a note', 'Click where the words should go'],
        ['area', 'Copy just a part', 'Drag a box round the part you want to copy or save']])));
  }

  // ---------- a capture open ----------
  const chip = h('span', { class: 'tn-fchip', id: 'mChip' });
  const cmd = TK.cmd(chip, btn('folder', 'Open a different capture', '', { id: 'mOpen', title: $('pickLbl').title, onclick: press('pick') }), twin('png', 'save', '', 'Save as PNG'), twin('pdf', 'pdf', '', 'Save as PDF'), twin('copy', 'copy', 'acc', 'Copy image'));
  cmd.id = 'mCmd';
  const ICON = { highlight: 'hl', rect: 'box', ellipse: 'circ', arrow: 'arrow', text: 'text', move: 'hand', area: 'area' };
  const tools = [...document.querySelectorAll('#tools [data-tool]')].map(old => h('button', { class: 'tn-tb' + (old.classList.contains('on') ? ' on' : ''), type: 'button', title: old.title, 'aria-label': plain(old.textContent), 'data-tool': old.dataset.tool, onclick: () => pickTool(old.dataset.tool) }, ic(ICON[old.dataset.tool] || 'edit'), h('span', { text: plain(old.textContent) })));
  $('sizes').classList.add('tn-seg', 'sm'); $('colors').classList.add('tn-cols');
  const vsep = () => h('span', { class: 'tn-vsep' });
  const bar = h('div', { class: 'card tn-mtb', id: 'mBar', role: 'toolbar', 'aria-label': 'Marking tools' }, h('span', { class: 'tn-tools', role: 'radiogroup', 'aria-label': 'Tool' }, tools), vsep(), $('colors'), vsep(), $('sizes'), vsep(),
    twin('undo', 'undo', '', 'Undo', true), twin('redo', 'redo', '', 'Redo', true), twin('del', 'trash', '', 'Delete', true), twin('clearAll', '', 'ghost', 'Clear all'), twin('clearArea', '', 'ghost', 'Use whole page'),
    h('span', { class: 'sp' }), document.querySelector('label.check'));
  const boardCard = h('section', { class: 'card tn-board', id: 'mBoard' }, $('board'));
  const note = h('p', { class: 'kfoot tn-note' }, ic('lock', 14), ' This is a separate copy. Your evidence pack and its fingerprints are not changed.');
  const shownView = h('div', { class: 'tn-view', id: 'mShown', hidden: true }, h('div', { class: 'tn-mk' }, bar, boardCard, note));

  function drawChip() {
    const t = document.createElement('canvas'); t.width = 104; t.height = 72;
    const k = Math.max(104 / base.width, 72 / base.height);
    t.getContext('2d').drawImage(base, 0, 0, Math.min(base.width, 104 / k), Math.min(base.height, 72 / k), 0, 0, 104, 72);
    chip.replaceChildren(h('img', { src: t.toDataURL('image/jpeg', 0.8), alt: '' }), kn1(meta.name || meta.host || 'Picture', [base.width + ' × ' + base.height, meta.host && meta.name ? meta.host : '', meta.captured ? 'captured ' + meta.captured : 'opened ' + TK.clock(Date.now()), meta.captureId].filter(Boolean).join(' · ')));
    chip.title = meta.url || meta.name || '';
  }
  function sync() {
    emptyView.hidden = !!base; shownView.hidden = !base; cmd.hidden = !base;
    if (base) drawChip(); else drawEmpty();
  }

  root.append(TK.head('Mark up a copy'), cmd, status, emptyView, shownView);
  // markup.js says when a capture has been opened.
  const use = useImage;
  useImage = async (...a) => { const r = await use(...a); sync(); return r; };   // eslint-disable-line no-global-assign
  sync();
})();
