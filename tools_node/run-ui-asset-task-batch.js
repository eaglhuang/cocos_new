#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const COMPILE_SCRIPT = path.join(PROJECT_ROOT, 'tools_node', 'compile-family-map-to-asset-tasks.js');
const TASK_POSTPROCESS_SCRIPT = path.join(PROJECT_ROOT, 'tools_node', 'run-ui-asset-postprocess.js');
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

function parseArgs(argv) {
  const options = {
    manifest: '',
    familyMap: '',
    inputDir: '',
    generatedRoot: '',
    taskIds: [],
    strict: false,
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
      case '--input-dir':
        options.inputDir = next;
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
      case '--compile-force':
        options.compileForce = true;
        break;
      case '--compile-skip-validate':
        options.compileSkipValidate = true;
        break;
      case '--help':
      case '-h':
        console.log([
          '用法：',
          '  node tools_node/run-ui-asset-task-batch.js --manifest <asset-task-manifest.json> --input-dir <raw-dir> [options]',
          '  node tools_node/run-ui-asset-task-batch.js --family-map <family-map.json> --input-dir <raw-dir> [options]',
          '',
          '常用選項：',
          '  --task-id <id>             只跑特定 task，可重複傳入',
          '  --generated-root <dir>     指定 processed output 根目錄',
          '  --compile-force            family-map 模式允許覆蓋既有 manifest/task',
          '  --compile-skip-validate    family-map 模式略過 compile 後自動驗證',
          '  --strict                   任一 task 失敗或缺 raw input 即 exit 1',
        ].join('\n'));
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

function ensureArgs(options) {
  if (!options.manifest && !options.familyMap) {
    throw new Error('缺少 --manifest 或 --family-map');
  }
  if (!options.inputDir) {
    throw new Error('缺少 --input-dir');
  }
  const inputDir = resolvePath(options.inputDir);
  if (!fs.existsSync(inputDir)) {
    throw new Error(`找不到 input dir: ${inputDir}`);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

function findInputForTask(inputDir, task) {
  const candidates = [
    task.taskId,
    task.output?.outputName,
    task.slot,
  ].filter(Boolean);

  for (const name of candidates) {
    for (const extension of IMAGE_EXTENSIONS) {
      const candidate = path.join(inputDir, `${name}${extension}`);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return '';
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  ensureArgs(options);

  const manifestPath = options.familyMap
    ? runCompileFromFamilyMap(options)
    : resolvePath(options.manifest);
  const manifest = readJson(manifestPath);
  const screenDir = path.dirname(path.dirname(manifestPath));
  const tasksDir = path.join(screenDir, 'tasks');
  const inputDir = resolvePath(options.inputDir);
  const selectedTasks = options.taskIds.length > 0
    ? manifest.tasks.filter((task) => options.taskIds.includes(task.taskId))
    : manifest.tasks;

  const results = [];
  for (const task of selectedTasks) {
    const taskPath = path.join(tasksDir, `${task.taskId}.json`);
    const inputPath = findInputForTask(inputDir, task);
    if (!inputPath) {
      results.push({
        taskId: task.taskId,
        status: 'missing-input',
        searchedIn: path.relative(PROJECT_ROOT, inputDir),
      });
      console.warn(`[run-ui-asset-task-batch] missing input for ${task.taskId}`);
      continue;
    }

    const args = [TASK_POSTPROCESS_SCRIPT, '--task', taskPath, '--input', inputPath];
    if (options.generatedRoot) {
      const outDir = path.join(resolvePath(options.generatedRoot), task.taskId);
      args.push('--out-dir', outDir);
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
    results.push({
      taskId: task.taskId,
      input: path.relative(PROJECT_ROOT, inputPath),
      status: result.status === 0 ? 'ok' : 'failed',
      exitCode: result.status ?? null,
    });
  }

  const reportDir = options.generatedRoot ? resolvePath(options.generatedRoot) : path.join(screenDir, 'generated');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, 'postprocess-batch-report.json');
  const report = {
    reportVersion: '1.0',
    generatedAt: new Date().toISOString(),
    manifestPath: path.relative(PROJECT_ROOT, manifestPath),
    inputDir: path.relative(PROJECT_ROOT, inputDir),
    taskCount: selectedTasks.length,
    okCount: results.filter((item) => item.status === 'ok').length,
    missingInputCount: results.filter((item) => item.status === 'missing-input').length,
    failedCount: results.filter((item) => item.status === 'failed').length,
    results,
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`[run-ui-asset-task-batch] report=${path.relative(PROJECT_ROOT, reportPath)} ok=${report.okCount}/${report.taskCount}`);
  if (options.strict && (report.missingInputCount > 0 || report.failedCount > 0)) {
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error(`[run-ui-asset-task-batch] ${error.message}`);
  process.exit(1);
}