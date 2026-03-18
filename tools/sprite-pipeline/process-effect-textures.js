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

function buildConfig() {
  const projectRoot = path.resolve(__dirname, "..", "..");
  const configPath = path.join(__dirname, "config", "effect-textures.config.json");
  const config = readJson(configPath);
  return { projectRoot, config };
}

function removeNearBlackBackground(src, options) {
  const out = Buffer.from(src);
  const hardMaxLuma = options.hardMaxLuma;
  const softMaxLuma = options.softMaxLuma;
  const maxChroma = options.maxChroma;
  const softRange = Math.max(1, softMaxLuma - hardMaxLuma);

  for (let i = 0; i < out.length; i += 4) {
    const r = out[i + 0];
    const g = out[i + 1];
    const b = out[i + 2];
    const a = out[i + 3];

    if (a === 0) {
      continue;
    }

    const maxChannel = Math.max(r, g, b);
    const minChannel = Math.min(r, g, b);
    const chroma = maxChannel - minChannel;

    // 只清理接近黑/灰的背景，不去傷到深紅、深橘等有效特效顏色。
    if (chroma > maxChroma) {
      continue;
    }

    if (maxChannel <= hardMaxLuma) {
      out[i + 3] = 0;
      continue;
    }

    if (maxChannel < softMaxLuma) {
      const keep = clamp01((maxChannel - hardMaxLuma) / softRange);
      out[i + 3] = Math.round(a * keep);
    }
  }

  return out;
}

async function processTarget(projectRoot, defaults, target) {
  const sourcePath = path.join(projectRoot, target.source);
  const outputPath = path.join(projectRoot, target.output);
  const options = {
    hardMaxLuma: target.hardMaxLuma ?? defaults.hardMaxLuma,
    softMaxLuma: target.softMaxLuma ?? defaults.softMaxLuma,
    maxChroma: target.maxChroma ?? defaults.maxChroma,
  };

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`找不到來源貼圖: ${target.source}`);
  }

  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const keyed = removeNearBlackBackground(data, options);
  ensureDir(path.dirname(outputPath));

  await sharp(keyed, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(outputPath);

  console.log(`[effect-clean] ${target.source} -> ${target.output}`);
}

async function main() {
  const { projectRoot, config } = buildConfig();
  const defaults = config.defaults || {};
  const targets = config.targets || [];

  if (targets.length === 0) {
    console.log("No effect texture targets configured.");
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