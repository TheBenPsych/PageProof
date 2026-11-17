// Convert files: opening archives (ZIP, RAR, 7Z, TAR) and Mac Pages, Numbers and Keynote files.
const CVO = (() => {
  const ARCH = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'cbz', 'cbr']);
  const IWORK = new Set(['pages', 'numbers', 'key']);

  // Returns [{ path, size, get() -> Uint8Array }]
  async function list(item) {
    if (item.type === 'zip' || item.type === 'cbz') {
      try {
        const files = await ppUnzipAll(item.bytes);
        return [...files].map(([path, data]) => ({ path, size: data.length, get: async () => data }));
      } catch (e) { /* fall back to libarchive below (for example a zip with a password) */ }
    }
    const Archive = await needArchive();
    let arc;
    try { arc = await Archive.open(new File([item.bytes], item.name)); }
    catch (e) { throw new Error('This archive could not be opened. It may be damaged.'); }
    let entries;
    try { if (await arc.hasEncryptedData()) throw new Error('locked'); } catch (e) { if (e.message === 'locked') throw new Error('This archive is locked with a password. PageProof cannot open locked archives.'); }
    try { entries = await arc.getFilesArray(); }
    catch (e) { throw new Error('This archive could not be opened: ' + (e.message || e)); }
    return entries.map(en => ({
      path: (en.path || '') + en.file.name,
      size: en.file.size,
      get: async () => { const f = await en.file.extract(); return new Uint8Array(await f.arrayBuffer()); }
    }));
  }

  // Like ppUnzip in unzip.js, but keeps every file and folder name as it is.
  async function ppUnzipAll(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { end = i; break; }
    if (end < 0) throw new Error('not a zip');
    const count = dv.getUint16(end + 10, true);
    let p = dv.getUint32(end + 16, true);
    const files = new Map();
    for (let k = 0; k < count; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('damaged');
      const flags = dv.getUint16(p + 8, true), method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), commentLen = dv.getUint16(p + 32, true);
      const local = dv.getUint32(p + 42, true);
      const nb = bytes.subarray(p + 46, p + 46 + nameLen);
      let name;
      try { name = new TextDecoder('utf-8', { fatal: true }).decode(nb); } catch (e) { name = new TextDecoder('windows-1252').decode(nb); }
      p += 46 + nameLen + extraLen + commentLen;
      if (name.endsWith('/') || name.startsWith('__MACOSX/') || /(^|\/)\.DS_Store$/.test(name)) continue;
      if (flags & 1) throw new Error('locked');
      const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      const raw = bytes.subarray(start, start + csize);
      let data;
      if (method === 0) data = raw;
      else if (method === 8) data = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
      else throw new Error('method');
      files.set(name, data);
    }
    return files;
  }

  // Mac Pages / Numbers / Keynote: these keep a ready-made preview inside the file.
  async function iwork(item) {
    let files;
    try { files = await ppUnzipAll(item.bytes); }
    catch (e) { throw new Error('This Mac file could not be opened. If it came from a Mac as a folder, ask the sender to export it as PDF, or to zip it first.'); }
    const get = n => { for (const [k, v] of files) if (k.toLowerCase() === n.toLowerCase()) return v; return null; };
    const out = { pdf: get('QuickLook/Preview.pdf'), jpg: null, tables: '' };
    if (!out.pdf) {
      const names = ['preview.jpg', 'QuickLook/Thumbnail.jpg', 'preview-web.jpg', 'preview-micro.jpg'];
      for (const n of names) { const b = get(n); if (b) { out.jpg = b; break; } }
    }
    if (item.type === 'numbers') {
      try { await need('xlsx'); const wb = XLSX.read(item.bytes, { type: 'array' }); out.tables = wb.SheetNames.map(n => `<h3>${cvEsc(n)}</h3>` + (/<table[\s\S]*<\/table>/i.exec(XLSX.utils.sheet_to_html(wb.Sheets[n])) || [''])[0]).join(''); }
      catch (e) { /* not every Numbers file can be read as a table */ }
    }
    return out;
  }

  return { ARCH, IWORK, list, iwork };
})();
