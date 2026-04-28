#!/usr/bin/env node
// doc_id: doc_other_0009 — recurring HTML -> UCUF workflow wrapper
'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { resolveSourcePackage, writeSourcePackageManifest, writeHtmlWithSourceCss } = require('./lib/html-to-ucuf/source-package');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const opts = {
    input: null,
    sourceDir: null,
    mainHtml: null,
    screenId: null,
    bundle: null,
    outDir: null,
    browser: null,
    viewport: '1920x1080',
    settleMs: 1500,
    contentContract: null,
    strictCoverage: 0.95,
    strictPixel: 0.95,
    skipCompare: false,
    skipOptimize: false,
    skipAnnotate: false,
    skipEditorCompare: false,
    noValidate: false,
    editorScreenshot: null,
    evolutionLog: null,
    help: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const next = () => argv[++i];
    switch (token) {
      case '--input': opts.input = next(); break;
      case '--source-dir': opts.sourceDir = next(); break;
      case '--main-html': opts.mainHtml = next(); break;
      case '--screen-id': opts.screenId = next(); break;
      case '--bundle': opts.bundle = next(); break;
      case '--out-dir': opts.outDir = next(); break;
      case '--browser': opts.browser = next(); break;
      case '--viewport': opts.viewport = next(); break;
      case '--settle-ms': opts.settleMs = parseInt(next(), 10) || 1500; break;
      case '--content-contract': opts.contentContract = next(); break;
      case '--strict-coverage': opts.strictCoverage = parseFloat(next()); break;
      case '--strict-pixel': opts.strictPixel = parseFloat(next()); break;
      case '--skip-compare': opts.skipCompare = true; break;
      case '--skip-optimize': opts.skipOptimize = true; break;
      case '--skip-annotate': opts.skipAnnotate = true; break;
      case '--skip-editor-compare': opts.skipEditorCompare = true; break;
      case '--no-validate': opts.noValidate = true; break;
      case '--editor-screenshot': opts.editorScreenshot = next(); break;
      case '--evolution-log': opts.evolutionLog = next(); break;
      case '--help':
      case '-h':
        opts.help = true;
        break;
      default:
        console.error(`[run-html-to-ucuf-workflow] unknown arg: ${token}`);
        process.exit(2);
    }
  }

  return opts;
}

function printHelp() {
  console.log(`Usage: node tools_node/run-html-to-ucuf-workflow.js \
  --source-dir <dir> --main-html <relative-html> --screen-id <id> --bundle <bundle> [options]

Legacy/debug:
  --input <html> --screen-id <id> --bundle <bundle> [options]

Options:
  --out-dir <dir>            output directory (default: artifacts/skill-test-html-to-ucuf/<screen-id>)
  --source-dir <dir>         v2 source package dir containing tokens/CSS/HTML
  --main-html <path>         main HTML relative to source-dir (required if ambiguous)
  --editor-screenshot <png>  Cocos Editor screenshot for final runtimeVsSource gate
  --skip-editor-compare      debug only: skip required v2 Editor visual gate
  --evolution-log <md>       rule evolution2 log path for failed runtime visual gate
  --browser <path>           Chrome / Edge executable path
  --viewport <WxH>           snapshot viewport (default: 1920x1080)
  --settle-ms <n>            render settle time for pre-render (default: 1500)
  --content-contract <json>  optional screen/content contract file for annotation
  --strict-coverage <0..1>   compare coverage gate (default: 0.95)
  --strict-pixel <0..1>      pixel diff gate (default: 0.95)
  --skip-annotate            skip annotate-html-bindings stage
  --skip-optimize            skip optimize-ucuf-layout stage
  --skip-compare             skip compare / pixel-diff stage
  --no-validate              skip validate-ui-specs during strict replay
`);
}

function rel(p) {
  return path.relative(ROOT, path.resolve(p)).replace(/\\/g, '/');
}

function ensureDir(dirPath) {
  fs.mkdirSync(path.resolve(dirPath), { recursive: true });
}

function readText(filePath) {
  return fs.readFileSync(path.resolve(filePath), 'utf8');
}

function readJsonIfExists(filePath) {
  const full = path.resolve(filePath);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, ''));
}

