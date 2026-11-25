// Firm checks for one copy:
//  - the "Document or don't" rules, by kind of site (general rules only: nothing here names a
//    company, a client or a person, because this code is public),
//  - reading their page (without your cookies) for the credit line under the picture, signs they
//    sell something or show ads, and YouTube or social embeds,
//  - the date the photo was first published (from the firm's file names: 6.26.21_Subject_Lastname.jpg),
//  - a damages hint (statutory or actual) and the "Ready for legal?" list.
// Nothing from their page ever runs: it is read as text with DOMParser.
const PP_CHECKS = (() => {
  const DAY = 864e5;
  // ---------------------------------------------------------------- kinds of site and the rules
  const KINDS = [
    ['company', 'Company'], ['nonprofit', 'Non-profit'], ['university', 'Public university'], ['gov', 'Government agency'],
    ['church', 'Church or synagogue'], ['person', 'Individual (not famous)'], ['celeb', 'Celebrity or very popular person'],
    ['lawfirm', 'Law firm'], ['ugc', 'User-posted article'],
  ];
  const KIND_NAME = Object.fromEntries(KINDS);
  const KIND_RULES = {
    nonprofit: ['warn', 'Only document big non-profits that use the photo to sell something.'],
    university: ['stop', 'Don\'t document public universities unless the use is commercial, like selling tickets to a game or concert.'],
    gov: ['warn', 'Most government sites are not documented. A few agencies are, so check before you go on.'],
    church: ['stop', 'Don\'t document churches or synagogues.'],
    person: ['stop', 'Don\'t document individuals who are not celebrities.'],
    celeb: ['warn', 'Find the person\'s own address, not their company\'s (the company usually doesn\'t run their social media). Don\'t use IMDb: it lists their management.'],
    lawfirm: ['warn', 'If the attorney or firm is connected to the original article about the case, don\'t document it.'],
    ugc: ['stop', 'Don\'t document user-posted articles, unless the writer is staff or the site\'s terms say an editor reviews every post.'],
  };
  const UGC = /(^|\.)(medium\.com|blogspot\.[a-z.]+|wordpress\.com|tumblr\.com|reddit\.com|quora\.com|hubpages\.com|wattpad\.com|weebly\.com|livejournal\.com|substack\.com|tistory\.com|over-blog\.com)$/;
  const SOCIAL = /(^|\.)(facebook|instagram|twitter|x|threads|tiktok|pinterest|linkedin|youtube|snapchat)\.com$/;
  // A first guess at the kind of site. Only a guess: the person picks.
  function guessKind(c, pf, facts) {
    const site = String(c.site || '');
    const words = [pf && pf.siteName, pf && pf.title, facts && facts.names && facts.names[0], site].filter(Boolean).join(' ');
    if (/\.(gov|mil)(\.[a-z]{2})?$/.test(site) || /\bgov\.[a-z]{2}$/.test(site)) return 'gov';
    if (/\.edu(\.[a-z]{2})?$/.test(site) || /\b(university|college)\b/i.test(words)) return 'university';
    if (/\b(church|parish|synagogue|temple|ministr(y|ies)|diocese|congregation|chapel|mosque)\b/i.test(words)) return 'church';
    if (/\b(law ?firm|attorneys?|lawyers?|llp|esq|legal group|law group|law offices?)\b/i.test(words)) return 'lawfirm';
    if (UGC.test(site)) return 'ugc';
    if (SOCIAL.test(site)) return '';
    if (/\.org(\.[a-z]{2})?$/.test(site) || /\b(foundation|non-?profit|charity|association|society)\b/i.test(words)) return 'nonprofit';
    return 'company';
  }
  const NINTH = 'California, Oregon, Washington, Arizona, Nevada, Idaho, Montana, Alaska or Hawaii';
  // The rules that apply to this copy, worst first. kind = the saved kind of site ('' = not picked).
  function rules(c, kind, pf) {
    const out = [];
    if (kind && KIND_RULES[kind]) out.push({ lvl: KIND_RULES[kind][0], text: KIND_RULES[kind][1], why: KIND_NAME[kind] });
    if (pf && pf.ok && pf.yt && !pf.imgFound) out.push({ lvl: 'stop', text: 'The photo looks like it is inside a YouTube embed on their page. YouTube embeds are not accepted.', why: 'YouTube embed' });
    const embed = c.use === 'embedded' || (pf && pf.ok && pf.embedPost && !pf.imgFound);
    if (embed) {
      if (c.country && c.country !== 'United States') out.push({ lvl: 'stop', text: 'This is an embed on a site outside the U.S. (' + c.country + '). Embeds are not accepted outside the U.S.', why: 'Embed' });
      else out.push({ lvl: 'warn', text: 'This is an embed (their page shows the photo from another site). Embeds are not accepted in the 9th Circuit (' + NINTH + ') or outside the U.S. Don\'t mix embedded and copied uses in one case.', why: 'Embed' });
    }
    if (c.use === 'social') out.push({ lvl: 'info', text: 'Don\'t take screenshots of social media shares. If this is a share of the client\'s own post, remove it.', why: 'Social post' });
    if (pf && pf.agency) out.push({ lvl: 'info', text: 'The credit line names an agency (' + pf.agency + '). Only treat that as proper credit for agency clients.', why: 'Credit line' });
    const order = { stop: 0, warn: 1, info: 2 };
    return out.sort((a, b) => order[a.lvl] - order[b.lvl]);
  }
  const LVL = { stop: ['Stop', 'bad'], warn: ['Warn', 'warn'], info: ['Info', 'grey'] };

  // ---------------------------------------------------------------- reading their page
  const AGENCY = /\b(getty images|getty|associated press|ap photo|reuters|afp|shutterstock|alamy|splash news|splash|mega agency|backgrid|imagn|zuma press|zuma|wireimage|filmmagic|bauer-griffin|epa|sipa|bloomberg|polaris|rex features)\b/i;
  const ADS = [
    [/googlesyndication|adsbygoogle|doubleclick|googletagservices|adservice\.google/, 'Google ads'], [/amazon-adsystem/, 'Amazon ads'], [/taboola/, 'Taboola'],
    [/outbrain/, 'Outbrain'], [/mediavine/, 'Mediavine'], [/adthrive|raptive/, 'Raptive'], [/ezoic/, 'Ezoic'], [/criteo/, 'Criteo'], [/pubmatic/, 'PubMatic'],
    [/rubiconproject|magnite/, 'Magnite'], [/adnxs/, 'Xandr'], [/revcontent/, 'Revcontent'], [/mgid\.com/, 'MGID'], [/sharethrough/, 'Sharethrough'], [/media\.net/, 'Media.net'],
  ];
  const CREDIT = /(?:^|\b)(photo|photograph|image|picture|credit|courtesy|copyright)\b\s*(?:by|:|\/|-|–)?\s*\S|©|\(c\)\s*\S/i;
  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
  // The file name part of a picture address, without size endings like -1024x768 or @2x.
  const fileKey = u => {
    let s = ''; try { s = new URL(u).pathname; } catch (e) { s = String(u || '').split('?')[0]; }
    s = decodeURIComponent(s.split('/').pop() || '').toLowerCase().replace(/\.(jpe?g|png|webp|gif|avif)$/, '').replace(/[-_](\d{2,4}x\d{2,4}|scaled|large|medium|small|thumb)$/g, '').replace(/@\dx$/, '');
    return s.length >= 5 ? s : '';
  };
  function findImg(doc, want) {
    if (!want) return null;
    for (const el of doc.querySelectorAll('img, source')) {
      const all = [el.getAttribute('src'), el.getAttribute('srcset'), el.getAttribute('data-src'), el.getAttribute('data-srcset'), el.getAttribute('data-lazy-src'), el.getAttribute('data-original')].filter(Boolean).join(' ').toLowerCase();
      if (all.includes(want)) return el.tagName === 'SOURCE' ? (el.closest('picture') && el.closest('picture').querySelector('img')) || el : el;
    }
    return null;
  }
  // The credit or caption line next to the picture: its <figcaption>, or a nearby element called
  // caption / credit, or a line that starts "Photo:" / "Credit:" / "©" close to it.
  function creditNear(el) {
    if (!el) return '';
    const fig = el.closest('figure');
    const cands = [];
    if (fig) cands.push(...fig.querySelectorAll('figcaption, [class*="credit" i], [class*="caption" i]'));
    let up = el.parentElement;
    for (let i = 0; up && i < 4; i++, up = up.parentElement) cands.push(...up.querySelectorAll('[class*="credit" i], [class*="caption" i], [class*="byline" i], small, cite'));
    let best = '';
    for (const c of cands) {
      const t = clean(c.textContent);
      if (!t || t.length > 300) continue;
      if (CREDIT.test(t)) return t.slice(0, 200);
      if (!best && /figcaption/i.test(c.tagName)) best = t.slice(0, 200);
    }
    return best;
  }
  async function readPage(c) {
    const at = new Date().toISOString();
    if (!/^https?:/i.test(c.url || '')) return { at, ok: false, why: 'No web address' };
    let html = '', final = c.url;
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
      const r = await fetch(c.url, { credentials: 'omit', redirect: 'follow', signal: ctl.signal });
      clearTimeout(t);
      if (!r.ok) return { at, ok: false, why: 'The page answered ' + r.status };
      if (!/html/i.test(r.headers.get('content-type') || 'html')) return { at, ok: false, why: 'Not a web page' };
      html = (await r.text()).slice(0, 3e6); final = r.url || c.url;
    } catch (e) { return { at, ok: false, why: 'The page did not answer' }; }
    const doc = new DOMParser().parseFromString(html.replace(/\son([a-z]+\s*=)/gi, ' data-pp-on$1'), 'text/html');
    const meta = n => { const m = doc.querySelector(`meta[property="${n}"], meta[name="${n}"]`); return m ? clean(m.getAttribute('content')) : ''; };
    const want = fileKey(c.img);
    const el = findImg(doc, want);
    const og = meta('og:image');
    const imgFound = !!el || (!!want && og.toLowerCase().includes(want));
    let credit = creditNear(el);
    // Selling: the page's own product data, a price tag, or an "Add to cart" button.
    let product = /product/i.test(meta('og:type')) || !!doc.querySelector('[itemtype*="schema.org/Product" i], [itemprop="price"], meta[property^="product:price"]');
    let price = meta('product:price:amount') ? (meta('product:price:currency') === 'USD' || !meta('product:price:currency') ? '$' : meta('product:price:currency') + ' ') + meta('product:price:amount') : '';
    for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const walk = o => {
          if (!o || typeof o !== 'object') return;
          if (Array.isArray(o)) return o.forEach(walk);
          const ty = [].concat(o['@type'] || []).join(' ');
          if (/\bProduct\b/.test(ty)) product = true;
          if (/\bOffer\b/.test(ty) && o.price != null && !price) price = (o.priceCurrency === 'USD' || !o.priceCurrency ? '$' : o.priceCurrency + ' ') + o.price;
          if (/(ImageObject|Photograph)/.test(ty) && !credit) { const cr = o.creditText || o.copyrightNotice || (o.author && (o.author.name || o.author)); if (typeof cr === 'string' && want && String(o.url || o.contentUrl || '').toLowerCase().includes(want)) credit = clean(cr).slice(0, 200); }
          for (const k of ['offers', '@graph', 'mainEntity', 'image']) if (o[k]) walk(o[k]);
        };
        walk(JSON.parse(s.textContent));
      } catch (e) { /* not readable */ }
    }
    if (!price) { const p = doc.querySelector('[itemprop="price"]'); if (p) price = clean(p.getAttribute('content') || p.textContent).slice(0, 20); }
    const cart = [...doc.querySelectorAll('button, a, input[type="submit"]')].some(b => /\b(add to (cart|bag|basket)|buy (it )?now|order now|shop now)\b/i.test(b.textContent || b.getAttribute('value') || ''));
    // Ads: ad networks named in the page's scripts and frames.
    const srcs = [...doc.querySelectorAll('script[src], iframe[src]')].map(x => x.getAttribute('src')).join(' ') + ' ' + (/adsbygoogle/.test(html) ? 'adsbygoogle' : '');
    const ads = ADS.filter(([re]) => re.test(srcs)).map(([, n]) => n);
    const yt = !!doc.querySelector('iframe[src*="youtube.com/embed" i], iframe[src*="youtube-nocookie.com/embed" i], iframe[data-src*="youtube.com/embed" i], lite-youtube');
    const embedPost = !!doc.querySelector('blockquote.instagram-media, blockquote.twitter-tweet, blockquote.tiktok-embed, iframe[src*="instagram.com/p/" i], iframe[src*="facebook.com/plugins" i], iframe[src*="platform.twitter.com" i]');
    const am = AGENCY.exec(credit || '');
    // 4.9: who posted it (for social posts), and whose posts a website shows embedded.
    const soc = socTags(doc, html, final);
    const embeds = embedAccounts(doc);
    return {
      soc, embeds,
      at, ok: true, url: final, imgFound, credit, agency: am ? am[1].replace(/\b\w/g, x => x.toUpperCase()) : '',
      sells: { product, cart, price: price ? String(price).slice(0, 24) : '' }, ads, yt, embedPost,
      // 4.30: the page's own main picture (a post's photo or video cover), so a social match
      // can be checked against what the post really shows.
      type: meta('og:type'),
      pic: (() => { const v = meta('og:image') || meta('twitter:image'); try { return v ? new URL(v, final).href : ''; } catch (e) { return ''; } })(),
      // 4.35: the post only shares another site's article (a link preview card), and which site.
      card: linkCard(doc, html, final, meta('og:image') || meta('twitter:image')),
      siteName: meta('og:site_name'), title: clean(meta('og:title') || (doc.querySelector('title') || {}).textContent || '').slice(0, 160),
    };
  }
  // 4.35 (Ben): a social post that shares an article shows a link preview card (the article's
  // title, picture and site). Its picture is the article's, not one the account posted. Returns
  // { site, pic, only } or null: only = the post has no picture of its own besides the card.
  function linkCard(doc, html, url, ogPic) {
    let host = ''; try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return null; }
    if (!/(^|\.)(linkedin\.com|x\.com|twitter\.com|facebook\.com|threads\.net|threads\.com|bsky\.app)$/.test(host)) return null;
    const isCard = typeof PP_SOCIAL !== 'undefined' && PP_SOCIAL.cardPic ? PP_SOCIAL.cardPic : () => '';
    const own = /feedshare-|\/media\/[A-Za-z0-9_-]+\.(?:jpg|png)|pbs\.twimg\.com\/media\//i;
    let site = '';
    // LinkedIn's public post page: the shared article's link goes through linkedin.com/redir/redirect?url=… or lnkd.in.
    const a = [...doc.querySelectorAll('a[href]')].find(x => /article|card|share-link|external/i.test((x.getAttribute('data-tracking-control-name') || '') + ' ' + (x.className || '')) && /redir\/redirect|lnkd\.in|l\.facebook\.com|t\.co\//.test(x.getAttribute('href') || ''));
    if (a) { try { const u = new URL(a.getAttribute('href'), url); site = (u.searchParams.get('url') || u.searchParams.get('u') || ''); site = site ? new URL(site).hostname.replace(/^www\./, '') : ''; } catch (e) { /* no site */ } }
    const cardImg = isCard(ogPic) ? ogPic : (String(html).match(/https:\/\/media\.licdn\.com\/dms\/image\/[^"'\s<>]*articleshare-[^"'\s<>]*/i) || String(html).match(/https:\/\/pbs\.twimg\.com\/card_img\/[^"'\s<>]*/i) || [''])[0].replace(/&amp;/g, '&');
    if (!cardImg && !a) return null;
    if (!site) { const t = doc.querySelector('meta[property="og:description"]'); const m = /\b([a-z0-9-]+\.(?:com|net|org|co\.uk|news))\b/i.exec((t && t.getAttribute('content')) || ''); if (m && !/linkedin|lnkd|twitter|facebook/i.test(m[1])) site = m[1].toLowerCase(); }
    return { site, pic: cardImg, only: !!cardImg && !own.test(String(html)) };
  }
  // The tags a social post page carries about itself (who posted it, caption, date).
  function socTags(doc, html, url) {
    const meta = n => { const m = doc.querySelector(`meta[property="${n}"], meta[name="${n}"]`); return m ? clean(m.getAttribute('content')) : ''; };
    const link = r => { const l = doc.querySelector(`link[rel="${r}"]`); return l ? l.getAttribute('href') || '' : ''; };
    const abs = u => { try { return u ? new URL(u, url).href : ''; } catch (e) { return ''; } };
    let authorUrl = abs(link('author')) || (/^https?:/.test(meta('article:author')) ? meta('article:author') : ''), published = meta('article:published_time') || meta('og:video:release_date') || '';
    const ld = [];
    for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const walk = o => {
          if (!o || typeof o !== 'object') return;
          if (Array.isArray(o)) return o.forEach(walk);
          ld.push([].concat(o['@type'] || []).join(' '));
          if (/(SocialMediaPosting|VideoObject|ImageObject|Article|BlogPosting|DiscussionForumPosting)/.test(ld[ld.length - 1])) {
            const a = [].concat(o.author || o.creator || [])[0];
            if (a && typeof a === 'object' && !authorUrl) authorUrl = abs(a.url || a['@id'] || '');
            if (!published) published = o.datePublished || o.uploadDate || o.dateCreated || '';
          }
          for (const k of ['@graph', 'mainEntity', 'mainEntityOfPage']) if (o[k] && typeof o[k] === 'object') walk(o[k]);
        };
        walk(JSON.parse(s.textContent));
      } catch (e) { /* not readable */ }
    }
    const um = /"owner":\{[^{}]{0,200}?"username":"([A-Za-z0-9._]{1,30})"/.exec(html) || /"username":"([A-Za-z0-9._]{1,30})"/.exec(html);
    return { ogUrl: abs(meta('og:url')), canonical: abs(link('canonical')), authorUrl, ogType: meta('og:type'), title: meta('og:title'), desc: meta('og:description') || meta('description'),
      published: published && !isNaN(Date.parse(published)) ? new Date(published).toISOString() : '', ld: ld.join(' ').slice(0, 300), generator: meta('generator'), user: um ? um[1] : '' };
  }
  // Embedded Instagram, X, TikTok, Threads or Facebook posts on a website, and who posted each.
  function embedAccounts(doc) {
    const out = [], seen = new Set();
    const add = (u, text) => {
      if (typeof PP_SOCIAL === 'undefined' || !u) return;
      let a = PP_SOCIAL.fromUrl(u);
      // Instagram's embed code says "A post shared by Name (@handle)".
      const m = !a && /\(@([A-Za-z0-9._]{1,30})\)/.exec(text || '');
      if (!a && m && /instagram\.com/.test(u)) a = { key: ('instagram.com/' + m[1]).toLowerCase(), handle: '@' + m[1], url: 'https://www.instagram.com/' + m[1] + '/', plat: 'instagram.com', kind: 'account' };
      if (a && !seen.has(a.key)) { seen.add(a.key); out.push({ ...a, post: u.slice(0, 300) }); }
    };
    for (const b of doc.querySelectorAll('blockquote.instagram-media, blockquote.text-post-media')) add(b.getAttribute('data-instgrm-permalink') || b.getAttribute('data-text-post-permalink') || (b.querySelector('a[href]') || {}).href, b.textContent);
    for (const b of doc.querySelectorAll('blockquote.twitter-tweet')) { const ls = [...b.querySelectorAll('a[href*="/status/"]')]; add(ls.length ? ls[ls.length - 1].getAttribute('href') : '', b.textContent); }
    for (const b of doc.querySelectorAll('blockquote.tiktok-embed')) add(b.getAttribute('cite'), b.textContent);
    for (const f of doc.querySelectorAll('iframe[src*="facebook.com/plugins/post" i], iframe[src*="facebook.com/plugins/video" i]')) { try { add(new URL(f.getAttribute('src'), 'https://x/').searchParams.get('href'), ''); } catch (e) { /* skip */ } }
    for (const f of doc.querySelectorAll('iframe[src*="instagram.com/p/" i], iframe[src*="instagram.com/reel/" i]')) add(f.getAttribute('src'), '');
    return out.slice(0, 6);
  }
  // "Signs it was on purpose": things on their page that show they make money from it.
  function onPurpose(pf) {
    if (!pf || !pf.ok) return [];
    const out = [];
    if (pf.sells.product || pf.sells.cart || pf.sells.price) out.push('Selling something' + (pf.sells.price ? ': price ' + pf.sells.price : '') + (pf.sells.cart ? (pf.sells.price ? ' and' : ':') + ' an "Add to cart" or "Buy" button' : pf.sells.product && !pf.sells.price ? ': the page is a product listing' : ''));
    if (pf.ads.length) out.push('Ads on the page (' + pf.ads.join(', ') + ')');
    return out;
  }

  // ---------------------------------------------------------------- dates and damages
  // The firm names files Month.Day.Year_Subject_Lastname (6.26.21_Concert_Smith.jpg).
  // Older folders hold a day folder named the same way, so the folder name is the second try.
  function dateIn(s) {
    s = String(s || '');
    let m = /(?:^|[^\d])(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})(?=$|[^\d])/.exec(s);
    if (m) {
      const mo = +m[1], d = +m[2], y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 1990) { const dt = new Date(y, mo - 1, d); if (dt.getMonth() === mo - 1 && dt <= new Date(Date.now() + DAY)) return dt; }
    }
    m = /((?:19|20)\d{2})-(\d{2})-(\d{2})/.exec(s);
    if (m) { const dt = new Date(+m[1], +m[2] - 1, +m[3]); if (dt.getMonth() === +m[2] - 1) return dt; }
    return null;
  }
  function pubDate(p) {
    if (!p) return null;
    const d = dateIn(p.name);
    if (d) return { date: d, from: 'the file name' };
    const last = String(p.folder || '').split('/').pop();
    const d2 = dateIn(last);
    return d2 ? { date: d2, from: 'the folder name ' + last } : null;
  }
  const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
  const fmt = d => d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  // lvl: ok · warn · bad · '' (not enough to say)
  function damages(pub, reg, now = new Date()) {
    if (!pub) return { lvl: '', title: 'Publish date not known', text: 'Files named Month.Day.Year_Subject_Lastname (like 6.26.21_Concert_Smith.jpg) show the dates here.' };
    const end = addMonths(pub.date, 3);
    if (!reg || !(reg.va || reg.app)) {
      if (now <= end) return { lvl: 'warn', title: 'Register by ' + fmt(end), end, text: 'No registration number found yet. Filing within 3 months of publishing keeps statutory damages.' };
      return { lvl: 'bad', title: 'Likely actual damages only', end, text: 'No registration number found, and the 3-month window closed on ' + fmt(end) + '.' };
    }
    return { lvl: 'ok', title: 'Statutory, if filed in time', end, text: (reg.va ? 'Registered (' + reg.va + ')' : 'Applied (' + reg.app + ')') + '. Statutory damages apply if it was filed by ' + fmt(end) + ', or before their copy went up. Check the date on the certificate.' };
  }

  // ---------------------------------------------------------------- Ready for legal?
  const bare = u => String(u || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/[#?].*$/, '').replace(/\/+$/, '').toLowerCase();
  // The newest saved capture of this page, from the capture log.
  function captureOf(log, url) {
    const b = bare(url);
    let best = null;
    for (const e of log || []) if (bare(e.url) === b && e.saves && e.saves.length) { const at = e.saves[e.saves.length - 1].at; if (!best || at > best) best = at; }
    return best;
  }
  // [ok, label, action?] for each step. ok: true · false · null (can't tell yet)
  function legal({ c, reg, pub, kind, hits, pf, capturedAt }) {
    const yt = pf && pf.ok && pf.yt && !pf.imgFound;
    const before = pub && c.firstSeen ? pub.date.getTime() <= Date.parse(c.firstSeen) + DAY : null;
    return [
      [!!capturedAt, capturedAt ? 'Page captured (' + fmt(new Date(capturedAt)) + ')' : 'Page not captured yet', capturedAt ? '' : 'capture'],
      [!!(reg && (reg.va || reg.app)), reg && (reg.va || reg.app) ? 'Registration number found (' + (reg.va || reg.app) + ')' : 'No registration number found', ''],
      [kind ? !hits.some(h => h.lvl === 'stop') : false, !kind ? 'Kind of site not picked yet' : hits.some(h => h.lvl === 'stop') ? 'A firm rule says stop' : 'Firm rules checked', kind ? '' : 'kind'],
      [pf && pf.ok ? !yt : null, !pf ? 'Their page not read yet' : !pf.ok ? 'Their page could not be read (' + pf.why + ')' : yt ? 'Looks like a YouTube embed' : 'Not a YouTube embed', !pf || !pf.ok ? 'readpage' : ''],
      [before, before === null ? 'Publish date not known' : before ? 'Published before their copy was found' : 'Their copy was found BEFORE the publish date. Check the date.', ''],
    ];
  }

  // ---------------------------------------------------------------- POOL photos (shared with other papers)
  const short = d => (d.getMonth() + 1) + '.' + d.getDate() + '.' + String(d.getFullYear()).slice(2);
  const POOL = /(^|[_\s.-])POOL([_\s.-]|$)/;
  const isPool = name => POOL.test(String(name || ''));

  return { KINDS, KIND_NAME, LVL, guessKind, rules, readPage, onPurpose, pubDate, dateIn, damages, legal, captureOf, isPool, fmt, short, fileKey, creditNear, AGENCY };
})();
if (typeof module !== 'undefined') module.exports = PP_CHECKS;
