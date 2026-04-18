#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  PROJECT_ROOT,
  ensureDir,
  getArg,
  hasFlag,
  loadRecipe,
  readJson,
  recipeBaseName,
  resolvePath,
  writeJson,
} = require('./lib/ucuf-recipe-utils');
const {
  assertReportOk,
  validateExistingScreenDir,
  writeGeneratedReview,
  writeRuntimeVerdictSkeleton,
} = require('./lib/ui-factory-manifest-validator');

function slugify(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function printHelp() {
  console.log([
    '用法：',
    '  node tools_node/compile-recipe-to-screen-spec.js --recipe <file> [options]',
    '',
    '必要參數：',
    '  --recipe         UCUF screen recipe JSON 路徑',
    '',
    '常用選項：',
    '  --out            指定輸出 screen JSON 路徑',
    '  --screen-dir     指定 artifacts/ui-source/<screen> 根目錄',
    '  --emit-intake    同步產生 manifests/intake.json skeleton',
    '  --emit-asset-manifest  同步產生 manifests/asset-task-manifest.json skeleton',
    '  --intake-tier    intake tier，預設 C',
    '  --skip-review    正式寫入時不產生 review skeleton',
    '  --write          寫入檔案；未指定時為 dry-run',
    '  --help           顯示說明',
    '',
    'v1 範圍：',
    '  - 正規化 screen spec metadata',
    '  - 正式寫入時同步產生 generated-review / runtime-verdict skeleton',
    '  - 可選擇產生 intake / asset-task-manifest skeleton，並接上 validator',
    '  - 不改 layout / skin / child panel 程式碼',
    '  - 預設保留既有 validation / content / tabRouting 等欄位',
  ].join('\n'));
}

function buildContentRequirements(recipe) {
  return {
    schemaId: recipe.contentSchemaId,
    familyId: recipe.familyId,
    requiredFields: recipe.dataSources
      .filter((source) => source.required)
      .map((source) => source.sourceId),
  };
}

function buildValidation(existing) {
  if (existing && typeof existing === 'object') {
    return existing;
  }

  return {
    devices: ['phone-16-9', 'phone-19_5-9', 'tablet-4-3'],
    allowMissingSkin: true,
  };
}

function buildDeliverables(recipe, targetPath) {
  const items = [path.relative(PROJECT_ROOT, targetPath)];

  if (recipe.layoutId) {
    items.push(`assets/resources/ui-spec/layouts/${recipe.layoutId}.json`);
  }
  if (recipe.skinId) {
    items.push(`assets/resources/ui-spec/skins/${recipe.skinId}.json`);
  }
  if (recipe.contentSchemaId) {
    items.push(`assets/resources/ui-spec/contracts/${recipe.contentSchemaId}.schema.json`);
  }
  if (recipe.controllerClass) {
    items.push(`assets/scripts/ui/components/${recipe.controllerClass}.ts`);
  }

  return items;
}

function unique(values) {
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.trim().length > 0)));
}

function buildIntakeSkeleton(recipe, recipePath, targetPath, normalized, intakeTier) {
  return {
    $schema: '../../schemas/intake.schema.json',
    screenId: recipe.screenId,
    tier: intakeTier,
    templateFamilyCandidate: recipe.familyId,
    uiId: recipe.uiId,
    sourceOfTruth: {
      screenSpec: path.relative(PROJECT_ROOT, targetPath),
      layout: normalized.layout || null,
      skin: normalized.skin || null,
      bundle: recipe.bundle || null,
      layer: recipe.layer || null,
    },
    canonicalReferences: unique([
      path.relative(PROJECT_ROOT, recipePath),
      path.relative(PROJECT_ROOT, targetPath),
      'docs/ui/UCUF-UI-template-blueprint.md',
    ]),
    riskZones: unique(recipe.slots.map((slot) => slot.zoneId || slot.slotId)),
    smokeRoute: recipe.smokeRoute,
    notes: `Auto-generated intake skeleton from recipe ${recipe.screenId}; replace canonicalReferences/risk zones with proof-specific values before production handoff.`,
    generatedAt: new Date().toISOString(),
    generatedBy: 'GitHubCopilot',
  };
}

