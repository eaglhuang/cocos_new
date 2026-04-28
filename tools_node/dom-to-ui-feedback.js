#!/usr/bin/env node
// doc_id: doc_other_0009 — dom-to-ui-feedback CLI
// 規格來源：docs/html_skill_plan.md (doc_other_0009) §36 / §37
//
// 子命令：
//   --aggregate            聚合最近 N 天 telemetry 規則命中率
//   --field-stability      欄位穩定性（需 --sync-existing 樣本）
//   --suggest-thresholds   依 hit / manualEditRate 建議閾值（不自動套用）
//   --detect-drift         偵測 token / css-var 漂移
//   --apply-suggestion <id> 半自動套用，產出 patch + evolution log entry（不 commit）
//   --prune                清理過期 telemetry
'use strict';

const fs = require('fs');
const path = require('path');

const {
  aggregate,
  suggestThresholds,
  detectDrift,
  fieldStability,
} = require('./lib/dom-to-ui/feedback-aggregate');
const { pruneTelemetry, DEFAULT_DIR } = require('./lib/dom-to-ui/telemetry');
const { appendEvolutionEntry, DEFAULT_LOG } = require('./lib/dom-to-ui/evolution-log');
const { buildFidelityEntries, appendEntries } = require('./lib/dom-to-ui/fidelity-feedback');

const TOOL_NAME = 'dom-to-ui-feedback';

function parseArgs(argv) {
  const opts = {
    cmd: null,
    days: 30,
    olderThan: 90,
    suggestionId: null,
    reviewer: null,
    pr: null,
    outputPatch: null,
    outputJson: null,
    suggestionsFile: null,
    coverageFile: null,
    pixelDiffFile: null,
    sourcePath: null,
    heatmapPath: null,
    tokenSuggestionsFile: null,
    tokensPath: null,
    value: null,
    dir: null,
    logPath: null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--aggregate': opts.cmd = opts.cmd || 'aggregate'; break;
      case '--field-stability': opts.cmd = 'field-stability'; break;
      case '--suggest-thresholds': opts.cmd = 'suggest-thresholds'; break;
      case '--detect-drift': opts.cmd = 'detect-drift'; break;
      case '--apply-suggestion': opts.cmd = 'apply-suggestion'; opts.suggestionId = next(); break;
      case '--emit-fidelity-suggestions': opts.cmd = 'emit-fidelity-suggestions'; break;
      case '--accept-token-suggestion': opts.cmd = 'accept-token-suggestion'; opts.suggestionId = next(); break;
      case '--prune': opts.cmd = 'prune'; break;
      case '--since': opts.days = parseSince(next()); break;
      case '--older-than': opts.olderThan = parseSince(next()); break;
      case '--reviewer': opts.reviewer = next(); break;
      case '--pr': opts.pr = next(); break;
      case '--output-patch': opts.outputPatch = next(); break;
      case '--update-checklist': opts.updateChecklist = next(); break;
      case '--output': opts.outputJson = next(); break;
      case '--suggestions': opts.suggestionsFile = next(); break;
      case '--coverage': opts.coverageFile = next(); break;
      case '--pixel-diff': opts.pixelDiffFile = next(); break;
      case '--source': opts.sourcePath = next(); break;
      case '--heatmap': opts.heatmapPath = next(); break;
      case '--token-suggestions': opts.tokenSuggestionsFile = next(); break;
      case '--tokens': opts.tokensPath = next(); break;
      case '--value': opts.value = next(); break;
      case '--dir': opts.dir = next(); break;
      case '--log': opts.logPath = next(); break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        if (a.startsWith('--')) console.warn(`[${TOOL_NAME}] unknown flag: ${a}`);
    }
  }
  return opts;
}

function printHelp() {
  console.log(`
${TOOL_NAME} — telemetry aggregator and rule evolution helper

Usage:
  node tools_node/dom-to-ui-feedback.js <command> [--since 30d]

Commands:
  --aggregate                Aggregate warnings + validate failure codes
  --field-stability          Compute manual-edit field stability
  --suggest-thresholds       Suggest threshold tweaks (NEVER auto-apply)
  --detect-drift             Surface unmapped colors / css-vars
  --apply-suggestion <id>    Append evolution log entry; emit patch (no commit)
  --emit-fidelity-suggestions Append pending fidelity-gap entries from sidecars
  --accept-token-suggestion <id> Accept a token suggestion into token JSON
  --prune                    Delete telemetry older than N days

Common:
  --since 30d                Aggregation window (default 30d)
  --older-than 90d           Prune cutoff (default 90d)
  --dir <path>               Telemetry directory (default artifacts/dom-to-ui-telemetry)
  --output <file>            Write JSON output to file (default stdout)
  --log <file>               Evolution log path (default docs/html_skill_rule-evolution.md)
  --reviewer <name>          Required for --apply-suggestion
  --pr <url>                 Optional PR link for evolution entry
  --suggestions <file>       Required for --apply-suggestion (threshold-suggestions.json)
  --output-patch <file>      Patch path for --apply-suggestion
`);
}

