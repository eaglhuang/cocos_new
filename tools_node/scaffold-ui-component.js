#!/usr/bin/env node
/**
 * scaffold-ui-component.js — Screen → Panel 一鍵落地工具（Phase F）
 *
 * 根據 screen spec 自動生成：
 *   1. Panel TypeScript 骨架（繼承 UIPreviewBuilder，含 onReady + UIContentBinder）
 *   2. UIConfig.ts UIID stub entry（僅在 --no-uiconfig 時跳過）
 *
 * 使用方式：
 *   node tools_node/scaffold-ui-component.js --screen lobby-main-screen
 *   node tools_node/scaffold-ui-component.js --screen general-detail-screen --family detail-split
 *   node tools_node/scaffold-ui-component.js --screen dialog-confirm-screen --family dialog-card --out assets/scripts/ui/components
 *   node tools_node/scaffold-ui-component.js --screen lobby-main-screen --dry-run
 *
 * Unity 對照：相當於 Unity Editor「Create MonoBehaviour」+ 自動補 Inspector Prefab binding
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const UI_SPEC_ROOT = path.join(PROJECT_ROOT, 'assets', 'resources', 'ui-spec');
const SCREEN_DIR   = path.join(UI_SPEC_ROOT, 'screens');
const CONTRACT_DIR = path.join(UI_SPEC_ROOT, 'contracts');
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const DEFAULT_OUT_DIR = path.join(PROJECT_ROOT, 'assets', 'scripts', 'ui', 'components');
const UICONFIG_PATH = path.join(PROJECT_ROOT, 'assets', 'scripts', 'core', 'config', 'UIConfig.ts');

// ─── UIID → 所在層級的預設映射（由 family 推斷；可被 --layer 覆蓋）─────────
const FAMILY_TO_LAYER = {
    'detail-split':      'PopUp',
    'dialog-card':       'Dialog',
    'rail-list':         'UI',
    'fullscreen-result': 'UI',
};

// ─── 工具函數 ─────────────────────────────────────────────────────────────────

function printHelp() {
    console.log([
        '用法：',
        '  node tools_node/scaffold-ui-component.js --screen <screenId> [options]',
        '',
        '必要參數：',
        '  --screen       screen spec id（對應 screens/*.json 的 id 欄位）',
        '',
        '常用選項：',
        '  --family       template family（detail-split / dialog-card / rail-list / fullscreen-result）',
        '                 若省略，從 screen spec 的 layout 名稱自動推斷',
        '  --out          產出 Panel .ts 的目錄，預設 assets/scripts/ui/components',
        '  --name         類別名稱，預設由 screenId 轉 PascalCase + Panel 後綴',
        '  --no-uiconfig  不自動修改 UIConfig.ts',
        '  --dry-run      只預覽輸出，不寫入檔案',
        '  --help         顯示此說明',
    ].join('\n'));
}

function getArg(name, fallback) {
    const index = process.argv.indexOf(`--${name}`);
    if (index < 0 || index + 1 >= process.argv.length) return fallback === undefined ? '' : fallback;
    return process.argv[index + 1];
}

function hasFlag(name) {
    return process.argv.includes(`--${name}`);
}

function normalizeSlug(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function toPascalCase(value) {
    return normalizeSlug(value)
        .split('-')
        .filter(Boolean)
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join('');
}

function readJson(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
}

function writeFile(filePath, content, dryRun) {
    if (dryRun) {
        console.log(`\n=== [DRY-RUN] ${path.relative(PROJECT_ROOT, filePath)} ===`);
        console.log(content);
        return;
    }
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[scaffold-ui-component] 已寫入 ${path.relative(PROJECT_ROOT, filePath)}`);
}

// ─── Screen Spec 查詢 ─────────────────────────────────────────────────────────

function findScreenSpec(screenId) {
    if (!fs.existsSync(SCREEN_DIR)) {
        console.error(`[scaffold-ui-component] screens 目錄不存在：${SCREEN_DIR}`);
        return null;
    }
    const files = fs.readdirSync(SCREEN_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
        try {
            const json = readJson(path.join(SCREEN_DIR, file));
            if (json.id === screenId) return json;
            // 也支援 multi-screen 格式
            if (Array.isArray(json.screens)) {
                const found = json.screens.find(s => s.id === screenId);
                if (found) return found;
            }
        } catch (_) { /* 略過無效 JSON */ }
    }
    return null;
}

