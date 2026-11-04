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
  del(id) { return PP_DB.run('readwrite', s => s.delete(id)); }
};
