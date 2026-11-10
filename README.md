<p align="center"><img src="assets/icon512.png" width="96" alt="PageProof icon"></p>

# PageProof

A browser extension for **Chrome and Firefox** that captures a whole web page, top to bottom, in one picture.

- **Whole page:** scrolls the page for you and stitches it into one tall image. Images, embeds and videos are captured exactly as they look on screen (videos as a still frame).
- **Proof of where it came from:** a banner across the top shows the website's domain, the full web address, and the date and time of the capture.
- **Hidden content too:** anything that doesn't fit on screen is marked "Section 1", "Section 2" and so on in the capture and shown in full underneath:
  - boxes that scroll up and down on their own (like the comments on an Instagram post, chat panes, long tables)
  - **dropdown lists**: every choice is written out, with the selected one marked
- **Reels, Shorts and TikToks:** on Instagram and Facebook Reels, YouTube Shorts and TikTok, only the video on screen is captured (no scrolling into the next ones), and a shortened description is opened first so the full text shows. Anything PageProof did to the page is written in the pack under "How the capture was taken".
- **Endless pages:** on sites that keep loading more articles as you scroll, the capture stops where the page ended when you clicked. Click the PageProof icon again at any time to stop a capture early and keep what it has so far.
- **Two ways to save:** PDF, and an HTML backup that stores every picture, style and font inside the file, so it still opens correctly even if the website deletes them.
- **Evidence pack:** one .zip holding everything below, named `CaseID_domain_date_time_CaptureID.zip` (for example `CASE-42_traded.co_2026-11-04_15-17-55_PP-7KQ2MX.zip`). Every capture gets its own unique Capture ID, which also appears in the PDF banner, the details file and the capture log.
  - The PDF and the HTML backup
  - `_source.html`: the page source exactly as the website's server sent it
  - `images/`: the original image files from the page
  - `fingerprints.sha256`: a SHA-256 fingerprint for every file
  - `timestamps/`: **trusted timestamp** receipts from DigiCert, Sectigo and FreeTSA. Each free service separately signs the fingerprint list with its own clock. Only the fingerprint code is sent, never your files. Nobody needs to store anything: the receipts in your zip are the proof.
  - `README.txt`: a plain-language guide explaining every file and how anyone (like a lawyer or court) can check nothing was changed
  - `VERIFY-THIS-PACK.html`: a built-in checker anyone can double-click to check the pack, with no PageProof or internet needed
  - `capture-details.txt`: web address, page title, time and time zone, window size, browser, your name, case number and notes, and the website server's IP address, clock time and response headers
- **Who hosts this site:** each capture looks up the public registration records for the site: the hosting company, domain registrar, and their abuse contacts (who a DMCA notice goes to). It's shown on the capture page, written in `capture-details.txt`, and the full records are saved in `lookups/`.
- **Batch capture:** paste a list of links and PageProof captures each one into its own evidence pack, saved to `Downloads/PageProof/<case number>/`, with a CSV report at the end. Right-click the PageProof icon to open it.
- **Verify a pack:** drop any evidence pack on this page and it checks every fingerprint and timestamp, then shows a clear green or red result.
- **Copy and Markup:** **Copy** puts the whole capture on your clipboard to paste anywhere. **Markup** lets you highlight, draw boxes, circles and arrows, or type on a copy of a capture, then copy it to paste into an email or chat, or download it as a picture or PDF. You can pick just part of the page. The copy gets a "Marked-up copy" label and is never added to the evidence pack, so the original stays untouched.
- **Capture log:** a running list of every capture and every evidence pack saved (with the pack's own fingerprint). Open it from the left bar on the capture page, and download it as a spreadsheet (.csv).

## How to use it

1. Go to any normal website.
2. Click the PageProof icon in your toolbar (or press **Alt+Shift+P**).
3. It jumps to the top of the page, then scrolls down while it captures. The icon shows a counter while it works. Don't scroll or switch tabs until it finishes. To stop early, click the icon again.
4. A new tab opens with your capture. Fill in **Collected by**, **Case / reference number** and any **Notes** (your name is remembered; the case number and notes start empty each time).
5. Then click the green **⬇ Save evidence pack** to get everything at once, or click **PDF** or **HTML** to download one file on its own.

## Checking a pack

Open **Verify a pack** in PageProof and drop the zip on it. To check without PageProof, see **[VERIFYING.md](VERIFYING.md)**.

For a step-by-step guide to using PageProof day to day, see **[TUTORIAL.md](TUTORIAL.md)**.

## Install it

### Step 1: Download

1. Open the [Latest build](https://github.com/TheBenPsych/PageProof/releases/tag/latest) page.
2. Click **PageProof.zip** to download it.
3. Unzip it: on Windows, right-click the file and choose **Extract All**. On a Mac, double-click it. You now have a folder called **PageProof**. Put it somewhere you won't delete it, like your Documents folder.

### Step 2a: Chrome (also works for Edge and Brave)

1. Type `chrome://extensions` in the address bar and press Enter.
2. Turn on **Developer mode** (the switch in the top-right corner).
3. Click **Load unpacked** and choose the unzipped **PageProof** folder.
4. Click the puzzle-piece icon in the toolbar, then the pin next to PageProof so its icon is always visible.

Chrome keeps it installed after a restart. To update later, download the new zip, replace the folder, and click the circular arrow on PageProof's card in `chrome://extensions`.

### Step 2b: Firefox

1. Type `about:debugging#/runtime/this-firefox` in the address bar and press Enter.
2. Click **Load Temporary Add-on...**
3. Open the unzipped **PageProof** folder and choose the file **manifest.json**.

Firefox removes "temporary" add-ons when it closes, so you'd repeat these steps after a restart. To install it permanently, it has to be signed by Mozilla (free). That's a planned next step.

## Good to know

- Browser pages like the new tab page, settings, and the add-on stores can't be captured. Browsers block that for safety.
- Sites that scroll inside a big box instead of the whole window (many web apps) are captured as one normal page, not as a separate section.
- Sticky headers and menus appear once at the top instead of repeating down the page.
- Very long pages stop after 60 screens.
- Carousels, fold-out areas and hover menus aren't opened automatically. Open them to what you need yourself, then press **Alt+Shift+P**.
- The PDF is always one file, however long the page.
- PageProof asks to "access data on all websites" so it can save the page's pictures, ask the server for its details, and get the timestamp. It only does this when you click capture. Besides the fingerprint code (to the timestamp services), the site's domain and server address are looked up in public registration records (rdap.org).
- Your capture log lives in this browser. Download it as a .csv now and then to keep a copy.
- Keep your evidence zips unchanged, ideally with a copy on a separate drive. Opening them is fine, but re-saving or editing a file breaks its fingerprint.
- Videos are saved as the frame showing on screen (and their cover picture in the HTML backup), not the video file itself.
- Content inside an embedded frame from another site (like a YouTube player) is captured as it looks, but scroll boxes inside such frames aren't expanded.
