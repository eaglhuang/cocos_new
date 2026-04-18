#!/usr/bin/env node
// @spec-source → docs/UCUF規範文件.md §6  (UCUF M6)
/**
 * audit-asset-usage.js
 *
 * UCUF M6 — Asset Registry 孤兒檢測工具
 *
 * 讀取 collect-asset-registry.js 產生的 registry JSON，
 * 掃描 assets/resources/sprites/ 的實際檔案，
 * 找出未被任何 screen 引用的孤兒資產。
 *
 * CLI:
 *   node tools_node/audit-asset-usage.js
 *   node tools_node/audit-asset-usage.js --registry docs/asset-registry.json
 *   node tools_node/audit-asset-usage.js --report  docs/asset-audit.json
 *   node tools_node/audit-asset-usage.js --strict
 *   node tools_node/audit-asset-usage.js --verbose
 *
 * Unity 對照：Addressable Groups 裡 Find Unreferenced Assets 功能。
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const PROJECT_ROOT  = path.resolve(__dirname, '..');
const SPRITES_DIR   = path.join(PROJECT_ROOT, 'assets', 'resources', 'sprites');
const DEFAULT_REG   = path.join(PROJECT_ROOT, 'docs', 'asset-registry.json');

// ─── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs() {
    const args = process.argv.slice(2);
    const opts = {
        registry: DEFAULT_REG,
        report:   path.join(PROJECT_ROOT, 'docs', 'asset-audit.json'),
        strict:   false,
        verbose:  false,
        help:     false,
    };
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--registry': opts.registry = args[++i]; break;
            case '--report':   opts.report   = args[++i]; break;
            case '--strict':   opts.strict   = true;       break;
            case '--verbose':  opts.verbose  = true;       break;
            case '--help': case '-h': opts.help = true;   break;
        }
    }
    return opts;
}

function printHelp() {
    console.log(`
Usage: node tools_node/audit-asset-usage.js [options]

Options:
  --registry <path>  Input registry JSON (default: docs/asset-registry.json)
  --report <path>    Output audit JSON (default: docs/asset-audit.json)
  --strict           Exit 1 if any orphans found
  --verbose          Print each file scan result
  --help, -h         Show this help

Description:
  Loads the asset registry built by collect-asset-registry.js, then
  scans assets/resources/sprites/ for all PNG/JPG files and identifies
  any files not referenced in any screen's AssetRegistryEntry.
`);
}

// ─── 工具函數 ──────────────────────────────────────────────────────────────────

function loadJson(filePath) {
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        return null;
    }
}

/**
 * 遞迴收集目錄下所有 .png / .jpg / .jpeg 檔案路徑（相對 assets/resources）
 */
function collectSpriteFiles(dir, baseDir, results = []) {
    if (!fs.existsSync(dir)) return results;
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
        if (item.isDirectory()) {
            collectSpriteFiles(path.join(dir, item.name), baseDir, results);
        } else if (/\.(png|jpg|jpeg)$/i.test(item.name)) {
            const abs  = path.join(dir, item.name);
            const rel  = path.relative(baseDir, abs).replace(/\\/g, '/');
            // 去掉副檔名，與 registry 中的 sprites/... 路徑做比對
            const noExt = rel.replace(/\.(png|jpg|jpeg)$/i, '');
            results.push(noExt);
        }
    }
    return results;
}

// ─── 主邏輯 ───────────────────────────────────────────────────────────────────

function main() {
    const opts = parseArgs();
    if (opts.help) { printHelp(); process.exit(0); }

    console.log('[audit-asset-usage] 開始孤兒資產偵測...');

    // 1. 載入 registry
    if (!fs.existsSync(opts.registry)) {
        console.error(`  error: Registry not found: ${opts.registry}`);
        console.error('  請先執行: node tools_node/collect-asset-registry.js');
        process.exit(1);
    }

    const registry = loadJson(opts.registry);
    if (!registry || !Array.isArray(registry.entries)) {
        console.error(`  error: Invalid registry format: ${opts.registry}`);
        process.exit(1);
    }

    // 2. 建立已引用路徑集合
    const referencedPaths = new Set();
    for (const entry of registry.entries) {
        if (!Array.isArray(entry.assets)) continue;
        for (const ref of entry.assets) {
            if (ref.type === 'spriteFrame' && typeof ref.path === 'string') {
                referencedPaths.add(ref.path);
            }
        }
    }

    console.log(`  registry entries: ${registry.entries.length}`);
    console.log(`  referenced sprites: ${referencedPaths.size}`);

    // 3. 掃描實際 sprite 檔案
    const spritesBase   = path.join(PROJECT_ROOT, 'assets', 'resources');
    const allFiles      = collectSpriteFiles(SPRITES_DIR, spritesBase);

    if (opts.verbose) {
        console.log(`  scanned ${allFiles.length} sprite files`);
    }

    // 4. 找出孤兒
    const orphans = [];
    for (const filePath of allFiles) {
        if (!referencedPaths.has(filePath)) {
            // 判斷所在目錄
            const directory = filePath.substring(0, filePath.lastIndexOf('/'));
            orphans.push({ path: filePath, directory });
            if (opts.verbose) {
                console.log(`  [orphan] ${filePath}`);
            }
        }
    }

    console.log(`  total files:  ${allFiles.length}`);
    console.log(`  referenced:   ${referencedPaths.size}`);
    console.log(`  orphans:      ${orphans.length}`);

    // 5. 產生完整報告（合併進 registry）
    const fullReport = {
        ...registry,
        orphans,
        summary: {
            ...registry.summary,
            totalOrphans: orphans.length,
        },
    };

    const reportDir = path.dirname(opts.report);
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(opts.report, JSON.stringify(fullReport, null, 2), 'utf8');

    console.log(`\n[audit-asset-usage] 完成`);
    console.log(`  report: ${opts.report}`);

    if (opts.strict && orphans.length > 0) {
        console.error(`\n  error: ${orphans.length} orphan assets detected (--strict mode)`);
        process.exit(1);
    }

    process.exit(0);
}

main();
