#!/usr/bin/env node
// validate-generals-data.js
// DC-1-0002：武將資料品質驗證工具
// @spec-source → docs/資料中心架構規格書.md §六 M1
//
// 用法：node tools_node/validate-generals-data.js [--dir <path>] [--file <path>]
//   - 預設掃描 assets/resources/data/master/
//   - 也可直接驗證 assets/resources/data/generals.json

'use strict';

const fs = require('fs');
const path = require('path');

// ─────────────────────────── 設定 ───────────────────────────
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_DIRS = [
  path.join(ROOT, 'assets', 'resources', 'data', 'master'),
];
const LEGACY_FILE = path.join(ROOT, 'assets', 'resources', 'data', 'generals.json');
const RARITY_FILE = path.join(ROOT, 'assets', 'resources', 'data', 'rarity-thresholds.json');

// ─────────────────────────── 解析 CLI ───────────────────────
const args = process.argv.slice(2);
const extraFiles = [];
const extraDirs = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--file' && args[i + 1]) { extraFiles.push(args[++i]); }
  else if (args[i] === '--dir' && args[i + 1]) { extraDirs.push(args[++i]); }
  else if (args[i] === '--help') {
    console.log('Usage: node tools_node/validate-generals-data.js [--dir <path>] [--file <path>]');
    process.exit(0);
  }
}

// ─────────────────────────── 輔助函式 ──────────────────────
let errors = 0;
let warnings = 0;

function err(file, context, msg) {
  console.error(`[ERROR] ${path.relative(ROOT, file)} | ${context} | ${msg}`);
  errors++;
}
function warn(file, context, msg) {
  console.warn(`[WARN]  ${path.relative(ROOT, file)} | ${context} | ${msg}`);
  warnings++;
}
function ok(file, msg) {
  console.log(`[OK]    ${path.relative(ROOT, file)} — ${msg}`);
}

// ─────────────────────────── 讀取 rarity-thresholds ────────
let rarityThresholds = null;
if (fs.existsSync(RARITY_FILE)) {
  try {
    rarityThresholds = JSON.parse(fs.readFileSync(RARITY_FILE, 'utf8'));
    console.log(`[INFO]  Loaded rarity-thresholds.json`);
  } catch (e) {
    console.warn(`[WARN]  Cannot parse rarity-thresholds.json: ${e.message}`);
  }
}

// ─────────────────────────── 驗證單個武將物件 ──────────────
const REQUIRED_FIELDS = ['id', 'name', 'faction'];
const STATS_FIELDS = ['str', 'int', 'lea', 'pol', 'cha', 'luk'];
const VALID_FACTIONS = ['player', 'enemy', 'neutral', 'wei', 'shu', 'wu', 'other'];
const VALID_RARITY = ['common', 'rare', 'epic', 'legendary', 'mythic'];
const VALID_CATEGORY = ['civilian', 'general', 'famed', 'mythical', 'titled'];

function validateGeneral(file, g, index) {
  const ctx = `[${index}] id=${g.id ?? '?'}`;

  // 必填欄位
  for (const f of REQUIRED_FIELDS) {
    if (!g[f]) err(file, ctx, `缺少必填欄位 "${f}"`);
  }

  // id 格式（kebab-case）
  if (g.id && !/^[a-z0-9][a-z0-9\-]*$/.test(g.id)) {
    warn(file, ctx, `id "${g.id}" 建議使用 kebab-case`);
  }

  // faction 合法值
  if (g.faction && !VALID_FACTIONS.includes(g.faction)) {
    warn(file, ctx, `faction "${g.faction}" 不在已知清單中（${VALID_FACTIONS.join('/')}）`);
  }

  // hp 必須 > 0
  if (typeof g.hp === 'number' && g.hp <= 0) {
    err(file, ctx, `hp=${g.hp} 必須 > 0`);
  }

  // stats 0-100 範圍
  for (const s of STATS_FIELDS) {
    if (s in g) {
      const v = g[s];
      if (typeof v !== 'number') err(file, ctx, `${s} 必須是數字`);
      else if (v < 0 || v > 100) err(file, ctx, `${s}=${v} 超出範圍 0-100`);
    }
  }

  // ep >= 0
  if (typeof g.ep === 'number' && g.ep < 0) {
    err(file, ctx, `ep=${g.ep} 必須 >= 0`);
  }

  // rarityTier 合法值
  if (g.rarityTier && !VALID_RARITY.includes(g.rarityTier)) {
    err(file, ctx, `rarityTier "${g.rarityTier}" 不合法（${VALID_RARITY.join('/')}）`);
  }

  // characterCategory 合法值
  if (g.characterCategory && !VALID_CATEGORY.includes(g.characterCategory)) {
    err(file, ctx, `characterCategory "${g.characterCategory}" 不合法（${VALID_CATEGORY.join('/')}）`);
  }

  // genes: 若有 genes，每個 gene 需有 id
  if (Array.isArray(g.genes)) {
    g.genes.forEach((gene, gi) => {
      if (!gene.id) err(file, `${ctx}.genes[${gi}]`, `gene 缺少 id`);
    });
  }

  // storyStripCells: 若有，需有 slot + text
  if (Array.isArray(g.storyStripCells)) {
    g.storyStripCells.forEach((cell, ci) => {
      if (!cell.slot) err(file, `${ctx}.storyStripCells[${ci}]`, `cell 缺少 slot`);
      if (!cell.text) warn(file, `${ctx}.storyStripCells[${ci}]`, `cell.text 為空`);
    });
  }
}

