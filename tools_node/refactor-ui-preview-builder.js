/**
 * 重構 UIPreviewBuilder.ts - 第一階段
 * 用 UIPreviewDiagnostics 替換所有 console 調用
 *
 * 使用 regex 匹配，避免中文字符 encoding 問題。
 * 請從專案根目錄執行：node tools_node/refactor-ui-preview-builder.js
 */

const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../assets/scripts/ui/core/UIPreviewBuilder.ts');

if (!fs.existsSync(file)) {
    console.error('✗ 找不到目標檔案：', file);
    process.exit(1);
}

let content = fs.readFileSync(file, 'utf8');
let replacements = 0;

/**
 * 用 regex 搜尋第一個匹配並替換，記錄結果。
 * @param {RegExp} pattern - 必須附帶 s flag（dotAll）才能跨行匹配
 * @param {string} replacement - 替換字串
 * @param {string} label - 日誌說明
 */
function replaceFirst(pattern, replacement, label) {
    const match = content.match(pattern);
    if (match) {
        content = content.replace(pattern, replacement);
        replacements++;
        console.log(`✓ [${label}] 已替換`);
        return true;
    }
    console.log(`- [${label}] 未找到（可能已替換或不存在）`);
    return false;
}

// ── 1. buildScreen 成功日誌 ──────────────────────────────────────
// 原始: console.log(`[UIPreviewBuilder] buildScreen 完成 (layout: ${layout.id ?? '?'}) root.children=${rootNode.children.length}`);
replaceFirst(
    /console\.log\(`\[UIPreviewBuilder\] buildScreen [^`]*\$\{rootNode\.children\.length\}`\);/,
    "UIPreviewDiagnostics.buildScreenSuccess(layout.id ?? '?', rootNode.children.length);",
    'buildScreen success log'
);

// ── 2. buildScreen 錯誤日誌 ──────────────────────────────────────
// 原始: console.error(`[UIPreviewBuilder] buildScreen ... (layout: ${layout.id ?? '?'})`, e);
replaceFirst(
    /console\.error\(`\[UIPreviewBuilder\] buildScreen [^`]*\$\{layout\.id[^}]*\}`\),\s*e\);/,
    "UIPreviewDiagnostics.buildScreenError(layout.id ?? '?', e as Error);",
    'buildScreen error log'
);

// ── 3. 字型載入警告 ───────────────────────────────────────────────
// 原始: console.warn(`[UIPreviewBuilder] 字型加載失敗: ${path}`);
replaceFirst(
    /console\.warn\(`\[UIPreviewBuilder\] [^`]*\$\{path\}`\);/,
    'UIPreviewDiagnostics.fontLoadWarning(path);',
    'font load warning'
);

// ── 4. label fallback 警告 ────────────────────────────────────────
// 原始: console.warn('[UIPreviewBuilder] label "' + spec.name + '" has no textKey/text/bind ...');
replaceFirst(
    /console\.warn\('[^']*label "' \+ spec\.name \+[^;]+\);/,
    'UIPreviewDiagnostics.labelFallbackWarning(spec.name);',
    'label fallback warning'
);

// ── 5. label skin 應用錯誤 ────────────────────────────────────────
// 原始: console.error(`[UIPreviewBuilder] _buildLabel ... skinSlot="..."`, e);
replaceFirst(
    /console\.error\(`\[UIPreviewBuilder\] _buildLabel[^`]*skinSlot[^`]*`[^;]*,\s*e\);/s,
    'UIPreviewDiagnostics.labelSkinApplyError(spec.name, spec.skinSlot, e as Error);',
    'label skin apply error'
);

// ── 6. noise blend 模式警告 ───────────────────────────────────────
// 原始: console.warn(`[UIPreviewBuilder] noise blend "..." ... ${noiseSlotId}`);
replaceFirst(
    /console\.warn\(`\[UIPreviewBuilder\] noise blend[^`]+\$\{noiseSlotId\}`\);/,
    'UIPreviewDiagnostics.noiseBlendModeWarning(requestedBlend, noiseSlotId);',
    'noise blend mode warning'
);