// ─── Family 自動推斷 ──────────────────────────────────────────────────────────

function inferFamily(screenSpec) {
    const layoutId = screenSpec?.layout ?? '';
    for (const family of Object.keys(FAMILY_TO_LAYER)) {
        if (layoutId.includes(family)) return family;
    }
    // 從 contentRequirements 推斷
    const familyId = screenSpec?.contentRequirements?.familyId;
    if (familyId && FAMILY_TO_LAYER[familyId]) return familyId;
    return null;
}

// ─── Panel TypeScript 生成 ────────────────────────────────────────────────────

function generatePanelTs(options) {
    const { screenId, className, family, uiId } = options;
    const templateFile = path.join(TEMPLATES_DIR, `${family}-panel.template.ts`);
    if (!fs.existsSync(templateFile)) {
        console.error(`[scaffold-ui-component] 找不到 template 檔案：${templateFile}`);
        return null;
    }
    let tpl = fs.readFileSync(templateFile, 'utf8');
    tpl = tpl.replace(/\{\{PanelClassName\}\}/g, className);
    tpl = tpl.replace(/\{\{screenId\}\}/g, screenId);
    tpl = tpl.replace(/\{\{uiId\}\}/g, uiId);
    return tpl;
}

// ─── UIConfig.ts UIID stub 注入 ───────────────────────────────────────────────

