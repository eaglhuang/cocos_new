#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const POSTPROCESS_SCRIPT = path.join(PROJECT_ROOT, 'tools_node', 'postprocess-ui-asset.js');

function parseArgs(argv) {
  const options = {
    outDir: '',
    strict: false,
    spriteType: '',
    border: '',
    spriteTypeOverridden: false,
    borderOverridden: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    switch (token) {
      case '--task':
        options.task = next;
        index += 1;
        break;
      case '--input':
        options.input = next;
        index += 1;
        break;
      case '--out-dir':
        options.outDir = next;
        index += 1;
        break;
      case '--sprite-type':
        options.spriteType = next;
        options.spriteTypeOverridden = true;
        index += 1;
        break;
      case '--border':
        options.border = next;
        options.borderOverridden = true;
        index += 1;
        break;
      case '--strict':
        options.strict = true;
        break;
      case '--help':
      case '-h':
        console.log('用法: node tools_node/run-ui-asset-postprocess.js --task <task.json> --input <raw.png> [--out-dir <dir>] [--sprite-type simple] [--border 20,20,20,20] [--strict]');
        process.exit(0);
      default:
        break;
    }
  }

  return options;
}

function ensureArgs(options) {
  if (!options.task || !options.input) {
    console.error('[run-ui-asset-postprocess] 缺少必要參數 --task 或 --input');
    process.exit(1);
  }
}

function resolvePath(inputPath) {
  return path.isAbsolute(inputPath) ? inputPath : path.join(PROJECT_ROOT, inputPath);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function deriveOutputRoot(taskPath, explicitOutDir, task) {
  if (explicitOutDir) {
    return resolvePath(explicitOutDir);
  }
  const taskDir = path.dirname(taskPath);
  const screenDir = path.dirname(taskDir);
  return path.join(screenDir, 'generated', task.taskId);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function stringifyBorder(borderValue) {
  if (!borderValue) {
    return '';
  }
  if (Array.isArray(borderValue)) {
    return borderValue.join(',');
  }
  return String(borderValue);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  ensureArgs(options);

  const taskPath = resolvePath(options.task);
  const inputPath = resolvePath(options.input);
  const task = readJson(taskPath);
  const outputRoot = deriveOutputRoot(taskPath, options.outDir, task);
  const rawDir = path.join(outputRoot, 'raw');
  const processedDir = path.join(outputRoot, 'processed');
  const reportsDir = path.join(outputRoot, 'reports');

  ensureDir(rawDir);
  ensureDir(processedDir);
  ensureDir(reportsDir);

  const rawTargetPath = path.join(rawDir, path.basename(inputPath));
  if (path.resolve(inputPath) !== path.resolve(rawTargetPath)) {
    fs.copyFileSync(inputPath, rawTargetPath);
  }

  const processedPath = path.join(processedDir, `${task.output.outputName}.png`);
  const reportPath = path.join(reportsDir, 'postprocess-report.json');
  const resultPath = path.join(outputRoot, 'postprocess-result.json');

  const spriteType = options.spriteTypeOverridden ? options.spriteType : (task.postProcess?.spriteType || 'simple');
  const border = options.borderOverridden ? options.border : stringifyBorder(task.postProcess?.border);

  const args = [POSTPROCESS_SCRIPT, '--input', rawTargetPath, '--output', processedPath, '--target-long-edge', String(task.output.targetLongEdge), '--fit-padding', String(task.postProcess?.fitPadding ?? 24), '--max-occupancy-ratio', String(task.fitRules?.maxVisualOccupancy ?? 0.65), '--report', reportPath, '--sprite-type', spriteType];
  if (task.postProcess?.trimByBackground === false) {
    args.push('--skip-trim');
  }
  if (task.postProcess?.allowFadeSide) {
    args.push('--fade-side', String(task.postProcess.allowFadeSide));
  }
  if (task.postProcess?.fadeStartRatio) {
    args.push('--fade-start-ratio', String(task.postProcess.fadeStartRatio));
  }
  if (border) {
    args.push('--border', border);
  } else if (task.postProcess?.autoDetectBorder) {
    args.push('--auto-detect-border');
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

  const summary = {
    reportVersion: '1.0',
    generatedAt: new Date().toISOString(),
    taskId: task.taskId,
    taskPath: path.relative(PROJECT_ROOT, taskPath),
    rawInput: path.relative(PROJECT_ROOT, rawTargetPath),
    processedOutput: path.relative(PROJECT_ROOT, processedPath),
    reportPath: path.relative(PROJECT_ROOT, reportPath),
      spriteType,
      border: border || null,
  };
  fs.writeFileSync(resultPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(`[run-ui-asset-postprocess] task=${task.taskId} output=${path.relative(PROJECT_ROOT, processedPath)}`);
}

main();