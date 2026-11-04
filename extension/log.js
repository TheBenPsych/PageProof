// Shows the capture log: one row per capture, plus one per evidence pack saved.
const api = globalThis.browser || globalThis.chrome;

async function load() {
  const { log = [] } = await api.storage.local.get('log');
  const rows = [];
  for (const e of [...log].reverse()) {
    const saves = e.saves && e.saves.length ? e.saves : [{}];
    for (const s of saves) {
      rows.push([new Date(e.time).toLocaleString() + (e.captureId ? ' (' + e.captureId + ')' : ''), e.url, e.title || '', s.caseRef || '', s.collector || '',
        s.at ? new Date(s.at).toLocaleString() + ' - ' + s.file : '(not saved)', s.sha256 || '',
        s.timestamp ? s.timestamp + ' (' + s.tsa + ')' : '', s.notes || '']);
    }
  }
  const tbody = document.getElementById('rows');
  if (!rows.length) tbody.innerHTML = '<tr><td colspan="7">No captures yet.</td></tr>';
  for (const r of rows) {
    const tr = document.createElement('tr');
    r.slice(0, 8).forEach((v, i) => {
      const td = document.createElement('td');
      if (i === 1) { td.textContent = r[2] ? r[2] + ' - ' : ''; const a = document.createElement('a'); a.href = v; a.textContent = v; a.target = '_blank'; td.append(a); }
      else if (i === 2) return;
      else if (i === 6) { const c = document.createElement('code'); c.textContent = v; td.append(c); }
      else td.textContent = v;
      tr.append(td);
    });
    tbody.append(tr);
  }
  document.getElementById('csv').onclick = () => {
    const head = ['Captured', 'Web address', 'Page title', 'Case / ref', 'Collected by', 'Evidence pack saved', 'Pack SHA-256', 'Trusted timestamp', 'Notes'];
    const esc = v => '"' + String(v).replace(/"/g, '""') + '"';
    const csv = [head, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a.download = 'PageProof_capture_log.csv';
    a.click();
  };
}
load();
