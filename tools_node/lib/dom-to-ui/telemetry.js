// doc_id: doc_other_0009 §36.1 — telemetry helper
'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_DIR = path.resolve(process.cwd(), 'artifacts/dom-to-ui-telemetry');
const TOOL_VERSION = '1.0.0';

function isEnabled() {
  return process.env.DOM_TO_UI_TELEMETRY === '1';
}

function getDir(customDir) {
  return path.resolve(customDir || DEFAULT_DIR);
}

function todayFile(dir) {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(dir, `${date}.jsonl`);
}

/**
 * Append one telemetry record. Silently no-op if env flag not enabled.
 * @param {object} record
 * @param {object} [options]
 * @param {string} [options.dir]
 * @returns {string|null} written file path, or null if disabled
 */
function appendTelemetry(record, options = {}) {
  if (!isEnabled()) return null;
  const dir = getDir(options.dir);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = todayFile(dir);
  const enriched = {
    ts: new Date().toISOString(),
    tool: 'dom-to-ui-json',
    version: TOOL_VERSION,
    ...record,
  };
  fs.appendFileSync(filePath, JSON.stringify(enriched) + '\n', 'utf8');
  return filePath;
}

/**
 * Read telemetry records within the past N days.
 * @param {object} options
 * @param {number} options.days
 * @param {string} [options.dir]
 * @returns {object[]}
 */
function readTelemetry(options) {
  const dir = getDir(options.dir);
  if (!fs.existsSync(dir)) return [];
  const days = Math.max(1, options.days || 30);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const records = [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl')).sort();
  for (const file of files) {
    const m = file.match(/^(\d{4}-\d{2}-\d{2})\.jsonl$/);
    if (!m) continue;
    const fileDate = Date.parse(m[1] + 'T00:00:00Z');
    if (Number.isNaN(fileDate)) continue;
    if (fileDate < cutoff - 24 * 60 * 60 * 1000) continue;
    const lines = fs.readFileSync(path.join(dir, file), 'utf8').split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const rec = JSON.parse(line);
        if (rec.ts && Date.parse(rec.ts) >= cutoff) records.push(rec);
      } catch (_) {
        // skip malformed lines
      }
    }
  }
  return records;
}

/**
 * Delete telemetry files older than N days. Returns deleted file paths.
 */
function pruneTelemetry(options) {
  const dir = getDir(options.dir);
  if (!fs.existsSync(dir)) return [];
  const days = Math.max(1, options.days || 90);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const deleted = [];
  for (const file of fs.readdirSync(dir)) {
    const m = file.match(/^(\d{4}-\d{2}-\d{2})\.jsonl$/);
    if (!m) continue;
    const fileDate = Date.parse(m[1] + 'T00:00:00Z');
    if (Number.isNaN(fileDate)) continue;
    if (fileDate < cutoff) {
      const full = path.join(dir, file);
      fs.unlinkSync(full);
      deleted.push(full);
    }
  }
  return deleted;
}

module.exports = {
  isEnabled,
  appendTelemetry,
  readTelemetry,
  pruneTelemetry,
  DEFAULT_DIR,
  TOOL_VERSION,
};
