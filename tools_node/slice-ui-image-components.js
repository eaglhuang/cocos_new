#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

let puppeteer;
try {
    puppeteer = require('puppeteer-core');
} catch (error) {
    console.error('缺少依賴 puppeteer-core');
    process.exit(1);
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function printUsage() {
    console.log([
        'Usage:',
        '  node tools_node/slice-ui-image-components.js --input <image-or-dir> --out-dir <dir>',
        '',
        'Options:',
        '  --input <path>            Source image or directory',
        '  --out-dir <dir>           Output root directory',
        '  --name-prefix <text>      Directory mode: only process files with this prefix',
        '  --recursive               Directory mode: recurse into subdirectories',
        '  --pad <number>            Padding around each exported component, default: 4',
        '  --min-area-ratio <num>    Minimum connected-component area ratio, default: 0.0003',
        '  --max-area-ratio <num>    Maximum connected-component area ratio, default: 0.35',
        '  --color-threshold <num>   Foreground/background color distance threshold, default: 30',
        '  --alpha-floor <num>       Minimum alpha to count as foreground, default: 12',
        '  --max-components <num>    Maximum exported components per image, default: 120',
        '  --min-width-ratio <num>   Minimum bbox width ratio, default: 0.01',
        '  --min-height-ratio <num>  Minimum bbox height ratio, default: 0.01',
        '  --merge-gap <num>          Proximity merge gap in pixels; components whose bboxes are within this many pixels are merged into one logical bbox. 0 = disabled. Default: auto (~4% of min image dim)',
        '  --temp-dir-name <name>    Root folder for unselected provisional slices, default: temp',
        '  --selected-dir-name <name>Root folder reserved for future promoted picks, default: selected',
    ].join('\n'));
}

function parseArgs(argv) {
    const args = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith('--')) {
            continue;
        }
        const key = token.slice(2);
        const value = argv[index + 1];
        if (!value || value.startsWith('--')) {
            args[key] = true;
            continue;
        }
        args[key] = value;
        index += 1;
    }
    return args;
}

