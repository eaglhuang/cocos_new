#!/usr/bin/env node
/**
 * bootstrap-person-registry-placeholders.js
 * 依 generals-base.json 建立最小可運作的 person-registry 與 ancestor_chain（14 位虛擬祖先）。
 * 用法：node tools_node/bootstrap-person-registry-placeholders.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE_PATH = path.join(ROOT, 'assets', 'resources', 'data', 'master', 'generals-base.json');
const REGISTRY_PATH = path.join(ROOT, 'assets', 'resources', 'data', 'person-registry.json');

function loadJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function makeVirtualUid(generalId, index) {
  return `VIRT_${generalId.replace(/-/g, '_').toUpperCase()}_${String(index + 1).padStart(2, '0')}`;
}

const baseObj = loadJson(BASE_PATH, { version: '1.0.0', data: [] });
const registry = loadJson(REGISTRY_PATH, { version: '1.0.0', updatedAt: new Date().toISOString(), description: '武將人物登記表 — 扁平化血統樹，含 PersonRecord 與 BloodlineLink', persons: [], links: [] });

const generals = Array.isArray(baseObj.data) ? baseObj.data : [];
const personsMap = new Map((registry.persons || []).map(item => [item.uid, item]));
const linkMap = new Map((registry.links || []).map(link => [`${link.child_uid}:${link.parent_uid}`, link]));

function ensureLink(childUid, parentUid, relation, generation) {
  const key = `${childUid}:${parentUid}`;
  if (!linkMap.has(key)) {
    linkMap.set(key, { child_uid: childUid, parent_uid: parentUid, relation, generation });
  }
}

let patchedChains = 0;

for (const general of generals) {
  if (!personsMap.has(general.id)) {
    personsMap.set(general.id, {
      uid: general.id,
      template_id: general.templateId ?? null,
      name: general.name,
      gender: general.gender ?? '未知',
      gene_refs: Array.isArray(general.genes) ? general.genes.map(g => g.id).filter(Boolean) : [],
      ep_base: general.ep ?? 0,
      faction: general.faction ?? 'unknown',
      core_tags: Array.isArray(general.coreTags) ? general.coreTags : [],
      is_virtual: false,
    });
  }

  const ancestors = Array.from({ length: 14 }, (_, index) => makeVirtualUid(general.id, index));
  general.ancestor_chain = ancestors;
  patchedChains++;

  ancestors.forEach((uid, index) => {
    if (!personsMap.has(uid)) {
      personsMap.set(uid, {
        uid,
        template_id: null,
        name: `${general.name}祖脈${String(index + 1).padStart(2, '0')}`,
        gender: index % 2 === 0 ? '男' : '女',
        gene_refs: [],
        ep_base: Math.max(0, Math.round((general.ep ?? 0) * (0.72 - index * 0.02))),
        faction: general.faction ?? 'unknown',
        core_tags: Array.isArray(general.coreTags) ? general.coreTags : [],
        is_virtual: true,
      });
    }
  });

  ensureLink(general.id, ancestors[0], 'F', 1);
  ensureLink(general.id, ancestors[1], 'M', 1);
  ensureLink(ancestors[0], ancestors[2], 'F', 2);
  ensureLink(ancestors[0], ancestors[3], 'M', 2);
  ensureLink(ancestors[1], ancestors[4], 'F', 2);
  ensureLink(ancestors[1], ancestors[5], 'M', 2);
  ensureLink(ancestors[2], ancestors[6], 'F', 3);
  ensureLink(ancestors[2], ancestors[7], 'M', 3);
  ensureLink(ancestors[3], ancestors[8], 'F', 3);
  ensureLink(ancestors[3], ancestors[9], 'M', 3);
  ensureLink(ancestors[4], ancestors[10], 'F', 3);
  ensureLink(ancestors[4], ancestors[11], 'M', 3);
  ensureLink(ancestors[5], ancestors[12], 'F', 3);
  ensureLink(ancestors[5], ancestors[13], 'M', 3);
}

baseObj.updatedAt = new Date().toISOString();
registry.persons = Array.from(personsMap.values());
registry.links = Array.from(linkMap.values());
registry.updatedAt = new Date().toISOString();

fs.writeFileSync(BASE_PATH, JSON.stringify(baseObj, null, 2), 'utf-8');
fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8');

console.log(`[bootstrap-person-registry] ancestor_chain 補齊 ${patchedChains} 筆`);
console.log(`[bootstrap-person-registry] persons=${registry.persons.length} links=${registry.links.length}`);