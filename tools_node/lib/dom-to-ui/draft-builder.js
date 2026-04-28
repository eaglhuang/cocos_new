// doc_id: doc_other_0009 — recursive HTML -> UCUF draft builder
// 對應 §3 / §6 / §7 / §8 / §27
'use strict';

const { parseHtml, parseStylesheets, parseInlineStyle } = require('./html-parser');
const { loadTokenRegistry, normalizeHex } = require('./token-registry');
const { extractInteraction, buildInteractionDraft } = require('./interaction-translator');
const { extractKeyframes, extractMotion, buildMotionDraft } = require('./motion-translator');

const ANCHOR_MAP = {
  'fill': { top: 0, left: 0, right: 0, bottom: 0 },
  'center': { hCenter: 0, vCenter: 0 },
  'top-left': { top: 0, left: 0 },
  'top-right': { top: 0, right: 0 },
  'top-center': { top: 0, hCenter: 0 },
  'bottom-left': { bottom: 0, left: 0 },
  'bottom-right': { bottom: 0, right: 0 },
  'bottom-center': { bottom: 0, hCenter: 0 },
  'middle-left': { vCenter: 0, left: 0 },
  'middle-right': { vCenter: 0, right: 0 },
};

const FORBIDDEN_TYPES = new Set(['Node', 'Label', 'Sprite', 'ScrollView', 'SafeArea']);

