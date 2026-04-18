/**
 * GeneralDetailOverviewVisuals
 *
 * Overview 右側 content visual pass 的共用 renderer。
 *
 * 目前 production Overview 仍走 legacy shell-host 路徑，但第二階段 UCUF 收斂需要
 * 讓 shell 與 unified child 共用同一份 content visual pass，避免兩條路各自漂移。
 */
import { Color, Label, Sprite, UIOpacity, UITransform } from 'cc';
import type { Node } from 'cc';
import type { GeneralDetailCrestState } from '../../../core/models/GeneralUnit';
import type { GeneralDetailRarityTier } from '../../../core/models/GeneralUnit';
import type { SpriteFrame } from 'cc';
import { applyUIRarityMarkToNodes } from '../../core/UIRarityMarkVisual';

type OverviewVisualPassPaths = {
    coreStatsCard: string;
    roleCard: string;
    traitCard: string;
    coreStatsTitleBandFill: string;
    roleTitleBandFill: string;
    traitTitleBandFill: string;
    bloodlineSummaryCard: string;
    bloodlineCrestCard: string;
    awakeningBarFill: string;
    awakeningBarTrack?: string;
    coreStatsTitle: string;
    roleTitle: string;
    traitTitle: string;
    headerName: string;
    headerTitle: string;
    headerMeta: string;
    coreStatsValue: string;
    roleValue: string;
    traitValue: string;
    bloodlineCardTitle?: string;
    bloodlineTitle?: string;
    bloodlineName: string;
    awakeningLabel: string;
    personalityLabel?: string;
    personalityValue: string;
    bloodlineBody: string;
    crestTitle: string;
    crestHint: string;
    crestStateLabel?: string;
    crestGlow?: string;
    crestFill?: string;
    crestCore?: string;
    crestFace?: string;
    crestGlyphPrimary?: string;
    crestGlyphSecondary?: string;
    rarityDock: string;
    rarityUnderlay: string;
    rarityBadge: string;
    rarityBadgeLabel: string;
};

type OverviewVisualPassOptions = {
    applyRarityMark?: boolean;
};

const RARITY_VISUAL_STATE: Record<GeneralDetailRarityTier, { accent: Color; soft: Color; title: Color }> = {
    common: {
        accent: new Color(125, 131, 138, 255),
        soft: new Color(186, 191, 198, 255),
        title: new Color(125, 131, 138, 255),
    },
    rare: {
        accent: new Color(74, 138, 211, 255),
        soft: new Color(173, 212, 245, 255),
        title: new Color(74, 138, 211, 255),
    },
    epic: {
        accent: new Color(138, 91, 214, 255),
        soft: new Color(209, 185, 255, 255),
        title: new Color(138, 91, 214, 255),
    },
    legendary: {
        accent: new Color(52, 98, 91, 255),
        soft: new Color(168, 214, 203, 255),
        title: new Color(208, 236, 227, 255),
    },
    mythic: {
        accent: new Color(255, 215, 0, 255),
        soft: new Color(255, 248, 180, 255),
        title: new Color(255, 215, 0, 255),
    },
};

const CREST_VISUAL_STATE: Record<GeneralDetailCrestState, { label: string; glow: number; fill: number; crest: number }> = {
    placeholder: { label: '命紋未定', glow: 4, fill: 14, crest: 12 },
    rumored: { label: '傳聞浮現', glow: 16, fill: 36, crest: 56 },
    revealed: { label: '命紋顯現', glow: 28, fill: 58, crest: 82 },
    awakened: { label: '命紋覺醒', glow: 40, fill: 84, crest: 108 },
};

// ── Ink palette ──
const strongInk = new Color(232, 216, 178, 255);
const softInk = new Color(215, 199, 162, 255);
const quietInk = new Color(211, 195, 157, 255);
const sectionInk = new Color(230, 215, 180, 255);
const bodyInk = new Color(237, 226, 200, 255);
const jadeInk = new Color(244, 229, 193, 255);

