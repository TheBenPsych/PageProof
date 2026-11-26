# PageProof: every feature and improvement

This is the running list of everything PageProof can do and every improvement made to it.
It is grouped by **what the tool does**, then there is a **version timeline** at the bottom.

> **Keeping it up to date:** don't edit this file by hand for a new change. Add a note in
> `changes/` (see CONTRIBUTING.md): the release build adds it here, in the right group and as
> one line in the timeline, with the version number. Plain words only. No client names, real photos or real
> case details (this repository is public).

Last updated: version **4.84.0** (26 Nov 2026).

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
- **Never short on timestamps.** A timestamp service that doesn't answer is asked again twice, then GlobalSign or Entrust stand in, so every pack gets three trusted timestamps. (4.41)
- **Calm All evidence.** Captures and Evidence reports tabs, picture cards by week and month or a list, badges for what is missing, quick filters, a details panel per capture, Group: Case number, Match ID copy, Download list for both tabs, Show in Downloads. (4.78)
- **Waiting for a capture.** Stolen copies with no evidence pack show in a bar and a filter in All evidence, on Copies found › Not finished and on Home, with how long the oldest has waited. (4.78)
- **Evidence Overview.** Tiles, captures per week, Needs you, newest captures, where captures come from, most captured sites and cases, how captures went, how often each trusted time service answered, where the packs are. How to capture sits behind one button. (4.79)
- **Calm Weekly summary.** Week picker, six tiles with arrows against the week before, the last 8 weeks as a chart, By client table you can sort, clients not searched, first searches, evidence reports with case tags, and a PDF that shows the same as the screen. (4.80)
- **Calm All tools.** Six real tools, one box that takes any file and opens the right tool, and Opened lately with Open again (kept only on this computer). (4.81)
- **Calm Verify a pack.** In the Tools menu: one big answer, four tiles, capture details and timestamps as rows, file names in a fold. The checker inside each pack is unchanged. (4.81)
- **Calm Inspect a photo.** The file on one line with its buttons, the picture on the left, yes or no chips and one row per fact on the right. Save evidence pack asks for the case details first, and Copy the details copies every row. (4.82)
- **Calm Compare two photos.** Both files on one line with Swap, the view bar floating on the picture, the result and three folds on the right. (4.83)
- **Calm Mark up a copy.** One toolbar across the top of the picture that stays in view on long captures. (4.83)
- **Calm Convert files.** Two tabs (Convert files, Open odd files), numbered steps on the right, and one box to drop files in. (4.84)

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
- **Moved or renamed photos keep their history.** When a folder is renamed or a shoot is moved in Google Drive, PageProof recognises the photos and keeps their copies, answers, flags and search dates. A ticked folder that can't be found any more gets a red line on Home. (4.41)
- **One search line.** Big searches no longer stop Keep searching; it carries on at half speed and skips their photos. (4.42)
- **Each search site at its own speed.** Google keeps the pace; Yandex and Bing search another photo (a re-search) while Google is busy. Every first search still uses all three. (4.42)
- **New photo fast lane.** Photos that arrive in a client PageProof already knows are searched first, then again 3, 7 and 14 days later. (4.42)
- **A goal instead of a pace.** Set a date for every photo's first search; PageProof picks the pace (never faster than is safe) and says on track or behind, with the real end date. (4.42)
- **Hot shoots.** Marking a copy Stolen sends the other photos from that folder and day to the front of the line (Undo puts them back). (4.42)
- **Bursts.** A frame that looks almost the same as one already searched with nothing found waits until every other photo had its first search, and goes at once if its twin finds copies. (4.42)
- **Camera dates.** A photo whose folders give no year gets its date from the camera (EXIF). (4.42)
- **New client folders.** Once a week PageProof lists the folder names in Google Drive (names only) and Home shows new folders that aren't ticked. (4.42)
- **The match in the Evidence report.** Page 2 shows your client's photo with their copy laid over it where it fits, the matching details marked and the shared area outlined, with one plain sentence: "N details line up across P% of the shared area." (4.47)
- **Search pages filled out.** A square per photo, time left, per-site cards, copies as pictures, What's happening; All searches by day with weekly numbers. (4.48)
- **Speed ladder.** On Faster, Keep searching speeds up one step after every calm hour (2 min, 90 s, 60 s, 40 s; 30 s if picked) and drops two steps for the day after a robot check. (4.49)
- **Quick looks.** Yandex and Bing give every never-searched photo a quick look in their own lane; Google follows, and a copy found in a quick look sends the photo to Google next. (4.49)
- **Look-alike frames share a search.** Nearly identical frames from the same shoot come along with a photo's search and every find is checked against them; they get their own search after the first pass. (4.49)
- **Speed meter.** Photos searched a day this week, plus a done-by date per client and overall, on Clients and photos and Keep searching. First searches mix in random older years (1 in 3). (4.49)
- **Copies inside collages are found.** Side by side, stacked, three panels or a photo pasted over a corner: the other picture is left out of the score. (4.49.1)
- **Search tabs at full speed.** The waits inside a background search tab come from PageProof's own clock (a hidden tab's waits are stretched to a second each), and every result picture is told to load straight away, so results lower down the list keep their picture. (4.50)
- **Google exact matches read on their page.** When Google lists a page under Exact matches but its small preview doesn't line up, the page's own pictures are checked at full size (up to 10 links a photo). (4.50)
- **Posts with several pictures.** A post a search site listed whose cover is another photo is kept as "Checking the post", and the post check looks at every picture in your browser before it stays or goes. (4.50)
- **Credit search.** Once a week per wording, in your hours, PageProof asks Google for pages that print a client's photo credit ("Photo: Harbor Times", made-up example) and compares their pictures with that client's photos. Matches go to New as "Found by credit search"; pages that credit the client but show none of their photos are listed to look at by hand. A robot check rests Google for an hour and is never got around. (4.51)
- **Watching.** A site or social account with 2 or more Stolen copies is watched: once a week only its new posts (its news feed or sitemap, or the account's newest posts) are compared with every client's photos. Old Stolen pages are never opened again. Add or stop watching any site or account by hand. (4.51)
- **Seal close-ups aren't copies.** A close-up showing only a seal or emblem that also appears in your photo is thrown out. (4.51.3)
- **Search now on Credit search runs on that page**, with a progress bar (wordings searched, pages read, copies found, credit but no photo) and a summary when it finishes. A page showing a copy already in Copies found is no longer listed as "credit but none of their photos". (4.52)
- **Extra searches card on Keep searching.** Sweeps, Credit search and Watching each show what they are doing now and their last 7 days: work done, copies found and time spent. (4.52)
- **Credit search on Google and Bing.** Each wording is searched on both; a page both list (even spelled a little differently) is read once. A robot check rests only that site for an hour and the other carries on. (4.52)
- **Photos you stopped.** The client's photos page counts photos nobody searches any more, can show only those, and has Stop searching / Search again for picked photos. (4.55)
- **One at a time: Websites, Social media or All.** A switch at the top picks which copies to go through; the choice is remembered. (4.56)
- **Searches run in their own minimized window.** All search tabs open in one minimized "PageProof searching" window instead of pinned tabs in yours; Keep searching › Where searches run switches back to pinned tabs. (4.61)
- **Calm Clients and photos, Registrations inside.** Tiles, command bar, one line per client (Done by and Registration columns, switched-off clients at the bottom), floating bar for ticked clients and photos, Registrations panel (Not registered / Applied / Registered lately, one number box per folder, Copy for the registrar, opens from a copy's Claim tab on that folder), client page with folder number lights, filters, sort, picture size, photos grouped by folder and a photo panel. (4.76)
- **Calm Skipped photos.** Four reason cards that filter, find box, group by client or flat, sort, Download list (CSV), Try all again, tick boxes with a floating bar, a photo panel (what to do, Copy folder path, Take off this list with Undo) and an "N skipped" chip on each client. (4.77)
- **TIFF and HEIC photos are searched.** PageProof reads them in memory with its own readers (read only, nothing is saved or changed in Drive). Files over the size limit are left out. (4.77)

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
- **Country for .com sites too.** When a site's ending doesn't say a country (.com, .net, .fit ...), PageProof reads the page for its address, its language setting (tr_TR, bg-BG) or a one-country language (Bulgarian, Turkish ...). English and other many-country languages never count on their own. The copy's Site tab says how it was worked out. (4.56.1)
- **Before you mark Stolen:** rule check by kind of site, photo credit read from their page, signs it was on purpose, date first published, damages hint, and a Ready for legal checklist. (4.4)
- **Site owners** page groups sites run by one company (footer name, shared analytics IDs). **Who's behind this site** helps with OpenCorporates, USPTO and Google lookups. (4.0)
- **Stolen copies are protected:** never hidden by a bulk Remove or a site hide. (4.15)
- **Stolen before links:** add a file of links already claimed. A copy on one of those pages gets a red "Stolen before" tag, other pages on the same site or account count as repeat offenders, with a quick filter. (4.23)
- **Spam blogs hidden:** copies on random-looking addresses of throwaway sites get a grey Spam blog tag and stay out of the list until you choose Show them. Hide all of those sites in one click (undoable). Nothing is answered for you. (4.24)
- **Undo a file added** to hidden or approved sites, or take out all of a file's sites. (4.22, 4.23.1)
- **Team lists:** hidden and approved sites shared through one PageProof Team folder, showing who added each one, with a flag when the team disagrees. (4.18)
- **No double answers** from a held-down key, and a "too fast?" check. (4.15)
- **Picture link and TikTok slides.** The copy panel shows the address of their picture itself (Copy link, Open), and the Evidence report lists it. TikTok slideshows are checked slide by slide ("Slide 3 of 4"). (4.33)
- **Rule suggestions.** 5 Removes on one site this month suggest hiding it; 3 Licensed for one client suggest approving it for that client; a site named like the client asks if it is their own site. Undo, Not now and Never ask. (4.43)
- **One row per page.** Several of your photos on one page show as one row ("3 of your photos on this page") with one answer for all, or Answer one by one. (4.43)
- **Same story on many sites.** The same headline on 3 or more sites within 3 days shows as one row (often a news feed the client licenses). (4.43)
- **Weak Maybes put themselves away.** A Maybe under 50% nobody answered in 30 days moves to Removed ("Weak Maybe, never answered"); not on sites with a Stolen copy; not learned as your answer. (4.43)
- **Sweep a Stolen site.** Reads the site's sitemap slowly in your hours and compares its pictures with that client's photo fingerprints; matches show in New as "Found by sweep". No search site searches used. (4.43)
- **Registrations.** Clients › Registrations lists photos that have copies found but only an application number or no number, Stolen ones first, with a list to copy for the registrar. A VA number added later moves the photo to Registered lately. (4.51)
- **Find the company, the firm's way.** Who's behind this site lists every name the site goes by (footer, Terms of service, Privacy, About, the site's data, the domain record and the site's Facebook Page transparency), marks each as a brand or a company, and gives a 3-step checklist: names, brand to company (Justia, USPTO, OpenCorporates, SEC), is it active (state search, past lawsuits, DMCA agent directory, Delaware last). (4.51)
- **Company card and status.** Each site gets a company card with the firm's fields (entity name type, entity name, other names, state, entity number, what the registry says, registered agent, addresses, DMCA agent) and status: Seemingly viable, Not a viable entity or Not checked yet. The status shows on every copy from that site, Ready for legal needs an active company, and copies on a site that is not a viable entity go to the bottom. (4.51)
- **Legal portal card.** A Stolen copy's Claim tab shows the portal's Add Infringement boxes in the portal's order (Artwork, Discovery Date and Method, Infringing Domain, Page URL, Infringer Use, Paid Ads, Sells Product, Agency Case #, Damages, Infringing Image Url, Note), filled from the copy. Click a line to copy it, or Copy all. It also shows the Certificate and Application numbers to check and the screengrab file to upload. (4.52)
- **Portal card drop-downs.** Lines that are drop-downs in the portal say exactly which choice to pick (Reverse Image Search; Website, Social Media or Embed; Commercial or Editorial; Yes or No; Statutory, Actual or Cannot Determine Damages). (4.52.3)
- **Stop searching this photo.** From a copy's details panel, ⋯ menu or One at a time; Keep searching and Today's 50 skip it, copies stay, Undo or "Search again" on the client's photos page brings it back. (4.55)
- **Check later.** A copy you're not sure about goes to its own Check later tab (button or C key), out of the New list, until you answer it. Undo works. (4.58)
- **How popular the site is.** Website copies get Top 1K / 10K / 100K / 1M tags from the free Tranco list (downloaded weekly, looked up offline). Gold tag and edge for the top 10K, "Big sites" quick filter, Site popularity filter, "Most popular site" sort, World rank in the Download file and a card on the stats page. Social sites, free blog hosts and marketplaces get no rank. (4.60)
- **Known bad sites.** Free lists of piracy, scam, phishing and malware sites (The Block List Project, URLhaus, OpenPhish), downloaded by themselves and looked up offline. Red tag, counts as Suspicious, "Known bad sites" quick filter. A top 10K site is only flagged by the piracy list. (4.60)
- **Stopping a photo clears its matches.** Unanswered matches of a stopped photo move to Removed (tagged "Photo stopped"); Stolen and Licensed stay; Undo or Search again brings them back. (4.62)
- **Finish this claim.** Pressing Stolen opens the claim steps in the copy panel: good case first (right photo, on their page, viable owner), then capture, evidence report and legal portal boxes, then Sent to legal. "Not a viable entity" closes the claim with nothing captured. Unfinished claims wait in the Not finished tab. (4.63)
- **Calm All copies list.** One command bar (Group, Filters, Sort, Download, Columns), the column names once above the list (click Match or Found to sort), copies as cards, a tick box that picks every copy showing, a blue dot on copies found since your last visit. (4.66)
- **Calm copy panel.** Three tabs (This copy, Claim, The site), the two pictures named "Your client's" and "Theirs", a line of facts under them, and a left edge you can drag to make the panel wider (remembered on this computer). (4.66)
- **Calm One at a time.** One control line, the two pictures named on their corners, five big answer buttons with icons, a command row (Stop searching this photo is under ⋯), and a side card with the site, the match, Page and Picture links (open and copy) and the tabs Their page / About this copy. Both cards fit a 1080p window without scrolling. By site and company is a list. (4.67)
- **Calm Keep searching in four tabs.** Now (Searching now card, Up next with the reason, Search sites and Social media with today's counts, rest and cool-down times, four number tiles, Last searches with what each found, Today's 50, Extra searches), Progress (ring, Google and Quick look bars, goal line, Kept up to date rings, how searches are shared, 7-day chart), Clients (find, All / ★ Priority / Not done, sort) and Settings (rows for Speed, When, Search sites, Where and what, Today's 50). The tab stays open after a reload. (4.68)
- **Calm New search and Search results.** New search: photos as real thumbnails with Add photos, From my clients' photos, Paste a link (a box on the page) and Clear all; Search on switches, Speed choices and one Search button that says how long or what is missing; Recent searches. Search results: one progress card (ring, sent to Copies found, thrown out, time, a light per search site), every photo as a picture coloured by what it found, the picked photo with its facts, a line per search site, Copies it found, Thrown out folded, and What's happening. (4.69)
- **Calm All searches.** Command bar (New search, All / New searches / Today's 50 / Keep searching with counts, Only searches that found copies, Find a photo or client, one Delete for the ticked searches with Undo), last 7 days as tiles and a chart, a Running now card (progress, photos, Open, Stop), named columns, a heading per day with totals, thumbnails, numbers for Same photo / Maybe / New, Keep searching's fold opening as a photo grid, and Search the last N on a search that did not finish. (4.70)
- **Calm Credit search in three tabs.** Overview (live search card with Stop, search site lights and the next weekly search, four tiles, Last searches in columns, Wordings that find copies over 30 days, How it works in 3 steps), Clients (find, All / On / Off / Own wordings, sort, wording chips, a panel per client to add and remove wordings and see what each found, Change the usual wordings for every client at once) and Credit but no photo (find, client box, sort, Open page, Look closer in Inspect a photo, Take off). The tab stays open after a reload. (4.71)
- **Calm Watching with turns.** Tabs All / Websites / Social accounts / Not watching, Checking now card with Stop, Needs a look, four tiles, Turns card (every week, month or 3 months, with the reason on every row; down after 3 and 6 empty checks, back to weekly on a find), This hour on this PC (one shared slot for sweeps, Credit search and Watching: 12 minutes an hour, 6 on a Light computer; Watching 3, 6 or 12, changeable; uses the time Google or Bing rest; 5 social accounts an hour), lighter checks for quiet turns (15 or 10 posts, main picture only), opt-in watching of stolen before list sites with 2 or more links every 3 months, find, sort, a ⋯ menu, and a panel per site with its last 5 checks. (4.72)
- **Calm Site owners under Copies found.** Tabs Owners / Look up a site, list with Sites, Copies, New and Stolen columns, find, kinds, sort, owner header with four clickable tiles, Why they're one owner with proof, Their sites table, What their sites say grouped, Clients they copied, Copy owner details, sites read lately on the Look up tab. (4.73)

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
- **Second look for close calls.** A Same photo with a thin margin is checked again more slowly with both pictures at full size; if that disagrees it becomes Maybe or is thrown out ("Different on a closer look"). (4.47)
- **Second chance for exact matches.** A link Google lists under "Exact matches" that the fast check throws out is checked again at full size first. If it is still different it shows "Google said exact" in the thrown-out list. (4.47)
- **Your own real test set.** Removing a Same photo or pressing "It is a copy" keeps a small pair (both pictures, at most 800 pixels) in Documents\PageProof\checker-tests, on this computer only. The Checker test runs these real pairs as well as the made-up ones. (4.47)
- **Where the checker goes wrong.** How PageProof is doing shows the checker's answers next to yours for the last 30 days, by kind of site (news, social media, shops, stock photo sites, blogs). (4.47)

## 7. Everyday tools

- **Convert files:** picture types (incl. iPhone HEIC, TIFF, AVIF), make pictures and PDFs smaller, rotate/crop/resize, join and split PDFs, save Word/Excel/email files as PDF. Nothing is uploaded. (3.6)
- **Open odd files:** Outlook .msg and .eml (with attachments), ZIP/RAR/7-Zip/TAR, Mac Pages/Numbers/Keynote. (3.6)
- **Right-click menu:** Inspect this photo, Find copies of it, Save biggest copy (Save As window), Open biggest copy, Capture this page, Capture the linked page. Finds pictures hidden under Instagram/Facebook covers. (3.7 to 4.5.1)
- **Copy** a whole capture to the clipboard. (3.0)

## 8. Easy to use

- **Two full redesigns** (4.0 and 4.2): clean menu, top search, new blue shield logo, one blue theme everywhere. (4.0, 4.2, 4.9.3)
- **Short menu:** Home, Copies found, Clients, Evidence, Settings. (4.14)
- **Home to-do list** of what to do now, status line at the bottom, same page headers everywhere. (4.14)
- **Toolbar popup** with a big Capture button. (4.0; the side panel was removed later)
- **First-time setup** in a few steps, a 5-step tour, and a What's new page after updates. (4.0)
- **Light and dark mode** (dark inside every tool), text size switch, line icons, keyboard help on `?`. (4.3)
- **Evidence library** with picture cards. (4.14)
- **Hover help** on terms, and buttons that say why they're greyed out. (4.0, 4.15)
- Fills wide screens and works in narrow windows. (4.2.3, 4.5)
- **One-click install and update on Windows:** Update-PageProof.cmd on the download page puts the newest version into Documents › PageProof › Install for whoever runs it. (4.32.1)
- **Home opens at once.** Home keeps a small summary of the copies found and only works it out again when something changes. (4.45)
- **Look at these first.** Copies that are the same photo on a site stolen from before, a shop, or with the credit removed get their own red line on Home. (4.45)
- **Since you were last here.** After 4 hours away (or the first visit of the day) Home lists new copies, clients finished, search sites that rested and anything that stopped. (4.45)
- **Clients falling behind.** A ★ priority client not searched for 10 days, switched off, or with its folder missing, and a goal date that can't be met, show on Home. (4.45)
- **One first-time setup.** A picture of how the photo folders should look, Google Drive and client folders inside setup, a check of each client folder (photos, year folders, registration numbers), and a "What this computer can do" step comparing Light, Normal and Strong. Skip photos for now if you only capture pages. (4.57)
- **The calm look (Windows 11 style).** One font (Lexend), Windows 11 colours in light and a grey dark mode, 4 px buttons and 8 px cards, Windows tick boxes and switches, coloured menu icons with a cogwheel for Settings, page titles like "Copies found › Keep searching". (4.65)
- **Status tiles at the top right.** Google Drive, Keep searching and Search sites show as three small tiles beside every page title, and turn red with a Fix it link when something stopped. (4.65)
- **Calm Home.** Number-first tiles (answered today, oldest capture wait in days), jobs and Most copied photos on one level, client and site chips, folded While you were away line, Clients board, photo panel from a most copied photo, red warning when a Stolen copy has waited 3 days or more for its capture. (4.74)
- **Calm pop-up.** Blue Capture this page with the site and the shortcut, New copies / To capture / Searched today as rows, five tool buttons (Inspect, Compare, Mark up, Convert, Open file), Keep searching row with switch and Pause link, bottom bar with Open full PageProof and light/dark, slim warning bars that fold so the pop-up stays under the browser's height limit. (4.75)

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
- **Room to grow.** PageProof asks for unlimited browser storage and keeps its data safe from the browser's clean-up. If a save ever fails, Home and Is everything working say so in red. (4.41)
- **Backups keep the search history.** Restoring, or moving to a new computer, carries on where you were instead of searching every photo again. (4.41)
- **Error diary.** Problems PageProof handles quietly are counted by where they happened (with names, links and folders taken out) and listed under What went wrong in Save stats for Claude. (4.41)
- **Check-up after every update.** About a minute after a new version opens, PageProof checks the photo checker, opening a Drive photo, saving, the timestamp services and the search sites, and Home says "everything checked" or what broke. (4.41)
- **Are the extra searches worth it?** How PageProof is doing (and the stats file for Claude) counts each extra search's work, copies found, time spent and time per copy. (4.52)
- **Big searches stay in All searches.** Kept 90 days, apart from Keep searching's one-photo searches (2 days). (4.53.1)
- **Updater never stuck on a missing download.** Update-PageProof.cmd retries and falls back to the newest numbered version; the release build retries and puts a lost download page back. (4.55.1)
- **Copies found stays put.** New copies wait behind a "N new copies came in" button, rows never move under you, and One at a time keeps the copy on screen. (4.60.2)
- **Social sites paced.** Each social site has a safe pace for all of PageProof (Instagram one page every 30 seconds); a "too many requests" answer makes that site rest 1 hour (up to 12). Searches never wait for it. (4.63.1)
- **Carries on after an update.** Searches, checks, sweeps and open PageProof pages pick up where they were after an update; paused things stay paused, and a small note says what carried on. (4.64)

---

## Things we tried and took out

So nobody asks for them again by accident:
PNG output (1.4), carousels / fold-outs / sideways scroll (1.8), Wayback Machine saving (2.6), batch "capture a list of links" (4.0), abuse contacts and takedowns (4.0), the self-updater and Update button (4.2.1, 4.13.1), the "still online" checker (4.15), dark mode switch on old pages (3.2.2), the Breaking News saver (4.53; the team checks by hand and their platform already checks file-name dates).

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
| 4.41 | 24 Nov | Safety nets: storage, search history in backups, moved photos, timestamp spares, error diary, update check-up |
| 4.42 | 24 Nov | One search line, per-site lanes, new photo fast lane, goal date, hot shoots, bursts, camera dates, new client folders |
| 4.43 | 24 Nov | Rule suggestions, own sites and partners, one row per page, same story groups, weak Maybes put away, sweep a Stolen site |
| 4.44 | 24 Nov | New look part 4: clients, photos and site owners; New look part 2: Copies found and One at a time; New look part 5: evidence pages; New look part 3: searches and Keep searching |
| 4.45 | 24 Nov | Home instant, strong claims line, since you were last here, clients falling behind, who's behind it in the same pack |
| 4.46 | 24 Nov | New look part 8: pop-up, side panel, capture card; New look part 7: Settings, health, help; New look part 6: Tools |
| 4.47 | 24 Nov | Second look for close calls, second chance for exact matches, your own real checker test set, checker vs your answers by kind of site, match picture in the Evidence report |
| 4.47.1 | 24 Nov | Fix: Search pages: full speed, rows light up, list keeps its scroll |
| 4.47.2 | 24 Nov | Fix: All years of every client are read; "No longer monitoring" folders skipped |
| 4.47.3 | 24 Nov | Fix: Untick folders inside a client; "No longer monitoring" searched again |
| 4.47.4 | 24 Nov | Fix: Photo counts update while folders are read |
| 4.47.5 | 24 Nov | Fix: Search a Skipped folder anyway |
| 4.48 | 24 Nov | Search pages filled out |
| 4.49 | 24 Nov | Speed ladder, Yandex + Bing quick looks, look-alike frames share a search, speed meter |
| 4.49.1 | 24 Nov | Fix: Copies inside collages are found |
| 4.49.2 | 24 Nov | Fix: Personal X accounts are no longer called Business |
| 4.49.3 | 24 Nov | Fix: Stopped searches say so, and years mix better |
| 4.50 | 24 Nov | Search tabs at full speed in the background, every result picture loads, Google exact matches read on their page, multi-picture posts checked, fewer slow second looks |
| 4.51 | 24 Nov | Credit search, Watching, Registrations, company card |
| 4.51.1 | 25 Nov | Fix: Set-aside folders skipped, fewer extension page errors |
| 4.51.2 | 25 Nov | Fix: Two searches never pick the same photos |
| 4.51.3 | 25 Nov | Fix: Close-ups of a podium seal no longer count as copies |
| 4.52 | 25 Nov | Credit search on Google and Bing, progress on its own page, Extra searches card and stats |
| 4.52.1 | 25 Nov | Fix: Keep searching flag counts fairly |
| 4.52.2 | 25 Nov | Fix: Fewer wasted slow looks on Google matches |
| 4.52.3 | 25 Nov | Fix: Portal card shows the exact drop-down choices |
| 4.53 | 25 Nov | Breaking News saver removed |
| 4.53.1 | 25 Nov | Fix: Big searches kept 90 days, one-photo searches 2 days |
| 4.54 | 25 Nov | Checker tuned on your answers (few-detail Same is Maybe, Weak Maybes folded, test pairs from every answer) |
| 4.55 | 25 Nov | Stop searching a photo from Copies found |
| 4.55.1 | 25 Nov | Fix: Updater and release build retry GitHub hiccups |
| 4.56 | 25 Nov | One at a time can show Websites only or Social media only |
| 4.56.1 | 25 Nov | Fix: Country filled in for .com sites from the page's address and language |
| 4.56.1 | 25 Nov | Small fixes |
| 4.57 | 25 Nov | One first-time setup with folder guide, folder check and computer limits |
| 4.57.1 | 25 Nov | Fix: Spam blogs filter catches amphtml and made-up site names |
| 4.58 | 25 Nov | Check later button and tab for copies you're not sure about |
| 4.58.1 | 25 Nov | Fix: Resume shows at once on the Keep searching tab |
| 4.59 | 25 Nov | Just hidden list folded away; Site gone tag for copies on websites that no longer exist; Spam blogs filter catches search-words pages and spam-only endings |
| 4.60 | 25 Nov | Site popularity tags and known bad site lists |
| 4.60.1 | 25 Nov | Fix: "Who's behind it" box removed from the capture page |
| 4.60.2 | 25 Nov | Fix: Copies found and One at a time stay put while you look |
| 4.61 | 25 Nov | Search tabs move to a separate minimized window (setting to keep pinned tabs) |
| 4.62 | 25 Nov | Stop searching a photo also removes its unanswered matches |
| 4.63 | 25 Nov | Finish this claim steps after Stolen, Not finished tab, Sent to legal |
| 4.63.1 | 25 Nov | Fix: Social sites paced, rest after "too many requests" |
| 4.64 | 25 Nov | Everything that was running carries on after an update, with a "Picked up after the update" note |
| 4.64.1 | 25 Nov | Fix: Side panel removed (use the pop-up) |
| 4.65 | 25 Nov | Calm look step 1: Lexend font, Windows 11 colours, status tiles at the top right |
| 4.66 | 25 Nov | Calm look step 2: All copies list and the copy panel |
| 4.67 | 26 Nov | Calm look step 3: One at a time |
| 4.68 | 26 Nov | Calm look step 4: Keep searching in four tabs |
| 4.69 | 26 Nov | Calm look step 5: New search and Search results |
| 4.70 | 26 Nov | Calm look step 6: All searches |
| 4.71 | 26 Nov | Calm look step 7: Credit search in three tabs, Stop, usual wordings for everyone |
| 4.72 | 26 Nov | Calm look step 8: Watching with turns, time limit per computer, Stop |
| 4.73 | 26 Nov | Calm look step 9: Site owners under Copies found, Look up a site as a tab, Copy owner details |
| 4.74 | 26 Nov | Calm look step 10: Home with number-first tiles, chips, Clients board, photo panel |
| 4.75 | 26 Nov | Calm look step 11: pop-up with blue Capture, number rows, five tool buttons, bottom bar |
| 4.76 | 26 Nov | Calm look step 12: Clients and photos with Registrations inside, photo panel, filters |
| 4.77 | 26 Nov | Calm look step 13: Skipped photos; TIFF and HEIC photos are read and searched (read only) |
| 4.78 | 26 Nov | Calm look step 14: All evidence (tabs, badges, quick filters, details panel, group by case number); Needs a capture folded into it |
| 4.79 | 26 Nov | Calm look step 15: Capture a page becomes Evidence › Overview (tiles, weekly chart, Needs you, newest captures, sources, time services) |
| 4.80 | 26 Nov | Calm look step 16: Weekly summary (week picker, six tiles, 8 week chart, sortable By client, PDF that matches the screen) |
| 4.81 | 26 Nov | Calm look step 17, part 1: All tools (six tools, drop any file, Opened lately) and Verify a pack in the Tools menu |
| 4.82 | 26 Nov | Calm look step 17, part 2: Inspect a photo (file on one line, picture left, answers right, case details asked when saving a pack) |
| 4.83 | 26 Nov | Calm look step 17, part 3: Compare two photos (files on one line, floating view bar, result card and folds) and Mark up a copy (one toolbar across the top) |
| 4.84 | 26 Nov | Calm look step 17, part 4: Convert files with Open odd files as its second tab, and numbered steps |