function resolveBrowser() {
    const candidates = [
        'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return '';
}

function toDataUrl(inputPath) {
    const ext = path.extname(inputPath).toLowerCase();
    const mime = ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.webp'
            ? 'image/webp'
            : 'image/png';
    return `data:${mime};base64,${fs.readFileSync(inputPath).toString('base64')}`;
}

function clampRect(rect, sourceSize) {
    const x = Math.max(0, Math.min(sourceSize.width - 1, rect.x));
    const y = Math.max(0, Math.min(sourceSize.height - 1, rect.y));
    const maxWidth = sourceSize.width - x;
    const maxHeight = sourceSize.height - y;
    return {
        x,
        y,
        width: Math.max(1, Math.min(maxWidth, rect.width)),
        height: Math.max(1, Math.min(maxHeight, rect.height)),
    };
}

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function scoreByRange(value, min, max, ideal) {
    if (value < min || value > max) {
        return 0;
    }
    if (ideal <= min || ideal >= max) {
        return 1;
    }
    if (value === ideal) {
        return 1;
    }
    if (value < ideal) {
        return clamp01((value - min) / (ideal - min));
    }
    return clamp01((max - value) / (max - ideal));
}

function computeClassScores(component, sourceSize) {
    const widthRatio = component.widthRatio;
    const heightRatio = component.heightRatio;
    const areaRatio = component.areaRatio;
    const aspect = component.bbox.width / Math.max(1, component.bbox.height);
    const solidity = component.solidity;
    const centerXRatio = component.centerX / sourceSize.width;
    const centerYRatio = component.centerY / sourceSize.height;
    const nearHorizontalEdge = centerXRatio <= 0.18 || centerXRatio >= 0.82 ? 1 : 0;
    const nearTop = centerYRatio <= 0.22 ? 1 : 0;
    const nearBottom = centerYRatio >= 0.78 ? 1 : 0;
    const edgeBias = nearHorizontalEdge || nearTop || nearBottom ? 1 : 0;
    const tightlyCroppedStrip = heightRatio >= 0.72 ? 1 : 0;
    const centeredWideStrip = tightlyCroppedStrip && centerXRatio >= 0.24 && centerXRatio <= 0.76 && widthRatio >= 0.24 && widthRatio <= 0.8 ? 1 : 0;
    const edgeCapLike = tightlyCroppedStrip && nearHorizontalEdge && widthRatio >= 0.08 && widthRatio <= 0.28 && aspect >= 0.35 && aspect <= 1.3 ? 1 : 0;

    const panelScore = clamp01(
        (scoreByRange(widthRatio, 0.14, 0.9, 0.42) * 0.35) +
        (scoreByRange(heightRatio, 0.05, 0.7, 0.22) * 0.25) +
        (scoreByRange(areaRatio, 0.006, 0.25, 0.06) * 0.2) +
        (scoreByRange(solidity, 0.35, 1.0, 0.88) * 0.2) +
        (centeredWideStrip * 0.32)
    );

    const capScore = clamp01(
        (scoreByRange(widthRatio, 0.02, 0.22, 0.065) * 0.18) +
        (scoreByRange(heightRatio, 0.03, 0.22, 0.1) * 0.18) +
        (scoreByRange(aspect, 0.18, 1.35, 0.45) * 0.16) +
        (scoreByRange(solidity, 0.5, 1.0, 0.9) * 0.12) +
        (nearHorizontalEdge * 0.22) +
        ((nearTop || nearBottom) * 0.14) +
        (edgeCapLike * 0.26)
    );

    const badgeScore = clamp01(
        (scoreByRange(widthRatio, 0.025, 0.2, 0.085) * 0.2) +
        (scoreByRange(heightRatio, 0.025, 0.18, 0.075) * 0.2) +
        (scoreByRange(areaRatio, 0.0008, 0.04, 0.005) * 0.2) +
        (scoreByRange(aspect, 0.45, 2.2, 1.05) * 0.2) +
        (scoreByRange(solidity, 0.45, 1.0, 0.85) * 0.15) +
        (edgeBias * 0.05)
    );

    const glyphScore = clamp01(
        (scoreByRange(widthRatio, 0.008, 0.12, 0.03) * 0.22) +
        (scoreByRange(heightRatio, 0.008, 0.12, 0.03) * 0.22) +
        (scoreByRange(areaRatio, 0.0001, 0.008, 0.0012) * 0.24) +
        (scoreByRange(aspect, 0.18, 4.0, 1.0) * 0.12) +
        (scoreByRange(solidity, 0.15, 1.0, 0.65) * 0.12) +
        ((1 - clamp01(panelScore)) * 0.08)
    );

    const noiseScore = clamp01(
        1 - Math.max(panelScore, capScore, badgeScore, glyphScore)
    );

    return {
        panel: panelScore,
        cap: capScore,
        badge: badgeScore,
        glyph: glyphScore,
        noise: noiseScore,
    };
}

function classifyComponent(component, sourceSize) {
    const scores = computeClassScores(component, sourceSize);
    const entries = Object.entries(scores).sort((left, right) => right[1] - left[1]);
    const [kind, score] = entries[0];
    const threshold = {
        panel: 0.46,
        cap: 0.48,
        badge: 0.45,
        glyph: 0.42,
        noise: 0,
    }[kind] ?? 0.5;

    return {
        kind: score >= threshold ? kind : 'noise',
        confidence: score,
        scores,
    };
}

function boxesOverlap(left, right) {
    const leftRight = left.x + left.width;
    const rightRight = right.x + right.width;
    const leftBottom = left.y + left.height;
    const rightBottom = right.y + right.height;
    return left.x < rightRight && leftRight > right.x && left.y < rightBottom && leftBottom > right.y;
}

function iou(left, right) {
    if (!boxesOverlap(left, right)) {
        return 0;
    }
    const intersectionLeft = Math.max(left.x, right.x);
    const intersectionTop = Math.max(left.y, right.y);
    const intersectionRight = Math.min(left.x + left.width, right.x + right.width);
    const intersectionBottom = Math.min(left.y + left.height, right.y + right.height);
    const intersectionArea = Math.max(0, intersectionRight - intersectionLeft) * Math.max(0, intersectionBottom - intersectionTop);
    const unionArea = (left.width * left.height) + (right.width * right.height) - intersectionArea;
    return unionArea > 0 ? intersectionArea / unionArea : 0;
}

function pickSelectedCandidates(exported) {
    const limits = { panel: 3, cap: 4, badge: 6, glyph: 8 };
    const thresholds = { panel: 0.52, cap: 0.55, badge: 0.5, glyph: 0.48 };
    const picks = { panel: [], cap: [], badge: [], glyph: [] };

    for (const kind of Object.keys(picks)) {
        const ranked = exported
            .filter((item) => item.classification.kind === kind && item.classification.confidence >= thresholds[kind])
            .sort((left, right) => right.classification.confidence - left.classification.confidence);

        for (const candidate of ranked) {
            const overlapsExisting = picks[kind].some((picked) => iou(picked.padded, candidate.padded) > 0.55);
            if (overlapsExisting) {
                continue;
            }
            picks[kind].push(candidate);
            if (picks[kind].length >= limits[kind]) {
                break;
            }
        }
    }

    return picks;
}

function collectInputFiles(inputPath, recursive, namePrefix) {
    const stat = fs.statSync(inputPath);
    if (stat.isFile()) {
        return [inputPath];
    }

    const files = [];
    const walk = (dirPath) => {
        for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                if (recursive) {
                    walk(fullPath);
                }
                continue;
            }
            const ext = path.extname(entry.name).toLowerCase();
            if (!IMAGE_EXTENSIONS.has(ext)) {
                continue;
            }
            if (namePrefix && !entry.name.startsWith(namePrefix)) {
                continue;
            }
            files.push(fullPath);
        }
    };

    walk(inputPath);
    files.sort();
    return files;
}

