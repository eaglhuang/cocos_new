#!/usr/bin/env node
/**
 * validate-visual-assets.js
 *
 * Visual Asset QA Rule Engine — Phase G UI-2-0086
 *
 * 讀取 ui-spec/skins/*.json 與 ui-spec/recipes/families/*.recipe.json，
 * 針對每個 slot 執行 6 類資產級 QA 規則，輸出 report。
 *
 * 使用範例：
 *   # 標準檢查
 *   node tools_node/validate-visual-assets.js
 *
 *   # 嚴格模式（任何 error 以 exit 1 結束）
 *   node tools_node/validate-visual-assets.js --strict
 *
 *   # 只檢查特定 family
 *   node tools_node/validate-visual-assets.js --family dark-metal
 *
 *   # 輸出 JSON report
 *   node tools_node/validate-visual-assets.js --report artifacts/ui-qa/asset-qa-report.json
 *
 *   # 自訂設定檔
 *   node tools_node/validate-visual-assets.js --config tools_node/qa-rules-config.json
 *
 * 規則清單：
 *   R1 nine-slice 安全區    — sliced sprite border 不得為 [0,0,0,0]，min >= 4px
 *   R2 bleed 存在性         — 高強度 family 若有 edge slot 則必須有 bleed slot
 *   R3 shadow 層存在性      — dark-metal / destructive 建議含 shadow slot
 *   R4 alpha fringe         — spriteType=sliced 必須設定 border
 *   R5 atlas padding        — allowAutoAtlas=true 時 border 不超過 32px
 *   R6 字色對比             — label-style color vs 常見背景需達 WCAG AA 4.5:1
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const PROJECT_ROOT  = path.resolve(__dirname, '..');
const SKINS_DIR     = path.join(PROJECT_ROOT, 'assets', 'resources', 'ui-spec', 'skins');
const RECIPES_DIR   = path.join(PROJECT_ROOT, 'assets', 'resources', 'ui-spec', 'recipes', 'families');
const DEFAULT_CFG   = path.join(PROJECT_ROOT, 'tools_node', 'qa-rules-config.json');

// ─── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs() {
    const args  = process.argv.slice(2);
    const opts  = { strict: false, family: null, report: null, config: DEFAULT_CFG };
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--strict':  opts.strict  = true; break;
            case '--family':  opts.family  = args[++i]; break;
            case '--report':  opts.report  = args[++i]; break;
            case '--config':  opts.config  = args[++i]; break;
            case '--help': case '-h': printHelp(); process.exit(0);
        }
    }
    return opts;
}

function printHelp() {
    console.log([
        '',
        '使用方式：',
        '  node tools_node/validate-visual-assets.js [options]',
        '',
        '選項：',
        '  --strict              任何 error 結束時以 exit code 1 回傳',
        '  --family <id>         只檢查含有此 family 名稱前綴的 skin 檔案',
        '  --report <path>       輸出 JSON report 至指定路徑',
        '  --config <path>       使用指定設定檔（預設：tools_node/qa-rules-config.json）',
        '',
    ].join('\n'));
}

// ─── 色彩工具（WCAG 相對亮度） ───────────────────────────────────────────────

/** 解析 "#RRGGBB" 或 "#RRGGBBAA" → { r, g, b } (0-255) */
function parseHex(hex) {
    const h = hex.replace(/^#/, '');
    if (h.length < 6) return null;
    return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
    };
}

