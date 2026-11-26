// The frame around every page of the full PageProof page: the left menu, the top bar with the
// light/dark switch, little pop-up notes ("toasts"), and the hover help on words like "Lines up".
const ppApi = globalThis.browser || globalThis.chrome;
const ic = (n, s, w) => ppIcon(n, s, w);
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- the menu ----------
// Each page has an id (the part after # in the address). ROUTES says which menu item and sub-item it lights up.
const PP_MENU = [
  { id: 'home', label: 'Home', href: 'home' },
  { id: 'find', label: 'Copies found', href: 'found', badgeKey: 'newCopies', icon: 'copies',
    subs: [['All copies', 'found'], ['One at a time', 'review'], ['Keep searching', 'keep'], ['New search', 'search'], ['All searches', 'searches'], ['Credit search', 'credit'], ['Watching', 'watching'], ['Site owners', 'owners']] },
  { id: 'clients', label: 'Clients', href: 'clients', icon: 'people', subs: [['Clients and photos', 'clients'], ['Skipped photos', 'skipped']] },
  { id: 'library', label: 'Evidence', href: 'library',
    subs: [['All evidence', 'library'], ['Overview', 'capture'], ['Weekly summary', 'weekly']] },
  { id: 'tools', label: 'Tools', href: 'tools', icon: 'tools',
    subs: [['All tools', 'tools'], ['Inspect a photo', 'inspect'], ['Compare two photos', 'compare'], ['Mark up a copy', 'markup'], ['Convert files', 'files'], ['Verify a pack', 'verify']] },
  { id: 'settings', label: 'Settings', href: 'settings',
    subs: [['General', 'settings'], ['Searching', 'ssearch'], ['Site lists', 'hidden'], ['Backups and team', 'backups'], ['Health', 'health'], ['Help and about', 'help']] },
];
// 4.14: the menu went from 9 items to 5. Every older page still has its address and lights up the
// item it now lives under.
const PP_ROUTES = {
  home: ['home'], search: ['find', 'search'], searches: ['find', 'searches'], results: ['find', 'searches'], found: ['find', 'found'], review: ['find', 'review'], keep: ['find', 'keep'], connect: ['find', 'found'], credit: ['find', 'credit'], watching: ['find', 'watching'],
  clients: ['clients', 'clients'], photos: ['clients', 'clients'], owners: ['find', 'owners'], who: ['find', 'owners'], skipped: ['clients', 'skipped'], regs: ['clients', 'clients'],
  library: ['library', 'library'], tocapture: ['library', 'library'], capture: ['library', 'capture'], verify: ['tools', 'verify'], weekly: ['library', 'weekly'],
  tools: ['tools', 'tools'], inspect: ['tools', 'inspect'], compare: ['tools', 'compare'], markup: ['tools', 'markup'], files: ['tools', 'files'], openfiles: ['tools', 'files'],
  settings: ['settings', 'settings'], health: ['settings', 'health'], stats: ['settings', 'stats'], hidden: ['settings', 'hidden'], browser: ['settings', 'browser'], setup: ['settings', 'browser'], help: ['settings', 'help'],
  computer: ['settings', 'settings'], whatsnew: ['settings', 'settings'], reconnect: ['settings', 'settings']
};
const PP_CRUMBS = {
  results: 'Search results', credit: 'Credit search', watching: 'Watching', regs: 'Registrations',
  home: 'Home', tools: 'Tools', capture: 'Evidence › Overview', search: 'New search', searches: 'All searches', found: 'All copies found',
  review: 'One at a time', clients: 'Clients and photos', photos: 'Clients and photos', owners: 'Site owners',
  who: 'Who\'s behind this site', keep: 'Keep searching', connect: 'Connect your photos', weekly: 'Evidence › Weekly summary', tocapture: 'Evidence › All evidence',
  inspect: 'Tools › Inspect a photo', compare: 'Tools › Compare two photos', markup: 'Tools › Mark up a copy', files: 'Tools › Convert files',
  openfiles: 'Tools › Open odd files', library: 'Evidence › All evidence', verify: 'Tools › Verify a pack', browser: 'Toolbar', settings: 'Settings',
  hidden: 'Settings › Site lists', computer: 'Settings › Searching', whatsnew: 'Settings › Help and about › What\'s new', health: 'Settings › Health', stats: 'Settings › Health › Stats', skipped: 'Skipped photos', setup: 'First-time setup', help: 'Settings › Help and about'
};
const PP_BADGES = {};
const PP_STATUS = { html: '', bad: false };   // the last status line drawn (4.40: it sits in the menu)

