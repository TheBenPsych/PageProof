# PageProof: every feature and improvement

This is the running list of everything PageProof can do and every improvement made to it.
It is grouped by **what the tool does**, then there is a **version timeline** at the bottom.

> **Keeping it up to date:** don't edit this file by hand for a new change. Add a note in
> `changes/` (see CONTRIBUTING.md): the release build adds it here, in the right group and as
> one line in the timeline, with the version number. Plain words only. No client names, real photos or real
> case details (this repository is public).

Last updated: version **4.40.0** (24 Nov 2026).

---

## 1. Capture a web page as evidence

- **Whole page in one picture.** Scrolls the page for you from the very top and stitches it into one tall image (like GoFullPage or FireShot). (1.0)
- **Where it came from, printed on top.** A banner shows the domain, the full web address, the page title, date, time, time zone and window size. (1.0, richer in 1.2)
- **Hidden scroll boxes captured too.** Boxes that scroll on their own (Instagram comments, chat panes, long tables) are marked "Section 1, 2, 3…" and shown in full underneath, not squashed. (1.0)
- **Pages that live inside one big scroll box** (for example some property sites) are captured as the page itself. (1.1)
- **Dropdown lists written out**, with the chosen option marked. (1.8)
- **Endless pages stop where they ended** when you clicked, so the capture doesn't run forever. (1.8)
- **Stop early** and keep what's captured, from the icon. (1.8)
- **Reels, Shorts and TikToks:** only the video on screen is captured, and a shortened caption ("…more") is opened first so the full text shows. Works on Instagram, Facebook Reels, YouTube Shorts and TikTok. (2.7 to 2.8)
- **Sticky bars hidden** (bars that follow you down the page, like the Google search bar) so they don't repeat on every screen. (3.2.3)
- **Cookie and newsletter pop-ups closed** before the capture, and written down in the pack. (4.14)
- **Capture holds still:** if you switch tabs or minimise the window it pauses and waits, and blocks accidental scrolling while it works. (4.15)
- **"Ready to save?" check:** asks once before saving if something looks wrong, finds your client's photo on the page, and warns when the page shows a login wall or "blocked" message. (4.15)
- **Tricky layouts captured properly:** side panels, slide-ins, sticky headings, pictures that load late, bottom bars and locked pages. Checked on 60 test pages. (4.19)
- **Capture page proof checklist:** page, pictures, printout and timestamp each get a tick, with numbered steps (case details, then save). (4.3)
- **Who hosts this site:** hosting company and domain registrar looked up for every capture (IPv6 too). (2.2, 2.6)
- **Collected by** name remembered; case number and notes start empty each time so they never carry over by mistake. (2.9)
- **Needs a capture list:** copies marked Stolen that don't have an evidence pack yet. (4.14)
- **TikTok slideshows in a capture.** A capture of a TikTok photo post lists every picture's link in post-pictures.txt (the files are in images/). (4.33)

## 2. Prove it (the evidence pack)

- **One zip per capture,** named `CASE_domain_date_time_PP-captureID.zip`, with a unique Capture ID on every file. (1.2, 1.6)
- **PDF + self-contained HTML backup** (every picture, font and style inside the file, so it still opens if the site deletes them). PNG dropped to save space. (1.2, 1.4)
- **Original server copy** of the page source, the original image files, and the server's IP address, clock time and headers. (1.3)
- **SHA-256 fingerprints** for every file. (1.2)
- **Trusted timestamps** from three independent services: DigiCert, Sectigo and FreeTSA. (1.3, 2.0)
- **README.txt in every pack** explaining every file, and how the capture was taken, in plain English for lawyers and courts. (1.5, 2.7.4)
- **VERIFY-THIS-PACK.html** inside every zip: anyone can double-click it to check the pack, offline, without PageProof. (2.1)
- **Verify page** in PageProof: drop a pack, get a clear green or red result. (2.0)
- **Hidden picture data in every pack** (`image-data.txt` + a PDF page). (3.3)
- **Capture log** of every capture and pack, downloadable as a spreadsheet. (1.3)
- **Evidence report PDF per copy found:** your photo and their copy side by side, links, sizes, hidden data, match check, fingerprints of both, and a Match ID. (3.12)
- **Clock check:** warns if this computer's clock is off compared with the timestamp services. (4.15)
- Guides: VERIFYING.md (how anyone checks a pack), TUTORIAL.md, and a Word install guide for the team.

