// Copies found › Social media (4.9): copies on social sites are about the ACCOUNT that posted
// them. Stolen, Hide, Approve and "stolen before" all work per account, the account is found
// even when the link doesn't show it, and the live page preview gives way to "The post".
// Loaded after ui/fc-found.js (uses its state, FCD, LIST, HIST, answers and toasts).
Object.assign(state, { fTab: 'web', tabSaved: {}, fPlat: 'Any', fAcct: '', sView: 'copies', acctEdit: '' });

const isSoc = c => c.use === 'social';
const inTab = c => (state.fTab === 'social') === isSoc(c);
const platOf = c => PP_SOCIAL.platform(c.site);
const platBadge = (c, size = 20) => { const p = platOf(c); return `<span class="plat" style="--pc:${p.color};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.45)}px" title="${esc(p.name)}" aria-label="${esc(p.name)}">${esc(p.short)}</span>`; };
const KIND_WORD = { post: 'post', reel: 'reel', video: 'video', short: 'short', story: 'story', pin: 'pin', photo: 'photo' };
const postWord = c => platOf(c).name + ' ' + (KIND_WORD[PP_SOCIAL.postKind(c.url)] || 'post');
const FROM = { link: 'the link itself', short: 'the short link\'s real address', public: 'the site\'s public post info', page: 'the post page\'s own info', browser: 'the post opened in your browser', you: 'you typed it' };
const sureTag = a => a.from === 'you' ? '<span class="tag grey">set by you</span>' : a.sure === 'likely' ? '<span class="tag warn" title="Read from the page\'s text. Check it once.">likely</span>' : '<span class="tag blue">sure</span>';
// The key used to count and remember an account, with linked accounts (the same person) folded together.
const acctGroup = key => (FCD && FCD.acctLinkOf && FCD.acctLinkOf.get(key)) || key;

// The tab state: each tab keeps its own filters.
const TAB_KEYS = ['fFilter', 'fq', 'fWhen', 'fMatch', 'fYear', 'fQuarter', 'fPhoto', 'fView', 'fSort', 'fClient', 'fUse', 'fRisk', 'fCredit', 'fShop', 'fRepeat', 'fOwner', 'fFresh', 'fPlat', 'fAcct', 'more', 'exp', 'sView'];
const TAB_START = { web: { fView: 'client' }, social: { fView: 'account' } };
function switchTab(t) {
  if (t === state.fTab) return;
  state.tabSaved[state.fTab] = Object.fromEntries(TAB_KEYS.map(k => [k, Array.isArray(state[k]) ? state[k].slice() : state[k]]));
  const base = { fFilter: 'New', fq: '', fWhen: 'any', fMatch: 'any', fYear: 'Any', fQuarter: 'Any', fPhoto: '', fSort: 'act', fClient: 'Any', fUse: 'Any', fRisk: 'Any', fCredit: 'Any', fShop: false, fRepeat: false, fOwner: '', fFresh: false, fPlat: 'Any', fAcct: '', more: 250, exp: [], sView: 'copies' };
  Object.assign(state, base, TAB_START[t], state.tabSaved[t] || {});
  state.fTab = t; state.open = ''; state.picked = [];
}

// ---------------------------------------------------------------- what loadFC adds (accounts)
// Called by loadFC once the copies are read: every account, how often it was marked stolen,
// linked accounts, and "stolen before" counted per account (not per site) for social copies.
async function socIndex(copies) {
  const links = (await FC.meta.get('acctLinks')) || [];
  const linkOf = new Map();
  for (const g of links) for (const k of g) linkOf.set(k, g[0]);
  const accts = new Map();
  const touch = (a, c) => {
    const g = linkOf.get(a.key) || a.key;
    if (!accts.has(a.key)) accts.set(a.key, { acct: a, key: a.key, group: g, copies: [], stolen: [], clients: new Set(), site: c.site });
    return accts.get(a.key);
  };
  const stolenBy = new Map();      // group -> stolen copies (social posts and embedded posts on websites)
  for (const c of copies) {
    if (isSoc(c) && c.acct) {
      const e = touch(c.acct, c);
      if (c.status !== 'removed') e.copies.push(c);
      if (c.clientName) e.clients.add(c.clientName);
      if (c.status === 'stolen') { e.stolen.push(c); const g = e.group; if (!stolenBy.has(g)) stolenBy.set(g, []); stolenBy.get(g).push(c); }
    }
    // A website showing an embedded post you marked stolen counts against that post's account too.
    if (!isSoc(c) && c.status === 'stolen' && c.pf && Array.isArray(c.pf.embeds)) for (const a of c.pf.embeds) {
      const g = linkOf.get(a.key) || a.key;
      if (!stolenBy.has(g)) stolenBy.set(g, []); stolenBy.get(g).push(c);
    }
  }
  for (const c of copies) if (isSoc(c)) {
    if (!c.acct) { c.repeat = 0; continue; }
    const g = linkOf.get(c.acct.key) || c.acct.key;
    const xs = (stolenBy.get(g) || []).filter(x => x.id !== c.id);
    c.repeat = xs.length; c.repeatWho = c.acct.handle;
    c.repeatAt = xs.map(x => x.answered).filter(Boolean).sort();
  }
  const byName = new Map();
  for (const e of accts.values()) { const n = PP_SOCIAL.plainName(e.acct); if (n.length < 4) continue; if (!byName.has(n)) byName.set(n, []); byName.get(n).push(e); }
  return { accts, acctLinkOf: linkOf, acctLinks: links, byName, stolenBy };
}

