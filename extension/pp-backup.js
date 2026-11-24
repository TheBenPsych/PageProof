// 4.18.0: backups to your own Google Drive, and lists shared with your team.
//
// BACKUP: once a day (work days, 8 AM to 6 PM) PageProof saves one file, PageProof-backup-<date>.json.gz,
// into a "PageProof Backup" folder in YOUR OWN My Drive (through Google Drive for desktop). The last 14
// are kept. It holds your answers, copies found, hidden and approved sites, rejected links, clients,
// settings and capture log. Restoring first saves a "before restore" copy, so a restore can be undone.
//
// TEAM LISTS: a "PageProof Team" folder in someone's My Drive, shared with the team. Each person's
// PageProof writes ONLY its own file there (team-<id>.json) and reads everyone's. Nobody ever edits
// someone else's file, so Google Drive never has two versions of one file to choose between. For each
// site or account the newest answer from anyone wins (hidden, approved, or shown again).
//
// Neither folder may be the company shared drive or touch the photos folders: PageProof only ever
// READS the photos (see SECURITY.md). Every folder call has a time limit, because Google Drive can
// leave the browser's answer hanging (see RS_LATE in rs-store.js).
const PP_SYNC = (() => {
  const api = globalThis.browser || globalThis.chrome;
  const LATE = (p, ms, v) => RS_LATE(Promise.resolve(p).catch(() => v), ms, v);
  const KEEP = 14, KEEP_BEFORE = 3;
  const BASE = '2000-01-01T00:00:00.000Z'; // your lists from before you joined: any real answer from the team wins over them
  const FOLDER = { bk: 'bkDir', team: 'teamDir' };
  const supported = typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
  const pad = n => String(n).padStart(2, '0');
  const dayKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const workTime = (d = new Date()) => d.getDay() > 0 && d.getDay() < 6 && d.getHours() >= 8 && d.getHours() < 18;
  // Monday to Friday days between then and today (0 = today).
  function workDaysSince(t) {
    const d = new Date(t); d.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(0, 0, 0, 0);
    let n = 0;
    while (d < end && n < 400) { d.setDate(d.getDate() + 1); if (d.getDay() > 0 && d.getDay() < 6) n++; }
    return n;
  }
  const get = async k => (await api.storage.local.get(k))[k];
  const set = o => api.storage.local.set(o);

  // ---------------------------------------------------------------- the two folders
  async function handle(kind) { try { return await RS_DB.get('handles', FOLDER[kind]); } catch (e) { return null; } }
  // 'granted' · 'prompt' (one click on Allow) · 'none' (not set up) · 'offline' (Drive isn't answering)
  async function state(kind) {
    const h = await handle(kind);
    if (!h) return 'none';
    const p = await LATE(h.queryPermission({ mode: 'readwrite' }), 4000, 'slow');
    if (p === 'slow') return 'offline';
    if (p !== 'granted') return p === 'prompt' ? 'prompt' : 'none';
    // Can the folder be opened right now? With Drive for desktop closed or signed out it can't.
    const ok = await LATE((async () => { for await (const k of h.keys()) { void k; break; } return true; })(), 8000, false);
    return ok ? 'granted' : 'offline';
  }
  async function allow(kind) {
    const h = await handle(kind);
    if (!h) return false;
    return (await h.requestPermission({ mode: 'readwrite' })) === 'granted';
  }
  const refuse = (name, message) => { const e = new Error(message); e.name = name; throw e; };
  // Must be called from a click. kind 'bk': pick My Drive, PageProof makes "PageProof Backup" in it.
  // kind 'team': pick the PageProof Team folder (or My Drive that holds it). make: the team lead makes it.
  async function choose(kind, make) {
    const picked = await window.showDirectoryPicker({ id: 'pageproof-' + kind, mode: 'readwrite' });
    if (/^shared drives$/i.test(picked.name)) refuse('SharedDrive', 'That is the company\'s shared drive. PageProof never writes there. Pick My Drive instead.');
    if (await RS_DOCS.touchesPhotos(picked)) refuse('PhotosFolder', 'That folder is part of your photos folder. PageProof never writes there. Pick My Drive instead.');
    if (await RS_DOCS.isInstall(picked)) refuse('InstallFolder', 'That is the folder PageProof is installed in. PageProof never writes there. Pick My Drive instead.');
    const docs = await RS_DOCS.handle();
    if (docs) {
      const inside = (await LATE(docs.isSameEntry(picked), 2000, false)) || (await LATE(docs.resolve(picked), 2000, null)) !== null;
      if (inside) refuse('SameDisk', 'That is Documents › PageProof on this computer. A backup must be on Google Drive to survive a broken computer. Pick My Drive.');
    }
    let dir;
    if (kind === 'bk') dir = /^pageproof backup$/i.test(picked.name) ? picked : await picked.getDirectoryHandle('PageProof Backup', { create: true });
    else if (/^pageproof team$/i.test(picked.name)) dir = picked;
    else {
      dir = await LATE(picked.getDirectoryHandle('PageProof Team', { create: !!make }), 8000, null);
      if (!dir) refuse('NoTeam', 'There is no PageProof Team folder in there. Open My Drive and pick the PageProof Team folder (your team lead shares it with you).');
    }
    await RS_DB.put('handles', FOLDER[kind], dir);
    if (kind === 'team') await set({ ppTeamMade: make ? Date.now() : null });
    return dir;
  }
  async function forget(kind) { await RS_DB.del('handles', FOLDER[kind]); await set(kind === 'bk' ? { ppBkProblem: null } : { ppTeam: null, ppTeamProblem: null }); }

  async function files(dir) {
    return LATE((async () => { const out = []; for await (const [name, h] of dir.entries()) if (h.kind === 'file') out.push({ name, h }); return out; })(), 12000, null);
  }
  async function writeFile(dir, name, data) {
    return LATE((async () => { const w = await (await dir.getFileHandle(name, { create: true })).createWritable(); await w.write(data); await w.close(); return true; })(), 30000, false);
  }
  async function readFile(dir, name) { return LATE((async () => (await dir.getFileHandle(name)).getFile())(), 15000, null); }
  const gz = str => new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
  const ungz = blob => new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text();

  // ---------------------------------------------------------------- backups
  // Preview pictures (data: addresses) are left out: they are big and come back by themselves.
  const slim = o => { if (!o || typeof o !== 'object') return o; const r = {}; for (const [k, v] of Object.entries(o)) if (!(typeof v === 'string' && v.startsWith('data:'))) r[k] = v; return r; };
  async function snapshot() {
    await RS_LISTS.load();
    const st = await api.storage.local.get(['log', 'fcReports', 'ppTeamMine', 'ppTeamSkip', 'ppTeamRes']);
    const copies = (await FC.DB.all('copies')).map(slim);
    const settings = await FC.settingsSnapshot();
    const log = (st.log || []).map(slim);
    return {
      app: 'PageProof', kind: 'backup', version: api.runtime.getManifest().version, saved: new Date().toISOString(), by: settings.name || '',
      counts: { copies: copies.length, stolen: copies.filter(c => c.status === 'stolen').length, hidden: RS_LISTS.hidden.length, allowed: RS_LISTS.allowed.length, rejected: RS_REJECT.items.length, clients: (settings.clients || []).length, captures: log.length },
      settings, copies, lists: { hidden: RS_LISTS.hidden, allowed: RS_LISTS.allowed }, rejected: RS_REJECT.items, log, reports: st.fcReports || [],
      team: { mine: st.ppTeamMine || null, skip: st.ppTeamSkip || [], resolved: st.ppTeamRes || null },
    };
  }
  async function counts() {
    await RS_LISTS.load();
    const all = await FC.DB.all('copies');
    return { copies: all.length, stolen: all.filter(c => c.status === 'stolen').length, hidden: RS_LISTS.hidden.length, allowed: RS_LISTS.allowed.length, rejected: RS_REJECT.items.length, clients: await FC.DB.count('clients'), captures: ((await get('log')) || []).length };
  }
  const BK_RE = /^PageProof-backup-(before-restore-)?(\d{4}-\d\d-\d\d)(-\d{4})?\.json\.gz$/;
  async function backupNow(opts = {}) {
    const st = await state('bk');
    if (st !== 'granted') {
      if (st === 'offline') await set({ ppBkProblem: { at: Date.now(), why: 'offline' } });
      return { ok: false, why: st };
    }
    const dir = await handle('bk');
    const now = new Date();
    const name = opts.before ? `PageProof-backup-before-restore-${dayKey(now)}-${pad(now.getHours())}${pad(now.getMinutes())}.json.gz` : `PageProof-backup-${dayKey(now)}.json.gz`;
    const snap = await snapshot();
    const blob = await gz(JSON.stringify(snap));
    const ok = await writeFile(dir, name, blob);
    if (!ok) { await set({ ppBkProblem: { at: Date.now(), why: 'write' } }); return { ok: false, why: 'write' }; }
    if (!opts.before) await set({ ppBk: { at: Date.now(), file: name, size: blob.size, counts: snap.counts }, ppBkProblem: null });
    else await set({ ppBkProblem: null });
    prune(dir).catch(() => {});
    return { ok: true, name, size: blob.size, counts: snap.counts };
  }
  async function prune(dir) {
    const fs = await files(dir);
    if (!fs) return;
    const daily = fs.filter(f => BK_RE.test(f.name) && !f.name.includes('before-restore')).map(f => f.name).sort().reverse();
    const before = fs.filter(f => BK_RE.test(f.name) && f.name.includes('before-restore')).map(f => f.name).sort().reverse();
    for (const n of daily.slice(KEEP).concat(before.slice(KEEP_BEFORE))) await LATE(dir.removeEntry(n), 8000, null);
  }
  // Every backup in the folder, newest first: { name, day, before, size, modified }
  async function list() {
    if ((await state('bk')) !== 'granted') return null;
    const fs = await files(await handle('bk'));
    if (!fs) return null;
    const out = [];
    for (const f of fs) {
      const m = BK_RE.exec(f.name);
      if (!m) continue;
      const file = await LATE(f.h.getFile(), 8000, null);
      out.push({ name: f.name, day: m[2], before: !!m[1], size: file ? file.size : 0, modified: file ? file.lastModified : 0 });
    }
    return out.sort((a, b) => b.modified - a.modified || b.name.localeCompare(a.name));
  }
  async function read(name) {
    if (!BK_RE.test(name)) return null;
    const f = await readFile(await handle('bk'), name);
    if (!f) return null;
    const j = JSON.parse(await ungz(f));
    return j && j.app === 'PageProof' && j.kind === 'backup' ? j : null;
  }
  const str = v => (typeof v === 'string' ? v.slice(0, 4000) : '');
  // Put a backup back. A "before restore" backup of what is here now is saved first (unless there
  // is nothing here yet, as on a new computer), so this can always be undone.
  async function restore(j) {
    if (!j || j.app !== 'PageProof' || j.kind !== 'backup') throw new Error('That file is not a PageProof backup.');
    const now = await counts();
    const empty = !now.copies && !now.hidden && !now.allowed && !now.captures;
    if (!empty) {
      const safe = await backupNow({ before: true });
      if (!safe.ok) { const e = new Error('Could not save a safety copy of today\'s data first, so nothing was changed. Is Google Drive running?'); e.name = 'NoSafety'; throw e; }
    }
    const was = await api.storage.local.get(['fcDrive', 'fcKeep']);
    const oldClients = new Map((await FC.DB.all('clients')).map(c => [c.name, c]));
    await FC.restore(j.settings || {});
    // On this same computer, keep the photos link, Keep searching on/off and the photo counts.
    const keepSame = {};
    if (was.fcDrive && was.fcDrive.done) keepSame.fcDrive = was.fcDrive;
    if (was.fcKeep) keepSame.fcKeep = { ...((await get('fcKeep')) || {}), on: !!was.fcKeep.on };
    if (Object.keys(keepSame).length) await set(keepSame);
    if (oldClients.size) {
      const cs = await FC.DB.all('clients');
      await FC.DB.putMany('clients', cs.map(c => { const o = oldClients.get(c.name); return o ? { ...o, ...c, photos: o.photos, scanned: o.scanned, folder: o.folder, rel: o.rel, pick: o.pick, from: o.from } : c; }));
    }
    // Copies found: replaced by the backup's.
    const copies = (Array.isArray(j.copies) ? j.copies : []).filter(c => c && typeof c.id === 'string' && typeof c.photo === 'string' && /^https?:\/\//.test(c.url || ''));
    const old = await FC.DB.all('copies');
    await FC.DB.delMany('copies', old.map(c => c.id));
    await FC.DB.putMany('copies', copies);
    // Lists.
    const L = j.lists || {};
    RS_LISTS.hidden = RS_LISTS.parse((Array.isArray(L.hidden) ? L.hidden : []).map(str).join('\n'));
    RS_LISTS.allowed = RS_LISTS.parse((Array.isArray(L.allowed) ? L.allowed : []).map(str).join('\n'));
    team.applying = true;
    try { await RS_LISTS.save(); } finally { team.applying = false; }
    RS_REJECT.items = (Array.isArray(j.rejected) ? j.rejected : []).filter(r => r && typeof r.url === 'string').map(r => ({ url: str(r.url), pic: str(r.pic), why: r.why === 'nomatch' ? 'nomatch' : '' }));
    await RS_REJECT.save();
    // Capture log and evidence reports: anything missing here comes back; nothing here is lost.
    const merge = (here, back) => { const seen = new Set(here.map(x => JSON.stringify([x.id, x.at || x.time || x.date]))); return here.concat(back.filter(x => x && typeof x === 'object' && !seen.has(JSON.stringify([x.id, x.at || x.time || x.date])))); };
    const st = await api.storage.local.get(['log', 'fcReports']);
    await set({ log: merge(st.log || [], Array.isArray(j.log) ? j.log : []), fcReports: merge(st.fcReports || [], Array.isArray(j.reports) ? j.reports : []).slice(-2000) });
    // Team lists: the restored lists are where you are now, not new answers to send to the team.
    const t = j.team || {};
    const ch = (await get('ppTeamLast')) ? { ppTeamLast: { hidden: RS_LISTS.hidden, allowed: RS_LISTS.allowed } } : {};
    if (Array.isArray(t.skip)) ch.ppTeamSkip = t.skip.map(str).filter(Boolean);
    if (t.mine && typeof t.mine === 'object' && !(await get('ppTeamMine'))) ch.ppTeamMine = t.mine;
    await set(ch);
    FC.backupCopiesSoon(); FC.backupSoon(true);
    await set({ fcChanged: { what: 'restore', at: Date.now() }, ppRestoredAt: Date.now() });
    return { copies: copies.length, before: !empty };
  }

  // ---------------------------------------------------------------- team lists
  const team = { applying: false, who: new Map() };
  const ID_RE = /^team-([a-z0-9]{6,16})\.json$/;
  async function me() {
    let m = await get('ppTeamMe');
    if (!m || !/^[a-z0-9]{6,16}$/.test(m.id || '')) { m = { id: Array.from(crypto.getRandomValues(new Uint8Array(6)), b => (b % 36).toString(36)).join('') + Date.now().toString(36).slice(-4) }; await set({ ppTeamMe: m }); }
    m.name = (((await get('lastCase')) || {}).collector || '').trim() || 'Someone';
    return m;
  }
  const mapOf = (hidden, allowed) => { const m = new Map(); for (const e of allowed || []) m.set(e, 'allowed'); for (const e of hidden || []) m.set(e, 'hidden'); return m; };
  let syncing = null, soonT = null;
  function soon() { if (team.applying) return; clearTimeout(soonT); soonT = setTimeout(() => sync().catch(e => console.warn('PageProof: team lists', e)), 4000); }
  function sync() { return syncing || (syncing = sync1().finally(() => { syncing = null; })); }
  async function sync1() {
    const st = await state('team');
    if (st !== 'granted') {
      const prev = (await get('ppTeam')) || {};
      await set({ ppTeam: { ...prev, state: st }, ppTeamProblem: st === 'offline' ? ((await get('ppTeamProblem')) || { at: Date.now(), why: 'offline' }) : null });
      return { ok: false, state: st };
    }
    // Two PageProof pages (this one and the searching tab) must not sync at the same moment.
    const lock = await get('ppTeamLock');
    if (lock && Date.now() - lock < 60000) return { ok: false, state: 'busy' };
    await set({ ppTeamLock: Date.now() });
    try {
      const dir = await handle('team');
      const m = await me();
      await RS_LISTS.load();
      const S = await api.storage.local.get(['ppTeamMine', 'ppTeamLast', 'ppTeamRes', 'ppTeamSkip', 'ppTeamDirty']);
      const mine = S.ppTeamMine || {}, res = S.ppTeamRes || {}, skip = new Set(S.ppTeamSkip || []);
      const nowIso = new Date().toISOString();
      // 1. What you changed here since last time becomes your newest answers.
      const cur = mapOf(RS_LISTS.hidden, RS_LISTS.allowed);
      let mineChanged = 0;
      if (!S.ppTeamLast) { for (const [e, s] of cur) if (!mine[e]) { mine[e] = [s, BASE]; mineChanged++; } }
      else {
        const last = mapOf(S.ppTeamLast.hidden, S.ppTeamLast.allowed);
        for (const [e, s] of cur) if (!skip.has(e) && last.get(e) !== s) { mine[e] = [s, nowIso]; mineChanged++; }
        for (const [e] of last) if (!skip.has(e) && !cur.has(e)) { mine[e] = ['none', nowIso]; mineChanged++; }
      }
      // 2. Everyone's files, yours included.
      const fs = await files(dir);
      if (!fs) throw Object.assign(new Error('The team folder did not answer.'), { name: 'Offline' });
      const myFile = 'team-' + m.id + '.json';
      let wrote = true;
      if (mineChanged || S.ppTeamDirty || !fs.some(f => f.name === myFile)) {
        wrote = await writeFile(dir, myFile, JSON.stringify({ app: 'PageProof', kind: 'team', id: m.id, by: m.name, saved: nowIso, version: api.runtime.getManifest().version, events: mine, resolved: res }));
      }
      const people = [{ id: m.id, by: m.name, me: true, saved: nowIso, events: mine, resolved: res }];
      for (const f of fs) {
        const id = (ID_RE.exec(f.name) || [])[1];
        if (!id || id === m.id) continue;
        const file = await LATE(f.h.getFile(), 10000, null);
        if (!file || file.size > 50e6) continue;
        try {
          const j = JSON.parse(await LATE(file.text(), 15000, ''));
          if (j && j.app === 'PageProof' && j.kind === 'team' && j.events && typeof j.events === 'object') people.push({ id, by: str(j.by).slice(0, 80) || 'Someone', saved: str(j.saved), modified: file.lastModified, events: j.events, resolved: j.resolved && typeof j.resolved === 'object' ? j.resolved : {} });
        } catch (e) { /* half-synced or broken file: try again next time */ }
      }
      // 3. Newest answer wins. Also: who disagrees (one hid it, another approved it).
      const win = new Map(), sides = new Map(), resAt = new Map();
      for (const p of people) {
        for (const [e, at] of Object.entries(p.resolved || {})) if (typeof at === 'string' && (!resAt.has(e) || at > resAt.get(e))) resAt.set(e, at);
        for (const [raw, v] of Object.entries(p.events)) {
          if (!Array.isArray(v) || !['hidden', 'allowed', 'none'].includes(v[0]) || typeof v[1] !== 'string') continue;
          const e = p.me ? raw : RS_SITE.tidy(raw);
          if (!e) continue;
          const [s, at] = v, w = win.get(e);
          if (!w || at > w.at || (at === w.at && p.id > w.id)) win.set(e, { s, at, by: p.by, id: p.id, me: !!p.me });
          if (s !== 'none') { if (!sides.has(e)) sides.set(e, []); sides.get(e).push({ s, at, by: p.by, me: !!p.me }); }
        }
      }
      const disagree = [];
      for (const [e, list] of sides) {
        if (new Set(list.map(x => x.s)).size < 2) continue;
        const newest = list.reduce((a, x) => (x.at > a ? x.at : a), '');
        if (resAt.has(e) && resAt.get(e) >= newest) continue;
        disagree.push({ e, sides: list.sort((a, b) => (a.at < b.at ? 1 : -1)).map(x => ({ s: x.s, at: x.at === BASE ? '' : x.at, by: x.me ? 'You' : x.by })) });
      }
      // 4. Bring the team's answers into your lists (except the ones you chose to show for yourself).
      const hid0 = new Set(RS_LISTS.hidden), alw0 = new Set(RS_LISTS.allowed), hid = new Set(hid0), alw = new Set(alw0);
      let applied = 0;
      const who = {};
      for (const [e, w] of win) {
        if (!w.me && w.s !== 'none') who[e] = [w.by, w.at === BASE ? '' : w.at.slice(0, 10)];
        if (w.me) continue;
        const now = hid.has(e) ? 'hidden' : alw.has(e) ? 'allowed' : 'none';
        if (now === w.s) continue;
        if (w.s === 'hidden' && (skip.has(e) || RS_LISTS.wholeSocial(e))) continue;
        hid.delete(e); alw.delete(e);
        if (w.s === 'hidden') hid.add(e); else if (w.s === 'allowed') alw.add(e);
        applied++;
      }
      if (applied) {
        RS_LISTS.hidden = RS_LISTS.hidden.filter(x => hid.has(x)).concat([...hid].filter(x => !hid0.has(x)));
        RS_LISTS.allowed = RS_LISTS.allowed.filter(x => alw.has(x)).concat([...alw].filter(x => !alw0.has(x)));
        team.applying = true;
        try { await RS_LISTS.save(); } finally { team.applying = false; }
      }
      team.who = new Map(Object.entries(who));
      await set({
        ppTeamMine: mine, ppTeamDirty: !wrote, ppTeamLast: { hidden: RS_LISTS.hidden, allowed: RS_LISTS.allowed }, ppTeamWho: who,
        ppTeam: { at: Date.now(), state: 'granted', people: people.map(p => ({ by: p.me ? m.name : p.by, me: !!p.me, saved: p.saved, n: Object.values(p.events).filter(v => Array.isArray(v) && v[0] !== 'none').length })), disagree: disagree.slice(0, 500), nDisagree: disagree.length, applied, pending: wrote ? 0 : mineChanged + ((((await get('ppTeam')) || {}).pending) || 0) },
        ppTeamProblem: wrote ? null : { at: Date.now(), why: 'write' },
      });
      if (applied) await set({ fcChanged: { what: 'team', at: Date.now() } });
      return { ok: wrote, applied, people: people.length, disagree: disagree.length, mine: mineChanged };
    } catch (e) {
      await set({ ppTeamProblem: { at: Date.now(), why: e.name === 'Offline' ? 'offline' : 'error' }, ppTeamDirty: true });
      return { ok: false, state: 'offline' };
    } finally { await set({ ppTeamLock: 0 }); }
  }
  async function loadWho() { team.who = new Map(Object.entries((await get('ppTeamWho')) || {})); return team.who; }
  // Answer a disagreement: your answer becomes the newest, and the flag goes away for everyone.
  async function settle(e, s) {
    const S = await api.storage.local.get(['ppTeam', 'ppTeamMine', 'ppTeamRes']);
    // Your answer must be newer than every answer it settles, even if a teammate's clock runs fast.
    const d = ((S.ppTeam || {}).disagree || []).find(x => x.e === e);
    const newest = d ? d.sides.reduce((a, x) => Math.max(a, Date.parse(x.at) || 0), 0) : 0;
    const at = new Date(Math.max(Date.now(), newest) + 1000).toISOString();
    await RS_LISTS.load();
    team.applying = true;
    try { if (s === 'hidden' || s === 'allowed') await RS_LISTS.add(s, e); else await RS_LISTS.remove('hidden', e); } finally { team.applying = false; }
    const mine = S.ppTeamMine || {}, res = S.ppTeamRes || {};
    mine[e] = [s === 'hidden' || s === 'allowed' ? s : 'none', at]; res[e] = at;
    await set({ ppTeamMine: mine, ppTeamRes: res, ppTeamDirty: true, ppTeamLast: { hidden: RS_LISTS.hidden, allowed: RS_LISTS.allowed } });
    return sync();
  }
  // "Show for me": a site a teammate hid shows again on this computer only.
  async function showForMe(e, on = true) {
    const skip = new Set((await get('ppTeamSkip')) || []);
    await RS_LISTS.load();
    if (on) { skip.add(e); await set({ ppTeamSkip: [...skip] }); team.applying = true; try { await RS_LISTS.remove('hidden', e); } finally { team.applying = false; } }
    else { skip.delete(e); await set({ ppTeamSkip: [...skip] }); team.applying = true; try { await RS_LISTS.add('hidden', e); } finally { team.applying = false; } }
    // Keep the "last seen" lists in step, so this is not sent to the team as your answer.
    const last = (await get('ppTeamLast')) || null;
    if (last) await set({ ppTeamLast: { hidden: RS_LISTS.hidden, allowed: RS_LISTS.allowed } });
  }

  // ---------------------------------------------------------------- problems and timing
  // Something waiting because Google Drive isn't answering (Ben's idea 12).
  async function problem() {
    const st = await api.storage.local.get(['ppBkProblem', 'ppTeamProblem', 'ppTeam', 'ppBk']);
    const bk = st.ppBkProblem && Date.now() - st.ppBkProblem.at < 3 * 86400000 ? st.ppBkProblem : null;
    const tm = st.ppTeamProblem || null;
    if (!bk && !tm) return null;
    const pending = (st.ppTeam && st.ppTeam.pending) || 0;
    return { backup: !!bk, team: !!tm, pending, since: Math.min(bk ? bk.at : Infinity, tm ? tm.at : Infinity) };
  }
  // How the backup looks: [colour, text]
  async function backupLook() {
    const st = await state('bk');
    if (!supported) return ['grey', 'Backups to Google Drive work in Chrome and Edge.'];
    if (st === 'none') return ['warn', 'Not set up. If this computer broke, your finds and answers would be lost.'];
    if (st === 'prompt') return ['warn', 'Needs one click on Allow (your browser asks after it restarts).'];
    const bk = (await get('ppBk')) || null;
    if (st === 'offline') return ['bad', 'Google Drive isn\'t answering. The backup waits and goes out by itself when Drive is back.' + (bk ? ' Last backup ' + new Date(bk.at).toLocaleDateString() + '.' : '')];
    if (!bk) return ['warn', 'No backup yet. The first one is made in work hours (Monday to Friday, 8 to 6), or press Back up now.'];
    const n = workDaysSince(bk.at);
    const when = n === 0 ? 'today ' + new Date(bk.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : new Date(bk.at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    return [n >= 3 ? 'bad' : 'ok', (n >= 3 ? 'No backup for ' + n + ' work days. ' : '') + 'Last backup ' + when + '.'];
  }
  async function tick() {
    try {
      if ((await state('bk')) === 'granted' || (await get('ppBkProblem'))) {
        const st = await api.storage.local.get(['ppBk', 'ppBkLock']);
        const done = st.ppBk && dayKey(new Date(st.ppBk.at)) === dayKey(new Date());
        if (!done && workTime() && !(st.ppBkLock && Date.now() - st.ppBkLock < 180000)) {
          await set({ ppBkLock: Date.now() });
          try { await backupNow(); } finally { await set({ ppBkLock: 0 }); }
        }
      }
    } catch (e) { console.warn('PageProof: backup', e); }
    try { if (await handle('team')) await sync(); } catch (e) { console.warn('PageProof: team lists', e); }
  }
  let started = false;
  function start() {
    if (started || !supported) return;
    started = true;
    loadWho().catch(() => {});
    setTimeout(tick, 20000);
    setInterval(tick, 10 * 60000);
  }

  return { supported, state, allow, choose, forget, handle, backupNow, list, read, restore, counts, snapshot, sync, soon, settle, showForMe, loadWho, problem, backupLook, workDaysSince, workTime, tick, start, me, team, KEEP };
})();
// Every change to the hidden or approved lists is passed to the team a few seconds later.
if (typeof RS_LISTS !== 'undefined') {
  const save0 = RS_LISTS.save;
  RS_LISTS.save = async function () { const r = await save0.apply(this, arguments); try { if (PP_SYNC.supported && !PP_SYNC.team.applying) PP_SYNC.handle('team').then(h => { if (h) PP_SYNC.soon(); }); } catch (e) { /* no team */ } return r; };
}
// The pinned searching tab runs all day, so it makes the daily backup and keeps the team lists in step too.
if (typeof location !== 'undefined' && /\/runner\.html$/.test(location.pathname)) PP_SYNC.start();
