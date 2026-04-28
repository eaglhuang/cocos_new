// doc_id: doc_other_0009 — convert per-element computed-style snapshots
// to UCUF skin slots (M14).  Used by dom-to-ui-compare high-fidelity mode.
// Pure function, zero deps.
'use strict';

function parseLength(s) {
  if (!s) return 0;
  const m = String(s).match(/(-?\d+(?:\.\d+)?)px/);
  return m ? parseFloat(m[1]) : 0;
}

// Parse line-height: handles px numbers, unitless ratios, and percentages.
// Returns number for px (for backwards compat), string for unitless/percent.
function parseLineHeight(s) {
  if (!s || s === 'normal') return null;
  const t = String(s).trim();
  // px → number
  const pxm = t.match(/^(-?\d+(?:\.\d+)?)px$/);
  if (pxm) return parseFloat(pxm[1]);
  // unitless ratio (e.g. 1, 1.5, 2) → preserve as string so skin-to-css emits without px
  if (/^-?\d+(?:\.\d+)?$/.test(t)) return t;
  // percentage → preserve as string
  if (/^-?\d+(?:\.\d+)?%$/.test(t)) return t;
  return null;
}

// Border-radius / size lengths can be expressed as percentage. Return the
// original CSS-valid string so the renderer can emit it as-is.
function parseLengthOrPct(s) {
  if (!s) return 0;
  const trimmed = String(s).trim();
  if (/^-?\d+(?:\.\d+)?(px|%)$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/(-?\d+(?:\.\d+)?)px/);
  return m ? m[0] : 0;
}

function parseColor(s) {
  if (!s) return null;
  s = s.trim();
  if (s === 'transparent' || /rgba\(0,\s*0,\s*0,\s*0\)/i.test(s)) return null;
  return s;
}

/**
 * Parse "0px 8px 24px 0px rgba(0, 0, 0, 0.4), 0px 2px 4px ..."
 * → array of { x, y, blur, spread, color, inset }
 */
function parseShadowList(s) {
  if (!s || s === 'none') return [];
  const out = [];
  // Split by commas at top level (not inside parens)
  const parts = [];
  let depth = 0, last = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) { parts.push(s.slice(last, i).trim()); last = i + 1; }
  }
  parts.push(s.slice(last).trim());

  for (const part of parts) {
    if (!part) continue;
    // Extract any rgb(a)/hsl color first
    const colorMatch = part.match(/(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-f]{3,8})/i);
    const color = colorMatch ? colorMatch[1] : null;
    const rest = colorMatch ? part.replace(colorMatch[1], '').trim() : part;
    const inset = /\binset\b/i.test(rest);
    const lengths = (rest.match(/-?\d+(?:\.\d+)?px/g) || []).map(parseLength);
    if (lengths.length >= 2) {
      out.push({
        x: lengths[0], y: lengths[1],
        blur: lengths[2] || 0, spread: lengths[3] || 0,
        color: color || 'rgba(0,0,0,0.4)', inset,
      });
    }
  }
  return out;
}

/**
 * Parse "linear-gradient(180deg, rgb(...) 0%, rgb(...) 100%)"
 * Also handles repeating-linear-gradient / repeating-radial-gradient / repeating-conic-gradient.
 * Returns null if not a gradient.
 */
function parseGradient(s) {
  if (!s || s === 'none') return null;
  // M24: support repeating-* variants
  const m = s.match(/^(repeating-)?(linear|radial|conic)-gradient\((.*)\)$/);
  if (!m) return null;
  const repeating = !!m[1];
  const type = m[2];
  const inside = m[3];
  // Split top-level commas
  const parts = [];
  let depth = 0, last = 0;
  for (let i = 0; i < inside.length; i++) {
    const c = inside[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) { parts.push(inside.slice(last, i).trim()); last = i + 1; }
  }
  parts.push(inside.slice(last).trim());

  let angle = 180, shape = null, center = null;
  let stopParts = parts;
  if (type === 'linear' && parts[0] && /(\d+(\.\d+)?)deg|to /i.test(parts[0])) {
    const deg = parts[0].match(/(-?\d+(?:\.\d+)?)deg/);
    if (deg) angle = parseFloat(deg[1]);
    else {
      // "to top|bottom|left|right"
      const dir = parts[0].toLowerCase();
      if (/to top/.test(dir)) angle = 0;
      else if (/to right/.test(dir)) angle = 90;
      else if (/to bottom/.test(dir)) angle = 180;
      else if (/to left/.test(dir)) angle = 270;
    }
    stopParts = parts.slice(1);
  } else if (type === 'radial' && parts[0] && !/^(rgb|hsl|#)/i.test(parts[0])) {
    shape = parts[0];
    stopParts = parts.slice(1);
  }

  const stops = stopParts.map((p, i) => {
    const colorMatch = p.match(/^(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-f]{3,8}|[a-z]+)/i);
    const color = colorMatch ? colorMatch[1] : '#000';
    const rest = colorMatch ? p.replace(colorMatch[1], '').trim() : p;
    const pctMatch = rest.match(/(-?\d+(?:\.\d+)?)%/);
    const offset = pctMatch ? parseFloat(pctMatch[1]) / 100 : (i / Math.max(1, stopParts.length - 1));
    return { color, offset };
  });

  return { type, repeating, angle, shape, center, stops };
}

