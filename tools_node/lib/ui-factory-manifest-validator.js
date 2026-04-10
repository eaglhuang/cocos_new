'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');

const SCHEMA_REFS = {
  intake: '../../schemas/intake.schema.json',
  familyMap: '../../schemas/family-map.schema.json',
  assetTaskManifest: '../../schemas/asset-task-manifest.schema.json',
  paramTuneManifest: '../../schemas/param-tune-manifest.schema.json',
  runtimeVerdict: '../../schemas/runtime-verdict.schema.json'
};

const FAIL = {
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  JSON_PARSE_ERROR: 'JSON_PARSE_ERROR',
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
  INVALID_TYPE: 'INVALID_TYPE',
  INVALID_ENUM: 'INVALID_ENUM',
  INVALID_SCHEMA_REF: 'INVALID_SCHEMA_REF',
  EMPTY_COLLECTION: 'EMPTY_COLLECTION',
  PARTIAL_ZONE_MISSING_ASSET_TARGETS: 'PARTIAL_ZONE_MISSING_ASSET_TARGETS',
  TASK_COUNT_MISMATCH: 'TASK_COUNT_MISMATCH',
  DUPLICATE_TASK_ID: 'DUPLICATE_TASK_ID',
  SCREEN_ID_MISMATCH: 'SCREEN_ID_MISMATCH',
  INVALID_TASK_LINK: 'INVALID_TASK_LINK'
};

function resolveProjectPath(inputPath) {
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

function readJsonSafe(filePath) {
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(filePath, 'utf8')) };
  } catch (error) {
    return { ok: false, error };
  }
}

function pushFailure(failReasons, code, field, message) {
  failReasons.push({ code, field, message });
}

function isString(value) {
  return typeof value === 'string';
}

function isNonEmptyString(value) {
  return isString(value) && value.trim().length > 0;
}

function isStringOrNull(value) {
  return value === null || isString(value);
}

function validateSchemaRef(json, expected, failReasons) {
  if (!json || json.$schema !== expected) {
    pushFailure(failReasons, FAIL.INVALID_SCHEMA_REF, '$schema', `預期 ${expected}`);
  }
}

function validateArrayOfStrings(value, field, failReasons, { minItems = 0 } = {}) {
  if (!Array.isArray(value)) {
    pushFailure(failReasons, FAIL.INVALID_TYPE, field, '必須是字串陣列');
    return;
  }
  if (value.length < minItems) {
    pushFailure(failReasons, FAIL.EMPTY_COLLECTION, field, `至少需要 ${minItems} 筆`);
  }
  value.forEach((item, index) => {
    if (!isNonEmptyString(item)) {
      pushFailure(failReasons, FAIL.INVALID_TYPE, `${field}[${index}]`, '必須是非空字串');
    }
  });
}

function validateSourceOfTruth(value, failReasons) {
  const field = 'sourceOfTruth';
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    pushFailure(failReasons, FAIL.INVALID_TYPE, field, '必須是物件');
    return;
  }
  ['screenSpec', 'layout', 'skin', 'bundle', 'layer'].forEach((key) => {
    if (!(key in value)) {
      pushFailure(failReasons, FAIL.REQUIRED_FIELD_MISSING, `${field}.${key}`, '缺少欄位');
      return;
    }
    if (!isStringOrNull(value[key])) {
      pushFailure(failReasons, FAIL.INVALID_TYPE, `${field}.${key}`, '必須是字串或 null');
    }
  });
}

