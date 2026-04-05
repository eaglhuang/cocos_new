#!/usr/bin/env node
/**
 * validate-ui-specs.js
 *
 * 驗證 UI spec 三層 JSON：
 * - layouts
 * - skins
 * - screens
 *
 * 可選參數：
 * - --check-content-contract
 *   額外驗證 screen.contentRequirements 對應的 contract schema，
 *   並檢查 screen.content.source/state 是否能找到對應內容資料。
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const uiSpecRoot = path.join(projectRoot, 'assets', 'resources', 'ui-spec');
const layoutDir = path.join(uiSpecRoot, 'layouts');
const skinDir = path.join(uiSpecRoot, 'skins');
const screenDir = path.join(uiSpecRoot, 'screens');
const contractDir = path.join(uiSpecRoot, 'contracts');
const contentDir = path.join(uiSpecRoot, 'content');

const checkContentContract = process.argv.includes('--check-content-contract');
const strictMode = process.argv.includes('--strict');
const skipRules = new Set();
for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === '--skip-rule' && process.argv[i + 1]) {
        skipRules.add(process.argv[++i]);
    }
}

function listJsonFiles(dir) {
    if (!fs.existsSync(dir)) {
        return [];
    }
    return fs.readdirSync(dir)
        .filter((file) => file.endsWith('.json'))
        .map((file) => path.join(dir, file));
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function relative(filePath) {
    return path.relative(projectRoot, filePath);
}

function fail(message, failures) {
    failures.push(message);
}

function warn(message, warnings) {
    warnings.push(message);
}

// ── Strict 模式輔助函式 ──────────────────────────────────────────────────────

function strictFail(ruleId, message, failures, exceptions) {
    if (skipRules.has(ruleId)) return;
    if (exceptions && Object.prototype.hasOwnProperty.call(exceptions, ruleId)) return;
    failures.push(`[${ruleId}] ${message}`);
}

function strictWarn(ruleId, message, warnings, exceptions) {
    if (skipRules.has(ruleId)) return;
    if (exceptions && Object.prototype.hasOwnProperty.call(exceptions, ruleId)) return;
    warnings.push(`[${ruleId}] ${message}`);
}

function walkLayoutNodes(node, callback, depth) {
    if (!node || typeof node !== 'object') return;
    callback(node, depth);
    if (Array.isArray(node.children)) {
        for (const child of node.children) {
            walkLayoutNodes(child, callback, depth + 1);
        }
    }
}

function collectBindPaths(node, result) {
    if (!node) return;
    if (typeof node.bind === 'string' && node.bind.trim().length > 0) {
        result.add(node.bind.trim());
    }
    if (Array.isArray(node.children)) {
        for (const child of node.children) { collectBindPaths(child, result); }
    }
}

function getLayoutFamily(layoutId) {
    if (/^dialog-card/.test(layoutId)) return 'dialog-card';
    if (/^rail-list/.test(layoutId)) return 'rail-list';
    if (/^detail-split/.test(layoutId)) return 'detail-split';
    return null;
}

function validateLayoutStrict(layoutJson, filePath, allSkinSlots, failures, warnings) {
    const rel = relative(filePath);
    const exceptions = (layoutJson.validation && layoutJson.validation.exceptions) || null;
    const family = getLayoutFamily(layoutJson.id || '');
    if (!layoutJson.root) return;

    const DEPTH_LIMIT = 12;
    const CHILDREN_LIMIT = 20;
    const SPACING_MAX = 200;
    const FONT_MIN = 10;
    const FONT_MAX = 96;
    const ALPHA_MAX = 255;

    walkLayoutNodes(layoutJson.root, (node, depth) => {
        const loc = `${rel} - node "${node.name || node.type || '?'}"`;

        // R1: max-node-depth
        if (depth > DEPTH_LIMIT) {
            strictFail('max-node-depth', `${loc} 節點深度 ${depth} 超過限制 ${DEPTH_LIMIT}`, failures, exceptions);
        }

        // R2: max-children-per-container
        if (Array.isArray(node.children) && node.children.length > CHILDREN_LIMIT) {
            strictFail('max-children-per-container', `${loc} 擁有 ${node.children.length} 個子節點，超過限制 ${CHILDREN_LIMIT}`, failures, exceptions);
        }

        // R3: no-empty-container
        if (node.type === 'container') {
            const hasChildren = Array.isArray(node.children) && node.children.length > 0;
            const hasSkinSlot = typeof node.skinSlot === 'string' && node.skinSlot.trim().length > 0;
            if (!hasChildren && !hasSkinSlot) {
                strictFail('no-empty-container', `${loc} 是空容器（無子節點且無 skinSlot）`, failures, exceptions);
            }
        }

        // R4: scroll-list-needs-itemTemplate
        if (node.type === 'scroll-list') {
            const hasTemplate = typeof node.itemTemplate === 'string' && node.itemTemplate.trim().length > 0;
            if (!hasTemplate) {
                strictFail('scroll-list-needs-itemTemplate', `${loc} scroll-list 缺少 itemTemplate`, failures, exceptions);
            }
        }

        // R5: spacing-range  (0 ~ 200 px)
        if (node.layout && typeof node.layout.spacing === 'number') {
            if (node.layout.spacing < 0 || node.layout.spacing > SPACING_MAX) {
                strictFail('spacing-range', `${loc} layout.spacing=${node.layout.spacing} 超出範圍 [0, ${SPACING_MAX}]`, failures, exceptions);
            }
        }

        // R6: font-size-range  (10 ~ 96 px)
        if (typeof node.fontSize === 'number') {
            if (node.fontSize < FONT_MIN || node.fontSize > FONT_MAX) {
                strictFail('font-size-range', `${loc} fontSize=${node.fontSize} 超出範圍 [${FONT_MIN}, ${FONT_MAX}]`, failures, exceptions);
            }
        }

        // R7: widget-border-valid  (所有 widget 數值必須為整數)
        if (node.widget && typeof node.widget === 'object' && !Array.isArray(node.widget)) {
            for (const [k, v] of Object.entries(node.widget)) {
                if (typeof v === 'number' && !Number.isInteger(v)) {
                    strictFail('widget-border-valid', `${loc} widget.${k}=${v} 必須為整數`, failures, exceptions);
                }
            }
        }

        // R8: alpha-range  (0 ~ 255)
        if (typeof node.alpha === 'number') {
            if (node.alpha < 0 || node.alpha > ALPHA_MAX) {
                strictFail('alpha-range', `${loc} alpha=${node.alpha} 超出範圍 [0, ${ALPHA_MAX}]`, failures, exceptions);
            }
        }

        // R9: opacity-range  (0.0 ~ 1.0)
        if (typeof node.opacity === 'number') {
            if (node.opacity < 0.0 || node.opacity > 1.0) {
                strictFail('opacity-range', `${loc} opacity=${node.opacity} 超出範圍 [0.0, 1.0]`, failures, exceptions);
            }
        }

        // R10: dialog-max-cta  (dialog-card 佈局 button container ≤ 2 CTA)
        if (family === 'dialog-card' && node.type === 'container') {
            const n = node.name || '';
            if (/button.?group|btn.?group|cta.?group|footer.?btn|action.?bar/i.test(n)) {
                const ctaCount = Array.isArray(node.children)
                    ? node.children.filter((c) => c.type === 'button').length
                    : 0;
                if (ctaCount > 2) {
                    strictFail('dialog-max-cta', `${loc} dialog-card CTA 按鈕數量 ${ctaCount} 超過限制 2`, failures, exceptions);
                }
            }
        }

        // R11: rail-list-min-items  (rail-list 佈局 railItems ≥ 1)
        if (family === 'rail-list' && node.type === 'scroll-list') {
            if (typeof node.railItems !== 'number') {
                strictFail('rail-list-min-items', `${loc} rail-list 缺少 railItems 宣告`, failures, exceptions);
            } else if (node.railItems < 1) {
                strictFail('rail-list-min-items', `${loc} railItems=${node.railItems} 少於最低要求 1`, failures, exceptions);
            }
        }

        // R12: detail-split-tab-count  (detail-split 佈局 tab 數量 2~6)
        if (family === 'detail-split' && node.type === 'tab-bar') {
            const tabCount = Array.isArray(node.children) ? node.children.length : 0;
            if (tabCount < 2 || tabCount > 6) {
                strictFail('detail-split-tab-count', `${loc} tab 數量 ${tabCount} 超出範圍 [2, 6]`, failures, exceptions);
            }
        }

        // R15: no-dynamic-bind
        if (node.bind === 'dynamic') {
            strictFail('no-dynamic-bind', `${loc} 不允許 bind="dynamic"`, failures, exceptions);
        }

        // R16: nine-slice-border-not-zero
        if (node.nineSlice && typeof node.nineSlice === 'object') {
            const b = Array.isArray(node.nineSlice.border) ? node.nineSlice.border
                    : Array.isArray(node.nineSlice) ? node.nineSlice
                    : null;
            if (b && b.length === 4 && b.every((v) => v === 0)) {
                strictFail('nine-slice-border-not-zero', `${loc} nineSlice border 不得全為 [0,0,0,0]`, failures, exceptions);
            }
        }

        // R17: skin-slot-references-exist
        if (typeof node.skinSlot === 'string' && node.skinSlot.trim().length > 0) {
            if (allSkinSlots.size > 0 && !allSkinSlots.has(node.skinSlot.trim())) {
                strictFail('skin-slot-references-exist', `${rel} - node "${node.name || '?'}" skinSlot="${node.skinSlot}" 在所有 skin 中找不到對應 slot`, failures, exceptions);
            }
        }
    }, 0);
}

function validateScreenStrict(screenNode, screenFilePath, layoutJsons, failures, warnings) {
    const rel = relative(screenFilePath);
    const exceptions = (screenNode.validation && screenNode.validation.exceptions) || null;

    // R14: bind-path-declared
    if (skipRules.has('bind-path-declared')) return;
    const layoutId = typeof screenNode.layout === 'string' ? screenNode.layout.trim() : null;
    if (!layoutId || !layoutJsons.has(layoutId)) return;
    const layoutJson = layoutJsons.get(layoutId);
    if (!layoutJson || !layoutJson.root) return;

    const bindPaths = new Set();
    collectBindPaths(layoutJson.root, bindPaths);
    if (bindPaths.size === 0) return;

    const reqFields = screenNode.contentRequirements && Array.isArray(screenNode.contentRequirements.requiredFields)
        ? new Set(screenNode.contentRequirements.requiredFields)
        : null;
    if (!reqFields) {
        strictWarn('bind-path-declared', `${rel} - 佈局 "${layoutId}" 含 ${bindPaths.size} 個 bind 宣告，但 screen 未設定 contentRequirements.requiredFields`, warnings, exceptions);
    }
}

function assertNonEmptyString(value, label, filePath, failures) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        fail(`${relative(filePath)} - ${label} 必須為非空字串`, failures);
        return false;
    }
    return true;
}

function validateScreenNode(screenNode, filePath, layouts, skins, failures, labelPrefix) {
    const prefix = labelPrefix || 'screen';
    const hasLayout = typeof screenNode.layout === 'string' && screenNode.layout.trim().length > 0;
    const hasSkin = typeof screenNode.skin === 'string' && screenNode.skin.trim().length > 0;

    if (!hasLayout) {
        fail(`${relative(filePath)} - ${prefix}.layout 必須為非空字串`, failures);
    } else if (!layouts.has(screenNode.layout)) {
        fail(`${relative(filePath)} - ${prefix}.layout 找不到對應 layout id：${screenNode.layout}`, failures);
    }

    if (!hasSkin) {
        fail(`${relative(filePath)} - ${prefix}.skin 必須為非空字串`, failures);
    } else if (!skins.has(screenNode.skin)) {
        fail(`${relative(filePath)} - ${prefix}.skin 找不到對應 skin id：${screenNode.skin}`, failures);
    }
}

function loadContracts(failures) {
    const contracts = new Map();

    for (const filePath of listJsonFiles(contractDir)) {
        try {
            const json = readJson(filePath);
            const okSchemaId = assertNonEmptyString(json.schemaId, 'contract.schemaId', filePath, failures);
            assertNonEmptyString(json.familyId, 'contract.familyId', filePath, failures);

            if (!json.fields || typeof json.fields !== 'object' || Array.isArray(json.fields)) {
                fail(`${relative(filePath)} - contract.fields 必須為物件`, failures);
            }
            if (!Array.isArray(json.requiredFields)) {
                fail(`${relative(filePath)} - contract.requiredFields 必須為陣列`, failures);
            }

            if (okSchemaId) {
                if (contracts.has(json.schemaId)) {
                    fail(`${relative(filePath)} - contract.schemaId 重複：${json.schemaId}`, failures);
                } else {
                    contracts.set(json.schemaId, json);
                }
            }
        } catch (error) {
            fail(`${relative(filePath)} - JSON 解析失敗：${error.message}`, failures);
        }
    }

    return contracts;
}

function validateScreenContentRequirements(screenNode, filePath, contracts, failures, warnings) {
    const ref = screenNode.contentRequirements;
    if (!ref) {
        if (screenNode.content && typeof screenNode.content === 'object') {
            warn(`${relative(filePath)} - 已宣告 content.source/content.state，但尚未宣告 contentRequirements`, warnings);
        }
        return;
    }
    if (typeof ref !== 'object' || Array.isArray(ref)) {
        fail(`${relative(filePath)} - contentRequirements 必須為物件`, failures);
        return;
    }

    const okSchemaId = assertNonEmptyString(ref.schemaId, 'contentRequirements.schemaId', filePath, failures);
    const okFamilyId = assertNonEmptyString(ref.familyId, 'contentRequirements.familyId', filePath, failures);
    if (!Array.isArray(ref.requiredFields) || ref.requiredFields.length === 0) {
        fail(`${relative(filePath)} - contentRequirements.requiredFields 必須為非空陣列`, failures);
        return;
    }
    if (!okSchemaId || !okFamilyId) {
        return;
    }

    const schema = contracts.get(ref.schemaId);
    if (!schema) {
        fail(`${relative(filePath)} - contentRequirements.schemaId 找不到對應 schema：${ref.schemaId}`, failures);
        return;
    }

    if (schema.familyId !== ref.familyId) {
        fail(`${relative(filePath)} - contentRequirements.familyId 與 schema.familyId 不一致：${ref.familyId} != ${schema.familyId}`, failures);
    }

    const schemaFields = schema.fields && typeof schema.fields === 'object' ? schema.fields : {};
    const schemaRequired = Array.isArray(schema.requiredFields) ? schema.requiredFields : [];
    const refFieldSet = new Set(ref.requiredFields);

    for (const field of ref.requiredFields) {
        if (!Object.prototype.hasOwnProperty.call(schemaFields, field)) {
            fail(`${relative(filePath)} - contentRequirements.requiredFields 含未定義欄位：${field}`, failures);
        }
    }

    for (const field of schemaRequired) {
        if (!refFieldSet.has(field)) {
            fail(`${relative(filePath)} - contentRequirements.requiredFields 缺少 schema 必填欄位：${field}`, failures);
        }
    }

    const contentRef = screenNode.content;
    if (!contentRef) {
        warn(`${relative(filePath)} - 已宣告 contentRequirements，但尚未宣告 content.source/content.state`, warnings);
        return;
    }
    if (typeof contentRef !== 'object' || Array.isArray(contentRef)) {
        fail(`${relative(filePath)} - content 必須為物件`, failures);
        return;
    }

    const source = typeof contentRef.source === 'string' ? contentRef.source.trim() : '';
    const state = typeof contentRef.state === 'string' ? contentRef.state.trim() : '';
    if (!source) {
        fail(`${relative(filePath)} - content.source 必須為非空字串`, failures);
        return;
    }
    if (!state) {
        fail(`${relative(filePath)} - content.state 必須為非空字串`, failures);
        return;
    }

    const contentFilePath = path.join(contentDir, `${source}.json`);
    if (!fs.existsSync(contentFilePath)) {
        fail(`${relative(filePath)} - content.source 找不到檔案：assets/resources/ui-spec/content/${source}.json`, failures);
        return;
    }

    let contentJson;
    try {
        contentJson = readJson(contentFilePath);
    } catch (error) {
        fail(`${relative(contentFilePath)} - JSON 解析失敗：${error.message}`, failures);
        return;
    }

    if (!contentJson.states || typeof contentJson.states !== 'object' || Array.isArray(contentJson.states)) {
        fail(`${relative(contentFilePath)} - states 必須為物件`, failures);
        return;
    }

    const stateData = contentJson.states[state];
    if (!stateData || typeof stateData !== 'object' || Array.isArray(stateData)) {
        fail(`${relative(filePath)} - content.state 找不到對應內容：${state}`, failures);
        return;
    }

    for (const field of ref.requiredFields) {
        const value = stateData[field];
        if (value === undefined || value === null || value === '') {
            fail(`${relative(filePath)} - content.state "${state}" 缺少必填欄位：${field}`, failures);
        }
    }
}

const failures = [];
const warnings = [];
const layouts = new Map();
const layoutJsons = new Map();
const skins = new Map();
const allSkinSlots = new Set();
const screens = [];

for (const filePath of listJsonFiles(layoutDir)) {
    try {
        const json = readJson(filePath);
        const okId = assertNonEmptyString(json.id, 'layout.id', filePath, failures);
        const hasRoot = json.root && typeof json.root === 'object';
        const hasNodes = Array.isArray(json.nodes);

        if (!hasRoot && !hasNodes) {
            fail(`${relative(filePath)} - layout 必須包含 root 或 nodes`, failures);
        }

        if (!json.canvas || typeof json.canvas !== 'object') {
            fail(`${relative(filePath)} - layout.canvas 缺失`, failures);
        } else if (json.canvas.designWidth !== 1920 || json.canvas.designHeight !== 1080) {
            fail(`${relative(filePath)} - layout.canvas 必須使用 1920x1080`, failures);
        }

        if (okId) {
            if (layouts.has(json.id)) {
                fail(`${relative(filePath)} - layout.id 重複：${json.id}`, failures);
            } else {
                layouts.set(json.id, filePath);
                layoutJsons.set(json.id, json);
            }
        }
    } catch (error) {
        fail(`${relative(filePath)} - JSON 解析失敗：${error.message}`, failures);
    }
}

for (const filePath of listJsonFiles(skinDir)) {
    try {
        const json = readJson(filePath);
        const okId = assertNonEmptyString(json.id, 'skin.id', filePath, failures);

        if (!json.slots || typeof json.slots !== 'object' || Array.isArray(json.slots)) {
            fail(`${relative(filePath)} - skin.slots 必須為物件`, failures);
        }

        if (okId) {
            if (skins.has(json.id)) {
                fail(`${relative(filePath)} - skin.id 重複：${json.id}`, failures);
            } else {
                skins.set(json.id, filePath);
                if (json.slots && typeof json.slots === 'object') {
                    for (const key of Object.keys(json.slots)) { allSkinSlots.add(key); }
                }
            }
        }
    } catch (error) {
        fail(`${relative(filePath)} - JSON 解析失敗：${error.message}`, failures);
    }
}

// --strict 模式：對所有已載入的 layout 執行品質規則
if (strictMode) {
    for (const [layoutId, layoutJson] of layoutJsons) {
        const layoutFilePath = layouts.get(layoutId);
        if (layoutFilePath) {
            validateLayoutStrict(layoutJson, layoutFilePath, allSkinSlots, failures, warnings);
        }
    }
}

const contracts = (checkContentContract || strictMode) ? loadContracts(failures) : new Map();

for (const filePath of listJsonFiles(screenDir)) {
    try {
        const json = readJson(filePath);
        const okId = assertNonEmptyString(json.id, 'screen.id', filePath, failures);

        if (Array.isArray(json.screens)) {
            json.screens.forEach((screenNode, index) => {
                validateScreenNode(screenNode, filePath, layouts, skins, failures, `screens[${index}]`);
                if (checkContentContract || strictMode) {
                    validateScreenContentRequirements(screenNode, filePath, contracts, failures, warnings);
                }
                if (strictMode) {
                    validateScreenStrict(screenNode, filePath, layoutJsons, failures, warnings);
                }
            });
        } else if (Array.isArray(json.panels)) {
            for (const panel of json.panels) {
                if (typeof panel.screen !== 'string' || panel.screen.trim().length === 0) {
                    fail(`${relative(filePath)} - panels.screen 必須為非空字串`, failures);
                }
            }
            if (checkContentContract || strictMode) {
                validateScreenContentRequirements(json, filePath, contracts, failures, warnings);
            }
            if (strictMode) {
                validateScreenStrict(json, filePath, layoutJsons, failures, warnings);
            }
        } else {
            validateScreenNode(json, filePath, layouts, skins, failures, 'screen');
            if (checkContentContract || strictMode) {
                validateScreenContentRequirements(json, filePath, contracts, failures, warnings);
            }
            if (strictMode) {
                validateScreenStrict(json, filePath, layoutJsons, failures, warnings);
            }
        }

        if (okId) {
            screens.push(json.id);
        }
    } catch (error) {
        fail(`${relative(filePath)} - JSON 解析失敗：${error.message}`, failures);
    }
}

if (failures.length > 0) {
    console.error('❌ UI Spec 驗證失敗\n');
    for (const failure of failures) {
        console.error(`- ${failure}`);
    }
    if (warnings.length > 0) {
        console.error('\nWarnings:');
        for (const warning of warnings) {
            console.error(`- ${warning}`);
        }
    }
    console.error(`\n共 ${failures.length} 個錯誤。`);
    process.exit(1);
}

if (warnings.length > 0) {
    console.warn('⚠️ UI Spec 驗證通過，但有 warnings');
    for (const warning of warnings) {
        console.warn(`- ${warning}`);
    }
}

const contractSummary = (checkContentContract || strictMode) ? `, contracts=${contracts.size}` : '';
const strictSummary = strictMode ? ` [strict]` : '';
console.log(`✅ UI Spec 驗證通過（layouts=${layouts.size}, skins=${skins.size}, screens=${screens.length}${contractSummary}${strictSummary}）`);
