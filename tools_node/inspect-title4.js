#!/usr/bin/env node
// Detailed region scan for 標題4 - find all opaque pixel areas
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

function readPng(p) {
  return new Promise((res, rej) => {
    fs.createReadStream(p).pipe(new PNG()).on('parsed', function() { res(this); }).on('error', rej);
  });
}

async function main() {
  const base = 'C:/Users/User/3KLife/artifacts/ui-library/title_stretch_x/general_detail/candidate_sets/candidate_batch_2026_04_09';
  const name = '\u5DE6\u53F3\u62C9\u4F38\u6A19\u984C4';
  const p = path.join(base, name, `${name}_nobg.png`);
  const png = await readPng(p);
  const { width, height, data } = png;

  console.log(`Image: ${width}x${height}`);

  // Find bounding box of all OPAQUE pixels  
  let minX = width, maxX = 0, minY = height, maxY = 0;
  const opaqueByRow = [];

  for (let y = 0; y < height; y++) {
    let rowOpaque = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] > 32) {
        rowOpaque++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    opaqueByRow.push(rowOpaque);
  }

  console.log(`Opaque bounding box: x=[${minX},${maxX}] y=[${minY},${maxY}]`);
  
  // Show opaque count per 10-row band
  console.log('\nOpaque pixels per 50-row band:');
  for (let band = 0; band < Math.ceil(height / 50); band++) {
    const startY = band * 50;
    const endY = Math.min(startY + 50, height);
    const count = opaqueByRow.slice(startY, endY).reduce((a, b) => a + b, 0);
    const bar = '#'.repeat(Math.round(count / 100));
    console.log(`  y=${String(startY).padStart(4)}-${String(endY).padStart(4)}: ${String(count).padStart(7)} ${bar}`);
  }

  // Sample some colors from opaque areas
  console.log('\nSample opaque pixel colors:');
  const samples = [];
  for (let y = minY; y <= maxY && samples.length < 10; y += 10) {
    for (let x = minX; x <= maxX && samples.length < 10; x += 30) {
      const i = (y * width + x) * 4;
      if (data[i + 3] > 32) {
        samples.push({ x, y, rgba: [data[i], data[i+1], data[i+2], data[i+3]] });
      }
    }
  }
  samples.forEach(s => console.log(`  (${s.x},${s.y}) => rgba(${s.rgba})`));
}

main().catch(e => { console.error(e); process.exit(1); });
