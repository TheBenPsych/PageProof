// PageProof Compare: lay a copy over the original, like superimposing in Photoshop.
// The copy can fade (opacity), be dragged aside and back, and be lined up automatically.
const $ = id => document.getElementById(id);
const api = globalThis.browser || globalThis.chrome;
const P = { A: null, B: null };            // A = original, B = copy: { bitmap, name, bytes, sha, src }
let T = PP_ALIGN.place();                  // where the copy sits, in the original's pixels (see align.js)
let opacity = 0.5, mode = 'overlay';
const BLUE = '#2563eb', ORANGE = '#f59e0b';
let WS = 1;                                 // working scale (big photos are drawn smaller)
let PADX = 0, PADY = 0;                     // room around the original to slide the copy aside
let scoreInfo = null, fading = false, busyAnim = false;
let CH = null;                              // which parts are the same photo / changed (PP_ALIGN.changes)
let showChg = true;                         // "Show changes" switch
let spots = [];                             // spots compared on their own: { box, res }
let spotMode = false, spotFrom = null, spotNow = null;
let nearby = null;                          // nearby shots checked: [{ name, blob, lines, strength, same }]

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
  scoreInfo = null; CH = null; spots = []; renderSpots(); $('score').hidden = true;
  if (nearby) renderNearby();
  if (P.A && P.B) start(); else setStatus(k === 'A' ? 'Now add the copy.' : 'Now add the original.');
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
  T = PP_ALIGN.place({ s: A.width / B.width });
  $('empty').hidden = true; view.hidden = false; $('hint').hidden = false;
  for (const id of ['auto', 'showChg', 'spotBtn', 'opacity', 'aside', 'fade', 'smaller', 'bigger', 'sPdf', 'sPng', 'sVid', 'shSize', 'shW', 'shH', 'shR', 'shFlip', 'shReset']) $(id).disabled = false;
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
    ctx.lineWidth = Math.max(2, 3 * k * 1.5);
    ctx.strokeStyle = BLUE; ctx.strokeRect(x0, y0, wa * sc, h * sc);
    ctx.setLineDash([10 * Math.max(1, k * 2), 6 * Math.max(1, k * 2)]);
    ctx.strokeStyle = ORANGE; ctx.strokeRect(x0 + wa * sc + gap, y0, wb * sc, h * sc);
    ctx.setLineDash([]);
    label(ctx, 'ORIGINAL', x0 + 6, y0 + 6, '#2563eb', k);
    label(ctx, 'COPY', x0 + wa * sc + gap + 6, y0 + 6, '#f59e0b', k);
    ctx.restore();
    return;
  }
  if (m === 'tint') {
    // Colour check: the original in blue tones, the copy in orange tones, added together.
    // Where the two line up they cancel out to plain grey; anything off shows up blue or orange.
    // The copy's brightness and contrast are first matched to the original's (copies are often
    // brightened or colour-graded), so only real differences show.
    const layer = drawIt => {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const t = c.getContext('2d', { willReadFrequently: true }); t.imageSmoothingQuality = 'high'; drawIt(t);
      return t.getImageData(0, 0, W, H);
    };
    const da = layer(t => t.drawImage(A, ox * k, oy * k, A.width * k, A.height * k)).data;
    const db = layer(t => PP_ALIGN.drawCopy(t, B, T, k, ox, oy)).data;
    const gray = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0;
    for (let i = 0; i < da.length; i += 16) if (da[i + 3] > 250 && db[i + 3] > 250) { const p = gray(da, i), q = gray(db, i); n++; sa += p; sb += q; saa += p * p; sbb += q * q; }
    const ma = n ? sa / n : 128, mb = n ? sb / n : 128;
    const gain = n ? Math.sqrt(Math.max(1, saa / n - ma * ma) / Math.max(1, sbb / n - mb * mb)) : 1;
    const out = ctx.createImageData(W, H), o2 = out.data;
    for (let i = 0; i < o2.length; i += 4) {
      const ha = da[i + 3] / 255, hb = db[i + 3] / 255;
      if (!ha && !hb) continue;
      const ga = ha ? gray(da, i) : 0, gb = hb ? Math.max(0, Math.min(255, (gray(db, i) - mb) * gain + ma)) : 0;
      // original = blue (0, 0.5, 1), copy = orange (1, 0.5, 0); added together, equal = grey
      o2[i] = gb * hb; o2[i + 1] = (ga * ha + gb * hb) / 2; o2[i + 2] = ga * ha; o2[i + 3] = 255 * Math.max(ha, hb);
    }
    const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').putImageData(out, 0, 0);
    ctx.drawImage(c, 0, 0);
  } else ctx.drawImage(A, ox * k, oy * k, A.width * k, A.height * k);
  if (m === 'tint') { /* drawn above */ }
  else if (m === 'diff') {
    ctx.save();
    ctx.beginPath(); ctx.rect(ox * k, oy * k, A.width * k, A.height * k); ctx.clip();
    ctx.globalCompositeOperation = 'difference';
    PP_ALIGN.drawCopy(ctx, B, T, k, ox, oy);
    ctx.restore();
  } else {
    ctx.globalAlpha = o;
    PP_ALIGN.drawCopy(ctx, B, T, k, ox, oy);
    ctx.globalAlpha = 1;
  }
  if (opts.changes !== false && showChg && CH) drawChanges(ctx, k, ox, oy);
  if (opts.spots !== false && spots.length) drawSpots(ctx, k, ox, oy);
  if (opts.edges !== false) {
    // The original gets a solid blue edge, the copy a dashed orange one, matching their labels.
    ctx.lineWidth = Math.max(2, 3 * k * 1.5);
    ctx.strokeStyle = BLUE; ctx.strokeRect(ox * k, oy * k, A.width * k, A.height * k);
    ctx.setLineDash([10 * Math.max(1, k * 2), 6 * Math.max(1, k * 2)]);
    ctx.strokeStyle = ORANGE; PP_ALIGN.drawCopy(ctx, B, T, k, ox, oy, true);
    ctx.setLineDash([]);
    if (T.cut) {   // a collage: the other picture in the copy, left out of the score
      const c = T.cut, q = [[c.x0, c.y0], [c.x1, c.y0], [c.x1, c.y1], [c.x0, c.y1]].map(([u, v]) => PP_ALIGN.mapPoint(T, B, u, v));
      ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo((ox + p.x) * k, (oy + p.y) * k) : ctx.moveTo((ox + p.x) * k, (oy + p.y) * k))); ctx.closePath();
      ctx.fillStyle = 'rgba(100,116,139,0.55)'; ctx.fill(); ctx.strokeStyle = '#475569'; ctx.stroke();
      if (opts.labels !== false) { const tl = q.reduce((a, b) => (a.x + a.y < b.x + b.y ? a : b)); label(ctx, 'ADDED PART, LEFT OUT', (ox + Math.max(0, tl.x)) * k + 6, (oy + Math.max(0, tl.y)) * k + 6, '#475569', k); }
    }
  }
  if (opts.labels !== false) {
    label(ctx, 'ORIGINAL', ox * k + 6, oy * k + 6, BLUE, k);
    const bl = PP_ALIGN.mapPoint(T, B, T.flip ? B.width : 0, B.height);   // the copy's bottom-left corner as shown
    if (m !== 'diff') label(ctx, m === 'tint' ? 'COPY' : 'COPY ' + Math.round(o * 100) + '%', (ox + bl.x) * k + 6, (oy + bl.y) * k - 6 - Math.max(18, 26 * k * 1.5), ORANGE, k);
  }
  ctx.restore();
}
// Red tint over the parts that were added or redrawn, and a green line round the part that
// is the same photo (see changes() in align.js).
function drawChanges(ctx, k, ox, oy) {
  const { gw, gh, cell, reg } = CH, u = cell * k, at = (i, j) => (i < 0 || j < 0 || i >= gw || j >= gh) ? 0 : reg[j * gw + i];
  ctx.save();
  ctx.beginPath();
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) if (at(i, j) === 2) ctx.rect((ox * k + i * u), (oy * k + j * u), u + 0.6, u + 0.6);
  ctx.fillStyle = 'rgba(252,66,74,0.30)'; ctx.fill();
  ctx.beginPath();
  for (let j = 0; j <= gh; j++) for (let i = 0; i <= gw; i++) for (const [di, dj] of [[1, 0], [0, 1]]) {
    if ((at(i, j) === 1) === (at(i - di, j - dj) === 1)) continue;
    const x = ox * k + i * u, y = oy * k + j * u;
    ctx.moveTo(x, y); if (di) ctx.lineTo(x, y + u); else ctx.lineTo(x + u, y);
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(3, 6 * k * 1.4); ctx.strokeStyle = '#ffffff'; ctx.stroke();
  ctx.lineWidth = Math.max(2, 3 * k * 1.4); ctx.strokeStyle = '#00B84F'; ctx.stroke();
  ctx.restore();
}
function drawSpots(ctx, k, ox, oy) {
  ctx.save();
  spots.forEach((sp, n) => {
    const b = sp.box, x = (ox + b.x) * k, y = (oy + b.y) * k;
    ctx.lineWidth = Math.max(3, 5 * k * 1.4); ctx.strokeStyle = '#ffffff'; ctx.strokeRect(x, y, b.w * k, b.h * k);
    ctx.lineWidth = Math.max(2, 3 * k * 1.4); ctx.strokeStyle = '#f59e0b'; ctx.strokeRect(x, y, b.w * k, b.h * k);
    label(ctx, String(n + 1), x, y - Math.max(18, 26 * k * 1.5) - 2, '#f59e0b', k);
  });
  if (spotNow) { const b = spotNow; ctx.setLineDash([6, 4]); ctx.lineWidth = 2; ctx.strokeStyle = '#f59e0b'; ctx.strokeRect((ox + b.x) * k, (oy + b.y) * k, b.w * k, b.h * k); }
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
  $('opVal').textContent = mode === 'diff' ? 'Difference view: black means the same' : mode === 'tint' ? 'Colour check: grey means the same, blue or orange edges mean off' : Math.round(opacity * 100) + '% copy, ' + (100 - Math.round(opacity * 100)) + '% original';
  $('scaleVal').textContent = 'Moved ' + Math.round(T.x) + ', ' + Math.round(T.y) + ' px' + (T.k ? ' · slanted ' + Math.abs(T.k * 100).toFixed(1) + '%' : '');
  syncShape();
}
// How the copy was changed, in plain words, for the PDF and the status line.
function describeShape() {
  const bits = ['resized to ' + (T.s * 100).toFixed(1) + '%'];
  if (T.w !== 1) bits.push('stretched to ' + (T.w * 100).toFixed(1) + '% width');
  if (T.h !== 1) bits.push('stretched to ' + (T.h * 100).toFixed(1) + '% height');
  if (T.r) bits.push('turned ' + Math.abs(T.r).toFixed(1) + '° ' + (T.r > 0 ? 'clockwise' : 'anticlockwise'));
  if (T.k) bits.push('slanted ' + Math.abs(T.k * 100).toFixed(1) + '%');
  if (T.flip) bits.push('mirrored left to right');
  return bits.join(', ');
}

