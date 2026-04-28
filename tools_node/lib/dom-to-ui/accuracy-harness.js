// doc_id: doc_other_0009 — accuracy harness for dom-to-ui (§40)
//
// 設計目的：
//   1. 對同一份 HTML 跑 N 次 buildDraftFromHtml，量化「冪等率」(idempotencyRate)。
//   2. 對同一畫面產生「等價變體」（whitespace / 屬性順序 / class 順序 / style key 順序），
//      驗證工具對無語意差異 perturbation 的「結構穩定率」(structuralStability)。
//   3. 與 baseline JSON 比較，量化「結構命中率 / token 覆蓋率 / warning precision」。
//   4. 把指標 append 進 telemetry，對 feedback loop 提供量化訊號。
'use strict';

const crypto = require('crypto');

const { buildDraftFromHtml } = require('./draft-builder');
const { buildVisualReview } = require('./visual-review');

const DEFAULT_METRIC_KEYS = [
  'iterations',
  'idempotencyRate',
  'structuralStability',
  'tokenCoverage',
  'warningPrecisionVsBaseline',
  'baselineMatch',
  'validatePassRate',
];

function hashObj(obj) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(obj))
    .digest('hex')
    .slice(0, 32);
}

/**
 * Pure-deterministic equivalence perturbations on raw HTML.
 * 不改變語意，只重排表面格式。
 */
function generatePerturbations(html, opts) {
  const variants = [{ name: 'identity', html }];
  if (!opts || opts.whitespace !== false) {
    variants.push({
      name: 'whitespace-collapse',
      html: html.replace(/\s+/g, ' ').replace(/>\s+</g, '><'),
    });
    variants.push({
      name: 'extra-whitespace',
      html: html.replace(/></g, '>\n  <'),
    });
  }
  if (!opts || opts.attrOrder !== false) {
    variants.push({
      name: 'reorder-attrs',
      html: html.replace(/<([a-zA-Z][a-zA-Z0-9-]*)\s+([^>]*?)>/g, (m, tag, rest) => {
        // Split attrs preserving quoted values
        const attrs = [];
        const re = /([a-zA-Z_:][\w:.-]*)\s*=\s*"([^"]*)"|([a-zA-Z_:][\w:.-]*)\s*=\s*'([^']*)'|([a-zA-Z_:][\w:.-]*)/g;
        let mm;
        while ((mm = re.exec(rest)) !== null) {
          attrs.push(mm[0]);
        }
        if (attrs.length <= 1) return m;
        // Reverse order — semantically equivalent
        return `<${tag} ${attrs.slice().reverse().join(' ')}>`;
      }),
    });
  }
  if (!opts || opts.classOrder !== false) {
    variants.push({
      name: 'reverse-class-order',
      html: html.replace(/class\s*=\s*"([^"]*)"/g, (_, v) => {
        const parts = v.split(/\s+/).filter(Boolean);
        return `class="${parts.slice().reverse().join(' ')}"`;
      }),
    });
  }
  if (!opts || opts.styleOrder !== false) {
    variants.push({
      name: 'reverse-inline-style-keys',
      html: html.replace(/style\s*=\s*"([^"]*)"/g, (_, v) => {
        const decls = v.split(';').map(s => s.trim()).filter(Boolean);
        return `style="${decls.slice().reverse().join('; ')}"`;
      }),
    });
  }
  return variants;
}

/**
 * Strip non-deterministic / volatile fields before comparison.
 */
function normalizeForCompare(obj) {
  const seen = new WeakSet();
  return strip(obj);
  function strip(node) {
    if (node === null || typeof node !== 'object') return node;
    if (seen.has(node)) return null;
    seen.add(node);
    if (Array.isArray(node)) return node.map(strip);
    const out = {};
    for (const k of Object.keys(node).sort()) {
      // Skip fields known to be order/timing dependent.
      if (k === 'meta') {
        // tokenUsage order may vary by traversal but should be deterministic for same input;
        // include normalized form (sorted by token+detail).
        const m = node[k];
        if (m && m.tokenUsageReport) {
          const tur = m.tokenUsageReport;
          const sorted = {};
          for (const bucket of Object.keys(tur).sort()) {
            const items = Array.isArray(tur[bucket]) ? tur[bucket].slice() : tur[bucket];
            if (Array.isArray(items)) {
              items.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
            }
            sorted[bucket] = items;
          }
          out[k] = Object.assign({}, m, { tokenUsageReport: sorted });
          continue;
        }
      }
      out[k] = strip(node[k]);
    }
    return out;
  }
}

function structuralSignature(layout) {
  // Walk tree, collect (depth, type, name, ucufId) tuples ignoring style detail.
  const sig = [];
  (function rec(n, d) {
    if (!n || typeof n !== 'object') return;
    sig.push(`${d}|${n.type || ''}|${n.name || ''}|${n._ucufId || ''}`);
    if (Array.isArray(n.children)) for (const c of n.children) rec(c, d + 1);
  })(layout, 0);
  return sig.join('\n');
}

function collectWarningCodes(warnings) {
  const map = new Map();
  for (const w of warnings || []) {
    if (!w || !w.code) continue;
    map.set(w.code, (map.get(w.code) || 0) + 1);
  }
  return map;
}

