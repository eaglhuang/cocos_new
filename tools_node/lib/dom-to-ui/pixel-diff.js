// doc_id: doc_other_0009 — Pixel-Diff Harness (M16)
// Reads two PNG files and computes per-pixel coverage.
// Pure module; CLI integration in dom-to-ui-compare.js.
'use strict';

const fs = require('fs');
const { PNG } = require('pngjs');

function readPng(filePath) {
  const buf = fs.readFileSync(filePath);
  return PNG.sync.read(buf);
}

/**
 * Compare two PNGs.
 * @param {string} leftPath
 * @param {string} rightPath
 * @param {object} opts { tolerance=12, alphaMin=8, waivers=[] }
 * waivers: [{ x, y, w, h }] in left-image coordinates.
 * @returns {object} { totalPixels, matchedPixels, waiverPixels,
 *                     coveragePercent, adjustedCoverage, heatmap }
 */
function pixelDiff(leftPath, rightPath, opts) {
  opts = opts || {};
  const tol = opts.tolerance != null ? opts.tolerance : 12;
  const alphaMin = opts.alphaMin != null ? opts.alphaMin : 8;
  const waivers = opts.waivers || [];

  const left = readPng(leftPath);
  const right = readPng(rightPath);

  // Use min size (compare panels are usually equal anyway)
  const W = Math.min(left.width, right.width);
  const H = Math.min(left.height, right.height);

  const heatmap = new PNG({ width: W, height: H });
  let total = 0, matched = 0, waiverPx = 0;

  function inWaiver(x, y) {
    for (const w of waivers) {
      if (x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h) return true;
    }
    return false;
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const li = (y * left.width + x) * 4;
      const ri = (y * right.width + x) * 4;
      const hi = (y * W + x) * 4;
      const la = left.data[li + 3];
      const ra = right.data[ri + 3];
      if (la < alphaMin && ra < alphaMin) {
        // both transparent — skip
        heatmap.data[hi] = 0; heatmap.data[hi + 1] = 0; heatmap.data[hi + 2] = 0; heatmap.data[hi + 3] = 0;
        continue;
      }
      if (inWaiver(x, y)) {
        waiverPx++;
        heatmap.data[hi] = 128; heatmap.data[hi + 1] = 128; heatmap.data[hi + 2] = 128; heatmap.data[hi + 3] = 128;
        continue;
      }
      total++;
      const dr = Math.abs(left.data[li]     - right.data[ri]);
      const dg = Math.abs(left.data[li + 1] - right.data[ri + 1]);
      const db = Math.abs(left.data[li + 2] - right.data[ri + 2]);
      const ok = (dr <= tol && dg <= tol && db <= tol);
      if (ok) {
        matched++;
        // green
        heatmap.data[hi] = 0; heatmap.data[hi + 1] = 200; heatmap.data[hi + 2] = 0; heatmap.data[hi + 3] = 80;
      } else {
        // red
        heatmap.data[hi] = 230; heatmap.data[hi + 1] = 30; heatmap.data[hi + 2] = 30; heatmap.data[hi + 3] = 200;
      }
    }
  }

  const coveragePercent = total > 0 ? matched / total : 1;
  const adjustedTotal = total + waiverPx;
  const adjustedCoverage = adjustedTotal > 0 ? (matched + waiverPx) / adjustedTotal : 1;

  return {
    width: W, height: H,
    totalPixels: total,
    matchedPixels: matched,
    waiverPixels: waiverPx,
    coveragePercent,
    adjustedCoverage,
    heatmap,
  };
}

function writeHeatmap(heatmapPng, outPath) {
  fs.writeFileSync(outPath, PNG.sync.write(heatmapPng));
}

module.exports = { pixelDiff, writeHeatmap };
