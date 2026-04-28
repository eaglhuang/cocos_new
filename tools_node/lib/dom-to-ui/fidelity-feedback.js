// doc_id: doc_other_0009 — Auto-Feedback to Evolution Log (M17)
// Converts coverage / pixel-diff findings into pending entries that get
// appended to docs/html_skill_rule-evolution.md.  Idempotent (hashed).
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const EVOLUTION_LOG = path.join(__dirname, '..', '..', '..', 'docs', 'html_skill_rule-evolution.md');

function shortHash(s) {
  return crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 8);
}

/**
 * Build pending entries from coverage + pixel-diff sidecars.
 * @param {object} args { screenId, coverage, pixelDiff, sourcePath }
 * @returns {Array<{ id: string, body: string }>}
 */
function buildFidelityEntries(args) {
  const screenId = args.screenId || 'unknown';
  const coverage = args.coverage || {};
  const pixelDiff = args.pixelDiff || {};
  const sourcePath = args.sourcePath || '?';
  const dropped = coverage.droppedProperties || {};
  const today = new Date().toISOString().slice(0, 10);

  const entries = [];
  // One entry per dropped CSS property (groups all occurrences).
  for (const [prop, info] of Object.entries(dropped)) {
    const sample = info.samples && info.samples[0] ? info.samples[0] : { path: '?', value: '?' };
    const id = `fidelity-gap-${screenId}-${prop}-${shortHash(sample.value)}`;
    const body =
`## Entry ${today} — ${id}

- suggestion id: \`${id}\`
- reviewer: (pending — auto-emitted)
- before: dom-to-ui-json 對 \`${sample.path}\` 的 \`${prop}: ${sample.value}\` 沒有對映（occurrences=${info.occurrences}）
- after: 建議擴充 skin slot 對映或在 token registry 補對應 token（覆蓋率提升）
- reason: css-coverage 偵測到此屬性被丟棄；pixel-diff coverage=${(pixelDiff.coveragePercent || 0).toFixed(3)}，目標 ≥0.95
- samples: \`${sourcePath}\` 對應節點 \`${sample.path}\`
- impact: pending — 等待 reviewer 透過 \`dom-to-ui-feedback.js --apply-suggestion ${id}\` 接受
`;
    entries.push({ id, body });
  }

  // Per-zone low-coverage entry (if pixelDiff < 0.95)
  if (pixelDiff && pixelDiff.coveragePercent != null && pixelDiff.coveragePercent < 0.95) {
    const id = `fidelity-gap-${screenId}-low-coverage-${shortHash(String(pixelDiff.coveragePercent))}`;
    const body =
`## Entry ${today} — ${id}

- suggestion id: \`${id}\`
- reviewer: (pending — auto-emitted)
- before: pixel-diff coverage 為 ${(pixelDiff.coveragePercent * 100).toFixed(1)}%（低於 95% 門檻）
- after: 補充對應 skin slot kind / token / waiver；可參考其他 \`fidelity-gap-${screenId}-*\` entry
- reason: §50 pixel-diff 報告
- samples: \`${args.heatmapPath || '?'}\`
- impact: pending — 須先處理高占比的 dropped property
`;
    entries.push({ id, body });
  }

  return entries;
}

function listExistingIds(logText) {
  const ids = new Set();
  const re = /^- suggestion id: `([^`]+)`/gm;
  let m;
  while ((m = re.exec(logText))) ids.add(m[1]);
  return ids;
}

/**
 * Append entries to the evolution log, skipping any whose id already exists.
 * @returns {{ appended: string[], skipped: string[] }}
 */
function appendEntries(entries, opts) {
  opts = opts || {};
  const logPath = opts.logPath || EVOLUTION_LOG;
  if (!fs.existsSync(logPath)) {
    return { appended: [], skipped: entries.map(e => e.id), reason: 'log-not-found' };
  }
  const existing = fs.readFileSync(logPath, 'utf8');
  const knownIds = listExistingIds(existing);

  const toAppend = entries.filter(e => !knownIds.has(e.id));
  if (toAppend.length === 0) {
    return { appended: [], skipped: entries.map(e => e.id) };
  }

  const block = '\n---\n\n' + toAppend.map(e => e.body).join('\n---\n\n');
  fs.appendFileSync(logPath, block, 'utf8');
  return {
    appended: toAppend.map(e => e.id),
    skipped: entries.filter(e => knownIds.has(e.id)).map(e => e.id),
  };
}

module.exports = { buildFidelityEntries, appendEntries, EVOLUTION_LOG };