function validateIntake(json) {
  const failReasons = [];
  validateSchemaRef(json, SCHEMA_REFS.intake, failReasons);
  ['screenId', 'templateFamilyCandidate', 'uiId', 'smokeRoute', 'generatedAt', 'generatedBy'].forEach((field) => {
    if (!(field in json)) {
      pushFailure(failReasons, FAIL.REQUIRED_FIELD_MISSING, field, '缺少欄位');
    } else if (!isString(json[field])) {
      pushFailure(failReasons, FAIL.INVALID_TYPE, field, '必須是字串');
    }
  });
  if (!('tier' in json)) {
    pushFailure(failReasons, FAIL.REQUIRED_FIELD_MISSING, 'tier', '缺少欄位');
  } else if (!['A', 'B', 'C'].includes(json.tier)) {
    pushFailure(failReasons, FAIL.INVALID_ENUM, 'tier', '只允許 A / B / C');
  }
  validateSourceOfTruth(json.sourceOfTruth, failReasons);
  validateArrayOfStrings(json.canonicalReferences, 'canonicalReferences', failReasons, { minItems: 1 });
  validateArrayOfStrings(json.riskZones, 'riskZones', failReasons);
  if (!('notes' in json) || !(json.notes === null || isString(json.notes))) {
    pushFailure(failReasons, FAIL.INVALID_TYPE, 'notes', '必須是字串或 null');
  }
  return failReasons;
}

function validateFamilyMap(json) {
  const failReasons = [];
  validateSchemaRef(json, SCHEMA_REFS.familyMap, failReasons);
  ['screenId', 'templateFamilyCandidate', 'sourceProof', 'generatedAt'].forEach((field) => {
    if (!(field in json)) {
      pushFailure(failReasons, FAIL.REQUIRED_FIELD_MISSING, field, '缺少欄位');
    } else if (!isString(json[field])) {
      pushFailure(failReasons, FAIL.INVALID_TYPE, field, '必須是字串');
    }
  });
  if (!Array.isArray(json.zoneFamilyMap)) {
    pushFailure(failReasons, FAIL.INVALID_TYPE, 'zoneFamilyMap', '必須是陣列');
    return failReasons;
  }
  if (json.zoneFamilyMap.length === 0) {
    pushFailure(failReasons, FAIL.EMPTY_COLLECTION, 'zoneFamilyMap', '至少需要 1 個 zone');
  }
  json.zoneFamilyMap.forEach((zone, index) => {
    const prefix = `zoneFamilyMap[${index}]`;
    ['zone', 'family', 'recipe', 'structureOwner', 'skinOwner', 'contentOwner', 'generationNeed', 'sourceProofFamily'].forEach((field) => {
      if (!(field in zone)) {
        pushFailure(failReasons, FAIL.REQUIRED_FIELD_MISSING, `${prefix}.${field}`, '缺少欄位');
      } else if (!isString(zone[field])) {
        pushFailure(failReasons, FAIL.INVALID_TYPE, `${prefix}.${field}`, '必須是字串');
      }
    });
    if (!['reuse-only', 'param-tune', 'generate-partial-asset', 'partial', 'new-family-required'].includes(zone.generationNeed)) {
      pushFailure(failReasons, FAIL.INVALID_ENUM, `${prefix}.generationNeed`, '不在允許清單內');
    }
    validateArrayOfStrings(zone.widgetRefs, `${prefix}.widgetRefs`, failReasons);
    validateArrayOfStrings(zone.templateRefs, `${prefix}.templateRefs`, failReasons);
    if (!('sourceProofRecipe' in zone) || !(zone.sourceProofRecipe === null || isString(zone.sourceProofRecipe))) {
      pushFailure(failReasons, FAIL.INVALID_TYPE, `${prefix}.sourceProofRecipe`, '必須是字串或 null');
    }
    if (!('notes' in zone) || !(zone.notes === null || isString(zone.notes))) {
      pushFailure(failReasons, FAIL.INVALID_TYPE, `${prefix}.notes`, '必須是字串或 null');
    }
    if (zone.generationNeed === 'generate-partial-asset' || zone.generationNeed === 'partial' || zone.generationNeed === 'new-family-required') {
      if (!Array.isArray(zone.assetTargets) || zone.assetTargets.length === 0) {
        pushFailure(failReasons, FAIL.PARTIAL_ZONE_MISSING_ASSET_TARGETS, `${prefix}.assetTargets`, '局部資產 zone 必須提供 assetTargets');
      } else {
        zone.assetTargets.forEach((target, targetIndex) => {
          ['slot', 'taskIdSuffix', 'label', 'outputName'].forEach((field) => {
            if (!isNonEmptyString(target?.[field])) {
              pushFailure(failReasons, FAIL.REQUIRED_FIELD_MISSING, `${prefix}.assetTargets[${targetIndex}].${field}`, '缺少欄位或為空');
            }
          });
        });
      }
    }
  });
  return failReasons;
}

