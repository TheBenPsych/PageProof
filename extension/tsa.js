// Trusted timestamp (RFC 3161). Sends ONLY a SHA-256 fingerprint to a free public
// timestamp service, which signs it with its clock time. The signed receipt (.tsr)
// is kept in the evidence pack, so the service doesn't need to store anything.
const PP_TSA = (() => {
  // Every pack is stamped by all of these at once, so the proof never rests on one company.
  const SERVICES = [
    { name: 'DigiCert', file: 'digicert', url: 'http://timestamp.digicert.com' },
    { name: 'Sectigo', file: 'sectigo', url: 'http://timestamp.sectigo.com' },
    { name: 'FreeTSA', file: 'freetsa', url: 'https://freetsa.org/tsr' }
  ];
  // Spares (4.39, Ben's pick): asked only when one of the three above still has no answer after
  // two more tries, so a pack is not left with fewer stamps because one service was slow.
  const SPARES = [
    { name: 'GlobalSign', file: 'globalsign', url: 'http://timestamp.globalsign.com/tsa/r6advanced1' },
    { name: 'Entrust', file: 'entrust', url: 'http://timestamp.entrust.net/TSS/RFC3161sha2TS' }
  ];
  const wait = ms => new Promise(r => setTimeout(r, ms));

  const concat = arrs => {
    const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
    let o = 0;
    for (const a of arrs) { out.set(a, o); o += a.length; }
    return out;
  };
  const tlv = (tag, body) => {
    const n = body.length;
    const len = n < 128 ? [n] : n < 256 ? [0x81, n] : [0x82, n >> 8, n & 255];
    return concat([new Uint8Array([tag, ...len]), body]);
  };
  const seq = (...parts) => tlv(0x30, concat(parts));

  function makeQuery(hash) {
    const nonce = crypto.getRandomValues(new Uint8Array(8));
    nonce[0] = (nonce[0] & 0x7f) | 0x01; // keep it a positive number
    const sha256 = new Uint8Array([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00]);
    return seq(
      new Uint8Array([0x02, 0x01, 0x01]),        // version 1
      seq(seq(sha256), tlv(0x04, hash)),         // the fingerprint
      tlv(0x02, nonce),                          // random number to prevent replay
      new Uint8Array([0x01, 0x01, 0xff])         // include the service's certificate
    );
  }

  // Read the result code and the signed time out of the reply.
  function readReply(bytes) {
    const len = i => {
      const b = bytes[i + 1];
      if (b < 128) return [b, 2];
      const k = b & 127;
      let n = 0;
      for (let j = 0; j < k; j++) n = n * 256 + bytes[i + 2 + j];
      return [n, 2 + k];
    };
    if (bytes[0] !== 0x30) throw new Error('not a timestamp reply');
    let i = len(0)[1];                 // inside TimeStampResp
    if (bytes[i] !== 0x30) throw new Error('bad reply');
    i += len(i)[1];                    // inside PKIStatusInfo
    if (bytes[i] !== 0x02) throw new Error('bad reply');
    const status = bytes[i + 2];
    if (status > 1) throw new Error('the service refused (status ' + status + ')');
    // The first GeneralizedTime in the token is the signed time (genTime).
    for (let j = i; j < bytes.length - 17; j++) {
      if (bytes[j] === 0x18 && bytes[j + 1] >= 15 && bytes[j + 1] <= 23) {
        const t = new TextDecoder().decode(bytes.subarray(j + 2, j + 2 + bytes[j + 1]));
        const m = /^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\.\d+)?Z$/.exec(t);
        if (m) return { time: m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5] + ':' + m[6] + (m[7] || '') + 'Z' };
      }
    }
    return { time: null };
  }

  async function stampOne(svc, hash) {
    const query = makeQuery(hash);
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 25000);
      const t0 = Date.now();
      const res = await fetch(svc.url, { method: 'POST', body: query, signal: ctl.signal,
        headers: { 'Content-Type': 'application/timestamp-query' } });
      clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const reply = new Uint8Array(await res.arrayBuffer());
      const t1 = Date.now();
      const { time } = readReply(reply);
      // askedAt: this computer's clock halfway through the request, to compare with the signed time.
      return { service: svc.name, file: svc.file || svc.name.toLowerCase(), url: svc.url, time, query, reply, askedAt: Math.round((t0 + t1) / 2), rtt: t1 - t0 };
    } catch (e) {
      return { service: svc.name, url: svc.url, error: String((e && e.message) || e) };
    }
  }

  // Returns one result per service: { service, url, time, query, reply, tries } or { service, url, error }.
  // A service that doesn't answer is asked again twice (after 3 and 8 seconds). If one still has
  // no answer, the spare services are asked, one by one, until there are as many stamps as
  // services (4.39). Failed services stay in the list with their error, so the pack says which.
  async function stampAll(hash) {
    const main = globalThis.PP_TSA_SERVICES || SERVICES;
    const spares = globalThis.PP_TSA_SPARES || (globalThis.PP_TSA_SERVICES ? [] : SPARES);
    const gaps = globalThis.PP_TSA_WAITS || [3000, 8000];
    const once = async svc => {
      let r;
      for (let i = 0; i <= gaps.length; i++) {
        if (i) await wait(gaps[i - 1]);
        r = await stampOne(svc, hash);
        r.tries = i + 1;
        if (!r.error) break;
      }
      return r;
    };
    const out = await Promise.all(main.map(once));
    let good = out.filter(t => !t.error).length;
    for (const svc of spares) {
      if (good >= main.length) break;
      const r = await once(svc);
      r.spare = true;
      out.push(r);
      if (!r.error) good++;
    }
    if (typeof PP_STATS !== 'undefined') { PP_STATS.add('tsa.packs'); for (const t of out) PP_STATS.add('tsa.' + (t.error ? 'fail' : t.tries > 1 ? 'retryOk' : 'ok')); if (out.some(t => t.spare && !t.error)) PP_STATS.add('tsa.spareUsed'); }
    return out;
  }

  return { stampAll, readReply };
})();
