/**
 * doc-id-registry.js — 文件代號 Registry 建構 / 驗證 / 新增指定文件
 *
 * Usage:
 *   node tools_node/doc-id-registry.js              # 掃描、分類、輸出 registry
 *   node tools_node/doc-id-registry.js --verify     # 驗證 registry 完整性
 *   node tools_node/doc-id-registry.js --assign <path>  # 為新文件分配 doc_id
 *
 * 輸出:
 *   docs/doc-id-registry.json  — machine-readable master registry
 *   docs/doc-id-registry.md    — human-readable index table
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT             = path.resolve(__dirname, '..');
const REGISTRY_JSON    = path.join(ROOT, 'docs', 'doc-id-registry.json');
const REGISTRY_MD      = path.join(ROOT, 'docs', 'doc-id-registry.md');

// Category prefix map (order determines section order in registry.md)
const CATEGORIES = [
  ['tech',        'doc_tech',        '技術類'],
  ['ui',          'doc_ui',          '畫面UI類'],
  ['art',         'doc_art',         '美術非UI類'],
  ['data',        'doc_data',        '數值類'],
  ['spec',        'doc_spec',        '遊戲規格類'],
  ['index',       'doc_index',       '索引類'],
  ['task',        'doc_task',        '任務卡類'],
  ['ai',          'doc_ai',          'AI Agent 專用'],
  ['agentskill',  'doc_agentskill',  'Agent Skill 專用'],
  ['other',       'doc_other',       '其它類'],
];

const CAT_PREFIX = Object.fromEntries(CATEGORIES.map(([k, p]) => [k, p]));
const CAT_LABEL  = Object.fromEntries(CATEGORIES.map(([k, , l]) => [k, l]));

// ──────────────────────────────────────────────
// Classification decision tree
// Rules are checked top-to-bottom, first match wins.
// ──────────────────────────────────────────────
function classify(relPath) {
  const p = relPath.replace(/\\/g, '/');
  const f = path.basename(p);

  // ① Agent skill — .github/skills/* or .agents/skills/*
  if (/(^\.github\/skills\/|^\.agents\/skills\/)/.test(p)) return 'agentskill';

  // ① .agents/workflows or .agents/rules → ai
  if (/^\.agents\/(workflows|rules)\//.test(p)) return 'ai';

  // ② AI — .github/instructions/*, copilot-instructions.md, AGENTS.md
  if (/^\.github\/instructions\//.test(p)) return 'ai';
  if (f === 'copilot-instructions.md' || f === 'AGENTS.md') return 'ai';

  // ③ Task — agent-briefs/tasks/*
  if (/agent-briefs\/tasks\//.test(p)) return 'task';

  // ④ Agent-briefs root — task templates/indexes vs agent docs
  if (/agent-briefs\/[^/]+$/.test(p)) {
    if (/task-card-template|tasks_index/i.test(f)) return 'task';
    return 'ai'; // agent instructions, playbooks, readme, checklist
  }

  // ⑤ docs/tasks/ — all are tasks (except README which is a nav index)
  if (/(^\/docs\/tasks\/|^docs\/tasks\/)/.test(p)) {
    if (f === 'README.md') return 'index';
    return 'task';
  }

  // ⑥ Agent coordination docs
  if (/^agent-collaboration-protocol\.md$|^agent-context-budget\.md$/.test(f)) return 'ai';

  // ⑦ Index files
  if (f === 'cross-reference-index.md')                      return 'index';
  if (/(\/|^)cross-ref\//.test(p))                          return 'index';
  if (/(\/|^)keep-shards\//.test(p))                        return 'index';
  if (f === 'keep.md' || f === 'keep.summary.md')            return 'index';
  if (f === 'README.md')                                     return 'index'; // all READMEs

  // ⑧ Art (non-UI)
  if (/美術素材規劃|外部美術搬移|美術風格規格書/.test(f)) return 'art';

  // ⑨ Data / Numerical
  if (/^數值系統\.md$|^AI武將強度系統\.md$/.test(f)) return 'data';

  // ⑩ Discussion source directory — all spec
  if (/(\/|^)[^/]*討論來源\//.test(p)) return 'spec';

  // ⑪ UI — match filename patterns
  if (testUi(f, p)) return 'ui';

  // ⑫ Technical — match filename patterns
  if (testTech(f, p)) return 'tech';

  // ⑬ Game spec — catch-all for 遊戲規格文件/  (after ui/tech patterns above)
  if (/(\/|^)[^/]*遊戲規格文件\//.test(p))  return 'spec';
  if (f === 'demo_playbook.md')    return 'spec';

  // ⑭ Default
  return 'other';
}

function testUi(f, p) {
  // Filename-based patterns
  const uiFilePats = [
    /^UI[ _]規格書|^UI[ _]規格補遺|^UI 規格書|^UI 規格補遺/,
    /^UCUF規範文件|^UCUF里程碑文件/,
    /^UI技術規格書\.md$|^UI品質檢核表|^UI參考圖品質分析|^ui-quality-todo/,
    /^UI-factory-agent-entry|^UI-icon|^UI-reference-source|^UI-vibe-pipeline/,
    /^universal-composite-ui-framework-plan/,
    /^主戰場UI/,
    /^武將人物介面/,
    /^血統樹.*UI|^血脈命鏡|^血脈視覺契約|^角色血脈符號|^英靈虎符.*視覺|^未持有武將標記/,
    /^UI骨架補遺|^UI Proof|^UI空白線稿|^UI線稿對照|^Figma[+＋].*補遺|^Figma母板/,
    /^fragment-composition-guide|^content-contract-framework|^component-sizing-contract/,
    /^UI-asset-slice-pipeline|^UI-factory-baseline|^layout-quality-rules/,
    /^general-detail-/,
    /^ComfyUI-Cocos-partial-asset/,
  ];
  if (uiFilePats.some(pat => pat.test(f))) return true;

  // Path-based: docs/annotations/, docs/ui/ (except ui-system-architecture), UI品質參考圖/
  if (/(\/|^)docs\/annotations\//.test(p)) return true;
  if (/(\/|^)docs\/ui\//.test(p) && f !== 'ui-system-architecture.md') return true;
  if (/UI品質參考圖\//.test(p)) return true;

  return false;
}

function testTech(f, p) {
  const techFilePats = [
    /^UCUF技術文件\.md$/,
    /^資料中心架構規格書\.md$/,
    /^demo_技術架構\.md$/,
    /^程式規格書\.md$/,
    /^encoding-integrity-playbook\.md$/,
    /^精簡tokens說明書\.md$/,
    /^參考官方範例短中長優化方案\.md$/,
    /^架構評估報告/,
    /^場景搭建指南\.md$/,
    /^Data Schema文件/,
    /^同步API規格書\.md$/,
    /^熱更新與版本控制規格書\.md$/,
    /^武將資料管線規格書\.md$/,
    /^ui-system-architecture\.md$/,
    /^uipreviewbuilder-split-blueprint\.md$/,
  ];
  if (techFilePats.some(pat => pat.test(f))) return true;
  if (/(\/|^)[^/]*特效研究\//.test(p)) return true;
  return false;
}

// ──────────────────────────────────────────────
// File scanning
// ──────────────────────────────────────────────
function scanMdFiles(rootDirs) {
  const files = [];
  const SKIP_DIRS = new Set(['node_modules', 'library', 'temp', '.git']);

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (e) { return; }
    for (const ent of entries) {
      if (SKIP_DIRS.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile() && ent.name.endsWith('.md')) files.push(full);
    }
  }

  for (const d of rootDirs) walk(d);
  return files;
}

// ──────────────────────────────────────────────
// Build registry from scratch
// ──────────────────────────────────────────────
function buildRegistry() {
  const scanDirs = [
    path.join(ROOT, 'docs'),
    path.join(ROOT, '.github'),
    path.join(ROOT, '.agents'),
  ];
  // Root-level AGENTS.md
  const rootAgents = path.join(ROOT, 'AGENTS.md');

  const allFiles = scanMdFiles(scanDirs);
  if (fs.existsSync(rootAgents)) allFiles.push(rootAgents);

  // Classify
  const buckets = Object.fromEntries(CATEGORIES.map(([k]) => [k, []]));
  for (const fullPath of allFiles) {
    const relPath = path.relative(ROOT, fullPath).replace(/\\/g, '/');
    const cat = classify(relPath);
    buckets[cat].push({ fullPath, relPath });
  }

  // Sort within each category: alphabetical by relPath for stable numbering
  for (const cat of Object.keys(buckets)) {
    buckets[cat].sort((a, b) => a.relPath.localeCompare(b.relPath));
  }

  // Assign doc_ids and read titles
  const registry = {};
  for (const [cat, , ] of CATEGORIES) {
    const prefix = CAT_PREFIX[cat];
    buckets[cat].forEach((item, idx) => {
      const n    = String(idx + 1).padStart(4, '0');
      const id   = `${prefix}_${n}`;
      const title = readTitle(item.fullPath);
      registry[id] = { path: item.relPath, title, category: cat };
    });
  }

  return registry;
}

function readTitle(fullPath) {
  let title = path.basename(fullPath, '.md');
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines   = content.split('\n');
    let inFm = false, pastFm = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '---' && !pastFm) {
        inFm = !inFm;
        if (!inFm) pastFm = true;
        continue;
      }
      if (!inFm && trimmed.startsWith('#')) {
        title = trimmed.replace(/^#+\s*/, '').trim();
        break;
      }
    }
  } catch (_) { /* fallback to filename */ }
  return title;
}

