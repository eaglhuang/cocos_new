#!/usr/bin/env node
/**
 * validate-child-panel-configs.js  (G2)
 *
 * 驗證所有 CompositePanel 子類的 ChildPanel 設定：
 *  1. ChildPanel dataSource 命名一致性（camelCase，無空格）
 *  2. defaultFragment 引用的 layout JSON 必須存在於 layouts/ 目錄
 *  3. lazySlot 節點的 childType 若有設定，必須是已知 ChildPanel 子類名稱之一
 *  4. Content contract schema 若存在，必須是合法的 JSON Schema（含 $schema / fields）
 *
 * 用法：
 *   node tools_node/validate-child-panel-configs.js
 *   node tools_node/validate-child-panel-configs.js --strict
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const config      = require('./lib/project-config');
const projectRoot = config.ROOT;
const layoutDir   = config.paths.layoutsDir;
const contractDir = config.paths.contractsDir;

const strictMode   = process.argv.includes('--strict');
const verboseMode  = process.argv.includes('--verbose');

// ── 已知 ChildPanel 子類（遞迴掃描 panels/ 與 components/ 子目錄） ──────────
const panelsDir      = path.join(projectRoot, 'assets/scripts/ui/core/panels');
const componentsDir  = path.join(projectRoot, 'assets/scripts/ui/components');

function collectKnownChildTypes() {
  const result = new Set();

  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        scanDir(path.join(dir, entry.name));
      } else if (entry.name.endsWith('.ts')) {
        result.add(entry.name.replace(/\.ts$/, ''));
      }
    }
  }

  scanDir(panelsDir);
  scanDir(componentsDir);
  return result;
}

// ── 掃描所有 layout JSON，提取 lazySlot 節點 ──────────────────────────────
function extractLazySlots(layoutJson) {
  const results = [];

  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.lazySlot === true) {
      results.push({
        id:              node.id ?? node.name ?? '(unnamed)',
        defaultFragment: node.defaultFragment ?? null,
        childType:       node.childType ?? null,
        dataSource:      node.dataSource ?? null,
      });
    }
    if (Array.isArray(node.children)) {
      node.children.forEach(walk);
    }
    if (node.root) walk(node.root);
  }

  walk(layoutJson);
  return results;
}

// ── dataSource 格式校驗 ────────────────────────────────────────────────────
function isValidDataSource(ds) {
  return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(ds);
}

// ── 掃描所有 contract schema 檔案 ─────────────────────────────────────────
function validateContractSchema(contractPath) {
  const issues = [];
  let schema;
  try {
    schema = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  } catch (e) {
    issues.push(`JSON 解析失敗：${e.message}`);
    return issues;
  }

  if (!schema.$schema)      issues.push('缺少 $schema 欄位');
  if (!schema.schemaId)     issues.push('缺少 schemaId 欄位');
  if (!schema.fields)       issues.push('缺少 fields 欄位');
  if (!Array.isArray(schema.requiredFields)) {
    issues.push('缺少 requiredFields 陣列');
  }

  // 每個 requiredField 必須在 fields 中有對應 key
  if (schema.fields && Array.isArray(schema.requiredFields)) {
    for (const req of schema.requiredFields) {
      if (!schema.fields[req]) {
        issues.push(`requiredFields 中的 "${req}" 在 fields 中找不到`);
      }
    }
  }

  return issues;
}

// ── 主程式 ─────────────────────────────────────────────────────────────────
function main() {
  const knownChildTypes = collectKnownChildTypes();
  // Build a flat map of all layout/fragment IDs (relative path without .json, from uiSpec root)
  const uiSpecRoot = config.paths.uiSpecDir;

  function collectLayoutIds(baseDir, relPrefix) {
    const ids = new Set();
    if (!fs.existsSync(baseDir)) return ids;
    for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        for (const id of collectLayoutIds(path.join(baseDir, entry.name), `${relPrefix}${entry.name}/`)) {
          ids.add(id);
        }
      } else if (entry.name.endsWith('.json')) {
        ids.add(`${relPrefix}${entry.name.replace(/\.json$/, '')}`);
        // Also bare name without prefix (for direct id references)
        ids.add(entry.name.replace(/\.json$/, ''));
      }
    }
    return ids;
  }

  const availableLayouts = new Set([
    ...collectLayoutIds(layoutDir, ''),
    ...collectLayoutIds(path.join(uiSpecRoot, 'fragments', 'layouts'), 'fragments/layouts/'),
  ]);

  let errorCount   = 0;
  let warningCount = 0;
  let checkedFiles = 0;

  //
  // ─── Pass 1: layout JSON lazySlot 驗證 ──────────────────────────────────
  //
  if (!fs.existsSync(layoutDir)) {
    console.error(`[G2] layouts 目錄不存在：${layoutDir}`);
    process.exit(1);
  }

  const layoutFiles = fs.readdirSync(layoutDir).filter(f => f.endsWith('.json'));

  for (const file of layoutFiles) {
    const layoutPath = path.join(layoutDir, file);
    let layoutJson;
    try {
      layoutJson = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
    } catch (e) {
      console.error(`[G2] ❌ ${file}: JSON 解析失敗 — ${e.message}`);
      errorCount++;
      continue;
    }

    const slots = extractLazySlots(layoutJson);
    if (slots.length === 0) continue;
    checkedFiles++;

    for (const slot of slots) {
      const prefix = `[G2] ${file} → lazySlot "${slot.id}"`;

      // 規則 1: defaultFragment 必須存在
      if (slot.defaultFragment) {
        if (!availableLayouts.has(slot.defaultFragment)) {
          console.error(`${prefix}: defaultFragment "${slot.defaultFragment}" 在 layouts/ 中找不到`);
          errorCount++;
        } else if (verboseMode) {
          console.log(`${prefix}: defaultFragment ✓ "${slot.defaultFragment}"`);
        }
      }

      // 規則 2: childType 必須是已知 ChildPanel 類別名稱
      if (slot.childType) {
        if (!knownChildTypes.has(slot.childType)) {
          const msg = `${prefix}: childType "${slot.childType}" 在 core/panels/ 中找不到`;
          if (strictMode) {
            console.error(msg);
            errorCount++;
          } else {
            console.warn(msg);
            warningCount++;
          }
        } else if (verboseMode) {
          console.log(`${prefix}: childType ✓ "${slot.childType}"`);
        }
      }

      // 規則 3: dataSource 格式
      if (slot.dataSource !== null && slot.dataSource !== undefined) {
        if (!isValidDataSource(slot.dataSource)) {
          console.error(`${prefix}: dataSource "${slot.dataSource}" 格式無效（應為 camelCase，無空格）`);
          errorCount++;
        } else if (verboseMode) {
          console.log(`${prefix}: dataSource ✓ "${slot.dataSource}"`);
        }
      }
    }
  }

  //
  // ─── Pass 2: content contract schema 驗證 ────────────────────────────────
  //
  if (fs.existsSync(contractDir)) {
    const contractFiles = fs.readdirSync(contractDir).filter(f => f.endsWith('.schema.json'));

    for (const file of contractFiles) {
      const contractPath = path.join(contractDir, file);
      const issues = validateContractSchema(contractPath);
      checkedFiles++;

      if (issues.length > 0) {
        for (const issue of issues) {
          console.error(`[G2] ❌ contracts/${file}: ${issue}`);
          errorCount++;
        }
      } else if (verboseMode) {
        console.log(`[G2] ✓ contracts/${file}`);
      }
    }
  }

  //
  // ─── 結果摘要 ─────────────────────────────────────────────────────────────
  //
  console.log('');
  if (errorCount === 0 && warningCount === 0) {
    console.log(`✅ ChildPanel 設定驗證通過（inspected=${checkedFiles} layouts + contracts）`);
  } else if (errorCount === 0) {
    console.log(`⚠️  ChildPanel 設定驗證完成（${warningCount} warnings，無 errors）`);
  } else {
    console.error(`❌ ChildPanel 設定驗證失敗（errors=${errorCount}, warnings=${warningCount}）`);
    process.exit(1);
  }
}

main();
