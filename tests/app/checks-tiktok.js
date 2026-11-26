// Checks for TikTok photo posts (slideshows): every slide is read and lined up with the client's
// photo, the copy remembers which slide it is ("Slide 3 of 4") and the picture's own link.
// Pretend copies only; the TikTok tab is stubbed (the network is never used).
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

  // The helpers.
  const h = await page.evaluate(() => ({
    photo: PP_TIKTOK.isPhotoPost('https://www.tiktok.com/@someone/photo/7703634960028126494?image_index=3'),
    video: PP_TIKTOK.isPhotoPost('https://www.tiktok.com/@someone/video/7703634960028126494'),
    idx: PP_TIKTOK.slideFromUrl('https://www.tiktok.com/@someone/photo/1?image_index=3'),
    exp: PP_TIKTOK.expires('https://p16-common-sign.tiktokcdn-us.com/a~tplv-photomode-image.jpeg?dr=9616&x-expires=1795719600&x-signature=abc'),
  }));
  ok(h.photo && !h.video && h.idx === 3 && h.exp === '2026-11-26T19:00:00.000Z', 'Photo posts, slide number and link expiry are read (' + JSON.stringify(h) + ')');

  // readSlides on a slider like TikTok's (the loop repeats slides; each counts once).
  const rs = await page.evaluate(async () => {
    const box = document.createElement('div');
    const pic = n => `<div class="swiper-slide${n === 2 ? ' swiper-slide-active' : ''}" data-swiper-slide-index="${n}"><img src="https://example.com/slide${n}.jpeg?x-expires=1795719600"></div>`;
    box.innerHTML = '<div class="swiper-wrapper">' + pic(3) + [0, 1, 2, 3].map(pic).join('') + pic(0) + '</div>';
    document.body.appendChild(box);
    const r = await PP_TIKTOK.readSlides();
    box.remove();
    return { of: r.of, on: r.on, urls: r.slides.map(s => s.n + ':' + s.url.split('/').pop().split('?')[0]) };
  });
  ok(rs.of === 4 && rs.on === 3 && rs.urls.join() === '1:slide0.jpeg,2:slide1.jpeg,3:slide2.jpeg,4:slide3.jpeg', 'Slides are read once each, in order, with the one on screen (' + JSON.stringify(rs) + ')');

  // Two pretend TikTok slideshow posts: in one the 3rd slide is the client's photo (the cover is
  // not), in the other no slide is. A third was moved to Removed earlier by the cover-only check.
  await page.evaluate(async () => {
    const p = (await FC.allCopies())[0].photo;
    const photo = await FC.DB.get('photos', p);
    const day = d => new Date(Date.now() - d * 864e5).toISOString();
    const mk = (id, u, extra = {}) => ({ id, photo: p, client: photo.client || '', url: u, key: RS_UTIL.key(u), site: RS_SITE.of(u), title: '', thumb: '', img: '', engines: ['google'], pct: 100, tiles: 40, match: 'same', w: 800, h: 600, firstSeen: day(0), lastSeen: day(0), times: 1, by: "today's 50", status: 'new', online: 'up', ...extra });
    const xs = [mk('tin', 'https://www.tiktok.com/@fan.page/photo/7000000000000000001'), mk('tout', 'https://www.tiktok.com/@other.page/photo/7000000000000000002'),
      mk('told', 'https://www.tiktok.com/@old.page/photo/7000000000000000003', { status: 'removed', removedBy: 'postcheck', postChk: { v: POSTCHK_V, state: 'notSeen', pic: '' } })];
    for (const c of xs) { c.country = FC.countryOf(c.site); c.use = FC.useOf(c); }
    await FC.DB.putMany('copies', xs);
    const toData = bl => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(bl); });
    const draw = seedN => { let s = seedN; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647; const cv = new OffscreenCanvas(800, 600), g = cv.getContext('2d'); g.fillStyle = '#ddd'; g.fillRect(0, 0, 800, 600); for (let i = 0; i < 400; i++) { g.fillStyle = `hsl(${rnd() * 360},70%,${25 + rnd() * 50}%)`; g.fillRect(rnd() * 800, rnd() * 600, 8 + rnd() * 50, 8 + rnd() * 50); } return cv.convertToBlob({ type: 'image/jpeg', quality: 0.9 }); };
    const ours = await draw(7);
    window.ourBlob = async () => ours;
    const others = [await toData(await draw(99)), await toData(await draw(55)), await toData(await draw(31))];
    const same = await toData(ours);
    PP_CHECKS.readPage = async c => ({ ok: true, at: new Date().toISOString(), url: c.url, sells: {}, ads: [], soc: {}, type: 'video.other', pic: others[0] });
    // The quiet TikTok tab: its slides.
    PP_SOCIAL.openQuiet = async u => ({ id: u });
    PP_SOCIAL.closeQuiet = () => {};
    api.scripting.executeScript = async ({ target }) => [{ result: /0001|0003/.test(target.tabId)
      ? { of: 4, on: 1, slides: [{ n: 1, url: others[0], w: 800, h: 600 }, { n: 2, url: others[1], w: 800, h: 600 }, { n: 3, url: same, w: 800, h: 600 }, { n: 4, url: others[2], w: 800, h: 600 }] }
      : { of: 2, on: 1, slides: [{ n: 1, url: others[0], w: 800, h: 600 }, { n: 2, url: others[1], w: 800, h: 600 }] } }];
  });
  const res = await page.evaluate(async () => {
    const out = {};
    await loadFC();
    out.due = needsPostCheck(await FC.DB.get('copies', 'told'));
    for (const id of ['tin', 'tout', 'told']) { const c = await FC.DB.get('copies', id); const r = await postCheck(c); const cc = await FC.DB.get('copies', id); out[id] = { state: r && r.state, slide: r && r.slide && r.slide.n, of: r && r.slide && r.slide.of, n: r && r.n, status: cc.status, by: cc.removedBy || '' }; }
    return out;
  });
  ok(res.tin.state === 'seen' && res.tin.slide === 3 && res.tin.of === 4 && res.tin.status === 'new', 'Slideshow whose 3rd slide is the photo: matches, slide 3 of 4 (' + JSON.stringify(res.tin) + ')');
  ok(res.tout.state === 'notSeen' && res.tout.n === 2 && res.tout.status === 'removed', 'Slideshow with no slide of the photo: Removed after every slide was checked (' + JSON.stringify(res.tout) + ')');
  ok(res.due && res.told.state === 'seen' && res.told.status === 'new', 'An older slideshow removed on its cover alone is checked again and put back (' + JSON.stringify(res.told) + ')');

  // The panel shows the slide and its picture link with Copy and Open.
  await go('found');
  // (the pretend slides above are data: pictures; a real slide's link is a web address)
  await page.evaluate(async () => { const cc = await FC.DB.get('copies', 'tin'); cc.postChk.slide.url = 'https://p16-sign.tiktokcdn-us.com/obj/slide3.jpeg?x-expires=1795719600&x-signature=abc'; cc.postChk.slide.exp = PP_TIKTOK.expires(cc.postChk.slide.url); await FC.DB.put('copies', cc); });
  const d = await page.evaluate(async () => { FCD = null; await loadFC(); state.open = 'tin'; await render(true); await new Promise(r => setTimeout(r, 600)); const el = document.getElementById('drawer'); return { t: el ? el.textContent.replace(/\s+/g, ' ') : '', copy: !!(el && el.querySelector('[data-act="copytext"][data-v*="slide3.jpeg"]')) }; });
  ok(/Picture link/.test(d.t) && /Slide 3 of 4/.test(d.t) && /Copy link/.test(d.t) && /Open/.test(d.t) && /stops working/.test(d.t) && d.copy, 'The panel shows "Slide 3 of 4" and the picture link with Copy link and Open');
  // A website copy with a real picture address shows it too.
  const w = await page.evaluate(async () => { const c = FCD.copies.find(x => !isSoc(x) && /^https:/.test(x.img || '')); window.__img = c.img; state.open = c.id; await render(true); await new Promise(r => setTimeout(r, 400)); return { t: document.getElementById('drawer').textContent.replace(/\s+/g, ' '), b: !!document.querySelector('#drawer [data-act="copytext"][data-v="' + __img + '"]') }; });
  ok(/Their picture/.test(w.t) && w.b, 'A website copy shows its picture link');

  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e); process.exit(1); });
