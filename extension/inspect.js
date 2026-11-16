// PageProof Image Inspector: shows the hidden data inside a picture and saves it as evidence.
const $ = id => document.getElementById(id);
const api = globalThis.browser || globalThis.chrome;
const params = new URLSearchParams(location.search);

let cur = null;        // the picture being inspected
let galleryRec = null; // the "all pictures on the page" list, if we came from there

function setStatus(text, isError) {
  $('status').textContent = text || '';
  $('status').className = isError ? 'error' : '';
}
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const pad = n => String(n).padStart(2, '0');
const stamp = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '_' + pad(d.getHours()) + '-' + pad(d.getMinutes()) + '-' + pad(d.getSeconds());
const fmtBytes = n => n >= 1e6 ? (n / 1e6).toFixed(1) + ' MB' : n >= 1e3 ? Math.round(n / 1e3) + ' KB' : n + ' bytes';
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const localTime = iso => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'long' });
async function sha256(bytes) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...d].map(b => b.toString(16).padStart(2, '0')).join('');
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
const newId = () => 'PP-' + [...crypto.getRandomValues(new Uint8Array(6))].map(b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
const MIME = { JPEG: 'image/jpeg', PNG: 'image/png', WebP: 'image/webp', GIF: 'image/gif', TIFF: 'image/tiff', HEIC: 'image/heic', AVIF: 'image/avif', BMP: 'image/bmp', SVG: 'image/svg+xml' };
const EXT = { JPEG: 'jpg', PNG: 'png', WebP: 'webp', GIF: 'gif', TIFF: 'tif', HEIC: 'heic', AVIF: 'avif', BMP: 'bmp', SVG: 'svg' };
const hostOf = u => { try { return new URL(u).hostname; } catch (e) { return ''; } };

// ---------- getting a picture ----------
// Firefox asks once before add-ons may download from websites.
async function ensureAllowed() {
  let ok = true;
  try { ok = await api.permissions.contains({ origins: ['<all_urls>'] }); } catch (e) { /* assume yes */ }
  if (ok) return;
  const btn = el('button', null, 'Allow');
  setStatus('To download pictures from websites, PageProof needs your OK once. ');
  $('status').append(btn);
  await new Promise(resolve => { btn.onclick = async () => { try { await api.permissions.request({ origins: ['<all_urls>'] }); } catch (e) { /* declined */ } resolve(); }; });
  setStatus('');
}

async function fetchPicture(src) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  try {
    // Ask the website for the original file (not a copy re-drawn by the browser), so its hidden data is intact.
    let res;
    try { res = await fetch(src, { credentials: 'include', cache: 'no-store', signal: ctl.signal }); }
    catch (e) { res = await fetch(src, { cache: 'force-cache', signal: ctl.signal }); }
    if (!res.ok) throw new Error('the website answered ' + res.status + ' ' + res.statusText);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > 80e6) throw new Error('the file is too big (' + fmtBytes(bytes.length) + ')');
    return { bytes, response: { status: res.status + ' ' + res.statusText, finalUrl: res.url, headers: [...res.headers.entries()], type: (res.headers.get('content-type') || '').split(';')[0] } };
  } finally { clearTimeout(timer); }
}

function nameFromUrl(u, format) {
  let n = '';
  try { n = decodeURIComponent(new URL(u).pathname.split('/').pop() || ''); } catch (e) { /* data: address */ }
  n = n.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'picture';
  const ext = EXT[format];
  if (ext && !new RegExp('\\.(' + ext + (ext === 'jpg' ? '|jpeg' : '') + ')$', 'i').test(n)) n = n.replace(/\.[a-z0-9]{2,5}$/i, '') + '.' + ext;
  return n;
}

