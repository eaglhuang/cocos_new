#!/usr/bin/env node
/**
 * build-generals-runtime.js
 *
 * 將 master data（base/lore/stories）編譯為 runtime 使用的 generals.json 與 generals-index.json，
 * 同步補齊 generals-stories.json，避免 master 與 runtime 長期分叉。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'assets', 'resources', 'data');
const MASTER_DIR = path.join(DATA_DIR, 'master');

const BASE_PATH = path.join(MASTER_DIR, 'generals-base.json');
const LORE_PATH = path.join(MASTER_DIR, 'generals-lore.json');
const STORIES_PATH = path.join(MASTER_DIR, 'generals-stories.json');
const RUNTIME_PATH = path.join(DATA_DIR, 'generals.json');
const INDEX_PATH = path.join(DATA_DIR, 'generals-index.json');

const ACTIVE_L1_COUNT = 12;
const STORY_SLOT_MAP = {
  1: 'origin',
  2: 'faction',
  3: 'role',
  4: 'awakening',
  5: 'bloodline',
  6: 'future',
  origin: 'origin',
  faction: 'faction',
  role: 'role',
  awakening: 'awakening',
  bloodline: 'bloodline',
  future: 'future',
};
const STORY_SLOT_ORDER = ['origin', 'faction', 'role', 'awakening', 'bloodline', 'future'];

function loadJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadWrapper(filePath) {
  const raw = loadJson(filePath, { version: '1.0.0', updatedAt: new Date().toISOString(), data: [] });
  return {
    version: raw.version || '1.0.0',
    updatedAt: raw.updatedAt || new Date().toISOString(),
    data: Array.isArray(raw) ? raw : (Array.isArray(raw.data) ? raw.data : []),
  };
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function toMap(list) {
  return new Map((list || []).map((item) => [item.id || item.uid, item]));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function tierRank(tier) {
  return ({ common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 })[tier] ?? 0;
}

function factionLabel(faction) {
  return ({ wei: '魏', shu: '蜀', wu: '吳', enemy: '群雄', neutral: '中立', player: '玩家', other: '其他' })[faction] || '未知';
}

function computeHp(record) {
  const lea = Number(record.lea || 0);
  const str = Number(record.str || 0);
  const int = Number(record.int || 0);
  const tierBonus = [0, 80, 160, 260, 360][tierRank(record.rarityTier)];
  const roleBonus = ({ Combat: 120, Commander: 80, Support: 20, Hybrid: 60 })[record.role] || 0;
  return clamp(Math.round(760 + lea * 4 + Math.max(str, int) * 2 + tierBonus + roleBonus), 850, 1800);
}

function computeMaxSp(record) {
  return ({ Support: 120, Commander: 110, Hybrid: 105, Combat: 100 })[record.role] || 100;
}

function computeAttackBonus(record) {
  const base = ({ Combat: 0.12, Commander: 0.08, Support: 0.05, Hybrid: 0.09 })[record.role] || 0.06;
  return Number((base + tierRank(record.rarityTier) * 0.01).toFixed(2));
}

function computePreferredTerrain(record) {
  if (record.role === 'Support') return 'forest';
  if (record.faction === 'wu') return 'water';
  if (record.faction === 'shu') return 'mountain';
  return 'plain';
}

function computeCrestState(record) {
  if (record.rarityTier === 'legendary' || record.rarityTier === 'mythic') return 'revealed';
  return record.bloodlineRumor ? 'rumored' : 'placeholder';
}

function normalizeStoryCells(sourceCells, record) {
  const mapped = new Map();
  for (const cell of sourceCells || []) {
    const slot = STORY_SLOT_MAP[cell.slot];
    if (!slot || !cell.text) continue;
    mapped.set(slot, String(cell.text).trim());
  }

  const fallback = {
    origin: `${record.name}生於亂世，早年便以才識與膽略嶄露頭角。`,
    faction: `投身${factionLabel(record.faction)}陣營後，逐步建立起自己的聲望。`,
    role: `${record.role || '將才'}定位鮮明，是隊伍中不可忽視的一角。`,
    awakening: `命運轉折之際，${record.name}曾在關鍵戰局留下自己的印記。`,
    bloodline: record.bloodlineRumor || `${record.name}的祖脈線索仍待後續考據補完。`,
    future: `${record.name}後續仍有可延展的角色弧線與覺醒空間。`,
  };

  return STORY_SLOT_ORDER.map((slot) => ({
    slot,
    text: mapped.get(slot) || fallback[slot],
  }));
}

function buildBloodlineId(record, legacy) {
  if (record && record.bloodlineId) return record.bloodlineId;
  if (legacy && legacy.bloodlineId) return legacy.bloodlineId;
  return `BL_${String(record.faction || 'other').toUpperCase()}_${record.id.replace(/-/g, '_').toUpperCase()}`;
}

function buildTemplateId(record, legacy) {
  if (record && record.templateId) return record.templateId;
  if (legacy && legacy.templateId) return legacy.templateId;
  return `GEN_${String(record.faction || 'other').toUpperCase()}_${record.id.replace(/-/g, '_').toUpperCase()}`;
}

function buildAwakeningTitle(record, legacy) {
  if (record && record.awakeningTitle) return record.awakeningTitle;
  if (legacy && legacy.awakeningTitle) return legacy.awakeningTitle;
  if (record.rarityTier === 'legendary' || record.rarityTier === 'mythic') return `${record.name}覺醒`;
  return '待覺醒';
}

function buildCrestHint(record, legacy, lore) {
  if (record && record.crestHint) return record.crestHint;
  if (legacy && legacy.crestHint) return legacy.crestHint;
  if (lore && lore.crestHint) return lore.crestHint;
  return `${record.name}命紋線索已建檔，仍待正式美術與世界觀校描。`;
}

function preserveMergedList(record, legacy, key) {
  if (Array.isArray(record?.[key])) return record[key];
  if (Array.isArray(legacy?.[key])) return legacy[key];
  return [];
}

function preserveMergedMap(record, legacy, key) {
  const value = record?.[key] ?? legacy?.[key];
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function buildRuntimeRecord(baseRecord, loreRecord, storyRecord, legacyRecord) {
  const merged = { ...baseRecord, ...loreRecord };
  const hp = computeHp(merged);
  const maxSp = computeMaxSp(merged);
  const storyStripCells = normalizeStoryCells(storyRecord?.storyStripCells || loreRecord?.storyStripCells, merged);
  const currentSp = Math.round(maxSp * (merged.role === 'Support' ? 0.55 : 0.4));

  return {
    id: merged.id,
    name: merged.name,
    alias: preserveMergedList(merged, legacyRecord, 'alias'),
    faction: merged.faction,
    templateId: buildTemplateId(merged, legacyRecord),
    title: merged.title || legacyRecord?.title || loreRecord?.title || `【${merged.name}】`,
    gender: merged.gender || legacyRecord?.gender || '未知',
    age: legacyRecord?.age || 30,
    hp,
    currentHp: hp,
    maxSp,
    initialSp: currentSp,
    currentSp,
    vitality: legacyRecord?.vitality || 100,
    maxVitality: legacyRecord?.maxVitality || 100,
    role: merged.role || legacyRecord?.role || 'Combat',
    status: legacyRecord?.status || 'Active',
    attackBonus: merged.attackBonus ?? legacyRecord?.attackBonus ?? computeAttackBonus(merged),
    str: merged.str ?? 0,
    int: merged.int ?? 0,
    lea: merged.lea ?? 0,
    pol: merged.pol ?? 0,
    cha: merged.cha ?? 0,
    luk: merged.luk ?? 0,
    stats: {
      str: merged.str ?? 0,
      int: merged.int ?? 0,
      lea: merged.lea ?? 0,
      pol: merged.pol ?? 0,
      cha: merged.cha ?? 0,
      luk: merged.luk ?? 0,
    },
    skillId: merged.skillId || merged.battlePrimarySkillId || legacyRecord?.skillId || legacyRecord?.battlePrimarySkillId || null,
    battlePrimarySkillId: merged.battlePrimarySkillId || merged.skillId || legacyRecord?.battlePrimarySkillId || legacyRecord?.skillId || null,
    preferredTerrain: merged.preferredTerrain || legacyRecord?.preferredTerrain || computePreferredTerrain(merged),
    terrainDefenseBonus: merged.terrainDefenseBonus ?? legacyRecord?.terrainDefenseBonus ?? 0.05,
    source: merged.source || legacyRecord?.source || '資料中心 master build',
    notes: merged.notes || legacyRecord?.notes || '',
    devNote: merged.devNote || legacyRecord?.devNote || '由 master pipeline 自動同步生成。',
    hiddenFlags: preserveMergedList(merged, legacyRecord, 'hiddenFlags'),
    ep: merged.ep ?? 0,
    epRating: merged.epRating || legacyRecord?.epRating || '',
    rarityTier: merged.rarityTier,
    characterCategory: merged.characterCategory,
    bloodlineId: buildBloodlineId(merged, legacyRecord),
    parentsSummary: loreRecord?.parentsSummary || legacyRecord?.parentsSummary || '父系 / 母系待後續考證。',
    ancestorsSummary: loreRecord?.ancestorsSummary || legacyRecord?.ancestorsSummary || `已建檔 ${Array.isArray(merged.ancestor_chain) ? merged.ancestor_chain.length : 0} 位祖脈節點。`,
    awakeningTitle: buildAwakeningTitle(merged, legacyRecord),
    genes: preserveMergedList(merged, legacyRecord, 'genes'),
    historicalAnecdote: loreRecord?.historicalAnecdote || legacyRecord?.historicalAnecdote || '',
    bloodlineRumor: loreRecord?.bloodlineRumor || legacyRecord?.bloodlineRumor || '',
    crestHint: buildCrestHint(merged, legacyRecord, loreRecord),
    crestState: merged.crestState || legacyRecord?.crestState || computeCrestState(merged),
    storyStripCells,
    coreTags: preserveMergedList(merged, legacyRecord, 'coreTags'),
    generatorProfile: preserveMergedMap(merged, legacyRecord, 'generatorProfile'),
    bloodlineProfile: preserveMergedMap(merged, legacyRecord, 'bloodlineProfile'),
    learnedTactics: preserveMergedList(merged, legacyRecord, 'learnedTactics'),
    inspiredTactics: preserveMergedList(merged, legacyRecord, 'inspiredTactics'),
    lockedTactics: preserveMergedList(merged, legacyRecord, 'lockedTactics'),
    tacticSlots: preserveMergedList(merged, legacyRecord, 'tacticSlots'),
    ultimateSlots: preserveMergedList(merged, legacyRecord, 'ultimateSlots'),
    troopAptitude: preserveMergedMap(merged, legacyRecord, 'troopAptitude'),
    terrainAptitude: preserveMergedMap(merged, legacyRecord, 'terrainAptitude'),
    weatherAptitude: preserveMergedMap(merged, legacyRecord, 'weatherAptitude'),
    ancestor_chain: Array.isArray(merged.ancestor_chain) ? merged.ancestor_chain : [],
  };
}

function buildIndexRecord(baseRecord, index) {
  return {
    uid: baseRecord.id,
    name: baseRecord.name,
    faction: baseRecord.faction,
    rarityTier: baseRecord.rarityTier,
    layerKey: baseRecord.layerKey || (index < ACTIVE_L1_COUNT ? 'L1' : 'L2'),
    role: baseRecord.role,
    characterCategory: baseRecord.characterCategory,
    str: baseRecord.str,
    int: baseRecord.int,
    lea: baseRecord.lea,
    pol: baseRecord.pol,
    cha: baseRecord.cha,
    luk: baseRecord.luk,
    ep: baseRecord.ep,
    gender: baseRecord.gender,
  };
}

function main() {
  const baseWrapper = loadWrapper(BASE_PATH);
  const loreWrapper = loadWrapper(LORE_PATH);
  const storiesWrapper = loadWrapper(STORIES_PATH);
  const legacyRuntime = loadJson(RUNTIME_PATH, []);

  const base = baseWrapper.data;
  const loreMap = toMap(loreWrapper.data);
  const storiesMap = toMap(storiesWrapper.data);
  const legacyMap = toMap(Array.isArray(legacyRuntime) ? legacyRuntime : (legacyRuntime.data || []));

  if (base.length === 0) {
    throw new Error('master/generals-base.json 無資料，無法建置 runtime generals。');
  }

  const runtimeList = [];
  const storiesList = [];
  const indexList = [];

  base.forEach((record, index) => {
    const loreRecord = loreMap.get(record.id) || {};
    const storyRecord = storiesMap.get(record.id) || {};
    const legacyRecord = legacyMap.get(record.id) || {};
    const runtimeRecord = buildRuntimeRecord(record, loreRecord, storyRecord, legacyRecord);
    runtimeList.push(runtimeRecord);
    storiesList.push({ id: record.id, storyStripCells: runtimeRecord.storyStripCells });
    indexList.push(buildIndexRecord(record, index));
  });

  const now = new Date().toISOString();
  writeJson(RUNTIME_PATH, runtimeList);
  writeJson(INDEX_PATH, {
    version: '1.0.0',
    updatedAt: now,
    description: 'L0 武將索引層 — 只含輕量查詢欄位，不含 lore/stats 詳細資料',
    data: indexList,
  });
  writeJson(STORIES_PATH, {
    version: '1.0.0',
    updatedAt: now,
    data: storiesList,
  });

  console.log(`[build-generals-runtime] generals.json: ${runtimeList.length} 筆`);
  console.log(`[build-generals-runtime] generals-index.json: ${indexList.length} 筆`);
  console.log(`[build-generals-runtime] generals-stories.json: ${storiesList.length} 筆`);
  console.log(`[build-generals-runtime] L1 active: ${indexList.filter((x) => x.layerKey === 'L1').length} 筆`);
}

main();