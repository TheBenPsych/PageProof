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

// The steps card in the details panel.
async function clCard(c, ctx) {
  await claimsReady;
  const cl = clOf(c);
  if (cl.sent || cl.closed) {
    return `<section class="clcard done" id="claimsteps"><div class="clhead"><b>${cl.sent ? `${ic('check', 16)} Sent to legal ${esc(shortDate(cl.sent))}${cl.by ? ' by ' + esc(cl.by) : ''}` : 'Claim closed: not a viable entity'}</b><button class="btn ghost sm" data-act="clreopen" style="margin-left:auto">Open the steps again</button></div></section>`;
  }
  const r = clSteps(c, ctx), soc = isSoc(c);
  const base = FC.baseOf(c.site);
  const mark = x => x.done ? `<span class="clk y" aria-hidden="true">${ic('check', 14, 3)}</span>` : x.skip ? '<span class="clk s" aria-hidden="true">–</span>' : `<span class="clk${x === r.cur ? ' on' : ''}" aria-hidden="true">${r.s.indexOf(x) + 1}</span>`;
  const line = (ok, txt, btn) => `<div class="clline ${ok === true ? 'y' : ok === false ? 'n' : ''}"><span class="cld" aria-hidden="true">${ok === true ? '✓' : ok === false ? '!' : '·'}</span><span class="clt">${txt}</span>${btn ? `<span class="clbtns">${btn}</span>` : ''}</div>`;
  const skipBtn = x => x.k === 'portal' ? '' : `<button class="btn ghost sm" data-act="clskip" data-v="${x.k}">Skip this step</button>`;
  const body = async x => {
    if (x.k === 'good') return [
      line(x.same || null, x.exact ? `Same photo: ${c.pct}% lines up` : x.same ? 'You checked: it\'s the same photo' : 'Is it the same photo? Compare them closely.', x.same ? '' : `<button class="btn sm" data-act="compare">${ic('layers', 14)} Compare</button><button class="btn sm primary" data-act="clyes" data-v="same">Yes, same photo</button>`),
      line(x.onPage || null, x.onPage ? (clOf(c).onPage === 'yes' ? 'You checked: it\'s on their page' : soc ? 'The post\'s own picture matches' : 'PageProof found the photo on their page') : soc ? 'Not sure the photo is in the post yet' : !c.pf ? 'Reading their page…' : !c.pf.ok ? 'Their page could not be read. Look for yourself.' : 'The photo was not found in their page\'s code. Look for yourself.', x.onPage ? '' : `<a class="btn sm" href="${safeUrl(c.url)}" target="_blank" rel="noreferrer">Open their page ${ic('ext', 12)}</a><button class="btn sm primary" data-act="clyes" data-v="onPage">Yes, it's there</button>`),
      line(x.rulesOk ? true : x.stop ? false : null, x.stop ? 'A firm rule says stop. See the Claim tab.' : x.rulesOk ? 'Firm rules: OK to pursue' : 'Kind of site: ' + kindSelect(c, ctx.kind), x.stop ? '<button class="btn sm" data-act="dtab" data-v="claim">See why</button>' : ''),
      line(x.reg ? true : null, x.reg ? 'Registration ' + esc(x.reg) : 'No registration number found yet', x.reg ? '' : '<a class="btn ghost sm" href="#regs">Registrations</a>'),
    ].join('');
    if (x.k === 'owner') {
      if (soc) return line(!!c.acct, c.acct ? 'Posted by ' + esc(c.acct.handle) : 'The account isn\'t known yet.', c.acct ? '' : '<button class="btn sm" data-act="dtab" data-v="acct">Set the account</button>');
      const f = ctx.f || {}, e = x.ent;
      const names = [...new Set([e.entity, ...(f.names || []), f.fbCompany].filter(Boolean))].slice(0, 4);
      return `${e.entity ? line(x.done ? true : null, 'Company: <b>' + esc(e.entity) + '</b>' + (e.state ? ', ' + esc(e.state) : '') + (e.regStatus ? ' · registry says ' + esc(e.regStatus) : '')) : ''}
        ${!e.entity && names.length ? `<div class="clnames">${names.map(n => `<span class="clname"><b>${esc(n)}</b><button class="btn ghost sm" data-act="entuse" data-v="${esc(base)}|${esc(n)}|${IS_CO.test(n.trim()) ? 'Company name' : 'Seller name (DBA)'}">Use this name</button></span>`).join('')}</div>` : ''}
        ${!e.entity && !names.length ? line(null, f.site ? 'No company name found on the site.' : 'Read the site to find the names it goes by.') : ''}
        <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm" data-act="gowho" data-v="${esc(c.id)}">${ic('owner', 14)} Find the company</button><button class="btn sm${x.done ? ' primary' : ''}" data-act="entstatus" data-v="${esc(base)}|Seemingly viable">Seemingly viable</button><button class="btn sm" data-act="clnotviable">Not a viable entity</button></div>
        <span class="faint" style="font-size:12px">Find the company has the full checklist: brand, then company, then active in the state registry.</span>`;
    }
    if (x.k === 'capture') return line(x.done || null, x.done ? 'Page captured ' + esc(shortDate(ctx.capturedAt)) : 'Saves their page with the address and time on top and 3 trusted timestamps.', x.done ? '<button class="btn ghost sm" data-act="capturecopy">Capture again</button>' : `<button class="btn sm primary" data-act="capturecopy">${ic('capture', 14)} Capture now</button>`);
    if (x.k === 'report') return line(x.done || null, x.done ? 'Evidence report saved' : 'The PDF with both photos, the match and the page details. Saving the capture makes it too.', x.done ? '<button class="btn ghost sm" data-act="evidence">Make it again</button>' : `<button class="btn sm primary" data-act="clreport">${ic('doc', 14)} Make the report</button>`);
    if (x.k === 'portal') return typeof ppPortalCard === 'function' ? await ppPortalCard(c, ctx.p, ctx.reg) : '';
    return '';
  };
  let h = '';
  for (const x of r.s) {
    const locked = x.part === 2 && !r.part1;
    if (x.part === 1 && x === r.s[0]) h += '<div class="clpart">Part 1 · Is it a good case?</div>';
    if (x.part === 2 && x === r.s[2]) h += `<div class="clpart">Part 2 · Build the case${r.part1 ? '' : ' <span class="faint">(after Part 1, so no time is spent on a weak case)</span>'}</div>`;
    const open = x === r.cur || state.clOpenStep === c.id + ':' + x.k;
    h += `<div class="clstep${x.done ? ' y' : ''}${x.skip ? ' s' : ''}${open ? ' on' : ''}${locked ? ' lock' : ''}" data-step="${x.k}">
      <button class="clsh" data-act="clstep" data-v="${x.k}"${locked ? ' disabled' : ''}>${mark(x)}<b>${esc(x.title)}</b>${x.skip ? '<span class="tag grey">Skipped</span>' : ''}${x.k === 'owner' && x.ent && x.ent.status && x.ent.status !== 'Not checked yet' ? `<span class="tag ${x.done ? 'ok' : 'bad'}">${esc(x.ent.status)}</span>` : ''}</button>
      ${open && !locked ? `<div class="clbody">${await body(x)}${x.skip ? '<button class="btn ghost sm" data-act="clunskip" data-v="' + x.k + '">Do this step after all</button>' : !x.done ? `<div class="row" style="justify-content:flex-end">${skipBtn(x)}</div>` : ''}</div>` : ''}
    </div>`;
  }
  const notViable = r.s[1].notViable;
  return `<section class="clcard" id="claimsteps" aria-label="Finish this claim">
    <div class="clhead"><b>Finish this claim</b><span class="tag ${r.ready ? 'ok' : 'warn'}" style="margin-left:auto">${r.n} of 4 done</span></div>
    <div class="clbar" aria-hidden="true">${r.s.map(x => `<i class="${x.done || x.skip ? 'y' : x === r.cur ? 'on' : ''}"></i>`).join('')}</div>
    ${notViable ? `<div class="banner bad" style="padding:10px 12px"><span style="flex:1">This site is marked <b>Not a viable entity</b>. Close the claim, or change the status above if that's wrong.</span><button class="btn sm" data-act="clnotviable">Close the claim</button></div>` : ''}
    ${h}</section>`;
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