async function inspectWeb(item, rec) {
  showOnly('shown');
  $('shownImg').removeAttribute('src');
  $('domain').textContent = hostOf(item.src) || 'Picture';
  $('url').textContent = item.src.startsWith('data:') ? '(picture stored inside the page)' : item.src;
  if (!item.src.startsWith('data:')) await ensureAllowed();
  setStatus('Downloading the original file from the website...');
  let got, used = item.best || item.src;
  try {
    // Try the biggest version first (it usually keeps more hidden data), then the one shown on the page.
    try { got = await fetchPicture(used); }
    catch (e) { if (!item.best) throw e; used = item.src; got = await fetchPicture(used); }
  } catch (e) {
    setStatus('Could not download this picture (' + e.message + '). Some websites block this. Right-click the picture, choose "Save image as...", then add the saved file here with "Inspect another picture".', true);
    return;
  }
  await analyze({
    bytes: got.bytes, fromWeb: true, src: used, shownSrc: used !== item.src ? item.src : '', page: rec.page, pageTitle: rec.title, alt: item.alt,
    shownSize: item.w && item.h ? item.w + ' x ' + item.h : '', response: got.response, time: new Date().toISOString()
  });
}

async function inspectFile(file, extra = {}) {
  if (!file) return;
  showOnly('shown');
  setStatus('Reading ' + file.name + '...');
  const bytes = new Uint8Array(await file.arrayBuffer());
  galleryRec = null; $('backAll').hidden = true;
  await analyze({ ...extra, bytes, fromWeb: false, fileName: file.name, fileModified: file.lastModified ? new Date(file.lastModified).toISOString() : '', time: new Date().toISOString() });
}

// ---------- reading and showing the hidden data ----------
async function analyze(p) {
  setStatus('Reading the hidden data...');
  const meta = await PP_META.read(p.bytes);
  const sha = await sha256(p.bytes);
  const name = p.fromWeb ? nameFromUrl(p.src, meta.format) : p.fileName.replace(/[^\w.-]+/g, '_');
  const host = p.fromWeb ? (hostOf(p.page) || hostOf(p.src) || 'web') : 'file';
  const type = MIME[meta.format] || (p.response && p.response.type) || 'application/octet-stream';
  const blob = new Blob([p.bytes], { type });
  let bitmap = null;
  try { bitmap = await createImageBitmap(blob); } catch (e) { /* this browser can't draw it (e.g. HEIC) */ }
  cur = { ...p, meta, sha, name, host, type, blob, bitmap, captureId: newId(), version: api.runtime.getManifest().version };
  if (!meta.width && bitmap) { meta.width = bitmap.width; meta.height = bitmap.height; }
  render();
  setStatus('');
}

function showOnly(which) {
  for (const id of ['empty', 'gallery', 'shown']) $(id).hidden = id !== which;
}

