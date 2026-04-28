#!/usr/bin/env node
// doc_id: doc_other_0009 — dom-to-ui-compare
// Generates a 512×256 side-by-side comparison PNG:
//   Left  256×256 : source HTML rendered in headless Chrome
//   Right 256×256 : UCUF layout wireframe preview
//
// Usage:
//   node tools_node/dom-to-ui-compare.js \
//     --html  <source.html>   \
//     --layout <layout.json>  \
//     --skin   <skin.json>    \
//     --screen-id <id>        \
//     --output <compare.png>  \
//     [--browser <chrome.exe>]
//     [--tokens <tokens.json>]
//     [--width 512] [--height 256]
//     [--no-labels]
//
// Exit codes:  0=ok  1=error

'use strict';
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execFileSync, execSync } = require('child_process');

// New M13-M20 lib modules (high-fidelity stack)
const { captureComputedStyles } = require('./lib/dom-to-ui/computed-style-capture');
const { snapshotToSlots } = require('./lib/dom-to-ui/snapshot-to-slots');
const { slotToCss } = require('./lib/dom-to-ui/skin-to-css');
const { pixelDiff, writeHeatmap } = require('./lib/dom-to-ui/pixel-diff');
const { buildWaivers, waiverRectsForPixelDiff } = require('./lib/dom-to-ui/image-waiver');
const { buildTokenSuggestions } = require('./lib/dom-to-ui/token-suggestion');
const { buildFidelityEntries, appendEntries } = require('./lib/dom-to-ui/fidelity-feedback');
const { auditFonts, buildFontOverrideStyle, buildBrokenImageHiderScript, buildProjectFontFaces, PROJECT_FONT_FAMILIES } = require('./lib/dom-to-ui/font-audit');

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    html:     null,
    layout:   null,
    skin:     null,
    tokens:   null,
    screenId: null,
    output:   null,
    browser:  null,
    width:    0,
    height:   0,
    labels:   true,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--html')      { opts.html     = args[++i]; }
    else if (a === '--layout')    { opts.layout   = args[++i]; }
    else if (a === '--skin')      { opts.skin     = args[++i]; }
    else if (a === '--tokens')    { opts.tokens   = args[++i]; }
    else if (a === '--screen-id') { opts.screenId = args[++i]; }
    else if (a === '--output')    { opts.output   = args[++i]; }
    else if (a === '--browser')   { opts.browser  = args[++i]; }
    else if (a === '--width')     { opts.width    = parseInt(args[++i], 10); }
    else if (a === '--height')    { opts.height   = parseInt(args[++i], 10); }
    else if (a === '--no-labels') { opts.labels   = false; }
    else if (a === '--debug-preview') { opts.debugPreview = true; }
    else if (a === '--render-mode') { opts.renderMode = args[++i]; }
    else if (a === '--pixel-diff') { opts.pixelDiff = true; }
    else if (a === '--no-pixel-diff') { opts.pixelDiff = false; }
    else if (a === '--strict-pixel') { opts.strictPixel = parseFloat(args[++i]); }
    else if (a === '--strict-coverage') { opts.strictCoverage = parseFloat(args[++i]); }
    else if (a === '--emit-feedback') { opts.emitFeedback = true; }
    else if (a === '--pre-eval') { opts.preEval = args[++i]; }
    else if (a === '--settle-ms') { opts.settleMs = parseInt(args[++i], 10); }
    else if (a === '--save-panels') { opts.savePanels = args[++i]; }
  }
  if (opts.renderMode == null) opts.renderMode = 'high-fidelity';
  if (opts.pixelDiff == null) opts.pixelDiff = true;
  // Derive screenId from layout path if not given
  if (!opts.screenId && opts.layout) {
    opts.screenId = path.basename(opts.layout, '.json').replace(/\.layout$/, '');
  }
  return opts;
}

function usage() {
  console.error(
    'Usage: node dom-to-ui-compare.js --html <file> --layout <file> --skin <file> --screen-id <id> --output <png>'
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Browser discovery
// ---------------------------------------------------------------------------
const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.CHROME_PATH,
].filter(Boolean);

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  process.env.EDGE_PATH,
].filter(Boolean);

function findBrowser() {
  for (const p of [...CHROME_CANDIDATES, ...EDGE_CANDIDATES]) {
    if (p && fs.existsSync(p)) return p;
  }
  throw new Error('Cannot find Chrome or Edge. Pass --browser <path>.');
}