function ppRenderSide(route) {
  const [sec, sub] = PP_ROUTES[route] || PP_ROUTES.home;
  let h = `<a class="brand" href="#home" style="text-decoration:none;color:inherit"><img src="icons/icon48.png" width="36" height="36" alt=""><b>PageProof</b></a>`;
  for (const it of PP_MENU) {
    const on = it.id === sec, badge = it.badgeKey && PP_BADGES[it.badgeKey];
    // 4.40 (UI overhaul 1): soft blue / amber numbers; solid only when something is urgent.
    const tone = it.badgeKey === 'toCapture' ? 'amber' : 'blue', loud = PP_BADGES[it.badgeKey + 'Urgent'];
    h += `<a class="nav${on ? ' on' : ''}" href="#${it.href}"${on ? ' aria-current="page"' : ''}>${ic(it.icon || it.id)}<span class="t"><b>${it.label}</b></span>${badge ? `<span class="pill-n ${tone}${loud ? ' loud' : ''}"${loud ? ` title="${esc(loud)}"` : ''}>${badge}</span>` : ''}</a>`;
    if (on && it.subs) h += `<div class="subs">${it.subs.map(([l, r]) => `<a href="#${r}" class="${r === sub ? 'on' : ''}">${l}</a>`).join('')}</div>`;
  }
  // Calm look: the status (Drive, Keep searching, search sites) left the menu. It is three small
  // tiles at the top right of every page (ppPlaceStatus below).
  document.getElementById('side').innerHTML = h;
  if (typeof ppSideLive === 'function') ppSideLive();
  ppPlaceStatus();
}

// ---------- the status tiles (calm look) ----------
// One element, kept for the whole life of the page and put back at the top right of whatever page
// is showing: beside the page title, or in the top bar when a page has no title line.
const PP_STATUS_EL = (() => {
  const d = document.createElement('div');
  d.id = 'statusLine'; d.className = 'stiles'; d.hidden = true;
  d.setAttribute('role', 'status'); d.setAttribute('aria-label', 'PageProof status');
  return d;
})();
function ppPlaceStatus() {
  const view = document.getElementById('view');
  if (!view) return;
  const head = view.querySelector('.head');
  let home = head && head.querySelector('.headact');
  if (head && !home) { home = document.createElement('div'); home.className = 'row headact'; head.appendChild(home); }
  if (!home) home = document.querySelector('.top .topr');
  if (home && (PP_STATUS_EL.parentNode !== home || home.firstChild !== PP_STATUS_EL)) home.prepend(PP_STATUS_EL);
}
try {
  new MutationObserver(() => { if (!PP_STATUS_EL.isConnected || !PP_STATUS_EL.closest('.head, .topr')) ppPlaceStatus(); else if (PP_STATUS_EL.closest('.topr') && document.querySelector('#view .head')) ppPlaceStatus(); })
    .observe(document.getElementById('view'), { childList: true, subtree: true });
} catch (e) { /* no page yet */ }

// ---------- light / dark ----------
async function ppTheme(next) {
  if (next) { await ppApi.storage.local.set({ ppTheme: next }); document.documentElement.dataset.theme = next; }
  const t = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  const b = document.getElementById('themeBtn');
  if (b) { b.innerHTML = ic(t === 'dark' ? 'sun' : 'moon', 18); b.title = t === 'dark' ? 'Switch to light' : 'Switch to dark'; }
}

// ---------- little notes at the bottom ----------
let ppToastTimer;
function toast(msg, undo) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  if (undo) {
    const b = document.createElement('button');
    b.className = 'btn'; b.style.cssText = 'min-height:28px;margin-left:8px;padding:0 10px';
    b.textContent = '↶ Undo'; b.onclick = () => { el.classList.remove('show'); undo(); };
    el.append(' ', b);
  }
  el.classList.add('show');
  clearTimeout(ppToastTimer);
  ppToastTimer = setTimeout(() => el.classList.remove('show'), undo ? 6000 : 2600);
}