function render() {
  const c = cur, m = c.meta, s = m.summary;
  document.title = 'PageProof: ' + c.name;
  showOnly('shown');
  const img = $('shownImg');
  if (c.bitmap) { img.hidden = false; $('noPreview').hidden = true; img.src = URL.createObjectURL(c.blob); }
  else { img.hidden = true; $('noPreview').hidden = false; }
  $('shownCap').textContent = c.name + ' · ' + (m.width ? m.width + ' × ' + m.height + ' · ' : '') + fmtBytes(m.size) + ' ' + m.format +
    (c.fromWeb && c.page ? ' · found on ' + c.page : '') + ' · shown smaller here; the original file is kept untouched';

  $('domain').textContent = c.fromWeb ? c.host : c.name;
  $('url').textContent = c.fromWeb ? (c.src.startsWith('data:') ? '(picture stored inside the page)' : c.src) : 'Added from your computer';
  $('url').title = c.fromWeb ? c.src + '  (click to copy)' : '';
  $('url').onclick = c.fromWeb ? () => navigator.clipboard.writeText(c.src).then(() => setStatus('Picture address copied.'), () => {}) : null;
  $('sub').textContent = (c.fromWeb ? 'Downloaded ' : 'Inspected ') + new Date(c.time).toLocaleString() + '  ·  ' + c.captureId;
  $('notice').hidden = !c.fromWeb;
  $('notice').textContent = c.shownSrc ? '✓ Got the biggest version the website has (the page showed a smaller one), not a screenshot' : '✓ Got the original file from the website, not a screenshot';

  // Warnings
  const warn = $('warn');
  warn.hidden = s.level === 'rich';
  warn.className = 'warnbox' + (s.level === 'some' ? ' soft' : '');
  warn.textContent = '';
  if (s.level === 'none') warn.append(el('b', null, '⚠ No hidden data in this file'),
    c.pasted ? 'Pasted pictures never keep their hidden data, because the browser copies only the pixels. To read it, add the original file with "Inspect another picture" or drag it in.'
      : 'Camera, date and copyright details have been removed, or were never added. This usually means it is a screenshot or a re-upload to social media or a website. That is worth noting in your case.');
  else if (s.level === 'some') warn.append(el('b', null, '⚠ Only a little hidden data'),
    'Most camera and copyright details are missing. The website may have removed them when the picture was uploaded.');
  $('ai').hidden = !s.ai.length;
  $('ai').textContent = '';
  if (s.ai.length) $('ai').append(el('b', null, '🤖 Signs this was made or changed with AI'), s.ai.join('. ') + '.');

  // Summary
  $('sentence').textContent = s.level === 'none' ? '' : s.sentence;
  const rows = $('rows');
  rows.textContent = '';
  const row = (icon, k, v, opts = {}) => {
    if (!v && opts.optional) return;
    const r = el('div', 'row');
    const val = el('span', 'v' + (v ? '' : ' none') + (opts.own && v ? ' own' : ''), v || 'Not found');
    if (opts.link && v) { const a = el('a', null, opts.linkText); a.href = opts.link; a.target = '_blank'; a.rel = 'noopener'; val.append(a); }
    if (opts.copy) { val.classList.add('copy'); val.title = opts.copy + '  (click to copy)'; val.onclick = () => navigator.clipboard.writeText(opts.copy).then(() => setStatus('Copied.'), () => {}); }
    r.append(el('span', null, icon), el('span', 'k', k), val);
    rows.append(r);
  };
  row('📷', 'Camera', [s.camera, s.lens].filter(Boolean).join(' · '));
  row('📅', 'Taken', s.taken);
  row('📍', 'Place', s.gps ? s.gps.lat + ', ' + s.gps.lon : '', s.gps ? { link: 'https://www.google.com/maps?q=' + s.gps.lat + ',' + s.gps.lon, linkText: 'Map ↗' } : {});
  row('🛠️', 'Edited with', s.software);
  row('👤', 'Creator', s.creator, { own: true });
  row('©', 'Copyright', s.copyright, { own: true });
  row('🏷️', 'Credit', s.credit, { optional: true, own: true });
  row('📜', 'Usage terms', s.terms, { optional: true });
  row('🔢', 'Camera serial', s.serial, { optional: true });
  row('📐', 'Size', (m.width ? m.width + ' × ' + m.height + ' · ' : '') + fmtBytes(m.size) + ' ' + m.format);
  row('🔑', 'SHA-256', c.sha.slice(0, 8) + ' … ' + c.sha.slice(-8), { copy: c.sha });
  $('sumCard').hidden = false;

  // Folded details
  const folds = $('folds');
  folds.textContent = '';
  const fold = (title, count, fill) => {
    const d = el('details', 'fold');
    const sum = el('summary', null, title);
    sum.append(el('small', null, count));
    d.append(sum);
    fill(d);
    folds.append(d);
  };
  const table = (d, list) => {
    const t = el('div', 'tbl');
    for (const f of list) { const r = el('div', 'tr'); r.append(el('span', 'k', f.name), el('span', 'v', String(f.value).slice(0, 3000))); t.append(r); }
    d.append(t);
  };
  const n = x => x + (x === 1 ? ' field' : ' fields');
  fold('📷 All camera data (EXIF)', m.exif.length ? n(m.exif.length) : 'none', d => m.exif.length ? table(d, m.exif) : d.append(el('p', 'note', 'No camera data in this file.')));
  fold('© Author and copyright (IPTC)', m.iptc.length ? n(m.iptc.length) : 'none', d => m.iptc.length ? table(d, m.iptc) : d.append(el('p', 'note', 'No IPTC author or copyright fields in this file.')));
  const x = m.xmp;
  fold('🧾 Adobe data and edit history (XMP)', x ? n(x.fields.length) + (x.history.length ? ', ' + x.history.length + ' edits' : '') : 'none', d => {
    if (!x) return d.append(el('p', 'note', 'No XMP data in this file.'));
    if (x.history.length) {
      d.append(el('p', 'note', 'Edit history, oldest first:'));
      const h = el('div', 'hist');
      for (const e of x.history) { const it = el('div', null, [e.action, e.software].filter(Boolean).join(' · ')); it.append(el('small', null, [e.when, e.changed && 'changed: ' + e.changed].filter(Boolean).join('  '))); h.append(it); }
      d.append(h);
    }
    table(d, x.fields);
  });
  fold('🏷️ Content Credentials (C2PA)', m.c2pa ? 'found' : 'none', d => {
    if (!m.c2pa) return d.append(el('p', 'note', 'No Content Credentials in this file. Most cameras and websites don\'t add them yet. AI tools and Adobe apps often do.'));
    table(d, [{ name: 'Made with', value: m.c2pa.generator || '(not stated)' }, { name: 'Recorded steps', value: m.c2pa.actions.join(', ') || '(none listed)' },
      { name: 'Signed by', value: m.c2pa.signers.join('; ') || '(not found)' }, { name: 'AI', value: m.c2pa.ai || 'No AI label found' }].filter(f => f.value));
    const p = el('p', 'note', 'PageProof reads these details but does not check the signature. For a full check, upload the original file at ');
    const a = el('a', null, 'contentcredentials.org/verify'); a.href = 'https://contentcredentials.org/verify'; a.target = '_blank';
    p.append(a, '.');
    d.append(p);
  });
  if (m.comments.length) fold('💬 Other text in the file', n(m.comments.length), d => table(d, m.comments.map((t, i) => ({ name: 'Text ' + (i + 1), value: t }))));
  fold('🌐 Where it came from', c.fromWeb ? 'website' : 'your computer', d => table(d, sourceFields()));

  // Case details: the collector's name is remembered, case number and notes start empty.
  $('caseBox').hidden = false;
  for (const b of ['pack', 'pdf', 'markup', 'copy', 'orig', 'compare']) $(b).disabled = false;
  $('markup').disabled = $('copy').disabled = $('compare').disabled = !c.bitmap;
}

