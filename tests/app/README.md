# PageProof's automatic checks

These run by themselves on GitHub on every pull request (`.github/workflows/checks.yml`),
split into 6 parts that run side by side. A pull request is only merged when they pass, so a
broken PageProof never reaches the download page. When you add a new check file, add it to
`FILES` in `run.js` (and its time in seconds to `TIMES`, so the 6 parts stay even).

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
| `checks-44.js` | Firm rule check before Stolen, their page read (credit, prices, ads), dates and damages hint, Ready for legal, research steps, POOL photos skipped |
| `checks-47.js` | The calmer details panel (Look at these, tabs, picture views, answers pinned, More menu, Hide site opens the next copy), Quick filter buttons (solid blue with a tick when on), dropdowns that light up with an ✕, the Showing line, Damages and Client columns, Columns menu, sticky group headings, Hide site in One at a time |
| `checks-badge.js` | The new-copies number (menu, toolbar dot, pop-up) leaves out copies on hidden sites and hidden countries, so it matches Copies found |
| `checks-49.js` | Websites and Social media tabs: accounts read from links, short links and the post page; Set account; Stolen, Hide and Approve per account (also for /p/ links); The post instead of the live page; Group by account and the Accounts list; only the 17 fixed platforms are social (4.31.0); Settings › Social sites |
| `checks-accts.js` | Account details on social copies: followers, verified, account type (automatic business check), country and owner company read from the profile (stubbed); Verified / Followers / Account type / Country filters; Sort by Most followers; Accounts list columns and sorting; About this account with business register and trademark searches; the Settings switch |
| `checks-410.js` | Every photo searched at least once: 1 in 3 searches go to never-searched photos even when newer photos are due, ★ priority clients first then clients take turns, ⚑ High still first, the counts (POOL and broken photos apart), the client-finished note, Keep searching, Home and the weekly summary |
| `checks-415.js` | Mistake-proofing: Before you save, blocked page box, your photo found on the capture, capture pauses on a tab switch, held keys and "That was quick", Stolen copies kept by Hide and Remove, setup folder notes, greyed-out buttons say why, the Keep searching tab coming back, no Still online check |
| `checks-414.js` | The 5-item menu, Home's What to do now list, the status line (turns red with Fix it), one blue button per page header, Evidence library picture cards and List switch, Needs a capture (a saved pack of the same page or Already captured takes a copy off), one copy for one page under several addresses, closing cookie and newsletter pop-ups (never Subscribe, never a log-in box), the Settings switch |
| `checks-416.js` | The fast photo checker (WebAssembly) starts on a PageProof page and in the background photo-check worker, finds exactly the same details as the JavaScript one, and Is everything working shows Where the time goes |
| `checks-418.js` | Backups to your own Google Drive (Back up now, the last-backup line turning red after 3 work days, no preview pictures), safe restore (a "before restore" copy first, photos link and Keep searching kept), team lists (each person's own file, newest answer wins, who added it, Show for me, the team disagrees and Keep it approved), the Back up and share setup step, Moving to a new computer, and Home's "Google Drive isn't syncing" |
| `checks-421.js` | The computer check sets photo checks, search tabs, downloads and pictures opened for each kind of computer (up to 6 checks on a very strong one, one core always left free), and a big search eases off to one check and one tab while the computer is busy, then goes back to full speed |
| `checks-422.js` | Hidden and approved sites: Add from a file is remembered under Files you added, Undo this import takes out only what it added, Add them again, and Take out the sites in a file for files added before 4.22 |
| `checks-423.js` | Stolen before links: Add from a file on that tab (two links on a line count as two), nothing goes into Hidden sites, the red Stolen before tag on a copy on a listed page (www. and tracking bits ignored), its answer unchanged, other pages on the same site count as repeat offenders, the Stolen before quick filter, Undo this import |
| `checks-424.js` | Spam blogs: random-looking addresses on throwaway sites get a Spam blog tag, their answers are not changed, they stay out of Copies found, One at a time and the new-copies number until you press Show them, the Spam blogs quick filter, Hide all hides the whole sites (new made-up addresses too), Undo |
| `checks-postcheck.js` | A Facebook or Instagram match only counts when one of the post's own pictures is the client's photo: the main picture first, then every picture of the post in the signed-in browser (an album's 3rd picture is found); removed by itself only when every picture is different; an unreadable post is left alone; the panel says where "Theirs" came from |
| `checks-431.js` | Another photo of the same place is not a copy: a different shot in front of the same logo wall is found out and its % shows low, a real copy still lines up, unanswered copies already in Copies found are checked again (the other shot moves to Removed, a real copy stays, answered ones are left alone) and Put back works |
| `checks-433.js` | During a search, a match made on Google's small preview waits until their page is read: the photo in the article itself keeps it (with the picture's address), a photo only in comments or "related posts" throws it out, an unreadable page makes it a Maybe; the signed-in post reader picks the post itself and leaves out comments, replies, link previews, the account picture and "more posts" grids |
| `checks-forums.js` | Reddit and forums: every Reddit address and clear forum addresses are caught (Threads and normal news pages are not), a search drops them, copies found before are off Copies found, Stolen ones stay, Reddit is not social media |
| `checks-435.js` | Personal accounts (a name only, Facebook friends, LinkedIn /in/) and politicians ("serving … District", @Rep… handles, "Rep." titles) are hidden on the Social media tab and in the new-copies number until you tick Show; Stolen copies stay; Type is wrong? sets it by hand; link preview card matches (LinkedIn, X, Facebook) are thrown out in the search and go to Removed in Copies found, and Put back stays put back |
| `checks-stats.js` | How PageProof is doing: a search records links thrown out by reason, each search site's links (Same / Maybe / Different / could not check) and problems by website (site name only); the page and its sections; the red alert when most of one site's links can't be checked; Save stats for Claude has no client names, photo names, links or paths; the weekly file; answers counted; the Checker test gets 72 of 72 right |
| `checks-4512.js` | Two searches never pick the same photos: a search started while another runs, is still checking matches, or was just searched in another page gets other photos; a stopped search lets go of photos it never searched; photos being read from Drive for a big search are held |
| `checks-rvkind.js` | One at a time: the All / Websites / Social media switch shows only that kind (also after an answer), is remembered, and the button on the Social media tab starts on Social media |
| `speed.js` | Every main page draws quickly with 50,000 photos and 5,000 copies |

To run them yourself (needs Node.js):

```
cd tests/app
npm install playwright
npx playwright install chromium
node run.js
```
| `checks-steady.js` | Copies found and One at a time stay put while you look: new copies wait behind "N new copies came in", the row at the top of the screen stays at the same place, a row a background check changed stays until you click, your own answers still take rows off, and One at a time keeps the copy on screen until you answer, skip or press Next copy |
| `checks-calm1.js` | The calm look, step 1: every page loads the shared look last, Lexend for text, titles and buttons, the Windows 11 colours in light and dark (blue buttons with black words in dark), 4 px controls and 8 px cards, the cogwheel and coloured menu icons, "Settings › Hidden and approved sites" titles, the three status tiles at the top right (in the top bar on tool pages), Windows tick boxes, and the tool pages using the same colours and font |
| `checks-calm2.js` | The calm look, step 2: All copies has a short title with the tabs beside it, one command bar (Group, Filters, Sort, Download, Columns), column names once above the list that line up and sort on a click, a tick box for every copy showing, no clock button or keys line; the copy panel has three tabs, named pictures, a facts line, no key letters, and a left edge you can drag (remembered); grouped by client the Client column is left out |