function validateAssetTaskManifest(json) {
  const failReasons = [];
  validateSchemaRef(json, SCHEMA_REFS.assetTaskManifest, failReasons);
  ['screenId', 'sourceFamilyMap', 'generatedAt'].forEach((field) => {
    if (!(field in json)) {
      pushFailure(failReasons, FAIL.REQUIRED_FIELD_MISSING, field, '缺少欄位');
    } else if (!isString(json[field])) {
      pushFailure(failReasons, FAIL.INVALID_TYPE, field, '必須是字串');
    }
  });
  if (!Number.isInteger(json.taskCount) || json.taskCount < 0) {
    pushFailure(failReasons, FAIL.INVALID_TYPE, 'taskCount', '必須是非負整數');
  }
  if (!Array.isArray(json.tasks)) {
    pushFailure(failReasons, FAIL.INVALID_TYPE, 'tasks', '必須是陣列');
    return failReasons;
  }
  if (json.taskCount !== json.tasks.length) {
    pushFailure(failReasons, FAIL.TASK_COUNT_MISMATCH, 'taskCount', `taskCount=${json.taskCount} 但實際 tasks=${json.tasks.length}`);
  }
  validateArrayOfStrings(json.warnings, 'warnings', failReasons);
  const taskIds = new Set();
  json.tasks.forEach((task, index) => {
    const prefix = `tasks[${index}]`;
    ['taskId', 'screenId', 'model', 'zone', 'slot', 'taskType', 'label', 'family', 'recipe', 'structureOwner', 'skinOwner', 'contentOwner', 'targetStyle'].forEach((field) => {
      if (!isNonEmptyString(task?.[field])) {
        pushFailure(failReasons, FAIL.REQUIRED_FIELD_MISSING, `${prefix}.${field}`, '缺少欄位或為空');
      }
    });
    if (task.taskType !== 'generate-partial-asset') {
      pushFailure(failReasons, FAIL.INVALID_ENUM, `${prefix}.taskType`, '目前只允許 generate-partial-asset');
    }
    if (taskIds.has(task.taskId)) {
      pushFailure(failReasons, FAIL.DUPLICATE_TASK_ID, `${prefix}.taskId`, `重複 taskId: ${task.taskId}`);
    }
    taskIds.add(task.taskId);
    validateArrayOfStrings(task.widgetRefs, `${prefix}.widgetRefs`, failReasons);
    validateArrayOfStrings(task.templateRefs, `${prefix}.templateRefs`, failReasons);
    validateArrayOfStrings(task.mustKeep, `${prefix}.mustKeep`, failReasons);
    validateArrayOfStrings(task.mustAvoid, `${prefix}.mustAvoid`, failReasons);
    if (!task.fitRules || typeof task.fitRules !== 'object' || Array.isArray(task.fitRules)) {
      pushFailure(failReasons, FAIL.INVALID_TYPE, `${prefix}.fitRules`, '必須是物件');
    } else {
      if (typeof task.fitRules.maxVisualOccupancy !== 'number') {
        pushFailure(failReasons, FAIL.INVALID_TYPE, `${prefix}.fitRules.maxVisualOccupancy`, '必須是數字');
      }
      if (typeof task.fitRules.runtimeIntrusionForbidden !== 'boolean') {
        pushFailure(failReasons, FAIL.INVALID_TYPE, `${prefix}.fitRules.runtimeIntrusionForbidden`, '必須是布林值');
      }
    }
    if (!task.postProcess || typeof task.postProcess !== 'object' || Array.isArray(task.postProcess)) {
      pushFailure(failReasons, FAIL.INVALID_TYPE, `${prefix}.postProcess`, '必須是物件');
    } else {
      if ('trimByBackground' in task.postProcess && typeof task.postProcess.trimByBackground !== 'boolean') {
        pushFailure(failReasons, FAIL.INVALID_TYPE, `${prefix}.postProcess.trimByBackground`, '必須是布林值');
      }
      if ('allowFadeSide' in task.postProcess && !['none', 'left', 'right'].includes(task.postProcess.allowFadeSide)) {
        pushFailure(failReasons, FAIL.INVALID_ENUM, `${prefix}.postProcess.allowFadeSide`, '只能是 none / left / right');
      }
      if ('fadeStartRatio' in task.postProcess && (typeof task.postProcess.fadeStartRatio !== 'number' || task.postProcess.fadeStartRatio <= 0 || task.postProcess.fadeStartRatio > 1)) {
        pushFailure(failReasons, FAIL.INVALID_TYPE, `${prefix}.postProcess.fadeStartRatio`, '必須是 0 到 1 之間的數字');
      }
      if ('fitPadding' in task.postProcess && typeof task.postProcess.fitPadding !== 'number') {
        pushFailure(failReasons, FAIL.INVALID_TYPE, `${prefix}.postProcess.fitPadding`, '必須是數字');
      }
      if ('spriteType' in task.postProcess && !['simple', 'sliced', 'tiled'].includes(task.postProcess.spriteType)) {
        pushFailure(failReasons, FAIL.INVALID_ENUM, `${prefix}.postProcess.spriteType`, '只能是 simple / sliced / tiled');
      }
      if ('border' in task.postProcess) {
        const border = task.postProcess.border;
        const borderIsValidString = isNonEmptyString(border);
        const borderIsValidArray = Array.isArray(border) && border.length === 4 && border.every((value) => typeof value === 'number' && Number.isFinite(value));
        if (!borderIsValidString && !borderIsValidArray) {
          pushFailure(failReasons, FAIL.INVALID_TYPE, `${prefix}.postProcess.border`, '必須是非空字串或四格數字陣列');
        }
      }
      if ('autoDetectBorder' in task.postProcess && typeof task.postProcess.autoDetectBorder !== 'boolean') {
        pushFailure(failReasons, FAIL.INVALID_TYPE, `${prefix}.postProcess.autoDetectBorder`, '必須是布林值');
      }
      if (task.postProcess.spriteType === 'sliced' && !('border' in task.postProcess) && task.postProcess.autoDetectBorder !== true) {
        pushFailure(failReasons, FAIL.REQUIRED_FIELD_MISSING, `${prefix}.postProcess.border`, 'spriteType=sliced 時必須提供 border 或 autoDetectBorder=true');
      }
    }
    if (!task.output || typeof task.output !== 'object' || Array.isArray(task.output)) {
      pushFailure(failReasons, FAIL.INVALID_TYPE, `${prefix}.output`, '必須是物件');
    } else {
      if (task.output.preferredMime !== 'image/png') {
        pushFailure(failReasons, FAIL.INVALID_ENUM, `${prefix}.output.preferredMime`, '必須是 image/png');
      }
      if (!Number.isInteger(task.output.targetLongEdge)) {
        pushFailure(failReasons, FAIL.INVALID_TYPE, `${prefix}.output.targetLongEdge`, '必須是整數');
      }
      if (typeof task.output.transparentBackgroundPreferred !== 'boolean') {
        pushFailure(failReasons, FAIL.INVALID_TYPE, `${prefix}.output.transparentBackgroundPreferred`, '必須是布林值');
      }
      if (!isNonEmptyString(task.output.outputName)) {
        pushFailure(failReasons, FAIL.REQUIRED_FIELD_MISSING, `${prefix}.output.outputName`, '缺少欄位或為空');
      }
    }
  });
  return failReasons;
}

