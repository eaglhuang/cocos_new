#!/usr/bin/env node
// doc_id: doc_other_0009 — dom-to-ui accuracy harness CLI (§40)
//
// 用法：
//   node tools_node/dom-to-ui-accuracy.js \
//     --input <html> --screen-id <id> [--bundle <name>] \
//     --baseline <baseline.json> --output <accuracy.json> \
//     [--iterations 5] [--strict]
//
// baseline.json schema:
//   {
//     "layout": <layoutJson>?,           // 用 structural signature 比對
//     "expectedWarningCodes": ["..."],    // 必須出現的 warning code 集合（precision/recall）
//     "minTokenCoverage": 0.8,            // optional 門檻
//     "minStructuralStability": 1.0,
//     "minIdempotencyRate": 1.0
//   }
'use strict';

const fs = require('fs');
const path = require('path');
const { runAccuracy } = require('./lib/dom-to-ui/accuracy-harness');
const { appendTelemetry } = require('./lib/dom-to-ui/telemetry');
const { thresholdByProfile } = require('./lib/dom-to-ui/visual-review');

function parseArgs(argv) {
  const o = {
    input: null,
    output: null,
    baseline: null,
    screenId: null,
    bundle: null,
    profile: null,
    logicGuard: null,
    iterations: 5,
    strict: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--input': o.input = next(); break;
      case '--output': o.output = next(); break;
      case '--baseline': o.baseline = next(); break;
      case '--screen-id': o.screenId = next(); break;
      case '--bundle': o.bundle = next(); break;
      case '--profile': o.profile = next(); break;
      case '--logic-guard': o.logicGuard = next(); break;
      case '--iterations': o.iterations = parseInt(next(), 10) || 5; break;
      case '--strict': o.strict = true; break;
      case '--help': case '-h': printHelp(); process.exit(0); break;
      default:
        if (a.startsWith('--')) console.warn(`[dom-to-ui-accuracy] unknown flag: ${a}`);
    }
  }
  return o;
}

function printHelp() {
  console.log(`
dom-to-ui-accuracy — repeated HTML decompose / perturbation harness

Required:
  --input <html>           HTML fixture
  --screen-id <id>         screen id passed to draft builder
  --output <path>          accuracy.json output

Optional:
  --baseline <path>        baseline JSON with thresholds + expected warnings
  --bundle <name>          bundle name forwarded to draft builder
  --profile <name>         tool-fixture | formal-ui | production | commerce
  --logic-guard <json>     optional <screen>.logic-guard.json linkage
  --iterations <n>         identity-run count (default 5)
  --strict                 fail (exit 8) if any baseline threshold is missed
`);
}

