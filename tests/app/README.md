# PageProof's automatic checks

These run by themselves on GitHub every time a new version is made. If any check fails, the
new version is **not** released, so a broken PageProof never reaches the download page.

They start a real browser with PageProof loaded and a pretend library (pretend photos on a
pretend Google Drive folder, pretend copies found). No real photos, clients or websites are used.

| File | What it checks |
| --- | --- |
| `checks-answers.js` | Stolen / Licensed / Remove / Skip, Undo, the weekly numbers, photo folders, flags, the backup files |
| `checks-previews.js` | Preview pictures are stored separately and still show on every page |
| `checks-new.js` | Skipped photos, a broken search site, repeat offenders, Approve site, "Is everything working?", Update now |
| `speed.js` | Every main page draws quickly with 50,000 photos and 5,000 copies |

To run them yourself (needs Node.js):

```
cd tests/app
npm install playwright
npx playwright install chromium
node run.js
```
