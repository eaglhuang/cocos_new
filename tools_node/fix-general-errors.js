/**
 * fix-general-errors.js
 * 修正 generals-base.json 中的名稱錯誤、重複條目、ID 錯誤
 * 根據 Wikipedia 三國演義角色列表 + 靜態分析交叉比對結果
 *
 * 修正清單：
 * 1. ID 79 cao-zhang  名稱 曹璋→曹彰 (正確字符)
 * 2. ID 25 cao-cao-junior 替換為 曹昂 cao-ang (ID 25 原為重複 曹彰)
 * 3. ID 57 cao-cao-zhi 替換為 曹休 cao-xiu (原為重複 曹植)
 * 4. ID 56 id cao-cao-pi → cao-pi (更正 ID 格式，名稱 曹丕 不變)
 * 5. ID 149 peng-yong  替換為 霍弋 huo-yi (原為重複 彭羕)
 * 6. ID 162 zhang-bao-shu 替換為 馬良 ma-liang (原為重複 張苞)
 * 7. ID 100 quan-zong  替換為 陸抗 lu-kang (原為重複 全琮)
 * 8. ID 194 hua-ge 替換為 潘浚 pan-jun (滑蓋根本不存在，黃蓋已在 ID 32)
 * 9. ID 155 id gong-yan → gou-fu (句扶拼音更正)
 * 10. ID 102 id lu-dai → lu-yin (陸胤拼音更正)
 * 11. ID 103 zheng-bing/鄭秉 → 程秉 cheng-bing (吳國儒學官員)
 * 12. ID 196 jing-biao/景表 → 呂凱 lv-kai (蜀漢官員，景表並非三國人物)
 * 13. 調整一批 Support 文官的屬性，避免武力高於智政成為主屬性
 * 14. ID 154 chen-shou-shu/陳壽（蜀） → 蔣琬 jiang-wan (更典型蜀漢重臣)
 * 15. 針對魏 / 蜀 / 吳核心名將與二三線角色做 faction 內強度階梯校正
 */

'use strict';

const fs = require('fs');
const path = require('path');

const MASTER_PATH = path.join(__dirname, '../assets/resources/data/master/generals-base.json');

// 輔助：產生 ancestor_chain
function makeAncestorChain(id, count = 14) {
  const key = id.toUpperCase().replace(/-/g, '_');
  return Array.from({ length: count }, (_, i) => `VIRT_${key}_${String(i + 1).padStart(2, '0')}`);
}

// 輔助：計算 ep (六項均值)
function calcEP(s) {
  return Math.round((s.str + s.int + s.lea + s.pol + s.cha + s.luk) / 6);
}

// 輔助：計算 epRating
function calcEPRating(ep) {
  if (ep >= 82) return 'S';
  if (ep >= 74) return 'A+';
  if (ep >= 68) return 'A';
  if (ep >= 65) return 'A-';
  if (ep >= 56) return 'B+';
  if (ep >= 54) return 'B';
  if (ep >= 52) return 'B-';
  if (ep >= 48) return 'C+';
  if (ep >= 44) return 'C';
  return 'C-';
}

function applyStatRebalance(g, stats) {
  Object.assign(g, stats);
  g.ep = calcEP(g);
  g.epRating = calcEPRating(g.ep);
}

// 建立替換角色的完整資料
function buildReplacement(spec, existingEntry) {
  const stats = { str: spec.str, int: spec.int, lea: spec.lea, pol: spec.pol, cha: spec.cha, luk: spec.luk };
  const ep = calcEP(stats);
  return {
    id: spec.id,
    name: spec.name,
    faction: spec.faction,
    ...stats,
    ep,
    gender: spec.gender || '男',
    role: spec.role || 'Combat',
    rarityTier: spec.rarityTier || 'rare',
    characterCategory: spec.characterCategory || 'general',
    epRating: calcEPRating(ep),
    ancestor_chain: makeAncestorChain(spec.id)
  };
}

const RAW = fs.readFileSync(MASTER_PATH, 'utf8');
const masterData = JSON.parse(RAW);
const generals = masterData.data;

const log = [];

