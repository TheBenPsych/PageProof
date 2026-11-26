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
    clock: '<circle cx="8" cy="8" r="6.2"/><path d="M8 4.6V8l2.4 1.6"/>',
    photo: '<rect x="1.8" y="2.8" width="12.4" height="10.4" rx="1"/><circle cx="5.6" cy="6.3" r="1.2"/><path d="m1.8 11.4 3.4-3 2.6 2.2 2.4-2 4 3"/>',
    skip: '<path d="M3 3.5 9 8l-6 4.5zM12 3.5v9"/>',
    sign: '<path d="M6 2.5H3v11h3M10.5 11 13.5 8l-3-3M13.5 8H6"/>',
    book: '<path d="M2 3.2c2.2-.6 4.2-.3 6 1 1.8-1.3 3.8-1.6 6-1v9.6c-2.2-.6-4.2-.3-6 1-1.8-1.3-3.8-1.6-6-1zM8 4.2v9.6"/>',
    tour: '<path d="M3 14V2.5M3 3h8.5l-1.8 2.5L11.5 8H3"/>',
    redo: '<path d="M13.4 8a5.4 5.4 0 1 1-1.6-3.8M13.4 2.6v2.8h-2.8"/>',
    star: '<path d="m8 1.8 1.9 3.9 4.2.6-3 3 .7 4.2L8 11.5l-3.8 2 .7-4.2-3-3 4.2-.6z"/>',
    copy: '<rect x="2" y="4.5" width="8" height="9" rx="1"/><path d="M5 4.5V3a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-3"/>',
    file: '<path d="M4 1.8h5.5L12.5 5v9.2H4z"/><path d="M9.5 1.8V5h3M8 7.5v4.5M6 10l2 2 2-2"/>',
    bin: '<path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4"/>', plus: '<path d="M8 3v10M3 8h10"/>',
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
    ['Right now', 'health is everything working lights sign in', 'health', ''], ['Space used', 'storage room free up space clear', 'health?tab=space', ''], ['Where the time goes', 'speed slow fast checker', 'health', 'sxTime'], ['Stats', 'how pageproof is doing numbers', 'stats', ''],
    ['Tutorial and help', 'guide learn about', 'help', ''], ['Keyboard keys', 'shortcuts', 'help', ''], ['Run setup again', 'first time', 'setup', ''],
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
// Shown as two rows above the tabs.
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
    h += `<div class="sx-row"><span class="sx-ic">${ic('warn')}</span><span class="sx-tt"><b>Known bad site lists</b><span>${i.date ? esc(parts.join(' · ')) + ' · ' + day(i.date) + ' · their copies get a red tag' : 'Not downloaded yet · free public lists of piracy, scam, phishing and malware sites'}</span></span><span class="sx-ctl">${i.date ? tag('Ready', 'ok') : ''}<button class="btn kbtn" data-act="badnow" ${PP_BAD.busy() ? 'disabled' : ''}>${ic('down', 16)}${PP_BAD.busy() ? 'Downloading…' : 'Download now'}</button></span></div>`;
  }
  return h ? `<div class="sx-dl kpn" id="sxLists">${h}</div>` : '';
}

