// Convert files: loads the helper libraries in lib/ only when they are first needed,
// so the page opens fast. Everything runs on this computer; nothing is uploaded.
const CV_LIBS = {
  pdflib: ['lib/pdf-lib.min.js'],
  pdfjs: ['lib/pdf.min.js'],
  heif: ['lib/libheif-bundle.js'],
  docx: ['lib/jszip.min.js', 'lib/docx-preview.min.js'],
  xlsx: ['lib/xlsx.full.min.js'],
  msg: ['lib/msgreader.min.js'],
  gif: ['lib/gifenc.min.js'],
  tiff: ['lib/pako.min.js', 'lib/UTIF.js'],
  pako: ['lib/pako.min.js']
};
const cvLoaded = {};
const cvScripts = {};
function cvScript(src) {
  return cvScripts[src] || (cvScripts[src] = new Promise((ok, bad) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = ok;
    s.onerror = () => bad(new Error('Could not load the helper file ' + src));
    document.head.append(s);
  }));
}
function need(name) {
  if (!cvLoaded[name]) cvLoaded[name] = (async () => {
    for (const src of CV_LIBS[name]) await cvScript(src);
    if (name === 'pdfjs') pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
  })();
  return cvLoaded[name];
}
let cvArchive = null;
async function needArchive() {
  if (!cvArchive) cvArchive = import('./lib/libarchive/libarchive.js').then(m => {
    m.Archive.init({ workerUrl: new URL('lib/libarchive/worker-bundle.js', location.href).href });
    return m.Archive;
  });
  return cvArchive;
}

// ---------- small shared helpers ----------
const cvExt = name => { const m = /\.([a-z0-9]+)$/i.exec(name || ''); return m ? m[1].toLowerCase() : ''; };
const cvBase = name => (name || 'file').replace(/\.[a-z0-9]+$/i, '');
function cvSize(n) {
  if (n < 1024) return n + ' bytes';
  if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
  return (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB';
}
const cvBytes = async f => new Uint8Array(await f.arrayBuffer());
const cvEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cvWait = () => new Promise(r => setTimeout(r, 0));

// What a file really is, from its first bytes (a file can have the wrong name).
function cvSniff(b) {
  const s = (o, t) => { for (let i = 0; i < t.length; i++) if (b[o + i] !== t.charCodeAt(i)) return false; return true; };
  if (b.length < 4) return '';
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpg';
  if (s(0, '\x89PNG')) return 'png';
  if (s(0, 'GIF8')) return 'gif';
  if (s(0, 'BM') && b.length > 26) return 'bmp';
  if (s(0, 'RIFF') && s(8, 'WEBP')) return 'webp';
  if (s(0, 'II*\0') || s(0, 'MM\0*')) return 'tif';
  if (s(4, 'ftyp')) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (/^(avif|avis)$/.test(brand)) return 'avif';
    if (/^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(brand)) return 'heic';
    return '';
  }
  if (s(0, '%PDF')) return 'pdf';
  if (s(0, 'PK\x03\x04') || s(0, 'PK\x05\x06')) return 'zip';
  if (s(0, 'Rar!')) return 'rar';
  if (s(0, '7z\xBC\xAF')) return '7z';
  if (b[0] === 0x1F && b[1] === 0x8B) return 'gz';
  if (s(0, 'BZh')) return 'bz2';
  if (s(0, '\xD0\xCF\x11\xE0')) return 'ole';
  if (s(0, '{\\rtf')) return 'rtf';
  if (b.length > 262 && s(257, 'ustar')) return 'tar';
  return '';
}
