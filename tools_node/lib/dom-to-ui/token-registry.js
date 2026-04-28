// doc_id: doc_other_0009 — design token reverse lookup for dom-to-ui
'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const DEFAULT_RUNTIME_TOKENS = path.join(REPO_ROOT, 'assets', 'resources', 'ui-spec', 'ui-design-tokens.json');
const DEFAULT_HANDOFF_TOKENS = path.join(REPO_ROOT, 'Design System', 'design_handoff', 'source', 'ui-design-tokens.json');

function loadTokenRegistry(options) {
  const opts = options || {};
  const sources = {
    runtimePath: opts.runtimePath || DEFAULT_RUNTIME_TOKENS,
    handoffPath: opts.handoffPath || DEFAULT_HANDOFF_TOKENS,
    sourcePath: opts.sourcePath || opts.tokensSource || opts.sourceTokenPath || null,
  };
  const handoff = readJsonIfExists(sources.handoffPath);
  const runtime = readJsonIfExists(sources.runtimePath);
  const source = readJsonIfExists(sources.sourcePath);
  const mergeResult = mergeTokenRootsWithSources([
    { name: 'handoff', path: sources.handoffPath, root: handoff },
    { name: 'runtime', path: sources.runtimePath, root: runtime },
    { name: 'source', path: sources.sourcePath, root: source },
  ]);
  const merged = mergeResult.merged;

  const colorByHex = new Map();
  const cssVars = new Map();
  const spacingByValue = new Map();
  const typographyByMetric = new Map();

  buildColorMaps(merged.colors || {}, colorByHex, cssVars);
  buildSpacingMaps(merged.spacing || {}, spacingByValue, cssVars);
  buildTypographyMaps(merged.typography || {}, typographyByMetric, cssVars);

  return {
    colors: merged.colors || {},
    spacing: merged.spacing || {},
    typography: merged.typography || {},
    colorByHex,
    cssVars,
    spacingByValue,
    typographyByMetric,
    sources,
    conflicts: mergeResult.conflicts,
  };
}

function readJsonIfExists(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
  } catch (_) {
    return {};
  }
}

function mergeTokenRoots(...roots) {
  return mergeTokenRootsWithSources(roots.map((root, index) => ({ name: `root${index}`, path: null, root }))).merged;
}

function mergeTokenRootsWithSources(entries) {
  const merged = { colors: {}, spacing: {}, typography: {} };
  const seen = { colors: {}, spacing: {}, typography: {} };
  const conflicts = [];
  for (const entry of entries || []) {
    const root = entry && entry.root;
    if (!root || typeof root !== 'object') continue;
    for (const section of ['colors', 'spacing', 'typography']) {
      for (const [token, value] of Object.entries(root[section] || {})) {
        const previous = seen[section][token];
        if (previous && JSON.stringify(previous.value) !== JSON.stringify(value)) {
          conflicts.push({
            section,
            token,
            previousSource: previous.source,
            previousPath: previous.path,
            source: entry.name,
            path: entry.path,
            previousValue: previous.value,
            value,
            chosenSource: entry.name,
          });
        }
        merged[section][token] = value;
        seen[section][token] = { source: entry.name, path: entry.path, value };
      }
    }
  }
  return { merged, conflicts };
}

function buildColorMaps(colors, colorByHex, cssVars) {
  for (const [token, value] of Object.entries(colors)) {
    const hex = normalizeHex(value);
    if (!hex) continue;
    if (!colorByHex.has(hex)) colorByHex.set(hex, token);
    for (const cssVar of tokenToCssVars(token, 'color')) {
      cssVars.set(cssVar, { kind: 'color', token, value: hex });
    }
  }
}

function buildSpacingMaps(spacing, spacingByValue, cssVars) {
  for (const [token, value] of Object.entries(spacing)) {
    if (!Number.isFinite(value)) continue;
    if (!spacingByValue.has(value)) spacingByValue.set(value, token);
    for (const cssVar of tokenToCssVars(token, 'spacing')) {
      cssVars.set(cssVar, { kind: 'spacing', token: `spacing.${token}`, value });
    }
  }
}

function buildTypographyMaps(typography, typographyByMetric, cssVars) {
  for (const [token, value] of Object.entries(typography)) {
    if (!value || typeof value !== 'object') continue;
    const fontSize = asNumber(value.fontSize);
    const lineHeight = asNumber(value.lineHeight);
    if (fontSize != null && lineHeight != null) {
      typographyByMetric.set(`${fontSize}/${lineHeight}`, token);
    }
    if (fontSize != null) {
      cssVars.set(`--font-size-${toKebab(token)}`, { kind: 'fontSize', token: `typography.${token}.fontSize`, value: fontSize });
    }
    if (lineHeight != null) {
      cssVars.set(`--line-height-${toKebab(token)}`, { kind: 'lineHeight', token: `typography.${token}.lineHeight`, value: lineHeight });
    }
  }
}

function tokenToCssVars(token, prefix) {
  const kebab = toKebab(token);
  return [`--${kebab}`, `--${prefix}-${kebab}`];
}

function toKebab(value) {
  return String(value)
    .replace(/\./g, '-')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

function normalizeHex(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  let m = v.match(/^#([0-9a-f]{3})$/);
  if (m) return '#' + m[1].split('').map(c => c + c).join('');
  m = v.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/);
  if (!m) return null;
  return '#' + m[1];
}

function asNumber(value) {
  if (Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

module.exports = {
  loadTokenRegistry,
  mergeTokenRoots,
  normalizeHex,
  toKebab,
};