// ---------- moving the copy by hand ----------
let dragFrom = null;
// Where a pointer event lands on the original, in the original's pixels.
function toOrig(e) {
  const r = view.getBoundingClientRect(), k = view.width / r.width;
  return { x: (e.clientX - r.left) * k / WS - PADX, y: (e.clientY - r.top) * k / WS - PADY };
}
view.addEventListener('pointerdown', e => {
  if (mode === 'side') return;
  if (spotMode) { view.setPointerCapture(e.pointerId); spotFrom = toOrig(e); return; }
  view.setPointerCapture(e.pointerId); view.classList.add('drag');
  dragFrom = { x: e.clientX, y: e.clientY, tx: T.x, ty: T.y };
});
view.addEventListener('pointermove', e => {
  if (spotFrom) {
    const q = toOrig(e);
    spotNow = { x: Math.min(spotFrom.x, q.x), y: Math.min(spotFrom.y, q.y), w: Math.abs(q.x - spotFrom.x), h: Math.abs(q.y - spotFrom.y) };
    draw(); return;
  }
  if (!dragFrom) return;
  const k = view.width / view.getBoundingClientRect().width / WS;   // screen pixels -> original's pixels
  T.x = dragFrom.tx + (e.clientX - dragFrom.x) * k;
  T.y = dragFrom.ty + (e.clientY - dragFrom.y) * k;
  draw();
});
function endSpot(e) {
  const A = P.A.bitmap, q = toOrig(e), from = spotFrom; spotFrom = null; spotNow = null;
  let box = { x: Math.min(from.x, q.x), y: Math.min(from.y, q.y), w: Math.abs(q.x - from.x), h: Math.abs(q.y - from.y) };
  const minSide = Math.max(A.width, A.height) * 0.02;
  if (box.w < minSide || box.h < minSide) {          // a click: a square about a tenth of the picture
    const s = Math.round(Math.max(A.width, A.height) * 0.1);
    box = { x: q.x - s / 2, y: q.y - s / 2, w: s, h: s };
  }
  box.x = Math.max(0, Math.min(A.width - 8, box.x)); box.y = Math.max(0, Math.min(A.height - 8, box.y));
  box.w = Math.min(box.w, A.width - box.x); box.h = Math.min(box.h, A.height - box.y);
  for (const key of ['x', 'y', 'w', 'h']) box[key] = Math.round(box[key]);
  setSpotMode(false);
  if (box.w < 8 || box.h < 8) { draw(); return setStatus('Pick a spot on the original (inside the blue edge).', true); }
  const sp = { box }; spots.push(sp); measureSpot(sp); renderSpots(); draw();
  setStatus('Spot ' + spots.length + ' added. It is cut from both pictures and compared on its own (see "Compare a spot" on the left). It goes in the PDF too.');
}
view.addEventListener('pointerup', e => { if (spotFrom) endSpot(e); });
const endDrag = () => { if (dragFrom) { dragFrom = null; view.classList.remove('drag'); rescore(); } };
view.addEventListener('pointerup', endDrag);
view.addEventListener('pointercancel', endDrag);
view.addEventListener('keydown', e => {
  const d = e.shiftKey ? 10 : 1;
  const mv = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key];
  if (!mv) return;
  e.preventDefault(); T.x += mv[0]; T.y += mv[1]; draw(); rescoreSoon();
});
const reshape = change => { T = PP_ALIGN.reshape(T, P.B.bitmap, change); draw(); rescoreSoon(); };
const resize = f => reshape({ s: T.s * f });

