/**
 * merge-generals-master.js
 * 
 * 從多個來源 JSON（raw-wiki.json、raw-ai.json）合併去重、欄位映射，
 * 輸出至 master/generals-base.json 與 master/generals-lore.json。
 * 
 * 用法：
 *   node tools_node/merge-generals-master.js [--dry-run] [--wiki <path>] [--ai <path>]
 * 
 * 選項：
 *   --dry-run   不寫入檔案，只印 diff 報告
 *   --wiki      raw-wiki.json 路徑（預設 temp_workspace/raw-wiki.json）
 *   --ai        raw-ai.json 路徑（預設 temp_workspace/raw-ai.json）
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const MASTER_DIR = path.join(ROOT, 'assets', 'resources', 'data', 'master');
const GENERALS_BASE = path.join(MASTER_DIR, 'generals-base.json');
const GENERALS_LORE = path.join(MASTER_DIR, 'generals-lore.json');
const VALIDATE_SCRIPT = path.join(__dirname, 'validate-generals-data.js');
const BUILD_RUNTIME_SCRIPT = path.join(__dirname, 'build-generals-runtime.js');

// --- CLI 解析 ---
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const wikiIdx = args.indexOf('--wiki');
const aiIdx = args.indexOf('--ai');
const wikiPath = wikiIdx >= 0 ? args[wikiIdx + 1] : path.join(ROOT, 'temp_workspace', 'raw-wiki.json');
const aiPath = aiIdx >= 0 ? args[aiIdx + 1] : path.join(ROOT, 'temp_workspace', 'raw-ai.json');

// --- 工具函式 ---
function loadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`[SKIP]  ${filePath} 不存在，跳過。`);
    return [];
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  const obj = JSON.parse(raw);
  if (Array.isArray(obj)) return obj;
  if (Array.isArray(obj.data)) return obj.data;
  if (Array.isArray(obj.generals)) return obj.generals;
  console.warn(`[WARN]  ${filePath} 格式不符，應為陣列或含 data 陣列的物件。`);
  return [];
}

function loadMasterJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return { version: '1.0.0', updatedAt: new Date().toISOString(), data: [] };
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// 從來源記錄提取 base 欄位
function extractBase(rec) {
  return {
    id: rec.id,
    name: rec.name || '???',
    faction: rec.faction || 'unknown',
    alias: rec.alias,
    str: rec.str,
    int: rec.int,
    lea: rec.lea,
    pol: rec.pol,
    cha: rec.cha,
    luk: rec.luk,
    ep: rec.ep,
    rarityTier: rec.rarityTier,
    characterCategory: rec.characterCategory,
    ancestor_chain: rec.ancestor_chain,
    gender: rec.gender,
    role: rec.role,
    epRating: rec.epRating,
    troopAptitude: rec.troopAptitude,
    terrainAptitude: rec.terrainAptitude,
    weatherAptitude: rec.weatherAptitude,
    learnedTactics: rec.learnedTactics,
    inspiredTactics: rec.inspiredTactics,
    lockedTactics: rec.lockedTactics,
  };
}

// 從來源記錄提取 lore 欄位
function extractLore(rec) {
  const base = { id: rec.id };
  if (rec.templateId !== undefined) base.templateId = rec.templateId;
  if (rec.title !== undefined) base.title = rec.title;
  if (rec.source !== undefined) base.source = rec.source;
  if (rec.notes !== undefined) base.notes = rec.notes;
  if (rec.devNote !== undefined) base.devNote = rec.devNote;
  if (rec.bloodlineId !== undefined) base.bloodlineId = rec.bloodlineId;
  if (rec.awakeningTitle !== undefined) base.awakeningTitle = rec.awakeningTitle;
  if (rec.crestHint !== undefined) base.crestHint = rec.crestHint;
  if (rec.crestState !== undefined) base.crestState = rec.crestState;
  if (rec.historicalAnecdote !== undefined) base.historicalAnecdote = rec.historicalAnecdote;
  if (rec.bloodlineRumor !== undefined) base.bloodlineRumor = rec.bloodlineRumor;
  if (rec.storyStripCells !== undefined) base.storyStripCells = rec.storyStripCells;
  if (rec.parentsSummary !== undefined) base.parentsSummary = rec.parentsSummary;
  if (rec.ancestorsSummary !== undefined) base.ancestorsSummary = rec.ancestorsSummary;
  return base;
}

// 合併策略：對既有 uid 進行欄位 upsert，僅用非空值補缺。
function mergeIntoList(existingList, incoming, key = 'id') {
  const existingMap = new Map(existingList.map(item => [item[key], item]));
  const added = [];
  const updated = [];
  const untouched = [];

  for (const rec of incoming) {
    const uid = rec[key];
    if (!uid) {
      console.warn(`[WARN]  來源記錄缺少 ${key} 欄位，跳過: ${JSON.stringify(rec).slice(0, 80)}`);
      continue;
    }
    if (existingMap.has(uid)) {
      const existing = existingMap.get(uid);
      let changed = false;
      for (const [field, value] of Object.entries(rec)) {
        if (field === key) continue;
        if (value === undefined || value === null) continue;
        if (typeof value === 'string' && value.trim() === '') continue;
        if (Array.isArray(value) && value.length === 0) continue;

        const current = existing[field];
        const isCurrentEmpty = current === undefined
          || current === null
          || (typeof current === 'string' && current.trim() === '')
          || (Array.isArray(current) && current.length === 0)
          || (typeof current === 'object' && !Array.isArray(current) && Object.keys(current).length === 0);

        if (isCurrentEmpty) {
          existing[field] = value;
          changed = true;
        }
      }
      if (changed) {
        updated.push(uid);
      } else {
        untouched.push(uid);
      }
    } else {
      existingMap.set(uid, rec);
      added.push(uid);
    }
  }
  return { merged: Array.from(existingMap.values()), added, updated, untouched };
}

// --- 主流程 ---
console.log('=== merge-generals-master.js ===');
if (isDryRun) console.log('[INFO]  --dry-run 模式，不寫入檔案。\n');

// 載入來源
const wikiRecords = loadJson(wikiPath);
const aiRecords = loadJson(aiPath);
const allIncoming = [...wikiRecords, ...aiRecords];
console.log(`[INFO]  wiki: ${wikiRecords.length} 筆  ai: ${aiRecords.length} 筆  合計: ${allIncoming.length} 筆\n`);

// 載入現有 master
const baseObj = loadMasterJson(GENERALS_BASE);
const loreObj = loadMasterJson(GENERALS_LORE);

// 提取分類欄位
const incomingBase = allIncoming.map(extractBase).filter(r => r.id);
const incomingLore = allIncoming.map(extractLore).filter(r => r.id);

// 合併
const baseResult = mergeIntoList(baseObj.data, incomingBase);
const loreResult = mergeIntoList(loreObj.data, incomingLore);

// Diff 報告
console.log(`[generals-base] 新增 ${baseResult.added.length} 筆，更新 ${baseResult.updated.length} 筆，未變更 ${baseResult.untouched.length} 筆`);
if (baseResult.added.length > 0) console.log(`  新增: ${baseResult.added.join(', ')}`);
if (baseResult.updated.length > 0) console.log(`  更新: ${baseResult.updated.join(', ')}`);

console.log(`[generals-lore] 新增 ${loreResult.added.length} 筆，更新 ${loreResult.updated.length} 筆，未變更 ${loreResult.untouched.length} 筆`);
if (loreResult.added.length > 0) console.log(`  新增: ${loreResult.added.join(', ')}`);
if (loreResult.updated.length > 0) console.log(`  更新: ${loreResult.updated.join(', ')}`);

if (isDryRun) {
  console.log('\n[INFO]  --dry-run 結束，未寫入任何檔案。');
  process.exit(0);
}

// 寫入
baseObj.data = baseResult.merged;
baseObj.updatedAt = new Date().toISOString();
loreObj.data = loreResult.merged;
loreObj.updatedAt = new Date().toISOString();

fs.writeFileSync(GENERALS_BASE, JSON.stringify(baseObj, null, 2), 'utf-8');
fs.writeFileSync(GENERALS_LORE, JSON.stringify(loreObj, null, 2), 'utf-8');
console.log('\n[OK]    master/generals-base.json 已更新。');
console.log('[OK]    master/generals-lore.json 已更新。');

// 自動執行驗證
console.log('\n[INFO]  執行 validate-generals-data.js...');
try {
  execSync(`node "${VALIDATE_SCRIPT}"`, { stdio: 'inherit' });
} catch (e) {
  console.error('[ERROR] 驗證發現問題，請修正後重新合併。');
  process.exit(1);
}

console.log('\n[INFO]  執行 build-generals-runtime.js...');
try {
  execSync(`node "${BUILD_RUNTIME_SCRIPT}"`, { stdio: 'inherit' });
} catch (e) {
  console.error('[ERROR] runtime build 失敗，master 與 runtime 可能不同步。');
  process.exit(1);
}