const UNIFIED_PATHS: OverviewVisualPassPaths = {
    coreStatsCard: 'OverviewSummaryModules/CoreStatsCard',
    roleCard: 'OverviewSummaryModules/RoleCard',
    traitCard: 'OverviewSummaryModules/TraitCard',
    coreStatsTitleBandFill: 'OverviewSummaryModules/CoreStatsCard/CoreStatsTitleBand/CoreStatsTitleBandFill',
    roleTitleBandFill: 'OverviewSummaryModules/RoleCard/RoleTitleBand/RoleTitleBandFill',
    traitTitleBandFill: 'OverviewSummaryModules/TraitCard/TraitTitleBand/TraitTitleBandFill',
    bloodlineSummaryCard: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineSummaryCard',
    bloodlineCrestCard: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineCrestCard',
    awakeningBarFill: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineSummaryCard/AwakeningProgressGroup/AwakeningBar',
    coreStatsTitle: 'OverviewSummaryModules/CoreStatsCard/CoreStatsTitleBand/CoreStatsTitle',
    roleTitle: 'OverviewSummaryModules/RoleCard/RoleTitleBand/RoleTitle',
    traitTitle: 'OverviewSummaryModules/TraitCard/TraitTitleBand/TraitTitle',
    headerName: 'HeaderRow/NameTitleColumn/NameLabel',
    headerTitle: 'HeaderRow/NameTitleColumn/TitleLabel',
    headerMeta: 'HeaderRow/MetaColumn/MetaLabel',
    coreStatsValue: 'OverviewSummaryModules/CoreStatsCard/CoreStatsValue',
    roleValue: 'OverviewSummaryModules/RoleCard/RoleValue',
    traitValue: 'OverviewSummaryModules/TraitCard/TraitValue',
    bloodlineName: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineSummaryCard/BloodlineName',
    awakeningLabel: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineSummaryCard/AwakeningProgressGroup/AwakeningLabel',
    personalityValue: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineSummaryCard/PersonalityValue',
    bloodlineBody: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineSummaryCard/BloodlineBody',
    crestTitle: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineCrestCard/CrestTitle',
    crestHint: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineCrestCard/CrestHint',
    rarityDock: 'HeaderRow/MetaColumn/RarityBadgeDock',
    rarityUnderlay: 'HeaderRow/MetaColumn/RarityBadgeDock/RarityOuterGlow',
    rarityBadge: 'HeaderRow/MetaColumn/RarityBadgeDock/RarityBadge',
    rarityBadgeLabel: 'HeaderRow/MetaColumn/RarityBadgeDock/RarityBadge/RarityBadgeLabel',
};

