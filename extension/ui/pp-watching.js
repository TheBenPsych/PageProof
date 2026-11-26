// Copies found › Watching in the calm look (design batch 9, both rounds). Four tabs in the
// address (#watching?tab=sites|accts|off, &open=<key> for the panel): the check running now with
// Stop, what needs a look, four tiles, the turns (weekly, monthly, every 3 months), this hour's
// shared slot, the list with a panel per site or account, and how it works.
// The watching itself is PP_WATCH in fc-watch.js; this file only shows it and saves the settings.
const WATCH_TABS = ['all', 'sites', 'accts', 'off'];
const WA = { q: '', sort: 'stolen', how: false, barOff: false, menu: '', more: 50, liveHtml: '', stopping: '' };
const WAI = (() => {
  const s = (p, z = 16) => `<svg viewBox="0 0 16 16" width="${z}" height="${z}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  return {
    s,
    page: s('<path d="M4 1.8h5.5L12.5 5v9.2H4z"/><path d="M9.5 1.8V5h3M6 8h4.5M6 10.5h4.5"/>'),
    stop: s('<rect x="4" y="4" width="8" height="8" rx="1"/>'),
    play: s('<path d="M5 3.2v9.6L12.6 8z"/>'),
    ext: s('<path d="M9 2.5h4.5V7M13.5 2.5 7.5 8.5M12 9.5V13a.5.5 0 0 1-.5.5h-8.5a.5.5 0 0 1-.5-.5V4.5a.5.5 0 0 1 .5-.5H7"/>'),
    x: s('<path d="M4 4l8 8M12 4l-8 8"/>', 14),
    plus: s('<path d="M8 3v10M3 8h10"/>'),
    check: s('<path d="m3 8.5 3.2 3L13 4.5"/>'),
    more: s('<circle cx="3.5" cy="8" r=".9" fill="currentColor"/><circle cx="8" cy="8" r=".9" fill="currentColor"/><circle cx="12.5" cy="8" r=".9" fill="currentColor"/>'),
    warn: s('<path d="M8 2 14.5 13.5h-13z"/><path d="M8 6.5v3.2M8 11.6v.2"/>'),
    key: s('<circle cx="5" cy="10.5" r="2.8"/><path d="m7 8.5 6-6M11 4.5l1.8 1.8M9.5 6l1.3 1.3"/>'),
    retry: s('<path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v3h-3"/>'),
    bin: s('<path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4"/>'),
    pause: s('<path d="M5.5 3.5v9M10.5 3.5v9"/>'),
    feed: s('<path d="M3 3a10 10 0 0 1 10 10M3 7a6 6 0 0 1 6 6"/><circle cx="3.8" cy="12.2" r="1"/>'),
    map: s('<path d="M2 3.5h12M2 8h12M2 12.5h12M5 3.5v9"/>'),
    person: s('<circle cx="8" cy="5.5" r="2.6"/><path d="M3 14c.6-2.8 2.6-4.2 5-4.2s4.4 1.4 5 4.2"/>', 13),
    pics: s('<rect x="1.8" y="3" width="12.4" height="10" rx="1.2"/><circle cx="5.5" cy="6.5" r="1.2"/><path d="m2 12 4-3.5 3 2.5 2-1.5 3 2.5"/>'),
    pc: s('<rect x="2" y="3" width="12" height="8" rx="1"/><path d="M6 14h4M8 11v3"/>'),
  };
})();
// Platform pictures: a globe for a website, each social site's own colour.
const WA_PLAT = {
  Website: ['#0067C0', WAI.s('<circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c2 2 2.6 4 2.6 6S10 12 8 14M8 2C6 4 5.4 6 5.4 8S6 12 8 14"/>', 18)],
  Instagram: ['linear-gradient(135deg,#F58529,#DD2A7B 55%,#8134AF)', WAI.s('<rect x="2.5" y="2.5" width="11" height="11" rx="3.2"/><circle cx="8" cy="8" r="2.6"/><circle cx="11.3" cy="4.7" r=".5" fill="currentColor"/>', 18)],
  Facebook: ['#1877F2', '<b class="pgl">f</b>'], X: ['#000000', '<b class="pgl">𝕏</b>'], TikTok: ['#111111', '<b class="pgl">♪</b>'], Pinterest: ['#E60023', '<b class="pgl">P</b>'],
  Threads: ['#111111', '<b class="pgl">@</b>'], YouTube: ['#FF0000', '<b class="pgl">▶</b>'], Reddit: ['#FF4500', '<b class="pgl">r</b>'],
};
const waPic = (it, z = 36) => { const [c, g] = (it.kind === 'site' ? WA_PLAT.Website : WA_PLAT[it.plat]) || ['#6E6E6E', WAI.person]; return `<span class="wpi" style="--c:${c};width:${z}px;height:${z}px" aria-hidden="true">${g}</span>`; };
const waKind = it => it.kind === 'site' ? `Website · ${it.feed === 'sitemap' ? 'reads its sitemap' : it.feed ? 'reads its news feed' : 'finds its news feed first'}` : `${esc(it.plat || 'Social')} account · reads its newest posts`;
const waBusy = it => !!(it.pend && it.pend.length);
const waDay = 864e5;
const waNextAt = it => it.last ? Date.parse(it.last) + PP_WATCH.TURN_DAYS[it.turn || 'w'] * waDay : 0;
const waNext = it => { if (!it.last) return 'Soon'; const d = Math.round((waNextAt(it) - Date.now()) / waDay); return d <= 0 ? 'Next in line' : d === 1 ? 'Tomorrow' : d < 21 ? 'In ' + d + ' days' : 'In ' + Math.round(d / 7) + ' weeks'; };
const waTurnChip = t => `<span class="wtc t${t}">${PP_WATCH.TURN_NAME[t]}</span>`;
const waErr = it => it.err === 'asked to log in' ? 'Asked to log in' : 'No posts found';
const waMin = ms => { const m = ms / 60000; return (m >= 10 ? Math.round(m) : Math.round(m * 10) / 10) + ' min'; };

// The check that is running: ring, two steps, the post in hand, Stop.
function waRunCard(it) {
  if (!it) return '';
  const tot = Math.max(it.newPosts || 0, it.pend.length, 1), done = tot - it.pend.length, f = done / tot, pct = Math.max(3, Math.round(f * 100));
  const stopping = WA.stopping === it.key;
  const how = it.kind === 'acct' ? 'Read its newest posts in a quiet tab' : it.feed === 'sitemap' ? 'Read its sitemap' : 'Read its news feed';
  return `<section class="card crun wnow" id="watchLive" aria-label="Checking now">
    <div class="crl">${kRing2(f, 150, 12, pct + '%', pct + '% done')}</div>
    <div class="crm">
      <span class="klive"><span class="kpulse2"></span>${stopping ? 'Stopping…' : 'Checking now'}${it.t0 ? ' · started ' + crAgo(it.t0) : ''}</span>
      <h2 class="crh">${waPic(it, 32)}<span>${esc(it.label)}</span></h2>
      <div class="crss">
        <div class="crs done">${kSq(KC.green, WAI.check, 28)}<span class="kn1"><b>Find its new posts</b><span>${how} · ${plural(tot, 'post')} since the last check · older posts skipped</span></span></div>
        <div class="crs now">${kSq(KC.blue, WAI.pics, 28)}<span class="kn1"><b>Compare their pictures with every client's photos</b><span>${done} of ${plural(tot, 'post')} · ${plural(it.cp || 0, 'picture')} compared${it.lite ? ' · the main picture of each post' : ''}</span></span></div>
      </div>
      ${it.cur ? `<div class="cnow">${WAI.page}<span class="mono">${esc(it.cur)}</span></div>` : ''}
    </div>
    <div class="crr">
      <div class="cbox ok"><b class="num">${it.cf || 0}</b><span>${(it.cf || 0) === 1 ? 'New copy found' : 'New copies found'}</span></div>
      <div class="cbox"><b class="num">${it.pend.length}</b><span>Posts left</span></div>
      <div class="crb"><button class="btn kbtn" data-act="watchstop" data-v="${esc(it.key)}"${stopping ? ' disabled' : ''} title="Finish the post in hand, then stop. Posts not looked at yet are read by the next check.">${WAI.stop}${stopping ? 'Stopping…' : 'Stop'}</button></div>
    </div>
    <p class="kfoot cfootl">One small step at a time, between photo searches. Old Stolen pages are never opened again.</p></section>`;
}
let WA_T = null;
function waRunWatch(base) {
  clearInterval(WA_T);
  WA_T = setInterval(async () => {
    if (state.shown !== 'watching') { clearInterval(WA_T); return; }
    const el = document.getElementById('watchrun');
    if (!el) return;
    const saved = (((await FC.meta.get('watch')) || {}).items || {})[base.key];
    if (!saved || !waBusy(saved)) { clearInterval(WA_T); WA.stopping = ''; render(true); return; }
    // Only when something changed, so the Stop button is not swapped out from under a click.
    const html = waRunCard({ ...base, ...saved });
    if (html !== WA.liveHtml) { WA.liveHtml = html; el.innerHTML = html; }
  }, 2000);
}
const waHow = () => `<section class="card chow" id="watchHow" aria-label="How it works"><div class="kh2">How it works</div>
  ${[[KC.red, KI.copies, '2 copies marked Stolen', 'on one site or account, and it is added by itself. You can add one by hand too.'], [KC.blue, WAI.feed, 'On its turn, read only its new posts', 'from its news feed or sitemap, or an account\'s newest posts in a quiet tab'], [KC.green, WAI.pics, 'Compare their pictures', 'with every client\'s photos. Old Stolen pages are never opened again']]
    .map(([c, i, b, t], k) => `<div class="chs"><span class="chn">${k + 1}</span>${kSq(c, i, 32)}<span class="kn1"><b>${b}</b><span>${t}</span></span></div>`).join('')}</section>`;
const waAddBox = (ph, id) => `<div class="wadd"><label class="wadi">${WAI.plus}<input id="${id}" placeholder="${ph}" aria-label="Site or account to watch" maxlength="300"></label><button class="btn primary kbtn" data-act="watchadd" data-v="${id}">${KI.eye}Watch it</button></div>`;

V.watching = async () => {
  const TAB = state.watchTab = WATCH_TABS.includes(routeArg('tab')) ? routeArg('tab') : 'all';
  const list = await PP_WATCH.watchList();
  const cfg = await PP_WATCH.watchCfg(), SI = await PP_WATCH.slotInfo();
  const live = list.filter(x => !x.off), off = list.filter(x => x.off);
  const sites = live.filter(x => x.kind === 'site'), accts = live.filter(x => x.kind === 'acct');
  const busy = live.find(waBusy), probs = live.filter(x => x.err && !waBusy(x));
  const now = Date.now();
  const openKey = routeArg('open') || '';
  const sel = openKey ? list.find(x => x.key === openKey) : null;
  const N = n => (n || 0).toLocaleString();

  // ---- tabs, How it works, See what it found
  const tabs = [['all', 'All', live.length], ['sites', 'Websites', sites.length], ['accts', 'Social accounts', accts.length], ['off', 'Not watching', off.length]];
  const ctl = `<div class="rvn-ctl kctl"><div class="utabs" role="tablist" aria-label="Watching">${tabs.map(([v, l, c]) => `<button role="tab" aria-selected="${v === TAB}" class="${v === TAB ? 'on' : ''}" data-act="watchtab" data-v="${v}">${l} <span>${N(c)}</span></button>`).join('')}</div><span class="sp"></span>
    <button class="btn kbtn" data-act="watchhow" aria-expanded="${WA.how}">${KI.info}How it works</button><a class="btn kbtn" href="#found?via=watch">${KI.copies}See what it found</a></div>`;

  // ---- info bars: why watching waits, and the stolen before list offer
  let bar = '';
  try {
    const q = await FC.quietOK();
    if (!q.ok && live.length && !WA.barOff) {
      const [b, t, btn] = q.why === 'paused' ? ['Keep searching is paused, so watching waits', 'It carries on when you press Resume.', 'Keep searching']
        : q.why === 'hours' ? ['Outside your hours, so watching waits until your hours start', 'Check now still puts a site first in line. Watching runs alongside Keep searching, in its hours.', 'Change hours']
        : ['Keep searching is off, so nothing is checked', 'Watching runs alongside Keep searching. Turn it on to use it.', 'Keep searching'];
      bar = `<div class="kbar info" id="watchBar" role="status">${kSq(KC.blue, KI.clock, 28)}<div><b>${b}</b><span>${t}</span></div><span class="sp"></span><a class="btn kbtn" href="#keep${q.why === 'hours' ? '?tab=settings' : ''}">${KI.clock}${btn}</a><button class="kx" data-act="watchbarx" title="Close" aria-label="Close">${WAI.x}</button></div>`;
    }
  } catch (e) { /* no note */ }
  let listBar = '';
  if (!cfg.list && !cfg.listNo) {
    let n = 0; try { n = await PP_WATCH.listCount(); } catch (e) { n = 0; }
    if (n) listBar = `<div class="kbar info" id="watchListBar" role="status">${kSq(KC.red, WAI.page, 28)}<div><b>${plural(n, 'site or account', 'sites and accounts')} on your stolen before list ${n === 1 ? 'has' : 'have'} 2 or more links</b><span>Watch their new posts every 3 months? They go to the back of the line, so they never slow down the weekly ones.</span></div><span class="sp"></span><button class="btn primary kbtn" data-act="watchlist" data-v="yes">${WAI.plus}Watch them every 3 months</button><button class="btn kbtn" data-act="watchlist" data-v="no">Not now</button></div>`;
  }

  // ---- checking now + needs a look
  const nowCard = busy ? `<div id="watchrun">${(WA.liveHtml = waRunCard(busy))}</div>` : '';
  if (busy) waRunWatch(busy); else WA.stopping = '';
  const fix = it => it.err === 'asked to log in'
    ? [`${esc(it.plat || 'The site')} asked to log in`, `PageProof can't see the newest posts until you log in to ${esc(it.plat || 'it')} in this browser.`, `<a class="btn kbtn" href="${safeUrl(it.url)}" target="_blank" rel="noreferrer">${WAI.key}Log in on ${esc(it.plat || 'the site')}</a><button class="btn kbtn" data-act="watchnow" data-v="${esc(it.key)}">${WAI.retry}Check again</button>`]
    : ['No new posts found', 'It has no news feed, and its sitemap didn\'t list any posts. It may have moved or shut down.', `<a class="btn kbtn" href="${safeUrl(it.url)}" target="_blank" rel="noreferrer">${WAI.ext}Open the site</a><button class="btn kbtn" data-act="watchnow" data-v="${esc(it.key)}">${WAI.retry}Try again</button>`];
  const needs = probs.length ? `<section class="card wneed" id="watchNeeds" aria-label="Needs a look"><div class="kh2">Needs a look <span class="ktag warn">${probs.length}</span></div>
    ${probs.slice(0, 4).map(it => { const [b, s, bb] = fix(it); return `<div class="wnr">${waPic(it, 36)}<span class="kn1"><b>${esc(it.label)}</b><span class="wwarn">${WAI.warn}${b}</span><span class="wsub">${s}</span><span class="wnb">${bb}</span></span></div>`; }).join('')}
    ${probs.length > 4 ? `<p class="kfaint">And ${probs.length - 4} more, marked in the list below.</p>` : ''}</section>` : '';
  const top = busy || probs.length ? (busy && probs.length ? `<div class="kgrid cg1"><div>${nowCard}</div><div>${needs}</div></div>` : nowCard || needs) : '';

  // ---- tiles
  const wk = { posts: 0, pics: 0, checks: 0 };
  for (const it of list) for (const h of it.hist || []) if (now - Date.parse(h[0]) < 7 * waDay) { wk.posts += h[1] || 0; wk.pics += h[3] || 0; wk.checks++; }
  const foundAll = list.reduce((a, x) => a + (x.found || 0), 0);
  const count = { w: 0, m: 0, q: 0 }; for (const it of live) count[it.turn || 'w']++;
  const dueWeek = Math.round(count.w + count.m / 4.3 + count.q / 13);
  const waiting = live.filter(x => !waBusy(x)).sort((a, b) => waNextAt(a) - waNextAt(b))[0];
  const nextTile = !live.length ? ['–', 'Next check', 'Nothing is watched yet'] : live.length > 20 ? [`${N(Math.min(wk.checks, dueWeek))} of ${N(dueWeek)}`, 'Checked this week', wk.checks >= dueWeek ? 'On time' : 'The rest are due this week'] : [waiting ? waNext(waiting) : 'Now', 'Next check', waiting ? esc(waiting.label) : esc(busy.label)];
  const tiles = `<div class="ktiles2" id="watchTiles">${[[KC.blue, KI.eye, N(live.length), 'Sites and accounts watched', `${plural(sites.length, 'website')} · ${plural(accts.length, 'social account')}`], [KC.purple, WAI.page, N(wk.posts), 'New posts checked', `This week · ${plural(wk.pics, 'picture')} compared`], [KC.green, KI.copies, N(foundAll), 'Copies found by watching', '<a href="#found?via=watch">See them in All copies ›</a>'], [KC.amber, KI.cal, ...nextTile]]
    .map(([c, i, b, l, s]) => `<div class="card kt2">${kSq(c, i, 40)}<span><b class="num">${b}</b><span class="l">${l}</span><span class="s">${s}</span></span></div>`).join('')}</div>`;

  // ---- turns + this PC's share, and this hour
  let hours = 50; try { hours = Math.max(1, FC.workMinutes(await FC.keep(), new Date(now), new Date(now + 7 * waDay)) / 60); } catch (e) { hours = 50; }
  const avg = cfg.avg || 45000, perWeek = Math.floor(SI.watchMax * 60000 * hours / avg);
  const seg = (t, w) => count[t] ? `<span class="wseg2 t${t}" style="flex:${Math.max(w, 14)}"><b class="num">${N(count[t])}</b><span>${PP_WATCH.TURN_NAME[t]}</span></span>` : '';
  const tot3 = Math.max(1, live.length);
  const rot = `<section class="card wrot" id="watchTurns" aria-label="Turns">
    <div class="kh2">Turns <span class="kfaint">who gets checked how often</span></div>
    <div class="wbar" role="img" aria-label="${count.w} every week, ${count.m} every month, ${count.q} every 3 months">${seg('w', count.w / tot3 * 100)}${seg('m', count.m / tot3 * 100)}${seg('q', count.q / tot3 * 100)}${live.length ? '' : '<span class="wseg2 tq" style="flex:1"><b class="num">0</b><span>Nothing watched yet</span></span>'}</div>
    <div class="wrot3">
      <div>${waTurnChip('w')}<span>3 or more Stolen in the last 6 months, a copy found by watching in the last 2 months, new this month, or added by you. Up to 30 new posts, every picture.</span></div>
      <div>${waTurnChip('m')}<span>Stolen before, but nothing new in its last 3 checks. Up to 15 new posts, the main picture of each.</span></div>
      <div>${waTurnChip('q')}<span>Older cases, sites on your stolen before list, or nothing new 6 times. Up to 10 new posts, the main picture of each.</span></div>
    </div>
    <div class="wpc" id="watchCap">${kSq(KC.teal, WAI.pc, 36)}<span class="kn1"><b>This PC (${esc(SI.level)}) gives Watching up to ${SI.watchMax} minutes an hour</b><span>That's about ${N(perWeek)} checks a week${cfg.avg ? '' : ' (a first guess, until a few checks have run)'}. ${N(dueWeek)} ${dueWeek === 1 ? 'is' : 'are'} due each week, ${perWeek >= dueWeek ? 'so every site stays on its turn.' : 'so some wait longer than their turn. Weekly ones always go first.'}</span></span>
      <label class="ksort"><select data-act="watchcap" aria-label="Minutes an hour for Watching on this PC">${[[0, `Automatic (${SI.auto} min)`], [3, '3 minutes'], [6, '6 minutes'], [12, '12 minutes']].filter(([v]) => v <= SI.max).map(([v, l]) => `<option value="${v}" ${SI.own === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
  </section>`;
  const U = SI.used, extra = (U.sweep || 0) + (U.credit || 0) + (U.watch || 0), photoMs = Math.max(0, 3600000 - extra);
  const share = `<section class="card wshare" id="watchHour" aria-label="This hour on this PC"><div class="kh2">This hour on this PC</div>
    <div class="wsb" aria-hidden="true"><span style="flex:${Math.max(1, photoMs)}" class="s0"></span><span style="flex:${U.sweep || 0}" class="s1"></span><span style="flex:${U.credit || 0}" class="s2"></span><span style="flex:${U.watch || 0}" class="s3"></span></div>
    ${[['s0', 'Photo searches', 'always first', 'the rest'], ['s1', 'Sweeps of Stolen sites', '', waMin(U.sweep || 0)], ['s2', 'Credit search', '', waMin(U.credit || 0)], ['s3', 'Watching', SI.resting ? 'a search site is resting, so it may use more' : `${U.accts || 0} of ${SI.acctsHour} social accounts`, waMin(U.watch || 0)]].map(([c, l, n, m]) => `<div class="wsl"><i class="${c}"></i><span>${l}</span><span class="kfaint">${n}</span><b class="num">${m}</b></div>`).join('')}
    <p class="kfoot">The 3 extra searches take turns in one shared slot of at most ${SI.max} minutes an hour. When Google or Bing rest after a robot check, Watching uses that time, because it never asks them anything. Each social account opens a quiet tab, so at most ${SI.acctsHour} an hour.</p></section>`;

  // ---- command bar: find, sort, add
  const sorts = [['stolen', 'Most Stolen'], ['next', 'Next in line'], ['last', 'Checked longest ago'], ['found', 'Most found'], ['name', 'Name A to Z']];
  const cmd = `<div class="wcmd"><label class="ksearch">${KI.search}<input type="search" id="watchQ" placeholder="Find a site or account" aria-label="Find a site or account" value="${esc(WA.q)}"></label>
    <label class="ksort"><span class="kfaint">Sort</span><select data-act="watchsort" aria-label="Sort the list">${sorts.map(([v, l]) => `<option value="${v}" ${WA.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label><span class="sp"></span>
    ${waAddBox('Watch another site or account, like example.com or an Instagram link', 'watchIn')}</div>`;

  // ---- the list
  let shown = (TAB === 'off' ? off : TAB === 'sites' ? sites : TAB === 'accts' ? accts : live).slice();
  if (WA.sort === 'next') shown.sort((a, b) => (waBusy(b) ? 1 : 0) - (waBusy(a) ? 1 : 0) || waNextAt(a) - waNextAt(b));
  else if (WA.sort === 'last') shown.sort((a, b) => Date.parse(a.last || 0) - Date.parse(b.last || 0));
  else if (WA.sort === 'found') shown.sort((a, b) => (b.found || 0) - (a.found || 0));
  else if (WA.sort === 'name') shown.sort((a, b) => a.label.localeCompare(b.label));
  const total = shown.length;
  if (sel && shown.indexOf(sel) >= WA.more) WA.more = shown.indexOf(sel) + 1;
  shown = shown.slice(0, WA.more);
  const menuOf = it => `<div class="wmenu" role="menu" id="watchMenu"><a role="menuitem" href="${safeUrl(it.url)}" target="_blank" rel="noreferrer">${WAI.ext}Open the ${it.kind === 'acct' ? 'account' : 'site'}</a><a role="menuitem" href="#found?via=watch">${KI.copies}See what watching found</a><hr>
    <button role="menuitem" data-act="watchoff" data-v="${esc(it.key)}">${WAI.pause}Stop watching</button><button role="menuitem" data-act="watchdrop" data-v="${esc(it.key)}"${it.by === 'hand' ? '' : ' disabled class="dis"'}>${WAI.bin}Remove<span>${it.by === 'hand' ? '' : 'Only for ones you added'}</span></button></div>`;
  const row = it => { const k = esc(it.key), b = waBusy(it);
    return `<div class="wr${it.off ? ' off' : ''}${sel && it.key === sel.key ? ' sel' : ''}" data-name="${esc(it.label.toLowerCase())}" data-key="${k}">
      <button class="wsite wbt" data-act="watchopen" data-v="${k}" aria-label="Open ${esc(it.label)}">${waPic(it)}<span class="kn1"><b>${esc(it.label)}${it.by === 'hand' ? `<span class="wyou">${WAI.person}Added by you</span>` : it.by === 'list' ? `<span class="wyou wlistc">Stolen before list</span>` : ''}</b><span>${waKind(it)}</span></span></button>
      <span class="wcl">${(it.clients || []).slice(0, 3).map(c => kAv(c).replace('class="kav"', `class="kav" title="${esc(c)}"`)).join('')}${(it.clients || []).length > 3 ? `<span class="kfaint">+${it.clients.length - 3}</span>` : ''}${(it.clients || []).length ? '' : '<span class="kfaint">None yet</span>'}</span>
      <span class="r num wst">${it.stolen ? N(it.stolen) : it.links ? `<span class="kfaint" title="Links on your stolen before list">${N(it.links)}</span>` : '<span class="kfaint">0</span>'}</span>
      <span class="kfaint num">${b ? '<span class="ktag acc">Checking now</span>' : it.err ? `<span class="wwarn">${WAI.warn}${waErr(it)}</span>` : it.last ? esc(crAgo(Date.parse(it.last))) : 'Not checked yet'}</span>
      <span class="r num">${it.newPosts != null ? N(it.newPosts) : '<span class="kfaint">–</span>'}</span>
      <span class="r">${it.found ? `<span class="ktag ok">${N(it.found)} found</span>` : '<span class="kfaint">–</span>'}</span>
      <span class="wturn">${it.off ? '<span class="kfaint">Not watching</span>' : `${waTurnChip(it.turn)}<span class="kfaint" title="${esc(it.why)}">${b ? 'Checking now' : it.due ? 'First in line' : waNext(it)} · ${esc(it.why)}</span>`}</span>
      <span class="wact">${it.off ? `<button class="btn kbtn" data-act="watchon" data-v="${k}">${WAI.play}Watch again</button>` : `<button class="btn kbtn" data-act="watchnow" data-v="${k}"${b || it.due ? ' disabled' : ''}>${WAI.retry}${it.due ? 'First in line' : 'Check now'}</button>`}<button class="btn kbtn wmore" data-act="watchmenu" data-v="${k}" aria-label="More for ${esc(it.label)}" aria-haspopup="menu" aria-expanded="${WA.menu === it.key}">${WAI.more}</button>${WA.menu === it.key ? menuOf(it) : ''}</span>
      <button class="wchev wbt" data-act="watchopen" data-v="${k}" tabindex="-1" aria-hidden="true">${KI.chev}</button></div>`; };
  const listC = `<section class="card wlist" id="watchList" aria-label="Watched sites and accounts"><div class="wh"><span>Site or account</span><span>Clients</span><span class="r">Stolen there</span><span>Last checked</span><span class="r">New posts</span><span class="r">Found</span><span>How often</span><span></span><span></span></div>
    ${shown.map(row).join('') || `<p class="kmuted" style="padding:18px 0">${TAB === 'off' ? 'Nothing is switched off. Stop watching a site and it waits here.' : 'Nothing here yet.'}</p>`}
    <p class="kmuted" id="watchNoMatch" style="padding:18px 0" hidden>Nothing matches that name.</p>
    ${total > shown.length ? `<div class="wmore2">Showing ${N(shown.length)} of ${N(total)} · <a data-act="watchmore" href="#watching" role="button">Show more</a></div>` : ''}</section>`;

  // ---- under the list
  const fold = off.length && TAB === 'all' ? `<section class="card wfold" id="watchOff"><button class="wfh wbt" data-act="watchtab" data-v="off">${KI.chev}<b>Not watching</b><span class="ktag">${off.length}</span><span class="kfaint wfn">${off.slice(0, 6).map(x => esc(x.label)).join(' · ')}</span><span class="sp"></span><span class="kfaint">Stopped by you. Their Stolen copies stay in Copies found.</span></button></section>` : '';

  // ---- the panel for one site or account
  let panel = '';
  if (sel) {
    const k = esc(sel.key);
    const copies = (await FC.allCopies()).filter(c => c.status === 'stolen' && (sel.kind === 'acct' ? c.acct && 'a:' + c.acct.key === sel.key : !(typeof PP_SOCIAL !== 'undefined' && PP_SOCIAL.isSocial(c.site)) && 's:' + FC.baseOf(c.site) === sel.key));
    const reads = sel.kind === 'acct' ? [WAI.person, 'Its newest posts', 'Opened in a quiet tab of this browser, with your own login'] : sel.feed === 'sitemap' ? [WAI.map, 'Its sitemap', 'It has no news feed, so the newest pages of its sitemap are read'] : sel.feed ? [WAI.feed, 'Its news feed', esc(sel.feed)] : [WAI.feed, 'Not read yet', 'Its news feed is looked for at the first check'];
    const next = sel.turn === 'w' ? 'After 3 checks with nothing new it moves to every month by itself.' : sel.turn === 'm' ? 'After 6 checks with nothing new it moves to every 3 months.' : '';
    panel = `<aside class="cpanel wpanel" id="watchPanel" aria-label="${esc(sel.label)}">
      <div class="cph">${waPic(sel, 44)}<span class="kn1"><b>${esc(sel.label)}</b><span>${waKind(sel)}</span></span><span class="sp"></span><button class="kx" data-act="watchclose" title="Close" aria-label="Close">${WAI.x}</button></div>
      ${sel.err ? `<div class="cptip wperr">${WAI.warn}<span>${fix(sel)[1]}</span></div>` : ''}
      <div class="cpbox"><div class="cbox bad"><b class="num">${N(sel.stolen)}</b><span>Stolen there</span></div><div class="cbox ok"><b class="num">${N(sel.found)}</b><span>Found by watching</span></div><div class="cbox"><b class="num">${N(sel.checks)}</b><span>Checks so far</span></div></div>
      ${copies.length ? `<div class="kh2">Stolen copies here <a href="#found?open=${encodeURIComponent(copies[0].id)}">Open in All copies ›</a></div>
      <div class="wthumbs">${copies.slice(0, 6).map(c => `<a href="#found?open=${encodeURIComponent(c.id)}" title="Open this copy"><img src="${safeImg(c.thumb || c.img)}" alt="" loading="lazy"></a>`).join('')}</div>` : sel.by === 'list' ? `<p class="kmuted">${plural(sel.links || 0, 'link')} on your stolen before list. No copies in PageProof yet.</p>` : ''}
      ${(sel.clients || []).length ? `<div class="wclients">${sel.clients.map(c => `<span class="kchip">${kAv(c)}${esc(c)}</span>`).join('')}</div>` : ''}
      <div class="kh2">How PageProof reads it</div>
      <div class="cpw">${kSq(KC.blue, reads[0], 30)}<span class="kn1"><b>${reads[1]}</b><span class="mono">${reads[2]}</span></span></div>
      ${sel.off ? '' : `<div class="cpw" id="watchTurn">${kSq(KC.blue, WAI.retry, 30)}<span class="kn1"><b>Turn: ${waTurnChip(sel.turn)}</b><span>${esc(sel.why)}. ${next} A new copy moves it back to every week.</span></span></div>`}
      <div class="kh2">Last checks</div>
      <div class="whist" id="watchHist">${(sel.hist || []).map(([d, n, f, , st]) => `<div><span class="kfaint num">${esc(new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' }))}</span><span>${plural(n || 0, 'new post')}${st ? ' · stopped early' : ''}</span>${f ? `<span class="ktag ok">${f} found</span>` : '<span class="kfaint">Nothing new</span>'}</div>`).join('') || '<p class="kmuted">Not checked yet.</p>'}</div>
      <div class="cpfoot">${sel.off ? `<button class="btn primary kbtn" data-act="watchon" data-v="${k}">${WAI.play}Watch again</button>` : `<button class="btn primary kbtn" data-act="watchnow" data-v="${k}"${waBusy(sel) || sel.due ? ' disabled' : ''}>${WAI.retry}${sel.due ? 'First in line' : 'Check now'}</button>`}<a class="btn kbtn" href="${safeUrl(sel.url)}" target="_blank" rel="noreferrer">${WAI.ext}Open the ${sel.kind === 'acct' ? 'account' : 'site'}</a>${sel.off ? '' : `<button class="btn kbtn" data-act="watchoff" data-v="${k}">${WAI.pause}Stop watching</button>`}</div></aside>`;
  }

  let body;
  if (!list.length) body = `${listBar}<section class="card wempty" id="watchEmpty">${kSq(KC.blue, KI.eye, 64)}<h2>Nothing watched yet</h2><p>When 2 copies on one site or social account are marked Stolen, PageProof starts watching it by itself and checks its new posts once a week.</p>
    ${waAddBox('Or add one now, like example.com or an Instagram link', 'watchIn')}</section><div class="kgrid two"><div>${waHow()}</div><div></div></div>`;
  else if (TAB !== 'all') body = `${WA.how ? waHow() : ''}${cmd}${listC}`;
  else body = `${bar}${listBar}${top}${tiles}<div class="kgrid cg1"><div>${rot}</div><div>${share}</div></div>${cmd}${listC}<div class="kgrid now2"><div>${fold}</div><div>${waHow()}</div></div>`;
  document.body.classList.toggle('cpopen', !!panel);
  return head('Copies found', 'Watching', '') + `<div class="rvn kpn crn wan r2${panel ? ' withpanel' : ''}" data-tab="${TAB}">${ctl}${body}</div>${panel}`;
};
V.watching.after = () => {
  const i = document.getElementById('watchQ');
  if (i) {
    const run = () => { const q = i.value.trim().toLowerCase(); WA.q = i.value; let n = 0; for (const r of document.querySelectorAll('#watchList .wr')) { const hit = !q || (r.dataset.name || '').includes(q); r.hidden = !hit; if (hit) n++; }
      const none = document.getElementById('watchNoMatch'); if (none) none.hidden = !(q && !n); };
    i.addEventListener('input', run); run();
  }
  const a = document.getElementById('watchIn');
  if (a) a.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ACTS.watchadd('watchIn'); } });
  if (state.shown === 'watching' && !document.getElementById('watchPanel')) document.body.classList.remove('cpopen');
};
// The row menu closes on a click anywhere else and on Escape.
document.addEventListener('click', e => { if (WA.menu && state.shown === 'watching' && !e.target.closest('.wact')) { WA.menu = ''; const m = document.getElementById('watchMenu'); if (m) m.remove(); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.shown === 'watching') { if (WA.menu) { WA.menu = ''; render(true); } else if (routeArg('open')) ACTS.watchclose(); } });
const waGo = (tab, open) => { const a = []; if (tab && tab !== 'all') a.push('tab=' + tab); if (open) a.push('open=' + encodeURIComponent(open)); history.replaceState(null, '', '#watching' + (a.length ? '?' + a.join('&') : '')); render(true); };
Object.assign(ACTS, {
  watchtab: v => { WA.how = false; WA.menu = ''; WA.more = 50; waGo(WATCH_TABS.includes(v) ? v : 'all'); },
  watchhow: () => { if (state.watchTab === 'all') { const h = document.getElementById('watchHow'); if (h) { h.scrollIntoView({ block: 'center', behavior: 'smooth' }); h.classList.add('flash'); setTimeout(() => h.classList.remove('flash'), 1600); } return; } WA.how = !WA.how; render(true); },
  watchbarx: () => { WA.barOff = true; render(true); },
  watchsort: (v, el) => { WA.sort = el.value; render(true); },
  watchmore: () => { WA.more += 50; render(true); },
  watchmenu: v => { WA.menu = WA.menu === v ? '' : v; render(true); },
  watchopen: v => { WA.menu = ''; waGo(state.watchTab, routeArg('open') === v ? '' : v); },
  watchclose: () => waGo(state.watchTab, ''),
  watchcap: async (v, el) => { await PP_WATCH.setWatchCap(+el.value); toast(+el.value ? `Watching may use up to ${+el.value} minutes an hour on this PC.` : 'Watching uses the usual time for this PC.'); render(true); },
  watchlist: async v => {
    await PP_WATCH.setWatchList(v === 'yes' ? true : 'no');
    if (v === 'yes') toast('Watching them every 3 months, behind everything else.', async () => { await PP_WATCH.setWatchList(false); render(true); });
    render(true);
  },
  watchadd: async v => {
    const el = document.getElementById(typeof v === 'string' && v ? v : 'watchIn') || document.getElementById('watchIn');
    const text = (el || {}).value || '';
    if (!text.trim()) { if (el) el.focus(); return; }
    const it = await PP_WATCH.watchAdd(text);
    if (!it) { toast('That does not look like a site or a social account. Paste its address, like example.com or an Instagram link.'); return; }
    toast('Watching ' + it.label + '. Its new posts are checked every week.'); render(true);
  },
  watchnow: async v => { WA.menu = ''; await PP_WATCH.watchNow(v); toast('First in line. It is checked in the Keep searching tab, in your hours.'); render(true); },
  watchstop: async v => { WA.stopping = v; await PP_WATCH.watchStop(v); toast('Stopping after the post in hand. Posts not looked at yet are read by the next check.'); render(true); },
  watchoff: async v => { WA.menu = ''; await PP_WATCH.watchOff(v, true); toast('Stopped watching.', async () => { await PP_WATCH.watchOff(v, false); render(true); }); if (routeArg('open') === v) waGo(state.watchTab, ''); else render(true); },
  watchon: async v => { await PP_WATCH.watchOff(v, false); render(true); },
  watchdrop: async v => { WA.menu = ''; await PP_WATCH.watchDrop(v); toast('Removed from the list.'); if (routeArg('open') === v) waGo(state.watchTab, ''); else render(true); },
});
