// Find copies › All copies found, the copy details panel, and Review new copies.
// Every copy found by every search, Keep searching and today's 50, with your answer for each
// (Stolen, Licensed, Remove, Skip), undo for every answer, hiding sites and countries, and
// grouping by client, photo, site or site owner.
Object.assign(state, {
  open: '', picked: [], fFilter: 'New', fq: '', fWhen: 'any', fMatch: 'any', fYear: 'Any', fQuarter: 'Any', fPhoto: '', sis: null, fView: 'client', fSort: 'act', fClient: 'Any', fUse: 'Any', fRisk: 'Any', fCredit: 'Any', fShop: false, fRepeat: false, fKnown: '', fSpam: 'hide', fOwner: '',
  showFilters: false, fFresh: false, dTab: 'sum', dTabFor: '', dView: '', slide: 50, fCols: null, exp: [], more: 250, qi: 0, cmpMode: 'side', cut: 50, rvTab: 'review', recentHides: [],
});
const HIST = [];         // every answer and hide, newest last, so each one can be undone in turn
let FCD = null;          // what's loaded from the copies database (cleared when anything changes)
// A change elsewhere (Keep searching, the picture rebuild, another tab) only marks it stale: the
// next draw reads it again, but a click in between still finds its copy. (Clearing it outright
// made a button press do nothing until the page was drawn again, 4.6.4.)
let FCD_STALE = false;
api.storage.onChanged.addListener(ch => { if (ch.fcChanged || ch.rsHidden || ch.rsAllowed || ch.rsStolen || ch.fcShownCountries || ch.ppSocialSites) FCD_STALE = true; });

const STATUS = { new: ['New', 'copy'], stolen: ['Stolen', 'bad'], licensed: ['Licensed', 'ok'], removed: ['Removed', 'grey'] };
const RISK = { ok: ['Looks normal', ''], watch: ['Worth a look', 'warn'], sus: ['Suspicious', 'bad'] };
const CREDIT = { kept: 'Credits your client', removed: 'Credit removed', '': 'Not checked yet' };
const FLAG_ICON = {
  sus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5v.01"/></svg>',
  watch: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>',
  cmi: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M15 9.5a4 4 0 1 0 0 5"/><path d="M4 20L20 4"/></svg>',
  sell: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 3v18"/><path d="M16.5 7.5c-.8-1.2-2.4-2-4.5-2-2.6 0-4.3 1.3-4.3 3.2 0 4.6 9.1 2.3 9.1 7 0 1.9-1.9 3.3-4.6 3.3-2.3 0-4-.9-4.9-2.3"/></svg>',
};
const shortDate = iso => { if (!iso) return ''; const d = new Date(iso); const t = new Date(); if (d.toDateString() === t.toDateString()) return 'Today'; const y = new Date(t - 86400000); if (d.toDateString() === y.toDateString()) return 'Yesterday'; return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === t.getFullYear() ? undefined : 'numeric' }); };
const plural = (n, a, b) => n + ' ' + (n === 1 ? a : (b || a + 's'));

// The nearest folder with a VA or 1-… number, like FC.regFor, from numbers already read.
function regSync(p, regs) {
  let rel = (p && p.folder) || '', va = '', app = '';
  while (rel && !(va && app)) { const r = regs[rel]; if (r) { va = va || r.va; app = app || r.app; } rel = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : ''; }
  return va || app ? { va, app } : null;
}
// Reading the copies can take seconds in a big library. Only one read runs at a time, and a read
// that started before an answer or a hide on this page is thrown away and done again, so it can
// never put an answered row back on the list (4.9.1). Until then FCD keeps the last copies, so a
// click in between still finds its copy.
let FCD_GEN = 0, FCD_P = null;
function dropFC() { FCD_GEN++; FCD_STALE = true; }
function loadFC() {
  if (FCD && !FCD_STALE) return Promise.resolve(FCD);
  if (!FCD_P) FCD_P = (async () => {
    try {
      for (;;) {
        const gen = FCD_GEN; FCD_STALE = false;
        const d = await readFC();
        if (gen === FCD_GEN) { FCD = d; return d; }
      }
    } finally { FCD_P = null; }
  })();
  return FCD_P;
}
async function readFC() {
  const [copies, clients, countries, sites] = [await FC.allCopies(), await FC.DB.all('clients'), await FC.shownCountries(), await FC.DB.all('sites')];
  const ids = new Set(copies.map(c => c.photo));
  const photos = new Map();
  const idList = [...ids];
  (await FC.DB.getMany('photos', idList)).forEach((p, i) => { if (p) photos.set(idList[i], p); });
  const facts = new Map(sites.map(f => [f.site, f]));
  const regs = (await FC.meta.get('regs')) || {};
  for (const c of copies) {
    if (PEND.has(c.id)) c.status = PEND.get(c.id);   // answered a moment ago, still being saved
    if (!STATUS[c.status]) c.status = 'new';     // a line edited by hand in found-copies.txt
    c.risk = FC.riskOf(c, facts.get(c.site));
    c.use = FC.useOf(c);          // 4.9: worked out again each time (your social-site choices can change it)
    if (!c.country) c.country = FC.countryOf(c.site);   // copies brought back from found-copies.txt had none
    const p = photos.get(c.photo);
    c.photoName = p ? p.name : c.photoName || 'Photo';
    c.clientName = (p && p.client) || c.client || '';
    // 4.7: the Damages column. No publish date (an odd file name) means no damages answer at all.
    const pub = PP_CHECKS.pubDate(p);
    c.dmg = pub ? PP_CHECKS.damages(pub, regSync(p, regs)) : null;
  }
  const ownerList = await FC.owners([...new Set(copies.filter(c => c.status !== 'removed').map(c => c.site))]);
  const ownerOf = new Map();
  for (const o of ownerList) for (const s of o.sites) ownerOf.set(s, o);
  // Repeat offenders: how many copies you already marked Stolen on the same site, or on any
  // site of the same owner.
  const stolenSite = new Map(), stolenOwner = new Map();
  for (const c of copies) if (c.status === 'stolen') {
    stolenSite.set(c.site, (stolenSite.get(c.site) || 0) + 1);
    const o = ownerOf.get(c.site); if (o && o.real) stolenOwner.set(o.key, (stolenOwner.get(o.key) || 0) + 1);
  }
  for (const c of copies) {
    const o = ownerOf.get(c.site), own = c.status === 'stolen' ? 1 : 0;
    const bySite = (stolenSite.get(c.site) || 0) - own, byOwner = o && o.real ? (stolenOwner.get(o.key) || 0) - own : 0;
    c.repeat = Math.max(bySite, byOwner, 0);
    c.repeatWho = byOwner > bySite ? o.name : c.site;
  }
  // 4.9: accounts on social sites (stolen before is counted per account there, not per site).
  const soc = await socIndex(copies);
  // 4.23: your list of links stolen before. The exact page gets a "Stolen before" tag, and other
  // pages on the same website (or by the same social account) count as a repeat offender.
  try { await RS_STOLEN.load(); } catch (e) { /* folder not reachable: the browser's copy */ }
  const K = RS_STOLEN.index();
  for (const c of copies) {
    c.known = K.pages.size > 0 && [c.url, ...(c.alts || [])].some(u => K.pages.has(FC.pageKey(u)));
    const n = (isSoc(c) ? (c.acct ? K.accts.get(c.acct.key) || 0 : 0) : K.sites.get(c.site) || 0) - (c.known ? 1 : 0);
    c.knownN = Math.max(n, 0);
    if (c.knownN) { if (!c.repeat) c.repeatWho = isSoc(c) && c.acct ? c.acct.handle : c.site; c.repeat = (c.repeat || 0) + c.knownN; }
  }
  // 4.24: spam blog farms (random addresses on throwaway sites). Tagged, and hidden until you show them.
  const spam = FC.spamMarks(copies);
  for (const c of copies) c.spam = spam.get(c.id) || null;
  let unhid = [];
  try { unhid = (await (globalThis.browser || chrome).storage.local.get('ppSocialUnhid')).ppSocialUnhid || []; } catch (e) { /* none */ }
  return { unhid, copies, photos, clients: new Map(clients.map(c => [c.name, c])), countries, facts, owners: ownerList, ownerOf, ...soc };
}
const siteHidden = c => FC.hiddenCopy(c, RS_LISTS.hidden) || (PEND_ARR.length > 0 && FC.hiddenCopy(c, PEND_ARR));
const repeatTag = c => c.repeat && c.status === 'new' ? `<span class="tag bad" style="font-size:11.5px" title="You already marked ${c.repeat} ${c.repeat === 1 ? 'copy' : 'copies'} on ${esc(c.repeatWho)} as Stolen">${c.repeat} stolen before</span>` : '';
const actScore = c => (c.status === 'new' || c.status === 'stolen' ? 40 : 0) + (c.repeat && c.status === 'new' ? 30 : 0) + (c.status !== 'removed' ? 20 : 0) + (c.use === 'shop' ? 20 : 0) + (c.credit === 'removed' ? 12 : 0) + (c.risk.level === 'sus' ? -6 : 0) + (c.pct || 0) / 10;
const tagFor = c => `<span class="tag ${STATUS[c.status][1]}">${STATUS[c.status][0]}</span>`;
const lineBar = p => p == null || p < 0 ? '<span class="faint" style="font-size:12.5px">—</span>' : `<div class="row" style="gap:8px;flex-wrap:nowrap"><span class="num" style="width:34px;text-align:right;font-weight:600">${p}%</span><span class="bar" style="width:46px;flex-shrink:0"><i style="width:${p}%;background:${p >= 80 ? 'var(--bad)' : p >= 60 ? 'var(--warn)' : 'var(--faint)'}"></i></span></div>`;
function flagsFor(c) {
  const f = [];
  if (c.risk.level === 'sus') f.push(['sus', 'bad', 'Suspicious site: ' + c.risk.why.join(', ')]);
  if (c.risk.level === 'watch') f.push(['watch', 'warn', 'Worth a look: ' + c.risk.why.join(', ')]);
  if (c.credit === 'removed') f.push(['cmi', 'copy', 'Credit removed: your client\'s photo has a copyright line in its hidden data and their copy does not']);
  if (c.use === 'shop') f.push(['sell', 'ok', 'Selling something with it']);
  return f.map(([k, col, t]) => `<span class="flag" style="color:var(--${col});background:var(--${col}-soft)" title="${esc(t)}" aria-label="${esc(t)}">${FLAG_ICON[k]}</span>`).join('') || '<span class="faint" style="font-size:12px">—</span>';
}
// Preview pictures live in their own small database (FC.pics). A picture already looked at is
// drawn straight away; otherwise the <img> gets data-th and ppLoadPics() fills it in a moment later.
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
const lazyPic = (rec, fallback) => `${BLANK}" data-th="${esc(rec.id)}${fallback ? `" data-fb="${fallback}` : ''}`;   // goes inside src="…"; fallback is already made safe
const theirImg = c => c.thumb ? safeImg(c.thumb) : c.th ? (FC.pics.seen(c.id) || lazyPic(c, safeImg(c.img))) : safeImg(c.img);
async function ppLoadPics(root = document) {
  const imgs = [...root.querySelectorAll('img[data-th]')];
  if (!imgs.length) return;
  const got = await FC.pics.getMany(imgs.map(i => i.dataset.th)).catch(() => []);
  imgs.forEach((img, i) => { const src = got[i] || img.dataset.fb; if (src) img.src = src; img.removeAttribute('data-th'); });
}
// Your client's photo: the small copy kept with the finds, swapped for the real file from Drive.
const OURS = new Map();
const oursImg = p => (p && OURS.get(p.id)) || (p && p.thumb && safeImg(p.thumb)) || (p && p.th && (FC.pics.seen(p.id) || lazyPic(p, 'icons/icon48.png'))) || 'icons/icon48.png';
async function loadOurs(root = document) {
  for (const img of root.querySelectorAll('img[data-our]')) {
    const id = img.dataset.our;
    if (OURS.has(id)) { img.src = OURS.get(id); continue; }
    const p = FCD && FCD.photos.get(id) || await FC.DB.get('photos', id);
    if (!p || !p.rel) continue;
    try {
      const f = await FC.fileFor(p);
      const b = await createImageBitmap(f);
      const s = Math.min(1, 900 / Math.max(b.width, b.height));
      const c = new OffscreenCanvas(Math.round(b.width * s), Math.round(b.height * s));
      c.getContext('2d').drawImage(b, 0, 0, c.width, c.height); b.close && b.close();
      const url = URL.createObjectURL(await c.convertToBlob({ type: 'image/jpeg', quality: 0.85 }));
      OURS.set(id, url);
      for (const i2 of document.querySelectorAll(`img[data-our="${CSS.escape(id)}"]`)) i2.src = url;
    } catch (e) { /* Drive not reachable: the small copy stays */ }
  }
}

// ---------------------------------------------------------------- the filters
function passMain(c) {
  return (state.fClient === 'Any' || (c.clientName || 'Client unknown') === state.fClient) && (state.fUse === 'Any' || c.use === state.fUse) &&
    (state.fRisk === 'Any' || c.risk.level === state.fRisk) && (state.fCredit === 'Any' || (c.credit || '') === state.fCredit) && (!state.fShop || c.use === 'shop') && (!state.fRepeat || (c.repeat > 0 && c.status === 'new')) && (!state.fKnown || (state.fKnown === 'only' ? c.known : !c.known)) && (state.fSpam !== 'only' || !!c.spam) &&
    (!state.fOwner || (FCD.ownerOf.get(c.site) || {}).key === state.fOwner) && (state.fPlat === 'Any' || platOf(c).key === state.fPlat) &&
    (!state.fAcct || (state.fAcct === '~' ? !c.acct : !!c.acct && acctGroup(c.acct.key) === acctGroup(state.fAcct))) && (!state.fFresh || (c.dmg && c.dmg.end && Date.now() <= c.dmg.end.getTime())) && (!isSoc(c) || passAcct(c)) && passMore(c);
}
// The newer filters: the search box, found when, how strong the match is, photo year and quarter.
function passMore(c) {
  if (state.fPhoto && c.photo !== state.fPhoto) return false;
  if (state.fq && !(c.site + ' ' + c.url + ' ' + (c.acct ? c.acct.handle + ' ' + acctName(c.acct) : '') + ' ' + c.photoName + ' ' + (c.clientName || '') + ' ' + (c.title || '')).toLowerCase().includes(state.fq)) return false;
  if (state.fWhen !== 'any') {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (WHEN[state.fWhen][1] - 1));
    if (!c.firstSeen || new Date(c.firstSeen) < d) return false;
  }
  if (state.fMatch !== 'any' && matchKind(c) !== state.fMatch) return false;
  if (state.fYear !== 'Any' || state.fQuarter !== 'Any') {
    const p = FCD.photos.get(c.photo) || {};
    if (state.fYear !== 'Any' && String(p.year || '') !== String(state.fYear)) return false;
    if (state.fQuarter !== 'Any' && String(p.quarter || '') !== String(state.fQuarter)) return false;
  }
  return true;
}
function passStatus(c, f = state.fFilter) {
  if (f === 'Removed') return c.status === 'removed';
  if (c.status === 'removed') return false;
  if (f === 'All') return true;
  return STATUS[c.status][0] === f;
}
// Sister sites: after you mark a copy stolen, other new copies of the same photo (or the same
// article, by its link ending) on other sites of the same owner.
const linkEnd = u => { try { const p = new URL(u).pathname.replace(/\/+$/, '').split('/').filter(Boolean); const e = p.slice(-2).join('/'); return e.length >= 14 ? e.toLowerCase() : ''; } catch (e) { return ''; } };
function sistersOf(c) {
  if (isSoc(c)) return null;
  const o = FCD.ownerOf.get(c.site);
  if (!o || !o.real || o.sites.length < 2) return null;
  const end = linkEnd(c.url);
  const xs = FCD.copies.filter(x => x.id !== c.id && x.status === 'new' && x.site !== c.site && o.sites.includes(x.site) && visible(x) && (x.photo === c.photo || (end && linkEnd(x.url) === end)));
  if (!xs.length) return null;
  return { owner: o.name, ids: xs.map(x => x.id), sites: [...new Set(xs.map(x => x.site))], same: xs.every(x => x.photo === c.photo) };
}
// 4.24 (Ben): website copies show only from the countries you chose (United States and Puerto
// Rico to start). Copies whose country isn't known (most .com sites) always show; social copies
// are about the account, so the country of the site doesn't hide them.
const countryOut = c => !!c.country && !isSoc(c) && !FCD.countries.includes(c.country);
// 4.24: new copies on spam blogs stay out of every list (and One at a time) until you show them.
const spamOut = c => !!c.spam && c.status === 'new' && state.fSpam === 'hide';
const visible = c => !siteHidden(c) && !countryOut(c) && !spamOut(c);

// ---------------------------------------------------------------- the copy details panel
function regBox(p, reg) {
  if (!p || !p.rel) return '<div class="regbox none"><span class="muted" style="font-size:13px">This photo was searched from your computer, not from Google Drive, so there are no Drive folders to look in.</span></div>';
  if (!reg) return `<div class="regbox none"><b>No registration number found</b><span class="muted" style="font-size:13px">PageProof looked in the folder names and for an Excel file named like 1-… or VA… in this folder and the folders above it.</span>
    <div class="ask-row"><input id="regIn" class="chip" style="min-height:34px;padding:0 10px;font-size:14px;flex:1 1 180px" placeholder="VA 1-234-567 or 1-12345678901" aria-label="Registration or application number"><button class="btn sm" data-act="addreg" data-v="${esc(p.folder)}">Add the number</button></div>
    <span class="faint" style="font-size:12.5px">Typed once, it sticks for the whole folder.</span></div>`;
  return `<div class="regbox">${reg.va ? `<div class="row" style="gap:8px"><span class="tag ok" data-gloss="Registered">Registered</span><b class="mono" style="font-size:15px">${esc(reg.va)}</b><button class="btn ghost cpy" data-act="copytext" data-v="${esc(reg.va)}">Copy</button></div>` : ''}
    ${reg.app ? `<div class="row" style="gap:8px"><span class="tag ${reg.va ? 'grey' : 'warn'}" data-gloss="Application">${reg.va ? 'Application' : 'Applied, not registered yet'}</span><b class="mono" style="font-size:${reg.va ? 13.5 : 15}px">${esc(reg.app)}</b><button class="btn ghost cpy" data-act="copytext" data-v="${esc(reg.app)}">Copy</button></div>` : ''}
    <span class="faint" style="font-size:12.5px">Found in: ${esc(reg.from || '')}</span></div>`;
}
function pathBox(path) {
  if (!path) return '';
  const parts = path.split('\\').filter(Boolean);
  return `<div class="dpath"><div class="mono">${parts.map((x, i) => i === parts.length - 1 ? `<b>${esc(x)}</b>` : `<span>${esc(x)}</span>`).join('<i>›</i>')}</div>
    <div class="row" style="gap:6px"><button class="btn sm" data-act="copytext" data-v="${esc(path)}">Copy path</button><span class="faint" style="font-size:12.5px">Paste it into File Explorer's address bar to open the folder.</span></div></div>`;
}
function hideChoices(c) {
  if (isSoc(c)) return socHideChoices(c);
  const out = [];
  const part = RS_SITE.part(c.url);
  if (part) out.push([part, 'Only this account', 'Other accounts and pages on ' + c.site + ' still show']);
  const base = FC.baseOf(c.site);
  if (base !== c.site) out.push([c.site, 'Only ' + c.site, 'Other parts of ' + base + ' still show']);
  out.push([base, 'All of ' + base, part ? 'Every account and page on it' : 'Every page and sub-site']);
  return out;
}
// ---------------------------------------------------------------- firm checks (checks.js)
const PF_BUSY = new Set();       // copies whose page is being read right now
async function siteKinds() { return (await FC.meta.get('siteKinds')) || {}; }
// The kind of site is saved once per site (all of example.com), so it is only asked once.
async function setKind(site, k) {
  const m = await siteKinds(), b = FC.baseOf(site), was = m[b] || '';
  if (k) m[b] = k; else delete m[b];
  await FC.meta.set('siteKinds', m);
  return was;
}
async function readTheirPage(c, again) {
  if (PF_BUSY.has(c.id) || (c.pf && !again)) return c.pf;
  PF_BUSY.add(c.id);
  try {
    const pf = await PP_CHECKS.readPage(c);
    const cc = await FC.DB.get('copies', c.id);
    if (cc) { cc.pf = pf; await FC.DB.put('copies', cc); }
    c.pf = pf; FCD_STALE = true;      // 4.9: never cleared outright (it is also read in the background now)
    return pf;
  } finally { PF_BUSY.delete(c.id); }
}
// 4.30: is the photo really in the post? Google Lens can show your client's photo next to a
// Facebook or Instagram link even when the post shows something else (a video, another picture):
// it matched a picture elsewhere on that page. Only the post's own pictures count (Ben).
// 4.35: first the post's main picture (or video cover) from its public page; if that isn't the
// photo, the post is opened in your signed-in browser (a quiet pinned tab) and EVERY picture of it
// is checked, so a photo that is the 3rd picture of an album is not missed. Comments, link
// previews and suggested posts are left out. Only when every picture is clearly different does
// the copy go to Removed by itself ("Not seen in the post"; Put back still works).
const POSTCHK_V = 2;
const POST_BUSY = new Set();
const POST_HELD = new Map();     // copy id -> when a check was held by Pause (not tried again for a minute)
// 4.32: a link to an account page has no "post's own picture" (its picture is the profile photo),
// so it is never checked or removed this way. The repost check finds the exact post instead.
const acctPageLink = c => typeof PP_REPOST !== 'undefined' && PP_REPOST.profileOnly(c);
const needsPostCheck = c => isSoc(c) && !(Date.now() - (POST_HELD.get(c.id) || 0) < 60000) && !acctPageLink(c)
  && (c.status !== 'removed' || (c.removedBy === 'postcheck' && slidesDue(c)))
  && (slidesDue(c) || (c.onPage !== 'seen' && !/^https?:/i.test(c.img || '') && (!c.postChk || c.postChk.v !== POSTCHK_V)));
