// Find copies › All copies found, the copy details panel, and Review new copies.
// Every copy found by every search, Keep searching and today's 50, with your answer for each
// (Stolen, Licensed, Remove, Skip), undo for every answer, hiding sites and countries, and
// grouping by client, photo, site or site owner.
Object.assign(state, {
  open: '', picked: [], fFilter: 'New', fq: '', fWhen: 'any', fMatch: 'any', fYear: 'Any', fQuarter: 'Any', fPhoto: '', sis: null, fView: 'client', fSort: 'act', fClient: 'Any', fUse: 'Any', fRisk: 'Any', fCredit: 'Any', fShop: false, fRepeat: false, fStrong: false, fVia: '', fKnown: '', fSpam: 'hide', fOwner: '', fPop: 'Any',
  showFilters: false, fFresh: false, dTab: 'sum', dTabFor: '', dView: '', slide: 50, fCols: null, exp: [], more: 250, qi: 0, cmpMode: 'side', cut: 50, rvTab: 'review', recentHides: [],
});
const HIST = [];         // every answer and hide, newest last, so each one can be undone in turn
let FCD = null;          // what's loaded from the copies database (cleared when anything changes)
// A change elsewhere (Keep searching, the picture rebuild, another tab) only marks it stale: the
// next draw reads it again, but a click in between still finds its copy. (Clearing it outright
// made a button press do nothing until the page was drawn again, 4.6.4.)
let FCD_STALE = false;
api.storage.onChanged.addListener(ch => { if (ch.fcChanged || ch.rsHidden || ch.rsAllowed || ch.rsStolen || ch.fcShownCountries || ch.ppSocialSites) FCD_STALE = true; });

