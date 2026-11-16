// PageProof Compare: lay a copy over the original, like superimposing in Photoshop.
// The copy can fade (opacity), be dragged aside and back, and be lined up automatically.
const $ = id => document.getElementById(id);
const api = globalThis.browser || globalThis.chrome;
const P = { A: null, B: null };            // A = original, B = copy: { bitmap, name, bytes, sha, src }
let T = { s: 1, x: 0, y: 0 };              // where the copy sits, in the original's pixels
let opacity = 0.5, mode = 'overlay';
let WS = 1;                                 // working scale (big photos are drawn smaller)
let PADX = 0, PADY = 0;                     // room around the original to slide the copy aside
let scoreInfo = null, fading = false, busyAnim = false;

const setStatus = (t, err) => { $('status').textContent = t || ''; $('status').className = err ? 'error' : ''; };
const pad2 = n => String(n).padStart(2, '0');
const stamp = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + '_' + pad2(d.getHours()) + '-' + pad2(d.getMinutes()) + '-' + pad2(d.getSeconds());
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function sha256(bytes) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join(''); }
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

// ---------- adding the two pictures ----------
async function setPicture(k, blob, name, src) {
  let bitmap;
  try { bitmap = await createImageBitmap(blob); }
  catch (e) { return setStatus('This browser can\'t open ' + (name || 'that file') + ' as a picture. Try a JPEG, PNG or WebP.', true); }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  P[k] = { bitmap, name: name || 'picture', bytes, sha: await sha256(bytes), src: src || '' };
  const slot = $('slot' + k);
  slot.querySelector('.th').innerHTML = '';
  const img = document.createElement('img'); img.src = URL.createObjectURL(blob); slot.querySelector('.th').append(img);
  slot.querySelector('.nm').textContent = P[k].name + ' · ' + bitmap.width + ' × ' + bitmap.height;
  slot.querySelector('.nm').title = (src || name || '') + '\nSHA-256 ' + P[k].sha;
  scoreInfo = null; $('score').hidden = true;
  if (P.A && P.B) start(); else setStatus(k === 'A' ? 'Now add the copy (box 2).' : 'Now add the original (box 1).');
}
for (const k of ['A', 'B']) {
  const slot = $('slot' + k), input = slot.querySelector('input');
  input.onchange = () => { const f = input.files[0]; if (f) setPicture(k, f, f.name); input.value = ''; };
  slot.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); slot.classList.add('over'); });
  slot.addEventListener('dragleave', () => slot.classList.remove('over'));
  slot.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); slot.classList.remove('over'); dropInto(k, e.dataTransfer); });
}
async function dropInto(k, dt) {
  const f = [...dt.files][0];
  if (f) return setPicture(k, f, f.name);
  const url = (dt.getData('text/uri-list') || dt.getData('text/plain') || '').trim();
  if (/^(https?|data):/.test(url)) {
    try { const res = await fetch(url, { credentials: 'include' }); setPicture(k, await res.blob(), decodeURIComponent(new URL(url).pathname.split('/').pop() || 'picture'), url); }
    catch (e) { setStatus('Could not download that picture: ' + e.message, true); }
  }
}
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => { e.preventDefault(); dropInto(P.A ? 'B' : 'A', e.dataTransfer); });
addEventListener('paste', e => {
  const f = [...e.clipboardData.files][0];
  if (f) setPicture(P.A ? 'B' : 'A', f, 'pasted-picture.png');
});

// ---------- drawing ----------
const view = $('view');
function start() {
  const A = P.A.bitmap, B = P.B.bitmap;
  WS = Math.min(1, 1800 / Math.max(A.width, A.height));
  PADX = Math.round(A.width * 0.35); PADY = Math.round(A.height * 0.12);
  view.width = Math.round((A.width + PADX * 2) * WS);
  view.height = Math.round((A.height + PADY * 2) * WS);
  // Start with the copy stretched to the original's width, at the top left.
  T = { s: A.width / B.width, x: 0, y: 0 };
  $('empty').hidden = true; view.hidden = false; $('hint').hidden = false;
  for (const id of ['auto', 'opacity', 'aside', 'fade', 'smaller', 'bigger', 'sPdf', 'sPng', 'sVid']) $(id).disabled = false;
  if (!window.MediaRecorder || !view.captureStream) { $('sVid').disabled = true; $('sVid').title = 'This browser cannot record video'; }
  setStatus('Click "Line them up automatically", or drag the copy into place yourself.');
  draw();
}

