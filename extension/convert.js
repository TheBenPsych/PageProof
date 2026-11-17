// Convert files / Open odd files page. Everything happens on this computer.
const api = globalThis.browser || globalThis.chrome;
const $ = id => document.getElementById(id);
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

const S = {
  mode: new URLSearchParams(location.search).has('open') ? 'open' : 'convert',
  items: [],
  task: null,
  save: 'sep',
  sel: null,
  order: [],
  o: { fmt: 'jpg', keepExif: true, limit: 0, level: 70, ratio: 'free', sameAll: true, joinName: 'combined', bookmarks: true,
    picSize: 'letter', splitMode: 'one', pageSize: 'letter' },
  shared: null // the rotate/crop/resize settings used for every picture when "Do the same to all" is ticked
};
let nextId = 1;

// ---------- what kind of file is it ----------
const PIC_NAMES = { jpg: 'JPG picture', jpeg: 'JPG picture', jfif: 'JPG picture', png: 'PNG picture', gif: 'GIF picture', bmp: 'BMP picture', webp: 'WebP picture',
  avif: 'AVIF picture', ico: 'Icon', heic: 'iPhone photo (HEIC)', heif: 'iPhone photo (HEIF)', tif: 'TIFF picture', tiff: 'TIFF picture' };
const DOC_NAMES = { docx: 'Word document', doc: 'Old Word document', rtf: 'Rich text document', odt: 'OpenOffice document', txt: 'Text file', text: 'Text file', md: 'Text file', log: 'Text file',
  csv: 'CSV table', tsv: 'Table', xlsx: 'Excel spreadsheet', xlsm: 'Excel spreadsheet', xls: 'Old Excel spreadsheet', ods: 'OpenOffice spreadsheet' };
const OTHER_NAMES = { pdf: 'PDF', eml: 'Email', msg: 'Outlook email', zip: 'ZIP archive', rar: 'RAR archive', '7z': '7-Zip archive', tar: 'TAR archive', gz: 'GZ archive', tgz: 'TAR archive',
  bz2: 'BZ2 archive', xz: 'XZ archive', cbz: 'Comic archive', cbr: 'Comic archive', pages: 'Mac Pages document', numbers: 'Mac Numbers spreadsheet', key: 'Mac Keynote slides' };
const ICON = { picture: '🖼️', pdf: '📄', doc: '📝', email: '✉️', archive: '📦', iwork: '🍎', other: '❓' };

function classify(name, bytes) {
  const ext = cvExt(name), sn = cvSniff(bytes);
  let type = ext;
  if (sn && (CVI.ALL.has(sn) || sn === 'pdf')) type = sn;
  else if (sn === 'zip' && !['docx', 'xlsx', 'xlsm', 'odt', 'ods', 'pages', 'numbers', 'key', 'cbz'].includes(ext)) type = 'zip';
  else if (sn === 'ole' && !['doc', 'xls', 'msg'].includes(ext)) type = ext || 'msg';
  else if (['rar', '7z', 'gz', 'bz2', 'tar', 'rtf'].includes(sn) && !(sn === 'gz' && ext === 'tgz')) type = sn;
  if (type === 'jpeg' || type === 'jfif') type = 'jpg';
  if (type === 'tiff') type = 'tif';
  if (type === 'heif') type = 'heic';
  let kind = 'other';
  if (CVI.ALL.has(type)) kind = 'picture';
  else if (type === 'pdf') kind = 'pdf';
  else if (CVD.DOC.has(type)) kind = 'doc';
  else if (type === 'eml' || type === 'msg') kind = 'email';
  else if (CVO.ARCH.has(type)) kind = 'archive';
  else if (CVO.IWORK.has(type)) kind = 'iwork';
  const label = PIC_NAMES[type] || DOC_NAMES[type] || OTHER_NAMES[type] || ((ext ? ext.toUpperCase() + ' ' : '') + 'file');
  const renamed = sn && ext && sn !== ext && kind !== 'other' && !(sn === 'jpg' && /^(jpeg|jfif)$/.test(ext)) && !(sn === 'zip' || sn === 'ole') && !(sn === 'tif' && ext === 'tiff') && !(sn === 'heic' && ext === 'heif');
  return { type, kind, label, renamed };
}

// ---------- adding files ----------
async function addFiles(list) {
  const files = [...list].filter(f => f && f.size >= 0);
  if (!files.length) return;
  status('Reading ' + (files.length === 1 ? files[0].name : files.length + ' files') + '...');
  for (const f of files) await addBytes(f.name, await cvBytes(f), true);
  status('');
  render();
}
async function addBytes(name, bytes, quiet) {
  const c = classify(name, bytes);
  const it = { id: nextId++, name, size: bytes.length, bytes, ...c, edit: null, on: true, rotPages: {}, gone: {}, picks: new Set() };
  S.items.push(it);
  S.order.push(it.id);
  if (!S.sel) S.sel = it.id;
  if (!quiet) { S.sel = it.id; render(); }
  return it;
}
const items = kinds => S.items.filter(i => !kinds || kinds.includes(i.kind));
const byId = id => S.items.find(i => i.id === id);
function removeItem(id) {
  const it = byId(id); if (it && it.thumb && it.thumb.startsWith('blob:')) URL.revokeObjectURL(it.thumb);
  S.items = S.items.filter(i => i.id !== id);
  S.order = S.order.filter(i => i !== id);
  if (S.sel === id) S.sel = S.items.length ? S.items[0].id : null;
  render();
}

async function canvasOf(it) {
  if (!it.canvas) it.canvas = await CVI.decode(it, it.type);
  return it.canvas;
}
async function thumbOf(it) {
  if (it.thumb) return it.thumb;
  if (it.kind === 'picture' && ['jpg', 'png', 'gif', 'webp', 'bmp', 'avif', 'ico'].includes(it.type)) it.thumb = URL.createObjectURL(new Blob([it.bytes]));
  else if (it.kind === 'picture') it.thumb = await CVI.thumb(await canvasOf(it));
  else if (it.kind === 'pdf') { const c = await CVP.renderPage(it.bytes, 0, 360); it.thumb = URL.createObjectURL(await CVI.toBlob(c, 'image/png')); }
  return it.thumb;
}

// ---------- tasks ----------
const TASKS = {
  type: { e: '🔄', b: 'Change the file type', s: 'e.g. HEIC to JPG', kinds: ['picture'] },
  small: { e: '🗜️', b: 'Make them smaller', s: 'To email or upload', kinds: ['picture', 'pdf'] },
  edit: { e: '✂️', b: 'Rotate, crop or resize', s: 'One or all at once', kinds: ['picture'] },
  join: { e: '📑', b: 'Join into one PDF', s: 'Pick which, and the order', kinds: ['pdf', 'picture'] },
  split: { e: '📄', b: 'Split or pick pages', s: 'Keep only the pages you need', kinds: ['pdf'] },
  topdf: { e: '📄', b: 'Save as PDF', s: 'Looks the same, can\'t be edited', kinds: ['doc', 'email', 'iwork', 'picture'] },
  open: { e: '👁️', b: 'Open and look inside', s: 'See what the file holds', kinds: ['picture', 'pdf', 'doc', 'email', 'archive', 'iwork', 'other'] }
};
function visibleTasks() {
  const has = k => S.items.some(i => i.kind === k);
  if (S.mode === 'open') return ['open', ...(has('doc') || has('email') || has('iwork') || has('picture') ? ['topdf'] : [])];
  const t = [];
  if (has('picture')) t.push('type');
  if (has('picture') || has('pdf')) t.push('small');
  if (has('picture')) t.push('edit');
  if (has('picture') || has('pdf')) t.push('join');
  if (has('pdf')) t.push('split');
  if (has('doc') || has('email') || has('iwork')) t.push('topdf');
  if (has('email') || has('archive') || has('iwork') || has('other')) t.push('open');
  return t;
}
function pickTask() {
  const vis = visibleTasks();
  if (S.task && vis.includes(S.task)) return;
  const has = k => S.items.some(i => i.kind === k);
  if (S.mode === 'open') S.task = 'open';
  else if (has('picture')) S.task = 'type';
  else if (items(['pdf']).length > 1) S.task = 'join';
  else if (has('pdf')) S.task = 'small';
  else if (has('doc') || has('email') || has('iwork')) S.task = 'topdf';
  else S.task = vis[0] || null;
}

