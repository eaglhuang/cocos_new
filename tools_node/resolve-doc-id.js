/**
 * resolve-doc-id.js — doc_id ↔ 路徑 雙向查詢
 *
 * Usage:
 *   node tools_node/resolve-doc-id.js doc_spec_0001       # id → path/title
 *   node tools_node/resolve-doc-id.js 武將系統             # 文字 → matching entries
 *   node tools_node/resolve-doc-id.js docs/遊戲規格文件    # 路徑片段 → matching entries
 *   node tools_node/resolve-doc-id.js --list spec         # 列出某類別所有 id
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT          = path.resolve(__dirname, '..');
const REGISTRY_JSON = path.join(ROOT, 'docs', 'doc-id-registry.json');

const ID_PATTERN = /^doc_(tech|ui|art|data|spec|index|task|ai|agentskill|other)_\d{4}$/;

function loadRegistry() {
  if (!fs.existsSync(REGISTRY_JSON)) {
    console.error('Registry not found.\nRun: node tools_node/doc-id-registry.js');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(REGISTRY_JSON, 'utf8'));
}

function main() {
  const args  = process.argv.slice(2);
  const query = args[0];

  if (!query) {
    console.log([
      'Usage:',
      '  node tools_node/resolve-doc-id.js <doc_id>          # exact id lookup',
      '  node tools_node/resolve-doc-id.js <text>            # search title / path',
      '  node tools_node/resolve-doc-id.js --list <category> # list all ids in category',
      '',
      'Categories: tech | ui | art | data | spec | index | task | ai | agentskill | other',
    ].join('\n'));
    return;
  }

  const { registry } = loadRegistry();

  // ── list by category ──
  if (query === '--list') {
    const cat = args[1];
    if (!cat) { console.error('Specify a category after --list'); process.exit(1); }
    const entries = Object.entries(registry)
      .filter(([, v]) => v.category === cat)
      .sort(([a], [b]) => a.localeCompare(b));
    if (entries.length === 0) {
      console.log(`No entries for category: ${cat}`);
    } else {
      console.log(`${entries.length} entries for category "${cat}":\n`);
      for (const [id, data] of entries) {
        console.log(`  ${id.padEnd(24)} ${data.path}`);
      }
    }
    return;
  }

  // ── exact doc_id lookup ──
  if (ID_PATTERN.test(query)) {
    const entry = registry[query];
    if (!entry) {
      console.error(`Not found: ${query}`);
      process.exit(1);
    }
    const fullPath = path.join(ROOT, entry.path);
    const exists   = fs.existsSync(fullPath);
    console.log(`${query}`);
    console.log(`  Title   : ${entry.title}`);
    console.log(`  Category: ${entry.category}`);
    console.log(`  Path    : ${entry.path}`);
    console.log(`  Full    : ${fullPath}`);
    console.log(`  Exists  : ${exists ? '✅' : '❌ FILE NOT FOUND'}`);
    return;
  }

  // ── fuzzy search ──
  const needle   = query.toLowerCase();
  const results  = Object.entries(registry)
    .filter(([id, v]) =>
      id.includes(needle) ||
      v.path.toLowerCase().includes(needle) ||
      v.title.toLowerCase().includes(needle)
    )
    .sort(([a], [b]) => a.localeCompare(b));

  if (results.length === 0) {
    console.log(`No matches for: "${query}"`);
  } else {
    console.log(`${results.length} match(es) for "${query}":\n`);
    for (const [id, data] of results) {
      console.log(`  ${id.padEnd(24)} ${data.path}`);
      console.log(`  ${''.padEnd(24)} "${data.title}"`);
    }
  }
}

main();