// ──────────────────────────────────────────────
// Write output files
// ──────────────────────────────────────────────
function writeRegistry(registry) {
  // ── JSON ──
  const jsonData = {
    generated : new Date().toISOString().split('T')[0],
    note      : 'doc_id 系統唯一真相來源。文件路徑異動後 doc_id 不變。' +
                'Agent 可用 `grep -r "doc_id: <id>"` 或 `node tools_node/resolve-doc-id.js <id>` 定位文件。',
    registry,
  };
  fs.writeFileSync(REGISTRY_JSON, JSON.stringify(jsonData, null, 2), 'utf8');
  console.log(`✅ Written: docs/doc-id-registry.json`);

  // ── MD ──
  const catCounts = {};
  for (const [, data] of Object.entries(registry)) {
    catCounts[data.category] = (catCounts[data.category] || 0) + 1;
  }
  const total = Object.values(catCounts).reduce((a, b) => a + b, 0);

  const lines = [
    '# 文件代號 Registry (doc-id-registry)',
    '',
    `> 生成日期: ${jsonData.generated}`,
    '> 本檔由 `node tools_node/doc-id-registry.js` 自動生成，請勿手動編輯。',
    '> **唯一真相來源。** 文件移動後 doc_id 不變，Agent 可用 doc_id 搜尋定位文件。',
    '> 新增文件：`node tools_node/doc-id-registry.js --assign <path>`',
    '',
    '## 分類統計',
    '',
    '| 類別 | 前綴 | 數量 |',
    '|------|------|-----:|',
  ];
  for (const [cat, prefix, label] of CATEGORIES) {
    lines.push(`| ${label} | \`${prefix}\` | ${catCounts[cat] || 0} |`);
  }
  lines.push(`| **合計** | — | **${total}** |`);
  lines.push('', '---', '');

  for (const [cat, prefix, label] of CATEGORIES) {
    const entries = Object.entries(registry).filter(([, v]) => v.category === cat);
    if (entries.length === 0) continue;
    lines.push(`## ${label} (\`${prefix}\`)`);
    lines.push('');
    lines.push('| doc_id | 路徑 | 標題 |');
    lines.push('|--------|------|------|');
    for (const [id, data] of entries) {
      const safeTitle = data.title.replace(/\|/g, '&#124;');
      lines.push(`| \`${id}\` | ${data.path} | ${safeTitle} |`);
    }
    lines.push('');
  }

  fs.writeFileSync(REGISTRY_MD, lines.join('\n'), 'utf8');
  console.log(`✅ Written: docs/doc-id-registry.md`);
}

