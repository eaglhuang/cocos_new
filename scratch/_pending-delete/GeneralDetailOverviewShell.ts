import { _decorator, Color, Label, Mask, Node, Sprite, SpriteFrame, Texture2D, UIOpacity, UITransform, resources } from 'cc';
import type { GeneralConfig } from '../../core/models/GeneralUnit';
import type { GeneralDetailCrestState } from '../../core/models/GeneralUnit';
import type { GeneralDetailRarityTier, GeneralDetailStorySlot } from '../../core/models/GeneralUnit';
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';
import { UIContentBinder } from '../core/UIContentBinder';
import { UITemplateBinder } from '../core/UITemplateBinder';
import type { UIScreenSpec } from '../core/UISpecTypes';
import { applyUIRarityMarkToNodes } from '../core/UIRarityMarkVisual';
import {
    buildGeneralDetailOverviewContentState,
    type GeneralDetailOverviewContentState,
} from './GeneralDetailOverviewMapper';
import { services } from '../../core/managers/ServiceLoader';

const { ccclass } = _decorator;

const GENERAL_DETAIL_DEBUG_HIDE_PATHS_KEY = 'GENERAL_DETAIL_OVERVIEW_HIDE_PATHS';

type LabelBinding = {
    path: string;
    text: string;
};

const CREST_VISUAL_STATE: Record<GeneralDetailCrestState, { label: string; glow: number; fill: number; crest: number; }> = {
    placeholder: { label: '命紋未定', glow: 4, fill: 14, crest: 12 },
    rumored: { label: '傳聞浮現', glow: 16, fill: 36, crest: 56 },
    revealed: { label: '命紋顯現', glow: 28, fill: 58, crest: 82 },
    awakened: { label: '命紋覺醒', glow: 40, fill: 84, crest: 108 },
};

