#!/usr/bin/env node
/**
 * tools_node/consolidation-extract.js
 * 
 * 段落切分與標記引擎——切分討論文件為 ## 標題級段落，支援標記狀態與追蹤覆蓋率。
 * 
 * Usage:
 *   node tools_node/consolidation-extract.js parse <file>
 *       切分檔案為段落並輸出清單
 *   node tools_node/consolidation-extract.js summary <file>
 *       輸出段落摘要（first 3 lines）
 *   node tools_node/consolidation-extract.js mark <file> <paragraph-index> \
 *       --status consolidated --target doc_spec_0026[,doc_spec_0027] [--notes "..."]
 *       標記段落狀態並更新 manifest
 *   node tools_node/consolidation-extract.js coverage <file>
 *       計算單檔覆蓋率
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DEFAULT_MANIFEST = path.join(ROOT, 'docs/遊戲規格文件/consolidation-manifest.json');

const args = process.argv.slice(2);
const cmd = args[0];
const filePath = args[1];

// ── Helper: 讀取檔案 ────────────────────────────────────────────────────────
function readFile(relPath) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`[ERROR] File not found: ${relPath}`);
    process.exit(1);
  }
  return fs.readFileSync(fullPath, 'utf8');
}

// ── Helper: 讀取 manifest ────────────────────────────────────────────────────
function loadManifest() {
  const manifestPath = DEFAULT_MANIFEST;
  if (!fs.existsSync(manifestPath)) {
    console.error(`[ERROR] Manifest not found: ${manifestPath}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

// ── Helper: 寫入 manifest ────────────────────────────────────────────────────
function saveManifest(manifest) {
  fs.writeFileSync(DEFAULT_MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
}

// ── Paragraph Extraction ────────────────────────────────────────────────────
function extractParagraphs(content) {
  const lines = content.split('\n');
  const paragraphs = [];
  let currentPara = null;
  let startIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 偵測 ## 標題
    if (/^## /.test(line)) {
      // 儲存前一個段落
      if (currentPara !== null) {
        paragraphs.push({
          index: paragraphs.length,
          heading: currentPara,
          startLine: startIdx,
          endLine: i - 1,
          content: lines.slice(startIdx, i).join('\n')
        });
      }
      
      currentPara = line.slice(3).trim(); // 去掉 "## "
      startIdx = i;
    }
  }

  // 儲存最後一個段落
  if (currentPara !== null) {
    paragraphs.push({
      index: paragraphs.length,
      heading: currentPara,
      startLine: startIdx,
      endLine: lines.length - 1,
      content: lines.slice(startIdx).join('\n')
    });
  }

  return paragraphs;
}

// ── Command: parse ──────────────────────────────────────────────────────────
function cmdParse() {
  if (!filePath) {
    console.error(`[ERROR] Missing file path. Usage: parse <file>`);
    process.exit(1);
  }

  const content = readFile(filePath);
  const paras = extractParagraphs(content);

  console.log(`\n[consolidation-extract] Parse Results\n`);
  console.log(`File: ${filePath}`);
  console.log(`Total paragraphs: ${paras.length}\n`);

  for (const para of paras) {
    const preview = para.content.split('\n').slice(0, 2).join(' ').substring(0, 80);
    console.log(`[${para.index}] §${para.index} — ${para.heading}`);
    console.log(`    Lines: ${para.startLine}~${para.endLine}`);
    console.log(`    Preview: ${preview}...\n`);
  }
}

// ── Command: summary ────────────────────────────────────────────────────────
function cmdSummary() {
  if (!filePath) {
    console.error(`[ERROR] Missing file path. Usage: summary <file>`);
    process.exit(1);
  }

  const content = readFile(filePath);
  const paras = extractParagraphs(content);

  console.log(`\n[consolidation-extract] Paragraph Summaries\n`);
  console.log(`File: ${filePath}\n`);

  const summaries = paras.map(para => {
    const lines = para.content.split('\n');
    const firstThree = lines.slice(0, 3).join('\n');
    return {
      index: para.index,
      heading: para.heading,
      summary: firstThree.length > 200 ? firstThree.substring(0, 197) + '...' : firstThree
    };
  });

  console.log(JSON.stringify(summaries, null, 2));
  console.log('');
}

// ── Command: mark ───────────────────────────────────────────────────────────
function cmdMark() {
  if (!filePath || !args[2]) {
    console.error(`[ERROR] Missing args. Usage: mark <file> <paragraph-index> --status <status> --target <doc_id>`);
    process.exit(1);
  }

  const paraIndex = parseInt(args[2], 10);
  const statusIdx = args.indexOf('--status');
  const targetIdx = args.indexOf('--target');
  const notesIdx = args.indexOf('--notes');

  if (statusIdx < 0 || targetIdx < 0) {
    console.error(`[ERROR] Missing --status or --target`);
    process.exit(1);
  }

  const status = args[statusIdx + 1];
  const target = args[targetIdx + 1];
  const notes = notesIdx >= 0 ? args[notesIdx + 1] : '';

  const manifest = loadManifest();
  const file = manifest.files.find(f => f.path === filePath);

  if (!file) {
    console.error(`[ERROR] File not found in manifest: ${filePath}`);
    process.exit(1);
  }

  // 更新段落計數
  if (status === 'consolidated') {
    file.paragraphs.consolidated++;
  } else if (status === 'doubt') {
    file.paragraphs.doubt++;
  } else if (status === 'discarded') {
    file.paragraphs.discarded++;
  }

  file.paragraphs.pending = Math.max(0, file.paragraphs.pending - 1);

  // 記錄 target spec（支援逗號分隔多個 doc_id）
  const targets = String(target || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  for (const targetDocId of targets) {
    if (!file.targetSpecs.includes(targetDocId)) {
      file.targetSpecs.push(targetDocId);
    }
  }

  if (notes) {
    file.notes = notes;
  }

  // 更新狀態
  if (file.status === 'pending') {
    file.status = 'processing';
  }

  // 重新計算覆蓋率
  const covered = file.paragraphs.consolidated + file.paragraphs.doubt + file.paragraphs.discarded;
  file.coverage_percentage = file.paragraphs.total > 0 
    ? Math.round((covered / file.paragraphs.total) * 100) 
    : 0;

  saveManifest(manifest);

  console.log(`\n[consolidation-extract] Marked paragraph\n`);
  console.log(`File: ${filePath}`);
  console.log(`Paragraph: #${paraIndex}`);
  console.log(`Status: ${status}`);
  console.log(`Target: ${targets.join(', ')}`);
  console.log(`Coverage: ${file.coverage_percentage}%\n`);
}

// ── Command: coverage ───────────────────────────────────────────────────────
function cmdCoverage() {
  if (!filePath) {
    console.error(`[ERROR] Missing file path. Usage: coverage <file>`);
    process.exit(1);
  }

  const manifest = loadManifest();
  const file = manifest.files.find(f => f.path === filePath);

  if (!file) {
    console.error(`[ERROR] File not found in manifest: ${filePath}`);
    process.exit(1);
  }

  const content = readFile(filePath);
  const paras = extractParagraphs(content);

  // 同步段落總數
  if (file.paragraphs.total !== paras.length) {
    const oldTotal = file.paragraphs.total;
    file.paragraphs.total = paras.length;
    file.paragraphs.pending = paras.length - file.paragraphs.consolidated - file.paragraphs.doubt - file.paragraphs.discarded;
    console.log(`[consolidation-extract] Updated paragraph count: ${oldTotal} → ${paras.length}\n`);
    saveManifest(manifest);
  }

  const covered = file.paragraphs.consolidated + file.paragraphs.doubt + file.paragraphs.discarded;
  const coverage = file.paragraphs.total > 0 ? Math.round((covered / file.paragraphs.total) * 100) : 0;

  console.log(`\n[consolidation-extract] Coverage Report\n`);
  console.log(`File: ${filePath}`);
  console.log(`Total paragraphs:  ${file.paragraphs.total}`);
  console.log(`Consolidated:      ${file.paragraphs.consolidated}`);
  console.log(`Doubt:             ${file.paragraphs.doubt}`);
  console.log(`Discarded:         ${file.paragraphs.discarded}`);
  console.log(`Pending:           ${file.paragraphs.pending}`);
  console.log(`Coverage:          ${coverage}%\n`);

  if (coverage === 100) {
    console.log(`✓ 100% coverage achieved!\n`);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
switch (cmd) {
  case 'parse':
    cmdParse();
    break;
  case 'summary':
    cmdSummary();
    break;
  case 'mark':
    cmdMark();
    break;
  case 'coverage':
    cmdCoverage();
    break;
  default:
    console.log(`
[consolidation-extract] — 段落切分與標記引擎

Usage:
  node tools_node/consolidation-extract.js parse <file>
      列出所有 ## 級段落
  node tools_node/consolidation-extract.js summary <file>
      輸出段落摘要（JSON）
  node tools_node/consolidation-extract.js mark <file> <index> \
      --status <consolidated|doubt|discarded> --target <doc_id> [--notes "..."]
      標記段落並更新 manifest
  node tools_node/consolidation-extract.js coverage <file>
      計算覆蓋率

Example:
  node tools_node/consolidation-extract.js parse docs/遊戲規格文件/討論來源/20260412/培育系統規格書討論.md
  node tools_node/consolidation-extract.js mark docs/遊戲規格文件/討論來源/20260412/培育系統規格書討論.md 0 \\
      --status consolidated --target doc_spec_0026 --notes "已歸納至培育系統"
`);
}
