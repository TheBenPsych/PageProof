// PageProof viewer: stitches the screenshots together and offers downloads.
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);

// The proof checklist in the side panel: each line turns green as that part of the proof is ready.
function proof(id, state, text) {
  const li = document.getElementById(id);
  if (!li) return;
  li.className = state;
  if (text) li.querySelector('span').textContent = text;
}
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

// Plain-text summary of who hosts the site, for capture-details.txt.
function hostingLines(h) {
  if (!h) return [];
  const lines = ['WHO HOSTS THIS SITE (public RDAP/WHOIS records, looked up ' + new Date().toISOString() + ')'];
  if (h.ip) lines.push(
    'Hosting company: ' + (h.ip.host || h.ip.network || '(not listed)') + (h.ip.country ? ' (' + h.ip.country + ')' : ''),
    'Server network:  ' + h.ip.network + '  ' + h.ip.range);
  else if (h.ipError) lines.push('Hosting company: lookup failed (' + h.ipError + ')');
  if (h.domain) lines.push(
    'Domain:          ' + h.domain.name + (h.domain.created ? ', registered ' + h.domain.created.slice(0, 10) : '') + (h.domain.expires ? ', expires ' + h.domain.expires.slice(0, 10) : ''),
    'Registrar:       ' + (h.domain.registrar || '(not listed)'),
    'Domain owner:    ' + (h.domain.registrant || '(hidden for privacy)'),
    'Name servers:    ' + (h.domain.nameservers.join(', ') || '(not listed)'));
  else if (h.domainError) lines.push('Domain lookup failed (' + h.domainError + ')');
  if (h.note) lines.push('Note: ' + h.note);
  lines.push('Full records: lookups/ folder in this pack.', '');
  return lines;
}

