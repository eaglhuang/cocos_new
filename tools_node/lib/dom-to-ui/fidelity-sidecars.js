// doc_id: doc_other_0009 — M13/M18/M20 fidelity sidecar runner
// Runs a live browser computed-style pass and writes css-coverage,
// token-suggestions, and image-waivers sidecars for dom-to-ui-json.
'use strict';

const fs = require('fs');
const path = require('path');

const { captureComputedStyles } = require('./computed-style-capture');
const { buildTokenSuggestions } = require('./token-suggestion');
const { buildWaivers } = require('./image-waiver');
const { loadTokenRegistry } = require('./token-registry');
const { appendCssCapabilityCandidate } = require('./rule-evolution2');

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.CHROME_PATH,
].filter(Boolean);

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  process.env.EDGE_PATH,
].filter(Boolean);

function findBrowser() {
  for (const candidate of [...CHROME_CANDIDATES, ...EDGE_CANDIDATES]) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function toFileUrl(filePath) {
  return `file:///${path.resolve(filePath).replace(/\\/g, '/')}`;
}

async function waitForPageSettle(page) {
  try {
    await page.evaluate(() => document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve());
  } catch (_) { /* best-effort */ }
  await new Promise(resolve => setTimeout(resolve, 100));
}

function deriveSidecarPath(basePath, suffix) {
  return path.resolve(basePath).replace(/\.[^.]+$/i, suffix);
}

function flattenTokenColors(registry) {
  const out = {};
  for (const [name, value] of Object.entries((registry && registry.colors) || {})) {
    if (typeof value === 'string') out[name] = value;
  }
  return out;
}

async function buildFidelitySidecars(args) {
  const htmlPath = args.htmlPath;
  const outputBasePath = args.outputBasePath;
  if (!htmlPath || !outputBasePath) throw new Error('htmlPath and outputBasePath are required');

  const browserPath = args.browserPath || findBrowser();
  if (!browserPath) return { ok: false, skipped: true, reason: 'browser-not-found' };

  let puppeteer;
  try {
    puppeteer = require('puppeteer-core');
  } catch (_) {
    return { ok: false, skipped: true, reason: 'puppeteer-core-not-found' };
  }

  const viewport = args.viewport || { width: 1334, height: 750 };
  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-extensions', '--allow-file-access-from-files'],
  });

  let captureResult;
  try {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.goto(toFileUrl(htmlPath), { waitUntil: 'networkidle0', timeout: 30000 });
    await waitForPageSettle(page);
    captureResult = await captureComputedStyles(page);
    await page.close();
  } finally {
    await browser.close();
  }

  const written = {};
  if (args.emitCssCoverage !== false) {
    const coveragePath = deriveSidecarPath(outputBasePath, '.css-coverage.json');
    fs.writeFileSync(coveragePath, JSON.stringify(captureResult.coverage, null, 2) + '\n', 'utf8');
    written.cssCoveragePath = coveragePath;
    const capability = captureResult.coverage && captureResult.coverage.cssCapability;
    const unsupported = capability && capability.summary ? capability.summary.unsupported || 0 : 0;
    if (args.evolutionLog && unsupported > 0) {
      const candidate = appendCssCapabilityCandidate({
        logPath: args.evolutionLog,
        screenId: args.screenId,
        sourceDir: args.sourceDir || path.dirname(path.resolve(htmlPath)),
        mainHtml: path.basename(htmlPath),
        unsupportedCount: unsupported,
        assetizeCount: capability.summary.assetize || 0,
        topOffenders: (capability.topOffenders || []).filter(item => item.capability === 'unsupported').slice(0, 8),
      });
      written.cssCapabilityCandidatePath = candidate.logPath;
      written.cssCapabilitySuggestionId = candidate.suggestionId;
    }
  }

  let tokenSuggestions = null;
  if (args.emitTokenSuggestions !== false) {
    const registry = loadTokenRegistry({ sourcePath: args.tokensSource, runtimePath: args.tokensRuntime, handoffPath: args.tokensHandoff });
    tokenSuggestions = buildTokenSuggestions({ snapshots: captureResult.snapshots, tokenMap: flattenTokenColors(registry) });
    const tokenPath = deriveSidecarPath(outputBasePath, '.token-suggestions.json');
    fs.writeFileSync(tokenPath, JSON.stringify(tokenSuggestions, null, 2) + '\n', 'utf8');
    written.tokenSuggestionsPath = tokenPath;
  }

  let waiverReport = null;
  if (args.emitImageWaivers !== false) {
    waiverReport = buildWaivers({
      snapshots: captureResult.snapshots,
      repoRoot: args.repoRoot || path.resolve(__dirname, '..', '..', '..'),
      sourceDir: path.dirname(path.resolve(htmlPath)),
      screenId: args.screenId,
      manualWaiverPath: args.manualWaiverPath,
    });
    const waiverPath = deriveSidecarPath(outputBasePath, '.image-waivers.json');
    fs.writeFileSync(waiverPath, JSON.stringify(waiverReport, null, 2) + '\n', 'utf8');
    written.imageWaiversPath = waiverPath;
  }

  return {
    ok: true,
    skipped: false,
    browserPath,
    coverage: captureResult.coverage,
    snapshots: captureResult.snapshots,
    tokenSuggestions,
    waiverReport,
    written,
  };
}

function countTokenSuggestions(suggestions) {
  if (!suggestions) return 0;
  return ['colorSuggestions', 'fontSuggestions', 'spacingSuggestions']
    .reduce((sum, key) => sum + (Array.isArray(suggestions[key]) ? suggestions[key].length : 0), 0);
}

module.exports = {
  buildFidelitySidecars,
  countTokenSuggestions,
  deriveSidecarPath,
  findBrowser,
};