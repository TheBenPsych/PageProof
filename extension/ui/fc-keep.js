// Keep searching in the calm look (batch 5, Ben's picks 1 to 17): four tabs instead of one long
// page. Now (what is being searched, what is next, the search sites, the last searches),
// Progress (every photo searched once, kept up to date, the last days), Clients (every client)
// and Settings (Windows-Settings style rows). The workings are the same as before: every switch
// and button uses the same ACTS as the old page (fc-photos.js).
const KI = (() => {
  const s = (p, z = 16) => `<svg viewBox="0 0 16 16" width="${z}" height="${z}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  return {
    pause: s('<path d="M5.5 3.5v9M10.5 3.5v9"/>'), play: s('<path d="M5 3.2v9.6L12.6 8z"/>'),
    win: s('<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><path d="M1.5 5.5h13M4.5 11h3"/>'),
    search: s('<circle cx="7" cy="7" r="4.5"/><path d="M10.4 10.4 14 14"/>'),
    photo: s('<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><circle cx="5.5" cy="6.3" r="1.3"/><path d="m2 12 3.8-3.6 2.7 2.4 2.2-1.8L14 12"/>'),
    copies: s('<rect x="2" y="4.5" width="8" height="9" rx="1"/><path d="M5 4.5V3a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-3"/>'),
    gauge: s('<path d="M2.5 11.5a5.5 5.5 0 1 1 11 0"/><path d="M8 11.5 10.8 7"/>'),
    ring: s('<circle cx="8" cy="8" r="5.8"/><path d="M8 2.2a5.8 5.8 0 0 1 5.8 5.8"/>'),
    clock: s('<circle cx="8" cy="8" r="6.2"/><path d="M8 4.6V8l2.4 1.6"/>'),
    sweep: s('<path d="M2 13.5h12M4 13.5l1.2-5h5.6l1.2 5M6.5 8.5 8 2.5l1.5 6"/>'),
    credit: s('<path d="M3 3.5h10M3 6.5h10M3 9.5h6"/><circle cx="12" cy="11.5" r="2"/><path d="m13.4 12.9 1.1 1.1"/>'),
    eye: s('<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>'),
    chev: s('<path d="m6 3.5 4.5 4.5L6 12.5"/>', 14),
    cal: s('<rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 6.5h12M5 1.8v2.4M11 1.8v2.4"/>'),
    flag: s('<path d="M3.5 14V2.5M3.5 3h8l-1.8 3 1.8 3h-8"/>'),
    star: s('<path d="m8 2 1.8 3.8 4.1.5-3 2.8.8 4.1L8 11.2 4.3 13.2l.8-4.1-3-2.8 4.1-.5z"/>'),
    step: s('<path d="M2 13.5h3v-3h3v-3h3v-3h3"/>'),
    goal: s('<circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="3"/><circle cx="8" cy="8" r=".6" fill="currentColor"/>'),
    sun: s('<circle cx="8" cy="8" r="2.8"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"/>'),
    week: s('<rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 6.5h12M4.5 9h1M7.5 9h1M10.5 9h1M4.5 11.5h1M7.5 11.5h1"/>'),
    acct: s('<circle cx="8" cy="5.5" r="2.7"/><path d="M2.8 14c.6-2.8 2.7-4.3 5.2-4.3s4.6 1.5 5.2 4.3"/>'),
    share: s('<circle cx="8" cy="8" r="6"/><path d="M8 2v6l4.2 4.2"/>'),
    num: s('<path d="M3 5.5h10M3 10.5h10M6.3 2.5 5 13.5M11 2.5 9.7 13.5"/>'),
    list: s('<path d="M5.5 4h8M5.5 8h8M5.5 12h8"/><circle cx="2.6" cy="4" r=".6" fill="currentColor"/><circle cx="2.6" cy="8" r=".6" fill="currentColor"/><circle cx="2.6" cy="12" r=".6" fill="currentColor"/>'),
    info: s('<circle cx="8" cy="8" r="6.2"/><path d="M8 7.2v4M8 4.9v.2"/>'),
    warn: s('<path d="M8 1.8 1.5 13.5h13z"/><path d="M8 6.3v3.4M8 11.6v.2"/>'),
    tune: s('<path d="M2.5 4.5h6M11.5 4.5h2M2.5 11.5h2M7.5 11.5h6"/><circle cx="10" cy="4.5" r="1.5"/><circle cx="6" cy="11.5" r="1.5"/>'),
  };
})();
const KC = { blue: '#0067C0', green: '#0F7B0F', amber: '#C27C00', purple: '#8250DF', teal: '#00818A', red: '#C42B1C', grey: '#6E6E6E', pink: '#BF0077' };
const kSq = (c, i, z = 36) => `<span class="ksq" style="--c:${c};width:${z}px;height:${z}px">${i}</span>`;
const kRing2 = (f, z, w = 8, txt = '', label = '') => {
  f = Math.max(0, Math.min(1, f || 0));
  const r = z / 2 - w / 2 - 1, c = 2 * Math.PI * r;
  return `<span class="kring2" style="width:${z}px;height:${z}px" role="img" aria-label="${esc(label || Math.round(f * 100) + '%')}"><svg width="${z}" height="${z}" viewBox="0 0 ${z} ${z}" aria-hidden="true"><circle cx="${z / 2}" cy="${z / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${w}"/><circle cx="${z / 2}" cy="${z / 2}" r="${r}" fill="none" stroke="var(--accent)" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${z / 2} ${z / 2})"/></svg>${txt ? `<b>${txt}</b>` : ''}</span>`;
};
const kAv = name => {
  const s = String(name || '?'), ini = s.replace(/ -.*$/, '').split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase() || '?';
  let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `<span class="kav" style="--h:${h}" aria-hidden="true">${esc(ini)}</span>`;
};
const kSeg = (label, act, opts, cur, v = x => x) => `<div class="wseg kseg" role="radiogroup" aria-label="${esc(label)}">${opts.map(([val, l, title]) => `<button role="radio" aria-checked="${val === cur}" class="${val === cur ? 'on' : ''}" data-act="${act}" data-v="${esc(v(val))}"${title ? ` title="${esc(title)}"` : ''}>${l}</button>`).join('')}</div>`;
const kSwitch = (attrs, on, label) => `<label class="switch"><input type="checkbox" ${attrs} aria-label="${esc(label)}" ${on ? 'checked' : ''}><span></span></label><span class="wswl">${on ? 'On' : 'Off'}</span>`;
const KEEP_TABS = ['now', 'progress', 'clients', 'settings'];
const KENG = { google: ['g', 'G'], yandex: ['y', 'Y'], bing: ['b', 'B'] };
const KSOC = { 'instagram.com': ['ig', 'IG'], 'facebook.com': ['fb', 'f'], 'x.com': ['x', 'X'], 'tiktok.com': ['tt', 'TT'], 'threads.net': ['x', '@'], 'linkedin.com': ['fb', 'in'], 'pinterest.com': ['y', 'P'], 'tumblr.com': ['x', 't'], 'youtube.com': ['y', '▶'] };
const kDay = iso => new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