## 3. Look closer at pictures

- **Image Inspector:** point at a picture, pick from all pictures on the page, upload one, or right-click. Shows a plain-English summary ("Taken on a Canon EOS R6 on 3 Jun 2025 by …"), camera, date, place, editing software, author, copyright, edit history and Content Credentials (including signs of AI). Warns when the data was stripped. Always grabs the biggest version the site offers. (3.3)
- **Compare two pictures** (like Photoshop layers): fade, slide aside and back, nudge, Difference view, Colour check, and a score for how much of the shared area lines up. Save as PDF, picture or short MP4 video. (3.3 to 3.5)
- **Automatic line-up** handles resized, cropped, zoomed, stretched, tilted and mirrored copies, and copies with headlines or logos on top. Checked by a built-in test set of 200+ distorted copies. (3.3.1, 3.4)
- **Shows what an AI edit changed:** green for untouched, red for redrawn, "Same photo, heavily edited" verdict, Pick a spot for a close-up score, and Check nearby shots to see which of several similar frames the copy came from. (4.8)
- **No false matches** from tiny shrunk guesses or press walls (sponsor backdrops with repeating logos). (4.2.2, 4.8.3)
- **Logos and buildings are not copies.** When only printed logos, signs or lettering line up (a sponsor wall, a red carpet backdrop, a shop sign, a logo file), it says "Different photo, only the logos match". When a scene lines up but things at different distances shift against each other (a building shot from a few steps away), it says "Different photo of the same place". Both are thrown out of searches and show a low %. Unanswered copies already found are checked again once. (4.31)
- **Mark up a copy:** highlight, box, circle, arrow, text, pick an area; copy to clipboard or save as PNG/PDF. Labelled "Marked-up copy" and never added to the pack. (3.0)
- **Copy picture link.** Right-click a picture: its own web address is copied (on TikTok slideshows, with the slide number). (4.33)
- **Only a seal, a slice or a pattern.** Different photos that share only a podium seal or wall crest, only a small slice of each picture, or only a repeating pattern (fence, checkered floor, tiles) are called "Different photo" and show a low %. (4.39)

## 4. Find copies of client photos

