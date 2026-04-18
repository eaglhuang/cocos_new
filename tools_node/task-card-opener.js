#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const {
  PROJECT_ROOT,
  getArg,
  hasFlag,
  readJson,
  resolvePath,
  writeJson,
  writeText,
} = require('./lib/ucuf-recipe-utils');

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function normalizeStatus(status) {
  const value = String(status || 'open').trim().toLowerCase();
  if (value === 'in_progress' || value === 'in progress') {
    return 'in-progress';
  }
  if (value === 'done' || value === 'closed' || value === 'completed') {
    return 'done';
  }
  if (value === 'blocked') {
    return 'blocked';
  }
  return value || 'open';
}

function splitList(value) {
  return String(value || '')
    .split(/[|,\n;]/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function renderYamlArrayField(name, items) {
  if (!items.length) {
    return `${name}: []`;
  }

  return [
    `${name}:`,
    ...items.map((item) => `  - ${JSON.stringify(item)}`),
  ].join('\n');
}

function renderValue(value) {
  return JSON.stringify(value ?? '');
}

function renderRelatedLinks(items) {
  if (!items.length) {
    return '—';
  }

  return items.map((item) => `[${item}](${item}.md)`).join('、');
}

function inferMdKind(mdOutArg) {
  const outputPath = String(mdOutArg || '').replace(/\\/g, '/');
  if (/(^|\/)docs\/agent-briefs\/tasks\//.test(outputPath)) {
    return 'agent-briefs';
  }
  return 'generic';
}

function inferJsonKind(jsonOutArg) {
  const outputPath = String(jsonOutArg || '').replace(/\\/g, '/');
  if (/(^|\/)docs\/ui-quality-tasks\//.test(outputPath)) {
    return 'ui-quality-task-shard';
  }
  if (/(^|\/)docs\/tasks\//.test(outputPath) || /tasks-[^/]+\.json$/i.test(outputPath)) {
    return 'task-aggregate';
  }
  return 'plain-task';
}

function buildTask(options) {
  const created = options.created || todayIso();
  const status = normalizeStatus(options.status);
  const related = options.related.length > 0 ? options.related : [];
  const depends = options.depends.length > 0 ? options.depends : [];
  const acceptance = options.acceptance.length > 0 ? options.acceptance : [];
  const deliverables = options.deliverables.length > 0 ? options.deliverables : [];
  const notes = options.notes || `${created} | 狀態: ${status} | 驗證: pending | 變更: task-card-opener 產生骨架 | 阻塞: 無`;

  return {
    id: options.id,
    title: options.title,
    owner: options.owner,
    priority: options.priority,
    status,
    type: options.type,
    phase: options.phase,
    created,
    created_by_agent: options.createdByAgent,
    description: options.description,
    related,
    depends,
    acceptance,
    deliverables,
    notes,
  };
}

function buildAgentBriefsMarkdown(task, options) {
  const docId = options.docId ? `<!-- doc_id: ${options.docId} -->\n` : '';
  const notes = task.notes || '';
  const completion = task.status === 'done' ? '100%' : '0%';
  const relatedLinks = renderRelatedLinks(task.related);
  const acceptance = task.acceptance.length > 0
    ? task.acceptance.map((item) => `1. ${item}`).join('\n')
    : '1. 待補驗證條件';
  const deliverables = task.deliverables.length > 0
    ? task.deliverables.map((item) => `- ${item}`).join('\n')
    : '- 待補交付物';
  const relatedTasks = task.related.length > 0
    ? task.related.map((item) => `- [${item}](${item}.md)`).join('\n')
    : '- 無';

  const frontmatterLines = [
    '---',
    `id: ${renderValue(task.id)}`,
    `priority: ${renderValue(task.priority)}`,
    `owner: ${renderValue(task.owner)}`,
    `status: ${renderValue(task.status)}`,
    `type: ${renderValue(task.type)}`,
    `phase: ${renderValue(task.phase)}`,
    `created: ${renderValue(task.created)}`,
    renderYamlArrayField('related_cards', task.related),
    `notes: ${renderValue(notes)}`,
    '---',
    '',
  ];

  const bodyLines = [
    `# [${task.id}] ${task.title}`,
    '',
    '## 基本資訊',
    '| 欄位 | 值 |',
    '|---|---|',
    `| 卡號 | ${task.id} |`,
    `| 優先級 | ${task.priority} |`,
    `| 開單時間 | ${task.created} |`,
    `| 負責 Agent | ${task.owner} |`,
    `| 狀態 | ${task.status} |`,
    `| 完成度 | ${completion} |`,
    '| 完成時間 | — |',
    `| 關聯卡號 | ${relatedLinks} |`,
    '',
    '## 開單原因',
    task.description || '待補：說明這張卡的來源與目標。',
    '',
    '## 完整描述',
    task.deliverables.length > 0
      ? task.deliverables.map((item) => `- ${item}`).join('\n')
      : '- 待補：列出實作或搬遷範圍。',
    '',
    '## 如何驗證',
    acceptance,
    '',
    '## 建議作法',
    '- 待補：依任務類型補上最小可執行步驟。',
    '',
    '## 相關聯任務卡',
    relatedTasks,
    '',
    '## 交付物',
    deliverables,
    '',
    '## 備註',
    notes ? `- ${notes}` : '- 無',
  ];

  return `${docId}${frontmatterLines.join('\n')}\n${bodyLines.join('\n')}\n`;
}

function buildGenericMarkdown(task) {
  const acceptance = task.acceptance.length > 0
    ? task.acceptance.map((item) => `- ${item}`).join('\n')
    : '- 待補驗證條件';
  const deliverables = task.deliverables.length > 0
    ? task.deliverables.map((item) => `- ${item}`).join('\n')
    : '- 待補交付物';
  const related = task.related.length > 0
    ? task.related.map((item) => `- [${item}](${item}.md)`).join('\n')
    : '- 無';

  const frontmatterLines = [
    '---',
    `id: ${renderValue(task.id)}`,
    `title: ${renderValue(task.title)}`,
    `owner: ${renderValue(task.owner)}`,
    `priority: ${renderValue(task.priority)}`,
    `status: ${renderValue(task.status)}`,
    `type: ${renderValue(task.type)}`,
    `phase: ${renderValue(task.phase)}`,
    `created: ${renderValue(task.created)}`,
    `created_by_agent: ${renderValue(task.created_by_agent)}`,
    renderYamlArrayField('related_cards', task.related),
    renderYamlArrayField('depends', task.depends),
    `notes: ${renderValue(task.notes)}`,
    '---',
    '',
  ];

  const bodyLines = [
    `# ${task.id} ${task.title}`,
    '',
    '## 摘要',
    task.description ? `- ${task.description}` : '- 待補：說明此任務的核心目標。',
    '',
    '## 驗證條件',
    acceptance,
    '',
    '## 交付物',
    deliverables,
    '',
    '## 相關聯任務卡',
    related,
    '',
    '## 備註',
    `- ${task.notes}`,
  ];

  return `${frontmatterLines.join('\n')}\n${bodyLines.join('\n')}\n`;
}

function buildMarkdown(task, mdKind) {
  return mdKind === 'agent-briefs'
    ? buildAgentBriefsMarkdown(task, { docId: getArg(process.argv, 'doc-id') })
    : buildGenericMarkdown(task);
}

function loadJsonFileIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }
  return readJson(filePath);
}