/**
 * Parse "linear-gradient(...), url(foo.png), rgb(...)"
 * Returns array of layers.
 */
function parseBackgroundImage(s) {
  if (!s || s === 'none') return [];
  // top-level comma split
  const parts = [];
  let depth = 0, last = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) { parts.push(s.slice(last, i).trim()); last = i + 1; }
  }
  parts.push(s.slice(last).trim());

  return parts.map(p => {
    const g = parseGradient(p);
    if (g) return { kind: 'gradient', gradient: g };
    const m = p.match(/^url\(["']?([^"')]+)["']?\)$/i);
    if (m) return { kind: 'image', url: m[1] };
    return null;
  }).filter(Boolean);
}

function parseTransform(s) {
  if (!s || s === 'none') return [];

  // s is usually "matrix(a, b, c, d, e, f)" — leave as raw single transform.
  // For simplicity we keep the whole string as a single transform value.
  return [{ type: 'raw', value: s }];
}

function parseFilter(s) {
  if (!s || s === 'none') return [];
  const out = [];
  const re = /(\w+(?:-\w+)*)\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(s))) {
    out.push({ type: m[1], value: m[2].trim() });
  }
  return out;
}

/**
 * Convert one snapshot.styles → array of skin slot objects.
 * Each slot is independent and applied at the same node.
 */
