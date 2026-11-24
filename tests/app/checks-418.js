// 4.18.0: daily backup to your own Google Drive, safe restore, team lists (one file per person,
// newest answer wins, who added it, Show for me, the team disagrees), the "Google Drive isn't
// syncing" job, the Back up and share setup step and Moving to a new computer.
// The browser's own private folder stands in for My Drive. No real Drive, sites or people.
const { start } = require('./h.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const docs = await root.getDirectoryHandle('PageProof', { create: true });
    await RS_DB.put('handles', 'docs', docs);
    const my = await root.getDirectoryHandle('My Drive', { create: true });
    await RS_DB.put('handles', 'bkDir', await my.getDirectoryHandle('PageProof Backup', { create: true }));
    await RS_DB.put('handles', 'teamDir', await my.getDirectoryHandle('PageProof Team', { create: true }));
    await chrome.storage.local.set({ ppSetupDone: true, ppTourDone: true, ppSeenVersion: chrome.runtime.getManifest().version, ppReconnectVer: chrome.runtime.getManifest().version, lastCase: { collector: 'Ben Tester' }, rsHidden: ['a.com', 'b.com'], rsAllowed: ['c.com'] });
    const mk = i => ({ id: 'd:Client A/x.jpg|site' + i + '.com/p', photo: 'd:Client A/x.jpg', client: 'Client A', url: 'https://site' + i + '.com/p', key: 'site' + i + '.com/p', site: 'site' + i + '.com', thumb: 'data:image/png;base64,AAAA', img: '', engines: [], pct: 90, match: 'same', firstSeen: '2026-11-01', lastSeen: '2026-11-20', times: 1, status: i === 0 ? 'stolen' : 'new', online: 'up' });
    await FC.DB.putMany('copies', [mk(0), mk(1), mk(2)]);
    await FC.DB.put('clients', { name: 'Client A', searching: true, priority: false, licensed: [], photos: 7 });
    await RS_LISTS.load();
  });

  // ---- backup
  const b = await page.evaluate(async () => {
    const r = await PP_SYNC.backupNow();
    const l = await PP_SYNC.list();
    const j = await PP_SYNC.read(l[0].name);
    return { ok: r.ok, n: l.length, name: l[0].name, copies: j.counts.copies, stolen: j.counts.stolen, hidden: j.lists.hidden, thumb: j.copies[0].thumb, look: await PP_SYNC.backupLook(), at: (await chrome.storage.local.get('ppBk')).ppBk };
  });
  ok(b.ok && b.n === 1 && /^PageProof-backup-\d{4}-\d\d-\d\d\.json\.gz$/.test(b.name), 'Back up now saves one dated .json.gz file: ' + b.name);
  ok(b.copies === 3 && b.stolen === 1 && b.hidden.join() === 'a.com,b.com', 'the backup holds the copies, Stolen marks and hidden sites');
  ok(b.thumb === undefined, 'preview pictures are left out of the backup');
  ok(b.look[0] === 'ok' && /today/.test(b.look[1]), 'Last backup says today: ' + b.look[1]);
  const wd = await page.evaluate(() => [PP_SYNC.workDaysSince(Date.now()), PP_SYNC.workDaysSince(Date.now() - 7 * 86400000)]);
  ok(wd[0] === 0 && wd[1] === 5, 'work days since a backup are counted Monday to Friday: ' + wd);
  const red = await page.evaluate(async () => { const keep = (await chrome.storage.local.get('ppBk')).ppBk; await chrome.storage.local.set({ ppBk: { ...keep, at: Date.now() - 8 * 86400000 } }); const l = await PP_SYNC.backupLook(); await chrome.storage.local.set({ ppBk: keep }); return l; });
  ok(red[0] === 'bad' && /No backup for \d work days/.test(red[1]), 'the backup line turns red after 3 work days: ' + red[1]);

  // ---- safe restore
  const r = await page.evaluate(async () => {
    const l = await PP_SYNC.list();
    const j = await PP_SYNC.read(l[0].name);
    const ids = (await FC.DB.all('copies')).map(c => c.id);
    await FC.DB.delMany('copies', ids.slice(1));
    await RS_LISTS.load(); RS_LISTS.hidden = ['z.com']; await RS_LISTS.save();
    await chrome.storage.local.set({ fcDrive: { label: 'G:\\Shared drives\\Photos', done: true }, fcKeep: { on: true } });
    const res = await PP_SYNC.restore(j);
    await RS_LISTS.load();
    const after = await PP_SYNC.list();
    const cl = await FC.DB.get('clients', 'Client A');
    const st = await chrome.storage.local.get(['fcDrive', 'fcKeep']);
    return { res, copies: await FC.DB.count('copies'), hidden: RS_LISTS.hidden.join(), files: after.map(x => x.name), photos: cl && cl.photos, drive: st.fcDrive.done, keepOn: st.fcKeep.on };
  });
  ok(r.copies === 3 && r.hidden === 'a.com,b.com', 'restore brings back the copies and the hidden sites');
  ok(r.res.before && r.files.some(n => n.includes('before-restore')), 'restore saved a "before restore" backup first: ' + r.files.join(', '));
  ok(r.drive === true && r.keepOn === true && r.photos === 7, 'restore keeps the photos link, Keep searching on and the photo counts on this computer');

  // ---- team lists
  const t = await page.evaluate(async () => {
    const team = await RS_DB.get('handles', 'teamDir');
    const soon = new Date(Date.now() + 60000).toISOString();
    const w = await (await team.getFileHandle('team-mate000001.json', { create: true })).createWritable();
    await w.write(JSON.stringify({ app: 'PageProof', kind: 'team', id: 'mate000001', by: 'Sam', saved: soon, events: { 'd.com': ['hidden', soon], 'c.com': ['hidden', soon], 'a.com': ['none', soon] }, resolved: {} }));
    await w.close();
    const s = await PP_SYNC.sync();
    await RS_LISTS.load();
    const me = (await chrome.storage.local.get('ppTeamMe')).ppTeamMe;
    const mine = JSON.parse(await (await (await team.getFileHandle('team-' + me.id + '.json')).getFile()).text());
    const T = (await chrome.storage.local.get('ppTeam')).ppTeam;
    return { s, hidden: RS_LISTS.hidden, allowed: RS_LISTS.allowed, mineEvents: mine.events, by: mine.by, people: T.people.length, dis: T.disagree, who: (await chrome.storage.local.get('ppTeamWho')).ppTeamWho };
  });
  ok(t.s.ok && t.people === 2, 'sync reads both people\'s files');
  ok(t.hidden.includes('d.com') && !t.hidden.includes('a.com'), 'a teammate\'s newer answers come in: d.com hidden, a.com shown again');
  ok(t.hidden.includes('c.com') && !t.allowed.includes('c.com'), 'newest answer wins: Sam hid c.com after you approved it');
  ok(t.mineEvents['b.com'] && t.mineEvents['b.com'][0] === 'hidden' && t.by === 'Ben Tester', 'your own file holds your lists, with your name');
  ok(t.dis.length === 1 && t.dis[0].e === 'c.com', 'the team disagrees on c.com (hidden by one, approved by another)');
  ok(t.who['d.com'] && t.who['d.com'][0] === 'Sam', 'who added d.com is remembered: Sam');

  // ---- pages
  await page.goto(url('app.html#hidden')); await page.waitForTimeout(1200);
  const hid = await page.evaluate(() => ({ tag: [...document.querySelectorAll('tr')].some(tr => /d\.com/.test(tr.textContent) && /Team · Sam/.test(tr.textContent)), btn: !!document.querySelector('[data-act="teamskip"][data-v="d.com"]') }));
  ok(hid.tag && hid.btn, 'Hidden sites shows "Team · Sam" and Show for me on d.com');
  await page.goto(url('app.html#team')); await page.waitForTimeout(1200);
  ok(await page.evaluate(() => !!document.getElementById('teamDis') && /disagrees on 1 site/.test(document.body.textContent) && /Shared with 1 teammate: Sam/.test(document.body.textContent)), 'Team lists shows the disagreement and who shares');
  await page.click('[data-act="teamsettle"][data-v="allowed|c.com"]'); await page.waitForTimeout(1500);
  const set1 = await page.evaluate(async () => { await RS_LISTS.load(); const T = (await chrome.storage.local.get('ppTeam')).ppTeam; return { allowed: RS_LISTS.allowed.includes('c.com'), n: T.nDisagree, page: !!document.getElementById('teamDis') }; });
  ok(set1.allowed && set1.n === 0 && !set1.page, 'Keep it approved settles it for everyone and the flag goes away');
  // Show for me
  await page.evaluate(async () => { await PP_SYNC.showForMe('d.com', true); await PP_SYNC.sync(); });
  const sk = await page.evaluate(async () => { await RS_LISTS.load(); const me = (await chrome.storage.local.get('ppTeamMe')).ppTeamMe; const team = await RS_DB.get('handles', 'teamDir'); const mine = JSON.parse(await (await (await team.getFileHandle('team-' + me.id + '.json')).getFile()).text()); return { hidden: RS_LISTS.hidden.includes('d.com'), sent: mine.events['d.com'], skip: (await chrome.storage.local.get('ppTeamSkip')).ppTeamSkip }; });
  ok(!sk.hidden && !sk.sent, 'Show for me shows d.com on this computer only and sends nothing to the team');
  // A change here goes to the team by itself a few seconds later
  await page.evaluate(async () => { await RS_LISTS.load(); await RS_LISTS.add('hidden', 'e.com'); });
  await page.waitForTimeout(6000);
  const e = await page.evaluate(async () => { const me = (await chrome.storage.local.get('ppTeamMe')).ppTeamMe; const team = await RS_DB.get('handles', 'teamDir'); const mine = JSON.parse(await (await (await team.getFileHandle('team-' + me.id + '.json')).getFile()).text()); return mine.events['e.com']; });
  ok(e && e[0] === 'hidden' && e[1] > '2026', 'hiding e.com here is saved to your team file by itself: ' + JSON.stringify(e));

  // Backups page and restore preview
  await page.goto(url('app.html#backups')); await page.waitForTimeout(1500);
  ok(await page.evaluate(() => document.querySelectorAll('[data-act="bklook"]').length >= 2), 'Backups lists the backups by date');
  await page.click('[data-act="bklook"]'); await page.waitForTimeout(1200);
  ok(await page.evaluate(() => { const p = document.getElementById('bkPreview'); return !!p && /Now/.test(p.textContent) && /After restoring/.test(p.textContent) && /Before a restore/.test(p.textContent); }), 'Look at it shows now vs after restoring and the safety copy note');

  // Settings cards, health lights, setup step, moving page
  await page.goto(url('app.html#settings')); await page.waitForTimeout(1200);
  ok(await page.evaluate(() => !!document.getElementById('setBackups') && !!document.getElementById('setTeam')), 'Settings has Backups and Team lists cards');
  await page.goto(url('app.html#health')); await page.waitForTimeout(2500);
  ok(await page.evaluate(() => /Backup to Google Drive/.test(document.body.textContent) && /Team lists/.test(document.body.textContent)), 'Is everything working shows backup and team lights');
  await page.goto(url('app.html#moving')); await page.waitForTimeout(1000);
  ok(await page.evaluate(() => (document.body.textContent.match(/Step \d of 3/g) || []).length === 3), 'Moving to a new computer has 3 steps');
  await page.evaluate(() => { state.setup = 2; location.hash = 'setup'; }); await page.waitForTimeout(1500);
  ok(await page.evaluate(() => /Step 3 of 5/.test(document.body.textContent) && /Back up and share/.test(document.body.textContent) && !!document.querySelector('[data-act="teamcopy"]') && document.querySelectorAll('.dmenu').length >= 2), 'setup step 3 is Back up and share with the team guide and pictures');

  // Google Drive stops answering
  await page.evaluate(async () => { const root = await navigator.storage.getDirectory(); const my = await root.getDirectoryHandle('My Drive'); await my.removeEntry('PageProof Team', { recursive: true }); await PP_SYNC.sync(); });
  await page.goto(url('app.html#home')); await page.waitForTimeout(2000);
  ok(await page.evaluate(() => !!document.getElementById('jobDrivePaused')), 'Home says Google Drive isn\'t syncing when the team folder can\'t be reached');

  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await ctx.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e); process.exit(1); });
