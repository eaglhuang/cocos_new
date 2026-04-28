#!/usr/bin/env node
// doc_id: doc_other_0009 — UCUF skin auto-fix: button state layers + token migration
//
// Purpose:
//   Two quality auto-fixers driven by sidecar reports:
//   1. visual-review.stateLayerIssues -> auto-derive hover/pressed/disabled
//      variants from base color (lighten/darken via HSL math). Adds a
//      `states: { normal, hover, pressed, disabled }` block to each affected
//      skin slot.
//   2. r-guard.unmappedToken (warn) -> scan skin for hard-coded hex colors,
//      emit a `token-suggestions.json` mapping that human can review and
//      patch into ui-design-tokens.json. Optionally apply automatically
//      with `--apply-tokens` (idempotent: only adds; never overwrites).
//
// Usage:
//   node tools_node/auto-fix-ucuf-skin.js \
//     --skin assets/resources/ui-spec/skins/<screen>.skin.json \
//     --visual-review assets/resources/ui-spec/screens/<screen>.visual-review.json \
//     [--token-map assets/resources/ui-spec/ui-design-tokens.json] \
//     [--apply-tokens] \
//     [--report artifacts/<screen>.skin-autofix.json]
//
'use strict';

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const opts = {
    skin: null, visualReview: null, tokenMap: null, report: null,
    applyTokens: false, dryRun: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--skin': opts.skin = next(); break;
      case '--visual-review': opts.visualReview = next(); break;
      case '--token-map': opts.tokenMap = next(); break;
      case '--apply-tokens': opts.applyTokens = true; break;
      case '--report': opts.report = next(); break;
      case '--dry-run': opts.dryRun = true; break;
      case '--help': case '-h':
        console.log('Usage: auto-fix-ucuf-skin.js --skin <json> [--visual-review <json>] [--token-map <json>] [--apply-tokens] [--report <json>] [--dry-run]');
        process.exit(0);
        break;
      default:
        console.error(`[auto-fix-ucuf-skin] unknown arg: ${a}`);
        process.exit(2);
    }
  }
  if (!opts.skin) {
    console.error('[auto-fix-ucuf-skin] --skin is required');
    process.exit(2);
  }
  return opts;
}

// --- Color math --------------------------------------------------------
function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return { r: (v >> 16) & 0xff, g: (v >> 8) & 0xff, b: v & 0xff };
}
function rgbToHex({ r, g, b }) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = ((b - r) / d + 2);
    else h = ((r - g) / d + 4);
    h /= 6;
  }
  return { h, s, l };
}
function hslToRgb({ h, s, l }) {
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r: r * 255, g: g * 255, b: b * 255 };
}
function adjustLightness(hex, deltaL) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const hsl = rgbToHsl(rgb);
  hsl.l = Math.max(0, Math.min(1, hsl.l + deltaL));
  return rgbToHex(hslToRgb(hsl));
}

function deriveStates(baseColor, tokenMap) {
  // Resolve token if needed
  let baseHex = baseColor;
  let needsReview = false;
  // Sentinel from dom-to-ui-json upstream parser
  if (baseColor === 'unmappedColor' || baseColor === 'unknown' || baseColor === 'auto') {
    baseHex = '#404a5c'; // neutral surface fallback for buttons
    needsReview = true;
  } else if (!/^#/.test(baseColor) && tokenMap[baseColor]) {
    baseHex = tokenMap[baseColor];
  }
  if (!/^#[0-9a-f]{6}$/i.test(baseHex)) {
    return null;
  }
  return {
    normal: baseColor,
    hover: adjustLightness(baseHex, +0.08),
    pressed: adjustLightness(baseHex, -0.08),
    disabled: adjustLightness(baseHex, -0.20),
    _needsManualReview: needsReview || undefined,
  };
}

// --- Token migration ---------------------------------------------------
function findHardcodedHex(skin) {
  // Walk skin.slots and collect any hex colors not already token-named.
  const findings = [];
  for (const [slotKey, slot] of Object.entries(skin.slots || {})) {
    for (const [field, val] of Object.entries(slot)) {
      if (typeof val !== 'string') continue;
      if (/^#[0-9a-f]{3,8}$/i.test(val)) {
        findings.push({ slotKey, field, value: val });
      }
    }
  }
  return findings;
}

function suggestTokenName(slotKey, field, value) {
  // Heuristic: <slotFamily>.<fieldKind>.<valueHash>
  const family = slotKey.split('.').slice(-1)[0].replace(/_\d+$/, '').slice(0, 24);
  const kind = /color/i.test(field) ? 'color' : field;
  const short = value.replace('#', '').toLowerCase().slice(0, 6);
  return `auto_${family}_${kind}_${short}`;
}

