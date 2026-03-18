"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function buildRuntimeConfig(projectRoot) {
  const pipelineRoot = path.join(projectRoot, "tools", "sprite-pipeline");
  const defaultConfigPath = path.join(pipelineRoot, "config", "default.config.json");

  if (!fs.existsSync(defaultConfigPath)) {
    throw new Error(`Missing config file: ${defaultConfigPath}`);
  }

  const config = readJson(defaultConfigPath);
  config.pipelineRoot = pipelineRoot;
  config.inputDir = path.join(pipelineRoot, "input");
  config.outputDir = path.join(pipelineRoot, "output");
  config.assetsRoot = path.join(projectRoot, "assets", "resources", "sprites");
  return config;
}

function parseSheetName(fileName) {
  const noExt = fileName.replace(/\.[^.]+$/, "");
  const parts = noExt.split(/[_\-\s]+/).filter(Boolean);
  const character = (parts[0] || "unit").toLowerCase();
  const action = (parts[1] || "action").toLowerCase();
  return { character, action };
}

/**
 * Load the optional per-sheet spec file.
 * Place it next to the input image with the same base name + ".spec.json".
 * Example: zhangfei_walk.png -> zhangfei_walk.spec.json
 *
 * Supported spec fields (all optional):
 *   character       string   Override character name
 *   action          string   Override action name
 *   fps             number   Animation playback fps
 *   frameOrder      number[] Explicit frame index order (0-based). Use to
 *                            reorder or exclude frames detected by the script.
 *   componentPadding  number   Per-sheet override
 *   minComponentArea  number   Per-sheet override
 *   alignPadding      number   Per-sheet override
 *   alphaThreshold    number   Per-sheet override
 *   greenKey          object   Per-sheet override (same shape as default config)
 *   output            object   Per-sheet override (format / fps fields)
 */
function loadSpec(sheetPath) {
  const specPath = sheetPath.replace(/\.[^.]+$/, ".spec.json");
  if (!fs.existsSync(specPath)) {
    return null;
  }

  try {
    const raw = readJson(specPath);
    console.log(`  [spec] Loaded overrides from ${path.basename(specPath)}`);
    return raw;
  } catch (error) {
    console.warn(`  [spec] Failed to parse ${path.basename(specPath)}: ${error.message}`);
    return null;
  }
}

function applySpec(baseConfig, naming, spec) {
  if (!spec) {
    return { config: baseConfig, naming };
  }

  const mergedNaming = {
    character: (spec.character || naming.character).toLowerCase(),
    action: (spec.action || naming.action).toLowerCase(),
  };

  const SCALAR_KEYS = ["componentPadding", "minComponentArea", "alignPadding", "alphaThreshold", "dilateRadius"];
  const mergedConfig = Object.assign({}, baseConfig);

  for (const key of SCALAR_KEYS) {
    if (spec[key] !== undefined) {
      mergedConfig[key] = spec[key];
    }
  }

  if (spec.greenKey) {
    mergedConfig.greenKey = Object.assign({}, baseConfig.greenKey);
    if (spec.greenKey.hard) {
      mergedConfig.greenKey.hard = Object.assign({}, baseConfig.greenKey.hard, spec.greenKey.hard);
    }
    if (spec.greenKey.soft) {
      mergedConfig.greenKey.soft = Object.assign({}, baseConfig.greenKey.soft, spec.greenKey.soft);
    }
  }

  if (spec.output) {
    mergedConfig.output = Object.assign({}, baseConfig.output, spec.output);
  }

  if (spec.fps !== undefined) {
    mergedConfig.output = Object.assign({}, mergedConfig.output, { fps: spec.fps });
  }

  return {
    config: mergedConfig,
    naming: mergedNaming,
    frameOrder: spec.frameOrder || null,
    gridCols: spec.gridCols || null,
    gridRows: spec.gridRows || null,
    gridOuterBorderX: spec.gridOuterBorderX || 0,
    gridOuterBorderY: spec.gridOuterBorderY || 0,
    gridInnerGapX: spec.gridInnerGapX || 0,
    gridInnerGapY: spec.gridInnerGapY || 0,
    gridInset: spec.gridInset || 0,
  };
}

/**
 * Dilate (expand) the alpha mask for component-detection purposes only.
 * This bridges small transparent gaps between a character body and its aura/effects,
 * keeping them as one connected component during detection.
 * The original RGBA buffer is NOT modified — dilation only affects the detection pass.
 *
 * Uses a fast separable box-filter approach: horizontal pass → vertical pass.
 * Time complexity: O(W × H × radius × 2)
 */
