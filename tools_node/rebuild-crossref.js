'use strict';
/**
 * rebuild-crossref.js — Cross-Reference shard maintenance tool
 *
 * Usage:
 *   node tools_node/rebuild-crossref.js --compress <file>
 *       Compress "中文名.md (doc_id)" → "doc_id" in a shard file
 *   node tools_node/rebuild-crossref.js --strip-code <file>
 *       Remove .ts/.tsx/.js and tools_node|artifacts paths from spec dependency columns
 *   node tools_node/rebuild-crossref.js --prune <file> <heading-prefix>
 *       Remove everything from "### <heading-prefix>" to end of file
 *   node tools_node/rebuild-crossref.js --validate [file]
 *       Check all doc_ids in shard files exist in registry
 *   node tools_node/rebuild-crossref.js --rebuild-progress
 *       Scan assets/scripts/**\/*.ts, compare with B-1, write progress report
 *
 * Flags can be combined:
 *   node tools_node/rebuild-crossref.js --compress docs/cross-ref/cross-ref-specs.md --strip-code docs/cross-ref/cross-ref-specs.md
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ── CLI helpers ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function hasFlag(f) { return argv.includes(f); }
function flagVal(f) {
  const i = argv.indexOf(f);
  return (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[i + 1] : null;
}
// next positional after flag (supports two-word flag like --prune <file> <heading>)
function flagVal2(f) {
  const i = argv.indexOf(f);
  return (i >= 0 && argv[i + 2] && !argv[i + 2].startsWith('--')) ? argv[i + 2] : null;
}

// ── Registry loader ──────────────────────────────────────────────────────────
function loadRegistry() {
  const regPath = path.join(ROOT, 'docs', 'doc-id-registry.json');
  if (!fs.existsSync(regPath)) {
    console.error('[ERROR] doc-id-registry.json not found at', regPath);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(regPath, 'utf8'));
  // Support both flat and nested (raw.registry) formats
  const entries = raw.registry || raw;
  const byDocId = {};
  const byBasename = {};
  for (const [docId, info] of Object.entries(entries)) {
    if (!info || typeof info !== 'object' || !info.path) continue;
    byDocId[docId] = info;
    const base = path.basename(String(info.path));
    if (!byBasename[base]) byBasename[base] = [];
    byBasename[base].push(docId);
  }
  return { byDocId, byBasename };
}

// ── Compression: 中文名.md (doc_xxx_nnnn) → doc_xxx_nnnn ────────────────────
function compressDocRefs(content, registry) {
  // Build unique basename/stem maps from registry
  const basenameEntries = Object.entries(registry.byBasename || {})
    .filter(([, ids]) => Array.isArray(ids) && ids.length === 1)
    .map(([name, ids]) => ({ name, stem: name.replace(/\.md$/i, ''), id: ids[0] }))
    .sort((a, b) => b.name.length - a.name.length);

  const lines = content.split('\n');
  const out = lines.map((line) => {
    // Safety: only compress table rows to avoid damaging markdown links/header prose
    if (!line.startsWith('|')) return line;

    let row = line;

    // 1) Collapse explicit "<name>.md (doc_xxx)" to "doc_xxx"
    row = row.replace(/[^|、，,()（）\n]*?\.md\s*\((doc_[a-z]+_\d{4})\)/g, '$1');

    // 2) Replace unique basenames and stems in table cells
    for (const entry of basenameEntries) {
      const escapedName = entry.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedStem = entry.stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Exact basename
      row = row.replace(new RegExp(escapedName + '(?!\\s*\\(doc_[a-z]+_\\d{4}\\))', 'g'), entry.id);
      // Bare stem token (e.g., "數值系統" / "UI技術規格書")
      row = row.replace(new RegExp(escapedStem + '(?![\\w.-]|\\s*\\(doc_[a-z]+_\\d{4}\\))', 'g'), entry.id);
    }

    // 3) Cleanup artifacts from previous partial compression
    row = row.replace(/\bUI\s+(doc_[a-z]+_\d{4})\b/g, '$1');
    row = row.replace(/[\u4e00-\u9fff（）()]+(?=doc_[a-z]+_\d{4})/g, '');

    // 4) Normalize delimiters
    row = row.replace(/\s*,\s*/g, ', ');
    row = row.replace(/、{2,}/g, '、');

    return row;
  });

  return out.join('\n');
}

