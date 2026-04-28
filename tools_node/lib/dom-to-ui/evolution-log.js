// doc_id: doc_other_0009 §36.6 — evolution log appender
'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_LOG = path.resolve(process.cwd(), 'docs/html_skill_rule-evolution.md');
const HEADER = '<!-- doc_id: doc_other_0010 -->\n# HTML Skill Rule Evolution Log\n\n本檔由 `tools_node/dom-to-ui-feedback.js --apply-suggestion` 自動 append 規則演化紀錄。\n\n> 規則：只能 append，不可刪改既有 entry。所有 entry 均需 reviewer 與 PR 連結。\n\n---\n';

function ensureLog(logPath) {
  const target = path.resolve(logPath || DEFAULT_LOG);
  if (!fs.existsSync(target)) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, HEADER, 'utf8');
  }
  return target;
}

/**
 * Append an accepted threshold suggestion to the evolution log.
 * @param {object} entry
 * @param {string} entry.suggestionId  e.g. "TS-001"
 * @param {string} entry.rule
 * @param {*}      entry.before
 * @param {*}      entry.after
 * @param {string} entry.reason
 * @param {number} entry.samples
 * @param {string} entry.reviewer
 * @param {string} [entry.pr]
 * @param {string} [logPath]
 */
function appendEvolutionEntry(entry, logPath) {
  if (!entry || !entry.suggestionId || !entry.rule || !entry.reviewer) {
    throw new Error('appendEvolutionEntry: suggestionId / rule / reviewer are required');
  }
  const target = ensureLog(logPath);
  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    `## ${date} — ${entry.suggestionId} accepted`,
    '',
    `- rule: \`${entry.rule}\``,
    `- before: ${stringify(entry.before)}`,
    `- after: ${stringify(entry.after)}`,
    `- reason: ${entry.reason || '(not provided)'}`,
    `- samples: ${entry.samples ?? 'n/a'}`,
    `- reviewer: ${entry.reviewer}`,
    `- PR: ${entry.pr || '(pending)'}`,
    '',
  ];
  fs.appendFileSync(target, '\n' + lines.join('\n'), 'utf8');
  return target;
}

function stringify(v) {
  if (v == null) return 'null';
  if (typeof v === 'object') return '`' + JSON.stringify(v) + '`';
  return String(v);
}

module.exports = {
  appendEvolutionEntry,
  ensureLog,
  DEFAULT_LOG,
};
