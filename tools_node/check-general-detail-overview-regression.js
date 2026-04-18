#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const layoutPath = path.join(projectRoot, 'assets/resources/ui-spec/layouts/general-detail-bloodline-v3-main.json');
const skinPath = path.join(projectRoot, 'assets/resources/ui-spec/skins/general-detail-bloodline-v3-default.json');
const overviewContractPath = path.join(projectRoot, 'assets/resources/ui-spec/contracts/general-detail-overview-content.schema.json');
const overviewFragmentPath = path.join(projectRoot, 'assets/resources/ui-spec/fragments/layouts/gd-tab-overview.json');
const shellPath = path.join(projectRoot, 'assets/scripts/ui/components/GeneralDetailOverviewShell.ts');
const compositePath = path.join(projectRoot, 'assets/scripts/ui/components/GeneralDetailComposite.ts');
const bindPolicyPath = path.join(projectRoot, 'assets/scripts/ui/components/general-detail/GeneralDetailOverviewBindPathPolicy.ts');
const shellResourcesPath = path.join(projectRoot, 'assets/scripts/ui/components/general-detail/GeneralDetailOverviewShellResources.ts');
const tabBindPolicyInterfacePath = path.join(projectRoot, 'assets/scripts/ui/components/general-detail/TabBindPathPolicy.ts');
const loadingScenePath = path.join(projectRoot, 'assets/scripts/ui/scenes/LoadingScene.ts');

const unifiedLayoutPath = path.join(projectRoot, 'assets/resources/ui-spec/layouts/general-detail-unified-main.json');
const unifiedScreenPath = path.join(projectRoot, 'assets/resources/ui-spec/screens/general-detail-unified-screen.json');

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// ─── $ref 解析器（鏡像 UISpecLoader._resolveLayoutRefs） ─────────────
const fragmentsBase = path.join(projectRoot, 'assets/resources/ui-spec');
function resolveRefs(node) {
    if (!node) return;
    if (node.$ref) {
        const fragPath = path.join(fragmentsBase, node.$ref + '.json');
        try {
            const fragment = readJson(fragPath);
            const originalRef = node.$ref;
            delete node.$ref;
            const merged = { ...fragment, ...node };
            Object.assign(node, merged);
            delete node.$ref;
        } catch (e) {
            console.warn(`[regression] 無法載入碎片: ${node.$ref} — ${e.message}`);
        }
    }
    if (node.children) node.children.forEach(resolveRefs);
    if (node.itemTemplate) resolveRefs(node.itemTemplate);
}

function findNodeByName(node, name) {
    if (!node) {
        return null;
    }
    if (node.name === name) {
        return node;
    }
    for (const child of node.children || []) {
        const found = findNodeByName(child, name);
        if (found) {
            return found;
        }
    }
    return null;
}

function collectPaths(node, prefix = '') {
    if (!node) {
        return [];
    }
    const current = prefix ? `${prefix}/${node.name}` : node.name;
    const paths = [current];
    for (const child of node.children || []) {
        paths.push(...collectPaths(child, current));
    }
    return paths;
}

const failures = [];
const layout = readJson(layoutPath);
const skin = readJson(skinPath);
const overviewContract = readJson(overviewContractPath);
const overviewFragment = readJson(overviewFragmentPath);
const unifiedLayout = readJson(unifiedLayoutPath);
const unifiedScreen = readJson(unifiedScreenPath);
const shellCode = fs.readFileSync(shellPath, 'utf8');
const compositeCode = fs.readFileSync(compositePath, 'utf8');
const bindPolicyCode = fs.readFileSync(bindPolicyPath, 'utf8');
const shellResourcesCode = fs.readFileSync(shellResourcesPath, 'utf8');
const tabBindPolicyCode = fs.readFileSync(tabBindPolicyInterfacePath, 'utf8');
const loadingSceneCode = fs.readFileSync(loadingScenePath, 'utf8');