function findFamilyMapPath(screenDir) {
  const proofDir = path.join(screenDir, 'proof');
  if (!fs.existsSync(proofDir)) {
    return '';
  }
  const familyMapFile = fs.readdirSync(proofDir).find((name) => name.endsWith('.family-map.json'));
  return familyMapFile ? path.join(proofDir, familyMapFile) : '';
}

function buildScreenTargets(screenDir, kinds) {
  const requestedKinds = Array.isArray(kinds) && kinds.length > 0
    ? kinds
    : ['intake', 'familyMap', 'assetTaskManifest'];
  const targets = [];
  if (requestedKinds.includes('intake')) {
    targets.push({ kind: 'intake', filePath: path.join(screenDir, 'manifests', 'intake.json') });
  }
  if (requestedKinds.includes('familyMap')) {
    const familyMapPath = findFamilyMapPath(screenDir) || path.join(screenDir, 'proof', 'missing.family-map.json');
    targets.push({ kind: 'familyMap', filePath: familyMapPath });
  }
  if (requestedKinds.includes('assetTaskManifest')) {
    targets.push({ kind: 'assetTaskManifest', filePath: path.join(screenDir, 'manifests', 'asset-task-manifest.json') });
  }
  return targets;
}

function buildExistingScreenTargets(screenDir, kinds) {
  return buildScreenTargets(screenDir, kinds).filter((target) => fs.existsSync(target.filePath));
}

