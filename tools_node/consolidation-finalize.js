#!/usr/bin/env node
/**
 * tools_node/consolidation-finalize.js
 * 
 * 覆蓋率驗證與收工——驗證 100% 覆蓋率、同步下游文件、產出完成報告。
 * 
 * Usage:
 *   node tools_node/consolidation-finalize.js verify <file>
 *       驗證單檔覆蓋率並標記 completed（若達 100%）
 *   node tools_node/consolidation-finalize.js verify-all
 *       批次驗證所有 processing 狀態的檔案
 *   node tools_node/consolidation-finalize.js check-shards [--threshold 6]
 *       檢查系統規格書是否有檔案超過 token 警戒線（KB 為單位）
 *   node tools_node/consolidation-finalize.js sync-status
 *       更新 討論來源整併狀態.md
 *   node tools_node/consolidation-finalize.js report
 *       輸出整併進度報告
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DEFAULT_MANIFEST = path.join(ROOT, 'docs/遊戲規格文件/consolidation-manifest.json');
const STATUS_FILE = path.join(ROOT, 'docs/遊戲規格文件/討論來源整併狀態.md');
const SPECS_DIR = path.join(ROOT, 'docs/遊戲規格文件/系統規格書');

const args = process.argv.slice(2);
const cmd = args[0];

// ── Helper: 讀取 manifest ────────────────────────────────────────────────────
function loadManifest() {
  if (!fs.existsSync(DEFAULT_MANIFEST)) {
    console.error(`[ERROR] Manifest not found: ${DEFAULT_MANIFEST}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(DEFAULT_MANIFEST, 'utf8'));
}

// ── Helper: 寫入 manifest ────────────────────────────────────────────────────
function saveManifest(manifest) {
  fs.writeFileSync(DEFAULT_MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
}

// ── Command: verify ─────────────────────────────────────────────────────────
function cmdVerify() {
  const filePath = args[1];
  if (!filePath) {
    console.error(`[ERROR] Missing file path. Usage: verify <file>`);
    process.exit(1);
  }

  const manifest = loadManifest();
  const file = manifest.files.find(f => f.path === filePath);

  if (!file) {
    console.error(`[ERROR] File not found in manifest: ${filePath}`);
    process.exit(1);
  }

  const covered = file.paragraphs.consolidated + file.paragraphs.doubt + file.paragraphs.discarded;
  const coverage = file.paragraphs.total > 0 
    ? Math.round((covered / file.paragraphs.total) * 100) 
    : 0;

  console.log(`\n[consolidation-finalize] Verify Results\n`);
  console.log(`File: ${filePath}`);
  console.log(`Total:     ${file.paragraphs.total}`);
  console.log(`Covered:   ${covered}`);
  console.log(`Coverage:  ${coverage}%`);

  // 檢查是否有未解決的 doubt
  if (file.paragraphs.doubt > 0) {
    const unresolvedDoubt = file.mcqRefs.length > 0;
    console.log(`\nWarning: ${file.paragraphs.doubt} doubt segment(s) with MCQ ref(s)`);
    if (unresolvedDoubt) {
      console.log(`MCQs: ${file.mcqRefs.join(', ')}`);
    }
  }

  if (coverage === 100 && file.paragraphs.doubt === 0) {
    file.status = 'completed';
    file.dateCompleted = new Date().toISOString().split('T')[0];
    saveManifest(manifest);
    console.log(`\n✓ Marked as COMPLETED\n`);
  } else if (coverage === 100) {
    console.log(`\n⚠ Coverage is 100% but ${file.paragraphs.doubt} doubt(s) pending resolution\n`);
  } else {
    console.log(`\n✗ Coverage < 100%; pending: ${file.paragraphs.pending}\n`);
  }
}

// ── Command: verify-all ──────────────────────────────────────────────────────
function cmdVerifyAll() {
  const manifest = loadManifest();
  const processing = manifest.files.filter(f => f.status === 'processing');

  console.log(`\n[consolidation-finalize] Batch Verify\n`);
  console.log(`Processing files: ${processing.length}\n`);

  let completed = 0;
  let incomplete = 0;

  for (const file of processing) {
    const covered = file.paragraphs.consolidated + file.paragraphs.doubt + file.paragraphs.discarded;
    const coverage = file.paragraphs.total > 0 
      ? Math.round((covered / file.paragraphs.total) * 100) 
      : 0;

    if (coverage === 100 && file.paragraphs.doubt === 0) {
      file.status = 'completed';
      file.dateCompleted = new Date().toISOString().split('T')[0];
      completed++;
      console.log(`✓ ${file.path} → COMPLETED`);
    } else {
      incomplete++;
      console.log(`✗ ${file.path} → ${coverage}% (pending: ${file.paragraphs.pending}, doubt: ${file.paragraphs.doubt})`);
    }
  }

  saveManifest(manifest);
  console.log(`\nResults: ${completed} completed, ${incomplete} incomplete\n`);
}

// ── Command: check-shards ───────────────────────────────────────────────────
function cmdCheckShards() {
  const thresholdStr = args.includes('--threshold') ? args[args.indexOf('--threshold') + 1] : '6';
  const thresholdKB = parseInt(thresholdStr, 10);

  if (!fs.existsSync(SPECS_DIR)) {
    console.error(`[ERROR] Specs directory not found: ${SPECS_DIR}`);
    process.exit(1);
  }

  console.log(`\n[consolidation-finalize] Shard Check\n`);
  console.log(`Threshold: ${thresholdKB} KB\n`);

  const files = fs.readdirSync(SPECS_DIR)
    .filter(f => f.endsWith('.md') && !f.startsWith('.'))
    .map(f => ({
      name: f,
      size: fs.statSync(path.join(SPECS_DIR, f)).size / 1024
    }));

  let overThreshold = 0;
  for (const file of files) {
    if (file.size > thresholdKB) {
      console.log(`⚠ ${file.name}: ${file.size.toFixed(1)} KB`);
      overThreshold++;
    }
  }

  if (overThreshold > 0) {
    console.log(`\nRun: node tools_node/shard-manager.js scan ${path.relative(ROOT, SPECS_DIR)}\n`);
  } else {
    console.log(`✓ All files within threshold\n`);
  }
}

// ── Command: sync-status ────────────────────────────────────────────────────
function cmdSyncStatus() {
  const manifest = loadManifest();
  const completed = manifest.files.filter(f => f.status === 'completed');

  console.log(`\n[consolidation-finalize] Sync Status\n`);
  console.log(`Would update 討論來源整併狀態.md with ${completed.length} completed file(s)\n`);

  // 簡化：只輸出摘要，實際同步由 Agent 手動執行
  if (completed.length > 0) {
    console.log(`New entries to add:\n`);
    for (const file of completed) {
      const specs = file.targetSpecs.join('、');
      console.log(`- \`${path.basename(file.path)}\` → ${specs || '(multiple specs)'}`);
    }
    console.log('');
  }
}

// ── Command: report ─────────────────────────────────────────────────────────
function cmdReport() {
  const manifest = loadManifest();

  const completed = manifest.files.filter(f => f.status === 'completed');
  const processing = manifest.files.filter(f => f.status === 'processing');
  const pending = manifest.files.filter(f => f.status === 'pending');

  const totalCovered = completed.length;
  const overallCoverage = manifest.files.length > 0 
    ? Math.round((totalCovered / manifest.files.length) * 100) 
    : 0;

  console.log(`\n[consolidation-finalize] Progress Report\n`);
  console.log(`Total files:     ${manifest.files.length}`);
  console.log(`Completed:       ${completed.length}`);
  console.log(`Processing:      ${processing.length}`);
  console.log(`Pending:         ${pending.length}`);
  console.log(`Overall coverage: ${overallCoverage}%\n`);

  if (processing.length > 0) {
    console.log(`Currently processing:`);
    for (const file of processing.slice(0, 5)) {
      const covered = file.paragraphs.consolidated + file.paragraphs.doubt + file.paragraphs.discarded;
      const coverage = file.paragraphs.total > 0 
        ? Math.round((covered / file.paragraphs.total) * 100) 
        : 0;
      console.log(`  - ${path.basename(file.path)} (${coverage}%, pending: ${file.paragraphs.pending})`);
    }
  }

  console.log('');
}

// ── Main ────────────────────────────────────────────────────────────────────
switch (cmd) {
  case 'verify':
    cmdVerify();
    break;
  case 'verify-all':
    cmdVerifyAll();
    break;
  case 'check-shards':
    cmdCheckShards();
    break;
  case 'sync-status':
    cmdSyncStatus();
    break;
  case 'report':
    cmdReport();
    break;
  default:
    console.log(`
[consolidation-finalize] — 覆蓋率驗證與收工

Usage:
  node tools_node/consolidation-finalize.js verify <file>
      驗證單檔覆蓋率
  node tools_node/consolidation-finalize.js verify-all
      批次驗證所有 processing 檔案
  node tools_node/consolidation-finalize.js check-shards [--threshold 6]
      掃描系統規格書超大檔案
  node tools_node/consolidation-finalize.js sync-status
      顯示待同步至 討論來源整併狀態.md 的內容
  node tools_node/consolidation-finalize.js report
      顯示整併進度統計

Example:
  node tools_node/consolidation-finalize.js verify docs/遊戲規格文件/討論來源/20260412/培育系統規格書討論.md
  node tools_node/consolidation-finalize.js verify-all
  node tools_node/consolidation-finalize.js report
`);
}
