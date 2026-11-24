// Captures every test page in pages/ the way PageProof does (same content.js helpers, same
// steps as capture() in background.js), joins the screens the way the viewer does, then checks
// that every coloured marker shows up: once on the main capture, or inside a scroll-box section.
//   node tests/capture/run.js            all pages
//   node tests/capture/run.js 12 39      only pages whose name starts with 12 or 39
//   SAVE=1 node tests/capture/run.js     also saves the joined pictures in tests/capture/out/
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const DIR = __dirname, EXT = process.env.EXT_DIR || path.join(DIR, '..', '..', 'extension');
const W = 1280, H = 800, SETTLE_MS = 350, MAX_PAGE_SHOTS = 60, MAX_SECTION_SHOTS = 40;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function capture(page) {
  // (Helpers an older PageProof doesn't have are skipped, so old versions can be compared.)
  const call = (name, ...args) => page.evaluate(([n, a]) => window.__pageproof[n] ? window.__pageproof[n](...a) : undefined, [name, args]);
  await page.addScriptTag({ path: path.join(EXT, 'content.js') });
  const info = await call('prepare', false);
  const rec = { main: { width: info.viewWidth, height: 0, tiles: [] }, sections: [], notes: [] };
  const shot = async () => (await page.screenshot({ type: 'png' })).toString('base64');
  let y = 0, prevNext = -1;
  for (let i = 0; i < MAX_PAGE_SHOTS; i++) {
    const at = await call('scrollPage', y);
    await sleep(i === 0 ? SETTLE_MS * 2 : SETTLE_MS);
    if (i > 0) await call('hideFixed');
    await call('settle');
    rec.main.tiles.push({ src: await shot(), crop: at.crop, destX: at.crop.x, destY: at.destY });
    rec.main.height = Math.max(rec.main.height, at.total, at.destY + at.crop.h);
    if (i === 0) await call('hideFixed');
    if (at.next <= prevNext) break;
    if (at.done && !(await call('moreBelow', at.destY + at.crop.h))) break;
    prevNext = at.next; y = at.next;
  }
  rec.locked = info.locked;
  rec.main.height = Math.min(rec.main.height, Math.max(...rec.main.tiles.map(t => t.destY + t.crop.h)));
  await call('removeBadges');
  for (const s of info.sections) {
    if (s.kind !== 'scroll') continue;
    const sec = { n: s.n, width: 0, height: 0, tiles: [] };
    let top = 0, shots = 0;
    rows: for (;;) {
      let left = 0, at = null;
      for (;;) {
        if (shots++ >= MAX_SECTION_SHOTS) break rows;
        at = await call('scrollSection', s.n, left, top, shots === 1);
        if (!at) break rows;
        await sleep(SETTLE_MS);
        await call('settle');
        sec.tiles.push({ src: await shot(), crop: at.crop, destX: at.contentX, destY: at.contentY });
        sec.width = Math.max(sec.width, at.contentX + at.crop.w); sec.height = Math.max(sec.height, at.contentY + at.crop.h);
        if (at.scrollLeft >= at.maxX - 1) break;
        left = at.scrollLeft + at.crop.w;
      }
      if (at.scrollTop >= at.maxY - 1) break;
      top = at.scrollTop + at.crop.h;
    }
    if (sec.tiles.length) rec.sections.push(sec);
  }
  await call('restore');
  return { rec, info };
}

