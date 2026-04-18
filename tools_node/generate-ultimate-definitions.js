#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE_PATH = path.join(ROOT, 'assets', 'resources', 'data', 'master', 'generals-base.json');
const ULTIMATES_PATH = path.join(ROOT, 'assets', 'resources', 'data', 'master', 'ultimate-definitions.json');

const FORCE = process.argv.includes('--force');
const DRY_RUN = process.argv.includes('--dry-run');

const SLOT_COSTS = {
  1: 0.05,
  2: 0.06,
  3: 0.07,
  4: 0.08,
  5: 0.10,
};

const PROFILE_MAP = {
  'liu-bei': {
    slots: [
      { name: '仁德號召', description: '全軍士氣回復 25%，並解除 1 個控制狀態。', scalingStat: 'cha', inheritanceGeneId: 'gene_honor', battleSkillId: null },
      { name: '桃園同心', description: '相鄰友軍攻防同步提升 35%，持續 3 回合。', scalingStat: 'cha', inheritanceGeneId: 'gene_guard', battleSkillId: null },
      { name: '昭烈仁政', description: '全軍回復 20% HP，並獲得 2 回合減傷。', scalingStat: 'pol', inheritanceGeneId: 'gene_politics', battleSkillId: null },
      { name: '漢室餘暉', description: '召集援軍，立即重置 1 名友軍行動條。', scalingStat: 'lea', inheritanceGeneId: 'gene_command', battleSkillId: null },
      { name: '興復漢祚', description: '全軍攻防速全面提升，且首輪傷害必定暴擊。', scalingStat: 'cha', inheritanceGeneId: 'gene_hidden_05', battleSkillId: null },
    ],
  },
  'sun-quan': {
    slots: [
      { name: '江東虎視', description: '標記最前線敵軍，對其造成的全體傷害提升 30%。', scalingStat: 'lea', inheritanceGeneId: 'gene_command', battleSkillId: null },
      { name: '坐斷東南', description: '我軍水戰與弓兵單位命中率提升 25%，持續 3 回合。', scalingStat: 'pol', inheritanceGeneId: 'gene_strategy', battleSkillId: null },
      { name: '制衡吳都', description: '敵我雙方增益重新分配，敵方最高增益轉移給我方。', scalingStat: 'pol', inheritanceGeneId: 'gene_politics', battleSkillId: null },
      { name: '碧眼統軍', description: '全軍獲得護盾，並提高 2 回合反擊率。', scalingStat: 'cha', inheritanceGeneId: 'gene_honor', battleSkillId: null },
      { name: '江東帝業', description: '戰場轉入江東優勢態勢，水域與平原加成翻倍 3 回合。', scalingStat: 'lea', inheritanceGeneId: 'gene_hidden_05', battleSkillId: null },
    ],
  },
  'zhou-yu': {
    slots: [
      { name: '赤壁炎策', description: '對全場敵軍施加火傷印記 2 回合。', scalingStat: 'int', inheritanceGeneId: 'gene_strategy', battleSkillId: null },
      { name: '曲有誤周郎顧', description: '看破敵方戰法，無效化 1 次敵軍群體技能。', scalingStat: 'cha', inheritanceGeneId: 'gene_honor', battleSkillId: null },
      { name: '火鳳連營', description: '火焰在相鄰敵格連鎖擴散，最多跳躍 5 次。', scalingStat: 'int', inheritanceGeneId: 'gene_strategy', battleSkillId: null },
      { name: '都督節制', description: '我軍全體獲得攻速與智傷加成，持續 3 回合。', scalingStat: 'lea', inheritanceGeneId: 'gene_command', battleSkillId: null },
      { name: '江左天焰', description: '召喚全屏火海，敵軍每回合失去最大 HP 12%。', scalingStat: 'int', inheritanceGeneId: 'gene_hidden_05', battleSkillId: null },
    ],
  },
  'zhang-fei': {
    slots: [
      { name: '當陽怒吼', description: '震退前方敵軍並附加 1 回合暈眩。', scalingStat: 'str', inheritanceGeneId: 'gene_shout', battleSkillId: 'zhang-fei-roar' },
      { name: '萬夫莫敵', description: '自身攻擊與暴擊率大幅提升 2 回合。', scalingStat: 'str', inheritanceGeneId: 'gene_bravery', battleSkillId: null },
      { name: '蛇矛裂陣', description: '對直線敵軍連續穿刺 3 次，逐段增傷。', scalingStat: 'str', inheritanceGeneId: 'gene_charge', battleSkillId: null },
      { name: '燕人威喝', description: '範圍敵軍攻擊下降，並降低行動條。', scalingStat: 'cha', inheritanceGeneId: 'gene_overpower', battleSkillId: null },
      { name: '長坂戰神', description: '進入無雙狀態，免疫控制並對周遭敵軍持續造成震盪傷害。', scalingStat: 'str', inheritanceGeneId: 'gene_hidden_01', battleSkillId: 'zhang-fei-roar' },
    ],
  },
  'sima-yi': {
    slots: [
      { name: '狼顧之相', description: '揭露敵方最弱點，對其造成的傷害提升 35%。', scalingStat: 'int', inheritanceGeneId: 'gene_strategy', battleSkillId: null },
      { name: '韜光養晦', description: '自身隱匿 1 回合，並在現身時回滿 SP。', scalingStat: 'int', inheritanceGeneId: 'gene_politics', battleSkillId: null },
      { name: '反間奪心', description: '使 1 名敵將倒戈 2 回合，並降低周遭敵軍忠誠。', scalingStat: 'int', inheritanceGeneId: 'gene_strategy', battleSkillId: null },
      { name: '高平陵變', description: '立即清除敵方全體增益，並轉化為我方護盾。', scalingStat: 'pol', inheritanceGeneId: 'gene_command', battleSkillId: null },
      { name: '晉基初奠', description: '全軍獲得持續 3 回合的智傷與減傷雙重加成。', scalingStat: 'pol', inheritanceGeneId: 'gene_hidden_05', battleSkillId: null },
    ],
  },
  'guo-jia': {
    slots: [
      { name: '鬼謀先機', description: '戰鬥開始後立即偷取敵方 20% 行動條。', scalingStat: 'int', inheritanceGeneId: 'gene_strategy', battleSkillId: null },
      { name: '十勝定論', description: '我軍全體對 debuff 目標增傷 30%。', scalingStat: 'int', inheritanceGeneId: 'gene_command', battleSkillId: null },
      { name: '奇策連環', description: '隨機對 3 名敵軍施加不同減益並延長 1 回合。', scalingStat: 'int', inheritanceGeneId: 'gene_strategy', battleSkillId: null },
      { name: '遺計定北', description: '自身退場時仍可對敵方後排發動一次計略轟擊。', scalingStat: 'lea', inheritanceGeneId: 'gene_guard', battleSkillId: null },
      { name: '奉孝天機', description: '看破敵軍未來 2 回合行動並對全體施加崩解。', scalingStat: 'int', inheritanceGeneId: 'gene_hidden_05', battleSkillId: null },
    ],
  },
  'cao-zhi': {
    slots: [
      { name: '七步成章', description: '以文氣震懾敵軍，造成範圍智力傷害。', scalingStat: 'int', inheritanceGeneId: 'gene_strategy', battleSkillId: null },
      { name: '洛神賦影', description: '自身閃避率提升並魅惑最近敵軍 1 回合。', scalingStat: 'cha', inheritanceGeneId: 'gene_honor', battleSkillId: null },
      { name: '建安風骨', description: '我軍全體抗性提升，並移除 1 個負面狀態。', scalingStat: 'cha', inheritanceGeneId: 'gene_politics', battleSkillId: null },
      { name: '才華橫溢', description: '連續施放 2 次低耗計略，第二次必定暴擊。', scalingStat: 'int', inheritanceGeneId: 'gene_strategy', battleSkillId: null },
      { name: '魂筆驚世', description: '全場敵軍陷入失神，並承受高額精神傷害。', scalingStat: 'int', inheritanceGeneId: 'gene_hidden_05', battleSkillId: null },
    ],
  },
  'diao-chan': {
    slots: [
      { name: '閉月傾城', description: '魅惑前排敵軍，使其攻擊友軍機率下降。', scalingStat: 'cha', inheritanceGeneId: 'gene_honor', battleSkillId: null },
      { name: '連環離間', description: '令 2 名敵將互相標記，彼此承受共享傷害。', scalingStat: 'int', inheritanceGeneId: 'gene_strategy', battleSkillId: null },
      { name: '貂影惑心', description: '大幅降低敵方命中與暴擊，持續 2 回合。', scalingStat: 'cha', inheritanceGeneId: 'gene_dash', battleSkillId: null },
      { name: '紅顏絕計', description: '吸取敵方最高攻單位 30% 攻擊轉為自身護盾。', scalingStat: 'cha', inheritanceGeneId: 'gene_guard', battleSkillId: null },
      { name: '傾國斷魂', description: '全體敵軍陷入魅惑與沉默，並附加持續精神傷害。', scalingStat: 'cha', inheritanceGeneId: 'gene_hidden_05', battleSkillId: null },
    ],
  },
};

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function deriveTemplateId(general) {
  const faction = String(general.faction || 'qun').toUpperCase();
  return `GEN_${faction}_${general.id.replace(/-/g, '_').toUpperCase()}`;
}

