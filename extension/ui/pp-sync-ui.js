// 4.18.0 pages for backups and team lists (the work itself is in pp-backup.js):
// Settings › Backups (#backups), Settings › Team lists (#team), Moving to a new computer (#moving),
// a "Back up and share" step in first-time setup, who added a team entry on Hidden and approved
// sites, Home jobs when Google Drive isn't answering or the team disagrees, and two health lights.
Object.assign(PP_ROUTES, { backups: ['settings', 'settings'], team: ['settings', 'settings'], moving: ['settings', 'settings'] });
Object.assign(PP_CRUMBS, { backups: 'Settings › Backups', team: 'Settings › Team lists', moving: 'Settings › Moving to a new computer' });
Object.assign(state, { bkList: null, bkBusy: false, bkPick: null, bkPreview: null, bkNow: null, teamCheck: '', teamWho: 'lead' });

(function addStyle() {
  const s = document.createElement('style');
  s.textContent = `
  .dmenu{display:inline-flex;flex-direction:column;min-width:190px;align-self:flex-start;width:max-content;max-width:100%;background:var(--surface);border:1px solid var(--line);border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.12);padding:4px 0;font-size:13px}
  .dmenu span{padding:5px 12px;color:var(--ink)}
  .dmenu span.hl{background:color-mix(in srgb,var(--accent) 16%,transparent);font-weight:600;outline:2px solid var(--accent);outline-offset:-2px;border-radius:4px}
  .dmenu span.sep{padding:0;border-top:1px solid var(--line);margin:3px 0}
  .gsteps{display:flex;flex-direction:column;gap:12px;margin:0;padding:0;list-style:none;counter-reset:g}
  .gsteps>li{display:grid;grid-template-columns:28px 1fr;gap:10px;align-items:start;counter-increment:g}
  .gsteps>li::before{content:counter(g);width:26px;height:26px;border-radius:50%;background:var(--accent);color:var(--accent-ink,#fff);font-weight:700;font-size:13px;display:grid;place-items:center}
  .gsteps>li>div{display:flex;flex-direction:column;gap:6px;min-width:0}
  .gpath{font-family:ui-monospace,Consolas,monospace;font-size:12.5px;background:var(--bg);border:1px solid var(--line);padding:1px 6px;border-radius:6px;overflow-wrap:anywhere}
  .ppchk{display:flex;flex-direction:column;gap:10px;border:1px solid var(--line);border-radius:12px;padding:16px;background:var(--surface)}
  `;
  document.head.append(s);
})();

const SYNC_TAG = { ok: 'ok', warn: 'warn', bad: 'bad', grey: 'grey' };
const kb = n => n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1000)) + ' KB';
const dmenu = (items, hl) => `<span class="dmenu" aria-hidden="true">${items.map(i => i === '-' ? '<span class="sep"></span>' : `<span class="${i === hl ? 'hl' : ''}">${i}</span>`).join('')}</span>`;
const pickErr = e => {
  if (!e || e.name === 'AbortError') return;
  if (['SharedDrive', 'PhotosFolder', 'InstallFolder', 'SameDisk', 'NoTeam'].includes(e.name)) toast(e.message);
  else toast('The browser refused that folder. Pick My Drive (inside Google Drive in File Explorer).');
};

