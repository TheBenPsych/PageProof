// "Verify a pack": re-checks every fingerprint and timestamp in an evidence pack.
const api = globalThis.browser || globalThis.chrome;
const out = document.getElementById('out');
let lastPack = null; // fingerprints of the last pack checked, to match single files against

const hex = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

async function checkZip(name, bytes) {
  out.textContent = 'Checking ' + name + '...';
  return checkFiles(await ppUnzip(bytes), bytes);
}

// files: Map of path -> bytes. zipBytes: the whole zip (or null when a folder was chosen).
async function checkFiles(files, zipBytes) {
  const fp = files.get('fingerprints.sha256');
  if (!fp) throw new Error('This zip has no fingerprints.sha256, so it is not a PageProof evidence pack (or it is from a very early version).');

  const rows = [];   // [class, text]
  let changed = 0, missing = 0;
  const listed = new Set();
  const lines = new TextDecoder().decode(fp).split(/\r?\n/).filter(Boolean);
  lastPack = [];
  for (const line of lines) {
    const m = /^([0-9a-f]{64})\s+\*?(.+)$/i.exec(line);
    if (!m) continue;
    const [, want, file] = m;
    listed.add(file);
    lastPack.push({ hash: want.toLowerCase(), file });
    const data = files.get(file);
    if (!data) { missing++; rows.push(['no', 'MISSING: ' + file]); continue; }
    const have = await hex(data);
    if (have === want.toLowerCase()) rows.push(['ok', file]);
    else { changed++; rows.push(['no', 'CHANGED: ' + file]); }
  }

  // Timestamps
  const tsRows = [];
  let tsGood = 0, tsBad = 0;
  const tsFiles = [...files.keys()].filter(n => n.endsWith('.tsr'));
  for (const n of tsFiles) {
    const service = n.replace(/^.*\//, '').replace(/\.tsr$/, '').replace(/^fingerprints\.sha256$/, 'timestamp');
    try {
      const r = await PP_TSVERIFY(files.get(n), fp);
      if (r.ok) { tsGood++; tsRows.push(['ok', service + ': signed ' + r.time + ' by "' + r.signer + '" (certificate issued by "' + r.issuer + '")']); }
      else { tsBad++; tsRows.push(['no', service + ': ' + r.problem + (r.time ? ' (receipt time ' + r.time + ')' : '')]); }
    } catch (e) { tsBad++; tsRows.push(['no', service + ': the receipt could not be read (' + e.message + ')']); }
  }

  // Files in the zip that the fingerprint list doesn't cover
  const known = n => listed.has(n) || /^(fingerprints\.sha256|capture-details\.txt|README\.txt)$/.test(n) || /\.ts[qr]$/.test(n) || /(^|\/)\.DS_Store$|(^|\/)Thumbs\.db$/.test(n);
  const extras = [...files.keys()].filter(n => !known(n));

  // Is this the exact zip from the capture log?
  const zipHash = zipBytes ? await hex(zipBytes) : null;
  let logMatch = null;
  if (zipHash) try {
    const { log = [] } = await api.storage.local.get('log');
    for (const e of log) for (const s of (e.saves || [])) if (s.sha256 === zipHash) logMatch = { e, s };
  } catch (e) { /* ignore */ }

  // Details from the record
  const det = files.get('capture-details.txt') ? new TextDecoder().decode(files.get('capture-details.txt')) : '';
  const pick = label => { const m = new RegExp('^' + label + ':\\s*(.+)$', 'm').exec(det); return m ? m[1].trim() : ''; };

  // Verdict
  out.textContent = '';
  const v = el('div', 'verdict');
  if (changed || missing || tsBad) {
    v.classList.add('bad');
    v.append('Warning: this pack has been changed.');
    v.append(el('small', null, [changed && changed + ' file(s) changed', missing && missing + ' file(s) missing', tsBad && tsBad + ' timestamp(s) failed'].filter(Boolean).join(', ') + '. Details below.'));
  } else if (!tsGood) {
    v.classList.add('warn');
    v.append('All ' + rows.length + ' files match their fingerprints, but there is no trusted timestamp to prove when.');
  } else {
    v.classList.add('good');
    const vt = el('div', 'vt', 'Nothing has changed since it was made');
    vt.append(el('small', null, 'All ' + rows.length + ' files match their fingerprints. The fingerprint list was signed by ' + tsGood + ' independent timestamp service' + (tsGood > 1 ? 's' : '') + ', so these files existed exactly like this at that time.'));
    v.append(vt);
  }
  out.append(v);

  const section = (title, items) => {
    out.append(el('h2', null, title));
    const ul = el('ul', 'checks');
    for (const [c, t] of items) ul.append(el('li', c, t));
    out.append(ul);
  };
  section('About this capture', [
    ['info', 'Web address: ' + (pick('Web address') || '?')],
    ['info', 'Captured: ' + (pick('Captured UTC') || '?') + ' (UTC)  |  Capture ID: ' + (pick('Capture ID') || '?')],
    ['info', 'Case: ' + (pick('Case / ref') || '?') + '  |  Collected by: ' + (pick('Collected by') || '?')],
    ...(pick('Archived copy') ? [['info', 'Wayback Machine copy: ' + pick('Archived copy')]] : [])
  ]);
  section('Files (' + rows.length + ')', rows);
  section('Trusted timestamps', tsRows.length ? tsRows : [['no', 'No timestamp receipts in this pack.']]);
  if (extras.length) section('Not covered by the fingerprints', extras.map(n => ['info', n + ' (was added to the pack later, or is not part of the evidence)']));
  if (zipHash) section('This zip file', [
    ['info', 'Fingerprint of the whole zip: ' + zipHash],
    logMatch ? ['ok', 'This is the exact zip saved on ' + new Date(logMatch.s.at).toLocaleString() + (logMatch.s.collector ? ' by ' + logMatch.s.collector : '') + ' (found in this browser\'s capture log).']
      : ['info', globalThis.PP_STANDALONE ? 'Compare this with the "Pack SHA-256" in the collector\'s PageProof capture log to confirm it is the exact zip they saved.' : 'Not in this browser\'s capture log. That\'s normal if someone else made it, or it was re-zipped.']
  ]);
  const note = el('p', null, 'The timestamp check confirms each receipt matches this fingerprint list and carries a valid signature. For a full check of the signing certificate against the service\'s official root certificate, use the openssl command in VERIFYING.md.');
  note.style.fontSize = '13px'; note.style.opacity = '.8';
  out.append(note);
  if (globalThis.PP_STANDALONE) {
    const n2 = el('p', null, 'You are using the checker that came inside this pack. It is covered by the pack\'s own fingerprints and timestamps. For a fully independent check, use the free openssl commands in README.txt.');
    n2.style.fontSize = '13px'; n2.style.opacity = '.8';
    out.append(n2);
  }
}

async function checkFile(name, bytes) {
  const h = await hex(bytes);
  out.textContent = '';
  out.append(el('h2', null, 'Fingerprint of ' + name));
  out.append(el('p', null, h));
  if (lastPack) {
    const hit = lastPack.find(x => x.hash === h);
    out.append(el('div', 'verdict ' + (hit ? 'good' : 'bad'), hit ? 'Matches "' + hit.file + '" in the pack you checked.' : 'Does not match any file in the pack you checked.'));
  } else {
    out.append(el('p', null, 'Compare it with the matching line in that pack\'s fingerprints.sha256, or check the pack first, then drop this file to compare automatically.'));
  }
}

async function handle(file) {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
    if (isZip) await checkZip(file.name, bytes); else await checkFile(file.name, bytes);
  } catch (e) {
    out.textContent = '';
    out.append(el('div', 'verdict bad', 'Could not check this file: ' + e.message));
  }
}

