# Full-page capture checks

`make-pages.js` builds 60 test pages in `pages/`. Each one copies a kind of layout real
websites use that can trip up a full-page capture: details panels that slide in from the side
(like a business search result), menus over the page, sticky headings and column titles,
fixed backgrounds, boxes that slide or fade in as you scroll, late-loading pictures, endless
feeds, pop-up windows, carousels, side-scrolling rows, dropdowns, maps, frames, shadow DOM,
scroll boxes inside scroll boxes, and more. No real website is used.

Every page is covered in small squares, each in its own exact colour. `run.js` captures each
page with PageProof's own `extension/content.js`, following the same steps as `capture()` in
`extension/background.js`, joins the screens the way the viewer does, and then looks for every
square: a missing square means a blank or lost part, a square seen twice means a doubled part.
Some pages also say how tall the capture may be (so a blank strip can't sneak in).

```
node tests/capture/run.js            # every page
node tests/capture/run.js 12 39      # only pages whose names start with 12 or 39
SAVE=1 node tests/capture/run.js     # also save the joined pictures in tests/capture/out/
EXT_DIR=/some/old/extension node tests/capture/run.js   # try an older PageProof's content.js
```

If you change the capture steps in `background.js`, change `capture()` in `run.js` the same way.