// ---------- size and shape sliders, for copies that were stretched, squashed or turned ----------
// Size works on a doubling scale, so one slider goes from 1/8 to 8 times.
const sizeToSlider = s => Math.round(Math.log2(s) * 1000), sliderToSize = v => Math.pow(2, v / 1000);
let syncing = false;
function syncShape() {
  syncing = true;
  $('shSize').value = sizeToSlider(T.s); $('shSizeV').textContent = (T.s * 100).toFixed(1) + '%';
  $('shW').value = Math.round(T.w * 1000); $('shWV').textContent = (T.w * 100).toFixed(1) + '%';
  $('shH').value = Math.round(T.h * 1000); $('shHV').textContent = (T.h * 100).toFixed(1) + '%';
  $('shR').value = Math.round(T.r * 10); $('shRV').textContent = (T.r > 0 ? '+' : '') + T.r.toFixed(1) + '°';
  $('shFlip').checked = !!T.flip;
  syncing = false;
}
$('shSize').oninput = () => { if (!syncing) reshape({ s: sliderToSize(+$('shSize').value) }); };
$('shW').oninput = () => { if (!syncing) reshape({ w: $('shW').value / 1000 }); };
$('shH').oninput = () => { if (!syncing) reshape({ h: $('shH').value / 1000 }); };
$('shR').oninput = () => { if (!syncing) reshape({ r: $('shR').value / 10 }); };
$('shFlip').onchange = () => reshape({ flip: $('shFlip').checked });
$('shReset').onclick = () => reshape({ w: 1, h: 1, r: 0, k: 0, flip: false });
$('smaller').onclick = () => resize(1 / 1.01);
$('bigger').onclick = () => resize(1.01);
$('showChg').onchange = () => { showChg = $('showChg').checked; draw(); };
$('opacity').oninput = () => { opacity = $('opacity').value / 100; if (mode === 'diff' || mode === 'tint') setMode('overlay'); draw(); };
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

