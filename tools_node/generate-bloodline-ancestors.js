#!/usr/bin/env node
/**
 * generate-bloodline-ancestors.js
 * M1-F：為每位史實武將的 14 位虛擬祖先分配 gene_refs，
 *        並對已知親子關係進行 ancestor_chain 去重。
 *
 * 用法：
 *   node tools_node/generate-bloodline-ancestors.js              # 只填空 gene_refs（idempotent）
 *   node tools_node/generate-bloodline-ancestors.js --force      # 強制重算所有 gene_refs
 *   node tools_node/generate-bloodline-ancestors.js --link-parents # 同時執行親子 dedup（更新 ancestor_chain[0]）
 *   node tools_node/generate-bloodline-ancestors.js --all        # --force + --link-parents
 *   node tools_node/generate-bloodline-ancestors.js --dry-run    # 不寫檔，僅列輸出
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const ROOT           = path.join(__dirname, '..');
const BASE_PATH      = path.join(ROOT, 'assets', 'resources', 'data', 'master', 'generals-base.json');
const GENE_DICT_PATH = path.join(ROOT, 'assets', 'resources', 'data', 'master', 'gene-dictionary.json');
const BLOODLINE_PATH = path.join(ROOT, 'assets', 'resources', 'data', 'master', 'bloodline-templates.json');
const REGISTRY_PATH  = path.join(ROOT, 'assets', 'resources', 'data', 'person-registry.json');

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------
const FORCE        = process.argv.includes('--force') || process.argv.includes('--all');
const LINK_PARENTS = process.argv.includes('--link-parents') || process.argv.includes('--all');
const DRY_RUN      = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Known paternal parent relationships (childId → fatherId)
// Only covers generals that appear in the master list.
// Used when --link-parents is active.
// ---------------------------------------------------------------------------
const PATERNAL_PARENT_MAP = {
  'cao-pi':     'cao-cao',
  'cao-zhang':  'cao-cao',
  'cao-zhi':    'cao-cao',
  'cao-chong':  'cao-cao',
  'sun-ce':     'sun-jian',
  'sun-quan':   'sun-jian',
  'sun-shao':   'sun-ce',
  'liu-shan':   'liu-bei',
  'ma-chao':    'ma-teng',
  'yuan-tan':   'yuan-shao',
  'yuan-shang': 'yuan-shao',
  'zhang-bao':  'zhang-fei',
  'guan-ping':  'guan-yu',
  'guan-xing':  'guan-yu',
  'lu-lingqi':  'lu-bu',
};

// ---------------------------------------------------------------------------
// Grade ordering (shared with tactic generator)
// ---------------------------------------------------------------------------
const GRADE_ORDER = { S: 5, A: 4, B: 3, C: 2, D: 1, E: 0 };
function gradeNum(g) { return GRADE_ORDER[g] ?? 0; }

// ---------------------------------------------------------------------------
// Deterministic RNG (FNV-1a hash + LCG, no external deps)
// ---------------------------------------------------------------------------
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h;
}

function makeLCG(seed) {
  let s = seed >>> 0;
  return function next() {
    s = ((s * 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/**
 * Deterministically pick `count` elements from `arr` using `seedStr`.
 * Sampling without replacement.
 */
