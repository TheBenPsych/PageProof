// Small shared pieces for the tool pages in the calm look (Inspect, Compare, Mark up, Convert,
// Verify): a DOM builder, the line icons, the coloured squares and buttons, the page title, the
// big drop card and the "Opened lately" card. Tool pages run inside the PageProof app's frame, or
// in a tab of their own; "Opened lately" only shows inside the app, which keeps that list.
const TK = (() => {
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k in el && k !== 'list' && k !== 'form') el[k] = v;
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  }
  const P = {
    inspect: '<rect x="1.5" y="2.5" width="10" height="8" rx="1"/><path d="m2.5 9 2.5-2.5 2 2 1.5-1.5 2 2"/><circle cx="11.5" cy="11.5" r="2.6"/><path d="m13.4 13.4 1.4 1.4"/>',
    compare: '<rect x="1.8" y="3.5" width="8" height="8" rx="1"/><rect x="6.2" y="4.5" width="8" height="8" rx="1"/>',
    markup: '<path d="M10.5 2.5l3 3L6 13H3v-3z"/><path d="M9 4l3 3"/>',
    convert: '<path d="M2.5 5.5h10l-2.5-2.5M13.5 10.5h-10l2.5 2.5"/>',
    open: '<path d="M4 1.8h5.5L12.5 5v9.2H4z"/><path d="M9.5 1.8V5h3"/><path d="M6 9.5h4M8 7.5v4"/>',
    verify: '<path d="M8 1.6 13.2 3.5v4c0 3.2-2.2 5.6-5.2 6.9C5 13.1 2.8 10.7 2.8 7.5v-4z"/><path d="m5.6 8 1.7 1.7 3.2-3.4"/>',
    up: '<path d="M8 10.5V2.5M5 5.5l3-3 3 3"/><path d="M2.5 10v2.8a.7.7 0 0 0 .7.7h9.6a.7.7 0 0 0 .7-.7V10"/>',
    file: '<path d="M4 1.8h5.5L12.5 5v9.2H4z"/><path d="M9.5 1.8V5h3"/>',
    folder: '<path d="M1.8 4.2a1 1 0 0 1 1-1h3.4l1.5 1.6h5.5a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1z"/>',
    save: '<path d="M8 2.5v8M4.5 7.5 8 11l3.5-3.5M3 13.5h10"/>',
    pdf: '<path d="M4 1.8h5.5L12.5 5v9.2H4z"/><path d="M9.5 1.8V5h3M6 9h4.5M6 11.5h3"/>',
    copy: '<rect x="2" y="4.5" width="8" height="9" rx="1"/><path d="M5 4.5V3a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-3"/>',
    cam: '<path d="M2 5.2h2.6L6 3.5h4l1.4 1.7H14v7.5H2z"/><circle cx="8" cy="8.8" r="2.3"/>',
    cal: '<rect x="2" y="3" width="12" height="11" rx="1.2"/><path d="M2 6.5h12M5 1.8v2.4M11 1.8v2.4"/>',
    pin: '<path d="M8 14.5s4.5-4.3 4.5-8A4.5 4.5 0 0 0 3.5 6.5c0 3.7 4.5 8 4.5 8z"/><circle cx="8" cy="6.5" r="1.6"/>',
    edit: '<path d="M10.5 2.5l3 3L6 13H3v-3z"/>',
    user: '<circle cx="8" cy="5.5" r="2.6"/><path d="M3 14c.6-2.8 2.6-4.2 5-4.2s4.4 1.4 5 4.2"/>',
    cr: '<circle cx="8" cy="8" r="6.2"/><path d="M10 6.2a2.6 2.6 0 1 0 0 3.6"/>',
    size: '<path d="M2.5 6V2.5H6M13.5 10v3.5H10M2.5 2.5 7 7M13.5 13.5 9 9"/>',
    key: '<circle cx="5" cy="10.8" r="2.7"/><path d="m7 9 6.5-6.5M11 4.5l1.8 1.8M9.5 6l1.3 1.3"/>',
    shield: '<path d="M8 1.6 13.2 3.5v4c0 3.2-2.2 5.6-5.2 6.9C5 13.1 2.8 10.7 2.8 7.5v-4z"/>',
    check: '<path d="m3 8.5 3.2 3L13 4.5"/>',
    x: '<path d="M4 4l8 8M12 4l-8 8"/>',
    chev: '<path d="m6 3.5 4.5 4.5L6 12.5"/>',
    dn: '<path d="M4 6l4 4 4-4"/>',
    spark: '<path d="M8 1.8 9.4 6.6 14.2 8 9.4 9.4 8 14.2 6.6 9.4 1.8 8 6.6 6.6z"/>',
    move: '<path d="M8 1.8v12.4M1.8 8h12.4M8 1.8 6.3 3.5M8 1.8l1.7 1.7M8 14.2l-1.7-1.7M8 14.2l1.7-1.7M1.8 8l1.7-1.7M1.8 8l1.7 1.7M14.2 8l-1.7-1.7M14.2 8l-1.7 1.7"/>',
    shape: '<rect x="2.5" y="2.5" width="11" height="11" rx="1"/><path d="M2.5 6.5h11M6.5 2.5v11"/>',
    spot: '<circle cx="7" cy="7" r="4.5"/><path d="M10.4 10.4 14 14"/>',
    play: '<path d="M5 3.2v9.6L12.6 8z"/>',
    vid: '<rect x="1.8" y="3.5" width="9" height="9" rx="1"/><path d="m10.8 7 3.4-2v6l-3.4-2"/>',
    pic: '<rect x="1.8" y="2.8" width="12.4" height="10.4" rx="1"/><circle cx="5.5" cy="6.3" r="1.2"/><path d="m2.5 12 3.8-3.8 2.6 2.6 1.6-1.6 3.2 3.2"/>',
    hl: '<path d="M3 13.5h10"/><path d="m5 10.5 6.5-6.5 1.5 1.5L6.5 12H5z"/>',
    box: '<rect x="2.5" y="3.5" width="11" height="9" rx=".5"/>',
    circ: '<ellipse cx="8" cy="8" rx="5.8" ry="4.8"/>',
    arrow: '<path d="M3 13 13 3M7 3h6v6"/>',
    text: '<path d="M3 3.5h10M8 3.5v9.5M6 13h4"/>',
    hand: '<path d="M5.5 8.5V4a1 1 0 0 1 2 0v3.5M7.5 7V3a1 1 0 0 1 2 0v4M9.5 7.2V4a1 1 0 0 1 2 0v5.5c0 2.5-1.5 4.5-4 4.5-1.8 0-2.9-.9-3.8-2.3L2.4 9.4a1 1 0 0 1 1.6-1.2l1.5 1.4"/>',
    area: '<path d="M2.5 5V2.5H5M11 2.5h2.5V5M13.5 11v2.5H11M5 13.5H2.5V11"/>',
    undo: '<path d="M5.5 3.5 2.5 6.5l3 3"/><path d="M2.5 6.5h7a4 4 0 0 1 0 8H7"/>',
    redo: '<path d="m10.5 3.5 3 3-3 3"/><path d="M13.5 6.5h-7a4 4 0 0 0 0 8H9"/>',
    trash: '<path d="M2.5 4.2h11M6 4.2V2.6h4v1.6M4 4.2l.7 9.6h6.6l.7-9.6"/>',
    shrink: '<path d="M9.5 2.5v4h4M6.5 13.5v-4h-4M9.5 6.5l4.5-4.5M6.5 9.5 2 14"/>',
    crop: '<path d="M4 1.5V12h10.5M1.5 4H12v10.5"/>',
    plus: '<path d="M8 3v10M3 8h10"/>',
    zip: '<rect x="2.5" y="1.8" width="11" height="12.4" rx="1"/><path d="M7 1.8v2h2v2H7v2h2v2H7"/>',
    clock: '<circle cx="8" cy="8" r="6.2"/><path d="M8 4.6V8l2.4 1.6"/>',
    link: '<path d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2.2-2.2a2.6 2.6 0 0 0-3.7-3.7l-.6.6M9.2 6.8a2.6 2.6 0 0 0-3.7 0L3.3 9a2.6 2.6 0 0 0 3.7 3.7l.6-.6"/>',
    ext: '<path d="M9 2.5h4.5V7M13.5 2.5 7.5 8.5M12 9.5V13a.5.5 0 0 1-.5.5h-8.5a.5.5 0 0 1-.5-.5V4.5a.5.5 0 0 1 .5-.5H7"/>',
    info: '<circle cx="8" cy="8" r="6.2"/><path d="M8 7.2v4M8 4.9v.2"/>',
    warn: '<path d="M8 2.2 14.2 13H1.8z"/><path d="M8 6.5v3.2M8 11.4v.1"/>',
    rot: '<path d="M3 8a5 5 0 1 0 1.6-3.7"/><path d="M2.8 2.2v2.6h2.6"/>',
    lock: '<rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/>',
  };
  const C = { blue: '#0067C0', green: '#0F7B0F', amber: '#C27C00', purple: '#8250DF', teal: '#00818A', red: '#C42B1C', grey: '#5B6A7A', orange: '#CA5010' };
  function ic(name, z = 16) {
    const t = document.createElement('template');
    t.innerHTML = `<svg viewBox="0 0 16 16" width="${+z}" height="${+z}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
    return t.content.firstChild;
  }
  const sq = (color, icon, z = 36) => h('span', { class: 'ksq', style: `--c:${color};width:${z}px;height:${z}px` }, ic(icon));
  const btn = (icon, text, cls, props) => h('button', { class: 'nbtn ' + (cls || ''), type: 'button', ...(props || {}) }, icon ? ic(icon) : null, text);
  const kn1 = (title, sub) => h('span', { class: 'kn1' }, h('b', {}, title), sub != null ? h('span', {}, sub) : null);
  const head = title => h('div', { class: 'nhead' }, h('h1', {}, h('a', { class: 'bc', href: '#tools', text: 'Tools ›', onclick: e => { e.preventDefault(); try { if (parent !== window) { parent.location.hash = 'tools'; return; } } catch (x) { /* own tab */ } location.href = 'app.html#tools'; } }), ' ' + title));
  // The one line under the title: what is open on the left, the buttons on the right.
  const cmd = (left, ...right) => h('div', { class: 'tn-cmd' }, left, h('span', { class: 'sp' }), ...right);
  const fchip = (pic, name, meta) => h('span', { class: 'tn-fchip' }, pic || sq(C.grey, 'file', 34), kn1(name, meta));
  const size = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  const clock = d => new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  // "Today 2:14 PM", "Yesterday 4:51 PM", "Nov 22 10:05 AM"
  function when(t) {
    const d = new Date(t), now = new Date(), day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(), diff = Math.round((day(now) - day(d)) / 864e5);
    return (diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : d.toLocaleDateString([], { month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) })) + ' ' + clock(d);
  }
  // The PageProof app, when this page sits in its frame (it keeps "Opened lately").
  const app = () => { try { return parent !== window && parent.PP_TOOLS ? parent.PP_TOOLS : null; } catch (e) { return null; } };
  const TOOL = { inspect: ['Inspect a photo', C.purple], compare: ['Compare two photos', C.teal], markup: ['Mark up a copy', C.orange], files: ['Convert files', C.blue], openfiles: ['Open odd files', C.grey], verify: ['Verify a pack', C.green] };
  // "Opened lately": the files opened in any tool, newest first, each with Open again.
  async function recent(n = 4) {
    const a = app(); if (!a) return null;
    const list = (await a.recent().catch(() => [])).slice(0, n);
    if (!list.length) return null;
    return h('section', { class: 'card tn-recent' }, h('div', { class: 'kh2' }, 'Opened lately ', h('span', { class: 'kfaint', text: 'only on this computer' })),
      list.map(r => h('div', { class: 'tn-rr' }, r.thumb ? h('img', { src: r.thumb, alt: '' }) : sq(r.tool === 'verify' ? C.green : C.grey, r.tool === 'verify' ? 'zip' : 'file', 40),
        h('span', { class: 'kn1' }, h('b', { text: r.names.join(' + '), title: r.names.join(' + ') }), h('span', {}, h('i', { class: 'tn-dot', style: '--c:' + (TOOL[r.tool] || TOOL.files)[1] }), (TOOL[r.tool] || TOOL.files)[0] + ' · ' + when(r.at))),
        btn('', 'Open again', '', { onclick: () => a.openAgain(r.id) }))));
  }
  // The big dashed card of a tool with nothing open yet.
  const drop = (color, icon, title, sub, ...buttons) => h('section', { class: 'card tn-drop big' }, sq(color, icon, 64), h('div', { class: 'tn-dt' }, h('b', { text: title }), h('span', { text: sub })), h('div', { class: 'tn-db' }, ...buttons));
  const what = (title, rows) => h('section', { class: 'card tn-what' }, h('div', { class: 'kh2', text: title }), rows.map(([i, b, s]) => h('div', { class: 'tn-wr' }, ic(i, 18), kn1(b, s))));
  return { h, ic, sq, btn, kn1, head, cmd, fchip, size, clock, when, app, recent, drop, what, C, TOOL };
})();
