#!/usr/bin/env node
// HTML source package screenshot vs Cocos Editor screenshot visual gate.
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { PNG } = require('pngjs');

const { resolveSourcePackage, writeHtmlWithSourceCss } = require('./lib/html-to-ucuf/source-package');
const { pixelDiff, writeHeatmap } = require('./lib/dom-to-ui/pixel-diff');
const { buildCssCapabilityReport } = require('./lib/dom-to-ui/css-capability-matrix');
const { appendRuntimeVisualCandidate } = require('./lib/dom-to-ui/rule-evolution2');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const opts = {
    sourceDir: null,
    mainHtml: null,
    screenId: null,
    editorScreenshot: null,
    output: null,
    browser: null,
    viewport: '1920x1080',
    threshold: 0.95,
    tolerance: 12,
    editorCrop: null,
    sourceCrop: null,
    evolutionLog: null,
    noEvolution: false,
    help: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const next = () => argv[++i];
    switch (token) {
      case '--source-dir': opts.sourceDir = next(); break;
      case '--main-html': opts.mainHtml = next(); break;
      case '--screen-id': opts.screenId = next(); break;
      case '--editor-screenshot': opts.editorScreenshot = next(); break;
      case '--output': opts.output = next(); break;
      case '--browser': opts.browser = next(); break;
      case '--viewport': opts.viewport = next(); break;
      case '--threshold': opts.threshold = parseFloat(next()); break;
      case '--tolerance': opts.tolerance = parseInt(next(), 10); break;
      case '--editor-crop': opts.editorCrop = parseRect(next()); break;
      case '--source-crop': opts.sourceCrop = parseRect(next()); break;
      case '--evolution-log': opts.evolutionLog = next(); break;
      case '--no-evolution': opts.noEvolution = true; break;
      case '--help':
      case '-h':
        opts.help = true;
        break;
      default:
        console.error(`[compare-html-to-cocos-editor] unknown arg: ${token}`);
        process.exit(2);
    }
  }
  return opts;
}

