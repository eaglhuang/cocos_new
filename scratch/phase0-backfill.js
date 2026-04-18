#!/usr/bin/env node
/**
 * Phase 0: Manifest 回填腳本
 * 從 討論來源整併狀態.md 提取已整併記錄，批量呼叫 consolidation-backfill.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();
const STATUS_FILE = path.join(ROOT, 'docs/遊戲規格文件/討論來源整併狀態.md');
const MANIFEST_PATH = path.join(ROOT, 'docs/遊戲規格文件/consolidation-manifest.json');
const BACKFILL_SCRIPT = 'node tools_node/consolidation-backfill.js';

// 讀取 manifest 取得目前狀態
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const completedPaths = new Set(
  manifest.files.filter(f => f.status === 'completed').map(f => f.path)
);

console.log(`[Phase 0] Manifest 目前：${completedPaths.size} completed / ${manifest.files.length} total`);

// 讀取整併狀態文件
const statusContent = fs.readFileSync(STATUS_FILE, 'utf8');

// 正則匹配所有 §1.x 已整併區塊中的檔案項目
// 格式例: - `更舊的討論/xxx.md (doc_spec_0089)` → 已承接至 `關卡設計系統.md` (doc_spec_0044)
// 或: - `xxx.md` (doc_spec_XXXX) 
const entryPattern = /^- `([^`]+\.md)(?:\s*\(([^)]+)\))?`(?:\s*→\s*已承接至\s*(.+))?/gm;

const entries = [];
let match;
while ((match = entryPattern.exec(statusContent)) !== null) {
  const rawPath = match[1].trim();
  const docId = match[2] ? match[2].trim() : '';
  const targetStr = match[3] || '';
  
  // 提取目標規格書 doc_id
  const targetIds = [];
  const targetPattern = /\(([^)]+)\)/g;
  let tm;
  while ((tm = targetPattern.exec(targetStr)) !== null) {
    const id = tm[1].trim();
    if (id.startsWith('doc_')) targetIds.push(id);
  }
  
  // 如果沒有明確 target，從 docId 往回推
  if (targetIds.length === 0 && docId) {
    targetIds.push(docId);
  }

  // 建構 manifest 中的相對路徑
  let manifestPath = '';
  if (rawPath.startsWith('更舊的討論/') || rawPath.startsWith('比較舊的/') || 
      rawPath.startsWith('最早的討論/') || rawPath.startsWith('新手開場/') ||
      rawPath.startsWith('20260410/')) {
    manifestPath = `docs/遊戲規格文件/討論來源/${rawPath}`;
  } else {
    manifestPath = `docs/遊戲規格文件/討論來源/${rawPath}`;
  }
  
  entries.push({ rawPath, manifestPath, docId, targetIds });
}

console.log(`[Phase 0] 從整併狀態文件提取到 ${entries.length} 個已整併條目\n`);

// 過濾掉已經在 manifest 中 completed 的
let backfilled = 0;
let skipped = 0;
let notFound = 0;
let errors = 0;

for (const entry of entries) {
  // 跳過已 completed 的
  if (completedPaths.has(entry.manifestPath)) {
    skipped++;
    continue;
  }
  
  // 檢查是否存在於 manifest
  const inManifest = manifest.files.find(f => f.path === entry.manifestPath);
  if (!inManifest) {
    // 嘗試寬鬆匹配
    const loosePath = manifest.files.find(f => f.path.endsWith(entry.rawPath));
    if (loosePath) {
      entry.manifestPath = loosePath.path;
    } else {
      console.log(`  ⚠ NOT IN MANIFEST: ${entry.manifestPath}`);
      notFound++;
      continue;
    }
  }

  const targets = entry.targetIds.length > 0 ? entry.targetIds.join(',') : entry.docId || 'unknown';
  
  try {
    const cmd = `${BACKFILL_SCRIPT} complete "${entry.manifestPath}" --targets ${targets} --notes "Phase0 backfill from 整併狀態.md"`;
    execSync(cmd, { cwd: ROOT, stdio: 'pipe' });
    backfilled++;
    console.log(`  ✅ ${entry.rawPath} → ${targets}`);
  } catch (e) {
    errors++;
    console.log(`  ❌ FAILED: ${entry.rawPath} (${e.message.split('\n')[0]})`);
  }
}

console.log(`\n[Phase 0] 完成：`);
console.log(`  回填: ${backfilled}`);
console.log(`  跳過(已完成): ${skipped}`);
console.log(`  未在manifest: ${notFound}`);
console.log(`  錯誤: ${errors}`);

// 最終報告
try {
  const result = execSync('node tools_node/consolidation-finalize.js report', { cwd: ROOT, encoding: 'utf8' });
  console.log('\n' + result);
} catch (e) {
  console.log('[WARN] Cannot run final report');
}
