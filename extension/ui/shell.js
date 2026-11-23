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
    subs: [['All copies', 'found'], ['One at a time', 'review'], ['New search', 'search'], ['All searches', 'searches']] },
  { id: 'clients', label: 'Clients and photos', href: 'clients', icon: 'people', subs: [['Clients', 'clients'], ['Skipped photos', 'skipped'], ['Site owners', 'owners']] },
  { id: 'keep', label: 'Keep searching', href: 'keep', icon: 'loop' },
  { id: 'library', label: 'Evidence library', href: 'library', subs: [['All evidence', 'library'], ['Weekly summary', 'weekly']] },
  { id: 'tools', label: 'Tools', href: 'tools', icon: 'grid' },
  { id: 'browser', label: 'In your browser', href: 'browser' },
];
const PP_ROUTES = {
  home: ['home'], capture: ['tools'], tools: ['tools'], search: ['find', 'search'], searches: ['find', 'searches'], results: ['find', 'searches'], found: ['find', 'found'], review: ['find', 'review'],
  clients: ['clients', 'clients'], photos: ['clients', 'clients'], owners: ['clients', 'owners'], who: ['clients', 'owners'], keep: ['keep'], connect: ['find', 'found'], weekly: ['library', 'weekly'],
  inspect: ['tools'], compare: ['tools'], markup: ['tools'], files: ['tools'], openfiles: ['tools'],
  library: ['library', 'library'], verify: ['tools'], browser: ['browser'], settings: ['settings'], hidden: ['settings'], computer: ['settings'],
  whatsnew: ['settings'], health: ['settings'], skipped: ['clients', 'skipped'], bnsave: ['tools'], setup: ['browser'], help: ['help']
};
const PP_CRUMBS = {
  results: 'Search results',
  home: 'Home', tools: 'Tools', capture: 'Capture a page', search: 'New search', searches: 'All searches', found: 'All copies found',
  review: 'One at a time', clients: 'Clients and photos', photos: 'Clients and photos', owners: 'Site owners',
  who: 'Who\'s behind this site', keep: 'Keep searching', connect: 'Connect your photos', weekly: 'Evidence library › Weekly summary',
  inspect: 'Photo tools › Inspect a photo', compare: 'Photo tools › Compare two photos', markup: 'Photo tools › Mark up a copy', files: 'Open files › Convert files',
  openfiles: 'Open files › Open odd files', library: 'Evidence library › All evidence', verify: 'Verify a pack', browser: 'Toolbar and side panel', settings: 'Settings',
  hidden: 'Settings › Hidden and approved sites', computer: 'Settings › Your computer', whatsnew: 'Settings › What\'s new', health: 'Settings › Is everything working?', skipped: 'Skipped photos', bnsave: 'Save a Breaking News photo', setup: 'First-time setup', help: 'Help and tutorial'
};
const PP_BADGES = {};

function ppRenderSide(route) {
  const [sec, sub] = PP_ROUTES[route] || PP_ROUTES.home;
  let h = `<a class="brand" href="#home" style="text-decoration:none;color:inherit"><img src="icons/icon48.png" width="36" height="36" alt=""><b>PageProof</b></a>`;
  for (const it of PP_MENU) {
    const on = it.id === sec, badge = it.badgeKey && PP_BADGES[it.badgeKey];
    h += `<a class="nav${on ? ' on' : ''}" href="#${it.href}"${on ? ' aria-current="page"' : ''}>${ic(it.icon || it.id)}<span class="t"><b>${it.label}</b></span>${badge ? `<span class="pill-n">${badge}</span>` : ''}</a>`;
    if (on && it.subs) h += `<div class="subs">${it.subs.map(([l, r]) => `<a href="#${r}" class="${r === sub ? 'on' : ''}">${l}</a>`).join('')}</div>`;
  }
  h += `<div class="grow"></div><div id="sideLive"></div>
  <a class="nav${sec === 'settings' ? ' on' : ''}" href="#settings">${ic('settings')}<span class="t"><b>Settings</b></span></a>
  <a class="nav${sec === 'help' ? ' on' : ''}" href="#help">${ic('help')}<span class="t"><b>Help and tutorial</b></span></a>`;
  document.getElementById('side').innerHTML = h;
  if (typeof ppSideLive === 'function') ppSideLive();
}

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
  'Still online': 'The page still shows the copy the last time PageProof looked.',
  'Back online': 'The copy had disappeared and is now back on the page.',
  'Gone': 'The copy is no longer on the page. Your capture or report still proves it was there.',
  'Lines up': 'How much of the shared area matches your client\'s photo, after lining the two up. 80% or more is almost always the same photo.',
  'Quiet': 'No copies after several searches, so it is searched less often. Any new find wakes it up.',
  'High priority': 'Searched next, then again every 3 days.',
  'Popular': 'Searched again every 7 days, because popular photos get copied most.',
  'Priority': 'Priority clients are searched right after High priority photos, before everyone else.',
  'Registered': 'The copyright office has registered this photo. This is the VA number.',
  'Application': 'The application (case) number from the copyright office.',
  'Same photo': 'PageProof lined the two up and they are the same picture.',
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
const EYEBROW = { 'Find copies': '', 'Clients and photos': 'Clients and photos', 'Collect evidence': '', 'Keep and prove': '', 'Library': 'Evidence library', 'Help': '', 'In your browser': '' };
const head = (eyebrow, title, lede, right = '') => `<div class="head"><div class="l"><div class="eyebrow">${(e => (e === title ? '' : e))(eyebrow in EYEBROW ? EYEBROW[eyebrow] : eyebrow)}</div><h1>${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ''}</div>${right ? `<div class="row">${right}</div>` : ''}</div>`;
const fmtDate = iso => { try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso || ''; } };
const site = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url || ''; } };
// Only web links and pictures go into the page (never javascript: or other odd addresses).
const safeUrl = u => (/^https?:\/\//i.test(String(u || '')) ? esc(u) : '#');
const safeImg = u => (/^(https?:\/\/|data:image\/(png|jpe?g|webp|gif|avif);|blob:)/i.test(String(u || '')) ? esc(u) : 'icons/icon48.png');
