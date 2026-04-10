#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

let puppeteer;
try {
    puppeteer = require('puppeteer-core');
} catch (error) {
    console.error('[trim-png-by-background] 缺少依賴 puppeteer-core');
    process.exit(1);
}

function parseArgs(argv) {
    const options = {
        colorThreshold: 28,
        alphaThreshold: 12,
        pad: 24,
        fitPadding: 24,
        focus: 'none',
        maxContentRatio: 1,
        fadeSide: 'none',
        fadeStartRatio: 1,
        safeDefringe: true,
        browser: '',
        report: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        const next = argv[index + 1];
        switch (token) {
            case '--input':
                options.input = next;
                index += 1;
                break;
            case '--output':
                options.output = next;
                index += 1;
                break;
            case '--canvas-width':
                options.canvasWidth = Number(next);
                index += 1;
                break;
            case '--canvas-height':
                options.canvasHeight = Number(next);
                index += 1;
                break;
            case '--color-threshold':
                options.colorThreshold = Number(next);
                index += 1;
                break;
            case '--alpha-threshold':
                options.alphaThreshold = Number(next);
                index += 1;
                break;
            case '--pad':
                options.pad = Number(next);
                index += 1;
                break;
            case '--fit-padding':
                options.fitPadding = Number(next);
                index += 1;
                break;
            case '--focus':
                options.focus = next;
                index += 1;
                break;
            case '--max-content-ratio':
                options.maxContentRatio = Number(next);
                index += 1;
                break;
            case '--fade-side':
                options.fadeSide = next;
                index += 1;
                break;
            case '--fade-start-ratio':
                options.fadeStartRatio = Number(next);
                index += 1;
                break;
            case '--disable-safe-defringe':
                options.safeDefringe = false;
                break;
            case '--browser':
                options.browser = next;
                index += 1;
                break;
            case '--report':
                options.report = true;
                break;
            default:
                break;
        }
    }

    return options;
}