/** WCAG 相對亮度（0~1）*/
function relativeLuminance({ r, g, b }) {
    const toLinear = (c) => {
        const s = c / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG 對比比率（1~21）*/
function contrastRatio(hex1, hex2) {
    const c1 = parseHex(hex1);
    const c2 = parseHex(hex2);
    if (!c1 || !c2) return null;
    const L1 = relativeLuminance(c1);
    const L2 = relativeLuminance(c2);
    const lighter = Math.max(L1, L2);
    const darker  = Math.min(L1, L2);
    return (lighter + 0.05) / (darker + 0.05);
}

// ─── 規則實作 ────────────────────────────────────────────────────────────────

/**
 * R1: nine-slice 安全區
 *   sliced sprite 的 border 不得為 [0,0,0,0]；border[i] >= minBorderPx
 */
function checkR1(slotKey, slot, cfg, failures, warnings) {
    if (slot.kind !== 'sprite-frame') return;
    if (slot.spriteType !== 'sliced') return;
    if (!cfg.enabled) return;

    const b = slot.border;
    if (!b || !Array.isArray(b)) {
        failures.push(`[R1] ${slotKey} — spriteType=sliced 但未設定 border 陣列`);
        return;
    }
    const allZero = b.every((v) => v === 0);
    if (allZero) {
        failures.push(`[R1] ${slotKey} — sliced sprite 的 border 全為 0，nine-slice 無效`);
        return;
    }
    const min = cfg.minBorderPx || 4;
    for (const v of b) {
        if (v > 0 && v < min) {
            warnings.push(`[R1] ${slotKey} — border 值 ${v} 小於建議最小值 ${min}px（可能導致縮放損壞）`);
        }
    }
}

/**
 * R2: bleed 存在性
 *   若 skin 含有特定 family 的 edge slot，則必須也含有對應的 bleed slot
 */
function checkR2(skinJson, skinPath, cfg, failures, warnings) {
    if (!cfg.enabled) return;
    const families = cfg.requireBleedFamilies || ['dark-metal', 'gold-cta', 'destructive'];
    const slots = skinJson.slots || {};

    for (const fam of families) {
        const edgeKeys = Object.keys(slots).filter(
            (k) => k.includes(fam) && (k.endsWith('.edge') || k.includes('.edge-'))
        );
        if (edgeKeys.length === 0) continue;

        const hasBleed = Object.keys(slots).some((k) => k.includes(fam) && k.includes('bleed'));
        if (!hasBleed) {
            const severity = cfg.severity === 'error' ? 'ERROR' : 'WARN';
            const msg = `[R2/${severity}] ${path.basename(skinPath)} — 含 ${fam} edge slot 但未找到對應 bleed slot`;
            if (cfg.severity === 'error') failures.push(msg);
            else warnings.push(msg);
        }
    }
}

/**
 * R3: shadow 層存在性
 *   dark-metal / destructive family skin 建議含 shadow slot
 */
function checkR3(skinJson, skinPath, cfg, failures, warnings) {
    if (!cfg.enabled) return;
    const families = cfg.requireShadowFamilies || ['dark-metal', 'destructive'];
    const slots = skinJson.slots || {};
    const skinId = skinJson.id || path.basename(skinPath, '.json');

    // 只對 family skin 檔案做檢查（skin-family-*.json）
    const isFamilySkin = /skin-family-/.test(path.basename(skinPath));
    if (!isFamilySkin) return;

    for (const fam of families) {
        if (!skinId.includes(fam)) continue;
        const hasShadow = Object.keys(slots).some(
            (k) => k.includes('shadow') || (slots[k].blendMode && slots[k].blendMode === 'multiply')
        );
        if (!hasShadow) {
            warnings.push(`[R3] ${path.basename(skinPath)} — ${fam} family 建議含 shadow slot（blendMode=multiply）`);
        }
    }
}

/**
 * R4: alpha fringe
 *   spriteType=sliced 的 sprite-frame 必須設定 border（與 R1 互補，R4 針對未設定 spriteType 的情形）
 */
function checkR4(slotKey, slot, cfg, failures, warnings) {
    if (!cfg.enabled) return;
    if (slot.kind !== 'sprite-frame') return;
    // 若 spriteType 未設定，但有 border 欄位 → 暗示應為 sliced
    if (slot.spriteType === undefined && slot.border !== undefined) {
        const b = slot.border;
        if (Array.isArray(b) && b.every((v) => v === 0)) {
            warnings.push(`[R4] ${slotKey} — border=[0,0,0,0] 但未宣告 spriteType，可能有 alpha fringe 問題（建議宣告 spriteType: "simple"）`);
        }
    }
    // 若 spriteType=simple 卻設了非零 border → 可疑設定
    if (slot.spriteType === 'simple' && slot.border) {
        const b = slot.border;
        if (Array.isArray(b) && b.some((v) => v > 0)) {
            warnings.push(`[R4] ${slotKey} — spriteType=simple 但設定了非零 border，border 對 simple sprite 無效`);
        }
    }
}

/**
 * R5: atlas padding
 *   allowAutoAtlas=true 時，border 任一值不應超過 maxBorderPxForAutoAtlas
 */
function checkR5(slotKey, slot, cfg, failures, warnings) {
    if (!cfg.enabled) return;
    if (slot.kind !== 'sprite-frame') return;
    if (!slot.allowAutoAtlas) return;
    const max = cfg.maxBorderPxForAutoAtlas || 32;
    if (slot.border && Array.isArray(slot.border)) {
        const maxVal = Math.max(...slot.border);
        if (maxVal > max) {
            warnings.push(`[R5] ${slotKey} — allowAutoAtlas=true 但 border 最大值 ${maxVal} 超過建議上限 ${max}px（Auto Atlas 可能截切）`);
        }
    }
}

/**
 * R6: 字色對比
 *   label-style 的 color 對 knownDarkBg / knownLightBg 必須達 WCAG AA 4.5:1
 */
function checkR6(slotKey, slot, cfg, failures, warnings) {
    if (!cfg.enabled) return;
    if (slot.kind !== 'label-style') return;
    const color = slot.color;
    if (!color || !color.startsWith('#')) return;
    const minRatio = cfg.minContrastRatio || 4.5;

    const allBg = [
        ...(cfg.knownDarkBg  || []).map((c) => ({ bg: c, type: 'dark'  })),
        ...(cfg.knownLightBg || []).map((c) => ({ bg: c, type: 'light' })),
    ];

    for (const { bg, type } of allBg) {
        const ratio = contrastRatio(color, bg);
        if (ratio === null) continue;
        if (ratio < minRatio) {
            warnings.push(
                `[R6] ${slotKey} — color ${color} vs ${type} bg ${bg} 對比度 ${ratio.toFixed(2)} < ${minRatio}（WCAG AA 不合格）`
            );
        }
    }
}

// ─── 掃描與執行 ──────────────────────────────────────────────────────────────

function loadJson(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        return null;
    }
}

/** 掃描目錄下所有 *.json（非 .meta），不遞歸 */
function listJsonFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter((f) => f.endsWith('.json') && !f.endsWith('.meta'))
        .map((f) => path.join(dir, f));
}

