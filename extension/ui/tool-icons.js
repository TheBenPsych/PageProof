// The older tool pages wrote their button pictures as emoji. Emoji look different on every
// computer, so this swaps each one for a line icon that matches the rest of PageProof. It only
// touches labels (buttons, links, headings, notes), never what you type or the names of your files.
(() => {
  const P = {
    down: '<path d="M12 4v11"/><path d="M8 11l4 4 4-4"/><path d="M5 20h14"/>',
    doc: '<path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z"/><path d="M14 3v4h4"/>',
    pages: '<path d="M9 3h7l4 4v10H9z"/><path d="M5 7v14h11"/>',
    image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>',
    log: '<path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    folder: '<path d="M3 6h7l2 3h9v10H3z"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    box: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    swap: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    find: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    pen: '<path d="M4 20l4-1L19 8l-3-3L5 16z"/>',
    warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
    cam: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="8" cy="8" r="1.4"/>',
    spark: '<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    shrink: '<path d="M9 3v6H3M15 21v-6h6M9 9L3 3M15 15l6 6"/>',
    cut: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 8l12 10M8 16L20 6"/>',
    files: '<path d="M4 7h7l2 2h7v10H4z"/><path d="M4 7V5h6"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/>',
    owner: '<path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-6h6v6M9 10h.5M14.5 10h.5"/>',
    cal: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
    pin: '<path d="M12 21s7-6.5 7-11a7 7 0 0 0-14 0c0 4.500 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    wrench: '<path d="M14 6a4 4 0 0 0 5 5l-9 9-4-4 9-9z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
    hash: '<path d="M9 4L7 20M17 4l-2 16M4 9h16M3 15h16"/>',
    ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M8 12l2 2M11 9l2 2M14 6l2 2"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    star: '<path d="M12 3l2.700 5.600 6.300.900-4.500 4.300 1 6.200-5.500-3-5.500 3 1-6.200L3 9.500l6.300-.900z"/>',
    play: '<path d="M7 4l13 8-13 8z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
    text: '<path d="M4 7V5h16v2M12 5v14M9 19h6"/>',
    move: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
    select: '<rect x="4" y="4" width="16" height="16" rx="1" stroke-dasharray="3 3"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.700.400-1 1-1 1.700M12 17v.5"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    clip: '<path d="M20 11l-8 8a5 5 0 0 1-7-7l8-8a3.500 3.500 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7"/>',
    chart: '<path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3"/>',
    loop: '<path d="M20 12a8 8 0 1 1-3-6.200"/><path d="M20 4v5h-5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.500"/>',
  };
  const MAP = {
    '⬇': 'down', '💾': 'down', '📄': 'doc', '📜': 'doc', '🧾': 'doc', '📝': 'doc', '📑': 'pages', '🖼': 'image', '📒': 'log', '📂': 'folder', '📁': 'folder',
    '✅': 'shield', '🔀': 'layers', '🍎': 'files', '📦': 'box', '🔄': 'swap', '🔁': 'loop', '📋': 'copy', '🌐': 'globe', '🔍': 'find', '🔎': 'find', '➕': 'plus',
    '✉': 'mail', '✏': 'pen', '🖍': 'pen', '⚠': 'warn', '🤖': 'warn', '📷': 'cam', '🏷': 'tag', '✨': 'spark', '⏳': 'clock', '🗑': 'trash', '🔒': 'lock',
    '🗜': 'shrink', '✂': 'cut', '🗂': 'files', '🚫': 'ban', '🏢': 'owner', '📅': 'cal', '📍': 'pin', '🛠': 'wrench', '👤': 'user', '🔢': 'hash', '📐': 'ruler',
    '🔑': 'key', '💬': 'chat', '⭐': 'star', '🎬': 'play', '⏸': 'pause', '⏹': 'stop', '🔤': 'text', '✋': 'move', '⬚': 'select', '❓': 'help', '❔': 'help',
    '👁': 'eye', '📎': 'clip', '📊': 'chart', '🎯': 'target',
  };
  const RX = new RegExp('(' + Object.keys(MAP).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\uFE0F?', 'u');
  const LABELS = 'button,a,summary,h1,h2,h3,label,nav,.brand,.safe,.gonote,.howto,.can,.ways,.lead,.note,.empty,#empty,.card,.pill,.tag,.st,.kv,.fold,#notice,#banner,#status,.tp-facts';
  const NEVER = 'pre,textarea,input,select,[contenteditable],#preview,#board,#details,iframe,svg,.nm,.name,.fname,.t,.url,script,style';
  const svg = name => { const s = document.createElement('span'); s.className = 'tic'; s.setAttribute('aria-hidden', 'true');
    s.innerHTML = `<svg viewBox="0 0 24 24" width="1.15em" height="1.15em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[name].replace(/\.(\d)00\b/g, '.$1')}</svg>`; return s; };
  function fix(node) {
    const el = node.parentElement;
    if (!el || el.closest(NEVER) || !el.closest(LABELS)) return;
    let m, guard = 0;
    while ((m = RX.exec(node.nodeValue)) && guard++ < 8) {
      const after = node.splitText(m.index);
      after.nodeValue = after.nodeValue.slice(m[0].length);
      after.parentNode.insertBefore(svg(MAP[m[1]]), after);
      node = after;
    }
  }
  function sweep(root) {
    if (root.nodeType === 3) { if (RX.test(root.nodeValue)) fix(root); return; }
    if (root.nodeType !== 1 || root.matches(NEVER)) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), found = [];
    while (w.nextNode()) if (RX.test(w.currentNode.nodeValue)) found.push(w.currentNode);
    found.forEach(fix);
  }
  const go = () => {
    sweep(document.body);
    new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') sweep(m.target); else m.addedNodes.forEach(sweep); } })
      .observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
})();
