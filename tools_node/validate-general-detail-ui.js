#!/usr/bin/env node
/**
 * validate-general-detail-ui.js — 武將人物資訊 UI 專屬契約驗證
 *
 * 驗證項目：
 *   1. general-detail screen / layout / skin 三層引用一致
 *   2. GeneralDetailPanel 實際走 screen 載入入口
 *   3. layout 中存在程式會查找的關鍵節點
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const layoutPath = path.join(projectRoot, 'assets/resources/ui-spec/layouts/general-detail-main.json');
const skinPath = path.join(projectRoot, 'assets/resources/ui-spec/skins/general-detail-default.json');
const screenPath = path.join(projectRoot, 'assets/resources/ui-spec/screens/general-detail-screen.json');
const panelPath = path.join(projectRoot, 'assets/scripts/ui/components/GeneralDetailPanel.ts');

const skinDir = path.join(projectRoot, 'assets/resources/ui-spec/skins');
const layoutDir = path.join(projectRoot, 'assets/resources/ui-spec/layouts');
const fragmentDir = path.join(projectRoot, 'assets/resources/ui-spec/fragments');

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * 模擬 UISpecLoader 的遞迴 $ref 解析，用於驗證
 */
/**
 * 模擬 UISpecLoader 的遞迴 $ref 解析，用於驗證
 */
function resolveLayoutRefs(node, visited = new Set()) {
    if (!node) return;
    
    // 防止物件循環引用（雖然 JSON 不太可能，但合併過程中可能有意外）
    if (visited.has(node)) return;
    visited.add(node);

    if (node.$ref) {
        const refPath = path.join(projectRoot, 'assets/resources/ui-spec', `${node.$ref}.json`);
        if (fs.existsSync(refPath)) {
            try {
                // 重要：深拷貝避免多個節點共用同一個 fragment 物件實體
                const fragment = JSON.parse(fs.readFileSync(refPath, 'utf8'));

                const localChildren = node.children || [];
                const localName = node.name;
                const originalRef = node.$ref;

                delete node.$ref;

                // 合併屬性
                const merged = { ...fragment, ...node };
                Object.assign(node, merged);

                // Content 容器邏輯
                const contentNode = (node.children || []).find(c => c.name === 'Content');
                if (contentNode && localChildren.length > 0) {
                    contentNode.children = [...(contentNode.children || []), ...localChildren];
                } else if (localChildren.length > 0) {
                    node.children = [...(fragment.children || []), ...localChildren];
                }

                node.name = localName || fragment.name;
                node.id = originalRef;
            } catch (e) {
                console.warn(`[Validator] 警告: 無法解析 $ref ${node.$ref}: ${e.message}`);
            }
        }
    }

    // 對目前的子節點遞迴（包含剛從 fragment 併入的）
    if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
            resolveLayoutRefs(child, visited);
        }
    }
    
    if (node.itemTemplate) {
        resolveLayoutRefs(node.itemTemplate, visited);
    }
}

/**
 * 模擬 UISpecLoader 的 $fragments 合併，用於驗證
 */
function resolveSkinFragments(skin) {
    if (skin.$fragments && Array.isArray(skin.$fragments)) {
        const slots = skin.slots || {};
        for (const fragId of skin.$fragments) {
            const fragPath = path.join(fragmentDir, 'skins', `${fragId}.json`);
            if (fs.existsSync(fragPath)) {
                try {
                    const frag = readJson(fragPath);
                    // 合併 slots，現有的優先 (模擬 UISpecLoader)
                    Object.assign(slots, { ...frag.slots, ...slots });
                } catch (e) {
                    console.warn(`[Validator] 警告: 無法併入 skin fragment ${fragId}: ${e.message}`);
                }
            }
        }
        skin.slots = slots;
    }
}

function collectPaths(node, prefix = '', visited = new Set()) {
    if (!node || visited.has(node)) return [];
    visited.add(node);

    const current = prefix ? `${prefix}/${node.name}` : node.name;
    const paths = [current];
    for (const child of node.children || []) {
        paths.push(...collectPaths(child, current, visited));
    }
    return paths;
}

