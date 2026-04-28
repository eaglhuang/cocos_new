// Minimal CSS capability matrix for HTML-to-UCUF v2 diagnostics.
'use strict';

const SUPPORTED = new Set([
  'align-content', 'align-items', 'align-self', 'background-color', 'border-color', 'border-radius', 'border-style',
  'border-width', 'bottom', 'color', 'column-gap', 'display', 'flex', 'flex-basis', 'flex-direction', 'flex-grow', 'flex-shrink',
  'flex-wrap', 'font-family', 'font-feature-settings', 'font-size', 'font-variant', 'font-weight', 'gap', 'height',
  'justify-content', 'justify-items', 'justify-self', 'left', 'letter-spacing', 'line-height', 'margin',
  'margin-bottom', 'margin-left', 'margin-right', 'margin-top', 'object-fit', 'object-position', 'opacity',
  'overflow', 'overflow-x', 'overflow-y', 'padding', 'padding-bottom', 'padding-left', 'padding-right', 'padding-top',
  'position', 'right', 'row-gap', 'text-align', 'text-overflow', 'top', 'transform-origin', 'vertical-align',
  'white-space', 'width', 'z-index', '-webkit-text-stroke', '-webkit-text-stroke-color', '-webkit-text-stroke-width',
]);

const ASSETIZE = new Set([
  'background', 'background-image', 'background-position', 'background-repeat', 'background-size',
  'box-shadow', 'drop-shadow', 'text-shadow', 'border-image',
]);

const UNSUPPORTED = new Set([
  'backdrop-filter', 'clip-path', 'filter', 'mask', 'mask-image', 'mix-blend-mode', 'perspective',
  'transform-style', 'shape-outside', 'content',
]);

function classifyCssProperty(property, value) {
  const prop = String(property || '').trim().toLowerCase();
  const rawValue = String(value || '').trim().toLowerCase();
  if (!prop) return 'unknown';
  if (UNSUPPORTED.has(prop)) return 'unsupported';
  if (ASSETIZE.has(prop)) return 'assetize';
  if (prop === 'background' && /(linear-gradient|radial-gradient|url\()/i.test(rawValue)) return 'assetize';
  if (prop === 'transform' && rawValue && rawValue !== 'none') return 'unsupported';
  if (/^border-(top|right|bottom|left)-(width|style|color)$/.test(prop)) return 'supported';
  if (/^border-(top-left|top-right|bottom-right|bottom-left)-radius$/.test(prop)) return 'supported';
  if (/^text-decoration($|-)/.test(prop)) return 'supported';
  if (/^font-/.test(prop)) return 'supported';
  if (/^overflow(-x|-y)?$/.test(prop)) return 'supported';
  if (/^object-(fit|position)$/.test(prop)) return 'supported';
  if (SUPPORTED.has(prop)) return 'supported';
  return 'unsupported';
}

function buildCssCapabilityReport(cssText) {
  const properties = new Map();
  const declRe = /([A-Za-z-]+)\s*:\s*([^;{}]+)[;}]?/g;
  let match;
  while ((match = declRe.exec(String(cssText || ''))) !== null) {
    const property = match[1].toLowerCase();
    const value = match[2].trim();
    const capability = classifyCssProperty(property, value);
    const key = `${property}\u0000${capability}`;
    const item = properties.get(key) || { property, capability, count: 0, samples: [] };
    item.count += 1;
    if (item.samples.length < 3) item.samples.push(value);
    properties.set(key, item);
  }
  const items = [...properties.values()].sort((a, b) => b.count - a.count || a.property.localeCompare(b.property));
  return {
    summary: {
      supported: items.filter(i => i.capability === 'supported').reduce((n, i) => n + i.count, 0),
      assetize: items.filter(i => i.capability === 'assetize').reduce((n, i) => n + i.count, 0),
      unsupported: items.filter(i => i.capability === 'unsupported').reduce((n, i) => n + i.count, 0),
    },
    topOffenders: items.filter(i => i.capability !== 'supported').slice(0, 20),
    items,
  };
}

module.exports = { classifyCssProperty, buildCssCapabilityReport };
