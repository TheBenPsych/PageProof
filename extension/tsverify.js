// Checks a trusted timestamp receipt (.tsr) inside the browser:
//  1. the receipt is about this exact fingerprint list,
//  2. the receipt's contents weren't altered,
//  3. the digital signature is valid for the certificate inside the receipt.
// (Checking that certificate against the service's official root is done with openssl; see VERIFYING.md.)
const PP_TSVERIFY = (() => {
  // --- A tiny reader for DER (the binary format these receipts use) ---
  function parse(bytes, pos = 0) {
    const tag = bytes[pos];
    let len = bytes[pos + 1], hdr = 2;
    if (len & 0x80) {
      const n = len & 0x7f;
      len = 0;
      for (let i = 0; i < n; i++) len = len * 256 + bytes[pos + 2 + i];
      hdr = 2 + n;
    }
    const start = pos + hdr, end = start + len;
    const node = { tag, start: pos, bodyStart: start, end, bytes, body: bytes.subarray(start, end), raw: bytes.subarray(pos, end), kids: [] };
    if (tag & 0x20) { // constructed: read the children
      let p = start;
      while (p < end) { const k = parse(bytes, p); node.kids.push(k); p = k.end; }
    }
    return node;
  }
  const oid = node => {
    const b = node.body, parts = [Math.floor(b[0] / 40), b[0] % 40];
    let v = 0;
    for (let i = 1; i < b.length; i++) { v = v * 128 + (b[i] & 0x7f); if (!(b[i] & 0x80)) { parts.push(v); v = 0; } }
    return parts.join('.');
  };
  const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const HASH = { '2.16.840.1.101.3.4.2.1': 'SHA-256', '2.16.840.1.101.3.4.2.2': 'SHA-384', '2.16.840.1.101.3.4.2.3': 'SHA-512', '1.3.14.3.2.26': 'SHA-1' };
  const SIG_HASH = { '1.2.840.113549.1.1.11': 'SHA-256', '1.2.840.113549.1.1.12': 'SHA-384', '1.2.840.113549.1.1.13': 'SHA-512', '1.2.840.113549.1.1.5': 'SHA-1',
    '1.2.840.10045.4.3.2': 'SHA-256', '1.2.840.10045.4.3.3': 'SHA-384', '1.2.840.10045.4.3.4': 'SHA-512' };
  const CURVES = { '1.2.840.10045.3.1.7': 'P-256', '1.3.132.0.34': 'P-384', '1.3.132.0.35': 'P-521' };

  function nameOf(nameNode) {
    // Pull the readable "CN" (and O) out of a certificate name.
    const out = {};
    for (const rdn of nameNode.kids) for (const atv of rdn.kids) {
      const k = oid(atv.kids[0]);
      const v = new TextDecoder().decode(atv.kids[1].body);
      if (k === '2.5.4.3') out.CN = v;
      if (k === '2.5.4.10') out.O = v;
    }
    return out.CN || out.O || '(unnamed)';
  }

  function ecdsaToRaw(sig, size) {
    const seq = parse(sig);
    const fix = b => { let x = b; while (x.length > size && x[0] === 0) x = x.subarray(1); const o = new Uint8Array(size); o.set(x, size - x.length); return o; };
    const r = fix(seq.kids[0].body), s = fix(seq.kids[1].body);
    const out = new Uint8Array(size * 2); out.set(r); out.set(s, size); return out;
  }

  async function verifySig(cert, signedAttrs, sig, sigAlg, digestName) {
    const tbs = cert.kids[0];
    const fields = tbs.kids[0].tag === 0xa0 ? tbs.kids.slice(1) : tbs.kids;
    const spki = fields[5];
    const keyAlg = oid(spki.kids[0].kids[0]);
    const hash = SIG_HASH[sigAlg] || digestName;
    if (keyAlg === '1.2.840.113549.1.1.1') {
      const key = await crypto.subtle.importKey('spki', spki.raw, { name: 'RSASSA-PKCS1-v1_5', hash }, false, ['verify']);
      return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, signedAttrs);
    }
    if (keyAlg === '1.2.840.10045.2.1') {
      const curve = CURVES[oid(spki.kids[0].kids[1])];
      const size = { 'P-256': 32, 'P-384': 48, 'P-521': 66 }[curve];
      const key = await crypto.subtle.importKey('spki', spki.raw, { name: 'ECDSA', namedCurve: curve }, false, ['verify']);
      return crypto.subtle.verify({ name: 'ECDSA', hash }, key, ecdsaToRaw(sig, size), signedAttrs);
    }
    return false;
  }

  // tsr: Uint8Array receipt. data: Uint8Array of fingerprints.sha256.
  return async function verify(tsr, data) {
    const resp = parse(tsr);
    const status = resp.kids[0].kids[0].body[0];
    if (status > 1) return { ok: false, problem: 'The receipt says the service refused the request.' };
    const signedData = resp.kids[1].kids[1].kids[0];
    const sd = signedData.kids;
    const encap = sd.find(k => k.tag === 0x30 && k.kids[0] && k.kids[0].tag === 0x06);
    const tstDer = encap.kids[1].kids[0].body;
    const tst = parse(tstDer);
    const imprint = tst.kids[2];
    const impHash = HASH[oid(imprint.kids[0].kids[0])];
    const genTime = new TextDecoder().decode(tst.kids.find(k => k.tag === 0x18).body);
    const time = genTime.replace(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\.\d+)?Z$/, '$1-$2-$3 $4:$5:$6 UTC');

    // 1. Is the receipt about this exact fingerprint list?
    const ours = new Uint8Array(await crypto.subtle.digest(impHash || 'SHA-256', data));
    if (!eq([...ours], [...imprint.kids[1].body])) {
      return { ok: false, time, problem: 'The fingerprint list does not match this receipt. fingerprints.sha256 has been changed.' };
    }

    // 2. Were the receipt's contents altered?
    const certSet = sd.find(k => k.tag === 0xa0);
    const certs = certSet ? certSet.kids : [];
    const signerInfo = sd[sd.length - 1].kids[0];
    const si = signerInfo.kids;
    const digestName = HASH[oid(si[2].kids[0])] || 'SHA-256';
    const attrsNode = si.find(k => k.tag === 0xa0);
    let digestOk = false;
    for (const attr of attrsNode.kids) {
      if (oid(attr.kids[0]) === '1.2.840.113549.1.9.4') {
        const want = attr.kids[1].kids[0].body;
        const have = new Uint8Array(await crypto.subtle.digest(digestName, tstDer));
        digestOk = eq([...have], [...want]);
      }
    }
    if (!digestOk) return { ok: false, time, problem: 'The receipt has been altered (its contents no longer match its signature).' };

    // 3. Is the signature valid?
    const signed = new Uint8Array(attrsNode.raw); signed[0] = 0x31; // signed as a SET
    const sigAlgNode = si[si.indexOf(attrsNode) + 1];
    const sig = si[si.indexOf(attrsNode) + 2].body;
    for (const cert of certs) {
      try {
        if (await verifySig(cert, signed, sig, oid(sigAlgNode.kids[0]), digestName)) {
          const tbs = cert.kids[0];
          const f = tbs.kids[0].tag === 0xa0 ? tbs.kids.slice(1) : tbs.kids;
          return { ok: true, time, signer: nameOf(f[4]), issuer: nameOf(f[2]) };
        }
      } catch (e) { /* try the next certificate */ }
    }
    return { ok: false, time, problem: 'The digital signature on the receipt could not be confirmed.' };
  };
})();