function recalcSummary(tasks) {
  const summary = {
    done: 0,
    in_progress: 0,
    open: 0,
    total: tasks.length,
  };

  for (const task of tasks) {
    const status = normalizeStatus(task && task.status);
    if (status === 'done') {
      summary.done += 1;
    } else if (status === 'in-progress') {
      summary.in_progress += 1;
    } else {
      summary.open += 1;
    }
  }

  return summary;
}

function upsertTaskInAggregate(existing, task) {
  const aggregate = existing && typeof existing === 'object' ? { ...existing } : {};
  const tasks = Array.isArray(aggregate.tasks) ? [...aggregate.tasks] : [];
  const index = tasks.findIndex((item) => item && item.id === task.id);
  if (index >= 0) {
    tasks[index] = task;
  } else {
    tasks.push(task);
  }

  aggregate.tasks = tasks;
  aggregate.summary = recalcSummary(tasks);
  return aggregate;
}

function upsertTaskInUiShard(existing, task) {
  const shard = existing && typeof existing === 'object' ? { ...existing } : { kind: 'ui-quality-task-shard', version: 1 };
  const tasks = Array.isArray(shard.tasks) ? [...shard.tasks] : [];
  const index = tasks.findIndex((item) => item && item.id === task.id);
  if (index >= 0) {
    tasks[index] = task;
  } else {
    tasks.push(task);
  }

  shard.kind = 'ui-quality-task-shard';
  shard.version = 1;
  shard.tasks = tasks;
  return shard;
}