// Draws one picture of the comparison. Used for the screen and for the saved files.
function paint(ctx, W, H, k, o, m, opts = {}) {
  const A = P.A.bitmap, B = P.B.bitmap;
  ctx.save();
  ctx.fillStyle = '#e5e7eb'; ctx.fillRect(0, 0, W, H);
  // light checkerboard so see-through parts are visible
  ctx.fillStyle = '#f3f4f6';
  const c = Math.max(8, Math.round(16 * k * 2));
  for (let y = 0; y < H; y += c) for (let x = (y / c) % 2 ? c : 0; x < W; x += c * 2) ctx.fillRect(x, y, c, c);
  const ox = opts.ox != null ? opts.ox : PADX, oy = opts.oy != null ? opts.oy : PADY;
  ctx.imageSmoothingQuality = 'high';
  if (m === 'side') {
    const h = H * 0.86, sa = h / A.height, sb = h / B.height;
    const wa = A.width * sa, wb = B.width * sb, gap = W * 0.03;
    const sc = Math.min(1, (W - gap * 3) / (wa + wb));
    const x0 = (W - (wa + wb) * sc - gap) / 2, y0 = (H - h * sc) / 2;
    ctx.drawImage(A, x0, y0, wa * sc, h * sc);
    ctx.drawImage(B, x0 + wa * sc + gap, y0, wb * sc, h * sc);
    label(ctx, 'ORIGINAL', x0 + 6, y0 + 6, '#2563eb', k);
    label(ctx, 'COPY', x0 + wa * sc + gap + 6, y0 + 6, '#f59e0b', k);
    ctx.restore();
    return;
  }
  ctx.drawImage(A, ox * k, oy * k, A.width * k, A.height * k);
  const bx = (ox + T.x) * k, by = (oy + T.y) * k, bw = B.width * T.s * k, bh = B.height * T.s * k;
  if (m === 'diff') {
    ctx.save();
    ctx.beginPath(); ctx.rect(ox * k, oy * k, A.width * k, A.height * k); ctx.clip();
    ctx.globalCompositeOperation = 'difference';
    ctx.drawImage(B, bx, by, bw, bh);
    ctx.restore();
  } else {
    ctx.globalAlpha = o;
    ctx.drawImage(B, bx, by, bw, bh);
    ctx.globalAlpha = 1;
  }
  if (opts.edges !== false) {
    ctx.setLineDash([10 * Math.max(1, k * 2), 6 * Math.max(1, k * 2)]);
    ctx.lineWidth = Math.max(2, 3 * k * 1.5);
    ctx.strokeStyle = '#f59e0b'; ctx.strokeRect(bx, by, bw, bh);
    ctx.setLineDash([]);
  }
  if (opts.labels !== false) {
    label(ctx, 'ORIGINAL', ox * k + 6, oy * k + 6, '#2563eb', k);
    if (m !== 'diff') label(ctx, 'COPY ' + Math.round(o * 100) + '%', bx + 6, by + bh - 6 - Math.max(18, 26 * k * 1.5), '#f59e0b', k);
  }
  ctx.restore();
}
function label(ctx, text, x, y, color, k) {
  const fs = Math.max(12, Math.round(22 * k * 1.4));
  ctx.font = 'bold ' + fs + 'px system-ui, sans-serif';
  const w = ctx.measureText(text).width + fs;
  ctx.fillStyle = color; ctx.fillRect(x, y, w, fs * 1.5);
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + fs / 2, y + fs * 0.78);
  ctx.textBaseline = 'alphabetic';
}
function draw() {
  if (!P.A || !P.B) return;
  paint(view.getContext('2d'), view.width, view.height, WS, opacity, mode);
  $('opVal').textContent = mode === 'diff' ? 'Difference view: black means the same' : Math.round(opacity * 100) + '% copy, ' + (100 - Math.round(opacity * 100)) + '% original';
  $('scaleVal').textContent = 'Copy size: ' + (T.s * 100).toFixed(1) + '% · moved ' + Math.round(T.x) + ', ' + Math.round(T.y) + ' px';
}

