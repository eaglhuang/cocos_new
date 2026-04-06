#!/usr/bin/env node
/**
 * tools_node/shard-manager.js
 * General-purpose document shard manager.
 *
 * Manages "Managed File Groups" (MFG):
 *   - Splits a large source document into named shard files
 *   - Rebuilds the source as a thin index stub when shards change
 *   - Validates shard completeness
 *   - Reports shard status (size / mtime)
 *
 * Supported document types:
 *   markdown-h2   Split on ## headings; route by heading-text regex
 *   json-array    Split JSON array elements by field-value regex
 *
 * Config: each shard directory contains a `.shardrc.json`
 *
 * Usage:
 *   node tools_node/shard-manager.js shard          <shardDir>
 *   node tools_node/shard-manager.js rebuild-index  <shardDir>
 *   node tools_node/shard-manager.js validate       <shardDir>
 *   node tools_node/shard-manager.js status         <shardDir>
 *   node tools_node/shard-manager.js shard-all      docs/keep-shards docs/tasks docs/cross-ref
 *   node tools_node/shard-manager.js scan           [directory]  (default: docs/)
 *
 * Extra .shardrc.json flags:
 *   "keepSourceIntact": true   — do NOT overwrite source with a thin index stub.
 *                                Use when the source is itself a shard of a parent group.
 */

'use strict';
const fs   = require('fs');
const path = require('path');

// ── helpers ──────────────────────────────────────────────────────────────────
function die(msg)  { console.error('[shard-manager] ERROR:', msg); process.exit(1); }
function info(msg) { console.log('[shard-manager]', msg); }
function ok(msg)   { console.log('[shard-manager] OK:', msg); }

function readCfg(shardDir) {
  const absDir  = path.resolve(shardDir);
  const rcPath  = path.join(absDir, '.shardrc.json');
  if (!fs.existsSync(rcPath)) die(`No .shardrc.json in: ${absDir}`);

  const cfg = JSON.parse(fs.readFileSync(rcPath, 'utf8'));
  cfg._dir       = absDir;
  cfg._sourceAbs = path.resolve(absDir, cfg.source);

  // Pre-compile shard patterns
  for (const shard of cfg.shards) {
    shard._rx = new RegExp(shard.pattern, 'u');
  }
  return cfg;
}

function matchShardFor(cfg, text) {
  for (const shard of cfg.shards) {
    if (shard._rx.test(text)) return shard;
  }
  // Fallback to defaultShard or first shard
  return cfg.shards.find(s => s.name === cfg.defaultShard) ?? cfg.shards[0];
}

function relDir(absDir) {
  return path.relative(process.cwd(), absDir).replace(/\\/g, '/');
}

// ── MARKDOWN-H2 shard ────────────────────────────────────────────────────────
function shardMarkdownH2(cfg) {
  if (!fs.existsSync(cfg._sourceAbs)) die(`Source not found: ${cfg._sourceAbs}`);

  const lines  = fs.readFileSync(cfg._sourceAbs, 'utf8').split('\n');
  const bufs   = {};
  for (const s of cfg.shards) bufs[s.name] = [];

  // Lines before the first ## go into preambleShard (or first shard)
  const preambleName = cfg.preambleShard ?? cfg.shards[0].name;
  let   current      = cfg.shards.find(s => s.name === preambleName) ?? cfg.shards[0];

  for (const line of lines) {
    if (/^## /.test(line)) {
      const headingText = line.slice(3).trim(); // strip leading "## "
      current = matchShardFor(cfg, headingText);
    }
    bufs[current.name].push(line);
  }

  // Write shard .md files
  const shardRelDir = relDir(cfg._dir);
  for (const shard of cfg.shards) {
    const out = path.join(cfg._dir, shard.name + '.md');
    const hdr = buildMdShardHeader(cfg, shard);
    fs.writeFileSync(out, hdr + bufs[shard.name].join('\n'), 'utf8');
    info(`Wrote ${shardRelDir}/${shard.name}.md  (${bufs[shard.name].length} lines)`);
  }

  // Overwrite the source file with a thin index stub
  if (!cfg.keepSourceIntact) {
    rebuildMarkdownIndex(cfg, bufs);
  } else {
    info(`keepSourceIntact=true — skipping index stub rebuild for ${path.basename(cfg._sourceAbs)}`);
  }
}

