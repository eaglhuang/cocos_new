// Append-only helper for docs/html_skill_rule-evolution2.md candidates.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const DEFAULT_LOG = path.join(ROOT, 'docs', 'html_skill_rule-evolution2.md');

function appendRuntimeVisualCandidate(options) {
  const opts = options || {};
  const logPath = path.resolve(opts.logPath || DEFAULT_LOG);
  const suggestionId = opts.suggestionId || buildSuggestionId(opts);
  const sourcePackage = opts.sourcePackage || {};
  const topOffenders = opts.topOffenders || [];
  const lines = [
    '',
    `## Entry ${today()} — ${suggestionId}`,
    '',
    `- suggestion id: \`${suggestionId}\``,
    '- status: `candidate`',
    '- safety: `reviewer-required`',
    '- reviewer: `(pending)`',
    `- source package: \`${sourcePackage.sourceDir || '(unknown)'}\` / \`${sourcePackage.mainHtml || '(unknown)'}\``,
    `- screenId: \`${opts.screenId || '(unknown)'}\``,
    `- source hashes: \`html=${hashPart(sourcePackage, 'html')}\` / \`css=${hashPart(sourcePackage, 'css')}\` / \`tokens=${hashPart(sourcePackage, 'tokens')}\``,
    `- before: \`runtimeVsSource.score=${opts.score == null ? 'null' : opts.score}\`，threshold=\`${opts.threshold || 0.95}\``,
    '- top offenders:',
    ...(topOffenders.length ? topOffenders.map(formatOffender) : ['  - `(none)` — `score-gap` — `runtime visual score below threshold`']),
    `- proposed rule: ${opts.proposedRule || '補齊 parser / mapper / assetize / waiver 規則後重跑 HTML vs Cocos Editor visual gate。'}`,
    '- verification:',
    `  - \`${opts.verification || 'node tools_node/compare-html-to-cocos-editor.js --source-dir <dir> --main-html <html> --screen-id <screen> --editor-screenshot <png> --output <dir>'}\``,
    `- impact: ${opts.impact || 'pending — 需 reviewer 接受後才可自動套用。'}`,
  ];
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${lines.join('\n')}\n`, 'utf8');
  return { logPath, suggestionId };
}

function appendCssCapabilityCandidate(options) {
  const opts = options || {};
  const logPath = path.resolve(opts.logPath || DEFAULT_LOG);
  const suggestionId = opts.suggestionId || buildCssSuggestionId(opts);
  const topOffenders = opts.topOffenders || [];
  const lines = [
    '',
    `## Entry ${today()} — ${suggestionId}`,
    '',
    `- suggestion id: \`${suggestionId}\``,
    '- status: `candidate`',
    '- safety: `reviewer-required`',
    '- reviewer: `(pending)`',
    `- source package: \`${opts.sourceDir || '(unknown)'}\` / \`${opts.mainHtml || '(unknown)'}\``,
    `- screenId: \`${opts.screenId || '(unknown)'}\``,
    `- before: \`unsupportedCss=${opts.unsupportedCount || 0}\`，assetize=\`${opts.assetizeCount || 0}\``,
    '- top offenders:',
    ...(topOffenders.length ? topOffenders.map(formatOffender) : ['  - `(none)` — `css-capability` — `see css coverage sidecar`']),
    `- proposed rule: ${opts.proposedRule || '將 unsupported CSS 分流為 parser support、Cocos mapping、assetize task 或 reviewer waiver，禁止靜默降級。'}`,
    '- verification:',
    `  - \`${opts.verification || 'node tools_node/dom-to-ui-json.js --input <html> --output <layout> --skin-output <skin> --screen-id <screen> --bundle <bundle> --strict-coverage <n>'}\``,
    `- impact: ${opts.impact || 'pending — 需 reviewer 接受後才可自動套用。'}`,
  ];
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${lines.join('\n')}\n`, 'utf8');
  return { logPath, suggestionId };
}

function buildSuggestionId(opts) {
  const seed = `${opts.screenId || 'screen'}:${opts.score == null ? 'null' : opts.score}:${Date.now()}`;
  return `html-cocos-runtime-gap-${crypto.createHash('sha1').update(seed).digest('hex').slice(0, 8)}`;
}

function buildCssSuggestionId(opts) {
  const seed = `${opts.screenId || 'screen'}:${opts.unsupportedCount || 0}:${JSON.stringify(opts.topOffenders || [])}:${Date.now()}`;
  return `css-capability-gap-${crypto.createHash('sha1').update(seed).digest('hex').slice(0, 8)}`;
}

function formatOffender(offender) {
  if (typeof offender === 'string') return `  - \`${offender}\` — \`unknown\` — \`see report\``;
  return `  - \`${offender.zone || offender.property || '(unknown)'}\` — \`${offender.kind || offender.capability || offender.property || 'gap'}\` — \`${offender.impact || offender.count || 'see report'}\``;
}

function hashPart(sourcePackage, key) {
  return sourcePackage.hashes && sourcePackage.hashes[key] ? sourcePackage.hashes[key] : 'pending';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = { appendRuntimeVisualCandidate, appendCssCapabilityCandidate, DEFAULT_LOG };