const SHELL_PATHS: OverviewVisualPassPaths = {
    coreStatsCard: 'InfoContent/OverviewSummaryModules/CoreStatsCard',
    roleCard: 'InfoContent/OverviewSummaryModules/RoleCard',
    traitCard: 'InfoContent/OverviewSummaryModules/TraitCard',
    coreStatsTitleBandFill: 'InfoContent/OverviewSummaryModules/CoreStatsCard/CoreStatsTitleBand/CoreStatsTitleBandFill',
    roleTitleBandFill: 'InfoContent/OverviewSummaryModules/RoleCard/RoleTitleBand/RoleTitleBandFill',
    traitTitleBandFill: 'InfoContent/OverviewSummaryModules/TraitCard/TraitTitleBand/TraitTitleBandFill',
    bloodlineSummaryCard: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineUnifiedCard/BloodlineSummaryCard',
    bloodlineCrestCard: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineUnifiedCard/BloodlineCrestCard',
    awakeningBarTrack: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineUnifiedCard/BloodlineSummaryCard/BloodlineSummaryFields/AwakeningProgressGroup/AwakeningBarTrack',
    awakeningBarFill: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineUnifiedCard/BloodlineSummaryCard/BloodlineSummaryFields/AwakeningProgressGroup/AwakeningBarTrack/AwakeningBarFill',
    coreStatsTitle: 'InfoContent/OverviewSummaryModules/CoreStatsCard/CoreStatsTitleBand/CoreStatsTitle',
    roleTitle: 'InfoContent/OverviewSummaryModules/RoleCard/RoleTitleBand/RoleTitle',
    traitTitle: 'InfoContent/OverviewSummaryModules/TraitCard/TraitTitleBand/TraitTitle',
    headerName: 'InfoContent/HeaderRow/NameTitleColumn/NameLabel',
    headerTitle: 'InfoContent/HeaderRow/NameTitleColumn/TitleLabel',
    headerMeta: 'InfoContent/HeaderRow/MetaColumn/MetaLabel',
    coreStatsValue: 'InfoContent/OverviewSummaryModules/CoreStatsCard/CoreStatsValue',
    roleValue: 'InfoContent/OverviewSummaryModules/RoleCard/RoleValue',
    traitValue: 'InfoContent/OverviewSummaryModules/TraitCard/TraitValue',
    bloodlineCardTitle: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineUnifiedCard/BloodlineCardTitle',
    bloodlineTitle: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineUnifiedCard/BloodlineSummaryCard/BloodlineSummaryFields/BloodlineTitle',
    bloodlineName: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineUnifiedCard/BloodlineSummaryCard/BloodlineSummaryFields/BloodlineName',
    awakeningLabel: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineUnifiedCard/BloodlineSummaryCard/BloodlineSummaryFields/AwakeningProgressGroup/AwakeningLabel',
    personalityLabel: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineUnifiedCard/BloodlineSummaryCard/BloodlineSummaryFields/PersonalityLabel',
    personalityValue: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineUnifiedCard/BloodlineSummaryCard/BloodlineSummaryFields/PersonalityValue',
    bloodlineBody: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineUnifiedCard/BloodlineSummaryCard/BloodlineBody',
    crestTitle: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineUnifiedCard/BloodlineCrestCard/CrestTitle',
    crestHint: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineUnifiedCard/BloodlineCrestCard/CrestHint',
    crestStateLabel: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineUnifiedCard/BloodlineCrestCard/BloodlineCrestCarrier/CrestStateLabel',
    crestGlow: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineUnifiedCard/BloodlineCrestCard/BloodlineCrestCarrier/BloodlineCrestGlow',
    crestFill: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineUnifiedCard/BloodlineCrestCard/BloodlineCrestCarrier/BloodlineCrestFill',
    crestCore: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineUnifiedCard/BloodlineCrestCard/BloodlineCrestCarrier/BloodlineCrest',
    crestFace: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineUnifiedCard/BloodlineCrestCard/BloodlineCrestCarrier/BloodlineCrestFace',
    crestGlyphPrimary: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineUnifiedCard/BloodlineCrestCard/BloodlineCrestCarrier/CrestGlyphPrimary',
    crestGlyphSecondary: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineUnifiedCard/BloodlineCrestCard/BloodlineCrestCarrier/CrestGlyphSecondary',
    rarityDock: 'InfoContent/HeaderRow/MetaColumn/RarityBadgeDock',
    rarityUnderlay: 'InfoContent/HeaderRow/MetaColumn/RarityBadgeDock/RarityBadgeUnderlay',
    rarityBadge: 'InfoContent/HeaderRow/MetaColumn/RarityBadgeDock/RarityBadge',
    rarityBadgeLabel: 'InfoContent/HeaderRow/MetaColumn/RarityBadgeDock/RarityBadge/RarityBadgeLabel',
};

/**
 * 將 Shell 的完整 visual pass 套用到 Unified Overview fragment 的節點樹上。
 *
 * @param contentSlot - ContentSlot 節點（其下掛有 OverviewTabContent）
 * @param tier - 目前武將的 rarityTier
 */
export function applyOverviewVisualPass(contentSlot: Node, tier: GeneralDetailRarityTier): void {
    const root = contentSlot.getChildByName('OverviewTabContent');
    if (!root) return;

    applyOverviewVisualPassToRoot(root, tier, UNIFIED_PATHS, { applyRarityMark: true });
}