// ================================================================
// 修正 1: ID 79 — 名稱 曹璋 → 曹彰 (字符錯誤，拼音相同)
// ================================================================
{
  const g = generals[79];
  if (g.id === 'cao-zhang' && g.name === '曹璋') {
    log.push('[FIX-1] ID 79 cao-zhang: 曹璋 → 曹彰');
    g.name = '曹彰';
  } else {
    log.push('[SKIP-1] ID 79 狀態非預期: ' + g.id + ' ' + g.name);
  }
}

// ================================================================
// 修正 2: ID 25 — cao-cao-junior/曹彰 → 曹昂 (ID 79 已有正確 曹彰)
// 曹昂，曹操長子，宛城之戰護父犧牲
// ================================================================
{
  const g = generals[25];
  if (g.id === 'cao-cao-junior') {
    log.push('[FIX-2] ID 25 cao-cao-junior → 曹昂 cao-ang');
    Object.assign(g, buildReplacement({
      id: 'cao-ang', name: '曹昂', faction: 'wei',
      str: 62, int: 68, lea: 64, pol: 72, cha: 75, luk: 58,
      role: 'Support', rarityTier: 'epic', characterCategory: 'official'
    }, g));
  } else {
    log.push('[SKIP-2] ID 25 狀態非預期: ' + g.id);
  }
}

// ================================================================
// 修正 3: ID 57 — cao-cao-zhi/曹植 (重複) → 曹休 cao-xiu
// 曹休，曹操族孫，魏國東線大將，石亭之戰被陸遜大敗
// ================================================================
{
  const g = generals[57];
  if (g.id === 'cao-cao-zhi') {
    log.push('[FIX-3] ID 57 cao-cao-zhi (重複曹植) → 曹休 cao-xiu');
    Object.assign(g, buildReplacement({
      id: 'cao-xiu', name: '曹休', faction: 'wei',
      str: 74, int: 60, lea: 75, pol: 62, cha: 67, luk: 55,
      role: 'Combat', rarityTier: 'epic', characterCategory: 'general'
    }, g));
  } else {
    log.push('[SKIP-3] ID 57 狀態非預期: ' + g.id);
  }
}

// ================================================================
// 修正 4: ID 56 — ID cao-cao-pi → cao-pi (名稱 曹丕 不變)
// ================================================================
{
  const g = generals[56];
  if (g.id === 'cao-cao-pi' && g.name === '曹丕') {
    log.push('[FIX-4] ID 56: id cao-cao-pi → cao-pi');
    g.id = 'cao-pi';
  } else {
    log.push('[SKIP-4] ID 56 狀態非預期: ' + g.id + ' ' + g.name);
  }
}

// ================================================================
// 修正 5: ID 149 — peng-yong/彭羕 (重複) → 霍弋 huo-yi
// 霍弋，霍峻之子，蜀漢末年忠義守南中之將
// ================================================================
{
  const g = generals[149];
  if (g.id === 'peng-yong') {
    log.push('[FIX-5] ID 149 peng-yong (重複彭羕) → 霍弋 huo-yi');
    Object.assign(g, buildReplacement({
      id: 'huo-yi', name: '霍弋', faction: 'shu',
      str: 67, int: 65, lea: 68, pol: 62, cha: 64, luk: 66,
      role: 'Combat', rarityTier: 'rare', characterCategory: 'general'
    }, g));
  } else {
    log.push('[SKIP-5] ID 149 狀態非預期: ' + g.id);
  }
}

// ================================================================
// 修正 6: ID 162 — zhang-bao-shu/張苞 (重複) → 馬良 ma-liang
// 馬良，白眉馬良，蜀漢重要謀士，馬謖兄長，夷陵之戰前陣亡
// ================================================================
{
  const g = generals[162];
  if (g.id === 'zhang-bao-shu') {
    log.push('[FIX-6] ID 162 zhang-bao-shu (重複張苞) → 馬良 ma-liang');
    Object.assign(g, buildReplacement({
      id: 'ma-liang', name: '馬良', faction: 'shu',
      str: 54, int: 80, lea: 60, pol: 78, cha: 76, luk: 60,
      role: 'Advisor', rarityTier: 'epic', characterCategory: 'advisor'
    }, g));
  } else {
    log.push('[SKIP-6] ID 162 狀態非預期: ' + g.id);
  }
}