// ---------- comparing one spot (a face, a logo) on its own ----------
function setSpotMode(on) {
  spotMode = on; $('spotBtn').classList.toggle('on', on); view.classList.toggle('spotting', on);
  $('spotBtn').textContent = on ? '✖ Cancel picking' : '🔍 Pick a spot';
  if (on) { if (mode === 'side') setMode('overlay'); setStatus('Click a face or detail on the picture, or drag a box round it.'); }
}
$('spotBtn').onclick = () => setSpotMode(!spotMode);
addEventListener('keydown', e => { if (e.key === 'Escape' && spotMode) { setSpotMode(false); spotFrom = null; spotNow = null; draw(); } });
// 90%+ unchanged, 75-90% the same with small changes (expression, small move), below 75% redrawn.
function spotWords(res) {
  if (!res || res.outside) return { cls: 'mid', pct: '–', word: 'The copy doesn\'t cover this spot' };
  if (res.flat) return { cls: 'mid', pct: '–', word: 'Too plain to judge' };
  const pct = Math.round(res.r * 100), px = Math.round(Math.hypot(res.dx, res.dy));
  const moved = px <= Math.max(3, Math.max(P.A.bitmap.width, P.A.bitmap.height) * 0.004) ? 'Not moved' : 'Moved about ' + px + ' px (' + (px / P.A.bitmap.width * 100).toFixed(1) + '% of the width)';
  return res.r >= 0.9 ? { cls: 'ok', pct: pct + '%', word: 'Unchanged', moved }
    : res.r >= 0.75 ? { cls: 'mid', pct: pct + '%', word: 'Same, small changes', moved }
    : { cls: 'bad', pct: pct + '%', word: 'Redrawn or different', moved };
}
function measureSpot(sp) { sp.res = P.A && P.B ? PP_ALIGN.spot(P.A.bitmap, P.B.bitmap, T, sp.box) : null; }
// A cut-out of one spot: from the original, or from the lined-up copy (where it moved to).
function spotCrop(sp, which, size) {
  const b = sp.box, k = size / Math.max(b.w, b.h);
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(b.w * k)); c.height = Math.max(1, Math.round(b.h * k));
  const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#e5e7eb'; ctx.fillRect(0, 0, c.width, c.height);
  if (which === 'A') ctx.drawImage(P.A.bitmap, -b.x * k, -b.y * k, P.A.bitmap.width * k, P.A.bitmap.height * k);
  else { const r = sp.res || {}; PP_ALIGN.drawCopy(ctx, P.B.bitmap, T, k, -(b.x + (r.dx || 0)), -(b.y + (r.dy || 0))); }
  return c;
}
function renderSpots() {
  const list = $('spotList'); list.innerHTML = '';
  spots.forEach((sp, n) => {
    const w = spotWords(sp.res), row = document.createElement('div'); row.className = 'spot';
    const no = document.createElement('span'); no.className = 'no'; no.textContent = n + 1;
    const ca = spotCrop(sp, 'A', 92), cb = spotCrop(sp, 'B', 92); ca.title = 'Original'; cb.title = 'Copy';
    const t = document.createElement('div'); t.innerHTML = '<b></b><span></span><br><small></small>';
    t.querySelector('b').textContent = w.pct; t.querySelector('b').className = w.cls;
    t.querySelector('span').textContent = w.word; t.querySelector('span').className = w.cls;
    t.querySelector('small').textContent = w.moved || '';
    const x = document.createElement('button'); x.className = 'x'; x.textContent = '✕'; x.title = 'Remove this spot';
    x.onclick = () => { spots.splice(n, 1); renderSpots(); draw(); };
    row.append(no, ca, cb, t, x); list.append(row);
  });
}

// ---------- nearby shots: which of several originals did the copy come from? ----------
// Photographers often take many shots of one scene a second apart. Each one is lined up with the
// copy; the one that lines up best is the source, but only if it is clearly ahead of the rest.
$('nearBtn').querySelector('input').onchange = async e => {
  const files = [...e.target.files]; e.target.value = '';
  if (!files.length) return;
  if (!P.B) return setStatus('Add the copy first, then check nearby shots.', true);
  $('nearBtn').classList.add('busy');
  nearby = [];
  for (let i = 0; i < files.length; i++) {
    setStatus('Checking shot ' + (i + 1) + ' of ' + files.length + ': ' + files[i].name + '...');
    let bm; try { bm = await createImageBitmap(files[i]); } catch (err) { nearby.push({ name: files[i].name, blob: files[i], bad: true }); continue; }
    const best = await PP_ALIGN.align(bm, P.B.bitmap);
    const C = best ? PP_ALIGN.changes(bm, P.B.bitmap, best) : null;
    nearby.push({ name: files[i].name, blob: files[i], lines: best ? best.sc.lines : 0, strength: best ? best.sc.strength : 0, same: C ? C.sameShare : 0, untouched: C ? C.untouchedLines : 0 });
    try { bm.close(); } catch (err) { /* freed */ }
  }
  nearby.sort((a, b) => (b.lines || 0) - (a.lines || 0));
  $('nearBtn').classList.remove('busy');
  const w = nearby[0];
  if (!w || !w.lines || w.lines < 0.15) { renderNearby(); return setStatus('None of these shots lines up with the copy.', true); }
  await setPicture('A', w.blob, w.name);
  renderNearby();
  setTimeout(() => { if (!$('auto').disabled) $('auto').click(); }, 200);
};
function nearbyVerdict() {
  const [a, b] = nearby;
  if (!a || !a.lines || a.lines < 0.15) return 'None of these shots lines up with the copy.';
  if (!b || b.bad || a.lines - (b.lines || 0) >= 0.05) return 'The copy most likely came from ' + a.name + '.';
  return 'Too close to call between ' + a.name + ' and ' + b.name + '. Compare a spot (a face) on each to decide.';
}
function renderNearby() {
  const box = $('nearby'); box.hidden = !nearby; if (!nearby) return;
  box.innerHTML = '<h3>Nearby shots</h3><div class="say"></div>';
  box.querySelector('.say').textContent = nearbyVerdict();
  nearby.forEach((r, n) => {
    const row = document.createElement('div'); row.className = 'nr' + (n === 0 && r.lines >= 0.15 ? ' win' : '');
    const nm = document.createElement('span'); nm.textContent = r.name; nm.title = r.name;
    const pc = document.createElement('b'); pc.textContent = r.bad ? 'not a picture' : Math.round(r.lines * 100) + '%';
    const use = document.createElement('button'); use.className = 'pickbtn';
    const cur = P.A && P.A.name === r.name;
    use.textContent = cur ? 'In use' : 'Use'; use.disabled = cur || r.bad;
    use.onclick = async () => { await setPicture('A', r.blob, r.name); setTimeout(() => { if (!$('auto').disabled) $('auto').click(); }, 200); };
    row.append(nm, pc, use); box.append(row);
  });
}