const unifiedBindPathAliases = {
    headerTitle: 'HeaderRow/NameTitleColumn/TitleLabel',
    headerName: 'HeaderRow/NameTitleColumn/NameLabel',
    headerMeta: 'HeaderRow/MetaColumn/MetaLabel',
    rarityLabel: 'HeaderRow/MetaColumn/RarityBadgeDock/RarityBadge/RarityBadgeLabel',
    coreStatsTitle: 'OverviewSummaryModules/CoreStatsCard/CoreStatsTitleBand/CoreStatsTitle',
    coreStatsValue: 'OverviewSummaryModules/CoreStatsCard/CoreStatsValue',
    roleTitle: 'OverviewSummaryModules/RoleCard/RoleTitleBand/RoleTitle',
    roleValue: 'OverviewSummaryModules/RoleCard/RoleValue',
    traitTitle: 'OverviewSummaryModules/TraitCard/TraitTitleBand/TraitTitle',
    traitValue: 'OverviewSummaryModules/TraitCard/TraitValue',
    bloodlineName: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineSummaryCard/BloodlineName',
    awakeningLabel: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineSummaryCard/AwakeningProgressGroup/AwakeningLabel',
    personalityValue: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineSummaryCard/PersonalityValue',
    bloodlineBody: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineSummaryCard/BloodlineBody',
    crestTitle: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineCrestCard/CrestTitle',
    crestHint: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineCrestCard/CrestHint',
};

// $ref 展開（解析後與靜態 JSON 行為一致）
resolveRefs(layout.root);
resolveRefs(overviewFragment);

const allPaths = new Set(collectPaths(layout.root));
const overviewFragmentPaths = new Set(collectPaths(overviewFragment));

function requirePath(nodePath) {
    if (!allPaths.has(`GeneralDetailBloodlineRoot/${nodePath}`)) {
        failures.push(`layout 缺少必要節點：GeneralDetailBloodlineRoot/${nodePath}`);
    }
}

function requireShellPath(nodePath) {
    const contractFields = overviewContract?.fields && typeof overviewContract.fields === 'object'
        ? Object.values(overviewContract.fields)
        : [];
    const coveredByContract = contractFields.some((field) => field?.bindPath === nodePath);
    const binderFirstShell = shellCode.includes('this._screenSpec?.contentRequirements')
        && shellCode.includes('await this._contentBinder.bind(');

    if (coveredByContract && binderFirstShell) {
        return;
    }

    const equivalentPaths = [nodePath];
    const legacyShellPath = nodePath.replace(
        'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineUnifiedCard/BloodlineSummaryCard',
        'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard',
    );
    if (legacyShellPath !== nodePath) {
        equivalentPaths.push(legacyShellPath);
    }

    if (!equivalentPaths.some((candidate) => shellCode.includes(candidate))) {
        failures.push(`shell 缺少關鍵 path 綁定：${nodePath}`);
    }
}

function requireUnifiedAlias(fieldKey, nodePath) {
    if (!bindPolicyCode.includes(`${fieldKey}: '${nodePath}'`)) {
        failures.push(`bind policy 缺少 unified alias：${fieldKey} -> ${nodePath}`);
    }
    if (!overviewFragmentPaths.has(`OverviewTabContent/${nodePath}`)) {
        failures.push(`unified fragment 缺少 alias 目標節點：OverviewTabContent/${nodePath}`);
    }
}

// ─── 1. 血脈欄位 stretch widget 檢查 ─────────────────────────────────
const bloodlineFields = findNodeByName(layout.root, 'BloodlineSummaryFields');
if (!bloodlineFields?.widget || bloodlineFields.widget.left === undefined || bloodlineFields.widget.right === undefined) {
    failures.push('BloodlineSummaryFields 必須使用 left/right stretch widget，避免整組血脈欄位再次向左漂移');
}

