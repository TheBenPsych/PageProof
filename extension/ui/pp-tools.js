// Tools › All tools in the calm look (step 17): app.html#tools
// Six real tools, one "drop any file" box that opens the right tool, and "Opened lately": the
// files opened in a tool on this computer, with Open again. The list is kept only in this browser
// (file names, the tool, the time, a tiny picture). It is never put in a backup or a team list.
// Open again uses the browser's own "remember this file" pass, which only ever reads the file.
const PP_TOOL_LIST = [
  ['inspect', 'Inspect a photo', 'Read the hidden data inside a photo: camera, date, creator, copyright.', 'A photo', '#8250DF', 'inspect'],
  ['compare', 'Compare two photos', 'Lay a copy over the original and line them up.', 'Two photos', '#00818A', 'compare'],
  ['markup', 'Mark up a copy', 'Highlight, box and arrow on a capture. The pack is never changed.', 'A capture or picture', '#CA5010', 'markup'],
  ['files', 'Convert files', 'Turn photos and documents into JPG, PNG or one PDF.', 'Any photos or PDFs', '#0067C0', 'convert'],
  ['openfiles', 'Open odd files', 'See HEIC, TIFF, RAW and other files your computer cannot open.', 'Any file', '#5B6A7A', 'open'],
  ['verify', 'Verify a pack', 'Show that an evidence pack has not changed since it was made.', 'An evidence pack (.zip)', '#0F7B0F', 'verify'],
];
const TLI = (() => {
  const s = (p, z = 16) => `<svg viewBox="0 0 16 16" width="${z}" height="${z}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  return {
    inspect: s('<rect x="1.5" y="2.5" width="10" height="8" rx="1"/><path d="m2.5 9 2.5-2.5 2 2 1.5-1.5 2 2"/><circle cx="11.5" cy="11.5" r="2.6"/><path d="m13.4 13.4 1.4 1.4"/>'),
    compare: s('<rect x="1.8" y="3.5" width="8" height="8" rx="1"/><rect x="6.2" y="4.5" width="8" height="8" rx="1"/>'),
    markup: s('<path d="M10.5 2.5l3 3L6 13H3v-3z"/><path d="M9 4l3 3"/>'),
    convert: s('<path d="M2.5 5.5h10l-2.5-2.5M13.5 10.5h-10l2.5 2.5"/>'),
    open: s('<path d="M4 1.8h5.5L12.5 5v9.2H4z"/><path d="M9.5 1.8V5h3"/><path d="M6 9.5h4M8 7.5v4"/>'),
    verify: s('<path d="M8 1.6 13.2 3.5v4c0 3.2-2.2 5.6-5.2 6.9C5 13.1 2.8 10.7 2.8 7.5v-4z"/><path d="m5.6 8 1.7 1.7 3.2-3.4"/>'),
    up: s('<path d="M8 10.5V2.5M5 5.5l3-3 3 3"/><path d="M2.5 10v2.8a.7.7 0 0 0 .7.7h9.6a.7.7 0 0 0 .7-.7V10"/>'),
    file: s('<path d="M4 1.8h5.5L12.5 5v9.2H4z"/><path d="M9.5 1.8V5h3"/>'),
    zip: s('<rect x="2.5" y="1.8" width="11" height="12.4" rx="1"/><path d="M7 1.8v2h2v2H7v2h2v2H7"/>'),
    folder: s('<path d="M1.8 4.2a1 1 0 0 1 1-1h3.4l1.5 1.6h5.5a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1z"/>'),
    chev: s('<path d="m6 3.5 4.5 4.5L6 12.5"/>', 14),
    x: s('<path d="M4 4l8 8M12 4l-8 8"/>', 14),
  };
})();

const PP_TOOLS = (() => {
  const KEY = 'ppToolsRecent', MAX = 8;
  const PHOTO = /\.(jpe?g|png|webp|gif|avif|bmp|heic|heif|tiff?|jxl)$/i;
  const fkey = f => [f.name, f.size, f.lastModified].join('|');
  const passes = new Map();   // file key -> a promise of the browser's pass for that file (when it gives one)
  // ---- the passes are kept in a small database of their own (they can't go in normal storage)
  const idb = () => new Promise((ok, bad) => { const r = indexedDB.open('pp-tools', 1); r.onupgradeneeded = () => r.result.createObjectStore('passes'); r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error); });
  const idbDo = async (mode, fn) => { const db = await idb(); try { return await new Promise((ok, bad) => { const t = db.transaction('passes', mode), q = fn(t.objectStore('passes')); t.oncomplete = () => ok(q && q.result); t.onerror = t.onabort = () => bad(t.error); }); } finally { db.close(); } };

  const recent = async () => ((await api.storage.local.get(KEY))[KEY] || []).filter(r => r && r.id && Array.isArray(r.names));
  // Which tool a dropped file belongs in.
  function toolFor(files) {
    const ext = f => ((/\.([a-z0-9]+)$/i.exec(f.name) || [])[1] || '').toLowerCase(), photo = f => PHOTO.test(f.name) || /^image\//.test(f.type || '');
    if (files.length === 1 && ext(files[0]) === 'zip') return 'verify';
    if (files.length === 2 && files.every(photo)) return 'compare';
    if (files.length === 1 && photo(files[0])) return 'inspect';
    if (files.length === 1 && ext(files[0]) === 'pdf' && /^PageProof_/i.test(files[0].name)) return 'markup';
    return 'files';
  }
  // A tiny picture of a photo for the list (never the photo itself). Empty when it can't be drawn.
  async function thumbOf(file) {
    try {
      if (!file || !(/^image\//.test(file.type || '') || PHOTO.test(file.name || ''))) return '';
      const bmp = await createImageBitmap(file), k = Math.min(1, 112 / bmp.width, 80 / bmp.height), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); if (bmp.close) bmp.close();
      const url = c.toDataURL('image/jpeg', 0.7);
      return url.length < 12000 ? url : '';
    } catch (e) { return ''; }
  }
  let chain = Promise.resolve();
  // A tool opened these files: put them on top of "Opened lately".
  function note(tool, files) {
    files = [...files].filter(f => f && f.name);
    if (!files.length) return chain;
    chain = chain.then(async () => {
      const names = files.length <= 2 ? files.map(f => f.name) : [files[0].name, (files.length - 1) + ' more'];
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      const hs = (await Promise.all(files.map(f => passes.get(fkey(f)) || null))).filter(Boolean);
      const list = await recent(), same = r => r.tool === tool && r.names.join('|') === names.join('|');
      const gone = list.filter(same).map(r => r.id).concat(list.filter(r => !same(r)).slice(MAX - 1).map(r => r.id));
      const rec = { id, tool, names, at: Date.now(), thumb: await thumbOf(files[0]), again: hs.length === files.length && files.length <= 2 };
      await api.storage.local.set({ [KEY]: [rec, ...list.filter(r => !same(r))].slice(0, MAX) });
      await idbDo('readwrite', s => { for (const g of gone) s.delete(g); if (rec.again) s.put(hs, id); }).catch(() => {});
    }).catch(() => {});
    return chain;
  }
  async function forget(id) {
    await api.storage.local.set({ [KEY]: (await recent()).filter(r => r.id !== id) });
    await idbDo('readwrite', s => { s.delete(id); }).catch(() => {});
  }
  // Remember the browser's pass for files dropped on a page (Chrome and Edge give one; Firefox does not).
  function watchDrops(win) {
    win.addEventListener('drop', e => {
      for (const it of (e.dataTransfer && e.dataTransfer.items) || []) {
        if (it.kind !== 'file' || !it.getAsFileSystemHandle) continue;
        const f = it.getAsFile(); if (!f) continue;
        passes.set(fkey(f), it.getAsFileSystemHandle().then(h => h && h.kind === 'file' ? h : null).catch(() => null));
      }
    }, true);
  }
  // ---- handing files to a tool's page (it sits in a frame)
  let waiting = null;   // { tool, files }
  const GIVE = {
    inspect: (w, fs) => w.inspectFile(fs[0]),
    compare: async (w, fs) => { await w.setPicture('A', fs[0], fs[0].name); if (fs[1]) await w.setPicture('B', fs[1], fs[1].name); },
    markup: (w, fs) => w.openFile(fs[0]),
    files: (w, fs) => w.addFiles(fs), openfiles: (w, fs) => w.addFiles(fs),
    verify: (w, fs) => w.handle(fs[0]),
  };
  function give(tool, files) {
    waiting = { tool, files: [...files] };
    if (route() === tool) { const f = document.querySelector('#view iframe.tool'); if (f) frame(tool, f); } else location.hash = tool;
  }
  // Each time a tool's own code takes a file, note it for "Opened lately".
  function hook(tool, w) {
    if (w.__ppHooked) return; w.__ppHooked = true;
    watchDrops(w);
    const wrap = (name, pick) => { const orig = w[name]; if (typeof orig !== 'function') return; w[name] = function (...a) { try { const fs = pick(...a); if (fs) note(tool, fs); } catch (e) { /* the list is a nicety */ } return orig.apply(this, a); }; };
    if (tool === 'inspect') wrap('inspectFile', f => [f]);
    if (tool === 'markup') wrap('openFile', f => [f]);
    if (tool === 'files' || tool === 'openfiles') wrap('addFiles', list => [...list]);
    if (tool === 'verify') wrap('handle', f => /\.zip$/i.test(f.name || '') ? [f] : null);
    if (tool === 'compare') { const cur = {}; wrap('setPicture', (k, blob, name) => { cur[k] = blob instanceof w.File || blob instanceof File ? blob : (blob ? new File([blob], name || 'picture', { type: blob.type }) : null); return cur.A && cur.B ? [cur.A, cur.B] : null; }); }
  }
  // Called by the app whenever a tool's frame is on screen.
  function frame(tool, f) {
    const run = () => {
      let w; try { w = f.contentWindow; if (!w || !GIVE[tool] || !w.document.body) return; } catch (e) { return; }
      hook(tool, w);
      if (waiting && waiting.tool === tool) { const fs = waiting.files; waiting = null; Promise.resolve().then(() => GIVE[tool](w, fs)).catch(e => toast('That file could not be opened: ' + (e && e.message || e))); }
    };
    let ready = false; try { ready = f.contentDocument.readyState === 'complete' && f.contentWindow.location.href !== 'about:blank'; } catch (e) { /* not ready */ }
    if (ready) run(); else f.addEventListener('load', run, { once: true });
  }
  // Dropped or chosen on All tools: open the right tool with them.
  function take(files) {
    files = [...files].filter(f => f && f.name);
    if (!files.length) return;
    give(toolFor(files), files);
  }
  async function choose() {
    if (window.showOpenFilePicker) {
      let hs; try { hs = await window.showOpenFilePicker({ multiple: true }); } catch (e) { return; }   // closed the window
      const files = await Promise.all(hs.map(h => h.getFile()));
      files.forEach((f, i) => passes.set(fkey(f), Promise.resolve(hs[i])));
      return take(files);
    }
    const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.onchange = () => take(inp.files); inp.click();
  }
  async function openAgain(id) {
    const rec = (await recent()).find(r => r.id === id);
    if (!rec) return;
    const names = rec.names.join(' and ');
    try {
      const hs = rec.again ? await idbDo('readonly', s => s.get(id)) : null;
      if (hs && hs.length) {
        for (const h of hs) if ((await h.queryPermission({ mode: 'read' })) !== 'granted' && (await h.requestPermission({ mode: 'read' })) !== 'granted') throw new Error('not allowed');
        const files = await Promise.all(hs.map(h => h.getFile()));
        files.forEach((f, i) => passes.set(fkey(f), Promise.resolve(hs[i])));
        return give(rec.tool, files);
      }
    } catch (e) { /* moved, renamed, or not allowed: ask for the file again */ }
    location.hash = rec.tool;
    toast('Choose ' + names + ' again here. The browser can only reopen files by itself when they were dropped in or picked on All tools, and are still in the same place.');
  }
  return { recent, note, forget, toolFor, take, choose, openAgain, frame, watchDrops, thumbOf };
})();
const ppToolFrame = PP_TOOLS.frame;
window.PP_TOOLS = PP_TOOLS;   // the tool pages (in the frame) ask for "Opened lately" through this
PP_TOOLS.watchDrops(window);

const tlWhen = t => { const d = new Date(t), now = new Date(), day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(), diff = Math.round((day(now) - day(d)) / 864e5); return (diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : d.toLocaleDateString([], { month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) })) + ' ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
V.tools = async () => {
  const T = Object.fromEntries(PP_TOOL_LIST.map(t => [t[0], t])), list = (await PP_TOOLS.recent()).slice(0, 5);
  const tile = ([r, name, what, takes, c, i]) => `<a class="card tn-tile" href="#${r}" data-tool="${r}">${kSq(c, TLI[i], 48)}<span class="kn1"><b>${name}</b><span class="w">${what}</span><span class="tk">Takes: ${takes}</span></span>${TLI.chev}</a>`;
  const rows = list.map(r => { const t = T[r.tool] || T.files; return `<div class="tn-rr" data-id="${esc(r.id)}">${/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(r.thumb || '') ? `<img src="${r.thumb}" alt="">` : kSq(r.tool === 'verify' ? '#0F7B0F' : '#5B6A7A', r.tool === 'verify' ? TLI.zip : TLI.file, 40)}<span class="kn1"><b title="${esc(r.names.join(' + '))}">${esc(r.names.join(' + '))}</b><span><i class="tn-dot" style="--c:${t[4]}"></i>${t[1]} · ${tlWhen(r.at)}</span></span><button class="btn kbtn" data-act="tlagain" data-v="${esc(r.id)}">Open again</button><button class="kx" data-act="tlforget" data-v="${esc(r.id)}" title="Take ${esc(r.names[0])} off this list" aria-label="Take ${esc(r.names[0])} off this list">${TLI.x}</button></div>`; }).join('');
  return `${head('', 'Tools', '', '')}<div class="rvn kpn tn tn-hub">
    <section class="card tn-drop hub" id="tlDrop">${kSq('#0067C0', TLI.up, 64)}<div class="tn-dt"><b>Drop any file here to start</b><span>PageProof opens the right tool: a photo opens Inspect, two photos open Compare, an evidence pack (.zip) opens Verify, a capture PDF opens Mark up, and anything else opens Convert.</span></div><div class="tn-db"><button class="btn kbtn primary big" data-act="tlchoose">${TLI.folder}Choose a file</button></div></section>
    <div class="tn-hubg"><section class="tn-tiles" id="tlTiles">${PP_TOOL_LIST.map(tile).join('')}</section>
      <section class="card tn-recent" id="tlRecent"><div class="kh2">Opened lately <span class="kfaint">only on this computer</span></div>${rows || '<p class="kmuted" id="tlNone">Files you open in a tool show here, so you can open them again with one click.</p>'}</section></div></div>`;
};
Object.assign(ACTS, {
  tlchoose: () => PP_TOOLS.choose(),
  tlagain: v => PP_TOOLS.openAgain(v),
  tlforget: async v => { await PP_TOOLS.forget(v); render(true); },
});
// A file dragged onto All tools lights the box; dropping it anywhere on the page opens its tool.
(() => {
  const on = () => state.shown === 'tools' && route() === 'tools', files = e => e.dataTransfer && [...e.dataTransfer.types || []].includes('Files');
  let depth = 0; const lit = v => { const d = document.getElementById('tlDrop'); if (d) d.classList.toggle('over', v); };
  addEventListener('dragenter', e => { if (on() && files(e)) { depth++; lit(true); } });
  addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; lit(false); } });
  addEventListener('dragover', e => { if (on() && files(e)) e.preventDefault(); });
  addEventListener('drop', e => { depth = 0; lit(false); if (!on() || !files(e)) return; e.preventDefault(); PP_TOOLS.take(e.dataTransfer.files); });
})();
