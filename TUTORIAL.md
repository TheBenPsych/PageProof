# PageProof tutorial: capturing evidence step by step

This guide shows how to use PageProof day to day, once it's installed in your browser.

---

## Before you start (once)

1. **Pin the icon.** Click the puzzle-piece icon at the top right of Chrome, then the pin next to **PageProof**. The PageProof icon (a blue page with a green check) now sits in your toolbar.

---

## 1. Capture a page

1. **Open the page** with the infringing content in a normal tab.
2. **Get it ready.** Close pop-ups and cookie banners, and open anything you need to show, like a menu or the right carousel slide. PageProof captures what's on screen, plus anything below it.
3. **Click the PageProof icon**, then the green **📸 Capture this page**. (Or press **Alt+Shift+P** to capture straight away, without the menu.)
4. **Hands off.** PageProof jumps to the top and scrolls down by itself. The icon shows a counter (1, 2, 3...) while it works. Don't scroll, click, or switch tabs until it finishes.
   - Need to stop? **Click the icon again** and choose **Stop and keep what's captured**.
5. A new tab opens: the **capture page**.

> **Tip:** On pages that keep loading more posts as you scroll ("endless scrolling"), PageProof stops where the page ended when you clicked, and notes this in the record.

> **Reels, Shorts and TikToks:** Instagram Reels, Facebook Reels, YouTube Shorts and TikTok videos show one video per screen, so PageProof captures only the video on screen and doesn't scroll on to the next ones. It also opens a shortened description first: it clicks **"... more"**, **"See more"** or a lone **"…"**, or clicks the shortened description and waits for it to open. If a description still isn't fully open, click it yourself and capture again: PageProof keeps whatever is open. For an Instagram Reel with its comments, change `/reels/` to `/reel/` in the address (for example `instagram.com/reel/CwYkCcxpIeT/`), then capture.

---

## 2. Check the capture page

From top to bottom, the capture page shows:

| Part | What to do |
| --- | --- |
| **Status line** | Read it. It tells you about anything special: sections found, endless scrolling, a timestamp service that didn't answer. |
| **Who hosts this site** | The hosting company, domain registrar and their **abuse contacts**: who your DMCA takedown notice goes to. If the site uses Cloudflare, it says so and points you to Cloudflare's abuse form, which forwards your notice to the real host. |
| **Case boxes** | Fill these in (next step). |
| **Capture details and fingerprints** | Click to expand and see the full record that goes into the pack. |
| **Preview** | Scroll through it to make sure the capture shows what you need. |

**About the preview:**
- The **dark banner** at the top shows the website, full web address, page title, capture time and time zone, the Capture ID (for example `PP-7KQ2MX`) and window size.
- Boxes that scroll on their own, like Instagram comments, are outlined in red with a **"Section 1"** label. Their **full contents** appear at the bottom of the capture under the same number.
- **Dropdown lists** on the page are also numbered, and every choice is written out at the bottom, with the selected one marked **[x]**.

---

## 3. Fill in the case details

- **Collected by:** your name. It's remembered for next time.
- **Case / reference number:** for example `CASE-2026-114`. It starts empty for each capture, so enter it every time. It goes at the start of the zip's file name.
- **Notes:** what this shows, for example "Client photo used without licence on product page." It starts empty for each capture.

---

## 4. Save the evidence pack

Click the green **⬇ Save evidence pack** button.

The file is named:

```
CASE-2026-114_example.com_2026-11-04_15-17-55_PP-7KQ2MX.zip
  case number   website     date       time    Capture ID
```

**Inside the zip:**