function detectInputShape(html) {
  const hasSemanticMarkers = /data-anchor|data-ucuf-id|data-name|data-contract|data-slot|data-ucuf-action/i.test(html);
  const hasDynamicDomSignals = /createElement|innerHTML\s*=|document\.|appendChild|insertAdjacentHTML|<script\b/i.test(html);
  return {
    hasSemanticMarkers,
    hasDynamicDomSignals,
    needsPrerender: !hasSemanticMarkers && hasDynamicDomSignals,
  };
}

function runNodeStep(label, scriptName, args, extraEnv) {
  console.log(`[run-html-to-ucuf-workflow] step=${label}`);
  const proc = cp.spawnSync(process.execPath, [path.resolve(ROOT, 'tools_node', scriptName), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: Object.assign({}, process.env, { DOM_TO_UI_TELEMETRY: '0' }, extraEnv || {}),
    shell: false,
  });
  if (proc.stdout) process.stdout.write(proc.stdout);
  if (proc.stderr) process.stderr.write(proc.stderr);
  return proc;
}

function extractIssues(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && (/blocker|strict mode|interaction-target-missing|manual-adapter-required|validate failed/i.test(line)));
}

function extractCompareMetrics(comparePngPath) {
  const pixel = readJsonIfExists(comparePngPath.replace(/\.png$/i, '.pixel-diff.json'));
  const coverage = readJsonIfExists(comparePngPath.replace(/\.png$/i, '.css-coverage.json'));
  return {
    coveragePercent: coverage && coverage.coveragePercent,
    pixelCoveragePercent: pixel && pixel.coveragePercent,
    adjustedCoverage: pixel && pixel.adjustedCoverage,
    waiverPixels: pixel && pixel.waiverPixels,
    heatmapPath: pixel && pixel.heatmapPng ? pixel.heatmapPng : comparePngPath.replace(/\.png$/i, '.pixel-diff.heatmap.png'),
  };
}

function extractPerfMetrics(layoutJsonPath) {
  const perf = readJsonIfExists(layoutJsonPath.replace(/\.json$/i, '.performance.json'));
  return {
    nodeCount: perf && perf.rendering ? perf.rendering.nodeCount : null,
    maxDepth: perf && perf.rendering ? perf.rendering.maxDepth : null,
    blockers: perf && perf.verdict ? perf.verdict.blockers || [] : [],
  };
}

function assessRuntimeReadiness(paths, sourceHtml) {
  const layoutPath = fs.existsSync(paths.finalLayout) ? paths.finalLayout : paths.optimizedLayout;
  const skinPath = fs.existsSync(paths.finalSkin) ? paths.finalSkin : paths.rawSkin;
  const layout = readJsonIfExists(layoutPath);
  const skin = readJsonIfExists(skinPath);
  const blockers = [];
  const warnings = [];
  const markerMatches = String(sourceHtml || '').match(/data-(slot|contract|panel|name|ucuf-id|ucuf-action)\b/gi) || [];
  const hasTabbedSource = /role\s*=\s*["']tab|class\s*=\s*["'][^"']*\btab\b|data-tab|tab-content|tabs\.jsx|switchTab/i.test(String(sourceHtml || ''));

  const stats = {
    sourceSemanticMarkerCount: markerMatches.length,
    hasTabbedSource,
    lazySlotCount: 0,
    childPanelCount: 0,
    placeholderSpriteCount: 0,
    unmappedColorCount: 0,
  };

  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.lazySlot) stats.lazySlotCount += 1;
    if (node.type === 'child-panel') stats.childPanelCount += 1;
    for (const child of node.children || []) walk(child);
  }
  if (layout) walk(layout.root || layout);

  for (const slot of Object.values((skin && skin.slots) || {})) {
    if (!slot || typeof slot !== 'object') continue;
    if (slot.kind === 'sprite-frame' && /sprites\/ui_common\/placeholder\/missing_sprite/i.test(String(slot.path || ''))) {
      stats.placeholderSpriteCount += 1;
    }
    if (slot.color === 'unmappedColor') stats.unmappedColorCount += 1;
  }

  if (stats.placeholderSpriteCount > 0) {
    blockers.push(`runtime-readiness: placeholder sprite slots remain (${stats.placeholderSpriteCount})`);
  }
  if (hasTabbedSource && stats.sourceSemanticMarkerCount < 4) {
    blockers.push('runtime-readiness: tabbed source is missing explicit data-slot/data-panel/data-contract markers');
  }
  if (hasTabbedSource && stats.lazySlotCount === 0 && stats.childPanelCount === 0) {
    blockers.push('runtime-readiness: tabbed layout has no lazySlot or child-panel mount points');
  }
  if (stats.unmappedColorCount > 0) {
    warnings.push(`runtime-readiness: unmappedColor fallback slots remain (${stats.unmappedColorCount})`);
  }

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    stats,
  };
}