// ──────────────────────────────────────────────
// Verify registry
// ──────────────────────────────────────────────
function verifyRegistry() {
  if (!fs.existsSync(REGISTRY_JSON)) {
    console.error('Registry not found. Run without --verify first.');
    process.exit(1);
  }
  const { registry } = JSON.parse(fs.readFileSync(REGISTRY_JSON, 'utf8'));
  const errors = [], warnings = [];
  const seenIds = new Set(), seenPaths = new Set();

  for (const [id, data] of Object.entries(registry)) {
    if (seenIds.has(id))            errors.push(`Duplicate doc_id: ${id}`);
    if (seenPaths.has(data.path))   errors.push(`Duplicate path: ${data.path} (${id})`);
    seenIds.add(id);
    seenPaths.add(data.path);

    const fullPath = path.join(ROOT, data.path);
    if (!fs.existsSync(fullPath)) {
      errors.push(`File not found: ${data.path} (${id})`);
      continue;
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    const hasId = content.includes(`doc_id: ${id}`) || content.includes(`doc_id : ${id}`);
    if (!hasId) warnings.push(`Missing injected doc_id in: ${data.path} (${id})`);
  }

  if (errors.length) {
    console.error(`\n❌ ${errors.length} error(s):`);
    errors.forEach(e => console.error(`   ${e}`));
  }
  if (warnings.length) {
    console.warn(`\n⚠️  ${warnings.length} warning(s) — files not yet injected:`);
    warnings.slice(0, 20).forEach(w => console.warn(`   ${w}`));
    if (warnings.length > 20) console.warn(`   ... and ${warnings.length - 20} more`);
  }
  if (!errors.length && !warnings.length) {
    console.log(`✅ Registry OK — ${seenIds.size} entries, all files have doc_id.`);
  }
  return errors.length === 0;
}

// ──────────────────────────────────────────────
// --assign <path>: register + inject a new file
// ──────────────────────────────────────────────
function assignFile(filePath) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  if (!fs.existsSync(REGISTRY_JSON)) {
    console.error('Registry not found. Run node tools_node/doc-id-registry.js first.');
    process.exit(1);
  }

  const jsonData = JSON.parse(fs.readFileSync(REGISTRY_JSON, 'utf8'));
  const { registry } = jsonData;
  const relPath = path.relative(ROOT, absPath).replace(/\\/g, '/');

  // Already registered?
  for (const [id, entry] of Object.entries(registry)) {
    if (entry.path === relPath) {
      console.log(`Already registered: ${relPath} → ${id}`);
      return id;
    }
  }

  const cat    = classify(relPath);
  const prefix = CAT_PREFIX[cat];
  const nums   = Object.keys(registry)
    .filter(id => id.startsWith(prefix + '_'))
    .map(id => parseInt(id.split('_').pop(), 10));
  const nextNum = nums.length ? Math.max(...nums) + 1 : 1;
  const newId  = `${prefix}_${String(nextNum).padStart(4, '0')}`;
  const title  = readTitle(absPath);

  registry[newId] = { path: relPath, title, category: cat };
  jsonData.generated = new Date().toISOString().split('T')[0];
  fs.writeFileSync(REGISTRY_JSON, JSON.stringify(jsonData, null, 2), 'utf8');

  // Inject doc_id into the file
  const injResult = injectDocId(absPath, newId, false);

  console.log(`✅ Assigned: ${newId}`);
  console.log(`   Path:     ${relPath}`);
  console.log(`   Title:    ${title}`);
  console.log(`   Category: ${CAT_LABEL[cat]}`);
  console.log(`   Inject:   ${injResult}`);
  console.log(`\n   Rebuild registry.md to reflect changes:`);
  console.log(`   node tools_node/doc-id-registry.js`);
  return newId;
}