function dilateAlphaForDetection(rgba, width, height, radius) {
  if (!radius || radius <= 0) {
    return rgba;
  }

  // Build binary opaque mask from original (threshold: any alpha > 0)
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    mask[i] = rgba[i * 4 + 3] > 0 ? 1 : 0;
  }

  // Horizontal dilation
  const horzPass = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const rowBase = y * width;
    for (let x = 0; x < width; x += 1) {
      const lo = Math.max(0, x - radius);
      const hi = Math.min(width - 1, x + radius);
      for (let nx = lo; nx <= hi; nx += 1) {
        if (mask[rowBase + nx]) {
          horzPass[rowBase + x] = 1;
          break;
        }
      }
    }
  }

  // Vertical dilation
  const dilated = new Uint8Array(width * height);
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      const lo = Math.max(0, y - radius);
      const hi = Math.min(height - 1, y + radius);
      for (let ny = lo; ny <= hi; ny += 1) {
        if (horzPass[ny * width + x]) {
          dilated[y * width + x] = 1;
          break;
        }
      }
    }
  }

  // Clone RGBA and stamp dilation markers (alpha=1) for purely transparent pixels
  // Real opaque pixels keep their original alpha; only the bridged gap pixels get alpha=1
  const out = Buffer.from(rgba);
  for (let i = 0; i < width * height; i += 1) {
    if (dilated[i] && out[i * 4 + 3] === 0) {
      out[i * 4 + 3] = 1; // marker: invisible to eye, but > 0 for connectivity
    }
  }

  return out;
}

function keyOutGreen(src, config) {
  const out = Buffer.from(src);
  const hard = config.greenKey.hard;
  const soft = config.greenKey.soft;

  for (let i = 0; i < out.length; i += 4) {
    const r = out[i + 0];
    const g = out[i + 1];
    const b = out[i + 2];
    const a = out[i + 3];

    const maxOther = Math.max(r, b);
    const delta = g - maxOther;

    if (g >= hard.minGreen && delta >= hard.minDelta) {
      out[i + 3] = 0;
      continue;
    }

    if (g >= soft.minGreen && delta >= soft.minDelta) {
      out[i + 3] = Math.floor(a * soft.alphaScale);
      const neutral = Math.floor((r + b) * 0.5);
      out[i + 1] = Math.floor((g + neutral) * 0.5);
    }
  }

  return out;
}

function collectComponents(rgba, width, height, alphaThreshold, minArea) {
  const visited = new Uint8Array(width * height);
  const components = [];

  function idx(x, y) {
    return y * width + x;
  }

  function alphaAt(x, y) {
    return rgba[(idx(x, y) * 4) + 3];
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const startI = idx(x, y);
      if (visited[startI] || alphaAt(x, y) <= alphaThreshold) {
        continue;
      }

      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;
      let area = 0;

      const queue = [[x, y]];
      visited[startI] = 1;

      for (let q = 0; q < queue.length; q += 1) {
        const [cx, cy] = queue[q];
        area += 1;

        if (cx < minX) minX = cx;
        if (cy < minY) minY = cy;
        if (cx > maxX) maxX = cx;
        if (cy > maxY) maxY = cy;

        const neighbors = [
          [cx - 1, cy],
          [cx + 1, cy],
          [cx, cy - 1],
          [cx, cy + 1],
        ];

        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            continue;
          }

          const n = idx(nx, ny);
          if (visited[n]) {
            continue;
          }

          if (alphaAt(nx, ny) <= alphaThreshold) {
            continue;
          }

          visited[n] = 1;
          queue.push([nx, ny]);
        }
      }

      if (area >= minArea) {
        components.push({ minX, minY, maxX, maxY, area });
      }
    }
  }

  return components;
}

function sortComponents(components) {
  if (components.length <= 1) {
    return components;
  }

  const sortedByY = [...components].sort((a, b) => a.minY - b.minY);
  const heights = sortedByY.map((c) => c.maxY - c.minY + 1).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length * 0.5)] || 1;
  const rowThreshold = Math.max(24, Math.floor(medianHeight * 0.55));

  const rows = [];
  for (const comp of sortedByY) {
    const centerY = (comp.minY + comp.maxY) * 0.5;
    const targetRow = rows.find((row) => Math.abs(row.centerY - centerY) <= rowThreshold);
    if (!targetRow) {
      rows.push({ centerY, list: [comp] });
      continue;
    }

    targetRow.list.push(comp);
    targetRow.centerY = (targetRow.centerY * (targetRow.list.length - 1) + centerY) / targetRow.list.length;
  }

  rows.sort((a, b) => a.centerY - b.centerY);
  for (const row of rows) {
    row.list.sort((a, b) => a.minX - b.minX);
  }

  return rows.flatMap((row) => row.list);
}

