// Fills PageProof with a pretend library (NP photos, NC copies found) on a pretend Google Drive
// folder, so the checks have something to work on. No real photos or sites are used.
const { start } = require('./h.js');
const NP = +process.env.NP || 200000, NC = +process.env.NC || 15000;
exports.seed = async (page) => {
  return page.evaluate(async ({ NP, NC }) => {
    const root = await navigator.storage.getDirectory();
    const photosDir = await root.getDirectoryHandle('Photos', { create: true });
    await RS_DB.put('handles', 'fcRoot', photosDir);
    const docs = await root.getDirectoryHandle('PageProof', { create: true });
    await RS_DB.put('handles', 'docs', docs);
    await chrome.storage.local.set({ ppSetupDone: true, ppTourDone: true, ppSeenVersion: chrome.runtime.getManifest().version, fcDrive: { label: 'G:\\Shared drives\\Photos', done: true }, lastCase: { collector: 'Ben Tester' } });
    const clients = Array.from({ length: 30 }, (_, i) => 'Client ' + String.fromCharCode(65 + i % 26) + (i > 25 ? i : '') + ' Media');
    // a real small jpeg thumb ~8KB
    const c = new OffscreenCanvas(240, 160), x = c.getContext('2d');
    const mk = async seed => { for (let i = 0; i < 400; i++) { x.fillStyle = `hsl(${(seed * 37 + i * 13) % 360} 60% ${30 + (i * 7) % 50}%)`; x.fillRect((i * 53 + seed * 11) % 240, (i * 29) % 160, 40, 30); } const b = await c.convertToBlob({ type: 'image/jpeg', quality: 0.8 }); return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); };
    const thumbs = []; for (let i = 0; i < 12; i++) thumbs.push(await mk(i));
    for (const n of clients) { const d = await photosDir.getDirectoryHandle(n, { create: true }); await d.getDirectoryHandle('Registered images', { create: true }); }
    await FC.DB.putMany('clients', clients.map((name, i) => ({ name, folder: name, rel: name + '/Registered images', baseName: 'Registered images', pick: name, searching: i < 24, priority: i < 3, photos: Math.round(NP / 30), licensed: [] })));
    let batch = [];
    const ids = [];
    for (let i = 0; i < NP; i++) {
      const cl = clients[i % 30], year = 2015 + (i % 12), quarter = 1 + (i % 4);
      const rel = `${cl}/Registered images/${year}/Q${quarter} 1-1158392047${quarter}/IMG_${String(i).padStart(7, '0')}.jpg`;
      const p = { id: 'd:' + rel, client: cl, extra: false, rel, name: rel.split('/').pop(), folder: rel.slice(0, rel.lastIndexOf('/')), year, quarter, day: 0, flag: i % 997 === 0 ? 'hi' : i % 499 === 0 ? 'pop' : '', searches: i % 5 === 0 ? 1 : 0, empty: i % 50 === 0 ? 6 : 0, copies: 0, stolen: 0, added: 1, lastSearched: i % 5 === 0 ? new Date(Date.now() - (i % 400) * 86400000).toISOString() : undefined };
      p.order = FC.newness(p);
      if (i % 13 === 0) { ids.push(p.id); p.thumb = thumbs[i % 12]; p.w = 3000; p.h = 2000; p.hash = 'h' + i; p.look = (i * 2654435761 >>> 0).toString(16).padStart(8, '0') + ((i * 40503) >>> 0).toString(16).padStart(8, '0'); }
      batch.push(p);
      if (batch.length >= 5000) { await FC.DB.putMany('photos', batch); batch = []; }
    }
    await FC.DB.putMany('photos', batch); batch = [];
    const ends = ['com', 'com', 'com', 'net', 'org', 'xyz', 'ru', 'co.uk', 'de', 'shop', 'info'];
    const st = ['new', 'new', 'new', 'stolen', 'licensed', 'removed', 'new', 'stolen'];
    const sites = [];
    for (let i = 0; i < NC; i++) {
      const pid = ids[i % ids.length], site = (i % 7 === 0 ? 'news' + (i % 40) + '.' : '') + 'site' + (i % 3000) + (i % 9 === 0 ? '-daily-viral' : '') + '.' + ends[i % ends.length];
      const url = `https://${site}/story/${i}/a-long-article-title-goes-here`;
      const cp = { id: pid + '|' + site + '/story/' + i, photo: pid, client: pid.slice(2).split('/')[0], url, key: site + '/story/' + i, site, title: 'Article number ' + i + ' with a headline', thumb: thumbs[i % 12], img: `https://${i % 3 ? site : 'cdn.other.com'}/wp-content/uploads/IMG_${i}.jpg`, engines: ['google'], exact: i % 2 === 0,
        pct: 50 + (i % 50), inl: 30, tiles: 20, str: 0.9, mid: 0.5, match: i % 6 === 0 ? 'maybe' : 'same', w: 1200, h: 800, firstSeen: new Date(Date.now() - (i % 90) * 86400000).toISOString(), lastSeen: new Date().toISOString(), times: 1 + i % 3, by: 'Keep searching', status: st[i % st.length], online: i % 31 === 0 ? 'gone' : i % 211 === 0 ? 'back' : 'up' };
      cp.country = FC.countryOf(site); cp.use = FC.useOf(cp);
      batch.push(cp); sites.push(site);
      if (batch.length >= 2000) { await FC.DB.putMany('copies', batch); batch = []; }
    }
    await FC.DB.putMany('copies', batch);
    const uniq = [...new Set(sites)].slice(0, 2000);
    await FC.DB.putMany('sites', uniq.map((site, i) => ({ site, at: new Date().toISOString(), names: i % 4 === 0 ? ['Company ' + (i % 60) + ' LLC'] : [], emails: [], phones: [], social: [], ids: i % 10 === 0 ? ['G-ABCDEFG' + (i % 30 + 100)] : [], pages: [], clues: [{ kind: 'doc', title: 'Company name in the footer', value: '© Company ' + (i % 60), src: 'Home page' }], created: new Date(Date.now() - (i % 4000) * 86400000).toISOString(), domainHidden: i % 3 === 0 })));
    await chrome.storage.local.set({ rsHidden: Array.from({ length: 15000 }, (_, i) => 'hidden' + i + '.com') });
    return { photos: await FC.DB.count('photos'), copies: await FC.DB.count('copies') };
  }, { NP, NC });
};
