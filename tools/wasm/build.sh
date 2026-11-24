#!/bin/sh
# Builds tools/wasm/align.c into WebAssembly and puts it inside extension/align.js
# (between the WASM-START / WASM-END lines), so every page and worker that loads align.js gets it.
# Run from the repository's top folder:  sh tools/wasm/build.sh
set -e
cd "$(dirname "$0")/../.."
clang --target=wasm32 -O3 -msimd128 -mbulk-memory -nostdlib \
  -Wl,--no-entry -Wl,--export-dynamic -Wl,--initial-memory=1048576 -Wl,--max-memory=1073741824 \
  -Wl,-z,stack-size=65536 -o tools/wasm/align.wasm tools/wasm/align.c
node -e "
const fs = require('fs'), b64 = fs.readFileSync('tools/wasm/align.wasm').toString('base64');
let s = fs.readFileSync('extension/align.js', 'utf8');
s = s.replace(/(\/\/ WASM-START\n)[\s\S]*?(\n *\/\/ WASM-END)/, (m, a, z) => a + '  const WASM_B64 = \'' + b64 + '\';' + z);
fs.writeFileSync('extension/align.js', s);
console.log('align.wasm', fs.statSync('tools/wasm/align.wasm').size, 'bytes, put into extension/align.js');
"
