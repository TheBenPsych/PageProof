// First-time setup as one flow (4.56): the computer step says what this computer can do, a
// picture of how the photo folders should look, the Drive and folder-ticking steps inside setup,
// a folder check per client (photos, year folders, registration numbers), and Skip photos for now.
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
    const g = await (await root.getDirectoryHandle('Shared drives', { create: true })).getDirectoryHandle('Photos', { create: true });
    const mk = async (path, files = []) => { let h = g; for (const p of path) h = await h.getDirectoryHandle(p, { create: true }); for (const f of files) await (await (await h.getFileHandle(f, { create: true })).createWritable()).close(); };
    await mk(['Client A', 'Registered images', '2026', 'VA 2-123-456 Q4'], ['a.jpg']);
    await mk(['Client A', 'Registered images', '2025', 'Q3'], ['b.jpg', 'VA0002111222.xlsx']);
    await mk(['Client B', 'Registered images', '2025', 'Q2'], ['c.jpg']);
    await mk(['Client C', 'Registered images'], ['f.jpg']);
    await mk(['Client D', 'Registered images']);
    await chrome.storage.local.remove(['ppSetupDone']);
  });
  await page.evaluate(() => { window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('Shared drives'); });
  await page.evaluate(() => { state.setup = 0; location.hash = 'setup'; }); await page.waitForTimeout(1200);
  const next = async () => { await page.click('.wiz > .row:last-child .btn.primary'); await page.waitForTimeout(1200); };
  const h2 = () => page.evaluate(() => document.querySelector('.wiz h2').textContent);
  const n = await page.evaluate(() => SETUP.length);
  ok(n === 9, 'setup has 9 steps (' + n + ')');
  ok(/Step 1 of 9/.test(await page.textContent('.wiz')), 'each step says Step N of 9');
  await next(); await next(); await next();
  const comp = await page.textContent('.wiz');
  ok(/What this computer can do/.test(await h2()) && /photo checks? at once/.test(comp) && /search tabs? at once/.test(comp) && /for today's 50 photos/.test(comp), 'computer step says what this computer can do');
  ok(await page.evaluate(() => document.querySelectorAll('.hwlv').length === 3 && document.querySelectorAll('.hwlv.me').length === 1), 'Light / Normal / Strong side by side, this computer marked');
  await page.selectOption('select[data-act="suhw"]', 'Light'); await page.waitForTimeout(800);
  ok(await page.evaluate(async () => (await chrome.storage.local.get('ppHw')).ppHw.choice === 'Light' && /Light \(picked by hand\)/.test(document.querySelector('.wiz').textContent)), 'the level can be changed by hand in setup');
  await page.selectOption('select[data-act="suhw"]', 'auto'); await page.waitForTimeout(600);
  await next();
  ok(/How your photo folders should look/.test(await h2()) && /VA 2-123-456/.test(await page.textContent('.fltree')) && /client_info_ignore\.txt/.test(await page.textContent('.wiz')), 'folder guide step shows the layout, the number and what is skipped');
  await next();
  ok(/Google Drive for desktop/.test(await h2()) && /Stream files/.test(await page.textContent('.wiz')), 'Drive install and streaming in one step');
  await next();
  ok(/Pick your clients/.test(await h2()), 'folder-ticking step is inside setup');
  await next();
  ok(/Pick your clients/.test(await h2()), 'Next with nothing ticked stays on the step');
  await page.click('[data-act="cspick"]'); await page.waitForTimeout(1500);
  await page.click('[data-act="csopen"][data-v="Photos"]'); await page.waitForTimeout(1200);
  for (const c of ['A', 'B', 'C', 'D']) { await page.click(`[data-act="cspk"][data-v="Photos/Client ${c}"]`); await page.waitForTimeout(300); }
  await next(); await page.waitForTimeout(2500);
  const ck = await page.textContent('.ckbox');
  ok(/Checking your folders/.test(await h2()), 'folder check step follows');
  ok(/Client A\s*Looks good/.test(ck), 'Client A looks good (number in a folder name and in an Excel file name)');
  ok(/Client B\s*1 folder with no number/.test(ck) && /2025 › Q2/.test(ck), 'Client B: the quarter with no number is named');
  ok(/Client C\s*No year folders/.test(ck), 'Client C: no year folders');
  ok(/Client D\s*No photos found/.test(ck), 'Client D: no photos');
  await next(); await page.waitForTimeout(800);
  ok(/Two things to keep it handy/.test(await h2()) && await page.evaluate(async () => (await FC.drive()).done === true && location.hash === '#setup'), 'Start searching connects the photos and stays in setup for the last step');
  // Skip photos for now jumps to the end.
  await page.evaluate(() => { state.setup = 4; render(true); }); await page.waitForTimeout(800);
  await page.click('[data-v="skipphotos"]'); await page.waitForTimeout(800);
  ok(/Two things to keep it handy/.test(await h2()), 'Skip photos for now goes to the last step');
  // Connect your photos (outside setup) uses the same folder check.
  await page.evaluate(() => { state.cs = 3; state.csCheck = null; state.csClients = [{ name: 'Client C', searching: true }]; location.hash = 'connect'; }); await page.waitForTimeout(2500);
  ok(/Check your folders and start/.test(await page.textContent('.wiz')) && /No year folders/.test(await page.textContent('.ckbox')), 'Connect your photos step 4 shows the folder check');
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