const STATUS = { new: ['New', 'copy'], later: ['Check later', 'blue'], stolen: ['Stolen', 'bad'], licensed: ['Licensed', 'ok'], removed: ['Removed', 'grey'] };
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
  // While a read is under way, wait for it: FCD is still the old list until that read lands
  // (answering fast on a big library could otherwise draw the copy you just answered again).
  if (FCD && !FCD_STALE && !FCD_P) return Promise.resolve(FCD);
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
  const facts = new Map(sites.filter(f => !f.partial).map(f => [f.site, f]));   // partial = only the country was read (4.56.1)
  const ccOf = new Map(sites.filter(f => f.cc).map(f => [f.site, f]));
  const regs = (await FC.meta.get('regs')) || {};
  for (const c of copies) {
    if (PEND.has(c.id)) c.status = PEND.get(c.id);   // answered a moment ago, still being saved
    if (!STATUS[c.status]) c.status = 'new';     // a line edited by hand in found-copies.txt
    c.risk = FC.riskOf(c, facts.get(c.site));
    c.use = FC.useOf(c);          // 4.9: worked out again each time (your social-site choices can change it)
    if (!c.country) c.country = FC.countryOf(c.site);   // copies brought back from found-copies.txt had none
    if (!c.country && ccOf.has(c.site) && !isSoc(c)) { c.country = ccOf.get(c.site).cc; c.countryHow = ccOf.get(c.site).ccHow; }   // 4.56.1: read from the site's page
    const p = photos.get(c.photo);
    c.photoName = p ? p.name : c.photoName || 'Photo';
    c.clientName = (p && p.client) || c.client || '';
    // 4.7: the Damages column. No publish date (an odd file name) means no damages answer at all.
    const pub = PP_CHECKS.pubDate(p);
    c.dmg = pub ? PP_CHECKS.damages(pub, regSync(p, regs)) : null;
  }
  // 4.58: how popular each website is (Tranco top 1 million list, kept on this computer).
  if (typeof PP_BAD !== 'undefined') await PP_BAD.prepare(copies.filter(c => !isSoc(c)).map(c => c.site)).catch(() => {});
  const popR = typeof PP_POP !== 'undefined' ? await PP_POP.ranks(copies.filter(c => !isSoc(c)).map(c => c.site)).catch(() => new Map()) : new Map();
  for (const c of copies) { c.pop = !isSoc(c) && popR.has(c.site) ? popR.get(c.site) : null; c.popL = typeof PP_POP !== 'undefined' ? PP_POP.level(c.pop) : -1; c.bad = !isSoc(c) && typeof PP_BAD !== 'undefined' ? PP_BAD.of(c.site, c.pop) : null;
    if (c.bad) { c.risk = { ...c.risk, level: 'sus', why: [c.bad.label, ...(c.risk.why || []).filter(w => w !== c.bad.label)] }; }
    // 4.92: a site in the top 100,000 of the popularity list is never "Worth a look".
    else if (c.risk.level === 'watch' && c.pop && c.pop <= 100000) c.risk = { ...c.risk, level: 'ok' }; }
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
  await FC.goneLoad();
  const spam = FC.spamMarks(copies);
  for (const c of copies) c.spam = spam.get(c.id) || null;
  // Websites of new copies not checked yet: does the site still exist? Checked once each, in the background.
  FC.checkGone(copies).then(n => { if (n) { FCD_STALE = true; if (state.shown === 'found') renderAuto(); } }).catch(() => {});
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
const theirImg = c => !c.img && !c.thumb && c.coverImg ? safeImg(c.coverImg) : c.thumb ? safeImg(c.thumb) : c.th ? (FC.pics.seen(c.id) || lazyPic(c, safeImg(c.img))) : safeImg(c.img);
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
    (state.fRisk === 'Any' || c.risk.level === state.fRisk) && (state.fCredit === 'Any' || (c.credit || '') === state.fCredit) && (!state.fShop || c.use === 'shop') && (!state.fRepeat || (c.repeat > 0 && c.status === 'new')) && (!state.fKnown || (state.fKnown === 'only' ? c.known : !c.known)) && (state.fSpam !== 'only' || !!c.spam) && popPass(c) &&
    (!state.fOwner || (FCD.ownerOf.get(c.site) || {}).key === state.fOwner) && (state.fPlat === 'Any' || platOf(c).key === state.fPlat) &&
    (!state.fAcct || (state.fAcct === '~' ? !c.acct : !!c.acct && acctGroup(c.acct.key) === acctGroup(state.fAcct))) && (!state.fFresh || (c.dmg && c.dmg.end && Date.now() <= c.dmg.end.getTime())) && (!isSoc(c) || passAcct(c)) && passMore(c);
}
// 4.58: site popularity filter. Top 10K also shows the Top 1K sites, and so on.
const POPF = { '1k': 4, '10k': 3, '100k': 2, '1m': 1 };
function popPass(c) {
  if (state.fBad && !c.bad) return false;
  if (!state.fPop || state.fPop === 'Any') return true;
  if (state.fPop === 'small') return c.popL === 0;
  return c.popL >= (POPF[state.fPop] || 0);
}
const POP_LABEL = { '1k': 'Top 1K sites', '10k': 'Top 10K sites', '100k': 'Top 100K sites', '1m': 'Top 1M sites', small: 'Small sites' };
// The popularity tag on a row (Top 1K to Top 1M; small sites get none, to keep rows quiet),
// and the red tag for a site on a known bad site list.
function popTag(c) {
  let h = '';
  if (c.bad) h += `<span class="tag bad" title="${esc(c.bad.why)}">${esc(c.bad.label)}</span>`;
  if (c.popL >= 1 && typeof PP_POP !== 'undefined') {
    const t = PP_POP.tier(c.pop);
    h += `<span class="tag poptag${c.popL >= 3 ? ' big' : ''}" title="${esc(t.why)} From the Tranco list.">${c.popL >= 3 ? '★ ' : ''}${t.label}</span>`;
  }
  return h;
}
// The newer filters: the search box, found when, how strong the match is, photo year and quarter.
function passMore(c) {
  if (state.fPhoto && c.photo !== state.fPhoto) return false;
  if (state.fVia && c.via !== state.fVia) return false;          // Credit search / Watching: what they found
  // 4.45: "Look at these first" on Home (strong claims).
  if (state.fStrong && !(typeof FC_RULES !== 'undefined' && FC_RULES.isStrong(c))) return false;
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
  if (f === 'Not finished') return typeof clOpen === 'function' && clOpen(c);   // claim steps not done (pp-claim.js)
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
    if (pf && pf.paced) return c.pf && c.pf.ok ? c.pf : pf;     // 4.64: Instagram has to wait: read again later
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
    // 4.50: this quiet tab is in the background, where pictures waiting to be scrolled into view
    // never load: they are told to load straight away.
    try { for (const i of document.querySelectorAll('img[loading="lazy"]')) i.loading = 'eager'; } catch (e) { /* fine */ }
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
  } catch (e) { if (e && e.paced) { c._paced = true; return { held: true }; } return null; } finally { if (tab) PP_SOCIAL.closeQuiet(tab); }
}
// How PageProof is doing: how many post checks ran, how long, and how many could not read the post.
async function postCheck(c, opts = {}) {
  const t0 = Date.now(), r = await postCheckNow(c, opts);
  if (r && typeof PP_STATS !== 'undefined') { PP_STATS.add('job.post.n'); PP_STATS.add('job.post.' + (r.state === 'unknown' ? 'fail' : 'ok')); PP_STATS.time('job.post', Date.now() - t0); }
  return r;
}
async function postCheckNow(c, opts = {}) {
  if (POST_BUSY.has(c.id) || typeof PP_ALIGN === 'undefined') return null;
  // 4.64 (Ben): the site is resting after "too many requests": checked again after the rest.
  if (globalThis.PP_PACE && PP_PACE.resting(c.url)) { c._paced = true; return null; }
  POST_BUSY.add(c.id);
  let ours = null;
  try {
    const pf = c.pf && c.pf.ok && 'pic' in c.pf ? c.pf : await readTheirPage(c, true).catch(() => null);
    if (pf && pf.paced) { c._paced = true; return null; }
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
    else if (c.status === 'new' && !/by hand/.test(c.by || '') && ((res.state === 'notSeen' && res.browser === 'notSeen' && notInPost(c))
      // 4.52 (Ben): a post whose cover is another picture stays only if the post check finds the photo.
      || (c.cover && res.state !== 'seen' && !/^https?:/i.test(c.img || '')))) {
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
// 4.50: a post the search site listed whose cover is another picture (a carousel, an album, slides).
// 4.52: a website Maybe under 60% nobody has a reason to look at first (see the list below).
const WEAK_MAYBE = 60;
const weakMaybe = c => c.status === 'new' && c.match === 'maybe' && c.pct != null && c.pct >= 0 && c.pct < WEAK_MAYBE && !isSoc(c) && !c.repeat && !c.known && !c.rescued && !c.cover;
const coverWait = c => !!c.cover && isSoc(c) && (!c.postChk || c.postChk.v !== POSTCHK_V);
const COVER_WAIT = 'The search site listed this post for your photo, but its first picture is a different one. PageProof looks at every picture of the post in your browser, and keeps it only if your photo is one of them.';
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
  if (legal && typeof ppEntLegal === 'function') { const e = ppEntLegal(c); if (e) legal.push(e); }    // 5d: an active company found
  const ready = legal ? legal.filter(x => x[0] === true).length : 0;
  const fix = { capture: 'Capture', kind: 'Pick', readpage: 'Read it', who: 'Find it' };
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
  if (linkCardOf(c)) s.push(['bad', 'warn', 'Only in a link preview: ' + LINK_CARD(c), 'Link preview only']);
  else if (notInPost(c)) s.push(['bad', 'warn', 'Not seen in the post: ' + NOT_IN_POST(c), 'Not in the post']);
  else if (coverWait(c)) s.push(['warn', 'maybe', COVER_WAIT, 'Checking the post']);
  if (c.match === 'maybe') s.push(['warn', 'maybe', 'Maybe the same photo. Look closely.', 'Maybe the same']);
  if (c.risk.level === 'sus') s.push(['bad', 'warn', 'Suspicious site' + (c.risk.why.length ? ': ' + c.risk.why.join(', ') : ''), 'Suspicious site']);
  else if (c.risk.level === 'watch') s.push(['warn', 'warn', 'Worth a look' + (c.risk.why.length ? ': ' + c.risk.why.join(', ') : ''), 'Worth a look' + (c.risk.why.length ? ': ' + FC.riskShort(c.risk.why) : '')]);
  if (c.credit === 'removed') s.push(['copy', 'nocredit', 'Credit removed: your client\'s photo has a copyright line in its hidden data and their copy does not', 'Credit removed']);
  if (c.repeat && c.status === 'new' && !isSoc(c)) s.push(['bad', 'repeat', `Repeat offender: you already marked ${c.repeat} ${c.repeat === 1 ? 'copy' : 'copies'} on ${c.repeatWho} as Stolen`, 'Stolen before']);
  if (c.use === 'shop') s.push(['ok', 'shop', 'Selling something: a shop page, product listing or ad', 'Selling it']);
  return s;
}
const knownTag = c => c.known ? '<span class="tag bad" style="font-size:11.5px" title="This exact page is on your list of links stolen before (Settings › Site lists › Stolen before links)">Stolen before</span>' : '';
const spamTag = c => !c.spam ? '' : c.spam[0] === FC.GONE_WHY ? `<span class="tag grey" style="font-size:11.5px" title="This website no longer exists: its address leads nowhere">Site gone</span>` : `<span class="tag grey" style="font-size:11.5px" title="${esc('Looks like a spam blog: ' + c.spam.join(', '))}">Spam blog</span>`;
const sigIcons = c => { const s = signals(c); return knownTag(c) + spamTag(c) + (s.length ? `<span class="sig">${s.map(([col, i, t, w]) => `<span class="tag ${col}" title="${esc(t)}">${ic(i, 13)}<span>${esc(w || t)}</span></span>`).join('')}</span>` : ''); };
// Before a copy is marked Stolen: the kind of site (once per site) and the rules that apply.
// Resolves 'stolen', 'removed' (Remove instead) or null (cancelled).
async function ruleGate(c) {
  const kinds = await siteKinds();
  // Only ask when a Stop rule applies (for the kind you saved, or else PageProof's guess). Warn rules stay
  // in the details panel, so everyday copies and embeds go straight through.
  const saved = kinds[FC.baseOf(c.site)] || PP_CHECKS.guessKind(c, c.pf) || '';
  if (!PP_CHECKS.rules(c, saved, c.pf).some(h => h.lvl === 'stop')) return 'stolen';
  if (!c.pf && !PF_BUSY.has(c.id)) readTheirPage(c).then(() => { if (state.open === c.id) renderAuto(); }).catch(() => {});
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
// Calm look: a picture address short enough for one line: the site, then the file name.
const shortPic = u => { const t = String(u || '').replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, ''); const parts = t.split('/'); return parts.length > 3 ? parts[0] + '/…/' + parts[parts.length - 1].slice(-48) : t.slice(0, 80); };
// Calm look: three tabs. "Their page" went: its title, other addresses and hidden data are in This copy.
const DTABS = [['sum', 'This copy'], ['claim', 'Claim'], ['site', 'The site']];
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
  const [kinds, logR] = await Promise.all([siteKinds(), api.storage.local.get(['log', 'fcReports']).catch(() => ({}))]);
  const kind = kinds[FC.baseOf(c.site)] || '';
  const pub = PP_CHECKS.pubDate(p);
  const hits = PP_CHECKS.rules(c, kind, c.pf);
  const capturedAt = [c.url, ...(c.alts || [])].map(u => PP_CHECKS.captureOf(logR.log, u)).find(Boolean) || c.packAt || null;
  if (typeof acctOnOpen === 'function' && isSoc(c) && c.acct) acctOnOpen(c).then(r => { if (r && state.open === c.id) { FCD_STALE = true; renderAuto(); } }).catch(() => {});
  if (needsPostCheck(c) && !POST_BUSY.has(c.id)) postCheck(c).then(() => { if (state.open === c.id) renderAuto(); }).catch(() => {});
  else if (!c.pf && !PF_BUSY.has(c.id)) readTheirPage(c).then(() => { if (state.open === c.id) renderAuto(); }).catch(() => {});
  const ck = checksParts(c, reg, kind, hits, pub, capturedAt);
  // Stolen: the claim steps (pp-claim.js) sit right under the pictures.
  const clx = { p, reg, kind, hits, capturedAt, f, reports: logR.fcReports || [] };
  const clHtml = c.status === 'stolen' && typeof clCard === 'function' ? await clCard(c, clx) : '';
  const clOn = c.status === 'stolen' && typeof clOpen === 'function' && clOpen(c);
  const sz = c.w && p && p.w ? (Math.abs(c.w / c.h - p.w / p.h) / (p.w / p.h) > 0.06 ? 'cropped' : (c.w * c.h) / (p.w * p.h) > 1.15 ? 'bigger than your client\'s' : (c.w * c.h) / (p.w * p.h) < 0.85 ? 'smaller' : 'same size') : '';
  const idx = list.indexOf(c.id);
  const last = HIST[HIST.length - 1];
  // "Look at these": only problems, each with where to go next. The rest folds into one green line.
  const look = [], fine = [];
  if (linkCardOf(c)) look.push(['bad', 'warn', 'Only in a link preview', LINK_CARD(c), 'openpost', 'Open post']);
  else if (notInPost(c)) look.push(['bad', 'warn', 'Not seen in the post', NOT_IN_POST(c), 'openpost', 'Open post']);
  else if (coverWait(c)) look.push(['warn', 'maybe', 'Checking the post', COVER_WAIT, 'openpost', 'Open post']);
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
  if (!c.clientName) look.push(['warn', 'who', 'Client unknown', 'Set the client in the This copy tab.', 'dtab', 'This copy', 'sum']);
  const lookN = look.filter(x => x[0] !== 'grey').length;
  const dot = { page: c.credit === 'removed', claim: hits.some(h => h.lvl !== 'info') || (ck.dmg && ck.dmg.lvl !== 'ok'), site: c.risk.level !== 'ok' || (c.repeat && c.status === 'new'), acct: !c.acct || (c.repeat && c.status === 'new') };
  const tabs = soc ? [['sum', 'This copy'], ['page', 'The post'], ['acct', 'Account'], ['claim', 'Claim']] : DTABS;
  if (!soc && dot.page) dot.sum = true;
  if (!tabs.some(t => t[0] === state.dTab)) state.dTab = 'sum';
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
  return `<aside class="drawer calm" aria-label="Copy details" id="drawer"${state.drawerW ? ` style="--dw:${state.drawerW}px"` : ''}><i class="dgrip" id="dgrip" title="Drag to make the panel wider or narrower" aria-hidden="true"></i>
  <div class="dhead"><b class="dtitle">${esc(soc ? platOf(c).name : c.site)}</b>${tagFor(c)}<span style="flex:1"></span><button class="btn sm icon" data-act="closedrawer" aria-label="Close">✕</button></div>
  <div class="dscroll" id="dscroll">
  <div class="dsite${soc ? '' : ' web'}">${soc ? `<div class="row" style="gap:10px;flex-wrap:nowrap">${platBadge(c, 30)}<div style="min-width:0"><h2 style="overflow-wrap:anywhere">${c.acct ? acctHtml(c.acct) : '<span style="color:var(--warn)">Account not found yet</span>'}</h2><div class="muted" style="font-size:12.5px">${esc(postWord(c))}${c.acct ? ` · <a href="${safeUrl(c.acct.url)}" target="_blank" rel="noreferrer">Open account ${ic('ext', 12)}</a>` : ` · <a href="#" data-act="dtab" data-v="acct">Set account</a>`}</div></div></div>` : ''}<a class="curl" href="${safeUrl(c.url)}" target="_blank" rel="noreferrer" data-act="openlink"><span>${esc(String(c.url || '').replace(/^https?:\/\/(www\.)?/, ''))}</span>${ic('ext', 13)}</a></div>
  <div class="dview">${viewer}</div>
  ${view === 'side' ? `<div class="calm-caps"><span><b>Your client's</b>${p && p.w ? ` · ${p.w} × ${p.h}` : ''}</span><span><b>Theirs</b>${c.w ? ` · ${c.w} × ${c.h}` : ''}</span></div>` : ''}
  <div class="dvbar"><div class="seg sm" role="radiogroup" aria-label="Picture view">${[['side', 'Side by side'], ['slide', 'Slider'], ['page', soc ? 'The post' : 'Their page']].map(([k, l]) => `<button role="radio" aria-checked="${view === k}" class="${view === k ? 'on' : ''}" data-act="dview" data-v="${k}">${l}</button>`).join('')}</div><button class="btn ghost sm" data-act="compare">${ic('layers', 15)} Compare closely</button></div>
  <div class="dchips factline">${c.pct >= 0 && c.pct != null ? `<span class="fchip" data-gloss="Lines up"><b class="num">${c.pct}%</b> lines up</span>` : ''}<span class="fchip" title="${esc(FC.USE[c.use][1])}">${esc(FC.USE[c.use][0])}</span>${c.country ? `<span class="fchip">${esc(c.country)}</span>` : ''}${sz ? `<span class="fchip">${esc(/^(bigger|smaller)/.test(sz) ? sz.split(' ')[0] + ' copy' : sz)}</span>` : ''}</div>
  ${clHtml}
  <section class="attn${lookN ? ' has' : ''}" id="lookbox"><h3>${lookN ? `${ic('warn', 15)} Look at these (${lookN})` : `${ic('check', 15)} Nothing needs a look${fine.length ? `<span class="okline"> · ${fine.map(esc).join(' · ')}</span>` : ''}`}</h3>
    ${look.map(([col, i, t, s, act, b, v]) => `<div class="it"><span class="ico tag ${col}">${ic(i, 15)}</span><div><b>${esc(t)}</b>${s ? `<span class="lkwhy">${esc(s)}</span><span class="lki" tabindex="0" title="${esc(s)}" aria-label="${esc(s)}">ⓘ</span>` : ''}</div>${act ? `<button class="btn sm" data-act="${act}"${v ? ` data-v="${v}"` : ''}>${b}</button>` : ''}</div>`).join('')}
    ${lookN && fine.length ? `<div class="okline">${ic('check', 14)} ${fine.map(esc).join(' · ')}</div>` : ''}</section>
  <div class="dtabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}" data-act="dtab" data-v="${k}">${l}${dot[k] ? '<span class="dot" title="Something to check here"></span>' : ''}</button>`).join('')}</div>
  <div class="dpane" data-tab="sum"${show('sum')}>
    <dl class="facts">
      <dt>Client</dt><dd>${c.clientName ? esc(c.clientName) : `<span style="color:var(--warn);font-weight:600">Client unknown</span> <select data-act="setclient" aria-label="Set the client" style="border:1px solid var(--line);border-radius:6px;background:var(--surface);font-size:13px;padding:2px 4px"><option value="">Set…</option>${clients.map(n => `<option>${esc(n)}</option>`).join('')}</select>`}</dd>
      <dt>Photo</dt><dd>${esc(c.photoName)}<span class="calm-sub">${p && p.w ? `${p.w} × ${p.h}` : ''}${p && p.w && stopRow(c) ? ' · ' : ''}${stopRow(c)}</span></dd>
      ${picLinkRow(c, true)}
      <dt>Seen</dt><dd>${shortDate(c.firstSeen)}${c.lastSeen && c.lastSeen !== c.firstSeen ? ' → ' + shortDate(c.lastSeen) : ''}, ${c.times > 1 ? c.times + ' times' : 'once'}${c.by ? `<br><span class="muted" style="font-size:13px">First found by ${esc(c.by)}${c.engines && c.engines.length ? ' on ' + c.engines.map(e => ({ google: 'Google Lens', yandex: 'Yandex', bing: 'Bing' }[e] || esc(e))).join(', ') : ''}</span>` : ''}</dd>
      <dt>Their picture</dt><dd>${/^https?:/i.test(c.img || '') ? `<a class="picaddr" href="${safeUrl(c.img)}" target="_blank" rel="noreferrer" title="${esc(c.img)}">${esc(shortPic(c.img))}</a><span class="calm-sub"><button class="linkbtn" data-act="copytext" data-v="${esc(c.img)}">Copy</button> · <a href="${safeUrl(c.img)}" target="_blank" rel="noreferrer">Open</a></span>` : `The search site's small preview <span class="muted" style="font-size:13px">(PageProof did not get the picture from their page itself)</span>${!isSoc(c) && c.onPage === 'unknown' ? '<br><span class="muted" style="font-size:13px">Their page could not be read, so this stays a Maybe until you look.</span>' : ''}`}${isSoc(c) ? `<br><span class="muted" style="font-size:13px">${POST_BUSY.has(c.id) || !c.postChk ? 'Checking the post\'s own picture…' : c.postChk.state === 'seen' ? `The post's own picture matches (${c.postChk.pct}% lines up).` : c.postChk.state === 'notSeen' ? `<b style="color:var(--bad)">${c.postChk.browser === 'notSeen' ? 'None of the post\'s pictures is this photo.' : `The post's own ${c.postChk.video ? 'video cover' : 'picture'} is a different photo.`}</b>` : c.postChk.state === 'unsure' ? 'The post\'s picture looks close but not clearly the same. Compare closely.' : 'The post\'s own pictures could not be read (sign in to Facebook or Instagram in this browser so PageProof can look).'}${c.postChk && c.postChk.pic ? ` <a href="${safeUrl(c.postChk.pic)}" target="_blank" rel="noreferrer">See it</a>` : ''}${c.postChk ? ` · <a href="#" data-act="postagain">Check again</a>` : ''}</span>` : ''}</dd>
      ${doubles.length > 1 ? `<dt>Double</dt><dd><div style="border:1px solid var(--accent);background:var(--accent-soft);border-radius:10px;padding:8px 10px;font-size:13.5px"><b>You have ${doubles.length} versions of this photo</b>${doubles.map(d => `<br>${esc(d.name)}${d.w ? ' (' + d.w + ' × ' + d.h + ')' : ''}${d.id === p.id ? ' · <b>this one</b>' : ''}`).join('')}<br><b style="color:var(--copy)">Note them all in the claim.</b></div></dd>` : ''}
      ${soc ? '' : `      ${c.title ? `<dt>Title</dt><dd>${esc(c.title)}</dd>` : ''}
      ${c.alts && c.alts.length ? `<dt>Same page at</dt><dd class="mono altlist" style="font-size:12px;overflow-wrap:anywhere">${c.alts.map(u => `<a href="${safeUrl(u)}" target="_blank" rel="noreferrer">${esc(u)}</a>`).join('<br>')}<div class="faint" style="font-family:inherit;font-size:12px">Other addresses for this one page (phone version, share links). One answer covers them all.</div></dd>` : ''}
      <dt>Hidden data</dt><dd>${c.credit ? CREDIT[c.credit] : `<button class="btn ghost sm" data-act="checkcredit">Check the hidden data</button>`}</dd>`}
    </dl>
    ${keptBoxHtml(c)}
    ${soc ? '' : ck.page}
  </div>
  ${soc ? `<div class="dpane" data-tab="page"${show('page')}>
    <dl class="facts">
      ${c.title ? `<dt>Title</dt><dd>${esc(c.title)}</dd>` : ''}
      <dt>Page</dt><dd class="mono" style="font-size:12px;overflow-wrap:anywhere"><a href="${safeUrl(c.url)}" target="_blank" rel="noreferrer">${esc(c.url)}</a></dd>
      ${c.alts && c.alts.length ? `<dt>Same page at</dt><dd class="mono altlist" style="font-size:12px;overflow-wrap:anywhere">${c.alts.map(u => `<a href="${safeUrl(u)}" target="_blank" rel="noreferrer">${esc(u)}</a>`).join('<br>')}<div class="faint" style="font-family:inherit;font-size:12px">Other addresses for this one page (phone version, share links). One answer covers them all.</div></dd>` : ''}
      <dt>Hidden data</dt><dd>${c.credit ? CREDIT[c.credit] : `<button class="btn ghost sm" data-act="checkcredit">Check the hidden data</button>`}</dd>
    </dl>
    ${ck.page}
    ${soc ? (view !== 'page' || livePage ? postCard(c) : '') : view !== 'page' ? `<button class="btn sm" style="align-self:flex-start" data-act="dview" data-v="page">${ic('eye', 15)} See their page above</button>` : ''}
  </div>` : ''}
  ${soc ? `<div class="dpane" data-tab="acct"${show('acct')}>${acctPane(c)}</div>` : ''}
  <div class="dpane" data-tab="claim"${show('claim')}>
    ${c.status === 'stolen' ? '' : ck.legalBox}
    ${p && p.rel && reg ? `<section class="dsec"><div class="dsh">Copyright registration</div>${regBox(p, reg)}</section>` : ''}
    ${ck.damages}
    ${ck.rules}
    ${p && p.rel ? `<section class="dsec"><div class="dsh">Your client's photo in Drive</div>${pathBox(path)}</section>` : ''}
  </div>
  ${soc ? '' : `<div class="dpane" data-tab="site"${show('site')}>
    <a class="lookup" href="#who" data-act="gowho" data-v="${esc(c.id)}">${ic('owner', 18)}<span><b>Who's behind this site</b><br><span class="muted" style="font-size:13px">${f ? esc(f.names && f.names[0] ? 'Probably ' + f.names[0] : 'Names, contacts and domain facts') : 'Read names, contacts and domain facts off the site'}</span></span><span style="margin-left:auto">${ic('chev', 16)}</span></a>
    <dl class="facts">
      ${o && o.real ? `<dt>Site owner</dt><dd><a href="#owners" data-act="gowner" data-v="${esc(o.key)}" style="font-weight:600">${esc(o.name)}</a><br><span class="muted" style="font-size:13px">${esc(o.kind)}${o.sites.length > 1 ? ' · ' + FCD.copies.filter(x => o.sites.includes(x.site) && x.status !== 'removed').length + ' copies on their sites' : ''}</span></dd>` : ''}
      ${c.bad ? `<dt>Known bad site</dt><dd><b style="color:var(--bad)">${esc(c.bad.label)}</b><br><span class="muted" style="font-size:13px">${esc(c.bad.why)}</span></dd>` : ''}
      ${typeof PP_POP !== 'undefined' && c.pop != null ? `<dt>How popular</dt><dd>${esc(PP_POP.tier(c.pop).label)}${c.pop ? ` <span class="muted">· number ${c.pop.toLocaleString()} in the world</span>` : ''}<br><span class="muted" style="font-size:13px">${c.pop ? 'From the Tranco list of the 1 million most visited websites.' : 'Not in the Tranco list of the 1 million most visited websites.'}</span></dd>` : typeof PP_POP !== 'undefined' && PP_POP.platform(c.site) ? `<dt>How popular</dt><dd>On a big shared platform<br><span class="muted" style="font-size:13px">The platform is huge, but this page belongs to one user or seller, so no rank is shown.</span></dd>` : ''}
      <dt>Site check</dt><dd>${RISK[c.risk.level][0]}${c.risk.why.length ? `<br><span class="muted" style="font-size:13px">${esc(c.risk.why.join(' · '))}</span>` : ''}</dd>
      ${c.country ? `<dt>Country</dt><dd>${esc(c.country)}${c.countryHow ? `<br><span class="muted" style="font-size:13px">From ${esc(c.countryHow)}</span>` : ''}${isSoc(c) ? '' : FCD.countries.includes(c.country) ? ` <button class="btn ghost sm" data-act="hidecountry" data-v="${esc(c.country)}">Stop showing this country</button>` : ` <button class="btn ghost sm" data-act="showcountry" data-v="${esc(c.country)}">Show this country</button>`}</dd>` : ''}
    </dl>
    <details class="hidebox" id="okbox"><summary><b>Is this site allowed to use the photo?</b> <span class="muted" style="font-size:13px">Approve it</span></summary>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
      ${c.clientName ? `<button class="lookup" style="text-align:left;cursor:pointer" data-act="approvesite" data-v="client"><span style="color:var(--ok);display:inline-flex">${ic('check', 20)}</span><span><b>Approved for ${esc(c.clientName)} only</b><br><span class="muted" style="font-size:12.5px">${esc(FC.baseOf(c.site))} may use this client's photos. Other clients' photos there still show as new.</span></span></button>` : ''}
      <button class="lookup" style="text-align:left;cursor:pointer" data-act="approvesite" data-v="all"><span style="color:var(--ok);display:inline-flex">${ic('check', 20)}</span><span><b>Approved for every client</b><br><span class="muted" style="font-size:12.5px">${esc(FC.baseOf(c.site))} may use any client's photos (a partner, a wire service, your own site).</span></span></button>
      <span class="faint" style="font-size:12.5px">Copies on an approved site are marked Licensed by themselves, now and in every later search. Change it in Settings › Site lists.</span></div></details>
    <details class="hidebox" id="hidebox"><summary><b>Don't want results from this site?</b> <span class="muted" style="font-size:13px">Hide it</span></summary>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">${hideChoices(c).map(([v, l, d]) => `<button class="lookup" style="text-align:left;cursor:pointer" data-act="hidesite" data-v="${esc(v)}"><span style="color:var(--bad);display:inline-flex">${ic('ban', 20)}</span><span><b>${esc(l)}</b><br><span class="muted" style="font-size:12.5px">${esc(d)}</span></span></button>`).join('')}
      <span class="faint" style="font-size:12.5px">Hidden sites never show again in any search. Bring them back from Settings › Site lists.</span></div></details>
  </div>`}
  </div>
  <div class="dacts dfoot">
  ${last ? `<button class="undoline" data-act="undo">↶ Undo: ${esc(last.label)}<span class="kbd" style="margin-left:auto">U</span></button>` : ''}
  ${c.status === 'removed' ? `<div class="banner info" style="padding:10px 12px"><span style="flex:1;font-size:14px"><b>Removed</b><br><span class="muted">Hidden from your results. It won't come back for this photo.</span></span><button class="btn" data-act="putback">Put back</button></div>` : `
    ${['stolen', 'licensed'].includes(c.status) ? `<div class="row" style="gap:8px;font-size:13.5px"><span>Your answer: ${tagFor(c)}</span><button class="btn ghost sm" style="margin-left:auto" data-act="changeans">Change answer</button></div>` : ''}
    ${c.status === 'later' ? `<div class="row" style="gap:8px;font-size:13.5px"><span>${tagFor(c)} Answer it when you're ready.</span><button class="btn ghost sm" style="margin-left:auto" data-act="rowans" data-v="new|${esc(c.id)}">Back to New</button></div>` : ''}
    ${clOn ? clFoot(c, clx) : `<div class="dans ansstrip" title="Choose one and the next copy opens here">
      <button class="btn stolen" data-act="dverdict" data-v="stolen" title="Stolen (key Y)"><b>Stolen</b></button>
      <button class="btn licensed" data-act="dverdict" data-v="licensed" title="Licensed (key L)"><b>Licensed</b></button>
      <button class="btn" data-act="dverdict" data-v="removed" title="Remove (key N)"><b>Remove</b></button>
      ${c.status === 'later' ? '' : `<button class="btn later" data-act="dverdict" data-v="later" title="Not sure yet: move it to Check later (key C)"><b>Check later</b></button>`}
      <button class="btn" data-act="dverdict" data-v="skip" title="Skip (key →)"><b>Skip</b></button>
    </div>`}`}
    <div class="dfoot2"><span class="dnav"><button class="btn sm icon" data-act="dstep" data-v="-1" aria-label="Previous copy"${idx > 0 ? '' : ' disabled data-why="This is the first copy in the list."'}>‹</button><span class="muted num">${idx >= 0 ? `${idx + 1} of ${list.length}` : ''}</span><button class="btn sm icon" data-act="dstep" data-v="1" aria-label="Next copy"${idx >= 0 && idx < list.length - 1 ? '' : ' disabled data-why="This is the last copy in the list."'}>›</button></span><span style="flex:1"></span><button class="btn sm primary" data-act="evidence">${ic('doc', 15)} Evidence report</button><button class="btn sm" data-act="capturecopy">${ic('capture', 15)} Capture</button><button class="btn sm" data-act="dmore" data-v="${esc(c.id)}" aria-label="More choices" title="More choices">${ic('dots', 15)}</button></div>
  </div></aside>`;
}

// ---------------------------------------------------------------- All copies found
// Calm look: the title reads "Copies found › All copies" and the Websites / Social media switch
// sits beside it. No help line under the title.
const foundHead = (tabs, right = '') => head('', 'All copies', '', right).replace('</h1>', '</h1>' + tabs).replace('class="head"', 'class="head foundhead"');
// Calm look: the small pictures on the command bar buttons (16 px line drawings).
const cmdIc = p => `<svg class="cmdic" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const CMD = { group: '<rect x="2" y="2.5" width="12" height="4" rx="1"/><rect x="2" y="9.5" width="12" height="4" rx="1"/>', filter: '<path d="M2 3h12L9.5 8.5V13l-3-1.5v-3z"/>', sort: '<path d="M4.5 3v10M2 10.5 4.5 13 7 10.5M11.5 13V3M9 5.5 11.5 3 14 5.5"/>', down: '<path d="M8 2.5v8M4.5 7.5 8 11l3.5-3.5M3 13.5h10"/>', cols: '<rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M6 2.5v11M10 2.5v11"/>' };
// Calm look: the column names sit once at the top of the list. Click one to sort by it; the tick
// box picks every copy showing.
const HSORT = { pct: 'pct', found: 'newest' };
function colHead(rows) {   // rows = the ids of the copies showing
  const K = state.fCols, all = rows.length && rows.every(id => state.picked.includes(id));
  const col = (k, label) => !K[k] || (k === 'client' && state.fView === 'client') ? '' : HSORT[k]
    ? `<span class="cc-${k}"><button class="hsort${state.fSort === HSORT[k] ? ' on' : ''}" data-act="fset" data-v="fSort|${state.fSort === HSORT[k] ? 'act' : HSORT[k]}" title="${state.fSort === HSORT[k] ? 'Sorted by this. Click to go back to Best to act on.' : 'Click to sort by this'}" aria-pressed="${state.fSort === HSORT[k]}">${label}<i aria-hidden="true">${state.fSort === HSORT[k] ? '↓' : '↕'}</i></button></span>`
    : `<span class="cc-${k}"><b>${label}</b></span>`;
  return `<div class="crow calmhdr" id="colHead"><input type="checkbox" class="cpick cpickall" aria-label="Pick every copy showing" title="Pick every copy showing" data-act="pickall" ${all ? 'checked' : ''}><span class="chpair" aria-hidden="true"></span><div class="cinfo"><b>Copy</b></div><div class="ccols">${col('pct', 'Match')}${col('client', 'Client')}${col('dmg', 'Damages')}${col('use', 'How it’s used')}${col('country', 'Country')}${col('found', 'Found')}</div><div class="acts" aria-hidden="true"></div></div>`;
}
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
  if (c.risk.level === 'watch') f.push(['warn', 'Worth a look' + (c.risk.why.length ? ': ' + FC.riskShort(c.risk.why) : ''), c.risk.why.join(', ')]);
  if (c.credit === 'removed') f.push(['copy', 'Credit removed', 'Your client\'s photo has a copyright line in its hidden data and their copy does not']);
  if (c.use === 'shop') f.push(['ok', 'Selling something', 'A shop page, product listing or ad']);
  return f.map(([col, t, why]) => `<span class="tag ${col}" title="${esc(why)}">${t}</span>`).join('');
};
// The row's lined-up columns (4.7). You pick which show (Columns menu); narrow windows drop the
// least needed ones by themselves.
const FCOLS = [['pct', 'Match'], ['client', 'Client'], ['dmg', 'Damages'], ['use', 'How it\'s used'], ['country', 'Country'], ['found', 'Found']];
// UI overhaul: one coloured pill instead of the old number + thin bar. Green = almost surely the same photo.
const luBar = p => p == null || p < 0 ? '<span class="faint">–</span>' : `<span class="mpill ${p >= 80 ? 'hi' : p >= 50 ? 'mid' : 'lo'}" data-gloss="Lines up"><b class="num">${p}%</b> match</span>`;
// UI overhaul: the friendly page when every new copy has an answer.
const caughtUp = (nStolen, nLater = 0) => `<div class="cempty caught" role="status"><span class="cok" aria-hidden="true">${ic('check', 30)}</span><b>All caught up</b>Every new copy has an answer. Keep searching adds new finds here as they come in.
  <div class="row" style="justify-content:center;gap:8px;margin-top:14px">${nLater ? `<button class="btn" data-act="ffilter" data-v="Check later">${ic('clock', 15)} Check later (${nLater})</button>` : ''}${nStolen ? `<button class="btn" data-act="ffilter" data-v="Stolen">See the stolen copies (${nStolen})</button>` : ''}<a class="btn" href="#keep">${ic('find', 15)} Keep searching</a></div></div>`;
// Calm look: a blue dot on copies found since you last opened Copies found.
const isNewSince = c => !!(state.seenAt && c.status === 'new' && c.firstSeen && String(c.firstSeen) > state.seenAt);
const newSince = c => isNewSince(c) ? '<span class="newdot" title="New since you last looked"></span>' : '';
// One copy as a row: both pictures, the site, the page link, quiet warning icons, the columns, and the answer buttons.
function copyRow(c) {
  const p = FCD.photos.get(c.photo), done = c.status !== 'new' && c.status !== 'later', K = state.fCols;
  const cell = (k, label, html) => K[k] && !(k === 'client' && state.fView === 'client') ? `<span class="cc-${k}"><i>${label}</i>${html}</span>` : '';
  return `<div class="frow crow${state.open === c.id ? ' on' : ''}${c.popL >= 3 ? ' bigsite' : ''}" data-act="openrow" data-v="${esc(c.id)}">
    <input type="checkbox" class="cpick" aria-label="Pick ${esc(isSoc(c) && c.acct ? c.acct.handle : c.site)}" data-act="pick" data-v="${esc(c.id)}" ${state.picked.includes(c.id) ? 'checked' : ''}>
    <div class="cpair" data-hover="${esc(c.id)}"><img class="ours" src="${oursImg(p)}" alt="" loading="lazy"><img class="thumb" src="${theirImg(c)}" alt="" loading="lazy" referrerpolicy="no-referrer"></div>
    <div class="cinfo">
      ${isSoc(c) ? socLine(c) : `<div class="l1">${newSince(c)}<b>${esc(c.site)}</b>${popTag(c)}${done || c.status === 'later' ? tagFor(c) : ''}${embedTag(c)}${sigIcons(c)}${c.sweep ? '<span class="tag blue" title="Found by reading this site\'s own list of pictures (a sweep), not by a search site">Found by sweep</span>' : ''}${typeof ppRowTags === 'function' ? ppRowTags(c) : ''}${typeof clRowTag === 'function' ? clRowTag(c) : ''}${c.status === 'removed' && c.removedBy === 'stopped' ? '<span class="tag grey" title="Removed when you stopped searching this photo. Search again on the client\'s photos page brings it back.">Photo stopped</span>' : ''}${c.status === 'removed' && c.removedBy === 'weakmaybe' ? '<span class="tag grey" title="A Maybe under 50% that nobody answered for 30 days. Put back if it is a copy.">Weak Maybe, never answered</span>' : ''}</div>`}
      <a class="curl" href="${safeUrl(c.url)}" target="_blank" rel="noreferrer" data-act="openlink" title="Open this page in a new tab"><span>${esc(String(c.url || '').replace(/^https?:\/\/(www\.)?/, ''))}</span>${ic('ext', 13)}</a>${c.alts && c.alts.length ? `<span class="tag grey altn" title="${esc(c.alts.join('\n'))}" data-gloss="Same page">+${c.alts.length} ${c.alts.length === 1 ? 'address' : 'addresses'}</span>` : ''}
      <div class="l3">${esc(c.photoName)}<span class="l3x">${isSoc(c) && c.acct ? ' · ' + esc(c.site) : ''}${c.pct >= 0 && c.pct != null ? ` · <b class="num" data-gloss="Lines up">${c.pct}%</b> lines up` : ''} · ${esc(FC.USE[c.use][0])}${c.country ? ' · ' + esc(c.country) : ''} · found ${shortDate(c.firstSeen).toLowerCase()}</span></div>
    </div>
    <div class="ccols">${cell('pct', 'Match', coverWait(c) ? '<span class="faint" title="The post\'s cover is another picture. PageProof is opening the post to look at all its pictures.">Checking…</span>' : luBar(c.pct))}${cell('client', 'Client', c.clientName ? `<span title="${esc(c.clientName)}">${esc(c.clientName)}</span>` : '<span style="color:var(--warn);font-weight:600">Unknown</span>')}${K.dmg ? (dmgCell(c) ? `<span class="cc-dmg"><i>Damages</i>${dmgCell(c)}</span>` : '<span class="cc-dmg" aria-hidden="true"></span>') : ''}${cell('use', 'Use', `<span title="${esc(FC.USE[c.use][0])}">${esc(FC.USE[c.use][0])}</span>`)}${cell('country', 'Country', `<span>${esc(c.country || 'Not known')}</span>`)}${cell('found', 'Found', `<span>${esc(shortDate(c.firstSeen))}</span>`)}</div>
    <div class="acts">${c.status === 'removed' ? `<button class="btn sm" data-act="rowans" data-v="new|${esc(c.id)}">Put back</button>` : done && typeof clOpen === 'function' && clOpen(c) ? `<button class="btn sm" data-act="openrow" data-v="${esc(c.id)}" title="Open the claim steps where you left off">Continue</button>` : done ? `<button class="btn sm" data-act="rowans" data-v="new|${esc(c.id)}">Change answer</button>`
      : `<button class="btn sm stolen" data-act="rowans" data-v="stolen|${esc(c.id)}">Stolen</button><button class="btn sm licensed" data-act="rowans" data-v="licensed|${esc(c.id)}">Licensed</button><button class="btn sm" data-act="rowans" data-v="removed|${esc(c.id)}">Remove</button>`}
      <button class="btn sm icon" data-act="rowmenu" data-v="${esc(c.id)}" aria-label="More choices for ${esc(c.site)}">${ic('dots', 18)}</button></div></div>`;
}
// 4.56.1: Country for .com and other sites whose ending says nothing. A few sites at a time are read
// in the background while Copies found is open; the list redraws when some got a country.
// 4.58: the site popularity list and the known bad site lists are downloaded quietly while
// Copies found is open: popularity about once a week, bad sites about once a day.
function popSoon() {
  if (navigator.webdriver) return;   // the automatic checks never download the real lists
  const redraw = r => { if (r && r.n) { dropFC(); if (state.shown === 'found') render(true); } };
  if (typeof PP_POP !== 'undefined' && !PP_POP.busy()) PP_POP.refresh().then(redraw).catch(() => {});
  if (typeof PP_BAD !== 'undefined' && !PP_BAD.busy()) PP_BAD.refresh().then(redraw).catch(() => {});
}
let CC_BUSY = false;
function fillCountriesSoon() {
  if (CC_BUSY || !FCD || !FC.fillCountries) return;
  CC_BUSY = true;
  (async () => {
    for (let round = 0; round < 50; round++) {
      const r = await FC.fillCountries(FCD.copies, 12);
      if (r.found && state.shown === 'found') { FCD_STALE = true; renderAuto(); }
      if (!r.left) break;
      await new Promise(ok => setTimeout(ok, 1500));
    }
  })().catch(e => console.warn('PageProof country:', e)).finally(() => { CC_BUSY = false; });
}
// 4.60 (Ben): the list stays put while you look at it. What is on screen is remembered (which
// copies, in which order). A redraw then never adds new copies (they wait behind the "N new
// copies" button), never re-sorts, and a redraw nobody clicked for (Keep searching, a background
// check) leaves a row in place even when its details changed. Your own answers and hides still
// take a row off at once. Changing a filter, the sort, the tab, or opening the page shows
// everything fresh.
const USER_DONE = new Set();     // copies you answered or hid on this page
let HOLD_NEW = 0;
function holdKey() {
  return JSON.stringify(Object.keys(state).filter(k => (/^[fs][A-Z]/.test(k) || k === 'fq') && k !== 'fCols' && (state[k] == null || typeof state[k] !== 'object')).sort().map(k => [k, state[k]]));
}
function holdRows(rows, draw) {
  const key = holdKey(), z = state.fz;
  HOLD_NEW = 0;
  if (!z || z.key !== key || !draw.keep) {
    state.fz = { key, ids: rows.map(c => c.id), seen: new Set(rows.map(c => c.id)) };
    return rows;
  }
  const rank = new Map(z.ids.map((id, i) => [id, i]));
  const out = [];
  let last = -1, n = 0;
  for (const c of rows) {
    if (!z.seen.has(c.id)) { n++; continue; }          // came in after you opened the list
    const r = rank.has(c.id) ? rank.get(c.id) : last + 0.5;   // Undo puts a copy back where it was
    if (rank.has(c.id)) last = r;
    out.push([r, c]);
  }
  if (draw.auto) {
    // A background change took a copy out of this view (a post check, Site gone, a spam re-check):
    // it stays where it is until you click something.
    const there = new Set(out.map(x => x[1].id)), byId = new Map(FCD.copies.map(c => [c.id, c]));
    for (const id of z.ids) {
      if (there.has(id) || USER_DONE.has(id) || PEND.has(id)) continue;
      const c = byId.get(id);
      if (c) out.push([rank.get(id), c]);
    }
  }
  out.sort((a, b) => a[0] - b[0]);
  HOLD_NEW = n;
  const res = out.map(x => x[1]);
  z.ids = res.map(c => c.id);
  return res;
}
V.found = async () => {
  const draw = state.draw || {};   // set just before this page is drawn: was it a click, or a background redraw?
  const me = RENDER_N;      // a newer redraw started meanwhile: this one is thrown away, so it must not change LIST
  await loadFC();
  fillCountriesSoon();
  popSoon();
  if (!state.fCols || !state.dView) {
    const pr = await api.storage.local.get(['fcCols', 'fcDView', 'fcCalmCols', 'fcDrawerW', 'fcSeenAt']).catch(() => ({}));
    state.fCols = Object.assign({ pct: true, client: true, dmg: true, use: true, country: false, found: true }, pr.fcCols || {});
    // Calm look: Country is off to start with (it mostly says "Not known"). Done once; tick it in Columns to bring it back.
    if (!pr.fcCalmCols) { state.fCols.country = false; api.storage.local.set({ fcCalmCols: 1, fcCols: state.fCols }).catch(() => {}); }
    state.drawerW = +pr.fcDrawerW || 0;
    // New since you last looked: copies found after your last visit to this page get a blue dot.
    state.seenAt = pr.fcSeenAt || '';
    api.storage.local.set({ fcSeenAt: new Date().toISOString() }).catch(() => {});
    state.dView = pr.fcDView || 'side';
  }
  if (routeArg('open')) { const id = routeArg('open'), oc = FCD.copies.find(x => x.id === id); if (oc) switchTab(isSoc(oc) ? 'social' : 'web'); state.open = id; state.fFilter = 'All'; history.replaceState(null, '', '#found'); }
  if (routeArg('client')) { state.fClient = routeArg('client'); state.fFilter = 'All'; history.replaceState(null, '', '#found'); }
  if (routeArg('filter')) { state.fFilter = routeArg('filter'); history.replaceState(null, '', '#found'); }
  if (routeArg('via')) { state.fVia = routeArg('via'); state.fFilter = 'All'; switchTab(state.fVia === 'credit' ? 'web' : state.fTab); history.replaceState(null, '', '#found'); }
  if (routeArg('strong')) { state.fStrong = true; state.fFilter = 'New'; switchTab('web'); history.replaceState(null, '', '#found'); }
  if (routeArg('photo')) { state.fPhoto = routeArg('photo'); state.fFilter = 'All'; state.fView = 'list'; history.replaceState(null, '', '#found'); }
  const everyTab = FCD.copies;
  // 4.9: two tabs, Websites and Social media. Each keeps its own filters.
  const tabN = t => everyTab.filter(c => (t === 'social') === isSoc(c) && c.status === 'new' && visible(c) && !ruleHidden(c)).length;
  const nWeb = tabN('web'), nSoc = tabN('social');
  if (state.fTab === 'social' && !everyTab.some(isSoc)) switchTab('web');
  const everything = everyTab.filter(inTab);
  const hiddenN = everything.filter(c => c.status !== 'removed' && !siteHidden(c) && countryOut(c)).length;
  const all = everything.filter(visible);
  const social = state.fTab === 'social';
  if (!social && (state.fView === 'account' || state.sView === 'accounts')) { state.fView = 'client'; state.sView = 'copies'; }
  if (social && state.fView === 'owner') state.fView = 'account';
  const sorters = { act: (a, b) => actScore(b) - actScore(a), pct: (a, b) => (b.pct || 0) - (a.pct || 0), risk: (a, b) => ({ sus: 2, watch: 1, ok: 0 }[b.risk.level] - { sus: 2, watch: 1, ok: 0 }[a.risk.level]), newest: (a, b) => (b.firstSeen || '').localeCompare(a.firstSeen || ''), pop: (a, b) => (b.popL - a.popL) || ((a.pop || 9e9) - (b.pop || 9e9)) || actScore(b) - actScore(a), fol: (a, b) => (folOf(b) ?? -1) - (folOf(a) ?? -1) || actScore(b) - actScore(a) };
  // 5d (Ben): copies on a site whose company is "Not a viable entity" go to the bottom.
  const low = c => (typeof ppEntLow === 'function' && ppEntLow(c) ? 1 : 0), srt = sorters[state.fSort] || sorters.act;
  let rows = all.filter(c => passMain(c) && passStatus(c)).sort((a, b) => low(a) - low(b) || srt(a, b));
  rows = holdRows(rows, draw);
  const main = all.filter(passMain);
  const cnt = f => main.filter(c => passStatus(c, f)).length;
  const groups = [];
  const by = (keyFn) => { const m = new Map(); for (const c of rows) { const k = keyFn(c); if (!m.has(k)) m.set(k, []); m.get(k).push(c); } return m; };
  if (state.fView === 'client') {
    const m = by(c => c.clientName || 'Client unknown');
    for (const [k, xs] of [...m.entries()].sort((a, b) => (a[0] === 'Client unknown') - (b[0] === 'Client unknown') || a[0].localeCompare(b[0]))) {
      const cl = FCD.clients.get(k);
      groups.push(['cc:' + k, `${k === 'Client unknown' ? '<span class="cav grey" aria-hidden="true">?</span>' : avatar(k)}<b class="gname"${k === 'Client unknown' ? ' style="color:var(--warn)"' : ''}>${cl && cl.priority ? '<span style="color:var(--warn)">★</span> ' : ''}${esc(k)}</b><span class="gchip">${plural(new Set(xs.map(x => x.photo)).size, 'photo')}</span><span class="gchip">${plural(xs.length, 'copy', 'copies')}</span>`, xs, 'client']);
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
  // 4.52 (Ben's pick): website Maybes under 60% were all removed by hand (none of about 85 kept),
  // so they fold into one "Weak Maybes" heading at the bottom, closed until clicked.
  if (!social) {
    const weak = [];
    for (const g of groups) { const keep = []; for (const c of g[2]) (weakMaybe(c) ? weak : keep).push(c); g[2] = keep; }
    for (let i = groups.length - 1; i >= 0; i--) if (!groups[i][2].length && groups.length > 1) groups.splice(i, 1);
    if (weak.length) {
      if (groups.length === 1 && !groups[0][2].length) groups.length = 0;
      groups.push(['weak', `<b class="gname">Weak Maybes</b><span class="faint">Under ${WEAK_MAYBE}% lines up. You have removed nearly all of these before.</span>`, weak, true]);
    }
  }
  const list = [];
  let shown = 0, body = '';
  const foldSites = state.fView !== 'site' && state.fView !== 'owner' && state.fView !== 'account';
  for (const [k, html, xs, fold] of groups) {
    if (shown >= state.more) break;
    let open = true;
    if (html) {
      if (fold === 'client') {
        // Client headings start open; a click folds them (remembered as "cc:<client>" in state.exp).
        open = !state.exp.includes(k);
        body += `<div class="ghead fold chead" data-act="gtoggle" data-v="${esc(k)}" aria-expanded="${open}" title="${open ? 'Click to fold' : 'Click to open'}">${html}<span class="gfold${open ? ' on' : ''}" aria-hidden="true">▾</span></div>`;
      } else {
      const canFold = fold && (xs.length > 3 || k === 'weak');
      open = !canFold || state.exp.includes(k);
      body += `<div class="ghead${canFold ? ' fold' : ''}${k === 'weak' ? ' weakhead' : ''}" ${canFold ? `data-act="gtoggle" data-v="${esc(k)}"` : ''}>${canFold ? `<span class="caret${open ? ' on' : ''}">▸</span>` : ''}${html}<span class="faint gcount">${plural(xs.length, 'copy', 'copies')}${canFold ? (open ? ' · click to fold' : ' · click to open') : ''}</span></div>`;
      }
      if (!open && !xs.some(x => x.id === state.open)) continue;
    }
    // Copies from one site sit together: the first shows, the rest fold under "N more from this site".
    const clusters = new Map();
    // 4.43: several of your photos on one page = one row ("3 of your photos on this page"), and the
    // same story on 3 or more sites = one row ("Same story on 14 sites"). New copies only.
    const multi = foldSites ? pageStoryKeys(xs) : null;
    // Social posts fold per account (never "N more from instagram.com").
    for (const c of xs) { const b = !foldSites ? c.id : isSoc(c) ? (c.acct ? c.acct.handle + ' on ' + platOf(c).name : c.id) : (multi.get(c.id) || FC.baseOf(c.site)); if (!clusters.has(b)) clusters.set(b, []); clusters.get(b).push(c); }
    body += '<div class="clist">';
    for (const [b, cs] of clusters) {
      if (shown >= state.more) break;
      const mk = 'm:' + k + '|' + b, wide = cs.length < 2 || state.exp.includes(mk) || cs.some(x => x.id === state.open);
      if (/^(pg|st):/.test(b) && cs.length > 1) {
        body += groupRow(b, cs, mk, wide);
        if (wide) for (const c of cs) { body += copyRow(c); list.push(c.id); }
        else list.push(...cs.map(c => c.id));
        shown += cs.length;
        continue;
      }
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
  if (HOLD_NEW) body += `<div class="holdbar" role="status"><span>${plural(HOLD_NEW, 'new copy', 'new copies')} came in</span><button class="btn sm primary" data-act="holdshow">Show ${HOLD_NEW === 1 ? 'it' : 'them'}</button></div>`;
  if (rows.length > shown) body += `<div class="more-row"><button class="btn" data-act="fmore">Show ${Math.min(250, rows.length - shown)} more (${rows.length - shown} not shown)</button></div>`;
  const active = [['fClient', state.fClient], ['fUse', state.fUse === 'Any' ? 'Any' : FC.USE[state.fUse][0]], ['fRisk', state.fRisk === 'Any' ? 'Any' : RISK[state.fRisk][0]], ['fCredit', state.fCredit === 'Any' ? 'Any' : CREDIT[state.fCredit]],
    ['fYear', state.fYear === 'Any' ? 'Any' : 'Year ' + state.fYear], ['fQuarter', state.fQuarter === 'Any' ? 'Any' : 'Quarter ' + state.fQuarter]].filter(([, v]) => v !== 'Any');
  if (state.fPop && state.fPop !== 'Any') active.push(['fPop', POP_LABEL[state.fPop] || 'Site popularity']);
  if (state.fBad) active.push(['fBad', 'Known bad sites']);
  if (state.fShop) active.push(['fShop', 'Selling something']);
  if (state.fRepeat) active.push(['fRepeat', 'Repeat offenders']);
  if (state.fStrong) active.push(['fStrong', 'Strong claims']);
  if (state.fVia) active.push(['fVia', state.fVia === 'credit' ? 'Found by credit search' : 'Found by the watch list']);
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
    return `${foundHead(bigTabs)}
    <section class="card pad" style="text-align:center;padding:48px 22px;display:flex;flex-direction:column;align-items:center;gap:12px"><h2>${social ? 'No social media copies yet' : 'No website copies yet'}</h2><p class="muted" style="margin:0;max-width:56ch">${social ? 'Copies posted on Instagram, TikTok, Facebook, X and other social sites show up here.' : 'Copies on websites show up here.'}</p></section>`;
  }
  if (!everything.length) {
    return `${foundHead('')}
    ${await driveBanner()}
    <section class="card pad" style="text-align:center;padding:48px 22px;display:flex;flex-direction:column;align-items:center;gap:12px"><h2>Nothing found yet</h2><p class="muted" style="margin:0;max-width:56ch">Copies show up here as soon as a search finds them. Turn on Keep searching, run today's 50, or search a few photos now.</p>
    <div class="row" style="justify-content:center"><a class="btn primary" href="#keep">Keep searching</a><a class="btn" href="#search">New search</a></div></section>`;
  }
  // Quick filters: one click each. The number is how many copies it would show. (4.7: they live in Filters.)
  const chip = (label, n, on, act, v, col) => n || on ? `<button class="qchip${on ? ' on' : ''}" data-act="${act}" data-v="${v}" aria-pressed="${on}">${col ? `<i style="background:var(--${col})"></i>` : ''}${label} <span class="num">${n}</span></button>` : '';
  const years = [...new Set(everything.map(c => (FCD.photos.get(c.photo) || {}).year).filter(Boolean))].sort((a, b) => b - a);
  // 4.7: one tidy line. Each switch is a small dropdown.
  // 4.11: a dropdown set away from its normal choice (def) turns blue, with an ✕ that puts it back.
  const dd = (id, label, opts, cur, right, def) => { const chosen = def != null && cur !== def; return `<details class="ddw${right ? ' right' : ''}" data-dd="${id}"><summary class="ddb${chosen ? ' chosen' : ''}">${label}${cur != null ? ` <b>${esc((opts.find(o => o[0] === cur) || opts[0])[1])}</b>` : ''} ${chosen ? `<span class="ddx" role="button" tabindex="0" data-act="fset" data-v="${id}|${def}" title="Back to ${esc((opts.find(o => o[0] === def) || opts[0])[1])}" aria-label="Clear ${String(label).replace(/<[^>]+>/g, '')}">✕</span>` : '<span class="caret" aria-hidden="true">▾</span>'}</summary><div class="ddm" role="menu">${opts.map(([k, l, s]) => `<button role="menuitemradio" aria-checked="${cur === k}" class="${cur === k ? 'on' : ''}" data-act="fset" data-v="${id}|${k}">${esc(l)}${s ? `<span class="sub">${esc(s)}</span>` : ''}</button>`).join('')}</div></details>`; };
  const newL = live.filter(c => c.status === 'new' && !ruleHidden(c));
  // 4.24: new spam blog copies (counted whether they are hidden or showing).
  const spamCs = everything.filter(c => c.spam && c.status === 'new' && !siteHidden(c) && !FCD.countries.includes(c.country)), spamN = spamCs.length;
  // 4.11: the old big number cards are now small Quick filter buttons. Solid blue with a tick = on.
  const qf = (label, n, on, act, v, col) => `<button class="qf${on ? ' on' : ''}" data-act="${act}" data-v="${v}" aria-pressed="${on}">${on ? '<span class="tick" aria-hidden="true">✓</span>' : col ? `<i style="background:var(--${col})"></i>` : ''}${label} <span class="num">${n}</span></button>`;
  const fresh = c => c.dmg && c.dmg.end && Date.now() <= c.dmg.end.getTime();
  return `${foundHead(bigTabs, nNew ? `<a class="btn primary" href="#review?kind=${state.fTab}">One at a time (${nNew})</a>` : '')}
  ${await driveBanner()}
  ${socAskBanner(everyTab.filter(visible))}
  ${FCD.unhid && FCD.unhid.length ? `<div class="banner info" role="status"><div style="flex:1 1 260px;min-width:0"><b>${esc(FCD.unhid.join(', '))} ${FCD.unhid.length === 1 ? 'shows' : 'show'} again</b><div style="font-size:13px">A whole social site can no longer be hidden, only its accounts. Its posts are back on the Social media tab. Hide the accounts you don't want from there.</div></div><button class="btn sm" data-act="unhidok">Got it</button></div>` : ''}
  ${state.fFilter === 'Not finished' && typeof evWaitBar === 'function' ? await evWaitBar() : ''}
  <section class="card found-card">
    <div class="toolbar tidy">
      <div class="tabs ansbar" role="tablist" aria-label="Status">${['New', 'Check later', 'Not finished', 'Stolen', 'Licensed', 'Removed', 'All'].map(f => `<button role="tab" aria-selected="${state.fFilter === f}" class="${state.fFilter === f ? 'on' : ''}" data-act="ffilter" data-v="${f}"${f === 'All' ? ' title="Every copy except the removed ones"' : f === 'Not finished' ? ' title="Stolen copies whose claim steps are not done yet"' : ''}>${state.fFilter === f ? '<i class="tick" aria-hidden="true">✓</i>' : ''}${f} <span>${cnt(f)}</span></button>`).join('')}${['Still online', 'Back online', 'Gone'].includes(state.fFilter) ? `<button role="tab" aria-selected="true" class="on" data-act="ffilter" data-v="${state.fFilter}"><i class="tick" aria-hidden="true">✓</i>${state.fFilter} <span>${cnt(state.fFilter)}</span></button>` : ''}</div>
      ${rows.filter(isNewSince).length ? `<span class="newsince"><span class="newdot" aria-hidden="true"></span> ${rows.filter(isNewSince).length} new since you last looked</span>` : ''}
      ${social ? `<div class="seg sm" role="radiogroup" aria-label="Show">${[['copies', 'Copies'], ['accounts', 'Accounts']].map(([k, l]) => `<button role="radio" aria-checked="${state.sView === k}" class="${state.sView === k ? 'on' : ''}" data-act="sview" data-v="${k}">${l}</button>`).join('')}</div>` : ''}
      <span style="flex:1"></span>
      ${dd('fView', cmdIc(CMD.group) + 'Group', social ? [['account', 'Account'], ['client', 'Client'], ['photo', 'Photo'], ['site', 'Platform'], ['list', 'None']] : [['client', 'Client'], ['photo', 'Photo'], ['site', 'Site'], ['owner', 'Site owner'], ['list', 'None']], state.fView)}
      <button class="ddb cmd${state.showFilters ? ' on' : ''}${active.length || state.fWhen !== 'any' || state.fMatch !== 'any' ? ' chosen' : ''}" data-act="togglefilters" aria-expanded="${state.showFilters}">${cmdIc(CMD.filter)}Filters${active.length + (state.fWhen !== 'any') + (state.fMatch !== 'any') ? ` <b class="num">${active.length + (state.fWhen !== 'any') + (state.fMatch !== 'any')}</b>` : ''}</button>
      ${dd('fSort', cmdIc(CMD.sort) + 'Sort', [['act', 'Best to act on'], ['pct', 'Lines up most'], ...(social ? [['fol', 'Most followers']] : [['risk', 'Most suspicious'], ['pop', 'Most popular site', 'Biggest websites first (Tranco top 1 million list)']]), ['newest', 'Newest']], state.fSort, true)}
      <span class="cmdsep" aria-hidden="true"></span>
      <button class="ddb cmd" data-act="fcsv" title="Download the list as a spreadsheet">${cmdIc(CMD.down)}Download</button>
      <details class="ddw right" data-dd="cols"><summary class="ddb cmd gear" title="Pick the columns" aria-label="Columns">${cmdIc(CMD.cols)}Columns</summary><div class="ddm">${FCOLS.map(([k, l]) => `<label><input type="checkbox" data-act="fcol" data-v="${k}" ${state.fCols[k] ? 'checked' : ''}> ${esc(l)}</label>`).join('')}<span class="faint" style="font-size:12px;padding:4px 10px 6px">Narrow windows show fewer columns.</span></div></details>
    </div>
    <div class="qfrow" aria-label="Quick filters"><span class="qflabel">Quick filters</span>
      ${qf('Found today', newL.filter(c => new Date(c.firstSeen).toDateString() === new Date().toDateString()).length, state.fWhen === 'today', 'ftoday', '1', 'accent')}
      ${social ? qf('Known stolen accounts', newL.filter(c => c.repeat > 0).length, state.fRepeat, 'qtoggle', 'repeat', 'bad') : qf('Suspicious sites', newL.filter(c => c.risk.level === 'sus').length, state.fRisk === 'sus', 'qtoggle', 'sus', 'bad')}
      ${!social && newL.some(c => c.popL >= 3) ? qf('Big sites (top 10K)', newL.filter(c => c.popL >= 3).length, state.fPop === '10k', 'qtoggle', 'bigsite', 'warn') : ''}
      ${!social && newL.some(c => c.bad) ? qf('Known bad sites', newL.filter(c => c.bad).length, state.fBad, 'qtoggle', 'badsite', 'bad') : ''}
      ${qf('Published in the last 3 months', newL.filter(fresh).length, state.fFresh, 'qtoggle', 'fresh', 'ok')}
      ${!social && spamN ? qf('Spam blogs', spamN, state.fSpam === 'only', 'qtoggle', 'spam', 'faint') : ''}
      ${RS_STOLEN.items.length ? qf('Stolen before', all.filter(c => c.known && c.status !== 'removed' && !ruleHidden(c)).length, state.fKnown === 'only', 'qtoggle', 'known', 'bad') : ''}
    </div>
    ${!social ? spamLine(spamCs) : ''}
    ${social ? platChips(all.filter(c => passMore(c) && passStatus(c) && passMainNoPlat(c))) : ''}
    ${social ? acctFilterLine(dd, all.filter(c => passStatus(c) && passMainNoAcct(c))) : ''}
    ${state.showFilters ? `<div class="filters fpanel">
      <div class="row fpdd" style="gap:8px;flex-wrap:wrap">
      ${dd('fWhen', 'Found', Object.entries(WHEN).map(([k, v]) => [k, v[0]]), state.fWhen, false, 'any')}
      ${dd('fMatch', 'Match', [['any', 'All'], ['exact', 'Exact', 'The same photo, 95% or more lines up'], ['strong', 'Strong', '80% or more lines up'], ['loose', 'Loose', 'Less, or only a few details match']], state.fMatch, false, 'any')}
      </div>
      <div class="qchips" aria-label="Quick filters"><span style="font-weight:600">Quick filters</span>
      ${chip('Repeat offenders', live.filter(c => c.repeat && c.status === 'new').length, state.fRepeat, 'qtoggle', 'repeat', 'bad')}
      ${RS_STOLEN.items.length ? chip('On my stolen before list', live.filter(c => c.known).length, state.fKnown === 'only', 'qtoggle', 'known', 'bad') + chip('Hide ones on my stolen before list', live.filter(c => c.known).length, state.fKnown === 'hide', 'qtoggle', 'knownhide') : ''}
      ${chip('Selling something', live.filter(c => c.use === 'shop').length, state.fShop, 'qtoggle', 'shop', 'ok')}
      ${chip('Credit removed', live.filter(c => c.credit === 'removed').length, state.fCredit === 'removed', 'qtoggle', 'credit', 'copy')}
      ${chip('Copied onto their site', live.filter(c => c.use === 'copied').length, state.fUse === 'copied', 'qtoggle', 'copied')}
      ${chip('Shown from another site', live.filter(c => c.use === 'embedded').length, state.fUse === 'embedded', 'qtoggle', 'embedded')}</div>
      <details class="keyfold"><summary>What do the icons mean?</summary><section class="key" aria-label="What the icons mean">
        <div class="kitem"><span class="tag bad">${ic('warn', 13)}</span><div><span><b>Worth a look</b> (yellow): one sign, such as a site under a year old, an odd ending like .xyz, a name copycat sites use, or an odd name. <b>Suspicious site</b> (red): two or more signs, or on a known bad site list. A hidden owner only counts next to another sign, and popular sites (top 100,000) are never yellow.</span></div></div>
        <div class="kitem"><span class="tag copy">${ic('nocredit', 13)}</span><div><span><b>Credit removed</b>: your client's photo has a copyright line in its hidden data. Their copy doesn't.</span></div></div>
        <div class="kitem"><span class="tag bad">${ic('repeat', 13)}</span><div><span><b>Repeat offender</b>: you already marked copies on this site, or another site of the same owner, as Stolen, or the site is on your stolen before list.</span></div></div>
        <div class="kitem"><span class="tag bad">Stolen before</span><div><span><b>Stolen before</b>: this exact page is on your list of links stolen before (Settings › Site lists).</span></div></div>
        <div class="kitem"><span class="tag ok">${ic('shop', 13)}</span><div><span><b>Selling something</b>: a shop page, product listing or ad.</span></div></div>
        <div class="kitem"><span class="tag warn">${ic('maybe', 13)}</span><div><span><b>Maybe</b>: the checker is not sure it is the same photo.</span></div></div>
        <div class="kitem"><span class="tag ok">Statutory</span><div><span><b>Damages column</b>: Statutory (registered), Register by a date (no number yet, window still open), Actual only (window closed). Empty when the file name has no date.</span></div></div>
      </section></details>
      ${sel('fClient', 'Client', [['Any', 'Any'], ...[...new Set(everything.map(c => c.clientName || 'Client unknown'))].sort().map(n => [n, n])], state.fClient)}
      ${sel('fYear', 'Photo year', [['Any', 'Any'], ...years.map(y => [y, y])], state.fYear)}
      ${sel('fQuarter', 'Quarter', [['Any', 'Any'], [1, 'Q1'], [2, 'Q2'], [3, 'Q3'], [4, 'Q4']], state.fQuarter)}
      ${sel('fUse', 'Used as', [['Any', 'Any'], ...Object.entries(FC.USE).map(([k, v]) => [k, v[0]])], state.fUse)}
      ${sel('fRisk', 'Site check', [['Any', 'Any'], ['ok', 'Looks normal'], ['watch', 'Worth a look'], ['sus', 'Suspicious']], state.fRisk)}
      ${social ? '' : sel('fPop', 'Site popularity', [['Any', 'Any'], ['1k', 'Top 1K (biggest)'], ['10k', 'Top 10K or bigger'], ['100k', 'Top 100K or bigger'], ['1m', 'Top 1M or bigger'], ['small', 'Small sites only']], state.fPop)}
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
      <details class="justhid" style="margin-left:auto;max-width:100%"${state.justHidOpen ? ' open' : ''}><summary class="faint" style="cursor:pointer;text-align:right">Just hidden (${recent.length})</summary><div class="row" style="gap:6px;flex-wrap:wrap;justify-content:flex-end;margin-top:6px">${recent.map(h => `<button class="chip" style="cursor:pointer;text-decoration:line-through;text-decoration-color:var(--faint)" data-act="showsite" data-v="${esc(h)}" title="Show ${esc(h)} again">${esc(h)} <span style="text-decoration:none">↺</span></button>`).join('')}</div></details></div>` : ''}
    <div class="cbody${state.fView === 'client' ? ' grp-client' : ''}">${social && state.sView === 'accounts' || !rows.length ? '' : colHead(list)}${social && state.sView === 'accounts' ? accountsView(all.filter(c => passMain(c) && passStatus(c))) : body || (state.fFilter === 'New' && !active.length && state.fWhen === 'any' && state.fMatch === 'any' ? caughtUp(cnt('Stolen'), cnt('Check later')) : state.fFilter === 'Not finished' && !rows.length ? `<div class="cempty"><b>Every claim is finished</b>When you mark a copy Stolen, its claim steps open right away. A claim you put aside with Finish later waits here.</div>` : state.fFilter === 'Check later' && !rows.length ? `<div class="cempty"><b>Nothing saved to check later</b>Not sure about a copy? Press Check later (or the C key) and it waits here, out of the New list, until you answer it.</div>` : `<div class="cempty"><b>Nothing matches</b>Try another tab, or clear a filter.</div>`)}</div>
  </section>
  ${state.sis ? `<div class="bulk sis"><div style="flex:1 1 300px;min-width:0"><b>Same ${state.sis.same ? 'photo' : 'article'} on ${plural(state.sis.sites.length, 'sister site')} of ${esc(state.sis.owner)}</b><div style="font-size:13px;opacity:.85;overflow-wrap:anywhere">${esc(state.sis.sites.slice(0, 5).join(', '))}${state.sis.sites.length > 5 ? '…' : ''}</div></div><button class="btn" data-act="sisall">Mark ${state.sis.ids.length === 1 ? 'it' : 'all ' + state.sis.ids.length} stolen too</button><button class="btn" data-act="sisno">Not now</button></div>` : ''}
  ${state.picked.length ? `<div class="bulk float" role="toolbar" aria-label="Answer the picked copies"><b class="num">${state.picked.length} picked</b><i class="bsep" aria-hidden="true"></i><button class="bb stolen" data-act="bulk" data-v="stolen">Stolen</button><button class="bb licensed" data-act="bulk" data-v="licensed">Licensed</button><button class="bb" data-act="bulk" data-v="removed">Remove</button><button class="bb" data-act="bulk" data-v="later">Check later</button>${['Stolen', 'Not finished'].includes(state.fFilter) ? '<button class="bb" data-act="bulksent" title="Mark the picked Stolen copies as already sent to legal">Sent to legal</button>' : ''}<button class="bb" data-act="bulkhide">${state.fTab === 'social' ? 'Hide accounts' : 'Hide sites'}</button><button class="bb x" data-act="clearpick" aria-label="Clear the picks" title="Clear">✕</button></div>` : ''}
  ${await drawer(me === RENDER_N ? (LIST = list) : list)}`;
};
// 4.24: one quiet line about spam blog copies: how many are hidden, and buttons to show them or
// hide every one of those throwaway sites for good (the whole site, so new made-up addresses stay out too).
function spamLine(xs) {
  if (!xs.length) return '';
  const bases = [...new Set(xs.map(c => FC.baseOf(c.site)))];
  const eg = esc(xs[0].site);
  const hideAll = `<button class="btn sm" data-act="spamhide" data-v="${esc(bases.join('\n'))}">Hide all ${bases.length === 1 ? 'of ' + esc(bases[0]) : bases.length + ' spam sites'}</button>`;
  // Calm look: one short line. The explaining sentence shows when you point at the ⓘ.
  if (state.fSpam === 'hide') return `<div class="spamline" role="status"><span><b>${plural(xs.length, 'spam blog copy', 'spam blog copies')} hidden</b> <span class="spami" tabindex="0" title="Random addresses on throwaway sites, like ${eg}. Nothing was answered for you." aria-label="Random addresses on throwaway sites, like ${eg}. Nothing was answered for you.">ⓘ</span></span><span class="acts"><button class="btn sm" data-act="spamshow" data-v="show">Show them</button><button class="btn sm" data-act="spamshow" data-v="only">Only them</button>${hideAll}</span></div>`;
  return `<div class="spamline on" role="status"><span><b>${plural(xs.length, 'spam blog copy', 'spam blog copies')} showing</b> <span class="spami" tabindex="0" title="Each has a grey Spam blog tag. Point at the tag to see why." aria-label="Each has a grey Spam blog tag. Point at the tag to see why.">ⓘ</span></span><span class="acts"><button class="btn sm" data-act="spamshow" data-v="hide">Hide them again</button>${hideAll}</span></div>`;
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
// 4.43 (Ben's picks): which copies share a row. Same page (2+ of your photos on it), else the same
// story (same headline on 3+ sites, found within 3 days). Returns copy id -> row key.
const storyKey = t => { const s = String(t || '').split(/\s[|–—-]\s|\s·\s/)[0].toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); return s.split(' ').length >= 4 && s.length >= 20 ? s : ''; };
function pageStoryKeys(xs) {
  const out = new Map(), pages = new Map(), stories = new Map();
  for (const c of xs) {
    if (isSoc(c) || c.status !== 'new') continue;
    const pk = c.pk || FC.pageKey(c.url);
    if (!pages.has(pk)) pages.set(pk, []); pages.get(pk).push(c);
  }
  for (const [pk, cs] of pages) if (new Set(cs.map(c => c.photo)).size > 1) for (const c of cs) out.set(c.id, 'pg:' + pk);
  for (const c of xs) {
    if (isSoc(c) || c.status !== 'new' || out.has(c.id)) continue;
    const sk = storyKey(c.title);
    if (sk) { if (!stories.has(sk)) stories.set(sk, []); stories.get(sk).push(c); }
  }
  for (const [sk, cs] of stories) {
    const sites = new Set(cs.map(c => FC.baseOf(c.site))), t = cs.map(c => Date.parse(c.firstSeen) || 0);
    if (sites.size >= 3 && Math.max(...t) - Math.min(...t) <= 3 * 864e5) for (const c of cs) out.set(c.id, 'st:' + sk);
  }
  return out;
}
// One row for a page with several of your photos, or one story on many sites. One answer covers
// all of them; "Answer one by one" opens the single rows.
function groupRow(b, cs, mk, wide) {
  const page = b.startsWith('pg:'), c = cs[0], ids = cs.map(x => x.id).join('\n');
  const sites = [...new Set(cs.map(x => FC.baseOf(x.site)))];
  const photos = [...new Map(cs.map(x => [x.photo, x])).values()];
  const pics = (page ? photos : cs).slice(0, 5).map(x => `<img class="${page ? 'ours' : 'thumb'}" src="${page ? oursImg(FCD.photos.get(x.photo)) : theirImg(x)}" alt="" loading="lazy" referrerpolicy="no-referrer" style="width:52px;height:38px;object-fit:cover;border-radius:6px">`).join('');
  const title = page ? `<b>${esc(c.site)}</b> <span class="tag copy">${photos.length} of your photos on this page</span>` : `<b>Same story on ${sites.length} sites</b> <span class="tag blue">${esc(cs.length + ' copies')}</span>`;
  const sub = page ? `<a class="curl" href="${safeUrl(c.url)}" target="_blank" rel="noreferrer" data-act="openlink"><span>${esc(String(c.url || '').replace(/^https?:\/\/(www\.)?/, ''))}</span>${ic('ext', 13)}</a>`
    : `<span class="faint" style="overflow-wrap:anywhere">“${esc(c.title)}” · ${esc(sites.slice(0, 4).join(', '))}${sites.length > 4 ? ' and ' + (sites.length - 4) + ' more' : ''}. Often a news feed the client licenses.</span>`;
  const all = page ? 'all ' + photos.length : 'all ' + cs.length;
  return `<div class="frow crow grow" data-group="${esc(b)}">
    <div class="cpair" style="display:flex;gap:4px;flex-wrap:wrap;min-width:0">${pics}</div>
    <div class="cinfo"><div class="l1">${title}</div>${sub}<div class="l3">${esc(c.clientName || 'Client unknown')}${page ? ' · ' + esc(photos.map(x => x.photoName).slice(0, 3).join(', ')) + (photos.length > 3 ? '…' : '') : ''}</div></div>
    <div class="acts"><button class="btn sm stolen" data-act="siteall" data-v="stolen\n${esc(ids)}">Stolen (${all})</button><button class="btn sm licensed" data-act="siteall" data-v="licensed\n${esc(ids)}">Licensed</button><button class="btn sm" data-act="siteall" data-v="removed\n${esc(ids)}">Remove all</button>
      <button class="btn sm" data-act="gtoggle" data-v="${esc(mk)}" aria-expanded="${wide}">${wide ? 'Fold' : 'Answer one by one'} <span class="caret${wide ? ' on' : ''}">▸</span></button></div></div>`;
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
const VERB = { stolen: 'marked stolen', licensed: 'marked licensed', removed: 'removed', later: 'saved to check later', skip: 'skipped', new: 'put back as new' };
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
    if (c && (!ids || ids.has(c.id)) && !(visible(c) && passMain(c) && passStatus(c))) { USER_DONE.add(c.id); r.remove(); }
  }
}
function markNow(ids, status) {
  if (status === 'skip') return;
  const set = new Set(ids);
  for (const id of ids) { PEND.set(id, status); USER_DONE.add(id); }
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
  // 4.42 hot shoots: the rest of that shoot is searched next (Undo puts them back in line too).
  if (undo && undo.hot) label += ' · ' + undo.hot + (undo.hot === 1 ? ' photo' : ' photos') + ' from the same shoot go next';
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
  state.rvHold = '';
  toast('Undone: ' + h.label + '. It\'s back the way it was.');
  render(true);
}
function toastUndo(msg) { toast(msg, undoLast); }

// "Stop searching this photo" (Ben 4.52): a client photo nobody wants searched any more. Keep
// searching and Today's 50 skip it from now on; the copies already found stay. Undo (U) or
// Clients and photos › the client's photos turn it back on.
const isStopped = c => { const p = FCD && FCD.photos.get(c.photo); return !!(p && p.stopped); };
const STOP_TIP = 'Keep searching and Today\'s 50 skip this photo from now on, and its unanswered matches move to Removed. Stolen and Licensed stay. Turn it back on any time in Clients and photos.';
function stopRow(c) {
  if (!FCD || !FCD.photos.get(c.photo)) return '';
  return isStopped(c)
    ? `<br><span class="tag grey" style="margin-top:4px">${ic('pause', 13)} Not searched any more</span> <button class="btn ghost sm" data-act="stopphoto" data-v="${esc(c.id)}">Search it again</button>`
    : `<br><button class="btn ghost sm" style="margin-top:4px" data-act="stopphoto" data-v="${esc(c.id)}" title="${esc(STOP_TIP)}">${ic('pause', 14)} Stop searching this photo</button>`;
}
function stopMenu(c) {
  if (!FCD || !FCD.photos.get(c.photo)) return '';
  return isStopped(c)
    ? `<button data-act="stopphoto" data-v="${esc(c.id)}">${ic('refresh', 16)}<span>Search this photo again</span></button>`
    : `<button data-act="stopphoto" data-v="${esc(c.id)}" title="${esc(STOP_TIP)}">${ic('pause', 16)}<span>Stop searching this photo</span></button>`;
}
function stopBtn(c) {
  if (!FCD || !FCD.photos.get(c.photo)) return '';
  return isStopped(c)
    ? `<button class="btn" data-act="stopphoto" data-v="${esc(c.id)}">${ic('refresh', 16)} Search this photo again</button>`
    : `<button class="btn" data-act="stopphoto" data-v="${esc(c.id)}" title="${esc(STOP_TIP)}">${ic('pause', 16)} Stop searching this photo</button>`;
}
// Before a photo stops being searched: a box that says what will happen, and a tick to say
// you understand (Ben). Resolves true only when ticked and confirmed.
function askStop(names, pic, cnt = {}) {
  return new Promise(res => {
    const n = names.length, one = n === 1;
    const d = document.createElement('dialog');
    d.className = 'pp-ask stopask';
    d.style.cssText = 'border:1px solid var(--line);border-radius:16px;padding:22px;background:var(--surface);color:var(--ink);box-shadow:0 20px 60px rgba(0,0,0,.35);width:min(500px,92vw)';
    d.innerHTML = `<form method="dialog" style="display:flex;flex-direction:column;gap:12px">
      <b style="font-size:18px">${one ? 'Stop searching this photo?' : 'Stop searching ' + n + ' photos?'}</b>
      <div class="row" style="gap:12px;flex-wrap:nowrap;align-items:center">${pic ? `<img src="${pic}" alt="" style="width:84px;height:56px;object-fit:cover;border-radius:8px;flex-shrink:0">` : ''}<span style="min-width:0;overflow-wrap:anywhere;font-weight:600">${esc(one ? names[0] : names.slice(0, 3).join(', ') + (n > 3 ? ' and ' + (n - 3) + ' more' : ''))}</span></div>
      <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.5">
        <li>PageProof will <b>no longer look for new copies</b> of ${one ? 'this photo' : 'these photos'} (Keep searching and Today's 50 skip ${one ? 'it' : 'them'}).</li>
        ${cnt.open == null ? `<li>Matches not answered yet (New and Check later) move to <b>Removed</b>. Stolen and Licensed stay.</li>` : cnt.open ? `<li><b>${plural(cnt.open, 'match', 'matches')} not answered yet</b> (New and Check later) move${cnt.open === 1 ? 's' : ''} to Removed.</li>` : '<li>No unanswered matches to remove.</li>'}
        ${cnt.kept ? `<li>${plural(cnt.kept, 'match', 'matches')} you marked Stolen or Licensed stay${cnt.kept === 1 ? 's' : ''}.</li>` : ''}
        <li>Undo, or <b>Search again</b> later (Clients and photos › the client), brings the removed matches back.</li>
      </ul>
      <label style="display:flex;gap:8px;align-items:flex-start;font-size:14px;cursor:pointer;background:var(--sunk);border-radius:10px;padding:10px 12px"><input type="checkbox" class="stopok" style="margin-top:3px"><span>I understand new copies of ${one ? 'this photo' : 'these photos'} won't be found while ${one ? 'it is' : 'they are'} stopped, and unanswered matches are removed.</span></label>
      <div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" value="no" type="submit">Cancel</button><button class="btn primary stopgo" value="yes" type="submit" disabled data-why="Tick the box first.">Stop searching</button></div></form>`;
    document.body.appendChild(d);
    const tick = d.querySelector('.stopok'), go = d.querySelector('.stopgo');
    tick.addEventListener('change', () => { go.disabled = !tick.checked; });
    // Answer straight from the buttons (the dialog's own close event can come late).
    let done = false;
    const finish = yes => { if (done) return; done = true; if (d.open) d.close(); d.remove(); res(yes); };
    go.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); if (tick.checked) finish(true); });
    d.querySelector('button[value="no"]').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); finish(false); });
    d.addEventListener('keydown', e => e.stopPropagation());
    d.addEventListener('close', () => finish(false));
    d.showModal(); tick.focus();
  });
}
async function stopPhoto(copyId) {
  const c = FCD && FCD.copies.find(x => x.id === copyId);
  const p = c && FCD.photos.get(c.photo);
  if (!p) return;
  const on = !p.stopped;
  // A double is searched as one photo, so every version of it stops (or starts) together.
  const ids = (await FC.doublesOf(p)).map(d => d.id);
  if (!ids.includes(p.id)) ids.push(p.id);
  const mine = x => ids.includes(x.photo);
  const open = FCD.copies.filter(x => mine(x) && ['new', 'later'].includes(x.status)).length;
  const kept = FCD.copies.filter(x => mine(x) && ['stolen', 'licensed'].includes(x.status)).length;
  if (on && !(await askStop([c.photoName || p.name], p.thumb ? safeImg(p.thumb) : safeImg(([...document.querySelectorAll('img[data-our]')].find(i => i.dataset.our === p.id) || {}).src || ''), { open, kept }))) return;
  // The open copy goes to Removed with the others: open the next copy of another photo instead.
  const wasOpen = state.open;
  let nextId = state.open;
  if (on && state.open && mine(FCD.copies.find(x => x.id === state.open) || {})) {
    const i = LIST.indexOf(state.open), other = x => { const o = FCD.copies.find(y => y.id === x); return o && !mine(o); };
    nextId = LIST.slice(i + 1).find(other) || LIST.slice(0, Math.max(0, i)).reverse().find(other) || '';
  }
  const undo = await FC.setStopped(ids, on);
  const name = c.photoName || p.name, moved = undo.moved || 0;
  HIST.push({ label: (on ? 'stopped searching ' : 'searching again ') + name, undo, open: wasOpen || '' });
  dropFC();
  state.open = nextId;
  toastUndo(on ? `${name} won't be searched any more.${moved ? ' ' + plural(moved, 'match', 'matches') + ' moved to Removed.' : ''}${kept ? ' Stolen and Licensed stay.' : ''}` : `${name} will be searched again.${moved ? ' ' + plural(moved, 'match', 'matches') + ' back in New.' : ''}`);
  render(true);
}

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
    // 4.63 (Ben): Stolen keeps this copy open and its claim steps start right here. The next copy
    // opens after Sent to legal or Finish later.
    if (status === 'stolen') { state.clNext = nextId; state.clOpenStep = ''; state.dTab = 'sum'; }
    else if (state.open === id) state.open = nextId;
    toastUndo(who + ' ' + VERB[status] + (status === 'stolen' ? (isSoc(c) && c.acct ? '. ' + c.acct.handle + ' is now a known account.' : '') + ' Finish the claim steps here.' : '.') + (nextId && status !== 'stolen' ? ' Next copy opened.' : ''));
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
  pickall: (v, el) => { const ids = LIST.slice(); state.picked = el && el.checked ? [...new Set([...state.picked, ...ids])] : state.picked.filter(id => !ids.includes(id)); render(true); },
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
  holdshow: () => { state.fz = null; render(true); },
  ffilter: v => { state.fFilter = v; state.more = 250; if (route() !== 'found') location.hash = 'found'; else render(true); },
  qshop: () => { state.fShop = true; state.fFilter = 'All'; render(true); },
  qrepeat: () => { state.fRepeat = true; state.fFilter = 'New'; render(true); },
  qrisk: v => { state.fRisk = v; state.fFilter = 'All'; render(true); },
  qcredit: v => { state.fCredit = v; state.fFilter = 'All'; render(true); },
  togglefilters: () => { state.showFilters = !state.showFilters; render(true); },
  unfilter: v => {
    if (v === 'all') Object.assign(state, { fWhen: 'any', fMatch: 'any', fVer: 'Any', fFol: 'Any', fType: 'Any', fCountry: 'Any', fAcct: '', fPlat: 'Any', fFresh: false, fClient: 'Any', fUse: 'Any', fRisk: 'Any', fCredit: 'Any', fShop: false, fRepeat: false, fStrong: false, fVia: '', fKnown: '', fSpam: 'hide', fOwner: '', fPop: 'Any', fBad: false, fYear: 'Any', fQuarter: 'Any', fPhoto: '', fq: '' });
    else if (v === 'fWhen' || v === 'fMatch') state[v] = 'any';
    else if (v === 'fSpam') state.fSpam = 'hide';
    else state[v] = v === 'fShop' || v === 'fBad' || v === 'fRepeat' || v === 'fFresh' || v === 'fStrong' ? false : ['fOwner', 'fPhoto', 'fq', 'fAcct', 'fKnown', 'fVia'].includes(v) ? '' : 'Any';
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
    else if (v === 'bigsite') state.fPop = state.fPop === '10k' ? 'Any' : '10k';
    else if (v === 'badsite') state.fBad = !state.fBad;
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
    openRowMenu(el, `${c.status === 'new' ? `<button data-act="mdo" data-v="later|${id}">${ic('clock', 16)}<span>Check later</span><span class="kbd">C</span></button><button data-act="mdo" data-v="skip|${id}">${ic('chev', 16)}<span>Skip for now</span><span class="kbd">→</span></button>` : ''}${c.status === 'later' ? `<button data-act="mdo" data-v="unlater|${id}">${ic('undo', 16)}<span>Back to New</span></button>` : ''}
      ${isSoc(c) && !c.acct ? `<small>Who posted it?</small><button data-act="openacct" data-v="${id}">${ic('who', 16)}<span>Set the account</span></button>` : ''}
      ${!isSoc(c) || c.acct ? `<small>${isSoc(c) ? 'Approve ' + esc(c.acct.handle) : 'Approve this site'}</small>
      ${c.clientName ? `<button data-act="mdo" data-v="okclient|${id}">${ic('check', 16)}<span>For ${esc(c.clientName)} only</span></button>` : ''}
      <button data-act="mdo" data-v="okall|${id}">${ic('check', 16)}<span>For every client</span></button>` : ''}
      <small>${isSoc(c) ? 'Hide' : 'Hide this site'}</small>
      ${hideChoices(c).map(([h, l, d, warn]) => `<button data-act="mhide" data-v="${esc(h)}"${warn ? ` title="${esc(d)}" style="color:var(--bad)"` : ''}>${ic('ban', 16)}<span>${esc(l)}</span></button>`).join('')}
      ${typeof clOpen === 'function' && clOpen(c) ? `<hr><button data-act="mdo" data-v="changeans|${id}">${ic('undo', 16)}<span>Change answer</span></button>` : ''}
      <hr>
      <button data-act="mdo" data-v="compare|${id}">${ic('layers', 16)}<span>Compare the two photos</span></button>
      <button data-act="mdo" data-v="evidence|${id}">${ic('doc', 16)}<span>Make evidence report</span></button>
      <button data-act="mdo" data-v="capture|${id}">${ic('cam', 16)}<span>Capture their page</span></button>
      ${isSoc(c) ? (c.acct ? `<button data-act="openacct" data-v="${id}">${ic('owner', 16)}<span>Who's behind ${esc(c.acct.handle)}</span></button>` : '') : `<button data-act="mdo" data-v="who|${id}">${ic('owner', 16)}<span>Who's behind ${esc(base)}</span></button>`}
      <button data-act="mdo" data-v="copy|${id}">${ic('link', 16)}<span>Copy the link</span></button>
      <hr>${stopMenu(c)}`);
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
    if (what === 'changeans') return ACTS.rowans('new|' + id);
    if (what === 'evidence') return ACTS.evidence(id);
    if (what === 'who') return ACTS.gowho(id);
    if (what === 'copy') return ACTS.copytext(c.url);
    if (what === 'later') return ACTS.rowans('later|' + id);
    if (what === 'unlater') return ACTS.rowans('new|' + id);
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
    if (state.open === c.id) renderAuto();
  },
  readpage: async () => {
    const c = FCD.copies.find(x => x.id === state.open);
    if (!c) return;
    const p = readTheirPage(c, true); render(true);
    await p.catch(() => {});
    if (state.open === c.id) renderAuto();
  },
  legalfix: async v => {
    if (v === 'capture') return ACTS.capturecopy();
    if (v === 'readpage') return ACTS.readpage();
    if (v === 'who') return ACTS.gowho(state.open);
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
    const head = ['Status', 'Client', 'Photo', 'Site', 'Page', 'Lines up %', 'Match', 'Used as', 'Site check', 'Country', 'Site popularity', 'World rank', 'Known bad site', 'First seen', 'Last seen', 'Times seen', 'Found by'];
    const rows = FCD.copies.map(c => [STATUS[c.status][0], c.clientName, c.photoName, c.site, c.url, c.pct == null ? '' : c.pct, c.match, FC.USE[c.use][0], RISK[c.risk.level][0], c.country || '', c.pop == null || typeof PP_POP === 'undefined' ? '' : PP_POP.tier(c.pop).label, c.pop || '', c.bad ? c.bad.label : '', (c.firstSeen || '').slice(0, 10), (c.lastSeen || '').slice(0, 10), c.times || 1, c.by || '']);
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
  await api.runtime.sendMessage({ type: 'captureUrl', url: capUrl, src: 'stolen' }).catch(() => {});
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
// 4.56 (Ben): One at a time can show Websites only, Social media only, or All. The choice is remembered.
const RV_KINDS = [['all', 'All'], ['web', 'Websites'], ['social', 'Social media']];
const rvKindOk = (c, k = state.rvKind) => k === 'web' ? !isSoc(c) : k === 'social' ? isSoc(c) : true;
function setRvKind(k) {
  if (!RV_KINDS.some(([v]) => v === k) || k === state.rvKind) return;
  state.rvKind = k; state.rvStart = 0;
  api.storage.local.set({ fcRvKind: k }).catch(() => {});
}
function reviewQueue(k) {
  return FCD.copies.filter(c => c.status === 'new' && visible(c) && rvKindOk(c, k))
    .sort((a, b) => (!!a.skipped - !!b.skipped) || (a.skipped || '').localeCompare(b.skipped || '') || (b.repeat > 0) - (a.repeat > 0) || (b.match === 'same') - (a.match === 'same') || (b.pct || 0) - (a.pct || 0));
}
// Calm look: the small Windows-style icons of One at a time.
const rvSvg = (d, n = 18) => `<svg viewBox="0 0 16 16" width="${n}" height="${n}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const RVI = {
  st: rvSvg('<path d="M8 1.5 13.5 3.5v4c0 3.4-2.4 5.9-5.5 7-3.1-1.1-5.5-3.6-5.5-7v-4z"/><path d="M6 6l4 4M10 6l-4 4"/>', 22),
  li: rvSvg('<circle cx="8" cy="8" r="6.2"/><path d="M5.3 8.2 7.2 10 10.8 6.3"/>', 22),
  rm: rvSvg('<path d="M2.5 4.2h11M6.3 4.2V2.6h3.4v1.6M4 4.2l.7 9.3h6.6l.7-9.3"/>', 22),
  cl: rvSvg('<circle cx="8" cy="8" r="6.2"/><path d="M8 4.6V8l2.4 1.6"/>', 22),
  sk: rvSvg('<path d="M2.5 8h10M9 4.5 12.5 8 9 11.5"/>', 22),
  zoom: rvSvg('<path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9"/>'),
  rep: rvSvg('<path d="M8 1.8 14.5 13.5h-13z"/><path d="M8 6.3v3.4M8 11.6v.2"/>'),
  side: rvSvg('<rect x="1.5" y="3" width="5.5" height="10" rx="1"/><rect x="9" y="3" width="5.5" height="10" rx="1"/>', 17),
  swipe: rvSvg('<rect x="1.5" y="3" width="13" height="10" rx="1"/><path d="M8 1.5v13"/>', 17),
  search: rvSvg('<circle cx="7" cy="7" r="4.5"/><path d="M10.4 10.4 14 14"/>', 17),
  eye: rvSvg('<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>', 17),
  shield: rvSvg('<path d="M8 1.5 13.5 3.5v4c0 3.4-2.4 5.9-5.5 7-3.1-1.1-5.5-3.6-5.5-7v-4z"/><path d="M5.6 8 7.3 9.6 10.5 6.4"/>', 17),
  globe: rvSvg('<circle cx="8" cy="8" r="6.2"/><path d="M1.8 8h12.4M8 1.8c1.8 2 2.6 4 2.6 6.2S9.8 12.2 8 14.2C6.2 12.2 5.4 10.2 5.4 8S6.2 3.8 8 1.8z"/>', 17),
  page: rvSvg('<rect x="2" y="2.5" width="12" height="11" rx="1.2"/><path d="M2 5.5h12"/>', 16),
  pic: rvSvg('<rect x="1.8" y="2.8" width="12.4" height="10.4" rx="1.2"/><circle cx="5.5" cy="6.3" r="1.2"/><path d="M14.2 10.5 10.5 7l-6 6.2"/>', 16),
  copy: rvSvg('<rect x="5" y="5" width="8.5" height="8.5" rx="1"/><path d="M11 5V3.2a.7.7 0 0 0-.7-.7H3.2a.7.7 0 0 0-.7.7v7.1c0 .4.3.7.7.7H5"/>', 16),
  user: rvSvg('<circle cx="8" cy="5.5" r="2.8"/><path d="M2.8 14c.6-2.7 2.7-4.2 5.2-4.2s4.6 1.5 5.2 4.2"/>', 17),
  dn: '<svg class="dn" viewBox="0 0 10 10" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M2.5 4 5 6.5 7.5 4"/></svg>',
};
V.review = async () => {
  // A newer redraw may start while this one waits (big libraries take seconds). This one is then
  // thrown away, so it must not change which copy is held on screen (it could bring back a copy
  // you just skipped).
  const me = RENDER_N, live = () => me === RENDER_N;
  await loadFC();
  if (!state.rvKind) { const pr = await api.storage.local.get('fcRvKind').catch(() => ({})); state.rvKind = RV_KINDS.some(([v]) => v === pr.fcRvKind) ? pr.fcRvKind : 'all'; }
  if (routeArg('kind')) { setRvKind(routeArg('kind')); history.replaceState(null, '', '#review'); }
  const Q = reviewQueue();
  const kindN = Object.fromEntries(RV_KINDS.map(([v]) => [v, v === state.rvKind ? Q.length : reviewQueue(v).length]));
  // Calm look (batch 4): a short title line, one control line, a picture card with the answers
  // and a side card with the site, the match, the links and Their page / About this copy.
  const hd = head('Copies found', 'One at a time', '', '').replace('<div class="head">', '<div class="head rvhead">');
  const utabs = `<div class="utabs" role="tablist" aria-label="Show">${[['review', 'To review', Q.length], ['sites', 'By site and company', null]].map(([k, l, n]) => `<button role="tab" aria-selected="${state.rvTab === k}" class="${state.rvTab === k ? 'on' : ''}" data-act="rvtab" data-v="${k}">${l}${n == null ? '' : ` <span class="num">${n.toLocaleString()}</span>`}</button>`).join('')}</div>`;
  const kinds = `<div class="wseg rvkind" role="radiogroup" aria-label="Which copies to go through">${RV_KINDS.map(([k, l]) => `<button role="radio" aria-checked="${state.rvKind === k}" class="${state.rvKind === k ? 'on' : ''}" data-act="rvkind" data-v="${k}">${l} <span class="num">${kindN[k].toLocaleString()}</span></button>`).join('')}</div>`;
  const hue = s => { let h = 0; for (const ch of String(s || '')) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
  const ini = s => String(s || '').replace(/^www\./, '').replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || '?';
  if (state.rvTab === 'sites') {
    const by = new Map();
    for (const c of Q) { const o = FCD.ownerOf.get(c.site); const k = o && o.real ? o.key : FC.baseOf(c.site); if (!by.has(k)) by.set(k, { o: o && o.real ? o : null, name: o && o.real ? o.name : FC.baseOf(c.site), xs: [] }); by.get(k).xs.push(c); }
    const rows = [...by.values()].sort((a, b) => b.xs.length - a.xs.length).map(g => {
      const sites = [...new Set(g.xs.map(x => x.site))];
      const sub = g.o || sites.length > 1 || sites[0] !== g.name ? `<span>${g.o && g.o.kind ? esc(g.o.kind) + ' · ' : ''}${sites.length > 1 ? sites.length + ' sites: ' : ''}${esc(sites.slice(0, 4).join(', '))}${sites.length > 4 ? '…' : ''}</span>` : '';
      return `<div class="srow"><span class="sav" style="--h:${hue(g.name)}" aria-hidden="true">${esc(ini(g.name))}</span><span class="sname"><b>${esc(g.name)}</b>${sub}</span><span class="scount"><b class="num">${g.xs.length.toLocaleString()}</b> new ${g.xs.length === 1 ? 'copy' : 'copies'}</span><button class="btn" data-act="rvall" data-v="${esc(g.xs.map(x => x.id).join('\n'))}">Mark all stolen</button></div>`;
    }).join('');
    return `${hd}<div class="rvn"><div class="rvn-ctl rvtop">${utabs}${kinds}</div>${rows ? `<section class="card slist"><div class="shd"><span>Site or company</span><span>New copies</span><span></span></div>${rows}</section>` : '<p class="muted">Nothing waiting for you.</p>'}</div>`;
  }
  // 4.60: the copy on screen stays on screen until you answer it, skip it or switch. New copies
  // that sort ahead of it wait their turn, and a copy that a background check changed while you
  // looked stays, with a note.
  const held = state.rvHold ? FCD.copies.find(x => x.id === state.rvHold && rvKindOk(x, state.rvKind)) : null;
  const heldOut = held && !Q.includes(held) && !USER_DONE.has(held.id) && !PEND.has(held.id) ? held : null;
  if (!Q.length && !heldOut) return `${hd}<div class="rvn"><div class="rvn-ctl rvtop">${utabs}${kinds}</div><section class="card pad" style="text-align:center;padding:48px 22px;display:flex;flex-direction:column;align-items:center;gap:12px"><span class="tag ok" style="font-size:14px;padding:6px 14px">${ic('check', 16, 3)} All new copies reviewed</span><h2>Nothing left to review${state.rvKind === 'all' ? '' : ' in ' + (state.rvKind === 'web' ? 'Websites' : 'Social media')}</h2>${state.rvKind !== 'all' && kindN.all ? `<p class="muted" style="margin:0">${plural(kindN.all, 'new copy', 'new copies')} still waiting in ${state.rvKind === 'web' ? 'Social media' : 'Websites'}. <button class="btn sm" data-act="rvkind" data-v="all">Show all</button></p>` : ''}<p class="muted" style="margin:0;max-width:52ch">The ones you marked as stolen wait in Not finished until their claim steps are done.</p><div class="row" style="justify-content:center">${HIST.length ? `<button class="btn" data-act="undo">↶ Undo: ${esc(HIST[HIST.length - 1].label)}</button>` : ''}<a class="btn primary" href="#found">All copies</a></div></section></div>`;
  state.qi = Math.min(state.qi, Q.length - 1);
  const c = heldOut || (held && Q.includes(held) ? held : Q[0]);
  if (live()) state.rvHold = c.id;
  const p = FCD.photos.get(c.photo);
  const o = FCD.ownerOf.get(c.site);
  const id = p && p.hash ? await PP_EVIDENCE.matchId(p.hash, c.url) : '';
  if (!live()) return '';
  state.rvHold = c.id; state.rvCurrent = c.id;
  const soc = isSoc(c), what = soc ? 'account' : 'site';
  const ptag = (cls, label, w, h) => `<span class="ptag ${cls}">${label}${w ? `<em class="num">${w} × ${h}</em>` : ''}</span>`;
  const zoom = `<button class="zoom" data-act="rvcompare" title="See them bigger, side by side" aria-label="See the pictures bigger">${RVI.zoom}</button>`;
  const pics = state.cmpMode === 'swipe'
    ? `<div class="rvn-pics one"><div class="pic"><div class="swipe" id="swipe" style="--cut:${state.cut}%"><img data-our="${esc(c.photo)}" src="${oursImg(p)}" alt="Your client's photo"><img class="top-img" src="${theirImg(c)}" alt="Their copy" referrerpolicy="no-referrer"><div class="handle"></div><span class="l1">Your client's</span><span class="l2">Their copy</span></div></div>
      <input type="range" min="0" max="100" value="${state.cut}" id="cut" aria-label="Slide between your client's photo and their copy"></div>`
    : `<div class="rvn-pics pair"><figure><div class="pic"><img data-our="${esc(c.photo)}" src="${oursImg(p)}" alt="Your client's photo">${ptag('o', "Your client's photo", p && p.w, p && p.h)}${zoom}</div></figure><figure><div class="pic"><img src="${theirImg(c)}" alt="Their copy" referrerpolicy="no-referrer">${ptag('t', 'Their copy', c.w, c.h)}${zoom}</div></figure></div>`;
  // How far along you are: counted from the most copies this visit has seen waiting.
  state.rvStart = Math.max(state.rvStart || 0, Q.length);
  const at = state.rvStart - Q.length + 1;
  const ctl = `<div class="rvn-ctl rvtop">${utabs}${kinds}
    <div class="rvn-prog rvprog" aria-label="Review progress"><span><b class="num">${at.toLocaleString()} of ${state.rvStart.toLocaleString()}</b></span><div class="bar"><i style="width:${Math.max(2, (at - 1) / state.rvStart * 100)}%"></i></div>${c.skipped ? '<span class="faint">skipped before</span>' : ''}${heldOut ? `<span class="tag warn" title="A check that ran in the background changed this copy while you were looking at it. It stays here until you move on.">Now ${heldOut.status === 'new' ? 'hidden by a filter' : esc((STATUS[heldOut.status] || ['changed'])[0])}</span><button class="btn sm" data-act="rvnext">Next copy</button>` : ''}</div>
    <span class="sp"></span>
    <button class="btn" data-act="undo"${HIST.length ? ` title="Undo: ${esc(HIST[HIST.length - 1].label)}"` : ' disabled data-why="Nothing to undo yet. After you answer a copy, Undo puts it back."'}>${ic('undo', 16)} Undo <span class="kb">U</span></button>
    <div class="wseg vseg" role="radiogroup" aria-label="View">${[['side', 'Side by side', RVI.side], ['swipe', 'Swipe', RVI.swipe]].map(([k, l, i]) => `<button role="radio" aria-checked="${state.cmpMode === k}" class="${state.cmpMode === k ? 'on' : ''}" data-act="cmode" data-v="${k}">${i} ${l}</button>`).join('')}</div></div>`;
  const rep = c.repeat ? `<div class="infobar">${RVI.rep}<b>${soc ? 'Known account' : 'Stolen before'}</b><span>You marked ${plural(c.repeat, 'copy', 'copies')} ${soc ? 'by' : 'on'} ${esc(c.repeatWho)} as Stolen, so its copies come first.</span></div>` : '';
  const ans = `<div class="rvn-ans" role="group" aria-label="Your answer">
      <button class="a-st" data-act="rverdict" data-v="stolen">${RVI.st}<span>Stolen</span><span class="kb">Y</span></button>
      <button class="a-li" data-act="rverdict" data-v="licensed" title="OK for ${esc(c.clientName || 'this client')} only">${RVI.li}<span>Licensed</span><span class="kb">L</span></button>
      <button data-act="rverdict" data-v="removed" title="Not wanted: hide it">${RVI.rm}<span>Remove</span><span class="kb">N</span></button>
      <button class="a-cl" data-act="rverdict" data-v="later" title="Not sure yet: move it to Check later in All copies">${RVI.cl}<span>Check later</span><span class="kb">C</span></button>
      <button data-act="rverdict" data-v="skip" title="Show it again at the end of this list">${RVI.sk}<span>Skip</span><span class="kb">→</span></button>
    </div>`;
  const cmd = `<div class="rvn-cmd"><button class="btn c1" data-act="rvcompare">${ic('layers', 18)} Compare</button><button class="btn c2" data-act="evidence" data-v="${esc(c.id)}">${ic('doc', 18)} Evidence report</button><button class="btn c3" data-act="rvcapture">${ic('capture', 18)} Capture</button>
      ${soc && !c.acct ? `<a class="btn" href="#found?open=${encodeURIComponent(c.id)}">${ic('who', 18)} Set the account</a>` : ''}<span class="sp"></span>
      <details class="rvok"${soc && !c.acct ? ' hidden' : ''}><summary class="btn c4">${ic('check', 18)} Approve ${what} ${RVI.dn}</summary><div class="tmenu">${c.clientName ? `<button data-act="rvapprove" data-v="client"><b>For ${esc(c.clientName)} only</b><span>${esc(FC.baseOf(c.site))} may use this client's photos</span></button>` : ''}<button data-act="rvapprove" data-v="all"><b>For every client</b><span>${esc(FC.baseOf(c.site))} may use any photo</span></button></div></details>
      <details class="rvok"><summary class="btn c5">${ic('ban', 18)} Hide ${what} ${RVI.dn}</summary><div class="tmenu">${hideChoices(c).map(([v, l, d]) => `<button data-act="rvhide" data-v="${esc(v)}"><b>${esc(l)}</b><span>${esc(d)}</span></button>`).join('')}</div></details>
      ${stopBtn(c) ? `<details class="rvok rvdots"><summary class="btn icn" title="More" aria-label="More choices">${ic('dots', 18)}</summary><div class="tmenu right">${stopBtn(c).replace('class="btn"', 'class="mrow"')}</div></details>` : ''}</div>`;
  // The side card: who, how well it matches, whose photo, the links, then Their page / About this copy.
  const badge = soc ? `<span class="sbadge plat" style="--pc:${platOf(c).color}">${esc(platOf(c).short)}</span>` : `<span class="sbadge" style="--h:${hue(c.site)}" aria-hidden="true">${esc(ini(c.site))}</span>`;
  const who = soc
    ? `<div class="sn"><h2>${c.acct ? acctHtml(c.acct) : '<span style="color:var(--warn)">Account not found yet</span>'}</h2><span class="hdl">${esc(postWord(c))} · found ${shortDate(c.firstSeen).replace(/^(Today|Yesterday)/, m => m.toLowerCase())}</span></div>`
    : `<div class="sn"><h2>${esc(c.site)}</h2><span class="hdl">${esc(FC.USE[c.use][0])} · found ${shortDate(c.firstSeen).replace(/^(Today|Yesterday)/, m => m.toLowerCase())}</span></div>`;
  const tags = knownTag(c) + spamTag(c) + repeatTag(c) + flagWords(c);
  const hasPct = c.pct >= 0 && c.pct != null;
  const match = `<div class="mbox ${c.match === 'same' ? 'same' : 'maybe'}">${hasPct ? `<div class="mn"><b class="num">${c.pct}%</b><span>lines up</span></div><div class="mbar"><i style="width:${c.pct}%"></i></div>` : '<div class="mbar none"></div>'}<span class="mpill">${c.match === 'same' ? 'Same photo' : 'Maybe the same'}</span></div>`;
  const chips = `<div class="cchips"><span class="cchip"><span class="cav" style="--h:${hue(c.clientName)}" aria-hidden="true">${esc(ini(String(c.clientName || '?').split(/\s+/).map(w => w[0]).join('')))}</span>${esc(c.clientName || 'Client unknown')}</span><span class="cchip plain">${RVI.pic} ${esc(c.photoName)}</span></div>`;
  const short = u => esc(String(u || '').replace(/^https?:\/\/(www\.)?/, ''));
  const link = (icon, label, u) => /^https?:/i.test(u || '') ? `<div class="ul"><span class="ulab">${icon} ${label}</span><a class="curl" href="${safeUrl(u)}" target="_blank" rel="noreferrer" title="Open in a new tab"><span>${short(u)}</span>${ic('ext', 14)}</a><button class="ib" data-act="copytext" data-v="${esc(u)}" title="Copy this address" aria-label="Copy the ${label.toLowerCase()} address">${RVI.copy}</button></div>` : '';
  const links = `<div class="ulinks">${link(RVI.page, soc ? 'Post' : 'Page', (c.rp && c.rp.post) || c.url)}${link(RVI.pic, 'Picture', (picLink(c) || {}).url || c.img)}</div>`;
  const row = (icon, k, v) => `<div class="fr"><span class="fi" aria-hidden="true">${icon}</span><span class="fk">${k}</span><span class="fv">${v}</span></div>`;
  const about = state.rvSide === 'about';
  const facts = `<div class="rfacts">${soc && c.acct ? row(RVI.user, 'Account', acctHtml(c.acct)) : ''}${row(RVI.search, 'Found by', esc(c.by || 'a search') + ' · ' + shortDate(c.firstSeen))}${row(RVI.eye, 'Seen', c.times > 1 ? c.times + ' times, last ' + shortDate(c.lastSeen) : 'Once')}${row(RVI.shield, 'Site check', RISK[c.risk.level][0] + (c.risk.why.length ? ' · ' + esc(c.risk.why.join(', ')) : ''))}${soc ? '' : row(RVI.globe, 'Country', c.country ? esc(c.country) : 'Not known')}${id ? row(ic('capture', 17), 'Match ID', `<span class="mono">${id}</span>`) : ''}${o && o.real ? row(RVI.user, 'Company', esc(o.name) + (o.sites.length > 1 ? `<span class="fsub">${Q.filter(x => o.sites.includes(x.site)).length} new copies on their sites. Use "By site and company" to mark them all at once.</span>` : '')) : ''}</div>`;
  const side = `<aside class="card rvn-side" aria-label="About this copy"><div class="sin">
      <div class="rvn-site rvsite">${badge}<div class="sm">${who}${tags ? `<div class="stags">${tags}</div>` : ''}</div></div>
      ${match}${chips}${links}
      <div class="stabs" role="tablist"><button role="tab" aria-selected="${!about}" class="${about ? '' : 'on'}" data-act="rvside" data-v="page">${soc ? 'The post' : 'Their page'}</button><button role="tab" aria-selected="${about}" class="${about ? 'on' : ''}" data-act="rvside" data-v="about">About this copy</button></div>
      <div class="tpane${about ? ' det' : ''}">${about ? facts : (soc ? postCard(c) : pageBoxHtml(c))}</div>
    </div></aside>`;
  return `${hd}<div class="rvn">${ctl}<div class="rvn-body split rv"><section class="card rvn-main review-cap" aria-label="Your client's photo and their copy">${pics}${rep}${ans}${cmd}</section>${side}</div></div>`;
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
  rvside: v => { state.rvSide = v === 'about' ? 'about' : 'page'; render(true); },
  rvkind: v => { setRvKind(v); state.rvHold = ''; render(true); },
  rvnext: () => { state.rvHold = ''; render(true); },
  cmode: v => { state.cmpMode = v; render(true); },
  rverdict: async v => {
    const c = FCD && FCD.copies.find(x => x.id === state.rvCurrent);
    if (!c || answering) return;
    answering = true;
    try {
      if (v === 'stolen') { v = await ruleGate(c); if (!v) return; }
      await answerCopies([c.id], v, c.site + ' ' + VERB[v]);
      if (state.rvHold === c.id) state.rvHold = '';
      // 4.63 (Ben, 2a): Stolen opens the same claim steps; Sent to legal or Finish later comes back here.
      if (v === 'stolen') { state.open = c.id; state.clBack = 'review'; state.clNext = ''; state.clOpenStep = ''; state.dTab = 'sum'; toastUndo(c.site + ' marked stolen. Finish the claim steps here.'); location.hash = 'found'; return; }
      toastUndo(c.site + ' ' + VERB[v] + '.');
      await render(true);
    } finally { answering = false; }
  },
  rvall: async v => {
    const ids = v.split('\n').filter(Boolean);
    await answerCopies(ids, 'stolen', plural(ids.length, 'copy', 'copies') + ' marked stolen');
    state.rvHold = ''; toastUndo(plural(ids.length, 'copy', 'copies') + ' marked stolen.'); render(true);
  },
  stopphoto: async v => { closeRowMenu(); await stopPhoto(v || state.open); },
  rvcompare: () => { state.open = state.rvCurrent; return ACTS.compare(); },
  // The same Capture and Approve site as the details panel, for the copy on screen here.
  rvcapture: async () => { state.open = state.rvCurrent; try { await ACTS.capturecopy(); } finally { state.open = ''; } },
  // 4.7: hide a site or account from One at a time; the next copy shows, Undo brings it back.
  rvhide: async v => { await hideSite(v); state.rvHold = ''; await render(true); },
  rvapprove: async v => { state.open = state.rvCurrent; try { await ACTS.approvesite(v); } finally { state.open = ''; } },
});

// Keyboard: answers in the details panel and on Review.
document.addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) return;
  if (document.querySelector('dialog[open]')) return;
  const r = route();
  if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) { if (HIST.length && ['found', 'review', 'owners'].includes(r)) { e.preventDefault(); undoLast(); } return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const map = { y: 'stolen', l: 'licensed', n: 'removed', Delete: 'removed', c: 'later', ArrowRight: 'skip' };
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  // 4.15: holding a key down gives ONE answer, not one copy after another.
  if (e.repeat && (map[k] || k === 'u')) { e.preventDefault(); return; }
  if (k === 'u' && HIST.length && ['found', 'review'].includes(r)) { e.preventDefault(); undoLast(); return; }
  if (r === 'found' && state.open) {
    if (k === 'Escape') { state.open = ''; render(true); return; }
    const c = FCD && FCD.copies.find(x => x.id === state.open);
    if (map[k] && c && c.status !== 'removed' && !(map[k] === 'later' && c.status === 'later') && !(typeof clOpen === 'function' && clOpen(c))) { e.preventDefault(); drawerVerdict(map[k]); }
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
  if (d.matches && d.matches('details.justhid')) state.justHidOpen = d.open;   // stays as you left it while the list redraws
  if (d.matches && d.matches('details.ddw') && d.open) document.querySelectorAll('details.ddw[open]').forEach(x => { if (x !== d) x.open = false; });
}, true);

// Calm look: drag the left edge of the copy panel to make it wider or narrower. The width is
// remembered on this computer. (--dwp is the room the list leaves for it.)
function ppDrawerRoom() { const d = document.getElementById('drawer'), c = document.getElementById('view'); if (c) { if (d && state.drawerW) c.style.setProperty('--dwp', state.drawerW + 'px'); else c.style.removeProperty('--dwp'); } }
document.addEventListener('pointerdown', e => {
  const g = e.target.closest && e.target.closest('#dgrip');
  if (!g) return;
  e.preventDefault();
  const d = document.getElementById('drawer');
  const move = ev => { const w = Math.max(400, Math.min(Math.round(window.innerWidth - ev.clientX), Math.round(window.innerWidth * 0.6), 1100)); state.drawerW = w; const el = document.getElementById('drawer'); if (el) { el.style.transition = 'none'; el.style.setProperty('--dw', w + 'px'); } ppDrawerRoom(); };   // the panel may have been redrawn mid-drag
  const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.body.style.userSelect = ''; const el = document.getElementById('drawer'); if (el) el.style.transition = ''; api.storage.local.set({ fcDrawerW: state.drawerW }).catch(() => {}); };
  document.body.style.userSelect = 'none'; d.style.transition = 'none';   // follows the mouse at once
  document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
});
try { new MutationObserver(ppDrawerRoom).observe(document.getElementById('view'), { childList: true }); } catch (e) { /* no page */ }