// ── 7. populateList 節點未找到 ────────────────────────────────────
// 原始: console.error(`[UIPreviewBuilder] populateList ... listNode: "${listPath}"...`, ...);
replaceFirst(
    /console\.error\(`\[UIPreviewBuilder\] populateList [^`]*listNode[^`]*\$\{listPath\}[^`]*`[^;]*,[^;]+\);/s,
    'UIPreviewDiagnostics.populateListNodeNotFound(listPath, this.node.children.map(c => c.name));',
    'populateList node not found'
);

// ── 8. populateList 模板未定義 ────────────────────────────────────
// 原始: console.error(`[UIPreviewBuilder] populateList listNode "..." _itemTemplate ...`, ...);
replaceFirst(
    /console\.error\(`\[UIPreviewBuilder\] populateList listNode[^`]*_itemTemplate[^`]*`[^;]*,[^;]+\);/s,
    'UIPreviewDiagnostics.populateListTemplateNotFound(listPath, listNode.children.map(c => c.name));',
    'populateList template not found'
);

// ── 9. populateList Content 未找到 ────────────────────────────────
// 原始: console.error(`[UIPreviewBuilder] populateList listNode "..." Content ...`, ...);
replaceFirst(
    /console\.error\(`\[UIPreviewBuilder\] populateList listNode[^`]*Content[^`]*`[^;]*,[^;]+\);/s,
    'UIPreviewDiagnostics.populateListContentNotFound(listPath, listNode.children.map(c => c.name));',
    'populateList content not found'
);

// ── 10. populateList 開始 ─────────────────────────────────────────
// 原始: console.log(`[UIPreviewBuilder] populateList ... ${data.length}`);
replaceFirst(
    /console\.log\(`\[UIPreviewBuilder\] populateList[^`]+\$\{data\.length\}`\);/,
    'UIPreviewDiagnostics.populateListStart(listPath, data.length);',
    'populateList start'
);

// ── 11. populateList 列錯誤 ───────────────────────────────────────
// 原始: console.error(`[UIPreviewBuilder] populateList 第${i} 列...`, e);
replaceFirst(
    /console\.error\(`\[UIPreviewBuilder\] populateList[^`]*\$\{i\}[^`]*`[^;]*,\s*e\);/,
    'UIPreviewDiagnostics.populateListRowError(i, e as Error);',
    'populateList row error'
);

// ── 12. populateList 完成 ─────────────────────────────────────────
// 原始: console.log('[UIPreviewBuilder] populateList done, rows=' + content.children.length);
replaceFirst(
    /console\.log\('[UIPreviewBuilder\] populateList done[^']*'\s*\+[^;]+\);/,
    'UIPreviewDiagnostics.populateListComplete(content.children.length);',
    'populateList complete'
);

// ── 確保 UIPreviewDiagnostics import 存在 ────────────────────────
const diagImport = "import { UIPreviewDiagnostics } from './UIPreviewDiagnostics';";
if (!content.includes(diagImport)) {
    // 插入到最後一個 import 行之後
    content = content.replace(
        /((?:^import [^\n]+\n)+)/m,
        (block) => block.trimEnd() + '\n' + diagImport + '\n'
    );
    console.log('✓ 已補充 UIPreviewDiagnostics import');
} else {
    console.log('- UIPreviewDiagnostics import 已存在，跳過');
}

// ── 寫回檔案 ──────────────────────────────────────────────────────
fs.writeFileSync(file, content, 'utf8');

console.log(`\n✓ 完成，共替換 ${replacements} 處 console 呼叫`);
if (replacements === 0) {
    console.log('ℹ  檔案可能已完成重構，無需再次執行。');
}
