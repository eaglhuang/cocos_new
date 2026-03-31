#!/usr/bin/env node

import { readFileSync } from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '..');

process.env.TS_NODE_PROJECT = path.join(root, 'tsconfig.test.json');
require('ts-node/register/transpile-only');
require('tsconfig-paths/register');

const { extractUnityParticlePrefab } = require(path.join(root, 'assets/scripts/tools/unity/UnityParticlePrefabParser'));
const { buildUnityCompoundEffectDraft } = require(path.join(root, 'assets/scripts/tools/unity/UnityParticleCompoundMapper'));

const inputPath = process.argv[2];
if (!inputPath) {
    console.error('Usage: node tools/inspect-unity-particle-prefab.mjs <unity-prefab.txt|prefab>');
    process.exit(1);
}

const resolved = path.resolve(root, inputPath);
const content = readFileSync(resolved, 'utf8');
const summary = extractUnityParticlePrefab(content);
const draft = buildUnityCompoundEffectDraft(summary, {
    effectId: path.basename(resolved, path.extname(resolved)),
});

console.log(JSON.stringify({
    file: path.relative(root, resolved),
    rootNodes: summary.rootNodes,
    particleNodes: summary.particleNodes,
    compoundDraft: draft,
    documentCount: summary.documents.length,
}, null, 2));