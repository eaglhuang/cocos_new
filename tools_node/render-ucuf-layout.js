#!/usr/bin/env node
// doc_id: doc_other_0009 — UCUF layout/skin JSON -> HTML renderer
//
// Purpose:
//   Round-trip verification for `dom-to-ui-json.js`. Reads layout JSON +
//   skin JSON, emits an HTML approximation that can be screenshotted by
//   puppeteer and pixel-diffed against the original HTML source. Without
//   this, UCUF JSON output has no automated fidelity gate.
//
// Schema covered:
//   layout: { canvas, type, name, widget, layout, width, height, skinSlot,
//             styleSlot, text, children, _sourceStyle (debug only) }
//   skin:   { slots: { <slot>: { kind: color-rect|label-style|sprite-frame,
//                                color, opacity, font, fontSize, lineHeight,
//                                letterSpacing, color, ... } } }
//   This is intentionally a STRUCTURAL renderer. It does not reproduce
//   3D transforms, perspective, complex gradients, drop-shadows, or
//   keyframe animations. Those are out of scope for fidelity gate.
//
// Usage:
//   node tools_node/render-ucuf-layout.js \
//     --layout assets/resources/ui-spec/layouts/<screen>.json \
//     --skin   assets/resources/ui-spec/skins/<screen>.skin.json \
//     --output artifacts/skill-test-html-to-ucuf/<screen>.ucuf-preview.html \
//     [--token-map assets/resources/ui-spec/ui-design-tokens.json]
//
'use strict';

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const opts = { layout: null, skin: null, output: null, tokenMap: null };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--layout': opts.layout = next(); break;
      case '--skin': opts.skin = next(); break;
      case '--output': opts.output = next(); break;
      case '--token-map': opts.tokenMap = next(); break;
      case '--help':
      case '-h':
        console.log('Usage: render-ucuf-layout.js --layout <json> --skin <json> --output <html> [--token-map <json>]');
        process.exit(0);
        break;
      default:
        console.error(`[render-ucuf-layout] unknown arg: ${a}`);
        process.exit(2);
    }
  }
  if (!opts.layout || !opts.output) {
    console.error('[render-ucuf-layout] --layout and --output are required');
    process.exit(2);
  }
  return opts;
}

function loadTokenMap(overridePath) {
  const candidates = [
    overridePath,
    path.join(__dirname, '..', 'assets', 'resources', 'ui-spec', 'ui-design-tokens.json'),
    path.join(__dirname, '..', 'Design System', 'design_handoff', 'source', 'ui-design-tokens.json'),
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const obj = JSON.parse(fs.readFileSync(p, 'utf8'));
        const colors = obj.colors || {};
        const map = {};
        for (const [k, v] of Object.entries(colors)) {
          if (typeof v === 'string') map[k] = v;
        }
        return map;
      } catch {}
    }
  }
  return {};
}

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveColor(tokenName, tokenMap, fallback) {
  if (!tokenName) return fallback || null;
  if (tokenName.startsWith('#') || tokenName.startsWith('rgb')) return tokenName;
  return tokenMap[tokenName] || fallback || null;
}

function widgetToCss(widget, hasExplicitSize) {
  if (!widget) return '';
  const parts = ['position:absolute'];
  const { top, left, right, bottom } = widget;
  if (top != null) parts.push(`top:${top}px`);
  if (left != null) parts.push(`left:${left}px`);
  if (right != null) parts.push(`right:${right}px`);
  if (bottom != null) parts.push(`bottom:${bottom}px`);
  return parts.join(';');
}