const TEXT_TAGS = new Set(['p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'label', 'small', 'strong', 'em', 'a']);

const NON_VISUAL_TAGS = new Set(['head', 'meta', 'link', 'title', 'style', 'script', 'noscript', 'base']);

const RICH_TEXT_INNER_TAGS = new Set(['strong', 'em', 'a', 'small']);

const NINESLICE_FAMILY_HINTS = ['parchment', 'dark_metal', 'dark-metal', 'gold_cta', 'gold-cta'];

const PLACEHOLDER_SPRITE = 'sprites/ui_common/placeholder/missing_sprite';

const SIMPLIFIED_CHINESE_HINTS = ['国', '将', '历', '战', '门', '画', '员']; // partial set; warn only

/**
 * Build layout + skin draft from HTML source.
 * @param {string} html
 * @param {object} opts
 * @param {string} opts.screenId
 * @param {string} [opts.bundle]
 * @param {string} [opts.defaultBundle='ui_common']
 * @param {string} [opts.rootName]
 */
function buildDraftFromHtml(html, opts) {
  if (!html || typeof html !== 'string') {
    throw new Error('buildDraftFromHtml: html string required');
  }
  if (!opts || !opts.screenId) {
    throw new Error('buildDraftFromHtml: opts.screenId required');
  }

  const ctx = {
    opts: Object.assign({ defaultBundle: 'ui_common' }, opts),
    skinSlots: {},
    warnings: [],
    nameCounters: {},
    compositeNodes: [],
    interactions: [],
    motions: [],
    tokenRegistry: loadTokenRegistry({
      sourcePath: opts.tokensSource || opts.tokensPath,
      runtimePath: opts.tokensRuntime,
      handoffPath: opts.tokensHandoff,
    }),
    tokenUsage: {
      colors: [],
      cssVars: [],
      spacing: [],
      typography: [],
      artWarnings: [],
    },
  };

  const parsed = parseHtml(html);
  for (const w of parsed.warnings) ctx.warnings.push(w);
  const { classRules, idRules } = parseStylesheets(parsed.styleSheets || []);
  ctx.classRules = classRules;
  ctx.idRules = idRules;
  ctx.keyframes = extractKeyframes(parsed.styleSheets || []);

  // Find a single root element if present, else wrap children.
  const elementChildren = parsed.children.filter(c => c.type === 'element');
  let rootEl;
  if (elementChildren.length === 1) {
    rootEl = elementChildren[0];
  } else {
    rootEl = { type: 'element', tag: 'div', attrs: { class: '' }, children: elementChildren };
  }

  // M1: specVersion + canvas meta on layout root
  // Canvas can be hinted via <html data-canvas-width="1334" data-canvas-height="750"> or opts.canvas.
  const canvasFromHtml = readCanvasFromHtml(parsed);
  const canvas = Object.assign(
    { designWidth: 1334, designHeight: 750 },
    canvasFromHtml || {},
    opts.canvas || {},
  );

  const rootName = opts.rootName || pascal(opts.screenId);
  const rootNode = {
    specVersion: 1,
    canvas,
    type: 'container',
    name: rootName,
    widget: { top: 0, left: 0, right: 0, bottom: 0 },
    children: [],
  };

  for (const child of rootEl.children) {
    if (child.type !== 'element') continue;
    const node = processElement(child, ctx, 1);
    if (node) rootNode.children.push(node);
  }

  return {
    layoutDraft: rootNode,
    skinDraft: {
      id: `${ctx.opts.screenId}-default`,
      version: 1,
      slots: ctx.skinSlots,
      bundles: ctx.opts.bundle ? [ctx.opts.bundle] : [],
      meta: {
        tokenUsageReport: ctx.tokenUsage,
        tokenSources: ctx.tokenRegistry.sources,
        tokenConflictReport: ctx.tokenRegistry.conflicts || [],
      },
    },
    warnings: ctx.warnings,
    compositeNodes: ctx.compositeNodes,
    interactionDraft: buildInteractionDraft(ctx.opts.screenId, ctx.interactions, ctx.warnings),
    motionDraft: buildMotionDraft(ctx.opts.screenId, ctx.motions, ctx.warnings),
    canvas,
  };
}

function readCanvasFromHtml(parsed) {
  // walk top-level for <html> attrs
  for (const c of parsed.children || []) {
    if (c.type === 'element' && (c.tag === 'html' || c.tag === 'body')) {
      const a = c.attrs || {};
      const w = numAttr(a['data-canvas-width']);
      const h = numAttr(a['data-canvas-height']);
      if (w && h) return { designWidth: w, designHeight: h };
    }
  }
  return null;
}

function processElement(el, ctx, depth) {
  const tag = el.tag;
  if (NON_VISUAL_TAGS.has(tag)) return null;
  // unwrap html/body: descend into children directly
  if (tag === 'html' || tag === 'body') {
    const out = {
      type: 'container',
      name: ctx.opts.rootName ? `${ctx.opts.rootName}_${tag}` : `${pascal(ctx.opts.screenId)}_${tag}`,
      widget: { top: 0, left: 0, right: 0, bottom: 0 },
      children: [],
    };
    for (const c of el.children) {
      if (c.type !== 'element') continue;
      const sub = processElement(c, ctx, depth + 1);
      if (sub) out.children.push(sub);
    }
    // collapse single-child wrappers
    if (out.children.length === 1) return out.children[0];
    return out.children.length === 0 ? null : out;
  }
  const attrs = el.attrs || {};
  const cls = (attrs.class || '').split(/\s+/).filter(Boolean);
  const styleFromInline = parseInlineStyle(attrs.style || '');
  const styleFromClass = mergeClassStyles(cls, ctx.classRules);
  const styleFromId = attrs.id ? (ctx.idRules[attrs.id] || {}) : {};
  const style = Object.assign({}, styleFromClass, styleFromId, styleFromInline);

  // ---- depth guard (RT-01) ----
  if (depth > 8) {
    ctx.warnings.push({ code: 'depth-exceeds-8-consider-fragment' });
  }

  // ---- 1. lazy slot ----
  if (attrs['data-slot']) {
    const slotName = attrs['data-slot'];
    const node = {
      type: 'container',
      name: slotName,
      widget: anchorToWidget(attrs['data-anchor'], style),
      lazySlot: true,
      defaultFragment: attrs['data-default-fragment'] || undefined,
      warmupHint: attrs['data-warmup-hint'] || undefined,
    };
    applyCommonNodeAttrs(node, attrs);
    if (!node.defaultFragment) {
      ctx.warnings.push({ code: 'lazy-slot-missing-default-fragment', detail: slotName });
    }
    return node;
  }

  // ---- 2. child-panel ----
  if (attrs['data-panel']) {
    const panelNode = {
      type: 'child-panel',
      name: attrs['data-name'] || autoName(ctx, tag),
      widget: anchorToWidget(attrs['data-anchor'], style),
      panelType: attrs['data-panel'],
      dataSource: attrs['data-datasource'] || undefined,
      _contract: attrs['data-contract'] || undefined,
    };
    applyCommonNodeAttrs(panelNode, attrs);
    collectBehavior(el, panelNode, style, ctx);
    return panelNode;
  }

  // ---- 3. infer node type ----
  const nodeType = inferNodeType(tag, cls, style, attrs, el);
  if (FORBIDDEN_TYPES.has(nodeType)) {
    ctx.warnings.push({ code: 'forbidden-node-type', detail: nodeType });
  }

  const name = attrs['data-name'] || autoName(ctx, tag);
  inspectArtDirectionRisks(style, name, ctx, el);
  const node = {
    type: nodeType,
    name,
    widget: anchorToWidget(attrs['data-anchor'], style),
  };

  applyVisibilityState(node, style, ctx, name);

  // M4: stable identifier + lock flags
  applyCommonNodeAttrs(node, attrs);

  // M1: collect composite nodes for sidecar report
  if (nodeType === 'composite') {
    ctx.compositeNodes.push({
      name,
      tag,
      reason: tag === 'canvas' ? 'html-canvas' : tag === 'svg' ? 'svg' : 'class-hint',
      width: pickDim(style.width, attrs.width),
      height: pickDim(style.height, attrs.height),
      hint: attrs['data-composite-hint'] || null,
    });
    ctx.warnings.push({ code: 'composite-needs-manual-renderer', detail: name });
  }

  // ---- 4. dimensions ----
  const width = pickDim(style.width, attrs.width);
  const height = pickDim(style.height, attrs.height);
  if (width != null) node.width = width;
  if (height != null) node.height = height;

  // M10: declarative interaction + motion draft collection.
  collectBehavior(el, node, style, ctx);

  // ---- 5. layout (flex) ----
  const layoutSpec = inferLayout(style, ctx, name, el);
  if (layoutSpec) node.layout = layoutSpec;

  // ---- 6. by-type wiring ----
  if (nodeType === 'image') {
    const slotId = attrs['data-skin'] || autoSlotId(ctx, name);
    node.skinSlot = slotId;
    ensureSpriteSlot(ctx, slotId, attrs, style, /*sizeHint*/ { width, height });
  } else if (nodeType === 'panel') {
    const skinLayers = emitSkinLayers(ctx, name, style, attrs);
    if (skinLayers && skinLayers.length > 1) {
      node.skinLayers = skinLayers;
    } else {
      const slotId = attrs['data-skin'] || autoSlotId(ctx, name);
      node.skinSlot = slotId;
      ensureSpriteOrColorSlot(ctx, slotId, style, attrs, /*sizeHint*/ { width, height });
    }
  } else if (nodeType === 'label') {
    const text = collectText(el);
    if (text) node.text = text;
    const styleSlotId = attrs['data-style'] || autoSlotId(ctx, name);
    node.styleSlot = styleSlotId;
    ensureLabelStyle(ctx, styleSlotId, style, attrs);
    if (attrs['data-contract']) node._contract = attrs['data-contract'];
    if (containsRichInner(el)) ctx.warnings.push({ code: 'rich-text-not-supported', detail: name });
    if (looksSimplified(text)) ctx.warnings.push({ code: 'text-locale-mismatch', detail: name });
  } else if (nodeType === 'button') {
    if (attrs['data-contract']) node._contract = attrs['data-contract'];
    const slotId = attrs['data-skin'] || autoSlotId(ctx, name);
    node.skinSlot = slotId;
    ensureSpriteOrColorSlot(ctx, slotId, style, attrs, { width, height });
  }

  if (nodeType === 'composite') return node;

  // ---- 7. recurse children ----
  const childNodes = [];
  for (const child of el.children) {
    if (child.type !== 'element') continue;
    const sub = processElement(child, ctx, depth + 1);
    if (sub) childNodes.push(sub);
  }

  // §7.8 color-rect 濫發防護
  enforceColorRectGuard(ctx, name, childNodes);

  if (childNodes.length > 0) node.children = childNodes;
  if (nodeType === 'container' && childNodes.length === 0 && !node.width && !node.height && !node.skinSlot && !node.skinLayers && !node.compositeImageLayers) {
    return null;
  }

  return node;
}

function applyCommonNodeAttrs(node, attrs) {
  // M4: stable identifier + lock flags
  if (attrs['data-ucuf-id']) node._ucufId = attrs['data-ucuf-id'];
  if (attrs['data-ucuf-lock']) {
    const lockSpec = String(attrs['data-ucuf-lock']).trim();
    if (lockSpec === 'true' || lockSpec === '1' || lockSpec === '*') {
      node._lockedFields = ['*'];
    } else {
      node._lockedFields = lockSpec.split(/[,\s]+/).filter(Boolean);
    }
  }
  if (attrs['data-visual-zone']) node._visualZone = attrs['data-visual-zone'];
}

function applyVisibilityState(node, style, ctx, name) {
  if (!style) return;

  const display = String(style.display || '').trim().toLowerCase();
  const visibility = String(style.visibility || '').trim().toLowerCase();
  if (display === 'none' || visibility === 'hidden' || visibility === 'collapse') {
    node.active = false;
    ctx.warnings.push({ code: 'css-hidden-node-default-inactive', detail: name });
  }

  if (style.opacity != null) {
    const opacity = Number.parseFloat(style.opacity);
    if (Number.isFinite(opacity)) node.opacity = opacity;
  }
}

function collectBehavior(el, node, style, ctx) {
  const interaction = extractInteraction(el, node, ctx.opts);
  if (interaction.actions.length > 0) {
    node._interactionId = interaction.actions[0].id;
    for (const action of interaction.actions) ctx.interactions.push(action);
  }
  for (const w of interaction.warnings) ctx.warnings.push(w);

  const motion = extractMotion(el, node, style, ctx.keyframes);
  if (motion.motions.length > 0) {
    node._motionId = motion.motions[0].id;
    for (const item of motion.motions) ctx.motions.push(item);
  }
  for (const w of motion.warnings) ctx.warnings.push(w);
}

function inferNodeType(tag, cls, style, attrs, el) {
  if (cls.includes('safe-area')) return 'safe-area';
  if (cls.includes('scroll-y') || cls.includes('scroll-view')) return 'scroll-view';
  if (tag === 'canvas' || tag === 'svg') return 'composite';
  if (cls.some(c => /chart|radar|progress-ring|gauge/.test(c))) return 'composite';
  if (tag === 'img') return 'image';
  if (tag === 'button') return 'button';
  if (TEXT_TAGS.has(tag)) return 'label';
  if (hasOnlyTextContent(el)) return 'label';

  const hasBg = !!(style.background || style.backgroundColor || style.backgroundImage);
  if (hasBg) return 'panel';
  return 'container';
}

function hasOnlyTextContent(el) {
  if (!el || !Array.isArray(el.children)) return false;
  let hasText = false;
  for (const child of el.children) {
    if (child.type === 'element') return false;
    if (child.type === 'text' && String(child.value || '').trim()) hasText = true;
  }
  return hasText;
}

function anchorToWidget(anchor, style) {
  const base = anchor && ANCHOR_MAP[anchor]
    ? Object.assign({}, ANCHOR_MAP[anchor])
    : {};
  if (style) {
    assignWidgetEdge(base, 'top', style.top);
    assignWidgetEdge(base, 'left', style.left);
    assignWidgetEdge(base, 'right', style.right);
    assignWidgetEdge(base, 'bottom', style.bottom);
  }
  return Object.keys(base).length > 0 ? base : undefined;
}

function assignWidgetEdge(target, key, rawValue) {
  if (!rawValue) return;
  const px = parsePx(rawValue);
  if (px == null) return;
  target[key] = px;
}

function inferLayout(style, ctx, nodeName, el) {
  if (!style) return null;
  if (style.display === 'grid') return inferGridLayout(style, ctx, nodeName);
  if (style.display !== 'flex') return inferBlockFlowLayout(style, ctx, nodeName, el);
  const isRow = (style.flexDirection || 'row').startsWith('row');
  const out = { type: isRow ? 'horizontal' : 'vertical' };
  const gap = resolveLength(style.gap, ctx && ctx.tokenRegistry);
  if (gap.value != null) {
    if (isRow) out.spacingX = gap.value; else out.spacingY = gap.value;
    if (gap.token && ctx) recordTokenUsage(ctx, 'spacing', gap.token, `${nodeName}.gap`);
  }
  const box = parseBox(style.padding, ctx && ctx.tokenRegistry);
  if (box) {
    out.paddingTop = box.top;
    out.paddingRight = box.right;
    out.paddingBottom = box.bottom;
    out.paddingLeft = box.left;
    if (box.tokens && ctx) {
      for (const token of box.tokens) recordTokenUsage(ctx, 'spacing', token, `${nodeName}.padding`);
    }
  }
  return out;
}

function inferGridLayout(style, ctx, nodeName) {
  const columnSpec = String(style.gridTemplateColumns || '').trim();
  const cols = countGridTracks(columnSpec);
  const out = { type: 'grid' };
  const gap = resolveGridGap(style, ctx && ctx.tokenRegistry);
  if (gap.x != null) out.spacingX = gap.x;
  if (gap.y != null) out.spacingY = gap.y;
  if (gap.token && ctx) recordTokenUsage(ctx, 'spacing', gap.token, `${nodeName}.gap`);
  if (cols > 0) {
    out.constraint = 'fixed-col';
    out.constraintNum = cols;
    out.cellWidth = inferGridCellWidth(style, cols, gap.x || 0);
  }
  out.cellHeight = inferGridCellHeight(style);
  return out;
}

function inferBlockFlowLayout(style, ctx, nodeName, el) {
  const position = String(style.position || '').trim().toLowerCase();
  if (position && position !== 'static') return null;
  const childElements = (el.children || []).filter(c => c.type === 'element');
  const padding = resolveBoxEdges(style, 'padding', ctx && ctx.tokenRegistry);
  if (childElements.length < 2 && !padding) return null;
  if (childElements.length === 0) return null;
  if (childElements.some(child => childHasOutOfFlowPosition(child, ctx))) return null;

  const out = { type: 'vertical' };
  if (padding) {
    out.paddingTop = padding.top;
    out.paddingRight = padding.right;
    out.paddingBottom = padding.bottom;
    out.paddingLeft = padding.left;
    if (padding.tokens && ctx) {
      for (const token of padding.tokens) recordTokenUsage(ctx, 'spacing', token, `${nodeName}.padding`);
    }
  }
  const spacingY = inferChildBlockSpacing(childElements, ctx);
  if (spacingY > 0) out.spacingY = spacingY;
  return out;
}

function countGridTracks(spec) {
  if (!spec || spec === 'none') return 0;
  const repeat = spec.match(/^repeat\(\s*(\d+)\s*,/i);
  if (repeat) return parseInt(repeat[1], 10) || 0;
  return spec.split(/\s+/).filter(Boolean).length;
}

function inferGridCellWidth(style, cols, gap) {
  const width = parsePx(style.width);
  if (width != null && cols > 0) {
    return Math.max(1, Math.floor((width - Math.max(0, cols - 1) * gap) / cols));
  }
  if (cols >= 3) return 160;
  if (cols === 2) return 120;
  return 160;
}

function inferGridCellHeight(style) {
  const height = parsePx(style.height);
  return height != null ? height : 96;
}

function resolveGridGap(style, registry) {
  const gap = resolveGapPair(style.gap, registry);
  const columnGap = resolveLength(style.columnGap, registry);
  const rowGap = resolveLength(style.rowGap, registry);
  return {
    x: columnGap.value != null ? columnGap.value : gap.x,
    y: rowGap.value != null ? rowGap.value : gap.y,
    token: columnGap.token || rowGap.token || gap.token,
  };
}

function resolveGapPair(value, registry) {
  if (value == null) return { x: null, y: null, token: null };
  const parts = String(value).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { x: null, y: null, token: null };
  const first = resolveLength(parts[0], registry);
  const second = resolveLength(parts[1] || parts[0], registry);
  return {
    y: first.value,
    x: second.value,
    token: second.token || first.token,
  };
}

function childHasOutOfFlowPosition(child, ctx) {
  const attrs = child.attrs || {};
  const cls = (attrs.class || '').split(/\s+/).filter(Boolean);
  const childStyle = Object.assign(
    {},
    mergeClassStyles(cls, ctx.classRules || {}),
    attrs.id ? ((ctx.idRules || {})[attrs.id] || {}) : {},
    parseInlineStyle(attrs.style || ''),
  );
  const position = String(childStyle.position || '').trim().toLowerCase();
  return position === 'absolute' || position === 'fixed';
}

function inferChildBlockSpacing(childElements, ctx) {
  let spacing = 0;
  for (const child of childElements) {
    const attrs = child.attrs || {};
    const cls = (attrs.class || '').split(/\s+/).filter(Boolean);
    const childStyle = Object.assign(
      {},
      mergeClassStyles(cls, ctx.classRules || {}),
      attrs.id ? ((ctx.idRules || {})[attrs.id] || {}) : {},
      parseInlineStyle(attrs.style || ''),
    );
    const margin = parseBox(childStyle.margin, ctx && ctx.tokenRegistry);
    const marginBottom = resolveLength(childStyle.marginBottom, ctx && ctx.tokenRegistry).value
      ?? (margin && margin.bottom)
      ?? 0;
    spacing = Math.max(spacing, marginBottom);
  }
  return spacing;
}

function parseBox(v, registry) {
  if (!v) return null;
  const resolved = String(v).trim().split(/\s+/).map(p => resolveLength(p, registry));
  if (resolved.some(p => p.value == null)) return null;
  const parts = resolved.map(p => p.value);
  const tokens = [...new Set(resolved.map(p => p.token).filter(Boolean))];
  const withTokens = (box) => Object.assign(box, tokens.length ? { tokens } : {});
  if (parts.length === 1) return withTokens({ top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] });
  if (parts.length === 2) return withTokens({ top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] });
  if (parts.length === 3) return withTokens({ top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] });
  return withTokens({ top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] });
}