function findNodeByPath(node, segments) {
    let current = node;
    for (const segment of segments) {
        if (!current || !Array.isArray(current.children)) return null;
        current = current.children.find((child) => child.name === segment) || null;
    }
    return current;
}

function parsePercent(value) {
    if (typeof value !== 'string' || !value.endsWith('%')) return null;
    const number = Number.parseFloat(value.slice(0, -1));
    return Number.isFinite(number) ? number : null;
}

function hasNode(path) {
    return allPaths.has(path);
}

function hasAnyNode(paths) {
    return paths.some((path) => allPaths.has(path));
}

function hasAllNodes(paths) {
    return paths.every((path) => allPaths.has(path));
}

const failures = [];

if (!fs.existsSync(layoutPath)) failures.push('缺少 general-detail layout');
if (!fs.existsSync(skinPath)) failures.push('缺少 general-detail skin');
if (!fs.existsSync(screenPath)) failures.push('缺少 general-detail screen');
if (!fs.existsSync(panelPath)) failures.push('缺少 GeneralDetailPanel.ts');

if (failures.length > 0) {
    console.error('❌ GeneralDetail UI 驗證失敗\n');
    failures.forEach((item) => console.error(`- ${item}`));
    process.exit(1);
}

const layout = readJson(layoutPath);
const skin = readJson(skinPath);

// 解析碎片引用與併入 $fragments，使其符合後續節點查找邏輯
resolveLayoutRefs(layout.root);
resolveSkinFragments(skin);

const screen = readJson(screenPath);
const panelCode = fs.readFileSync(panelPath, 'utf8');
const allPaths = new Set(collectPaths(layout.root));
const portraitNode = findNodeByPath(layout.root, ['PortraitImage']);
const topLeftInfoNode = findNodeByPath(layout.root, ['TopLeftInfo']);
const summaryStripNode = findNodeByPath(layout.root, ['BottomLeftInfo']);
const rightTabBarNode = findNodeByPath(layout.root, ['RightTabBar']);
const rightContentAreaNode = findNodeByPath(layout.root, ['RightContentArea']);
const footerPanelNode = findNodeByPath(layout.root, ['RightContentArea', 'FooterPanel']);

