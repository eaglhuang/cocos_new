#!/usr/bin/env node
/**
 * validate-button-family-borders.js
 *
 * 驗證 shared button family（nav_ink / paper_utility / warning）一旦被 skin 引用時：
 *   1. 必須使用 button-skin
 *   2. border 必須為 [20,20,20,20]
 *   3. normal / pressed / disabled 三態資產必須存在
 *   4. layout 中引用該 slot 的 button 高度必須大於 40，避免九宮格角區重疊
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const uiSpecRoot = path.join(projectRoot, 'assets', 'resources', 'ui-spec');
const layoutDir = path.join(uiSpecRoot, 'layouts');
const skinDir = path.join(uiSpecRoot, 'skins');
const screenDir = path.join(uiSpecRoot, 'screens');
const trackedFamilies = [
    'sprites/ui_families/common/nav_ink/',
    'sprites/ui_families/common/paper_utility/',
    'sprites/ui_families/common/warning/',
];
const expectedBorder = [20, 20, 20, 20];

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listJsonFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter((file) => file.endsWith('.json'))
        .map((file) => path.join(dir, file));
}

function isTrackedFamily(slot) {
    if (!slot || slot.kind !== 'button-skin') return false;
    return ['normal', 'pressed', 'disabled'].some((state) => {
        const assetPath = slot[state];
        return typeof assetPath === 'string' && trackedFamilies.some((prefix) => assetPath.startsWith(prefix));
    });
}

function borderEquals(border) {
    return Array.isArray(border)
        && border.length === 4
        && border.every((value, index) => value === expectedBorder[index]);
}

function collectButtonNodes(node, currentPath = '') {
    if (!node || typeof node !== 'object') return [];

    const nodePath = currentPath ? `${currentPath}/${node.name || node.type || 'Node'}` : (node.name || node.type || 'Root');
    const results = [];

    if (node.type === 'button' && typeof node.skinSlot === 'string') {
        results.push({
            path: nodePath,
            skinSlot: node.skinSlot,
            height: node.height,
        });
    }

    for (const child of node.children || []) {
        results.push(...collectButtonNodes(child, nodePath));
    }

    return results;
}

const layouts = new Map();
const skins = new Map();
const failures = [];
let validatedSlots = 0;

for (const filePath of listJsonFiles(layoutDir)) {
    const json = readJson(filePath);
    if (json.id) {
        layouts.set(json.id, {
            filePath,
            buttons: collectButtonNodes(json.root),
        });
    }
}

for (const filePath of listJsonFiles(skinDir)) {
    const json = readJson(filePath);
    if (json.id) {
        skins.set(json.id, {
            filePath,
            slots: json.slots || {},
        });
    }
}

for (const filePath of listJsonFiles(screenDir)) {
    const screen = readJson(filePath);
    const screenNodes = Array.isArray(screen.screens) ? screen.screens : [screen];

    for (const screenNode of screenNodes) {
        if (!screenNode || typeof screenNode !== 'object') continue;
        if (typeof screenNode.layout !== 'string' || typeof screenNode.skin !== 'string') continue;

        const layout = layouts.get(screenNode.layout);
        const skin = skins.get(screenNode.skin);
        if (!layout || !skin) continue;

        for (const buttonNode of layout.buttons) {
            const slot = skin.slots?.[buttonNode.skinSlot];
            if (!isTrackedFamily(slot)) continue;

            validatedSlots += 1;
            if (!borderEquals(slot.border)) {
                failures.push(`${path.relative(projectRoot, skin.filePath)} - ${buttonNode.skinSlot} 的 border 必須為 [20,20,20,20]`);
            }

            for (const state of ['normal', 'pressed', 'disabled']) {
                const assetPath = slot[state];
                if (typeof assetPath !== 'string' || assetPath.length === 0) {
                    failures.push(`${path.relative(projectRoot, skin.filePath)} - ${buttonNode.skinSlot} 缺少 ${state} 狀態圖`);
                    continue;
                }

                const pngPath = path.join(projectRoot, 'assets', 'resources', `${assetPath}.png`);
                if (!fs.existsSync(pngPath)) {
                    failures.push(`${path.relative(projectRoot, skin.filePath)} - ${buttonNode.skinSlot}.${state} 找不到資產：${path.relative(projectRoot, pngPath)}`);
                }
            }

            if (typeof buttonNode.height === 'number' && buttonNode.height <= 40) {
                failures.push(`${path.relative(projectRoot, layout.filePath)} - ${buttonNode.path} 高度 ${buttonNode.height} 過小，無法容納 [20,20,20,20] 九宮格`);
            }
        }
    }
}

if (failures.length > 0) {
    console.error('❌ Shared button family border 驗證失敗\n');
    failures.forEach((item) => console.error(`- ${item}`));
    process.exit(1);
}

console.log(`✅ Shared button family border 驗證通過（validatedSlots=${validatedSlots}）`);