// Settings › Health › Stats: what PageProof did on this computer, day by day (pp-stats.js
// records it, pp-report.js works it out), the Checker test (pp-selftest.js), and "Save stats for
// Claude", one file with the numbers to send for help. Numbers only, never names or links.
Object.assign(state, { stRange: '7', stModel: null, stTest: null });
const SR = () => PP_REPORT;
const stMs = v => PP_REPORT.ms(v);
const stN = v => PP_REPORT.num(v);

// ---------------------------------------------------------------- small drawings (calm look, step 18 part 4)
// One colour set for every chart (ui/calm.css .ss): blue, teal, green, amber, red, purple, grey.
const SS_IC = {
  photo: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 8"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  check: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.7 2.7L16.2 9.5"/>',
  warn: '<path d="M12 3.5L2.8 19.5h18.4z"/><path d="M12 10v4.2M12 16.8v.2"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.2M12 7.8v.2"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
  funnel: '<path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"/>',
  bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.6 2.6 14.4 0 17M12 3.5c-2.6 2.6-2.6 14.4 0 17"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  drive: '<path d="M8.5 4h7l5 9-3.5 6H7l-3.5-6z"/><path d="M8.5 4L12 10.5M20.5 13H12"/>',
  pc: '<rect x="3" y="4.5" width="18" height="12" rx="1.6"/><path d="M9 20h6M12 16.5V20"/>',
  stack: '<path d="M12 4l8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4M4 16l8 4 8-4"/>',
  help: '<path d="M6 4h9l3 3v13H6z"/><path d="M9 10h6M9 13.5h6M9 17h4"/>',
  down: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
  play: '<path d="M8 5.5v13l10-6.5z"/>',
  chev: '<path d="M9.5 6l6 6-6 6"/>',
  star: '<path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.8 6.9 19.5l1-5.7-4.1-4 5.7-.8z"/>',
};
const ssIco = (k, s = 20) => `<svg class="ss-i" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SS_IC[k]}</svg>`;
const ssPc = (a, b) => b ? Math.round(a / b * 100) : 0;
const ssRangeWord = () => state.stRange === 'today' ? 'today' : state.stRange === '30' ? 'in the last 30 days' : 'this week';
const ssWhat = t => `<details class="ss-what"><summary>${ssIco('info', 15)} What is this?</summary><p>${t}</p></details>`;
const ssEmpty = t => `<p class="ss-none">${t}</p>`;
function ssCard(id, icon, title, sub, body, { right = '', why = '', wide = false } = {}) {
  return `<section class="ss-card${wide ? ' ss-wide' : ''}" id="${id}"><header class="ss-ch"><span class="ss-ci">${ssIco(icon)}</span><div class="ss-ct"><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ''}</div>${right ? `<div class="ss-cr">${right}</div>` : ''}</header>${why ? ssWhat(why) : ''}<div class="ss-cb">${body}</div></section>`;
}
const ssGroup = (id, title, inner) => inner.trim() ? `<div class="ss-group" id="ssg-${id}"><h2 class="ss-gh">${title}</h2><div class="ss-grid">${inner}</div></div>` : '';
function ssTrend(now, before, lowerBetter) {
  const span = state.stRange === 'today' ? 'the day before' : 'the ' + state.stRange + ' days before';
  if (!before || now == null) return '<span class="ss-tr same">Nothing to compare with yet</span>';
  const d = Math.round((now / before - 1) * 100);
  if (Math.abs(d) < 3) return `<span class="ss-tr same">About the same as ${span}</span>`;
  const good = lowerBetter ? d < 0 : d > 0;
  return `<span class="ss-tr ${good ? 'good' : 'bad'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d)}%<small> on ${span}</small></span>`;
}
function ssSpark(vals, cls, label) {
  if (vals.filter(v => v != null).length < 2 || !vals.some(v => v)) return '<span class="ss-spark"></span>';
  const W = 220, H = 40, mx = Math.max(1, ...vals.map(v => v || 0)), x = i => 2 + i / (vals.length - 1) * (W - 4), y = v => H - 3 - (v || 0) / mx * (H - 8);
  const l = vals.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  return `<svg class="ss-spark ${cls || ''}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(label)}, a day, last 2 weeks"><path class="a" d="${l} L${x(vals.length - 1)} ${H} L2 ${H}Z"/><path class="l" d="${l}"/><circle cx="${x(vals.length - 1)}" cy="${y(vals[vals.length - 1])}" r="3"/></svg>`;
}
function ssRing(a, b, size = 128, cls = 'ok', label) {
  const r = size / 2 - 9, C = 2 * Math.PI * r, f = b ? Math.min(1, a / b) : 0;
  return `<div class="ss-ring ${cls}" style="width:${size}px;height:${size}px" role="img" aria-label="${a} of ${b}"><svg viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="bg"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="fg" stroke-dasharray="${(C * f).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg><div><b>${label || (a + '<small>/' + b + '</small>')}</b></div></div>`;
}
function ssSplit(parts, h = 14) {
  if (!parts.some(p => p[1])) return '';
  return `<div class="ss-split" style="height:${h}px" role="img" aria-label="${esc(parts.map(p => p[0] + ' ' + p[1]).join(', '))}">${parts.map(([l, n, cl]) => n ? `<i class="${cl}" style="flex:${n} 0 0" title="${esc(l)} ${stN(n)}"></i>` : '').join('')}</div>`;
}
function ssLegend(parts) {
  const tot = parts.reduce((s, p) => s + p[1], 0);
  return `<div class="ss-leg">${parts.map(([l, n, cl]) => `<span><i class="${cl}"></i>${esc(l)} <b>${ssPc(n, tot)}%</b> <em>${stN(n)}</em></span>`).join('')}</div>`;
}
const ssPill = (cls, t) => `<span class="ss-pill ${cls}"><i></i>${t}</span>`;
const ssHbar = (l, n, mx, cls, val, why) => `<div class="ss-hb"${why ? ` title="${esc(why)}"` : ''}><span>${esc(l)}</span><span class="ss-hbt"><i class="${cls || ''}" style="width:${n ? Math.max(1.5, n / mx * 100) : 0}%"></i></span><b>${val || stN(n)}</b></div>`;
const ssHbars = (rows, cls) => { const mx = Math.max(1, ...rows.map(r => r[1])); return `<div class="ss-hbs">${rows.map(r => ssHbar(r[0], r[1], mx, r[2] || cls, null, r[3])).join('')}</div>`; };
const ssMini = cells => `<div class="ss-mini3">${cells.map(([l, v, s]) => `<div><small>${l}</small><b>${v}</b>${s ? `<em>${s}</em>` : ''}</div>`).join('')}</div>`;
// A list that shows its first rows and folds the rest away.
function ssMore(rows, n, word) {
  if (rows.length <= n) return `<div class="ss-list">${rows.join('')}</div>`;
  return `<div class="ss-list">${rows.slice(0, n).join('')}</div><details class="ss-fold"><summary class="ss-more">${ssIco('chev', 14)} Show all ${rows.length} ${word}</summary><div class="ss-list">${rows.slice(n).join('')}</div></details>`;
}

