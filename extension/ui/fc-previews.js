// Bring back missing preview pictures in Copies found.
// The small pictures live in the browser. When PageProof is moved or reinstalled under a new ID
// (4.6.0 fixed the ID, so this is a one-time thing) they are gone, and the copies brought back from
// found-copies.txt have only the page link. This quietly rebuilds them, one at a time:
//  - your client's photo: read again from Google Drive;
//  - their copy: from the picture's address when it is known, otherwise PageProof opens their page,
//    looks at its pictures and keeps the one that lines up with your photo (the same check as
//    "Same photo"). If none lines up well enough, the placeholder stays: a wrong picture is worse.
// Each copy is tried at most once a week. Nothing is uploaded anywhere.
// Then (4.26) copies still waiting for an answer get the newer photo check once (recheck below).
const FC_PREV = (() => {
  let running = false, worker = null, wid = 1;
  const waits = new Map();
  const AGAIN = 7 * 864e5, MIN_PCT = 35, MAX_CANDIDATES = 24;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function smallJpeg(blob, max = 240) {
    const bmp = await createImageBitmap(blob);
    const f = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = new OffscreenCanvas(Math.max(1, Math.round(bmp.width * f)), Math.max(1, Math.round(bmp.height * f)));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close && bmp.close();
    const b = await c.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
    return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
  }
  async function get(url, ms = 15000, image = true) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctl.signal });
      if (!r.ok) return null;
      const type = (r.headers.get('content-type') || '').toLowerCase();
      if (image && type && !type.startsWith('image/')) return null;
      if (!image && type && !/html|xml/.test(type)) return null;
      return image ? await r.blob() : await r.text();
    } catch (e) { return null; } finally { clearTimeout(t); }
  }
  // The pictures on their page, most likely first (the page's share picture, then big pictures).
  function candidates(html, base) {
    const doc = new DOMParser().parseFromString(html, 'text/html'), out = [];
    const add = u => { if (!u) return; try { const x = new URL(u.trim(), base).href; if (/^https?:/i.test(x) && !/\.svg(\?|$)/i.test(x) && !out.includes(x)) out.push(x); } catch (e) { /* bad link */ } };
    for (const s of ['meta[property="og:image"]', 'meta[property="og:image:url"]', 'meta[name="twitter:image"]', 'meta[name="twitter:image:src"]']) doc.querySelectorAll(s).forEach(m => add(m.getAttribute('content')));
    doc.querySelectorAll('link[rel="image_src"]').forEach(l => add(l.getAttribute('href')));
    for (const img of doc.querySelectorAll('img, source')) {
      const set = img.getAttribute('srcset') || img.getAttribute('data-srcset');
      if (set) { const biggest = set.split(',').map(s => s.trim().split(/\s+/)).sort((a, b) => (parseFloat(b[1]) || 0) - (parseFloat(a[1]) || 0))[0]; if (biggest) add(biggest[0]); }
      for (const a of ['data-src', 'data-lazy-src', 'data-original', 'src']) add(img.getAttribute(a));
      if (out.length >= MAX_CANDIDATES) break;
    }
    return out.slice(0, MAX_CANDIDATES);
  }
  // How well a picture lines up with your photo, 0-100 (score-worker.js, the "Same photo" check).
  function ask(msg, transfer) {
    if (!worker) {
      worker = new Worker('score-worker.js');
      worker.onmessage = e => { const r = waits.get(e.data.id); if (r) { waits.delete(e.data.id); r(e.data); } };
      worker.onerror = () => { for (const r of waits.values()) r({ err: 'stopped' }); waits.clear(); try { worker.terminate(); } catch (x) { /* gone */ } worker = null; };
    }
    if (!('id' in msg)) { worker.postMessage(msg, transfer); return Promise.resolve(); }
    return new Promise(res => {
      waits.set(msg.id, res); worker.postMessage(msg, transfer);
      setTimeout(() => { if (waits.has(msg.id)) { waits.delete(msg.id); res({ err: 'slow' }); try { worker.terminate(); } catch (x) { /* gone */ } worker = null; } }, 30000);
    });
  }
  const bitmap640 = async blob => { const b = await createImageBitmap(blob); const f = Math.min(1, 640 / Math.max(b.width, b.height)); if (f >= 1) return b; const s = await createImageBitmap(b, { resizeWidth: Math.round(b.width * f), resizeHeight: Math.round(b.height * f), resizeQuality: 'high' }); b.close && b.close(); return s; };
  async function lineUp(key, blob) {
    try {
      const bmp = await bitmap640(blob);
      if (Math.min(bmp.width, bmp.height) < 80) { bmp.close && bmp.close(); return 0; }
      const r = await ask({ type: 'check', id: wid++, key, bmp }, [bmp]);
      return r && r.out && !r.out.none ? Math.round(r.out.lines * 100) : 0;
    } catch (e) { return 0; }
  }

  async function photoFile(id) {
    const p = await FC.DB.get('photos', id);
    if (p && p.rel) return { p, file: await FC.fileFor(p) };
    if (!String(id).startsWith('d:') || String(id).startsWith('d:+')) return { p: null, file: null };
    return { p: null, file: await FC.fileFor({ rel: String(id).slice(2) }) };
  }

  async function fixOne(c) {
    let changed = false, ours = null;
    // Your client's photo.
    try {
      const { p, file } = await photoFile(c.photo);
      if (file) {
        ours = file;
        if (p && !p.thumb && !p.th) { const pic = await smallJpeg(file); const now = await FC.DB.get('photos', p.id); if (now && !now.thumb && !now.th) { await FC.setThumb('photos', now, pic); changed = true; } }
      }
    } catch (e) { /* Drive not reachable for this one */ }
    // Their copy.
    let blob = null, from = '';
    if (/^https?:/i.test(c.img || '')) { blob = await get(c.img); from = c.img; }
    if (!blob && ours && /^https?:/i.test(c.url || '')) {
      const html = await get(c.url, 20000, false);
      if (html) {
        const key = 'o' + wid++;
        try {
          const ob = await bitmap640(ours);
          await ask({ type: 'orig', key, bmp: ob }, [ob]);
          let best = 0;
          for (const u of candidates(html, c.url)) {
            const b = await get(u, 12000);
            if (!b || b.size < 3000) continue;
            const pct = await lineUp(key, b);
            if (pct > best) { best = pct; blob = b; from = u; }
            if (pct >= 70) break;
          }
          if (best < MIN_PCT) { blob = null; from = ''; }
        } finally { ask({ type: 'forget', key }); }
      }
    }
    let pic = '';
    if (blob) { try { pic = await smallJpeg(blob); } catch (e) { /* not a picture after all */ } }
    // Read the copy again right before saving and change only the picture fields, so an answer
    // given meanwhile (Stolen, Licensed…) is never written over.
    const fresh = await FC.DB.get('copies', c.id);
    if (!fresh) return changed;
    fresh.thTried = new Date().toISOString();
    if (pic) {
      if (from && !fresh.img) fresh.img = from;
      await FC.setThumb('copies', fresh, pic);
      FC.keepSoon([fresh]);   // also keep their file again, for evidence
      return true;
    }
    await FC.DB.put('copies', fresh);
    return changed;
  }

  // 4.26: copies found before the "only logos / same place" check are checked once more, with
  // the same check as new searches. Another photo of the same place moves to Removed (Put back
  // works). Copies you already answered or added by hand are never touched.
  const SHOT_CHECK = 6;
  async function recheckOne(c) {
    const { file } = await photoFile(c.photo);
    if (!file) return null;
    const blob = await get(c.img);
    if (!blob) return null;
    const key = 'r' + wid++;
    try {
      const ob = await bitmap640(file);
      await ask({ type: 'orig', key, bmp: ob }, [ob]);
      const bmp = await bitmap640(blob);
      if (Math.min(bmp.width, bmp.height) < 80) { bmp.close && bmp.close(); return { none: true }; }
      const r = await ask({ type: 'check', id: wid++, key, bmp }, [bmp]);
      return r && r.out ? r.out : null;
    } catch (e) { return null; } finally { ask({ type: 'forget', key }); }
  }
  async function recheck() {
    const now = Date.now();
    const old = (await FC.allCopies()).filter(c => c.status === 'new' && (c.shotCheck || 0) < SHOT_CHECK && !/by hand/.test(c.by || '')
      && /^https?:/i.test(c.img || '') && !(c.shotTried && now - Date.parse(c.shotTried) < AGAIN));
    let gone = 0;
    for (const c of old) {
      if (document.hidden) await new Promise(r => { const f = () => { if (!document.hidden) { document.removeEventListener('visibilitychange', f); r(); } }; document.addEventListener('visibilitychange', f); });
      const out = await recheckOne(c);
      const fresh = await FC.DB.get('copies', c.id);
      if (!fresh || fresh.status !== 'new') continue;          // answered meanwhile: leave it
      if (out && !out.none && (out.logos || out.place || out.backdrop)) {
        if (await FC.checkerRemove(c.id, out.photo !== null && out.photo !== undefined ? Math.round(out.photo * 100) : undefined)) gone++;
        continue;
      }
      if (out) fresh.shotCheck = SHOT_CHECK; else fresh.shotTried = new Date().toISOString();
      await FC.DB.put('copies', fresh);
      await sleep(400);
    }
    if (gone && typeof toast === 'function') toast(gone + (gone === 1 ? ' copy was another photo' : ' copies were other photos') + ' of the same place (only logos or the building lined up), so ' + (gone === 1 ? 'it was' : 'they were') + ' moved to Removed. Put back is still there.');
  }

  async function start() {
    if (running) return;
    running = true;
    try {
      const now = Date.now();
      const all = await FC.allCopies();
      // First your clients' photos that have no preview (read from Drive; quick).
      const pids = [...new Set(all.filter(c => c.status !== 'removed').map(c => c.photo))];
      let made = 0;
      for (const p of (await FC.DB.getMany('photos', pids)).filter(p => p && p.rel && !p.thumb && !p.th)) {
        try { const pic = await smallJpeg(await FC.fileFor(p)); const now = await FC.DB.get('photos', p.id); if (now && !now.thumb && !now.th) { await FC.setThumb('photos', now, pic); made++; } } catch (e) { /* Drive not reachable */ }
        if (made && made % 10 === 0) FC.touch('photos');
      }
      if (made % 10) FC.touch('photos');
      const need = all.filter(c => c.status !== 'removed' && !c.thumb && !c.th && !(c.thTried && now - Date.parse(c.thTried) < AGAIN))
        .sort((a, b) => (a.status === 'new' ? 0 : 1) - (b.status === 'new' ? 0 : 1) || String(b.firstSeen || '').localeCompare(String(a.firstSeen || '')));
      let n = 0;
      for (const c of need) {
        if (document.hidden) await new Promise(r => { const f = () => { if (!document.hidden) { document.removeEventListener('visibilitychange', f); r(); } }; document.addEventListener('visibilitychange', f); });
        if (await fixOne(c)) n++;
        if (n && n % 4 === 0) FC.touch('copies');   // show what's back so far
        await sleep(800);
      }
      if (n % 4) FC.touch('copies');
      await recheck();
    } catch (e) { /* try again next time Copies found opens */ }
    finally { running = false; if (worker) { try { worker.terminate(); } catch (x) { /* gone */ } worker = null; } }
  }
  return { start, candidates };
})();