function sourceFields() {
  const c = cur;
  if (!c.fromWeb) return [
    { name: 'File name', value: c.fileName },
    { name: 'File date', value: c.fileModified ? localTime(c.fileModified) + ' (from your computer)' : '(not known)' },
    { name: 'Note', value: 'Added from your computer, so PageProof cannot record which website it came from.' }
  ];
  const keep = /^(content-type|content-length|last-modified|etag|date|server|age|cache-control|expires|x-cache|cf-cache-status|via|content-disposition|x-amz-.*|x-goog-.*|x-served-by)$/i;
  return [
    { name: 'Picture address', value: c.src.startsWith('data:') ? '(picture stored inside the page, ' + c.src.length + ' characters)' : c.src },
    ...(c.shownSrc ? [{ name: 'Shown on the page', value: (c.shownSrc.startsWith('data:') ? '(stored inside the page)' : c.shownSrc) + '  (a smaller version; PageProof downloaded the biggest version the website offers, above)' }] : []),
    { name: 'Found on page', value: c.page || '(not known)' },
    { name: 'Page title', value: c.pageTitle || '' },
    { name: 'Picture alt text', value: c.alt || '' },
    { name: 'Size shown on page', value: c.shownSrc ? '' : c.shownSize || '' },
    { name: 'Downloaded', value: localTime(c.time) },
    { name: 'Server answer', value: c.response ? c.response.status : '' },
    ...(c.response && c.response.finalUrl && c.response.finalUrl !== c.src ? [{ name: 'Final address', value: c.response.finalUrl }] : []),
    ...(c.response ? c.response.headers.filter(([k]) => keep.test(k)).map(([k, v]) => ({ name: k, value: v })) : [])
  ].filter(f => f.value);
}