function buildMdShardHeader(cfg, shard) {
  const indexPath = cfg.indexPath ?? cfg.source;
  return [
    `# ${cfg.indexTitle} — ${shard.title}`,
    ``,
    `> 這是 \`${path.basename(cfg.source)}\` 的「${shard.title}」分片。完整索引見 \`${indexPath}\`。`,
    ``,
    ``,
  ].join('\n');
}

function rebuildMarkdownIndex(cfg, bufs) {
  const shardRelDir = relDir(cfg._dir);
  const rows = cfg.shards.map(s => {
    const lineCount = bufs ? bufs[s.name].length : '?';
    const kb        = bufs ? Math.ceil(bufs[s.name].join('\n').length / 1024) + ' KB' : '?';
    return `| ${s.title} | \`${shardRelDir}/${s.name}.md\` | ${lineCount} 行 / ~${kb} |`;
  });

  const stub = [
    `# ${cfg.indexTitle}`,
    ``,
    `> **⚠️ 已拆分為 ${cfg.shards.length} 個分片，本檔為索引入口。**`,
    `> Token 節流目的：避免整份讀入超過 6000 tokens。請**按需**讀對應分片。`,
    ``,
    `## 分片索引`,
    ``,
    `| 分片 | 路徑 | 大小 |`,
    `|------|------|------|`,
    ...rows,
    ``,
    `## 使用說明`,
    ``,
    `- 先讀 \`docs/keep.summary.md\`（必讀，33 行）`,
    `- 依工作內容選對應分片讀取`,
    `- 搜尋特定內容：\`grep_search\` 搜尋 \`${shardRelDir}/\` 目錄`,
    `- 修改分片後重建索引：`,
    `  \`\`\``,
    `  node tools_node/shard-manager.js rebuild-index ${shardRelDir}`,
    `  \`\`\``,
  ].join('\n');

  fs.writeFileSync(cfg._sourceAbs, stub, 'utf8');
  ok(`Rebuilt index stub → ${path.relative(process.cwd(), cfg._sourceAbs).replace(/\\/g, '/')}`);
}

// ── JSON-ARRAY shard ─────────────────────────────────────────────────────────
function shardJsonArray(cfg) {
  if (!fs.existsSync(cfg._sourceAbs)) die(`Source not found: ${cfg._sourceAbs}`);

  const raw = JSON.parse(fs.readFileSync(cfg._sourceAbs, 'utf8'));
  const arr = cfg.arrayPath ? raw[cfg.arrayPath] : raw;
  if (!Array.isArray(arr)) die(`arrayPath "${cfg.arrayPath}" is not an array`);

  const bufs = {};
  for (const s of cfg.shards) bufs[s.name] = [];

  for (const item of arr) {
    const fieldVal = String(item[cfg.splitField] ?? '');
    const shard    = cfg.shards.find(s => s._rx.test(fieldVal))
                     ?? cfg.shards[cfg.shards.length - 1];
    bufs[shard.name].push(item);
  }

  const shardRelDir = relDir(cfg._dir);
  for (const shard of cfg.shards) {
    const out = path.join(cfg._dir, shard.name + '.json');
    fs.writeFileSync(out, JSON.stringify(bufs[shard.name], null, 2), 'utf8');
    info(`Wrote ${shardRelDir}/${shard.name}.json  (${bufs[shard.name].length} items)`);
  }

  if (!cfg.keepSourceIntact) {
    rebuildJsonIndex(cfg, bufs);
  } else {
    info(`keepSourceIntact=true — skipping index stub rebuild for ${path.basename(cfg._sourceAbs)}`);
  }
}