// ---------- page drawing ----------
function status(t, err) { const s = $('status'); s.textContent = t || ''; s.className = err ? 'error' : ''; }
let renderToken = 0;
function render() {
  renderToken++;
  pickTask();
  renderSide();
  renderMain();
}

function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
function summary() {
  const n = k => S.items.filter(i => i.kind === k).length;
  const parts = [];
  if (n('picture')) parts.push(plural(n('picture'), 'picture', 'pictures'));
  if (n('pdf')) parts.push(plural(n('pdf'), 'PDF', 'PDFs'));
  if (n('doc')) parts.push(plural(n('doc'), 'document', 'documents'));
  if (n('email')) parts.push(plural(n('email'), 'email', 'emails'));
  if (n('archive')) parts.push(plural(n('archive'), 'archive', 'archives'));
  if (n('iwork')) parts.push(plural(n('iwork'), 'Mac file', 'Mac files'));
  if (n('other')) parts.push(plural(n('other'), 'other file', 'other files'));
  return parts.join(', ');
}

function renderSide() {
  const open = S.mode === 'open';
  $('brandName').textContent = open ? 'PageProof Open files' : 'PageProof Convert';
  document.title = open ? 'PageProof Open odd files' : 'PageProof Convert files';
  const any = S.items.length > 0;
  $('domain').textContent = any ? summary() : (open ? 'Open odd files' : 'Convert files');
  $('sub').textContent = any ? cvSize(S.items.reduce((n, i) => n + i.size, 0)) + ' in all' :
    open ? 'Open files your computer can\'t: Mac, Outlook email, ZIP and RAR.' : 'Change a file\'s type, join PDFs, make files smaller, or turn documents into PDF.';
  $('safe').hidden = any;
  $('addMore').hidden = !any;
  $('startOver').hidden = !any;
  $('switchMode').textContent = open ? '🔄 Convert files' : '🗂️ Open odd files';

  // tasks
  const vis = visibleTasks();
  $('taskBox').hidden = !any || !vis.length;
  const tasks = $('tasks'); tasks.textContent = '';
  for (const id of vis) {
    const t = TASKS[id];
    const label = id === 'join' && !S.items.some(i => i.kind === 'pdf') ? 'Put them in one PDF' : id === 'small' && S.items.length === 1 ? 'Make it smaller' : t.b;
    const b = h(`<button class="task${S.task === id ? ' on' : ''}"><span class="e">${t.e}</span><span><b>${cvEsc(label)}</b><small>${cvEsc(t.s)}</small></span></button>`);
    b.onclick = () => { S.task = id; render(); };
    tasks.append(b);
  }
  renderOptions();
}

function chips(label, key, list, after) {
  const box = h(`<div><div class="lab">${cvEsc(label)}</div><div class="chips"></div></div>`);
  for (const [v, t] of list) {
    const c = h(`<button class="chip${S.o[key] === v ? ' on' : ''}">${cvEsc(t)}</button>`);
    c.onclick = () => { S.o[key] = v; (after || render)(); };
    box.lastElementChild.append(c);
  }
  return box;
}
function tick(label, key, after) {
  const l = h(`<label class="tick"><input type="checkbox"${S.o[key] ? ' checked' : ''}><span>${cvEsc(label)}</span></label>`);
  l.firstElementChild.onchange = e => { S.o[key] = e.target.checked; (after || render)(); };
  return l;
}

function renderOptions() {
  const box = $('optBox'); box.textContent = ''; box.hidden = true;
  const go = $('go'), note = $('goNote');
  go.hidden = true; go.disabled = false; go.classList.remove('done'); note.hidden = true; note.innerHTML = '';
  $('howBox').hidden = true;
  if (!S.items.length || !S.task) return;
  const show = () => { box.hidden = false; };
  const how = () => {
    $('howBox').hidden = false;
    for (const b of $('howBox').querySelectorAll('[data-how]')) { b.classList.toggle('on', b.dataset.how === S.save); b.onclick = () => { S.save = b.dataset.how; renderOptions(); }; }
  };
  const pics = items(['picture']), pdfs = items(['pdf']);
  const T = S.task;
  if (T === 'type') {
    show();
    box.append(chips('Turn them into', 'fmt', [['jpg', 'JPG'], ['png', 'PNG'], ['webp', 'WebP'], ['gif', 'GIF'], ['bmp', 'BMP'], ['pdf', 'PDF']], () => { clearResults(); render(); }));
    if (S.o.fmt === 'jpg') box.append(tick('Keep the date and camera details inside the file', 'keepExif', () => { clearResults(); render(); }));
    if (pics.length > 1) how();
    go.hidden = false;
    go.textContent = pics.length > 1 ? `⬇ Convert and save all ${pics.length}` : '⬇ Convert and save';
    go.onclick = runType;
  } else if (T === 'small') {
    show();
    box.append(chips(pics.length + pdfs.length > 1 ? 'Each file under (optional)' : 'Size limit (optional)', 'limit', [[10485760, 'Email 10 MB'], [5242880, 'Court e-filing 5 MB'], [1048576, '1 MB'], [0, 'Any size']], () => { clearResults(); render(); }));
    const s = h(`<div><div class="lab">Smaller file ⟷ Sharper pictures</div><input type="range" class="slide" min="0" max="100" step="5" value="${S.o.level}"><div class="ends"><span>Smallest</span><span>Best quality</span></div></div>`);
    s.querySelector('input').onchange = e => { S.o.level = +e.target.value; clearResults(); renderMain(); };
    box.append(s);
    if (pics.length + pdfs.length > 1) how();
    go.hidden = false;
    go.textContent = pics.length + pdfs.length > 1 ? `⬇ Save ${pics.length + pdfs.length} smaller files` : (pdfs.length ? '⬇ Save smaller PDF' : '⬇ Save smaller picture');
    go.onclick = runSmall;
  } else if (T === 'edit') {
    show();
    const ed = editState();
    const r = h(`<div><div class="lab">Turn</div><div class="chips"><button class="chip" data-a="l">↺ Left</button><button class="chip" data-a="r">↻ Right</button><button class="chip" data-a="f">⇋ Flip</button></div></div>`);
    r.querySelectorAll('[data-a]').forEach(b => b.onclick = () => turn(b.dataset.a));
    box.append(r);
    box.append(chips('Crop shape', 'ratio', [['free', 'Free'], ['1', 'Square'], ['1.3333', '4 : 3'], ['1.7778', '16 : 9']], () => { setRatio(); }));
    const sz = h(`<div><div class="lab">Size (pixels)</div><div class="row2"><label>Width<input class="fld" type="number" min="1" id="edW"></label><label>Height<input class="fld" type="number" min="1" id="edH"></label></div></div>`);
    box.append(sz);
    bindSize();
    if (pics.length > 1) box.append(tick(`Do the same to all ${pics.length} pictures`, 'sameAll', () => { if (S.o.sameAll) S.shared = { ...editState() }; render(); }));
    const rs = h('<div class="chips" style="margin-top:10px"><button class="chip">↶ Undo all changes</button></div>');
    rs.querySelector('button').onclick = () => { resetEdit(); };
    box.append(rs);
    if (pics.length > 1) how();
    go.hidden = false;
    go.textContent = pics.length > 1 ? `⬇ Save all ${pics.length} pictures` : '⬇ Save picture';
    go.onclick = runEdit;
    void ed;
  } else if (T === 'join') {
    show();
    const nm = h(`<div><div class="lab">Name of the new PDF</div><input class="fld" id="joinName" value="${cvEsc(S.o.joinName)}"></div>`);
    nm.querySelector('input').oninput = e => { S.o.joinName = e.target.value; };
    box.append(nm);
    if (pdfs.length) box.append(tick('Add a bookmark for each file', 'bookmarks', () => {}));
    if (pics.length) box.append(chips('Page size for pictures', 'picSize', [['letter', 'Letter'], ['a4', 'A4'], ['fit', 'Same as picture']]));
    go.hidden = false;
    go.onclick = runJoin;
    updateJoinCount();
  } else if (T === 'split') {
    show();
    box.append(chips('Save the ticked pages as', 'splitMode', [['one', 'One PDF'], ['each', 'One PDF per page']]));
    if (S.o.splitMode === 'each' || pdfs.length > 1) how();
    go.hidden = false;
    go.onclick = runSplit;
    updateSplitCount();
  } else if (T === 'topdf') {
    const list = items(TASKS.topdf.kinds);
    if (list.some(i => i.kind === 'doc' && i.type !== 'docx' || i.kind === 'email')) { show(); box.append(chips('Page size', 'pageSize', [['letter', 'Letter'], ['a4', 'A4']], () => { renderOptions(); refreshDocFrame(); })); }
    const direct = list.filter(i => i.kind === 'picture' || i.kind === 'iwork').length;
    if (direct > 1) how();
    go.hidden = false;
    go.textContent = list.length > 1 ? `⬇ Save all ${list.length} as PDF` : '⬇ Save as PDF';
    go.onclick = runToPdf;
    if (list.some(i => i.kind === 'doc' || i.kind === 'email')) {
      note.hidden = false;
      note.innerHTML = 'For documents and emails, a print box opens. Set <b>Destination</b> to <b>Save as PDF</b>, then press <b>Save</b>.';
    }
  }
}
function clearResults() { for (const i of S.items) i.result = null; }