export function applyShellOverviewContentVisualPass(shellRoot: Node, tier: GeneralDetailRarityTier): void {
    applyOverviewVisualPassToRoot(shellRoot, tier, SHELL_PATHS, { applyRarityMark: false });
}

export function applyOverviewAwakeningProgress(contentSlot: Node, progress: number): void {
    const root = contentSlot.getChildByName('OverviewTabContent');
    if (!root) return;

    _applyAwakeningProgressToRoot(root, progress, UNIFIED_PATHS.awakeningBarFill);
}

export function applyShellOverviewAwakeningProgress(shellRoot: Node, progress: number): void {
    _applyAwakeningProgressToRoot(shellRoot, progress, SHELL_PATHS.awakeningBarFill);
}

export function applyShellOverviewCrestState(shellRoot: Node, state: GeneralDetailCrestState): void {
    _applyCrestStateToRoot(shellRoot, state, SHELL_PATHS);
}

export function applyShellOverviewEmptyCrestFace(shellRoot: Node): void {
    _applyCrestFaceToRoot(shellRoot, null, SHELL_PATHS);
}

export function applyShellOverviewLoadedCrestFace(shellRoot: Node, spriteFrame: SpriteFrame): void {
    _applyCrestFaceToRoot(shellRoot, spriteFrame, SHELL_PATHS);
}

export function applyShellOverviewFallbackCrestFace(shellRoot: Node): void {
    if (SHELL_PATHS.crestFace) {
        _setNodeActive(shellRoot, SHELL_PATHS.crestFace, false);
    }
    if (SHELL_PATHS.crestFill) {
        _setNodeOpacity(shellRoot, SHELL_PATHS.crestFill, 110);
    }
    if (SHELL_PATHS.crestCore) {
        _setNodeOpacity(shellRoot, SHELL_PATHS.crestCore, 124);
    }
    if (SHELL_PATHS.crestGlyphPrimary) {
        _setNodeActive(shellRoot, SHELL_PATHS.crestGlyphPrimary, true);
    }
    if (SHELL_PATHS.crestGlyphSecondary) {
        _setNodeActive(shellRoot, SHELL_PATHS.crestGlyphSecondary, true);
    }
}

