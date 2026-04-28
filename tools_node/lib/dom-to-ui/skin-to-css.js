// doc_id: doc_other_0009 — skin slot → CSS reverse renderer (M15)
// Translates a UCUF skin slot back to a CSS declaration string for the
// dom-to-ui-compare high-fidelity preview.  Pure function, zero deps.
'use strict';

function resolveColor(value, tokenMap) {
  if (!value) return null;
  if (typeof value !== 'string') return null;
  // direct hex / rgba pass-through
  if (/^(#|rgb|rgba|hsl|hsla)/i.test(value)) return value;
  // token lookup
  if (tokenMap && tokenMap[value]) return tokenMap[value];
  return value; // last-resort: pass-through (may be a CSS keyword)
}

function shadowToCss(s) {
  // s = { x, y, blur, spread, color, inset }
  const parts = [];
  if (s.inset) parts.push('inset');
  parts.push(`${s.x || 0}px`);
  parts.push(`${s.y || 0}px`);
  parts.push(`${s.blur || 0}px`);
  if (s.spread !== undefined) parts.push(`${s.spread}px`);
  parts.push(s.color || 'rgba(0,0,0,0.4)');
  return parts.join(' ');
}

function gradientToCss(g, tokenMap) {
  const stops = (g.stops || [])
    .map(st => `${resolveColor(st.color, tokenMap) || '#000'} ${(st.offset != null ? Math.round(st.offset * 100) + '%' : '')}`.trim())
    .join(', ');
  // M24: repeating-* prefix support
  const pfx = g.repeating ? 'repeating-' : '';
  if (g.type === 'radial') {
    // g.shape may already include "at <pos>" (e.g. "circle at 40% 35%"), so
    // only append "at <center>" when no position is encoded yet.
    const shape = g.shape || 'ellipse';
    if (/\bat\b/.test(shape)) {
      return `${pfx}radial-gradient(${shape}, ${stops})`;
    }
    return `${pfx}radial-gradient(${shape} at ${g.center || 'center'}, ${stops})`;
  }
  if (g.type === 'conic') {
    return `${pfx}conic-gradient(from ${g.angle || 0}deg, ${stops})`;
  }
  return `${pfx}linear-gradient(${g.angle != null ? g.angle : 180}deg, ${stops})`;
}

/**
 * Translate one slot to a CSS declaration string.
 * Returns "" if the slot is unrenderable.
 * @param {object} slot
 * @param {object} tokenMap
 */
function slotToCss(slot, tokenMap) {
  if (!slot || typeof slot !== 'object') return '';
  tokenMap = tokenMap || {};
  const out = [];

  switch (slot.kind) {
    case 'color-rect': {
      const hex = resolveColor(slot.color, tokenMap) || '#888';
      out.push(`background-color:${hex};`);
      if (slot.opacity != null && slot.opacity < 1) out.push(`opacity:${slot.opacity};`);
      break;
    }
    case 'gradient-rect': {
      if (slot.gradient) {
        out.push(`background:${gradientToCss(slot.gradient, tokenMap)};`);
      }
      break;
    }
    case 'multi-layer-rect': {
      const layers = (slot.layers || []).map(layer => {
        if (layer.kind === 'gradient' && layer.gradient) return gradientToCss(layer.gradient, tokenMap);
        if (layer.kind === 'image' && layer.url) return `url(${layer.url})`;
        if (layer.kind === 'color') return resolveColor(layer.color, tokenMap) || '#000';
        return null;
      }).filter(Boolean);
      if (layers.length) out.push(`background:${layers.join(', ')};`);
      break;
    }
    case 'shadow-set': {
      if (slot.boxShadows && slot.boxShadows.length) {
        out.push(`box-shadow:${slot.boxShadows.map(shadowToCss).join(', ')};`);
      }
      if (slot.textShadows && slot.textShadows.length) {
        out.push(`text-shadow:${slot.textShadows.map(shadowToCss).join(', ')};`);
      }
      break;
    }
    case 'border-style': {
      const b = slot.border || {};
      if (b.sides) {
        // M25-B: per-side borders
        ['top', 'right', 'bottom', 'left'].forEach(s => {
          const sd = b.sides[s];
          if (sd) out.push(`border-${s}:${sd.width || 1}px ${sd.style || 'solid'} ${resolveColor(sd.color, tokenMap) || '#000'};`);
        });
      } else if (b.width || b.style || b.color) {
        out.push(`border:${b.width || 1}px ${b.style || 'solid'} ${resolveColor(b.color, tokenMap) || '#000'};`);
      }
      const r = b.radius;
      // r may be a number (legacy px) or a CSS-valid string ("50%" or "42px")
      // or an object with per-corner values of either type.
      const fmt = (v) => {
        if (v == null || v === 0) return '0';
        if (typeof v === 'number') return `${v}px`;
        return String(v); // already CSS-valid (e.g. "50%", "42px")
      };
      if (r != null && (typeof r === 'number' || typeof r === 'string')) {
        out.push(`border-radius:${fmt(r)};`);
      } else if (r && typeof r === 'object') {
        out.push(`border-radius:${fmt(r.tl)} ${fmt(r.tr)} ${fmt(r.br)} ${fmt(r.bl)};`);
      }
      break;
    }
    case 'filter-stack': {
      const filters = (slot.filters || []).map(f => `${f.type}(${f.value})`).join(' ');
      if (filters) out.push(`filter:${filters};`);
      break;
    }
    case 'transform-stack': {
      const transforms = (slot.transforms || [])
        .filter(t => t && t.type && t.value !== '')
        .map(t => {
          // 'raw' marker = browser-resolved matrix() / matrix3d().
          // The matrix already encodes any translate/rotate/skew/scale
          // applied to the element. Because we position elements at their
          // post-transform viewport rect (or rect-delta in tree mode), applying
          // the matrix again would double-shift them. Drop matrix-only entries.
          if (t.type === 'raw') return null;
          return `${t.type}(${t.value})`;
        })
        .filter(Boolean)
        .join(' ');
      if (!transforms) return '';
      if (transforms) out.push(`transform:${transforms};`);
      if (slot.origin) out.push(`transform-origin:${slot.origin};`);
      break;
    }
    case 'mask-and-clip': {
      if (slot.clipPath) out.push(`clip-path:${slot.clipPath};`);
      if (slot.maskImage) out.push(`-webkit-mask-image:${slot.maskImage};mask-image:${slot.maskImage};`);
      break;
    }
    case 'opacity-and-blend': {
      if (slot.opacity != null) out.push(`opacity:${slot.opacity};`);
      if (slot.mixBlendMode) out.push(`mix-blend-mode:${slot.mixBlendMode};`);
      if (slot.isolation) out.push(`isolation:${slot.isolation};`);
      break;
    }
    case 'label-style': {
      const hex = resolveColor(slot.color, tokenMap) || '#e5e2e1';
      out.push(`color:${hex};`);
      if (slot.fontSize) out.push(`font-size:${slot.fontSize}px;`);
      if (slot.lineHeight != null && slot.lineHeight !== '') {
        // number → px (e.g. 28 → '28px'); string → as-is (unitless ratio '1', pct '150%')
        out.push(`line-height:${typeof slot.lineHeight === 'number' ? slot.lineHeight + 'px' : slot.lineHeight};`);
      }
      if (slot.letterSpacing != null) out.push(`letter-spacing:${slot.letterSpacing}px;`);
      if (slot.fontWeight) out.push(`font-weight:${slot.fontWeight};`);
      if (slot.fontFamily) out.push(`font-family:${slot.fontFamily};`);
      if (slot.textAlign) out.push(`text-align:${slot.textAlign};`);
      break;
    }
    case 'text-decoration': {
      const d = slot.decoration || {};
      if (d.line) out.push(`text-decoration:${d.line} ${d.style || 'solid'} ${resolveColor(d.color, tokenMap) || 'currentColor'};`);
      if (d.thickness) out.push(`text-decoration-thickness:${d.thickness}px;`);
      if (slot.textStroke) out.push(`-webkit-text-stroke:${slot.textStroke.width || 1}px ${resolveColor(slot.textStroke.color, tokenMap) || '#000'};`);
      if (slot.fontFeatureSettings) out.push(`font-feature-settings:${slot.fontFeatureSettings};`);
      break;
    }
    case 'image': {
      if (slot.spriteFrame || slot.url) {
        const url = slot.url || slot.spriteFrame;
        out.push(`background-image:url(${url});background-size:${slot.fit || 'cover'};background-repeat:no-repeat;background-position:center;`);
      }
      break;
    }
    case 'pseudo-overlay': {
      // rendered as sibling div by caller; no inline style here.
      break;
    }
    case 'background-modifiers': {
      if (slot.size)     out.push(`background-size:${slot.size};`);
      if (slot.position) out.push(`background-position:${slot.position};`);
      if (slot.repeat)   out.push(`background-repeat:${slot.repeat};`);
      break;
    }
    default:
      break;
  }
  return out.join('');
}

module.exports = { slotToCss, gradientToCss, shadowToCss, resolveColor };