function diffWarningSets(actualMap, expectedCodes) {
  const expected = new Set(expectedCodes || []);
  let truePos = 0; let falseNeg = 0;
  for (const code of expected) if (actualMap.has(code)) truePos += 1; else falseNeg += 1;
  let falsePos = 0;
  for (const [code] of actualMap) if (!expected.has(code)) falsePos += 1;
  const precision = truePos + falsePos === 0 ? 1 : truePos / (truePos + falsePos);
  const recall = truePos + falseNeg === 0 ? 1 : truePos / (truePos + falseNeg);
  return { truePos, falsePos, falseNeg, precision, recall };
}

function tokenCoverage(skinDraft) {
  const slots = (skinDraft && skinDraft.slots) || {};
  let total = 0; let mapped = 0;
  for (const id of Object.keys(slots)) {
    const s = slots[id];
    if (!s) continue;
    if (s.kind === 'color-rect') {
      total += 1;
      if (s.color && s.color !== 'unmappedColor') mapped += 1;
    } else if (s.kind === 'label-style') {
      total += 1;
      if (s.color && s.color !== 'unmappedColor') mapped += 1;
    } else if (s.kind === 'sprite-frame') {
      total += 1;
      if (s.path && !/missing_sprite$/.test(s.path)) mapped += 1;
    }
  }
  return total === 0 ? 1 : mapped / total;
}

function buildOnce(html, opts) {
  return buildDraftFromHtml(html, opts);
}

/**
 * Run the full accuracy harness for one HTML fixture.
 * @param {object} cfg
 * @param {string} cfg.html
 * @param {object} cfg.opts opts forwarded to buildDraftFromHtml
 * @param {number} [cfg.iterations=5]
 * @param {object} [cfg.baseline]   { layout, skin, expectedWarningCodes }
 */
function runAccuracy(cfg) {
  const iterations = Math.max(2, cfg.iterations || 5);
  const baseline = cfg.baseline || null;

  // 1. idempotency: run identity HTML N times.
  const identityHashes = new Set();
  let identitySample = null;
  for (let i = 0; i < iterations; i += 1) {
    const out = buildOnce(cfg.html, cfg.opts);
    const norm = {
      layout: normalizeForCompare(out.layoutDraft),
      skin: normalizeForCompare(out.skinDraft),
    };
    identityHashes.add(hashObj(norm));
    if (i === 0) identitySample = out;
  }
  const idempotencyRate = identityHashes.size === 1 ? 1 : 0;

  // 2. structural stability via perturbation set.
  const variants = generatePerturbations(cfg.html, cfg.perturbations || {});
  const baseSig = structuralSignature(identitySample.layoutDraft);
  let stable = 0;
  const variantDiffs = [];
  for (const v of variants) {
    const out = buildOnce(v.html, cfg.opts);
    const sig = structuralSignature(out.layoutDraft);
    const equal = sig === baseSig;
    if (equal) stable += 1;
    else variantDiffs.push({ name: v.name, sigLines: sig.split('\n').length, baseLines: baseSig.split('\n').length });
  }
  const structuralStability = stable / variants.length;

  // 3. token coverage on identity sample.
  const tokenCov = tokenCoverage(identitySample.skinDraft);

  // 4. baseline comparison.
  let baselineMatch = null;
  let warningEval = null;
  if (baseline) {
    const baseSampleSig = baseline.layout ? structuralSignature(baseline.layout) : null;
    if (baseSampleSig) baselineMatch = baseSampleSig === baseSig ? 1 : 0;
    if (baseline.expectedWarningCodes) {
      const map = collectWarningCodes(identitySample.warnings);
      warningEval = diffWarningSets(map, baseline.expectedWarningCodes);
    }
  }

  return {
    iterations,
    variantCount: variants.length,
    idempotencyRate,
    structuralStability,
    tokenCoverage: tokenCov,
    baselineMatch,
    warningPrecisionVsBaseline: warningEval ? warningEval.precision : null,
    warningRecallVsBaseline: warningEval ? warningEval.recall : null,
    variantDiffs,
    warningEval,
    sampleWarningCodes: [...collectWarningCodes(identitySample.warnings).keys()].sort(),
    visualReview: buildVisualReview(
      cfg.opts && cfg.opts.screenId,
      identitySample.layoutDraft,
      identitySample.skinDraft,
      identitySample.warnings,
      identitySample.interactionDraft,
      identitySample.motionDraft,
      cfg.logicGuard || null,
    ),
    interactionSummary: identitySample.interactionDraft ? identitySample.interactionDraft.summary : null,
    motionSummary: identitySample.motionDraft ? identitySample.motionDraft.summary : null,
    layoutHash: hashObj(normalizeForCompare(identitySample.layoutDraft)),
    skinHash: hashObj(normalizeForCompare(identitySample.skinDraft)),
  };
}

module.exports = {
  runAccuracy,
  generatePerturbations,
  structuralSignature,
  normalizeForCompare,
  diffWarningSets,
  tokenCoverage,
  hashObj,
  DEFAULT_METRIC_KEYS,
};
