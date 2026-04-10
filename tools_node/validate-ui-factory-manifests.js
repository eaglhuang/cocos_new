#!/usr/bin/env node
'use strict';

const fs = require('fs');
const {
  resolveProjectPath,
  buildScreenTargets,
  validateTargets
} = require('./lib/ui-factory-manifest-validator');

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

function parseList(rawValue) {
  return String(rawValue || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildTargets() {
  const screenDirs = parseList(getArg('screen-dirs')).map(resolveProjectPath);
  const explicitTargets = [];
  const intakePath = getArg('intake');
  const familyMapPath = getArg('family-map');
  const assetManifestPath = getArg('asset-manifest');

  if (intakePath) {
    explicitTargets.push({ kind: 'intake', filePath: resolveProjectPath(intakePath) });
  }
  if (familyMapPath) {
    explicitTargets.push({ kind: 'familyMap', filePath: resolveProjectPath(familyMapPath) });
  }
  if (assetManifestPath) {
    explicitTargets.push({ kind: 'assetTaskManifest', filePath: resolveProjectPath(assetManifestPath) });
  }

  const screenTargets = screenDirs.flatMap((screenDir) => buildScreenTargets(screenDir));
  const targets = [...screenTargets, ...explicitTargets];

  if (targets.length === 0) {
    throw new Error('缺少驗證目標，請提供 --screen-dirs 或 --intake / --family-map / --asset-manifest');
  }

  return targets;
}

function main() {
  const targets = buildTargets();
  const report = validateTargets(targets);

  const reportArg = getArg('report');
  if (reportArg) {
    const reportPath = resolveProjectPath(reportArg);
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  console.log(JSON.stringify(report, null, 2));
  if (!report.summary.ok || hasFlag('fail-on-warning')) {
    process.exitCode = report.summary.ok ? 0 : 1;
  }
}

try {
  main();
} catch (error) {
  console.error(`[validate-ui-factory-manifests] ${error.message}`);
  process.exitCode = 1;
}