// "Finish this claim" (Ben, 2026-11-25): pressing Stolen turns the copy details panel into the
// steps that take a copy to legal, in the order the team works:
//   Part 1, is it a good case?   1 right photo and it's on their page · 2 site viable, owner found
//   Part 2, build the case       3 capture their page · 4 evidence report · 5 legal portal boxes
//   then Sent to legal (date and name saved) and the next copy opens.
// Nothing is captured before Part 1 says yes. "Not a viable entity" closes the claim. "Finish later"
// keeps it in the Not finished tab of Copies found, starting at the step it stopped on.
// Saved per copy in FC meta 'claims' (strings only, so the settings backup can carry it).
let PP_CLAIMS = {};
const claimsReady = FC.meta.get('claims').then(x => { PP_CLAIMS = x || {}; }).catch(() => {});
const clOf = c => PP_CLAIMS[c && c.id] || {};
const clSkipped = (c, k) => String(clOf(c).skip || '').split(',').includes(k);
async function clSet(id, patch) {
  const all = (await FC.meta.get('claims')) || {};
  const before = all[id] ? { ...all[id] } : null;
  const e = { ...(all[id] || {}), ...patch };
  for (const k of Object.keys(e)) if (e[k] === '' || e[k] == null) delete e[k];
  if (Object.keys(e).length) all[id] = e; else delete all[id];
  PP_CLAIMS = all;
  await FC.meta.set('claims', all); FC.touch('claims');
  if (typeof FC.backupSoon === 'function') FC.backupSoon();
  // Undo puts back exactly what was there.
  return async () => { const a = (await FC.meta.get('claims')) || {}; if (before) a[id] = before; else delete a[id]; PP_CLAIMS = a; await FC.meta.set('claims', a); FC.touch('claims'); };
}
// Sent, closed, or still to finish.
const clDone = c => !!(clOf(c).sent || clOf(c).closed);
const clOpen = c => c && c.status === 'stolen' && !clDone(c);
const clBare = u => String(u || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/[#?].*$/, '').replace(/\/+$/, '').toLowerCase();

// Every step's state for one copy. ctx: { p, reg, kind, hits, capturedAt, f, reports }
function clSteps(c, ctx) {
  const cl = clOf(c), soc = isSoc(c), pf = c.pf;
  const exact = c.match === 'same' && c.pct >= 95;
  const same = exact || cl.same === 'yes';
  const onPage = soc ? (c.postChk && c.postChk.state === 'seen') || cl.onPage === 'yes' : (pf && pf.ok && pf.imgFound) || cl.onPage === 'yes';
  const stop = ctx.hits.some(h => h.lvl === 'stop');
  const rulesOk = !!ctx.kind && !stop;
  const reg = ctx.reg && (ctx.reg.va || ctx.reg.app);
  const ent = !soc && typeof entOf === 'function' ? entOf(c.site) || {} : {};
  const owner = soc ? !!c.acct : ent.status === 'Seemingly viable';
  const report = cl.report || (ctx.reports || []).some(r => clBare(r.url) === clBare(c.url));
  const st = (k, done) => ({ k, done: !!done, skip: !done && clSkipped(c, k) });
  const s = [
    { ...st('good', same && onPage && rulesOk), part: 1, title: 'Right photo, and it\'s on their page', same, exact, onPage, rulesOk, stop, reg },
    { ...st('owner', owner), part: 1, title: soc ? 'Who posted it' : 'Is the site viable? Who owns it?', ent, notViable: !soc && ent.status === 'Not a viable entity' },
    { ...st('capture', !!ctx.capturedAt), part: 2, title: 'Capture their page' },
    { ...st('report', report), part: 2, title: 'Make the evidence report' },
    { k: 'portal', part: 2, title: 'Put it in the legal portal', done: !!cl.sent, skip: false },
  ];
  const part1 = s.slice(0, 2).every(x => x.done || x.skip);
  const cur = s.find(x => !x.done && !x.skip && (x.part === 1 || part1)) || s[4];
  const ready = s.slice(0, 4).every(x => x.done || x.skip);
  const n = s.slice(0, 4).filter(x => x.done || x.skip).length;
  return { s, part1, cur, ready, n };
}
// Short words for a row in Copies found.
function clRowTag(c) {
  if (c.status !== 'stolen') return '';
  const cl = clOf(c);
  if (cl.sent) return `<span class="tag ok" title="${esc('Sent to legal' + (cl.by ? ' by ' + cl.by : ''))}">Sent to legal ${esc(shortDate(cl.sent))}</span>`;
  if (cl.closed) return '<span class="tag grey" title="Closed: no actively registered company was found behind this site">Claim closed</span>';
  return `<span class="tag warn" title="The claim steps are not finished yet">Not finished${cl.at ? ': ' + esc(cl.at) : ''}</span>`;
}

// The steps card in the details panel, in the Windows 11 Settings look (calm look batch 19):
// a header card with one progress bar, then each step as a row that folds open. Inside an open
// step, each check is its own row: a round mark, the question, and its buttons on the right.
const CL_P = {
  photo: '<rect x="1.8" y="2.8" width="12.4" height="10.4" rx="1"/><circle cx="5.6" cy="6.3" r="1.2"/><path d="m1.8 11.4 3.4-3 2.6 2.2 2.4-2 4 3"/>',
  owner: '<path d="M2.5 14V3h6.5v11M9 6.8h4.5V14M1.5 14h13M4.6 5.6h2.3M4.6 8.2h2.3M4.6 10.8h2.3M11 9.3h.9M11 11.8h.9"/>',
  capture: '<path d="M1.8 5.2h3.1l1.2-1.9h3.8l1.2 1.9h3.1v8H1.8z"/><circle cx="8" cy="9" r="2.4"/>',
  report: '<path d="M4 1.8h5.5L12.5 5v9.2H4z"/><path d="M9.5 1.8V5h3M6 8h4.5M6 10.5h4.5"/>',
  portal: '<path d="M14 2 7.2 8.8M14 2 9.6 14 7.2 8.8 2 6.4z"/>',
  lock: '<rect x="3.2" y="7" width="9.6" height="7" rx="1"/><path d="M5.3 7V5.1a2.7 2.7 0 0 1 5.4 0V7"/>',
  flag: '<path d="M3 14V2.5M3 3h8.5l-1.8 2.5L11.5 8H3"/>',
  check: '<path d="m4.6 8.3 2.2 2.1 4.6-4.8"/>', dash: '<path d="M5 8h6"/>', warn: '<path d="M8 2 14.5 13.5h-13z"/><path d="M8 6.5v3.2M8 11.6v.2"/>',
  chevd: '<path d="M3.5 6 8 10.5 12.5 6"/>', ext: '<path d="M9 2.5h4.5V7M13.5 2.5 7.5 8.5M12 9.5v4H2.5V4h4"/>',
};
const clSvg = (n, z = 20) => `<svg viewBox="0 0 16 16" width="${z}" height="${z}" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CL_P[n] || ''}</svg>`;
const CL_ICON = { good: 'photo', owner: 'owner', capture: 'capture', report: 'report', portal: 'portal' };
const CL_SUB = { good: 'Same photo, on their page, and the firm can pursue it', owner: 'Find the company behind the site, then say if it is viable', capture: 'Their page, saved with the address and time on top', report: 'The PDF with both photos, the match and the page details', portal: 'Copy each line into the firm\'s Add Infringement form' };
async function clCard(c, ctx) {
  await claimsReady;
  const cl = clOf(c);
  if (cl.sent || cl.closed) {
    return `<section class="clcard cs done" id="claimsteps"><div class="cshero"><span class="cshi ok">${clSvg('check', 22)}</span><span class="sx-tt"><b>${cl.sent ? `Sent to legal ${esc(shortDate(cl.sent))}${cl.by ? ' by ' + esc(cl.by) : ''}` : 'Claim closed: not a viable entity'}</b><span>${cl.sent ? 'This claim is finished' : 'No actively registered company was found behind this site'}</span></span><button class="btn" data-act="clreopen">Open the steps again</button></div></section>`;
  }
  const r = clSteps(c, ctx), soc = isSoc(c);
  const base = FC.baseOf(c.site);
  // one check inside a step: ok true = done, false = a problem, null = still to do
  const chk = (ok, t, sub, btns) => `<div class="csck${ok === true ? ' y' : ok === false ? ' n' : ''}"><span class="csm" aria-hidden="true">${ok === true ? clSvg('check', 14) : ok === false ? clSvg('warn', 13) : ''}</span><span class="cstt"><b>${t}</b>${sub ? `<span>${sub}</span>` : ''}</span>${btns ? `<span class="csbtns">${btns}</span>` : ''}</div>`;
  const body = async x => {
    if (x.k === 'good') return [
      chk(x.same || null, x.exact ? `Same photo: ${c.pct}% lines up` : x.same ? 'You checked: it\'s the same photo' : 'Is it the same photo?', x.same ? '' : 'Compare them closely first', x.same ? '' : `<button class="btn" data-act="compare">${ic('layers', 15)} Compare</button><button class="btn primary" data-act="clyes" data-v="same">Yes, same photo</button>`),
      chk(x.onPage || null, x.onPage ? (clOf(c).onPage === 'yes' ? 'You checked: it\'s on their page' : soc ? 'The post\'s own picture matches' : 'PageProof found the photo on their page') : soc ? 'Is the photo in the post?' : 'Is it on their page?', x.onPage ? '' : soc ? 'Not sure yet. Look for yourself' : !c.pf ? 'Reading their page…' : !c.pf.ok ? 'Their page could not be read. Look for yourself' : 'Not found in their page\'s code. Look for yourself', x.onPage ? '' : `<a class="btn" href="${safeUrl(c.url)}" target="_blank" rel="noreferrer">${soc ? 'Open the post' : 'Open their page'} ${clSvg('ext', 14)}</a><button class="btn primary" data-act="clyes" data-v="onPage">Yes, it's there</button>`),
      chk(x.rulesOk ? true : x.stop ? false : null, x.stop ? 'A firm rule says stop' : x.rulesOk ? 'Firm rules: OK to pursue' : 'What kind of site is it?', x.stop ? 'See the Claim tab for why' : x.rulesOk ? '' : 'The firm\'s rules depend on it', x.stop ? '<button class="btn" data-act="dtab" data-v="claim">See why</button>' : x.rulesOk ? '' : kindSelect(c, ctx.kind)),
      chk(x.reg ? true : null, x.reg ? 'Registration ' + esc(x.reg) : 'Registration number', x.reg ? '' : 'None found in Drive yet. Not needed to go on', x.reg ? '' : `<a class="btn" href="#clients?reg=none&folder=${encodeURIComponent(String(c.photo || '').replace(/^d:/, '').replace(/\/[^/]*$/, ''))}">Registrations</a>`),
    ].join('');
    if (x.k === 'owner') {
      if (soc) return chk(!!c.acct, c.acct ? 'Posted by ' + esc(c.acct.handle) : 'Who posted it?', c.acct ? '' : 'The account isn\'t known yet', c.acct ? '' : '<button class="btn" data-act="dtab" data-v="acct">Set the account</button>');
      const f = ctx.f || {}, e = x.ent;
      const names = [...new Set([e.entity, ...(f.names || []), f.fbCompany].filter(Boolean))].slice(0, 4);
      return (e.entity ? chk(x.done ? true : null, 'Company: ' + esc(e.entity), [e.state, e.regStatus ? 'registry says ' + e.regStatus : ''].filter(Boolean).map(esc).join(' · '), '')
        : names.length ? names.map(n => chk(null, esc(n), 'A name the site goes by', `<button class="btn" data-act="entuse" data-v="${esc(base)}|${esc(n)}|${IS_CO.test(n.trim()) ? 'Company name' : 'Seller name (DBA)'}">Use this name</button>`)).join('')
        : chk(null, f.site ? 'No company name found on the site' : 'Which company is it?', f.site ? '' : 'Read the site to find the names it goes by', ''))
        + chk(null, 'Find the company', 'The full checklist: brand, then company, then active in the state registry', `<button class="btn" data-act="gowho" data-v="${esc(c.id)}">${ic('owner', 15)} Find the company</button>`)
        + chk(x.done ? true : null, x.done ? 'Seemingly viable' : 'Is it a viable company?', x.done ? 'You marked it' : 'An active company you can claim against', x.done ? '' : `<button class="btn" data-act="clnotviable">Not a viable entity</button><button class="btn primary" data-act="entstatus" data-v="${esc(base)}|Seemingly viable">Seemingly viable</button>`);
    }
    if (x.k === 'capture') return chk(x.done || null, x.done ? 'Page captured ' + esc(shortDate(ctx.capturedAt)) : 'Save their page as evidence', x.done ? '' : 'About a minute. Address, time and 3 trusted timestamps on top', x.done ? '<button class="btn" data-act="capturecopy">Capture again</button>' : `<button class="btn primary" data-act="capturecopy">${ic('capture', 15)} Capture now</button>`);
    if (x.k === 'report') return chk(x.done || null, x.done ? 'Evidence report saved' : 'Save the evidence report', x.done ? '' : 'Saving the capture makes it too', x.done ? '<button class="btn" data-act="evidence">Make it again</button>' : `<button class="btn primary" data-act="clreport">${ic('doc', 15)} Make the report</button>`);
    if (x.k === 'portal') return typeof ppPortalCard === 'function' ? await ppPortalCard(c, ctx.p, ctx.reg) : '';
    return '';
  };
  const step = async x => {
    const locked = x.part === 2 && !r.part1;
    const open = !locked && (x === r.cur || state.clOpenStep === c.id + ':' + x.k);
    const owner = x.k === 'owner' && x.ent && x.ent.status && x.ent.status !== 'Not checked yet' ? x.ent.status : '';
    const [say, cls] = x.done ? ['Done', 'ok'] : x.skip ? ['Skipped', 'grey'] : locked ? ['Opens after Part 1', ''] : x === r.cur ? ['Next step', 'acc'] : owner ? [owner, 'bad'] : ['To do', ''];
    const icon = x.done ? `<span class="csdone">${clSvg('check', 15)}</span>` : x.skip ? `<span class="csskip">${clSvg('dash', 15)}</span>` : clSvg(locked ? 'lock' : CL_ICON[x.k]);
    const sub = x.done ? (owner || 'Done') : x.skip ? 'You skipped this step' : CL_SUB[x.k];
    const head = `<span class="sx-ic">${icon}</span><span class="sx-tt"><b>${esc(x.title)}</b><span>${esc(sub)}</span></span><span class="sx-ctl">${cls ? `<span class="sx-tag ${cls === 'acc' ? 'csacc' : cls}">${cls === 'ok' ? clSvg('check', 13) : ''}${esc(say)}</span>` : `<span class="cssay">${esc(say)}</span>`}<span class="sx-chev">${clSvg('chevd', 16)}</span></span>`;
    const cls2 = `clstep${x.done ? ' y' : ''}${x.skip ? ' s' : ''}${open ? ' on' : ''}${locked ? ' lock' : ''}${x === r.cur ? ' cur' : ''}`;
    if (locked) return `<div class="${cls2}" data-step="${x.k}"><div class="sx-row">${head}</div></div>`;
    const foot = x.skip ? `<div class="csfoot"><button class="btn" data-act="clunskip" data-v="${x.k}">Do this step after all</button></div>` : !x.done && x.k !== 'portal' ? `<div class="csfoot"><button class="btn ghost" data-act="clskip" data-v="${x.k}">Skip this step</button></div>` : '';
    return `<div class="${cls2}" data-step="${x.k}"><button class="sx-row cshead" data-act="clstep" data-v="${x.k}" aria-expanded="${open}">${head}</button>${open ? `<div class="sx-fold csfold">${await body(x)}${foot}</div>` : ''}</div>`;
  };
  let p1 = '', p2 = '';
  for (const x of r.s) { if (x.part === 1) p1 += await step(x); else p2 += await step(x); }
  const nDone = r.s.filter(x => x.done || x.skip).length, pct = Math.round(nDone / r.s.length * 100);
  const notViable = r.s[1].notViable;
  return `<section class="clcard cs" id="claimsteps" aria-label="Finish this claim">
    <div class="cshero"><span class="cshi">${clSvg('flag', 22)}</span><span class="sx-tt"><b>Finish this claim</b><span>Step ${r.s.indexOf(r.cur) + 1} of ${r.s.length}: ${esc(r.cur.title)}</span></span><span class="csn">${nDone} of ${r.s.length} steps done</span>
      <div class="csbar" role="progressbar" aria-label="Steps done" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.max(pct, 2)}%"></i></div></div>
    ${notViable ? `<div class="banner bad" style="padding:10px 12px"><span style="flex:1">This site is marked <b>Not a viable entity</b>. Close the claim, or change the status above if that's wrong.</span><button class="btn sm" data-act="clnotviable">Close the claim</button></div>` : ''}
    <div class="sx-group"><h3 class="clpart">Part 1: Is it a good case?</h3><div class="sx-stack">${p1}</div></div>
    <div class="sx-group"><h3 class="clpart">Part 2: Build the case${r.part1 ? '' : '<em>Opens when Part 1 is done</em>'}</h3><div class="sx-stack">${p2}</div></div>
  </section>`;
}
// The buttons pinned at the bottom of the panel while a claim is open.
function clFoot(c, ctx) {
  const r = clSteps(c, ctx);
  return `<div class="clfoot"><button class="btn primary" data-act="clsent"${r.ready ? '' : ` disabled data-why="${esc('Finish or skip steps 1 to 4 first')}"`}>${ic('check', 16)} Sent to legal, open the next copy</button><button class="btn" data-act="cllater">Finish later</button></div>`;
}

// After a claim is done or put aside: back to One at a time if it started there, else the next copy.
function clLeave() {
  const back = state.clBack;
  state.clBack = ''; state.clOpenStep = '';
  if (back === 'review') { state.open = ''; location.hash = 'review'; return; }
  const nx = state.clNext && FCD && FCD.copies.find(x => x.id === state.clNext && x.status === 'new') ? state.clNext : (LIST.find(id => { const x = FCD && FCD.copies.find(y => y.id === id); return x && x.id !== state.open && (x.status === 'new' || clOpen(x)) && !PEND.has(x.id); }) || '');
  state.clNext = '';
  state.open = nx;
  render(true);
}
const clCur = () => FCD && FCD.copies.find(x => x.id === state.open);
Object.assign(ACTS, {
  clstep: v => { const c = clCur(); if (!c) return; state.clOpenStep = state.clOpenStep === c.id + ':' + v ? '' : c.id + ':' + v; render(true); },
  clyes: async v => {
    const c = clCur(); if (!c) return;
    const undo = await clSet(c.id, { [v]: 'yes', at: '' });
    HIST.push({ label: v === 'same' ? 'same photo checked' : 'on their page checked', undo, open: c.id });
    render(true);
  },
  clskip: async v => {
    const c = clCur(); if (!c) return;
    const sk = new Set(String(clOf(c).skip || '').split(',').filter(Boolean)); sk.add(v);
    const undo = await clSet(c.id, { skip: [...sk].join(',') });
    HIST.push({ label: 'step skipped', undo, open: c.id });
    state.clOpenStep = ''; toastUndo('Step skipped.'); render(true);
  },
  clunskip: async v => {
    const c = clCur(); if (!c) return;
    const sk = String(clOf(c).skip || '').split(',').filter(x => x && x !== v);
    await clSet(c.id, { skip: sk.join(',') });
    state.clOpenStep = c.id + ':' + v; render(true);
  },
  clreport: async () => {
    const c = clCur(); if (!c) return;
    const caseNo = await PP_EVIDENCE.ask();
    if (caseNo === null) return;
    const name = await matchReport(c, caseNo);
    if (name) await clSet(c.id, { report: new Date().toISOString() });
    render(true);
  },
  clnotviable: async () => {
    const c = clCur(); if (!c) return;
    const base = FC.baseOf(c.site);
    const was = (typeof entOf === 'function' && entOf(c.site)) ? { ...entOf(c.site) } : null;
    if (!was || was.status !== 'Not a viable entity') await entSet(base, { status: 'Not a viable entity' });
    const undo = await clSet(c.id, { closed: 'notviable', at: '' });
    HIST.push({ label: c.site + ' claim closed', open: c.id, undo: async () => { await undo(); if (was && was.status !== 'Not a viable entity') await entSet(base, { status: was.status }); } });
    dropFC(); toastUndo('Claim closed: ' + base + ' is not a viable entity. Nothing was captured.');
    clLeave();
  },
  clsent: async () => {
    const c = clCur(); if (!c) return;
    let by = ''; try { by = (typeof getName === 'function' ? await getName() : '') || ''; } catch (e) { /* no name */ }
    const undo = await clSet(c.id, { sent: new Date().toISOString(), by, at: '' });
    HIST.push({ label: (isSoc(c) && c.acct ? c.acct.handle : c.site) + ' sent to legal', undo, open: c.id });
    toastUndo((isSoc(c) && c.acct ? c.acct.handle : c.site) + ' sent to legal.' + (state.clBack === 'review' ? '' : ' Next copy opened.'));
    clLeave();
  },
  cllater: async () => {
    const c = clCur(); if (!c) return;
    const el = document.querySelector('#claimsteps .clstep.on b');
    await clSet(c.id, { at: el ? el.textContent : '' });
    toast('Saved in Not finished. It opens at this step next time.');
    clLeave();
  },
  clreopen: async () => {
    const c = clCur(); if (!c) return;
    const cl = clOf(c);
    const undo = await clSet(c.id, { sent: '', by: '', closed: '' });
    HIST.push({ label: 'claim opened again', undo, open: c.id });
    render(true);
  },
  // Picked copies (copies marked Stolen before this version): mark them all sent in one go.
  bulksent: async () => {
    const ids = state.picked.filter(id => { const c = FCD && FCD.copies.find(x => x.id === id); return c && c.status === 'stolen'; });
    if (!ids.length) return toast('Pick copies marked Stolen first.');
    let by = ''; try { by = (typeof getName === 'function' ? await getName() : '') || ''; } catch (e) { /* no name */ }
    const at = new Date().toISOString(), undos = [];
    for (const id of ids) if (!clOf({ id }).sent) undos.push(await clSet(id, { sent: at, by, at: '' }));
    HIST.push({ label: plural(ids.length, 'claim') + ' sent to legal', undo: async () => { for (const u of undos.reverse()) await u(); } });
    state.picked = [];
    toastUndo(plural(ids.length, 'claim') + ' marked as sent to legal.'); render(true);
  },
});
// Another PageProof tab changed a claim: read them again.
api.storage.onChanged.addListener((ch, area) => { if (area === 'local' && ch.fcChanged && ch.fcChanged.newValue && ch.fcChanged.newValue.what === 'claims') FC.meta.get('claims').then(x => { PP_CLAIMS = x || {}; }).catch(() => {}); });