function resolveBoxEdges(style, prefix, registry) {
  const shorthand = parseBox(style[prefix], registry);
  const edgeValue = (edge) => resolveLength(style[`${prefix}${edge}`], registry);
  const top = edgeValue('Top');
  const right = edgeValue('Right');
  const bottom = edgeValue('Bottom');
  const left = edgeValue('Left');
  if (!shorthand && [top, right, bottom, left].every(edge => edge.value == null)) return null;
  const base = shorthand || { top: 0, right: 0, bottom: 0, left: 0 };
  const tokens = [
    ...(shorthand && shorthand.tokens ? shorthand.tokens : []),
    top.token,
    right.token,
    bottom.token,
    left.token,
  ].filter(Boolean);
  const out = {
    top: top.value ?? base.top,
    right: right.value ?? base.right,
    bottom: bottom.value ?? base.bottom,
    left: left.value ?? base.left,
  };
  return tokens.length ? Object.assign(out, { tokens: [...new Set(tokens)] }) : out;
}

function parsePx(v) {
  if (v == null) return null;
  const m = String(v).match(/^(-?\d+(?:\.\d+)?)(px)?$/);
  if (!m) return null;
  return Math.round(parseFloat(m[1]));
}

function pickDim(styleVal, attrVal) {
  const a = parsePx(styleVal);
  if (a != null) return a;
  if (typeof styleVal === 'string' && /^\d+(?:\.\d+)?%$/.test(styleVal.trim())) return styleVal.trim();
  const b = parsePx(attrVal);
  if (b != null) return b;
  if (typeof attrVal === 'string' && /^\d+(?:\.\d+)?%$/.test(attrVal.trim())) return attrVal.trim();
  return null;
}