// ---------------------------------------------------------------- the team guide (setup and Team lists)
const TEAM_STEPS_TEXT = `How to get PageProof's team lists (2 minutes, once):
1. Go to drive.google.com and click "Shared with me" on the left.
2. Right-click the "PageProof Team" folder and choose Organize > Add shortcut. Pick "My Drive", then "Add".
3. Wait about a minute. The folder then shows up on your computer in File Explorer under Google Drive > My Drive > PageProof Team.
4. In PageProof, open Settings > Team lists and press "Pick the PageProof Team folder". Click Google Drive, then My Drive, then PageProof Team, then "Select Folder". If the browser asks, press "Allow".
5. Press "Check it works". It should say the lists are shared.`;
function teamGuide(st) {
  const lead = state.teamWho === 'lead';
  const seg = `<div class="seg" role="group" aria-label="Who are you?"><button class="${lead ? 'on' : ''}" aria-pressed="${lead}" data-act="teamwho" data-v="lead">I'm the team lead (I make the folder)</button><button class="${lead ? '' : 'on'}" aria-pressed="${!lead}" data-act="teamwho" data-v="mate">A teammate shared it with me</button></div>`;
  const pickBtn = `<button class="btn${st === 'granted' ? '' : ' primary'}" style="align-self:flex-start" data-act="teampick">${ic('files', 16)} Pick the PageProof Team folder</button>`;
  const steps = lead ? `
    <li><div><b>Make the folder.</b><span class="muted" style="font-size:13.5px">Press the button, then click <b>Google Drive</b> › <b>My Drive</b> and <b>Select Folder</b>. PageProof makes a folder called PageProof Team there.</span>
      <button class="btn${st === 'granted' ? '' : ' primary'}" style="align-self:flex-start" data-act="teammake">${ic('files', 16)} Make the team folder in My Drive</button></div></li>
    <li><div><b>Share it on the Google Drive website.</b><span class="muted" style="font-size:13.5px">Open <a href="https://drive.google.com/drive/my-drive" target="_blank" rel="noopener">drive.google.com</a> (My Drive). Right-click <b>PageProof Team</b>, then <b>Share</b> › <b>Share</b>.</span>
      ${dmenu(['Open with', 'Download', 'Rename', '-', 'Share', 'Organize', 'Folder information', '-', 'Move to trash'], 'Share')}</div></li>
    <li><div><b>Add your team as Editors.</b><span class="muted" style="font-size:13.5px">Type each teammate's work email. Leave the role on <b>Editor</b> (PageProof needs to save each person's own file). Press <b>Send</b>.</span>
      ${dmenu(['Viewer', 'Commenter', 'Editor'], 'Editor')}</div></li>
    <li><div><b>Send your team the steps.</b><span class="muted" style="font-size:13.5px">This copies the teammate steps, ready to paste into an email or chat.</span>
      <button class="btn" style="align-self:flex-start" data-act="teamcopy">${ic('doc', 16)} Copy the steps for your team</button></div></li>`
    : `
    <li><div><b>Find the folder on the Google Drive website.</b><span class="muted" style="font-size:13.5px">Open <a href="https://drive.google.com/drive/shared-with-me" target="_blank" rel="noopener">drive.google.com › Shared with me</a>.</span></div></li>
    <li><div><b>Add it to your My Drive.</b><span class="muted" style="font-size:13.5px">Right-click <b>PageProof Team</b>, then <b>Organize</b> › <b>Add shortcut</b>. Pick <b>My Drive</b>, then <b>Add</b>.</span>
      <span class="row" style="gap:8px;align-items:flex-start">${dmenu(['Open with', 'Download', 'Rename', '-', 'Share', 'Organize', 'Folder information'], 'Organize')}${dmenu(['Move', 'Add shortcut', 'Add to starred'], 'Add shortcut')}</span></div></li>
    <li><div><b>Wait about a minute.</b><span class="muted" style="font-size:13.5px">It then shows up on this computer: File Explorer › Google Drive › My Drive › PageProof Team.</span></div></li>
    <li><div><b>Pick it here.</b><span class="muted" style="font-size:13.5px">Click <b>Google Drive</b> › <b>My Drive</b> › <b>PageProof Team</b>, then <b>Select Folder</b>. If the browser asks, press <b>Allow</b>.</span>${pickBtn}</div></li>`;
  return `${seg}<ol class="gsteps">${steps}
    <li><div><b>Check it works.</b><span class="muted" style="font-size:13.5px">PageProof saves your file in the folder and reads your teammates' files.</span>
      <button class="btn" style="align-self:flex-start" data-act="teamcheck" ${st === 'none' ? 'disabled title="Pick the folder first"' : ''}>${ic('check', 16)} Check it works</button>${state.teamCheck ? `<span style="font-size:14px">${state.teamCheck}</span>` : ''}</div></li></ol>`;
}
function teamPeopleText(t) {
  if (!t || !t.people) return '';
  const others = t.people.filter(p => !p.me).map(p => esc(p.by));
  return others.length ? `Shared with ${others.length} ${others.length === 1 ? 'teammate' : 'teammates'}: ${others.slice(0, 8).join(', ')}${others.length > 8 ? ' and more' : ''}.` : 'Only you so far. Your teammates show up here once they pick the folder.';
}

// ---------------------------------------------------------------- Settings › Backups
const bkFolderRow = st => st === 'granted' ? `<span class="tag ok">${ic('check', 13, 3)} Saving to My Drive › PageProof Backup</span><button class="btn" data-act="bkpick">Change folder</button>`
  : st === 'prompt' ? `<span class="tag warn">Needs one click</span><button class="btn primary" data-act="bkallow">Allow</button>`
  : st === 'offline' ? `<span class="tag bad">Google Drive isn't answering</span><button class="btn" data-act="bkretry">Try again</button><button class="btn" data-act="bkpick">Pick the folder again</button>`
  : `<button class="btn primary" data-act="bkpick">${ic('files', 16)} Pick My Drive</button><span class="faint" style="font-size:13px">In the window, click <b>Google Drive</b>, then <b>My Drive</b>, then <b>Select Folder</b>. PageProof makes a PageProof Backup folder inside it.</span>`;
