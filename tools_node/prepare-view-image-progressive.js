#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PREPARE_SCRIPT = path.join(PROJECT_ROOT, 'tools_node', 'prepare-view-image.js');

const LEVELS = {
    thumb: 125,
    inspect: 250,
    detail: 500,
    1: 125,
    2: 250,
    3: 500,
};

function parseArg(name, fallback = '') {
    const flag = `--${name}`;
    const index = process.argv.indexOf(flag);
    if (index < 0 || index + 1 >= process.argv.length) {
        return fallback;
    }
    return process.argv[index + 1];
}

function hasFlag(name) {
    return process.argv.includes(`--${name}`);
}

function resolveLevel(rawLevel) {
    const key = String(rawLevel || 'thumb').trim().toLowerCase();
    const maxWidth = LEVELS[key];
    if (!maxWidth) {
        throw new Error(`unknown --level: ${rawLevel}. Use thumb|inspect|detail or 1|2|3.`);
    }
    const levelName = maxWidth === 125 ? 'thumb' : maxWidth === 250 ? 'inspect' : 'detail';
    return { levelName, maxWidth };
}

function inferNextLevelFromPath(filePath) {
    const normalized = String(filePath || '').toLowerCase();
    if (normalized.includes('.view-125.')) {
        return { levelName: 'inspect', maxWidth: 250 };
    }
    if (normalized.includes('.view-250.')) {
        return { levelName: 'detail', maxWidth: 500 };
    }
    if (normalized.includes('.view-500.')) {
        return { levelName: 'detail', maxWidth: 500 };
    }
    return { levelName: 'thumb', maxWidth: 125 };
}

function main() {
    const input = parseArg('input');
    if (!input) {
        throw new Error('missing --input');
    }

    const inputPath = path.resolve(input);
    if (!fs.existsSync(inputPath)) {
        throw new Error(`input not found: ${inputPath}`);
    }

    const sourceArg = parseArg('source', '');
    const sourcePath = sourceArg ? path.resolve(sourceArg) : '';
    if (sourcePath && !fs.existsSync(sourcePath)) {
        throw new Error(`source not found: ${sourcePath}`);
    }

    const outDir = parseArg('outDir', '');
    const shouldAdvance = hasFlag('next');
    const isPreparedPreview = /\.view-(125|250|500)\./i.test(path.basename(inputPath));
    if (shouldAdvance && isPreparedPreview && !sourcePath) {
        throw new Error('prepared preview paths require --source <original-path> when using --next');
    }
    const resolvedLevel = shouldAdvance
        ? inferNextLevelFromPath(inputPath)
        : resolveLevel(parseArg('level', 'thumb'));

    const effectiveInput = shouldAdvance && sourcePath ? sourcePath : inputPath;
    const args = [PREPARE_SCRIPT, '--input', effectiveInput, '--maxWidth', String(resolvedLevel.maxWidth)];
    if (outDir) {
        args.push('--outDir', path.resolve(outDir));
    }

    const raw = execFileSync(process.execPath, args, {
        cwd: PROJECT_ROOT,
        encoding: 'utf8',
    }).trim();

    const result = JSON.parse(raw);
    const ladder = [
        { level: 'thumb', maxWidth: 125 },
        { level: 'inspect', maxWidth: 250 },
        { level: 'detail', maxWidth: 500 },
    ];
    const currentIndex = ladder.findIndex((item) => item.level === resolvedLevel.levelName);
    const nextLevel = currentIndex >= 0 && currentIndex < ladder.length - 1 ? ladder[currentIndex + 1].level : null;

    console.log(JSON.stringify({
        policy: 'thumbnail-first-progressive-zoom',
        level: resolvedLevel.levelName,
        maxWidth: resolvedLevel.maxWidth,
        nextLevel,
        sourceInput: effectiveInput,
        result,
    }, null, 2));
}

try {
    main();
} catch (error) {
    console.error(`[prepare-view-image-progressive] ${error.message}`);
    process.exit(1);
}