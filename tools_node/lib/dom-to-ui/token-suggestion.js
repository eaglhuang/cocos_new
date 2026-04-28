// doc_id: doc_other_0009 — Design Token Auto-Discovery (M18)
// Scans snapshots for unmapped colors/fonts/spacing and proposes new tokens
// with nearest-existing comparison.  Pure module; CLI accept flow lives in
// dom-to-ui-feedback.js.
'use strict';

function hexToRgb(hex) {
  if (!hex || hex[0] !== '#') return null;
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6 && h.length !== 8) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbStringToRgb(s) {
  if (!s) return null;
  const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3] };
  return null;
}

function parseColor(s) {
  if (!s) return null;
  if (s.startsWith('#')) return hexToRgb(s);
  return rgbStringToRgb(s);
}

function rgbDistance(a, b) {
  if (!a || !b) return Infinity;
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

/**
 * @param {object} args { snapshots, tokenMap (name->hex) }
 */
function buildTokenSuggestions(args) {
  const snapshots = args.snapshots || [];
  const tokenMap = args.tokenMap || {};
  const tokenList = Object.entries(tokenMap)
    .map(([name, hex]) => ({ name, hex, rgb: parseColor(hex) }))
    .filter(t => t.rgb);

  const seenColors = new Map();   // value → { occurrences, samples }
  const seenFonts = new Map();
  const seenSpacing = new Map();

  for (const s of snapshots) {
    const st = s.styles || {};
    // Colors
    for (const prop of ['background-color', 'color', 'border-top-color']) {
      const v = st[prop];
      if (!v || v === 'transparent') continue;
      if (!seenColors.has(v)) seenColors.set(v, { occurrences: 0, samples: [] });
      const e = seenColors.get(v);
      e.occurrences++;
      if (e.samples.length < 3) e.samples.push({ path: s.path, prop });
    }
    // Fonts
    if (st['font-family']) {
      const ff = st['font-family'];
      if (!seenFonts.has(ff)) seenFonts.set(ff, { occurrences: 0, samples: [] });
      seenFonts.get(ff).occurrences++;
    }
    // Spacing (font-size / letter-spacing as proxies)
    for (const prop of ['font-size', 'letter-spacing']) {
      const v = st[prop];
      if (!v || v === 'normal') continue;
      const k = `${prop}=${v}`;
      if (!seenSpacing.has(k)) seenSpacing.set(k, { occurrences: 0, prop, value: v });
      seenSpacing.get(k).occurrences++;
    }
  }

  const colorSuggestions = [];
  for (const [value, info] of seenColors) {
    const rgb = parseColor(value);
    if (!rgb) continue;
    let nearest = null;
    let best = Infinity;
    for (const t of tokenList) {
      const d = rgbDistance(rgb, t.rgb);
      if (d < best) { best = d; nearest = t; }
    }
    // Skip if exact match in token map already
    if (nearest && best < 0.5) continue;
    colorSuggestions.push({
      value,
      occurrences: info.occurrences,
      nearestExisting: nearest ? { token: nearest.name, value: nearest.hex, distance: Math.round(best) } : null,
      suggestedToken: null, // reviewer fills in
      samples: info.samples,
    });
  }

  const fontSuggestions = Array.from(seenFonts.entries()).map(([value, info]) => ({
    value,
    occurrences: info.occurrences,
  }));

  const spacingSuggestions = Array.from(seenSpacing.values());

  return { colorSuggestions, fontSuggestions, spacingSuggestions };
}

module.exports = { buildTokenSuggestions };
