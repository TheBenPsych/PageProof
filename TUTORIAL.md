# PageProof tutorial: capturing evidence step by step

This guide shows how to use PageProof day to day, once it's installed in your browser.

---

## Before you start (once)

1. **Pin the icon.** Click the puzzle-piece icon at the top right of Chrome, then the pin next to **PageProof**. The PageProof icon (a blue page with a green check) now sits in your toolbar.
2. **Optional: sign in to archive.org.** If you have a free [archive.org](https://archive.org/account/signup) account, sign in once in Chrome. PageProof's Wayback Machine saves are faster and fail less when you're signed in.

---

## 1. Capture a page

1. **Open the page** with the infringing content in a normal tab.
2. **Get it ready.** Close pop-ups and cookie banners, and open anything you need to show, like a menu or the right carousel slide. PageProof captures what's on screen, plus anything below it.
3. **Click the PageProof icon** (or press **Alt+Shift+P**).
4. **Hands off.** PageProof jumps to the top and scrolls down by itself. The icon shows a counter (1, 2, 3...) while it works. Don't scroll, click, or switch tabs until it finishes.
   - Need to stop? **Click the icon again.** It stops and keeps everything captured so far.
5. A new tab opens: the **capture page**.

> **Tip:** On pages that keep loading more posts as you scroll ("endless scrolling"), PageProof stops where the page ended when you clicked, and notes this in the record.

---

## 2. Check the capture page

From top to bottom, the capture page shows:

| Part | What to do |
| --- | --- |
| **Status line** | Read it. It tells you about anything special: sections found, endless scrolling, a timestamp service that didn't answer. |
| **Wayback Machine box** | Wait for it to turn green (usually under a minute). Then click **Copy link** to paste the Wayback link into your case notes, or **Open** to view it. If it says it couldn't save, the site probably blocks the Archive. Your own evidence is unaffected. |
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
- **Case / reference number:** for example `CASE-2026-114`. It's remembered too, and goes at the start of the zip's file name.
- **Notes:** what this shows, for example "Client photo used without licence on product page."

---

## 4. Save the evidence pack

Click the green **Download evidence pack (.zip)** button.

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
| `capture-details.txt` | The full record: web address, times, your case details, server IP address, Wayback link and every fingerprint |
| `fingerprints.sha256` | The fingerprint of every evidence file |
| `timestamps/` | Signed receipts from independent timestamp services (DigiCert, Sectigo, FreeTSA), proving when the pack existed |
| `README.txt` | A plain-language explanation for whoever receives the pack |

You can also download just the **PDF** or **HTML backup** with their own buttons. Only the zip carries the fingerprints and timestamps, so always keep the zip.

---

## 5. Store it safely

- **Don't edit files** inside the zip. Opening, copying, renaming or emailing them is fine, but editing and re-saving breaks their fingerprints.
- **Keep two copies,** for example on the case drive and on a backup drive.
- **Never re-save the PDF** from a PDF editor. If you need to mark it up, work on a copy, and keep the original zip untouched.

---

## 6. Capture the Wayback copy too (optional)

Many cases also use a capture of the Wayback Machine page:

1. On the capture page, click **Open** in the Wayback Machine box.
2. When the archived page has loaded, click the **PageProof icon**.
3. Save that pack under the same case number. It's stamped and fingerprinted like any other capture, and the Wayback link is in its web address.

---

## 7. Find past captures: the capture log

Click **Capture log** at the top of any PageProof page. It lists every capture and every pack saved on this computer: when, which page, the case number, who collected it, the zip's fingerprint, the timestamps and the Wayback link.

- **Download log (.csv)** opens in Excel. Download it now and then and keep it with your records, since the log lives only in this browser.

---

## 8. Check a pack later: Verify a pack

Use this whenever you or someone else needs to confirm a pack hasn't been changed.

1. Click **Verify a pack** at the top of the capture page or the capture log.
2. **Drop the zip** on the box (or click it and choose the file).
3. Read the result:
   - 🟢 **Unchanged:** every file matches its fingerprint, and the timestamps are valid. It also shows when the services signed it.
   - 🔴 **Warning: this pack has been changed:** it lists exactly which file was changed, removed, or doesn't match its timestamp.
   - 🟡 **No trusted timestamp:** the files match, but the pack has no timestamp to prove when it was made.
4. It also tells you whether this is the **exact zip** recorded in your capture log.

**Checking a single file** (for example, a PDF someone emailed back to you): first drop the original zip, then drop the single file. PageProof tells you whether it matches a file in that pack.

People without PageProof can check a pack by hand using [VERIFYING.md](VERIFYING.md).

---

## Light or dark mode

PageProof's pages open in light mode. Click **🌙 Dark mode** at the top right to switch. Your captures always show the website exactly as it looked.

---

## Quick troubleshooting

| Problem | What to do |
| --- | --- |
| "This page could not be captured" | Browser pages (new tab, settings, the Chrome Web Store) can't be captured. Try a normal website. |
| The capture shows a pop-up or cookie banner | Close it on the page, then capture again. |
| Something you need is hidden in a menu, carousel or "show more" | Open it on the page first, then capture. |
| The Wayback box says it couldn't save | The site may block the Archive, or the Archive is busy. Try again later from web.archive.org, or rely on your own pack. |
| A timestamp service "did not answer" | That's fine as long as at least one other service signed. The status line says which ones did. |
| The capture stopped early | Very long pages stop after 60 screens, and endless pages stop at their original end. The status line explains which. |