function validateTarget(target) {
  const failReasons = [];
  if (!fs.existsSync(target.filePath)) {
    pushFailure(failReasons, FAIL.FILE_NOT_FOUND, path.relative(PROJECT_ROOT, target.filePath), '檔案不存在');
    return { kind: target.kind, filePath: target.filePath, ok: false, failReasons };
  }
  const parsed = readJsonSafe(target.filePath);
  if (!parsed.ok) {
    pushFailure(failReasons, FAIL.JSON_PARSE_ERROR, path.relative(PROJECT_ROOT, target.filePath), parsed.error.message);
    return { kind: target.kind, filePath: target.filePath, ok: false, failReasons };
  }
  const json = parsed.data;
  const localFailures = target.kind === 'intake'
    ? validateIntake(json)
    : target.kind === 'familyMap'
      ? validateFamilyMap(json)
      : validateAssetTaskManifest(json);
  return { kind: target.kind, filePath: target.filePath, ok: localFailures.length === 0, failReasons: localFailures, json };
}

function validateCrossConsistency(results) {
  const failReasons = [];
  const byDir = new Map();
  for (const result of results) {
    const screenDir = path.dirname(path.dirname(result.filePath));
    const list = byDir.get(screenDir) || [];
    list.push(result);
    byDir.set(screenDir, list);
  }
  for (const group of byDir.values()) {
    const intake = group.find((item) => item.kind === 'intake' && item.json);
    const familyMap = group.find((item) => item.kind === 'familyMap' && item.json);
    const assetManifest = group.find((item) => item.kind === 'assetTaskManifest' && item.json);
    const baseline = intake?.json?.screenId || familyMap?.json?.screenId || assetManifest?.json?.screenId;
    if (!baseline) {
      continue;
    }
    [intake, familyMap, assetManifest].filter(Boolean).forEach((entry) => {
      if (entry.json.screenId !== baseline) {
        pushFailure(failReasons, FAIL.SCREEN_ID_MISMATCH, path.relative(PROJECT_ROOT, entry.filePath), `screenId=${entry.json.screenId}，預期 ${baseline}`);
      }
    });
    if (assetManifest?.json?.sourceFamilyMap && familyMap?.json?.screenId && assetManifest.json.sourceFamilyMap !== familyMap.json.screenId) {
      pushFailure(failReasons, FAIL.INVALID_TASK_LINK, path.relative(PROJECT_ROOT, assetManifest.filePath), `sourceFamilyMap=${assetManifest.json.sourceFamilyMap}，預期 ${familyMap.json.screenId}`);
    }
  }
  return failReasons;
}

