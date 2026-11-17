// Convert files: shows documents and emails as pages, ready to save as PDF with the
// browser's own "Save as PDF" printer (so the text stays real, searchable text).
const CVD = (() => {
  const DOC = new Set(['docx', 'doc', 'rtf', 'odt', 'txt', 'text', 'md', 'log', 'csv', 'tsv', 'xlsx', 'xlsm', 'xls', 'ods']);

  // ---------- old binary Word (.doc): text only ----------
  async function docText(bytes) {
    await need('xlsx');
    const cfb = XLSX.CFB.read(bytes, { type: 'array' });
    const find = n => XLSX.CFB.find(cfb, n);
    const wd = find('WordDocument');
    if (!wd) throw new Error('This .doc file could not be read.');
    const w = Uint8Array.from(wd.content), v = new DataView(w.buffer);
    const flags = v.getUint16(0x0A, true), table = find((flags & 0x200) ? '1Table' : '0Table');
    const fcClx = v.getUint32(0x01A2, true), lcbClx = v.getUint32(0x01A6, true);
    let text = '';
    if (table && lcbClx) {
      const t = Uint8Array.from(table.content), tv = new DataView(t.buffer);
      let p = fcClx;
      while (t[p] === 1) p += 3 + tv.getUint16(p + 1, true);
      if (t[p] === 2) {
        const len = tv.getUint32(p + 1, true), start = p + 5, n = (len - 4) / 12;
        for (let i = 0; i < n; i++) {
          const cp0 = tv.getUint32(start + i * 4, true), cp1 = tv.getUint32(start + (i + 1) * 4, true);
          const pcd = start + (n + 1) * 4 + i * 8;
          let fc = tv.getUint32(pcd + 2, true);
          const ansi = (fc & 0x40000000) !== 0;
          if (ansi) { fc = (fc & ~0x40000000) >>> 1; for (let k = 0; k < cp1 - cp0; k++) text += String.fromCharCode(w[fc + k]); }
          else for (let k = 0; k < cp1 - cp0; k++) text += String.fromCharCode(v.getUint16(fc + k * 2, true));
        }
      }
    }
    if (!text) { const ccp = v.getUint32(0x4C, true), fcMin = v.getUint32(0x18, true); for (let k = 0; k < ccp; k++) text += String.fromCharCode(w[fcMin + k]); }
    // Remove Word's hidden field codes, keep what the reader sees.
    text = text.replace(/\x13[^\x14\x15]*\x14?([^\x15]*)\x15/g, '$1').replace(/[\x01-\x08\x0B\x0E-\x1F]/g, '');
    return text.split(/\r|\x0C/);
  }

  // ---------- RTF: a simple reader (text, bold, italic, underline, paragraphs) ----------
  function rtfToHtml(src) {
    let out = '', i = 0, para = '';
    const stack = [], st = { b: 0, i: 0, u: 0, skip: 0, uc: 1 };
    let cur = { ...st }, skipCount = 0;
    const open = () => (cur.b ? '<b>' : '') + (cur.i ? '<i>' : '') + (cur.u ? '<u>' : '');
    const close = () => (cur.u ? '</u>' : '') + (cur.i ? '</i>' : '') + (cur.b ? '</b>' : '');
    const put = t => { if (cur.skip) return; if (skipCount > 0) { skipCount--; return; } para += open() + cvEsc(t) + close(); };
    const endPara = () => { out += '<p>' + (para || '&nbsp;') + '</p>'; para = ''; };
    const SKIP = /^(fonttbl|colortbl|stylesheet|info|pict|header|footer|headerl|headerr|footerl|footerr|object|themedata|colorschememapping|datastore|latentstyles|listtable|listoverridetable|rsidtbl|generator|xmlnstbl|mmathPr|fldinst)$/;
    while (i < src.length) {
      const ch = src[i];
      if (ch === '{') { stack.push(cur); cur = { ...cur }; i++; if (src.startsWith('\\*', i)) { cur.skip = 1; } continue; }
      if (ch === '}') { cur = stack.pop() || { ...st }; i++; continue; }
      if (ch === '\\') {
        const m = /^\\([a-z]+)(-?\d+)? ?|^\\'([0-9a-f]{2})|^\\(.)/i.exec(src.slice(i, i + 40));
        if (!m) { i++; continue; }
        i += m[0].length;
        if (m[3]) { put(new TextDecoder('windows-1252').decode(new Uint8Array([parseInt(m[3], 16)]))); continue; }
        if (m[4]) { if (m[4] === '\n' || m[4] === '\r') endPara(); else if (m[4] === '~') put('\u00a0'); else if ('\\{}'.includes(m[4])) put(m[4]); else if (m[4] === 'tab') put('\t'); continue; }
        const word = m[1], n = m[2] == null ? null : +m[2];
        if (SKIP.test(word)) { cur.skip = 1; continue; }
        if (word === 'par' || word === 'line' || word === 'sect' || word === 'page') endPara();
        else if (word === 'tab') put('\t');
        else if (word === 'b') cur.b = n === 0 ? 0 : 1;
        else if (word === 'i') cur.i = n === 0 ? 0 : 1;
        else if (word === 'ul') cur.u = n === 0 ? 0 : 1;
        else if (word === 'ulnone') cur.u = 0;
        else if (word === 'plain') { cur.b = cur.i = cur.u = 0; }
        else if (word === 'uc') cur.uc = n || 0;
        else if (word === 'u') { put(String.fromCharCode(n < 0 ? n + 65536 : n)); skipCount = cur.uc; }
        else if (word === 'cell') put('\t');
        else if (word === 'row') endPara();
        else if (word === 'bullet') put('•');
        else if (word === 'emdash') put('—');
        else if (word === 'endash') put('–');
        else if (word === 'lquote') put('‘'); else if (word === 'rquote') put('’');
        else if (word === 'ldblquote') put('“'); else if (word === 'rdblquote') put('”');
        continue;
      }
      if (ch === '\r' || ch === '\n') { i++; continue; }
      let j = i; while (j < src.length && !'\\{}\r\n'.includes(src[j])) j++;
      const t = src.slice(i, j); i = j;
      if (skipCount > 0) { const cut = Math.min(skipCount, t.length); skipCount -= cut; if (t.length > cut && !cur.skip) para += open() + cvEsc(t.slice(cut)) + close(); }
      else put(t);
    }
    if (para) endPara();
    return out;
  }

  // ---------- OpenDocument text (.odt) ----------
  async function odtToHtml(bytes) {
    const files = await ppUnzip(bytes);
    const xml = files.get('content.xml');
    if (!xml) throw new Error('This .odt file could not be read.');
    const d = new DOMParser().parseFromString(new TextDecoder().decode(xml), 'application/xml');
    const pics = new Map();
    for (const [n, b] of files) if (n.startsWith('Pictures/')) pics.set(n, URL.createObjectURL(new Blob([b])));
    const walk = node => {
      let h = '';
      for (const c of node.childNodes) {
        if (c.nodeType === 3) { h += cvEsc(c.nodeValue); continue; }
        if (c.nodeType !== 1) continue;
        const n = c.localName;
        if (n === 'h') { const lv = Math.min(6, +(c.getAttribute('text:outline-level') || 1)); h += `<h${lv}>${walk(c)}</h${lv}>`; }
        else if (n === 'p') h += `<p>${walk(c) || '&nbsp;'}</p>`;
        else if (n === 'list') h += `<ul>${walk(c)}</ul>`;
        else if (n === 'list-item') h += `<li>${walk(c)}</li>`;
        else if (n === 'table') h += `<table>${walk(c)}</table>`;
        else if (n === 'table-row') h += `<tr>${walk(c)}</tr>`;
        else if (n === 'table-cell') h += `<td>${walk(c)}</td>`;
        else if (n === 's') h += '&nbsp;'.repeat(+(c.getAttribute('text:c') || 1));
        else if (n === 'tab') h += '&emsp;';
        else if (n === 'line-break') h += '<br>';
        else if (n === 'image') { const src = pics.get(c.getAttribute('xlink:href')); if (src) h += `<img src="${src}">`; }
        else if (/^(annotation|tracked-changes|sequence-decls|forms)$/.test(n)) continue;
        else h += walk(c);
      }
      return h;
    };
    const body = d.getElementsByTagNameNS('*', 'text')[0] || d.documentElement;
    return walk(body);
  }

  // ---------- spreadsheets ----------
  async function sheetsToHtml(bytes, ext) {
    await need('xlsx');
    let wb;
    try { wb = XLSX.read(bytes, { type: 'array', cellDates: true, raw: ext === 'csv' || ext === 'tsv' ? false : undefined }); }
    catch (e) { throw new Error('This spreadsheet could not be read: ' + e.message); }
    return wb.SheetNames.map((n, i) => {
      const t = XLSX.utils.sheet_to_html(wb.Sheets[n], { header: '', footer: '' });
      const tab = /<table[\s\S]*<\/table>/i.exec(t);
      return `<section class="sheet${i ? ' brk' : ''}">${wb.SheetNames.length > 1 ? `<h2>${cvEsc(n)}</h2>` : ''}${tab ? tab[0] : '<p><i>(empty)</i></p>'}</section>`;
    }).join('');
  }

  // ---------- emails (.eml) ----------
  function decodeWords(s) {
    return String(s || '').replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=(\s+(?==\?))?/gi, (_, cs, enc, txt) => {
      try {
        let bytes;
        if (enc.toUpperCase() === 'B') bytes = Uint8Array.from(atob(txt.replace(/\s/g, '')), c => c.charCodeAt(0));
        else bytes = qp(txt.replace(/_/g, ' '));
        return new TextDecoder(cs.replace(/\*.*$/, '')).decode(bytes);
      } catch (e) { return txt; }
    });
  }
  function qp(s) {
    const out = [];
    s = s.replace(/=\r?\n/g, '');
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '=' && /^[0-9A-F]{2}$/i.test(s.substr(i + 1, 2))) { out.push(parseInt(s.substr(i + 1, 2), 16)); i += 2; }
      else { const c = s.charCodeAt(i); if (c < 256) out.push(c); else out.push(...new TextEncoder().encode(s[i])); }
    }
    return new Uint8Array(out);
  }
  function parseHeaders(text) {
    const h = {};
    text.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/).forEach(l => {
      const m = /^([^:\s]+):\s*(.*)$/.exec(l);
      if (m) { const k = m[1].toLowerCase(); h[k] = h[k] ? h[k] + ', ' + m[2] : m[2]; }
    });
    return h;
  }
  const param = (v, name) => {
    const star = new RegExp(name + '\\*=([^;]+)', 'i').exec(v || '');
    if (star) { const m = /^([^']*)'[^']*'(.*)$/.exec(star[1].trim().replace(/^"|"$/g, '')); if (m) try { return decodeURIComponent(m[2]); } catch (e) { return m[2]; } }
    const parts = []; const re = new RegExp(name + '\\*(\\d+)\\*?=("[^"]*"|[^;]+)', 'gi'); let mm;
    while ((mm = re.exec(v || ''))) parts[+mm[1]] = mm[2].replace(/^"|"$/g, '');
    if (parts.length) { const j = parts.join(''); try { return decodeURIComponent(j.replace(/^[^']*'[^']*'/, '')); } catch (e) { return j; } }
    const m = new RegExp(name + '="?([^";]*)"?', 'i').exec(v || '');
    return m ? decodeWords(m[1]) : '';
  };
  function parseEml(bytes) {
    const latin = s => new TextDecoder('latin1').decode(s);
    const mail = { html: '', text: '', attachments: [], headers: {} };
    const part = (b, top) => {
      const s = latin(b);
      const sep = /\r?\n\r?\n/.exec(s);
      const head = sep ? s.slice(0, sep.index) : s;
      const bodyStart = sep ? sep.index + sep[0].length : s.length;
      const h = parseHeaders(head);
      if (top) mail.headers = h;
      const ct = h['content-type'] || 'text/plain', type = ct.split(';')[0].trim().toLowerCase();
      const body = b.subarray(bodyStart);
      if (type.startsWith('multipart/')) {
        const boundary = param(ct, 'boundary');
        if (!boundary) return;
        const text = latin(body), mark = '--' + boundary;
        let idx = text.indexOf(mark);
        while (idx >= 0) {
          let st = idx + mark.length;
          if (text.startsWith('--', st)) break;
          const nl = text.indexOf('\n', st);
          if (nl < 0) break;
          st = nl + 1;
          const next = text.indexOf(mark, st);
          if (next < 0) { part(body.subarray(st), false); break; }
          let end = next;
          if (text[end - 1] === '\n') end--;
          if (text[end - 1] === '\r') end--;
          part(body.subarray(st, end), false);
          idx = next;
        }
        return;
      }
      const enc = (h['content-transfer-encoding'] || '').toLowerCase().trim();
      let data = body;
      if (enc === 'base64') { try { data = Uint8Array.from(atob(latin(body).replace(/[^A-Za-z0-9+/=]/g, '')), c => c.charCodeAt(0)); } catch (e) { data = body; } }
      else if (enc === 'quoted-printable') data = qp(latin(body));
      const disp = h['content-disposition'] || '';
      const name = param(disp, 'filename') || param(ct, 'name');
      const cid = (h['content-id'] || '').replace(/[<>]/g, '').trim();
      if (type === 'message/rfc822' && !name) { mail.attachments.push({ name: 'attached-email.eml', type, bytes: data, cid }); return; }
      if (!name && !/attachment/i.test(disp) && (type === 'text/html' || type === 'text/plain')) {
        let txt; try { txt = new TextDecoder(param(ct, 'charset') || 'utf-8').decode(data); } catch (e) { txt = new TextDecoder().decode(data); }
        if (type === 'text/html' && !mail.html) mail.html = txt; else if (type === 'text/plain' && !mail.text) mail.text = txt;
        return;
      }
      mail.attachments.push({ name: name || ('attachment' + (mail.attachments.length + 1)), type, bytes: data, cid, inline: /inline/i.test(disp) });
    };
    part(bytes, true);
    const H = mail.headers;
    mail.subject = decodeWords(H.subject || '(no subject)');
    mail.from = decodeWords(H.from || ''); mail.to = decodeWords(H.to || ''); mail.cc = decodeWords(H.cc || '');
    mail.date = H.date ? (isNaN(new Date(H.date)) ? H.date : new Date(H.date).toLocaleString()) : '';
    mail.raw = H;
    return mail;
  }

  // ---------- Outlook emails (.msg) ----------
  async function parseMsg(bytes) {
    await need('msg');
    const r = new MsgReader(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const d = r.getFileData();
    if (d.error) throw new Error('This Outlook email could not be read: ' + d.error);
    const rec = t => (d.recipients || []).filter(x => (x.recipType || 'to') === t).map(x => x.name && x.email && x.name !== x.email ? `${x.name} <${x.email}>` : (x.email || x.name)).join(', ');
    const mail = {
      subject: d.subject || '(no subject)',
      from: d.senderName && d.senderName !== d.senderEmail ? d.senderName + (d.senderEmail ? ` <${d.senderEmail}>` : '') : (d.senderEmail || d.senderName || ''),
      to: rec('to'), cc: rec('cc'),
      date: d.messageDeliveryTime || d.clientSubmitTime || d.creationTime || '',
      text: d.body || '', html: '',
      attachments: []
    };
    if (mail.date && !isNaN(new Date(mail.date))) mail.date = new Date(mail.date).toLocaleString();
    if (d.bodyHtml) mail.html = d.bodyHtml;
    else if (d.html) { try { mail.html = new TextDecoder().decode(d.html); } catch (e) { /* ignore */ } }
    for (const a of d.attachments || []) {
      try {
        const got = r.getAttachment(a);
        const name = got.fileName || a.fileName || a.name || 'attachment';
        mail.attachments.push({ name, type: a.attachMimeTag || '', bytes: got.content, cid: (a.pidContentId || '').replace(/[<>]/g, ''), inline: !!a.attachmentHidden });
      } catch (e) { /* skip unreadable attachment */ }
    }
    return mail;
  }

  // Cleans an email's HTML so nothing in it can run or phone home.
  function cleanHtml(html, cidMap, allowRemote) {
    const d = new DOMParser().parseFromString(html, 'text/html');
    d.querySelectorAll('script,iframe,frame,frameset,object,embed,form,input,button,select,textarea,link,meta,base,audio,video,svg').forEach(e => e.remove());
    let blocked = 0;
    d.querySelectorAll('*').forEach(e => {
      for (const a of [...e.attributes]) {
        const n = a.name.toLowerCase(), v = a.value.trim();
        if (n.startsWith('on')) e.removeAttribute(a.name);
        else if ((n === 'href' || n === 'src' || n === 'background' || n === 'poster') && /^\s*javascript:/i.test(v)) e.removeAttribute(a.name);
      }
      const src = e.getAttribute('src');
      if (src && /^cid:/i.test(src)) { const u = cidMap.get(src.slice(4).replace(/[<>]/g, '')); if (u) e.setAttribute('src', u); else e.removeAttribute('src'); }
      else if (src && /^https?:/i.test(src) && !allowRemote) { e.setAttribute('data-blocked', src); e.removeAttribute('src'); e.setAttribute('alt', '[picture not loaded]'); blocked++; }
      if (e.getAttribute('background') && !allowRemote) { e.removeAttribute('background'); blocked++; }
      const style = e.getAttribute('style');
      if (style && /url\(/i.test(style) && !allowRemote) { e.setAttribute('style', style.replace(/url\([^)]*\)/gi, 'none')); blocked++; }
      if (e.tagName === 'A') { e.setAttribute('target', '_blank'); e.setAttribute('rel', 'noopener noreferrer'); }
    });
    d.querySelectorAll('style').forEach(s => { if (!allowRemote) s.textContent = s.textContent.replace(/@import[^;]+;/gi, '').replace(/url\([^)]*\)/gi, 'none'); });
    return { html: d.body.innerHTML, head: [...d.querySelectorAll('style')].map(s => s.outerHTML).join(''), blocked };
  }

  function emailHtml(mail, opt = {}) {
    const cidMap = new Map();
    for (const a of mail.attachments) if (a.cid && a.bytes) cidMap.set(a.cid, URL.createObjectURL(new Blob([a.bytes], { type: a.type || '' })));
    let body = '', head = '', blocked = 0;
    if (mail.html) { const c = cleanHtml(mail.html, cidMap, opt.remote); body = c.html; head = c.head; blocked = c.blocked; }
    else body = `<pre class="mailtext">${cvEsc(mail.text)}</pre>`;
    const row = (k, v) => v ? `<tr><th>${k}</th><td>${cvEsc(v)}</td></tr>` : '';
    const atts = mail.attachments.filter(a => !(a.inline && a.cid && /image\//.test(a.type)));
    const html = `<div class="mailhead"><h1>${cvEsc(mail.subject)}</h1><table>${row('From', mail.from)}${row('To', mail.to)}${row('Cc', mail.cc)}${row('Sent', mail.date)}${atts.length ? row('Attached', atts.map(a => a.name).join(', ')) : ''}</table></div><div class="mailbody">${body}</div>`;
    return { html, head, blocked };
  }

  // Page styles for documents shown in the preview frame (and when saved as PDF).
  function frameCss(size, kind) {
    const pg = size === 'a4' ? 'A4' : 'letter';
    return `
      @page { size: ${kind === 'docx' ? 'auto' : pg}; margin: ${kind === 'docx' ? '0' : '0.6in'}; }
      html { background: #e2e8f0; }
      body { margin: 0; font: 11pt/1.45 Calibri, "Segoe UI", Arial, sans-serif; color: #111; }
      .flow { background: #fff; width: ${size === 'a4' ? '210mm' : '8.5in'}; min-height: ${size === 'a4' ? '297mm' : '11in'}; margin: 16px auto; padding: 0.6in; box-sizing: border-box; box-shadow: 0 2px 10px rgba(0,0,0,.2); overflow-wrap: anywhere; }
      .flow img { max-width: 100%; }
      .flow table { border-collapse: collapse; font-size: 9.5pt; margin: 6px 0; }
      .flow td, .flow th { border: 1px solid #bbb; padding: 2px 6px; vertical-align: top; }
      .flow pre, .mailtext { white-space: pre-wrap; font: inherit; margin: 0; }
      .flow h2 { font-size: 13pt; }
      .sheet.brk { break-before: page; }
      .mailhead { border-bottom: 2px solid #1e3a8a; margin-bottom: 14px; padding-bottom: 8px; }
      .mailhead h1 { font-size: 16pt; margin: 0 0 8px; }
      .mailhead table { border: 0; font-size: 10pt; }
      .mailhead th { border: 0; text-align: left; color: #555; padding: 1px 14px 1px 0; font-weight: 600; }
      .mailhead td { border: 0; padding: 1px 0; }
      .mailbody { overflow-wrap: anywhere; }
      .wrap-docx { background: transparent !important; padding: 16px 0 !important; }
      .note { font: 12px system-ui, sans-serif; color: #92400e; background: #fef3c7; padding: 6px 10px; border-radius: 6px; margin: 0 0 12px; }
      @media print {
        html { background: #fff; }
        .flow { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
        .wrap-docx { padding: 0 !important; }
        .wrap-docx > section.docx { box-shadow: none !important; margin: 0 !important; break-after: page; }
        .note { display: none; }
      }`;
  }

  // Fills a preview frame with the document. Returns { pages?, note? }.
  async function render(frame, item, opt = {}) {
    const doc = frame.contentDocument;
    const ext = item.type;
    doc.open(); doc.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title></title></head><body></body></html>'); doc.close();
    doc.title = cvBase(item.name);
    const style = doc.createElement('style'); style.textContent = frameCss(opt.size, ext); doc.head.append(style);
    const flow = (html, note) => { doc.body.innerHTML = `<div class="flow">${note ? `<p class="note">${cvEsc(note)}</p>` : ''}${html}</div>`; };
    const bytes = item.bytes;
    if (ext === 'docx') {
      await need('docx');
      const holder = doc.createElement('div'); doc.body.append(holder);
      await docx.renderAsync(new Blob([bytes]), holder, doc.head, { className: 'docx', inWrapper: true, breakPages: true, ignoreLastRenderedPageBreak: false, renderHeaders: true, renderFooters: true, renderFootnotes: true, useBase64URL: true });
      holder.querySelectorAll('.docx-wrapper').forEach(w => w.classList.add('wrap-docx'));
      return {};
    }
    if (ext === 'doc') {
      const paras = await docText(bytes);
      flow(paras.map(p => `<p>${cvEsc(p) || '&nbsp;'}</p>`).join(''), 'Old Word (.doc) file: only the words could be read, not the layout or pictures. For an exact copy, open it in Word and save it as .docx first.');
      return { note: 'Only the words of this old .doc file could be read.' };
    }
    if (ext === 'rtf') { flow(rtfToHtml(new TextDecoder('latin1').decode(bytes))); return {}; }
    if (ext === 'odt') { flow(await odtToHtml(bytes)); return {}; }
    if (['xlsx', 'xlsm', 'xls', 'ods', 'csv', 'tsv', 'numbers'].includes(ext)) { flow(await sheetsToHtml(bytes, ext)); return {}; }
    if (ext === 'eml' || ext === 'msg') {
      const mail = item.mail || (item.mail = ext === 'eml' ? parseEml(bytes) : await parseMsg(bytes));
      const r = emailHtml(mail, { remote: item.remote });
      doc.head.insertAdjacentHTML('beforeend', r.head);
      flow(r.html);
      return { blocked: r.blocked, mail };
    }
    // plain text
    let t; try { t = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch (e) { t = new TextDecoder('windows-1252').decode(bytes); }
    flow(`<pre>${cvEsc(t)}</pre>`);
    return {};
  }

  // Opens the browser's print box for the frame. Resolves when it closes.
  function print(frame) {
    return new Promise(ok => {
      const w = frame.contentWindow;
      let done = false;
      const fin = () => { if (!done) { done = true; ok(); } };
      w.addEventListener('afterprint', fin, { once: true });
      w.focus();
      w.print();
      setTimeout(fin, 500); // print() blocks until the box closes in most browsers
    });
  }

  return { DOC, render, print, parseEml, parseMsg, emailHtml };
})();
