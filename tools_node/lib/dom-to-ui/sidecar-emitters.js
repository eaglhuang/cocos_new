// doc_id: doc_other_0009 — additional sidecar emitters (M1/M3/M5)
// 對應 §31 / §33 / §37 / §38 / §40
'use strict';

/**
 * Build composite slot report (M1).
 * @param {object[]} compositeNodes
 */
function buildCompositeReport(screenId, compositeNodes) {
  const items = (compositeNodes || []).map(n => ({
    name: n.name,
    sourceTag: n.tag,
    reason: n.reason,
    designWidth: n.width != null ? n.width : null,
    designHeight: n.height != null ? n.height : null,
    rendererHint: n.hint,
    note: 'composite slot 需手動掛 RenderTexture / 自繪 component；HTML 端僅保留 placeholder。',
  }));
  return {
    screenId,
    composites: items,
    summary: {
      total: items.length,
      svg: items.filter(i => i.sourceTag === 'svg').length,
      canvas: items.filter(i => i.sourceTag === 'canvas').length,
    },
  };
}

/**
 * Bundle suggestion (M5).
 * Inspect skin sprite paths. Sprites under sprites/<bundle>/... are grouped.
 */
function buildBundleSuggestion(screenId, currentBundle, skinDraft) {
  const slots = (skinDraft && skinDraft.slots) || {};
  const histogram = new Map();
  for (const slotId of Object.keys(slots)) {
    const slot = slots[slotId];
    if (!slot || slot.kind !== 'sprite-frame' || !slot.path) continue;
    const m = String(slot.path).match(/^sprites\/([^/]+)\//);
    const b = m ? m[1] : 'unknown';
    histogram.set(b, (histogram.get(b) || 0) + 1);
  }
  const bundles = [...histogram.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([bundle, count]) => ({ bundle, spriteCount: count }));
  const top = bundles[0] || null;
  let suggestion;
  if (!top) {
    suggestion = { primary: currentBundle || 'ui_common', confidence: 'low', reason: 'no-sprite-frame-slots' };
  } else if (currentBundle && top.bundle !== 'ui_common' && currentBundle !== top.bundle) {
    suggestion = {
      primary: top.bundle,
      confidence: 'high',
      reason: `current=${currentBundle} 但實際資產主要落在 ${top.bundle} (${top.spriteCount})`,
    };
  } else {
    suggestion = { primary: top.bundle, confidence: 'medium', reason: 'most-sprites-in-this-bundle' };
  }
  return {
    screenId,
    currentBundle: currentBundle || null,
    distribution: bundles,
    suggestion,
  };
}

/**
 * skin-layer-atlas-risk (M5).
 * If any node uses skinLayers spanning multiple bundles, surface a risk.
 */
function detectSkinLayerAtlasRisk(layoutDraft, skinDraft) {
  const slots = (skinDraft && skinDraft.slots) || {};
  const risks = [];
  walk(layoutDraft, (node) => {
    if (!Array.isArray(node.skinLayers) || node.skinLayers.length < 2) return;
    const bundles = new Set();
    for (const layer of node.skinLayers) {
      const slot = slots[layer.slotId];
      if (!slot || !slot.path) continue;
      const m = String(slot.path).match(/^sprites\/([^/]+)\//);
      if (m) bundles.add(m[1]);
    }
    if (bundles.size > 1) {
      risks.push({ node: node.name, bundles: [...bundles] });
    }
  });
  return risks;
}

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  if (Array.isArray(node.children)) for (const c of node.children) walk(c, visit);
}

/**
 * Build sync report sidecar (M4).
 */
function buildSyncReport(screenId, mergeMode, before, after, syncDelta) {
  return {
    screenId,
    mergeMode,
    summary: {
      fieldChangeCount: (syncDelta && syncDelta.fieldChanges && syncDelta.fieldChanges.length) || 0,
      conflictCount: (syncDelta && syncDelta.conflicts && syncDelta.conflicts.length) || 0,
      manualEdits: countKind(syncDelta, 'manual-edit'),
      lockedPreserved: countKind(syncDelta, 'locked-preserved'),
      preservedExisting: countKind(syncDelta, 'preserved-existing'),
      added: countKind(syncDelta, 'added'),
      removedFromHtml: countKind(syncDelta, 'removed-from-html'),
      overwrittenByHtml: countKind(syncDelta, 'overwritten-by-html'),
    },
    before: snapshotMeta(before),
    after: snapshotMeta(after),
    fieldChanges: (syncDelta && syncDelta.fieldChanges) || [],
    conflicts: (syncDelta && syncDelta.conflicts) || [],
  };
}

function countKind(syncDelta, kind) {
  if (!syncDelta || !Array.isArray(syncDelta.fieldChanges)) return 0;
  return syncDelta.fieldChanges.filter(c => c.kind === kind).length;
}

function snapshotMeta(layout) {
  if (!layout) return { nodeCount: 0 };
  let count = 0; let maxDepth = 0;
  (function rec(n, d) {
    if (!n || typeof n !== 'object') return;
    count += 1;
    if (d > maxDepth) maxDepth = d;
    if (Array.isArray(n.children)) for (const c of n.children) rec(c, d + 1);
  })(layout, 1);
  return { nodeCount: count, maxDepth };
}

/**
 * R-guard summary (M3): R25 specVersion, R27 nineSlice family,
 * R28 繁中 / forbidden type / unmapped token strict gates.
 */
function buildRGuardSummary(layoutDraft, skinDraft, warnings) {
  const codes = new Set((warnings || []).map(w => w && w.code).filter(Boolean));
  const r25 = layoutDraft && typeof layoutDraft.specVersion === 'number'
    ? { status: 'pass', specVersion: layoutDraft.specVersion }
    : { status: 'warn', detail: 'layout missing specVersion' };
  // R27: any sprite slot under known nineSlice family must carry nineSlice.
  const slots = (skinDraft && skinDraft.slots) || {};
  const r27Issues = [];
  for (const id of Object.keys(slots)) {
    const s = slots[id];
    if (!s || s.kind !== 'sprite-frame' || !s.path) continue;
    if (/parchment|dark[_-]metal|gold[_-]cta/.test(s.path) && !s.nineSlice) {
      r27Issues.push(id);
    }
  }
  const r27 = r27Issues.length === 0
    ? { status: 'pass' }
    : { status: 'fail', missingNineSlice: r27Issues };
  const r28 = codes.has('text-locale-mismatch') ? { status: 'warn' } : { status: 'pass' };
  const forbidden = codes.has('forbidden-node-type') ? { status: 'fail' } : { status: 'pass' };
  const unmapped = (codes.has('unmapped-color') || codes.has('unmapped-css-var'))
    ? { status: 'warn' }
    : { status: 'pass' };
  return {
    R25_specVersion: r25,
    R27_nineSliceFamily: r27,
    R28_localeTraditional: r28,
    forbiddenNodeType: forbidden,
    unmappedToken: unmapped,
  };
}

function buildFragmentRoutePatch(screenId, layoutDraft, interactionDraft) {
  const lazySlots = [];
  walk(layoutDraft, (node) => {
    if (!node || !node.lazySlot) return;
    lazySlots.push({
      slot: node.name,
      ucufId: node._ucufId || null,
      defaultFragment: node.defaultFragment || null,
      warmupHint: node.warmupHint || null,
      status: node.defaultFragment ? 'ready' : 'missing-default-fragment',
    });
  });
  const tabRoutes = ((interactionDraft && interactionDraft.actions) || [])
    .filter(a => a.type === 'tabSwitch')
    .map(a => ({ trigger: a.trigger, target: a.target, interactionId: a.id, status: a.target ? 'ready' : 'missing-target' }));
  return {
    screenId,
    lazySlots,
    tabRoutes,
    summary: {
      lazySlotCount: lazySlots.length,
      tabRouteCount: tabRoutes.length,
      missingDefaultFragmentCount: lazySlots.filter(s => !s.defaultFragment).length,
      missingTabTargetCount: tabRoutes.filter(t => !t.target).length,
    },
  };
}

module.exports = {
  buildCompositeReport,
  buildBundleSuggestion,
  detectSkinLayerAtlasRisk,
  buildSyncReport,
  buildRGuardSummary,
  buildFragmentRoutePatch,
};