| File | What it is |
| --- | --- |
| `...pdf` | The full-page capture, ready to print or attach |
| `...html` | A working copy of the page with all pictures stored inside it, so it opens even if the site deletes everything |
| `..._source.html` | The page's code, exactly as the website's server sent it |
| `images/` | The original image files from the page (often the infringing images themselves) |
| `capture-details.txt` | The full record: web address, times, your case details, server IP address, how the capture was taken (for example, if PageProof opened a description) and every fingerprint |
| `fingerprints.sha256` | The fingerprint of every evidence file |
| `lookups/` | Public registration records (RDAP/WHOIS) for the site's domain and server |
| `timestamps/` | Signed receipts from independent timestamp services (DigiCert, Sectigo, FreeTSA), proving when the pack existed |
| `README.txt` | A plain-language explanation for whoever receives the pack |
| `VERIFY-THIS-PACK.html` | A built-in checker. Anyone can double-click it, even without PageProof or internet, to check the pack |

You can also download just the **PDF** or **HTML backup** with their own buttons. Only the zip carries the fingerprints and timestamps, so always keep the zip.

---

## 5. Store it safely

- **Don't edit files** inside the zip. Opening, copying, renaming or emailing them is fine, but editing and re-saving breaks their fingerprints.
- **Keep two copies,** for example on the case drive and on a backup drive.
- **Never re-save the PDF** from a PDF editor. If you need to mark it up, work on a copy, and keep the original zip untouched.

---

## 6. Capture the Wayback copy too (optional)

PageProof no longer saves to the Wayback Machine itself, but if you've saved a page there on web.archive.org, you can capture the archived copy as evidence too:

1. Open the archived page on web.archive.org.
2. When the archived page has loaded, click the **PageProof icon**.
3. Save that pack under the same case number. It's stamped and fingerprinted like any other capture, and the Wayback link is in its web address.

---

## 7. Capture many links at once: batch capture

Use this for sweeps, when you have a list of infringing pages.

