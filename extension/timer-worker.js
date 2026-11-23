// Clock for a running search. Browsers slow a hidden page's own timers down to about once a
// minute (and stop them while the window is minimized), which made a big search crawl or stall
// when its page was not on screen. Timers in a worker are not slowed down like that, so the
// search page asks this worker "wake me in N ms" and carries on when the answer comes back.
const timers = new Map();
onmessage = e => {
  const m = e.data || {};
  if (m.type === 'after') timers.set(m.id, setTimeout(() => { timers.delete(m.id); postMessage({ id: m.id }); }, Math.max(0, m.ms | 0)));
  else if (m.type === 'every') timers.set(m.id, setInterval(() => postMessage({ id: m.id }), Math.max(50, m.ms | 0)));
  else if (m.type === 'cancel') { const t = timers.get(m.id); clearTimeout(t); clearInterval(t); timers.delete(m.id); }
};
