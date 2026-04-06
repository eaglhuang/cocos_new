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
  rebuildMarkdownIndex(cfg, bufs);
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

  rebuildJsonIndex(cfg, bufs);
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
  default:
    die(`Unknown command: ${cmd}`);
}