// ---------- lining up automatically ----------
// The work is done in align.js (PP_ALIGN): it finds matching details in both pictures,
// so it copes with crops, big size changes and headlines or logos printed over the copy.
$('auto').onclick = async () => {
  $('auto').disabled = true;
  $('auto').textContent = '⏳ Lining up...';
  setStatus('Looking for the same details in both pictures...');
  try {
    const t0 = performance.now();
    const best = await PP_ALIGN.align(P.A.bitmap, P.B.bitmap, t => setStatus(t));
    if (!best) throw new Error('no position fits');
    // Animate the copy sliding into place.
    const from = { ...T }, steps = 30;
    if (mode === 'side') setMode('overlay');
    for (let i = 1; i <= steps; i++) {
      const e = 1 - Math.pow(1 - i / steps, 3);
      const mix = key => from[key] + (best[key] - from[key]) * e;
      T = PP_ALIGN.place({ s: mix('s'), w: mix('w'), h: mix('h'), r: mix('r'), k: mix('k'), x: mix('x'), y: mix('y'), flip: best.flip });
      draw(); await sleep(16);
    }
    // best.cut: the copy is a collage; the other picture in it is left out of the score (align.js findCut)
    T = PP_ALIGN.place({ s: best.s, w: best.w, h: best.h, r: best.r, k: best.k, flip: best.flip, x: best.x, y: best.y, cut: best.cut || null }); draw();
    await rescore();
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    if (scoreInfo.logos || scoreInfo.place || scoreInfo.only) setStatus('Lined up in ' + secs + ' s, but this is a different photo: ' + (scoreInfo.logos ? 'only the logos and lettering match.' : scoreInfo.only === 'emblem' ? 'only a seal or emblem matches.' : scoreInfo.only === 'slice' ? 'only a small part of each picture matches.' : scoreInfo.only === 'pattern' ? 'only a repeating pattern (a fence, a floor) matches.' : 'the same place, taken from another spot or at another time.') + ' Fade between them with the slider to see it.', true);
    else if (scoreInfo.verdict[0] === 'bad') setStatus('Could not find this photo inside the copy (' + secs + ' s). If you are sure it is there, drag the copy into place and use + Bigger / − Smaller.', true);
    else setStatus('Lined up in ' + secs + ' s' + (best.how === 'details' ? ', using ' + best.inliers + ' matching details' : '') + '. The copy was ' + describeShape() + '.' + (T.cut ? ' Part of the copy is another picture or something added in a box (shown grey); that part is left out of the score.' : '') + ' Move the slider to fade between them, or try "Slide aside and back". You can still drag the copy to fine-tune it.');
  } catch (e) { setStatus('Could not line them up automatically (' + e.message + '). Drag the copy into place instead.', true); }
  $('auto').disabled = false;
  $('auto').textContent = '✨ Line them up automatically';
};