// ---------------------------------------------------------------- Site lists
// Hidden sites, approved sites, rejected links, stolen-before links and the social platforms.
// The lists and what the buttons do are the same as before (the buttons' work lives in app.js).
const SX_KINDS = ['All', 'Whole site', 'Sub-site', 'Account or part', 'Ending'];
V.hidden = async () => {
  const { ic, group, sw } = SX;
  await RS_LISTS.load();
  const tab = state.hidTab, q = state.hidQ.toLowerCase();
  const perClient = [];
  for (const c of await FC.DB.all('clients')) for (const x of c.licensed || []) perClient.push(x + ' | ' + c.name);
  await RS_STOLEN.load(); await PP_SOCIAL.ready;
  const plats = new Map();
  for (const [d, [name]] of Object.entries(PP_SOCIAL.SITES)) { if (!plats.has(name)) plats.set(name, []); plats.get(name).push(d); }
  const T = [['hidden', 'Hidden', RS_LISTS.hidden.length], ['allowed', 'Approved for every client', RS_LISTS.allowed.length], ['client', 'Approved for one client', perClient.length], ['rejected', 'Rejected links', RS_REJECT.items.length], ['stolen', 'Stolen before links', RS_STOLEN.items.length], ['social', 'Social sites', plats.size]];
  const tabs = `<div class="sx-pivot"><div class="utabs" role="tablist">${T.map(([k, l, n]) => `<button role="tab" class="${tab === k ? 'on' : ''}" aria-selected="${tab === k}" data-act="hidtab" data-v="${k}">${l} <span>${n.toLocaleString()}</span></button>`).join('')}</div></div>`;
  const flat = tab === 'rejected' || tab === 'client' || tab === 'stolen';
  const findBox = ph => `<label class="sx-search">${ic('search', 16)}<input id="hidq" type="search" placeholder="${ph}" value="${esc(state.hidQ)}" aria-label="${ph}" autocomplete="off"></label>`;
  const b = (act, icon, t, cls = '') => `<button class="btn kbtn${cls}" data-act="${act}">${icon ? ic(icon, 16) : ''}${t}</button>`;
  const top = `${sxHead('Site lists')}<div class="sx-page kpn sxp-sites">${await sxLists()}${tabs}`;
  const saved = `<p class="sx-note">${RS_LISTS.fileState === 'granted' ? 'Saved in Documents › PageProof as hidden-sites.txt, allowed-sites.txt, rejected-links.txt and stolen-links.txt.' : 'Saved in this browser. <a href="#backups">Set up the PageProof folder</a> to also keep them as text files that survive a reinstall.'}</p>`;

  // Social sites: the fixed list of platforms.
  if (tab === 'social') {
    const rows = [...plats].filter(([n, ds]) => !q || n.toLowerCase().includes(q) || ds.some(d => d.includes(q)));
    const readOn = (await api.storage.local.get('ppAcctRead')).ppAcctRead !== false;
    return `${top}
      <div class="sx-cmd"><span class="sx-note" style="flex:1 1 300px">Only these ${plats.size} platforms count as social media. Every other site (blogs, video sites, forums, chat apps...) shows on the Websites tab like any website, and can be hidden as a whole site.</span>${findBox('Find a platform, like vimeo')}</div>
      <div class="sx-list sx-l2"><div class="sx-lhead"><span>Platform</span><span>Web addresses it covers</span></div>
        ${rows.map(([n, ds]) => `<div class="sx-lrow"><span class="sx-site">${esc(n)}</span><span class="sx-addr">${esc(ds.join(', '))}${n === 'Pinterest' || n === 'Nextdoor' ? ' + country sites' : ''}<em>and their mobile and sub-sites (m., mobile., www.)</em></span></div>`).join('') || '<div class="sx-lempty">No platform matches. That site counts as a website.</div>'}
      </div>
      ${group('', `<div class="sx-row"><span class="sx-ic">${ic('acct')}</span><span class="sx-tt"><b>Read account details by itself</b><span>Followers, verified, account type, country and owner company. PageProof opens each account's profile in a background tab of your browser for a few seconds, one account a minute (X: one every 2 minutes, 30 a day), every 90 days, only for copies still to review, only while Keep searching is on and inside its hours (Pause stops it too). Off: only when you press "Read again now" on an account.</span></span><span class="sx-ctl">${sw('id="acctread" data-act="acctread"', readOn, 'Read account details by itself')}</span></div>`)}
      <p class="sx-note">Copies on social sites go on the Social media tab of Copies found, where Stolen, Hide and Approve work per account. Saved with your settings backup.</p></div>`;
  }

  const list = tab === 'rejected' ? RS_REJECT.items.map(r => r.url) : tab === 'client' ? perClient.sort().reverse() : tab === 'stolen' ? RS_STOLEN.items : RS_LISTS[tab];
  const rows = [...list].reverse().filter(x => x.toLowerCase().includes(q) && (flat || state.hidKind === 'All' || kindOf(x) === state.hidKind));
  const page = rows.slice(0, state.hidMore || 100);
  const imports = flat && tab !== 'stolen' ? [] : (await RS_IMPORTS.all()).filter(e => e.kind === tab);
  // Who added it: a teammate, a file you added, or you.
  const fromFile = new Map();
  for (const e of imports) if (e.op === 'add' && !e.undone) for (const x of e.sites) fromFile.set(x, e.at);
  const sday = t => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const who = h => { const t = typeof ppTeamTag === 'function' ? ppTeamTag(h, tab).replace(/<[^>]+>/g, '').trim() : ''; if (t) { const [a, d] = t.split(', '); return `${esc(a)}${d ? `<em>${esc(d)}</em>` : ''}`; } return fromFile.has(h) ? `From a file<em>${sday(fromFile.get(h))}</em>` : 'You'; };
  const undo = (h, t) => `<button class="btn kbtn" data-act="hidremove" data-v="${esc(h)}">${ic('repeat', 16)}${t}</button>`;
  const cols = tab === 'stolen' ? ['Link', '', ''] : tab === 'rejected' ? ['Link', 'Photo', ''] : tab === 'client' ? ['Site', 'Approved for', ''] : ['Site or account', 'What it covers', 'Added'];
  const line = h => {
    if (tab === 'stolen') return `<div class="sx-lrow"><a class="sx-site sx-link" href="${esc(h)}" target="_blank" rel="noreferrer">${esc(h)}</a><span></span><span></span><span class="sx-lact">${undo(h, 'Take off the list')}</span></div>`;
    if (tab === 'client') { const [site, w] = h.split(' | '); return `<div class="sx-lrow"><span class="sx-site">${esc(site)}</span><span class="sx-who">${esc(w)}</span><span></span><span class="sx-lact">${undo(h, 'Remove')}</span></div>`; }
    if (tab === 'rejected') { const r = RS_REJECT.items.find(x => x.url === h); return `<div class="sx-lrow"><span class="sx-site sx-link">${esc(h)}</span><span class="sx-who">${esc((r && r.pic) || 'every photo')}</span><span></span><span class="sx-lact">${undo(h, 'Bring back')}</span></div>`; }
    return `<div class="sx-lrow"><span class="sx-site">${esc(h)}</span><span><span class="sx-kind">${kindOf(h)}</span></span><span class="sx-who">${who(h)}</span><span class="sx-lact">${typeof ppTeamBtn === 'function' ? ppTeamBtn(h, tab) : ''}${undo(h, tab === 'hidden' ? 'Show again' : 'Remove')}</span></div>`;
  };
  const cmd = `<div class="sx-cmd">
    ${!flat ? b('hidadd', 'plus', tab === 'hidden' ? 'Hide a site' : 'Approve a site', ' primary') : ''}${b('hidload', 'file', 'Add from a file', tab === 'stolen' ? ' primary' : '')}${b('hidsave', 'down', 'Download list')}${flat && tab !== 'stolen' ? '' : b('hidunload', 'bin', 'Take out a file’s sites')}
    <span class="sp"></span>${findBox(tab === 'stolen' ? 'Find a link' : tab === 'rejected' ? 'Find a rejected link' : tab === 'client' ? 'Find a site or a client' : 'Find or add a site, like patch.com or x.com/examplenews')}
    ${!flat ? `<select data-act="sxkind" aria-label="What it covers">${SX_KINDS.map(k => `<option value="${k}" ${state.hidKind === k ? 'selected' : ''}>${k === 'All' ? 'All kinds' : k}</option>`).join('')}</select>` : ''}</div>`;
  const note = tab === 'client' ? 'Add one from a copy: open it in Copies found and press Approve site.'
    : tab === 'stolen' ? 'Pages you already dealt with. A copy found on one of them gets a red Stolen before tag in Copies found, and its site counts as a repeat offender. Add them with Add from a file.'
    : tab === 'hidden' ? 'Hidden sites never show up in any search. To hide one, type it in the box and press Hide a site.'
    : tab === 'allowed' ? 'Approved sites may use the photos: copies found there are marked Licensed by themselves.' : 'Links you said are not a copy. They never come back for that photo.';
  const files = flat && tab !== 'stolen' ? '' : group('Files you added', (imports.map(e => { const live = (e.op === 'add') === !e.undone; return `<div class="sx-row"><span class="sx-ic">${ic('file')}</span><span class="sx-tt"><b>${esc(e.name)}</b><span>${e.op === 'add' ? 'Added' : 'Took out'} ${e.sites.length.toLocaleString()} ${tab === 'stolen' ? 'links' : 'sites'} · ${fmtDate(e.at)}${e.undone ? ' · <b>undone ' + fmtDate(e.undone) + '</b>' : ''}</span></span><span class="sx-ctl"><button class="btn kbtn${live && e.op === 'add' ? ' primary' : ''}" data-act="impundo" data-v="${esc(e.id)}">${e.op === 'add' ? (live ? 'Undo this import' : 'Add them again') : (live ? 'Put them back' : 'Take them out again')}</button></span></div>`; }).join('') || `<div class="sx-row"><span class="sx-ic">${ic('file')}</span><span class="sx-tt"><b>No files added yet</b></span><span class="sx-ctl"></span></div>`) +
    `<p class="sx-note" style="margin:8px 2px 0">${imports.length ? 'Undo takes out only the sites that file added. Sites that were on the list before stay. ' : ''}Added a file before PageProof kept this list? Press "Take out a file’s sites" and pick the same file: only the sites it added come out.</p>`, 'sxFiles');
  return `${top}${cmd}<p class="sx-note">${note}</p>
    <div class="sx-list${tab === 'stolen' ? ' sx-l1' : ''}"><div class="sx-lhead"><span>${cols[0]}</span><span>${cols[1]}</span><span>${cols[2]}</span><span></span></div>
      ${page.map(line).join('') || `<div class="sx-lempty">${q ? (flat ? 'Nothing matches.' : 'Nothing matches. Press the button to add it.') : 'This list is empty.'}</div>`}
      <div class="sx-more">${rows.length > page.length ? '<button class="btn kbtn" data-act="hidmore">Show more</button>' : ''}<span>Showing ${page.length.toLocaleString()} of ${rows.length.toLocaleString()}</span></div></div>
    ${files}${saved}</div>`;
};
V.hidden.after = () => {
  SX.after();
  const i = document.getElementById('hidq');
  i.oninput = () => { state.hidQ = i.value; state.hidMore = 0; render(true).then(() => { const j = document.getElementById('hidq'); j.focus(); j.setSelectionRange(j.value.length, j.value.length); }); };
  i.onkeydown = e => { if (e.key === 'Enter' && state.hidTab === 'social') return; else if (e.key === 'Enter' && !['rejected', 'client', 'stolen'].includes(state.hidTab)) act('hidadd'); };
};
ACTS.sxkind = (v, el) => { state.hidKind = el.value; render(true); };

// ---------------------------------------------------------------- Help and about
V.help = async () => {
  const { ic, row, group } = SX;
  const tile = (c, icon, t, d, attrs, tagName = 'button') => `<${tagName} class="sx-tile" ${attrs}><span class="sx-sti" style="color:${c}">${ic(icon, 32)}</span><b>${t}</b><span>${d}</span></${tagName}>`;
  const key = (k, t) => `<span><span class="sx-kbd">${k}</span>${t}</span>`;
  return `${sxHead('Help and about')}<div class="sx-page kpn sxp-help">
    <div class="sx-about" id="sxAboutCard"><img src="icons/icon128.png" width="64" height="64" alt=""><span class="sx-tt"><b>PageProof ${esc(VERSION)}</b><span>Your captures, settings and lists carry over when PageProof is updated · new versions come from your team lead</span></span><span class="sx-ctl"><button class="btn kbtn" data-act="sxcopyver">${ic('copy', 16)}Copy version</button></span></div>
    <div class="sx-cols">
      <div class="sx-col">${group('What’s new', NEWS.slice(0, 5).map(([t, d]) => row('star', t, d)).join('') + `<a class="sx-row sx-morerow" href="#whatsnew"><span class="sx-ic"></span><span class="sx-tt"><b>See all ${NEWS.length} changes</b></span><span class="sx-ctl">${SX.chev}</span></a>`, 'sxNews')}</div>
      <div class="sx-col">
        ${group('Learn PageProof', `<div class="sx-start">
          ${tile('#0067C0', 'book', 'Tutorial', 'Capture, find copies, inspect, compare, mark up, one step at a time', 'href="https://github.com/TheBenPsych/PageProof/blob/main/TUTORIAL.md" target="_blank" rel="noopener"', 'a')}
          ${tile('#8250DF', 'tour', 'Take the tour', 'Five quick stops around this page', 'data-act="tour"')}
          ${tile('#0F7B0F', 'shield', 'Checking a pack', 'How anyone can check an evidence pack was not changed', 'href="https://github.com/TheBenPsych/PageProof/blob/main/VERIFYING.md" target="_blank" rel="noopener"', 'a')}
          ${tile('#C27C00', 'redo', 'Run setup again', 'Your name, the PageProof folder, a computer check', 'href="#setup"', 'a')}
          ${tile('#C239B3', 'key', 'Keyboard keys', 'Press ? anywhere', 'data-act="keyhelp"')}</div>`, 'sxLearn')}
        ${group('Keyboard keys', `<div class="sx-keys">${key('Y', 'Stolen')}${key('L', 'Licensed')}${key('N', 'Remove')}${key('U', 'Undo')}${key('/', 'Search')}${key('?', 'All keys')}</div>`, 'sxKeys')}
      </div></div></div>`;
};
V.help.after = () => SX.after();
ACTS.sxcopyver = async () => {
  try { await navigator.clipboard.writeText('PageProof ' + VERSION); toast('Copied: PageProof ' + VERSION); }
  catch (e) { toast('Could not copy here. The version is PageProof ' + VERSION + '.'); }
};
// Every change, newest first. Opens by itself once after an update.
V.whatsnew = async () => `${sxHead('What’s new in PageProof ' + esc(VERSION))}<div class="sx-page kpn sxp-news">
  <div class="sx-cmd"><span class="sx-note" style="flex:1">Shown once after each update. Your captures, settings and lists carry over.</span><button class="btn primary kbtn" data-act="newsseen">Got it</button></div>
  <div class="sx-stack">${NEWS.map(([t, d]) => SX.row('star', t, d, '', { cls: 'sx-news' })).join('')}</div>
  <div><button class="btn primary kbtn" data-act="newsseen">Got it</button></div></div>`;
V.whatsnew.after = () => SX.after();

// ---------------------------------------------------------------- Health
// One page with three tabs: Right now (the lights), Stats (ui/fc-stats.js draws its inside) and
// Space used. The lights themselves, the support details and the space measuring are worked out
// in ui/fc-health.js as before; this only draws them.
function sxHealthFrame(cur, right, body, cls = '') {
  const n = SX.DOT.health;
  const tabs = [['now', 'Right now', n], ['stats', 'Stats', 0], ['space', 'Space used', 0]];
  return `${sxHead('Health')}<div class="sx-page kpn sxp-health ${cls}">
    <div class="sx-pivot sx-hpivot"><div class="utabs" role="tablist">${tabs.map(([k, l, c]) => `<button role="tab" class="${k === cur ? 'on' : ''}" aria-selected="${k === cur}" data-act="sxhtab" data-v="${k}">${l}${c ? ` <span class="sx-tabwarn" title="${c === 1 ? '1 thing needs a look' : c + ' things need a look'}">${c}</span>` : ''}</button>`).join('')}</div><span class="sp"></span>${right || ''}</div>
    ${body}</div>`;
}
ACTS.sxhtab = v => { location.hash = v === 'stats' ? 'stats' : v === 'space' ? 'health?tab=space' : 'health'; };
const SX_LIGHT_ICON = [[/^Google Drive/, 'drive'], [/^Computer clock/, 'clock'], [/^Backup to Google Drive/, 'cloud'], [/^Backup in Documents/, 'folder'], [/^Team lists/, 'team'], [/^Preview pictures/, 'photo'], [/^PageProof version/, 'shield'],
  [/^Keep searching/, 'repeat'], [/^Last photo searched/, 'search'], [/^Skipped photos/, 'skip'], [/^Stats/, 'chart'], [/^(Google Lens|Yandex|Bing)/, 'search'], [/^Signed in/, 'sign']];
const SX_SAY = { ok: 'Working', warn: 'Needs a look', bad: 'Stopped', grey: 'Not in use' };
V.health = async () => {
  const { ic, group, fold, tag } = SX;
  if (routeArg('tab') === 'space') return sxHealthFrame('space', '', sxSpace(), 'sxp-space');
  const lights = await healthLights();
  const bad = lights.filter(l => l[0] === 'bad'), warn = lights.filter(l => l[0] === 'warn');
  SX.DOT.health = bad.length + warn.length; SX.DOT.at = Math.max(SX.DOT.at, Date.now() - 50000);
  const isSign = t => /^Signed in: /.test(t), isSite = t => /^(Google Lens|Yandex|Bing)/.test(t), isSearch = t => /^(Keep searching|Last photo searched|Skipped photos|Stats)$/.test(t);
  const L = ([c, title, text, btn]) => `<div class="sx-row sx-light ${c}"><span class="sx-ic">${ic((SX_LIGHT_ICON.find(x => x[0].test(title)) || [0, 'info'])[1])}</span><span class="sx-tt"><b>${esc(title.replace(/^Signed in: /, ''))}</b><span>${esc(text)}</span></span><span class="sx-ctl">${btn || ''}<span class="sx-dot ${c}" role="img" aria-label="${SX_SAY[c]}"></span></span></div>`;
  const rows = test => lights.filter(l => test(l[1])).map(L).join('');
  // The bar on top: what needs you first, with its button.
  const need = [...bad, ...warn], first = need.find(l => l[3]) || need[0];
  const tone = bad.length ? 'bad' : warn.length ? 'warn' : 'ok';
  const bar = `<div class="kbar sx-bar ${tone}" id="sxHealthBar" role="status"><span class="ksq" style="--c:${tone === 'bad' ? '#C42B1C' : tone === 'warn' ? '#9D5D00' : '#0F7B0F'};width:28px;height:28px">${ic(tone === 'ok' ? 'check' : 'warn', 16)}</span><div><b>${bad.length ? plural(bad.length, 'thing has', 'things have') + ' stopped' : warn.length ? plural(warn.length, 'thing needs', 'things need') + ' a look' : 'Everything is working'}</b><span>${bad.length && warn.length ? `and ${warn.length} more ${warn.length === 1 ? 'needs' : 'need'} a look. ` : ''}${first ? esc(first[1].replace(/^Signed in: /, 'Sign in to ')) + ': ' + esc(first[2]) : 'Every light below is green or not in use yet.'}</span></div><span class="sp"></span>${need.filter(l => l[3]).slice(0, 2).map(l => /^Signed in: /.test(l[1]) ? l[3].replace(/>Sign in</, '>Sign in to ' + esc(l[1].slice(11).replace(/ \(.*/, '')) + '<') : l[3]).join('')}</div>`;
  // Where the time goes (4.16), folded away.
  const t = await timeSums();
  const tr = (label, k) => { const a = t && t.avg(k); return `<div><span>${label}</span><b>${a == null ? '–' : msText(a) + ' each'}</b><em>${t ? t.sum[k][0].toLocaleString() + ' times' : ''}</em></div>`; };
  const time = fold('sxTime', 'speed', 'Where the time goes', t ? esc(timeSlowest(t)) || 'How long each step of a search takes on this computer, last 7 days' : 'How long each step of a search takes. It fills in after the next search',
    `<div class="sx-facts">${tr('Search sites (one photo on one site)', 'search')}${tr('Downloading a found picture', 'dl')}${tr('Checking a found picture against your photo', 'check')}${tr('Waiting for a free checker', 'wait')}
      <div><span>Links on your hidden sites, skipped without downloading</span><b>${t ? t.sum.skipped.toLocaleString() : '–'}</b><em></em></div>
      <div><span>Times a search slowed down because the computer was busy</span><b>${t ? t.sum.eased.toLocaleString() : '–'}</b><em></em></div>
      <div><span>Graphics card (lines up real copies faster)</span><b>${!t || t.gpu == null ? 'Not used yet' : t.gpu ? 'In use' : 'Not available on this computer'}</b><em></em></div></div>
      ${t && t.fast === false ? '<p style="margin-top:10px">The fast checker could not start in this browser, so the slower one is used. Results are the same.</p>' : ''}`,
    false, tag(!t || t.fast == null ? 'Not measured yet' : t.fast ? 'Fast checker on' : 'Fast checker off', t && t.fast === false ? 'warn' : t && t.fast ? 'ok' : 'grey'));
  const support = state.support ? `<div class="sx-group" id="sxSupport"><h3>Details for support <em>copied · numbers and settings only: no photo names, client names, sites or folder paths</em></h3><textarea readonly class="sx-support">${esc(state.support)}</textarea></div>` : '';
  const right = `<button class="btn kbtn" data-act="healthagain">${ic('repeat', 16)}Check again</button><button class="btn kbtn" data-act="supportcopy">${ic('copy', 16)}Copy details for support</button>`;
  return sxHealthFrame('now', right, `${bar}<div class="sx-cols">
    <div class="sx-col">${group('Your computer', rows(x => !isSign(x) && !isSite(x) && !isSearch(x)), 'sxHComputer')}${group('Searching', rows(isSearch) + time, 'sxHSearching')}</div>
    <div class="sx-col">${group('Search sites', rows(isSite), 'sxHSites')}${group('Sign-ins <em>optional, but social sites show more when signed in</em>', rows(isSign), 'sxHSign')}</div>
  </div>${support}`);
};
V.health.after = () => SX.after();
// Space used: measured only when this tab is open (it reads every stored picture's size).
function sxSpace() {
  const { ic, group } = SX;
  const s = state.storage;
  if (!s) {
    if (!state.storageBusy) { state.storageBusy = true; ppStorage().then(r => { state.storage = r; }, e => { state.storage = { error: e.message || String(e) }; }).then(() => { state.storageBusy = false; if (state.shown === 'health') render(true); }); }
    return `<div class="sx-hero sx-space" id="storage"><span class="sx-tt"><b>Measuring…</b><span>Adding up the pictures PageProof keeps in this browser.</span></span></div>`;
  }
  if (s.error) return `<div class="sx-hero sx-space" id="storage"><span class="sx-tt"><b>Could not measure it right now</b><span>${esc(s.error)}</span></span></div>`;
  const pick = state.stPick || (state.stPick = {});
  const opts = [
    ['ans', 'Kept pictures for copies you answered Licensed or Removed', s.ans.kept.length + s.ans.pages.length, s.ans.bytes, 'Their copy and the picture of their page. The answer and the link stay'],
    ['old', 'Pictures of their pages older than 3 months', s.old.pages.length, s.old.bytes, 'Only copies you have not answered. PageProof can take it again'],
    ['caps', 'Captures from before today still held in the browser', s.caps.old.length, s.caps.oldBytes, 'Your saved evidence packs are files on your computer and are not touched'],
  ];
  const chosen = opts.filter(o => pick[o[0]] && o[2]), total = chosen.reduce((a, o) => a + o[3], 0);
  const pct = s.quota ? Math.min(100, s.used / s.quota * 100) : 0;
  const COL = { kept: '#0067C0', pages: '#00818A', prev: '#8250DF', caps: '#C27C00', rest: '#8A8A8A' };
  const count = { kept: ' (' + s.kept.n.toLocaleString() + ')', pages: ' (' + s.pages.n.toLocaleString() + ')', prev: ' (' + s.prev.n.toLocaleString() + ')', caps: ' (' + s.caps.n + ' of the 10 most recent)' };
  const g = s.guard || { u: {} }, unl = (api.runtime.getManifest().permissions || []).includes('unlimitedStorage');
  const fail = g.fail ? `<div class="kbar sx-bar bad" role="alert" id="stFail"><span class="ksq" style="--c:#C42B1C;width:28px;height:28px">${ic('warn', 16)}</span><div><b>Some changes could not be saved</b><span>${g.fail.n} times, last ${esc(new Date(g.fail.at).toLocaleString())}${g.fail.quota ? '. The browser said its storage is full. Free up space below.' : '.'}</span></div><span class="sp"></span><button class="btn kbtn" data-act="stfailok">Got it</button></div>` : '';
  return `${fail}<div class="sx-cols" id="storage">
    <div class="sx-col">
      <div class="sx-hero sx-space"><span class="sx-tt"><b class="sx-num">${sizeText(s.used)}</b><span>${s.quota ? `used of the ${sizeText(s.quota)} your browser allows on this computer · ` : ''}${pct > 80 ? 'getting full' : 'plenty of room'}</span>
        <span class="sx-bar2" role="img" aria-label="What the space is used for">${STORE_PARTS.map(([k, l]) => s.sizes[k] ? `<i style="flex:${Math.max(s.sizes[k], s.used / 150)} 0 0;background:${COL[k]}" title="${l}: ${sizeText(s.sizes[k])}"></i>` : '').join('')}</span>
        <span class="sx-faint" id="stGuard">Settings and lists: ${g.u.local != null ? sizeText(g.u.local) : 'not known'} · ${unl ? 'no size limit' : 'limit 10 MB'} · ${g.u.persisted ? 'kept safe from the browser\'s clean-up' : 'the browser may clear it when the disk is full'}</span></span></div>
      ${group('What it is', STORE_PARTS.map(([k, l]) => `<div class="sx-row sx-part"><span class="sx-ic"><i class="sx-sw" style="background:${COL[k]}"></i></span><span class="sx-tt"><b>${l}${count[k] || ''}</b></span><span class="sx-ctl"><span class="sx-val">${sizeText(s.sizes[k])}</span></span></div>`).join(''), 'sxParts')}
    </div>
    <div class="sx-col">
      ${group('Free up space', opts.map(([k, l, n, b, why]) => `<label class="sx-row stopt${n ? '' : ' none'}"><span class="sx-ic"><input type="checkbox" data-act="stpick" data-v="${k}"${pick[k] && n ? ' checked' : ''}${n ? '' : ' disabled data-why="There is nothing of this kind to clear right now."'}></span><span class="sx-tt"><b>${l}</b><span>${n ? n.toLocaleString() + (n === 1 ? ' item. ' : ' items. ') : 'Nothing to clear. '}${why}</span></span><span class="sx-ctl"><span class="sx-val">${n ? sizeText(b) : '–'}</span></span></label>`).join('') +
        `<div class="sx-row sx-foot"><span class="sx-ic"></span><span class="sx-tt"><span>${ic('check', 14)} Copies you marked Stolen are never deleted here</span></span><span class="sx-ctl"><button class="btn kbtn${chosen.length ? ' primary' : ''}" data-act="stfree"${chosen.length ? '' : ' disabled data-why="Tick at least one kind of saved data above first."'}>${ic('bin', 16)}${chosen.length ? 'Free up ' + sizeText(total) : 'Clear ticked'}</button></span></div>`, 'sxFree')}
    </div></div>`;
}
