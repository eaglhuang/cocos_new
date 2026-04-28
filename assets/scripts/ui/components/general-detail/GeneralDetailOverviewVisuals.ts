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
import type { UISkinResolver } from '../../core/UISkinResolver';
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
    coreStatsTitleEn?: string;
    roleTitle: string;
    roleTitleEn?: string;
    traitTitle: string;
    traitTitleEn?: string;
    headerName: string;
    headerTitle: string;
    headerMeta: string;
    coreStatsValue: string;
    roleValue: string;
    traitValue: string;
    bloodlineCardTitle?: string;
    bloodlineCardTitleEn?: string;
    bloodlineTitle?: string;
    bloodlineName: string;
    awakeningLabel: string;
    personalityLabel?: string;
    personalityValue: string;
    bloodlineBody: string;
    crestTitle: string;
    crestHint: string;
    crestStateLabel?: string;
    biographyTitle?: string;
    biographyEnLabel?: string;
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

const CREST_VISUAL_STATE: Record<GeneralDetailCrestState, { label: string; glow: number; fill: number; crest: number }> = {
    placeholder: { label: '命紋未定', glow: 4, fill: 14, crest: 12 },
    rumored: { label: '傳聞浮現', glow: 16, fill: 36, crest: 56 },
    revealed: { label: '命紋顯現', glow: 28, fill: 58, crest: 82 },
    awakened: { label: '命紋覺醒', glow: 40, fill: 84, crest: 108 },
};

// ── Ink palette ──
const INK_TOKENS = {
    strong: 'gdv3LabelName',
    quiet: 'gdv3LabelMeta',
    section: 'gdv3LabelSection',
    body: 'gdv3LabelValue',
    jade: 'gdv3LabelMode',
    muted: 'textMuted',
    badge: 'textPrimary',
} as const;

type OverviewColorSet = {
    panelBorder: Color;
    titlePrimary: Color;
    titleSecondary: Color;
    meta: Color;
    sectionGold: Color;
    body: Color;
    teal: Color;
    tealBright: Color;
    badgeGold: Color;
    badgeText: Color;
};

function resolveOverviewColors(skinResolver: UISkinResolver): OverviewColorSet {
    return {
        panelBorder: skinResolver.resolveColor('outline'),
        titlePrimary: skinResolver.resolveColor('stdLabelButton'),
        titleSecondary: skinResolver.resolveColor('textMuted'),
        meta: skinResolver.resolveColor('textOnParchmentMuted'),
        sectionGold: skinResolver.resolveColor('accent.jade.crest'),
        body: skinResolver.resolveColor('textSecondary'),
        teal: skinResolver.resolveColor('accent.jade.base'),
        tealBright: skinResolver.resolveColor('accent.jade.crest'),
        badgeGold: skinResolver.resolveColor('accentGold'),
        badgeText: skinResolver.resolveColor('textOnParchment'),
    };
}

const RARITY_BADGE_TEXT: Record<GeneralDetailRarityTier, string> = {
    common: 'N',
    rare: 'R',
    epic: 'SSR',
    legendary: 'UR',
    mythic: 'UR',
};

