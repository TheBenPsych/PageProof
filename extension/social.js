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
  const SITES = {
    'instagram.com': ['Instagram', 'IG', '#B0367C'], 'instagr.am': ['Instagram', 'IG', '#B0367C'],
    'tiktok.com': ['TikTok', 'TT', '#1F2430'], 'douyin.com': ['Douyin', 'DY', '#1F2430'],
    'facebook.com': ['Facebook', 'FB', '#2F5BD1'], 'fb.com': ['Facebook', 'FB', '#2F5BD1'], 'fb.watch': ['Facebook', 'FB', '#2F5BD1'], 'fb.me': ['Facebook', 'FB', '#2F5BD1'],
    'x.com': ['X', 'X', '#3B3F4A'], 'twitter.com': ['X', 'X', '#3B3F4A'], 't.co': ['X', 'X', '#3B3F4A'],
    'threads.net': ['Threads', 'TH', '#3B3F4A'], 'threads.com': ['Threads', 'TH', '#3B3F4A'],
    'youtube.com': ['YouTube', 'YT', '#C22222'], 'youtu.be': ['YouTube', 'YT', '#C22222'],
    'pinterest.com': ['Pinterest', 'PI', '#B8243A'], 'pin.it': ['Pinterest', 'PI', '#B8243A'],
    'reddit.com': ['Reddit', 'RD', '#C9471F'], 'redd.it': ['Reddit', 'RD', '#C9471F'],
    'tumblr.com': ['Tumblr', 'TU', '#34465D'], 'linkedin.com': ['LinkedIn', 'IN', '#0A66C2'], 'lnkd.in': ['LinkedIn', 'IN', '#0A66C2'],
    'snapchat.com': ['Snapchat', 'SC', '#8A7A00'], 't.me': ['Telegram', 'TG', '#1F7FB8'], 'telegram.me': ['Telegram', 'TG', '#1F7FB8'], 'telegram.org': ['Telegram', 'TG', '#1F7FB8'],
    'vk.com': ['VK', 'VK', '#2A5D99'], 'vk.ru': ['VK', 'VK', '#2A5D99'], 'ok.ru': ['OK', 'OK', '#C76A00'],
    'weibo.com': ['Weibo', 'WB', '#C0302B'], 'weibo.cn': ['Weibo', 'WB', '#C0302B'], 'xiaohongshu.com': ['Xiaohongshu', 'XH', '#C0303F'], 'xhslink.com': ['Xiaohongshu', 'XH', '#C0303F'],
    'bilibili.com': ['Bilibili', 'BI', '#1E7FB0'], 'b23.tv': ['Bilibili', 'BI', '#1E7FB0'], 'zhihu.com': ['Zhihu', 'ZH', '#1764C2'], 'lofter.com': ['Lofter', 'LO', '#3E6E5E'],
    'bsky.app': ['Bluesky', 'BS', '#1866C9'], 'mastodon.social': ['Mastodon', 'MA', '#5B49C9'], 'mstdn.social': ['Mastodon', 'MA', '#5B49C9'], 'mastodon.online': ['Mastodon', 'MA', '#5B49C9'],
    'pixelfed.social': ['Pixelfed', 'PF', '#5B49C9'], 'misskey.io': ['Misskey', 'MI', '#4F7A1F'], 'lemmy.world': ['Lemmy', 'LE', '#3E6E5E'],
    'truthsocial.com': ['Truth Social', 'TS', '#3F4FA8'], 'gab.com': ['Gab', 'GB', '#2F7D3F'], 'gettr.com': ['Gettr', 'GE', '#B3261E'], 'parler.com': ['Parler', 'PA', '#B3261E'], 'minds.com': ['Minds', 'MN', '#3F4FA8'], 'mewe.com': ['MeWe', 'MW', '#1F6FB8'],
    'quora.com': ['Quora', 'QU', '#A82400'], 'flickr.com': ['Flickr', 'FL', '#C2185B'], 'flic.kr': ['Flickr', 'FL', '#C2185B'], 'deviantart.com': ['DeviantArt', 'DA', '#2E7D5B'],
    'behance.net': ['Behance', 'BE', '#1F4FCF'], '500px.com': ['500px', '5P', '#2A2F3A'], 'imgur.com': ['Imgur', 'IM', '#2E7D3F'], '9gag.com': ['9GAG', '9G', '#2A2F3A'],
    'vimeo.com': ['Vimeo', 'VI', '#1A7FB0'], 'dailymotion.com': ['Dailymotion', 'DM', '#1F4FCF'], 'twitch.tv': ['Twitch', 'TW', '#6B3FC9'], 'rumble.com': ['Rumble', 'RU', '#4F7A1F'], 'odysee.com': ['Odysee', 'OD', '#B3261E'],
    'vsco.co': ['VSCO', 'VS', '#2A2F3A'], 'lemon8-app.com': ['Lemon8', 'L8', '#6E7A00'], 'likee.video': ['Likee', 'LK', '#B3267C'], 'kwai.com': ['Kwai', 'KW', '#C76A00'], 'snackvideo.com': ['Snack Video', 'SV', '#8A7A00'],
    'triller.co': ['Triller', 'TR', '#2A2F3A'], 'weheartit.com': ['We Heart It', 'WH', '#B3267C'], 'pixiv.net': ['Pixiv', 'PX', '#1F6FB8'], 'artstation.com': ['ArtStation', 'AS', '#1F6FB8'], 'dribbble.com': ['Dribbble', 'DR', '#B3267C'],
    'tapatalk.com': ['Tapatalk', 'TA', '#2A2F3A'], 'myspace.com': ['Myspace', 'MS', '#2A2F3A'], 'ask.fm': ['ASKfm', 'AF', '#B3261E'], 'nextdoor.com': ['Nextdoor', 'ND', '#2E7D3F'],
    'livejournal.com': ['LiveJournal', 'LJ', '#1F5F8B'], 'ameblo.jp': ['Ameba', 'AM', '#2E7D3F'], 'note.com': ['note', 'NO', '#2A2F3A'], 'plurk.com': ['Plurk', 'PL', '#B3261E'], 'vero.co': ['VERO', 'VE', '#1F6FB8'],
    'cara.app': ['Cara', 'CA', '#2A2F3A'], 'patreon.com': ['Patreon', 'PT', '#B3261E'], 'onlyfans.com': ['OnlyFans', 'OF', '#1F7FB8'], 'fansly.com': ['Fansly', 'FA', '#1F7FB8'], 'substack.com': ['Substack', 'SS', '#C76A00'],
    'medium.com': ['Medium', 'ME', '#2A2F3A'], 'steemit.com': ['Steemit', 'ST', '#1F6FB8'], 'hive.blog': ['Hive', 'HV', '#B3261E'], 'spoutible.com': ['Spoutible', 'SP', '#1F6FB8'], 'post.news': ['Post', 'PN', '#2A2F3A'],
    'whatsapp.com': ['WhatsApp', 'WA', '#2E7D3F'], 'line.me': ['LINE', 'LN', '#2E7D3F'], 'discord.com': ['Discord', 'DC', '#4F5BD5'], 'story.kakao.com': ['KakaoStory', 'KS', '#8A7A00'], 'blog.naver.com': ['Naver Blog', 'NB', '#2E7D3F'],
  };
  // Pinterest and others have one site per country (pinterest.co.uk, pinterest.de).
  const SITE_RX = [[/(^|\.)pinterest\.[a-z.]+$/, 'pinterest.com'], [/(^|\.)tumblr\.com$/, 'tumblr.com'], [/(^|\.)substack\.com$/, 'substack.com'], [/(^|\.)livejournal\.com$/, 'livejournal.com'], [/(^|\.)deviantart\.com$/, 'deviantart.com']];
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
  // Is this site social? Your own choice wins, then the built-in list.
  function isSocial(site) { const m = mineFor(site); return m ? m === 'social' : !!listed(site); }
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
      case 'reddit.com':
        if ((seg[0] === 'user' || seg[0] === 'u') && seg[1]) return mk('reddit.com', 'u/' + seg[1], 'https://www.reddit.com/user/' + seg[1] + '/', '', 'user/' + seg[1]);
        if (seg[0] === 'r' && seg[1]) return mk('reddit.com', 'r/' + seg[1], 'https://www.reddit.com/r/' + seg[1] + '/', 'community');
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
        if (d === 'twitch.tv' && okName(seg[0])) return mk('twitch.tv', seg[0], 'https://www.twitch.tv/' + seg[0]);
        if (d === 'dailymotion.com' && okName(seg[0]) && seg[0] !== 'video') return mk('dailymotion.com', seg[0], 'https://www.dailymotion.com/' + seg[0]);
        if (d === 'imgur.com' && seg[0] === 'user' && seg[1]) return mk('imgur.com', seg[1], 'https://imgur.com/user/' + seg[1]);
        if (d === 'rumble.com' && (seg[0] === 'c' || seg[0] === 'user') && seg[1]) return mk('rumble.com', seg[0] + '/' + seg[1], 'https://rumble.com/' + seg[0] + '/' + seg[1]);
        return null;
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
    'reddit.com': u => 'https://www.reddit.com/oembed?url=' + encodeURIComponent(u),
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
  function askFor(c) {
    if (!c || !c.site || listed(c.site) || mineFor(c.site)) return '';
    return shapeOf(c.url) || pageSigns(c.pf && c.pf.soc);
  }
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

  return { SITES, ready, listed, isSocial, platform, postKind, fromUrl, fromTyped, isShort, unshort, publicInfo, hasPublic: url => !!OEMBED[listed(host(url))], fromTags, shapeOf, pageSigns, askFor, setMine, mine: () => mine, mineFor, ELSEWHERE, plainName, bareName, host };
})();
if (typeof self !== 'undefined') self.PP_SOCIAL = PP_SOCIAL;