function rebuildJsonIndex(cfg, bufs) {
  const shardRelDir = relDir(cfg._dir);
  const index = {
    _note:    `索引 stub。完整任務資料見 ${shardRelDir}/ 目錄。`,
    _usage:   `讀取特定分片：直接讀 ${shardRelDir}/<shard>.json`,
    _rebuild: `node tools_node/shard-manager.js rebuild-index ${shardRelDir}`,
    shards: cfg.shards.map(s => ({
      name:  s.name,
      title: s.title,
      path:  `${shardRelDir}/${s.name}.json`,
      count: bufs ? bufs[s.name].length : null,
    })),
  };

  fs.writeFileSync(cfg._sourceAbs, JSON.stringify(index, null, 2), 'utf8');
  ok(`Rebuilt JSON index stub → ${path.relative(process.cwd(), cfg._sourceAbs).replace(/\\/g, '/')}`);
}

// ── REBUILD-INDEX (from existing shard files) ────────────────────────────────
function rebuildIndex(shardDir) {
  const cfg = readCfg(shardDir);
  if (cfg.type === 'json-array') {
    const bufs = {};
    // shardArrayPath: key inside each shard file that holds the array
    // (differs from arrayPath which is the key in the source/index file)
    const shardAP = cfg.shardArrayPath ?? cfg.arrayPath ?? null;
    for (const s of cfg.shards) {
      const p = path.join(cfg._dir, s.name + '.json');
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        const arr  = Array.isArray(data) ? data : (shardAP ? data[shardAP] : null);
        bufs[s.name] = Array.isArray(arr) ? arr : [];
      } else {
        bufs[s.name] = [];
      }
    }
    rebuildJsonIndex(cfg, bufs);
  } else {
    const bufs = {};
    for (const s of cfg.shards) {
      const p = path.join(cfg._dir, s.name + '.md');
      bufs[s.name] = fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split('\n') : [];
    }
    rebuildMarkdownIndex(cfg, bufs);
  }
}

// ── VALIDATE ─────────────────────────────────────────────────────────────────
function validate(shardDir) {
  const cfg = readCfg(shardDir);
  let allOk = true;
  const ext = cfg.type === 'json-array' ? '.json' : '.md';

  for (const s of cfg.shards) {
    const p    = path.join(cfg._dir, s.name + ext);
    if (!fs.existsSync(p)) {
      console.error(`[shard-manager]  MISSING shard: ${s.name}${ext}`);
      allOk = false;
    } else {
      const kb = (fs.statSync(p).size / 1024).toFixed(1);
      info(`  ✓ ${s.name}${ext}  (${kb} KB)`);
    }
  }

  // Check source / index stub exists
  if (!fs.existsSync(cfg._sourceAbs)) {
    console.error(`[shard-manager]  MISSING index: ${cfg.source}`);
    allOk = false;
  } else {
    const kb = (fs.statSync(cfg._sourceAbs).size / 1024).toFixed(1);
    info(`  ✓ ${cfg.source}  (index stub, ${kb} KB)`);
  }

  // Check for oversized shards and auto-parts sub-dirs
  const OVERSIZE_KB = 40; // warn if any shard exceeds this
  for (const s of cfg.shards) {
    const p = path.join(cfg._dir, s.name + ext);
    if (!fs.existsSync(p)) continue;
    const kb = fs.statSync(p).size / 1024;
    if (kb > OVERSIZE_KB) {
      console.warn(`[shard-manager] WARN: ${s.name}${ext} is ${kb.toFixed(1)} KB > ${OVERSIZE_KB} KB.`);
      console.warn(`       Consider: node tools_node/shard-manager.js auto-split ${relDir(cfg._dir)}`);
    }
    // Check for an auto-parts sub-dir for this shard
    const subDir = path.join(cfg._dir, s.name);
    if (fs.existsSync(path.join(subDir, '.shardrc.json'))) {
      validateAutoPartsDir(subDir);
    }
  }

  if (allOk) ok('validate passed — all shards present');
  else       die('validate failed — see above');
}

