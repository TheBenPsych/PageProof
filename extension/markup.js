// PageProof "Mark up a copy": highlight, draw boxes/circles/arrows and type on a COPY of a capture,
// then copy it to the clipboard or download it. The original evidence files are never touched.
const $ = id => document.getElementById(id);
const api = globalThis.browser || globalThis.chrome;
const params = new URLSearchParams(location.search);

const COLORS = { Red: '#e11d48', Yellow: '#facc15', Green: '#16a34a', Blue: '#2563eb', Black: '#0f172a', White: '#ffffff' };
const MAX_AREA = 60e6, MAX_SIDE = 30000; // keep pictures inside what browsers can draw

let base = null;          // the capture picture (canvas)
let meta = {};            // { host, url, captured, captureId, name }
let marks = [];           // every marking, in drawing order
let area = null;          // part of the page to copy, or null for the whole page
let tool = 'highlight', color = COLORS.Red, size = 2;
let selected = null;      // marking picked with the Move tool
let undoStack = [], redoStack = [];
let collector = '';

const ink = $('ink');
const ictx = ink.getContext('2d');

function setStatus(text, isError) {
  $('status').textContent = text || '';
  $('status').className = isError ? 'error' : '';
}

// ---------- sizes (relative to the picture, so markings look the same on any capture) ----------
const unit = () => Math.max(1, base.width / 1000);
const lineW = () => [0, 3, 6, 10][size] * unit();
const hlW = () => [0, 14, 26, 44][size] * unit();
const fontPx = () => [0, 18, 28, 44][size] * unit();

// ---------- drawing one marking ----------
function drawMark(ctx, m) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = m.color;
  ctx.lineWidth = m.lw;
  if (m.type === 'highlight') {
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    m.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    if (m.pts.length === 1) ctx.lineTo(m.pts[0][0] + 0.1, m.pts[0][1]);
    ctx.stroke();
  } else if (m.type === 'rect') {
    ctx.strokeRect(m.x, m.y, m.w, m.h);
  } else if (m.type === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse(m.x + m.w / 2, m.y + m.h / 2, Math.abs(m.w / 2), Math.abs(m.h / 2), 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (m.type === 'arrow') {
    const ang = Math.atan2(m.y2 - m.y1, m.x2 - m.x1);
    const head = Math.max(m.lw * 4, 14 * m.lw / 3);
    const bx = m.x2 - Math.cos(ang) * head * 0.8, by = m.y2 - Math.sin(ang) * head * 0.8;
    ctx.beginPath();
    ctx.moveTo(m.x1, m.y1);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.fillStyle = m.color;
    ctx.beginPath();
    ctx.moveTo(m.x2, m.y2);
    ctx.lineTo(m.x2 - head * Math.cos(ang - 0.45), m.y2 - head * Math.sin(ang - 0.45));
    ctx.lineTo(m.x2 - head * Math.cos(ang + 0.45), m.y2 - head * Math.sin(ang + 0.45));
    ctx.closePath();
    ctx.fill();
  } else if (m.type === 'text') {
    const b = textBox(ctx, m);
    // A light backing so the words can be read on top of any picture.
    ctx.fillStyle = m.color === COLORS.White ? 'rgba(15,23,42,.8)' : 'rgba(255,255,255,.88)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = m.color;
    ctx.textBaseline = 'top';
    m.text.split('\n').forEach((line, i) => ctx.fillText(line, m.x, m.y + i * m.size * 1.2));
  }
  ctx.restore();
}

function textBox(ctx, m) {
  ctx.font = 'bold ' + m.size + 'px system-ui, sans-serif';
  const lines = m.text.split('\n');
  const w = Math.max(...lines.map(l => ctx.measureText(l).width));
  const pad = m.size * 0.25;
  return { x: m.x - pad, y: m.y - pad, w: w + pad * 2, h: lines.length * m.size * 1.2 + pad * 2 - m.size * 0.2 };
}

function bounds(m) {
  if (m.type === 'highlight') {
    const xs = m.pts.map(p => p[0]), ys = m.pts.map(p => p[1]), r = m.lw / 2;
    return { x: Math.min(...xs) - r, y: Math.min(...ys) - r, w: Math.max(...xs) - Math.min(...xs) + 2 * r, h: Math.max(...ys) - Math.min(...ys) + 2 * r };
  }
  if (m.type === 'arrow') {
    const r = m.lw * 3;
    return { x: Math.min(m.x1, m.x2) - r, y: Math.min(m.y1, m.y2) - r, w: Math.abs(m.x2 - m.x1) + 2 * r, h: Math.abs(m.y2 - m.y1) + 2 * r };
  }
  if (m.type === 'text') return textBox(ictx, m);
  const r = m.lw;
  return { x: Math.min(m.x, m.x + m.w) - r, y: Math.min(m.y, m.y + m.h) - r, w: Math.abs(m.w) + 2 * r, h: Math.abs(m.h) + 2 * r };
}

function moveMark(m, dx, dy) {
  if (m.type === 'highlight') m.pts = m.pts.map(p => [p[0] + dx, p[1] + dy]);
  else if (m.type === 'arrow') { m.x1 += dx; m.y1 += dy; m.x2 += dx; m.y2 += dy; }
  else { m.x += dx; m.y += dy; }
}

// ---------- redraw the markings layer ----------
let pending = false;
function redraw() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    ictx.clearRect(0, 0, ink.width, ink.height);
    for (const m of marks) drawMark(ictx, m);
    if (draft) drawMark(ictx, draft);
    const a = draftArea || area;
    if (a) {
      // Dim everything outside the chosen area.
      ictx.save();
      ictx.fillStyle = 'rgba(15,23,42,.45)';
      ictx.beginPath();
      ictx.rect(0, 0, ink.width, ink.height);
      ictx.rect(a.x, a.y, a.w, a.h);
      ictx.fill('evenodd');
      ictx.setLineDash([8 * unit(), 6 * unit()]);
      ictx.strokeStyle = '#fff';
      ictx.lineWidth = 2 * unit();
      ictx.strokeRect(a.x, a.y, a.w, a.h);
      ictx.restore();
    }
    if (selected) {
      const b = bounds(selected);
      ictx.save();
      ictx.setLineDash([6 * unit(), 4 * unit()]);
      ictx.strokeStyle = '#2563eb';
      ictx.lineWidth = 2 * unit();
      ictx.strokeRect(b.x, b.y, b.w, b.h);
      ictx.restore();
    }
  });
}

