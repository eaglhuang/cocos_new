'use strict';
/**
 * update-md-references.js
 * 將所有 .md 文件中對其他 .md 文件的引用改為附帶 doc_id 標記
 * 格式: 數值系統.md (doc_spec_0025)
 *
 * Usage:
 *   node tools_node/update-md-references.js --dry-run   -- preview only
 *   node tools_node/update-md-references.js             -- apply changes
 */

const fs   = require('fs');
const path = require('path');

const ROOT     = path.resolve(__dirname, '..');
const REG_PATH = path.join(ROOT, 'docs', 'doc-id-registry.json');

// ──────────────────────────────────────────────
// Load registry — build maps for lookup
// ──────────────────────────────────────────────
function loadRegistry() {
  if (!fs.existsSync(REG_PATH)) {
    console.error('Registry not found. Run: node tools_node/doc-id-registry.js first.');
    process.exit(1);
  }
  const raw     = JSON.parse(fs.readFileSync(REG_PATH, 'utf8'));
  const entries = raw.registry || raw;
  const byBasename = {};
  const byRelPath  = {};
  const spaceFiles = []; // filenames that contain ASCII spaces
  for (const [docId, info] of Object.entries(entries)) {
    if (!info || typeof info !== 'object' || !info.path) continue;
    const rp = info.path.replace(/\\/g, '/');
    byRelPath[rp] = docId;
    const base = path.basename(rp);
    const baseLower = base.toLowerCase();
    if (!byBasename[baseLower]) byBasename[baseLower] = [];
    byBasename[baseLower].push({ docId, relPath: rp });
    if (base.includes(' ')) spaceFiles.push({ basename: base, docId });
  }
  // Sort spaceFiles longest-first to match longer names before shorter substrings
  spaceFiles.sort((a, b) => b.basename.length - a.basename.length);
  return { byBasename, byRelPath, spaceFiles };
}

