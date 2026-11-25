// 4.47 (Ben's pick): your own real test set for the photo checker.
// Every time you Remove a copy the checker called Same photo, or press "It is a copy" on one it
// threw out, PageProof keeps a small pair (your photo and theirs, at most 800 pixels) in
// Documents\PageProof\checker-tests, on this computer only. Nothing is uploaded and nothing goes
// into PageProof's public code. The Checker test (Settings › How PageProof is doing) then runs
// these real pairs too, so mistakes made on your own photos show up, and Claude can read the
// folder to tune the checker on real mistakes.
// Each pair is a folder: ours.jpg, theirs.jpg and pair.json (what you said, what the checker said).
const PP_CTESTS = (() => {
  const api = globalThis.browser || globalThis.chrome;
  const SIZE = 800, MAX = 400, FOLDER = 'checker-tests';
  const Q = [];
  let busy = false;
  const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  const idOf = async s => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))).slice(0, 16);
  const stat = k => { try { PP_STATS.add(k); } catch (e) { /* stats not loaded */ } };

  // The kind of site, going by its address (for "where the checker goes wrong").
  const STOCK = /(shutterstock|gettyimages|istockphoto|alamy|depositphotos|dreamstime|123rf|stock\.adobe|pond5|agefotostock|bigstockphoto|canstockphoto|stockphoto|imago-images|zumapress|apimages)/i;
  const NEWS = /(news|times|post|herald|tribune|gazette|journal|daily|weekly|press|courier|chronicle|observer|telegraph|guardian|reporter|independent|examiner|inquirer|sentinel|globe|star|today|patch\.com|magazine|mag\b)/i;
  const BLOG = /(blogspot|wordpress|medium\.com|tumblr|substack|wixsite|weebly|livejournal|\/blog\/)/i;
  function kindOf(c) {
    const use = typeof FC !== 'undefined' && FC.useOf ? FC.useOf(c) : '';
    if (use === 'social') return 'social';
    if (use === 'shop') return 'shop';
    const s = (c.site || '') + ' ' + (c.url || '');
    if (STOCK.test(s)) return 'stock';
    if (BLOG.test(s)) return 'blog';
    if (NEWS.test(c.site || '') || /\/(news|story|article|articles)\//i.test(c.url || '')) return 'news';
    return 'other';
  }
  const KIND_NAME = { news: 'News sites', social: 'Social media', shop: 'Shops and ads', stock: 'Stock photo sites', blog: 'Blogs', other: 'Other sites' };

  async function folder(create) {
    if (typeof RS_DOCS === 'undefined') return null;
    const d = await RS_DOCS.dir();
    if (!d) return null;
    try { return await d.getDirectoryHandle(FOLDER, { create }); } catch (e) { return null; }
  }
  async function small(blob) {
    const b = await createImageBitmap(blob);
    const f = Math.min(1, SIZE / Math.max(b.width, b.height));
    const w = Math.max(1, Math.round(b.width * f)), h = Math.max(1, Math.round(b.height * f));
    const c = new OffscreenCanvas(w, h);
    c.getContext('2d').drawImage(b, 0, 0, w, h);
    b.close && b.close();
    return c.convertToBlob({ type: 'image/jpeg', quality: 0.88 });
  }
  async function fetchBlob(u) {
    if (!u) return null;
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
      const r = await fetch(u, { credentials: 'omit', signal: ctl.signal });
      clearTimeout(t);
      if (!r.ok) return null;
      const b = await r.blob();
      return b.size > 100 && b.size < 30e6 ? b : null;
    } catch (e) { return null; }
  }
  async function oursOf(c, blob) {
    if (blob) return blob;
    try {
      const p = await FC.DB.get('photos', c.photo);
      if (p && p.rel) { try { return await FC.fileFor(p); } catch (e) { /* Drive not reachable */ } }
      const th = p ? await FC.thumbOf(p) : '';
      return th ? fetchBlob(th) : null;
    } catch (e) { return null; }
  }
  async function write(dir, name, data) {
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(data); await w.close();
  }

  // Keep a pair. truth: 'different' (you removed a Same photo) or 'copy' (you said it is a copy).
  // oursBlob: your photo when it is already open (the search results page has it).
  function keep(c, truth, oursBlob) {
    if (!c || !c.url) return;
    Q.push({ c: { ...c }, truth, oursBlob });
    if (!busy) drain();
  }
  async function drain() {
    busy = true;
    try {
      while (Q.length) {
        const { c, truth, oursBlob } = Q.shift();
        try { await keepOne(c, truth, oursBlob); } catch (e) { stat('ctest.fail'); }
      }
    } finally { busy = false; }
  }
  async function keepOne(c, truth, oursBlob) {
    const dir = await folder(true);
    if (!dir) { stat('ctest.nofolder'); return; }
    const id = await idOf((c.photo || '') + '|' + c.url);
    const [ob, tb] = [await oursOf(c, oursBlob), (await fetchBlob(c.pic && c.pic.url)) || (await fetchBlob(c.img)) || (await fetchBlob(c.thumb))];
    if (!ob || !tb) { stat('ctest.nopicture'); return; }
    const pd = await dir.getDirectoryHandle(id, { create: true });
    await write(pd, 'ours.jpg', await small(ob));
    await write(pd, 'theirs.jpg', await small(tb));
    const info = { v: 1, truth, checker: c.match || c.verdict || '', pct: c.pct ?? null, inl: c.inl ?? null, exact: !!c.exact, kind: kindOf(c),
      site: c.site || '', url: c.url, photo: c.photo || '', copy: c.id || '', at: new Date().toISOString(), version: api.runtime.getManifest().version };
    await write(pd, 'pair.json', JSON.stringify(info, null, 2));
    stat('ctest.kept.' + truth);
    // Only the newest MAX pairs are kept, so the folder stays small (about 100 kB a pair).
    const ix = (await api.storage.local.get('ppCTests')).ppCTests || { ids: [] };
    ix.ids = ix.ids.filter(x => x !== id); ix.ids.push(id);
    while (ix.ids.length > MAX) { const old = ix.ids.shift(); try { await dir.removeEntry(old, { recursive: true }); } catch (e) { /* already gone */ } }
    ix.at = Date.now();
    await api.storage.local.set({ ppCTests: ix });
  }

  // Every pair in the folder: [{ id, info, dir }].
  async function list() {
    const dir = await folder(false);
    if (!dir) return [];
    const out = [];
    for await (const [name, h] of dir.entries()) {
      if (h.kind !== 'directory') continue;
      try { out.push({ id: name, dir: h, info: JSON.parse(await (await (await h.getFileHandle('pair.json')).getFile()).text()) }); } catch (e) { /* half-written pair */ }
    }
    return out;
  }
  const count = async () => ((await api.storage.local.get('ppCTests')).ppCTests || { ids: [] }).ids.length;

  // One pair through the same checker a real search uses: the fast check, then the second look
  // for close calls and Google's exact matches (pp-verdict.js).
  async function check(A, B, exact) {
    await PP_ALIGN.ready;
    const look = async fast => {
      const best = await PP_ALIGN.align(A, B, undefined, { fast });
      if (best && best.sc.lines >= 0.3) { const Sh = PP_ALIGN.shot(A, B, best); Object.assign(best, { backdrop: Sh.backdrop, logos: Sh.logos, place: Sh.place, spot: Sh.emblem || Sh.slice || Sh.pattern, photo: Sh.photo }); }
      return PP_VERDICT.fields(best, 0);
    };
    const m = await look(true), v0 = PP_VERDICT.score(m);
    if (!PP_VERDICT.close(m) && !(exact && (v0 === 'no' || v0 === 'cant'))) return PP_VERDICT.score(m);
    const r = PP_VERDICT.second(m, await look(false), exact);
    return PP_VERDICT.score(r.keep);
  }
  // Runs every pair you still agree with (a Remove you undid, or a copy you removed later, is
  // left out). Returns { n, right, missed, wrongKept, byKind, at }.
  async function run(onStep) {
    const pairs = await list();
    const out = { n: 0, right: 0, missed: 0, wrongKept: 0, byKind: {}, at: Date.now(), skipped: 0 };
    let i = 0;
    for (const P of pairs) {
      i++;
      const t = P.info;
      try {
        const now = t.copy && typeof FC !== 'undefined' ? await FC.DB.get('copies', t.copy) : null;
        if (now && ((t.truth === 'different' && now.status !== 'removed') || (t.truth === 'copy' && now.status === 'removed'))) { out.skipped++; continue; }
        const A = await createImageBitmap(await (await P.dir.getFileHandle('ours.jpg')).getFile());
        const B = await createImageBitmap(await (await P.dir.getFileHandle('theirs.jpg')).getFile());
        let v;
        try { v = await check(A, B, !!t.exact); } finally { A.close && A.close(); B.close && B.close(); }
        const ok = t.truth === 'copy' ? v === 'same' || v === 'maybe' : v === 'no' || v === 'cant';
        const k = out.byKind[t.kind || 'other'] || (out.byKind[t.kind || 'other'] = { n: 0, right: 0 });
        out.n++; k.n++;
        if (ok) { out.right++; k.right++; } else if (t.truth === 'copy') out.missed++; else out.wrongKept++;
      } catch (e) { out.skipped++; }
      if (onStep) onStep(i, pairs.length);
      await new Promise(r => setTimeout(r, 0));
    }
    return out;
  }
  return { keep, list, run, count, kindOf, KIND_NAME, folder, _drain: () => new Promise(r => { const t = setInterval(() => { if (!busy && !Q.length) { clearInterval(t); r(); } }, 100); }) };
})();