// ---------- undo / redo ----------
const snapshot = () => JSON.stringify({ marks, area });
function remember() {
  undoStack.push(snapshot());
  if (undoStack.length > 200) undoStack.shift();
  redoStack = [];
  updateButtons();
}
function restore(s) {
  const st = JSON.parse(s);
  marks = st.marks; area = st.area; selected = null;
  updateButtons();
  redraw();
}
function undo() { if (!undoStack.length) return; redoStack.push(snapshot()); restore(undoStack.pop()); }
function redo() { if (!redoStack.length) return; undoStack.push(snapshot()); restore(redoStack.pop()); }

function updateButtons() {
  $('undo').disabled = !undoStack.length;
  $('redo').disabled = !redoStack.length;
  $('del').disabled = !selected;
  $('clearArea').hidden = !area;
  $('clearAll').disabled = !marks.length && !area;
}

// ---------- mouse / touch ----------
let draft = null, draftArea = null, drag = null;

function toImage(e) {
  const r = ink.getBoundingClientRect();
  return [(e.clientX - r.left) * ink.width / r.width, (e.clientY - r.top) * ink.height / r.height];
}

function hit(x, y) {
  for (let i = marks.length - 1; i >= 0; i--) {
    const b = bounds(marks[i]);
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return marks[i];
  }
  return null;
}

ink.addEventListener('pointerdown', e => {
  if (!base || e.button > 0) return;
  e.preventDefault(); // keeps the text box focused and stops the page from selecting
  if (editor) { commitText(); return; }
  const [x, y] = toImage(e);
  ink.setPointerCapture(e.pointerId);
  if (tool === 'move') {
    selected = hit(x, y);
    if (selected) { remember(); drag = { x, y, moved: false }; ink.style.cursor = 'grabbing'; }
    updateButtons();
    redraw();
    return;
  }
  if (tool === 'text') {
    const t = hit(x, y);
    if (t && t.type === 'text') openEditor(t);
    else openEditor({ type: 'text', x, y, text: '', color, size: fontPx() });
    return;
  }
  selected = null;
  drag = { x, y };
  if (tool === 'area') { draftArea = { x, y, w: 0, h: 0 }; return; }
  if (tool === 'highlight') draft = { type: 'highlight', color, lw: hlW(), pts: [[x, y]] };
  else if (tool === 'arrow') draft = { type: 'arrow', color, lw: lineW(), x1: x, y1: y, x2: x, y2: y };
  else draft = { type: tool, color, lw: lineW(), x, y, w: 0, h: 0 };
  redraw();
});

