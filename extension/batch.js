// Batch capture: visits each link in its own window and captures it into an evidence pack.
const api = globalThis.browser || globalThis.chrome;
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LOAD_TIMEOUT = 45000;   // give up on a page that won't finish loading
const SETTLE_MS = 3000;       // let pictures and late content appear
const MAX_PENDING = 2;        // packs being built at the same time

let items = [];
let stopping = false;
const batchId = 'b' + Date.now();
let pending = 0;

function setRow(i, status, cls, pack) {
  const it = items[i];
  it.status = status;
  if (pack !== undefined) it.pack = pack;
  const tr = $('rows').children[i];
  tr.children[2].textContent = status;
  tr.children[2].className = cls ? 's-' + cls : '';
  tr.children[3].textContent = it.pack || '';
}

function waitForLoad(tabId) {
  return new Promise(resolve => {
    let done = false;
    const finish = ok => { if (done) return; done = true; api.tabs.onUpdated.removeListener(on); clearTimeout(t); resolve(ok); };
    const on = (id, info) => { if (id === tabId && info.status === 'complete') finish(true); };
    const t = setTimeout(() => finish(false), LOAD_TIMEOUT);
    api.tabs.onUpdated.addListener(on);
  });
}

api.runtime.onMessage.addListener(msg => {
  if (!msg || msg.type !== 'packDone' || msg.batch !== batchId) return;
  pending--;
  if (msg.ok) setRow(msg.idx, 'Saved', 'saved', msg.zipName);
  else setRow(msg.idx, 'Failed: ' + msg.error, 'failed');
});

async function run() {
  const urls = $('urls').value.split(/\s+/).map(u => u.trim()).filter(u => /^https?:\/\//i.test(u));
  if (!urls.length) { alert('Paste at least one link starting with http:// or https://'); return; }
  const auto = { auto: '1', batch: batchId, collector: $('collector').value.trim(), case: $('caseRef').value.trim(),
    notes: $('notes').value.trim() };
  try { await api.storage.local.set({ lastCase: { collector: auto.collector, caseRef: auto.case } }); } catch (e) { /* ignore */ }

  items = urls.map(url => ({ url, status: 'Waiting' }));
  $('rows').textContent = '';
  items.forEach((it, i) => {
    const tr = document.createElement('tr');
    for (const v of [i + 1, it.url, 'Waiting', '']) { const td = document.createElement('td'); td.textContent = v; tr.append(td); }
    $('rows').append(tr);
  });
  $('start').disabled = true; $('stop').disabled = false; $('report').disabled = true;
  stopping = false;

  const win = await api.windows.create({ url: 'about:blank', focused: false, width: 1280, height: 900, type: 'normal' });
  const tabId = win.tabs[0].id;
  try {
    for (let i = 0; i < items.length; i++) {
      if (stopping) { for (let k = i; k < items.length; k++) setRow(k, 'Skipped (stopped)', 'failed'); break; }
      while (pending >= MAX_PENDING) await sleep(1000);
      setRow(i, 'Loading page...', 'busy');
      await api.tabs.update(tabId, { url: items[i].url, active: true });
      const loaded = await waitForLoad(tabId);
      await sleep(SETTLE_MS);
      setRow(i, loaded ? 'Capturing...' : 'Capturing (page was still loading)...', 'busy');
      const res = await api.runtime.sendMessage({ type: 'capture', tabId, auto: { ...auto, idx: String(i) } });
      if (!res || !res.ok) {
        const why = (res && res.error) || 'no answer';
        setRow(i, 'Failed: ' + (/error page|cannot access|cannot be scripted/i.test(why) ? 'the page did not load (site down, blocked, or wrong address)' : why), 'failed');
        continue;
      }
      pending++;
      setRow(i, 'Building pack...', 'busy');
    }
    const until = Date.now() + 5 * 60 * 1000;
    while (pending > 0 && Date.now() < until) await sleep(1000);
  } finally {
    try { await api.windows.remove(win.id); } catch (e) { /* already closed */ }
    const saved = items.filter(it => it.status === 'Saved').length;
    $('summary').textContent = 'Done: ' + saved + ' of ' + items.length + ' links saved.';
    $('start').disabled = false; $('stop').disabled = true; $('report').disabled = false;
  }
}

$('start').onclick = () => run().catch(e => { $('summary').textContent = 'Batch stopped: ' + e.message; $('start').disabled = false; });
$('stop').onclick = () => { stopping = true; $('stop').disabled = true; $('stop').textContent = 'Stopping...'; };
$('report').onclick = () => {
  const esc = v => '"' + String(v || '').replace(/"/g, '""') + '"';
  const csv = [['#', 'Link', 'Status', 'Evidence pack'], ...items.map((it, i) => [i + 1, it.url, it.status, it.pack])]
    .map(r => r.map(esc).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
  a.download = 'PageProof_batch_' + ($('caseRef').value.trim().replace(/[^\w.-]+/g, '_') || 'report') + '_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
};

(async () => {
  try {
    const last = (await api.storage.local.get('lastCase')).lastCase || {};
    $('collector').value = last.collector || '';
    $('caseRef').value = last.caseRef || '';
  } catch (e) { /* ignore */ }
})();
