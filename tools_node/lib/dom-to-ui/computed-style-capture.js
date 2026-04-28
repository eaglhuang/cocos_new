// doc_id: doc_other_0009 — computed-style capture via puppeteer (M13/M14/M19)
// Uses a live puppeteer page to capture *actual* getComputedStyle for each
// visible element, including ::before / ::after pseudo-elements, and produces:
//   1. A flat list of "fidelity-snapshots" keyed by stable element path
//   2. A css-coverage report (which properties were captured / dropped)
//
// This is the source of truth for high-fidelity rendering — it bypasses the
// regex parser entirely and reads what the browser actually renders.
'use strict';

const { classifyCssProperty } = require('./css-capability-matrix');

// CSS properties we know how to translate to UCUF skin slot kinds today.
const CAPTURED = new Set([
  'background-color',
  'background-image',
  'color',
  'font-size', 'font-family', 'font-weight', 'line-height', 'letter-spacing', 'text-align',
  // Alignment & layout (M23) — applied directly in renderNode, not via skin slots
  'display', 'flex-direction', 'flex-wrap',
  'align-items', 'align-content', 'align-self',
  'justify-content', 'justify-items', 'justify-self',
  'gap', 'row-gap', 'column-gap',
  'vertical-align', 'white-space', 'text-overflow',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
  'box-shadow', 'text-shadow',
  'opacity', 'mix-blend-mode', 'isolation',
  'filter', 'backdrop-filter',
  'transform', 'transform-origin',
  'clip-path', '-webkit-clip-path',
  'mask-image', '-webkit-mask-image',
  'text-decoration', 'text-decoration-color', 'text-decoration-style', 'text-decoration-thickness',
  '-webkit-text-stroke', '-webkit-text-stroke-width', '-webkit-text-stroke-color',
  'font-feature-settings', 'font-variant',
  // M30: image fit properties
  'object-fit', 'object-position',
  // M31: overflow clipping for visual reconstruction (circular portraits, HP bars, etc.)
  'overflow', 'overflow-x', 'overflow-y',
]);

// Properties that are intentionally ignored (geometry handled separately, etc.)
const IGNORED = new Set([
  'width', 'height', 'top', 'left', 'right', 'bottom',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'display', 'flex', 'flex-grow', 'flex-shrink', 'flex-basis',
  'box-sizing',
  'z-index', 'visibility', 'pointer-events', 'cursor', 'user-select',
  'word-wrap', 'word-break',
  // Note: flex-direction, align-items, justify-content, gap, white-space,
  // text-overflow moved to CAPTURED (M23 — alignment pass)
  'animation', 'transition', // motion-translator handles
]);

const DEFAULT_VALUES = {
  'background-color':  ['rgba(0, 0, 0, 0)', 'transparent'],
  'background-image':  ['none'],
  // M29: background sub-properties default values — avoids false "dropped" entries
  // when all elements inherit these standard defaults from the root.
  'background-size':     ['auto', 'auto auto'],
  'background-position': ['0% 0%'],
  'background-repeat':   ['repeat', 'repeat repeat'],
  'border-top-width':  ['0px'], 'border-right-width': ['0px'],
  'border-bottom-width': ['0px'], 'border-left-width': ['0px'],
  'border-top-style':  ['none'], 'border-right-style': ['none'],
  'border-bottom-style': ['none'], 'border-left-style': ['none'],
  'border-top-left-radius': ['0px'], 'border-top-right-radius': ['0px'],
  'border-bottom-left-radius': ['0px'], 'border-bottom-right-radius': ['0px'],
  'box-shadow':        ['none'],
  'text-shadow':       ['none'],
  'opacity':           ['1'],
  'mix-blend-mode':    ['normal'],
  'isolation':         ['auto'],
  'filter':            ['none'],
  'backdrop-filter':   ['none'],
  'transform':         ['none', 'matrix(1, 0, 0, 1, 0, 0)'],
  'clip-path':         ['none'],
  '-webkit-clip-path': ['none'],
  'mask-image':        ['none'],
  '-webkit-mask-image': ['none'],
  'text-decoration':   ['none', 'none solid currentcolor', 'none solid rgb(229, 226, 225)'],
  'text-decoration-line': ['none'],
  '-webkit-text-stroke-width': ['0px'],
  // M30: image fit defaults (browser defaults for <img>)
  'object-fit':      ['fill'],
  'object-position': ['50% 50%'],
  // M31: overflow defaults (browser default is visible)
  'overflow':   ['visible'],
  'overflow-x': ['visible'],
  'overflow-y': ['visible'],
};

function isDefault(prop, value) {
  const defs = DEFAULT_VALUES[prop];
  if (!defs) return false;
  return defs.indexOf(value) >= 0;
}

/**
 * Capture computed styles from a live puppeteer page.
 * @param {import('puppeteer-core').Page} page
 * @returns {Promise<{ snapshots: Array, coverage: object }>}
 */
