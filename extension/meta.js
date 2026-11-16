// Reads the hidden data stored inside a picture file: EXIF (camera, date, GPS),
// IPTC (author, copyright), XMP (Adobe data, edit history) and Content Credentials (C2PA).
// Works on JPEG, PNG, WebP, GIF, TIFF, HEIC and AVIF. No outside libraries.
const PP_META = (() => {
  const latin1 = new TextDecoder('latin1');
  const utf8 = new TextDecoder('utf-8');
  const strictUtf8 = new TextDecoder('utf-8', { fatal: true });
  const text = b => { try { return strictUtf8.decode(b); } catch (e) { return latin1.decode(b); } };
  const clean = s => String(s == null ? '' : s).replace(/\0+$/g, '').replace(/\0/g, ' ').trim();
  const startsWith = (b, at, str) => { for (let i = 0; i < str.length; i++) if (b[at + i] !== str.charCodeAt(i)) return false; return true; };
  const indexOf = (b, str, from = 0, to = b.length) => {
    const c0 = str.charCodeAt(0);
    for (let i = from; i <= to - str.length; i++) if (b[i] === c0 && startsWith(b, i, str)) return i;
    return -1;
  };

  // ---------- EXIF (a small TIFF file inside the picture) ----------
  const TAGS = {
    0x010E: 'Description', 0x010F: 'Camera make', 0x0110: 'Camera model', 0x0112: 'Orientation', 0x011A: 'X resolution',
    0x011B: 'Y resolution', 0x0128: 'Resolution unit', 0x0131: 'Software', 0x0132: 'Date modified', 0x013B: 'Artist',
    0x0100: 'Image width', 0x0101: 'Image height', 0x8298: 'Copyright', 0x829A: 'Exposure time', 0x829D: 'F-number',
    0x8822: 'Exposure program', 0x8827: 'ISO', 0x9000: 'EXIF version', 0x9003: 'Date taken', 0x9004: 'Date digitized',
    0x9010: 'Time zone (modified)', 0x9011: 'Time zone (taken)', 0x9012: 'Time zone (digitized)', 0x9204: 'Exposure bias',
    0x9207: 'Metering mode', 0x9209: 'Flash', 0x920A: 'Focal length', 0x9286: 'User comment', 0x927C: 'Maker notes',
    0xA002: 'Pixel width', 0xA003: 'Pixel height', 0xA402: 'Exposure mode', 0xA403: 'White balance',
    0xA405: 'Focal length (35mm)', 0xA406: 'Scene type', 0xA420: 'Image unique ID', 0xA430: 'Camera owner',
    0xA431: 'Camera serial number', 0xA432: 'Lens specification', 0xA433: 'Lens make', 0xA434: 'Lens model',
    0xA435: 'Lens serial number', 0x9290: 'Sub-second time', 0x9291: 'Sub-second time (taken)', 0x9292: 'Sub-second time (digitized)',
    0xA001: 'Colour space', 0x0213: 'YCbCr positioning', 0x9101: 'Components', 0xA000: 'FlashPix version',
    0x9201: 'Shutter speed value', 0x9202: 'Aperture value', 0x9205: 'Max aperture', 0xA217: 'Sensing method',
    0xA300: 'File source', 0xA301: 'Scene type code', 0xA401: 'Custom rendered', 0xA404: 'Digital zoom',
    0xA407: 'Gain control', 0xA408: 'Contrast', 0xA409: 'Saturation', 0xA40A: 'Sharpness', 0x9C9B: 'Windows title',
    0x9C9C: 'Windows comment', 0x9C9D: 'Windows author', 0x9C9E: 'Windows keywords', 0x9C9F: 'Windows subject',
    0x4746: 'Rating', 0x8830: 'Sensitivity type', 0x9206: 'Subject distance', 0x9208: 'Light source', 0xA20E: 'Focal plane X res',
    0xA20F: 'Focal plane Y res', 0xA210: 'Focal plane unit'
  };
  const GPS_TAGS = { 0: 'GPS version', 1: 'Latitude ref', 2: 'Latitude', 3: 'Longitude ref', 4: 'Longitude', 5: 'Altitude ref',
    6: 'Altitude', 7: 'GPS time (UTC)', 0x10: 'Direction ref', 0x11: 'Direction', 0x12: 'Map datum', 0x1D: 'GPS date', 0x1B: 'Processing method' };
  const SKIP = new Set([0x8769, 0x8825, 0xA005, 0x0201, 0x0202, 0x02BC, 0x83BB, 0x8649, 0x8773, 0xC4A5, 0x0111, 0x0117, 0x0103, 0x0106, 0x0115, 0x011C, 0x0102, 0x0116, 0x0144, 0x0145, 0x0142, 0x0143, 0x014A]);
  const ENUMS = {
    0x0112: { 1: 'Normal', 3: 'Rotated 180°', 6: 'Rotated 90° clockwise', 8: 'Rotated 90° anticlockwise', 2: 'Mirrored', 4: 'Mirrored vertically', 5: 'Mirrored + rotated', 7: 'Mirrored + rotated' },
    0x0128: { 1: 'none', 2: 'inches', 3: 'cm' },
    0x8822: { 0: 'Not defined', 1: 'Manual', 2: 'Program', 3: 'Aperture priority', 4: 'Shutter priority', 5: 'Creative', 6: 'Action', 7: 'Portrait', 8: 'Landscape' },
    0x9207: { 0: 'Unknown', 1: 'Average', 2: 'Center-weighted', 3: 'Spot', 4: 'Multi-spot', 5: 'Pattern', 6: 'Partial' },
    0xA402: { 0: 'Auto', 1: 'Manual', 2: 'Auto bracket' }, 0xA403: { 0: 'Auto', 1: 'Manual' },
    0xA406: { 0: 'Standard', 1: 'Landscape', 2: 'Portrait', 3: 'Night' }, 0xA001: { 1: 'sRGB', 65535: 'Uncalibrated' },
    0xA401: { 0: 'Normal', 1: 'Custom' }
  };

  function readTiff(b, start, end) {
    const out = { fields: [], gps: null, raw: {} };
    if (end - start < 8) return out;
    const le = b[start] === 0x49;
    if (!le && b[start] !== 0x4D) return out;
    const dv = new DataView(b.buffer, b.byteOffset + start, end - start);
    const u16 = o => dv.getUint16(o, le), u32 = o => dv.getUint32(o, le);
    if (u16(2) !== 42) return out;
    const size = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];
    const seen = new Set();

    function value(type, count, off) {
      const n = size[type] || 1;
      const at = n * count <= 4 ? off : u32(off);
      if (at + n * count > dv.byteLength) return null;
      if (type === 2) return clean(latin1.decode(new Uint8Array(dv.buffer, dv.byteOffset + at, count)));
      if (type === 7 || type === 1) {
        const raw = new Uint8Array(dv.buffer, dv.byteOffset + at, count);
        return type === 1 && count <= 8 ? [...raw] : raw;
      }
      const vals = [];
      for (let i = 0; i < Math.min(count, 64); i++) {
        const o = at + i * n;
        if (type === 3) vals.push(u16(o));
        else if (type === 4) vals.push(u32(o));
        else if (type === 9) vals.push(dv.getInt32(o, le));
        else if (type === 5) vals.push([u32(o), u32(o + 4)]);
        else if (type === 10) vals.push([dv.getInt32(o, le), dv.getInt32(o + 4, le)]);
        else if (type === 11) vals.push(dv.getFloat32(o, le));
        else if (type === 12) vals.push(dv.getFloat64(o, le));
        else if (type === 8) vals.push(dv.getInt16(o, le));
        else if (type === 6) vals.push(dv.getInt8(o));
      }
      return vals;
    }

    function ifd(off, kind) {
      if (!off || off + 2 > dv.byteLength || seen.has(off)) return 0;
      seen.add(off);
      const n = u16(off);
      if (n > 1000) return 0;
      for (let i = 0; i < n; i++) {
        const e = off + 2 + i * 12;
        if (e + 12 > dv.byteLength) break;
        const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
        if (type < 1 || type > 12) continue;
        if (kind !== 'gps' && tag === 0x8769) { ifd(u32(e + 8), 'exif'); continue; }
        if (kind !== 'gps' && tag === 0x8825) { ifd(u32(e + 8), 'gps'); continue; }
        if (kind !== 'gps' && SKIP.has(tag)) continue;
        let v;
        try { v = value(type, count, e + 8); } catch (err) { continue; }
        if (v == null) continue;
        out.raw[(kind === 'gps' ? 'g' : '') + tag] = v;
        const name = kind === 'gps' ? GPS_TAGS[tag] : TAGS[tag];
        out.fields.push({ group: kind === 'gps' ? 'GPS' : kind === 'exif' ? 'Camera' : 'Image', tag, name: name || 'Tag 0x' + tag.toString(16).padStart(4, '0'),
          value: format(tag, type, v, kind), known: !!name });
      }
      return off + 2 + n * 12 + 4 <= dv.byteLength ? u32(off + 2 + n * 12) : 0;
    }
    ifd(u32(4), 'main');
    out.gps = gpsFrom(out.raw);
    return out;
  }

  const rat = r => Array.isArray(r) ? (r[1] ? r[0] / r[1] : 0) : r;
  const num = x => { const v = Math.round(x * 100) / 100; return String(v); };
  function format(tag, type, v, kind) {
    if (v instanceof Uint8Array) {
      if (tag === 0x9000 || tag === 0xA000) return latin1.decode(v);
      if (tag === 0x9286) { const t = clean(latin1.decode(v.subarray(8))); return t || '(empty)'; }
      if (tag >= 0x9C9B && tag <= 0x9C9F) return clean(new TextDecoder('utf-16le').decode(v));
      if (kind === 'gps' && tag === 0x1B) return clean(latin1.decode(v.subarray(8)));
      return '(' + v.length + ' bytes of data)';
    }
    if (typeof v === 'string') return v;
    if (kind === 'gps') {
      if (tag === 2 || tag === 4) return v.map(rat).map(num).join(', ');
      if (tag === 6) return num(rat(v[0])) + ' m';
      if (tag === 7) return v.map(rat).map(x => String(Math.floor(x)).padStart(2, '0')).join(':');
      if (tag === 0) return v.join('.');
      if (tag === 5) return v[0] === 1 ? 'Below sea level' : 'Above sea level';
      if (tag === 0x11) return num(rat(v[0])) + '°';
    }
    if (tag === 0xA20E || tag === 0xA20F) return num(rat(v[0]));
    if (ENUMS[tag] && v.length === 1 && ENUMS[tag][v[0]] != null) return ENUMS[tag][v[0]];
    if (tag === 0x829A) { const x = rat(v[0]); return x && x < 1 ? '1/' + Math.round(1 / x) + ' s' : num(x) + ' s'; }
    if (tag === 0x829D) return 'f/' + num(rat(v[0]));
    if (tag === 0x920A || tag === 0xA405) return num(rat(v[0])) + ' mm';
    if (tag === 0x9204) return num(rat(v[0])) + ' EV';
    if (tag === 0x9209) return (v[0] & 1) ? 'Fired' : 'Did not fire';
    if (tag === 0xA432) return v.map(rat).map(num).join(', ');
    return v.map(x => Array.isArray(x) ? num(rat(x)) : num(x)).join(', ');
  }

  function gpsFrom(raw) {
    const deg = a => a && a.length >= 3 ? rat(a[0]) + rat(a[1]) / 60 + rat(a[2]) / 3600 : null;
    let lat = deg(raw.g2), lon = deg(raw.g4);
    if (lat == null || lon == null || (lat === 0 && lon === 0)) return null;
    if (String(raw.g1).toUpperCase().startsWith('S')) lat = -lat;
    if (String(raw.g3).toUpperCase().startsWith('W')) lon = -lon;
    const alt = raw.g6 ? rat(raw.g6[0]) * (raw.g5 && raw.g5[0] === 1 ? -1 : 1) : null;
    return { lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6, alt };
  }

  // ---------- IPTC (the news-industry author and copyright fields) ----------
  const IPTC = { 5: 'Title', 10: 'Urgency', 15: 'Category', 25: 'Keywords', 40: 'Special instructions', 55: 'Date created', 60: 'Time created',
    62: 'Digital creation date', 65: 'Program', 80: 'Creator', 85: 'Creator\'s job title', 90: 'City', 92: 'Sub-location', 95: 'State / Province',
    100: 'Country code', 101: 'Country', 103: 'Job ID', 105: 'Headline', 110: 'Credit line', 115: 'Source', 116: 'Copyright notice',
    118: 'Contact', 120: 'Caption / Description', 122: 'Caption writer' };
  function readIptc(b) {
    const out = [];
    let utf = false;
    for (let i = 0; i + 5 <= b.length;) {
      if (b[i] !== 0x1C) { i++; continue; }
      const rec = b[i + 1], ds = b[i + 2];
      let len = (b[i + 3] << 8) | b[i + 4], at = i + 5;
      if (len & 0x8000) { const k = len & 0x7fff; len = 0; for (let j = 0; j < k; j++) len = len * 256 + b[at + j]; at += k; }
      const data = b.subarray(at, at + len);
      if (rec === 1 && ds === 90 && data[0] === 0x1B && data[1] === 0x25 && data[2] === 0x47) utf = true;
      if (rec === 2 && ds !== 0) {
        const v = clean(utf ? utf8.decode(data) : text(data));
        const name = IPTC[ds] || 'Field 2:' + ds;
        const prev = out.find(f => f.name === name);
        if (prev && (ds === 25 || ds === 80)) prev.value += '; ' + v; else out.push({ name, value: v, ds });
      }
      i = at + len;
    }
    return out;
  }
  function readPhotoshop(b) {   // Photoshop "8BIM" resource blocks; 0x0404 holds IPTC
    let iptc = [];
    for (let i = 0; i + 12 <= b.length;) {
      if (!startsWith(b, i, '8BIM')) break;
      const id = (b[i + 4] << 8) | b[i + 5];
      let nameLen = b[i + 6]; let p = i + 7 + nameLen; if ((nameLen + 1) % 2) p++;
      const size = ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0;
      const data = b.subarray(p + 4, p + 4 + size);
      if (id === 0x0404) iptc = iptc.concat(readIptc(data));
      i = p + 4 + size + (size % 2);
    }
    return iptc;
  }

  // ---------- XMP (Adobe's XML block) ----------
  const NS = {
    'http://purl.org/dc/elements/1.1/': 'dc', 'http://ns.adobe.com/xap/1.0/': 'xmp', 'http://ns.adobe.com/photoshop/1.0/': 'photoshop',
    'http://ns.adobe.com/xap/1.0/rights/': 'xmpRights', 'http://ns.adobe.com/xap/1.0/mm/': 'xmpMM',
    'http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/': 'Iptc4xmpCore', 'http://iptc.org/std/Iptc4xmpExt/2008-02-29/': 'Iptc4xmpExt',
    'http://ns.adobe.com/exif/1.0/': 'exif', 'http://ns.adobe.com/tiff/1.0/': 'tiff', 'http://ns.adobe.com/camera-raw-settings/1.0/': 'crs',
    'http://ns.adobe.com/lightroom/1.0/': 'lr', 'http://ns.useplus.org/ldf/xmp/1.0/': 'plus', 'http://ns.adobe.com/exif/1.0/aux/': 'aux',
    'http://cipa.jp/exif/1.0/': 'exifEX', 'http://ns.google.com/photos/1.0/camera/': 'GCamera', 'http://ns.adobe.com/xap/1.0/sType/ResourceRef#': 'stRef'
  };
  const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
  function readXmp(xml) {
    const out = { fields: [], history: [], props: {} };
    let doc = null;
    try { doc = new DOMParser().parseFromString(xml.slice(xml.indexOf('<')), 'application/xml'); if (doc.getElementsByTagName('parsererror').length) doc = null; } catch (e) { doc = null; }
    if (!doc) { out.fields.push({ name: 'XMP', value: '(present, but could not be read)' }); return out; }
    const pfx = el => NS[el.namespaceURI] || el.prefix || '?';
    const leafText = el => {
      const lis = [...el.getElementsByTagNameNS(RDF, 'li')];
      if (lis.length) return lis.map(li => structText(li) || clean(li.textContent)).filter(Boolean).join('; ');
      const attrs = [...el.attributes].filter(a => a.namespaceURI !== RDF && a.prefix !== 'xmlns' && a.name !== 'xml:lang');
      if (attrs.length || el.children.length) return structText(el);
      const r = el.getAttributeNS(RDF, 'resource');
      return clean(r || el.textContent);
    };
    const structText = el => {
      const parts = [];
      for (const a of el.attributes) if (a.namespaceURI !== RDF && a.prefix !== 'xmlns' && a.name !== 'xml:lang') parts.push(a.localName + '=' + a.value);
      for (const c of el.children) {
        if (c.namespaceURI === RDF && c.localName === 'Description') { parts.push(structText(c)); continue; }
        if (c.namespaceURI === RDF) continue;
        parts.push(c.localName + '=' + leafText(c));
      }
      return parts.filter(Boolean).join(', ');
    };
    const put = (p, name, value) => {
      if (!value) return;
      out.props[p + ':' + name] = value;
      out.fields.push({ name: p + ':' + name, value });
    };
    for (const d of doc.getElementsByTagNameNS(RDF, 'Description')) {
      if (d.parentElement && d.parentElement.namespaceURI === RDF && d.parentElement.localName !== 'RDF') continue; // nested struct
      for (const a of d.attributes) {
        if (a.namespaceURI === RDF || a.prefix === 'xmlns' || a.name.startsWith('xmlns')) continue;
        put(NS[a.namespaceURI] || a.prefix || '?', a.localName, clean(a.value));
      }
      for (const c of d.children) {
        if (c.namespaceURI === RDF) continue;
        const p = pfx(c);
        if (p === 'xmpMM' && c.localName === 'History') {
          for (const li of c.getElementsByTagNameNS(RDF, 'li')) {
            const EVT = 'http://ns.adobe.com/xap/1.0/sType/ResourceEvent#';
            const inner = [li, ...li.getElementsByTagNameNS(RDF, 'Description')];
            const get = k => { for (const n of inner) { const v = n.getAttributeNS(EVT, k); if (v) return v; }
              return (li.getElementsByTagNameNS(EVT, k)[0] || {}).textContent || ''; };
            out.history.push({ action: clean(get('action')), when: clean(get('when')), software: clean(get('softwareAgent')), changed: clean(get('changed')) });
          }
          continue;
        }
        put(p, c.localName, leafText(c));
      }
    }
    return out;
  }

  // ---------- Content Credentials (C2PA) ----------
  // Reads the main facts from the signed record. It does NOT check the signature:
  // for that, use https://contentcredentials.org/verify
  function readC2pa(b) {
    const out = { present: true, bytes: b.length, generator: '', actions: [], ai: '', signers: [] };
    const cborText = at => {
      const h = b[at];
      if (h >= 0x60 && h <= 0x77) return utf8.decode(b.subarray(at + 1, at + 1 + h - 0x60));
      if (h === 0x78) return utf8.decode(b.subarray(at + 2, at + 2 + b[at + 1]));
      if (h === 0x79) return utf8.decode(b.subarray(at + 3, at + 3 + ((b[at + 1] << 8) | b[at + 2])));
      return '';
    };
    let i = indexOf(b, 'claim_generator');
    if (i > 0 && b[i - 1] === 0x6f) out.generator = cborText(i + 15);
    if (!out.generator) {
      i = indexOf(b, 'claim_generator_info');
      if (i > 0) { const n = indexOf(b, 'name', i, Math.min(b.length, i + 200)); if (n > 0) out.generator = cborText(n + 4); }
    }
    const acts = new Set();
    for (let j = indexOf(b, 'c2pa.'); j >= 0 && acts.size < 30; j = indexOf(b, 'c2pa.', j + 5)) {
      const m = /^c2pa\.[a-z_.]+/.exec(latin1.decode(b.subarray(j, j + 40)));
      if (m && /^c2pa\.(created|opened|edited|placed|cropped|resized|filtered|color_adjustments|drawing|converted|published|transcoded|removed|repackaged|unknown|orientation)$/.test(m[0])) acts.add(m[0].slice(5));
    }
    out.actions = [...acts];
    if (indexOf(b, 'compositeWithTrainedAlgorithmicMedia') >= 0) out.ai = 'Partly made with AI (marked "composite with AI")';
    else if (indexOf(b, 'trainedAlgorithmicMedia') >= 0) out.ai = 'Made with AI (marked "trained algorithmic media")';
    else if (indexOf(b, 'algorithmicMedia') >= 0) out.ai = 'Made by a computer program (marked "algorithmic media")';
    // Organisation names in the signing certificates (OID 2.5.4.10).
    for (let j = 0; j < b.length - 6 && out.signers.length < 4; j++) {
      if (b[j] === 0x06 && b[j + 1] === 0x03 && b[j + 2] === 0x55 && b[j + 3] === 0x04 && b[j + 4] === 0x0A && (b[j + 5] === 0x0C || b[j + 5] === 0x13)) {
        const s = utf8.decode(b.subarray(j + 7, j + 7 + b[j + 6]));
        if (s && !out.signers.includes(s)) out.signers.push(s);
      }
    }
    return out;
  }

  // ---------- file formats ----------
  async function inflate(bytes) {
    const ds = new DecompressionStream('deflate');
    const buf = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(buf);
  }

  function sniff(b) {
    if (b[0] === 0xFF && b[1] === 0xD8) return 'JPEG';
    if (b[0] === 0x89 && startsWith(b, 1, 'PNG')) return 'PNG';
    if (startsWith(b, 0, 'RIFF') && startsWith(b, 8, 'WEBP')) return 'WebP';
    if (startsWith(b, 0, 'GIF8')) return 'GIF';
    if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 42) || (b[0] === 0x4D && b[1] === 0x4D && b[3] === 42)) return 'TIFF';
    if (startsWith(b, 4, 'ftyp')) {
      const brand = latin1.decode(b.subarray(8, 12));
      if (/avi[fs]/.test(brand)) return 'AVIF';
      if (/hei[cxms]|mif1|msf1|hevc/.test(brand)) return 'HEIC';
      return 'ISO media (' + brand.trim() + ')';
    }
    if (startsWith(b, 0, 'BM')) return 'BMP';
    if (/<svg[\s>]/i.test(latin1.decode(b.subarray(0, 1000)))) return 'SVG';
    return 'Unknown';
  }

  async function read(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const r = { format: sniff(b), size: b.length, width: 0, height: 0, exif: [], gps: null, iptc: [], xmp: null, c2pa: null, comments: [], ai: [] };
    let exifRaw = {}, xmlText = '';
    const addTiff = (s, e) => { const t = readTiff(b, s, e); r.exif = r.exif.concat(t.fields); r.gps = r.gps || t.gps; Object.assign(exifRaw, t.raw); };

    if (r.format === 'JPEG') {
      const app11 = [];
      for (let i = 2; i + 4 < b.length;) {
        if (b[i] !== 0xFF) { i++; continue; }
        const m = b[i + 1];
        if (m === 0xFF) { i++; continue; }
        if (m === 0xD8 || (m >= 0xD0 && m <= 0xD7) || m === 0x01) { i += 2; continue; }
        if (m === 0xDA || m === 0xD9) break;
        const len = (b[i + 2] << 8) | b[i + 3];
        const s = i + 4, e = Math.min(b.length, i + 2 + len);
        if (m === 0xE1 && startsWith(b, s, 'Exif\0')) addTiff(s + 6, e);
        else if (m === 0xE1 && startsWith(b, s, 'http://ns.adobe.com/xap/1.0/\0')) xmlText += utf8.decode(b.subarray(s + 29, e));
        else if (m === 0xED && startsWith(b, s, 'Photoshop 3.0\0')) r.iptc = r.iptc.concat(readPhotoshop(b.subarray(s + 14, e)));
        else if (m === 0xEB && startsWith(b, s, 'JP')) app11.push(b.subarray(s + 8, e));
        else if (m === 0xFE) r.comments.push(text(b.subarray(s, e)));
        else if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC && !r.width) {
          r.height = (b[s + 1] << 8) | b[s + 2]; r.width = (b[s + 3] << 8) | b[s + 4];
        }
        i = i + 2 + len;
      }
      if (app11.length) {
        const all = new Uint8Array(app11.reduce((n, a) => n + a.length, 0));
        let o = 0; for (const a of app11) { all.set(a, o); o += a.length; }
        if (indexOf(all, 'c2pa') >= 0) r.c2pa = readC2pa(all);
      }
    } else if (r.format === 'PNG') {
      for (let i = 8; i + 12 <= b.length;) {
        const len = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
        const type = latin1.decode(b.subarray(i + 4, i + 8));
        const d = b.subarray(i + 8, Math.min(b.length, i + 8 + len));
        if (type === 'IHDR') { r.width = ((d[0] << 24) | (d[1] << 16) | (d[2] << 8) | d[3]) >>> 0; r.height = ((d[4] << 24) | (d[5] << 16) | (d[6] << 8) | d[7]) >>> 0; }
        else if (type === 'eXIf') addTiff(i + 8, i + 8 + len);
        else if (type === 'caBX') r.c2pa = readC2pa(d);
        else if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
          const z = d.indexOf(0);
          const key = latin1.decode(d.subarray(0, z));
          let val = '';
          try {
            if (type === 'tEXt') val = latin1.decode(d.subarray(z + 1));
            else if (type === 'zTXt') val = latin1.decode(await inflate(d.subarray(z + 2)));
            else {
              const comp = d[z + 1];
              let p = z + 3; p = d.indexOf(0, p) + 1; p = d.indexOf(0, p) + 1;
              val = utf8.decode(comp ? await inflate(d.subarray(p)) : d.subarray(p));
            }
          } catch (e) { val = '(could not be read)'; }
          if (key === 'XML:com.adobe.xmp') xmlText += val;
          else if (key === 'Raw profile type exif' || key === 'Raw profile type APP1') {
            const hex = val.split('\n').slice(3).join('').replace(/\s+/g, '');
            const bin = new Uint8Array(hex.length / 2); for (let k = 0; k < bin.length; k++) bin[k] = parseInt(hex.substr(k * 2, 2), 16);
            const ex = indexOf(bin, 'Exif\0'); const t = readTiff(bin, ex >= 0 ? ex + 6 : 0, bin.length);
            r.exif = r.exif.concat(t.fields); r.gps = r.gps || t.gps; Object.assign(exifRaw, t.raw);
          } else r.comments.push(key + ': ' + clean(val));
        }
        if (type === 'IEND') break;
        i += 12 + len;
      }
    } else if (r.format === 'WebP') {
      for (let i = 12; i + 8 <= b.length;) {
        const type = latin1.decode(b.subarray(i, i + 4));
        const len = (b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24)) >>> 0;
        const s = i + 8, e = Math.min(b.length, s + len);
        if (type === 'VP8X') { r.width = 1 + (b[s + 4] | (b[s + 5] << 8) | (b[s + 6] << 16)); r.height = 1 + (b[s + 7] | (b[s + 8] << 8) | (b[s + 9] << 16)); }
        else if (type === 'VP8 ' && !r.width) { r.width = (b[s + 6] | (b[s + 7] << 8)) & 0x3fff; r.height = (b[s + 8] | (b[s + 9] << 8)) & 0x3fff; }
        else if (type === 'VP8L' && !r.width) { const v = b[s + 1] | (b[s + 2] << 8) | (b[s + 3] << 16) | (b[s + 4] << 24); r.width = (v & 0x3fff) + 1; r.height = ((v >> 14) & 0x3fff) + 1; }
        else if (type === 'EXIF') addTiff(startsWith(b, s, 'Exif\0') ? s + 6 : s, e);
        else if (type === 'XMP ') xmlText += utf8.decode(b.subarray(s, e));
        else if (type === 'C2PA') r.c2pa = readC2pa(b.subarray(s, e));
        i = s + len + (len % 2);
      }
    } else if (r.format === 'GIF') {
      r.width = b[6] | (b[7] << 8); r.height = b[8] | (b[9] << 8);
    } else if (r.format === 'TIFF') {
      addTiff(0, b.length);
    } else if (r.format === 'HEIC' || r.format === 'AVIF' || r.format.startsWith('ISO')) {
      // The EXIF block sits in its own "item"; look for its header.
      for (let j = indexOf(b, 'Exif\0\0'); j >= 0; j = indexOf(b, 'Exif\0\0', j + 6)) {
        if (b[j + 6] === 0x49 || b[j + 6] === 0x4D) { addTiff(j + 6, b.length); break; }
      }
      const ispe = indexOf(b, 'ispe');
      if (ispe > 0) { const dv = new DataView(b.buffer, b.byteOffset + ispe + 8, 8); r.width = dv.getUint32(0); r.height = dv.getUint32(4); }
      const jumb = indexOf(b, 'c2pa');
      if (jumb > 0 && indexOf(b, 'jumb') >= 0) r.c2pa = readC2pa(b);
    }
    if (!xmlText && r.format !== 'JPEG') {
      const s = indexOf(b, '<x:xmpmeta');
      if (s >= 0) { const e = indexOf(b, '</x:xmpmeta>', s); if (e > 0) xmlText = utf8.decode(b.subarray(s, e + 12)); }
    }
    if (xmlText) r.xmp = readXmp(xmlText);
    if (!r.width) {
      const w = r.exif.find(f => f.tag === 0xA002), h = r.exif.find(f => f.tag === 0xA003);
      if (w && h) { r.width = +w.value; r.height = +h.value; }
    }
    r.summary = summarize(r, exifRaw);
    return r;
  }

  // ---------- the short summary shown on top ----------
  function summarize(r, raw) {
    const ex = name => (r.exif.find(f => f.name === name) || {}).value || '';
    const ip = name => (r.iptc.find(f => f.name === name) || {}).value || '';
    const xp = k => (r.xmp && r.xmp.props[k]) || '';
    const make = ex('Camera make') || xp('tiff:Make'), model = ex('Camera model') || xp('tiff:Model');
    let camera = model && make && model.toLowerCase().startsWith(make.toLowerCase().split(' ')[0]) ? model : [make, model].filter(Boolean).join(' ');
    const lens = ex('Lens model') || xp('aux:Lens') || xp('exifEX:LensModel');
    const dt = ex('Date taken') || xp('exif:DateTimeOriginal') || xp('photoshop:DateCreated') ||
      [ip('Date created'), ip('Time created')].filter(Boolean).join(' ') || xp('xmp:CreateDate');
    const taken = dt ? niceDate(dt, ex('Time zone (taken)')) : '';
    const png = key => { const c = r.comments.find(c => c.toLowerCase().startsWith(key.toLowerCase() + ': ')); return c ? c.slice(key.length + 2) : ''; };
    // Editing software, oldest first (edit history), then what the file itself names.
    const tools = new Map();
    [...((r.xmp && r.xmp.history) || []).map(h => h.software), xp('xmp:CreatorTool'), ex('Software'), ip('Program'), png('Software')].forEach(t => {
      const k = String(t || '').replace(/\s*\((windows|macintosh|mac os|macos)\)\s*$/i, '').trim();
      if (k && !tools.has(k.toLowerCase()) && !(camera && k.toLowerCase() === camera.toLowerCase())) tools.set(k.toLowerCase(), k);
    });
    const copyright = ex('Copyright') || ip('Copyright notice') || xp('dc:rights') || png('Copyright');
    const creator = ex('Artist') || ip('Creator') || xp('dc:creator') || ex('Windows author') || png('Author');
    const credit = ip('Credit line') || xp('photoshop:Credit');
    const terms = xp('xmpRights:UsageTerms') || ip('Special instructions');
    const webStatement = xp('xmpRights:WebStatement');
    const contact = [xp('Iptc4xmpCore:CreatorContactInfo'), ip('Contact')].filter(Boolean).join('; ');
    const serial = ex('Camera serial number');
    const owner = ex('Camera owner');
    // Signs that the picture was made or changed with AI.
    const ai = [];
    const dst = xp('Iptc4xmpExt:DigitalSourceType');
    if (/compositeWithTrainedAlgorithmicMedia/i.test(dst)) ai.push('XMP says: partly made with AI');
    else if (/trainedAlgorithmicMedia/i.test(dst)) ai.push('XMP says: made with AI');
    if (r.c2pa && r.c2pa.ai) ai.push('Content Credentials: ' + r.c2pa.ai);
    const aiTools = /(dall[\s·-]?e|midjourney|stable diffusion|firefly|imagen|openai|novelai|leonardo\.ai|flux|comfyui|automatic1111|gemini|grok)/i;
    for (const t of tools.values()) if (aiTools.test(t)) ai.push('Made with: ' + t);
    for (const c of r.comments) if (/^parameters:/i.test(c) || aiTools.test(c)) { ai.push('AI generator settings found in the file'); break; }
    r.ai = [...new Set(ai)];
    const meaningful = [camera, taken, r.gps, copyright, creator, credit, tools.size, r.c2pa].filter(Boolean).length;
    const level = r.exif.length + r.iptc.length + (r.xmp ? r.xmp.fields.length : 0) + (r.c2pa ? 1 : 0) + r.comments.length + r.ai.length === 0 ? 'none'
      : meaningful >= 2 || copyright || creator || r.c2pa ? 'rich' : 'some';
    // One plain-English sentence for clients and lawyers.
    const say = [];
    if (level === 'none') say.push('This file has no hidden data. It is probably a screenshot, or a copy re-uploaded to a website or social network, which removes it.');
    else {
      const day = taken ? taken.split(',')[0] : '';
      if (camera || day) say.push('Taken' + (camera ? ' on a ' + camera : '') + (day ? ' on ' + day : '') + (creator ? ' by ' + creator : '') + (r.gps ? ', with the GPS location recorded' : '') + '.');
      else if (creator) say.push('Made by ' + creator + '.');
      if (tools.size) say.push('Edited in ' + [...tools.values()].join(', then ') + '.');
      if (copyright) say.push('Copyright notice: "' + copyright + '".');
      else if (credit) say.push('Credit line: "' + credit + '".');
      if (r.c2pa) say.push('It has Content Credentials' + (r.c2pa.generator ? ' (made with ' + r.c2pa.generator + ')' : '') + '.');
      if (r.ai.length) say.push('It shows signs of being made or changed with AI.');
      if (!say.length) say.push('Only a little hidden data was found, and none of it names a camera, date, author or copyright owner.');
    }
    return { sentence: say.join(' '), camera, lens, taken, gps: r.gps, software: [...tools.values()].join(', '), copyright, creator, credit, terms, webStatement, contact, serial, owner, ai: r.ai, level,
      namesOwner: !!(copyright || creator || credit) };
  }

  function niceDate(s, tz) {
    const m = /^(\d{4})[:-](\d\d)[:-](\d\d)(?:[ T](\d\d):(\d\d)(?::(\d\d))?)?(.*)$/.exec(String(s).trim());
    if (!m) return s;
    const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1] || m[2];
    let out = (+m[3]) + ' ' + mon + ' ' + m[1];
    if (m[4]) { const h = +m[4]; out += ', ' + ((h % 12) || 12) + ':' + m[5] + ' ' + (h < 12 ? 'AM' : 'PM'); }
    const zone = tz || (m[7] || '').replace(/^\.\d+/, '').trim();
    if (zone && /[+-]\d\d:?\d\d|Z/.test(zone)) out += ' (' + (zone === 'Z' ? 'UTC' : 'UTC' + zone) + ')';
    return out;
  }

  // ---------- plain text, for the evidence pack ----------
  function toText(r, opts = {}) {
    const s = r.summary;
    const L = [];
    const row = (k, v) => { if (v) L.push('  ' + (k + ':').padEnd(22) + String(v).replace(/\r?\n/g, ' ')); };
    if (opts.title) L.push(opts.title, '-'.repeat(Math.min(78, opts.title.length)));
    L.push('  In short: ' + s.sentence);
    row('File type', r.format + (r.width ? ', ' + r.width + ' x ' + r.height + ' pixels' : '') + ', ' + r.size + ' bytes');
    if (opts.sha256) row('SHA-256', opts.sha256);
    if (opts.url) row('Found at', opts.url);
    L.push('  Hidden data:          ' + ({ rich: 'YES', some: 'A little', none: 'NONE (stripped, or never added)' })[s.level]);
    row('Camera', s.camera); row('Lens', s.lens); row('Camera serial', s.serial); row('Camera owner', s.owner);
    row('Taken', s.taken);
    if (s.gps) row('GPS', s.gps.lat + ', ' + s.gps.lon + (s.gps.alt != null ? ' (altitude ' + Math.round(s.gps.alt) + ' m)' : '') + '  https://www.google.com/maps?q=' + s.gps.lat + ',' + s.gps.lon);
    row('Software', s.software); row('Creator', s.creator); row('Copyright', s.copyright); row('Credit line', s.credit);
    row('Usage terms', s.terms); row('Rights web page', s.webStatement); row('Contact', s.contact);
    if (s.ai.length) row('AI signs', s.ai.join('; '));
    if (opts.brief) { L.push(''); return L.join('\r\n'); }
    const block = (title, list) => { if (!list.length) return; L.push('', '  ' + title); for (const f of list) L.push('    ' + (f.name + ':').padEnd(28) + String(f.value).replace(/\r?\n/g, ' ')); };
    block('EXIF (camera data)', r.exif);
    block('IPTC (author and copyright)', r.iptc);
    if (r.xmp) {
      block('XMP (Adobe data)', r.xmp.fields);
      if (r.xmp.history.length) { L.push('', '  XMP EDIT HISTORY'); for (const h of r.xmp.history) L.push('    ' + [h.when, h.action, h.software, h.changed && '(' + h.changed + ')'].filter(Boolean).join('  ')); }
    }
    if (r.c2pa) {
      L.push('', '  CONTENT CREDENTIALS (C2PA)  (read, but the signature is NOT checked here; use https://contentcredentials.org/verify)');
      L.push('    Made with:                  ' + (r.c2pa.generator || '(not stated)'));
      if (r.c2pa.actions.length) L.push('    Recorded steps:             ' + r.c2pa.actions.join(', '));
      if (r.c2pa.signers.length) L.push('    Signed by (certificate):    ' + r.c2pa.signers.join('; '));
      if (r.c2pa.ai) L.push('    AI:                         ' + r.c2pa.ai);
    }
    block('OTHER TEXT IN THE FILE', r.comments.map((c, i) => ({ name: 'Comment ' + (i + 1), value: c.slice(0, 2000) })));
    L.push('');
    return L.join('\r\n');
  }

  return { read, toText, niceDate };
})();