// Up next: a look at the line without taking anything from it. The line can take a moment to
// build on a big library, so the page never waits long for it: it shows when it is ready.
let KEEP_NEXT = null, KEEP_NEXT_P = null;
async function keepUpNext(skipId) {
  if (KEEP_NEXT && Date.now() - KEEP_NEXT.at < 20000) return KEEP_NEXT.list;
  if (!KEEP_NEXT_P) {
    KEEP_NEXT_P = (async () => {
      try {
        const ps = await FC.next(6, new Set(skipId ? [skipId] : []), { solo: false });
        const clients = new Map((await FC.DB.all('clients')).map(c => [c.name, c]));
        const list = [];
        for (const p of ps.slice(0, 5)) {
          const c = clients.get(p.client);
          const why = p.flag === 'hi' ? '⚑ High priority' : p.hot ? 'Copies just found' : c && c.priority ? '★ Priority client' : !FC.searchedOnce(p) ? 'First search' : p.stolen ? 'Stolen before' : 'Keeping up to date';
          let thumb = ''; try { thumb = await FC.thumbOf(p) || ''; } catch (e) { /* no picture kept */ }
          list.push({ id: p.id, name: p.name || '', client: p.client || '', why, thumb });
        }
        KEEP_NEXT = { at: Date.now(), list };
      } catch (e) { KEEP_NEXT = { at: Date.now(), list: [] }; }
      KEEP_NEXT_P = null;
      return KEEP_NEXT.list;
    })();
  }
  const late = Symbol('late');
  const got = await Promise.race([KEEP_NEXT_P, new Promise(r => setTimeout(() => r(late), 1500))]);
  if (got !== late) return got;
  // Not ready yet: draw without it, and once more when it is there.
  KEEP_NEXT_P && KEEP_NEXT_P.then(() => { if (state.shown === 'keep' && (state.keepTab || 'now') === 'now') renderAuto(); });
  return KEEP_NEXT ? KEEP_NEXT.list : null;
}
// The account details reader: is it on, and what is it doing now.
async function keepAcctInfo() {
  const st = await api.storage.local.get(['ppAcctRead', 'fcAcctRead', 'fcAcctLimits']);
  const on = st.ppAcctRead !== false, a = st.fcAcctRead || {}, L = st.fcAcctLimits || {};
  const name = x => x === 'x' ? 'X' : x.replace(/\.com$/, '').replace(/^./, c => c.toUpperCase());
  const resting = Object.entries(L).filter(([, v]) => v.restUntil > Date.now()).map(([k, v]) => name(k) + ' until ' + kClock(v.restUntil));
  // Sites that said "too many requests" (429) and are left alone for a while.
  if (globalThis.PP_PACE) for (const r of PP_PACE.rests()) if (!resting.some(x => x.startsWith(r.name + ' '))) resting.push(r.name + ' until ' + kClock(r.until) + ' (it said too many requests)');
  const fresh = a.beat && Date.now() - a.beat < 10 * 60000;
  const now = !on ? 'Off: account details are only read when you press "Read again now" on an account.'
    : fresh && (a.state === 'reading' || a.state === 'resting') && a.total ? 'Reading account details ' + Math.min(a.done + 1, a.total) + ' of ' + a.total + '.'
    : fresh && a.state === 'held' && a.why === 'paused' ? 'Paused with Keep searching.'
    : fresh && a.state === 'held' && a.why === 'hours' ? 'Waiting for your hours.'
    : fresh && a.state === 'held' && a.why === 'limit' ? 'Had enough for now: carries on at ' + kClock(a.until) + '.'
    : 'Followers, check mark, type and country of each social account, once a month.';
  return { on, now: now + (resting.length ? ' Resting now: ' + resting.join(', ') + '.' : '') };
}