function showHosting(h) {
  const box = $('hosting');
  box.hidden = false;
  box.textContent = '';
  const t = document.createElement('summary');
  t.textContent = '🏢 Who hosts this site';
  const short = document.createElement('small');
  short.textContent = (h.ip && (h.ip.host || h.ip.network)) || (h.domain && h.domain.registrar) || 'From public records';
  t.append(short);
  const pre = document.createElement('pre');
  pre.textContent = hostingLines(h).slice(1, -2).join('\n');
  box.append(t, pre);
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
      'Capture ID ' + (rec.captureId || '-') + '  \u00b7  Window ' + rec.viewWidth + ' x ' + rec.viewHeight + '  \u00b7  PageProof ' + rec.version
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

  // Each extra section, under the main capture.
  const pad = Math.round(16 * u);
  const availW = W - pad * 2;
  const describe = sec => ({
    scroll: sec.axes && sec.axes.x && !sec.axes.y
      ? 'Full contents of the side-scrolling area marked "Section ' + sec.n + '" above (shown in rows, left to right).'
      : 'Full contents of the scroll box marked "Section ' + sec.n + '" in the capture above.',
    select: 'Every choice in the dropdown list marked "Section ' + sec.n + '" above. [x] = the choice selected when captured.'
  })[sec.kind || 'scroll'];

  for (const sec of rec.sections) {
    const headH = Math.round(56 * u);
    const kindName = { scroll: 'Scroll box', select: 'Dropdown list' }[sec.kind || 'scroll'];
    const label = 'Section ' + sec.n + ' (' + kindName + '): ' + sec.label;
    const note = describe(sec);
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
      ctx.fillText(fitText(ctx, note, W - pad * 3), pad + 8 * u, 46 * u);
    } });
    y += headH;

    if (sec.kind === 'select') {
      // Write out the choices in columns.
      const lineH = Math.round(20 * u);
      const colW = Math.round(300 * u);
      const cols = Math.max(1, Math.floor(availW / colW));
      const perCol = Math.ceil(sec.options.length / cols) || 1;
      const bodyH = perCol * lineH + pad * 2;
      blocks.push({ y, h: bodyH, draw(ctx) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, W, bodyH);
        ctx.font = (14 * u) + 'px system-ui, sans-serif';
        sec.options.forEach((o, k) => {
          const cx = pad + Math.floor(k / perCol) * colW, cy = pad + (k % perCol) * lineH + 14 * u;
          ctx.fillStyle = o.selected ? '#0f172a' : (o.disabled ? '#94a3b8' : '#334155');
          ctx.font = (o.selected ? 'bold ' : '') + (14 * u) + 'px system-ui, sans-serif';
          ctx.fillText(fitText(ctx, (o.selected ? '[x] ' : '[ ] ') + o.text, colW - 10 * u), cx, cy);
        });
      } });
      y += bodyH;
      continue;
    }

    // Picture sections. Very wide content is cut into rows that fit the page width.
    const secW = sec.width * s, secH = sec.height * s;
    let f = 1, rows = 1;
    if (secW > availW) {
      if (secW <= availW * 1.5) f = availW / secW;
      else rows = Math.ceil(secW / availW);
    }
    const rowGap = Math.round(12 * u);
    const rowH = Math.round(secH * f);
    const bodyH = rows * rowH + (rows - 1) * rowGap + pad * 2;
    blocks.push({ y, h: bodyH, draw(ctx) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, W, bodyH);
      for (let k = 0; k < rows; k++) {
        ctx.save();
        ctx.translate(pad, pad + k * (rowH + rowGap));
        ctx.beginPath();
        ctx.rect(0, 0, availW, rowH);
        ctx.clip();
        for (const t of sec.tiles) {
          const c = t.crop;
          ctx.drawImage(t.bmp, Math.round(c.x * s), Math.round(c.y * s), Math.round(c.w * s), Math.round(c.h * s),
            Math.round(t.destX * s * f) - k * availW, Math.round(t.destY * s * f), Math.round(c.w * s * f), Math.round(c.h * s * f));
        }
        ctx.restore();
        if (k < rows - 1) {
          ctx.fillStyle = '#e11d48';
          ctx.font = (11 * u) + 'px system-ui, sans-serif';
          ctx.fillText('continues below ↓', W - pad - 110 * u, pad + k * (rowH + rowGap) + rowH + 10 * u);
        }
      }
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

let oursJob = null, blockedOk = false, clockOff = 0, checkedOnce = false;
async function start() {
  if (params.get('error')) {
    $('sub').textContent = 'The capture did not work';
    setStatus('Sorry, this page could not be captured: ' + params.get('error') +
      '. Browser pages (like settings, new tab, or the add-on store) cannot be captured. Try a normal website.', true);
    return;
  }

  const rec = await PP_DB.get(params.get('id'));
  if (!rec) { setStatus('This capture was not found. It may have been cleared. Please capture the page again.', true); return; }
  PP_DB.get('thumb-' + rec.id).then(t => t || PP_DB.makeThumb(rec)).catch(() => {}); // picture for the Evidence library (4.14)

  const host = new URL(rec.url).hostname || 'page';
  const when = host + '_' + stamp(new Date(rec.time)) + (rec.captureId ? '_' + rec.captureId : '');
  const base = 'PageProof_' + when;
  document.title = 'PageProof: ' + host;
  const pill = document.createElement('span');
  pill.className = 'pill wait';
  pill.textContent = 'Getting ready...';
  $('domain').textContent = host;
  $('domain').append(pill);
  $('url').textContent = rec.url;
  $('url').title = rec.url + '  (click to copy)';
  $('url').onclick = () => navigator.clipboard.writeText(rec.url).then(() => setStatus('Web address copied.'), () => {});
  $('sub').textContent = [new Date(rec.time).toLocaleString(), rec.captureId].filter(Boolean).join('  ·  ');

  let showDetails = null;
  // Who hosts this site (public registration records). Runs alongside everything else.
  const hostingJob = /^https?:/.test(rec.url) ? PP_HOSTING(rec.url, (rec.server || {}).ip).catch(e => ({ files: [], domainError: e.message })) : Promise.resolve(null);

  // Case details are step 1, so they are there to fill in while the rest gets ready. Only the
  // collector's name is remembered; case number and notes start empty for every capture.
  let last = {};
  try { last = (await api.storage.local.get('lastCase')).lastCase || {}; } catch (e) { /* ignore */ }
  $('collector').value = last.collector || '';
  $('caseRef').value = '';
  $('caseBox').hidden = false;

  setStatus('Stitching the screenshots together...');
  for (const part of [rec.main, ...rec.sections]) {
    for (const t of part.tiles) t.bmp = await loadBitmap(t.src);
  }
  const s = rec.main.tiles[0].bmp.width / rec.innerWidth; // screen sharpness (device pixel ratio)
  const plan = layout(rec, s);

  // On-screen preview only (browsers limit how tall one picture can be, so long pages show in parts).
  const maxH = Math.min(30000, Math.floor(200e6 / plan.W));
  for (let y0 = 0; y0 < plan.H; y0 += maxH) {
    const blob = await toBlob(renderSlice(plan, y0, Math.min(maxH, plan.H - y0)), 'image/jpeg', 0.85);
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    img.width = Math.round(plan.W / s);
    $('preview').appendChild(img);
  }

  // One picture of the whole capture (made a little smaller if it is too big for the browser to draw).
  const fullCanvas = () => {
    const k = Math.min(1, 30000 / plan.H, Math.sqrt(60e6 / (plan.W * plan.H)));
    const c = document.createElement('canvas');
    c.width = Math.round(plan.W * k);
    c.height = Math.round(plan.H * k);
    const ctx = c.getContext('2d');
    for (let y0 = 0; y0 < plan.H; y0 += maxH) {
      const h = Math.min(maxH, plan.H - y0);
      ctx.drawImage(renderSlice(plan, y0, h), 0, Math.round(y0 * k), c.width, Math.round(h * k));
    }
    return { c, k };
  };

  // 4.15 idea 3: does this capture look like a login wall, "page not found" or a robot check?
  const srvGone = /^(404|410)\b/.test(String((rec.server || {}).status || ''));
  const blocked = rec.blocked || (srvGone ? { kind: 'gone', why: 'the website said the page is gone (' + rec.server.status + ')' } : null);
  if (blocked) {
    $('warnBox').innerHTML = '<b>This capture may not show the real page</b><span></span><div class="row"><button class="go" id="wbAgain">Capture again</button><button id="wbKeep">Keep it</button></div>';
    $('warnBox').querySelector('span').textContent = 'It looks like ' + blocked.why + '. ' + (blocked.kind === 'login' ? 'Log in on the site (if your team is allowed to), then capture again.' : blocked.kind === 'robot' ? 'Answer the check on the site, then capture again.' : 'Check the address on the site, then capture again if needed.');
    $('warnBox').hidden = false;
    $('wbAgain').onclick = async () => { try { await api.runtime.sendMessage({ type: 'captureUrl', url: rec.url }); } catch (e) { /* closed */ } };
    $('wbKeep').onclick = () => { $('warnBox').hidden = true; blockedOk = true; };
  }

  // 4.15 idea 2: when this page was captured from a copy in Copies found, look for the client's
  // photo on the captured screens (the same picture check as Copies found, in a background worker).
  oursJob = findOurs(rec).catch(() => null);

  // "Copy": put the whole capture on the clipboard, to paste into an email, chat or document.
  $('copy').disabled = false;
  $('copy').onclick = async () => {
    const before = $('status').textContent;
    try {
      if (!navigator.clipboard || !window.ClipboardItem) throw new Error('this browser cannot copy pictures');
      setStatus('Copying...');
      // Passing the picture as a "promise" keeps the browser's permission to copy while it is being made.
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': toBlob(fullCanvas().c, 'image/png') })]);
      setStatus('Copied! Paste it (Ctrl+V, or Cmd+V on a Mac) into an email, chat or document. To copy just part of the page, use Markup, then "Pick area".');
    } catch (e) { setStatus('Could not copy the picture (' + e.message + '). Use Markup, then "Download picture" instead.', true); }
    setTimeout(() => { if ($('status').textContent.startsWith('Copied!')) setStatus(before); }, 12000);
  };

  // "Markup": hand a copy of the finished picture to the mark-up page. The evidence files are not touched.
  $('markup').disabled = false;
  $('markup').onclick = async () => {
    $('markup').disabled = true;
    try {
      const { c, k } = fullCanvas();
      await PP_DB.put({ id: 'markup', blob: await toBlob(c, 'image/png'), meta: {
        name: base, url: rec.url, host, captured: formatTime(rec), captureId: rec.captureId, scale: s * k } });
      const url = 'markup.html?from=capture';
      try { await api.tabs.create({ url: api.runtime.getURL(url) }); } catch (e) { window.open(url, '_blank'); }
    } catch (e) { setStatus('Could not open the mark-up page: ' + e.message, true); }
    $('markup').disabled = false;
  };

  const notes = [...rec.notes];
  if (rec.sections.length) notes.push(rec.sections.length + ' extra section' + (rec.sections.length > 1 ? 's' : '') + ' (scroll boxes and dropdown lists) added at the bottom.');
  setStatus(notes.join(' '));

  // Make the PDF right away so every file is ready for the evidence pack.
  const pageH = Math.round(plan.W * 1.4142); // A4 shape
  const pages = [];
  for (let y0 = 0; y0 < plan.H; y0 += pageH) {
    const h = Math.min(pageH, plan.H - y0);
    const jpg = await toBlob(renderSlice(plan, y0, h), 'image/jpeg', 0.92);
    pages.push({ jpeg: await bytesOf(jpg), width: plan.W, height: h });
  }
  proof('pfPage', 'ok', 'Whole page captured' + (rec.sections.length ? ', plus ' + rec.sections.length + ' scroll box' + (rec.sections.length > 1 ? 'es' : '') : ''));
  let pdf = makePdf(pages, { title: 'PageProof capture of ' + host, subject: rec.url + ' captured ' + rec.time });
  $('pdf').disabled = false;
  $('pdf').onclick = () => download(pdf, base + '.pdf');

  // HTML backup with every picture stored inside it.
  let saved = null;
  const buildHtml = async () => {
    const label = $('html').lastChild;
    label.textContent = 'Saving...';
    saved = await PP_ARCHIVE(rec, n => { label.textContent = 'Saving ' + n + '...'; });
    label.textContent = 'HTML';
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
  proof('pfPics', saved.failed.length ? 'part' : 'ok', saved.images.length
    ? saved.images.length + ' picture' + (saved.images.length > 1 ? 's' : '') + ' saved' + (saved.failed.length ? ' (' + saved.failed.length + ' file' + (saved.failed.length > 1 ? 's' : '') + ' could not be)' : '')
    : 'No pictures on this page to save');
  if (saved.failed.length) notes.push(saved.failed.length + ' file' + (saved.failed.length > 1 ? 's' : '') + ' could not be saved into the HTML backup (they are listed in capture-details.txt).');
  setStatus(notes.join(' '));

  // Hidden data (camera, date, author, copyright...) inside every picture saved from the page.
  let imageData = null;
  if (saved.images.length) {
    setStatus([...notes, 'Reading the hidden data in ' + saved.images.length + ' picture' + (saved.images.length > 1 ? 's' : '') + '...'].join(' '));
    const results = [];
    for (const [i, img] of saved.images.entries()) {
      let meta = null;
      try { meta = await PP_META.read(img.bytes); } catch (e) { /* not a picture we can read */ }
      results.push({ name: imageName(img, i), url: img.url, meta });
    }
    const withData = results.filter(r => r.meta && r.meta.summary.level !== 'none');
    const owners = results.filter(r => r.meta && r.meta.summary.namesOwner);
    const ai = results.filter(r => r.meta && r.meta.summary.ai.length);
    const line = withData.length + ' of ' + results.length + ' picture' + (results.length > 1 ? 's' : '') + ' still ' + (withData.length === 1 ? 'has' : 'have') + ' hidden data' +
      (owners.length ? ', ' + owners.length + ' name' + (owners.length === 1 ? 's' : '') + ' an author or copyright owner' : '') +
      (ai.length ? ', ' + ai.length + ' show' + (ai.length === 1 ? 's' : '') + ' signs of AI' : '') + '.';
    const text = ['HIDDEN DATA IN THE PICTURES SAVED FROM THIS PAGE', '='.repeat(48), '', 'Page: ' + rec.url, 'Capture ID: ' + (rec.captureId || '-'), line, '',
      'Pictures with hidden data are listed first, with everything found. The images/ folder holds the files themselves.', '',
      ...[...withData, ...results.filter(r => !withData.includes(r))].map(r => r.meta
        ? PP_META.toText(r.meta, { title: r.name, url: r.url, brief: r.meta.summary.level === 'none' })
        : r.name + '\r\n  (not a picture file PageProof can read)\r\n  Found at: ' + r.url + '\r\n')].join('\r\n');
    imageData = { line, text };
    notes.push('Pictures: ' + line);
    setStatus(notes.join(' '));

    // Add a page (or more) about it at the end of the PDF.
    try {
      const S = r => r.meta.summary;
      const items = [{ p: line, bold: true }, { p: 'Cameras, phones and editing programs store details inside picture files. Many websites remove them when pictures are uploaded, so "none" is common. Every picture file is in the images/ folder of the evidence pack, and everything found is listed in image-data.txt.', color: '#475569' }];
      for (const r of withData.slice(0, 60)) items.push({ h: r.name.replace(/^images\//, '') }, { kv: [
        ['In short', S(r).sentence],
        ['Found at', r.url.startsWith('data:') ? '(stored inside the page)' : r.url],
        ['Camera', [S(r).camera, S(r).lens].filter(Boolean).join(' · ')], ['Taken', S(r).taken],
        ['Place (GPS)', S(r).gps ? S(r).gps.lat + ', ' + S(r).gps.lon : ''], ['Edited with', S(r).software],
        ['Creator', S(r).creator, !!S(r).creator], ['Copyright', S(r).copyright, !!S(r).copyright], ['Credit line', S(r).credit, !!S(r).credit],
        ['Usage terms', S(r).terms], ['Signs of AI', S(r).ai.join('; ')], ['Size', r.meta.width ? r.meta.width + ' x ' + r.meta.height + ' ' + r.meta.format : r.meta.format]
      ] });
      if (withData.length > 60) items.push({ p: (withData.length - 60) + ' more pictures with hidden data are listed in image-data.txt.' });
      const extra = PP_REPORT.render({ title: 'Hidden data in the pictures', subtitle: [host + '  ·  ' + rec.url, 'Captured ' + formatTime(rec), 'Capture ID ' + (rec.captureId || '-') + '  ·  PageProof ' + rec.version],
        footer: 'PageProof  ·  ' + (rec.captureId || '') + '  ·  ' + host, items });
      pdf = makePdf([...pages, ...await PP_REPORT.pdfPages(extra)], { title: 'PageProof capture of ' + host, subject: rec.url + ' captured ' + rec.time });
    } catch (e) { /* the PDF without the extra page is still fine */ }
  }

  // Evidence pack: every file, its SHA-256 fingerprint, and a trusted timestamp.
  const srv = rec.server || {};
  const files = [];
  files.push({ name: base + '.pdf', blob: pdf });
  files.push({ name: base + '.html', blob: new Blob([saved.html], { type: 'text/html' }) });
  for (const f of files) f.bytes = await bytesOf(f.blob);
  if (srv.source) files.push({ name: base + '_source.html', bytes: srv.source });
  saved.images.forEach((img, i) => files.push({ name: imageName(img, i), bytes: img.bytes, url: img.url }));
  if (imageData) files.push({ name: 'image-data.txt', bytes: new TextEncoder().encode(imageData.text) });
  // TikTok photo posts: the link of every picture (slide) in the post.
  if (rec.slides && rec.slides.slides && rec.slides.slides.length) {
    const sl = rec.slides, exp = sl.slides.map(x => { try { return parseInt(new URL(x.url).searchParams.get('x-expires'), 10); } catch (e) { return 0; } }).find(n => n > 1e9);
    files.push({ name: 'post-pictures.txt', bytes: new TextEncoder().encode(['PICTURES IN THIS POST', '='.repeat(21), '', 'Post: ' + rec.url, 'Capture ID: ' + (rec.captureId || '-'), sl.of + ' picture' + (sl.of > 1 ? 's' : '') + (sl.on ? ', picture ' + sl.on + ' was on screen when captured' : ''), '',
      ...sl.slides.map(x => 'Picture ' + x.n + ' of ' + sl.of + (x.w ? ' (' + x.w + ' x ' + x.h + ')' : '') + '\r\n  ' + x.url + '\r\n'),
      exp ? 'The site signs these links, so they stop working on ' + new Date(exp * 1000).toUTCString() + '. The picture files themselves are in the images/ folder.' : 'The picture files themselves are in the images/ folder.'].join('\r\n')) });
  }
  const hosting = await hostingJob;
  if (hosting) {
    for (const f of hosting.files) files.push({ name: f.name, bytes: new TextEncoder().encode(f.text) });
    showHosting(hosting);
  }
  files.push({ name: 'VERIFY-THIS-PACK.html', bytes: new TextEncoder().encode(await standaloneChecker()) });
  for (const f of files) f.hash = await sha256(f.bytes);

  // One list of all fingerprints (the standard "sha256sum" format), which is what gets timestamped.
  const fpText = files.map(f => f.hash + '  ' + f.name).join('\n') + '\n';
  const fpBytes = new TextEncoder().encode(fpText);
  const fpHash = await sha256(fpBytes);
  proof('pfPrint', 'ok', 'Fingerprints made for ' + files.length + ' files');
  setStatus([...notes, 'Getting trusted timestamps...'].join(' '));
  const stamps = await PP_TSA.stampAll(new Uint8Array(await crypto.subtle.digest('SHA-256', fpBytes)));
  const good = stamps.filter(t => !t.error);
  proof('pfStamp', !good.length ? 'bad' : good.length < stamps.length ? 'part' : 'ok',
    good.length ? good.length + ' of ' + stamps.length + ' trusted timestamps' : 'No trusted timestamp (services did not answer)');
  if (!good.length) notes.push('No trusted timestamp could be added (' + stamps.map(t => t.service + ': ' + t.error).join('; ') + '). Everything else is saved.');
  else if (good.length < stamps.length) notes.push('Timestamped by ' + good.map(t => t.service).join(' and ') + ' (' + stamps.filter(t => t.error).map(t => t.service).join(', ') + ' did not answer).');
  setStatus(notes.join(' '));
  // 4.15 idea 5: the trusted timestamps carry the time servers' own clocks. If this computer's
  // clock is more than 2 minutes off, the times written in the pack won't match them.
  for (const t of good) {
    const signed = Date.parse(String(t.time || '').replace(' ', 'T').replace(/(\d)$/, '$1Z'));
    if (!isFinite(signed) || !t.askedAt || t.rtt > 10000) continue;
    const off = Math.round((t.askedAt - signed) / 1000);   // + = this computer is ahead
    try { await api.storage.local.set({ ppClockOff: { off, at: Date.now(), by: t.service } }); } catch (e) { /* fine */ }
    if (Math.abs(off) > 120) clockOff = off;
    break;
  }
  if (clockOff) {
    const mins = Math.round(Math.abs(clockOff) / 60);
    notes.push('This computer\'s clock is ' + mins + ' minute' + (mins === 1 ? '' : 's') + (clockOff > 0 ? ' fast' : ' slow') + ' compared with the trusted timestamp. The timestamp is the time to rely on.');
    setStatus(notes.join(' '));
  }


  const detailsText = () => {
    const c = { collector: $('collector').value.trim(), caseRef: $('caseRef').value.trim(), notes: $('caseNotes').value.trim() };
    const lines = [
      'PAGEPROOF CAPTURE RECORD',
      '========================',
      '',
      'Capture ID:    ' + (rec.captureId || '(none)'),
      'Web address:   ' + rec.url,
      'Domain:        ' + host,
      'Page title:    ' + (rec.title || '(none)'),
      'Captured:      ' + formatTime(rec),
      'Captured UTC:  ' + rec.time,
      'Time zone:     ' + zoneLabel(rec),
      'Window size:   ' + rec.viewWidth + ' x ' + rec.viewHeight + ' (screen scale ' + (Math.round(s * 100) / 100) + ')',
      'Browser:       ' + rec.userAgent,
      'Tool:          PageProof ' + rec.version,
      '',
      'CASE DETAILS',
      'Collected by:  ' + (c.collector || '(not entered)'),
      'Case / ref:    ' + (c.caseRef || '(not entered)'),
      'Notes:         ' + (c.notes ? c.notes.replace(/\r?\n/g, '\r\n               ') : '(none)'),
      'Pack saved:    ' + new Date().toISOString() + ' (UTC)',
      '',
      'WEBSITE SERVER (asked again at ' + (srv.requestedAt || '?') + ' UTC)',
      ...(srv.error ? ['Could not reach the server: ' + srv.error] : [
        'Server IP:     ' + (srv.ip || '(not reported by the browser)'),
        'Response:      ' + srv.status,
        'Final address: ' + srv.finalUrl,
        'Page source:   ' + (srv.source ? base + '_source.html (' + srv.sourceBytes + ' bytes, exactly as sent by the server)' : '(too large to save)'),
        'Response headers:',
        ...(srv.headers || []).map(([k, v]) => '  ' + k + ': ' + v)
      ]),
      '',
      'TRUSTED TIMESTAMPS',
      'What was signed: the SHA-256 of fingerprints.sha256 = ' + fpHash,
      ...stamps.flatMap(t => t.error
        ? [t.service + ': not available (' + t.error + ')']
        : [t.service + ': signed ' + (t.time || '(see receipt)') + ' UTC  ->  timestamps/' + t.file + '.tsr  (' + t.url + ')']),
      'How to check: see "How to check by hand" in README.txt,',
      'or open the PageProof "Verify a pack" page and drop this zip on it.',
      '',
      ...hostingLines(hosting),
      ...(imageData ? ['HIDDEN DATA IN THE PICTURES', imageData.line, 'Everything found is in image-data.txt.', ''] : []),
      'HOW THE CAPTURE WAS TAKEN',
      ...(rec.notes.length ? rec.notes.map(n => '- ' + n) : ['- The page was captured from the top, one screen at a time, exactly as shown.']),
      '',
      'Extra sections captured: ' + (rec.sections.length ? '' : 'none'),
      ...rec.sections.map(x => '  Section ' + x.n + ' (' + (x.kind || 'scroll') + '): ' + x.label),
      '',
      'FILES AND SHA-256 FINGERPRINTS',
      'If a file is changed in any way, its fingerprint will no longer match.',
      '',
      ...files.flatMap(f => [f.hash + '  ' + f.name, ...(f.url ? ['    original: ' + f.url] : [])]),
      ...(saved.failed.length ? ['', 'COULD NOT BE SAVED (blocked or removed by the website):', ...saved.failed.map(u => '  ' + u)] : []),
      ''
    ];
    return { text: lines.join('\r\n'), c };
  };
  showDetails = () => { $('details').textContent = detailsText().text; };
  ['collector', 'caseRef', 'caseNotes'].forEach(id => $(id).addEventListener('input', showDetails));
  showDetails();
  $('detailsBox').hidden = false;

  $('pack').disabled = false;
  pill.className = 'pill';
  pill.textContent = '\u2714 Captured';
  const savePack = async auto => {
    const { text, c } = detailsText();
    const extra = [
      { name: 'fingerprints.sha256', bytes: fpBytes },
      ...good.flatMap(t => [{ name: 'timestamps/' + t.file + '.tsr', bytes: t.reply }, { name: 'timestamps/' + t.file + '.tsq', bytes: t.query }]),
      { name: 'capture-details.txt', bytes: new TextEncoder().encode(text) },
      { name: 'README.txt', bytes: new TextEncoder().encode(ppReadme({ captureId: rec.captureId, version: rec.version, url: rec.url, time: rec.time, base,
        hasSource: !!srv.source, imageCount: saved.images.length, imageData: imageData && imageData.line, postPictures: rec.slides && rec.slides.of, stamps: good, notes: rec.notes, hasLookups: !!(hosting && hosting.files && hosting.files.length) })) }
    ];
    const zip = PP_ZIP([...files, ...extra].map(f => ({ name: f.name, bytes: f.bytes })), new Date(rec.time));
    // Name: CaseID_domain_date_time_CaptureID.zip (case ID first when entered).
    const zipName = (c.caseRef ? c.caseRef.replace(/[^\w.-]+/g, '_').slice(0, 40) + '_' : '') + when + '.zip';
    if (auto && api.downloads) {
      // Batch captures go straight into a folder per case: Downloads/PageProof/<case>/
      const folder = 'PageProof/' + ((c.caseRef || 'No case').replace(/[^\w.-]+/g, '_').slice(0, 40));
      const href = URL.createObjectURL(zip);
      await api.downloads.download({ url: href, filename: folder + '/' + zipName, saveAs: false, conflictAction: 'uniquify' });
      setTimeout(() => URL.revokeObjectURL(href), 120000);
    } else download(zip, zipName);
    const zipHash = await sha256(await bytesOf(zip));
    try {
      await api.storage.local.set({ lastCase: { collector: c.collector } });
      const { log = [] } = await api.storage.local.get('log');
      const entry = log.find(e => e.id === rec.id) || (log.push({ id: rec.id, time: rec.time, url: rec.url, title: rec.title }), log[log.length - 1]);
      (entry.saves = entry.saves || []).push({ at: new Date().toISOString(), file: zipName, sha256: zipHash, ...c,
        timestamps: good.map(t => t.service + ' ' + (t.time || '')).join('; ') });
      await api.storage.local.set({ log });
    } catch (e) { /* log is a convenience */ }
    const rep = auto ? false : await askMatchReport(c.caseRef, rec);
    setStatus('Saved ' + zipName + '. Its fingerprint (' + zipHash.slice(0, 16) + '...) is in your capture log.' + (rep ? ' The match report PDF (the copy PageProof found) is being saved as its own file.' : ''));
    return zipName;
  };
  $('pack').onclick = async () => { if (await readyToSave()) savePack(false); };
  ['caseRef', 'collector'].forEach(id => $(id).addEventListener('input', () => $(id).classList.remove('miss')));

  // Batch mode: fill in the case details, save, report back, close.
  if (params.get('auto')) {
    $('collector').value = params.get('collector') || $('collector').value;
    $('caseRef').value = params.get('case') || $('caseRef').value;
    $('caseNotes').value = params.get('notes') || '';
    const zipName = await savePack(true);
    await reportBatch({ ok: true, zipName });
    setTimeout(async () => { try { const me = await api.tabs.getCurrent(); await api.tabs.remove(me.id); } catch (e) { /* leave open */ } }, 3000);
  }

  // Keep only the 10 most recent captures so the browser doesn't fill up.
  const keys = (await PP_DB.keys()).filter(k => String(k).startsWith('cap-')).sort();
  for (const k of keys.slice(0, -10)) await PP_DB.del(k);
}

// Tell the batch capture page how this one went.
async function reportBatch(info) {
  if (!params.get('batch')) return;
  try { await api.runtime.sendMessage({ type: 'packDone', batch: params.get('batch'), idx: +params.get('idx'), ...info }); } catch (e) { /* batch page closed */ }
}

start().catch(err => {
  setStatus('Something went wrong: ' + err.message, true);
  reportBatch({ ok: false, error: err.message });
});

// 4.5: this page was captured from a copy in Copies found. After its pack is saved, ask PageProof
// to save that copy's Evidence report (the match PageProof found) as its own PDF, with the same
// case number. An open PageProof tab makes it; if none is open, one is opened.
async function askMatchReport(caseNo, rec) {
  try {
    const api = globalThis.browser || globalThis.chrome;
    const { fcCapFor: f } = await api.storage.local.get('fcCapFor');
    const same = (a, b) => String(a || '').replace(/[#].*$/, '').replace(/\/$/, '') === String(b || '').replace(/[#].*$/, '').replace(/\/$/, '');
    if (!f || Date.now() - f.at > 6 * 3600000) return false;
    // the same address, or a capture started within 3 minutes of clicking Capture (sites redirect)
    if (!same(f.url, rec.url) && !(Math.abs(new Date(rec.time) - f.at) < 180000)) return false;
    await api.storage.local.set({ fcReportReq: { id: f.id, caseNo: caseNo || '', at: Date.now() } });
    const open = await api.runtime.sendMessage({ type: 'ppAppHere' }).catch(() => false);
    if (!open) await api.tabs.create({ url: api.runtime.getURL('app.html#found'), active: false });
    return true;
  } catch (e) { return false; }
}

// ---------- 4.15: "Before you save" (Ben's idea 1) ----------
// Pressing Save evidence pack checks what people forget. If all is fine it saves straight away.
// Otherwise a short list shows, one fix button per line, and "Save anyway". Asked once per capture.
async function readyToSave() {
  const $ = id => document.getElementById(id);
  if (checkedOnce) return true;
  const issues = [];
  if (!$('caseRef').value.trim()) issues.push(['case', 'The case number is empty', 'Add case number']);
  if (!$('collector').value.trim()) issues.push(['name', 'Collected by (your name) is empty', 'Add your name']);
  const blockedNow = !$('warnBox').hidden && !blockedOk;
  if (blockedNow) issues.push(['blocked', 'It may not be the real page (see the red box above)', '']);
  const ours = oursJob ? await Promise.race([oursJob, new Promise(r => setTimeout(() => r({ state: 'busy' }), 1500))]) : null;
  if (ours && ours.state === 'missing') issues.push(['ours', 'Your client\'s photo was not found on the capture', '']);
  if (clockOff) issues.push(['clock', 'This computer\'s clock is ' + Math.round(Math.abs(clockOff) / 60) + ' minutes ' + (clockOff > 0 ? 'fast' : 'slow'), '']);
  if (!issues.length) return true;
  const box = $('checkBox');
  const good = [];
  if ($('collector').value.trim()) good.push('Collected by: ' + $('collector').value.trim());
  if (ours && ours.state === 'found') good.push('Your photo is on the capture (screen ' + ours.screen + ')');
  box.innerHTML = '<b>Before you save</b><ul></ul><div class="row"><button id="ckAnyway">Save anyway</button></div>';
  const ul = box.querySelector('ul');
  for (const [k, text, fix] of issues) {
    const li = document.createElement('li');
    li.innerHTML = '<span class="no">!</span><span style="flex:1"></span>';
    li.children[1].textContent = text;
    if (fix) { const b = document.createElement('button'); b.className = 'go'; b.textContent = fix; b.onclick = () => { const f = $(k === 'case' ? 'caseRef' : 'collector'); f.classList.add('miss'); f.focus(); }; li.append(b); }
    ul.append(li);
  }
  for (const g of good) { const li = document.createElement('li'); li.innerHTML = '<span class="ok">✔</span><span></span>'; li.children[1].textContent = g; ul.append(li); }
  box.hidden = false;
  checkedOnce = true;   // the next press of Save saves (after a fix, or as it is)
  $('ckAnyway').onclick = () => { box.hidden = true; document.getElementById('pack').click(); };
  const first = issues.find(i => i[2]);
  if (first) { const f = $(first[0] === 'case' ? 'caseRef' : 'collector'); f.classList.add('miss'); f.focus(); }
  return false;
}

// ---------- 4.15: is the client's photo on this capture? (Ben's idea 2) ----------
async function findOurs(rec) {
  const api = globalThis.browser || globalThis.chrome;
  const $ = id => document.getElementById(id);
  const { fcCapFor: f } = await api.storage.local.get('fcCapFor');
  const same = (a, b) => String(a || '').replace(/[#].*$/, '').replace(/\/$/, '') === String(b || '').replace(/[#].*$/, '').replace(/\/$/, '');
  if (!f || !f.pic || Date.now() - f.at > 6 * 3600000) return null;
  if (!same(f.url, rec.url) && !(Math.abs(new Date(rec.time) - f.at) < 180000)) return null;
  $('pfOurs').hidden = false;
  let worker = null;
  try {
    const orig = await createImageBitmap(await (await fetch(f.pic)).blob());
    worker = new Worker('score-worker.js');
    let n = 0;
    const ask = bmp => new Promise(res => {
      const id = ++n;
      const t = setTimeout(() => res(null), 30000);
      worker.addEventListener('message', function on(e) { if (e.data.id !== id) return; clearTimeout(t); worker.removeEventListener('message', on); res(e.data.out); });
      worker.postMessage({ type: 'check', id, key: 'ours', bmp }, [bmp]);
    });
    worker.postMessage({ type: 'orig', key: 'ours', bmp: orig }, [orig]);
    const tiles = [...rec.main.tiles, ...rec.sections.flatMap(x => x.tiles)];
    for (const [i, t] of tiles.entries()) {
      if (!t.bmp) continue;
      const k = Math.min(1, 1100 / Math.max(t.bmp.width, t.bmp.height));
      const b = await createImageBitmap(t.bmp, { resizeWidth: Math.max(1, Math.round(t.bmp.width * k)), resizeHeight: Math.max(1, Math.round(t.bmp.height * k)), resizeQuality: 'high' });
      const o = await ask(b);
      if (o && o.lines >= 0.45 && o.inliers >= 10 && (o.matched || 0) >= 12 && (o.strength || 0) >= 0.7 && !o.backdrop) {
        const screen = i < rec.main.tiles.length ? i + 1 : 'in a scroll box';
        proof('pfOurs', 'ok', 'Your photo is on the capture (' + (typeof screen === 'number' ? 'screen ' + screen : screen) + ', ' + Math.round(o.lines * 100) + '% lines up)');
        return { state: 'found', screen };
      }
    }
    proof('pfOurs', 'part', 'Your client\'s photo was not found on the capture. It may have been taken down, sit in a slider, or not have loaded.');
    return { state: 'missing' };
  } catch (e) {
    proof('pfOurs', 'part', 'Could not check for your photo on the capture');
    return null;
  } finally { if (worker) worker.terminate(); }
}
