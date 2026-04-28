// doc_id: doc_other_0009 §35.1 / §35.3 — atlas budget & sprite reuse
'use strict';

/**
 * Statistically determine atlas usage of a skin draft.
 * Atlas id heuristic: first two path segments after `sprites/`.
 *   sprites/<bundle>/<atlas>/<file> -> "<bundle>/<atlas>"
 * Falls back to first two segments otherwise.
 * @param {object} skinDraft
 * @returns {{atlases: Array<{atlasId:string, slotCount:number}>, atlasCount:number, limit:number, _warning:string|null}}
 */
function checkAtlasBudget(skinDraft) {
  const slots = (skinDraft && skinDraft.slots) || {};
  const counter = new Map();
  for (const [, slot] of Object.entries(slots)) {
    if (!slot || slot.kind !== 'sprite-frame' || !slot.path) continue;
    const segs = String(slot.path).split('/').filter(Boolean);
    let atlasId;
    if (segs[0] === 'sprites' && segs.length >= 3) {
      atlasId = `${segs[1]}/${segs[2]}`;
    } else {
      atlasId = segs.slice(0, 2).join('/') || 'unknown';
    }
    counter.set(atlasId, (counter.get(atlasId) || 0) + 1);
  }
  const atlases = [...counter.entries()]
    .map(([atlasId, slotCount]) => ({ atlasId, slotCount }))
    .sort((a, b) => b.slotCount - a.slotCount);
  const atlasCount = atlases.length;
  const limit = 4;
  let warning = null;
  if (atlasCount > limit) {
    warning = `atlas-batch-limit-exceeded: ${atlasCount} atlases (R24 limit: ${limit})`;
  } else if (atlasCount === limit) {
    warning = 'atlas-batch-limit-near: at R24 ceiling';
  }
  return { atlases, atlasCount, limit, _warning: warning };
}

/**
 * Detect candidate cross-screen sprite duplications.
 * @param {object} skinDraft
 * @param {Record<string,{path:string}>} globalSpriteRegistry filename -> entry
 * @returns {Array}
 */
function detectDuplicateSprites(skinDraft, globalSpriteRegistry) {
  const out = [];
  const slots = (skinDraft && skinDraft.slots) || {};
  for (const [slotId, slot] of Object.entries(slots)) {
    if (!slot || slot.kind !== 'sprite-frame' || !slot.path) continue;
    const fileName = String(slot.path).split('/').pop();
    const existing = globalSpriteRegistry[fileName];
    if (existing && existing.path !== slot.path) {
      out.push({
        code: 'duplicate-sprite-asset-candidate',
        slotId,
        currentPath: slot.path,
        existingPath: existing.path,
        suggestion: `consider promoting to ui_common/${fileName}`,
      });
    }
  }
  return out;
}

/**
 * Estimate texture memory in bytes (RGBA8888).
 */
function estimateTextureBytes(skinDraft) {
  let total = 0;
  const slots = (skinDraft && skinDraft.slots) || {};
  for (const slot of Object.values(slots)) {
    if (!slot || slot.kind !== 'sprite-frame') continue;
    const w = Number(slot.expectedWidth) || 256;
    const h = Number(slot.expectedHeight) || 256;
    total += w * h * 4;
  }
  return total;
}

module.exports = {
  checkAtlasBudget,
  detectDuplicateSprites,
  estimateTextureBytes,
};
