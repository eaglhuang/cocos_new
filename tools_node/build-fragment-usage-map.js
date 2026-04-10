#!/usr/bin/env node
/**
 * build-fragment-usage-map.js
 * 掃描所有 layout JSON，建立 $ref fragment 的引用地圖。
 *
 * 用法:
 *   node tools_node/build-fragment-usage-map.js              # 輸出到 stdout
 *   node tools_node/build-fragment-usage-map.js --output <file>  # 輸出到檔案
 *   node tools_node/build-fragment-usage-map.js --query <ref>    # 查詢特定 fragment
 */
'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./lib/project-config');

const projectRoot = config.ROOT;
const layoutsDir = config.paths.layoutsDir;

function collectRefs(node, refs) {
    if (!node) return;
    if (node.$ref) {
        refs.push(node.$ref);
    }
    if (node.children) {
        for (const child of node.children) {
            collectRefs(child, refs);
        }
    }
    if (node.itemTemplate) {
        collectRefs(node.itemTemplate, refs);
    }
}

function main() {
    const args = process.argv.slice(2);
    const outputIdx = args.indexOf('--output');
    const outputPath = outputIdx >= 0 ? args[outputIdx + 1] : null;
    const queryIdx = args.indexOf('--query');
    const queryRef = queryIdx >= 0 ? args[queryIdx + 1] : null;

    // fragment → usedBy[]
    const usageMap = {};

    // 掃所有 layout
    const layoutFiles = fs.readdirSync(layoutsDir).filter(f => f.endsWith('.json'));

    for (const file of layoutFiles) {
        const filePath = path.join(layoutsDir, file);
        try {
            const layout = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const refs = [];
            collectRefs(layout.root, refs);

            for (const ref of refs) {
                if (!usageMap[ref]) {
                    usageMap[ref] = { ref, usedBy: [], usageCount: 0 };
                }
                usageMap[ref].usedBy.push(file.replace('.json', ''));
                usageMap[ref].usageCount++;
            }
        } catch (e) {
            console.warn(`⚠️  跳過 ${file}: ${e.message}`);
        }
    }

    // 也掃 fragments/layouts/ (fragment 引用其他 fragment 的情況)
    const fragLayoutsDir = config.paths.layoutFragmentsDir;
    if (fs.existsSync(fragLayoutsDir)) {
        const fragFiles = fs.readdirSync(fragLayoutsDir).filter(f => f.endsWith('.json'));
        for (const file of fragFiles) {
            const filePath = path.join(fragLayoutsDir, file);
            try {
                const node = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                const refs = [];
                collectRefs(node, refs);
                for (const ref of refs) {
                    if (!usageMap[ref]) {
                        usageMap[ref] = { ref, usedBy: [], usageCount: 0 };
                    }
                    usageMap[ref].usedBy.push(`[fragment] ${file.replace('.json', '')}`);
                    usageMap[ref].usageCount++;
                }
            } catch (e) { /* skip */ }
        }
    }

    // 查詢模式
    if (queryRef) {
        const normalizedQuery = queryRef.replace(/\.json$/, '');
        // 嘗試精確匹配和部分匹配
        const matches = Object.keys(usageMap).filter(k =>
            k === normalizedQuery || k.includes(normalizedQuery) || normalizedQuery.includes(k)
        );
        if (matches.length === 0) {
            console.log(`✅ "${normalizedQuery}" 未被任何 layout 引用`);
            return;
        }
        for (const match of matches) {
            const entry = usageMap[match];
            console.log(`\n📎 ${entry.ref} (${entry.usageCount} 次引用):`);
            entry.usedBy.forEach(u => console.log(`   └─ ${u}`));
        }
        return;
    }

    // 完整輸出
    const sortedEntries = Object.values(usageMap).sort((a, b) => b.usageCount - a.usageCount);

    const report = {
        _meta: {
            generatedAt: new Date().toISOString(),
            layoutCount: layoutFiles.length,
            fragmentCount: sortedEntries.length
        },
        fragments: sortedEntries
    };

    if (outputPath) {
        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
        console.log(`✅ Fragment usage map 已輸出: ${outputPath}（${sortedEntries.length} fragments）`);
    } else {
        console.log(`\n📊 Fragment Usage Map（${sortedEntries.length} fragments, ${layoutFiles.length} layouts）\n`);
        for (const entry of sortedEntries) {
            console.log(`  ${entry.ref} (×${entry.usageCount})`);
            entry.usedBy.forEach(u => console.log(`    └─ ${u}`));
        }
    }
}

main();