function parseSince(val) {
  if (!val) return 30;
  const m = String(val).match(/^(\d+)([dh]?)$/);
  if (!m) return 30;
  const n = parseInt(m[1], 10);
  if (m[2] === 'h') return Math.max(1, Math.round(n / 24));
  return n;
}

function emit(opts, obj) {
  const text = JSON.stringify(obj, null, 2);
  if (opts.outputJson) {
    const full = path.resolve(opts.outputJson);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text + '\n', 'utf8');
    console.log(`[${TOOL_NAME}] wrote ${opts.outputJson}`);
  } else {
    process.stdout.write(text + '\n');
  }
}

function defaultOutputPath(cmd) {
  const map = {
    'aggregate': `artifacts/dom-to-ui-telemetry/aggregate.json`,
    'field-stability': `artifacts/dom-to-ui-telemetry/field-stability-report.json`,
    'suggest-thresholds': `artifacts/dom-to-ui-telemetry/threshold-suggestions.json`,
    'detect-drift': `artifacts/dom-to-ui-telemetry/drift-report.json`,
  };
  return map[cmd] || null;
}

function runAggregate(opts) {
  return aggregate({ days: opts.days, dir: opts.dir });
}
function runFieldStability(opts) {
  return fieldStability({ days: opts.days, dir: opts.dir });
}
function runSuggestThresholds(opts) {
  return suggestThresholds({ days: opts.days, dir: opts.dir });
}
function runDetectDrift(opts) {
  return detectDrift({ days: opts.days, dir: opts.dir });
}

function runPrune(opts) {
  const deleted = pruneTelemetry({ days: opts.olderThan, dir: opts.dir });
  return { olderThanDays: opts.olderThan, deletedCount: deleted.length, deleted };
}

function runEmitFidelitySuggestions(opts) {
  if (!opts.coverageFile) throw new Error('--coverage <file> required');
  const coverage = JSON.parse(fs.readFileSync(path.resolve(opts.coverageFile), 'utf8').replace(/^\uFEFF/, ''));
  const pixelDiff = opts.pixelDiffFile && fs.existsSync(path.resolve(opts.pixelDiffFile))
    ? JSON.parse(fs.readFileSync(path.resolve(opts.pixelDiffFile), 'utf8').replace(/^\uFEFF/, ''))
    : {};
  const screenId = coverage.screenId || path.basename(opts.coverageFile).replace(/\.css-coverage\.json$/i, '');
  const entries = buildFidelityEntries({
    screenId,
    coverage,
    pixelDiff,
    sourcePath: opts.sourcePath || opts.coverageFile,
    heatmapPath: opts.heatmapPath || pixelDiff.heatmap,
  });
  return appendEntries(entries, { logPath: opts.logPath });
}

function runAcceptTokenSuggestion(opts) {
  if (!opts.suggestionId) throw new Error('--accept-token-suggestion <id> required');
  if (!opts.tokenSuggestionsFile) throw new Error('--token-suggestions <file> required');
  if (!opts.tokensPath) throw new Error('--tokens <file> required');
  const suggestions = JSON.parse(fs.readFileSync(path.resolve(opts.tokenSuggestionsFile), 'utf8').replace(/^\uFEFF/, ''));
  const all = [];
  for (const [bucket, category] of [
    ['colorSuggestions', 'colors'],
    ['fontSuggestions', 'fonts'],
    ['spacingSuggestions', 'spacing'],
  ]) {
    for (const item of suggestions[bucket] || []) all.push(Object.assign({ bucket, category }, item));
  }
  const hit = all.find(item => tokenSuggestionId(item) === opts.suggestionId || item.suggestedToken === opts.suggestionId || item.value === opts.suggestionId);
  if (!hit) throw new Error(`token suggestion ${opts.suggestionId} not found`);
  const tokenPath = path.resolve(opts.tokensPath);
  const tokenJson = fs.existsSync(tokenPath) ? JSON.parse(fs.readFileSync(tokenPath, 'utf8').replace(/^\uFEFF/, '')) : {};
  const targetBucket = hit.category === 'colors' ? 'colors' : hit.category;
  tokenJson[targetBucket] = tokenJson[targetBucket] || {};
  const tokenName = opts.value && opts.value.includes('=') ? opts.value.split('=')[0] : (hit.suggestedToken || opts.suggestionId);
  const tokenValue = opts.value && opts.value.includes('=') ? opts.value.split('=').slice(1).join('=') : hit.value;
  tokenJson[targetBucket][tokenName] = tokenValue;
  fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
  fs.writeFileSync(tokenPath, JSON.stringify(tokenJson, null, 2) + '\n', 'utf8');
  appendEvolutionEntry({
    suggestionId: `token-${opts.suggestionId}`,
    rule: `token.${targetBucket}`,
    before: hit.nearestExisting ? `${hit.value} nearest ${hit.nearestExisting.token}` : hit.value,
    after: `${targetBucket}.${tokenName}=${tokenValue}`,
    reason: 'accepted token suggestion from dom-to-ui fidelity pass',
    samples: hit.samples || [],
    reviewer: opts.reviewer || 'agent',
    pr: opts.pr,
  }, opts.logPath);
  return { accepted: opts.suggestionId, bucket: targetBucket, token: tokenName, value: tokenValue, tokensPath: opts.tokensPath };
}