function printHelp() {
  console.log(`Usage: node tools_node/compare-html-to-cocos-editor.js \
  --source-dir <dir> --main-html <relative-html> --screen-id <id> \
  --editor-screenshot <png> --output <dir> [options]

Options:
  --viewport <WxH>          HTML reference screenshot viewport (default: 1920x1080)
  --threshold <0..1>        pass threshold (default: 0.95)
  --tolerance <n>           RGB channel tolerance for pixel diff (default: 12)
  --editor-crop x,y,w,h     crop Editor screenshot before resize
  --source-crop x,y,w,h     crop source screenshot before compare
  --evolution-log <md>      append candidate here when score fails
  --no-evolution            do not append evolution candidate on failure
`);
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) return printHelp();
  if (!opts.sourceDir || !opts.screenId || !opts.editorScreenshot || !opts.output) {
    printHelp();
    process.exit(2);
  }
  if (!fs.existsSync(path.resolve(opts.editorScreenshot))) {
    console.error(`[compare-html-to-cocos-editor] editor screenshot not found: ${opts.editorScreenshot}`);
    process.exit(2);
  }

  const sourcePackage = resolveSourcePackage({ sourceDir: opts.sourceDir, mainHtml: opts.mainHtml });
  if (!sourcePackage.ok) {
    for (const error of sourcePackage.errors) console.error(`[compare-html-to-cocos-editor] source package error: ${error}`);
    process.exit(2);
  }

  const outDir = path.resolve(opts.output);
  fs.mkdirSync(outDir, { recursive: true });
  const base = path.join(outDir, opts.screenId);
  const preparedHtml = `${base}.html-cocos-source.html`;
  const sourcePng = `${base}.html-cocos-source.png`;
  const sourceNormalized = `${base}.html-cocos-source-normalized.png`;
  const editorNormalized = `${base}.html-cocos-editor-normalized.png`;
  const heatmapPng = `${base}.html-cocos-heatmap.png`;
  const comparePng = `${base}.html-cocos-compare.png`;
  const offendersJson = `${base}.html-cocos-top-offenders.json`;
  const verdictJson = `${base}.html-cocos-verdict.json`;

  writeHtmlWithSourceCss({
    htmlPath: sourcePackage.mainHtmlPath,
    cssPath: sourcePackage.cssPath,
    outputPath: preparedHtml,
    cssLabel: sourcePackage.manifest.css,
  });

  const viewport = parseViewport(opts.viewport);
  await captureHtml(preparedHtml, sourcePng, viewport, opts.browser);
  normalizePng(sourcePng, sourceNormalized, viewport.width, viewport.height, opts.sourceCrop);
  normalizePng(path.resolve(opts.editorScreenshot), editorNormalized, viewport.width, viewport.height, opts.editorCrop);

  const diff = pixelDiff(sourceNormalized, editorNormalized, { tolerance: opts.tolerance });
  writeHeatmap(diff.heatmap, heatmapPng);
  writeCompareBoard(sourceNormalized, editorNormalized, comparePng);

  const cssCapabilities = buildCssCapabilityReport(sourcePackage.cssText);
  const score = diff.adjustedCoverage;
  const pass = score >= opts.threshold;
  const topOffenders = cssCapabilities.topOffenders.map(item => ({
    property: item.property,
    kind: item.capability,
    count: item.count,
    impact: `css ${item.capability} occurrences=${item.count}`,
  }));
  fs.writeFileSync(offendersJson, JSON.stringify({ cssCapabilities, sourceWarnings: sourcePackage.warnings }, null, 2) + '\n', 'utf8');

  let evolution = null;
  if (!pass && !opts.noEvolution) {
    evolution = appendRuntimeVisualCandidate({
      logPath: opts.evolutionLog,
      screenId: opts.screenId,
      sourcePackage: sourcePackage.manifest,
      score,
      threshold: opts.threshold,
      topOffenders,
      proposedRule: '依 top offenders 補齊 CSS mapper、assetize 或 runtime skin layer 後重跑 HTML vs Cocos Editor visual gate。',
      verification: `node tools_node/compare-html-to-cocos-editor.js --source-dir "${sourcePackage.manifest.sourceDir}" --main-html "${sourcePackage.manifest.mainHtml}" --screen-id ${opts.screenId} --editor-screenshot <png> --output ${rel(outDir)}`,
    });
  }

  const verdict = {
    screenId: opts.screenId,
    generatedAt: new Date().toISOString(),
    sourcePackage: sourcePackage.manifest,
    runtimeVsSource: {
      score,
      threshold: opts.threshold,
      verdict: pass ? 'pass' : 'fail',
      source: 'html-source-screenshot-vs-cocos-editor-screenshot',
    },
    pixelDiff: {
      width: diff.width,
      height: diff.height,
      totalPixels: diff.totalPixels,
      matchedPixels: diff.matchedPixels,
      waiverPixels: diff.waiverPixels,
      coveragePercent: diff.coveragePercent,
      adjustedCoverage: diff.adjustedCoverage,
      tolerance: opts.tolerance,
    },
    artifacts: {
      preparedHtml: rel(preparedHtml),
      sourcePng: rel(sourcePng),
      sourceNormalized: rel(sourceNormalized),
      editorNormalized: rel(editorNormalized),
      comparePng: rel(comparePng),
      heatmapPng: rel(heatmapPng),
      topOffendersJson: rel(offendersJson),
      evolutionLog: evolution ? rel(evolution.logPath) : null,
    },
  };
  fs.writeFileSync(verdictJson, JSON.stringify(verdict, null, 2) + '\n', 'utf8');

  console.log(`[compare-html-to-cocos-editor] runtimeVsSource=${score.toFixed(4)} threshold=${opts.threshold} verdict=${verdict.runtimeVsSource.verdict}`);
  console.log(`[compare-html-to-cocos-editor] verdict=${rel(verdictJson)}`);
  if (!pass) process.exit(12);
}

