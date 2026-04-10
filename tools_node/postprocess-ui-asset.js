#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

let puppeteer;
try {
  puppeteer = require('puppeteer-core');
} catch (error) {
  console.error('[postprocess-ui-asset] 缺少依賴 puppeteer-core');
  process.exit(1);
}

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TRIM_SCRIPT = path.join(PROJECT_ROOT, 'tools_node', 'trim-png-by-background.js');

function parseArgs(argv) {
  const options = {
    spriteType: 'simple',
    strict: false,
    skipTrim: false,
    targetLongEdge: 0,
    autoDetectBorder: false,
    alphaThreshold: 12,
    colorThreshold: 28,
    pad: 24,
    fitPadding: 24,
    fadeSide: 'none',
    fadeStartRatio: 1,
    maxEdgeAlphaPixels: 0,
    maxOuterRingAlphaPixels: 8,
    minOccupancyRatio: 0.02,
    maxOccupancyRatio: 0.92,
    browser: '',
    report: '',
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
      case '--sprite-type':
        options.spriteType = next;
        index += 1;
        break;
      case '--target-long-edge':
        options.targetLongEdge = Number(next);
        index += 1;
        break;
      case '--border':
        options.border = next;
        index += 1;
        break;
      case '--auto-detect-border':
        options.autoDetectBorder = true;
        break;
      case '--alpha-threshold':
        options.alphaThreshold = Number(next);
        index += 1;
        break;
      case '--color-threshold':
        options.colorThreshold = Number(next);
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
      case '--fade-side':
        options.fadeSide = next;
        index += 1;
        break;
      case '--fade-start-ratio':
        options.fadeStartRatio = Number(next);
        index += 1;
        break;
      case '--max-edge-alpha-pixels':
        options.maxEdgeAlphaPixels = Number(next);
        index += 1;
        break;
      case '--max-outer-ring-alpha-pixels':
        options.maxOuterRingAlphaPixels = Number(next);
        index += 1;
        break;
      case '--min-occupancy-ratio':
        options.minOccupancyRatio = Number(next);
        index += 1;
        break;
      case '--max-occupancy-ratio':
        options.maxOccupancyRatio = Number(next);
        index += 1;
        break;
      case '--browser':
        options.browser = next;
        index += 1;
        break;
      case '--report':
        options.report = next;
        index += 1;
        break;
      case '--strict':
        options.strict = true;
        break;
      case '--skip-trim':
        options.skipTrim = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      default:
        break;
    }
  }

  return options;
}

function printHelp() {
  console.log([
    '用法：',
    '  node tools_node/postprocess-ui-asset.js --input <raw.png> --output <processed.png> [options]',
    '',
    '常用選項：',
    '  --canvas-width <n> --canvas-height <n>   指定輸出畫布尺寸',
    '  --sprite-type <simple|sliced|tiled>      預期 spriteType',
    '  --border <t,r,b,l>                       sliced 資產的 nine-slice border',
    '  --auto-detect-border                     sliced 時用 heuristic 推導 border',
    '  --fit-padding <n>                        trim 後置中 fit 的 padding',
    '  --fade-side <none|left|right>           交給 trim 保留單側 fade',
    '  --fade-start-ratio <n>                   fade 起始比例，0~1',
    '  --report <file>                          輸出 JSON report',
    '  --strict                                 有 failure 時 exit 1',
    '  --skip-trim                              跳過 trim，直接驗證 output',
  ].join('\n'));
}

