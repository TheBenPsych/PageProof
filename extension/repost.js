// Reposts and shares on social media (4.32, Ben).
// A search engine often links to an ACCOUNT page (facebook.com/SomePage/) when the match is really
// one post on it, and that post is often only a share or repost of someone else's post. Ben had to
// scroll the page to find it. PageProof now does that scrolling for him:
//  1. "Link goes to the account page, not the post": the account page is opened in a quiet pinned
//     tab of your own browser, scrolled, and every post's pictures are lined up with your client's
//     photo. The post that holds it becomes "the exact post".
//  2. Reposts and shares are spotted on that post (Facebook shares, X reposts and quotes, Instagram
//     and Threads reposts, TikTok reposts, Tumblr reblogs, Bluesky reposts). The copy is tagged
//     "Repost of <original account>", hidden unless "Show reposts and shares" is ticked, and points
//     to the original post as the lead.
// Nothing is ever answered for you. Nothing leaves the computer except opening the pages.
const PP_REPOST = (() => {
  // Platforms this works on (keys as PP_SOCIAL.platform(...).key / listed()).
  const PLAT = { 'facebook.com': 'fb', 'fb.com': 'fb', 'instagram.com': 'ig', 'x.com': 'x', 'twitter.com': 'x', 'threads.net': 'th', 'threads.com': 'th', 'tiktok.com': 'tt', 'tumblr.com': 'tb', 'bsky.app': 'bs' };
  const plat = site => PLAT[PP_SOCIAL.listed(site) || ''] || PLAT[String(site || '').replace(/^(www|m|mobile|web)\./, '')] || '';
  const WORD = { fb: 'Share', x: 'Repost', ig: 'Repost', th: 'Repost', tt: 'Repost', tb: 'Reblog', bs: 'Repost' };
  // A link to one post (not an account) on each platform.
  const POST = {
    fb: /facebook\.com\/(?:[^/?#]+\/(?:posts|videos|photos|reel)\/|reel\/|watch\/?\?v=|permalink\.php|story\.php|photo\/?\?|photo\.php|share\/[pvr]\/|[^/?#]+\/permalink\/|groups\/[^/]+\/(?:posts|permalink)\/)/i,
    x: /(?:x|twitter)\.com\/\w{1,15}\/status\/\d+/i,
    ig: /instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/[\w-]+/i,
    th: /threads\.(?:net|com)\/@[\w.]+\/post\/[\w-]+/i,
    tt: /tiktok\.com\/@[\w.-]+\/(?:video|photo)\/\d+/i,
    tb: /(?:tumblr\.com\/[\w-]+\/\d+|\.tumblr\.com\/post\/\d+)/i,
    bs: /bsky\.app\/profile\/[^/]+\/post\/\w+/i,
  };
  const isPostLink = (p, u) => !!(POST[p] && POST[p].test(String(u || '')));
  // The link is the account's own page, not one post.
  function profileOnly(c) {
    const p = plat(c.site);
    if (!p || !c.url) return false;
    if (isPostLink(p, c.url)) return false;
    const a = PP_SOCIAL.fromUrl(c.url);
    if (!a) return false;
    let u; try { u = new URL(c.url); } catch (e) { return false; }
    const seg = u.pathname.split('/').filter(Boolean);
    // facebook.com/Name, /Name/photos (a list), /profile.php?id=..., x.com/name, /name/media, @name...
    if (p === 'fb') return !(seg[0] === 'groups' && seg.length > 2) && !/^(watch|reel|photo|photo\.php|story\.php|permalink\.php|share)$/i.test(seg[0] || '');
    return seg.length <= 2 && !/^(status|p|reel|reels|tv|post|video|photo)$/i.test(seg[1] || '');
  }
  // Pictures with the same file name are the same picture (Facebook, Instagram and X keep the
  // file name across sizes: ".../468012345_1234567890_123_n.jpg?...").
  const stem = u => { try { const x = new URL(u); const f = x.pathname.split('/').pop() || ''; return /\.(jpe?g|png|webp|gif|heic)$/i.test(f) || /twimg/.test(x.hostname) ? (x.hostname.includes('twimg') ? x.pathname : f).toLowerCase() : ''; } catch (e) { return ''; } };

  // ---------------------------------------------------------------- runs INSIDE the page's tab
  // Self-contained. Scrolls (when asked) and returns every post on the page with its pictures,
  // links (marked when they sit in the post's header), timestamps and repost labels.
  async function scanInTab(opt) {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const H = location.hostname.replace(/^(www|m|mobile|web)\./, '');
    const P = /(^|\.)(facebook|fb)\.com$/.test(H) ? 'fb' : /instagram\.com$/.test(H) ? 'ig' : /(^|\.)(x|twitter)\.com$/.test(H) ? 'x' : /threads\.(net|com)$/.test(H) ? 'th' : /tiktok\.com$/.test(H) ? 'tt' : /tumblr\.com$/.test(H) ? 'tb' : /bsky\.app$/.test(H) ? 'bs' : '';
    const ITEM = {
      fb: '[role="article"], [aria-posinset], [data-pagelet^="FeedUnit"], [role="dialog"] [role="complementary"]',
      x: 'article[data-testid="tweet"]',
      ig: 'article, a[href*="/p/"], a[href*="/reel/"]',
      th: '[data-pressable-container="true"]',
      tt: '[data-e2e="user-post-item"], [data-e2e="user-repost-item"], [data-e2e="user-liked-item"], [data-e2e="browse-video"], [class*="DivItemContainer"]',
      tb: 'article',
      bs: '[data-testid^="feedItem-"], [data-testid^="postThreadItem-"]',
    }[P] || 'article';
    const COMMENT = '[role="article"][aria-label*="omment" i], [role="article"][aria-label*="eply" i], [data-testid="comment"], [data-e2e="comment-level-1"]';
    const HEAD = 'h2, h3, h4, strong, [data-ad-rendering-role="profile_name"], [data-testid="User-Name"], header';
    const TIME = /^(just now|\d{1,2}\s?(s|m|h|d|w|y|min|mins|hr|hrs)|\d+\s(seconds?|minutes?|hours?|days?|weeks?)( ago)?|yesterday( at .+)?|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2}(,? \d{4})?( at \d{1,2}:\d{2}\s?[ap]m)?|\d{1,2} (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*( \d{4})?( at \d{1,2}:\d{2})?|(monday|tuesday|wednesday|thursday|friday|saturday|sunday)( at .+)?)$/i;
    const LABEL = /\b(reposted|retweeted|reblogged|shared an? (post|photo|video|reel|memory|link|album|story)|shared .{1,60}'s (post|photo|video|reel)|reposted by|repost)\b/i;
    const seen = new Map();   // element -> record
    const outer = el => { let it = null; for (let e = el; e && e !== document.body; e = e.parentElement) if (e.matches && e.matches(ITEM)) it = e; return it; };
    const inComment = (el, item) => { const c = el.closest(COMMENT); return !!c && c !== item && item.contains(c); };
    function read(item) {
      const imgs = [], links = [], times = [];
      for (const im of item.querySelectorAll('img, video[poster]')) {
        if (inComment(im, item)) continue;
        const r = im.getBoundingClientRect();
        const src = im.tagName === 'VIDEO' ? im.poster : (im.currentSrc || im.src || '');
        if (!/^https?:/.test(src) || Math.max(r.width, im.naturalWidth || 0) < 120) continue;
        const q = im.closest('div[role="link"]');
        imgs.push({ src, w: im.naturalWidth || Math.round(r.width), inQuote: !!(q && item.contains(q) && q !== item && q.querySelector('[data-testid="User-Name"]')) });
        if (imgs.length >= 8) break;
      }
      for (const a of item.querySelectorAll('a[href]')) {
        if (inComment(a, item) || links.length >= 80) continue;
        const t = (a.innerText || a.getAttribute('aria-label') || '').trim().slice(0, 80);
        const q = a.closest('div[role="link"]');
        links.push({ h: a.href, t, head: !!a.closest(HEAD), quote: !!(q && q !== item && item.contains(q)) });
        const lab = (a.getAttribute('aria-label') || '').trim();
        if (TIME.test(t) || TIME.test(lab) || a.querySelector('time')) times.push(a.href);
      }
      for (const t of item.querySelectorAll('time')) if (!inComment(t, item)) times.push((t.closest('a') || {}).href || t.getAttribute('datetime') || 'time');
      const ctx = item.querySelector('[data-testid="socialContext"]');
      const text = (item.innerText || '').slice(0, 1200);
      const lab = (ctx && ctx.innerText) || (LABEL.exec(text) || [''])[0];
      const own = item.matches('a[href]') ? item.href : '';
      return { imgs, links, times: [...new Set(times)].length, lab: String(lab || '').trim().slice(0, 120), text: text.slice(0, 400), href: own, tab: opt.tab || '' };
    }
    function collect() {
      let added = 0;
      for (const im of document.querySelectorAll('img, video[poster]')) {
        const it = outer(im);
        if (!it || seen.has(it)) continue;
        const r = read(it);
        if (!r.imgs.length) continue;
        seen.set(it, r); added++;
      }
      return added;
    }
    const want = opt.want || [];
    const hit = () => want.length && [...seen.values()].some(r => r.imgs.some(i => want.some(w => w && i.src.toLowerCase().includes(w))));
    if (opt.clickTab) {
      const t = [...document.querySelectorAll('a, button, [role="tab"], p, span')].find(e => (e.innerText || '').trim().toLowerCase() === opt.clickTab.toLowerCase());
      if (t) { (t.closest('a, button, [role="tab"]') || t).click(); await wait(2500); }
    }
    collect();
    let still = 0;
    for (let i = 0; i < (opt.screens || 0) && !hit() && still < 3; i++) {
      window.scrollBy(0, Math.round(innerHeight * 0.9));
      await wait(1300);
      still = collect() ? 0 : still + 1;
    }
    const body = (document.body ? document.body.innerText : '').slice(0, 3000);
    const wall = /\b(log in|sign up|create new account|see more on facebook|log in to continue)\b/i.test(body) && seen.size < 2;
    const um = /"owner":\{[^{}]{0,200}?"username":"([A-Za-z0-9._]{1,30})"/.exec(document.documentElement.innerHTML.slice(0, 2e6));
    return { plat: P, url: location.href, items: [...seen.values()].slice(0, 120), wall, igOwner: um ? um[1] : '' };
  }

  // ---------------------------------------------------------------- reading what came back
  const same = (a, b) => !!a && !!b && (a.key === b.key || PP_SOCIAL.plainName(a) === PP_SOCIAL.plainName(b));
  const acctOf = u => { const a = PP_SOCIAL.fromUrl(u); return a && a.kind !== 'group' ? a : null; };
  // Is this post (one item) a repost or share of someone else's post? own = the account the copy is on.
  function judge(p, item, own, imgIdx) {
    const links = item.links || [];
    const postLinks = links.filter(l => isPostLink(p, l.h));
    const foreign = l => { const a = acctOf(l.h); return a && !same(a, own) ? a : null; };
    const label = /repost|retweet|reblog|shared/i.test(item.lab || '');
    const img = item.imgs[imgIdx] || item.imgs[0] || {};
    // X: "X reposted" over the post, or a quoted post that holds the picture.
    if (p === 'x') {
      if (img.inQuote) { const l = links.find(l => l.quote && foreign(l)); if (l) return { kind: 'quote', orig: foreign(l), origPost: (links.find(x => x.quote && isPostLink(p, x.h)) || {}).h || '', sure: 'sure' }; }
      if (label) { const l = links.find(l => l.head && foreign(l)) || links.find(foreign); if (l) return { kind: 'repost', orig: foreign(l), origPost: (postLinks.find(x => foreign(x)) || {}).h || '', sure: 'sure' }; }
      const pl = postLinks.find(x => foreign(x) && !x.quote);
      if (pl) return { kind: 'repost', orig: foreign(pl), origPost: pl.h, sure: 'sure' };
      return null;
    }
    // Instagram, Threads, TikTok, Tumblr, Bluesky: the post's own link names its real owner.
    if (p !== 'fb') {
      const self = item.href && isPostLink(p, item.href) ? { h: item.href } : null;
      const pl = (self && foreign(self) ? self : null) || postLinks.find(x => foreign(x));
      if (pl) return { kind: p === 'tb' ? 'reblog' : 'repost', orig: foreign(pl), origPost: pl.h, sure: 'sure' };
      if (item.tab === 'reposts' || label) {
        const l = links.find(l => l.head && foreign(l)) || links.find(foreign);
        return { kind: p === 'tb' ? 'reblog' : 'repost', orig: l ? foreign(l) : null, origPost: '', sure: l ? 'sure' : 'likely' };
      }
      return null;
    }
    // Facebook: a shared post shows a second header (the original poster) and a second time.
    // "Page is with Person" alone is a tag, not a share, so two times are needed.
    const heads = [];
    for (const l of links.filter(l => l.head)) { const a = acctOf(l.h); if (a && !heads.some(h => same(h, a))) heads.push(a); }
    const other = heads.find(h => !same(h, own));
    const otherPost = postLinks.find(x => foreign(x));
    if (other && (item.times >= 2 || /shared/i.test(item.lab || ''))) return { kind: 'share', orig: other, origPost: otherPost && same(foreign(otherPost), other) ? otherPost.h : '', sure: /shared/i.test(item.lab || '') || otherPost ? 'sure' : 'likely' };
    if (otherPost && item.times >= 2) return { kind: 'share', orig: foreign(otherPost), origPost: otherPost.h, sure: 'likely' };
    return null;
  }
  // This item's own link (the exact post), when the page shows it.
  function postUrlOf(p, item, own, rp) {
    if (item.href && isPostLink(p, item.href)) return item.href;
    const pl = (item.links || []).filter(l => isPostLink(p, l.h));
    const mine = pl.find(l => { const a = acctOf(l.h); return a && same(a, own); });
    if (mine) return mine.h;
    const notOrig = pl.find(l => !rp || l.h !== rp.origPost);
    return (notOrig || pl[0] || {}).h || '';
  }

  // ---------------------------------------------------------------- the whole check for one copy
  // Returns what to save on the copy as c.rp:
  //   { at, state: 'repost' | 'own' | 'notfound' | 'blocked' | 'failed', kind, orig, origPost, post, sure, pct }
  async function check(c) {
    const p = plat(c.site);
    if (!p) return null;
    const own = c.acct || PP_SOCIAL.fromUrl(c.url);
    const onProfile = profileOnly(c);
    const want = [stem(c.img)].filter(Boolean);
    const pages = [{ url: c.url, screens: onProfile ? 14 : 0 }];
    if (onProfile && own) {
      const bare = PP_SOCIAL.bareName(own);
      if (p === 'ig') pages.push({ url: 'https://www.instagram.com/' + bare + '/reposts/', screens: 8, tab: 'reposts' });
      if (p === 'th') pages.push({ url: 'https://www.threads.net/@' + bare + '/reposts', screens: 8, tab: 'reposts' });
      if (p === 'tt') pages.push({ url: own.url, screens: 8, tab: 'reposts', clickTab: 'Reposts' });
    }
    const base = { at: new Date().toISOString(), onProfile };
    let wall = false;
    for (const pg of pages) {
      if (PP_SOCIAL.halt && PP_SOCIAL.halt.on) break;
      let tab, res;
      try {
        tab = await PP_SOCIAL.openQuiet(pg.url);
        await new Promise(r => setTimeout(r, 2500));      // social sites draw posts after loading
        const [r] = await api.scripting.executeScript({ target: { tabId: tab.id }, func: scanInTab, args: [{ screens: pg.screens, want, tab: pg.tab || '', clickTab: pg.clickTab || '' }] });
        res = r && r.result;
      } catch (e) { res = null; } finally { PP_SOCIAL.closeQuiet(tab); }
      if (!res) continue;
      if (res.wall) wall = true;
      const items = res.items || [];
      if (!items.length) continue;
      // Which post holds the photo: same file name first, then by lining the pictures up.
      let pick = null;
      for (let i = 0; i < items.length && !pick; i++) items[i].imgs.forEach((im, k) => { if (!pick && want.length && stem(im.src) && want.includes(stem(im.src))) pick = { i, k, pct: null }; });
      if (!pick && !onProfile && items.length === 1) pick = { i: 0, k: 0, pct: null };
      if (!pick && typeof FC_PREV !== 'undefined' && FC_PREV.bestOf) {
        const flat = []; items.forEach((it, i) => it.imgs.forEach((im, k) => flat.push({ i, k, src: im.src })));
        const best = await FC_PREV.bestOf(c, flat.slice(0, 60).map(f => f.src)).catch(() => null);
        if (best && best.pct >= 40) pick = { ...flat[best.i], pct: best.pct };
      }
      if (!pick) continue;
      const item = items[pick.i];
      let rp = judge(p, item, own, pick.k);
      // Instagram post page: the page's own data names the post's owner.
      if (!rp && p === 'ig' && !onProfile && res.igOwner && own && PP_SOCIAL.plainName({ handle: res.igOwner }) !== PP_SOCIAL.plainName(own)) rp = { kind: 'repost', orig: PP_SOCIAL.fromUrl('https://www.instagram.com/' + res.igOwner + '/'), origPost: c.url, sure: 'likely' };
      const post = onProfile ? postUrlOf(p, item, own, rp) : '';
      return { ...base, ...(rp ? { state: 'repost', ...rp } : { state: 'own' }), post, pct: pick.pct };
    }
    return { ...base, state: wall ? 'blocked' : 'notfound' };
  }
  // Which copies are worth opening: account-page links on all seven, and post links only where a
  // repost gets its own link (Facebook shares, Tumblr reblogs). On X, Instagram, Threads, TikTok and
  // Bluesky a post link already names the real poster.
  const worth = c => { const p = plat(c.site); return !!p && (profileOnly(c) || p === 'fb' || p === 'tb'); };
  const due = c => worth(c) && c.status === 'new' && (!c.rp || (c.rp.state !== 'repost' && c.rp.state !== 'own' && Date.now() - Date.parse(c.rp.at || 0) > 7 * 864e5));
  return { PLAT, plat, WORD, isPostLink, profileOnly, stem, scanInTab, judge, postUrlOf, check, worth, due };
})();
if (typeof self !== 'undefined') self.PP_REPOST = PP_REPOST;
