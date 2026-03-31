#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'fs';
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
const { buildUnityCompoundEffectDraft, renderCompoundEffectSnippet } = require(path.join(root, 'assets/scripts/tools/unity/UnityParticleCompoundMapper'));

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith('--')));
const positional = args.filter((arg) => !arg.startsWith('--'));

const inputPath = positional[0];
const effectIdArg = positional[1];
const outputArg = positional[2];
const allowEmpty = flags.has('--allow-empty');

if (!inputPath) {
    console.error('Usage: node tools/generate-unity-compound-effect.mjs <unity-prefab.txt|prefab> [effectId] [outputFile(.json|.txt)] [--allow-empty]');
    process.exit(1);
}

const resolved = path.resolve(root, inputPath);
const effectId = effectIdArg ?? path.basename(resolved, path.extname(resolved));
const outputPath = path.resolve(root, outputArg ?? path.join('tools', 'generated-compounds', `${effectId}.json`));
const content = readFileSync(resolved, 'utf8');
const summary = extractUnityParticlePrefab(content);
const draft = buildUnityCompoundEffectDraft(summary, { effectId });

if (!allowEmpty && draft.particleCount === 0) {
    console.error(JSON.stringify({
        file: path.relative(root, resolved),
        effectId,
        particleCount: draft.particleCount,
        reason: 'particleCount is 0 (guarded failure). Use --allow-empty to override intentionally.',
    }, null, 2));
    process.exit(2);
}

const snippet = renderCompoundEffectSnippet(draft, {
    label: `${effectId} (Unity import)`,
    folder: effectId,
});

const generatorDraft = {
    id: draft.effectId,
    label: `${effectId} (Unity import)`,
    folder: effectId,
    scale: 1.0,
    audio: null,
    source: {
        unityPrefab: path.relative(root, resolved),
    },
    warnings: draft.warnings,
    subPS: draft.subPS.map((sub) => ({
        ...sub,
        texKey: sub.texKeyHint ?? 'cfxr_aura_runic',
    })),
};

mkdirSync(path.dirname(outputPath), { recursive: true });

if (path.extname(outputPath).toLowerCase() === '.json') {
    writeFileSync(outputPath, JSON.stringify(generatorDraft, null, 2) + '\n', 'utf8');
    console.log(JSON.stringify({
        file: path.relative(root, resolved),
        output: path.relative(root, outputPath),
        particleCount: draft.particleCount,
        warnings: draft.warnings,
        nextStep: 'node tools/compound-prefab-generator.mjs',
    }, null, 2));
} else {
    writeFileSync(outputPath, snippet + '\n', 'utf8');
    console.log(JSON.stringify({
        file: path.relative(root, resolved),
        output: path.relative(root, outputPath),
        particleCount: draft.particleCount,
        warnings: draft.warnings,
        mode: 'snippet',
    }, null, 2));
}