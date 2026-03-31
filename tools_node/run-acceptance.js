#!/usr/bin/env node
/**
 * run-acceptance.js — 驗收檢查總入口
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const checks = [
    {
        label: 'Encoding Integrity 檢查',
        command: 'node',
        args: [path.join(__dirname, 'check-encoding-integrity.js')],
    },
    {
        label: 'TypeScript 語法掃描',
        command: 'node',
        args: [path.join(__dirname, 'check-ts-syntax.js')],
    },
    {
        label: 'UI Spec 契約驗證',
        command: 'node',
        args: [path.join(__dirname, 'validate-ui-specs.js')],
    },
    {
        label: 'GeneralDetail UI 契約驗證',
        command: 'node',
        args: [path.join(__dirname, 'validate-general-detail-ui.js')],
    },
    {
        label: 'Layered Frame Asset 驗證',
        command: 'node',
        args: [path.join(__dirname, 'validate-layered-frame-assets.js')],
    },
    {
        label: 'Representative SpriteFrame Asset 驗證',
        command: 'node',
        args: [path.join(__dirname, 'validate-representative-spriteframe-assets.js')],
    },
    {
        label: 'Shared Button Family Border 驗證',
        command: 'node',
        args: [path.join(__dirname, 'validate-button-family-borders.js')],
    },
];

const regressionCheckFile = path.join(projectRoot, 'tools', 'check-unity-compound-regression.mjs');
if (fs.existsSync(regressionCheckFile)) {
    checks.push({
        label: 'Unity 匯入回歸檢查',
        command: 'node',
        args: [regressionCheckFile],
    });
}

let failed = false;
console.log('🚦 開始執行驗收檢查\n');

for (const check of checks) {
    console.log(`▶ ${check.label}`);
    const result = spawnSync(check.command, check.args, {
        cwd: projectRoot,
        stdio: 'inherit',
        shell: false,
    });

    if ((result.status ?? 1) !== 0) {
        failed = true;
        console.error(`✖ ${check.label} 失敗\n`);
        break;
    }

    console.log(`✔ ${check.label} 通過\n`);
}

if (failed) {
    console.error('❌ 驗收檢查未通過');
    process.exit(1);
}

console.log('✅ 驗收檢查全部通過');