function applyOverviewVisualPassToRoot(
    root: Node,
    tier: GeneralDetailRarityTier,
    paths: OverviewVisualPassPaths,
    options?: OverviewVisualPassOptions,
): void {
    const visual = RARITY_VISUAL_STATE[tier] ?? RARITY_VISUAL_STATE.common;

    // ── 三欄資訊卡底板 ──
    _setSpriteColor(root, paths.coreStatsCard, new Color(251, 247, 239, 255));
    _setSpriteColor(root, paths.roleCard, new Color(247, 248, 243, 255));
    _setSpriteColor(root, paths.traitCard, new Color(250, 246, 239, 255));
    _setNodeOpacity(root, paths.coreStatsCard, 252);
    _setNodeOpacity(root, paths.roleCard, 248);
    _setNodeOpacity(root, paths.traitCard, 252);

    // Title band fills
    _setSpriteColor(root, paths.coreStatsTitleBandFill, new Color(240, 228, 204, 255));
    _setSpriteColor(root, paths.roleTitleBandFill, new Color(228, 234, 222, 255));
    _setSpriteColor(root, paths.traitTitleBandFill, new Color(239, 230, 210, 255));
    _setNodeOpacity(root, paths.coreStatsTitleBandFill, 224);
    _setNodeOpacity(root, paths.roleTitleBandFill, 214);
    _setNodeOpacity(root, paths.traitTitleBandFill, 220);

    // ── 血脈摘要卡底板 ──
    _setSpriteColor(root, paths.bloodlineSummaryCard, new Color(252, 248, 241, 255));
    _setSpriteColor(root, paths.bloodlineCrestCard, new Color(247, 247, 241, 255));
    _setNodeOpacity(root, paths.bloodlineSummaryCard, 252);
    _setNodeOpacity(root, paths.bloodlineCrestCard, 252);

    // ── 覺醒進度條 ──
    if (paths.awakeningBarTrack) {
        _setSpriteColor(root, paths.awakeningBarTrack, new Color(76, 68, 58, 255));
        _setNodeOpacity(root, paths.awakeningBarTrack, 142);
    }
    const awakeningBarFill = root.getChildByPath(paths.awakeningBarFill);
    if (awakeningBarFill) {
        const barSprite = awakeningBarFill.getComponent(Sprite);
        if (barSprite) {
            const color = visual.accent.clone();
            color.a = 224;
            barSprite.color = color;
            const barOpacity = awakeningBarFill.getComponent(UIOpacity);
            if (barOpacity) {
                barOpacity.opacity = 255;
            }
        } else {
            const barOpacity = awakeningBarFill.getComponent(UIOpacity) || awakeningBarFill.addComponent(UIOpacity);
            barOpacity.opacity = 224;
        }
    }

    // ── Section 標題 labels（墨綠金色系）──
    _setLabelColor(root, paths.coreStatsTitle, sectionInk);
    _setLabelColor(root, paths.roleTitle, sectionInk);
    _setLabelColor(root, paths.traitTitle, sectionInk);
    if (paths.bloodlineCardTitle) {
        _setLabelColor(root, paths.bloodlineCardTitle, sectionInk);
    }

    // ── Header labels ──
    _setLabelColor(root, paths.headerName, strongInk);
    _setLabelColor(root, paths.headerTitle, quietInk);
    _setLabelColor(root, paths.headerMeta, quietInk);

    // ── 數值文字 ──
    _setLabelColor(root, paths.coreStatsValue, bodyInk);
    _setLabelColor(root, paths.roleValue, bodyInk);
    _setLabelColor(root, paths.traitValue, bodyInk);

    // ── 血脈區 labels ──
    if (paths.bloodlineTitle) {
        _setLabelColor(root, paths.bloodlineTitle, quietInk);
    }
    _setLabelColor(root, paths.bloodlineName, strongInk);
    _setLabelColor(root, paths.awakeningLabel, quietInk);
    if (paths.personalityLabel) {
        _setLabelColor(root, paths.personalityLabel, quietInk);
    }
    _setLabelColor(root, paths.personalityValue, bodyInk);
    _setLabelColor(root, paths.bloodlineBody, bodyInk);

    // ── Crest 卡 labels ──
    _setLabelColor(root, paths.crestTitle, jadeInk);
    _setLabelColor(root, paths.crestHint, bodyInk);
    if (paths.crestStateLabel) {
        _setLabelColor(root, paths.crestStateLabel, new Color(154, 132, 92, 255));
    }
    _setLabelColor(root, paths.rarityBadgeLabel, new Color(246, 239, 225, 255));

    // ── Rarity badge mark ──
    if (options?.applyRarityMark !== false) {
        applyUIRarityMarkToNodes(tier, {
            dockNode: root.getChildByPath(paths.rarityDock) ?? null,
            underlayNode: root.getChildByPath(paths.rarityUnderlay) ?? null,
            badgeNode: root.getChildByPath(paths.rarityBadge) ?? null,
            labelNode: root.getChildByPath(paths.rarityBadgeLabel) ?? null,
        });
    }
}

// ── Helpers ──

function _setSpriteColor(root: Node, path: string, color: Color): void {
    const node = root.getChildByPath(path);
    if (!node) return;
    const sprite = node.getComponent(Sprite);
    if (!sprite) return;
    sprite.color = color.clone();
    _refreshRenderable(sprite);
}