// ── Strip code refs from spec dependency columns ─────────────────────────────
//    Removes .ts/.tsx/.js/.json filenames and tools_node/ / artifacts/ paths
//    Removes the entire "Shared Protocols" row
function stripCodeRefs(content) {
  const lines = content.split('\n');
  const result = [];

  for (const line of lines) {
    // Non-table lines: keep as-is
    if (!line.startsWith('|')) {
      result.push(line);
      continue;
    }
    // Table separator rows: keep as-is
    if (/^\|\s*[-:]+\s*\|/.test(line)) {
      result.push(line);
      continue;
    }
    // Remove entire "Shared Protocols" row — it's code, not a spec
    if (/Shared Protocols/.test(line)) {
      continue;
    }

    const parts = line.split('|');
    // parts[0] = '' (before first pipe)
    // parts[1] = first content column (spec name — keep as-is)
    // parts[2..N-1] = other columns (strip code refs)
    // parts[last] = '' (after last pipe)

    const processed = parts.map((cell, idx) => {
      // Keep first content column (spec doc name) untouched
      if (idx <= 1) return cell;
      // Keep last empty cell untouched
      if (idx === parts.length - 1) return cell;

      let c = cell;
      // Remove source/code artifact files: .ts/.tsx/.js/.json
      c = c.replace(/[、，,\s]*[\w/@.-]*\w+\.(ts|tsx|js|json)\b\s*[、，,]?/g, '');
      // Remove tools_node/ scripts
      c = c.replace(/[、，,\s]*tools_node\/[\w./@*-]+\s*[、，,]?/g, '');
      // Remove artifacts/ paths
      c = c.replace(/[、，,\s]*artifacts\/[\w./@*-]+\s*[、，,]?/g, '');
      // Remove parenthetical developer notes that become dangling after stripping files
      c = c.replace(/（[^）]*IBreedingGate[^）]*）/g, '');
      // Collapse repeated separators
      c = c.replace(/[、，,]{2,}/g, '、');
      // Clean up orphaned separators at start/end
      c = c.replace(/^[\s、，,]+/, '').replace(/[\s、，,]+$/, '').trim();
      if (!c) c = ' — ';
      return c;
    });

    result.push(processed.join('|'));
  }

  return result.join('\n');
}