function layoutToCss(layout) {
  if (!layout) return '';
  const parts = [];
  if (layout.type === 'horizontal' || layout.type === 'vertical') {
    parts.push('display:flex');
    parts.push(`flex-direction:${layout.type === 'horizontal' ? 'row' : 'column'}`);
    if (layout.spacingX) parts.push(`column-gap:${layout.spacingX}px`);
    if (layout.spacingY) parts.push(`row-gap:${layout.spacingY}px`);
  } else if (layout.type === 'grid') {
    const constraintNum = typeof layout.constraintNum === 'number' && layout.constraintNum > 0
      ? layout.constraintNum
      : null;
    const cellWidth = typeof layout.cellWidth === 'number' && layout.cellWidth > 0
      ? `${layout.cellWidth}px`
      : '1fr';
    const cellHeight = typeof layout.cellHeight === 'number' && layout.cellHeight > 0
      ? `${layout.cellHeight}px`
      : null;

    parts.push('display:grid');
    if (constraintNum && layout.constraint === 'fixed-row') {
      parts.push(`grid-template-rows:repeat(${constraintNum}, ${cellHeight || '1fr'})`);
      parts.push('grid-auto-flow:column');
      if (cellWidth !== '1fr') parts.push(`grid-auto-columns:${cellWidth}`);
    } else {
      parts.push(`grid-template-columns:repeat(${constraintNum || 1}, ${cellWidth})`);
      if (cellHeight) parts.push(`grid-auto-rows:${cellHeight}`);
    }
    if (layout.spacingX) parts.push(`column-gap:${layout.spacingX}px`);
    if (layout.spacingY) parts.push(`row-gap:${layout.spacingY}px`);
  }
  const padTop = layout.paddingTop || 0;
  const padRight = layout.paddingRight || 0;
  const padBottom = layout.paddingBottom || 0;
  const padLeft = layout.paddingLeft || 0;
  if (padTop || padRight || padBottom || padLeft) {
    parts.push(`padding:${padTop}px ${padRight}px ${padBottom}px ${padLeft}px`);
  }
  return parts.join(';');
}

function slotToCss(slot, kind) {
  if (!slot) return '';
  const parts = [];
  if (slot.kind === 'color-rect' || kind === 'panel') {
    if (slot.color) parts.push(`background:${slot.color}`);
    if (slot.opacity != null && slot.opacity !== 1) parts.push(`opacity:${slot.opacity}`);
  }
  if (slot.kind === 'label-style' || kind === 'label') {
    if (slot.font) parts.push(`font-family:${slot.font}`);
    if (slot.fontSize) parts.push(`font-size:${slot.fontSize}px`);
    if (slot.lineHeight) parts.push(`line-height:${slot.lineHeight}px`);
    if (slot.letterSpacing != null) parts.push(`letter-spacing:${slot.letterSpacing}px`);
    if (slot.color) parts.push(`color:${slot.color}`);
    if (slot.fontWeight) parts.push(`font-weight:${slot.fontWeight}`);
    if (slot.horizontalAlign) parts.push(`text-align:${String(slot.horizontalAlign).toLowerCase()}`);
  }
  if (slot.kind === 'sprite-frame' && slot.spriteFrame) {
    parts.push(`background-image:url(${slot.spriteFrame})`);
    parts.push('background-size:cover');
    parts.push('background-position:center');
  }
  return parts.join(';');
}

function resolveSkinSlot(skinSlotKey, skin, tokenMap) {
  if (!skinSlotKey || !skin || !skin.slots) return null;
  const slot = skin.slots[skinSlotKey];
  if (!slot) return null;
  const resolved = { ...slot };
  if (slot.color) resolved.color = resolveColor(slot.color, tokenMap, slot.color);
  if (slot.outlineColor) resolved.outlineColor = resolveColor(slot.outlineColor, tokenMap, slot.outlineColor);
  return resolved;
}

function getLayerZOrder(layer) {
  if (!layer || typeof layer !== 'object') return 0;
  if (typeof layer.zOrder === 'number' && !Number.isNaN(layer.zOrder)) return layer.zOrder;
  if (typeof layer.order === 'number' && !Number.isNaN(layer.order)) return layer.order;
  return 0;
}

function renderSkinLayers(node, ctx) {
  if (!Array.isArray(node.skinLayers) || node.skinLayers.length === 0) return '';
  const { skin, tokenMap } = ctx;
  return [...node.skinLayers]
    .sort((a, b) => getLayerZOrder(a) - getLayerZOrder(b))
    .map((layer, index) => {
      if (!layer || !layer.slotId) return '';
      const slot = resolveSkinSlot(layer.slotId, skin, tokenMap);
      if (!slot) return '';
      const cssParts = ['position:absolute', 'pointer-events:none'];
      if (layer.widget) {
        cssParts.push(widgetToCss(layer.widget, layer.width != null || layer.height != null));
      } else if (layer.expand !== false) {
        cssParts.push('top:0px', 'left:0px', 'right:0px', 'bottom:0px');
      } else {
        cssParts.push('top:0px', 'left:0px');
      }
      if (layer.width != null) cssParts.push(`width:${layer.width}px`);
      if (layer.height != null) cssParts.push(`height:${layer.height}px`);
      if (layer.opacity != null && layer.opacity !== 1) cssParts.push(`opacity:${layer.opacity}`);
      cssParts.push(`z-index:${getLayerZOrder(layer)}`);
      cssParts.push(slotToCss(slot, 'panel'));
      const layerId = escHtml(layer.layerId || `layer_${index}`);
      return `<div data-ucuf-layer="${layerId}" style="${cssParts.filter(Boolean).join(';')}"></div>`;
    })
    .join('');
}