function buildAssetTaskManifestSkeleton(recipe) {
  const warnings = [
    'Auto-generated skeleton: no partial asset tasks were inferred from recipe slots; fill tasks manually if this screen needs asset generation.',
  ];

  return {
    $schema: '../../schemas/asset-task-manifest.schema.json',
    screenId: recipe.screenId,
    sourceFamilyMap: recipe.screenId,
    generatedAt: new Date().toISOString(),
    taskCount: 0,
    tasks: [],
    warnings,
  };
}

function buildManifestTargets(screenDir) {
  return {
    intakePath: path.join(screenDir, 'manifests', 'intake.json'),
    assetTaskManifestPath: path.join(screenDir, 'manifests', 'asset-task-manifest.json'),
  };
}

function writeManifestStage(screenDir, stage, kinds, metadata, skipReview) {
  const report = validateExistingScreenDir(screenDir, kinds);
  if (!skipReview) {
    writeGeneratedReview(screenDir, stage, report, metadata);
  }
  assertReportOk(report, `[compile-recipe-to-screen-spec] ${stage}`);
}

function resolveScreenDir(recipe, explicitScreenDir) {
  const screenBase = recipeBaseName(recipe.screenId);
  return resolvePath(explicitScreenDir) || path.join(PROJECT_ROOT, 'artifacts', 'ui-source', screenBase);
}

function buildGeneratedReviewReport(recipe, recipePath, targetPath) {
  return {
    validatedAt: new Date().toISOString(),
    summary: {
      ok: true,
      fileCount: 1,
      failureCount: 0,
    },
    files: [
      {
        kind: 'screenSpec',
        filePath: targetPath,
        ok: true,
        failReasons: [],
      },
    ],
    crossFileFailReasons: [],
    metadata: {
      screenId: recipe.screenId,
      familyId: recipe.familyId,
      contentSchemaId: recipe.contentSchemaId,
      validationProfile: recipe.validationProfile,
      generationPolicy: recipe.generationPolicy,
      controllerClass: recipe.controllerClass || '',
      recipePath: path.relative(PROJECT_ROOT, recipePath),
      targetPath: path.relative(PROJECT_ROOT, targetPath),
      smokeRoute: recipe.smokeRoute,
      slotIds: recipe.slots.map((slot) => slot.slotId),
      requiredDataSources: recipe.dataSources.filter((source) => source.required).map((source) => source.sourceId),
      optionalDataSources: recipe.dataSources.filter((source) => !source.required).map((source) => source.sourceId),
      deliverables: buildDeliverables(recipe, targetPath),
    },
  };
}

