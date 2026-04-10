/**
 * fix-ep-recalc.js
 * 重算全量武將的 ep 與 epRating，修正屬性調整後未同步的落差。
 *
 * 公式（與 classify-generals-master.js 一致）：
 *   avg5   = avg(str, int, lea, pol, cha)       ← luk 排除
 *   maxStat = max(str, int, lea, pol, cha)
 *   ep      = round(avg5 * 0.8 + maxStat * 0.2)
 *   epRating = 依門檻對照表
 *
 * 用法：
 *   node tools_node/fix-ep-recalc.js           # dry-run：只顯示差異
 *   node tools_node/fix-ep-recalc.js --apply   # 實際寫入兩個檔案
 *
 * 輸出：
 *   - 印出所有 |delta| >= 1 的武將清單
 *   - --apply 時同時更新 generals.json 與 master/generals-base.json
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const RUNTIME_PATH = path.join(__dirname, '../assets/resources/data/generals.json');
const MASTER_PATH  = path.join(__dirname, '../assets/resources/data/master/generals-base.json');

const APPLY = process.argv.includes('--apply');

// ──────────────────────────────────────────────────────────────────────────────
// 公式
// ──────────────────────────────────────────────────────────────────────────────
function calcEpBase(g) {
  const stats  = [g.str ?? 0, g.int ?? 0, g.lea ?? 0, g.pol ?? 0, g.cha ?? 0];
  const avg5   = stats.reduce((s, v) => s + v, 0) / stats.length;
  const maxStat = Math.max(...stats);
  return Math.round(avg5 * 0.8 + maxStat * 0.2);
}

function calcEpRating(ep) {
  if (ep >= 90) return 'S+';
  if (ep >= 85) return 'S';
  if (ep >= 80) return 'S-';
  if (ep >= 75) return 'A+';
  if (ep >= 70) return 'A';
  if (ep >= 65) return 'A-';
  if (ep >= 60) return 'B+';
  if (ep >= 55) return 'B';
  return 'C';
}

// ──────────────────────────────────────────────────────────────────────────────
// 主體
// ──────────────────────────────────────────────────────────────────────────────
const runtimeRaw   = fs.readFileSync(RUNTIME_PATH, 'utf8');
const runtimeArr   = JSON.parse(runtimeRaw);           // plain array

const masterRaw    = fs.readFileSync(MASTER_PATH, 'utf8');
const masterObj    = JSON.parse(masterRaw);            // { version, updatedAt, data: [] }
const masterMap    = new Map(masterObj.data.map(g => [g.id, g]));

const changes = [];
let deltaGe5 = 0;

for (const g of runtimeArr) {
  const newEp     = calcEpBase(g);
  const newRating = calcEpRating(newEp);
  const oldEp     = g.ep     ?? 0;
  const oldRating = g.epRating ?? '';
  const delta     = newEp - oldEp;

  if (Math.abs(delta) >= 1 || newRating !== oldRating) {
    changes.push({
      id:        g.id,
      name:      g.name,
      oldEp,
      newEp,
      delta,
      oldRating,
      newRating,
      tier:      g.rarityTier ?? '—',
    });
    if (Math.abs(delta) >= 5) deltaGe5++;
  }
}

// 印出清單
console.log(`\n[fix-ep-recalc] 模式: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
console.log(`[fix-ep-recalc] 共 ${changes.length} 筆有差異（|delta|≥5 共 ${deltaGe5} 筆）\n`);

// 排序：delta 最大的在前
changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

const header  = ['#', 'id', '名稱', 'tier', 'oldEP', 'newEP', 'Δ', 'oldRating', 'newRating'];
const pad = (s, n) => String(s).padEnd(n);
console.log(
  pad('#', 4) +
  pad('id', 25) +
  pad('名稱', 14) +
  pad('tier', 12) +
  pad('oldEP', 8) +
  pad('newEP', 8) +
  pad('Δ', 6) +
  pad('舊 Rating', 12) +
  '新 Rating'
);
console.log('─'.repeat(100));

changes.forEach((c, i) => {
  const sign = c.delta > 0 ? '+' : '';
  console.log(
    pad(i + 1, 4) +
    pad(c.id, 25) +
    pad(c.name, 14) +
    pad(c.tier, 12) +
    pad(c.oldEp, 8) +
    pad(c.newEp, 8) +
    pad(sign + c.delta, 6) +
    pad(c.oldRating, 12) +
    c.newRating
  );
});

if (!APPLY) {
  console.log('\n[fix-ep-recalc] dry-run 完成。加 --apply 參數以寫入檔案。');
  process.exit(0);
}

// ──────────────────────────────────────────────────────────────────────────────
// 寫入 runtime
// ──────────────────────────────────────────────────────────────────────────────
const changeSet = new Set(changes.map(c => c.id));

for (const g of runtimeArr) {
  if (!changeSet.has(g.id)) continue;
  g.ep       = calcEpBase(g);
  g.epRating = calcEpRating(g.ep);
}

fs.writeFileSync(RUNTIME_PATH, JSON.stringify(runtimeArr, null, 2), 'utf8');
console.log(`\n[fix-ep-recalc] ✅ generals.json 已更新（${changes.length} 筆）`);

// ──────────────────────────────────────────────────────────────────────────────
// 寫入 master
// ──────────────────────────────────────────────────────────────────────────────
let masterUpdated = 0;
for (const g of masterObj.data) {
  if (!changeSet.has(g.id)) continue;
  g.ep       = calcEpBase(g);
  g.epRating = calcEpRating(g.ep);
  masterUpdated++;
}
masterObj.updatedAt = new Date().toISOString().slice(0, 10);

fs.writeFileSync(MASTER_PATH, JSON.stringify(masterObj, null, 2), 'utf8');
console.log(`[fix-ep-recalc] ✅ master/generals-base.json 已更新（${masterUpdated} 筆）`);
console.log('[fix-ep-recalc] 完成。');