// ---------------------------------------------------------------- finding the account
// Steps, in order (Ben's design, 4.9): A the link, or a short link's real address; B the site's
// public post info (TikTok, YouTube, X, Reddit, Pinterest...); C the post page's own tags.
// D (your signed-in browser) and E (you type it) are buttons, never automatic.
const FIND_BUSY = new Set();
async function findAcct(c, again) {
  if (FIND_BUSY.has(c.id)) return null;
  FIND_BUSY.add(c.id);
  const tried = [];
  try {
    let url = c.url, acct = null, post = null;
    if (PP_SOCIAL.isShort(url)) { tried.push('short'); const real = await PP_SOCIAL.unshort(url); if (real) { url = real; const a = PP_SOCIAL.fromUrl(real); if (a) acct = { ...a, from: 'short', sure: 'sure' }; } }
    if (!acct) { const a = PP_SOCIAL.fromUrl(url); if (a) acct = { ...a, from: 'link', sure: 'sure' }; }
    if (PP_SOCIAL.hasPublic(url)) {
      tried.push('public');
      const r = await PP_SOCIAL.publicInfo(url);
      if (r && r.acct && !acct) acct = { ...r.acct, from: 'public', sure: 'sure' };
      if (r && r.post) post = r.post;
    }
    if (!acct || !post) {
      tried.push('page');
      const pf = await readTheirPage(c, again).catch(() => null);
      const r = pf && pf.ok && PP_SOCIAL.fromTags(pf.soc, pf.url || url);
      if (r && r.acct && !acct) acct = { ...r.acct, from: 'page', sure: r.acct.sure || 'likely' };
      if (r && r.post) post = { ...(r.post || {}), ...(post || {}) };
    }
    if (acct) acct.at = new Date().toISOString();
    await FC.setAcct(c.id, acct || undefined, post || undefined);
    const cc = await FC.DB.get('copies', c.id);
    if (cc && !acct) { cc.acctTried = tried; await FC.DB.put('copies', cc); }
    FCD_STALE = true;
    return acct;
  } finally { FIND_BUSY.delete(c.id); }
}
// Every social copy still without an account is looked up quietly, two at a time, while
// Copies found is open. A copy tried in the last 3 days waits (unless you press Look again).
let socQueueOn = false;
async function socQueue() {
  if (socQueueOn || !FCD) return;
  socQueueOn = true;
  try {
    for (;;) {
      if (route() !== 'found' && route() !== 'review') break;
      if (!FCD) await loadFC();
      const todo = FCD.copies.filter(c => isSoc(c) && !c.acct && c.status !== 'removed' && !FIND_BUSY.has(c.id) && (!c.acctTry || Date.now() - c.acctTry > 3 * 864e5)).slice(0, 2);
      if (!todo.length) break;
      await Promise.all(todo.map(c => findAcct(c).catch(() => null).then(() => { c.acctTry = Date.now(); })));
      socRedrawSoon();
      await new Promise(r => setTimeout(r, 800));
    }
  } finally { socQueueOn = false; }
}
let socRedrawT = null;
function socRedrawSoon() {
  clearTimeout(socRedrawT);
  socRedrawT = setTimeout(() => {
    if (!['found', 'review'].includes(route()) || document.querySelector('#rowMenu, dialog[open], details.ddw[open]') || document.activeElement && document.activeElement.matches('input,select,textarea')) return socRedrawSoon();
    FCD_STALE = true; render(true);
  }, 2500);
}
// Step D: open the post in your own browser (signed in, like a Capture sees it), read who
// posted it, and close the tab again.
async function findInBrowser(c) {
  let tab;
  try {
    tab = await api.tabs.create({ url: c.url, active: false });
    await new Promise(res => {
      const t = setTimeout(done, 25000);
      function done() { clearTimeout(t); api.tabs.onUpdated.removeListener(on); res(); }
      function on(id, ch) { if (id === tab.id && ch.status === 'complete') done(); }
      api.tabs.onUpdated.addListener(on);
    });
    await new Promise(r => setTimeout(r, 2500));      // social sites draw the post after loading
    const [res] = await api.scripting.executeScript({ target: { tabId: tab.id }, func: readPostInTab });
    const now = await api.tabs.get(tab.id).catch(() => tab);
    const t = res && res.result;
    const r = t && PP_SOCIAL.fromTags(t, (now && now.url) || c.url);
    const acct = r && r.acct ? { ...r.acct, from: 'browser', sure: r.acct.sure || 'likely', at: new Date().toISOString() } : null;
    await FC.setAcct(c.id, acct || undefined, r && r.post || undefined);
    FCD_STALE = true;
    return acct;
  } catch (e) { return null; } finally { if (tab) api.tabs.remove(tab.id).catch(() => {}); }
}
// Runs inside the post's tab: the page's tags and the profile links near the post.
function readPostInTab() {
  const meta = n => { const m = document.querySelector(`meta[property="${n}"], meta[name="${n}"]`); return m ? (m.getAttribute('content') || '').trim() : ''; };
  const link = r => { const l = document.querySelector(`link[rel="${r}"]`); return l ? l.href : ''; };
  const near = [...document.querySelectorAll('article header a[href], article a[href], main header a[href], [role="main"] a[href]')].slice(0, 60).map(a => a.href);
  const html = document.documentElement.innerHTML.slice(0, 2e6);
  const um = /"owner":\{[^{}]{0,200}?"username":"([A-Za-z0-9._]{1,30})"/.exec(html);
  return { ogUrl: meta('og:url'), canonical: link('canonical'), authorUrl: link('author'), title: meta('og:title') || document.title, desc: meta('og:description') || meta('description'), published: meta('article:published_time'), links: near, user: um ? um[1] : '' };
}

// ---------------------------------------------------------------- pieces for the list and panel
// The row's first line on the Social media tab: the account leads.
function socLine(c) {
  const a = c.acct;
  return `<div class="l1 soc">${platBadge(c)}${a ? `<b>${esc(a.handle)}</b>` : '<b class="nofind">Account not found yet</b>'}<span class="pkind">${esc(postWord(c))}</span>${c.status !== 'new' ? tagFor(c) : ''}
    ${a && c.repeat && c.status === 'new' ? `<span class="tag bad" title="You marked this account stolen before">Marked stolen ${c.repeat === 1 ? 'once' : c.repeat + ' times'} before</span>` : ''}
    ${!a ? `<button class="btn sm ghost setacct" data-act="openacct" data-v="${esc(c.id)}">Set account</button>` : a.sure === 'likely' ? '<span class="tag warn" title="Read from the page\'s text. Check it once.">Account: likely</span>' : ''}${sigIcons(c)}</div>`;
}
// Websites tab: a website showing an embedded social post names the account.
const embedTag = c => c.pf && Array.isArray(c.pf.embeds) && c.pf.embeds.length ? `<span class="tag grey" title="${esc(c.pf.embeds.map(e => e.handle).join(', '))}">Embedded post by ${esc(c.pf.embeds[0].handle)}${c.pf.embeds.length > 1 ? ' +' + (c.pf.embeds.length - 1) : ''}</span>` : '';
// "The post": shown instead of the live page for social copies (they nearly all block it).
function postCard(c) {
  const fromPage = c.pf && c.pf.ok && c.pf.soc ? (PP_SOCIAL.fromTags(c.pf.soc, c.pf.url || c.url) || {}).post : null;
  const p = { ...(fromPage || {}), ...(c.post || {}) };
  const busy = PF_BUSY.has(c.id) || FIND_BUSY.has(c.id);
  const bits = [p.date ? 'Posted ' + shortDate(p.date) : '', p.likes != null ? p.likes.toLocaleString() + ' likes' : '', p.comments != null ? p.comments.toLocaleString() + ' comments' : ''].filter(Boolean);
  return `<section class="dsec postcard" id="postcard"><div class="row" style="justify-content:space-between;gap:8px"><div class="dsh" style="margin:0">The post</div><span class="faint" style="font-size:12px">No live preview: ${esc(platOf(c).name)} blocks it</span></div>
    ${p.caption ? `<p class="cap">“${esc(p.caption)}”</p>` : `<p class="faint" style="margin:0;font-size:13px">${busy ? 'Reading the post…' : 'The caption isn\'t public. Open the post to see it.'}</p>`}
    ${bits.length ? `<span class="muted" style="font-size:12.5px">${esc(bits.join(' · '))}</span>` : ''}
    <div class="row" style="gap:6px"><a class="btn sm" href="${safeUrl(c.url)}" target="_blank" rel="noreferrer">${ic('ext', 14)} Open post</a><button class="btn sm" data-act="capturecopy">${ic('capture', 14)} Capture the post</button><button class="btn ghost sm" data-act="trypage">Try the live preview anyway</button></div></section>`;
}
// The panel's Account tab.
function acctPane(c) {
  const a = c.acct, e = a && FCD.accts.get(a.key);
  const g = a ? acctGroup(a.key) : '';
  const stolen = a ? (FCD.stolenBy.get(g) || []).filter(x => x.id !== c.id) : [];
  const linked = a ? (FCD.acctLinks.find(x => x.includes(a.key)) || []).filter(k => k !== a.key) : [];
  const same = a ? (FCD.byName.get(PP_SOCIAL.plainName(a)) || []).filter(x => x.key !== a.key && !linked.includes(x.key)) : [];
  const samePhoto = FCD.copies.filter(x => x.id !== c.id && isSoc(x) && x.photo === c.photo && x.status !== 'removed' && FC.baseOf(x.site) !== FC.baseOf(c.site));
  const name = a ? PP_SOCIAL.bareName(a) : '';
  const tried = (c.acctTried || []).map(t => ({ short: 'Followed the short link', public: 'Asked ' + platOf(c).name + '\'s public post info', page: 'Read the post page' }[t])).filter(Boolean);
  const edit = state.acctEdit === c.id || !a;
  return `${a ? `<div class="acctcard"><span class="oav" style="background:${platOf(c).color}">${esc((name[0] || '?').toUpperCase())}</span><div style="min-width:0;flex:1">
      <b style="font-size:17px;overflow-wrap:anywhere">${esc(a.handle)}</b>${a.name && a.name !== name ? ` <span class="muted">${esc(a.name)}</span>` : ''}
      <div class="muted" style="font-size:12.5px">${esc(platOf(c).name)} ${a.kind && a.kind !== 'account' ? a.kind : 'account'} · <a href="${safeUrl(a.url)}" target="_blank" rel="noreferrer">Open account ${ic('ext', 12)}</a></div>
      <div class="faint" style="font-size:12px">Found from: ${esc(FROM[a.from] || 'the link')} ${sureTag(a)}</div></div>
      <button class="btn ghost sm" data-act="editacct" data-v="${esc(c.id)}">Change</button></div>`
    : `<div class="banner warn" style="padding:10px 12px;flex-direction:column;align-items:stretch;gap:6px"><b>The account isn't in this link</b><span style="font-size:13px">${tried.length ? 'PageProof tried: ' + esc(tried.join(', ')) + '. ' : ''}${platOf(c).name === 'Instagram' || platOf(c).name === 'Facebook' ? esc(platOf(c).name) + ' often hides posts from anything not signed in. ' : ''}Looking in your own browser nearly always works.</span></div>`}
    ${edit ? `<div class="acctset"><label for="acctIn" style="font-weight:600;font-size:13.5px">${a ? 'Set a different account' : 'Set the account'}</label>
      <div class="row" style="gap:6px"><input id="acctIn" class="chip" style="min-height:34px;padding:0 10px;font-size:14px;flex:1 1 200px" placeholder="Paste the profile link, or @name" value="${a && a.from === 'you' ? esc(a.url) : ''}"><button class="btn sm primary" data-act="saveacct" data-v="${esc(c.id)}">Save</button></div>
      <div class="row" style="gap:6px"><button class="btn sm" data-act="browseracct" data-v="${esc(c.id)}">${ic('eye', 14)} Look in your browser</button><button class="btn ghost sm" data-act="findacct" data-v="${esc(c.id)}">Look again</button>${a ? `<button class="btn ghost sm" data-act="clearacct" data-v="${esc(c.id)}">Clear</button>` : ''}</div>
      <span class="faint" style="font-size:12px">"Look in your browser" opens the post in a background tab (signed in, like a Capture), reads who posted it, and closes the tab.</span></div>` : ''}
    ${a ? `<section class="dsec"><div class="dsh">This account</div><dl class="facts">
      <dt>Stolen before</dt><dd>${stolen.length ? `<b style="color:var(--bad)">${plural(stolen.length, 'time')}</b>${c.repeatAt && c.repeatAt.length ? '<br><span class="muted" style="font-size:12.5px">' + esc(c.repeatAt.slice(-4).map(shortDate).join(', ')) + '</span>' : ''}` : '<span class="muted">Never</span>'}</dd>
      <dt>Copies found</dt><dd>${e ? plural(e.copies.length, 'copy', 'copies') : '1 copy'}${e && e.clients.size ? '<br><span class="muted" style="font-size:12.5px">' + esc([...e.clients].slice(0, 4).join(', ')) + '</span>' : ''} <button class="btn ghost sm" data-act="acctonly" data-v="${esc(a.key)}">See them</button></dd>
    </dl></section>` : ''}
    ${samePhoto.length ? `<section class="dsec"><div class="dsh">Same photo on other platforms</div>${samePhoto.slice(0, 8).map(x => `<button class="lookup" style="text-align:left;cursor:pointer" data-act="openrow" data-v="${esc(x.id)}">${platBadge(x, 22)}<span><b>${esc(x.acct ? x.acct.handle : 'Account not found')}</b><br><span class="muted" style="font-size:12.5px">${esc(postWord(x))} · ${esc(STATUS[x.status][0])}</span></span></button>`).join('')}</section>` : ''}
    ${a ? `<section class="dsec"><div class="dsh">The same account on other platforms</div>
      ${linked.length ? linked.map(k => { const x = FCD.accts.get(k); return `<div class="row" style="gap:8px;font-size:13.5px">${x ? platBadge({ site: x.site }, 20) : ''}<b>${esc(x ? x.acct.handle : k)}</b><span class="tag ok">same person</span><button class="btn ghost sm" style="margin-left:auto" data-act="unlinkacct" data-v="${esc(a.key + '\n' + k)}">Not the same</button></div>`; }).join('') : ''}
      ${same.map(x => `<div class="row" style="gap:8px;font-size:13.5px">${platBadge({ site: x.site }, 20)}<b>${esc(x.acct.handle)}</b><span class="muted">${plural(x.copies.length, 'copy', 'copies')}${x.stolen.length ? ', ' + x.stolen.length + ' stolen' : ''}</span><button class="btn sm" style="margin-left:auto" data-act="linkacct" data-v="${esc(a.key + '\n' + x.key)}">Same person</button></div>`).join('')}
      ${!linked.length && !same.length ? '<span class="faint" style="font-size:12.5px">No account with this name found on another platform yet.</span>' : ''}
      ${name && name.length > 2 && !name.includes('/') ? `<div class="row" style="gap:6px;flex-wrap:wrap"><span class="muted" style="font-size:12.5px">Look for ${esc('@' + name)} on</span>${PP_SOCIAL.ELSEWHERE.filter(([d]) => d !== a.plat).map(([, n, f]) => `<a class="chip" href="${safeUrl(f(name))}" target="_blank" rel="noreferrer">${esc(n)}</a>`).join('')}</div>
      <span class="faint" style="font-size:12px">"Same person" joins two accounts: stolen before, Hide and the Accounts list then count them together. A matching name alone doesn't prove it's the same person.</span>` : ''}</section>` : ''}
    ${a ? `<details class="hidebox" id="okbox"><summary><b>Is this account allowed to use the photo?</b> <span class="muted" style="font-size:13px">Approve it</span></summary>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
      ${c.clientName ? `<button class="lookup" style="text-align:left;cursor:pointer" data-act="approveacct" data-v="client"><span style="color:var(--ok);display:inline-flex">${ic('check', 20)}</span><span><b>Approve ${esc(a.handle)} for ${esc(c.clientName)}</b><br><span class="muted" style="font-size:12.5px">Their posts of ${esc(c.clientName)}'s photos stop showing as new.</span></span></button>` : ''}
      <button class="lookup" style="text-align:left;cursor:pointer" data-act="approveacct" data-v="all"><span style="color:var(--ok);display:inline-flex">${ic('check', 20)}</span><span><b>Approve ${esc(a.handle)} for every client</b><br><span class="muted" style="font-size:12.5px">For a client's own account or a licensed partner. All their posts are marked Licensed.</span></span></button></div></details>` : ''}
    <details class="hidebox" id="hidebox"${a ? '' : ' open'}><summary><b>Don't want results from this account?</b> <span class="muted" style="font-size:13px">Hide it</span></summary>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">${hideChoices(c).map(([v, l, d, warn]) => `<button class="lookup${warn ? ' warnhide' : ''}" style="text-align:left;cursor:pointer" data-act="hidesite" data-v="${esc(v)}"><span style="color:var(--bad);display:inline-flex">${ic('ban', 20)}</span><span><b>${esc(l)}</b><br><span class="${warn ? '' : 'muted'}" style="font-size:12.5px;${warn ? 'color:var(--bad)' : ''}">${esc(d)}</span></span></button>`).join('')}
      <span class="faint" style="font-size:12.5px">Hidden accounts and sites never show again. Bring them back from Settings › Hidden and approved sites.</span></div></details>`;
}
// Hide choices on social copies: only the account. A whole social site can never be hidden (4.9.4).
function socHideChoices(c) {
  const p = platOf(c);
  return c.acct ? [[c.acct.key, 'Hide ' + c.acct.handle, 'Only this account. Other ' + p.name + ' accounts still show.']] : [];
}

// ---------------------------------------------------------------- the Accounts list (Social tab)
function accountsView(rows) {
  const m = new Map();
  for (const c of rows) {
    const k = c.acct ? acctGroup(c.acct.key) : '~';
    if (!m.has(k)) m.set(k, { k, xs: [], keys: new Set() });
    const e = m.get(k); e.xs.push(c); if (c.acct) e.keys.add(c.acct.key);
  }
  const list = [...m.values()].sort((a, b) => (a.k === '~') - (b.k === '~') || (FCD.stolenBy.get(b.k) || []).length - (FCD.stolenBy.get(a.k) || []).length || b.xs.length - a.xs.length);
  const missing = rows.filter(c => !c.acct && c.status !== 'removed');
  const allowed = k => { try { return RS_LISTS.allowed.includes(k); } catch (e) { return false; } };
  const tr = e => {
    if (e.k === '~') return `<tr class="arow" data-act="acctonly" data-v="~"><td><span class="plat" style="--pc:#6B7280">?</span> <b style="color:var(--warn)">Account not found yet</b></td><td class="num">${e.xs.length}</td><td class="num">${e.xs.filter(x => x.status === 'new').length}</td><td class="num">${e.xs.filter(x => x.status === 'stolen').length}</td><td>${esc([...new Set(e.xs.map(x => x.clientName).filter(Boolean))].slice(0, 2).join(', '))}</td><td><span class="tag warn">Set account</span></td><td></td></tr>`;
    const first = e.xs.find(x => x.acct.key === e.k) || e.xs[0], a = first.acct;
    const st = (FCD.stolenBy.get(e.k) || []).length, others = [...e.keys].filter(k => k !== a.key);
    const linked = (FCD.acctLinks.find(g => g.includes(a.key)) || []).filter(k => k !== a.key && !e.keys.has(k));
    const clients = [...new Set(e.xs.map(x => x.clientName).filter(Boolean))];
    const status = allowed(a.key) ? '<span class="tag ok">Approved</span>' : st ? '<span class="tag bad">Known stolen</span>' : '<span class="tag grey">Watching</span>';
    return `<tr class="arow" data-act="acctonly" data-v="${esc(a.key)}"><td>${platBadge(first)} <b>${esc(a.handle)}</b>${others.length || linked.length ? ` <span class="faint" style="font-size:12px">+ ${esc([...others, ...linked].map(k => (FCD.accts.get(k) || { acct: { handle: k } }).acct.handle + ' on ' + PP_SOCIAL.platform((FCD.accts.get(k) || {}).site || k.split('/')[0]).name).join(', '))}</span>` : ''}</td>
      <td class="num">${e.xs.length}</td><td class="num">${e.xs.filter(x => x.status === 'new').length}</td><td class="num">${st}</td><td>${esc(clients.slice(0, 2).join(', '))}${clients.length > 2 ? ' +' + (clients.length - 2) : ''}</td><td>${status}</td>
      <td><a class="btn ghost sm" href="${safeUrl(a.url)}" target="_blank" rel="noreferrer" data-act="openlink" aria-label="Open ${esc(a.handle)}">${ic('ext', 14)}</a></td></tr>`;
  };
  return `${missing.length ? `<div class="banner info" style="margin:12px 14px 0;padding:10px 12px"><span style="flex:1 1 260px;font-size:13.5px"><b>${plural(missing.length, 'post', 'posts')} without an account yet.</b> PageProof keeps trying by itself. Looking in your browser finds most of the rest (it opens each post in a background tab for a few seconds).</span><button class="btn sm" data-act="browserall">Look up ${missing.length} in your browser</button></div>` : ''}
  <div style="overflow-x:auto"><table class="accts"><thead><tr><th>Account</th><th>Copies</th><th>New</th><th>Stolen</th><th>Clients</th><th>Status</th><th></th></tr></thead><tbody>${list.map(tr).join('')}</tbody></table></div>`;
}

// ---------------------------------------------------------------- new social sites, asked once
function socAskBanner(copies) {
  const seen = new Set();
  for (const c of copies) {
    if (c.status === 'removed') continue;
    const b = FC.baseOf(c.site);
    if (seen.has(b)) continue; seen.add(b);
    const why = PP_SOCIAL.askFor(c);
    if (why) return `<div class="banner info socask" role="status"><span class="plat" style="--pc:#6B7280">?</span><div style="flex:1 1 260px;min-width:0"><b>New social site found: ${esc(b)}</b><div style="font-size:13px">${esc(why)}. Social sites go on the Social media tab, and Stolen and Hide work per account there.</div></div><button class="btn sm primary" data-act="socmark" data-v="${esc(b)}|social">Yes, social</button><button class="btn sm" data-act="socmark" data-v="${esc(b)}|web">No, a website</button></div>`;
  }
  return '';
}

Object.assign(ACTS, {
  ftab: v => { switchTab(v); render(true); },
  unhidok: async () => { await (globalThis.browser || chrome).storage.local.remove('ppSocialUnhid'); if (FCD) FCD.unhid = []; render(true); },
  fplat: v => { state.fPlat = state.fPlat === v ? 'Any' : v; state.more = 250; render(true); },
  sview: v => { state.sView = v; render(true); },
  acctonly: v => { state.fAcct = v; state.sView = 'copies'; state.fFilter = 'All'; state.more = 250; render(true); },
  openacct: v => { closeRowMenu(); state.open = v; state.dTabFor = v; state.dTab = 'acct'; render(true); },
  editacct: v => { state.acctEdit = state.acctEdit === v ? '' : v; render(true); },
  trypage: async () => { state.dView = 'page'; state.forcePage = state.open; await render(true); },
  saveacct: async v => {
    const c = FCD.copies.find(x => x.id === v), i = document.getElementById('acctIn');
    if (!c || !i) return;
    const a = PP_SOCIAL.fromTyped(i.value, c.site);
    if (!a) return toast('Paste a profile link (like instagram.com/name) or type @name.');
    const undo = await FC.setAcct(v, { ...a, from: 'you', sure: 'sure', at: new Date().toISOString() });
    HIST.push({ label: 'account set to ' + a.handle, undo, open: v });
    state.acctEdit = ''; FCD_STALE = true; toastUndo('Account set to ' + a.handle + '. Kept for this post from now on.'); render(true);
  },
  clearacct: async v => { const undo = await FC.setAcct(v, null); HIST.push({ label: 'account cleared', undo, open: v }); state.acctEdit = ''; FCD_STALE = true; toastUndo('Account cleared.'); render(true); },
  findacct: async v => {
    const c = FCD.copies.find(x => x.id === v); if (!c) return;
    toast('Looking for the account…');
    const a = await findAcct(c, true); FCD_STALE = true;
    toast(a ? 'Found: ' + a.handle : 'Still not found. Try "Look in your browser".'); render(true);
  },
  browseracct: async v => {
    const c = FCD.copies.find(x => x.id === v); if (!c) return;
    toast('Opening the post in a background tab for a few seconds…');
    const a = await findInBrowser(c); FCD_STALE = true;
    toast(a ? 'Found: ' + a.handle + (a.sure === 'likely' ? ' (likely: check it once)' : '') : 'Your browser couldn\'t see who posted it either. Paste the profile link instead.'); render(true);
  },
  browserall: async () => {
    const xs = FCD.copies.filter(c => isSoc(c) && !c.acct && c.status !== 'removed' && visible(c));
    let n = 0, i = 0;
    for (const c of xs) { i++; toast(`Looking in your browser: ${i} of ${xs.length}…`); if (await findInBrowser(c)) n++; if (route() !== 'found') break; }
    FCD_STALE = true; toast(`Found ${n} of ${xs.length} accounts.`); render(true);
  },
  linkacct: async v => {
    const [a, b] = v.split('\n');
    const links = (await FC.meta.get('acctLinks')) || [];
    const ga = links.find(g => g.includes(a)), gb = links.find(g => g.includes(b));
    const next = links.filter(g => g !== ga && g !== gb);
    next.push([...new Set([...(ga || [a]), ...(gb || [b])])]);
    await FC.meta.set('acctLinks', next); FC.backupSoon();
    HIST.push({ label: 'accounts joined', undo: async () => { await FC.meta.set('acctLinks', links); FC.backupSoon(); } });
    FCD_STALE = true; toastUndo('Joined: they now count as the same person.'); render(true);
  },
  unlinkacct: async v => {
    const [a, b] = v.split('\n');
    const links = (await FC.meta.get('acctLinks')) || [];
    const next = links.map(g => g.includes(a) && g.includes(b) ? g.filter(k => k !== b) : g).filter(g => g.length > 1);
    await FC.meta.set('acctLinks', next); FC.backupSoon();
    HIST.push({ label: 'accounts split', undo: async () => { await FC.meta.set('acctLinks', links); FC.backupSoon(); } });
    FCD_STALE = true; toastUndo('Split: they count as separate accounts again.'); render(true);
  },
  approveacct: async v => {
    const c = FCD.copies.find(x => x.id === state.open);
    if (!c || !c.acct) return;
    const who = v === 'client' ? c.clientName : '';
    const undo = await FC.approveAccount(c.acct, who, c.id);
    const i = LIST.indexOf(c.id);
    const nextId = LIST.slice(i + 1).find(id => { const x = FCD.copies.find(y => y.id === id); return x && !(x.acct && x.acct.key === c.acct.key); }) || '';
    HIST.push({ label: c.acct.handle + ' approved' + (who ? ' for ' + who : ' for every client'), undo, open: c.id });
    FCD_STALE = true; state.open = nextId;
    toastUndo(c.acct.handle + ' is approved' + (who ? ' for ' + who : ' for every client') + '. Their posts are marked Licensed.');
    render(true);
  },
  socmark: async v => {
    const [site, kind] = v.split('|');
    const was = await PP_SOCIAL.setMine(site, kind); FC.backupSoon();
    HIST.push({ label: site + ' marked ' + (kind === 'social' ? 'social' : 'a website'), undo: () => PP_SOCIAL.setMine(site, was) });
    FCD_STALE = true; toastUndo(kind === 'social' ? site + ' is a social site now. Its copies are on the Social media tab.' : site + ' stays a website.'); render(true);
  },
});

// The platform chips above the Social media list: one per platform, with how many it would show.
function passMainNoPlat(c) { const was = state.fPlat; state.fPlat = 'Any'; try { return passMain(c); } finally { state.fPlat = was; } }
function platChips(xs) {
  const n = new Map();
  for (const c of xs) { const p = platOf(c); const e = n.get(p.key) || { p, n: 0, site: c.site }; e.n++; n.set(p.key, e); }
  const list = [...n.values()].sort((a, b) => b.n - a.n);
  if (!list.length) return '';
  return `<div class="platchips" role="group" aria-label="Platforms"><button class="pchip${state.fPlat === 'Any' ? ' on' : ''}" data-act="fplat" data-v="Any" aria-pressed="${state.fPlat === 'Any'}">All platforms <i class="num">${xs.length}</i></button>
    ${list.map(e => `<button class="pchip${state.fPlat === e.p.key ? ' on' : ''}" data-act="fplat" data-v="${esc(e.p.key)}" aria-pressed="${state.fPlat === e.p.key}">${platBadge({ site: e.site }, 18)}${esc(e.p.name)} <i class="num">${e.n}</i></button>`).join('')}</div>`;
}