if (screen.layout !== 'general-detail-main') {
    failures.push(`screen.layout 應為 general-detail-main，實際為 ${screen.layout}`);
}
if (screen.skin !== 'general-detail-default') {
    failures.push(`screen.skin 應為 general-detail-default，實際為 ${screen.skin}`);
}
if (screen.uiId !== 'GeneralDetail') {
    failures.push(`screen.uiId 應為 GeneralDetail，實際為 ${screen.uiId}`);
}
if (!skin.slots || !skin.slots['detail.footer.bg']) {
    failures.push('skin 缺少 detail.footer.bg slot');
}
if (skin.slots?.['detail.bg.fullscreen']?.kind !== 'sprite-frame') {
    failures.push('detail.bg.fullscreen 應為 sprite-frame');
}
if (skin.slots?.['detail.bg.fullscreen']?.spriteType !== 'sliced') {
    failures.push('detail.bg.fullscreen 應改為 sliced，避免 bg_ink_main 直接整張縮放');
}
const fullscreenBorder = skin.slots?.['detail.bg.fullscreen']?.border;
if (!Array.isArray(fullscreenBorder) || fullscreenBorder.length !== 4) {
    failures.push('detail.bg.fullscreen 應具備四向九宮格 border');
} else {
    const [top, right, bottom, left] = fullscreenBorder;
    if (left < 360 || right < 300 || top < 80 || bottom < 80) {
        failures.push('detail.bg.fullscreen 的九宮格 border 過小，無法保留左側立繪留白與右側山景角飾');
    }
}
if (skin.slots?.['detail.content.bg']?.kind !== 'sprite-frame') {
    failures.push('detail.content.bg 應為 sprite-frame，承接 AI 產出的材質框體');
}
if (skin.slots?.['detail.section.bg']?.kind !== 'sprite-frame') {
    failures.push('detail.section.bg 應為 sprite-frame，確保高密度頁籤具有卡片材質感');
}
if (skin.slots?.['detail.tab.idle']?.kind !== 'button-skin') {
    failures.push('detail.tab.idle 應為 button-skin，讓頁籤具備按下/停用狀態圖');
}
if (!panelCode.includes("loadFullScreen('general-detail-screen')") && !panelCode.includes('loadFullScreen("general-detail-screen")')) {
    failures.push('GeneralDetailPanel 尚未使用 general-detail-screen 作為載入入口');
}
const hasHeaderLayering = hasAllNodes([
    'GeneralDetailRoot/TopLeftInfoFill',
    'GeneralDetailRoot/TopLeftInfoBleed',
    'GeneralDetailRoot/TopLeftInfoFrame',
]);
if (topLeftInfoNode?.skinSlot !== 'detail.header.bg' && !hasHeaderLayering) {
    failures.push('TopLeftInfo 應保留 detail.header.bg 單層相容入口，或提供 TopLeftInfo 的 fill / bleed / frame 分層節點');
}
if (summaryStripNode?.widget?.top === undefined || summaryStripNode?.widget?.right === undefined) {
    failures.push('BottomLeftInfo 應改為右上摘要列配置（需同時設定 widget.top 與 widget.right）');
}
const hasSummaryLayering = hasAllNodes([
    'GeneralDetailRoot/BottomLeftInfoFill',
    'GeneralDetailRoot/BottomLeftInfoBleed',
    'GeneralDetailRoot/BottomLeftInfoFrame',
]);
if (summaryStripNode?.skinSlot !== 'detail.summary.bg' && !hasSummaryLayering) {
    failures.push('BottomLeftInfo 應保留 detail.summary.bg 單層相容入口，或提供摘要列 fill / bleed / frame 分層節點');
}
const portraitWidthPct = parsePercent(portraitNode?.width);
if (portraitWidthPct === null || portraitWidthPct < 44 || portraitWidthPct > 50) {
    failures.push('PortraitImage 寬度應維持在 44%~50%，避免角色主視覺過窄或過寬');
}
const contentWidthPct = parsePercent(rightContentAreaNode?.width);
if (contentWidthPct === null || contentWidthPct < 36 || contentWidthPct > 40) {
    failures.push('RightContentArea 寬度應維持在 36%~40%，確保 Web / 手機橫向模式可讀性');
}
if (typeof rightTabBarNode?.width !== 'number' || rightTabBarNode.width < 108) {
    failures.push('RightTabBar 寬度不得小於 108 px，避免頁籤文字被壓縮');
}
const hasTabRailLayering = hasAllNodes([
    'GeneralDetailRoot/RightTabBarFill',
    'GeneralDetailRoot/RightTabBarBleed',
    'GeneralDetailRoot/RightTabBarFrame',
]);
if (rightTabBarNode?.skinSlot !== 'detail.tabbar.bg' && !hasTabRailLayering) {
    failures.push('RightTabBar 應保留 detail.tabbar.bg 單層相容入口，或提供 tab rail 的 fill / bleed / frame 分層節點');
}
if (rightContentAreaNode?.widget?.top === undefined || rightContentAreaNode.widget.top < 160) {
    failures.push('RightContentArea 應下移到摘要列之下，widget.top 不得小於 160');
}
const hasContentLayering = hasAllNodes([
    'GeneralDetailRoot/RightContentAreaFill',
    'GeneralDetailRoot/RightContentAreaBleed',
    'GeneralDetailRoot/RightContentAreaFrame',
]);
if (rightContentAreaNode?.skinSlot !== 'detail.content.bg' && !hasContentLayering) {
    failures.push('RightContentArea 應保留 detail.content.bg 單層相容入口，或提供內容主區的 fill / bleed / frame 分層節點');
}
if (typeof footerPanelNode?.height !== 'number' || footerPanelNode.height < 72) {
    failures.push('FooterPanel 高度不得小於 72 px，以維持手機觸控可讀性');
}
const hasFooterLayering = hasAllNodes([
    'GeneralDetailRoot/RightContentArea/FooterPanelFill',
    'GeneralDetailRoot/RightContentArea/FooterPanelBleed',
    'GeneralDetailRoot/RightContentArea/FooterPanelFrame',
]);
if (footerPanelNode?.skinSlot !== 'detail.footer.bg' && !hasFooterLayering) {
    failures.push('FooterPanel 應保留 detail.footer.bg 單層相容入口，或提供底部操作列的 fill / bleed / frame 分層節點');
}