/** 執行所有規則針對一個 skin JSON，回傳 { failures, warnings } */
function auditSkinFile(skinPath, config, familyFilter) {
    const skinJson = loadJson(skinPath);
    if (!skinJson) return { failures: [`[LOAD] 無法解析 ${path.basename(skinPath)}`], warnings: [] };

    const skinId = skinJson.id || path.basename(skinPath, '.json');
    // family 過濾
    if (familyFilter && !skinId.includes(familyFilter) && !path.basename(skinPath).includes(familyFilter)) {
        return null; // skip
    }

    const failures = [];
    const warnings = [];
    const rules    = config.rules || {};

    // 以 file 為單位的規則（R2, R3）
    checkR2(skinJson, skinPath, rules.R2_bleed_existence   || { enabled: true, severity: 'warning' }, failures, warnings);
    checkR3(skinJson, skinPath, rules.R3_shadow_existence  || { enabled: true, severity: 'warning' }, failures, warnings);

    // 以 slot 為單位的規則（R1, R4, R5, R6）
    const slots = skinJson.slots || {};
    for (const [slotKey, slot] of Object.entries(slots)) {
        if (!slot || typeof slot !== 'object') continue;
        checkR1(slotKey, slot, rules.R1_nine_slice_safety  || { enabled: true }, failures, warnings);
        checkR4(slotKey, slot, rules.R4_alpha_fringe       || { enabled: true }, failures, warnings);
        checkR5(slotKey, slot, rules.R5_atlas_padding      || { enabled: true }, failures, warnings);
        checkR6(slotKey, slot, rules.R6_label_contrast     || { enabled: true }, failures, warnings);
    }

    return { skinId, failures, warnings };
}

/** 執行所有規則針對一個 recipe JSON */
function auditRecipeFile(recipePath, config, familyFilter) {
    const recipe = loadJson(recipePath);
    if (!recipe) return { failures: [`[LOAD] 無法解析 ${path.basename(recipePath)}`], warnings: [] };

    const recipeId = recipe.id || path.basename(recipePath, '.recipe.json');
    if (familyFilter && !recipeId.includes(familyFilter)) return null;

    const failures = [];
    const warnings = [];
    const rules    = config.rules || {};

    // recipe 的 R1 — 各 layer 的 border
    const layers = recipe.layers || {};
    for (const [layerName, layer] of Object.entries(layers)) {
        if (!layer || typeof layer !== 'object') continue;
        const fakeSlot = {
            kind: 'sprite-frame',
            spriteType: 'sliced',
            border: layer.border,
        };
        if (layer.border) {
            checkR1(`${recipeId}/${layerName}`, fakeSlot, rules.R1_nine_slice_safety || { enabled: true }, failures, warnings);
        }
        // R5 on recipe layers with allowAutoAtlas
        const fakeSlot5 = { kind: 'sprite-frame', allowAutoAtlas: layer.allowAutoAtlas, border: layer.border };
        checkR5(`${recipeId}/${layerName}`, fakeSlot5, rules.R5_atlas_padding || { enabled: true }, failures, warnings);
    }

    return { recipeId, failures, warnings };
}

