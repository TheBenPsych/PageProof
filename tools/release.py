#!/usr/bin/env python3
"""Sets the version number and writes the change notes in, when a release is built.

Pull requests do NOT change the version, FEATURES.md or the What's new list in app.js any more
(that made every open pull request clash with every other one). Instead each change adds one
small note file in changes/ (see changes/README.md). When the change lands on main, the
"Build download" workflow runs this script, which:

  1. picks the next version from the notes: any "type: new" note -> 4.30.2 becomes 4.31.0,
     only fixes -> 4.30.2 becomes 4.30.3,
  2. writes it into extension/manifest.json,
  3. adds each note to FEATURES.md (its group + one line in the version timeline) and to the
     What's new list (NEWS) in extension/app.js,
  4. deletes the note files it used.

  python3 tools/release.py --check     only checks the notes are written right (used on pull requests)
  python3 tools/release.py --last X    X = the version of the last download (from its git tag)
  python3 tools/release.py             does the release edits; prints the new version

If nobody wrote a note, the patch number still goes up (so a new download is never mistaken
for the old one) and the timeline says "Small fixes". If a pull request did change the
version itself (the old way), that number is used as it is.
"""
import datetime, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOTES = os.path.join(ROOT, 'changes')
MANIFEST = os.path.join(ROOT, 'extension', 'manifest.json')
FEATURES = os.path.join(ROOT, 'FEATURES.md')
APP = os.path.join(ROOT, 'extension', 'app.js')
KEYS = {'type', 'title', 'news', 'timeline'}


def read_notes():
    notes, problems = [], []
    if not os.path.isdir(NOTES):
        return notes, problems
    for name in sorted(os.listdir(NOTES)):
        if not name.endswith('.md') or name.lower() == 'readme.md':
            continue
        n = {'file': name, 'features': []}
        for i, line in enumerate(open(os.path.join(NOTES, name), encoding='utf-8').read().splitlines(), 1):
            if not line.strip() or line.lstrip().startswith('#'):
                continue
            m = re.match(r'^feature\s+(\d+)\s*:\s*(.+)$', line.strip())
            if m:
                n['features'].append((int(m.group(1)), m.group(2).strip()))
                continue
            m = re.match(r'^(\w+)\s*:\s*(.+)$', line.strip())
            if not m or m.group(1) not in KEYS:
                problems.append(f'{name} line {i}: not understood: "{line.strip()[:60]}"')
                continue
            n[m.group(1)] = m.group(2).strip()
        if n.get('type') not in ('fix', 'new'):
            problems.append(f'{name}: needs "type: fix" or "type: new"')
        for k in ('title', 'news'):
            if not n.get(k):
                problems.append(f'{name}: needs a "{k}:" line')
        notes.append(n)
    return notes, problems


def vtuple(v):
    return tuple(int(x) for x in v.split('.')) + (0,) * (3 - len(v.split('.')))


def short(v):
    # 4.31.0 is written "4.31" in FEATURES.md, like the older entries
    return v[:-2] if v.endswith('.0') and v.count('.') == 2 else v


def js_str(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"


def main():
    args = sys.argv[1:]
    notes, problems = read_notes()
    if problems:
        print('Change notes need fixing (see changes/README.md):\n  ' + '\n  '.join(problems))
        sys.exit(1)
    if '--check' in args:
        print(f'{len(notes)} change note(s) look right.')
        return

    last = args[args.index('--last') + 1] if '--last' in args else None
    manifest_text = open(MANIFEST, encoding='utf-8').read()
    current = json.loads(manifest_text)['version']
    if last and vtuple(current) > vtuple(last):
        version = current                     # a pull request already set it (old way)
    else:
        a, b, c = vtuple(current)
        version = f'{a}.{b + 1}.0' if any(n['type'] == 'new' for n in notes) else f'{a}.{b}.{c + 1}'

    # US Eastern date (the team's time zone), without needing extra Python packages
    now = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=5)
    day, year = f'{now.day} {now:%b}', now.year

    # 1. manifest.json: change only the version line, so the rest of the file stays as it is
    manifest_text = re.sub(r'("version"\s*:\s*")[^"]+(")', lambda m: m.group(1) + version + m.group(2), manifest_text, count=1)
    open(MANIFEST, 'w', encoding='utf-8').write(manifest_text)

    # 2. FEATURES.md
    f = open(FEATURES, encoding='utf-8').read()
    f = re.sub(r'Last updated: version \*\*[^*]+\*\* \([^)]*\)\.', f'Last updated: version **{version}** ({day} {year}).', f, count=1)
    for n in notes:
        for group, text in n['features']:
            lines = f.split('\n')
            start = next((i for i, l in enumerate(lines) if re.match(rf'^## {group}\. ', l)), None)
            if start is None:
                print(f'warning: {n["file"]}: FEATURES.md has no group "## {group}." - feature line skipped')
                continue
            end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith('## ') or lines[i].strip() == '---'), len(lines))
            last_bullet = max((i for i in range(start, end) if lines[i].startswith('- ')), default=start + 1)
            text = text if text.startswith('- ') else '- ' + text
            lines.insert(last_bullet + 1, f'{text} ({short(version)})')
            f = '\n'.join(lines)
    what = '; '.join(n.get('timeline') or n['title'] for n in notes) or 'Small fixes'
    if all(n['type'] == 'fix' for n in notes) and notes and not what.lower().startswith('fix'):
        what = 'Fix: ' + what
    row = f'| {short(version)} | {day} | {what.replace("|", "/")} |'
    lines = f.rstrip('\n').split('\n')
    top = next(i for i, l in enumerate(lines) if l.startswith('## Version timeline'))
    last_row = max(i for i in range(top, len(lines)) if lines[i].startswith('| '))
    lines.insert(last_row + 1, row)
    open(FEATURES, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')

    # 3. What's new list in app.js (newest first, so the notes go in at the top)
    if notes:
        app = open(APP, encoding='utf-8').read()
        at = app.index('const NEWS = [\n') + len('const NEWS = [\n')
        add = ''.join(f"  [{js_str(n['title'])}, {js_str(n['news'])}],\n" for n in notes)
        open(APP, 'w', encoding='utf-8').write(app[:at] + add + app[at:])

    # 4. the notes are in now
    for n in notes:
        os.remove(os.path.join(NOTES, n['file']))
    print(version)


if __name__ == '__main__':
    main()