// ---------- moving the copy by hand ----------
let dragFrom = null;
view.addEventListener('pointerdown', e => {
  if (mode === 'side') return;
  view.setPointerCapture(e.pointerId); view.classList.add('drag');
  dragFrom = { x: e.clientX, y: e.clientY, tx: T.x, ty: T.y };
});
view.addEventListener('pointermove', e => {
  if (!dragFrom) return;
  const k = view.width / view.getBoundingClientRect().width / WS;   // screen pixels -> original's pixels
  T.x = dragFrom.tx + (e.clientX - dragFrom.x) * k;
  T.y = dragFrom.ty + (e.clientY - dragFrom.y) * k;
  draw();
});
const endDrag = () => { if (dragFrom) { dragFrom = null; view.classList.remove('drag'); rescore(); } };
view.addEventListener('pointerup', endDrag);
view.addEventListener('pointercancel', endDrag);
view.addEventListener('keydown', e => {
  const d = e.shiftKey ? 10 : 1;
  const mv = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key];
  if (!mv) return;
  e.preventDefault(); T.x += mv[0]; T.y += mv[1]; draw(); rescoreSoon();
});
const resize = f => { const B = P.B.bitmap; const cx = T.x + B.width * T.s / 2, cy = T.y + B.height * T.s / 2; T.s *= f; T.x = cx - B.width * T.s / 2; T.y = cy - B.height * T.s / 2; draw(); rescoreSoon(); };
$('smaller').onclick = () => resize(1 / 1.01);
$('bigger').onclick = () => resize(1.01);
$('opacity').oninput = () => { opacity = $('opacity').value / 100; if (mode === 'diff') setMode('overlay'); draw(); };
function setMode(m) { mode = m; for (const b of $('modes').children) b.classList.toggle('on', b.dataset.mode === m); draw(); }
for (const b of $('modes').children) b.onclick = () => setMode(b.dataset.mode);

// "Slide aside and back", like nudging the top layer in Photoshop to show it really lines up.
async function slideAside(ctxDraw = draw) {
  const x0 = T.x, dist = P.A.bitmap.width * 0.25, steps = 24;
  for (let i = 1; i <= steps; i++) { T.x = x0 + dist * Math.sin(i / steps * Math.PI / 2); ctxDraw(); await sleep(22); }
  await sleep(450);
  for (let i = steps - 1; i >= 0; i--) { T.x = x0 + dist * Math.sin(i / steps * Math.PI / 2); ctxDraw(); await sleep(22); }
  T.x = x0; ctxDraw();
}
$('aside').onclick = async () => {
  if (busyAnim) return; busyAnim = true;
  if (mode === 'side') setMode('overlay');
  if (opacity < 0.3 || opacity > 0.9) { opacity = 0.6; $('opacity').value = 60; }
  await slideAside(); busyAnim = false;
};
$('fade').onclick = async () => {
  fading = !fading;
  $('fade').textContent = fading ? '⏸ Stop fade' : '▶ Play fade';
  if (mode !== 'overlay') setMode('overlay');
  const t0 = performance.now(), keep = opacity;
  while (fading) {
    opacity = 0.5 - 0.5 * Math.cos((performance.now() - t0) / 1600 * Math.PI);
    $('opacity').value = Math.round(opacity * 100); draw();
    await new Promise(r => requestAnimationFrame(r));
  }
  opacity = keep; $('opacity').value = Math.round(keep * 100); draw();
};

// ---------- lining up automatically ----------
function grayOf(bitmap, w, h) {
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data, g = new Float32Array(w * h);
  for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  return { w, h, g };
}
// Average difference where the two overlap (lower = better), with the copy at (ox, oy).
function cost(a, b, ox, oy, stride, minFrac) {
  const x0 = Math.max(0, ox), x1 = Math.min(a.w, ox + b.w), y0 = Math.max(0, oy), y1 = Math.min(a.h, oy + b.h);
  if (x1 <= x0 || y1 <= y0) return Infinity;
  if ((x1 - x0) * (y1 - y0) < minFrac * Math.min(a.w * a.h, b.w * b.h)) return Infinity;
  let sum = 0, n = 0;
  for (let y = y0; y < y1; y += stride) {
    const ar = y * a.w, br = (y - oy) * b.w - ox;
    for (let x = x0; x < x1; x += stride) { sum += Math.abs(a.g[ar + x] - b.g[br + x]); n++; }
  }
  return sum / n;
}
// How alike they are where they overlap: correlation, 1 = identical.
function likeness(a, b, ox, oy) {
  const x0 = Math.max(0, ox), x1 = Math.min(a.w, ox + b.w), y0 = Math.max(0, oy), y1 = Math.min(a.h, oy + b.h);
  if (x1 <= x0 || y1 <= y0) return { r: 0, overlap: 0 };
  let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const p = a.g[y * a.w + x], q = b.g[(y - oy) * b.w + (x - ox)];
    n++; sa += p; sb += q; saa += p * p; sbb += q * q; sab += p * q;
  }
  const cov = sab / n - (sa / n) * (sb / n), va = saa / n - (sa / n) ** 2, vb = sbb / n - (sb / n) ** 2;
  const r = va > 1 && vb > 1 ? cov / Math.sqrt(va * vb) : (Math.abs(sa / n - sb / n) < 3 ? 1 : 0);
  return { r, overlap: ((x1 - x0) * (y1 - y0)) / (b.w * b.h), overlapA: ((x1 - x0) * (y1 - y0)) / (a.w * a.h) };
}