function buildEntries(generalId, profile, templateId) {
  return profile.slots.map((slotDef, index) => {
    const slot = index + 1;
    return {
      id: `ult-${generalId}-${slot}`,
      templateId,
      slot,
      name: slotDef.name,
      description: slotDef.description,
      unlockReincarnation: slot,
      vitalityCostPct: SLOT_COSTS[slot],
      scalingStat: slotDef.scalingStat,
      exclusive: true,
      inheritanceGeneId: slotDef.inheritanceGeneId,
      battleSkillId: slotDef.battleSkillId ?? null,
    };
  });
}

function sortEntries(entries) {
  return entries.slice().sort((a, b) => {
    if (a.templateId !== b.templateId) return a.templateId.localeCompare(b.templateId);
    return a.slot - b.slot;
  });
}

const baseObj = loadJson(BASE_PATH);
const ultimatesObj = loadJson(ULTIMATES_PATH);
const generals = Array.isArray(baseObj.data) ? baseObj.data : [];
const existing = Array.isArray(ultimatesObj.data) ? ultimatesObj.data.slice() : [];

let result = existing.slice();
let inserted = 0;
let replaced = 0;
let skipped = 0;

for (const [generalId, profile] of Object.entries(PROFILE_MAP)) {
  const general = generals.find(item => item.id === generalId);
  if (!general) {
    console.warn(`[generate-ultimate-definitions] 找不到武將：${generalId}`);
    continue;
  }

  const templateId = deriveTemplateId(general);
  const generated = buildEntries(generalId, profile, templateId);
  const existingForTemplate = result.filter(item => item.templateId === templateId);

  if (existingForTemplate.length > 0 && !FORCE) {
    skipped++;
    continue;
  }

  if (existingForTemplate.length > 0) {
    result = result.filter(item => item.templateId !== templateId);
    replaced += existingForTemplate.length;
  }

  result.push(...generated);
  inserted += generated.length;
}

result = sortEntries(result);

if (!DRY_RUN) {
  const coveredTemplates = new Set(result.map(item => item.templateId));
  ultimatesObj.updatedAt = new Date().toISOString().slice(0, 10);
  ultimatesObj.description = `M1-E 個人奧義 canonical definitions。已覆蓋 ${coveredTemplates.size} 位高階名將。`;
  ultimatesObj.data = result;
  fs.writeFileSync(ULTIMATES_PATH, JSON.stringify(ultimatesObj, null, 2), 'utf-8');
}

console.log(
  `[generate-ultimate-definitions] 完成${DRY_RUN ? ' [DRY-RUN]' : ''}。` +
  `inserted=${inserted} replaced=${replaced} skipped=${skipped} total=${result.length}`
);