#!/usr/bin/env python3
"""Writes the dark-mode colours for the older tool pages (Capture, Inspect, Compare, Markup,
Convert, Reverse search, Verify, Log).

Those pages were written light-only, with colours typed straight into their style sheets. This
reads each sheet, finds every light colour, and writes a matching dark rule into
extension/ui/tools-look.css between the DARK-AUTO markers. Run it again after changing any of
the sheets listed in SHEETS:

    python3 tools/make-tools-dark.py
"""
import re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent / 'extension'
SHEETS = ['viewer.css', 'inspect.css', 'compare.css', 'markup.css', 'convert.css', 'revsearch.css']
OUT = ROOT / 'ui' / 'tools-look.css'
START, END = '/* DARK-AUTO-START (written by tools/make-tools-dark.py, do not edit by hand) */', '/* DARK-AUTO-END */'

mix = lambda tok, pct: f'color-mix(in srgb,var(--t-{tok}) {pct}%,var(--t-surface))'
BG = {
    'fff': 'var(--t-surface)', 'ffffff': 'var(--t-surface)', 'f8fafc': 'var(--t-surface)',
    'f1f5f9': 'var(--t-sunk)', 'e9eef5': 'var(--t-sunk)', 'e2e8f0': 'var(--t-line)', 'cbd5e1': 'var(--t-line)',
    'eff6ff': 'var(--t-accent-soft)', 'dbeafe': 'var(--t-accent-soft)', 'bfdbfe': 'var(--t-accent-soft)', 'e0f2fe': 'var(--t-accent-soft)',
    'e0e7ff': 'var(--t-accent-soft)', 'ede9fe': 'var(--t-accent-soft)',
    'f0fdf4': mix('ok', 14), 'dcfce7': mix('ok', 18), 'bbf7d0': mix('ok', 24),
    'fffbeb': mix('warn', 14), 'fef3c7': mix('warn', 18), 'fde68a': mix('warn', 26), 'ffedd5': mix('warn', 18),
    'fef2f2': mix('bad', 14), 'fee2e2': mix('bad', 18), 'fecaca': mix('bad', 26),
}
INK = {
    '0f172a': 'var(--t-ink)', '1e293b': 'var(--t-ink)', '334155': 'var(--t-ink)', '475569': 'var(--t-muted)', '64748b': 'var(--t-muted)',
    '1e3a8a': 'var(--t-accent)', '1d4ed8': 'var(--t-accent)', '2563eb': 'var(--t-accent)', '075985': 'var(--t-accent)', '3730a3': 'var(--t-accent)',
    '4c1d95': 'var(--t-accent)', '5b21b6': 'var(--t-accent)', '0f7cbd': 'var(--t-accent)',
    '166534': 'var(--t-ok)', '15803d': 'var(--t-ok)', '16a34a': 'var(--t-ok)',
    '92400e': 'var(--t-warn)', '78350f': 'var(--t-warn)', 'b45309': 'var(--t-warn)', '9a3412': 'var(--t-warn)', 'd97706': 'var(--t-warn)',
    '991b1b': 'var(--t-bad)', 'b91c1c': 'var(--t-bad)',
}
soft = lambda tok: f'color-mix(in srgb,var(--t-{tok}) 45%,var(--t-surface))'
EDGE = {
    'e2e8f0': 'var(--t-line)', 'cbd5e1': 'var(--t-line)', '94a3b8': 'var(--t-line)', 'f1f5f9': 'var(--t-line)', 'fff': 'var(--t-surface)',
    '86efac': soft('ok'), 'bbf7d0': soft('ok'), 'fde68a': soft('warn'), 'fcd34d': soft('warn'), 'f59e0b': 'var(--t-warn)',
    'fca5a5': soft('bad'), 'fecaca': soft('bad'), '93c5fd': soft('accent'), 'bfdbfe': soft('accent'),
}
SKIP = {'main img'}
HEX = re.compile(r'#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b')

def rules(css):
    """Yields (selector, body) for every plain rule, including the ones inside @media blocks."""
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    i, n = 0, len(css)
    while i < n:
        j = css.find('{', i)
        if j < 0: return
        sel = css[i:j].strip()
        depth, k = 1, j + 1
        while k < n and depth:
            depth += css[k] == '{'; depth -= css[k] == '}'; k += 1
        body = css[j + 1:k - 1]
        if sel.startswith('@media'): yield from rules(body)
        elif not sel.startswith('@'): yield sel, body
        i = k

def dark(sel, body):
    out = {}
    for decl in body.split(';'):
        if ':' not in decl: continue
        prop, val = (x.strip() for x in decl.split(':', 1))
        prop = prop.lower()
        found = [m.lower() for m in HEX.findall(val)]
        if len(found) != 1 or 'gradient' in val or 'url(' in val: continue
        c = found[0]
        if prop in ('background', 'background-color') and c in BG: out['background-color'] = BG[c]
        elif prop == 'color' and c in INK: out['color'] = INK[c]
        elif re.fullmatch(r'border(-(top|right|bottom|left))?(-color)?|outline(-color)?', prop) and c in EDGE:
            out[re.sub(r'-color$', '', prop) + '-color'] = EDGE[c]
    return out

def main():
    lines = []
    for name in SHEETS:
        block = []
        for sel, body in rules((ROOT / name).read_text()):
            if 'data-theme' in sel or sel.startswith(':root'): continue
            # The side panel is coloured by hand at the top of tools-look.css, and the captured
            # page itself always stays on white paper.
            if sel in SKIP or all(s.strip().startswith('#side') for s in sel.split(',')): continue
            d = dark(sel, body)
            if not d: continue
            sels = ','.join(':root[data-theme="dark"] ' + s.strip() for s in sel.split(','))
            block.append(sels + '{' + ';'.join(f'{k}:{v}' for k, v in d.items()) + '}')
        if block: lines += [f'/* {name} */'] + block
    text = OUT.read_text()
    if START in text: text = text[:text.index(START)].rstrip() + '\n'
    OUT.write_text(text.rstrip() + '\n\n' + START + '\n' + '\n'.join(lines) + '\n' + END + '\n')
    print(len(lines), 'dark rules written to', OUT.relative_to(ROOT.parent))

main()
