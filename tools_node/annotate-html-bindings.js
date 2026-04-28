#!/usr/bin/env node
// doc_id: doc_other_0009 — Annotate HTML with UCUF Bindings (M32)
//
// Purpose:
//   Read a Design System / handoff HTML file and reverse-annotate it with
//   `data-ucuf-id`, `data-contract`, `data-slot`, `data-ucuf-action` so the
//   downstream `dom-to-ui-json.js` pass produces layouts with semantic
//   bindings rather than pure visual structure.
//
// Strategy: rule-based pattern matching. NO LLM. The rule set is built from:
//   1. Element text patterns (Chinese姓名 → general.name, 數字 + 屬性詞 → stat.path)
//   2. data-tab / data-page attributes already present
//   3. button labels (close / confirm / cancel / share)
//   4. Optional --content-contract <path> reading <screen>.contentRequirements
//      to add additional declared fields.
//
// Usage:
//   node tools_node/annotate-html-bindings.js \
//     --html "Design System 2/ui_kits/character/index.html" \
//     --screen-id character-ds3-main \
//     [--apply] [--report <json>] [--content-contract <screen.json>]
//
// Output:
//   - Without --apply: prints unified-diff style preview to stdout
//   - With --apply:    writes annotated HTML back to source path (or --out)
//   - With --report:   writes a JSON report of all annotations applied

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const opts = { html: null, screenId: null, apply: false, report: null, out: null, contentContract: null };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--html': opts.html = next(); break;
      case '--screen-id': opts.screenId = next(); break;
      case '--apply': opts.apply = true; break;
      case '--report': opts.report = next(); break;
      case '--out': opts.out = next(); break;
      case '--content-contract': opts.contentContract = next(); break;
      case '--help':
      case '-h':
        console.log('Usage: annotate-html-bindings.js --html <file> --screen-id <id> [--apply] [--out <file>] [--report <json>]');
        process.exit(0);
        break;
      default:
        console.error(`[annotate-html-bindings] unknown arg: ${a}`); process.exit(2);
    }
  }
  if (!opts.html || !opts.screenId) {
    console.error('[annotate-html-bindings] --html and --screen-id are required');
    process.exit(2);
  }
  return opts;
}

// Extremely light HTML "tokenizer" — finds opening tags so we can inject
// attributes without a full DOM parser. We only edit attribute-free or
// already-attribute opening tags; skips comments / scripts / cdata.
function annotate(html, opts) {
  const annotations = []; // { line, col, tagName, addedAttrs, snippet }
  const seenUcufIds = new Map();

  // Skip <script>, <style>, <pre>, <textarea> bodies
  const skipBody = new Set(['script', 'style', 'pre', 'textarea']);

  // Statefully walk through the document
  let out = '';
  let i = 0;
  while (i < html.length) {
    const ch = html[i];
    if (ch !== '<') { out += ch; i++; continue; }

    // Comment / cdata / doctype: copy verbatim
    if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i + 4);
      const stop = end < 0 ? html.length : end + 3;
      out += html.slice(i, stop); i = stop; continue;
    }
    if (html.startsWith('<![CDATA[', i)) {
      const end = html.indexOf(']]>', i + 9);
      const stop = end < 0 ? html.length : end + 3;
      out += html.slice(i, stop); i = stop; continue;
    }
    if (html.startsWith('<!', i)) {
      const end = html.indexOf('>', i + 2);
      const stop = end < 0 ? html.length : end + 1;
      out += html.slice(i, stop); i = stop; continue;
    }

    // Closing tag
    if (html[i + 1] === '/') {
      const end = html.indexOf('>', i + 2);
      const stop = end < 0 ? html.length : end + 1;
      out += html.slice(i, stop); i = stop; continue;
    }

    // Opening tag
    const tagEnd = findTagEnd(html, i);
    if (tagEnd < 0) { out += html.slice(i); break; }
    const rawTag = html.slice(i, tagEnd + 1);
    const tagMatch = rawTag.match(/^<([a-zA-Z][a-zA-Z0-9-]*)\b/);
    if (!tagMatch) { out += rawTag; i = tagEnd + 1; continue; }
    const tagName = tagMatch[1].toLowerCase();

    // Find inner text between this open tag and matching close tag (shallow, single-line ok)
    const closeTag = `</${tagName}`;
    const closeIdx = findShallowClose(html, tagEnd + 1, tagName);
    const innerText = closeIdx > 0 ? extractTextOnly(html.slice(tagEnd + 1, closeIdx)) : '';

    // Build candidate annotations
    const adds = inferAnnotations(tagName, rawTag, innerText, opts);
    if (adds['data-ucuf-id']) {
      adds['data-ucuf-id'] = uniquifyUcufId(adds['data-ucuf-id'], seenUcufIds);
    }
    if (Object.keys(adds).length > 0) {
      const newTag = injectAttributes(rawTag, adds);
      annotations.push({ tagName, innerTextSample: innerText.slice(0, 40), addedAttrs: adds });
      out += newTag;
    } else {
      out += rawTag;
    }
    i = tagEnd + 1;

    // Skip body of script/style/etc.
    if (skipBody.has(tagName) && closeIdx > tagEnd) {
      out += html.slice(tagEnd + 1, closeIdx);
      i = closeIdx;
    }
  }
  return { html: out, annotations };
}