// ---------- hover help ----------
const GLOSS = {
  'New': 'Found by a search and not answered yet.',
  'Stolen': 'You said this copy is used without permission.',
  'Licensed': 'You said they are allowed to use it. It stays green and won\'t ask again.',
  'Removed': 'You said you don\'t want it. Hidden for this photo.',
  'Lines up': 'How much of the shared area matches your client\'s photo, after lining the two up. 80% or more is almost always the same photo.',
  'Quiet': 'No copies after several searches, so it is searched less often. Any new find wakes it up.',
  'High priority': 'Searched next, then again every 3 days.',
  'Popular': 'Searched again every 7 days, because popular photos get copied most.',
  'Priority': 'Priority clients are searched right after High priority photos, before everyone else.',
  'Registered': 'The copyright office has registered this photo. This is the VA number.',
  'Application': 'The application (case) number from the copyright office.',
  'Same photo': 'PageProof lined the two up and they are the same picture.',
  'Same page': 'This page was also found under other addresses (its phone version, share links, tracking bits). They are one copy, so one answer covers them all.',
  'Maybe': 'A few details match. Worth a closer look with Compare.',
  'Light': 'An older or busy computer: PageProof does one thing at a time.',
  'Normal': 'A typical computer: two photo checks and two search tabs at once.',
  'Strong': 'A fast computer: up to four photo checks and three search tabs at once.',
  'Gentle': '1 photo every 10 minutes. Barely noticeable.',
  'Steady': '1 photo every 5 minutes. A good default.',
  'Faster': '1 photo every 2 minutes. Only on a strong computer.',
  'Fingerprint': 'A SHA-256 code worked out from the file. Change one dot in the file and the code changes completely.',
  'Trusted timestamp': 'An outside time service signs the fingerprints, proving the files existed at that moment.'
};
function ppAddHelp(root = document) {
  root.querySelectorAll('.tag,th,.tabs button,.seg button,.chip,[data-gloss]').forEach(el => {
    if (el.dataset.help) return;
    const first = el.childNodes[0];
    const t = (el.dataset.gloss || (first && first.nodeType === 3 ? first.textContent : el.textContent)).trim();
    if (GLOSS[t]) { el.dataset.help = GLOSS[t]; el.classList.add('hashelp'); }
  });
}
(() => {
  const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; document.body.appendChild(tip);
  let t;
  document.addEventListener('mouseover', e => {
    const el = e.target.closest('[data-help]'); clearTimeout(t);
    if (!el) { tip.hidden = true; return; }
    t = setTimeout(() => {
      tip.textContent = el.dataset.help; tip.hidden = false;
      const b = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
      let x = Math.max(8, Math.min(innerWidth - w - 8, b.left + b.width / 2 - w / 2)), y = b.top - h - 8;
      if (y < 8) y = b.bottom + 8;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    }, 250);
  });
  document.addEventListener('scroll', () => { tip.hidden = true; }, true);
})();

// ---------- small building blocks ----------
// The small line above a page title says where the page lives in the menu. Old section names
// (from before the short menu) map to today's, and a line that only repeats the title is left out.
// 4.14: every page starts the same way. The small line above the title is the menu item the page
// lives under (Home keeps its date), and the buttons on the right have at most ONE blue main
// button, always last (ppTidyHead, run after each page is drawn).
const ppSection = () => { const r = (location.hash.slice(1).split('?')[0] || 'home'); const m = PP_MENU.find(x => x.id === (PP_ROUTES[r] || [])[0]); return m && m.id !== 'home' ? m.label : ''; };
const head = (eyebrow, title, lede, right = '') => { const e = ppSection() || eyebrow; return `<div class="head"><div class="l"><div class="eyebrow">${e === title ? '' : esc(e)}</div><h1>${e && e === ppSection() && e !== title && !String(title).includes(e + ' ›') ? `<span class="bc">${esc(e)}</span><span class="bcs" aria-hidden="true">›</span>` : ''}${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ''}</div>${right ? `<div class="row headact">${right}</div>` : ''}</div>`; };
function ppTidyHead(root) {
  const r = root.querySelector('.head > .headact'); if (!r) return;
  const btns = [...r.children].filter(b => b.classList.contains('btn'));
  const prim = btns.filter(b => b.classList.contains('primary'));
  prim.slice(0, -1).forEach(b => b.classList.remove('primary'));
  const main = prim[prim.length - 1];
  if (main && r.lastElementChild !== main) r.append(main);
}
const fmtDate = iso => { try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso || ''; } };
const site = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url || ''; } };
// Only web links and pictures go into the page (never javascript: or other odd addresses).
const safeUrl = u => (/^https?:\/\//i.test(String(u || '')) ? esc(u) : '#');
const safeImg = u => (/^(https?:\/\/|data:image\/(png|jpe?g|webp|gif|avif);|blob:)/i.test(String(u || '')) ? esc(u) : 'icons/icon48.png');
