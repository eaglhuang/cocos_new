#!/usr/bin/env node
/**
 * validate-layered-frame-assets.js
 *
 * 檢查 general-detail 目前宣告的分層框體 / 欄位底板 / 金屬頁籤資產是否已落地。
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const skinPath = path.join(projectRoot, 'assets/resources/ui-spec/skins/general-detail-default.json');

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const failures = [];

if (!fs.existsSync(skinPath)) {
    console.error('❌ 缺少 general-detail-default.json');
    process.exit(1);
}

const skin = readJson(skinPath);
const requiredSpriteSlots = [
    'detail.header.frame',
    'detail.header.fill',
    'detail.header.bleed',
    'detail.summary.frame',
    'detail.summary.fill',
    'detail.summary.bleed',
    'detail.summary.card',
    'detail.tabbar.rail.frame',
    'detail.tabbar.rail.fill',
    'detail.tabbar.rail.bleed',
    'detail.content.frame',
    'detail.content.fill',
    'detail.content.bleed',
    'detail.section.bg',
    'detail.footer.frame',
    'detail.footer.fill',
    'detail.footer.bleed',
    'detail.tree.node',
    'detail.field.bg',
    'detail.field.title.bg',
    'detail.field.name.bg',
    'detail.field.meta.bg',
];

for (const slotId of requiredSpriteSlots) {
    const slot = skin.slots?.[slotId];
    if (!slot || slot.kind !== 'sprite-frame') {
        failures.push(`slot 缺失或不是 sprite-frame：${slotId}`);
        continue;
    }

    const filePath = path.join(projectRoot, 'assets/resources', `${slot.path}.png`);
    if (!fs.existsSync(filePath)) {
        failures.push(`缺少資產：${slotId} -> ${path.relative(projectRoot, filePath)}`);
    }
}

const tabSkin = skin.slots?.['detail.tab.idle'];
if (!tabSkin || tabSkin.kind !== 'button-skin') {
    failures.push('slot 缺失或不是 button-skin：detail.tab.idle');
} else {
    for (const key of ['normal', 'pressed', 'disabled']) {
        const assetPath = tabSkin[key];
        if (!assetPath) {
            failures.push(`detail.tab.idle 缺少 ${key} 狀態圖`);
            continue;
        }
        const filePath = path.join(projectRoot, 'assets/resources', `${assetPath}.png`);
        if (!fs.existsSync(filePath)) {
            failures.push(`缺少頁籤狀態圖：${key} -> ${path.relative(projectRoot, filePath)}`);
        }
    }
}

if (failures.length > 0) {
    console.error('❌ Layered frame asset 驗證失敗\n');
    failures.forEach((item) => console.error(`- ${item}`));
    process.exit(1);
}

console.log('✅ Layered frame asset 驗證通過');
