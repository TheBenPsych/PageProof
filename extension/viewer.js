// PageProof viewer: stitches the screenshots together and offers downloads.
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);

function setStatus(text, isError) {
  $('status').textContent = text;
  $('status').className = isError ? 'error' : '';
}

function stamp(d) {
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '_' + p(d.getHours()) + '-' + p(d.getMinutes()) + '-' + p(d.getSeconds());
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

const api = globalThis.browser || globalThis.chrome;

function formatTime(rec) {
  const opts = { dateStyle: 'medium', timeStyle: 'long' };
  try { return new Date(rec.time).toLocaleString(undefined, { ...opts, timeZone: rec.timeZone }); }
  catch (e) { return new Date(rec.time).toLocaleString(); }
}

function zoneLabel(rec) {
  let offset = '';
  try {
    offset = new Intl.DateTimeFormat('en-US', { timeZone: rec.timeZone, timeZoneName: 'longOffset' })
      .formatToParts(new Date(rec.time)).find(p => p.type === 'timeZoneName').value.replace('GMT', 'UTC');
  } catch (e) { /* older browser */ }
  if (offset === 'UTC') offset = 'UTC+00:00';
  return (rec.timeZone || 'unknown') + (offset ? ' (' + offset + ')' : '');
}

async function sha256(bytes) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...d].map(b => b.toString(16).padStart(2, '0')).join('');
}

const bytesOf = async blob => new Uint8Array(await blob.arrayBuffer());

function imageName(img, i) {
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg',
    'image/avif': 'avif', 'image/bmp': 'bmp', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico' }[img.type];
  let name = '';
  try { name = decodeURIComponent(new URL(img.url).pathname.split('/').pop() || ''); } catch (e) { /* ignore */ }
  name = name.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[^\w.-]+/g, '_').slice(0, 60) || 'image';
  return 'images/' + String(i + 1).padStart(3, '0') + '_' + name + '.' + (ext || 'bin');
}

const toBlob = (canvas, type, q) => new Promise(r => canvas.toBlob(r, type, q));

async function loadBitmap(src) {
  const blob = await (await fetch(src)).blob();
  return createImageBitmap(blob);
}

function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  while (text.length > 4 && ctx.measureText(text + '...').width > maxW) text = text.slice(0, -1);
  return text + '...';
}

// Build the list of pieces that make up the final tall image.
function layout(rec, s) {
  const W = Math.round(rec.main.width * s);
  const blocks = [];
  let y = 0;
  const host = new URL(rec.url).hostname || rec.url;
  const u = Math.max(1, s); // size unit for text

  // Banner with the web address, time and capture details, at the very top.
  const bannerH = Math.round(108 * u);
  blocks.push({ y, h: bannerH, draw(ctx) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, bannerH);
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(0, bannerH - 4 * u, W, 4 * u);
    const pad = 18 * u;
    ctx.textBaseline = 'alphabetic';
    ctx.font = (13 * u) + 'px system-ui, sans-serif';
    const right = [
      'Captured ' + formatTime(rec),
      'Time zone: ' + zoneLabel(rec),
      'Window ' + rec.viewWidth + ' x ' + rec.viewHeight + '  \u00b7  PageProof ' + rec.version
    ];
    const rightW = Math.max(...right.map(t => ctx.measureText(t).width));
    ctx.fillStyle = '#94a3b8';
    right.forEach((t, i) => ctx.fillText(t, W - pad - rightW, (30 + i * 22) * u));
    const leftW = W - rightW - pad * 3;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold ' + (26 * u) + 'px system-ui, sans-serif';
    ctx.fillText(fitText(ctx, host, leftW), pad, 38 * u);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = (14 * u) + 'px system-ui, sans-serif';
    ctx.fillText(fitText(ctx, rec.url, leftW), pad, 64 * u);
    ctx.fillStyle = '#94a3b8';
    ctx.font = (13 * u) + 'px system-ui, sans-serif';
    ctx.fillText(fitText(ctx, 'Page title: ' + (rec.title || '(none)'), leftW), pad, 88 * u);
  } });
  y += bannerH;

  const tileBlock = (part, x0, f) => ({ y, h: Math.round(part.height * s * f), draw(ctx) {
    if (part.background) { ctx.fillStyle = part.background; ctx.fillRect(0, 0, W, this.h); }
    for (const t of part.tiles) {
      const c = t.crop;
      ctx.drawImage(t.bmp, Math.round(c.x * s), Math.round(c.y * s), Math.round(c.w * s), Math.round(c.h * s),
        x0 + Math.round((t.destX || 0) * s * f), Math.round(t.destY * s * f), Math.round(c.w * s * f), Math.round(c.h * s * f));
    }
  } });

  const main = tileBlock(rec.main, 0, 1);
  blocks.push(main);
  y += main.h;

  // Each scrollable section, under the main capture.
  for (const sec of rec.sections) {
    const headH = Math.round(56 * u);
    const pad = Math.round(16 * u);
    const label = 'Section ' + sec.n + ': ' + sec.label;
    blocks.push({ y, h: headH, draw(ctx) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, W, headH);
      ctx.fillStyle = '#e11d48';
      ctx.fillRect(0, 0, W, 3 * u);
      ctx.fillRect(0, 0, 8 * u, headH);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold ' + (17 * u) + 'px system-ui, sans-serif';
      ctx.fillText(fitText(ctx, label, W - pad * 3), pad + 8 * u, 26 * u);
      ctx.fillStyle = '#475569';
      ctx.font = (13 * u) + 'px system-ui, sans-serif';
      ctx.fillText('Full contents of the scroll box marked "Section ' + sec.n + '" in the capture above.', pad + 8 * u, 46 * u);
    } });
    y += headH;
    const f = Math.min(1, (W - pad * 2) / (sec.width * s));
    const body = tileBlock(sec, pad, f);
    const bodyH = body.h + pad * 2;
    blocks.push({ y, h: bodyH, draw(ctx) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, W, bodyH);
      ctx.translate(0, pad);
      ctx.beginPath();
      ctx.rect(pad, 0, W - pad * 2, body.h);
      ctx.clip();
      body.draw(ctx);
    } });
    y += bodyH;
  }
  return { W, H: y, blocks };
}

