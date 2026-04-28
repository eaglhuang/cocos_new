// doc_id: doc_other_0009 §35.6 / §35.7 — performance report builder
'use strict';

const { checkAtlasBudget, estimateTextureBytes } = require('./atlas');

const TEXTURE_LIMITS = {
  warning: 4 * 1024 * 1024,
  blocker: 16 * 1024 * 1024,
  critical: 32 * 1024 * 1024,
};

const NODE_LIMITS = {
  warning: 35,
  blocker: 60,
};

const DEPTH_LIMITS = {
  warning: 8,
  blocker: 12,
};

/**
 * Walk layout to compute node count, max depth, color rect count, etc.
 */
function analyzeLayout(layoutDraft) {
  let nodeCount = 0;
  let maxDepth = 0;
  let colorRectCount = 0;
  let lazySlotCount = 0;
  const warmupHints = { 'next-frame': 0, idle: 0, 'tab-hover': 0, manual: 0 };

  function walk(node, depth) {
    if (!node || typeof node !== 'object') return;
    nodeCount += 1;
    if (depth > maxDepth) maxDepth = depth;
    if (node.lazySlot === true) {
      lazySlotCount += 1;
      const hint = node.warmupHint || 'manual';
      warmupHints[hint] = (warmupHints[hint] || 0) + 1;
    }
    // panel without skinSlot/skinLayers is treated as solid color rect
    if (node.type === 'panel' && !node.skinSlot && !Array.isArray(node.skinLayers)) {
      colorRectCount += 1;
    }
    if (Array.isArray(node.children)) {
      for (const c of node.children) walk(c, depth + 1);
    }
  }
  walk(layoutDraft, 1);
  return { nodeCount, maxDepth, colorRectCount, lazySlotCount, warmupHints };
}

/**
 * Estimate draw calls heuristic. One draw call per atlas + one per label/font.
 */
function estimateDrawCalls(skinDraft) {
  const slots = (skinDraft && skinDraft.slots) || {};
  const atlases = new Set();
  const fonts = new Set();
  for (const slot of Object.values(slots)) {
    if (!slot) continue;
    if (slot.kind === 'sprite-frame' && slot.path) {
      const segs = String(slot.path).split('/').filter(Boolean);
      atlases.add(segs.slice(0, 3).join('/'));
    } else if (slot.kind === 'label-style' && slot.font) {
      fonts.add(slot.font);
    }
  }
  return atlases.size + fonts.size;
}

/**
 * Build the integrated <screen>.performance.json report.
 */
function buildPerformanceReport(layoutDraft, skinDraft, preloadManifest, options) {
  const opts = options || {};
  const layoutStats = analyzeLayout(layoutDraft);
  const atlasReport = checkAtlasBudget(skinDraft || {});
  const textureBytes = estimateTextureBytes(skinDraft || {});
  const fontCount = countFonts(skinDraft || {});
  const drawCalls = estimateDrawCalls(skinDraft || {});

  const warnings = [];
  const blockers = [];

  if (atlasReport._warning) warnings.push(atlasReport._warning);
  if (layoutStats.nodeCount > NODE_LIMITS.warning) {
    warnings.push(`node-count-warning: ${layoutStats.nodeCount} (>${NODE_LIMITS.warning})`);
  }
  if (layoutStats.nodeCount > NODE_LIMITS.blocker) {
    blockers.push(`node-count-blocker: ${layoutStats.nodeCount} (>${NODE_LIMITS.blocker})`);
  }
  if (layoutStats.maxDepth > DEPTH_LIMITS.warning) {
    warnings.push(`max-depth-warning: ${layoutStats.maxDepth} (>${DEPTH_LIMITS.warning})`);
  }
  if (layoutStats.maxDepth > DEPTH_LIMITS.blocker) {
    blockers.push(`max-depth-blocker: ${layoutStats.maxDepth} (>${DEPTH_LIMITS.blocker})`);
  }
  if (textureBytes > TEXTURE_LIMITS.warning) {
    warnings.push(`texture-memory-warning: ${formatMb(textureBytes)} > ${formatMb(TEXTURE_LIMITS.warning)}`);
  }
  if (textureBytes > TEXTURE_LIMITS.blocker) {
    if (opts.strict) {
      blockers.push(`texture-memory-blocker: ${formatMb(textureBytes)} > ${formatMb(TEXTURE_LIMITS.blocker)}`);
    } else {
      warnings.push(`texture-memory-blocker: ${formatMb(textureBytes)} > ${formatMb(TEXTURE_LIMITS.blocker)} (run with --strict to fail)`);
    }
  }
  if (textureBytes > TEXTURE_LIMITS.critical) {
    blockers.push(`texture-memory-critical: ${formatMb(textureBytes)} > ${formatMb(TEXTURE_LIMITS.critical)}`);
  }
  if (layoutStats.colorRectCount > 2) {
    warnings.push(`color-rect-count-warning: ${layoutStats.colorRectCount} (>2)`);
  }

  const level = blockers.length ? 'blocker' : (warnings.length ? 'warning' : 'ok');

  const report = {
    screenId: opts.screenId,
    rendering: {
      nodeCount: layoutStats.nodeCount,
      maxDepth: layoutStats.maxDepth,
      estimatedDrawCalls: drawCalls,
      colorRectCount: layoutStats.colorRectCount,
    },
    loading: {
      atlasCount: atlasReport.atlasCount,
      atlasLimit: atlasReport.limit,
      preloadSpriteCount: preloadManifest && preloadManifest.firstScreen
        ? preloadManifest.firstScreen.spriteFrames.length
        : 0,
      deferredSpriteCount: preloadManifest && preloadManifest.counts
        ? preloadManifest.counts.deferredSpriteCount
        : 0,
      estimatedTextureBytes: textureBytes,
      fontCount,
    },
    lifecycle: {
      lazySlotCount: layoutStats.lazySlotCount,
      warmupHints: layoutStats.warmupHints,
    },
    runtimeGate: {
      nodeCount: {
        value: layoutStats.nodeCount,
        warning: NODE_LIMITS.warning,
        blocker: NODE_LIMITS.blocker,
        status: layoutStats.nodeCount > NODE_LIMITS.blocker ? 'fail' : (layoutStats.nodeCount > NODE_LIMITS.warning ? 'warn' : 'pass'),
      },
      maxDepth: {
        value: layoutStats.maxDepth,
        warning: DEPTH_LIMITS.warning,
        blocker: DEPTH_LIMITS.blocker,
        status: layoutStats.maxDepth > DEPTH_LIMITS.blocker ? 'fail' : (layoutStats.maxDepth > DEPTH_LIMITS.warning ? 'warn' : 'pass'),
      },
    },
    verdict: { level, warnings, blockers },
  };

  return report;
}

function countFonts(skinDraft) {
  const fonts = new Set();
  for (const slot of Object.values((skinDraft && skinDraft.slots) || {})) {
    if (slot && slot.kind === 'label-style' && slot.font) fonts.add(slot.font);
  }
  return fonts.size;
}

function formatMb(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2) + 'MB';
}

module.exports = {
  buildPerformanceReport,
  analyzeLayout,
  estimateDrawCalls,
  TEXTURE_LIMITS,
  NODE_LIMITS,
  DEPTH_LIMITS,
};