// ================================================================
// 修正 7: ID 100 — quan-zong/全琮 (重複) → 陸抗 lu-kang
// 陸抗，陸遜之子，吳國末期最強統帥，與羊祜並稱
// ================================================================
{
  const g = generals[100];
  if (g.id === 'quan-zong') {
    log.push('[FIX-7] ID 100 quan-zong (重複全琮) → 陸抗 lu-kang');
    Object.assign(g, buildReplacement({
      id: 'lu-kang', name: '陸抗', faction: 'wu',
      str: 72, int: 82, lea: 80, pol: 72, cha: 74, luk: 70,
      role: 'Combat', rarityTier: 'legendary', characterCategory: 'general'
    }, g));
  } else {
    log.push('[SKIP-7] ID 100 狀態非預期: ' + g.id);
  }
}

// ================================================================
// 修正 8: ID 194 — hua-ge/滑蓋 (虛構人物) → 潘浚 pan-jun
// 潘浚，協助孫吳控制荊州的要員，嚴明執法，殺盡蠻夷
// ================================================================
{
  const g = generals[194];
  if (g.id === 'hua-ge') {
    log.push('[FIX-8] ID 194 hua-ge (虛構滑蓋) → 潘浚 pan-jun');
    Object.assign(g, buildReplacement({
      id: 'pan-jun', name: '潘浚', faction: 'wu',
      str: 64, int: 72, lea: 68, pol: 76, cha: 64, luk: 62,
      role: 'Support', rarityTier: 'rare', characterCategory: 'official'
    }, g));
  } else {
    log.push('[SKIP-8] ID 194 狀態非預期: ' + g.id);
  }
}

// ================================================================
// 修正 9: ID 155 — id gong-yan → gou-fu (句扶拼音)
// 句扶，蜀漢武將，句讀音 gōu，非 gōng
// ================================================================
{
  const g = generals[155];
  if (g.id === 'gong-yan' && g.name === '句扶') {
    log.push('[FIX-9] ID 155: id gong-yan → gou-fu (句扶拼音更正)');
    g.id = 'gou-fu';
  } else {
    log.push('[SKIP-9] ID 155 狀態非預期: ' + g.id + ' ' + g.name);
  }
}

// ================================================================
// 修正 10: ID 102 — id lu-dai → lu-yin (陸胤拼音)
// 陸胤，吳將，胤讀音 yìn，非 dài
// ================================================================
{
  const g = generals[102];
  if (g.id === 'lu-dai' && g.name === '陸胤') {
    log.push('[FIX-10] ID 102: id lu-dai → lu-yin (陸胤拼音更正)');
    g.id = 'lu-yin';
  } else {
    log.push('[SKIP-10] ID 102 狀態非預期: ' + g.id + ' ' + g.name);
  }
}

// ================================================================
// 修正 11: ID 103 — 鄭秉/zheng-bing → 程秉/cheng-bing
// 第二來源交叉比對後確認吳國對應人物應為程秉，為東吳官員、儒學學者
// ================================================================
{
  const g = generals[103];
  if (g.id === 'zheng-bing') {
    log.push('[FIX-11] ID 103 zheng-bing (錯名) → 程秉 cheng-bing');
    Object.assign(g, buildReplacement({
      id: 'cheng-bing', name: '程秉', faction: 'wu',
      str: 24, int: 82, lea: 52, pol: 80, cha: 68, luk: 62,
      role: 'Support', rarityTier: 'rare', characterCategory: 'civilian'
    }, g));
  } else {
    log.push('[SKIP-11] ID 103 狀態非預期: ' + g.id);
  }
}

// ================================================================
// 修正 12: ID 196 — 景表/jing-biao → 呂凱/lv-kai
// 第二來源顯示景表是日影儀器，不是三國人物；改為蜀漢官員呂凱
// ================================================================
{
  const g = generals[196];
  if (g.id === 'jing-biao') {
    log.push('[FIX-12] ID 196 jing-biao (非人物) → 呂凱 lv-kai');
    Object.assign(g, buildReplacement({
      id: 'lv-kai', name: '呂凱', faction: 'shu',
      str: 42, int: 76, lea: 66, pol: 80, cha: 74, luk: 62,
      role: 'Support', rarityTier: 'rare', characterCategory: 'civilian'
    }, g));
  } else {
    log.push('[SKIP-12] ID 196 狀態非預期: ' + g.id);
  }
}