- **Reverse image search** on Google Lens, Yandex and Bing, many photos at once, with each link given a % match by PageProof's own photo check (Same photo / Maybe / Different). (3.8 to 3.10)
- **Connect the shared Google Drive** through Drive for desktop. Pick only the folders to search; each ticked folder is a client. Reads the team's `client_info.txt` and `client_info_ignore.txt` files. Drive is only ever read, never written. (4.0 to 4.3.2)
- **Keep searching:** one photo at a time all day in a pinned tab, at a gentle, steady or faster pace, inside work hours. If a site shows a robot check, that site rests for an hour (never bypassed). (4.0, 4.4.3)
- **Today's 50** batch alongside Keep searching. (4.0)
- **Smart order:** High priority photos, priority clients, newest photos, popular and stolen-before photos, then the rest. Quiet photos are searched less often. (4.0)
- **Every photo searched at least once,** with a progress bar per client on Keep searching and Home. (4.10)
- **Clients and photos** table for 30+ clients and 100,000s of photos: star priority clients, choose which clients you search, bulk changes. (4.0)
- **New Drive photos join automatically** (hourly check of recent folders, full check once a week on a weekday). (4.0, 4.0.7)
- **Searches never pull you away:** they run in the pinned Keep searching tab, tabs show the PageProof logo, finished tabs always close. (4.0.12 to 4.13)
- **Copyright registration number** found from the photo's folders or files, plus the full Drive path. (4.0)
- **Skipped photos list**, broken search site detection, POOL photos left out. (4.1, 4.4)
- **Built for big libraries and many kinds of PCs:** photo checks run in the background, cached folder lists, computer check (Light/Normal/Strong). (3.10 to 4.3.1)
- **Faster photo checker:** now uses WebAssembly, gives the same answers, and is about 3x faster on photos that are different. (4.16)
- **Mirror check** flips your photo once instead of every time. (4.16)
- **Links on hidden sites are not downloaded or checked;** approved sites are checked last. (4.16)
- **Photo checker uses the graphics card** (WebGPU) for finding details, pairing and lining up, but only when that PC's own timing shows it is faster. (4.17)
- **Owner check tabs** open pinned in the background with the PageProof logo. (4.20)
- **Computer check sets every part of a search** to suit the PC, and big searches ease off when the computer is busy. (4.21)
- **Reddit and forums never show.** Your team never pursues forums, so every Reddit link (reddit.com, old.reddit.com, redd.it, i.redd.it, preview.redd.it, redditmedia.com) is dropped from searches. Clear forum addresses go too: forum.*, forums.* or boards.* sites, pages under /forum/, /forums/ or /threads/, phpBB / vBulletin / Simple Machines pages (viewtopic.php, showthread.php...) and Discourse topics (/t/title/123). Copies found before are off Copies found; ones already marked Stolen stay. (4.34)
- **The photo must be on their page itself.** A match made on Google's small preview is checked against the page during the search: the article's own pictures count, comments, sidebars and "related" boxes don't. If the photo isn't there, the match is left out; if the page can't be read, it's only a Maybe. (4.35)

## 5. Review the copies found

- **Copies found** list with answers right on each row: Stolen, Licensed, Remove, Skip. Every answer opens the next copy. (4.0, 4.2)
- **Undo anything,** step by step, with a list of the last 10 answers. (4.0, 4.2)
- **Calm details panel:** pinned answer bar, a "Look at these" box that only shows problems, tabs (Summary / Their page / Claim / Site), side by side or slider picture view, fact chips. (4.7)
- **Their page picture** kept in the panel, and **their copy kept** in case they delete it. (4.2)
- **Filters you can see:** quick filter buttons, chosen filters in solid blue with ✓, "Showing 3 of 8 … Clear filters". Found-when, match strength, year and quarter filters. (4.2, 4.11)
- **Group by site or site owner,** fold "N more from this site", sister sites together, one row per page (same page at different addresses merged). (4.2, 4.14)
- **One at a time** view for fast reviewing. (4.2, 4.3)
- **Hide a site** (this account / this sub-site / whole domain), **Approve a site** for one client or all, hidden countries. (3.10 to 4.6.5)
- **Countries: pick the ones to show.** Website copies show only from the countries you pick (United States and Puerto Rico to start); sites whose country isn't known always show. (4.27)
- **Before you mark Stolen:** rule check by kind of site, photo credit read from their page, signs it was on purpose, date first published, damages hint, and a Ready for legal checklist. (4.4)
- **Breaking News saver:** saves a photo named the firm's way and checks if it's new or recycled. (4.4)
- **Site owners** page groups sites run by one company (footer name, shared analytics IDs). **Who's behind this site** helps with OpenCorporates, USPTO and Google lookups. (4.0)
- **Stolen copies are protected:** never hidden by a bulk Remove or a site hide. (4.15)
- **Stolen before links:** add a file of links already claimed. A copy on one of those pages gets a red "Stolen before" tag, other pages on the same site or account count as repeat offenders, with a quick filter. (4.23)
- **Spam blogs hidden:** copies on random-looking addresses of throwaway sites get a grey Spam blog tag and stay out of the list until you choose Show them. Hide all of those sites in one click (undoable). Nothing is answered for you. (4.24)
- **Undo a file added** to hidden or approved sites, or take out all of a file's sites. (4.22, 4.23.1)
- **Team lists:** hidden and approved sites shared through one PageProof Team folder, showing who added each one, with a flag when the team disagrees. (4.18)
- **No double answers** from a held-down key, and a "too fast?" check. (4.15)
- **Picture link and TikTok slides.** The copy panel shows the address of their picture itself (Copy link, Open), and the Evidence report lists it. TikTok slideshows are checked slide by slide ("Slide 3 of 4"). (4.33)