function computeAnchorX(crop, width, height, alphaThreshold) {
  const bottomBand = Math.min(8, height);
  const startY = height - bottomBand;
  let sumX = 0;
  let count = 0;

  for (let y = startY; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = crop[(y * width + x) * 4 + 3];
      if (alpha > alphaThreshold) {
        sumX += x;
        count += 1;
      }
    }
  }

  if (count === 0) {
    return Math.floor(width * 0.5);
  }

  return Math.floor(sumX / count);
}

function extractCrop(rgba, srcWidth, box) {
  const width = box.maxX - box.minX + 1;
  const height = box.maxY - box.minY + 1;
  const crop = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const srcI = (((box.minY + y) * srcWidth) + (box.minX + x)) * 4;
      const dstI = ((y * width) + x) * 4;
      crop[dstI + 0] = rgba[srcI + 0];
      crop[dstI + 1] = rgba[srcI + 1];
      crop[dstI + 2] = rgba[srcI + 2];
      crop[dstI + 3] = rgba[srcI + 3];
    }
  }

  return { crop, width, height };
}

function blitAlignedFrame(cropInfo, targetWidth, targetHeight, alignPadding, fixedAnchorX = null, fixedAnchorY = null) {
  const out = Buffer.alloc(targetWidth * targetHeight * 4);
  const anchorLocalX = fixedAnchorX !== null ? fixedAnchorX : computeAnchorX(cropInfo.crop, cropInfo.width, cropInfo.height, 10);
  const anchorLocalY = fixedAnchorY !== null ? fixedAnchorY : cropInfo.height - 1;

  const anchorTargetX = Math.floor(targetWidth * 0.5);
  const anchorTargetY = targetHeight - alignPadding;

  const offsetX = anchorTargetX - anchorLocalX;
  const offsetY = anchorTargetY - anchorLocalY;

  for (let y = 0; y < cropInfo.height; y += 1) {
    const ty = y + offsetY;
    if (ty < 0 || ty >= targetHeight) {
      continue;
    }

    for (let x = 0; x < cropInfo.width; x += 1) {
      const tx = x + offsetX;
      if (tx < 0 || tx >= targetWidth) {
        continue;
      }

      const srcI = (y * cropInfo.width + x) * 4;
      const alpha = cropInfo.crop[srcI + 3];
      if (alpha === 0) {
        continue;
      }

      const dstI = (ty * targetWidth + tx) * 4;
      out[dstI + 0] = cropInfo.crop[srcI + 0];
      out[dstI + 1] = cropInfo.crop[srcI + 1];
      out[dstI + 2] = cropInfo.crop[srcI + 2];
      out[dstI + 3] = alpha;
    }
  }

  return out;
}

async function writeFrame(rgba, width, height, outputPath, format) {
  const image = sharp(rgba, {
    raw: { width, height, channels: 4 },
  });

  if (format === "webp") {
    await image.webp({ quality: 95 }).toFile(outputPath.replace(/\.png$/i, ".webp"));
    return;
  }

  await image.png().toFile(outputPath);
}

/**
 * Shrink a crop to the tight bounding box of opaque pixels.
 * Used in grid mode to match component-detection's tight crop behaviour,
 * ensuring bottom-anchor alignment works correctly across all frames.
 */
