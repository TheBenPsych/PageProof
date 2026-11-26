// Evidence › Weekly summary in the calm look (step 16): app.html#weekly
// One week of work on one screen: six tiles compared with the week before, the last 8 weeks as a
// chart, a table by client, first searches, evidence reports, and a week picker. Save as PDF draws
// the same things on paper. Everything is read from counts PageProof already keeps (FC.week), so
// nothing here searches, changes a copy or touches a photo.
const WKI = (() => {
  const s = (p, z = 16) => `<svg viewBox="0 0 16 16" width="${z}" height="${z}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  return {
    search: s('<circle cx="7" cy="7" r="4.5"/><path d="M10.4 10.4 14 14"/>'),
    copies: s('<rect x="2" y="4.5" width="8" height="9" rx="1"/><path d="M5 4.5V3a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-3"/>'),
    stolen: s('<path d="M8 1.8 13.5 4v4c0 3.2-2.4 5.4-5.5 6.2C4.9 13.4 2.5 11.2 2.5 8V4z"/><path d="M8 5v3.5M8 10.6v.2"/>'),
    ok: s('<path d="M8 1.8 13.5 4v4c0 3.2-2.4 5.4-5.5 6.2C4.9 13.4 2.5 11.2 2.5 8V4z"/><path d="m5.5 8 1.8 1.8L10.8 6"/>'),
    gone: s('<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9"/>'),
    pack: s('<path d="M2.5 5 8 2.2 13.5 5v6L8 13.8 2.5 11z"/><path d="M2.5 5 8 7.8 13.5 5M8 7.8v6"/>'),
    down: s('<path d="M8 2.5v8M4.5 7.5 8 11l3.5-3.5M3 13.5h10"/>'),
    cal: s('<rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 6.5h12M5.5 1.8v2.4M10.5 1.8v2.4"/>'),
    chev: s('<path d="m6 3.5 4.5 4.5L6 12.5"/>', 14),
    left: s('<path d="M10 3.5 5.5 8l4.5 4.5"/>'),
    right: s('<path d="m6 3.5 4.5 4.5L6 12.5"/>'),
    dn: s('<path d="M4 6l4 4 4-4"/>', 12),
    check: s('<path d="m3 8.5 3.2 3L13 4.5"/>'),
    globe: s('<circle cx="8" cy="8" r="6.2"/><path d="M1.8 8h12.4M8 1.8c1.8 2 2.6 4 2.6 6.2S9.8 12.2 8 14.2C6.2 12.2 5.4 10.2 5.4 8S6.2 3.8 8 1.8z"/>'),
    up: s('<path d="M8 13V3.5M4.5 7 8 3.5 11.5 7"/>', 12),
    dnar: s('<path d="M8 3v9.5M4.5 9 8 12.5 11.5 9"/>', 12),
    sortdn: s('<path d="M4 6l4 4 4-4"/>', 12),
    sortup: s('<path d="M4 10l4-4 4 4"/>', 12),
    pause: s('<circle cx="8" cy="8" r="6.2"/><path d="M6.5 5.5v5M9.5 5.5v5"/>'),
  };
})();
const WK_DAY = 864e5, WK_SHOW = 14;
const wkN = v => Number(v || 0).toLocaleString();
const wkShort = d => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
const wkDayName = iso => new Date(iso).toLocaleDateString([], { weekday: 'short' });
// What a week is called in the picker: [name, small line].
function wkName(key, start) {
  const now = FC.weekKey(), last = FC.weekKey(new Date(new Date(now + 'T00:00:00').getTime() - WK_DAY));
  const range = wkShort(start) + ' – ' + wkShort(new Date(start.getTime() + 6 * WK_DAY));
  if (key === now) { const d = Math.min(7, Math.floor((Date.now() - start) / WK_DAY) + 1); return ['This week so far', range + ' · ' + d + ' of 7 days']; }
  if (key === last) return ['Last week', range];
  return [range, String(start.getFullYear())];
}
// Up or down against the week before, in percent. null = nothing to compare with.
const wkPct = (a, b) => !b ? (a ? null : 0) : Math.round((a - b) / b * 100);
// Everything the page and the PDF show for one week.
async function wkAll(key) {
  const w = await weekData(key), running = key === FC.weekKey();
  const prevKey = FC.weekKey(new Date(w.start.getTime() - WK_DAY)), nextKey = FC.weekKey(new Date(w.start.getTime() + 8 * WK_DAY));
  const pw = await weekData(prevKey);
  const allR = (await api.storage.local.get('fcReports')).fcReports || [];
  const reps = allR.filter(r => r.at >= key && r.at < nextKey).sort((a, b) => a.at < b.at ? 1 : -1);
  const prevR = allR.filter(r => r.at >= prevKey && r.at < key).length;
  const weeks = []; let s = new Date(w.start);
  for (let i = 0; i < 8; i++) { const k = FC.weekKey(s); weeks.unshift({ key: k, start: new Date(k + 'T00:00:00'), w: (await FC.week(k)) || {} }); s = new Date(s.getTime() - 7 * WK_DAY); }
  const names = (await FC.DB.all('clients').catch(() => [])).map(c => c.name), none = names.filter(n => !w.clients[n]).sort((a, b) => a.localeCompare(b));
  const tiles = [['blue', 'search', w.searched, pw.searched, 'Photos searched'], ['purple', 'copies', w.found, pw.found, 'New copies found'], ['red', 'stolen', w.stolen, pw.stolen, 'Marked stolen', 'bad'], ['green', 'ok', w.licensed, pw.licensed, 'Licensed', 'ok'], ['grey', 'gone', w.removed, pw.removed, 'Removed'], ['teal', 'pack', reps.length, prevR, 'Evidence reports']];
  return { key, w, pw, running, prevKey, nextKey, reps, weeks, none, tiles, name: wkName(key, w.start), vs: running ? 'vs all of last week' : 'vs the week before' };
}
function wkSorted(clients) {
  const [f, dir] = state.wkSort || ['found', -1], list = Object.entries(clients);
  return list.sort((a, b) => f === 'name' ? dir * a[0].localeCompare(b[0]) : dir * ((a[1][f] || 0) - (b[1][f] || 0)) || (b[1].found - a[1].found) || a[0].localeCompare(b[0]));
}

V.weekly = async () => {
  const key = state.wkKey || FC.weekKey(), D = await wkAll(key), { w, pw } = D;
  const hasNext = D.nextKey <= FC.weekKey();
  // ---- week picker + Save as PDF
  const menu = D.weeks.slice().reverse();
  if (!menu.some(x => x.key === FC.weekKey())) menu.unshift({ key: FC.weekKey(), start: new Date(FC.weekKey() + 'T00:00:00'), w: (await FC.week(FC.weekKey())) || {} });
  const ctl = `<div class="wk-ctl" id="wkCtl">
    <div class="wk-pick"><button class="wk-lr" data-act="wk" data-v="${D.prevKey}" aria-label="Week before" title="Week before">${WKI.left}</button>
      <button class="wk-dd" id="wkPick" data-act="wkmenu" aria-haspopup="listbox" aria-expanded="false">${WKI.cal}<b>${esc(D.name[0])}</b><span class="kfaint">${esc(D.name[1])}</span>${WKI.dn}</button>
      <button class="wk-lr" data-act="wk" data-v="${D.nextKey}" aria-label="Next week" title="Next week"${hasNext ? '' : ' disabled'}>${WKI.right}</button>
      <div class="wk-menu" id="wkMenu" role="listbox" hidden>${menu.map(x => `<button role="option" aria-selected="${x.key === key}" class="${x.key === key ? 'on' : ''}" data-act="wk" data-v="${x.key}"><span>${esc(wkName(x.key, x.start)[0])}</span><span class="kfaint num">${wkN(x.w.found)} found</span></button>`).join('')}</div></div>
    <span class="sp"></span><button class="btn kbtn primary" data-act="wkpdf">${WKI.down}Save as PDF</button></div>`;
  // ---- six tiles
  const delta = (a, b) => { const d = wkPct(a, b); return d === null ? '<span class="wk-d">New this week</span>' : d === 0 ? `<span class="wk-d">Same as ${D.running ? 'last week' : 'the week before'}</span>` : `<span class="wk-d ${d > 0 ? 'up' : 'dn'}">${d > 0 ? WKI.up : WKI.dnar}${Math.abs(d)}% ${D.vs}</span>`; };
  const tiles = `<div class="ktiles2 wk-tiles6" id="wkTiles">${D.tiles.map(([c, i, a, b, l, col]) => `<div class="card kt2 wk-t">${kSq(KC[c], WKI[i], 40)}<span><b class="num${col ? ' ' + col : ''}">${wkN(a)}</b><span class="l">${l}</span>${delta(a, b)}</span></div>`).join('')}</div>`;
  // ---- last 8 weeks
  const max = Math.max(1, ...D.weeks.map(x => x.w.found || 0));
  const chart = `<section class="card wk-chart" id="wkChart"><div class="kh2">Last 8 weeks <span class="kfaint">copies found each week · click a week to open it</span>
      <span class="wk-leg"><span><i class="s"></i>Marked stolen</span><span><i class="f"></i>Other copies found</span></span></div>
    <div class="wk-bars8" role="group" aria-label="${esc(D.weeks.map(x => wkName(x.key, x.start)[0] + ': ' + (x.w.found || 0) + ' found, ' + (x.w.stolen || 0) + ' stolen').join('. '))}">${D.weeks.map(x => { const f = x.w.found || 0, st = Math.min(f, x.w.stolen || 0), cur = x.key === key; return `<button class="wk-b8${cur ? ' cur' : ''}" data-act="wk" data-v="${x.key}" title="${esc(wkName(x.key, x.start)[0])}: ${wkN(f)} found, ${wkN(x.w.stolen)} stolen"><b class="num">${wkN(f)}</b><span class="wk-col" style="height:${(f / max * 100).toFixed(1)}%"><i class="f" style="flex-grow:${f - st}"></i><i class="s" style="flex-grow:${st}"></i></span><span class="wk-l">${x.key === FC.weekKey() ? 'This week' : wkShort(x.start)}</span></button>`; }).join('')}</div></section>`;
  // ---- by client
  const cl = wkSorted(w.clients), cmax = Math.max(1, ...cl.map(([, c]) => c.found)), [sf, sd] = state.wkSort || ['found', -1];
  const th = (f, t, cls = '') => `<button class="${cls}${sf === f ? ' on' : ''}" data-act="wksort" data-v="${f}" aria-sort="${sf === f ? (sd < 0 ? 'descending' : 'ascending') : 'none'}">${t}${sf === f ? (sd < 0 ? WKI.sortdn : WKI.sortup) : ''}</button>`;
  const shown = state.wkAll ? cl : cl.slice(0, WK_SHOW);
  const noneTxt = D.none.slice(0, 8).map(esc).join(', ') + (D.none.length > 8 ? ' and ' + (D.none.length - 8) + ' more' : '');
  const table = `<section class="card wk-cl" id="wkClients"><div class="kh2">By client <span class="kfaint">${plural(cl.length, 'client')} searched ${D.running ? 'this week' : 'that week'}</span><a href="#found">Open Copies found ›</a></div>
    ${cl.length ? `<div class="wk-ch">${th('name', 'Client')}${th('searched', 'Photos searched', 'r')}${th('found', 'Copies found', 'r')}${th('stolen', 'Stolen', 'r')}<span></span><span></span></div>
    ${shown.map(([nm, c]) => `<a class="wk-cr" href="#found?client=${encodeURIComponent(nm)}" title="See the copies of ${esc(nm)} in Copies found"><span class="wk-name">${kAv(nm)}<b>${esc(nm)}</b></span><span class="r num">${wkN(c.searched)}</span><span class="r num"><b>${wkN(c.found)}</b></span><span class="r num${c.stolen ? ' bad' : ' kfaint'}">${c.stolen ? wkN(c.stolen) : '–'}</span><span class="wk-track"><i class="s" style="width:${(Math.min(c.found, c.stolen) / cmax * 100).toFixed(1)}%"></i><i class="f" style="width:${(Math.max(0, c.found - c.stolen) / cmax * 100).toFixed(1)}%"></i></span>${WKI.chev}</a>`).join('')}
    ${cl.length > WK_SHOW ? `<button class="wk-more" data-act="wkall">${state.wkAll ? 'Show the top ' + WK_SHOW : 'Show all ' + cl.length + ' clients'} ${WKI.dn}</button>` : ''}` : `<p class="kmuted" id="wkNothing">Nothing was searched ${D.running ? 'this week yet' : 'that week'}.</p>`}
    ${D.none.length && cl.length ? `<div class="wk-none" id="wkNone">${kSq(KC.amber, WKI.pause, 28)}<span class="kn1"><b>Not searched ${D.running ? 'this week' : 'that week'}: ${noneTxt}</b><span>Their photos waited behind other clients, or searching is off for them.</span></span><a href="#keep?tab=clients">See in Keep searching ›</a></div>` : ''}</section>`;
  // ---- every photo searched once
  const first = `<section class="card wk-first" id="wkFirst"><div class="kh2">Every photo searched once</div>
    <div class="wk-big">${kSq(KC.blue, WKI.search, 40)}<span class="kn1"><b class="num">${wkN(w.first)} ${w.first === 1 ? 'photo' : 'photos'}</b><span>searched for the first time ${D.running ? 'this week' : 'that week'} · ${wkN(pw.first)} the week before</span></span></div>
    ${w.finished.map(f => `<div class="wk-fin">${kSq(KC.green, WKI.check, 28)}<span class="kn1"><b>${esc(f.name)}</b><span>All ${wkN(f.n)} photos searched at least once · ${wkDayName(f.at)}</span></span></div>`).join('')}</section>`;
  // ---- evidence reports
  const rep = `<section class="card wk-rep" id="wkReports"><div class="kh2">Evidence reports <span class="kfaint">${D.reps.length} ${D.running ? 'this week' : 'that week'}</span><a href="#library?tab=reports">See all in All evidence ›</a></div>
    ${D.reps.length ? D.reps.slice(0, 6).map(r => `<div class="wk-rr">${kSq(KC.teal, WKI.pack, 30)}<span class="kn1"><b>${esc(r.site || '')}</b><span>${esc([r.client, r.photo].filter(Boolean).join(' · '))}</span></span>${r.caseNo ? `<span class="ktag">Case ${esc(r.caseNo)}</span>` : '<span class="ktag warn">No case number</span>'}<span class="kfaint">${wkDayName(r.at)}</span></div>`).join('') + (D.reps.length > 6 ? `<p class="kfoot">And ${D.reps.length - 6} more in All evidence.</p>` : '') : '<p class="kmuted">No evidence reports were made.</p>'}</section>`;
  // ---- sites that went offline or came back: only for weeks that have these counts (PageProof
  // no longer checks whether copies are still online, so newer weeks have none).
  const off = w.offline || [], back = w.back || [];
  const sites = w.wentOffline || w.backOnline ? `<section class="card wk-sites" id="wkSites"><div class="kh2">Sites up and down</div>
    <div class="wk-split"><div><span class="wk-sh">${kSq(KC.grey, WKI.globe, 28)}<b class="num">${wkN(w.wentOffline)}</b> went offline</span>${off.slice(0, 3).map(([x, t]) => `<div class="wk-sr"><span>${esc(x)}</span><span class="kfaint">${wkDayName(t)}</span></div>`).join('')}</div>
    <div><span class="wk-sh">${kSq(KC.amber, WKI.globe, 28)}<b class="num">${wkN(w.backOnline)}</b> came back online</span>${back.slice(0, 3).map(([x, t]) => `<div class="wk-sr"><span>${esc(x)}</span><span class="kfaint">${wkDayName(t)}</span></div>`).join('')}</div></div></section>` : '';
  return `${head('Evidence', 'Weekly summary', '', '')}<div class="rvn kpn wkn">${ctl}${tiles}<div class="kgrid now2"><div class="kstack">${chart}${table}</div><div class="kstack">${first}${rep}${sites}</div></div></div>`;
};
// Click anywhere else, or Esc, closes the week list.
document.addEventListener('click', e => { const m = document.getElementById('wkMenu'); if (m && !m.hidden && !e.target.closest('.wk-pick')) wkMenuShow(false); });
document.addEventListener('keydown', e => { const m = document.getElementById('wkMenu'); if (e.key === 'Escape' && m && !m.hidden) { wkMenuShow(false); document.getElementById('wkPick').focus(); } });
function wkMenuShow(on) { const m = document.getElementById('wkMenu'), b = document.getElementById('wkPick'); if (!m) return; m.hidden = !on; b.setAttribute('aria-expanded', String(on)); if (on) (m.querySelector('.on') || m.firstElementChild).focus(); }

Object.assign(ACTS, {
  wk: v => { if (v > FC.weekKey()) return; state.wkKey = v; state.wkAll = false; render(true); },
  wkmenu: () => wkMenuShow(document.getElementById('wkMenu').hidden),
  wksort: v => { const [f, d] = state.wkSort || ['found', -1]; state.wkSort = [v, f === v ? -d : v === 'name' ? 1 : -1]; render(true); },
  wkall: () => { state.wkAll = !state.wkAll; render(true); },
  // The PDF shows what the screen shows, on A4 pages: heading, six tiles, the 8 week chart, every
  // client, first searches, evidence reports, and the clients that were not searched.
  wkpdf: async () => {
    const key = state.wkKey || FC.weekKey(), D = await wkAll(key), { w } = D, who = await getName().catch(() => '');
    const pages = await wkPdfPages(D, who);
    const out = [];
    for (const c of pages) out.push({ jpeg: new Uint8Array(await (await c.convertToBlob({ type: 'image/jpeg', quality: 0.92 })).arrayBuffer()), width: c.width, height: c.height });
    const pdf = makePdf(out, { title: 'PageProof weekly summary', subject: w.label });
    const a = document.createElement('a'); a.href = URL.createObjectURL(pdf); a.download = 'PageProof_weekly_' + key + '.pdf'; a.click();
    toast('Weekly summary saved as a PDF (' + plural(pages.length, 'page') + ').');
  },
});
// Draws the summary on A4 pages (1240 x 1754) and returns the canvases.
async function wkPdfPages(D, who) {
  const { w } = D, W = 1240, H = 1754, L = 80, R = W - 80, INK = '#1B1B1B', MUTED = '#5D5D5D', LINE = '#E0E0E0', BLUE = '#005FB8', RED = '#C42B1C', GREEN = '#0F7B0F';
  const F = (px, wt = '') => `${wt} ${px}px Lexend, Arial, sans-serif`.trim();
  const pages = []; let x, y;
  const page = () => { const c = new OffscreenCanvas(W, H); x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.textBaseline = 'alphabetic'; pages.push(c); y = 90; };
  const room = h => { if (y + h > H - 110) page(); };
  const text = (t, px, py, font, col = INK, align = 'left') => { x.font = font; x.fillStyle = col; x.textAlign = align; x.fillText(t, px, py); x.textAlign = 'left'; };
  const fit = (t, font, wMax) => { x.font = font; if (x.measureText(t).width <= wMax) return t; while (t.length > 1 && x.measureText(t + '…').width > wMax) t = t.slice(0, -1); return t + '…'; };
  const h2 = t => { room(120); y += 26; text(t, L, y, F(28, '600'), BLUE); y += 34; };
  page();
  // heading
  let ix = L;
  try { const bmp = await createImageBitmap(await (await fetch('icons/icon48.png')).blob()); x.drawImage(bmp, L, y - 6, 56, 56); ix = L + 74; } catch (e) { /* no icon, no harm */ }
  text('PageProof weekly summary', ix, y + 24, F(38, '600'));
  text(w.label + (D.running ? ' · so far, ' + D.name[1].split(' · ')[1] : ''), ix, y + 58, F(22), MUTED);
  if (who) text('Made by ' + fit(who, F(19), 300), R, y + 22, F(19), MUTED, 'right');
  text('PageProof ' + VERSION, R, y + 50, F(19), MUTED, 'right');
  y += 84; x.fillStyle = BLUE; x.fillRect(L, y, R - L, 3); y += 34;
  // six tiles, three to a row
  const tw = (R - L - 40) / 3, thh = 132;
  D.tiles.forEach(([, , a, b, l, col], i) => {
    const bx = L + (i % 3) * (tw + 20), by = y + Math.floor(i / 3) * (thh + 20), d = wkPct(a, b);
    x.strokeStyle = LINE; x.lineWidth = 2; x.strokeRect(bx, by, tw, thh);
    text(wkN(a), bx + 22, by + 58, F(46, '600'), col === 'bad' ? RED : col === 'ok' ? GREEN : INK);
    text(l, bx + 22, by + 90, F(21), INK);
    text(d === null ? 'New this week' : d === 0 ? 'Same as the week before' : (d > 0 ? '▲ ' : '▼ ') + Math.abs(d) + '% ' + D.vs, bx + 22, by + 116, F(17), MUTED);
  });
  y += 2 * thh + 20 + 24;
  // last 8 weeks
  h2('Last 8 weeks');
  text('Copies found each week. Red = marked stolen.', L, y, F(19), MUTED); y += 20;
  const ch = 170, max = Math.max(1, ...D.weeks.map(v => v.w.found || 0)), cw = (R - L) / 8;
  D.weeks.forEach((v, i) => {
    const f = v.w.found || 0, st = Math.min(f, v.w.stolen || 0), bh = Math.round(f / max * ch), sh = Math.round(st / max * ch), bx = L + i * cw + cw * 0.2, bw = cw * 0.6, cur = v.key === D.key;
    text(wkN(f), bx + bw / 2, y + 26 + ch - bh - 8, F(18, cur ? '600' : ''), cur ? INK : MUTED, 'center');
    x.globalAlpha = cur ? 1 : 0.5; x.fillStyle = BLUE; x.fillRect(bx, y + 26 + ch - bh, bw, bh - sh); x.fillStyle = RED; x.fillRect(bx, y + 26 + ch - sh, bw, sh); x.globalAlpha = 1;
    text(v.key === FC.weekKey() ? 'This week' : wkShort(v.start), bx + bw / 2, y + 26 + ch + 26, F(17, cur ? '600' : ''), cur ? BLUE : MUTED, 'center');
  });
  x.fillStyle = LINE; x.fillRect(L, y + 26 + ch, R - L, 2); y += 26 + ch + 50;
  // by client: every client, onto more pages when needed
  const cl = wkSorted(w.clients), cols = [L, 760, 930, R];
  const thead = () => { text('Client', cols[0], y, F(19, '600'), MUTED); text('Photos searched', cols[1], y, F(19, '600'), MUTED, 'right'); text('Copies found', cols[2], y, F(19, '600'), MUTED, 'right'); text('Stolen', cols[3], y, F(19, '600'), MUTED, 'right'); y += 12; x.fillStyle = LINE; x.fillRect(L, y, R - L, 2); y += 30; };
  h2('By client');
  if (!cl.length) { text('Nothing was searched.', L, y, F(21), MUTED); y += 34; } else {
    thead();
    for (const [nm, c] of cl) {
      if (y + 36 > H - 110) { page(); text('By client, continued', L, y, F(22, '600'), BLUE); y += 40; thead(); }
      text(fit(nm, F(21), 520), cols[0], y, F(21)); text(wkN(c.searched), cols[1], y, F(21), INK, 'right'); text(wkN(c.found), cols[2], y, F(21, '600'), INK, 'right'); text(c.stolen ? wkN(c.stolen) : '–', cols[3], y, F(21), c.stolen ? RED : MUTED, 'right'); y += 34;
    }
  }
  const lines = (list, more) => { for (const t of list) { room(36); text(fit(t, F(21), R - L), L, y, F(21)); y += 34; } if (more) { room(36); text(more, L, y, F(19), MUTED); y += 34; } };
  if (D.none.length && cl.length) { h2('Clients not searched'); const t = D.none.slice(0, 40).join(', ') + (D.none.length > 40 ? ' and ' + (D.none.length - 40) + ' more' : ''); x.font = F(21); const words = t.split(' '), out = []; let ln = ''; for (const wd of words) { if (x.measureText(ln + ' ' + wd).width > R - L && ln) { out.push(ln); ln = wd; } else ln = ln ? ln + ' ' + wd : wd; } if (ln) out.push(ln); lines(out); }
  h2('Every photo searched once');
  lines([wkN(w.first) + (w.first === 1 ? ' photo was' : ' photos were') + ' searched for the first time.', ...w.finished.map(f => '✓ ' + f.name + ': all ' + wkN(f.n) + ' photos searched at least once')]);
  h2('Evidence reports');
  lines(D.reps.length ? D.reps.slice(0, 60).map(r => [r.site, r.client, r.photo, r.caseNo ? 'Case ' + r.caseNo : 'No case number'].filter(Boolean).join(' · ')) : ['No evidence reports were made.'], D.reps.length > 60 ? 'And ' + (D.reps.length - 60) + ' more in All evidence.' : '');
  if (w.wentOffline || w.backOnline) { h2('Sites up and down'); lines([wkN(w.wentOffline) + ' went offline' + ((w.offline || []).length ? ': ' + w.offline.slice(0, 6).map(v => v[0]).join(', ') : ''), wkN(w.backOnline) + ' came back online' + ((w.back || []).length ? ': ' + w.back.slice(0, 6).map(v => v[0]).join(', ') : '')]); }
  const made = 'Saved ' + new Date().toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  pages.forEach((c, i) => { const g = c.getContext('2d'); g.font = F(18); g.fillStyle = '#8A8A8A'; g.textAlign = 'left'; g.fillText(made, L, H - 60); g.textAlign = 'right'; g.fillText('Page ' + (i + 1) + ' of ' + pages.length, R, H - 60); });
  return pages;
}
