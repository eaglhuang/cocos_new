#!/usr/bin/env node
/**
 * generate-general-tactics.js
 * M1-E：依據稀有度、適性與屬性為每位武將分配天賦戰法（tacticSlots）與奧義（ultimateSlots）。
 *
 * 用法：
 *   node tools_node/generate-general-tactics.js             # 只填空白欄位（idempotent）
 *   node tools_node/generate-general-tactics.js --force     # 強制覆寫所有
 *   node tools_node/generate-general-tactics.js --dry-run   # 僅列出結果，不寫檔
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const ROOT          = path.join(__dirname, '..');
const BASE_PATH     = path.join(ROOT, 'assets', 'resources', 'data', 'master', 'generals-base.json');
const TACTICS_PATH  = path.join(ROOT, 'assets', 'resources', 'data', 'master', 'tactic-library.json');
const ULTIMATES_PATH = path.join(ROOT, 'assets', 'resources', 'data', 'master', 'ultimate-definitions.json');

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------
const FORCE    = process.argv.includes('--force');
const DRY_RUN  = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const GRADE_ORDER = { S: 5, A: 4, B: 3, C: 2, D: 1, E: 0 };

/**
 * Tactic & ultimate quotas per rarity tier.
 * tactics  = max tactic slots to fill
 * ultimate = whether this tier gets an ultimate slot
 * minScore = minimum aptitude score required to assign a tactic (rare/common gating)
 */
const TIER_QUOTA = {
  mythic:    { tactics: 3, ultimate: true,  minScore: 0 },
  legendary: { tactics: 2, ultimate: true,  minScore: 0 },
  epic:      { tactics: 1, ultimate: false, minScore: 0 },
  rare:      { tactics: 1, ultimate: false, minScore: 5 },  // only if aptitude matches
  common:    { tactics: 0, ultimate: false, minScore: 99 }, // effectively 0
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function loadJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (e) {
    console.error(`[ERROR] 讀取 ${p} 失敗：${e.message}`);
    process.exit(1);
  }
}

function gradeNum(g) {
  return GRADE_ORDER[g] ?? 0;
}

/**
 * 計算一個戰法對某名武將的適性分數。
 * aptitudeRules 每條規則：若通過且超越 minGrade，給予 10 + (超越等級 × 5) 分。
 * preferredStats：若該屬性 >= 門檻，給予額外分。
 */
function scoreTactic(tactic, general) {
  let score = 0;

  for (const rule of (tactic.aptitudeRules || [])) {
    let grade;
    if (rule.scope === 'troop')   grade = general.troopAptitude?.[rule.key];
    if (rule.scope === 'terrain') grade = general.terrainAptitude?.[rule.key];
    if (rule.scope === 'weather') grade = general.weatherAptitude?.[rule.key];
    if (!grade) continue;

    const diff = gradeNum(grade) - gradeNum(rule.minGrade);
    if (diff >= 0) score += 10 + diff * 5;
  }

  for (const stat of (tactic.preferredStats || [])) {
    const val = general[stat] ?? 0;
    if (val >= 90) score += 6;
    else if (val >= 80) score += 4;
    else if (val >= 70) score += 2;
  }

  return score;
}

/**
 * 依照 general.id + general.faction 推算出 templateId，
 * 格式為 GEN_{FACTION_UPPER}_{ID_SNAKE_UPPER}
 * 例：id=zhao-yun, faction=shu → GEN_SHU_ZHAO_YUN
 */