function resolveLength(value, registry) {
  if (value == null) return { value: null, token: null };
  const cssVar = parseCssVar(value);
  if (cssVar && registry && registry.cssVars.has(cssVar)) {
    const hit = registry.cssVars.get(cssVar);
    if (hit.kind === 'spacing' || hit.kind === 'fontSize' || hit.kind === 'lineHeight') {
      return { value: hit.value, token: hit.token, cssVar };
    }
  }
  const px = parsePx(value);
  if (px == null) return { value: null, token: null };
  const token = registry && registry.spacingByValue ? registry.spacingByValue.get(px) : null;
  return { value: px, token: token ? `spacing.${token}` : null };
}

function resolveLineHeight(value, registry, fontSize) {
  if (value == null) return { value: null, token: null };
  const cssVar = parseCssVar(value);
  if (cssVar && registry && registry.cssVars.has(cssVar)) {
    const hit = registry.cssVars.get(cssVar);
    if (hit.kind === 'lineHeight') return { value: hit.value, token: hit.token, cssVar };
  }

  const raw = String(value).trim();
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
    const n = parseFloat(raw);
    if (Number.isFinite(n) && n > 0) {
      return { value: Math.round(n * fontSize), token: null };
    }
  }
  if (/^-?\d+(?:\.\d+)?%$/.test(raw)) {
    const n = parseFloat(raw);
    if (Number.isFinite(n) && n > 0) {
      return { value: Math.round((n / 100) * fontSize), token: null };
    }
  }
  if (/^-?\d+(?:\.\d+)?em$/.test(raw)) {
    const n = parseFloat(raw);
    if (Number.isFinite(n) && n > 0) {
      return { value: Math.round(n * fontSize), token: null };
    }
  }

  const px = parsePx(value);
  if (px == null) return { value: null, token: null };
  const token = registry && registry.spacingByValue ? registry.spacingByValue.get(px) : null;
  return { value: px, token: token ? `spacing.${token}` : null };
}

