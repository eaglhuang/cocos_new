#!/usr/bin/env node
'use strict';

const path = require('path');
const {
  PROJECT_ROOT,
  getArg,
  hasFlag,
  loadRecipe,
  recipeBaseName,
  resolvePath,
  writeJson,
  writeText,
} = require('./lib/ucuf-recipe-utils');

const ALLOWED_TASK_TYPES = new Set([
  'tooling',
  'validation',
  'feature',
  'documentation',
  'implementation',
  'ui-component',
  'data-structure',
  'testing',
  'content',
  'asset-generation',
  'layout-content-polish',
  'asset-finish',
  'system-ui-art-integration',
]);

function printHelp() {
  console.log([
    '用法：',
    '  node tools_node/compile-recipe-to-task-card.js --recipe <file> [options]',
    '',
    '必要參數：',
    '  --recipe         UCUF screen recipe JSON 路徑',
    '',
    '常用選項：',
    '  --out            指定輸出 Markdown task card 路徑',
    '  --card-id        指定 task card id，預設自動生成',
    '  --priority       預設 P1',
    '  --phase          預設 M0',
    '  --owner          預設 Copilot',
    '  --task-type      shard task type，預設 tooling',
    '  --shard-out      指定 ui-quality-task shard JSON 路徑',
    '  --skip-shard     正式寫入時不產生 shard JSON',
    '  --write          寫入檔案；未指定時為 dry-run',
    '  --help           顯示說明',
    '',
    'v1 範圍：',
    '  - 產出可交給 Agent 使用的 Markdown task card',
    '  - 對齊 UCUF-task-card-template 必要欄位',
    '  - 正式寫入時同步產生 ui-quality-task shard JSON（預設落在 artifacts）',
  ].join('\n'));
}

function upperKebab(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();
}

function deriveFragments(recipe) {
  return recipe.slots
    .map((slot) => slot.fragment)
    .filter((value) => typeof value === 'string' && value.trim().length > 0);
}

function deriveChildPanels(recipe) {
  return recipe.slots
    .filter((slot) => slot.dataSource)
    .map((slot) => ({
      name: slot.childPanelClass || `${slot.slotId}Host`,
      type: slot.mode,
      dataSource: slot.dataSource,
    }));
}

function deriveDeliverables(recipe) {
  const items = [
    `assets/resources/ui-spec/screens/${recipe.screenId}.json`,
    `assets/resources/ui-spec/contracts/${recipe.contentSchemaId}.schema.json`,
  ];

  if (recipe.layoutId) {
    items.push(`assets/resources/ui-spec/layouts/${recipe.layoutId}.json`);
  }
  if (recipe.skinId) {
    items.push(`assets/resources/ui-spec/skins/${recipe.skinId}.json`);
  }
  if (recipe.controllerClass) {
    items.push(`assets/scripts/ui/components/${recipe.controllerClass}.ts`);
  }

  return items;
}

function deriveAcceptance(recipe) {
  return [
    `recipe 與 screen spec 欄位一致（screenId=${recipe.screenId}）`,
    'validate-ui-specs --strict --check-content-contract 全部通過',
    'UCUF runtime smoke route 可進入目標畫面',
    '所有 required data source 都可對應到 content contract 欄位',
    `validation profile 套用為 ${recipe.validationProfile}`,
  ];
}

function deriveContentContract(recipe) {
  return recipe.dataSources
    .filter((source) => source.required)
    .map((source) => source.sourceId);
}

function buildDocsBackwritten() {
  return [
    'docs/keep.md',
    'docs/cross-reference-index.md',
    'docs/ui/UCUF-UI-template-blueprint.md',
  ];
}