function _setNodeOpacity(root: Node, path: string, opacityValue: number): void {
    const node = root.getChildByPath(path);
    if (!node) return;
    const clampedOpacity = Math.max(0, Math.min(255, opacityValue));
    const sprite = node.getComponent(Sprite);
    if (sprite) {
        const color = sprite.color.clone();
        color.a = clampedOpacity;
        sprite.color = color;
        _refreshRenderable(sprite);

        const opacity = node.getComponent(UIOpacity);
        if (opacity) {
            opacity.opacity = 255;
        }
        return;
    }

    const opacity = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
    opacity.opacity = clampedOpacity;
}

function _setLabelColor(root: Node, path: string, color: Color): void {
    const node = root.getChildByPath(path);
    if (!node) return;
    const label = node.getComponent(Label);
    if (!label) return;
    label.color = color.clone();
    _refreshRenderable(label);
}

function _setLabelText(root: Node, path: string, text: string): void {
    const node = root.getChildByPath(path);
    if (!node) return;
    const label = node.getComponent(Label);
    if (!label) return;
    label.string = text;
    _refreshRenderable(label);
}

function _setNodeActive(root: Node, path: string, active: boolean): void {
    const node = root.getChildByPath(path);
    if (!node) return;
    node.active = active;
}

function _applyAwakeningProgressToRoot(root: Node, progress: number, fillPath: string): void {
    const fillNode = root.getChildByPath(fillPath);
    if (!fillNode) return;

    const fillTransform = fillNode.getComponent(UITransform);
    const trackWidth = fillNode.parent?.getComponent(UITransform)?.width ?? 0;
    if (!fillTransform || trackWidth <= 0) return;

    const clampedRatio = Math.max(0.06, Math.min(1, progress));
    fillTransform.setAnchorPoint(0, 0.5);
    fillTransform.width = Math.max(18, Math.floor(trackWidth * clampedRatio));
}

function _applyCrestStateToRoot(root: Node, state: GeneralDetailCrestState, paths: OverviewVisualPassPaths): void {
    const visual = CREST_VISUAL_STATE[state] ?? CREST_VISUAL_STATE.placeholder;

    if (paths.crestStateLabel) {
        _setLabelText(root, paths.crestStateLabel, visual.label);
    }
    if (paths.crestGlow) {
        _setNodeOpacity(root, paths.crestGlow, visual.glow);
    }
    if (paths.crestFill) {
        _setNodeOpacity(root, paths.crestFill, visual.fill);
    }
    if (paths.crestCore) {
        _setNodeOpacity(root, paths.crestCore, visual.crest);
    }
}

function _applyCrestFaceToRoot(root: Node, spriteFrame: SpriteFrame | null, paths: OverviewVisualPassPaths): void {
    if (!paths.crestFace) return;

    const faceNode = root.getChildByPath(paths.crestFace);
    if (!faceNode) return;

    const faceSprite = faceNode.getComponent(Sprite) || faceNode.addComponent(Sprite);
    faceSprite.spriteFrame = spriteFrame;
    faceSprite.type = Sprite.Type.SIMPLE;
    faceSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    faceSprite.color = Color.WHITE.clone();
    _refreshRenderable(faceSprite);

    const faceTransform = faceNode.getComponent(UITransform) || faceNode.addComponent(UITransform);
    const carrierTransform = faceNode.parent?.getComponent(UITransform) || null;
    if (carrierTransform) {
        const size = Math.max(120, Math.min(carrierTransform.width, carrierTransform.height) * 0.76);
        faceTransform.setContentSize(size, size);
    }

    faceNode.setPosition(0, 2);
    faceNode.active = true;
    _setNodeOpacity(root, paths.crestFace, 255);

    if (paths.crestGlyphPrimary) {
        _setNodeActive(root, paths.crestGlyphPrimary, false);
    }
    if (paths.crestGlyphSecondary) {
        _setNodeActive(root, paths.crestGlyphSecondary, false);
    }
}

function _refreshRenderable(component: unknown): void {
    const renderable = component as {
        markForUpdateRenderData?: (enable?: boolean) => void;
        updateRenderData?: (force?: boolean) => void;
    };

    renderable.markForUpdateRenderData?.(true);
    renderable.updateRenderData?.(true);
}