function parseCssVar(value) {
  const m = String(value || '').trim().toLowerCase().match(/^var\(\s*(--[a-z0-9_-]+)\s*\)$/);
  return m ? m[1] : null;
}

function autoName(ctx, tag) {
  ctx.nameCounters[tag] = (ctx.nameCounters[tag] || 0) + 1;
  return `${pascal(ctx.opts.screenId)}_${tag}_${ctx.nameCounters[tag]}`;
}

function autoSlotId(ctx, nodeName) {
  const safeName = String(nodeName).replace(/[^A-Za-z0-9_.-]/g, '_').toLowerCase();
  return `auto.${ctx.opts.screenId}.${safeName}`;
}

function pascal(s) {
  return String(s || 'Screen').replace(/(^|[-_\s]+)(\w)/g, (_, __, c) => c.toUpperCase());
}

function mergeClassStyles(classes, classRules) {
  const out = {};
  for (const c of classes) {
    if (classRules[c]) Object.assign(out, classRules[c]);
  }
  return out;
}

function collectText(el) {
  const parts = [];
  for (const c of el.children) {
    if (c.type === 'text') parts.push(c.value);
    else if (c.type === 'element') parts.push(collectText(c));
  }
  return parts.join('').trim().replace(/\s+/g, ' ');
}

