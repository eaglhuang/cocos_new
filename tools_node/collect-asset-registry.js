#!/usr/bin/env node
// @spec-source → docs/UCUF規範文件.md §6  (UCUF M6)
/**
 * collect-asset-registry.js
 *
 * UCUF M6 — Asset Registry 靜態收集工具
 *
 * 掃描 assets/resources/ui-spec/screens/*.json，對每個 screen：
 *   1. 解析 layout JSON（遞迴展開 $ref fragments）
 *   2. 解析 skin manifest（展開 themeStack 繼承鏈）
 *   3. 收集 tabRouting 中引用的 fragment 路徑
 *   4. 彙整所有 sprite 路徑 + spec 路徑，輸出 AssetRegistryEntry[]
 *
 * CLI:
 *   node tools_node/collect-asset-registry.js
 *   node tools_node/collect-asset-registry.js --report docs/asset-registry.json
 *   node tools_node/collect-asset-registry.js --screen general-detail-unified-screen
 *   node tools_node/collect-asset-registry.js --strict
 *
 * 輸出格式：AssetAuditReport（見 AssetRegistryEntry.ts）
 *
 * Unity 對照：Addressable Groups window 的靜態依賴掃描。
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SCREENS_DIR  = path.join(PROJECT_ROOT, 'assets', 'resources', 'ui-spec', 'screens');
const LAYOUTS_DIR  = path.join(PROJECT_ROOT, 'assets', 'resources', 'ui-spec', 'layouts');
const SKINS_DIR    = path.join(PROJECT_ROOT, 'assets', 'resources', 'ui-spec', 'skins');
const FRAGMENTS_DIR = path.join(PROJECT_ROOT, 'assets', 'resources', 'ui-spec', 'fragments');

// ─── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs() {
    const args = process.argv.slice(2);
    const opts = {
        report:   path.join(PROJECT_ROOT, 'docs', 'asset-registry.json'),
        screen:   null,
        strict:   false,
        verbose:  false,
        help:     false,
    };
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--report':  opts.report  = args[++i]; break;
            case '--screen':  opts.screen  = args[++i]; break;
            case '--strict':  opts.strict  = true;       break;
            case '--verbose': opts.verbose = true;       break;
            case '--help': case '-h': opts.help = true;  break;
        }
    }
    return opts;
}

function printHelp() {
    console.log(`
Usage: node tools_node/collect-asset-registry.js [options]

Options:
  --report <path>    Output JSON report path (default: docs/asset-registry.json)
  --screen <id>      Only process one specific screen ID
  --strict           Exit 1 if any missing assets found
  --verbose          Print each asset as it is collected
  --help, -h         Show this help

Output:
  AssetAuditReport JSON with entries[], orphans[], summary
`);
}

// ─── JSON 載入工具 ─────────────────────────────────────────────────────────────

function loadJson(filePath) {
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        return null;
    }
}

function resolveLayoutPath(layoutId) {
    return path.join(LAYOUTS_DIR, `${layoutId}.json`);
}

function resolveSkinPath(skinId) {
    return path.join(SKINS_DIR, `${skinId}.json`);
}

function resolveFragmentPath(fragmentRef) {
    // fragment refs look like "fragments/layouts/gd-tab-overview"
    // which maps to assets/resources/ui-spec/fragments/layouts/gd-tab-overview.json
    return path.join(PROJECT_ROOT, 'assets', 'resources', 'ui-spec', `${fragmentRef}.json`);
}

// ─── 路徑相對化工具 ────────────────────────────────────────────────────────────

function toRelative(absPath) {
    return path.relative(path.join(PROJECT_ROOT, 'assets', 'resources'), absPath)
        .replace(/\\/g, '/');
}

// ─── Skin slot 路徑萃取 ────────────────────────────────────────────────────────

const SPRITE_KEYS = ['path', 'normal', 'pressed', 'disabled', 'focused', 'hover', 'spriteFrame'];

function extractSkinSlotPaths(slots, skinId, refs) {
    if (!slots || typeof slots !== 'object') return;

    for (const [slotKey, slotValue] of Object.entries(slots)) {
        if (!slotValue || typeof slotValue !== 'object') continue;
        for (const key of SPRITE_KEYS) {
            const val = slotValue[key];
            if (typeof val === 'string' && val.startsWith('sprites/')) {
                refs.push({
                    type:         'spriteFrame',
                    path:         val,
                    registeredIn: `skins/${skinId}#${slotKey}.${key}`,
                });
            }
        }
    }
}

// ─── Skin themeStack 展開 ──────────────────────────────────────────────────────

function collectSkinAssets(skinId, refs, visited = new Set()) {
    if (visited.has(skinId)) return;
    visited.add(skinId);

    const skinPath = resolveSkinPath(skinId);
    const skin     = loadJson(skinPath);
    if (!skin) return;

    // 基礎 slots
    extractSkinSlotPaths(skin.slots, skinId, refs);

    // themeStack 繼承鏈（從低到高疊加）
    if (Array.isArray(skin.themeStack)) {
        for (const baseId of skin.themeStack) {
            collectSkinAssets(baseId, refs, visited);
        }
    }
}

// ─── Layout $ref 遞迴展開 ──────────────────────────────────────────────────────

function collectNodeRefs(node, registeredIn, refs) {
    if (!node || typeof node !== 'object') return;

    // $ref 引用 fragment
    if (typeof node['$ref'] === 'string') {
        const fragRef = node['$ref'];
        refs.push({
            type:         'fragment',
            path:         `ui-spec/${fragRef}`,
            registeredIn,
        });
        // 遞迴解析 fragment 本身
        const fragPath = resolveFragmentPath(fragRef);
        const fragJson = loadJson(fragPath);
        if (fragJson) {
            collectNodeRefs(fragJson.root || fragJson, `ui-spec/${fragRef}`, refs);
        }
    }

    // skinSlot 宣告（layout node 中有 skinSlot 欄位）
    if (typeof node.skinSlot === 'string') {
        // skinSlot name → 記錄（路徑在 skin manifest 中解析）
        // 這裡僅記錄 layout 層的 skinSlot 宣告，不展開路徑
    }

    // 遞迴子節點
    if (Array.isArray(node.children)) {
        for (const child of node.children) {
            collectNodeRefs(child, registeredIn, refs);
        }
    }
}

function collectLayoutAssets(layoutId, refs) {
    const layoutPath = resolveLayoutPath(layoutId);
    const layout     = loadJson(layoutPath);
    if (!layout) return;

    refs.push({
        type:         'layout',
        path:         `ui-spec/layouts/${layoutId}`,
        registeredIn: 'screen',
    });

    collectNodeRefs(layout.root, `ui-spec/layouts/${layoutId}`, refs);
}

// ─── Screen 處理 ───────────────────────────────────────────────────────────────

function processScreen(screenFile, opts) {
    const screen = loadJson(screenFile);
    if (!screen) return null;

    const screenId = screen.id || path.basename(screenFile, '.json');
    const layoutId = screen.layout || '';
    const skinId   = screen.skin   || '';

    if (opts.verbose) {
        console.log(`  [collect] ${screenId} → layout=${layoutId} skin=${skinId}`);
    }

    const refs = [];

    // layout spec
    if (layoutId) {
        collectLayoutAssets(layoutId, refs);
    }

    // skin manifest
    if (skinId) {
        refs.push({
            type:         'skin',
            path:         `ui-spec/skins/${skinId}`,
            registeredIn: 'screen',
        });
        collectSkinAssets(skinId, refs);
    }

    // tabRouting fragments
    if (screen.tabRouting && typeof screen.tabRouting === 'object') {
        for (const [tabKey, route] of Object.entries(screen.tabRouting)) {
            if (route && typeof route.fragment === 'string') {
                const fragRef = route.fragment;
                refs.push({
                    type:         'fragment',
                    path:         `ui-spec/${fragRef}`,
                    registeredIn: `screens/${screenId}#tabRouting.${tabKey}`,
                });
                // 遞迴解析 fragment
                const fragPath = resolveFragmentPath(fragRef);
                const fragJson = loadJson(fragPath);
                if (fragJson) {
                    collectNodeRefs(fragJson.root || fragJson, `ui-spec/${fragRef}`, refs);
                }
            }
        }
    }

    // 檢查 missing：spec path 對應的 JSON 是否存在
    const missing = refs
        .filter(r => r.type === 'layout' || r.type === 'skin' || r.type === 'fragment')
        .filter(r => {
            const fPath = path.join(PROJECT_ROOT, 'assets', 'resources', r.path + '.json');
            return !fs.existsSync(fPath);
        })
        .map(r => ({ ...r }));

    // spriteFrame 存在性檢查（只掃描 .png / .jpg）
    const missingSprites = refs
        .filter(r => r.type === 'spriteFrame')
        .filter(r => {
            const base = path.join(PROJECT_ROOT, 'assets', 'resources', r.path);
            return !fs.existsSync(base + '.png')
                && !fs.existsSync(base + '.jpg')
                && !fs.existsSync(base + '.jpeg');
        })
        .map(r => ({ ...r }));

    const allMissing = [...missing, ...missingSprites];

    return {
        screenId,
        layoutId,
        skinId,
        assets:  refs,
        missing: allMissing,
        dynamic: [],
    };
}

// ─── メイン ────────────────────────────────────────────────────────────────────

function main() {
    const opts = parseArgs();
    if (opts.help) { printHelp(); process.exit(0); }

    console.log('[collect-asset-registry] 開始掃描 UI Spec...');

    // 收集 screen 檔案
    let screenFiles;
    if (opts.screen) {
        const specific = path.join(SCREENS_DIR, `${opts.screen}.json`);
        if (!fs.existsSync(specific)) {
            console.error(`  error: Screen not found: ${specific}`);
            process.exit(1);
        }
        screenFiles = [specific];
    } else {
        screenFiles = fs.readdirSync(SCREENS_DIR)
            .filter(f => f.endsWith('.json') && !f.endsWith('.meta'))
            .map(f => path.join(SCREENS_DIR, f));
    }

    console.log(`  掃描 ${screenFiles.length} 個 screens...`);

    const entries = [];
    for (const sf of screenFiles) {
        const entry = processScreen(sf, opts);
        if (entry) entries.push(entry);
    }

    // 統計
    const totalAssets  = entries.reduce((s, e) => s + e.assets.length, 0);
    const totalMissing = entries.reduce((s, e) => s + e.missing.length, 0);

    const report = {
        timestamp: new Date().toISOString(),
        entries,
        orphans:   [],  // orphan 掃描由 audit-asset-usage.js 補充
        summary: {
            totalScreens:  entries.length,
            totalAssets,
            totalMissing,
            totalOrphans:  0,
            totalDynamic:  0,
        },
    };

    // 輸出報告
    const reportDir = path.dirname(opts.report);
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(opts.report, JSON.stringify(report, null, 2), 'utf8');

    console.log(`\n[collect-asset-registry] 完成`);
    console.log(`  screens:  ${entries.length}`);
    console.log(`  assets:   ${totalAssets}`);
    console.log(`  missing:  ${totalMissing}`);
    console.log(`  report:   ${opts.report}`);

    if (opts.strict && totalMissing > 0) {
        console.error(`\n  error: ${totalMissing} missing assets detected (--strict mode)`);
        process.exit(1);
    }

    process.exit(0);
}

main();
