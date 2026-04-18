'use strict';
/**
 * audit-md-references.js
 * 掃描所有 .md 文件中對其他 .md 文件的引用，
 * 檢查每個引用是否已附有 doc_id，並輸出審計報告。
 *
 * Usage:
 *   node tools_node/audit-md-references.js            -- full report
 *   node tools_node/audit-md-references.js --missing  -- only show missing doc_id refs
 */

const fs   = require('fs');
const path = require('path');

const ROOT     = path.resolve(__dirname, '..');
const REG_PATH = path.join(ROOT, 'docs', 'doc-id-registry.json');

// ──────────────────────────────────────────────
// Load registry — build basename → [entries] map
// ──────────────────────────────────────────────
function loadRegistry() {
  if (!fs.existsSync(REG_PATH)) {
    console.error('Registry not found. Run: node tools_node/doc-id-registry.js first.');
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(REG_PATH, 'utf8'));
  const entries = raw.registry || raw; // handle both { registry: {} } and flat format
  const byBasename = {};
  const byRelPath  = {};
  for (const [docId, info] of Object.entries(entries)) {
    if (!info || typeof info !== 'object' || !info.path) continue; // skip non-entry keys
    const rp = info.path.replace(/\\/g, '/');
    byRelPath[rp] = docId;
    const base = path.basename(rp).toLowerCase();
    if (!byBasename[base]) byBasename[base] = [];
    byBasename[base].push({ docId, relPath: rp });
  }
  return { raw: entries, byBasename, byRelPath };
}