function renderMain() {
  const v = $('view');
  v.textContent = '';
  if (!S.items.length) return v.append(emptyView());
  const T = S.task;
  if (T === 'type' || T === 'small') return v.append(gridView());
  if (T === 'edit') return v.append(editView());
  if (T === 'join') return v.append(joinView());
  if (T === 'split') return v.append(splitView());
  if (T === 'topdf') return v.append(docView());
  if (T === 'open') return v.append(openView());
}

function emptyView() {
  const open = S.mode === 'open';
  const e = h(`<div class="empty">
    <div class="ph">${open ? '🗂️' : '🔄'}</div>
    <h2>${open ? 'Open odd files' : 'Convert files'}</h2>
    <p>${open ? 'Add a file your computer can\'t open. PageProof shows what is inside and lets you save it as PDF or pull files out.' : 'Add one file or many. PageProof works out what they are and shows you what it can do with them.'}</p>
    <button class="addbtn">➕ Add files</button>
    <p class="alt">or drag them onto this page, or paste with <kbd>Ctrl</kbd>+<kbd>V</kbd></p>
    <div class="can">${(open ? ['🍎 Mac Pages, Numbers, Keynote', '🍎 iPhone HEIC photos', '✉️ Outlook .msg and .eml emails', '📦 ZIP, RAR, 7-Zip, TAR', '🖼️ TIFF, AVIF, WebP pictures', '📝 Word, Excel, RTF, OpenOffice']
      : ['🖼️ JPG, PNG, WebP, GIF, BMP, AVIF', '🍎 iPhone HEIC photos', '📑 Join, split and reorder PDFs', '📄 Word and other documents to PDF', '🗜️ Make a PDF or picture smaller', '✂️ Rotate, crop, resize', '🍎 Mac Pages, Numbers, Keynote', '📦 ZIP and RAR', '✉️ Outlook .msg and .eml emails']).map(t => `<span>${t}</span>`).join('')}</div>
    <p class="alt" style="margin-top:22px">🔒 Everything happens on this computer. Your files are never uploaded.</p>
  </div>`);
  e.querySelector('.addbtn').onclick = () => $('pick').click();
  return e;
}

// ---------- file cards (change type, make smaller) ----------
function card(it, used) {
  const c = h(`<div class="fc${used ? '' : ' off'}" data-id="${it.id}">
    <div class="im">${ICON[it.kind]}</div><button class="x" title="Remove">✕</button>
    <div class="nm" title="${cvEsc(it.name)}">${cvEsc(it.name)}</div>
    <div class="mt"><span>${cvSize(it.size)}</span><span class="badge${/HEIC|Mac/.test(it.label) ? ' mac' : ''}">${cvEsc(it.label)}</span></div>
    <div class="slot"></div></div>`);
  c.querySelector('.x').onclick = () => removeItem(it.id);
  if (it.kind === 'picture' || it.kind === 'pdf') thumbOf(it).then(u => { const im = c.querySelector('.im'); im.textContent = ''; im.append(h(`<img alt="" src="${u}">`)); }).catch(() => {});
  if (!used) c.querySelector('.slot').append(h(`<div class="res wait"><span>Not used for this</span></div>`));
  return c;
}
function resultRow(slot, it) {
  slot.textContent = '';
  const r = it.result;
  if (!r) return;
  if (r.err) { slot.append(h(`<div class="res bad"><span>✕ ${cvEsc(r.err)}</span></div>`)); return; }
  if (r.wait) { slot.append(h(`<div class="res wait"><span>${cvEsc(r.wait)}</span></div>`)); return; }
  const over = S.task === 'small' && S.o.limit && r.blob.size > S.o.limit;
  const row = h(`<div class="res${over ? ' bad' : ''}"><span title="${cvEsc(r.name)}">${over ? '✕ Still' : '✓'} ${S.task === 'small' ? cvSize(r.blob.size) + (it.size ? ' (was ' + cvSize(it.size) + ')' : '') : cvEsc(r.name) + ' · ' + cvSize(r.blob.size)}</span><span><a data-a="see">Check</a> · <a data-a="save">⬇ Save</a></span></div>`);
  row.querySelector('[data-a=save]').onclick = () => download(r.blob, r.name);
  row.querySelector('[data-a=see]').onclick = () => window.open(URL.createObjectURL(r.blob), '_blank');
  slot.append(row);
  if (r.note) slot.append(h(`<div class="res wait"><span>${cvEsc(r.note)}</span></div>`));
}
function gridView() {
  const T = S.task, use = TASKS[T].kinds;
  const wrap = h(`<div><div class="topline"><h2>${T === 'small' ? 'Make them smaller' : 'Your files'}</h2><span class="hint">${T === 'small' && items(['pdf']).length ? 'In PDFs the text stays sharp. Only the pictures inside are squeezed.' : 'Your original files are never changed. You get new copies.'}</span></div><div class="grid"></div></div>`);
  const grid = wrap.querySelector('.grid');
  const list = [...items(use), ...S.items.filter(i => !use.includes(i.kind))];
  for (const it of list) {
    const c = card(it, use.includes(it.kind));
    grid.append(c);
    if (use.includes(it.kind)) resultRow(c.querySelector('.slot'), it);
  }
  if (T === 'small') computeSmall();
  return wrap;
}
const slotOf = it => document.querySelector(`.fc[data-id="${it.id}"] .slot`);

