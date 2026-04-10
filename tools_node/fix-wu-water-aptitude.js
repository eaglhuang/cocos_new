/**
 * fix-wu-water-aptitude.js
 * 修正 13 名吳將缺少水系/水軍適性的問題。
 *
 * 修正邏輯：
 * 1. 戰鬥型吳將（9 人）：  troopAptitude.NAVY → A
 *                         terrainAptitude.WATER → A
 * 2. 女將 / 支援型（4 人）：terrainAptitude.RIVER → A
 * 3. A/S 預算控制：若新增後總 A/S 超出 tier 上限，將現有最低 A 降為 B
 *
 * 用法：
 *   node tools_node/fix-wu-water-aptitude.js           # dry-run
 *   node tools_node/fix-wu-water-aptitude.js --apply   # 寫入檔案
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const RUNTIME_PATH = path.join(__dirname, '../assets/resources/data/generals.json');
const MASTER_PATH  = path.join(__dirname, '../assets/resources/data/master/generals-base.json');

const APPLY = process.argv.includes('--apply');

// ──────────────────────────────────────────────────────────────────────────────
// 設定
// ──────────────────────────────────────────────────────────────────────────────

/** 戰鬥型：升 NAVY + WATER */
const COMBAT_WU = [
  'sun-quan', 'zhou-yu', 'taishi-ci', 'gan-ning',
  'zhou-tai', 'sun-ce', 'sun-jian', 'lu-su', 'chen-wu',
];

/** 女將/支援型：升 RIVER */
const SUPPORT_WU = ['da-qiao', 'sun-shang-xiang', 'sun-lu-ban', 'sun-lu-yu'];

const ALL_WU = new Set([...COMBAT_WU, ...SUPPORT_WU]);

/** 各 tier 的 A/S 總Budget（troop+terrain+weather 合計） */
function tierAsBudget(tier) {
  switch (tier) {
    case 'common':    return 1;
    case 'rare':      return 2;
    case 'epic':      return 3;
    case 'legendary': return 4;
    case 'mythic':    return 99;
    default:          return 3;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 輔助
// ──────────────────────────────────────────────────────────────────────────────

function countAs(g) {
  let n = 0;
  for (const block of ['troopAptitude', 'terrainAptitude', 'weatherAptitude']) {
    const b = g[block] ?? {};
    for (const v of Object.values(b)) {
      if (v === 'A' || v === 'S') n++;
    }
  }
  return n;
}

/** 若 A/S 超出預算，把全局最低的 A 降為 B（S 不降）。重複直到合法。 */
function enforceAsBudget(g) {
  const budget = tierAsBudget(g.rarityTier ?? 'epic');
  while (countAs(g) > budget) {
    // 找所有 A grade（不降 S）：從 weather → terrain → troop 優先降
    let downgraded = false;
    for (const block of ['weatherAptitude', 'terrainAptitude', 'troopAptitude']) {
      const b = g[block] ?? {};
      for (const [k, v] of Object.entries(b)) {
        if (v === 'A') {
          g[block][k] = 'B';
          downgraded = true;
          break;
        }
      }
      if (downgraded) break;
    }
    if (!downgraded) break; // only S grades remain, stop
  }
}

function setGrade(g, blockKey, fieldKey, grade) {
  if (!g[blockKey]) g[blockKey] = {};
  g[blockKey][fieldKey] = grade;
}

// ──────────────────────────────────────────────────────────────────────────────
// 主體
// ──────────────────────────────────────────────────────────────────────────────

function applyFix(arr, label) {
  const log = [];

  for (const g of arr) {
    if (!ALL_WU.has(g.id)) continue;

    const changes = [];
    const before = JSON.stringify({
      troop: g.troopAptitude,
      terrain: g.terrainAptitude,
    });

    if (COMBAT_WU.includes(g.id)) {
      // NAVY → A（如已是 A/S 則不動）
      const navyNow = g.troopAptitude?.NAVY;
      if (navyNow !== 'A' && navyNow !== 'S') {
        setGrade(g, 'troopAptitude', 'NAVY', 'A');
        changes.push('NAVY: ' + (navyNow ?? 'undefined') + '→A');
      }
      // WATER → A
      const waterNow = g.terrainAptitude?.WATER;
      if (waterNow !== 'A' && waterNow !== 'S') {
        setGrade(g, 'terrainAptitude', 'WATER', 'A');
        changes.push('WATER: ' + (waterNow ?? 'undefined') + '→A');
      }
    } else {
      // RIVER → A
      const riverNow = g.terrainAptitude?.RIVER;
      if (riverNow !== 'A' && riverNow !== 'S') {
        setGrade(g, 'terrainAptitude', 'RIVER', 'A');
        changes.push('RIVER: ' + (riverNow ?? 'undefined') + '→A');
      }
    }

    if (changes.length === 0) continue;

    // 預算控制：降最低 A 直到合法
    const beforeAs = countAs(g) - changes.length; // rough
    enforceAsBudget(g);
    const afterAs  = countAs(g);

    const after = JSON.stringify({
      troop: g.troopAptitude,
      terrain: g.terrainAptitude,
    });

    log.push({
      id:      g.id,
      name:    g.name,
      tier:    g.rarityTier,
      changes: changes.join(' | '),
      totalAs: afterAs,
      budget:  tierAsBudget(g.rarityTier),
    });
  }

  return log;
}

const runtimeArr  = JSON.parse(fs.readFileSync(RUNTIME_PATH, 'utf8'));
const masterObj   = JSON.parse(fs.readFileSync(MASTER_PATH, 'utf8'));

// 對 runtime 執行修正
const runtimeLog = applyFix(runtimeArr, 'runtime');

// 對 master.data 執行修正（用相同邏輯）
const masterLog  = applyFix(masterObj.data, 'master');

// 印出報告
console.log(`\n[fix-wu-water-aptitude] 模式: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
console.log(`[fix-wu-water-aptitude] runtime 修正 ${runtimeLog.length} 筆，master 修正 ${masterLog.length} 筆\n`);

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('id', 22) + pad('名稱', 16) + pad('tier', 12) + pad('budget/as', 12) + '異動');
console.log('─'.repeat(100));
runtimeLog.forEach(r => {
  console.log(
    pad(r.id, 22) +
    pad(r.name, 16) +
    pad(r.tier, 12) +
    pad(r.totalAs + '/' + r.budget, 12) +
    r.changes
  );
});

if (!APPLY) {
  console.log('\n[fix-wu-water-aptitude] dry-run 完成。加 --apply 參數以寫入。');
  process.exit(0);
}

// 寫入 runtime
fs.writeFileSync(RUNTIME_PATH, JSON.stringify(runtimeArr, null, 2), 'utf8');
console.log(`\n[fix-wu-water-aptitude] ✅ generals.json 已更新`);

// 寫入 master
masterObj.updatedAt = new Date().toISOString().slice(0, 10);
fs.writeFileSync(MASTER_PATH, JSON.stringify(masterObj, null, 2), 'utf8');
console.log(`[fix-wu-water-aptitude] ✅ master/generals-base.json 已更新`);
console.log('[fix-wu-water-aptitude] 完成。');
