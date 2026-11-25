// How PageProof is doing: works the day-by-day record (pp-stats.js) into the numbers the page
// shows (ui/fc-stats.js), the "Something looks off" alerts, and the stats file you can hand to
// Claude ("Save stats for Claude", and the weekly file saved by itself on Fridays).
// The file holds counts, times and plain website names only. Client names, photo names, folder
// paths and links are never put in, and a last check blanks any client name that slipped through.
const PP_REPORT = (() => {
  const api = globalThis.browser || globalThis.chrome;
  const ENG = ['google', 'yandex', 'bing'];
  const ENGN = { google: 'Google Lens', yandex: 'Yandex', bing: 'Bing' };
  const DAY = 864e5;
  const keyOf = d => PP_STATS.dayKey(d);
  // The last n calendar days (newest last), starting `back` days before today.
  const lastDays = (n, back = 0) => Array.from({ length: n }, (_, i) => keyOf(new Date(Date.now() - (back + n - 1 - i) * DAY)));
  const c = (D, k) => (D && D.c && D.c[k]) || 0;
  const t = (D, k) => (D && D.t && D.t[k]) || null;
  const usual = (D, k) => PP_STATS.usual(t(D, k));
  const pct = (a, b) => (b ? Math.round(a / b * 100) : null);
  const ms = v => v == null ? '–' : v < 1000 ? Math.round(v) + ' ms' : v < 60000 ? (v / 1000).toFixed(v < 10000 ? 1 : 0) + ' s' : Math.floor(v / 60000) + ' m ' + Math.round(v % 60000 / 1000) + ' s';
  const num = n => Number(n || 0).toLocaleString('en-US');
  // Keep searching, minute by minute (runner.js): what each state means.
  const KEEP = {
    running: ['Searching a photo', 'work'], waiting: ['Resting between photos (the pace)', 'work'], fifty: ['A big search was running', 'work'], idle: ['Every photo up to date', 'work'],
    paused: ['Paused by you', 'stop'], offline: ['Google Drive offline', 'stop'], allow: ['Waiting for one click on Allow', 'stop'], busy: ['Computer busy', 'stop'], resting: ['Every search site resting', 'stop'], setup: ['Not set up', 'stop'],
    hours: ['Outside your hours', 'off'], off: ['Switched off', 'off'],
  };
  const DROP = [
    ['hidden', 'On your hidden sites (not downloaded)'], ['different', 'Different photo'], ['logos', 'Only logos or the same place line up'], ['card', 'Link preview of another site'],
    ['notInPost', 'Not in the post or article itself'], ['forum', 'Forum (Reddit and others)'], ['removedBefore', 'You removed it before'], ['cant', 'Could not be checked'], ['other', 'Still checking when the search ended'],
  ];
  function browserName() {
    const u = navigator.userAgent;
    const m = /Edg\/(\d+)/.exec(u) || /Firefox\/(\d+)/.exec(u) || /Chrome\/(\d+)/.exec(u);
    return m ? (/Edg\//.test(u) ? 'Edge ' : /Firefox\//.test(u) ? 'Firefox ' : 'Chrome ') + m[1] : 'Browser';
  }
  // Minutes per Keep searching state, and per hour (today's strip).
  function keepMinutes(D) {
    const by = {}, hours = {};
    for (const [h, m] of Object.entries((D && D.k) || {})) for (const [s, n] of Object.entries(m)) { by[s] = (by[s] || 0) + n; (hours[h] = hours[h] || {})[s] = n; }
    const sum = g => Object.entries(by).filter(([s]) => (KEEP[s] || [0, 'off'])[1] === g).reduce((a, [, n]) => a + n, 0);
    return { by, hours, work: sum('work'), stop: sum('stop'), off: sum('off') };
  }

  // ---------------------------------------------------------------- what's in the shop right now
  // Copies found, by what the checker said and what you answered (all time), and coverage.
  async function copiesNow() {
    const out = { same: {}, maybe: {}, rescued: 0, spamNew: 0, repostNew: 0, total: 0, byKind: {} };
    try {
      const all = await FC.allCopies();
      out.total = all.length;
      // 4.47: the checker's answers next to yours, by kind of site, for copies answered in the last 30 days.
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      if (typeof PP_CTESTS !== 'undefined') for (const x of all) {
        if (!x.answered || x.answered < since || x.status === 'new' || x.removedBy) continue;
        const k = PP_CTESTS.kindOf(x), b = out.byKind[k] || (out.byKind[k] = { sameN: 0, sameOk: 0, maybeN: 0, maybeOk: 0, missed: 0 });
        if (/by hand/.test(x.by || '')) { b.missed++; continue; }
        const ok = x.status === 'stolen' || x.status === 'licensed';
        if (x.match === 'same') { b.sameN++; if (ok) b.sameOk++; } else if (x.match === 'maybe') { b.maybeN++; if (ok) b.maybeOk++; }
      }
      for (const x of all) {
        if (/by hand/.test(x.by || '')) { out.rescued++; continue; }
        const m = x.match === 'same' ? out.same : x.match === 'maybe' ? out.maybe : null;
        if (!m) continue;
        const st = x.status === 'removed' ? (x.removedBy ? 'removedByPageProof' : 'removedByYou') : x.status || 'new';
        m[st] = (m[st] || 0) + 1;
      }
      // 4.50 (Ben's pick): the checker's own numbers for every copy you answered, so Claude can tune
      // the checker's limits on your real answers. Numbers only: no site, address, client or photo.
      // [answer, checker said, %, matching details, squares, closeness, middle, kind, sites, exact list, picture from]
      const ANS = { stolen: 'S', licensed: 'L', removed: 'R' };
      out.answersKey = 'answer S=stolen L=licensed R=removed by you H=added by hand | said s=same m=maybe | pct, inl, tiles, str, mid | kind | g/y/b sites | x=exact list | from';
      out.answers = all.filter(x => x.answered && (/by hand/.test(x.by || '') || (ANS[x.status] && !x.removedBy)))
        .sort((p, q) => String(q.answered).localeCompare(String(p.answered))).slice(0, 600)
        .map(x => [/by hand/.test(x.by || '') ? 'H' : ANS[x.status], x.match === 'same' ? 's' : x.match === 'maybe' ? 'm' : '-', x.pct ?? null, x.inl ?? null, x.tiles ?? null, x.str ?? null, x.mid ?? null,
          typeof PP_CTESTS !== 'undefined' ? PP_CTESTS.kindOf(x) : '', (x.engines || []).map(e => e[0]).join(''), x.exact ? 'x' : '', x.from || '']);
      const spam = FC.spamMarks ? FC.spamMarks(all) : new Map();
      for (const x of all) if (x.status === 'new') { if (spam.has(x.id)) out.spamNew++; if (x.rp && x.rp.state === 'repost') out.repostNew++; }
    } catch (e) { out.error = String(e && e.message || e); }
    return out;
  }
  async function coverNow() {
    try { const v = await FC.coverage(); return { first: { done: v.first.done, total: v.first.total, never: v.first.never, cant: v.first.cant, week: v.first.week }, groups: v.groups, quiet: v.quiet, total: v.total }; } catch (e) { return null; }
  }

  // ---------------------------------------------------------------- the numbers for a range
  // range: 'today', '7' or '30'.
  async function model(range = '7', opts = {}) {
    const st = await PP_STATS.all();
    const n = range === 'today' ? 1 : +range || 7;
    const keys = lastDays(n), prevKeys = lastDays(n, n);
    const D = PP_STATS.sum(keys.map(k => st.days[k])), P = PP_STATS.sum(prevKeys.map(k => st.days[k]));
    const [hw, keep, rs] = await Promise.all([
      typeof ppHardware === 'function' ? ppHardware().catch(() => null) : null,
      FC.keep().catch(() => ({})),
      api.storage.local.get('rsTiming').then(x => x.rsTiming || {}).catch(() => ({})),
    ]);
    const m = {
      range, n, keys, D, P, days: st.days, test: st.test || null, weekly: st.weekly || null,
      version: api.runtime.getManifest().version, browser: browserName(), hw, keep: { on: !!keep.on, pace: keep.pace || '', hours: keep.hours === 'all' ? 'all day' : (keep.from ?? 8) + '-' + (keep.to ?? 18) },
      fast: rs.fast, gpu: rs.gpu, checks: rs.checks || (hw && hw.limits && hw.limits.checks) || null,
      firstDay: Object.keys(st.days).sort()[0] || null,
    };
    if (!opts.light) { m.copies = await copiesNow(); m.cover = await coverNow(); }
    m.realtest = st.realtest || null;
    try { m.realPairs = typeof PP_CTESTS !== 'undefined' ? await PP_CTESTS.count() : 0; } catch (e) { m.realPairs = 0; }
    // 4.39: the error diary, saves that failed and how much is stored (pp-guard.js).
    if (typeof PP_GUARD !== 'undefined') {
      m.saveFail = await PP_GUARD.lastFail().catch(() => null);
      if (!opts.light) { m.errors = await PP_GUARD.diary(n).catch(() => []); m.usage = await PP_GUARD.usage().catch(() => null); }
    }
    m.alerts = alerts(st, m);
    return m;
  }

  // ---------------------------------------------------------------- "Something looks off"
  // Each: [level 'bad' | 'warn', what, more]. Compares the last days with this computer's usual.
  function alerts(st, m) {
    const out = [], days = st.days || {};
    if (m && m.saveFail && Date.now() - m.saveFail.at < 7 * 864e5) out.push(['bad', 'PageProof could not save some changes', (m.saveFail.quota ? 'The browser\'s storage for PageProof is full. ' : '') + 'Last time ' + new Date(m.saveFail.at).toLocaleString() + ' (' + m.saveFail.n + ' times in all). Open Settings › Is everything working.']);
    const today = keyOf(new Date()), recent = lastDays(8).map(k => [k, days[k]]).filter(([, d]) => d);
    const T = days[today];
    const before = PP_STATS.sum(lastDays(7, 1).map(k => days[k]));
    const dayName = k => k === today ? 'today' : new Date(k + 'T12:00').toLocaleDateString('en-US', { weekday: 'long' });
    for (const e of ENG) {
      // No results at all for 2+ days in a row (days with at least 5 searches), when it used to give some.
      let run = 0;
      for (let i = recent.length - 1; i >= 0; i--) { const d = recent[i][1]; if (c(d, 'eng.' + e + '.n') < 5) continue; if (c(d, 'eng.' + e + '.links') === 0) run++; else break; }
      const sum30 = PP_STATS.sum(Object.values(days));
      const usualLinks = c(sum30, 'eng.' + e + '.n') ? c(sum30, 'eng.' + e + '.links') / c(sum30, 'eng.' + e + '.n') : 0;
      if (run >= 2 && usualLinks > 0) out.push(['bad', ENGN[e] + ' gave no results for ' + run + ' days in a row', 'It used to give about ' + Math.max(1, Math.round(usualLinks)) + ' links a photo. The site may have changed its page.']);
      else if (T && c(T, 'eng.' + e + '.n') >= 10 && c(T, 'eng.' + e + '.empty') / c(T, 'eng.' + e + '.n') >= 0.9 && usualLinks > 1) out.push(['warn', ENGN[e] + ' found nothing for most photos today', c(T, 'eng.' + e + '.empty') + ' of ' + c(T, 'eng.' + e + '.n') + ' searches came back empty.']);
      if (T && c(T, 'eng.' + e + '.robot') >= 3) out.push(['warn', ENGN[e] + ' asked "are you a robot" ' + c(T, 'eng.' + e + '.robot') + ' times today', 'A slower Keep searching pace may help. PageProof never tries to get past these checks.']);
      if (T && c(T, 'eng.' + e + '.n') >= 10 && c(T, 'eng.' + e + '.noAnswer') / c(T, 'eng.' + e + '.n') >= 0.3) out.push(['warn', ENGN[e] + ' often gave no answer today', c(T, 'eng.' + e + '.noAnswer') + ' of ' + c(T, 'eng.' + e + '.n') + ' searches timed out.']);
    }
    // A search site whose links mostly can't be checked (pictures blocked, sizes unknown).
    for (const e of ENG) {
      const W = PP_STATS.sum(lastDays(3).map(k => days[k]));
      const v = k => c(W, 'engv.' + e + '.' + k), tot = ['same', 'maybe', 'different', 'logos', 'cant'].reduce((a, k) => a + v(k), 0);
      if (tot >= 40 && v('cant') / tot >= 0.5) out.push(['bad', pct(v('cant'), tot) + '% of ' + ENGN[e] + '\'s links could not be checked in the last 3 days', 'Their pictures were blocked or could not be read, so they were thrown out. ' + num(v('cantOnly')) + ' of them were found only by ' + ENGN[e] + '.']);
    }
    // No new copies on a busy day, when there usually are some.
    const lastBusy = [...recent].reverse().find(([, d]) => c(d, 'photos') >= 50);
    const rate = c(before, 'photos') ? c(before, 'copies.new') / c(before, 'photos') : 0;
    if (lastBusy && c(lastBusy[1], 'copies.new') === 0 && rate > 0.02) out.push(['bad', 'No new copies ' + dayName(lastBusy[0]) + ' while ' + num(c(lastBusy[1], 'photos')) + ' photos were searched', 'Usually about ' + Math.max(1, Math.round(rate * 100)) + ' new copies come from every 100 photos.']);
    if (T) {
      const now = usual(T, 'chk.all'), was = usual(before, 'chk.all');
      if (t(T, 'chk.all') && t(T, 'chk.all').n >= 50 && was && now > was * 1.5) out.push(['warn', 'Photo checks are ' + Math.round((now / was - 1) * 100) + '% slower today than usual', ms(now) + ' each today, usually ' + ms(was) + '. A busy computer or a lot of open tabs can do this.']);
      const stuck = c(T, 'chk.stuck'), all = (t(T, 'chk.all') || { n: 0 }).n + stuck;
      if (all >= 20 && stuck / all >= 0.05) out.push(['warn', num(stuck) + ' found pictures could not be checked today', 'Each took over 30 seconds. That is ' + pct(stuck, all) + '% of the checks.']);
      const dlBad = c(T, 'dl.failed') + c(T, 'dl.slow') + c(T, 'dl.blocked'), dlAll = (t(T, 'dl') || { n: 0 }).n + dlBad;
      if (dlAll >= 50 && dlBad / dlAll >= 0.4) out.push(['warn', pct(dlBad, dlAll) + '% of found pictures could not be downloaded today', 'See Problems by website for the sites behind it.']);
      const open = usual(T, 'drive.openPhoto');
      if (open && t(T, 'drive.openPhoto').n >= 10 && open > 8000) out.push(['warn', 'Google Drive is slow today', 'Opening one photo usually takes ' + ms(open) + '.']);
      const km = keepMinutes(T);
      if ((km.by.offline || 0) >= 60) out.push(['warn', 'Google Drive was offline for ' + Math.round(km.by.offline / 6) / 10 + ' hours today', 'Keep searching waits while Drive for desktop is signed out or not running.']);
      if (c(T, 'strain.resumed') >= 2) out.push(['warn', 'A search page restarted ' + c(T, 'strain.resumed') + ' times today', 'This happens when the browser runs out of memory or the page is reloaded.']);
      if ((T.x || {})['mem.page'] > 1500) out.push(['warn', 'A PageProof page used ' + num(T.x['mem.page']) + ' MB of memory today', 'More than usual. Closing other tabs can help.']);
    }
    // Keep searching barely ran on the last weekday (only when it is switched on).
    if (m && m.keep && m.keep.on) {
      const wk = [...recent].reverse().find(([k]) => k !== today && ![0, 6].includes(new Date(k + 'T12:00').getDay()));
      if (wk) { const km = keepMinutes(wk[1]); const work = Object.entries(km.hours).filter(([h]) => h >= 8 && h < 18).reduce((a, [, s]) => a + Object.entries(s).filter(([x]) => (KEEP[x] || [0, ''])[1] === 'work').reduce((b, [, n]) => b + n, 0), 0);
        if (work < 180) out.push(['warn', 'Keep searching only ran ' + Math.round(work / 6) / 10 + ' hours on ' + dayName(wk[0]), 'Between 8 AM and 6 PM. See Keep searching below for what stopped it.']); }
    }
    if (m && m.test && m.test.right < m.test.n) out.push([m.test.right / m.test.n < 0.9 ? 'bad' : 'warn', 'The checker test got ' + m.test.right + ' of ' + m.test.n + ' right', 'On the computer it was made on it gets all ' + m.test.n + ' right. Save stats for Claude and send the file.']);
    return out;
  }

  // ---------------------------------------------------------------- the file
  function lines(m) {
    const D = m.D, L = [];
    const from = m.keys[0], to = m.keys[m.keys.length - 1];
    const hw = m.hw || {};
    L.push('PageProof stats for support', 'Made ' + new Date().toString().replace(/ \(.*\)$/, ''), '');
    L.push('Version ' + m.version + ' · ' + m.browser + ' · ' + (hw.level ? hw.level + ' computer (' + hw.cores + ' cores, ' + hw.memGB + ' GB memory, ' + (hw.limits ? hw.limits.checks : '?') + ' photo checks at once)' : 'computer not measured'));
    L.push('Covers ' + (m.n === 1 ? 'today, ' + to : from + ' to ' + to + ' (' + m.n + ' days)') + (m.firstDay && m.firstDay > from ? '. Stats started on ' + m.firstDay + '.' : ''));
    L.push('Keep searching: ' + (m.keep.on ? 'on, ' + m.keep.pace + ' pace, ' + m.keep.hours : 'off'), '');
    L.push('Looks off');
    if (!m.alerts.length) L.push('  Nothing.'); else for (const [lvl, a, b] of m.alerts) L.push('  [' + (lvl === 'bad' ? 'red' : 'yellow') + '] ' + a + '. ' + b);
    L.push('', 'Found');
    L.push('  Photos searched ' + num(c(D, 'photos')) + ' (Keep searching ' + num(c(D, 'photos.keep')) + ', big searches ' + num(c(D, 'photos.fifty') + c(D, 'photos.new')) + ') · with any link ' + num(c(D, 'photos.withLinks')) + ' · with a new copy ' + num(c(D, 'photos.withNew')));
    const dropped = DROP.reduce((a, [k]) => a + c(D, 'drop.' + k), 0);
    L.push('  Links ' + num(c(D, 'links')) + ' -> thrown out ' + num(dropped) + ' -> Same photo ' + num(c(D, 'kept.same')) + ', Maybe ' + num(c(D, 'kept.maybe')) + ' -> new copies ' + num(c(D, 'copies.new')));
    L.push('  Your answers: Stolen ' + num(c(D, 'ans.stolen')) + ', Licensed ' + num(c(D, 'ans.licensed')) + ', Removed ' + num(c(D, 'ans.removed')) + ', changed later ' + num(c(D, 'ans.changed')) + ', put back ' + num(c(D, 'ans.putBack') + c(D, 'ans.putBack.checker') + c(D, 'ans.putBack.postcheck')) + ', "It is a copy" ' + num(c(D, 'ans.rescued')));
    L.push('', 'Links thrown out');
    for (const [k, l] of DROP) if (c(D, 'drop.' + k)) L.push('  ' + l + ': ' + num(c(D, 'drop.' + k)));
    if (c(D, 'drop.approved')) L.push('  (On approved sites, kept as Licensed: ' + num(c(D, 'drop.approved')) + ')');
    if (m.copies) L.push('  Hidden on Copies found right now: spam blogs ' + num(m.copies.spamNew) + ', reposts and shares ' + num(m.copies.repostNew));
    L.push('', 'Speed (usual / slowest)');
    L.push('  Whole photo, Keep searching: ' + ms(usual(D, 'photo.one')) + ' / ' + ms((t(D, 'photo.one') || {}).x) + ' (' + num((t(D, 'photo.one') || {}).n) + ')');
    L.push('  Whole photo, big searches: ' + ms(usual(D, 'photo.big')) + ' / ' + ms((t(D, 'photo.big') || {}).x) + ' (' + num((t(D, 'photo.big') || {}).n) + ')');
    L.push('  Open one photo from Drive: ' + ms(usual(D, 'drive.openPhoto')) + ' / ' + ms((t(D, 'drive.openPhoto') || {}).x));
    for (const e of ENG) if (t(D, 'eng.' + e + '.ms')) L.push('  ' + ENGN[e] + ' answers: ' + ms(usual(D, 'eng.' + e + '.ms')) + ' / ' + ms(t(D, 'eng.' + e + '.ms').x));
    L.push('  Download a found picture: ' + ms(usual(D, 'dl')) + ' / ' + ms((t(D, 'dl') || {}).x) + ' (' + num((t(D, 'dl') || {}).n) + ')');
    L.push('', 'Photo checker');
    L.push('  Fast checker ' + (m.fast == null ? 'not known' : m.fast ? 'on' : 'off') + ' · graphics card ' + (m.gpu == null ? 'not used yet' : m.gpu ? 'in use' : 'not available') + ' · ' + (m.checks || '?') + ' checks at once');
    L.push('  One check: ' + ms(usual(D, 'chk.all')) + ' usual (' + num((t(D, 'chk.all') || {}).n) + ' checks) · Different ' + ms(usual(D, 'chk.no')) + ' · Same ' + ms(usual(D, 'chk.same')) + ' · Maybe ' + ms(usual(D, 'chk.maybe')));
    L.push('  Waiting for a free checker: ' + ms(usual(D, 'chk.wait')) + ' usual, ' + ms((t(D, 'chk.wait') || {}).x) + ' slowest · could not check (over 30 s) ' + num(c(D, 'chk.stuck')));
    L.push('  Second looks: close Same kept ' + num(c(D, 'chk.second.kept')) + ', made Maybe ' + num(c(D, 'chk.second.maybe')) + ', thrown out ' + num(c(D, 'chk.second.out')) + ' · exact saved ' + num(c(D, 'chk.second.saved')) + ', found on their page ' + num(c(D, 'chk.second.page')) + ', still different ' + num(c(D, 'chk.second.exactNo')) + ' · posts kept to check every picture ' + num(c(D, 'chk.cover')) + ' · slow look ' + ms(usual(D, 'chk.deep')));
    if (m.test) L.push('  Checker test: ' + m.test.right + ' of ' + m.test.n + ' right, ' + ms(m.test.ms) + ' each, ' + new Date(m.test.at).toLocaleString('en-US') + ' (' + Object.values(m.test.groups).map(g => g.label + ' ' + g.right + '/' + g.n).join(', ') + ')');
    else L.push('  Checker test: not run yet');
    if (m.realtest) L.push('  Your real pairs: ' + m.realtest.right + ' of ' + m.realtest.n + ' right (kept but removed ' + m.realtest.wrongKept + ', missed ' + m.realtest.missed + '; ' + Object.entries(m.realtest.byKind || {}).map(([k, v]) => k + ' ' + v.right + '/' + v.n).join(', ') + ')');
    if (m.copies && m.copies.byKind) L.push('  Checker vs your answers, last 30 days, by kind of site: ' + Object.entries(m.copies.byKind).map(([k, v]) => k + ' Same ' + v.sameOk + '/' + v.sameN + ', Maybe ' + v.maybeOk + '/' + v.maybeN + ', missed ' + v.missed).join(' | '));
    if (m.copies) {
      const row = (o, name) => { const n = Object.values(o).reduce((a, b) => a + b, 0); return '  Said ' + name + ' (' + num(n) + '): ' + ['stolen', 'licensed', 'removedByYou', 'removedByPageProof', 'new'].map(k => k.replace(/([A-Z])/g, ' $1').toLowerCase() + ' ' + num(o[k] || 0)).join(', '); };
      L.push('  All copies so far, by what the checker said and what you answered:', row(m.copies.same, 'Same photo'), row(m.copies.maybe, 'Maybe'), '  Added by hand ("It is a copy"): ' + num(m.copies.rescued));
    }
    L.push('', 'Search sites');
    for (const e of ENG) { const k = 'eng.' + e + '.'; if (!c(D, k + 'n') && !c(D, k + 'robot')) continue; L.push('  ' + ENGN[e] + ': ' + num(c(D, k + 'n')) + ' searches, ' + (c(D, k + 'n') ? Math.round(c(D, k + 'links') / c(D, k + 'n')) : 0) + ' links each, empty ' + (pct(c(D, k + 'empty'), c(D, k + 'n')) ?? 0) + '%, no answer ' + num(c(D, k + 'noAnswer')) + ', robot checks ' + num(c(D, k + 'robot')) + ', resting ' + Math.round(c(D, k + 'restMin') / 6) / 10 + ' h' + (c(D, k + 'broke') ? ', looked broken ' + c(D, k + 'broke') + 'x' : '')); }
    L.push('', 'What each search site\'s links turned out to be (a link found by two sites counts for both)');
    for (const e of ENG) { const v = k => c(D, 'engv.' + e + '.' + k); const tot = ['same', 'maybe', ...DROP.map(d => d[0])].reduce((a, k) => a + v(k), 0); if (!tot) continue;
      L.push('  ' + ENGN[e] + ': ' + num(tot) + ' links · Same ' + num(v('same')) + ' · Maybe ' + num(v('maybe')) + ' · Different ' + num(v('different') + v('logos')) + ' · could not be checked (picture blocked or unreadable) ' + num(v('cant')) + ' (' + (pct(v('cant'), tot) ?? 0) + '%, ' + num(v('cantOnly')) + ' found only by ' + ENGN[e] + ') · other reasons ' + num(tot - v('same') - v('maybe') - v('different') - v('logos') - v('cant'))); }
    const sites = Object.entries(D.s || {}).sort((a, b) => (b[1].f + b[1].s + b[1].b) - (a[1].f + a[1].s + a[1].b)).slice(0, 15);
    L.push('', 'Problems by website (failed / too slow / blocked us)');
    if (!sites.length) L.push('  None.'); else for (const [s, v] of sites) L.push('  ' + s + ': ' + v.f + ' / ' + v.s + ' / ' + v.b);
    L.push('', 'Helpers');
    for (const [k, l] of [['page', 'Their page check (during searches)'], ['own', 'No picture from the search site: read their page instead'], ['exact', 'Google said exact: read their page'], ['post', 'Post check (Copies found)'], ['acct', 'Account reader'], ['repost', 'Repost check'], ['owner', 'Who\'s behind this site']]) if (c(D, 'job.' + k + '.n')) L.push('  ' + l + ': ' + num(c(D, 'job.' + k + '.n')) + ' done, ' + ms(usual(D, 'job.' + k)) + ' usual, ' + num(c(D, 'job.' + k + '.fail')) + ' failed');
    const lim = Object.entries(D.c).filter(([k]) => k.startsWith('limit.'));
    if (lim.length) L.push('  Site limits: ' + lim.map(([k, n]) => k.replace('limit.rest.', 'rested ').replace('limit.held.', 'held for ') + ' ' + n).join(', '));
    const km = keepMinutes(D);
    L.push('', 'Keep searching (hours)');
    L.push('  Working ' + (km.work / 60).toFixed(1) + ' · stopped ' + (km.stop / 60).toFixed(1) + ' · off or outside hours ' + (km.off / 60).toFixed(1));
    for (const [s, n] of Object.entries(km.by).sort((a, b) => b[1] - a[1])) L.push('  ' + (KEEP[s] ? KEEP[s][0] : s) + ': ' + (n / 60).toFixed(1));
    const pauses = Object.entries(D.c).filter(([k]) => k.startsWith('keep.pause.'));
    if (pauses.length) L.push('  Times it stopped: ' + pauses.map(([k, n]) => (KEEP[k.slice(11)] || [k.slice(11)])[0].toLowerCase() + ' ' + n).join(', '));
    L.push('', 'Google Drive');
    for (const [k, l] of [['readNewFolders', 'Hourly check for new photos'], ['readEveryFolder', 'Weekly check of every folder'], ['openPhoto', 'Open one photo'], ['driveAnswer', 'Drive answers'], ['searchLine', 'Work out the next photo']]) { const x = t(D, 'drive.' + k); if (x) L.push('  ' + l + ': ' + ms(PP_STATS.usual(x)) + ' usual, ' + ms(x.x) + ' slowest, ' + num(x.n) + ' times'); }
    if (c(D, 'drive.openFailed')) L.push('  Photos Drive did not hand over: ' + num(c(D, 'drive.openFailed')));
    if (m.cover) {
      const f = m.cover.first, g = m.cover.groups;
      const perDay = c(D, 'photos') / Math.max(1, m.keys.filter(k => ![0, 6].includes(new Date(k + 'T12:00').getDay())).length);
      L.push('', 'Photos covered');
      L.push('  Searched at least once ' + num(f.done) + ' of ' + num(f.total) + ' (' + (pct(f.done, f.total) ?? 0) + '%) · never ' + num(f.never) + ' · cannot be searched ' + num(f.cant) + ' · first searches this week ' + num(f.week));
      L.push('  Up to date: priority ' + g.top[0] + '/' + g.top[1] + ', last 3 months ' + g.recent[0] + '/' + g.recent[1] + ', this year ' + g.year[0] + '/' + g.year[1] + ', older ' + g.older[0] + '/' + g.older[1]);
      if (perDay >= 1 && f.never) L.push('  At ' + Math.round(perDay) + ' photos a weekday, every photo is searched once in about ' + Math.max(1, Math.round(f.never / perDay / 21)) + ' months');
    }
    if (m.errors) {
      L.push('', 'What went wrong (problems PageProof handled quietly)');
      if (!m.errors.length) L.push('  Nothing recorded');
      for (const e of m.errors.slice(0, 20)) L.push('  ' + (e.kind === 'error' ? '[error] ' : '') + e.place + ': ' + num(e.n) + ' times on ' + e.days + (e.days === 1 ? ' day' : ' days') + ' · first ' + new Date(e.first).toLocaleString() + (e.msg ? ' · "' + e.msg + '"' : ''));
    }
    if (m.usage || m.saveFail) {
      const u = m.usage || {}, mb = b => (b == null ? 'not known' : (b / 1048576).toFixed(1) + ' MB');
      L.push('', 'Storage');
      L.push('  Settings and lists ' + mb(u.local) + ' (no limit: ' + (api.runtime.getManifest().permissions || []).includes('unlimitedStorage') + ') · everything ' + mb(u.all) + ' · kept safe from clean-up: ' + (u.persisted == null ? 'not known' : u.persisted ? 'yes' : 'no') + ' · failed saves: ' + (m.saveFail ? m.saveFail.n + ', last ' + new Date(m.saveFail.at).toLocaleString() : '0'));
    }
    if (typeof ntExtraRows === 'function') {
      L.push('', 'Extra searches');
      for (const r of ntExtraRows(D)) L.push('  ' + r.name + ': ' + r.work + ' · copies found ' + num(r.found) + ' · time ' + r.mins + ' min (' + r.worth + ')');
    }
    L.push('', 'Computer strain');
    L.push('  Searches slowed down: busy ' + num(c(D, 'strain.eased.busy')) + ', memory ' + num(c(D, 'strain.eased.memory')) + ', battery ' + num(c(D, 'strain.eased.battery')) + ' · Keep searching waited for a busy computer ' + Math.round((km.by.busy || 0)) + ' min · search pages restarted ' + num(c(D, 'strain.resumed')) + ' · highest page memory ' + ((D.x || {})['mem.page'] ? num(D.x['mem.page']) + ' MB' : 'not known'));
    return L;
  }
  // The JSON part: the raw daily numbers for the range, plus the same facts as above.
  function json(m) {
    const days = {}; for (const k of m.keys) if (m.days[k]) days[k] = m.days[k];
    return { pageproof: m.version, browser: m.browser, made: new Date().toISOString(), range: m.range, computer: m.hw ? { level: m.hw.level, cores: m.hw.cores, memGB: m.hw.memGB, limits: m.hw.limits } : null,
      keep: m.keep, fast: m.fast, gpu: m.gpu, test: m.test, copies: m.copies, cover: m.cover, alerts: m.alerts, errors: m.errors || null, usage: m.usage || null, saveFail: m.saveFail || null, days };
  }
  // Blanks anything that looks like one of your client names (and your own name), just in case.
  async function scrub(text) {
    let names = [];
    try { names = (await FC.DB.all('clients')).map(x => x.name); } catch (e) { /* none */ }
    try { const me = (await api.storage.local.get('lastCase')).lastCase || {}; names.push(me.collector); } catch (e) { /* none */ }
    for (const n of names.filter(n => n && String(n).trim().length >= 3).sort((a, b) => b.length - a.length)) {
      const re = new RegExp(String(n).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      text = text.replace(re, '[name]');
    }
    return text;
  }
  async function text(m) {
    const t = lines(m).join('\n') + '\n\n----- full numbers (for Claude) -----\n' + JSON.stringify(json(m)) + '\n';
    return scrub(t);
  }
  const fileName = (kind, d = new Date()) => 'pageproof-stats-' + (kind === 'week' ? 'week-' + keyOf(d) : keyOf(d) + '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0')) + '.txt';
  // Saves into Documents › PageProof › stats. Returns the file name, or '' when that folder isn't set up.
  async function saveToDocs(name, body) {
    try {
      if ((await RS_DOCS.state()) !== 'granted') return '';
      const d = await RS_DOCS.dir(); if (!d) return '';
      const sub = await d.getDirectoryHandle('stats', { create: true });
      const w = await (await sub.getFileHandle(name, { create: true })).createWritable();
      await w.write(body); await w.close();
      return name;
    } catch (e) { return ''; }
  }
  // Fridays at 5:30 PM (or the next time PageProof runs after that, that week): the last 7 days.
  function weeklyDue(now = new Date()) {
    const d = new Date(now); d.setHours(17, 30, 0, 0);
    const back = (d.getDay() - 5 + 7) % 7; d.setDate(d.getDate() - back);
    if (d > now) d.setDate(d.getDate() - 7);
    return d;
  }
  async function weeklyMaybe(now = new Date()) {
    const st = await PP_STATS.all();
    if (st.weeklyOff) return '';
    const due = weeklyDue(now);
    if (st.weekly && (st.weekly.due || st.weekly.at) >= +due) return '';
    if (now - due > 3.5 * DAY) return '';               // missed by days (computer off): wait for the next Friday
    if (!navigator.locks) return '';
    return navigator.locks.request('pp-stats-weekly', { ifAvailable: true }, async lock => {
      if (!lock) return '';
      const again = await PP_STATS.all(); if (again.weekly && (again.weekly.due || again.weekly.at) >= +due) return '';
      const m = await model('7');
      const name = await saveToDocs(fileName('week', due), await text(m));
      if (name) await PP_STATS.setMeta('weekly', { at: Date.now(), due: +due, name });
      return name;
    });
  }
  return { model, alerts, lines, json, text, scrub, fileName, saveToDocs, weeklyMaybe, weeklyDue, keepMinutes, KEEP, DROP, ENG, ENGN, ms, num, usual, c, t, pct, lastDays };
})();