// ──────────────────────────────────────────────
// Inject helper (shared with inject-doc-ids.js via inline use)
// ──────────────────────────────────────────────
function injectDocId(fullPath, docId, dryRun) {
  const content = fs.readFileSync(fullPath, 'utf8');
  if (/<!--\s*doc_id:\s*\S/.test(content) || /\bdoc_id:\s*\S/m.test(content)) {
    return 'skipped (already has doc_id)';
  }

  const hasFm  = content.startsWith('---\n') || content.startsWith('---\r\n');
  const eol    = content.includes('\r\n') ? '\r\n' : '\n';
  let newContent;

  if (hasFm) {
    newContent = content.replace(/^---[\r\n]/, `---${eol}doc_id: ${docId}${eol}`);
  } else {
    newContent = `<!-- doc_id: ${docId} -->\n${content}`;
  }

  if (!dryRun) {
    fs.writeFileSync(fullPath, newContent, 'utf8');
    return `injected (${hasFm ? 'YAML' : 'HTML comment'})`;
  }
  return `would inject (${hasFm ? 'YAML' : 'HTML comment'})`;
}

// ──────────────────────────────────────────────
// main
// ──────────────────────────────────────────────
const args = process.argv.slice(2);

if (args[0] === '--verify') {
  verifyRegistry();
} else if (args[0] === '--assign') {
  if (!args[1]) {
    console.error('Usage: node tools_node/doc-id-registry.js --assign <path>');
    process.exit(1);
  }
  assignFile(args[1]);
} else {
  console.log('🔍 Scanning and classifying .md files...\n');
  const registry = buildRegistry();

  // Summary
  const catCounts = {};
  for (const [, data] of Object.entries(registry)) {
    catCounts[data.category] = (catCounts[data.category] || 0) + 1;
  }
  const total = Object.values(catCounts).reduce((a, b) => a + b, 0);
  console.log('📊 Classification summary:');
  for (const [cat, prefix, label] of CATEGORIES) {
    const n = catCounts[cat] || 0;
    console.log(`   ${prefix.padEnd(18)} (${label}): ${n}`);
  }
  console.log(`   ${'TOTAL'.padEnd(18)}: ${total}\n`);

  writeRegistry(registry);
  console.log('\n🎯 Next steps:');
  console.log('   1. Review docs/doc-id-registry.md — check classifications look right');
  console.log('   2. node tools_node/inject-doc-ids.js --dry-run');
  console.log('   3. node tools_node/inject-doc-ids.js');
  console.log('   4. node tools_node/doc-id-registry.js --verify');
}

module.exports = { classify, buildRegistry, injectDocId };
