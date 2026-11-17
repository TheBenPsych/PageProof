// Convert files: reading, changing and saving pictures. Uses the browser's own
// picture tools, plus libheif (iPhone HEIC photos), UTIF (TIFF) and gifenc (GIF).
const CVI = (() => {
  const NATIVE = new Set(['jpg', 'jpeg', 'jfif', 'png', 'gif', 'bmp', 'webp', 'avif', 'ico']);
  const ALL = new Set([...NATIVE, 'heic', 'heif', 'tif', 'tiff']);

  function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  let heifLib = null;
  async function heif() {
    if (heifLib) return heifLib;
    await need('heif');
    let lib = globalThis.libheif;
    if (typeof lib === 'function') lib = lib();
    heifLib = await lib;
    if (heifLib.ready) await heifLib.ready;
    return heifLib;
  }

  // Turns any supported picture file into a canvas (the picture as pixels).
  async function decode(file, type) {
    const bytes = file.bytes || await cvBytes(file);
    const kind = type || cvSniff(bytes) || cvExt(file.name);
    if (kind === 'heic' || kind === 'heif') {
      const lib = await heif();
      const dec = new lib.HeifDecoder();
      const imgs = dec.decode(bytes);
      if (!imgs || !imgs.length) throw new Error('This HEIC photo could not be read. It may be damaged.');
      const img = imgs[0];
      const w = img.get_width(), h = img.get_height();
      const data = new ImageData(w, h);
      await new Promise((ok, bad) => img.display(data, d => d ? ok(d) : bad(new Error('This HEIC photo could not be read.'))));
      const c = canvasOf(w, h);
      c.getContext('2d').putImageData(data, 0, 0);
      try { imgs.forEach(i => i.free && i.free()); } catch (e) { /* ignore */ }
      return c;
    }
    if (kind === 'tif' || kind === 'tiff') {
      await need('tiff');
      const ifds = UTIF.decode(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      const page = ifds.find(i => i.t256) || ifds[0];
      UTIF.decodeImage(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), page);
      const rgba = UTIF.toRGBA8(page);
      const c = canvasOf(page.width, page.height);
      c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, page.width * page.height * 4), page.width, page.height), 0, 0);
      return c;
    }
    let bmp;
    try { bmp = await createImageBitmap(new Blob([bytes])); }
    catch (e) { throw new Error('This picture could not be read. It may be damaged, or this browser cannot open ' + (kind || 'this').toUpperCase() + ' files.'); }
    const c = canvasOf(bmp.width, bmp.height);
    c.getContext('2d').drawImage(bmp, 0, 0);
    bmp.close && bmp.close();
    return c;
  }

  function hasAlpha(c) {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 16) if (d[i] < 250) return true;
    return false;
  }
  function onWhite(c) {
    const o = canvasOf(c.width, c.height), x = o.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, o.width, o.height); x.drawImage(c, 0, 0);
    return o;
  }
  const toBlob = (c, type, q) => new Promise((ok, bad) => c.toBlob(b => b ? ok(b) : bad(new Error('The picture could not be saved.')), type, q));

  function bmpBlob(c) {
    const w = c.width, h = c.height, d = onWhite(c).getContext('2d').getImageData(0, 0, w, h).data;
    const row = (w * 3 + 3) & ~3, size = 54 + row * h;
    const out = new Uint8Array(size), v = new DataView(out.buffer);
    out[0] = 66; out[1] = 77; v.setUint32(2, size, true); v.setUint32(10, 54, true);
    v.setUint32(14, 40, true); v.setInt32(18, w, true); v.setInt32(22, h, true); v.setUint16(26, 1, true); v.setUint16(28, 24, true);
    v.setUint32(34, row * h, true); v.setInt32(38, 2835, true); v.setInt32(42, 2835, true);
    for (let y = 0; y < h; y++) {
      let o = 54 + (h - 1 - y) * row;
      for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; out[o++] = d[i + 2]; out[o++] = d[i + 1]; out[o++] = d[i]; }
    }
    return new Blob([out], { type: 'image/bmp' });
  }
  async function gifBlob(c) {
    await need('gif');
    const { GIFEncoder, quantize, applyPalette } = GIFENC;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const alpha = hasAlpha(c);
    const palette = quantize(d, 256, alpha ? { format: 'rgba4444', oneBitAlpha: true } : {});
    const index = applyPalette(d, palette, alpha ? 'rgba4444' : 'rgb565');
    const enc = GIFEncoder();
    const tIdx = alpha ? palette.findIndex(p => p[3] === 0) : -1;
    enc.writeFrame(index, c.width, c.height, { palette, transparent: tIdx >= 0, transparentIndex: Math.max(0, tIdx) });
    enc.finish();
    return new Blob([enc.bytes()], { type: 'image/gif' });
  }

  // ---------- keeping the date and camera details (EXIF) ----------
  function findExif(b) {
    let tiff = null;
    if (b[0] === 0xFF && b[1] === 0xD8) {
      let p = 2;
      while (p + 4 < b.length && b[p] === 0xFF) {
        const m = b[p + 1], len = (b[p + 2] << 8) | b[p + 3];
        if (m === 0xDA || m === 0xD9) break;
        if (m === 0xE1 && b[p + 4] === 0x45 && b[p + 5] === 0x78 && b[p + 6] === 0x69 && b[p + 7] === 0x66) { tiff = b.slice(p + 10, p + 2 + len); break; }
        p += 2 + len;
      }
    } else {
      for (let i = 0; i < Math.min(b.length - 10, 4 * 1024 * 1024); i++) {
        if (b[i] === 0x45 && b[i + 1] === 0x78 && b[i + 2] === 0x69 && b[i + 3] === 0x66 && b[i + 4] === 0 && b[i + 5] === 0 &&
          ((b[i + 6] === 0x49 && b[i + 7] === 0x49) || (b[i + 6] === 0x4D && b[i + 7] === 0x4D))) { tiff = b.slice(i + 6, i + 6 + 65000); break; }
      }
    }
    if (!tiff || tiff.length < 8) return null;
    if (tiff.length > 65000) tiff = tiff.slice(0, 65000);
    // The new picture is already turned the right way, so set "Orientation" to normal.
    try {
      const le = tiff[0] === 0x49, v = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
      const ifd = v.getUint32(4, le), n = v.getUint16(ifd, le);
      for (let k = 0; k < n; k++) {
        const e = ifd + 2 + k * 12;
        if (v.getUint16(e, le) === 0x0112) v.setUint16(e + 8, 1, le);
      }
    } catch (e) { /* leave it */ }
    return tiff;
  }
  function addExif(jpg, tiff) {
    const app = new Uint8Array(10 + tiff.length);
    const len = 8 + tiff.length;
    app.set([0xFF, 0xE1, len >> 8, len & 255, 0x45, 0x78, 0x69, 0x66, 0, 0]);
    app.set(tiff, 10);
    const out = new Uint8Array(jpg.length + app.length);
    out.set(jpg.subarray(0, 2)); out.set(app, 2); out.set(jpg.subarray(2), 2 + app.length);
    return out;
  }

  // Saves a canvas as a picture file. fmt: jpg png webp gif bmp
  async function encode(c, fmt, opt = {}) {
    const q = opt.quality == null ? 0.92 : opt.quality;
    if (fmt === 'jpg' || fmt === 'jpeg') {
      let blob = await toBlob(onWhite(c), 'image/jpeg', q);
      if (opt.exif) blob = new Blob([addExif(new Uint8Array(await blob.arrayBuffer()), opt.exif)], { type: 'image/jpeg' });
      return blob;
    }
    if (fmt === 'png') return toBlob(c, 'image/png');
    if (fmt === 'webp') {
      const b = await toBlob(c, 'image/webp', q);
      if (b.type !== 'image/webp') throw new Error('This browser cannot save WebP pictures. Try JPG or PNG.');
      return b;
    }
    if (fmt === 'gif') return gifBlob(c);
    if (fmt === 'bmp') return bmpBlob(c);
    throw new Error('Unknown picture type ' + fmt);
  }

  // ---------- rotate, flip, crop, resize ----------
  // edit = { rot: 0|90|180|270, flip: bool, crop: {x,y,w,h} as 0..1 of the turned picture, scale: number }
  function turned(c, rot, flip) {
    const side = rot === 90 || rot === 270;
    const o = canvasOf(side ? c.height : c.width, side ? c.width : c.height), x = o.getContext('2d');
    x.translate(o.width / 2, o.height / 2);
    x.rotate(rot * Math.PI / 180);
    if (flip) x.scale(-1, 1);
    x.drawImage(c, -c.width / 2, -c.height / 2);
    return o;
  }
  function resize(c, w, h) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    if (w === c.width && h === c.height) return c;
    let src = c;
    // Shrink in halves first, so big reductions stay sharp.
    while (src.width / 2 >= w && src.height / 2 >= h) {
      const half = canvasOf(Math.round(src.width / 2), Math.round(src.height / 2)), hx = half.getContext('2d');
      hx.imageSmoothingQuality = 'high'; hx.drawImage(src, 0, 0, half.width, half.height); src = half;
    }
    const o = canvasOf(w, h), x = o.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(src, 0, 0, w, h);
    return o;
  }
  function applyEdit(c, e) {
    if (!e) return c;
    let o = (e.rot || e.flip) ? turned(c, e.rot || 0, e.flip) : c;
    if (e.crop && (e.crop.w < 0.999 || e.crop.h < 0.999)) {
      const sx = Math.round(e.crop.x * o.width), sy = Math.round(e.crop.y * o.height);
      const sw = Math.max(1, Math.round(e.crop.w * o.width)), sh = Math.max(1, Math.round(e.crop.h * o.height));
      const k = canvasOf(sw, sh); k.getContext('2d').drawImage(o, sx, sy, sw, sh, 0, 0, sw, sh); o = k;
    }
    if (e.scale && Math.abs(e.scale - 1) > 0.001) o = resize(o, o.width * e.scale, o.height * e.scale);
    return o;
  }

  // ---------- make smaller ----------
  // level 0 (smallest) .. 100 (best quality). Returns a JPG.
  async function shrink(c, level, exif) {
    const t = Math.max(0, Math.min(100, level)) / 100;
    const long = Math.max(c.width, c.height);
    const maxSide = Math.min(long, Math.round(900 + t * 3100));
    const k = maxSide / long;
    const r = k < 1 ? resize(c, c.width * k, c.height * k) : c;
    return encode(r, 'jpg', { quality: 0.4 + 0.52 * t, exif });
  }
  // Finds the best quality (up to maxLevel) that comes in under the size limit.
  async function fitUnder(limit, maxLevel, make) {
    let best = await make(maxLevel);
    if (!limit || best.size <= limit) return { blob: best, level: maxLevel, fits: true };
    let lo = 0, hi = maxLevel, found = null, foundLevel = 0;
    for (let i = 0; i < 7 && lo <= hi; i++) {
      const mid = Math.floor((lo + hi) / 2);
      const b = await make(mid);
      if (b.size <= limit) { found = b; foundLevel = mid; lo = mid + 1; } else hi = mid - 1;
      await cvWait();
    }
    if (found) return { blob: found, level: foundLevel, fits: true };
    const low = await make(0);
    return { blob: low, level: 0, fits: low.size <= limit };
  }

  // A small preview picture for the file cards.
  async function thumb(c, max = 360) {
    const k = Math.min(1, max / Math.max(c.width, c.height));
    const t = k < 1 ? resize(c, c.width * k, c.height * k) : c;
    return URL.createObjectURL(await toBlob(t, 'image/png'));
  }

  return { NATIVE, ALL, decode, encode, applyEdit, turned, resize, shrink, fitUnder, findExif, hasAlpha, thumb, toBlob, canvasOf, onWhite };
})();