async function autoAlign() {
  const A = P.A.bitmap, B = P.B.bitmap, big = Math.max(A.width, A.height);
  // Search coarse to fine: many sizes and positions on tiny versions, then refine on bigger ones.
  const levels = [{ L: 48, sRange: [0.2, 1.6], sSteps: 34, off: null, stride: 1 },
    { L: 160, sSpan: 0.06, sSteps: 13, off: 6, stride: 2 },
    { L: 420, sSpan: 0.015, sSteps: 7, off: 3, stride: 2 }];
  let best = null;
  for (const lv of levels) {
    const f = lv.L / big;
    const a = grayOf(A, A.width * f, A.height * f);
    const fitW = A.width / B.width;
    const scales = [];
    if (!best) {
      const [lo, hi] = lv.sRange;
      for (let i = 0; i < lv.sSteps; i++) scales.push(fitW * lo * Math.pow(hi / lo, i / (lv.sSteps - 1)));
      scales.push(fitW, A.height / B.height);
    } else for (let i = 0; i < lv.sSteps; i++) scales.push(best.s * (1 - lv.sSpan + 2 * lv.sSpan * i / (lv.sSteps - 1)));
    let lvBest = null;
    for (const s of scales) {
      const b = grayOf(B, B.width * s * f, B.height * s * f);
      if (b.w < 4 || b.h < 4) continue;
      let xs, ys;
      if (!best) { xs = [-Math.floor(b.w * 0.6), a.w - Math.ceil(b.w * 0.4)]; ys = [-Math.floor(b.h * 0.6), a.h - Math.ceil(b.h * 0.4)]; }
      else { const cx = Math.round(best.x * f), cy = Math.round(best.y * f); xs = [cx - lv.off, cx + lv.off]; ys = [cy - lv.off, cy + lv.off]; }
      for (let oy = ys[0]; oy <= ys[1]; oy++) for (let ox = xs[0]; ox <= xs[1]; ox++) {
        const c = cost(a, b, ox, oy, lv.stride, 0.35);
        if (!lvBest || c < lvBest.c) lvBest = { c, s, x: ox / f, y: oy / f };
      }
      await sleep(0);
    }
    if (lvBest) best = lvBest;
  }
  return best;
}

$('auto').onclick = async () => {
  $('auto').disabled = true;
  $('auto').textContent = '⏳ Lining up...';
  setStatus('Trying different sizes and positions...');
  try {
    const t0 = performance.now();
    const best = await autoAlign();
    if (!best || !isFinite(best.c)) throw new Error('no position fits');
    // Animate the copy sliding into place.
    const from = { ...T }, steps = 30;
    if (mode === 'side') setMode('overlay');
    for (let i = 1; i <= steps; i++) {
      const e = 1 - Math.pow(1 - i / steps, 3);
      T = { s: from.s + (best.s - from.s) * e, x: from.x + (best.x - from.x) * e, y: from.y + (best.y - from.y) * e };
      draw(); await sleep(16);
    }
    T = { s: best.s, x: best.x, y: best.y }; draw();
    await rescore();
    setStatus('Lined up in ' + ((performance.now() - t0) / 1000).toFixed(1) + ' s. Move the slider to fade between them, or try "Slide aside and back". You can still drag the copy to fine-tune it.');
  } catch (e) { setStatus('Could not line them up automatically (' + e.message + '). Drag the copy into place instead.', true); }
  $('auto').disabled = false;
  $('auto').textContent = '✨ Line them up automatically';
};