// ---------------------------------------------------------------- the sections
function stTestCard(m) {
  const T = state.stTest, last = m.test, R = m.realtest, run = T && T.running;
  const runBtn = run ? `<button class="btn kbtn" disabled data-why="The test is running.">Testing…</button>` : `<button class="btn kbtn${last ? '' : ' primary'}" data-act="sttest">${ssIco('play', 16)}${last ? 'Run the test again' : 'Run the checker test'}</button>`;
  let body;
  if (run) body = `<div class="scanbar" id="stTestBar"><span class="spin"></span>Checking test picture ${T.done || 0} of ${T.total || 72}…</div>`;
  else if (last) {
    const chips = Object.values(last.groups).map(g => `<span class="ss-chip ${g.right === g.n ? 'ok' : 'warn'}"${g.right < g.n ? ` title="Same ${g.same}, Maybe ${g.maybe}, Different ${g.no}, could not check ${g.cant}"` : ''}>${g.right === g.n ? '✓' : '!'} ${esc(g.label)} <b>${g.right}/${g.n}</b></span>`).join('');
    body = `<div class="ss-test">${ssRing(last.right, last.n, 128, last.right === last.n ? 'ok' : last.right / last.n >= 0.9 ? 'warn' : 'bad')}<div><b class="ss-big">${last.right === last.n ? 'Every test picture came out right' : last.right + ' of ' + last.n + ' right'}</b><div class="ss-chips">${chips}</div><p class="ss-cap">On the computer it was made on it gets all ${last.n} right.</p></div></div>`;
  } else body = ssEmpty('Not run on this computer yet. It takes about a minute and you can keep working.');
  // 4.47: your own real pairs (Documents\PageProof\checker-tests), kept from your answers.
  if (!run) body += R && R.n ? `<div class="ss-sv" id="ssReal"><div class="ss-svh"><b>Your real pairs</b>${ssPill(R.right / R.n >= 0.9 ? 'ok' : R.right / R.n >= 0.75 ? 'warn' : 'bad', R.right + ' of ' + R.n + ' right')}</div>${ssHbars([['Right', R.right, 'green'], ['Kept, but you removed it', R.wrongKept, 'red'], ['Missed, but you said it is a copy', R.missed, 'amber']])}
      ${Object.keys(R.byKind || {}).length ? `<p class="ss-cap">${Object.entries(R.byKind).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => esc(PP_CTESTS.KIND_NAME[k] || k) + ' ' + v.right + ' of ' + v.n).join(' · ')}</p>` : ''}</div>`
    : `<p class="ss-cap">${m.realPairs ? stN(m.realPairs) + ' real pairs kept so far. They are checked the next time you run the test.' : 'Your real pairs: none yet. Each time you remove a copy the checker called Same photo, or press "It is a copy" on one it threw out, a small pair is kept in Documents\\PageProof\\checker-tests (this computer only) and checked here.'}</p>`;
  return ssCard('ssTest', 'check', 'Checker test', last && !run ? `Last run ${esc(new Date(last.at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))} · ${stMs(last.ms)} each · fast checker ${last.fast ? 'on' : 'off'} · graphics card ${last.gpu ? 'used' : 'not used'}` : 'Checks the photo checker itself with made-up pictures.', body,
    { right: runBtn, why: 'PageProof draws made-up test pictures, makes copies of them (smaller, cropped, a headline over them, mirrored, tilted) and checks each one with the same photo checker a real search uses. Different pictures must come out Different.' });
}
function stFound(m) {
  const D = m.D, c = k => SR().c(D, k);
  const dropped = SR().DROP.reduce((a, [k]) => a + c('drop.' + k), 0);
  const links = c('links'), same = c('kept.same'), maybe = c('kept.maybe'), nw = c('copies.new');
  const step = (l, n, sub, cls) => `<div class="ss-step ${cls}"><small>${l}</small><b>${stN(n)}</b><em>${sub}</em></div>`, arr = `<span class="ss-arr">${ssIco('chev', 18)}</span>`;
  const days = SR().lastDays(14), cols = days.map(k => [k, SR().c(m.days[k], 'copies.new')]), cmax = Math.max(1, ...cols.map(x => x[1]));
  const wd = k => ['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(k + 'T12:00').getDay()];
  const put = c('ans.putBack') + c('ans.putBack.checker') + c('ans.putBack.postcheck');
  return ssCard('ssFound', 'funnel', 'From search to copy', `What the searches found ${ssRangeWord()}, and how much of it became a copy for you to answer.`,
    `<div class="ss-steps">${step('Links found', links, c('photos') ? Math.round(links / c('photos')) + ' a photo' : 'no photos searched yet', 'blue')}${arr}${step('Thrown out', dropped, ssPc(dropped, links) + '% of links', 'grey')}${arr}${step('Same or Maybe', same + maybe, stN(same) + ' Same · ' + stN(maybe) + ' Maybe', 'green')}${arr}${step('New copies', nw, 'for you to answer', 'copy')}</div>
    ${ssMini([['Photos searched', stN(c('photos')), stN(c('photos.withLinks')) + ' with any link · ' + stN(c('photos.withNew')) + ' with a new copy'], ['You answered', stN(c('ans.stolen') + c('ans.licensed') + c('ans.removed')), 'Stolen ' + stN(c('ans.stolen')) + ' · Licensed ' + stN(c('ans.licensed')) + ' · Removed ' + stN(c('ans.removed'))], ['Changed later', stN(c('ans.changed') + put), 'Put back ' + stN(put) + ' · "It is a copy" ' + stN(c('ans.rescued'))]])}
    ${cols.some(x => x[1]) ? `<div class="ss-cols" role="img" aria-label="New copies a day, last 2 weeks">${cols.map(([k, n], i) => `<div class="ss-col${i === cols.length - 1 ? ' now' : ''}" title="${esc(new Date(k + 'T12:00').toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }))}: ${n}"><em>${n || ''}</em><i style="height:${n ? Math.max(4, n / cmax * 100) : 0}%"></i><small>${wd(k)}</small></div>`).join('')}</div><p class="ss-cap">New copies a day, last 2 weeks. Today is the darker bar.</p>` : ''}`,
    { why: 'Every link a search site gave back goes through the checker. Most are thrown out (a different photo, a logo, a page that would not load). What is left becomes a copy on Copies found.', wide: true });
}
function stSpeed(m) {
  const D = m.D;
  const rows = [['Open the photo from Google Drive', 'drive.openPhoto'], ...SR().ENG.map(e => [SR().ENGN[e] + ' answers', 'eng.' + e + '.ms']), ['Download a found picture', 'dl'], ['Check a found picture', 'chk.all'], ['Whole photo, Keep searching', 'photo.one', 1], ['Whole photo, big searches', 'photo.big', 1]]
    .map(([l, k, b]) => [l, SR().t(D, k), b]).filter(r => r[1] && r[1].n);
  // A stretched (log) scale from 0.1 s to 17 min, so seconds and minutes both fit.
  const L = v => Math.max(0, Math.min(100, (Math.log10(Math.max(100, v)) - 2) / 4 * 100));
  return ssCard('ssSpeed', 'clock', 'How fast links are found', 'The usual time, with the slowest one ' + ssRangeWord() + '.',
    rows.length ? `<div class="ss-rng"><div class="ss-rr ax"><span></span><span class="ss-rax">${['0.1 s', '1 s', '10 s', '1 min', '5 min'].map((t, i) => `<small style="left:${[0, 25, 50, 75.5, 93][i]}%">${t}</small>`).join('')}</span><span></span><span></span></div>${rows.map(([l, x, b]) => { const us = PP_STATS.usual(x); return `<div class="ss-rr${b ? ' tot' : ''}" title="${stN(x.n)} times"><span>${l}</span><span class="ss-rt"><s style="left:${L(us)}%;width:${Math.max(0, L(x.x) - L(us))}%"></s><i style="width:${L(us)}%"></i><u style="left:${L(x.x)}%"></u></span><b>${stMs(us)}</b><small>slowest ${stMs(x.x)}</small></div>`; }).join('')}</div>
    <div class="ss-leg"><span><i class="blue"></i>Usual (half took longer, half less)</span><span><i class="range"></i>Up to the slowest (line)</span><span class="ss-fnt">Times are on a stretched scale so seconds and minutes both fit</span></div>` : ssEmpty('Fills in after the next search.'),
    { why: '"Usual" is the middle time: half took longer, half less. Whole photo covers every search site and every check for that photo, start to done.' });
}
function stChecker(m) {
  const D = m.D, u = k => SR().usual(D, k), c = k => SR().c(D, k);
  const cp = m.copies || { same: {}, maybe: {} };
  const lab = [['stolen', 'You said Stolen', 'green'], ['licensed', 'Licensed', 'teal'], ['removedByYou', 'You removed it', 'red'], ['removedByPageProof', 'PageProof removed it', 'grey'], ['new', 'Not answered yet', 'ghost']];
  const parts = o => lab.map(([k, l, cl]) => [l, (o || {})[k] || 0, cl]);
  const rightOf = o => { const good = ((o || {}).stolen || 0) + ((o || {}).licensed || 0), bad = (o || {}).removedByYou || 0; return good + bad ? ssPc(good, good + bad) : null; };
  const rs = rightOf(cp.same), rm = rightOf(cp.maybe);
  const sv = (title, o, pill) => `<div class="ss-sv"><div class="ss-svh"><b>${title}</b>${pill}</div>${parts(o).some(p => p[1]) ? ssSplit(parts(o), 12) + ssLegend(parts(o)) : ssEmpty('Nothing yet.')}</div>`;
  const second = c('chk.second.kept') + c('chk.second.maybe') + c('chk.second.out') + c('chk.second.saved');
  return ssCard('ssChecker', 'bolt', 'Did the checker get it right?', 'What it said, next to what you answered. Removing a "Same photo" means it was wrong.',
    `${ssMini([['Different photo', stMs(u('chk.no')), 'usual check time'], ['Real copy', stMs(u('chk.same') ?? u('chk.maybe')), 'Same or Maybe'], ['Waiting for a free checker', stMs(u('chk.wait')), (m.checks || '?') + ' checks at once']])}
    <div class="ss-leg"><span><i class="${m.fast === false ? 'amber' : m.fast ? 'green' : 'grey'}"></i>Fast checker ${m.fast == null ? 'not used yet' : m.fast ? 'on' : 'off'}</span><span><i class="${m.gpu ? 'green' : 'grey'}"></i>Graphics card ${m.gpu == null ? 'not used yet' : m.gpu ? 'in use' : 'not available'}</span><span><i class="${c('chk.stuck') ? 'amber' : 'grey'}"></i>${stN(c('chk.stuck'))} could not be checked (over 30 s)</span></div>
    ${sv('Said Same photo', cp.same, rs != null ? ssPill(rs >= 90 ? 'ok' : 'warn', rs + '% right') : '')}
    ${sv('Said Maybe', cp.maybe, rm != null ? ssPill(rm >= 60 ? 'ok' : 'warn', rm + '% were copies') : '')}
    <p class="ss-cap">Copies you added by hand with "It is a copy" (the checker missed them): ${stN(cp.rescued || 0)} so far, ${stN(c('ans.rescued'))} in this time.</p>
    ${second ? `<p class="ss-cap">Second look at full size: ${stN(c('chk.second.kept'))} close Same calls kept, ${stN(c('chk.second.maybe'))} made Maybe, ${stN(c('chk.second.out'))} thrown out · ${stN(c('chk.second.saved'))} of Google's exact matches saved, ${stN(c('chk.second.page'))} found on their page, ${stN(c('chk.second.exactNo'))} still different.</p>` : ''}${c('chk.cover') ? `<p class="ss-cap">Posts kept for a look at every picture (their cover was another photo): ${stN(c('chk.cover'))}.</p>` : ''}`,
    { why: 'Check times are split by the answer. Below them is every copy so far, by what the checker said and what you answered.' });
}
// 4.47 (Ben's pick): where the checker goes wrong. The checker's answers next to yours for the
// last 30 days, by kind of site (going by the site's address), so the fix that helps most shows.
function stByKind(bk) {
  if (!bk || !Object.keys(bk).length) return '';
  const name = k => esc((typeof PP_CTESTS !== 'undefined' && PP_CTESTS.KIND_NAME[k]) || k);
  const rows = Object.entries(bk).sort((a, b) => (b[1].sameN + b[1].maybeN) - (a[1].sameN + a[1].maybeN));
  const worst = rows.filter(([, v]) => v.sameN >= 5).sort((a, b) => a[1].sameOk / a[1].sameN - b[1].sameOk / b[1].sameN)[0];
  const li = ([k, v]) => { const r = v.sameN ? v.sameOk / v.sameN : null, st = r == null ? 'off' : v.sameN >= 5 && r < 0.75 ? 'bad' : r < 0.9 ? 'warn' : 'ok';
    return `<div class="ss-li"><span class="ss-dot ${st}"></span><span class="ss-lin">${name(k)}<em>Same photo answered ${stN(v.sameN)} · Maybe answered ${stN(v.maybeN)}${v.maybeN ? ' (' + ssPc(v.maybeOk, v.maybeN) + '% were copies)' : ''} · missed and added by hand ${stN(v.missed)}</em></span><b>${r == null ? '–' : Math.round(r * 100) + '%'}</b><span class="ss-st ${st}">${r == null ? 'No answers' : 'Same right'}</span></div>`; };
  return ssCard('ssKinds', 'globe', 'Where the checker goes wrong', 'By kind of site, from your answers in the last 30 days.',
    ssMore(rows.map(li), 6, 'kinds of site') + (worst && worst[1].sameOk / worst[1].sameN < 0.85 ? `<p class="ss-cap">Most room to improve: <b>${name(worst[0])}</b>, where ${ssPc(worst[1].sameN - worst[1].sameOk, worst[1].sameN)}% of the Same photo answers were removed.</p>` : ''),
    { why: 'The kind is worked out from the site\'s address (news, shop, social and so on). A low "Same right" means the checker often called a different photo the same there.' });
}
function stEngines(m) {
  const D = m.D, c = k => SR().c(D, k), cards = [];
  for (const e of SR().ENG) {
    const k = 'eng.' + e + '.', n = c(k + 'n');
    if (!n && !c(k + 'robot')) continue;
    const v = x => c('engv.' + e + '.' + x), tot = ['same', 'maybe', ...SR().DROP.map(d => d[0])].reduce((a, x) => a + v(x), 0);
    const st = n >= 5 && c(k + 'links') === 0 ? ['bad', 'No results'] : c(k + 'restMin') ? ['warn', 'Rested ' + (Math.round(c(k + 'restMin') / 6) / 10) + ' h'] : ['ok', 'Fine'];
    const other = Math.max(0, tot - v('same') - v('maybe') - v('different') - v('logos') - v('cant'));
    const parts = [['Same', v('same'), 'green'], ['Maybe', v('maybe'), 'teal'], ['Different', v('different') + v('logos'), 'grey'], ['Could not check', v('cant'), tot && v('cant') / tot >= 0.5 ? 'red' : 'amber'], ['Other reasons', other, 'ghost']];
    const kv = (l, val, bad) => `<div><small>${l}</small><b${bad ? ' class="badn"' : ''}>${val}</b></div>`;
    cards.push(`<div class="ss-eng"><div class="ss-engh"><span class="ss-engl ${e}">${SR().ENGN[e][0]}</span><b>${SR().ENGN[e]}</b>${ssPill(st[0], st[1])}</div>
      <div class="ss-kv">${kv('Searches', stN(n))}${kv('Links each', n ? Math.round(c(k + 'links') / n) : 0)}${kv('Came back empty', (SR().pct(c(k + 'empty'), n) ?? 0) + '%')}${kv('Robot checks', stN(c(k + 'robot')), c(k + 'robot') >= 3)}</div>
      ${tot ? `<small class="ss-sl">What its ${stN(tot)} links turned out to be</small>${ssSplit(parts, 10)}${ssLegend(parts.filter(p => p[1] || p[2] !== 'ghost'))}` : ''}
      <p class="ss-cap">${stN(v('cantOnly'))} links only ${SR().ENGN[e]} found could not be checked · ${stN(c(k + 'noAnswer'))} times no answer</p></div>`);
  }
  return ssCard('ssEngines', 'search', 'Each search site', 'How each site answered ' + ssRangeWord() + '.', cards.length ? `<div class="ss-engs">${cards.join('')}</div>` : ssEmpty('Fills in after the next search.'),
    { why: 'A link two sites found counts for both. Robot checks: the site asked "are you a robot". PageProof never tries to get past these, it rests the site instead. "Could not check" means the picture was blocked or could not be read, so the link was thrown out.', wide: true });
}
function stDrops(m) {
  const D = m.D, c = k => SR().c(D, k), cp = m.copies || {};
  const rows = SR().DROP.map(([k, l]) => [l, c('drop.' + k)]).filter(r => r[1]).sort((a, b) => b[1] - a[1]), mx = Math.max(1, ...rows.map(r => r[1]));
  const total = rows.reduce((a, r) => a + r[1], 0), bar = r => ssHbar(r[0], r[1], mx, 'grey');
  return ssCard('ssDrops', 'trash', 'Links thrown out, and why', rows.length ? stN(total) + ' links ' + ssRangeWord() + ' did not become a copy.' : 'Every link a search found that did not become a copy.',
    (rows.length ? `<div class="ss-hbs">${rows.slice(0, 6).map(bar).join('')}</div>${rows.length > 6 ? `<details class="ss-fold"><summary class="ss-more">${ssIco('chev', 14)} Show all ${rows.length} reasons</summary><div class="ss-hbs">${rows.slice(6).map(bar).join('')}</div></details>` : ''}` : ssEmpty('Nothing thrown out yet.')) +
    `<p class="ss-cap">On your approved sites (kept, as Licensed): ${stN(c('drop.approved'))}. Hidden on Copies found right now until you show them: spam blogs ${stN(cp.spamNew || 0)}, reposts and shares ${stN(cp.repostNew || 0)}.</p>`,
    { why: 'Each rule that throws a link out has its own line, biggest first.' });
}
function stSites(m) {
  const s = Object.entries(m.D.s || {}).sort((a, b) => (b[1].f + b[1].s + b[1].b) - (a[1].f + a[1].s + a[1].b)).slice(0, 15);
  const mx = Math.max(1, ...s.map(([, v]) => v.f + v.s + v.b));
  const li = ([nm, v]) => `<div class="ss-li" title="Failed ${v.f}, too slow ${v.s}, blocked us ${v.b}"><span class="ss-fav">${esc((nm[0] || '?').toUpperCase())}</span><span class="ss-lin">${esc(nm)}</span><span class="ss-lib"><span class="ss-split" style="height:8px;width:${Math.max(6, (v.f + v.s + v.b) / mx * 100)}%">${v.f ? `<i class="red" style="flex:${v.f} 0 0"></i>` : ''}${v.s ? `<i class="amber" style="flex:${v.s} 0 0"></i>` : ''}${v.b ? `<i class="purple" style="flex:${v.b} 0 0"></i>` : ''}</span></span><b>${stN(v.f + v.s + v.b)}</b></div>`;
  return ssCard('ssSites', 'globe', 'Problems by website', 'Websites whose pictures or pages would not download.',
    s.length ? ssMore(s.map(li), 6, 'websites') + `<div class="ss-leg"><span><i class="red"></i>Failed</span><span><i class="amber"></i>Too slow</span><span><i class="purple"></i>Blocked us</span></div>` : ssEmpty('No problems so far.'),
    { why: 'The top 15, by plain website name only. A site that blocks us often may need a slower pace.' });
}
function stHelpers(m) {
  const D = m.D, c = k => SR().c(D, k);
  const rows = [['page', 'Their page check (is it in the article?)'], ['own', 'No picture from the search site: read their page'], ['exact', 'Google said exact: read their page'], ['post', 'Post check (is it in the post?)'], ['acct', 'Account reader'], ['repost', 'Repost check'], ['owner', 'Who\'s behind this site']].filter(([k]) => c('job.' + k + '.n'));
  const lim = Object.entries(D.c).filter(([k]) => k.startsWith('limit.'));
  return ssCard('ssHelpers', 'help', 'Background helpers', 'The helpers that open pages in the background, with a speed limit per site.',
    (rows.length ? `<div class="ss-list">${rows.map(([k, l]) => { const n = c('job.' + k + '.n'), f = c('job.' + k + '.fail'), bad = f / Math.max(1, n) > 0.2; return `<div class="ss-li"><span class="ss-dot ${bad ? 'warn' : 'ok'}"></span><span class="ss-lin">${l}<em>usual ${stMs(SR().usual(D, 'job.' + k))}</em></span><b>${stN(n)}</b><span class="ss-st ${bad ? 'warn' : 'muted'}">${stN(f)} failed</span></div>`; }).join('')}</div>` : ssEmpty('None of them has run yet.')) +
    (lim.length ? `<p class="ss-cap">Site limits: ${lim.map(([k, n]) => esc(k.startsWith('limit.rest.') ? k.slice(11) + ' rested 6 hours' : k === 'limit.held.limit' ? 'waited for a site\'s limit' : 'waited for a resting site') + ' ' + stN(n) + '×').join(' · ')}</p>` : ''),
    { why: 'Post check, account reader and the others each have a speed limit per site, so no site is opened too often.' });
}
// Extra searches (sweeps, Credit search, Watching): what they did, what they found, time spent.
function stExtra(m) {
  if (typeof ntExtraRows !== 'function') return '';
  const rows = ntExtraRows(m.D);
  return ssCard('ssExtra', 'search', 'Extra searches: are they worth it?', 'Sweeps, Credit search and Watching, between photo searches.',
    `<div class="ss-list">${rows.map(r => `<div class="ss-li"><span class="ss-dot ${r.found ? 'ok' : 'off'}"></span><span class="ss-lin">${esc(r.name)}<em>${esc(r.work)} · ${r.mins.toLocaleString()} min spent</em></span><b>${stN(r.found)}<small> ${r.found === 1 ? 'copy' : 'copies'}</small></b><span class="ss-st muted" title="Time per copy">${esc(r.worth)}</span></div>`).join('')}</div><p class="ss-cap">On the right: time per copy, which shows the ones worth running.</p>`,
    { why: 'Time spent is the time they kept Keep searching busy. Time per copy shows which ones are worth it.' });
}
function stKeep(m) {
  const K = SR().KEEP, km = SR().keepMinutes(m.D);
  const cls = s => (K[s] || [0, 'off'])[1];
  const hrs = Array.from({ length: 11 }, (_, i) => i + 8), hl = h => h === 12 ? '12 PM' : h > 12 ? (h - 12) + ' PM' : h + ' AM';
  const cell = (s, when) => { const top = s && Object.entries(s).sort((a, b) => b[1] - a[1])[0]; const k = !top ? 'none' : top[0] === 'fifty' ? 'big' : cls(top[0]); return `<i class="${k}" title="${esc(when)}: ${esc(top ? (K[top[0]] ? K[top[0]][0] : top[0]) : 'PageProof was not running')}"></i>`; };
  const days = m.range === 'today' ? SR().lastDays(1) : SR().lastDays(7);
  const heat = `<div class="ss-heat" role="img" aria-label="What Keep searching was doing each hour">${`<div class="ss-hr hd"><span></span>${hrs.map(h => `<small>${h % 2 ? '' : hl(h)}</small>`).join('')}</div>`}${days.map(k => { const d = m.days[k] ? SR().keepMinutes(m.days[k]) : { hours: {} }, name = new Date(k + 'T12:00').toLocaleDateString([], { weekday: 'short', day: 'numeric' }); return `<div class="ss-hr"><span>${esc(name)}</span>${hrs.map(h => cell(d.hours[h], name + ' ' + hl(h))).join('')}</div>`; }).join('')}</div>
    <div class="ss-leg"><span><i class="green"></i>Working</span><span><i class="teal"></i>Big search running</span><span><i class="red"></i>Stopped</span><span><i class="ghost"></i>Off or outside your hours</span></div>`;
  const parts = [['Working', km.work, 'green'], ['Stopped', km.stop, 'red'], ['Off or outside your hours', km.off, 'ghost']];
  const rows = Object.entries(km.by).sort((a, b) => b[1] - a[1]);
  const pauses = Object.entries(m.D.c).filter(([k]) => k.startsWith('keep.pause.'));
  return ssCard('ssKeep', 'cal', 'Keep searching: on time and pauses', 'What it was doing each hour' + (m.range === 'today' ? ' today' : ', last 7 days') + ', while its pinned tab was open.',
    heat + (parts.some(p => p[1]) ? ssSplit(parts, 12) + ssLegend(parts) : ssEmpty('Nothing yet.')) +
    (rows.length ? `<div class="ss-list tight">${rows.slice(0, 6).map(([s, n]) => `<div class="ss-li"><span class="ss-dot ${cls(s)}"></span><span class="ss-lin">${esc(K[s] ? K[s][0] : s)}</span><b>${(n / 60).toFixed(1)} h</b></div>`).join('')}</div>` : '') +
    (pauses.length ? `<p class="ss-cap">Times it stopped: ${pauses.map(([k, n]) => esc((K[k.slice(11)] || [k.slice(11)])[0].toLowerCase()) + ' ' + n + '×').join(' · ')}</p>` : ''),
    { why: 'Minute by minute, while the Keep searching tab was open. Stopped means it wanted to search but could not (paused, Drive offline, computer busy).', wide: true });
}
function stDrive(m) {
  const D = m.D, rows = [['readNewFolders', 'Hourly check for new photos'], ['readEveryFolder', 'Weekly check of every folder'], ['openPhoto', 'Open one photo'], ['driveAnswer', 'Drive answers'], ['searchLine', 'Work out the next photo']].map(([k, l]) => [l, SR().t(D, 'drive.' + k)]).filter(r => r[1]);
  const off = (SR().keepMinutes(D).by.offline || 0), failed = SR().c(D, 'drive.openFailed');
  const li = ([l, x]) => { const us = PP_STATS.usual(x), st = us > 8000 ? ['bad', 'Slow'] : us > 2500 ? ['warn', 'A bit slow'] : ['ok', 'Fine']; return `<div class="ss-li"><span class="ss-dot ${st[0]}"></span><span class="ss-lin">${l}<em>${stN(x.n)} times · slowest ${stMs(x.x)}</em></span><b>${stMs(us)}</b><span class="ss-st ${st[0]}">${st[1]}</span></div>`; };
  return ssCard('ssDrive', 'drive', 'Google Drive speed', 'Shows if a slow day was Drive, not PageProof.',
    (rows.length ? `<div class="ss-list">${rows.map(li).join('')}</div>` : ssEmpty('Fills in after the next Drive check.')) + `<p class="ss-cap">Offline ${(off / 60).toFixed(1)} hours · photos Drive did not hand over: ${stN(failed)}</p>`,
    { why: 'Drive for desktop can be slow on big folders. The time shown is the usual one: half took longer, half less. PageProof only ever reads from your photos Drive.' });
}
function stCover(m) {
  const cv = m.cover; if (!cv) return ssCard('ssCover', 'stack', 'Photos covered', 'How far searching has got through your photos.', ssEmpty('Connect your photos first.'));
  const f = cv.first, g = cv.groups, tot = f.done + f.never + f.cant;
  const wd = m.keys.filter(k => ![0, 6].includes(new Date(k + 'T12:00').getDay())).length || 1;
  const perDay = SR().c(m.D, 'photos') / wd;
  const months = perDay >= 1 && f.never ? Math.max(1, Math.round(f.never / perDay / 21)) : null;
  const prow = (l, a, b, note) => !b ? '' : `<div class="ss-prow"><span>${l}<em>${note}</em></span><span class="ss-pbar"><i style="width:${ssPc(a, b)}%"></i></span><b>${ssPc(a, b)}%</b><small>${stN(a)} of ${stN(b)}</small></div>`;
  return ssCard('ssCover', 'stack', 'Photos covered', 'How far searching has got through your photos. Counts only.',
    `<div class="ss-cov">${ssRing(f.done, tot, 132, 'blue', ssPc(f.done, tot) + '%')}<div><b class="ss-big">${stN(f.done)} of ${stN(tot)} photos searched at least once</b><p class="ss-cap" style="margin-top:4px">${months ? `At ${Math.round(perDay)} photos a weekday, every photo is searched once in about <b>${months} month${months === 1 ? '' : 's'}</b>.` : 'Search more photos to see how long it takes to get through them all.'} ${stN(f.week)} photos had their first search this week. ${stN(f.never)} never searched, ${stN(f.cant)} cannot be searched.</p></div></div>
    <div class="ss-prows">${prow('Priority', g.top[0], g.top[1], 'searched in the last week')}${prow('Last 3 months', g.recent[0], g.recent[1], 'searched in the last month')}${prow('This year', g.year[0], g.year[1], 'searched in the last 6 months')}${prow('Older', g.older[0], g.older[1], 'searched in the last year')}</div>`,
    { why: 'Up to date means the photo was searched again recently enough for its age: newer photos are searched more often.' });
}
function stStrain(m) {
  const D = m.D, c = k => SR().c(D, k), hw = m.hw || {}, km = SR().keepMinutes(D);
  return ssCard('ssStrain', 'pc', 'Computer strain', 'Whether PageProof is too heavy for this computer.',
    `<div class="ss-pcs"><span>${ssIco('pc', 16)} ${esc(hw.level || '?')} computer</span><span>${hw.cores || '?'} cores</span><span>${hw.memGB || '?'} GB memory</span><span>Highest page memory ${(D.x || {})['mem.page'] ? stN(D.x['mem.page']) + ' MB' : 'not known'}</span></div>` +
    ssHbars([['Search slowed down, busy', c('strain.eased.busy')], ['Search slowed down, memory', c('strain.eased.memory')], ['Search slowed down, battery', c('strain.eased.battery')], ['Keep searching waited (minutes)', km.by.busy || 0], ['Search page restarted', c('strain.resumed'), 'red']], 'amber'),
    { why: 'PageProof slows itself down when the computer is busy, low on memory or on battery.' });
}
// Pick 15: the Save card is gone. Save stats for Claude is on the tab line; the weekly file is a switch row.
async function stWeeklyRow() {
  const docs = await RS_DOCS.state().catch(() => 'none'), st = await PP_STATS.all(), w = st.weekly, off = !!st.weeklyOff;
  return SX.group('The stats file', SX.row('file', 'Save a weekly stats file by itself', `Every Friday at 5:30 PM (or the next time PageProof runs that weekend), in Documents › PageProof › stats. ${docs === 'granted' ? (w ? 'Last one: ' + esc(w.name) + ', ' + esc(new Date(w.at).toLocaleString()) + '.' : 'None saved yet.') : 'Needs the PageProof folder: <a href="#backups">set it up in Backups and team</a>.'}`, SX.sw('data-act="stweekly"', !off, 'Save a weekly stats file by itself'), { id: 'ssWeekly' }) +
    SX.row('copy', 'Copy the stats instead of saving a file', 'The same text as Save stats for Claude, ready to paste into the chat. Never in it: client names, photo names, folder paths, links, your name.', `<button class="btn kbtn" data-act="stcopy">Copy</button>`, { id: 'ssCopy' }), 'ssFile');
}

// ---------------------------------------------------------------- the page
// 4.58: website copies by how popular their site is (Tranco list). Counts only.
async function stPop() {
  if (typeof PP_POP === 'undefined' || !(await PP_POP.info()).date) return '';
  const cs = (await FC.allCopies()).filter(c => c.status !== 'removed' && FC.useOf(c) !== 'social');
  const R = await PP_POP.ranks(cs.map(c => c.site)).catch(() => new Map());
  const rows = [['Top 1K', 4], ['Top 10K', 3], ['Top 100K', 2], ['Top 1M', 1], ['Small sites', 0], ['Shared platforms (blogs, shops)', -1]].map(([l, lv]) => {
    const xs = cs.filter(c => PP_POP.level(R.has(c.site) ? R.get(c.site) : null) === lv);
    return [l, xs.length, lv >= 3 ? 'amber' : lv === -1 ? 'grey' : 'blue', xs.filter(c => c.status === 'stolen').length + ' marked stolen'];
  });
  let bad = 0;
  if (typeof PP_BAD !== 'undefined') { await PP_BAD.prepare(cs.map(c => c.site)).catch(() => {}); bad = cs.filter(c => PP_BAD.of(c.site, R.get(c.site))).length; }
  return ssCard('ssPop', 'star', 'Copies by site popularity', 'Website copies (not removed), by how visited the site is.', ssHbars(rows) + (typeof PP_BAD !== 'undefined' ? `<p class="ss-cap">${stN(bad)} on a known bad site list (piracy, scam, phishing, malware).</p>` : ''),
    { why: 'Popularity comes from the site popularity list in Settings › Site lists. Hover a bar for how many you marked stolen.' });
}
V.stats = async () => {
  const fresh = state.stModel && state.stModel.range === state.stRange && Date.now() - state.stModel.at < 30000;
  const m = fresh ? state.stModel : Object.assign(await PP_REPORT.model(state.stRange), { at: Date.now() });
  state.stModel = m;
  const D = m.D, P = m.P, c = (X, k) => SR().c(X, k), u = (X, k) => SR().usual(X, k);
  const range = `<div class="sx-seg st-range" role="group" aria-label="Time shown">${[['today', 'Today'], ['7', '7 days'], ['30', '30 days']].map(([v, l]) => `<button class="${state.stRange === v ? 'on' : ''}" aria-pressed="${state.stRange === v}" data-act="strange" data-v="${v}">${l}</button>`).join('')}</div>`;
  const al = m.alerts, empty = !Object.keys(m.days).length;
  const bars = `<div class="ss-bars" id="ssAlerts">${al.length ? al.map(([lvl, a, b]) => `<div class="ss-ib ${lvl === 'bad' ? 'bad' : 'warn'}" role="${lvl === 'bad' ? 'alert' : 'status'}"><span class="ss-ibi">${ssIco(lvl === 'bad' ? 'warn' : 'info', 18)}</span><b>${esc(a)}</b><span class="ss-ibt" title="${esc(b)}">${esc(b)}</span></div>`).join('')
    : `<div class="ss-ib ok" role="status"><span class="ss-ibi">${ssIco('check', 18)}</span><b>Nothing looks off</b><span class="ss-ibt">${empty ? 'Stats start now. They fill in as PageProof searches.' : 'PageProof compares each day with this computer\'s usual numbers.'}</span></div>`}</div>`;
  const d14 = SR().lastDays(14), per = f => d14.map(k => m.days[k] ? f(m.days[k]) : null);
  const one = X => u(X, 'photo.one') ?? u(X, 'photo.big');
  const tile = (icon, cls, label, val, tr, sp) => `<div class="ss-tile"><div class="ss-tt"><span class="ss-ti ${cls}">${ssIco(icon, 18)}</span><span>${label}</span></div><b class="ss-tv">${val}</b>${tr}${ssSpark(sp, cls, label)}<small class="ss-ts">Last 2 weeks</small></div>`;
  const tiles = `<div class="ss-tiles" id="ssTiles">
    ${tile('photo', 'blue', 'Photos searched', stN(c(D, 'photos')), ssTrend(c(D, 'photos'), c(P, 'photos')), per(d => c(d, 'photos')))}
    ${tile('copy', 'green', 'New copies', stN(c(D, 'copies.new')), ssTrend(c(D, 'copies.new'), c(P, 'copies.new')), per(d => c(d, 'copies.new')))}
    ${tile('clock', 'teal', 'Time to search one photo', stMs(one(D)), ssTrend(one(D), one(P), true), per(d => one(d)))}
    ${tile('bolt', 'purple', 'One photo check', stMs(u(D, 'chk.all')), ssTrend(u(D, 'chk.all'), u(P, 'chk.all'), true), per(d => u(d, 'chk.all')))}
  </div>`;
  const groups = [['found', 'What it found', stFound(m) + stCover(m) + stDrops(m) + await stPop()], ['sites', 'Search sites', stEngines(m) + stSpeed(m) + stSites(m)], ['checker', 'The checker', stTestCard(m) + stChecker(m) + stByKind((m.copies || {}).byKind)],
    ['pc', 'This computer', stKeep(m) + stDrive(m) + stStrain(m)], ['extra', 'Extra searches and helpers', stExtra(m) + stHelpers(m)]];
  const jump = `<nav class="ss-jump" id="ssJump" aria-label="Jump to a part of the stats"><span>Jump to</span>${groups.map(([k, l]) => `<button data-act="ssjump" data-v="${k}">${l}</button>`).join('')}</nav>`;
  return sxHealthFrame('stats', `${range}<button class="btn kbtn" data-act="stsave">${ic('down', 16)} Save stats for Claude</button>`, `<div class="ss">
    ${state.stSaved ? `<div class="ss-ib ok" id="ssSaved" role="status"><span class="ss-ibi">${ssIco('check', 18)}</span><b>Saved</b><span class="ss-ibt" title="${esc(state.stSaved)}">${esc(state.stSaved)}</span></div>` : ''}
    ${bars}${tiles}${jump}
    ${groups.map(([k, l, inner]) => ssGroup(k, l, inner)).join('')}
    ${await stWeeklyRow()}
    <p class="sx-note">Numbers only, never names: what PageProof did on this computer, day by day.</p></div>`, 'sxp-stats');
};
V.stats.after = () => SX.after();
ACTS.ssjump = v => { const g = document.getElementById('ssg-' + v); if (g) g.scrollIntoView({ block: 'start' }); };

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
