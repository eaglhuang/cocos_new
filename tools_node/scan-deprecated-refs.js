#!/usr/bin/env node
/**
 * scan-deprecated-refs.js
 *
 * 掃描 assets/scripts/ 下所有 .ts 檔案對 _deprecated/ 的 import/require 引用。
 *
 * 用法：
 *   node tools_node/scan-deprecated-refs.js [options]
 *
 * Options:
 *   --root <path>    掃描根目錄（預設：assets/scripts）
 *   --json           以 JSON 輸出結果
 *   --strict         有任何引用就以 exit 1 離開（預設行為相同，但明確化用於 CI）
 *
 * Exit 0 = 無 _deprecated/ 引用（乾淨）
 * Exit 1 = 有引用（需要清理）
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ──────────────────────────────────────────────────────────────
// 參數解析
// ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const jsonMode  = args.includes('--json');
const strictMode = args.includes('--strict');

let rootArg = 'assets/scripts';
const rootIdx = args.indexOf('--root');
if (rootIdx !== -1 && args[rootIdx + 1]) {
    rootArg = args[rootIdx + 1];
}

const projectRoot = path.resolve(__dirname, '..');
const scanRoot    = path.resolve(projectRoot, rootArg);

// ──────────────────────────────────────────────────────────────
// 掃描工具
// ──────────────────────────────────────────────────────────────

/**
 * 遞迴收集目錄下所有 .ts 檔案（跳過 _deprecated/ 目錄本身）
 */
function collectTsFiles(dir) {
    const results = [];
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return results;
    }
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            // 跳過 _deprecated/ 目錄自身（它裡面的檔案不需要被掃描，只有外部引用才是問題）
            if (entry.name === '_deprecated') continue;
            results.push(...collectTsFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
            results.push(fullPath);
        }
    }
    return results;
}

/**
 * 在檔案中搜尋對 _deprecated/ 的引用行
 * 比對模式：import ... from '..._deprecated/...'  或 require('..._deprecated/...')
 */
const DEPRECATED_PATTERN = /['"`][^'"`]*\/_deprecated\/[^'"`]*['"`]/;

function scanFile(filePath) {
    let content;
    try {
        content = fs.readFileSync(filePath, 'utf8');
    } catch {
        return [];
    }

    const hits = [];
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (DEPRECATED_PATTERN.test(line)) {
            hits.push({
                line: i + 1,
                text: line.trim(),
            });
        }
    }
    return hits;
}

// ──────────────────────────────────────────────────────────────
// 主要流程
// ──────────────────────────────────────────────────────────────

function run() {
    if (!fs.existsSync(scanRoot)) {
        const msg = `[scan-deprecated-refs] 掃描根目錄不存在：${scanRoot}`;
        if (jsonMode) {
            console.log(JSON.stringify({ ok: false, error: msg, refs: [] }));
        } else {
            console.error(msg);
        }
        process.exit(1);
    }

    const tsFiles = collectTsFiles(scanRoot);
    const refMap  = [];   // [{ file, hits: [{ line, text }] }]

    for (const f of tsFiles) {
        const hits = scanFile(f);
        if (hits.length > 0) {
            refMap.push({
                file: path.relative(projectRoot, f).replace(/\\/g, '/'),
                hits,
            });
        }
    }

    const totalRefs = refMap.reduce((sum, r) => sum + r.hits.length, 0);
    const ok        = totalRefs === 0;

    if (jsonMode) {
        console.log(JSON.stringify({ ok, totalFiles: tsFiles.length, totalRefs, refs: refMap }, null, 2));
    } else {
        console.log(`\n🔍 scan-deprecated-refs — 掃描 ${tsFiles.length} 個 .ts 檔案`);
        console.log(`   根目錄：${path.relative(projectRoot, scanRoot).replace(/\\/g, '/')}\n`);

        if (ok) {
            console.log('✅  無任何 _deprecated/ 引用。可安全刪除 _deprecated/ 目錄。');
        } else {
            console.log(`❌  發現 ${totalRefs} 個 _deprecated/ 引用（${refMap.length} 個檔案）：\n`);
            for (const { file, hits } of refMap) {
                console.log(`  📄 ${file}`);
                for (const { line, text } of hits) {
                    console.log(`      行 ${String(line).padStart(4)}：${text}`);
                }
            }
            console.log('\n   請先移除以上引用，再刪除 _deprecated/ 目錄。');
        }
        console.log('');
    }

    process.exit(ok ? 0 : 1);
}

run();