async function analyzeComponents(browser, dataUrl, options) {
    const page = await browser.newPage();
    try {
        return await page.evaluate(async ({ src, options: scanOptions }) => {
            const image = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('image load failed'));
                img.src = src;
            });

            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            context.drawImage(image, 0, 0);

            const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
            const totalArea = width * height;
            const sampleSpan = Math.max(4, Math.min(12, Math.floor(Math.min(width, height) * 0.02)));
            const corners = [
                { x: 0, y: 0 },
                { x: width - sampleSpan, y: 0 },
                { x: 0, y: height - sampleSpan },
                { x: width - sampleSpan, y: height - sampleSpan },
            ];

            const cornerSamples = corners.map((corner) => {
                let r = 0;
                let g = 0;
                let b = 0;
                let a = 0;
                let count = 0;
                for (let y = corner.y; y < corner.y + sampleSpan; y += 1) {
                    for (let x = corner.x; x < corner.x + sampleSpan; x += 1) {
                        const index = (y * width + x) * 4;
                        r += data[index];
                        g += data[index + 1];
                        b += data[index + 2];
                        a += data[index + 3];
                        count += 1;
                    }
                }
                return { r: r / count, g: g / count, b: b / count, a: a / count };
            });

            const background = cornerSamples.reduce((accumulator, sample) => ({
                r: accumulator.r + sample.r,
                g: accumulator.g + sample.g,
                b: accumulator.b + sample.b,
                a: accumulator.a + sample.a,
            }), { r: 0, g: 0, b: 0, a: 0 });
            background.r /= cornerSamples.length;
            background.g /= cornerSamples.length;
            background.b /= cornerSamples.length;
            background.a /= cornerSamples.length;

            const colorThreshold = Number.isFinite(scanOptions.colorThreshold) ? scanOptions.colorThreshold : 30;
            const alphaFloor = Number.isFinite(scanOptions.alphaFloor) ? scanOptions.alphaFloor : 12;
            const minArea = totalArea * (Number.isFinite(scanOptions.minAreaRatio) ? scanOptions.minAreaRatio : 0.0003);
            const maxArea = totalArea * (Number.isFinite(scanOptions.maxAreaRatio) ? scanOptions.maxAreaRatio : 0.35);
            const minWidthRatio = Number.isFinite(scanOptions.minWidthRatio) ? scanOptions.minWidthRatio : 0.01;
            const minHeightRatio = Number.isFinite(scanOptions.minHeightRatio) ? scanOptions.minHeightRatio : 0.01;

            const mask = new Uint8Array(totalArea);
            for (let index = 0; index < totalArea; index += 1) {
                const pixelIndex = index * 4;
                const alpha = data[pixelIndex + 3];
                const dr = data[pixelIndex] - background.r;
                const dg = data[pixelIndex + 1] - background.g;
                const db = data[pixelIndex + 2] - background.b;
                const distance = Math.sqrt((dr * dr) + (dg * dg) + (db * db));
                if (alpha > alphaFloor && distance >= colorThreshold) {
                    mask[index] = 1;
                }
            }

            const visited = new Uint8Array(totalArea);
            const stack = [];
            const components = [];

            for (let startIndex = 0; startIndex < totalArea; startIndex += 1) {
                if (!mask[startIndex] || visited[startIndex]) {
                    continue;
                }

                let minX = width;
                let minY = height;
                let maxX = 0;
                let maxY = 0;
                let area = 0;

                stack.push(startIndex);
                visited[startIndex] = 1;

                while (stack.length > 0) {
                    const current = stack.pop();
                    const x = current % width;
                    const y = (current - x) / width;
                    area += 1;
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;

                    const neighbors = [current - 1, current + 1, current - width, current + width];
                    for (const next of neighbors) {
                        if (next < 0 || next >= totalArea || visited[next] || !mask[next]) {
                            continue;
                        }
                        const nextX = next % width;
                        if (Math.abs(nextX - x) > 1) {
                            continue;
                        }
                        visited[next] = 1;
                        stack.push(next);
                    }
                }

                const bboxWidth = maxX - minX + 1;
                const bboxHeight = maxY - minY + 1;
                const bboxArea = bboxWidth * bboxHeight;
                const solidity = area / bboxArea;
                const widthRatio = bboxWidth / width;
                const heightRatio = bboxHeight / height;
                const areaRatio = area / totalArea;

                const dynamicMaxArea = (heightRatio >= 0.72 && widthRatio >= 0.22 && widthRatio <= 0.8)
                    ? Math.max(maxArea, totalArea * 0.58)
                    : maxArea;

                if (area < minArea || area > dynamicMaxArea) {
                    continue;
                }
                if (widthRatio < minWidthRatio || heightRatio < minHeightRatio) {
                    continue;
                }

                components.push({
                    bbox: { x: minX, y: minY, width: bboxWidth, height: bboxHeight },
                    area,
                    areaRatio,
                    widthRatio,
                    heightRatio,
                    solidity,
                    centerX: minX + (bboxWidth / 2),
                    centerY: minY + (bboxHeight / 2),
                });
            }

            // Proximity merge: bbox pairs whose gap is within mergeGap pixels are merged
            // into a single logical bounding box. Handles icons whose sub-parts have small
            // background gaps (e.g. bottle + leaf in one medic icon).
            const defaultMergeGap = Math.round(Math.min(width, height) * 0.04);
            const mergeGap = (Number.isFinite(scanOptions.mergeGap) && scanOptions.mergeGap >= 0)
                ? scanOptions.mergeGap
                : defaultMergeGap;
            if (mergeGap > 0) {
                let anyMerged = true;
                while (anyMerged) {
                    anyMerged = false;
                    outer: for (let mi = 0; mi < components.length; mi++) {
                        for (let mj = mi + 1; mj < components.length; mj++) {
                            const ma = components[mi];
                            const mb = components[mj];
                            const gapX = Math.max(0, Math.max(ma.bbox.x, mb.bbox.x) - Math.min(ma.bbox.x + ma.bbox.width, mb.bbox.x + mb.bbox.width));
                            const gapY = Math.max(0, Math.max(ma.bbox.y, mb.bbox.y) - Math.min(ma.bbox.y + ma.bbox.height, mb.bbox.y + mb.bbox.height));
                            if (gapX <= mergeGap && gapY <= mergeGap) {
                                const newMinX = Math.min(ma.bbox.x, mb.bbox.x);
                                const newMinY = Math.min(ma.bbox.y, mb.bbox.y);
                                const newMaxX = Math.max(ma.bbox.x + ma.bbox.width, mb.bbox.x + mb.bbox.width);
                                const newMaxY = Math.max(ma.bbox.y + ma.bbox.height, mb.bbox.y + mb.bbox.height);
                                const newBboxW = newMaxX - newMinX;
                                const newBboxH = newMaxY - newMinY;
                                const newArea = ma.area + mb.area;
                                components[mi] = {
                                    bbox: { x: newMinX, y: newMinY, width: newBboxW, height: newBboxH },
                                    area: newArea,
                                    areaRatio: newArea / totalArea,
                                    widthRatio: newBboxW / width,
                                    heightRatio: newBboxH / height,
                                    solidity: newArea / (newBboxW * newBboxH),
                                    centerX: newMinX + newBboxW / 2,
                                    centerY: newMinY + newBboxH / 2,
                                };
                                components.splice(mj, 1);
                                anyMerged = true;
                                break outer;
                            }
                        }
                    }
                }
            }

            components.sort((left, right) => {
                if (left.bbox.y !== right.bbox.y) {
                    return left.bbox.y - right.bbox.y;
                }
                return left.bbox.x - right.bbox.x;
            });

            return {
                imageSize: { width, height },
                background,
                componentCount: components.length,
                components,
            };
        }, { src: dataUrl, options });
    } finally {
        await page.close();
    }
}