ink.addEventListener('pointermove', e => {
  if (!drag) return;
  let [x, y] = toImage(e);
  if (tool === 'move' && selected) {
    moveMark(selected, x - drag.x, y - drag.y);
    drag.x = x; drag.y = y; drag.moved = true;
  } else if (draftArea) {
    draftArea = { x: Math.min(drag.x, x), y: Math.min(drag.y, y), w: Math.abs(x - drag.x), h: Math.abs(y - drag.y) };
  } else if (draft) {
    if (draft.type === 'highlight') {
      // A highlighter held with Shift draws a straight line.
      if (e.shiftKey) draft.pts = [draft.pts[0], [x, y]];
      else draft.pts.push([x, y]);
    } else if (draft.type === 'arrow') { draft.x2 = x; draft.y2 = y; }
    else {
      let w = x - drag.x, h = y - drag.y;
      if (e.shiftKey) { const s = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * s; h = Math.sign(h || 1) * s; }
      draft.w = w; draft.h = h;
    }
  }
  redraw();
});

function endDrag() {
  if (!drag) return;
  if (tool === 'move') {
    if (!drag.moved) undoStack.pop(); // nothing changed
    ink.style.cursor = '';
  } else if (draftArea) {
    if (draftArea.w > 10 && draftArea.h > 10) {
      remember();
      area = roundBox(draftArea);
      setStatus('Only the part inside the box will be copied or downloaded. Click "Use whole page" to undo that.');
    }
    draftArea = null;
  } else if (draft) {
    const tiny = draft.type === 'arrow' ? Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) < 5
      : draft.type === 'highlight' ? false : Math.abs(draft.w) < 5 && Math.abs(draft.h) < 5;
    if (!tiny) {
      if (draft.w < 0) { draft.x += draft.w; draft.w = -draft.w; }
      if (draft.h < 0) { draft.y += draft.h; draft.h = -draft.h; }
      remember();
      marks.push(draft);
    }
    draft = null;
  }
  drag = null;
  updateButtons();
  redraw();
}
ink.addEventListener('pointerup', endDrag);
ink.addEventListener('pointercancel', endDrag);

const roundBox = b => ({ x: Math.max(0, Math.round(b.x)), y: Math.max(0, Math.round(b.y)),
  w: Math.round(Math.min(b.w, base.width - Math.max(0, b.x))), h: Math.round(Math.min(b.h, base.height - Math.max(0, b.y))) });

// ---------- typing text ----------
let editor = null, editing = null, editIndex = -1;
function openEditor(m) {
  editing = m;
  const r = ink.getBoundingClientRect(), k = r.width / ink.width; // screen pixels per picture pixel
  editor = document.createElement('textarea');
  editor.value = m.text;
  editor.style.left = (m.x * k - 6) + 'px';
  editor.style.top = (m.y * k - 4) + 'px';
  editor.style.fontSize = Math.max(10, m.size * k) + 'px';
  editor.style.color = m.color === COLORS.White ? '#0f172a' : m.color;
  editor.rows = Math.max(1, m.text.split('\n').length);
  editor.placeholder = 'Type here';
  const grow = () => { editor.rows = Math.max(1, editor.value.split('\n').length); editor.style.width = Math.max(120, editor.scrollWidth + 8) + 'px'; };
  editor.addEventListener('input', grow);
  editor.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(); }
    if (e.key === 'Escape') { editor.value = m.text; commitText(); }
    e.stopPropagation();
  });
  editor.addEventListener('blur', () => setTimeout(commitText, 0));
  // While a marking is being edited, take it off the picture (it comes back when you finish).
  editIndex = marks.indexOf(m);
  if (editIndex >= 0) { remember(); marks.splice(editIndex, 1); redraw(); }
  $('board').append(editor);
  editor.focus();
  grow();
  setStatus('Type your text, then press Enter (Shift+Enter for a new line).');
}

function commitText() {
  if (!editor) return;
  const text = editor.value.replace(/\s+$/, '');
  const m = editing;
  editor.remove();
  editor = null; editing = null;
  if (editIndex >= 0) {
    // Editing an existing text: put it back (changed), or leave it out if it was emptied.
    if (text === m.text) undoStack.pop();
    if (text) marks.splice(editIndex, 0, { ...m, text });
  } else if (text) { remember(); marks.push({ ...m, text }); }
  editIndex = -1;
  setStatus('');
  updateButtons();
  redraw();
}