1. **Click the PageProof icon** and choose **Batch capture** (or right-click the icon, or click **Batch capture** at the bottom of the left bar on the capture page).
2. **Paste the links,** one per line. You can paste straight from a spreadsheet column.
3. Fill in **Collected by**, **Case / reference number** and any **Notes**. They go into every pack.
4. Click **Start batch.** A separate window opens and visits each link in turn. **Leave it open and don't minimize it.** You can keep working in your other windows.
5. Watch the table: each link shows *Loading → Capturing → Building pack → Saved* (or *Failed* with the reason, for example a page that's down).
6. When it says **Done**, click **Download batch report (.csv)** for a spreadsheet of every link and its pack name.

Batch packs are saved automatically to **Downloads/PageProof/&lt;case number&gt;/**, one zip per link, and each appears in the capture log. Click **Stop after the current link** to end a batch early.

> **Tip:** pages that need you to log in or close a pop-up first won't look right in a batch. Capture those one at a time instead.

## 8. Find past captures: the capture log

Click **Capture log** at the bottom of the left bar on the capture page. It lists every capture and every pack saved on this computer: when, which page, the case number, who collected it, the zip's fingerprint and the timestamps.

- **Download log (.csv)** opens in Excel. Download it now and then and keep it with your records, since the log lives only in this browser.

---

## 9. Check a pack later: Verify a pack

Use this whenever you or someone else needs to confirm a pack hasn't been changed.

1. Click **Verify a pack** at the bottom of the left bar on the capture page (it is also at the top of the capture log).
2. **Drop the zip** on the box (or click it and choose the file).
3. Read the result:
   - 🟢 **Unchanged:** every file matches its fingerprint, and the timestamps are valid. It also shows when the services signed it.
   - 🔴 **Warning: this pack has been changed:** it lists exactly which file was changed, removed, or doesn't match its timestamp.
   - 🟡 **No trusted timestamp:** the files match, but the pack has no timestamp to prove when it was made.
4. It also tells you whether this is the **exact zip** recorded in your capture log.

**Checking a single file** (for example, a PDF someone emailed back to you): first drop the original zip, then drop the single file. PageProof tells you whether it matches a file in that pack.

**People without PageProof** (opposing counsel, a court, a client) can double-click **VERIFY-THIS-PACK.html** inside the pack. It's the same checker and works offline in any browser. They drop the zip on it, or click **Choose the unzipped folder**. To check completely by hand, see [VERIFYING.md](VERIFYING.md).

---

## 10. Share it or point people to the right spot: Copy and Markup

Use this when you want to show someone exactly where to look, for example in an email to a site owner or a lawyer.

To send the whole capture as it is, click **📋 Copy** in the left bar of the capture page, then paste (Ctrl+V) into an email or chat.

To draw on it first:

1. On the capture page, click **✏️ Markup** in the left bar. A new tab opens with a copy of the capture.
   (For an older capture, click **Verify a pack** at the bottom of the left bar, then **Markup a capture**, and click **📂 Open a capture or picture** to choose the evidence pack .zip. It also opens any other picture, like a screenshot. To switch to a different one later, click **📂 Open a different capture** at the bottom of the Markup bar.)
2. Pick a tool from the **Tools** buttons in the left bar, then drag on the picture:
   - **Highlight**: a see-through marker, like a highlighter pen.
   - **Box** and **Circle**: draw around something. Hold **Shift** for a perfect square or circle.
   - **Arrow**: drag from where the arrow starts to where it points.
   - **Text**: click where you want words, type, then press **Enter**. Click your text again to change it.
   - **Move**: click a marking to pick it, drag to move it, or press **Delete** to remove it. Clicking a colour changes the picked marking's colour.
   - **Pick area**: drag a box around just the part you want to send. Only that part is copied or downloaded. Click **Use whole page** to go back.
3. Pick a colour (the round dots) and a size (Thin, Medium, Thick). Made a mistake? Click **Undo** (or press Ctrl+Z).
4. When you're happy:
   - Click the green **📋 Copy image** (or press Ctrl+C), then paste (Ctrl+V) straight into Gmail, Outlook, Word, Slack, and so on.
   - Or click **⬇ Save as PNG** or **⬇ Save as PDF** to save a file you can attach.

Good to know: every marked-up copy has a yellow **"Marked-up copy"** label at the bottom with the web address, capture time and Capture ID, so nobody mistakes it for the original. You can untick **Add "Marked-up copy" label** if you need a clean picture. The marked-up copy is a separate file: it is never put in the evidence pack and doesn't change any fingerprints. Always keep the original evidence pack as your proof.

## 11. Look inside a picture: the Image Inspector

Cameras, phones and editing programs store hidden details inside picture files: the camera, the date and place a photo was taken, the editing software, and often the photographer's name and copyright notice. If an infringing site still has your client's name inside the file, that's strong evidence.

**Getting a picture in.** Click the PageProof icon, then **🔍 Inspect a picture**, and choose how:

- **🎯 Click a picture on this page.** The page dims a little and every picture lights up with a blue box and its size as you point at it. Click the one you want. Press **Esc** to cancel.
- **🖼️ Show all pictures on this page.** A new tab lists every picture on the page, biggest first. Each one is tagged **✓ Hidden data**, **A little data** or **No data** (a **©** means it names an author or copyright owner). Click one to inspect it, and use **⬅ All pictures on the page** at the bottom of the left bar to go back.
- **📁 Upload from my computer.** Click **➕ Add a picture**, drag a file onto the page, or paste with Ctrl+V. (Pasted pictures never keep hidden data, so add the file itself when you can.)
- **Shortcut:** right-click any picture on a website and choose **PageProof ▸ Inspect picture** (see section 15).

For pictures on websites, PageProof downloads the original file from the site, not a screenshot. When the page shows a small version, it fetches the biggest version the site has, because it usually keeps more data. The record lists both addresses.

**Reading the result.** The left bar shows:

- **In short:** one plain-English sentence, for example *"Taken on a Canon EOS R6 on 3 Jun 2025 by J. Rivera, with the GPS location recorded. Edited in Lightroom Classic, then Photoshop. Copyright notice: ..."*
- **What the file says:** camera, date taken, place (with a **Map ↗** link), editing software, creator and copyright (in yellow), size, and the file's SHA-256 fingerprint (click to copy).
- A **yellow warning** when there is no hidden data. That usually means a screenshot or a re-upload, which is worth noting in itself.
- A **purple box** when there are signs of AI (Content Credentials or AI-tool settings in the file).
- Folded lists you can open: **All camera data (EXIF)**, **Author and copyright (IPTC)**, **Adobe data and edit history (XMP)**, **Content Credentials (C2PA)**, and **Where it came from** (the address, page, and the website server's answer).

**Saving it.** Fill in the case details, then click:

- **⬇ Save evidence pack**: a zip with `original/` (the file exactly as downloaded, byte for byte), the PDF report, `image-data.txt`, `capture-details.txt`, fingerprints, trusted timestamps, `README.txt` and `VERIFY-THIS-PACK.html`. The **Verify a pack** page checks it like any other pack.
- **📄 PDF**: the report on its own. Page 1 has the banner, the "In short" sentence, the picture and where it came from. The next pages list all the hidden data.
- **🖼️ Original** downloads the untouched file; **📋 Copy** and **✏️ Markup** work like on the capture page.

Hidden data can be edited with the right software, so treat it as one piece of evidence, not proof on its own.

**Page captures do this too.** Every normal page capture now reads the hidden data in all the pictures it saves. The pack gets `image-data.txt`, the status line says something like *"3 of 12 pictures still have hidden data, 1 names an author or copyright owner"*, and the PDF gets a last page listing those pictures.

## 12. Show it's the same photo: Compare

This does what you'd do in Photoshop: put the copy on top of the original, turn down its opacity, and nudge it aside and back to show everything lines up.

1. Open it from the Image Inspector (**🔀 Compare with the original**: the picture you were inspecting goes in as the copy), or click the PageProof icon, then **Compare two pictures**.
2. Put your client's **Original** in box 1 and the **Copy** in box 2 (click **Choose…**, or drag a picture onto the box).
3. Click **✨ Line them up automatically**. PageProof finds the same sharp details (corners, edges, lettering) in both pictures, works out the size, shape and position where they agree, and slides the copy into place. It works when the copy was resized, heavily zoomed or cropped, stretched wider or taller, tilted, mirrored, blurred, recompressed, colour-changed, or has a headline, logo, watermark or caption over part of it (for example a newspaper front page or a social media post). The status line then says what was done to the copy, for example *"resized to 83%, stretched to 86% width, turned 8° anticlockwise, mirrored left to right"*.
   The score says how much of the area the two pictures share lines up detail for detail, for example *"Very likely the same photo, 100% lines up"*, or for a front page with a big headline *"Very likely the same photo, with things added on top, 42% lines up"*. Parts covered by a headline simply don't count as lining up.
4. Show it:
   - Move the **slider** from Original to Copy to fade between them. If it's the same photo, nothing doubles up.
   - **↔ Slide aside and back** moves the copy off to the side and back into place.
   - **▶ Play fade** fades back and forth until you click it again.
   - **Colour check** shows the original in blue tones and the copy in orange tones. Where they line up they cancel out to plain grey; anything off shows blue or orange ghost edges.
   - **Difference** turns everything that matches black, so only real changes (an added logo, cropped edges) show up bright.
   - Fine-tune by dragging the copy, with the arrow keys (Shift for bigger steps), or with **− Smaller** / **+ Bigger**.
   - **Size and shape** sliders: **Size**, **Width** (stretch sideways), **Height** (stretch up and down) and **Turn**, plus a **Mirrored** tick box. Auto line-up sets them for you; move them by hand if needed. **Reset shape** undoes any stretch, turn or mirror.
5. Save it: **📄 PDF** (both pictures side by side, file details and fingerprints, the overlay at 0%, 50% and 100%, the difference view and the colour check), **🖼️ Picture** (what you see now), or **🎬 Video** (a 9-second MP4 clip of the copy fading in, sliding aside and back, then the difference view; it plays on Windows, Mac, phones and in PowerPoint).

The score is a guide. The overlay pictures are what to show. If the copy's colours were changed, the Difference view shows a faint tint over the photo instead of pure black; edges that line up still disappear.

## 13. Change file types, join PDFs, make files smaller: Convert files

Click the PageProof icon, then **🔄 Convert files**. Everything happens on your computer. Nothing is uploaded to a website, so client files stay private.

1. Click **➕ Add files** (or drag files onto the page, or paste with Ctrl+V). You can add one file or many, of different kinds.
2. PageProof works out what the files are and shows only what makes sense under **What do you want to do?**
3. Pick a job, set the options in the left bar, and press the big green button.

What each job does:

- **Change the file type** (pictures): turn JPG, PNG, WebP, GIF, BMP, AVIF, TIFF or iPhone HEIC photos into **JPG, PNG, WebP, GIF, BMP or PDF**. *Keep the date and camera details* copies the hidden camera data into the new JPG.
- **Make them smaller** (pictures and PDFs): pick a limit (**Email 10 MB**, **Court e-filing 5 MB**, **1 MB**) and PageProof finds the best quality that fits. The slider goes from *Smallest* to *Best quality*. Each file shows its new size, and **Check** opens it so you can look before you save. In PDFs only the pictures are squeezed, so the text stays sharp and searchable.
- **Rotate, crop or resize** (pictures): turn left or right, flip, drag the white corners to crop (pick **Square**, **4 : 3** or **16 : 9** to keep a shape), and type a new width or height. Tick **Do the same to all** to change every picture the same way.
- **Join into one PDF** (PDFs and pictures): **1** tick the files you want in it, **2** use ▲ ▼ to put them in order, **3** press **Save one PDF**. Point at a page to turn it ↻ or remove it ✕. Pictures become pages, and each file gets a bookmark.
- **Split or pick pages** (PDFs): click pages to tick them, or type page numbers like `1-3, 7`. Save them as one PDF or one PDF per page.
- **Save as PDF** (Word, old Word .doc, RTF, OpenOffice, text files, Excel, CSV, emails, Mac files): check the preview, then press **Save as PDF**. For documents and emails a print box opens: set **Destination** to **Save as PDF** and press **Save**. The text stays real text, so it can be searched and copied. Old .doc files only show their words (open them in Word and save as .docx for the exact layout).

**How to save them:** when there are several new files, choose **📁 Separate files** (they all go straight into Downloads) or **📦 One ZIP**. Your original files are never changed. You always get new copies.

## 14. Open files your computer can't: Open odd files

Click the PageProof icon, then **🗂️ Open odd files**, and add the file. Click a file on the left to see inside it.

- **Outlook emails (.msg) and saved emails (.eml):** shows the sender, recipients, date and message. Attachments can be saved or opened right there. Pictures from the internet are not loaded unless you click **Load pictures from the internet**, so the sender can't tell you opened it. **Save as PDF** keeps a copy of the email.
- **ZIP, RAR, 7-Zip and TAR archives:** lists every file inside. **Save** or **Open** any one of them, or **Save everything as a normal ZIP** that Windows can open. (Archives locked with a password can't be opened.)
- **Mac Pages, Numbers and Keynote:** shows the preview the Mac saved inside the file, and saves it as PDF. Newer Mac files only keep a picture of the first page or slide, so for every page ask the sender for a PDF (File, Export To, PDF).
- **iPhone HEIC photos, TIFF and AVIF pictures:** shows the picture and saves it as JPG, PNG or PDF.
- **Files with the wrong name:** if a file is really a picture or PDF with a different ending, PageProof says so and opens it anyway.

## 15. The right-click menu

Right-click on a website and point at **PageProof**. On a picture you get all five choices below. Anywhere else (text, empty space) you only get **Save page as evidence**.

- **Inspect picture:** opens the Image Inspector (section 11) for the picture you right-clicked.
- **Save picture as JPG:** PageProof looks for every size of the same picture on the page, keeps the biggest, and opens the **Save As** window so you can pick the folder and type your own file name (it suggests one made from the website and picture name). WebP, PNG, AVIF and GIF pictures are turned into JPG (see-through parts become white). A picture that is already a JPG is saved untouched. A small note in the bottom-right corner confirms it, with **Show in folder** and **Inspect it**.
- **Open picture in new tab:** opens just the picture, at the biggest size, in a tab next to the page. The address bar shows the picture's own web address, ready to copy.
- **Reverse image search ▸ Google Lens / Yandex / Both:** opens a new tab that searches the web for other copies of the picture (the biggest version PageProof found). **Both** opens two tabs. Good for finding where else a photo has been posted.
- **Save page as evidence:** does exactly what the green **Capture** button does.

**Instagram, Facebook and similar sites.** These sites lay an invisible sheet over their photos, so the browser's own picture options (like "Open image in new tab") don't appear. PageProof looks underneath the spot you right-clicked and finds the real photo anyway. Just right-click on the photo and use the PageProof choices.

If the note says **Please reload this page once**, PageProof was installed or updated after the page opened. Press F5 and right-click again. If it says **No picture found here**, right-click right on top of the picture.

## 16. Search many pictures at once: reverse image search

Click the PageProof icon and choose **Reverse image search**.

1. Press **Add pictures** (or drag pictures, or a whole folder, onto the page, or paste pictures or picture links with Ctrl+V). Up to 50 at once.
2. On the left, tick the sites to search on: **Google Lens**, **Yandex** and **Bing**. Pick a **Speed** (Normal is best for most days).
3. Press the green **Search** button. A new window opens:
   - The first tab is the PageProof results page.
   - Each picture gets its own coloured, numbered tab group with a Google, Yandex and Bing tab. These are the same pages you would get searching by hand.
   - Leave the window open until the progress bar on the left finishes. About 2 to 3 minutes for 30 pictures.
4. Pick a picture on the left to see every link found for it, grouped by site. Under each picture on the left, **⏳ Checking matches · 12 left** means PageProof is still comparing the copies it found; **✓ All checked · ready to review** means that picture's list is final. If you open **Hidden and allowed sites** or **Past searches** while a search runs, use **↩ Back to search results** to return to it (the search keeps going in its own tab).
   - PageProof does not trust the search sites' own "exact match" labels. It downloads every copy it found and lines it up with your picture, the same way the Compare page does, then sorts each link into:
     - **✅ Same photo**: many details line up. This is your photo, even if it was cropped, resized, mirrored, colour-changed or had text put over it. This is the list shown first.
     - **Maybe**: a few details line up. Worth a quick look. Same-photo checks also look at the middle of your picture, so a different photo taken in front of the same logo wall or backdrop is not counted as the same photo.
     - **Can't check**: the site would not let PageProof download the picture (Facebook, Instagram and so on). Open the link to look yourself.
     - **Different photo**: nothing lines up. Usually just a similar-looking picture. Hidden unless you pick it.
   - The number next to a same-photo link (for example "Same photo · 64% lines up") shows how much of the shared area matches. A low number there is normal when the copy has big headlines or text over it.
   - **🔀 Compare** opens your picture and that copy on the Compare page, already lined up, so you can check it by eye and save a PDF or video.
   - **Size**: the copy's size, flagged **bigger than yours** or **cropped** when that is the case.
   - **New**: links that were not there the last time you searched the same picture. Links you have seen before say "Seen before" with the date they were first found.
   - Which site found it (Google, Yandex, Bing).
5. **✕ Not a match** is for a link PageProof got wrong: it is a different photo. It moves to **Different photo**, and PageProof keeps its numbers so the checker can be tuned from your choices. **🗑 (trash can)** is for a link you just don't want (licensed, not worth chasing and so on). Trashed links never show again for that picture. Both are saved in `Documents\PageProof\rejected-links.txt`. To bring one back, pick the **🗑 Rejected** filter and press **↩ Put back** (or delete its line from the file).
6. **Hide this site** hides that site for every picture, now and in future searches (good for Pinterest, stock photo sites and so on). To hide a whole kind of site, type its ending with a dot on the **Hidden and allowed sites** page, for example `.gov` or `.edu`. To hide just one account or section of a site, press the small red **🚫 Hide x.com/nypostsports** under a link, or type it the same way on that page (for example `x.com/nypostsports` or `example.com/forum`). The rest of the site still shows. **Mark allowed** is for your own site and licensees: they still show, with a green **Allowed** label.
7. Tick the links that matter and press **Capture ticked pages**. They open in batch capture (section 7), ready to save as evidence packs.
8. **Save results** downloads a PDF report and a spreadsheet of everything found.

**"Are you a robot" checks.** The searches run in your own browser, a few at a time with short pauses, which keeps these rare. If one appears anyway, PageProof pauses only that site, shows you the tab and waits. Tick the box and it carries on by itself. If a site keeps asking, press **Skip** and use **Search the rest** later.

**The PageProof folder (set up once).** Chrome only lets an extension use a folder you have picked yourself, and it will not let anyone pick Documents itself (it calls it a system folder). A folder inside Documents is fine, so the first time:
1. Press **📂 Set up PageProof folder**. A folder window opens in Documents.
2. Click **New folder**, name it `PageProof`, and press Enter.
3. With that new folder selected, click **Select Folder**, then **Save changes** (or **Allow**) if Chrome asks.

PageProof then makes everything inside it by itself: `hidden-sites.txt`, `allowed-sites.txt` (one site per line, you can edit them in Notepad) and the **My pictures** folder. After an update nothing changes. After a full reinstall, press **Set up PageProof folder** again and just pick your existing PageProof folder: your lists come straight back. Chrome may also ask you to press **Allow** once after it restarts.

**My pictures folder.** Choose **📂 My pictures folder** on the left. PageProof uses `Documents\PageProof\My pictures`:
- Add pictures with **Add pictures to this folder**, by dragging them onto the page, or straight into the folder in File Explorer.
- **Already have big client folders?** Press **📂 Use a different folder…** on the left and pick the top folder (for example the one that holds all your client folders). Nothing is copied. PageProof includes every folder inside it, like `Client name › Year › Day › picture`, and shows each picture with its path. Type a client, year or file name in the **Find** box to narrow the list. **Go back to Documents\PageProof\My pictures** switches back.
- **Check today's 30** searches the pictures that are due: new pictures first, then the ones checked longest ago. Change the number with **Pictures per day**.
- Under **Every day**, pick **Remind me at** (a pop-up at the time you choose; click it to start), **Start by itself at**, or **Only when I press the button** (no reminder). Chrome has to be open at that time.

**Good to know.** PageProof reads Google's, Yandex's and Bing's results pages the same way you do. If one of them changes how its page looks, its links may stop filling in until PageProof is updated. The search tabs still open, so you can always read them yourself. Some sites (Facebook, Instagram) block picture downloads, so they show no % match.

## Quick troubleshooting

| Problem | What to do |
| --- | --- |
| "This page could not be captured" | Browser pages (new tab, settings, the Chrome Web Store) can't be captured. Try a normal website. |
| The capture shows a pop-up or cookie banner | Close it on the page, then capture again. |
| Something you need is hidden in a menu, carousel or "show more" | Open it on the page first, then capture. |
| The Image Inspector says "Could not download this picture" | Some websites block downloads. Right-click the picture, choose **Save image as...**, then add the saved file with **Inspect another picture**. |
| Alt+Shift+P opens the menu instead of capturing | Go to `chrome://extensions/shortcuts` and set **Capture the whole page straight away** to Alt+Shift+P. |
| A timestamp service "did not answer" | That's fine as long as at least one other service signed. The status line says which ones did. |
| The capture stopped early | Very long pages stop after 60 screens, and endless pages stop at their original end. The status line explains which. |