async function cropRect(browser, dataUrl, rect, outPath) {
    const page = await browser.newPage();
    try {
        await page.setViewport({ width: rect.width, height: rect.height });
        await page.setContent(`<html><body style="margin:0;background:transparent;overflow:hidden;"><div style="width:${rect.width}px;height:${rect.height}px;background-image:url('${dataUrl}');background-position:-${rect.x}px -${rect.y}px;background-repeat:no-repeat;background-size:auto;"></div></body></html>`);
        await page.screenshot({ path: outPath, omitBackground: true });
    } finally {
        await page.close();
    }
}

async function sliceOne(browser, inputPath, outDir, selectedDir, options) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.mkdirSync(selectedDir, { recursive: true });
    const dataUrl = toDataUrl(inputPath);
    const analysis = await analyzeComponents(browser, dataUrl, options);
    const sourceSize = analysis.imageSize;
    const pad = Number.isFinite(options.pad) ? options.pad : 4;
    const maxComponents = Number.isFinite(options.maxComponents) ? options.maxComponents : 120;
    const components = analysis.components.slice(0, maxComponents);
    const exported = [];
    const tempDir = path.join(outDir, 'components');
    fs.mkdirSync(tempDir, { recursive: true });

    for (let index = 0; index < components.length; index += 1) {
        const component = components[index];
        const padded = clampRect({
            x: component.bbox.x - pad,
            y: component.bbox.y - pad,
            width: component.bbox.width + (pad * 2),
            height: component.bbox.height + (pad * 2),
        }, sourceSize);
        const output = path.join(tempDir, `component_${String(index + 1).padStart(3, '0')}.png`);
        await cropRect(browser, dataUrl, padded, output);
        const classification = classifyComponent(component, sourceSize);
        exported.push({
            index: index + 1,
            bbox: component.bbox,
            padded,
            area: component.area,
            areaRatio: component.areaRatio,
            widthRatio: component.widthRatio,
            heightRatio: component.heightRatio,
            solidity: component.solidity,
            classification,
            output,
        });
    }

    const picks = pickSelectedCandidates(exported);
    const picked = [];
    for (const [kind, items] of Object.entries(picks)) {
        if (!items.length) {
            continue;
        }
        const classDir = path.join(selectedDir, kind);
        fs.mkdirSync(classDir, { recursive: true });
        for (const item of items) {
            const targetPath = path.join(classDir, path.basename(item.output));
            fs.copyFileSync(item.output, targetPath);
            picked.push({
                index: item.index,
                kind,
                confidence: item.classification.confidence,
                source: item.output,
                target: targetPath,
            });
        }
    }

    const countsByKind = exported.reduce((accumulator, item) => {
        const kind = item.classification.kind;
        accumulator[kind] = (accumulator[kind] || 0) + 1;
        return accumulator;
    }, {});

    return {
        input: inputPath,
        outDir,
        tempDir,
        selectedDir,
        sourceSize,
        background: analysis.background,
        componentCount: analysis.componentCount,
        exportedCount: exported.length,
        countsByKind,
        picked,
        exported,
    };
}

