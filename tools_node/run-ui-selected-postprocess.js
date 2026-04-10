#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const COMPILE_SCRIPT = path.join(PROJECT_ROOT, 'tools_node', 'compile-family-map-to-asset-tasks.js');
const TASK_BATCH_SCRIPT = path.join(PROJECT_ROOT, 'tools_node', 'run-ui-asset-task-batch.js');
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function printUsage() {
  console.log([
    '用法：',
    '  node tools_node/run-ui-selected-postprocess.js --manifest <asset-task-manifest.json> --selected-dir <dir> [options]',
    '  node tools_node/run-ui-selected-postprocess.js --family-map <family-map.json> --selected-dir <dir> [options]',
    '',
    '常用選項：',
    '  --selection-map <json>      額外指定 taskId -> selected 檔案綁定表',
    '  --generated-root <dir>      指定輸出根目錄',
    '  --task-id <id>              只跑特定 task，可重複傳入',
    '  --dry-run                   只產生 staging plan，不執行 postprocess',
    '  --strict                    缺 binding / postprocess 失敗時 exit 1',
    '  --compile-force             family-map 模式允許覆蓋既有 manifest/task',
    '  --compile-skip-validate     family-map 模式略過 compile 後自動驗證',
  ].join('\n'));
}

function parseArgs(argv) {
  const options = {
    manifest: '',
    familyMap: '',
    selectedDir: '',
    selectionMap: '',
    generatedRoot: '',
    taskIds: [],
    strict: false,
    dryRun: false,
    compileForce: false,
    compileSkipValidate: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    switch (token) {
      case '--manifest':
        options.manifest = next;
        index += 1;
        break;
      case '--family-map':
        options.familyMap = next;
        index += 1;
        break;
      case '--selected-dir':
        options.selectedDir = next;
        index += 1;
        break;
      case '--selection-map':
        options.selectionMap = next;
        index += 1;
        break;
      case '--generated-root':
        options.generatedRoot = next;
        index += 1;
        break;
      case '--task-id':
        options.taskIds.push(next);
        index += 1;
        break;
      case '--strict':
        options.strict = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--compile-force':
        options.compileForce = true;
        break;
      case '--compile-skip-validate':
        options.compileSkipValidate = true;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
      default:
        break;
    }
  }

  return options;
}

function resolvePath(inputPath) {
  return path.isAbsolute(inputPath) ? inputPath : path.join(PROJECT_ROOT, inputPath);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(path.extname(String(name || '')).toLowerCase(), '')
    .replace(/[^a-z0-9]+/g, '');
}

function runCompileFromFamilyMap(options) {
  const familyMapPath = resolvePath(options.familyMap);
  const args = [COMPILE_SCRIPT, '--family-map', familyMapPath];
  if (options.compileForce) {
    args.push('--force');
  }
  if (options.compileSkipValidate) {
    args.push('--skip-validate');
  }

  const result = spawnSync(process.execPath, args, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error('compile-family-map-to-asset-tasks.js 執行失敗');
  }

  const screenDir = path.dirname(path.dirname(familyMapPath));
  return path.join(screenDir, 'manifests', 'asset-task-manifest.json');
}

function collectImageFiles(dirPath) {
  const results = [];
  const walk = (currentPath) => {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      const extension = path.extname(entry.name).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(extension)) {
        continue;
      }
      results.push(fullPath);
    }
  };
  walk(dirPath);
  results.sort();
  return results;
}

function loadSelectionMap(selectionMapPath) {
  if (!selectionMapPath) {
    return null;
  }
  return readJson(resolvePath(selectionMapPath));
}

function resolveSelectedDir(options, selectionMap) {
  const candidate = options.selectedDir || selectionMap?.selectedDir || '';
  if (!candidate) {
    throw new Error('缺少 --selected-dir，且 selection-map 內也未提供 selectedDir');
  }
  const resolved = resolvePath(candidate);
  if (!fs.existsSync(resolved)) {
    throw new Error(`找不到 selected dir: ${resolved}`);
  }
  return resolved;
}

function findTaskInput(selectedFiles, task) {
  const candidates = [task.taskId, task.output?.outputName, task.slot]
    .filter(Boolean)
    .map(normalizeName);

  for (const candidate of candidates) {
    const exactMatches = selectedFiles.filter((filePath) => normalizeName(path.basename(filePath)) === candidate);
    if (exactMatches.length === 1) {
      return { inputPath: exactMatches[0], strategy: 'auto-exact' };
    }
  }

  return { inputPath: '', strategy: 'missing' };
}

function buildSelectionLookup(selectionMap) {
  const lookup = new Map();
  for (const binding of selectionMap?.bindings || []) {
    if (!binding.taskId || !binding.selected) {
      continue;
    }
    lookup.set(binding.taskId, binding.selected);
  }
  return lookup;
}

function resolveMappedInput(selectedDir, selectedValue) {
  const candidate = path.isAbsolute(selectedValue) ? selectedValue : path.join(selectedDir, selectedValue);
  return fs.existsSync(candidate) ? candidate : '';
}