// ── Prune: remove from "### <heading-prefix>" to end of file ────────────────
function pruneSection(content, headingPrefix) {
  const lines = content.split('\n');
  const targetRe = new RegExp(`^###\\s+${headingPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);

  // Find the first H3 line matching the prefix
  let cutLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (targetRe.test(lines[i])) {
      cutLine = i;
      break;
    }
  }

  if (cutLine < 0) {
    console.warn(`[prune] Heading prefix "${headingPrefix}" not found — no changes`);
    return content;
  }

  // Walk backwards to also trim any blank lines before the heading
  let trimTo = cutLine;
  while (trimTo > 0 && lines[trimTo - 1].trim() === '') trimTo--;

  const trimmed = lines.slice(0, trimTo).join('\n');
  return trimmed + '\n';
}

// ── Validate doc_ids ─────────────────────────────────────────────────────────
function validateDocIds(filePath, registry) {
  const content = fs.readFileSync(path.resolve(ROOT, filePath), 'utf8');
  const { byDocId } = registry;
  const found   = new Set();
  const orphan  = new Set();
  const re = /\bdoc_[a-z]+_\d{4}\b/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const id = m[0];
    if (byDocId[id]) found.add(id);
    else orphan.add(id);
  }
  return { found: [...found], orphan: [...orphan] };
}

function extractOverallWeightedPercent(progressMd) {
  const line = progressMd
    .split('\n')
    .find((l) => l.includes('**合計（加權）**'));
  if (!line) return null;
  const m = line.match(/(\d{1,3})%/);
  if (!m) return null;
  return Number(m[1]);
}

function upsertProgressHistorySection(progressMd, date, percent) {
  const heading = '### D-5. 進度歷史紀錄（每日）';
  const sectionRe = new RegExp(`${heading}[\\s\\S]*$`);

  // Bootstrap history for dates before automation landed.
  const seed = [
    { date: '2026-03-31', percent: 31, source: '估算（測試骨架落地）', note: 'D-1 首版可用' },
    { date: '2026-04-05', percent: 34, source: '估算（戰場資料與 UI 合約補齊）', note: '核心/主戰場提升' },
    { date: '2026-04-10', percent: 36, source: '估算（cross-ref 壓縮與工具化）', note: '追蹤基礎穩定' },
  ];

  const rows = new Map(seed.map((r) => [r.date, r]));

  const existingMatch = progressMd.match(sectionRe);
  if (existingMatch) {
    const lines = existingMatch[0].split('\n');
    for (const line of lines) {
      const m = line.match(/^\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*(\d{1,3})%\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*$/);
      if (!m) continue;
      rows.set(m[1], {
        date: m[1],
        percent: Number(m[2]),
        source: m[3].trim(),
        note: m[4].trim(),
      });
    }
  }

  // One row per day; same-day overwrite.
  rows.set(date, {
    date,
    percent,
    source: '掃描實算（D-4）',
    note: '同日覆蓋最新值',
  });

  const sorted = [...rows.values()].sort((a, b) => b.date.localeCompare(a.date));

  const body = [
    heading,
    '',
    '> 每日最多一筆：同一天重跑結算時覆蓋該日資料。',
    '> 歷史資料來源：早期可用 git 里程碑估算；自動化啟用後以掃描實算為主。',
    '',
    '| 日期 | 加權總進度 | 資料來源 | 備註 |',
    '|---|---|---|---|',
    ...sorted.map((r) => `| ${r.date} | ${r.percent}% | ${r.source} | ${r.note} |`),
  ].join('\n');

  if (existingMatch) {
    return progressMd.replace(sectionRe, body);
  }

  return `${progressMd.trimEnd()}\n\n---\n\n${body}\n`;
}

// ── Rebuild progress: scan .ts files vs B-1 ─────────────────────────────────
function rebuildProgress() {
  const scriptsDir = path.join(ROOT, 'assets', 'scripts');
  const testsDir   = path.join(ROOT, 'tests');

  function walkTs(dir, acc) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkTs(full, acc);
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) acc.add(entry.name);
    }
  }

  const scriptFiles = new Set();
  const testFiles   = new Set();
  walkTs(scriptsDir, scriptFiles);
  walkTs(testsDir,   testFiles);

  const codeRefPath = path.join(ROOT, 'docs', 'cross-ref', 'cross-ref-code.md');
  if (!fs.existsSync(codeRefPath)) {
    console.error('[rebuild-progress] cross-ref-code.md not found');
    process.exit(1);
  }
  const content = fs.readFileSync(codeRefPath, 'utf8');

  // Extract .ts filenames from the first column of B-1 tables
  const b1TsRe = /^\|\s*(\*\*)?([A-Za-z_][\w/@.-]*\.ts)\1?\s*\|/gm;
  const referencedTs = [];
  let m;
  while ((m = b1TsRe.exec(content)) !== null) {
    const name = path.basename(m[2]);
    if (!referencedTs.includes(name)) referencedTs.push(name);
  }

  const present = referencedTs.filter(n => scriptFiles.has(n));
  const stale   = referencedTs.filter(n => !scriptFiles.has(n));
  const uncovered = [...scriptFiles].filter(n => !referencedTs.includes(n));

  console.log('\n[rebuild-progress] B-1 .ts coverage:');
  console.log(`  Referenced in B-1: ${referencedTs.length}`);
  console.log(`  Present in assets/scripts: ${present.length}`);
  console.log(`  STALE (not found): ${stale.length}`);
  if (stale.length > 0) stale.forEach(f => console.log(`    - ${f}`));

  console.log(`\n  Not yet in B-1 (${uncovered.length} files):`);
  uncovered.forEach(f => console.log(`    + ${f}`));

  console.log(`\n[rebuild-progress] Test files in tests/ (${testFiles.size}):`);
  [...testFiles].sort().forEach(f => console.log(`  tests/${f}`));

  // Write JSON report
  const report = {
    generated: new Date().toISOString().slice(0, 10),
    b1_referenced: referencedTs,
    present,
    stale,
    uncovered_scripts: [...uncovered],
    test_files: [...testFiles].sort(),
  };
  const outPath = path.join(ROOT, 'temp_crossref_progress_report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n[rebuild-progress] Report → ${outPath}`);

  // Update D-5 daily progress history in progress shard.
  const progressPath = path.join(ROOT, 'docs', 'cross-ref', 'cross-ref-進度.md');
  if (fs.existsSync(progressPath)) {
    const progressMd = fs.readFileSync(progressPath, 'utf8');
    const percent = extractOverallWeightedPercent(progressMd);
    if (Number.isFinite(percent)) {
      const next = upsertProgressHistorySection(progressMd, report.generated, percent);
      if (next !== progressMd) {
        fs.writeFileSync(progressPath, next, 'utf8');
        console.log(`[rebuild-progress] D-5 history upserted: ${report.generated} => ${percent}%`);
      } else {
        console.log('[rebuild-progress] D-5 history unchanged');
      }
    } else {
      console.warn('[rebuild-progress] D-4 overall percent not found; skipped D-5 upsert');
    }
  } else {
    console.warn('[rebuild-progress] cross-ref-進度.md not found; skipped D-5 upsert');
  }
}