async function rescore() {
  if (!P.A || !P.B) return;
  const A = P.A.bitmap, B = P.B.bitmap, f = 360 / Math.max(A.width, A.height);
  const a = grayOf(A, A.width * f, A.height * f), b = grayOf(B, B.width * T.s * f, B.height * T.s * f);
  const L = likeness(a, b, Math.round(T.x * f), Math.round(T.y * f));
  const pct = Math.max(0, Math.round(L.r * 1000) / 10);
  const verdict = L.overlap < 0.3 ? ['bad', 'The copy is mostly off the original', 'Line them up first.']
    : pct >= 95 ? ['good', 'Very likely the same photo', 'They match almost pixel for pixel where they overlap.']
    : pct >= 85 ? ['good', 'Probably the same photo', 'Small differences, such as resizing, recompression or colour edits.']
    : pct >= 60 ? ['mid', 'Some likeness', 'Check the overlay by eye. They may not be lined up exactly yet.']
    : ['bad', 'Probably not lined up, or not the same photo', 'Try "Line them up automatically", or drag the copy into place.'];
  scoreInfo = { pct, verdict, overlap: L.overlap, overlapA: L.overlapA };
  const box = $('score');
  box.hidden = false; box.className = 'card ' + verdict[0];
  box.innerHTML = '';
  const b1 = document.createElement('b'); b1.textContent = verdict[1];
  const p = document.createElement('div'); p.className = 'pct'; p.textContent = pct + '% match';
  const sm = document.createElement('small'); sm.textContent = verdict[2] + ' The copy covers ' + Math.round(Math.min(1, L.overlapA) * 100) + '% of the original. The score is a guide; the overlay is what to show.';
  box.append(b1, p, sm);
}
let rescoreTimer = 0;
const rescoreSoon = () => { clearTimeout(rescoreTimer); rescoreTimer = setTimeout(rescore, 400); };

// ---------- saving ----------
// One frame, cropped to the original plus wherever the copy sits.
function frame(o, m, maxSide = 1600, labels = true) {
  const A = P.A.bitmap, B = P.B.bitmap;
  const L = Math.min(0, T.x), Tp = Math.min(0, T.y);
  const R = Math.max(A.width, T.x + B.width * T.s), Bt = Math.max(A.height, T.y + B.height * T.s);
  const m2 = Math.round(Math.max(A.width, A.height) * 0.02);
  const w = R - L + m2 * 2, h = Bt - Tp + m2 * 2;
  const k = Math.min(1, maxSide / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
  paint(c.getContext('2d'), c.width, c.height, k, o, m, { ox: m2 - L, oy: m2 - Tp, labels });
  return c;
}
function sideBySide(maxSide = 1600) {
  const c = document.createElement('canvas'); c.width = maxSide; c.height = Math.round(maxSide * 0.5);
  paint(c.getContext('2d'), c.width, c.height, 1, 1, 'side');
  return c;
}
const toBlob = (c, t, q) => new Promise(r => c.toBlob(r, t, q));
const baseName = () => 'PageProof_compare_' + stamp(new Date());

$('sPng').onclick = async () => {
  const c = mode === 'side' ? sideBySide() : frame(opacity, mode);
  download(await toBlob(c, 'image/png'), baseName() + '.png');
  setStatus('Picture saved to your Downloads.');
};

$('sPdf').onclick = async () => {
  $('sPdf').disabled = true; setStatus('Making the PDF...');
  try {
    if (!scoreInfo) await rescore();
    const A = P.A, B = P.B, now = new Date();
    const items = [
      { p: 'In short: ' + scoreInfo.verdict[1] + ' (' + scoreInfo.pct + '% match where they overlap). ' + scoreInfo.verdict[2], box: '#eff6ff', color: '#1e3a8a' },
      { h: 'The two pictures' }, { image: sideBySide(1400), maxH: 520 },
      { kv: [
        ['Original', A.name + '  (' + A.bitmap.width + ' x ' + A.bitmap.height + ')'], ['Original from', A.src], ['Original SHA-256', A.sha],
        ['Copy', B.name + '  (' + B.bitmap.width + ' x ' + B.bitmap.height + ')'], ['Copy from', B.src], ['Copy SHA-256', B.sha],
        ['How the copy was placed', 'Resized to ' + (T.s * 100).toFixed(1) + '% and moved ' + Math.round(T.x) + ', ' + Math.round(T.y) + ' pixels (in the original\'s pixels), so it sits on top of the original'],
        ['Match score', scoreInfo.pct + '% (correlation of brightness where they overlap; 100% = identical)'],
        ['Copy covers', Math.round(Math.min(1, scoreInfo.overlapA) * 100) + '% of the original'],
        ['Made', now.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'long' }) + ' with PageProof ' + api.runtime.getManifest().version]
      ] },
      { h: 'Overlay: the copy laid on top of the original' },
      { p: 'Like superimposing in Photoshop: the copy (orange dashed edge) sits on the original and is made more see-through in steps. If it is the same photo, every detail lines up at every step.', color: '#475569' },
      { image: frame(0, 'overlay', 1400), maxH: 600, caption: 'Copy at 0%: the original only' },
      { image: frame(0.5, 'overlay', 1400), maxH: 600, caption: 'Copy at 50%: both at once. Same photo = no doubled edges' },
      { image: frame(1, 'overlay', 1400), maxH: 600, caption: 'Copy at 100%: the copy only, in the same place' },
      { h: 'Difference view' },
      { p: 'The copy is subtracted from the original. Where the two pictures are the same the result is black; anything different shows up bright.', color: '#475569' },
      { image: frame(1, 'diff', 1400), maxH: 700, caption: 'Black = identical. Bright = different (edits, added logos, cropping edges)' },
      { p: 'The match score is a guide worked out by PageProof. The overlay pictures are what to show.', color: '#64748b' }
    ];
    const pages = PP_REPORT.render({ title: 'Picture comparison', subtitle: ['Original: ' + A.name + '   ·   Copy: ' + B.name, now.toLocaleString(), 'PageProof Compare'],
      footer: 'PageProof Compare  ·  ' + A.name + ' vs ' + B.name, items });
    download(makePdf(await PP_REPORT.pdfPages(pages), { title: 'PageProof picture comparison', subject: A.name + ' vs ' + B.name }), baseName() + '.pdf');
    setStatus('PDF saved to your Downloads.');
  } catch (e) { setStatus('Could not make the PDF: ' + e.message, true); }
  $('sPdf').disabled = false;
};

