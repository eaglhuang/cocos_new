/**
 * migrate-bloodline-to-registry.js
 * 
 * 將 generals.json 中 Ancestors_JSON 嵌套結構遷移至扁平 PersonRegistry，
 * 並將 Ancestors_JSON 欄位替換為 ancestor_chain: string[]（14 個祖先 uid）。
 * 
 * 用法：
 *   node tools_node/migrate-bloodline-to-registry.js [--dry-run]
 * 
 * 選項：
 *   --dry-run  印出遷移結果，不修改任何檔案
 * 
 * 遷移邏輯：
 *   1. 讀取 generals.json 每位武將的 Ancestors_JSON（若存在）
 *   2. BFS 展開嵌套樹，為每個節點建立 PersonRecord（真實/虛擬）
 *   3. 為每條親子關係建立 BloodlineLink
 *   4. 收集 14 個最近祖先的 uid 放入 ancestor_chain
 *   5. 寫入 person-registry.json，並更新 generals.json
 * 
 * 備份：遷移前自動輸出 generals.json.bak
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const GENERALS_JSON = path.join(ROOT, 'assets', 'resources', 'data', 'generals.json');
const REGISTRY_JSON = path.join(ROOT, 'assets', 'resources', 'data', 'person-registry.json');
const BACKUP_JSON = GENERALS_JSON + '.bak';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

// ---- 工具函式 ----

function uid() {
  return 'VIRT_' + crypto.randomBytes(6).toString('hex').toUpperCase();
}

function kebab(name) {
  if (!name) return uid();
  return name
    .replace(/[\u4e00-\u9fff]/g, c => c) // keep CJK as-is
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase() || uid();
}

/**
 * 遞迴展開嵌套祖先節點，輸出 PersonRecord 與 BloodlineLink
 */
function expandNode(node, childUid, relation, generation, persons, links) {
  if (!node || typeof node !== 'object') return null;

  const name = node.name || node.generalName || null;
  const existingUid = node.uid || (name ? `ancestor-${kebab(name)}` : uid());

  if (!persons.has(existingUid)) {
    persons.set(existingUid, {
      uid: existingUid,
      template_id: node.templateId || null,
      name: name || '(未知)',
      gene_refs: node.gene_refs || [],
      ep_base: node.ep || node.ep_base || 0,
      faction: node.faction || 'unknown',
      is_virtual: !name,
    });
  }

  if (childUid) {
    links.push({ child_uid: childUid, parent_uid: existingUid, relation, generation });
  }

  // 遞迴展開父母
  if (node.father) expandNode(node.father, existingUid, 'F', generation + 1, persons, links);
  if (node.mother) expandNode(node.mother, existingUid, 'M', generation + 1, persons, links);

  return existingUid;
}

/**
 * BFS 取得前 14 個祖先 uid（含父母輩開始）
 */
function getAncestorChain(rootUid, links, maxCount = 14) {
  const result = [];
  const parentMap = new Map();
  for (const l of links) {
    if (!parentMap.has(l.child_uid)) parentMap.set(l.child_uid, []);
    parentMap.get(l.child_uid).push(l.parent_uid);
  }

  const queue = [rootUid];
  const visited = new Set([rootUid]);
  while (queue.length > 0 && result.length < maxCount) {
    const cur = queue.shift();
    for (const parentUid of (parentMap.get(cur) || [])) {
      if (!visited.has(parentUid)) {
        visited.add(parentUid);
        result.push(parentUid);
        queue.push(parentUid);
      }
    }
  }
  return result;
}

// ---- 主流程 ----

console.log('=== migrate-bloodline-to-registry.js ===');
if (isDryRun) console.log('[INFO]  --dry-run 模式，不寫入任何檔案。\n');

const generals = JSON.parse(fs.readFileSync(GENERALS_JSON, 'utf-8'));
const existingRegistry = JSON.parse(fs.readFileSync(REGISTRY_JSON, 'utf-8'));

const personsMap = new Map(
  (existingRegistry.persons || []).map(p => [p.uid, p])
);
const newLinks = [...(existingRegistry.links || [])];

let migratedCount = 0;
let skippedCount = 0;

for (const general of generals) {
  const rootUid = general.id;

  // 確保武將本人在 PersonRegistry 中
  if (!personsMap.has(rootUid)) {
    personsMap.set(rootUid, {
      uid: rootUid,
      template_id: general.templateId || null,
      name: general.name,
      gene_refs: (general.genes || []).map(g => g.id).filter(Boolean),
      ep_base: general.ep || 0,
      faction: general.faction || 'unknown',
      is_virtual: false,
    });
  }

  if (!general.Ancestors_JSON) {
    // 沒有嵌套資料，跳過
    if (!general.ancestor_chain) general.ancestor_chain = [];
    skippedCount++;
    continue;
  }

  // 展開嵌套祖先
  const localLinks = [];
  const ancestorsNode = general.Ancestors_JSON;
  if (ancestorsNode.father) expandNode(ancestorsNode.father, rootUid, 'F', 1, personsMap, localLinks);
  if (ancestorsNode.mother) expandNode(ancestorsNode.mother, rootUid, 'M', 1, personsMap, localLinks);

  // 去重合入 newLinks
  const linkKeys = new Set(newLinks.map(l => `${l.child_uid}:${l.parent_uid}`));
  for (const l of localLinks) {
    const key = `${l.child_uid}:${l.parent_uid}`;
    if (!linkKeys.has(key)) {
      newLinks.push(l);
      linkKeys.add(key);
    }
  }

  // 建立 ancestor_chain
  general.ancestor_chain = getAncestorChain(rootUid, newLinks);

  // 移除舊的嵌套欄位
  delete general.Ancestors_JSON;

  console.log(`[OK]  ${general.name}（${rootUid}）→ ancestor_chain: ${general.ancestor_chain.length} 筆`);
  migratedCount++;
}

console.log(`\n[INFO]  完成：已遷移 ${migratedCount} 位，無祖先資料跳過 ${skippedCount} 位。`);
console.log(`[INFO]  PersonRegistry: ${personsMap.size} 位人物，${newLinks.length} 條血統連結。`);

if (isDryRun) {
  console.log('\n[DRY-RUN] 未寫入任何檔案。');
  process.exit(0);
}

// 備份 generals.json
fs.copyFileSync(GENERALS_JSON, BACKUP_JSON);
console.log(`\n[OK]    備份 → ${BACKUP_JSON}`);

// 寫入更新後的 generals.json
fs.writeFileSync(GENERALS_JSON, JSON.stringify(generals, null, 2), 'utf-8');
console.log('[OK]    generals.json 已更新（Ancestors_JSON → ancestor_chain）');

// 寫入 person-registry.json
existingRegistry.persons = Array.from(personsMap.values());
existingRegistry.links = newLinks;
existingRegistry.updatedAt = new Date().toISOString();
fs.writeFileSync(REGISTRY_JSON, JSON.stringify(existingRegistry, null, 2), 'utf-8');
console.log('[OK]    person-registry.json 已更新');
