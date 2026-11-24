# Change notes

Every pull request that changes what PageProof does adds **one small note file here**.
Do **not** change the version in `extension/manifest.json`, the timeline in `FEATURES.md` or
the `NEWS` list in `extension/app.js` yourself: when the change lands on `main`, the release
build (`tools/release.py`) sets the version and writes these notes into all three, then
deletes the note. Because every pull request adds its own file, two pull requests never clash.

Name the file after what it does, for example `changes/pause-stops-everything.md`:

```
type: fix
title: Pause really stops everything
news: Pause (or switching Keep searching off) now stops at once: the photo being searched, a big search and the account details reader.
timeline: Pause and Off stop everything at once
feature 9: **Pause really stops everything.** Pause or Off stops the photo being searched and any big search.
```

| Line | Needed? | What it is |
| --- | --- | --- |
| `type:` | yes | `fix` (4.30.2 becomes 4.30.3) or `new` for a new feature (4.30.2 becomes 4.31.0) |
| `title:` | yes | The heading on PageProof's **What's new** page. Plain words. |
| `news:` | yes | One or two sentences under that heading, for Ben's team |
| `timeline:` | no | One short line for the version timeline in FEATURES.md (the title is used if left out) |
| `feature N:` | no | A line to add to group N of FEATURES.md (1 = Capture ... 9 = Safety nets). The version is added on the end by itself. Use as many as you need. |

Lines starting with `#` are ignored. Keep it to one line per entry, and no client names, real
photos or real case details (this repository is public).

A pull request that only changes tests or docs doesn't need a note. Check a note with:
`python3 tools/release.py --check`
