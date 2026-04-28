// doc_id: doc_other_0009 — skin slot kind catalog (M14)
// Defines the canonical set of slot.kind values that skin draft can emit.
// Each kind is a closed schema; validate-ui-specs.js consults this file.
'use strict';

const KNOWN_KINDS = Object.freeze([
  // Original
  'color',
  'color-rect',
  'label-style',
  'image',
  'sprite-frame',
  'sprite-9slice',
  'button-skin',
  'toggle-style',
  // M14 expansions
  'gradient-rect',
  'multi-layer-rect',
  'shadow-set',
  'border-style',
  'filter-stack',
  'transform-stack',
  'mask-and-clip',
  'opacity-and-blend',
  'text-decoration',
  'pseudo-overlay',
  'background-modifiers',
  // Sentinel: node has no painted background. Runtime should render no Sprite/color.
  'transparent',
]);

function isKnownKind(k) { return KNOWN_KINDS.indexOf(k) >= 0; }

module.exports = { KNOWN_KINDS, isKnownKind };