async function runType() {
  const go = $('go'); go.disabled = true;
  const fmt = S.o.fmt, outs = [];
  for (const it of items(['picture'])) {
    it.result = { wait: 'Converting...' }; resultRow(slotOf(it) || document.createElement('div'), it);
    try {
      const c = await canvasOf(it);
      let blob;
      if (fmt === 'pdf') blob = await CVP.picturesToPdf([c], 'fit', cvBase(it.name));
      else blob = await CVI.encode(c, fmt, { exif: fmt === 'jpg' && S.o.keepExif ? CVI.findExif(it.bytes) : null });
      it.result = { blob, name: cvBase(it.name) + '.' + fmt };
      outs.push(it.result);
    } catch (e) { it.result = { err: e.message }; }
    const s = slotOf(it); if (s) resultRow(s, it);
    await cvWait();
  }
  await saveAll(outs, 'converted-pictures');
  done(go, outs.length, 'saved');
}
function done(go, n, word) {
  go.disabled = false;
  if (!n) return;
  const txt = go.textContent;
  go.textContent = `✓ ${n === 1 ? '1 file' : n + ' files'} ${word}${S.save === 'zip' && n > 1 ? ' as a ZIP' : ''}`;
  go.classList.add('done');
  setTimeout(() => { if (go.classList.contains('done')) { go.textContent = txt; go.classList.remove('done'); } }, 4000);
}

// ---------- make smaller ----------
let smallToken = 0;
async function computeSmall() {
  const tok = ++smallToken;
  const list = items(['picture', 'pdf']);
  for (const it of list) {
    if (it.result && !it.result.wait) continue;
    it.result = { wait: 'Working out the new size...' };
    const s = slotOf(it); if (s) resultRow(s, it);
  }
  for (const it of list) {
    if (tok !== smallToken) return;
    if (it.result && !it.result.wait) continue;
    try {
      let make, note = '';
      const ext = it.kind === 'pdf' ? 'pdf' : 'jpg';
      if (it.kind === 'picture') {
        const c = await canvasOf(it);
        const exif = CVI.findExif(it.bytes);
        make = lvl => CVI.shrink(c, lvl, exif);
      } else {
        if (!it.prep) it.prep = await CVP.findPictures(it.bytes);
        if (!it.prep.count) note = 'This PDF has no pictures to squeeze, so it can only shrink a little.';
        make = lvl => CVP.shrink(it.prep, lvl);
      }
      const r = await CVI.fitUnder(S.o.limit, S.o.level, make);
      if (tok !== smallToken) return;
      let blob = r.blob;
      let name = cvBase(it.name) + '-smaller.' + ext;
      if (blob.size >= it.size) { blob = new Blob([it.bytes], { type: it.kind === 'pdf' ? 'application/pdf' : '' }); name = it.name; note = note || 'This file is already as small as PageProof can make it, so it is kept as it is.'; }
      if (S.o.limit && !r.fits) note = 'Even at the smallest setting it is over the limit. Try splitting it into parts with "Split or pick pages".';
      it.result = { blob, name, note };
    } catch (e) { it.result = { err: e.message }; }
    const s = slotOf(it); if (s) resultRow(s, it);
    await cvWait();
  }
}
async function runSmall() {
  const go = $('go'); go.disabled = true;
  await computeSmall();
  const outs = items(['picture', 'pdf']).map(i => i.result).filter(r => r && r.blob);
  await saveAll(outs, 'smaller-files');
  done(go, outs.length, 'saved');
}

// ---------- rotate, crop, resize ----------
const blankEdit = () => ({ rot: 0, flip: false, crop: { x: 0, y: 0, w: 1, h: 1 }, scale: 1 });
function editState(it) {
  const pics = items(['picture']);
  if (S.o.sameAll && pics.length > 1) return S.shared || (S.shared = blankEdit());
  it = it || byId(S.sel);
  if (!it || it.kind !== 'picture') it = pics[0];
  return it.edit || (it.edit = blankEdit());
}
function resetEdit() { S.shared = null; for (const i of S.items) i.edit = null; S.o.ratio = 'free'; render(); }
function turn(a) {
  const e = editState(), c = e.crop;
  if (a === 'r') { e.rot = (e.rot + 90) % 360; e.crop = { x: 1 - (c.y + c.h), y: c.x, w: c.h, h: c.w }; }
  else if (a === 'l') { e.rot = (e.rot + 270) % 360; e.crop = { x: c.y, y: 1 - (c.x + c.w), w: c.h, h: c.w }; }
  else { e.flip = !e.flip; e.crop = { ...c, x: 1 - (c.x + c.w) }; if (e.rot % 180) e.rot = (e.rot + 180) % 360; }
  drawEditor();
}
let ED = null; // the editor on screen
function editView() {
  const pics = items(['picture']);
  if (!byId(S.sel) || byId(S.sel).kind !== 'picture') S.sel = pics[0].id;
  const wrap = h(`<div><div class="topline"><h2>Rotate, crop or resize</h2><span class="hint">Drag the white corners to crop. Drag inside the box to move it.</span></div>
    <div class="editor"><div class="stage"><canvas></canvas><div class="clip"><div class="cropbox"><i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i></div></div></div>
    <div class="edinfo"></div><div class="strip"></div></div>${S.items.length > pics.length ? '<p class="skipped">Only pictures can be rotated or cropped. Other files are left out.</p>' : ''}</div>`);
  const strip = wrap.querySelector('.strip');
  if (pics.length > 1) for (const it of pics) {
    const b = h(`<button class="${it.id === S.sel ? 'on' : ''}" title="${cvEsc(it.name)}"><img alt=""></button>`);
    thumbOf(it).then(u => { b.firstElementChild.src = u; });
    b.onclick = () => { S.sel = it.id; strip.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); drawEditor(); };
    strip.append(b);
  }
  ED = { wrap, canvas: wrap.querySelector('canvas'), box: wrap.querySelector('.cropbox'), info: wrap.querySelector('.edinfo') };
  hookCrop();
  setTimeout(drawEditor, 0);
  return wrap;
}
async function drawEditor() {
  if (!ED || S.task !== 'edit') return;
  const it = byId(S.sel); if (!it) return;
  ED.info.textContent = 'Loading picture...';
  let c;
  try { c = await canvasOf(it); } catch (e) { ED.info.textContent = e.message; return; }
  const e = editState(it);
  const t = CVI.turned(c, e.rot, e.flip);
  const area = $('content').clientWidth - 80, maxW = Math.max(300, Math.min(900, area)), maxH = Math.max(260, window.innerHeight - 260);
  const k = Math.min(1, maxW / t.width, maxH / t.height);
  ED.canvas.width = Math.round(t.width * k); ED.canvas.height = Math.round(t.height * k);
  ED.canvas.getContext('2d').drawImage(t, 0, 0, ED.canvas.width, ED.canvas.height);
  ED.full = { w: t.width, h: t.height };
  placeBox();
}
function placeBox() {
  const e = editState(), W = ED.canvas.width, H = ED.canvas.height;
  Object.assign(ED.box.style, { left: e.crop.x * W + 'px', top: e.crop.y * H + 'px', width: e.crop.w * W + 'px', height: e.crop.h * H + 'px' });
  const cw = Math.round(e.crop.w * ED.full.w), ch = Math.round(e.crop.h * ED.full.h);
  const ow = Math.max(1, Math.round(cw * e.scale)), oh = Math.max(1, Math.round(ch * e.scale));
  const wi = $('edW'), hi = $('edH');
  if (wi && document.activeElement !== wi) wi.value = ow;
  if (hi && document.activeElement !== hi) hi.value = oh;
  const it = byId(S.sel);
  ED.info.textContent = `${it ? it.name + ': ' : ''}new size ${ow} × ${oh} pixels` + (S.o.sameAll && items(['picture']).length > 1 ? ' · the same changes go on every picture' : '');
}
function setRatio() {
  const e = editState();
  if (S.o.ratio !== 'free' && ED && ED.full) {
    const r = +S.o.ratio, W = ED.full.w, H = ED.full.h;
    let w = W, hh = W / r; if (hh > H) { hh = H; w = H * r; }
    e.crop = { x: (1 - w / W) / 2, y: (1 - hh / H) / 2, w: w / W, h: hh / H };
  }
  renderOptions();
  drawEditor();
}
function hookCrop() {
  let drag = null;
  ED.box.onpointerdown = ev => {
    ev.preventDefault();
    const e = editState();
    drag = { h: ev.target.dataset.h || 'move', x: ev.clientX, y: ev.clientY, c: { ...e.crop } };
    ED.box.setPointerCapture(ev.pointerId);
  };
  ED.box.onpointermove = ev => {
    if (!drag) return;
    const e = editState(), W = ED.canvas.width, H = ED.canvas.height;
    const dx = (ev.clientX - drag.x) / W, dy = (ev.clientY - drag.y) / H, c = { ...drag.c }, min = 0.04;
    if (drag.h === 'move') { c.x = Math.min(1 - c.w, Math.max(0, c.x + dx)); c.y = Math.min(1 - c.h, Math.max(0, c.y + dy)); }
    else {
      let x0 = c.x, y0 = c.y, x1 = c.x + c.w, y1 = c.y + c.h;
      if (drag.h.includes('w')) x0 = Math.min(x1 - min, Math.max(0, x0 + dx)); else x1 = Math.max(x0 + min, Math.min(1, x1 + dx));
      if (drag.h.includes('n')) y0 = Math.min(y1 - min, Math.max(0, y0 + dy)); else y1 = Math.max(y0 + min, Math.min(1, y1 + dy));
      if (S.o.ratio !== 'free') {
        const r = +S.o.ratio * ED.full.h / ED.full.w; // width/height in 0..1 units
        let w = x1 - x0, hh = w / r;
        if (drag.h.includes('n')) { y0 = y1 - hh; if (y0 < 0) { y0 = 0; hh = y1; w = hh * r; } }
        else { y1 = y0 + hh; if (y1 > 1) { y1 = 1; hh = 1 - y0; w = hh * r; } }
        if (drag.h.includes('w')) x0 = x1 - w; else x1 = x0 + w;
      }
      c.x = x0; c.y = y0; c.w = x1 - x0; c.h = y1 - y0;
    }
    e.crop = c;
    placeBox();
  };
  ED.box.onpointerup = ED.box.onpointercancel = () => { drag = null; };
}
function bindSize() {
  const sizeIn = which => ev => {
    if (!ED || !ED.full) return;
    const e = editState(), cw = e.crop.w * ED.full.w, ch = e.crop.h * ED.full.h, v = +ev.target.value;
    if (!(v > 0)) return;
    e.scale = which === 'w' ? v / cw : v / ch;
    placeBox();
  };
  $('edW').oninput = sizeIn('w'); $('edH').oninput = sizeIn('h');
  if (ED && ED.full) placeBox();
}
async function runEdit() {
  const go = $('go'); go.disabled = true;
  const outs = [];
  for (const it of items(['picture'])) {
    try {
      status('Saving ' + it.name + '...');
      const c = await canvasOf(it);
      const out = CVI.applyEdit(c, editState(it));
      const fmt = ['jpg', 'png', 'webp', 'gif', 'bmp'].includes(it.type) ? it.type : 'jpg';
      const blob = await CVI.encode(out, fmt, { exif: fmt === 'jpg' ? CVI.findExif(it.bytes) : null });
      outs.push({ blob, name: cvBase(it.name) + '-edited.' + fmt });
    } catch (e) { status(it.name + ': ' + e.message, true); }
    await cvWait();
  }
  if (!$('status').classList.contains('error')) status('');
  await saveAll(outs, 'edited-pictures');
  done(go, outs.length, 'saved');
}

