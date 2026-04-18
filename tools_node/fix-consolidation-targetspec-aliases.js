#!/usr/bin/env node
/**
 * tools_node/fix-consolidation-targetspec-aliases.js
 *
 * 將 consolidation-manifest.json 中的歷史 alias targetSpecs
 * 批次映射為 doc-id-registry 中存在的真實 doc_id。
 *
 * Usage:
 *   node tools_node/fix-consolidation-targetspec-aliases.js --check
 *   node tools_node/fix-consolidation-targetspec-aliases.js --apply
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, 'docs/遊戲規格文件/consolidation-manifest.json');
const REGISTRY_PATH = path.join(ROOT, 'docs/doc-id-registry.json');

const mode = process.argv.includes('--apply') ? 'apply' : 'check';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const SOURCE_TARGET_MAP = {
  'docs/遊戲規格文件/討論來源/更舊的討論/模組化戰場系統開發策略.md': [
    'doc_spec_0039',
    'doc_spec_0044',
    'doc_spec_0040',
    'doc_tech_0013'
  ],
  'docs/遊戲規格文件/討論來源/更舊的討論/策略遊戲視覺與系統設計.md': [
    'doc_spec_0039',
    'doc_spec_0014',
    'doc_ui_0027'
  ],
  'docs/遊戲規格文件/討論來源/更舊的討論/賽馬娘機制三國化轉化.md': [
    'doc_data_0001',
    'doc_spec_0041'
  ],
  'docs/遊戲規格文件/討論來源/更舊的討論/遊戲美術風格與市場區隔策略.md': [
    'doc_art_0002',
    'doc_ui_0027'
  ],
  'docs/遊戲規格文件/討論來源/更舊的討論/馬娘養成機制三國化設計.md': [
    'doc_spec_0011',
    'doc_spec_0026',
    'doc_spec_0027',
    'doc_spec_0003'
  ],
  'docs/遊戲規格文件/討論來源/最早的討論/養成遊戲的遺憾與挑戰設計.md': [
    'doc_spec_0011',
    'doc_spec_0020',
    'doc_spec_0007'
  ]
};

function main() {
  const manifest = readJson(MANIFEST_PATH);
  const registryRaw = readJson(REGISTRY_PATH);
  const registry = registryRaw.registry || registryRaw;

  let changed = 0;
  const changes = [];

  for (const file of manifest.files || []) {
    if (!file || !file.path || !SOURCE_TARGET_MAP[file.path]) continue;

    const desired = SOURCE_TARGET_MAP[file.path].filter(id => registry[id]);
    const current = Array.isArray(file.targetSpecs) ? file.targetSpecs : [];

    const needsChange =
      current.length !== desired.length ||
      current.some((id, idx) => id !== desired[idx]);

    if (!needsChange) continue;

    changes.push({ path: file.path, before: current, after: desired });
    file.targetSpecs = desired;
    changed++;
  }

  console.log('\n[fix-consolidation-targetspec-aliases] Summary\n');
  console.log(`Mode: ${mode}`);
  console.log(`Changed entries: ${changed}`);

  for (const item of changes) {
    console.log(`\n- ${item.path}`);
    console.log(`  before: ${item.before.join(', ') || '(empty)'}`);
    console.log(`  after:  ${item.after.join(', ') || '(empty)'}`);
  }

  if (mode === 'apply' && changed > 0) {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
    console.log('\nApplied changes to consolidation-manifest.json\n');
  } else {
    console.log('\nDry run only. Use --apply to write changes.\n');
  }
}

main();