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
const skins = new Map();
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
            }
        }
    } catch (error) {
        fail(`${relative(filePath)} - JSON 解析失敗：${error.message}`, failures);
    }
}

const contracts = checkContentContract ? loadContracts(failures) : new Map();

for (const filePath of listJsonFiles(screenDir)) {
    try {
        const json = readJson(filePath);
        const okId = assertNonEmptyString(json.id, 'screen.id', filePath, failures);

        if (Array.isArray(json.screens)) {
            json.screens.forEach((screenNode, index) => {
                validateScreenNode(screenNode, filePath, layouts, skins, failures, `screens[${index}]`);
                if (checkContentContract) {
                    validateScreenContentRequirements(screenNode, filePath, contracts, failures, warnings);
                }
            });
        } else if (Array.isArray(json.panels)) {
            for (const panel of json.panels) {
                if (typeof panel.screen !== 'string' || panel.screen.trim().length === 0) {
                    fail(`${relative(filePath)} - panels.screen 必須為非空字串`, failures);
                }
            }
            if (checkContentContract) {
                validateScreenContentRequirements(json, filePath, contracts, failures, warnings);
            }
        } else {
            validateScreenNode(json, filePath, layouts, skins, failures, 'screen');
            if (checkContentContract) {
                validateScreenContentRequirements(json, filePath, contracts, failures, warnings);
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

const contractSummary = checkContentContract ? `, contracts=${contracts.size}` : '';
console.log(`✅ UI Spec 驗證通過（layouts=${layouts.size}, skins=${skins.size}, screens=${screens.length}${contractSummary}）`);