// ─── main ────────────────────────────────────────────────────────────────────

function main() {
    const opts   = parseArgs();
    const config = loadJson(path.resolve(PROJECT_ROOT, opts.config));
    if (!config) {
        console.error(`[fatal] 無法載入設定檔：${opts.config}`);
        process.exit(1);
    }

    const skinFiles   = listJsonFiles(SKINS_DIR);
    const recipeFiles = listJsonFiles(RECIPES_DIR);

    console.log(`\n=== Visual Asset QA Rule Engine ===`);
    console.log(`Skins:   ${skinFiles.length} 個`);
    console.log(`Recipes: ${recipeFiles.length} 個`);
    if (opts.family) console.log(`Family filter: ${opts.family}`);
    console.log('');

    const report = {
        generatedAt: new Date().toISOString(),
        config: opts.config,
        familyFilter: opts.family || null,
        results: [],
        summary: { totalFiles: 0, filesWithErrors: 0, filesWithWarnings: 0, totalErrors: 0, totalWarnings: 0 },
    };

    let totalErrors = 0, totalWarnings = 0;

    // 審查 skin 檔案
    for (const fp of skinFiles) {
        const result = auditSkinFile(fp, config, opts.family);
        if (result === null) continue; // filtered

        const label = path.relative(PROJECT_ROOT, fp);
        report.results.push({ file: label, ...result });
        report.summary.totalFiles++;

        if (result.failures.length > 0) {
            report.summary.filesWithErrors++;
            console.log(`FAIL  ${label}`);
            result.failures.forEach((m) => console.log(`      ${m}`));
        } else if (result.warnings.length > 0) {
            report.summary.filesWithWarnings++;
            console.log(`WARN  ${label}`);
        } else {
            console.log(`OK    ${label}`);
        }
        result.warnings.forEach((m) => console.log(`      ${m}`));

        totalErrors   += result.failures.length;
        totalWarnings += result.warnings.length;
    }

    // 審查 recipe 檔案
    for (const fp of recipeFiles) {
        const result = auditRecipeFile(fp, config, opts.family);
        if (result === null) continue;

        const label = path.relative(PROJECT_ROOT, fp);
        report.results.push({ file: label, ...result });
        report.summary.totalFiles++;

        if (result.failures.length > 0) {
            report.summary.filesWithErrors++;
            console.log(`FAIL  ${label}`);
            result.failures.forEach((m) => console.log(`      ${m}`));
        } else if (result.warnings.length > 0) {
            report.summary.filesWithWarnings++;
            console.log(`WARN  ${label}`);
        } else {
            console.log(`OK    ${label}`);
        }
        result.warnings.forEach((m) => console.log(`      ${m}`));

        totalErrors   += result.failures.length;
        totalWarnings += result.warnings.length;
    }

    report.summary.totalErrors   = totalErrors;
    report.summary.totalWarnings = totalWarnings;

    // 摘要
    console.log('');
    console.log(`=== 摘要 ===`);
    console.log(`總檔案：${report.summary.totalFiles}，` +
        `有 error：${report.summary.filesWithErrors}，` +
        `有 warning：${report.summary.filesWithWarnings}`);
    console.log(`總 errors=${totalErrors}，warnings=${totalWarnings}`);

    // 輸出 JSON report
    if (opts.report) {
        const reportPath = path.resolve(PROJECT_ROOT, opts.report);
        const dir = path.dirname(reportPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
        console.log(`\n已輸出 JSON report：${path.relative(PROJECT_ROOT, reportPath)}`);
    }

    if (opts.strict && totalErrors > 0) {
        console.error(`\n[strict] 共 ${totalErrors} 個 errors，以 exit code 1 結束。`);
        process.exit(1);
    }
}

main();
