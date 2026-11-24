# Update PageProof with one double-click (Windows)

Two small files that live **outside** PageProof, in `Documents\PageProof` (never inside
`Install`). PageProof itself has no self-updater and never will (Windows Defender flagged one).

- `Update PageProof.cmd`: double-click this.
- `update-pageproof.ps1`: does the work (the .cmd runs it). Keep them in the same folder.

What it does: downloads `PageProof.zip` from the
[Latest build](https://github.com/TheBenPsych/PageProof/releases/tag/latest) page, checks it is
PageProof, and makes `Documents\PageProof\Install` an exact copy of it. If you already have
the newest version it does nothing. If anything goes wrong it stops and changes nothing.
Then press **Reload** (the round arrow) on PageProof's card in `chrome://extensions` or
`edge://extensions`.

Your saved work is not in `Install`, so it is not touched. It only uses tools built into
Windows (PowerShell, robocopy).

If Windows shows "Windows protected your PC" the first time (only when the files were
downloaded from the internet): press **More info**, then **Run anyway**. If an antivirus ever
flags it, just delete the two files and update by hand as before.
