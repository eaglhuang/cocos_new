#!/usr/bin/env node
// validate-i18n-coverage.js
// M7：i18n key coverage 驗證工具
//
// 用法：
//   node tools_node/validate-i18n-coverage.js [--locale zh-TW] [--dir assets/scripts] [--strict]
//
// 功能：
//   1. 掃描 .ts 檔案中的 this.t('...') 呼叫，收集所有 key
//   2. 讀取 locale JSON（預設 zh-TW）
//   3. 輸出 missing / extra key 統計
//   4. --strict：有 missing key 時 exit(1)

'use strict';

const fs = require('fs');
const path = require('path');

// ─────────────────────────── CLI 解析 ───────────────────────
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

let locale  = 'zh-TW';
let scanDir = path.join(ROOT, 'assets', 'scripts');
let strict  = false;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--locale' && args[i + 1]) { locale  = args[++i]; }
    if (args[i] === '--dir'    && args[i + 1]) { scanDir = path.resolve(ROOT, args[++i]); }
    if (args[i] === '--strict')                { strict  = true; }
    if (args[i] === '--help') {
        console.log([
            'Usage: node tools_node/validate-i18n-coverage.js [options]',
            '  --locale <code>  Locale JSON to compare against (default: zh-TW)',
            '  --dir    <path>  Directory to scan for .ts files (default: assets/scripts)',
            '  --strict         Exit 1 if any missing keys',
        ].join('\n'));
        process.exit(0);
    }
}

// ─────────────────────────── 掃描 .ts 中的 t() key ───────────────
const T_CALL_RE = /\bthis\.t\(['"]([^'"]+)['"]/g;

/** Strip single-line and block comments from TypeScript source */
function stripComments(src) {
    // Remove block comments /* ... */
    src = src.replace(/\/\*[\s\S]*?\*\//g, '');
    // Remove line comments // ...
    src = src.replace(/\/\/[^\n]*/g, '');
    return src;
}

function collectKeysFromDir(dir) {
    const keys = new Set();
    if (!fs.existsSync(dir)) return keys;

    const scan = (d) => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) {
                scan(full);
            } else if (entry.isFile() && entry.name.endsWith('.ts')) {
                const raw = fs.readFileSync(full, 'utf8');
                const src = stripComments(raw);
                let m;
                T_CALL_RE.lastIndex = 0;
                while ((m = T_CALL_RE.exec(src)) !== null) {
                    keys.add(m[1]);
                }
            }
        }
    };
    scan(dir);
    return keys;
}

// ─────────────────────────── 讀取 locale JSON ───────────────────
function loadLocale(localeName) {
    const p = path.join(ROOT, 'assets', 'resources', 'i18n', `${localeName}.json`);
    if (!fs.existsSync(p)) {
        console.error(`[validate-i18n] ERROR: locale file not found → ${p}`);
        process.exit(1);
    }
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    return new Set(Object.keys(raw).filter(k => !k.startsWith('_comment')));
}

// ─────────────────────────── Main ───────────────────────────────
console.log(`[validate-i18n] Scanning: ${path.relative(ROOT, scanDir)}`);
console.log(`[validate-i18n] Locale:   ${locale}`);
console.log();

const usedKeys   = collectKeysFromDir(scanDir);
const localeKeys = loadLocale(locale);

const missing = [...usedKeys].filter(k => !localeKeys.has(k)).sort();
const extra   = [...localeKeys].filter(k => !usedKeys.has(k) && k.startsWith('ui.')).sort();

let errors = 0;

if (missing.length > 0) {
    errors += missing.length;
    console.error(`[validate-i18n] MISSING (${missing.length}) — keys used in code but absent from ${locale}.json:`);
    for (const k of missing) console.error(`  ✗  ${k}`);
    console.error();
} else {
    console.log(`[validate-i18n] MISSING: 0 — all keys present in ${locale}.json ✓`);
}

if (extra.length > 0) {
    console.warn(`[validate-i18n] EXTRA (${extra.length}) — keys in ${locale}.json that are not used in any .ts file:`);
    for (const k of extra) console.warn(`  ⓘ  ${k}`);
    console.warn();
} else {
    console.log(`[validate-i18n] EXTRA:   0`);
}

console.log();
console.log(`[validate-i18n] Summary: used=${usedKeys.size}  locale=${localeKeys.size}  missing=${missing.length}  extra=${extra.length}`);

if (strict && errors > 0) {
    console.error('[validate-i18n] --strict: exiting with code 1 due to missing keys');
    process.exit(1);
}
