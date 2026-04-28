#!/usr/bin/env node
// doc_id: doc_other_0009 — Runtime Screen Diff (M34)
//
// Purpose:
//   Three-way visual comparison for a single screen migration. Produces:
//     - <screen>.runtime-compare.png    (side-by-side board)
//     - <screen>.runtime-compare.html   (interactive zoomable board)
//     - <screen>.runtime-verdict.json   (machine-readable scores)
//
// Three sources:
//   A. source HTML            — Design System / ui_kits / <kit>/index.html
//   B. UCUF JSON preview      — render-ucuf-layout.js output (NEW variant)
//   C. baseline / old screen  — optional --old <png> for cutover comparison
//
// Q: 「比對工具可以先行看到結果比對嗎?」
// A: YES. Even BEFORE the new variant is wired into runtime, this tool can
//    compare (A) source HTML vs (B) UCUF JSON preview using the existing
//    dom-to-ui-compare.js infrastructure. Once runtime is wired and we have
//    a real Cocos screenshot, pass it as --runtime <png> for true 3-way diff.
//
// Usage (preview-time, before wire-up):
//   node tools_node/runtime-screen-diff.js \
//     --screen character-ds3-main \
//     --html "Design System 2/ui_kits/character/index.html" \
//     --layout assets/resources/ui-spec/layouts/character-ds3-main.json \
//     --skin assets/resources/ui-spec/skins/character-ds3-default.json \
//     --output artifacts/runtime-diff/character-ds3
//
// Usage (post wire-up, with runtime screenshot):
//   ... add --runtime artifacts/screenshots/character-ds3-runtime.png
//          [--old artifacts/screenshots/general-detail-unified-runtime.png]

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const opts = {
    screen: null, html: null, layout: null, skin: null,
    runtime: null, old: null, output: null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--screen': opts.screen = next(); break;
      case '--html': opts.html = next(); break;
      case '--layout': opts.layout = next(); break;
      case '--skin': opts.skin = next(); break;
      case '--runtime': opts.runtime = next(); break;
      case '--old': opts.old = next(); break;
      case '--output': opts.output = next(); break;
      case '--help': case '-h':
        console.log('Usage: runtime-screen-diff.js --screen <id> --html <file> --layout <file> --skin <file> --output <dir> [--runtime <png>] [--old <png>]');
        process.exit(0);
        break;
      default:
        console.error(`[runtime-screen-diff] unknown arg: ${a}`); process.exit(2);
    }
  }
  if (!opts.screen || !opts.html || !opts.layout || !opts.output) {
    console.error('[runtime-screen-diff] --screen, --html, --layout, --output are required');
    process.exit(2);
  }
  return opts;
}

function runDomCompare(opts, comparePng) {
  const args = [
    'tools_node/dom-to-ui-compare.js',
    '--html', opts.html,
    '--layout', opts.layout,
    '--screen-id', opts.screen,
    '--output', comparePng,
  ];
  if (opts.skin) args.push('--skin', opts.skin);
  console.log('[runtime-screen-diff] dom-to-ui-compare:', args.slice(1).join(' '));
  try {
    execFileSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });
    return true;
  } catch (e) {
    console.warn('[runtime-screen-diff] dom-to-ui-compare failed; continuing with fallback report');
    return false;
  }
}

function readPixelDiffSidecar(comparePng) {
  // dom-to-ui-compare writes <comparePng-base>.pixel-diff.json beside the PNG.
  const dir = path.dirname(comparePng);
  const base = path.basename(comparePng, '.png');
  const sidecar = path.join(dir, `${base}.pixel-diff.json`);
  if (!fs.existsSync(sidecar)) return null;
  try { return JSON.parse(fs.readFileSync(sidecar, 'utf8')); } catch { return null; }
}

