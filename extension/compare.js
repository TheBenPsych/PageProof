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
  T = PP_ALIGN.place({ s: A.width / B.width });
  $('empty').hidden = true; view.hidden = false; $('hint').hidden = false;
  for (const id of ['auto', 'opacity', 'aside', 'fade', 'smaller', 'bigger', 'sPdf', 'sPng', 'sVid', 'shSize', 'shW', 'shH', 'shR', 'shFlip', 'shReset']) $(id).disabled = false;
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
  if (opts.edges !== false) {
    // The original gets a solid blue edge, the copy a dashed orange one, matching their labels.
    ctx.lineWidth = Math.max(2, 3 * k * 1.5);
    ctx.strokeStyle = BLUE; ctx.strokeRect(ox * k, oy * k, A.width * k, A.height * k);
    ctx.setLineDash([10 * Math.max(1, k * 2), 6 * Math.max(1, k * 2)]);
    ctx.strokeStyle = ORANGE; PP_ALIGN.drawCopy(ctx, B, T, k, ox, oy, true);
    ctx.setLineDash([]);
  }
  if (opts.labels !== false) {
    label(ctx, 'ORIGINAL', ox * k + 6, oy * k + 6, BLUE, k);
    const bl = PP_ALIGN.mapPoint(T, B, T.flip ? B.width : 0, B.height);   // the copy's bottom-left corner as shown
    if (m !== 'diff') label(ctx, m === 'tint' ? 'COPY' : 'COPY ' + Math.round(o * 100) + '%', (ox + bl.x) * k + 6, (oy + bl.y) * k - 6 - Math.max(18, 26 * k * 1.5), ORANGE, k);
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
    T = PP_ALIGN.place({ s: best.s, w: best.w, h: best.h, r: best.r, k: best.k, flip: best.flip, x: best.x, y: best.y }); draw();
    await rescore();
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    if (scoreInfo.verdict[0] === 'bad') setStatus('Could not find this photo inside the copy (' + secs + ' s). If you are sure it is there, drag the copy into place and use + Bigger / − Smaller.', true);
    else setStatus('Lined up in ' + secs + ' s' + (best.how === 'details' ? ', using ' + best.inliers + ' matching details' : '') + '. The copy was ' + describeShape() + '. Move the slider to fade between them, or try "Slide aside and back". You can still drag the copy to fine-tune it.');
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
  const verdict = (S.overlap < 0.1 && S.overlapA < 0.05) || S.textured + S.flat < 6 ? ['bad', 'The copy is mostly off the original', 'Line them up first.']
    : pct >= 85 && S.strength >= 0.8 ? ['good', 'Very likely the same photo', 'They match detail for detail wherever they overlap.']
    : pct >= 25 && enough && S.strength >= 0.75 ? ['good', 'Very likely the same photo, with things added on top', pct + '% of the area they share lines up detail for detail. The rest differs, usually a headline, logo, caption or crop added to the copy. The Difference view shows those parts in bright.']
    : pct >= 15 ? ['mid', 'Partly lines up', 'Check the overlay by eye. They may not be lined up exactly yet, or only part of the photo was used.']
    : ['bad', 'Probably not lined up, or not the same photo', 'Try "Line them up automatically", or drag the copy into place.'];
  scoreInfo = { pct, strength, verdict, overlap: S.overlap, overlapA: S.overlapA };
  const box = $('score');
  box.hidden = false; box.className = 'card ' + verdict[0];
  box.innerHTML = '';
  const b1 = document.createElement('b'); b1.textContent = verdict[1];
  const p = document.createElement('div'); p.className = 'pct'; p.textContent = pct + '% lines up';
  const sm = document.createElement('small'); sm.textContent = verdict[2] + ' The copy covers ' + Math.round(Math.min(1, S.overlapA) * 100) + '% of the original. The score is a guide; the overlay is what to show.';
  box.append(b1, p, sm);
}
let rescoreTimer = 0;
const rescoreSoon = () => { clearTimeout(rescoreTimer); rescoreTimer = setTimeout(rescore, 400); };

// ---------- saving ----------
// One frame, cropped to the original plus wherever the copy sits.
function frame(o, m, maxSide = 1600, labels = true) {
  const A = P.A.bitmap, B = P.B.bitmap;
  const bb = PP_ALIGN.bounds(T, B);
  const L = Math.min(0, bb.x0), Tp = Math.min(0, bb.y0);
  const R = Math.max(A.width, bb.x1), Bt = Math.max(A.height, bb.y1);
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
      { p: 'In short: ' + scoreInfo.verdict[1] + ' (' + scoreInfo.pct + '% of the shared area lines up). ' + scoreInfo.verdict[2], box: '#eff6ff', color: '#1e3a8a' },
      { h: 'The two pictures' }, { image: sideBySide(1400), maxH: 520 },
      { kv: [
        ['Original', A.name + '  (' + A.bitmap.width + ' x ' + A.bitmap.height + ')'], ['Original from', A.src], ['Original SHA-256', A.sha],
        ['Copy', B.name + '  (' + B.bitmap.width + ' x ' + B.bitmap.height + ')'], ['Copy from', B.src], ['Copy SHA-256', B.sha],
        ['How the copy was placed', describeShape().replace(/^./, c => c.toUpperCase()) + ', and moved ' + Math.round(T.x) + ', ' + Math.round(T.y) + ' pixels (in the original\'s pixels), so it sits on top of the original'],
        ['Lines up', scoreInfo.pct + '% of the area the two pictures share (split into small squares, each compared on its own; parts covered by headlines or logos count as not lining up)'],
        ['Match where it lines up', scoreInfo.strength + '% (average correlation of brightness in the squares that line up; 100% = identical)'],
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
      { h: 'Colour check' },
      { p: 'The original is shown in blue tones and the copy in orange tones, added together. Where the two pictures line up they cancel out to plain grey; anything that is off or different shows up blue or orange.', color: '#475569' },
      { image: frame(1, 'tint', 1400), maxH: 700, caption: 'Grey = the same. Blue = only in the original. Orange = only in the copy' },
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
    const show = (o, m) => paint(ctx, c.width, c.height, k, o, m, at);
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
  if (params.get('from') === 'inspector') {
    try {
      const rec = await PP_DB.get('compare');
      if (rec && rec.blob) await setPicture('B', rec.blob, rec.name, rec.src);
      setStatus('The picture from the Inspector is in box 2 (the copy). Now add your client\'s original in box 1.');
    } catch (e) { /* start empty */ }
  }
})();
