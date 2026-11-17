// Convert files: PDF tools. pdf-lib builds and changes PDFs, pdf.js draws page previews.
const CVP = (() => {
  const PAGE = { letter: [612, 792], a4: [595.28, 841.89] };

  async function load(bytes) {
    await need('pdflib');
    let doc;
    try { doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false }); }
    catch (e) { throw new Error('This PDF could not be read. It may be damaged.'); }
    if (doc.isEncrypted) throw new Error('This PDF is locked with a password, so PageProof cannot change it. Open it, print it to a new PDF, then try again.');
    return doc;
  }
  async function pageCount(bytes) {
    try { return (await load(bytes)).getPageCount(); } catch (e) { return (await jsDoc(bytes)).numPages; }
  }

  // ---------- page previews (pdf.js) ----------
  const jsDocs = new WeakMap();
  async function jsDoc(bytes) {
    await need('pdfjs');
    if (!jsDocs.has(bytes)) jsDocs.set(bytes, pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: false }).promise);
    return jsDocs.get(bytes);
  }
  async function renderPage(bytes, index, width) {
    const doc = await jsDoc(bytes);
    const page = await doc.getPage(index + 1);
    const v1 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: width / v1.width });
    const c = document.createElement('canvas');
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: x, viewport: vp }).promise;
    return c;
  }

  // ---------- pictures as PDF pages ----------
  async function embedPicture(out, canvas) {
    if (CVI.hasAlpha(canvas)) return out.embedPng(new Uint8Array(await (await CVI.encode(canvas, 'png')).arrayBuffer()));
    return out.embedJpg(new Uint8Array(await (await CVI.encode(canvas, 'jpg', { quality: 0.92 })).arrayBuffer()));
  }
  async function addPicturePage(out, canvas, size) {
    const img = await embedPicture(out, canvas);
    if (size === 'fit' || !PAGE[size]) {
      const w = canvas.width * 0.75, h = canvas.height * 0.75; // 96 pixels per inch
      const page = out.addPage([w, h]);
      page.drawImage(img, { x: 0, y: 0, width: w, height: h });
      return page;
    }
    let [pw, ph] = PAGE[size];
    if (canvas.width > canvas.height) [pw, ph] = [ph, pw];
    const page = out.addPage([pw, ph]);
    const m = 36, k = Math.min((pw - 2 * m) / canvas.width, (ph - 2 * m) / canvas.height);
    const w = canvas.width * k, h = canvas.height * k;
    page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    return page;
  }
  async function picturesToPdf(canvases, size = 'fit', title) {
    await need('pdflib');
    const out = await PDFLib.PDFDocument.create();
    for (const c of canvases) await addPicturePage(out, c, size);
    if (title) out.setTitle(title);
    out.setProducer('PageProof'); out.setCreator('PageProof Convert files');
    return new Blob([await out.save()], { type: 'application/pdf' });
  }

  // ---------- join ----------
  // items: [{ kind:'pdf', bytes, title, pages:[{ index, rot }] } | { kind:'picture', canvas, title }]
  async function join(items, opt = {}) {
    await need('pdflib');
    const { degrees } = PDFLib;
    const out = await PDFLib.PDFDocument.create();
    const marks = [];
    for (const it of items) {
      const first = out.getPageCount();
      if (it.kind === 'pdf') {
        const src = await load(it.bytes);
        const copied = await out.copyPages(src, it.pages.map(p => p.index));
        copied.forEach((pg, k) => {
          const add = it.pages[k].rot || 0;
          if (add) pg.setRotation(degrees((pg.getRotation().angle + add) % 360));
          out.addPage(pg);
        });
      } else {
        const pg = await addPicturePage(out, it.canvas, opt.pictureSize || 'letter');
        if (it.rot) pg.setRotation(degrees(it.rot));
      }
      if (out.getPageCount() > first) marks.push({ title: it.title, page: first });
      await cvWait();
    }
    if (opt.bookmarks && marks.length) addOutline(out, marks);
    out.setProducer('PageProof'); out.setCreator('PageProof Convert files');
    if (opt.title) out.setTitle(opt.title);
    return new Blob([await out.save()], { type: 'application/pdf' });
  }
  function addOutline(doc, marks) {
    const { PDFName, PDFString, PDFNumber, PDFNull } = PDFLib;
    const ctx = doc.context;
    const rootRef = ctx.nextRef();
    const refs = marks.map(() => ctx.nextRef());
    const pages = doc.getPages();
    marks.forEach((m, i) => {
      const d = ctx.obj({});
      d.set(PDFName.of('Title'), PDFString.of(m.title));
      d.set(PDFName.of('Parent'), rootRef);
      if (i > 0) d.set(PDFName.of('Prev'), refs[i - 1]);
      if (i < marks.length - 1) d.set(PDFName.of('Next'), refs[i + 1]);
      d.set(PDFName.of('Dest'), ctx.obj([pages[m.page].ref, PDFName.of('Fit')]));
      ctx.assign(refs[i], d);
    });
    const root = ctx.obj({});
    root.set(PDFName.of('Type'), PDFName.of('Outlines'));
    root.set(PDFName.of('First'), refs[0]);
    root.set(PDFName.of('Last'), refs[refs.length - 1]);
    root.set(PDFName.of('Count'), PDFNumber.of(marks.length));
    ctx.assign(rootRef, root);
    doc.catalog.set(PDFName.of('Outlines'), rootRef);
    doc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
    void PDFNull;
  }

  // ---------- split / pick pages ----------
  async function pick(bytes, indexes) {
    const src = await load(bytes);
    const out = await PDFLib.PDFDocument.create();
    (await out.copyPages(src, indexes)).forEach(p => out.addPage(p));
    out.setProducer('PageProof');
    return new Blob([await out.save()], { type: 'application/pdf' });
  }

  // ---------- make smaller ----------
  // Finds the pictures inside a PDF once, so trying different sizes is quick.
  function inflate(data) { return pako.inflate(data); }
  function unpredict(data, cols, colors, bpc) {
    const bpp = Math.max(1, (colors * bpc) >> 3), row = (cols * colors * bpc + 7) >> 3;
    const rows = Math.floor(data.length / (row + 1));
    const out = new Uint8Array(rows * row);
    for (let y = 0; y < rows; y++) {
      const f = data[y * (row + 1)], src = y * (row + 1) + 1, dst = y * row;
      for (let x = 0; x < row; x++) {
        const a = x >= bpp ? out[dst + x - bpp] : 0, b = y ? out[dst - row + x] : 0, c = y && x >= bpp ? out[dst - row + x - bpp] : 0;
        let v = data[src + x];
        if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
        else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
        out[dst + x] = v & 255;
      }
    }
    return out;
  }
  async function findPictures(bytes) {
    await need('pdflib'); await need('pako');
    const { PDFName, PDFRawStream, PDFArray, PDFNumber, PDFRef } = PDFLib;
    const doc = await load(bytes);
    const ctx = doc.context;
    const found = [];
    const look = v => v instanceof PDFRef ? ctx.lookup(v) : v;
    for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
      if (!(obj instanceof PDFRawStream)) continue;
      const d = obj.dict;
      if (String(d.get(PDFName.of('Subtype'))) !== '/Image') continue;
      if (d.get(PDFName.of('ImageMask')) || d.get(PDFName.of('Mask')) || d.get(PDFName.of('Decode'))) continue;
      const w = look(d.get(PDFName.of('Width'))), h = look(d.get(PDFName.of('Height')));
      const W = w instanceof PDFNumber ? w.asNumber() : 0, H = h instanceof PDFNumber ? h.asNumber() : 0;
      if (W * H < 40000) continue; // tiny pictures are not worth it
      let filter = look(d.get(PDFName.of('Filter')));
      if (filter instanceof PDFArray) filter = filter.size() === 1 ? look(filter.get(0)) : null;
      filter = filter ? String(filter) : '';
      let cs = look(d.get(PDFName.of('ColorSpace'))), comps = 0;
      if (cs && String(cs) === '/DeviceRGB') comps = 3;
      else if (cs && String(cs) === '/DeviceGray') comps = 1;
      else if (cs instanceof PDFArray && String(look(cs.get(0))) === '/ICCBased') {
        const icc = look(cs.get(1)); const n = icc && icc.dict ? look(icc.dict.get(PDFName.of('N'))) : null;
        comps = n instanceof PDFNumber ? n.asNumber() : 0;
        if (comps !== 1 && comps !== 3) comps = 0;
      }
      if (!comps) continue; // CMYK and special colours are left as they are
      let canvas = null;
      try {
        if (filter === '/DCTDecode') {
          const bmp = await createImageBitmap(new Blob([obj.contents], { type: 'image/jpeg' }));
          canvas = CVI.canvasOf(bmp.width, bmp.height); canvas.getContext('2d').drawImage(bmp, 0, 0);
        } else if (filter === '/FlateDecode') {
          const bpc = look(d.get(PDFName.of('BitsPerComponent')));
          if (!(bpc instanceof PDFNumber) || bpc.asNumber() !== 8) continue;
          let raw = inflate(obj.contents);
          const parms = look(d.get(PDFName.of('DecodeParms')));
          if (parms && parms.get) {
            const pr = look(parms.get(PDFName.of('Predictor')));
            if (pr instanceof PDFNumber && pr.asNumber() >= 10) raw = unpredict(raw, W, comps, 8);
            else if (pr instanceof PDFNumber && pr.asNumber() > 1) continue;
          }
          if (raw.length < W * H * comps) continue;
          const id = new ImageData(W, H), px = id.data;
          for (let i = 0, j = 0; i < W * H; i++) {
            if (comps === 3) { px[j++] = raw[i * 3]; px[j++] = raw[i * 3 + 1]; px[j++] = raw[i * 3 + 2]; }
            else { const g = raw[i]; px[j++] = g; px[j++] = g; px[j++] = g; }
            px[j++] = 255;
          }
          canvas = CVI.canvasOf(W, H); canvas.getContext('2d').putImageData(id, 0, 0);
        } else continue;
      } catch (e) { continue; }
      found.push({ ref, canvas, oldSize: obj.contents.length });
      await cvWait();
    }
    return { bytes, count: found.length, pictures: found };
  }
  async function shrink(prep, level) {
    const { PDFName, PDFRawStream, PDFNumber } = PDFLib;
    const doc = await load(prep.bytes);
    const ctx = doc.context;
    const t = Math.max(0, Math.min(100, level)) / 100;
    const maxSide = Math.round(700 + t * 2300), q = 0.35 + 0.55 * t;
    for (const p of prep.pictures) {
      const c = p.canvas, long = Math.max(c.width, c.height), k = Math.min(1, maxSide / long);
      const r = k < 1 ? CVI.resize(c, c.width * k, c.height * k) : c;
      const jpg = new Uint8Array(await (await CVI.encode(r, 'jpg', { quality: q })).arrayBuffer());
      if (jpg.length > p.oldSize * 0.9) continue;
      const old = ctx.lookup(p.ref);
      const dict = old.dict.clone(ctx);
      dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
      dict.delete(PDFName.of('DecodeParms'));
      dict.set(PDFName.of('Width'), PDFNumber.of(r.width));
      dict.set(PDFName.of('Height'), PDFNumber.of(r.height));
      dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
      dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
      dict.set(PDFName.of('Length'), PDFNumber.of(jpg.length));
      ctx.assign(p.ref, PDFRawStream.of(dict, jpg));
      await cvWait();
    }
    doc.setProducer('PageProof');
    return new Blob([await doc.save({ useObjectStreams: true })], { type: 'application/pdf' });
  }

  return { load, pageCount, renderPage, picturesToPdf, join, pick, findPictures, shrink, PAGE };
})();