const UNIFIED_PATHS: OverviewVisualPassPaths = {
    coreStatsCard: 'OverviewSummaryModules/CoreStatsCard',
    roleCard: 'OverviewSummaryModules/RoleCard',
    traitCard: 'OverviewSummaryModules/TraitCard',
    coreStatsTitleBandFill: 'OverviewSummaryModules/CoreStatsCard/CoreStatsTitleBand/CoreStatsTitleBandFill',
    roleTitleBandFill: 'OverviewSummaryModules/RoleCard/RoleTitleBand/RoleTitleBandFill',
    traitTitleBandFill: 'OverviewSummaryModules/TraitCard/TraitTitleBand/TraitTitleBandFill',
    bloodlineSummaryCard: 'BloodlineOverviewModules',
    bloodlineCrestCard: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineCrestCard',
    awakeningBarTrack: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineSummaryCard/AwakeningProgressGroup/AwakeningBarTrack',
    awakeningBarFill: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineSummaryCard/AwakeningProgressGroup/AwakeningBarTrack/AwakeningBarFill',
    coreStatsTitle: 'OverviewSummaryModules/CoreStatsCard/CoreStatsTitleBand/CoreStatsTitle',
    coreStatsTitleEn: 'OverviewSummaryModules/CoreStatsCard/CoreStatsTitleBand/CoreStatsTitleEn',
    roleTitle: 'OverviewSummaryModules/RoleCard/RoleTitleBand/RoleTitle',
    roleTitleEn: 'OverviewSummaryModules/RoleCard/RoleTitleBand/RoleTitleEn',
    traitTitle: 'OverviewSummaryModules/TraitCard/TraitTitleBand/TraitTitle',
    traitTitleEn: 'OverviewSummaryModules/TraitCard/TraitTitleBand/TraitTitleEn',
    headerName: 'HeaderRow/NameTitleColumn/NameTitleRow/NameLabel',
    headerTitle: 'HeaderRow/NameTitleColumn/NameTitleRow/TitleLabel',
    headerMeta: 'HeaderRow/NameTitleColumn/MetaLabel',
    coreStatsValue: 'OverviewSummaryModules/CoreStatsCard/CoreStatsValue',
    roleValue: 'OverviewSummaryModules/RoleCard/RoleValue',
    traitValue: 'OverviewSummaryModules/TraitCard/TraitValue',
    bloodlineName: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineSummaryCard/BloodlineName',
    awakeningLabel: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineSummaryCard/AwakeningProgressGroup/AwakeningLabel',
    personalityValue: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineSummaryCard/PersonalityValue',
    bloodlineBody: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineSummaryCard/BloodlineBody',
    crestTitle: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineCrestCard/CrestTitle',
    crestHint: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineCrestCard/CrestHint',
    crestStateLabel: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/CrestStateLabel',
    crestGlow: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/BloodlineCrestGlow',
    crestFill: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/BloodlineCrestFill',
    crestCore: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/BloodlineCrest',
    crestFace: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/BloodlineCrestFace',
    crestGlyphPrimary: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/CrestGlyphPrimary',
    crestGlyphSecondary: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/CrestGlyphSecondary',
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
    bloodlineSummaryCard: 'InfoContent/BloodlineOverviewModules',
    bloodlineCrestCard: 'InfoContent/BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineCrestCard',
    awakeningBarTrack: 'InfoContent/BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineSummaryCard/AwakeningProgressGroup/AwakeningBarTrack',
    awakeningBarFill: 'InfoContent/BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineSummaryCard/AwakeningProgressGroup/AwakeningBarTrack/AwakeningBarFill',
    coreStatsTitle: 'InfoContent/OverviewSummaryModules/CoreStatsCard/CoreStatsTitleBand/CoreStatsTitle',
    coreStatsTitleEn: 'InfoContent/OverviewSummaryModules/CoreStatsCard/CoreStatsTitleBand/CoreStatsTitleEn',
    roleTitle: 'InfoContent/OverviewSummaryModules/RoleCard/RoleTitleBand/RoleTitle',
    roleTitleEn: 'InfoContent/OverviewSummaryModules/RoleCard/RoleTitleBand/RoleTitleEn',
    traitTitle: 'InfoContent/OverviewSummaryModules/TraitCard/TraitTitleBand/TraitTitle',
    traitTitleEn: 'InfoContent/OverviewSummaryModules/TraitCard/TraitTitleBand/TraitTitleEn',
    headerName: 'InfoContent/HeaderRow/NameTitleColumn/NameTitleRow/NameLabel',
    headerTitle: 'InfoContent/HeaderRow/NameTitleColumn/NameTitleRow/TitleLabel',
    headerMeta: 'InfoContent/HeaderRow/NameTitleColumn/MetaLabel',
    coreStatsValue: 'InfoContent/OverviewSummaryModules/CoreStatsCard/CoreStatsValue',
    roleValue: 'InfoContent/OverviewSummaryModules/RoleCard/RoleValue',
    traitValue: 'InfoContent/OverviewSummaryModules/TraitCard/TraitValue',
    bloodlineCardTitle: 'InfoContent/BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineCardTitle',
    bloodlineCardTitleEn: 'InfoContent/BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineCardTitleEn',
    bloodlineTitle: 'InfoContent/BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineSummaryCard/BloodlineSummaryFields/BloodlineTitle',
    bloodlineName: 'InfoContent/BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineSummaryCard/BloodlineSummaryFields/BloodlineName',
    awakeningLabel: 'InfoContent/BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineSummaryCard/BloodlineSummaryFields/AwakeningProgressGroup/AwakeningLabel',
    personalityLabel: 'InfoContent/BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineSummaryCard/BloodlineSummaryFields/PersonalityLabel',
    personalityValue: 'InfoContent/BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineSummaryCard/BloodlineSummaryFields/PersonalityValue',
    bloodlineBody: 'InfoContent/BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineSummaryCard/BloodlineBody',
    crestTitle: 'InfoContent/BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineCrestCard/CrestTitle',
    crestHint: 'InfoContent/BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineCrestCard/CrestHint',
    crestStateLabel: 'InfoContent/BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/CrestStateLabel',
    biographyTitle: 'InfoContent/BiographyPanel/BiographyHeader/BiographyTitle',
    biographyEnLabel: 'InfoContent/BiographyPanel/BiographyHeader/BiographyEnLabel',
    crestGlow: 'InfoContent/BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/BloodlineCrestGlow',
    crestFill: 'InfoContent/BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/BloodlineCrestFill',
    crestCore: 'InfoContent/BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/BloodlineCrest',
    crestFace: 'InfoContent/BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/BloodlineCrestFace',
    crestGlyphPrimary: 'InfoContent/BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/CrestGlyphPrimary',
    crestGlyphSecondary: 'InfoContent/BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/CrestGlyphSecondary',
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
export function applyOverviewVisualPass(contentSlot: Node, tier: GeneralDetailRarityTier, skinResolver: UISkinResolver): void {
    const root = contentSlot.getChildByName('OverviewTabContent');
    if (!root) return;

    applyOverviewVisualPassToRoot(root, tier, UNIFIED_PATHS, skinResolver, { applyRarityMark: false });
}

export function applyShellOverviewContentVisualPass(shellRoot: Node, tier: GeneralDetailRarityTier, skinResolver: UISkinResolver): void {
    applyOverviewVisualPassToRoot(shellRoot, tier, SHELL_PATHS, skinResolver, { applyRarityMark: false });
}

export function applyOverviewAwakeningProgress(contentSlot: Node, progress: number): void {
    const root = contentSlot.getChildByName('OverviewTabContent');
    if (!root) return;

    _applyAwakeningProgressToRoot(root, progress, UNIFIED_PATHS.awakeningBarFill);
}

export function applyOverviewCrestState(contentSlot: Node, state: GeneralDetailCrestState): void {
    const root = contentSlot.getChildByName('OverviewTabContent');
    if (!root) return;

    _applyCrestStateToRoot(root, state, UNIFIED_PATHS);
}

export function applyOverviewEmptyCrestFace(contentSlot: Node): void {
    const root = contentSlot.getChildByName('OverviewTabContent');
    if (!root) return;

    _applyCrestFaceToRoot(root, null, UNIFIED_PATHS);
}

export function applyOverviewLoadedCrestFace(contentSlot: Node, spriteFrame: SpriteFrame): void {
    const root = contentSlot.getChildByName('OverviewTabContent');
    if (!root) return;

    _applyCrestFaceToRoot(root, spriteFrame, UNIFIED_PATHS);
}

export function applyOverviewFallbackCrestFace(contentSlot: Node): void {
    const root = contentSlot.getChildByName('OverviewTabContent');
    if (!root) return;

    if (UNIFIED_PATHS.crestFace) {
        _setNodeActive(root, UNIFIED_PATHS.crestFace, false);
    }
    if (UNIFIED_PATHS.crestFill) {
        _setNodeOpacity(root, UNIFIED_PATHS.crestFill, 110);
    }
    if (UNIFIED_PATHS.crestCore) {
        _setNodeOpacity(root, UNIFIED_PATHS.crestCore, 124);
    }
    if (UNIFIED_PATHS.crestGlyphPrimary) {
        _setNodeActive(root, UNIFIED_PATHS.crestGlyphPrimary, true);
    }
    if (UNIFIED_PATHS.crestGlyphSecondary) {
        _setNodeActive(root, UNIFIED_PATHS.crestGlyphSecondary, true);
    }
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
    skinResolver: UISkinResolver,
    options?: OverviewVisualPassOptions,
): void {
    const colors = resolveOverviewColors(skinResolver);

    // ── 三欄資訊卡底板 ──
    _setSpriteColor(root, paths.coreStatsCard, colors.panelBorder);
    _setSpriteColor(root, paths.roleCard, colors.panelBorder);
    _setSpriteColor(root, paths.traitCard, colors.panelBorder);
    _setNodeOpacity(root, paths.coreStatsCard, 255);
    _setNodeOpacity(root, paths.roleCard, 255);
    _setNodeOpacity(root, paths.traitCard, 255);

    // Title band fills
    _setSpriteColor(root, paths.coreStatsTitleBandFill, colors.panelBorder);
    _setSpriteColor(root, paths.roleTitleBandFill, colors.panelBorder);
    _setSpriteColor(root, paths.traitTitleBandFill, colors.panelBorder);
    _setNodeOpacity(root, paths.coreStatsTitleBandFill, 0);
    _setNodeOpacity(root, paths.roleTitleBandFill, 0);
    _setNodeOpacity(root, paths.traitTitleBandFill, 0);

    // ── 血脈摘要卡底板 ──
    _setSpriteColor(root, paths.bloodlineSummaryCard, colors.teal);
    _setSpriteColor(root, paths.bloodlineCrestCard, colors.teal);
    _setNodeOpacity(root, paths.bloodlineSummaryCard, 255);
    _setNodeOpacity(root, paths.bloodlineCrestCard, 255);

    // ── 覺醒進度條 ──
    if (paths.awakeningBarTrack) {
        _setSpriteColor(root, paths.awakeningBarTrack, colors.panelBorder);
        _setNodeOpacity(root, paths.awakeningBarTrack, 142);
    }
    const awakeningBarFill = root.getChildByPath(paths.awakeningBarFill);
    if (awakeningBarFill) {
        const barSprite = awakeningBarFill.getComponent(Sprite);
        if (barSprite) {
            const color = colors.teal.clone();
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
    _setLabelColor(root, paths.coreStatsTitle, colors.tealBright);
    if (paths.coreStatsTitleEn) {
        _setLabelColor(root, paths.coreStatsTitleEn, colors.meta);
    }
    _setLabelColor(root, paths.roleTitle, colors.tealBright);
    if (paths.roleTitleEn) {
        _setLabelColor(root, paths.roleTitleEn, colors.meta);
    }
    _setLabelColor(root, paths.traitTitle, colors.tealBright);
    if (paths.traitTitleEn) {
        _setLabelColor(root, paths.traitTitleEn, colors.meta);
    }
    if (paths.bloodlineCardTitle) {
        _setLabelColor(root, paths.bloodlineCardTitle, colors.tealBright);
    }
    if (paths.bloodlineCardTitleEn) {
        _setLabelColor(root, paths.bloodlineCardTitleEn, colors.meta);
    }

    // ── Header labels ──
    _setLabelColor(root, paths.headerName, colors.titlePrimary);
    _setLabelColor(root, paths.headerTitle, colors.titleSecondary);
    _setLabelColor(root, paths.headerMeta, colors.meta);

    // ── 數值文字 ──
    _setLabelColor(root, paths.coreStatsValue, colors.body);
    _setLabelColor(root, paths.roleValue, colors.body);
    _setLabelColor(root, paths.traitValue, colors.body);
    _setNodeOpacity(root, paths.coreStatsValue, 0);
    _setNodeOpacity(root, paths.roleValue, 0);
    _setNodeOpacity(root, paths.traitValue, 0);

    // ── 血脈區 labels ──
    if (paths.bloodlineTitle) {
        _setLabelColor(root, paths.bloodlineTitle, colors.teal);
    }
    _setLabelColor(root, paths.bloodlineName, colors.tealBright);
    _setLabelColor(root, paths.awakeningLabel, colors.teal);
    if (paths.personalityLabel) {
        _setLabelColor(root, paths.personalityLabel, colors.teal);
    }
    _setLabelColor(root, paths.personalityValue, colors.body);
    _setLabelColor(root, paths.bloodlineBody, colors.body);

    // ── Crest 卡 labels ──
    _setLabelColor(root, paths.crestTitle, colors.teal);
    _setLabelColor(root, paths.crestHint, colors.body);
    if (paths.crestStateLabel) {
        _setLabelColor(root, paths.crestStateLabel, colors.meta);
    }
    if (paths.biographyTitle) {
        _setLabelColor(root, paths.biographyTitle, colors.sectionGold);
    }
    if (paths.biographyEnLabel) {
        _setLabelColor(root, paths.biographyEnLabel, colors.meta);
    }
    _setLabelText(root, paths.rarityBadgeLabel, RARITY_BADGE_TEXT[tier] ?? 'R');
    _setLabelColor(root, paths.rarityBadgeLabel, colors.badgeText);
    _setSpriteColor(root, paths.rarityBadge, colors.badgeGold);
    _setNodeOpacity(root, paths.rarityBadge, 255);
    _setNodeOpacity(root, paths.rarityUnderlay, 0);

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