// The score only looks at the area where the two pictures overlap, split into small squares.
// Squares covered by a headline, logo or caption just don't count as matching; they don't
// pull the rest down.
async function rescore() {
  if (!P.A || !P.B) return;
  const S = PP_ALIGN.score(P.A.bitmap, P.B.bitmap, T);
  const pct = Math.round(S.lines * 100), strength = Math.round(S.strength * 100);
  const enough = S.matched >= 25;
  const off = (S.overlap < 0.1 && S.overlapA < 0.05) || S.textured + S.flat < 6;
  // Which parts are the same photo and which were added or redrawn (green / red on the picture).
  // Different photos get (almost) no green, so this never turns a non-match into a match.
  CH = off ? null : PP_ALIGN.changes(P.A.bitmap, P.B.bitmap, T);
  const same = CH ? Math.round(CH.sameShare * 100) : 0, unt = CH ? Math.round(CH.untouchedLines * 100) : 0;
  // Heavily edited: a solid part is clearly the same photo (strong, many matching squares), and a
  // big part was painted over or redrawn (an added object, redrawn faces, a headline band).
  // Press walls repeat the same logos: a different shot in front of the same wall lines up on
  // those logos and nothing else. Then it is not the same photo, whatever the % says.
  // Another photo of the same place: only printed logos / signs line up, only a seal or crest,
  // only a small slice of each, only a pattern (fence, tiled floor), or things at different
  // distances shift against each other (a building from a few steps away). See shot() in align.js.
  const SH = off || S.lines < 0.15 ? null : PP_ALIGN.shot(P.A.bitmap, P.B.bitmap, T);
  const wall = !!(SH && SH.backdrop);
  const logos = !wall && !!(SH && SH.logos), place = !wall && !logos && !!(SH && SH.place);
  const only = wall || logos || place || !SH ? null : SH.emblem ? 'emblem' : SH.slice ? 'slice' : SH.pattern ? 'pattern' : null;
  const photoPct = SH && SH.photo !== null ? Math.round(SH.photo * 100) : pct;
  if (wall || logos || place || only) CH = null;
  const heavy = !wall && !logos && !place && !only && CH && enough && S.strength >= 0.75 && CH.sameShare >= 0.2 && CH.untouchedLines >= 0.6 && CH.changedShare >= 0.25;
  const verdict = off ? ['bad', 'The copy is mostly off the original', 'Line them up first.']
    : wall ? ['bad', 'Different photo, same backdrop', 'Only the logos printed over and over on the wall behind lines up. The people and everything else are different. A different shot in front of the same press wall lines up there, so this is not the same photo.']
    : logos ? ['bad', 'Different photo, only the logos match', 'What lines up is printed logos, signs or lettering. The people, the building and everything around them are different. A logo looks the same in every photo taken of it, so this is not the same photo.']
    : only === 'emblem' ? ['bad', 'Different photo, only a seal or emblem matches', 'What lines up is one small spot, like a seal on a podium or a crest on the wall. The people and everything around it are different. A seal looks the same in every photo taken of it, so this is not the same photo.']
    : only === 'slice' ? ['bad', 'Different photo, only a small part matches', 'Only a small part of each picture lines up (often a seal, a sign or a backdrop). A real copy shares most of one of the two pictures, so this is not the same photo.']
    : only === 'pattern' ? ['bad', 'Different photo, only a pattern matches', 'What lines up is a repeating pattern, like a chain-link fence, a checkered floor or tiles. The people and everything else are different, so this is not the same photo.']
    : place ? ['bad', 'Different photo of the same place', 'The scene lines up roughly, but things at different distances (columns and the wall behind them, a pole, people) shift against each other and the fine detail does not match. It was taken from another spot or at another time, so it is not the same photo.']
    : pct >= 85 && S.strength >= 0.8 ? ['good', 'Very likely the same photo', 'They match detail for detail wherever they overlap.']
    : heavy ? ['good', 'Same photo, heavily edited (things added or redrawn)', 'Inside the green part the copy lines up with the original detail for detail. The red parts were painted over, added or redrawn (for example a new object, changed faces or a headline).']
    : pct >= 25 && enough && S.strength >= 0.75 ? ['good', 'Very likely the same photo, with things added on top', pct + '% of the area they share lines up detail for detail. The rest differs, usually a headline, logo, caption or crop added to the copy. The red parts on the picture show where.']
    : pct >= 15 ? ['mid', 'Partly lines up', 'Check the overlay by eye. They may not be lined up exactly yet, or only part of the photo was used.']
    : ['bad', 'Probably not lined up, or not the same photo', 'Try "Line them up automatically", or drag the copy into place.'];
  if (verdict[0] === 'bad') CH = null;
  scoreInfo = { pct: logos || place || only ? photoPct : pct, strength, verdict, overlap: S.overlap, overlapA: S.overlapA, heavy: !!heavy, wall, logos, place, only, same, unt, changed: CH ? 100 - same : 0 };
  const box = $('score');
  box.hidden = false; box.className = 'card ' + verdict[0];
  box.innerHTML = '';
  const b1 = document.createElement('b'); b1.textContent = verdict[1];
  const p = document.createElement('div'); p.className = 'pct';
  box.append(b1, p);
  if (heavy) {
    // The headline number only judges the part that wasn't painted over; the overall one stays below.
    p.textContent = unt + '% lines up';
    const u = document.createElement('div'); u.className = 'under'; u.textContent = 'in the part that wasn\'t painted over'; box.append(u);
  } else if (logos || place || only) {
    p.textContent = photoPct + '% lines up';
    const u = document.createElement('div'); u.className = 'under';
    u.textContent = logos ? 'leaving out the logos and lettering' : place ? 'leaving out the parts that shift' : only === 'emblem' ? 'leaving out the seal or emblem' : only === 'pattern' ? 'leaving out the pattern' : 'of each whole picture';
    box.append(u);
  } else { p.textContent = wall ? 'Only the backdrop lines up' : pct + '% lines up'; if (wall) p.style.fontSize = '19px'; }
  if (CH && verdict[0] === 'good') {
    const bar = document.createElement('div'); bar.className = 'split';
    const g = document.createElement('i'); g.style.width = same + '%'; bar.append(g);
    const key = document.createElement('div'); key.className = 'splitKey';
    key.innerHTML = '<span></span><span class="r"></span>';
    key.children[0].textContent = same + '% same photo'; key.children[1].textContent = (100 - same) + '% added or redrawn';
    box.append(bar, key);
  }
  const sm = document.createElement('small');
  sm.textContent = verdict[2] + (wall ? ' (' + pct + '% of the shared area lines up, all of it repeating logos.)' : '') + (logos || place || only ? ' (Counting everything, ' + pct + '% of the shared area lines up roughly.)' : '') + (heavy ? ' Over everything they share: ' + pct + '%.' : '') + ' The copy covers ' + Math.round(Math.min(1, S.overlapA) * 100) + '% of the original. The score is a guide; the overlay is what to show.';
  box.append(sm);
  for (const sp of spots) measureSpot(sp);
  if (spots.length) renderSpots();
  draw();
}
let rescoreTimer = 0;
const rescoreSoon = () => { clearTimeout(rescoreTimer); rescoreTimer = setTimeout(rescore, 400); };

