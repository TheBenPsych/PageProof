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

The capture page has a panel on the left and the captured page on the right. From top to bottom, the panel shows:

| Part | What to do |
| --- | --- |
| **Website, address, time and Capture ID** | Check it is the page you meant. Click the address to copy it. |
| **Proof checklist** | Four lines that turn green as each part of the proof is ready: **Whole page captured**, **pictures saved**, **Fingerprints made**, **trusted timestamps**. Yellow or red means that part is missing something (for example a timestamp service that didn't answer). The pack still saves. |
| **1 Case details** | Fill these in (next step). You can type while the checklist is still working. |
| **2 Save** | The big green **Save evidence pack**, then **Copy**, **Markup**, **PDF** and **HTML**. |
| **Who hosts this site** | The hosting company and the domain registrar, from public records. If the site uses Cloudflare, it says so (Cloudflare hides the real host). |
| **Capture details and fingerprints** | Click to expand and see the full record that goes into the pack. |

The blue line above the captured page tells you about anything special: sections found, endless scrolling, a timestamp service that didn't answer. Scroll through the captured page to make sure it shows what you need.

**About the preview:**
- The **dark banner** at the top shows the website, full web address, page title, capture time and time zone, the Capture ID (for example `PP-7KQ2MX`) and window size.
- Boxes that scroll on their own, like Instagram comments, are outlined in red with a **"Section 1"** label. Their **full contents** appear at the bottom of the capture under the same number.
- **Dropdown lists** on the page are also numbered, and every choice is written out at the bottom, with the selected one marked **[x]**.

---

## 3. Fill in the case details

- **Case / reference number:** for example `CASE-2026-114`. It starts empty for each capture, so enter it every time. It goes at the start of the zip's file name.
- **Notes:** what this shows, for example "Client photo used without licence on product page." It starts empty for each capture.
- **Collected by:** your name. It's remembered for next time.

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

## 7. Capture many links at once

Batch capture was removed in version 4.0 because it wasn't reliable. Capture pages one at a time: from the PageProof icon, with **Alt+Shift+P**, or right-click a link › **PageProof › Capture the linked page** (it opens the page and captures it).

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
   - **Show changes** (on by default): a **green line** goes round the part that is your photo, and the parts that were added, painted over or redrawn in the copy are tinted **red**. Made for AI-edited posts: an added animal or object, changed faces, a headline band. When a solid part is clearly your photo and a lot was changed, the verdict says **"Same photo, heavily edited"**, and the big number only judges the green part (*"69% lines up in the part that wasn't painted over"*); the score over everything they share is in the small text. Two different photos get no green.
   - **🔍 Pick a spot**: click a face, logo or detail on the picture (or drag a box round it). PageProof cuts that spot from both pictures and scores it on its own, allowing for it to have moved a little: **90% and up** = unchanged, **75 to 90%** = the same with small changes (an expression, a small move), **below 75%** = redrawn or different. It also says how far it moved. Add as many spots as you like; ✕ removes one.
   - **＋ Check nearby shots…** (under box 1): if your client took many shots of the same scene, pick them all at once. PageProof lines each one up with the copy, lists them best first, and puts the best one in box 1. If two are within a few points of each other it says *too close to call*: then compare a face on each with Pick a spot.
5. Save it: **📄 PDF** (both pictures side by side, file details and fingerprints, the green and red changes picture, every spot side by side with its score, the nearby shots checked, the overlay at 0%, 50% and 100%, the difference view and the colour check), **🖼️ Picture** (what you see now), or **🎬 Video** (a 9-second MP4 clip of the copy fading in, sliding aside and back, then the difference view; it plays on Windows, Mac, phones and in PowerPoint).

**Press walls:** if only the logos printed over and over on a sponsor wall line up (a different shot in front of the same wall), Compare says **"Different photo, same backdrop"**, and the photo check in Find copies throws it out as a different photo.

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

Right-click on a website and point at **PageProof**. On a photo you get the photo choices; on a link, **Capture the linked page**; anywhere else, **Capture this page**.

- **Inspect this photo:** opens the Image Inspector (section 11) for the photo you right-clicked.
- **Find copies of it ▸ Google Lens / Yandex / Bing / All three:** opens a tab (or three) that searches the web for other copies of the photo (the biggest version PageProof found).
- **Save biggest copy…:** PageProof looks for every size of the same photo on the page, keeps the biggest, and opens the **Save As** window so you can pick the folder and file name. Non-JPG pictures are turned into JPG (see-through parts become white). A JPG is saved untouched.
- **Open biggest copy in a tab:** just the photo, at the biggest size, in a tab next to the page.
- **Capture this page / Capture the linked page:** the same full capture as the green button.

**Instagram, Facebook and similar sites.** These sites lay an invisible sheet over their photos. PageProof looks underneath the spot you right-clicked and finds the real photo anyway.

If the note says **Please reload this page once**, PageProof was installed or updated after the page opened. Press F5 and right-click again.

## 16. Search many pictures at once: reverse image search

Click the PageProof icon and choose **Reverse image search**.

1. Press **Add pictures** (or drag pictures, or a whole folder, onto the page, or paste pictures or picture links with Ctrl+V). Up to 50 at once.
2. On the left, tick the sites to search on: **Google Lens**, **Yandex** and **Bing**. Pick a **Speed** (Normal is best for most days).
3. Press the green **Search** button. In the same browser window:
   - PageProof switches to the results page (Copies found › All searches). You can look at other PageProof pages while it runs and come back.
   - The Google, Yandex and Bing search tabs open as small pinned tabs at the left of the tab bar, so they don't fill it. These are the same pages you would get searching by hand. Each search tab closes by itself once PageProof has read it, which keeps the computer fast. The **Google tab / Yandex tab / Bing tab** buttons on a picture's results open it again. If a search fails, its tab stays so you can look at it, but Chrome puts it to sleep so it uses almost no memory until you click it.
   - Leave the PageProof tab open until the progress bar on the left finishes. About 2 to 3 minutes for 30 pictures.
4. **The review is in Copies found.** Every Same photo and Maybe link goes there by itself (press **Review new copies**). The Search results page only shows progress, plus a folded **Thrown out by the checker** list (Different photo and Can't check); press **＋ It is a copy** on one to send it to All copies found. Pick a picture on the left to see its progress. Under each picture on the left, **⏳ Checking matches · 12 left** means PageProof is still comparing the copies it found; **✓ All checked · ready to review** means that picture's list is final. If you open **Hidden and approved sites** or **Past searches** while a search runs, use **↩ Back to search results** to return to it (the search keeps going in its own tab). The comparing runs in the background on your computer's spare processor cores, so the page stays smooth while it works. A picture that takes longer than 30 seconds to compare is skipped and shown as **Can't check**.
   - PageProof does not trust the search sites' own "exact match" labels. It downloads every copy it found and lines it up with your picture, the same way the Compare page does, then sorts each link into:
     - **✅ Same photo**: many details line up. This is your photo, even if it was cropped, resized, mirrored, colour-changed or had text put over it. This is the list shown first.
     - **Maybe**: a few details line up. Worth a quick look. Same-photo checks also look at the middle of your picture, so a different photo taken in front of the same logo wall or backdrop is not counted as the same photo.
     - **Can't check**: the site would not let PageProof download the picture (Facebook, Instagram and so on). Open the link to look yourself.
     - **Different photo**: nothing lines up. Usually just a similar-looking picture. Hidden unless you pick it.
   - The number next to a same-photo link (for example "Same photo · 64% lines up") shows how much of the shared area matches. A low number there is normal when the copy has big headlines or text over it.
   - **🔀 Compare** opens your picture and that copy on the Compare page, already lined up, so you can check it by eye and save a PDF or video.
   - **📄 Evidence** (on Same photo and Maybe links) asks for the case number, then saves a one-page PDF *evidence report*: your picture and the copy side by side, the page and picture links, the copy's size and whether its hidden data (author, copyright) was removed, how well the two line up, how PageProof found it, and SHA-256 fingerprints of both files. The copy is downloaded again when you press the button, so the report shows what is online at that moment. Each report has a Match ID (PP-S-…) that stays the same for that picture and link.
   - **Size**: the copy's size, flagged **bigger than yours** or **cropped** when that is the case.
   - **New**: links that were not there the last time you searched the same picture. Links you have seen before say "Seen before" with the date they were first found.
   - Which site found it (Google, Yandex, Bing).
5. **✕ Not a match** is for a link PageProof got wrong: it is a different photo. It moves to **Different photo**, and PageProof keeps its numbers so the checker can be tuned from your choices. **🗑 (trash can)** is for a link you just don't want (licensed, not worth chasing and so on). Trashed links never show again for that picture. Both are saved in `Documents\PageProof\rejected-links.txt`. To bring one back, pick the **🗑 Rejected** filter and press **↩ Put back** (or delete its line from the file).
6. **Hide this site** hides that site for every picture, now and in future searches (good for Pinterest, stock photo sites and so on). To hide a whole kind of site, type its ending with a dot on the **Hidden and approved sites** page, for example `.gov` or `.edu`. To hide just one account or section of a site, press the small red **🚫 Hide x.com/examplesports** under a link, or type it the same way on that page (for example `x.com/examplesports` or `example.com/forum`). The rest of the site still shows. **Mark allowed** is for your own site and licensees: they still show, with a green **Allowed** label.
7. Tick links and press **🚫 Hide these sites** to hide several sites at once. To capture a page, press **Capture** on its link.
8. **Save results** downloads a PDF report and a spreadsheet of everything found.

**"Are you a robot" checks.** The searches run in your own browser, a few at a time with short pauses, which keeps these rare. If one appears anyway, PageProof pauses only that site, shows you the tab and waits. Tick the box and it carries on by itself. If a site keeps asking, press **Skip** and use **Search the rest** later.

**The PageProof folder (set up once).** Chrome only lets an extension use a folder you have picked yourself, and it will not let anyone pick Documents itself (it calls it a system folder). A folder inside Documents is fine, so the first time:
1. Press **📂 Set up PageProof folder**. A folder window opens in Documents.
2. Click **New folder**, name it `PageProof`, and press Enter.
3. With that new folder selected, click **Select Folder**, then **Save changes** (or **Allow**) if Chrome asks.

PageProof then makes everything inside it by itself: `hidden-sites.txt`, `allowed-sites.txt` (one site per line, you can edit them in Notepad) and the **My pictures** folder. After an update nothing changes. After a full reinstall, press **Set up PageProof folder** again and just pick your existing PageProof folder: your lists come straight back. Chrome may also ask you to press **Allow** once after it restarts.

Pick **PageProof** itself, never the **Install** folder inside it. Install holds the program, and PageProof refuses to write there.

**What PageProof remembers.** For every picture you search, PageProof remembers each link it found, when it first saw it, and how well that link's picture matched. A later search of the same picture only downloads and checks links it has not seen before, so repeat searches are much faster. This memory is kept in the browser and also as small files in `Documents\PageProof\Memory`, so updating PageProof never loses it, and even after a full reinstall it comes back once you pick the PageProof folder again.

**Your clients' photos in Google Drive.** The old *My pictures folder* is replaced by **Find copies** (section 17), which reads the photos straight from the shared Google Drive and searches them all day.

**Good to know.** PageProof reads Google's, Yandex's and Bing's results pages the same way you do. If one of them changes how its page looks, its links may stop filling in until PageProof is updated. The search tabs still open, so you can always read them yourself. Some sites (Facebook, Instagram) block picture downloads, so they show no % match.

## 17. Find copies of your clients' photos, all day

Open the full PageProof page (click the PageProof icon › **Open full PageProof**). The menu on the left has five items: **Home** (a list of what to do now, most urgent first), **Copies found** (with One at a time, Keep searching and your searches), **Clients**, **Evidence** (your captures, **Needs a capture**, Verify and the photo tools) and **Settings** (Is everything working, hidden sites, Help). The bar at the top has a **search box**, **Undo** and **Capture a page**. The thin line at the bottom shows whether Drive is connected and searching is running; anything stopped turns red with a **Fix it** button.

**Set up once: Connect your photos (4 steps).**
1. Install **Google Drive for desktop** (google.com/drive/download) and sign in with your work account. File Explorer then shows **Google Drive (G:)**.
2. In Drive's ⚙ **Preferences › Google Drive**, choose **Stream files** (so your disk doesn't fill up).
3. Press **Choose the top folder** and pick it (for example G: › Shared drives, or one shared drive). Click **▸** to open a folder and see the folders inside, then **tick only the folders you search**. Each ticked folder is one client and everything inside it is searched. Or press **＋ Add one folder** to go straight to a big folder in the folder window. Press ★ on the clients that matter most. PageProof reads the same text files as your other monitoring platform: a folder with **client_info.txt** (`client_id=…`) is named after that client ID, even deep inside a ticked folder, and a folder with **client_info_ignore.txt** (`ignore_client=true`) is marked **Skipped** and never searched, with everything inside it. Check the address in the box matches what File Explorer shows (it goes in the evidence report). A folder whose name starts with **No longer monitoring** (or Not monitoring, Do not search) is skipped too.
4. Press **Yes, start searching**. PageProof reads every folder once (this can take a while), then **Keep searching** starts.

After the browser restarts, it may ask for **one click on Allow** to read the photos again. A note pops up and a yellow bar shows on the Find copies pages.

**Keep searching** searches one photo at a time in a small window you can minimise. Choose the pace (Gentle, Steady, Faster) and hours (work hours or all day). It pauses by itself when Google Drive can't be reached, when the computer is busy or on low battery, and while today's 50 run. If a search site asks "are you a robot?", PageProof never tries to get past it: that site rests for an hour. Closing the window pauses it until the browser opens again.

**Today's 50** searches the next 50 photos at once in a window you can watch. Press **Check 50 now**, or tick **Start by itself every weekday at** a time.

**Which photos go first:** ⚑ High priority photos (next, then every 3 days), then ★ priority clients, then the newest photos, then ★ Popular photos and photos stolen before (every 7 days), then the rest. Photos where nothing was found 5 times are searched monthly, 10 times every 3 months. Doubles (the same photo saved twice) are searched once and every copy is checked against both.

**Clients and photos.** Turn searching on or off per client, star priority clients (tick several for bulk changes), and press **🔄 Look for new photos** after adding photos. PageProof also looks every hour in this and last quarter's folders, and in every folder once a week (on a weekday between 8 AM and 6 PM, when the office computers are on). Click a client to see their photos, flag them ⚑ High or ★ Popular, or tick some and press **Search now**.

**Copies found** lists every copy found, and opens on the **New** ones. Each row shows both pictures, the page link (click it to open their page in a new tab) and **Stolen**, **Licensed** and **Remove** buttons, so you can answer without opening anything. The **⋯** on a row has Skip, Approve site, Hide site, Compare, Evidence report and Capture.
- **Quick filters** along the top: Back online, Repeat offenders, Suspicious sites, Selling something, Credit removed and more. Click one to turn it on, click again to turn it off.
- **Group by** client, photo, site or site owner. **Found** today, this week or this month. **Match** exact, strong or loose. **More filters** has the client, the photo's year and quarter, and countries.
- When one site has several copies, the first shows and the rest fold under **N more from this site**, with **All stolen / All licensed / Remove all**.
- After you mark a copy Stolen, a bar offers the same photo or article on **sister sites** of the same owner, to mark them all.
- The **▾ next to Undo** lists your last ten answers; take back any one.

Hover a thumbnail to see it next to your client's photo. Click a row to open its details:
- **Their page**: a small live window of their page, and one small picture of it that PageProof keeps (about 30 KB each). Untick **Show pages by themselves** if you'd rather load it only when you press the button;
- **Their copy is kept**: PageProof saves their copy of the photo (up to 4 MB) with its SHA-256 fingerprint when it is found. **Download it** saves the file. It is deleted a week after you remove a copy;
- the **copyright registration** (VA number, or the 1-… application number) when one is found in the folder names or an Excel file in the folders;
- the full **Drive path** of your client's photo, with **Copy path**;
- the site owner, how the photo is used, the site check, whether the credit was removed, and whether it's still online;
- **Stolen (Y)**, **Licensed (L)**, **🗑 Remove (N)** or **Skip (→)**. The next copy opens by itself. **Undo (U or Ctrl+Z)** steps back through every answer;
- **✅ Approve site** when the site is allowed to use the photo: for that one client, or for every client. Its copies are marked Licensed by themselves from then on (change it in Settings › Hidden and approved sites);
- **🚫 Hide site** (just this account, just this sub-site, or the whole domain), **Open page**, **Capture**, and **Evidence report** (asks for the case number, then saves a one-page PDF).

**One at a time** (under Copies found) shows one new copy at a time, side by side or with a swipe slider (S switches), with the same keys. **Repeat offenders come first:** a new copy on a site, or a site owner, that you already marked Stolen gets a red **stolen before** badge.

**Skipped photos** (Clients and photos › Skipped photos) lists photos that could not be searched and why: the file is gone, empty, damaged, or a TIFF or HEIC (those can't be searched; save a JPG copy next to it). **Try again** puts a photo at the front of the line.

**Site owners** puts together sites run by one company (big media groups, the same company in the footer, the same Google Analytics or ad ID). **Who's behind this site** reads a site's own pages for names, contacts and domain facts, gives quick links to OpenCorporates, USPTO trademarks, Google, LinkedIn and ICANN, and lets you capture its About, Contact and Privacy pages.

**Weekly summary** (Evidence library › Weekly summary) shows what was searched, found and marked each week, and saves as a PDF.

Everything you find is kept in this browser and also in `Documents\PageProof\found-copies.txt`; your settings are in `pageproof-settings.json`. After a reinstall, first-time setup offers to bring them back.

## 18. Is everything working, and updating PageProof

**Settings › Is everything working?** shows a light for each part: Google Drive, Keep searching, the last photo searched, each search site, your backup, skipped photos and the PageProof version. Green is fine, yellow needs a look, red is stopped.

- **A search site may have stopped working.** If Google Lens finds nothing at all for 10 photos in a row (30 for Yandex or Bing), or a site gives no answer 8 times in a row, PageProof rests it for 6 hours and tells you. The empty results of that run are **not** counted against your photos. Press **Try it now** to test it straight away.
- **Copy details for support** copies numbers and settings only (how many photos, how long things take). Never a photo's name, a client's name, a site or a folder path. The page shows exactly what was copied.

**Space PageProof is using.** The same page shows how much room PageProof takes on this computer and what it is used for (kept copies of their pictures, pictures of their pages, preview pictures, captures). Under **Free up space**, tick what you no longer need and press **Free up**. Copies you marked **Stolen** are never deleted there, and the evidence packs you saved are files on your computer, so they are not touched either.

**Bigger text.** **Settings › Text size** has Normal, Large and Larger. It makes everything in PageProof bigger and is saved on that computer only.

**Keyboard keys.** Press **?** anywhere in PageProof (or the **?** button at the top) for the full list. In Copies found: **↑ ↓** move between copies, **Enter** opens one, **Y / L / N / →** answer it, **U** undoes, **/** jumps to the search box, **Esc** closes.

**Updating.** PageProof does not check for new versions by itself. Your team lead sends you each new PageProof.zip.
1. Unzip it into `Documents\PageProof\Install` and say yes to replacing the files.
2. Open `edge://extensions` (or `chrome://extensions`) and press the reload arrow on PageProof. Your finds, settings and lists are kept.

**The red "!" on the PageProof icon** means Google Drive is waiting for its one click on **Allow** after the browser restarted. Click the icon and press **Allow**.

## 19. Before you mark Stolen: rules, their page and Ready for legal

Open a copy in **Copies found** and pick the **Claim** tab in the details panel (Their page has its own tab). You'll find:

- **Firm rules.** Pick what kind of site it is (PageProof guesses: a company, a nonprofit, a public university, a government site, a church, a person who isn't famous, a celebrity, a law firm, or a user-posted article). Red **Stop** lines are uses that usually can't be pursued, such as a YouTube embed or an embed from outside the U.S. Yellow **Warn** lines need a closer look. When you press **Stolen** on a copy with a red Stop line, PageProof asks first. Yellow Warn lines only show in the panel. You can **Mark Stolen anyway**, or **Remove instead**.
- **Their page.** PageProof reads their page once (nothing on it runs) and shows the **photo credit** next to the picture, **signs it was on purpose** (a price, an Add to cart button, ads), and whether the photo is in an embedded post. Press **Read again** if the page changed.
- **Dates and damages.** The date first published comes from the photo's file name (like `10.29.26_Subject_Name.jpg`) or its folder. If neither has a date, this box is left out. With the registration number, PageProof gives a hint: registered in time for **statutory damages**, still time to **register by** a date, or **likely actual damages only**. Always check the date on the certificate.
- **Ready for legal?** (Stolen copies only.) Five ticks: page captured, registration number, kind of site, no Stop rules, and their page read. Buttons next to each missing tick fix it.

The **Evidence report** PDF gets an **About this use** box with the same facts.

**Who's behind this site** now has **Research steps**: 12 lookups with tick boxes, kept for each site.

## 20. Save a Breaking News photo

On a newspaper's page, right-click the photo and choose **PageProof › Save as Breaking News photo…**. A page opens with:

1. The **photographer** (guessed from the credit line), the **date** (from the article), the **last name**, and a **Subject** box.
2. Tick **POOL photo** for pool photos.
3. The file name, made the firm's way: `11.23.26_Subject_Lastname.jpg` (no leading zeros) or `11.23.26_POOL_Subject_Lastname.jpg`.
4. **New or recycled?** PageProof compares the photo with every photo of that photographer on Drive. **Recycled** shows the earlier file name. The first check reads photos it has never opened, so it can take a while; later checks are fast. PageProof only reads Drive, it never writes to it.
5. Press **Save as …** and pick the folder in the Save As window.

Photos with `_POOL_` in their name are never searched by Keep searching.

## 21. The details panel and the Copies found list (4.7)

**The details panel** (click any row):

1. **Pictures first.** Under them, switch between **Side by side**, **Slider** (drag across to compare) and **Their page** (a live look). PageProof remembers your pick.
2. **Small chips** show how much lines up, how it's used, the country and their size.
3. **Look at these** lists only what needs you: a suspicious site, a removed credit, a repeat offender, back online, a firm rule, a damages date. Each has a button that jumps to the right tab. Everything fine shows as one green line.
4. **Four tabs** hold the rest: **Summary**, **Their page**, **Claim** (Ready for legal, registration, dates and damages, firm rules, Drive path) and **Site** (who's behind it, Approve site, Hide site). A small dot marks a tab with something to check.
5. **Stolen, Licensed, Remove, Skip** and **Undo** stay pinned at the bottom. **More** holds Approve site, every Hide site choice, Compare and more. Hiding a site opens the next copy, like any answer.

**The Copies found list:**

- **Number tiles** at the top (New, Found today, Suspicious sites, Back online, Published in the last 3 months). Click one to filter, click again to undo it.
- **Group, Found, Match and Sort** are small dropdowns next to the tabs. The other quick filters are under **＋ Filters**.
- Each row shows a coloured **Lines up** bar, the **Client**, and **Damages**: *Statutory*, *Register by* a date, or *Actual only* (empty when the file name has no date). Small icons replace the coloured warning words: hover one to read it.
- **Columns** lets you turn columns on or off. Narrow windows show fewer.
- Group headings stay at the top while you scroll.

**One at a time** now has **Hide site** next to Approve site, with the same choices (only this account, only this sub-site, the whole site).

## 22. Backups and team lists (4.18)

Both use **Google Drive for desktop** and your own **My Drive**. PageProof never writes to the company's shared drive.

**Backups.** Settings › **Backups** › **Pick My Drive**. In the window, click **Google Drive**, then **My Drive**, then **Select Folder**. PageProof makes a **PageProof Backup** folder there and saves one backup a day (Monday to Friday, 8 AM to 6 PM). The last 14 are kept. Only you can see them.
- **Back up now** saves one straight away. The line under it says when the last backup was. It turns red after 3 work days without one.
- **Restore a backup:** press **Look at it** next to a date. PageProof shows the numbers now and after restoring. Press **Restore**. Your data right now is saved first as a **Before a restore** backup, so you can always go back.

**Team lists** share hidden and approved sites and accounts with your team.
- *Team lead, once:* Settings › **Team lists** › **Make the team folder in My Drive**. Then on drive.google.com, right-click **PageProof Team** › **Share** › **Share**, add each teammate's work email as **Editor**, and press **Send**. **Copy the steps for your team** copies the teammate steps below.
- *Each teammate, once:* on drive.google.com, open **Shared with me**, right-click **PageProof Team** › **Organize** › **Add shortcut** › **My Drive** › **Add**. Wait a minute, then in PageProof press **Pick the PageProof Team folder** (Google Drive › My Drive › PageProof Team).
- Press **Check it works**. It says who else is sharing.
- In **Hidden and approved sites**, entries from the team say who added them ("Team · Sam"). **Show for me** shows a site a teammate hid on your computer only.
- If one person hid a site and another approved it, Home and Team lists say **The team disagrees**. Pick **Keep it hidden** or **Keep it approved**, and that answer goes to everyone.
- If Google Drive for desktop is closed or signed out, Home says **Google Drive isn't syncing**. Your backup and changes wait and go out by themselves when Drive is back.

**New computer?** Settings › Backups › **Moving to a new computer** walks you through it: back up on the old one, install PageProof on the new one, then restore from first-time setup step 3.

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
