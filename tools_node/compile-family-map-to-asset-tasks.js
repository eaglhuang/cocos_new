#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  validateExistingScreenDir,
  writeGeneratedReview,
  writeRuntimeVerdictSkeleton,
  assertReportOk
} = require('./lib/ui-factory-manifest-validator');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ASSET_TASK_MANIFEST_SCHEMA_REF = '../../schemas/asset-task-manifest.schema.json';

const DEFAULT_ZONE_TEMPLATES = {
  headerPlaque: {
    capLeft: {
      slot: 'capLeft',
      taskIdSuffix: 'header-cap-left',
      label: 'Header 左端 ornament',
      outputName: 'header_cap_left',
      negatives: ['text', 'double rails', 'heavy dark metal', 'full frame rectangle'],
      mustKeep: ['asymmetric left cap', 'thin connector', 'light gold edge'],
      postProcess: { trimByBackground: true, allowFadeSide: 'right', fitPadding: 12 }
    },
    capRight: {
      slot: 'capRight',
      taskIdSuffix: 'header-cap-right',
      label: 'Header 右端 ornament',
      outputName: 'header_cap_right',
      negatives: ['text', 'double rails', 'heavy dark metal', 'full frame rectangle'],
      mustKeep: ['asymmetric right cap', 'thin connector', 'light gold edge'],
      postProcess: { trimByBackground: true, allowFadeSide: 'left', fitPadding: 12 }
    }
  },
  crestMedallion: {
    crestFace: {
      slot: 'crestFace',
      taskIdSuffix: 'crest-face',
      label: '命紋 face',
      outputName: 'crest_face',
      negatives: ['text', 'modern logo', 'hard bevel sci-fi look'],
      mustKeep: ['circular crest face', 'jade-parchment tone', 'ornate but readable silhouette'],
      postProcess: { trimByBackground: true, fitPadding: 8 }
    },
    crestRing: {
      slot: 'crestRing',
      taskIdSuffix: 'crest-ring',
      label: '命紋 ring',
      outputName: 'crest_ring',
      negatives: ['text', 'modern logo', 'heavy industrial frame'],
      mustKeep: ['ornate medallion ring', 'thin readable contour', 'warm jade metal language'],
      postProcess: { trimByBackground: true, fitPadding: 8 }
    }
  }
};