const requiredPaths = [
    'GeneralDetailRoot/TopLeftInfo/Content/TitleLabel',
    'GeneralDetailRoot/TopLeftInfo/Content/NameLabel',
    'GeneralDetailRoot/TopLeftInfo/Content/MetaLabel',
    'GeneralDetailRoot/BottomLeftInfo/Content/EpCard/EpValue',
    'GeneralDetailRoot/BottomLeftInfo/Content/VitCard/VitValue',
    'GeneralDetailRoot/RightTabBar/BtnTabBasics',
    'GeneralDetailRoot/RightTabBar/BtnTabStats',
    'GeneralDetailRoot/RightTabBar/BtnTabBloodline',
    'GeneralDetailRoot/RightTabBar/BtnTabSkills',
    'GeneralDetailRoot/RightTabBar/BtnTabAptitude',
    'GeneralDetailRoot/RightTabBar/BtnTabExtended',
    'GeneralDetailRoot/RightTabBar/BtnClose',
    'GeneralDetailRoot/RightContentArea/TabBasics/UidValue',
    'GeneralDetailRoot/RightContentArea/TabStats/StatsRoleValue',
    'GeneralDetailRoot/RightContentArea/TabBloodline/BloodlineSummaryCard/AncestorsValue',
    'GeneralDetailRoot/RightContentArea/TabBloodline/AncestorTree',
    'GeneralDetailRoot/RightContentArea/TabBloodline/GeneListCard/Gene1Value',
    'GeneralDetailRoot/RightContentArea/TabSkills/PrimarySkillCard/PrimarySkillValue',
    'GeneralDetailRoot/RightContentArea/TabSkills/LearnedSkillsCard/LearnedSkillsValue',
    'GeneralDetailRoot/RightContentArea/TabAptitude/TerrainSummaryCard/PreferredTerrainValue',
    'GeneralDetailRoot/RightContentArea/TabAptitude/WeatherCard/WeatherValue',
    'GeneralDetailRoot/RightContentArea/TabExtended/DevNoteValue',
    'GeneralDetailRoot/RightContentArea/FooterPanel',
    'GeneralDetailRoot/RightContentArea/FooterPanel/BtnFavorite',
    'GeneralDetailRoot/RightContentArea/FooterPanel/BtnLock',
    'GeneralDetailRoot/RightContentArea/FooterPanel/BtnCompare',
    'GeneralDetailRoot/RightContentArea/FooterPanel/BtnShare'
];

for (const nodePath of requiredPaths) {
    if (!allPaths.has(nodePath)) {
        failures.push(`layout 缺少必要節點：${nodePath}`);
    }
}

const requiredLayeredSlots = [
    'detail.header.frame',
    'detail.header.fill',
    'detail.summary.frame',
    'detail.summary.fill',
    'detail.tabbar.rail.frame',
    'detail.tabbar.rail.fill',
    'detail.content.frame',
    'detail.content.fill',
    'detail.section.frame',
    'detail.section.fill',
    'detail.footer.frame',
    'detail.footer.fill',
    'detail.field.bg',
    'detail.field.title.bg',
    'detail.field.name.bg',
    'detail.field.meta.bg',
];

for (const slotId of requiredLayeredSlots) {
    if (!skin.slots?.[slotId]) {
        failures.push(`skin 缺少分層相容 slot：${slotId}`);
    }
}

if (failures.length > 0) {
    console.error('❌ GeneralDetail UI 驗證失敗\n');
    failures.forEach((item) => console.error(`- ${item}`));
    process.exit(1);
}

console.log('✅ GeneralDetail UI 契約驗證通過');