// --- Main --------------------------------------------------------------
function main() {
  const opts = parseArgs(process.argv);
  const skin = JSON.parse(fs.readFileSync(opts.skin, 'utf8'));

  // Load token map
  let tokenMap = {};
  let tokenMapPath = opts.tokenMap;
  if (!tokenMapPath) {
    const cands = [
      path.join(__dirname, '..', 'assets', 'resources', 'ui-spec', 'ui-design-tokens.json'),
      path.join(__dirname, '..', 'Design System', 'design_handoff', 'source', 'ui-design-tokens.json'),
    ];
    tokenMapPath = cands.find(p => fs.existsSync(p));
  }
  let tokenJson = null;
  if (tokenMapPath && fs.existsSync(tokenMapPath)) {
    tokenJson = JSON.parse(fs.readFileSync(tokenMapPath, 'utf8'));
    tokenMap = tokenJson.colors || {};
  }

  // 1. Visual-review state-layer fixup
  let visualReview = null;
  const stateLayerAdded = [];
  if (opts.visualReview && fs.existsSync(opts.visualReview)) {
    visualReview = JSON.parse(fs.readFileSync(opts.visualReview, 'utf8'));
    const issues = visualReview.stateLayerIssues || [];
    for (const issue of issues) {
      const slot = skin.slots && skin.slots[issue.skinSlot];
      if (!slot) continue;
      if (slot.states && slot.states.hover) continue; // already done
      const baseColor = slot.color || slot.background || '#888888';
      const states = deriveStates(baseColor, tokenMap);
      if (!states) continue;
      slot.states = states;
      stateLayerAdded.push({ skinSlot: issue.skinSlot, base: baseColor, states });
    }
  }

  // 2. Token migration
  const findings = findHardcodedHex(skin);
  const suggestions = [];
  const valueToToken = new Map();
  // Build reverse map of existing tokens to value
  for (const [k, v] of Object.entries(tokenMap)) {
    if (typeof v === 'string') valueToToken.set(v.toLowerCase(), k);
  }
  for (const f of findings) {
    const lc = f.value.toLowerCase();
    if (valueToToken.has(lc)) {
      suggestions.push({ ...f, suggested: valueToToken.get(lc), reason: 'existing-token-match' });
      continue;
    }
    const newToken = suggestTokenName(f.slotKey, f.field, f.value);
    suggestions.push({ ...f, suggested: newToken, reason: 'new-token-needed' });
    if (opts.applyTokens && tokenJson) {
      tokenJson.colors = tokenJson.colors || {};
      if (!tokenJson.colors[newToken]) {
        tokenJson.colors[newToken] = f.value;
        valueToToken.set(lc, newToken);
      }
    }
  }

  // 3. Apply token replacements in skin (only when --apply-tokens)
  let tokenReplacements = 0;
  if (opts.applyTokens) {
    for (const f of findings) {
      const lc = f.value.toLowerCase();
      const tname = valueToToken.get(lc);
      if (tname && skin.slots[f.slotKey][f.field] === f.value) {
        skin.slots[f.slotKey][f.field] = tname;
        tokenReplacements += 1;
      }
    }
  }

  const report = {
    skin: opts.skin,
    stateLayer: { added: stateLayerAdded.length, samples: stateLayerAdded.slice(0, 5) },
    tokens: {
      hardcodedFound: findings.length,
      suggestionsTotal: suggestions.length,
      newTokensProposed: suggestions.filter(s => s.reason === 'new-token-needed').length,
      reused: suggestions.filter(s => s.reason === 'existing-token-match').length,
      applied: tokenReplacements,
      sample: suggestions.slice(0, 10),
    },
  };

  if (opts.dryRun) {
    console.log(`[auto-fix-ucuf-skin] dry-run: stateLayer+=${stateLayerAdded.length} tokens-suggested=${suggestions.length} would-apply=${tokenReplacements}`);
  } else {
    if (stateLayerAdded.length || tokenReplacements) {
      fs.writeFileSync(opts.skin, JSON.stringify(skin, null, 2), 'utf8');
    }
    if (opts.applyTokens && tokenJson && tokenMapPath) {
      fs.writeFileSync(tokenMapPath, JSON.stringify(tokenJson, null, 2), 'utf8');
    }
    console.log(`[auto-fix-ucuf-skin] wrote ${opts.skin}: stateLayer+=${stateLayerAdded.length} tokens-replaced=${tokenReplacements} suggestions=${suggestions.length}`);
  }

  if (opts.report) {
    const rDir = path.dirname(path.resolve(opts.report));
    if (!fs.existsSync(rDir)) fs.mkdirSync(rDir, { recursive: true });
    fs.writeFileSync(opts.report, JSON.stringify(report, null, 2), 'utf8');
  }
}

main();
