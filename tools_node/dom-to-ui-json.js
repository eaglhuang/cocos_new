#!/usr/bin/env node
// doc_id: doc_other_0009 — dom-to-ui-json main CLI (M5 focus: preload + performance + telemetry)
// 規格來源：docs/html_skill_plan.md (doc_other_0009) §4 / §27 / §35 / §36 / §37
//
// 目前實作範圍：
//   - 接受最小 HTML 解析（無 jsdom 依賴；可後續替換）
//   - 接受既有 layout/skin draft 作為輸入（--layout-input / --skin-input），方便 M5 / M6 測試
//   - 必有：preload manifest 輸出、performance report 輸出、telemetry append
//   - 維持 fail-fast 原則；strict 模式遇到 blocker 直接非 0 退出
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { spawnSync } = require('child_process');

const { buildPreloadManifest } = require('./lib/dom-to-ui/preload');
const { buildPerformanceReport } = require('./lib/dom-to-ui/performance');
const { checkAtlasBudget, detectDuplicateSprites } = require('./lib/dom-to-ui/atlas');
const { appendTelemetry } = require('./lib/dom-to-ui/telemetry');
const { buildDraftFromHtml } = require('./lib/dom-to-ui/draft-builder');
const { smartMerge } = require('./lib/dom-to-ui/smart-merge');
const {
  buildCompositeReport,
  buildBundleSuggestion,
  detectSkinLayerAtlasRisk,
  buildSyncReport,
  buildRGuardSummary,
  buildFragmentRoutePatch,
} = require('./lib/dom-to-ui/sidecar-emitters');
const { hasInteractionBlockers } = require('./lib/dom-to-ui/interaction-translator');
const { hasMotionBlockers } = require('./lib/dom-to-ui/motion-translator');
const { buildLogicInventory, verifyLogicGuard, readJsonIfExists, readTextIfExists } = require('./lib/dom-to-ui/logic-guard');
const { buildVisualReview } = require('./lib/dom-to-ui/visual-review');
const { createBackup } = require('./lib/dom-to-ui/backup');
const { buildFidelitySidecars, countTokenSuggestions } = require('./lib/dom-to-ui/fidelity-sidecars');

const TOOL_NAME = 'dom-to-ui-json';

