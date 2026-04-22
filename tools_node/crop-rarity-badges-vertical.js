#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

function parseArgs(argv) {
    const options = {
        threshold: 36,
        alphaFloor: 12,
        pad: 12,
        row: 'bottom',
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        const next = argv[index + 1];
        switch (token) {
            case '--input':
                options.input = next;
                index += 1;
                break;
            case '--out-dir':
                options.outDir = next;
                index += 1;
                break;
            case '--threshold':
                options.threshold = Number(next);
                index += 1;
                break;
            case '--alpha-floor':
                options.alphaFloor = Number(next);
                index += 1;
                break;
            case '--pad':
                options.pad = Number(next);
                index += 1;
                break;
            case '--row':
                options.row = next;
                index += 1;
                break;
            default:
                break;
        }
    }

    return options;
}

function resolveBrowser() {
    const candidates = [
        'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return '';
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, value) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function normalizeRow(row) {
    const value = `${row ?? ''}`.trim().toLowerCase();
    if (value === 'top' || value === 'upper') return 'top';
    return 'bottom';
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (!options.input || !options.outDir) {
        console.error('Usage: node tools_node/crop-rarity-badges-vertical.js --input <png> --out-dir <dir> [--row bottom|top]');
        process.exit(1);
    }

    const inputPath = path.resolve(options.input);
    const outDir = path.resolve(options.outDir);
    if (!fs.existsSync(inputPath)) {
        console.error(`[crop-rarity-badges-vertical] 找不到輸入檔: ${inputPath}`);
        process.exit(1);
    }

    const browserPath = resolveBrowser();
    if (!browserPath) {
        console.error('[crop-rarity-badges-vertical] 找不到可用瀏覽器');
        process.exit(1);
    }

    ensureDir(outDir);

    const browser = await puppeteer.launch({ executablePath: browserPath, headless: true });
    try {
        const page = await browser.newPage();
        const srcDataUrl = `data:image/png;base64,${fs.readFileSync(inputPath).toString('base64')}`;
        const result = await page.evaluate(async ({ dataUrl, threshold, alphaFloor, pad, row }) => {
            function loadImage(url) {
                return new Promise((resolve, reject) => {
                    const image = new Image();
                    image.onload = () => resolve(image);
                    image.onerror = reject;
                    image.src = url;
                });
            }

            const image = await loadImage(dataUrl);
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            context.drawImage(image, 0, 0);

            const sourceWidth = canvas.width;
            const sourceHeight = canvas.height;
            const analysisY = row === 'top' ? 0 : Math.floor(sourceHeight / 2);
            const analysisHeight = Math.floor(sourceHeight / 2);
            const imageData = context.getImageData(0, analysisY, sourceWidth, analysisHeight);
            const { data, width, height } = imageData;

            const inset = Math.max(8, Math.floor(Math.min(width, height) / 20));
            const samplePoints = [
                [inset, inset],
                [width - 1 - inset, inset],
                [inset, height - 1 - inset],
                [width - 1 - inset, height - 1 - inset],
                [Math.floor(width / 2), inset],
                [Math.floor(width / 2), height - 1 - inset],
                [inset, Math.floor(height / 2)],
                [width - 1 - inset, Math.floor(height / 2)],
            ];

            const bgSamples = [];
            for (const [x, y] of samplePoints) {
                const index = (y * width + x) * 4;
                bgSamples.push({
                    r: data[index],
                    g: data[index + 1],
                    b: data[index + 2],
                });
            }

            const avg = bgSamples.reduce((acc, sample) => ({
                r: acc.r + sample.r,
                g: acc.g + sample.g,
                b: acc.b + sample.b,
            }), { r: 0, g: 0, b: 0 });
            avg.r /= bgSamples.length;
            avg.g /= bgSamples.length;
            avg.b /= bgSamples.length;

            const colorDistance = (r, g, b) => Math.sqrt(
                (r - avg.r) * (r - avg.r)
                + (g - avg.g) * (g - avg.g)
                + (b - avg.b) * (b - avg.b)
            );

            const mask = new Uint8Array(width * height);
            for (let y = 0; y < height; y += 1) {
                for (let x = 0; x < width; x += 1) {
                    const offset = (y * width + x) * 4;
                    const alpha = data[offset + 3];
                    const dist = colorDistance(data[offset], data[offset + 1], data[offset + 2]);
                    if (alpha > alphaFloor && dist > threshold) {
                        mask[y * width + x] = 1;
                    }
                }
            }

            const visited = new Uint8Array(width * height);
            const components = [];
            const queue = [];

            const push = (x, y) => {
                if (x < 0 || y < 0 || x >= width || y >= height) {
                    return;
                }
                const index = y * width + x;
                if (visited[index] || !mask[index]) {
                    return;
                }
                visited[index] = 1;
                queue.push(index);
            };

            for (let y = 0; y < height; y += 1) {
                for (let x = 0; x < width; x += 1) {
                    const index = y * width + x;
                    if (visited[index] || !mask[index]) {
                        continue;
                    }

                    queue.length = 0;
                    push(x, y);
                    let head = 0;
                    let area = 0;
                    let minX = width;
                    let minY = height;
                    let maxX = -1;
                    let maxY = -1;
                    let touchEdge = false;

                    while (head < queue.length) {
                        const current = queue[head];
                        head += 1;
                        const cx = current % width;
                        const cy = Math.floor(current / width);
                        area += 1;
                        if (cx < minX) minX = cx;
                        if (cy < minY) minY = cy;
                        if (cx > maxX) maxX = cx;
                        if (cy > maxY) maxY = cy;
                        if (cx === 0 || cy === 0 || cx === width - 1 || cy === height - 1) {
                            touchEdge = true;
                        }

                        const neighbors = [
                            [cx + 1, cy],
                            [cx - 1, cy],
                            [cx, cy + 1],
                            [cx, cy - 1],
                        ];
                        for (const [nx, ny] of neighbors) {
                            if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
                                continue;
                            }
                            const nIndex = ny * width + nx;
                            if (!visited[nIndex] && mask[nIndex]) {
                                visited[nIndex] = 1;
                                queue.push(nIndex);
                            }
                        }
                    }

                    components.push({
                        area,
                        minX,
                        minY,
                        maxX,
                        maxY,
                        width: maxX - minX + 1,
                        height: maxY - minY + 1,
                        centerX: (minX + maxX) / 2,
                        centerY: (minY + maxY) / 2,
                        touchEdge,
                    });
                }
            }

            const candidates = components.filter((component) => {
                if (component.touchEdge) return false;
                if (component.area < 2500 || component.area > 120000) return false;
                if (component.width < 60 || component.height < 80) return false;
                return true;
            });

            candidates.sort((a, b) => a.centerY - b.centerY || a.centerX - b.centerX);

            const rowMid = height / 2;
            const topRow = candidates.filter((component) => component.centerY < rowMid);
            const bottomRow = candidates.filter((component) => component.centerY >= rowMid);

            const selected = bottomRow.length >= 4 ? bottomRow.slice(0, 4) : candidates.slice(-4);

            const cropComponent = (component) => {
                const cropMinX = Math.max(0, component.minX - pad);
                const cropMinY = Math.max(0, component.minY - pad);
                const cropMaxX = Math.min(width - 1, component.maxX + pad);
                const cropMaxY = Math.min(height - 1, component.maxY + pad);
                const cropW = cropMaxX - cropMinX + 1;
                const cropH = cropMaxY - cropMinY + 1;
                const cropCanvas = document.createElement('canvas');
                cropCanvas.width = cropW;
                cropCanvas.height = cropH;
                const cropContext = cropCanvas.getContext('2d');
                const cropImageData = cropContext.createImageData(cropW, cropH);

                for (let y = 0; y < cropH; y += 1) {
                    for (let x = 0; x < cropW; x += 1) {
                        const sourceX = cropMinX + x;
                        const sourceY = cropMinY + y;
                        const sourceIndex = sourceY * width + sourceX;
                        const destinationIndex = (y * cropW + x) * 4;
                        if (!mask[sourceIndex]) {
                            cropImageData.data[destinationIndex + 3] = 0;
                            continue;
                        }
                        const sourceOffset = sourceIndex * 4;
                        cropImageData.data[destinationIndex] = data[sourceOffset];
                        cropImageData.data[destinationIndex + 1] = data[sourceOffset + 1];
                        cropImageData.data[destinationIndex + 2] = data[sourceOffset + 2];
                        cropImageData.data[destinationIndex + 3] = data[sourceOffset + 3];
                    }
                }

                cropContext.putImageData(cropImageData, 0, 0);
                return cropCanvas.toDataURL('image/png');
            };

            return {
                imageSize: { width, height },
                background: { r: Math.round(avg.r), g: Math.round(avg.g), b: Math.round(avg.b) },
                candidates,
                topRow,
                bottomRow,
                selected: selected.map(cropComponent),
                allSelectedBoxes: selected,
            };
        }, {
            dataUrl: srcDataUrl,
            threshold: options.threshold,
            alphaFloor: options.alphaFloor,
            pad: options.pad,
            row: normalizeRow(options.row),
        });

        const row = normalizeRow(options.row);
        const names = ['common', 'rare', 'epic', 'legendary'];
        const selectedDataUrls = result.selected;

        if (!selectedDataUrls || selectedDataUrls.length < 4) {
            console.error('[crop-rarity-badges-vertical] 找不到 4 個可用 badge 元件');
            console.error(JSON.stringify({ imageSize: result.imageSize, candidates: result.candidates }, null, 2));
            process.exit(1);
        }

        const targetNames = row === 'bottom'
            ? [
                'badge_rarity_common_flat.png',
                'badge_rarity_rare_flat.png',
                'badge_rarity_epic_flat.png',
                'badge_rarity_legendary_flat.png',
            ]
            : [
                'badge_rarity_common.png',
                'badge_rarity_rare.png',
                'badge_rarity_epic.png',
                'badge_rarity_legendary.png',
            ];

        for (let index = 0; index < 4; index += 1) {
            const base64 = selectedDataUrls[index].replace(/^data:image\/png;base64,/, '');
            const targetPath = path.join(outDir, targetNames[index]);
            fs.writeFileSync(targetPath, Buffer.from(base64, 'base64'));
            console.log(`✓ wrote ${targetPath}`);
        }

        const reportPath = path.join(outDir, 'rarity-badges-vertical-report.json');
        const report = {
            input: inputPath,
            outDir,
            row,
            threshold: options.threshold,
            alphaFloor: options.alphaFloor,
            pad: options.pad,
            imageSize: result.imageSize,
            background: result.background,
            candidateCount: result.candidates.length,
            topRowCount: result.topRow.length,
            bottomRowCount: result.bottomRow.length,
            selectedBoxes: result.allSelectedBoxes,
        };
        writeJson(reportPath, report);
        console.log(`✓ report ${reportPath}`);
    } finally {
        await browser.close();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
