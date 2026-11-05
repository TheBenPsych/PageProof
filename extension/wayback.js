// Asks the Internet Archive's Wayback Machine to archive the page ("Save Page Now")
// and waits for the public archive link. Uses your archive.org sign-in if you have one.
const PP_WAYBACK = (() => {
  const SAVE = 'https://web.archive.org/save';
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function start(url) {
    const res = await fetch(SAVE, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ url, capture_all: 'on' })
    });
    const text = await res.text();
    let job = null;
    try { job = JSON.parse(text).job_id || null; } catch (e) { /* not JSON */ }
    if (!job) { const m = /(spn2-[0-9a-f]{20,})/i.exec(text) || /watchJob\(["']([^"']+)["']/.exec(text); job = m && m[1]; }
    if (!job) {
      let why = 'HTTP ' + res.status;
      try { const j = JSON.parse(text); why = j.message || j.status_ext || why; } catch (e) { /* ignore */ }
      if (res.status === 429) why = 'the Archive is busy (too many saves). Try again in a few minutes';
      throw new Error(why);
    }
    return job;
  }

  // onUpdate receives { state: 'saving' | 'done' | 'failed', link?, timestamp?, error? }
  return async function save(url, onUpdate) {
    onUpdate({ state: 'saving' });
    try {
      const job = await start(url);
      const until = Date.now() + 4 * 60 * 1000;
      while (Date.now() < until) {
        await sleep(4000);
        let st;
        try {
          st = await (await fetch(SAVE + '/status/' + encodeURIComponent(job), { credentials: 'include', headers: { Accept: 'application/json' } })).json();
        } catch (e) { continue; }
        if (st.status === 'success') {
          const link = 'https://web.archive.org/web/' + st.timestamp + '/' + (st.original_url || url);
          const result = { state: 'done', link, timestamp: st.timestamp, job };
          onUpdate(result);
          return result;
        }
        if (st.status === 'error') throw new Error(st.message || st.status_ext || 'the Archive could not save this page');
      }
      throw new Error('the Archive took too long. It may still finish; check https://web.archive.org/web/*/' + url);
    } catch (e) {
      const result = { state: 'failed', error: String((e && e.message) || e) };
      onUpdate(result);
      return result;
    }
  };
})();
