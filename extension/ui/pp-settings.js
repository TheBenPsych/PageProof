// Settings in the calm look (batch 18). Six pages in the menu: General, Searching, Site lists,
// Backups and team, Health, Help and about. Every setting is one row: a small icon, what it is,
// and its switch or button on the right. Longer explanations fold away under their row.
// This file draws General, Searching and Backups and team, the "Find a setting" box that every
// Settings page has, and the small dot in the menu when Health or Backups need a look.
// Nothing here changes what a setting does: the same switches save the same things as before.

// ---------------------------------------------------------------- menu, routes, addresses
PP_MENU.find(m => m.id === 'settings').subs = [['General', 'settings'], ['Searching', 'ssearch'], ['Site lists', 'hidden'], ['Backups and team', 'backups'], ['Health', 'health'], ['Help and about', 'help']];
Object.assign(PP_ROUTES, {
  settings: ['settings', 'settings'], browser: ['settings', 'settings'], ssearch: ['settings', 'ssearch'], computer: ['settings', 'ssearch'],
  hidden: ['settings', 'hidden'], backups: ['settings', 'backups'], team: ['settings', 'backups'], moving: ['settings', 'backups'], reconnect: ['settings', 'backups'],
  health: ['settings', 'health'], stats: ['settings', 'health'], help: ['settings', 'help'], whatsnew: ['settings', 'help'], setup: ['settings', 'help'],
});
Object.assign(PP_CRUMBS, {
  settings: 'Settings › General', browser: 'Settings › General', ssearch: 'Settings › Searching', computer: 'Settings › Searching',
  hidden: 'Settings › Site lists', backups: 'Settings › Backups and team', team: 'Settings › Backups and team › Team lists', moving: 'Settings › Backups and team',
  health: 'Settings › Health', stats: 'Settings › Health › Stats', help: 'Settings › Help and about', whatsnew: 'Settings › Help and about › What\'s new',
});
Object.assign(state, { sxFold: {}, sxFlash: '', sxBkAll: false });