function parseArgs(argv) {
  const opts = {
    input: null,
    output: null,
    skinOutput: null,
    screenId: null,
    rootName: null,
    bundle: null,
    defaultBundle: 'ui_common',
    variantMode: null,
    emitWarnings: false,
    emitScreenDraft: false,
    emitPreloadManifest: false,
    emitPerformanceReport: false,
    emitCompositeReport: true,
    emitBundleSuggestion: true,
    emitSyncReport: true,
    emitRGuard: true,
    emitFragmentRoutePatch: true,
    emitInteractionReport: true,
    emitMotionReport: true,
    emitLogicGuard: true,
    emitVisualReview: true,
    strict: false,
    warnOnly: false,
    validate: false,
    layoutInput: null,
    skinInput: null,
    screenInput: null,
    componentInput: null,
    logicBaseline: null,
    errorLog: null,
    spriteRegistry: null,
    syncExisting: false,
    mergeMode: 'preserve-human',
    conflictPolicy: 'warn',
    backup: true,
    backupDir: null,
    emitCssCoverage: true,
    strictCoverage: null,
    coverageBaseline: null,
    emitTokenSuggestions: true,
    strictTokens: null,
    emitImageWaivers: true,
    manualWaivers: null,
    browser: null,
    tokensSource: null,
    tokensRuntime: null,
    tokensHandoff: null,
    sourceCss: null,
    evolutionLog: null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--input': opts.input = next(); break;
      case '--output': opts.output = next(); break;
      case '--skin-output': opts.skinOutput = next(); break;
      case '--screen-id': opts.screenId = next(); break;
      case '--root-name': opts.rootName = next(); break;
      case '--bundle': opts.bundle = next(); break;
      case '--default-bundle': opts.defaultBundle = next(); break;
      case '--variant-mode': opts.variantMode = next(); break;
      case '--emit-warnings': opts.emitWarnings = true; break;
      case '--emit-screen-draft': opts.emitScreenDraft = true; break;
      case '--emit-preload-manifest': opts.emitPreloadManifest = true; break;
      case '--emit-performance-report': opts.emitPerformanceReport = true; break;
      case '--no-emit-composite-report': opts.emitCompositeReport = false; break;
      case '--no-emit-bundle-suggestion': opts.emitBundleSuggestion = false; break;
      case '--no-emit-sync-report': opts.emitSyncReport = false; break;
      case '--no-emit-r-guard': opts.emitRGuard = false; break;
      case '--no-emit-fragment-route-patch': opts.emitFragmentRoutePatch = false; break;
      case '--no-emit-interaction-report': opts.emitInteractionReport = false; break;
      case '--no-emit-motion-report': opts.emitMotionReport = false; break;
      case '--no-emit-logic-guard': opts.emitLogicGuard = false; break;
      case '--no-emit-visual-review': opts.emitVisualReview = false; break;
      case '--strict': opts.strict = true; break;
      case '--warn-only': opts.warnOnly = true; break;
      case '--validate': opts.validate = true; break;
      case '--layout-input': opts.layoutInput = next(); break;
      case '--skin-input': opts.skinInput = next(); break;
      case '--screen-input': opts.screenInput = next(); break;
      case '--component-input': opts.componentInput = next(); break;
      case '--logic-baseline': opts.logicBaseline = next(); break;
      case '--error-log': opts.errorLog = next(); break;
      case '--sprite-registry': opts.spriteRegistry = next(); break;
      case '--sync-existing': opts.syncExisting = true; break;
      case '--merge-mode': opts.mergeMode = next(); break;
      case '--conflict-policy': opts.conflictPolicy = next(); break;
      case '--no-backup': opts.backup = false; break;
      case '--backup-dir': opts.backupDir = next(); break;
      case '--no-css-coverage': opts.emitCssCoverage = false; break;
      case '--strict-coverage': opts.strictCoverage = parseFloat(next()); break;
      case '--coverage-baseline': opts.coverageBaseline = next(); break;
      case '--no-token-suggestions': opts.emitTokenSuggestions = false; break;
      case '--strict-tokens': opts.strictTokens = parseInt(next(), 10); break;
      case '--no-image-waivers': opts.emitImageWaivers = false; break;
      case '--manual-waivers': opts.manualWaivers = next(); break;
      case '--browser': opts.browser = next(); break;
      case '--tokens-source': opts.tokensSource = next(); break;
      case '--tokens-runtime': opts.tokensRuntime = next(); break;
      case '--tokens-handoff': opts.tokensHandoff = next(); break;
      case '--source-css': opts.sourceCss = next(); break;
      case '--evolution-log': opts.evolutionLog = next(); break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        if (a.startsWith('--')) {
          console.warn(`[${TOOL_NAME}] unknown flag: ${a}`);
        }
    }
  }
  return opts;
}

function printHelp() {
  console.log(`
${TOOL_NAME} — HTML to UCUF layout/skin/preload/performance generator (skeleton)

Usage:
  node tools_node/dom-to-ui-json.js \\
    --input <html> --output <layout.json> --skin-output <skin.json> \\
    --screen-id <id> --bundle <name> [options]

Required:
  --output <path>          layout JSON output path
  --skin-output <path>     skin JSON output path
  --screen-id <id>         screen identifier

Inputs (one of):
  --input <html>           HTML source file
  --layout-input <json>    pre-built layout draft (skip HTML parse)
  --skin-input <json>      pre-built skin draft (skip HTML parse)

Optional:
  --bundle <name>          primary bundle for the screen
  --default-bundle <name>  default bundle for sprites (default: ui_common)
  --variant-mode <mode>    variant preset, currently gacha-3pool
  --root-name <name>       root container name
  --sprite-registry <path> JSON registry of fileName -> {path}
  --screen-input <json>    existing screen spec for logic guard
  --component-input <ts>   existing CompositePanel / ChildPanel TS for logic guard
  --logic-baseline <json>  previous logic inventory for verify mode
  --error-log <log>        runtime log text for logic guard summary
  --emit-screen-draft      also emit a screen draft JSON
  --emit-preload-manifest  emit <screen>.preload.json (M5)
  --emit-performance-report emit <screen>.performance.json (M5)
  --strict                 fail on texture-memory-blocker / R24-exceeded etc
  --warn-only              record warnings but never fail
  --validate               run post-validate (currently records intent only)
  --sync-existing          read existing UCUF JSONs for incremental sync
  --merge-mode <m>         preserve-human | html-authoritative | dry-run
  --conflict-policy <p>    warn | fail
  --no-css-coverage        skip M13 computed-style coverage sidecar
  --strict-coverage <n>    exit 11 when coveragePercent is below n
  --coverage-baseline <p>  exit 11 when coverage regresses below baseline
  --no-token-suggestions   skip M18 token suggestion sidecar
  --strict-tokens <n>      exit 14 when token suggestion count is greater than n
  --no-image-waivers       skip M20 image waiver sidecar
  --manual-waivers <json>  merge manual image waivers into M20 sidecar
  --browser <path>         Chrome/Edge path for computed-style capture
  --tokens-source <json>   source package ui-design-tokens.json (highest priority)
  --tokens-runtime <json>  runtime token supplement override
  --tokens-handoff <json>  handoff token supplement override
  --source-css <css>       source package colors_and_type.css path for reporting
  --evolution-log <md>     append v2 CSS capability candidates when needed
  --help                   show help

Environment:
  DOM_TO_UI_TELEMETRY=1    enable telemetry append to artifacts/dom-to-ui-telemetry/
`);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(path.resolve(p), 'utf8'));
}

