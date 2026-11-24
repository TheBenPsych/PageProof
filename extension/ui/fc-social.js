// Copies found › Social media (4.9): copies on social sites are about the ACCOUNT that posted
// them. Stolen, Hide, Approve and "stolen before" all work per account, the account is found
// even when the link doesn't show it, and the live page preview gives way to "The post".
// Loaded after ui/fc-found.js (uses its state, FCD, LIST, HIST, answers and toasts).
Object.assign(state, { fTab: 'web', tabSaved: {}, fPlat: 'Any', fAcct: '', sView: 'copies', acctEdit: '', fVer: 'Any', fFol: 'Any', fType: 'Any', fCountry: 'Any', aSort: 'stolen', fGov: false });
// 4.24 (Ben): government accounts are hidden unless "Show government" is on (remembered).
api.storage.local.get('ppShowGov').then(st => { if (st && st.ppShowGov) state.fGov = true; }).catch(() => {});

const isSoc = c => c.use === 'social';
const isXAcct = a => !!a && /^(x|twitter)\.com$/.test(a.plat || '');
const inTab = c => (state.fTab === 'social') === isSoc(c);
const platOf = c => PP_SOCIAL.platform(c.site);
const platBadge = (c, size = 20) => { const p = platOf(c); return `<span class="plat" style="--pc:${p.color};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.45)}px" title="${esc(p.name)}" aria-label="${esc(p.name)}">${esc(p.short)}</span>`; };
const KIND_WORD = { post: 'post', reel: 'reel', video: 'video', short: 'short', story: 'story', pin: 'pin', photo: 'photo' };
const postWord = c => platOf(c).name + ' ' + (KIND_WORD[PP_SOCIAL.postKind(c.url)] || 'post');
const FROM = { link: 'the link itself', short: 'the short link\'s real address', public: 'the site\'s public post info', page: 'the post page\'s own info', browser: 'the post opened in your browser', you: 'you typed it' };
const sureTag = a => a.from === 'you' ? '<span class="tag grey">set by you</span>' : a.sure === 'likely' ? '<span class="tag warn" title="Read from the page\'s text. Check it once.">likely</span>' : '<span class="tag blue">sure</span>';
// The key used to count and remember an account, with linked accounts (the same person) folded together.
// 4.24 (Ben): the account's real name ("Matt Thibodeau") leads, with the handle or number from
// the link ("61580282979353", "channel/UC...") smaller beside it. The name comes from the profile.
function acctName(a) {
  if (!a) return '';
  const i = FCD && FCD.acctInfo && FCD.acctInfo[a.key];
  const n = String((i && i.ok && i.name && !(isXAcct(a) && !i.v) && i.name) || a.name || '').trim();
  const plain = s => String(s || '').toLowerCase().replace(/^@/, '').replace(/[\s._-]/g, '');
  return n && plain(n) !== plain(PP_SOCIAL.bareName(a)) && plain(n) !== plain(a.handle) ? n : '';
}
const acctHtml = (a, cls = '') => { const n = acctName(a); return n ? `<b class="${cls}">${esc(n)}</b> <span class="ahandle">${esc(a.handle)}</span>` : `<b class="${cls}">${esc(a.handle)}</b>`; };
const acctText = a => { const n = acctName(a); return n ? n + ' (' + a.handle + ')' : a.handle; };
const acctGroup = key => (FCD && FCD.acctLinkOf && FCD.acctLinkOf.get(key)) || key;

// The tab state: each tab keeps its own filters.
const TAB_KEYS = ['fFilter', 'fq', 'fWhen', 'fMatch', 'fYear', 'fQuarter', 'fPhoto', 'fView', 'fSort', 'fClient', 'fUse', 'fRisk', 'fCredit', 'fShop', 'fRepeat', 'fKnown', 'fOwner', 'fFresh', 'fPlat', 'fAcct', 'more', 'exp', 'sView', 'fVer', 'fFol', 'fType', 'fCountry'];
const TAB_START = { web: { fView: 'client' }, social: { fView: 'account' } };
function switchTab(t) {
  if (t === state.fTab) return;
  state.tabSaved[state.fTab] = Object.fromEntries(TAB_KEYS.map(k => [k, Array.isArray(state[k]) ? state[k].slice() : state[k]]));
  const base = { fFilter: 'New', fq: '', fWhen: 'any', fMatch: 'any', fYear: 'Any', fQuarter: 'Any', fPhoto: '', fSort: 'act', fClient: 'Any', fUse: 'Any', fRisk: 'Any', fCredit: 'Any', fShop: false, fRepeat: false, fKnown: '', fOwner: '', fFresh: false, fPlat: 'Any', fAcct: '', more: 250, exp: [], sView: 'copies', fVer: 'Any', fFol: 'Any', fType: 'Any', fCountry: 'Any' };
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
  const acctInfo = (await FC.meta.get('acctInfo')) || {};
  return { accts, acctLinkOf: linkOf, acctLinks: links, byName, stolenBy, acctInfo };
}