// ──────────────────────────────────────────────
// Resolve a reference string to a doc_id
// Returns null if not found or ambiguous
// ──────────────────────────────────────────────
function resolveRef(refStr, sourceRelPath, registry) {
  // Normalise to forward slash, strip leading ./
  let r = refStr.replace(/\\/g, '/').replace(/^\.\//, '');

  // 1. Try direct relative path resolution from source file directory
  const sourceDir  = path.dirname(sourceRelPath).replace(/\\/g, '/');
  const candidates = [];

  // Build candidate full relative paths
  if (!r.startsWith('docs/') && !r.startsWith('.github/') && !r.startsWith('.agents/')) {
    // Relative reference – resolve from source dir
    const resolved = path.posix.normalize(`${sourceDir}/${r}`);
    candidates.push(resolved);
  } else {
    candidates.push(r);
  }

  // 2. Try direct byRelPath lookup
  for (const c of candidates) {
    if (registry.byRelPath[c]) return registry.byRelPath[c];
  }

  // 3. Fallback: basename lookup (ambiguous if multiple matches)
  const base = path.basename(r).toLowerCase();
  const matches = registry.byBasename[base] || [];
  if (matches.length === 1) return matches[0].docId;
  if (matches.length > 1) return `[AMBIGUOUS: ${matches.map(m => m.docId).join(', ')}]`;
  return null;
}

// ──────────────────────────────────────────────
// Extract .md references from a line of text
// Returns array of { raw, type }
// ──────────────────────────────────────────────
function extractRefs(line) {
  const refs = [];

  // Type A: markdown link  [text](path.md) or [text](path.md#section)
  // Exclude http/https links
  const linkRe = /\[([^\]]*)\]\(([^)#\s]+\.md(?:#[^)]*)?)\)/g;
  let m;
  while ((m = linkRe.exec(line)) !== null) {
    const href = m[2].replace(/#.*$/, '');
    if (!href.startsWith('http')) refs.push({ raw: href, type: 'link' });
  }

  // Type B: backtick path  `docs/xxx.md`  or  `path.md`
  const btRe = /`([^`\n]+\.md)`/g;
  while ((m = btRe.exec(line)) !== null) {
    const p = m[1];
    if (!p.startsWith('http')) refs.push({ raw: p, type: 'backtick' });
  }

  // Type C: bare table cell or text token that is FilenameWithExtension.md
  //  — only match if the token is at least 3 chars before .md, not preceded by ` or (
  const bareRe = /(?<![`(/\\])([^\s`()\[\]|、，,;：:]+\.md)(?![`)\]])/g;
  while ((m = bareRe.exec(line)) !== null) {
    const p = m[1];
    if (!p.startsWith('http') && !refs.some(r => r.raw === p)) {
      refs.push({ raw: p, type: 'bare' });
    }
  }

  return refs;
}

// ──────────────────────────────────────────────
// Check if a ref ALREADY has a doc_id annotation nearby
// (in the same cell/line segment)
// ──────────────────────────────────────────────
function alreadyAnnotated(line, refRaw) {
  // Look for doc_id pattern anywhere on same line
  return /doc_[a-z]+_\d{4}/.test(line);
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
  const MISSING_ONLY = process.argv.includes('--missing');
  const OUT_FILE     = process.argv.includes('--out')
    ? process.argv[process.argv.indexOf('--out') + 1]
    : null;
  const log = (...args) => { const s = args.join(' '); process.stdout.write(s + '\n'); };

  const registry = loadRegistry();
  const allFiles = scanFiles();

  log(`Scanning ${allFiles.length} .md files for cross-references...`);

  let totalRefs   = 0;
  let annotated   = 0;
  let missing     = 0;
  let unresolved  = 0;
  let selfRef     = 0;

  const missingItems = []; // { file, line, lineNo, ref, resolvedId }

  for (const fullPath of allFiles) {
    const relPath = path.relative(ROOT, fullPath).replace(/\\/g, '/');
    let content;
    try { content = fs.readFileSync(fullPath, 'utf8'); }
    catch { continue; }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip the doc_id injection line itself
      if (/^<!--\s*doc_id:/.test(line) || /^\s*doc_id:\s*doc_/.test(line)) continue;

      const refs = extractRefs(line);
      for (const ref of refs) {
        // Skip self-references
        const base = path.basename(ref.raw);
        if (base === path.basename(relPath)) { selfRef++; continue; }

        totalRefs++;
        const resolvedId = resolveRef(ref.raw, relPath, registry);
        const hasAnnot = alreadyAnnotated(line, ref.raw);

        if (resolvedId === null) {
          unresolved++;
          if (!MISSING_ONLY) {
            // Skip reporting unresolved quietly
          }
        } else if (hasAnnot) {
          annotated++;
        } else {
          missing++;
          missingItems.push({
            file: relPath,
            lineNo: i + 1,
            line: line.trim().slice(0, 100),
            ref: ref.raw,
            type: ref.type,
            resolvedId: resolvedId.startsWith('[AMBIGUOUS') ? resolvedId : resolvedId,
          });
        }
      }
    }
  }

  // ─── Report ───
  console.log('📊 Audit Summary:');
  const out = [];
  out.push(`Total .md refs found  : ${totalRefs}`);
  out.push(`Already annotated     : ${annotated}  (${pct(annotated, totalRefs)}%)`);
  out.push(`Missing doc_id        : ${missing}   (${pct(missing, totalRefs)}%)`);
  out.push(`Unresolvable refs     : ${unresolved}`);
  out.push(`Self-refs (skipped)   : ${selfRef}`);
  out.push('');

  if (missing === 0) {
    out.push('ALL resolvable references already have doc_id annotation!');
  } else {
    // Group by file
    const byFile = {};
    for (const item of missingItems) {
      if (!byFile[item.file]) byFile[item.file] = [];
      byFile[item.file].push(item);
    }

    out.push(`${missing} references missing doc_id (grouped by file):`);
    out.push('');
    for (const [file, items] of Object.entries(byFile)) {
      out.push(`FILE: ${file} (${items.length} refs)`);
      for (const it of items) {
        out.push(`  L${it.lineNo} [${it.type}] "${it.ref}" -> ${it.resolvedId}`);
      }
    }
  }

  const outPath = path.join(ROOT, 'temp_audit_refs.txt');
  fs.writeFileSync(outPath, out.join('\n'), 'utf8');
  console.log(`Audit complete. Results written to temp_audit_refs.txt`);
  console.log(`Summary: ${totalRefs} refs, ${annotated} annotated, ${missing} missing, ${unresolved} unresolvable`);
}

function pct(n, total) {
  if (total === 0) return '0';
  return Math.round(n / total * 100);
}

main();