function main() {
  const opts = parseArgs(process.argv);
  if (!opts.input || !opts.output || !opts.screenId) {
    console.error('[dom-to-ui-accuracy] --input / --output / --screen-id required');
    process.exit(2);
  }
  const html = fs.readFileSync(path.resolve(opts.input), 'utf8');
  const baseline = opts.baseline ? JSON.parse(fs.readFileSync(path.resolve(opts.baseline), 'utf8')) : null;
  const logicGuard = opts.logicGuard && fs.existsSync(path.resolve(opts.logicGuard))
    ? JSON.parse(fs.readFileSync(path.resolve(opts.logicGuard), 'utf8'))
    : null;

  const startedAt = Date.now();
  const result = runAccuracy({
    html,
    iterations: opts.iterations,
    baseline,
    logicGuard,
    opts: { screenId: opts.screenId, bundle: opts.bundle },
  });

  const verdict = evaluateVerdict(result, baseline, { profile: opts.profile, logicGuard });
  const report = {
    screenId: opts.screenId,
    inputPath: opts.input,
    iterations: opts.iterations,
    durationMs: Date.now() - startedAt,
    metrics: {
      idempotencyRate: result.idempotencyRate,
      structuralStability: result.structuralStability,
      tokenCoverage: result.tokenCoverage,
      baselineMatch: result.baselineMatch,
      warningPrecisionVsBaseline: result.warningPrecisionVsBaseline,
      warningRecallVsBaseline: result.warningRecallVsBaseline,
      screenshotZoneConfidence: result.visualReview && result.visualReview.metrics.screenshotZoneConfidence,
      motionPresenceRate: result.visualReview && result.visualReview.metrics.motionPresenceRate,
      interactionSuccessRate: result.visualReview && result.visualReview.metrics.interactionSuccessRate,
    },
    interactionSummary: result.interactionSummary,
    motionSummary: result.motionSummary,
    visualReview: result.visualReview,
    logicGuard: logicGuard ? { verdict: logicGuard.verdict, summary: logicGuard.summary } : null,
    sampleWarningCodes: result.sampleWarningCodes,
    layoutHash: result.layoutHash,
    skinHash: result.skinHash,
    variantDiffs: result.variantDiffs,
    warningEval: result.warningEval,
    verdict,
  };

  const outFull = path.resolve(opts.output);
  fs.mkdirSync(path.dirname(outFull), { recursive: true });
  fs.writeFileSync(outFull, JSON.stringify(report, null, 2) + '\n', 'utf8');

  appendTelemetry({
    tool: 'dom-to-ui-accuracy',
    input: { path: opts.input, sizeBytes: Buffer.byteLength(html, 'utf8') },
    output: { accuracyPath: opts.output },
    accuracy: report.metrics,
    visualReview: result.visualReview ? { verdict: result.visualReview.verdict, metrics: result.visualReview.metrics } : undefined,
    logicGuard: report.logicGuard || undefined,
    verdict,
    durationMs: report.durationMs,
    mode: 'accuracy',
  });

  console.log(`[dom-to-ui-accuracy] ok screenId=${opts.screenId} verdict=${verdict.status} ` +
    `idem=${result.idempotencyRate} stab=${result.structuralStability.toFixed(3)} ` +
    `tokenCov=${result.tokenCoverage.toFixed(3)}`);

  if (opts.strict && verdict.status !== 'pass') {
    console.error('[dom-to-ui-accuracy] strict fail:');
    for (const r of verdict.reasons) console.error('  - ' + r);
    process.exit(8);
  }
}

function evaluateVerdict(result, baseline, opts) {
  const reasons = [];
  const profile = opts && opts.profile;
  const thresholds = Object.assign({
    minIdempotencyRate: 1.0,
    minStructuralStability: 1.0,
    minTokenCoverage: thresholdByProfile(profile),
    minWarningPrecision: 0.8,
    minWarningRecall: 0.8,
    minScreenshotZoneConfidence: 1.0,
    requireBaselineMatch: false,
  }, (baseline && baseline.thresholds) || {});

  if (result.idempotencyRate < thresholds.minIdempotencyRate) {
    reasons.push(`idempotencyRate ${result.idempotencyRate} < ${thresholds.minIdempotencyRate}`);
  }
  if (result.structuralStability < thresholds.minStructuralStability) {
    reasons.push(`structuralStability ${result.structuralStability} < ${thresholds.minStructuralStability}`);
  }
  if (result.tokenCoverage < thresholds.minTokenCoverage) {
    reasons.push(`tokenCoverage ${result.tokenCoverage} < ${thresholds.minTokenCoverage}`);
  }
  if (result.warningPrecisionVsBaseline != null
    && result.warningPrecisionVsBaseline < thresholds.minWarningPrecision) {
    reasons.push(`warningPrecision ${result.warningPrecisionVsBaseline} < ${thresholds.minWarningPrecision}`);
  }
  if (result.warningRecallVsBaseline != null
    && result.warningRecallVsBaseline < thresholds.minWarningRecall) {
    reasons.push(`warningRecall ${result.warningRecallVsBaseline} < ${thresholds.minWarningRecall}`);
  }
  if (thresholds.requireBaselineMatch && result.baselineMatch !== 1) {
    reasons.push('baselineMatch !== 1');
  }
  if (result.visualReview && result.visualReview.metrics.screenshotZoneConfidence < thresholds.minScreenshotZoneConfidence) {
    reasons.push(`screenshotZoneConfidence ${result.visualReview.metrics.screenshotZoneConfidence} < ${thresholds.minScreenshotZoneConfidence}`);
  }
  if (opts && opts.logicGuard && opts.logicGuard.verdict === 'fail') {
    reasons.push('linked logicGuard verdict=fail');
  }
  return { status: reasons.length === 0 ? 'pass' : 'fail', reasons, thresholds };
}

if (require.main === module) {
  try { main(); } catch (err) {
    console.error('[dom-to-ui-accuracy] fatal: ' + err.message);
    if (process.env.DOM_TO_UI_DEBUG === '1') console.error(err.stack);
    process.exit(1);
  }
}

module.exports = { parseArgs, evaluateVerdict };