V.keep = async () => {
  if (routeArg('start50')) { history.replaceState(null, '', '#keep'); setTimeout(() => ACTS.fifty(), 300); }
  if (routeArg('clients')) history.replaceState(null, '', '#keep?tab=clients');
  // The address says which tab is open, so a reload (or an update) opens the same one.
  const TAB = state.keepTab = KEEP_TABS.includes(routeArg('tab')) ? routeArg('tab') : 'now';
  const [k, cov, hw, store] = [await FC.keep(), await FC.coverage(), await ppHardware(), await api.storage.local.get(['fcStatus', 'fcToday', 'fcRest', 'fcPause', 'fcFifty', 'fcLadder', 'fcRecent', 'fcDays', 'rsSettings', 'fcReopened'])];
  const st = store.fcStatus, lad = store.fcLadder || null;
  const alive = !!(st && Date.now() - st.beat < 90000);
  const s = !k.on ? 'off' : store.fcPause ? 'paused' : alive ? st.state : st && st.state === 'closed' ? 'closed' : 'waiting';
  const [tl] = STATE_TAG[s] || ['Starting', 'grey'];
  const today = store.fcToday && store.fcToday.day === new Date().toDateString() ? store.fcToday : { searched: 0, found: 0 };
  const F = cov.first, G = cov.groups;
  const rate = firstPerDay(k, hw, F.week, await FC.speed(), lad);
  const sp = rate.sp || {};
  const ORDER = ['Gentle', 'Steady', 'Faster'];
  const pace = ORDER[Math.min(ORDER.indexOf(k.pace), ORDER.indexOf(hw.limits.pace))] || 'Steady';
  const hrs = k.hours === 'all' ? 24 : Math.max(1, k.to - k.from);
  const perDay = Math.round(rate.ladOn ? rate.googlePerDay : 60 / FC.PACE[pace] * hrs);
  const share = [2, 3, 4].includes(k.firstShare) ? k.firstShare : 3;
  const rows = firstClientRows(F);
  const pct = F.total ? Math.floor(F.done / F.total * 100) : 100;
  const q = Math.max(F.quick || 0, F.done), qpct = F.total ? Math.floor(q / F.total * 100) : 100;
  const by = firstDoneBy(F.never, rate), qby = firstDoneBy(F.total - q, { perDay: rate.quickPerDay, weekdays: rate.weekdays });
  const bare = t => String(t || '').replace('~ ', '');
  const goal = FC.goalPlan(k, F.never, hw.limits.pace);
  const fifty = !!(store.fcFifty && store.fcFifty.beat && store.fcFifty.running !== false && Date.now() - store.fcFifty.beat < 5 * 60000);

  // ---- control line: the tabs, then on/off, Pause and Show search window
  const tabs = [['now', 'Now'], ['progress', 'Progress'], ['clients', 'Clients', rows.length], ['settings', 'Settings']];
  const ctl = `<div class="rvn-ctl kctl"><div class="utabs" role="tablist" aria-label="Keep searching">${tabs.map(([v, l, c]) => `<button role="tab" aria-selected="${v === TAB}" class="${v === TAB ? 'on' : ''}" data-act="keeptab" data-v="${v}">${l}${c ? ` <span>${c}</span>` : ''}</button>`).join('')}</div><span class="sp"></span>
    <div class="konoff"><label class="switch"><input type="checkbox" data-act="keepon" aria-label="Keep searching" ${k.on ? 'checked' : ''}><span></span></label><span class="wswl" id="keepState">${k.on ? 'On' : 'Off'}</span></div>
    ${k.on ? `<button class="btn kbtn" data-act="keeppause">${store.fcPause ? KI.play + 'Resume' : KI.pause + 'Pause'}</button><button class="btn kbtn" data-act="keepshow">${KI.win}Show search window</button>` : ''}</div>`;

  // ---- info bars (the old banners)
  let bars = await driveBanner();
  if (k.on && !store.fcPause && st && st.state === 'closed') bars += `<div class="kbar warn" role="alert">${kSq(KC.amber, KI.warn, 28)}<div><b>Keep searching is stopped</b><span>Its search window was closed, so no new photos are being searched.</span></div><span class="sp"></span><button class="btn primary" data-act="keepshow">${KI.play}Start it again</button></div>`;
  const ro = store.fcReopened;
  if (ro && ro.at && !ro.seen && Date.now() - ro.at <= 3 * 3600000) bars += `<div class="kbar info" role="status" id="keepReopened">${kSq(KC.blue, KI.info, 28)}<div><b>The search window was closed, so PageProof opened it again</b><span>It carried on where it was at ${kClock(ro.at)}. Nothing was lost.</span></div><span class="sp"></span><button class="btn" data-act="reopenpause">${KI.pause}Pause searching</button><button class="btn" data-act="reopenok">OK</button></div>`;

  let body = '';
  // ================================================================ NOW
  if (TAB === 'now') {
    const cur = alive && st.current ? st.current : null;
    const next = await keepUpNext(cur && cur.id);
    const clients = new Map((await FC.DB.all('clients')).map(c => [c.name, c]));
    const parts = cur ? String(cur.sub || '').split(' · ') : [];
    const chips = cur ? `<div class="kchips">${parts[0] ? `<span class="kchip">${kAv(parts[0])}${esc(parts[0])}</span>` : ''}${parts.slice(1).map(x => `<span class="kchip pl">${esc(x.replace(/^on /, ''))}</span>`).join('')}${clients.get(parts[0]) && clients.get(parts[0]).priority ? `<span class="kchip">${KI.star}Priority client</span>` : ''}</div>` : '';
    const top = [60, 40, 30].includes(+k.ladderTop) ? +k.ladderTop : 40, nSteps = FC.LADDER.indexOf(top) + 1, gStep = lad && lad.g ? lad.g.step + 1 : 1;
    const offText = { off: 'Turn it on and PageProof searches your clients\' photos in the background while you work. You can stop it any time.', paused: 'Paused by you. Press Resume and it carries on where it was.', closed: 'Its search window was closed, so no new photos are being searched.' }[s];
    const hero = `<section class="card khero" id="keepNow">
      ${cur ? `<img class="kbig" src="${safeImg(cur.thumb)}" alt="">` : `<span class="kbig none">${KI.photo}</span>`}
      <div class="khm">
        <span class="klive${s === 'running' ? '' : ' idle ' + s}">${s === 'running' ? '<span class="kpulse2"></span>Searching now' : esc(tl)}</span>
        <h2>${cur ? esc(cur.name) : s === 'off' ? 'Keep searching is off' : esc(offText ? tl : alive ? st.text || tl : 'Starting the search window…')}</h2>
        ${chips}
        ${!cur && offText ? `<p class="kmuted">${esc(offText)}</p>` : ''}
        ${k.on ? `<div class="kmeta"><span>${KI.clock}1 photo every ${secWords(Math.round(rate.gSec))} on Google, every ${secWords(Math.round(rate.fSec))} on Yandex and Bing</span><span>${KI.step}${rate.ladOn ? `Speed step ${gStep} of ${nSteps}` : esc(pace) + ' pace'} · about ${perDay.toLocaleString()} photos a day</span></div>` : ''}
      </div>
      <div class="knext"><div class="kh3">Up next <span>in about this order</span></div>
        ${next == null ? '<p class="kfaint">Working out the line…</p>' : next.length ? next.map(p => `<div class="knr">${p.thumb ? `<img src="${safeImg(p.thumb)}" alt="">` : `<span class="knph">${KI.photo}</span>`}<span class="kn1"><b title="${esc(p.name)}">${esc(p.name)}</b><span>${esc(p.client)} · <span class="kwhy">${esc(p.why)}</span></span></span></div>`).join('') : '<p class="kfaint">Nothing is due right now. Every photo is up to date.</p>'}
      </div></section>`;
    // Search sites: a light, today's count and when a resting site comes back.
    const broken = await FC.brokenEngines(), rest = Object.fromEntries(Object.entries(store.fcRest || {}).filter(([, t]) => t > Date.now()));
    const engOn = ((store.rsSettings || {}).engines) || {}, engN = today.eng || {};
    const engRows = ['google', 'yandex', 'bing'].map(e => {
      const off = engOn[e] === false;
      const [c, t] = off ? ['off', 'Off'] : broken[e] ? ['bad', 'May have stopped'] : rest[e] ? ['warn', 'Rests until ' + kClock(rest[e])] : ['ok', 'Working'];
      const sub = off ? 'Switched off in Settings' : broken[e] ? 'Found nothing for a while. Tried again at ' + kClock(broken[e]) : rest[e] ? 'Asked "are you a robot?" at ' + kClock(rest[e] - 3600000) : e === 'google' ? 'Full search of every photo' : 'Quick look at every photo';
      return `<div class="ksr e" data-e="${e}"><span class="keng big ${KENG[e][0]}" aria-hidden="true">${KENG[e][1]}</span><span class="kn1"><b>${esc(FC.ENGINE_NAME[e])}</b><span>${esc(sub)}</span></span><span class="kst ${c}"><i></i>${esc(t)}</span><span class="kcnt num">${(engN[e] || 0).toLocaleString()} today</span></div>`;
    }).join('');
    let socRows = '', socMore = 0;
    if (globalThis.PP_PACE) {
      const all = await PP_PACE.load(), now = Date.now(), dayS = new Date().toDateString();
      const main = ['instagram.com', 'facebook.com', 'x.com', 'tiktok.com'];
      const sites = Object.keys(PP_PACE.GAP), shown = sites.filter(x => main.includes(x) || ((all[x] || {}).until > now));
      socMore = sites.length - shown.length;
      socRows = shown.map(site => {
        const v = all[site] || {}, n = v.day === dayS ? v.n || 0 : 0, cap = PP_PACE.DAY[site], cool = v.until > now, full = n >= cap;
        const sub = cool ? `Said "too many requests" at ${kClock(v.restAt || now)}${v.strikes > 1 ? ', time ' + v.strikes + ' today' : ''}` : `1 page every ${PP_PACE.GAP[site] / 1000} s`;
        const [c, t] = cool ? ['warn', 'Cooling down until ' + kClock(v.until)] : full ? ['warn', 'Enough for today'] : ['ok', 'Working'];
        const [cls, l] = KSOC[site] || ['x', '?'];
        return `<div class="ksr s" data-s="${esc(site)}"><span class="keng big ${cls}" aria-hidden="true">${l}</span><span class="kn1"><b>${esc(PP_PACE.nameOf(site))}</b><span>${esc(sub)}</span></span><span class="kst ${c}"><i></i>${esc(t)}</span><span class="kcnt num">${n.toLocaleString()} of ${cap.toLocaleString()} today</span></div>`;
      }).join('');
    }
    const sites = `<section class="card ksites" id="keepSites"><div class="kscol"><div class="kh2">Search sites <a href="#health">Why a site may stop</a></div>${engRows}
      <p class="kfoot">PageProof never tries to get past a robot check. That site rests for an hour and the others carry on.</p></div>
      <div class="kscol"><div class="kh2">Social media${socMore > 0 ? ` <span class="kfaint">+ ${socMore} more working</span>` : ''}</div>${socRows}
      <p class="kfoot">After "too many requests" a site rests 1 hour, then 2, 4, 8, up to 12. It clears by itself.</p></div></section>`;
    const tiles = `<div class="ktiles2" id="keepTiles">
      ${[[KC.blue, KI.search, today.searched.toLocaleString(), 'Photos searched today', today.quick ? `+${today.quick.toLocaleString()} quick looks on Yandex and Bing` : 'Full searches with Google'],
        [KC.green, KI.copies, today.found.toLocaleString(), 'New copies today', '<a href="#found">See them in All copies ›</a>'],
        [KC.purple, KI.gauge, '~' + perDay.toLocaleString(), 'Photos a day at this speed', sp.days ? `This week: ${Math.round(sp.full).toLocaleString()} a day` : 'Shown after the first day'],
        [KC.teal, KI.ring, pct + '%', 'Every photo searched once', `${F.done.toLocaleString()} of ${F.total.toLocaleString()} · <a data-act="keeptab" data-v="progress" href="#keep?tab=progress">Progress ›</a>`]]
        .map(([c, i, b, l, x]) => `<div class="card kt2">${kSq(c, i, 40)}<span><b class="num">${b}</b><span class="l">${l}</span><span class="s">${x}</span></span></div>`).join('')}</div>`;
    const rec = (store.fcRecent || []).filter(r => r && r.at);
    const found = r => r.fresh > 0 ? ['acc', plural(r.fresh, 'new copy', 'new copies')] : r.links > 0 ? ['ok', 'Only copies seen before'] : ['', 'Nothing found'];
    const recent = `<section class="card krecent" id="keepRecent"><div class="kh2">Last searches <span class="kfaint">${plural(today.searched, 'photo')} today</span><a href="#searches">All searches ›</a></div>
      ${rec.length ? `<div class="krh"><span>Time</span><span>Photo</span><span>Client</span><span>Search site</span><span>What it found</span></div>
      ${rec.map(r => { const [c, w] = found(r); return `<div class="krr"><span class="kfaint num">${esc(new Date(r.at).toDateString() === new Date().toDateString() ? kClock(r.at) : shortDate(new Date(r.at).toISOString()))}</span><span class="kph">${r.thumb ? `<img src="${safeImg(r.thumb)}" alt="">` : `<span class="knph">${KI.photo}</span>`}<b title="${esc(r.name)}">${esc(r.name)}</b></span><span class="kcl">${esc(r.client || 'Client unknown')}</span><span class="kfaint">${esc((r.eng || []).map(e => FC.ENGINE_NAME[e] || e).join(', ') || r.by || '')}${r.quick ? ' · quick look' : ''}</span><span><span class="ktag ${c}">${esc(w)}</span></span></div>`; }).join('')}`
      : '<p class="kmuted">No searches yet. Each photo shows up here as soon as its search is done, with what it found.</p>'}</section>`;
    let fiftyJob = null;
    if (fifty && store.fcFifty.id) try {
      const j = await RS_DB.get('jobs', store.fcFifty.id);
      if (j && j.pics) { const d = j.pics.filter(p => Object.values(p.runs).every(r => !['wait', 'go', 'captcha'].includes(r.state))).length; fiftyJob = { done: d, total: j.pics.length, left: j.pics.length - d > 0 ? Math.max(1, Math.round((j.pics.length - d) * 0.6)) + ' min' : '' }; }
    } catch (e) { /* no job yet */ }
    let nextStart = 'Starts when you press the button';
    if (k.fiftyAuto && /^\d\d:\d\d$/.test(k.fiftyTime || '')) {
      const d = new Date(), [h, m] = k.fiftyTime.split(':').map(Number);
      d.setHours(h, m, 0, 0);
      while (d.getTime() <= Date.now() || d.getDay() % 6 === 0) d.setDate(d.getDate() + 1);
      const t = new Date(); const tm = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1).toDateString();
      nextStart = 'Next start: ' + (d.toDateString() === t.toDateString() ? 'today' : d.toDateString() === tm ? 'tomorrow' : d.toLocaleDateString(undefined, { weekday: 'long' })) + ' ' + kClock(d.getTime());
    }
    const fiftyCard = `<section class="card kfifty" id="keepFifty"><div class="kh2">Today's ${k.perDay}${fifty ? ' <span class="ktag ok">Running now</span>' : ''}</div>
      ${fifty && fiftyJob ? `<div class="kf1">${kRing2(fiftyJob.total ? fiftyJob.done / fiftyJob.total : 0, 56, 6, Math.round(fiftyJob.total ? fiftyJob.done / fiftyJob.total * 100 : 0) + '%', fiftyJob.done + ' of ' + fiftyJob.total + ' done')}<span><b>${fiftyJob.done} of ${fiftyJob.total} photos searched</b><span>${fiftyJob.left ? 'About ' + fiftyJob.left + ' left' : 'Finishing up'} · <a href="#searches">See it in All searches</a></span></span></div>`
      : `<div class="kf1">${kSq(KC.blue, KI.cal, 44)}<span><b>${esc(nextStart)}</b><span>${k.fiftyAuto ? 'Starts by itself on weekdays · ' : ''}${k.perDay} photos · ${k.fiftyWhich === 'first' ? 'Never searched first' : 'Next in line'}</span></span></div>`}
      <p class="kmuted">A bigger batch in the background. Takes ${esc(hw.limits.fifty)} on this computer. Keep searching goes at half speed while it runs.</p>
      <div class="kf2"><button class="btn primary kbtn big" data-act="fifty"${fifty ? ' disabled data-why="Today\'s check is already running. It carries on by itself."' : ''}>${KI.play}Check ${k.perDay} now</button><button class="btn kbtn" data-act="keeptab" data-v="settings">${KI.tune}Change</button></div></section>`;
    let extras = '';
    if (typeof ntKeepExtraRows === 'function') {
      const ex = await ntKeepExtraRows(), look = { sweep: [KC.amber, KI.sweep], credit: [KC.purple, KI.credit], watch: [KC.teal, KI.eye] };
      extras = `<section class="card kextra" id="keepExtras"><div class="kh2">Extra searches <span class="kfaint">Between photo searches</span><a href="#stats">7 and 30 days ›</a></div>
        ${ex.map(r => `<a class="kxr" href="${r.href}" title="Last 7 days: ${esc(r.work)}">${kSq(look[r.k][0], look[r.k][1], 32)}<span class="kn1"><b>${esc(r.name)}</b><span>${r.now}</span></span><span class="kxn"><b class="num">${r.found.toLocaleString()}</b><span>found · ${r.mins.toLocaleString()} min</span></span>${KI.chev}</a>`).join('')}
        </section>`;
    }
    body = `<div class="kgrid now"><div class="kga">${hero}</div><div class="kgb">${sites}</div></div>${tiles}<div class="kgrid now2"><div class="kga">${recent}</div><div class="kgb kstack">${fiftyCard}${extras}</div></div>`;
  }

  // ================================================================ PROGRESS
  if (TAB === 'progress') {
    const goalTag = !F.never ? ['ok', 'Every photo searched once'] : !goal ? ['acc', 'In progress'] : goal.done ? ['ok', 'Goal met'] : goal.onTrack ? ['ok', 'On track'] : ['warn', 'Behind your goal'];
    const goalLine = !goal ? `<div class="kgoal none">${KI.goal}<span>No goal date set. Set one and PageProof works out the pace for you.</span><a data-act="keeptab" data-v="settings" href="#keep?tab=settings">Set a goal</a></div>`
      : `<div class="kgoal${goal.done || goal.onTrack ? ' ok' : ''}">${KI.goal}<span><b>Goal: ${esc(kDay(k.goal))}.</b> ${goal.done ? 'Every photo has had its first search.' : goal.onTrack ? `${goal.never.toLocaleString()} photos to go, about ${goal.perDay.toLocaleString()} a work day.` : `${goal.never.toLocaleString()} photos to go is too many for that date at the fastest safe pace. At that pace it is done about ${esc(kDay(goal.eta))}. Today's ${k.perDay} helps catch up.`}</span><a data-act="keeptab" data-v="settings" href="#keep?tab=settings">Change goal</a></div>`;
    const firstCard = `<section class="card kfirst" id="firstBox">
      <div class="kfl">${kRing2(F.total ? F.done / F.total : 1, 196, 14, pct + '%', pct + '% searched once')}<span class="kfaint">searched once</span></div>
      <div class="kfm">
        <div class="kh2" style="margin:0">Every photo searched once <span class="ktag ${goalTag[0]}">${goalTag[1]}</span></div>
        <div class="kbigline"><b class="num">${F.done.toLocaleString()}</b><span class="num">of ${F.total.toLocaleString()} photos searched at least once</span></div>
        <div class="klane"><span class="kll">Google</span><span class="kbar2"><i style="width:${F.total ? F.done / F.total * 100 : 100}%"></i></span><span class="kfaint num">${pct}%${by && by !== 'Done' ? ' · done about ' + esc(bare(by)) : ''}</span></div>
        <div class="klane" id="quickRow"><span class="kll">Quick look ${kInfo('Yandex and Bing give every photo a quick look first, in their own lane, so nothing waits months for a first check. A photo counts as searched once when Google has searched it too. A copy found in a quick look sends the photo to Google next.')}</span><span class="kbar2 q"><i style="width:${F.total ? q / F.total * 100 : 100}%"></i></span><span class="kfaint num">${q.toLocaleString()} of ${F.total.toLocaleString()} · ${qpct}% · Yandex + Bing${qby && qby !== 'Done' ? ' · all by ' + esc(bare(qby)) : ''}</span></div>
        ${goalLine}
      </div>
      <div class="kfr">
        ${[[KC.blue, KI.photo, F.never.toLocaleString(), 'never searched yet', ''],
          [KC.purple, KI.gauge, sp.days ? Math.round(sp.full).toLocaleString() : '—', sp.days ? 'photos searched a day this week (+' + Math.round(sp.quick).toLocaleString() + ' quick looks) · ' + F.week.toLocaleString() + ' first searches in 7 days' : 'photos a day: shown after the first day of searching', 'speedStat'],
          [KC.teal, KI.cal, esc(bare(by) || '—'), by === 'Done' ? 'new photos join by themselves' : by ? 'all done at this pace' : 'turn on Keep searching for a date', ''],
          [KC.grey, KI.info, F.cant.toLocaleString(), 'can\'t be searched (POOL, TIFF, HEIC, broken)' + (F.cant ? ' · <a href="#skipped">See them</a>' : ''), '']]
          .map(([c, i, b, x, id]) => `<div class="kmini"${id ? ` id="${id}"` : ''}>${kSq(c, i, 32)}<span><b class="num">${b}</b><span>${x}</span></span></div>`).join('')}
      </div></section>`;
    const grp = [['⚑ High priority and ★ priority clients', G.top, 'Every 3 to 7 days'], ['Newest photos', G.recent, 'Every month · this and last quarter'], ['This year', G.year, 'Every 6 months'], ['Older photos', G.older, 'Once a year']];
    const fresh = `<section class="kfresh" id="keepFresh"><div class="kh2 out">Kept up to date <span class="kfaint">${cov.quiet.toLocaleString()} quiet photos are searched less often · ${cov.doubles.toLocaleString()} doubles go with their twin</span></div>
      <div class="k4">${grp.map(([l, [a, b], x]) => `<div class="card kgr">${kRing2(b ? a / b : 1, 92, 9, (b ? Math.round(a / b * 100) : 100) + '%', l + ': ' + a + ' of ' + b + ' up to date')}<span><b>${l}</b><span class="kfaint">${x}</span><span class="kfaint num">${a.toLocaleString()} of ${b.toLocaleString()} up to date</span></span></div>`).join('')}</div></section>`;
    const shared = `<section class="card kshare" id="keepShare"><div class="kh2">How the searches are shared</div>
      ${F.never ? `<div class="kln"><span class="kll">Google</span><div class="ksb sharebar" role="img" aria-label="Google: High priority first, then 1 in ${share} searches for never-searched photos, the rest keep photos up to date"><span class="s1" style="flex:.45">⚑ High first</span><span class="s2" style="flex:1">1 in ${share}: never searched</span><span class="s3" style="flex:${share - 1}">The rest: keeping photos up to date</span></div></div>
      <div class="kln"><span class="kll">Yandex + Bing</span><div class="ksb sharebar" id="quickLane" role="img" aria-label="Yandex and Bing: a quick look at every never-searched photo first, then re-searches"><span class="s4" style="flex:${Math.max(1, F.total - q)}">Quick look at never-searched</span><span class="s3" style="flex:${Math.max(1, Math.round(F.total / 6))}">then re-searches</span></div></div>
      <p class="kmuted">The two lanes run side by side. Inside each client, 2 of every 3 first searches are its newest photos and 1 comes from a random older year.</p>`
      : '<p class="kmuted">Every photo has had its first search, so all searches go to keeping photos up to date. When new photos arrive, they get their share again.</p>'}
      <div class="kshset"><span class="kfaint">Share for never-searched photos</span>${kSeg('Share for never-searched photos', 'firstshare', [[4, '1 in 4'], [3, '1 in 3'], [2, '1 in 2']], share)}</div></section>`;
    const order = `<section class="card korder" id="keepOrder"><div class="kh2">Which photos go first</div><ol>
      ${[[KC.red, KI.flag, '⚑ High priority photos', 'Next in line, then every 3 days'], [KC.amber, KI.star, '★ Priority clients', 'Right after'], [KC.blue, KI.sun, 'Newest photos', 'By year, quarter and day'], [KC.purple, KI.star, 'Popular and stolen before', 'Every 7 days'], [KC.teal, KI.clock, 'Everything else', 'The longest-waiting first'], [KC.grey, KI.week, 'Quiet photos', 'Last']].map(([c, i, b, x], j) => `<li><span class="kon">${j + 1}</span>${kSq(c, i, 30)}<span><b>${b}</b><span>${x}</span></span></li>`).join('')}</ol>
      <p class="kmuted">On top of that, 1 in ${share} searches goes to a photo that was never searched, until there are none left.</p></section>`;
    const days = Object.entries(store.fcDays || {}).filter(([, v]) => v && (v.full || v.quick)).sort(([a], [b]) => a.localeCompare(b)).slice(-7);
    const mx = Math.max(1, ...days.map(([, v]) => Math.max(v.full || 0, v.quick || 0)));
    const dkey = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
    const week = `<section class="card kweek" id="keepWeek"><div class="kh2">Last 7 days of searching <span class="kfaint">Full searches, quick looks and new copies found</span><span class="klegend"><i class="g"></i>Google searches<i class="q"></i>Quick looks<i class="c"></i>New copies</span></div>
      ${days.length ? `<div class="kchart" style="grid-template-columns:repeat(${days.length},1fr)">${days.map(([d, v]) => `<div class="kday"><div class="kbars"><span class="g" style="height:${(v.full || 0) / mx * 100}%"><em>${(v.full || 0).toLocaleString()}</em></span><span class="q" style="height:${(v.quick || 0) / mx * 100}%"><em>${(v.quick || 0).toLocaleString()}</em></span></div><span class="kc">${v.found != null ? v.found.toLocaleString() + ' new' : '&nbsp;'}</span><span class="kd">${d === dkey ? 'Today' : esc(new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }))}</span></div>`).join('')}</div>`
      : '<p class="kmuted">Shown after the first day of searching.</p>'}</section>`;
    body = `${firstCard}${fresh}<div class="kgrid two">${shared}${order}</div>${week}
      <p class="kfaint" style="margin:0">New photos you add to Google Drive are picked up within the hour and join the never-searched photos by themselves.</p>`;
  }

  // ================================================================ CLIENTS
  if (TAB === 'clients') {
    const cf = ['all', 'pri', 'open'].includes(state.keepCf) ? state.keepCf : 'all', sort = state.keepSort || 'low', qq = (state.keepQ || '').toLowerCase();
    const sorts = { low: (a, b) => a.d / a.t - b.d / b.t || b.left - a.left, high: (a, b) => b.d / b.t - a.d / a.t || a.left - b.left, name: (a, b) => a.name.localeCompare(b.name), left: (a, b) => b.left - a.left };
    const list = rows.filter(r => cf === 'pri' ? r.pri : cf === 'open' ? r.left > 0 : true).sort(sorts[sort] || sorts.low);
    const doneN = rows.filter(r => r.left <= 0).length;
    body = `<div class="kclhead"><label class="ksearch">${KI.search}<input type="search" id="keepQ" placeholder="Find a client" aria-label="Find a client" value="${esc(state.keepQ || '')}"></label>
      ${kSeg('Which clients', 'keepcf', [['all', `All <span>${rows.length}</span>`], ['pri', `★ Priority <span>${rows.filter(r => r.pri).length}</span>`], ['open', `Not done <span>${rows.length - doneN}</span>`]], cf)}<span class="sp"></span>
      <label class="ksort"><span class="kfaint">Sort</span><select data-act="keepsort" aria-label="Sort clients">${[['low', 'Lowest first'], ['high', 'Highest first'], ['left', 'Most left to search'], ['name', 'Name A to Z']].map(([v, l]) => `<option value="${v}" ${sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <section class="card kcl" id="firstClients">${list.length ? `<div class="kch"><span>Client</span><span>Searched once</span><span></span><span>Never searched</span><span>Can't search</span><span>Done by</span><span></span></div>
      ${list.map(r => { const db = firstDoneBy(r.need, rate); return `<a class="kcr" href="#photos" data-act="cphotos" data-v="${esc(r.name)}" data-name="${esc(r.name.toLowerCase())}"${qq && !r.name.toLowerCase().includes(qq) ? ' hidden' : ''}>${kAv(r.name)}<span class="kcn">${r.pri ? '<span class="kstar" title="Priority client">★</span>' : ''}<b>${esc(r.name)}</b></span><span class="num">${r.d.toLocaleString()} <span class="kfaint">of ${r.t.toLocaleString()}</span></span><span class="kbar2 sm${r.left <= 0 ? ' ok' : ''}"><i style="width:${r.d / r.t * 100}%"></i></span><span class="num">${r.left.toLocaleString()}</span><span class="num kfaint">${r.cant ? r.cant.toLocaleString() : '—'}</span><span>${r.left <= 0 ? '<span class="ktag ok">All searched once</span>' : esc(bare(db) || 'Turn on Keep searching')}</span>${KI.chev}</a>`; }).join('')}
      <p class="kmuted knone" id="keepNone" hidden>No client with that name.</p>`
      : `<p class="kmuted" style="padding:16px 24px">${rows.length ? 'No clients here.' : 'No photos yet.'}</p>`}</section>`;
  }

  // ================================================================ SETTINGS
  if (TAB === 'settings') {
    const row = (c, i, t, d, ctrl, extra = '', id = '') => `<div class="ksr2"${id ? ` id="${id}"` : ''}>${typeof i === 'string' && i.startsWith('<span class="keng') ? i : kSq(c, i, 36)}<span class="kn1"><b>${t}</b><span>${d}</span></span><span class="kctl2">${ctrl}</span>${extra}</div>`;
    const top = [60, 40, 30].includes(+k.ladderTop) ? +k.ladderTop : 40, nn = FC.LADDER.indexOf(top) + 1;
    const g = lad && lad.g ? lad.g : { step: 0 }, f = lad && lad.f ? lad.f : { step: 0 };
    const dropped = lad && lad.g && lad.g.day === new Date().toDateString() && lad.g.drops;
    const ladOn = k.ladder !== false;
    const ladder = pace !== 'Faster' ? '' : row(KC.purple, KI.step, 'Speed ladder', 'On Faster, it speeds up one step after every hour without a robot check. If a site asks, it rests an hour and comes back two steps slower for the day.',
      `${ladOn ? `<span class="ktag ${dropped ? 'warn' : 'ok'}">Step ${g.step + 1} of ${nn}</span>` : '<span class="kfaint">Off: 1 photo every 2 min</span>'}${kSwitch('data-act="keepladder"', ladOn, 'Speed ladder')}`,
      ladOn ? `<div class="ksub"><div class="ladder kladder" role="img" aria-label="Speed step ${g.step + 1} of ${nn}">${FC.LADDER.slice(0, nn).map((sec, i) => `<span class="${i <= g.step ? 'on' : ''}" style="height:${30 + i * 70 / Math.max(1, nn - 1)}%"><small>${secWords(sec)}</small></span>`).join('')}</div>
        <span class="kmuted">Now: Google 1 photo every ${secWords(FC.LADDER[g.step])}, Yandex and Bing every ${secWords(FC.LADDER[f.step] / 2)}. About ${Math.round(rate.googlePerDay).toLocaleString()} Google searches a day.${dropped ? ' A site asked "are you a robot" today, so it stays at this step until tomorrow.' : g.step < nn - 1 ? ' Next step after an hour with no robot check.' : ''}</span>
        <span class="kfastest"><span class="kfaint">Fastest step</span>${kSeg('Fastest step', 'laddertop', [[60, '60 s'], [40, '40 s'], [30, '30 s']], top)}</span></div>` : '', 'ladderBox');
    const min = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    const gTag = !goal ? '' : goal.done ? '<span class="ktag ok">Goal met</span>' : goal.onTrack ? '<span class="ktag ok">On track</span>' : '<span class="ktag warn">Behind</span>';
    const gText = !goal ? 'Set a date and PageProof works out the pace for you, never faster than is safe.'
      : goal.done ? 'Every photo has had its first search, so the pace above is used again.'
      : goal.onTrack ? `${goal.never.toLocaleString()} photos to go, about ${goal.perDay.toLocaleString()} a work day: 1 photo every ${Math.round(goal.gap * 10) / 10} minutes. This replaces the pace above.`
      : `${goal.never.toLocaleString()} photos to go is too many for ${esc(kDay(k.goal))} at the fastest safe pace. At that pace it would be done about ${esc(kDay(goal.eta))}. PageProof goes as fast as is safe meanwhile.`;
    const hourOpts = Array.from({ length: 24 }, (_, h) => h), hl = h => new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' });
    const hsel = (which, label) => `<select data-act="keepnum" data-v="${which}" aria-label="${label}">${hourOpts.map(h => `<option value="${h}" ${k[which] === h ? 'selected' : ''}>${hl(h)}</option>`).join('')}</select>`;
    const place = (await api.storage.local.get('ppSearchPlace').catch(() => ({}))).ppSearchPlace === 'pinned' ? 'pinned' : 'window';
    const acct = await keepAcctInfo();
    const engOn = ((store.rsSettings || {}).engines) || {};
    body = `<div class="kgrid two kset">
      <div class="kcol">
        <div class="kgh">Speed</div>
        <section class="card kgroup">
          ${row(KC.blue, KI.gauge, 'Pace', `Gentle: 1 photo every ${FC.PACE.Gentle} min · Steady: every ${FC.PACE.Steady} min · Faster: every ${FC.PACE.Faster} min${pace !== k.pace ? `<br>Your computer is ${esc(hw.level)}, so it goes ${pace}. <a href="#computer">Computer check</a>` : ''}`, kSeg('Pace', 'keepset', Object.entries(FC.PACE).map(([p, m]) => [p, p, '1 photo every ' + m + ' minutes']), k.pace, p => 'pace|' + p))}
          ${ladder}
          ${row(KC.teal, KI.goal, 'Goal: every photo searched once by', gText, `${gTag}<input type="date" class="kdate" min="${min}" value="${esc(k.goal || '')}" data-act="keepgoal" aria-label="Goal date">${k.goal ? '<button class="btn kbtn" data-act="keepgoaloff">No goal</button>' : ''}`, '', 'goalBox')}
        </section>
        <div class="kgh">When</div>
        <section class="card kgroup">
          ${row(KC.amber, KI.clock, 'Hours', 'Searches only run inside these hours', kSeg('Hours', 'keepset', [['work', 'Work hours'], ['all', 'All day and night']], k.hours, h => 'hours|' + h))}
          ${k.hours === 'work' ? row(KC.amber, KI.sun, 'From and to', 'Your work hours', `${hsel('from', 'From')}<span class="kfaint">to</span>${hsel('to', 'To')}`) + row(KC.amber, KI.week, 'Weekdays only', 'No searching on Saturday and Sunday', kSwitch('data-act="keepwd"', k.weekdays, 'Weekdays only')) : ''}
        </section>
        <div class="kgh">Search sites</div>
        <section class="card kgroup" id="keepEngines">
          ${[['google', 'Full search. A photo counts as searched once after Google'], ['yandex', 'Quick look lane, good at faces and crops'], ['bing', 'Quick look lane, finds news and shop sites']].map(([e, d]) => row('', `<span class="keng big ${KENG[e][0]}" aria-hidden="true">${KENG[e][1]}</span>`, esc(FC.ENGINE_NAME[e]), d, kSwitch(`data-act="keepeng" data-v="${e}"`, engOn[e] !== false, FC.ENGINE_NAME[e]))).join('')}
        </section>
      </div>
      <div class="kcol">
        <div class="kgh">Where and what</div>
        <section class="card kgroup">
          ${row(KC.blue, KI.win, 'Where searches run', 'A separate minimized window keeps your own window clear. It opens by itself for a robot check.', kSeg('Where searches run', 'searchplace', [['window', 'Separate minimized window'], ['pinned', 'Pinned tabs']], place))}
          ${row(KC.pink, KI.acct, 'Read account details', esc(acct.now), kSwitch('id="acctread" data-act="acctread"', acct.on, 'Read account details'))}
          ${row(KC.green, KI.share, 'Share for never-searched photos', '⚑ High priority photos always go first', kSeg('Share for never-searched photos', 'firstshare', [[4, '1 in 4'], [3, '1 in 3'], [2, '1 in 2']], share))}
        </section>
        <div class="kgh">Today's ${k.perDay}</div>
        <section class="card kgroup">
          ${row(KC.blue, KI.num, 'How many', 'A bigger batch, in the background', `<select data-act="keepnum" data-v="perDay" aria-label="How many photos">${[10, 25, 50, 75, 100].map(n => `<option value="${n}" ${k.perDay === n ? 'selected' : ''}>${n}</option>`).join('')}</select>`)}
          ${row(KC.blue, KI.list, 'Which photos', 'Next in line, or never-searched photos first', kSeg('Which photos', 'fiftywhich', [['next', 'Next in line'], ['first', 'Never searched first']], k.fiftyWhich === 'first' ? 'first' : 'next'))}
          ${row(KC.blue, KI.cal, 'Start by itself every weekday', 'Keep searching goes at half speed while it runs', `<input type="time" class="kdate" value="${esc(k.fiftyTime)}" data-act="keeptime" aria-label="Start time">${kSwitch('data-act="keepauto"', k.fiftyAuto, 'Start by itself every weekday')}`)}
        </section>
      </div></div>`;
  }

  const hd = head('Copies found', 'Keep searching', '', '').replace('<div class="head">', '<div class="head rvhead">');
  return `${hd}<div class="rvn kpn" data-tab="${TAB}">${ctl}${bars}${body}</div>`;
};
V.keep.guard = V.found.guard;
V.keep.after = () => {
  const i = document.getElementById('keepQ');
  if (!i) return;
  // Find a client: rows are shown and hidden in place, so typing is never interrupted.
  i.oninput = () => {
    state.keepQ = i.value;
    const q = i.value.trim().toLowerCase();
    let n = 0;
    for (const r of document.querySelectorAll('#firstClients .kcr')) { const hit = !q || r.dataset.name.includes(q); r.hidden = !hit; if (hit) n++; }
    const none = document.getElementById('keepNone'); if (none) none.hidden = n > 0;
  };
};
Object.assign(ACTS, {
  keeptab: v => {
    state.keepTab = KEEP_TABS.includes(v) ? v : 'now';
    history.replaceState(null, '', '#keep' + (state.keepTab === 'now' ? '' : '?tab=' + state.keepTab));
    render(true).then(() => window.scrollTo(0, 0));
  },
  keepcf: v => { state.keepCf = v; render(true); },
  keepsort: (v, el) => { state.keepSort = el.value; render(true); },
  // A search site on or off, for every search (the same switches as on New search). One always stays on.
  keepeng: async (v, el) => {
    const s = (await api.storage.local.get('rsSettings')).rsSettings || {};
    const eng = { google: true, yandex: true, bing: true, ...(s.engines || {}) };
    eng[v] = !!el.checked;
    if (!Object.values(eng).some(Boolean)) { toast('One search site has to stay on.'); return render(true); }
    await api.storage.local.set({ rsSettings: { ...s, engines: eng } });
    toast((FC.ENGINE_NAME[v] || v) + (el.checked ? ' is on.' : ' is off. No photo is searched there until you turn it on again.'));
    render(true);
  },
});