// ---------- the finished picture ----------
// Draws the capture + markings (only the chosen area, if any), plus an optional label strip.
function finalCanvas() {
  const a = area || { x: 0, y: 0, w: base.width, h: base.height };
  const withLabel = $('label').checked;
  const u = Math.max(1, a.w / 1000) * (a.w < 600 ? 0.8 : 1);
  const labelH = withLabel ? Math.round(46 * u) : 0;
  const c = document.createElement('canvas');
  c.width = a.w;
  c.height = a.h + labelH;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.save();
  ctx.translate(-a.x, -a.y);
  ctx.beginPath();
  ctx.rect(a.x, a.y, a.w, a.h);
  ctx.clip();
  ctx.drawImage(base, 0, 0);
  for (const m of marks) drawMark(ctx, m);
  ctx.restore();
  if (withLabel) {
    // Label at the bottom so nobody mistakes this for the untouched original.
    const y = a.h, pad = 10 * u;
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(0, y, c.width, labelH);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, y, c.width, 3 * u);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#78350f';
    ctx.font = 'bold ' + (13 * u) + 'px system-ui, sans-serif';
    const now = new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    ctx.fillText(fit(ctx, 'MARKED-UP COPY, markings added ' + now + (collector ? ' by ' + collector : '') + '. Not the original evidence.', c.width - pad * 2), pad, y + 20 * u);
    ctx.font = (12 * u) + 'px system-ui, sans-serif';
    const src = [meta.url || meta.host || meta.name, meta.captured && 'captured ' + meta.captured, meta.captureId && 'Capture ID ' + meta.captureId].filter(Boolean).join('  ·  ');
    ctx.fillText(fit(ctx, 'Source: ' + (src || 'PageProof capture'), c.width - pad * 2), pad, y + 38 * u);
  }
  return c;
}

function fit(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  while (text.length > 4 && ctx.measureText(text + '...').width > maxW) text = text.slice(0, -1);
  return text + '...';
}

const toBlob = (canvas, type, q) => new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('the picture is too big to save')), type, q));

