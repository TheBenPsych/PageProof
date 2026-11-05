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
      const res = await fetch(svc.url, { method: 'POST', body: query, signal: ctl.signal,
        headers: { 'Content-Type': 'application/timestamp-query' } });
      clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const reply = new Uint8Array(await res.arrayBuffer());
      const { time } = readReply(reply);
      return { service: svc.name, file: svc.file || svc.name.toLowerCase(), url: svc.url, time, query, reply };
    } catch (e) {
      return { service: svc.name, url: svc.url, error: String((e && e.message) || e) };
    }
  }

  // Returns one result per service: { service, url, time, query, reply } or { service, url, error }.
  async function stampAll(hash) {
    return Promise.all((globalThis.PP_TSA_SERVICES || SERVICES).map(svc => stampOne(svc, hash)));
  }

  return { stampAll, readReply };
})();
