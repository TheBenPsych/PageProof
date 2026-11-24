// 4.39 safety nets on Home (Ben's picks):
//  - Check-up after every update: about a minute after a new version first opens, PageProof
//    quietly checks the photo checker (built-in test), opening one Drive photo, saving to the
//    browser, the timestamp services and the three search sites' pages (opened, never searched).
//    Home then says "everything checked" or exactly what broke.
//  - A ticked photo folder that Drive can't find any more (renamed, moved or deleted).
//  - Photos that moved in Drive and kept their history.
// Loaded after app.js: it adds its lines to the top of Home's "What to do now" list.
(() => {
  const SITES = [['Google Lens', 'https://www.google.com/imghp?hl=en'], ['Yandex', 'https://yandex.com/images/'], ['Bing', 'https://www.bing.com/images']];
  const late = (p, ms, v) => Promise.race([p, new Promise(r => setTimeout(() => r(v), ms))]);
  let running = false;

  async function checkup() {
    if (running) return;
    running = true;
    const items = [];
    const add = (name, ok, note) => items.push([name, !!ok, note || '']);
    try {
      await api.storage.local.set({ ppCheckup: { ver: VERSION, running: Date.now() } });
      if (typeof render === 'function' && state.shown === 'home') render(true);
      // Saving to the browser.
      try {
        const v = String(Date.now());
        await api.storage.local.set({ ppCheckProbe: v });
        const back = (await api.storage.local.get('ppCheckProbe')).ppCheckProbe;
        await api.storage.local.remove('ppCheckProbe');
        add('Saving to the browser', back === v, back === v ? '' : 'What was saved did not come back');
      } catch (e) { add('Saving to the browser', false, PP_GUARD.clean(e.message || e)); }
      // One photo from Google Drive (only when the photos are connected).
      try {
        if ((await FC.drive()).done && (await FC.driveState(false)) === 'granted') {
          const ps = (await FC.DB.all('photos')).filter(p => !p.gone && !p.unreadable && !/\.(tiff?|heic|heif)$/i.test(p.name || ''));
          const p = ps[Math.floor(Math.random() * ps.length)];
          if (p) { const f = await late(FC.fileFor(p).catch(e => ({ err: e })), 20000, { err: { message: 'Drive took over 20 seconds' } }); add('Opening a photo from Google Drive', f && !f.err && f.size > 0, f && f.err ? PP_GUARD.clean(f.err.message || f.err) : ''); }
        }
      } catch (e) { add('Opening a photo from Google Drive', false, PP_GUARD.clean(e.message || e)); }
      // Trusted timestamps (only a random fingerprint is sent, as for every capture).
      try {
        if (typeof PP_TSA !== 'undefined') {
          const r = await PP_TSA.stampAll(crypto.getRandomValues(new Uint8Array(32)));
          const main = r.filter(t => !t.spare), bad = main.filter(t => t.error);
          add('Trusted timestamps', bad.length < main.length, main.length - bad.length + ' of ' + main.length + ' answered' + (bad.length ? ' (' + bad.map(t => t.service).join(', ') + ' did not)' : ''));
        }
      } catch (e) { add('Trusted timestamps', false, PP_GUARD.clean(e.message || e)); }
      // The search sites' pages load (nothing is searched).
      for (const [name, url] of SITES) {
        const r = await late(fetch(url, { cache: 'no-store' }).then(x => ({ ok: x.ok, s: x.status }), e => ({ ok: false, s: e.message })), 15000, { ok: false, s: 'no answer in 15 seconds' });
        add(name + ' page', r.ok, r.ok ? '' : 'Answered ' + r.s);
      }
      // The photo checker's built-in test (the longest part, about 30 seconds).
      try {
        if (typeof PP_SELFTEST !== 'undefined') {
          const t = await PP_SELFTEST.run();
          add('Photo checker test', t.right === t.n, t.right + ' of ' + t.n + ' right');
        }
      } catch (e) { add('Photo checker test', false, PP_GUARD.clean(e.message || e)); }
    } finally {
      running = false;
      const bad = items.filter(i => !i[1]);
      await api.storage.local.set({ ppCheckup: { ver: VERSION, at: Date.now(), items, ok: !bad.length, seen: false } }).catch(() => {});
      if (typeof PP_STATS !== 'undefined') { PP_STATS.add('checkup.runs'); if (bad.length) PP_STATS.add('checkup.bad'); }
      for (const b of bad) console.warn('PageProof check-up: ' + b[0] + ' failed', b[2]);
      if (typeof render === 'function' && state.shown === 'home') render(true);
    }
  }
  // Starts once per version, 20 seconds after Home first shows (so Home draws straight away).
  // Only after a real update (the "PageProof was updated" banner is still showing).
  async function maybeStart() {
    const { ppCheckup: c, ppSeenVersion: seen } = await api.storage.local.get(['ppCheckup', 'ppSeenVersion']);
    if (seen === VERSION) return;
    if (c && c.ver === VERSION && (c.at || (c.running && Date.now() - c.running < 10 * 60000))) return;
    setTimeout(() => {
      if (!navigator.locks) return checkup();
      navigator.locks.request('pp-checkup', { ifAvailable: true }, async l => { if (l) await checkup(); });
    }, 20000);
  }

  const jobs = async () => {
    const out = [];
    try {
      const c = (await api.storage.local.get('ppCheckup')).ppCheckup;
      if (c && c.ver === VERSION) {
        if (!c.at) out.push({ lvl: 'info', id: 'checkupRun', icon: 'check', title: 'Checking the new version', sub: 'About a minute: the photo checker, Google Drive, saving, timestamps and the search sites.' });
        else if (!c.ok && !c.seen) out.push({ lvl: 'bad', id: 'checkupBad', title: 'Updated to ' + VERSION + ', but ' + (c.items.filter(i => !i[1]).length === 1 ? 'one thing' : c.items.filter(i => !i[1]).length + ' things') + ' did not work',
          sub: c.items.filter(i => !i[1]).map(i => esc(i[0]) + (i[2] ? ' (' + esc(i[2]) + ')' : '')).join(' · ') + '. Save stats for Claude (Settings › How PageProof is doing) to get it fixed.',
          btn: { act: 'checkupagain', label: 'Check again', main: 1 }, btn2: { act: 'checkupseen', label: 'OK' } });
        else if (!c.seen) out.push({ lvl: 'info', id: 'checkupOk', icon: 'check', title: 'Updated to ' + VERSION + ': everything checked', sub: c.items.map(i => esc(i[0])).join(' · '), btn2: { act: 'checkupseen', label: 'OK' } });
      }
      const miss = await FC.missingPicks();
      if (miss.length) out.push({ lvl: 'bad', id: 'jobMissing', title: miss.length === 1 ? 'A photo folder you ticked can\'t be found in Google Drive' : miss.length + ' photo folders you ticked can\'t be found in Google Drive',
        sub: esc(miss.slice(0, 3).map(m => m.rel.split('/').pop()).join(', ')) + (miss.length > 3 ? ' and more' : '') + '. Renamed or moved? Pick it again so its photos keep being searched.', btn: { href: '#connect', label: 'Pick it again', main: 1 } });
      const mv = await FC.movedNote();
      if (mv && !mv.seen && Date.now() - Date.parse(mv.at) < 7 * 864e5) out.push({ lvl: 'info', id: 'jobMoved', icon: 'check', title: mv.n.toLocaleString() + (mv.n === 1 ? ' photo was' : ' photos were') + ' moved or renamed in Google Drive',
        sub: 'PageProof recognised ' + (mv.n === 1 ? 'it' : 'them') + ', so their copies, answers and search dates were kept.', btn2: { act: 'movedseen', label: 'OK' } });
    } catch (e) { console.warn('PageProof check-up lines:', e); }
    return out;
  };

  const before = homeFinds;
  // eslint-disable-next-line no-global-assign
  homeFinds = async function () {
    const r = await before.apply(this, arguments);
    const extra = await jobs();
    const okAt = r.jobs.findIndex(j => j.lvl === 'ok'), rest = okAt < 0 ? r.jobs : r.jobs.slice(0, okAt), oks = okAt < 0 ? [] : r.jobs.slice(okAt);
    r.jobs = extra.filter(j => j.lvl === 'bad').concat(rest, extra.filter(j => j.lvl !== 'bad'), oks);
    return r;
  };
  const after = V.home.after;
  V.home.after = async function () { if (after) await after.apply(this, arguments); maybeStart().catch(() => {}); };

  Object.assign(ACTS, {
    checkupseen: async () => { const c = (await api.storage.local.get('ppCheckup')).ppCheckup; if (c) await api.storage.local.set({ ppCheckup: { ...c, seen: true } }); render(true); },
    checkupagain: async () => { await api.storage.local.remove('ppCheckup'); toast('Checking again. It takes about a minute.'); checkup(); },
    movedseen: async () => { const m = await FC.movedNote(); if (m) await FC.meta.set('movedNote', { ...m, seen: true }); render(true); },
  });
  globalThis.PP_CHECKUP = { run: checkup };
})();
