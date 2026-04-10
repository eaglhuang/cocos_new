#!/usr/bin/env node
/**
 * remove-bg-flood-fill.js
 *
 * Background removal via corner-seeded BFS flood fill + optional checkerboard detection.
 * Same algorithm used by ImageMagick -trim / GIMP Magic Eraser.
 *
 * Supports PNG (pngjs) and JPEG (jpeg-js) inputs. Always outputs PNG.
 *
 * Usage:
 *   node tools_node/remove-bg-flood-fill.js --input <png|jpg|jpeg> --output <png>
 *     [--color-threshold 28]   Max color distance to background (default: 28)
 *     [--alpha-floor 12]       Pixels with alpha <= this are always BG (default: 12)
 *     [--pad 4]                Padding around cropped content (default: 4)
 *     [--no-crop]              Skip bounding-box crop, keep original canvas size
 *     [--fill-enclosed]        After edge-BFS, also remove enclosed bg islands
 *                              (pixels inside title frames that edge-BFS can't reach)
 *     [--report]               Print JSON stats to stdout
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

// ---------------------------------------------------------------------------
// Image I/O helpers (PNG + JPEG)
// ---------------------------------------------------------------------------
function readImageAsRaw(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.png') {
        const src = PNG.sync.read(fs.readFileSync(filePath));
        return { width: src.width, height: src.height, data: Buffer.from(src.data), hasAlpha: true };
    }
    if (ext === '.jpg' || ext === '.jpeg') {
        const jpeg = require('jpeg-js');
        const raw = jpeg.decode(fs.readFileSync(filePath), { useTArray: true, formatAsRGBA: true });
        return { width: raw.width, height: raw.height, data: Buffer.from(raw.data), hasAlpha: false };
    }
    throw new Error(`Unsupported image format: ${ext}`);
}

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
    const opts = {
        colorThreshold: 28,
        alphaFloor: 12,
        pad: 4,
        crop: true,
        fillEnclosed: false,
        bgColorOverride: null, // explicit [R,G,B] from --bg-color
        report: false,
    };
    for (let i = 0; i < argv.length; i++) {
        const t = argv[i];
        const n = argv[i + 1];
        switch (t) {
            case '--input':          opts.input  = n; i++; break;
            case '--output':         opts.output = n; i++; break;
            case '--color-threshold': opts.colorThreshold = Number(n); i++; break;
            case '--alpha-floor':    opts.alphaFloor = Number(n); i++; break;
            case '--pad':            opts.pad = Number(n); i++; break;
            case '--no-crop':        opts.crop = false; break;
            case '--fill-enclosed':  opts.fillEnclosed = true; break;
            case '--bg-color': {
                const parts = n.split(',').map(Number);
                if (parts.length === 3) opts.bgColorOverride = parts;
                i++; break;
            }
            case '--report':         opts.report = true; break;
            default: break;
        }
    }
    return opts;
}

function printUsage() {
    console.error([
        'Usage:',
        '  node tools_node/remove-bg-flood-fill.js --input <png> --output <png>',
        'Options:',
        '  --color-threshold <n>  Max color distance to BG (default: 28)',
        '  --alpha-floor <n>      Alpha <= this treated as BG (default: 12)',
        '  --pad <n>              Padding around crop (default: 4)',
        '  --no-crop              Disable bounding-box crop',
        '  --fill-enclosed        Also remove bg islands enclosed inside title frames',
        '  --bg-color R,G,B       Override bg color detection (e.g. 232,236,236);',
        '                         enables fill-enclosed even when edges are transparent',
        '  --report               Print JSON stats',
    ].join('\n'));
}

// ---------------------------------------------------------------------------
// Core: pngjs flood-fill background removal
// ---------------------------------------------------------------------------
function removeBackground(inputPath, opts) {
    const { width, height, data } = readImageAsRaw(inputPath);

    const threshold  = opts.colorThreshold;
    const alphaFloor = opts.alphaFloor;

    // ------------------------------------------------------------------
    // Step 1: Determine BG color(s).
    //   - If --bg-color R,G,B was given, use it directly.
    //   - Otherwise sample edge pixels (skipping already-transparent ones).
    // ------------------------------------------------------------------
    let bgColors;
    let checkerboard = false;
    let maxSpread    = 0;

    if (opts.bgColorOverride) {
        const [or, og, ob] = opts.bgColorOverride;
        bgColors = [{ r: or, g: og, b: ob }];
    } else {
        const edgeSamples = [];
        const addSample = (x, y) => {
            if (x < 0 || y < 0 || x >= width || y >= height) return;
            const i = (y * width + x) * 4;
            if (data[i + 3] <= alphaFloor) return; // skip already-transparent
            edgeSamples.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
        };

        const step = Math.max(1, Math.floor(Math.min(width, height) / 20));
        for (let x = 0; x < width; x += step) { addSample(x, 0); addSample(x, height - 1); }
        for (let y = 0; y < height; y += step) { addSample(0, y); addSample(width - 1, y); }

        if (edgeSamples.length === 0) {
            // All edges are already transparent — nothing to remove.
            // Count foreground properly so cropToBounds doesn't produce a 1×1 blank.
            let fc = 0;
            let minXe = width, minYe = height, maxXe = -1, maxYe = -1;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    if (data[(y * width + x) * 4 + 3] > alphaFloor) {
                        fc++;
                        if (x < minXe) minXe = x; if (x > maxXe) maxXe = x;
                        if (y < minYe) minYe = y; if (y > maxYe) maxYe = y;
                    }
                }
            }
            return { data, width, height, bgColors: [], checkerboard: false, foregroundCount: fc,
                     minX: minXe, minY: minYe, maxX: maxXe, maxY: maxYe };
        }

        const sum  = edgeSamples.reduce((a, s) => ({ r: a.r + s.r, g: a.g + s.g, b: a.b + s.b }), { r: 0, g: 0, b: 0 });
        const avgR = sum.r / edgeSamples.length;
        const avgG = sum.g / edgeSamples.length;
        const avgB = sum.b / edgeSamples.length;

        for (const s of edgeSamples) {
            const d = Math.sqrt((s.r - avgR) ** 2 + (s.g - avgG) ** 2 + (s.b - avgB) ** 2);
            if (d > maxSpread) maxSpread = d;
        }

        // ------------------------------------------------------------------
        // Step 2: Checkerboard detection
        // When spread > 40, try to split edge samples into two desaturated clusters.
        // ------------------------------------------------------------------
        if (maxSpread > 40) {
            const avgLum = (avgR + avgG + avgB) / 3;
            const light = edgeSamples.filter(s => (s.r + s.g + s.b) / 3 >= avgLum);
            const dark  = edgeSamples.filter(s => (s.r + s.g + s.b) / 3 <  avgLum);

            if (light.length >= 2 && dark.length >= 2) {
                const avg2 = (arr) => arr.reduce((a, s) => ({ r: a.r + s.r, g: a.g + s.g, b: a.b + s.b }), { r: 0, g: 0, b: 0 });
                const lSum = avg2(light); const lR = lSum.r / light.length; const lG = lSum.g / light.length; const lB = lSum.b / light.length;
                const dSum = avg2(dark);  const dR = dSum.r / dark.length;  const dG = dSum.g / dark.length;  const dB = dSum.b / dark.length;

                const lSat = Math.max(lR, lG, lB) - Math.min(lR, lG, lB);
                const dSat = Math.max(dR, dG, dB) - Math.min(dR, dG, dB);

                if (lSat < 30 && dSat < 30) {
                    bgColors = [
                        { r: lR, g: lG, b: lB },
                        { r: dR, g: dG, b: dB },
                    ];
                    checkerboard = true;
                }
            }
        }

        if (!bgColors) {
            bgColors = [{ r: avgR, g: avgG, b: avgB }];
        }
    }

    // ------------------------------------------------------------------
    // Step 3: BFS flood fill from all edge pixels
    // Classic ImageMagick/GIMP approach.
    // ------------------------------------------------------------------
    const colorDist = (r, g, b) => {
        let minDist = Infinity;
        for (const bg of bgColors) {
            const d = Math.sqrt((r - bg.r) ** 2 + (g - bg.g) ** 2 + (b - bg.b) ** 2);
            if (d < minDist) minDist = d;
        }
        return minDist;
    };

    const isBgPixel = (pixelOffset) => {
        const a = data[pixelOffset + 3];
        if (a <= alphaFloor) return true;
        return colorDist(data[pixelOffset], data[pixelOffset + 1], data[pixelOffset + 2]) < threshold;
    };

    const marked = new Uint8Array(width * height);
    const queue  = [];

    const enqueue = (x, y) => {
        if (x < 0 || y < 0 || x >= width || y >= height) return;
        const off = y * width + x;
        if (marked[off]) return;
        if (!isBgPixel(off * 4)) return;
        marked[off] = 1;
        queue.push(off);
    };

    // Seed from all four edges
    for (let x = 0; x < width; x++)             { enqueue(x, 0);          enqueue(x, height - 1); }
    for (let y = 1; y < height - 1; y++)         { enqueue(0, y);           enqueue(width - 1, y);  }

    // BFS (4-connected)
    let qi = 0;
    while (qi < queue.length) {
        const off = queue[qi++];
        const x = off % width;
        const y = (off - x) / width;
        enqueue(x + 1, y);
        enqueue(x - 1, y);
        enqueue(x, y + 1);
        enqueue(x, y - 1);
    }

    // ------------------------------------------------------------------
    // Step 3b (optional): Fill enclosed background islands.
    // After edge-BFS, any opaque pixel still matching bgColors is an
    // enclosed background region (inside a decorative frame) that the
    // edge flood could not reach. Mark those too.
    // ------------------------------------------------------------------
    if (opts.fillEnclosed && bgColors.length > 0) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const off = y * width + x;
                if (marked[off]) continue;
                const pi = off * 4;
                if (data[pi + 3] <= alphaFloor) continue; // already transparent
                if (colorDist(data[pi], data[pi + 1], data[pi + 2]) < threshold) {
                    marked[off] = 1;
                }
            }
        }
    }

    // ------------------------------------------------------------------
    // Step 4: Apply — set marked pixels to fully transparent
    // ------------------------------------------------------------------
    let foregroundCount = 0;
    let minX = width, minY = height, maxX = -1, maxY = -1;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const off = y * width + x;
            const pi  = off * 4;
            if (marked[off]) {
                data[pi + 3] = 0;
            } else if (data[pi + 3] > alphaFloor) {
                foregroundCount++;
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
    }

    return { data, width, height, bgColors, checkerboard, maxSpread, foregroundCount, minX, minY, maxX, maxY };
}

// ---------------------------------------------------------------------------
// Step 5: Compute percentile-robust bounding box
// Ignores sparse noise pixels that cause bounds to span the entire image.
// Uses 2nd/98th percentile of foreground x/y coordinates.
// ---------------------------------------------------------------------------
function robustBounds(data, width, height, alphaFloor) {
    const xs = [];
    const ys = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (data[(y * width + x) * 4 + 3] > alphaFloor) {
                xs.push(x);
                ys.push(y);
            }
        }
    }
    if (xs.length === 0) return { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1 };

    xs.sort((a, b) => a - b);
    ys.sort((a, b) => a - b);

    const p = (arr, pct) => arr[Math.max(0, Math.min(arr.length - 1, Math.floor(arr.length * pct / 100)))];

    return {
        minX: p(xs, 0.5),
        maxX: p(xs, 99.5),
        minY: p(ys, 0.5),
        maxY: p(ys, 99.5),
    };
}

// ---------------------------------------------------------------------------
// Step 6: Crop to bounding box (optional)
// ---------------------------------------------------------------------------
function cropToBounds(data, src, opts) {
    const { width, height, foregroundCount } = src;

    if (foregroundCount === 0) {
        // Blank image — return 1×1 transparent
        const out = new PNG({ width: 1, height: 1 });
        out.data.fill(0);
        return { png: out, cropX: 0, cropY: 0, cropW: 1, cropH: 1 };
    }

    // Use percentile-based robust bounds to ignore sparse JPEG noise at edges
    const { minX, minY, maxX, maxY } = robustBounds(data, width, height, opts.alphaFloor);

    const pad  = opts.crop ? (opts.pad || 0) : 0;
    const cropX = Math.max(0, minX - pad);
    const cropY = Math.max(0, minY - pad);
    const cropW = Math.min(width  - cropX, maxX - cropX + 1 + pad);
    const cropH = Math.min(height - cropY, maxY - cropY + 1 + pad);

    const outW = opts.crop ? cropW : width;
    const outH = opts.crop ? cropH : height;
    const offX = opts.crop ? cropX : 0;
    const offY = opts.crop ? cropY : 0;

    const out = new PNG({ width: outW, height: outH });
    for (let y = 0; y < outH; y++) {
        for (let x = 0; x < outW; x++) {
            const si = ((offY + y) * width + (offX + x)) * 4;
            const di = (y * outW + x) * 4;
            out.data[di]     = data[si];
            out.data[di + 1] = data[si + 1];
            out.data[di + 2] = data[si + 2];
            out.data[di + 3] = data[si + 3];
        }
    }

    return { png: out, cropX: offX, cropY: offY, cropW: outW, cropH: outH };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function main() {
    const opts = parseArgs(process.argv.slice(2));

    if (!opts.input || !opts.output) {
        printUsage();
        process.exit(1);
    }

    const inputPath  = path.resolve(opts.input);
    const outputPath = path.resolve(opts.output);

    if (!fs.existsSync(inputPath)) {
        console.error(`[remove-bg-flood-fill] 找不到輸入檔: ${inputPath}`);
        process.exit(1);
    }

    const result = removeBackground(inputPath, opts);
    const { png: outPng, cropX, cropY, cropW, cropH } = cropToBounds(result.data, result, opts);

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, PNG.sync.write(outPng));

    console.log(`[remove-bg-flood-fill] ${outputPath}`);

    if (opts.report) {
        const stats = {
            input:  { width: result.width,  height: result.height },
            output: { width: cropW, height: cropH },
            crop:   { x: cropX, y: cropY },
            foregroundCount: result.foregroundCount,
            checkerboard:    result.checkerboard,
            backgroundSpread: result.maxSpread ? Number(result.maxSpread.toFixed(1)) : 0,
            bgColors: result.bgColors.map(c => ({
                r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b),
            })),
        };
        console.log(JSON.stringify(stats, null, 2));
    }
}

main();