async function captureHtml(htmlPath, outputPng, viewport, browserPath) {
  let puppeteer;
  try { puppeteer = require('puppeteer-core'); }
  catch (error) { throw new Error('puppeteer-core is required for HTML source screenshot'); }
  const browser = await puppeteer.launch({
    executablePath: browserPath || findBrowser(),
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-extensions', '--allow-file-access-from-files'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.goto(toFileUrl(htmlPath), { waitUntil: 'networkidle0', timeout: 30000 });
    try { await page.evaluate(() => document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()); } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 250));
    await page.screenshot({ path: outputPng, clip: { x: 0, y: 0, width: viewport.width, height: viewport.height } });
    await page.close();
  } finally {
    await browser.close();
  }
}

function normalizePng(inputPath, outputPath, targetW, targetH, crop) {
  const src = PNG.sync.read(fs.readFileSync(inputPath));
  const rect = crop || { x: 0, y: 0, w: src.width, h: src.height };
  const out = new PNG({ width: targetW, height: targetH });
  for (let y = 0; y < targetH; y += 1) {
    for (let x = 0; x < targetW; x += 1) {
      const sx = clamp(rect.x + Math.floor((x / targetW) * rect.w), 0, src.width - 1);
      const sy = clamp(rect.y + Math.floor((y / targetH) * rect.h), 0, src.height - 1);
      const si = (sy * src.width + sx) * 4;
      const oi = (y * targetW + x) * 4;
      out.data[oi] = src.data[si];
      out.data[oi + 1] = src.data[si + 1];
      out.data[oi + 2] = src.data[si + 2];
      out.data[oi + 3] = src.data[si + 3];
    }
  }
  fs.writeFileSync(outputPath, PNG.sync.write(out));
}

function writeCompareBoard(leftPath, rightPath, outputPath) {
  const left = PNG.sync.read(fs.readFileSync(leftPath));
  const right = PNG.sync.read(fs.readFileSync(rightPath));
  const w = Math.min(left.width, right.width);
  const h = Math.min(left.height, right.height);
  const out = new PNG({ width: w * 2, height: h });
  blit(left, out, 0, 0, w, h);
  blit(right, out, w, 0, w, h);
  fs.writeFileSync(outputPath, PNG.sync.write(out));
}

function blit(src, dst, dx, dy, w, h) {
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const si = (y * src.width + x) * 4;
      const di = ((dy + y) * dst.width + dx + x) * 4;
      dst.data[di] = src.data[si];
      dst.data[di + 1] = src.data[si + 1];
      dst.data[di + 2] = src.data[si + 2];
      dst.data[di + 3] = src.data[si + 3];
    }
  }
}

function findBrowser() {
  const candidates = [
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.EDGE_PATH,
    process.env.CHROME_PATH,
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Cannot find Chrome or Edge. Pass --browser <path>.');
}

function parseViewport(value) {
  const match = String(value || '').match(/^(\d+)x(\d+)$/i);
  if (!match) throw new Error(`invalid viewport: ${value}`);
  return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
}

function parseRect(value) {
  const nums = String(value || '').split(',').map(n => parseInt(n.trim(), 10));
  if (nums.length !== 4 || nums.some(n => !Number.isFinite(n))) throw new Error(`invalid rect: ${value}`);
  return { x: nums[0], y: nums[1], w: nums[2], h: nums[3] };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toFileUrl(filePath) {
  return encodeURI(`file:///${path.resolve(filePath).replace(/\\/g, '/')}`);
}

function rel(filePath) {
  return path.relative(ROOT, path.resolve(filePath)).replace(/\\/g, '/');
}

if (require.main === module) {
  main().catch(error => {
    console.error(`[compare-html-to-cocos-editor] ${error.stack || error.message || error}`);
    process.exit(1);
  });
}

module.exports = { normalizePng, parseViewport, parseRect };
