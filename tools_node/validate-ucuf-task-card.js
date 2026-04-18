#!/usr/bin/env node
/**
 * validate-ucuf-task-card.js — UCUF 任務卡完整性驗證工具
 *
 * 用法：
 *   node tools_node/validate-ucuf-task-card.js --card docs/agent-briefs/UCUF-task-card-template.md
 *   node tools_node/validate-ucuf-task-card.js --card <path> --strict
 *   node tools_node/validate-ucuf-task-card.js --card <path> --json
 *
 * 驗證規則 R-TC-01 ~ R-TC-10（結構完整性，非語義正確性）：
 *   R-TC-01  screen_id 非空
 *   R-TC-02  parent_panel 為 'CompositePanel'
 *   R-TC-03  content_contract_schema 欄位存在（不驗證檔案是否存在）
 *   R-TC-04  fragments_owned 為陣列（可為空陣列）
 *   R-TC-05  data_sources_owned 為陣列且至少一個元素
 *   R-TC-06  skin_manifest 欄位存在
 *   R-TC-07  verification_commands 非空陣列
 *   R-TC-08  smoke_route 為非空字串
 *   R-TC-09  deliverables 陣列中每個元素符合檔案路徑格式（非空字串）
 *   R-TC-10  type 值在合法清單中
 *
 * --strict   有任何 failure 時 exit 1
 * --json     輸出 JSON 格式
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// 合法的任務卡 type 值（來自 UCUF-task-card-template.md § type 分類表）
const VALID_TYPES = new Set([
    'composite-panel',
    'fragment-develop',
    'child-panel-type',
    'skin-layer-work',
    'content-contract',
    'mapper-logic',
    'migration',
    'performance',
    'tooling',
    'architecture',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Arg parser
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
    const args = { card: '', strict: false, json: false };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--card' && argv[i + 1]) {
            args.card = argv[i + 1];
            i++;
        } else if (argv[i] === '--strict') {
            args.strict = true;
        } else if (argv[i] === '--json') {
            args.json = true;
        }
    }
    return args;
}

// ─────────────────────────────────────────────────────────────────────────────
// YAML frontmatter extractor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 從 Markdown 字串中擷取第一個 ```yaml ... ``` 程式碼區塊內的文字
 * 並解析為扁平鍵值對（不依賴 js-yaml，只處理純量與序列）。
 *
 * 原始任務卡使用程式碼圍欄包住 YAML frontmatter 範例，實際卡片可能使用
 * --- ... --- 格式。本函式兩種都嘗試。
 */
function extractYamlBlock(markdown) {
    // 嘗試 ```yaml ... ``` 圍欄
    const fenceMatch = markdown.match(/```yaml\s*\n([\s\S]*?)```/);
    if (fenceMatch) { return fenceMatch[1]; }

    // 嘗試 --- ... --- frontmatter
    const dashMatch = markdown.match(/^---\s*\n([\s\S]*?)\n---/m);
    if (dashMatch) { return dashMatch[1]; }

    return null;
}

/**
 * 超輕量 YAML 解析器：只支援
 *   - 純量：key: value
 *   - 多行序列：key:\n  - item1\n  - item2
 *   - 以 # 開頭的行為注釋（略過）
 *   - ## 開頭為節標題（略過）
 */
function parseSimpleYaml(text) {
    const result = {};
    const lines = text.split('\n');
    let currentKey = null;
    let currentArray = null;

    const stripInlineComment = (value) => value.replace(/\s*#.*$/, '').trim();

    for (let raw of lines) {
        // 去除行尾空白
        const line = raw.trimEnd();

        // 注釋 / 空行
        if (!line || line.trimStart().startsWith('#')) { continue; }

        // 陣列項：以 "  - " 開頭
        if (/^\s{2,}- /.test(line) && currentKey && currentArray) {
            const value = stripInlineComment(line.replace(/^\s+-\s+/, '').trim());
            currentArray.push(value);
            continue;
        }

        // 鍵值對或鍵（後面接陣列）：key: value 或 key:
        const kvMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)/);
        if (kvMatch) {
            currentKey   = kvMatch[1];
            const rawVal = stripInlineComment(kvMatch[2].trim());

            if (!rawVal || rawVal === '') {
                // 後面跟著陣列
                currentArray = [];
                result[currentKey] = currentArray;
            } else if (rawVal.startsWith('[')) {
                // inline array
                const items = rawVal.replace(/^\[|\]$/g, '').split(',').map(s => s.trim()).filter(Boolean);
                result[currentKey] = items;
                currentArray = null;
            } else {
                result[currentKey] = rawVal;
                currentArray = null;
            }
            continue;
        }

        // 首字縮排的陣列項（僅一空格縮排）
        if (/^\s+-\s/.test(line) && currentKey && currentArray) {
            const value = stripInlineComment(line.replace(/^\s+-\s+/, '').trim());
            currentArray.push(value);
        }
    }

    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation rules R-TC-01 ~ R-TC-10
// ─────────────────────────────────────────────────────────────────────────────