function fileBase() {
  const n = (meta.name || 'PageProof_capture').replace(/\.(zip|pdf|png|jpe?g|webp|gif)$/i, '').replace(/[^\w.-]+/g, '_').slice(0, 100);
  return n + '_MARKED-UP' + (area ? '_part' : '');
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

async function copyImage() {
  if (editor) commitText();
  setStatus('Copying...');
  try {
    if (!navigator.clipboard || !window.ClipboardItem) throw new Error('this browser cannot copy pictures');
    const c = finalCanvas();
    // Passing the picture as a "promise" keeps the browser's permission to copy while it is being made.
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': toBlob(c, 'image/png') })]);
    setStatus('Copied! Now paste it (Ctrl+V, or Cmd+V on a Mac) into an email, chat or document.' +
      (c.height > 8000 ? ' Tip: this is a very tall picture. Use "Pick area" to copy just the part that matters.' : ''));
  } catch (e) {
    setStatus('Could not copy the picture (' + e.message + '). Use "Download picture" instead, then attach the file.', true);
  }
}

async function downloadPng() {
  if (editor) commitText();
  setStatus('Saving picture...');
  try {
    download(await toBlob(finalCanvas(), 'image/png'), fileBase() + '.png');
    setStatus('Saved ' + fileBase() + '.png in your Downloads.');
  } catch (e) { setStatus('Could not save the picture: ' + e.message, true); }
}

async function downloadPdf() {
  if (editor) commitText();
  setStatus('Making PDF...');
  try {
    const c = finalCanvas();
    const pageH = Math.round(c.width * 1.4142); // A4 shape
    const pages = [];
    for (let y0 = 0; y0 < c.height; y0 += pageH) {
      const h = Math.min(pageH, c.height - y0);
      const s = document.createElement('canvas');
      s.width = c.width; s.height = h;
      s.getContext('2d').drawImage(c, 0, y0, c.width, h, 0, 0, c.width, h);
      pages.push({ jpeg: new Uint8Array(await (await toBlob(s, 'image/jpeg', 0.92)).arrayBuffer()), width: c.width, height: h });
    }
    download(makePdf(pages, { title: 'Marked-up copy of a PageProof capture' + (meta.host ? ' of ' + meta.host : ''),
      subject: 'MARKED-UP COPY, not the original evidence. ' + [meta.url, meta.captured, meta.captureId].filter(Boolean).join(' ') }), fileBase() + '.pdf');
    setStatus('Saved ' + fileBase() + '.pdf in your Downloads.');
  } catch (e) { setStatus('Could not make the PDF: ' + e.message, true); }
}

// ---------- loading a capture ----------
async function useImage(source, info) {
  // source: a Blob or an array of Blobs (stacked top to bottom, e.g. the pages of a PDF).
  const parts = [];
  for (const b of [].concat(source)) parts.push(await createImageBitmap(b));
  const W = Math.max(...parts.map(p => p.width));
  const H = parts.reduce((t, p) => t + p.height * W / p.width, 0);
  const k = Math.min(1, MAX_SIDE / H, MAX_SIDE / W, Math.sqrt(MAX_AREA / (W * H)));
  base = document.createElement('canvas');
  base.width = Math.round(W * k);
  base.height = Math.round(H * k);
  const bctx = base.getContext('2d');
  bctx.fillStyle = '#fff';
  bctx.fillRect(0, 0, base.width, base.height);
  let y = 0;
  for (const p of parts) {
    const h = p.height * W / p.width * k;
    bctx.drawImage(p, 0, Math.round(y), base.width, Math.round(h));
    y += h;
  }
  const shown = $('base');
  shown.width = base.width; shown.height = base.height;
  shown.getContext('2d').drawImage(base, 0, 0);
  ink.width = base.width; ink.height = base.height;
  $('board').style.width = Math.round(base.width / (info.scale || 1)) + 'px';
  meta = info;
  marks = []; area = null; selected = null; undoStack = []; redoStack = [];
  $('domain').textContent = 'Markup: ' + (meta.host || meta.name || 'capture');
  $('sub').textContent = [meta.url, meta.captured, meta.captureId].filter(Boolean).join('  ·  ') || meta.name || '';
  document.title = 'PageProof: markup ' + (meta.host || meta.name || 'a copy');
  $('drop').hidden = true;
  $('stage').hidden = false;
  $('toolbar').hidden = false;
  $('note').hidden = false;
  for (const b of ['copy', 'png', 'pdf']) $(b).disabled = false;
  setStatus(k < 1 ? 'This page is very long, so the copy has been made a little smaller to fit. The original is not affected.' : '');
  updateButtons();
  redraw();
}

// Our own PDFs hold one JPEG picture per page; pull those back out.
function pdfPictures(bytes) {
  const text = new TextDecoder('latin1').decode(bytes);
  const out = [];
  const re = /\/Subtype \/Image [^>]*?\/Filter \/DCTDecode \/Length (\d+) >>\nstream\n/g;
  let m;
  while ((m = re.exec(text))) {
    const start = m.index + m[0].length, len = +m[1];
    out.push(new Blob([bytes.subarray(start, start + len)], { type: 'image/jpeg' }));
  }
  const subject = (/\/Subject \(((?:\\.|[^\\)])*)\)/.exec(text) || [])[1] || '';
  const sm = /^(\S+) captured (\S+)/.exec(subject.replace(/\\(.)/g, '$1'));
  return { pictures: out, url: sm && sm[1], time: sm && sm[2] };
}

const niceTime = t => { try { return new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'long' }); } catch (e) { return t; } };
const hostOf = u => { try { return new URL(u).hostname; } catch (e) { return ''; } };

async function openFile(file) {
  setStatus('Opening ' + file.name + '...');
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
    const isPdf = new TextDecoder('latin1').decode(bytes.subarray(0, 5)) === '%PDF-';
    if (file.type.startsWith('image/') && !isZip && !isPdf) {
      return useImage(file, { name: file.name, captureId: (/PP-[A-Z0-9]{4,}/.exec(file.name) || [])[0] });
    }
    let pdf = bytes, details = '';
    if (isZip) {
      const files = await ppUnzip(bytes);
      const name = [...files.keys()].find(n => /\.pdf$/i.test(n) && !n.includes('/'));
      if (!name) throw new Error('there is no PDF in this zip, so it does not look like a PageProof evidence pack');
      pdf = files.get(name);
      if (files.get('capture-details.txt')) details = new TextDecoder().decode(files.get('capture-details.txt'));
    } else if (!isPdf) throw new Error('please choose a PageProof evidence pack (.zip), a PageProof PDF, or a picture');
    const p = pdfPictures(pdf);
    if (!p.pictures.length) throw new Error('this PDF was not made by PageProof, so its pages cannot be opened here. Try a screenshot or picture instead');
    const line = k => ((new RegExp('^' + k + ':\\s+(.+)$', 'm').exec(details) || [])[1] || '').trim();
    const url = line('Web address') || p.url;
    useImage(p.pictures, { name: file.name, url, host: hostOf(url), captured: line('Captured') || (p.time && niceTime(p.time)),
      captureId: line('Capture ID') || (/PP-[A-Z0-9]{4,}/.exec(file.name) || [])[0] });
  } catch (e) {
    setStatus('Could not open ' + file.name + ': ' + e.message + '.', true);
  }
}

