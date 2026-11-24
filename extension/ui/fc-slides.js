// Their picture's own web address (the "picture link") for a copy, and TikTok photo posts.
// Ben: every match should carry the address of the picture itself, not only the page, and for a
// TikTok slideshow the address of the one slide that is the client's photo ("Slide 3 of 4").
// Uses bitmapOf, ourBlob and FCD from fc-found.js.

// The post check for a TikTok photo post: the post is opened in a quiet pinned tab, every slide
// is read (tiktok.js) and lined up with the client's photo. Fills the post check's result.
async function slidesInto(c, res) {
  if (typeof PP_TIKTOK === 'undefined' || !PP_TIKTOK.isPhotoPost(c.url) || typeof PP_ALIGN === 'undefined') return;
  if (!globalThis.PP_SOCIAL || !PP_SOCIAL.openQuiet || !api.scripting) return;
  res.tt = 1;
  let tab, ours, done = false;
  try {
    ours = await bitmapOf(await ourBlob(FCD && FCD.photos.get(c.photo)));
    tab = await PP_SOCIAL.openQuiet(c.url);
    const [r] = await api.scripting.executeScript({ target: { tabId: tab.id }, func: PP_TIKTOK.readSlides });
    const got = r && r.result;
    if (!got || !got.slides.length) return;           // the post is gone, or TikTok did not draw it
    res.n = got.of; res.slides = got.slides.map(s => s.url).slice(0, 35);
    let best = null, unsure = false, read = 0;
    for (const s of got.slides.slice(0, 35)) {
      const m = await slideLineUp(ours, s.url);
      if (!m) continue;
      read++;
      if (m.state === 'unsure') unsure = true;
      if (m.state === 'seen' && (!best || m.pct > best.pct)) best = { ...m, s };
    }
    if (!read) return;
    if (best) {
      res.state = 'seen'; res.pct = best.pct; res.pic = best.s.url; res.browser = 'seen';
      res.slide = { n: best.s.n, of: got.of, url: best.s.url, w: best.s.w, h: best.s.h, exp: PP_TIKTOK.expires(best.s.url) };
      // Moved to Removed earlier because only the cover was looked at: the photo is a later slide.
      if (c.status === 'removed' && c.removedBy === 'postcheck') { await FC.answer([c.id], 'new', { removedBy: '' }); c.status = 'new'; c.removedBy = ''; }
    } else if (unsure) { res.state = 'unsure'; res.browser = 'unsure'; }
    else { res.state = 'notSeen'; res.browser = 'notSeen'; }
    res.video = false; done = true;
  } catch (e) { /* left as it was */ } finally {
    // The cover alone never decides a slideshow: the photo may be a later slide.
    if (!done && res.state === 'notSeen') res.state = 'unknown';
    if (ours) try { ours.close(); } catch (e) { /* freed */ }
    if (tab) PP_SOCIAL.closeQuiet(tab);
  }
}
// A TikTok slideshow copy checked before slides were read (before this version) is checked again once.
const slidesDue = c => typeof PP_TIKTOK !== 'undefined' && !!c.postChk && !c.postChk.tt && PP_TIKTOK.isPhotoPost(c.url);
async function slideLineUp(ours, url) {
  let bm = null;
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
    const r = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    bm = await bitmapOf(await r.blob());
    const best = await PP_ALIGN.align(ours, bm, undefined, { fast: true });
    const pct = best ? Math.max(0, Math.min(100, Math.round(best.sc.lines * 100))) : 0;
    const inl = best ? best.inliers || 0 : 0;
    return { pct, state: inl >= 12 && pct >= 60 ? 'seen' : inl < 10 || pct < 40 ? 'notSeen' : 'unsure' };
  } catch (e) { return null; } finally { if (bm) try { bm.close(); } catch (e) { /* freed */ } }
}

// The best known address of THEIR picture: the matching TikTok slide, the picture the search site
// or the page check found on their page, or the post's own picture once it was seen to match.
function picLink(c) {
  const pc = c.postChk;
  const exp = u => typeof PP_TIKTOK !== 'undefined' ? PP_TIKTOK.expires(u) : '';
  if (pc && pc.slide && /^https?:/i.test(pc.slide.url || '')) return { url: pc.slide.url, slide: pc.slide, exp: pc.slide.exp || exp(pc.slide.url) };
  if (/^https?:/i.test(c.img || '')) return { url: c.img, slide: null, exp: exp(c.img) };
  if (pc && pc.state === 'seen' && /^https?:/i.test(pc.pic || '')) return { url: pc.pic, slide: null, exp: exp(pc.pic) };
  return null;
}
const expText = iso => new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
function picLinkRow(c) {
  const L = picLink(c);
  if (!L) {
    const why = typeof PP_TIKTOK !== 'undefined' && PP_TIKTOK.isPhotoPost(c.url) ? 'Not found yet. PageProof opens the post and reads each slide during the post check.'
      : 'Not known: the search site only gave its small preview. PageProof gets the link when it finds the photo on their page.';
    return `<dt>Picture link</dt><dd><span class="muted" style="font-size:13px">${why}</span></dd>`;
  }
  const lab = L.slide && typeof PP_TIKTOK !== 'undefined' ? PP_TIKTOK.label(L.slide) : '';
  return `<dt>Picture link</dt><dd>${lab ? `<b>${esc(lab)}</b>${L.slide.w ? ` <span class="muted" style="font-size:13px">${L.slide.w} × ${L.slide.h}</span>` : ''}<br>` : ''}<a class="mono" style="font-size:12px;overflow-wrap:anywhere" href="${safeUrl(L.url)}" target="_blank" rel="noreferrer">${esc(L.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 110))}${L.url.length > 118 ? '…' : ''}</a>
    <div class="row" style="gap:6px;margin-top:4px"><button class="btn sm" data-act="copytext" data-v="${esc(L.url)}">Copy link</button><a class="btn sm" href="${safeUrl(L.url)}" target="_blank" rel="noreferrer">Open</a></div>
    ${L.exp ? `<span class="muted" style="font-size:12.5px">TikTok signs this link, so it stops working ${esc(expText(L.exp))}. The Evidence report and Capture keep the picture file itself.</span>` : ''}</dd>`;
}