function tightenCrop(cropInfo) {
  const { crop, width, height } = cropInfo;
  let minX = width, maxX = -1, minY = height, maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (crop[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return cropInfo; // fully transparent cell — return as-is
  const newW = maxX - minX + 1;
  const newH = maxY - minY + 1;
  const newCrop = Buffer.alloc(newW * newH * 4);
  for (let y = 0; y < newH; y += 1) {
    for (let x = 0; x < newW; x += 1) {
      const srcI = ((y + minY) * width + (x + minX)) * 4;
      const dstI = (y * newW + x) * 4;
      newCrop[dstI]     = crop[srcI];
      newCrop[dstI + 1] = crop[srcI + 1];
      newCrop[dstI + 2] = crop[srcI + 2];
      newCrop[dstI + 3] = crop[srcI + 3];
    }
  }
  return { crop: newCrop, width: newW, height: newH };
}

async function processSingleSheet(sheetPath, baseConfig) {
  const fileName = path.basename(sheetPath);
  const rawNaming = parseSheetName(fileName);
  const spec = loadSpec(sheetPath);
  const { config, naming, frameOrder, gridCols, gridRows,
    gridOuterBorderX, gridOuterBorderY, gridInnerGapX, gridInnerGapY, gridInset } = applySpec(baseConfig, rawNaming, spec);

  console.log(`Processing: ${fileName} -> ${naming.character}/${naming.action}`);

  const { data, info } = await sharp(sheetPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const keyOut = keyOutGreen(data, config);

  let crops;
  let targetWidth;
  let targetHeight;
  let globalAnchorX = null;
  let globalAnchorY = null;

  if (gridCols && gridRows) {
    // ── Grid mode ───────────────────────────────────────────────────────────
    // When the spritesheet has touching/overlapping frames (common for AI art),
    // uniform grid cutting is more reliable than component detection.
    console.log(`  Grid mode: ${gridCols} cols × ${gridRows} rows = ${gridCols * gridRows} frame(s)`);

    // Border-aware cell sizing: exclude outer border and inner grid lines.
    // gridOuterBorderX/Y = pixels of outer frame on each side.
    // gridInnerGapX/Y    = width of dividing lines between cells.
    const contentW = info.width  - 2 * gridOuterBorderX - (gridCols - 1) * gridInnerGapX;
    const contentH = info.height - 2 * gridOuterBorderY - (gridRows - 1) * gridInnerGapY;
    const cellW = Math.floor(contentW / gridCols);
    const cellH = Math.floor(contentH / gridRows);
    const gridBoxes = [];
    const inset = gridInset || 0;

    for (let row = 0; row < gridRows; row += 1) {
      for (let col = 0; col < gridCols; col += 1) {
        const x0 = gridOuterBorderX + col * (cellW + gridInnerGapX) + inset;
        const y0 = gridOuterBorderY + row * (cellH + gridInnerGapY) + inset;
        gridBoxes.push({
          minX: clamp(x0, 0, info.width - 1),
          minY: clamp(y0, 0, info.height - 1),
          maxX: clamp(x0 + cellW - 2 * inset - 1, 0, info.width - 1),
          maxY: clamp(y0 + cellH - 2 * inset - 1, 0, info.height - 1),
        });
      }
    }

    // Apply explicit frame order from spec if given
    const orderedBoxes = frameOrder
      ? frameOrder.map((i) => gridBoxes[i]).filter(Boolean)
      : gridBoxes;

    // Extract each cell exactly as is to preserve relative placement
    const rawCrops = orderedBoxes.map((box) => extractCrop(keyOut, info.width, box));

    // Find the global bounding box over all raw cells to eliminate static empty padding,
    // while keeping relative positioning exactly intact (no jitter)
    let gMinX = cellW, gMaxX = -1, gMinY = cellH, gMaxY = -1;
    for (const c of rawCrops) {
      for (let y = 0; y < c.height; y += 1) {
        for (let x = 0; x < c.width; x += 1) {
          if (c.crop[(y * c.width + x) * 4 + 3] > 0) {
            if (x < gMinX) gMinX = x;
            if (x > gMaxX) gMaxX = x;
            if (y < gMinY) gMinY = y;
            if (y > gMaxY) gMaxY = y;
          }
        }
      }
    }
    
    if (gMaxX < gMinX) { gMinX = 0; gMaxX = cellW - 1; gMinY = 0; gMaxY = cellH - 1; }
    
    const cropW = gMaxX - gMinX + 1;
    const cropH = gMaxY - gMinY + 1;
    
    // Crop all cells to the same global bounding box
    crops = rawCrops.map(c => {
      const cropped = Buffer.alloc(cropW * cropH * 4);
      for (let y = 0; y < cropH; y += 1) {
        for (let x = 0; x < cropW; x += 1) {
          const srcI = ((y + gMinY) * c.width + (x + gMinX)) * 4;
          const dstI = (y * cropW + x) * 4;
          cropped[dstI] = c.crop[srcI];
          cropped[dstI + 1] = c.crop[srcI + 1];
          cropped[dstI + 2] = c.crop[srcI + 2];
          cropped[dstI + 3] = c.crop[srcI + 3];
        }
      }
      return { crop: cropped, width: cropW, height: cropH };
    });

    targetWidth = cropW;
    targetHeight = cropH + config.alignPadding;
    
    // Use the geometric center of the cell's bounding box as the fixed anchor,
    // and the maximum Y (lowest point of pixels across all frames) as the feet level
    globalAnchorX = Math.floor(cellW / 2) - gMinX;
    globalAnchorY = cropH - 1;

  } else {
    // ── Component-detection mode (default) ─────────────────────────────────
    const dilateRadius = config.dilateRadius || 0;
    const detectionBuffer = dilateRadius > 0
      ? dilateAlphaForDetection(keyOut, info.width, info.height, dilateRadius)
      : keyOut;
    if (dilateRadius > 0) {
      console.log(`  Detection dilation: radius=${dilateRadius}px (body+aura bridging)`);
    }

    const detectThreshold = dilateRadius > 0 ? 0 : config.alphaThreshold;
    const components = collectComponents(
      detectionBuffer,
      info.width,
      info.height,
      detectThreshold,
      config.minComponentArea
    );

    if (components.length === 0) {
      throw new Error(`No frame-like component detected in: ${fileName}`);
    }

    console.log(`  Detected ${components.length} component(s). Sorting into frames...`);
    const sorted = sortComponents(components);

    const ordered = frameOrder
      ? frameOrder.map((i) => sorted[i]).filter(Boolean)
      : sorted;

    const boxes = ordered.map((c) => ({
      minX: clamp(c.minX - config.componentPadding, 0, info.width - 1),
      minY: clamp(c.minY - config.componentPadding, 0, info.height - 1),
      maxX: clamp(c.maxX + config.componentPadding, 0, info.width - 1),
      maxY: clamp(c.maxY + config.componentPadding, 0, info.height - 1),
    }));

    crops = boxes.map((box) => extractCrop(keyOut, info.width, box));
    targetWidth = Math.max(...crops.map((c) => c.width));
    targetHeight = Math.max(...crops.map((c) => c.height)) + config.alignPadding;
  }

  console.log(`  Frame canvas: ${targetWidth}x${targetHeight}, total ${crops.length} frame(s)`);

  const outDir = path.join(config.outputDir, naming.character, naming.action);
  const assetsDir = path.join(config.assetsRoot, naming.character, naming.action);
  ensureDir(outDir);
  ensureDir(assetsDir);

  // Clean stale frames from previous runs so old frame counts don't linger.
  for (const dir of [outDir, assetsDir]) {
    for (const f of fs.readdirSync(dir)) {
      if (/\.(png|webp)$/i.test(f)) fs.unlinkSync(path.join(dir, f));
    }
  }

  const format = (config.output.format || "png").toLowerCase();
  const manifest = {
    character: naming.character,
    action: naming.action,
    fps: config.output.fps || 12,
    source: path.relative(config.pipelineRoot, sheetPath),
    frameSize: { width: targetWidth, height: targetHeight },
    frameCount: crops.length,
    frames: [],
  };

  for (let i = 0; i < crops.length; i += 1) {
    const frameIndex = String(i + 1).padStart(2, "0");
    const baseName = `${naming.character}_${naming.action}_${frameIndex}`;
      const aligned = blitAlignedFrame(crops[i], targetWidth, targetHeight, config.alignPadding, globalAnchorX, globalAnchorY);

    const outPngPath = path.join(outDir, `${baseName}.png`);
    await writeFrame(aligned, targetWidth, targetHeight, outPngPath, format);

    const ext = format === "webp" ? "webp" : "png";
    const fileNameOut = `${baseName}.${ext}`;
    const assetsOutputPath = path.join(assetsDir, fileNameOut);
    fs.copyFileSync(path.join(outDir, fileNameOut), assetsOutputPath);

    manifest.frames.push(fileNameOut);
    process.stdout.write(`  frame ${frameIndex} OK\n`);
  }

  const manifestPath = path.join(outDir, `${naming.character}_${naming.action}.json`);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`Done: ${crops.length} frames -> ${path.relative(config.pipelineRoot, outDir)}`);
  return { fileName, outDir, assetsDir, frameCount: crops.length, manifest };
}

async function main() {
  const projectRoot = path.resolve(__dirname, "..", "..");
  const config = buildRuntimeConfig(projectRoot);

  ensureDir(config.inputDir);
  ensureDir(config.outputDir);
  ensureDir(config.assetsRoot);

  const entries = fs.readdirSync(config.inputDir, { withFileTypes: true });
  const sheets = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => IMAGE_EXT.has(path.extname(name).toLowerCase()))
    .map((name) => path.join(config.inputDir, name));

  if (sheets.length === 0) {
    console.log("No input spritesheet found. Put files into tools/sprite-pipeline/input and run again.");
    return;
  }

  const reports = [];
  for (const sheetPath of sheets) {
    try {
      const report = await processSingleSheet(sheetPath, config);
      reports.push(report);
    } catch (error) {
      console.error(`[FAIL] ${path.basename(sheetPath)} -> ${error.message || error}`);
    }
  }

  const summaryPath = path.join(config.outputDir, "last-run-summary.json");
  fs.writeFileSync(
    summaryPath,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2)}\n`,
    "utf8"
  );

  console.log(`Done. Summary: ${path.relative(projectRoot, summaryPath)}`);
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
