// Small helper for saving captures in the browser's built-in database (IndexedDB).
// Used by both the background script and the viewer page.
const PP_DB = {
  open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('pageproof', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('captures', { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async run(mode, fn) {
    const db = await PP_DB.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('captures', mode);
      const req = fn(tx.objectStore('captures'));
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = () => reject(tx.error);
    });
  },
  put(rec) { return PP_DB.run('readwrite', s => s.put(rec)); },
  get(id) { return PP_DB.run('readonly', s => s.get(id)); },
  keys() { return PP_DB.run('readonly', s => s.getAllKeys()); },
  del(id) { return PP_DB.run('readwrite', s => s.delete(id)); },
  // 4.14: a small picture of the top of a capture, for the Evidence library cards. Kept as
  // 'thumb-<capture id>' (about 15 KB), so it stays after the capture itself is cleared.
  async makeThumb(rec) {
    const t = rec && rec.main && rec.main.tiles && rec.main.tiles[0];
    if (!t) return null;
    const bmp = await createImageBitmap(await (await fetch(t.src)).blob());
    const w = 360, h = Math.round(w * Math.min(0.75, bmp.height / bmp.width));
    const c = new OffscreenCanvas(w, h);
    c.getContext('2d').drawImage(bmp, 0, 0, bmp.width, Math.round(bmp.width * h / w), 0, 0, w, h);
    const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.72 });
    const src = await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
    const out = { id: 'thumb-' + rec.id, src, at: Date.now() };
    await PP_DB.put(out);
    return out;
  }
};