function printHelp() {
  console.log([
    '用法：',
    '  node tools_node/task-card-opener.js --id <TaskId> --title <Title> [options]',
    '  node tools_node/task-card-opener.js --recipe <file> [既有 recipe compiler 參數]',
    '',
    '必要參數（直接模式）：',
    '  --id              任務卡 ID（依名詞定義文件）',
    '  --title           任務標題',
    '',
    '常用選項：',
    '  --description     任務摘要 / 說明',
    '  --owner           預設 Copilot',
    '  --priority        預設 P1',
    '  --status          預設 open',
    '  --type            預設 implementation',
    '  --phase           預設 M0',
    '  --created         預設今日 YYYY-MM-DD',
    '  --created-by-agent 預設 GitHubCopilot',
    '  --related         以逗號、|、; 或換行分隔的相關卡號',
    '  --depends         以逗號、|、; 或換行分隔的依賴卡號',
    '  --acceptance      驗收條件清單',
    '  --deliverables    交付物清單',
    '  --notes           備註 / notes 欄內容',
    '  --doc-id          agent-briefs 模式可選的 doc_id comment',
    '  --md-out          Markdown 輸出路徑',
    '  --md-kind         generic / agent-briefs，未指定時依路徑推斷',
    '  --json-out        JSON 輸出路徑',
    '  --json-kind       task-aggregate / ui-quality-task-shard / plain-task',
    '  --write           寫入檔案；未指定時為 dry-run',
    '  --help            顯示說明',
    '',
    '任務卡 ID 命名：請依 docs/遊戲規格文件/系統規格書/名詞定義文件.md 的 {系統代號}-{子系統}-{流水號4位} 規則。',
    '',
    'recipe 相容模式：',
    '  - 若提供 --recipe，會直接委派給 tools_node/compile-recipe-to-task-card.js',
    '  - 這可讓 ui-vibe-pipeline 直接改用 task-card-opener，而不破壞既有 recipe 產線',
  ].join('\n'));
}

function printDryRunArtifact(label, content) {
  console.log(`--- ${label} ---`);
  console.log(content);
}

function runRecipeMode() {
  const args = process.argv.slice(2);
  cp.execFileSync(process.execPath, [path.join(PROJECT_ROOT, 'tools_node', 'compile-recipe-to-task-card.js'), ...args], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
  });
}

function main() {
  if (hasFlag(process.argv, 'help')) {
    printHelp();
    return;
  }

  if (getArg(process.argv, 'recipe')) {
    runRecipeMode();
    return;
  }

  const id = getArg(process.argv, 'id') || getArg(process.argv, 'card-id');
  const title = getArg(process.argv, 'title');
  if (!id || !title) {
    printHelp();
    process.exit(1);
  }

  const task = buildTask({
    id,
    title,
    owner: getArg(process.argv, 'owner', 'Copilot'),
    priority: getArg(process.argv, 'priority', 'P1'),
    status: getArg(process.argv, 'status', 'open'),
    type: getArg(process.argv, 'type', 'implementation'),
    phase: getArg(process.argv, 'phase', 'M0'),
    created: getArg(process.argv, 'created', todayIso()),
    createdByAgent: getArg(process.argv, 'created-by-agent', 'GitHubCopilot'),
    description: getArg(process.argv, 'description', ''),
    related: splitList(getArg(process.argv, 'related', '')),
    depends: splitList(getArg(process.argv, 'depends', '')),
    acceptance: splitList(getArg(process.argv, 'acceptance', '')),
    deliverables: splitList(getArg(process.argv, 'deliverables', '')),
    notes: getArg(process.argv, 'notes', ''),
  });

  const dryRun = !hasFlag(process.argv, 'write');
  const mdOutArg = getArg(process.argv, 'md-out', '');
  const jsonOutArg = getArg(process.argv, 'json-out', '');
  const mdKind = getArg(process.argv, 'md-kind', inferMdKind(mdOutArg));
  const jsonKind = getArg(process.argv, 'json-kind', inferJsonKind(jsonOutArg));

  if (!mdOutArg && !jsonOutArg && !dryRun) {
    throw new Error('未指定 --md-out 或 --json-out，無法在 write 模式輸出');
  }

  const mdContent = buildMarkdown(task, mdKind);
  if (mdOutArg) {
    writeText(resolvePath(mdOutArg), mdContent, dryRun);
  } else if (dryRun) {
    printDryRunArtifact('markdown', mdContent);
  } else {
    throw new Error('未指定 --md-out，無法在 write 模式輸出 Markdown');
  }

  if (jsonOutArg) {
    const jsonPath = resolvePath(jsonOutArg);
    const existing = loadJsonFileIfExists(jsonPath);
    let outputJson;

    if (jsonKind === 'ui-quality-task-shard') {
      outputJson = upsertTaskInUiShard(existing, task);
    } else if (jsonKind === 'task-aggregate') {
      outputJson = upsertTaskInAggregate(existing, task);
    } else {
      outputJson = task;
    }

    writeJson(jsonPath, outputJson, dryRun);
  } else if (dryRun) {
    printDryRunArtifact('json', `${JSON.stringify(task, null, 2)}\n`);
  }

  const outputSummary = {
    id: task.id,
    mdKind,
    jsonKind,
    mdOut: mdOutArg ? path.relative(PROJECT_ROOT, resolvePath(mdOutArg)) : '',
    jsonOut: jsonOutArg ? path.relative(PROJECT_ROOT, resolvePath(jsonOutArg)) : '',
    dryRun,
  };

  console.log(JSON.stringify(outputSummary, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`[task-card-opener] ${error.message}`);
  process.exit(1);
}
