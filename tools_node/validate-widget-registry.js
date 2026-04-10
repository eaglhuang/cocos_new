#!/usr/bin/env node
/**
 * validate-widget-registry.js
 * 驗證 widget-registry.json ↔ fragments/widgets/ 實際檔案同步。
 * - 每個 registry entry 必須有對應 .json
 * - 每個 .json 必須在 registry 中登記
 * - registry 的 name / type 必須與 .json 一致
 */
'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./lib/project-config');

const projectRoot = config.ROOT;
const widgetsDir = config.paths.widgetFragmentsDir;
const registryPath = config.paths.widgetRegistryJson;

function main() {
    const errors = [];
    const warnings = [];

    // 1. 載入 registry
    if (!fs.existsSync(registryPath)) {
        console.error('❌ widget-registry.json 不存在');
        process.exit(1);
    }
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const registeredIds = new Set(registry.widgets.map(w => w.id));

    // 2. 掃描實際 widget 檔案
    const actualFiles = fs.readdirSync(widgetsDir)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
    const actualSet = new Set(actualFiles);

    // 3. 檢查 registry 中的 entry 是否都有對應檔案
    for (const widget of registry.widgets) {
        if (!actualSet.has(widget.id)) {
            errors.push(`registry 有 "${widget.id}" 但 widgets/ 目錄找不到 ${widget.id}.json`);
            continue;
        }

        // 驗證 name / type 一致性
        const filePath = path.join(widgetsDir, `${widget.id}.json`);
        try {
            const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (content.name && content.name !== widget.name) {
                errors.push(`"${widget.id}": registry.name="${widget.name}" ≠ file.name="${content.name}"`);
            }
            if (content.type && content.type !== widget.type) {
                errors.push(`"${widget.id}": registry.type="${widget.type}" ≠ file.type="${content.type}"`);
            }
        } catch (e) {
            errors.push(`"${widget.id}": 無法解析 JSON — ${e.message}`);
        }
    }

    // 4. 檢查 widgets/ 目錄中是否有未登記的檔案
    for (const fileId of actualFiles) {
        if (!registeredIds.has(fileId)) {
            errors.push(`widgets/${fileId}.json 存在但未在 widget-registry.json 登記`);
        }
    }

    // 5. 檢查 registry 內 id 重複
    const idCounts = {};
    for (const w of registry.widgets) {
        idCounts[w.id] = (idCounts[w.id] || 0) + 1;
    }
    for (const [id, count] of Object.entries(idCounts)) {
        if (count > 1) {
            errors.push(`registry 中 "${id}" 重複登記 ${count} 次`);
        }
    }

    // 6. 檢查必要欄位
    for (const w of registry.widgets) {
        if (!w.id) errors.push('registry entry 缺少 id');
        if (!w.name) errors.push(`"${w.id}": 缺少 name`);
        if (!w.category) warnings.push(`"${w.id}": 缺少 category（建議補上）`);
        if (!w.description) warnings.push(`"${w.id}": 缺少 description（建議補上）`);
    }

    // 輸出結果
    if (warnings.length > 0) {
        console.log(`⚠️  ${warnings.length} 個警告:`);
        warnings.forEach(w => console.log(`  - ${w}`));
    }

    if (errors.length > 0) {
        console.error(`❌ ${errors.length} 個錯誤:`);
        errors.forEach(e => console.error(`  - ${e}`));
        process.exit(1);
    }

    console.log(`✅ Widget Registry 驗證通過（${registry.widgets.length} widgets ↔ ${actualFiles.length} files）`);
}

main();
