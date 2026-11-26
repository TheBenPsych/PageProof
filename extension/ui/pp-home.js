// 4.45 Home (Ben's picks): "Since you were last here" and clients falling behind. Loaded after
// app.js (it adds lines to Home's "What to do now" list).
(() => {
  const AWAY = 4 * 3600000;
  const when = t => { const d = new Date(t); return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' }); };

  // What changed since the last visit (first Home of the day, or after 4 hours away). Worked out
  // after Home has drawn, once, and kept until OK.
  async function buildSince(from) {
    const items = [];
    const iso = new Date(from).toISOString();
    const copies = (await FC.allCopies()).filter(c => !FC.hiddenCopy(c, RS_LISTS.hidden) && (c.firstSeen || '') > iso);
    const fresh = copies.filter(c => c.status === 'new' || c.auto);
    const stolenBases = new Set((await FC.allCopies()).filter(c => c.status === 'stolen').map(c => FC.baseOf(c.site)));
    const again = fresh.filter(c => c.status === 'new' && stolenBases.has(FC.baseOf(c.site)));
    if (fresh.length) items.push(['copy', fresh.length.toLocaleString() + (fresh.length === 1 ? ' new copy found' : ' new copies found') + (again.length ? ', ' + again.length + ' on sites you marked Stolen before' : ''), '#found']);
    const auto = copies.filter(c => c.status === 'licensed' && c.auto).length;
    if (auto) items.push(['ok', plural(auto, 'copy was', 'copies were') + ' filed as Licensed by your approved sites', '#found?filter=Licensed']);
    const fin = (await FC.firstNotes()).filter(n => n.at > iso);
    if (fin.length) items.push(['ok', esc(fin.map(n => n.name).slice(0, 3).join(', ')) + (fin.length > 3 ? ' and more' : '') + (fin.length === 1 ? ' now has' : ' now have') + ' every photo searched once', '#keep?clients=1']);
    const st = await api.storage.local.get(['fcEngines', 'fcRest', 'fcDriveBack', 'fcReopened', 'ppCheckup', 'fcToday']);
    for (const [e, h] of Object.entries(st.fcEngines || {})) if (h && h.brokenAt > from) items.push(['warn', esc(FC.ENGINE_NAME[e] || e) + ' stopped giving results at ' + esc(when(h.brokenAt)) + ' and rested for 6 hours', '#health']);
    for (const [e, t] of Object.entries(st.fcRest || {})) if (t > from + 3600000) items.push(['warn', esc(FC.ENGINE_NAME[e] || e) + ' asked "are you a robot?", so it rested an hour (until ' + esc(when(t)) + ')', '#keep']);
    if (st.fcDriveBack && st.fcDriveBack > from) items.push(['warn', 'Google Drive could not be reached for a while; searching picked up again at ' + esc(when(st.fcDriveBack)), '#keep']);
    if (st.fcReopened && st.fcReopened.at > from) items.push(['warn', 'The searching tab was closed at ' + esc(when(st.fcReopened.at)) + ' and PageProof opened it again', '#keep']);
    const c = st.ppCheckup;
    if (c && c.at > from && !c.ok) items.push(['bad', 'The check-up after the update found ' + plural(c.items.filter(i => !i[1]).length, 'problem'), '#health']);
    const w = typeof FC_RULES !== 'undefined' ? await FC_RULES.weakNote() : null;
    if (w && Date.parse(w.at) > from) items.push(['ok', plural(w.n, 'weak Maybe was', 'weak Maybes were') + ' put away by themselves', '#found?filter=Removed']);
    if (typeof FC_RULES !== 'undefined') for (const s of Object.values(await FC_RULES.sweeps())) if (s.done && Date.parse(s.done) > from) items.push([s.found ? 'copy' : 'ok', 'The sweep of ' + esc(s.base) + ' finished: ' + (s.found ? plural(s.found, 'more photo') + ' found' : 'nothing more found'), '#found']);
    return items;
  }
  async function maybeSince() {
    const { ppLastHome: last, ppSince: cur } = await api.storage.local.get(['ppLastHome', 'ppSince']);
    const now = Date.now();
    if (cur && !cur.seen && now - cur.at < 3 * 864e5) return;      // the card is still up
    await api.storage.local.set({ ppLastHome: now });
    if (!last || (now - last < AWAY && new Date(last).toDateString() === new Date(now).toDateString())) return;
    const items = await buildSince(last);
    if (!items.length) return;
    await api.storage.local.set({ ppSince: { from: last, at: now, items, seen: false } });
    if (typeof PP_STATS !== 'undefined') PP_STATS.add('home.since');
    if (state.shown === 'home') render(true);
  }
  function sinceCard(s) {
    const dot = { copy: 'var(--copy)', ok: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--bad)' };
    const open = !!state.sinceOpen, n = s.items.length;
    return { lvl: 'info', id: 'jobSince', icon: 'check', title: 'While you were away',
      sub: `${n} ${n === 1 ? 'thing' : 'things'} happened since ${esc(when(s.from))}` + (open ? '<span class="hsince">' + s.items.map(([k, t, href]) => `<a href="${href}"><i style="background:${dot[k] || 'var(--faint)'}"></i>${t}</a>`).join('') + '</span>' : ''),
      btn: { act: 'sinceshow', label: open ? 'Hide ▴' : 'Show ▾' }, btn2: { act: 'sinceok', label: 'OK' } };
  }

  // Clients falling behind: a ★ priority client not searched in 10 days (or switched off), and
  // the goal date that can't be met.
  async function behind() {
    const out = [];
    const clients = await FC.DB.all('clients'), miss = await FC.missingPicks(), now = Date.now();
    const late = [];
    for (const c of clients) {
      if (!c.priority) continue;
      const age = c.lastSearched ? (now - Date.parse(c.lastSearched)) / 864e5 : (c.scanned ? (now - Date.parse(c.scanned)) / 864e5 : 0);
      let why = '';
      if (c.searching !== true) why = 'searching is switched off for it';
      else if (miss.some(m => c.rel && (c.rel === m.rel || c.rel.startsWith(m.rel + '/')))) why = 'its folder can\'t be found in Google Drive';
      else if (!c.photos) why = 'no photos were found in its folder';
      else if (age >= 10) why = 'not searched for ' + Math.floor(age) + ' days: other photos went first, so it needs more search time';
      if (why) late.push([c.name, why]);
    }
    if (late.length) out.push({ lvl: 'warn', id: 'jobBehind', title: late.length === 1 ? '★ ' + esc(late[0][0]) + ' is falling behind' : late.length + ' ★ priority clients are falling behind',
      sub: late.slice(0, 4).map(([n, w]) => '<b>' + esc(n) + '</b>: ' + esc(w)).join(' · ') + '.', btn: { href: '#clients', label: 'Clients and photos' } });
    try {
      const k = await FC.keep();
      if (k.on && k.goal) {
        const F = (await api.storage.local.get('fcFirst')).fcFirst;
        const g = F && FC.goalPlan(k, F.never, (await ppHardware()).limits.pace);
        if (g && !g.done && !g.onTrack) out.push({ lvl: 'warn', id: 'jobGoal', title: 'Behind your goal for every photo\'s first search', sub: g.never.toLocaleString() + ' photos to go by ' + esc(new Date(g.goal + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })) + '. At the fastest safe pace it ends about ' + esc(new Date(g.eta + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })) + '. Today\'s 50 helps catch up.', btn: { href: '#keep', label: 'Keep searching' } });
      }
    } catch (e) { /* no goal */ }
    return out;
  }

  const before = homeFinds;
  // eslint-disable-next-line no-global-assign
  homeFinds = async function () {
    const r = await before.apply(this, arguments);
    try {
      const s = (await api.storage.local.get('ppSince')).ppSince;
      const extra = await behind();
      const okAt = r.jobs.findIndex(j => j.lvl === 'ok' || j.lvl === 'info');
      if (okAt < 0) r.jobs.push(...extra); else r.jobs.splice(okAt, 0, ...extra);
      if (s && !s.seen) r.jobs.unshift(sinceCard(s));
    } catch (e) { console.warn('PageProof Home extras:', e); }
    return r;
  };
  const after = V.home.after;
  V.home.after = async function () { if (after) await after.apply(this, arguments); maybeSince().catch(e => console.warn('PageProof since you were last here:', e)); };
  Object.assign(ACTS, { sinceshow: () => { state.sinceOpen = !state.sinceOpen; render(true); }, sinceok: async () => { state.sinceOpen = false; const s = (await api.storage.local.get('ppSince')).ppSince; if (s) await api.storage.local.set({ ppSince: { ...s, seen: true }, ppLastHome: Date.now() }); render(true); } });
  globalThis.PP_HOME = { buildSince, behind, maybeSince };
})();
