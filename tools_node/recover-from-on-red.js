#!/usr/bin/env node
// Recover _nobg.png from an on-red composite:
//   red pixels (#ff4444) → transparent (alpha=0)
//   other pixels         → original color (alpha=255)
'use strict';
const fs   = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const [,, srcArg, outArg] = process.argv;
if (!srcArg || !outArg) {
    console.error('Usage: node recover-from-on-red.js <on_red.png> <output_nobg.png>');
    process.exit(1);
}

const src = PNG.sync.read(fs.readFileSync(path.resolve(srcArg)));
const out = new PNG({ width: src.width, height: src.height });

const RED_R = 255, RED_G = 68, RED_B = 68; // #ff4444
const THRESHOLD = 25; // color-distance threshold for red marker

for (let i = 0; i < src.data.length; i += 4) {
    const r = src.data[i], g = src.data[i+1], b = src.data[i+2];
    const dist = Math.sqrt((r-RED_R)**2 + (g-RED_G)**2 + (b-RED_B)**2);
    if (dist < THRESHOLD) {
        out.data[i] = 0; out.data[i+1] = 0; out.data[i+2] = 0; out.data[i+3] = 0;
    } else {
        out.data[i] = r; out.data[i+1] = g; out.data[i+2] = b; out.data[i+3] = 255;
    }
}

fs.mkdirSync(path.dirname(path.resolve(outArg)), { recursive: true });
fs.writeFileSync(path.resolve(outArg), PNG.sync.write(out));
console.log(`Recovered: ${path.resolve(outArg)} (${src.width}x${src.height})`);
