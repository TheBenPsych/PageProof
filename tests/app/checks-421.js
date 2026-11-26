// 4.21: the computer check sets every part of a search on this computer (photo checks, search
// tabs, downloads, pictures opened), and a big search eases off to one check and one tab while
// the computer is busy, then goes back to full speed.
const { start } = require('./h.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });

  // 1. The limits for different computers.
  await page.goto(url('app.html#computer')); await page.waitForTimeout(1200);
  const L = await page.evaluate(() => ({
    light: ppHwLimits('Light', 2, 4), normal: ppHwLimits('Normal', 4, 8), strong: ppHwLimits('Strong', 8, 8),
    big: ppHwLimits('Strong', 16, 32), handPicked: ppHwLimits('Strong', 2, 4),
  }));
  ok(L.light.checks === 1 && L.light.tabs === 1 && L.light.decode === 1 && L.light.dl === 3, 'Light computer: 1 check, 1 tab, 1 picture opened, 3 downloads');
  ok(L.normal.checks === 2 && L.normal.tabs === 2 && L.normal.dl === 5, 'Normal computer: 2 checks, 2 tabs, 5 downloads');
  ok(L.strong.checks === 4 && L.strong.tabs === 3, 'Strong computer: 4 checks, 3 tabs');
  ok(L.big.checks === 6 && L.big.tabs === 3 && L.big.dl === 10, 'Very strong computer (16 cores, 32 GB): 6 checks, still only 3 search tabs');
  ok(L.handPicked.checks === 1, 'Strong picked by hand on a 2-core computer still leaves a core free (1 check)');
  const txt = await page.textContent('main');
  ok(/downloaded at once/.test(txt) && /safe search speed/.test(txt), 'Settings › Searching › This computer shows downloads at once and that the search sites are never asked faster');

  // 2. Busy check answers in plain words (here the computer is fine or the reason is given).
  const busy = await page.evaluate(async () => { const st = {}; const a = await ppBusy(st); const b = await ppBusy(st); return typeof a === 'string' && typeof b === 'string' && !!st.cpu; });
  ok(busy, 'The busy check reads the processor and answers in words');
  const flat = await page.evaluate(async () => {
    const real = chrome.system && chrome.system.cpu; let n = 0;
    const fake = { getInfo: async () => { n += 1000; return { processors: [{ usage: { user: n, kernel: 0, total: n } }] }; } };
    chrome.system = chrome.system || {}; chrome.system.cpu = fake;
    const st = {}; let r = ''; for (let i = 0; i < 4; i++) r = await ppBusy(st);
    if (real) chrome.system.cpu = real;
    return { r, ticks: st.busyTicks };
  });
  ok(flat.r === '' && flat.ticks >= 2, 'A processor at 100% (PageProof\'s own photo checks count too) no longer slows searching down');

  // 3. A search eases off and comes back.
  const p2 = await ctx.newPage();
  p2.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await p2.goto(url('revsearch.html?job=none')); await p2.waitForTimeout(800);
  const e = await p2.evaluate(async () => {
    POOL_SIZE = 4; LIM = { checks: 4, tabs: 3, dl: 8, decode: 3 };
    const full = [liveChecks(), liveTabs(), liveDecode()];
    // Three search tabs taken, one waits.
    for (let i = 0; i < 3; i++) await takeSlot();
    let fourth = false; takeSlot().then(() => { fourth = true; });
    await new Promise(r => setTimeout(r, 30));
    const waited = !fourth;
    EASE.on = true;
    const eased = [liveChecks(), liveTabs(), liveDecode()];
    giveSlot(); giveSlot(); giveSlot();          // 0 tabs open: the waiting one gets its turn (1 allowed)
    await new Promise(r => setTimeout(r, 30));
    const gotOne = fourth && SLOTS.used === 1;
    let fifth = false; takeSlot().then(() => { fifth = true; });
    await new Promise(r => setTimeout(r, 30));
    const heldBack = !fifth;
    easeSet(false);                              // calm again: full speed
    await new Promise(r => setTimeout(r, 30));
    return { full, eased, waited, gotOne, heldBack, back: fifth && SLOTS.used === 2, count: TIMES.eased };
  });
  ok(e.full.join() === '4,3,3', 'Full speed: 4 checks, 3 tabs, 3 pictures opened');
  ok(e.waited, 'A 4th search tab waits while 3 are open');
  ok(e.eased.join() === '1,1,1', 'Busy computer: 1 check, 1 tab, 1 picture opened');
  ok(e.gotOne && e.heldBack, 'While busy only one search tab is open at a time');
  ok(e.back, 'Calm again: the waiting tab opens straight away');

  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e); process.exit(1); });
