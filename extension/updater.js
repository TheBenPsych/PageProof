// Updates: is there a newer PageProof on GitHub, and "Update now".
//  - PageProof is installed from a folder on this computer (the unzipped PageProof folder).
//    "Update now" downloads the newest PageProof.zip from GitHub, puts its files into that
//    folder, and restarts PageProof. You point PageProof at the folder once.
//  - Nothing else is ever written there, and only a zip that really is a newer PageProof is used.
const PP_UPDATE = (() => {
  const api = globalThis.browser || globalThis.chrome;
  const REPO = 'TheBenPsych/PageProof';
  const RAW = 'https://raw.githubusercontent.com/' + REPO + '/main/extension/manifest.json';
  const ZIP = 'https://github.com/' + REPO + '/releases/download/latest/PageProof.zip';
  const PAGE = 'https://github.com/' + REPO + '/releases/latest';
  // PageProof's code on GitHub may be private. So each download is tried three ways:
  //  1. plainly (works when the code is public),
  //  2. as you (works when this browser is signed in to GitHub with an account that can see it),
  //  3. with an access key typed into Settings (kept on this computer only).
  const NEED = 'PageProof could not reach its code on GitHub. The code is private, so this browser has to be signed in to GitHub with an account that can see it.';
  async function token() { return ((await api.storage.local.get('ppGhToken')).ppGhToken || '').trim(); }
  async function gh(kind) {
    const stamp = '?t=' + Date.now();
    const tries = kind === 'manifest'
      ? [[RAW + stamp, { credentials: 'omit' }], ['https://github.com/' + REPO + '/raw/main/extension/manifest.json' + stamp, { credentials: 'include' }]]
      : [[ZIP + stamp, { credentials: 'omit' }], [ZIP + stamp, { credentials: 'include' }]];
    let last = 0;
    for (const [url, o] of tries) {
      try { const r = await fetch(url, { cache: 'no-store', ...o }); if (r.ok && !/text\/html/.test(r.headers.get('content-type') || '')) return r; last = r.status; } catch (e) { last = last || -1; }
    }
    const tk = await token();
    if (tk) {
      const H = { Authorization: 'Bearer ' + tk, 'X-GitHub-Api-Version': '2022-11-28' };
      try {
        if (kind === 'manifest') {
          const r = await fetch('https://api.github.com/repos/' + REPO + '/contents/extension/manifest.json', { cache: 'no-store', credentials: 'omit', headers: { ...H, Accept: 'application/vnd.github.raw+json' } });
          if (r.ok) return r; last = r.status;
        } else {
          const rel = await fetch('https://api.github.com/repos/' + REPO + '/releases/tags/latest', { cache: 'no-store', credentials: 'omit', headers: { ...H, Accept: 'application/vnd.github+json' } });
          if (rel.ok) {
            const a = ((await rel.json()).assets || []).find(x => x.name === 'PageProof.zip');
            if (a) { const r = await fetch(a.url, { cache: 'no-store', credentials: 'omit', headers: { ...H, Accept: 'application/octet-stream' } }); if (r.ok) return r; last = r.status; }
          } else last = rel.status;
        }
      } catch (e) { last = last || -1; }
    }
    throw new Error(last === -1 ? 'GitHub could not be reached. Check the internet connection.' : last === 401 || last === 403 ? 'GitHub did not accept the access key in Settings.' : NEED);
  }
  const current = () => api.runtime.getManifest().version;
  // Is version a newer than b? ("4.1.0" vs "4.0.15")
  function newer(a, b) {
    const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0; }
    return false;
  }
  async function state() { return (await api.storage.local.get('ppUpdate')).ppUpdate || null; }
  // Ask GitHub which version is the newest. Remembered, so the pages don't ask every time.
  async function check() {
    const st = { at: Date.now(), latest: '', has: false, error: '' };
    try {
      const m = await (await gh('manifest')).json();
      if (!/^\d+(\.\d+){1,3}$/.test(m.version || '')) throw new Error('GitHub gave no version number');
      st.latest = m.version; st.has = newer(m.version, current());
    } catch (e) { st.error = String(e && e.message || e); }
    await api.storage.local.set({ ppUpdate: st });
    return st;
  }
  const canWriteFolder = () => typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
  async function folder() { try { return await RS_DB.get('handles', 'ppInstall'); } catch (e) { return null; } }
  // 'none' (not picked yet), 'prompt' (one click on Allow), 'granted'.
  async function folderState() {
    const h = await folder();
    if (!h) return 'none';
    try { return (await h.queryPermission({ mode: 'readwrite' })) === 'granted' ? 'granted' : 'prompt'; } catch (e) { return 'none'; }
  }
  const text = async (dir, name) => { try { return await (await (await dir.getFileHandle(name)).getFile()).text(); } catch (e) { return null; } };
  // The folder must be the one this PageProof is running from: its manifest.json is the same.
  async function isInstallFolder(dir) {
    const theirs = await text(dir, 'manifest.json');
    if (theirs === null) return false;
    const mine = await (await fetch(api.runtime.getURL('manifest.json'))).text();
    return theirs.replace(/\s+/g, '') === mine.replace(/\s+/g, '');
  }
  // Must be called from a click.
  async function pick() {
    const h = await window.showDirectoryPicker({ id: 'pageproof-install', mode: 'readwrite' });
    if (!(await isInstallFolder(h))) throw new Error('That is not the folder this PageProof is running from. Pick the PageProof folder you loaded on the extensions page (it has manifest.json and app.html inside).');
    await RS_DB.put('handles', 'ppInstall', h);
    return h;
  }
  async function forget() { try { await RS_DB.del('handles', 'ppInstall'); } catch (e) { /* none */ } }

  async function download(progress) {
    const r = await gh('zip');
    const total = +r.headers.get('content-length') || 0;
    const parts = []; let got = 0;
    const rd = r.body.getReader();
    for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; if (progress) progress('Downloading ' + (total ? Math.round(got / total * 100) + '%' : Math.round(got / 1e6) + ' MB')); }
    const bytes = new Uint8Array(got); let o = 0;
    for (const p of parts) { bytes.set(p, o); o += p.length; }
    return bytes;
  }
  // Unzip and make sure it really is a newer PageProof.
  async function unpack(bytes) {
    let files = await ppUnzip(bytes);
    if (!files.has('manifest.json')) {
      const hit = [...files.keys()].find(n => /^[^/]+\/manifest\.json$/.test(n));
      if (hit) { const pre = hit.slice(0, hit.indexOf('/') + 1); files = new Map([...files].filter(([n]) => n.startsWith(pre)).map(([n, d]) => [n.slice(pre.length), d])); }
    }
    let m;
    try { m = JSON.parse(new TextDecoder().decode(files.get('manifest.json'))); } catch (e) { throw new Error('The download is not a PageProof zip.'); }
    if (m.name !== 'PageProof' || !files.has('app.html') || !files.has('background.js')) throw new Error('The download is not a PageProof zip.');
    if (!newer(m.version, current())) throw new Error('GitHub is still packing the new version (the download is ' + m.version + ', you have ' + current() + '). Try again in a few minutes.');
    for (const n of files.keys()) if (n.startsWith('/') || n.split('/').some(p => p === '..' || p === '') || /[\\:*?"<>|]/.test(n)) throw new Error('The download has a file name PageProof does not trust: ' + n);
    return { files, version: m.version };
  }
  async function writeAll(dir, files, progress) {
    // A tiny test file first: if the browser won't write here, nothing has been touched yet.
    try { const t = await dir.getFileHandle('pageproof-update-test.txt', { create: true }); const w = await t.createWritable(); await w.write('ok'); await w.close(); await dir.removeEntry('pageproof-update-test.txt'); }
    catch (e) { throw new Error('The browser would not let PageProof write into that folder (' + (e && e.message || e) + '). Nothing was changed.'); }
    const names = [...files.keys()].filter(n => n !== 'manifest.json').sort();
    names.push('manifest.json');                 // last: the folder only says "new version" once everything else is in
    const dirs = new Map([['', dir]]);
    const dirFor = async path => {
      if (dirs.has(path)) return dirs.get(path);
      const up = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      const d = await (await dirFor(up)).getDirectoryHandle(path.split('/').pop(), { create: true });
      dirs.set(path, d); return d;
    };
    let i = 0;
    for (const n of names) {
      const d = await dirFor(n.includes('/') ? n.slice(0, n.lastIndexOf('/')) : '');
      const fh = await d.getFileHandle(n.split('/').pop(), { create: true });
      const w = await fh.createWritable();
      await w.write(files.get(n)); await w.close();
      if (progress && ++i % 10 === 0) progress('Putting the new files in place: ' + i + ' of ' + names.length);
    }
    return names.length;
  }
  // Must be called from a click (the browser may ask to allow the folder). Restarts PageProof at the end.
  async function apply(progress, opts = {}) {
    const say = t => { if (progress) progress(t); };
    const dir = await folder();
    if (!dir) throw new Error('Pick the PageProof folder first.');
    if ((await dir.requestPermission({ mode: 'readwrite' })) !== 'granted') throw new Error('PageProof was not allowed to change the folder. Press Update now again and choose Allow.');
    if (!(await isInstallFolder(dir))) { await forget(); throw new Error('The folder you picked no longer matches this PageProof (it was moved or replaced). Pick the folder again.'); }
    say('Downloading the new version…');
    const { files, version } = await unpack(await download(say));
    say('Putting the new files in place…');
    let n;
    try { n = await writeAll(dir, files, say); }
    catch (e) { if (/Nothing was changed/.test(String(e.message))) throw e; throw new Error('The update stopped part-way (' + (e && e.message || e) + '). Press Update now again. If it keeps failing, use "Download the zip" instead.'); }
    await api.storage.local.set({ ppUpdated: { from: current(), to: version, at: Date.now(), files: n }, ppUpdate: { at: Date.now(), latest: version, has: false, error: '' } });
    say('Restarting PageProof…');
    if (!opts.noReload) setTimeout(() => api.runtime.reload(), 600);
    return { version, files: n };
  }
  return { check, state, apply, pick, forget, folder, folderState, canWriteFolder, newer, current, ZIP, PAGE, unpack, isInstallFolder };
})();