function sanitizeUcufReadyHtml(filePath) {
  const full = path.resolve(filePath);
  if (!fs.existsSync(full)) return { rewrittenInlineHandlers: 0 };
  const before = fs.readFileSync(full, 'utf8');
  let rewrittenInlineHandlers = 0;
  const after = before.replace(/<[^>]+>/g, (tag) => {
    if (!/(data-ucuf-action|data-action)\s*=\s*/i.test(tag)) return tag;
    if (!/\sonclick\s*=\s*/i.test(tag)) return tag;
    const next = tag.replace(/\s+onclick\s*=\s*(?:"[^"]*"|'[^']*')/i, '');
    if (next !== tag) rewrittenInlineHandlers += 1;
    return next;
  });
  if (after !== before) fs.writeFileSync(full, after, 'utf8');
  return { rewrittenInlineHandlers };
}

function buildPaths(opts) {
  const outDir = path.resolve(opts.outDir || path.join(ROOT, 'artifacts', 'skill-test-html-to-ucuf', opts.screenId));
  const base = path.join(outDir, opts.screenId);
  return {
    outDir,
    renderedHtml: `${base}.rendered.html`,
    readyHtml: `${base}.ucuf-ready.html`,
    rawLayout: `${base}.raw.layout.json`,
    rawSkin: `${base}.raw.skin.json`,
    optimizedLayout: `${base}.optimized.layout.json`,
    finalLayout: `${base}.final.layout.json`,
    finalSkin: `${base}.final.skin.json`,
    sourcePackageManifest: `${base}.source-package.json`,
    sourceReadyHtml: `${base}.source-package.html`,
    comparePng: `${base}.compare.png`,
    htmlCocosVerdict: path.join(outDir, `${opts.screenId}.html-cocos-verdict.json`),
    annotateReport: `${base}.annotate-report.json`,
    optimizeReport: `${base}.optimize-report.json`,
    skinFixReport: `${base}.skin-autofix.json`,
    summary: `${base}.workflow-summary.json`,
  };
}

function buildSummary(args) {
  return {
    input: rel(args.opts.input),
    sourcePackage: args.sourcePackage && args.sourcePackage.manifest ? args.sourcePackage.manifest : null,
    screenId: args.opts.screenId,
    bundle: args.opts.bundle,
    detected: args.detected,
    paths: Object.fromEntries(Object.entries(args.paths).map(([k, v]) => [k, rel(v)])),
    steps: args.steps,
    metrics: args.metrics,
    verdict: args.verdict,
    generatedAt: new Date().toISOString(),
  };
}

function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    printHelp();
    return;
  }
  if ((!opts.input && !opts.sourceDir) || !opts.screenId || !opts.bundle) {
    printHelp();
    process.exit(2);
  }

  let sourcePackage = null;
  let inputPath;
  if (opts.sourceDir) {
    sourcePackage = resolveSourcePackage({ sourceDir: opts.sourceDir, mainHtml: opts.mainHtml });
    if (!sourcePackage.ok) {
      for (const error of sourcePackage.errors) console.error(`[run-html-to-ucuf-workflow] source package error: ${error}`);
      for (const warning of sourcePackage.warnings) console.warn(`[run-html-to-ucuf-workflow] source package warning: ${warning}`);
      process.exit(2);
    }
    inputPath = sourcePackage.mainHtmlPath;
    opts.input = inputPath;
  } else {
    inputPath = path.resolve(opts.input);
  }
  if (!fs.existsSync(inputPath)) {
    console.error(`[run-html-to-ucuf-workflow] input not found: ${inputPath}`);
    process.exit(2);
  }

  const sourceHtml = readText(inputPath);
  const detected = detectInputShape(sourceHtml);
  const paths = buildPaths(opts);
  ensureDir(paths.outDir);
  if (sourcePackage) {
    writeSourcePackageManifest(sourcePackage, paths.sourcePackageManifest, { screenId: opts.screenId, bundle: opts.bundle });
  }

  const steps = [];
  let workingHtml = inputPath;

  if (detected.needsPrerender) {
    const args = ['--input', inputPath, '--output', paths.renderedHtml, '--viewport', opts.viewport, '--settle-ms', String(opts.settleMs)];
    if (opts.browser) args.push('--browser', opts.browser);
    const proc = runNodeStep('render-html-snapshot', 'render-html-snapshot.js', args);
    steps.push({ step: 'render-html-snapshot', exitCode: proc.status ?? 1, ok: proc.status === 0 });
    if (proc.status !== 0) {
      writeSummaryAndExit(steps, detected, paths, opts, 1);
      return;
    }
    workingHtml = paths.renderedHtml;
  }

  if (sourcePackage) {
    const prepared = writeHtmlWithSourceCss({
      htmlPath: workingHtml,
      cssPath: sourcePackage.cssPath,
      outputPath: paths.sourceReadyHtml,
      cssLabel: sourcePackage.manifest.css,
    });
    workingHtml = prepared.outputPath;
    steps.push({ step: 'prepare-source-package-html', exitCode: 0, ok: true, cssBytes: prepared.cssBytes });
  }

  if (opts.skipAnnotate) {
    fs.copyFileSync(workingHtml, paths.readyHtml);
    steps.push({ step: 'prepare-ucuf-ready-html', exitCode: 0, ok: true, skipped: true });
  } else {
    const args = ['--html', workingHtml, '--screen-id', opts.screenId, '--apply', '--out', paths.readyHtml, '--report', paths.annotateReport];
    if (opts.contentContract) args.push('--content-contract', opts.contentContract);
    const proc = runNodeStep('annotate-html-bindings', 'annotate-html-bindings.js', args);
    steps.push({ step: 'annotate-html-bindings', exitCode: proc.status ?? 1, ok: proc.status === 0 });
    if (proc.status !== 0) {
      writeSummaryAndExit(steps, detected, paths, opts, 1);
      return;
    }
  }

  const sanitizeResult = sanitizeUcufReadyHtml(paths.readyHtml);
  steps.push({ step: 'sanitize-ucuf-ready-html', exitCode: 0, ok: true, rewrittenInlineHandlers: sanitizeResult.rewrittenInlineHandlers });

  const baseArgs = [
    '--input', paths.readyHtml,
    '--output', paths.rawLayout,
    '--skin-output', paths.rawSkin,
    '--screen-id', opts.screenId,
    '--bundle', opts.bundle,
    '--emit-screen-draft',
    '--emit-preload-manifest',
    '--emit-performance-report',
    '--emit-warnings',
    '--warn-only',
    '--no-backup',
  ];
  if (sourcePackage) baseArgs.push('--tokens-source', sourcePackage.tokensPath, '--source-css', sourcePackage.cssPath);
  if (opts.evolutionLog) baseArgs.push('--evolution-log', opts.evolutionLog);
  const baseProc = runNodeStep('dom-to-ui-json:raw', 'dom-to-ui-json.js', baseArgs);
  steps.push({ step: 'dom-to-ui-json:raw', exitCode: baseProc.status ?? 1, ok: baseProc.status === 0, issues: extractIssues((baseProc.stdout || '') + '\n' + (baseProc.stderr || '')) });
  if (baseProc.status !== 0) {
    writeSummaryAndExit(steps, detected, paths, opts, 1);
    return;
  }

  if (opts.skipOptimize) {
    fs.copyFileSync(paths.rawLayout, paths.optimizedLayout);
    steps.push({ step: 'optimize-ucuf-layout', exitCode: 0, ok: true, skipped: true });
  } else {
    const proc = runNodeStep('optimize-ucuf-layout', 'optimize-ucuf-layout.js', ['--input', paths.rawLayout, '--output', paths.optimizedLayout, '--report', paths.optimizeReport]);
    steps.push({ step: 'optimize-ucuf-layout', exitCode: proc.status ?? 1, ok: proc.status === 0 });
    if (proc.status !== 0) {
      writeSummaryAndExit(steps, detected, paths, opts, 1);
      return;
    }
  }

  const visualReview = paths.rawLayout.replace(/\.json$/i, '.visual-review.json');
  const skinArgs = ['--skin', paths.rawSkin, '--report', paths.skinFixReport];
  if (fs.existsSync(visualReview)) skinArgs.push('--visual-review', visualReview);
  const skinProc = runNodeStep('auto-fix-ucuf-skin', 'auto-fix-ucuf-skin.js', skinArgs);
  steps.push({ step: 'auto-fix-ucuf-skin', exitCode: skinProc.status ?? 1, ok: skinProc.status === 0 });
  if (skinProc.status !== 0) {
    writeSummaryAndExit(steps, detected, paths, opts, 1);
    return;
  }

  const strictArgs = [
    '--layout-input', paths.optimizedLayout,
    '--skin-input', paths.rawSkin,
    '--output', paths.finalLayout,
    '--skin-output', paths.finalSkin,
    '--screen-id', opts.screenId,
    '--bundle', opts.bundle,
    '--emit-screen-draft',
    '--emit-preload-manifest',
    '--emit-performance-report',
    '--emit-warnings',
    '--strict',
    '--no-backup',
  ];
  if (sourcePackage) strictArgs.push('--tokens-source', sourcePackage.tokensPath, '--source-css', sourcePackage.cssPath);
  if (!opts.noValidate) strictArgs.push('--validate');
  const strictProc = runNodeStep('dom-to-ui-json:strict-replay', 'dom-to-ui-json.js', strictArgs);
  steps.push({ step: 'dom-to-ui-json:strict-replay', exitCode: strictProc.status ?? 1, ok: strictProc.status === 0, issues: extractIssues((strictProc.stdout || '') + '\n' + (strictProc.stderr || '')) });

  let compareProc = { status: 0, stdout: '', stderr: '' };
  if (!opts.skipCompare) {
    const compareArgs = [
      '--html', paths.readyHtml,
      '--layout', fs.existsSync(paths.finalLayout) ? paths.finalLayout : paths.optimizedLayout,
      '--skin', fs.existsSync(paths.finalSkin) ? paths.finalSkin : paths.rawSkin,
      '--screen-id', opts.screenId,
      '--output', paths.comparePng,
      '--save-panels', path.join(paths.outDir, 'compare-panels'),
      '--strict-coverage', String(opts.strictCoverage),
      '--strict-pixel', String(opts.strictPixel),
    ];
    if (opts.browser) compareArgs.push('--browser', opts.browser);
    if (sourcePackage) compareArgs.push('--tokens', sourcePackage.tokensPath);
    compareProc = runNodeStep('dom-to-ui-compare', 'dom-to-ui-compare.js', compareArgs);
    steps.push({ step: 'dom-to-ui-compare', exitCode: compareProc.status ?? 1, ok: compareProc.status === 0, issues: extractIssues((compareProc.stdout || '') + '\n' + (compareProc.stderr || '')) });
  }

  let editorCompareProc = null;
  if (sourcePackage && !opts.skipEditorCompare && opts.editorScreenshot) {
    const editorArgs = [
      '--source-dir', sourcePackage.sourceDir,
      '--main-html', sourcePackage.manifest.mainHtml,
      '--screen-id', opts.screenId,
      '--editor-screenshot', opts.editorScreenshot,
      '--output', paths.outDir,
      '--threshold', '0.95',
    ];
    if (opts.browser) editorArgs.push('--browser', opts.browser);
    if (opts.evolutionLog) editorArgs.push('--evolution-log', opts.evolutionLog);
    editorCompareProc = runNodeStep('compare-html-to-cocos-editor', 'compare-html-to-cocos-editor.js', editorArgs);
    steps.push({ step: 'compare-html-to-cocos-editor', exitCode: editorCompareProc.status ?? 1, ok: editorCompareProc.status === 0, issues: extractIssues((editorCompareProc.stdout || '') + '\n' + (editorCompareProc.stderr || '')) });
  } else if (sourcePackage && !opts.skipEditorCompare) {
    steps.push({ step: 'compare-html-to-cocos-editor', exitCode: 2, ok: false, issues: ['editor-screenshot-required'] });
  }

  const metrics = {
    raw: extractPerfMetrics(paths.rawLayout),
    optimized: Object.assign({}, readJsonIfExists(paths.optimizeReport) || {}, { perf: extractPerfMetrics(paths.optimizedLayout) }),
    final: extractPerfMetrics(fs.existsSync(paths.finalLayout) ? paths.finalLayout : paths.optimizedLayout),
    compare: opts.skipCompare ? null : extractCompareMetrics(paths.comparePng),
    htmlCocos: readJsonIfExists(paths.htmlCocosVerdict),
  };
  metrics.runtimeReadiness = assessRuntimeReadiness(paths, sourceHtml);
  const editorGatePass = !sourcePackage
    ? true
    : !!(metrics.htmlCocos && metrics.htmlCocos.runtimeVsSource && metrics.htmlCocos.runtimeVsSource.verdict === 'pass');
  const verdict = {
    rawPass: baseProc.status === 0,
    strictReplayPass: strictProc.status === 0,
    comparePass: opts.skipCompare ? true : compareProc.status === 0,
    editorVisualPass: editorGatePass,
    runtimeReadinessPass: metrics.runtimeReadiness.ok,
    workflowPass: baseProc.status === 0 && strictProc.status === 0 && (opts.skipCompare || compareProc.status === 0) && metrics.runtimeReadiness.ok && editorGatePass,
    remainingIssues: [
      ...extractIssues((strictProc.stdout || '') + '\n' + (strictProc.stderr || '')),
      ...extractIssues((compareProc.stdout || '') + '\n' + (compareProc.stderr || '')),
      ...(editorCompareProc ? extractIssues((editorCompareProc.stdout || '') + '\n' + (editorCompareProc.stderr || '')) : []),
      ...(sourcePackage && opts.skipEditorCompare ? ['editor-compare-skipped'] : []),
      ...(sourcePackage && !opts.skipEditorCompare && !opts.editorScreenshot ? ['editor-screenshot-required'] : []),
      ...metrics.runtimeReadiness.blockers,
    ],
  };

  const summary = buildSummary({ opts, sourcePackage, detected, paths, steps, metrics, verdict });
  fs.writeFileSync(paths.summary, JSON.stringify(summary, null, 2) + '\n', 'utf8');
  console.log(`[run-html-to-ucuf-workflow] summary=${rel(paths.summary)}`);
  console.log(`[run-html-to-ucuf-workflow] raw.nodeCount=${metrics.raw.nodeCount} optimized.nodeCount=${metrics.optimized.after || metrics.optimized.perf.nodeCount} final.nodeCount=${metrics.final.nodeCount}`);
  if (metrics.compare) {
    console.log(`[run-html-to-ucuf-workflow] compare.adjustedCoverage=${metrics.compare.adjustedCoverage}`);
  }
  if (metrics.runtimeReadiness.warnings.length) {
    for (const warning of metrics.runtimeReadiness.warnings) console.warn(`[run-html-to-ucuf-workflow] ${warning}`);
  }
  if (metrics.runtimeReadiness.blockers.length) {
    for (const blocker of metrics.runtimeReadiness.blockers) console.error(`[run-html-to-ucuf-workflow] ${blocker}`);
  }
  if (!verdict.workflowPass) {
    console.error('[run-html-to-ucuf-workflow] verdict=needs-review');
    process.exit(1);
  }
  console.log('[run-html-to-ucuf-workflow] verdict=pass');
}

function writeSummaryAndExit(steps, detected, paths, opts, code) {
  const summary = buildSummary({
    opts,
    detected,
    paths,
    steps,
    metrics: {
      raw: extractPerfMetrics(paths.rawLayout),
      optimized: readJsonIfExists(paths.optimizeReport),
      final: extractPerfMetrics(paths.finalLayout),
      compare: readJsonIfExists(paths.comparePng.replace(/\.png$/i, '.pixel-diff.json')),
      htmlCocos: readJsonIfExists(paths.htmlCocosVerdict),
    },
    verdict: {
      rawPass: steps.some(step => step.step === 'dom-to-ui-json:raw' && step.ok),
      strictReplayPass: steps.some(step => step.step === 'dom-to-ui-json:strict-replay' && step.ok),
      comparePass: steps.some(step => step.step === 'dom-to-ui-compare' && step.ok),
      workflowPass: false,
      remainingIssues: steps.flatMap(step => step.issues || []),
    },
  });
  fs.writeFileSync(paths.summary, JSON.stringify(summary, null, 2) + '\n', 'utf8');
  console.log(`[run-html-to-ucuf-workflow] summary=${rel(paths.summary)}`);
  process.exit(code);
}

main();