// ---------- "all pictures on this page" ----------
async function showGallery(rec) {
  galleryRec = rec;
  showOnly('gallery');
  document.title = 'PageProof: pictures on ' + (hostOf(rec.page) || 'this page');
  $('domain').textContent = hostOf(rec.page) || 'This page';
  $('url').textContent = rec.page || '';
  $('sub').textContent = 'Click a picture on the right to inspect it';
  for (const id of ['sumCard', 'caseBox', 'warn', 'ai', 'notice']) $(id).hidden = true;
  $('folds').textContent = '';
  for (const b of ['pack', 'pdf', 'markup', 'copy', 'orig', 'compare']) $(b).disabled = true;
  const items = rec.items;
  $('galTitle').textContent = items.length + ' picture' + (items.length === 1 ? '' : 's') + ' found on this page';
  if (!items.length) { setStatus('No pictures were found on this page. Try scrolling down first so the page loads them, then try again.'); return; }
  await ensureAllowed();
  const grid = $('gGrid');
  grid.textContent = '';
  const cards = items.map((it, i) => {
    const b = el('button', 'gc' + (i === 0 ? ' first' : ''));
    const im = el('div', 'im'); const img = el('img'); img.src = it.src; img.alt = it.alt || ''; img.loading = 'lazy'; im.append(img);
    const meta = el('div', 'meta');
    const what = el('span', 'what', (i === 0 ? '⭐ Biggest · ' : '') + (it.w ? it.w + ' × ' + it.h : 'picture'));
    what.title = it.src.startsWith('data:') ? '(stored inside the page)' : it.src;
    const badge = el('span', 'badge w', 'Checking...');
    meta.append(what, badge);
    b.append(im, meta);
    b.onclick = () => { $('backAll').hidden = false; inspectWeb(it, rec); };
    grid.append(b);
    return { it, badge };
  });
  setStatus('');
  // Check each picture for hidden data, a few at a time.
  let next = 0;
  const worker = async () => {
    while (next < cards.length) {
      const { it, badge } = cards[next++];
      try {
        let got;
        try { got = await fetchPicture(it.best || it.src); } catch (e) { if (!it.best) throw e; got = await fetchPicture(it.src); }
        const m = await PP_META.read(got.bytes);
        const lv = m.summary.level;
        badge.className = 'badge ' + ({ rich: 'y', some: 's', none: 'n' })[lv];
        badge.textContent = ({ rich: '✓ Hidden data', some: 'A little data', none: 'No data' })[lv];
        if (m.summary.namesOwner) badge.textContent += ' · ©';
        if (m.summary.namesOwner) badge.title = [m.summary.creator, m.summary.copyright].filter(Boolean).join(' · ');
      } catch (e) { badge.className = 'badge x'; badge.textContent = 'Blocked'; badge.title = 'The website would not send this file: ' + e.message; }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
}
$('backAll').onclick = e => { e.preventDefault(); if (galleryRec) { $('backAll').hidden = true; showGallery(galleryRec); } };

// ---------- outputs ----------
function caseDetails() {
  return { collector: $('collector').value.trim(), caseRef: $('caseRef').value.trim(), notes: $('caseNotes').value.trim() };
}
const baseName = () => 'PageProof_image_' + cur.host + '_' + stamp(new Date(cur.time)) + '_' + cur.captureId;

async function makeReportPdf() {
  const c = cur, m = c.meta, s = m.summary, cd = caseDetails();
  const items = [{ p: 'In short: ' + s.sentence, box: '#eff6ff', color: '#1e3a8a' }];
  if (c.bitmap) items.push({ image: c.bitmap, maxH: 760, caption: c.name + ' · ' + (m.width ? m.width + ' × ' + m.height + ' · ' : '') + fmtBytes(m.size) + ' ' + m.format });
  else items.push({ p: 'This browser cannot draw ' + m.format + ' pictures, so the picture is not shown here. The original file is in the evidence pack.', box: '#f1f5f9' });
  items.push({ h: 'Where this picture came from' }, { kv: [
    ...sourceFields().map(f => [f.name, f.value]),
    ['File', c.name + ' · ' + m.format + ' · ' + m.size + ' bytes'],
    ['SHA-256 of the file', c.sha],
    ['Collected by', cd.collector], ['Case / reference', cd.caseRef], ['Notes', cd.notes],
    ['Capture ID', c.captureId], ['Time zone', timeZone]
  ] });
  if (s.level !== 'rich') items.push({ p: s.level === 'none'
    ? 'No hidden data was found in this file. Camera, date and copyright details have been removed, or were never added. This usually means it is a screenshot or a re-upload to social media or a website.'
    : 'Only a little hidden data was found in this file. Most camera and copyright details are missing.', box: '#fef3c7', color: '#78350f' });
  if (s.ai.length) items.push({ p: 'Signs this was made or changed with AI: ' + s.ai.join('. ') + '.', box: '#ede9fe', color: '#4c1d95' });
  items.push({ h: 'What the hidden data says' }, { kv: [
    ['Camera', [s.camera, s.lens].filter(Boolean).join(' · ') || 'Not found'], ['Taken', s.taken || 'Not found'],
    ['Place (GPS)', s.gps ? s.gps.lat + ', ' + s.gps.lon + (s.gps.alt != null ? ' (altitude ' + Math.round(s.gps.alt) + ' m)' : '') + '   google.com/maps?q=' + s.gps.lat + ',' + s.gps.lon : 'Not found'],
    ['Edited with', s.software || 'Not found'], ['Creator', s.creator || 'Not found', !!s.creator], ['Copyright', s.copyright || 'Not found', !!s.copyright],
    ['Credit line', s.credit, !!s.credit], ['Usage terms', s.terms], ['Rights web page', s.webStatement], ['Contact', s.contact],
    ['Camera serial', s.serial], ['Camera owner', s.owner]
  ] });
  const kv = list => list.map(f => [f.name, String(f.value)]);
  if (m.exif.length) items.push({ h: 'Camera data (EXIF)' }, { kv: kv(m.exif) });
  if (m.iptc.length) items.push({ h: 'Author and copyright (IPTC)' }, { kv: kv(m.iptc) });
  if (m.xmp && m.xmp.history.length) items.push({ h: 'Edit history (XMP), oldest first' }, { kv: m.xmp.history.map(e => [e.when || '(no date)', [e.action, e.software, e.changed && '(changed: ' + e.changed + ')'].filter(Boolean).join(' · ')]) });
  if (m.xmp && m.xmp.fields.length) items.push({ h: 'Adobe data (XMP)' }, { kv: kv(m.xmp.fields) });
  items.push({ h: 'Content Credentials (C2PA)' });
  if (m.c2pa) items.push({ kv: [['Made with', m.c2pa.generator || '(not stated)'], ['Recorded steps', m.c2pa.actions.join(', ')], ['Signed by', m.c2pa.signers.join('; ')], ['AI', m.c2pa.ai || 'No AI label found']] },
    { p: 'Read by PageProof, but the signature was not checked. For a full check, upload the original file at contentcredentials.org/verify.', color: '#64748b' });
  else items.push({ p: 'None in this file.' });
  if (m.comments.length) items.push({ h: 'Other text in the file' }, { kv: m.comments.map((t, i) => ['Text ' + (i + 1), t]) });
  items.push({ gap: 10 }, { p: 'Hidden data can be edited with the right software, so treat it as one piece of evidence. The evidence pack holds the untouched original file, fingerprints and trusted timestamps.', color: '#64748b' });

  const canvases = PP_REPORT.render({
    title: c.fromWeb ? c.host : c.name,
    subtitle: [c.fromWeb ? (c.src.startsWith('data:') ? 'Picture stored inside ' + (c.page || 'the page') : c.src) : 'Picture added from the collector\'s computer: ' + c.name,
      'Image evidence  ·  ' + localTime(c.time) + '  ·  ' + timeZone,
      'Capture ID ' + c.captureId + '  ·  PageProof ' + c.version],
    footer: 'PageProof Image Inspector  ·  ' + c.captureId + '  ·  ' + (c.fromWeb ? c.host : c.name),
    items
  });
  return makePdf(await PP_REPORT.pdfPages(canvases), { title: 'PageProof image evidence: ' + c.name, subject: (c.fromWeb ? c.src.slice(0, 500) : c.name) + ' collected ' + c.time });
}

$('pdf').onclick = async () => {
  $('pdf').disabled = true;
  setStatus('Making the PDF...');
  try { download(await makeReportPdf(), baseName() + '.pdf'); setStatus('PDF saved to your Downloads.'); }
  catch (e) { setStatus('Could not make the PDF: ' + e.message, true); }
  $('pdf').disabled = false;
};

$('orig').onclick = () => download(cur.blob, cur.name);

const pngOf = async () => {
  const cv = document.createElement('canvas');
  cv.width = cur.bitmap.width; cv.height = cur.bitmap.height;
  cv.getContext('2d').drawImage(cur.bitmap, 0, 0);
  return new Promise(r => cv.toBlob(r, 'image/png'));
};
$('copy').onclick = async () => {
  try {
    if (!navigator.clipboard || !window.ClipboardItem) throw new Error('this browser cannot copy pictures');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngOf() })]);
    setStatus('Copied! Paste it (Ctrl+V, or Cmd+V on a Mac) into an email, chat or document.');
  } catch (e) { setStatus('Could not copy the picture (' + e.message + ').', true); }
};
$('markup').onclick = async () => {
  try {
    await PP_DB.put({ id: 'markup', blob: await pngOf(), meta: { name: baseName(), url: cur.fromWeb ? cur.src : cur.name, host: cur.fromWeb ? cur.host : cur.name,
      captured: localTime(cur.time), captureId: cur.captureId, scale: 1 } });
    const url = 'markup.html?from=capture';
    try { await api.tabs.create({ url: api.runtime.getURL(url) }); } catch (e) { window.open(url, '_blank'); }
  } catch (e) { setStatus('Could not open the mark-up page: ' + e.message, true); }
};

