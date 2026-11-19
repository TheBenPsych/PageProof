// Turns the saved page HTML into one self-contained file: every picture, style
// sheet and font is downloaded and packed inside, so it still works if the
// website later removes them. Also collects the original image files.
const PP_ARCHIVE = (() => {
  const MAX_FILES = 500;
  const MAX_FILE_BYTES = 25e6;
  const MAX_TOTAL_BYTES = 250e6;
  const TIMEOUT_MS = 20000;

  function toDataUrl(bytes, type) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return 'data:' + (type || 'application/octet-stream') + ';base64,' + btoa(bin);
  }

  return async function archive(rec, onProgress) {
    // The page's own inline code (onclick="...", onload="...") is renamed while PageProof works
    // on the copy, so Chrome does not log "inline event handler blocked" errors, then put back
    // exactly as it was. Nothing from the page ever runs here.
    const MARK = { on: 'data-pp-was-on-', On: 'data-pp-was-up-on-', ON: 'data-pp-was-upup-on-', oN: 'data-pp-was-onup-' };
    const doc = new DOMParser().parseFromString(rec.html.replace(/(\s)(on)([a-z]+\s*=)/gi, (m, sp, on, rest) => sp + MARK[on] + rest), 'text/html');
    const putBack = html => Object.entries(MARK).reduce((t, [on, mark]) => t.split(mark).join(on), html);
    const cache = new Map();
    const images = [];       // { url, bytes, type } for the evidence folder
    const failed = new Set();
    let total = 0, count = 0;

    const abs = (u, base) => { try { return new URL(u, base).href; } catch (e) { return null; } };
    const skip = u => !u || /^(data|blob|javascript|about|mailto):/i.test(u) || u.startsWith('#');

    function fetchFile(url) {
      if (cache.has(url)) return cache.get(url);
      const job = (async () => {
        if (count >= MAX_FILES || total >= MAX_TOTAL_BYTES) { failed.add(url); return null; }
        count++;
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
        try {
          const res = await fetch(url, { signal: ctl.signal, credentials: 'include', cache: 'force-cache' });
          if (!res.ok) throw new Error(res.status);
          const bytes = new Uint8Array(await res.arrayBuffer());
          if (bytes.length > MAX_FILE_BYTES) throw new Error('too big');
          total += bytes.length;
          onProgress && onProgress(count);
          return { bytes, type: (res.headers.get('content-type') || '').split(';')[0].trim() };
        } catch (e) {
          failed.add(url);
          return null;
        } finally {
          clearTimeout(timer);
        }
      })();
      cache.set(url, job);
      return job;
    }

    async function inlineUrl(u, base, isImage) {
      if (skip(u)) return u;
      const url = abs(u, base);
      if (!url) return u;
      const f = await fetchFile(url);
      if (!f) return url;
      if (isImage && !images.some(i => i.url === url)) images.push({ url, ...f });
      return toDataUrl(f.bytes, f.type);
    }

    async function inlineCss(css, base, depth = 0) {
      // Pull in @import'ed style sheets.
      const imports = [...css.matchAll(/@import\s+(?:url\()?\s*['"]?([^'")\s;]+)['"]?\s*\)?([^;]*);/gi)];
      for (const m of imports) {
        const url = abs(m[1], base);
        const f = depth < 3 && url ? await fetchFile(url) : null;
        const text = f ? await inlineCss(new TextDecoder().decode(f.bytes), url, depth + 1) : '';
        css = css.replace(m[0], text ? (m[2].trim() ? '@media ' + m[2].trim() + '{' + text + '}' : text) : '');
      }
      const refs = [...new Set([...css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)].map(m => m[2].trim()))];
      const done = await Promise.all(refs.map(r => inlineUrl(r, base, false)));
      const map = new Map(refs.map((r, i) => [r, done[i]]));
      return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, u) => map.has(u.trim()) ? 'url("' + map.get(u.trim()) + '")' : m);
    }

    const jobs = [];
    const base = rec.url;

    doc.querySelectorAll('img[src], input[type=image][src]').forEach(el =>
      jobs.push(inlineUrl(el.getAttribute('src'), base, true).then(v => el.setAttribute('src', v))));
    doc.querySelectorAll('video[poster]').forEach(el =>
      jobs.push(inlineUrl(el.getAttribute('poster'), base, true).then(v => el.setAttribute('poster', v))));
    doc.querySelectorAll('link[rel~=icon][href]').forEach(el =>
      jobs.push(inlineUrl(el.getAttribute('href'), base, false).then(v => el.setAttribute('href', v))));
    doc.querySelectorAll('[style*="url("]').forEach(el =>
      jobs.push(inlineCss(el.getAttribute('style'), base).then(v => el.setAttribute('style', v))));
    doc.querySelectorAll('style').forEach(el =>
      jobs.push(inlineCss(el.textContent, base).then(v => { el.textContent = v; })));
    doc.querySelectorAll('link[rel~=stylesheet][href]').forEach(el => {
      const url = abs(el.getAttribute('href'), base);
      jobs.push((async () => {
        const f = url && await fetchFile(url);
        if (!f) return;
        const style = doc.createElement('style');
        if (el.media) style.media = el.media;
        style.textContent = await inlineCss(new TextDecoder().decode(f.bytes), url);
        el.replaceWith(style);
      })());
    });
    // Leftover pre-load hints would only point back at the live site.
    doc.querySelectorAll('link[rel~=preload], link[rel~=prefetch], link[rel~=modulepreload]').forEach(el => el.remove());

    await Promise.all(jobs);

    const header = '<!DOCTYPE html>\n<!-- Saved by PageProof ' + rec.version + ' from ' + rec.url +
      ' at ' + rec.time + ' (UTC). Pictures, styles and fonts are stored inside this file. -->\n';
    return {
      html: header + putBack(doc.documentElement.outerHTML),
      images,
      failed: [...failed]
    };
  };
})();