const RARITY_VISUAL_STATE: Record<GeneralDetailRarityTier, { accent: Color; soft: Color; title: Color; }> = {
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

@ccclass('GeneralDetailOverviewShell')
export class GeneralDetailOverviewShell extends UIPreviewBuilder {
    private get _specLoader() { return services().specLoader; }
    private _isBuilt = false;
    private _binder: UITemplateBinder | null = null;
    private _screenSpec: UIScreenSpec | null = null;
    private readonly _contentBinder = new UIContentBinder();

    protected onReady(binder: UITemplateBinder): void {
        this._binder = binder;
    }

    public async show(config: GeneralConfig): Promise<void> {
        this.node.active = true;

        if (!this._isBuilt) {
            this._destroyBuiltChildren();

            const { screen, layout, skin } = await this._specLoader.loadFullScreen('general-detail-bloodline-v3-screen');
            const i18n = await this._specLoader.loadI18n(services().i18n.currentLocale);
            const tokens = await this._specLoader.loadDesignTokens();

            await this.buildScreen(layout, skin, i18n, tokens);
            this._screenSpec = screen;
            this._isBuilt = true;
        }

        await this._applyContentState(buildGeneralDetailOverviewContentState(config));
    }

    public async showContentState(content: GeneralDetailOverviewContentState): Promise<void> {
        this.node.active = true;

        if (!this._isBuilt) {
            this._destroyBuiltChildren();

            const { screen, layout, skin } = await this._specLoader.loadFullScreen('general-detail-bloodline-v3-screen');
            const i18n = await this._specLoader.loadI18n(services().i18n.currentLocale);
            const tokens = await this._specLoader.loadDesignTokens();

            await this.buildScreen(layout, skin, i18n, tokens);
            this._screenSpec = screen;
            this._isBuilt = true;
        }

        await this._applyContentState(content);
    }

    public hide(): void {
        this.node.active = false;
    }

    private async _applyContentState(content: GeneralDetailOverviewContentState): Promise<void> {
        const textBindings: LabelBinding[] = [
            { path: 'InfoContent/HeaderRow/NameTitleColumn/NameLabel', text: content.headerName },
            { path: 'InfoContent/HeaderRow/NameTitleColumn/TitleLabel', text: content.headerTitle },
            { path: 'InfoContent/HeaderRow/MetaColumn/MetaLabel', text: this._formatHeaderMeta(content.headerMeta) },
            { path: 'InfoContent/HeaderRow/MetaColumn/RarityBadgeDock/RarityBadge/RarityBadgeLabel', text: content.rarityLabel },
            { path: 'OverviewStateChrome/PortraitModeHint', text: content.portraitModeHint },
            { path: 'InfoContent/OverviewSummaryModules/CoreStatsCard/CoreStatsTitleBand/CoreStatsTitle', text: content.coreStatsTitle },
            { path: 'InfoContent/OverviewSummaryModules/CoreStatsCard/CoreStatsValue', text: content.coreStatsValue },
            { path: 'InfoContent/OverviewSummaryModules/RoleCard/RoleTitleBand/RoleTitle', text: content.roleTitle },
            { path: 'InfoContent/OverviewSummaryModules/RoleCard/RoleValue', text: content.roleValue },
            { path: 'InfoContent/OverviewSummaryModules/TraitCard/TraitTitleBand/TraitTitle', text: content.traitTitle },
            { path: 'InfoContent/OverviewSummaryModules/TraitCard/TraitValue', text: content.traitValue },
            { path: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineSummaryFields/BloodlineTitle', text: content.bloodlineTitle },
            { path: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineSummaryFields/BloodlineName', text: content.bloodlineName },
            { path: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineSummaryFields/AwakeningProgressGroup/AwakeningLabel', text: content.awakeningLabel },
            { path: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineSummaryFields/PersonalityLabel', text: content.personalityLabel },
            { path: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineSummaryFields/PersonalityValue', text: content.personalityValue },
            { path: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineCardTitle', text: content.bloodlineCardTitle },
            { path: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineBody', text: content.bloodlineBody },
            { path: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard/CrestTitle', text: content.crestTitle },
            { path: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard/CrestHint', text: content.crestHint },
            { path: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/CrestGlyphPrimary', text: content.crestGlyphPrimary },
            { path: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/CrestGlyphSecondary', text: content.crestGlyphSecondary },
        ];

        if (this._binder && this._screenSpec?.contentRequirements) {
            await this._contentBinder.bind(
                this._binder,
                this._screenSpec.contentRequirements,
                content as unknown as Record<string, unknown>,
                { suppressUnresolvedWarnings: true },
            );
        }

        this._applyLabels(textBindings);
        this._setAwakeningProgress(content.awakeningProgress);
        this._applyRarityBadgeVisual(content.rarityTier);
        this._applyRarityAccent(content.rarityTier);
        await this._applyCrestFace(content.crestFaceResource);
        this._applyCrestState(content.crestState);
        this._applyStoryCells(content.storyCells);
        await this._loadPortrait(content.portraitResource);
    }

    private _applyLabels(bindings: LabelBinding[]): void {
        for (const binding of bindings) {
            this._setLabel(binding.path, binding.text);
        }
    }

    private _formatHeaderMeta(raw: string): string {
        const parts = raw
            .split('|')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0)
            .map((entry) => {
                const lower = entry.toLowerCase();
                switch (lower) {
                case 'shu':
                    return '蜀';
                case 'wei':
                    return '魏';
                case 'wu':
                    return '吳';
                case 'neutral':
                    return '中立';
                case 'commander':
                    return '統帥';
                case 'support':
                    return '支援';
                default:
                    return entry;
                }
            });

        return parts.join(' · ');
    }

    private _setAwakeningProgress(progress: number): void {
        const fillNode = this._getNode('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineSummaryFields/AwakeningProgressGroup/AwakeningBarTrack/AwakeningBarFill');
        if (!fillNode) {
            return;
        }

        const transform = fillNode.getComponent(UITransform);
        if (!transform) {
            return;
        }

        const trackWidth = fillNode.parent?.getComponent(UITransform)?.width ?? 260;
        transform.setAnchorPoint(0, 0.5);
        transform.width = Math.max(18, Math.floor(trackWidth * progress));
    }

    private _applyCrestState(state: GeneralDetailCrestState): void {
        const visual = CREST_VISUAL_STATE[state] ?? CREST_VISUAL_STATE.placeholder;

        this._setLabel('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/CrestStateLabel', visual.label);
        this._setNodeOpacity('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/BloodlineCrestGlow', visual.glow);
        this._setNodeOpacity('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/BloodlineCrestFill', visual.fill);
        this._setNodeOpacity('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/BloodlineCrest', visual.crest);
    }

    private async _applyCrestFace(resourcePath?: string): Promise<void> {
        const faceNode = this._getNode('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/BloodlineCrestFace');
        const fillNode = this._getNode('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/BloodlineCrestFill');
        const crestNode = this._getNode('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/BloodlineCrest');
        const primaryNode = this._getNode('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/CrestGlyphPrimary');
        const secondaryNode = this._getNode('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/CrestGlyphSecondary');
        const crestFacePath = resourcePath?.trim();

        if (!faceNode) {
            return;
        }

        const sprite = faceNode.getComponent(Sprite) || faceNode.addComponent(Sprite);

        if (!crestFacePath) {
            sprite.type = Sprite.Type.SIMPLE;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.color = Color.WHITE.clone();
            const faceTransform = faceNode.getComponent(UITransform) || faceNode.addComponent(UITransform);
            const carrierTransform = faceNode.parent?.getComponent(UITransform) || null;
            if (carrierTransform) {
                const size = Math.max(120, Math.min(carrierTransform.width, carrierTransform.height) * 0.76);
                faceTransform.setContentSize(size, size);
            }
            faceNode.setPosition(0, 2);
            faceNode.active = true;
            this._setNodeOpacity('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/BloodlineCrestFace', 255);
            if (primaryNode) primaryNode.active = false;
            if (secondaryNode) secondaryNode.active = false;
            return;
        }

        try {
            let spriteFrame = await services().resource.loadSpriteFrame(crestFacePath).catch(() => null);
            if (!spriteFrame) {
                spriteFrame = await new Promise<SpriteFrame | null>((resolve) => {
                    resources.load(crestFacePath, Texture2D, (_err, tex) => {
                        if (!tex) {
                            resolve(null);
                            return;
                        }
                        const frame = new SpriteFrame();
                        frame.texture = tex;
                        resolve(frame);
                    });
                });
            }
            if (!spriteFrame && sprite.spriteFrame) {
                spriteFrame = sprite.spriteFrame;
            }
            if (!spriteFrame) {
                faceNode.active = false;
                if (fillNode) {
                    const opacity = fillNode.getComponent(UIOpacity) || fillNode.addComponent(UIOpacity);
                    opacity.opacity = 110;
                }
                if (crestNode) {
                    const opacity = crestNode.getComponent(UIOpacity) || crestNode.addComponent(UIOpacity);
                    opacity.opacity = 124;
                }
                if (primaryNode) primaryNode.active = true;
                if (secondaryNode) secondaryNode.active = true;
                return;
            }

            sprite.spriteFrame = spriteFrame;
            sprite.type = Sprite.Type.SIMPLE;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.color = Color.WHITE.clone();
            const faceTransform = faceNode.getComponent(UITransform) || faceNode.addComponent(UITransform);
            const carrierTransform = faceNode.parent?.getComponent(UITransform) || null;
            if (carrierTransform) {
                const size = Math.max(120, Math.min(carrierTransform.width, carrierTransform.height) * 0.76);
                faceTransform.setContentSize(size, size);
            }
            faceNode.setPosition(0, 2);
            faceNode.active = true;
            this._setNodeOpacity('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/BloodlineCrestFace', 255);
            if (primaryNode) primaryNode.active = false;
            if (secondaryNode) secondaryNode.active = false;
        } catch (error) {
            console.warn('[GeneralDetailOverviewShell] 載入命紋 medallion face 失敗', error);
            faceNode.active = false;
            if (fillNode) {
                const opacity = fillNode.getComponent(UIOpacity) || fillNode.addComponent(UIOpacity);
                opacity.opacity = 110;
            }
            if (crestNode) {
                const opacity = crestNode.getComponent(UIOpacity) || crestNode.addComponent(UIOpacity);
                opacity.opacity = 124;
            }
            if (primaryNode) primaryNode.active = true;
            if (secondaryNode) secondaryNode.active = true;
        }
    }

    private _applyRarityAccent(tier: GeneralDetailRarityTier): void {
        const visual = RARITY_VISUAL_STATE[tier] ?? RARITY_VISUAL_STATE.common;
        const strongInk = new Color(49, 37, 26, 255);
        const quietInk = new Color(122, 102, 76, 255);
        const sectionInk = new Color(78, 88, 64, 255);
        const bodyInk = new Color(68, 52, 36, 255);
        const jadeInk = new Color(84, 110, 92, 255);
        const storyFrame = new Color(148, 122, 80, 255);

        this._setSpriteColor('InfoCardChrome/InfoCardFill', new Color(252, 248, 241, 255));
        this._setNodeOpacity('InfoCardChrome/InfoCardFill', 246);
        this._setSpriteColor('InfoContent/HeaderUnderlay/HeaderUnderlayFill', new Color(241, 232, 214, 255));
        this._setNodeOpacity('InfoContent/HeaderUnderlay/HeaderUnderlayFill', 176);
        this._setNodeOpacity('InfoContent/HeaderRow/MetaColumn/RarityBadgeDock/RarityBadgeUnderlay', 182);
        this._setNodeOpacity('InfoContent/HeaderRow/MetaColumn/RarityBadgeDock/RarityBadge', 228);
        this._setSpriteColor('InfoContent/OverviewSummaryModules/CoreStatsCard', new Color(251, 247, 239, 255));
        this._setSpriteColor('InfoContent/OverviewSummaryModules/RoleCard', new Color(247, 248, 243, 255));
        this._setSpriteColor('InfoContent/OverviewSummaryModules/TraitCard', new Color(250, 246, 239, 255));
        this._setNodeOpacity('InfoContent/OverviewSummaryModules/CoreStatsCard', 252);
        this._setNodeOpacity('InfoContent/OverviewSummaryModules/RoleCard', 248);
        this._setNodeOpacity('InfoContent/OverviewSummaryModules/TraitCard', 252);
        this._setSpriteColor('InfoContent/OverviewSummaryModules/CoreStatsCard/CoreStatsTitleBand/CoreStatsTitleBandFill', new Color(240, 228, 204, 255));
        this._setSpriteColor('InfoContent/OverviewSummaryModules/RoleCard/RoleTitleBand/RoleTitleBandFill', new Color(228, 234, 222, 255));
        this._setSpriteColor('InfoContent/OverviewSummaryModules/TraitCard/TraitTitleBand/TraitTitleBandFill', new Color(239, 230, 210, 255));
        this._setNodeOpacity('InfoContent/OverviewSummaryModules/CoreStatsCard/CoreStatsTitleBand/CoreStatsTitleBandFill', 224);
        this._setNodeOpacity('InfoContent/OverviewSummaryModules/RoleCard/RoleTitleBand/RoleTitleBandFill', 214);
        this._setNodeOpacity('InfoContent/OverviewSummaryModules/TraitCard/TraitTitleBand/TraitTitleBandFill', 220);
        this._setSpriteColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard', new Color(252, 248, 241, 255));
        this._setSpriteColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard', new Color(247, 247, 241, 255));
        this._setNodeOpacity('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard', 252);
        this._setNodeOpacity('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard', 252);
        this._setSpriteColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineSummaryFields/AwakeningProgressGroup/AwakeningBarTrack', new Color(76, 68, 58, 255));
        this._setNodeOpacity('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineSummaryFields/AwakeningProgressGroup/AwakeningBarTrack', 142);
        this._setSpriteColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineSummaryFields/AwakeningProgressGroup/AwakeningBarTrack/AwakeningBarFill', visual.accent);
        this._setNodeOpacity('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineSummaryFields/AwakeningProgressGroup/AwakeningBarTrack/AwakeningBarFill', 224);
        this._setLabelColor('InfoContent/HeaderRow/NameTitleColumn/NameLabel', strongInk);
        this._setLabelColor('InfoContent/HeaderRow/NameTitleColumn/TitleLabel', quietInk);
        this._setLabelColor('InfoContent/HeaderRow/MetaColumn/MetaLabel', quietInk);
        this._setLabelColor('InfoContent/OverviewSummaryModules/CoreStatsCard/CoreStatsTitleBand/CoreStatsTitle', sectionInk);
        this._setLabelColor('InfoContent/OverviewSummaryModules/RoleCard/RoleTitleBand/RoleTitle', sectionInk);
        this._setLabelColor('InfoContent/OverviewSummaryModules/TraitCard/TraitTitleBand/TraitTitle', sectionInk);
        this._setLabelColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard/CrestTitle', jadeInk);
        this._setLabelColor('InfoContent/OverviewSummaryModules/CoreStatsCard/CoreStatsValue', bodyInk);
        this._setLabelColor('InfoContent/OverviewSummaryModules/RoleCard/RoleValue', bodyInk);
        this._setLabelColor('InfoContent/OverviewSummaryModules/TraitCard/TraitValue', bodyInk);
        this._setLabelColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineSummaryFields/BloodlineTitle', quietInk);
        this._setLabelColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineSummaryFields/BloodlineName', strongInk);
        this._setLabelColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineSummaryFields/AwakeningProgressGroup/AwakeningLabel', quietInk);
        this._setLabelColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineSummaryFields/PersonalityLabel', quietInk);
        this._setLabelColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineSummaryFields/PersonalityValue', bodyInk);
        this._setLabelColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineBody', bodyInk);
        this._setLabelColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard/CrestHint', bodyInk);
        this._setLabelColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/CrestStateLabel', new Color(154, 132, 92, 255));
        this._setLabelColor('InfoContent/HeaderRow/MetaColumn/RarityBadgeDock/RarityBadge/RarityBadgeLabel', new Color(246, 239, 225, 255));
        this._setSpriteColor('StoryStripRail/StoryStripFill', new Color(239, 231, 216, 255));
        this._setSpriteColor('StoryStripRail/StoryStripFrame', storyFrame);
        this._setNodeOpacity('StoryStripRail/StoryStripFill', 232);
        this._setNodeOpacity('StoryStripRail/StoryStripFrame', 112);
        this._setNodeOpacity('StoryStripArt', 162);
        this._setNodeOpacity('StoryStripRail/StoryStripBleed', 26);
        this._applyDebugHiddenPaths();
    }

    private async _loadPortrait(path: string): Promise<void> {
        const viewportNode = this._getNode('PortraitCarrier/PortraitViewport');
        const portraitNode = this._getNode('PortraitCarrier/PortraitViewport/PortraitImage');
        if (!viewportNode || !portraitNode) {
            return;
        }

        try {
            let spriteFrame = await services().resource.loadSpriteFrame(path).catch(() => null);
            if (!spriteFrame) {
                spriteFrame = await new Promise<SpriteFrame | null>((resolve) => {
                    resources.load(path, Texture2D, (_err, tex) => {
                        if (!tex) {
                            resolve(null);
                            return;
                        }
                        const frame = new SpriteFrame();
                        frame.texture = tex;
                        resolve(frame);
                    });
                });
            }

            const mask = viewportNode.getComponent(Mask);
            if (mask) {
                mask.enabled = false;
            }

            const sprite = portraitNode.getComponent(Sprite) || portraitNode.addComponent(Sprite);
            if (!spriteFrame) {
                sprite.spriteFrame = null;
                portraitNode.active = false;
                console.warn(`[GeneralDetailOverviewShell] 找不到武將立繪: ${path}`);
                return;
            }

            portraitNode.active = true;
            sprite.spriteFrame = spriteFrame;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.color = new Color(255, 255, 255, 255);

            const viewportTransform = viewportNode.getComponent(UITransform);
            const portraitTransform = portraitNode.getComponent(UITransform) || portraitNode.addComponent(UITransform);
            if (!viewportTransform) {
                return;
            }

            const sourceSize = spriteFrame.originalSize;
            const sourceWidth = Math.max(1, sourceSize.width);
            const sourceHeight = Math.max(1, sourceSize.height);
            const fitScale = Math.min(
                viewportTransform.width / sourceWidth,
                viewportTransform.height / sourceHeight,
            ) * 1.1;

            portraitTransform.setContentSize(
                Math.max(1, Math.floor(sourceWidth * fitScale)),
                Math.max(1, Math.floor(sourceHeight * fitScale)),
            );
            portraitNode.setPosition(0, -12);
        } catch (error) {
            console.warn('[GeneralDetailOverviewShell] 載入武將立繪失敗', error);
        }
    }

    private _applyRarityBadgeVisual(tier: GeneralDetailRarityTier): void {
        applyUIRarityMarkToNodes(tier, {
            dockNode: this._getNode('InfoContent/HeaderRow/MetaColumn/RarityBadgeDock'),
            underlayNode: this._getNode('InfoContent/HeaderRow/MetaColumn/RarityBadgeDock/RarityBadgeUnderlay'),
            badgeNode: this._getNode('InfoContent/HeaderRow/MetaColumn/RarityBadgeDock/RarityBadge'),
            labelNode: this._getNode('InfoContent/HeaderRow/MetaColumn/RarityBadgeDock/RarityBadge/RarityBadgeLabel'),
        });
    }

    private _applyStoryCells(storyCells: Record<GeneralDetailStorySlot, string>): void {
        const slotNodes: Array<[GeneralDetailStorySlot, string]> = [
            ['origin', 'StoryStrip/StoryCellOrigin/StoryCaption/StoryCaptionLabel'],
            ['faction', 'StoryStrip/StoryCellFaction/StoryCaption/StoryCaptionLabel'],
            ['role', 'StoryStrip/StoryCellRole/StoryCaption/StoryCaptionLabel'],
            ['awakening', 'StoryStrip/StoryCellAwakening/StoryCaption/StoryCaptionLabel'],
            ['bloodline', 'StoryStrip/StoryCellBloodline/StoryCaption/StoryCaptionLabel'],
            ['future', 'StoryStrip/StoryCellFuture/StoryCaption/StoryCaptionLabel'],
        ];

        for (const [slot, nodePath] of slotNodes) {
            this._setLabel(nodePath, storyCells[slot] ?? '');
        }
    }

    private _destroyBuiltChildren(): void {
        const children = [...this.node.children];
        for (const child of children) {
            child.destroy();
        }
    }

    private _getNode(path: string): Node | null {
        return this.node.getChildByPath(`GeneralDetailBloodlineRoot/${path}`);
    }

    private _setLabel(path: string, text: string): void {
        const node = this._getNode(path);
        if (!node) return;
        const label = node.getComponent(Label);
        if (label) {
            label.string = text;
        }
    }

    private _setNodeOpacity(path: string, opacityValue: number): void {
        const node = this._getNode(path);
        if (!node) {
            return;
        }
        const opacity = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
        opacity.opacity = Math.max(0, Math.min(255, opacityValue));
    }

    private _setSpriteColor(path: string, color: Color): void {
        const node = this._getNode(path);
        if (!node) {
            return;
        }
        const sprite = node.getComponent(Sprite);
        if (!sprite) {
            return;
        }
        sprite.color = color.clone();
    }

    private _setLabelColor(path: string, color: Color): void {
        const node = this._getNode(path);
        if (!node) {
            return;
        }
        const label = node.getComponent(Label);
        if (!label) {
            return;
        }
        label.color = color.clone();
    }

    private _applyDebugHiddenPaths(): void {
        const globalScope = globalThis as Record<string, unknown> & { localStorage?: Storage };
        const raw = globalScope.localStorage?.getItem?.(GENERAL_DETAIL_DEBUG_HIDE_PATHS_KEY) ?? '';
        if (!raw) {
            return;
        }

        const paths = raw
            .split(',')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0);

        for (const path of paths) {
            const node = this._getNode(path);
            if (!node) {
                continue;
            }
            node.active = false;
            const opacity = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
            opacity.opacity = 0;
        }
    }
}