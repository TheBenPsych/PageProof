// Checks for 4.30: a social post only counts when the post's OWN picture is your client's photo.
// Google Lens can show your client's photo next to a Facebook link when the post itself shows
// something else (a video, another photo): the match came from elsewhere on that page.
// Pretend copies only; the post pages are stubbed (the network is never used).
const { start } = require('./h.js');
process.env.NP = 200; process.env.NC = 60;
const { seed } = require('./seed.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e.stack || e).slice(0, 900)); });
  const go = async h => { await page.goto(url('app.html#' + h)); await page.waitForTimeout(1300); };
  await go('help'); await seed(page); await page.reload(); await page.waitForTimeout(1000);
  await page.evaluate(() => api.storage.local.set({ ppAcctRead: false }));

  // Two pretend Facebook posts of the same client photo: one whose own picture IS the photo,
  // one whose own picture is a different picture (noise). Plus one with no readable page.
  await page.evaluate(async () => {
    const p = (await FC.allCopies())[0].photo;
    const photo = await FC.DB.get('photos', p);
    const day = d => new Date(Date.now() - d * 864e5).toISOString();
    const mk = (id, u) => ({ id, photo: p, client: photo.client || '', url: u, key: RS_UTIL.key(u), site: RS_SITE.of(u), title: '', thumb: '', img: '', engines: ['google'], pct: 100, tiles: 40, match: 'same', w: 800, h: 600, firstSeen: day(0), lastSeen: day(0), times: 1, by: "today's 50", status: 'new', online: 'up' });
    const xs = [mk('pin', 'https://www.facebook.com/SomePage/posts/real-post/111/'), mk('pout', 'https://www.facebook.com/OtherPage/posts/video-post/222/'), mk('pnone', 'https://www.facebook.com/ThirdPage/posts/locked/333/')];
    for (const c of xs) { c.country = FC.countryOf(c.site); c.use = FC.useOf(c); }
    await FC.DB.putMany('copies', xs);
    // Their pictures: the client's own photo (a pretend picture of shapes), and a picture of random dots.
    const toData = bl => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(bl); });
    const draw = seedN => { let s = seedN; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647; const cv = new OffscreenCanvas(800, 600), g = cv.getContext('2d'); g.fillStyle = '#ddd'; g.fillRect(0, 0, 800, 600); for (let i = 0; i < 400; i++) { g.fillStyle = `hsl(${rnd() * 360},70%,${25 + rnd() * 50}%)`; g.fillRect(rnd() * 800, rnd() * 600, 8 + rnd() * 50, 8 + rnd() * 50); } return cv.convertToBlob({ type: 'image/jpeg', quality: 0.9 }); };
    const ours = await draw(7);
    window.ourBlob = async () => ours;          // the client's photo from "Drive"
    window.__pics = { same: await toData(ours), other: await toData(await draw(99)) };
    PP_CHECKS.readPage = async c => /111/.test(c.url) ? { ok: true, at: new Date().toISOString(), url: c.url, sells: {}, ads: [], soc: {}, type: 'article', pic: __pics.same }
      : /222/.test(c.url) ? { ok: true, at: new Date().toISOString(), url: c.url, sells: {}, ads: [], soc: {}, type: 'video.other', pic: __pics.other }
      : { ok: false, at: new Date().toISOString(), why: 'The page answered 403' };
  });
  const res = await page.evaluate(async () => {
    const out = {};
    for (const id of ['pin', 'pout', 'pnone']) { const c = await FC.DB.get('copies', id); const r = await postCheck(c); const cc = await FC.DB.get('copies', id); out[id] = { state: r && r.state, pct: r && r.pct, video: r && r.video, err: r && r.err, status: cc.status, by: cc.removedBy || '' }; }
    return out;
  });
  ok(res.pin.state === 'seen' && res.pin.status === 'new', 'Post whose own picture is the photo: matches and stays new (' + JSON.stringify(res.pin) + ')');
  ok(res.pout.state === 'notSeen' && res.pout.video && res.pout.status === 'removed' && res.pout.by === 'postcheck', 'Post whose own picture is different: goes to Removed by itself (' + JSON.stringify(res.pout) + ')');
  ok(res.pnone.state === 'unknown' && res.pnone.status === 'new', 'Post that can\'t be read: left alone (' + JSON.stringify(res.pnone) + ')');

  // The panel explains it.
  await go('found');
  const d = await page.evaluate(async () => { FCD = null; await loadFC(); state.open = 'pout'; await render(true); await new Promise(r => setTimeout(r, 600)); const el = document.getElementById('drawer'); return el ? el.textContent.replace(/\s+/g, ' ') : ''; });
  ok(/Not seen in the post/.test(d) && /video cover is a different photo/.test(d) && /moved it to Removed/.test(d), 'The panel says why (' + (d.match(/Not seen in the post[^.]*\./) || [''])[0] + ')');
  ok(/Their picture/.test(d) && /small preview/.test(d), 'The panel says where "Theirs" came from');
  const d2 = await page.evaluate(async () => { state.open = 'pin'; await render(true); await new Promise(r => setTimeout(r, 600)); return document.getElementById('drawer').textContent.replace(/\s+/g, ' '); });
  ok(/post's own picture matches/.test(d2) && !/Not seen in the post/.test(d2), 'A real match says the post\'s own picture matches');

  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e); process.exit(1); });