function validate(fields, cardPath) {
    const failures = [];
    const warnings = [];

    const fail = (rule, msg) => failures.push({ rule, severity: 'error', message: msg });
    const warn = (rule, msg) => warnings.push({ rule, severity: 'warning', message: msg });

    // R-TC-01: screen_id 非空
    if (!fields.screen_id || String(fields.screen_id).trim() === '') {
        fail('R-TC-01', 'R-TC-01 FAIL: screen_id 不可為空');
    }

    // R-TC-02: parent_panel == 'CompositePanel'
    if (fields.parent_panel !== 'CompositePanel') {
        fail('R-TC-02', `R-TC-02 FAIL: parent_panel 必須為 "CompositePanel"，目前為 "${fields.parent_panel ?? '(空)'}"`);
    }

    // R-TC-03: content_contract_schema 欄位存在
    if (!fields.content_contract_schema || String(fields.content_contract_schema).trim() === '') {
        fail('R-TC-03', 'R-TC-03 FAIL: content_contract_schema 欄位不可為空');
    }

    // R-TC-04: fragments_owned 為陣列（可為空）
    if (fields.fragments_owned !== undefined && !Array.isArray(fields.fragments_owned)) {
        warn('R-TC-04', 'R-TC-04 WARN: fragments_owned 應為陣列格式');
    }

    // R-TC-05: data_sources_owned 至少一個元素
    if (!Array.isArray(fields.data_sources_owned) || fields.data_sources_owned.length === 0) {
        fail('R-TC-05', 'R-TC-05 FAIL: data_sources_owned 必須為非空陣列');
    }

    // R-TC-06: skin_manifest 欄位存在
    if (!fields.skin_manifest || String(fields.skin_manifest).trim() === '') {
        fail('R-TC-06', 'R-TC-06 FAIL: skin_manifest 欄位不可為空');
    }

    // R-TC-07: verification_commands 非空陣列
    if (!Array.isArray(fields.verification_commands) || fields.verification_commands.length === 0) {
        fail('R-TC-07', 'R-TC-07 FAIL: verification_commands 必須為非空陣列');
    }

    // R-TC-08: smoke_route 非空字串
    if (!fields.smoke_route || String(fields.smoke_route).trim() === '') {
        fail('R-TC-08', 'R-TC-08 FAIL: smoke_route 不可為空');
    }

    // R-TC-09: deliverables 路徑格式（若存在，每個 entry 應為非空字串）
    if (fields.deliverables !== undefined) {
        const deliverables = Array.isArray(fields.deliverables) ? fields.deliverables : [];
        const bad = deliverables.filter(d => !d || typeof d !== 'string' || d.trim() === '');
        if (bad.length > 0) {
            warn('R-TC-09', `R-TC-09 WARN: deliverables 包含 ${bad.length} 個空/格式錯誤的項目`);
        }
    }

    // R-TC-10: type 值必須在合法清單中
    if (!fields.type || !VALID_TYPES.has(String(fields.type).trim())) {
        fail('R-TC-10', `R-TC-10 FAIL: type "${fields.type ?? '(空)'}" 不在合法清單中。合法值：${[...VALID_TYPES].join(', ')}`);
    }

    return { failures, warnings };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main() {
    const args = parseArgs(process.argv.slice(2));

    if (!args.card) {
        console.error('用法: node tools_node/validate-ucuf-task-card.js --card <path> [--strict] [--json]');
        process.exit(1);
    }

    const cardPath = path.resolve(process.cwd(), args.card);
    if (!fs.existsSync(cardPath)) {
        console.error(`[validate-ucuf-task-card] 找不到任務卡：${cardPath}`);
        process.exit(1);
    }

    const markdown = fs.readFileSync(cardPath, 'utf-8');
    const yamlBlock = extractYamlBlock(markdown);

    if (!yamlBlock) {
        const result = {
            passed: false,
            card: args.card,
            failures: [{
                rule: 'R-TC-00',
                severity: 'error',
                message: 'R-TC-00 FAIL: 找不到 YAML frontmatter（需要 ```yaml...``` 或 ---...--- 區塊）',
            }],
            warnings: [],
        };
        if (args.json) {
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.error(`[validate-ucuf-task-card] ${result.failures[0].message}`);
        }
        process.exit(args.strict ? 1 : 0);
    }

    const fields = parseSimpleYaml(yamlBlock);
    const { failures, warnings } = validate(fields, cardPath);
    const passed = failures.length === 0;

    if (args.json) {
        console.log(JSON.stringify({ passed, card: args.card, failures, warnings }, null, 2));
    } else {
        console.log(`[validate-ucuf-task-card] 驗證：${args.card}`);
        if (passed && warnings.length === 0) {
            console.log('[validate-ucuf-task-card] OK — 所有規則通過');
        }
        for (const f of failures) {
            console.error(`  [ERROR] ${f.message}`);
        }
        for (const w of warnings) {
            console.warn(`  [WARN]  ${w.message}`);
        }
        console.log(`[validate-ucuf-task-card] 結果：${failures.length} 個錯誤，${warnings.length} 個警告`);
    }

    if (args.strict && !passed) {
        process.exit(1);
    }
}

main();
