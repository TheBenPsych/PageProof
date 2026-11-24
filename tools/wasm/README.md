# The fast photo checker (WebAssembly)

`align.c` holds the slow number-crunching parts of `extension/align.js` (finding corner points,
blurring, shrinking, fingerprints and pairing them up), written in C. `build.sh` turns it into
WebAssembly and puts it inside `extension/align.js`, so nothing else needs to load it.

Every function does exactly the same sums, in the same order, as its JavaScript twin, so the
answers do not change. If WebAssembly can't start, align.js uses its JavaScript versions.

To change it: edit `align.c`, run `sh tools/wasm/build.sh` (needs clang with the wasm32 target),
then check it still matches:

```
python3 tests/align/make_test_copies.py /tmp/copies
node tests/align/wasm_same.js /tmp/copies     # must say every pair is identical
node tests/align/run_tests.js /tmp/copies
```
