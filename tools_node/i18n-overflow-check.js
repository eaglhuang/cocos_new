#!/usr/bin/env node
/**
 * i18n-overflow-check.js — 多語文字溢出風險預測
 *
 * 掃描 i18n JSON 的所有 key，以字元數估算寬度風險，
 * 標出可能溢出的翻譯條目（特別是 en / ja 相對於 zh-TW 的膨脹）。
 *
 * Usage:
 *   node tools_node/i18n-overflow-check.js                        # 掃全部
 *   node tools_node/i18n-overflow-check.js --locale en            # 只查 en
 *   node tools_node/i18n-overflow-check.js --threshold 1.5        # 膨脹率閾值
 *   node tools_node/i18n-overflow-check.js --key headerTitle      # 只查指定 key
 */
'use strict';

const fs = require('fs');
const path = require('path');

const config = require('./lib/project-config');

// ─── helpers ──────────────────────────────────────────────

/**
 * 估算字串「視覺寬度」：
 * - CJK 字元算 2 單位
 * - ASCII 字元算 1 單位
 * - 其他寬字元算 2 單位
 */
function estimateWidth(str) {
    if (!str) return 0;
    let width = 0;
    for (const ch of str) {
        const code = ch.codePointAt(0);
        if (
            (code >= 0x4E00 && code <= 0x9FFF) ||   // CJK Unified
            (code >= 0x3400 && code <= 0x4DBF) ||   // CJK Ext A
            (code >= 0x3000 && code <= 0x303F) ||   // CJK Symbols
            (code >= 0xFF00 && code <= 0xFFEF) ||   // Fullwidth
            (code >= 0xAC00 && code <= 0xD7AF)      // Hangul
        ) {
            width += 2;
        } else {
            width += 1;
        }
    }
    return width;
}

/** 遞迴攤平 nested JSON 為 flat key-value */
function flattenJson(obj, prefix = '') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            Object.assign(result, flattenJson(value, fullKey));
        } else if (typeof value === 'string') {
            result[fullKey] = value;
        }
    }
    return result;
}

/** 載入一個 locale 的所有 JSON 檔案並合併 */
function loadLocale(locale) {
    const localeDir = path.join(config.paths.i18nDir, locale);
    if (!fs.existsSync(localeDir)) return null;

    const merged = {};
    const files = fs.readdirSync(localeDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
        try {
            const content = JSON.parse(fs.readFileSync(path.join(localeDir, file), 'utf-8'));
            Object.assign(merged, flattenJson(content));
        } catch {
            // Skip unparseable files
        }
    }

    return Object.keys(merged).length > 0 ? merged : null;
}

// ─── main ─────────────────────────────────────────────────
const args = process.argv.slice(2);

const localeIdx = args.indexOf('--locale');
const targetLocale = localeIdx >= 0 ? args[localeIdx + 1] : null;

const thresholdIdx = args.indexOf('--threshold');
const threshold = thresholdIdx >= 0 ? parseFloat(args[thresholdIdx + 1]) : 1.3;

const keyIdx = args.indexOf('--key');
const targetKey = keyIdx >= 0 ? args[keyIdx + 1] : null;

// 先載入 zh-TW 作為基準
const baseLocale = 'zh-TW';
const base = loadLocale(baseLocale);

if (!base) {
    console.error(`❌ Base locale "${baseLocale}" not found or empty at ${config.paths.i18nDir}`);
    process.exit(1);
}

const localesToCheck = targetLocale
    ? [targetLocale]
    : config.locales.filter(l => l !== baseLocale);

const risks = [];

for (const locale of localesToCheck) {
    const localeData = loadLocale(locale);
    if (!localeData) {
        console.warn(`⚠️  Locale "${locale}" not found, skipping`);
        continue;
    }

    for (const [key, baseValue] of Object.entries(base)) {
        if (targetKey && !key.includes(targetKey)) continue;

        const baseWidth = estimateWidth(baseValue);
        if (baseWidth === 0) continue;

        const transValue = localeData[key];

        if (transValue === undefined) {
            risks.push({
                locale,
                key,
                type: 'missing',
                baseWidth,
                transWidth: 0,
                ratio: 0,
                baseValue: baseValue.slice(0, 30),
                transValue: '',
            });
            continue;
        }

        const transWidth = estimateWidth(transValue);
        const ratio = transWidth / baseWidth;

        if (ratio >= threshold) {
            risks.push({
                locale,
                key,
                type: 'overflow-risk',
                baseWidth,
                transWidth,
                ratio: Math.round(ratio * 100) / 100,
                baseValue: baseValue.slice(0, 30),
                transValue: transValue.slice(0, 40),
            });
        }
    }
}

// ─── output ───────────────────────────────────────────────
if (risks.length === 0) {
    console.log(`✅ No overflow risks detected (threshold: ${threshold}x)`);
    console.log(`   Base: ${baseLocale} (${Object.keys(base).length} keys)`);
    console.log(`   Checked: ${localesToCheck.join(', ')}`);
    process.exit(0);
}

// Sort by ratio descending
risks.sort((a, b) => b.ratio - a.ratio);

const missingCount = risks.filter(r => r.type === 'missing').length;
const overflowCount = risks.filter(r => r.type === 'overflow-risk').length;

console.log(`⚠️  i18n Overflow Risk Report (threshold: ${threshold}x)\n`);

if (overflowCount > 0) {
    console.log(`🔴 Overflow risks (${overflowCount}):\n`);
    console.log(`${'Locale'.padEnd(8)} ${'Key'.padEnd(40)} ${'Base W'.padEnd(8)} ${'Trans W'.padEnd(8)} ${'Ratio'.padEnd(8)} Translation`);
    console.log('─'.repeat(110));

    for (const r of risks.filter(r => r.type === 'overflow-risk')) {
        console.log(
            `${r.locale.padEnd(8)} ${r.key.padEnd(40)} ${String(r.baseWidth).padEnd(8)} ${String(r.transWidth).padEnd(8)} ${(r.ratio + 'x').padEnd(8)} ${r.transValue}`,
        );
    }
    console.log();
}

if (missingCount > 0) {
    console.log(`🟡 Missing translations (${missingCount}):\n`);
    for (const r of risks.filter(r => r.type === 'missing')) {
        console.log(`  [${r.locale}] ${r.key} — base: "${r.baseValue}"`);
    }
    console.log();
}

console.log(`Summary: ${overflowCount} overflow risk(s), ${missingCount} missing translation(s)`);
process.exit(overflowCount > 0 ? 1 : 0);
