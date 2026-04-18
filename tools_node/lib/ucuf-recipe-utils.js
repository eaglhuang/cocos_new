'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

function getArg(argv, name, fallback = '') {
  const index = argv.indexOf(`--${name}`);
  if (index < 0 || index + 1 >= argv.length) {
    return fallback;
  }
  return argv[index + 1];
}

function hasFlag(argv, name) {
  return argv.includes(`--${name}`);
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

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeText(filePath, content, dryRun) {
  if (dryRun) {
    console.log(`--- ${path.relative(PROJECT_ROOT, filePath)} ---`);
    console.log(content);
    return;
  }

  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

function writeJson(filePath, json, dryRun) {
  writeText(filePath, `${JSON.stringify(json, null, 2)}\n`, dryRun);
}

function recipeBaseName(screenId) {
  return String(screenId || '').replace(/-screen$/, '');
}

function loadEnums() {
  return readJson(path.join(PROJECT_ROOT, 'docs', 'ui', 'ucuf-screen-recipe.enums.json'));
}

function validateRecipe(recipe) {
  const enums = loadEnums();
  const failures = [];

  const requireString = (key) => {
    if (!recipe[key] || typeof recipe[key] !== 'string' || !recipe[key].trim()) {
      failures.push(`缺少必要字串欄位: ${key}`);
    }
  };

  requireString('screenId');
  requireString('uiId');
  requireString('familyId');
  requireString('bundle');
  requireString('layer');
  requireString('controllerKind');
  requireString('contentSchemaId');
  requireString('generationPolicy');
  requireString('validationProfile');
  requireString('smokeRoute');

  if (!enums.familyId.includes(recipe.familyId)) {
    failures.push(`familyId 不在 enum 中: ${recipe.familyId}`);
  }
  if (!enums.bundle.includes(recipe.bundle)) {
    failures.push(`bundle 不在 enum 中: ${recipe.bundle}`);
  }
  if (!enums.layer.includes(recipe.layer)) {
    failures.push(`layer 不在 enum 中: ${recipe.layer}`);
  }
  if (!enums.controllerKind.includes(recipe.controllerKind)) {
    failures.push(`controllerKind 不在 enum 中: ${recipe.controllerKind}`);
  }
  if (!enums.generationPolicy.includes(recipe.generationPolicy)) {
    failures.push(`generationPolicy 不在 enum 中: ${recipe.generationPolicy}`);
  }
  if (!enums.validationProfile.includes(recipe.validationProfile)) {
    failures.push(`validationProfile 不在 enum 中: ${recipe.validationProfile}`);
  }

  if (!Array.isArray(recipe.dataSources) || recipe.dataSources.length === 0) {
    failures.push('dataSources 必須為非空陣列');
  } else {
    for (const source of recipe.dataSources) {
      if (!source || typeof source !== 'object') {
        failures.push('dataSources 項目必須為 object');
        continue;
      }
      if (!enums.dataSourceKind.includes(source.kind)) {
        failures.push(`dataSource.kind 不在 enum 中: ${source.kind}`);
      }
      if (!source.sourceId) {
        failures.push('dataSources.sourceId 不可為空');
      }
      if (!source.bindPath) {
        failures.push(`dataSources[${source.sourceId || '?'}].bindPath 不可為空`);
      }
    }
  }

  if (!Array.isArray(recipe.slots) || recipe.slots.length === 0) {
    failures.push('slots 必須為非空陣列');
  } else {
    for (const slot of recipe.slots) {
      if (!slot || typeof slot !== 'object') {
        failures.push('slots 項目必須為 object');
        continue;
      }
      if (!slot.slotId) {
        failures.push('slot.slotId 不可為空');
      }
      if (!slot.zoneId) {
        failures.push(`slot[${slot.slotId || '?'}].zoneId 不可為空`);
      }
      if (!enums.slotMode.includes(slot.mode)) {
        failures.push(`slot.mode 不在 enum 中: ${slot.mode}`);
      }
    }
  }

  if (!recipe.chromeFlags || typeof recipe.chromeFlags !== 'object') {
    failures.push('chromeFlags 必須為 object');
  }

  if (failures.length > 0) {
    throw new Error(`[ucuf-recipe] recipe 驗證失敗:\n- ${failures.join('\n- ')}`);
  }

  return recipe;
}

function loadRecipe(recipePath) {
  const fullPath = resolvePath(recipePath);
  if (!fullPath || !fs.existsSync(fullPath)) {
    throw new Error(`找不到 recipe：${recipePath}`);
  }
  const recipe = readJson(fullPath);
  validateRecipe(recipe);
  return { recipe, recipePath: fullPath };
}

module.exports = {
  PROJECT_ROOT,
  ensureDir,
  getArg,
  hasFlag,
  loadRecipe,
  readJson,
  recipeBaseName,
  resolvePath,
  validateRecipe,
  writeJson,
  writeText,
};