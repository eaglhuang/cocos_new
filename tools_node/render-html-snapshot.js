#!/usr/bin/env node
// doc_id: doc_other_0009 — Render-with-browser helper for dom-to-ui-json.js
//
// Purpose:
//   Some HTML sources (React/Babel/Vue runtime) only contain a shell in the
//   static markup; the real DOM is produced by JavaScript at runtime.
//   `dom-to-ui-json.js` is a pure static parser, so it cannot see those nodes.
//   This helper opens the HTML in headless Chrome via puppeteer-core, waits for
//   the page to settle, and dumps `document.documentElement.outerHTML` to a
//   target file. The resulting snapshot can then be fed into `dom-to-ui-json.js`
//   exactly like a hand-authored static HTML.
//
// Usage:
//   node tools_node/render-html-snapshot.js \
//     --input  "Design System 3/ui_kits/character/index.html" \
//     --output "artifacts/skill-test-html-to-ucuf/character-ds3.rendered.html" \
//     [--viewport 1920x1080] [--settle-ms 1500] [--pre-eval "<js>"]
//
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function parseArgs(argv) {
  const opts = {
    input: null,
    output: null,
    viewport: '1920x1080',
    settleMs: 1500,
    preEval: null,
    browser: null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--input': opts.input = next(); break;
      case '--output': opts.output = next(); break;
      case '--viewport': opts.viewport = next(); break;
      case '--settle-ms': opts.settleMs = parseInt(next(), 10) || 1500; break;
      case '--pre-eval': opts.preEval = next(); break;
      case '--browser': opts.browser = next(); break;
      case '--help':
      case '-h':
        console.log('Usage: render-html-snapshot.js --input <html> --output <html> [--viewport WxH] [--settle-ms N] [--pre-eval <js>] [--browser <path>]');
        process.exit(0);
        break;
      default:
        console.error(`[render-html-snapshot] unknown arg: ${a}`);
        process.exit(2);
    }
  }
  if (!opts.input || !opts.output) {
    console.error('[render-html-snapshot] --input and --output are required');
    process.exit(2);
  }
  return opts;
}

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
];
const EDGE_CANDIDATES = [
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];

function findBrowser() {
  for (const p of [...CHROME_CANDIDATES, ...EDGE_CANDIDATES]) {
    if (p && fs.existsSync(p)) return p;
  }
  throw new Error('Cannot find Chrome or Edge. Pass --browser <path>.');
}

function toFileUrl(absPath) {
  return encodeURI(`file:///${path.resolve(absPath).replace(/\\/g, '/')}`);
}

function ensureBaseHref(html, baseHref) {
  if (/<base\s+href=/i.test(html)) return html;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>\n<base href="${baseHref}">`);
  }
  return `<head><base href="${baseHref}"></head>\n${html}`;
}

function inlineLocalBabelScripts(html, htmlDir) {
  return html.replace(
    /<script([^>]*\btype=["']text\/babel["'][^>]*)\bsrc=["']([^"']+)["']([^>]*)><\/script>/gi,
    (fullMatch, beforeSrc, src) => {
      if (/^(https?:|data:|file:|\/\/)/i.test(src)) return fullMatch;
      const scriptPath = path.resolve(htmlDir, src);
      if (!fs.existsSync(scriptPath)) return fullMatch;
      const code = fs.readFileSync(scriptPath, 'utf8');
      return `<script type="text/babel">\n${code}\n</script>`;
    }
  );
}

function prepareSource(sourceHtmlPath) {
  const absSourcePath = path.resolve(sourceHtmlPath);
  const sourceDir = path.dirname(absSourcePath);
  const baseHref = `${toFileUrl(sourceDir)}/`;
  let html = fs.readFileSync(absSourcePath, 'utf8');
  html = ensureBaseHref(html, baseHref);
  html = inlineLocalBabelScripts(html, sourceDir);
  const preparedPath = path.join(os.tmpdir(), `render-snap-${Date.now()}.html`);
  fs.writeFileSync(preparedPath, html, 'utf8');
  return preparedPath;
}

async function waitForPageSettle(page, timeoutMs) {
  try {
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: timeoutMs });
  } catch {}
  try {
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
    });
  } catch {}
  await new Promise(resolve => setTimeout(resolve, timeoutMs));
}

async function main() {
  const opts = parseArgs(process.argv);
  const [vw, vh] = opts.viewport.split('x').map(n => parseInt(n, 10));

  let puppeteer;
  try {
    puppeteer = require('puppeteer-core');
  } catch {
    console.error('[render-html-snapshot] puppeteer-core not found. Run: npm install');
    process.exit(1);
  }

  const browserPath = opts.browser || findBrowser();
  const preparedPath = prepareSource(opts.input);

  process.stdout.write(`[render-html-snapshot] launching browser... `);
  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-extensions', '--allow-file-access-from-files'],
  });

  let renderedHtml = null;
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: vw || 1920, height: vh || 1080 });
    await page.goto(toFileUrl(preparedPath), { waitUntil: 'networkidle0', timeout: 30000 });
    await waitForPageSettle(page, opts.settleMs);

    if (opts.preEval) {
      try {
        await page.evaluate(opts.preEval);
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        console.error(`\n[render-html-snapshot] --pre-eval failed: ${e.message}`);
      }
    }

    renderedHtml = await page.evaluate(() => document.documentElement.outerHTML);
    await page.close();
    process.stdout.write('rendered. ');
  } finally {
    await browser.close();
    try { fs.unlinkSync(preparedPath); } catch {}
  }

  const outDir = path.dirname(path.resolve(opts.output));
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  // Wrap as a complete document so downstream parsers see <html> root.
  const wrapped = `<!doctype html>\n<html>${renderedHtml.replace(/^<html[^>]*>|<\/html>$/gi, '')}</html>`;
  fs.writeFileSync(opts.output, wrapped, 'utf8');
  console.log(`[render-html-snapshot] wrote ${opts.output} (${wrapped.length} bytes)`);
}

main().catch(err => {
  console.error('[render-html-snapshot] error:', err && err.stack || err);
  process.exit(1);
});
