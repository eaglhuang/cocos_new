#!/usr/bin/env node
/**
 * validate-ui-specs.js — UI 三層 JSON 契約驗證
 *
 * 驗證範圍：
 *   - JSON 可正常解析
 *   - layout / skin / screen 的必要欄位存在
 *   - screen 引用的 layout / skin id 可對應到實際檔案
 *   - layout canvas 使用 1920x1080 設計基準
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const uiSpecRoot = path.join(projectRoot, 'assets', 'resources', 'ui-spec');
const layoutDir = path.join(uiSpecRoot, 'layouts');
const skinDir = path.join(uiSpecRoot, 'skins');
const screenDir = path.join(uiSpecRoot, 'screens');

function listJsonFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter((file) => file.endsWith('.json'))
        .map((file) => path.join(dir, file));
}

function readJson(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
}

function fail(message, failures) {
    failures.push(message);
}

function assertString(value, label, filePath, failures) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        fail(`${path.relative(projectRoot, filePath)} - ${label} 必須是非空字串`, failures);
        return false;
    }
    return true;
}

function validateScreenNode(screenNode, filePath, layouts, skins, failures, labelPrefix) {
    const prefix = labelPrefix || 'screen';
    const hasLayout = typeof screenNode.layout === 'string' && screenNode.layout.trim().length > 0;
    const hasSkin = typeof screenNode.skin === 'string' && screenNode.skin.trim().length > 0;

    if (!hasLayout) {
        fail(`${path.relative(projectRoot, filePath)} - ${prefix}.layout 必須是非空字串`, failures);
    } else if (!layouts.has(screenNode.layout)) {
        fail(`${path.relative(projectRoot, filePath)} - ${prefix}.layout 找不到對應 layout id：${screenNode.layout}`, failures);
    }

    if (!hasSkin) {
        fail(`${path.relative(projectRoot, filePath)} - ${prefix}.skin 必須是非空字串`, failures);
    } else if (!skins.has(screenNode.skin)) {
        fail(`${path.relative(projectRoot, filePath)} - ${prefix}.skin 找不到對應 skin id：${screenNode.skin}`, failures);
    }
}

const failures = [];
const layouts = new Map();
const skins = new Map();
const screens = [];

for (const filePath of listJsonFiles(layoutDir)) {
    try {
        const json = readJson(filePath);
        const okId = assertString(json.id, 'layout.id', filePath, failures);
        const hasRoot = json.root && typeof json.root === 'object';
        const hasNodes = Array.isArray(json.nodes);
        if (!hasRoot && !hasNodes) {
            fail(`${path.relative(projectRoot, filePath)} - layout 必須至少提供 root 或 nodes`, failures);
        }
        if (!json.canvas || typeof json.canvas !== 'object') {
            fail(`${path.relative(projectRoot, filePath)} - layout.canvas 缺失`, failures);
        } else {
            if (json.canvas.designWidth !== 1920 || json.canvas.designHeight !== 1080) {
                fail(`${path.relative(projectRoot, filePath)} - layout.canvas 必須使用 1920x1080 設計基準`, failures);
            }
        }
        if (okId) {
            if (layouts.has(json.id)) {
                fail(`${path.relative(projectRoot, filePath)} - layout.id 重複：${json.id}`, failures);
            } else {
                layouts.set(json.id, filePath);
            }
        }
    } catch (error) {
        fail(`${path.relative(projectRoot, filePath)} - JSON 解析失敗：${error.message}`, failures);
    }
}

for (const filePath of listJsonFiles(skinDir)) {
    try {
        const json = readJson(filePath);
        const okId = assertString(json.id, 'skin.id', filePath, failures);
        if (!json.slots || typeof json.slots !== 'object' || Array.isArray(json.slots)) {
            fail(`${path.relative(projectRoot, filePath)} - skin.slots 缺失或格式錯誤`, failures);
        }
        if (okId) {
            if (skins.has(json.id)) {
                fail(`${path.relative(projectRoot, filePath)} - skin.id 重複：${json.id}`, failures);
            } else {
                skins.set(json.id, filePath);
            }
        }
    } catch (error) {
        fail(`${path.relative(projectRoot, filePath)} - JSON 解析失敗：${error.message}`, failures);
    }
}

for (const filePath of listJsonFiles(screenDir)) {
    try {
        const json = readJson(filePath);
        const okId = assertString(json.id, 'screen.id', filePath, failures);

        if (Array.isArray(json.screens)) {
            json.screens.forEach((screenNode, index) => {
                validateScreenNode(screenNode, filePath, layouts, skins, failures, `screens[${index}]`);
            });
        } else if (Array.isArray(json.panels)) {
            for (const panel of json.panels) {
                if (typeof panel.screen !== 'string' || panel.screen.trim().length === 0) {
                    fail(`${path.relative(projectRoot, filePath)} - panels.screen 必須是非空字串`, failures);
                }
            }
        } else {
            validateScreenNode(json, filePath, layouts, skins, failures, 'screen');
        }

        if (okId) {
            screens.push(json.id);
        }
    } catch (error) {
        fail(`${path.relative(projectRoot, filePath)} - JSON 解析失敗：${error.message}`, failures);
    }
}

if (failures.length > 0) {
    console.error('❌ UI Spec 驗證失敗\n');
    for (const failure of failures) {
        console.error(`- ${failure}`);
    }
    console.error(`\n共 ${failures.length} 筆問題。`);
    process.exit(1);
}

console.log(`✅ UI Spec 驗證通過（layouts=${layouts.size}, skins=${skins.size}, screens=${screens.length}）`);
