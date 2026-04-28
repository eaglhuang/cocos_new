#!/usr/bin/env node
// doc_id: doc_other_0009 — UCUF layout node-count optimizer
//
// Purpose:
//   Pre-rendered HTML (React/Vue/Babel) typically yields layout JSON with
//   3-5x more wrapper <div> than handcrafted UCUF would have. nodeCount
//   easily breaks `runtimeGate.blocker = 60`. This tool folds away topological
//   no-op wrappers BEFORE Cocos ever loads the JSON, cutting node cost
//   without touching React source.
//
// Fold rules (conservative — only true no-ops):
//   A node is foldable into its sole child IFF all hold:
//     1. type === 'container' (panels with skin are kept)
//     2. exactly 1 child
//     3. no skinSlot, styleSlot, contract, panelType, lazySlot, text
//     4. no _bind, _action, _ucufId set explicitly
//     5. widget is full-fill {top:0,left:0,right:0,bottom:0} OR null
//     6. no explicit width/height
//     7. no layout (or layout is no-op single-axis with one child)
//     8. name is auto-generated (matches /^.*_div_\d+$|^.*_span_\d+$|^.*_p_\d+$/)
//
// Additional reducers:
//   - empty <br>-style placeholder containers are dropped
//   - panel -> label wrappers are collapsed into one label node
//   - decorative panel leaves are absorbed into parent.skinLayers so purely
//     visual overlay nodes stop consuming runtime node budget
//
// Usage:
//   node tools_node/optimize-ucuf-layout.js \
//     --input  assets/resources/ui-spec/layouts/<screen>.json \
//     --output assets/resources/ui-spec/layouts/<screen>.json \
//     [--max-passes 5] [--report artifacts/<screen>.optimize-report.json]
//
'use strict';

const fs = require('fs');
const path = require('path');

const AUTO_NAME = /^[A-Za-z][A-Za-z0-9]*_(div|span|p|section|article|header|footer|nav|main|aside|figure|li|ul|ol)_\d+$/;
const BR_NAME = /^[A-Za-z][A-Za-z0-9]*_br_\d+$/;

function parseArgs(argv) {
  const opts = { input: null, output: null, maxPasses: 5, report: null, dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--input': opts.input = next(); break;
      case '--output': opts.output = next(); break;
      case '--max-passes': opts.maxPasses = parseInt(next(), 10) || 5; break;
      case '--report': opts.report = next(); break;
      case '--dry-run': opts.dryRun = true; break;
      case '--help':
      case '-h':
        console.log('Usage: optimize-ucuf-layout.js --input <json> --output <json> [--max-passes N] [--report <json>] [--dry-run]');
        process.exit(0);
        break;
      default:
        console.error(`[optimize-ucuf-layout] unknown arg: ${a}`);
        process.exit(2);
    }
  }
  if (!opts.input) {
    console.error('[optimize-ucuf-layout] --input is required');
    process.exit(2);
  }
  if (!opts.output && !opts.dryRun) opts.output = opts.input;
  return opts;
}

function isDefaultFillWidget(widget) {
  if (!widget) return true;
  return widget.top === 0 && widget.left === 0 && widget.right === 0 && widget.bottom === 0;
}

function hasPadding(layout) {
  if (!layout || typeof layout !== 'object') return false;
  return (layout.paddingTop || 0) + (layout.paddingRight || 0) +
         (layout.paddingBottom || 0) + (layout.paddingLeft || 0) > 0;
}

function hasSemanticFlags(node) {
  if (!node || typeof node !== 'object') return false;
  return !!(
    node._contract || node._bind || node._action || node.contract ||
    node.panelType || node.dataSource || node.lazySlot || node._ucufId ||
    node._interactionId
  );
}

function cloneWidget(widget) {
  if (!widget || typeof widget !== 'object') return null;
  return {
    top: widget.top,
    left: widget.left,
    right: widget.right,
    bottom: widget.bottom,
    hCenter: widget.hCenter,
    vCenter: widget.vCenter,
  };
}

function getLayerZOrder(layer) {
  if (!layer || typeof layer !== 'object') return 0;
  if (typeof layer.zOrder === 'number' && !Number.isNaN(layer.zOrder)) return layer.zOrder;
  if (typeof layer.order === 'number' && !Number.isNaN(layer.order)) return layer.order;
  return 0;
}