async function bitmapOf(blob, max = 640) {
  const bm = await createImageBitmap(blob);
  const f = Math.min(1, max / Math.max(bm.width, bm.height));
  if (f >= 1) return bm;
  const small = await createImageBitmap(bm, { resizeWidth: Math.round(bm.width * f), resizeHeight: Math.round(bm.height * f), resizeQuality: 'high' });
  try { bm.close(); } catch (e) { /* freed */ }
  return small;
}
// One of their pictures against your client's photo: seen, notSeen, unsure (a burst shot from the
// same spot), or null when the picture can't be downloaded.
async function lineUpWith(ours, url) {
  let bm = null;
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
    const r = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    bm = await bitmapOf(await r.blob());
    const best = await PP_ALIGN.align(ours, bm, undefined, { fast: true });
    const pct = best ? Math.max(0, Math.min(100, Math.round(best.sc.lines * 100))) : 0;
    const inl = best ? best.inliers || 0 : 0;
    return { pct, state: inl >= 12 && pct >= 60 ? 'seen' : inl < 10 || pct < 40 ? 'notSeen' : 'unsure' };
  } catch (e) { return null; } finally { if (bm) try { bm.close(); } catch (e) { /* freed */ } }
}
// Runs inside the post's tab: the post's own pictures (and video covers). Comments (posts inside
// the post), link previews, the account picture and side boxes are left out. Multi-picture posts
// are stepped through with their Next button.
async function readPostPicsInTab() {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  // The post itself: the outermost article that links to this post's own address (on X, the
  // tweets above a reply and the replies below are articles too; on Instagram and Facebook the
  // "More posts from…" grid and suggested posts sit outside it).
  const idOf = h => { try { const u = new URL(h, location.href); const m = u.pathname.match(/\/(?:p|reel|reels|tv|status|posts|videos|permalink|photo)\/([^/?#]+)/i) || u.pathname.match(/\/(\d{6,})\/?$/); return m ? m[1] : (u.searchParams.get('story_fbid') || u.searchParams.get('fbid') || ''); } catch (e) { return ''; } };
  const me = idOf(location.href);
  const roots = [...document.querySelectorAll('[role="dialog"] [role="article"], [role="main"] [role="article"], article')].filter(r => !r.parentElement || !r.parentElement.closest('[role="article"], article'));
  const root = (me && roots.find(r => [...r.querySelectorAll('a[href]')].some(a => idOf(a.href) === me))) || roots[0] || document.querySelector('[role="main"], main') || document.body;
  const out = [];
  const grab = () => {
    for (const el of root.querySelectorAll('img, video')) {
      const inner = el.closest('[role="article"], article');
      if (inner && inner !== root && root.contains(inner)) continue;                      // a comment or a reply
      // A picture that links to ANOTHER post ("More posts from…", suggested and related posts).
      const lk = el.closest('a[href]'); const other = lk && idOf(lk.href);
      if (other && me && other !== me && !/\/photo/i.test(lk.href)) continue;
      if (el.closest('a[href*="l.facebook.com"], a[href*="l.instagram.com"], a[href*="lm.facebook.com"], [role="complementary"], header, [role="banner"]')) continue;
      // 4.35: link preview cards (a shared article's picture) on X, LinkedIn and Facebook.
      if (el.closest('[data-testid="card.wrapper"], [data-testid="card.layoutLarge.media"], .feed-shared-article, .update-components-article, [class*="article-card" i], a[href*="lnkd.in"], a[href*="/redir/redirect"], a[href*="t.co/"]')) continue;
      if (/articleshare-|\/card_img\/|safe_image\.php|\/emg1\//.test(el.currentSrc || el.src || '')) continue;
      const u = el.tagName === 'VIDEO' ? el.poster : (el.currentSrc || el.src);
      const w = el.naturalWidth || el.videoWidth || el.width || 0, h = el.naturalHeight || el.videoHeight || el.height || 0;
      if (!/^https?:/.test(u || '') || (el.tagName !== 'VIDEO' && (w < 200 || h < 150)) || out.includes(u)) continue;
      out.push(u);
    }
  };
  grab();
  for (let i = 0; i < 12; i++) {
    const next = root.querySelector('button[aria-label="Next" i], [aria-label="Next photo" i], [aria-label="Next image" i]');
    if (!next || out.length >= 15) break;
    next.click(); await wait(600); grab();
  }
  return out.slice(0, 15);
}
async function postInBrowser(c, ours) {
  if (!globalThis.PP_SOCIAL || !PP_SOCIAL.openQuiet || !api.scripting) return null;
  // Quiet tabs follow Keep searching (4.30.2): none while it is paused, off or outside its hours.
  try { if (!(await FC.quietOK()).ok) return { held: true }; } catch (e) { /* no check: carry on */ }
  PP_SOCIAL.halt.on = false;
  let tab;
  try {
    tab = await PP_SOCIAL.openQuiet(c.url);
    if (PP_SOCIAL.halt.on) return { held: true };
    await new Promise(r => setTimeout(r, 3000));      // the sites draw the post after loading
    const [res] = await api.scripting.executeScript({ target: { tabId: tab.id }, func: readPostPicsInTab });
    const urls = (res && res.result) || [];
    if (!urls.length) return null;                     // signed out, or the post is gone
    let n = 0, unsure = false;
    if (PP_SOCIAL.halt.on) return { held: true };       // paused while the post was open
    for (const u of urls) {
      const m = await lineUpWith(ours, u);
      if (!m) continue;
      n++;
      if (m.state === 'seen') return { state: 'seen', pct: m.pct, pic: u, n };
      if (m.state === 'unsure') unsure = true;
    }
    return n ? { state: unsure ? 'unsure' : 'notSeen', n } : null;
  } catch (e) { return null; } finally { if (tab) PP_SOCIAL.closeQuiet(tab); }
}
async function postCheck(c, opts = {}) {
  if (POST_BUSY.has(c.id) || typeof PP_ALIGN === 'undefined') return null;
  POST_BUSY.add(c.id);
  let ours = null;
  try {
    const pf = c.pf && c.pf.ok && 'pic' in c.pf ? c.pf : await readTheirPage(c, true).catch(() => null);
    const res = { v: POSTCHK_V, at: new Date().toISOString(), pic: '', state: 'unknown' };
    res.video = !!pf && (/^video/i.test(pf.type || '') || /\/(reel|videos?|watch)\b/i.test(pf.url || c.url || ''));
    try { ours = await bitmapOf(await ourBlob(FCD && FCD.photos.get(c.photo))); } catch (e) { res.err = String(e && e.message || e).slice(0, 120); }
    if (ours && pf && pf.ok && pf.pic) {
      res.pic = pf.pic;
      const m = await lineUpWith(ours, pf.pic);
      if (m) { res.pct = m.pct; res.state = m.state; }
      // 4.35 (Ben): the main picture is a link preview of another site's article: not a copy.
      if (res.state === 'seen' && (PP_SOCIAL.cardPic(pf.pic) || (pf.card && pf.card.pic === pf.pic))) { res.state = 'card'; res.cardSite = (pf.card && pf.card.site) || ''; }
    }
    // Not the main picture (or no picture readable): look at every picture of the post.
    // (TikTok photo posts are read slide by slide by slidesInto below instead.)
    const tiktokSlides = typeof PP_TIKTOK !== 'undefined' && PP_TIKTOK.isPhotoPost(c.url);
    if (ours && res.state !== 'seen' && res.state !== 'card' && opts.browser !== false && !tiktokSlides) {
      const b = await postInBrowser(c, ours);
      // Paused, off or outside the hours: nothing is saved, so the post is checked after Resume.
      if (b && b.held) { POST_HELD.set(c.id, Date.now()); return null; }
      if (b) {
        res.browser = b.state; res.n = b.n;
        if (b.state === 'seen') { res.state = 'seen'; res.pct = b.pct; res.pic = b.pic; }
        else if (b.state === 'notSeen' && res.state !== 'unsure') res.state = 'notSeen';
        else res.state = 'unsure';
      }
    }
    await slidesInto(c, res);         // TikTok slideshows: every slide, and which one it is
    const cc = await FC.DB.get('copies', c.id);
    if (cc) { cc.postChk = res; await FC.DB.put('copies', cc); }
    c.postChk = res; FCD_STALE = true;
    // Ben (4.30): only the post's own pictures count, never a picture in its comments or links.
    // Removed by itself only when every picture of the post was looked at and none is the photo.
    if (res.state === 'card' && c.status === 'new' && !c.cardV && !/by hand/.test(c.by || '')) await cardRemove(c);
    else if (res.state === 'notSeen' && res.browser === 'notSeen' && notInPost(c) && c.status === 'new' && !/by hand/.test(c.by || '')) {
      await FC.answer([c.id], 'removed', { removedBy: 'postcheck' });
      c.status = 'removed'; c.removedBy = 'postcheck';
    }
    return res;
  } finally {
    if (ours) try { ours.close(); } catch (e) { /* freed */ }
    POST_BUSY.delete(c.id);
  }
}
// 4.35 (Ben): only a link preview card of another site's article (LinkedIn, X, Facebook shares).
const cardSiteOf = c => (c.postChk && c.postChk.cardSite) || (c.pf && c.pf.card && c.pf.card.site) || '';
const linkCardOf = c => isSoc(c) && (PP_SOCIAL.cardPic(c.img) || (c.postChk && c.postChk.state === 'card') || (c.pf && c.pf.card && c.pf.card.only && c.pf.card.pic && c.pf.card.pic === c.img) ? (PP_SOCIAL.cardPic(c.img) || PP_SOCIAL.cardPic(c.postChk && c.postChk.pic) || 'link preview') : '');
const LINK_CARD = c => `The photo is only in a link preview: the post shares ${cardSiteOf(c) ? 'an article from ' + cardSiteOf(c) : 'another site\'s article'}, and ${platOf(c).name} shows that article's picture in a card. The account didn't post the photo itself.${c.removedBy === 'linkcard' ? ' So PageProof moved it to Removed. Put it back if the photo is also posted in the post.' : ''}`;
async function cardRemove(c) {
  const cc = await FC.DB.get('copies', c.id);
  if (cc) { cc.cardV = 1; await FC.DB.put('copies', cc); }
  c.cardV = 1;
  await FC.answer([c.id], 'removed', { removedBy: 'linkcard' });
  c.status = 'removed'; c.removedBy = 'linkcard'; FCD_STALE = true;
}
// New social copies whose picture is a link preview card go to Removed by themselves, once each
// (cardV), so a copy you Put back stays put back.
async function cardSweep() {
  if (!FCD) return 0;
  const xs = FCD.copies.filter(c => c.status === 'new' && !c.cardV && !/by hand/.test(c.by || '') && linkCardOf(c));
  for (const c of xs) await cardRemove(c).catch(() => {});
  return xs.length;
}
const notInPost = c => isSoc(c) && !acctPageLink(c) && c.postChk && c.postChk.state === 'notSeen' && !/^https?:/i.test(c.img || '');
const NOT_IN_POST = c => `${c.postChk.browser === 'notSeen' ? `None of the post's ${c.postChk.n > 1 ? c.postChk.n + ' pictures' : 'pictures'} is your client's photo` : `The post's own ${c.postChk.video ? 'video cover' : 'picture'} is a different photo`}. Google matched a picture somewhere else on that page (a comment, a link preview, a suggested post), and only the post's own pictures count.${c.removedBy === 'postcheck' ? ' So PageProof moved it to Removed. Put it back if you see the photo in the post.' : ' Open the post and look before marking Stolen.'}`;
const ruleRow = h => `<div class="rrow ${h.lvl}"><span class="tag ${PP_CHECKS.LVL[h.lvl][1]}">${PP_CHECKS.LVL[h.lvl][0]}</span><span>${esc(h.text)}</span></div>`;
function kindSelect(c, kind, id) {
  const guess = kind ? '' : PP_CHECKS.guessKind(c, c.pf, FCD && FCD.facts.get(c.site));
  return `<select ${id ? `id="${id}"` : 'data-act="setkind"'} class="kindsel" aria-label="Kind of site">
    <option value="">${kind ? 'Not picked' : 'Pick one…'}</option>${PP_CHECKS.KINDS.map(([k, n]) => `<option value="${k}"${k === (kind || (id ? guess : '')) ? ' selected' : ''}>${esc(n)}${!kind && k === guess ? ' (best guess)' : ''}</option>`).join('')}</select>`;
}
// The firm checks, cut into the parts the panel's tabs show (4.7).
function checksParts(c, reg, kind, hits, pub, capturedAt) {
  const pf = c.pf, busy = PF_BUSY.has(c.id) || !pf;
  const purpose = PP_CHECKS.onPurpose(pf);
  const dmg = pub ? PP_CHECKS.damages(pub, reg) : null;
  const tagFor2 = { ok: 'ok', warn: 'warn', bad: 'bad', '': 'grey' };
  const legal = c.status === 'stolen' ? PP_CHECKS.legal({ c, reg, pub, kind, hits, pf, capturedAt }) : null;
  const ready = legal ? legal.filter(x => x[0] === true).length : 0;
  const fix = { capture: 'Capture', kind: 'Pick', readpage: 'Read it' };
  return {
    purpose, dmg, legal, ready,
    rules: `<section class="dsec" id="rulesbox"><div class="dsh">Firm rules</div>
    <div class="row" style="gap:8px;font-size:13.5px"><span>Kind of site</span>${kindSelect(c, kind)}${kind ? '' : '<span class="faint" style="font-size:12.5px">asked once per site</span>'}</div>
    ${hits.length ? hits.map(ruleRow).join('') : `<span class="faint" style="font-size:13px">${kind ? 'No firm rule stops this copy.' : 'Pick the kind of site to see the firm\'s rules for it.'}</span>`}
  </section>`,
    page: `<section class="dsec"><div class="dsh">What their page says</div>
    ${busy ? '<span class="muted" style="font-size:13.5px">Reading their page (without your cookies)…</span>'
      : !pf.ok ? `<div class="row" style="gap:8px;font-size:13.5px"><span class="muted">Could not read their page: ${esc(pf.why || '')}</span><button class="btn ghost sm" data-act="readpage">Try again</button></div>`
      : `<dl class="facts" style="margin:0">
        <dt>Credit line</dt><dd>${pf.credit ? `<q>${esc(pf.credit)}</q>${pf.agency ? ` <span class="tag blue">${esc(pf.agency)}</span>` : ''}` : `<span class="muted">${pf.imgFound ? 'No credit line next to the photo' : 'The photo was not found in their page\'s code, so no credit line was read'}</span>`}</dd>
        <dt>On purpose?</dt><dd>${purpose.length ? purpose.map(t => `<div>${esc(t)}</div>`).join('') : '<span class="muted">No selling or ads found</span>'}</dd>
        ${pf.yt || pf.embedPost ? `<dt>Embeds</dt><dd>${[pf.yt ? 'YouTube video' : '', pf.embedPost ? 'Social media post' : ''].filter(Boolean).join(', ')} on the page${pf.imgFound ? ' (the photo itself is on the page too)' : ''}</dd>` : ''}
      </dl><span class="faint" style="font-size:12px">Read ${shortDate(pf.at).toLowerCase()} · <a href="#" data-act="readpage">Read again</a></span>`}
  </section>`,
    // No publish date (an odd file name): no damages section at all (Ben, 2026-11-23).
    damages: dmg ? `<section class="dsec"><div class="dsh">Dates and damages</div>
    <dl class="facts" style="margin:0">
      <dt>Published</dt><dd><b>${PP_CHECKS.fmt(pub.date)}</b><br><span class="muted" style="font-size:12.5px">From ${esc(pub.from)}</span></dd>
      <dt>3 months</dt><dd>${PP_CHECKS.fmt(dmg.end)}</dd>
    </dl>
    <div class="regbox ${dmg.lvl === 'ok' ? '' : 'none'}" style="${dmg.lvl === 'bad' ? 'border-left-color:var(--bad);background:var(--bad-soft)' : ''}"><span><span class="tag ${tagFor2[dmg.lvl]}">${esc(dmg.title)}</span></span><span class="muted" style="font-size:13px">${esc(dmg.text)}</span></div>
  </section>` : '',
    legalBox: legal ? `<section class="dsec" id="legalbox"><div class="dsh">Ready for legal? <span class="tag ${ready === legal.length ? 'ok' : 'warn'}" style="margin-left:6px;letter-spacing:0;text-transform:none">${ready} of ${legal.length} ready</span></div>
    ${legal.map(([ok, label, act]) => `<div class="lrow ${ok === true ? 'y' : ok === false ? 'n' : 'q'}"><span class="lbox" aria-hidden="true">${ok === true ? '✓' : ok === false ? '!' : '?'}</span><span style="flex:1;min-width:0">${esc(label)}</span>${act ? `<button class="btn ghost sm" data-act="legalfix" data-v="${act}">${fix[act]}</button>` : ''}</div>`).join('')}
    <span class="faint" style="font-size:12.5px">The Evidence report can still be made at any time.</span></section>` : '',
  };
}
// What the list's Damages column says: the same answer as the panel, short.
function dmgCell(c) {
  const d = c.dmg;
  if (!d) return '';
  const end = d.end ? d.end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
  if (d.lvl === 'ok') return `<span class="tag ok" title="${esc(d.text)}">Statutory</span>`;
  if (d.lvl === 'warn') return `<span class="tag warn" title="${esc(d.text)}">Register by ${esc(end)}</span>`;
  if (d.lvl === 'bad') return `<span class="tag bad" title="${esc(d.text)}">Actual only</span>`;
  return '';
}
// Small warning icons for a row (4.7): the words show when you hover.
function signals(c) {
  const s = [];
  if (linkCardOf(c)) s.push(['bad', 'warn', 'Only in a link preview: ' + LINK_CARD(c)]);
  else if (notInPost(c)) s.push(['bad', 'warn', 'Not seen in the post: ' + NOT_IN_POST(c)]);
  if (c.match === 'maybe') s.push(['warn', 'maybe', 'Maybe the same photo. Look closely.']);
  if (c.risk.level === 'sus') s.push(['bad', 'warn', 'Suspicious site' + (c.risk.why.length ? ': ' + c.risk.why.join(', ') : '')]);
  else if (c.risk.level === 'watch') s.push(['warn', 'warn', 'Worth a look' + (c.risk.why.length ? ': ' + c.risk.why.join(', ') : '')]);
  if (c.credit === 'removed') s.push(['copy', 'nocredit', 'Credit removed: your client\'s photo has a copyright line in its hidden data and their copy does not']);
  if (c.repeat && c.status === 'new' && !isSoc(c)) s.push(['bad', 'repeat', `Repeat offender: you already marked ${c.repeat} ${c.repeat === 1 ? 'copy' : 'copies'} on ${c.repeatWho} as Stolen`]);
  if (c.use === 'shop') s.push(['ok', 'shop', 'Selling something: a shop page, product listing or ad']);
  return s;
}
const knownTag = c => c.known ? '<span class="tag bad" style="font-size:11.5px" title="This exact page is on your list of links stolen before (Settings › Hidden and approved sites › Stolen before links)">Stolen before</span>' : '';
const spamTag = c => c.spam ? `<span class="tag grey" style="font-size:11.5px" title="${esc('Looks like a spam blog: ' + c.spam.join(', '))}">Spam blog</span>` : '';
const sigIcons = c => { const s = signals(c); return knownTag(c) + spamTag(c) + (s.length ? `<span class="sig">${s.map(([col, i, t]) => `<span class="tag ${col}" title="${esc(t)}" aria-label="${esc(t)}">${ic(i, 13)}</span>`).join('')}</span>` : ''); };
// Before a copy is marked Stolen: the kind of site (once per site) and the rules that apply.
// Resolves 'stolen', 'removed' (Remove instead) or null (cancelled).
async function ruleGate(c) {
  const kinds = await siteKinds();
  // Only ask when a Stop rule applies (for the kind you saved, or else PageProof's guess). Warn rules stay
  // in the details panel, so everyday copies and embeds go straight through.
  const saved = kinds[FC.baseOf(c.site)] || PP_CHECKS.guessKind(c, c.pf) || '';
  if (!PP_CHECKS.rules(c, saved, c.pf).some(h => h.lvl === 'stop')) return 'stolen';
  if (!c.pf && !PF_BUSY.has(c.id)) readTheirPage(c).then(() => { if (state.open === c.id) render(true); }).catch(() => {});
  return new Promise(resolve => {
    const d = document.createElement('dialog');
    d.className = 'pp-ask rulegate';
    d.innerHTML = `<form method="dialog" style="display:flex;flex-direction:column;gap:12px;width:min(480px,86vw)">
      <b style="font-size:18px">Before you mark it Stolen</b>
      <span class="muted" style="font-size:13.5px;overflow-wrap:anywhere">${esc(c.site)}</span>
      <label style="display:flex;flex-direction:column;gap:6px;font-size:14px;font-weight:600">What kind of site is this? ${kindSelect(c, saved, 'gateKind')}<span class="faint" style="font-weight:400;font-size:12.5px">Saved for every copy on ${esc(FC.baseOf(c.site))}.</span></label>
      <div id="gateRules" style="display:flex;flex-direction:column;gap:6px"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap"><button value="cancel" type="submit" class="btn">Cancel</button><button value="removed" type="submit" class="btn" id="gateRemove">Remove instead</button><button value="stolen" type="submit" class="btn stolen" id="gateStolen">Mark Stolen</button></div></form>`;
    d.style.cssText = 'border:1px solid var(--line);border-radius:16px;padding:22px;background:var(--surface);color:var(--ink);box-shadow:0 20px 60px rgba(0,0,0,.35)';
    document.body.appendChild(d);
    const sel = d.querySelector('#gateKind');
    const draw = () => {
      const hs = PP_CHECKS.rules(c, sel.value, c.pf);
      const stop = hs.some(h => h.lvl === 'stop');
      d.querySelector('#gateRules').innerHTML = hs.length ? hs.map(ruleRow).join('') : '<span class="faint" style="font-size:13px">No firm rule stops this copy.</span>';
      d.querySelector('#gateRemove').hidden = !stop;
      d.querySelector('#gateStolen').textContent = stop ? 'Mark Stolen anyway' : 'Mark Stolen';
      d.querySelector('#gateStolen').className = stop ? 'btn' : 'btn stolen';
      d.querySelector('#gateRemove').className = stop ? 'btn primary' : 'btn';
    };
    sel.addEventListener('change', draw); draw();
    d.addEventListener('keydown', e => e.stopPropagation());
    d.addEventListener('close', async () => {
      const v = d.returnValue, k = sel.value;
      d.remove();
      if (v === 'stolen' || v === 'removed') { if (k && k !== kinds[FC.baseOf(c.site)]) await setKind(c.site, k); resolve(v); } else resolve(null);
    });
    d.showModal(); sel.focus();
  });
}
// The copy details panel (4.7, calmer): pictures first, a short "Look at these" list of only the
// things that need you, the rest in four small tabs, and the answer buttons pinned at the bottom.
const DTABS = [['sum', 'Summary'], ['page', 'Their page'], ['claim', 'Claim'], ['site', 'Site']];
async function drawer(list) {
  if (!state.open) return '';
  const c = FCD.copies.find(x => x.id === state.open);
  if (!c) return '';
  if (state.dTabFor !== c.id) { state.dTabFor = c.id; state.dTab = 'sum'; state.acctEdit = ''; }
  const soc = isSoc(c);
  if (!soc && state.dTab === 'acct') state.dTab = 'sum';
  if (soc && state.dTab === 'site') state.dTab = 'acct';
  const p = FCD.photos.get(c.photo);
  const [reg, path, doubles] = [p ? await FC.regFor(p) : null, p ? await FC.pathOf(p) : '', p ? await FC.doublesOf(p) : []];
  const o = FCD.ownerOf.get(c.site);
  const f = FCD.facts.get(c.site);
  const clients = [...FCD.clients.keys()].sort();
  const [kinds, logR] = await Promise.all([siteKinds(), api.storage.local.get('log').catch(() => ({}))]);
  const kind = kinds[FC.baseOf(c.site)] || '';
  const pub = PP_CHECKS.pubDate(p);
  const hits = PP_CHECKS.rules(c, kind, c.pf);
  const capturedAt = [c.url, ...(c.alts || [])].map(u => PP_CHECKS.captureOf(logR.log, u)).find(Boolean) || c.packAt || null;
  if (typeof acctOnOpen === 'function' && isSoc(c) && c.acct) acctOnOpen(c).then(r => { if (r && state.open === c.id) { FCD_STALE = true; render(true); } }).catch(() => {});
  if (needsPostCheck(c) && !POST_BUSY.has(c.id)) postCheck(c).then(() => { if (state.open === c.id) render(true); }).catch(() => {});
  else if (!c.pf && !PF_BUSY.has(c.id)) readTheirPage(c).then(() => { if (state.open === c.id) render(true); }).catch(() => {});
  const ck = checksParts(c, reg, kind, hits, pub, capturedAt);
  const sz = c.w && p && p.w ? (Math.abs(c.w / c.h - p.w / p.h) / (p.w / p.h) > 0.06 ? 'cropped' : (c.w * c.h) / (p.w * p.h) > 1.15 ? 'bigger than your client\'s' : (c.w * c.h) / (p.w * p.h) < 0.85 ? 'smaller' : 'same size') : '';
  const idx = list.indexOf(c.id);
  const last = HIST[HIST.length - 1];
  // "Look at these": only problems, each with where to go next. The rest folds into one green line.
  const look = [], fine = [];
  if (linkCardOf(c)) look.push(['bad', 'warn', 'Only in a link preview', LINK_CARD(c), 'openpost', 'Open post']);
  else if (notInPost(c)) look.push(['bad', 'warn', 'Not seen in the post', NOT_IN_POST(c), 'openpost', 'Open post']);
  if (c.match === 'maybe') look.push(['warn', 'maybe', 'Maybe the same photo', 'The checker is not sure. Compare them closely.', 'compare', 'Compare']);
  if (c.risk.level === 'sus') look.push(['bad', 'warn', 'Suspicious site', c.risk.why.join(' · '), 'dtab', 'Site', 'site']);
  else if (c.risk.level === 'watch') look.push(['warn', 'warn', 'Worth a look', c.risk.why.join(' · '), 'dtab', 'Site', 'site']);
  else if (!soc) fine.push('Site looks normal');
  if (c.credit === 'removed') look.push(['copy', 'nocredit', 'Credit removed', 'Your client\'s photo carries a copyright line in its hidden data. Their copy has none.']);
  else if (c.credit === 'kept') fine.push('Credit kept');
  if (soc && c.rp && c.rp.state === 'repost') look.push(['warn', 'repeat', `${rpWord(c)} of ${origName(c)}'s post`, 'This account only passed someone else\'s post along. The original poster is the lead. See The post tab.', 'dtab', 'The post', 'page']);
  else if (soc && PP_REPOST.profileOnly(c) && !(c.rp && c.rp.post)) look.push(['warn', 'warn', 'Link goes to the account page, not the post', RP_BUSY.has(c.id) ? 'Finding the post now…' : 'PageProof looks for the exact post in your browser. See The post tab.', 'dtab', 'The post', 'page']);
  if (soc && !c.acct) look.push(['warn', 'who', 'Account not found yet', 'The link doesn\'t show who posted it. Set it in the Account tab.', 'dtab', 'Account', 'acct']);
  if (c.spam) look.push(['warn', 'warn', 'Looks like a spam blog', c.spam.join(' · ') + '. Nothing was answered for you.', 'spamhide', 'Hide all of ' + esc(FC.baseOf(c.site)), esc(FC.baseOf(c.site))]);
  if (c.known) look.push(['bad', 'repeat', 'On your stolen-before list', 'This exact page is on your list of links stolen before.']);
  if (soc && c.repeat && c.status === 'new') look.push(['bad', 'repeat', `Known account: marked stolen ${c.repeat === 1 ? 'once' : c.repeat + ' times'} before`, `You marked ${c.acct.handle}'s posts stolen before${c.repeatAt && c.repeatAt.length ? ' (' + c.repeatAt.slice(-3).map(shortDate).join(', ') + ')' : ''}.`, 'dtab', 'Account', 'acct']);
  else if (c.repeat && c.status === 'new') look.push(['bad', 'repeat', `Repeat offender (${c.repeat} stolen before)`, `${c.knownN ? `${c.repeatWho} has ${c.knownN === 1 ? 'a link' : c.knownN + ' links'} on your stolen-before list.` : `You already marked copies on ${c.repeatWho} as Stolen.`}`]);
  for (const h of hits.filter(h => h.lvl === 'stop' || h.lvl === 'warn')) look.push([h.lvl === 'stop' ? 'bad' : 'warn', 'warn', 'Firm rule: ' + PP_CHECKS.LVL[h.lvl][0], h.text, 'dtab', 'Claim', 'claim']);
  if (ck.dmg && ck.dmg.lvl === 'warn') look.push(['warn', 'clock', ck.dmg.title, ck.dmg.text, 'dtab', 'Claim', 'claim']);
  else if (ck.dmg && ck.dmg.lvl === 'bad') look.push(['bad', 'clock', ck.dmg.title, ck.dmg.text, 'dtab', 'Claim', 'claim']);
  else if (ck.dmg && ck.dmg.lvl === 'ok') fine.push('Statutory damages');
  if (!c.clientName) look.push(['warn', 'who', 'Client unknown', 'Set the client in the Summary tab.', 'dtab', 'Summary', 'sum']);
  if (ck.legal && ck.ready < ck.legal.length) look.push(['warn', 'doc', `Ready for legal: ${ck.ready} of ${ck.legal.length}`, ck.legal.filter(x => x[0] !== true).map(x => x[1]).join(' · '), 'dtab', 'Claim', 'claim']);
  const lookN = look.filter(x => x[0] !== 'grey').length;
  const dot = { page: c.credit === 'removed', claim: hits.some(h => h.lvl !== 'info') || (ck.dmg && ck.dmg.lvl !== 'ok') || (ck.legal && ck.ready < ck.legal.length), site: c.risk.level !== 'ok' || (c.repeat && c.status === 'new'), acct: !c.acct || (c.repeat && c.status === 'new') };
  const tabs = soc ? [['sum', 'Summary'], ['page', 'The post'], ['acct', 'Account'], ['claim', 'Claim']] : DTABS;
  const tab = state.dTab, show = k => tab === k ? '' : ' hidden';
  const view = state.dView || 'side';
  // 4.9: social sites nearly all refuse to show inside PageProof, so "The post" shows instead
  // of the live page (unless you press "Try the live preview anyway").
  const livePage = !soc || state.forcePage === c.id;
  const ourSrc = oursImg(p), theirSrc = theirImg(c);
  const viewer = view === 'page' ? (livePage ? pageBoxHtml(c) : postCard(c))
    : view === 'slide' ? `<div class="dslide" style="--cut:${state.slide}%"><img data-our="${esc(c.photo)}" src="${ourSrc}" alt="Your client's photo"><img class="top" src="${theirSrc}" alt="Their copy" referrerpolicy="no-referrer"><span class="lab l">Your client's</span><span class="lab r">Theirs</span><i class="handle" aria-hidden="true"></i><input type="range" min="0" max="100" value="${state.slide}" data-act="dslide" aria-label="Slide between your client's photo and theirs"></div>`
    : `<div class="pair"><div class="frame ours"><img data-our="${esc(c.photo)}" src="${ourSrc}" alt="Your client's photo"><span class="lab">Your client's</span></div><div class="frame theirs"><img src="${theirSrc}" alt="Their copy" referrerpolicy="no-referrer"><span class="lab">Theirs</span></div></div>`;
  if (!FCD) await loadFC();        // something cleared it while the panel was being read
  return `<aside class="drawer calm" aria-label="Copy details" id="drawer">
  <div class="dhead"><button class="btn sm icon" data-act="dstep" data-v="-1" aria-label="Previous copy"${idx > 0 ? '' : ' disabled data-why="This is the first copy in the list."'}>‹</button><button class="btn sm icon" data-act="dstep" data-v="1" aria-label="Next copy"${idx >= 0 && idx < list.length - 1 ? '' : ' disabled data-why="This is the last copy in the list."'}>›</button><span class="muted num" style="font-size:13px">${idx >= 0 ? `${idx + 1} of ${list.length}` : ''}</span><span style="flex:1"></span>${tagFor(c)}<button class="btn sm icon" data-act="closedrawer" aria-label="Close">✕</button></div>
  <div class="dscroll" id="dscroll">
  <div class="dsite">${soc ? `<div class="row" style="gap:10px;flex-wrap:nowrap">${platBadge(c, 30)}<div style="min-width:0"><h2 style="overflow-wrap:anywhere">${c.acct ? acctHtml(c.acct) : '<span style="color:var(--warn)">Account not found yet</span>'}</h2><div class="muted" style="font-size:12.5px">${esc(postWord(c))}${c.acct ? ` · <a href="${safeUrl(c.acct.url)}" target="_blank" rel="noreferrer">Open account ${ic('ext', 12)}</a>` : ` · <a href="#" data-act="dtab" data-v="acct">Set account</a>`}</div></div></div>` : `<h2>${esc(c.site)}</h2>`}<a class="curl" href="${safeUrl(c.url)}" target="_blank" rel="noreferrer" data-act="openlink"><span>${esc(String(c.url || '').replace(/^https?:\/\/(www\.)?/, ''))}</span>${ic('ext', 13)}</a></div>
  <div class="dview">${viewer}</div>
  <div class="dvbar"><div class="seg sm" role="radiogroup" aria-label="Picture view">${[['side', 'Side by side'], ['slide', 'Slider'], ['page', soc ? 'The post' : 'Their page']].map(([k, l]) => `<button role="radio" aria-checked="${view === k}" class="${view === k ? 'on' : ''}" data-act="dview" data-v="${k}">${l}</button>`).join('')}</div><button class="btn ghost sm" data-act="compare">${ic('layers', 15)} Compare closely</button></div>
  <div class="dchips">${c.pct >= 0 && c.pct != null ? `<span class="fchip" data-gloss="Lines up"><b style="color:${c.pct >= 80 ? 'var(--bad)' : 'var(--warn)'}">${c.pct}%</b> lines up</span>` : ''}<span class="fchip">${esc(FC.USE[c.use][0])}</span>${c.country ? `<span class="fchip">${esc(c.country)}</span>` : ''}${c.w ? `<span class="fchip">${c.w} × ${c.h}${sz ? ' · ' + sz : ''}</span>` : ''}</div>
  <section class="attn" id="lookbox"><h3>${lookN ? `${ic('warn', 15)} Look at these (${lookN})` : `${ic('check', 15)} Nothing needs a look`}</h3>
    ${look.map(([col, i, t, s, act, b, v]) => `<div class="it"><span class="ico tag ${col}">${ic(i, 15)}</span><div><b>${esc(t)}</b>${s ? `<span>${esc(s)}</span>` : ''}</div>${act ? `<button class="btn sm" data-act="${act}"${v ? ` data-v="${v}"` : ''}>${b}</button>` : ''}</div>`).join('')}
    ${fine.length ? `<div class="okline">${ic('check', 14)} ${fine.map(esc).join(' · ')}</div>` : ''}</section>
  <div class="dtabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}" data-act="dtab" data-v="${k}">${l}${dot[k] ? '<span class="dot" title="Something to check here"></span>' : ''}</button>`).join('')}</div>
  <div class="dpane" data-tab="sum"${show('sum')}>
    <dl class="facts">
      <dt>Client</dt><dd>${c.clientName ? esc(c.clientName) : `<span style="color:var(--warn);font-weight:600">Client unknown</span> <select data-act="setclient" aria-label="Set the client" style="border:1px solid var(--line);border-radius:6px;background:var(--surface);font-size:13px;padding:2px 4px"><option value="">Set…</option>${clients.map(n => `<option>${esc(n)}</option>`).join('')}</select>`}</dd>
      <dt>Photo</dt><dd>${esc(c.photoName)}${p && p.w ? `<br><span class="muted" style="font-size:13px">${p.w} × ${p.h}</span>` : ''}</dd>
      ${picLinkRow(c)}
      <dt>How it's used</dt><dd>${esc(FC.USE[c.use][0])}<br><span class="muted" style="font-size:13px">${esc(FC.USE[c.use][1])}</span></dd>
      <dt>Seen</dt><dd>${shortDate(c.firstSeen)}${c.lastSeen && c.lastSeen !== c.firstSeen ? ' → ' + shortDate(c.lastSeen) : ''}, ${c.times > 1 ? c.times + ' times' : 'once'}${c.by ? `<br><span class="muted" style="font-size:13px">First found by ${esc(c.by)}${c.engines && c.engines.length ? ' on ' + c.engines.map(e => ({ google: 'Google Lens', yandex: 'Yandex', bing: 'Bing' }[e] || esc(e))).join(', ') : ''}</span>` : ''}</dd>
      <dt>Their picture</dt><dd>${/^https?:/i.test(c.img || '') ? `From their page: <a class="mono" style="font-size:12px;overflow-wrap:anywhere" href="${safeUrl(c.img)}" target="_blank" rel="noreferrer">${esc(c.img.replace(/^https?:\/\/(www\.)?/, '').slice(0, 90))}</a>` : `The search site's small preview <span class="muted" style="font-size:13px">(PageProof did not get the picture from their page itself)</span>${!isSoc(c) && c.onPage === 'unknown' ? '<br><span class="muted" style="font-size:13px">Their page could not be read, so this stays a Maybe until you look.</span>' : ''}`}${isSoc(c) ? `<br><span class="muted" style="font-size:13px">${POST_BUSY.has(c.id) || !c.postChk ? 'Checking the post\'s own picture…' : c.postChk.state === 'seen' ? `The post's own picture matches (${c.postChk.pct}% lines up).` : c.postChk.state === 'notSeen' ? `<b style="color:var(--bad)">${c.postChk.browser === 'notSeen' ? 'None of the post\'s pictures is this photo.' : `The post's own ${c.postChk.video ? 'video cover' : 'picture'} is a different photo.`}</b>` : c.postChk.state === 'unsure' ? 'The post\'s picture looks close but not clearly the same. Compare closely.' : 'The post\'s own pictures could not be read (sign in to Facebook or Instagram in this browser so PageProof can look).'}${c.postChk && c.postChk.pic ? ` <a href="${safeUrl(c.postChk.pic)}" target="_blank" rel="noreferrer">See it</a>` : ''}${c.postChk ? ` · <a href="#" data-act="postagain">Check again</a>` : ''}</span>` : ''}</dd>
      ${doubles.length > 1 ? `<dt>Double</dt><dd><div style="border:1px solid var(--accent);background:var(--accent-soft);border-radius:10px;padding:8px 10px;font-size:13.5px"><b>You have ${doubles.length} versions of this photo</b>${doubles.map(d => `<br>${esc(d.name)}${d.w ? ' (' + d.w + ' × ' + d.h + ')' : ''}${d.id === p.id ? ' · <b>this one</b>' : ''}`).join('')}<br><b style="color:var(--copy)">Note them all in the claim.</b></div></dd>` : ''}
    </dl>
    ${keptBoxHtml(c)}
  </div>
  <div class="dpane" data-tab="page"${show('page')}>
    <dl class="facts">
      ${c.title ? `<dt>Title</dt><dd>${esc(c.title)}</dd>` : ''}
      <dt>Page</dt><dd class="mono" style="font-size:12px;overflow-wrap:anywhere"><a href="${safeUrl(c.url)}" target="_blank" rel="noreferrer">${esc(c.url)}</a></dd>
      ${c.alts && c.alts.length ? `<dt>Same page at</dt><dd class="mono altlist" style="font-size:12px;overflow-wrap:anywhere">${c.alts.map(u => `<a href="${safeUrl(u)}" target="_blank" rel="noreferrer">${esc(u)}</a>`).join('<br>')}<div class="faint" style="font-family:inherit;font-size:12px">Other addresses for this one page (phone version, share links). One answer covers them all.</div></dd>` : ''}
      <dt>Hidden data</dt><dd>${c.credit ? CREDIT[c.credit] : `<button class="btn ghost sm" data-act="checkcredit">Check the hidden data</button>`}</dd>
    </dl>
    ${ck.page}
    ${soc ? (view !== 'page' || livePage ? postCard(c) : '') : view !== 'page' ? `<button class="btn sm" style="align-self:flex-start" data-act="dview" data-v="page">${ic('eye', 15)} See their page above</button>` : ''}
  </div>
  ${soc ? `<div class="dpane" data-tab="acct"${show('acct')}>${acctPane(c)}</div>` : ''}
  <div class="dpane" data-tab="claim"${show('claim')}>
    ${ck.legalBox}
    ${p && p.rel && reg ? `<section class="dsec"><div class="dsh">Copyright registration</div>${regBox(p, reg)}</section>` : ''}
    ${ck.damages}
    ${ck.rules}
    ${p && p.rel ? `<section class="dsec"><div class="dsh">Your client's photo in Drive</div>${pathBox(path)}</section>` : ''}
  </div>
  ${soc ? '' : `<div class="dpane" data-tab="site"${show('site')}>
    <a class="lookup" href="#who" data-act="gowho" data-v="${esc(c.id)}">${ic('owner', 18)}<span><b>Who's behind this site</b><br><span class="muted" style="font-size:13px">${f ? esc(f.names && f.names[0] ? 'Probably ' + f.names[0] : 'Names, contacts and domain facts') : 'Read names, contacts and domain facts off the site'}</span></span><span style="margin-left:auto">${ic('chev', 16)}</span></a>
    <dl class="facts">
      ${o && o.real ? `<dt>Site owner</dt><dd><a href="#owners" data-act="gowner" data-v="${esc(o.key)}" style="font-weight:600">${esc(o.name)}</a><br><span class="muted" style="font-size:13px">${esc(o.kind)}${o.sites.length > 1 ? ' · ' + FCD.copies.filter(x => o.sites.includes(x.site) && x.status !== 'removed').length + ' copies on their sites' : ''}</span></dd>` : ''}
      <dt>Site check</dt><dd>${RISK[c.risk.level][0]}${c.risk.why.length ? `<br><span class="muted" style="font-size:13px">${esc(c.risk.why.join(' · '))}</span>` : ''}</dd>
      ${c.country ? `<dt>Country</dt><dd>${esc(c.country)}${isSoc(c) ? '' : FCD.countries.includes(c.country) ? ` <button class="btn ghost sm" data-act="hidecountry" data-v="${esc(c.country)}">Stop showing this country</button>` : ` <button class="btn ghost sm" data-act="showcountry" data-v="${esc(c.country)}">Show this country</button>`}</dd>` : ''}
    </dl>
    <details class="hidebox" id="okbox"><summary><b>Is this site allowed to use the photo?</b> <span class="muted" style="font-size:13px">Approve it</span></summary>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
      ${c.clientName ? `<button class="lookup" style="text-align:left;cursor:pointer" data-act="approvesite" data-v="client"><span style="color:var(--ok);display:inline-flex">${ic('check', 20)}</span><span><b>Approved for ${esc(c.clientName)} only</b><br><span class="muted" style="font-size:12.5px">${esc(FC.baseOf(c.site))} may use this client's photos. Other clients' photos there still show as new.</span></span></button>` : ''}
      <button class="lookup" style="text-align:left;cursor:pointer" data-act="approvesite" data-v="all"><span style="color:var(--ok);display:inline-flex">${ic('check', 20)}</span><span><b>Approved for every client</b><br><span class="muted" style="font-size:12.5px">${esc(FC.baseOf(c.site))} may use any client's photos (a partner, a wire service, your own site).</span></span></button>
      <span class="faint" style="font-size:12.5px">Copies on an approved site are marked Licensed by themselves, now and in every later search. Change it in Settings › Hidden and approved sites.</span></div></details>
    <details class="hidebox" id="hidebox"><summary><b>Don't want results from this site?</b> <span class="muted" style="font-size:13px">Hide it</span></summary>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">${hideChoices(c).map(([v, l, d]) => `<button class="lookup" style="text-align:left;cursor:pointer" data-act="hidesite" data-v="${esc(v)}"><span style="color:var(--bad);display:inline-flex">${ic('ban', 20)}</span><span><b>${esc(l)}</b><br><span class="muted" style="font-size:12.5px">${esc(d)}</span></span></button>`).join('')}
      <span class="faint" style="font-size:12.5px">Hidden sites never show again in any search. Bring them back from Settings › Hidden and approved sites.</span></div></details>
  </div>`}
  </div>
  <div class="dacts dfoot">
  ${last ? `<button class="undoline" data-act="undo">↶ Undo: ${esc(last.label)}<span class="kbd" style="margin-left:auto">U</span></button>` : ''}
  ${c.status === 'removed' ? `<div class="banner info" style="padding:10px 12px"><span style="flex:1;font-size:14px"><b>Removed</b><br><span class="muted">Hidden from your results. It won't come back for this photo.</span></span><button class="btn" data-act="putback">Put back</button></div>` : `
    ${['stolen', 'licensed'].includes(c.status) ? `<div class="row" style="gap:8px;font-size:13.5px"><span>Your answer: ${tagFor(c)}</span><button class="btn ghost sm" style="margin-left:auto" data-act="changeans">Change answer</button></div>` : ''}
    <div class="dans" title="Choose one and the next copy opens here">
      <button class="btn stolen" data-act="dverdict" data-v="stolen"><b>Stolen</b><span class="kbd">Y</span></button>
      <button class="btn licensed" data-act="dverdict" data-v="licensed"><b>Licensed</b><span class="kbd">L</span></button>
      <button class="btn" data-act="dverdict" data-v="removed"><b>Remove</b><span class="kbd">N</span></button>
      <button class="btn" data-act="dverdict" data-v="skip"><b>Skip</b><span class="kbd">→</span></button>
    </div>`}
    <div class="dfoot2"><button class="btn primary" data-act="evidence">${ic('doc', 17)} Evidence report</button><button class="btn" data-act="capturecopy">${ic('capture', 16)} Capture</button><button class="btn" data-act="dmore" data-v="${esc(c.id)}" aria-label="More choices">${ic('dots', 16)} More</button></div>
  </div></aside>`;
}

// ---------------------------------------------------------------- All copies found
let LIST = [];           // the copies in the order they're shown, so an answer can open the next one
const WHEN = { any: ['Any time', 0], today: ['Today', 1], week: ['This week', 7], month: ['This month', 31] };
const MATCH = { any: 'All', exact: 'Exact', strong: 'Strong', loose: 'Loose' };
// Exact: the same photo and 95% or more lines up. Strong: 80% or more. Loose: everything else.
const matchKind = c => (c.pct >= 95 && c.match === 'same' ? 'exact' : c.pct >= 80 ? 'strong' : 'loose');
const flagWords = c => {
  const f = [];
  if (linkCardOf(c)) f.push(['bad', 'Only in a link preview', LINK_CARD(c)]);
  else if (notInPost(c)) f.push(['bad', 'Not seen in the post', NOT_IN_POST(c)]);
  if (c.risk.level === 'sus') f.push(['bad', 'Suspicious site', c.risk.why.join(', ')]);
  if (c.risk.level === 'watch') f.push(['warn', 'Worth a look', c.risk.why.join(', ')]);
  if (c.credit === 'removed') f.push(['copy', 'Credit removed', 'Your client\'s photo has a copyright line in its hidden data and their copy does not']);
  if (c.use === 'shop') f.push(['ok', 'Selling something', 'A shop page, product listing or ad']);
  return f.map(([col, t, why]) => `<span class="tag ${col}" title="${esc(why)}">${t}</span>`).join('');
};
// The row's lined-up columns (4.7). You pick which show (Columns menu); narrow windows drop the
// least needed ones by themselves.
const FCOLS = [['pct', 'Lines up'], ['client', 'Client'], ['dmg', 'Damages'], ['use', 'How it\'s used'], ['country', 'Country'], ['found', 'Found']];
const luBar = p => p == null || p < 0 ? '<span class="faint">–</span>' : `<span class="lu"><b class="num">${p}%</b><s><u style="width:${p}%;background:${p >= 95 ? 'var(--bad)' : p >= 80 ? 'var(--copy)' : 'var(--warn)'}"></u></s></span>`;
// One copy as a row: both pictures, the site, the page link, quiet warning icons, the columns, and the answer buttons.
function copyRow(c) {
  const p = FCD.photos.get(c.photo), done = c.status !== 'new', K = state.fCols;
  const cell = (k, label, html) => K[k] ? `<span class="cc-${k}"><i>${label}</i>${html}</span>` : '';
  return `<div class="frow crow${state.open === c.id ? ' on' : ''}" data-act="openrow" data-v="${esc(c.id)}">
    <input type="checkbox" class="cpick" aria-label="Pick ${esc(isSoc(c) && c.acct ? c.acct.handle : c.site)}" data-act="pick" data-v="${esc(c.id)}" ${state.picked.includes(c.id) ? 'checked' : ''}>
    <div class="cpair" data-hover="${esc(c.id)}"><img class="ours" src="${oursImg(p)}" alt="" loading="lazy"><img class="thumb" src="${theirImg(c)}" alt="" loading="lazy" referrerpolicy="no-referrer"></div>
    <div class="cinfo">
      ${isSoc(c) ? socLine(c) : `<div class="l1"><b>${esc(c.site)}</b>${done ? tagFor(c) : ''}${embedTag(c)}${sigIcons(c)}</div>`}
      <a class="curl" href="${safeUrl(c.url)}" target="_blank" rel="noreferrer" data-act="openlink" title="Open this page in a new tab"><span>${esc(String(c.url || '').replace(/^https?:\/\/(www\.)?/, ''))}</span>${ic('ext', 13)}</a>${c.alts && c.alts.length ? `<span class="tag grey altn" title="${esc(c.alts.join('\n'))}" data-gloss="Same page">+${c.alts.length} ${c.alts.length === 1 ? 'address' : 'addresses'}</span>` : ''}
      <div class="l3">${esc(c.photoName)}<span class="l3x">${isSoc(c) && c.acct ? ' · ' + esc(c.site) : ''}${c.pct >= 0 && c.pct != null ? ` · <b class="num" data-gloss="Lines up">${c.pct}%</b> lines up` : ''} · ${esc(FC.USE[c.use][0])}${c.country ? ' · ' + esc(c.country) : ''} · found ${shortDate(c.firstSeen).toLowerCase()}</span></div>
    </div>
    <div class="ccols">${cell('pct', 'Lines up', luBar(c.pct))}${cell('client', 'Client', c.clientName ? `<span title="${esc(c.clientName)}">${esc(c.clientName)}</span>` : '<span style="color:var(--warn);font-weight:600">Unknown</span>')}${K.dmg ? (dmgCell(c) ? `<span class="cc-dmg"><i>Damages</i>${dmgCell(c)}</span>` : '<span class="cc-dmg" aria-hidden="true"></span>') : ''}${cell('use', 'Use', `<span title="${esc(FC.USE[c.use][0])}">${esc(FC.USE[c.use][0])}</span>`)}${cell('country', 'Country', `<span>${esc(c.country || 'Not known')}</span>`)}${cell('found', 'Found', `<span>${esc(shortDate(c.firstSeen))}</span>`)}</div>
    <div class="acts">${c.status === 'removed' ? `<button class="btn sm" data-act="rowans" data-v="new|${esc(c.id)}">Put back</button>` : done ? `<button class="btn sm" data-act="rowans" data-v="new|${esc(c.id)}">Change answer</button>`
      : `<button class="btn sm stolen" data-act="rowans" data-v="stolen|${esc(c.id)}">Stolen</button><button class="btn sm licensed" data-act="rowans" data-v="licensed|${esc(c.id)}">Licensed</button><button class="btn sm" data-act="rowans" data-v="removed|${esc(c.id)}">Remove</button>`}
      <button class="btn sm icon" data-act="rowmenu" data-v="${esc(c.id)}" aria-label="More choices for ${esc(c.site)}">${ic('dots', 18)}</button></div></div>`;
}
V.found = async () => {
  const me = RENDER_N;      // a newer redraw started meanwhile: this one is thrown away, so it must not change LIST
  await loadFC();
  if (!state.fCols || !state.dView) {
    const pr = await api.storage.local.get(['fcCols', 'fcDView']).catch(() => ({}));
    state.fCols = Object.assign({ pct: true, client: true, dmg: true, use: true, country: true, found: true }, pr.fcCols || {});
    state.dView = pr.fcDView || 'side';
  }
  if (routeArg('open')) { const id = routeArg('open'), oc = FCD.copies.find(x => x.id === id); if (oc) switchTab(isSoc(oc) ? 'social' : 'web'); state.open = id; state.fFilter = 'All'; history.replaceState(null, '', '#found'); }
  if (routeArg('client')) { state.fClient = routeArg('client'); state.fFilter = 'All'; history.replaceState(null, '', '#found'); }
  if (routeArg('filter')) { state.fFilter = routeArg('filter'); history.replaceState(null, '', '#found'); }
  if (routeArg('photo')) { state.fPhoto = routeArg('photo'); state.fFilter = 'All'; state.fView = 'list'; history.replaceState(null, '', '#found'); }
  const everyTab = FCD.copies;
  // 4.9: two tabs, Websites and Social media. Each keeps its own filters.
  const tabN = t => everyTab.filter(c => (t === 'social') === isSoc(c) && c.status === 'new' && visible(c)).length;
  const nWeb = tabN('web'), nSoc = tabN('social');
  if (state.fTab === 'social' && !everyTab.some(isSoc)) switchTab('web');
  const everything = everyTab.filter(inTab);
  const hiddenN = everything.filter(c => c.status !== 'removed' && !siteHidden(c) && countryOut(c)).length;
  const all = everything.filter(visible);
  const social = state.fTab === 'social';
  if (!social && (state.fView === 'account' || state.sView === 'accounts')) { state.fView = 'client'; state.sView = 'copies'; }
  if (social && state.fView === 'owner') state.fView = 'account';
  const sorters = { act: (a, b) => actScore(b) - actScore(a), pct: (a, b) => (b.pct || 0) - (a.pct || 0), risk: (a, b) => ({ sus: 2, watch: 1, ok: 0 }[b.risk.level] - { sus: 2, watch: 1, ok: 0 }[a.risk.level]), newest: (a, b) => (b.firstSeen || '').localeCompare(a.firstSeen || ''), fol: (a, b) => (folOf(b) ?? -1) - (folOf(a) ?? -1) || actScore(b) - actScore(a) };
  const rows = all.filter(c => passMain(c) && passStatus(c)).sort(sorters[state.fSort] || sorters.act);
  const main = all.filter(passMain);
  const cnt = f => main.filter(c => passStatus(c, f)).length;
  const groups = [];
  const by = (keyFn) => { const m = new Map(); for (const c of rows) { const k = keyFn(c); if (!m.has(k)) m.set(k, []); m.get(k).push(c); } return m; };
  if (state.fView === 'client') {
    const m = by(c => c.clientName || 'Client unknown');
    for (const [k, xs] of [...m.entries()].sort((a, b) => (a[0] === 'Client unknown') - (b[0] === 'Client unknown') || a[0].localeCompare(b[0]))) {
      const cl = FCD.clients.get(k);
      groups.push([k, `<b class="gname"${k === 'Client unknown' ? ' style="color:var(--warn)"' : ''}>${cl && cl.priority ? '<span style="color:var(--warn)">★</span> ' : ''}${esc(k)}</b><span class="faint">${plural(new Set(xs.map(x => x.photo)).size, 'photo')}</span>`, xs, false]);
    }
  } else if (state.fView === 'photo') {
    const m = by(c => c.photo);
    for (const [k, xs] of m) {
      const p = FCD.photos.get(k);
      groups.push(['p:' + k, `<img class="gthumb" src="${oursImg(p)}" data-our="${esc(k)}" alt=""><div style="min-width:0"><b class="gname">${esc(xs[0].photoName)}</b><div class="faint">${xs[0].clientName ? esc(xs[0].clientName) : '<span style="color:var(--warn);font-weight:600">Client unknown</span>'}</div></div>`, xs, false]);
    }
  } else if (state.fView === 'site') {
    const m = by(c => FC.baseOf(c.site));
    for (const [k, xs] of [...m.entries()].sort((a, b) => b[1].length - a[1].length)) groups.push(['s:' + k, siteStrip(k, xs), xs, true]);
  } else if (state.fView === 'account') {
    const m = by(c => c.acct ? acctGroup(c.acct.key) : '~');
    for (const [k, xs] of [...m.entries()].sort((a, b) => (a[0] === '~') - (b[0] === '~') || (b[1].some(x => x.repeat) - a[1].some(x => x.repeat)) || b[1].length - a[1].length)) {
      const x = xs.find(y => y.acct) || xs[0], st = k === '~' ? 0 : (FCD.stolenBy.get(k) || []).length;
      const others = k === '~' ? [] : [...new Set(xs.filter(y => y.acct && y.acct.key !== x.acct.key).map(y => y.acct.handle + ' on ' + platOf(y).name))];
      groups.push(['a:' + k, k === '~' ? `<span class="plat" style="--pc:#6B7280">?</span><b class="gname" style="color:var(--warn)">Account not found yet</b><span class="faint">Open one to set it, or use Accounts › Look up in your browser</span>`
        : `${platBadge(x)}${acctHtml(x.acct, 'gname')}${st ? `<span class="tag bad">Known stolen account · ${st}</span>` : ''}${others.length ? `<span class="faint">also ${esc(others.join(', '))}</span>` : ''}<span class="faint">${plural(new Set(xs.map(y => y.clientName).filter(Boolean)).size, 'client')}</span>`, xs, xs.length > 3]);
    }
  } else if (state.fView === 'owner') {
    const m = by(c => { const o = FCD.ownerOf.get(c.site); return o && o.real ? o.key : '~'; });
    for (const [k, xs] of [...m.entries()].sort((a, b) => (a[0] === '~') - (b[0] === '~') || b[1].length - a[1].length)) {
      const o = k === '~' ? null : FCD.owners.find(z => z.key === k);
      const sites = new Set(xs.map(x => x.site));
      groups.push(['o:' + k, o ? `<span class="oav">${esc(o.name[0] || '?')}</span><div style="min-width:0"><b class="gname">${esc(o.name)}</b> <span class="faint">${esc(o.kind)}</span><div class="faint">${plural(sites.size, 'of their sites has copies', 'of their sites have copies')}${o.how[0] ? ' · ' + esc(o.how[0]) : ''}</div></div><button class="btn sm" data-act="gowner" data-v="${esc(o.key)}">About them</button>`
        : `<span class="oav grey">?</span><div style="min-width:0"><b class="gname">Other sites</b><div class="faint">${plural(sites.size, 'site')} with no shared owner found</div></div>`, xs, true]);
    }
  } else groups.push(['', '', rows, false]);
  const list = [];
  let shown = 0, body = '';
  const foldSites = state.fView !== 'site' && state.fView !== 'owner' && state.fView !== 'account';
  for (const [k, html, xs, fold] of groups) {
    if (shown >= state.more) break;
    let open = true;
    if (html) {
      const canFold = fold && xs.length > 3;
      open = !canFold || state.exp.includes(k);
      body += `<div class="ghead${canFold ? ' fold' : ''}" ${canFold ? `data-act="gtoggle" data-v="${esc(k)}"` : ''}>${canFold ? `<span class="caret${open ? ' on' : ''}">▸</span>` : ''}${html}<span class="faint gcount">${plural(xs.length, 'copy', 'copies')}${canFold ? (open ? ' · click to fold' : ' · click to open') : ''}</span></div>`;
      if (!open && !xs.some(x => x.id === state.open)) continue;
    }
    // Copies from one site sit together: the first shows, the rest fold under "N more from this site".
    const clusters = new Map();
    // Social posts fold per account (never "N more from instagram.com").
    for (const c of xs) { const b = !foldSites ? c.id : isSoc(c) ? (c.acct ? c.acct.handle + ' on ' + platOf(c).name : c.id) : FC.baseOf(c.site); if (!clusters.has(b)) clusters.set(b, []); clusters.get(b).push(c); }
    body += '<div class="clist">';
    for (const [b, cs] of clusters) {
      if (shown >= state.more) break;
      const mk = 'm:' + k + '|' + b, wide = cs.length < 2 || state.exp.includes(mk) || cs.some(x => x.id === state.open);
      for (const c of (wide ? cs : cs.slice(0, 1))) { if (shown >= state.more) break; body += copyRow(c); list.push(c.id); shown++; }
      if (cs.length > 1) {
        const fresh = cs.filter(x => x.status === 'new').map(x => x.id);
        if (!wide) shown += cs.length - 1;
        body += `<div class="morerow" data-act="gtoggle" data-v="${esc(mk)}"><span class="caret${wide ? ' on' : ''}">▸</span><b>${wide ? 'Fold the copies from ' + esc(b) : (cs.length - 1) + ' more from ' + esc(b)}</b>
          ${fresh.length > 1 ? `<span class="acts"><button class="btn sm stolen" data-act="siteall" data-v="stolen\n${esc(fresh.join('\n'))}">All ${fresh.length} stolen</button><button class="btn sm licensed" data-act="siteall" data-v="licensed\n${esc(fresh.join('\n'))}">All licensed</button><button class="btn sm" data-act="siteall" data-v="removed\n${esc(fresh.join('\n'))}">Remove all</button></span>` : ''}</div>`;
      }
    }
    body += '</div>';
  }
  if (rows.length > shown) body += `<div class="more-row"><button class="btn" data-act="fmore">Show ${Math.min(250, rows.length - shown)} more (${rows.length - shown} not shown)</button></div>`;
  const active = [['fClient', state.fClient], ['fUse', state.fUse === 'Any' ? 'Any' : FC.USE[state.fUse][0]], ['fRisk', state.fRisk === 'Any' ? 'Any' : RISK[state.fRisk][0]], ['fCredit', state.fCredit === 'Any' ? 'Any' : CREDIT[state.fCredit]],
    ['fYear', state.fYear === 'Any' ? 'Any' : 'Year ' + state.fYear], ['fQuarter', state.fQuarter === 'Any' ? 'Any' : 'Quarter ' + state.fQuarter]].filter(([, v]) => v !== 'Any');
  if (state.fShop) active.push(['fShop', 'Selling something']);
  if (state.fRepeat) active.push(['fRepeat', 'Repeat offenders']);
  if (state.fSpam === 'only') active.push(['fSpam', 'Spam blogs only']);
  if (state.fKnown) active.push(['fKnown', state.fKnown === 'only' ? 'Stolen before links only' : 'Without stolen before links']);
  if (state.fOwner) { const o = FCD.owners.find(z => z.key === state.fOwner); active.push(['fOwner', 'Owner: ' + (o ? o.name : '?')]); }
  if (state.fPhoto) { const p = FCD.photos.get(state.fPhoto); active.push(['fPhoto', 'Photo: ' + (p ? p.name : 'one photo')]); }
  if (state.fq) active.push(['fq', 'Search: ' + state.fq]);
  if (social) for (const [k, l] of [['fVer', 'Verified'], ['fFol', 'Followers'], ['fType', 'Type'], ['fCountry', 'Country']]) if (state[k] !== 'Any') active.push([k, l + ': ' + (k === 'fFol' ? (state[k] === 'nk' ? 'Not known' : PP_SOCIAL.FOL_BANDS[+state[k]][2]) : k === 'fVer' ? { real: 'Really verified', paid: 'Paid check', gold: 'Organisation', grey: 'Government', meta: 'Instagram/Facebook check', yes: 'Verified by the site', no: 'No check', nk: 'Not known' }[state[k]] : state[k] === 'nk' ? 'Not known' : state[k])]);
  if (state.fAcct) { const e = FCD.accts.get(state.fAcct); active.push(['fAcct', state.fAcct === '~' ? 'Account not found yet' : 'Account: ' + (e ? e.acct.handle : state.fAcct)]); }
  const shownOn = [...(state.fWhen !== 'any' ? [['fWhen', 'Found ' + WHEN[state.fWhen][0].toLowerCase()]] : []), ...(state.fMatch !== 'any' ? [['fMatch', state.fMatch[0].toUpperCase() + state.fMatch.slice(1) + ' match']] : []), ...(state.fFresh ? [['fFresh', 'Published in the last 3 months']] : []), ...active];
  const sel = (id, label, opts, cur) => `<label>${label}<select data-act="fsel" data-v="${id}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  const live = all.filter(c => c.status !== 'removed');
  const countryList = [...new Set([...everything.map(c => c.country).filter(Boolean), ...Object.values(FC.COUNTRY)])].filter(c => !FCD.countries.includes(c)).sort();
  const outList = [...new Set(everything.filter(c => countryOut(c) && c.status !== 'removed').map(c => c.country))];
  const recent = state.recentHides.filter(h => RS_LISTS.hidden.includes(h));
  const nNew = live.filter(c => c.status === 'new').length;
  const bigTabs = `<div class="bigtabs" role="tablist" aria-label="Websites or social media">${[['web', 'Websites', nWeb], ['social', 'Social media', nSoc]].map(([k, l, n]) => `<button role="tab" aria-selected="${state.fTab === k}" class="${state.fTab === k ? 'on' : ''}" data-act="ftab" data-v="${k}">${l} <span class="n num">${n}</span></button>`).join('')}</div>`;
  if (!everything.length && everyTab.length) {
    return `${head('', 'Copies found', 'Answer right on the row, or click a row to see more.')}
    ${bigTabs}
    <section class="card pad" style="text-align:center;padding:48px 22px;display:flex;flex-direction:column;align-items:center;gap:12px"><h2>${social ? 'No social media copies yet' : 'No website copies yet'}</h2><p class="muted" style="margin:0;max-width:56ch">${social ? 'Copies posted on Instagram, TikTok, Facebook, X and other social sites show up here.' : 'Copies on websites show up here.'}</p></section>`;
  }
  if (!everything.length) {
    return `${head('', 'Copies found', 'Every copy found by every search, Keep searching and today\'s 50.')}
    ${await driveBanner()}
    <section class="card pad" style="text-align:center;padding:48px 22px;display:flex;flex-direction:column;align-items:center;gap:12px"><h2>Nothing found yet</h2><p class="muted" style="margin:0;max-width:56ch">Copies show up here as soon as a search finds them. Turn on Keep searching, run today's 50, or search a few photos now.</p>
    <div class="row" style="justify-content:center"><a class="btn primary" href="#keep">Keep searching</a><a class="btn" href="#search">New search</a></div></section>`;
  }
  // Quick filters: one click each. The number is how many copies it would show. (4.7: they live in Filters.)
  const chip = (label, n, on, act, v, col) => n || on ? `<button class="qchip${on ? ' on' : ''}" data-act="${act}" data-v="${v}" aria-pressed="${on}">${col ? `<i style="background:var(--${col})"></i>` : ''}${label} <span class="num">${n}</span></button>` : '';
  const years = [...new Set(everything.map(c => (FCD.photos.get(c.photo) || {}).year).filter(Boolean))].sort((a, b) => b - a);
  // 4.7: one tidy line. Each switch is a small dropdown.
  // 4.11: a dropdown set away from its normal choice (def) turns blue, with an ✕ that puts it back.
  const dd = (id, label, opts, cur, right, def) => { const chosen = def != null && cur !== def; return `<details class="ddw${right ? ' right' : ''}" data-dd="${id}"><summary class="ddb${chosen ? ' chosen' : ''}">${label}${cur != null ? ` <b>${esc((opts.find(o => o[0] === cur) || opts[0])[1])}</b>` : ''} ${chosen ? `<span class="ddx" role="button" tabindex="0" data-act="fset" data-v="${id}|${def}" title="Back to ${esc((opts.find(o => o[0] === def) || opts[0])[1])}" aria-label="Clear ${label}">✕</span>` : '<span class="caret" aria-hidden="true">▾</span>'}</summary><div class="ddm" role="menu">${opts.map(([k, l, s]) => `<button role="menuitemradio" aria-checked="${cur === k}" class="${cur === k ? 'on' : ''}" data-act="fset" data-v="${id}|${k}">${esc(l)}${s ? `<span class="sub">${esc(s)}</span>` : ''}</button>`).join('')}</div></details>`; };
  const newL = live.filter(c => c.status === 'new');
  // 4.24: new spam blog copies (counted whether they are hidden or showing).
  const spamCs = everything.filter(c => c.spam && c.status === 'new' && !siteHidden(c) && !FCD.countries.includes(c.country)), spamN = spamCs.length;
  // 4.11: the old big number cards are now small Quick filter buttons. Solid blue with a tick = on.
  const qf = (label, n, on, act, v, col) => `<button class="qf${on ? ' on' : ''}" data-act="${act}" data-v="${v}" aria-pressed="${on}">${on ? '<span class="tick" aria-hidden="true">✓</span>' : col ? `<i style="background:var(--${col})"></i>` : ''}${label} <span class="num">${n}</span></button>`;
  const fresh = c => c.dmg && c.dmg.end && Date.now() <= c.dmg.end.getTime();
  return `${head('', 'Copies found', 'Answer right on the row, or click a row to see more.', `<button class="btn" data-act="fcsv">${ic('down', 16)} Download</button>${nNew ? `<a class="btn primary" href="#review">One at a time (${nNew})</a>` : ''}`)}
  ${await driveBanner()}
  ${bigTabs}
  ${socAskBanner(everyTab.filter(visible))}
  ${FCD.unhid && FCD.unhid.length ? `<div class="banner info" role="status"><div style="flex:1 1 260px;min-width:0"><b>${esc(FCD.unhid.join(', '))} ${FCD.unhid.length === 1 ? 'shows' : 'show'} again</b><div style="font-size:13px">A whole social site can no longer be hidden, only its accounts. Its posts are back on the Social media tab. Hide the accounts you don't want from there.</div></div><button class="btn sm" data-act="unhidok">Got it</button></div>` : ''}
  <section class="card found-card">
    <div class="toolbar tidy">
      <div class="tabs" role="tablist" aria-label="Status">${['New', 'Stolen', 'Licensed', 'Removed', 'All'].map(f => `<button role="tab" aria-selected="${state.fFilter === f}" class="${state.fFilter === f ? 'on' : ''}" data-act="ffilter" data-v="${f}"${f === 'All' ? ' title="Every copy except the removed ones"' : ''}>${state.fFilter === f ? '<i class="tick" aria-hidden="true">✓</i>' : ''}${f} <span>${cnt(f)}</span></button>`).join('')}${['Still online', 'Back online', 'Gone'].includes(state.fFilter) ? `<button role="tab" aria-selected="true" class="on" data-act="ffilter" data-v="${state.fFilter}"><i class="tick" aria-hidden="true">✓</i>${state.fFilter} <span>${cnt(state.fFilter)}</span></button>` : ''}</div>
      ${social ? `<div class="seg sm" role="radiogroup" aria-label="Show">${[['copies', 'Copies'], ['accounts', 'Accounts']].map(([k, l]) => `<button role="radio" aria-checked="${state.sView === k}" class="${state.sView === k ? 'on' : ''}" data-act="sview" data-v="${k}">${l}</button>`).join('')}</div>` : ''}
      ${dd('fView', 'Group', social ? [['account', 'Account'], ['client', 'Client'], ['photo', 'Photo'], ['site', 'Platform'], ['list', 'None']] : [['client', 'Client'], ['photo', 'Photo'], ['site', 'Site'], ['owner', 'Site owner'], ['list', 'None']], state.fView)}
      ${dd('fWhen', 'Found', Object.entries(WHEN).map(([k, v]) => [k, v[0]]), state.fWhen, false, 'any')}
      ${dd('fMatch', 'Match', [['any', 'All'], ['exact', 'Exact', 'The same photo, 95% or more lines up'], ['strong', 'Strong', '80% or more lines up'], ['loose', 'Loose', 'Less, or only a few details match']], state.fMatch, false, 'any')}
      <button class="ddb${state.showFilters ? ' on' : ''}${active.length ? ' chosen' : ''}" data-act="togglefilters" aria-expanded="${state.showFilters}">＋ More filters${active.length ? ` <b class="num">${active.length}</b>` : ''}</button>
      <span style="flex:1"></span>
      ${dd('fSort', 'Sort', [['act', 'Best to act on'], ['pct', 'Lines up most'], ...(social ? [['fol', 'Most followers']] : [['risk', 'Most suspicious']]), ['newest', 'Newest']], state.fSort, true)}
      <details class="ddw right" data-dd="cols"><summary class="ddb">Columns <span class="caret" aria-hidden="true">▾</span></summary><div class="ddm">${FCOLS.map(([k, l]) => `<label><input type="checkbox" data-act="fcol" data-v="${k}" ${state.fCols[k] ? 'checked' : ''}> ${esc(l)}</label>`).join('')}<span class="faint" style="font-size:12px;padding:4px 10px 6px">Narrow windows show fewer columns.</span></div></details>
    </div>
    <div class="qfrow" aria-label="Quick filters"><span class="qflabel">Quick filters</span>
      ${qf('Found today', newL.filter(c => new Date(c.firstSeen).toDateString() === new Date().toDateString()).length, state.fWhen === 'today', 'ftoday', '1', 'accent')}
      ${social ? qf('Known stolen accounts', newL.filter(c => c.repeat > 0).length, state.fRepeat, 'qtoggle', 'repeat', 'bad') : qf('Suspicious sites', newL.filter(c => c.risk.level === 'sus').length, state.fRisk === 'sus', 'qtoggle', 'sus', 'bad')}
      ${qf('Published in the last 3 months', newL.filter(fresh).length, state.fFresh, 'qtoggle', 'fresh', 'ok')}
      ${!social && spamN ? qf('Spam blogs', spamN, state.fSpam === 'only', 'qtoggle', 'spam', 'faint') : ''}
      ${RS_STOLEN.items.length ? qf('Stolen before', all.filter(c => c.known && c.status !== 'removed').length, state.fKnown === 'only', 'qtoggle', 'known', 'bad') : ''}
    </div>
    ${!social ? spamLine(spamCs) : ''}
    ${social ? platChips(all.filter(c => passMore(c) && passStatus(c) && passMainNoPlat(c))) : ''}
    ${social ? acctFilterLine(dd, all.filter(c => passStatus(c) && passMainNoAcct(c))) : ''}
    ${state.showFilters ? `<div class="filters fpanel">
      <div class="qchips" aria-label="Quick filters"><span style="font-weight:600">Quick filters</span>
      ${chip('Repeat offenders', live.filter(c => c.repeat && c.status === 'new').length, state.fRepeat, 'qtoggle', 'repeat', 'bad')}
      ${RS_STOLEN.items.length ? chip('On my stolen before list', live.filter(c => c.known).length, state.fKnown === 'only', 'qtoggle', 'known', 'bad') + chip('Hide ones on my stolen before list', live.filter(c => c.known).length, state.fKnown === 'hide', 'qtoggle', 'knownhide') : ''}
      ${chip('Selling something', live.filter(c => c.use === 'shop').length, state.fShop, 'qtoggle', 'shop', 'ok')}
      ${chip('Credit removed', live.filter(c => c.credit === 'removed').length, state.fCredit === 'removed', 'qtoggle', 'credit', 'copy')}
      ${chip('Copied onto their site', live.filter(c => c.use === 'copied').length, state.fUse === 'copied', 'qtoggle', 'copied')}
      ${chip('Shown from another site', live.filter(c => c.use === 'embedded').length, state.fUse === 'embedded', 'qtoggle', 'embedded')}</div>
      <details class="keyfold"><summary>What do the icons mean?</summary><section class="key" aria-label="What the icons mean">
        <div class="kitem"><span class="tag bad">${ic('warn', 13)}</span><div><span><b>Suspicious site</b> (red) or <b>Worth a look</b> (yellow): young site, hidden owner, odd ending like .xyz, or a name copycat sites use.</span></div></div>
        <div class="kitem"><span class="tag copy">${ic('nocredit', 13)}</span><div><span><b>Credit removed</b>: your client's photo has a copyright line in its hidden data. Their copy doesn't.</span></div></div>
        <div class="kitem"><span class="tag bad">${ic('repeat', 13)}</span><div><span><b>Repeat offender</b>: you already marked copies on this site, or another site of the same owner, as Stolen, or the site is on your stolen before list.</span></div></div>
        <div class="kitem"><span class="tag bad">Stolen before</span><div><span><b>Stolen before</b>: this exact page is on your list of links stolen before (Settings › Hidden and approved sites).</span></div></div>
        <div class="kitem"><span class="tag ok">${ic('shop', 13)}</span><div><span><b>Selling something</b>: a shop page, product listing or ad.</span></div></div>
        <div class="kitem"><span class="tag warn">${ic('maybe', 13)}</span><div><span><b>Maybe</b>: the checker is not sure it is the same photo.</span></div></div>
        <div class="kitem"><span class="tag ok">Statutory</span><div><span><b>Damages column</b>: Statutory (registered), Register by a date (no number yet, window still open), Actual only (window closed). Empty when the file name has no date.</span></div></div>
      </section></details>
      ${sel('fClient', 'Client', [['Any', 'Any'], ...[...new Set(everything.map(c => c.clientName || 'Client unknown'))].sort().map(n => [n, n])], state.fClient)}
      ${sel('fYear', 'Photo year', [['Any', 'Any'], ...years.map(y => [y, y])], state.fYear)}
      ${sel('fQuarter', 'Quarter', [['Any', 'Any'], [1, 'Q1'], [2, 'Q2'], [3, 'Q3'], [4, 'Q4']], state.fQuarter)}
      ${sel('fUse', 'Used as', [['Any', 'Any'], ...Object.entries(FC.USE).map(([k, v]) => [k, v[0]])], state.fUse)}
      ${sel('fRisk', 'Site check', [['Any', 'Any'], ['ok', 'Looks normal'], ['watch', 'Worth a look'], ['sus', 'Suspicious']], state.fRisk)}
      ${sel('fCredit', 'Credit', [['Any', 'Any'], ['kept', 'Credits your client'], ['removed', 'Credit removed'], ['', 'Not checked yet']], state.fCredit)}
      <div class="countries">
        <span style="font-weight:600">Countries</span>
        <span class="faint">Showing</span>${FCD.countries.map(c => `<button class="chip on" style="cursor:pointer" data-act="hidecountry" data-v="${esc(c)}" title="Stop showing copies from ${esc(c)}">${esc(c)} <span aria-hidden="true">✕</span></button>`).join('')}<span class="faint" title="Most sites (.com, .net, .org) don't say their country, so they always show.">+ country not known</span>
        <select aria-label="Show another country" data-act="showcountrysel" class="chip" style="cursor:pointer;min-height:28px"><option value="">＋ Show a country</option>${[...outList.sort(), ...countryList.filter(c => !outList.includes(c))].map(c => `<option value="${esc(c)}">${esc(c)}${outList.includes(c) ? ' (has copies)' : ''}</option>`).join('')}</select>
        ${hiddenN ? `<span class="faint">${plural(hiddenN, 'copy', 'copies')} from other countries not shown</span>` : ''}
        <a href="#hidden" style="font-weight:600;margin-left:auto">All hidden sites ›</a>
      </div></div>` : ''}
    ${shownOn.length ? `<div class="showing" role="status"><span>Showing <b class="num">${rows.length}</b> of <b class="num">${all.filter(c => passStatus(c)).length}</b> ${esc(state.fFilter === 'All' ? '' : state.fFilter.toLowerCase())} copies</span>${shownOn.map(([k, v]) => `<button class="stag" data-act="unfilter" data-v="${k}" title="Turn this filter off">${esc(v)} <span aria-hidden="true">✕</span></button>`).join('')}<button class="sclear" data-act="unfilter" data-v="all">Clear filters</button></div>` : ''}
    ${recent.length ? `<div class="row activebar">
      ${recent.length ? `<span class="faint" style="margin-left:auto">Just hidden</span>${recent.map(h => `<button class="chip" style="cursor:pointer;text-decoration:line-through;text-decoration-color:var(--faint)" data-act="showsite" data-v="${esc(h)}" title="Show ${esc(h)} again">${esc(h)} <span style="text-decoration:none">↺</span></button>`).join('')}` : ''}</div>` : ''}
    <div class="cbody">${social && state.sView === 'accounts' ? accountsView(all.filter(c => passMain(c) && passStatus(c))) : body || `<div class="cempty"><b>${state.fFilter === 'New' && !active.length && state.fWhen === 'any' && state.fMatch === 'any' ? 'All caught up' : 'Nothing matches'}</b>${state.fFilter === 'New' && !active.length && state.fWhen === 'any' && state.fMatch === 'any' ? 'Every new copy has an answer. New finds show up here.' : 'Try another tab, or clear a filter.'}</div>`}</div>
    <div class="row faint cfoot"><span>Keys with a copy open: <span class="kbd">Y</span> stolen <span class="kbd">L</span> licensed <span class="kbd">N</span> remove <span class="kbd">→</span> skip <span class="kbd">U</span> undo <span class="kbd">↑</span><span class="kbd">↓</span> move <span class="kbd">?</span> all keys. Also kept in Documents › PageProof › found-copies.txt.</span></div>
  </section>
  ${state.sis ? `<div class="bulk sis"><div style="flex:1 1 300px;min-width:0"><b>Same ${state.sis.same ? 'photo' : 'article'} on ${plural(state.sis.sites.length, 'sister site')} of ${esc(state.sis.owner)}</b><div style="font-size:13px;opacity:.85;overflow-wrap:anywhere">${esc(state.sis.sites.slice(0, 5).join(', '))}${state.sis.sites.length > 5 ? '…' : ''}</div></div><button class="btn" data-act="sisall">Mark ${state.sis.ids.length === 1 ? 'it' : 'all ' + state.sis.ids.length} stolen too</button><button class="btn" data-act="sisno">Not now</button></div>` : ''}
  ${state.picked.length ? `<div class="bulk"><b>${state.picked.length} picked</b><button class="btn" style="margin-left:auto" data-act="bulkhide">${state.fTab === 'social' ? 'Hide these accounts' : 'Hide these sites'}</button><button class="btn" data-act="bulk" data-v="removed">Remove</button><button class="btn" data-act="bulk" data-v="licensed">Mark licensed</button><button class="btn" data-act="bulk" data-v="stolen">Mark stolen</button><button class="btn" data-act="clearpick">Clear</button></div>` : ''}
  ${await drawer(me === RENDER_N ? (LIST = list) : list)}`;
};
// 4.24: one quiet line about spam blog copies: how many are hidden, and buttons to show them or
// hide every one of those throwaway sites for good (the whole site, so new made-up addresses stay out too).
function spamLine(xs) {
  if (!xs.length) return '';
  const bases = [...new Set(xs.map(c => FC.baseOf(c.site)))];
  const eg = esc(xs[0].site);
  const hideAll = `<button class="btn sm" data-act="spamhide" data-v="${esc(bases.join('\n'))}">Hide all ${bases.length === 1 ? 'of ' + esc(bases[0]) : bases.length + ' spam sites'}</button>`;
  if (state.fSpam === 'hide') return `<div class="spamline" role="status"><span><b>${plural(xs.length, 'spam blog copy', 'spam blog copies')} hidden</b> <span class="muted">Random addresses on throwaway sites, like ${eg}. Nothing was answered for you.</span></span><span class="acts"><button class="btn sm" data-act="spamshow" data-v="show">Show them</button><button class="btn sm" data-act="spamshow" data-v="only">Only them</button>${hideAll}</span></div>`;
  return `<div class="spamline on" role="status"><span><b>${plural(xs.length, 'spam blog copy', 'spam blog copies')} showing</b> <span class="muted">Each has a grey Spam blog tag. Point at the tag to see why.</span></span><span class="acts"><button class="btn sm" data-act="spamshow" data-v="hide">Hide them again</button>${hideAll}</span></div>`;
}
// Grouped by site, each site gets one strip: where it is, what PageProof knows, and buttons
// that act on the whole site.
function siteStrip(base, xs) {
  const c = xs[0], o = FCD.ownerOf.get(c.site);
  const worst = xs.some(x => x.risk.level === 'sus') ? 'sus' : xs.some(x => x.risk.level === 'watch') ? 'watch' : 'ok';
  const uses = [...new Set(xs.map(x => FC.USE[x.use][0]))].slice(0, 2).join(', ');
  return `<div class="strip"><div class="sname"><b class="gname">${esc(base)}</b>${c.country ? `<span class="tag grey">${esc(c.country)}</span>` : ''}${worst !== 'ok' ? `<span class="tag ${worst === 'sus' ? 'bad' : 'warn'}">${RISK[worst][0]}</span>` : ''}${o && o.real ? `<span class="tag blue" title="Site owner">${esc(o.name)}</span>` : ''}<span class="faint">${esc(uses)} · ${plural(new Set(xs.map(x => x.photo)).size, 'of your photos', 'of your photos')}</span></div>
    <div class="sbtns"><a class="btn sm" href="${safeUrl('https://' + base)}" target="_blank" rel="noreferrer" data-act="openlink">Home page</a><button class="btn sm" data-act="stripok" data-v="${esc(c.id)}">Approve site</button>${RS_LISTS.wholeSocial(base) ? '' : `<button class="btn sm" data-act="hidesite" data-v="${esc(base)}">Hide site</button>`}<button class="btn sm" data-act="gowho" data-v="${esc(c.id)}">Who's behind it</button></div></div>`;
}
V.found.guard = async () => ((await FC.drive()).done ? null : 'connect');
V.found.after = () => { if (typeof FC_PREV !== 'undefined') FC_PREV.start(); loadOurs(); bindHover(); ppPagePic(); ppKeptLine(); socQueue(); infoQueue(); if (typeof rpQueue === 'function') rpQueue(); };