// Join the screens (like viewer.js) and count each marker colour, in a blank page.
async function check(ctx, rec, markers, save) {
  const p = await ctx.newPage();
  await p.goto('about:blank');
  const res = await p.evaluate(async ({ rec, markers, save }) => {
    const parse = c => c.match(/\d+/g).map(Number);
    const want = new Map(markers.map(m => { const [r, g, b] = parse(m.c); return [(r << 16) | (g << 8) | b, m]; }));
    async function join(part) {
      const cv = new OffscreenCanvas(Math.max(1, part.width), Math.max(1, part.height));
      const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
      for (const t of part.tiles) {
        const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + t.src)).blob());
        const c = t.crop; g.drawImage(bmp, c.x, c.y, c.w, c.h, t.destX, t.destY, c.w, c.h);
      }
      return cv;
    }
    // Count blobs of each marker colour (a blob = touching pixels of that exact colour, 150+ pixels).
    function blobs(cv) {
      const { width: w, height: h } = cv, d = cv.getContext('2d').getImageData(0, 0, w, h).data;
      const seen = new Uint8Array(w * h), out = {};
      for (let i = 0; i < w * h; i++) {
        if (seen[i]) continue;
        const k = (d[i * 4] << 16) | (d[i * 4 + 1] << 8) | d[i * 4 + 2];
        if (!want.has(k)) continue;
        let size = 0, top = h; const st = [i]; seen[i] = 1;
        while (st.length) {
          const j = st.pop(); size++; top = Math.min(top, (j / w) | 0);
          const x = j % w, y = (j / w) | 0;
          for (const q of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1]) {
            if (q < 0 || seen[q]) continue;
            if (((d[q * 4] << 16) | (d[q * 4 + 1] << 8) | d[q * 4 + 2]) !== k) continue;
            seen[q] = 1; st.push(q);
          }
        }
        if (size >= 150) (out[k] = out[k] || []).push(top);
      }
      return out;
    }
    const main = await join(rec.main);
    const found = { main: blobs(main), secs: [] };
    const pics = save ? [await (await main.convertToBlob()).arrayBuffer().then(b => [...new Uint8Array(b)])] : [];
    for (const s of rec.sections) { const cv = await join(s); found.secs.push(blobs(cv)); if (save) pics.push(await (await cv.convertToBlob()).arrayBuffer().then(b => [...new Uint8Array(b)])); }
    const problems = [];
    for (const [k, m] of want) {
      const inMain = (found.main[k] || []).length, inSecs = found.secs.map(s => (s[k] || []).length);
      if (inMain > 1) problems.push('doubled on main capture: ' + m.label + ' (x' + inMain + ' at y ' + found.main[k].join(', ') + ')');
      inSecs.forEach((c, i) => { if (c > 1) problems.push('doubled in section ' + (i + 1) + ': ' + m.label); });
      if (!inMain && !inSecs.some(Boolean) && !m.opt) problems.push('missing: ' + m.label);
    }
    return { problems, pics, size: [main.width, main.height], sections: rec.sections.map(s => [s.width, s.height]) };
  }, { rec, markers, save });
  await p.close();
  return res;
}

(async () => {
  require('./make-pages.js');   // (re)build the test pages first
  const only = process.argv.slice(2);
  const files = fs.readdirSync(path.join(DIR, 'pages')).filter(f => f.endsWith('.html') && (!only.length || only.some(o => f.startsWith(o)))).sort();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  // Pages are served from a pretend site. /slow/R-G-B.svg is a square of that colour that takes 1.2 seconds to arrive.
  await ctx.route('http://pp.test/**', async route => {
    const u = new URL(route.request().url());
    const slow = u.pathname.match(/^\/slow\/(\d+)-(\d+)-(\d+)\.svg$/);
    if (slow) {
      await sleep(1200);
      return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect width="60" height="60" fill="rgb(${slow[1]},${slow[2]},${slow[3]})"/></svg>` });
    }
    const f = path.join(DIR, 'pages', path.basename(u.pathname));
    if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: 'not found' });
    route.fulfill({ contentType: 'text/html', body: fs.readFileSync(f) });
  });
  let bad = 0;
  if (process.env.SAVE) fs.mkdirSync(path.join(DIR, 'out'), { recursive: true });
  for (const f of files) {
    const page = await ctx.newPage();
    await page.goto('http://pp.test/' + f);
    await sleep(600);
    const markers = await page.evaluate(() => [...document.querySelectorAll('.m')].map(el => ({
      c: el.dataset.c, opt: el.classList.contains('opt'),
      label: ((el.closest('.row, h2, h3, section, header, aside, li, summary, p, div, td, th') || el).textContent || '').trim().slice(0, 40) || '(marker)'
    })));
    const maxH = await page.evaluate(() => +(document.querySelector('meta[name="pp-max-height"]') || {}).content || 0);
    let r;
    try {
      const { rec, info } = await capture(page); r = await check(ctx, rec, markers, !!process.env.SAVE); r.info = info;
      if (maxH && r.size[1] > maxH) r.problems.push('main capture is ' + r.size[1] + 'px tall, should be at most ' + maxH + ' (blank space added)');
    }
    catch (e) { r = { problems: ['capture failed: ' + e.message.split('\n')[0]] }; }
    if (process.env.SAVE && r.pics) r.pics.forEach((b, i) => fs.writeFileSync(path.join(DIR, 'out', f.replace('.html', '') + (i ? '-section' + i : '') + '.png'), Buffer.from(b)));
    const title = await page.title().catch(() => f);
    console.log((r.problems.length ? '✗ ' : '✓ ') + f + '  ' + title + (r.size ? '  [' + r.size.join('x') + (r.sections.length ? ', sections ' + r.sections.map(s => s.join('x')).join(' ') : '') + ']' : ''));
    for (const p of r.problems.slice(0, 6)) console.log('     ' + p);
    if (r.problems.length > 6) console.log('     ... and ' + (r.problems.length - 6) + ' more');
    if (r.problems.length) bad++;
    await page.close();
  }
  await browser.close();
  console.log('\n' + (files.length - bad) + ' of ' + files.length + ' test pages captured cleanly.');
  process.exit(bad ? 1 : 0);
})();