function buildBindings(tasks, selectedDir, selectionLookup, selectedFiles) {
  return tasks.map((task) => {
    const mapped = selectionLookup.get(task.taskId);
    if (mapped) {
      const inputPath = resolveMappedInput(selectedDir, mapped);
      return {
        taskId: task.taskId,
        taskLabel: task.label,
        outputName: task.output?.outputName || '',
        inputPath,
        selected: mapped,
        status: inputPath ? 'mapped' : 'missing-selected',
        strategy: 'selection-map',
      };
    }

    const autoMatch = findTaskInput(selectedFiles, task);
    return {
      taskId: task.taskId,
      taskLabel: task.label,
      outputName: task.output?.outputName || '',
      inputPath: autoMatch.inputPath,
      selected: autoMatch.inputPath ? path.relative(selectedDir, autoMatch.inputPath) : '',
      status: autoMatch.inputPath ? 'auto-matched' : 'missing-selected',
      strategy: autoMatch.strategy,
    };
  });
}

function stageInputs(reportRoot, bindings) {
  const stagingDir = path.join(reportRoot, 'prepared-inputs');
  ensureDir(stagingDir);

  const staged = [];
  for (const binding of bindings) {
    if (!binding.inputPath) {
      continue;
    }
    const extension = path.extname(binding.inputPath).toLowerCase() || '.png';
    const stagedPath = path.join(stagingDir, `${binding.outputName}${extension}`);
    fs.copyFileSync(binding.inputPath, stagedPath);
    staged.push({
      taskId: binding.taskId,
      stagedPath,
    });
  }

  return { stagingDir, staged };
}

function writePlanReport(reportRoot, payload) {
  ensureDir(reportRoot);
  const reportPath = path.join(reportRoot, 'selected-postprocess-plan.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return reportPath;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.manifest && !options.familyMap) {
    throw new Error('缺少 --manifest 或 --family-map');
  }

  const selectionMap = loadSelectionMap(options.selectionMap);
  const selectedDir = resolveSelectedDir(options, selectionMap);
  const selectedFiles = collectImageFiles(selectedDir);
  const manifestPath = options.familyMap
    ? runCompileFromFamilyMap(options)
    : resolvePath(options.manifest);
  const manifest = readJson(manifestPath);
  const selectedTasks = options.taskIds.length > 0
    ? manifest.tasks.filter((task) => options.taskIds.includes(task.taskId))
    : manifest.tasks;
  const screenDir = path.dirname(path.dirname(manifestPath));
  const reportRoot = options.generatedRoot
    ? resolvePath(options.generatedRoot)
    : path.join(screenDir, 'generated', 'selected-postprocess');
  const selectionLookup = buildSelectionLookup(selectionMap);
  const bindings = buildBindings(selectedTasks, selectedDir, selectionLookup, selectedFiles);
  const matchedBindings = bindings.filter((binding) => Boolean(binding.inputPath));

  const plan = {
    reportVersion: '1.0',
    generatedAt: new Date().toISOString(),
    screenId: manifest.screenId,
    manifestPath: path.relative(PROJECT_ROOT, manifestPath),
    selectedDir: path.relative(PROJECT_ROOT, selectedDir),
    selectionMap: options.selectionMap ? path.relative(PROJECT_ROOT, resolvePath(options.selectionMap)) : null,
    taskCount: selectedTasks.length,
    matchedCount: matchedBindings.length,
    missingCount: bindings.filter((binding) => !binding.inputPath).length,
    bindings: bindings.map((binding) => ({
      taskId: binding.taskId,
      taskLabel: binding.taskLabel,
      outputName: binding.outputName,
      status: binding.status,
      strategy: binding.strategy,
      selected: binding.selected || null,
      inputPath: binding.inputPath ? path.relative(PROJECT_ROOT, binding.inputPath) : null,
    })),
  };

  if (options.strict && matchedBindings.length === 0) {
    const reportPath = writePlanReport(reportRoot, plan);
    throw new Error(`沒有任何 task 綁定到 selected 檔案，plan=${path.relative(PROJECT_ROOT, reportPath)}`);
  }

  const { stagingDir, staged } = stageInputs(reportRoot, matchedBindings);
  plan.stagingDir = path.relative(PROJECT_ROOT, stagingDir);
  plan.stagedCount = staged.length;

  const reportPath = writePlanReport(reportRoot, plan);
  console.log(`[run-ui-selected-postprocess] plan=${path.relative(PROJECT_ROOT, reportPath)} matched=${matchedBindings.length}/${selectedTasks.length}`);

  if (options.dryRun) {
    return;
  }

  const args = [TASK_BATCH_SCRIPT, '--manifest', manifestPath, '--input-dir', stagingDir, '--generated-root', reportRoot];
  for (const binding of matchedBindings) {
    args.push('--task-id', binding.taskId);
  }
  if (options.strict) {
    args.push('--strict');
  }

  const result = spawnSync(process.execPath, args, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

try {
  main();
} catch (error) {
  console.error(`[run-ui-selected-postprocess] ${error.message}`);
  process.exit(1);
}