function buildHtmlBoard(opts, comparePng, runtimePng, oldPng) {
  const rel = (p) => p ? path.relative(path.dirname(comparePng), p).replace(/\\/g, '/') : null;
  const tiles = [];
  tiles.push({ label: 'Source HTML vs UCUF preview', src: rel(comparePng), kind: 'compare' });
  if (runtimePng) tiles.push({ label: 'Runtime screenshot (new)', src: rel(runtimePng), kind: 'runtime' });
  if (oldPng)     tiles.push({ label: 'Old variant (baseline)',  src: rel(oldPng), kind: 'old' });

  return `<!doctype html>
<html lang="zh-TW"><head><meta charset="utf-8">
<title>${opts.screen} — runtime diff</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 16px; background: #1a1a1a; color: #eee; }
  h1 { font-size: 16px; margin: 0 0 12px; }
  .grid { display: flex; gap: 16px; flex-wrap: wrap; }
  .tile { background: #252525; border: 1px solid #444; padding: 8px; }
  .tile h2 { font-size: 13px; margin: 0 0 6px; color: #ccc; }
  .tile img { max-width: 540px; display: block; image-rendering: pixelated; }
  .meta { font-size: 11px; color: #888; margin-top: 6px; }
</style></head>
<body>
<h1>${opts.screen} — runtime diff (M34)</h1>
<p class="meta">Generated ${new Date().toISOString()}. Pre-runtime preview uses dom-to-ui-compare for source vs UCUF JSON. Runtime PNG can be added with <code>--runtime</code> after wire-up.</p>
<div class="grid">
${tiles.map(t => `  <div class="tile"><h2>${t.label}</h2>${t.src ? `<img src="${t.src}" alt="${t.label}">` : '<em>(missing)</em>'}</div>`).join('\n')}
</div>
</body></html>`;
}

function main() {
  const opts = parseArgs(process.argv);
  const outDir = path.resolve(opts.output);
  fs.mkdirSync(outDir, { recursive: true });

  const comparePng = path.join(outDir, `${opts.screen}.runtime-compare.png`);
  const compareHtml = path.join(outDir, `${opts.screen}.runtime-compare.html`);
  const verdictJson = path.join(outDir, `${opts.screen}.runtime-verdict.json`);

  // 1. Run source-HTML vs UCUF compare
  const compareOk = runDomCompare(opts, comparePng);

  // 2. Read pixel-diff sidecar (written next to the compare PNG)
  const pixelDiff = readPixelDiffSidecar(comparePng);

  // 3. Build verdict
  const sourceVsUcuf = pixelDiff
    ? { score: pixelDiff.adjustedCoverage ?? pixelDiff.coveragePercent ?? null, source: 'dom-to-ui-compare.pixel-diff.json' }
    : { score: null, source: compareOk ? 'compare-ran-no-sidecar' : 'compare-failed' };

  const verdict = {
    screen: opts.screen,
    generatedAt: new Date().toISOString(),
    sourceVsUcuf,
    runtimeVsSource: opts.runtime ? { score: null, source: 'manual-pixel-diff-required', runtimePng: path.relative(ROOT, opts.runtime).replace(/\\/g, '/') } : null,
    runtimeVsOld: (opts.runtime && opts.old) ? { score: null, source: 'manual-pixel-diff-required' } : null,
    verdict: null,
    threshold: { pass: 0.95, warn: 0.85 },
    artifacts: {
      compareBoard: path.relative(ROOT, compareHtml).replace(/\\/g, '/'),
      comparePng:   path.relative(ROOT, comparePng).replace(/\\/g, '/'),
      runtimePng:   opts.runtime ? path.relative(ROOT, opts.runtime).replace(/\\/g, '/') : null,
      oldPng:       opts.old     ? path.relative(ROOT, opts.old).replace(/\\/g, '/') : null,
    },
  };

  if (opts.runtime) {
    verdict.verdict = 'pending-runtime-score';
    verdict.runtimeVsSource = {
      score: null,
      source: 'runtime-score-required-before-cutover',
      runtimePng: path.relative(ROOT, opts.runtime).replace(/\\/g, '/'),
    };
  } else {
    verdict.verdict = sourceVsUcuf.score == null ? 'pending' : (sourceVsUcuf.score >= 0.95 ? 'pass' : (sourceVsUcuf.score >= 0.85 ? 'warn' : 'fail'));
  }

  fs.writeFileSync(verdictJson, JSON.stringify(verdict, null, 2), 'utf8');
  fs.writeFileSync(compareHtml, buildHtmlBoard(opts, comparePng, opts.runtime, opts.old), 'utf8');

  console.log(`[runtime-screen-diff] verdict: ${verdict.verdict} (sourceVsUcuf=${verdict.sourceVsUcuf.score ?? 'n/a'})`);
  console.log(`[runtime-screen-diff] board:   ${path.relative(ROOT, compareHtml)}`);
  console.log(`[runtime-screen-diff] verdict: ${path.relative(ROOT, verdictJson)}`);
}

if (require.main === module) main();
module.exports = { buildHtmlBoard };