// ── STATUS ────────────────────────────────────────────────────────────────────
function statusCmd(shardDir) {
  const cfg = readCfg(shardDir);
  const ext = cfg.type === 'json-array' ? '.json' : '.md';

  console.log(`\n[shard-manager] ${cfg.indexTitle}`);
  console.log(`  source  : ${cfg.source}  (${cfg.type})`);
  console.log(`  shards  : ${cfg._dir.replace(/\\/g, '/')}`);
  console.log('');

  // Source
  if (fs.existsSync(cfg._sourceAbs)) {
    const s = fs.statSync(cfg._sourceAbs);
    console.log(`  [index]  ${path.basename(cfg.source).padEnd(32)} ${(s.size/1024).toFixed(1).padStart(7)} KB  ${s.mtime.toISOString().slice(0,16)}`);
  }

  for (const shard of cfg.shards) {
    const p = path.join(cfg._dir, shard.name + ext);
    if (fs.existsSync(p)) {
      const s = fs.statSync(p);
      console.log(`  [shard]  ${(shard.name + ext).padEnd(32)} ${(s.size/1024).toFixed(1).padStart(7)} KB  ${s.mtime.toISOString().slice(0,16)}`);
    } else {
      console.log(`  [shard]  ${(shard.name + ext).padEnd(32)}     MISSING`);
    }
  }
  console.log('');
}

// ── SCAN — detect unmanaged large files ──────────────────────────────────────
/**
 * Walk `scanDir` recursively, find .md and .json files >= thresholdKB,
 * collect all .shardrc.json source paths as "managed", then report
 * unmanaged large files as candidates for a new shard group.
 */
function scanCmd(scanDir, thresholdKB = 6) {
  const absBase = path.resolve(scanDir);
  if (!fs.existsSync(absBase)) die(`Scan directory not found: ${absBase}`);

  // ------ collect managed sources ------
  const managedAbs = new Set();
  const shardRcFiles = [];

  function walkForRc(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip common heavy dirs
        if (['node_modules', 'library', 'temp', '.git'].includes(entry.name)) continue;
        walkForRc(full);
      } else if (entry.name === '.shardrc.json') {
        shardRcFiles.push(full);
      }
    }
  }
  walkForRc(absBase);

  for (const rcPath of shardRcFiles) {
    try {
      const cfg = JSON.parse(fs.readFileSync(rcPath, 'utf8'));
      const srcAbs = path.resolve(path.dirname(rcPath), cfg.source);
      managedAbs.add(srcAbs);
      // Also mark the shard files themselves as managed
      const ext = cfg.type === 'json-array' ? '.json' : '.md';
      if (Array.isArray(cfg.shards)) {
        for (const s of cfg.shards) {
          managedAbs.add(path.join(path.dirname(rcPath), s.name + ext));
        }
      }
    } catch { /* skip malformed */ }
  }

  // ------ walk for large files ------
  const candidates = [];

  function walkForLarge(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', 'library', 'temp', '.git'].includes(entry.name)) continue;
        walkForLarge(full);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext !== '.md' && ext !== '.json') continue;
        const stat = fs.statSync(full);
        const kb   = stat.size / 1024;
        if (kb < thresholdKB) continue;
        if (managedAbs.has(full)) continue;
        candidates.push({ path: path.relative(process.cwd(), full).replace(/\\/g, '/'), kb: +kb.toFixed(1) });
      }
    }
  }
  walkForLarge(absBase);

  // ------ report ------
  console.log(`\n[shard-manager] Scan: ${relDir(absBase)}  (threshold: ${thresholdKB} KB)\n`);

  if (shardRcFiles.length > 0) {
    console.log(`  Managed shard groups (${shardRcFiles.length}):`);
    for (const rc of shardRcFiles) {
      console.log(`    ${path.relative(process.cwd(), rc).replace(/\\/g, '/')}`);
    }
    console.log('');
  }

  if (candidates.length === 0) {
    ok('No unmanaged large files found.');
    return;
  }

  console.log(`  Unmanaged large files (${candidates.length}) — consider adding a shard group:\n`);
  for (const c of candidates) {
    console.log(`  ⚠  ${c.path}  (${c.kb} KB)`);
  }

  console.log(`
  To create a shard group for any of these, add a directory with a .shardrc.json.
  Example structure:
    docs/my-shards/
      .shardrc.json   ← define source, type, shards[]
  Then run:
    node tools_node/shard-manager.js shard docs/my-shards
  See: .github/skills/doc-shard-manager/SKILL.md
`);
}

