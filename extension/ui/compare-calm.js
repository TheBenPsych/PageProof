// Compare two photos in the calm look (step 17). Lining up, the score, the saved picture, PDF
// and video are all compare.js and align.js, untouched. This file lays the page out anew: the
// title, one line with the two files and the buttons, the picture with its view bar floating at
// the bottom, and on the right the result and three folds. The page's own buttons, sliders and
// boxes are kept and moved or pressed from here, so they work as before.
(() => {
  if (typeof TK === 'undefined') return;
  const { h, ic, sq, btn, kn1, C } = TK;
  document.body.className = 'plain ccalm';
  const root = h('div', { class: 'nnew tn tn-compare', id: 'cRoot' });
  document.body.append(root);
  const status = $('status');
  const WHO = { A: ['Original', 'Choose your client\'s picture', C.blue], B: ['Copy', 'Choose the one found online', C.amber] };
  const fileOf = k => $('slot' + k).querySelector('input');
  const press = id => () => $(id).click();
  const plain = t => t.replace(/^[^A-Za-z]+/, '').trim();
  // A button here that presses one of the page's own buttons, is greyed out with it, and follows
  // its words when they change (Play fade / Stop fade).
  const twin = (id, icon, cls, text) => {
    const old = $(id), b = btn(icon, '', cls, { id: 'cBtn' + id[0].toUpperCase() + id.slice(1), onclick: press(id) }), words = h('span', {});
    b.append(words);
    const sync = () => { b.disabled = old.disabled; b.title = old.disabled ? (old.dataset.why || '') : (old.title || ''); words.textContent = text || plain(old.textContent); b.classList.toggle('on', old.classList.contains('on')); };
    new MutationObserver(sync).observe(old, { attributes: true, attributeFilter: ['disabled', 'title', 'class'], childList: true, characterData: true, subtree: true }); sync();
    return b;
  };

  // ---------- the two files ----------
  const chips = {};
  for (const k of ['A', 'B']) {
    const el = h('button', { class: 'tn-fchip tn-slot', id: 'c' + k, type: 'button', onclick: () => fileOf(k).click() });
    el.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('over'); });
    el.addEventListener('dragleave', () => el.classList.remove('over'));
    el.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); el.classList.remove('over'); dropInto(k, e.dataTransfer); });
    chips[k] = el;
  }
  function drawChips() {
    for (const k of ['A', 'B']) {
      const p = P[k], img = p && $('slot' + k).querySelector('.th img');
      chips[k].replaceChildren(img ? h('img', { src: img.src, alt: '' }) : sq(WHO[k][2], 'pic', 34), kn1(WHO[k][0], p ? p.name + ' · ' + p.bitmap.width + ' × ' + p.bitmap.height : WHO[k][1]));
      chips[k].title = p ? 'Press to choose a different picture, or drop one here.\n' + $('slot' + k).querySelector('.nm').title : 'Press to choose a picture, or drop one here.';
      chips[k].classList.toggle('none', !p);
    }
    swapBtn.disabled = !(P.A && P.B);
  }
  // Swap: the copy becomes the original and the other way round.
  let swapping = false;
  const swapBtn = h('button', { class: 'tn-swap', id: 'cSwap', type: 'button', title: 'Swap the two pictures', 'aria-label': 'Swap the two pictures', disabled: true, onclick: async () => {
    if (swapping || !P.A || !P.B) return; swapping = true;
    const a = P.A, b = P.B;
    try { await setPicture('A', new Blob([b.bytes]), b.name, b.src); await setPicture('B', new Blob([a.bytes]), a.name, a.src); } finally { swapping = false; }
  } }, ic('convert'));
  const nearBtn = btn('plus', 'Check nearby shots', '', { id: 'cNear', title: $('nearBtn').title, onclick: () => $('nearBtn').querySelector('input').click() });
  const cmd = TK.cmd(h('span', { class: 'tn-pair' }, chips.A, swapBtn, chips.B, nearBtn),
    twin('auto', 'spark', 'acc', 'Line them up automatically'), h('span', { class: 'tn-vsep' }), twin('sPng', 'pic', '', 'Save picture'), twin('sPdf', 'pdf', '', 'Save as PDF'), twin('sVid', 'vid', '', 'Make a video'));
  cmd.id = 'cCmd';

  // ---------- nothing to compare yet ----------
  const emptyView = h('div', { class: 'tn-view', id: 'cEmpty' });
  async function drawEmpty() {
    const a = !!P.A, b = !!P.B;
    const pickA = (cls) => btn('folder', 'Choose the original', cls + ' big', { id: 'cPickA', onclick: () => fileOf('A').click() });
    const pickB = (cls) => btn('folder', 'Choose the copy', cls + ' big', { id: 'cPickB', onclick: () => fileOf('B').click() });
    const card = !a && !b ? TK.drop(C.teal, 'compare', 'Drop the original and the copy here', 'Or choose them one at a time, or paste with Ctrl+V. Your files are never changed.', pickA('acc'), pickB(''))
      : a ? TK.drop(C.teal, 'compare', 'Now add the copy', 'Drop it here, choose it, or paste it with Ctrl+V.', pickB('acc'))
        : TK.drop(C.teal, 'compare', 'Now add the original', 'Drop it here, choose it, or paste it with Ctrl+V.', pickA('acc'));
    if (a || b) { emptyView.replaceChildren(card); return; }
    const rec = await TK.recent(4).catch(() => null);
    if (P.A || P.B) return;   // a picture came in while the list was read
    emptyView.replaceChildren(card, h('div', { class: 'tn-two' + (rec ? '' : ' one') }, rec, TK.what('What Compare shows', [
      ['spark', 'Lines them up for you', 'Finds the matching details, even after a crop or a resize'],
      ['shape', 'What was changed', 'Green where it is the same photo, red where things were added or redrawn'],
      ['spot', 'One face or logo on its own', 'Pick a spot to compare just that part'],
      ['pdf', 'A report for the case file', 'Save the comparison as a picture, a PDF or a short video']])));
  }

  // ---------- both pictures ----------
  const float = $('tpFloat'); float.classList.add('tn-float'); $('modes').classList.add('tn-seg');
  const view = $('view'), opVal = $('opVal'), hint = $('hint');   // taken now: once the bar is lifted off the page, $() no longer finds what is in it
  const stage = h('div', { class: 'tn-stage' }, view, float);
  const viewCard = h('section', { class: 'card tn-cview', id: 'cView' }, stage, h('div', { class: 'tn-cfoot' }, opVal, hint));
  // the result
  const score = $('score');
  const notYet = h('div', { class: 'tn-resh', id: 'cNot' }, sq(C.teal, 'spark', 40), kn1('Not lined up yet', 'Press Line them up automatically, or drag the copy into place.'));
  const res = h('section', { class: 'card tn-res', id: 'cRes' }, notYet, score);
  const resSync = () => { notYet.hidden = !score.hidden; res.dataset.v = score.hidden ? '' : (score.className.match(/\b(good|mid|bad)\b/) || [''])[0]; };
  new MutationObserver(resSync).observe(score, { attributes: true, attributeFilter: ['hidden', 'class'] }); resSync();
  const nearby = $('nearby'); nearby.classList.add('tn-near');
  // the folds
  const fold = (id, icon, title, sub, open, ...body) => h('details', { class: 'card tn-exp', id, open }, h('summary', { class: 'tn-fold' }, ic(icon), h('span', { class: 'kn1' }, h('b', { text: title }), sub), ic('dn', 14)), h('div', { class: 'tn-expb' }, ...body));
  const shapeSub = h('span', { id: 'cShapeSub' }), spotSub = h('span', { id: 'cSpotSub', text: 'One face, logo or detail on its own' });
  const moveFold = fold('cMove', 'move', 'Move the copy', $('scaleVal'), true, h('div', { class: 'tn-bg2' }, twin('aside', '', ''), twin('fade', 'play', ''), twin('smaller', '', '', '− Smaller'), twin('bigger', 'plus', '', 'Bigger')));
  const shapeFold = fold('cShape', 'shape', 'Size and shape', shapeSub, false, ...document.querySelectorAll('#shape .shHint, #shape .shRow, #shape .shBottom'));
  const spotFold = fold('cSpots', 'spot', 'Compare a spot', spotSub, false, document.querySelector('#spots .shHint'), twin('spotBtn', 'spot', ''), $('spotList'));
  const shownView = h('div', { class: 'tn-view', id: 'cShown', hidden: true }, h('div', { class: 'tn-cmp' }, viewCard, h('aside', { class: 'tn-side' }, nearby, res, moveFold, shapeFold, spotFold)));

  function shapeLine() {
    if (!P.A || !P.B) return;
    const pc = v => (v * 100).toFixed(Math.abs(v * 100 - Math.round(v * 100)) < 0.05 ? 0 : 1) + '%';
    shapeSub.textContent = [pc(T.s), T.w !== 1 || T.h !== 1 ? 'stretched' : 'not stretched', T.r ? 'turned ' + Math.abs(T.r).toFixed(1) + '°' : 'not turned', T.flip ? 'mirrored' : ''].filter(Boolean).join(' · ');
  }
  function sync() {
    const both = !!(P.A && P.B), any = !!(P.A || P.B);
    cmd.hidden = !any; emptyView.hidden = both; shownView.hidden = !both;
    drawChips();
    if (!both) drawEmpty(); else shapeLine();
  }

  root.append(TK.head('Compare two photos'), cmd, status, emptyView, shownView);
  // compare.js says when a picture came in, when the copy moved and when the spots changed.
  const setPic = setPicture, drawAll = draw, spotsAll = renderSpots;
  setPicture = async (...a) => { const r = await setPic(...a); sync(); return r; };   // eslint-disable-line no-global-assign
  draw = () => { drawAll(); shapeLine(); };   // eslint-disable-line no-global-assign
  renderSpots = () => { spotsAll(); spotSub.textContent = spots.length ? spots.length + (spots.length === 1 ? ' spot compared' : ' spots compared') : 'One face, logo or detail on its own'; if (spots.length) spotFold.open = true; };   // eslint-disable-line no-global-assign
  sync();
})();