// ---------- join into one PDF ----------
function joinList() { return S.order.map(byId).filter(i => i && (i.kind === 'pdf' || i.kind === 'picture')); }
function joinPages() {
  let n = 0;
  for (const it of joinList()) if (it.on) n += it.kind === 'picture' ? (it.gone[0] ? 0 : 1) : (it.pages || 0) - Object.values(it.gone).filter(Boolean).length;
  return n;
}
function updateJoinCount() {
  if (S.task !== 'join') return;
  const n = joinPages(), files = joinList().filter(i => i.on).length;
  $('go').textContent = `⬇ Save one PDF (${plural(n, 'page', 'pages')})`;
  $('go').disabled = !n;
  $('sub').textContent = `${files} ticked to join · ${plural(n, 'page', 'pages')}`;
}
function joinView() {
  const list = joinList();
  const anyPdf = list.some(i => i.kind === 'pdf');
  const wrap = h(`<div><div class="topline"><h2>${anyPdf ? 'Join PDFs' : 'Put pictures in one PDF'}</h2><span class="hint">Point at a page to turn ↻ or remove ✕ it.</span></div>
    <div class="howto"><b>How to ${anyPdf ? 'join PDFs' : 'make one PDF'}:</b><span><i>1</i> Tick the files you want in it</span><span><i>2</i> Use ▲ ▼ to put them in order</span><span><i>3</i> Press <b>Save one PDF</b></span></div><div class="jl"></div></div>`);
  const jl = wrap.querySelector('.jl');
  const draw = () => {
    jl.textContent = '';
    const L = joinList();
    let n = 0;
    L.forEach((it, idx) => {
      const g = h(`<div class="jf${it.on ? '' : ' off'}"><h4><label><input type="checkbox"${it.on ? ' checked' : ''}><span class="ord">${it.on ? ++n : ''}</span><span>${ICON[it.kind]} ${cvEsc(it.name)}</span></label>
        <span class="badge">${it.kind === 'pdf' ? (it.pages ? plural(it.pages, 'page', 'pages') : '...') : 'picture'}</span>
        <span class="mv"><button title="Move up"${idx ? '' : ' disabled'}>▲</button><button title="Move down"${idx < L.length - 1 ? '' : ' disabled'}>▼</button></span></h4><div class="pages"></div></div>`);
      g.querySelector('input').onchange = e => { it.on = e.target.checked; draw(); updateJoinCount(); };
      const [up, dn] = g.querySelectorAll('.mv button');
      up.onclick = () => move(it.id, -1); dn.onclick = () => move(it.id, 1);
      fillPages(g.querySelector('.pages'), it, 'join');
      jl.append(g);
    });
  };
  const move = (id, d) => {
    const L = joinList().map(i => i.id), a = L.indexOf(id), b = a + d;
    if (b < 0 || b >= L.length) return;
    const ia = S.order.indexOf(L[a]), ib = S.order.indexOf(L[b]);
    [S.order[ia], S.order[ib]] = [S.order[ib], S.order[ia]];
    draw();
  };
  draw();
  const other = S.items.filter(i => !['pdf', 'picture'].includes(i.kind));
  if (other.length) wrap.append(h(`<p class="skipped">Left out (not a PDF or picture): ${cvEsc(other.map(i => i.name).join(', '))}</p>`));
  return wrap;
}
const MAX_THUMBS = 60;
async function fillPages(box, it, mode) {
  const pageBox = (i, label) => {
    const p = h(`<div class="pg${mode === 'split' ? ' pick' : ''}"><div class="ph">${i + 1}</div><b>${label}</b></div>`);
    if (mode === 'join') {
      const tools = h(`<div class="tools"><button title="Turn">↻</button><button title="Remove or bring back">✕</button></div>`);
      tools.children[0].onclick = () => { it.rotPages[i] = ((it.rotPages[i] || 0) + 90) % 360; const im = p.querySelector('img'); if (im) im.style.transform = `rotate(${it.rotPages[i]}deg)`; };
      tools.children[1].onclick = () => { it.gone[i] = !it.gone[i]; p.classList.toggle('gone', !!it.gone[i]); updateJoinCount(); };
      p.append(tools);
      if (it.gone[i]) p.classList.add('gone');
    } else {
      p.prepend(h('<span class="ck">✓</span>'));
      p.classList.toggle('on', it.picks.has(i));
      p.onclick = () => { if (it.picks.has(i)) it.picks.delete(i); else it.picks.add(i); p.classList.toggle('on', it.picks.has(i)); updateSplitCount(); };
    }
    return p;
  };
  const setImg = (p, url, i) => { const ph = p.querySelector('.ph'); if (!ph) return; const im = h(`<img alt="">`); im.src = url; if (it.rotPages[i]) im.style.transform = `rotate(${it.rotPages[i]}deg)`; ph.replaceWith(im); };
  if (it.kind === 'picture') {
    const p = pageBox(0, '1'); box.append(p);
    thumbOf(it).then(u => setImg(p, u, 0)).catch(() => {});
    return;
  }
  try {
    if (!it.pages) { it.pages = await CVP.pageCount(it.bytes); if (S.task === 'join') { updateJoinCount(); const b = box.parentElement.querySelector('.badge'); if (b) b.textContent = plural(it.pages, 'page', 'pages'); } else updateSplitCount(); }
  } catch (e) { box.append(h(`<p class="note">${cvEsc(e.message)}</p>`)); return; }
  const boxes = [];
  for (let i = 0; i < Math.min(it.pages, MAX_THUMBS); i++) { const p = pageBox(i, String(i + 1)); boxes.push(p); box.append(p); }
  if (it.pages > MAX_THUMBS) box.append(h(`<span class="more">+ ${it.pages - MAX_THUMBS} more pages${mode === 'split' ? ' (use the page box above to pick them)' : ' (all included)'}</span>`));
  const tok = renderToken;
  it.thumbs = it.thumbs || [];
  for (let i = 0; i < boxes.length; i++) {
    if (tok !== renderToken) return;
    try {
      if (!it.thumbs[i]) { const c = await CVP.renderPage(it.bytes, i, 140); it.thumbs[i] = URL.createObjectURL(await CVI.toBlob(c, 'image/jpeg', 0.8)); }
      setImg(boxes[i], it.thumbs[i], i);
    } catch (e) { /* leave the page number */ }
  }
}
async function runJoin() {
  const go = $('go'); go.disabled = true;
  try {
    const list = joinList().filter(i => i.on), parts = [];
    for (const it of list) {
      status('Adding ' + it.name + '...');
      if (it.kind === 'picture') { if (!it.gone[0]) parts.push({ kind: 'picture', canvas: await canvasOf(it), rot: it.rotPages[0] || 0, title: it.name }); }
      else {
        if (!it.pages) it.pages = await CVP.pageCount(it.bytes);
        const pages = []; for (let i = 0; i < it.pages; i++) if (!it.gone[i]) pages.push({ index: i, rot: it.rotPages[i] || 0 });
        if (pages.length) parts.push({ kind: 'pdf', bytes: it.bytes, pages, title: cvBase(it.name) });
      }
    }
    if (!parts.length) throw new Error('Tick at least one file to join.');
    const name = (S.o.joinName || 'combined').replace(/\.pdf$/i, '').trim() || 'combined';
    const blob = await CVP.join(parts, { bookmarks: S.o.bookmarks, pictureSize: S.o.picSize, title: name });
    status('');
    await download(blob, name + '.pdf');
    done(go, 1, 'saved');
  } catch (e) { status(e.message, true); go.disabled = false; }
  updateJoinCount();
}

