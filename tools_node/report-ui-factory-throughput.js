#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const UI_SOURCE_ROOT = path.join(PROJECT_ROOT, 'artifacts', 'ui-source');
const OUTPUT_PATH = path.join(UI_SOURCE_ROOT, 'factory-throughput-report.json');

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    return null;
  }
}

function isoToMillis(value) {
  const ts = Date.parse(value || '');
  return Number.isFinite(ts) ? ts : null;
}

function toHours(startMs, endMs) {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return null;
  }
  return Number(((endMs - startMs) / (1000 * 60 * 60)).toFixed(2));
}

function historyLength(stageEntry) {
  if (!stageEntry || typeof stageEntry !== 'object') {
    return 0;
  }
  if (Array.isArray(stageEntry.history) && stageEntry.history.length > 0) {
    return stageEntry.history.length;
  }
  return stageEntry.validatedAt ? 1 : 0;
}

function latestTimestamp(candidates) {
  return candidates.reduce((max, current) => {
    if (!Number.isFinite(current)) {
      return max;
    }
    return max === null || current > max ? current : max;
  }, null);
}

function millisToIso(value) {
  return Number.isFinite(value) ? new Date(value).toISOString() : null;
}

function earliestTimestamp(candidates) {
  return candidates.reduce((min, current) => {
    if (!Number.isFinite(current)) {
      return min;
    }
    return min === null || current < min ? current : min;
  }, null);
}

function buildScreenEntry(screenDirName) {
  const screenDir = path.join(UI_SOURCE_ROOT, screenDirName);
  const intake = readJson(path.join(screenDir, 'manifests', 'intake.json'));
  if (!intake) {
    return null;
  }

  const assetTaskManifest = readJson(path.join(screenDir, 'manifests', 'asset-task-manifest.json'));
  const paramTuneManifest = readJson(path.join(screenDir, 'manifests', 'param-tune-manifest.json'));
  const generatedReview = readJson(path.join(screenDir, 'review', 'generated-review.json')) || {};
  const runtimeVerdict = readJson(path.join(screenDir, 'review', 'runtime-verdict.json')) || {};

  const stageEntries = generatedReview.stages && typeof generatedReview.stages === 'object'
    ? generatedReview.stages
    : {};
  const generationRounds = historyLength(stageEntries.assetTaskManifest);
  const paramTuneRounds = historyLength(stageEntries.paramTuneManifest);
  const intakeRounds = historyLength(stageEntries.intake);
  const familyMapRounds = historyLength(stageEntries.familyMap);
  const runtimeRounds = Array.isArray(runtimeVerdict.history) && runtimeVerdict.history.length > 0
    ? runtimeVerdict.history.length
    : runtimeVerdict.updatedAt && runtimeVerdict.status && runtimeVerdict.status !== 'not-run'
      ? 1
      : 0;

  const firstTs = earliestTimestamp([
    isoToMillis(intake.generatedAt),
    isoToMillis(stageEntries.intake?.validatedAt),
    isoToMillis(stageEntries.familyMap?.validatedAt),
    isoToMillis(stageEntries.assetTaskManifest?.validatedAt),
    isoToMillis(stageEntries.paramTuneManifest?.validatedAt),
  ]);
  const lastTs = latestTimestamp([
    isoToMillis(generatedReview.updatedAt),
    isoToMillis(runtimeVerdict.updatedAt),
    isoToMillis(assetTaskManifest?.generatedAt),
    isoToMillis(paramTuneManifest?.generatedAt),
  ]);

  const reworkRounds = [intakeRounds, familyMapRounds, generationRounds, paramTuneRounds, runtimeRounds]
    .reduce((sum, rounds) => sum + Math.max(0, rounds - 1), 0);
  const latestRuntimeActive = runtimeVerdict.status && runtimeVerdict.status !== 'not-run';

  return {
    screenDir: screenDirName,
    screenId: intake.screenId,
    cycleHours: toHours(firstTs, lastTs),
    firstGeneratedAt: intake.generatedAt || null,
    lastUpdatedAt: millisToIso(lastTs),
    assetTaskCount: Number(assetTaskManifest?.taskCount || 0),
    paramTuneTaskCount: Number(paramTuneManifest?.taskCount || 0),
    generationRounds,
    paramTuneRounds,
    runtimeRounds,
    reworkRounds,
    latestRuntimeStatus: runtimeVerdict.status || 'not-run',
    promoteable: Boolean(runtimeVerdict.promoteable),
    latestStage: latestRuntimeActive
      ? runtimeVerdict.latestStage || generatedReview.latestStage || null
      : generatedReview.latestStage || runtimeVerdict.latestStage || null,
  };
}

function main() {
  const screenDirs = fs.readdirSync(UI_SOURCE_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !['schemas', 'ai-recipes', 'asset-direction', 'style-check'].includes(name));

  const screens = screenDirs
    .map(buildScreenEntry)
    .filter(Boolean)
    .sort((left, right) => left.screenDir.localeCompare(right.screenDir));

  const cycleHours = screens.map((entry) => entry.cycleHours).filter((value) => typeof value === 'number');
  const report = {
    reportVersion: '1.0',
    generatedAt: new Date().toISOString(),
    screens,
    summary: {
      screenCount: screens.length,
      trackedRuntimeScreens: screens.filter((entry) => entry.latestRuntimeStatus !== 'not-run').length,
      totalAssetTasks: screens.reduce((sum, entry) => sum + entry.assetTaskCount, 0),
      totalParamTuneTasks: screens.reduce((sum, entry) => sum + entry.paramTuneTaskCount, 0),
      totalRuntimeRounds: screens.reduce((sum, entry) => sum + entry.runtimeRounds, 0),
      totalReworkRounds: screens.reduce((sum, entry) => sum + entry.reworkRounds, 0),
      avgCycleHours: cycleHours.length > 0
        ? Number((cycleHours.reduce((sum, value) => sum + value, 0) / cycleHours.length).toFixed(2))
        : null,
    },
    notes: [
      'cycleHours = intake.generatedAt 到最新 generated-review/runtime-verdict 的時間差',
      'reworkRounds 目前以各 stage/runtime history 超過首輪的次數估算',
      '舊資料若尚未有 history，會以單輪處理'
    ]
  };

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[report-ui-factory-throughput] wrote ${path.relative(PROJECT_ROOT, OUTPUT_PATH)}`);
  console.log(`[report-ui-factory-throughput] screens=${report.summary.screenCount} runtimeTracked=${report.summary.trackedRuntimeScreens} avgCycleHours=${report.summary.avgCycleHours ?? 'n/a'}`);
}

main();