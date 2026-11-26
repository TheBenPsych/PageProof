// Verify a pack in the calm look (step 17). Only in the PageProof app: the copy of this page that
// sits inside every evidence pack (VERIFY-THIS-PACK.html) does not carry this file and keeps its
// plain look. The checking itself is verify.js, untouched: this file only draws its answers
// (PP_VERIFIED, PP_VERIFIED_FILE) as one calm page.
(() => {
  if (globalThis.PP_STANDALONE || typeof TK === 'undefined') return;
  const { h, ic, sq, btn, kn1, C } = TK;
  const main = document.getElementById('main'), out = document.getElementById('out');
  document.body.classList.add('vcalm');
  const root = h('div', { class: 'nnew tn tn-verify', id: 'vRoot' });
  main.append(root);
  const pickPack = () => document.getElementById('pick').click(), pickFolder = () => document.getElementById('pickFolder').click();
  const short = x => x ? x.slice(0, 8) + ' … ' + x.slice(-8) : '';
  const tryDate = t => { const d = new Date(/^\d{4}-\d\d-\d\dT[\d:.]+$/.test(t) ? t + 'Z' : t); return isNaN(d) ? null : d; };
  const local = (d, secs) => d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', ...(secs ? { second: '2-digit' } : {}) });
  const utc = d => String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
  const lr = (label, value, cls) => h('div', { class: 'tn-lr' }, h('span', { class: 'l', text: label }), h('span', { class: 'v' + (cls ? ' ' + cls : '') }, value));
  const copyBtn = (text, what) => h('button', { class: 'tn-ib', type: 'button', title: 'Copy ' + what, 'aria-label': 'Copy ' + what, onclick: e => navigator.clipboard.writeText(text).then(() => { const b = e.currentTarget; b.classList.add('done'); setTimeout(() => b.classList.remove('done'), 1200); }, () => {}) }, ic('copy'));
  const fold = (icon, title, sub, body, open) => h('details', { class: 'card tn-exp', open: !!open }, h('summary', { class: 'tn-fold' }, ic(icon), kn1(title, sub), ic('dn', 14)), h('div', { class: 'tn-expb' }, body));
  const banner = (kind, icon, title, text, id) => h('section', { class: 'tn-ans ' + kind, id: id || 'vAnswer', role: 'status' }, sq(kind === 'good' ? 'var(--okbig)' : kind === 'warn' ? C.amber : C.red, icon, 72), h('div', {}, h('b', { text: title }), h('span', { text: text })));
  const SERVICE = { freetsa: 'FreeTSA', digicert: 'DigiCert', sectigo: 'Sectigo', globalsign: 'GlobalSign', entrust: 'Entrust', certum: 'Certum', timestamp: 'Timestamp' };
  const svc = n => SERVICE[String(n).toLowerCase()] || n;
  let last = null;   // { name, size, at } of what was just checked

  async function empty() {
    const rec = await TK.recent(4).catch(() => null);
    root.replaceChildren(TK.head('Verify a pack'),
      TK.drop(C.green, 'verify', 'Drop an evidence pack (.zip) here', 'Or choose the unzipped folder. A single file shows its fingerprint.',
        btn('folder', 'Choose a pack', 'acc big', { id: 'vPick', onclick: pickPack }), btn('folder', 'Choose a folder', 'big', { id: 'vFolder', onclick: pickFolder })),
      h('div', { class: 'tn-two' + (rec ? '' : ' one') }, rec, TK.what('What Verify checks', [['key', 'Every file’s fingerprint', 'Changing even one dot in a file changes its fingerprint'], ['clock', 'The trusted timestamps', 'Signed by outside services, so the time can’t be faked'], ['zip', 'The whole zip', 'Matches the one in your capture log, when it was made here']])));
  }
  const cmdLine = (...extra) => TK.cmd(TK.fchip(sq(C.grey, last && last.folder ? 'folder' : 'file', 34), last ? last.name : '', last ? [last.size ? TK.size(last.size) : '', 'checked ' + TK.clock(last.at)].filter(Boolean).join(' · ') : ''),
    btn('folder', 'Check another pack', '', { id: 'vAgain', onclick: pickPack }), btn('folder', 'Check a folder', '', { onclick: pickFolder }), btn('file', 'Check one file', '', { id: 'vOne', title: 'Drop or choose any single file to see its fingerprint, and whether it is in the pack you just checked', onclick: pickPack }), ...extra);

  function pack(v) {
    const n = v.rows.length, good = v.rows.filter(r => r[0] === 'ok').length, cap = tryDate(v.captured), names = v.ts.filter(t => t.ok).map(t => svc(t.service));
    const signedAt = v.ts.filter(t => t.ok).map(t => tryDate(t.time)).filter(Boolean)[0];
    const bad = v.changed || v.missing || v.tsBad;
    const ans = bad ? banner('bad', 'warn', 'Warning: this pack has been changed', [v.changed && v.changed + (v.changed === 1 ? ' file was changed' : ' files were changed'), v.missing && v.missing + (v.missing === 1 ? ' file is missing' : ' files are missing'), v.tsBad && v.tsBad + (v.tsBad === 1 ? ' timestamp failed' : ' timestamps failed')].filter(Boolean).join(', ') + '. The details are below.')
      : !v.tsGood ? banner('warn', 'clock', 'The files match, but nothing proves when', 'All ' + n + ' files match their fingerprints, but this pack has no trusted timestamp.')
        : banner('good', 'verify', 'Nothing has changed since it was made', 'All ' + n + ' files match their fingerprints, and ' + v.tsGood + ' outside timestamp service' + (v.tsGood > 1 ? 's' : '') + ' signed them' + (signedAt ? ' on ' + local(signedAt) : '') + '.');
    const tile = (c, i, b, l, s, id) => h('div', { class: 'card kt2', id }, sq(c, i, 44), h('span', {}, h('b', { text: b }), h('span', { class: 'l', text: l }), h('span', { class: 's', text: s, title: s })));
    const tiles = h('div', { class: 'ktiles2 tn-vt', id: 'vTiles' },
      tile(good === n ? C.green : C.red, good === n ? 'check' : 'warn', good + ' of ' + n, 'Files match', good === n ? 'Nothing added or changed' : [v.changed && v.changed + ' changed', v.missing && v.missing + ' missing'].filter(Boolean).join(', '), 'vtFiles'),
      tile(v.tsBad ? C.red : v.tsGood ? C.green : C.amber, 'clock', v.tsGood + ' of ' + v.ts.length, 'Timestamps signed', names.join(', ') || 'No timestamp in this pack', 'vtStamps'),
      tile(C.blue, 'cal', cap ? cap.toLocaleDateString([], { month: 'short', day: 'numeric' }) : '?', cap ? 'Captured ' + TK.clock(cap) : 'Capture time not found', cap ? 'Your time (UTC ' + utc(cap) + ')' : '', 'vtWhen'),
      v.folder ? tile(C.grey, 'folder', 'Folder', 'Checked file by file', 'No zip to compare with the log', 'vtZip')
        : v.saved ? tile(C.purple, 'zip', 'Same zip', 'As in your capture log', v.saved.collector ? 'Saved by ' + v.saved.collector : 'Saved ' + local(new Date(v.saved.at)), 'vtZip')
          : tile(C.grey, 'zip', 'Not in the log', 'Of this browser', 'Normal if someone else made it, or it was zipped again', 'vtZip'));
    const safe = /^https?:\/\//i.test(v.url) ? v.url : '';
    const about = h('section', { class: 'card tn-about', id: 'vAbout' }, h('div', { class: 'kh2', text: 'About this capture' }),
      lr('Web address', safe ? h('a', { href: safe, target: '_blank', rel: 'noopener noreferrer', text: v.url.replace(/^https?:\/\//, '') }) : (v.url || '?')),
      lr('Captured', cap ? local(cap) + ' (' + utc(cap) + ' UTC)' : (v.captured || '?')),
      lr('Capture ID', v.captureId || '?'), lr('Case', v.caseRef || '?'), lr('Collected by', v.collector || '?'),
      v.archived ? lr('Wayback Machine copy', /^https?:\/\//i.test(v.archived) ? h('a', { href: v.archived, target: '_blank', rel: 'noopener noreferrer', text: v.archived.replace(/^https?:\/\//, '') }) : v.archived) : null,
      v.zipHash ? lr('Whole zip', [h('span', { class: 'mono', text: short(v.zipHash), title: v.zipHash }), copyBtn(v.zipHash, 'the fingerprint of the whole zip')]) : null,
      v.saved ? lr('Saved here', local(new Date(v.saved.at)) + (v.saved.collector ? ' by ' + v.saved.collector : '')) : null);
    const stamps = h('section', { class: 'card tn-tsl', id: 'vStamps' }, h('div', { class: 'kh2', text: 'Trusted timestamps' }),
      v.ts.length ? v.ts.map(t => { const d = tryDate(t.time); return h('div', { class: 'tn-tr' + (t.ok ? '' : ' bad') }, sq(t.ok ? C.green : C.red, t.ok ? 'check' : 'x', 28), kn1(svc(t.service), t.ok ? t.signer : t.problem), h('span', { class: 'kfaint', text: d ? local(d, true) : t.time })); })
        : h('p', { class: 'kmuted', text: 'No timestamp receipts in this pack.' }));
    const rows = v.rows.slice().sort((a, b) => (a[0] === 'ok') - (b[0] === 'ok'));
    const cut = f => f.replace(/^PageProof_.*?_\d{4}-\d\d-\d\d_\d{4}/, '…');
    const okNames = v.rows.filter(r => r[0] === 'ok').map(r => cut(r[1]));
    const files = fold('file', good === n ? n + ' files, all match' : good + ' of ' + n + ' files match', good === n ? okNames.slice(0, 3).join(', ') + (n > 3 ? ' and ' + (n - 3) + ' more' : '') : 'The ones that do not match are on top',
      h('ul', { class: 'tn-fl', id: 'vFileList' }, rows.map(([c, t]) => h('li', { class: c }, ic(c === 'ok' ? 'check' : 'x', 14), h('span', { text: t })))), good !== n);
    files.id = 'vFiles';
    const extra = v.extras.length ? fold('info', v.extras.length + (v.extras.length === 1 ? ' file is' : ' files are') + ' not covered by the fingerprints', 'Added to the pack later, or not part of the evidence',
      h('ul', { class: 'tn-fl' }, v.extras.map(t => h('li', { class: 'info' }, ic('info', 14), h('span', { text: t })))), false) : null;
    if (extra) extra.id = 'vExtras';
    const open = v.saved && v.saved.id ? btn('ext', 'Open the capture', '', { id: 'vOpen', onclick: () => { try { if (parent !== window && parent.openCapture) return parent.openCapture(v.saved.id); } catch (e) { /* own tab */ } window.open('viewer.html?id=' + encodeURIComponent(v.saved.id), '_blank'); } }) : null;
    root.replaceChildren(TK.head('Verify a pack'), cmdLine(open), ans, tiles, h('div', { class: 'tn-two v' }, about, h('div', { class: 'kstack' }, stamps, files, extra)),
      h('p', { class: 'kfoot tn-note' }, ic('lock', 14), ' Checking only reads the pack. Nothing in it is changed.'));
  }
  function oneFile(f) {
    const ans = !f.checked ? banner('info', 'key', 'Fingerprint of ' + f.name, 'Check a pack first, then drop this file again to see whether it is in that pack. Or compare it with the matching line in the pack’s fingerprints.sha256.', 'vAnswer')
      : f.hit ? banner('good', 'verify', 'This file is in the pack you checked', 'It matches "' + f.hit + '" exactly.') : banner('bad', 'warn', 'This file is not in the pack you checked', 'Its fingerprint does not match any file in that pack.');
    root.replaceChildren(TK.head('Verify a pack'), cmdLine(), ans,
      h('section', { class: 'card tn-about', id: 'vOneFile' }, h('div', { class: 'kh2', text: 'Fingerprint (SHA-256)' }), lr('File', f.name), lr('Fingerprint', [h('span', { class: 'mono', text: f.hash }), copyBtn(f.hash, 'the fingerprint')])));
  }
  const busy = name => root.replaceChildren(TK.head('Verify a pack'), h('section', { class: 'card tn-busy', id: 'vBusy', role: 'status' }, h('span', { class: 'tn-spin' }), kn1('Checking ' + name, 'Reading every file and its fingerprint')));
  const failed = text => root.replaceChildren(TK.head('Verify a pack'), cmdLine(), banner('bad', 'warn', 'This could not be checked', text));

  function after() {
    if (globalThis.PP_VERIFIED) pack(globalThis.PP_VERIFIED);
    else if (globalThis.PP_VERIFIED_FILE) oneFile(globalThis.PP_VERIFIED_FILE);
    else failed(((out.querySelector('.verdict') || out).textContent || 'Something went wrong.').replace(/^Could not check this (file|folder): /, ''));
  }
  // verify.js does the work; these wrap its two entry points so the answer is drawn here.
  const check = handle, checkFolder = handleFolder;
  handle = async file => { globalThis.PP_VERIFIED = globalThis.PP_VERIFIED_FILE = null; last = { name: file.name, size: file.size, at: Date.now() }; busy(file.name); await check(file); after(); };   // eslint-disable-line no-global-assign
  handleFolder = async list => { const arr = [...list]; if (!arr.length) return; globalThis.PP_VERIFIED = globalThis.PP_VERIFIED_FILE = null; last = { name: ((arr[0].webkitRelativePath || '').split('/')[0] || 'Folder') + ' (folder)', size: 0, at: Date.now(), folder: true }; busy(last.name); await checkFolder(arr); after(); };   // eslint-disable-line no-global-assign
  document.getElementById('pick').addEventListener('click', e => { e.target.value = ''; });
  // a file being dragged over the page lights the drop card
  let depth = 0;
  addEventListener('dragenter', () => { depth++; document.body.classList.add('over'); });
  addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; document.body.classList.remove('over'); } });
  addEventListener('drop', () => { depth = 0; document.body.classList.remove('over'); });
  empty();
})();
