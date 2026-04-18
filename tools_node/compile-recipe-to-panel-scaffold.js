#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const {
  PROJECT_ROOT,
  ensureDir,
  getArg,
  hasFlag,
  loadRecipe,
  resolvePath,
  writeText,
} = require('./lib/ucuf-recipe-utils');

function printHelp() {
  console.log([
    '用法：',
    '  node tools_node/compile-recipe-to-panel-scaffold.js --recipe <file> [options]',
    '',
    '必要參數：',
    '  --recipe         UCUF screen recipe JSON 路徑',
    '',
    '常用選項：',
    '  --out-dir        Panel scaffold 目錄，預設 assets/scripts/ui/components',
    '  --child-dir      Child scaffold 目錄，預設 assets/scripts/ui/components/<screen-base>',
    '  --force          覆蓋已存在檔案',
    '  --write          寫入檔案；未指定時為 dry-run',
    '  --help           顯示說明',
    '',
    'v0 範圍：',
    '  - 產出 main composite panel scaffold',
    '  - 依 recipe.slots 產出 child panel stubs',
    '  - 不修改 UIConfig.ts',
  ].join('\n'));
}

function execNode(scriptPath, args) {
  cp.execFileSync(process.execPath, [scriptPath, ...args], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
  });
}

function screenBase(screenId) {
  return String(screenId || '').replace(/-screen$/, '');
}

function resolveCoreImport(childFilePath) {
  const coreDir = path.join(PROJECT_ROOT, 'assets', 'scripts', 'ui', 'core');
  const relative = path.relative(path.dirname(childFilePath), coreDir).replace(/\\/g, '/');
  return relative.startsWith('.') ? relative : `./${relative}`;
}

function buildChildStub(slot, childOutPath) {
  const coreImport = resolveCoreImport(childOutPath);
  const dataSource = slot.dataSource || '';
  return `// @spec-source → 見 docs/cross-reference-index.md\n/**\n * ${slot.childPanelClass} — auto-generated child panel stub\n *\n * slotId: ${slot.slotId}\n * zoneId: ${slot.zoneId}\n * dataSource: ${dataSource || '(none)'}\n */\nimport type { Node } from 'cc';\nimport type { UISkinResolver } from '${coreImport}/UISkinResolver';\nimport type { UITemplateBinder } from '${coreImport}/UITemplateBinder';\nimport { ChildPanelBase } from '${coreImport}/ChildPanelBase';\n\nexport class ${slot.childPanelClass} extends ChildPanelBase {\n    dataSource = '${dataSource}';\n\n    constructor(hostNode: Node, skinResolver: UISkinResolver, binder: UITemplateBinder) {\n        super(hostNode, skinResolver, binder);\n    }\n\n    async onMount(_spec: Record<string, unknown>): Promise<void> {\n        // TODO: build ${slot.slotId} fragment runtime hooks here\n    }\n\n    onDataUpdate(_data: unknown): void {\n        // TODO: bind ${dataSource || slot.slotId} data into UI nodes\n    }\n\n    validateDataFormat(_data: unknown): string | null {\n        return null;\n    }\n}\n`;
}

function writeMaybe(filePath, content, dryRun, force) {
  if (!dryRun && fs.existsSync(filePath) && !force) {
    throw new Error(`檔案已存在，請加 --force 覆蓋：${path.relative(PROJECT_ROOT, filePath)}`);
  }
  writeText(filePath, content, dryRun);
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
  const dryRun = !hasFlag(process.argv, 'write');
  const force = hasFlag(process.argv, 'force');
  const base = screenBase(recipe.screenId);
  const outDir = resolvePath(getArg(process.argv, 'out-dir')) || path.join(PROJECT_ROOT, 'assets', 'scripts', 'ui', 'components');
  const childDir = resolvePath(getArg(process.argv, 'child-dir')) || path.join(outDir, base);
  const controllerBaseName = recipe.controllerClass || `${recipe.uiId}Composite`;
  const panelClassName = controllerBaseName.endsWith('Panel') ? controllerBaseName : `${controllerBaseName}Panel`;
  const panelOutPath = path.join(outDir, `${panelClassName}.ts`);

  execNode(path.join(PROJECT_ROOT, 'tools_node', 'scaffold-ui-component.js'), [
    '--screen', recipe.screenId,
    '--ucuf',
    '--family', recipe.familyId,
    '--name', panelClassName,
    '--out', outDir,
    '--no-uiconfig',
    ...(dryRun ? ['--dry-run'] : []),
    ...(force ? ['--force'] : []),
  ]);

  if (!dryRun) {
    ensureDir(childDir);
  }
  const childFiles = [];
  for (const slot of recipe.slots.filter((item) => item.childPanelClass)) {
    const childPath = path.join(childDir, `${slot.childPanelClass}.ts`);
    const content = buildChildStub(slot, childPath);
    writeMaybe(childPath, content, dryRun, force);
    childFiles.push(path.relative(PROJECT_ROOT, childPath));
  }

  console.log(JSON.stringify({
    screenId: recipe.screenId,
    panel: path.relative(PROJECT_ROOT, panelOutPath),
    children: childFiles,
    dryRun,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`[compile-recipe-to-panel-scaffold] ${error.message}`);
  process.exit(1);
}