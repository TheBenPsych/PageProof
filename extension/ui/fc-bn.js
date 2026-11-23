// Save a Breaking News photo: opened from the right-click item "Save as Breaking News photo…".
// Names the file the firm's way (11.23.26_Subject_Lastname.jpg, POOL photos 11.23.26_POOL_Subject_Lastname.jpg)
// and first checks it against the photographer's photos on Drive: New, or Recycled (we already have it).
// Drive is only read. The file is saved through the browser's Save As window, wherever you choose.
Object.assign(state, { bn: null });
let BN_BLOB = null, BN_URL = '', BN_RUN = 0;
const bnHam = (a, b) => { let n = 0; for (let i = 0; i < 16; i += 8) { let v = (parseInt(a.slice(i, i + 8), 16) ^ parseInt(b.slice(i, i + 8), 16)) >>> 0; while (v) { n += v & 1; v >>>= 1; } } return n; };
const lastWord = s => String(s || '').replace(/\b(photo(graphy)?|studio|images?|media|llc|inc)\b/gi, '').trim().split(/\s+/).pop() || '';
const isoDay = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

async function bnLoad() {
  const { bnPending } = await api.storage.local.get('bnPending');
  if (!bnPending) return null;
  if (state.bn && state.bn.at === bnPending.at) return state.bn;
  const clients = (await FC.DB.all('clients')).map(c => c.name).sort((a, b) => a.localeCompare(b));
  // The photographer: the client whose last name appears in the credit line.
  const text = (bnPending.credit || '') + ' ' + (bnPending.alt || '');
  const guess = clients.find(n => { const w = lastWord(n); return w.length > 2 && new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(text); }) || '';
  let d = bnPending.date ? new Date(bnPending.date) : new Date();
  if (isNaN(d)) d = new Date();
  state.bn = { ...bnPending, clients, client: guess, last: lastWord(guess), date: isoDay(d), dateFrom: bnPending.date ? 'the article' : 'today', subject: '', pool: false, check: null, saved: '' };
  BN_RUN++;
  // The picture itself: the biggest copy if it downloads, else the one that was right-clicked.
  BN_BLOB = null; if (BN_URL) URL.revokeObjectURL(BN_URL); BN_URL = '';
  for (const u of [bnPending.best, bnPending.src].filter(Boolean)) {
    try { const r = await fetch(u, { credentials: 'omit' }); if (!r.ok) continue; const b = await r.blob(); await createImageBitmap(b).then(x => x.close && x.close()); BN_BLOB = b; break; } catch (e) { /* try the next */ }
  }
  if (BN_BLOB) BN_URL = URL.createObjectURL(BN_BLOB);
  if (guess && BN_BLOB) bnCheck();
  return state.bn;
}
function bnFileName() {
  const b = state.bn, [y, m, d] = b.date.split('-').map(Number);
  return PP_CHECKS.bnName({ date: new Date(y, m - 1, d), subject: b.subject, last: b.last, pool: b.pool });
}
// New or recycled? Every photo of this client is compared by its look (a tiny fingerprint of
// its shape and light). Photos PageProof hasn't opened yet are read from Drive once, newest first.
async function bnCheck() {
  const b = state.bn, run = ++BN_RUN;
  if (!b || !b.client || !BN_BLOB) return;
  let mine; try { mine = await FC.lookHash(BN_BLOB); } catch (e) { b.check = { error: 'This picture could not be read.' }; return render(true); }
  const photos = (await FC.DB.by('photos', 'client', b.client)).filter(p => !p.gone && !p.unreadable)
    .sort((x, y) => (y.year || 0) - (x.year || 0) || (y.quarter || 0) - (x.quarter || 0) || (y.day || 0) - (x.day || 0));
  b.check = { total: photos.length, done: 0, hits: [], unread: 0, running: true };
  render(true);
  for (const p of photos) {
    if (run !== BN_RUN) return;           // the photographer changed, or the page was left
    if (!p.look && p.rel) {
      try { const f = await FC.fileFor(p); p.look = await FC.lookHash(f); await FC.DB.put('photos', p); } catch (e) { b.check.unread++; }
    }
    if (p.look) { const d = bnHam(mine, p.look); if (d <= 10) b.check.hits.push({ d, name: p.name, folder: p.folder, id: p.id }); }
    b.check.done++;
    if (b.check.done % 20 === 0) { const el = document.getElementById('bnProg'); if (el) el.textContent = b.check.done.toLocaleString() + ' of ' + b.check.total.toLocaleString(); }
  }
  b.check.hits.sort((x, y) => x.d - y.d);
  b.check.running = false;
  if (route() === 'bnsave') render(true);
}
function bnVerdict(ch) {
  if (!ch) return '';
  if (ch.error) return `<div class="banner warn"><span>${esc(ch.error)}</span></div>`;
  if (ch.running) return `<div class="banner info"><span><b>Checking…</b> <span id="bnProg" class="num">${ch.done.toLocaleString()} of ${ch.total.toLocaleString()}</span> of ${esc(state.bn.client)}'s photos. Photos never opened before are read from Drive once, so the first check takes longest.</span></div>`;
  const same = ch.hits.filter(h => h.d <= 6), maybe = ch.hits.filter(h => h.d > 6);
  const list = hs => hs.slice(0, 5).map(h => `<div class="row" style="gap:8px;font-size:13.5px"><img class="gthumb" data-our="${esc(h.id)}" src="icons/icon48.png" alt=""><span style="min-width:0;overflow-wrap:anywhere"><b>${esc(h.name)}</b><br><span class="faint mono" style="font-size:12px">${esc(h.folder || '')}</span></span><button class="btn ghost sm" style="margin-left:auto" data-act="copytext" data-v="${esc(h.name)}">Copy name</button></div>`).join('');
  const tail = `<span class="faint" style="font-size:12.5px">Checked ${ch.total.toLocaleString()} photos${ch.unread ? `, ${ch.unread.toLocaleString()} could not be opened` : ''}. Cropped versions may not match, so still check Google Lens for an earlier article.</span>`;
  if (same.length) return `<div class="regbox none" style="gap:8px"><span><span class="tag warn">Recycled</span> <b>We already have this photo.</b> Log it as recycled with the earlier file name. Don't save it again.</span>${list(same)}${tail}</div>`;
  if (maybe.length) return `<div class="regbox none" style="gap:8px"><span><span class="tag warn">Maybe recycled</span> These look close. Open them and compare before you decide.</span>${list(maybe)}${tail}</div>`;
  return `<div class="regbox" style="gap:6px"><span><span class="tag ok">New</span> <b>No match in ${esc(state.bn.client)}'s photos.</b></span>${tail}</div>`;
}
V.bnsave = async () => {
  const b = await bnLoad();
  const hd = head('Find copies', 'Save a Breaking News photo', 'Named the firm\'s way, and checked against the photographer\'s photos first. The file is saved through the Save As window, so you pick the folder.');
  if (!b) return `${hd}<section class="card pad" style="text-align:center;padding:44px 22px"><h2>Right-click a newspaper photo</h2><p class="muted" style="margin:8px auto 0;max-width:56ch">On the newspaper's page, right-click the photo and choose <b>PageProof › Save as Breaking News photo…</b>. It opens here with the date and the credit line already read.</p></section>`;
  const lens = /^https?:/.test(b.best || b.src) ? 'https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(b.best || b.src) : '';
  const name = bnFileName();
  const leadZero = /(^|\D)0\d\./.test(name);
  return `${hd}
  <div class="grid g2" style="align-items:start">
    <section class="card pad" style="display:flex;flex-direction:column;gap:10px">
      <div class="frame ours" style="min-height:220px;display:grid;place-items:center">${BN_URL ? `<img src="${BN_URL}" alt="The photo to save" style="max-height:420px;object-fit:contain">` : '<span class="muted">The picture could not be downloaded. Use the browser\'s own Save image as… instead.</span>'}</div>
      <dl class="facts" style="margin:0">
        <dt>Article</dt><dd>${b.headline ? esc(b.headline) + '<br>' : ''}<a class="mono" style="font-size:12px;overflow-wrap:anywhere" href="${safeUrl(b.page)}" target="_blank" rel="noreferrer">${esc(b.page)}</a></dd>
        <dt>Credit line</dt><dd>${b.credit ? `<q>${esc(b.credit)}</q>` : '<span class="muted">None found next to the photo</span>'}</dd>
      </dl>
      ${lens ? `<a class="btn" href="${safeUrl(lens)}" target="_blank" rel="noreferrer">${ic('find', 16)} Search it on Google Lens (was it online earlier?)</a>` : ''}
    </section>
    <section class="card pad" style="display:flex;flex-direction:column;gap:12px">
      <label class="field"><b>Photographer</b><select id="bnClient" data-act="bnclient"><option value="">Pick the client…</option>${b.clients.map(n => `<option${n === b.client ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <div class="grid g2" style="gap:10px">
        <label class="field"><b>Date first published</b><input id="bnDate" type="date" data-act="bnfield" data-v="date" value="${esc(b.date)}"><span class="faint" style="font-size:12px">From ${esc(b.dateFrom)}</span></label>
        <label class="field"><b>Last name</b><input id="bnLast" data-act="bnfield" data-v="last" value="${esc(b.last)}" placeholder="Ortiz"></label>
      </div>
      <label class="field"><b>Subject or event</b><input id="bnSubject" data-act="bnfield" data-v="subject" value="${esc(b.subject)}" placeholder="${esc(b.alt ? b.alt.slice(0, 60) : 'Council hearing walkout')}"><span class="faint" style="font-size:12px">From the article. Keep it short.</span></label>
      <label class="row" style="gap:8px;font-size:14px;cursor:pointer"><input id="bnPool" type="checkbox" data-act="bnpool" ${b.pool ? 'checked' : ''}> <span><b>POOL photo</b> <span class="muted">(court photo shared with other papers; it is never searched)</span></span></label>
      <div class="dsec"><div class="dsh">File name</div><div class="mono bnname" id="bnName">${esc(name)}</div>${leadZero ? '<span class="tag warn">No leading zeros in the date</span>' : ''}</div>
      <div class="dsec"><div class="dsh">New or recycled?</div>${b.client ? (bnVerdict(b.check) || (BN_BLOB ? `<button class="btn" data-act="bncheck">Check against ${esc(b.client)}'s photos</button>` : '')) : '<span class="muted" style="font-size:13.5px">Pick the photographer to check.</span>'}</div>
      <button class="btn primary" data-act="bnsave" ${BN_BLOB && b.client && b.subject && b.last ? '' : 'disabled'}>${ic('down', 18)} Save as ${esc(name)}</button>
      ${b.saved ? `<div class="banner ok" style="padding:10px 12px"><span>Saved as <b>${esc(b.saved)}</b>.</span></div>` : '<span class="faint" style="font-size:12.5px">Fill in the photographer, subject and last name to save.</span>'}
    </section>
  </div>`;
};
V.bnsave.noAutoRedraw = true;
V.bnsave.after = () => { if (typeof loadOurs === 'function') loadOurs(); };
function bnRefresh() {
  const b = state.bn, name = bnFileName(), n = document.getElementById('bnName'), btn = document.querySelector('[data-act="bnsave"]');
  b.saved = '';
  if (n) n.textContent = name;
  if (btn) { btn.disabled = !(BN_BLOB && b.client && b.subject && b.last); btn.lastChild.textContent = ' Save as ' + name; }
}
Object.assign(ACTS, {
  bnclient: async (v, el) => { const b = state.bn; b.client = el.value; b.last = lastWord(el.value); b.check = null; b.saved = ''; await render(true); if (b.client && BN_BLOB) bnCheck(); },
  // Typing only updates the name and the Save button in place, so a click on Save right after typing still lands.
  bnfield: (v, el) => { state.bn[v] = el.value.trim(); if (v === 'date') state.bn.dateFrom = 'you'; bnRefresh(); },
  bnpool: (v, el) => { state.bn.pool = el.checked; bnRefresh(); },
  bncheck: () => bnCheck(),
  bnsave: async () => {
    const b = state.bn;
    if (!BN_BLOB) return;
    let blob = BN_BLOB;
    // The firm keeps photos as JPG files.
    if (!/jpe?g/i.test(blob.type)) {
      const bmp = await createImageBitmap(blob), c = new OffscreenCanvas(bmp.width, bmp.height), x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0); bmp.close && bmp.close();
      blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.95 });
    }
    const name = bnFileName(), url = URL.createObjectURL(blob);
    try {
      await api.downloads.download({ url, filename: name, saveAs: true, conflictAction: 'uniquify' });
      b.saved = name; toast('Saving ' + name + '. Pick the folder in the Save As window.');
    } catch (e) { toast('Not saved: ' + (e.message || e)); }
    setTimeout(() => URL.revokeObjectURL(url), 120000);
    render(true);
  },
});
// Show the file name as you type, before the box is left.
document.addEventListener('input', e => {
  const el = e.target;
  if (!state.bn || route() !== 'bnsave' || !el.dataset || el.dataset.act !== 'bnfield') return;
  state.bn[el.dataset.v] = el.value.trim(); bnRefresh();
});