function deterministicPick(arr, count, seedStr) {
  if (!arr.length || count <= 0) return [];
  const rng  = makeLCG(fnv1a(seedStr));
  const pool = arr.slice();
  const out  = [];
  const take = Math.min(count, pool.length);
  for (let i = 0; i < take; i++) {
    const idx = Math.floor(rng() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Load JSON helpers
// ---------------------------------------------------------------------------
function loadJson(p, fallback) {
  if (!fs.existsSync(p)) {
    if (fallback !== undefined) return fallback;
    console.error(`[ERROR] 找不到 ${p}`);
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (e) {
    console.error(`[ERROR] 解析 ${p} 失敗：${e.message}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Derive core gene list from a general's stats & aptitudes
// Returns array of gene IDs (non-hidden) that represent this general's
// dominant traits to be inherited upward.
// ---------------------------------------------------------------------------
function deriveCoreGenes(general, allGeneIds) {
  const tags = new Set();

  const str = general.str ?? 0;
  const int_ = general.int ?? 0;
  const lea = general.lea ?? 0;
  const pol = general.pol ?? 0;
  const cha = general.cha ?? 0;

  const cavGrade = gradeNum(general.troopAptitude?.CAVALRY ?? 'D');
  const infGrade = gradeNum(general.troopAptitude?.INFANTRY ?? 'D');

  // STR-driven genes
  if (str >= 85) { tags.add('gene_bravery'); tags.add('gene_overpower'); }
  else if (str >= 75) { tags.add('gene_bravery'); }
  if (str >= 80 && infGrade >= gradeNum('B')) tags.add('gene_halberd');
  if (str >= 88 && infGrade >= gradeNum('A')) tags.add('gene_frenzy');
  if (str >= 85 && cavGrade >= gradeNum('B')) tags.add('gene_charge');

  // INT-driven genes
  if (int_ >= 85) { tags.add('gene_strategy'); }
  if (int_ >= 80) { tags.add('gene_shout'); }

  // LEA-driven genes
  if (lea >= 85) { tags.add('gene_command'); }
  if (lea >= 80) { tags.add('gene_discipline'); }

  // Cavalry aptitude
  if (cavGrade >= gradeNum('A')) {
    tags.add('gene_cavalry');
    tags.add('gene_dash');
  }

  // POL-driven
  if (pol >= 80) tags.add('gene_politics');

  // CHA-driven
  if (cha >= 80) { tags.add('gene_honor'); tags.add('gene_guard'); }

  // Courage for high-STR or cavalry duelists
  if (str >= 88 || (str >= 80 && cavGrade >= gradeNum('A'))) tags.add('gene_courage');

  // Filter to known gene IDs only (exclude hidden genes)
  const coreList = Array.from(tags).filter(id => allGeneIds.has(id));

  // Fallback: ensure at least 2 core genes from dominant stat
  if (coreList.length < 2) {
    const fallbacks = [
      { val: str,  genes: ['gene_bravery', 'gene_halberd'] },
      { val: int_, genes: ['gene_strategy', 'gene_shout']  },
      { val: lea,  genes: ['gene_command', 'gene_discipline'] },
      { val: pol,  genes: ['gene_politics'] },
      { val: cha,  genes: ['gene_honor']    },
    ].sort((a, b) => b.val - a.val);

    for (const fb of fallbacks) {
      for (const g of fb.genes) {
        if (allGeneIds.has(g) && !coreList.includes(g)) {
          coreList.push(g);
          if (coreList.length >= 3) break;
        }
      }
      if (coreList.length >= 3) break;
    }
  }

  return coreList;
}

/**
 * Assign gene_refs to one ancestor slot based on weight profile.
 * Returns an array of gene IDs (deduplicated, length 1-4).
 */
function assignGenesForSlot(coreGenes, secondaryGenes, weightProfile, seedStr) {
  const result = new Set();

  // Core genes — higher weight means more core genes inherited
  const coreCount = Math.max(1, Math.round(3 * weightProfile.coreTagWeight));
  const corePool  = coreGenes.filter(id => !result.has(id));
  for (const id of deterministicPick(corePool, coreCount, seedStr + ':core')) {
    result.add(id);
  }

  // Secondary genes — broader gene categories
  const secCount = Math.round(2 * weightProfile.secondaryTagWeight);
  const secPool  = secondaryGenes.filter(id => !result.has(id));
  for (const id of deterministicPick(secPool, secCount, seedStr + ':sec')) {
    result.add(id);
  }

  // Paternal heritage bonus: if familyTacticBonus > 0.1, add a tactic-seed gene
  if ((weightProfile.familyTacticBonus ?? 0) > 0.1) {
    const tacticSeeds = coreGenes.filter(id =>
      !result.has(id)
    );
    if (tacticSeeds.length > 0) {
      const picked = deterministicPick(tacticSeeds, 1, seedStr + ':heritage');
      for (const id of picked) result.add(id);
    }
  }

  return Array.from(result);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const baseObj       = loadJson(BASE_PATH);
const geneDictObj   = loadJson(GENE_DICT_PATH);
const bloodlineObj  = loadJson(BLOODLINE_PATH);
const registryObj   = loadJson(REGISTRY_PATH, {
  version: '1.0.0',
  updatedAt: new Date().toISOString(),
  description: '武將人物登記表 — 扁平化血統樹，含 PersonRecord 與 BloodlineLink',
  persons: [],
  links: [],
});

const generals    = Array.isArray(baseObj.data) ? baseObj.data : [];
const geneData    = Array.isArray(geneDictObj.data) ? geneDictObj.data : [];
const blTemplates = Array.isArray(bloodlineObj.data) ? bloodlineObj.data : [];

// Build gene ID set (non-hidden only, for derivation purposes)
const allGeneIds   = new Set(geneData.filter(g => !g.isHidden).map(g => g.id));
const allGeneIdArr = Array.from(allGeneIds);

// Build index for bloodline templates
const slotTemplate   = blTemplates.find(t => t.templateType === 'ancestor-slot-template');
const weightProfiles = new Map(
  blTemplates.filter(t => t.templateType === 'weight-profile').map(t => [t.id, t])
);
const surnamePool = blTemplates.find(t => t.templateType === 'maternal-surname-pool');
const surnames    = surnamePool ? surnamePool.surnames || [] : ['王', '李', '張', '劉', '陳'];

if (!slotTemplate) {
  console.error('[ERROR] 找不到 ancestor-slot-template，請確認 bloodline-templates.json 格式。');
  process.exit(1);
}

// Build persons map (uid → PersonRecord) and links map
const personsMap = new Map((registryObj.persons || []).map(p => [p.uid, p]));
const linkSet    = new Set((registryObj.links || []).map(l => `${l.child_uid}:${l.parent_uid}`));
const linksArr   = (registryObj.links || []).slice(); // mutable copy

function ensureLink(childUid, parentUid, relation, generation) {
  const key = `${childUid}:${parentUid}`;
  if (!linkSet.has(key)) {
    linkSet.add(key);
    linksArr.push({ child_uid: childUid, parent_uid: parentUid, relation, generation });
  }
}

// Build set of all general IDs (for dedup lookup)
const generalIdSet = new Set(generals.map(g => g.id));

// ---------------------------------------------------------------------------
// Secondary gene pool: genes NOT in any general's core (used as broad fill)
// For the purpose of seeding, we use a fixed "secondary" set below core level.
// ---------------------------------------------------------------------------
const SECONDARY_GENE_CATEGORIES = new Set(['tactic-seed', 'aptitude', 'mobility']);
const secondaryGenePool = allGeneIdArr.filter(id => {
  const entry = geneData.find(g => g.id === id);
  return entry && SECONDARY_GENE_CATEGORIES.has(entry.category);
});

// ---------------------------------------------------------------------------
// Process each general
// ---------------------------------------------------------------------------
let geneAssigned = 0, geneSkipped = 0, dedupLinked = 0;

for (const general of generals) {
  // -------------------------------------------------------------------------
  // STEP A: Parent deduplication (--link-parents)
  // Replace ancestor_chain[0] with real parent's general id when known.
  // -------------------------------------------------------------------------
  if (LINK_PARENTS) {
    const fatherId = PATERNAL_PARENT_MAP[general.id];
    if (fatherId && generalIdSet.has(fatherId)) {
      if (Array.isArray(general.ancestor_chain) && general.ancestor_chain.length > 0) {
        const oldFatherUid = general.ancestor_chain[0];
        if (oldFatherUid !== fatherId) {
          general.ancestor_chain[0] = fatherId;
          dedupLinked++;

          // Update BloodlineLink: replace old link to VIRT father → real father
          // (remove old + add new; linkSet updated)
          const oldKey = `${general.id}:${oldFatherUid}`;
          if (linkSet.has(oldKey)) {
            linkSet.delete(oldKey);
            const idx = linksArr.findIndex(l => l.child_uid === general.id && l.parent_uid === oldFatherUid);
            if (idx !== -1) linksArr.splice(idx, 1);
          }
          ensureLink(general.id, fatherId, 'F', 1);

          if (DRY_RUN) {
            console.log(`  [dedup] ${general.id.padEnd(20)} ancestor_chain[0] → ${fatherId}`);
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // STEP B: Gene distribution
  // For each virtual ancestor UID, populate gene_refs if empty (or --force).
  // -------------------------------------------------------------------------
  const ancestor_chain = Array.isArray(general.ancestor_chain) ? general.ancestor_chain : [];
  if (ancestor_chain.length === 0) continue; // female generals with no chain (pre-existing)

  const coreGenes     = deriveCoreGenes(general, allGeneIds);
  // Secondary pool: exclude the general's own core to add variety
  const secondaryPool = secondaryGenePool.filter(id => !coreGenes.includes(id));

  for (let slotIndex = 0; slotIndex < Math.min(ancestor_chain.length, 14); slotIndex++) {
    const uid = ancestor_chain[slotIndex];

    // If this uid is a real general (not VIRT_), skip gene assignment for this slot
    if (generalIdSet.has(uid)) continue;

    const person = personsMap.get(uid);
    if (!person) continue; // uid not in registry yet — bootstrap might be needed first

    // Idempotency: skip if gene_refs already populated and not --force
    if (Array.isArray(person.gene_refs) && person.gene_refs.length > 0 && !FORCE) {
      geneSkipped++;
      continue;
    }

    const slotRule = slotTemplate.slotRules[slotIndex];
    if (!slotRule) continue;

    const weightProfile = weightProfiles.get(slotRule.weightProfileId);
    if (!weightProfile) continue;

    const seedStr = `${general.id}:slot${slotIndex + 1}`;
    const geneRefs = assignGenesForSlot(coreGenes, secondaryPool, weightProfile, seedStr);

    person.gene_refs = geneRefs;
    geneAssigned++;
  }

  // -------------------------------------------------------------------------
  // STEP C: Ensure PaternalSurname on real-general PersonRecord
  // -------------------------------------------------------------------------
  const generalRecord = personsMap.get(general.id);
  if (generalRecord && (!Array.isArray(generalRecord.gene_refs) || generalRecord.gene_refs.length === 0)) {
    // Real generals carry their own core genes directly
    generalRecord.gene_refs = coreGenes.slice(0, 4);
  }
}

// ---------------------------------------------------------------------------
// Rebuild links array from personsMap (ensure all ancestor_chain links exist)
// ---------------------------------------------------------------------------
for (const general of generals) {
  const chain = general.ancestor_chain || [];
  if (chain.length < 2) continue;

  // Gen 1: general → father (chain[0]), general → mother (chain[1])
  ensureLink(general.id, chain[0], 'F', 1);
  ensureLink(general.id, chain[1], 'M', 1);

  // Gen 2: father → paternal grandparents, mother → maternal grandparents
  if (chain.length >= 6) {
    ensureLink(chain[0], chain[2], 'F', 2);
    ensureLink(chain[0], chain[3], 'M', 2);
    ensureLink(chain[1], chain[4], 'F', 2);
    ensureLink(chain[1], chain[5], 'M', 2);
  }

  // Gen 3: grandparents → great-grandparents
  if (chain.length >= 14) {
    ensureLink(chain[2], chain[6],  'F', 3);
    ensureLink(chain[2], chain[7],  'M', 3);
    ensureLink(chain[3], chain[8],  'F', 3);
    ensureLink(chain[3], chain[9],  'M', 3);
    ensureLink(chain[4], chain[10], 'F', 3);
    ensureLink(chain[4], chain[11], 'M', 3);
    ensureLink(chain[5], chain[12], 'F', 3);
    ensureLink(chain[5], chain[13], 'M', 3);
  }
}

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------
if (!DRY_RUN) {
  // Update person-registry.json
  registryObj.persons   = Array.from(personsMap.values());
  registryObj.links     = linksArr;
  registryObj.updatedAt = new Date().toISOString();
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registryObj, null, 2), 'utf-8');

  // Update generals-base.json only when --link-parents modified ancestor_chain
  if (LINK_PARENTS && dedupLinked > 0) {
    baseObj.updatedAt = new Date().toISOString();
    fs.writeFileSync(BASE_PATH, JSON.stringify(baseObj, null, 2), 'utf-8');
  }
}

const modeStr = DRY_RUN ? ' [DRY-RUN — 未寫入]' : '';
console.log(
  `[generate-bloodline-ancestors] 完成${modeStr}。\n` +
  `  gene_refs 已賦值: ${geneAssigned}  已跳過(已有值): ${geneSkipped}\n` +
  `  親子去重連結:     ${dedupLinked}`
);
