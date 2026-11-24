# How changes get made and released

Several changes are often worked on at the same time. These rules keep them from clashing,
and get each finished change to Ben's download link within about a minute.

## The short version

1. **Make a branch and a pull request** as usual.
2. **Don't change the version number.** Leave `"version"` in `extension/manifest.json` alone.
3. **Don't edit the version timeline in `FEATURES.md` or the `NEWS` list in `extension/app.js`.**
   Instead, add **one small note file** in `changes/` that says what changed
   (format in [changes/README.md](changes/README.md)). Each change has its own file, so two
   pull requests never fight over the same lines.
4. **Wait for the green "checks"** on the pull request (about 4 minutes), then **merge it right
   away.** No need to wait for other pull requests, and no need to re-run anything after
   another one merges first.
5. **About a minute later the new download is ready** at
   https://github.com/TheBenPsych/PageProof/releases/download/latest/PageProof.zip
   (the title of the [Latest build](https://github.com/TheBenPsych/PageProof/releases/tag/latest)
   page shows the version).

## What happens when a change lands on main

The **Build download** workflow (`.github/workflows/release.yml`) runs `tools/release.py`, which:

- picks the next version: if any note says `type: new`, 4.30.2 becomes **4.31.0**; if they are
  all `type: fix`, it becomes **4.30.3**. No note at all still counts as a fix, so every new
  download has a new number.
- writes that version into `extension/manifest.json`,
- adds each note to `FEATURES.md` (its group, and one line in the version timeline) and to the
  **What's new** page (`NEWS` in `extension/app.js`),
- deletes the note files, commits this as "Release 4.30.3", and tags it `v4.30.3`.

Then it zips the Chrome/Edge and Firefox versions and replaces the "latest" release. It does
not wait for the long browser checks, because the pull request already passed them. If two
changes land close together, the second release waits for the first, then picks up both.

A change that only touches docs or tests (nothing in `extension/`, no note) doesn't make a new
download.

**Before you write your own code, pull the latest main**, because the release adds a commit to
main after every merge (the version and notes).

## The automatic checks (`.github/workflows/checks.yml`)

They run on every pull request, and once more on main as a safety net:

- **what-changed** decides what needs to run. Docs, change notes and pictures only: no browser
  checks. The 60 full-page capture test pages only run when `content.js`, `background.js`,
  `viewer.js`, `manifest.json` or `tests/capture/` changed. Anything else in `extension/` runs
  all the app checks.
- **rules** checks the change notes are written right (`python3 tools/release.py --check`) and
  stops a pull request that changes the version number.
- **app checks** run in 6 parts side by side (`SHARD=2/6 node tests/app/run.js`), about
  3 minutes each. New check files go in `FILES` in `tests/app/run.js`, with their time in
  `TIMES` so the parts stay even.
- **capture checks** run in 3 parts side by side (`SHARD=1/3 node tests/capture/run.js`).
- **checks** is the one to look at: green means everything that was needed passed.

To re-run only what failed while fixing it, run that file by itself:
`xvfb-run -a node tests/app/run.js checks-43.js`, or for capture pages
`node tests/capture/run.js 12 39` (pages whose name starts with 12 or 39).

## Other house rules

- Plain words in notes, FEATURES.md and the What's new page. Ben's team are not programmers.
- No client names, real photos or real case details anywhere: this repository is public.
- PageProof never writes inside its own program folder (`Documents\PageProof\Install`), and has
  no self-updater (Windows Defender flagged one). Don't add one.
- Don't change or remove the `"key"` in `manifest.json` (it keeps the extension ID the same on
  every computer, so saved data survives).
