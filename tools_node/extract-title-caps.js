#!/usr/bin/env node
/**
 * extract-title-caps.js
 *
 * Extracts left and right end-caps from a horizontal title-bar PNG.
 * Cap width = Math.round(image_width * capRatio), clamped to [minCap, maxCap].
 *
 * Outputs:
 *   <out-dir>/panel_header_cap_l_trimmed.png   — left cap (tight crop of content)
 *   <out-dir>/panel_header_cap_r_trimmed.png   — right cap (tight crop of content)
 *   <out-dir>/panel_header_cap_l_trimmed_canvas.png  — left cap padded to original canvas width
 *   <out-dir>/panel_header_cap_r_trimmed_canvas.png  — right cap padded to original canvas width
 *   <out-dir>/header-cap-extract-report.json   — metadata report
 *
 * Usage:
 *   node tools_node/extract-title-caps.js --input <png> --out-dir <dir>
 *     [--cap-ratio 0.20]  fraction of image width for each cap (default: 0.20)
 *     [--min-cap 80]      minimum cap width in pixels (default: 80)
 *     [--max-cap 280]     maximum cap width in pixels (default: 280)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = { capRatio: 0.20, minCap: 80, maxCap: 280 };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    const n = argv[i + 1];
    switch (t) {
      case '--input':     opts.input = n; i++; break;
      case '--out-dir':   opts.outDir = n; i++; break;
      case '--cap-ratio': opts.capRatio = Number(n); i++; break;
      case '--min-cap':   opts.minCap = Number(n); i++; break;
      case '--max-cap':   opts.maxCap = Number(n); i++; break;
      default: break;
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------
function cropRegion(src, x, y, w, h) {
  const out = new PNG({ width: w, height: h });
  out.data = Buffer.alloc(w * h * 4, 0);
  for (let row = 0; row < h; row++) {
    const srcOffset = ((y + row) * src.width + x) * 4;
    const dstOffset = (row * w) * 4;
    src.data.copy(out.data, dstOffset, srcOffset, srcOffset + w * 4);
  }
  return out;
}

/** Embed a region (src) into a canvas of canvasW × canvasH at position (dx, dy). */
function embedOnCanvas(src, canvasW, canvasH, dx, dy) {
  const out = new PNG({ width: canvasW, height: canvasH });
  out.data = Buffer.alloc(canvasW * canvasH * 4, 0);
  for (let row = 0; row < src.height; row++) {
    const srcOffset = row * src.width * 4;
    const dstRow = dy + row;
    if (dstRow < 0 || dstRow >= canvasH) continue;
    const dstOffset = (dstRow * canvasW + dx) * 4;
    const copyW = Math.min(src.width, canvasW - dx);
    if (copyW <= 0) continue;
    src.data.copy(out.data, dstOffset, srcOffset, srcOffset + copyW * 4);
  }
  return out;
}

function writePng(png, outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, PNG.sync.write(png));
}

function contentBounds(png) {
  let minX = png.width, maxX = 0, minY = png.height, maxY = 0;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const a = png.data[((y * png.width + x) * 4) + 3];
      if (a > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (minX > maxX) return null;
  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.input || !opts.outDir) {
    console.error('Usage: node extract-title-caps.js --input <png> --out-dir <dir>');
    process.exit(1);
  }

  const src = PNG.sync.read(fs.readFileSync(opts.input));
  const bounds = contentBounds(src);
  if (!bounds) {
    console.error('No opaque content found in image');
    process.exit(1);
  }

  // Compute cap width
  const capW = Math.max(opts.minCap, Math.min(opts.maxCap, Math.round(bounds.w * opts.capRatio)));

  // Left cap region (within tight bounding box)
  const leftCapPng   = cropRegion(src, bounds.minX, bounds.minY, capW, bounds.h);
  // Right cap region
  const rightCapPng  = cropRegion(src, bounds.maxX - capW + 1, bounds.minY, capW, bounds.h);

  // Canvas variants: embed cap at edge of original image size
  const leftCapCanvas  = embedOnCanvas(leftCapPng,  src.width, src.height, bounds.minX, bounds.minY);
  const rightCapCanvas = embedOnCanvas(rightCapPng, src.width, src.height, bounds.maxX - capW + 1, bounds.minY);

  // Outputs
  const outDir = path.resolve(opts.outDir);
  fs.mkdirSync(outDir, { recursive: true });

  const leftTrimmedPath   = path.join(outDir, 'panel_header_cap_l_trimmed.png');
  const rightTrimmedPath  = path.join(outDir, 'panel_header_cap_r_trimmed.png');
  const leftCanvasPath    = path.join(outDir, 'panel_header_cap_l_trimmed_canvas.png');
  const rightCanvasPath   = path.join(outDir, 'panel_header_cap_r_trimmed_canvas.png');

  writePng(leftCapPng,    leftTrimmedPath);
  writePng(rightCapPng,   rightTrimmedPath);
  writePng(leftCapCanvas, leftCanvasPath);
  writePng(rightCapCanvas, rightCanvasPath);

  const report = {
    input: opts.input,
    outDir: opts.outDir,
    sourceSize: { width: src.width, height: src.height },
    contentBounds: bounds,
    capWidthPx: capW,
    capRatio: opts.capRatio,
    outputs: { leftTrimmedPath, rightTrimmedPath, leftCanvasPath, rightCanvasPath },
  };
  const reportPath = path.join(outDir, 'header-cap-extract-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');

  console.log(`✓ left  trimmed  → ${leftTrimmedPath}`);
  console.log(`✓ right trimmed  → ${rightTrimmedPath}`);
  console.log(`✓ left  canvas   → ${leftCanvasPath}`);
  console.log(`✓ right canvas   → ${rightCanvasPath}`);
  console.log(`✓ report         → ${reportPath}`);
  console.log(JSON.stringify({ sourceSize: { width: src.width, height: src.height }, contentBounds: bounds, capWidthPx: capW }, null, 2));
}

main();
