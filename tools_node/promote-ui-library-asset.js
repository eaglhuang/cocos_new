#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function parseArgs(argv) {
    const opts = {
        registry: path.resolve('artifacts/ui-library/_registry/asset-registry.json'),
        source: null,
        runtimeTarget: null,
        libraryId: null,
        note: null,
    };
    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        const next = argv[i + 1];
        switch (token) {
            case '--registry':
                opts.registry = path.resolve(next);
                i += 1;
                break;
            case '--source':
                opts.source = path.resolve(next);
                i += 1;
                break;
            case '--runtime-target':
                opts.runtimeTarget = path.resolve(next);
                i += 1;
                break;
            case '--library-id':
                opts.libraryId = next;
                i += 1;
                break;
            case '--note':
                opts.note = next;
                i += 1;
                break;
            default:
                break;
        }
    }
    return opts;
}

function ensureArgs(opts) {
    if (!opts.source || !opts.runtimeTarget || !opts.libraryId) {
        console.error('Usage: node tools_node/promote-ui-library-asset.js --source <file> --runtime-target <file> --library-id <id> [--registry <json>] [--note <text>]');
        process.exit(1);
    }
    if (!fs.existsSync(opts.source)) {
        console.error(`[promote-ui-library-asset] 找不到來源檔: ${opts.source}`);
        process.exit(1);
    }
}

function sha256(filePath) {
    const hash = crypto.createHash('sha256');
    hash.update(fs.readFileSync(filePath));
    return hash.digest('hex');
}

function loadRegistry(filePath) {
    if (!fs.existsSync(filePath)) {
        return { version: 1, updatedAt: new Date().toISOString(), libraryRoot: 'artifacts/ui-library', assets: [], promotions: [] };
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveRegistry(filePath, registry) {
    registry.updatedAt = new Date().toISOString();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(registry, null, 2) + '\n', 'utf8');
}

function main() {
    const opts = parseArgs(process.argv.slice(2));
    ensureArgs(opts);

    const sourceHash = sha256(opts.source);
    const registry = loadRegistry(opts.registry);
    const existingByHash = (registry.promotions || []).find((entry) => entry.sha256 === sourceHash);

    if (existingByHash && path.resolve(existingByHash.runtimeTarget) !== opts.runtimeTarget) {
        console.log(`[promote-ui-library-asset] 已存在相同內容，沿用 canonical target:`);
        console.log(existingByHash.runtimeTarget);
        process.exit(0);
    }

    if (fs.existsSync(opts.runtimeTarget)) {
        const targetHash = sha256(opts.runtimeTarget);
        if (targetHash !== sourceHash) {
            console.error(`[promote-ui-library-asset] 目標已存在且內容不同，拒絕覆蓋: ${opts.runtimeTarget}`);
            process.exit(1);
        }
        console.log(`[promote-ui-library-asset] runtime 已存在相同檔案，直接重用: ${opts.runtimeTarget}`);
    } else {
        fs.mkdirSync(path.dirname(opts.runtimeTarget), { recursive: true });
        fs.copyFileSync(opts.source, opts.runtimeTarget);
        console.log(`[promote-ui-library-asset] 已升格到 runtime: ${opts.runtimeTarget}`);
    }

    const promotion = {
        libraryId: opts.libraryId,
        source: opts.source,
        runtimeTarget: opts.runtimeTarget,
        sha256: sourceHash,
        note: opts.note || '',
        promotedAt: new Date().toISOString(),
    };

    const existingIndex = (registry.promotions || []).findIndex((entry) => entry.sha256 === sourceHash && path.resolve(entry.runtimeTarget) === opts.runtimeTarget);
    if (existingIndex >= 0) {
        registry.promotions[existingIndex] = promotion;
    } else {
        registry.promotions.push(promotion);
    }

    const assetEntry = (registry.assets || []).find((entry) => entry.libraryId === opts.libraryId);
    if (assetEntry) {
        assetEntry.lastPromotedTarget = opts.runtimeTarget;
        assetEntry.lastPromotedSha256 = sourceHash;
    }

    saveRegistry(opts.registry, registry);
}

main();