function tokenSuggestionId(item) {
  const raw = String(item.suggestedToken || item.value || '').replace(/[^A-Za-z0-9_.-]+/g, '-').replace(/^-|-$/g, '');
  return `${item.category || 'token'}:${raw}`;
}

function runApplySuggestion(opts) {
  if (!opts.suggestionId) throw new Error('--apply-suggestion <id> required');
  if (!opts.reviewer) throw new Error('--reviewer <name> required for --apply-suggestion');
  if (!opts.suggestionsFile) {
    // Try default path
    const guess = path.resolve('artifacts/dom-to-ui-telemetry/threshold-suggestions.json');
    if (fs.existsSync(guess)) opts.suggestionsFile = guess;
  }
  if (!opts.suggestionsFile) throw new Error('--suggestions <file> required (threshold-suggestions.json)');
  const raw = fs.readFileSync(path.resolve(opts.suggestionsFile), 'utf8').replace(/^\uFEFF/, '');
  const data = JSON.parse(raw);
  const list = Array.isArray(data) ? data : (data.suggestions || []);
  const s = list.find(x => x && x.id === opts.suggestionId);
  if (!s) throw new Error(`suggestion ${opts.suggestionId} not found in ${opts.suggestionsFile}`);

  // Append evolution log
  const logFile = appendEvolutionEntry({
    suggestionId: s.id,
    rule: s.rule,
    before: s.current,
    after: s.suggested,
    reason: s.reason,
    samples: s.samples,
    reviewer: opts.reviewer,
    pr: opts.pr,
  }, opts.logPath);

  // Emit patch — currently a stub diff describing intent (no auto-commit)
  if (opts.outputPatch) {
    const full = path.resolve(opts.outputPatch);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    const patchBody = [
      `# dom-to-ui rule patch (suggestion ${s.id})`,
      `# rule: ${s.rule}`,
      `# before: ${s.current}`,
      `# after: ${s.suggested}`,
      `# reviewer: ${opts.reviewer}`,
      `# reason: ${s.reason || ''}`,
      `# 注意：此 patch 為人工 review 用占位；實際規則更新請手動編輯 dom-to-ui-json 規則。`,
      '',
    ].join('\n');
    fs.writeFileSync(full, patchBody, 'utf8');
  }

  return {
    applied: false, // never auto-apply; only logged
    suggestionId: s.id,
    rule: s.rule,
    evolutionLog: logFile,
    patch: opts.outputPatch || null,
    checklistUpdate: opts.updateChecklist ? appendChecklistRow(opts.updateChecklist, s, opts) : null,
    note: 'evolution entry appended; rule code NOT auto-modified — open a PR with the actual change.',
  };
}

function appendChecklistRow(checklistPath, suggestion, opts) {
  const full = path.resolve(checklistPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  const now = new Date().toISOString().slice(0, 10);
  const line = `- [ ] ${now} suggestion ${suggestion.id} (${suggestion.rule}): ${suggestion.current} → ${suggestion.suggested} — reviewer:${opts.reviewer}${opts.pr ? ` pr:${opts.pr}` : ''}\n`;
  fs.appendFileSync(full, line, 'utf8');
  return { path: checklistPath, appendedLine: line.trim() };
}

function main(argv) {
  const opts = parseArgs(argv);
  if (!opts.cmd) {
    printHelp();
    process.exit(0);
  }
  let result;
  switch (opts.cmd) {
    case 'aggregate': result = runAggregate(opts); break;
    case 'field-stability': result = runFieldStability(opts); break;
    case 'suggest-thresholds': result = runSuggestThresholds(opts); break;
    case 'detect-drift': result = runDetectDrift(opts); break;
    case 'apply-suggestion': result = runApplySuggestion(opts); break;
    case 'emit-fidelity-suggestions': result = runEmitFidelitySuggestions(opts); break;
    case 'accept-token-suggestion': result = runAcceptTokenSuggestion(opts); break;
    case 'prune': result = runPrune(opts); break;
    default:
      console.error(`[${TOOL_NAME}] unknown command: ${opts.cmd}`);
      process.exit(2);
  }
  // For commands with default output paths, write there if not specified
  if (!opts.outputJson && opts.cmd !== 'apply-suggestion' && opts.cmd !== 'prune') {
    const def = defaultOutputPath(opts.cmd);
    if (def) opts.outputJson = def;
  }
  emit(opts, result);
}

if (require.main === module) {
  try {
    main(process.argv);
  } catch (err) {
    console.error(`[${TOOL_NAME}] fatal: ${err.message}`);
    if (process.env.DOM_TO_UI_DEBUG === '1') console.error(err.stack);
    process.exit(1);
  }
}

module.exports = { parseArgs };