$('compare').onclick = async () => {
  try {
    await PP_DB.put({ id: 'compare', blob: cur.blob, name: cur.name, src: cur.fromWeb ? cur.src : '' });
    const url = 'compare.html?from=inspector';
    try { await api.tabs.create({ url: api.runtime.getURL(url) }); } catch (e) { window.open(url, '_blank'); }
  } catch (e) { setStatus('Could not open the Compare page: ' + e.message, true); }
};

$('pack').onclick = async () => {
  const c = cur;
  $('pack').disabled = true;
  try {
    const cd = caseDetails();
    setStatus('Making the PDF...');
    const base = baseName();
    const enc = s => new TextEncoder().encode(s);
    const files = [
      { name: 'original/' + c.name, bytes: c.bytes },
      { name: base + '.pdf', bytes: new Uint8Array(await (await makeReportPdf()).arrayBuffer()) },
      { name: 'image-data.txt', bytes: enc(PP_META.toText(c.meta, { title: 'HIDDEN DATA IN ' + c.name, sha256: c.sha, url: c.fromWeb ? c.src : '' })) },
      { name: 'VERIFY-THIS-PACK.html', bytes: enc(await standaloneChecker()) }
    ];
    for (const f of files) f.hash = await sha256(f.bytes);
    const fpBytes = enc(files.map(f => f.hash + '  ' + f.name).join('\n') + '\n');
    const fpHash = await sha256(fpBytes);
    setStatus('Getting trusted timestamps...');
    const stamps = await PP_TSA.stampAll(new Uint8Array(await crypto.subtle.digest('SHA-256', fpBytes)));
    const good = stamps.filter(t => !t.error);
    const src = c.fromWeb ? c.src : 'file: ' + c.name;
    const details = [
      'PAGEPROOF IMAGE RECORD',
      '======================',
      '',
      'Capture ID:    ' + c.captureId,
      'Web address:   ' + (c.fromWeb ? (c.src.startsWith('data:') ? '(picture stored inside the page ' + (c.page || '') + ')' : c.src) : '(added from the collector\'s computer: ' + c.name + ')'),
      'Found on page: ' + (c.page || '(not known)'),
      'Page title:    ' + (c.pageTitle || '(none)'),
      'Collected:     ' + localTime(c.time),
      'Captured UTC:  ' + c.time,
      'Time zone:     ' + timeZone,
      'Browser:       ' + navigator.userAgent,
      'Tool:          PageProof Image Inspector ' + c.version,
      '',
      'CASE DETAILS',
      'Collected by:  ' + (cd.collector || '(not entered)'),
      'Case / ref:    ' + (cd.caseRef || '(not entered)'),
      'Notes:         ' + (cd.notes ? cd.notes.replace(/\r?\n/g, '\r\n               ') : '(none)'),
      'Pack saved:    ' + new Date().toISOString() + ' (UTC)',
      '',
      'WHERE THE FILE CAME FROM',
      ...sourceFields().map(f => '  ' + (f.name + ':').padEnd(20) + f.value),
      '',
      'HIDDEN DATA (summary; everything is in image-data.txt)',
      PP_META.toText(c.meta, { brief: true, sha256: c.sha }),
      'TRUSTED TIMESTAMPS',
      'What was signed: the SHA-256 of fingerprints.sha256 = ' + fpHash,
      ...stamps.flatMap(t => t.error ? [t.service + ': not available (' + t.error + ')']
        : [t.service + ': signed ' + (t.time || '(see receipt)') + ' UTC  ->  timestamps/' + t.file + '.tsr  (' + t.url + ')']),
      'How to check: see README.txt, or drop this zip on the PageProof "Verify a pack" page.',
      '',
      'FILES AND SHA-256 FINGERPRINTS',
      'If a file is changed in any way, its fingerprint will no longer match.',
      '',
      ...files.map(f => f.hash + '  ' + f.name),
      ''
    ].join('\r\n');
    const extra = [
      { name: 'fingerprints.sha256', bytes: fpBytes },
      ...good.flatMap(t => [{ name: 'timestamps/' + t.file + '.tsr', bytes: t.reply }, { name: 'timestamps/' + t.file + '.tsq', bytes: t.query }]),
      { name: 'capture-details.txt', bytes: enc(details) },
      { name: 'README.txt', bytes: enc(ppImageReadme({ captureId: c.captureId, version: c.version, source: src, page: c.page, time: c.time, base,
        original: 'original/' + c.name, fromWeb: c.fromWeb, stamps: good })) }
    ];
    const zip = PP_ZIP([...files, ...extra].map(f => ({ name: f.name, bytes: f.bytes })), new Date(c.time));
    const zipName = (cd.caseRef ? cd.caseRef.replace(/[^\w.-]+/g, '_').slice(0, 40) + '_' : '') + c.host + '_image_' + stamp(new Date(c.time)) + '_' + c.captureId + '.zip';
    download(zip, zipName);
    const zipHash = await sha256(new Uint8Array(await zip.arrayBuffer()));
    try {
      await api.storage.local.set({ lastCase: { collector: cd.collector } });
      const { log = [] } = await api.storage.local.get('log');
      const id = 'img-' + c.captureId;
      let entry = log.find(e => e.id === id);
      if (!entry) { entry = { id, captureId: c.captureId, time: c.time, url: c.fromWeb ? (c.src.startsWith('data:') ? c.page : c.src) : 'file: ' + c.name, title: 'Picture: ' + c.name }; log.push(entry); }
      (entry.saves = entry.saves || []).push({ at: new Date().toISOString(), file: zipName, sha256: zipHash, ...cd, timestamps: good.map(t => t.service + ' ' + (t.time || '')).join('; ') });
      await api.storage.local.set({ log });
    } catch (e) { /* the log is a convenience */ }
    const tsNote = good.length ? 'Timestamped by ' + good.map(t => t.service).join(', ') + '.' : 'No trusted timestamp could be added (' + stamps.map(t => t.service + ': ' + t.error).join('; ') + '). Everything else is saved.';
    setStatus('Saved ' + zipName + '. ' + tsNote + ' Its fingerprint is in your capture log.', !good.length);
  } catch (e) { setStatus('Could not save the evidence pack: ' + e.message, true); }
  $('pack').disabled = false;
};

