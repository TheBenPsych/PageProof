// 4.43 Copies found (Ben's picks): rule suggestions above the list, the weak Maybes note and sweeps
// on Home. The work itself is in fc-rules.js. Loaded after ui/fc-found.js and ui/pp-checkup.js.
(() => {
  let SUG = [];
  const TEXT = {
    hide: s => [`You removed ${s.n} copies on ${esc(s.site)} this month`, `Hide this site? It never shows again in any search.${s.fresh ? ' Its ' + plural(s.fresh, 'new copy', 'new copies') + ' go too.' : ''} Copies you marked Stolen there stay.`, 'Hide this site'],
    partner: s => [`You marked ${s.n} copies on ${esc(s.site)} Licensed for ${esc(s.client)}`, `Approve it for ${esc(s.client)}? Its copies of their photos are then Licensed by themselves${s.fresh ? ', including the ' + plural(s.fresh, 'new one', 'new ones') + ' now' : ''}. Other clients are not affected.`, 'Approve for ' + esc(s.client)],
    own: s => [`Is ${esc(s.site)} ${esc(s.client)}'s own site?`, `Its name looks like theirs. Yes approves it for ${esc(s.client)} only, so the ${plural(s.n, 'copy', 'copies')} there ${s.n === 1 ? 'is' : 'are'} Licensed and new ones never land in New.`, 'Yes, their own site'],
    sweep: s => [`Check ${esc(s.site)} for more of ${esc(s.client)}'s photos?`, `You marked a copy there Stolen. PageProof can read the site's own list of pages and pictures, slowly and in your hours, and compare each picture with ${esc(s.client)}'s photos. No Google, Yandex or Bing searches are used. Anything found shows in New as "Found by sweep".`, 'Sweep the site'],
  };
  function banner() {
    if (!SUG.length) return '';
    return SUG.map((s, i) => {
      const [t, sub, yes] = TEXT[s.kind](s);
      return `<div class="banner info" role="status" id="rule${i}"><div style="flex:1 1 300px;min-width:0"><b>${t}</b><div style="font-size:13px">${sub}</div></div>
        <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn primary sm" data-act="ruleyes" data-v="${i}">${yes}</button><button class="btn sm" data-act="rulelater" data-v="${i}">Not now</button><button class="btn sm" data-act="ruleno" data-v="${i}">${s.kind === 'own' ? 'No' : 'Never ask for this site'}</button></div></div>`;
    }).join('');
  }
  const before = V.found;
  V.found = async function () {
    const html = await before.apply(this, arguments);
    try { SUG = state.fTab === 'social' ? [] : await FC_RULES.suggestions(); } catch (e) { console.warn('PageProof rule suggestions:', e); SUG = []; }
    const at = html.indexOf('<section class="card found-card">');
    return at < 0 ? banner() + html : html.slice(0, at) + banner() + html.slice(at);
  };
  Object.assign(V.found, { guard: before.guard, after: before.after });

  // Home: weak Maybes put away, sweeps running or finished.
  const home = homeFinds;
  // eslint-disable-next-line no-global-assign
  homeFinds = async function () {
    const r = await home.apply(this, arguments);
    const extra = [];
    try {
      const w = await FC_RULES.weakNote();
      if (w && !w.seen && Date.now() - Date.parse(w.at) < 7 * 864e5) extra.push({ lvl: 'info', id: 'jobWeak', icon: 'check', title: plural(w.n, 'weak Maybe', 'weak Maybes') + ' put away by themselves',
        sub: 'Maybes under 50% that nobody answered for 30 days moved to Removed ("Weak Maybe, never answered"). Put any back from Copies found › Removed.', btn: { href: '#found?filter=Removed', label: 'See them' }, btn2: { act: 'weakseen', label: 'OK' } });
      for (const s of Object.values(await FC_RULES.sweeps())) {
        if (s.state === 'running' || s.state === 'queued') extra.push({ lvl: 'info', id: 'jobSweep', icon: 'find', title: 'Sweeping ' + esc(s.base) + ' for more of ' + esc(s.client) + '\'s photos',
          sub: (s.state === 'queued' ? 'Starts with Keep searching, in your hours.' : s.checked.toLocaleString() + ' pictures checked') + (s.found ? ' · ' + plural(s.found, 'match', 'matches') + ' so far' : '') + '.', btn2: { act: 'sweepstop', label: 'Stop', v: s.base } });
        else if (s.state === 'done' && !s.seen) extra.push({ lvl: s.found ? 'warn' : 'info', id: 'jobSweepDone', icon: 'find', title: 'Sweep of ' + esc(s.base) + ': ' + (s.found ? plural(s.found, 'more photo', 'more photos') + ' found' : 'nothing more found'),
          sub: s.checked.toLocaleString() + ' pictures checked against ' + plural(s.looks || 0, 'photo') + ' of ' + esc(s.client) + (s.checked ? '' : '. The site gave no list of its pictures') + '.', btn: s.found ? { href: '#found', label: 'Look at them', main: 1 } : null, btn2: { act: 'sweepseen', label: 'OK', v: s.base } });
      }
    } catch (e) { console.warn('PageProof Home sweeps:', e); }
    const okAt = r.jobs.findIndex(j => j.lvl === 'ok');
    if (okAt < 0) r.jobs.push(...extra); else r.jobs.splice(okAt, 0, ...extra);
    return r;
  };

  const sweepSet = async (base, ch) => { const all = await FC_RULES.sweeps(); if (all[base]) { all[base] = { ...all[base], ...ch }; await FC.meta.set('sweeps', all); } };
  Object.assign(ACTS, {
    ruleyes: async v => {
      const s = SUG[+v]; if (!s) return;
      if (s.kind === 'hide') { await FC_RULES.accept(s); await hideSite(s.site); render(true); return; }
      const undo = await FC_RULES.accept(s);
      dropFC();
      const msg = s.kind === 'sweep' ? 'Sweep of ' + s.site + ' starts with Keep searching. Home shows how far it is.' : s.site + ' approved for ' + s.client + '.';
      HIST.push({ label: msg.replace(/\.$/, ''), undo: async () => { await undo(); dropFC(); } });
      toastUndo(msg);
      render(true);
    },
    rulelater: async v => { const s = SUG[+v]; if (s) await FC_RULES.later(s); render(true); },
    ruleno: async v => { const s = SUG[+v]; if (s) await FC_RULES.never(s); render(true); },
    weakseen: async () => { await FC_RULES.weakSeen(); render(true); },
    sweepstop: async v => { await sweepSet(v, { state: 'done', done: new Date().toISOString(), stopped: 1 }); render(true); },
    sweepseen: async v => { await sweepSet(v, { seen: true }); render(true); },
  });
})();