// ---------- split or pick pages ----------
function parseRange(t, max) {
  const out = new Set();
  for (const part of String(t).split(/[,;\s]+/)) {
    const m = /^(\d+)(?:-(\d*))?$/.exec(part.trim()); if (!m) continue;
    const a = +m[1], b = m[2] === undefined ? a : m[2] === '' ? max : +m[2];
    for (let i = Math.max(1, Math.min(a, b)); i <= Math.min(max, Math.max(a, b)); i++) out.add(i - 1);
  }
  return out;
}
function updateSplitCount() {
  if (S.task !== 'split') return;
  const n = items(['pdf']).reduce((a, i) => a + i.picks.size, 0);
  const files = items(['pdf']).filter(i => i.picks.size).length;
  const go = $('go');
  go.disabled = !n;
  go.textContent = !n ? 'Tick the pages you want' : S.o.splitMode === 'each' ? `⬇ Save ${plural(n, 'page', 'pages')} as ${plural(n, 'PDF', 'PDFs')}` : `⬇ Save ${plural(n, 'page', 'pages')}${files > 1 ? ` as ${files} PDFs` : ' as one PDF'}`;
}
function splitView() {
  const wrap = h(`<div><div class="topline"><h2>Split or pick pages</h2><span class="hint">Click pages to tick them, or type page numbers like 1-3, 7.</span></div>
    <div class="howto"><b>How to:</b><span><i>1</i> Tick the pages you want to keep</span><span><i>2</i> Choose one PDF or one PDF per page</span><span><i>3</i> Press <b>Save</b></span></div></div>`);
  for (const it of items(['pdf'])) {
    const g = h(`<div class="jf"><h4><span>📄 ${cvEsc(it.name)}</span><span class="badge">${it.pages ? plural(it.pages, 'page', 'pages') : '...'}</span>
      <span class="rangeRow">Pages: <input placeholder="e.g. 1-3, 7"><button class="mini" data-a="all">Tick all</button><button class="mini" data-a="none">Untick all</button></span></h4><div class="pages"></div></div>`);
    const redraw = () => g.querySelectorAll('.pg').forEach((p, i) => p.classList.toggle('on', it.picks.has(i)));
    g.querySelector('input').oninput = e => { if (!it.pages) return; it.picks = parseRange(e.target.value, it.pages); redraw(); updateSplitCount(); };
    g.querySelector('[data-a=all]').onclick = () => { for (let i = 0; i < (it.pages || 0); i++) it.picks.add(i); redraw(); updateSplitCount(); };
    g.querySelector('[data-a=none]').onclick = () => { it.picks.clear(); redraw(); updateSplitCount(); };
    fillPages(g.querySelector('.pages'), it, 'split').then(() => { const b = g.querySelector('.badge'); if (it.pages) b.textContent = plural(it.pages, 'page', 'pages'); });
    wrap.append(g);
  }
  return wrap;
}
async function runSplit() {
  const go = $('go'); go.disabled = true;
  const outs = [];
  try {
    for (const it of items(['pdf'])) {
      const idx = [...it.picks].sort((a, b) => a - b);
      if (!idx.length) continue;
      status('Making ' + it.name + '...');
      if (S.o.splitMode === 'each') for (const i of idx) { outs.push({ blob: await CVP.pick(it.bytes, [i]), name: `${cvBase(it.name)}_page-${i + 1}.pdf` }); await cvWait(); }
      else outs.push({ blob: await CVP.pick(it.bytes, idx), name: `${cvBase(it.name)}_pages-${rangeText(idx)}.pdf` });
    }
    status('');
    await saveAll(outs, 'split-pages');
    done(go, outs.length, 'saved');
  } catch (e) { status(e.message, true); go.disabled = false; }
  updateSplitCount();
}
function rangeText(idx) {
  const parts = []; let a = idx[0], b = idx[0];
  for (const i of idx.slice(1).concat(-9)) { if (i === b + 1) b = i; else { parts.push(a === b ? `${a + 1}` : `${a + 1}-${b + 1}`); a = b = i; } }
  return parts.join(',').slice(0, 60);
}

