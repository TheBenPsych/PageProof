# PageProof's automatic checks

These run by themselves on GitHub every time a new version is made. If any check fails, the
new version is **not** released, so a broken PageProof never reaches the download page.

They start a real browser with PageProof loaded and a pretend library (pretend photos on a
pretend Google Drive folder, pretend copies found). No real photos, clients or websites are used.

| File | What it checks |
| --- | --- |
| `checks-setup.js` | Connect your photos step 3: the folder list shows, the same top folder keeps your ticks, and every click shows its result at once |
| `checks-restore.js` | After a reinstall, Copies found rebuilds missing preview pictures (from Drive, the picture address, or the matching picture on their page) and found-copies.txt keeps the picture address |
| `checks-answers.js` | Stolen / Licensed / Remove / Skip, Undo, the weekly numbers, photo folders, flags, the backup files |
| `checks-rows.js` | Copies found: every answer and hide (row buttons, details panel, "All N stolen", Hide site and Only this account, picked rows) takes the row off the list at once and it stays off while Keep searching is running; Undo brings it back; quick clicks on several rows are all saved |
| `checks-previews.js` | Preview pictures are stored separately and still show on every page |
| `checks-new.js` | Skipped photos, a broken search site, repeat offenders, Approve site, "Is everything working?", no update notice |
| `checks-44.js` | Firm rule check before Stolen, their page read (credit, prices, ads), dates and damages hint, Ready for legal, research steps, POOL photos skipped, Save as Breaking News photo with the new-or-recycled check |
| `checks-47.js` | The calmer details panel (Look at these, tabs, picture views, answers pinned, More menu, Hide site opens the next copy), Quick filter buttons (solid blue with a tick when on), dropdowns that light up with an ✕, the Showing line, Damages and Client columns, Columns menu, sticky group headings, Hide site in One at a time |
| `checks-badge.js` | The new-copies number (menu, toolbar dot, side panel) leaves out copies on hidden sites and hidden countries, so it matches Copies found |
| `checks-49.js` | Websites and Social media tabs: accounts read from links, short links and the post page; Set account; Stolen, Hide and Approve per account (also for /p/ links); The post instead of the live page; Group by account and the Accounts list; new social sites asked once; Settings › Social sites |
| `checks-accts.js` | Account details on social copies: followers, verified, account type (automatic business check), country and owner company read from the profile (stubbed); Verified / Followers / Account type / Country filters; Sort by Most followers; Accounts list columns and sorting; About this account with business register and trademark searches; the Settings switch |
| `checks-410.js` | Every photo searched at least once: 1 in 3 searches go to never-searched photos even when newer photos are due, ★ priority clients first then clients take turns, ⚑ High still first, the counts (POOL and broken photos apart), the client-finished note, Keep searching, Home and the weekly summary |
| `checks-415.js` | Mistake-proofing: Before you save, blocked page box, your photo found on the capture, capture pauses on a tab switch, held keys and "That was quick", Stolen copies kept by Hide and Remove, setup folder notes, greyed-out buttons say why, the Keep searching tab coming back, no Still online check |
| `speed.js` | Every main page draws quickly with 50,000 photos and 5,000 copies |

To run them yourself (needs Node.js):

```
cd tests/app
npm install playwright
npx playwright install chromium
node run.js
```