// Hovering a copy's thumbnail shows it next to your client's photo.
// Only one card ever exists. It goes away when the mouse leaves the pictures, and also when the
// page redraws, changes, scrolls, is clicked or is hidden (4.5: a redraw under the mouse used to
// leave the card stuck on screen for good, on every page).
let hovCard = null;
const hovGone = () => { if (hovCard) hovCard.remove(); hovCard = null; };
addEventListener('hashchange', hovGone);
addEventListener('scroll', hovGone, true);
addEventListener('mousedown', hovGone, true);
addEventListener('blur', hovGone);
document.addEventListener('visibilitychange', hovGone);
document.addEventListener('mousemove', e => { if (hovCard && !(e.target.closest && e.target.closest('[data-hover]'))) hovGone(); }, { passive: true });
function bindHover() {
  hovGone();
  view.querySelectorAll('[data-hover]').forEach(img => {
    img.addEventListener('mouseenter', () => {
      hovGone();
      const c = FCD && FCD.copies.find(x => x.id === img.dataset.hover);
      if (!c) return;
      const p = FCD.photos.get(c.photo);
      const card = hovCard = document.createElement('div'); card.className = 'hovcard';
      card.innerHTML = `<div class="pair"><div class="frame ours"><img src="${oursImg(p)}" alt=""><span class="lab">Your client's</span></div><div class="frame theirs"><img src="${theirImg(c)}" alt="" referrerpolicy="no-referrer"><span class="lab">Theirs</span></div></div>
        <div class="row" style="gap:8px;font-size:13px"><b>${esc(c.site)}</b>${c.pct >= 0 && c.pct != null ? `<span class="muted">${c.pct}% lines up</span>` : ''}${c.w ? `<span class="faint" style="margin-left:auto">${c.w} × ${c.h}</span>` : ''}</div>`;
      document.body.appendChild(card);
      ppLoadPics(card);
      const b = img.getBoundingClientRect();
      card.style.left = Math.min(innerWidth - card.offsetWidth - 12, b.right + 12) + 'px';
      card.style.top = Math.max(12, Math.min(innerHeight - card.offsetHeight - 12, b.top - 40)) + 'px';
    });
    img.addEventListener('mouseleave', hovGone);
  });
}

