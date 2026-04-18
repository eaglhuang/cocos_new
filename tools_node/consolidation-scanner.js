#!/usr/bin/env node
/**
 * tools_node/consolidation-scanner.js
 * 
 * 討論來源整併掃描工具——偵測新檔案、驗證 manifest 一致性、管理檔案 hash。
 * 
 * Usage:
 *   node tools_node/consolidation-scanner.js scan [--manifest <path>]
 *       列出未在 manifest 中追蹤的新檔案
 *   node tools_node/consolidation-scanner.js add-new [--manifest <path>]
 *       自動將新檔加入 manifest（status=pending）
 *   node tools_node/consolidation-scanner.js validate [--manifest <path>]
 *       驗證 manifest 中所有檔案的 hash（偵測修改）
 *   node tools_node/consolidation-scanner.js update-hash <file> [--manifest <path>]
 *       更新指定檔案的 hash
 */

'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');

const ROOT = process.cwd();
const SOURCES_DIR = path.join(ROOT, 'docs/遊戲規格文件/討論來源');
const DEFAULT_MANIFEST = path.join(ROOT, 'docs/遊戲規格文件/consolidation-manifest.json');

const args = process.argv.slice(2);
const cmd = args[0];
const manifestPath = args.includes('--manifest') 
  ? args[args.indexOf('--manifest') + 1] 
  : DEFAULT_MANIFEST;

function normalizeRelPath(relPath) {
  return String(relPath || '').replace(/\\/g, '/');
}

// ── Helper: 計算檔案 SHA256 hash ────────────────────────────────────────────
function fileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch (e) {
    console.error(`[ERROR] Cannot read file: ${filePath}`, e.message);
    return null;
  }
}

function estimateParagraphTotal(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const matches = content.match(/^## /gm);
    if (matches && matches.length > 0) return matches.length;
    return content.trim() ? 1 : 0;
  } catch {
    return 0;
  }
}

// ── Helper: 讀取 manifest ────────────────────────────────────────────────────
function loadManifest() {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    throw new Error(`Cannot parse manifest: ${e.message}`);
  }
}

// ── Helper: 寫入 manifest ────────────────────────────────────────────────────
function saveManifest(manifest) {
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
}

// ── Helper: 遞迴掃描討論來源目錄 ────────────────────────────────────────────
function scanSourceDir() {
  const files = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const relPath = normalizeRelPath(path.relative(ROOT, fullPath));
        files.push(relPath);
      }
    }
  }

  walk(SOURCES_DIR);
  return files.sort();
}

// ── Command: scan ───────────────────────────────────────────────────────────
function cmdScan() {
  let manifest;
  try {
    manifest = loadManifest();
  } catch (e) {
    console.log(`[INFO] Manifest not found or empty, creating new one\n`);
    manifest = {
      _meta: {
        description: '討論來源整併追蹤 manifest — 記錄每份討論文件的整併進度與段落覆蓋率',
        version: 1,
        lastUpdated: new Date().toISOString().split('T')[0],
        schemaNote: 'status: pending(未處理) / processing(處理中) / completed(已完成); coverage_percentage 必須 100% 才可標 completed',
        totalFiles: 0,
        completedFiles: 0,
        overallCoverage: 0
      },
      files: []
    };
  }

  const scanned = scanSourceDir();
  const tracked = new Set(manifest.files.map(f => normalizeRelPath(f.path)));
  const newFiles = scanned.filter(f => !tracked.has(f));

  console.log(`\n[consolidation-scanner] Scan Results\n`);
  console.log(`Total files in sources: ${scanned.length}`);
  console.log(`Tracked in manifest:   ${manifest.files.length}`);
  console.log(`Untracked (new):       ${newFiles.length}\n`);

  if (newFiles.length > 0) {
    console.log(`New files:\n`);
    newFiles.slice(0, 20).forEach((f, i) => {
      console.log(`  ${i + 1}. ${f}`);
    });
    if (newFiles.length > 20) {
      console.log(`  ... and ${newFiles.length - 20} more`);
    }
    console.log(`\nRun: node tools_node/consolidation-scanner.js add-new\n`);
  } else {
    console.log(`No new files found.\n`);
  }
}

