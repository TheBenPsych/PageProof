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

// One self-contained copy of the "Verify a pack" page, placed inside every evidence pack
// so anyone can double-click it to check the pack, even without PageProof.
async function standaloneChecker() {
  const text = async f => (await fetch(f)).text();
  let html = await text('verify.html');
  const icon = await (await fetch('icons/icon48.png')).blob();
  const iconUrl = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(icon); });
  const inline = async f => '<script>\n' + (await text(f)).replace(/<\/script/gi, '<\\/script') + '\n</script>';
  const css = await text('viewer.css');
  html = html.replace('<link rel="stylesheet" href="viewer.css">', () => '<style>\n' + css + '\n</style>');
  html = html.replace('<link rel="icon" href="icons/icon32.png">', () => '<link rel="icon" href="' + iconUrl + '">');
  html = html.replace('src="icons/icon48.png"', () => 'src="' + iconUrl + '"');
  html = html.replace(/<a class="link" href="log\.html"[^>]*>[^<]*<\/a>/, '');
  const themeJs = await inline('theme.js');
  html = html.replace('<script src="theme.js"></script>', () => '<script>window.PP_STANDALONE = true;</script>\n' + themeJs);
  for (const f of ['unzip.js', 'tsverify.js', 'verify.js']) { const js = await inline(f); html = html.replace('<script src="' + f + '"></script>', () => js); }
  html = html.replace('Check that an evidence pack hasn\'t been changed since it was made', 'Check that this evidence pack hasn\'t been changed since it was made. Nothing leaves your computer.');
  return html;
}

// Plain-text summary of who hosts the site, for capture-details.txt.
function hostingLines(h) {
  if (!h) return [];
  const contact = c => c ? [c.name, ...c.emails, ...c.phones].filter(Boolean).join(', ') : '(not listed)';
  const lines = ['WHO HOSTS THIS SITE (public RDAP/WHOIS records, looked up ' + new Date().toISOString() + ')'];
  if (h.ip) lines.push(
    'Hosting company: ' + (h.ip.host || h.ip.network || '(not listed)') + (h.ip.country ? ' (' + h.ip.country + ')' : ''),
    'Server network:  ' + h.ip.network + '  ' + h.ip.range,
    'Host abuse contact: ' + contact(h.ip.abuse));
  else if (h.ipError) lines.push('Hosting company: lookup failed (' + h.ipError + ')');
  if (h.domain) lines.push(
    'Domain:          ' + h.domain.name + (h.domain.created ? ', registered ' + h.domain.created.slice(0, 10) : '') + (h.domain.expires ? ', expires ' + h.domain.expires.slice(0, 10) : ''),
    'Registrar:       ' + (h.domain.registrar || '(not listed)'),
    'Registrar abuse contact: ' + contact(h.domain.registrarAbuse),
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
  const t = document.createElement('strong');
  t.textContent = 'Who hosts this site (for takedown notices)';
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
  const when = host + '_' + stamp(new Date(rec.time)) + (rec.captureId ? '_' + rec.captureId : '');
  const base = 'PageProof_' + when;
  document.title = 'PageProof: ' + host;
  $('domain').textContent = host;
  $('sub').textContent = rec.url + '  ·  ' + new Date(rec.time).toLocaleString();

  let showDetails = null;
  // Who hosts this site (public registration records). Runs alongside everything else.
  const hostingJob = /^https?:/.test(rec.url) ? PP_HOSTING(rec.url, (rec.server || {}).ip).catch(e => ({ files: [], domainError: e.message })) : Promise.resolve(null);

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

  // Evidence pack: every file, its SHA-256 fingerprint, and a trusted timestamp.
  const srv = rec.server || {};
  const files = [];
  files.push({ name: base + '.pdf', blob: pdf });
  files.push({ name: base + '.html', blob: new Blob([saved.html], { type: 'text/html' }) });
  for (const f of files) f.bytes = await bytesOf(f.blob);
  if (srv.source) files.push({ name: base + '_source.html', bytes: srv.source });
  saved.images.forEach((img, i) => files.push({ name: imageName(img, i), bytes: img.bytes, url: img.url }));
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
  setStatus([...notes, 'Getting trusted timestamps...'].join(' '));
  const stamps = await PP_TSA.stampAll(new Uint8Array(await crypto.subtle.digest('SHA-256', fpBytes)));
  const good = stamps.filter(t => !t.error);
  if (!good.length) notes.push('No trusted timestamp could be added (' + stamps.map(t => t.service + ': ' + t.error).join('; ') + '). Everything else is saved.');
  else if (good.length < stamps.length) notes.push('Timestamped by ' + good.map(t => t.service).join(' and ') + ' (' + stamps.filter(t => t.error).map(t => t.service).join(', ') + ' did not answer).');
  setStatus(notes.join(' '));

  // Case details: remember the collector's name and last case number for next time.
  let last = {};
  try { last = (await api.storage.local.get('lastCase')).lastCase || {}; } catch (e) { /* ignore */ }
  $('collector').value = last.collector || '';
  $('caseRef').value = last.caseRef || '';
  $('caseBox').hidden = false;

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
  const savePack = async auto => {
    const { text, c } = detailsText();
    const extra = [
      { name: 'fingerprints.sha256', bytes: fpBytes },
      ...good.flatMap(t => [{ name: 'timestamps/' + t.file + '.tsr', bytes: t.reply }, { name: 'timestamps/' + t.file + '.tsq', bytes: t.query }]),
      { name: 'capture-details.txt', bytes: new TextEncoder().encode(text) },
      { name: 'README.txt', bytes: new TextEncoder().encode(ppReadme({ captureId: rec.captureId, version: rec.version, url: rec.url, time: rec.time, base,
        hasSource: !!srv.source, imageCount: saved.images.length, stamps: good, notes: rec.notes, hasLookups: !!(hosting && hosting.files && hosting.files.length) })) }
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
      await api.storage.local.set({ lastCase: { collector: c.collector, caseRef: c.caseRef } });
      const { log = [] } = await api.storage.local.get('log');
      const entry = log.find(e => e.id === rec.id) || (log.push({ id: rec.id, time: rec.time, url: rec.url, title: rec.title }), log[log.length - 1]);
      (entry.saves = entry.saves || []).push({ at: new Date().toISOString(), file: zipName, sha256: zipHash, ...c,
        timestamps: good.map(t => t.service + ' ' + (t.time || '')).join('; ') });
      await api.storage.local.set({ log });
    } catch (e) { /* log is a convenience */ }
    setStatus('Saved ' + zipName + '. Its fingerprint (' + zipHash.slice(0, 16) + '...) is in your capture log.');
    return zipName;
  };
  $('pack').onclick = () => savePack(false);

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
  const keys = (await PP_DB.keys()).sort();
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
