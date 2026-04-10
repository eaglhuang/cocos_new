#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  validateExistingScreenDir,
  writeGeneratedReview,
  assertReportOk
} = require('./lib/ui-factory-manifest-validator');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const FAMILY_MAP_SCHEMA_REF = '../../schemas/family-map.schema.json';

const DEFAULT_RECIPE_BY_FAMILY = {
  'dark-metal': 'dark-metal-v1',
  parchment: 'parchment-v1',
  'gold-cta': 'gold-cta-v1',
  destructive: 'destructive-v1',
  tab: 'tab-v1',
  'item-cell': 'item-cell-v1',
  'panel-light': 'panel-light-v1',
  none: ''
};

function printHelp() {
  console.log([
    '用法：',
    '  node tools_node/compile-proof-to-family-map.js --proof <file> [options]',
    '',
    '必要參數：',
    '  --proof            proof-contract JSON 路徑',
    '',
    '常用選項：',
    '  --out-dir          輸出根目錄，預設使用 proof 檔案的上一層目錄',
    '  --force            允許覆蓋既有 family-map',
    '  --skip-validate    寫檔後不自動驗證',
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

function getComponentIntentsByZone(proof) {
  const map = new Map();
  for (const intent of proof.componentIntents || []) {
    const key = kebabCase(intent.zone);
    const list = map.get(key) || [];
    list.push(intent);
    map.set(key, list);
  }
  return map;
}

function inferDetailSplitZoneConfig(zoneId) {
  if (zoneId.includes('portrait')) {
    return {
      family: 'portrait-stage',
      recipe: 'ink-stage-standard',
      generationNeed: 'reuse-only',
      widgetRefs: ['portrait-viewport', 'portrait-shadow', 'portrait-glow'],
      templateRefs: ['detail-split']
    };
  }
  if (zoneId.includes('header')) {
    return {
      family: 'header-rarity-plaque',
      recipe: 'jade-parchment-light',
      generationNeed: 'generate-partial-asset',
      widgetRefs: ['header-title-block', 'rarity-badge-dock'],
      templateRefs: ['detail-split'],
      assetTargets: [
        { slot: 'capLeft', taskIdSuffix: 'header-cap-left', label: 'Header 左端 ornament', outputName: 'header_cap_left' },
        { slot: 'capRight', taskIdSuffix: 'header-cap-right', label: 'Header 右端 ornament', outputName: 'header_cap_right' }
      ]
    };
  }
  if (zoneId.includes('bloodline')) {
    return {
      family: 'parchment-body-card',
      recipe: 'bloodline-summary-standard',
      generationNeed: 'reuse-only',
      widgetRefs: ['body-card', 'awakening-bar'],
      templateRefs: ['detail-split']
    };
  }
  if (zoneId.includes('awakening')) {
    return {
      family: 'awakening-track',
      recipe: 'parchment-awakening-standard',
      generationNeed: 'reuse-only',
      widgetRefs: ['awakening-bar', 'awakening-chip'],
      templateRefs: ['detail-split']
    };
  }
  if (zoneId.includes('summary')) {
    return {
      family: 'summary-card-grid',
      recipe: 'parchment-summary-standard',
      generationNeed: 'reuse-only',
      widgetRefs: ['summary-card', 'metric-card'],
      templateRefs: ['detail-split']
    };
  }
  if (zoneId.includes('crest')) {
    return {
      family: 'crest-medallion',
      recipe: 'jade-ornate-medallion',
      generationNeed: 'generate-partial-asset',
      widgetRefs: ['crest-carrier', 'crest-state-label'],
      templateRefs: ['detail-split'],
      assetTargets: [
        { slot: 'crestFace', taskIdSuffix: 'crest-face', label: '命紋 face', outputName: 'crest_face' },
        { slot: 'crestRing', taskIdSuffix: 'crest-ring', label: '命紋 ring', outputName: 'crest_ring' }
      ]
    };
  }
  if (zoneId.includes('story')) {
    return {
      family: 'story-strip-rail',
      recipe: 'story-strip-standard',
      generationNeed: 'reuse-only',
      widgetRefs: ['story-cell', 'story-caption'],
      templateRefs: ['detail-split']
    };
  }
  return null;
}

function inferIconZoneConfig(zoneId) {
  if (zoneId.includes('currency')) {
    return {
      family: 'icon-currency-suite',
      recipe: 'lobby-currency-icon-v1',
      generationNeed: 'generate-partial-asset',
      widgetRefs: ['icon-glyph', 'icon-underlay', 'count-chip'],
      templateRefs: [],
      assetTargets: [
        {
          slot: 'currencyGlyph',
          taskIdSuffix: `${zoneId}-currency-glyph`,
          label: '貨幣 icon glyph',
          outputName: `${zoneId}_currency_glyph`,
          negatives: ['text', 'letters', 'full button', 'photo texture', 'realistic coin pile'],
          mustKeep: ['clean center glyph', 'single icon silhouette', 'readable at small size', 'same family batch consistency'],
          postProcess: { trimByBackground: true, fitPadding: 8 }
        },
        {
          slot: 'currencyUnderlay',
          taskIdSuffix: `${zoneId}-currency-underlay`,
          label: '貨幣 icon 襯底',
          outputName: `${zoneId}_currency_underlay`,
          negatives: ['text', 'letters', 'full frame', 'heavy vignette'],
          mustKeep: ['subtle underlay plate', 'supports runtime count text', 'same family batch consistency'],
          postProcess: { trimByBackground: true, fitPadding: 10 }
        }
      ]
    };
  }

  if (zoneId.includes('badge') || zoneId.includes('tier') || zoneId.includes('medal')) {
    return {
      family: 'icon-badge-suite',
      recipe: 'lobby-badge-icon-v1',
      generationNeed: 'generate-partial-asset',
      widgetRefs: ['badge-underlay', 'badge-fill', 'badge-glyph'],
      templateRefs: [],
      assetTargets: [
        {
          slot: 'badgeGlyph',
          taskIdSuffix: `${zoneId}-badge-glyph`,
          label: 'badge 主 glyph',
          outputName: `${zoneId}_badge_glyph`,
          negatives: ['text', 'letters', 'numbers', 'full panel rectangle'],
          mustKeep: ['single centered badge glyph', 'small-size readability', 'batch-consistent ornament language'],
          postProcess: { trimByBackground: true, fitPadding: 8 }
        },
        {
          slot: 'badgeUnderlay',
          taskIdSuffix: `${zoneId}-badge-underlay`,
          label: 'badge 襯底 / underlay',
          outputName: `${zoneId}_badge_underlay`,
          negatives: ['text', 'letters', 'heavy metal frame', 'deep perspective'],
          mustKeep: ['supports runtime label overlay', 'flat readable silhouette', 'same family batch consistency'],
          postProcess: { trimByBackground: true, fitPadding: 10 }
        }
      ]
    };
  }

  return {
    family: 'icon-suite',
    recipe: 'lobby-icon-suite-v1',
    generationNeed: 'generate-partial-asset',
    widgetRefs: ['icon-glyph', 'icon-underlay'],
    templateRefs: [],
    assetTargets: [
      {
        slot: 'iconGlyph',
        taskIdSuffix: `${zoneId}-icon-glyph`,
        label: '主 icon glyph',
        outputName: `${zoneId}_icon_glyph`,
        negatives: ['text', 'letters', 'full button', 'photo texture'],
        mustKeep: ['single clear glyph silhouette', 'small-size readability', 'same family batch consistency'],
        postProcess: { trimByBackground: true, fitPadding: 8 }
      }
    ]
  };
}

function inferTemplateFamilyCandidate(proof) {
  const zoneIds = (proof.visualZones || []).map((zone) => kebabCase(zone.id));
  const hasPortrait = zoneIds.some((zoneId) => zoneId.includes('portrait'));
  const hasHeader = zoneIds.some((zoneId) => zoneId.includes('header'));
  const hasRightRail = zoneIds.some((zoneId) => zoneId.includes('crest') || zoneId.includes('bloodline') || zoneId.includes('summary'));
  if (hasPortrait && hasHeader && hasRightRail) {
    return 'detail-split';
  }
  return '';
}

function inferZoneConfig(screenId, zone, intents, templateFamilyCandidate) {
  const zoneId = kebabCase(zone.id);
  const nodeHints = new Set(intents.map((item) => item.nodeHint));
  const binds = intents.map((item) => item.bind).filter(Boolean);

  if (templateFamilyCandidate === 'detail-split') {
    const detailSplitConfig = inferDetailSplitZoneConfig(zoneId);
    if (detailSplitConfig) {
      return detailSplitConfig;
    }
  }

  if (zone.family === 'dark-metal') {
    return {
      family: 'dark-metal',
      recipe: zone.frameRecipeRef || DEFAULT_RECIPE_BY_FAMILY['dark-metal'],
      generationNeed: nodeHints.has('button') ? 'param-tune' : 'reuse-only',
      widgetRefs: nodeHints.has('grid') ? ['unit-card'] : [],
      templateRefs: []
    };
  }

  if (zone.family === 'parchment') {
    return {
      family: binds.some((bind) => String(bind).includes('[]')) ? 'parchment-list' : 'parchment-panel',
      recipe: zone.frameRecipeRef || DEFAULT_RECIPE_BY_FAMILY.parchment,
      generationNeed: 'reuse-only',
      widgetRefs: nodeHints.has('scroll-list') ? ['list-panel'] : ['body-card'],
      templateRefs: []
    };
  }

  if (zone.family === 'gold-cta') {
    return {
      family: 'gold-cta',
      recipe: zone.frameRecipeRef || DEFAULT_RECIPE_BY_FAMILY['gold-cta'],
      generationNeed: 'reuse-only',
      widgetRefs: ['cta-button'],
      templateRefs: []
    };
  }

  if (zone.family === 'icon') {
    return inferIconZoneConfig(zoneId);
  }

  if (zone.family === 'tab') {
    return {
      family: 'tab-strip',
      recipe: zone.frameRecipeRef || DEFAULT_RECIPE_BY_FAMILY.tab,
      generationNeed: 'param-tune',
      widgetRefs: ['tab-bar'],
      templateRefs: []
    };
  }

  if (zone.family === 'item-cell') {
    return {
      family: 'item-cell-grid',
      recipe: zone.frameRecipeRef || DEFAULT_RECIPE_BY_FAMILY['item-cell'],
      generationNeed: 'reuse-only',
      widgetRefs: ['item-cell'],
      templateRefs: []
    };
  }

  return {
    family: zone.family || 'none',
    recipe: zone.frameRecipeRef || DEFAULT_RECIPE_BY_FAMILY[zone.family] || '',
    generationNeed: 'reuse-only',
    widgetRefs: [],
    templateRefs: []
  };
}

function compileFamilyMap(proof) {
  const intentMap = getComponentIntentsByZone(proof);
  const templateFamilyCandidate = inferTemplateFamilyCandidate(proof);
  const zoneFamilyMap = (proof.visualZones || []).map((zone) => {
    const zoneId = kebabCase(zone.id);
    const intents = intentMap.get(zoneId) || [];
    const config = inferZoneConfig(proof.screenId, zone, intents, templateFamilyCandidate);
    return {
      zone: zone.id,
      family: config.family,
      recipe: config.recipe,
      structureOwner: 'UITemplateResolver+widget-compose',
      skinOwner: 'UISkinResolver',
      contentOwner: 'contentContract',
      generationNeed: config.generationNeed,
      widgetRefs: config.widgetRefs,
      templateRefs: config.templateRefs,
      assetTargets: config.assetTargets || undefined,
      sourceProofFamily: zone.family,
      sourceProofRecipe: zone.frameRecipeRef || null,
      notes: zone.notes || null
    };
  }).map((zoneSpec) => {
    if (!zoneSpec.assetTargets) {
      delete zoneSpec.assetTargets;
    }
    return zoneSpec;
  });

  return {
    $schema: FAMILY_MAP_SCHEMA_REF,
    screenId: proof.screenId,
    templateFamilyCandidate,
    sourceProof: proof.proofSource,
    generatedAt: new Date().toISOString(),
    zoneFamilyMap
  };
}

function main() {
  if (hasFlag('help')) {
    printHelp();
    return;
  }

  const proofArg = getArg('proof');
  if (!proofArg) {
    throw new Error('缺少必要參數 --proof');
  }

  const proofPath = resolvePath(proofArg);
  const outDirArg = getArg('out-dir');
  const outDir = outDirArg
    ? resolvePath(outDirArg)
    : path.dirname(path.dirname(proofPath));
  const force = hasFlag('force');
  const skipValidate = hasFlag('skip-validate');
  const dryRun = hasFlag('dry-run');

  const proof = readJson(proofPath);
  if (!proof.screenId || !Array.isArray(proof.visualZones)) {
    throw new Error('proof 缺少 screenId 或 visualZones');
  }

  const proofDir = path.join(outDir, 'proof');
  ensureDir(proofDir);

  const familyMap = compileFamilyMap(proof);
  const outPath = path.join(proofDir, `${kebabCase(proof.screenId)}.family-map.json`);
  writeJson(outPath, familyMap, force, dryRun);
  if (!dryRun && !skipValidate) {
    const report = validateExistingScreenDir(outDir, ['intake', 'familyMap']);
    writeGeneratedReview(outDir, 'familyMap', report, { screenId: proof.screenId, output: path.relative(outDir, outPath) });
    assertReportOk(report, '[compile-proof-to-family-map] 自動驗證失敗:');
  }

  console.log(`[compile-proof-to-family-map] screen=${proof.screenId} zones=${familyMap.zoneFamilyMap.length}`);
}

try {
  main();
} catch (error) {
  console.error(`[compile-proof-to-family-map] ${error.message}`);
  process.exitCode = 1;
}