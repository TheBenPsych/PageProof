// Reads the files out of a .zip (stored or normally compressed). No outside libraries.
async function ppUnzip(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error('This is not a zip file, or it is damaged.');
  const count = dv.getUint16(end + 10, true);
  let p = dv.getUint32(end + 16, true);
  const files = new Map();
  const dec = new TextDecoder();
  for (let k = 0; k < count; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('The zip file is damaged.');
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue;
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const raw = bytes.subarray(start, start + csize);
    let data;
    if (method === 0) data = raw;
    else if (method === 8) {
      const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      data = new Uint8Array(await new Response(stream).arrayBuffer());
    } else throw new Error('This zip uses a compression type PageProof cannot read (' + method + ').');
    files.set(name, data);
  }
  // If someone re-zipped the unzipped folder, the files may sit inside one top folder.
  const names = [...files.keys()];
  if (!names.includes('fingerprints.sha256')) {
    const hit = names.find(n => n.endsWith('/fingerprints.sha256'));
    if (hit) {
      const prefix = hit.slice(0, -'fingerprints.sha256'.length);
      const moved = new Map();
      for (const [n, d] of files) moved.set(n.startsWith(prefix) ? n.slice(prefix.length) : n, d);
      return moved;
    }
  }
  return files;
}