// A short video: the copy fades in, slides aside and back, fades out, then the difference view.
$('sVid').onclick = async () => {
  if (busyAnim) return;
  busyAnim = true; $('sVid').disabled = true;
  setStatus('Recording a short video (about 9 seconds)...');
  try {
    const c = frame(0, 'overlay', 1280);
    const ctx = c.getContext('2d');
    const A = P.A.bitmap, B = P.B.bitmap;
    const L = Math.min(0, T.x), Tp = Math.min(0, T.y), m2 = Math.round(Math.max(A.width, A.height) * 0.02);
    const k = c.width / (Math.max(A.width, T.x + B.width * T.s) - L + m2 * 2);
    const at = { ox: m2 - L, oy: m2 - Tp };
    const show = (o, m) => paint(ctx, c.width, c.height, k, o, m, at);
    const stream = c.captureStream(30);
    const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find(t => MediaRecorder.isTypeSupported(t)) || '';
    const rec = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 6e6 } : {});
    const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    const done = new Promise(r => { rec.onstop = r; });
    rec.start(200);
    const tween = async (ms, fn) => { const t0 = performance.now(); for (;;) { const t = Math.min(1, (performance.now() - t0) / ms); fn(t); if (t >= 1) break; await new Promise(r => requestAnimationFrame(r)); } };
    show(0, 'overlay'); await sleep(800);
    await tween(1800, t => show(t, 'overlay'));
    await sleep(500);
    const keepX = T.x;
    await tween(900, t => { T.x = keepX + A.width * 0.25 * Math.sin(t * Math.PI / 2); show(0.6, 'overlay'); });
    await sleep(400);
    await tween(900, t => { T.x = keepX + A.width * 0.25 * Math.cos(t * Math.PI / 2); show(0.6, 'overlay'); });
    T.x = keepX;
    await tween(1500, t => show(0.6 - 0.6 * t, 'overlay'));
    show(1, 'diff'); await sleep(1600);
    rec.stop(); await done;
    const ext = (rec.mimeType || type).includes('mp4') ? 'mp4' : 'webm';
    download(new Blob(chunks, { type: rec.mimeType || type || 'video/webm' }), baseName() + '.' + ext);
    setStatus('Video saved to your Downloads (.' + ext + ', plays in any web browser and VLC).');
  } catch (e) { setStatus('Could not record the video: ' + e.message, true); }
  busyAnim = false; $('sVid').disabled = false; draw();
};

// ---------- start: the Image Inspector can hand over its picture as the copy ----------
(async () => {
  const params = new URLSearchParams(location.search);
  if (params.get('from') === 'inspector') {
    try {
      const rec = await PP_DB.get('compare');
      if (rec && rec.blob) await setPicture('B', rec.blob, rec.name, rec.src);
      setStatus('The picture from the Inspector is in box 2 (the copy). Now add your client\'s original in box 1.');
    } catch (e) { /* start empty */ }
  }
})();