// ---------------------------------------------------------------- answers, with undo
const VERB = { stolen: 'marked stolen', licensed: 'marked licensed', removed: 'removed', skip: 'skipped', new: 'put back as new' };
// 4.9.1: an answer or a hide takes the row off the list the moment it's clicked. Saving it can
// take a second or two in a big library, so until it's saved these remember it, and every redraw
// in between already leaves the row out.
const PEND = new Map();          // copy id -> its new answer
const PEND_HIDE = new Set();     // hidden-site entries
let PEND_ARR = [];               // the same, as a list for RS_SITE.entryFor (a new list each change)
const pendHide = (entries, on) => { for (const e of entries) on ? PEND_HIDE.add(e) : PEND_HIDE.delete(e); PEND_ARR = [...PEND_HIDE]; };
// Answers and hides are saved one after the other, in the order they were clicked. None is
// dropped, and two never write the hidden-sites list at the same time.
let ANS_Q = Promise.resolve();
function inTurn(fn) {
  ANS_Q = ANS_Q.then(fn).catch(e => { console.error(e); toast('That could not be saved: ' + ((e && e.message) || e) + '. Try again.'); });
  return ANS_Q;
}
// Rows that no longer belong in the list on screen leave it now (the next redraw agrees).
function dropRows(ids) {
  if (!FCD || state.shown !== 'found') return;
  const byId = new Map(FCD.copies.map(c => [c.id, c]));
  for (const r of view.querySelectorAll('.frow[data-act="openrow"]')) {
    const c = byId.get(r.dataset.v);
    if (c && (!ids || ids.has(c.id)) && !(visible(c) && passMain(c) && passStatus(c))) r.remove();
  }
}
function markNow(ids, status) {
  if (status === 'skip') return;
  const set = new Set(ids);
  for (const id of ids) PEND.set(id, status);
  if (FCD) for (const c of FCD.copies) if (set.has(c.id)) c.status = status;
  dropRows(set);
}
async function answerCopies(ids, status, label) {
  markNow(ids, status);
  let undo;
  try { undo = await FC.answer(ids, status === 'new' ? 'new' : status); }
  finally { for (const id of ids) if (PEND.get(id) === status) PEND.delete(id); dropFC(); }
  // Licensed: this site may use this client's photos, so later copies there are licensed too.
  let undoLic = null;
  if (status === 'licensed') {
    const c = FCD.copies.find(x => x.id === ids[0]);
    const cl = c && c.clientName && await FC.DB.get('clients', c.clientName);
    const had = cl && (cl.licensed || []).includes(FC.baseOf(c.site));
    if (c && c.clientName && !had) { await FC.licenseSite(c.clientName, c.site, true); undoLic = () => FC.licenseSite(c.clientName, c.site, false); }
  }
  if (status === 'removed') {
    for (const id of ids) { const c = FCD.copies.find(x => x.id === id); if (c) learn(c); }
  }
  const h = { label, undo: async () => { await undo(); if (undoLic) await undoLic(); }, open: ids.length === 1 ? ids[0] : '' };
  HIST.push(h);
  if (status !== 'new') fastCheck(ids, status);
  return h;
}
// 4.15 (Ben's idea 10): racing through answers can hit the wrong copy. After 12 answers in 20
// seconds, offer one quick look at them (at most once every 3 minutes). Nothing is changed by itself.
const FAST = { list: [], shownAt: 0 };
function fastCheck(ids, status) {
  const now = Date.now();
  for (const id of ids.slice(0, 1)) FAST.list.push({ id, status, at: now });
  FAST.list = FAST.list.filter(x => now - x.at < 60000).slice(-40);
  const burst = FAST.list.filter(x => now - x.at < 20000);
  if (burst.length < 12 || now - FAST.shownAt < 180000) return;
  FAST.shownAt = now;
  const ask = document.getElementById('fastAsk') || Object.assign(document.createElement('div'), { id: 'fastAsk' });
  ask.className = 'banner info fastask';
  ask.setAttribute('role', 'status');
  ask.innerHTML = `<div style="flex:1 1 240px"><b>That was quick: ${burst.length} answers in 20 seconds</b><div style="font-size:13.5px">Want a quick look at them before moving on?</div></div><button class="btn primary" data-act="fastlook">Look at the last ${burst.length}</button><button class="btn ghost" data-act="fastok">They're fine</button>`;
  ask.dataset.ids = JSON.stringify(burst.map(x => x.id));
  document.body.appendChild(ask);
}
Object.assign(ACTS, {
  fastok: () => { const a = document.getElementById('fastAsk'); if (a) a.remove(); },
  fastlook: async () => {
    const a = document.getElementById('fastAsk'); const ids = a ? JSON.parse(a.dataset.ids || '[]') : []; if (a) a.remove();
    const all = await FC.DB.getMany('copies', ids);
    const d = document.createElement('dialog');
    d.className = 'pp-ask fastlook';
    d.style.cssText = 'border:1px solid var(--line);border-radius:16px;padding:22px;background:var(--surface);color:var(--ink);box-shadow:0 20px 60px rgba(0,0,0,.35);width:min(640px,92vw)';
    const rows = all.filter(Boolean).map(c => `<div class="row" style="gap:10px;flex-wrap:nowrap;border-top:1px solid var(--line);padding:8px 0"><span class="tag ${STATUS[c.status] ? STATUS[c.status][1] : 'grey'}" style="flex-shrink:0">${STATUS[c.status] ? STATUS[c.status][0] : esc(c.status)}</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(c.url)}"><b>${esc(c.site)}</b> <span class="muted">${esc(c.url.replace(/^https?:\/\/(www\.)?/, ''))}</span></span><button class="btn sm" type="button" data-fopen="${esc(c.id)}">Change</button></div>`).join('');
    d.innerHTML = `<form method="dialog" style="display:flex;flex-direction:column;gap:6px"><b style="font-size:18px">Your last ${ids.length} answers</b><span class="muted" style="font-size:13.5px">Newest last. Press Change to open one and give it a different answer.</span><div style="max-height:60vh;overflow:auto">${rows}</div><div class="row" style="justify-content:flex-end"><button class="btn primary" value="ok">They're all right</button></div></form>`;
    document.body.appendChild(d);
    d.addEventListener('keydown', e => e.stopPropagation());
    d.addEventListener('click', e => { const b = e.target.closest('[data-fopen]'); if (!b) return; const id = b.dataset.fopen; d.close(); state.fFilter = 'All'; state.open = id; if (route() !== 'found') location.hash = '#found'; render(true); });
    d.addEventListener('close', () => d.remove());
    d.showModal();
  },
});
// "Remove" teaches the photo check quietly: the numbers are kept to tune it later.
async function learn(c) {
  try {
    const st = (await api.storage.local.get('rsLearn')).rsLearn || [];
    st.push({ pct: c.pct, inl: c.inl, tiles: c.tiles, str: c.str, mid: c.mid, was: c.match, site: c.site, at: Date.now() });
    await api.storage.local.set({ rsLearn: st.slice(-500) });
  } catch (e) { /* not important */ }
}
async function undoLast() {
  const h = HIST.pop();
  if (!h) return toast('Nothing to undo.');
  await inTurn(() => h.undo());
  dropFC();
  if (h.open) state.open = h.open;
  toast('Undone: ' + h.label + '. It\'s back the way it was.');
  render(true);
}
function toastUndo(msg) { toast(msg, undoLast); }

