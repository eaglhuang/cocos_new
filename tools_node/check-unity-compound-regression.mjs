#!/usr/bin/env node

import { readFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '..');
const generatedOutputDir = path.join(root, 'tools', 'generated-compounds');

process.env.TS_NODE_PROJECT = path.join(root, 'tsconfig.test.json');
require('ts-node/register/transpile-only');
require('tsconfig-paths/register');

const { extractUnityParticlePrefab } = require(path.join(root, 'assets/scripts/tools/unity/UnityParticlePrefabParser'));

function normalizeRelPath(p) {
    return String(p || '').replaceAll('\\', path.sep).replaceAll('/', path.sep);
}

function readJson(filePath) {
    return JSON.parse(readFileSync(filePath, 'utf8'));
}

function sortedUnique(list) {
    return [...new Set(list)].sort((a, b) => a.localeCompare(b));
}

const draftFiles = existsSync(generatedOutputDir)
    ? readdirSync(generatedOutputDir).filter((name) => name.endsWith('.json')).sort()
    : [];

if (draftFiles.length === 0) {
    console.error('No drafts found under tools/generated-compounds/*.json');
    process.exit(1);
}

const results = [];

for (const fileName of draftFiles) {
    const draftPath = path.join(generatedOutputDir, fileName);
    const draft = readJson(draftPath);
    const sourcePrefabRel = draft?.source?.unityPrefab;

    if (!sourcePrefabRel) {
        continue;
    }

    const sourcePrefabPath = path.resolve(root, normalizeRelPath(sourcePrefabRel));
    const issues = [];

    if (!existsSync(sourcePrefabPath)) {
        issues.push(`source prefab missing: ${sourcePrefabRel}`);
        results.push({
            fileName,
            effectId: draft.id ?? path.basename(fileName, '.json'),
            expectedCount: -1,
            actualCount: Array.isArray(draft.subPS) ? draft.subPS.length : 0,
            missingNames: [],
            extraNames: [],
            issues,
        });
        continue;
    }

    const summary = extractUnityParticlePrefab(readFileSync(sourcePrefabPath, 'utf8'));
    const expectedNodes = Array.isArray(summary.particleNodes) ? summary.particleNodes : [];
    const expectedCount = expectedNodes.length;
    const actualSubPs = Array.isArray(draft.subPS) ? draft.subPS : [];
    const actualCount = actualSubPs.length;

    if (expectedCount === 0) {
        issues.push('expected particle nodes is 0 (Unity parser output)');
    }
    if (actualCount === 0) {
        issues.push('draft subPS is 0');
    }
    if (expectedCount !== actualCount) {
        issues.push(`count mismatch expected=${expectedCount}, actual=${actualCount}`);
    }

    const expectedNames = sortedUnique(expectedNodes.map((n) => String(n?.name ?? '').trim()).filter(Boolean));
    const actualNames = sortedUnique(actualSubPs.map((n) => String(n?.name ?? '').trim()).filter(Boolean));

    const missingNames = expectedNames.filter((name) => !actualNames.includes(name));
    const extraNames = actualNames.filter((name) => !expectedNames.includes(name));

    if (missingNames.length > 0) {
        issues.push(`missing subPS names: ${missingNames.join(', ')}`);
    }
    if (extraNames.length > 0) {
        issues.push(`extra subPS names: ${extraNames.join(', ')}`);
    }

    results.push({
        fileName,
        effectId: draft.id ?? path.basename(fileName, '.json'),
        expectedCount,
        actualCount,
        missingNames,
        extraNames,
        issues,
    });
}

if (results.length === 0) {
    console.log('No Unity-import drafts found (source.unityPrefab missing in all drafts).');
    process.exit(0);
}

let failCount = 0;
console.log('=== Unity Compound Regression Check ===');
for (const row of results) {
    const pass = row.issues.length === 0;
    if (!pass) failCount += 1;
    console.log(`${pass ? 'PASS' : 'FAIL'} | ${row.effectId} | expected=${row.expectedCount} actual=${row.actualCount} | file=${row.fileName}`);
    for (const issue of row.issues) {
        console.log(`  - ${issue}`);
    }
}

console.log(`\nSummary: ${results.length - failCount}/${results.length} pass`);
process.exit(failCount > 0 ? 2 : 0);