function snapshotToSlots(styles, opts) {
  opts = opts || {};
  const slots = [];

  // 1. background — color and / or image (gradient + url)
  const bgColor = parseColor(styles['background-color']);
  const bgLayers = parseBackgroundImage(styles['background-image']);

  if (bgLayers.length === 0 && bgColor) {
    slots.push({ kind: 'color-rect', color: bgColor });
  } else if (bgLayers.length === 1 && bgLayers[0].kind === 'gradient') {
    slots.push({ kind: 'gradient-rect', gradient: bgLayers[0].gradient });
    if (bgColor) slots.push({ kind: 'color-rect', color: bgColor });
  } else if (bgLayers.length > 1 || (bgLayers.length === 1 && bgColor)) {
    const all = bgLayers.slice();
    if (bgColor) all.push({ kind: 'color', color: bgColor });
    slots.push({ kind: 'multi-layer-rect', layers: all });
  }

  // Background subprops — emit a raw passthrough slot so renderer can replay them
  const bgSize = styles['background-size'];
  const bgPos = styles['background-position'];
  const bgRep = styles['background-repeat'];
  if ((bgSize && bgSize !== 'auto') || (bgPos && bgPos !== '0% 0%') || (bgRep && bgRep !== 'repeat')) {
    slots.push({
      kind: 'background-modifiers',
      size: bgSize, position: bgPos, repeat: bgRep,
    });
  }

  // 2. border — M25-B: read all 4 sides individually
  const sides4 = ['top', 'right', 'bottom', 'left'];
  const sideWidths = sides4.map(s => parseLength(styles[`border-${s}-width`]));
  const sideStyles = sides4.map(s => styles[`border-${s}-style`] || 'none');
  const sideColors = sides4.map(s => parseColor(styles[`border-${s}-color`]));
  const r1 = parseLengthOrPct(styles['border-top-left-radius']);
  const r2 = parseLengthOrPct(styles['border-top-right-radius']);
  const r3 = parseLengthOrPct(styles['border-bottom-right-radius']);
  const r4 = parseLengthOrPct(styles['border-bottom-left-radius']);
  const anyBorderActive = sideWidths.some((w, i) => w > 0 && sideStyles[i] !== 'none');
  if (anyBorderActive || r1 || r2 || r3 || r4) {
    const slot = { kind: 'border-style', border: {} };
    if (anyBorderActive) {
      const uniformW = sideWidths.every(w => w === sideWidths[0]);
      const uniformS = sideStyles.every(s => s === sideStyles[0]);
      const uniformC = sideColors.every(c => c === sideColors[0]);
      if (uniformW && uniformS && uniformC && sideWidths[0] > 0 && sideStyles[0] !== 'none') {
        // Uniform → keep shorthand
        slot.border.width = sideWidths[0];
        slot.border.style = sideStyles[0];
        slot.border.color = sideColors[0] || '#000';
      } else {
        // Per-side
        slot.border.sides = {};
        sides4.forEach((s, i) => {
          if (sideWidths[i] > 0 && sideStyles[i] !== 'none') {
            slot.border.sides[s] = { width: sideWidths[i], style: sideStyles[i], color: sideColors[i] || '#000' };
          }
        });
      }
    }
    if (r1 || r2 || r3 || r4) {
      slot.border.radius = (r1 === r2 && r2 === r3 && r3 === r4) ? r1 : { tl: r1, tr: r2, br: r3, bl: r4 };
    }
    slots.push(slot);
  }

  // 3. shadows
  const boxShadows = parseShadowList(styles['box-shadow']);
  const textShadows = parseShadowList(styles['text-shadow']);
  if (boxShadows.length || textShadows.length) {
    slots.push({ kind: 'shadow-set', boxShadows, textShadows });
  }

  // 4. filter / transform
  const filters = parseFilter(styles['filter']);
  if (filters.length) slots.push({ kind: 'filter-stack', filters });
  const backFilters = parseFilter(styles['backdrop-filter']);
  if (backFilters.length) slots.push({ kind: 'filter-stack', filters: backFilters, target: 'backdrop' });
  const transforms = parseTransform(styles['transform']);
  if (transforms.length) slots.push({ kind: 'transform-stack', transforms, origin: styles['transform-origin'] || null });

  // 5. clip / mask
  const clip = styles['clip-path'] || styles['-webkit-clip-path'];
  const mask = styles['mask-image'] || styles['-webkit-mask-image'];
  if ((clip && clip !== 'none') || (mask && mask !== 'none')) {
    slots.push({ kind: 'mask-and-clip', clipPath: clip !== 'none' ? clip : null, maskImage: mask !== 'none' ? mask : null });
  }

  // 6. opacity / blend
  const op = parseFloat(styles['opacity']);
  const blend = styles['mix-blend-mode'];
  const iso = styles['isolation'];
  if ((!isNaN(op) && op < 1) || (blend && blend !== 'normal') || (iso && iso !== 'auto')) {
    slots.push({ kind: 'opacity-and-blend', opacity: !isNaN(op) ? op : 1, mixBlendMode: blend, isolation: iso });
  }

  // 7. label-style (if has text content or is a leaf with text)
  if (opts.hasText) {
    const slot = {
      kind: 'label-style',
      color: parseColor(styles['color']),
      fontSize: parseLength(styles['font-size']),
      lineHeight: parseLineHeight(styles['line-height']),
      letterSpacing: styles['letter-spacing'] && styles['letter-spacing'] !== 'normal' ? parseLength(styles['letter-spacing']) : null,
      fontWeight: styles['font-weight'] && styles['font-weight'] !== 'normal' && styles['font-weight'] !== '400' ? styles['font-weight'] : null,
      fontFamily: styles['font-family'] || null,
      textAlign: styles['text-align'] && styles['text-align'] !== 'start' ? styles['text-align'] : null,
    };
    // Strip nulls for cleanliness
    for (const k of Object.keys(slot)) if (slot[k] == null) delete slot[k];
    slots.push(slot);
  }

  // 8. text-decoration
  const tdLine = styles['text-decoration-line'];
  const tdColor = styles['text-decoration-color'];
  const tdStyle = styles['text-decoration-style'];
  const tdThick = parseLength(styles['text-decoration-thickness']);
  const strokeWidth = parseLength(styles['-webkit-text-stroke-width']);
  if ((tdLine && tdLine !== 'none') || strokeWidth > 0) {
    const slot = { kind: 'text-decoration' };
    if (tdLine && tdLine !== 'none') {
      slot.decoration = { line: tdLine, color: parseColor(tdColor), style: tdStyle, thickness: tdThick };
    }
    if (strokeWidth > 0) {
      slot.textStroke = { width: strokeWidth, color: parseColor(styles['-webkit-text-stroke-color']) };
    }
    slots.push(slot);
  }

  return slots;
}

module.exports = { snapshotToSlots, parseShadowList, parseGradient, parseBackgroundImage, parseLength };
