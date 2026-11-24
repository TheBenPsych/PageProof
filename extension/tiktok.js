// TikTok photo posts (slideshows: tiktok.com/@name/photo/123...).
// The pictures are not in the page's own HTML or in TikTok's public post info: they only appear
// once the post is drawn in a browser, as the slides of a sideways slider. readSlides() runs
// inside that tab and lists each slide's real picture address (TikTok's picture server).
// TikTok signs those addresses and they stop working after about two days, so PageProof keeps
// the picture file too wherever it can (Capture, the Evidence report).
(() => {
  const isPhotoPost = url => { try { const u = new URL(url); return /(^|\.)tiktok\.com$/i.test(u.hostname) && /\/photo\/\d+/.test(u.pathname); } catch (e) { return false; } };
  // ?image_index=3 in the address = the 3rd picture (counted from 1). 0 when not given.
  const slideFromUrl = url => { try { const n = parseInt(new URL(url).searchParams.get('image_index'), 10); return n > 0 ? n : 0; } catch (e) { return 0; } };
  // When a signed TikTok picture address stops working (from its x-expires part), or ''.
  const expires = url => { try { const s = parseInt(new URL(url).searchParams.get('x-expires'), 10); return s > 1e9 ? new Date(s * 1000).toISOString() : ''; } catch (e) { return ''; } };
  // Runs INSIDE the TikTok tab (self-contained). { of, on, slides: [{ n, url, w, h }] }
  async function readSlides() {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const pick = () => {
      const m = new Map();
      // The slider repeats the first and last slide for its endless loop; the index tells them apart.
      for (const s of document.querySelectorAll('.swiper-slide[data-swiper-slide-index]')) {
        const i = parseInt(s.getAttribute('data-swiper-slide-index'), 10);
        const img = s.querySelector('img');
        const u = img && (img.currentSrc || img.src);
        if (!(i >= 0) || m.has(i) || !/^https?:/.test(u || '')) continue;
        m.set(i, { n: i + 1, url: u, w: img.naturalWidth || 0, h: img.naturalHeight || 0 });
      }
      if (!m.size) {
        // Another layout: photo-mode pictures in page order.
        let n = 0;
        for (const img of document.querySelectorAll('img[class*="PhotoSlide" i], img[src*="photomode" i]')) {
          const u = img.currentSrc || img.src;
          if (!/^https?:/.test(u || '') || [...m.values()].some(x => x.url === u)) continue;
          m.set(n, { n: n + 1, url: u, w: img.naturalWidth || 0, h: img.naturalHeight || 0 }); n++;
        }
      }
      return m;
    };
    let m = pick();
    for (let t = 0; t < 12 && !m.size; t++) { await wait(500); m = pick(); }
    // Give the pictures a moment to finish loading, so their sizes are known.
    for (let t = 0; t < 6 && [...m.values()].some(x => !x.w); t++) { await wait(400); m = pick(); }
    const act = document.querySelector('.swiper-slide-active[data-swiper-slide-index]');
    const slides = [...m.values()].sort((a, b) => a.n - b.n);
    return { of: slides.length, on: act ? parseInt(act.getAttribute('data-swiper-slide-index'), 10) + 1 : 0, slides };
  }
  // "Slide 3 of 4"
  const label = s => s && s.n ? 'Slide ' + s.n + (s.of ? ' of ' + s.of : '') : '';
  globalThis.PP_TIKTOK = { isPhotoPost, slideFromUrl, expires, readSlides, label };
})();