## 6. Social media accounts

- **Websites and Social media tabs.** On social sites, Stolen, Hide and Approve work per **account**, not the whole site. About 80 social sites known, new ones spotted automatically. A whole social site can never be hidden. (4.9, 4.9.5)
- **Account finder** from the link, short links, public post info, page tags or your own browser. **Same person** joins accounts across platforms. (4.9)
- **Followers, Verified, account type, country and company** read automatically (no typing by hand), with filters and sorting. (4.12)
- **X details read right.** Followers, check mark and type come from the account itself, not your own account or X's page footer ("X Corp."). (4.27)
- **Kinds of check mark, drawn like the site.** X blue = Paid (bought), X gold = Verified organisation, grey = Government, Instagram/Facebook = Meta check (paid or earned look the same), others = Verified. Filter "Really verified (not bought)". (4.27)
- **Government accounts hidden.** Anyone in or running for public office (Congresswoman, Councilman, "for Council", campaign or .gov sites, grey check) is type Government and hidden unless you tick Show government. (4.27)
- **Real names on accounts.** "Jamie Rivera" (made-up example) instead of the number from the link, with the handle small beside it (Facebook numbers, YouTube channel IDs and more). Country filled from Facebook Page transparency or the place on the profile. (4.27)
- **Never your own name on someone else's account.** Instagram, Threads and TikTok pages also carry the signed-in person's own details (name, followers). PageProof now reads only the viewed account's own part of the page, and Facebook's hidden page data is not used at all. Accounts read before this fix are read again by themselves. (4.30.1)
- **Only the post's own picture counts.** Google Lens can show your client's photo next to a Facebook or Instagram link when the post itself shows something else (a video, another photo). PageProof now lines up the post's own picture (or video cover) with your client's photo; a clearly different picture sends the match to Removed by itself ("Not seen in the post", Put back still works). The panel also says where "Theirs" came from: the search site's small preview or a picture from their page. (4.30)
- **Social media means the 16 main platforms only** (YouTube, Facebook, Instagram, TikTok, X, LinkedIn, Pinterest, Threads, Snapchat, Tumblr, Bluesky, Substack, Nextdoor, Truth Social, Vimeo, Behance). Every other site is a normal website again, so country filters and whole-site hiding work on it. No more "is this social?" questions. (4.25)
- **Reposts and shares spotted and hidden.** Facebook shares, X reposts and quotes, Instagram, Threads, TikTok and Bluesky reposts and Tumblr reblogs are tagged "Share of …" / "Repost of …", hidden until you tick Show reposts and shares, and point to the original post and account as the lead. Never answered for you. (4.32)
- **Exact post found when the link is only an account page.** PageProof scrolls the account page in a quiet background tab (following Pause, hours and per-site limits), lines each post's pictures up with your client's photo and links the post that holds it. Capture captures that post. (4.32)
- **Every picture of a social post checked.** When a post's main picture isn't the photo, the post is opened in your signed-in browser and every picture (albums, video covers) is looked at, leaving out comments, replies, link previews and "More posts" grids. Only then is a match moved to Removed (Put back works). (4.35)
- **Personal accounts hidden.** Copies from someone's own account (just a person's name, no company, website or contact details; a Facebook profile with friends, a LinkedIn /in/ profile, an X name-only account under 100k followers) are hidden until you tick Show personal accounts. Stolen copies always stay. "Type is wrong?" sets an account's type by hand. (4.36)
- **Politicians caught more often.** Also "serving … District", "(R-Ohio)", committee badges, @Rep… / @Sen… handles and "Rep." in the post title, even before the profile is read. (4.36)
- **Link previews are not copies.** A match that is only the picture in a link preview card (a LinkedIn, X or Facebook post sharing an article) is thrown out during the search, or moved to Removed ("Only in a link preview", Put back works). (4.36)

