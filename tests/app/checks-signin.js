// 4.37.2: Is everything working? shows whether this browser is signed in to Facebook, Instagram,
// X and the others (only whether the sign-in cookie is there), with a note on why it matters.
// Also: a search link with no picture at all says "No picture", not "Picture blocked".
const { start } = require('./h.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e).slice(0, 300)); });
  // Signed in to Facebook only (a made-up cookie value).
  await ctx.addCookies([{ name: 'c_user', value: '1', domain: '.facebook.com', path: '/', secure: true, sameSite: 'None', expires: Math.floor(Date.now() / 1000) + 3600 }]);
  await page.goto(url('app.html#health')); await page.waitForTimeout(1800);
  const txt = await page.textContent('main');
  ok(/Signed in: Facebook\s*Yes, in this browser/.test(txt), 'Facebook shows as signed in');
  ok(/Signed in: Instagram\s*Not signed in\. Instagram shows a sign-in wall/.test(txt), 'Instagram shows as not signed in, with why');
  ok(/Signed in: X \(Twitter\)\s*Not signed in/.test(txt), 'X shows as not signed in');
  ok(/Signed in: Bing[\s\S]*Optional/.test(txt), 'Bing is optional');
  ok(await page.locator('.htile a[href="https://www.instagram.com/"]').count() === 1, 'A Sign in button opens Instagram');
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await ctx.close(); process.exit(fails ? 1 : 0);
})();