// ──────────────────────────────────────────────
// Resolve a basename or relative path to a doc_id
// Returns null if not found, '[AMBIGUOUS]' string if multiple matches
// ──────────────────────────────────────────────
function resolveRef(refStr, sourceRelPath, registry) {
  let r = refStr.replace(/\\/g, '/').replace(/^\.\//, '');

  // 1. Direct byRelPath lookup - try resolving from source dir
  const sourceDir = path.dirname(sourceRelPath).replace(/\\/g, '/');
  if (!r.startsWith('/') && !r.match(/^[a-z]:/i)) {
    const candidate = path.posix.normalize(`${sourceDir}/${r}`);
    if (registry.byRelPath[candidate]) return registry.byRelPath[candidate];
  }
  if (registry.byRelPath[r]) return registry.byRelPath[r];

  // 2. Fallback: basename lookup
  const base = path.basename(r).toLowerCase();
  const matches = registry.byBasename[base] || [];
  if (matches.length === 1) return matches[0].docId;
  if (matches.length > 1) return null; // ambiguous — skip to avoid wrong annotation
  return null;
}

// ──────────────────────────────────────────────
// Check if a reference is ALREADY annotated with doc_id
// Checks if (doc_xxx_NNNN) immediately follows the ref in the line segment
// ──────────────────────────────────────────────
function isAlreadyAnnotated(lineAfterRef) {
  // Allow optional space/backtick between ref end and the annotation
  return /^\s*\(doc_[a-z]+_\d{4}\)/.test(lineAfterRef);
}

// ──────────────────────────────────────────────
// Process a single line: find all .md references and annotate them
// Returns the modified line (or original if no changes)
// ──────────────────────────────────────────────
function processLine(line, sourceRelPath, registry) {
  // Skip the doc_id declaration line itself
  if (/^<!--\s*doc_id:/.test(line.trim()) || /^\s*doc_id:\s*doc_/.test(line)) return line;

  let result = line;
  let offset = 0; // tracks how much we've inserted so far

  // Collect all spans to annotate FIRST, then apply in reverse order
  // (to avoid messing up indices when inserting)
  const annotations = []; // { insertPos, docId }

  // ─── Pattern A: Markdown links  [text](path.md) ───
  // We'll annotate AFTER the closing paren
  const linkRe = /\[([^\]]*)\]\(([^)#\s)]+\.md(?:#[^)]*)?)\)/g;
  let m;
  while ((m = linkRe.exec(line)) !== null) {
    const href = m[2].replace(/#.*$/, '');
    if (href.startsWith('http')) continue;
    const endPos = m.index + m[0].length;
    const afterRef = line.slice(endPos);
    if (isAlreadyAnnotated(afterRef)) continue;
    const docId = resolveRef(href, sourceRelPath, registry);
    if (!docId || docId.startsWith('[')) continue;
    annotations.push({ insertPos: endPos, text: ` (${docId})` });
  }

  // ─── Pattern B: Backtick path  `path.md`  ───
  // Annotate AFTER the closing backtick
  const btRe = /`([^`\n]+\.md)`/g;
  while ((m = btRe.exec(line)) !== null) {
    const p = m[1];
    if (p.startsWith('http')) continue;
    // Check link re not already covered
    const endPos = m.index + m[0].length;
    const afterRef = line.slice(endPos);
    if (isAlreadyAnnotated(afterRef)) continue;
    // Skip if this position is already going to be annotated
    if (annotations.some(a => a.insertPos === endPos)) continue;
    const docId = resolveRef(p, sourceRelPath, registry);
    if (!docId || docId.startsWith('[')) continue;
    annotations.push({ insertPos: endPos, text: ` (${docId})` });
  }

  // ─── Pattern C: Bare filename  Token.md ───
  // Matches .md tokens not preceded by ` ( [ or followed by (doc_  
  // and not inside a markdown link (href position)
  const bareRe = /(?<![`([\\/])([^\s`()\[\]|、，,;；：:*#!@]+\.md)(?!`\)|\/)/g;
  while ((m = bareRe.exec(line)) !== null) {
    const p = m[1];
    if (p.startsWith('http')) continue;
    const startPos = m.index + m[0].indexOf(p);
    const endPos = m.index + m[0].length;
    const afterRef = line.slice(endPos);
    if (isAlreadyAnnotated(afterRef)) continue;
    // Skip if this is inside a markdown link href (already handled by Pattern A)
    // Simple heuristic: check for ( immediately before
    const before = line.slice(0, m.index);
    if (before.endsWith('(')) continue; // already handled by pattern A
    // Skip if this is inside backticks (handled by pattern B)
    const beforeChar = before.length > 0 ? before[before.length - 1] : '';
    if (beforeChar === '`') continue;
    if (annotations.some(a => a.insertPos === endPos)) continue;
    const docId = resolveRef(p, sourceRelPath, registry);
    if (!docId || docId.startsWith('[')) continue;
    annotations.push({ insertPos: endPos, text: ` (${docId})` });
  }

  // ─── Pattern D: Filenames with spaces (exact string search) ───
  for (const sf of (registry.spaceFiles || [])) {
    // Escape the basename for literal string search in a regex
    const escaped = sf.basename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sfRe = new RegExp(escaped + '(?!\\s*\\(doc_)', 'g');
    while ((m = sfRe.exec(line)) !== null) {
      const endPos = m.index + m[0].length;
      // Skip if inside backtick or markdown link (chars before the match)
      const before = line.slice(0, m.index);
      const lastChar = before.length > 0 ? before[before.length - 1] : '';
      if (lastChar === '`' || lastChar === '(') continue;
      if (annotations.some(a => a.insertPos === endPos)) continue;
      annotations.push({ insertPos: endPos, text: ` (${sf.docId})` });
    }
  }

  if (annotations.length === 0) return line;

  // Apply annotations in REVERSE order (to preserve earlier positions)
  annotations.sort((a, b) => b.insertPos - a.insertPos);
  for (const ann of annotations) {
    result = result.slice(0, ann.insertPos) + ann.text + result.slice(ann.insertPos);
  }
  return result;
}

// ──────────────────────────────────────────────
// Scan all .md files
// ──────────────────────────────────────────────
function scanFiles() {
  const SKIP = new Set(['node_modules', 'library', 'temp', '.git']);
  const files = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.name.endsWith('.md')) files.push(full);
    }
  }
  walk(ROOT);
  return files;
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────
function main() {
  const DRY_RUN = process.argv.includes('--dry-run');
  const registry = loadRegistry();
  const allFiles = scanFiles();

  let filesChanged = 0;
  let linesChanged = 0;
  let annotationsAdded = 0;
  const changedFiles = [];

  for (const fullPath of allFiles) {
    const relPath = path.relative(ROOT, fullPath).replace(/\\/g, '/');
    let content;
    try { content = fs.readFileSync(fullPath, 'utf8'); }
    catch (e) { console.error(`Read error: ${relPath}: ${e.message}`); continue; }

    const lines = content.split('\n');
    const newLines = lines.map(line => processLine(line, relPath, registry));

    let changed = false;
    let fileAnnotations = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] !== newLines[i]) {
        changed = true;
        linesChanged++;
        // Count how many (doc_xxx_nnnn) annotations were added
        const orig = (lines[i].match(/\(doc_[a-z]+_\d{4}\)/g) || []).length;
        const next = (newLines[i].match(/\(doc_[a-z]+_\d{4}\)/g) || []).length;
        fileAnnotations += Math.max(0, next - orig);
      }
    }

    if (changed) {
      filesChanged++;
      annotationsAdded += fileAnnotations;
      changedFiles.push(relPath);
      if (!DRY_RUN) {
        // Preserve no BOM — write as UTF-8 without BOM
        const newContent = newLines.join('\n');
        fs.writeFileSync(fullPath, newContent, 'utf8');
      }
    }
  }

  // Write change list
  const reportPath = path.join(ROOT, 'temp_ref_update_changed.txt');
  fs.writeFileSync(reportPath, changedFiles.join('\n'), 'utf8');

  const modeLabel = DRY_RUN ? '[DRY RUN]' : '[APPLIED]';
  console.log(`${modeLabel} Files changed: ${filesChanged}`);
  console.log(`${modeLabel} Lines changed: ${linesChanged}`);
  console.log(`${modeLabel} Annotations added: ${annotationsAdded}`);
  console.log(`Change list: temp_ref_update_changed.txt`);
  if (DRY_RUN) console.log('Re-run without --dry-run to apply changes.');
}

main();