function buildReport(results) {
  const crossFailures = validateCrossConsistency(results);
  const fileEntries = results.map((result) => ({
    kind: result.kind,
    filePath: path.relative(PROJECT_ROOT, result.filePath),
    ok: result.ok,
    failReasons: result.failReasons
  }));
  return {
    reportVersion: '1.0',
    validatedAt: new Date().toISOString(),
    files: fileEntries,
    crossFileFailReasons: crossFailures,
    summary: {
      fileCount: fileEntries.length,
      failureCount: fileEntries.reduce((sum, entry) => sum + entry.failReasons.length, 0) + crossFailures.length,
      ok: fileEntries.every((entry) => entry.failReasons.length === 0) && crossFailures.length === 0
    }
  };
}

function validateTargets(targets) {
  return buildReport(targets.map(validateTarget));
}

function validateScreenDir(screenDir, kinds) {
  return validateTargets(buildScreenTargets(screenDir, kinds));
}

function validateExistingScreenDir(screenDir, kinds) {
  const targets = buildExistingScreenTargets(screenDir, kinds);
  return validateTargets(targets);
}

function buildStageVerdict(report) {
  return report.summary.ok ? 'pass' : 'fail';
}

function appendHistoryEntry(history, entry, identityKeys) {
  const list = Array.isArray(history) ? history.slice() : [];
  const last = list[list.length - 1];
  const isSame = last && identityKeys.every((key) => last[key] === entry[key]);
  if (isSame) {
    list[list.length - 1] = entry;
    return list;
  }
  list.push(entry);
  return list;
}

function writeGeneratedReview(screenDir, stage, report, metadata = {}) {
  const reviewDir = path.join(screenDir, 'review');
  const reviewPath = path.join(reviewDir, 'generated-review.json');
  ensureDir(reviewDir);

  const current = fs.existsSync(reviewPath) ? readJsonSafe(reviewPath) : { ok: false };
  const existing = current.ok && current.data && typeof current.data === 'object'
    ? current.data
    : {};
  const screenId = metadata.screenId || existing.screenId || report.files[0]?.filePath?.split(path.sep)[2] || '';
  const stages = existing.stages && typeof existing.stages === 'object' ? existing.stages : {};
  const previousStage = stages[stage] && typeof stages[stage] === 'object' ? stages[stage] : {};

  const stageEntry = {
    verdict: buildStageVerdict(report),
    validatedAt: report.validatedAt,
    fileCount: report.summary.fileCount,
    failureCount: report.summary.failureCount,
    files: report.files,
    crossFileFailReasons: report.crossFileFailReasons,
    metadata
  };

  stageEntry.history = appendHistoryEntry(previousStage.history, {
    verdict: stageEntry.verdict,
    validatedAt: stageEntry.validatedAt,
    fileCount: stageEntry.fileCount,
    failureCount: stageEntry.failureCount,
    metadata
  }, ['validatedAt', 'verdict']);

  stages[stage] = stageEntry;

  const review = {
    screenId,
    updatedAt: new Date().toISOString(),
    latestStage: stage,
    overallVerdict: Object.values(stages).every((entry) => entry.verdict === 'pass') ? 'pass' : 'fail',
    stages
  };

  fs.writeFileSync(reviewPath, `${JSON.stringify(review, null, 2)}\n`, 'utf8');
  return reviewPath;
}

