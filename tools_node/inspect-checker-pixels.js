#!/usr/bin/env node
// Inspect pixel colors in the bottom region of title images to understand the checker artifact
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const base = 'C:/Users/User/3KLife/artifacts/ui-library/title_stretch_x/general_detail/candidate_sets/candidate_batch_2026_04_09';
const nums = [4, 6, 7, 9];

function readPng(p) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(p).pipe(new PNG()).on('parsed', function() { resolve(this); }).on('error', reject);
  });
}

async function inspectChecker(num) {
  const name = `\u5DE6\u53F3\u62C9\u4F38\u6A19\u984C${num}`;
  const p = path.join(base, name, `${name}_nobg.png`);
  const png = await readPng(p);
  const { width, height, data } = png;
  const channels = 4;

  // Sample bottom-center region (where checker usually is) - last 30% rows
  const startY = Math.floor(height * 0.7);
  const cx = Math.floor(width / 2);
  const sampleX = [cx - 20, cx, cx + 20];

  let opaqueCounts = 0, transparentCounts = 0;
  const colorSamples = [];
  const colorHistogram = {};

  for (let y = startY; y < height; y += 2) {
    for (let x = cx - 60; x <= cx + 60; x += 4) {
      const i = (y * width + x) * channels;
      if (x < 0 || x >= width) continue;
      const a = data[i + 3];
      if (a > 128) {
        opaqueCounts++;
        const key = `${data[i]},${data[i+1]},${data[i+2]}`;
        colorHistogram[key] = (colorHistogram[key] || 0) + 1;
        if (colorSamples.length < 6) colorSamples.push([data[i], data[i+1], data[i+2], a]);
      } else {
        transparentCounts++;
      }
    }
  }

  console.log(`\ntitle${num}: ${width}x${height}`);
  console.log(`  bottom-center region opaque=${opaqueCounts} transparent=${transparentCounts}`);
  if (opaqueCounts > 0) {
    console.log(`  sample RGBA:`, JSON.stringify(colorSamples));
    // Top 5 colors
    const sorted = Object.entries(colorHistogram).sort((a, b) => b[1] - a[1]).slice(0, 5);
    console.log(`  top colors:`, sorted.map(([k, v]) => `${k} (x${v})`).join(', '));
  }
}

async function main() {
  for (const n of nums) {
    await inspectChecker(n);
  }
  console.log('\ndone');
}

main().catch(e => { console.error(e); process.exit(1); });
