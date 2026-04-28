'use strict';
// doc_id: doc_other_0009 — dom-to-ui-json backup helper (M12)
// 規格來源：docs/html_skill_plan.md §45
//
// 在任何覆蓋寫入之前，把即將被覆蓋的檔案備份到帶時間戳的目錄中。
// 備份路徑：artifacts/dom-to-ui-backups/<YYYY-MM-DD_HH-mm-ss>_<screenId>/
//
// exports: createBackup({ screenId, files, backupRoot, repoRoot }) -> { backupDir, backedUpFiles, skipped }

const fs = require('fs');
const path = require('path');

/**
 * 格式化時間戳為 YYYY-MM-DD_HH-mm-ss 字串。
 * @param {Date} d
 * @returns {string}
 */
function formatTimestamp(d) {
  const pad = n => String(n).padStart(2, '0');
  return [
    d.getFullYear(),
    '-',
    pad(d.getMonth() + 1),
    '-',
    pad(d.getDate()),
    '_',
    pad(d.getHours()),
    '-',
    pad(d.getMinutes()),
    '-',
    pad(d.getSeconds()),
  ].join('');
  // -> 2026-04-26_14-23-30
}

/**
 * 在覆蓋寫入前，把既有檔案備份至帶時間戳的目錄。
 *
 * @param {object} opts
 * @param {string}  opts.screenId    - screen 識別碼（用於目錄命名）
 * @param {Array<{src: string, label?: string}>} opts.files - 欲備份的檔案清單（只備份已存在的）
 * @param {string}  [opts.backupRoot]  - 覆蓋備份根目錄（預設 artifacts/dom-to-ui-backups）
 * @param {string}  [opts.repoRoot]    - 專案根目錄（預設由本檔往上三層推算）
 * @param {Date}    [opts.now]         - 覆蓋時間（預設 new Date()，供測試注入）
 *
 * @returns {{ backupDir: string, backedUpFiles: string[], skipped: string[] }}
 *   backupDir      — 本次備份目錄的絕對路徑（即使沒有任何檔案需備份也回傳）
 *   backedUpFiles  — 實際備份的 label 或 src 清單
 *   skipped        — 不存在、已略過的 label 或 src 清單
 */
function createBackup({ screenId, files, backupRoot, repoRoot, now }) {
  const root = repoRoot || path.resolve(__dirname, '..', '..', '..');
  const base = backupRoot || path.join(root, 'artifacts', 'dom-to-ui-backups');

  const ts = formatTimestamp(now instanceof Date ? now : new Date());
  const safeName = String(screenId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
  const backupDir = path.join(base, `${ts}_${safeName}`);

  const backedUpFiles = [];
  const skipped = [];

  for (const entry of (files || [])) {
    const src = entry.src || entry;
    const label = entry.label || src;
    const full = path.resolve(src);
    if (!fs.existsSync(full)) {
      skipped.push(label);
      continue;
    }
    // 建立目錄（延遲至確認有檔案需備份時才建立，避免產生空目錄）
    fs.mkdirSync(backupDir, { recursive: true });
    // 保留原始檔名；若同名衝突（不同路徑），以後綴數字區分
    let destName = path.basename(full);
    let dest = path.join(backupDir, destName);
    let counter = 1;
    while (fs.existsSync(dest)) {
      const ext = path.extname(destName);
      const base2 = path.basename(destName, ext);
      dest = path.join(backupDir, `${base2}_${counter}${ext}`);
      counter += 1;
    }
    fs.copyFileSync(full, dest);
    backedUpFiles.push(label);
  }

  return { backupDir, backedUpFiles, skipped };
}

module.exports = { createBackup, formatTimestamp };
