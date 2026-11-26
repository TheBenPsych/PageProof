// Convert files in the calm look (step 17). Converting, joining, splitting and opening are all
// convert.js, untouched. This file adds the calm title, the two tabs (Convert files and Open odd
// files) with Add more files and Start over on their line, a calm page for when nothing is open,
// and turns the column on the right into numbered steps. The page's own boxes stay where they are.
(() => {
  if (typeof TK === 'undefined') return;
  const { ic, btn, C } = TK, el = TK.h;
  document.body.classList.add('fcalm');
  const press = id => () => $(id).click();
  const tab = (id, text, mode) => el('button', { id, type: 'button', role: 'tab', text, onclick: () => { if (S.mode !== mode) $('switchMode').click(); } });
  const tabC = tab('fTabConvert', 'Convert files', 'convert'), tabO = tab('fTabOpen', 'Open odd files', 'open');
  const addBtn = btn('plus', 'Add more files', '', { id: 'fAdd', onclick: press('pick') }), startBtn = btn('trash', 'Start over', '', { id: 'fStart', onclick: press('startOver') });
  const top = el('div', { class: 'nnew tn tn-ftop', id: 'fTop' }, TK.head('Convert files'), el('div', { class: 'tn-tabs' }, el('div', { class: 'utabs', role: 'tablist' }, tabC, tabO), el('span', { class: 'sp' }), addBtn, startBtn));
  document.body.prepend(top);

  // ---------- nothing open yet ----------
  const emptyView = el('div', { class: 'nnew tn', id: 'fEmpty' });
  const sum = el('div', { class: 'kh2', id: 'fSum' });
  const view = $('view'), main = el('section', { class: 'tn-fmain', id: 'fMain' }, sum, view);
  $('content').append(emptyView, main);
  const WHAT = {
    convert: ['What Convert can do', [['convert', 'Change the file type', 'JPG, PNG, WebP, GIF, BMP, AVIF and iPhone HEIC photos'], ['shrink', 'Make a picture or PDF smaller', 'To fit an email or a court e-filing limit'], ['crop', 'Rotate, crop or resize', 'One picture or all at once'], ['pdf', 'Join, split and reorder PDFs', 'And turn Word and other documents into PDF']]],
    open: ['What Open odd files can open', [['open', 'Mac files', 'Pages, Numbers and Keynote, and iPhone HEIC photos'], ['file', 'Emails', 'Outlook .msg and .eml, with their attachments'], ['zip', 'Archives', 'ZIP, RAR, 7-Zip and TAR: look inside and pull files out'], ['pic', 'Odd pictures and documents', 'TIFF, AVIF, WebP, Word, Excel, RTF and OpenOffice']]],
  };
  let drawn = '';
  async function drawEmpty() {
    const mode = S.mode; if (drawn === mode) return; drawn = mode;
    const open = mode === 'open';
    const rec = await TK.recent(4).catch(() => null);
    if (S.mode !== mode) return;
    emptyView.replaceChildren(
      TK.drop(open ? C.grey : C.blue, open ? 'open' : 'convert', 'Drop files here', open ? 'Or press Add files, or paste with Ctrl+V. PageProof shows what is inside and lets you save it as PDF or pull files out.' : 'Or press Add files, or paste with Ctrl+V. Add one file or many: PageProof works out what they are and what it can do with them.',
        btn('folder', 'Add files', 'acc big', { id: 'fPick', onclick: press('pick') })),
      el('div', { class: 'tn-two' + (rec ? '' : ' one') }, rec, TK.what(WHAT[mode][0], WHAT[mode][1])),
      el('p', { class: 'kfoot tn-note' }, ic('lock', 14), ' Everything happens on this computer. Your files are never uploaded, and never changed: you get new copies.'));
  }
  // What Open odd files opens, under its two choices.
  const opens = el('section', { id: 'fOpens', hidden: true }, el('div', { class: 'lab', text: 'Opens these files' }), el('div', { class: 'kchips' }, ['HEIC', 'TIFF', 'AVIF', 'WebP', 'Pages', 'Numbers', 'Keynote', 'MSG', 'EML', 'ZIP', 'RAR', '7-Zip', 'TAR', 'Word', 'Excel', 'RTF', 'OpenOffice'].map(t => el('span', { class: 'ktag', text: t }))));
  $('goNote').after(opens);

  function sync() {
    const any = S.items.length > 0, open = S.mode === 'open';
    tabC.classList.toggle('on', !open); tabO.classList.toggle('on', open);
    tabC.setAttribute('aria-selected', String(!open)); tabO.setAttribute('aria-selected', String(open));
    addBtn.hidden = startBtn.hidden = !any;
    emptyView.hidden = any; main.hidden = !any;
    if (!any) { drawEmpty(); return; }
    drawn = '';
    sum.replaceChildren(summary() + ' ', el('span', { class: 'kfaint', text: cvSize(S.items.reduce((n, i) => n + i.size, 0)) + ' in all' }));
    const h3 = document.querySelector('#taskBox h3'); if (h3) h3.textContent = open ? 'What you can do' : 'What do you want to do?';
    opens.hidden = !open;
  }
  // convert.js says when the files, the tab or the chosen job changed.
  const draw = render;
  render = () => { draw(); sync(); };   // eslint-disable-line no-global-assign
  sync();
})();
