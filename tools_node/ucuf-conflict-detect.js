#!/usr/bin/env node
/**
 * ucuf-conflict-detect.js — UCUF 靜態衝突偵測工具
 *
 * 用法：
 *   node tools_node/ucuf-conflict-detect.js
 *   node tools_node/ucuf-conflict-detect.js --strict
 *   node tools_node/ucuf-conflict-detect.js --json
 *
 * 偵測項目：
 *   C-01  skinSlot ID 衝突：同一 slotId 在不同 skin manifest 中指向不同 path
 *   C-02  dataSource 衝突：同一 dataSource 被多個不同 Screen 的 ChildPanel 宣告使用
 *   C-03  規則 ID 重複：ucuf-rules-registry.json 中有重複的 rule id
 *
 * 輸出格式與 validate-ui-specs.js 一致：
 *   failures[]  → severity: 'error'（--strict 模式下會以非 0 exit code 退出）
 *   warnings[]  → severity: 'warning'
 *
 * --strict  有任何 failure 時 exit 1（預設 exit 0）
 * --json    輸出 JSON 格式而非可讀純文字
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const UI_SPEC_ROOT = path.resolve(__dirname, '../assets/resources/ui-spec');
const REGISTRY_PATH = path.join(UI_SPEC_ROOT, 'ucuf-rules-registry.json');

// ─────────────────────────────────────────────────────────────────────────────
// Arg parser
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
    return {
        strict: argv.includes('--strict'),
        json:   argv.includes('--json'),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// File helpers
// ─────────────────────────────────────────────────────────────────────────────

/** 遞迴搜集指定目錄下所有 .json 檔案路徑 */
function collectJsonFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir)) { return results; }
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...collectJsonFiles(full));
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
            results.push(full);
        }
    }
    return results;
}

/** 安全地解析 JSON 檔案；解析失敗回傳 null */
function safeParse(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
        return null;
    }
}

/** 取相對於 ui-spec 根目錄的路徑（供錯誤訊息使用） */
function relPath(fullPath) {
    return path.relative(UI_SPEC_ROOT, fullPath).replace(/\\/g, '/');
}

// ─────────────────────────────────────────────────────────────────────────────
// C-01: skinSlot ID 衝突
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 掃描 skins/ 目錄下所有 skin manifest，收集每個 slotId 的所有 (path, sourceFile) 配對。
 * 若同一 slotId 出現多個不同的 path 值，即為衝突。
 */
function detectSkinSlotConflicts() {
    const failures = [];
    const skinDir = path.join(UI_SPEC_ROOT, 'skins');
    const files = collectJsonFiles(skinDir);

    // slotId → Map<path-value, sourceFile>
    const slotPathRegistry = new Map(); // Map<string, Map<string, string>>

    for (const file of files) {
        const data = safeParse(file);
        if (!data) { continue; }

        const slots = data.slots || data.skinSlots || data.skinLayers || [];
        const slotArray = Array.isArray(slots) ? slots : Object.entries(slots).map(([id, v]) => ({ slotId: id, ...v }));

        for (const slot of slotArray) {
            const slotId = slot.slotId || slot.id;
            const slotPath = slot.path || slot.spriteFramePath || slot.src;
            if (!slotId || slotPath === undefined) { continue; }

            if (!slotPathRegistry.has(slotId)) {
                slotPathRegistry.set(slotId, new Map());
            }
            slotPathRegistry.get(slotId).set(String(slotPath), relPath(file));
        }
    }

    for (const [slotId, pathMap] of slotPathRegistry) {
        if (pathMap.size > 1) {
            const entries = [...pathMap.entries()].map(([p, src]) => `"${p}" (in ${src})`).join(' vs ');
            failures.push({
                rule: 'C-01',
                severity: 'error',
                message: `C-01 FAIL: skinSlot "${slotId}" 指向多個不同 path：${entries}`,
            });
        }
    }

    return failures;
}