// ================================================================
// 修正 13: Support 文官屬性校正
// 目標：避免文官把武力當成主屬性，改回以智略 / 政治 / 魅力為主
// ================================================================
{
  const supportRebalances = {
    'pang-tong': { str: 32, int: 92, lea: 72, pol: 84, cha: 82 },
    'jia-xu': { str: 30, int: 94, lea: 76, pol: 82, cha: 72 },
    'xun-you': { str: 28, int: 90, lea: 74, pol: 83, cha: 72 },
    'dong-zhao': { str: 31, int: 84, lea: 70, pol: 80, cha: 68 },
    'xi-zhi-cai': { str: 27, int: 88, lea: 74, pol: 80, cha: 66 },
    'fei-yi': { str: 34, int: 85, lea: 76, pol: 84, cha: 82 },
    'peng-yang': { str: 38, int: 76, lea: 58, pol: 68, cha: 74 },
    'sun-qian': { str: 32, int: 78, lea: 65, pol: 76, cha: 80 },
    'kong-rong': { str: 26, int: 79, lea: 48, pol: 82, cha: 76 },
    'yin-mo': { str: 22, int: 82, lea: 52, pol: 80, cha: 68 },
    'ju-shou': { str: 28, int: 87, lea: 71, pol: 84, cha: 68 },
    'tian-feng': { str: 24, int: 86, lea: 70, pol: 80, cha: 66 },
    'guo-tu': { str: 22, int: 74, lea: 60, pol: 68, cha: 58 },
    'shen-pei': { str: 40, int: 73, lea: 68, pol: 75, cha: 62 },
    'zhang-jue': { str: 42, int: 84, lea: 72, pol: 60, cha: 74 },
    'liu-biao': { str: 44, int: 74, lea: 69, pol: 78, cha: 80 },
    'huang-quan': { str: 46, int: 78, lea: 75, pol: 74, cha: 70 },
    'wang-lang': { str: 28, int: 78, lea: 52, pol: 84, cha: 70 },
    'liu-ye': { str: 36, int: 86, lea: 78, pol: 78, cha: 68 },
    'xun-yu': { str: 32, int: 92, lea: 76, pol: 88, cha: 82 },
    'zhong-hui': { str: 52, int: 88, lea: 79, pol: 76, cha: 72 },
    'chen-qun': { str: 30, int: 80, lea: 62, pol: 90, cha: 76 },
    'lu-xun': { str: 55, int: 86, lea: 92, pol: 78, cha: 76 }
  };

  for (const [id, stats] of Object.entries(supportRebalances)) {
    const g = generals.find(entry => entry.id === id);
    if (!g) {
      log.push('[SKIP-13] 找不到 ' + id);
      continue;
    }
    applyStatRebalance(g, stats);
    log.push('[FIX-13] Support 校正: ' + g.id + ' / ' + g.name);
  }
}

// ================================================================
// 修正 14: ID 154 — 陳壽（蜀）/chen-shou-shu → 蔣琬/jiang-wan
// 以更典型的蜀漢執政重臣取代史家角色
// ================================================================
{
  const g = generals[154];
  if (g.id === 'chen-shou-shu') {
    log.push('[FIX-14] ID 154 chen-shou-shu → 蔣琬 jiang-wan');
    Object.assign(g, buildReplacement({
      id: 'jiang-wan', name: '蔣琬', faction: 'shu',
      str: 28, int: 90, lea: 80, pol: 92, cha: 84, luk: 70,
      role: 'Support', rarityTier: 'epic', characterCategory: 'famed'
    }, g));
  } else {
    log.push('[SKIP-14] ID 154 狀態非預期: ' + g.id);
  }
}