V.backups = async () => {
  if (!PP_SYNC.supported) return `${head('Settings', 'Backups', '')}<section class="card pad">Backups to Google Drive work in Chrome and Edge.</section>`;
  const st = await PP_SYNC.state('bk');
  const [col, txt] = await PP_SYNC.backupLook();
  const bk = (await api.storage.local.get('ppBk')).ppBk;
  const P = state.bkPreview, N = state.bkNow;
  const rowsHtml = state.bkList == null ? `<p class="muted" style="margin:0">${st === 'granted' ? 'Looking for backups…' : 'Pick the backup folder first.'}</p>`
    : !state.bkList.length ? '<p class="muted" style="margin:0">No backups in the folder yet.</p>'
    : `<div class="scroll"><table><thead><tr><th>Saved</th><th>Size</th><th></th></tr></thead><tbody>${state.bkList.map(b => `<tr><td><b>${esc(new Date(b.modified || b.day).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }))}</b>${b.before ? ' <span class="tag grey">Before a restore</span>' : ''}</td><td class="num">${kb(b.size)}</td><td style="text-align:right"><button class="btn" style="min-height:32px;font-size:13px" data-act="bklook" data-v="${esc(b.name)}">Look at it</button></td></tr>`).join('')}</tbody></table></div>`;
  const C = [['copies', 'Copies found'], ['stolen', 'Marked Stolen'], ['hidden', 'Hidden sites and accounts'], ['allowed', 'Approved sites and accounts'], ['rejected', 'Rejected links'], ['clients', 'Clients'], ['captures', 'Captures in the log']];
  const preview = !P ? '' : `<section class="card pad" id="bkPreview" style="display:flex;flex-direction:column;gap:12px;border-color:var(--accent)">
    <h2>Restore the backup from ${esc(fmtDate(P.saved))}?</h2>
    ${P.by ? `<span class="muted" style="font-size:13.5px">Made by ${esc(P.by)}'s PageProof ${esc(P.version || '')}.</span>` : ''}
    <div class="scroll"><table><thead><tr><th></th><th class="num">Now</th><th class="num">After restoring</th></tr></thead><tbody>${C.map(([k, l]) => { const a = N ? N[k] : 0, b = (P.counts || {})[k] || 0; return `<tr><td>${l}</td><td class="num">${(a || 0).toLocaleString()}</td><td class="num"${a !== b ? ' style="font-weight:700"' : ''}>${b.toLocaleString()}</td></tr>`; }).join('')}</tbody></table></div>
    <div class="banner info" style="padding:10px 12px"><span style="flex:1;font-size:14px">${N && (N.copies || N.hidden || N.captures) ? 'Your data right now is saved first as a <b>"Before a restore"</b> backup, so you can go back to it from this list.' : 'There is nothing in PageProof on this computer yet, so nothing is lost.'} Your photos link and Keep searching stay as they are. Preview pictures come back by themselves.</span></div>
    <div class="row" style="gap:8px"><button class="btn primary" data-act="bkrestore" ${state.bkBusy ? 'disabled' : ''}>${state.bkBusy ? 'Restoring…' : 'Restore'}</button><button class="btn" data-act="bkcancel">Cancel</button></div></section>`;
  return `${head('Settings', 'Backups', 'Once a day (Monday to Friday, 8 to 6) PageProof saves a copy of your work to your own Google Drive. Only you can see it. The last ' + PP_SYNC.KEEP + ' are kept.', `<button class="btn primary" data-act="bknow" ${st === 'granted' && !state.bkBusy ? '' : 'disabled title="Pick the backup folder first"'}>${state.bkBusy === 'now' ? 'Backing up…' : 'Back up now'}</button>`)}
  ${preview}
  <div class="grid g2">
    <section class="card pad" style="display:flex;flex-direction:column;gap:12px"><h2>Your backup</h2>
      <div class="row" style="gap:10px"><span class="tag ${SYNC_TAG[col]}">${col === 'ok' ? 'Backed up' : col === 'bad' ? 'Needs you' : col === 'grey' ? 'Off' : 'Not yet'}</span><span style="font-size:14px">${esc(txt)}</span></div>
      ${bk ? `<span class="faint" style="font-size:13px">${kb(bk.size)} · ${(bk.counts.copies || 0).toLocaleString()} copies · ${(bk.counts.hidden || 0).toLocaleString()} hidden sites</span>` : ''}
      <div class="row" style="gap:8px">${bkFolderRow(st)}</div>
      <span class="faint" style="font-size:12.5px">Holds your answers, copies found, hidden and approved sites and accounts, rejected links, clients, settings and capture log. Evidence packs you saved stay where you saved them.</span></section>
    <section class="card pad" style="display:flex;flex-direction:column;gap:12px"><h2>New computer?</h2>
      <p class="muted" style="margin:0;font-size:14px">Three guided steps: back up here, install PageProof there, then restore.</p>
      <a class="btn" style="align-self:flex-start" href="#moving">Moving to a new computer</a></section>
  </div>
  <section class="card pad" style="display:flex;flex-direction:column;gap:12px"><h2>Restore a backup</h2>${rowsHtml}</section>`;
};
V.backups.noAutoRedraw = true;
V.backups.after = async () => {
  if (state.bkList != null || state.bkListing) return;
  state.bkListing = true;
  try { state.bkList = (await PP_SYNC.list()) || null; if (state.bkList && state.shown === 'backups') render(true); }
  finally { state.bkListing = false; }
};

// ---------------------------------------------------------------- Settings › Team lists
V.team = async () => {
  if (!PP_SYNC.supported) return `${head('Settings', 'Team lists', '')}<section class="card pad">Team lists work in Chrome and Edge.</section>`;
  const st = await PP_SYNC.state('team');
  const s = await api.storage.local.get(['ppTeam', 'ppTeamSkip']);
  const t = s.ppTeam || {}, skip = s.ppTeamSkip || [];
  const look = st === 'granted' ? ['ok', 'Sharing'] : st === 'prompt' ? ['warn', 'Needs one click'] : st === 'offline' ? ['bad', 'Google Drive isn\'t answering'] : ['grey', 'Not set up'];
  const SAY = { hidden: 'hid it', allowed: 'approved it' };
  const dis = (t.disagree || []).map(d => `<tr><td><b class="mono" style="font-size:13px;overflow-wrap:anywhere">${esc(d.e)}</b><div class="muted" style="font-size:13px">${d.sides.map(x => `${esc(x.by)} ${SAY[x.s]}${x.at ? ' on ' + esc(new Date(x.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })) : ' (before joining)'}`).join(' · ')}</div></td>
    <td style="text-align:right;white-space:nowrap"><button class="btn" style="min-height:32px;font-size:13px" data-act="teamsettle" data-v="hidden|${esc(d.e)}">Keep it hidden</button> <button class="btn" style="min-height:32px;font-size:13px" data-act="teamsettle" data-v="allowed|${esc(d.e)}">Keep it approved</button></td></tr>`).join('');
  return `${head('Settings', 'Team lists', 'Hidden and approved sites and accounts are shared with your team through one PageProof Team folder on Google Drive. Each person\'s PageProof saves only its own file there, so nobody\'s answers get lost.', st === 'granted' ? `<button class="btn" data-act="teamcheck">Check it works</button>` : '')}
  <section class="card pad" style="display:flex;flex-direction:column;gap:10px">
    <div class="row" style="gap:10px"><h2>Sharing</h2><span class="tag ${look[0]}" style="margin-left:auto">${look[1]}</span></div>
    ${st === 'granted' ? `<span style="font-size:14px">${teamPeopleText(t)}</span>${t.at ? `<span class="faint" style="font-size:13px">Last checked ${esc(agoText(t.at))}. It checks every 10 minutes and a few seconds after you hide or approve something.</span>` : ''}`
      : st === 'prompt' ? `<span class="muted" style="font-size:14px">Your browser asks once after it restarts.</span><button class="btn primary" style="align-self:flex-start" data-act="teamallow">Allow</button>`
      : st === 'offline' ? `<span class="muted" style="font-size:14px">Your changes wait and go out by themselves when Drive is back. Check Google Drive for desktop is running and signed in (its icon by the clock).</span><button class="btn" style="align-self:flex-start" data-act="teamretry">Try again</button>`
      : `<span class="muted" style="font-size:14px">Follow the steps below once. It takes about 2 minutes.</span>`}
    ${st !== 'none' ? `<div class="row" style="gap:8px"><button class="btn" data-act="teampick">Pick the folder again</button><button class="btn ghost" data-act="teamstop">Stop sharing on this computer</button></div>` : ''}
    <span class="faint" style="font-size:12.5px">Copies you marked Stolen are never hidden by anyone's list. A site a teammate hid can be shown again for you only, from Hidden and approved sites.</span>
  </section>
  ${t.nDisagree ? `<section class="card" id="teamDis" style="overflow:hidden"><div class="pad"><h2>The team disagrees on ${t.nDisagree === 1 ? '1 site' : t.nDisagree.toLocaleString() + ' sites'}</h2><p class="muted" style="margin:4px 0 0;font-size:14px">One person hid these and another approved them. Until you choose, the newest answer is used. Your choice goes to everyone.</p></div>
    <div class="scroll"><table><tbody>${dis}</tbody></table></div></section>` : ''}
  ${skip.length ? `<section class="card" style="overflow:hidden"><div class="pad"><h2>Shown for you only</h2><p class="muted" style="margin:4px 0 0;font-size:14px">A teammate hid these. They still show on this computer.</p></div><div class="scroll"><table><tbody>${skip.map(e => `<tr><td><b class="mono" style="font-size:13px">${esc(e)}</b></td><td style="text-align:right"><button class="btn" style="min-height:32px;font-size:13px" data-act="teamunskip" data-v="${esc(e)}">Hide it again</button></td></tr>`).join('')}</tbody></table></div></section>` : ''}
  <section class="card pad" style="display:flex;flex-direction:column;gap:14px"><h2>${st === 'none' ? 'Set it up' : 'How it was set up'}</h2>${teamGuide(st)}</section>`;
};
V.team.noAutoRedraw = true;

// ---------------------------------------------------------------- Moving to a new computer
V.moving = async () => {
  const bk = (await api.storage.local.get('ppBk')).ppBk;
  const st = PP_SYNC.supported ? await PP_SYNC.state('bk') : 'none';
  const today = bk && PP_SYNC.workDaysSince(bk.at) === 0 && new Date(bk.at).toDateString() === new Date().toDateString();
  const step = (n, title, done, body) => `<section class="card pad" style="display:flex;flex-direction:column;gap:10px"><div class="row" style="gap:10px"><span class="eyebrow" style="margin:0">Step ${n} of 3</span>${done ? `<span class="tag ok" style="margin-left:auto">${ic('check', 13, 3)} Done</span>` : ''}</div><h2>${title}</h2>${body}</section>`;
  return `${head('Settings', 'Moving to a new computer', 'Do step 1 on your old computer, then steps 2 and 3 on the new one. Nothing gets left behind.')}
  ${step(1, 'On the old computer: back up now', today, `<p class="muted" style="margin:0;font-size:14px">${today ? 'Backed up today at ' + new Date(bk.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) + '. You\'re ready.' : 'Saves everything to your own Google Drive.'}</p>
    ${st === 'granted' ? `<button class="btn${today ? '' : ' primary'}" style="align-self:flex-start" data-act="bknow">Back up now</button>` : `<a class="btn primary" style="align-self:flex-start" href="#backups">Set up backups first</a>`}`)}
  ${step(2, 'On the new computer: install PageProof', false, `<ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px;font-size:14px">
      <li>Install <b>Google Drive for desktop</b> (<a href="https://www.google.com/drive/download/" target="_blank" rel="noopener">google.com/drive/download</a>) and sign in with your work account.</li>
      <li>Ask your team lead for the newest <b>PageProof.zip</b>. Unzip it into <span class="gpath">Documents\\PageProof\\Install</span>.</li>
      <li>Open <span class="gpath">edge://extensions</span> (or <span class="gpath">chrome://extensions</span>), turn on <b>Developer mode</b>, press <b>Load unpacked</b> and pick the <b>Install</b> folder.</li>
      <li>PageProof opens first-time setup by itself.</li></ol>`)}
  ${step(3, 'On the new computer: bring your work back', false, `<ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px;font-size:14px">
      <li>In first-time setup, step 3 (<b>Back up and share</b>), press <b>Pick My Drive</b>. PageProof finds your backups.</li>
      <li>Press <b>Bring it back</b> next to the newest one and check the numbers, then <b>Restore</b>.</li>
      <li>Pick your photos folder again in <b>Connect your photos</b> (your ticked folders come back with the backup), and the <b>PageProof Team</b> folder if your team shares lists.</li></ol>
    <a class="btn" style="align-self:flex-start" href="#backups">Open Backups</a>`)}`;
};

// ---------------------------------------------------------------- Settings cards
{
  const old = V.settings, oldAfter = V.settings.after;
  V.settings = async () => {
    const html = await old();
    if (!PP_SYNC.supported) return html;
    const [col, txt] = await PP_SYNC.backupLook();
    const ts = await PP_SYNC.state('team'), t = (await api.storage.local.get('ppTeam')).ppTeam || {};
    const cards = sLine('Backups', esc(txt), `<span class="tag ${SYNC_TAG[col]}">${col === 'ok' ? 'Backed up' : col === 'bad' ? 'Needs you' : 'Not yet'}</span><a class="btn" href="#backups">Backups and restore</a><a class="btn ghost" href="#moving">Moving computer</a>`, 'setBackups') +
      sLine('Team lists', ts === 'granted' ? teamPeopleText(t) + (t.nDisagree ? ` <b style="color:var(--warn)">The team disagrees on ${t.nDisagree}.</b>` : '') : 'Share hidden and approved sites and accounts with your team.',
        `<span class="tag ${ts === 'granted' ? 'ok' : ts === 'offline' ? 'bad' : ts === 'prompt' ? 'warn' : 'grey'}">${ts === 'granted' ? 'Sharing' : ts === 'offline' ? 'Drive isn\'t answering' : ts === 'prompt' ? 'Needs one click' : 'Not set up'}</span><a class="btn" href="#team">${ts === 'none' ? 'Set it up' : 'Open team lists'}</a>`, 'setTeam');
    return html.replace('<!--sync-->', cards);
  };
  V.settings.after = oldAfter;
}

// ---------------------------------------------------------------- first-time setup: Back up and share
SETUP.splice(2, 0, async () => {
  if (!PP_SYNC.supported) return `<h2 style="font-size:24px">Back up and share</h2><p class="muted" style="margin:0">Backups and team lists need Chrome or Edge. You can skip this step.</p>`;
  const [bs, ts] = [await PP_SYNC.state('bk'), await PP_SYNC.state('team')];
  let found = '';
  if (bs === 'granted') {
    if (state.suBk === undefined) { state.suBk = null; PP_SYNC.list().then(async l => { state.suBk = (l || []).find(b => !b.before) || (l || [])[0] || false; state.suEmpty = !(await FC.DB.count('copies')); if (state.shown === 'setup') render(true); }).catch(() => { state.suBk = false; }); }
    if (state.suBk && state.suEmpty) found = `<div class="banner info" style="padding:10px 12px"><span style="flex:1;font-size:14px"><b>Found your backup from ${esc(new Date(state.suBk.modified).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }))}</b><br><span class="muted">Your copies found, answers, lists, clients and settings. You'll see the numbers before anything changes.</span></span><button class="btn primary" data-act="bklook" data-v="${esc(state.suBk.name)}">Bring it back</button></div>`;
  }
  return `<h2 style="font-size:24px">Back up and share</h2>
    <p class="muted" style="margin:0">Both use <b>Google Drive for desktop</b> and your own <b>My Drive</b>. PageProof never writes to the company's shared drive. You can skip this and do it later in Settings.</p>
    <div class="ppchk"><div class="row"><b>1. Back up to your own Google Drive</b>${bs === 'granted' ? `<span class="tag ok" style="margin-left:auto">${ic('check', 13, 3)} On</span>` : ''}</div>
      <span class="muted" style="font-size:13.5px">Once a day PageProof saves a copy of your work into My Drive › PageProof Backup. If this computer breaks, nothing is lost. Only you can see it.</span>
      <div class="row" style="gap:8px">${bkFolderRow(bs)}</div>${found}</div>
    <div class="ppchk"><div class="row"><b>2. Share hidden and approved sites with your team</b>${ts === 'granted' ? `<span class="tag ok" style="margin-left:auto">${ic('check', 13, 3)} Sharing</span>` : `<span class="faint" style="margin-left:auto;font-size:13px">Optional</span>`}</div>
      <span class="muted" style="font-size:13.5px">When anyone on the team hides or approves a site or account, everyone's PageProof gets it.</span>
      <details${ts === 'granted' ? '' : ' open'}><summary style="cursor:pointer;font-weight:600;font-size:14px">Show me how (about 2 minutes)</summary><div style="display:flex;flex-direction:column;gap:12px;margin-top:12px">${teamGuide(ts)}</div></details></div>`;
});

