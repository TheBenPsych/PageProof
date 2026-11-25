// Settings › How PageProof is doing: what PageProof did on this computer, day by day (pp-stats.js
// records it, pp-report.js works it out), the Checker test (pp-selftest.js), and "Save stats for
// Claude", one file with the numbers to send for help. Numbers only, never names or links.
Object.assign(state, { stRange: '7', stModel: null, stTest: null });
const SR = () => PP_REPORT;
const stMs = v => PP_REPORT.ms(v);
const stN = v => PP_REPORT.num(v);

// ---------------------------------------------------------------- small drawings
function stBars(rows, colour) {
  const max = Math.max(1, ...rows.map(r => r[1]));
  return `<div class="st-bars">${rows.map(([l, n, c, why]) => `<div class="st-bar"${why ? ` title="${esc(why)}"` : ''}><span>${esc(l)}</span><span class="st-track"><i style="width:${n ? Math.max(1.5, n / max * 100) : 0}%;background:${c || colour || 'var(--accent)'}"></i></span><b class="num">${stN(n)}</b></div>`).join('')}</div>`;
}
// UI overhaul batch 7: "From search to copy" as a funnel: centred bars that narrow, the number on the right.
function stFunnel(rows) {
  const max = Math.max(1, ...rows.map(r => r[1]));
  return `<div class="fun">${rows.map(([l, n, c], i) => `<div class="fun-r"><span class="fun-l">${esc(l)}</span><span class="fun-t"><i style="width:${n ? Math.max(3, n / max * 100) : 0}%;background:${c}"></i></span><b class="num">${stN(n)}</b>${i && rows[0][1] ? `<small class="faint">${Math.round(n / rows[0][1] * 100)}%</small>` : '<small></small>'}</div>`).join('')}</div>`;
}
function stStack(parts) {
  const tot = parts.reduce((a, p) => a + p[1], 0);
  if (!tot) return '<p class="faint" style="margin:0;font-size:13px">Nothing yet.</p>';
  return `<div class="st-stack" role="img" aria-label="${esc(parts.map(p => p[0] + ' ' + p[1]).join(', '))}">${parts.map(([, n, c]) => n ? `<i style="flex:${n} 0 0;background:${c}"></i>` : '').join('')}</div>
  <div class="st-legend">${parts.map(([l, n, c]) => `<span><i style="background:${c}"></i>${esc(l)} <b>${tot ? Math.round(n / tot * 100) : 0}%</b> <span class="faint">(${stN(n)})</span></span>`).join('')}</div>`;
}
function stSpark(vals) {
  if (vals.length < 2 || !vals.some(v => v)) return '';
  const W = 300, H = 46, max = Math.max(1, ...vals), x = i => i / (vals.length - 1) * (W - 6) + 3, y = v => H - 4 - v / max * (H - 10);
  const line = vals.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  return `<svg class="st-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="New copies a day"><path d="${line} L${x(vals.length - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z" fill="var(--accent-soft)"/><path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"/><circle cx="${x(vals.length - 1)}" cy="${y(vals[vals.length - 1])}" r="3.5" fill="var(--accent)"/></svg>`;
}
const stTable = (head, rows) => `<div class="st-scroll"><table class="st-t"><thead><tr>${head.map((h, i) => `<th${i ? ' class="r"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((v, i) => `<td${i ? ' class="r num"' : ''}>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const stCard = (title, sub, body, right = '') => `<section class="card pad st-card"><div class="row" style="gap:10px;align-items:flex-start"><div style="flex:1;min-width:0"><h2>${title}</h2>${sub ? `<p class="muted" style="margin:4px 0 0;font-size:13.5px">${sub}</p>` : ''}</div>${right}</div>${body}</section>`;
function stTrend(now, before, lowerIsBetter) {
  if (!before || now == null) return '';
  const d = Math.round((now / before - 1) * 100);
  if (Math.abs(d) < 3) return '<small class="faint">about the same as before</small>';
  const good = lowerIsBetter ? d < 0 : d > 0;
  return `<small style="color:var(--${good ? 'ok' : 'bad'});font-weight:600">${d > 0 ? '▲' : '▼'} ${Math.abs(d)}% on the ${state.stRange === 'today' ? 'day' : state.stRange + ' days'} before</small>`;
}

// ---------------------------------------------------------------- the sections
function stTestCard(m) {
  const T = state.stTest, last = m.test;
  const runBtn = T && T.running ? `<button class="btn" disabled data-why="The test is running.">Testing…</button>` : `<button class="btn${last ? '' : ' primary'}" data-act="sttest">Run the checker test</button>`;
  let body = '';
  if (T && T.running) body = `<div class="scanbar" id="stTestBar"><span class="spin"></span>Checking test picture ${T.done || 0} of ${T.total || 72}…</div>`;
  else if (last) {
    const G = Object.values(last.groups);
    body = stBars(G.map(g => [g.label + ' (' + g.n + ')', g.right, g.right === g.n ? 'var(--ok)' : 'var(--warn)', g.right < g.n ? 'Same ' + g.same + ', Maybe ' + g.maybe + ', Different ' + g.no + ', could not check ' + g.cant : '']), 'var(--ok)') +
      `<p class="faint" style="margin:0;font-size:12.5px">${last.right} of ${last.n} right · ${stMs(last.ms)} each · fast checker ${last.fast ? 'on' : 'off'} · graphics card ${last.gpu ? 'used' : 'not used'} · ${esc(new Date(last.at).toLocaleString())}. On the computer it was made on it gets all ${last.n} right.</p>`;
  } else body = `<p class="muted" style="margin:0;font-size:14px">Not run on this computer yet. It takes about a minute and you can keep working.</p>`;
  // 4.47: your own real pairs (Documents\PageProof\checker-tests), kept from your answers.
  const R = m.realtest;
  if (!(T && T.running)) body += R && R.n ? `<div class="st-real"><h3 class="st-h3">Your real pairs</h3>${stBars([['Right', R.right, 'var(--ok)'], ['Kept, but you removed it', R.wrongKept, 'var(--bad)'], ['Missed, but you said it is a copy', R.missed, 'var(--warn)']], 'var(--ok)')}
      ${Object.keys(R.byKind || {}).length ? `<p class="faint" style="margin:0;font-size:12.5px">${Object.entries(R.byKind).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => esc(PP_CTESTS.KIND_NAME[k] || k) + ' ' + v.right + ' of ' + v.n).join(' · ')}</p>` : ''}</div>`
    : `<p class="faint" style="margin:6px 0 0;font-size:12.5px">${m.realPairs ? stN(m.realPairs) + ' real pairs kept so far. They are checked the next time you run the test.' : 'Your real pairs: none yet. Each time you remove a copy the checker called Same photo, or press "It is a copy" on one it threw out, a small pair is kept in Documents\\PageProof\\checker-tests (this computer only) and checked here.'}</p>`;
  const tag = last && !(T && T.running) ? `<span class="tag ${last.right === last.n ? 'ok' : last.right / last.n >= 0.9 ? 'warn' : 'bad'}">${last.right} of ${last.n} right</span>${R && R.n ? ` <span class="tag ${R.right / R.n >= 0.9 ? 'ok' : R.right / R.n >= 0.75 ? 'warn' : 'bad'}">Real pairs ${R.right} of ${R.n}</span>` : ''}` : '';
  return stCard('Checker test', 'PageProof draws made-up test pictures, makes copies of them (smaller, cropped, a headline over them, mirrored, tilted) and checks each one with the same photo checker a real search uses. Different pictures must come out Different.', body, `<div class="row" style="gap:8px">${tag}${runBtn}</div>`);
}
function stFound(m) {
  const D = m.D, c = k => SR().c(D, k);
  const dropped = SR().DROP.reduce((a, [k]) => a + c('drop.' + k), 0);
  const per = SR().lastDays(30).map(k => SR().c(m.days[k], 'copies.new'));
  return stCard('From search to copy', 'What the searches found, and how much of it became a copy for you to answer.',
    `<div class="st-funnel">${stFunnel([['Links found', c('links'), '#2563EB'], ['Thrown out', dropped, '#94A3B8'], ['Same photo', c('kept.same'), 'var(--ok)'], ['Maybe', c('kept.maybe'), '#0EA5E9'], ['New copies', c('copies.new'), 'var(--copy)']])}</div>
    <div class="st-grid3">
      <div><small class="muted">Photos searched</small><b class="num">${stN(c('photos'))}</b><small class="faint">${stN(c('photos.withLinks'))} with any link · ${stN(c('photos.withNew'))} with a new copy</small></div>
      <div><small class="muted">You answered</small><b class="num">${stN(c('ans.stolen') + c('ans.licensed') + c('ans.removed'))}</b><small class="faint">Stolen ${stN(c('ans.stolen'))} · Licensed ${stN(c('ans.licensed'))} · Removed ${stN(c('ans.removed'))}</small></div>
      <div><small class="muted">Changed later</small><b class="num">${stN(c('ans.changed') + c('ans.putBack') + c('ans.putBack.checker') + c('ans.putBack.postcheck'))}</b><small class="faint">Put back ${stN(c('ans.putBack') + c('ans.putBack.checker') + c('ans.putBack.postcheck'))} · "It is a copy" ${stN(c('ans.rescued'))}</small></div>
    </div>
    ${stSpark(per) ? `<div>${stSpark(per)}<small class="faint">New copies a day, last 30 days</small></div>` : ''}`);
}
function stSpeed(m) {
  const D = m.D, u = k => SR().usual(D, k), x = k => (SR().t(D, k) || {}).x, n = k => (SR().t(D, k) || {}).n || 0;
  const rows = [['Open the photo from Google Drive', 'drive.openPhoto'], ...SR().ENG.map(e => [SR().ENGN[e] + ' answers', 'eng.' + e + '.ms']), ['Download a found picture', 'dl'], ['Check a found picture', 'chk.all'], ['<b>Whole photo, Keep searching</b>', 'photo.one'], ['<b>Whole photo, big searches</b>', 'photo.big']]
    .filter(([, k]) => n(k)).map(([l, k]) => [l, stMs(u(k)), stMs(x(k)), stN(n(k))]);
  return stCard('How fast links are found', '"Usual" is the middle time: half took longer, half less. Start to done covers every search site and every check for that photo.', rows.length ? stTable(['Step', 'Usual', 'Slowest', 'Times'], rows) : '<p class="faint" style="margin:0">Fills in after the next search.</p>');
}
function stChecker(m) {
  const D = m.D, u = k => SR().usual(D, k), c = k => SR().c(D, k);
  const cp = m.copies || { same: {}, maybe: {} };
  const col = { stolen: 'var(--ok)', licensed: '#0EA5E9', removedByYou: 'var(--bad)', removedByPageProof: '#94A3B8', new: 'var(--line)' };
  const lab = { stolen: 'You said Stolen', licensed: 'Licensed', removedByYou: 'You removed it', removedByPageProof: 'PageProof removed it', new: 'Not answered yet' };
  const parts = o => Object.keys(lab).map(k => [lab[k], o[k] || 0, col[k]]);
  return stCard('How fast the checker works, and did it get it right?', 'Check times split by the answer. Below: every copy so far, by what the checker said and what you answered. Removing a "Same photo" means the checker was wrong.',
    `<div class="st-grid3">
      <div><small class="muted">Different photo</small><b class="num">${stMs(u('chk.no'))}</b></div>
      <div><small class="muted">Real copy (Same or Maybe)</small><b class="num">${stMs(u('chk.same') ?? u('chk.maybe'))}</b></div>
      <div><small class="muted">Waiting for a free checker</small><b class="num">${stMs(u('chk.wait'))}</b></div>
    </div>
    <div class="st-legend"><span><i style="background:var(--${m.fast === false ? 'warn' : 'ok'})"></i>Fast checker ${m.fast == null ? 'not used yet' : m.fast ? 'on' : 'off'}</span><span><i style="background:var(--${m.gpu ? 'ok' : 'faint'})"></i>Graphics card ${m.gpu == null ? 'not used yet' : m.gpu ? 'in use' : 'not available'}</span><span><i style="background:var(--faint)"></i>${m.checks || '?'} checks at once</span><span><i style="background:var(--${c('chk.stuck') ? 'warn' : 'faint'})"></i>${stN(c('chk.stuck'))} could not be checked (over 30 s)</span></div>
    <div><h3 class="st-h3">Said Same photo</h3>${stStack(parts(cp.same))}</div>
    <div><h3 class="st-h3">Said Maybe</h3>${stStack(parts(cp.maybe))}</div>
    <p class="faint" style="margin:0;font-size:12.5px">Copies you added by hand with "It is a copy" (the checker missed them): ${stN(cp.rescued || 0)} so far, ${stN(c('ans.rescued'))} in this time.</p>
    ${stByKind(cp.byKind)}
    ${c('chk.second.kept') + c('chk.second.maybe') + c('chk.second.out') + c('chk.second.saved') ? `<p class="faint" style="margin:0;font-size:12.5px">Second look at full size: ${stN(c('chk.second.kept'))} close Same calls kept, ${stN(c('chk.second.maybe'))} made Maybe, ${stN(c('chk.second.out'))} thrown out · ${stN(c('chk.second.saved'))} of Google's exact matches saved, ${stN(c('chk.second.page'))} found on their page, ${stN(c('chk.second.exactNo'))} still different.</p>` : ''}${c('chk.cover') ? `<p class="faint" style="margin:0;font-size:12.5px">Posts kept for a look at every picture (their cover was another photo): ${stN(c('chk.cover'))}.</p>` : ''}`);
}
// 4.47 (Ben's pick): where the checker goes wrong. The checker's answers next to yours for the
// last 30 days, by kind of site (going by the site's address), so the fix that helps most shows.
function stByKind(bk) {
  if (!bk || !Object.keys(bk).length) return '';
  const pc = (a, n) => n ? Math.round(a / n * 100) + '%' : '–';
  const rows = Object.entries(bk).sort((a, b) => (b[1].sameN + b[1].maybeN) - (a[1].sameN + a[1].maybeN));
  const worst = rows.filter(([, v]) => v.sameN >= 5).sort((a, b) => a[1].sameOk / a[1].sameN - b[1].sameOk / b[1].sameN)[0];
  return `<div><h3 class="st-h3">Where the checker goes wrong (answered in the last 30 days)</h3>${stTable(['Kind of site', 'Same photo answered', 'Same right', 'Maybe answered', 'Maybe right', 'Missed (added by hand)'],
    rows.map(([k, v]) => [esc((typeof PP_CTESTS !== 'undefined' && PP_CTESTS.KIND_NAME[k]) || k), stN(v.sameN), `<span${v.sameN >= 5 && v.sameOk / v.sameN < 0.75 ? ' style="color:var(--bad);font-weight:700"' : ''}>${pc(v.sameOk, v.sameN)}</span>`, stN(v.maybeN), pc(v.maybeOk, v.maybeN), stN(v.missed)]))}
    ${worst && worst[1].sameOk / worst[1].sameN < 0.85 ? `<p class="faint" style="margin:6px 0 0;font-size:12.5px">Most room to improve: <b>${esc(PP_CTESTS.KIND_NAME[worst[0]] || worst[0])}</b>, where ${pc(worst[1].sameN - worst[1].sameOk, worst[1].sameN)} of the Same photo answers were removed.</p>` : ''}</div>`;
}
function stEngines(m) {
  const D = m.D, c = k => SR().c(D, k), rows = [], rows2 = [];
  for (const e of SR().ENG) {
    const k = 'eng.' + e + '.', n = c(k + 'n');
    if (!n && !c(k + 'robot')) continue;
    const st = c(k + 'n') >= 5 && c(k + 'links') === 0 ? '<span class="tag bad">No results</span>' : c(k + 'restMin') ? '<span class="tag warn">Rested</span>' : '<span class="tag ok">Fine</span>';
    rows.push([SR().ENGN[e], stN(n), n ? Math.round(c(k + 'links') / n) : 0, (SR().pct(c(k + 'empty'), n) ?? 0) + '%', stN(c(k + 'noAnswer')), stN(c(k + 'robot')), (Math.round(c(k + 'restMin') / 6) / 10) + ' h', st]);
    const v = x => c('engv.' + e + '.' + x), tot = ['same', 'maybe', ...SR().DROP.map(d => d[0])].reduce((a, x) => a + v(x), 0);
    if (tot) rows2.push([SR().ENGN[e], stN(tot), stN(v('same')), stN(v('maybe')), stN(v('different') + v('logos')), `<span${v('cant') / tot >= 0.5 ? ' style="color:var(--bad);font-weight:700"' : ''}>${stN(v('cant'))} (${SR().pct(v('cant'), tot)}%)</span>`, stN(v('cantOnly'))]);
  }
  return stCard('Each search site', 'How each site answered, and what its links turned out to be. A link two sites found counts for both.',
    rows.length ? stTable(['Site', 'Searches', 'Links each', 'Empty', 'No answer', 'Robot checks', 'Resting', ''], rows) + (rows2.length ? `<h3 class="st-h3">What their links turned out to be</h3>` + stTable(['Site', 'Links', 'Same', 'Maybe', 'Different', 'Could not check', 'Only this site'], rows2) + '<p class="faint" style="margin:0;font-size:12.5px">"Could not check" means the picture was blocked or could not be read, so the link was thrown out.</p>' : '') : '<p class="faint" style="margin:0">Fills in after the next search.</p>');
}
function stDrops(m) {
  const D = m.D, c = k => SR().c(D, k), cp = m.copies || {};
  const rows = SR().DROP.map(([k, l]) => [l, c('drop.' + k)]).filter(r => r[1]).sort((a, b) => b[1] - a[1]);
  return stCard('Links thrown out, and why', 'Every link a search found that did not become a copy. Each rule has its own line.',
    (rows.length ? stBars(rows, '#0EA5E9') : '<p class="faint" style="margin:0">Nothing thrown out yet.</p>') +
    `<p class="faint" style="margin:0;font-size:12.5px">On your approved sites (kept, as Licensed): ${stN(c('drop.approved'))}. Hidden on Copies found right now until you show them: spam blogs ${stN(cp.spamNew || 0)}, reposts and shares ${stN(cp.repostNew || 0)}.</p>`);
}
function stSites(m) {
  const s = Object.entries(m.D.s || {}).sort((a, b) => (b[1].f + b[1].s + b[1].b) - (a[1].f + a[1].s + a[1].b)).slice(0, 15);
  return stCard('Problems by website', 'Websites whose pictures or pages could not be downloaded. The top 15, by plain website name only.',
    s.length ? stTable(['Website', 'Failed', 'Too slow', 'Blocked us'], s.map(([n, v]) => [esc(n), stN(v.f), stN(v.s), stN(v.b)])) : '<p class="faint" style="margin:0">No problems so far.</p>');
}
function stHelpers(m) {
  const D = m.D, c = k => SR().c(D, k);
  const rows = [['page', 'Their page check (is it in the article?)'], ['own', 'No picture from the search site: read their page'], ['exact', 'Google said exact: read their page'], ['post', 'Post check (is it in the post?)'], ['acct', 'Account reader'], ['repost', 'Repost check'], ['owner', 'Who\'s behind this site']]
    .filter(([k]) => c('job.' + k + '.n')).map(([k, l]) => [l, stN(c('job.' + k + '.n')), stMs(SR().usual(D, 'job.' + k)), stN(c('job.' + k + '.fail'))]);
  const lim = Object.entries(D.c).filter(([k]) => k.startsWith('limit.'));
  return stCard('Post check, account reader and site limits', 'The helpers that open pages in the background, with a speed limit per site.',
    (rows.length ? stTable(['Helper', 'Done', 'Usual time', 'Failed'], rows) : '<p class="faint" style="margin:0">None of them has run yet.</p>') +
    (lim.length ? `<p class="faint" style="margin:0;font-size:12.5px">Site limits: ${lim.map(([k, n]) => esc(k.startsWith('limit.rest.') ? k.slice(11) + ' rested 6 hours' : k === 'limit.held.limit' ? 'waited for a site\'s limit' : 'waited for a resting site') + ' ' + stN(n) + '×').join(' · ')}</p>` : ''));
}
// Extra searches (sweeps, Credit search, Watching): what they did, what they found, time spent.
function stExtra(m) {
  if (typeof ntExtraRows !== 'function') return '';
  const rows = ntExtraRows(m.D);
  return stCard('Extra searches: are they worth it?', 'Sweeps, Credit search and Watching run between photo searches. Time spent is the time they kept Keep searching busy.',
    stTable(['Search', 'What it did', 'Copies found', 'Time spent', 'Time per copy'], rows.map(r => [r.name, r.work, stN(r.found), r.mins.toLocaleString() + ' min', r.worth])));
}
function stKeep(m) {
  const K = SR().KEEP, km = SR().keepMinutes(m.D);
  const cls = s => (K[s] || [0, 'off'])[1];
  const colour = { work: 'var(--ok)', stop: 'var(--bad)', off: 'var(--line)' };
  let strip = '';
  if (m.range === 'today') {
    const hrs = Array.from({ length: 10 }, (_, i) => i + 8);
    strip = `<div class="st-hours">${hrs.map(h => { const s = km.hours[h] || {}; const top = Object.entries(s).sort((a, b) => b[1] - a[1])[0]; const fifty = top && top[0] === 'fifty'; return `<i title="${h}:00 – ${esc(top ? K[top[0]] ? K[top[0]][0] : top[0] : 'PageProof was not running')}" style="background:${top ? fifty ? 'var(--warn)' : colour[cls(top[0])] : 'var(--sunk)'}"></i>`; }).join('')}</div><div class="st-legend" style="justify-content:space-between"><span>8 AM</span><span>6 PM</span></div>`;
  }
  const rows = Object.entries(km.by).sort((a, b) => b[1] - a[1]).map(([s, n]) => [esc(K[s] ? K[s][0] : s), (n / 60).toFixed(1) + ' h']);
  const pauses = Object.entries(m.D.c).filter(([k]) => k.startsWith('keep.pause.'));
  return stCard('Keep searching: on time and pauses', 'What Keep searching was doing, minute by minute, while its pinned tab was open.',
    strip + stStack([['Working', km.work, 'var(--ok)'], ['Stopped', km.stop, 'var(--bad)'], ['Off or outside your hours', km.off, 'var(--line)']]) +
    (rows.length ? stTable(['What it was doing', 'Hours'], rows) : '') +
    (pauses.length ? `<p class="faint" style="margin:0;font-size:12.5px">Times it stopped: ${pauses.map(([k, n]) => esc((K[k.slice(11)] || [k.slice(11)])[0].toLowerCase()) + ' ' + n + '×').join(' · ')}</p>` : ''));
}
function stDrive(m) {
  const D = m.D, rows = [['readNewFolders', 'Hourly check for new photos'], ['readEveryFolder', 'Weekly check of every folder'], ['openPhoto', 'Open one photo'], ['driveAnswer', 'Drive answers'], ['searchLine', 'Work out the next photo']]
    .map(([k, l]) => [l, SR().t(D, 'drive.' + k)]).filter(r => r[1]).map(([l, x]) => [l, stMs(PP_STATS.usual(x)), stMs(x.x), stN(x.n)]);
  const off = (SR().keepMinutes(D).by.offline || 0), failed = SR().c(D, 'drive.openFailed');
  return stCard('Google Drive speed', 'Drive for desktop can be slow on big folders. This shows if a slow day was Drive.',
    (rows.length ? stTable(['Drive job', 'Usual', 'Slowest', 'Times'], rows) : '<p class="faint" style="margin:0">Fills in after the next Drive check.</p>') +
    `<p class="faint" style="margin:0;font-size:12.5px">Offline ${(off / 60).toFixed(1)} hours · photos Drive did not hand over: ${stN(failed)}</p>`);
}
function stCover(m) {
  const cv = m.cover; if (!cv) return stCard('Photos covered', '', '<p class="faint" style="margin:0">Connect your photos first.</p>');
  const f = cv.first, g = cv.groups;
  const wd = m.keys.filter(k => ![0, 6].includes(new Date(k + 'T12:00').getDay())).length || 1;
  const perDay = SR().c(m.D, 'photos') / wd;
  const months = perDay >= 1 && f.never ? Math.max(1, Math.round(f.never / perDay / 21)) : null;
  return stCard('Photos covered', 'How far searching has got through your photos. Counts only.',
    stStack([['Searched at least once', f.done, 'var(--ok)'], ['Never searched', f.never, '#93C5FD'], ['Cannot be searched', f.cant, 'var(--line)']]) +
    stTable(['Photos', 'Up to date', 'Of'], [['Priority (searched in the last week)', stN(g.top[0]), stN(g.top[1])], ['Last 3 months (last month)', stN(g.recent[0]), stN(g.recent[1])], ['This year (last 6 months)', stN(g.year[0]), stN(g.year[1])], ['Older (last year)', stN(g.older[0]), stN(g.older[1])]]) +
    `<p class="faint" style="margin:0;font-size:12.5px">${months ? `At ${Math.round(perDay)} photos a weekday, every photo is searched once in about ${months} month${months === 1 ? '' : 's'}.` : 'Search more photos to see how long it takes to get through them all.'} ${stN(f.week)} photos had their first search this week.</p>`);
}
function stStrain(m) {
  const D = m.D, c = k => SR().c(D, k), hw = m.hw || {}, km = SR().keepMinutes(D);
  return stCard('Computer strain', 'Whether PageProof is too heavy for this computer.',
    `<div class="st-legend"><span class="tag">${esc(hw.level || '?')} computer · ${hw.cores || '?'} cores · ${hw.memGB || '?'} GB</span><span class="tag">Highest page memory ${(D.x || {})['mem.page'] ? stN(D.x['mem.page']) + ' MB' : 'not known'}</span></div>` +
    stBars([['Search slowed down, busy', c('strain.eased.busy'), 'var(--warn)'], ['Search slowed down, memory', c('strain.eased.memory'), 'var(--warn)'], ['Search slowed down, battery', c('strain.eased.battery'), 'var(--warn)'], ['Keep searching waited (minutes)', km.by.busy || 0, 'var(--warn)'], ['Search page restarted', c('strain.resumed'), 'var(--bad)']]));
}
async function stSaveCard(m) {
  const docs = await RS_DOCS.state().catch(() => 'none'), st = await PP_STATS.all(), w = st.weekly;
  const off = !!st.weeklyOff;
  return stCard('Save stats for Claude', 'One file: a plain summary on top, the full numbers below. Drag it into the chat with Claude. Never in it: client names, photo names, folder paths, links, your name.',
    `<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary" data-act="stsave">${ic('down', 18)} Save stats for Claude</button><button class="btn" data-act="stcopy">${ic('doc', 18)} Copy to clipboard</button></div>
    ${state.stSaved ? `<p class="muted" style="margin:0;font-size:13.5px">${esc(state.stSaved)}</p>` : ''}
    <label class="row" style="gap:10px;flex-wrap:nowrap;align-items:flex-start;cursor:pointer"><input type="checkbox" data-act="stweekly"${off ? '' : ' checked'} style="width:18px;height:18px;margin-top:2px"><span><b>Save a weekly stats file by itself</b><br><span class="muted" style="font-size:13.5px">Every Friday at 5:30 PM (or the next time PageProof runs that weekend), into Documents › PageProof › stats. ${docs === 'granted' ? (w ? 'Last one: ' + esc(w.name) + ', ' + esc(new Date(w.at).toLocaleString()) + '.' : 'None saved yet.') : 'Needs the PageProof folder: <a href="#settings">set it up in Settings</a>.'}</span></span></label>`);
}

// ---------------------------------------------------------------- the page
// 4.58: website copies by how popular their site is (Tranco list). Counts only.
async function stPop() {
  if (typeof PP_POP === 'undefined' || !(await PP_POP.info()).date) return '';
  const cs = (await FC.allCopies()).filter(c => c.status !== 'removed' && FC.useOf(c) !== 'social');
  const R = await PP_POP.ranks(cs.map(c => c.site)).catch(() => new Map());
  const rows = [['Top 1K', 4], ['Top 10K', 3], ['Top 100K', 2], ['Top 1M', 1], ['Small sites', 0], ['Shared platforms (blogs, shops)', -1]].map(([l, lv]) => {
    const xs = cs.filter(c => PP_POP.level(R.has(c.site) ? R.get(c.site) : null) === lv);
    return [l, xs.length, lv >= 3 ? 'var(--warn)' : lv === -1 ? '#94A3B8' : 'var(--accent)', xs.filter(c => c.status === 'stolen').length + ' marked stolen'];
  });
  let bad = 0;
  if (typeof PP_BAD !== 'undefined') { await PP_BAD.prepare(cs.map(c => c.site)).catch(() => {}); bad = cs.filter(c => PP_BAD.of(c.site, R.get(c.site))).length; }
  return stCard('Copies by site popularity', 'Website copies (not removed), by how visited the site is. Hover a bar for how many you marked stolen.', stBars(rows) + (typeof PP_BAD !== 'undefined' ? `<p class="faint" style="margin:0;font-size:13px">${stN(bad)} on a known bad site list (piracy, scam, phishing, malware).</p>` : ''));
}
V.stats = async () => {
  const fresh = state.stModel && state.stModel.range === state.stRange && Date.now() - state.stModel.at < 30000;
  const m = fresh ? state.stModel : Object.assign(await PP_REPORT.model(state.stRange), { at: Date.now() });
  state.stModel = m;
  const D = m.D, P = m.P, c = (X, k) => SR().c(X, k), u = (X, k) => SR().usual(X, k);
  const range = `<div class="tabs st-range" role="tablist">${[['today', 'Today'], ['7', '7 days'], ['30', '30 days']].map(([v, l]) => `<button role="tab" class="${state.stRange === v ? 'on' : ''}" aria-selected="${state.stRange === v}" data-act="strange" data-v="${v}">${l}</button>`).join('')}</div>`;
  const al = m.alerts;
  const empty = !Object.keys(m.days).length;
  return `${head('Settings', 'How PageProof is doing', 'What PageProof did on this computer, day by day: what it found, how fast, and what went wrong. Numbers only, never names.', `${range}<button class="btn primary" data-act="stsave">${ic('down', 18)} Save stats for Claude</button>`)}
  ${al.length ? `<section class="card st-alerts">${al.map(([lvl, a, b]) => `<div class="st-alert ${lvl}"><b>!</b><div><b>${esc(a)}.</b> <span class="muted">${esc(b)}</span></div></div>`).join('')}</section>`
    : `<div class="banner info" style="font-size:15px"><b>Nothing looks off</b><span class="muted">${empty ? 'Stats start now. They fill in as PageProof searches.' : 'PageProof compares each day with this computer\'s usual numbers.'}</span></div>`}
  <div class="st-tiles">
    <div class="card st-tile"><small class="muted">Photos searched</small><b class="num">${stN(c(D, 'photos'))}</b>${stTrend(c(D, 'photos'), c(P, 'photos'))}</div>
    <div class="card st-tile"><small class="muted">New copies</small><b class="num">${stN(c(D, 'copies.new'))}</b>${stTrend(c(D, 'copies.new'), c(P, 'copies.new'))}</div>
    <div class="card st-tile"><small class="muted">Time to search one photo</small><b class="num">${stMs(u(D, 'photo.one') ?? u(D, 'photo.big'))}</b>${stTrend(u(D, 'photo.one') ?? u(D, 'photo.big'), u(P, 'photo.one') ?? u(P, 'photo.big'), true)}</div>
    <div class="card st-tile"><small class="muted">One photo check</small><b class="num">${stMs(u(D, 'chk.all'))}</b>${stTrend(u(D, 'chk.all'), u(P, 'chk.all'), true)}</div>
  </div>
  ${stTestCard(m)}
  <div class="st-two">${stFound(m)}${stSpeed(m)}</div>
  ${stChecker(m)}
  ${stEngines(m)}
  <div class="st-two">${stDrops(m)}${stSites(m)}</div>
  <div class="st-two">${stKeep(m)}${stDrive(m)}</div>
  <div class="st-two">${stCover(m)}${stStrain(m)}</div>
  ${await stPop()}
  ${stHelpers(m)}
  ${stExtra(m)}
  ${await stSaveCard(m)}`;
};

async function stFile() {
  const m = await PP_REPORT.model(state.stRange === 'today' ? 'today' : state.stRange);
  return PP_REPORT.text(m);
}
Object.assign(ACTS, {
  strange: v => { state.stRange = v; state.stModel = null; render(true); },
  stsave: async () => {
    toast('Making the stats file…');
    const body = await stFile(), name = PP_REPORT.fileName('now');
    const saved = await PP_REPORT.saveToDocs(name, body);
    if (saved) { state.stSaved = 'Saved as Documents › PageProof › stats › ' + saved + '. Drag that file into the chat with Claude.'; toast('Saved in Documents › PageProof › stats.'); }
    else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: 'text/plain' })); a.download = name; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      state.stSaved = 'Saved to your Downloads folder as ' + name + '. Drag that file into the chat with Claude.'; toast('Saved to Downloads.');
    }
    render(true);
  },
  stcopy: async () => {
    const body = await stFile();
    try { await navigator.clipboard.writeText(body); toast('Copied. Paste it into the chat with Claude.'); } catch (e) { toast('Could not copy. Use Save stats for Claude instead.'); }
  },
  stweekly: async (v, el) => { await PP_STATS.setMeta('weeklyOff', !el.checked); toast(el.checked ? 'A weekly stats file is saved every Friday.' : 'No weekly stats file.'); },
  sttest: async () => {
    if (state.stTest && state.stTest.running) return;
    state.stTest = { running: true, done: 0, total: PP_SELFTEST.cases().length };
    render(true);
    let last = 0;
    try {
      const r = await PP_SELFTEST.run((done, total) => {
        Object.assign(state.stTest, { done, total });
        if (Date.now() - last > 400) { last = Date.now(); const b = document.getElementById('stTestBar'); if (b) b.innerHTML = `<span class="spin"></span>Checking test picture ${done} of ${total}…`; }
      });
      await PP_STATS.setMeta('test', r);
      PP_STATS.add('test.runs');
      // 4.47: then your own real pairs, if there are any.
      let rr = null;
      if (typeof PP_CTESTS !== 'undefined' && await PP_CTESTS.count()) {
        rr = await PP_CTESTS.run((done, total) => {
          Object.assign(state.stTest, { done: r.n + done, total: r.n + total });
          if (Date.now() - last > 400) { last = Date.now(); const b = document.getElementById('stTestBar'); if (b) b.innerHTML = `<span class="spin"></span>Checking your real pair ${done} of ${total}…`; }
        });
        if (rr.n) await PP_STATS.setMeta('realtest', rr);
      }
      toast('Checker test: ' + r.right + ' of ' + r.n + ' right' + (rr && rr.n ? '. Your real pairs: ' + rr.right + ' of ' + rr.n + ' right.' : '.'));
    } catch (e) { toast('The checker test could not run: ' + (e && e.message || e)); }
    state.stTest = null; state.stModel = null;
    if (state.shown === 'stats') render(true);
  },
});
