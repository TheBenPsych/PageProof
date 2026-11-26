// Line icons used across PageProof (24x24, drawn with strokes so they follow the text colour).
const PP_ICONS={
  home:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  capture:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 14h8"/>',
  find:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  tools:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
  files:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
  library:'<path d="M4 4h5v16H4z"/><path d="M9 4h5v16H9z"/><path d="M15 5l4.5 1-3 14L12 19"/>',
  browser:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/><path d="M3 8h12"/>',
  verify:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  ideas:'<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><path d="M12 17.5v.01"/>',
  up:'<path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 20h16"/>',
  down:'<path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/>',
  check:'<path d="M5 12l5 5 9-10"/>',
  link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  doc:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/>',
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  chev:'<path d="M9 6l6 6-6 6"/>',
  owner:'<path d="M3 21h18"/><path d="M5 21V8l7-4 7 4v13"/><path d="M9 21v-5h6v5"/><path d="M9 11h.01M15 11h.01"/>',
  ext:'<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  pause:'<path d="M9 5v14M15 5v14"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  linkset:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  refresh:'<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
};

PP_ICONS.photo='<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="M21 16l-5-5-9 8"/>';
PP_ICONS.panel='<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>';
PP_ICONS.hide='<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>';
PP_ICONS.trash='<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>';
PP_ICONS.undo='<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>';
PP_ICONS.star='<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>';
PP_ICONS.flag='<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>';
PP_ICONS.cpu='<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>';
PP_ICONS.moon='<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>';
PP_ICONS.sun='<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
PP_ICONS.menu='<path d="M4 6h16M4 12h16M4 18h16"/>';
PP_ICONS.x='<path d="M6 6l12 12M18 6L6 18"/>';
PP_ICONS.copies='<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>';
PP_ICONS.people='<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M17 4a4 4 0 0 1 0 8M22 21c0-3-1.5-5-4-5.7"/>';
PP_ICONS.loop='<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>';
PP_ICONS.grid='<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>';
PP_ICONS.dots='<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>';
PP_ICONS.undo='<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>';
PP_ICONS.cam='<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>';
PP_ICONS.ban='<circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/>';
PP_ICONS.layers='<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>';
PP_ICONS.pen='<path d="M4 20l4-1L20 7l-3-3L5 16z"/>';
PP_ICONS.swap='<path d="M4 8h14l-3-3M20 16H6l3 3"/>';
function ppIcon(n, s = 20, w = 2) { return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PP_ICONS[n] || ''}</svg>`; }
// 4.7: small warning icons on Copies found rows and in "Look at these".
PP_ICONS.warn='<path d="M12 3L2 20h20z"/><path d="M12 10v4M12 17v.5"/>';
PP_ICONS.nocredit='<circle cx="12" cy="12" r="9"/><path d="M15 9.5a3.5 3.5 0 1 0 0 5"/><path d="M4.5 4.5l15 15"/>';
PP_ICONS.repeat='<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>';
PP_ICONS.back='<path d="M5 12h14M12 5l7 7-7 7"/>';
PP_ICONS.gone='<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>';
PP_ICONS.shop='<path d="M4 7h16l-1.5 12h-13z"/><path d="M9 7a3 3 0 0 1 6 0"/>';
PP_ICONS.clock='<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>';
PP_ICONS.maybe='<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5v.4M12 17v.5"/>';
PP_ICONS.who='<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>';