// ---------------------------------------------------------------------------
// Token map from design-tokens.json
// ---------------------------------------------------------------------------
function loadTokenMap(overridePath) {
  const candidates = [
    overridePath,
    path.join(__dirname, '..', 'assets', 'resources', 'ui-spec', 'ui-design-tokens.json'),
    path.join(__dirname, '..', 'Design System', 'design_handoff', 'source', 'ui-design-tokens.json'),
  ].filter(Boolean);

  for (const p of candidates) {
    if (p && fs.existsSync(p)) {
      try {
        const obj = JSON.parse(fs.readFileSync(p, 'utf8'));
        const colors = obj.colors || {};
        // Build a flat token→hex map
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

function toFileUrl(absPath) {
  return encodeURI(`file:///${path.resolve(absPath).replace(/\\/g, '/')}`);
}

function ensureBaseHref(html, baseHref) {
  if (/<base\s+href=/i.test(html)) return html;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>\n<base href="${baseHref}">`);
  }
  return `<head><base href="${baseHref}"></head>\n${html}`;
}

function inlineLocalBabelScripts(html, htmlDir) {
  return html.replace(
    /<script([^>]*\btype=["']text\/babel["'][^>]*)\bsrc=["']([^"']+)["']([^>]*)><\/script>/gi,
    (fullMatch, beforeSrc, src, afterSrc) => {
      if (/^(https?:|data:|file:|\/\/)/i.test(src)) return fullMatch;
      const scriptPath = path.resolve(htmlDir, src);
      if (!fs.existsSync(scriptPath)) return fullMatch;
      const scriptCode = fs.readFileSync(scriptPath, 'utf8');
      return `<script${beforeSrc}${afterSrc}>\n${scriptCode}\n</script>`;
    },
  );
}

/**
 * Inline local <link rel="stylesheet" href="..."> that cannot be found
 * at the resolved path (common when the CSS lives one dir-tree away).
 * Falls back to a project-wide search for the same filename.
 */
function inlineLocalStylesheets(html, htmlDir) {
  // Build a candidate search root (walk up from htmlDir until we find package.json or reach drive root)
  let searchRoot = htmlDir;
  for (let i = 0; i < 6; i++) {
    const parent = path.dirname(searchRoot);
    if (parent === searchRoot) break;
    if (fs.existsSync(path.join(parent, 'package.json'))) { searchRoot = parent; break; }
    searchRoot = parent;
  }

  return html.replace(
    /<link([^>]*\brel=["']stylesheet["'][^>]*)\bhref=["']([^"']+)["']([^>]*)>/gi,
    (fullMatch, before, href, after) => {
      if (/^(https?:|data:|file:|\/\/)/i.test(href)) return fullMatch;
      const directPath = path.resolve(htmlDir, href);
      if (fs.existsSync(directPath)) return fullMatch; // base href will handle it

      // Try to find the file anywhere under the project root
      const filename = path.basename(href);
      const found = findFileInDir(searchRoot, filename);
      if (!found) return `<!-- css not found: ${href} -->`;
      try {
        const css = fs.readFileSync(found, 'utf8');
        return `<style>/* inlined from ${found} */\n${css}\n</style>`;
      } catch {
        return fullMatch;
      }
    },
  );
}

function findFileInDir(dir, filename) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'library' || e.name === 'temp') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        const found = findFileInDir(full, filename);
        if (found) return found;
      } else if (e.name === filename) {
        return full;
      }
    }
  } catch {}
  return null;
}

function prepareSourceHtmlForCapture(sourceHtmlPath, screenId, extraHead) {
  const absSourcePath = path.resolve(sourceHtmlPath);
  const sourceDir = path.dirname(absSourcePath);
  const baseHref = `${toFileUrl(sourceDir)}/`;
  let html = fs.readFileSync(absSourcePath, 'utf8');

  // `type="text/babel" src="local.jsx"` is fetched via XHR by Babel and fails on file://.
  // Inline those local files into a temp HTML so the handoff page can still render in headless capture.
  html = ensureBaseHref(html, baseHref);
  html = inlineLocalBabelScripts(html, sourceDir);
  // Inline local CSS that can't be resolved via base href (e.g., shared design tokens CSS
  // in a sibling directory tree, like colors_and_type.css in Design System 2).
  html = inlineLocalStylesheets(html, sourceDir);

  // Inject font-override + broken-image hider so that BOTH source and preview
  // converge on the same fallback fonts and the same blank-image policy.
  if (extraHead) {
    if (/<\/head>/i.test(html)) {
      html = html.replace(/<\/head>/i, `${extraHead}\n</head>`);
    } else {
      html = extraHead + html;
    }
  }

  const preparedPath = path.join(os.tmpdir(), `ucuf-source-${screenId}-${Date.now()}.html`);
  fs.writeFileSync(preparedPath, html, 'utf8');
  return preparedPath;
}

async function waitForPageSettle(page, timeoutMs) {
  try {
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: timeoutMs });
  } catch {}
  try {
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
    });
  } catch {}
  await new Promise(resolve => setTimeout(resolve, 1200));
}

// ---------------------------------------------------------------------------
// UCUF wireframe → preview HTML
// ---------------------------------------------------------------------------
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveColor(tokenName, tokenMap, fallback) {
  return (tokenName && tokenMap[tokenName]) || fallback || '#888888';
}

/**
 * Recursively render a UCUF layout node as HTML.
 * @param {object} node  - layout node
 * @param {object} slots - skin.slots map
 * @param {object} tokenMap - token→hex
 * @param {string} canvasW  - design canvas width
 * @param {string} canvasH  - design canvas height
 * @param {number} depth
 * @returns {string} HTML string
 */
function renderNode(node, slots, tokenMap, canvasW, canvasH, depth, opts) {
  if (!node || typeof node !== 'object') return '';

  const styleArr = [];
  const slot = slots[node.skinSlot] || slots[node.styleSlot] || null;

  // --- Position via widget ---
  // Converts UCUF widget anchor spec to CSS absolute positioning.
  // Rules (mirrors Cocos Widget behaviour):
  //   - Any combination of top/left/right/bottom → position:absolute with those values
  //   - hCenter alone (+ optional width) → centered with margin auto
  //   - vCenter alone (+ optional height) → vertically centered
  //   - If node has explicit width/height but no anchors → use those dimensions
  //   - Fallback → flex:1 (flow layout inside flex parent)
  const w = node.widget;
  if (w && Object.keys(w).length > 0) {
    const hasTop    = w.top    !== undefined && w.top    !== null;
    const hasLeft   = w.left   !== undefined && w.left   !== null;
    const hasRight  = w.right  !== undefined && w.right  !== null;
    const hasBottom = w.bottom !== undefined && w.bottom !== null;
    const hasHCenter = w.hCenter !== undefined && w.hCenter !== null;
    const hasVCenter = w.vCenter !== undefined && w.vCenter !== null;

    const hasAnyAnchor = hasTop || hasLeft || hasRight || hasBottom;

    if (hasAnyAnchor || hasHCenter || hasVCenter) {
      const parts = ['position:absolute;'];
      if (hasTop)    parts.push(`top:${w.top}px;`);
      if (hasLeft)   parts.push(`left:${w.left}px;`);
      if (hasRight)  parts.push(`right:${w.right}px;`);
      if (hasBottom) parts.push(`bottom:${w.bottom}px;`);
      // Width/height from node (explicit) or derive from opposite anchors
      if (node.width  !== undefined && !(hasLeft  && hasRight))  parts.push(`width:${node.width}px;`);
      if (node.height !== undefined && !(hasTop   && hasBottom)) parts.push(`height:${node.height}px;`);
      // hCenter: horizontally centered at offset from parent center
      if (hasHCenter && node.width) {
        parts.push(`left:50%;margin-left:${(w.hCenter || 0) - Math.floor(node.width / 2)}px;width:${node.width}px;`);
      }
      if (hasVCenter && node.height) {
        parts.push(`top:50%;margin-top:${(w.vCenter || 0) - Math.floor(node.height / 2)}px;height:${node.height}px;`);
      }
      styleArr.push(parts.join(''));
    } else {
      styleArr.push('flex:1;min-width:0;min-height:0;');
    }
  } else if (node.width || node.height) {
    // No widget anchors but has explicit size → use it as inline-block
    const wStr = node.width  ? `width:${node.width}px;`  : '';
    const hStr = node.height ? `height:${node.height}px;` : '';
    styleArr.push(`flex-shrink:0;${wStr}${hStr}`);
  } else {
    styleArr.push('flex:1;min-width:0;min-height:0;');
  }

  // --- Layout (flex) ---
  const lay = node.layout;
  if (lay && lay.type === 'vertical') {
    styleArr.push(
      `display:flex;flex-direction:column;` +
      `gap:${lay.spacingY || 0}px;` +
      `padding:${lay.paddingTop || 0}px ${lay.paddingRight || 0}px ` +
      `${lay.paddingBottom || 0}px ${lay.paddingLeft || 0}px;` +
      `box-sizing:border-box;overflow:hidden;`
    );
  } else if (lay && lay.type === 'horizontal') {
    styleArr.push(
      `display:flex;flex-direction:row;` +
      `gap:${lay.spacingX || 0}px;` +
      `padding:${lay.paddingTop || 0}px ${lay.paddingRight || 0}px ` +
      `${lay.paddingBottom || 0}px ${lay.paddingLeft || 0}px;` +
      `box-sizing:border-box;overflow:hidden;`
    );
  }

  // --- Background / color from skin slot ---
  if (slot) {
    if (slot.kind === 'color-rect') {
      // Use a visible muted fallback when the color token isn't in the map
      // ('unmappedColor' or any unknown token should still produce a visible panel)
      const rawHex = (slot.color && tokenMap[slot.color]) || null;
      const hex = rawHex || (slot.color && slot.color !== 'unmappedColor' ? slot.color : '#2d3050');
      styleArr.push(`background-color:${hex};border:1px solid rgba(255,255,255,0.12);`);
      if (slot.opacity !== undefined && slot.opacity < 1) {
        styleArr.push(`opacity:${slot.opacity};`);
      }
    } else if (slot.kind === 'label-style') {
      const hex = resolveColor(slot.color, tokenMap, '#e5e2e1');
      styleArr.push(`color:${hex};`);
      if (slot.fontSize) styleArr.push(`font-size:${slot.fontSize}px;`);
      if (slot.lineHeight) styleArr.push(`line-height:${slot.lineHeight}px;`);
      if (slot.letterSpacing) styleArr.push(`letter-spacing:${slot.letterSpacing}px;`);
      const align = (slot.horizontalAlign || '').toLowerCase();
      if (align === 'center') styleArr.push('text-align:center;');
    }
  }

  const styleStr = styleArr.join('');

  // --- LazySlot ---
  if (node.lazySlot) {
    return (
      `<div style="${styleStr}border:2px dashed #555;display:flex;align-items:center;` +
      `justify-content:center;color:#888;font-size:11px;min-height:40px;box-sizing:border-box;">` +
      `<span style="padding:4px 8px;">&#128230; ${escHtml(node.name)} [${escHtml(node.defaultFragment || '?')}]</span>` +
      `</div>`
    );
  }

  // --- Label ---
  if (node.type === 'label') {
    const text = node.text || node.name;
    return `<div style="${styleStr}overflow:hidden;text-overflow:ellipsis;">${escHtml(text)}</div>`;
  }

  // --- Button ---
  if (node.type === 'button') {
    const bgHex = (slot && slot.kind === 'color-rect')
      ? resolveColor(slot.color, tokenMap, '#B22222')
      : '#B22222';
    const btnStyle =
      `background:${bgHex};color:#fff;border:none;padding:10px 20px;` +
      `cursor:pointer;font-size:14px;border-radius:4px;` +
      `display:block;width:100%;box-sizing:border-box;` +
      `font-family:inherit;text-align:center;`;
    const badge = node._interactionId
      ? `<span style="background:rgba(255,255,255,0.25);border-radius:3px;font-size:9px;` +
        `padding:2px 5px;margin-left:6px;vertical-align:middle;">&#8594; panel</span>`
      : '';
    return `<button style="${btnStyle}">${escHtml(node.name)}${badge}</button>`;
  }

  // --- Panel / Container (with children) ---
  // Wireframe mode draws an explicit blue outline; high-fidelity stays clean.
  if (!slot && opts && opts.wireframe) {
    styleArr.push(`border:2px solid rgba(100,140,220,0.5);`);
  }
  const children = (node.children || [])
    .map(ch => renderNode(ch, slots, tokenMap, canvasW, canvasH, depth + 1, opts))
    .join('\n');

  return `<div style="${styleArr.join('')}">${children}</div>`;
}

function generatePreviewHtml(layoutData, skinData, tokenMap, opts) {
  opts = opts || {};
  const canvas = layoutData.canvas || { designWidth: 1334, designHeight: 750 };
  const W = canvas.designWidth || 1334;
  const H = canvas.designHeight || 750;
  const slots = (skinData && skinData.slots) || {};
  const bgHex = '#0f0f0f';

  // Support both formats:
  //   - Old hand-authored: { id, version, canvas, root: { type, children, ... } }
  //   - dom-to-ui-json generated: { specVersion, canvas, type, children, ... }
  const rootNode = layoutData.root || layoutData;
  const body = renderNode(rootNode, slots, tokenMap, W, H, 0, opts);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: ${W}px; height: ${H}px;
    overflow: hidden;
    background: ${bgHex};
    font-family: "Noto Sans TC", "Microsoft JhengHei", Arial, sans-serif;
    font-size: 14px;
  }
  .canvas-root {
    position: relative;
    width: ${W}px; height: ${H}px;
    overflow: hidden;
    background: ${bgHex};
  }
</style>
</head>
<body>
<div class="canvas-root">
${body}
<!-- UCUF wireframe preview · dom-to-ui-compare -->
</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// PowerShell image combine
// ---------------------------------------------------------------------------
function combineImages(leftPng, rightPng, outputPng, screenId, totalW, totalH, addLabels, srcW, srcH) {
  // srcW/srcH: canvas design size (used for aspect-ratio scaling). M27.
  srcW = srcW || 1334;
  srcH = srcH || 750;
  // Each panel is half the total width, full height
  const panelW = Math.floor(totalW / 2);
  const panelH = totalH;

  const leftLabel  = addLabels ? 'HTML Source' : '';
  const rightLabel = addLabels ? 'UCUF Preview' : '';

  // Escape for PowerShell single-quoted strings inside double-quoted
  const esc = s => s.replace(/'/g, "''").replace(/\\/g, '\\\\');

  const ps = `
Add-Type -AssemblyName System.Drawing

function Resize-Image([string]$srcPath, [int]$W, [int]$H) {
    $src = [System.Drawing.Image]::FromFile($srcPath)
    $bmp = New-Object System.Drawing.Bitmap $W, $H
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($src, 0, 0, $W, $H)
    $g.Dispose(); $src.Dispose()
    return $bmp
}

$panelW = ${panelW}
$panelH = ${panelH}
$totalW = ${totalW}
$totalH = ${totalH}

# Scale each screenshot to fit inside panelW x panelH (letterbox)
# Source aspect ratio from Cocos canvas constants (M27: no more hardcoded 1334x750)
$srcAspect = ${srcW}.0 / ${srcH}.0
$panelAspect = $panelW * 1.0 / $panelH

if ($srcAspect -gt $panelAspect) {
    $fitW = $panelW - 4
    $fitH = [int][Math]::Round($fitW / $srcAspect)
} else {
    $fitH = $panelH - 4
    $fitW = [int][Math]::Round($fitH * $srcAspect)
}
$offsetX = [int][Math]::Round(($panelW - $fitW) / 2)
$offsetY = [int][Math]::Round(($panelH - $fitH) / 2)

$leftScaled  = Resize-Image '${esc(leftPng)}'  $fitW $fitH
$rightScaled = Resize-Image '${esc(rightPng)}' $fitW $fitH

$out = New-Object System.Drawing.Bitmap $totalW, $totalH
$g   = [System.Drawing.Graphics]::FromImage($out)
$g.Clear([System.Drawing.Color]::FromArgb(15,15,15))

# Draw left panel
$g.DrawImage($leftScaled, $offsetX, $offsetY)
# Draw right panel
$g.DrawImage($rightScaled, $panelW + $offsetX, $offsetY)

# Divider line
$divPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80,80,80), 1)
$g.DrawLine($divPen, $panelW, 0, $panelW, $totalH)

# Labels
if ('${leftLabel}' -ne '') {
    $font       = New-Object System.Drawing.Font("Arial", 9, [System.Drawing.FontStyle]::Bold)
    $labelBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(200,200,200))
    $bgBrush    = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40,40,40))
    $leftSize   = $g.MeasureString('${leftLabel}',  $font)
    $rightSize  = $g.MeasureString('${rightLabel}', $font)
    $g.FillRectangle($bgBrush,  2, 2, $leftSize.Width+4,  $leftSize.Height+2)
    $g.FillRectangle($bgBrush, ($panelW+2), 2, $rightSize.Width+4, $rightSize.Height+2)
    $g.DrawString('${leftLabel}',  $font, $labelBrush,  [float]4, [float]3)
    $g.DrawString('${rightLabel}', $font, $labelBrush,  [float]($panelW+4), [float]3)
}

$g.Dispose()
$leftScaled.Dispose(); $rightScaled.Dispose()

# Ensure output dir exists
$outDir = [System.IO.Path]::GetDirectoryName('${esc(outputPng)}')
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

$out.Save('${esc(outputPng)}', [System.Drawing.Imaging.ImageFormat]::Png)
$out.Dispose()
Write-Host "saved:${esc(outputPng)}"
`;

  const result = execFileSync('powershell', ['-NoProfile', '-Command', ps], {
    encoding: 'utf8',
    timeout: 30000,
  });
  return result.trim();
}

// ---------------------------------------------------------------------------
// High-Fidelity Renderer (M13/M14/M15)
// ---------------------------------------------------------------------------
/**
 * Build HTML that places one absolutely-positioned <div> per captured snapshot.
 * Uses each snapshot's _rect for geometry and slotToCss(slot) for visuals.
 */
function generateHighFidelityHtml(canvasW, canvasH, snapshots, tokenMap, opts) {
  opts = opts || {};
  const sourceDir = opts.sourceDir || '';
  const extraHead = opts.extraHead || '';

  function htmlEscape(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function attrEscape(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }
  function resolveUrl(u) {
    if (!u) return u;
    if (/^(data|https?|blob|file):/i.test(u)) return u;
    if (!sourceDir) return u;
    const path = require('path');
    const abs = path.resolve(sourceDir, u.replace(/^\//, ''));
    return 'file:///' + abs.replace(/\\/g, '/');
  }
  function unwrapContent(c) {
    if (!c) return null;
    const t = String(c).trim();
    if (t === 'none' || t === 'normal') return null;
    const m = t.match(/^"((?:[^"\\]|\\.)*)"$/) || t.match(/^'((?:[^'\\]|\\.)*)'$/);
    if (m) return m[1].replace(/\\(.)/g, '$1');
    if (/^(url|counter|counters|attr)\(/i.test(t)) return null;
    return t;
  }

  // -------- Build DOM tree by parentId --------
  const byId = new Map();
  for (const s of snapshots) byId.set(s.id, s);
  const childrenOf = new Map(); // parentId → [snap, ...]
  childrenOf.set(0, []); // body
  for (const s of snapshots) {
    const pid = s.parentId || 0;
    if (!childrenOf.has(pid)) childrenOf.set(pid, []);
    childrenOf.get(pid).push(s);
  }

  function renderNode(snap) {
    const styles = snap.styles || {};
    const rect  = styles._rect;
    if (!rect || rect.w <= 0 || rect.h <= 0) return '';

    // Position child relative to its DOM parent's viewport rect.
    // This makes the layout reproducible even under transformed ancestors,
    // because CSS transforms cascade naturally through the nested <div> tree.
    let x = rect.x, y = rect.y;
    if (snap.parentId && byId.has(snap.parentId)) {
      const pRect = byId.get(snap.parentId).styles._rect;
      if (pRect) {
        x = rect.x - pRect.x;
        y = rect.y - pRect.y;
      }
    }
    const w = rect.w, h = rect.h;

    const isPseudo = !!snap.pseudo;
    const pseudoText = isPseudo ? unwrapContent(styles.content) : null;
    const inlineText = !isPseudo && styles._textContent && styles._textContent.trim().length > 0
      ? styles._textContent.trim() : '';
    const hasText = !!(pseudoText || inlineText);

    // M27: resolve relative url() references in background-image so that
    // noise textures / sprite sheets load correctly in the file:// preview.
    let resolvedStyles = styles;
    if (styles['background-image'] && styles['background-image'] !== 'none') {
      const resolvedBg = styles['background-image'].replace(
        /url\(["']?([^"')]+)["']?\)/gi,
        (match, u) => `url("${resolveUrl(u)}")`
      );
      if (resolvedBg !== styles['background-image']) {
        resolvedStyles = Object.assign({}, styles, { 'background-image': resolvedBg });
      }
    }

    const slots = snapshotToSlots(resolvedStyles, { hasText });
    let css = '';
    for (const s of slots) css += slotToCss(s, tokenMap) + ';';

    const idAttr = ` data-id="${attrEscape(snap.id || '')}"`;
    const zIdx = styles && styles['z-index'] && styles['z-index'] !== 'auto'
      ? `z-index:${styles['z-index']};` : '';
    // M23: alignment pass — apply display/flex/align/gap/white-space to baseStyle.
    // Children are position:absolute (out of flex flow) so flex props only affect
    // in-flow text content — exactly what we want for leaf text centering.
    const alignParts = [];
    const disp = styles && styles['display'];
    const isFlexGrid = disp === 'flex' || disp === 'inline-flex' || disp === 'grid' || disp === 'inline-grid';
    if (isFlexGrid) {
      alignParts.push(`display:${disp}`);
      const fd = styles['flex-direction']; if (fd && fd !== 'row') alignParts.push(`flex-direction:${fd}`);
      const fw = styles['flex-wrap']; if (fw && fw !== 'nowrap') alignParts.push(`flex-wrap:${fw}`);
      const ai = styles['align-items']; if (ai && ai !== 'normal' && ai !== 'stretch') alignParts.push(`align-items:${ai}`);
      const jc = styles['justify-content']; if (jc && jc !== 'normal') alignParts.push(`justify-content:${jc}`);
      const ac = styles['align-content']; if (ac && ac !== 'normal') alignParts.push(`align-content:${ac}`);
      const gp = styles['gap']; if (gp && gp !== '0px' && gp !== 'normal') alignParts.push(`gap:${gp}`);
      // M28-A: justify-items is used by grid with place-items:center (e.g. portrait-nav buttons)
      const ji = styles['justify-items']; if (ji && ji !== 'normal' && ji !== 'legacy') alignParts.push(`justify-items:${ji}`);
    }
    const as_ = styles && styles['align-self']; if (as_ && as_ !== 'auto' && as_ !== 'normal') alignParts.push(`align-self:${as_}`);
    const ws = styles && styles['white-space']; if (ws && ws !== 'normal') alignParts.push(`white-space:${ws}`);
    const to = styles && styles['text-overflow']; if (to && to !== 'clip') alignParts.push(`text-overflow:${to}`);
    const va = styles && styles['vertical-align']; if (va && va !== 'baseline') alignParts.push(`vertical-align:${va}`);
    // M30: object-fit / object-position for <img> elements
    const of_ = styles && styles['object-fit']; if (of_ && of_ !== 'fill') alignParts.push(`object-fit:${of_}`);
    const op_ = styles && styles['object-position']; if (op_ && op_ !== '50% 50%') alignParts.push(`object-position:${op_}`);
    // M31: overflow:hidden — propagate for visual clipping (circular portraits via border-radius:50%,
    // HP bars, SP bars, etc.). auto/scroll are mapped to hidden to avoid scrollbar artifacts.
    // Children use parent-relative coordinates from getBoundingClientRect so clipping is correct.
    const ovf = styles && styles['overflow'];
    if (ovf === 'hidden' || ovf === 'auto' || ovf === 'scroll') alignParts.push('overflow:hidden');
    const alignStyle = alignParts.length ? alignParts.join(';') + ';' : '';
    // M28-B: for leaf text nodes, prevent accidental word-wrap caused by sub-pixel
    // font-metric differences between source and preview rendering.
    // Only apply when: pure text leaf AND height ≤ 2×fontSize (single-line heuristic).
    // Multi-line text elements must NOT get nowrap or they would lose their wrap.
    const isLeafText = hasText && !(childrenOf.get(snap.id) || []).length;
    const fsPx = parseFloat(styles['font-size']) || 16; // e.g. "18px" → 18
    // M28-B: for leaf text nodes, prevent accidental word-wrap caused by sub-pixel
    // font-metric differences between source and preview rendering.
    // Only apply when: pure text leaf AND height ≤ 1.5×fontSize (single-line heuristic).
    // Multi-line text elements must NOT get nowrap or they would lose their wrap.
    const isSingleLine = isLeafText && h <= fsPx * 1.5;
    const leafNoWrap = isSingleLine ? 'white-space:nowrap;overflow:visible;' : '';
    const baseStyle = `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;box-sizing:border-box;${zIdx}${alignStyle}${leafNoWrap}`;

    const kids = (childrenOf.get(snap.id) || [])
      .map(renderNode)
      .join('');

    if (snap.tag === 'img' && styles._imgSrc) {
      const src = resolveUrl(styles._imgSrc);
      // M30: object-fit/position come from alignStyle (via alignParts). No hardcoded cover.
      return `<img${idAttr} src="${attrEscape(src)}" alt="${attrEscape(styles._imgAlt || '')}" style="${baseStyle}${css}" onerror="this.style.opacity=0">`;
    }
    if (snap.tag === 'svg' && styles._svgOuter) {
      // Skip descendants — SVG children render via outerHTML inline.
      return `<div${idAttr} style="${baseStyle}${css}">${styles._svgOuter}</div>`;
    }

    const text = hasText ? htmlEscape(pseudoText || inlineText) : '';
    return `<div${idAttr} style="${baseStyle}${css}">${text}${kids}</div>`;
  }

  const body = (childrenOf.get(0) || []).map(renderNode).join('\n');

  return `<!doctype html>
<html><head><meta charset="utf-8">
${extraHead}
<style>
  html,body { margin:0; padding:0; background:#0e1116; }
  body { width:${canvasW}px; height:${canvasH}px; position:relative; font-family: -apple-system, "Segoe UI", "Microsoft JhengHei", sans-serif; }
  img { display:block; }
</style></head><body>
${body}
</body></html>`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const opts = parseArgs();

  if (!opts.html || !opts.layout) usage();

  // Derive missing paths
  if (!opts.skin) {
    const candidate = opts.layout.replace(/\.json$/, '.skin.json');
    if (fs.existsSync(candidate)) opts.skin = candidate;
  }
  if (!opts.screenId) {
    opts.screenId = path.basename(opts.html, path.extname(opts.html));
  }
  if (!opts.output) {
    opts.output = path.join(
      path.dirname(opts.layout),
      `${opts.screenId}.compare.png`
    );
  }

  // Load data
  let layoutData, skinData;
  try {
    layoutData = JSON.parse(fs.readFileSync(path.resolve(opts.layout), 'utf8'));
  } catch (e) {
    console.error(`[dom-to-ui-compare] cannot read layout: ${opts.layout}\n${e.message}`);
    process.exit(1);
  }
  try {
    skinData = opts.skin ? JSON.parse(fs.readFileSync(path.resolve(opts.skin), 'utf8')) : { slots: {} };
  } catch (e) {
    console.error(`[dom-to-ui-compare] cannot read skin: ${opts.skin}\n${e.message}`);
    skinData = { slots: {} };
  }

  const tokenMap = loadTokenMap(opts.tokens);

  // Wireframe preview (always built; used as fallback or alongside high-fidelity).
  const wireframeHtml = generatePreviewHtml(layoutData, skinData, tokenMap, { wireframe: true });

  // High-fidelity preview is filled in *after* we capture computed styles below.
  let previewHtml = wireframeHtml;
  const previewPath = path.join(os.tmpdir(), `ucuf-preview-${opts.screenId}-${Date.now()}.html`);
  // First prepare source WITHOUT overrides — used for font audit only.
  const auditSourcePath = prepareSourceHtmlForCapture(opts.html, opts.screenId + '-audit');

  // Find browser
  const browserPath = opts.browser || findBrowser();

  // Launch puppeteer
  let puppeteer;
  try {
    puppeteer = require('puppeteer-core');
  } catch {
    console.error('[dom-to-ui-compare] puppeteer-core not found. Run: npm install');
    process.exit(1);
  }

  const CANVAS_W = (layoutData.canvas && layoutData.canvas.designWidth) || 1334;
  const CANVAS_H = (layoutData.canvas && layoutData.canvas.designHeight) || 750;
  // M27: auto-default combined output size from Cocos canvas constants
  if (opts.width <= 0) opts.width = CANVAS_W * 2;
  if (opts.height <= 0) opts.height = CANVAS_H;

  process.stdout.write('[dom-to-ui-compare] launching browser... ');
  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: true,
    // M26: --allow-file-access-from-files lets @font-face url("file:///...") work
    // when the HTML page is also loaded via file:// protocol.
    args: ['--no-sandbox', '--disable-gpu', '--disable-extensions', '--allow-file-access-from-files'],
  });

  const tmpLeft  = path.join(os.tmpdir(), `ucuf-left-${opts.screenId}-${Date.now()}.png`);
  const tmpRight = path.join(os.tmpdir(), `ucuf-right-${opts.screenId}-${Date.now()}.png`);

  let captureResult = null;
  let fontAudit = null;

  // ---- Pass 1: audit fonts on raw source (no overrides) ----
  try {
    const auditPage = await browser.newPage();
    await auditPage.setViewport({ width: CANVAS_W, height: CANVAS_H });
    await auditPage.goto(toFileUrl(auditSourcePath), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForPageSettle(auditPage, 5000);
    fontAudit = await auditFonts(auditPage);
    await auditPage.close();
    if (fontAudit.missingFamilies.length > 0) {
      process.stdout.write(`fonts missing=${fontAudit.missingFamilies.length} (${fontAudit.missingFamilies.slice(0, 3).join(', ')}${fontAudit.missingFamilies.length > 3 ? '…' : ''})... `);
    }
  } catch (e) {
    console.error(`\n[dom-to-ui-compare] font audit failed: ${e.message}`);
    fontAudit = { usedFamilies: [], missingFamilies: [], availableFamilies: [] };
  }

  // ---- Build extraHead (font override + broken-image hider) ----
  // M25-A: inject a zero-specificity baseline background so the HTML page renders
  // on the same dark bg as the UCUF preview (#0e1116). Any page-level body{background}
  // rule will win because :where() has specificity 0.
  const baselineBgStyle = `<style>:where(html),:where(body){background:#0e1116;}</style>`;
  // M26: inject real project @font-face (NotoSansTC/Manrope/Newsreader) via base64
  // data URIs into BOTH sides so text renders with actual typefaces.
  const projectRoot = path.resolve(__dirname, '..');
  const projectFontStyle = buildProjectFontFaces(projectRoot);
  if (projectFontStyle) {
    const injected = Array.from(PROJECT_FONT_FAMILIES).join(', ');
    process.stdout.write(`project-fonts-injected(${injected})... `);
  }
  // Only apply system-font fallback for fonts that are NOT covered by project fonts.
  const trulyMissing = fontAudit.missingFamilies.filter(f => !PROJECT_FONT_FAMILIES.has(f));
  const extraHead = baselineBgStyle + projectFontStyle
    + (trulyMissing.length > 0 ? buildFontOverrideStyle(trulyMissing) : '')
    + buildBrokenImageHiderScript();
  const preparedSourcePath = prepareSourceHtmlForCapture(opts.html, opts.screenId, extraHead);
  try { fs.unlinkSync(auditSourcePath); } catch {}

  try {
    // ---- Pass 2: capture + screenshot source HTML with overrides ----
    const htmlPage = await browser.newPage();
    await htmlPage.setViewport({ width: CANVAS_W, height: CANVAS_H });
    await htmlPage.goto(toFileUrl(preparedSourcePath), { waitUntil: 'networkidle0', timeout: 30000 });
    await waitForPageSettle(htmlPage, 10000);
    // M27: reset any .stage transform:scale so rects are native (viewport == design size)
    await htmlPage.evaluate(() => {
      const stage = document.querySelector('.stage,[data-stage]');
      if (!stage) return;
      const cs = window.getComputedStyle(stage);
      const t = cs.getPropertyValue('transform');
      if (t && t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)') {
        stage.style.transform = 'none';
        stage.style.transformOrigin = 'top left';
      }
    });
    // --pre-eval: run arbitrary JS before screenshot (e.g. click a tab button)
    if (opts.preEval) {
      try {
        await htmlPage.evaluate(opts.preEval);
        const settleMs = opts.settleMs != null ? opts.settleMs : 800;
        await new Promise(resolve => setTimeout(resolve, settleMs));
      } catch (e) {
        console.error(`\n[dom-to-ui-compare] --pre-eval failed: ${e.message}`);
      }
    }
    await htmlPage.screenshot({ path: tmpLeft });

    // M13/M19 — capture computed styles BEFORE closing the page.
    if (opts.renderMode === 'high-fidelity') {
      try {
        captureResult = await captureComputedStyles(htmlPage);
        process.stdout.write(`captured ${captureResult.snapshots.length} nodes (cov=${(captureResult.coverage.coveragePercent * 100).toFixed(1)}%)... `);
      } catch (e) {
        console.error(`\n[dom-to-ui-compare] capture failed: ${e.message}`);
      }
    }
    await htmlPage.close();
    process.stdout.write('HTML done... ');

    // Build the preview HTML now (high-fidelity if we have snapshots)
    if (captureResult && captureResult.snapshots && captureResult.snapshots.length > 0) {
      previewHtml = generateHighFidelityHtml(CANVAS_W, CANVAS_H, captureResult.snapshots, tokenMap, {
        sourceDir: path.dirname(path.resolve(opts.html)),
        extraHead,
      });
    }
    fs.writeFileSync(previewPath, previewHtml, 'utf8');
    if (opts.debugPreview) {
      const debugOut = opts.output.replace(/\.png$/i, '-preview-debug.html');
      fs.writeFileSync(debugOut, previewHtml, 'utf8');
      console.log(`\n[dom-to-ui-compare] debug preview saved: ${debugOut}`);
    }

    // Screenshot preview HTML
    const previewPage = await browser.newPage();
    await previewPage.setViewport({ width: CANVAS_W, height: CANVAS_H });
    await previewPage.goto(`file:///${previewPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0', timeout: 30000 });
    await waitForPageSettle(previewPage, 5000);  // M26: wait for fonts.ready before screenshot
    await previewPage.screenshot({ path: tmpRight });
    await previewPage.close();
    process.stdout.write('preview done... ');
  } finally {
    await browser.close();
  }

  // Combine into side-by-side PNG
  process.stdout.write('combining... ');
  const outputPngAbs = path.resolve(opts.output);
  combineImages(
    tmpLeft, tmpRight,
    outputPngAbs,
    opts.screenId,
    opts.width, opts.height,
    opts.labels,
    CANVAS_W, CANVAS_H
  );

  // Write sidecar metadata JSON
  const metaPath = outputPngAbs.replace(/\.png$/i, '-meta.json');
  const meta = {
    screenId: opts.screenId,
    generatedAt: new Date().toISOString(),
    htmlSource: path.resolve(opts.html),
    layoutSource: path.resolve(opts.layout),
    skinSource: opts.skin ? path.resolve(opts.skin) : null,
    outputPng: outputPngAbs,
    browserPath,
    totalWidth: opts.width,
    totalHeight: opts.height,
    labels: opts.labels,
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');

  // -----------------------------------------------------------------------
  // M13/M19 — Coverage sidecar
  // -----------------------------------------------------------------------
  const repoRoot = path.resolve(__dirname, '..');
  if (captureResult) {
    const coveragePath = outputPngAbs.replace(/\.png$/i, '.css-coverage.json');
    fs.writeFileSync(coveragePath, JSON.stringify(captureResult.coverage, null, 2), 'utf8');
    console.log(`[dom-to-ui-compare] coverage=${coveragePath}`);
    if (typeof opts.strictCoverage === 'number' && !Number.isNaN(opts.strictCoverage)
        && captureResult.coverage.coveragePercent < opts.strictCoverage) {
      console.error(`[dom-to-ui-compare] strict coverage fail: ${captureResult.coverage.coveragePercent} < ${opts.strictCoverage}`);
      process.exit(11);
    }
  }

  // -----------------------------------------------------------------------
  // M20 — Image waivers
  // -----------------------------------------------------------------------
  let waiverReport = null;
  if (captureResult && captureResult.snapshots) {
    waiverReport = buildWaivers({
      snapshots: captureResult.snapshots,
      repoRoot,
      sourceDir: path.dirname(path.resolve(opts.html)),
      screenId: opts.screenId,
    });
    const waiverPath = outputPngAbs.replace(/\.png$/i, '.image-waivers.json');
    fs.writeFileSync(waiverPath, JSON.stringify(waiverReport, null, 2), 'utf8');
    if (waiverReport.waivers.length > 0) {
      console.log(`[dom-to-ui-compare] waivers=${waiverReport.waivers.length} (${waiverPath})`);
    }
  }

  // -----------------------------------------------------------------------
  // M16 — Pixel diff harness
  // -----------------------------------------------------------------------
  let pixelDiffResult = null;
  if (opts.pixelDiff) {
    try {
      // We need the raw left/right PNGs; tmpLeft/tmpRight have already been removed below.
      // Run pixel-diff BEFORE the cleanup section.
      const waiverRects = waiverReport ? waiverRectsForPixelDiff(waiverReport) : [];
      pixelDiffResult = pixelDiff(tmpLeft, tmpRight, { tolerance: 12, waivers: waiverRects });
      const heatmapPath = outputPngAbs.replace(/\.png$/i, '.pixel-diff.heatmap.png');
      writeHeatmap(pixelDiffResult.heatmap, heatmapPath);
      const diffPath = outputPngAbs.replace(/\.png$/i, '.pixel-diff.json');
      fs.writeFileSync(diffPath, JSON.stringify({
        coveragePercent: pixelDiffResult.coveragePercent,
        adjustedCoverage: pixelDiffResult.adjustedCoverage,
        totalPixels: pixelDiffResult.totalPixels,
        matchedPixels: pixelDiffResult.matchedPixels,
        waiverPixels: pixelDiffResult.waiverPixels,
        width: pixelDiffResult.width,
        height: pixelDiffResult.height,
        heatmap: heatmapPath,
      }, null, 2), 'utf8');
      console.log(`[dom-to-ui-compare] pixel-diff coverage=${(pixelDiffResult.coveragePercent * 100).toFixed(1)}% (adj=${(pixelDiffResult.adjustedCoverage * 100).toFixed(1)}%) heatmap=${heatmapPath}`);
      if (typeof opts.strictPixel === 'number' && !Number.isNaN(opts.strictPixel)
          && pixelDiffResult.adjustedCoverage < opts.strictPixel) {
        console.error(`[dom-to-ui-compare] strict pixel fail: ${pixelDiffResult.adjustedCoverage} < ${opts.strictPixel}`);
        process.exit(12);
      }
    } catch (e) {
      console.error(`[dom-to-ui-compare] pixel-diff failed: ${e.message}`);
      if (typeof opts.strictPixel === 'number' && !Number.isNaN(opts.strictPixel)) process.exit(12);
    }
  }

  // -----------------------------------------------------------------------
  // M18 — Token suggestions
  // -----------------------------------------------------------------------
  if (captureResult && captureResult.snapshots) {
    try {
      const sug = buildTokenSuggestions({ snapshots: captureResult.snapshots, tokenMap });
      const sugPath = outputPngAbs.replace(/\.png$/i, '.token-suggestions.json');
      fs.writeFileSync(sugPath, JSON.stringify(sug, null, 2), 'utf8');
    } catch (e) {
      console.error(`[dom-to-ui-compare] token-suggestion failed: ${e.message}`);
    }
  }

  // -----------------------------------------------------------------------
  // M21 — Font audit sidecar
  // -----------------------------------------------------------------------
  if (fontAudit) {
    const fontPath = outputPngAbs.replace(/\.png$/i, '.font-audit.json');
    fs.writeFileSync(fontPath, JSON.stringify(fontAudit, null, 2), 'utf8');
    if (fontAudit.missingFamilies.length > 0) {
      console.log(`[dom-to-ui-compare] font-audit missing=${fontAudit.missingFamilies.length} (${fontPath})`);
    }
  }

  // -----------------------------------------------------------------------
  // M17 — Auto-feedback to evolution log
  // -----------------------------------------------------------------------
  if (opts.emitFeedback && captureResult) {
    try {
      const entries = buildFidelityEntries({
        screenId: opts.screenId,
        coverage: captureResult.coverage,
        pixelDiff: pixelDiffResult || {},
        sourcePath: path.resolve(opts.html),
        heatmapPath: pixelDiffResult ? outputPngAbs.replace(/\.png$/i, '.pixel-diff.heatmap.png') : null,
      });
      // Add font-related entries when fonts are missing.
      if (fontAudit && fontAudit.missingFamilies.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        const crypto = require('crypto');
        const hash = crypto.createHash('sha1').update(fontAudit.missingFamilies.join('|')).digest('hex').slice(0, 8);
        const id = `fidelity-gap-${opts.screenId}-fonts-missing-${hash}`;
        entries.push({
          id,
          body: `## Entry ${today} — ${id}

- suggestion id: \`${id}\`
- reviewer: (pending — auto-emitted by font-audit)
- before: source HTML 引用以下字型，但 headless Chrome 沒有載入：${fontAudit.missingFamilies.map(f => '`' + f + '`').join(', ')}
- after: 使用者選擇以下任一方式：
  1. **安裝原字型**（最佳方案）：把對應字型檔放進系統字型目錄，puppeteer 重啟後即可命中。
  2. **強制 fallback**：dom-to-ui-compare 已自動把缺失字型 alias 到 \`Microsoft JhengHei\`/\`Noto Sans CJK\` 等本機字型，確保 source 與 preview 落在同一字型 stack。
- reason: 字型缺失會造成 CJK 字距 sub-pixel drift，pixel-diff coverage 上不去；目前已自動同步 fallback。
- samples: \`${path.resolve(opts.html)}\`
- impact: pending — 若想要極致還原請選方案 1，否則 reviewer 確認方案 2 即可關閉
`,
        });
      }
      const result = appendEntries(entries);
      console.log(`[dom-to-ui-compare] feedback appended=${result.appended.length} skipped=${result.skipped.length}`);
    } catch (e) {
      console.error(`[dom-to-ui-compare] auto-feedback failed: ${e.message}`);
    }
  }

  // Clean up temp files
  if (opts.savePanels) {
    const sp = opts.savePanels;
    try { fs.mkdirSync(sp, { recursive: true }); } catch {}
    try { fs.copyFileSync(tmpLeft,  path.join(sp, 'panel-left.png')); } catch {}
    try { fs.copyFileSync(tmpRight, path.join(sp, 'panel-right.png')); } catch {}
    try { fs.copyFileSync(previewPath, path.join(sp, 'preview.html')); } catch {}
    console.log(`[dom-to-ui-compare] panels saved to ${sp}`);
  }
  try { fs.unlinkSync(tmpLeft); } catch {}
  try { fs.unlinkSync(tmpRight); } catch {}
  try { fs.unlinkSync(previewPath); } catch {}
  try { fs.unlinkSync(preparedSourcePath); } catch {}

  console.log(`\n[dom-to-ui-compare] ok output=${opts.output}`);
  console.log(`[dom-to-ui-compare] sidecar=${metaPath}`);
}

main().catch(err => {
  console.error(`[dom-to-ui-compare] fatal: ${err.message}`);
  process.exit(1);
});