function deriveTemplateId(general) {
  const faction = (general.faction ?? 'qun').toUpperCase();
  const parts   = general.id.replace(/-/g, '_').toUpperCase();
  return `GEN_${faction}_${parts}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const baseObj    = loadJson(BASE_PATH);
const tacticsObj = loadJson(TACTICS_PATH);
const ultimatesObj = loadJson(ULTIMATES_PATH);

const generals  = Array.isArray(baseObj.data) ? baseObj.data : [];
const tactics   = Array.isArray(tacticsObj.data) ? tacticsObj.data : [];
const ultimates = Array.isArray(ultimatesObj.data) ? ultimatesObj.data : [];

// Index ultimates by templateId
const ultimatesByTemplate = new Map();
for (const u of ultimates) {
  if (!u.templateId) continue;
  if (!ultimatesByTemplate.has(u.templateId)) ultimatesByTemplate.set(u.templateId, []);
  ultimatesByTemplate.get(u.templateId).push(u);
}

function buildDesiredUltimateSlots(general, quota) {
  if (!quota.ultimate) return [];

  const templateId = deriveTemplateId(general);
  const defs = ultimatesByTemplate.get(templateId) || [];
  return defs
    .slice()
    .sort((a, b) => a.slot - b.slot)
    .map(u => ({
      slot:                u.slot,
      ultimateId:          u.id,
      unlockReincarnation: u.unlockReincarnation,
      vitalityCostPct:     u.vitalityCostPct,
      isExclusive:         u.exclusive ?? false,
    }));
}

function sameUltimateSlots(current, desired) {
  if (!Array.isArray(current)) return desired.length === 0;
  if (current.length !== desired.length) return false;

  return current.every((slot, index) => {
    const target = desired[index];
    return Boolean(target)
      && slot.slot === target.slot
      && slot.ultimateId === target.ultimateId
      && slot.unlockReincarnation === target.unlockReincarnation
      && slot.vitalityCostPct === target.vitalityCostPct
      && (slot.isExclusive ?? false) === target.isExclusive;
  });
}

let assigned = 0, skipped = 0, total = 0;

for (const general of generals) {
  total++;
  const tier   = general.rarityTier ?? 'common';
  const quota  = TIER_QUOTA[tier] ?? TIER_QUOTA.common;
  const desiredUltimateSlots = buildDesiredUltimateSlots(general, quota);

  // Idempotency check: tacticSlots 已存在且 ultimateSlots 也已與最新定義一致時才跳過。
  const hasExistingTactics = Array.isArray(general.tacticSlots) && general.tacticSlots.length > 0;
  const ultimateUpToDate = sameUltimateSlots(general.ultimateSlots, desiredUltimateSlots);
  if (hasExistingTactics && ultimateUpToDate && !FORCE) {
    skipped++;
    continue;
  }

  // -----------------------------------------------------------------------
  // 1. Tactic selection
  // -----------------------------------------------------------------------
  const eligible = tactics.filter(t =>
    Array.isArray(t.rarityAccess) && t.rarityAccess.includes(tier)
  );

  const scored = eligible
    .map(t => ({ tactic: t, score: scoreTactic(t, general) }))
    .filter(item => item.score >= quota.minScore)
    .sort((a, b) => b.score - a.score);

  const takeCount = Math.min(quota.tactics, scored.length);

  general.tacticSlots = scored.slice(0, takeCount).map((item, i) => ({
    slotId:   `slot-${i + 1}`,
    tacticId: item.tactic.id,
    source:   'inborn',
  }));

  // -----------------------------------------------------------------------
  // 2. Ultimate selection
  // -----------------------------------------------------------------------
  general.ultimateSlots = desiredUltimateSlots;

  assigned++;

  if (DRY_RUN) {
    const tacticNames = general.tacticSlots.map(s => s.tacticId).join(', ') || '—';
    const ultCount    = general.ultimateSlots.length;
    console.log(
      `  ${general.id.padEnd(24)} [${tier.padEnd(9)}] ` +
      `戰法: ${tacticNames.padEnd(48)} 奧義: ${ultCount}`
    );
  }
}

// ---------------------------------------------------------------------------
// Write output (unless dry-run)
// ---------------------------------------------------------------------------
if (!DRY_RUN) {
  baseObj.updatedAt = new Date().toISOString();
  fs.writeFileSync(BASE_PATH, JSON.stringify(baseObj, null, 2), 'utf-8');
}

const modeStr = DRY_RUN ? ' [DRY-RUN — 未寫入]' : '';
console.log(
  `[generate-general-tactics] 完成${modeStr}。` +
  `total=${total}  assigned=${assigned}  skipped=${skipped}`
);
