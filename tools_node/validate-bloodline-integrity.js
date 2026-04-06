/**
 * validate-bloodline-integrity.js
 * 
 * 驗證 person-registry.json 的血統資料完整性：
 *   R1. ancestor_chain 中所有 uid 必須存在於 person-registry.json
 *   R2. 所有 BloodlineLink 的 child_uid / parent_uid 必須存在
 *   R3. generation 必須為正整數
 *   R4. relation 必須為 'F' | 'M' | 'U'
 *   R5. 無孤立節點（除根節點外，每個節點至少被一條 link 引用）
 *   R6. 無循環引用（cycle detection）
 * 
 * 用法：
 *   node tools_node/validate-bloodline-integrity.js
 * 
 * 退出碼：
 *   0 = 全部通過
 *   1 = 有 error
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GENERALS_JSON = path.join(ROOT, 'assets', 'resources', 'data', 'generals.json');
const REGISTRY_JSON = path.join(ROOT, 'assets', 'resources', 'data', 'person-registry.json');

let errors = 0;
let warnings = 0;

function err(msg) { console.error('[ERROR] ' + msg); errors++; }
function warn(msg) { console.warn('[WARN]  ' + msg); warnings++; }
function info(msg) { console.log('[INFO]  ' + msg); }

// ---- 讀取檔案 ----

const registry = JSON.parse(fs.readFileSync(REGISTRY_JSON, 'utf-8'));
const persons = registry.persons || [];
const links = registry.links || [];

let generals = [];
if (fs.existsSync(GENERALS_JSON)) {
  generals = JSON.parse(fs.readFileSync(GENERALS_JSON, 'utf-8'));
}

// ---- 建立索引 ----

const personUids = new Set(persons.map(p => p.uid));
const generalUids = new Set(generals.map(g => g.id));
const allKnownUids = new Set([...personUids, ...generalUids]);

// ---- R1: ancestor_chain uid 必須存在 ----

info('R1 檢查 ancestor_chain uid 完整性...');
for (const general of generals) {
  if (!general.ancestor_chain || general.ancestor_chain.length === 0) continue;
  for (const uid of general.ancestor_chain) {
    if (!allKnownUids.has(uid)) {
      err(`${general.id}: ancestor_chain 包含不存在的 uid: ${uid}`);
    }
  }
}

// ---- R2: BloodlineLink uid 完整性 ----

info('R2 檢查 BloodlineLink uid 完整性...');
for (let i = 0; i < links.length; i++) {
  const l = links[i];
  if (!allKnownUids.has(l.child_uid)) {
    err(`Link[${i}]: child_uid 不存在: ${l.child_uid}`);
  }
  if (!allKnownUids.has(l.parent_uid)) {
    err(`Link[${i}]: parent_uid 不存在: ${l.parent_uid}`);
  }
}

// ---- R3: generation 正整數 ----

info('R3 檢查 generation 合法性...');
for (let i = 0; i < links.length; i++) {
  const l = links[i];
  if (typeof l.generation !== 'number' || !Number.isInteger(l.generation) || l.generation < 1) {
    err(`Link[${i}] (${l.child_uid}→${l.parent_uid}): generation 必須為正整數，得到: ${l.generation}`);
  }
}

// ---- R4: relation 枚舉 ----

info('R4 檢查 relation 枚舉...');
const VALID_RELATIONS = new Set(['F', 'M', 'U']);
for (let i = 0; i < links.length; i++) {
  const l = links[i];
  if (!VALID_RELATIONS.has(l.relation)) {
    err(`Link[${i}] (${l.child_uid}→${l.parent_uid}): relation 非法: ${l.relation}（應為 F/M/U）`);
  }
}

// ---- R5: 孤立節點偵測 ----

info('R5 檢查孤立節點...');
if (links.length > 0) {
  const referencedUids = new Set();
  for (const l of links) {
    referencedUids.add(l.child_uid);
    referencedUids.add(l.parent_uid);
  }
  
  for (const p of persons) {
    if (p.is_virtual && !referencedUids.has(p.uid)) {
      warn(`虛擬人物 ${p.uid}（${p.name}）未被任何血統連結引用（孤立節點）`);
    }
  }
}

// ---- R6: 循環引用偵測（DFS） ----

info('R6 檢查循環引用...');
if (links.length > 0) {
  // 建立 child → parents 映射
  const parentMap = new Map();
  for (const l of links) {
    if (!parentMap.has(l.child_uid)) parentMap.set(l.child_uid, []);
    parentMap.get(l.child_uid).push(l.parent_uid);
  }

  function hasCycle(startUid) {
    const visiting = new Set();
    const visited = new Set();
    
    function dfs(uid) {
      if (visiting.has(uid)) return true; // cycle
      if (visited.has(uid)) return false;
      visiting.add(uid);
      for (const parentUid of (parentMap.get(uid) || [])) {
        if (dfs(parentUid)) return true;
      }
      visiting.delete(uid);
      visited.add(uid);
      return false;
    }
    
    return dfs(startUid);
  }

  const checkedStarts = new Set();
  for (const l of links) {
    if (!checkedStarts.has(l.child_uid)) {
      checkedStarts.add(l.child_uid);
      if (hasCycle(l.child_uid)) {
        err(`偵測到循環引用：從 ${l.child_uid} 出發的祖先鏈存在環路`);
      }
    }
  }
}

// ---- 結果輸出 ----

console.log('\n=== 驗證結果 ===');
info(`person-registry.json: ${persons.length} 位人物，${links.length} 條血統連結`);
info(`generals.json: ${generals.length} 位武將`);
console.log(`errors=${errors}, warnings=${warnings}`);

if (errors > 0) {
  console.error('\n[FAIL] 血統完整性驗證失敗。');
  process.exit(1);
} else {
  console.log('\n[PASS] 血統完整性驗證通過。');
  process.exit(0);
}