// In the details panel: answer, then open the next copy in the same list.
let answering = false;    // One at a time: a second key press while the first answer is still being saved is ignored
const DRAWER_BUSY = new Set();   // the open copy is being answered: a second key press for it is ignored
async function drawerVerdict(status) {
  const id = state.open;
  const c = FCD && FCD.copies.find(x => x.id === id);
  if (!c || DRAWER_BUSY.has(id)) return;
  DRAWER_BUSY.add(id);
  try { await drawerVerdict2(status, id, c); } finally { DRAWER_BUSY.delete(id); }
}
async function drawerVerdict2(status, id, c) {
  if (status === 'stolen') { status = await ruleGate(c); if (!status) return; }
  const i = LIST.indexOf(id), free = x => x !== id && !PEND.has(x);
  const nextId = LIST.slice(i + 1).find(free) || LIST.slice(0, Math.max(0, i)).reverse().find(free) || '';
  const sis = status === 'stolen' ? sistersOf(c) : null;
  const who = isSoc(c) && c.acct ? c.acct.handle : c.site;
  markNow([id], status);
  await inTurn(async () => {
    await answerCopies([id], status, who + ' ' + VERB[status]);
    state.sis = sis;
    if (state.open === id) state.open = nextId;
    toastUndo(who + ' ' + VERB[status] + (status === 'stolen' ? (isSoc(c) && c.acct ? '. ' + c.acct.handle + ' is now a known account.' : '. Save its Evidence report when you\'re ready.') : '.') + (nextId ? ' Next copy opened.' : ''));
  });
  await render(true);
}

