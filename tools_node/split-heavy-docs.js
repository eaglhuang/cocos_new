/**
 * split-heavy-docs.js
 * 將三個超大檔案拆分成目錄式 shard 架構：
 *   docs/keep.md          → docs/keep-shards/ (4 shards + stub)
 *   docs/ui-quality-todo.json → docs/tasks/ (4 prefix shards + thin index)
 *   docs/cross-reference-index.md → docs/cross-ref/ (3 section shards + stub)
 */

'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function write(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
  const lines = content.split('\n').length;
  const kb = (Buffer.byteLength(content, 'utf8') / 1024).toFixed(1);
  console.log(`  WRITE  ${path.relative(ROOT, filePath).replace(/\\/g,'/')}  (${lines} lines, ${kb} KB)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Split keep.md
// ─────────────────────────────────────────────────────────────────────────────
function splitKeep() {
  const src = path.join(DOCS, 'keep.md');
  const content = fs.readFileSync(src, 'utf8');
  const lines = content.split('\n');

  const shardDir = path.join(DOCS, 'keep-shards');
  ensureDir(shardDir);

  // Section grouping rules (heading prefix → shard key)
  const GROUPS = {
    core:     ['## P0.', '## 0.', 'P0.', '0.'],
    workflow: ['## 3.', '## 4.', '## 5.', '## 6.', '## 13.'],
    ui_arch:  ['## 7.', '## 8.', '## 9.', '## 10.', '## 11.', '## 12.', '## 19.', '## 23.'],
    status:   ['## 14.', '## 15.', '## 16.', '## 17.', '## 18.'],
  };

  // Map each section heading start-line to its shard
  function getShardFor(heading) {
    for (const [shard, prefixes] of Object.entries(GROUPS)) {
      if (prefixes.some(p => heading.startsWith(p))) return shard;
    }
    // §1, §2, §2b, §2c → core (default for intro sections)
    if (/^## [12]/.test(heading)) return 'core';
    return null;
  }

  // Split lines into sections by ## headings
  const sections = []; // { heading, lines: [...], shard }
  let current = null;
  let preamble = []; // lines before first ## heading

  for (const line of lines) {
    if (/^## /.test(line)) {
      if (current) sections.push(current);
      const shard = getShardFor(line.slice(3).trim());
      current = { heading: line, body: [], shard };
    } else {
      if (!current) {
        preamble.push(line);
      } else {
        current.body.push(line);
      }
    }
  }
  if (current) sections.push(current);

  // Build shard contents
  const shardBufs = { core: [], workflow: [], ui_arch: [], status: [] };
  const headers = {
    core:     '# Keep — Core（P0 · 專案基準 · Pre-flight · 工具安全 · 常識路由）\n\n> 這是 keep.md 的核心分片。完整索引見 `docs/keep.md`。\n\n',
    workflow: '# Keep — Workflow（Cocos 工作流 · 編碼 · 任務卡 · Git · QA）\n\n> 這是 keep.md 的工作流分片。完整索引見 `docs/keep.md`。\n\n',
    ui_arch:  '# Keep — UI Architecture（UI 契約 · 模板架構 · 量產 · Proof Mapping · MemoryManager）\n\n> 這是 keep.md 的 UI 架構分片。完整索引見 `docs/keep.md`。\n\n',
    status:   '# Keep — Current Status（MCP · 架構評估 · UIManager · 下一步）\n\n> 這是 keep.md 的現況分片。完整索引見 `docs/keep.md`。\n\n',
  };

  for (const sec of sections) {
    const target = sec.shard;
    if (!target) continue;
    shardBufs[target].push(sec.heading);
    shardBufs[target].push(...sec.body);
    shardBufs[target].push('');
  }

  const shardFiles = {
    core:     'keep-core.md',
    workflow: 'keep-workflow.md',
    ui_arch:  'keep-ui-arch.md',
    status:   'keep-status.md',
  };

  for (const [key, fname] of Object.entries(shardFiles)) {
    const body = headers[key] + shardBufs[key].join('\n');
    write(path.join(shardDir, fname), body);
  }

  // Rewrite keep.md as a thin stub (keep preamble + shard index)
  const stub = [
    ...preamble,
    '',
    '> **⚠️ keep.md 已拆分為 4 個分片，本檔為索引入口。**',
    '> Token 節流目的：避免整份讀入超過 6000 tokens。請按需讀對應分片。',
    '',
    '## 分片索引',
    '',
    '| 分片 | 涵蓋章節 | 路徑 |',
    '|------|----------|------|',
    '| Core | P0 · §0 · §1 · §2 · §2b · §2c | `docs/keep-shards/keep-core.md` |',
    '| Workflow | §3 · §4 · §5 · §6 · §13 | `docs/keep-shards/keep-workflow.md` |',
    '| UI Architecture | §7–§12 · §19 · §23 | `docs/keep-shards/keep-ui-arch.md` |',
    '| Current Status | §14–§18 | `docs/keep-shards/keep-status.md` |',
    '',
    '## Pre-flight 快速讀法',
    '',
    '- **第一步（必讀）**：`docs/keep.summary.md`（33 行，無條件讀）',
    '- **第二步（按需）**：依工作內容選對應分片',
    '  - 工具安全 / Skill 路由 → `keep-core.md`',
    '  - Cocos 工作流 / 編碼 / Git → `keep-workflow.md`',
    '  - UI 架構決策 → `keep-ui-arch.md`',
    '  - 目前實作狀態 → `keep-status.md`',
    '- **第三步（需修改共識時）**：讀對應分片全文，修改後同步更新本索引',
    '',
    '---',
    '',
    '> 若需要搜尋特定內容，用 grep_search 搜尋 docs/keep-shards/ 目錄，勿整份讀入。',
  ].join('\n');

  write(src, stub);
  console.log('  keep.md 已改寫為 stub 索引');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Split ui-quality-todo.json
// ─────────────────────────────────────────────────────────────────────────────
function splitTasks() {
  const src = path.join(DOCS, 'ui-quality-todo.json');
  const data = JSON.parse(fs.readFileSync(src, 'utf8'));
  const taskDir = path.join(DOCS, 'tasks');
  ensureDir(taskDir);

  // Group tasks by prefix
  const groups = { UI: [], DATA: [], PROG: [], DC: [] };
  const unknown = [];
  for (const task of data.tasks) {
    const m = task.id.match(/^([A-Z]+)-/);
    const prefix = m ? m[1] : 'OTHER';
    if (groups[prefix]) {
      groups[prefix].push(task);
    } else {
      unknown.push(task);
    }
  }

  const shardMeta = {
    audit_source: data.audit_source,
    id_schema: data.id_schema,
    task_template: data.task_template,
  };

  // Write each shard
  const shardFiles = {};
  for (const [prefix, tasks] of Object.entries(groups)) {
    if (tasks.length === 0) continue;
    const fname = `tasks-${prefix.toLowerCase()}.json`;
    const shard = {
      ...shardMeta,
      shard: prefix,
      generated: new Date().toISOString().slice(0, 10),
      summary: {
        done: tasks.filter(t => t.status === 'done' || t.status === 'completed').length,
        in_progress: tasks.filter(t => t.status === 'in-progress').length,
        open: tasks.filter(t => t.status === 'open').length,
        total: tasks.length,
      },
      tasks,
    };
    write(path.join(taskDir, fname), JSON.stringify(shard, null, 2) + '\n');
    shardFiles[prefix] = `docs/tasks/${fname}`;
  }

  // Rewrite ui-quality-todo.json as a thin index
  const thinIndex = {
    _note: 'ui-quality-todo.json 已拆分為分片。本檔為 thin index，僅含 metadata 與 shard 索引。讀取任務請直接讀對應 shard。',
    audit_source: data.audit_source,
    generated: data.generated,
    id_schema: data.id_schema,
    shards: shardFiles,
    summary: data.summary,
    _usage: {
      read_ui_tasks: 'docs/tasks/tasks-ui.json',
      read_prog_tasks: 'docs/tasks/tasks-prog.json',
      read_dc_tasks: 'docs/tasks/tasks-dc.json',
      read_data_tasks: 'docs/tasks/tasks-data.json',
      build_manifest: 'node tools_node/build-ui-task-manifest.js',
    },
  };
  write(src, JSON.stringify(thinIndex, null, 2) + '\n');
  console.log('  ui-quality-todo.json 已改寫為 thin index');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Split cross-reference-index.md
// ─────────────────────────────────────────────────────────────────────────────
function splitCrossRef() {
  const src = path.join(DOCS, 'cross-reference-index.md');
  const content = fs.readFileSync(src, 'utf8');
  const lines = content.split('\n');

  const refDir = path.join(DOCS, 'cross-ref');
  ensureDir(refDir);

  // Split at top-level ## sections: ## A., ## B., ## C.
  const SECTION_RE = /^## ([A-C])\. /;
  const sections = {}; // 'A' | 'B' | 'C' → lines[]
  let preamble = [];
  let currentSection = null;

  for (const line of lines) {
    const m = line.match(SECTION_RE);
    if (m) {
      currentSection = m[1];
      if (!sections[currentSection]) sections[currentSection] = [];
      sections[currentSection].push(line);
    } else if (!currentSection) {
      preamble.push(line);
    } else {
      sections[currentSection].push(line);
    }
  }

  const sectionNames = {
    A: 'cross-ref-specs.md',
    B: 'cross-ref-code.md',
    C: 'cross-ref-ui-spec.md',
  };
  const sectionTitles = {
    A: '規格書索引（文件 → 相關文件）',
    B: '代碼索引（代碼 ↔ 規格書 雙向映射）',
    C: 'UI Spec JSON 資產索引',
  };

  for (const [letter, fname] of Object.entries(sectionNames)) {
    if (!sections[letter]) continue;
    const header = [
      `# Cross-Reference: ${sectionTitles[letter]}`,
      '',
      `> 這是 cross-reference-index.md 的 ${letter} 節分片。完整索引見 \`docs/cross-reference-index.md\`。`,
      `> 最後更新請參考母檔 Header。`,
      '',
    ].join('\n');
    write(path.join(refDir, fname), header + '\n' + sections[letter].join('\n'));
  }

  // Rewrite stub
  const stub = [
    ...preamble,
    '',
    '> **⚠️ cross-reference-index.md 已拆分為 3 個分片，本檔為索引入口。**',
    '> Token 節流目的：避免整份讀入。請按需讀對應分片。',
    '',
    '## 分片索引',
    '',
    '| 分片 | 涵蓋內容 | 路徑 |',
    '|------|----------|------|',
    '| A — 規格書索引 | 核心/血統/養成/戰場/經濟/UI 規格書相互依賴關係 | `docs/cross-ref/cross-ref-specs.md` |',
    '| B — 代碼索引 | .ts 代碼 ↔ 規格書雙向映射，含完成度估算 | `docs/cross-ref/cross-ref-code.md` |',
    '| C — UI Spec JSON | assets/resources/ui-spec/ 三層 JSON 清單 | `docs/cross-ref/cross-ref-ui-spec.md` |',
    '',
    '> 建議使用方式：先用 grep_search 搜尋關鍵字，只在找到相關段落時才讀對應分片。',
  ].join('\n');

  write(src, stub);
  console.log('  cross-reference-index.md 已改寫為 stub 索引');
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Write README for each new directory
// ─────────────────────────────────────────────────────────────────────────────
function writeReadmes() {
  write(path.join(DOCS, 'keep-shards', 'README.md'), [
    '# keep-shards/',
    '',
    '`docs/keep.md` 的拆分分片。每個分片約 150-200 行，避免整份 keep.md 一次塞入 context。',
    '',
    '| 分片 | 章節 |',
    '|------|------|',
    '| keep-core.md | P0, §0–§2c（核心共識、工具安全、Skill 路由）|',
    '| keep-workflow.md | §3–§6, §13（Cocos 流程、編碼、任務卡、Git、QA）|',
    '| keep-ui-arch.md | §7–§12, §19, §23（UI 架構、模板、量產、MemoryManager）|',
    '| keep-status.md | §14–§18（MCP、架構評估、UIManager、下一步）|',
    '',
    '修改時注意：同步更新 `docs/keep.md`（stub 索引）與 `docs/keep.summary.md`。',
  ].join('\n'));

  write(path.join(DOCS, 'tasks', 'README.md'), [
    '# tasks/',
    '',
    '`docs/ui-quality-todo.json` 的拆分分片，依 ID 前綴分組。',
    '',
    '| 分片 | ID 前綴 | 說明 |',
    '|------|---------|------|',
    '| tasks-ui.json | UI-* | UI 設計/品質任務（~100 件）|',
    '| tasks-prog.json | PROG-* | 程式任務（~16 件）|',
    '| tasks-dc.json | DC-* | Data Center Phase 任務（~35 件）|',
    '| tasks-data.json | DATA-* | 資料契約任務（~1 件）|',
    '',
    '新增任務請直接編輯對應分片，再跑 `node tools_node/build-ui-task-manifest.js` 重建 aggregate。',
  ].join('\n'));

  write(path.join(DOCS, 'cross-ref', 'README.md'), [
    '# cross-ref/',
    '',
    '`docs/cross-reference-index.md` 的拆分分片，依章節分組。',
    '',
    '| 分片 | 章節 | 說明 |',
    '|------|------|------|',
    '| cross-ref-specs.md | A | 規格書相互依賴索引 |',
    '| cross-ref-code.md | B | .ts 代碼 ↔ 規格書雙向映射 |',
    '| cross-ref-ui-spec.md | C | UI Spec JSON 資產清單 |',
    '',
    '修改時注意：同步更新 `docs/cross-reference-index.md`（stub 索引）的 metadata header。',
  ].join('\n'));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== split-heavy-docs.js ===\n');
console.log('Step 1: Splitting keep.md...');
splitKeep();
console.log('\nStep 2: Splitting ui-quality-todo.json...');
splitTasks();
console.log('\nStep 3: Splitting cross-reference-index.md...');
splitCrossRef();
console.log('\nStep 4: Writing READMEs...');
writeReadmes();
console.log('\n✅ Done. Run encoding check next.');