// ---------- saving ----------
// One frame, cropped to the original plus wherever the copy sits.
function frame(o, m, maxSide = 1600, labels = true, extra = {}) {
  const A = P.A.bitmap, B = P.B.bitmap;
  const bb = PP_ALIGN.bounds(T, B);
  const L = Math.min(0, bb.x0), Tp = Math.min(0, bb.y0);
  const R = Math.max(A.width, bb.x1), Bt = Math.max(A.height, bb.y1);
  const m2 = Math.round(Math.max(A.width, A.height) * 0.02);
  const w = R - L + m2 * 2, h = Bt - Tp + m2 * 2;
  const k = Math.min(1, maxSide / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
  paint(c.getContext('2d'), c.width, c.height, k, o, m, { ox: m2 - L, oy: m2 - Tp, labels, ...extra });
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
    const PLAIN = { changes: false, spots: false };
    // Changed areas (green = same photo, red = added or redrawn) and the spots compared one by one.
    const chgItems = !CH ? [] : [
      { h: 'Which parts are the same photo' },
      { p: 'The copy is shown on top of the original. Inside the green line it is the same photo and lines up detail for detail. The red parts were added, painted over or redrawn in the copy (for example a new object, changed faces or a headline).', color: '#475569' },
      { image: frame(1, 'overlay', 1400, true, { changes: true, spots: false }), maxH: 700, caption: 'Green line = same photo (' + scoreInfo.same + '% of the shared area). Red = added or redrawn (' + scoreInfo.changed + '%)' }
    ];
    const pair = sp => {
      const ca = spotCrop(sp, 'A', 420), cb = spotCrop(sp, 'B', 420), gap = 30;
      const c = document.createElement('canvas'); c.width = ca.width + cb.width + gap; c.height = Math.max(ca.height, cb.height) + 44;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(ca, 0, 44); x.drawImage(cb, ca.width + gap, 44);
      x.lineWidth = 4; x.strokeStyle = BLUE; x.strokeRect(2, 46, ca.width - 4, ca.height - 4);
      x.setLineDash([12, 7]); x.strokeStyle = ORANGE; x.strokeRect(ca.width + gap + 2, 46, cb.width - 4, cb.height - 4);
      x.font = 'bold 26px system-ui, sans-serif'; x.fillStyle = BLUE; x.fillText('ORIGINAL', 0, 30); x.fillStyle = '#b45309'; x.fillText('COPY', ca.width + gap, 30);
      return c;
    };
    const spotItems = !spots.length ? [] : [
      { h: 'Spots compared one by one' },
      { p: 'Each numbered spot (a face, logo or detail) is cut from both pictures and compared on its own. The copy\'s cut-out is taken from where that spot sits in the copy, which may have moved a little. 90% and up = unchanged; 75 to 90% = the same with small changes (an expression, a small move); below 75% = redrawn or different.', color: '#475569' },
      { image: frame(1, 'overlay', 1400, true, { changes: false, spots: true }), maxH: 560, caption: 'Where the numbered spots are' },
      ...spots.flatMap((sp, n) => { const w = spotWords(sp.res); return [{ image: pair(sp), maxH: 380, caption: 'Spot ' + (n + 1) + ': ' + w.pct + ' match, ' + w.word.toLowerCase() + (w.moved ? '. ' + w.moved : '') }]; })
    ];
    const nearItems = !nearby ? [] : [
      { h: 'Nearby shots checked' },
      { p: nearbyVerdict(), box: '#f0fdf4', color: '#14532d' },
      { kv: nearby.map(r => [r.name, r.bad ? 'could not be opened as a picture' : Math.round(r.lines * 100) + '% of the shared area lines up' + (r.same ? ' (' + Math.round(r.same * 100) + '% same photo)' : ''), P.A && r.name === P.A.name]) }
    ];
    const items = [
      { p: 'In short: ' + scoreInfo.verdict[1] + ' (' + (scoreInfo.heavy ? scoreInfo.unt + '% lines up in the part that wasn\'t painted over; ' + scoreInfo.pct + '% over everything they share' : scoreInfo.logos ? scoreInfo.pct + '% of the photo lines up, leaving out the logos and lettering' : scoreInfo.place ? scoreInfo.pct + '% of the photo lines up, leaving out the parts that shift' : scoreInfo.only ? scoreInfo.pct + '% of the photo lines up, leaving out the ' + (scoreInfo.only === 'emblem' ? 'seal or emblem' : scoreInfo.only === 'pattern' ? 'pattern' : 'parts outside the small shared slice') : scoreInfo.pct + '% of the shared area lines up') + '). ' + scoreInfo.verdict[2], box: '#eff6ff', color: '#1e3a8a' },
      { h: 'The two pictures' }, { image: sideBySide(1400), maxH: 520 },
      { kv: [
        ['Original', A.name + '  (' + A.bitmap.width + ' x ' + A.bitmap.height + ')'], ['Original from', A.src], ['Original SHA-256', A.sha],
        ['Copy', B.name + '  (' + B.bitmap.width + ' x ' + B.bitmap.height + ')'], ['Copy from', B.src], ['Copy SHA-256', B.sha],
        ['How the copy was placed', describeShape().replace(/^./, c => c.toUpperCase()) + ', and moved ' + Math.round(T.x) + ', ' + Math.round(T.y) + ' pixels (in the original\'s pixels), so it sits on top of the original'],
        ['Lines up', scoreInfo.pct + '% of the area the two pictures share (split into small squares, each compared on its own; parts covered by headlines or logos count as not lining up)'],
        ...(CH ? [['Same photo', scoreInfo.same + '% of the shared area (green on the picture: most small squares around each spot line up)'],
          ['Added or redrawn', scoreInfo.changed + '% of the shared area (red on the picture)'],
          ['Lines up in the same-photo part', scoreInfo.unt + '% of the small squares inside the green part']] : []),
        ['Match where it lines up', scoreInfo.strength + '% (average correlation of brightness in the squares that line up; 100% = identical)'],
        ['Copy covers', Math.round(Math.min(1, scoreInfo.overlapA) * 100) + '% of the original'],
        ['Made', now.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'long' }) + ' with PageProof ' + api.runtime.getManifest().version]
      ] },
      ...chgItems, ...spotItems, ...nearItems,
      { h: 'Overlay: the copy laid on top of the original' },
      { p: 'Like superimposing in Photoshop: the copy (orange dashed edge) sits on the original and is made more see-through in steps. If it is the same photo, every detail lines up at every step.', color: '#475569' },
      { image: frame(0, 'overlay', 1400, true, PLAIN), maxH: 600, caption: 'Copy at 0%: the original only' },
      { image: frame(0.5, 'overlay', 1400, true, PLAIN), maxH: 600, caption: 'Copy at 50%: both at once. Same photo = no doubled edges' },
      { image: frame(1, 'overlay', 1400, true, PLAIN), maxH: 600, caption: 'Copy at 100%: the copy only, in the same place' },
      { h: 'Difference view' },
      { p: 'The copy is subtracted from the original. Where the two pictures are the same the result is black; anything different shows up bright.', color: '#475569' },
      { image: frame(1, 'diff', 1400, true, PLAIN), maxH: 700, caption: 'Black = identical. Bright = different (edits, added logos, cropping edges)' },
      { h: 'Colour check' },
      { p: 'The original is shown in blue tones and the copy in orange tones, added together. Where the two pictures line up they cancel out to plain grey; anything that is off or different shows up blue or orange.', color: '#475569' },
      { image: frame(1, 'tint', 1400, true, PLAIN), maxH: 700, caption: 'Grey = the same. Blue = only in the original. Orange = only in the copy' },
      { p: 'The score is a guide worked out by PageProof. The overlay pictures are what to show.', color: '#64748b' }
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
    const A = P.A.bitmap, B = P.B.bitmap, slide = A.width * 0.25;
    // The frame is big enough to hold the copy when it slides aside.
    const bb = PP_ALIGN.bounds(T, B);
    const L = Math.min(0, bb.x0), Tp = Math.min(0, bb.y0), m2 = Math.round(Math.max(A.width, A.height) * 0.02);
    const Rt = Math.max(A.width, bb.x1 + slide), Bt = Math.max(A.height, bb.y1);
    const w = Rt - L + m2 * 2, h = Bt - Tp + m2 * 2, k = Math.min(1, 1280 / Math.max(w, h));
    const c = document.createElement('canvas'); c.width = Math.round(w * k / 2) * 2; c.height = Math.round(h * k / 2) * 2;
    const ctx = c.getContext('2d');
    const at = { ox: m2 - L, oy: m2 - Tp };
    const show = (o, m) => paint(ctx, c.width, c.height, k, o, m, { ...at, changes: false, spots: false });
    show(0, 'overlay');
    const stream = c.captureStream(30);
    // MP4 plays everywhere (Windows, Mac, phones, PowerPoint). Older browsers can only make WebM.
    const type = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t)) || '';
    const rec = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 6e6 } : {});
    const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    const done = new Promise(r => { rec.onstop = r; });
    rec.start(200);
    // Redraw on every tick, even while holding still: a canvas that doesn't change records no
    // frames, which made the pauses (and the difference view at the end) vanish from the video.
    const tween = async (ms, fn) => { const t0 = performance.now(); for (;;) { const t = Math.min(1, (performance.now() - t0) / ms); fn(t); if (t >= 1) break; await sleep(33); } };
    const keepX = T.x;
    await tween(800, () => show(0, 'overlay'));
    await tween(1800, t => show(t, 'overlay'));
    await tween(500, () => show(1, 'overlay'));
    await tween(900, t => { T.x = keepX + slide * Math.sin(t * Math.PI / 2); show(0.6, 'overlay'); });
    await tween(400, () => show(0.6, 'overlay'));
    await tween(900, t => { T.x = keepX + slide * Math.cos(t * Math.PI / 2); show(0.6, 'overlay'); });
    T.x = keepX;
    await tween(1500, t => show(0.6 - 0.6 * t, 'overlay'));
    await tween(2000, () => show(1, 'diff'));
    rec.stop(); await done;
    const ext = (rec.mimeType || type).includes('mp4') ? 'mp4' : 'webm';
    download(new Blob(chunks, { type: rec.mimeType || type || 'video/webm' }), baseName() + '.' + ext);
    setStatus('Video saved to your Downloads (.' + ext + (ext === 'mp4' ? ', plays on Windows, Mac, phones and in PowerPoint' : ', plays in any web browser and VLC; update your browser to get MP4') + ').');
  } catch (e) { setStatus('Could not record the video: ' + e.message, true); }
  busyAnim = false; $('sVid').disabled = false; draw();
};

// ---------- start: the Image Inspector can hand over its picture as the copy ----------
(async () => {
  const params = new URLSearchParams(location.search);
  if (params.get('from') === 'revsearch') {
    // From the reverse image search results: your picture in box 1, the one found online in box 2.
    try {
      const rec = await PP_DB.get('compare-rs');
      if (rec && rec.a && rec.b) {
        await setPicture('A', rec.a.blob, rec.a.name);
        await setPicture('B', rec.b.blob, rec.b.name, rec.b.src);
        setStatus('Your picture is the original and the one found online is the copy. Lining them up...');
        setTimeout(() => { if (!$('auto').disabled) $('auto').click(); }, 300);
      }
    } catch (e) { /* start empty */ }
  }
  if (params.get('from') === 'inspector') {
    try {
      const rec = await PP_DB.get('compare');
      if (rec && rec.blob) await setPicture('B', rec.blob, rec.name, rec.src);
      setStatus('The picture from Inspect is the copy. Now add your client\'s original.');
    } catch (e) { /* start empty */ }
  }
})();