function injectUiConfigEntry(uiId, family, dryRun) {
    if (!fs.existsSync(UICONFIG_PATH)) {
        console.warn(`[scaffold-ui-component] UIConfig.ts 不存在，跳過 UIID 注入：${UICONFIG_PATH}`);
        return false;
    }
    const source = fs.readFileSync(UICONFIG_PATH, 'utf8');
    // 若已存在，跳過
    const uiIdPattern = new RegExp(`\\b${uiId}\\s*=`);
    if (uiIdPattern.test(source)) {
        console.log(`[scaffold-ui-component] UIConfig.ts 已存在 ${uiId}，跳過注入`);
        return true;
    }
    const layer = FAMILY_TO_LAYER[family] ?? 'PopUp';
    const layerComment = {
        'UI':     '// ── 主頁面層（LayerType.UI）',
        'PopUp':  '// ── 彈窗層（LayerType.PopUp）',
        'Dialog': '// ── 對話框層（LayerType.Dialog）',
    };
    const stub = `    /** ${uiId} — 由 scaffold-ui-component 自動生成（TODO: 補 prefab 路徑） */\n` +
                 `    ${uiId} = "${uiId}",`;
    // 找到 Toast 之前的最後一個 enum 成員後插入（簡單策略：在 Toast = 之前插入）
    const insertMarker = '    Toast = "Toast",';
    if (dryRun) {
        console.log(`\n=== [DRY-RUN] UIConfig.ts 注入 UIID.${uiId} ===`);
        console.log(stub);
        return true;
    }
    if (!source.includes(insertMarker)) {
        console.warn(`[scaffold-ui-component] 找不到 UIConfig.ts 注入錨點，請手動加入 UIID.${uiId}`);
        return false;
    }
    const updated = source.replace(insertMarker, `${stub}\n${insertMarker}`);
    fs.writeFileSync(UICONFIG_PATH, updated, 'utf8');
    console.log(`[scaffold-ui-component] UIConfig.ts 已注入 UIID.${uiId}`);

    // UIConfigEntry 注入（在 UIConfig Record 中）
    const configSource = fs.readFileSync(UICONFIG_PATH, 'utf8');
    const configAnchor = '    [UIID.Toast]:';
    const configEntry  = `    [UIID.${uiId}]: { layer: LayerType.${layer}, prefab: 'ui/${uiId}' }, // TODO: 補 prefab 路徑`;
    if (!configSource.includes(configAnchor)) {
        console.warn(`[scaffold-ui-component] 找不到 UIConfig Record 注入錨點，請手動加入 ${uiId} 設定`);
        return true;
    }
    const updatedConfig = configSource.replace(configAnchor, `${configEntry}\n    [UIID.Toast]:`);
    fs.writeFileSync(UICONFIG_PATH, updatedConfig, 'utf8');
    console.log(`[scaffold-ui-component] UIConfig Record 已注入 ${uiId} 設定`);
    return true;
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────

function main() {
    if (hasFlag('help') || process.argv.length <= 2) {
        printHelp();
        process.exit(0);
    }

    const screenId   = getArg('screen');
    const dryRun     = hasFlag('dry-run');
    const noUiConfig = hasFlag('no-uiconfig');
    const outDir     = getArg('out', DEFAULT_OUT_DIR);

    if (!screenId) {
        console.error('[scaffold-ui-component] 缺少必要參數 --screen');
        printHelp();
        process.exit(1);
    }

    // 1. 讀取 Screen Spec
    const screenSpec = findScreenSpec(screenId);
    if (!screenSpec && !dryRun) {
        console.warn(`[scaffold-ui-component] 找不到 screen spec：${screenId}，以 stub 模式繼續`);
    }

    // 2. 推斷 family
    let family = getArg('family');
    if (!family) {
        family = inferFamily(screenSpec) ?? 'detail-split';
        console.log(`[scaffold-ui-component] 自動推斷 family：${family}`);
    }
    if (!FAMILY_TO_LAYER[family]) {
        console.error(`[scaffold-ui-component] 不支援的 family：${family}`);
        console.error(`  支援清單：${Object.keys(FAMILY_TO_LAYER).join(', ')}`);
        process.exit(1);
    }

    // 3. 推斷 className 與 uiId
    const rawName  = getArg('name');
    const uiId     = rawName ? rawName.replace(/Panel$/, '') : toPascalCase(screenId).replace(/Screen$/, '');
    const className = uiId.endsWith('Panel') ? uiId : `${uiId}Panel`;

    console.log(`[scaffold-ui-component] screen="${screenId}" family="${family}" class="${className}" uiId="${uiId}"`);

    // 4. 生成 Panel TypeScript
    const panelTs = generatePanelTs({ screenId, className, family, uiId });
    if (!panelTs) {
        process.exit(1);
    }
    const outPath = path.join(path.isAbsolute(outDir) ? outDir : path.join(PROJECT_ROOT, outDir), `${className}.ts`);

    // 防禦：不覆寫已存在的 Panel（需 --force 才可覆蓋）
    if (!dryRun && fs.existsSync(outPath) && !hasFlag('force')) {
        console.error(`[scaffold-ui-component] 目標已存在，跳過（加 --force 覆蓋）：${path.relative(PROJECT_ROOT, outPath)}`);
        process.exit(1);
    }

    writeFile(outPath, panelTs, dryRun);

    // 5. 注入 UIConfig UIID stub
    if (!noUiConfig) {
        injectUiConfigEntry(uiId, family, dryRun);
    }

    // 6. 編碼檢查提示
    if (!dryRun) {
        console.log('\n[scaffold-ui-component] ✅ 完成。建議執行編碼檢查：');
        console.log(`  node tools_node/check-encoding-touched.js --files ${path.relative(PROJECT_ROOT, outPath)}`);
        if (!noUiConfig) {
            console.log(`  node tools_node/check-encoding-touched.js --files assets/scripts/core/config/UIConfig.ts`);
        }
        console.log('\n  以及 TypeScript 型別檢查：');
        console.log('  npx tsc --noEmit');
    } else {
        console.log('\n[scaffold-ui-component] DRY-RUN 完成，無檔案寫入。');
    }
}

main();