function getNextLayerZOrder(node) {
  const layers = Array.isArray(node && node.skinLayers) ? node.skinLayers : [];
  let max = -1;
  for (const layer of layers) {
    const zOrder = getLayerZOrder(layer);
    if (zOrder > max) max = zOrder;
  }
  return max + 1;
}

function isFoldable(node) {
  if (!node || node.type !== 'container') return false;
  if (!Array.isArray(node.children) || node.children.length !== 1) return false;
  if (node.skinSlot || node.styleSlot) return false;
  if (node._contract || node._bind || node._action) return false;
  if (node.contract || node.panelType || node.dataSource) return false;
  if (node.lazySlot) return false;
  if (node.text != null && node.text !== '') return false;
  if (node._ucufId) return false;
  if (node.width != null || node.height != null) return false;
  if (!isDefaultFillWidget(node.widget)) return false;
  if (node.layout && Object.keys(node.layout).length > 0 && hasPadding(node.layout)) return false;
  if (!node.name || !AUTO_NAME.test(node.name)) return false;
  return true;
}

function canHoistSingleChildContainer(node) {
  if (!node || node.type !== 'container') return false;
  if (!Array.isArray(node.children) || node.children.length !== 1) return false;
  if (node.skinSlot || node.styleSlot) return false;
  if (hasSemanticFlags(node)) return false;
  if (node.text != null && node.text !== '') return false;
  if (node.width != null || node.height != null) return false;
  if (!isDefaultFillWidget(node.widget)) return false;
  if (node.layout && Object.keys(node.layout).length > 0 && hasPadding(node.layout)) return false;
  return true;
}

function countNodes(node) {
  if (!node) return 0;
  let count = 1;
  if (Array.isArray(node.children)) {
    for (const child of node.children) count += countNodes(child);
  }
  return count;
}

function isEmptyLeaf(node) {
  if (!node || node.type !== 'container') return false;
  if (Array.isArray(node.children) && node.children.length > 0) return false;
  if (node.skinSlot || node.styleSlot) return false;
  if (node.text != null && node.text !== '') return false;
  if (node._contract || node._bind || node._action || node._ucufId) return false;
  if (node.contract || node.panelType || node.dataSource || node.lazySlot) return false;
  if (node.width != null || node.height != null) return false;
  if (!node.name || !AUTO_NAME.test(node.name)) return false;
  return true;
}

function isBrPlaceholder(node) {
  return !!(
    node &&
    node.type === 'container' &&
    (!Array.isArray(node.children) || node.children.length === 0) &&
    typeof node.name === 'string' &&
    BR_NAME.test(node.name)
  );
}

function isVisualOnlySkinLeaf(node) {
  if (!node || (node.type !== 'panel' && node.type !== 'image')) return false;
  if (!node.skinSlot || node.styleSlot) return false;
  if (hasSemanticFlags(node)) return false;
  if (node.text != null && node.text !== '') return false;
  if (Array.isArray(node.children) && node.children.length > 0) return false;
  return true;
}

function toSkinLayer(node, zOrder) {
  const layer = {
    layerId: node.name || `layer_${zOrder}`,
    slotId: node.skinSlot,
    zOrder,
  };
  const hasExplicitGeometry = node.width != null || node.height != null || !isDefaultFillWidget(node.widget);
  if (hasExplicitGeometry) {
    layer.expand = false;
    if (node.width != null) layer.width = node.width;
    if (node.height != null) layer.height = node.height;
    if (node.widget) layer.widget = cloneWidget(node.widget);
  } else {
    layer.expand = true;
  }
  if (typeof node.opacity === 'number') layer.opacity = node.opacity;
  return layer;
}

function absorbVisualChild(parent, child, absorbedNames) {
  if (!parent || !child || !isVisualOnlySkinLeaf(child)) return false;
  if (!Array.isArray(parent.skinLayers)) parent.skinLayers = [];
  parent.skinLayers.push(toSkinLayer(child, getNextLayerZOrder(parent)));
  absorbedNames.push(child.name);
  return true;
}

function canCollapsePanelIntoLabel(node) {
  if (!node || node.type !== 'panel' || !node.skinSlot) return false;
  if (!Array.isArray(node.children) || node.children.length !== 1) return false;
  const child = node.children[0];
  if (!child || child.type !== 'label') return false;
  if (Array.isArray(child.children) && child.children.length > 0) return false;
  if (child.skinSlot) return false;
  if (!isDefaultFillWidget(child.widget)) return false;
  return true;
}

