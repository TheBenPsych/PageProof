// Inspect a photo in the calm look (step 17). The reading, the PDF and the evidence pack are all
// inspect.js, untouched. This file lays the page out anew: the title, one line with the file and
// the buttons, the picture on the left, and on the right one sentence, one list of facts and the
// folds. The page's own buttons and boxes are kept and pressed from here, so they work as before.
(() => {
  if (typeof TK === 'undefined') return;
  const { h, ic, sq, btn, kn1, C } = TK;
  document.body.className = 'plain icalm';
  const root = h('div', { class: 'nnew tn tn-inspect', id: 'iRoot' });
  document.body.append(root);
  const status = $('status');
  const F = { collector: $('collector'), caseRef: $('caseRef'), caseNotes: $('caseNotes') };   // kept by hand: they are moved before the new layout is on the page
  const press = id => () => $(id).click();
  // A button here that presses one of the page's own buttons, and is greyed out with it.
  const twin = (id, icon, text, cls, why) => {
    const b = btn(icon, text, cls, { id: 'iBtn' + id[0].toUpperCase() + id.slice(1), onclick: press(id) }), old = $(id);
    const sync = () => { b.disabled = old.disabled; b.title = old.disabled ? (old.dataset.why || why || '') : (old.title || ''); };
    new MutationObserver(sync).observe(old, { attributes: true, attributeFilter: ['disabled', 'title'] }); sync();
    return b;
  };
  const say = text => { setStatus(text); };
  const copyText = (text, done) => navigator.clipboard.writeText(text).then(() => say(done), () => say('Could not copy. Select the text and press Ctrl+C.'));

  // ---------- nothing open yet ----------
  const emptyView = h('div', { class: 'tn-view', id: 'iEmpty' });
  async function drawEmpty() {
    const rec = await TK.recent(4).catch(() => null), inApp = !!TK.app();
    emptyView.replaceChildren(
      TK.drop(C.purple, 'inspect', 'Drop a photo here', 'Or press Choose a file, or paste one with Ctrl+V. The file itself is never changed.',
        btn('folder', 'Choose a file', 'acc big', { id: 'iPick', onclick: press('pick') }),
        inApp ? btn('copy', 'Pick from Copies found', 'big', { id: 'iFromFound', onclick: () => { parent.location.hash = 'found'; } }) : null),
      h('div', { class: 'tn-two' + (rec ? '' : ' one') }, rec, TK.what('What Inspect reads', [['cam', 'Camera and lens', 'Make, model, lens and settings'], ['cal', 'When it was taken', 'The date and time inside the file'], ['user', 'Creator and credit', 'Author, credit line and source'], ['cr', 'Copyright notice', 'Rights text, as the photographer typed it'], ['shield', 'Content Credentials', 'Signed edit history, when there is one']])),
      h('p', { class: 'kfoot', text: 'On a website? Click the PageProof icon and choose Inspect a picture, or right-click a picture and choose Inspect with PageProof.' }));
  }

  // ---------- all the pictures of a page ----------
  const gal = $('gallery');
  const galView = h('div', { class: 'tn-view', id: 'iGallery', hidden: true }, h('section', { class: 'card tn-gal' }, gal));

  // ---------- one picture ----------
  const chip = h('span', { class: 'tn-fchip', id: 'iChip' });
  const more = h('div', { class: 'tn-more', id: 'iMore', hidden: true },
    twin('pdf', 'pdf', 'Save as PDF', 'ghost'), twin('copy', 'copy', 'Copy the picture', 'ghost'), twin('orig', 'save', 'Download the original file', 'ghost'));
  const moreBtn = btn('', 'More', '', { id: 'iMoreBtn', 'aria-haspopup': 'true', 'aria-expanded': 'false', onclick: e => { e.stopPropagation(); more.hidden = !more.hidden; moreBtn.setAttribute('aria-expanded', String(!more.hidden)); } });
  moreBtn.append(ic('dn', 12));
  addEventListener('click', () => { if (!more.hidden) { more.hidden = true; moreBtn.setAttribute('aria-expanded', 'false'); } });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !more.hidden) { more.hidden = true; moreBtn.setAttribute('aria-expanded', 'false'); moreBtn.focus(); } });
  const backBtn = btn('pic', 'All pictures on the page', '', { id: 'iBack', hidden: true, onclick: press('backAll') });
  const packBtn = twin('pack', 'save', 'Save evidence pack', 'acc');
  const cmd = TK.cmd(chip, backBtn, btn('inspect', 'Inspect another', '', { id: 'iAnother', onclick: press('pick') }), twin('compare', 'compare', 'Compare with the original', '', 'This kind of picture can\'t be shown in the browser.'), twin('markup', 'markup', 'Mark up', '', 'This kind of picture can\'t be shown in the browser.'),
    btn('copy', 'Copy the details', '', { id: 'iCopy', onclick: () => copyText(detailsText(), 'Details copied.') }), h('span', { class: 'tn-morew' }, moreBtn, more), packBtn);
  cmd.id = 'iCmd';
  const frame = document.querySelector('#shown .frame');
  const pic = h('section', { class: 'card tn-pic', id: 'iPic' }, h('div', { class: 'tn-pw' }, frame), h('p', { class: 'kfoot', text: 'Shown smaller here. The file itself is never changed.' }));
  const sentence = h('p', { class: 'kmuted', id: 'iSentence' }), keys = h('div', { class: 'tn-keys', id: 'iKeys' });
  const sayCard = h('section', { class: 'card tn-say', id: 'iSay' }, h('div', { class: 'kh2', text: 'What the file says' }), sentence, keys, $('notice'), $('warn'), $('ai'));
  const facts = h('section', { class: 'card tn-facts', id: 'iFacts' });
  // Case details: closed until you save a pack.
  const caseSub = h('span', {});
  const field = (label, id, extra) => { const el = F[id]; el.removeAttribute('placeholder'); if (extra) el.placeholder = extra; return h('label', { class: 'tn-field' }, h('span', { text: label }), el); };
  const caseHint = h('p', { class: 'kmuted', id: 'iCaseHint', hidden: true, text: 'Type the case number if you have one, then press Save evidence pack. You can also save without it.' });
  const caseFold = h('details', { class: 'tn-fold2', id: 'iCase' }, h('summary', { class: 'tn-fold' }, ic('user'), h('span', { class: 'kn1' }, h('b', { text: 'Case details' }), caseSub), ic('dn', 14)),
    h('div', { class: 'tn-expb' }, caseHint, field('Collected by', 'collector'), field('Case / reference number', 'caseRef'), field('Notes', 'caseNotes', 'For example: our client\'s photo, used on their product page'),
      btn('save', 'Save evidence pack', 'acc', { id: 'iPack2', onclick: press('pack') })));
  const caseLine = () => { const who = F.collector.value.trim(), ref = F.caseRef.value.trim(); caseSub.textContent = [who ? 'Collected by ' + who : 'No name yet', ref ? 'case ' + ref : 'no case number yet'].join(' · '); };
  for (const el of Object.values(F)) el.addEventListener('input', caseLine);
  const folds = h('section', { class: 'card tn-folds', id: 'iFolds' }, caseFold, $('folds'));
  const shownView = h('div', { class: 'tn-view', id: 'iShown', hidden: true }, h('div', { class: 'tn-ins' }, pic, h('aside', { class: 'tn-side' }, sayCard, facts, folds)));

  // Save evidence pack: the first press opens Case details (so the case number isn't forgotten);
  // with the fold open, or a case number typed, it saves straight away.
  let asked = '';
  packBtn.addEventListener('click', e => {
    const id = (typeof cur !== 'undefined' && cur && cur.captureId) || '';
    if (caseFold.open || F.caseRef.value.trim() || asked === id) return;
    e.stopImmediatePropagation(); e.preventDefault();
    asked = id; caseFold.open = true; caseHint.hidden = false; caseFold.scrollIntoView({ block: 'center', behavior: 'smooth' }); F.caseRef.focus({ preventScroll: true });
  }, true);

  const short = x => x.slice(0, 8) + ' … ' + x.slice(-8);
  function factRows() {
    const c = cur, m = c.meta, s = m.summary;
    return [
      ['cam', 'Camera', [s.camera, s.lens].filter(Boolean).join(' · ')],
      ['cal', 'Taken', s.taken],
      ['pin', 'Place', s.gps ? s.gps.lat + ', ' + s.gps.lon : '', s.gps ? { link: 'https://www.google.com/maps?q=' + encodeURIComponent(s.gps.lat + ',' + s.gps.lon) } : {}],
      ['edit', 'Edited with', s.software],
      ['user', 'Creator', s.creator, { key: true }],
      ['cr', 'Copyright', s.copyright, { key: true }],
      ['user', 'Credit', s.credit, { optional: true, key: true }],
      ['file', 'Usage terms', s.terms, { optional: true }],
      ['cam', 'Camera serial', s.serial, { optional: true }],
      ['size', 'Size', (m.width ? m.width + ' × ' + m.height + ' · ' : '') + fmtBytes(m.size) + ' ' + m.format],
      ['key', 'Fingerprint', short(c.sha), { mono: true, copy: c.sha }],
    ].filter(r => r[2] || !(r[3] || {}).optional);
  }
  function detailsText() {
    const c = cur, s = c.meta.summary;
    return [c.name, s.level === 'none' ? 'No hidden data in this file.' : s.sentence, '', ...factRows().map(([, k, v, o]) => k + ': ' + (o && o.copy ? o.copy : v || 'Not saved')),
      'Source: ' + (c.fromWeb ? (c.src.startsWith('data:') ? 'picture stored inside the page ' + (c.page || '') : c.src) : 'added from this computer'), 'Inspected: ' + new Date(c.time).toLocaleString() + ' · ' + c.captureId].join('\n');
  }
  function drawShown() {
    const c = cur, m = c.meta, s = m.summary;
    const thumb = c.bitmap ? h('img', { src: $('shownImg').src, alt: '' }) : sq(C.grey, 'file', 34);
    chip.replaceChildren(thumb, kn1(c.name, [c.fromWeb ? 'From ' + c.host : 'From your computer', (c.fromWeb ? 'downloaded ' : 'inspected ') + TK.clock(c.time), c.captureId].join(' · ')));
    chip.title = c.fromWeb && !c.src.startsWith('data:') ? c.src : '';
    sentence.textContent = s.level === 'none' ? '' : s.sentence; sentence.hidden = s.level === 'none';
    const key = (ok, yes, no) => h('span', { class: 'tn-k ' + (ok ? 'ok' : 'no') }, ic(ok ? 'check' : 'x', 14), ok ? yes : no);
    keys.replaceChildren(key(!!s.creator, 'Creator', 'No creator'), key(!!s.copyright, 'Copyright notice', 'No copyright notice'),
      key(!!(s.camera || s.taken), s.camera && s.taken ? 'Camera and date' : s.camera ? 'Camera' : 'Date', 'No camera or date'), key(!!s.gps, 'Place', 'No place'), key(!!m.c2pa, 'Content Credentials', 'No Content Credentials'));
    facts.replaceChildren(...factRows().map(([i, k, v, o = {}]) => h('div', { class: 'tn-fr' + (v ? '' : ' tn-none') + (o.key && v ? ' tn-key' : '') + (o.mono ? ' tn-mono' : '') }, ic(i), h('span', { class: 'l', text: k }),
      h('span', { class: 'v', title: o.copy || '' }, v || 'Not saved', o.link ? h('a', { href: o.link, target: '_blank', rel: 'noopener noreferrer', text: ' Map ↗' }) : null),
      o.copy ? h('button', { class: 'tn-ib', type: 'button', title: 'Copy the fingerprint', 'aria-label': 'Copy the fingerprint', onclick: () => copyText(o.copy, 'Fingerprint copied.') }, ic('copy')) : null)));
    caseFold.open = false; caseHint.hidden = true; caseLine();
    backBtn.hidden = $('backAll').hidden;
  }
  new MutationObserver(() => { backBtn.hidden = $('backAll').hidden; }).observe($('backAll'), { attributes: true, attributeFilter: ['hidden'] });

  cmd.hidden = true;
  root.append(TK.head('Inspect a photo'), cmd, status, emptyView, galView, shownView);
  // inspect.js says which of the three views is on, and when a picture has been read.
  const show = showOnly, draw = render;
  showOnly = which => { show(which); emptyView.hidden = which !== 'empty'; galView.hidden = which !== 'gallery'; shownView.hidden = cmd.hidden = which !== 'shown'; if (which === 'empty') drawEmpty(); };   // eslint-disable-line no-global-assign
  // "© Author and copyright" has a letter where the other folds have a picture: give it the line icon too.
  const foldIcons = () => { for (const sm of document.querySelectorAll('#folds details.fold > summary')) { const t = [...sm.childNodes].find(n => n.nodeType === 3 && /^\s*©\s*/.test(n.nodeValue)); if (t) { t.nodeValue = t.nodeValue.replace(/^\s*©\s*/, ''); sm.prepend(ic('cr')); } } };
  render = () => { draw(); foldIcons(); drawShown(); };   // eslint-disable-line no-global-assign
  // whatever inspect.js has on screen by now
  { const now = ['empty', 'gallery', 'shown'].find(id => !$(id).hidden) || 'empty'; emptyView.hidden = now !== 'empty'; galView.hidden = now !== 'gallery'; shownView.hidden = cmd.hidden = now !== 'shown'; if (now === 'empty') drawEmpty(); else if (now === 'shown' && cur) { foldIcons(); drawShown(); } }
})();
