#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const repoRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(repoRoot, 'assets/resources/ui/tiger-tally/frame-parts/ssr');
const tiers = {
  r: {
    shadow: [26, 20, 14],
    mid: [112, 84, 52],
    light: [204, 160, 106],
  },
  sr: {
    shadow: [19, 28, 27],
    mid: [55, 121, 116],
    light: [185, 226, 216],
  },
  ur: {
    shadow: [34, 26, 10],
    mid: [166, 123, 34],
    light: [255, 229, 150],
  },
  lr: {
    shadow: [27, 30, 43],
    mid: [130, 158, 196],
    light: [244, 238, 200],
  },
};

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function samplePalette(palette, value) {
  if (value <= 0.45) {
    const t = value / 0.45;
    return [
      lerp(palette.shadow[0], palette.mid[0], t),
      lerp(palette.shadow[1], palette.mid[1], t),
      lerp(palette.shadow[2], palette.mid[2], t),
    ];
  }
  const t = (value - 0.45) / 0.55;
  return [
    lerp(palette.mid[0], palette.light[0], t),
    lerp(palette.mid[1], palette.light[1], t),
    lerp(palette.mid[2], palette.light[2], t),
  ];
}

function recolorPng(inputPath, outputPath, palette) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(inputPath)
      .pipe(new PNG())
      .on('parsed', function parsed() {
        for (let y = 0; y < this.height; y += 1) {
          for (let x = 0; x < this.width; x += 1) {
            const idx = (this.width * y + x) << 2;
            const alpha = this.data[idx + 3];
            if (alpha === 0) continue;

            const r = this.data[idx];
            const g = this.data[idx + 1];
            const b = this.data[idx + 2];
            const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
            const [nr, ng, nb] = samplePalette(palette, Math.max(0, Math.min(1, luminance)));

            this.data[idx] = nr;
            this.data[idx + 1] = ng;
            this.data[idx + 2] = nb;
          }
        }

        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        this.pack()
          .pipe(fs.createWriteStream(outputPath))
          .on('finish', resolve)
          .on('error', reject);
      })
      .on('error', reject);
  });
}

async function main() {
  const sourceFiles = fs.readdirSync(sourceDir).filter(name => name.endsWith('.png'));
  for (const [tier, palette] of Object.entries(tiers)) {
    const targetDir = path.join(repoRoot, `assets/resources/ui/tiger-tally/frame-parts/${tier}`);
    for (const fileName of sourceFiles) {
      const outputName = fileName.replace(/_ssr\.png$/i, `_${tier}.png`);
      await recolorPng(path.join(sourceDir, fileName), path.join(targetDir, outputName), palette);
      console.log(`[shell-family] ${tier}: ${outputName}`);
    }
  }
}

main().catch((error) => {
  console.error('[shell-family] failed', error);
  process.exit(1);
});