// Draw one horizontal strip (from y0, h tall) of the final image.
function renderSlice(plan, y0, h) {
  const canvas = document.createElement('canvas');
  canvas.width = plan.W;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, plan.W, h);
  for (const b of plan.blocks) {
    if (b.y + b.h <= y0 || b.y >= y0 + h) continue;
    ctx.save();
    ctx.translate(0, b.y - y0);
    ctx.beginPath();
    ctx.rect(0, 0, plan.W, b.h);
    ctx.clip();
    b.draw(ctx);
    ctx.restore();
  }
  return canvas;
}

async function start() {
  if (params.get('error')) {
    $('sub').textContent = 'The capture did not work';
    setStatus('Sorry, this page could not be captured: ' + params.get('error') +
      '. Browser pages (like settings, new tab, or the add-on store) cannot be captured. Try a normal website.', true);
    return;
  }

  const rec = await PP_DB.get(params.get('id'));
  if (!rec) { setStatus('This capture was not found. It may have been cleared. Please capture the page again.', true); return; }

  const host = new URL(rec.url).hostname || 'page';
  const base = 'PageProof_' + host + '_' + stamp(new Date(rec.time));
  document.title = 'PageProof: ' + host;
  $('domain').textContent = host;
  $('sub').textContent = rec.url + '  ·  ' + new Date(rec.time).toLocaleString();

  setStatus('Stitching the screenshots together...');
  for (const part of [rec.main, ...rec.sections]) {
    for (const t of part.tiles) t.bmp = await loadBitmap(t.src);
  }
  const s = rec.main.tiles[0].bmp.width / rec.innerWidth; // screen sharpness (device pixel ratio)
  const plan = layout(rec, s);

  // Browsers limit how tall one picture can be, so very long pages become several PNG parts.
  const maxH = Math.min(30000, Math.floor(200e6 / plan.W));
  const pngs = [];
  for (let y0 = 0; y0 < plan.H; y0 += maxH) {
    const blob = await toBlob(renderSlice(plan, y0, Math.min(maxH, plan.H - y0)), 'image/png');
    pngs.push(blob);
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    img.width = Math.round(plan.W / s);
    $('preview').appendChild(img);
  }

  const notes = [...rec.notes];
  if (rec.sections.length) notes.push(rec.sections.length + ' scroll box' + (rec.sections.length > 1 ? 'es were' : ' was') + ' found and added as numbered sections at the bottom.');
  if (pngs.length > 1) notes.push('This page is very tall, so the PNG download comes in ' + pngs.length + ' parts.');
  setStatus(notes.join(' '));

  $('png').disabled = false;
  $('png').onclick = () => pngs.forEach((b, i) => download(b, base + (pngs.length > 1 ? '_part' + (i + 1) : '') + '.png'));

  // Make the PDF right away so every file is ready for the evidence pack.
  const pageH = Math.round(plan.W * 1.4142); // A4 shape
  const pages = [];
  for (let y0 = 0; y0 < plan.H; y0 += pageH) {
    const h = Math.min(pageH, plan.H - y0);
    const jpg = await toBlob(renderSlice(plan, y0, h), 'image/jpeg', 0.92);
    pages.push({ jpeg: await bytesOf(jpg), width: plan.W, height: h });
  }
  const pdf = makePdf(pages, { title: 'PageProof capture of ' + host, subject: rec.url + ' captured ' + rec.time });
  $('pdf').disabled = false;
  $('pdf').onclick = () => download(pdf, base + '.pdf');

  // HTML backup with every picture stored inside it.
  let saved = null;
  const buildHtml = async () => {
    $('html').textContent = 'Saving images...';
    saved = await PP_ARCHIVE(rec, n => { $('html').textContent = 'Saving images (' + n + ')...'; });
    $('html').textContent = 'Download HTML backup';
    $('html').disabled = false;
  };
  $('html').onclick = () => saved && download(new Blob([saved.html], { type: 'text/html' }), base + '.html');

  let allowed = true;
  try { allowed = await api.permissions.contains({ origins: ['<all_urls>'] }); } catch (e) { /* assume yes */ }
  if (!allowed) {
    const btn = document.createElement('button');
    btn.textContent = 'Allow saving images';
    notes.push('To store the pictures inside the HTML backup, PageProof needs your OK once.');
    setStatus(notes.join(' '));
    $('status').append(' ', btn);
    await new Promise(resolve => {
      btn.onclick = async () => {
        try { await api.permissions.request({ origins: ['<all_urls>'] }); } catch (e) { /* declined */ }
        btn.remove();
        resolve();
      };
    });
  }
  await buildHtml();
  if (saved.failed.length) notes.push(saved.failed.length + ' file' + (saved.failed.length > 1 ? 's' : '') + ' could not be saved into the HTML backup (they are listed in capture-details.txt).');
  setStatus(notes.join(' '));

  // Evidence pack: every file plus a details file with each file's SHA-256 fingerprint.
  const files = [];
  pngs.forEach((b, i) => files.push({ name: base + (pngs.length > 1 ? '_part' + (i + 1) : '') + '.png', blob: b }));
  files.push({ name: base + '.pdf', blob: pdf });
  files.push({ name: base + '.html', blob: new Blob([saved.html], { type: 'text/html' }) });
  for (const f of files) f.bytes = await bytesOf(f.blob);
  saved.images.forEach((img, i) => files.push({ name: imageName(img, i), bytes: img.bytes, url: img.url }));
  for (const f of files) f.hash = await sha256(f.bytes);

  const lines = [
    'PAGEPROOF CAPTURE RECORD',
    '========================',
    '',
    'Web address:   ' + rec.url,
    'Domain:        ' + host,
    'Page title:    ' + (rec.title || '(none)'),
    'Captured:      ' + formatTime(rec),
    'Captured UTC:  ' + rec.time,
    'Time zone:     ' + zoneLabel(rec),
    'Window size:   ' + rec.viewWidth + ' x ' + rec.viewHeight + ' (screen scale ' + (Math.round(s * 100) / 100) + ')',
    'Browser:       ' + rec.userAgent,
    'Tool:          PageProof ' + rec.version + ' (https://github.com/TheBenPsych/PageProof)',
    '',
    'Scroll sections captured: ' + (rec.sections.length ? '' : 'none'),
    ...rec.sections.map(x => '  Section ' + x.n + ': ' + x.label),
    '',
    'FILES AND SHA-256 FINGERPRINTS',
    'If a file is changed in any way, its fingerprint will no longer match.',
    '',
    ...files.flatMap(f => [f.hash + '  ' + f.name, ...(f.url ? ['    original: ' + f.url] : [])]),
    ...(saved.failed.length ? ['', 'COULD NOT BE SAVED (blocked or removed by the website):', ...saved.failed.map(u => '  ' + u)] : []),
    ''
  ];
  const details = new TextEncoder().encode(lines.join('\r\n'));
  files.push({ name: 'capture-details.txt', bytes: details });
  const zip = PP_ZIP(files.map(f => ({ name: f.name, bytes: f.bytes })), new Date(rec.time));
  $('pack').disabled = false;
  $('pack').onclick = () => download(zip, base + '_evidence.zip');
  $('details').textContent = lines.join('\n');
  $('detailsBox').hidden = false;

  // Keep only the 5 most recent captures so the browser doesn't fill up.
  const keys = (await PP_DB.keys()).sort();
  for (const k of keys.slice(0, -5)) await PP_DB.del(k);
}

start().catch(err => setStatus('Something went wrong: ' + err.message, true));