// ---------------------------------------------------------------- Hidden and approved sites: who added it
let TEAM_WHO = null, TEAM_SKIP = new Set();
async function teamWhoLoad() { const s = await api.storage.local.get(['ppTeamWho', 'ppTeamSkip']); TEAM_WHO = s.ppTeamWho || {}; TEAM_SKIP = new Set(s.ppTeamSkip || []); }
teamWhoLoad().catch(() => {});
api.storage.onChanged.addListener(ch => { if (ch.ppTeamWho || ch.ppTeamSkip) teamWhoLoad().catch(() => {}); });
function ppTeamTag(h, tab) {
  if (!TEAM_WHO || !['hidden', 'allowed'].includes(tab)) return '';
  const w = TEAM_WHO[h];
  if (!w) return '';
  return ` <span class="faint" style="font-size:12.5px">Team · ${esc(w[0])}${w[1] ? ', ' + esc(new Date(w[1] + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })) : ''}</span>`;
}
function ppTeamBtn(h, tab) {
  if (!TEAM_WHO || tab !== 'hidden' || !TEAM_WHO[h]) return '';
  return `<button class="btn ghost" style="min-height:32px;font-size:13px" data-act="teamskip" data-v="${esc(h)}" title="A teammate hid it. Show it on this computer only, without changing it for the team.">Show for me</button> `;
}

