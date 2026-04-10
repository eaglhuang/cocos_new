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

const PRESETS = {
    'v3-parts-flat': {
        baseWidth: 1000,
        baseHeight: 1000,
        left: { x: 40, y: 100, width: 60, height: 100 },
        right: { x: 900, y: 100, width: 60, height: 100 },
    },
};

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function printUsage() {
    console.log([
        'Usage:',
        '  node tools_node/crop-general-detail-header-caps.js --input <image> [--out-dir <dir>] [--preset v3-parts-flat]',
        '  node tools_node/crop-general-detail-header-caps.js --input <image> --left-rect x,y,w,h --right-rect x,y,w,h --base-width <w> --base-height <h>',
        '  node tools_node/crop-general-detail-header-caps.js --input <image-or-dir> --auto-detect [--out-dir <dir>] [--name-prefix UI_]',
        '',
        'Options:',
        '  --input <path>          Source image path or directory path',
        '  --out-dir <dir>         Output directory, default: sibling folder crop-output',
        '  --preset <name>         Built-in rect preset, currently: v3-parts-flat',
        '  --base-width <number>   Reference design width for proportional scaling',
        '  --base-height <number>  Reference design height for proportional scaling',
        '  --left-rect x,y,w,h     Left cap crop rectangle in reference design coordinates',
        '  --right-rect x,y,w,h    Right cap crop rectangle in reference design coordinates',
        '  --left-name <name>      Output file name for left cap, default: header_cap_left.png',
        '  --right-name <name>     Output file name for right cap, default: header_cap_right.png',
        '  --auto-detect           Analyze image content and locate cap-like regions automatically',
        '  --recursive             Recurse into subdirectories when input is a directory',
        '  --name-prefix <text>    Only scan files with this prefix in directory mode',
        '  --auto-pad <number>     Padding added around auto-detected crop boxes, default: 4',
        '  --min-sides <1|2>       Minimum detected sides required to emit crops in auto mode, default: 1',
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

function parseRect(raw, label) {
    if (!raw) {
        return null;
    }
    const parts = raw.split(',').map((value) => Number(value.trim()));
    if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) {
        throw new Error(`${label} 必須是 x,y,w,h`);
    }
    return {
        x: parts[0],
        y: parts[1],
        width: parts[2],
        height: parts[3],
    };
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

async function getImageSize(browser, dataUrl) {
    const page = await browser.newPage();
    try {
        await page.setContent(`<img id="src" src="${dataUrl}" />`);
        return await page.evaluate(async () => {
            const image = document.getElementById('src');
            if (!image) {
                throw new Error('image not found');
            }
            if (!image.complete) {
                await new Promise((resolve, reject) => {
                    image.addEventListener('load', resolve, { once: true });
                    image.addEventListener('error', () => reject(new Error('image load failed')), { once: true });
                });
            }
            return { width: image.naturalWidth, height: image.naturalHeight };
        });
    } finally {
        await page.close();
    }
}

async function analyzeCapCandidates(browser, dataUrl, options = {}) {
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

            const sampleSpan = Math.max(4, Math.min(12, Math.floor(Math.min(width, height) * 0.02)));
            const samples = [];
            const corners = [
                { startX: 0, startY: 0 },
                { startX: width - sampleSpan, startY: 0 },
                { startX: 0, startY: height - sampleSpan },
                { startX: width - sampleSpan, startY: height - sampleSpan },
            ];

            for (const corner of corners) {
                let r = 0;
                let g = 0;
                let b = 0;
                let a = 0;
                let count = 0;
                for (let y = corner.startY; y < corner.startY + sampleSpan; y += 1) {
                    for (let x = corner.startX; x < corner.startX + sampleSpan; x += 1) {
                        const index = (y * width + x) * 4;
                        r += data[index];
                        g += data[index + 1];
                        b += data[index + 2];
                        a += data[index + 3];
                        count += 1;
                    }
                }
                samples.push({ r: r / count, g: g / count, b: b / count, a: a / count });
            }

            const background = samples.reduce((accumulator, sample) => ({
                r: accumulator.r + sample.r,
                g: accumulator.g + sample.g,
                b: accumulator.b + sample.b,
                a: accumulator.a + sample.a,
            }), { r: 0, g: 0, b: 0, a: 0 });
            background.r /= samples.length;
            background.g /= samples.length;
            background.b /= samples.length;
            background.a /= samples.length;

            const colorThreshold = Number.isFinite(scanOptions.colorThreshold) ? scanOptions.colorThreshold : 34;
            const alphaFloor = Number.isFinite(scanOptions.alphaFloor) ? scanOptions.alphaFloor : 24;
            const minAreaRatio = Number.isFinite(scanOptions.minAreaRatio) ? scanOptions.minAreaRatio : 0.001;
            const maxAreaRatio = Number.isFinite(scanOptions.maxAreaRatio) ? scanOptions.maxAreaRatio : 0.12;
            const topFraction = Number.isFinite(scanOptions.topFraction) ? scanOptions.topFraction : 0.52;

            const mask = new Uint8Array(width * height);
            for (let index = 0; index < width * height; index += 1) {
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

            const visited = new Uint8Array(width * height);
            const components = [];
            const stack = [];
            const totalArea = width * height;
            const minArea = totalArea * minAreaRatio;
            const maxArea = totalArea * maxAreaRatio;

            for (let startIndex = 0; startIndex < width * height; startIndex += 1) {
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
                        if (next < 0 || next >= width * height || visited[next] || !mask[next]) {
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
                const centerX = minX + (bboxWidth / 2);
                const centerY = minY + (bboxHeight / 2);
                const widthRatio = bboxWidth / width;
                const heightRatio = bboxHeight / height;
                const areaRatio = area / totalArea;
                const aspect = bboxWidth / bboxHeight;
                const solidity = area / bboxArea;

                if (area < minArea || area > maxArea) {
                    continue;
                }
                if (minY > height * topFraction) {
                    continue;
                }
                if (widthRatio < 0.015 || widthRatio > 0.2) {
                    continue;
                }
                if (heightRatio < 0.04 || heightRatio > 0.25) {
                    continue;
                }
                if (aspect < 0.2 || aspect > 1.6) {
                    continue;
                }
                if (solidity < 0.18) {
                    continue;
                }

                const leftEdgeScore = Math.max(0, 1 - (centerX / (width * 0.4)));
                const rightEdgeScore = Math.max(0, 1 - ((width - centerX) / (width * 0.4)));
                const topScore = Math.max(0, 1 - (centerY / (height * 0.45)));
                const widthScore = 1 - Math.min(1, Math.abs(widthRatio - 0.06) / 0.06);
                const heightScore = 1 - Math.min(1, Math.abs(heightRatio - 0.1) / 0.08);
                const aspectScore = 1 - Math.min(1, Math.abs(aspect - 0.6) / 0.8);
                const baseScore = (topScore * 0.25) + (widthScore * 0.2) + (heightScore * 0.2) + (aspectScore * 0.15) + (solidity * 0.2);

                components.push({
                    bbox: { x: minX, y: minY, width: bboxWidth, height: bboxHeight },
                    area,
                    areaRatio,
                    widthRatio,
                    heightRatio,
                    aspect,
                    solidity,
                    centerX,
                    centerY,
                    leftScore: baseScore + (leftEdgeScore * 0.35),
                    rightScore: baseScore + (rightEdgeScore * 0.35),
                });
            }

            const leftCandidates = components
                .filter((component) => component.centerX < width * 0.45)
                .sort((a, b) => b.leftScore - a.leftScore);
            const rightCandidates = components
                .filter((component) => component.centerX > width * 0.55)
                .sort((a, b) => b.rightScore - a.rightScore);

            return {
                imageSize: { width, height },
                background,
                candidateCount: components.length,
                candidates: components.slice(0, 24),
                bestLeft: leftCandidates[0] || null,
                bestRight: rightCandidates[0] || null,
            };
        }, {
            src: dataUrl,
            options,
        });
    } finally {
        await page.close();
    }
}

function scaleRect(rect, sourceSize, baseSize) {
    const scaleX = sourceSize.width / baseSize.width;
    const scaleY = sourceSize.height / baseSize.height;
    return {
        x: Math.round(rect.x * scaleX),
        y: Math.round(rect.y * scaleY),
        width: Math.round(rect.width * scaleX),
        height: Math.round(rect.height * scaleY),
    };
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

async function runManualCrop(browser, inputPath, outDir, args) {
    const preset = args.preset ? PRESETS[args.preset] : null;
    if (args.preset && !preset) {
        throw new Error(`未知 preset: ${args.preset}`);
    }

    const baseWidth = Number(args['base-width'] || (preset && preset.baseWidth));
    const baseHeight = Number(args['base-height'] || (preset && preset.baseHeight));
    const leftRect = parseRect(args['left-rect'], '--left-rect') || (preset && preset.left);
    const rightRect = parseRect(args['right-rect'], '--right-rect') || (preset && preset.right);

    if (!Number.isFinite(baseWidth) || !Number.isFinite(baseHeight) || baseWidth <= 0 || baseHeight <= 0) {
        throw new Error('必須提供有效的 --base-width / --base-height，或使用內建 preset');
    }
    if (!leftRect || !rightRect) {
        throw new Error('必須提供 left/right crop rect，或使用內建 preset');
    }

    const dataUrl = toDataUrl(inputPath);
    const sourceSize = await getImageSize(browser, dataUrl);
    const baseSize = { width: baseWidth, height: baseHeight };
    const resolvedLeft = clampRect(scaleRect(leftRect, sourceSize, baseSize), sourceSize);
    const resolvedRight = clampRect(scaleRect(rightRect, sourceSize, baseSize), sourceSize);
    const leftOut = path.join(outDir, args['left-name'] || 'header_cap_left.png');
    const rightOut = path.join(outDir, args['right-name'] || 'header_cap_right.png');

    await cropRect(browser, dataUrl, resolvedLeft, leftOut);
    await cropRect(browser, dataUrl, resolvedRight, rightOut);

    return {
        input: inputPath,
        outDir,
        sourceSize,
        baseSize,
        mode: 'manual',
        left: { requested: leftRect, resolved: resolvedLeft, output: leftOut },
        right: { requested: rightRect, resolved: resolvedRight, output: rightOut },
    };
}

async function runAutoCropForFile(browser, inputPath, outDir, args) {
    const dataUrl = toDataUrl(inputPath);
    const sourceSize = await getImageSize(browser, dataUrl);
    const autoPad = Number(args['auto-pad'] || 4);
    const minSides = Number(args['min-sides'] || 1);
    const analysis = await analyzeCapCandidates(browser, dataUrl, {
        colorThreshold: Number(args['color-threshold'] || 34),
        alphaFloor: Number(args['alpha-floor'] || 24),
        minAreaRatio: Number(args['min-area-ratio'] || 0.001),
        maxAreaRatio: Number(args['max-area-ratio'] || 0.12),
        topFraction: Number(args['top-fraction'] || 0.52),
    });

    const detected = [];
    const pendingOutputs = [];
    for (const [side, candidate] of [['left', analysis.bestLeft], ['right', analysis.bestRight]]) {
        if (!candidate) {
            continue;
        }
        const paddedRect = clampRect({
            x: candidate.bbox.x - autoPad,
            y: candidate.bbox.y - autoPad,
            width: candidate.bbox.width + (autoPad * 2),
            height: candidate.bbox.height + (autoPad * 2),
        }, sourceSize);
        pendingOutputs.push({
            side,
            detected: candidate.bbox,
            padded: paddedRect,
            output: path.join(outDir, side === 'left' ? (args['left-name'] || 'header_cap_left.png') : (args['right-name'] || 'header_cap_right.png')),
        });
        detected.push(side);
    }

    const status = detected.length >= minSides ? 'matched' : 'no-match';
    const outputs = {};
    if (status === 'matched') {
        for (const item of pendingOutputs) {
            await cropRect(browser, dataUrl, item.padded, item.output);
            outputs[item.side] = {
                detected: item.detected,
                padded: item.padded,
                output: item.output,
            };
        }
    }

    return {
        input: inputPath,
        outDir,
        sourceSize,
        mode: 'auto-detect',
        analysis,
        detectedSides: detected,
        outputs,
        status,
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.input) {
        printUsage();
        process.exit(args.help ? 0 : 1);
    }

    const inputPath = path.resolve(args.input);
    if (!fs.existsSync(inputPath)) {
        throw new Error(`找不到輸入圖檔: ${inputPath}`);
    }

    const browserPath = resolveBrowser();
    if (!browserPath) {
        throw new Error('找不到可用瀏覽器');
    }

    const browser = await puppeteer.launch({ executablePath: browserPath, headless: true });
    try {
        const autoDetect = Boolean(args['auto-detect']);
        const stat = fs.statSync(inputPath);
        const outDir = path.resolve(args['out-dir'] || path.join(stat.isDirectory() ? inputPath : path.dirname(inputPath), 'crop-output'));
        fs.mkdirSync(outDir, { recursive: true });

        if (stat.isDirectory()) {
            if (!autoDetect) {
                throw new Error('目錄模式目前需要搭配 --auto-detect');
            }
            const inputFiles = collectInputFiles(inputPath, Boolean(args.recursive), args['name-prefix']);
            const results = [];
            for (const file of inputFiles) {
                const fileStem = path.parse(file).name;
                const itemOutDir = path.join(outDir, fileStem);
                fs.mkdirSync(itemOutDir, { recursive: true });
                try {
                    const report = await runAutoCropForFile(browser, file, itemOutDir, args);
                    results.push(report);
                    console.log(`${report.status === 'matched' ? '✓' : '-'} ${path.basename(file)} -> ${report.detectedSides.join('+') || 'no-match'}`);
                } catch (error) {
                    results.push({ input: file, status: 'error', error: error.message });
                    console.warn(`! ${path.basename(file)} -> ${error.message}`);
                }
            }
            const summary = {
                input: inputPath,
                mode: 'batch-auto-detect',
                scanned: inputFiles.length,
                matched: results.filter((item) => item.status === 'matched').length,
                errored: results.filter((item) => item.status === 'error').length,
                results,
            };
            const reportPath = path.join(outDir, 'header-cap-batch-report.json');
            fs.writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
            console.log(`✓ batch report -> ${reportPath}`);
            return;
        }

        const report = autoDetect
            ? await runAutoCropForFile(browser, inputPath, outDir, args)
            : await runManualCrop(browser, inputPath, outDir, args);
        const reportPath = path.join(outDir, 'header-cap-crop-report.json');
        fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

        if (report.mode === 'auto-detect') {
            console.log(`${report.status === 'matched' ? '✓' : '-'} auto-detect -> ${report.detectedSides.join('+') || 'no-match'}`);
        } else {
            console.log(`✓ left  -> ${report.left.output}`);
            console.log(`✓ right -> ${report.right.output}`);
        }
        console.log(`✓ report -> ${reportPath}`);
    } finally {
        await browser.close();
    }
}

main().catch((error) => {
    console.error(`[crop-general-detail-header-caps] ${error.message}`);
    process.exit(1);
});