// A whole unzipped folder: paths are made relative to the folder.
async function handleFolder(list) {
  try {
    const arr = [...list];
    if (!arr.length) return;
    out.textContent = 'Reading ' + arr.length + ' files...';
    const files = new Map();
    for (const f of arr) {
      const rel = (f.webkitRelativePath || f.name).split('/').slice(f.webkitRelativePath ? 1 : 0).join('/');
      files.set(rel, new Uint8Array(await f.arrayBuffer()));
    }
    // If the chosen folder holds the pack one level down, step into it.
    if (!files.has('fingerprints.sha256')) {
      const hit = [...files.keys()].find(n => n.endsWith('/fingerprints.sha256'));
      if (hit) {
        const pre = hit.slice(0, -'fingerprints.sha256'.length);
        for (const [k, v] of [...files]) { files.delete(k); if (k.startsWith(pre)) files.set(k.slice(pre.length), v); }
      }
    }
    await checkFiles(files, null);
  } catch (e) {
    out.textContent = '';
    out.append(el('div', 'verdict bad', 'Could not check this folder: ' + e.message));
  }
}
document.getElementById('pickFolder').onchange = e => handleFolder(e.target.files);

const drop = document.getElementById('drop');
document.getElementById('pick').onchange = e => e.target.files[0] && handle(e.target.files[0]);
['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => e.dataTransfer.files[0] && handle(e.dataTransfer.files[0]));
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => { e.preventDefault(); if (e.target !== drop && !drop.contains(e.target) && e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]); });