// ---------------------------------------------------------------- building blocks
const SX = (() => {
  const svg = (p, z = 20) => `<svg viewBox="0 0 16 16" width="${z}" height="${z}" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const I = {
    person: '<circle cx="8" cy="5.3" r="2.8"/><path d="M2.6 14.2c.6-3 2.7-4.4 5.4-4.4s4.8 1.4 5.4 4.4"/>',
    text: '<path d="M2 4V2.6h8V4M6 2.6v10.8M4.3 13.4h3.4M9.5 8V7h5v1M12 7v6.4M11 13.4h2"/>',
    moon: '<path d="M13.2 10.2A5.6 5.6 0 0 1 5.8 2.8a5.6 5.6 0 1 0 7.4 7.4z"/>',
    popup: '<rect x="1.8" y="2.5" width="12.4" height="11" rx="1"/><rect x="5" y="5.5" width="6" height="5" rx=".6"/><path d="m9.4 6.6-1 1"/>',
    pin: '<path d="M10.2 1.8 14.2 5.8l-1.9.6-2.6 2.6.2 2.6-1.2 1.2-2.4-2.4-3.5 3.5M5.3 8.9 3 6.6l1.2-1.2 2.6.2 2.6-2.6z"/>',
    key: '<rect x="1.5" y="4" width="13" height="8" rx="1"/><path d="M4 6.5h.5M6.3 6.5h.5M8.6 6.5h.5M11 6.5h.5M4.5 9.5h7"/>',
    menu: '<rect x="2.5" y="2" width="11" height="12" rx="1"/><path d="M5 5h6M5 8h6M5 11h4"/>',
    search: '<circle cx="7" cy="7" r="4.6"/><path d="M10.4 10.4 14 14"/>',
    acct: '<circle cx="6" cy="5.5" r="2.4"/><path d="M1.8 13.5c.5-2.5 2.2-3.8 4.2-3.8s3.7 1.3 4.2 3.8M10.5 3.4a2.3 2.3 0 0 1 0 4.4M12 9.9c1.2.5 2 1.7 2.3 3.6"/>',
    page: '<path d="M4 1.8h5.5L12.5 5v9.2H4z"/><path d="M9.5 1.8V5h3M6 8h4.5M6 10.5h4.5"/>',
    repeat: '<path d="M2.5 8a5.5 5.5 0 0 1 9.6-3.6M13.5 8a5.5 5.5 0 0 1-9.6 3.6M12.3 1.8v2.8H9.5M3.7 14.2v-2.8h2.8"/>',
    speed: '<path d="M2.2 11.5a6 6 0 1 1 11.6 0"/><path d="M8 10.2 10.6 6"/><circle cx="8" cy="10.4" r=".9"/>',
    down: '<path d="M8 2.5v8M4.5 7.5 8 11l3.5-3.5M3 13.5h10"/>',
    up: '<path d="M8 11V2.8M4.5 6 8 2.5 11.5 6M3 13.5h10"/>',
    shield: '<path d="M8 1.6 13.4 3.6v4c0 3.3-2.3 5.6-5.4 6.8C4.9 13.2 2.6 10.9 2.6 7.6v-4z"/><path d="m8 5.2-1 2.2H5L6.6 9 6 11l2-1.2 2 1.2L9.4 9 11 7.4H9z"/>',
    cloud: '<path d="M4.4 12.6A3 3 0 0 1 4.2 6.6a4 4 0 0 1 7.6-.8 3.4 3.4 0 0 1-.2 6.8z"/>',
    restore: '<path d="M2.4 8a5.6 5.6 0 1 0 1.7-4M2.4 2.6v2.8h2.8"/><path d="M8 5v3.2l2 1.3"/>',
    team: '<circle cx="5.5" cy="5.5" r="2.2"/><circle cx="11" cy="6" r="1.8"/><path d="M1.5 13.2c.4-2.4 2-3.6 4-3.6s3.6 1.2 4 3.6M10 9.7c1.9 0 3.6 1 4 3.3"/>',
    folder: '<path d="M1.8 4.2V12.8h12.4V5.6H7.6L6.2 3.6H2.4z"/>',
    pc: '<rect x="1.8" y="2.5" width="12.4" height="8.5" rx="1"/><path d="M5.5 13.8h5M8 11v2.8"/>',
    move: '<rect x="1.4" y="3" width="6" height="5" rx=".8"/><rect x="8.6" y="8" width="6" height="5" rx=".8"/><path d="M5 10.5h2.2M5 10.5l1-1M5 10.5l1 1M11 5.5H8.8M11 5.5l-1-1M11 5.5l-1 1"/>',
    pause: '<circle cx="8" cy="8" r="6.2"/><path d="M6.4 5.6v4.8M9.6 5.6v4.8"/>',
    chart: '<path d="M2 13.8h12M3.8 11V8M7 11V4.5M10.2 11V6.5M13.2 11V3"/>',
    drive: '<path d="M5.6 2.4h4.8l4.2 7.3-2.4 4H4l-2.4-4z"/><path d="M5.6 2.4 9.8 9.7h4.8M10.4 2.4 4 13.7"/>',
    check: '<path d="m3 8.5 3.2 3L13 4.5"/>', info: '<circle cx="8" cy="8" r="6.2"/><path d="M8 7.2v4M8 4.9v.2"/>',
    chev: '<path d="m6 3.5 4.5 4.5L6 12.5"/>', chevd: '<path d="M3.5 6 8 10.5 12.5 6"/>',
    warn: '<path d="M8 2 14.5 13.5h-13z"/><path d="M8 6.5v3.2M8 11.6v.2"/>',
  };
  const ic = (n, z) => svg(I[n] || '', z);
  const tag = (t, c) => `<span class="sx-tag ${c}">${c === 'ok' ? ic('check', 13) : c === 'warn' || c === 'bad' ? ic('warn', 13) : ''}${t}</span>`;
  const chev = `<span class="sx-chev">${ic('chev', 16)}</span>`;
  const chevd = `<span class="sx-chev">${ic('chevd', 16)}</span>`;
  const inner = (icon, t, sub, ctl) => `<span class="sx-ic">${icon ? ic(icon) : ''}</span><span class="sx-tt"><b>${t}</b>${sub ? `<span>${sub}</span>` : ''}</span><span class="sx-ctl">${ctl || ''}</span>`;
  // One setting: icon, title and one line, then its control. o.id names the row (Find a setting jumps to it).
  const row = (icon, t, sub, ctl = '', o = {}) => o.href
    ? `<a class="sx-row link${o.cls ? ' ' + o.cls : ''}"${o.id ? ` id="${o.id}"` : ''} href="#${o.href}">${inner(icon, t, sub, ctl + chev)}</a>`
    : `<div class="sx-row${o.cls ? ' ' + o.cls : ''}"${o.id ? ` id="${o.id}"` : ''}>${inner(icon, t, sub, ctl)}</div>`;
  // A row that folds open. It stays the way you left it while PageProof is open.
  const fold = (id, icon, t, sub, body, open, ctl = '') => {
    const o = id in state.sxFold ? state.sxFold[id] : !!open;
    return `<details class="sx-det" id="${id}"${o ? ' open' : ''}><summary class="sx-row">${inner(icon, t, sub, ctl + chevd)}</summary><div class="sx-fold">${body}</div></details>`;
  };
  const group = (t, body, id) => `<div class="sx-group"${id ? ` id="${id}"` : ''}>${t ? `<h3>${t}</h3>` : ''}<div class="sx-stack">${body}</div></div>`;
  const sw = (attrs, on, label) => `<span class="wswl">${on ? 'On' : 'Off'}</span><label class="switch"><input type="checkbox" ${attrs} ${on ? 'checked' : ''} aria-label="${esc(label)}"><span></span></label>`;
  const seg = (label, act, opts, cur) => `<div class="sx-seg" role="group" aria-label="${label}">${opts.map(([k, l, px]) => `<button class="${cur === k ? 'on' : ''}" aria-pressed="${cur === k}" data-act="${act}" data-v="${k}"${px ? ` style="font-size:${px}px"` : ''}>${l}</button>`).join('')}</div>`;
  // An answer that may come late (a folder on Google Drive): never keep the page waiting for it.
  const soon = (p, ms, late) => Promise.race([Promise.resolve(p).catch(() => late), new Promise(ok => setTimeout(() => ok(late), ms))]);

  // ---------- Find a setting ----------
  // [what you see, extra words to match, page, row to jump to]
  const INDEX = [
    ['Your name', 'collected by', 'settings', 'sxName'], ['Text size', 'bigger zoom large', 'settings', 'textsize'], ['Colours: light or dark', 'theme dark mode', 'settings', 'themeSet'],
    ['Close pop-ups before the first screen', 'cookie notice capture', 'settings', 'popSet'], ['Pin PageProof to the toolbar', 'icon jigsaw', 'settings', 'sxPin'],
    ['Capture shortcut', 'keyboard keys alt shift p', 'settings', 'sxShort'], ['Right-click menu', 'context', 'settings', 'sxRc'], ['PageProof version and what\'s new', 'about update', 'settings', 'sxAbout'],
    ['Where searches run', 'window pinned tabs minimized', 'ssearch', 'sxPlace'], ['Read account details by itself', 'followers verified social', 'ssearch', 'sxAcct'],
    ['Show their pages by themselves', 'page picture', 'ssearch', 'sxPages'], ['Keep searching', 'pace hours goal today 50', 'ssearch', 'sxKeep'],
    ['This computer and its limits', 'cores memory tabs checks', 'ssearch', 'sxPc'], ['Speed level', 'light normal strong', 'ssearch', 'sxSpeed'],
    ['Hidden sites', 'hide block list', 'hidden', ''], ['Approved sites', 'licensed allowed', 'hidden', ''], ['Site popularity list', 'tranco top', 'hidden', 'sxLists'], ['Known bad site lists', 'piracy scam phishing malware', 'hidden', 'sxLists'],
    ['Back up now', 'backup google drive', 'backups', 'sxHero'], ['Restore a backup', 'bring it back', 'backups', 'sxRestore'], ['Team lists', 'share people', 'backups', 'sxTeam'],
    ['Your photos folder', 'google drive reconnect pick again', 'backups', 'sxPhotos'], ['PageProof folder', 'documents', 'backups', 'sxDocs'], ['Backup folder', 'my drive', 'backups', 'sxBkFolder'],
    ['Moving to a new computer', 'new pc laptop', 'backups', 'sxMoving'],
    ['Is everything working?', 'health lights sign in', 'health', ''], ['Stats', 'how pageproof is doing numbers', 'stats', ''],
    ['Help and tutorial', 'guide learn', 'help', ''], ['Keyboard keys', 'shortcuts', 'help', ''], ['Run setup again', 'first time', 'setup', ''],
  ];
  const find = () => `<div class="sx-find" role="search">${ic('search', 16)}<input id="sxFind" type="search" placeholder="Find a setting" aria-label="Find a setting" autocomplete="off"><div class="sx-found" id="sxFound" hidden></div></div>`;
  const matches = q => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return INDEX.map((x, i) => [x, i]).filter(([x]) => words.every(w => (x[0] + ' ' + x[1]).toLowerCase().includes(w))).slice(0, 8);
  };
  const PAGE = { settings: 'General', ssearch: 'Searching', hidden: 'Site lists', backups: 'Backups and team', health: 'Health', stats: 'Health', help: 'Help and about', setup: 'Help and about' };
  function wireFind() {
    const inp = document.getElementById('sxFind'), box = document.getElementById('sxFound');
    if (!inp || inp.dataset.on) return;
    inp.dataset.on = '1';
    const draw = () => {
      const m = matches(inp.value);
      box.hidden = !inp.value.trim();
      box.innerHTML = m.length ? m.map(([x, i], n) => `<button class="${n ? '' : 'on'}" data-act="sxgo" data-v="${i}"><b>${esc(x[0])}</b><span>${PAGE[x[2]]}</span></button>`).join('') : '<p>No setting with those words.</p>';
    };
    inp.oninput = draw;
    inp.onfocus = () => { if (inp.value.trim()) draw(); };
    inp.onkeydown = e => {
      const all = [...box.querySelectorAll('button')], cur = all.findIndex(b => b.classList.contains('on'));
      if (e.key === 'Enter' && all[cur]) { e.preventDefault(); all[cur].click(); }
      else if (e.key === 'Escape') { inp.value = ''; box.hidden = true; }
      else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && all.length) { e.preventDefault(); const n = (cur + (e.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length; all.forEach((b, i) => b.classList.toggle('on', i === n)); }
    };
    inp.onblur = () => setTimeout(() => { box.hidden = true; }, 200);
  }
  // Jump to the row asked for (after its page is drawn) and light it up for a moment.
  function flash() {
    const id = state.sxFlash; if (!id) return;
    const el = document.getElementById(id); if (!el) return;
    state.sxFlash = '';
    if (el.tagName === 'DETAILS') el.open = true;
    el.scrollIntoView({ block: 'center' });
    el.classList.add('sx-flash'); setTimeout(() => el.classList.remove('sx-flash'), 2200);
  }
  // Run after every Settings page is drawn.
  function after() { wireFind(); flash(); dots(); }

  // ---------- the dot in the menu ----------
  // Health gets a dot when a light is amber or red, Backups and team when the backup needs you.
  // Worked out at most once a minute, away from the drawing of the page.
  const DOT = { at: 0, health: 0, backups: false, busy: false };
  function drawDots() {
    document.querySelectorAll('.side .subs a').forEach(a => {
      const r = a.getAttribute('href').slice(1), want = r === 'health' ? DOT.health : r === 'backups' ? DOT.backups : 0;
      const old = a.querySelector('.sx-navdot');
      if (want && !old) a.insertAdjacentHTML('beforeend', `<span class="sx-navdot" title="${r === 'health' ? (DOT.health === 1 ? '1 thing needs a look' : DOT.health + ' things need a look') : 'The backup needs you'}"></span>`);
      else if (!want && old) old.remove();
    });
  }
  async function dots() {
    drawDots();
    if (DOT.busy || Date.now() - DOT.at < 60000) return;
    DOT.busy = true;
    try {
      const L = typeof healthLights === 'function' ? await soon(healthLights(), 12000, []) : [];
      DOT.health = L.filter(l => l[0] === 'warn' || l[0] === 'bad').length;
      const look = typeof PP_SYNC !== 'undefined' && PP_SYNC.supported ? await soon(PP_SYNC.backupLook(), 12000, ['ok']) : ['ok'];
      DOT.backups = look[0] === 'bad' || look[0] === 'warn';
      DOT.at = Date.now();
    } catch (e) { /* no dot */ } finally { DOT.busy = false; }
    drawDots();
  }
  return { ic, tag, chev, chevd, row, fold, group, sw, seg, soon, find, after, dots, drawDots, INDEX, DOT };
})();
{
  // The menu is drawn again on every page: put the dots back each time.
  const old = ppRenderSide;
  ppRenderSide = function (route) { old(route); if ((PP_ROUTES[route] || [])[0] === 'settings') SX.drawDots(); };
  // Remember which rows are folded open, and keep "On / Off" beside a switch right.
  document.addEventListener('toggle', e => { const d = e.target; if (d && d.classList && d.classList.contains('sx-det') && d.id) state.sxFold[d.id] = d.open; }, true);
  document.addEventListener('change', e => { const s = e.target.closest && e.target.closest('.sx-ctl .switch'); if (s && s.previousElementSibling && s.previousElementSibling.classList.contains('wswl')) s.previousElementSibling.textContent = e.target.checked ? 'On' : 'Off'; });
}
const sxHead = title => head('Settings', title, '', SX.find()).replace('class="head"', 'class="head rvhead sx-head"');
ACTS.sxgo = v => {
  const x = SX.INDEX[+v]; if (!x) return;
  state.sxFlash = x[3];
  if (route() === x[2]) render(true); else location.hash = x[2];
};
ACTS.sxbkall = () => { state.sxBkAll = !state.sxBkAll; render(true); };

// ---------------------------------------------------------------- General
V.settings = async () => {
  const { row, fold, group, sw, seg } = SX;
  const name = await getName(), zoomKey = await ppZoomKey();
  const pops = (await api.storage.local.get('ppPopups')).ppPopups !== false;
  const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  return `${sxHead('General')}<div class="sx-page kpn sxp-general"><div class="sx-cols">
    <div class="sx-col">
      ${group('You', row('person', 'Your name', 'Printed as “Collected by” on every pack and report', `<input id="sName" class="sx-in" value="${esc(name)}" placeholder="For example, Ben" aria-label="Your name">`, { id: 'sxName' }))}
      ${group('Look', row('text', 'Text size', 'Ctrl and + or − also works', seg('Text size', 'textsize', TEXT_SIZES.map(([k, l, z]) => [k, l, Math.round(14 * z * 10) / 10]), zoomKey), { id: 'textsize' }) +
        row('moon', 'Colours', 'The moon button at the top does the same', seg('Colours', 'themeset', [['light', 'Light'], ['dark', 'Dark']], theme), { id: 'themeSet' }))}
      ${group('Capturing', fold('popSet', 'popup', 'Close pop-ups before the first screen', 'Cookie notices, newsletter and “open in the app” boxes',
        '<p>PageProof presses the site\'s own close button, and the capture log says what it closed. Log-in walls are left alone.</p>', true, sw('id="sPopups"', pops, 'Close pop-ups')))}
    </div>
    <div class="sx-col">
      ${group('Toolbar and shortcuts',
        fold('sxPin', 'pin', 'Pin PageProof to the toolbar', 'Click the jigsaw piece next to the address bar, then the pin beside PageProof',
          '<p>The icon then stays in the toolbar. Click it for the toolbar menu: <b>Capture this page</b>, the photos on the page, and <b>Open full PageProof</b>.</p>', false) +
        row('key', 'Capture shortcut', 'Captures the page you are on straight away', '<span id="shortcut2" class="sx-keys1"><span class="sx-kbd">Alt</span><span class="sx-plus">+</span><span class="sx-kbd">Shift</span><span class="sx-plus">+</span><span class="sx-kbd">P</span></span><button class="btn kbtn" data-act="shortcuts">Change</button>', { id: 'sxShort' }) +
        fold('sxRc', 'menu', 'Right-click menu', 'Look for PageProof when you right-click',
          '<div class="sx-rc"><div><b>On a photo</b><span>Inspect this photo · Find copies of it (Google Lens, Yandex, Bing or all three) · Save biggest copy · Open biggest copy in a tab</span></div><div><b>Anywhere on the page</b><span>Capture this page</span></div><div><b>On a link</b><span>Capture the linked page</span></div></div>', true))}
      ${group('About', row('shield', 'PageProof ' + esc(VERSION), 'Your captures, settings and lists carry over when PageProof is updated', '<a class="btn kbtn" href="#whatsnew">What’s new</a>', { id: 'sxAbout' }))}
    </div></div></div>`;
};
V.settings.after = async () => {
  SX.after();
  const n = document.getElementById('sName');
  n.onchange = async () => { await setName(n.value.trim()); toast('Saved. New packs say "Collected by ' + (n.value.trim() || '…') + '".'); };
  const pp = document.getElementById('sPopups');
  pp.onchange = async () => { await api.storage.local.set({ ppPopups: pp.checked }); toast(pp.checked ? 'Pop-ups will be closed before each capture.' : 'Pop-ups are left as they are.'); };
  try {
    const c = (await api.commands.getAll()).find(x => x.name === 'capture-page'), el = document.getElementById('shortcut2');
    if (c && el) el.innerHTML = c.shortcut ? c.shortcut.split('+').map(k => `<span class="sx-kbd">${esc(k.trim())}</span>`).join('<span class="sx-plus">+</span>') : '<span class="sx-val">Not set</span>';
  } catch (e) { /* not available here */ }
};
// "In your browser" is part of General now. Its old address still works.
V.browser = async () => { state.sxFlash = 'sxPin'; setTimeout(() => location.replace('#settings'), 0); return ''; };
delete V.browser.after;

// ---------------------------------------------------------------- Searching
V.ssearch = async () => {
  const { row, fold, group, sw, tag, ic } = SX;
  const hw = await ppHardware(), L = hw.limits, k = await FC.keep();
  const st = await api.storage.local.get(['ppAcctRead', 'fcPageAuto', 'ppSearchPlace']);
  const acct = st.ppAcctRead !== false, pageAuto = st.fcPageAuto !== false, place = st.ppSearchPlace === 'pinned' ? 'pinned' : 'window';
  const hr = h => (h % 12 || 12) + (h < 12 || h === 24 ? ' AM' : ' PM');
  const keepSay = (k.on ? 'On' : 'Off') + (k.hours === 'work' ? ' · ' + hr(k.from) + ' to ' + hr(k.to) : '');
  const pick = (v, cls, t, s) => `<button class="sx-pick${place === v ? ' on' : ''}" role="radio" aria-checked="${place === v}" data-act="searchplace" data-v="${v}"><span class="sx-pic ${cls}" aria-hidden="true">${cls === 'win' ? '<i class="w1"></i><i class="w2"><em></em><em></em><em></em></i><b class="min">— minimized</b>' : '<i class="w1"><span class="pt"><em></em><em></em><em></em><em class="own"></em><em class="own"></em></span></i>'}</span><span class="sx-pr"><span class="sx-radio${place === v ? ' on' : ''}"></span><span><b>${t}</b><span>${s}</span></span></span></button>`;
  const tiles = [[L.checks, 'photo ' + (L.checks > 1 ? 'checks' : 'check') + ' at a time'], [L.tabs, 'search ' + (L.tabs > 1 ? 'tabs' : 'tab') + ' open at once'], [L.dl, 'found pictures downloaded at once'], [L.pace, 'fastest Keep searching pace'], [String(L.ram).replace(/^up to /, ''), 'most memory it will use']];
  return `${sxHead('Searching')}<div class="sx-page kpn sxp-search"><div class="sx-cols">
    <div class="sx-col">
      ${group('Where searches run', `<div class="sx-picks" role="radiogroup" aria-label="Where searches run">${pick('window', 'win', 'Separate minimized window', 'Every search tab opens in one small PageProof window, kept minimized, so your own window stays clear')}${pick('pinned', 'pin', 'Pinned tabs', 'Small pinned tabs at the left of your own window, like before')}</div>`, 'sxPlace')}
      ${group('While searching',
        row('acct', 'Read account details by itself', 'Followers, verified and owner company of social accounts, one a minute, only while Keep searching is on', sw('data-act="acctread"', acct, 'Read account details by itself'), { id: 'sxAcct' }) +
        row('page', 'Show their pages by themselves', 'Loads the site’s page in a copy’s panel and keeps a small picture of it', sw('data-act="pageauto"', pageAuto, 'Show their pages by themselves'), { id: 'sxPages' }) +
        row('repeat', 'Keep searching', 'Pace, hours, a goal date and Today’s 50', `<span class="sx-val">${keepSay}</span>`, { id: 'sxKeep', href: 'keep' }))}
    </div>
    <div class="sx-col">
      ${group('This computer',
        row('pc', `${esc(hw.system)} · ${hw.cores} cores · ${hw.memGB} GB memory`, `${hw.freeGB !== null ? hw.freeGB + ' GB free now · ' : ''}checked just now, again every week`, tag(hw.level + ' computer', hw.level === 'Light' ? 'warn' : 'ok'), { id: 'sxPc' }) +
        `<div class="sx-row sx-tilesrow"><div class="sx-tiles" id="sxLimits">${tiles.map(([n, l]) => `<div><b>${esc(n)}</b><span>${l}</span></div>`).join('')}</div></div>` +
        row('speed', 'Speed level', `Today’s 50 takes ${L.fifty} at this level`, `<select id="hwsel" aria-label="Speed level">${[['auto', `Let PageProof decide (${hw.auto})`], ['Light', 'Light: older or busy computer'], ['Normal', 'Normal'], ['Strong', 'Strong: fast computer']].map(([v, l]) => `<option value="${v}" ${hw.choice === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`, { id: 'sxSpeed' }) +
        fold('sxBack', 'pause', 'It also backs off by itself', 'When memory is nearly full or a laptop battery is low',
          '<ul><li>Keep searching pauses while almost all of the memory is in use, or on a laptop running on battery below 30%, and picks up again when that passes.</li><li>Big searches (today\'s 50, a search you start) slow down to one photo check and one search tab at those times instead, so they still finish, and go back to full speed a minute later.</li><li>A busy processor doesn\'t slow searching down: it counts PageProof\'s own photo checks too.</li><li>Never goes over the limits above, even if you pick a faster pace or search speed.</li><li>This only sets how much work your computer does. How often Google, Yandex and Bing are asked stays at the safe search speed, so a stronger computer never causes more robot checks.</li></ul>', true))}
    </div></div></div>`;
};
V.ssearch.after = () => {
  SX.after();
  document.getElementById('hwsel').onchange = async e => { await api.storage.local.set({ ppHw: { choice: e.target.value } }); toast('Speed level saved'); render(true); };
};
// "Your computer" is part of Searching now. Its old address still works.
V.computer = async () => { state.sxFlash = 'sxPc'; setTimeout(() => location.replace('#ssearch'), 0); return ''; };
delete V.computer.after;

// ---------------------------------------------------------------- Backups and team
V.backups = async () => {
  const { row, fold, group, tag, ic, soon } = SX;
  const can = PP_SYNC.supported;
  const st = can ? await PP_SYNC.state('bk') : 'none';
  const [col, txt] = can ? await PP_SYNC.backupLook() : ['grey', 'Backups to Google Drive work in Chrome and Edge.'];
  const bk = (await api.storage.local.get('ppBk')).ppBk;
  const P = state.bkPreview, N = state.bkNow;
  const time = t => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const day = t => { const d = new Date(t), y = new Date(Date.now() - 864e5); return d.toDateString() === new Date().toDateString() ? 'Today, ' + time(t) : d.toDateString() === y.toDateString() ? 'Yesterday, ' + time(t) : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); };

  // The big card at the top: is the backup fine, and the one button that matters now.
  const fine = st === 'granted' && bk && col === 'ok';
  const title = !can ? 'Backups need Chrome or Edge' : st === 'none' ? 'Backups are not set up yet' : st === 'prompt' ? 'One click needed' : st === 'offline' ? 'Google Drive isn’t answering' : !bk ? 'No backup yet'
    : fine ? 'Backed up ' + (new Date(bk.at).toDateString() === new Date().toDateString() ? 'today at ' + time(bk.at) : day(bk.at)) : 'The backup is getting old';
  const sub = fine ? `Every workday, 8 AM to 6 PM, into My Drive › PageProof Backup. The last ${PP_SYNC.KEEP} are kept. Only you can see it.` : esc(txt.replace(/^Not set up\. /, ''));
  const heroBtn = !can ? '' : st === 'granted' ? `<button class="btn primary kbtn" data-act="bknow" ${state.bkBusy ? 'disabled' : ''}>${ic('up', 16)}${state.bkBusy === 'now' ? 'Backing up…' : 'Back up now'}</button>`
    : st === 'prompt' ? '<button class="btn primary kbtn" data-act="bkallow">Allow</button>'
    : st === 'offline' ? '<button class="btn kbtn" data-act="bkretry">Try again</button>'
    : `<button class="btn primary kbtn" data-act="bkpick">Pick My Drive</button>`;
  const hero = `<div class="sx-hero" id="sxHero"><span class="sx-big ${fine ? 'ok' : col === 'bad' ? 'bad' : col === 'grey' ? 'grey' : 'warn'}">${ic('cloud', 34)}</span><span class="sx-tt"><b>${title}</b><span>${sub}</span>${bk && can ? `<span class="sx-faint">${kb(bk.size)} · ${(bk.counts.copies || 0).toLocaleString()} copies · ${(bk.counts.hidden || 0).toLocaleString()} hidden sites</span>` : ''}${st === 'none' && can ? '<span class="sx-faint">In the window, click <b>Google Drive</b>, then <b>My Drive</b>, then <b>Select Folder</b>. PageProof makes a PageProof Backup folder inside it.</span>' : ''}</span><span class="sx-ctl">${heroBtn}</span></div>`;

  // Restore: the newest four, the rest behind "Show all".
  const list = state.bkList || [], shown = state.sxBkAll ? list : list.slice(0, 4);
  const restore = !can ? '' : group('Restore a backup',
    state.bkList == null ? row('restore', st === 'granted' ? 'Looking for backups…' : 'Pick the backup folder first', st === 'granted' ? '' : 'Your backups show up here once PageProof can open the folder')
    : !list.length ? row('restore', 'No backups in the folder yet', 'The first one is made in work hours, or press Back up now')
    : shown.map(b => row('restore', esc(day(b.modified || b.day)) + (b.before ? ' <span class="sx-tag grey">Before a restore</span>' : ''), kb(b.size), `<button class="btn kbtn" data-act="bklook" data-v="${esc(b.name)}">Bring it back</button>`)).join('') +
      (list.length > 4 ? `<button class="sx-row sx-morerow" data-act="sxbkall"><span class="sx-ic"></span><span class="sx-tt"><b>${state.sxBkAll ? 'Show fewer' : 'Show all ' + list.length + ' backups'}</b></span><span class="sx-ctl"><span class="sx-chev${state.sxBkAll ? ' up' : ''}">${ic('chevd', 16)}</span></span></button>` : ''), 'sxRestore');
  const C = [['copies', 'Copies found'], ['stolen', 'Marked Stolen'], ['hidden', 'Hidden sites and accounts'], ['allowed', 'Approved sites and accounts'], ['rejected', 'Rejected links'], ['clients', 'Clients'], ['captures', 'Captures in the log']];
  const preview = !P ? '' : `<section class="card pad sx-preview" id="bkPreview">
    <h2>Bring back the backup from ${esc(fmtDate(P.saved))}?</h2>
    ${P.by ? `<span class="muted" style="font-size:13.5px">Made by ${esc(P.by)}'s PageProof ${esc(P.version || '')}.</span>` : ''}
    <div class="scroll"><table><thead><tr><th></th><th class="num">Now</th><th class="num">After restoring</th></tr></thead><tbody>${C.map(([k2, l]) => { const a = N ? N[k2] : 0, b = (P.counts || {})[k2] || 0; return `<tr><td>${l}</td><td class="num">${(a || 0).toLocaleString()}</td><td class="num"${a !== b ? ' style="font-weight:700"' : ''}>${b.toLocaleString()}</td></tr>`; }).join('')}</tbody></table></div>
    <div class="banner info" style="padding:10px 12px"><span style="flex:1;font-size:14px">${N && (N.copies || N.hidden || N.captures) ? 'Your data right now is saved first as a <b>"Before a restore"</b> backup, so you can go back to it from this list.' : 'There is nothing in PageProof on this computer yet, so nothing is lost.'} Your photos link and Keep searching stay as they are. Preview pictures come back by themselves.</span></div>
    <div class="row" style="gap:8px"><button class="btn primary kbtn" data-act="bkrestore" ${state.bkBusy ? 'disabled' : ''}>${state.bkBusy ? 'Restoring…' : 'Restore'}</button><button class="btn kbtn" data-act="bkcancel">Cancel</button></div></section>`;

  // Team lists
  let team = '';
  if (can) {
    const ts = await PP_SYNC.state('team'), t = (await api.storage.local.get('ppTeam')).ppTeam || {};
    const n = (t.people || []).length;
    team = group('Team lists',
      row('team', ts === 'granted' ? (n > 1 ? 'Sharing with ' + n + ' people' : 'Sharing is on') : 'Share lists with your team', ts === 'granted' ? teamPeopleText(t) + (t.nDisagree ? ` <b class="sx-warn">The team disagrees on ${t.nDisagree}.</b>` : '') : 'Hidden and approved sites and accounts, the same for everyone',
        tag(ts === 'granted' ? 'Sharing' : ts === 'offline' ? 'Drive isn’t answering' : ts === 'prompt' ? 'Needs one click' : 'Not set up', ts === 'granted' ? 'ok' : ts === 'offline' ? 'bad' : ts === 'prompt' ? 'warn' : 'grey') + `<a class="btn kbtn" href="#team">${ts === 'none' ? 'Set it up' : 'Open'}</a>`, { id: 'sxTeam' }) +
      fold('sxTeamHow', 'info', 'How team lists work', 'One PageProof Team folder on Google Drive. Each person saves only their own file',
        '<ul><li>The team lead makes a <b>PageProof Team</b> folder in My Drive and shares it with everyone.</li><li>Each person picks that folder once. PageProof then saves that person\'s hidden and approved sites as one small file with their name.</li><li>Nobody\'s file is ever changed by someone else. PageProof reads all the files and puts the lists together.</li><li>When two people disagree about a site, PageProof asks instead of choosing.</li></ul>', false));
  }

  // The folders PageProof uses. Each answer has a time limit, so a sleeping Drive never blanks the page.
  const d = await FC.drive();
  const ds = d.done ? await soon(FC.driveStateSoft(true), 4000, 'offline') : 'none';
  const docs = await soon(RS_DOCS.state(), 4000, 'none');
  const photos = row('drive', 'Your photos', esc(d.done ? d.label : 'Not connected yet') + ' · read only',
    ds === 'granted' ? tag('Connected', 'ok') + '<button class="btn kbtn" data-act="drivepick">Pick again</button>'
    : ds === 'prompt' ? tag('Needs one click', 'warn') + '<button class="btn primary kbtn" data-act="driveallow">Allow</button>'
    : ds === 'offline' ? tag('Isn’t answering', 'bad') + '<button class="btn kbtn" data-act="driveretry">Try again</button><button class="btn kbtn" data-act="drivepick">Pick again</button>'
    : tag('Not set up', 'grey') + '<a class="btn primary kbtn" href="#connect">Connect</a>', { id: 'sxPhotos' });
  const docsRow = row('folder', 'PageProof folder', 'Documents › PageProof · lists as text files, so they survive updates',
    docs === 'granted' ? tag('Connected', 'ok') + '<button class="btn kbtn" data-act="docschoose">Change</button>'
    : docs === 'prompt' ? tag('Needs one click', 'warn') + '<button class="btn primary kbtn" data-act="docsallow">Allow</button>'
    : tag('Not set up', 'warn') + '<button class="btn primary kbtn" data-act="docschoose">Set it up</button>', { id: 'sxDocs' });
  const bkRow = !can ? '' : row('cloud', 'Backup folder', 'My Drive › PageProof Backup',
    st === 'granted' ? tag('Connected', 'ok') + '<button class="btn kbtn" data-act="bkpick">Change</button>'
    : st === 'prompt' ? tag('Needs one click', 'warn') + '<button class="btn primary kbtn" data-act="bkallow">Allow</button>'
    : st === 'offline' ? tag('Isn’t answering', 'bad') + '<button class="btn kbtn" data-act="bkretry">Try again</button><button class="btn kbtn" data-act="bkpick">Pick again</button>'
    : tag('Not set up', 'grey') + '<button class="btn kbtn" data-act="bkpick">Pick My Drive</button>', { id: 'sxBkFolder' });

  // Moving to a new computer: the three steps, folded under one row.
  const today = bk && new Date(bk.at).toDateString() === new Date().toDateString();
  const moving = !can ? '' : group('New computer', fold('sxMoving', 'move', 'Moving to a new computer', 'Three guided steps: back up here, install PageProof there, then bring your work back',
    `<ol class="sx-steps">
      <li><b>On this computer: back up</b><span>${today ? 'Done today at ' + time(bk.at) + '. You’re ready.' : 'Saves everything to your own Google Drive.'}</span>${today ? tag('Done', 'ok') : st === 'granted' ? '<button class="btn kbtn" data-act="bknow">Back up now</button>' : '<span class="sx-faint">Set up the backup at the top of this page first.</span>'}</li>
      <li><b>On the new computer: install PageProof</b><span>Install <b>Google Drive for desktop</b> (<a href="https://www.google.com/drive/download/" target="_blank" rel="noopener">google.com/drive/download</a>) and sign in with your work account. Ask your team lead for the newest <b>PageProof.zip</b> and unzip it into <span class="gpath">Documents\\PageProof\\Install</span>. Open <span class="gpath">edge://extensions</span> (or <span class="gpath">chrome://extensions</span>), turn on <b>Developer mode</b>, press <b>Load unpacked</b> and pick the <b>Install</b> folder. PageProof opens first-time setup by itself.</span></li>
      <li><b>On the new computer: bring your work back</b><span>In first-time setup, step 3 (<b>Back up and share</b>), press <b>Pick My Drive</b>. PageProof finds your backups. Press <b>Bring it back</b> next to the newest one, check the numbers, then <b>Restore</b>. Pick your photos folder again in <b>Connect your photos</b> (your ticked folders come back with the backup), and the <b>PageProof Team</b> folder if your team shares lists.</span></li>
    </ol>`, false));

  return `${sxHead('Backups and team')}<div class="sx-page kpn sxp-backup">${preview}<div class="sx-cols">
    <div class="sx-col">${hero}${restore}</div>
    <div class="sx-col">${team}${group('Folders PageProof uses', photos + docsRow + bkRow)}${moving}</div>
  </div></div>`;
};
V.backups.noAutoRedraw = true;
V.backups.after = async () => {
  SX.after();
  if (!PP_SYNC.supported || state.bkList != null || state.bkListing) return;
  state.bkListing = true;
  try { state.bkList = (await PP_SYNC.list()) || null; if (state.bkList && state.shown === 'backups') render(true); }
  finally { state.bkListing = false; }
};
// "Moving to a new computer" is a fold on Backups and team now. Its old address still works.
V.moving = async () => { state.sxFold.sxMoving = true; state.sxFlash = 'sxMoving'; setTimeout(() => location.replace('#backups'), 0); return ''; };

// ---------------------------------------------------------------- Site lists: the two lists PageProof downloads
// (The rest of Site lists is drawn in app.js.) Shown as two rows above the tabs.
async function sxLists() {
  const { tag, ic } = SX;
  const day = t => t ? new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
  let h = '';
  if (typeof PP_POP !== 'undefined') {
    const i = await PP_POP.info();
    h += `<div class="sx-row"><span class="sx-ic">${ic('chart')}</span><span class="sx-tt"><b>Site popularity list</b><span>${i.date ? `Tranco top ${(i.n || 0).toLocaleString()} sites · ${day(i.date)} · gives each copy a Top 1K to Top 1M tag` : 'Not downloaded yet (a few MB, once a week)'}${i.err ? ' · last try failed: ' + esc(i.err) : ''}</span></span><span class="sx-ctl">${i.date && !i.err ? tag('Ready', 'ok') : ''}<button class="btn kbtn" data-act="popnow" ${PP_POP.busy() ? 'disabled' : ''}>${ic('down', 16)}${PP_POP.busy() ? 'Downloading…' : 'Download now'}</button></span></div>`;
  }
  if (typeof PP_BAD !== 'undefined') {
    const i = await PP_BAD.info(), src = i.src || {};
    const parts = PP_BAD.SOURCES.map(s => src[s.id] && src[s.id].n ? `${s.name} ${src[s.id].n.toLocaleString()}` + (src[s.id].err ? ' (last try failed)' : '') : `${s.name}: ${src[s.id] && src[s.id].err ? 'failed, ' + src[s.id].err : 'not yet'}`);
    h += `<div class="sx-row"><span class="sx-ic">${ic('warn')}</span><span class="sx-tt"><b>Known bad site lists</b><span>${esc(parts.join(' · '))}${i.date ? ' · ' + day(i.date) : ''} · their copies get a red tag</span></span><span class="sx-ctl">${i.date ? tag('Ready', 'ok') : ''}<button class="btn kbtn" data-act="badnow" ${PP_BAD.busy() ? 'disabled' : ''}>${ic('down', 16)}${PP_BAD.busy() ? 'Downloading…' : 'Download now'}</button></span></div>`;
  }
  return h ? `<div class="sx-dl kpn" id="sxLists">${h}</div>` : '';
}
{
  const old = V.hidden, oldAfter = V.hidden.after;
  let dl = '';
  V.hidden = async () => { dl = await sxLists(); return old(); };
  V.hidden.after = () => {
    const hd = document.querySelector('#view .head');
    if (hd && dl && !document.getElementById('sxLists')) hd.insertAdjacentHTML('afterend', dl);
    if (oldAfter) oldAfter();
    SX.after();
  };
}