// ── AUTO-SPLIT — recursively split oversized shards into equal parts ──────────
/**
 * Detect shards in <shardDir> that exceed `thresholdKB` and split each one
 * into equal-sized part files inside a sub-directory `<shardDir>/<shardName>/`.
 *
 * Unlike the manual shard command (which uses regex routing), auto-split
 * produces plain index-range parts and writes an auto-generated `.shardrc.json`
 * (type="auto-parts") so validate/status can inspect the sub-dir.
 *
 * Usage:
 *   node tools_node/shard-manager.js auto-split <shardDir> [--threshold <KB>]
 *   node tools_node/shard-manager.js auto-split docs/tasks [--threshold 30]
 *
 * Re-running auto-split regenerates the parts from the current shard content.
 * keepSourceIntact is always true for auto-parts sub-dirs (source = parent shard).
 */
function autoSplitCmd(shardDir, thresholdKB = 30) {
  const cfg  = readCfg(shardDir);
  const ext  = cfg.type === 'json-array' ? '.json' : '.md';
  let   didSplit = false;

  for (const shard of cfg.shards) {
    const shardPath = path.join(cfg._dir, shard.name + ext);
    if (!fs.existsSync(shardPath)) continue;

    const sizeKB = fs.statSync(shardPath).size / 1024;
    if (sizeKB <= thresholdKB) {
      info(`  ${shard.name}${ext}  ${sizeKB.toFixed(1)} KB  (within threshold — skip)`);
      continue;
    }

    info(`  ${shard.name}${ext}  ${sizeKB.toFixed(1)} KB  > ${thresholdKB} KB → auto-split`);
    if (cfg.type === 'json-array') {
      splitJsonShardIntoParts(cfg, shard, shardPath, thresholdKB);
    } else {
      splitMarkdownShardIntoParts(cfg, shard, shardPath, thresholdKB);
    }
    didSplit = true;
  }

  if (!didSplit) ok(`No shards exceed ${thresholdKB} KB — nothing to split.`);
}

/** Extract items array from a shard file (handles both plain array and wrapped object). */
function getItemsFromShardFile(shardPath, cfg) {
  const raw = JSON.parse(fs.readFileSync(shardPath, 'utf8'));
  if (Array.isArray(raw)) return raw;
  const arrayKey  = cfg.shardArrayPath ?? cfg.arrayPath ?? null;
  if (arrayKey && Array.isArray(raw[arrayKey])) return raw[arrayKey];
  const firstAK   = Object.keys(raw).find(k => Array.isArray(raw[k]));
  if (firstAK) return raw[firstAK];
  return null;
}

