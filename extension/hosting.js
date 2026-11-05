// "Who hosts this site?": looks up public registration records (RDAP, the official
// replacement for WHOIS) for the website's domain and its server's IP address.
// Gives the hosting company, the domain registrar, and their abuse contacts,
// which is who a DMCA takedown notice goes to.
const PP_HOSTING = (() => {
  const RDAP = 'https://rdap.org';
  // Common two-part endings, so "shop.example.co.uk" is looked up as "example.co.uk".
  const TWO_PART = /\.(co|com|net|org|gov|edu|ac|ltd|plc|me|or|ne|go)\.[a-z]{2}$/i;

  function registrable(host) {
    const parts = host.toLowerCase().replace(/\.$/, '').split('.');
    if (parts.length <= 2) return parts.join('.');
    return parts.slice(TWO_PART.test(host) ? -3 : -2).join('.');
  }

  async function get(url) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20000);
    try {
      const res = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/rdap+json, application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      return { text, json: JSON.parse(text) };
    } finally {
      clearTimeout(timer);
    }
  }

  // Read a name and emails out of an RDAP "entity" (vCard format).
  function card(entity) {
    const out = { name: '', emails: [], phones: [] };
    const v = entity && entity.vcardArray && entity.vcardArray[1];
    for (const f of v || []) {
      if (f[0] === 'fn' && !out.name) out.name = String(f[3]);
      if (f[0] === 'org' && !out.name) out.name = String(f[3]);
      if (f[0] === 'email') out.emails.push(String(f[3]));
      if (f[0] === 'tel') out.phones.push(String(f[3]).replace(/^tel:/, ''));
    }
    return out;
  }

  function findRole(entities, role, depth = 0) {
    for (const e of entities || []) {
      if ((e.roles || []).includes(role)) return e;
      if (depth < 3) { const inner = findRole(e.entities, role, depth + 1); if (inner) return inner; }
    }
    return null;
  }

  const event = (j, action) => ((j.events || []).find(e => e.eventAction === action) || {}).eventDate || '';

  return async function lookup(url, ip) {
    const result = { files: [] };
    let host = '';
    try { host = new URL(url).hostname; } catch (e) { /* ignore */ }

    if (host && !/^[\d.]+$|:/.test(host)) {
      const domain = registrable(host);
      try {
        const { text, json } = await get(RDAP + '/domain/' + encodeURIComponent(domain));
        const reg = findRole(json.entities, 'registrar');
        const regAbuse = reg && findRole(reg.entities, 'abuse');
        const registrant = findRole(json.entities, 'registrant');
        result.domain = {
          name: domain,
          registrar: reg ? card(reg).name : '',
          registrarAbuse: regAbuse ? card(regAbuse) : null,
          registrant: registrant ? card(registrant).name : '',
          created: event(json, 'registration'),
          expires: event(json, 'expiration'),
          nameservers: (json.nameservers || []).map(n => (n.ldhName || '').toLowerCase()).filter(Boolean)
        };
        result.files.push({ name: 'lookups/domain-' + domain + '.rdap.json', text });
      } catch (e) {
        result.domainError = domain + ': ' + e.message;
      }
    }

    if (ip) {
      try {
        // rdap.org sends us to the right regional registry; ARIN's server is the backup.
        let r;
        try { r = await get(RDAP + '/ip/' + ip); } catch (e) { r = await get('https://rdap.arin.net/registry/ip/' + ip); }
        const { text, json } = r;
        const holder = findRole(json.entities, 'registrant') || findRole(json.entities, 'administrative') || (json.entities || [])[0];
        const abuse = findRole(json.entities, 'abuse');
        result.ip = {
          address: ip,
          network: json.name || '',
          range: json.startAddress && json.endAddress ? json.startAddress + ' - ' + json.endAddress : (json.handle || ''),
          country: json.country || '',
          host: holder ? card(holder).name : '',
          abuse: abuse ? card(abuse) : null
        };
        result.files.push({ name: 'lookups/ip-' + ip.replace(/:/g, '-') + '.rdap.json', text });
      } catch (e) {
        result.ipError = ip + ': ' + e.message;
      }
    }

    // Many sites hide their real host behind a protection/CDN service.
    const who = ((result.ip && (result.ip.host + ' ' + result.ip.network)) || '').toLowerCase();
    const cdn = ['cloudflare', 'akamai', 'fastly', 'amazon', 'google', 'microsoft', 'sucuri', 'incapsula', 'imperva']
      .find(c => who.includes(c) || (result.domain && result.domain.nameservers.join(' ').includes(c)));
    if (cdn === 'cloudflare') result.note = 'This site uses Cloudflare, which hides the real hosting company. Cloudflare\'s abuse form (https://abuse.cloudflare.com) forwards copyright complaints to the real host and can reveal it to you.';
    else if (cdn) result.note = 'The server belongs to a large network or cloud provider (' + cdn + '). The site owner rents space there; send notices to that provider\'s abuse contact.';
    return result;
  };
})();