function validateTaskShard(shard) {
  if (!shard || shard.kind !== 'ui-quality-task-shard') {
    throw new Error('task shard.kind 必須是 ui-quality-task-shard');
  }
  if (shard.version !== 1) {
    throw new Error(`task shard.version 目前只支援 1，收到 ${shard.version}`);
  }
  if (!Array.isArray(shard.tasks) || shard.tasks.length === 0) {
    throw new Error('task shard.tasks 必須是非空陣列');
  }

  shard.tasks.forEach((task, index) => {
    const prefix = `tasks[${index}]`;
    ['id', 'priority', 'phase', 'owner', 'status', 'created', 'created_by_agent', 'type', 'title', 'description', 'notes'].forEach((field) => {
      if (typeof task[field] !== 'string' || task[field].trim().length === 0) {
        throw new Error(`${prefix}.${field} 必須是非空字串`);
      }
    });
    ['related', 'depends', 'acceptance', 'deliverables', 'docs_backwritten'].forEach((field) => {
      if (!Array.isArray(task[field])) {
        throw new Error(`${prefix}.${field} 必須是陣列`);
      }
    });
    if (!ALLOWED_TASK_TYPES.has(task.type)) {
      throw new Error(`${prefix}.type 不在允許清單內: ${task.type}`);
    }
  });
}

function buildShardTask(recipe, options) {
  const created = new Date().toISOString().split('T')[0];
  const acceptance = deriveAcceptance(recipe);
  const deliverables = deriveDeliverables(recipe);

  return {
    id: options.cardId,
    priority: options.priority,
    phase: options.phase,
    owner: options.owner,
    status: 'open',
    created,
    created_by_agent: 'GitHubCopilot',
    type: options.taskType,
    title: `${recipe.uiId} Recipe Onboarding`,
    description: `${recipe.uiId} 的 machine-readable recipe onboarding 任務。目標是把 ${recipe.screenId} 的 recipe 穩定編譯成 screen spec、task card 與 review/runtime skeleton，作為 ${recipe.familyId} family 的正式樣本。`,
    related: [],
    depends: [],
    template_family: recipe.familyId,
    content_contract: deriveContentContract(recipe),
    skin_fragments: deriveFragments(recipe),
    smoke_route: recipe.smokeRoute,
    docs_backwritten: buildDocsBackwritten(),
    acceptance,
    deliverables,
    notes: `${created} | 狀態: open | 類型: ${options.taskType} | 來源: compile-recipe-to-task-card | 處理: 初始 recipe onboarding shard 自動生成 | 阻塞: 無`,
  };
}

function buildTaskShard(recipe, options) {
  return {
    kind: 'ui-quality-task-shard',
    version: 1,
    tasks: [buildShardTask(recipe, options)],
  };
}

function buildCard(recipe, options) {
  const fragmentsOwned = deriveFragments(recipe);
  const childPanels = deriveChildPanels(recipe);
  const deliverables = deriveDeliverables(recipe);
  const acceptance = deriveAcceptance(recipe);
  const created = new Date().toISOString().split('T')[0];
  const screenBase = recipeBaseName(recipe.screenId);
  const docsBackwritten = buildDocsBackwritten();

  const lines = [
    '---',
    `id: ${options.cardId}`,
    `priority: ${options.priority}`,
    `phase: ${options.phase}`,
    `created: ${created}`,
    'created_by_agent: GitHubCopilot',
    `owner: ${options.owner}`,
    'status: open',
    'type: composite-panel',
    'related_cards: []',
    'depends: []',
    `screen_id: ${recipe.screenId}`,
    'parent_panel: CompositePanel',
    'fragments_owned:',
    ...(fragmentsOwned.length > 0 ? fragmentsOwned.map((item) => `  - ${item}`) : ['  []']),
    `content_contract_schema: contracts/${recipe.contentSchemaId}.schema.json`,
    'data_sources_owned:',
    ...recipe.dataSources.map((source) => `  - ${source.sourceId}`),
    `skin_manifest: skins/${recipe.skinId || screenBase + '-default'}.json`,
    'skin_slots_added: []',
    'skin_layers_used: []',
    `atlas_group: ${screenBase}`,
    'child_panels:',
    ...childPanels.map((panel) => `  - name: ${panel.name}`),
    ...childPanels.flatMap((panel) => [
      `    type: ${panel.type}`,
      `    data_source: ${panel.dataSource}`,
    ]),
    `smoke_route: ${recipe.smokeRoute}`,
    'verification_commands:',
    '  - node tools_node/validate-ui-specs.js --strict --check-content-contract',
    `  - node tools_node/ucuf-runtime-check.js --screen ${recipe.screenId}`,
    '  - node tools_node/check-encoding-touched.js <changed-files>',
    'deliverables:',
    ...deliverables.map((item) => `  - ${item}`),
    'docs_backwritten:',
    ...docsBackwritten.map((item) => `  - ${item}`),
    '---',
    '',
    `# ${options.cardId} ${recipe.uiId} Recipe Onboarding`,
    '',
    '## 背景',
    '',
    `${recipe.uiId} 已經有可運作的 UCUF/既有畫面資產，但目前仍缺少正式 recipe 到工具鏈的編譯入口。`,
    `本卡的目標是把 ${recipe.screenId} 的 machine-readable recipe 轉成可穩定重建的 screen spec 與可執行任務卡，作為 ${recipe.familyId} family 的第一批 compiler 樣本。`,
    '',
    '## 實作清單',
    '',
    `- [ ] 以 recipe 正規化 ${recipe.screenId} 的 screen metadata`,
    `- [ ] 確認 content contract ${recipe.contentSchemaId} 與 dataSources 對齊`,
    `- [ ] 為 ${recipe.familyId} family 補齊 v0 compiler 需要的欄位映射`,
    `- [ ] 產出 generated review / runtime 驗收骨架（若尚未存在）`,
    '',
    '## 驗收條件',
    '',
    ...acceptance.map((item) => `- [ ] ${item}`),
    '',
    '## 結案檢查清單',
    '',
    '- [ ] task card frontmatter 可通過 validate-ucuf-task-card.js',
    '- [ ] 相關 recipe / screen spec / contract 路徑皆可解析',
    '- [ ] 所有變更檔案已完成 encoding check',
    '',
  ];

  return `${lines.join('\n')}\n`;
}

