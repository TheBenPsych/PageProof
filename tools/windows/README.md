# Update PageProof with one double-click (Windows)

`Update-PageProof.cmd` installs or updates PageProof for whoever runs it. It is **one file**,
so it is easy to hand to the team. It is on every
[Latest build](https://github.com/TheBenPsych/PageProof/releases/tag/latest) page next to
PageProof.zip:
https://github.com/TheBenPsych/PageProof/releases/download/latest/Update-PageProof.cmd

Keep it in **Documents › PageProof** (or on the desktop), never inside `Install`. PageProof
itself has no self-updater and never will (Windows Defender flagged one).

What it does: downloads `PageProof.zip` from the Latest build page, checks it is PageProof,
and makes `Documents\PageProof\Install` (in the Documents folder of the person signed in,
OneDrive too) an exact copy of it. If you already have the newest version it does nothing. If
anything goes wrong it stops and changes nothing. If `Install` holds anything that is not
PageProof, it refuses to touch it. Then press **Reload** (the round arrow) on PageProof's
card in `chrome://extensions` or `edge://extensions`. The very first time, it tells you to
**Load unpacked** the `Install` folder instead.

Your saved work is not in `Install`, so it is not touched. It only uses tools built into
Windows (PowerShell, robocopy), and the PowerShell part is written out at the bottom of the
file, so anyone can read what it does.

When downloaded from the internet, the browser may say the file "can harm your computer"
(press **Keep**), and Windows may show "Windows protected your PC" the first time (press
**More info**, then **Run anyway**). If an antivirus ever flags it, delete it and update by
hand as in the main README.