const awakeningGroup = findNodeByName(layout.root, 'AwakeningProgressGroup');
if (!awakeningGroup?.widget || awakeningGroup.widget.left !== 0 || awakeningGroup.widget.right !== 0) {
    failures.push('AwakeningProgressGroup 必須使用 left/right stretch widget，避免進度列與標籤寬度不一致');
}

for (const name of ['BloodlineTitle', 'BloodlineName', 'AwakeningLabel', 'PersonalityLabel', 'PersonalityValue']) {
    const node = findNodeByName(layout.root, name);
    if (!node?.widget || node.widget.left !== 0 || node.widget.right !== 0) {
        failures.push(`${name} 必須保留 left/right stretch widget`);
    }
}

// ─── 2. 摘要卡寬度守門 ──────────────────────────────────────────────
const roleCard = findNodeByName(layout.root, 'RoleCard');
if (roleCard?.width !== '26%') {
    failures.push('RoleCard 寬度應維持 26%，避免中間摘要卡再次擠壓到正文');
}

// ─── 3. 摘要卡正文 style 檢查 ───────────────────────────────────────
for (const name of ['CoreStatsValue', 'RoleValue', 'TraitValue']) {
    const node = findNodeByName(layout.root, name);
    if (node?.styleSlot !== 'gdv3.label.cardBodySummary') {
        failures.push(`${name} 應使用 gdv3.label.cardBodySummary，避免摘要卡正文在窄卡中被擠掉`);
    }
}

if (!skin.slots?.['gdv3.label.cardBodySummary']) {
    failures.push('skin 缺少 gdv3.label.cardBodySummary style');
}

// ─── 4. Widget stretch 彈性尺寸檢查 ─────────────────────────────────
// 摘要卡 value labels 必須使用 Widget top+bottom 彈性拉伸，不可使用固定 height
for (const name of ['CoreStatsValue', 'RoleValue', 'TraitValue']) {
    const node = findNodeByName(layout.root, name);
    if (!node) continue;
    if (!node.widget || node.widget.top === undefined || node.widget.bottom === undefined) {
        failures.push(`${name} 必須使用 widget top+bottom 彈性拉伸，不可使用固定 height（防止文字超框回歸）`);
    }
    if (node.height !== undefined) {
        failures.push(`${name} 不應有固定 height（現為 ${node.height}），應由 widget top+bottom 自動計算`);
    }
}

// BloodlineBody 也必須使用 Widget stretch
const bloodlineBody = findNodeByName(layout.root, 'BloodlineBody');
if (bloodlineBody) {
    if (!bloodlineBody.widget || bloodlineBody.widget.top === undefined || bloodlineBody.widget.bottom === undefined) {
        failures.push('BloodlineBody 必須使用 widget top+bottom 彈性拉伸');
    }
    if (bloodlineBody.height !== undefined) {
        failures.push(`BloodlineBody 不應有固定 height（現為 ${bloodlineBody.height}），應由 widget stretch 自動計算`);
    }
}

// BloodlineCrestCarrier 也必須使用 Widget stretch
const crestCarrier = findNodeByName(layout.root, 'BloodlineCrestCarrier');
if (crestCarrier) {
    if (!crestCarrier.widget || crestCarrier.widget.top === undefined || crestCarrier.widget.bottom === undefined) {
        failures.push('BloodlineCrestCarrier 必須使用 widget top+bottom 彈性拉伸');
    }
}

// ─── 5. 卡片不應使用 vertical layout（改用 Widget 定位） ─────────────
for (const cardName of ['CoreStatsCard', 'RoleCard', 'TraitCard', 'BloodlineSummaryCard', 'BloodlineCrestCard']) {
    const card = findNodeByName(layout.root, cardName);
    if (card?.layout) {
        failures.push(`${cardName} 不應使用 layout（改用 Widget 定位子節點），目前仍有 layout.type="${card.layout.type}"`);
    }
}