function collapsePanelIntoLabel(node, collapsedNames) {
  const child = node.children[0];
  node.type = 'label';
  if (child.text != null) node.text = child.text;
  if (child.textKey != null) node.textKey = child.textKey;
  if (child.styleSlot) node.styleSlot = child.styleSlot;
  if (child.bind && !node.bind) node.bind = child.bind;
  if (child._contract && !node._contract) node._contract = child._contract;
  if (child._bind && !node._bind) node._bind = child._bind;
  if (child._action && !node._action) node._action = child._action;
  delete node.children;
  delete node.layout;
  collapsedNames.push(node.name);
  return node;
}

function foldOnce(node, foldedNames, droppedNames, absorbedNames, collapsedNames) {
  if (!node) return node;
  if (Array.isArray(node.children)) {
    const nextChildren = [];
    for (let child of node.children) {
      let folded = foldOnce(child, foldedNames, droppedNames, absorbedNames, collapsedNames);
      if (!folded) continue;
      if (isBrPlaceholder(folded) || isEmptyLeaf(folded)) {
        droppedNames.push(folded.name);
        continue;
      }
      while (isFoldable(folded)) {
        foldedNames.push(folded.name);
        folded = folded.children[0];
      }
      while (canHoistSingleChildContainer(folded)) {
        foldedNames.push(folded.name);
        folded = folded.children[0];
      }
      if (canCollapsePanelIntoLabel(folded)) {
        folded = collapsePanelIntoLabel(folded, collapsedNames);
      }
      if (absorbVisualChild(node, folded, absorbedNames)) {
        continue;
      }
      nextChildren.push(folded);
    }
    node.children = nextChildren;
  }
  return node;
}

function foldRoot(root, foldedNames, droppedNames, absorbedNames, collapsedNames) {
  return foldOnce(root, foldedNames, droppedNames, absorbedNames, collapsedNames);
}

function resolveLayoutRoot(document) {
  if (
    document &&
    typeof document === 'object' &&
    document.root &&
    typeof document.root === 'object' &&
    typeof document.root.type === 'string'
  ) {
    return {
      root: document.root,
      wrapped: true,
    };
  }
  return {
    root: document,
    wrapped: false,
  };
}

function main() {
  const opts = parseArgs(process.argv);
  const inputAbs = path.resolve(opts.input);
  const layoutDocument = JSON.parse(fs.readFileSync(inputAbs, 'utf8'));
  const resolved = resolveLayoutRoot(layoutDocument);
  const rootNode = resolved.root;
  const before = countNodes(rootNode);
  const foldedNames = [];
  const droppedNames = [];
  const absorbedNames = [];
  const collapsedNames = [];

  let pass = 0;
  let prevCount = before;
  for (; pass < opts.maxPasses; pass += 1) {
    foldRoot(rootNode, foldedNames, droppedNames, absorbedNames, collapsedNames);
    const current = countNodes(rootNode);
    if (current === prevCount) break;
    prevCount = current;
  }

  const after = countNodes(rootNode);
  const report = {
    input: opts.input,
    wrappedRoot: resolved.wrapped,
    passes: pass + 1,
    before,
    after,
    foldedCount: foldedNames.length,
    droppedCount: droppedNames.length,
    absorbedCount: absorbedNames.length,
    collapsedCount: collapsedNames.length,
    foldedNames,
    droppedNames,
    absorbedNames,
    collapsedNames,
  };

  if (opts.dryRun) {
    console.log(`[optimize-ucuf-layout] dry-run: would fold ${foldedNames.length} + drop ${droppedNames.length} + absorb ${absorbedNames.length} + collapse ${collapsedNames.length} (${before} -> ${after})`);
  } else {
    fs.writeFileSync(opts.output, JSON.stringify(layoutDocument, null, 2), 'utf8');
    console.log(`[optimize-ucuf-layout] wrote ${opts.output}: folded ${foldedNames.length} + dropped ${droppedNames.length} + absorbed ${absorbedNames.length} + collapsed ${collapsedNames.length} (${before} -> ${after}) in ${pass + 1} passes`);
  }
  if (opts.report) {
    const reportDir = path.dirname(path.resolve(opts.report));
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(opts.report, JSON.stringify(report, null, 2), 'utf8');
  }
}

main();