// ---------------------------------------------------------------- the account's details (4.10)
// Followers, verified, account type, country and owner company, read from the profile page in
// your own browser by itself: once per account, again every 30 days, a failed read again after
// 3 days. One account at a time while PageProof is open. Nothing to type in.
// 4.24: details read before the X fixes are not shown for X (they could be the viewer's own
// followers and the site's footer); every account is read again once, the X ones first.
const infoOf = c => { const i = (c && c.acct && FCD && FCD.acctInfo && FCD.acctInfo[c.acct.key]) || null; return i && !i.v && isXAcct(c.acct) ? null : i; };
const INFO_BUSY = new Set();
async function readAcctInfo(acct) {
  if (!acct || INFO_BUSY.has(acct.key)) return null;
  INFO_BUSY.add(acct.key);
  try {
    const pages = await PP_SOCIAL.readProfile(acct);
    const f = PP_SOCIAL.profileFacts(acct, pages);
    if (f.website && !f.shop) {
      const pf = await PP_CHECKS.readPage({ url: f.website, site: RS_SITE.of(f.website) }).catch(() => null);
      PP_SOCIAL.addShopSign(f, pf);
    }
    f.at = new Date().toISOString();
    const all = (await FC.meta.get('acctInfo')) || {};
    const was = all[acct.key];
    // A failed read keeps what was known before (with its date).
    all[acct.key] = f.ok ? f : { ...(was && was.ok ? was : {}), ok: !!(was && was.ok), failAt: f.at, at: was && was.ok ? was.at : f.at, tries: ((was && was.tries) || 0) + 1 };
    await FC.meta.set('acctInfo', all);
    if (FCD) FCD.acctInfo = all;
    FCD_STALE = true;
    return all[acct.key];
  } finally { INFO_BUSY.delete(acct.key); }
}
const infoDue = i => !i || (i.ok && !i.v) || (i.ok ? Date.now() - Date.parse(i.at) > 30 * 864e5 && (!i.failAt || Date.now() - Date.parse(i.failAt) > 3 * 864e5) : Date.now() - Date.parse(i.failAt || i.at || 0) > 3 * 864e5);
let infoQueueOn = false;
async function infoQueue() {
  if (infoQueueOn || !FCD) return;
  const st = await api.storage.local.get('ppAcctRead').catch(() => ({}));
  if (st.ppAcctRead === false) return;
  infoQueueOn = true;
  try {
    for (;;) {
      if (!FCD) await loadFC();
      const info = FCD.acctInfo || {};
      // Accounts with new copies first, then the rest; each account once.
      const todo = [...FCD.accts.values()].filter(e => e.copies.length && !INFO_BUSY.has(e.key) && infoDue(info[e.key]))
        .sort((a, b) => (isXAcct(b.acct) && info[b.key] && !info[b.key].v ? 1 : 0) - (isXAcct(a.acct) && info[a.key] && !info[a.key].v ? 1 : 0) || b.copies.filter(x => x.status === 'new').length - a.copies.filter(x => x.status === 'new').length)[0];
      if (!todo) break;
      await readAcctInfo(todo.acct).catch(() => null);
      socRedrawSoon();
      await new Promise(r => setTimeout(r, 4000));
    }
  } finally { infoQueueOn = false; }
}
// The filters on the Social media tab: Verified, Followers, Account type, Country.
const TYPES = ['Business', 'Creator', 'Organisation', 'Government', 'News or media', 'Fan page', 'Group', 'Person'];
// Kinds of check (4.24, Ben): paid = X blue / Meta Verified; gold = organisation X verified;
// grey = government; meta = Instagram/Facebook check (paid or earned look the same); yes = the
// site gave it (TikTok, YouTube...). 'blue' is the old single kind, read before 4.24.
const verOf = c => { const i = infoOf(c); if (!i || !i.ok || !i.verified) return 'nk'; return i.verified === 'blue' ? (isXAcct(c.acct) ? 'paid' : 'yes') : i.verified; };
const REAL_V = ['gold', 'grey', 'yes'];
// The check mark drawn the way the site draws it: a scalloped seal, coloured by kind.
const SEAL = (() => { let d = ''; for (let k = 0; k < 24; k++) { const a = Math.PI * 2 * k / 24 - Math.PI / 2, r = k % 2 ? 8.2 : 10; d += (k ? 'L' : 'M') + (12 + r * Math.cos(a)).toFixed(2) + ' ' + (12 + r * Math.sin(a)).toFixed(2); } return d + 'Z'; })();
const V_KIND = {
  paid: ['#1D9BF0', 'Paid check', 'Paid check (X Premium blue check or Meta Verified). Anyone can buy it, so it is not real verification.'],
  gold: ['#E2A90F', 'Verified organisation', 'Gold check: an organisation verified by X. Real verification.'],
  grey: ['#829AAB', 'Government', 'Grey check: a government or official account.'],
  meta: ['#0095F6', 'Meta check', 'Instagram and Facebook show the same check for paid Meta Verified and earned verification.'],
  yes: ['#20D5EC', 'Verified', 'Verified by the site itself (not bought).'],
};
const vIcon = (k, size = 15) => { const v = V_KIND[k]; if (!v) return ''; return `<svg class="vseal" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${SEAL}" fill="${v[0]}"/><path d="M7.6 12.3l3 3 5.8-6.4" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`; };
const vBadge = k => V_KIND[k] ? `<span class="vchk v-${k}" title="${esc(V_KIND[k][2])}">${vIcon(k)}${esc(V_KIND[k][1])}</span>` : '';
const typeOf = c => { const i = infoOf(c); return i && i.ok && i.type ? i.type : 'nk'; };
const countryOfAcct = c => { const i = infoOf(c); return i && i.country ? i.country : 'nk'; };
const folOf = c => { const i = infoOf(c); return i && i.ok ? i.followers : null; };
function passAcct(c) {
  if (state.fVer !== 'Any') { const v = verOf(c); if (state.fVer === 'real' ? !REAL_V.includes(v) : v !== state.fVer) return false; }
  if (!state.fGov && state.fType !== 'Government' && typeOf(c) === 'Government') return false;
  if (!state.fRepost && c.rp && c.rp.state === 'repost') return false;
  if (state.fFol !== 'Any' && PP_SOCIAL.folBand(folOf(c)) !== state.fFol) return false;
  if (state.fType !== 'Any' && typeOf(c) !== state.fType) return false;
  if (state.fCountry !== 'Any' && countryOfAcct(c) !== state.fCountry) return false;
  return true;
}
// passAcct, leaving one filter out (for the numbers in its own menu).
function passAcctBut(c, k) { const was = state[k]; state[k] = 'Any'; try { return passAcct(c); } finally { state[k] = was; } }
function acctFilterLine(dd, xsAll) {
  // 4.29: xsAll includes hidden reposts (for their count); the other filters count only what shows.
  const xs = state.fRepost ? xsAll : xsAll.filter(c => !(c.rp && c.rp.state === 'repost'));
  const n = (k, test) => xs.filter(c => passAcctBut(c, k) && test(c)).length;
  const countries = [...new Set(xs.map(countryOfAcct).filter(x => x !== 'nk'))].sort();
  const busy = FCD && FCD.accts ? [...FCD.accts.values()].filter(e => e.copies.length && !(FCD.acctInfo || {})[e.key]).length : 0;
  return `<div class="acctfilters" aria-label="Account filters">
    ${dd('fVer', 'Verified', [['Any', 'Any'], ['real', 'Really verified (not bought)', n('fVer', c => REAL_V.includes(verOf(c))) + ' copies'], ['paid', 'Paid check (X blue, Meta Verified)', n('fVer', c => verOf(c) === 'paid') + ''], ['gold', 'Organisation (X gold check)', n('fVer', c => verOf(c) === 'gold') + ''], ['grey', 'Government (grey check)', n('fVer', c => verOf(c) === 'grey') + ''], ['meta', 'Instagram/Facebook check', n('fVer', c => verOf(c) === 'meta') + ''], ['yes', 'Verified by the site', n('fVer', c => verOf(c) === 'yes') + ''], ['no', 'No check', n('fVer', c => verOf(c) === 'no') + ''], ['nk', 'Not known', n('fVer', c => verOf(c) === 'nk') + '']], state.fVer, false, 'Any')}
    ${dd('fFol', 'Followers', [['Any', 'Any'], ...PP_SOCIAL.FOL_BANDS.map(([, , l], i) => [String(i), l, n('fFol', c => PP_SOCIAL.folBand(folOf(c)) === String(i)) + '']), ['nk', 'Not known', n('fFol', c => folOf(c) == null) + '']], state.fFol, false, 'Any')}
    ${dd('fType', 'Account type', [['Any', 'Any'], ...TYPES.map(t => [t, t, n('fType', c => typeOf(c) === t) + '']), ['nk', 'Not known', n('fType', c => typeOf(c) === 'nk') + '']], state.fType, false, 'Any')}
    ${dd('fCountry', 'Country', [['Any', 'Any'], ...countries.map(t => [t, t, n('fCountry', c => countryOfAcct(c) === t) + '']), ['nk', 'Not known', n('fCountry', c => countryOfAcct(c) === 'nk') + '']], state.fCountry, false, 'Any')}
    ${(() => { const g = xs.filter(c => typeOf(c) === 'Government').length; return state.fType === 'Government' ? '' : `<label class="chip" style="cursor:pointer;gap:6px" title="People and offices in government, and anyone running for office. Hidden unless you tick this."><input type="checkbox" data-act="fgov" ${state.fGov ? 'checked' : ''}> Show government${g ? ` <span class="faint">(${g} ${state.fGov ? 'shown' : 'hidden'})</span>` : ''}</label>`; })()}
    ${(() => { const r = xsAll.filter(c => c.rp && c.rp.state === 'repost').length; return `<label class="chip" style="cursor:pointer;gap:6px" title="Posts that only share, repost or quote someone else's post. The original poster is the lead. Hidden unless you tick this."><input type="checkbox" data-act="frepost" ${state.fRepost ? 'checked' : ''}> Show reposts and shares${r ? ` <span class="faint">(${r} ${state.fRepost ? 'shown' : 'hidden'})</span>` : ''}</label>`; })()}
    ${busy ? `<span class="faint" style="font-size:12.5px">${plural(busy, 'account')} still being read</span>` : ''}</div>`;
}
// The little badges on a row: check mark, followers, type, company.
function acctBadges(c) {
  const i = infoOf(c);
  if (!i || !i.ok) return '';
  const vk = verOf(c), v = vBadge(vk);
  const t = i.type && !(i.type === 'Organisation' && vk === 'gold') && !(i.type === 'Government' && vk === 'grey') ? `<span class="atype${i.type === 'Business' || i.type === 'Organisation' ? ' biz' : i.type === 'Government' ? ' gov' : ''}${i.typeSure === 'guess' ? ' guess' : ''}" title="${esc(i.type === 'Government' && i.gov ? 'Government, going by ' + i.gov + '. Hidden unless Show government is on.' : i.typeSure === 'guess' ? 'A guess from: ' + (i.signs || []).join(', ') : 'Read from the profile' + (i.category ? ': ' + i.category : ''))}">${esc(i.type)}${i.typeSure === 'guess' ? ' (guess)' : ''}</span>` : '';
  const f = i.followers != null ? `<span class="afol num" title="${esc(i.followers.toLocaleString() + ' ' + i.fw + ' on ' + shortDate(i.at))}">${PP_SOCIAL.shortNum(i.followers)} ${esc(i.fw)}</span>` : '';
  const co = i.company ? `<span class="aco" title="Company named on the account">${esc(i.company)}</span>` : '';
  return v + t + f + co;
}
// "About this account" in the panel's Account tab.
function acctAbout(c) {
  const a = c.acct; if (!a) return '';
  const i = infoOf(c), busy = INFO_BUSY.has(a.key);
  if (!i) return `<section class="dsec"><div class="dsh">About this account</div><span class="faint" style="font-size:13px">${busy ? 'Reading the profile in your browser…' : 'Not read yet. PageProof reads every account\'s profile by itself, one at a time.'}</span></section>`;
  const enc = encodeURIComponent;
  const rows = [];
  if (i.name) rows.push(['Name', i.name]);
  if (i.followers != null) rows.push(['Followers', i.followers.toLocaleString() + ' ' + i.fw]);
  const vk = verOf(c);
  rows.push(['Verified', vk === 'no' ? 'No check' : vk === 'nk' ? 'Not known' : V_KIND[vk][1] + '. ' + V_KIND[vk][2], vk]);
  rows.push(['Account type', i.type ? i.type + (i.typeSure === 'guess' ? ' (a guess)' : '') + (i.category ? ' · ' + i.category : '') : 'Not known']);
  if (i.type === 'Government' && i.gov) rows.push(['Why government', 'Going by ' + i.gov]);
  if (i.signs && i.signs.length) rows.push(['Business signs', i.signs.join(', ')]);
  if (i.company) rows.push(['Company', i.company + (i.address ? '\n' + i.address : '')]);
  if (i.country) rows.push(['Based in', i.place && i.place !== i.country ? i.place : i.country]);
  if (i.created) rows.push(['Created', i.created]);
  if (i.oldNames && i.oldNames.length) rows.push(['Old names', i.oldNames.join(', ')]);
  if (i.website) rows.push(['Website', i.website + (i.shop ? ' (sells things)' : '')]);
  if (i.email) rows.push(['Email', i.email]);
  if (i.phone) rows.push(['Phone', i.phone]);
  const st = (/,\s*([A-Z]{2})\s+\d{5}/.exec(i.address || '') || [])[1];
  const look = i.company ? [['State business register', 'https://opencorporates.com/companies' + (st ? '/us_' + st.toLowerCase() : '') + '?q=' + enc(i.company.replace(/,?\s(LLC|L\.L\.C\.|Inc\.?|Corp\.?|Ltd\.?|Co\.)$/i, ''))], ['USPTO trademarks', 'https://tmsearch.uspto.gov/search/search-results?query=' + enc(i.company.replace(/,?\s(LLC|L\.L\.C\.|Inc\.?|Corp\.?|Ltd\.?|Co\.)$/i, ''))], ['Google', 'https://www.google.com/search?q=' + enc('"' + i.company + '"')]] : [];
  return `<section class="dsec" id="acctabout"><div class="row" style="justify-content:space-between;gap:8px"><div class="dsh" style="margin:0">About this account</div><span class="faint" style="font-size:12px">${i.ok ? 'Read ' + esc(shortDate(i.at)) : 'Couldn\'t read the profile'}${i.failAt && i.ok ? ' · last try failed' : ''}</span></div>
    ${i.ok ? `<dl class="facts">${rows.map(([k, v, ic]) => `<dt>${esc(k)}</dt><dd style="white-space:pre-line;overflow-wrap:anywhere">${ic ? vIcon(ic, 16) + ' ' : ''}${esc(v)}</dd>`).join('')}</dl>` : `<span class="faint" style="font-size:13px">${esc(platOf(c).name)} didn't show the profile. PageProof tries again by itself in 3 days.</span>`}
    ${look.length ? `<div class="row" style="gap:6px;flex-wrap:wrap"><span class="muted" style="font-size:12.5px">Who's behind ${esc(i.company)}:</span>${look.map(([l, u]) => `<a class="chip" href="${safeUrl(u)}" target="_blank" rel="noreferrer">${esc(l)}</a>`).join('')}</div>` : ''}
    <div><button class="btn ghost sm" data-act="readinfo" data-v="${esc(c.id)}"${busy ? ' disabled data-why="Already reading this account. Wait a moment."' : ''}>${busy ? 'Reading…' : 'Read again now'}</button></div></section>`;
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
// Step D: open the post in your own browser (signed in, like a Capture sees it) in a quiet pinned
// PageProof tab, read who posted it, and close the tab again.
async function findInBrowser(c) {
  let tab;
  try {
    tab = await PP_SOCIAL.openQuiet(c.url);
    await new Promise(r => setTimeout(r, 2500));      // social sites draw the post after loading
    const [res] = await api.scripting.executeScript({ target: { tabId: tab.id }, func: readPostInTab });
    const now = await api.tabs.get(tab.id).catch(() => tab);
    const t = res && res.result;
    const r = t && PP_SOCIAL.fromTags(t, (now && now.url) || c.url);
    const acct = r && r.acct ? { ...r.acct, from: 'browser', sure: r.acct.sure || 'likely', at: new Date().toISOString() } : null;
    await FC.setAcct(c.id, acct || undefined, r && r.post || undefined);
    FCD_STALE = true;
    return acct;
  } catch (e) { return null; } finally { PP_SOCIAL.closeQuiet(tab); }
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
  return `<div class="l1 soc">${platBadge(c)}${a ? acctHtml(a) : '<b class="nofind">Account not found yet</b>'}<span class="pkind">${esc(postWord(c))}</span>${c.status !== 'new' ? tagFor(c) : ''}${rpTags(c)}
    ${a && c.repeat && c.status === 'new' ? `<span class="tag bad" title="You marked this account stolen before">Marked stolen ${c.repeat === 1 ? 'once' : c.repeat + ' times'} before</span>` : ''}
    ${a ? acctBadges(c) : ''}
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
    <div class="row" style="gap:6px"><a class="btn sm" href="${safeUrl(linkOf(c))}" target="_blank" rel="noreferrer">${ic('ext', 14)} Open post</a><button class="btn sm" data-act="capturecopy">${ic('capture', 14)} Capture the post</button><button class="btn ghost sm" data-act="trypage">Try the live preview anyway</button></div></section>${rpBox(c)}`;
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
    </dl></section>${acctAbout(c)}` : ''}
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
  const fol = e => { const c = e.xs.find(x => x.acct && infoOf(x) && infoOf(x).followers != null); return c ? infoOf(c).followers : -1; };
  const by = { stolen: (a, b) => (FCD.stolenBy.get(b.k) || []).length - (FCD.stolenBy.get(a.k) || []).length, fol: (a, b) => fol(b) - fol(a), copies: (a, b) => b.xs.length - a.xs.length, new: (a, b) => b.xs.filter(x => x.status === 'new').length - a.xs.filter(x => x.status === 'new').length };
  const list = [...m.values()].sort((a, b) => (a.k === '~') - (b.k === '~') || (by[state.aSort] || by.stolen)(a, b) || b.xs.length - a.xs.length);
  const missing = rows.filter(c => !c.acct && c.status !== 'removed');
  const allowed = k => { try { return RS_LISTS.allowed.includes(k); } catch (e) { return false; } };
  const tr = e => {
    if (e.k === '~') return `<tr class="arow" data-act="acctonly" data-v="~"><td><span class="plat" style="--pc:#6B7280">?</span> <b style="color:var(--warn)">Account not found yet</b></td><td></td><td></td><td></td><td></td><td class="num">${e.xs.length}</td><td class="num">${e.xs.filter(x => x.status === 'new').length}</td><td class="num">${e.xs.filter(x => x.status === 'stolen').length}</td><td>${esc([...new Set(e.xs.map(x => x.clientName).filter(Boolean))].slice(0, 2).join(', '))}</td><td><span class="tag warn">Set account</span></td><td></td></tr>`;
    const first = e.xs.find(x => x.acct.key === e.k) || e.xs[0], a = first.acct;
    const st = (FCD.stolenBy.get(e.k) || []).length, others = [...e.keys].filter(k => k !== a.key);
    const linked = (FCD.acctLinks.find(g => g.includes(a.key)) || []).filter(k => k !== a.key && !e.keys.has(k));
    const clients = [...new Set(e.xs.map(x => x.clientName).filter(Boolean))];
    const i = infoOf(first), vk = verOf(first), vt = V_KIND[vk] ? `<span title="${esc(V_KIND[vk][1] + ': ' + V_KIND[vk][2])}">${vIcon(vk, 17)}</span>` : vk === 'no' ? '<span class="faint">No</span>' : '<span class="faint">?</span>';
    const status = allowed(a.key) ? '<span class="tag ok">Approved</span>' : st ? '<span class="tag bad">Known stolen</span>' : '<span class="tag grey">Watching</span>';
    return `<tr class="arow" data-act="acctonly" data-v="${esc(a.key)}"><td>${platBadge(first)} ${acctHtml(a)}${others.length || linked.length ? ` <span class="faint" style="font-size:12px">+ ${esc([...others, ...linked].map(k => (FCD.accts.get(k) || { acct: { handle: k } }).acct.handle + ' on ' + PP_SOCIAL.platform((FCD.accts.get(k) || {}).site || k.split('/')[0]).name).join(', '))}</span>` : ''}</td>
      <td class="num">${i && i.ok && i.followers != null ? PP_SOCIAL.shortNum(i.followers) : '<span class="faint">?</span>'}</td><td>${vt}</td><td>${i && i.ok && i.type ? esc(i.type) + (i.typeSure === 'guess' ? ' <span class="faint">(guess)</span>' : '') : '<span class="faint">Not known</span>'}${i && i.company ? '<br><span class="faint" style="font-size:12px">' + esc(i.company) + '</span>' : ''}</td><td>${i && i.country ? esc(i.country) : '<span class="faint">?</span>'}</td>
      <td class="num">${e.xs.length}</td><td class="num">${e.xs.filter(x => x.status === 'new').length}</td><td class="num">${st}</td><td>${esc(clients.slice(0, 2).join(', '))}${clients.length > 2 ? ' +' + (clients.length - 2) : ''}</td><td>${status}</td>
      <td><a class="btn ghost sm" href="${safeUrl(a.url)}" target="_blank" rel="noreferrer" data-act="openlink" aria-label="Open ${esc(a.handle)}">${ic('ext', 14)}</a></td></tr>`;
  };
  return `${missing.length ? `<div class="banner info" style="margin:12px 14px 0;padding:10px 12px"><span style="flex:1 1 260px;font-size:13.5px"><b>${plural(missing.length, 'post', 'posts')} without an account yet.</b> PageProof keeps trying by itself. Looking in your browser finds most of the rest (it opens each post in a background tab for a few seconds).</span><button class="btn sm" data-act="browserall">Look up ${missing.length} in your browser</button></div>` : ''}
  <div style="overflow-x:auto"><table class="accts"><thead><tr><th>Account</th>${[['fol', 'Followers'], ['', 'Verified'], ['', 'Type'], ['', 'Country'], ['copies', 'Copies'], ['new', 'New'], ['stolen', 'Stolen']].map(([k, l]) => k ? `<th><button class="thsort${state.aSort === k ? ' on' : ''}" data-act="asort" data-v="${k}" aria-pressed="${state.aSort === k}">${l}${state.aSort === k ? ' ▾' : ''}</button></th>` : `<th>${l}</th>`).join('')}<th>Clients</th><th>Status</th><th></th></tr></thead><tbody>${list.map(tr).join('')}</tbody></table></div>`;
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
  fgov: async (v, el) => { state.fGov = !!(el && el.checked); await api.storage.local.set({ ppShowGov: state.fGov }).catch(() => {}); render(true); },
  ftab: v => { switchTab(v); render(true); },
  readinfo: async v => {
    const c = FCD.copies.find(x => x.id === v);
    if (!c || !c.acct) return;
    const p = readAcctInfo(c.acct); render(true);
    const i = await p;
    toast(i && i.ok ? 'Read ' + c.acct.handle + '\'s profile.' : platOf(c).name + ' didn\'t show the profile. PageProof tries again in 3 days.');
    render(true);
  },
  asort: v => { state.aSort = v; render(true); },
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
function passMainNoAcct(c) { const k = ['fVer', 'fFol', 'fType', 'fCountry', 'fRepost'], was = k.map(x => state[x]); k.forEach(x => { state[x] = x === 'fRepost' ? true : 'Any'; }); try { return passMain(c); } finally { k.forEach((x, i) => { state[x] = was[i]; }); } }