function resolveBrowser(preferred) {
    const candidates = [
        preferred,
        'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    ].filter(Boolean);

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return '';
}

function ensureArgs(options) {
    if (!options.input || !options.output) {
        console.error('用法: node tools_node/trim-png-by-background.js --input <png> --output <png> [--canvas-width 1024 --canvas-height 768] [--color-threshold 28] [--pad 24] [--fit-padding 24] [--report]');
        process.exit(1);
    }

    if (!fs.existsSync(options.input)) {
        console.error(`[trim-png-by-background] 找不到輸入檔案: ${options.input}`);
        process.exit(1);
    }

    if ((options.canvasWidth && !options.canvasHeight) || (!options.canvasWidth && options.canvasHeight)) {
        console.error('[trim-png-by-background] canvas width / height 必須同時提供');
        process.exit(1);
    }

    if (!['none', 'left', 'right'].includes(options.focus)) {
        console.error('[trim-png-by-background] --focus 只能是 none / left / right');
        process.exit(1);
    }

    if (!['none', 'left', 'right'].includes(options.fadeSide)) {
        console.error('[trim-png-by-background] --fade-side 只能是 none / left / right');
        process.exit(1);
    }

    if (!(options.maxContentRatio > 0 && options.maxContentRatio <= 1)) {
        console.error('[trim-png-by-background] --max-content-ratio 必須介於 0 到 1');
        process.exit(1);
    }

    if (!(options.fadeStartRatio > 0 && options.fadeStartRatio <= 1)) {
        console.error('[trim-png-by-background] --fade-start-ratio 必須介於 0 到 1');
        process.exit(1);
    }
}

async function cropImage(browser, inputPath, config) {
    const page = await browser.newPage();
    const buffer = fs.readFileSync(inputPath);
    const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;

    try {
        const result = await page.evaluate(async ({ src, config: cropConfig }) => {
            const loadImage = (url) => new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = reject;
                image.src = url;
            });

            const image = await loadImage(src);
            const sourceCanvas = document.createElement('canvas');
            sourceCanvas.width = image.width;
            sourceCanvas.height = image.height;
            const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
            sourceContext.drawImage(image, 0, 0);

            const imageData = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
            const { data, width, height } = imageData;
            const inset = Math.max(0, Math.min(16, Math.floor(Math.min(width, height) / 12)));
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

            let bgR = 0;
            let bgG = 0;
            let bgB = 0;
            let bgA = 0;
            const sampledColors = [];
            for (const [x, y] of samplePoints) {
                const index = (y * width + x) * 4;
                sampledColors.push({
                    r: data[index],
                    g: data[index + 1],
                    b: data[index + 2],
                    a: data[index + 3],
                });
                bgR += data[index];
                bgG += data[index + 1];
                bgB += data[index + 2];
                bgA += data[index + 3];
            }

            const sampleCount = samplePoints.length;
            bgR /= sampleCount;
            bgG /= sampleCount;
            bgB /= sampleCount;
            bgA /= sampleCount;

            let backgroundSpread = 0;
            for (const sample of sampledColors) {
                const dr = sample.r - bgR;
                const dg = sample.g - bgG;
                const db = sample.b - bgB;
                const spread = Math.sqrt((dr * dr) + (dg * dg) + (db * db));
                if (spread > backgroundSpread) {
                    backgroundSpread = spread;
                }
            }

            // Checkerboard detection: when spread is large, split samples into
            // light/dark groups and check if both are desaturated (gray).
            // If so, use dual-background mode so both tile colors are treated as BG.
            let bgIsCheckerboard = false;
            let bgLight = { r: bgR, g: bgG, b: bgB };
            let bgDark = { r: bgR, g: bgG, b: bgB };

            if (backgroundSpread > 40) {
                const avgLum = (bgR + bgG + bgB) / 3;
                const lightSamples = sampledColors.filter(s => (s.r + s.g + s.b) / 3 >= avgLum);
                const darkSamples = sampledColors.filter(s => (s.r + s.g + s.b) / 3 < avgLum);

                if (lightSamples.length >= 2 && darkSamples.length >= 2) {
                    const lR = lightSamples.reduce((s, c) => s + c.r, 0) / lightSamples.length;
                    const lG = lightSamples.reduce((s, c) => s + c.g, 0) / lightSamples.length;
                    const lB = lightSamples.reduce((s, c) => s + c.b, 0) / lightSamples.length;
                    const dR = darkSamples.reduce((s, c) => s + c.r, 0) / darkSamples.length;
                    const dG = darkSamples.reduce((s, c) => s + c.g, 0) / darkSamples.length;
                    const dB = darkSamples.reduce((s, c) => s + c.b, 0) / darkSamples.length;
                    // Both groups must be desaturated (gray-ish): max - min < 30
                    const lightSat = Math.max(lR, lG, lB) - Math.min(lR, lG, lB);
                    const darkSat = Math.max(dR, dG, dB) - Math.min(dR, dG, dB);
                    if (lightSat < 30 && darkSat < 30) {
                        bgIsCheckerboard = true;
                        bgLight = { r: lR, g: lG, b: lB };
                        bgDark = { r: dR, g: dG, b: dB };
                    }
                }
            }

            const isBackgroundPixel = (r, g, b, a) => {
                if (a <= cropConfig.alphaThreshold) return true;
                if (bgIsCheckerboard) {
                    const dLight = Math.sqrt(
                        (r - bgLight.r) * (r - bgLight.r) +
                        (g - bgLight.g) * (g - bgLight.g) +
                        (b - bgLight.b) * (b - bgLight.b),
                    );
                    const dDark = Math.sqrt(
                        (r - bgDark.r) * (r - bgDark.r) +
                        (g - bgDark.g) * (g - bgDark.g) +
                        (b - bgDark.b) * (b - bgDark.b),
                    );
                    return Math.min(dLight, dDark) < cropConfig.colorThreshold;
                }
                const dr = r - bgR;
                const dg = g - bgG;
                const db = b - bgB;
                const da = a - bgA;
                return Math.sqrt((dr * dr) + (dg * dg) + (db * db) + (da * da)) < cropConfig.colorThreshold;
            };

            let minX = width;
            let minY = height;
            let maxX = -1;
            let maxY = -1;
            let foregroundCount = 0;

            for (let y = 0; y < height; y += 1) {
                for (let x = 0; x < width; x += 1) {
                    const index = (y * width + x) * 4;
                    const r = data[index];
                    const g = data[index + 1];
                    const b = data[index + 2];
                    const alpha = data[index + 3];
                    if (isBackgroundPixel(r, g, b, alpha)) {
                        continue;
                    }

                    foregroundCount += 1;
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                }
            }

            if (maxX < minX || maxY < minY) {
                throw new Error('找不到可裁切的前景內容');
            }

            if (cropConfig.focus !== 'none' && cropConfig.maxContentRatio < 1) {
                const detectedWidth = maxX - minX + 1;
                const limitedWidth = Math.max(1, Math.round(detectedWidth * cropConfig.maxContentRatio));
                if (cropConfig.focus === 'left') {
                    maxX = Math.min(maxX, minX + limitedWidth - 1);
                } else if (cropConfig.focus === 'right') {
                    minX = Math.max(minX, maxX - limitedWidth + 1);
                }
            }

            const cropX = Math.max(0, minX - cropConfig.pad);
            const cropY = Math.max(0, minY - cropConfig.pad);
            const cropWidth = Math.min(width - cropX, (maxX - minX + 1) + (cropConfig.pad * 2));
            const cropHeight = Math.min(height - cropY, (maxY - minY + 1) + (cropConfig.pad * 2));

            const targetWidth = cropConfig.canvasWidth || cropWidth;
            const targetHeight = cropConfig.canvasHeight || cropHeight;
            const outputCanvas = document.createElement('canvas');
            outputCanvas.width = targetWidth;
            outputCanvas.height = targetHeight;
            const outputContext = outputCanvas.getContext('2d');
            outputContext.clearRect(0, 0, targetWidth, targetHeight);

            if (cropConfig.canvasWidth && cropConfig.canvasHeight) {
                const fitWidth = Math.max(1, targetWidth - (cropConfig.fitPadding * 2));
                const fitHeight = Math.max(1, targetHeight - (cropConfig.fitPadding * 2));
                const scale = Math.min(fitWidth / cropWidth, fitHeight / cropHeight);
                const drawWidth = Math.max(1, Math.round(cropWidth * scale));
                const drawHeight = Math.max(1, Math.round(cropHeight * scale));
                const drawX = Math.round((targetWidth - drawWidth) / 2);
                const drawY = Math.round((targetHeight - drawHeight) / 2);
                outputContext.drawImage(sourceCanvas, cropX, cropY, cropWidth, cropHeight, drawX, drawY, drawWidth, drawHeight);
            } else {
                outputContext.drawImage(sourceCanvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
            }

            if (cropConfig.fadeSide !== 'none' && cropConfig.fadeStartRatio < 1) {
                const fadeStart = Math.max(0, Math.min(targetWidth, Math.round(targetWidth * cropConfig.fadeStartRatio)));
                const gradient = cropConfig.fadeSide === 'right'
                    ? outputContext.createLinearGradient(fadeStart, 0, targetWidth, 0)
                    : outputContext.createLinearGradient(targetWidth - fadeStart, 0, 0, 0);

                if (cropConfig.fadeSide === 'right') {
                    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
                    gradient.addColorStop(1, 'rgba(0, 0, 0, 1)');
                    outputContext.save();
                    outputContext.globalCompositeOperation = 'destination-out';
                    outputContext.fillStyle = gradient;
                    outputContext.fillRect(fadeStart, 0, targetWidth - fadeStart, targetHeight);
                    outputContext.restore();
                } else {
                    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
                    gradient.addColorStop(1, 'rgba(0, 0, 0, 1)');
                    outputContext.save();
                    outputContext.globalCompositeOperation = 'destination-out';
                    outputContext.fillStyle = gradient;
                    outputContext.fillRect(0, 0, targetWidth - fadeStart, targetHeight);
                    outputContext.restore();
                }
            }

            const cleanup = {
                enabled: false,
                deterministicBackground: bgIsCheckerboard
                    ? (bgA >= cropConfig.defringeMinBackgroundAlpha)
                    : (bgA >= cropConfig.defringeMinBackgroundAlpha && backgroundSpread <= cropConfig.defringeMaxBackgroundSpread),
                removedPixels: 0,
                removedOuterRingPixels: 0,
                removedEdgeFringePixels: 0,
            };

            if (cropConfig.safeDefringe && cleanup.deterministicBackground) {
                const outputImageData = outputContext.getImageData(0, 0, targetWidth, targetHeight);
                const outputPixels = outputImageData.data;
                const ring = cropConfig.defringeRing;
                const rgbDistanceToBackground = (pixelIndex) => {
                    const r = outputPixels[pixelIndex];
                    const g = outputPixels[pixelIndex + 1];
                    const b = outputPixels[pixelIndex + 2];
                    if (bgIsCheckerboard) {
                        const dLight = Math.sqrt(
                            (r - bgLight.r) * (r - bgLight.r) +
                            (g - bgLight.g) * (g - bgLight.g) +
                            (b - bgLight.b) * (b - bgLight.b),
                        );
                        const dDark = Math.sqrt(
                            (r - bgDark.r) * (r - bgDark.r) +
                            (g - bgDark.g) * (g - bgDark.g) +
                            (b - bgDark.b) * (b - bgDark.b),
                        );
                        return Math.min(dLight, dDark);
                    }
                    const dr = r - bgR;
                    const dg = g - bgG;
                    const db = b - bgB;
                    return Math.sqrt((dr * dr) + (dg * dg) + (db * db));
                };
                const isInOuterRing = (x, y) => x < ring || y < ring || x >= targetWidth - ring || y >= targetHeight - ring;
                const hasTransparentNeighbor = (x, y) => {
                    for (let dy = -1; dy <= 1; dy += 1) {
                        for (let dx = -1; dx <= 1; dx += 1) {
                            if (dx === 0 && dy === 0) {
                                continue;
                            }
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx < 0 || ny < 0 || nx >= targetWidth || ny >= targetHeight) {
                                return true;
                            }
                            const neighborIndex = (ny * targetWidth + nx) * 4;
                            if (outputPixels[neighborIndex + 3] <= cropConfig.alphaThreshold) {
                                return true;
                            }
                        }
                    }
                    return false;
                };
                const isNearBackground = (pixelIndex) => outputPixels[pixelIndex + 3] > 0 && rgbDistanceToBackground(pixelIndex) <= cropConfig.defringeColorThreshold;
                const visited = new Uint8Array(targetWidth * targetHeight);
                const queue = [];
                const enqueue = (x, y) => {
                    if (x < 0 || y < 0 || x >= targetWidth || y >= targetHeight) {
                        return;
                    }
                    const offset = y * targetWidth + x;
                    if (visited[offset]) {
                        return;
                    }
                    const pixelIndex = offset * 4;
                    if (!isNearBackground(pixelIndex) || !hasTransparentNeighbor(x, y) && !isInOuterRing(x, y)) {
                        return;
                    }
                    visited[offset] = 1;
                    queue.push([x, y]);
                };

                for (let y = 0; y < targetHeight; y += 1) {
                    for (let x = 0; x < targetWidth; x += 1) {
                        enqueue(x, y);
                    }
                }

                while (queue.length > 0) {
                    const [x, y] = queue.shift();
                    const pixelIndex = (y * targetWidth + x) * 4;
                    if (outputPixels[pixelIndex + 3] > 0) {
                        outputPixels[pixelIndex] = 0;
                        outputPixels[pixelIndex + 1] = 0;
                        outputPixels[pixelIndex + 2] = 0;
                        outputPixels[pixelIndex + 3] = 0;
                        cleanup.removedPixels += 1;
                        if (isInOuterRing(x, y)) {
                            cleanup.removedOuterRingPixels += 1;
                        } else {
                            cleanup.removedEdgeFringePixels += 1;
                        }
                    }

                    const neighbors = [
                        [x + 1, y],
                        [x - 1, y],
                        [x, y + 1],
                        [x, y - 1],
                    ];
                    for (const [nx, ny] of neighbors) {
                        if (nx < 0 || ny < 0 || nx >= targetWidth || ny >= targetHeight) {
                            continue;
                        }
                        const offset = ny * targetWidth + nx;
                        if (visited[offset]) {
                            continue;
                        }
                        const neighborIndex = offset * 4;
                        if (!isNearBackground(neighborIndex)) {
                            continue;
                        }
                        visited[offset] = 1;
                        queue.push([nx, ny]);
                    }
                }

                for (let y = 0; y < targetHeight; y += 1) {
                    for (let x = 0; x < targetWidth; x += 1) {
                        const pixelIndex = (y * targetWidth + x) * 4;
                        const alpha = outputPixels[pixelIndex + 3];
                        if (alpha <= 0) {
                            continue;
                        }

                        const nearBackground = rgbDistanceToBackground(pixelIndex) <= cropConfig.defringeColorThreshold;
                        if (!nearBackground) {
                            continue;
                        }

                        const outerRingPixel = isInOuterRing(x, y);
                        const edgeFringePixel = alpha <= cropConfig.defringeAlphaCeiling && hasTransparentNeighbor(x, y);
                        if (!outerRingPixel && !edgeFringePixel) {
                            continue;
                        }

                        outputPixels[pixelIndex] = 0;
                        outputPixels[pixelIndex + 1] = 0;
                        outputPixels[pixelIndex + 2] = 0;
                        outputPixels[pixelIndex + 3] = 0;
                        cleanup.removedPixels += 1;
                        if (outerRingPixel) {
                            cleanup.removedOuterRingPixels += 1;
                        } else if (edgeFringePixel) {
                            cleanup.removedEdgeFringePixels += 1;
                        }
                    }
                }

                outputContext.putImageData(outputImageData, 0, 0);
                cleanup.enabled = true;
            }

            return {
                png: outputCanvas.toDataURL('image/png'),
                stats: {
                    inputWidth: width,
                    inputHeight: height,
                    background: {
                        r: Math.round(bgR),
                        g: Math.round(bgG),
                        b: Math.round(bgB),
                        a: Math.round(bgA),
                        spread: Number(backgroundSpread.toFixed(3)),
                        checkerboard: bgIsCheckerboard,
                        bgLight: bgIsCheckerboard ? { r: Math.round(bgLight.r), g: Math.round(bgLight.g), b: Math.round(bgLight.b) } : null,
                        bgDark: bgIsCheckerboard ? { r: Math.round(bgDark.r), g: Math.round(bgDark.g), b: Math.round(bgDark.b) } : null,
                    },
                    bounds: { minX, minY, maxX, maxY },
                    crop: { x: cropX, y: cropY, width: cropWidth, height: cropHeight },
                    output: { width: targetWidth, height: targetHeight },
                    foregroundCount,
                    cleanup,
                },
            };
        }, {
            src: dataUrl,
            config,
        });

        return result;
    } finally {
        await page.close();
    }
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    ensureArgs(options);

    const browserPath = resolveBrowser(options.browser);
    if (!browserPath) {
        console.error('[trim-png-by-background] 找不到可用瀏覽器');
        process.exit(1);
    }

    const browser = await puppeteer.launch({ executablePath: browserPath, headless: true });

    try {
        const inputPath = path.resolve(options.input);
        const outputPath = path.resolve(options.output);
        const result = await cropImage(browser, inputPath, {
            colorThreshold: options.colorThreshold,
            alphaThreshold: options.alphaThreshold,
            pad: options.pad,
            fitPadding: options.fitPadding,
            focus: options.focus,
            maxContentRatio: options.maxContentRatio,
            fadeSide: options.fadeSide,
            fadeStartRatio: options.fadeStartRatio,
            safeDefringe: options.safeDefringe,
            defringeRing: 2,
            defringeColorThreshold: Math.max(options.colorThreshold + 10, 38),
            defringeAlphaCeiling: 128,
            defringeMinBackgroundAlpha: 180,
            defringeMaxBackgroundSpread: 14,
            canvasWidth: options.canvasWidth,
            canvasHeight: options.canvasHeight,
        });

        const base64 = result.png.replace(/^data:image\/png;base64,/, '');
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, base64, 'base64');

        console.log(`[trim-png-by-background] 已輸出 ${outputPath}`);
        if (options.report) {
            console.log(JSON.stringify(result.stats, null, 2));
        }
    } finally {
        await browser.close();
    }
}

main().catch((error) => {
    console.error('[trim-png-by-background] 失敗:', error instanceof Error ? error.message : error);
    process.exit(1);
});