function containsRichInner(el) {
  for (const c of el.children) {
    if (c.type === 'element' && RICH_TEXT_INNER_TAGS.has(c.tag)) return true;
  }
  return false;
}

function looksSimplified(text) {
  if (!text) return false;
  for (const ch of SIMPLIFIED_CHINESE_HINTS) if (text.includes(ch)) return true;
  return false;
}

function ensureSpriteSlot(ctx, slotId, attrs, style, sizeHint) {
  if (ctx.skinSlots[slotId]) return;
  const explicitPath = attrs['data-sprite'] || attrs.src;
  const path = explicitPath || `sprites/${ctx.opts.bundle || ctx.opts.defaultBundle}/${ctx.opts.screenId}/${slotId.split('.').pop()}`;
  const guarded = guardSpritePath(ctx, path, slotId, !!explicitPath);
  const slot = {
    kind: 'sprite-frame',
    path: guarded.path,
  };
  if (sizeHint && sizeHint.width != null) slot.expectedWidth = sizeHint.width;
  if (sizeHint && sizeHint.height != null) slot.expectedHeight = sizeHint.height;
  if (NINESLICE_FAMILY_HINTS.some(f => path.includes(f))) {
    slot.nineSlice = { left: 24, right: 24, top: 24, bottom: 24, _autoFilled: true };
  }
  ctx.skinSlots[slotId] = slot;
}