// ---------------------------------------------------------------- Home jobs and health lights
{
  const old = homeFinds;
  homeFinds = async function () {
    const r = await old.apply(this, arguments);
    try {
      if (!PP_SYNC.supported) return r;
      const add = [];
      const p = await PP_SYNC.problem();
      if (p) add.push({ lvl: 'warn', id: 'jobDrivePaused', icon: 'warn', title: 'Google Drive isn\'t syncing',
        sub: `${p.backup ? 'Your backup' : ''}${p.backup && (p.team || p.pending) ? ' and ' : ''}${p.pending ? p.pending + ' team ' + (p.pending === 1 ? 'change' : 'changes') : p.team && !p.backup ? 'Team list changes' : ''} ${p.backup && !p.team && !p.pending ? 'is' : 'are'} waiting. They go out by themselves when Drive is back. Check Google Drive for desktop is running and signed in (its icon by the clock).`,
        btn: { act: 'syncretry', label: 'Try again', main: 1 }, btn2: { act: 'syncfix', label: 'How to fix' } });
      const [col, txt] = await PP_SYNC.backupLook();
      if (!p && col === 'bad') add.push({ lvl: 'bad', id: 'jobBackup', icon: 'warn', title: 'Your work hasn\'t been backed up lately', sub: esc(txt), btn: { href: '#backups', label: 'Open Backups', main: 1 } });
      const t = (await api.storage.local.get('ppTeam')).ppTeam;
      if (t && t.nDisagree) add.push({ lvl: 'warn', id: 'jobTeamDis', icon: 'warn', title: `The team disagrees on ${t.nDisagree === 1 ? '1 site' : t.nDisagree + ' sites'}`, sub: 'One person hid it and another approved it. Pick which answer everyone uses.', btn: { href: '#team', label: 'Choose', main: 1 } });
      r.jobs.unshift(...add);
    } catch (e) { console.warn('PageProof: backup jobs', e); }
    return r;
  };
}
{
  const old = healthLights;
  healthLights = async function () {
    const L = await old.apply(this, arguments);
    try {
      if (!PP_SYNC.supported) return L;
      const [col, txt] = await PP_SYNC.backupLook();
      const at = L.findIndex(x => /^Backup in Documents/.test(x[1]));
      const items = [[col, 'Backup to Google Drive', txt, col === 'ok' ? '' : '<a class="btn sm" href="#backups">Open Backups</a>']];
      const ts = await PP_SYNC.state('team'), t = (await api.storage.local.get('ppTeam')).ppTeam || {};
      if (ts === 'none') items.push(['grey', 'Team lists', 'Not set up.', '<a class="btn sm" href="#team">Set it up</a>']);
      else if (ts === 'granted') items.push([t.nDisagree ? 'warn' : 'ok', 'Team lists', teamPeopleText(t) + (t.at ? ' Checked ' + agoText(t.at) + '.' : '') + (t.nDisagree ? ' The team disagrees on ' + t.nDisagree + '.' : ''), t.nDisagree ? '<a class="btn sm" href="#team">Choose</a>' : '']);
      else items.push([ts === 'prompt' ? 'warn' : 'bad', 'Team lists', ts === 'prompt' ? 'Needs one click on Allow.' : 'Google Drive isn\'t answering. Changes wait and go out by themselves.', ts === 'prompt' ? '<button class="btn primary sm" data-act="teamallow">Allow</button>' : '<button class="btn sm" data-act="syncretry">Try again</button>']);
      L.splice(at >= 0 ? at + 1 : L.length, 0, ...items);
    } catch (e) { console.warn('PageProof: backup lights', e); }
    return L;
  };
}