function writeReviewArtifacts(screenDir, recipe, recipePath, targetPath) {
  ensureDir(screenDir);
  const reviewReport = buildGeneratedReviewReport(recipe, recipePath, targetPath);
  const relativeScreenDir = path.relative(PROJECT_ROOT, screenDir);
  const relativeTargetPath = path.relative(PROJECT_ROOT, targetPath);
  const stageMetadata = {
    screenId: recipe.screenId,
    familyId: recipe.familyId,
    generationPolicy: recipe.generationPolicy,
    validationProfile: recipe.validationProfile,
    contentSchemaId: recipe.contentSchemaId,
    controllerClass: recipe.controllerClass || '',
    recipePath: path.relative(PROJECT_ROOT, recipePath),
    source: 'compile-recipe-to-screen-spec',
    targetPath: relativeTargetPath,
    screenDir: relativeScreenDir,
    slotCount: recipe.slots.length,
    dataSourceCount: recipe.dataSources.length,
    slotIds: recipe.slots.map((slot) => slot.slotId),
    requiredDataSources: recipe.dataSources.filter((source) => source.required).map((source) => source.sourceId),
    optionalDataSources: recipe.dataSources.filter((source) => !source.required).map((source) => source.sourceId),
    deliverables: buildDeliverables(recipe, targetPath),
    smokeRoute: recipe.smokeRoute,
  };

  writeGeneratedReview(screenDir, 'recipe-screen-spec', reviewReport, stageMetadata);

  writeRuntimeVerdictSkeleton(screenDir, {
    screenId: recipe.screenId,
    latestStage: 'recipe-screen-spec',
    captureArtifacts: {
      plannedScreenSpec: relativeTargetPath,
      plannedReviewDir: `${relativeScreenDir}/review`,
      smokeRoute: recipe.smokeRoute,
    },
    diagnosticsSummary: {
      source: 'compile-recipe-to-screen-spec',
      validationProfile: recipe.validationProfile,
      generationPolicy: recipe.generationPolicy,
      status: 'pending-runtime-smoke',
    },
    factoryLearnings: [
      'recipe-screen-spec compiled; runtime verification not run yet',
      `family=${recipe.familyId}; validationProfile=${recipe.validationProfile}`,
    ],
  });
}