// ---------- toolbar ----------
function pickTool(t) {
  if (editor) commitText();
  tool = t;
  selected = null;
  for (const b of document.querySelectorAll('[data-tool]')) b.classList.toggle('on', b.dataset.tool === t);
  ink.className = t === 'move' ? 'move' : t === 'text' ? 'text' : '';
  if (t === 'area') setStatus('Drag a box around the part of the page you want to copy or download.');
  else if (t === 'move') setStatus('Click a marking to pick it, then drag it, or press Delete to remove it.');
  updateButtons();
  redraw();
}

function pickColor(c) {
  color = c;
  for (const b of document.querySelectorAll('.swatch')) b.classList.toggle('on', b.dataset.color === c);
  if (selected) { remember(); selected.color = c; redraw(); }
}

function pickSize(n) {
  size = n;
  for (const b of document.querySelectorAll('[data-size]')) b.classList.toggle('on', +b.dataset.size === n);
}

for (const [name, c] of Object.entries(COLORS)) {
  const b = document.createElement('button');
  b.className = 'swatch';
  b.title = name;
  b.dataset.color = c;
  b.style.background = c;
  b.onclick = () => pickColor(c);
  $('colors').append(b);
}
for (const b of document.querySelectorAll('[data-tool]')) b.onclick = () => pickTool(b.dataset.tool);
for (const b of document.querySelectorAll('[data-size]')) b.onclick = () => pickSize(+b.dataset.size);
$('undo').onclick = undo;
$('redo').onclick = redo;
const deleteSelected = () => { if (!selected) return; remember(); marks = marks.filter(m => m !== selected); selected = null; updateButtons(); redraw(); };
$('del').onclick = deleteSelected;
$('clearArea').onclick = () => { remember(); area = null; setStatus(''); updateButtons(); redraw(); };
$('clearAll').onclick = () => { if (!marks.length && !area) return; remember(); marks = []; area = null; selected = null; updateButtons(); redraw(); };
$('copy').onclick = copyImage;
$('png').onclick = downloadPng;
$('pdf').onclick = downloadPdf;
$('pick').onchange = () => $('pick').files[0] && openFile($('pick').files[0]);
pickTool('highlight');
pickColor(COLORS.Red);
pickSize(2);

document.addEventListener('keydown', e => {
  if (!base || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
  else if (mod && k === 'c') { e.preventDefault(); copyImage(); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); deleteSelected(); }
  else if (!mod && !e.altKey) {
    const t = { h: 'highlight', b: 'rect', r: 'rect', c: 'ellipse', a: 'arrow', t: 'text', m: 'move', s: 'area' }[k];
    if (t) pickTool(t);
    if (e.key === 'Escape') { selected = null; updateButtons(); redraw(); }
  }
});

// Drag and drop a file anywhere, or paste a picture.
const drop = $('drop');
$('addImage').onclick = () => $('pick').click();
document.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
document.addEventListener('dragleave', () => drop.classList.remove('over'));
document.addEventListener('drop', e => {
  e.preventDefault();
  drop.classList.remove('over');
  const f = e.dataTransfer.files[0];
  if (f) openFile(f);
});
document.addEventListener('paste', e => {
  if (e.target.tagName === 'TEXTAREA') return;
  const f = [...(e.clipboardData || {}).files || []].find(x => x.type.startsWith('image/'));
  if (f) { e.preventDefault(); openFile(f); }
});

// ---------- start ----------
(async () => {
  try { collector = ((await api.storage.local.get('lastCase')).lastCase || {}).collector || ''; } catch (e) { /* ignore */ }
  if (params.get('from') === 'capture') {
    try {
      const rec = await PP_DB.get('markup');
      if (rec && rec.blob) return useImage(rec.blob, rec.meta || {});
    } catch (e) { /* fall through to the drop box */ }
    setStatus('That capture is no longer open. Drop its evidence pack (.zip) below instead.', true);
  }
  if (!base) drop.hidden = false;
})();
