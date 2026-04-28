// doc_id: doc_other_0009 — smart merge for --sync-existing (§4.3 / §36.3 syncDelta)
// merge-mode:
//   - preserve-human (default): existing value 永遠優先；新 fields 補上；衝突列為 manual-edit
//   - html-authoritative: HTML 結果覆寫 existing
//   - dry-run: 只計算 syncDelta，不寫
'use strict';

/**
 * @typedef {object} SyncResult
 * @property {object} layout merged layout
 * @property {object} skin merged skin
 * @property {object[]} fieldChanges  per-field change records for telemetry
 * @property {string[]} conflicts     unresolved conflict descriptions
 */

/**
 * Walk both layout trees keyed by node `name`. Returns merged layout per merge-mode.
 * @param {object} draftLayout
 * @param {object} existingLayout
 * @param {object} draftSkin
 * @param {object} existingSkin
 * @param {object} options
 * @param {string} options.mergeMode
 * @param {string} options.conflictPolicy 'warn' | 'fail'
 * @returns {SyncResult}
 */
function smartMerge(draftLayout, existingLayout, draftSkin, existingSkin, options) {
  const mergeMode = (options && options.mergeMode) || 'preserve-human';
  const fieldChanges = [];
  const conflicts = [];

  const layout = mergeNode(draftLayout, existingLayout, '', mergeMode, fieldChanges, conflicts);

  const skin = mergeSkin(
    draftSkin || { slots: {} },
    existingSkin || { slots: {} },
    mergeMode,
    fieldChanges,
    conflicts,
  );

  return { layout, skin, fieldChanges, conflicts };
}

function mergeNode(draftNode, existingNode, pathStr, mergeMode, fieldChanges, conflicts) {
  if (!draftNode && !existingNode) return null;
  if (!existingNode) {
    if (draftNode) fieldChanges.push({ path: pathStr || '<root>', kind: 'added' });
    return draftNode;
  }
  if (!draftNode) {
    fieldChanges.push({ path: pathStr || '<root>', kind: 'removed-from-html' });
    return mergeMode === 'html-authoritative' ? null : existingNode;
  }

  const merged = {};
  const keys = new Set([...Object.keys(draftNode), ...Object.keys(existingNode)]);
  // M4: data-ucuf-lock — fields listed in _lockedFields are always preserved from existing
  const locked = collectLockedFields(draftNode, existingNode);
  for (const key of keys) {
    if (key === 'children') continue;
    const draftV = draftNode[key];
    const existingV = existingNode[key];
    const fieldPath = pathStr ? `${pathStr}.${key}` : `node.${key}`;
    if (locked && (locked.has('*') || locked.has(key)) && existingV !== undefined) {
      merged[key] = existingV;
      if (!deepEqual(draftV, existingV)) {
        fieldChanges.push({ path: fieldPath, kind: 'locked-preserved' });
      }
      continue;
    }
    if (draftV === undefined) {
      merged[key] = existingV;
    } else if (existingV === undefined) {
      merged[key] = draftV;
      fieldChanges.push({ path: fieldPath, kind: 'added' });
    } else if (deepEqual(draftV, existingV)) {
      merged[key] = existingV;
    } else {
      // conflict
      if (mergeMode === 'html-authoritative') {
        merged[key] = draftV;
        fieldChanges.push({ path: fieldPath, kind: 'overwritten-by-html' });
      } else {
        // preserve-human
        merged[key] = existingV;
        fieldChanges.push({ path: fieldPath, kind: 'manual-edit' });
        if (options_conflictFail(mergeMode)) {
          conflicts.push(`${fieldPath}: existing=${jsonShort(existingV)} html=${jsonShort(draftV)}`);
        }
      }
    }
  }

  // Recurse children, key by stable _ucufId then by node.name
  const draftChildren = Array.isArray(draftNode.children) ? draftNode.children : [];
  const existingChildren = Array.isArray(existingNode.children) ? existingNode.children : [];
  if (draftChildren.length || existingChildren.length) {
    const byId = new Map();
    const byName = new Map();
    for (const ec of existingChildren) {
      if (ec._ucufId) byId.set(ec._ucufId, ec);
      byName.set(ec.name, ec);
    }
    const usedExisting = new Set();
    const mergedChildren = [];
    for (const dc of draftChildren) {
      let existing = null;
      if (dc._ucufId && byId.has(dc._ucufId)) existing = byId.get(dc._ucufId);
      else if (byName.has(dc.name)) existing = byName.get(dc.name);
      const childPath = `${pathStr || merged.name || 'root'}.${dc._ucufId || dc.name}`;
      const childMerged = mergeNode(dc, existing, childPath, mergeMode, fieldChanges, conflicts);
      if (childMerged) mergedChildren.push(childMerged);
      if (existing) usedExisting.add(existing._ucufId || existing.name);
    }
    // existing nodes not seen in draft
    for (const ec of existingChildren) {
      const key = ec._ucufId || ec.name;
      if (!usedExisting.has(key)) {
        if (mergeMode === 'html-authoritative') {
          fieldChanges.push({ path: `${pathStr || 'root'}.${key}`, kind: 'removed-by-html' });
        } else {
          mergedChildren.push(ec);
          fieldChanges.push({ path: `${pathStr || 'root'}.${key}`, kind: 'preserved-existing' });
        }
      }
    }
    merged.children = mergedChildren;
  }

  return merged;
}