// ---------------------------------------------------------------- buttons
Object.assign(ACTS, {
  bkpick: async () => { try { await PP_SYNC.choose('bk'); state.bkList = null; state.suBk = undefined; toast('Backups go to My Drive › PageProof Backup.'); PP_SYNC.tick(); } catch (e) { pickErr(e); } render(true); },
  bkallow: async () => { await PP_SYNC.allow('bk'); state.bkList = null; render(true); },
  bkretry: async () => { state.bkList = null; render(true); },
  bknow: async () => {
    if (state.bkBusy) return;
    state.bkBusy = 'now'; render(true);
    try {
      const r = await PP_SYNC.backupNow();
      if (r.ok) toast('Backed up: ' + r.counts.copies.toLocaleString() + ' copies, ' + r.counts.hidden.toLocaleString() + ' hidden sites (' + kb(r.size) + ').');
      else toast(r.why === 'offline' || r.why === 'write' ? 'Google Drive isn\'t answering. The backup waits and goes out by itself when Drive is back.' : 'Pick the backup folder first.');
    } finally { state.bkBusy = false; state.bkList = null; render(true); }
  },
  bklook: async v => {
    try {
      toast('Opening the backup…');
      const j = await PP_SYNC.read(v);
      if (!j) return toast('That backup could not be opened. Try another date.');
      state.bkPick = v; state.bkPreview = j; state.bkNow = await PP_SYNC.counts();
      if (route() !== 'backups') location.hash = 'backups'; else { await render(true); }
      setTimeout(() => { const el = document.getElementById('bkPreview'); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 100);
    } catch (e) { toast('That backup could not be opened. Try another date.'); }
  },
  bkcancel: async () => { state.bkPick = state.bkPreview = state.bkNow = null; render(true); },
  bkrestore: async () => {
    if (!state.bkPreview || state.bkBusy) return;
    state.bkBusy = 'restore'; render(true);
    try {
      const r = await PP_SYNC.restore(state.bkPreview);
      state.bkPick = state.bkPreview = state.bkNow = null; state.bkList = null;
      toast('Restored: ' + r.copies.toLocaleString() + ' copies are back.' + (r.before ? ' Today\'s data was saved first as "Before a restore".' : ''));
    } catch (e) { toast(e.message || 'Could not restore that backup.'); }
    finally { state.bkBusy = false; }
    // Restored during first-time setup: carry on with setup.
    if (!(await api.storage.local.get('ppSetupDone')).ppSetupDone) { state.setup = 3; location.hash = 'setup'; } else render(true);
  },
  teamwho: async v => { state.teamWho = v === 'mate' ? 'mate' : 'lead'; render(true); },
  teampick: async () => { try { await PP_SYNC.choose('team'); state.teamCheck = ''; toast('Team folder picked. Checking it…'); await ACTS.teamcheck(); } catch (e) { pickErr(e); render(true); } },
  teammake: async () => { try { await PP_SYNC.choose('team', true); toast('Made My Drive › PageProof Team. Now share it on drive.google.com (next step).'); state.teamCheck = ''; PP_SYNC.sync(); } catch (e) { pickErr(e); } render(true); },
  teamallow: async () => { await PP_SYNC.allow('team'); await PP_SYNC.sync(); render(true); },
  teamretry: async () => { await PP_SYNC.sync(); render(true); },
  syncretry: async () => { toast('Trying Google Drive again…'); await PP_SYNC.tick(); render(true); },
  syncfix: async () => toast('Click the Google Drive icon by the clock (bottom right). If it says Paused, press Resume. If it asks you to sign in, sign in with your work account. Then press Try again.'),
  teamstop: async () => { await PP_SYNC.forget('team'); toast('Stopped sharing on this computer. Your own lists stay as they are.'); render(true); },
  teamcopy: async () => {
    try { await navigator.clipboard.writeText(TEAM_STEPS_TEXT); toast('Copied. Paste it into an email or chat to your team.'); }
    catch (e) { toast('Could not copy here. The steps are in Settings › Team lists.'); }
  },
  teamcheck: async () => {
    state.teamCheck = 'Checking…'; render(true);
    const st = await PP_SYNC.state('team');
    if (st === 'prompt') { await PP_SYNC.allow('team'); }
    const r = await PP_SYNC.sync();
    const t = (await api.storage.local.get('ppTeam')).ppTeam || {};
    if (r.ok) state.teamCheck = `<b style="color:var(--ok)">✓ Working.</b> Your lists are shared. ${teamPeopleText(t)}${r.applied ? ' ' + r.applied + ' ' + (r.applied === 1 ? 'change' : 'changes') + ' from the team came in.' : ''}`;
    else if (r.state === 'busy') state.teamCheck = 'Another PageProof page is checking right now. Try again in a minute.';
    else if (r.state === 'none') state.teamCheck = '<b style="color:var(--bad)">Not set up yet.</b> Pick the PageProof Team folder first.';
    else state.teamCheck = '<b style="color:var(--bad)">Google Drive isn\'t answering.</b> Check Google Drive for desktop is running and signed in, then try again.';
    render(true);
  },
  teamsettle: async v => {
    const i = String(v).indexOf('|'), s = v.slice(0, i), e = v.slice(i + 1);
    await PP_SYNC.settle(e, s);
    toast(e + (s === 'hidden' ? ' stays hidden' : ' stays approved') + ' for the whole team.');
    render(true);
  },
  teamskip: async v => { await PP_SYNC.showForMe(v, true); await teamWhoLoad(); toast(v + ' shows again on this computer only. The team\'s list is unchanged.', async () => { await PP_SYNC.showForMe(v, false); render(true); }); render(true); },
  teamunskip: async v => { await PP_SYNC.showForMe(v, false); await teamWhoLoad(); toast(v + ' is hidden again.'); render(true); },
});

PP_SYNC.start();