function splitJsonShardIntoParts(cfg, shard, shardPath, thresholdKB) {
  const items = getItemsFromShardFile(shardPath, cfg);
  if (!items) {
    console.warn(`[shard-manager] WARN: ${shard.name}.json — cannot locate items array; skipping auto-split`);
    return;
  }

  const totalBytes  = fs.statSync(shardPath).size;
  const partsNeeded = Math.max(2, Math.ceil(totalBytes / (thresholdKB * 1024)));
  const batchSize   = Math.ceil(items.length / partsNeeded);

  const subDir = path.join(cfg._dir, shard.name);
  fs.mkdirSync(subDir, { recursive: true });

  const partDefs = [];
  let partIdx = 1;
  for (let start = 0; start < items.length; start += batchSize) {
    const end      = Math.min(start + batchSize, items.length);
    const batch    = items.slice(start, end);
    const partName = `${shard.name}-part-${partIdx}`;
    const outPath  = path.join(subDir, partName + '.json');
    fs.writeFileSync(outPath, JSON.stringify(batch, null, 2), 'utf8');
    const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
    info(`    → ${relDir(subDir)}/${partName}.json  (${batch.length} items, ${kb} KB)`);
    partDefs.push({
      name:  partName,
      title: `Part ${partIdx} (items ${start + 1}–${end})`,
      range: [start, end - 1],
    });
    partIdx++;
  }

  writeAutoPartsRc(subDir, cfg, shard, 'json', partDefs, thresholdKB);
  ok(`Auto-split ${shard.name}.json → ${partDefs.length} parts in ${relDir(subDir)}/`);
}

function splitMarkdownShardIntoParts(cfg, shard, shardPath, thresholdKB) {
  const lines       = fs.readFileSync(shardPath, 'utf8').split('\n');
  const totalBytes  = fs.statSync(shardPath).size;
  const partsNeeded = Math.max(2, Math.ceil(totalBytes / (thresholdKB * 1024)));
  const linesPerPart = Math.ceil(lines.length / partsNeeded);

  const subDir = path.join(cfg._dir, shard.name);
  fs.mkdirSync(subDir, { recursive: true });

  const partDefs = [];
  let partIdx = 1;
  for (let start = 0; start < lines.length; start += linesPerPart) {
    const end      = Math.min(start + linesPerPart, lines.length);
    const partName = `${shard.name}-part-${partIdx}`;
    const outPath  = path.join(subDir, partName + '.md');
    fs.writeFileSync(outPath, lines.slice(start, end).join('\n'), 'utf8');
    const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
    info(`    → ${relDir(subDir)}/${partName}.md  (${end - start} lines, ${kb} KB)`);
    partDefs.push({
      name:  partName,
      title: `Part ${partIdx} (lines ${start + 1}–${end})`,
      range: [start, end - 1],
    });
    partIdx++;
  }

  writeAutoPartsRc(subDir, cfg, shard, 'md', partDefs, thresholdKB);
  ok(`Auto-split ${shard.name}.md → ${partDefs.length} parts in ${relDir(subDir)}/`);
}

function writeAutoPartsRc(subDir, parentCfg, shard, ext, partDefs, thresholdKB) {
  const rc = {
    _autoGenerated:  true,
    _generatedBy:    'shard-manager auto-split',
    _thresholdKB:    thresholdKB,
    version:         1,
    source:          `../${shard.name}.${ext}`,
    indexTitle:      `${shard.title} (auto-parts)`,
    type:            'auto-parts',
    keepSourceIntact: true,
    shards:          partDefs,
  };
  fs.writeFileSync(path.join(subDir, '.shardrc.json'), JSON.stringify(rc, null, 2), 'utf8');
}