function renderNode(node, ctx, depth = 0) {
  if (!node) return '';
  const { skin, tokenMap } = ctx;
  const tag = node.type === 'label' ? 'span' :
              node.type === 'button' ? 'button' :
              node.type === 'image' ? 'div' :
              node.type === 'composite' ? 'div' :
              'div';

  const skinSlot = node.skinSlot ? resolveSkinSlot(node.skinSlot, skin, tokenMap) : null;
  const styleSlot = node.styleSlot ? resolveSkinSlot(node.styleSlot, skin, tokenMap) : null;

  const isRoot = depth === 0;
  const cssParts = [];

  if (isRoot) {
    const cw = (ctx.canvas && ctx.canvas.designWidth) || 1334;
    const ch = (ctx.canvas && ctx.canvas.designHeight) || 750;
    cssParts.push(`position:relative;width:${cw}px;height:${ch}px;overflow:hidden`);
  } else {
    cssParts.push(widgetToCss(node.widget, node.width || node.height));
  }
  if (node.width != null) cssParts.push(`width:${node.width}px`);
  if (node.height != null) cssParts.push(`height:${node.height}px`);
  if (node.layout) cssParts.push(layoutToCss(node.layout));
  if (Array.isArray(node.skinLayers) && node.skinLayers.length > 0 &&
      !cssParts.some(part => String(part).includes('position:'))) {
    cssParts.push('position:relative');
  }

  if (skinSlot) cssParts.push(slotToCss(skinSlot, node.type));
  if (styleSlot) cssParts.push(slotToCss(styleSlot, node.type));

  // Default widget {top:0,left:0,right:0,bottom:0} = fill parent
  if (!isRoot && node.widget) {
    const w = node.widget;
    if (w.top === 0 && w.left === 0 && w.right === 0 && w.bottom === 0 &&
        node.width == null && node.height == null) {
      // already covered by widgetToCss; fine.
    }
  }

  const css = cssParts.filter(Boolean).join(';');
  const dataAttrs = ` data-ucuf-name="${escHtml(node.name || '')}" data-ucuf-type="${escHtml(node.type || '')}"`;
  const inner = node.text != null ? escHtml(node.text) : '';
  const skinLayersHtml = renderSkinLayers(node, ctx);

  let childrenHtml = '';
  if (Array.isArray(node.children) && node.children.length > 0) {
    childrenHtml = node.children.map(c => renderNode(c, ctx, depth + 1)).join('');
  }

  return `<${tag}${dataAttrs} style="${css}">${skinLayersHtml}${inner}${childrenHtml}</${tag}>`;
}

function main() {
  const opts = parseArgs(process.argv);
  const layout = JSON.parse(fs.readFileSync(opts.layout, 'utf8'));
  const skin = opts.skin && fs.existsSync(opts.skin)
    ? JSON.parse(fs.readFileSync(opts.skin, 'utf8'))
    : { slots: {} };
  const tokenMap = loadTokenMap(opts.tokenMap);

  const canvas = layout.canvas || { designWidth: 1334, designHeight: 750 };
  const ctx = { skin, tokenMap, canvas };
  const bodyHtml = renderNode(layout, ctx, 0);

  const html = `<!doctype html>
<html><head>
<meta charset="utf-8">
<title>UCUF Preview: ${escHtml(layout.name || 'unknown')}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans TC', 'Manrope', sans-serif; background: #1a1a1a; }
  button { all: unset; cursor: pointer; }
  /* Reset button defaults so they look like the source HTML's buttons */
</style>
</head><body>
${bodyHtml}
</body></html>`;

  const outDir = path.dirname(path.resolve(opts.output));
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(opts.output, html, 'utf8');
  console.log(`[render-ucuf-layout] wrote ${opts.output} (${html.length} bytes, root=${layout.name}, canvas=${canvas.designWidth}x${canvas.designHeight})`);
}

main();