async function captureComputedStyles(page) {
  // Run inside the page; serialize result back.
  const captured = await page.evaluate(() => {
    const ALL_PROPS = [
      // Visual
      'background-color', 'background-image', 'background-size', 'background-position', 'background-repeat',
      'color',
      'font-size', 'font-family', 'font-weight', 'line-height', 'letter-spacing', 'text-align',
      // Border
      'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
      'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
      'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
      'border-top-left-radius', 'border-top-right-radius',
      'border-bottom-right-radius', 'border-bottom-left-radius',
      // Effects
      'box-shadow', 'text-shadow',
      'opacity', 'mix-blend-mode', 'isolation',
      'filter', 'backdrop-filter',
      'transform', 'transform-origin',
      'clip-path', '-webkit-clip-path',
      'mask-image', '-webkit-mask-image',
      // Text
      'text-decoration-line', 'text-decoration-color', 'text-decoration-style', 'text-decoration-thickness',
      '-webkit-text-stroke-width', '-webkit-text-stroke-color',
      'font-feature-settings', 'font-variant',
      // Stacking & overflow
      'z-index', 'overflow', 'overflow-x', 'overflow-y',
      // Image fit (M30)
      'object-fit', 'object-position',
      // Alignment & layout (M23)
      'display', 'flex-direction', 'flex-wrap',
      'align-items', 'align-content', 'align-self',
      'justify-content', 'justify-items', 'justify-self',
      'gap', 'row-gap', 'column-gap',
      'vertical-align', 'white-space', 'text-overflow',
    ];

    function pathOf(el) {
      const parts = [];
      while (el && el !== document.body && el !== document.documentElement) {
        const p = el.parentElement;
        if (!p) break;
        const idx = Array.prototype.indexOf.call(p.children, el);
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : '';
        const cls = el.className && typeof el.className === 'string'
          ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
          : '';
        parts.unshift(`${tag}${id}${cls}[${idx}]`);
        el = p;
      }
      return parts.join('>');
    }

    function rect(el) {
      const r = el.getBoundingClientRect();
      // Preserve sub-pixel precision; renderer can use Px3 for parity.
      return {
        x: Math.round(r.left * 100) / 100,
        y: Math.round(r.top * 100) / 100,
        w: Math.round(r.width * 100) / 100,
        h: Math.round(r.height * 100) / 100,
      };
    }

    // Local (pre-transform) rect relative to offsetParent. Used by tree renderer
    // so that parent transforms naturally cascade to children.
    function localRect(el) {
      return {
        x: el.offsetLeft || 0,
        y: el.offsetTop || 0,
        w: el.offsetWidth || 0,
        h: el.offsetHeight || 0,
        offsetParentTag: el.offsetParent ? el.offsetParent.tagName.toLowerCase() : null,
      };
    }

    function pickProps(el, pseudo) {
      const cs = window.getComputedStyle(el, pseudo || null);
      if (pseudo) {
        const content = cs.getPropertyValue('content');
        // 'normal' = pseudo not matched by any CSS rule; 'none' = explicitly hidden.
        if (content === 'none' || content === 'normal') return null;
        // If content is empty/missing, still include the pseudo when it has a
        // visible background or border (M27: decorative overlays use content:"").
        if (!content || content === '""' || content === "''") {
          const bg = cs.getPropertyValue('background-image');
          const bgColor = cs.getPropertyValue('background-color');
          const bw = cs.getPropertyValue('border-top-width');
          const hasVisual = (bg && bg !== 'none') ||
            (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') ||
            (bw && bw !== '0px');
          if (!hasVisual) return null;
        }
      }
      const out = {};
      for (const p of ALL_PROPS) {
        const v = cs.getPropertyValue(p);
        if (v) out[p] = v.trim();
      }
      if (pseudo) {
        out.content = cs.getPropertyValue('content');
        out._rect = rect(el); // approximation: pseudo bounds tracked via parent
      } else {
        out._rect = rect(el);
        out._localRect = localRect(el);
      }
      out._textContent = pseudo ? null : (el.children.length === 0 ? (el.textContent || '').trim().slice(0, 200) : null);
      return out;
    }

    const all = document.querySelectorAll('body *');
    const snapshots = [];
    let nodeId = 0;
    // First pass: assign each element a unique id via WeakMap so we can
    // resolve parent relationships and build a tree later.
    const idMap = new WeakMap();
    all.forEach(el => {
      const tag = el.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'link' || tag === 'meta' || tag === 'br') return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      idMap.set(el, ++nodeId);
    });
    function parentIdOf(el) {
      let p = el.parentElement;
      while (p && p !== document.body && p !== document.documentElement) {
        if (idMap.has(p)) return idMap.get(p);
        p = p.parentElement;
      }
      return 0; // body
    }
    function offsetParentIdOf(el) {
      const op = el.offsetParent;
      if (!op || op === document.body || op === document.documentElement) return 0;
      return idMap.get(op) || parentIdOf(el);
    }

    all.forEach(el => {
      // Skip <script>, <style>
      const tag = el.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'link' || tag === 'meta' || tag === 'br') return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const id = idMap.get(el);
      if (!id) return;
      const ucufId = el.getAttribute('data-ucuf-id') || null;
      const styles = pickProps(el, null);
      // Capture <img>/<input type=image> src so the renderer can re-emit them.
      if (tag === 'img' && el.src) {
        styles._imgSrc = el.currentSrc || el.src;
        styles._imgAlt = el.alt || '';
      }
      // Capture inline SVG outerHTML so the renderer can replay vector content.
      if (tag === 'svg') {
        try { styles._svgOuter = el.outerHTML; } catch (e) {}
      }
      const parentId = parentIdOf(el);
      const offsetParentId = offsetParentIdOf(el);
      snapshots.push({ id, parentId, offsetParentId, ucufId, tag, path: pathOf(el), styles, pseudo: null });
      const before = pickProps(el, '::before');
      if (before) snapshots.push({ id: id * 1000 + 1, parentId: id, offsetParentId: id, ucufId: ucufId ? `${ucufId}::before` : null, tag, path: pathOf(el) + '::before', styles: before, pseudo: 'before' });
      const after = pickProps(el, '::after');
      if (after) snapshots.push({ id: id * 1000 + 2, parentId: id, offsetParentId: id, ucufId: ucufId ? `${ucufId}::after` : null, tag, path: pathOf(el) + '::after', styles: after, pseudo: 'after' });
    });
    return snapshots;
  });

  // Build coverage report
  const propUsage = {};   // prop → { occurrences, samples: [{path, value}] }
  const droppedProps = {}; // prop → { occurrences, samples }
  for (const snap of captured) {
    for (const [prop, value] of Object.entries(snap.styles || {})) {
      if (prop.startsWith('_')) continue;
      if (IGNORED.has(prop)) continue;
      if (isDefault(prop, value)) continue;
      const target = CAPTURED.has(prop) ? propUsage : droppedProps;
      if (!target[prop]) target[prop] = { occurrences: 0, samples: [] };
      target[prop].occurrences++;
      if (target[prop].samples.length < 3) {
        target[prop].samples.push({ path: snap.path, value });
      }
    }
  }

  const captureCount = Object.values(propUsage).reduce((a, b) => a + b.occurrences, 0);
  const dropCount = Object.values(droppedProps).reduce((a, b) => a + b.occurrences, 0);
  const total = captureCount + dropCount;
  const cssCapability = buildCssCapabilityFromUsage(propUsage, droppedProps);

  return {
    snapshots: captured,
    coverage: {
      totalNodes: captured.filter(s => !s.pseudo).length,
      pseudoNodes: captured.filter(s => s.pseudo).length,
      capturedProperties: propUsage,
      droppedProperties: droppedProps,
      cssCapability,
      coveragePercent: total > 0 ? captureCount / total : 1,
    },
  };
}

