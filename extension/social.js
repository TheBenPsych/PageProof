// Social media sites and the accounts on them (4.9).
//  - Which sites are social: a built-in list, plus sites you marked yourself, plus new ones
//    caught by how their links and pages look (PageProof asks you once about each).
//  - Who posted a copy: read from the link itself, from a short link's real address, from the
//    site's public "who posted this" service (oEmbed), from the post page's own tags, from the
//    post opened in your own signed-in browser, or typed by you.
// Loaded by every PageProof page and by the background worker (before fc-store.js).
const PP_SOCIAL = (() => {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  // site -> [name, short label, colour]. A site covers its sub-sites (m.facebook.com).
  // 4.25.0: Ben's fixed list. ONLY these platforms count as social media (16: Reddit was taken
  // out because it is a forum, and Ben never pursues forums; its links are dropped entirely).
  // Every other site (Naver Blog, note, Twitch, Quora, Medium, Flickr, chat apps...) is a normal website.
  const SITES = {
    'youtube.com': ['YouTube', 'YT', '#C22222'], 'youtu.be': ['YouTube', 'YT', '#C22222'], 'youtube-nocookie.com': ['YouTube', 'YT', '#C22222'],
    'facebook.com': ['Facebook', 'FB', '#2F5BD1'], 'fb.com': ['Facebook', 'FB', '#2F5BD1'], 'fb.watch': ['Facebook', 'FB', '#2F5BD1'], 'fb.me': ['Facebook', 'FB', '#2F5BD1'], 'fb.gg': ['Facebook', 'FB', '#2F5BD1'],
    'instagram.com': ['Instagram', 'IG', '#B0367C'], 'instagr.am': ['Instagram', 'IG', '#B0367C'],
    'tiktok.com': ['TikTok', 'TT', '#1F2430'],
    'x.com': ['X', 'X', '#3B3F4A'], 'twitter.com': ['X', 'X', '#3B3F4A'], 't.co': ['X', 'X', '#3B3F4A'],
    'linkedin.com': ['LinkedIn', 'IN', '#0A66C2'], 'lnkd.in': ['LinkedIn', 'IN', '#0A66C2'],
    'pinterest.com': ['Pinterest', 'PI', '#B8243A'], 'pin.it': ['Pinterest', 'PI', '#B8243A'],
    'threads.net': ['Threads', 'TH', '#3B3F4A'], 'threads.com': ['Threads', 'TH', '#3B3F4A'],
    'snapchat.com': ['Snapchat', 'SC', '#8A7A00'],
    'tumblr.com': ['Tumblr', 'TU', '#34465D'],
    'bsky.app': ['Bluesky', 'BS', '#1866C9'], 'bsky.social': ['Bluesky', 'BS', '#1866C9'],
    'substack.com': ['Substack', 'SS', '#C76A00'],
    'nextdoor.com': ['Nextdoor', 'ND', '#2E7D3F'],
    'truthsocial.com': ['Truth Social', 'TS', '#3F4FA8'],
    'vimeo.com': ['Vimeo', 'VI', '#1A7FB0'],
    'behance.net': ['Behance', 'BE', '#1F4FCF'],
  };
  // Pinterest and others have one site per country (pinterest.co.uk, pinterest.de).
  const SITE_RX = [[/(^|\.)pinterest\.(com?\.)?[a-z]{2,3}$/, 'pinterest.com'], [/(^|\.)nextdoor\.(com?\.)?[a-z]{2,3}$/, 'nextdoor.com'], [/(^|\.)tumblr\.com$/, 'tumblr.com'], [/(^|\.)substack\.com$/, 'substack.com']];
  const host = u => { try { return new URL(u).hostname.toLowerCase().replace(/^(www\d?|m|mobile|mbasic|web|touch|old|new|np|vm|vt)\./, ''); } catch (e) { return ''; } };
  // Your own choices: site -> 'social' or 'web'. Kept in storage, read once and kept fresh.
  let mine = {};
  const ready = (async () => { try { mine = (await api.storage.local.get('ppSocialSites')).ppSocialSites || {}; } catch (e) { /* none */ } })();
  try { api.storage.onChanged.addListener(ch => { if (ch.ppSocialSites) mine = ch.ppSocialSites.newValue || {}; }); } catch (e) { /* no storage here */ }

  // The listed site a host belongs to ('m.facebook.com' -> 'facebook.com'), or ''.
  function listed(site) {
    site = String(site || '').toLowerCase().replace(/^(www\d?|m|mobile|mbasic|web|touch|old|new|np|vm|vt)\./, '');
    const labels = site.split('.');
    for (let i = 0; i < labels.length - 1; i++) { const d = labels.slice(i).join('.'); if (SITES[d]) return d; }
    for (const [rx, d] of SITE_RX) if (rx.test(site)) return d;
    return '';
  }
  const mineFor = site => { const labels = String(site || '').toLowerCase().split('.'); for (let i = 0; i < labels.length - 1; i++) { const d = labels.slice(i).join('.'); if (mine[d]) return mine[d]; } return ''; };
  // Is this site social? 4.25.0: only the fixed list decides (old "mark as social" choices no longer count).
  function isSocial(site) { return !!listed(site); }
  // The platform of a site, for the little badge: { key, name, short, color }.
  function platform(site) {
    const d = listed(site);
    if (d) { const [name, short, color] = SITES[d]; return { key: name.toLowerCase().replace(/\W+/g, ''), name, short, color, site: d }; }
    const s = String(site || '').toLowerCase().replace(/^www\./, '');
    return { key: s, name: s, short: (s.replace(/[^a-z0-9]/g, '').slice(0, 2) || '?').toUpperCase(), color: '#6B7280', site: s };
  }

  // ------------------------------------------------------------ the account, from a link
  const NOT_USER = /^(p|reel|reels|tv|stories|explore|accounts|direct|about|legal|developer|privacy|help|share|sharer|watch|shorts|video|videos|photo|photos|photo\.php|media|permalink\.php|story\.php|groups|events|pages|hashtag|search|i|home|intent|settings|login|signup|notifications|messages|status|statuses|pin|pins|ideas|today|t|s|r|u|user|users|c|channel|channels|playlist|results|feed|discover|tag|tags|topics|trending|live|music|en|amp|embed|plugins|dialog|tr|web|m|me|posts|post|post\.php)$/i;
  const okName = s => !!s && s.length <= 60 && !NOT_USER.test(s) && !/\.(php|html?|aspx?)$/i.test(s);
  // key: "site/handle", lower case, no "?" (the same shape a hidden-sites line has).
  // path: the part of the account's own link after the site (so hiding it also hides links that show it).
  const mk = (plat, handle, url, kind, path) => handle ? { key: (plat + '/' + (path || handle)).toLowerCase(), handle, url, kind: kind || 'account', plat } : null;
  // What kind of post a link is ("post", "reel", "video", ...), for the row.
  function postKind(url) {
    const p = (() => { try { return new URL(url).pathname.toLowerCase(); } catch (e) { return ''; } })();
    if (/\/(reel|reels)\//.test(p)) return 'reel';
    if (/\/stories?\//.test(p) || /story\.php/.test(p)) return 'story';
    if (/\/(shorts)\//.test(p)) return 'short';
    if (/\/(video|videos|watch|tv)\b/.test(p) || /youtu\.be/.test(url)) return 'video';
    if (/\/(pin)\//.test(p)) return 'pin';
    if (/\/(photo|photos)\b|photo\.php/.test(p)) return 'photo';
    if (/\/comments\//.test(p)) return 'post';
    return 'post';
  }
  // The account in a link, when the link shows it. Returns { key, handle, url, kind, plat } or null.
  // key looks like "instagram.com/harborlight.daily": the same shape the hidden-sites list uses.
  function fromUrl(url) {
    let u; try { u = new URL(url); } catch (e) { return null; }
    const h = host(url), d = listed(h) || h;
    const seg = u.pathname.split('/').filter(Boolean).map(s => { try { return decodeURIComponent(s); } catch (e) { return s; } });
    const q = k => u.searchParams.get(k) || '';
    const at = seg.find(s => /^@[\w.\-]{1,60}$/.test(s));
    switch (d) {
      case 'instagram.com': case 'instagr.am':
        if (seg[0] === 'stories' && okName(seg[1])) return mk('instagram.com', '@' + seg[1], 'https://www.instagram.com/' + seg[1] + '/', '', seg[1]);
        if (okName(seg[0]) && /^[\w.]{1,30}$/.test(seg[0])) return mk('instagram.com', '@' + seg[0], 'https://www.instagram.com/' + seg[0] + '/', '', seg[0]);
        return null;
      case 'threads.net': case 'threads.com':
        return at ? mk('threads.net', at, 'https://www.threads.net/' + at) : null;
      case 'tiktok.com': case 'douyin.com':
        return at ? mk(d, at, 'https://www.' + d + '/' + at) : null;
      case 'x.com': case 'twitter.com':
        if (seg[0] === 'i' || !okName(seg[0]) || !/^\w{1,15}$/.test(seg[0])) return null;
        return mk('x.com', '@' + seg[0], 'https://x.com/' + seg[0], '', seg[0]);
      case 'facebook.com': case 'fb.com': {
        const id = q('id');
        if (/^(permalink|story)\.php$/.test(seg[0] || '') && /^\d+$/.test(id)) return mk('facebook.com', 'profile ' + id, 'https://www.facebook.com/profile.php?id=' + id, '', 'id.' + id);
        if (seg[0] === 'profile.php' && /^\d+$/.test(id)) return mk('facebook.com', 'profile ' + id, 'https://www.facebook.com/profile.php?id=' + id, '', 'id.' + id);
        if (seg[0] === 'people' && seg[2]) return mk('facebook.com', 'people/' + seg[1] + '/' + seg[2], 'https://www.facebook.com/people/' + seg[1] + '/' + seg[2] + '/');
        if (seg[0] === 'groups' && seg[1]) return mk('facebook.com', 'groups/' + seg[1], 'https://www.facebook.com/groups/' + seg[1] + '/', 'group');
        if (seg[0] === 'pg' && okName(seg[1])) return mk('facebook.com', seg[1], 'https://www.facebook.com/' + seg[1]);
        if (okName(seg[0]) && /^[\w.\-]{2,80}$/.test(seg[0])) return mk('facebook.com', seg[0], 'https://www.facebook.com/' + seg[0]);
        return null;
      }
      case 'youtube.com':
        if (at) return mk('youtube.com', at, 'https://www.youtube.com/' + at);
        if ((seg[0] === 'channel' || seg[0] === 'c' || seg[0] === 'user') && seg[1]) return mk('youtube.com', seg[0] + '/' + seg[1], 'https://www.youtube.com/' + seg[0] + '/' + seg[1]);
        return null;
      case 'pinterest.com':
        if (seg[0] === 'pin' || !okName(seg[0]) || !/^[\w]{3,30}$/.test(seg[0])) return null;
        return mk('pinterest.com', '@' + seg[0], 'https://www.pinterest.com/' + seg[0] + '/', '', seg[0]);
        return null;
      case 'tumblr.com': {
        const sub = h.endsWith('.tumblr.com') ? h.slice(0, -'.tumblr.com'.length) : '';
        if (sub && sub !== 'www') return mk('tumblr.com', sub, 'https://' + sub + '.tumblr.com/');
        if (okName(seg[0]) && seg[0] !== 'blog') return mk('tumblr.com', seg[0], 'https://www.tumblr.com/' + seg[0]);
        if (seg[0] === 'blog' && seg[1] && seg[1] !== 'view') return mk('tumblr.com', seg[1], 'https://www.tumblr.com/' + seg[1]);
        if (seg[0] === 'blog' && seg[1] === 'view' && seg[2]) return mk('tumblr.com', seg[2], 'https://www.tumblr.com/' + seg[2]);
        return null;
      }
      case 'linkedin.com':
        if ((seg[0] === 'in' || seg[0] === 'company') && seg[1]) return mk('linkedin.com', seg[0] + '/' + seg[1], 'https://www.linkedin.com/' + seg[0] + '/' + seg[1] + '/');
        if (seg[0] === 'posts' && seg[1] && seg[1].includes('_')) { const n = seg[1].split('_')[0]; return mk('linkedin.com', 'in/' + n, 'https://www.linkedin.com/in/' + n + '/'); }
        return null;
      case 'bsky.app':
        return seg[0] === 'profile' && seg[1] ? mk('bsky.app', '@' + seg[1].replace(/^@/, ''), 'https://bsky.app/profile/' + seg[1], '', 'profile/' + seg[1]) : null;
      case 'vk.com': case 'vk.ru': {
        const w = /^wall(-?\d+)_\d+$/.exec(seg[0] || '') || /^(?:photo)(-?\d+)_\d+$/.exec(seg[0] || '');
        if (w) { const n = w[1]; const id = n.startsWith('-') ? 'club' + n.slice(1) : 'id' + n; return mk('vk.com', id, 'https://vk.com/' + id); }
        return okName(seg[0]) && /^[\w.]{2,40}$/.test(seg[0]) ? mk('vk.com', seg[0], 'https://vk.com/' + seg[0]) : null;
      }
      case 'ok.ru':
        if ((seg[0] === 'profile' || seg[0] === 'group') && seg[1]) return mk('ok.ru', seg[0] + '/' + seg[1], 'https://ok.ru/' + seg[0] + '/' + seg[1]);
        return null;
      case 'weibo.com': case 'weibo.cn':
        if (seg[0] === 'u' && seg[1]) return mk('weibo.com', 'u/' + seg[1], 'https://weibo.com/u/' + seg[1]);
        return /^\d{5,}$/.test(seg[0] || '') ? mk('weibo.com', 'u/' + seg[0], 'https://weibo.com/u/' + seg[0]) : null;
      case 'xiaohongshu.com':
        return seg[0] === 'user' && seg[1] === 'profile' && seg[2] ? mk('xiaohongshu.com', seg[2], 'https://www.xiaohongshu.com/user/profile/' + seg[2]) : null;
      case 'bilibili.com':
        return h.startsWith('space.') && seg[0] ? mk('bilibili.com', 'space/' + seg[0], 'https://space.bilibili.com/' + seg[0]) : null;
      case 'flickr.com':
        return (seg[0] === 'photos' || seg[0] === 'people') && seg[1] && seg[1] !== 'tags' ? mk('flickr.com', seg[1], 'https://www.flickr.com/photos/' + seg[1] + '/') : null;
      case 't.me': case 'telegram.me':
        return okName(seg[0]) && seg[0] !== 's' ? mk('t.me', seg[0], 'https://t.me/' + seg[0], 'channel') : (seg[0] === 's' && seg[1] ? mk('t.me', seg[1], 'https://t.me/' + seg[1], 'channel') : null);
      case 'snapchat.com':
        return (seg[0] === 'add' || seg[0] === '@') && seg[1] ? mk('snapchat.com', seg[1], 'https://www.snapchat.com/add/' + seg[1]) : (at ? mk('snapchat.com', at.slice(1), 'https://www.snapchat.com/add/' + at.slice(1)) : null);
      case 'deviantart.com': {
        const sub = h.endsWith('.deviantart.com') ? h.slice(0, -'.deviantart.com'.length) : '';
        if (sub && sub !== 'www') return mk('deviantart.com', sub, 'https://www.deviantart.com/' + sub);
        return okName(seg[0]) ? mk('deviantart.com', seg[0], 'https://www.deviantart.com/' + seg[0]) : null;
      }
      case 'vimeo.com': case 'dailymotion.com': case 'twitch.tv': case 'rumble.com': case 'imgur.com': case '9gag.com': case 'youtu.be': case 'redd.it': case 'pin.it': case 't.co': case 'fb.watch': case 'fb.me': case 'flic.kr': case 'lnkd.in':
        if (d === 'vimeo.com' && okName(seg[0]) && !/^\d+$/.test(seg[0]) && !/^(channels|groups|showcase|album|ondemand|categories|blog|features|upload|manage|log_in|join)$/i.test(seg[0])) return mk('vimeo.com', seg[0], 'https://vimeo.com/' + seg[0]);
        if (d === 'twitch.tv' && okName(seg[0])) return mk('twitch.tv', seg[0], 'https://www.twitch.tv/' + seg[0]);
        if (d === 'dailymotion.com' && okName(seg[0]) && seg[0] !== 'video') return mk('dailymotion.com', seg[0], 'https://www.dailymotion.com/' + seg[0]);
        if (d === 'imgur.com' && seg[0] === 'user' && seg[1]) return mk('imgur.com', seg[1], 'https://imgur.com/user/' + seg[1]);
        if (d === 'rumble.com' && (seg[0] === 'c' || seg[0] === 'user') && seg[1]) return mk('rumble.com', seg[0] + '/' + seg[1], 'https://rumble.com/' + seg[0] + '/' + seg[1]);
        return null;
      case 'behance.net':
        return okName(seg[0]) && !/^(gallery|search|galleries|joblist|hire|assets|onboarding|for_you|live|moodboard|collection)$/i.test(seg[0]) ? mk('behance.net', seg[0], 'https://www.behance.net/' + seg[0]) : null;
      case 'substack.com': {
        const sub = h.endsWith('.substack.com') ? h.slice(0, -'.substack.com'.length) : '';
        if (sub && !/^(www|open|on|support|cdn)$/.test(sub)) return mk('substack.com', sub, 'https://' + sub + '.substack.com/');
        return at ? mk('substack.com', at, 'https://substack.com/' + at) : null;
      }
      default: {
        // Any other social site (on the list, marked by you, or caught by its link shape):
        // /@name/..., /u/name, /user/name, /users/name, /profile/name, or the first part of the link.
        if (at) return mk(d, at, u.origin + '/' + at);
        const i = seg.findIndex(s => /^(u|user|users|profile|people|author|channel|c)$/i.test(s));
        if (i >= 0 && seg[i + 1] && okName(seg[i + 1])) return mk(d, seg[i] + '/' + seg[i + 1], u.origin + '/' + seg[i] + '/' + seg[i + 1]);
        if (seg.length >= 2 && okName(seg[0]) && /^[\w.\-]{2,40}$/.test(seg[0]) && !/^\d+$/.test(seg[0])) return mk(d, seg[0], u.origin + '/' + seg[0]);
        return null;
      }
    }
  }
  // A typed "@name" or a profile link, for "Set account".
  function fromTyped(text, siteOfCopy) {
    let t = String(text || '').trim();
    if (!t) return null;
    if (/^@?[\w.\-]{1,60}$/.test(t)) {
      const d = listed(siteOfCopy) || siteOfCopy;
      const name = t.replace(/^@/, '');
      const shape = { 'tiktok.com': '@', 'threads.net': '@', 'youtube.com': '@', 'bsky.app': 'profile/@' }[d];
      t = 'https://' + d + '/' + (shape ? shape.replace('@', '') + '@' : d === 'reddit.com' ? 'user/' : '') + name;
    }
    if (!/^[a-z]+:\/\//i.test(t)) t = 'https://' + t;
    return fromUrl(t);
  }

  // ------------------------------------------------------------ short links and public post info
  const SHORT = /^(vm\.tiktok\.com|vt\.tiktok\.com|t\.co|fb\.me|fb\.watch|pin\.it|redd\.it|instagr\.am|lnkd\.in|flic\.kr|b23\.tv|xhslink\.com|bit\.ly|buff\.ly|ow\.ly|tinyurl\.com)$/;
  const isShort = url => { try { const u = new URL(url); const h = u.hostname.replace(/^www\./, ''); return SHORT.test(h) || (/tiktok\.com$/.test(h) && /^\/t\//.test(u.pathname)) || (/facebook\.com$/.test(h) && /^\/share\//.test(u.pathname)) || (/reddit\.com$/.test(h) && /\/s\/[\w]+/.test(u.pathname)); } catch (e) { return false; } };
  const OEMBED = {
    'tiktok.com': u => 'https://www.tiktok.com/oembed?url=' + encodeURIComponent(u),
    'youtube.com': u => 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(u),
    'youtu.be': u => 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(u),
    'x.com': u => 'https://publish.twitter.com/oembed?omit_script=1&url=' + encodeURIComponent(u.replace('//x.com/', '//twitter.com/')),
    'twitter.com': u => 'https://publish.twitter.com/oembed?omit_script=1&url=' + encodeURIComponent(u),
    'pinterest.com': u => 'https://www.pinterest.com/oembed.json?url=' + encodeURIComponent(u),
    'tumblr.com': u => 'https://www.tumblr.com/oembed/1.0?url=' + encodeURIComponent(u),
    'flickr.com': u => 'https://www.flickr.com/services/oembed/?format=json&url=' + encodeURIComponent(u),
    'vimeo.com': u => 'https://vimeo.com/api/oembed.json?url=' + encodeURIComponent(u),
    'dailymotion.com': u => 'https://www.dailymotion.com/services/oembed?url=' + encodeURIComponent(u),
    'bsky.app': u => 'https://embed.bsky.app/oembed?url=' + encodeURIComponent(u),
  };
  async function get(url, ms = 12000) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
    try { return await fetch(url, { credentials: 'omit', redirect: 'follow', signal: ctl.signal }); } finally { clearTimeout(t); }
  }
  // A short link's real address.
  async function unshort(url) {
    try { const r = await get(url); return r.url && r.url !== url ? r.url : ''; } catch (e) { return ''; }
  }
  const strip = html => String(html || '').replace(/<a [^>]*>(pic\.twitter\.com|https?:)[^<]*<\/a>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&mdash;.*$/s, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
  // The site's public "who posted this" answer. Works without signing in for TikTok, YouTube,
  // X, Reddit, Pinterest, Tumblr, Flickr, Vimeo, Dailymotion and Bluesky (not Instagram or
  // Facebook: theirs needs a business app key).
  async function publicInfo(url) {
    const d = listed(host(url));
    const make = OEMBED[d];
    if (!make) return null;
    try {
      const r = await get(make(url));
      if (!r.ok) return null;
      const j = await r.json();
      let acct = j.author_url ? fromUrl(j.author_url) : null;
      if (!acct && j.author_unique_id && d === 'tiktok.com') acct = mk('tiktok.com', '@' + j.author_unique_id, 'https://www.tiktok.com/@' + j.author_unique_id);
      if (!acct && j.author_name && d === 'reddit.com' && /^[\w-]{3,20}$/.test(j.author_name)) acct = mk('reddit.com', 'u/' + j.author_name, 'https://www.reddit.com/user/' + j.author_name + '/', '', 'user/' + j.author_name);
      if (acct && j.author_name) acct.name = String(j.author_name).slice(0, 80);
      const caption = d === 'x.com' || d === 'twitter.com' ? strip(j.html) : String(j.title || '').trim();
      return { acct, post: caption ? { caption: caption.slice(0, 400) } : null };
    } catch (e) { return null; }
  }
  // Numbers like "1,204" or "12.5K".
  const num = s => { const m = /^([\d.,]+)\s*([KkMm]?)$/.exec(String(s || '').trim()); if (!m) return null; let n = parseFloat(m[1].replace(/,/g, '')); if (/k/i.test(m[2])) n *= 1e3; if (/m/i.test(m[2])) n *= 1e6; return Math.round(n); };
  // The post page's own tags (read by PP_CHECKS.readPage, or in your browser): who posted it,
  // the caption, the date, likes and comments.
  function fromTags(t, url) {
    if (!t) return null;
    const d = listed(host(url)) || host(url);
    const tries = [[t.ogUrl, 'sure'], [t.canonical, 'sure'], [t.authorUrl, 'sure']];
    let acct = null, sure = '';
    for (const [u, s] of tries) { if (!u) continue; const a = fromUrl(u); if (a && (listed(host(u)) || host(u)) === d) { acct = a; sure = s; break; } }
    const desc = String(t.desc || ''), title = String(t.title || '');
    // Instagram: "1,204 likes, 38 comments - harborlight.daily on November 20, 2025: "caption""
    let m = /(?:^|- )([A-Za-z0-9._]{1,30}) on [A-Z][a-z]+ \d{1,2}, \d{4}/.exec(desc) || /\(@([A-Za-z0-9._]{1,30})\)/.exec(title) || /\(@([A-Za-z0-9._]{1,30})\)/.exec(desc);
    if (!acct && m && /instagram|threads/.test(d)) acct = d.startsWith('threads') ? mk('threads.net', '@' + m[1], 'https://www.threads.net/@' + m[1]) : mk('instagram.com', '@' + m[1], 'https://www.instagram.com/' + m[1] + '/', '', m[1]), sure = 'likely';
    if (!acct && t.user && /instagram|threads/.test(d)) acct = d.startsWith('threads') ? mk('threads.net', '@' + t.user, 'https://www.threads.net/@' + t.user) : mk('instagram.com', '@' + t.user, 'https://www.instagram.com/' + t.user + '/', '', t.user), sure = 'likely';
    if (!acct && Array.isArray(t.links) && t.links.length) {
      // The most common profile link on the post page (the poster's name sits above the post).
      const n = new Map();
      for (const l of t.links) { const a = fromUrl(l); if (a && (listed(host(l)) || host(l)) === d) { const e = n.get(a.key) || [a, 0]; e[1]++; n.set(a.key, e); } }
      const best = [...n.values()].sort((a, b) => b[1] - a[1])[0];
      if (best) { acct = best[0]; sure = 'likely'; }
    }
    if (acct) acct.sure = sure;
    const post = {};
    const lm = /([\d.,]+[KkMm]?) likes?, ([\d.,]+[KkMm]?) comments?/.exec(desc);
    if (lm) { post.likes = num(lm[1]); post.comments = num(lm[2]); }
    const cap = /: [“"](.+)[”"]\.?$/s.exec(desc) || /on Instagram: [“"](.+)[”"]$/s.exec(title);
    post.caption = (cap ? cap[1] : desc.replace(/^[\d.,]+[KkMm]? likes?, [\d.,]+[KkMm]? comments? - /, '')).trim().slice(0, 400);
    if (!post.caption) delete post.caption;
    if (t.published) post.date = t.published;
    else { const dm = / on ([A-Z][a-z]+ \d{1,2}, \d{4})/.exec(desc); if (dm && !isNaN(Date.parse(dm[1]))) post.date = new Date(dm[1]).toISOString(); }
    return { acct, post: Object.keys(post).length ? post : null };
  }

  // ------------------------------------------------------------ new social sites
  // Signs a site that isn't on the list is social: its links look like profiles or posts
  // (/@name/1234, /profile/name/post/..., /users/name/statuses/...), or its page says so.
  function shapeOf(url) {
    try {
      const p = new URL(url).pathname;
      if (/^\/@[\w.\-]{1,60}\/\d{6,}/.test(p)) return 'Its links look like posts on a profile (/@name/1234)';
      if (/^\/@[\w.\-]{1,60}\/(post|posts|video|status|statuses|photo|p)\b/i.test(p)) return 'Its links look like posts on a profile (/@name/post)';
      if (/^\/(profile|users)\/[\w.\-]+\/(post|statuses|status)\//i.test(p)) return 'Its links look like posts on a profile';
      if (/^\/notes\/[a-z0-9]{8,}$/i.test(p) && /misskey|calckey|firefish|sharkey/i.test(url)) return 'Its links look like social posts';
    } catch (e) { /* not a link */ }
    return '';
  }
  function pageSigns(t) {
    if (!t) return '';
    if (/mastodon|pleroma|akkoma|misskey|pixelfed|peertube|lemmy|friendica|gotosocial|firefish|sharkey|calckey/i.test(t.generator || '')) return 'The page is made with ' + String(t.generator).split(/[\s/]/)[0] + ', a social media program';
    if (/\b(SocialMediaPosting|ProfilePage)\b/.test(t.ld || '')) return 'The page says it is a social media post or profile';
    if (/^profile$/i.test(t.ogType || '')) return 'The page says it is a profile';
    return '';
  }
  // Every site worth asking about once: not listed, not answered by you, and showing a sign.
  // 4.25.0: never asked any more (the list of social platforms is fixed).
  function askFor() { return ''; }
  async function setMine(site, kind) {
    await ready;
    const m = { ...mine }, b = String(site || '').toLowerCase().replace(/^www\./, '');
    const was = m[b] || '';
    if (kind) m[b] = kind; else delete m[b];
    mine = m;
    await api.storage.local.set({ ppSocialSites: m });
    return was;
  }

  // ------------------------------------------------------------ the same name elsewhere
  // Where to look for a name on other platforms (opens their profile page).
  const ELSEWHERE = [['instagram.com', 'Instagram', n => 'https://www.instagram.com/' + n + '/'], ['tiktok.com', 'TikTok', n => 'https://www.tiktok.com/@' + n], ['x.com', 'X', n => 'https://x.com/' + n],
    ['facebook.com', 'Facebook', n => 'https://www.facebook.com/' + n], ['threads.net', 'Threads', n => 'https://www.threads.net/@' + n], ['youtube.com', 'YouTube', n => 'https://www.youtube.com/@' + n], ['pinterest.com', 'Pinterest', n => 'https://www.pinterest.com/' + n + '/']];
  // "@Harbor.Light_Daily" and "harborlightdaily" count as the same name.
  const plainName = a => String((a && a.handle) || '').replace(/^.*\//, '').replace(/^@/, '').toLowerCase().replace(/[._\-]/g, '');
  const bareName = a => String((a && a.handle) || '').replace(/^.*\//, '').replace(/^@/, '');

  // ------------------------------------------------------------ the account's own details (4.10)
  // Followers, verified, what kind of account it is, and the site's transparency info (country,
  // owner company, date created). Read from the profile page in your own signed-in browser,
  // once per account, then again every 30 days. Nothing is ever typed in by you.
  // "12.5K", "1,204", "1.2M", "3 B" -> a number.
  const big = s => {
    const m = /^([\d][\d.,\s]*)\s*([KkMmBb]|thousand|million|billion)?$/.exec(String(s || '').trim());
    if (!m) return null;
    let t = m[1].replace(/\s/g, '');
    if (m[2]) t = t.replace(/,(\d{1,2})$/, '.$1').replace(/,/g, ''); else t = t.replace(/[.,](?=\d{3}\b)/g, '');
    let n = parseFloat(t);
    if (isNaN(n)) return null;
    const u = (m[2] || '').toLowerCase();
    if (u === 'k' || u === 'thousand') n *= 1e3; else if (u === 'm' || u === 'million') n *= 1e6; else if (u === 'b' || u === 'billion') n *= 1e9;
    return Math.round(n);
  };
  // The pages worth reading for an account: the profile, plus the transparency page where the
  // site has one (Facebook Page transparency, X "About this account"). Instagram's "About this
  // account" opens from the profile's menu, so the reader clicks it there.
  function profilePages(acct) {
    if (!acct || !acct.url) return [];
    // 4.30.2 (Ben): X, Instagram and Threads put everything useful in the bio on the profile itself;
    // their "About this account" almost never adds anything, so only the profile is opened (one
    // page per account, which also keeps them from blocking you). Facebook keeps its Page
    // transparency page: it often names the owner and the country.
    const out = [{ url: acct.url, kind: 'profile' }];
    if (acct.plat === 'facebook.com' && !/\/groups\//.test(acct.url)) {
      const id = /(?:^|\/)(?:id\.)?(\d{6,})$/.exec(acct.key || '');
      out.push({ url: id ? 'https://www.facebook.com/profile.php?id=' + id[1] + '&sk=about_profile_transparency' : acct.url.replace(/\/+$/, '') + '/about_profile_transparency', kind: 'transparency' });
    }
    return out;
  }
  // Runs INSIDE the profile's tab (self-contained). Returns the page's tags, the text, the short
  // bits of the page's own data that matter, the links and the buttons near the top.
  async function readProfileInTab(click) {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const meta = n => { const m = document.querySelector(`meta[property="${n}"], meta[name="${n}"]`); return m ? (m.getAttribute('content') || '').trim() : ''; };
    let about = '';
    if (click === 'ig-about') {
      try {
        const opt = [...document.querySelectorAll('svg[aria-label]')].find(s => /^(options|more options)$/i.test(s.getAttribute('aria-label')));
        const b = opt && (opt.closest('[role="button"], button') || opt.parentElement);
        if (b) { b.click(); await wait(1200); const it = [...document.querySelectorAll('[role="dialog"] button, [role="dialog"] [role="button"], [role="dialog"] div')].find(e => /^about this account$/i.test((e.textContent || '').trim())); if (it) { it.click(); await wait(2200); const d = [...document.querySelectorAll('[role="dialog"]')].pop(); about = d ? d.innerText.slice(0, 4000) : ''; } }
      } catch (e) { /* menu not there */ }
    }
    const html = document.documentElement.innerHTML.slice(0, 3e6);
    const rx = /"((?:[a-z_]*follower[a-z_]*)|(?:[a-z_]*verified[a-z_]*)|(?:edge_followed_by)|(?:subscriberCountText)|(?:category_name)|(?:business_category_name)|(?:category)|(?:is_business_account)|(?:is_professional_account)|(?:business_email)|(?:public_email)|(?:contact_phone_number)|(?:business_phone_number)|(?:external_url)|(?:biography)|(?:full_name)|(?:signature)|(?:verified_type)|(?:is_blue_verified)|(?:commerceUserInfo)|(?:ttSeller))"\s*:\s*("(?:[^"\\]|\\.){0,300}"|true|false|null|-?\d+(?:\.\d+)?|\{[^{}]{0,300}\})/gi;
    const data = []; let m, n = 0;
    while ((m = rx.exec(html)) && n++ < 400) data.push([m[1], m[2], m.index]);
    // 4.30.1: the page's data also holds YOU (the signed-in viewer): your name, your followers.
    // Where the viewed account's own block starts ("username":"1010wins") is noted, so only the
    // data next to it is used (Instagram, Threads, TikTok).
    const who = (location.pathname.split('/').filter(Boolean)[0] || '').replace(/^@/, '').toLowerCase();
    const own = [];
    if (who) { const ux = new RegExp('"(?:username|uniqueId)"\\s*:\\s*"' + who.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"', 'gi'); let u2; while ((u2 = ux.exec(html)) && own.length < 40) own.push(u2.index); }
    const top = document.querySelector('header, [role="main"]') || document.body;
    const near = el => !!el.closest('header, h1, h2, [role="main"] > div:first-child');
    const badge = [...document.querySelectorAll('[aria-label*="erified" i], [title*="erified" i], [data-testid="icon-verified"]')].filter(near).map(e => e.getAttribute('aria-label') || e.getAttribute('title') || 'verified').slice(0, 4);
    const links = [...new Set([...top.querySelectorAll('a[href]')].map(a => a.href))].slice(0, 120);
    const buttons = [...new Set([...top.querySelectorAll('a, button, [role="button"]')].map(e => (e.innerText || e.getAttribute('aria-label') || '').trim()).filter(t => t && t.length <= 30))].slice(0, 120);
    // 4.24 (Ben): X puts the profile's own facts in fixed places. Its page data also holds the
    // signed-in viewer and suggested accounts, so on X only these places are read.
    let x = null;
    if (/(^|\.)(x|twitter)\.com$/.test(location.hostname)) {
      const q = (s, r = document) => r.querySelector(s);
      const head = q('[data-testid="UserName"]');
      const tx = s => { const e = q(s); return e ? (e.innerText || '').trim() : ''; };
      x = { name: '', check: '', affiliate: '', followers: '', category: tx('[data-testid="UserProfessionalCategory"]'), bio: tx('[data-testid="UserDescription"]'), url: (q('[data-testid="UserUrl"]') || {}).href || '', items: tx('[data-testid="UserProfileHeader_Items"]'), labels: '' };
      if (head) {
        x.name = (head.innerText || '').split('\n')[0].trim();
        const svg = head.querySelector('svg[data-testid="icon-verified"]');
        if (svg) {
          const paths = [...svg.querySelectorAll('path')];
          const grad = !!svg.querySelector('linearGradient') || paths.some(p => /^url\(/.test(p.getAttribute('fill') || '') || /^url\(/.test(getComputedStyle(p).fill || ''));
          const col = (getComputedStyle(svg).color || getComputedStyle(paths[0] || svg).fill || '').match(/\d+/g) || [];
          const [r, g, b] = col.map(Number);
          x.check = grad ? 'gold' : col.length >= 3 && b > r + 80 && b > g + 40 ? 'blue' : col.length >= 3 && Math.abs(r - g) < 50 && Math.abs(g - b) < 50 ? 'grey' : col.length >= 3 && r > 180 && g > 120 && b < 90 ? 'gold' : 'blue';
          x.checkLabel = svg.getAttribute('aria-label') || '';
        }
        const aff = [...head.querySelectorAll('a[href]')].find(a => a.querySelector('img'));
        if (aff) { const im = aff.querySelector('img'); x.affiliate = [aff.getAttribute('aria-label'), im && im.getAttribute('alt'), aff.getAttribute('href')].filter(Boolean).join(' · '); }
      }
      const fl = [...document.querySelectorAll('a[href$="/verified_followers"], a[href$="/followers"]')].find(a => /follower/i.test(a.innerText || ''));
      if (fl) x.followers = (fl.innerText || '').trim();
      x.labels = [...document.querySelectorAll('[data-testid="primaryColumn"] [aria-label*="government" i], [data-testid="primaryColumn"] [aria-label*="official" i], [data-testid="primaryColumn"] [aria-label*="label" i]')].map(e => e.getAttribute('aria-label')).slice(0, 6).join(' · ');
    }
    // 4.24: the profile's own name as the page shows it (Facebook, YouTube...): the big heading.
    const h1 = [...document.querySelectorAll('[role="main"] h1, #page-header h1, ytd-channel-name #text, h1')].map(e => (e.innerText || e.textContent || '').split('\n')[0].trim()).find(t => t && t.length <= 80 && !/^(notifications|facebook|youtube|home|chats|menu)$/i.test(t)) || '';
    return { who, own, h1, url: location.href, title: document.title, desc: meta('og:description') || meta('description'), ogTitle: meta('og:title'), text: (document.body ? document.body.innerText : '').slice(0, 30000), about, data, badge, links, buttons, x };
  }

  // ---------- quiet lookup tabs (4.20, Ben) ----------
  // Pages PageProof opens in your browser to see who is behind an account or post open as a small
  // pinned tab at the left of the tab bar, in the background, showing the PageProof logo and
  // "checking owner", and close by themselves when the check is done (like the search tabs).
  const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAG60lEQVR4AaRWaWxUVRg93xtqkVq6SKcltJWC4oYxxjUYNxJ+uCRGFBMVTTTBCKVYNoshKlCjRI3EJSpuBIyJW6LiFk2MolUxYCKpihgDbcIynaEtMIWWhr7rOffNK7Sswsu773v3W84533dnOg1wUpez6vq2q8+al35Jq3p+29WAs5OB+l8Cxs7KXFozO/Pc6Dk7W4NE0ETCmTBwWVP1gp2tVQsyz1UvyFxK/wnfxxUwdlZq/JiHM4tH16c3hQmsD83NJWmVMwcEFvUtC1eFAHPDhFtf+VhmU+VjbYurFqXGH0/JEQWcNTNVUzMzvXBMXbo5tEQzqR6H2TiRmhlJ6ZEFbUROMToE7k2UbhzzHw9d0Dxqcbp5VGN6YXljqkaRwatfwOgZ6YoxtZn6mhmZtQkkNsPwJAIb7zyJygROcu1FHk9Ae4kgsRnjtKyFk5UfIAaeDCzYPPKpzFqu+rJn0hVC1Ar0OHt6ujYB28b3ZRbgSnUKgdFBEYhECJwiWOHjHjzas3elQ36W0bJQeYjiXowEwQl7WSLEtopn0rXMAtNozMpIEoBJEchBMoEjJiO6B8vtzVvWx3ZAXH5fDbrh64gPrQBB6FwZMxDoEeohEAWZHSVTBNQBbTxuWcXlZy5Fw4gg0ULyNuf3e49LEfQZV4TLPf0B62iURsONB/NJJKWFyCTKk+VEEEUkRn/UCf0s17vAR5+ZwNTLhuJerprSBCyHG8fFpnpZ3zRrmcKnboIKBEbQmNxbKpal34uiOImFz6dYIqju9ovz0VRXiqU3F2LpTYVomlGKyRflw3weCXydLPFpwLqDhhsPyiRPoqK4c2UZi/pF0HGEeN01BQwMvB+eUACJA3HjzmWNfHGmfw35NIHmSLwY7aEOWe398SRovZ9Wfl/rUMPxx6Cx1THorCMRbEIB4RJy4AQYkDL4YEQqEV6UyDgBdRHFmUxSZgH0y+o8t7T3YfC1uaMPfb4+Emu+jhUUoKaVTxeNnh4sCoo8IuOeMS+OReXDDeXDA0EC9EfHxXoDXvx5L18G3i+spU+4jEPNKSyryemdSzA0kUKfxGRTkmhYDO5BWzDU8M59xVh5bxF8nqqMDy2ifPTHfkxY3oGGr7No+CaLCW+046ON+yHxxnjUFPPBpogH+rSLjJ50Rkk6KwdfJKUkEMjrdxXhvPIELqwYgtemFEIA0dlSvJAM2NLZh1UberCSa/NuHgx9Eu8Yt7gpWeHSp1vUQkiJZECSoiYxwPOTC3HN2Dx5/LrlgnzMvnYYQALVRRao4PF8fHcxqot5TIxFIklPlkObg3ADawEvhvhMhCkzkTkYPf3JVDp74jBMuWQokwbe864rwKRxp8GDWUT+2dQSXFWZhy/vKcWYkoSGzXCEC985EFnPkOIOpKNx1uI7URK38NbhDhLPmXj491spWq/eVoQLyof4zleTvJITkH/EMMMXd5dg3AiKYBMxHozD5t7M4IJwq3IDPVqeLdvgzLZ6XfRIzASOfBlHr/jR1ulDgHemFOHTe0pQlSOPc0v5of3szhJcXJ7HSTh4EUYrcnM7Oh8q/1O5pJNhxNy3PslvgUnn5+vtuGtkYYDqohzMoOzifMMntxczzklQhhk7p3UBVsPIyfz+Sgdboc5BjzNgxa/dDJ/6XZBn5AJMx0pOE35g7yJ3cRu9bX26bA0z1zhuzQwtu/owZ3WWu1O7677dg9auUH2D+OD/lGs6pyV/RO7qF6B9iHAhJxBqEtSA9/l9fuKbLoVOai35pQvv/RP9MUI0gTCwIfMPBRsgYHtj+U8kb4Tp08o0Fr2xbh8WnoSIud9n8dLv3f2dExcI0Nj+4Ih1RO6/BwiQdzuSS0LD914Ey8FRvP1bN+58bxeyvTogHPNSzm2fdGLVxh5WM58Mntzsi45tySWDixke5FpkYXh6eAvPit+KaBL64PzQ2otJKzvx4V89gwoObj/4uwcT3+9A044DOXJ96sEe7LswL28qiI1B1+ECmNA2v2LvGcP33Mxfu085NjgDjMfRsrsPdV9lccVbHVixoRv7DsCvFc3duHxVB2r5gWvJhoj+nojcqe7z9p7dN+66v2QXjnAdUYDy/p11zv4d+5OTYaijgN1c4Ds0ztZsHxq+y+L85RmcuzyNhjVdaMlSDUUqDlm4PbT17dvLbgWxcJTrqAJ8/iILUw3Jl/m7dh7J3+REemFRZwRHNwM9jnt+v2O/C9DrHN5M9Nm5HQ8mX8AiYxaOeh1bQK4s80gy1TYvOc3ywkoSLOVxpPyYeTSAgyc3l6Jd2ntaWNkxPTktU5tM4QSuExIQ46Rmjcxk6pOPpjvLRsGC60n+CsW8wmnc0J5Ojmqfnny064GRmThf9njrPwAAAP//rNvqzwAAAAZJREFUAwD7WdFWnkPvaAAAAABJRU5ErkJggg==';
  function brandTab(logo, title) {
    if (window.__ppQuiet) return; window.__ppQuiet = true;
    const fix = () => {
      if (!document.head) return;
      const links = document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="mask-icon"]');
      if (links.length !== 1 || links[0].href !== logo) {
        links.forEach(l => l.remove());
        const l = document.createElement('link'); l.rel = 'icon'; l.type = 'image/png'; l.href = logo; document.head.appendChild(l);
      }
      if (document.title !== title) document.title = title;
    };
    fix();
    if (!document.head) document.addEventListener('DOMContentLoaded', fix, { once: true });
    setInterval(fix, 1000);   // the sites keep putting their own icon and title back
  }
  const QUIET_TITLE = '🔒 PageProof · checking owner · closes itself';
  const brandQuiet = id => api.scripting.executeScript({ target: { tabId: id }, func: brandTab, args: [LOGO, QUIET_TITLE], injectImmediately: true }).catch(() => {});
  // Opens url quietly and waits until it has loaded (at most ms). Returns the tab.
  async function openQuiet(url, ms = 25000) {
    let win;
    try { const me = await api.tabs.getCurrent(); if (me) win = me.windowId; } catch (e) { /* not in a tab */ }
    const tab = await ppOpenSearchTab(url, win);   // the searching window, or pinned (4.57)
    QUIET.add(tab.id);
    await new Promise(res => {
      const t = setTimeout(done, ms);
      function done() { clearTimeout(t); api.tabs.onUpdated.removeListener(on); res(); }
      function on(id, ch) {
        if (id !== tab.id) return;
        if (ch.status === 'loading' || ch.title || ch.favIconUrl) brandQuiet(tab.id);
        if (ch.status === 'complete') { brandQuiet(tab.id); done(); }
      }
      api.tabs.onUpdated.addListener(on);
    });
    return tab;
  }
  const closeQuiet = tab => { if (tab) { QUIET.delete(tab.id); api.tabs.remove(tab.id).catch(() => {}); } };
  // 4.30.2 (Ben): Pause or Off closes every quiet tab straight away, and a read in progress stops
  // (it is not counted as a failed read, so it is simply done again after Resume).
  const QUIET = new Set();
  const halt = { on: false };
  function stopQuiet() { halt.on = true; for (const id of QUIET) api.tabs.remove(id).catch(() => {}); QUIET.clear(); }
  // Opens each page in a quiet pinned tab of your own browser, reads it, and closes it.
  async function readProfile(acct) {
    const out = [];
    for (const p of profilePages(acct)) {
      if (halt.on) break;
      let tab;
      try {
        tab = await openQuiet(p.url);
        await new Promise(r => setTimeout(r, 3000));       // the sites draw the profile after loading
        const [res] = await api.scripting.executeScript({ target: { tabId: tab.id }, func: readProfileInTab, args: [p.click || ''] });
        if (res && res.result) out.push({ kind: p.kind, ...res.result });
      } catch (e) { /* this page couldn't be read */ } finally { closeQuiet(tab); }
    }
    return out;
  }

  const unq = s => { try { return JSON.parse(s); } catch (e) { return String(s || '').replace(/^"|"$/g, ''); } };
  const COMPANY = /\b((?:[A-Z0-9][\w&'’.-]*\s){0,6}[A-Z0-9][\w&'’.-]*,?\s(?:LLC|L\.L\.C\.|Inc\.?|Incorporated|Ltd\.?|Limited|Corp\.?|Corporation|Co\.|Company|GmbH|LLP|PLLC|PLC|S\.A\.|Pty Ltd|B\.V\.))(?![\w])/;
  const BIZ_WORDS = /\b(shop|store|boutique|llc|inc|co\.|company|studio|agency|salon|spa|restaurant|cafe|café|bakery|bar & grill|official|brand|clothing|apparel|wholesale|realty|real estate|dental|clinic|law firm|marketing|design co|supply|outfitters|market|hotel|resort|tours|travel agency|photography studio)\b/i;
  const FAN_WORDS = /\b(fans?|fan ?page|fanclub|fan club|lovers|daily|memes?|club|community|appreciation|stan|addicts?|hub|world|vibes|aesthetic|repost|reposts|archive)\b/i;
  const CAT_CREATOR = /creator|artist|photograph|blogger|influencer|public figure|musician|band|author|writer|athlete|comedian|personal blog|gamer|model|actor|dj\b|video creator|digital creator/i;
  const CAT_NEWS = /news|media|magazine|newspaper|broadcast|journalist|publisher|tv (network|channel|show)|radio station|media\/news/i;
  const CAT_FAN = /fan page|fan club|meme|community$/i;
  // 4.24 (Ben): anyone holding or running for any public office is a Government account. Ben never
  // wants these, so they are hidden from Copies found unless "Show government" is on.
  const GOV_WORDS = /\b(congress(?:wo)?man|congressperson|member of congress|(?:u\.?s\.?|state) (?:senator|representative|rep\.?)|senator|assembly(?:wo)?man|assembly ?member|council(?:wo)?man|council ?member|councilmember|councillor|councilor|city council|county (?:commissioner|executive|legislator|clerk)|board of supervisors|alder(?:man|woman|person)|(?:deputy )?mayor|(?:lt\.? |lieutenant )?governor|attorney general|district attorney|comptroller|state treasurer|secretary of state|sheriff|legislator|state rep(?:resentative)?|selectman|freeholder|borough president|public advocate|school board member|candidate|running for|campaign (?:for|account|page)|for (?:congress|senate|state senate|state house|council|city council|mayor|governor|assembly|sheriff|district attorney|da|judge|school board|president|comptroller|public advocate|borough president|treasurer|state rep)|paid for by|elected official|government (?:official|organi[sz]ation|agency|account)|politician|political candidate|official (?:account|page) of the (?:city|county|state|town|office)|white house|house of representatives|state legislature)\b/i;
  const GOV_NAME = /^(?:rep|sen|gov|mayor|senator|congress(?:wo)?man|council(?:wo)?man|councilmember|assembly(?:wo)?man|cm|commissioner|judge|sheriff)\.?\s/i;
  // 4.35 (Ben: "Politicians we always want filtered out"): more ways an office shows. Rep. Jim
  // Jordan's bio says "Proudly serving Ohio's beautiful Fourth District. Chairman @JudiciaryGOP".
  const GOV_MORE = /(?:\b(?:proudly )?(?:serving|represent(?:ing|s)?)\b[^.\n]{0,50}\b(?:district|county|ward|parish|constituents)\b|\b(?:\d{1,2}(?:st|nd|rd|th)|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|at-large) (?:congressional |senate |assembly |council |house |legislative )?district\b|\((?:R|D|I)[-–‑]\s?[A-Z][A-Za-z.]{1,13}\)|\b(?:R|D)[-–‑](?:A[LKZR]|C[AOT]|DE|FL|GA|HI|I[DLNA]|K[SY]|LA|M[EDAINSOT]|N[EVHJMYCD]|O[HKR]|PA|RI|S[CD]|T[NX]|UT|V[TA]|W[AVIY])\b|@\w+(?:GOP|Dems)\b|\bchair(?:man|woman)? of the (?:house|senate)\b|\b(?:house|senate) (?:judiciary|appropriations|armed services|oversight|intelligence|foreign affairs|budget|finance) committee\b|\bu\.?s\.? (?:house|senate)\b)/i;
  // Handles that start with an office: @RepJimJordan, @SenSchumer, @GovKathyHochul, @MayorAdams.
  const GOV_HANDLE = /^@?(?:Rep|Sen|Senator|Gov|Governor|LtGov|Mayor|Congressman|Congresswoman|Councilman|Councilwoman|Councilmember|CM|Assemblyman|Assemblywoman|AsmMember|Comptroller|AG)[A-Z_]/;
  const isGovText = t => GOV_WORDS.test(t || '') || GOV_MORE.test(t || '');
  const govMatch = t => ((String(t || '').match(GOV_WORDS) || String(t || '').match(GOV_MORE) || [''])[0]);
  // 4.35 (Ben): a person's own account: just a name, no company, no contact, no website.
  // "Fredric U. Dicker", "Claire Langoulant ⚜️♛", "Fredia Wright (Ernst)". Not "Brooklyn Paper".
  const NOT_PERSON = /\b(news|paper|times|post|daily|weekly|tribune|journal|media|tv|radio|magazine|press|gazette|herald|report|official|team|group|club|society|association|foundation|church|school|university|college|city|county|state|department|dept|office|center|centre|museum|gallery|studio|studios|photos?|photography|pics|images|films?|records|music|band|shop|store|inc|llc|ltd|co|company|agency|network|channel|show|podcast|fans?|world|hub|nation|united|america|american|usa|nyc|ny|la|official)\b/i;
  function personName(n) {
    const t = String(n || '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/[^\p{L}\s.'’-]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (!t || /\d/.test(n || '') || NOT_PERSON.test(t)) return false;
    const w = t.split(' ');
    if (w.length < 2 || w.length > 4) return false;
    return w.every(x => /^\p{Lu}[\p{Ll}'’-]+$/u.test(x) || /^\p{Lu}\.?$/u.test(x) || /^\p{Lu}[\p{Ll}]*[-'’]\p{Lu}[\p{Ll}]+$/u.test(x) || /^(?:Mc|Mac|O'|De|Di|Van|Von|Le|La)\p{Lu}[\p{Ll}]+$/u.test(x)) && w.filter(x => x.replace(/\.$/, '').length > 1).length >= 2;
  }
  // What can be told about an account BEFORE its profile is read (or when the site won't show it):
  // the link (LinkedIn /in/ is always a person, /company/ a company), the handle and the name the
  // site gave the post ("Rep. Jim Jordan"). Returns { type, sure, why } or null.
  function quickType(acct, title) {
    if (!acct) return null;
    const key = String(acct.key || '').replace(/^[a-z0-9.-]+\.[a-z]+\//i, ''), name = String(acct.name || ''), handle = String(acct.handle || '').replace(/^@/, '');
    const head = String(title || '').split(/\s+(?:on X|on Twitter|on Instagram|on Facebook|on LinkedIn|on TikTok|\||-|–|\(@)/)[0].trim().slice(0, 80);
    for (const t of [name, head]) {
      if (t && GOV_NAME.test(t)) return { type: 'Government', sure: 'sure', why: 'the name "' + t + '"' };
    }
    if (GOV_HANDLE.test(handle)) return { type: 'Government', sure: 'sure', why: 'the handle "@' + handle + '"' };
    for (const t of [name, head]) if (t && isGovText(t)) return { type: 'Government', sure: 'sure', why: 'the name ("' + govMatch(t) + '")' };
    if (/^in\//.test(key) && /linkedin\.com$/.test(acct.plat || 'linkedin.com')) return { type: 'Person', sure: 'sure', why: 'a LinkedIn personal profile (linkedin.com/in/…)' };
    if (/^company\//.test(key) && /linkedin\.com$/.test(acct.plat || 'linkedin.com')) return { type: 'Business', sure: 'sure', why: 'a LinkedIn company page' };
    return null;
  }
  // 4.49.2: X's "professional category" is picked by the account itself (any personal account can
  // turn it on), so only fan, news, organisation and creator words in it mean anything.
  const isXPlat = p => /^(x|twitter)\.com$/i.test(String(p || ''));
  const selfCat = (plat, cat) => isXPlat(plat) && !!cat && !CAT_FAN.test(cat) && !CAT_NEWS.test(cat) && !CAT_ORG.test(cat) && !CAT_CREATOR.test(cat);
  // X accounts read before 4.49.2 were called Business from the category alone: work it out again
  // from the details already read (no new read needed).
  function xRecheck(acct, i) {
    if (!i || i.type !== 'Business' || i.typeSure !== 'sure' || i.company || i.verified === 'gold' || i.verified === 'grey' || (i.v || 0) >= 6) return i;
    if (!selfCat(acct && acct.plat || (/^(x|twitter)\.com\//i.test(acct && acct.key || '') ? 'x.com' : ''), i.category)) return i;
    const signs = (i.signs || []).slice();
    if (BIZ_WORDS.test(i.category)) signs.push('a business category ("' + i.category + '")');
    const out = { ...i, signs, type: '', typeSure: '' };
    if (signs.length >= 2) { out.type = 'Business'; out.typeSure = 'guess'; }
    else if (!signs.length && (i.followers == null || i.followers < 1e5) && personName(i.name)) { out.type = 'Person'; out.typeSure = 'guess'; out.personWhy = 'only a person\'s name, with no company, website or contact details (the X category "' + i.category + '" can be picked by anyone)'; }
    return out;
  }
  // The account's type, all things known put together (4.35). Order: what you set by hand, then
  // government (from the link, name or profile; Ben never wants them), then what the profile
  // read found, then "just a person's name" worked out again from the details already read (so
  // accounts read before 4.35 need no new read), then what the link alone says.
  function kindOf(acct, info, title, mine) {
    if (mine) return { type: mine, sure: 'you', why: 'set by you' };
    const q = quickType(acct, title);
    if (q && q.type === 'Government') return q;
    const i = info && info.ok ? xRecheck(acct, info) : null;
    if (i) {
      const qi = i.name ? quickType({ ...acct, name: i.name }) : null;
      if (i.type === 'Government') return { type: 'Government', sure: 'sure', why: i.gov || 'the profile' };
      if (qi && qi.type === 'Government') return qi;
      if (i.type) return { type: i.type, sure: i.typeSure || 'sure', why: i.type === 'Person' ? i.personWhy || 'the profile' : '' };
      if (!i.category && !i.company && !(i.signs || []).length && i.verified !== 'gold' && i.verified !== 'grey' && (i.followers == null || i.followers < 1e5) && personName(i.name)) return { type: 'Person', sure: 'guess', why: 'only a person\'s name, with no company, website or contact details' };
    }
    return q;
  }
  // 4.35 (Ben): a link preview is not a posted picture. When someone shares an article, LinkedIn,
  // X and Facebook show a card with the article's picture; that picture lives at its own kind of
  // address. Returns the platform's word for it, or ''.
  function cardPic(u) {
    const s = String(u || '');
    if (/media\.licdn\.com\/[^?#]*\/articleshare-/i.test(s)) return 'LinkedIn link preview';
    if (/pbs\.twimg\.com\/card_img\//i.test(s)) return 'X link card';
    if (/(?:^https?:\/\/|\.)external[.-][^/]*fbcdn\.net\//i.test(s) || /\/safe_image\.php/i.test(s) || /fbcdn\.net\/emg1\//i.test(s)) return 'Facebook link preview';
    if (/cdn\.bsky\.app\/img\/feed_thumbnail\/[^?#]*\/bafk/i.test(s) && /external/i.test(s)) return 'Bluesky link card';
    return '';
  }
  const GOV_SITE = /(?:for|4)(?:congress|senate|council|citycouncil|mayor|governor|assembly|sheriff|judge|delegate|schoolboard|statehouse|staterep|comptroller|president)(?:[0-9-]*)\.[a-z]+$|(?:^|\.)[a-z0-9-]+\.gov(?:\.[a-z]{2})?$|\.(?:house|senate)\.gov$|^(?:www\.)?(?:house|senate|whitehouse)\.gov$/i;
  const CAT_GOV = /politician|political candidate|government official|government organi[sz]ation|government (?:agency|building|service)|public (?:&|and) government|elected official|political organi[sz]ation|political party|campaign/i;
  // The site's own copyright line ("© 2026 X Corp.", "© 2026 Meta") is never the account's company.
  const SITE_CO = /^(?:\d{4}\s+)?(?:x corp|twitter|meta(?: platforms)?|facebook|instagram|tiktok|bytedance|google|youtube|alphabet|pinterest|reddit|snap|linkedin|microsoft|tumblr|automattic|threads)\b/i;
  const noCopyright = t => String(t || '').split('\n').filter(l => !/©|\(c\)\s*\d{4}|all rights reserved/i.test(l)).join('\n');
  const CAT_ORG = /non-?profit|government|charity|organi[sz]ation|school|university|college|church|religious|political|public (&|and) government/i;
  const WEB_SKIP = /(^|\.)(facebook|fb|instagram|threads|x|twitter|tiktok|youtube|youtu|pinterest|linkedin|snapchat|reddit|tumblr|google|apple|whatsapp|wa|meta|messenger|bit|t|lnkd|about|help|play|apps|microsoft|cdninstagram|fbcdn|twimg|ytimg|gstatic|w3|schema|tiktokcdn)\.[a-z.]+$/i;
  // "Boston, MA, United States" -> United States; "Austin, Texas" -> United States; else ''.
  const US_STATES = /^(A[LKZR]|C[AOT]|D[EC]|FL|GA|HI|I[DLNA]|K[SY]|LA|M[EDAINSOT]|N[EVHJMYCD]|O[HKR]|PA|PR|RI|S[CD]|T[NX]|UT|V[TA]|W[AVIY]|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|District of Columbia)$/;
  function placeCountry(line) {
    const parts = String(line || '').split(',').map(x => x.trim()).filter(Boolean);
    if (parts.length < 2 || parts.length > 4 || line.length > 70) return '';
    const last = parts[parts.length - 1];
    if (/^(United States|USA|U\.S\.A?\.?|US)$/i.test(last)) return 'United States';
    if (/^Puerto Rico$/i.test(last) || last === 'PR') return 'Puerto Rico';
    if (US_STATES.test(last)) return 'United States';
    const names = typeof FC !== 'undefined' && FC.COUNTRY ? Object.values(FC.COUNTRY) : [];
    return names.includes(last) ? last : '';
  }
  // Turns what the reader saw into plain facts. Unknown stays empty, never guessed as "no".
  function profileFacts(acct, pages) {
    const f = { ok: false, followers: null, fw: 'followers', verified: '', type: '', typeSure: '', category: '', company: '', address: '', country: '', created: '', oldNames: [], website: '', email: '', phone: '', signs: [], name: '' };
    if (!acct || !Array.isArray(pages) || !pages.length) return f;
    const plat = acct.plat || '';
    const prof = pages.find(p => p.kind === 'profile') || pages[0];
    const tr = noCopyright(pages.filter(p => p.kind === 'transparency').map(p => p.text || '').join('\n') + '\n' + pages.map(p => p.about || '').join('\n'));
    const isX = plat === 'x.com' || plat === 'twitter.com';
    // On X the page's data is the viewer's and suggested accounts', not this profile's (4.24).
    // 4.30.1 (Ben: his own name showed on other Instagram accounts): the page's data holds the
    // signed-in viewer too. Instagram, Threads, TikTok: only data within the viewed account's own
    // block is used. Facebook: its data is not used at all (the page text and heading are).
    const SCOPED = /^(instagram\.com|threads\.net|threads\.com|tiktok\.com)$/.test(plat);
    const near = (p, i) => Array.isArray(p.own) && p.own.some(o => Math.abs(o - i) < 4000);
    const D = {}; if (!isX && plat !== 'facebook.com') for (const p of pages) for (const [k, v, i] of (p.data || [])) { if (SCOPED && !(typeof i === 'number' && near(p, i))) continue; const key = k.toLowerCase(); if (!(key in D)) D[key] = v; }
    const X = isX ? (pages.find(p => p.x && p.x.name) || pages.find(p => p.x) || {}).x || null : null;
    const dv = k => k in D ? unq(D[k]) : undefined;
    const text = noCopyright(prof.text), desc = String(prof.desc || ''), top = text.slice(0, 4000);
    // Followers (or subscribers, or members for groups).
    const jf = ['follower_count', 'followers_count', 'followercount', 'followers'].map(dv).find(v => typeof v === 'number');
    const ebf = D.edge_followed_by && /"count"\s*:\s*(\d+)/.exec(D.edge_followed_by);
    if (X && X.followers) { const m = /([\d][\d.,]*\s?[KMBkmb]?)/.exec(X.followers); if (m) f.followers = big(m[1]); }
    else if (isX) { /* not shown: stays unknown rather than a guess from the page's data */ }
    else if (typeof jf === 'number') f.followers = jf; else if (ebf) f.followers = +ebf[1];
    if (f.followers == null) {
      const sub = dv('subscribercounttext'); const sm = sub && /([\d.,]+\s?[KMB]?)\s*subscribers/i.exec(typeof sub === 'string' ? sub : JSON.stringify(sub));
      if (sm) { f.followers = big(sm[1]); f.fw = 'subscribers'; }
    }
    if (f.followers == null && !(isX && X && X.name)) {
      for (const [rx, w] of [[/([\d][\d.,]*\s?[KMBkmb]?)\s+(?:Followers|followers)\b/, 'followers'], [/([\d][\d.,]*\s?[KMBkmb]?)\s+subscribers\b/i, 'subscribers'], [/([\d][\d.,]*\s?[KMBkmb]?)\s+(?:total\s+)?members\b/i, 'members']]) {
        const m = rx.exec(desc) || rx.exec(top);
        if (m) { f.followers = big(m[1]); f.fw = w; break; }
      }
    }
    if (/\/groups\//.test(acct.url || '')) f.fw = 'members';
    // Verified: the site's own data first, then a check badge next to the name.
    // 4.24 (Ben): the kind of check matters. X: blue = paid (X Premium), gold = an organisation
    // X verified, grey = government. Instagram/Facebook/Threads: Meta shows one check for both
    // paid Meta Verified and earned verification ('meta'), 'paid' when the data says Meta Verified.
    // TikTok, YouTube and the rest give their check out themselves ('yes').
    const META = /^(instagram\.com|facebook\.com|threads\.net|threads\.com)$/.test(plat);
    if (isX) {
      if (X && X.name) f.verified = X.check === 'gold' ? 'gold' : X.check === 'grey' ? 'grey' : X.check ? 'paid' : 'no';
    } else {
      const vt = String(dv('verified_type') || ''), anyTrue = ['is_verified', 'verified', 'is_blue_verified'].some(k => dv(k) === true), anyFalse = ['is_verified', 'verified'].some(k => dv(k) === false);
      const mv = ['is_verified_by_mv4b', 'is_meta_verified', 'meta_verified'].some(k => dv(k) === true);
      if (/business/i.test(vt)) f.verified = 'gold';
      else if (/government/i.test(vt)) f.verified = 'grey';
      else if (mv) f.verified = 'paid';
      else if (anyTrue || (prof.badge || []).length) f.verified = META ? 'meta' : 'yes';
      else if (anyFalse) f.verified = 'no';
    }
    // Name, bio, category.
    // Instagram's and Threads' og:title is "1010 WINS (@1010wins) • Instagram photos and videos":
    // always the viewed account, never you.
    const ogName = (/^(.+?)\s*\(@([\w.]+)\)/.exec(prof.ogTitle || '') || [])[1] || '';
    f.name = String((X && X.name) || (SCOPED ? ogName || dv('full_name') : prof.h1 || prof.ogTitle) || '').replace(/\s*[(•|].*$/, '').replace(/\s+-\s+(YouTube|Facebook|TikTok)$/i, '').trim().slice(0, 80);
    if (/^(log ?in|sign ?in|facebook|instagram|youtube|tiktok|x|error|page not found)$/i.test(f.name)) f.name = '';
    const bio = String((X && X.bio) || dv('biography') || dv('signature') || desc || '').slice(0, 600);
    f.category = String((X && X.category) || dv('business_category_name') || dv('category_name') || '').trim();
    if (!f.category && plat === 'facebook.com') { const m = /(?:^|\n)\s*(?:Page|Profile)\s*·\s*([^\n·]{2,40})/.exec(text); if (m) f.category = m[1].trim(); }
    if (!f.category && plat === 'instagram.com') { const c = dv('category'); if (typeof c === 'string' && c.length < 40) f.category = c; }
    // Transparency: owner company, address, country, date created, old names.
    const after = (rx, max = 1) => { const m = rx.exec(tr); if (!m) return []; return m[1].split('\n').map(s => s.trim()).filter(Boolean).slice(0, max); };
    const owner = after(/(?:Confirmed Page owner|Organi[sz]ations? that manages? this Page|Page owner|Owned by)\s*:?\s*\n((?:.*\n){1,4})/i, 3);
    let co = (owner.join('\n').match(COMPANY) || tr.match(COMPANY) || bio.match(COMPANY) || [])[1] || '';
    co = co.replace(/^\d{4}\s+/, '').trim();
    if (SITE_CO.test(co)) co = '';
    f.company = co ? co : owner[0] && !/^(see|learn|more)\b/i.test(owner[0]) && /confirmed page owner/i.test(tr) ? owner[0] : '';
    f.address = owner.slice(1).find(l => /\d/.test(l) && /,/.test(l)) || '';
    f.country = (after(/(?:Account based in|Based in|Primary country\/region location for people who manage this Page|Country\/region location for people who manage this Page|Country\/region)\s*(?:includes)?\s*:?\s*\n?\s*(?:includes:?\s*\n?\s*)?([^\n]{2,60})/i)[0] || '').replace(/\s*\(\d+\)$/, '').trim();
    if (f.country && (!/^[A-Z][A-Za-z .,'()&-]{1,59}$/.test(f.country) || /^includes/i.test(f.country))) f.country = '';
    // 4.24 (Ben): else the place on the profile ("Boston, MA, United States", "Lives in Austin, Texas").
    if (!f.country) {
      const det = /(?:^|\n)\s*(?:Details|Intro)\s*\n((?:.*\n?){1,6})/.exec(text);
      const lines = det ? det[1].split('\n').map(l => l.replace(/^(Lives in|From|Based in)\s+/i, '').trim()) : [];
      for (const l of lines) { const c = placeCountry(l); if (c) { f.country = c; f.place = l; break; } }
    }
    const cm = /(?:Page created|Creation date|Date joined|Joined)\s*[-–:]?\s*\n?\s*([A-Z][a-z]+ \d{1,2}, \d{4}|[A-Z][a-z]+ \d{4})/.exec(tr) || /\bJoined ([A-Z][a-z]+ \d{4})\b/.exec(top);
    if (cm) f.created = cm[1];
    const old = /Former usernames?\s*\n((?:.*\n){1,4})/i.exec(tr);
    if (old) f.oldNames = old[1].split('\n').map(s => s.trim()).filter(s => /^@?[\w.]{2,40}$/.test(s)).slice(0, 5);
    for (const m of tr.matchAll(/Changed name to ([^\n]{2,60})/g)) if (f.oldNames.length < 5) f.oldNames.push(m[1].trim());
    // Website, email, phone.
    const ext = (X && X.url) || dv('external_url');
    const fix = u => { try { const x = new URL(u); const r = x.searchParams.get('u') || x.searchParams.get('url') || x.searchParams.get('q'); return r && /^https?:/.test(r) && /^(l\.|lm\.)?(facebook|instagram|youtube|threads)\.|t\.co$|linktr|lnk\.bio/.test(x.hostname) ? r : u; } catch (e) { return ''; } };
    const webs = [ext, ...(prof.links || [])].filter(u => typeof u === 'string' && /^https?:/.test(u)).map(fix).filter(u => { try { const h = new URL(u).hostname.replace(/^www\./, ''); return h && !WEB_SKIP.test(h) && !listed(h); } catch (e) { return false; } });
    f.website = webs[0] || '';
    f.email = String(dv('business_email') || dv('public_email') || (bio.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/) || [])[0] || '');
    f.phone = String(dv('contact_phone_number') || dv('business_phone_number') || (bio.match(/\+?\d[\d\s().-]{8,}\d/) || [])[0] || '');
    f.ok = f.followers != null || !!f.name || !!f.category || !!f.country;
    // What kind of account: the site says it, or the signs add up.
    const btn = (prof.buttons || []).join(' | ');
    f.v = 6;   // 6 (4.49.2): X category alone is not Business; 4.24: X fixes and government; 4 (4.30.1): viewer's own data left out; 5 (4.35): person and more government signs
    const name = f.name + ' ' + bareName(acct);
    if (/shop now|shop$|view shop|book now|book$|order (now|online)|call now|get directions|directions|send email|email$|contact$|contact us|visit website|buy tickets|start order/i.test(btn)) f.signs.push('a "' + ((btn.match(/shop now|view shop|book now|order now|order online|call now|get directions|send email|contact us|visit website|buy tickets|start order|shop|book|contact|email|directions/i) || ['Contact'])[0]) + '" button');
    if (BIZ_WORDS.test(name) || BIZ_WORDS.test(bio)) f.signs.push('a business word in the name or bio ("' + ((name.match(BIZ_WORDS) || bio.match(BIZ_WORDS))[0]) + '")');
    if (f.email) f.signs.push('an email address');
    if (f.phone) f.signs.push('a phone number');
    if (f.website) f.signs.push('its own website');
    if (dv('is_business_account') === true || dv('commerceuserinfo') || dv('ttseller') === true) f.signs.push('the site marks it a business account');
    if (f.company) f.signs.push('a registered company name');
    const cat = f.category;
    const set = (t, s) => { if (!f.type) { f.type = t; f.typeSure = s; } };
    if (/\/groups\//.test(acct.url || '')) set('Group', 'sure');
    // Government: a grey check, a government label or affiliation, a politics category, office
    // words in the name or bio ("Congresswoman", "NYC Councilman", "for Council"), or a campaign
    // or .gov website. The reason is kept so the panel can say why.
    let webHost = ''; try { webHost = f.website ? new URL(f.website).hostname.replace(/^www\./, '') : ''; } catch (e) { /* none */ }
    const govWhy = f.verified === 'grey' ? 'a grey (government) check'
      : X && /government|state-affiliated|official/i.test(X.labels || '') ? 'a government label on the profile'
      : X && X.affiliate && /government|congress|senate|house|council|\bgop\b|dems?\b|democrat|republican|campaign|\.gov/i.test(X.affiliate) ? 'a government or party badge (' + X.affiliate.split(' · ')[0] + ')'
      : CAT_GOV.test(cat) ? 'the category "' + cat + '"'
      : GOV_NAME.test(f.name) ? 'the name "' + f.name + '"'
      : GOV_WORDS.test(bio) ? 'the bio ("' + bio.match(GOV_WORDS)[0] + '")'
      : GOV_WORDS.test(f.name) ? 'the name ("' + f.name.match(GOV_WORDS)[0] + '")'
      : GOV_MORE.test(bio) ? 'the bio ("' + bio.match(GOV_MORE)[0] + '")'
      : X && X.affiliate && GOV_MORE.test(X.affiliate) ? 'a government badge (' + X.affiliate.split(' · ')[0] + ')'
      : GOV_HANDLE.test(bareName(acct)) ? 'the handle "@' + bareName(acct) + '"'
      : webHost && GOV_SITE.test(webHost) ? 'a campaign or government website (' + webHost + ')'
      : '';
    if (govWhy) { f.gov = govWhy; set('Government', 'sure'); }
    // 4.35 (Ben): a person's own account. Facebook shows "162 friends" and "Personal details" only
    // on a person's profile (Pages show likes and followers); LinkedIn /in/ is always a person.
    const qt = quickType(acct);
    if (qt && qt.type !== 'Government') { f.personWhy = qt.type === 'Person' ? qt.why : ''; set(qt.type, qt.sure); }
    if (plat === 'facebook.com' && !/(?:^|\n)\s*Page\s*·/.test(text) && (/(?:^|\n)\s*[\d.,]+\s?[KkMm]?\s+(?:mutual\s+)?friends\b/.test(top) || /(?:^|\n)\s*Personal details\s*(?:\n|$)/.test(text))) { f.personWhy = /friends/.test(top) ? 'a friends count (only personal profiles have friends)' : '"Personal details" (only personal profiles have them)'; set('Person', 'sure'); }
    if (f.verified === 'gold' || f.verified === 'grey') set('Organisation', 'sure');
    if (f.company) set('Business', 'sure');
    // 4.49.2 (Ben): on X anyone can switch on a "professional" category ("Entertainment &
    // Recreation") with one tap, personal accounts too, so it is a sign at most, never the answer.
    if (cat && selfCat(plat, cat)) { if (BIZ_WORDS.test(cat)) f.signs.push('a business category ("' + cat + '")'); }
    else if (cat) {
      if (CAT_FAN.test(cat)) set('Fan page', 'sure');
      else if (CAT_NEWS.test(cat)) set('News or media', 'sure');
      else if (CAT_ORG.test(cat)) set('Organisation', 'sure');
      else if (CAT_CREATOR.test(cat)) set('Creator', 'sure');
      else set('Business', 'sure');
    }
    if (dv('is_business_account') === true) set('Business', 'sure');
    if (f.signs.length >= 2 && !FAN_WORDS.test(name)) set('Business', 'guess');
    if (FAN_WORDS.test(name)) set('Fan page', 'guess');
    if (dv('is_professional_account') === true) set('Creator', 'guess');
    // Just a person's name, nothing else: no category, company, website, email, phone, shop
    // button or business word, no organisation or government check, under 100k followers.
    if (f.ok && !f.type && (!cat || selfCat(plat, cat)) && !f.company && !f.signs.length && f.verified !== 'gold' && f.verified !== 'grey' && (f.followers == null || f.followers < 1e5) && personName(f.name) && !FAN_WORDS.test(name)) { f.personWhy = 'only a person\'s name, with no company, website or contact details'; set('Person', 'guess'); }
    if (f.ok && plat === 'instagram.com' && dv('is_business_account') === false && dv('is_professional_account') === false) set('Person', 'guess');
    if (f.ok && plat === 'facebook.com' && /profile\.php|\/id\.\d+/.test((acct.url || '') + (acct.key || '')) && !/(?:^|\n)\s*Page\s*·/.test(text)) set('Person', 'guess');
    return f;
  }
  // Does the account's website sell things? (A cart, prices, product pages.) Adds a sign.
  function addShopSign(f, pf) {
    if (!f || !pf || !pf.ok || !pf.sells) return f;
    if (pf.sells.cart || pf.sells.price || pf.sells.product) {
      f.shop = true;
      if (!f.signs.includes('its website sells things')) f.signs.push('its website sells things');
      if (!f.type || (f.typeSure === 'guess' && f.type !== 'Business' && f.signs.length >= 2)) { f.type = 'Business'; f.typeSure = 'guess'; }
    }
    return f;
  }
  const FOL_BANDS = [[0, 1e3, 'Under 1k'], [1e3, 1e4, '1k–10k'], [1e4, 1e5, '10k–100k'], [1e5, 1e6, '100k–1M'], [1e6, Infinity, 'Over 1M']];
  const folBand = n => n == null ? 'nk' : String(FOL_BANDS.findIndex(([a, b]) => n >= a && n < b));
  const shortNum = n => n == null ? '' : n >= 1e9 ? (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'B' : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n);

  return { SITES, ready, listed, isSocial, platform, postKind, fromUrl, fromTyped, isShort, unshort, publicInfo, hasPublic: url => !!OEMBED[listed(host(url))], fromTags, shapeOf, pageSigns, askFor, setMine, mine: () => mine, mineFor, ELSEWHERE, plainName, bareName, host,
    big, quickType, kindOf, cardPic, personName, isGovText, profilePages, readProfileInTab, readProfile, openQuiet, closeQuiet, stopQuiet, halt, profileFacts, addShopSign, FOL_BANDS, folBand, shortNum };
})();
if (typeof self !== 'undefined') self.PP_SOCIAL = PP_SOCIAL;

// 4.57 (Ben): where search tabs open. By default every search tab (Keep searching, Google Lens,
// Yandex, Bing, "checking owner") goes into one separate minimized "PageProof searching" window,
// so the main window stays clear. Settings can switch back to the old pinned tabs. The
// background worker owns that window; pages ask it for its number. null = use pinned tabs.
async function ppSearchPlaces() {
  if (typeof ppSearchWindowBg === 'function') { try { return { sw: await ppSearchWindowBg(), own: await ppOwnWindowBg() }; } catch (e) { return { sw: null, own: null }; } }
  const api = typeof browser !== 'undefined' ? browser : chrome;
  try { const r = await api.runtime.sendMessage({ type: 'ppSearchWin' }); return { sw: r && r.windowId != null ? r.windowId : null, own: r ? r.ownId : null }; } catch (e) { return { sw: null, own: null }; }
}
async function ppSearchWindow() { return (await ppSearchPlaces()).sw; }
// Opens a search tab in the searching window (or pinned, in fallback). Never in front of you.
// Safety net: if the browser pops the minimized window open when a tab is added (a test browser
// did, a normal one with a desktop did not), it is minimized again at once and your own window
// gets the focus back.
async function ppOpenSearchTab(url, fallbackWin) {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  const { sw, own } = await ppSearchPlaces();
  if (sw != null) {
    // Not being looked at (minimized, or left open behind your work): keep it minimized.
    let wasMin = false; try { const w0 = await api.windows.get(sw); wasMin = w0.state === 'minimized' || !w0.focused; } catch (e) { /* gone */ }
    try {
      const t = await api.tabs.create({ windowId: sw, url, active: false });
      if (wasMin) {
        // The browser can pop it open a moment later, so look again shortly after.
        const fix = async () => {
          try {
            const w = await api.windows.get(sw);
            if (w.state !== 'minimized' && (await api.tabs.get(t.id).catch(() => null))?.active !== true) {
              await api.windows.update(sw, { state: 'minimized' });
              if (own != null) await api.windows.update(own, { focused: true }).catch(() => {});
            }
          } catch (e) { /* gone */ }
        };
        await fix(); setTimeout(fix, 300); setTimeout(fix, 1200);
      }
      return t;
    } catch (e) { /* window just closed: pinned below */ }
  }
  const win = fallbackWin != null && fallbackWin !== sw ? fallbackWin : own;
  const opts = { url, active: false, ...(win != null ? { windowId: win } : {}) };
  try { return await api.tabs.create({ ...opts, pinned: true }); } catch (e) { return api.tabs.create(opts); }
}
// Brings a tab to the front, opening its window if it is minimized (the robot check, "Show me").
async function ppShowTab(tabId) {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  const t = await api.tabs.update(tabId, { active: true });
  let w = null; try { w = await api.windows.get(t.windowId); } catch (e) { /* gone */ }
  await api.windows.update(t.windowId, w && w.state === 'minimized' ? { state: 'normal', focused: true } : { focused: true });
  return t;
}
if (typeof self !== 'undefined') Object.assign(self, { ppSearchWindow, ppOpenSearchTab, ppShowTab });