function collectLockedFields(draftNode, existingNode) {
  const set = new Set();
  for (const node of [existingNode, draftNode]) {
    if (node && Array.isArray(node._lockedFields)) {
      for (const f of node._lockedFields) set.add(f);
    }
  }
  return set.size > 0 ? set : null;
}

function mergeSkin(draftSkin, existingSkin, mergeMode, fieldChanges, conflicts) {
  const out = { slots: {} };
  if (existingSkin.bundles) out.bundles = existingSkin.bundles.slice();
  if (draftSkin.bundles) {
    const set = new Set([...(out.bundles || []), ...draftSkin.bundles]);
    out.bundles = [...set];
  }
  if (existingSkin.meta) out.meta = Object.assign({}, existingSkin.meta);

  const draftSlots = draftSkin.slots || {};
  const existingSlots = existingSkin.slots || {};
  const keys = new Set([...Object.keys(draftSlots), ...Object.keys(existingSlots)]);
  for (const slotId of keys) {
    const d = draftSlots[slotId];
    const e = existingSlots[slotId];
    const path = `skin.slots.${slotId}`;
    if (!d && e) {
      out.slots[slotId] = e;
      // Existing-only slot is preserved silently.
    } else if (d && !e) {
      out.slots[slotId] = d;
      fieldChanges.push({ path, kind: 'added' });
    } else if (deepEqual(d, e)) {
      out.slots[slotId] = e;
    } else {
      if (mergeMode === 'html-authoritative') {
        out.slots[slotId] = d;
        fieldChanges.push({ path, kind: 'overwritten-by-html' });
      } else {
        out.slots[slotId] = mergeSlotPreserveHuman(d, e, path, fieldChanges);
        if (options_conflictFail(mergeMode)) {
          conflicts.push(`${path}: existing vs html differ on ${diffKeys(d, e).join(',')}`);
        }
      }
    }
  }
  return out;
}

function mergeSlotPreserveHuman(draftSlot, existingSlot, path, fieldChanges) {
  const merged = Object.assign({}, draftSlot, existingSlot);
  // For each key that differs, mark as manual-edit
  for (const k of new Set([...Object.keys(draftSlot || {}), ...Object.keys(existingSlot || {})])) {
    if (!deepEqual(draftSlot[k], existingSlot[k])) {
      fieldChanges.push({ path: `${path}.${k}`, kind: 'manual-edit' });
    }
  }
  return merged;
}

function options_conflictFail(_) { return false; }

function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!deepEqual(a[k], b[k])) return false;
  return true;
}

function diffKeys(a, b) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  const out = [];
  for (const k of keys) if (!deepEqual((a || {})[k], (b || {})[k])) out.push(k);
  return out;
}

function jsonShort(v) {
  try {
    const s = JSON.stringify(v);
    return s.length > 80 ? s.slice(0, 77) + '...' : s;
  } catch (_) { return String(v); }
}

module.exports = { smartMerge };
