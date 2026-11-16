// Draws simple A4 report pages (banner, picture, headings, tables, text) onto canvases,
// so they can go into a PDF with the same tiny PDF maker as the page captures.
const PP_REPORT = (() => {
  const W = 1240, H = 1754, M = 72;          // A4 at 150 dpi, page margin
  const CW = W - M * 2;
  const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  const MONO = 'ui-monospace, Consolas, "Courier New", monospace';

  const measure = document.createElement('canvas').getContext('2d');
  function wrap(text, font, maxW) {
    measure.font = font;
    const out = [];
    for (const para of String(text == null ? '' : text).split(/\r?\n/)) {
      let line = '';
      for (const word of para.split(/(\s+)/)) {
        if (!word) continue;
        const test = line + word;
        if (measure.measureText(test).width <= maxW) { line = test; continue; }
        if (line.trim()) { out.push(line.trimEnd()); line = ''; }
        let w = word.trimStart();
        while (measure.measureText(w).width > maxW) {   // very long words (web addresses, fingerprints)
          let k = w.length;
          while (k > 1 && measure.measureText(w.slice(0, k)).width > maxW) k = Math.floor(k * 0.9);
          out.push(w.slice(0, k)); w = w.slice(k);
        }
        line = w;
      }
      out.push(line.trimEnd());
    }
    return out;
  }

  // spec: { title, subtitle: [lines], footer, items: [...] }
  // items: { h: 'Heading' } | { p: 'text', color } | { kv: [[key, value, highlight]] } | { image: ImageBitmap, caption } | { mono: 'text' } | { gap: 20 }
  function render(spec) {
    const pages = [];
    let ops = null, y = 0;
    const newPage = () => {
      ops = [];
      pages.push(ops);
      const first = pages.length === 1;
      const bh = first ? 190 : 96;
      ops.push(ctx => {
        ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, W, bh);
        ctx.fillStyle = '#2563eb'; ctx.fillRect(0, bh - 6, W, 6);
        ctx.fillStyle = '#fff'; ctx.font = 'bold ' + (first ? 46 : 30) + 'px ' + FONT; ctx.textBaseline = 'alphabetic';
        ctx.fillText(fit(ctx, spec.title + (first ? '' : '  (continued)'), CW), M, first ? 70 : 58);
        if (first) {
          ctx.font = '22px ' + FONT;
          (spec.subtitle || []).slice(0, 3).forEach((s, i) => { ctx.fillStyle = i ? '#94a3b8' : '#cbd5e1'; ctx.fillText(fit(ctx, s, CW), M, 112 + i * 30); });
        }
      });
      y = bh + 40;
    };
    const room = h => { if (y + h > H - 90) newPage(); };
    newPage();

    for (const it of spec.items) {
      if (it.gap) { y += it.gap; continue; }
      if (it.h) {
        room(110);
        const yy = y;
        ops.push(ctx => {
          ctx.fillStyle = '#1e3a8a'; ctx.font = 'bold 28px ' + FONT; ctx.fillText(it.h, M, yy + 30);
          ctx.fillRect(M, yy + 42, CW, 3);
        });
        y += 62;
        continue;
      }
      if (it.p || it.mono) {
        const font = it.mono ? '19px ' + MONO : (it.bold ? 'bold ' : '') + '21px ' + FONT;
        const lines = wrap(it.p || it.mono, font, CW - (it.box ? 32 : 0));
        const lh = it.mono ? 28 : 31;
        if (it.box) {
          const hBox = lines.length * lh + 26;
          room(hBox);
          const yy = y;
          ops.push(ctx => { ctx.fillStyle = it.box; ctx.fillRect(M, yy, CW, hBox); });
          y += 13;
        }
        for (const line of lines) {
          room(lh);
          const yy = y;
          ops.push(ctx => { ctx.fillStyle = it.color || '#0f172a'; ctx.font = font; ctx.fillText(line, M + (it.box ? 16 : 0), yy + lh - 8); });
          y += lh;
        }
        y += it.box ? 13 + 12 : 12;
        continue;
      }
      if (it.kv) {
        const kw = 330, vx = M + kw + 14, vw = CW - kw - 14;
        for (const [k, v, hl] of it.kv) {
          if (v == null || v === '') continue;
          const vf = (hl ? 'bold ' : '') + '21px ' + FONT;
          const kl = wrap(k, '20px ' + FONT, kw - 10);
          let vl = wrap(v, vf, vw - 10);
          if (vl.length > 40) vl = vl.slice(0, 39).concat('... (the full text is in image-data.txt)');
          const rows = Math.max(kl.length, vl.length), rh = rows * 30 + 14;
          room(rh);
          const yy = y;
          ops.push(ctx => {
            if (hl) { ctx.fillStyle = '#fef9c3'; ctx.fillRect(M, yy, CW, rh); }
            ctx.fillStyle = '#e2e8f0'; ctx.fillRect(M, yy + rh - 1, CW, 1);
            ctx.font = '20px ' + FONT; ctx.fillStyle = '#64748b';
            kl.forEach((l, i) => ctx.fillText(l, M + 10, yy + 29 + i * 30));
            ctx.font = vf; ctx.fillStyle = '#0f172a';
            vl.forEach((l, i) => ctx.fillText(l, vx, yy + 29 + i * 30));
          });
          y += rh;
        }
        y += 18;
        continue;
      }
      if (it.image) {
        const bmp = it.image;
        const maxH = it.maxH || 900;
        const s = Math.min(CW / bmp.width, maxH / bmp.height, 1.5);
        const w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
        room(h + 50);
        const yy = y, x = M + Math.round((CW - w) / 2);
        ops.push(ctx => {
          ctx.fillStyle = '#e2e8f0'; ctx.fillRect(x - 2, yy - 2, w + 4, h + 4);
          ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bmp, x, yy, w, h);
          if (it.caption) { ctx.fillStyle = '#64748b'; ctx.font = '19px ' + FONT; ctx.fillText(fit(ctx, it.caption, CW), M, yy + h + 30); }
        });
        y += h + (it.caption ? 52 : 24);
      }
    }

    return pages.map((list, i) => {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      for (const op of list) op(ctx);
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(M, H - 70, CW, 1);
      ctx.fillStyle = '#94a3b8'; ctx.font = '18px ' + FONT;
      ctx.fillText(fit(ctx, spec.footer || 'PageProof', CW - 200), M, H - 40);
      const pg = 'Page ' + (i + 1) + ' of ' + pages.length;
      ctx.fillText(pg, W - M - ctx.measureText(pg).width, H - 40);
      return c;
    });
  }

  function fit(ctx, text, maxW) {
    text = String(text || '');
    if (ctx.measureText(text).width <= maxW) return text;
    while (text.length > 4 && ctx.measureText(text + '...').width > maxW) text = text.slice(0, -1);
    return text + '...';
  }

  // Turn canvases into pages for makePdf().
  async function pdfPages(canvases) {
    const out = [];
    for (const c of canvases) {
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
      out.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), width: c.width, height: c.height });
    }
    return out;
  }

  return { render, pdfPages };
})();