function summarizeReport(report) {
    return {
        input: report.input,
        outDir: report.outDir,
        tempDir: report.tempDir,
        selectedDir: report.selectedDir,
        sourceSize: report.sourceSize,
        componentCount: report.componentCount,
        exportedCount: report.exportedCount,
        countsByKind: report.countsByKind,
        pickedCount: report.picked.length,
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.input || !args['out-dir']) {
        printUsage();
        process.exit(args.help ? 0 : 1);
    }

    const inputPath = path.resolve(args.input);
    if (!fs.existsSync(inputPath)) {
        throw new Error(`找不到輸入路徑: ${inputPath}`);
    }

    const browserPath = resolveBrowser();
    if (!browserPath) {
        throw new Error('找不到可用瀏覽器');
    }

    const options = {
        pad: Number(args.pad || 4),
        minAreaRatio: Number(args['min-area-ratio'] || 0.0003),
        maxAreaRatio: Number(args['max-area-ratio'] || 0.35),
        colorThreshold: Number(args['color-threshold'] || 30),
        alphaFloor: Number(args['alpha-floor'] || 12),
        maxComponents: Number(args['max-components'] || 120),
        minWidthRatio: Number(args['min-width-ratio'] || 0.01),
        minHeightRatio: Number(args['min-height-ratio'] || 0.01),
        mergeGap: args['merge-gap'] !== undefined ? Number(args['merge-gap']) : -1,
        tempDirName: args['temp-dir-name'] || 'temp',
        selectedDirName: args['selected-dir-name'] || 'selected',
    };

    const outDir = path.resolve(args['out-dir']);
    fs.mkdirSync(outDir, { recursive: true });

    const browser = await puppeteer.launch({ executablePath: browserPath, headless: true });
    try {
        const files = collectInputFiles(inputPath, Boolean(args.recursive), args['name-prefix']);
        const results = [];
        const tempRoot = path.join(outDir, options.tempDirName);
        const selectedRoot = path.join(outDir, options.selectedDirName);
        fs.mkdirSync(tempRoot, { recursive: true });
        fs.mkdirSync(selectedRoot, { recursive: true });
        const summary = {
            input: inputPath,
            outDir,
            tempRoot,
            selectedRoot,
            scanned: files.length,
            options,
            completed: 0,
            results: [],
        };
        const summaryPath = path.join(outDir, 'slice-components-report.json');
        for (const file of files) {
            const itemStem = path.parse(file).name;
            const itemTempDir = path.join(tempRoot, itemStem);
            const itemSelectedDir = path.join(selectedRoot, itemStem);
            fs.mkdirSync(itemSelectedDir, { recursive: true });
            const report = await sliceOne(browser, file, itemTempDir, itemSelectedDir, options);
            results.push(report);
            const itemReportPath = path.join(itemTempDir, 'slice-components-item-report.json');
            fs.writeFileSync(itemReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
            summary.completed = results.length;
            summary.results = results.map(summarizeReport);
            fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
            console.log(`✓ ${path.basename(file)} -> temp ${report.exportedCount}/${report.componentCount}`);
        }
        console.log(`✓ summary -> ${summaryPath}`);
        console.log(`✓ cleanup root -> ${tempRoot}`);
    } finally {
        await browser.close();
    }
}

main().catch((error) => {
    console.error(`[slice-ui-image-components] ${error.message}`);
    process.exit(1);
});