function ensureSpriteOrColorSlot(ctx, slotId, style, attrs, sizeHint) {
  if (ctx.skinSlots[slotId]) return;
  if (attrs['data-sprite']) {
    return ensureSpriteSlot(ctx, slotId, attrs, style, sizeHint);
  }
  if (style.backgroundImage && /url\(/.test(style.backgroundImage)) {
    const m = style.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
    return ensureSpriteSlot(ctx, slotId, { 'data-sprite': m ? stripExt(m[1]) : '' }, style, sizeHint);
  }
  // color rect
  const bg = style.background || style.backgroundColor;
  if (bg) {
    const { color, opacity, warning, tokenSource } = parseColor(bg, ctx.tokenRegistry);
    if (warning) ctx.warnings.push({ code: warning, slotId });
    if (color) recordTokenUsage(ctx, 'colors', color, `${slotId}.color${tokenSource ? ':' + tokenSource : ''}`);
    ctx.skinSlots[slotId] = {
      kind: 'color-rect',
      color: color || 'unmappedColor',
      opacity: opacity != null ? opacity : 1,
    };
    if (!color) ctx.warnings.push({ code: 'unmapped-color', detail: bg });
  } else {
    // No CSS background at all -> emit transparent skin so we don't render
    // a fake unmappedColor rectangle that visually pollutes the runtime.
    ctx.skinSlots[slotId] = { kind: 'transparent' };
  }
}

function emitSkinLayers(ctx, name, style, attrs) {
  // 多層視覺合併建議：背景圖 + 背景色 + 描邊 -> 三層 skinLayers
  const layers = [];
  if (style.backgroundColor && style.backgroundImage) {
    const colorSlot = autoSlotId(ctx, name + '_bg');
    const imgSlot = autoSlotId(ctx, name + '_image');
    ensureSpriteOrColorSlot(ctx, colorSlot, { background: style.backgroundColor }, {}, {});
    ensureSpriteOrColorSlot(ctx, imgSlot, {}, { 'data-sprite': extractUrl(style.backgroundImage) }, {});
    layers.push({ slotId: colorSlot, order: 0 });
    layers.push({ slotId: imgSlot, order: 1 });
  }
  return layers.length > 0 ? layers : null;
}

function ensureLabelStyle(ctx, slotId, style, attrs) {
  if (ctx.skinSlots[slotId]) return;
  const fontSizeResolved = resolveLength(style.fontSize, ctx.tokenRegistry);
  const fontSize = fontSizeResolved.value || numAttr(attrs['data-font-size']) || 16;
  const lineHeightResolved = resolveLineHeight(style.lineHeight, ctx.tokenRegistry, fontSize);
  const lineHeight = lineHeightResolved.value || Math.round(fontSize * 1.4);
  const letterSpacing = computeLetterSpacing(style.letterSpacing, fontSize);
  const colorParsed = style.color ? parseColor(style.color, ctx.tokenRegistry) : { color: 'textPrimary' };
  const typographyToken = resolveTypographyToken(ctx.tokenRegistry, fontSize, lineHeight);
  const slot = {
    kind: 'label-style',
    font: attrs['data-font'] || pickFontByTag(style),
    fontSize,
    lineHeight,
    letterSpacing,
    color: colorParsed.color || 'textPrimary',
    // §37.2 鐵律 1：黑色輪廓 + 寬度 2，沒明確指定就自動填
    outlineColor: 'colorOutlineDark',
    outlineWidth: 2,
    horizontalAlign: (style.textAlign || 'LEFT').toUpperCase(),
  };
  if (typographyToken) {
    slot.style = typographyToken;
    recordTokenUsage(ctx, 'typography', `typography.${typographyToken}`, `${slotId}.style`);
  }
  if (isBoldWeight(style.fontWeight)) slot.isBold = true;
  if (colorParsed.color) recordTokenUsage(ctx, 'colors', colorParsed.color, `${slotId}.color`);
  if (fontSizeResolved.token) recordTokenUsage(ctx, 'typography', fontSizeResolved.token, `${slotId}.fontSize`);
  if (lineHeightResolved.token) recordTokenUsage(ctx, 'typography', lineHeightResolved.token, `${slotId}.lineHeight`);
  ctx.skinSlots[slotId] = slot;
  if (!colorParsed.color && style.color) {
    ctx.warnings.push({ code: 'unmapped-color', slotId, detail: style.color });
  }
}

function computeLetterSpacing(value, fontSize) {
  if (value == null) return 0;
  if (typeof value === 'string' && value.endsWith('em') && fontSize) {
    const n = parseFloat(value);
    if (Number.isFinite(n)) return Math.round(n * fontSize);
  }
  const px = parsePx(value);
  return px != null ? px : 0;
}

function pickFontByTag(style) {
  if (style.fontFamily && /serif/i.test(style.fontFamily)) return 'fonts/newsreader/font';
  return 'fonts/newsreader/font';
}

function resolveTypographyToken(registry, fontSize, lineHeight) {
  if (!registry || !registry.typographyByMetric) return null;
  return registry.typographyByMetric.get(`${fontSize}/${lineHeight}`) || null;
}

function isBoldWeight(value) {
  if (!value) return false;
  const raw = String(value).trim().toLowerCase();
  if (raw === 'bold' || raw === 'bolder') return true;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 600;
}

function numAttr(v) {
  if (v == null) return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

function stripExt(p) {
  return String(p).replace(/\.(png|jpg|jpeg|webp)$/i, '');
}

function extractUrl(bgImage) {
  const m = String(bgImage).match(/url\(["']?([^"')]+)["']?\)/);
  return m ? stripExt(m[1]) : '';
}

const NAMED_COLOR_TOKENS = {
  '#000': 'colorBlack',
  '#000000': 'colorBlack',
  '#1a1a1a': 'colorOutlineDark',
  '#fff': 'colorWhite',
  '#ffffff': 'colorWhite',
};

/**
 * Best-effort parse of a CSS color into a token reference + opacity split.
 * @returns {{color:string|null, opacity:number|null, warning?:string}}
 */
function parseColor(input, registry) {
  if (!input) return { color: null, opacity: null };
  const v = String(input).trim().toLowerCase();
  const cssVar = parseCssVar(v);
  if (cssVar) {
    const hit = registry && registry.cssVars ? registry.cssVars.get(cssVar) : null;
    if (!hit) return { color: null, opacity: null, warning: 'unmapped-css-var' };
    if (hit.kind !== 'color') return { color: null, opacity: null, warning: 'css-var-kind-mismatch' };
    return { color: hit.token, opacity: null, tokenSource: `css-var:${cssVar}` };
  }
  // hex
  let m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (m) {
    const norm = normalizeHex('#' + m[1]);
    const token = (registry && registry.colorByHex ? registry.colorByHex.get(norm) : null) || NAMED_COLOR_TOKENS[norm];
    return { color: token || null, opacity: null };
  }
  // rgba / rgb
  m = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/);
  if (m) {
    const r = +m[1], g = +m[2], b = +m[3], a = m[4] != null ? +m[4] : 1;
    const hex = '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
    let token = registry && registry.colorByHex ? registry.colorByHex.get(hex) || null : null;
    if (!token) token = NAMED_COLOR_TOKENS[hex] || null;
    return { color: token, opacity: a };
  }
  return { color: null, opacity: null };
}

function inspectArtDirectionRisks(style, name, ctx, el) {
  if (!style) return;
  if (style.transform && style.transform !== 'none') {
    pushArtWarning(ctx, 'css-transform-manual-layout-risk', name, 'CSS transform 可能造成 Cocos widget 對位與縮放殘差');
  }
  if (style.overflow && style.overflow !== 'visible') {
    pushArtWarning(ctx, 'overflow-hidden-clipping-risk', name, 'overflow 裁切可能吃掉水墨 bleed、glow 或九宮外沿');
  }
  if (style.zIndex != null) {
    pushArtWarning(ctx, 'z-index-manual-zorder-risk', name, 'z-index 需要人工確認 UCUF children / skinLayers 順序');
  }
  if (style.borderRadius && isAsymmetricRadius(style.borderRadius)) {
    pushArtWarning(ctx, 'asymmetric-border-radius-approximated', name, '非對稱圓角不適合直接轉成單一九宮或 color-rect');
  }
  if ((style.filter && style.filter !== 'none') || (style.backdropFilter && style.backdropFilter !== 'none') || style.boxShadow) {
    pushArtWarning(ctx, 'css-effect-needs-art-review', name, 'filter / shadow 應改成可控 sprite layer，不宜直接近似');
  }
  if (style.opacity && Number.parseFloat(style.opacity) < 1 && hasElementChild(el)) {
    pushArtWarning(ctx, 'node-opacity-washes-children-risk', name, '容器 opacity 會連子文字一起洗淡，應優先放到背景 skin');
  }
}

function pushArtWarning(ctx, code, node, detail) {
  ctx.warnings.push({ code, detail: `${node}: ${detail}` });
  ctx.tokenUsage.artWarnings.push({ code, node, detail });
}

function isAsymmetricRadius(value) {
  const parts = String(value).trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 && new Set(parts).size > 1;
}

function hasElementChild(el) {
  return !!(el && Array.isArray(el.children) && el.children.some(c => c.type === 'element'));
}

function recordTokenUsage(ctx, bucket, token, detail) {
  if (!ctx || !ctx.tokenUsage || !token) return;
  const list = ctx.tokenUsage[bucket];
  if (!Array.isArray(list)) return;
  if (!list.some(item => item.token === token && item.detail === detail)) {
    list.push({ token, detail });
  }
}

function guardSpritePath(ctx, rawPath, slotId, explicit) {
  const raw = String(rawPath || '').trim();
  const mapped = explicit ? mapKnownRuntimeSpritePath(raw) : null;
  if (mapped && assetLikelyExists(mapped)) {
    ctx.warnings.push({ code: 'asset-path-mapped-to-runtime', slotId, detail: `${raw} -> ${mapped}` });
    return { path: mapped };
  }
  const invalid = !raw || raw.startsWith('db://') || /^[A-Za-z]:[\\/]/.test(raw) || raw.startsWith('/') || raw.startsWith('\\\\') || raw.startsWith('data:');
  if (invalid) {
    ctx.warnings.push({ code: 'asset-path-guarded', slotId, detail: raw || '<empty>' });
    return { path: PLACEHOLDER_SPRITE };
  }
  const clean = stripExt(raw);
  if (explicit && !assetLikelyExists(clean)) {
    ctx.warnings.push({ code: 'asset-missing-placeholder', slotId, detail: clean });
    return { path: PLACEHOLDER_SPRITE };
  }
  return { path: clean };
}

function mapKnownRuntimeSpritePath(rawPath) {
  const normalized = stripExt(String(rawPath || '').split(String.fromCharCode(92)).join('/'));
  const general = normalized.match(/(?:^|\/)(?:assets|lobby_assets)\/generals\/([^/]+)$/i);
  if (general) return `sprites/generals/${general[1]}_portrait`;
  const avatar = normalized.match(/(?:^|\/)(?:assets|lobby_assets)\/avatars\/([^/]+)$/i);
  if (avatar) return `sprites/generals/avatars/${avatar[1]}_avatar`;
  return null;
}

function assetLikelyExists(cleanPath) {
  const path = require('path');
  const fs = require('fs');
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const normalized = String(cleanPath || '').split(String.fromCharCode(92)).join('/').replace(/\/spriteFrame$/, '');
  const base = path.join(repoRoot, 'assets', 'resources', normalized);
  return fs.existsSync(base)
    || ['.png', '.jpg', '.jpeg', '.webp', '.json'].some(ext => fs.existsSync(base + ext));
}

function enforceColorRectGuard(ctx, parentName, childNodes) {
  let opaqueRects = 0;
  for (const c of childNodes) {
    if (c.type === 'panel' && c.skinSlot) {
      const slot = ctx.skinSlots[c.skinSlot];
      if (slot && slot.kind === 'color-rect' && (slot.opacity == null || slot.opacity > 0.1)) {
        opaqueRects += 1;
      }
    }
  }
  if (opaqueRects > 2) {
    ctx.warnings.push({ code: 'color-rect-count-warning', detail: `${parentName}:${opaqueRects}` });
  }
  if (opaqueRects >= 3) {
    ctx.warnings.push({ code: 'composition-block-risk', detail: parentName });
  }
}

module.exports = {
  buildDraftFromHtml,
  // exported for unit tests
  inferNodeType,
  anchorToWidget,
  parseColor,
  computeLetterSpacing,
};