function writeRuntimeVerdict(screenDir, metadata = {}) {
  const reviewDir = path.join(screenDir, 'review');
  const verdictPath = path.join(reviewDir, 'runtime-verdict.json');
  ensureDir(reviewDir);

  const current = fs.existsSync(verdictPath) ? readJsonSafe(verdictPath) : { ok: false };
  const existing = current.ok && current.data && typeof current.data === 'object'
    ? current.data
    : {};
  const now = new Date().toISOString();

  const residuals = Array.isArray(metadata.residuals)
    ? metadata.residuals
    : Array.isArray(existing.residuals)
      ? existing.residuals
      : [];
  const factoryLearnings = Array.from(new Set([
    ...(Array.isArray(existing.factoryLearnings) ? existing.factoryLearnings : []),
    ...(Array.isArray(metadata.factoryLearnings) ? metadata.factoryLearnings : []),
  ]));
  const captureArtifacts = {
    ...(existing.captureArtifacts && typeof existing.captureArtifacts === 'object' ? existing.captureArtifacts : {}),
    ...(metadata.captureArtifacts && typeof metadata.captureArtifacts === 'object' ? metadata.captureArtifacts : {}),
  };
  const diagnosticsSummary = {
    ...(existing.diagnosticsSummary && typeof existing.diagnosticsSummary === 'object' ? existing.diagnosticsSummary : {}),
    ...(metadata.diagnosticsSummary && typeof metadata.diagnosticsSummary === 'object' ? metadata.diagnosticsSummary : {}),
  };

  const history = appendHistoryEntry(existing.history, {
    runId: metadata.runId || existing.runId || null,
    status: metadata.status || existing.status || 'not-run',
    updatedAt: now,
    residualCount: residuals.length,
    promoteable: typeof metadata.promoteable === 'boolean'
      ? metadata.promoteable
      : typeof existing.promoteable === 'boolean'
        ? existing.promoteable
        : false,
  }, ['runId', 'status']);

  const verdict = {
    $schema: SCHEMA_REFS.runtimeVerdict,
    screenId: metadata.screenId || existing.screenId || '',
    runId: metadata.runId || existing.runId || null,
    status: metadata.status || existing.status || 'not-run',
    residuals,
    promoteable: typeof metadata.promoteable === 'boolean'
      ? metadata.promoteable
      : typeof existing.promoteable === 'boolean'
        ? existing.promoteable
        : false,
    factoryLearnings,
    latestStage: metadata.latestStage || existing.latestStage || null,
    captureArtifacts,
    diagnosticsSummary,
    history,
    updatedAt: now
  };

  fs.writeFileSync(verdictPath, `${JSON.stringify(verdict, null, 2)}\n`, 'utf8');
  return verdictPath;
}

function writeRuntimeVerdictSkeleton(screenDir, metadata = {}) {
  return writeRuntimeVerdict(screenDir, {
    ...metadata,
    status: metadata.status || 'not-run'
  });
}

function writeRuntimeVerdictCaptureResult(screenDir, metadata = {}) {
  return writeRuntimeVerdict(screenDir, metadata);
}

function assertReportOk(report, label) {
  if (report.summary.ok) {
    return;
  }
  const firstFailure = report.files.flatMap((entry) => entry.failReasons.map((reason) => ({ filePath: entry.filePath, ...reason })))[0]
    || report.crossFileFailReasons[0];
  const suffix = firstFailure
    ? ` ${firstFailure.code} ${firstFailure.field}: ${firstFailure.message}`
    : ' 驗證失敗';
  throw new Error(`${label}${suffix}`);
}

module.exports = {
  PROJECT_ROOT,
  SCHEMA_REFS,
  FAIL,
  resolveProjectPath,
  ensureDir,
  buildScreenTargets,
  buildExistingScreenTargets,
  validateTarget,
  validateTargets,
  validateScreenDir,
  validateExistingScreenDir,
  writeGeneratedReview,
  writeRuntimeVerdictSkeleton,
  writeRuntimeVerdictCaptureResult,
  assertReportOk
};