// ── VALIDATE updated to warn oversize + check auto-parts sub-dirs ────────────
function validateAutoPartsDir(subDir) {
  const rcPath = path.join(subDir, '.shardrc.json');
  if (!fs.existsSync(rcPath)) return;
  const cfg = JSON.parse(fs.readFileSync(rcPath, 'utf8'));
  if (cfg.type !== 'auto-parts') return;
  const ext = path.extname(cfg.source); // '.json' or '.md'
  let allOk = true;
  for (const s of (cfg.shards || [])) {
    const p = path.join(subDir, s.name + ext);
    if (!fs.existsSync(p)) {
      console.error(`[shard-manager]  MISSING auto-part: ${s.name}${ext} in ${relDir(subDir)}/`);
      allOk = false;
    } else {
      const kb = (fs.statSync(p).size / 1024).toFixed(1);
      info(`      ✓ ${relDir(subDir)}/${s.name}${ext}  (${kb} KB)`);
    }
  }
  if (allOk) info(`    ✓ auto-parts sub-dir OK: ${relDir(subDir)}/`);
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const cmd  = args[0];

if (!cmd) {
  console.log(`
Usage: node tools_node/shard-manager.js <command> [shardDir ...]

Commands:
  shard          <shardDir>          Split source doc into shards per .shardrc.json
  rebuild-index  <shardDir>          Regenerate index stub from existing shard files
  validate       <shardDir>          Check all expected shard files are present
  status         <shardDir>          Show shard sizes and modification times
  shard-all      <dir1> [dir2...]    Run 'shard' on multiple shard dirs at once
  auto-split     <shardDir>          Auto-detect & split oversized shards into equal parts
                 [--threshold <KB>]  Size threshold per part (default 30)
  scan           [directory]         Find .md/.json files >6KB not in any shard group
                 [--threshold <KB>]  Override size threshold (default 6)

.shardrc.json format:
  {
    "source":       "../keep.md",           // relative to shardDir
    "indexTitle":   "Keep Consensus",
    "indexPath":    "docs/keep.md",         // how to reference it in shard headers
    "type":         "markdown-h2",          // or "json-array"
    "preambleShard":"core",                 // markdown-h2: shard for pre-first-heading content
    "arrayPath":    "tasks",                // json-array: top-level key holding the array (omit if root)
    "splitField":   "id",                   // json-array: field to match patterns against
    "defaultShard": "core",                 // fallback when no pattern matches
    "shards": [
      { "name": "keep-core",     "title": "Core（P0·§0-§2c）",   "pattern": "^(P0|0|1|2|2b)\\\\." },
      { "name": "keep-workflow", "title": "Workflow（§3-§6·§13）","pattern": "^(3|4|5|6|13)\\\\." }
    ]
  }
`);
  process.exit(0);
}

switch (cmd) {
  case 'shard': {
    if (!args[1]) die('shard requires a shardDir argument');
    const cfg = readCfg(args[1]);
    if (cfg.type === 'json-array') shardJsonArray(cfg);
    else shardMarkdownH2(cfg);
    break;
  }
  case 'rebuild-index': {
    if (!args[1]) die('rebuild-index requires a shardDir argument');
    rebuildIndex(args[1]);
    break;
  }
  case 'validate': {
    if (!args[1]) die('validate requires a shardDir argument');
    validate(args[1]);
    break;
  }
  case 'status': {
    if (!args[1]) die('status requires a shardDir argument');
    statusCmd(args[1]);
    break;
  }
  case 'shard-all': {
    const dirs = args.slice(1);
    if (!dirs.length) die('shard-all requires at least one shardDir argument');
    for (const d of dirs) {
      const cfg = readCfg(d);
      if (cfg.type === 'json-array') shardJsonArray(cfg);
      else shardMarkdownH2(cfg);
    }
    break;
  }
  case 'auto-split': {
    if (!args[1]) die('auto-split requires a shardDir argument');
    let threshold = 30;
    for (let i = 2; i < args.length; i++) {
      if (args[i] === '--threshold' && args[i + 1]) { threshold = parseFloat(args[++i]); }
    }
    autoSplitCmd(args[1], threshold);
    break;
  }
  case 'scan': {
    // scan [directory] [--threshold <KB>]
    let scanDir   = 'docs';
    let threshold = 6;
    const rest = args.slice(1);
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === '--threshold' && rest[i + 1]) { threshold = parseFloat(rest[++i]); }
      else if (!rest[i].startsWith('--'))            { scanDir = rest[i]; }
    }
    scanCmd(scanDir, threshold);
    break;
  }
  default:
    die(`Unknown command: ${cmd}`);
}
