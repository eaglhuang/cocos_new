#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const UI_SOURCE_ROOT = path.join(PROJECT_ROOT, 'artifacts', 'ui-source');
const OUTPUT_PATH = path.join(UI_SOURCE_ROOT, 'runtime-residual-report.json');

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

function listScreenDirs() {
  return fs.readdirSync(UI_SOURCE_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !['schemas', 'ai-recipes', 'asset-direction', 'style-check'].includes(name));
}

function buildEntry(screenDir) {
  const verdictPath = path.join(UI_SOURCE_ROOT, screenDir, 'review', 'runtime-verdict.json');
  const verdict = readJson(verdictPath);
  if (!verdict) {
    return null;
  }

  const summary = verdict.diagnosticsSummary || {};
  const warningCount = Number(summary.consoleWarningCount || 0);
  const errorCount = Number(summary.consoleErrorCount || 0) + Number(summary.pageErrorCount || 0) + Number(summary.requestFailureCount || 0);
  const residuals = Array.isArray(verdict.residuals) ? verdict.residuals : [];

  return {
    screenDir,
    screenId: verdict.screenId,
    status: verdict.status,
    promoteable: Boolean(verdict.promoteable),
    warningCount,
    errorCount,
    residualCount: residuals.length,
    residuals,
    updatedAt: verdict.updatedAt || null,
    captureArtifacts: verdict.captureArtifacts || {},
    triagePriority: errorCount > 0 ? 'p0' : warningCount >= 100 ? 'p1' : warningCount >= 50 ? 'p2' : warningCount > 0 ? 'p3' : 'clear'
  };
}

function main() {
  const screens = listScreenDirs()
    .map(buildEntry)
    .filter(Boolean)
    .sort((left, right) => {
      if (right.errorCount !== left.errorCount) {
        return right.errorCount - left.errorCount;
      }
      if (right.warningCount !== left.warningCount) {
        return right.warningCount - left.warningCount;
      }
      return left.screenDir.localeCompare(right.screenDir);
    });

  const report = {
    reportVersion: '1.0',
    generatedAt: new Date().toISOString(),
    summary: {
      screenCount: screens.length,
      screensWithWarnings: screens.filter((entry) => entry.warningCount > 0).length,
      screensWithErrors: screens.filter((entry) => entry.errorCount > 0).length,
      highestWarningCount: screens[0]?.warningCount || 0,
      nextFocus: screens.filter((entry) => entry.triagePriority !== 'clear').slice(0, 3).map((entry) => ({
        screenId: entry.screenId,
        triagePriority: entry.triagePriority,
        warningCount: entry.warningCount,
        errorCount: entry.errorCount,
      }))
    },
    screens
  };

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[report-ui-runtime-residuals] wrote ${path.relative(PROJECT_ROOT, OUTPUT_PATH)}`);
  console.log(`[report-ui-runtime-residuals] top=${report.summary.nextFocus.map((item) => `${item.screenId}:${item.triagePriority}`).join(', ') || 'none'}`);
}

main();