// ================================================================
// 修正 15: faction 內強度階梯校正
// 目標：核心名將穩定高於二三線角色，避免各陣營內部排序失真
// ================================================================
{
  const factionLadderRebalances = {
    'zhang-liao': { str: 78, int: 70, lea: 84, pol: 66, cha: 74, luk: 64 },
    'xiahou-dun': { str: 74, int: 66, lea: 80, pol: 70, cha: 72, luk: 58 },
    'xiahou-yuan': { str: 78, int: 66, lea: 81, pol: 66, cha: 74, luk: 64 },
    'xu-zhu': { str: 90, int: 55, lea: 80, pol: 46, cha: 74, luk: 63 },
    'guo-jia': { str: 26, int: 96, lea: 84, pol: 82, cha: 80, luk: 56 },
    'cao-ren': { str: 78, int: 68, lea: 84, pol: 74, cha: 72, luk: 59 },
    'dian-wei': { str: 94, int: 52, lea: 82, pol: 46, cha: 78, luk: 60 },
    'zhang-he': { str: 76, int: 70, lea: 82, pol: 72, cha: 74, luk: 58 },
    'wang-shuang': { str: 74, int: 58, lea: 72, pol: 56, cha: 64, luk: 62 },
    'ma-chao': { str: 89, int: 68, lea: 84, pol: 62, cha: 80, luk: 58 },
    'huang-zhong': { str: 86, int: 64, lea: 82, pol: 60, cha: 74, luk: 66 },
    'jiang-wei': { str: 78, int: 84, lea: 82, pol: 66, cha: 76, luk: 65 },
    'wei-yan': { str: 78, int: 70, lea: 82, pol: 58, cha: 72, luk: 59 },
    'liu-feng': { str: 68, int: 60, lea: 64, pol: 58, cha: 68, luk: 64 },
    'zhang-bao': { str: 70, int: 62, lea: 66, pol: 56, cha: 68, luk: 61 },
    'sun-ce': { str: 86, int: 72, lea: 82, pol: 68, cha: 84, luk: 64 },
    'sun-jian': { str: 80, int: 70, lea: 78, pol: 66, cha: 78, luk: 63 },
    'lu-meng': { str: 70, int: 82, lea: 80, pol: 74, cha: 76, luk: 67 },
    'lu-su': { str: 40, int: 88, lea: 80, pol: 84, cha: 84, luk: 60 },
    'taishi-ci': { str: 86, int: 66, lea: 82, pol: 60, cha: 76, luk: 60 },
    'gan-ning': { str: 84, int: 62, lea: 78, pol: 60, cha: 76, luk: 67 },
    'zhou-tai': { str: 82, int: 58, lea: 78, pol: 54, cha: 72, luk: 65 },
    'cheng-pu': { str: 76, int: 68, lea: 78, pol: 68, cha: 72, luk: 58 },
    'huang-gai': { str: 74, int: 70, lea: 76, pol: 68, cha: 74, luk: 66 },
    'sun-huan': { str: 60, int: 68, lea: 66, pol: 62, cha: 68, luk: 64 }
  };

  for (const [id, stats] of Object.entries(factionLadderRebalances)) {
    const g = generals.find(entry => entry.id === id);
    if (!g) {
      log.push('[SKIP-15] 找不到 ' + id);
      continue;
    }
    applyStatRebalance(g, stats);
    log.push('[FIX-15] 階梯校正: ' + g.id + ' / ' + g.name);
  }
}

// ================================================================
// 輸出修正日誌
// ================================================================
console.log('\n===== 武將資料修正報告 =====');
log.forEach(l => console.log(l));

// ================================================================
// 驗證：檢查是否仍有重複名稱
// ================================================================
const nameCount = {};
generals.forEach(g => { nameCount[g.name] = (nameCount[g.name] || 0) + 1; });
const stillDups = Object.entries(nameCount).filter(([n, c]) => c > 1);
if (stillDups.length > 0) {
  console.log('\n[WARNING] 仍有重複名稱:');
  stillDups.forEach(([n, c]) => console.log('  ' + n + ' x' + c));
} else {
  console.log('\n[OK] 無重複名稱');
}

// ================================================================
// 驗證：檢查是否有重複 ID
// ================================================================
const idCount = {};
generals.forEach(g => { idCount[g.id] = (idCount[g.id] || 0) + 1; });
const dupIds = Object.entries(idCount).filter(([id, c]) => c > 1);
if (dupIds.length > 0) {
  console.log('[WARNING] 仍有重複 ID:');
  dupIds.forEach(([id, c]) => console.log('  ' + id + ' x' + c));
} else {
  console.log('[OK] 無重複 ID');
}

// ================================================================
// 寫回 master JSON
// ================================================================
masterData.updatedAt = new Date().toISOString().split('T')[0];
const output = JSON.stringify(masterData, null, 2);

// 確認 UTF-8 無 BOM
if (output.charCodeAt(0) === 0xFEFF) {
  throw new Error('BOM detected! Aborting write.');
}

fs.writeFileSync(MASTER_PATH, output, 'utf8');
console.log('\n[DONE] generals-base.json 已更新 (updatedAt=' + masterData.updatedAt + ')');
console.log('總計武將數: ' + generals.length);