function printHelp() {
  console.log([
    '用法：',
    '  node tools_node/compile-family-map-to-asset-tasks.js --family-map <file> [options]',
    '',
    '必要參數：',
    '  --family-map       family-map JSON 路徑',
    '',
    '常用選項：',
    '  --out-dir          輸出根目錄，預設使用 family-map 檔案的上一層目錄',
    '  --model            生圖模型，預設 nano-banana-2',
    '  --force            允許覆蓋既有 tasks / prompts / manifest',
    '  --skip-validate    寫檔後不自動驗證',
    '  --dry-run          只輸出預覽，不寫檔',
    '  --help             顯示說明',
    '',
    '目前最小支援 zone：',
    '  - headerPlaque -> capLeft / capRight',
    '  - crestMedallion -> crestFace / crestRing'
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

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function resolvePath(inputPath) {
  if (!inputPath) {
    return '';
  }
  return path.isAbsolute(inputPath) ? inputPath : path.join(PROJECT_ROOT, inputPath);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeText(filePath, content, force, dryRun) {
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

function writeJson(filePath, json, force, dryRun) {
  writeText(filePath, `${JSON.stringify(json, null, 2)}\n`, force, dryRun);
}

function kebabCase(value) {
  return String(value || '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function buildPrompt(task) {
  const visualGoal = [
    `Create a single isolated UI partial asset for ${task.screenId}.`,
    `Zone: ${task.zone}. Slot: ${task.slot}.`,
    `Visual target: ${task.targetStyle}.`
  ].join(' ');

  const familyGuardrails = [
    `Use the ${task.family} family and ${task.recipe} recipe language.`,
    `This asset must fit inside the existing UItemplate + widget structure and cannot redefine layout.`,
    `Keep these qualities: ${task.mustKeep.join(', ')}.`
  ].join(' ');

  const hardNegatives = [
    `Avoid: ${task.mustAvoid.join(', ')}.`,
    'No layout blocks, no full-page composition, no UI text placement, no badges with letters.'
  ].join(' ');

  return [
    visualGoal,
    '',
    familyGuardrails,
    '',
    hardNegatives,
    '',
    'no text, no letters, no calligraphy, no symbols'
  ].join('\n');
}

function normalizeAssetTargets(zoneSpec) {
  if (Array.isArray(zoneSpec.assetTargets) && zoneSpec.assetTargets.length > 0) {
    return zoneSpec.assetTargets;
  }

  const defaults = DEFAULT_ZONE_TEMPLATES[zoneSpec.zone];
  if (!defaults) {
    return [];
  }
  return Object.values(defaults);
}

function mergeTargetTemplate(zoneSpec, target) {
  const defaults = DEFAULT_ZONE_TEMPLATES[zoneSpec.zone] || {};
  const template = defaults[target.slot] || {};
  return {
    ...template,
    ...target,
    mustKeep: target.mustKeep || template.mustKeep || [],
    negatives: target.negatives || template.negatives || [],
    postProcess: target.postProcess || template.postProcess || {}
  };
}

function normalizeBorderValue(border) {
  if (!border) {
    return undefined;
  }
  if (Array.isArray(border) && border.length === 4) {
    return border.map((value) => Number(value));
  }
  return border;
}

function normalizePostProcess(postProcess) {
  const source = postProcess && typeof postProcess === 'object' ? postProcess : {};
  const normalized = {
    trimByBackground: source.trimByBackground !== false,
  };

  if (source.allowFadeSide) {
    normalized.allowFadeSide = source.allowFadeSide;
  }
  if (typeof source.fadeStartRatio === 'number') {
    normalized.fadeStartRatio = source.fadeStartRatio;
  }
  if (typeof source.fitPadding === 'number') {
    normalized.fitPadding = source.fitPadding;
  }

  const normalizedBorder = normalizeBorderValue(source.border);
  const inferredSpriteType = source.spriteType || (normalizedBorder || source.autoDetectBorder ? 'sliced' : 'simple');
  normalized.spriteType = inferredSpriteType;

  if (normalizedBorder !== undefined) {
    normalized.border = normalizedBorder;
  }
  if (typeof source.autoDetectBorder === 'boolean') {
    normalized.autoDetectBorder = source.autoDetectBorder;
  }

  return normalized;
}

function shouldCompileZone(zoneSpec) {
  const need = String(zoneSpec.generationNeed || '').trim();
  return need === 'generate-partial-asset' || need === 'partial' || need === 'new-family-required';
}

function compileTasks(familyMap, model) {
  const screenId = familyMap.screenId;
  const taskEntries = [];
  const warnings = [];

  for (const zoneSpec of familyMap.zoneFamilyMap || []) {
    if (!shouldCompileZone(zoneSpec)) {
      continue;
    }

    const targets = normalizeAssetTargets(zoneSpec);
    if (targets.length === 0) {
      warnings.push(`zone ${zoneSpec.zone} 標示需要生成，但沒有可編譯的 assetTargets`);
      continue;
    }

    for (const rawTarget of targets) {
      const target = mergeTargetTemplate(zoneSpec, rawTarget);
      const taskId = `${kebabCase(screenId)}-${target.taskIdSuffix}`;
      const task = {
        taskId,
        screenId,
        model,
        zone: zoneSpec.zone,
        slot: target.slot,
        taskType: 'generate-partial-asset',
        label: target.label || target.taskIdSuffix,
        family: zoneSpec.family,
        recipe: zoneSpec.recipe,
        structureOwner: zoneSpec.structureOwner,
        skinOwner: zoneSpec.skinOwner,
        contentOwner: zoneSpec.contentOwner,
        widgetRefs: zoneSpec.widgetRefs || [],
        templateRefs: zoneSpec.templateRefs || [],
        targetStyle: `${zoneSpec.family} / ${zoneSpec.recipe}`,
        mustKeep: target.mustKeep,
        mustAvoid: target.negatives,
        fitRules: {
          maxVisualOccupancy: 0.65,
          runtimeIntrusionForbidden: true
        },
        postProcess: normalizePostProcess(target.postProcess),
        output: {
          preferredMime: 'image/png',
          targetLongEdge: 512,
          transparentBackgroundPreferred: true,
          outputName: target.outputName || taskId
        }
      };
      taskEntries.push(task);
    }
  }

  return {
    $schema: ASSET_TASK_MANIFEST_SCHEMA_REF,
    screenId,
    sourceFamilyMap: familyMap.screenId,
    generatedAt: new Date().toISOString(),
    taskCount: taskEntries.length,
    tasks: taskEntries,
    warnings
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
  const model = getArg('model', 'nano-banana-2');
  const force = hasFlag('force');
  const skipValidate = hasFlag('skip-validate');
  const dryRun = hasFlag('dry-run');

  const familyMap = readJson(familyMapPath);
  if (!familyMap.screenId || !Array.isArray(familyMap.zoneFamilyMap)) {
    throw new Error('family-map 缺少 screenId 或 zoneFamilyMap');
  }

  const tasksDir = path.join(outDir, 'tasks');
  const promptsDir = path.join(outDir, 'prompts');
  const manifestsDir = path.join(outDir, 'manifests');

  ensureDir(tasksDir);
  ensureDir(promptsDir);
  ensureDir(manifestsDir);

  const manifest = compileTasks(familyMap, model);
  const manifestPath = path.join(manifestsDir, 'asset-task-manifest.json');

  for (const task of manifest.tasks) {
    const taskPath = path.join(tasksDir, `${task.taskId}.json`);
    const promptPath = path.join(promptsDir, `${task.taskId}.txt`);
    writeJson(taskPath, task, force, dryRun);
    writeText(promptPath, `${buildPrompt(task)}\n`, force, dryRun);
  }

  writeJson(manifestPath, manifest, force, dryRun);
  if (!dryRun && !skipValidate) {
    const report = validateExistingScreenDir(outDir, ['intake', 'familyMap', 'assetTaskManifest']);
    writeGeneratedReview(outDir, 'assetTaskManifest', report, { screenId: manifest.screenId, output: 'manifests/asset-task-manifest.json', taskCount: manifest.taskCount });
    writeRuntimeVerdictSkeleton(outDir, { screenId: manifest.screenId, latestStage: 'assetTaskManifest' });
    assertReportOk(report, '[compile-family-map-to-asset-tasks] 自動驗證失敗:');
  }

  console.log(`[compile-family-map-to-asset-tasks] screen=${manifest.screenId} tasks=${manifest.taskCount}`);
  if (manifest.warnings.length > 0) {
    for (const warning of manifest.warnings) {
      console.warn(`[compile-family-map-to-asset-tasks] warning: ${warning}`);
    }
  }
}

try {
  main();
} catch (error) {
  console.error(`[compile-family-map-to-asset-tasks] ${error.message}`);
  process.exitCode = 1;
}