function uniquifyUcufId(value, seenMap) {
  const base = String(value || '').trim();
  if (!base) return base;
  const count = seenMap.get(base) || 0;
  seenMap.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

function findTagEnd(html, start) {
  let inAttr = false;
  let quote = '';
  for (let j = start; j < html.length; j++) {
    const c = html[j];
    if (inAttr) {
      if (c === quote) inAttr = false;
      continue;
    }
    if (c === '"' || c === "'") { inAttr = true; quote = c; continue; }
    if (c === '>') return j;
  }
  return -1;
}

function findShallowClose(html, fromIdx, tagName) {
  // Shallow-only: find next `</tagName` after fromIdx. Good enough for inferring
  // inner text of leaf nodes; for nested same-tag containers we just get the
  // first close, which biases toward leaf-text — acceptable for annotation.
  const re = new RegExp('</\\s*' + tagName + '\\b', 'i');
  const sub = html.slice(fromIdx);
  const m = sub.match(re);
  return m ? fromIdx + m.index : -1;
}

function extractTextOnly(htmlFragment) {
  // Strip nested tags, decode minimal entities, collapse whitespace.
  const noTags = htmlFragment.replace(/<[^>]*>/g, ' ');
  const decoded = noTags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  return decoded.replace(/\s+/g, ' ').trim();
}

function injectAttributes(rawTag, adds) {
  // Insert attrs just before the closing `>` (or `/>` for self-close).
  const selfClose = /\/\s*>$/.test(rawTag);
  const closeLen = selfClose ? rawTag.match(/\/\s*>$/)[0].length : 1;
  const head = rawTag.slice(0, rawTag.length - closeLen).replace(/\s+$/, '');
  const tail = rawTag.slice(rawTag.length - closeLen);

  // If the tag already has any of the keys, skip those (idempotent).
  const existingAttrs = new Set();
  const attrRe = /(\w[\w-]*)=/g;
  let m;
  while ((m = attrRe.exec(rawTag)) != null) existingAttrs.add(m[1].toLowerCase());

  const additions = [];
  for (const [key, value] of Object.entries(adds)) {
    if (existingAttrs.has(key.toLowerCase())) continue;
    additions.push(`${key}="${escapeAttr(value)}"`);
  }
  if (additions.length === 0) return rawTag;
  return `${head} ${additions.join(' ')}${selfClose ? ' /' : ''}>`;
}

function escapeAttr(v) {
  return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

// Rules — central place to extend. Returns an object of attrs to add.
function inferAnnotations(tagName, rawTag, innerText, opts) {
  const out = {};
  const cls = (rawTag.match(/class\s*=\s*"([^"]*)"/i) || [])[1] || '';
  const id = (rawTag.match(/\bid\s*=\s*"([^"]*)"/i) || [])[1] || '';
  const dataTab = (rawTag.match(/\bdata-tab\s*=\s*"([^"]*)"/i) || [])[1] || '';
  const dataPage = (rawTag.match(/\bdata-page\s*=\s*"([^"]*)"/i) || [])[1] || '';
  const onclick = readAttr(rawTag, 'onclick');
  const isInteractive = tagName === 'button' || /\b(btn|button|nav-arrow|pool-dot|history-close|history-btn|pull-btn)\b/i.test(cls) || !!onclick || /role\s*=\s*"button"/i.test(rawTag);

  // Rule 1: tab buttons / containers
  if (dataTab) {
    out['data-slot'] = `tab.${dataTab}`;
    if (tagName === 'button' || /tab-(button|btn)/.test(cls)) out['data-ucuf-action'] = `tab.switch:${dataTab}`;
  }
  if (dataPage) out['data-slot'] = out['data-slot'] || `page.${dataPage}`;

  // Rule 2: buttons with action-y text or class
  if (isInteractive) {
    const t = innerText;
    if (/openHistory\s*\(/i.test(onclick) || /btn-history/i.test(cls) || /歷史記錄/.test(t)) {
      out['data-ucuf-action'] = out['data-ucuf-action'] || 'openPanel';
      out['data-target'] = out['data-target'] || 'historyModal';
    }
    else if (/closeHistory\s*\(/i.test(onclick) || /history-close|modal-close|\bclose\b/i.test(cls) || /^(關閉|×|✕)$/.test(t)) {
      out['data-ucuf-action'] = out['data-ucuf-action'] || 'closeModal';
      out['data-target'] = out['data-target'] || 'historyModal';
    }
    else if (/navigate\s*\(\s*-1\s*\)/i.test(onclick) || /\bprev\b/i.test(cls) || t.includes('‹')) {
      out['data-ucuf-action'] = out['data-ucuf-action'] || 'tabSwitch';
      out['data-target'] = out['data-target'] || 'pool.prev';
    }
    else if (/navigate\s*\(\s*1\s*\)/i.test(onclick) || /\bnext\b/i.test(cls) || t.includes('›')) {
      out['data-ucuf-action'] = out['data-ucuf-action'] || 'tabSwitch';
      out['data-target'] = out['data-target'] || 'pool.next';
    }
    else if (/^(關閉|×|✕)$/.test(t) || /\bclose\b/i.test(cls)) out['data-ucuf-action'] = out['data-ucuf-action'] || 'close';
    else if (/^(確認|確定|送出)$/.test(t)) out['data-ucuf-action'] = out['data-ucuf-action'] || 'confirm';
    else if (/^(取消)$/.test(t)) out['data-ucuf-action'] = out['data-ucuf-action'] || 'cancel';
    else if (/^(分享)$/.test(t)) out['data-ucuf-action'] = out['data-ucuf-action'] || 'share';
  }

  // Rule 3: name labels (Chinese 2-3 chars, often a general's name)
  if (/general-name|hero-name|character-name/.test(cls)) {
    out['data-contract'] = out['data-contract'] || 'general.name';
  }

  // Rule 4: stat values — number near keyword
  if (/stat-value|attr-value|attribute-value/.test(cls)) {
    out['data-contract'] = out['data-contract'] || 'general.stat.value';
  }
  if (/stat-name|attr-name|attribute-name/.test(cls)) {
    out['data-contract'] = out['data-contract'] || 'general.stat.label';
  }

  // Rule 5: sections by class-as-slot
  const zonePatterns = [
    [/portrait|hero-portrait|character-portrait/i, 'portrait'],
    [/header|top-bar|topbar/i, 'header'],
    [/footer|bottom-bar/i, 'footer'],
    [/tab-bar|tabs/i, 'tabBar'],
    [/skill-list|skills-list/i, 'skillList'],
    [/bloodline/i, 'bloodline'],
  ];
  for (const [re, zone] of zonePatterns) {
    if (re.test(cls) || re.test(id)) {
      out['data-visual-zone'] = out['data-visual-zone'] || zone;
      break;
    }
  }

  // Rule 6: inject data-ucuf-id when we found *any* annotation, derived from
  // class first non-modifier or id; ensures downstream stable identity.
  if (Object.keys(out).length > 0 && !out['data-ucuf-id']) {
    const idHint = id || (cls.split(/\s+/)[0] || '');
    if (idHint) out['data-ucuf-id'] = `${opts.screenId}.${idHint}`;
  }

  return out;
}

function readAttr(rawTag, attrName) {
  const pattern = new RegExp(`\\b${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i');
  const match = rawTag.match(pattern);
  return match ? (match[1] || match[2] || '') : '';
}

function diffSummary(before, after) {
  const a = before.split(/\r?\n/);
  const b = after.split(/\r?\n/);
  const lines = Math.max(a.length, b.length);
  const changed = [];
  for (let i = 0; i < lines; i++) {
    if (a[i] !== b[i]) changed.push({ line: i + 1, before: a[i] || '', after: b[i] || '' });
  }
  return changed;
}

function main() {
  const opts = parseArgs(process.argv);
  const htmlPath = path.resolve(opts.html);
  if (!fs.existsSync(htmlPath)) {
    console.error(`[annotate-html-bindings] HTML not found: ${htmlPath}`); process.exit(2);
  }
  const before = fs.readFileSync(htmlPath, 'utf8');
  const result = annotate(before, opts);

  if (opts.report) {
    fs.mkdirSync(path.dirname(path.resolve(opts.report)), { recursive: true });
    fs.writeFileSync(opts.report, JSON.stringify({
      html: path.relative(ROOT, htmlPath).replace(/\\/g, '/'),
      screenId: opts.screenId,
      annotationCount: result.annotations.length,
      annotations: result.annotations,
    }, null, 2), 'utf8');
    console.log(`[annotate-html-bindings] report → ${path.relative(ROOT, opts.report)}`);
  }

  if (opts.apply) {
    const outPath = opts.out ? path.resolve(opts.out) : htmlPath;
    fs.writeFileSync(outPath, result.html, 'utf8');
    console.log(`[annotate-html-bindings] wrote ${path.relative(ROOT, outPath)}; ${result.annotations.length} annotations`);
  } else {
    const diffs = diffSummary(before, result.html);
    console.log(`[annotate-html-bindings] dry-run: ${result.annotations.length} annotations across ${diffs.length} changed lines`);
    for (const d of diffs.slice(0, 10)) {
      console.log(`  L${d.line}:`);
      console.log(`    - ${d.before.trim().slice(0, 200)}`);
      console.log(`    + ${d.after.trim().slice(0, 200)}`);
    }
    if (diffs.length > 10) console.log(`  ... +${diffs.length - 10} more`);
  }
}

if (require.main === module) main();
module.exports = { annotate, inferAnnotations };