function buildCssCapabilityFromUsage(propUsage, droppedProps) {
  const byKey = new Map();
  for (const usage of [propUsage, droppedProps]) {
    for (const [property, item] of Object.entries(usage || {})) {
      const firstValue = item.samples && item.samples[0] ? item.samples[0].value : '';
      const capability = classifyCssProperty(property, firstValue);
      const key = `${property}\u0000${capability}`;
      const current = byKey.get(key) || { property, capability, occurrences: 0, samples: [] };
      current.occurrences += item.occurrences || 0;
      for (const sample of item.samples || []) {
        if (current.samples.length < 3) current.samples.push(sample);
      }
      byKey.set(key, current);
    }
  }
  if (byKey.size === 0) {
    for (const usage of [propUsage, droppedProps]) {
      for (const [property, item] of Object.entries(usage || {})) {
        const capability = classifyCssProperty(property, '');
        const key = `${property}\u0000${capability}`;
        const current = byKey.get(key) || { property, capability, occurrences: 0, samples: [] };
        current.occurrences += item.occurrences || 0;
        byKey.set(key, current);
      }
    }
  }
  const items = [...byKey.values()].sort((a, b) => b.occurrences - a.occurrences || a.property.localeCompare(b.property));
  const summary = { supported: 0, assetize: 0, unsupported: 0, unknown: 0 };
  for (const item of items) summary[item.capability] = (summary[item.capability] || 0) + item.occurrences;
  return {
    summary,
    topOffenders: items.filter(item => item.capability !== 'supported').slice(0, 20),
    assetizeHints: items
      .filter(item => item.capability === 'assetize')
      .map(item => Object.assign({}, item, { suggestedTask: 'assetize-css-effect' }))
      .slice(0, 20),
    items,
  };
}

module.exports = { captureComputedStyles, CAPTURED, IGNORED };