// ── Write helper ─────────────────────────────────────────────────────────────
function writeFile(filePath, content) {
  const full = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
  fs.writeFileSync(full, content, 'utf8');
}

function readFile(filePath) {
  const full = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
  if (!fs.existsSync(full)) {
    console.error(`[ERROR] File not found: ${filePath}`);
    process.exit(1);
  }
  return fs.readFileSync(full, 'utf8');
}

// ── Main ─────────────────────────────────────────────────────────────────────
function main() {
  if (argv.length === 0 || hasFlag('--help')) {
    console.log(`rebuild-crossref.js — Cross-Reference maintenance tool

Usage:
  node tools_node/rebuild-crossref.js --compress <file>
      Compress "中文名.md (doc_id)" → "doc_id" in a shard file

  node tools_node/rebuild-crossref.js --strip-code <file>
      Remove .ts/.tsx and tools_node/|artifacts/ refs from spec tables

  node tools_node/rebuild-crossref.js --prune <file> <heading-prefix>
      Remove everything from "### <heading-prefix>" to end of file
      Example: --prune docs/cross-ref/cross-ref-code.md B-2.

  node tools_node/rebuild-crossref.js --validate [file]
      Check all doc_ids in shard files exist in registry

  node tools_node/rebuild-crossref.js --rebuild-progress
      Scan assets/scripts/**/*.ts vs B-1, write progress report

Flags can be combined on one command line.
`);
    return;
  }

  // --compress
  if (hasFlag('--compress')) {
    const target = flagVal('--compress');
    if (!target) { console.error('--compress requires a file path'); process.exit(1); }
    const original   = readFile(target);
    const registry = loadRegistry();
    const compressed = compressDocRefs(original, registry);
    if (compressed !== original) {
      writeFile(target, compressed);
      const delta = original.length - compressed.length;
      console.log(`[compress] ${target}: saved ${delta} chars`);
    } else {
      console.log(`[compress] ${target}: no changes`);
    }
  }

  // --strip-code
  if (hasFlag('--strip-code')) {
    const target = flagVal('--strip-code');
    if (!target) { console.error('--strip-code requires a file path'); process.exit(1); }
    const original = readFile(target);
    const stripped  = stripCodeRefs(original);
    if (stripped !== original) {
      writeFile(target, stripped);
      console.log(`[strip-code] ${target}: code refs removed`);
    } else {
      console.log(`[strip-code] ${target}: no changes`);
    }
  }

  // --prune
  if (hasFlag('--prune')) {
    const target  = flagVal('--prune');
    const heading = flagVal2('--prune');
    if (!target || !heading) { console.error('--prune requires <file> <heading-prefix>'); process.exit(1); }
    const original = readFile(target);
    const pruned   = pruneSection(original, heading);
    if (pruned !== original) {
      writeFile(target, pruned);
      const removed = original.split('\n').length - pruned.split('\n').length;
      console.log(`[prune] ${target}: removed ${removed} lines from "${heading}"`);
    } else {
      console.log(`[prune] ${target}: heading not found — no changes`);
    }
  }

  // --validate
  if (hasFlag('--validate')) {
    const registry = loadRegistry();
    const target = flagVal('--validate');
    const files = target ? [target] : [
      'docs/cross-ref/cross-ref-specs.md',
      'docs/cross-ref/cross-ref-code.md',
      'docs/cross-ref/cross-ref-ui-spec.md',
      'docs/cross-ref/cross-ref-進度.md',
    ];
    let totalOrphans = 0;
    for (const f of files) {
      const full = path.isAbsolute(f) ? f : path.join(ROOT, f);
      if (!fs.existsSync(full)) { console.log(`[validate] ${f}: not found (skip)`); continue; }
      const { found, orphan } = validateDocIds(f, registry);
      console.log(`[validate] ${f}: ${found.length} valid, ${orphan.length} orphan`);
      if (orphan.length > 0) {
        orphan.forEach(id => console.log(`  ORPHAN: ${id}`));
        totalOrphans += orphan.length;
      }
    }
    console.log(totalOrphans > 0
      ? `\n[validate] TOTAL orphan doc_ids: ${totalOrphans} — fix before merging`
      : '\n[validate] All doc_ids valid ✓');
    if (totalOrphans > 0) process.exit(1);
  }

  // --rebuild-progress
  if (hasFlag('--rebuild-progress')) {
    rebuildProgress();
  }
}

main();