function main() {
  if (hasFlag(process.argv, 'help')) {
    printHelp();
    return;
  }

  const recipeArg = getArg(process.argv, 'recipe');
  if (!recipeArg) {
    printHelp();
    process.exit(1);
  }

  const { recipe } = loadRecipe(recipeArg);
  if (recipe.controllerKind !== 'composite-panel') {
    throw new Error(`v0 目前只支援 controllerKind=composite-panel，收到 ${recipe.controllerKind}`);
  }

  const dryRun = !hasFlag(process.argv, 'write');
  const screenBase = recipeBaseName(recipe.screenId);
  const outArg = getArg(process.argv, 'out');
  const cardId = getArg(process.argv, 'card-id') || `UCUF-${upperKebab(recipe.screenId)}`;
  const options = {
    cardId,
    owner: getArg(process.argv, 'owner', 'GitHubCopilot'),
    phase: getArg(process.argv, 'phase', 'M0'),
    priority: getArg(process.argv, 'priority', 'P1'),
    taskType: getArg(process.argv, 'task-type', 'tooling'),
  };
  const targetPath = resolvePath(outArg) || path.join(
    PROJECT_ROOT,
    'artifacts',
    'ui-source',
    screenBase,
    'generated',
    `${recipe.screenId}-task-card.md`
  );
  const shardOutArg = getArg(process.argv, 'shard-out');
  const shardPath = resolvePath(shardOutArg) || path.join(
    PROJECT_ROOT,
    'artifacts',
    'ui-source',
    screenBase,
    'generated',
    `${recipe.screenId}-task-shard.json`
  );

  const card = buildCard(recipe, options);
  const shard = buildTaskShard(recipe, options);
  validateTaskShard(shard);

  writeText(targetPath, card, dryRun);
  if (dryRun) {
    console.log(`[compile-recipe-to-task-card] shard target=${path.relative(PROJECT_ROOT, shardPath)}`);
  } else if (!hasFlag(process.argv, 'skip-shard')) {
    writeJson(shardPath, shard, false);
  }

  console.log(`[compile-recipe-to-task-card] screen=${recipe.screenId} out=${path.relative(PROJECT_ROOT, targetPath)}${dryRun ? ' [DRY-RUN]' : ''}`);
}

try {
  main();
} catch (error) {
  console.error(`[compile-recipe-to-task-card] ${error.message}`);
  process.exit(1);
}