function ensureArgs(options) {
  if (!options.input || !options.output) {
    printHelp();
    process.exit(1);
  }
  if (!fs.existsSync(options.input)) {
    console.error(`[postprocess-ui-asset] 找不到輸入檔案: ${options.input}`);
    process.exit(1);
  }
  if (!['simple', 'sliced', 'tiled'].includes(options.spriteType)) {
    console.error('[postprocess-ui-asset] --sprite-type 只能是 simple / sliced / tiled');
    process.exit(1);
  }
  if (!['none', 'left', 'right'].includes(options.fadeSide)) {
    console.error('[postprocess-ui-asset] --fade-side 只能是 none / left / right');
    process.exit(1);
  }
  if ((options.canvasWidth && !options.canvasHeight) || (!options.canvasWidth && options.canvasHeight)) {
    console.error('[postprocess-ui-asset] canvas width / height 必須同時提供');
    process.exit(1);
  }
  if (options.targetLongEdge && (options.canvasWidth || options.canvasHeight)) {
    console.error('[postprocess-ui-asset] --target-long-edge 與 --canvas-width/--canvas-height 只能擇一');
    process.exit(1);
  }
  if (!(options.fadeStartRatio > 0 && options.fadeStartRatio <= 1)) {
    console.error('[postprocess-ui-asset] --fade-start-ratio 必須介於 0 到 1');
    process.exit(1);
  }
}

function parseBorder(borderValue) {
  if (!borderValue) return null;
  const values = String(borderValue).split(',').map((value) => Number(value.trim()));
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
    throw new Error('border 格式錯誤，應為 top,right,bottom,left');
  }
  return values;
}

function resolveBrowser(preferred) {
  const candidates = [
    preferred,
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

function parseTrimStats(stdout) {
  const jsonStart = stdout.indexOf('{');
  if (jsonStart < 0) {
    return null;
  }
  try {
    return JSON.parse(stdout.slice(jsonStart));
  } catch (error) {
    return null;
  }
}

function runTrim(options, override = {}) {
  const inputPath = override.input || options.input;
  const outputPath = override.output || options.output;
  const canvasWidth = override.canvasWidth ?? options.canvasWidth;
  const canvasHeight = override.canvasHeight ?? options.canvasHeight;

  const args = [TRIM_SCRIPT, '--input', inputPath, '--output', outputPath, '--report'];
  if (canvasWidth && canvasHeight) {
    args.push('--canvas-width', String(canvasWidth), '--canvas-height', String(canvasHeight));
  }
  args.push('--color-threshold', String(options.colorThreshold));
  args.push('--alpha-threshold', String(options.alphaThreshold));
  args.push('--pad', String(options.pad));
  args.push('--fit-padding', String(options.fitPadding));
  args.push('--fade-side', String(options.fadeSide || 'none'));
  args.push('--fade-start-ratio', String(options.fadeStartRatio));
  if (options.browser) {
    args.push('--browser', options.browser);
  }

  const result = spawnSync(process.execPath, args, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'trim-png-by-background.js 執行失敗');
  }

  return parseTrimStats(result.stdout || '');
}

function deriveCanvasFromTrimStats(trimStats, targetLongEdge) {
  const sourceWidth = trimStats?.crop?.width || trimStats?.output?.width || trimStats?.inputWidth || 0;
  const sourceHeight = trimStats?.crop?.height || trimStats?.output?.height || trimStats?.inputHeight || 0;
  if (!(sourceWidth > 0) || !(sourceHeight > 0) || !(targetLongEdge > 0)) {
    return null;
  }
  const scale = targetLongEdge / Math.max(sourceWidth, sourceHeight);
  return {
    canvasWidth: Math.max(1, Math.round(sourceWidth * scale)),
    canvasHeight: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

function suggestSlicedBorder(analysis) {
  if (!analysis?.bounds) {
    return null;
  }
  const top = Math.max(1, Math.round(analysis.bounds.minY));
  const right = Math.max(1, Math.round(analysis.width - 1 - analysis.bounds.maxX));
  const bottom = Math.max(1, Math.round(analysis.height - 1 - analysis.bounds.maxY));
  const left = Math.max(1, Math.round(analysis.bounds.minX));
  return [
    Math.min(top, Math.floor(analysis.height / 2)),
    Math.min(right, Math.floor(analysis.width / 2)),
    Math.min(bottom, Math.floor(analysis.height / 2)),
    Math.min(left, Math.floor(analysis.width / 2)),
  ];
}

async function analyzeImage(browser, imagePath, alphaThreshold) {
  const page = await browser.newPage();
  const buffer = fs.readFileSync(imagePath);
  const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;

  try {
    return await page.evaluate(async ({ src, alphaThreshold: threshold }) => {
      const loadImage = (url) => new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = url;
      });

      const image = await loadImage(src);
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);

      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      let opaquePixels = 0;
      let semiTransparentPixels = 0;
      let edgeAlphaPixels = 0;
      let outerRingAlphaPixels = 0;

      const isOuterRing = (x, y, ring) => x < ring || y < ring || x >= width - ring || y >= height - ring;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const index = (y * width + x) * 4;
          const alpha = data[index + 3];
          if (alpha <= threshold) {
            continue;
          }

          opaquePixels += 1;
          if (alpha < 255) {
            semiTransparentPixels += 1;
          }
          if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
            edgeAlphaPixels += 1;
          }
          if (isOuterRing(x, y, 2)) {
            outerRingAlphaPixels += 1;
          }

          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }

      const bounds = maxX >= minX && maxY >= minY
        ? { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 }
        : null;
      const canvasArea = width * height;
      const occupancyRatio = canvasArea > 0 ? opaquePixels / canvasArea : 0;
      return {
        width,
        height,
        opaquePixels,
        semiTransparentPixels,
        edgeAlphaPixels,
        outerRingAlphaPixels,
        occupancyRatio,
        bounds,
      };
    }, { src: dataUrl, alphaThreshold });
  } finally {
    await page.close();
  }
}

