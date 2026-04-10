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
const INTAKE_SCHEMA_REF = '../../schemas/intake.schema.json';

function printHelp() {
  console.log([
    '用法：',
    '  node tools_node/intake-ui-screen.js --screen-id <ScreenId> [options]',
    '',
    '必要參數：',
    '  --screen-id         ScreenId，例如 GeneralDetailOverview',
    '',
    '常用選項：',
    '  --screen-spec       screen spec JSON 路徑，用來推導 familyId / uiId / bundle / layer',
    '  --reference         逗號分隔 canonical reference 路徑或 ref:// 來源',
    '  --runtime-capture   逗號分隔 runtime capture 路徑',
    '  --template-family   手動指定 template family，未指定時優先讀 screen spec.contentRequirements.familyId',
    '  --risk-zones        逗號分隔風險 zones，例如 headerPlaque,crestMedallion,portraitStage',
    '  --smoke-route       可重現 capture 命令',
    '  --tier              手動指定 Tier A/B/C',
    '  --new-family        強制視為 Tier C',
    '  --notes             補充說明',
    '  --out-dir           輸出根目錄，預設 artifacts/ui-source/<screen-id-kebab>',
    '  --force             允許覆蓋既有 intake.json',
    '  --skip-validate     寫檔後不自動驗證',
    '  --dry-run           只輸出預覽，不寫檔',
    '  --help              顯示說明'
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function kebabCase(value) {
  return String(value || '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function parseList(rawValue) {
  return String(rawValue || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function unique(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function inferTier({ explicitTier, newFamily, templateFamilyCandidate, riskZones }) {
  if (explicitTier) {
    return String(explicitTier).trim().toUpperCase();
  }
  if (newFamily || !templateFamilyCandidate) {
    return 'C';
  }
  if (riskZones.length <= 1) {
    return 'A';
  }
  if (riskZones.length <= 6) {
    return 'B';
  }
  return 'C';
}

function buildSmokeRoute(screenId) {
  return `node tools_node/capture-ui-screens.js --target ${screenId} --outDir artifacts/ui-qa/${kebabCase(screenId)}/runtime-smoke`;
}

function main() {
  if (hasFlag('help')) {
    printHelp();
    return;
  }

  const screenId = getArg('screen-id');
  if (!screenId) {
    throw new Error('缺少必要參數 --screen-id');
  }

  const screenSpecArg = getArg('screen-spec');
  const screenSpecPath = resolvePath(screenSpecArg);
  const screenSpec = screenSpecPath ? readJson(screenSpecPath) : null;

  const outDirArg = getArg('out-dir');
  const outDir = outDirArg
    ? resolvePath(outDirArg)
    : path.join(PROJECT_ROOT, 'artifacts', 'ui-source', kebabCase(screenId));
  const manifestsDir = path.join(outDir, 'manifests');
  const outputPath = path.join(manifestsDir, 'intake.json');

  const references = parseList(getArg('reference'));
  const runtimeCaptures = parseList(getArg('runtime-capture'));
  const riskZones = unique(parseList(getArg('risk-zones')));
  const templateFamilyCandidate = getArg('template-family')
    || screenSpec?.contentRequirements?.familyId
    || '';
  const smokeRoute = getArg('smoke-route') || buildSmokeRoute(screenId);
  const tier = inferTier({
    explicitTier: getArg('tier'),
    newFamily: hasFlag('new-family'),
    templateFamilyCandidate,
    riskZones
  });
  const notes = getArg('notes');
  const force = hasFlag('force');
  const skipValidate = hasFlag('skip-validate');
  const dryRun = hasFlag('dry-run');

  const canonicalReferences = unique([...references, ...runtimeCaptures]);

  ensureDir(manifestsDir);

  const intake = {
    $schema: INTAKE_SCHEMA_REF,
    screenId,
    tier,
    templateFamilyCandidate,
    uiId: screenSpec?.uiId || screenId,
    sourceOfTruth: {
      screenSpec: screenSpecArg || null,
      layout: screenSpec?.layout || null,
      skin: screenSpec?.skin || null,
      bundle: screenSpec?.bundle || null,
      layer: screenSpec?.layer || null
    },
    canonicalReferences,
    riskZones,
    smokeRoute,
    notes: notes || null,
    generatedAt: new Date().toISOString(),
    generatedBy: 'tools_node/intake-ui-screen.js'
  };

  writeJson(outputPath, intake, force, dryRun);
  if (!dryRun && !skipValidate) {
    const report = validateExistingScreenDir(outDir, ['intake']);
    writeGeneratedReview(outDir, 'intake', report, { screenId, output: 'manifests/intake.json' });
    assertReportOk(report, '[intake-ui-screen] 自動驗證失敗:');
  }
  console.log(`[intake-ui-screen] screen=${screenId} tier=${tier} references=${canonicalReferences.length} riskZones=${riskZones.length}`);
}

try {
  main();
} catch (error) {
  console.error(`[intake-ui-screen] ${error.message}`);
  process.exitCode = 1;
}