// ─── 6. Layout 容器子節點溢出靜態檢查 ───────────────────────────────
function checkLayoutOverflow(node, path) {
    if (!node || !node.layout || !node.children) return;
    const isV = node.layout.type === 'vertical';
    const isH = node.layout.type === 'horizontal';
    if (!isV && !isH) return;

    const containerSize = isV ? (node.height || 0) : (node.width || 0);
    if (typeof containerSize !== 'number' || containerSize <= 0) return;

    const padStart = isV ? (node.layout.paddingTop || 0) : (node.layout.paddingLeft || 0);
    const padEnd = isV ? (node.layout.paddingBottom || 0) : (node.layout.paddingRight || 0);
    const spacing = node.layout.spacing || 0;

    let totalChild = 0;
    let count = 0;
    for (const child of node.children) {
        const size = isV ? child.height : child.width;
        if (typeof size === 'number') {
            totalChild += size;
            count++;
        }
    }
    const totalSpacing = Math.max(0, count - 1) * spacing;
    const available = containerSize - padStart - padEnd;
    const required = totalChild + totalSpacing;
    if (required > available) {
        failures.push(
            `[靜態溢出] ${path} 子節點總尺寸 ${required}px 超出容器可用 ${available}px（溢出 ${required - available}px）`
        );
    }
}

function walkAndCheck(node, path) {
    if (!node) return;
    const currentPath = path ? `${path}/${node.name}` : node.name;
    checkLayoutOverflow(node, currentPath);
    for (const child of node.children || []) {
        walkAndCheck(child, currentPath);
    }
}
walkAndCheck(layout.root, '');

// ─── 7. 關鍵節點路徑與 shell 綁定 ──────────────────────────────────

for (const nodePath of [
    'InfoContent/OverviewSummaryModules/CoreStatsCard/CoreStatsTitleBand/CoreStatsTitle',
    'InfoContent/OverviewSummaryModules/RoleCard/RoleTitleBand/RoleTitle',
    'InfoContent/OverviewSummaryModules/RoleCard/RoleValue',
    'InfoContent/OverviewSummaryModules/TraitCard/TraitTitleBand/TraitTitle',
    'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineUnifiedCard/BloodlineSummaryCard/BloodlineSummaryFields/BloodlineTitle',
    'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineUnifiedCard/BloodlineSummaryCard/BloodlineSummaryFields/PersonalityLabel'
]) {
    requirePath(nodePath);
    requireShellPath(nodePath);
}

for (const [fieldKey, nodePath] of Object.entries(unifiedBindPathAliases)) {
    requireUnifiedAlias(fieldKey, nodePath);
}

// ─── 8. UCUF 統一架構守門 ─────────────────────────────────────────────

// 8a. Unified layout 必須有 OverviewSlot lazySlot
const unifiedRoot = unifiedLayout.root;
const overviewSlotNode = findNodeByName(unifiedRoot, 'OverviewSlot');
if (!overviewSlotNode) {
    failures.push('general-detail-unified-main.json 缺少 OverviewSlot 節點');
} else {
    if (!overviewSlotNode.lazySlot) {
        failures.push('OverviewSlot 必須設定 lazySlot: true');
    }
    if (overviewSlotNode.defaultFragment !== 'fragments/layouts/gd-tab-overview') {
        failures.push(`OverviewSlot.defaultFragment 應為 fragments/layouts/gd-tab-overview，實為 ${overviewSlotNode.defaultFragment}`);
    }
}

// 8b. Unified screen tabRouting Overview 必須路由到 OverviewSlot
const overviewRoute = unifiedScreen?.tabRouting?.Overview;
if (!overviewRoute) {
    failures.push('general-detail-unified-screen.json 缺少 tabRouting.Overview');
} else if (overviewRoute.slotId !== 'OverviewSlot') {
    failures.push(`tabRouting.Overview.slotId 應為 OverviewSlot，實為 ${overviewRoute.slotId}`);
}