// ─────────────────────────── 驗證 master/ JSON 骨架 ────────
const SKELETON_FILES = [
  'generals-base.json',
  'generals-lore.json',
  'generals-stories.json',
  'gene-dictionary.json',
  'bloodline-templates.json',
  'troop-definitions.json',
];

function validateMasterDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.warn(`[WARN]  master 目錄不存在：${dirPath}`);
    return;
  }

  for (const fname of SKELETON_FILES) {
    const fpath = path.join(dirPath, fname);
    if (!fs.existsSync(fpath)) {
      warn(fpath, 'skeleton', `${fname} 不存在，請執行 DC-1-0001 建立骨架`);
      continue;
    }
    try {
      const raw = JSON.parse(fs.readFileSync(fpath, 'utf8'));
      if (!raw.version) warn(fpath, 'skeleton', '缺少 version 欄位');
      if (!Array.isArray(raw.data)) {
        err(fpath, 'skeleton', 'data 欄位必須是陣列');
        continue;
      }
      if (fname === 'generals-base.json' && raw.data.length > 0) {
        raw.data.forEach((g, i) => validateGeneral(fpath, g, i));
      }
      ok(fpath, `${raw.data.length} 筆資料`);
    } catch (e) {
      err(fpath, 'parse', `JSON 解析失敗：${e.message}`);
    }
  }
}

// ─────────────────────────── 驗證 generals.json (legacy) ───
function validateLegacyFile(fpath) {
  if (!fs.existsSync(fpath)) {
    console.log(`[INFO]  ${path.relative(ROOT, fpath)} 不存在，略過`);
    return;
  }
  try {
    const data = JSON.parse(fs.readFileSync(fpath, 'utf8'));
    if (!Array.isArray(data)) {
      err(fpath, 'root', '頂層必須是陣列');
      return;
    }
    data.forEach((g, i) => validateGeneral(fpath, g, i));
    ok(fpath, `${data.length} 筆資料`);
  } catch (e) {
    err(fpath, 'parse', `JSON 解析失敗：${e.message}`);
  }
}

// ─────────────────────────── 主流程 ────────────────────────
console.log('=== validate-generals-data.js ===\n');

// 掃描 master/ 目錄
const dirsToScan = [...DEFAULT_DIRS, ...extraDirs];
for (const d of dirsToScan) {
  validateMasterDir(d);
}

// 驗證 legacy generals.json
validateLegacyFile(LEGACY_FILE);

// 驗證指定 --file
for (const f of extraFiles) {
  validateLegacyFile(path.resolve(f));
}

console.log(`\n=== 結果：errors=${errors}, warnings=${warnings} ===`);

if (errors > 0) {
  console.error(`\n❌ 驗證失敗，${errors} 個 error 需修正。`);
  process.exit(1);
} else {
  console.log(`\n✅ 驗證通過${warnings > 0 ? `（${warnings} 個 warning 請留意）` : ''}。`);
  process.exit(0);
}