async function hideSite(entry, label) {
  const was = state.open, cs = FCD ? FCD.copies : [];
  const e = RS_SITE.tidy(entry) || entry;
  pendHide([e], true);
  dropRows(null);
  // 4.7: if the open copy is now hidden, the next copy in the list opens (like Stolen or Remove).
  const gone = id => { const x = cs.find(y => y.id === id); return !x || siteHidden(x) || PEND.has(id); };
  if (was && gone(was)) { const i = LIST.indexOf(was); state.open = LIST.slice(i + 1).find(id => !gone(id)) || LIST.slice(0, Math.max(0, i)).reverse().find(id => !gone(id)) || ''; }
  await inTurn(async () => {
    try { await RS_LISTS.load(); await RS_LISTS.add('hidden', entry); } finally { pendHide([e], false); dropFC(); }
  });
  if (!RS_LISTS.hidden.includes(e)) {                 // not saved
    if (RS_LISTS.wholeSocial(e)) toast('A whole social site can\'t be hidden, only its accounts. Open a post and hide its account.');
    return;
  }
  if (!state.recentHides.includes(e)) state.recentHides.push(e);
  HIST.push({ label: (label || entry) + ' hidden', undo: async () => { await RS_LISTS.load(); await RS_LISTS.remove('hidden', e); }, open: was || undefined });
  const keptN = cs.filter(c => c.status === 'stolen' && RS_SITE.entryFor(c.site, c.url, [e])).length;
  toastUndo(entry + ' hidden. It never shows again in any search.' + (keptN ? ' ' + plural(keptN, 'copy', 'copies') + ' you marked Stolen there stay' + (keptN === 1 ? 's' : '') + ' in your list.' : ''));
}

// What the Evidence report says about the use: dates, damages, credit line, signs it was on purpose.
async function reportChecks(c, p) {
  const pf = c.pf || await readTheirPage(c).catch(() => null);
  const pub = PP_CHECKS.pubDate(p), reg = p ? await FC.regFor(p) : null;
  const kind = (await siteKinds())[FC.baseOf(c.site)] || '';
  return { pub, damages: PP_CHECKS.damages(pub, reg), pf, purpose: PP_CHECKS.onPurpose(pf), kind: kind ? PP_CHECKS.KIND_NAME[kind] : '' };
}
// The current copy's photo file (from Drive), or the small copy if Drive can't be reached.
async function ourBlob(p) {
  try { if (p && p.rel) return await FC.fileFor(p); } catch (e) { /* not reachable */ }
  const th = await FC.thumbOf(p);
  if (th) return (await fetch(th)).blob();
  throw new Error('Your client\'s photo can\'t be opened right now. Check that Google Drive is running.');
}