function validateReport(options, analysis, border, suggestedBorder) {
  const failures = [];
  const warnings = [];

  if (options.canvasWidth && analysis.width !== options.canvasWidth) {
    failures.push(`輸出寬度 ${analysis.width} 與預期 ${options.canvasWidth} 不符`);
  }
  if (options.canvasHeight && analysis.height !== options.canvasHeight) {
    failures.push(`輸出高度 ${analysis.height} 與預期 ${options.canvasHeight} 不符`);
  }
  if (!analysis.bounds) {
    failures.push('輸出圖找不到有效前景內容');
  }

  if (options.spriteType === 'sliced') {
    if (!border) {
      failures.push('spriteType=sliced 但未提供 --border');
      if (suggestedBorder) {
        warnings.push(`heuristic 建議 border=${suggestedBorder.join(',')}，目前仍需人工確認`);
      }
    } else {
      for (const value of border) {
        if (!Number.isInteger(value)) {
          failures.push(`nine-slice border 含非整數值: ${border.join(',')}`);
          break;
        }
      }
      if (border && analysis.bounds) {
        const maxHorizontal = Math.floor(analysis.width / 2);
        const maxVertical = Math.floor(analysis.height / 2);
        if (border[1] > maxHorizontal || border[3] > maxHorizontal || border[0] > maxVertical || border[2] > maxVertical) {
          failures.push(`nine-slice border ${border.join(',')} 超出輸出尺寸可接受範圍`);
        }
      }
    }
  }

  if (analysis.edgeAlphaPixels > options.maxEdgeAlphaPixels) {
    warnings.push(`最外圈殘留 alpha 像素 ${analysis.edgeAlphaPixels}，超過閾值 ${options.maxEdgeAlphaPixels}`);
  }
  if (analysis.outerRingAlphaPixels > options.maxOuterRingAlphaPixels) {
    warnings.push(`外圈 2px 殘留 alpha 像素 ${analysis.outerRingAlphaPixels}，超過閾值 ${options.maxOuterRingAlphaPixels}`);
  }
  if (analysis.occupancyRatio < options.minOccupancyRatio) {
    warnings.push(`內容佔比 ${analysis.occupancyRatio.toFixed(3)} 過低，可能 trim 過度或原圖過小`);
  }
  if (analysis.occupancyRatio > options.maxOccupancyRatio) {
    warnings.push(`內容佔比 ${analysis.occupancyRatio.toFixed(3)} 過高，可能貼邊或侵入 slot 安全區`);
  }

  return { failures, warnings };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  ensureArgs(options);
  const border = parseBorder(options.border);

  const browserPath = resolveBrowser(options.browser);
  if (!browserPath) {
    throw new Error('找不到可用瀏覽器');
  }

  const inputPath = path.resolve(options.input);
  const outputPath = path.resolve(options.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  let trimStats = null;
  if (options.skipTrim) {
    if (inputPath !== outputPath) {
      fs.copyFileSync(inputPath, outputPath);
    }
  } else {
    if (options.targetLongEdge > 0 && !options.canvasWidth && !options.canvasHeight) {
      const probePath = `${outputPath}.probe.png`;
      const probeTrimStats = runTrim({ ...options, input: inputPath, output: outputPath, browser: browserPath }, { output: probePath });
      const derivedCanvas = deriveCanvasFromTrimStats(probeTrimStats, options.targetLongEdge);
      if (!derivedCanvas) {
        throw new Error('無法從 trim 結果推導 target-long-edge 對應輸出尺寸');
      }
      trimStats = runTrim({ ...options, input: inputPath, output: outputPath, browser: browserPath }, {
        canvasWidth: derivedCanvas.canvasWidth,
        canvasHeight: derivedCanvas.canvasHeight,
      });
      if (fs.existsSync(probePath)) {
        fs.unlinkSync(probePath);
      }
    } else {
      trimStats = runTrim({ ...options, input: inputPath, output: outputPath, browser: browserPath });
    }
  }

  const browser = await puppeteer.launch({ executablePath: browserPath, headless: true });
  try {
    const analysis = await analyzeImage(browser, outputPath, options.alphaThreshold);
    const suggestedBorder = options.spriteType === 'sliced' ? suggestSlicedBorder(analysis) : null;
    const effectiveBorder = border || (options.autoDetectBorder ? suggestedBorder : null);
    const verdict = validateReport(options, analysis, effectiveBorder, suggestedBorder);
    const report = {
      reportVersion: '1.0',
      generatedAt: new Date().toISOString(),
      input: path.relative(PROJECT_ROOT, inputPath),
      output: path.relative(PROJECT_ROOT, outputPath),
      spriteType: options.spriteType,
      requestedTargetLongEdge: options.targetLongEdge || null,
      requestedBorder: border,
      border: effectiveBorder,
      borderSource: border ? 'explicit' : options.autoDetectBorder ? 'heuristic' : 'unset',
      suggestedBorder,
      trim: trimStats,
      analysis,
      failures: verdict.failures,
      warnings: verdict.warnings,
      status: verdict.failures.length > 0 ? 'fail' : (verdict.warnings.length > 0 ? 'pass-with-warnings' : 'pass'),
    };

    if (options.report) {
      const reportPath = path.isAbsolute(options.report)
        ? options.report
        : path.join(PROJECT_ROOT, options.report);
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    }

    console.log(`[postprocess-ui-asset] status=${report.status} output=${path.relative(PROJECT_ROOT, outputPath)}`);
    if (verdict.failures.length > 0) {
      for (const failure of verdict.failures) {
        console.error(`[postprocess-ui-asset] failure: ${failure}`);
      }
    }
    if (verdict.warnings.length > 0) {
      for (const warning of verdict.warnings) {
        console.warn(`[postprocess-ui-asset] warning: ${warning}`);
      }
    }

    if (verdict.failures.length > 0 && options.strict) {
      process.exit(1);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('[postprocess-ui-asset] 失敗:', error instanceof Error ? error.message : error);
  process.exit(1);
});