// ---------- documents and emails to PDF ----------
let docFrame = null;
function docView() {
  const list = items(TASKS.topdf.kinds);
  if (!byId(S.sel) || !TASKS.topdf.kinds.includes(byId(S.sel).kind)) S.sel = list[0].id;
  const wrap = h(`<div><div class="topline"><h2>Preview of your PDF</h2><span class="hint">Check it looks right before you save.</span></div><div class="docs"></div><div class="dv"></div></div>`);
  if (list.length > 1) for (const it of list) {
    const b = h(`<button class="${it.id === S.sel ? 'on' : ''}">${ICON[it.kind]} ${cvEsc(it.name)}</button>`);
    b.onclick = () => { S.sel = it.id; renderMain(); };
    wrap.querySelector('.docs').append(b);
  }
  const other = S.items.filter(i => !TASKS.topdf.kinds.includes(i.kind));
  if (other.length) wrap.append(h(`<p class="skipped">Not used here: ${cvEsc(other.map(i => i.name).join(', '))}</p>`));
  showPreview(wrap.querySelector('.dv'), byId(S.sel));
  return wrap;
}
async function showPreview(box, it) {
  box.textContent = '';
  if (it.kind === 'doc' || it.kind === 'email') {
    const fr = h('<iframe class="docframe" title="Preview"></iframe>');
    box.append(fr);
    docFrame = { frame: fr, it };
    await fillFrame(fr, it);
    return fr;
  }
  if (it.kind === 'picture') { box.append(h('<div class="busy">Loading picture...</div>')); const u = await CVI.thumb(await canvasOf(it), 1400); box.textContent = ''; box.append(h(`<div class="pane"><img class="pic" src="${u}" alt=""></div>`)); return; }
  if (it.kind === 'iwork') return box.append(await iworkPane(it, false));
}
async function fillFrame(fr, it) {
  if (!fr.isConnected) await new Promise(r => setTimeout(r, 0));
  try {
    const r = await CVD.render(fr, it, { size: S.o.pageSize });
    const fit = () => { try { fr.style.height = Math.max(400, fr.contentDocument.documentElement.scrollHeight + 10) + 'px'; } catch (e) { /* ignore */ } };
    fit(); setTimeout(fit, 400); setTimeout(fit, 1500);
    return r;
  } catch (e) {
    const d = fr.contentDocument; d.open(); d.write(`<p style="font:15px system-ui;padding:20px;color:#991b1b">${cvEsc(e.message)}</p>`); d.close();
    throw e;
  }
}
function refreshDocFrame() { if (docFrame && docFrame.frame.isConnected) fillFrame(docFrame.frame, docFrame.it).catch(() => {}); }
async function iworkToPdf(it) {
  const p = it.iw || (it.iw = await CVO.iwork(it));
  if (p.pdf) return new Blob([p.pdf], { type: 'application/pdf' });
  if (p.jpg) { const c = await CVI.decode({ bytes: p.jpg, name: 'preview.jpg' }); return CVP.picturesToPdf([c], 'fit', cvBase(it.name)); }
  throw new Error('This Mac file has no preview inside it. Ask the sender to export it as PDF.');
}
async function runToPdf() {
  const go = $('go'); go.disabled = true;
  const list = items(TASKS.topdf.kinds);
  const outs = [], prints = [];
  for (const it of list) {
    try {
      if (it.kind === 'picture') outs.push({ blob: await CVP.picturesToPdf([await canvasOf(it)], S.o.pageSize === 'a4' ? 'a4' : 'letter', cvBase(it.name)), name: cvBase(it.name) + '.pdf' });
      else if (it.kind === 'iwork') outs.push({ blob: await iworkToPdf(it), name: cvBase(it.name) + '.pdf' });
      else prints.push(it);
    } catch (e) { status(it.name + ': ' + e.message, true); }
  }
  await saveAll(outs, 'saved-as-pdf');
  await printEach(prints);
  go.disabled = false;
  if (outs.length || prints.length) done(go, outs.length + prints.length, 'ready');
}
async function printEach(list) {
  for (let k = 0; k < list.length; k++) {
    const it = list[k];
    status(list.length > 1 ? `Saving ${k + 1} of ${list.length}: ${it.name}. In the print box, choose Save as PDF.` : 'In the print box, choose Save as PDF, then press Save.');
    let fr = docFrame && docFrame.it === it && docFrame.frame.isConnected ? docFrame.frame : null;
    if (!fr) {
      fr = h('<iframe class="docframe" style="position:fixed;left:-10000px;top:0;width:900px;height:1200px"></iframe>');
      document.body.append(fr);
      await fillFrame(fr, it).catch(() => {});
      await new Promise(r => setTimeout(r, 600));
    }
    await CVD.print(fr);
    if (fr.style.position === 'fixed') fr.remove();
  }
  if (list.length) status('');
}

