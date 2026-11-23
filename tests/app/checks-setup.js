// Connect your photos, step 3 (pick your clients): the folder list is visible, picking the same
// top folder again after a reinstall keeps the ticked folders, and every click shows its result
// straight away (no need to leave the tab and come back).
const { start } = require('./h.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  await page.goto(url('app.html#help')); await page.waitForTimeout(800);
  // A pretend "Shared drives" folder; a backup was restored (ticks saved) but the folder itself
  // is not connected yet, like right after a reinstall.
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const top = await root.getDirectoryHandle('Shared drives', { create: true });
    for (const a of ['10. Every Other - G-H', '11. Others - I-J']) { const d = await top.getDirectoryHandle(a, { create: true }); for (const b of ['Alpha Media', 'Beta News']) await d.getDirectoryHandle(b, { create: true }); }
    await FC.meta.set('picked', ['10. Every Other - G-H/Alpha Media']);
    await chrome.storage.local.set({ ppSetupDone: true, ppTourDone: true, ppSeenVersion: chrome.runtime.getManifest().version, ppReconnectVer: chrome.runtime.getManifest().version, fcDrive: { label: 'H:\\Shared drives', done: false } });
  });
  await page.reload(); await page.waitForTimeout(1200);
  // The folder window always "picks" the pretend Shared drives folder.
  await page.evaluate(() => { window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('Shared drives'); });
  await page.evaluate(() => { location.hash = 'found'; }); await page.waitForTimeout(800);
  ok(await page.evaluate(() => /Connect your photos/.test(document.body.textContent)), 'Copies found shows Connect your photos until Drive is set up');
  await page.evaluate(() => { state.cs = 2; render(true); }); await page.waitForTimeout(600);
  await page.click('[data-act="cspick"]'); await page.waitForTimeout(1500);
  const a = await page.evaluate(() => { const b = document.querySelector('div.cpick'); return { h: b ? b.getBoundingClientRect().height : 0, op: b ? getComputedStyle(b).opacity : '0', rows: document.querySelectorAll('div.cpick .crow').length, text: document.getElementById('view').textContent }; });
  ok(a.h > 60 && a.op === '1', 'The folder list is full size and not faded (was a 16px box) ' + JSON.stringify({ h: a.h, op: a.op }));
  ok(a.rows >= 2, 'The top folders show right after choosing the top folder, without leaving the tab (' + a.rows + ' rows)');
  ok(/1 folder ticked/.test(a.text) && /Alpha Media/.test(a.text), 'Choosing the same top folder keeps the ticked folder from the backup');
  // Open a folder: its folders appear by themselves.
  await page.click('[data-act="csopen"][data-v="11. Others - I-J"]'); await page.waitForTimeout(1200);
  ok(await page.evaluate(() => !!document.querySelector('[data-act="cspk"][data-v="11. Others - I-J/Beta News"]')), 'Opening a folder shows the folders inside it straight away');
  await page.click('[data-act="cspk"][data-v="11. Others - I-J/Beta News"]'); await page.waitForTimeout(600);
  ok(await page.evaluate(() => /2 folders ticked/.test(document.getElementById('view').textContent) && !!document.querySelector('[data-act="cssave"]')), 'Ticking a folder updates the count and the Next button at once');
  await page.click('[data-act="cssave"]'); await page.waitForTimeout(1500);
  ok(await page.evaluate(() => /Check and start/.test(document.querySelector('.wiz').textContent) && /Searching for/.test(document.getElementById('view').textContent)), 'Next moves to step 4 at once');
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