// 8c. Composite 不應再 import GeneralDetailOverviewShell
if (compositeCode.includes("from './GeneralDetailOverviewShell'")) {
    failures.push('GeneralDetailComposite 不應再 import GeneralDetailOverviewShell（已由 UCUF OverviewSlot 取代）');
}

// 8d. Composite 不應再含 _ensureOverviewShell / _showOverviewShell
if (compositeCode.includes('private _ensureOverviewShell()') || compositeCode.includes('_ensureOverviewShell():')) {
    failures.push('GeneralDetailComposite 不應再有 _ensureOverviewShell()（shell bootstrap 已移除）');
}
if (compositeCode.includes('private async _showOverviewShell(') || compositeCode.includes('_showOverviewShell(')) {
    failures.push('GeneralDetailComposite 不應再有 _showOverviewShell()（shell routing 已移除）');
}

// 8e. Shell chrome/resource split 仍維持（shell 本身依然存在，用於 GeneralDetailPanel 相容）
if (!shellCode.includes('private _applyChromeOnlyContent(') || !shellCode.includes('private async _applyResourceOnlyContent(')) {
    failures.push('GeneralDetailOverviewShell 尚未拆成 chrome-only / resource-only content flow');
}

// 8f. Shell 資源載入已移至 ShellResources
if (shellCode.includes('private async _applyCrestFace(')) {
    failures.push('GeneralDetailOverviewShell._applyCrestFace() 應已移至 GeneralDetailOverviewShellResources，shell 不應自持該方法');
}

if (shellCode.includes('private async _loadPortrait(')) {
    failures.push('GeneralDetailOverviewShell._loadPortrait() 應已移至 GeneralDetailOverviewShellResources，shell 不應自持該方法');
}

if (!shellCode.includes("from './general-detail/GeneralDetailOverviewShellResources'")) {
    failures.push('GeneralDetailOverviewShell 缺少 GeneralDetailOverviewShellResources import');
}

if (!shellResourcesCode.includes('export async function applyShellOverviewCrestFace(')) {
    failures.push('GeneralDetailOverviewShellResources 缺少 applyShellOverviewCrestFace export');
}

if (!shellResourcesCode.includes('export async function applyShellOverviewPortrait(')) {
    failures.push('GeneralDetailOverviewShellResources 缺少 applyShellOverviewPortrait export');
}

// 8g. TabBindPathPolicy 介面與 overviewBindPathPolicy
if (!tabBindPolicyCode.includes('export interface TabBindPathPolicy {')) {
    failures.push('TabBindPathPolicy.ts 缺少 TabBindPathPolicy interface 定義');
}

if (!bindPolicyCode.includes("import type { TabBindPathPolicy }")) {
    failures.push('GeneralDetailOverviewBindPathPolicy 未 import TabBindPathPolicy 介面');
}

if (!bindPolicyCode.includes('export const overviewBindPathPolicy: TabBindPathPolicy = {')) {
    failures.push('GeneralDetailOverviewBindPathPolicy 缺少 overviewBindPathPolicy 物件 export');
}

// 8h. LoadingScene probe 已更新至 UCUF 結構
if (!loadingSceneCode.includes("root.getChildByName('OverviewSlot')")) {
    failures.push('LoadingScene._assertGeneralDetailOverviewVisualReady 未更新至 UCUF OverviewSlot 探針');
}

if (!loadingSceneCode.includes('_assertGeneralDetailOverviewVisualReady(detailPanel);')) {
    failures.push('LoadingScene 缺少 GeneralDetailOverview visual-ready probe');
}

if (!loadingSceneCode.includes("return 'general-detail-unified-screen';")) {
    failures.push('LoadingScene preview fallback screenId 未對齊 general-detail-unified-screen');
}

if (failures.length > 0) {
    console.error('❌ GeneralDetailOverview regression check failed\n');
    for (const failure of failures) {
        console.error(`- ${failure}`);
    }
    process.exit(1);
}

console.log('✅ GeneralDetailOverview regression check passed');