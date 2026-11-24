// The Evidence report: one PDF page for one copy (one use) of a client's photo.
// The client's photo (solid blue edge) and their copy (dashed orange) side by side, the answer
// first, where and when it was found, the copyright registration, the hidden data compared,
// who is behind the site (only facts actually found), and SHA-256 fingerprints of both files.
// Their copy is downloaded again when the report is made, so it shows what is online now.
// Always printed light. Needs pdf.js, report.js and meta.js on the page.
const PP_EVIDENCE = (() => {
  const api = globalThis.browser || globalThis.chrome;
  const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  const sha256 = async bytes => hex(await crypto.subtle.digest('SHA-256', bytes));
  const niceBytes = n => n >= 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' kB';
  const dayText = d => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  const nowText = d => d.toLocaleString(undefined, { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  const ENG = { google: 'Google Lens', yandex: 'Yandex', bing: 'Bing' };
  const matchId = async (hash, url) => 'PP-S-' + (await sha256(new TextEncoder().encode(hash + '|' + url))).slice(0, 8).toUpperCase();

  async function grab(urls) {
    for (const [u, which] of urls) {
      if (!u) continue;
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
        const r = await fetch(u, { credentials: 'omit', signal: ctl.signal });
        clearTimeout(t);
        if (!r.ok) continue;
        const bytes = new Uint8Array(await r.arrayBuffer());
        if (bytes.length > 40e6) continue;
        const bmp = await createImageBitmap(new Blob([bytes]));
        let meta = null; try { meta = await PP_META.read(bytes); } catch (e) { /* not readable */ }
        return { bytes, bmp, which, src: u, meta, sha: await sha256(bytes), at: new Date() };
      } catch (e) { /* try the next one */ }
    }
    return null;
  }
  // Their copy right now (the full picture, else the search site's preview).
  const grabCopy = async c => grab([[c.img, 'full'], [typeof FC !== 'undefined' ? await FC.thumbOf(c) : c.thumb, 'preview']]);

  // Does their copy still carry the photographer / copyright line that the client's photo has?
  function credit(om, cm) {
    const had = om && (om.copyright || om.creator || om.credit);
    if (!had) return '';
    if (!cm) return '';
    const keeps = cm.copyright || cm.creator || cm.credit;
    return keeps ? 'kept' : 'removed';
  }

  // ours: { blob, name, w, h, hash, client, path, reg, use }
  // copy: { url, site, title, img, thumb, engines, firstSeen, lastSeen, times, by, match, pct, inl, mid, w, h, online }
  // opts: { caseNo, collector, owner: { name, kind, how[], clues[] }, report: true }
  async function page(ours, copy, opts = {}) {
    const W = 1240, H = 1754, M = 64, G = 32, CW = (W - 2 * M - G) / 2;
    const c = new OffscreenCanvas(W, H), x = c.getContext('2d');
    const FONT = 'system-ui, "Segoe UI", Arial, sans-serif';
    const font = (px, bold) => { x.font = (bold ? 'bold ' : '') + px + 'px ' + FONT; };
    const wrap = (t, maxW, maxLines = 6) => {
      const out = []; let line = '';
      for (const word of String(t || '').split(/(\s+)/)) {
        if (x.measureText(line + word).width <= maxW) { line += word; continue; }
        if (line.trim()) { out.push(line.trim()); line = ''; }
        let w = word.trimStart();
        while (x.measureText(w).width > maxW) { let k = w.length; while (k > 1 && x.measureText(w.slice(0, k)).width > maxW) k--; out.push(w.slice(0, k)); w = w.slice(k); }
        line = w;
      }
      if (line.trim()) out.push(line.trim());
      if (out.length > maxLines) { out.length = maxLines; out[maxLines - 1] += '…'; }
      return out;
    };
    const INK = '#111827', MUTED = '#4B5563', BLUE = '#2A4BE0', ORANGE = '#C2410C', RED = '#B91C1C', GREEN = '#047857', LINE = '#D1D5DB';
    // A table: label column + one or two value columns. Returns the new y.
    const table = (y, title, rows, cols) => {
      rows = rows.filter(r => r && r[1]);
      if (!rows.length || y > H - 180) return y;      // never runs into the footer
      font(21, true); x.fillStyle = INK; x.fillText(title, M, y); y += 14;
      x.strokeStyle = LINE; x.lineWidth = 1.5; x.beginPath(); x.moveTo(M, y); x.lineTo(W - M, y); x.stroke(); y += 26;
      const LW = 230;
      for (const r of rows) {
        const [k, ...vals] = r;
        font(16, true); x.fillStyle = MUTED; x.fillText(k, M, y);
        let lines = 1;
        const n = cols || 1, cw = (W - 2 * M - LW) / n;
        vals.slice(0, n).forEach((v, i) => {
          const val = v && typeof v === 'object' ? v : { t: v };
          x.fillStyle = val.color || INK; font(val.mono ? 14 : 16, !!val.bold);
          if (val.mono) x.font = (val.bold ? 'bold ' : '') + '14px ui-monospace, Consolas, monospace';
          const ls = wrap(val.t, cw - 12, val.max || 4);
          ls.forEach((t, j) => x.fillText(t, M + LW + i * cw, y + j * 22));
          lines = Math.max(lines, ls.length);
        });
        y += lines * 22 + 10;
      }
      return y + 14;
    };

    const copyNow = await grabCopy(copy);
    let om = ours.meta;
    if (om === undefined) { try { om = (await PP_META.read(new Uint8Array(await ours.blob.arrayBuffer()))).summary; } catch (e) { om = null; } }
    const cm = copyNow && copyNow.meta ? copyNow.meta.summary : null;
    const cr = credit(om, cm);
    const id = await matchId(ours.hash, copy.url), made = new Date();
    const same = copy.match === 'same';

    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    // Header: logo, title, case details on the right.
    x.fillStyle = BLUE; x.beginPath(); x.roundRect ? x.roundRect(M, 52, 54, 54, 12) : x.rect(M, 52, 54, 54); x.fill();
    x.strokeStyle = '#fff'; x.lineWidth = 5; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(M + 16, M + 15); x.lineTo(M + 24, M + 23); x.lineTo(M + 39, M + 6); x.stroke();
    font(15, true); x.fillStyle = '#6B7280'; x.fillText('PAGEPROOF · EVIDENCE OF USE', M + 74, 70);
    font(30, true); x.fillStyle = INK;
    x.fillText(wrap((same ? 'Same photo found on ' : 'Possible copy found on ') + copy.site, 640, 1)[0], M + 74, 104);
    font(15); x.fillStyle = MUTED; x.textAlign = 'right';
    const metaLines = [opts.caseNo ? 'Case ' + opts.caseNo : 'No case number', 'Match ID ' + id, nowText(made), opts.collector ? 'Collected by ' + opts.collector : ''].filter(Boolean);
    metaLines.forEach((t, i) => { font(15, i < 2); x.fillText(t, W - M, 66 + i * 21); });
    x.textAlign = 'left';
    let y = 160;

    // The answer first.
    const vb = [same ? 'Same photo' : 'Possible copy'];
    x.fillStyle = same ? '#FEF2F2' : '#FFFBEB'; x.strokeStyle = same ? RED : '#B45309'; x.lineWidth = 2;
    x.beginPath(); x.roundRect ? x.roundRect(M, y, W - 2 * M, 74, 12) : x.rect(M, y, W - 2 * M, 74); x.fill(); x.stroke();
    font(30, true); x.fillStyle = same ? RED : '#92400E'; x.fillText(vb[0], M + 24, y + 47);
    let vx = M + 24 + x.measureText(vb[0]).width + 34;
    font(18); x.fillStyle = INK;
    const bits = [];
    if (copy.pct >= 0 && copy.pct != null) bits.push(copy.pct + '% of the shared area lines up');
    const cw2 = copyNow ? copyNow.bmp.width : copy.w, ch2 = copyNow ? copyNow.bmp.height : copy.h;
    if (cw2 && ours.w) { const a = (cw2 * ch2) / (ours.w * ours.h); bits.push('Their copy is ' + (Math.abs(cw2 / ch2 - ours.w / ours.h) / (ours.w / ours.h) > 0.06 ? 'cropped' : a > 1.15 ? 'bigger' : a < 0.85 ? 'smaller' : 'the same size') + ' (' + cw2 + ' × ' + ch2 + ')'); }
    if (cr === 'removed') bits.push('Credit removed');
    for (const b of bits) { if (vx + x.measureText(b).width > W - M - 20) break; x.fillText(b, vx, y + 45); vx += x.measureText(b).width + 30; }
    y += 108;

    // The two pictures.
    const BH = 470;
    const box = async (img, x0, label, col, dashed, cap) => {
      x.fillStyle = '#F3F4F6'; x.fillRect(x0, y, CW, BH);
      if (img) { const s = Math.min((CW - 24) / img.width, (BH - 24) / img.height); const w = img.width * s, hh = img.height * s; x.drawImage(img, x0 + (CW - w) / 2, y + (BH - hh) / 2, w, hh); }
      else { font(17); x.fillStyle = MUTED; x.textAlign = 'center'; x.fillText('Their copy could not be downloaded now.', x0 + CW / 2, y + BH / 2); x.textAlign = 'left'; }
      x.strokeStyle = col; x.lineWidth = 4; x.setLineDash(dashed ? [14, 8] : []); x.strokeRect(x0 + 2, y + 2, CW - 4, BH - 4); x.setLineDash([]);
      font(16, true); x.fillStyle = col; x.fillText(label, x0, y + BH + 28);
      font(15); x.fillStyle = MUTED; wrap(cap, CW, 2).forEach((t, i) => x.fillText(t, x0, y + BH + 50 + i * 20));
    };
    const ourImg = await createImageBitmap(ours.blob);
    await box(ourImg, M, 'Your client\'s photo', BLUE, false, [ours.name, ours.client, ours.w + ' × ' + ours.h].filter(Boolean).join(' · '));
    ourImg.close && ourImg.close();
    await box(copyNow && copyNow.bmp, M + CW + G, 'Their copy', ORANGE, true, [copy.url, cw2 ? cw2 + ' × ' + ch2 : ''].filter(Boolean).join(' · '));
    y += BH + 110;

    const reg = ours.reg;
    const seen = copy.times > 1 ? 'Seen ' + copy.times + ' times, last on ' + dayText(copy.lastSeen) : 'Not yet. Copies marked stolen are checked again every week.';
    y = table(y, 'Where and when', [
      ['Page', { t: copy.url, mono: true, max: 3 }],
      copy.title ? ['Page title', copy.title] : null,
      copy.acct && copy.acct.handle ? ['Posted by', { t: copy.acct.handle + (copy.acct.url ? '  ' + copy.acct.url : ''), mono: true, max: 2 }] : null,
      copy.acctInfo && copy.acctInfo.ok ? ['The account', { t: [
        copy.acctInfo.followers != null ? copy.acctInfo.followers.toLocaleString('en-US') + ' ' + copy.acctInfo.fw + ' on ' + dayText(copy.acctInfo.at) : '',
        { blue: 'Verified', gold: 'Verified organisation', grey: 'Verified government account', no: 'Not verified' }[copy.acctInfo.verified] || '',
        copy.acctInfo.type ? copy.acctInfo.type + (copy.acctInfo.typeSure === 'guess' ? ' (going by the profile)' : '') + (copy.acctInfo.category ? ': ' + copy.acctInfo.category : '') : '',
        copy.acctInfo.company ? 'Company: ' + copy.acctInfo.company + (copy.acctInfo.address ? ', ' + copy.acctInfo.address : '') : '',
        copy.acctInfo.country ? 'Based in ' + copy.acctInfo.country : ''].filter(Boolean).join('. '), max: 3 }] : null,
      reg ? ['Registration', [reg.va ? reg.va + ' (registered)' : '', reg.app ? 'application ' + reg.app : ''].filter(Boolean).join(' · ')] : ['Registration', { t: 'No registration number found in the client\'s folders', color: MUTED }],
      ours.path ? ['Client\'s file', { t: ours.path, mono: true, max: 3 }] : null,
      copy.use ? ['How it\'s used', copy.use] : null,
      ['First seen', dayText(copy.firstSeen) + (copy.by ? ' by ' + copy.by : '') + (copy.engines && copy.engines.length ? ' (' + copy.engines.map(e => ENG[e] || e).join(', ') + ')' : '')],
      ['Seen again', seen],
    ]);
    // About this use: dates, damages, the credit line on their page and signs it was on purpose.
    const ck = opts.checks;
    if (ck) {
      const pf = ck.pf && ck.pf.ok ? ck.pf : null, dm = ck.damages;
      const dmCol = dm && dm.lvl === 'bad' ? RED : dm && dm.lvl === 'warn' ? ORANGE : dm && dm.lvl === 'ok' ? GREEN : MUTED;
      y = table(y, 'About this use', [
        ck.pub ? ['First published', dayText(ck.pub.date) + ' (from ' + ck.pub.from + ')'] : null,
        dm && dm.lvl ? ['Damages', { t: dm.title + '. ' + dm.text, color: dmCol }] : null,
        pf ? ['Credit on their page', pf.credit ? '"' + pf.credit + '"' : { t: 'No credit line next to the photo', color: MUTED }] : null,
        ck.purpose && ck.purpose.length ? ['Signs it was on purpose', { t: ck.purpose.join(' · '), color: RED }] : null,
        ck.kind ? ['Kind of site', ck.kind] : null,
      ]);
    }
    if (om || cm) {
      const rm = { t: 'Removed', color: RED, bold: true };
      const pair = (k, a, b) => a || b ? [k, a || '—', b || (a ? rm : '—')] : null;
      y = table(y, 'Hidden data compared', [
        ['', { t: 'Your client\'s', color: BLUE, bold: true }, { t: copyNow ? 'Theirs' : 'Theirs (not downloaded)', color: ORANGE, bold: true }],
        pair('Photographer', om && om.creator, cm && cm.creator), pair('Copyright', om && om.copyright, cm && cm.copyright), pair('Credit', om && om.credit, cm && cm.credit),
        pair('Camera', om && om.camera, cm && cm.camera), pair('Taken', om && om.taken, cm && cm.taken),
      ].filter(Boolean), 2);
    }
    const ow = opts.owner;
    if (ow && (ow.name || (ow.clues && ow.clues.length))) {
      y = table(y, 'Who\'s behind this site', [
        ow.name ? ['Probably run by', ow.name + (ow.kind ? ' (' + ow.kind + ')' : '')] : null,
        ow.how && ow.how.length ? ['How PageProof knows', ow.how.join(' · ')] : null,
        ...(ow.clues || []).slice(0, 5).map(cl => [cl.title, cl.value + (cl.src ? ' (' + cl.src + ')' : '')]),
      ]);
    }
    y = table(y, 'Fingerprints (SHA-256)', [
      ['Your client\'s file', { t: ours.hash, mono: true }],
      ['Their copy (today)', copyNow ? { t: copyNow.sha + (copyNow.which === 'preview' ? '  (the search site\'s preview: the full picture would not download)' : ''), mono: true } : { t: 'Could not be downloaded when this report was made', color: MUTED }],
      copyNow ? ['Downloaded from', { t: copyNow.src.startsWith('data:') ? '(shown inside the search page)' : copyNow.src, mono: true, max: 2 }] : null,
    ]);
    // Footer.
    x.strokeStyle = LINE; x.lineWidth = 1.5; x.beginPath(); x.moveTo(M, H - 70); x.lineTo(W - M, H - 70); x.stroke();
    font(14); x.fillStyle = '#6B7280';
    x.fillText('Made by PageProof ' + api.runtime.getManifest().version + ' on this computer. Nothing was uploaded. Each result was downloaded and lined up with the client\'s photo on this computer.', M, H - 44);
    x.textAlign = 'right'; x.fillText('Match ID ' + id + '  ·  Page 1 of 1', W - M, H - 22); x.textAlign = 'left';
    if (copyNow && copyNow.bmp.close) copyNow.bmp.close();
    return { canvas: c, id, credit: cr, copySha: copyNow && copyNow.sha };
  }

  // Make the PDF. Returns { blob, name, id }.
  async function make(ours, copy, opts = {}) {
    const pg = await page(ours, copy, opts);
    const jpg = await pg.canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
    const pdf = makePdf([{ jpeg: new Uint8Array(await jpg.arrayBuffer()), width: pg.canvas.width, height: pg.canvas.height }],
      { title: 'PageProof evidence report', subject: ours.name + ' found on ' + copy.url });
    const base = ours.name.replace(/\.[a-z0-9]+$/i, '').replace(/[^\w.-]+/g, '_').slice(0, 40);
    const name = 'PageProof_evidence_' + (opts.caseNo ? opts.caseNo.replace(/[^\w.-]+/g, '_') + '_' : '') + base + '_' + copy.site.replace(/[^\w.-]+/g, '_') + '_' + pg.id + '.pdf';
    return { blob: pdf, name, id: pg.id, credit: pg.credit, copySha: pg.copySha };
  }
  // Ask for the case number when saving (it is never kept in a box, so it can't be left on the
  // wrong case). Resolves with the number ('' if left empty) or null if cancelled.
  function ask(what = 'Save evidence report') {
    return new Promise(resolve => {
      const d = document.createElement('dialog');
      d.className = 'pp-ask';
      d.innerHTML = '<form method="dialog" style="display:flex;flex-direction:column;gap:12px;min-width:min(420px,86vw)">' +
        '<b style="font-size:18px"></b><label style="display:flex;flex-direction:column;gap:6px;font-size:14px;font-weight:600">Case number <span style="font-weight:400;opacity:.75">from the legal portal. Leave it empty if there is none yet.</span>' +
        '<input name="c" autocomplete="off" style="font:inherit;font-size:16px;padding:9px 12px;border-radius:10px;border:1px solid var(--line,#ccd);background:var(--surface,#fff);color:var(--ink,#111)"></label>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end"><button value="cancel" type="submit" class="btn">Cancel</button><button value="ok" type="submit" class="btn primary">Save</button></div></form>';
      d.querySelector('b').textContent = what;
      d.style.cssText = 'border:1px solid var(--line,#ccd);border-radius:16px;padding:22px;background:var(--surface,#fff);color:var(--ink,#111);box-shadow:0 20px 60px rgba(0,0,0,.35)';
      document.body.appendChild(d);
      const input = d.querySelector('input');
      d.addEventListener('close', () => { const v = d.returnValue === 'ok' ? input.value.trim().slice(0, 80) : null; d.remove(); resolve(v); });
      d.showModal(); input.focus();
    });
  }
  return { make, matchId, grabCopy, credit, ask };
})();
