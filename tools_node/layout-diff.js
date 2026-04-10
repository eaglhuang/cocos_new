#!/usr/bin/env node
/**
 * layout-diff.js — Layout JSON 可讀差異報告
 *
 * 比對兩份 Layout JSON，輸出人類可讀的節點 diff（新增/刪除/修改節點、屬性變更）。
 *
 * Usage:
 *   node tools_node/layout-diff.js <before.json> <after.json>
 *   node tools_node/layout-diff.js --git <file>              # 比對 git HEAD vs working copy
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── helpers ──────────────────────────────────────────────

/** 將 layout tree 攤平為 id → node 的 map（含 path） */
function flattenNodes(node, parentPath = '') {
    const map = new Map();
    if (!node || typeof node !== 'object') return map;

    const currentPath = parentPath ? `${parentPath}/${node.id || '?'}` : (node.id || 'root');
    const { children, ...props } = node;
    map.set(currentPath, props);

    if (Array.isArray(children)) {
        for (const child of children) {
            const childMap = flattenNodes(child, currentPath);
            for (const [k, v] of childMap) {
                map.set(k, v);
            }
        }
    }

    return map;
}

/** 比較兩個 plain object 的差異 */
function diffProps(a, b) {
    const changes = [];
    const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

    for (const key of allKeys) {
        if (key === 'id') continue; // id 已用於路徑匹配

        const va = JSON.stringify(a[key]);
        const vb = JSON.stringify(b[key]);

        if (!(key in a)) {
            changes.push({ key, type: 'added', value: b[key] });
        } else if (!(key in b)) {
            changes.push({ key, type: 'removed', value: a[key] });
        } else if (va !== vb) {
            changes.push({ key, type: 'changed', before: a[key], after: b[key] });
        }
    }

    return changes;
}

/** 格式化值（截斷長字串） */
function fmt(v) {
    const s = JSON.stringify(v);
    return s.length > 60 ? s.slice(0, 57) + '...' : s;
}

// ─── main ─────────────────────────────────────────────────
const args = process.argv.slice(2);

let beforeJson, afterJson, label;

if (args[0] === '--git') {
    const filePath = args[1];
    if (!filePath) {
        console.error('Usage: layout-diff.js --git <file>');
        process.exit(1);
    }

    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) {
        console.error(`❌ File not found: ${absPath}`);
        process.exit(1);
    }

    try {
        const relPath = path.relative(process.cwd(), absPath).replace(/\\/g, '/');
        const gitContent = execSync(`git show HEAD:${relPath}`, { encoding: 'utf-8' });
        beforeJson = JSON.parse(gitContent);
    } catch {
        console.error('❌ Cannot read git HEAD version (file may be new or not tracked)');
        process.exit(1);
    }

    afterJson = JSON.parse(fs.readFileSync(absPath, 'utf-8'));
    label = path.relative(process.cwd(), absPath);

} else if (args.length >= 2) {
    const beforePath = path.resolve(args[0]);
    const afterPath = path.resolve(args[1]);

    if (!fs.existsSync(beforePath) || !fs.existsSync(afterPath)) {
        console.error('❌ Both files must exist');
        process.exit(1);
    }

    beforeJson = JSON.parse(fs.readFileSync(beforePath, 'utf-8'));
    afterJson = JSON.parse(fs.readFileSync(afterPath, 'utf-8'));
    label = `${path.basename(args[0])} → ${path.basename(args[1])}`;

} else {
    console.error('Usage:\n  layout-diff.js <before.json> <after.json>\n  layout-diff.js --git <file>');
    process.exit(1);
}

// ─── diff ─────────────────────────────────────────────────
const beforeMap = flattenNodes(beforeJson);
const afterMap = flattenNodes(afterJson);

const allPaths = new Set([...beforeMap.keys(), ...afterMap.keys()]);
const addedNodes = [];
const removedNodes = [];
const modifiedNodes = [];

for (const p of allPaths) {
    if (!beforeMap.has(p)) {
        addedNodes.push(p);
    } else if (!afterMap.has(p)) {
        removedNodes.push(p);
    } else {
        const changes = diffProps(beforeMap.get(p), afterMap.get(p));
        if (changes.length > 0) {
            modifiedNodes.push({ path: p, changes });
        }
    }
}

const hasChanges = addedNodes.length > 0 || removedNodes.length > 0 || modifiedNodes.length > 0;

console.log(`📊 Layout Diff: ${label}`);
console.log(`   Before: ${beforeMap.size} nodes  After: ${afterMap.size} nodes\n`);

if (!hasChanges) {
    console.log('✅ No structural differences');
    process.exit(0);
}

if (addedNodes.length > 0) {
    console.log(`➕ Added nodes (${addedNodes.length}):`);
    for (const p of addedNodes) {
        const node = afterMap.get(p);
        const type = node.type ? ` [${node.type}]` : '';
        console.log(`   ${p}${type}`);
    }
    console.log();
}

if (removedNodes.length > 0) {
    console.log(`➖ Removed nodes (${removedNodes.length}):`);
    for (const p of removedNodes) {
        const node = beforeMap.get(p);
        const type = node.type ? ` [${node.type}]` : '';
        console.log(`   ${p}${type}`);
    }
    console.log();
}

if (modifiedNodes.length > 0) {
    console.log(`🔄 Modified nodes (${modifiedNodes.length}):`);
    for (const { path: p, changes } of modifiedNodes) {
        console.log(`   ${p}:`);
        for (const c of changes) {
            if (c.type === 'added') {
                console.log(`     + ${c.key}: ${fmt(c.value)}`);
            } else if (c.type === 'removed') {
                console.log(`     - ${c.key}: ${fmt(c.value)}`);
            } else {
                console.log(`     ~ ${c.key}: ${fmt(c.before)} → ${fmt(c.after)}`);
            }
        }
    }
    console.log();
}

console.log(`Summary: +${addedNodes.length} -${removedNodes.length} ~${modifiedNodes.length} node(s)`);