// ─────────────────────────────────────────────────────────────────────────────
// C-02: dataSource 衝突（跨 Screen）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 掃描 screens/ 目錄下所有 screen JSON 中的 childPanels[].dataSource，
 * 若相同的 dataSource 字串出現在不同 screenId 的 ChildPanel 中，視為跨畫面衝突警告。
 * （同一畫面內重複 → 由 RT-02 在 runtime 捕捉，此工具僅偵測跨畫面衝突）
 */
function detectDataSourceConflicts() {
    const warnings = [];
    const screenDir = path.join(UI_SPEC_ROOT, 'screens');
    const files = collectJsonFiles(screenDir);

    // dataSource → [{ screenId, sourceFile }]
    const dsRegistry = new Map();

    for (const file of files) {
        const data = safeParse(file);
        if (!data) { continue; }

        const screenId = data.id || data.screenId || relPath(file);
        const childPanels  = data.childPanels || [];
        const contentReqs  = data.contentRequirements || {};
        const reqFields    = contentReqs.requiredFields || [];

        // Collect from childPanels array
        for (const cp of childPanels) {
            const ds = cp.dataSource;
            if (!ds) { continue; }
            if (!dsRegistry.has(ds)) { dsRegistry.set(ds, []); }
            dsRegistry.get(ds).push({ screenId, file: relPath(file) });
        }

        // Collect from requiredFields (dataSource declarations)
        for (const field of reqFields) {
            const ds = typeof field === 'string' ? field : field.key;
            if (!ds) { continue; }
            if (!dsRegistry.has(ds)) { dsRegistry.set(ds, []); }
            dsRegistry.get(ds).push({ screenId, file: relPath(file) });
        }
    }

    for (const [ds, usages] of dsRegistry) {
        // Group by screenId
        const screenIds = [...new Set(usages.map(u => u.screenId))];
        if (screenIds.length > 1) {
            const detail = usages.map(u => `${u.screenId} (${u.file})`).join(', ');
            warnings.push({
                rule: 'C-02',
                severity: 'warning',
                message: `C-02 WARN: dataSource "${ds}" 被多個 Screen 使用：${detail}`,
            });
        }
    }

    return warnings;
}

// ─────────────────────────────────────────────────────────────────────────────
// C-03: 規則 ID 重複
// ─────────────────────────────────────────────────────────────────────────────

function detectRuleIdDuplicates() {
    const failures = [];

    if (!fs.existsSync(REGISTRY_PATH)) {
        return failures; // registry 不存在時靜默跳過
    }

    const registry = safeParse(REGISTRY_PATH);
    if (!registry || !Array.isArray(registry.rules)) { return failures; }

    const seen = new Map(); // id → index
    for (let i = 0; i < registry.rules.length; i++) {
        const r = registry.rules[i];
        const id = r.id;
        if (!id) { continue; }
        if (seen.has(id)) {
            failures.push({
                rule: 'C-03',
                severity: 'error',
                message: `C-03 FAIL: ucuf-rules-registry.json 中 rule.id "${id}" 重複出現（index ${seen.get(id)} 與 ${i}）`,
            });
        } else {
            seen.set(id, i);
        }
    }

    return failures;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main() {
    const args = parseArgs(process.argv.slice(2));

    const failures = [
        ...detectSkinSlotConflicts(),
        ...detectRuleIdDuplicates(),
    ];
    const warnings = [
        ...detectDataSourceConflicts(),
    ];

    const passed = failures.length === 0;

    if (args.json) {
        console.log(JSON.stringify({ passed, failures, warnings }, null, 2));
    } else {
        console.log('[ucuf-conflict-detect] 掃描 UI spec 衝突…');
        if (failures.length === 0 && warnings.length === 0) {
            console.log('[ucuf-conflict-detect] OK — 未偵測到衝突');
        }
        for (const f of failures) {
            console.error(`  [ERROR] ${f.message}`);
        }
        for (const w of warnings) {
            console.warn(`  [WARN]  ${w.message}`);
        }
        console.log(`[ucuf-conflict-detect] 結果：${failures.length} 個錯誤，${warnings.length} 個警告`);
    }

    if (args.strict && !passed) {
        process.exit(1);
    }
}

main();
