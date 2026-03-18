"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function clamp01(value) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / Math.max(0.0001, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function max01(a, b) {
  return a > b ? a : b;
}

function buildConfig() {
  const projectRoot = path.resolve(__dirname, "..", "..");
  const configPath = path.join(__dirname, "config", "effect-layer-splits.config.json");
  const config = readJson(configPath);
  return { projectRoot, config };
}

function splitLayers(src, info, options) {
  const ring = Buffer.alloc(src.length);
  const main = Buffer.alloc(src.length);
  const arrow = Buffer.alloc(src.length);
  const feather = options.feather;
  const splitFeather = options.splitFeather;

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const pixelIndex = (y * info.width + x) * 4;
      const dx = x - options.centerX;
      const dy = y - options.centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const innerMask = smoothstep(options.innerRadius - feather, options.innerRadius + feather, distance);
      const outerMask = 1 - smoothstep(options.outerRadius - feather, options.outerRadius + feather, distance);
      const ringMask = clamp01(innerMask * outerMask * options.ringOpacity);
      const ringRemovedMask = clamp01(1 - ringMask * options.ringRemovalStrength);
      const focusMask = 1 - smoothstep(options.focusRadius - options.focusFeather, options.focusRadius + options.focusFeather, distance);
      const symbolMask = clamp01(ringRemovedMask * focusMask);
      const arrowMask = 1 - smoothstep(options.centerY + options.arrowBottomOffset - splitFeather, options.centerY + options.arrowBottomOffset + splitFeather, y);
      const mainMask = smoothstep(options.centerY + options.mainTopOffset - splitFeather, options.centerY + options.mainTopOffset + splitFeather, y);
      const arrowAlphaMask = clamp01(symbolMask * arrowMask);
      const mainAlphaMask = clamp01(symbolMask * mainMask);

      ring[pixelIndex + 0] = src[pixelIndex + 0];
      ring[pixelIndex + 1] = src[pixelIndex + 1];
      ring[pixelIndex + 2] = src[pixelIndex + 2];
      ring[pixelIndex + 3] = Math.round(src[pixelIndex + 3] * ringMask);

      main[pixelIndex + 0] = src[pixelIndex + 0];
      main[pixelIndex + 1] = src[pixelIndex + 1];
      main[pixelIndex + 2] = src[pixelIndex + 2];
      main[pixelIndex + 3] = Math.round(src[pixelIndex + 3] * mainAlphaMask);

      arrow[pixelIndex + 0] = src[pixelIndex + 0];
      arrow[pixelIndex + 1] = src[pixelIndex + 1];
      arrow[pixelIndex + 2] = src[pixelIndex + 2];
      arrow[pixelIndex + 3] = Math.round(src[pixelIndex + 3] * arrowAlphaMask);
    }
  }

  return { ring, main, arrow };
}

async function writeImage(buffer, info, outputPath) {
  ensureDir(path.dirname(outputPath));
  await sharp(buffer, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png().toFile(outputPath);
}

async function processTarget(projectRoot, defaults, target) {
  const sourcePath = path.join(projectRoot, target.source);
  const ringOutputPath = path.join(projectRoot, target.ringOutput);
  const mainOutputPath = path.join(projectRoot, target.mainOutput);
  const arrowOutputPath = path.join(projectRoot, target.arrowOutput);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`找不到來源貼圖: ${target.source}`);
  }

  const options = {
    centerX: target.centerX ?? defaults.centerX,
    centerY: target.centerY ?? defaults.centerY,
    innerRadius: target.innerRadius ?? defaults.innerRadius,
    outerRadius: target.outerRadius ?? defaults.outerRadius,
    feather: target.feather ?? defaults.feather,
    ringOpacity: target.ringOpacity ?? defaults.ringOpacity,
    ringRemovalStrength: target.ringRemovalStrength ?? defaults.ringRemovalStrength,
    focusRadius: target.focusRadius ?? defaults.focusRadius,
    focusFeather: target.focusFeather ?? defaults.focusFeather,
    arrowBottomOffset: target.arrowBottomOffset ?? defaults.arrowBottomOffset,
    mainTopOffset: target.mainTopOffset ?? defaults.mainTopOffset,
    splitFeather: target.splitFeather ?? defaults.splitFeather,
  };

  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { ring, main, arrow } = splitLayers(data, info, options);
  await writeImage(ring, info, ringOutputPath);
  await writeImage(main, info, mainOutputPath);
  await writeImage(arrow, info, arrowOutputPath);

  console.log(`[effect-split] ${target.source} -> ${target.ringOutput}, ${target.mainOutput}, ${target.arrowOutput}`);
}

async function main() {
  const { projectRoot, config } = buildConfig();
  const defaults = config.defaults || {};
  const targets = config.targets || [];

  if (targets.length === 0) {
    console.log("No effect layer split targets configured.");
    return;
  }

  for (const target of targets) {
    await processTarget(projectRoot, defaults, target);
  }
}

main().catch(error => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});