// ---------- adding a picture by hand ----------
$('addImage').onclick = () => $('pick').click();
$('pick').onchange = () => { inspectFile($('pick').files[0]); $('pick').value = ''; };
addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('over'); });
addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('over'); });
addEventListener('drop', async e => {
  e.preventDefault();
  document.body.classList.remove('over');
  const f = [...e.dataTransfer.files][0];
  if (f) return inspectFile(f);
  const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
  if (/^(https?|data):/.test(url)) { galleryRec = null; $('backAll').hidden = true; inspectWeb({ src: url.trim() }, { page: '', title: '' }); }
});
addEventListener('paste', e => {
  if (/^(INPUT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName)) return;
  const f = [...e.clipboardData.files][0];
  if (f) { e.preventDefault(); inspectFile(new File([f], f.name && f.name !== 'image.png' ? f.name : 'pasted-picture.' + (f.type.split('/')[1] || 'png'), { type: f.type, lastModified: Date.now() }), { pasted: true }); }
});

// ---------- start ----------
(async () => {
  try { $('collector').value = ((await api.storage.local.get('lastCase')).lastCase || {}).collector || ''; } catch (e) { /* ignore */ }
  const id = params.get('id');
  if (!id) return showOnly('empty');
  const rec = await PP_DB.get(id).catch(() => null);
  if (!rec) { showOnly('empty'); return setStatus('That picture is no longer open. Add it again below.', true); }
  if (rec.mode === 'all') return showGallery(rec);
  return inspectWeb(rec.items[0], rec);
})().catch(e => setStatus('Something went wrong: ' + e.message, true));