// ---------- open and look inside ----------
function openView() {
  if (!byId(S.sel)) S.sel = S.items[0].id;
  const wrap = h(`<div><div class="topline"><h2>${S.mode === 'open' ? 'Open odd files' : 'Open and look inside'}</h2><span class="hint">Click a file on the left to see inside it.</span></div><div class="odd"><div class="list"></div><div class="pane"></div></div></div>`);
  const list = wrap.querySelector('.list');
  for (const it of S.items) {
    const b = h(`<button class="li${it.id === S.sel ? ' on' : ''}"><span class="e">${ICON[it.kind]}</span><span><b title="${cvEsc(it.name)}">${cvEsc(it.name)}</b><small>${cvEsc(it.label)} · ${cvSize(it.size)}</small></span></button>`);
    b.onclick = () => { S.sel = it.id; renderMain(); };
    list.append(b);
  }
  fillPane(wrap.querySelector('.pane'), byId(S.sel));
  return wrap;
}
function actions(btns) {
  const a = h('<div class="acts"></div>');
  for (const [t, fn, alt] of btns) { const b = h(`<button${alt ? ' class="alt"' : ''}>${t}</button>`); b.onclick = async () => { b.disabled = true; try { await fn(); } catch (e) { status(e.message, true); } b.disabled = false; }; a.append(b); }
  return a;
}
async function fillPane(pane, it) {
  pane.textContent = '';
  pane.append(h(`<h3>${cvEsc(it.name)}</h3>`));
  if (it.renamed) pane.append(h(`<p class="note">This file is really a ${cvEsc(it.label)}, even though its name ends in .${cvEsc(cvExt(it.name))}.</p>`));
  const busy = h('<div class="busy">Opening...</div>'); pane.append(busy);
  try {
    if (it.kind === 'picture') {
      const c = await canvasOf(it);
      busy.remove();
      pane.append(h(`<span class="okb">✓ Opened · ${c.width} × ${c.height} pixels</span>`));
      pane.append(actions([['⬇ Save as JPG', async () => download(await CVI.encode(c, 'jpg', { exif: CVI.findExif(it.bytes) }), cvBase(it.name) + '.jpg')],
        ['⬇ Save as PNG', async () => download(await CVI.encode(c, 'png'), cvBase(it.name) + '.png'), 1],
        ['⬇ Save as PDF', async () => download(await CVP.picturesToPdf([c], 'fit', cvBase(it.name)), cvBase(it.name) + '.pdf'), 1],
        ['🔄 More ways to convert', () => { S.mode = 'convert'; S.task = 'type'; render(); }, 1]]));
      pane.append(h(`<img class="pic" alt="" src="${await CVI.thumb(c, 1600)}">`));
    } else if (it.kind === 'pdf') {
      it.pages = it.pages || await CVP.pageCount(it.bytes);
      busy.remove();
      pane.append(h(`<span class="okb">✓ Opened · ${plural(it.pages, 'page', 'pages')}</span>`));
      pane.append(actions([['📑 Join, split or make smaller', () => { S.mode = 'convert'; S.task = items(['pdf']).length > 1 ? 'join' : 'split'; render(); }, 1]]));
      for (let i = 0; i < Math.min(it.pages, 20); i++) { const c = await CVP.renderPage(it.bytes, i, 760); c.className = 'pdfpg'; c.style.width = Math.min(760, c.width) + 'px'; pane.append(c); }
      if (it.pages > 20) pane.append(h(`<p class="skipped">Showing the first 20 pages.</p>`));
    } else if (it.kind === 'doc' || it.kind === 'email') {
      const fr = h('<iframe class="docframe" title="Preview"></iframe>');
      busy.replaceWith(fr);
      docFrame = { frame: fr, it };
      const r = await fillFrame(fr, it);
      const btns = [['⬇ Save as PDF', () => printEach([it])]];
      if (r && r.blocked && !it.remote) btns.push(['🌐 Load pictures from the internet', () => { it.remote = true; renderMain(); }, 1]);
      pane.insertBefore(h(`<span class="okb">✓ Opened${it.kind === 'email' && r.mail ? ` · ${plural(r.mail.attachments.length, 'attachment', 'attachments')}` : ''}</span>`), fr);
      pane.insertBefore(actions(btns), fr);
      if (r && r.blocked && !it.remote) pane.insertBefore(h(`<p class="note">Pictures from the internet were not loaded, so the sender can't tell you opened it.</p>`), fr);
      if (r && r.mail && r.mail.attachments.length) {
        const atts = h('<div class="atts"></div>');
        for (const a of r.mail.attachments) {
          const x = h(`<span class="att">📎 ${cvEsc(a.name)} <small>${cvSize(a.bytes.length)}</small><button class="mini">Save</button><button class="mini">Open</button></span>`);
          const [sv, op] = x.querySelectorAll('button');
          sv.onclick = () => download(new Blob([a.bytes]), a.name);
          op.onclick = () => addBytes(a.name, a.bytes);
          atts.append(x);
        }
        pane.insertBefore(atts, fr);
      }
    } else if (it.kind === 'archive') {
      const ents = it.ents || (it.ents = await CVO.list(it));
      busy.remove();
      pane.append(h(`<span class="okb">✓ Opened · ${plural(ents.length, 'file', 'files')} inside</span>`));
      pane.append(actions([['⬇ Save everything as a normal ZIP', async () => {
        const files = []; for (const e of ents) files.push({ name: e.path, bytes: await e.get() });
        download(PP_ZIP(files), cvBase(it.name) + '.zip');
      }]]));
      const t = h('<table class="ent"></table>');
      for (const e of ents) {
        const r = h(`<tr><td>${ICON[classify(e.path, new Uint8Array(0)).kind]} ${cvEsc(e.path)}</td><td class="sz">${cvSize(e.size || 0)}</td><td class="ac"><button class="mini">Save</button><button class="mini">Open</button></td></tr>`);
        const [sv, op] = r.querySelectorAll('button');
        sv.onclick = async () => download(new Blob([await e.get()]), e.path.split('/').pop());
        op.onclick = async () => addBytes(e.path.split('/').pop(), await e.get());
        t.append(r);
      }
      pane.append(t);
    } else if (it.kind === 'iwork') {
      busy.replaceWith(await iworkPane(it, true));
    } else {
      busy.remove();
      pane.append(h(`<p class="note">PageProof can't open this kind of file${cvExt(it.name) ? ' (.' + cvEsc(cvExt(it.name)) + ')' : ''}. It isn't a picture, PDF, document, email or archive that PageProof knows.</p>`));
    }
  } catch (e) {
    busy.remove();
    pane.append(h(`<p class="note">${cvEsc(e.message)}</p>`));
  }
}
async function iworkPane(it, withButtons) {
  const p = it.iw || (it.iw = await CVO.iwork(it));
  const box = h('<div></div>');
  if (!p.pdf && !p.jpg && !p.tables) { box.append(h(`<p class="note">This Mac file has no preview inside it, so PageProof can't show it. Ask the sender to export it as PDF (File → Export To → PDF).</p>`)); return box; }
  box.append(h(`<span class="okb">✓ Opened, using the preview the Mac saved inside the file</span>`));
  if (!p.pdf && p.jpg) box.append(h(`<p class="note">Newer Mac files only keep a picture of the first page or slide. For every page, ask the sender to export it as PDF.</p>`));
  if (withButtons) box.append(actions([['⬇ Save as PDF', async () => download(await iworkToPdf(it), cvBase(it.name) + '.pdf')],
    ...(p.jpg ? [['⬇ Save the picture', () => download(new Blob([p.jpg], { type: 'image/jpeg' }), cvBase(it.name) + '-preview.jpg'), 1]] : [])]));
  if (p.pdf) {
    const n = await CVP.pageCount(p.pdf);
    for (let i = 0; i < Math.min(n, 20); i++) { const c = await CVP.renderPage(p.pdf, i, 760); c.className = 'pdfpg'; c.style.width = Math.min(760, c.width) + 'px'; box.append(c); }
  } else if (p.jpg) box.append(h(`<img class="pic" alt="" src="${URL.createObjectURL(new Blob([p.jpg], { type: 'image/jpeg' }))}">`));
  if (p.tables) box.append(h(`<div class="tables"><h3 style="margin-top:16px">Tables in this file</h3>${p.tables}</div>`));
  return box;
}

// ---------- saving ----------
const safeName = n => String(n || 'file').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/^\.+/, '').slice(0, 180) || 'file';
async function download(blob, name) {
  const url = URL.createObjectURL(blob);
  name = safeName(name);
  try {
    if (api && api.downloads) { await api.downloads.download({ url, filename: name, conflictAction: 'uniquify', saveAs: false }); setTimeout(() => URL.revokeObjectURL(url), 120000); return; }
  } catch (e) { /* fall back to a normal download */ }
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}
async function saveAll(outs, zipBase) {
  if (!outs.length) return;
  if (outs.length === 1 || S.save === 'sep') { for (const o of outs) { await download(o.blob, o.name); await new Promise(r => setTimeout(r, 150)); } return; }
  const used = new Set(), files = [];
  for (const o of outs) {
    let n = safeName(o.name), k = 2;
    while (used.has(n.toLowerCase())) n = safeName(o.name).replace(/(\.[a-z0-9]+)?$/i, m => `-${k++}${m}`);
    used.add(n.toLowerCase());
    files.push({ name: n, bytes: new Uint8Array(await o.blob.arrayBuffer()) });
  }
  const d = new Date(), pad = x => String(x).padStart(2, '0');
  await download(PP_ZIP(files), `PageProof_${zipBase}_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.zip`);
}

// ---------- page wiring ----------
$('pick').onchange = e => { addFiles(e.target.files); e.target.value = ''; };
$('addMore').onclick = e => { e.preventDefault(); $('pick').click(); };
$('startOver').onclick = e => { e.preventDefault(); S.items.forEach(i => i.thumb && URL.revokeObjectURL(i.thumb)); S.items = []; S.order = []; S.sel = null; S.task = null; S.shared = null; status(''); render(); };
$('switchMode').onclick = e => {
  e.preventDefault();
  S.mode = S.mode === 'open' ? 'convert' : 'open';
  S.task = null;
  history.replaceState(null, '', S.mode === 'open' ? '?open=1' : location.pathname);
  render();
};
let dragDepth = 0;
document.addEventListener('dragenter', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { dragDepth++; document.body.classList.add('over'); } });
document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('over'); } });
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => { e.preventDefault(); dragDepth = 0; document.body.classList.remove('over'); if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });
document.addEventListener('paste', e => {
  if (/^(INPUT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName)) return;
  const files = [...(e.clipboardData ? e.clipboardData.files : [])];
  if (files.length) { e.preventDefault(); addFiles(files.map((f, i) => f.name && f.name !== 'image.png' ? f : new File([f], `pasted-${i + 1}.${(f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`, { type: f.type }))); }
});
window.addEventListener('resize', () => { if (S.task === 'edit') drawEditor(); });
render();
