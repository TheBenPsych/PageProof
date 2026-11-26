// Evidence › Overview in the calm look (step 15): app.html#capture
// This page used to be "Capture a page", a place to start a capture. It is now a look at what has
// been captured: four tiles, captures per week, what still needs you, the newest captures, where
// captures come from, the most captured sites and cases, how captures went, the trusted time
// services and where the packs are. Starting a capture sits behind "How to capture".
// Everything is counted from the capture log. Nothing here changes a capture or a pack.
const OVI = (() => {
  const s = (p, z = 16) => `<svg viewBox="0 0 16 16" width="${z}" height="${z}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  return {
    cam: s('<rect x="1.8" y="4.2" width="12.4" height="9" rx="1.5"/><path d="M5.5 4.2 6.6 2.5h2.8l1.1 1.7"/><circle cx="8" cy="8.7" r="2.4"/>'),
    pack: s('<path d="M2.5 5 8 2.2 13.5 5v6L8 13.8 2.5 11z"/><path d="M2.5 5 8 7.8 13.5 5M8 7.8v6"/>'),
    clock: s('<circle cx="8" cy="8" r="6.2"/><path d="M8 4.6V8l2.4 1.6"/>'),
    warn: s('<path d="M8 2.2 14.2 13H1.8z"/><path d="M8 6.5v3.2M8 11.4v.1"/>'),
    shield: s('<path d="M8 1.8 13 3.6v4c0 3.2-2.2 5.4-5 6.6-2.8-1.2-5-3.4-5-6.6v-4z"/><path d="m5.6 8 1.7 1.7 3.2-3.4"/>'),
    folder: s('<path d="M1.8 4.2a1 1 0 0 1 1-1h3.3l1.5 1.6h5.6a1 1 0 0 1 1 1v6.9a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1z"/>'),
    save: s('<path d="M2.5 2.5h9l2 2v9h-11z"/><path d="M5 2.5v3.5h5V2.5M5 13.5v-4h6v4"/>'),
    open: s('<rect x="1.8" y="2.5" width="12.4" height="11" rx="1.5"/><path d="M1.8 5.5h12.4"/>'),
    tag: s('<path d="M2 2.5h5.5l6.5 6.5-5 5-6.5-6.5z"/><circle cx="5" cy="5.5" r="1"/>'),
    globe: s('<circle cx="8" cy="8" r="6.2"/><path d="M1.8 8h12.4M8 1.8c1.8 2 1.8 10.4 0 12.4M8 1.8c-1.8 2-1.8 10.4 0 12.4"/>'),
    check: s('<path d="m3 8.5 3.2 3L13 4.5"/>'),
    stolen: s('<path d="M8 1.8 13 3.6v4c0 3.2-2.2 5.4-5 6.6-2.8-1.2-5-3.4-5-6.6v-4z"/><path d="M8 5v3.5M8 10.4v.1"/>'),
    pop: s('<rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 6h6M5 9h4"/>'),
    key: s('<rect x="1.8" y="4" width="12.4" height="8" rx="1.5"/><path d="M4.5 7h.1M7 7h.1M9.5 7h.1M11.5 7h.1M5 9.5h6"/>'),
    mouse: s('<rect x="4.5" y="1.8" width="7" height="12.4" rx="3.5"/><path d="M8 1.8v4.5M4.5 6.3h7"/>'),
    ruler: s('<path d="M2 11 11 2l3 3-9 9z"/><path d="m5 8 1.5 1.5M7 6l1 1M9 4l1.5 1.5"/>'),
    box: s('<rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M11 5v6"/>'),
    chev: s('<path d="m6 3.5 4.5 4.5L6 12.5"/>', 14),
  };
})();
// Where a capture was started (saved with each capture from this version on).
const OV_SRC = {
  stolen: ['From Stolen', 'Marked Stolen', 'captured by itself', KC.red, OVI.stolen],
  popup: ['Pop-up', 'Pop-up', 'Capture this page', KC.blue, OVI.pop],
  key: ['Alt+Shift+P', 'Alt+Shift+P', 'keyboard shortcut', KC.purple, OVI.key],
  menu: ['Right-click', 'Right-click menu', 'Capture this page or a link', KC.teal, OVI.mouse],
  app: ['PageProof page', 'From PageProof', 'How to capture, on this page', KC.green, OVI.cam],
  link: ['A link', 'A link in PageProof', 'Site owners, a search result, capture again', KC.amber, OVI.globe],
  old: ['', 'Not counted', 'captured before PageProof kept count', KC.grey, OVI.clock],
};
Object.assign(state, { ovHow: false });
const ovStampN = x => { const sv = (x.saves || []).filter(s => s && s.at); return sv.length ? evStamps(sv[sv.length - 1]).length : 0; };
const ovSaved = x => (x.saves || []).some(s => s && s.at);
const ovLast = x => { const sv = (x.saves || []).filter(s => s && s.at); return sv[sv.length - 1] || null; };
const ovDur = ms => { const s = Math.round(ms / 1000); return s < 60 ? s + ' s' : Math.floor(s / 60) + ' min' + (s % 60 ? ' ' + (s % 60) + ' s' : ''); };
function ovHowCard(t) {
  const step = (n, c, i, b, s) => `<div><span class="chn">${n}</span>${kSq(c, i, 36)}<span class="kn1"><b>${b}</b><span>${s}</span></span></div>`;
  return `<section class="card cphow" id="ovHow"><div class="kh2">How to capture<button class="kx" data-act="ovhow" aria-label="Close" title="Close">✕</button></div>
    <div class="cpsteps">${step(1, KC.blue, OVI.globe, 'Open the page', 'Let it finish loading')}${step(2, KC.purple, OVI.cam, 'Click the PageProof icon › Capture', 'Or press <span id="ovKey">Alt+Shift+P</span>. Don\'t scroll while it works')}${step(3, KC.green, OVI.save, 'Save the pack', 'Type the case number')}</div>
    <div class="cplast">${t ? `${evSl(site(t.url))}<span class="kn1"><b title="${esc(t.title || '')}">${esc(t.title || site(t.url))}</b><span>Your last tab · ${esc(site(t.url))}</span></span><button class="btn kbtn primary" data-act="capturelast">${OVI.cam}Capture this page</button>`
      : `<span class="esl" style="--h:0;background:var(--faint)">?</span><span class="kn1"><b>Open the web page you want in another tab first</b><span>Then come back here, or click the PageProof icon on that page.</span></span>`}</div></section>`;
}
V.capture = async () => {
  if (routeArg('how')) { state.ovHow = true; history.replaceState(null, '', '#capture'); }
  const [log, st, copies] = await Promise.all([getLog(), api.storage.local.get(['ppCapTip']), FC.allCopies().catch(() => [])]);
  const now = Date.now(), DY = 864e5, N = log.length;
  const btn = `<button class="btn kbtn${state.ovHow ? ' on' : ''}" data-act="ovhow" aria-expanded="${!!state.ovHow}">${OVI.cam}How to capture</button><a class="btn kbtn" href="#verify">${OVI.shield}Verify a pack</a><button class="btn kbtn" data-act="evdownloads">${OVI.folder}Open packs folder</button>`;
  const how = state.ovHow ? ovHowCard(await lastWebTab()) : '';
  const hd = head('Evidence', 'Overview', '', btn);
  if (!N) {
    return hd + `<div class="rvn kpn cpn">${how}<section class="card cpempty" id="ovEmpty">${kSq(KC.blue, OVI.cam, 64)}<h2>No captures yet</h2>
      <p>Your captures, evidence packs and how they went will show here after your first capture.</p>
      <div class="cpsteps">${[[KC.blue, OVI.globe, 'Open the page', 'Let it finish loading'], [KC.purple, OVI.cam, 'Click the PageProof icon › Capture', 'Or press Alt+Shift+P'], [KC.green, OVI.save, 'Save the pack', 'Type the case number']].map(([c, i, b, s], k) => `<div><span class="chn">${k + 1}</span>${kSq(c, i, 36)}<span class="kn1"><b>${b}</b><span>${s}</span></span></div>`).join('')}</div>
      <p class="kfoot">Copies you mark Stolen in Copies found are captured by themselves.</p></section></div>`;
  }
  // a capture of a Stolen copy's page counts as "from Stolen" even if it was made before the count began
  const stolenKeys = new Set(); for (const c of copies) if (c.status === 'stolen') for (const u of [c.url, ...(c.alts || [])]) stolenKeys.add(FC.pageKey(u));
  const srcOf = x => OV_SRC[x.src] && x.src !== 'old' ? x.src : stolenKeys.has(FC.pageKey(x.url)) ? 'stolen' : 'old';
  const L = log.map(x => ({ x, t: Date.parse(x.time) || 0, src: srcOf(x), saved: ovSaved(x), ts: ovStampN(x), sv: ovLast(x), host: site(x.url) }));
  const saved = L.filter(r => r.saved), notSaved = L.filter(r => !r.saved).reverse();
  const full = saved.filter(r => r.ts >= 3), part = saved.filter(r => r.ts > 0 && r.ts < 3).reverse(), noTs = saved.filter(r => !r.ts), noCase = saved.filter(r => !r.sv.caseRef);
  const d0 = new Date(); const month = L.filter(r => { const d = new Date(r.t); return d.getMonth() === d0.getMonth() && d.getFullYear() === d0.getFullYear(); }).length, week = L.filter(r => now - r.t < 7 * DY).length;
  const lib = f => '#library?filter=' + encodeURIComponent(f);

  const tip = st.ppCapTip === 0 ? '' : `<div class="kbar info" id="ovTip">${kSq(KC.blue, OVI.cam, 28)}<div><b>To capture a page, open it and click the PageProof icon › Capture, or press Alt+Shift+P</b><span>Copies you mark Stolen are captured by themselves. Captures and packs then show here and in All evidence.</span></div><button class="kx" data-act="ovtip" aria-label="Close this tip" title="Close">✕</button></div>`;
  const tile = (c, i, b, l, s, id) => `<div class="card kt2" id="${id}">${kSq(c, i, 40)}<span><b class="num">${b}</b><span class="l">${l}</span><span class="s">${s}</span></span></div>`;
  const tiles = `<div class="ktiles2" id="ovTiles">${tile(KC.blue, OVI.cam, month.toLocaleString(), 'Captures this month', `${week.toLocaleString()} this week · ${N.toLocaleString()} in all`, 'ovMonth')}${tile(KC.green, OVI.pack, saved.length.toLocaleString(), 'Evidence packs saved', `${Math.round(saved.length / N * 100)}% of captures`, 'ovPacks')}${tile(KC.teal, OVI.clock, full.length.toLocaleString(), 'Fully timestamped', `3 of 3 services${part.length ? ' · ' + part.length + ' with fewer' : ''}`, 'ovStamped')}${tile(notSaved.length ? KC.amber : KC.grey, OVI.warn, notSaved.length.toLocaleString(), 'Waiting for a pack', notSaved.length ? `<a href="${lib('Pack not saved')}">See them ›</a>` : 'Every capture has its pack', 'ovWaiting')}</div>`;

  // captures per week, last 12 weeks
  const WK = 12, wk = Array.from({ length: WK }, () => ({ stolen: 0, hand: 0 }));
  const sow = t => { const x = new Date(t); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return +x; };
  const w0 = sow(now);
  for (const r of L) { const k = Math.round((w0 - sow(r.t)) / (7 * DY)); if (k >= 0 && k < WK) wk[WK - 1 - k][r.src === 'stolen' ? 'stolen' : 'hand']++; }
  const mx = Math.max(4, ...wk.map(w => w.stolen + w.hand));
  const lab = k => k === WK - 1 ? 'This week' : new Date(w0 - (WK - 1 - k) * 7 * DY).toLocaleDateString([], { month: 'short', day: 'numeric' });
  const chart = `<section class="card cpbox2" id="ovChart"><div class="kh2">Captures per week <span class="kfaint">last 12 weeks</span><span class="cplg"><i class="s"></i>Of a Stolen copy<i class="h"></i>Other pages</span></div>
    <div class="cpchart" role="img" aria-label="Captures per week for the last 12 weeks: ${wk.map((w, k) => lab(k) + ' ' + (w.stolen + w.hand)).join(', ')}">${[1, .5, 0].map(f => `<span class="cpgl" style="bottom:${f * 100}%"><em>${Math.round(mx * f)}</em></span>`).join('')}
      ${wk.map((w, k) => `<div class="cpcol${k === WK - 1 ? ' now' : ''}" title="${esc(lab(k))}: ${w.stolen} of a Stolen copy, ${w.hand} other"><div class="cpst" style="height:${(w.stolen + w.hand) / mx * 100}%"><b class="num">${w.stolen + w.hand || ''}</b><i class="h" style="flex:${w.hand}"></i><i class="s" style="flex:${w.stolen}"></i></div><span>${esc(lab(k))}</span></div>`).join('')}</div></section>`;

  // needs you
  const need = [];
  for (const r of notSaved.slice(0, 3)) need.push([KC.amber, OVI.pack, 'Pack not saved', r, `<button class="btn kbtn primary" data-act="opencap" data-v="${esc(r.x.id)}">${OVI.save}Save the pack</button>`]);
  for (const r of part.slice(0, 2)) need.push([KC.teal, OVI.clock, `Only ${r.ts} of 3 timestamps`, r, `<button class="btn kbtn" data-act="ovopen" data-v="${esc(r.x.id)}">${OVI.open}Open</button>`]);
  const nNeed = notSaved.length + part.length + (noCase.length ? 1 : 0) + (noTs.length ? 1 : 0);
  const go = (n, one, many, sub, f) => n ? `<div class="cpnr">${kSq(KC.grey, f === 'No timestamps' ? OVI.clock : OVI.tag, 32)}<span class="kn1"><b>${n} ${n === 1 ? one : many}</b><span>${sub}</span></span><a class="cpgo" href="${lib(f)}">Show ${n === 1 ? 'it' : 'them'} ${OVI.chev}</a></div>` : '';
  const needC = `<section class="card cpneed" id="ovNeed"><div class="kh2">Needs you ${nNeed ? `<span class="ktag warn">${nNeed}</span>` : ''}</div>
    ${nNeed ? need.map(([c, i, b, r, B]) => `<div class="cpnr">${kSq(c, i, 32)}<span class="kn1"><b>${b}</b><span><span class="csite">${esc(r.host)}</span> · ${esc(evWhen(r.x.time))}</span></span>${B}</div>`).join('')
      + (notSaved.length > 3 ? `<div class="cpnr">${kSq(KC.amber, OVI.pack, 32)}<span class="kn1"><b>${notSaved.length - 3} more with no pack</b><span>Save their packs from All evidence</span></span><a class="cpgo" href="${lib('Pack not saved')}">Show them ${OVI.chev}</a></div>` : '')
      + go(noCase.length, 'pack has no case number', 'packs have no case number', 'Save the pack again with its case number', 'No case number') + go(noTs.length, 'pack has no timestamps', 'packs have no timestamps', 'The time services did not answer when it was saved', 'No timestamps')
      + '<p class="kfoot">Each one opens in All evidence with the right filter on.</p>'
      : `<div class="cpallok">${kSq(KC.green, OVI.check, 40)}<span class="kn1"><b>Nothing needs you</b><span>Every capture has its pack, a case number and its timestamps.</span></span></div>`}</section>`;

  // newest captures, one row
  const newest = L.slice(-7).reverse();
  const stat = r => !r.saved ? '<span class="ktag warn">Pack not saved</span>' : r.ts >= 3 ? `<span class="cpok">${OVI.check}Pack · 3 timestamps</span>` : `<span class="cpok part">${OVI.check}Pack · ${r.ts} of 3 timestamps</span>`;
  const newC = `<section class="card cpnew" id="ovNewest"><div class="kh2">Newest captures <span class="kfaint">${N.toLocaleString()} in all</span><a href="#library">See all in All evidence ›</a></div>
    <div class="cpcards">${newest.map(r => `<button class="cpcard" data-act="ovopen" data-v="${esc(r.x.id)}" title="${esc(r.x.url)}"><span class="cpimg"><span class="evph" data-capthumb="${esc(r.x.id)}"><b>${esc((r.host[0] || '?').toUpperCase())}</b></span>${OV_SRC[r.src][0] ? `<em>${OV_SRC[r.src][0]}</em>` : ''}</span>
      <span class="cpt">${evSl(r.host)}<span class="kn1"><b>${esc(r.host)}</b><span>${esc(evWhen(r.x.time))}</span></span></span>${stat(r)}</button>`).join('')}</div></section>`;

  // where captures come from
  const cnt = k => L.filter(r => r.src === k).length;
  const SR = ['stolen', 'popup', 'key', 'menu', 'app', 'link', 'old'].filter(k => cnt(k) || ['stolen', 'popup', 'key', 'menu'].includes(k));
  const fromC = `<section class="card cpbox2" id="ovFrom"><div class="kh2">Where captures come from</div>
    <div class="cpsplit" aria-hidden="true">${SR.map(k => cnt(k) ? `<i style="flex:${cnt(k)};background:${OV_SRC[k][3]}"></i>` : '').join('')}</div>
    ${SR.map(k => `<div class="cpr" data-src="${k}">${kSq(OV_SRC[k][3], OV_SRC[k][4], 32)}<span class="kn1"><b>${OV_SRC[k][1]}</b><span>${OV_SRC[k][2]}</span></span><b class="num cpn2">${cnt(k).toLocaleString()}</b><span class="kfaint num cpp">${Math.round(cnt(k) / N * 100)}%</span></div>`).join('')}</section>`;

  // most captured sites and cases
  const tally = (arr, f) => { const m = new Map(); for (const r of arr) { const k = f(r); if (k) m.set(k, (m.get(k) || 0) + 1); } return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); };
  const topS = tally(L, r => r.host).slice(0, 4), topC = tally(saved, r => r.sv.caseRef).slice(0, 4);
  const bar = (n, m) => `<span class="cpbar"><i style="width:${n / m * 100}%"></i></span>`;
  const sitesC = `<section class="card cpbox2" id="ovMost"><div class="kh2">Most captured</div>
    <div class="kh3">Sites</div>${topS.map(([s, n]) => `<div class="cpr2">${evSl(s)}<b title="${esc(s)}">${esc(s)}</b>${bar(n, topS[0][1])}<span class="num">${n}</span></div>`).join('')}
    <div class="kh3" style="margin-top:14px">Cases</div>${topC.length ? topC.map(([s, n]) => `<div class="cpr2"><span class="cpcase">${OVI.tag}</span><b class="mono" title="${esc(s)}">${esc(s)}</b>${bar(n, topC[0][1])}<span class="num">${n}</span></div>`).join('') : '<p class="kmuted" style="margin:4px 0 0;font-size:14px">No pack has a case number yet.</p>'}</section>`;

  // how captures went (counted for captures made from this version on)
  const m30 = L.filter(r => r.x.ms > 0 && now - r.t < 30 * DY), avg = f => m30.reduce((a, r) => a + (f(r.x) || 0), 0) / (m30.length || 1), sum = f => m30.reduce((a, r) => a + (f(r.x) || 0), 0);
  const HW = m30.length ? [[KC.blue, OVI.clock, ovDur(avg(x => x.ms)), 'Average time per capture'], [KC.purple, OVI.ruler, (Math.round(avg(x => x.screens) * 10) / 10) + ' screens', 'Average page length'],
    [KC.teal, OVI.box, sum(x => x.boxes).toLocaleString(), `Scroll boxes captured, in ${plural(m30.filter(r => r.x.boxes > 0).length, 'capture')}`], [KC.green, OVI.pop, sum(x => x.popups).toLocaleString(), 'Cookie and sign-up pop-ups closed'],
    [KC.amber, OVI.warn, m30.filter(r => r.x.stopped).length.toLocaleString(), 'Stopped early (you pressed Stop)'], [KC.grey, OVI.ruler, m30.filter(r => r.x.endless).length.toLocaleString(), 'Endless pages, stopped where they ended']] : [];
  const howC = `<section class="card cpbox2" id="ovWent"><div class="kh2">How captures went <span class="kfaint">last 30 days</span></div>
    ${HW.length ? `<div class="cphw">${HW.map(([c, i, b, s]) => `<div>${kSq(c, i, 32)}<span class="kn1"><b class="num">${b}</b><span>${s}</span></span></div>`).join('')}</div><p class="kfoot">From ${plural(m30.length, 'capture')}.</p>`
      : `<p class="kmuted" id="ovWentNone" style="margin:6px 0 0">PageProof counts this from now on: how long a capture takes, how long the pages are, scroll boxes, pop-ups closed. It shows after your next capture.</p>`}</section>`;

  // trusted time services
  const stamped = saved.filter(r => r.sv.timestamps != null), has = (r, n) => String(r.sv.timestamps || '').includes(n);
  const tsRow = (s, spare) => { const ok = stamped.filter(r => has(r, s.name)).length, of = stamped.length;
    return `<div class="cpts" data-tsa="${s.name}"><span class="cst ${spare && !ok ? 'plain' : !spare && ok < of ? 'warn' : 'ok'}"></span><span class="kn1"><b>${s.name}</b><span>${spare ? (ok ? `Stepped in for ${plural(ok, 'pack')}` : 'Spare, used when one of the three does not answer') : of ? `Answered ${ok.toLocaleString()} of ${of.toLocaleString()} packs` : 'Asked when a pack is saved'}</span></span>${spare ? '<span class="ktag">Spare</span>' : !of ? '' : ok < of ? `<span class="ktag warn">Missed ${of - ok}</span>` : '<span class="ktag ok">Every time</span>'}</div>`; };
  const tsC = `<section class="card cpbox2" id="ovTsa"><div class="kh2">Trusted timestamps</div>
    ${PP_TSA.SERVICES.map(s => tsRow(s, false)).join('')}${(PP_TSA.SPARES || []).map(s => tsRow(s, true)).join('')}
    <p class="kfoot">Every pack asks three services for the time it was saved, so nobody has to trust PageProof's clock.</p></section>`;

  // where the packs are
  let kept = 0; for (const r of L.slice(-12)) { try { if (await PP_DB.get(r.x.id)) kept++; } catch (e) { /* not kept */ } }
  const whereC = `<section class="card cpbox2" id="ovWhere"><div class="kh2">Where your packs are</div>
    <div class="cpr">${kSq(KC.amber, OVI.folder, 32)}<span class="kn1"><b>Downloads › PageProof › case number</b><span>Every evidence pack (a .zip file), one folder per case</span></span><button class="btn kbtn" data-act="evdownloads">${OVI.folder}Open folder</button></div>
    <div class="cpr">${kSq(KC.blue, OVI.cam, 32)}<span class="kn1"><b>Newest captures kept in this browser</b><span>You can still save a pack from these, or open them again</span></span><b class="num cpn2">${kept}</b></div>
    <div class="cpr">${kSq(KC.grey, OVI.open, 32)}<span class="kn1"><b>Older captures</b><span>Only the small picture and the log line stay here. The pack is the proof</span></span><b class="num cpn2">${(N - kept).toLocaleString()}</b></div></section>`;

  return hd + `<div class="rvn kpn cpn">${how}${tip}${tiles}
    <div class="kgrid now2 cpg"><div>${chart}</div><div>${needC}</div></div>
    ${newC}
    <div class="kgrid cp3">${fromC}${sitesC}${howC}</div>
    <div class="kgrid two cpg">${tsC}${whereC}</div></div>`;
};
V.capture.after = () => {
  capThumbs();
  const k = document.getElementById('ovKey');
  if (k) try { api.commands.getAll(cs => { const c = (cs || []).find(x => x.name === 'capture-page'); if (c && c.shortcut && document.getElementById('ovKey')) document.getElementById('ovKey').textContent = c.shortcut; }); } catch (e) { /* the usual keys stay */ }
};
Object.assign(ACTS, {
  ovhow: () => { state.ovHow = !state.ovHow; render(true); },
  ovtip: async () => { try { await api.storage.local.set({ ppCapTip: 0 }); } catch (e) { /* only this time */ } render(true); },
  // open a capture's details in All evidence
  ovopen: v => { state.evTab = 'captures'; state.evF = 'all'; state.evClient = ''; state.libQ = ''; state.evSort = 'new'; state.evMore = 1e6; state.evSel = v; location.hash = 'library'; },
});
