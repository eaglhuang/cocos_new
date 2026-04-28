// doc_id: doc_other_0009 — existing Cocos UI logic inventory / guard verifier
'use strict';

const fs = require('fs');

function buildLogicInventory(cfg) {
  const screenId = cfg.screenId || inferScreenId(cfg.layout, cfg.screen);
  const features = [];
  walk(cfg.layout, (node, path) => {
    const featureBase = node._ucufId || path.join('/');
    if (node.type === 'button') {
      features.push(feature('button-handler', featureBase, node, path, {
        triggerNode: path.join('/'),
        contract: node._contract || null,
        autoSmoke: true,
      }));
    }
    if (node.type === 'child-panel') {
      features.push(feature('child-panel-route', featureBase, node, path, {
        panelType: node.panelType || null,
        dataSource: node.dataSource || null,
        autoSmoke: !!node.panelType,
      }));
    }
    if (node.lazySlot) {
      features.push(feature('lazy-slot-fragment', featureBase, node, path, {
        defaultFragment: node.defaultFragment || null,
        warmupHint: node.warmupHint || null,
        autoSmoke: !!node.defaultFragment,
      }));
    }
    if (node.dataSource || node._contract) {
      features.push(feature('bind-path', featureBase, node, path, {
        bindPath: node.dataSource || node._contract,
        autoSmoke: true,
      }));
    }
  });

  const routeTargets = collectRouteTargets(cfg.screen);
  for (const target of routeTargets) {
    features.push({
      featureId: `route:${target}`,
      kind: 'route-target',
      sourceFile: cfg.screenPath || null,
      targetNode: target,
      autoSmoke: false,
    });
  }

  const publicPanelApi = collectPublicPanelApi(cfg.componentSource || '');
  for (const api of publicPanelApi) {
    features.push({
      featureId: `api:${api}`,
      kind: 'public-panel-api',
      sourceFile: cfg.componentPath || null,
      apiName: api,
      autoSmoke: false,
    });
  }

  return {
    screenId,
    generatedBy: 'dom-to-ui-logic-guard',
    summary: summarize(features),
    features: dedupeFeatures(features),
  };
}

function verifyLogicGuard(baseline, current, cfg) {
  const currentById = new Map((current.features || []).map(f => [f.featureId, f]));
  const preserved = [];
  const broken = [];
  const manualVerificationRequired = [];
  const rewriteRequired = [];
  for (const f of baseline.features || []) {
    const hit = currentById.get(f.featureId);
    if (hit) {
      preserved.push({ featureId: f.featureId, kind: f.kind });
      if (!hit.autoSmoke) manualVerificationRequired.push({ featureId: f.featureId, kind: f.kind, reason: 'not-auto-smokable' });
      continue;
    }
    const missing = { featureId: f.featureId, kind: f.kind, reason: 'missing-after-html-sync' };
    broken.push(missing);
    rewriteRequired.push({
      featureId: f.featureId,
      sourceFile: f.sourceFile || null,
      reason: `${f.kind} disappeared after HTML overwrite`,
      suggestedOwner: ownerForKind(f.kind),
      blockingLevel: f.autoSmoke ? 'blocker' : 'manual-review',
    });
  }
  const errorLogSummary = parseErrorLog(cfg && cfg.errorLogText);
  const verdict = broken.some(b => isBlockingKind(b.kind)) || errorLogSummary.blockers.length > 0
    ? 'fail'
    : (manualVerificationRequired.length ? 'manual-required' : 'pass');
  return {
    screenId: current.screenId || baseline.screenId,
    verdict,
    preserved,
    broken,
    manualVerificationRequired,
    rewriteRequired,
    errorLogSummary,
    summary: {
      baselineFeatureCount: (baseline.features || []).length,
      currentFeatureCount: (current.features || []).length,
      preservedCount: preserved.length,
      brokenCount: broken.length,
      rewriteRequiredCount: rewriteRequired.length,
    },
  };
}

function readJsonIfExists(p) {
  if (!p || !fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function readTextIfExists(p) {
  if (!p || !fs.existsSync(p)) return '';
  return fs.readFileSync(p, 'utf8');
}

function walk(root, visit) {
  (function rec(node, path) {
    if (!node || typeof node !== 'object') return;
    const name = node.name || node.id || node.type || 'node';
    const next = path.concat(name);
    visit(node, next);
    for (const child of node.children || []) rec(child, next);
  })(root, []);
}

function feature(kind, base, node, path, extra) {
  return Object.assign({
    featureId: `${kind}:${base}`,
    kind,
    sourceFile: null,
    nodePath: path.join('/'),
    triggerNode: path.join('/'),
    targetNode: node.name || null,
    ucufId: node._ucufId || null,
  }, extra || {});
}

function collectRouteTargets(screen) {
  const targets = new Set();
  (function rec(obj) {
    if (!obj || typeof obj !== 'object') return;
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && /route|panel|dialog|screen|target/i.test(key)) targets.add(value);
      else if (Array.isArray(value)) value.forEach(rec);
      else if (typeof value === 'object') rec(value);
    }
  })(screen);
  return [...targets].filter(Boolean);
}

function collectPublicPanelApi(source) {
  const out = new Set();
  const re = /\b(?:public\s+)?(?:async\s+)?(show|hide|refresh|open[A-Z]\w*|close[A-Z]\w*|switch[A-Z]\w*|select[A-Z]\w*)\s*\(/g;
  let m;
  while ((m = re.exec(source)) !== null) out.add(m[1]);
  return [...out];
}

function parseErrorLog(text) {
  const blockers = [];
  const warnings = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    if (/TypeError|ReferenceError|missing route|bind path|找不到|Cannot read/i.test(line)) blockers.push(line.trim());
    else if (/warn|warning/i.test(line)) warnings.push(line.trim());
  }
  return { blockerCount: blockers.length, warningCount: warnings.length, blockers: blockers.slice(0, 20), warnings: warnings.slice(0, 20) };
}

function summarize(features) {
  const byKind = {};
  for (const f of features) byKind[f.kind] = (byKind[f.kind] || 0) + 1;
  return { featureCount: features.length, byKind };
}

function dedupeFeatures(features) {
  const out = [];
  const seen = new Set();
  for (const f of features) {
    if (seen.has(f.featureId)) continue;
    seen.add(f.featureId);
    out.push(f);
  }
  return out;
}

function inferScreenId(layout, screen) {
  return (screen && (screen.screenId || screen.id)) || (layout && layout.name) || 'unknown-screen';
}

function ownerForKind(kind) {
  if (kind === 'button-handler' || kind === 'public-panel-api') return 'ui-programmer';
  if (kind === 'bind-path') return 'content-contract-owner';
  if (kind === 'child-panel-route' || kind === 'lazy-slot-fragment') return 'ui-architecture-owner';
  return 'technical-director';
}

function isBlockingKind(kind) {
  return kind === 'button-handler' || kind === 'bind-path' || kind === 'child-panel-route' || kind === 'lazy-slot-fragment';
}

module.exports = {
  buildLogicInventory,
  verifyLogicGuard,
  readJsonIfExists,
  readTextIfExists,
};