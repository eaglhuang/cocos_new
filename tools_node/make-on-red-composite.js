#!/usr/bin/env node
/**
 * make-on-red-composite.js
 * Overlays a PNG on a red (#ff4444) background so transparent areas show as red.
 * Usage: node make-on-red-composite.js --input <png> --output <png>
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const args = process.argv.slice(2);
let input, output;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--input')  input  = args[++i];
  if (args[i] === '--output') output = args[++i];
}
if (!input || !output) {
  console.error('Usage: node make-on-red-composite.js --input <png> --output <png>');
  process.exit(1);
}

const src = PNG.sync.read(fs.readFileSync(input));
const out = new PNG({ width: src.width, height: src.height });

for (let y = 0; y < src.height; y++) {
  for (let x = 0; x < src.width; x++) {
    const i = (y * src.width + x) * 4;
    const a = src.data[i + 3] / 255;
    // composite over #ff4444
    out.data[i + 0] = Math.round(src.data[i + 0] * a + 0xff * (1 - a));
    out.data[i + 1] = Math.round(src.data[i + 1] * a + 0x44 * (1 - a));
    out.data[i + 2] = Math.round(src.data[i + 2] * a + 0x44 * (1 - a));
    out.data[i + 3] = 255;
  }
}

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, PNG.sync.write(out));
console.log(`Written: ${output}`);