// ── Command: add-new ────────────────────────────────────────────────────────
function cmdAddNew() {
  const manifest = loadManifest();
  const scanned = scanSourceDir();
  const tracked = new Set(manifest.files.map(f => normalizeRelPath(f.path)));
  const newFiles = scanned.filter(f => !tracked.has(f));

  if (newFiles.length === 0) {
    console.log(`\n[consolidation-scanner] No new files to add.\n`);
    return;
  }

  console.log(`\n[consolidation-scanner] Adding ${newFiles.length} new file(s)...\n`);

  for (const filePath of newFiles) {
    const fullPath = path.join(ROOT, filePath);
    const hash = fileHash(fullPath);
    const totalParagraphs = estimateParagraphTotal(fullPath);

    manifest.files.push({
      path: filePath,
      file_hash: hash || '',
      status: 'pending',
      dateAdded: new Date().toISOString().split('T')[0],
      dateCompleted: null,
      paragraphs: { total: totalParagraphs, consolidated: 0, doubt: 0, discarded: 0, pending: totalParagraphs },
      coverage_percentage: 0,
      targetSpecs: [],
      mcqRefs: [],
      notes: totalParagraphs > 0 ? `初始化完成：預估段落 ${totalParagraphs} 段` : '初始化完成：空檔或無段落'
    });

    console.log(`  ✓ ${filePath}`);
  }

  manifest._meta.totalFiles = manifest.files.length;
  manifest._meta.lastUpdated = new Date().toISOString().split('T')[0];

  saveManifest(manifest);
  console.log(`\n[consolidation-scanner] Updated manifest. Total files: ${manifest.files.length}\n`);
}

// ── Command: validate ───────────────────────────────────────────────────────
function cmdValidate() {
  const manifest = loadManifest();
  console.log(`\n[consolidation-scanner] Validating ${manifest.files.length} file(s)...\n`);

  let modified = 0;
  let missing = 0;

  for (const file of manifest.files) {
    const fullPath = path.join(ROOT, file.path);

    if (!fs.existsSync(fullPath)) {
      console.log(`  ⚠ MISSING: ${file.path}`);
      missing++;
      continue;
    }

    const newHash = fileHash(fullPath);
    if (newHash && file.file_hash && newHash !== file.file_hash) {
      console.log(`  ⚠ MODIFIED: ${file.path}`);
      console.log(`    Old hash: ${file.file_hash.substring(0, 16)}...`);
      console.log(`    New hash: ${newHash.substring(0, 16)}...`);
      modified++;
    }
  }

  console.log(`\nValidation Summary:`);
  console.log(`  Missing:  ${missing}`);
  console.log(`  Modified: ${modified}`);
  console.log(`  OK:       ${manifest.files.length - missing - modified}\n`);

  if (modified > 0) {
    console.log(`Run: node tools_node/consolidation-scanner.js add-new\n`);
  }
}

// ── Command: update-hash ────────────────────────────────────────────────────
function cmdUpdateHash() {
  const filePath = args[1];
  if (!filePath) {
    console.error(`[ERROR] Missing file path. Usage: update-hash <file>`);
    process.exit(1);
  }

  const manifest = loadManifest();
  const normalized = normalizeRelPath(filePath);
  const file = manifest.files.find(f => normalizeRelPath(f.path) === normalized);

  if (!file) {
    console.error(`[ERROR] File not found in manifest: ${filePath}`);
    process.exit(1);
  }

  const fullPath = path.join(ROOT, filePath);
  const hash = fileHash(fullPath);

  if (!hash) {
    console.error(`[ERROR] Cannot compute hash for ${filePath}`);
    process.exit(1);
  }

  file.file_hash = hash;
  saveManifest(manifest);
  console.log(`[consolidation-scanner] Updated hash for ${filePath}\n`);
}

// ── Main ────────────────────────────────────────────────────────────────────
switch (cmd) {
  case 'scan':
    cmdScan();
    break;
  case 'add-new':
    cmdAddNew();
    break;
  case 'validate':
    cmdValidate();
    break;
  case 'update-hash':
    cmdUpdateHash();
    break;
  default:
    console.log(`
[consolidation-scanner] — 討論來源整併掃描工具

Usage:
  node tools_node/consolidation-scanner.js scan
      列出未追蹤的新檔案
  node tools_node/consolidation-scanner.js add-new
      將新檔加入 manifest
  node tools_node/consolidation-scanner.js validate
      檢查 hash 一致性
  node tools_node/consolidation-scanner.js update-hash <file>
      更新特定檔案的 hash

Options:
  --manifest <path>   指定 manifest 路徑（預設 docs/遊戲規格文件/consolidation-manifest.json）
`);
}
