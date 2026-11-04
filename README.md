<p align="center"><img src="assets/icon512.png" width="96" alt="PageProof icon"></p>

# PageProof

A browser extension for **Chrome and Firefox** that captures a whole web page, top to bottom, in one picture.

- **Whole page:** scrolls the page for you and stitches it into one tall image. Images, embeds and videos are captured exactly as they look on screen (videos as a still frame).
- **Proof of where it came from:** a banner across the top shows the website's domain, the full web address, and the date and time of the capture.
- **Scroll boxes too:** parts of the page that scroll on their own (chat panes, long tables, comment boxes) are marked "Section 1", "Section 2" and so on in the capture, and their full contents are added as numbered sections underneath the main page.
- **Three ways to save:** PNG (image), PDF, and an HTML backup of the page's code.

## How to use it

1. Go to any normal website.
2. Click the PageProof icon in your toolbar (or press **Alt+Shift+P**).
3. It jumps to the top of the page, then scrolls down while it captures. The icon shows a counter while it works. Don't scroll or switch tabs until it finishes.
4. A new tab opens with your capture. Click **Download PNG**, **Download PDF**, or **Download HTML backup**.

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
- Very long pages stop after 60 screens. Very tall captures download as more than one PNG part, but the PDF is always one file.
- The HTML backup saves the page's text and layout. Pictures in it still load from the original website, so the PNG or PDF is your real proof.
- Content inside an embedded frame from another site (like a YouTube player) is captured as it looks, but scroll boxes inside such frames aren't expanded.
- Nothing is sent anywhere. Everything happens inside your browser.
