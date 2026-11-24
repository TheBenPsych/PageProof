// Checks for 4.33: a match made on the search site's small preview only counts when the photo is
// one of THEIR PAGE's own pictures, never one in comments, link previews or "related" boxes.
// Pretend sites only (answered by the test, the internet is never used).
const { start } = require('./h.js');
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
(async () => {
  const { ctx, url } = await start();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', String(e.stack || e).slice(0, 600)); });
  await page.goto(url('revsearch.html?job=none')); await page.waitForTimeout(800);
  // Two pictures made in the page: "ours" (the client's photo) and "other".
  const pics = await page.evaluate(async () => {
    const draw = async seedN => { let s = seedN; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647; const cv = new OffscreenCanvas(800, 600), g = cv.getContext('2d'); g.fillStyle = '#ddd'; g.fillRect(0, 0, 800, 600); for (let i = 0; i < 400; i++) { g.fillStyle = `hsl(${rnd() * 360},70%,${25 + rnd() * 50}%)`; g.fillRect(rnd() * 800, rnd() * 600, 8 + rnd() * 50, 8 + rnd() * 50); } return cv.convertToBlob({ type: 'image/jpeg', quality: 0.9 }); };
    const b64 = async b => btoa(String.fromCharCode(...new Uint8Array(await b.arrayBuffer())));
    const ours = await draw(7), other = await draw(99);
    window.__ours = ours;
    return { ours: await b64(ours), other: await b64(other) };
  });
  const IMG = { ours: Buffer.from(pics.ours, 'base64'), other: Buffer.from(pics.other, 'base64') };
  const PAGES = {
    'https://news.example/story': `<html><head><meta property="og:image" content="/img/other.jpg"></head><body><header><img src="/img/logo.png"></header><article><h1>Story</h1><img src="/img/ours.jpg" width="800" height="600"></article></body></html>`,
    'https://blog.example/post': `<html><head><meta property="og:image" content="/img/other.jpg"></head><body><article><img src="/img/other.jpg"></article><section id="comments"><div class="comment"><img src="/img/ours.jpg"></div></section><aside class="related-posts"><img src="/img/ours.jpg"></aside></body></html>`,
    'https://www.facebook.com/SomePage/posts/123': `<html><head><meta property="og:image" content="https://scontent.example/other.jpg"><meta property="og:type" content="video.other"></head><body></body></html>`,
  };
  await ctx.route(/^https:\/\/(news\.example|blog\.example|locked\.example|www\.facebook\.com|scontent\.example)\//, route => {
    const u = route.request().url();
    if (/\/(img\/)?ours\.jpg/.test(u)) return route.fulfill({ status: 200, contentType: 'image/jpeg', body: IMG.ours });
    if (/\/(img\/)?other\.jpg/.test(u)) return route.fulfill({ status: 200, contentType: 'image/jpeg', body: IMG.other });
    if (PAGES[u]) return route.fulfill({ status: 200, contentType: 'text/html', body: PAGES[u] });
    return route.fulfill({ status: 403, contentType: 'text/html', body: 'no' });
  });
  const r = await page.evaluate(async () => {
    job = { id: 't', pics: [{ i: 0, name: 'ours.jpg', blob: __ours, links: [] }], engines: ['google'] };
    const mk = u => ({ url: u, key: u, site: new URL(u).hostname, pic: 0, from: 'preview', pct: 100, inl: 60, tiles: 40, str: 1, mid: 1, n: 100, wall: 0, sv: SCORE_VERSION, engines: ['google'] });
    const L = ['https://news.example/story', 'https://blog.example/post', 'https://locked.example/x', 'https://www.facebook.com/SomePage/posts/123'].map(mk);
    const before = L.map(verdict);
    for (const l of L) { if (needsPage(l)) await pageCheck(l); }
    const yandex = { ...mk('https://other.example/a'), from: 'image' };
    return { before, after: L.map(l => l.onPage + ':' + verdict(l)), img: L[0].img, yandex: verdict(yandex) + ':' + needsPage(yandex) };
  });
  ok(r.before.every(v => v === 'pending'), 'A preview-only match waits for their page to be read (' + r.before.join(',') + ')');
  ok(r.after[0] === 'seen:same' && /ours\.jpg$/.test(r.img), 'The photo in the article itself: kept as Same photo, with the picture\'s address (' + r.after[0] + ' ' + r.img + ')');
  ok(r.after[1] === 'notSeen:no', 'The photo only in comments and "related posts": thrown out (' + r.after[1] + ')');
  ok(r.after[2] === 'unknown:maybe', 'A page that can\'t be read: kept, but only as Maybe (' + r.after[2] + ')');
  ok(r.after[3] === 'postOnly:maybe', 'A Facebook post whose main picture differs: Maybe, for the signed-in check in Copies found (' + r.after[3] + ')');
  ok(r.yandex === 'same:false', 'A match made on the real picture (Yandex, Bing) is not checked again (' + r.yandex + ')');
  // The signed-in post reader (runs inside the post's tab): the post's own pictures and video
  // cover, album pictures behind Next, but no comment pictures, link previews or account picture.
  const app = await ctx.newPage(); await app.goto(url('app.html#help')); await app.waitForTimeout(800);
  const fn = await app.evaluate(() => readPostPicsInTab.toString());
  await ctx.route('https://post.example/p', route => route.fulfill({ status: 200, contentType: 'text/html', body: `<html><body><div role="main"><div role="article">
    <header><img src="https://cdn.example/avatar.jpg" width="300" height="300"></header>
    <video poster="https://cdn.example/cover.jpg" width="400" height="300"></video>
    <img id="a1" src="https://cdn.example/1.jpg" width="600" height="400">
    <button aria-label="Next" onclick="this.remove(); const i=document.createElement('img'); i.src='https://cdn.example/3.jpg'; i.width=600; i.height=400; document.getElementById('a1').after(i)"></button>
    <a href="https://l.facebook.com/l.php?u=x"><img src="https://cdn.example/preview.jpg" width="600" height="300"></a>
    <div role="article"><img src="https://cdn.example/comment.jpg" width="600" height="400"></div>
  </div></div></body></html>` }));
  const tp = await ctx.newPage(); await tp.goto('https://post.example/p'); await tp.waitForTimeout(300);
  const got = await tp.evaluate(`(${fn})()`);
  ok(got.includes('https://cdn.example/cover.jpg') && got.includes('https://cdn.example/1.jpg') && got.includes('https://cdn.example/3.jpg') && !got.some(u => /avatar|preview|comment/.test(u)), 'Signed-in post reader: post pictures, video cover and the album\'s next picture; no comments, link previews or account picture (' + got.map(u => u.split('/').pop()).join(', ') + ')');
  // X-style: the tweet above (a reply's parent), the tweet itself, a reply, and a "more posts" grid.
  await ctx.route('https://post.example/someone/status/555', route => route.fulfill({ status: 200, contentType: 'text/html', body: `<html><body><main role="main">
    <article><a href="/other/status/444">parent</a><img src="https://cdn.example/parent.jpg" width="600" height="400"></article>
    <article><a href="/someone/status/555">time</a><img src="https://cdn.example/main.jpg" width="600" height="400"><a href="/someone/status/999"><img src="https://cdn.example/quoted-other.jpg" width="600" height="400"></a></article>
    <article><a href="/reply/status/777">reply</a><img src="https://cdn.example/reply.jpg" width="600" height="400"></article>
    <div><a href="/p/MORE1"><img src="https://cdn.example/grid.jpg" width="300" height="300"></a></div>
  </main></body></html>` }));
  const tp2 = await ctx.newPage(); await tp2.goto('https://post.example/someone/status/555'); await tp2.waitForTimeout(300);
  const got2 = await tp2.evaluate(`(${fn})()`);
  ok(got2.join() === 'https://cdn.example/main.jpg', 'Signed-in post reader picks the post itself: not the tweet above, replies, other linked posts or the "more posts" grid (' + got2.map(u => u.split('/').pop()).join(', ') + ')');
  await ctx.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR', e); process.exit(1); });
