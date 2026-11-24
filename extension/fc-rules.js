// 4.43 Copies found helpers (mechanics review, Ben's picks from batch 2). Loaded after fc-store.js.
//  1. Rule suggestions from your answers: 5+ copies removed on one site this month (none Stolen)
//     -> "Hide this site?"; 3+ copies of one client marked Licensed on one site -> "Approve it for
//     this client?". Each can be undone, put off for a week, or never asked again.
//  2. Each client's own site: a site whose name carries the client's name -> "Is it their own
//     site?" (asked once). Yes = approved for that client, so its copies are Licensed by themselves.
//  4. Weak Maybes put themselves away: a Maybe under 50% nobody answered in 30 days moves to Removed
//     ("Weak Maybe, never answered"). Not on sites with a Stolen copy. Put back still works.
//  8. Sweep a Stolen site: reads the site's own list of pages and pictures (its sitemap), slowly,
//     and compares each picture with the fingerprints of that client's photos. Matches go to New,
//     tagged "Found by sweep". No Google, Yandex or Bing searches are used.
const FC_RULES = (() => {
  const DAY = 864e5;
  const squash = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
  const siteName = base => squash(String(base || '').replace(/\.(co|com|org|net|gov|ac)?\.?[a-z]{2,}$/i, '').replace(/^www\./, ''));
  const hidden = (site, url) => { try { return typeof RS_LISTS !== 'undefined' && RS_LISTS.isHidden(site, url || ''); } catch (e) { return false; } };

  // ---------------------------------------------------------------- 1 + 2 rule suggestions
  async function asked() { return (await FC.meta.get('ruleAsked')) || {}; }
  async function setAsked(key, v) { const a = await asked(); a[key] = v; await FC.meta.set('ruleAsked', a); }
  async function suggestions(now = Date.now()) {
    const all = await FC.allCopies();
    const clients = new Map((await FC.DB.all('clients')).map(c => [c.name, c]));
    const a = await asked();
    const open = k => !(a[k] === true || (typeof a[k] === 'number' && a[k] > now));
    const since = now - 30 * DAY, sites = new Map();
    for (const c of all) {
      const base = FC.baseOf(c.site);
      let e = sites.get(base);
      if (!e) sites.set(base, e = { base, removed: 0, stolen: 0, lic: {}, fresh: [], social: false, stolenAt: '' });
      if (c.use === 'social' || (typeof RS_LISTS !== 'undefined' && RS_LISTS.wholeSocial && RS_LISTS.wholeSocial(base))) e.social = true;
      if (c.status === 'stolen') { e.stolen++; if ((c.answered || '') > e.stolenAt) { e.stolenAt = c.answered || ''; e.stolenClient = c.client; } }
      else if (c.status === 'removed' && !c.removedBy && Date.parse(c.answered || 0) > since) e.removed++;
      else if (c.status === 'licensed' && !c.auto && c.client) e.lic[c.client] = (e.lic[c.client] || 0) + 1;
      else if (c.status === 'new') e.fresh.push(c);
    }
    const out = [];
    for (const e of sites.values()) {
      if (e.social) continue;                 // a whole social site can't be hidden or approved
      if (e.removed >= 5 && !e.stolen && !hidden(e.base) && open('hide|' + e.base)) out.push({ kind: 'hide', key: 'hide|' + e.base, site: e.base, n: e.removed, fresh: e.fresh.length });
      for (const [cl, n] of Object.entries(e.lic)) {
        const c = clients.get(cl);
        if (n >= 3 && c && !(c.licensed || []).includes(e.base) && open('partner|' + cl + '|' + e.base)) out.push({ kind: 'partner', key: 'partner|' + cl + '|' + e.base, site: e.base, client: cl, n, fresh: e.fresh.filter(x => x.client === cl).length });
      }
      // The client's own site: its name is in the site's name ("Harbor Times" -> harbortimes.com).
      const sn = siteName(e.base);
      for (const cl of new Set(e.fresh.map(x => x.client).filter(Boolean))) {
        const c = clients.get(cl), nm = squash(cl);
        if (!c || nm.length < 5 || sn.length < 5 || (c.licensed || []).includes(e.base)) continue;
        if ((sn.includes(nm) || nm.includes(sn)) && open('own|' + cl + '|' + e.base)) out.push({ kind: 'own', key: 'own|' + cl + '|' + e.base, site: e.base, client: cl, n: e.fresh.filter(x => x.client === cl).length });
      }
      // 8: a site just marked Stolen can be swept for more of that client's photos.
      if (e.stolen && e.stolenAt && now - Date.parse(e.stolenAt) < 14 * DAY && e.stolenClient && open('sweep|' + e.base) && !(await sweepOf(e.base))) out.push({ kind: 'sweep', key: 'sweep|' + e.base, site: e.base, client: e.stolenClient, n: e.stolen });
    }
    const rank = { own: 0, partner: 1, sweep: 2, hide: 3 };
    return out.sort((x, y) => rank[x.kind] - rank[y.kind] || y.n - x.n).slice(0, 3);
  }
  // Yes to a suggestion. Returns an undo.
  async function accept(s) {
    await setAsked(s.key, true);
    if (typeof PP_STATS !== 'undefined') PP_STATS.add('rules.yes.' + s.kind);
    if (s.kind === 'partner' || s.kind === 'own') {
      await FC.licenseSite(s.client, s.site, true);
      if (s.kind === 'own') { const o = (await FC.meta.get('ownSites')) || {}; o[s.client] = [...new Set([...(o[s.client] || []), s.site])]; await FC.meta.set('ownSites', o); }
      const ids = (await FC.allCopies()).filter(c => c.status === 'new' && c.client === s.client && FC.baseOf(c.site) === s.site).map(c => c.id);
      const undoAns = ids.length ? await FC.answer(ids, 'licensed', { auto: s.kind === 'own' ? 'The client\'s own site' : 'Approved site for this client' }) : null;
      return async () => {
        await FC.licenseSite(s.client, s.site, false);
        if (undoAns) await undoAns();
        if (s.kind === 'own') { const o = (await FC.meta.get('ownSites')) || {}; o[s.client] = (o[s.client] || []).filter(x => x !== s.site); await FC.meta.set('ownSites', o); }
        await setAsked(s.key, undefined);
      };
    }
    if (s.kind === 'sweep') { await queueSweep(s.site, s.client); return async () => { await dropSweep(s.site); await setAsked(s.key, undefined); }; }
    return async () => { await setAsked(s.key, undefined); };    // hide: the page hides the site (and undoes it)
  }
  async function later(s) { await setAsked(s.key, Date.now() + 7 * DAY); if (typeof PP_STATS !== 'undefined') PP_STATS.add('rules.later.' + s.kind); }
  async function never(s) { await setAsked(s.key, true); if (typeof PP_STATS !== 'undefined') PP_STATS.add('rules.never.' + s.kind); }
  async function ownSites() { return (await FC.meta.get('ownSites')) || {}; }

  // ---------------------------------------------------------------- 4 weak Maybes
  const WEAK_PCT = 50, WEAK_DAYS = 30;
  function isWeak(c, stolenSites, now = Date.now()) {
    return c.status === 'new' && c.match === 'maybe' && c.pct != null && c.pct >= 0 && c.pct < WEAK_PCT && !c.skipped
      && now - Date.parse(c.firstSeen || now) > WEAK_DAYS * DAY && !c.known && !c.repeat && !stolenSites.has(FC.baseOf(c.site));
  }
  async function tidyWeak(now = Date.now()) {
    const all = await FC.allCopies();
    const stolen = new Set(all.filter(c => c.status === 'stolen').map(c => FC.baseOf(c.site)));
    const ids = all.filter(c => isWeak(c, stolen, now)).map(c => c.id);
    if (!ids.length) return 0;
    await FC.answer(ids, 'removed', { removedBy: 'weakmaybe' });
    const was = (await FC.meta.get('weakNote')) || null;
    await FC.meta.set('weakNote', { at: new Date(now).toISOString(), n: ids.length + (was && !was.seen ? was.n : 0), seen: false });
    if (typeof PP_STATS !== 'undefined') PP_STATS.add('rules.weakRemoved', ids.length);
    return ids.length;
  }
  async function weakNote() { return (await FC.meta.get('weakNote')) || null; }
  async function weakSeen() { const w = await weakNote(); if (w) await FC.meta.set('weakNote', { ...w, seen: true }); }

  // ---------------------------------------------------------------- 8 sweep a Stolen site
  // One site at a time, in Keep searching's hours, about one picture every 2 seconds. At most
  // 20 sitemaps, 2,000 pictures and 300 pages read per site. Only that client's photos that have
  // a fingerprint (every photo searched at least once has one) are compared.
  const MAX_MAPS = 20, MAX_PICS = 2000, MAX_PAGES = 300, CLOSE = 8;
  async function sweeps() { return (await FC.meta.get('sweeps')) || {}; }
  async function sweepOf(base) { return (await sweeps())[base] || null; }
  async function putSweep(base, s) { const all = await sweeps(); if (s) all[base] = s; else delete all[base]; await FC.meta.set('sweeps', all); FC.touch('sweeps'); }
  async function queueSweep(base, client) {
    if (await sweepOf(base)) return;
    await putSweep(base, { base, client, state: 'queued', at: new Date().toISOString(), maps: [], pics: [], pages: [], seen: 0, checked: 0, found: 0, failed: 0 });
    if (typeof PP_STATS !== 'undefined') PP_STATS.add('sweep.queued');
  }
  async function dropSweep(base) { await putSweep(base, null); }
  async function pauseSweep(base, on) { const s = await sweepOf(base); if (s && s.state !== 'done') await putSweep(base, { ...s, state: on ? 'paused' : 'queued' }); }
  const late = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('no answer')), ms))]);
  const get = async (url, kind = 'text', ms = 15000) => { const r = await late(fetch(url, { credentials: 'omit', redirect: 'follow' }), ms); if (!r.ok) throw new Error('answered ' + r.status); return kind === 'blob' ? r.blob() : r.text(); };
  // The sitemaps a site lists in robots.txt, else the usual addresses.
  async function firstMaps(base) {
    const home = (globalThis.PP_SWEEP_HOME || (b => 'https://' + b))(base);       // tests point it at a local server
    try {
      const robots = await get(home + '/robots.txt', 'text', 10000);
      const maps = [...robots.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map(m => m[1]);
      if (maps.length) return maps.slice(0, MAX_MAPS);
    } catch (e) { /* no robots.txt */ }
    return [home + '/sitemap.xml', home + '/sitemap_index.xml', home + '/news-sitemap.xml', home + '/image-sitemap.xml'];
  }
  // Reads one sitemap: more sitemaps, pages, and pictures (image sitemaps name them directly).
  function readMap(xml) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const tag = n => [...doc.getElementsByTagName('*')].filter(e => e.localName === n);
    const maps = tag('sitemap').map(s => [...s.children].find(e => e.localName === 'loc')).filter(Boolean).map(e => e.textContent.trim());
    const pics = [], pages = [];
    for (const u of tag('url')) {
      const loc = [...u.children].find(e => e.localName === 'loc');
      if (!loc) continue;
      const page = loc.textContent.trim();
      const imgs = [...u.getElementsByTagName('*')].filter(e => e.localName === 'loc' && e.parentElement && e.parentElement.localName === 'image').map(e => e.textContent.trim());
      if (imgs.length) for (const img of imgs) pics.push({ page, img }); else pages.push(page);
    }
    return { maps, pics, pages };
  }
  // The big pictures on one page (its share picture and the pictures in the story).
  function pagePics(html, page) {
    const out = new Set();
    const og = /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)/gi;
    for (const m of html.matchAll(og)) out.add(m[1]);
    for (const m of html.matchAll(/<img[^>]+src=["']([^"']+\.(?:jpe?g|png|webp)(?:\?[^"']*)?)["']/gi)) { if (out.size >= 6) break; out.add(m[1]); }
    return [...out].map(u => { try { return new URL(u.replace(/&amp;/g, '&'), page).href; } catch (e) { return ''; } }).filter(u => /^https?:/.test(u)).map(img => ({ page, img }));
  }
  const hamming = (a, b) => { let n = 0; for (let i = 0; i < 16; i += 8) { let v = (parseInt(a.slice(i, i + 8), 16) ^ parseInt(b.slice(i, i + 8), 16)) >>> 0; while (v) { n += v & 1; v >>>= 1; } } return n; };
  // One small step of the sweep that is running (or the next one queued). Returns false when there
  // was nothing to do. Never more than about 20 seconds.
  let looks = null;
  async function sweepStep() {
    const all = await sweeps();
    const s = Object.values(all).find(x => x.state === 'running') || Object.values(all).find(x => x.state === 'queued');
    if (!s) return false;
    if (s.state === 'queued') { s.state = 'running'; s.started = new Date().toISOString(); s.maps = await firstMaps(s.base); s.mapsRead = 0; await putSweep(s.base, s); return true; }
    const t0 = Date.now();
    try {
      // 1. Sitemaps first (newest last in the file, so the list is read from the end).
      if (s.maps.length && s.mapsRead < MAX_MAPS) {
        const url = s.maps.shift(); s.mapsRead++;
        try {
          const r = readMap(await get(url));
          s.maps.push(...r.maps.slice(-MAX_MAPS).reverse());
          s.pics.push(...r.pics.slice(-MAX_PICS)); s.pages.push(...r.pages.slice(-MAX_PAGES).reverse());
          s.pics = s.pics.slice(0, MAX_PICS); s.pages = s.pages.slice(0, MAX_PAGES);
        } catch (e) { s.failed++; }
        await putSweep(s.base, s); return true;
      }
      // 2. Pages without a picture list: read the page for its pictures.
      if (!s.pics.length && s.pages.length && (s.pagesRead || 0) < MAX_PAGES) {
        const page = s.pages.shift(); s.pagesRead = (s.pagesRead || 0) + 1;
        try { s.pics.push(...pagePics(await get(page), page)); } catch (e) { s.failed++; }
        await putSweep(s.base, s); return true;
      }
      // 3. Pictures: fingerprint each and compare with the client's photos.
      if (s.pics.length && s.seen < MAX_PICS) {
        if (!looks || looks.client !== s.client) looks = { client: s.client, list: (await FC.DB.all('photos')).filter(p => p.client === s.client && p.look && !p.gone).map(p => ({ id: p.id, look: p.look })) };
        s.looks = looks.list.length;
        while (s.pics.length && Date.now() - t0 < 15000) {
          const { page, img } = s.pics.shift(); s.seen++;
          let blob;
          try { blob = await get(img, 'blob', 12000); } catch (e) { s.failed++; continue; }
          if (!blob || blob.size < 4000 || blob.size > 15e6 || !/^image\//.test(blob.type || 'image/')) continue;
          let look;
          try { look = await FC.lookHash(blob); } catch (e) { continue; }
          s.checked++;
          const best = looks.list.map(p => [p, hamming(p.look, look)]).sort((a, b) => a[1] - b[1])[0];
          if (best && best[1] <= CLOSE && await addFound(best[0].id, page, img, s.base, best[1])) s.found++;
          await new Promise(r => setTimeout(r, 1500));
        }
        await putSweep(s.base, s); return true;
      }
    } catch (e) { console.warn('PageProof sweep:', e); s.failed++; }
    s.state = 'done'; s.done = new Date().toISOString();
    await putSweep(s.base, s);
    if (typeof PP_STATS !== 'undefined') { PP_STATS.add('sweep.done'); PP_STATS.add('sweep.found', s.found); }
    return true;
  }
  // A picture the sweep matched: added to New for that photo (once per page).
  async function addFound(photoId, page, img, base, dist) {
    const key = typeof RS_UTIL !== 'undefined' ? RS_UTIL.key(page) : page.replace(/^https?:\/\/(www\.)?/, '');
    const id = photoId + '|' + key;
    if (await FC.DB.get('copies', id)) return false;
    const pk = FC.pageKey(page);
    if ((await FC.copiesOf(photoId)).some(c => c.pk === pk)) return false;
    const p = await FC.DB.get('photos', photoId);
    if (!p) return false;
    const site = (() => { try { return new URL(page).hostname.replace(/^www\./, ''); } catch (e) { return base; } })();
    const now = new Date().toISOString();
    const n = { id, photo: photoId, client: p.client || '', url: page, key, pk, site, title: '', thumb: '', img, engines: [], exact: false, pct: Math.max(0, 100 - dist * 6), match: 'maybe',
      firstSeen: now, lastSeen: now, times: 1, by: 'a sweep of ' + base, sweep: 1, status: 'new', online: 'up' };
    n.country = FC.countryOf(site); n.use = FC.useOf(n);
    await FC.DB.put('copies', n);
    p.copies = (await FC.copiesOf(photoId)).filter(c => c.status !== 'removed').length;
    await FC.DB.put('photos', p);
    FC.touch('copies'); FC.backupCopiesSoon();
    return true;
  }

  return { suggestions, accept, later, never, ownSites, isWeak, tidyWeak, weakNote, weakSeen, sweeps, sweepOf, queueSweep, dropSweep, pauseSweep, sweepStep, readMap, pagePics, addFound, siteName, WEAK_PCT, WEAK_DAYS };
})();