function emitFactoryManifestArtifacts(screenDir, recipe, recipePath, targetPath, normalized, options) {
  const targets = buildManifestTargets(screenDir);
  const emitted = {
    intake: false,
    assetTaskManifest: false,
  };

  if (options.emitIntake) {
    const intake = buildIntakeSkeleton(recipe, recipePath, targetPath, normalized, options.intakeTier);
    writeJson(targets.intakePath, intake, options.dryRun);
    emitted.intake = true;
  }

  if (options.emitAssetManifest) {
    const assetTaskManifest = buildAssetTaskManifestSkeleton(recipe);
    writeJson(targets.assetTaskManifestPath, assetTaskManifest, options.dryRun);
    emitted.assetTaskManifest = true;
  }

  if (options.dryRun) {
    return emitted;
  }

  if (emitted.intake) {
    writeManifestStage(screenDir, 'intake', ['intake'], {
      screenId: recipe.screenId,
      recipePath: path.relative(PROJECT_ROOT, recipePath),
      source: 'compile-recipe-to-screen-spec',
      intakePath: path.relative(PROJECT_ROOT, targets.intakePath),
      intakeTier: options.intakeTier,
      familyId: recipe.familyId,
    }, options.skipReview);
  }

  if (emitted.assetTaskManifest) {
    writeManifestStage(screenDir, 'assetTaskManifest', emitted.intake ? ['intake', 'assetTaskManifest'] : ['assetTaskManifest'], {
      screenId: recipe.screenId,
      recipePath: path.relative(PROJECT_ROOT, recipePath),
      source: 'compile-recipe-to-screen-spec',
      assetTaskManifestPath: path.relative(PROJECT_ROOT, targets.assetTaskManifestPath),
      inferredTaskCount: 0,
      familyId: recipe.familyId,
      sourceFamilyMap: recipe.screenId,
    }, options.skipReview);
  }

  if (!options.skipReview && (emitted.intake || emitted.assetTaskManifest)) {
    writeRuntimeVerdictSkeleton(screenDir, {
      screenId: recipe.screenId,
      latestStage: emitted.assetTaskManifest ? 'assetTaskManifest' : 'intake',
      captureArtifacts: {
        plannedScreenSpec: path.relative(PROJECT_ROOT, targetPath),
        plannedReviewDir: `${path.relative(PROJECT_ROOT, screenDir)}/review`,
        ...(emitted.intake ? { intake: path.relative(PROJECT_ROOT, targets.intakePath) } : {}),
        ...(emitted.assetTaskManifest ? { assetTaskManifest: path.relative(PROJECT_ROOT, targets.assetTaskManifestPath) } : {}),
      },
      diagnosticsSummary: {
        source: 'compile-recipe-to-screen-spec',
        validationProfile: recipe.validationProfile,
        generationPolicy: recipe.generationPolicy,
        status: emitted.assetTaskManifest ? 'pending-asset-task-planning' : 'pending-intake-review',
      },
      factoryLearnings: [
        emitted.intake ? 'intake skeleton emitted from recipe metadata' : '',
        emitted.assetTaskManifest ? 'asset-task-manifest skeleton emitted with zero inferred tasks; manual enrichment required if asset generation applies' : '',
      ].filter(Boolean),
    });
  }

  return emitted;
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

  const { recipe, recipePath } = loadRecipe(recipeArg);
  const dryRun = !hasFlag(process.argv, 'write');
  const outArg = getArg(process.argv, 'out');
  const screenDirArg = getArg(process.argv, 'screen-dir');
  const emitIntake = hasFlag(process.argv, 'emit-intake');
  const emitAssetManifest = hasFlag(process.argv, 'emit-asset-manifest');
  const intakeTier = getArg(process.argv, 'intake-tier', 'C');
  const skipReview = hasFlag(process.argv, 'skip-review');
  const defaultTarget = path.join(
    PROJECT_ROOT,
    'assets',
    'resources',
    'ui-spec',
    'screens',
    `${recipe.screenId}.json`
  );
  const targetPath = resolvePath(outArg) || defaultTarget;

  const existing = fs.existsSync(targetPath) ? readJson(targetPath) : {};
  const normalized = {
    ...existing,
    id: recipe.screenId,
    version: typeof existing.version === 'number' ? existing.version : 1,
    uiId: recipe.uiId,
    layer: recipe.layer,
    bundle: recipe.bundle,
    layout: recipe.layoutId || existing.layout,
    skin: recipe.skinId || existing.skin,
    contentRequirements: buildContentRequirements(recipe),
    validation: buildValidation(existing.validation),
  };

  if (!normalized.layout) {
    throw new Error('[compile-recipe-to-screen-spec] 無法決定 layout id；請在 recipe 提供 layoutId');
  }
  if (!normalized.skin) {
    throw new Error('[compile-recipe-to-screen-spec] 無法決定 skin id；請在 recipe 提供 skinId');
  }
  if (!['A', 'B', 'C'].includes(intakeTier)) {
    throw new Error(`[compile-recipe-to-screen-spec] intake tier 只允許 A/B/C，收到 ${intakeTier}`);
  }

  writeJson(targetPath, normalized, dryRun);
  const screenDir = resolveScreenDir(recipe, screenDirArg);
  if (!dryRun && !skipReview) {
    writeReviewArtifacts(screenDir, recipe, recipePath, targetPath);
  }

  const emitted = emitFactoryManifestArtifacts(screenDir, recipe, recipePath, targetPath, normalized, {
    dryRun,
    emitIntake,
    emitAssetManifest,
    intakeTier,
    skipReview,
  });

  if (dryRun) {
    console.log(`[compile-recipe-to-screen-spec] review skeleton target=${path.relative(PROJECT_ROOT, screenDir)}/review`);
    if (emitted.intake) {
      console.log(`[compile-recipe-to-screen-spec] intake target=${path.relative(PROJECT_ROOT, path.join(screenDir, 'manifests', 'intake.json'))}`);
    }
    if (emitted.assetTaskManifest) {
      console.log(`[compile-recipe-to-screen-spec] asset-manifest target=${path.relative(PROJECT_ROOT, path.join(screenDir, 'manifests', 'asset-task-manifest.json'))}`);
    }
  }

  console.log(`[compile-recipe-to-screen-spec] screen=${recipe.screenId} out=${path.relative(PROJECT_ROOT, targetPath)}${dryRun ? ' [DRY-RUN]' : ''}`);
}

try {
  main();
} catch (error) {
  console.error(`[compile-recipe-to-screen-spec] ${error.message}`);
  process.exit(1);
}