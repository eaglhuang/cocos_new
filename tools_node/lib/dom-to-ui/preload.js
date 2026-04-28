// doc_id: doc_other_0009 §35.2 / §35.4 — preload manifest builder
'use strict';

/**
 * Walk a layout tree and collect first-screen vs deferred asset references.
 * First-screen rule: any node not under a lazySlot:true container.
 * @param {object} layoutDraft
 * @param {object} skinDraft
 * @param {object} options
 * @param {string} options.screenId
 * @param {string} [options.bundle]
 * @param {string} [options.defaultBundle='ui_common']
 * @returns {object} preload manifest object
 */
function buildPreloadManifest(layoutDraft, skinDraft, options) {
  const opts = Object.assign({ defaultBundle: 'ui_common' }, options || {});
  if (!layoutDraft || typeof layoutDraft !== 'object') {
    throw new Error('buildPreloadManifest: layoutDraft is required');
  }
  if (!opts.screenId) {
    throw new Error('buildPreloadManifest: options.screenId is required');
  }

  const skinSlots = (skinDraft && skinDraft.slots) || {};
  const firstScreenSlots = new Set();
  const deferredSlotsByOwner = new Map(); // ownerName -> { slots:Set, fragments:Set, hint:string|null }
  const fontSet = new Set();
  const fragmentSetFirstScreen = new Set();

  function walk(node, owner) {
    if (!node || typeof node !== 'object') return;

    // Determine if this node enters a lazy slot
    const isLazy = node.lazySlot === true;
    if (isLazy) {
      const ownerName = node.name || node.slotName || `lazy_${deferredSlotsByOwner.size}`;
      if (!deferredSlotsByOwner.has(ownerName)) {
        deferredSlotsByOwner.set(ownerName, {
          slots: new Set(),
          fragments: new Set(),
          warmupHint: node.warmupHint || null,
        });
      }
      const entry = deferredSlotsByOwner.get(ownerName);
      if (node.defaultFragment) entry.fragments.add(node.defaultFragment);
      if (Array.isArray(node.fragments)) {
        for (const f of node.fragments) entry.fragments.add(f);
      }
      // descend with this owner so nested skinSlots are deferred
      const newOwner = ownerName;
      collectAssetRefs(node, /*deferred*/true, newOwner);
      walkChildren(node, newOwner);
      return;
    }

    // First-screen path
    collectAssetRefs(node, /*deferred*/false, owner);
    if (node.defaultFragment) fragmentSetFirstScreen.add(node.defaultFragment);
    walkChildren(node, owner);
  }

  function walkChildren(node, owner) {
    if (Array.isArray(node.children)) {
      for (const c of node.children) walk(c, owner);
    }
    if (Array.isArray(node.skinLayers)) {
      for (const layer of node.skinLayers) {
        if (layer && layer.slotId) {
          if (owner) {
            deferredSlotsByOwner.get(owner).slots.add(layer.slotId);
          } else {
            firstScreenSlots.add(layer.slotId);
          }
        }
      }
    }
  }

  function collectAssetRefs(node, deferred, owner) {
    const slotIds = [];
    if (node.skinSlot) slotIds.push(node.skinSlot);
    if (node.styleSlot) slotIds.push(node.styleSlot);
    for (const slotId of slotIds) {
      if (deferred) {
        if (owner && deferredSlotsByOwner.has(owner)) {
          deferredSlotsByOwner.get(owner).slots.add(slotId);
        }
      } else {
        firstScreenSlots.add(slotId);
      }
    }
  }

  walk(layoutDraft, null);

  const firstScreenSpriteFrames = [];
  const firstScreenBundles = new Set();
  if (opts.bundle) firstScreenBundles.add(opts.bundle);
  for (const slotId of firstScreenSlots) {
    const slot = skinSlots[slotId];
    if (!slot) continue;
    if (slot.kind === 'sprite-frame' && slot.path) {
      firstScreenSpriteFrames.push(slot.path);
      const bundle = inferBundleFromPath(slot.path) || opts.defaultBundle;
      if (bundle) firstScreenBundles.add(bundle);
    } else if (slot.kind === 'label-style' && slot.font) {
      fontSet.add(slot.font);
    }
  }

  // Add explicit bundles from skin manifest if present
  if (skinDraft && Array.isArray(skinDraft.bundles)) {
    for (const b of skinDraft.bundles) firstScreenBundles.add(b);
  }

  const deferred = [];
  let lazyIdx = 0;
  const totalLazy = deferredSlotsByOwner.size;
  for (const [slotName, entry] of deferredSlotsByOwner.entries()) {
    deferred.push({
      slotName,
      warmupHint: entry.warmupHint || inferWarmupHint(lazyIdx, totalLazy),
      fragments: [...entry.fragments],
    });
    lazyIdx += 1;
  }

  // Estimated texture bytes are computed by performance module; preload exposes count only.
  const dedupSpriteFrames = [...new Set(firstScreenSpriteFrames)];
  const deferredSpriteCount = countDeferredSprites(deferredSlotsByOwner, skinSlots);

  return {
    screenId: opts.screenId,
    version: 1,
    firstScreen: {
      bundles: [...firstScreenBundles].filter(Boolean),
      spriteFrames: dedupSpriteFrames,
      fonts: [...fontSet],
      fragments: [...fragmentSetFirstScreen],
    },
    deferred: {
      lazySlots: deferred,
    },
    counts: {
      firstScreenSpriteCount: dedupSpriteFrames.length,
      deferredSpriteCount,
    },
    _warnings: collectPreloadWarnings(deferred),
  };
}

function countDeferredSprites(deferredSlotsByOwner, skinSlots) {
  const set = new Set();
  for (const entry of deferredSlotsByOwner.values()) {
    for (const slotId of entry.slots) {
      const slot = skinSlots[slotId];
      if (slot && slot.kind === 'sprite-frame' && slot.path) set.add(slot.path);
    }
  }
  return set.size;
}

function collectPreloadWarnings(deferred) {
  const warnings = [];
  for (const d of deferred) {
    if (!d.fragments || d.fragments.length === 0) {
      warnings.push({
        code: 'lazy-slot-missing-default-fragment',
        slotName: d.slotName,
      });
    }
  }
  return warnings;
}

/**
 * Infer warmup hint by index following §35.4 default ladder.
 */
function inferWarmupHint(index, total) {
  if (index === 0) return 'next-frame';
  if (index < 3) return 'idle';
  return 'manual';
}

function inferBundleFromPath(p) {
  // sprites/<bundle>/...
  const segs = String(p).split('/').filter(Boolean);
  if (segs[0] === 'sprites' && segs.length >= 2) return segs[1];
  if (segs[0] === 'fragments' && segs.length >= 2) return segs[1];
  return null;
}

module.exports = {
  buildPreloadManifest,
  inferWarmupHint,
  inferBundleFromPath,
};
