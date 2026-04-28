// doc_id: doc_other_0009 §36.2 / §36.3 / §36.4 / §36.5 — feedback aggregation
'use strict';

const { readTelemetry } = require('./telemetry');

/**
 * Aggregate warning / failure code statistics over a window.
 */
function aggregate(options) {
  const records = readTelemetry({ days: options.days, dir: options.dir });
  const warningStats = new Map();
  const failureStats = new Map();
  const performance = {
    runs: 0,
    avgNodeCount: 0,
    avgAtlasCount: 0,
    avgEstimatedTextureBytes: 0,
    avgEstimatedDrawCalls: 0,
  };

  let nodeCountSum = 0;
  let atlasCountSum = 0;
  let textureBytesSum = 0;
  let drawCallsSum = 0;
  let perfSamples = 0;

  for (const r of records) {
    if (Array.isArray(r.warnings)) {
      for (const w of r.warnings) {
        if (!w || !w.code) continue;
        const entry = warningStats.get(w.code) || { code: w.code, hits: 0, runs: 0 };
        entry.hits += Number(w.count) || 1;
        entry.runs += 1;
        warningStats.set(w.code, entry);
      }
    }
    if (r.validate && Array.isArray(r.validate.failureCodes)) {
      for (const code of r.validate.failureCodes) {
        const entry = failureStats.get(code) || { code, hits: 0 };
        entry.hits += 1;
        failureStats.set(code, entry);
      }
    }
    if (r.performance) {
      perfSamples += 1;
      nodeCountSum += Number(r.performance.nodeCount) || 0;
      atlasCountSum += Number(r.performance.atlasCount) || 0;
      textureBytesSum += Number(r.performance.estimatedTextureBytes) || 0;
      drawCallsSum += Number(r.performance.estimatedDrawCalls) || 0;
    }
  }

  if (perfSamples) {
    performance.runs = perfSamples;
    performance.avgNodeCount = +(nodeCountSum / perfSamples).toFixed(2);
    performance.avgAtlasCount = +(atlasCountSum / perfSamples).toFixed(2);
    performance.avgEstimatedTextureBytes = Math.round(textureBytesSum / perfSamples);
    performance.avgEstimatedDrawCalls = +(drawCallsSum / perfSamples).toFixed(2);
  }

  return {
    windowDays: options.days,
    totalRuns: records.length,
    warningStats: [...warningStats.values()].map(e => ({
      ...e,
      avgPerRun: +(e.hits / Math.max(1, e.runs)).toFixed(2),
    })).sort((a, b) => b.hits - a.hits),
    validateFailureCodes: [...failureStats.values()].sort((a, b) => b.hits - a.hits),
    performance,
  };
}

/**
 * Suggest threshold adjustments based on hit rate. NEVER auto-apply.
 * Heuristic:
 *   - color-rect-count-warning: if hits >= 50 AND avgPerRun < 1.5 -> suggest +1
 *   - unmapped-color: not a threshold rule, skip
 *   - atlas-batch-limit-near: locked to R24 (suggested = current)
 */
function suggestThresholds(options) {
  const agg = aggregate(options);
  const out = [];
  let counter = 1;
  function pushId(prefix) {
    return `${prefix}-${String(counter++).padStart(3, '0')}`;
  }

  for (const w of agg.warningStats) {
    if (w.code === 'color-rect-count-warning' && w.hits >= 50 && w.avgPerRun < 1.5) {
      out.push({
        id: pushId('TS'),
        rule: 'color-rect-count-warning',
        current: 2,
        suggested: 3,
        reason: `近 ${options.days} 天 hit ${w.hits} 次，avgPerRun=${w.avgPerRun}，多為設計合理案例，建議放寬至 3`,
        samples: w.hits,
        applyHint: '節省人工豁免時間，但需確認 §11 (gacha M31/M40 教訓) 不被破壞',
      });
    }
    if (w.code === 'atlas-batch-limit-near' || w.code === 'atlas-batch-limit-exceeded') {
      out.push({
        id: pushId('TS'),
        rule: 'atlas-batch-limit',
        current: 4,
        suggested: 4,
        reason: '對齊 validate-ui-specs.js R24，不建議調整',
        samples: w.hits,
        applyHint: 'locked-by-R24',
      });
    }
  }
  return { windowDays: options.days, suggestions: out };
}

/**
 * Detect token / css-var drift: look for repeated `unmapped-*` warnings.
 */
function detectDrift(options) {
  const records = readTelemetry({ days: options.days, dir: options.dir });
  const colorMap = new Map();
  const cssVarMap = new Map();
  for (const r of records) {
    for (const w of (r.warnings || [])) {
      if (!w || !w.code) continue;
      const detail = w.detail || w.value;
      if (w.code === 'unmapped-color' && detail) {
        colorMap.set(detail, (colorMap.get(detail) || 0) + (Number(w.count) || 1));
      }
      if (w.code === 'unmapped-css-var' && detail) {
        cssVarMap.set(detail, (cssVarMap.get(detail) || 0) + (Number(w.count) || 1));
      }
    }
  }
  const unmappedColors = [...colorMap.entries()]
    .map(([value, hits]) => ({ value, hits, suggestion: `add as colors.<name> in ui-design-tokens.json` }))
    .sort((a, b) => b.hits - a.hits);
  const unmappedCssVars = [...cssVarMap.entries()]
    .map(([name, hits]) => ({ name, hits, suggestion: `map ${name} to a token in css-var registry` }))
    .sort((a, b) => b.hits - a.hits);
  return {
    windowDays: options.days,
    unmappedColors,
    unmappedCssVars,
  };
}

/**
 * Field stability — requires sync-existing samples in telemetry.
 * If telemetry records contain `syncDelta.fieldChanges`, compute stability.
 */
function fieldStability(options) {
  const records = readTelemetry({ days: options.days, dir: options.dir });
  const fieldStats = new Map(); // path -> { totalSamples, manualEditCount }
  let samples = 0;
  for (const r of records) {
    if (!r.syncDelta || !Array.isArray(r.syncDelta.fieldChanges)) continue;
    samples += 1;
    const seen = new Set();
    for (const fc of r.syncDelta.fieldChanges) {
      if (!fc || !fc.path) continue;
      const key = fc.path;
      const entry = fieldStats.get(key) || { path: key, totalSamples: 0, manualEditCount: 0 };
      if (!seen.has(key)) {
        entry.totalSamples += 1;
        seen.add(key);
      }
      if (fc.kind === 'manual-edit') entry.manualEditCount += 1;
      fieldStats.set(key, entry);
    }
  }
  const fields = [...fieldStats.values()].map(e => {
    const stabilityRate = +(1 - e.manualEditCount / Math.max(1, e.totalSamples)).toFixed(2);
    let verdict = 'medium-stability';
    if (stabilityRate < 0.5) verdict = 'low-stability';
    else if (stabilityRate > 0.9) verdict = 'high-stability';
    return { ...e, stabilityRate, verdict };
  }).sort((a, b) => a.stabilityRate - b.stabilityRate);
  return {
    windowDays: options.days,
    syncSamples: samples,
    fields,
    interpretation: {
      'low-stability': 'stabilityRate < 0.5：工具自動推導品質低，建議改為人工標記為主',
      'high-stability': 'stabilityRate > 0.9：工具推導可靠',
    },
  };
}

module.exports = {
  aggregate,
  suggestThresholds,
  detectDrift,
  fieldStability,
};