function writeJson(p, obj) {
  const full = path.resolve(p);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function deriveScreenSidecarPath(layoutOutputPath, suffix) {
  // assets/resources/ui-spec/layouts/foo.json -> assets/resources/ui-spec/screens/foo<suffix>
  // If user already aimed at a screens path, just swap extension.
  const dir = path.dirname(layoutOutputPath);
  const base = path.basename(layoutOutputPath, path.extname(layoutOutputPath));
  const screensDir = dir.replace(/[\\/]layouts$/, '/screens').replace(/\\layouts$/, '\\screens');
  const targetDir = screensDir.includes('screens') ? screensDir : dir;
  return path.join(targetDir, `${base}${suffix}`);
}

function pascal(s) {
  return String(s || 'Screen').replace(/(^|[-_\s]+)(\w)/g, (_, __, c) => c.toUpperCase());
}

function sha256(text) {
  return 'sha256:' + crypto.createHash('sha256').update(text).digest('hex').slice(0, 32);
}

function loadSpriteRegistry(p) {
  if (!p) return {};
  const full = path.resolve(p);
  if (!fs.existsSync(full)) return {};
  try { return readJson(full); } catch (_) { return {}; }
}

async function main(argv) {
  const startedAt = Date.now();
  const opts = parseArgs(argv);

  if (!opts.output || !opts.skinOutput) {
    console.error('[dom-to-ui-json] --output and --skin-output are required');
    process.exit(2);
  }
  if (!opts.screenId) {
    // Derive from output filename
    opts.screenId = path.basename(opts.output, path.extname(opts.output));
  }

  const warnings = [];
  let layoutDraft;
  let skinDraft;
  let inputBytes = 0;
  let inputHash = null;
  let inputPath = null;

  let compositeNodes = [];
  let interactionDraft = { screenId: opts.screenId, actions: [], warnings: [], summary: { actionCount: 0, missingTargetCount: 0, manualAdapterCount: 0 } };
  let motionDraft = { screenId: opts.screenId, motionTokens: {}, motions: [], warnings: [], summary: { motionCount: 0, tokenCount: 0, manualRewriteCount: 0 } };
  if (opts.layoutInput && opts.skinInput) {
    layoutDraft = readJson(opts.layoutInput);
    skinDraft = readJson(opts.skinInput);
    inputPath = opts.layoutInput;
  } else if (opts.input) {
    inputPath = opts.input;
    const html = fs.readFileSync(path.resolve(opts.input), 'utf8');
    inputBytes = Buffer.byteLength(html, 'utf8');
    inputHash = sha256(html);
    const parsed = buildDraftFromHtml(html, {
      screenId: opts.screenId,
      bundle: opts.bundle,
      defaultBundle: opts.defaultBundle,
      rootName: opts.rootName,
      tokensSource: opts.tokensSource,
      tokensRuntime: opts.tokensRuntime,
      tokensHandoff: opts.tokensHandoff,
    });
    layoutDraft = parsed.layoutDraft;
    skinDraft = parsed.skinDraft;
    compositeNodes = parsed.compositeNodes || [];
    interactionDraft = parsed.interactionDraft || interactionDraft;
    motionDraft = parsed.motionDraft || motionDraft;
    for (const w of parsed.warnings) warnings.push(w);
  } else {
    console.error('[dom-to-ui-json] one of --input or (--layout-input + --skin-input) is required');
    process.exit(2);
  }

  const variantInfo = applyVariantMode(layoutDraft, skinDraft, opts.variantMode, warnings);

  // Atlas / sprite analysis
  const atlasReport = checkAtlasBudget(skinDraft);
  if (atlasReport._warning) warnings.push({ code: atlasReport._warning.split(':')[0], detail: atlasReport._warning });
  skinDraft.meta = Object.assign({}, skinDraft.meta, { atlasUsageReport: atlasReport });

  const registry = loadSpriteRegistry(opts.spriteRegistry);
  const dupes = detectDuplicateSprites(skinDraft, registry);
  for (const d of dupes) warnings.push({ code: d.code, slotId: d.slotId, detail: d.currentPath });

  // M4 — sync-existing preserve-human merge
  let syncDelta = null;
  let syncBefore = null;
  let syncAfter = null;
  let logicBefore = null;
  const logicScreen = readJsonIfExists(opts.screenInput);
  const componentSource = readTextIfExists(opts.componentInput);
  const errorLogText = readTextIfExists(opts.errorLog);
  if (opts.syncExisting) {
    const existingLayout = fs.existsSync(path.resolve(opts.output)) ? readJson(opts.output) : null;
    const existingSkin = fs.existsSync(path.resolve(opts.skinOutput)) ? readJson(opts.skinOutput) : null;
    syncBefore = existingLayout;
    if (opts.emitLogicGuard && existingLayout) {
      logicBefore = buildLogicInventory({
        screenId: opts.screenId,
        layout: existingLayout,
        screen: logicScreen,
        screenPath: opts.screenInput,
        componentSource,
        componentPath: opts.componentInput,
      });
    }
    if (existingLayout || existingSkin) {
      const merged = smartMerge(layoutDraft, existingLayout, skinDraft, existingSkin, {
        mergeMode: opts.mergeMode,
        conflictPolicy: opts.conflictPolicy,
      });
      if (opts.mergeMode !== 'dry-run') {
        layoutDraft = merged.layout;
        skinDraft = merged.skin;
      }
      syncAfter = merged.layout;
      syncDelta = {
        mergeMode: opts.mergeMode,
        fieldChanges: merged.fieldChanges,
        conflicts: merged.conflicts,
      };
      if (opts.conflictPolicy === 'fail' && merged.conflicts.length > 0) {
        console.error('[dom-to-ui-json] sync conflicts (fail policy):');
        for (const c of merged.conflicts) console.error('  - ' + c);
        process.exit(4);
      }
      for (const c of merged.fieldChanges) {
        if (c.kind === 'manual-edit' || c.kind === 'preserved-existing') {
          warnings.push({ code: 'sync-preserved-human', detail: c.path });
        }
      }
    }
  }

  // Pre-write backup: copy all existing files that are about to be overwritten
  if (opts.backup) {
    const repoRoot = path.resolve(__dirname, '..');
    const candidatePaths = [
      { src: opts.output, label: 'layout' },
      { src: opts.skinOutput, label: 'skin' },
    ];
    // Also collect sidecar paths that may already exist on disk
    const sidecarSuffixes = [
      '.screen.json', '.preload.json', '.performance.json', '.composite.json',
      '.bundle-suggestion.json', '.sync-report.json', '.r-guard.json',
      '.interaction.json', '.motion.json', '.fragment-routes.json',
      '.logic-inventory.json', '.logic-guard.json', '.visual-review.json',
    ];
    for (const sfx of sidecarSuffixes) {
      const p = deriveScreenSidecarPath(opts.output, sfx);
      candidatePaths.push({ src: p, label: path.basename(p) });
    }
    const backupResult = createBackup({
      screenId: opts.screenId || 'unknown',
      files: candidatePaths,
      backupRoot: opts.backupDir || undefined,
      repoRoot,
    });
    if (backupResult.backedUpFiles.length > 0) {
      console.log(`[dom-to-ui-json] backup created: ${backupResult.backupDir}`);
      console.log(`[dom-to-ui-json] backed up: ${backupResult.backedUpFiles.join(', ')}`);
    }
  }

  // Write layout + skin (skip on dry-run)
  if (!(opts.syncExisting && opts.mergeMode === 'dry-run')) {
    writeJson(opts.output, layoutDraft);
    writeJson(opts.skinOutput, skinDraft);
  }

  // Optional: screen draft
  let screenPath = null;
  if (opts.emitScreenDraft) {
    screenPath = deriveScreenSidecarPath(opts.output, '.screen.json');
    writeJson(screenPath, {
      screenId: opts.screenId,
      layoutRef: relRef(opts.output),
      skinRef: relRef(opts.skinOutput),
      meta: {
        scaffoldHints: {
          useUCUFLogger: true, // §37.2
        },
        variantMode: variantInfo ? variantInfo.mode : undefined,
        previewVariants: variantInfo ? variantInfo.previewVariants : undefined,
      },
    });
  }

  // Preload manifest
  let preloadManifest = null;
  let preloadPath = null;
  if (opts.emitPreloadManifest) {
    preloadManifest = buildPreloadManifest(layoutDraft, skinDraft, {
      screenId: opts.screenId,
      bundle: opts.bundle,
      defaultBundle: opts.defaultBundle,
    });
    preloadPath = deriveScreenSidecarPath(opts.output, '.preload.json');
    writeJson(preloadPath, preloadManifest);
    for (const w of (preloadManifest._warnings || [])) warnings.push(w);
  }

  // Performance report
  let perfReport = null;
  let perfPath = null;
  if (opts.emitPerformanceReport) {
    perfReport = buildPerformanceReport(layoutDraft, skinDraft, preloadManifest, {
      screenId: opts.screenId,
      strict: opts.strict,
    });
    perfPath = deriveScreenSidecarPath(opts.output, '.performance.json');
    writeJson(perfPath, perfReport);
  }

  // M1 — composite slot report
  let compositePath = null;
  if (opts.emitCompositeReport && compositeNodes.length > 0) {
    const report = buildCompositeReport(opts.screenId, compositeNodes);
    compositePath = deriveScreenSidecarPath(opts.output, '.composite.json');
    writeJson(compositePath, report);
  }

  // M5 — bundle suggestion + skin-layer-atlas-risk
  let bundleSuggestionPath = null;
  if (opts.emitBundleSuggestion) {
    const suggestion = buildBundleSuggestion(opts.screenId, opts.bundle, skinDraft);
    const risks = detectSkinLayerAtlasRisk(layoutDraft, skinDraft);
    if (risks.length > 0) {
      suggestion.skinLayerAtlasRisk = risks;
      for (const r of risks) {
        warnings.push({ code: 'skin-layer-atlas-risk', detail: `${r.node}:${r.bundles.join(',')}` });
      }
    }
    bundleSuggestionPath = deriveScreenSidecarPath(opts.output, '.bundle-suggestion.json');
    writeJson(bundleSuggestionPath, suggestion);
  }

  // M4 — sync-report sidecar (only when sync ran)
  let syncReportPath = null;
  if (opts.emitSyncReport && opts.syncExisting && syncDelta) {
    const report = buildSyncReport(opts.screenId, opts.mergeMode, syncBefore, syncAfter || layoutDraft, syncDelta);
    syncReportPath = deriveScreenSidecarPath(opts.output, '.sync-report.json');
    writeJson(syncReportPath, report);
  }

  // M3 — R-guard summary
  let rGuardPath = null;
  let rGuardSummary = null;
  if (opts.emitRGuard) {
    rGuardSummary = buildRGuardSummary(layoutDraft, skinDraft, warnings);
    rGuardPath = deriveScreenSidecarPath(opts.output, '.r-guard.json');
    writeJson(rGuardPath, rGuardSummary);
  }

  let interactionPath = null;
  if (opts.emitInteractionReport) {
    interactionPath = deriveScreenSidecarPath(opts.output, '.interaction.json');
    writeJson(interactionPath, interactionDraft);
  }

  let motionPath = null;
  if (opts.emitMotionReport) {
    motionPath = deriveScreenSidecarPath(opts.output, '.motion.json');
    writeJson(motionPath, motionDraft);
  }

  let fragmentRoutePath = null;
  if (opts.emitFragmentRoutePatch) {
    fragmentRoutePath = deriveScreenSidecarPath(opts.output, '.fragment-routes.json');
    writeJson(fragmentRoutePath, buildFragmentRoutePatch(opts.screenId, layoutDraft, interactionDraft));
  }

  let logicInventoryPath = null;
  let logicGuardPath = null;
  let logicGuard = null;
  let logicInventory = null;
  if (opts.emitLogicGuard) {
    logicInventory = logicBefore || buildLogicInventory({
      screenId: opts.screenId,
      layout: layoutDraft,
      screen: logicScreen,
      screenPath: opts.screenInput,
      componentSource,
      componentPath: opts.componentInput,
    });
    logicInventoryPath = deriveScreenSidecarPath(opts.output, '.logic-inventory.json');
    writeJson(logicInventoryPath, logicInventory);
    const baseline = opts.logicBaseline ? readJson(opts.logicBaseline) : logicBefore;
    if (baseline) {
      const currentInventory = buildLogicInventory({
        screenId: opts.screenId,
        layout: layoutDraft,
        screen: logicScreen,
        screenPath: opts.screenInput,
        componentSource,
        componentPath: opts.componentInput,
      });
      logicGuard = verifyLogicGuard(baseline, currentInventory, { errorLogText });
      logicGuardPath = deriveScreenSidecarPath(opts.output, '.logic-guard.json');
      writeJson(logicGuardPath, logicGuard);
    }
  }

  let visualReviewPath = null;
  let visualReview = null;
  if (opts.emitVisualReview) {
    visualReview = buildVisualReview(opts.screenId, layoutDraft, skinDraft, warnings, interactionDraft, motionDraft, logicGuard);
    visualReviewPath = deriveScreenSidecarPath(opts.output, '.visual-review.json');
    writeJson(visualReviewPath, visualReview);
  }

  let fidelitySidecars = null;
  if (opts.input && (opts.emitCssCoverage || opts.emitTokenSuggestions || opts.emitImageWaivers)) {
    fidelitySidecars = await buildFidelitySidecars({
      htmlPath: opts.input,
      outputBasePath: opts.output,
      screenId: opts.screenId,
      viewport: {
        width: (layoutDraft.canvas && layoutDraft.canvas.designWidth) || 1334,
        height: (layoutDraft.canvas && layoutDraft.canvas.designHeight) || 750,
      },
      browserPath: opts.browser,
      tokensSource: opts.tokensSource,
      tokensRuntime: opts.tokensRuntime,
      tokensHandoff: opts.tokensHandoff,
      emitCssCoverage: opts.emitCssCoverage,
      emitTokenSuggestions: opts.emitTokenSuggestions,
      emitImageWaivers: opts.emitImageWaivers,
      manualWaiverPath: opts.manualWaivers,
      sourceDir: opts.sourceCss ? path.dirname(path.resolve(opts.sourceCss)) : path.dirname(path.resolve(opts.input)),
      evolutionLog: opts.evolutionLog,
    });
    if (fidelitySidecars.ok) {
      if (typeof opts.strictCoverage === 'number' && !Number.isNaN(opts.strictCoverage)
          && fidelitySidecars.coverage.coveragePercent < opts.strictCoverage) {
        console.error(`[dom-to-ui-json] strict coverage fail: ${fidelitySidecars.coverage.coveragePercent} < ${opts.strictCoverage}`);
        process.exit(11);
      }
      if (opts.coverageBaseline) {
        const baseline = readJson(opts.coverageBaseline);
        const baselineCoverage = Number(baseline.coveragePercent != null ? baseline.coveragePercent : baseline.adjustedCoverage);
        if (Number.isFinite(baselineCoverage) && fidelitySidecars.coverage.coveragePercent < baselineCoverage) {
          console.error(`[dom-to-ui-json] coverage regression: ${fidelitySidecars.coverage.coveragePercent} < baseline ${baselineCoverage}`);
          process.exit(11);
        }
      }
      if (typeof opts.strictTokens === 'number' && !Number.isNaN(opts.strictTokens)) {
        const tokenSuggestionCount = countTokenSuggestions(fidelitySidecars.tokenSuggestions);
        if (tokenSuggestionCount > opts.strictTokens) {
          console.error(`[dom-to-ui-json] strict token suggestion fail: ${tokenSuggestionCount} > ${opts.strictTokens}`);
          process.exit(14);
        }
      }
    } else if (fidelitySidecars.skipped) {
      warnings.push({ code: 'fidelity-sidecars-skipped', detail: fidelitySidecars.reason });
      if (typeof opts.strictCoverage === 'number' && !Number.isNaN(opts.strictCoverage)) {
        console.error(`[dom-to-ui-json] strict coverage unavailable: ${fidelitySidecars.reason}`);
        process.exit(11);
      }
    }
  }

  const durationMs = Date.now() - startedAt;

  // M2/M3 — post-validate by spawning validate-ui-specs.js
  let validateResult = { passed: true, failureCodes: [], strict: !!opts.strict, ran: false };
  if (opts.validate) {
    const validatorPath = path.join(__dirname, 'validate-ui-specs.js');
    if (fs.existsSync(validatorPath)) {
      const proc = spawnSync(process.execPath, [validatorPath], { encoding: 'utf8' });
      validateResult.ran = true;
      validateResult.passed = proc.status === 0;
      const text = `${proc.stdout || ''}\n${proc.stderr || ''}`;
      const codes = [];
      const codeRe = /\b(R\d+(?:\.\d+)?|UCUF-[A-Z0-9_-]+)\b/g;
      let cm;
      while ((cm = codeRe.exec(text)) !== null) {
        if (!codes.includes(cm[1])) codes.push(cm[1]);
      }
      validateResult.failureCodes = validateResult.passed ? [] : codes;
      if (!validateResult.passed) {
        warnings.push({ code: 'validate-failed', detail: codes.join(',') || 'see-stderr' });
        if (opts.strict && !opts.warnOnly) {
          console.error('[dom-to-ui-json] --validate failed (strict):');
          if (proc.stdout) process.stderr.write(proc.stdout);
          if (proc.stderr) process.stderr.write(proc.stderr);
          appendTelemetry({
            input: inputPath ? { path: inputPath, sourceDomHash: inputHash, sizeBytes: inputBytes, nodeCount: countNodes(layoutDraft) } : null,
            warnings: groupWarningCounts(warnings),
            validate: validateResult,
            durationMs: Date.now() - startedAt,
            mode: opts.syncExisting ? 'sync' : 'create',
          });
          process.exit(5);
        }
      }
    } else {
      warnings.push({ code: 'validator-not-found', detail: validatorPath });
    }
  }

  // Telemetry — only when env is set
  appendTelemetry({
    input: inputPath ? {
      path: inputPath,
      sourceDomHash: inputHash,
      sizeBytes: inputBytes,
      nodeCount: countNodes(layoutDraft),
    } : null,
    output: {
      layoutPath: opts.output,
      skinPath: opts.skinOutput,
      screenPath,
      preloadPath,
      performancePath: perfPath,
      interactionPath,
      motionPath,
      fragmentRoutePath,
      logicInventoryPath,
      logicGuardPath,
      visualReviewPath,
      cssCoveragePath: fidelitySidecars && fidelitySidecars.written && fidelitySidecars.written.cssCoveragePath,
      tokenSuggestionsPath: fidelitySidecars && fidelitySidecars.written && fidelitySidecars.written.tokenSuggestionsPath,
      imageWaiversPath: fidelitySidecars && fidelitySidecars.written && fidelitySidecars.written.imageWaiversPath,
      sourceCssPath: opts.sourceCss,
    },
    warnings: groupWarningCounts(warnings),
    validate: validateResult,
    syncDelta: syncDelta || undefined,
    interaction: interactionDraft.summary,
    motion: motionDraft.summary,
    logicGuard: logicGuard ? { verdict: logicGuard.verdict, summary: logicGuard.summary } : undefined,
    visualReview: visualReview ? { verdict: visualReview.verdict, metrics: visualReview.metrics } : undefined,
    fidelity: fidelitySidecars && fidelitySidecars.ok ? {
      coveragePercent: fidelitySidecars.coverage && fidelitySidecars.coverage.coveragePercent,
      tokenSuggestionCount: countTokenSuggestions(fidelitySidecars.tokenSuggestions),
      waiverCount: fidelitySidecars.waiverReport && fidelitySidecars.waiverReport.waivers ? fidelitySidecars.waiverReport.waivers.length : 0,
    } : undefined,
    performance: perfReport ? {
      nodeCount: perfReport.rendering.nodeCount,
      atlasCount: perfReport.loading.atlasCount,
      estimatedTextureBytes: perfReport.loading.estimatedTextureBytes,
      estimatedDrawCalls: perfReport.rendering.estimatedDrawCalls,
    } : undefined,
    durationMs,
    mode: opts.syncExisting ? 'sync' : 'create',
  });

  // Emit warnings to stderr if requested
  if (opts.emitWarnings) {
    for (const w of warnings) {
      console.warn(`[warn] ${w.code}${w.detail ? ' :: ' + w.detail : ''}`);
    }
  }

  // Strict gating
  if (opts.strict && !opts.warnOnly) {
    const blockers = perfReport ? perfReport.verdict.blockers : [];
    if (blockers.length) {
      console.error('[dom-to-ui-json] strict mode blockers:');
      for (const b of blockers) console.error('  - ' + b);
      process.exit(3);
    }
    // M3: strict unmapped-token / forbidden-type fail policy
    const strictCodes = new Set([
      'unmapped-color',
      'unmapped-css-var',
      'forbidden-node-type',
      'asset-path-guarded',
    ]);
    const tokenIssues = warnings.filter(w => w && strictCodes.has(w.code));
    if (tokenIssues.length > 0) {
      console.error('[dom-to-ui-json] strict mode unmapped-token / forbidden-type:');
      for (const w of tokenIssues) console.error(`  - ${w.code} :: ${w.detail || ''}`);
      process.exit(6);
    }
    if (rGuardSummary) {
      const failed = Object.entries(rGuardSummary).filter(([, v]) => v && v.status === 'fail');
      if (failed.length > 0) {
        console.error('[dom-to-ui-json] strict R-guard fail:');
        for (const [k, v] of failed) console.error(`  - ${k}: ${JSON.stringify(v)}`);
        process.exit(7);
      }
    }
    if (logicGuard && logicGuard.verdict === 'fail') {
      console.error('[dom-to-ui-json] strict logic guard fail:');
      for (const b of logicGuard.broken || []) console.error(`  - ${b.featureId}: ${b.reason}`);
      for (const b of (logicGuard.errorLogSummary && logicGuard.errorLogSummary.blockers) || []) console.error(`  - log: ${b}`);
      process.exit(9);
    }
    if (hasInteractionBlockers(interactionDraft) || hasMotionBlockers(motionDraft)) {
      console.error('[dom-to-ui-json] strict interaction / motion contract fail:');
      for (const w of interactionDraft.warnings || []) if (w.code === 'interaction-target-missing') console.error(`  - ${w.code}: ${w.detail || ''}`);
      for (const w of motionDraft.warnings || []) if (w.code === 'motion-target-missing') console.error(`  - ${w.code}: ${w.detail || ''}`);
      process.exit(10);
    }
  }

  console.log(`[${TOOL_NAME}] ok screenId=${opts.screenId} layout=${opts.output} skin=${opts.skinOutput}` +
    (preloadPath ? ` preload=${preloadPath}` : '') +
    (perfPath ? ` performance=${perfPath}` : '') +
    (compositePath ? ` composite=${compositePath}` : '') +
    (bundleSuggestionPath ? ` bundle-suggestion=${bundleSuggestionPath}` : '') +
    (syncReportPath ? ` sync-report=${syncReportPath}` : '') +
    (rGuardPath ? ` r-guard=${rGuardPath}` : '') +
    (interactionPath ? ` interaction=${interactionPath}` : '') +
    (motionPath ? ` motion=${motionPath}` : '') +
    (logicGuardPath ? ` logic-guard=${logicGuardPath}` : '') +
    (fidelitySidecars && fidelitySidecars.written && fidelitySidecars.written.cssCoveragePath ? ` css-coverage=${fidelitySidecars.written.cssCoveragePath}` : '') +
    (fidelitySidecars && fidelitySidecars.written && fidelitySidecars.written.tokenSuggestionsPath ? ` token-suggestions=${fidelitySidecars.written.tokenSuggestionsPath}` : '') +
    (fidelitySidecars && fidelitySidecars.written && fidelitySidecars.written.imageWaiversPath ? ` image-waivers=${fidelitySidecars.written.imageWaiversPath}` : '') +
    ` durationMs=${durationMs}`);
}

function relRef(p) {
  // Return a tail "<dir>/<file>" ref relative to ui-spec root if applicable
  return path.relative(process.cwd(), p).replace(/\\/g, '/');
}

function applyVariantMode(layoutDraft, skinDraft, variantMode, warnings) {
  if (!variantMode) return null;
  const supported = {
    'gacha-3pool': ['hero', 'support', 'limited'],
  };
  const previewVariants = supported[variantMode];
  if (!previewVariants) {
    warnings.push({ code: 'unknown-variant-mode', detail: variantMode });
    return { mode: variantMode, previewVariants: [], status: 'unknown' };
  }
  layoutDraft.meta = Object.assign({}, layoutDraft.meta, {
    domToUi: Object.assign({}, layoutDraft.meta && layoutDraft.meta.domToUi, {
      variantMode,
      previewVariants,
    }),
  });
  skinDraft.meta = Object.assign({}, skinDraft.meta, { variantMode, previewVariants });
  return { mode: variantMode, previewVariants, status: 'ready' };
}

function countNodes(node) {
  if (!node || typeof node !== 'object') return 0;
  let n = 1;
  if (Array.isArray(node.children)) {
    for (const c of node.children) n += countNodes(c);
  }
  return n;
}

function groupWarningCounts(warnings) {
  const map = new Map();
  for (const w of warnings) {
    if (!w || !w.code) continue;
    map.set(w.code, (map.get(w.code) || 0) + 1);
  }
  return [...map.entries()].map(([code, count]) => ({ code, count }));
}

if (require.main === module) {
  main(process.argv).catch((err) => {
    console.error(`[${TOOL_NAME}] fatal: ${err.message}`);
    if (process.env.DOM_TO_UI_DEBUG === '1') console.error(err.stack);
    process.exit(1);
  });
}

module.exports = { parseArgs, buildDraftFromHtml };