## 7. Everyday tools

- **Convert files:** picture types (incl. iPhone HEIC, TIFF, AVIF), make pictures and PDFs smaller, rotate/crop/resize, join and split PDFs, save Word/Excel/email files as PDF. Nothing is uploaded. (3.6)
- **Open odd files:** Outlook .msg and .eml (with attachments), ZIP/RAR/7-Zip/TAR, Mac Pages/Numbers/Keynote. (3.6)
- **Right-click menu:** Inspect this photo, Find copies of it, Save biggest copy (Save As window), Open biggest copy, Save as Breaking News photo, Capture this page, Capture the linked page. Finds pictures hidden under Instagram/Facebook covers. (3.7 to 4.5.1)
- **Copy** a whole capture to the clipboard. (3.0)

## 8. Easy to use

- **Two full redesigns** (4.0 and 4.2): clean menu, top search, new blue shield logo, one blue theme everywhere. (4.0, 4.2, 4.9.3)
- **Short menu:** Home, Copies found, Clients, Evidence, Settings. (4.14)
- **Home to-do list** of what to do now, status line at the bottom, same page headers everywhere. (4.14)
- **Toolbar popup** with a big Capture button, and a **side panel** that stays open beside any site. (4.0)
- **First-time setup** in a few steps, a 5-step tour, and a What's new page after updates. (4.0)
- **Light and dark mode** (dark inside every tool), text size switch, line icons, keyboard help on `?`. (4.3)
- **Evidence library** with picture cards. (4.14)
- **Hover help** on terms, and buttons that say why they're greyed out. (4.0, 4.15)
- Fills wide screens and works in narrow windows. (4.2.3, 4.5)
- **One-click install and update on Windows:** Update-PageProof.cmd on the download page puts the newest version into Documents › PageProof › Install for whoever runs it. (4.32.1)

## 9. Safety nets

