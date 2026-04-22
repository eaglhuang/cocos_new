#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const RARITY_NAMES = ['common', 'rare', 'epic', 'legendary'];

function parseArgs(argv) {
    const options = {
        threshold: 32,
        alphaFloor: 12,
        pad: 14,
        rowHeight: 280,
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
            case '--row-height':
                options.rowHeight = Number(next);
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

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (!options.input || !options.outDir) {
        console.error('Usage: node tools_node/crop-rarity-badges-quarter.js --input <png> --out-dir <dir>');
        process.exit(1);
    }

    const inputPath = path.resolve(options.input);
    const outDir = path.resolve(options.outDir);
    if (!fs.existsSync(inputPath)) {
        console.error(`[crop-rarity-badges-quarter] 找不到輸入檔: ${inputPath}`);
        process.exit(1);
    }

    const browserPath = resolveBrowser();
    if (!browserPath) {
        console.error('[crop-rarity-badges-quarter] 找不到可用瀏覽器');
        process.exit(1);
    }

    ensureDir(outDir);

    const browser = await puppeteer.launch({ executablePath: browserPath, headless: true });
    try {
        const page = await browser.newPage();
        const srcDataUrl = `data:image/png;base64,${fs.readFileSync(inputPath).toString('base64')}`;
        const result = await page.evaluate(async ({ dataUrl, threshold, alphaFloor, pad, rowHeight }) => {
            function loadImage(url) {
                return new Promise((resolve, reject) => {
                    const image = new Image();
                    image.onload = () => resolve(image);
                    image.onerror = reject;
                    image.src = url;
                });
            }

            function sampleBackgroundColors(data, width, height, alphaThreshold) {
                const edgeSamples = [];
                const step = Math.max(1, Math.floor(Math.min(width, height) / 20));

                const addSample = (x, y) => {
                    if (x < 0 || y < 0 || x >= width || y >= height) {
                        return;
                    }
                    const index = (y * width + x) * 4;
                    if (data[index + 3] <= alphaThreshold) {
                        return;
                    }
                    edgeSamples.push({
                        r: data[index],
                        g: data[index + 1],
                        b: data[index + 2],
                    });
                };

                for (let x = 0; x < width; x += step) {
                    addSample(x, 0);
                    addSample(x, height - 1);
                }
                for (let y = 0; y < height; y += step) {
                    addSample(0, y);
                    addSample(width - 1, y);
                }

                if (edgeSamples.length === 0) {
                    return [];
                }

                const sum = edgeSamples.reduce((accumulator, sample) => ({
                    r: accumulator.r + sample.r,
                    g: accumulator.g + sample.g,
                    b: accumulator.b + sample.b,
                }), { r: 0, g: 0, b: 0 });
                const avgR = sum.r / edgeSamples.length;
                const avgG = sum.g / edgeSamples.length;
                const avgB = sum.b / edgeSamples.length;

                let maxSpread = 0;
                for (const sample of edgeSamples) {
                    const spread = Math.sqrt(
                        (sample.r - avgR) * (sample.r - avgR) +
                        (sample.g - avgG) * (sample.g - avgG) +
                        (sample.b - avgB) * (sample.b - avgB),
                    );
                    if (spread > maxSpread) {
                        maxSpread = spread;
                    }
                }

                if (maxSpread > 40) {
                    const avgLum = (avgR + avgG + avgB) / 3;
                    const light = edgeSamples.filter((sample) => (sample.r + sample.g + sample.b) / 3 >= avgLum);
                    const dark = edgeSamples.filter((sample) => (sample.r + sample.g + sample.b) / 3 < avgLum);

                    if (light.length >= 2 && dark.length >= 2) {
                        const sumCluster = (samples) => samples.reduce((accumulator, sample) => ({
                            r: accumulator.r + sample.r,
                            g: accumulator.g + sample.g,
                            b: accumulator.b + sample.b,
                        }), { r: 0, g: 0, b: 0 });

                        const lightSum = sumCluster(light);
                        const darkSum = sumCluster(dark);
                        const lightAvg = {
                            r: lightSum.r / light.length,
                            g: lightSum.g / light.length,
                            b: lightSum.b / light.length,
                        };
                        const darkAvg = {
                            r: darkSum.r / dark.length,
                            g: darkSum.g / dark.length,
                            b: darkSum.b / dark.length,
                        };

                        const lightSat = Math.max(lightAvg.r, lightAvg.g, lightAvg.b) - Math.min(lightAvg.r, lightAvg.g, lightAvg.b);
                        const darkSat = Math.max(darkAvg.r, darkAvg.g, darkAvg.b) - Math.min(darkAvg.r, darkAvg.g, darkAvg.b);
                        if (lightSat < 30 && darkSat < 30) {
                            return [lightAvg, darkAvg];
                        }
                    }
                }

                return [{ r: avgR, g: avgG, b: avgB }];
            }

            function colorDistance(r, g, b, bgColors) {
                let minDistance = Infinity;
                for (const bg of bgColors) {
                    const distance = Math.sqrt(
                        (r - bg.r) * (r - bg.r) +
                        (g - bg.g) * (g - bg.g) +
                        (b - bg.b) * (b - bg.b),
                    );
                    if (distance < minDistance) {
                        minDistance = distance;
                    }
                }
                return minDistance;
            }

            function buildForegroundMask(data, width, height, alphaThreshold, colorThreshold) {
                const bgColors = sampleBackgroundColors(data, width, height, alphaThreshold);
                const marked = new Uint8Array(width * height);
                const queue = [];

                if (bgColors.length === 0) {
                    return marked;
                }

                const isBackgroundPixel = (pixelOffset) => {
                    const alpha = data[pixelOffset + 3];
                    if (alpha <= alphaThreshold) {
                        return true;
                    }
                    return colorDistance(data[pixelOffset], data[pixelOffset + 1], data[pixelOffset + 2], bgColors) < colorThreshold;
                };

                const enqueue = (x, y) => {
                    if (x < 0 || y < 0 || x >= width || y >= height) {
                        return;
                    }
                    const offset = y * width + x;
                    if (marked[offset]) {
                        return;
                    }
                    if (!isBackgroundPixel(offset * 4)) {
                        return;
                    }
                    marked[offset] = 1;
                    queue.push(offset);
                };

                for (let x = 0; x < width; x += 1) {
                    enqueue(x, 0);
                    enqueue(x, height - 1);
                }
                for (let y = 1; y < height - 1; y += 1) {
                    enqueue(0, y);
                    enqueue(width - 1, y);
                }

                for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
                    const offset = queue[queueIndex];
                    const x = offset % width;
                    const y = (offset - x) / width;
                    enqueue(x + 1, y);
                    enqueue(x - 1, y);
                    enqueue(x, y + 1);
                    enqueue(x, y - 1);
                }

                for (let y = 0; y < height; y += 1) {
                    for (let x = 0; x < width; x += 1) {
                        const offset = y * width + x;
                        const pixelOffset = offset * 4;
                        if (marked[offset]) {
                            continue;
                        }
                        if (data[pixelOffset + 3] <= alphaThreshold) {
                            continue;
                        }
                        if (colorDistance(data[pixelOffset], data[pixelOffset + 1], data[pixelOffset + 2], bgColors) < colorThreshold) {
                            marked[offset] = 1;
                        }
                    }
                }

                return marked;
            }

            function extractComponents(data, foregroundMask, width, height, minArea, minWidth, minHeight, alphaThreshold) {
                const visited = new Uint8Array(width * height);
                const components = [];
                const pixelCount = width * height;

                for (let startIndex = 0; startIndex < pixelCount; startIndex += 1) {
                    if (visited[startIndex] || foregroundMask[startIndex] || data[startIndex * 4 + 3] <= alphaThreshold) {
                        continue;
                    }

                    const stack = [startIndex];
                    visited[startIndex] = 1;

                    let area = 0;
                    let minX = width;
                    let minY = height;
                    let maxX = 0;
                    let maxY = 0;

                    while (stack.length > 0) {
                        const index = stack.pop();
                        const y = Math.floor(index / width);
                        const x = index - y * width;

                        area += 1;
                        if (x < minX) {
                            minX = x;
                        }
                        if (y < minY) {
                            minY = y;
                        }
                        if (x > maxX) {
                            maxX = x;
                        }
                        if (y > maxY) {
                            maxY = y;
                        }

                        if (x > 0) {
                            const leftIndex = index - 1;
                            if (!visited[leftIndex] && !foregroundMask[leftIndex] && data[leftIndex * 4 + 3] > alphaThreshold) {
                                visited[leftIndex] = 1;
                                stack.push(leftIndex);
                            }
                        }
                        if (x + 1 < width) {
                            const rightIndex = index + 1;
                            if (!visited[rightIndex] && !foregroundMask[rightIndex] && data[rightIndex * 4 + 3] > alphaThreshold) {
                                visited[rightIndex] = 1;
                                stack.push(rightIndex);
                            }
                        }
                        if (y > 0) {
                            const upIndex = index - width;
                            if (!visited[upIndex] && !foregroundMask[upIndex] && data[upIndex * 4 + 3] > alphaThreshold) {
                                visited[upIndex] = 1;
                                stack.push(upIndex);
                            }
                        }
                        if (y + 1 < height) {
                            const downIndex = index + width;
                            if (!visited[downIndex] && !foregroundMask[downIndex] && data[downIndex * 4 + 3] > alphaThreshold) {
                                visited[downIndex] = 1;
                                stack.push(downIndex);
                            }
                        }
                    }

                    const componentWidth = maxX - minX + 1;
                    const componentHeight = maxY - minY + 1;
                    if (area >= minArea && componentWidth >= minWidth && componentHeight >= minHeight) {
                        components.push({
                            seedIndex: startIndex,
                            area,
                            minX,
                            minY,
                            maxX,
                            maxY,
                            width: componentWidth,
                            height: componentHeight,
                        });
                    }
                }

                return components;
            }

            function buildComponentMask(seedIndex, data, foregroundMask, width, height, alphaThreshold) {
                const mask = new Uint8Array(width * height);
                const stack = [seedIndex];
                mask[seedIndex] = 1;

                while (stack.length > 0) {
                    const index = stack.pop();
                    const y = Math.floor(index / width);
                    const x = index - y * width;

                    if (x > 0) {
                        const leftIndex = index - 1;
                        if (!mask[leftIndex] && !foregroundMask[leftIndex] && data[leftIndex * 4 + 3] > alphaThreshold) {
                            mask[leftIndex] = 1;
                            stack.push(leftIndex);
                        }
                    }
                    if (x + 1 < width) {
                        const rightIndex = index + 1;
                        if (!mask[rightIndex] && !foregroundMask[rightIndex] && data[rightIndex * 4 + 3] > alphaThreshold) {
                            mask[rightIndex] = 1;
                            stack.push(rightIndex);
                        }
                    }
                    if (y > 0) {
                        const upIndex = index - width;
                        if (!mask[upIndex] && !foregroundMask[upIndex] && data[upIndex * 4 + 3] > alphaThreshold) {
                            mask[upIndex] = 1;
                            stack.push(upIndex);
                        }
                    }
                    if (y + 1 < height) {
                        const downIndex = index + width;
                        if (!mask[downIndex] && !foregroundMask[downIndex] && data[downIndex * 4 + 3] > alphaThreshold) {
                            mask[downIndex] = 1;
                            stack.push(downIndex);
                        }
                    }
                }

                return mask;
            }

            const image = await loadImage(dataUrl);
            const sourceWidth = image.width;
            const sourceHeight = image.height;
            const quarterWidth = Math.floor(sourceWidth / 4);
            const results = [];

            for (let column = 0; column < 4; column += 1) {
                const cropX = quarterWidth * column;
                const cropW = column === 3 ? sourceWidth - cropX : quarterWidth;
                const cropCanvas = document.createElement('canvas');
                cropCanvas.width = cropW;
                cropCanvas.height = sourceHeight;
                const cropContext = cropCanvas.getContext('2d', { willReadFrequently: true });
                cropContext.drawImage(image, cropX, 0, cropW, sourceHeight, 0, 0, cropW, sourceHeight);

                const imageData = cropContext.getImageData(0, 0, cropW, sourceHeight);
                const { data, width, height } = imageData;
                const foregroundMask = buildForegroundMask(data, width, height, alphaFloor, threshold);
                const components = extractComponents(
                    data,
                    foregroundMask,
                    width,
                    height,
                    Math.max(800, Math.floor(threshold * 24)),
                    Math.max(64, Math.floor(width * 0.18)),
                    Math.max(44, Math.floor(rowHeight * 0.16)),
                    alphaFloor,
                );

                if (components.length === 0) {
                    results.push({
                        column,
                        cropX,
                        cropW,
                        badgeStart: -1,
                        gapStart: -1,
                        bounds: null,
                        selectedComponent: null,
                        componentCount: 0,
                        dataUrl: null,
                    });
                    continue;
                }

                const minBadgeHeight = Math.max(120, Math.floor(rowHeight * 0.45));
                const maxBadgeHeight = Math.max(minBadgeHeight + 1, Math.floor(rowHeight * 1.8));
                const targetHeight = rowHeight;
                const targetWidth = Math.max(96, Math.round(rowHeight * 0.68));

                const edgeTouches = (component) => (
                    (component.minX <= 0 ? 1 : 0) +
                    (component.minY <= 0 ? 1 : 0) +
                    (component.maxX >= width - 1 ? 1 : 0) +
                    (component.maxY >= height - 1 ? 1 : 0)
                );

                const rankComponents = (left, right) => {
                    const leftEdge = edgeTouches(left);
                    const rightEdge = edgeTouches(right);
                    if (leftEdge !== rightEdge) {
                        return leftEdge - rightEdge;
                    }

                    const leftHeightDelta = Math.abs(left.height - targetHeight);
                    const rightHeightDelta = Math.abs(right.height - targetHeight);
                    if (leftHeightDelta !== rightHeightDelta) {
                        return leftHeightDelta - rightHeightDelta;
                    }

                    const leftWidthDelta = Math.abs(left.width - targetWidth);
                    const rightWidthDelta = Math.abs(right.width - targetWidth);
                    if (leftWidthDelta !== rightWidthDelta) {
                        return leftWidthDelta - rightWidthDelta;
                    }

                    if (left.minY !== right.minY) {
                        return left.minY - right.minY;
                    }
                    if (left.minX !== right.minX) {
                        return left.minX - right.minX;
                    }
                    return right.area - left.area;
                };

                const badgeLikeComponents = components.filter((component) => (
                    component.height >= minBadgeHeight && component.height <= maxBadgeHeight
                ));
                const rankedComponents = (badgeLikeComponents.length > 0 ? badgeLikeComponents : components).slice();
                rankedComponents.sort(rankComponents);

                const selectedComponent = rankedComponents[0];
                const nextComponent = rankedComponents.length > 1 ? rankedComponents[1] : null;
                const selectedMask = buildComponentMask(selectedComponent.seedIndex, data, foregroundMask, width, height, alphaFloor);
                const cropMinX = Math.max(0, selectedComponent.minX - pad);
                const cropMinY = Math.max(0, selectedComponent.minY - pad);
                const cropMaxX = Math.min(width - 1, selectedComponent.maxX + pad);
                const cropMaxY = Math.min(
                    height - 1,
                    selectedComponent.height > maxBadgeHeight
                        ? selectedComponent.minY + Math.max(Math.ceil(selectedComponent.height * 0.5), rowHeight + pad * 2) + pad
                        : selectedComponent.maxY + pad,
                );
                const finalW = cropMaxX - cropMinX + 1;
                const finalH = cropMaxY - cropMinY + 1;

                const outCanvas = document.createElement('canvas');
                outCanvas.width = finalW;
                outCanvas.height = finalH;
                const outContext = outCanvas.getContext('2d', { willReadFrequently: true });
                const outImageData = outContext.createImageData(finalW, finalH);
                let transparentPixelCount = 0;

                for (let y = 0; y < finalH; y += 1) {
                    for (let x = 0; x < finalW; x += 1) {
                        const sourceX = cropMinX + x;
                        const sourceY = cropMinY + y;
                        const sourceIndex = sourceY * width + sourceX;
                        const destinationIndex = (y * finalW + x) * 4;
                        const sourceOffset = sourceIndex * 4;
                        if (selectedMask[sourceIndex]) {
                            outImageData.data[destinationIndex] = data[sourceOffset];
                            outImageData.data[destinationIndex + 1] = data[sourceOffset + 1];
                            outImageData.data[destinationIndex + 2] = data[sourceOffset + 2];
                            outImageData.data[destinationIndex + 3] = data[sourceOffset + 3];
                        } else {
                            outImageData.data[destinationIndex] = 0;
                            outImageData.data[destinationIndex + 1] = 0;
                            outImageData.data[destinationIndex + 2] = 0;
                            outImageData.data[destinationIndex + 3] = 0;
                            transparentPixelCount += 1;
                        }
                    }
                }

                outContext.putImageData(outImageData, 0, 0);
                results.push({
                    column,
                    cropX: quarterWidth * column + cropMinX,
                    cropW: finalW,
                    badgeStart: selectedComponent.minY,
                    gapStart: nextComponent ? nextComponent.minY : -1,
                    bounds: { minX: cropMinX, minY: cropMinY, maxX: cropMaxX, maxY: cropMaxY, width: finalW, height: finalH },
                    selectedComponent: {
                        area: selectedComponent.area,
                        minX: selectedComponent.minX,
                        minY: selectedComponent.minY,
                        maxX: selectedComponent.maxX,
                        maxY: selectedComponent.maxY,
                        width: selectedComponent.width,
                        height: selectedComponent.height,
                    },
                    componentCount: components.length,
                    transparentPixelCount,
                    dataUrl: outCanvas.toDataURL('image/png'),
                });
            }

            return {
                sourceSize: { width: sourceWidth, height: sourceHeight },
                quarterWidth,
                results,
            };
            }, {
                dataUrl: srcDataUrl,
                threshold: options.threshold,
                alphaFloor: options.alphaFloor,
                pad: options.pad,
                rowHeight: options.rowHeight,
            });

        const outputNames = [
            'badge_rarity_common_flat.png',
            'badge_rarity_rare_flat.png',
            'badge_rarity_epic_flat.png',
            'badge_rarity_legendary_flat.png',
        ];

        const reportResults = [];
        for (let index = 0; index < result.results.length; index += 1) {
            const item = result.results[index];
            if (!item || !item.dataUrl) {
                reportResults.push(item);
                continue;
            }
            const base64 = item.dataUrl.replace(/^data:image\/png;base64,/, '');
            const targetPath = path.join(outDir, outputNames[index]);
            fs.writeFileSync(targetPath, Buffer.from(base64, 'base64'));
            reportResults.push({ ...item, targetPath });
            console.log(`✓ wrote ${targetPath}`);
        }

        const report = {
            input: inputPath,
            outDir,
            sourceSize: result.sourceSize,
            quarterWidth: result.quarterWidth,
            threshold: options.threshold,
            alphaFloor: options.alphaFloor,
            pad: options.pad,
            rowHeight: options.rowHeight,
            results: reportResults,
        };
        const reportPath = path.join(outDir, 'rarity-badges-quarter-report.json');
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
