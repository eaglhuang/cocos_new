#!/usr/bin/env node
/**
 * headless-snapshot-test.js — UI Spec JSON 結構快照測試
 *
 * 對所有 layout / skin / screen JSON 產生結構 hash，
 * 與上次快照比對，報告新增 / 刪除 / 變更。
 *
 * Usage:
 *   node tools_node/headless-snapshot-test.js                 # 比對
 *   node tools_node/headless-snapshot-test.js --update        # 更新快照
 *   node tools_node/headless-snapshot-test.js --ci            # CI 模式（變更即 exit 1）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const config = require('./lib/project-config');

const SNAPSHOT_PATH = path.join(config.paths.toolsNodeDir, '.ui-spec-snapshot.json');

// ─── helpers ──────────────────────────────────────────────

/** 遞迴收集指定目錄下所有 .json 檔案 */
function collectJsonFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...collectJsonFiles(fullPath));
        } else if (entry.name.endsWith('.json') && !entry.name.endsWith('.meta')) {
            results.push(fullPath);
        }
    }
    return results;
}

/** 提取 JSON 結構 hash（忽略文字值，只保留 key 結構與 type） */
function structureHash(obj) {
    const skeleton = extractSkeleton(obj);
    const json = JSON.stringify(skeleton);
    return crypto.createHash('sha256').update(json).digest('hex').slice(0, 16);
}

/** 遞迴提取結構骨架：key name + value type（不含具體值） */
function extractSkeleton(obj) {
    if (obj === null || obj === undefined) return null;
    if (Array.isArray(obj)) {
        // 只取第一個元素的結構代表整個陣列
        return obj.length > 0 ? [extractSkeleton(obj[0])] : [];
    }
    if (typeof obj === 'object') {
        const result = {};
        for (const key of Object.keys(obj).sort()) {
            result[key] = extractSkeleton(obj[key]);
        }
        return result;
    }
    // 基本型別只記錄 type
    return typeof obj;
}

/** 產生所有 spec 的 snapshot map */
function generateSnapshot() {
    const snapshot = {};

    const dirs = [
        { dir: config.paths.layoutsDir, prefix: 'layouts/' },
        { dir: config.paths.skinsDir, prefix: 'skins/' },
        { dir: config.paths.screensDir, prefix: 'screens/' },
        { dir: config.paths.contractsDir, prefix: 'contracts/' },
        { dir: config.paths.widgetFragmentsDir, prefix: 'fragments/widgets/' },
        { dir: config.paths.layoutFragmentsDir, prefix: 'fragments/layouts/' },
        { dir: config.paths.skinFragmentsDir, prefix: 'fragments/skins/' },
    ];

    for (const { dir, prefix } of dirs) {
        for (const file of collectJsonFiles(dir)) {
            const relPath = prefix + path.relative(dir, file).replace(/\\/g, '/');
            try {
                const content = JSON.parse(fs.readFileSync(file, 'utf-8'));
                snapshot[relPath] = {
                    hash: structureHash(content),
                    nodeCount: countNodes(content),
                };
            } catch {
                snapshot[relPath] = { hash: 'PARSE_ERROR', nodeCount: 0 };
            }
        }
    }

    return snapshot;
}

/** 計算 layout 節點數（遞迴 children） */
function countNodes(obj) {
    if (!obj || typeof obj !== 'object') return 0;
    let count = obj.id ? 1 : 0;
    if (Array.isArray(obj.children)) {
        for (const child of obj.children) {
            count += countNodes(child);
        }
    }
    return count;
}

// ─── main ─────────────────────────────────────────────────
const args = process.argv.slice(2);
const isUpdate = args.includes('--update');
const isCi = args.includes('--ci');

const current = generateSnapshot();

if (isUpdate) {
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(current, null, 2) + '\n', 'utf-8');
    console.log(`✅ Snapshot updated: ${Object.keys(current).length} spec(s) recorded`);
    process.exit(0);
}

// Compare
if (!fs.existsSync(SNAPSHOT_PATH)) {
    console.log('⚠️  No snapshot found. Run with --update to create initial snapshot.');
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(current, null, 2) + '\n', 'utf-8');
    console.log(`✅ Initial snapshot created: ${Object.keys(current).length} spec(s)`);
    process.exit(0);
}

const previous = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf-8'));
const allKeys = new Set([...Object.keys(previous), ...Object.keys(current)]);

const added = [];
const removed = [];
const changed = [];

for (const key of allKeys) {
    if (!(key in previous)) {
        added.push(key);
    } else if (!(key in current)) {
        removed.push(key);
    } else if (previous[key].hash !== current[key].hash) {
        changed.push({ key, before: previous[key], after: current[key] });
    }
}

const hasChanges = added.length > 0 || removed.length > 0 || changed.length > 0;

if (!hasChanges) {
    console.log(`✅ Snapshot matches: ${Object.keys(current).length} spec(s), no structural changes`);
    process.exit(0);
}

console.log('📊 UI Spec Snapshot Diff:\n');

if (added.length > 0) {
    console.log(`  ➕ Added (${added.length}):`);
    for (const k of added) console.log(`     ${k}`);
}

if (removed.length > 0) {
    console.log(`  ➖ Removed (${removed.length}):`);
    for (const k of removed) console.log(`     ${k}`);
}

if (changed.length > 0) {
    console.log(`  🔄 Changed (${changed.length}):`);
    for (const { key, before, after } of changed) {
        const nodeDiff = after.nodeCount - before.nodeCount;
        const nodeDiffStr = nodeDiff > 0 ? `+${nodeDiff}` : `${nodeDiff}`;
        console.log(`     ${key}  (nodes: ${before.nodeCount} → ${after.nodeCount} [${nodeDiffStr}])`);
    }
}

console.log(`\nTotal: +${added.length} -${removed.length} ~${changed.length}`);

if (isCi) {
    process.exit(1);
}
