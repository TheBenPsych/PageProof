// TIFF and HEIC photos: the browser can't draw these by itself, so PageProof reads them with the
// two small readers it already carries for Convert files (lib/UTIF.js and lib/libheif-bundle.js).
// READ ONLY: the file is opened, turned into a picture in this computer's memory, and nothing is
// ever written back. No copy is saved next to the photo and nothing in Google Drive changes.
// Limits keep a huge file from freezing the page: over the limit, the photo is simply left out.
const PP_RAW = (() => {
  const IS = /\.(tiff?|heic|heif)$/i;
  const LIMIT = { heic: 60e6, tiff: 160e6 };   // file size in bytes
  const MAX_PX = 70e6;                         // width x height
  const WAIT = 30000;                          // ms to load a reader
  const scripts = {};
  const script = src => scripts[src] || (scripts[src] = new Promise((ok, bad) => {
    if (typeof document === 'undefined') return bad(new Error('No page to load the reader in.'));
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = () => { delete scripts[src]; bad(new Error('Could not load ' + src)); };
    document.head.append(s);
  }));
  const within = (p, ms) => Promise.race([p, new Promise((_, bad) => setTimeout(() => bad(new Error('The reader took too long to start.')), ms))]);
  const kindOf = name => /\.tiff?$/i.test(name || '') ? 'tiff' : /\.hei[cf]$/i.test(name || '') ? 'heic' : '';
  const is = name => IS.test(name || '');
  const tooBig = (w, h) => !(w > 0 && h > 0) || w * h > MAX_PX;

  let heifLib = null;
  async function heif() {
    if (heifLib) return heifLib;
    await within(script('lib/libheif-bundle.js'), WAIT);
    let lib = globalThis.libheif;
    if (typeof lib === 'function') lib = lib();
    lib = await within(Promise.resolve(lib), WAIT);
    if (lib.ready) await within(Promise.resolve(lib.ready), WAIT);
    return (heifLib = lib);
  }

  // The photo as a picture the browser can draw. Throws (with a plain reason) when it can't.
  async function bitmap(file) {
    const kind = kindOf(file.name);
    if (!kind) throw new Error('Not a TIFF or HEIC photo.');
    if (file.size > LIMIT[kind]) throw new Error('This file is too big for PageProof to read.');
    const buf = await file.arrayBuffer();
    let data;
    if (kind === 'tiff') {
      await within(script('lib/pako.min.js').then(() => script('lib/UTIF.js')), WAIT);
      const ifds = UTIF.decode(buf);
      const page = ifds.filter(i => i.t256 && i.t257).sort((a, b) => b.t256[0] * b.t257[0] - a.t256[0] * a.t257[0])[0];
      if (!page) throw new Error('No picture inside this TIFF.');
      if (tooBig(page.t256[0], page.t257[0])) throw new Error('This picture is too big for PageProof to read.');
      UTIF.decodeImage(buf, page);
      const rgba = UTIF.toRGBA8(page);
      if (!page.width || !page.height || rgba.length < page.width * page.height * 4) throw new Error('This TIFF could not be read.');
      data = new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, page.width * page.height * 4), page.width, page.height);
    } else {
      const lib = await heif();
      const dec = new lib.HeifDecoder();
      const imgs = dec.decode(new Uint8Array(buf));
      if (!imgs || !imgs.length) throw new Error('This HEIC photo could not be read.');
      const img = imgs[0], w = img.get_width(), h = img.get_height();
      try {
        if (tooBig(w, h)) throw new Error('This picture is too big for PageProof to read.');
        data = new ImageData(w, h);
        await new Promise((ok, bad) => img.display(data, d => d ? ok(d) : bad(new Error('This HEIC photo could not be read.'))));
      } finally { try { imgs.forEach(i => i.free && i.free()); } catch (e) { /* already freed */ } }
    }
    return createImageBitmap(data);
  }
  return { is, kindOf, bitmap, LIMIT, MAX_PX };
})();
