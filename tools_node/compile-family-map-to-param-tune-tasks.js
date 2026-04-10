#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  writeGeneratedReview,
  writeRuntimeVerdictSkeleton,
  assertReportOk
} = require('./lib/ui-factory-manifest-validator');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PARAM_TUNE_SCHEMA_REF = '../../schemas/param-tune-manifest.schema.json';

function printHelp() {
  console.log([
    '用法：',
    '  node tools_node/compile-family-map-to-param-tune-tasks.js --family-map <file> [options]',
    '',
    '必要參數：',
    '  --family-map       family-map JSON 路徑',
    '',
    '常用選項：',
    '  --out-dir          輸出根目錄，預設使用 family-map 檔案的上一層目錄',
    '  --force            允許覆蓋既有 param-tune manifest / tasks',
    '  --skip-validate    寫檔後不做內建檢查',
    '  --dry-run          只輸出預覽，不寫檔',
    '  --help             顯示說明'
  ].join('\n'));
}

function getArg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0 || index + 1 >= process.argv.length) {
    return fallback;
  }
  return process.argv[index + 1];
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function resolvePath(inputPath) {
  if (!inputPath) {
    return '';
  }
  return path.isAbsolute(inputPath) ? inputPath : path.join(PROJECT_ROOT, inputPath);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, json, force, dryRun) {
  const content = `${JSON.stringify(json, null, 2)}\n`;
  if (!dryRun && fs.existsSync(filePath) && !force) {
    throw new Error(`檔案已存在，請加 --force 覆蓋：${path.relative(PROJECT_ROOT, filePath)}`);
  }
  if (dryRun) {
    console.log(`--- ${path.relative(PROJECT_ROOT, filePath)} ---`);
    console.log(content);
    return;
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

function kebabCase(value) {
  return String(value || '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function inferAdjustTargets(zoneSpec) {
  const zone = String(zoneSpec.zone || '').toLowerCase();
  const family = String(zoneSpec.family || '').toLowerCase();
  if (zone.includes('tab') || family.includes('tab')) {
    return ['spacing', 'selected-state-tint', 'label-padding'];
  }
  if (zone.includes('action')) {
    return ['button-spacing', 'cta-state-balance', 'secondary-button-contrast'];
  }
  if (zone.includes('header') || zone.includes('top-bar')) {
    return ['opacity', 'title-alignment', 'padding'];
  }
  if (family.includes('dark-metal')) {
    return ['spacing', 'opacity', 'state-tint'];
  }
  if (family.includes('parchment')) {
    return ['padding', 'background-opacity', 'line-height'];
  }
  return ['spacing', 'opacity'];
}

function inferSuggestedOps(zoneSpec) {
  const zone = String(zoneSpec.zone || '').toLowerCase();
  const family = String(zoneSpec.family || '').toLowerCase();
  if (zone.includes('tab') || family.includes('tab')) {
    return ['tune-tab-spacing', 'tune-selected-state-color', 'tune-tab-label-padding'];
  }
  if (zone.includes('action')) {
    return ['tune-button-row-spacing', 'tune-primary-secondary-contrast', 'tune-action-state-opacity'];
  }
  if (zone.includes('header') || zone.includes('top-bar')) {
    return ['tune-bar-padding', 'tune-label-alignment', 'tune-frame-opacity'];
  }
  return ['tune-layout-spacing', 'tune-opacity-balance'];
}

function compileParamTuneTasks(familyMap) {
  const tasks = [];
  const warnings = [];

  for (const zoneSpec of familyMap.zoneFamilyMap || []) {
    if (zoneSpec.generationNeed !== 'param-tune') {
      continue;
    }

    const task = {
      taskId: `${kebabCase(familyMap.screenId)}-${kebabCase(zoneSpec.zone)}-param-tune`,
      screenId: familyMap.screenId,
      zone: zoneSpec.zone,
      taskType: 'param-tune',
      label: `${zoneSpec.zone} param tune`,
      family: zoneSpec.family,
      recipe: zoneSpec.recipe,
      reason: zoneSpec.notes || `${zoneSpec.zone} 需要 layout / opacity / token 微調`,
      adjustTargets: inferAdjustTargets(zoneSpec),
      suggestedOps: inferSuggestedOps(zoneSpec),
      widgetRefs: zoneSpec.widgetRefs || [],
      templateRefs: zoneSpec.templateRefs || [],
      notes: zoneSpec.notes || null
    };
    tasks.push(task);
  }

  return {
    $schema: PARAM_TUNE_SCHEMA_REF,
    screenId: familyMap.screenId,
    sourceFamilyMap: familyMap.screenId,
    generatedAt: new Date().toISOString(),
    taskCount: tasks.length,
    tasks,
    warnings
  };
}

function validateParamTuneManifest(manifest, manifestPath) {
  const failReasons = [];
  if (manifest.$schema !== PARAM_TUNE_SCHEMA_REF) {
    failReasons.push({ code: 'INVALID_SCHEMA_REF', field: '$schema', message: `預期 ${PARAM_TUNE_SCHEMA_REF}` });
  }
  if (manifest.taskCount !== manifest.tasks.length) {
    failReasons.push({ code: 'TASK_COUNT_MISMATCH', field: 'taskCount', message: `taskCount=${manifest.taskCount} 但實際 tasks=${manifest.tasks.length}` });
  }
  manifest.tasks.forEach((task, index) => {
    ['taskId', 'screenId', 'zone', 'taskType', 'label', 'family', 'recipe', 'reason'].forEach((field) => {
      if (!String(task[field] || '').trim()) {
        failReasons.push({ code: 'REQUIRED_FIELD_MISSING', field: `tasks[${index}].${field}`, message: '缺少欄位或為空' });
      }
    });
    if (task.taskType !== 'param-tune') {
      failReasons.push({ code: 'INVALID_ENUM', field: `tasks[${index}].taskType`, message: '只允許 param-tune' });
    }
  });

  return {
    reportVersion: '1.0',
    validatedAt: new Date().toISOString(),
    files: [
      {
        kind: 'paramTuneManifest',
        filePath: path.relative(PROJECT_ROOT, manifestPath),
        ok: failReasons.length === 0,
        failReasons
      }
    ],
    crossFileFailReasons: [],
    summary: {
      fileCount: 1,
      failureCount: failReasons.length,
      ok: failReasons.length === 0
    }
  };
}

function main() {
  if (hasFlag('help')) {
    printHelp();
    return;
  }

  const familyMapArg = getArg('family-map');
  if (!familyMapArg) {
    throw new Error('缺少必要參數 --family-map');
  }

  const familyMapPath = resolvePath(familyMapArg);
  const outDirArg = getArg('out-dir');
  const outDir = outDirArg
    ? resolvePath(outDirArg)
    : path.dirname(path.dirname(familyMapPath));
  const force = hasFlag('force');
  const skipValidate = hasFlag('skip-validate');
  const dryRun = hasFlag('dry-run');

  const familyMap = readJson(familyMapPath);
  const tasksDir = path.join(outDir, 'tasks', 'param-tune');
  const manifestsDir = path.join(outDir, 'manifests');
  ensureDir(tasksDir);
  ensureDir(manifestsDir);

  const manifest = compileParamTuneTasks(familyMap);
  const manifestPath = path.join(manifestsDir, 'param-tune-manifest.json');

  for (const task of manifest.tasks) {
    writeJson(path.join(tasksDir, `${task.taskId}.json`), task, force, dryRun);
  }
  writeJson(manifestPath, manifest, force, dryRun);

  if (!dryRun && !skipValidate) {
    const report = validateParamTuneManifest(manifest, manifestPath);
    writeGeneratedReview(outDir, 'paramTuneManifest', report, { screenId: manifest.screenId, output: 'manifests/param-tune-manifest.json', taskCount: manifest.taskCount });
    writeRuntimeVerdictSkeleton(outDir, { screenId: manifest.screenId, latestStage: 'paramTuneManifest' });
    assertReportOk(report, '[compile-family-map-to-param-tune-tasks] 自動驗證失敗:');
  }

  console.log(`[compile-family-map-to-param-tune-tasks] screen=${manifest.screenId} tasks=${manifest.taskCount}`);
}

try {
  main();
} catch (error) {
  console.error(`[compile-family-map-to-param-tune-tasks] ${error.message}`);
  process.exitCode = 1;
}