Object.assign(ACTS, {
  openrow: v => { state.open = v; render(true); },
  // 4.7 panel: tabs switch in place (no redraw), the picture view and column picks are remembered.
  dtab: v => {
    state.dTab = v;
    const d = document.getElementById('drawer'); if (!d) return;
    d.querySelectorAll('.dtabs [data-act="dtab"]').forEach(b => { const on = b.dataset.v === v; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    d.querySelectorAll('.dpane').forEach(p => { p.hidden = p.dataset.tab !== v; });
    const t = d.querySelector('.dtabs'), sc = document.getElementById('dscroll');
    if (t && sc && t.offsetTop < sc.scrollTop) sc.scrollTop = t.offsetTop - 8;
  },
  dview: async v => { state.dView = v; api.storage.local.set({ fcDView: v }).catch(() => {}); await render(true); },
  dmore: (v, el) => ACTS.rowmenu(v, el),
  ftoday: () => { state.fWhen = state.fWhen === 'today' ? 'any' : 'today'; state.fFilter = 'New'; state.more = 250; render(true); },
  fcol: async (v, el) => { state.fCols[v] = !!el.checked; api.storage.local.set({ fcCols: state.fCols }).catch(() => {}); await render(true); const d = document.querySelector('[data-dd="cols"]'); if (d) d.open = true; },
  dslide: (v, el) => { state.slide = Number(el.value) || 50; },
  closedrawer: () => { state.open = ''; render(true); },
  dstep: v => { const n = LIST[LIST.indexOf(state.open) + Number(v)]; if (n) { state.open = n; render(true); } },
  dverdict: v => drawerVerdict(v),
  undo: () => undoLast(),
  pick: v => { const i = state.picked.indexOf(v); if (i >= 0) state.picked.splice(i, 1); else state.picked.push(v); render(true); },
  clearpick: () => { state.picked = []; render(true); },
  bulk: async v => {
    let ids = state.picked.slice();
    if (!ids.length) return;
    state.picked = [];
    // 4.15: Remove never touches copies you marked Stolen (they keep their evidence).
    let kept = 0;
    if (v === 'removed' && FCD) { const st = new Set(FCD.copies.filter(c => c.status === 'stolen').map(c => c.id)); kept = ids.filter(id => st.has(id)).length; ids = ids.filter(id => !st.has(id)); }
    if (!ids.length) { toast(plural(kept, 'Stolen copy', 'Stolen copies') + ' kept. Stolen copies are never removed in a group; open one to change its answer.'); render(true); return; }
    if (kept) setTimeout(() => toast(plural(kept, 'Stolen copy', 'Stolen copies') + ' left as they are. Only the other ' + plural(ids.length, 'copy', 'copies') + ' were removed.', undoLast), 2700);
    markNow(ids, v);
    await inTurn(async () => {
      await answerCopies(ids, v, plural(ids.length, 'copy', 'copies') + ' ' + VERB[v]);
      toastUndo(plural(ids.length, 'copy', 'copies') + ' ' + VERB[v] + '.');
    });
    render(true);
  },
  bulkhide: async () => {
    if (!FCD) await loadFC();
    // Social posts: their accounts are hidden, never the whole platform.
    const sites = [...new Set(state.picked.map(id => { const c = FCD.copies.find(x => x.id === id) || {}; return isSoc(c) ? (c.acct ? c.acct.key : '') : c.site; }).filter(s => s && !RS_LISTS.wholeSocial(s)))];
    if (!sites.length) return toast('Those posts have no account yet. Set the account first.');
    state.picked = [];
    pendHide(sites, true); dropRows(null);
    await inTurn(async () => {
      try {
        await RS_LISTS.load();
        for (const s of sites) { await RS_LISTS.add('hidden', s); if (!state.recentHides.includes(s)) state.recentHides.push(s); }
      } finally { pendHide(sites, false); dropFC(); }
      HIST.push({ label: plural(sites.length, 'site') + ' hidden', undo: async () => { await RS_LISTS.load(); for (const s of sites) await RS_LISTS.remove('hidden', s); } });
      toastUndo(plural(sites.length, 'site') + ' hidden.');
    });
    render(true);
  },
  gtoggle: v => { const i = state.exp.indexOf(v); if (i >= 0) state.exp.splice(i, 1); else state.exp.push(v); render(true); },
  fmore: () => { state.more += 250; render(true); },
  ffilter: v => { state.fFilter = v; state.more = 250; if (route() !== 'found') location.hash = 'found'; else render(true); },
  qshop: () => { state.fShop = true; state.fFilter = 'All'; render(true); },
  qrepeat: () => { state.fRepeat = true; state.fFilter = 'New'; render(true); },
  qrisk: v => { state.fRisk = v; state.fFilter = 'All'; render(true); },
  qcredit: v => { state.fCredit = v; state.fFilter = 'All'; render(true); },
  togglefilters: () => { state.showFilters = !state.showFilters; render(true); },
  unfilter: v => {
    if (v === 'all') Object.assign(state, { fWhen: 'any', fMatch: 'any', fVer: 'Any', fFol: 'Any', fType: 'Any', fCountry: 'Any', fAcct: '', fPlat: 'Any', fFresh: false, fClient: 'Any', fUse: 'Any', fRisk: 'Any', fCredit: 'Any', fShop: false, fRepeat: false, fKnown: '', fSpam: 'hide', fOwner: '', fYear: 'Any', fQuarter: 'Any', fPhoto: '', fq: '' });
    else if (v === 'fWhen' || v === 'fMatch') state[v] = 'any';
    else if (v === 'fSpam') state.fSpam = 'hide';
    else state[v] = v === 'fShop' || v === 'fRepeat' || v === 'fFresh' ? false : ['fOwner', 'fPhoto', 'fq', 'fAcct', 'fKnown'].includes(v) ? '' : 'Any';
    render(true);
  },
  // Group by, Found, Match: the little switches above the list.
  fset: v => { const [k, val] = v.split('|'); state[k] = val; state.more = 250; render(true); },
  // Quick filter chips: click to turn on, click again to turn off.
  qtoggle: v => {
    if (v === 'repeat') { state.fRepeat = !state.fRepeat; if (state.fRepeat) state.fFilter = 'New'; }
    else if (v === 'known') state.fKnown = state.fKnown === 'only' ? '' : 'only';
    else if (v === 'knownhide') state.fKnown = state.fKnown === 'hide' ? '' : 'hide';
    else if (v === 'spam') state.fSpam = state.fSpam === 'only' ? 'hide' : 'only';
    else if (v === 'sus') state.fRisk = state.fRisk === 'sus' ? 'Any' : 'sus';
    else if (v === 'fresh') { state.fFresh = !state.fFresh; if (state.fFresh) state.fFilter = 'New'; }
    else if (v === 'shop') state.fShop = !state.fShop;
    else if (v === 'credit') state.fCredit = state.fCredit === 'removed' ? 'Any' : 'removed';
    else state.fUse = state.fUse === v ? 'Any' : v;
    state.more = 250; render(true);
  },
  openlink: () => {},                       // a plain link inside a row: just let it open
  // An answer straight from the row.
  // 4.9.1: the row leaves at once; the answer is saved in turn (a quick click on the next row is never lost).
  rowans: async v => {
    const i = v.indexOf('|'), id = v.slice(i + 1);
    let status = v.slice(0, i);
    if (state.open === id && status !== 'new') return drawerVerdict(status);
    const c = FCD && FCD.copies.find(x => x.id === id);
    if (!c || PEND.has(id)) return;
    if (status === 'stolen') { status = await ruleGate(c); if (!status) return; }
    const sis = status === 'stolen' ? sistersOf(c) : null;
    const who = isSoc(c) && c.acct ? c.acct.handle : c.site;
    markNow([id], status);
    await inTurn(async () => {
      await answerCopies([id], status, who + ' ' + VERB[status]);
      state.sis = sis;
      toastUndo(who + ' ' + VERB[status] + (status === 'stolen' && isSoc(c) && c.acct ? '. ' + who + ' is now a known account.' : '.'));
    });
    await render(true);
  },
  // Every new copy from one site, in one go.
  siteall: async v => {
    const [status, ...ids] = v.split('\n');
    markNow(ids, status);
    await inTurn(async () => {
      await answerCopies(ids, status, plural(ids.length, 'copy', 'copies') + ' ' + VERB[status]);
      toastUndo(plural(ids.length, 'copy', 'copies') + ' ' + VERB[status] + '.');
    });
    render(true);
  },
  sisall: async () => {
    const s = state.sis; state.sis = null;
    if (!s) return;
    markNow(s.ids, 'stolen');
    await inTurn(async () => {
      await answerCopies(s.ids, 'stolen', plural(s.ids.length, 'sister-site copy', 'sister-site copies') + ' marked stolen');
      toastUndo(plural(s.ids.length, 'copy', 'copies') + ' on ' + s.owner + '\'s other sites marked stolen.');
    });
    render(true);
  },
  sisno: () => { state.sis = null; render(true); },
  // The ⋯ menu on a row, and in the details panel.
  rowmenu: (v, el) => {
    const c = FCD && FCD.copies.find(x => x.id === v);
    if (!c) return;
    const id = esc(c.id), base = FC.baseOf(c.site);
    openRowMenu(el, `${c.status === 'new' ? `<button data-act="mdo" data-v="skip|${id}">${ic('chev', 16)}<span>Skip for now</span><span class="kbd">→</span></button>` : ''}
      ${isSoc(c) && !c.acct ? `<small>Who posted it?</small><button data-act="openacct" data-v="${id}">${ic('who', 16)}<span>Set the account</span></button>` : ''}
      ${!isSoc(c) || c.acct ? `<small>${isSoc(c) ? 'Approve ' + esc(c.acct.handle) : 'Approve this site'}</small>
      ${c.clientName ? `<button data-act="mdo" data-v="okclient|${id}">${ic('check', 16)}<span>For ${esc(c.clientName)} only</span></button>` : ''}
      <button data-act="mdo" data-v="okall|${id}">${ic('check', 16)}<span>For every client</span></button>` : ''}
      <small>${isSoc(c) ? 'Hide' : 'Hide this site'}</small>
      ${hideChoices(c).map(([h, l, d, warn]) => `<button data-act="mhide" data-v="${esc(h)}"${warn ? ` title="${esc(d)}" style="color:var(--bad)"` : ''}>${ic('ban', 16)}<span>${esc(l)}</span></button>`).join('')}
      <hr>
      <button data-act="mdo" data-v="compare|${id}">${ic('layers', 16)}<span>Compare the two photos</span></button>
      <button data-act="mdo" data-v="evidence|${id}">${ic('doc', 16)}<span>Make evidence report</span></button>
      <button data-act="mdo" data-v="capture|${id}">${ic('cam', 16)}<span>Capture their page</span></button>
      ${isSoc(c) ? (c.acct ? `<button data-act="openacct" data-v="${id}">${ic('owner', 16)}<span>Who's behind ${esc(c.acct.handle)}</span></button>` : '') : `<button data-act="mdo" data-v="who|${id}">${ic('owner', 16)}<span>Who's behind ${esc(base)}</span></button>`}
      <button data-act="mdo" data-v="copy|${id}">${ic('link', 16)}<span>Copy the link</span></button>`);
  },
  stripok: (v, el) => {
    const c = FCD && FCD.copies.find(x => x.id === v);
    if (!c) return;
    openRowMenu(el, `<small>Approve ${esc(FC.baseOf(c.site))}</small>${c.clientName ? `<button data-act="mdo" data-v="okclient|${esc(c.id)}">${ic('check', 16)}<span>For ${esc(c.clientName)} only</span></button>` : ''}<button data-act="mdo" data-v="okall|${esc(c.id)}">${ic('check', 16)}<span>For every client</span></button>`);
  },
  mhide: async v => { closeRowMenu(); await hideSite(v); render(true); },
  mdo: async v => {
    closeRowMenu();
    const i = v.indexOf('|'), what = v.slice(0, i), id = v.slice(i + 1);
    const c = FCD && FCD.copies.find(x => x.id === id);
    if (!c) return;
    if (what === 'evidence') return ACTS.evidence(id);
    if (what === 'who') return ACTS.gowho(id);
    if (what === 'copy') return ACTS.copytext(c.url);
    if (what === 'skip') { if (state.open === id) return drawerVerdict('skip'); await answerCopies([id], 'skip', c.site + ' skipped'); toastUndo(c.site + ' skipped. It stays in New.'); return render(true); }
    // The rest are written for the copy that is open, so open it for a moment.
    const was = state.open; state.open = id;
    try {
      if (what === 'okclient') await ACTS.approvesite('client');
      else if (what === 'okall') await ACTS.approvesite('all');
      else if (what === 'compare') await ACTS.compare();
      else if (what === 'capture') await ACTS.capturecopy();
    } finally { if (was !== id && ['compare', 'capture'].includes(what)) state.open = was; else if (was !== id) { state.open = was; render(true); } }
  },
  hidesite: async v => { await hideSite(v); render(true); },
  spamshow: v => { state.fSpam = v; state.more = 250; render(true); },
  // Hide whole spam sites (serecoun.blog hides every made-up address on it). Undo brings them back.
  spamhide: async v => {
    const sites = String(v || '').split('\n').filter(Boolean);
    if (!sites.length) return;
    pendHide(sites, true); dropRows(null);
    if (state.open && sites.includes(FC.baseOf((FCD.copies.find(x => x.id === state.open) || {}).site || ''))) state.open = '';
    await inTurn(async () => {
      try {
        await RS_LISTS.load();
        for (const s of sites) { await RS_LISTS.add('hidden', s); if (!state.recentHides.includes(s)) state.recentHides.push(s); }
      } finally { pendHide(sites, false); dropFC(); }
      HIST.push({ label: plural(sites.length, 'spam site') + ' hidden', undo: async () => { await RS_LISTS.load(); for (const s of sites) await RS_LISTS.remove('hidden', s); } });
      toastUndo(plural(sites.length, 'spam site') + ' hidden, with every address on ' + (sites.length === 1 ? 'it' : 'them') + '.');
    });
    render(true);
  },
  openok: () => { ACTS.dtab('site'); const d = document.getElementById('okbox'); if (d) { d.open = true; d.scrollIntoView({ block: 'center', behavior: 'smooth' }); } },
  approvesite: async v => {
    const c = FCD.copies.find(x => x.id === state.open);
    if (!c) return;
    if (isSoc(c)) { if (c.acct) return ACTS.approveacct(v); return toast('Set the account first. Approve works per account on social sites.'); }
    const base = FC.baseOf(c.site), who = v === 'client' ? c.clientName : '';
    const undo = await FC.approveSite(base, who, c.id);
    const i = LIST.indexOf(c.id);
    const nextId = LIST.slice(i + 1).find(id => { const x = FCD.copies.find(y => y.id === id); return x && FC.baseOf(x.site) !== base; }) || '';
    HIST.push({ label: base + ' approved' + (who ? ' for ' + who : ' for every client'), undo, open: c.id });
    dropFC(); state.open = nextId;
    toastUndo(base + ' is approved' + (who ? ' for ' + who : ' for every client') + '. Its copies are marked Licensed.');
    render(true);
  },
  openhide: () => { ACTS.dtab('site'); const d = document.getElementById('hidebox'); if (d) { d.open = true; d.scrollIntoView({ block: 'center', behavior: 'smooth' }); } },
  showsite: async v => {
    await RS_LISTS.load(); await RS_LISTS.remove('hidden', v); dropFC();
    HIST.push({ label: v + ' shown again', undo: async () => { await RS_LISTS.load(); await RS_LISTS.add('hidden', v); } });
    toastUndo(v + ' shows again.'); render(true);
  },
  hidecountry: async v => {
    await FC.setShownCountries((await FC.shownCountries()).filter(x => x !== v));
    HIST.push({ label: v + ' no longer shown', undo: async () => FC.setShownCountries([...(await FC.shownCountries()), v]) });
    dropFC(); state.open = ''; toastUndo('Copies on sites from ' + v + ' no longer show.'); render(true);
  },
  showcountry: async v => {
    const list = await FC.shownCountries();
    if (!list.includes(v)) await FC.setShownCountries([...list, v]);
    HIST.push({ label: v + ' shown', undo: async () => FC.setShownCountries((await FC.shownCountries()).filter(x => x !== v)) });
    dropFC(); toastUndo('Copies on sites from ' + v + ' show now.'); render(true);
  },
  putback: async () => { const c = FCD.copies.find(x => x.id === state.open); await answerCopies([state.open], 'new', (c ? c.site : 'Copy') + ' put back'); toastUndo('Put back as new.'); render(true); },
  changeans: async () => { const c = FCD.copies.find(x => x.id === state.open); await answerCopies([state.open], 'new', (c ? c.site : 'Copy') + ' answer cleared'); toastUndo('Answer cleared. Choose a new one.'); render(true); },
  copytext: async v => { try { await navigator.clipboard.writeText(v); toast('Copied ' + (v.length > 40 ? (/^https?:/i.test(v) ? 'the link' : 'the full path') : v)); } catch (e) { toast('Could not copy. Select the text and press Ctrl+C.'); } },
  addreg: async v => {
    const i = document.getElementById('regIn');
    if (!i || !(await FC.setReg(v, i.value))) return toast('Type a number like VA 1-234-567 or 1-12345678901.');
    toast('Saved for the whole folder.'); render(true);
  },
  checkcredit: async () => {
    const c = await FC.DB.get('copies', state.open);
    const p = c && await FC.DB.get('photos', c.photo);
    if (!c) return;
    toast('Reading the hidden data in both photos…');
    try {
      const ours = await ourBlob(p);
      const om = (await PP_META.read(new Uint8Array(await ours.arrayBuffer()))).summary;
      const theirs = await PP_EVIDENCE.grabCopy(c);
      const res = PP_EVIDENCE.credit(om, theirs && theirs.meta && theirs.meta.summary);
      if (theirs && theirs.bmp.close) theirs.bmp.close();
      if (!res) { toast(om && (om.copyright || om.creator) ? 'Their copy could not be downloaded.' : 'Your client\'s photo has no copyright line in its hidden data, so there is nothing to compare.'); return; }
      c.credit = res; await FC.DB.put('copies', c); dropFC();
      toast(res === 'removed' ? 'Credit removed: their copy has no copyright line.' : 'Their copy still credits your client.'); render(true);
    } catch (e) { toast(String(e.message || e)); }
  },
  setkind: async (v, el) => {
    const c = FCD.copies.find(x => x.id === state.open);
    if (!c) return;
    const k = el.value, was = await setKind(c.site, k);
    HIST.push({ label: 'kind of site set for ' + FC.baseOf(c.site), undo: () => setKind(c.site, was), open: c.id });
    toastUndo(k ? FC.baseOf(c.site) + ' is a ' + PP_CHECKS.KIND_NAME[k].toLowerCase() + '. Saved for every copy there.' : 'Kind of site cleared.');
    render(true);
  },
  openpost: () => {
    const c = FCD.copies.find(x => x.id === state.open);
    if (c && /^https?:/i.test(c.url || '')) api.tabs.create({ url: c.url });
  },
  postagain: async () => {
    const c = FCD.copies.find(x => x.id === state.open);
    if (!c) return;
    const p = postCheck(c); render(true);
    await p.catch(() => {});
    if (state.open === c.id) render(true);
  },
  readpage: async () => {
    const c = FCD.copies.find(x => x.id === state.open);
    if (!c) return;
    const p = readTheirPage(c, true); render(true);
    await p.catch(() => {});
    if (state.open === c.id) render(true);
  },
  legalfix: async v => {
    if (v === 'capture') return ACTS.capturecopy();
    if (v === 'readpage') return ACTS.readpage();
    ACTS.dtab('claim');
    const s = document.querySelector('#rulesbox .kindsel');
    if (s) { s.scrollIntoView({ block: 'center', behavior: 'smooth' }); s.focus(); }
  },
  setclient: async (v, el) => {
    const name = el.value; if (!name) return;
    const c = FCD.copies.find(x => x.id === state.open);
    const undo = await FC.setClientOf(c.photo, name);
    HIST.push({ label: 'client set to ' + name, undo, open: c.id });
    dropFC(); toastUndo('Client set to ' + name + ' for this photo.'); render(true);
  },
  compare: async () => {
    const c = FCD.copies.find(x => x.id === state.open);
    const p = FCD.photos.get(c.photo);
    try {
      const a = await ourBlob(p);
      let b = null, src = '';
      for (const u of [c.img, await FC.thumbOf(c)].filter(Boolean)) { try { const r = await fetch(u, { credentials: 'omit' }); if (r.ok) { b = await r.blob(); src = u; break; } } catch (e) { /* next */ } }
      if (!b) return toast('Their copy could not be downloaded. Open the page and save the photo instead.');
      await PP_DB.put({ id: 'compare-rs', a: { blob: a, name: c.photoName }, b: { blob: b, name: c.site + ' copy', src: src.startsWith('data:') ? c.url : src } });
      api.tabs.create({ url: api.runtime.getURL('compare.html?from=revsearch') });
    } catch (e) { toast(String(e.message || e)); }
  },
  capturecopy: async v => { await loadFC(); const c = FCD.copies.find(x => x.id === (v || state.open)); if (c) await captureCopy(c); },
  evidence: async v => {
    await loadFC();
    const c = FCD.copies.find(x => x.id === (v || state.open));
    if (!c) return;
    const caseNo = await PP_EVIDENCE.ask();
    if (caseNo === null) return;
    await matchReport(c, caseNo);
  },
  fsel: (v, el) => { state[v] = el.value; state.more = 250; render(true); },
  fshop: (v, el) => { state.fShop = el.checked; render(true); },
  showcountrysel: (v, el) => el.value && ACTS.showcountry(el.value),
  gowner: v => { state.ownerSel = v; location.hash = 'owners'; },
  gowho: v => { const c = FCD.copies.find(x => x.id === v); if (c) { state.who = { site: c.site, url: c.url, copy: c.id }; location.hash = 'who'; } },
  fcsv: async () => {
    await loadFC();
    const head = ['Status', 'Client', 'Photo', 'Site', 'Page', 'Lines up %', 'Match', 'Used as', 'Site check', 'Country', 'First seen', 'Last seen', 'Times seen', 'Found by'];
    const rows = FCD.copies.map(c => [STATUS[c.status][0], c.clientName, c.photoName, c.site, c.url, c.pct == null ? '' : c.pct, c.match, FC.USE[c.use][0], RISK[c.risk.level][0], c.country || '', (c.firstSeen || '').slice(0, 10), (c.lastSeen || '').slice(0, 10), c.times || 1, c.by || '']);
    // Spreadsheet programs run cells that start with = + - @ as formulas, so those get a ' first.
    const q = v => { let t = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + [head, ...rows].map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv' }));
    a.download = 'PageProof_copies_found.csv'; a.click();
  },
});
// The Evidence report PDF for one copy (the match PageProof found), saved as its own file.
async function matchReport(c, caseNo) {
  toast('Making the evidence report…');
  try {
    const p = FCD.photos.get(c.photo);
    const blob = await ourBlob(p);
    const r = await PP_EVIDENCE.make({ blob, name: c.photoName, w: p && p.w, h: p && p.h, hash: (p && p.hash) || await RS_UTIL.sha256(blob), client: c.clientName, path: await FC.pathOf(p), reg: p ? await FC.regFor(p) : null },
      { ...c, use: FC.USE[c.use][0], acctInfo: infoOf(c), pic: picLink(c) }, { caseNo, collector: await getName(), owner: await ownerSummary(c.site), checks: await reportChecks(c, p) });
    const a = document.createElement('a'); a.href = URL.createObjectURL(r.blob); a.download = r.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    await FC.logReport({ id: r.id, file: r.name, url: c.url, site: c.site, photo: c.photoName, client: c.clientName, caseNo });
    if (r.credit) { const cc = await FC.DB.get('copies', c.id); if (cc) { cc.credit = r.credit; await FC.DB.put('copies', cc); } }
    toast('Saved ' + r.name);
    return r.name;
  } catch (e) { toast('The report could not be made: ' + (e.message || e)); }
}
// Capture a copy's page. PageProof remembers which copy it was, so when the evidence pack (zip)
// is saved on the capture page, the match report PDF is saved next to it as its own file (4.5).
async function captureCopy(c) {
  // 4.15: also a 640-pixel copy of your client's photo, so the capture page can check that the
  // photo really is on the captured page (from Drive, at most 4 seconds; else the small preview).
  let pic = '';
  try {
    const p = await FC.DB.get('photos', c.photo);
    const file = p ? await RS_LATE(FC.fileFor(p).catch(() => null), 4000, null) : null;
    if (file) {
      const b = await createImageBitmap(file); const k = Math.min(1, 640 / Math.max(b.width, b.height));
      const cv = new OffscreenCanvas(Math.max(1, Math.round(b.width * k)), Math.max(1, Math.round(b.height * k)));
      cv.getContext('2d').drawImage(b, 0, 0, cv.width, cv.height); b.close && b.close();
      const blob = await cv.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
      pic = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
    }
    if (!pic && p) pic = await FC.thumbOf(p);
  } catch (e) { /* the check is skipped */ }
  // 4.32: when the link was an account page and the exact post was found, capture the post.
  const capUrl = (c.rp && c.rp.post) || c.url;
  await api.storage.local.set({ fcCapFor: { url: capUrl, id: c.id, at: Date.now(), pic } });
  await api.runtime.sendMessage({ type: 'captureUrl', url: capUrl }).catch(() => {});
  toast('Opening ' + c.site + ' to capture it. When you save the evidence pack, the match report PDF is saved too.');
}
// The capture page asks for the match report after saving a pack (fcReportReq). Only one open
// PageProof tab makes it (a lock), and it uses the case number typed on the capture page.
async function takeReportReq() {
  const run = async () => {
    const { fcReportReq: q } = await api.storage.local.get('fcReportReq');
    if (!q || Date.now() - q.at > 10 * 60000) return;
    await api.storage.local.remove('fcReportReq');
    await loadFC();
    const c = FCD.copies.find(x => x.id === q.id);
    if (c) { await FC.markCaptured(c.id).catch(() => {}); await matchReport(c, q.caseNo || ''); }
  };
  if (navigator.locks) await navigator.locks.request('pp-report-req', run); else await run();
}
api.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch.fcReportReq && ch.fcReportReq.newValue) takeReportReq(); });
api.runtime.onMessage.addListener((m, s, reply) => { if (m && m.type === 'ppAppHere' && s.id === api.runtime.id) { reply(true); return false; } return false; });
takeReportReq();
async function ownerSummary(site) {
  const o = FCD && FCD.ownerOf.get(site);
  const f = FCD && FCD.facts.get(site);
  if (!(o && o.real) && !(f && f.clues && f.clues.length)) return null;
  return { name: o && o.real ? o.name : (f.names || [])[0] || '', kind: o && o.real ? o.kind : '', how: o && o.real ? o.how : [], clues: f ? f.clues : [] };
}