// ---------------------------------------------------------------- reposts and shares (4.29, Ben)
// A copy found on an account page is checked in your browser: PageProof finds the exact post, and
// tells you when it is only a share or repost of someone else's post (repost.js). Reposts are hidden
// unless "Show reposts and shares" is ticked, and point to the original post. Never answered for you.
state.fRepost = false;
api.storage.local.get('ppShowReposts').then(st => { if (st && st.ppShowReposts) state.fRepost = true; }).catch(() => {});
const isRepost = c => !!(c.rp && c.rp.state === 'repost');
const exactPost = c => (c.rp && c.rp.post) || '';
const linkOf = c => exactPost(c) || c.url;
const RP_BUSY = new Set();
const rpWord = c => ({ share: 'Share', repost: 'Repost', quote: 'Quote', reblog: 'Reblog' }[(c.rp && c.rp.kind) || ''] || PP_REPOST.WORD[PP_REPOST.plat(c.site)] || 'Repost');
const origName = c => c.rp && c.rp.orig ? acctText(c.rp.orig) : 'another account';
async function rpCheck(c) {
  if (RP_BUSY.has(c.id)) return null;
  RP_BUSY.add(c.id);
  try {
    const rp = await PP_REPOST.check(c).catch(() => ({ at: new Date().toISOString(), state: 'failed' }));
    if (!rp) return null;
    // Read the copy again right before saving and change only rp, so an answer given meanwhile stays.
    const cc = await FC.DB.get('copies', c.id);
    if (!cc) return null;
    cc.rp = rp; await FC.DB.put('copies', cc);
    c.rp = rp; FCD_STALE = true;
    return rp;
  } finally { RP_BUSY.delete(c.id); }
}
// New social copies that need it are checked quietly, one at a time, while Copies found is open
// (off together with "Read account pages in your browser").
let rpQueueOn = false;
async function rpQueue() {
  if (rpQueueOn || !FCD) return;
  const st = await api.storage.local.get('ppAcctRead').catch(() => ({}));
  if (st.ppAcctRead === false) return;
  rpQueueOn = true;
  try {
    for (;;) {
      if (route() !== 'found' && route() !== 'review') break;
      if (!FCD) await loadFC();
      const c = FCD.copies.filter(c => isSoc(c) && PP_REPOST.due(c) && !RP_BUSY.has(c.id))
        .sort((a, b) => (PP_REPOST.profileOnly(b) ? 1 : 0) - (PP_REPOST.profileOnly(a) ? 1 : 0) || String(b.firstSeen || '').localeCompare(String(a.firstSeen || '')))[0];
      if (!c) break;
      await rpCheck(c);
      socRedrawSoon();
      await new Promise(r => setTimeout(r, 4000));
    }
  } finally { rpQueueOn = false; }
}
// Tags on the row.
function rpTags(c) {
  if (isRepost(c)) return `<span class="tag warn" title="${esc(rpWord(c))} of ${esc(origName(c))}'s post. The original post is the lead.${c.rp.sure === 'likely' ? ' Read from the page: check it once.' : ''}">${esc(rpWord(c))} of ${esc(c.rp.orig ? c.rp.orig.handle : 'another account')}</span>`;
  if (exactPost(c)) return '<span class="tag blue" title="The link went to the account page. PageProof found the post that holds the photo.">Exact post found</span>';
  if (PP_REPOST.profileOnly(c)) return `<span class="tag grey" title="The search engine linked the account page, not one post.">${RP_BUSY.has(c.id) ? 'Finding the post…' : 'Link goes to the account page'}</span>`;
  return '';
}
// The box in the copy's panel ("The post" section).
function rpBox(c) {
  const p = PP_REPOST.plat(c.site);
  if (!p) return '';
  const busy = RP_BUSY.has(c.id), rp = c.rp, prof = PP_REPOST.profileOnly(c);
  const again = `<button class="btn ghost sm" data-act="rpcheck" data-v="${esc(c.id)}"${busy ? ' disabled' : ''}>${busy ? 'Looking…' : 'Look again'}</button>`;
  if (busy && !rp) return `<section class="dsec rpbox"><div class="dsh">${prof ? 'Finding the post' : 'Checking for a share or repost'}</div><p class="muted" style="margin:0;font-size:13px">${prof ? 'Scrolling the account page in a background tab to find the post that holds the photo…' : 'Opening the post in a background tab…'}</p></section>`;
  if (rp && rp.state === 'repost') {
    return `<section class="dsec rpbox"><div class="dsh">${esc(rpWord(c))} of someone else's post</div>
      <p style="margin:0;font-size:13.5px">${esc(c.acct ? acctText(c.acct) : 'This account')} ${rp.kind === 'quote' ? 'quoted' : rp.kind === 'share' ? 'shared' : rp.kind === 'reblog' ? 'reblogged' : 'reposted'} a post by <b>${esc(origName(c))}</b>. The original poster is the lead.${rp.sure === 'likely' ? ' <span class="tag warn">likely</span>' : ''}</p>
      <div class="row" style="gap:6px;flex-wrap:wrap">${rp.origPost ? `<a class="btn sm" href="${safeUrl(rp.origPost)}" target="_blank" rel="noreferrer">${ic('ext', 14)} Open the original post</a>` : ''}${rp.orig && rp.orig.url ? `<a class="btn sm" href="${safeUrl(rp.orig.url)}" target="_blank" rel="noreferrer">${ic('ext', 14)} Open ${esc(rp.orig.handle)}</a>` : ''}${rp.post ? `<a class="btn ghost sm" href="${safeUrl(rp.post)}" target="_blank" rel="noreferrer">${ic('ext', 14)} Open their ${esc(rpWord(c).toLowerCase())}</a>` : ''}${again}</div>
      <span class="faint" style="font-size:12.5px">Reposts and shares are hidden from the list unless "Show reposts and shares" is ticked. Nothing was answered for you.</span></section>`;
  }
  if (!prof) return rp && rp.state === 'own' ? '' : '';
  if (rp && rp.post) return `<section class="dsec rpbox"><div class="dsh">Exact post found</div><p class="muted" style="margin:0;font-size:13px">The search linked the account page. This is the post that holds the photo${rp.pct ? ` (${rp.pct}% lines up)` : ''}.</p><div class="row" style="gap:6px"><a class="btn sm" href="${safeUrl(rp.post)}" target="_blank" rel="noreferrer">${ic('ext', 14)} Open the post</a>${again}</div></section>`;
  const why = !rp ? 'PageProof will look for the post shortly.' : rp.state === 'own' ? 'The photo is on the account page, but the post\'s own link wasn\'t shown.' : rp.state === 'blocked' ? platOf(c).name + ' asked to log in. Log in to ' + platOf(c).name + ' in this browser, then press Look again.' : 'The photo wasn\'t found in the newest posts. It may be older, or deleted.';
  return `<section class="dsec rpbox"><div class="dsh">Link goes to the account page, not the post</div><p class="muted" style="margin:0;font-size:13px">${esc(why)}</p><div class="row" style="gap:6px"><button class="btn sm" data-act="rpcheck" data-v="${esc(c.id)}"${busy ? ' disabled' : ''}>${busy ? 'Looking…' : rp ? 'Look again' : 'Find the post now'}</button></div></section>`;
}
Object.assign(ACTS, {
  frepost: async (v, el) => { state.fRepost = !!(el && el.checked); await api.storage.local.set({ ppShowReposts: state.fRepost }).catch(() => {}); render(true); },
  rpcheck: async v => {
    await loadFC();
    const c = FCD.copies.find(x => x.id === v); if (!c) return;
    toast(PP_REPOST.profileOnly(c) ? 'Looking for the post on ' + (c.acct ? c.acct.handle : 'the account') + '\'s page in a background tab…' : 'Opening the post in a background tab…');
    const p = rpCheck(c); render(true);
    const rp = await p;
    toast(!rp ? 'This site isn\'t checked for reposts.' : rp.state === 'repost' ? rpWord(c) + ' of ' + origName(c) + '.' : rp.post ? 'Found the post.' : rp.state === 'own' ? 'Their own post, not a repost.' : rp.state === 'blocked' ? platOf(c).name + ' asked to log in.' : 'The photo wasn\'t found on the page.');
    render(true);
  },
});
