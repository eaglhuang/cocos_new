// doc_id: doc_other_0009 — art-director visual regression static review helper
'use strict';

function buildVisualReview(screenId, layoutDraft, skinDraft, warnings, interactionDraft, motionDraft, logicGuard) {
  const zones = collectVisualZones(layoutDraft);
  const buttons = collectNodes(layoutDraft, n => n.type === 'button');
  const composites = collectNodes(layoutDraft, n => n.type === 'composite');
  const warningCodes = new Set((warnings || []).map(w => w && w.code).filter(Boolean));
  const stateLayerIssues = [];
  for (const button of buttons) {
    const slot = button.skinSlot && skinDraft && skinDraft.slots && skinDraft.slots[button.skinSlot];
    const hasStates = !!(slot && (slot.states || slot.stateLayers || slot.pressed || slot.disabled));
    if (!hasStates) stateLayerIssues.push({ node: button.name, skinSlot: button.skinSlot || null });
  }
  const effectReview = [];
  for (const code of ['css-effect-needs-art-review', 'css-transform-manual-layout-risk', 'overflow-hidden-clipping-risk']) {
    if (warningCodes.has(code)) effectReview.push(code);
  }
  const screenshotZoneConfidence = zones.length === 0 ? 1 : zones.filter(z => z.stableBounds).length / zones.length;
  const motionPresenceRate = buttons.length === 0 ? 1 : Math.min(1, ((motionDraft && motionDraft.motions && motionDraft.motions.length) || 0) / buttons.length);
  const interactionSuccessRate = interactionDraft && interactionDraft.summary && interactionDraft.summary.actionCount
    ? 1 - (interactionDraft.summary.missingTargetCount / interactionDraft.summary.actionCount)
    : 1;
  const logicPass = !logicGuard || logicGuard.verdict === 'pass' || logicGuard.verdict === 'manual-required';
  const blockers = [];
  if (stateLayerIssues.length) blockers.push('button-state-layer-review-required');
  if (!logicPass) blockers.push('logic-guard-failed');
  return {
    screenId,
    verdict: blockers.length ? 'manual-required' : 'pass',
    metrics: {
      screenshotZoneConfidence,
      motionPresenceRate,
      interactionSuccessRate,
      buttonStateLayerCoverage: buttons.length === 0 ? 1 : (buttons.length - stateLayerIssues.length) / buttons.length,
      compositeReviewCoverage: composites.length === 0 ? 1 : 0,
    },
    zones,
    stateLayerIssues,
    compositeReviewRequired: composites.map(n => ({ node: n.name, reason: 'composite renderer / screenshot fallback required' })),
    effectReview,
    blockers,
  };
}

function collectVisualZones(layoutDraft) {
  return collectNodes(layoutDraft, n => n._visualZone || n.visualZone || /^zone[:.]/i.test(n.name || '')).map(n => ({
    node: n.name,
    width: n.width || null,
    height: n.height || null,
    stableBounds: !!((n.width && n.height) || isFillWidget(n.widget)),
    zone: n._visualZone || n.visualZone || n.name,
  }));
}

function isFillWidget(widget) {
  return !!(widget && widget.top === 0 && widget.left === 0 && widget.right === 0 && widget.bottom === 0);
}

function collectNodes(root, pred) {
  const out = [];
  (function rec(node) {
    if (!node || typeof node !== 'object') return;
    if (pred(node)) out.push(node);
    for (const child of node.children || []) rec(child);
  })(root);
  return out;
}

function thresholdByProfile(profile) {
  if (profile === 'commerce' || profile === 'paid-entry') return 0.9;
  if (profile === 'formal-ui' || profile === 'production') return 0.8;
  return 0.5;
}

module.exports = {
  buildVisualReview,
  thresholdByProfile,
};