- **Settings backup** in `Documents\PageProof` and a "Bring them back" offer after reinstalling. (4.0)
- **Daily backup to your own Google Drive** on work days (last 14 kept), Back up now, and restore by date with a preview and a safety copy first. Moving to a new computer page. (4.18)
- **One PageProof folder** and a fixed extension ID, so data survives moving the folder. (4.6)
- **Reconnect your folders first** after every update. (4.3.7)
- **Pages never hang on Google Drive** (every Drive question has a time limit); a red bar says what Drive answered. (4.3.3 to 4.3.6)
- **Is everything working?** health page, Copy details for support, storage meter with safe clean-up (never touches Stolen). (4.1, 4.3)
- **Where the time goes** is shown on Is everything working. (4.16)
- **Graphics card row** on Is everything working. (4.17)
- **Pause really stops everything.** Pause or Off stops the photo being searched, any big search (today's 50, New search) and the account details reader at once, and closes their tabs. Resume picks up where it stopped, including the rest of a big search. The account reader only works in your Keep searching hours, only for accounts with copies still to review (or when you open a copy), keeps what it read for 90 days, and has hard limits per site (X: one profile every 2 minutes, 30 a day; a site showing empty pages is left alone for 6 hours). Only the profile is opened for X, Instagram and Threads (their "About this account" is skipped; Facebook still reads Page transparency). "Read account details" switch on Keep searching, which shows "Reading account details 12 of 80". No more "beforeunload" errors on edge://extensions. (4.30.2)
- **Keep searching guards:** reopens if closed by mistake, tab title says leave open, starts fresh after updates. (4.4.3, 4.9.4, 4.15)
- **A long hidden sites list no longer slows PageProof down** (9,000 copies against 25,000 hidden sites: from 7 seconds to under a tenth of a second). (4.22.1)
- **Folder name warnings** when a photo folder looks wrong. (4.15)
- **Automatic tests** run before every release. (4.1)
- **Nothing writes into its own program folder** (after Windows Defender flagged a self-updater, it was removed). (4.2.1)
- **New versions in about a minute:** the download link is updated a minute after each change, and the automatic checks run side by side before it. (4.31.1)
- **Bing only brings back real matches.** Only Bing's "Pages with this image" list is read, never its look-alike photos. (4.36.1)
- **How PageProof is doing.** Day-by-day stats for this computer (found, speed, links thrown out and why, each search site, Keep searching on-time, Drive, photos covered, computer strain), "Something looks off" alerts, a Checker test with made-up pictures, and Save stats for Claude (one file, numbers and website names only) plus a weekly file on Fridays. (4.37)
- **Bing finds copies again.** Bing's "Pages with this image" and top 60 "Visual matches" are read, each with its picture, and checked like Google's. (4.37.1)
- **Signed-in check.** Settings › Is everything working? shows whether this browser is signed in to Facebook, Instagram, X, TikTok, LinkedIn, Google and Bing (only whether the sign-in is there, nothing else is read), with why it matters and a Sign in button. (4.38)

---

## Things we tried and took out

So nobody asks for them again by accident:
PNG output (1.4), carousels / fold-outs / sideways scroll (1.8), Wayback Machine saving (2.6), batch "capture a list of links" (4.0), abuse contacts and takedowns (4.0), the self-updater and Update button (4.2.1, 4.13.1), the "still online" checker (4.15), dark mode switch on old pages (3.2.2).

---

## Version timeline

| Version | Date | What changed |
|---|---|---|
| 1.0 | 4 Nov 2026 | Whole-page capture with domain banner, scroll boxes as sections, PDF + HTML |
| 1.1 | 4 Nov | Full-screen scroll box pages, always start at the top |
| 1.2 | 4 Nov | Evidence pack zip, self-contained HTML, SHA-256 fingerprints, richer banner |
| 1.3 | 4 Nov | Case details, server details, page source, trusted timestamp, capture log |
| 1.4–1.6 | 4 Nov | PNG dropped, README in every zip, zip naming with Capture ID |
| 1.8 | 4 Nov | Dropdowns written out, endless pages stop, click to stop |
| 2.0 | 5 Nov | Verify page, three timestamp services, VERIFYING.md and TUTORIAL.md |
| 2.1 | 5 Nov | Offline checker inside every pack |
| 2.2 | Nov | Who hosts this site |
| 2.6 | Nov | Wayback removed, IPv6 host lookup |
| 2.7–2.8 | Nov | Reels, Shorts and TikTok capture only the visible video |
| 2.9 | Nov | Collected by remembered, case number starts empty |
| 3.0 | 10 Nov | Mark up a copy |
| 3.1–3.2 | 10 Nov | New top bar, then left sidebar; sticky bars hidden |
| 3.3 | 16 Nov | Image Inspector, Compare page, icon menu |
| 3.4–3.5 | 17 Nov | Line-up for stretched/tilted/mirrored copies, Colour check, MP4 video |
| 3.6 | 17 Nov | Convert files, Open odd files |
| 3.7–3.8 | 19 Nov | Right-click menu, biggest copy, reverse search |
| 3.10–3.12 | 19 Nov | Batch reverse search, own photo check, Evidence report PDF |
| 4.0 | 20 Nov | Redesign + Find copies: Drive, clients, Keep searching, Copies found, Undo, owners |
| 4.1 | 20 Nov | Health page, skipped photos, broken search site check, auto tests |
| 4.2 | 20 Nov | The New Look: answers on rows, quick filters, their page, new logo |
| 4.3 | 21 Nov | Proof checklist, dark tools, storage meter, keyboard help, text size; Drive read-only guard |
| 4.4 | 23 Nov | Rule check, their page read for you, Breaking News saver; pinned Keep searching tab |
| 4.5–4.6 | 23 Nov | Wide screens, right-click symbols, one PageProof folder |
| 4.7 | 23 Nov | Calmer Copies found list and details panel |
| 4.8 | 23 Nov | Compare shows AI edits; press-wall false matches gone |
| 4.9 | 23 Nov | Websites and Social media tabs, per-account answers |
| 4.10 | 23 Nov | Every photo searched at least once, with progress |
| 4.11 | 23 Nov | Chosen filters easy to see |
| 4.12 | 23 Nov | Followers, verified, account type, country, company |
| 4.13 | 23 Nov | Big searches run in the background tab; update check removed |
| 4.14 | 23 Nov | 5-item menu, Home to-do list, pop-ups closed, one row per page, Needs a capture |
| 4.15 | 24 Nov | Mistake-proofing; Still online check removed |
| 4.16 | 24 Nov | Faster photo checker (WebAssembly) |
| 4.17 | 24 Nov | Graphics-card photo checker |
| 4.18 | 24 Nov | Daily backup to your own Google Drive, safe restore, team lists |
| 4.19 | 24 Nov | Full-page capture fixes for tricky layouts |
| 4.20 | 24 Nov | Owner check tabs open pinned in the background |
| 4.21 | 24 Nov | Computer check sets every part of a search |
| 4.22 | 24 Nov | Undo a file added to hidden or approved sites; long lists fast |
| 4.23 | 24 Nov | Stolen before links in Copies found |
| 4.24 | 24 Nov | Spam blog copies hidden until you show them |
| 4.25 | 24 Nov | Social media means the 17 main platforms only |
| 4.27 | 24 Nov | X details fixed, check kinds, Government hidden, countries to show, real account names |
| 4.30 | 24 Nov | Social matches only count when the post's own picture is the photo; "Theirs" source shown |
| 4.30.1 | 24 Nov | Fix: Instagram accounts showed your own name; viewer's details left out, accounts read again |
| 4.30.2 | 24 Nov | Pause and Off stop everything at once (big searches, account reader, their tabs); Resume picks up where it stopped |
| 4.31 | 24 Nov | Logos and buildings no longer count as copies (only-logos and same-place checks) |
| 4.31.1 | 24 Nov | Fix: New versions reach the download page in about a minute |
| 4.32 | 24 Nov | Reposts and shares spotted and hidden, original poster as lead, exact post found on account-page links |
| 4.32.1 | 24 Nov | Fix: Update-PageProof.cmd on the download page for the team |
| 4.33 | 24 Nov | Picture links on every copy; TikTok slideshows checked slide by slide |
| 4.34 | 24 Nov | Reddit and forums dropped from searches; social list is 16 platforms |
| 4.35 | 24 Nov | Photo must be on their page itself (checked during the search, every picture of social posts) |
| 4.36 | 24 Nov | Personal accounts hidden, politicians caught more often, link previews are not copies |
| 4.36.1 | 24 Nov | Fix: Bing reads only "Pages with this image" |
| 4.36.2 | 24 Nov | Fix: Social media tab number leaves out hidden copies |
| 4.37 | 24 Nov | Stats page, Checker test and Save stats for Claude |
| 4.37.1 | 24 Nov | Fix: Bing reads its Visual matches with their pictures |
| 4.38 | 24 Nov | Far fewer "Picture blocked" links (lazy pictures, Facebook/X links, page fallback) |
| 4.39 | 24 Nov | Seals, crests, small slices and patterns (fences, floors) no longer count as copies |
| 4.40 | 24 Nov | New look part 1: menu, top bar and Home |