// ---------------------------------------------------------------- Review new copies
function reviewQueue() {
  return FCD.copies.filter(c => c.status === 'new' && visible(c))
    .sort((a, b) => (!!a.skipped - !!b.skipped) || (a.skipped || '').localeCompare(b.skipped || '') || (b.repeat > 0) - (a.repeat > 0) || (b.match === 'same') - (a.match === 'same') || (b.pct || 0) - (a.pct || 0));
}
V.review = async () => {
  await loadFC();
  const Q = reviewQueue();
  const hd = head('Copies found', 'One at a time', 'PageProof found these and checked each one against your client\'s photo. Decide what each one is. Anything marked stolen is watched every week.', `<a class="btn" href="#found">All copies found</a>`);
  const tabs = `<div class="seg" role="tablist" aria-label="Show">${[['review', `To review (${Q.length})`], ['sites', 'By site and company']].map(([k, l]) => `<button role="tab" aria-selected="${state.rvTab === k}" class="${state.rvTab === k ? 'on' : ''}" data-act="rvtab" data-v="${k}">${l}</button>`).join('')}</div>`;
  if (state.rvTab === 'sites') {
    const by = new Map();
    for (const c of Q) { const o = FCD.ownerOf.get(c.site); const k = o && o.real ? o.key : FC.baseOf(c.site); if (!by.has(k)) by.set(k, { o: o && o.real ? o : null, name: o && o.real ? o.name : FC.baseOf(c.site), xs: [] }); by.get(k).xs.push(c); }
    const cards = [...by.values()].sort((a, b) => b.xs.length - a.xs.length).map(g => `<section class="card pad" style="display:flex;flex-direction:column;gap:10px"><div class="row"><h2>${esc(g.name)}</h2><span class="tag grey">${plural(new Set(g.xs.map(x => x.site)).size, 'site')}</span>${g.o ? `<span class="faint" style="font-size:12.5px">${esc(g.o.kind)}</span>` : ''}</div>
      <p class="muted" style="margin:0;font-size:14px;overflow-wrap:anywhere">${esc([...new Set(g.xs.map(x => x.site))].slice(0, 6).join(', '))}${new Set(g.xs.map(x => x.site)).size > 6 ? '…' : ''}</p>
      <div class="row"><span class="tag copy">${plural(g.xs.length, 'new copy', 'new copies')}</span><button class="btn sm" style="margin-left:auto" data-act="rvall" data-v="${esc(g.xs.map(x => x.id).join('\n'))}">Mark all stolen</button></div></section>`).join('');
    return `${hd}${tabs}<div class="grid g2">${cards || '<p class="muted">Nothing waiting for you.</p>'}</div>`;
  }
  if (!Q.length) return `${hd}${tabs}<section class="card pad" style="text-align:center;padding:48px 22px;display:flex;flex-direction:column;align-items:center;gap:12px"><span class="tag ok" style="font-size:14px;padding:6px 14px">${ic('check', 16, 3)} All new copies reviewed</span><h2>Nothing left to review</h2><p class="muted" style="margin:0;max-width:52ch">The ones you marked as stolen are checked every week to see they are still online. Save their evidence reports from All copies found.</p><div class="row" style="justify-content:center">${HIST.length ? `<button class="btn" data-act="undo">↶ Undo: ${esc(HIST[HIST.length - 1].label)}</button>` : ''}<a class="btn primary" href="#found">All copies found</a></div></section>`;
  state.qi = Math.min(state.qi, Q.length - 1);
  const c = Q[0];
  const p = FCD.photos.get(c.photo);
  const o = FCD.ownerOf.get(c.site);
  const id = p && p.hash ? await PP_EVIDENCE.matchId(p.hash, c.url) : '';
  state.rvCurrent = c.id;
  const pics = state.cmpMode === 'swipe'
    ? `<div class="swipe" id="swipe" style="--cut:${state.cut}%"><img data-our="${esc(c.photo)}" src="${oursImg(p)}" alt="Your client's photo"><img class="top-img" src="${theirImg(c)}" alt="Their copy" referrerpolicy="no-referrer"><div class="handle"></div><span class="l1">Your client's</span><span class="l2">Their copy</span></div>
      <input type="range" min="0" max="100" value="${state.cut}" id="cut" aria-label="Slide between your client's photo and their copy">`
    : `<div class="pair"><div class="frame ours"><img data-our="${esc(c.photo)}" src="${oursImg(p)}" alt="Your client's photo" style="object-fit:contain"><span class="lab">Your client's</span></div><div class="frame theirs"><img src="${theirImg(c)}" alt="Their copy" referrerpolicy="no-referrer" style="object-fit:contain"><span class="lab">Their copy</span></div></div>`;
  // How far along you are: counted from the most copies this visit has seen waiting.
  state.rvStart = Math.max(state.rvStart || 0, Q.length);
  const at = state.rvStart - Q.length + 1;
  return `${hd}
  <div class="rvtop">${tabs}
    <div class="rvprog" aria-label="Review progress"><div class="bar"><i style="width:${Math.max(2, (at - 1) / state.rvStart * 100)}%"></i></div><b class="num">${at.toLocaleString()} of ${state.rvStart.toLocaleString()}</b>${c.skipped ? '<span class="faint">skipped before</span>' : ''}</div>
    <button class="btn" data-act="undo"${HIST.length ? ` title="Undo: ${esc(HIST[HIST.length - 1].label)}"` : ' disabled data-why="Nothing to undo yet. After you answer a copy, Undo puts it back."'}>${ic('undo', 16)} Undo <span class="kbd">U</span></button>
    <div class="seg" role="radiogroup" aria-label="View">${[['side', 'Side by side'], ['swipe', 'Swipe']].map(([k, l]) => `<button role="radio" aria-checked="${state.cmpMode === k}" class="${state.cmpMode === k ? 'on' : ''}" data-act="cmode" data-v="${k}">${l}</button>`).join('')}</div></div>
  <div class="split rv">
    <section class="card pad review-cap" style="flex:3 1 560px;display:flex;flex-direction:column;gap:14px" aria-label="Your client's photo and their copy">
      ${pics}
      <div class="rvsite"><div class="l1">${isSoc(c) ? `${platBadge(c, 26)}<h2>${c.acct ? acctHtml(c.acct) : '<span style="color:var(--warn)">Account not found yet</span>'}</h2><span class="muted">${esc(postWord(c))}</span>` : `<h2>${esc(c.site)}</h2>`}<span class="tag ${c.match === 'same' ? 'bad' : 'warn'}">${c.match === 'same' ? 'Same photo' : 'Maybe'}${c.pct >= 0 && c.pct != null ? ' · ' + c.pct + '% lines up' : ''}</span>${knownTag(c)}${spamTag(c)}${repeatTag(c)}${flagWords(c)}</div>
        <a class="curl" href="${safeUrl(c.url)}" target="_blank" rel="noreferrer" title="Open this page in a new tab"><span>${esc(String(c.url || '').replace(/^https?:\/\/(www\.)?/, ''))}</span>${ic('ext', 13)}</a>
        <div class="l3">${esc(c.photoName)} · ${esc(c.clientName || 'Client unknown')} · ${esc(FC.USE[c.use][0])} · found ${shortDate(c.firstSeen).toLowerCase()}</div></div>
      ${c.repeat ? `<div class="banner warn" style="padding:8px 12px;font-size:13.5px"><span><b>${isSoc(c) ? 'Known account.' : 'Repeat offender.'}</b> You already marked ${plural(c.repeat, 'copy', 'copies')} ${isSoc(c) ? 'by' : 'on'} ${esc(c.repeatWho)} as Stolen. These come first.</span></div>` : ''}
      <div class="rvans" role="group" aria-label="Your answer">
        <button class="stolen" data-act="rverdict" data-v="stolen"><b>Stolen</b><span class="kbd">Y</span></button>
        <button class="licensed" data-act="rverdict" data-v="licensed" title="OK for ${esc(c.clientName || 'this client')} only"><b>Licensed</b><span class="kbd">L</span></button>
        <button data-act="rverdict" data-v="removed" title="Not wanted: hide it"><b>Remove</b><span class="kbd">N</span></button>
        <button data-act="rverdict" data-v="skip" title="Decide later"><b>Skip</b><span class="kbd">→</span></button>
      </div>
      <div class="row rvmore"><button class="btn" data-act="rvcompare">${ic('layers', 16)} Compare</button><button class="btn" data-act="evidence" data-v="${esc(c.id)}">${ic('doc', 16)} Evidence report</button><button class="btn" data-act="rvcapture">${ic('capture', 16)} Capture</button>
        ${isSoc(c) && !c.acct ? `<a class="btn" href="#found?open=${encodeURIComponent(c.id)}">${ic('who', 16)} Set the account</a>` : ''}
        <details class="rvok"${isSoc(c) && !c.acct ? ' hidden' : ''}><summary class="btn">${ic('check', 16)} Approve ${isSoc(c) ? 'account' : 'site'}</summary><div class="tmenu">${c.clientName ? `<button data-act="rvapprove" data-v="client"><b>For ${esc(c.clientName)} only</b><span>${esc(FC.baseOf(c.site))} may use this client's photos</span></button>` : ''}<button data-act="rvapprove" data-v="all"><b>For every client</b><span>${esc(FC.baseOf(c.site))} may use any photo</span></button></div></details>
        <details class="rvok"><summary class="btn">${ic('ban', 16)} Hide ${isSoc(c) ? 'account' : 'site'}</summary><div class="tmenu">${hideChoices(c).map(([v, l, d]) => `<button data-act="rvhide" data-v="${esc(v)}"><b>${esc(l)}</b><span>${esc(d)}</span></button>`).join('')}</div></details></div>
    </section>
    <aside class="card pad" style="flex:2 1 340px;display:flex;flex-direction:column;gap:16px" aria-label="About this copy">
      ${isSoc(c) ? postCard(c) : pageBoxHtml(c)}
      <dl class="facts">
        <dt>Your client's photo</dt><dd>${esc(c.photoName)}<br><span class="muted">${p && p.w ? p.w + ' × ' + p.h + ' · ' : ''}${esc(c.clientName || 'Client unknown')}</span></dd>
        <dt>Their copy</dt><dd>${c.w ? c.w + ' × ' + c.h : 'Size not known'} · ${esc(FC.USE[c.use][0])}</dd>
        <dt>Found by</dt><dd>${esc(c.by || 'a search')} · ${shortDate(c.firstSeen)}</dd>
        <dt>History</dt><dd>${c.times > 1 ? 'Seen ' + c.times + ' times, last ' + shortDate(c.lastSeen) : 'First time seen'}</dd>
        <dt>Site check</dt><dd>${RISK[c.risk.level][0]}${c.risk.why.length ? ' · ' + esc(c.risk.why.join(', ')) : ''}</dd>
        ${o && o.real ? `<dt>Company</dt><dd>${esc(o.name)}${o.sites.length > 1 ? `<br><span class="muted" style="font-size:13px">${Q.filter(x => o.sites.includes(x.site)).length} new copies on their sites. Use "By site and company" to mark them all at once.</span>` : ''}</dd>` : ''}
        ${id ? `<dt>Match ID</dt><dd class="mono">${id}</dd>` : ''}
      </dl>
    </aside>
  </div>
  <p class="faint" style="font-size:13px;margin:0">Keys: <span class="kbd">Y</span> stolen <span class="kbd">L</span> licensed <span class="kbd">N</span> remove <span class="kbd">→</span> skip <span class="kbd">U</span> undo <span class="kbd">S</span> switch view <span class="kbd">?</span> all keys</p>`;
};
V.review.guard = V.found.guard;
V.review.after = () => {
  loadOurs();
  const cut = document.getElementById('cut');
  if (cut) cut.oninput = () => { state.cut = +cut.value; document.getElementById('swipe').style.setProperty('--cut', cut.value + '%'); };
  ppPagePic();
  socQueue(); infoQueue();
};
Object.assign(ACTS, {
  rvtab: v => { state.rvTab = v; render(true); },
  cmode: v => { state.cmpMode = v; render(true); },
  rverdict: async v => {
    const c = FCD && FCD.copies.find(x => x.id === state.rvCurrent);
    if (!c || answering) return;
    answering = true;
    try {
      if (v === 'stolen') { v = await ruleGate(c); if (!v) return; }
      await answerCopies([c.id], v, c.site + ' ' + VERB[v]);
      toastUndo(c.site + ' ' + VERB[v] + '.');
      await render(true);
    } finally { answering = false; }
  },
  rvall: async v => {
    const ids = v.split('\n').filter(Boolean);
    await answerCopies(ids, 'stolen', plural(ids.length, 'copy', 'copies') + ' marked stolen');
    toastUndo(plural(ids.length, 'copy', 'copies') + ' marked stolen.'); render(true);
  },
  rvcompare: () => { state.open = state.rvCurrent; return ACTS.compare(); },
  // The same Capture and Approve site as the details panel, for the copy on screen here.
  rvcapture: async () => { state.open = state.rvCurrent; try { await ACTS.capturecopy(); } finally { state.open = ''; } },
  // 4.7: hide a site or account from One at a time; the next copy shows, Undo brings it back.
  rvhide: async v => { await hideSite(v); await render(true); },
  rvapprove: async v => { state.open = state.rvCurrent; try { await ACTS.approvesite(v); } finally { state.open = ''; } },
});

// Keyboard: answers in the details panel and on Review.
document.addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) return;
  if (document.querySelector('dialog[open]')) return;
  const r = route();
  if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) { if (HIST.length && ['found', 'review', 'owners'].includes(r)) { e.preventDefault(); undoLast(); } return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const map = { y: 'stolen', l: 'licensed', n: 'removed', Delete: 'removed', ArrowRight: 'skip' };
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  // 4.15: holding a key down gives ONE answer, not one copy after another.
  if (e.repeat && (map[k] || k === 'u')) { e.preventDefault(); return; }
  if (k === 'u' && HIST.length && ['found', 'review'].includes(r)) { e.preventDefault(); undoLast(); return; }
  if (r === 'found' && state.open) {
    if (k === 'Escape') { state.open = ''; render(true); return; }
    const c = FCD && FCD.copies.find(x => x.id === state.open);
    if (map[k] && c && c.status !== 'removed') { e.preventDefault(); drawerVerdict(map[k]); }
  } else if (r === 'review' && state.rvTab === 'review') {
    if (map[k]) { e.preventDefault(); ACTS.rverdict(map[k]); }
    else if (k === 's') { state.cmpMode = state.cmpMode === 'side' ? 'swipe' : 'side'; render(true); }
  }
});

// Shown on Find copies pages when Google Drive can't be reached or needs a click.
async function driveBanner() {
  const st = await FC.driveStateSoft();
  if (st === 'prompt') return `<div class="banner warn" role="alert">${ic('help', 22)}<div style="flex:1 1 260px;min-width:0"><b>One click needed: let PageProof read your photos again</b><div style="font-size:13.5px">Your browser asks once after it restarts. Searching waits until you press Allow. If the browser offers "Allow on every visit", pick that and it stops asking.</div></div><button class="btn primary" data-act="driveallow">Allow</button></div>`;
  if (st === 'offline') {
    const w = (await api.storage.local.get('fcDriveWhy')).fcDriveWhy;
    return `<div class="banner bad" role="alert">${ic('help', 22)}<div style="flex:1 1 260px;min-width:0"><b>Google Drive isn't answering. Searching is paused.</b><div style="font-size:13.5px;color:var(--ink)">Drive for desktop is signed out, not running, or stuck. If it stays like this, quit Google Drive from the icon near the clock and open it again, or pick the photos folder again. Nothing is lost: searching picks up where it left off.</div>${w && w.why ? `<div class="mono" style="font-size:12.5px;margin-top:6px;color:var(--muted)">What happened: ${esc(w.why)}</div>` : ''}</div><button class="btn primary" data-act="driveretry">Try again</button><button class="btn" data-act="drivepick">Pick the photos folder again</button></div>`;
  }
  return '';
}
Object.assign(ACTS, {
  driveallow: async () => {
    const ok = await FC.allowDrive();
    if (ok) { toast('Thanks. PageProof can read your photos again.'); api.storage.local.set({ fcNeedsAllow: 0 }).catch(() => {}); await FC.driveStateSoft(true); }
    await render(true);
    // Today's batch was waiting for this click.
    if (ok && state.wantFifty) { state.wantFifty = false; ACTS.fifty(); }
  },
  drivepick: async () => {
    // Same top folder as before (for example H:\\Shared drives): your ticked folders and photos stay.
    try { await FC.pickRoot(); } catch (e) { if (e.name !== 'AbortError') toast('That folder could not be opened.'); return; }
    try { await api.storage.local.remove('fcTreeCache'); } catch (e) { /* none */ }
    const st = await FC.driveStateSoft(true);
    toast(st === 'granted' ? 'Google Drive is back. Searching carries on.' : 'Still can\'t reach Google Drive. The red bar says what happened.');
    render(true);
  },
  driveretry: async () => { const st = await FC.driveStateSoft(true); toast(st === 'granted' ? 'Google Drive is back. Searching carries on.' : 'Still can\'t reach Google Drive.'); render(true); },
});

// 4.7: the picture slider moves as you drag; the little dropdowns close when you click elsewhere.
document.addEventListener('input', e => {
  const r = e.target.closest && e.target.closest('[data-act="dslide"]');
  if (r) { state.slide = Number(r.value) || 50; r.parentElement.style.setProperty('--cut', state.slide + '%'); }
});
document.addEventListener('click', e => {
  document.querySelectorAll('details.ddw[open]').forEach(d => { if (!d.contains(e.target)) d.open = false; });
}, true);
document.addEventListener('toggle', e => {
  const d = e.target;
  if (d.matches && d.matches('details.ddw') && d.open) document.querySelectorAll('details.ddw[open]').forEach(x => { if (x !== d) x.open = false; });
}, true);
