import { _decorator, Color, Label, Mask, Node, Sprite, SpriteFrame, Texture2D, UIOpacity, UITransform, resources } from 'cc';
import type { GeneralConfig } from '../../core/models/GeneralUnit';
import type { GeneralDetailCrestState } from '../../core/models/GeneralUnit';
import type { GeneralDetailRarityTier, GeneralDetailStorySlot } from '../../core/models/GeneralUnit';
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';
import { UIContentBinder } from '../core/UIContentBinder';
import { UITemplateBinder } from '../core/UITemplateBinder';
import type { UIScreenSpec } from '../core/UISpecTypes';
import {
    buildGeneralDetailOverviewContentState,
    type GeneralDetailOverviewContentState,
} from './GeneralDetailOverviewMapper';
import { services } from '../../core/managers/ServiceLoader';

const { ccclass } = _decorator;

type LabelBinding = {
    path: string;
    text: string;
};

const CREST_VISUAL_STATE: Record<GeneralDetailCrestState, { label: string; glow: number; fill: number; crest: number; }> = {
    placeholder: { label: '命紋未定', glow: 8, fill: 20, crest: 18 },
    rumored: { label: '傳聞浮現', glow: 28, fill: 52, crest: 72 },
    revealed: { label: '命紋顯現', glow: 50, fill: 82, crest: 102 },
    awakened: { label: '命紋覺醒', glow: 70, fill: 110, crest: 132 },
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

const RARITY_ART_PATH: Record<GeneralDetailRarityTier, { badge: string; portraitFrame: string; }> = {
    common: {
        badge: 'sprites/ui_families/general_detail/v3_final/badge_family_common_v5',
        portraitFrame: 'sprites/ui_families/common/item_cell/border_common',
    },
    rare: {
        badge: 'sprites/ui_families/general_detail/v3_final/badge_family_rare_v5',
        portraitFrame: 'sprites/ui_families/common/item_cell/border_rare',
    },
    epic: {
        badge: 'sprites/ui_families/general_detail/v3_final/badge_family_epic_v5',
        portraitFrame: 'sprites/ui_families/common/item_cell/border_epic',
    },
    legendary: {
        badge: 'sprites/ui_families/general_detail/v3_final/badge_family_legendary_v5',
        portraitFrame: 'sprites/ui_families/common/item_cell/border_legendary',
    },
    mythic: {
        badge: 'sprites/ui_families/general_detail/v3_final/badge_family_mythic_v5',
        portraitFrame: 'sprites/ui_families/common/item_cell/border_mythic',
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
            { path: 'InfoContent/HeaderRow/MetaColumn/MetaLabel', text: content.headerMeta },
            { path: 'InfoContent/HeaderRow/MetaColumn/RarityBadge/RarityBadgeLabel', text: content.rarityLabel },
            { path: 'OverviewStateChrome/PortraitModeHint', text: content.portraitModeHint },
            { path: 'InfoContent/HeaderRow/MetaColumn/OverviewModeBadge/OverviewModeBadgeLabel', text: content.overviewModeBadgeLabel },
            { path: 'InfoContent/OverviewSummaryModules/CoreStatsCard/CoreStatsTitle', text: content.coreStatsTitle },
            { path: 'InfoContent/OverviewSummaryModules/CoreStatsCard/CoreStatsValue', text: content.coreStatsValue },
            { path: 'InfoContent/OverviewSummaryModules/RoleCard/RoleTitle', text: content.roleTitle },
            { path: 'InfoContent/OverviewSummaryModules/RoleCard/RoleValue', text: content.roleValue },
            { path: 'InfoContent/OverviewSummaryModules/TraitCard/TraitTitle', text: content.traitTitle },
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
            );
        }

        // 直接 path 補寫，避免 contract/schema 波動時整片文字消失。
        this._applyLabels(textBindings);

        this._setAwakeningProgress(content.awakeningProgress);
        await this._applyDynamicRarityArtwork(content.rarityTier);
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

    private _setAwakeningProgress(progress: number): void {
        const fillNode = this._getNode('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineSummaryFields/AwakeningProgressGroup/AwakeningBarTrack/AwakeningBarFill');
        if (!fillNode) {
            return;
        }

        const transform = fillNode.getComponent(UITransform);
        if (!transform) {
            return;
        }

        transform.setAnchorPoint(0, 0.5);
        transform.width = Math.max(24, Math.floor(260 * progress));
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
                const size = Math.max(112, Math.min(carrierTransform.width, carrierTransform.height) * 0.72);
                faceTransform.setContentSize(size, size);
            }
            faceNode.setPosition(0, 4);
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
                const size = Math.max(112, Math.min(carrierTransform.width, carrierTransform.height) * 0.72);
                faceTransform.setContentSize(size, size);
            }
            faceNode.setPosition(0, 4);
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

        // ── Header 牌匾：深醬棕玉牌系，讓名字在厚重底色上凸顯 ──
        // fill：米白偏暖，接近宣紙質地
        const headerFill = new Color(236, 228, 210, 255);
        const headerBand = new Color(86, 118, 98, 255);
        const headerEdge = new Color(146, 126, 82, 255);

        // ── Crest 命紋：回到 pale jade + parchment，避免右下角退回深綠裝備面板語言 ──
        const crestGlow  = new Color(188, 212, 200, 255);
        const crestFill  = new Color(214, 226, 216, 255);
        const crestInner = new Color(182, 198, 186, 255);
        const crestFrame = new Color(188, 160, 108, 255);

        // Header Chrome 顏色（完整路徑）
        this._setSpriteColor('InfoCardHeaderChrome/InfoCardAccentFill', headerFill);
        this._setSpriteColor('InfoCardHeaderChrome/InfoCardAccentBand', headerBand);
        this._setSpriteColor('InfoCardHeaderChrome/InfoCardAccentFrame', headerEdge);
        this._setSpriteColor('InfoCardHeaderChrome/InfoCardAccentCapLeft', new Color(172, 150, 96, 255));
        this._setSpriteColor('InfoCardHeaderChrome/InfoCardAccentCapRight', new Color(172, 150, 96, 255));

        // 主卡底色：略深的米黃，和 header 形成明確層次差
        this._setSpriteColor('InfoCardChrome/InfoCardFill', new Color(222, 212, 188, 255));
        this._setSpriteColor('InfoCardChrome/InfoCardFrame', new Color(126, 100, 64, 255));

        this._setSpriteColor('PortraitCarrier/PortraitFrameBase', new Color(60, 56, 48, 255));
        this._setSpriteColor('PortraitCarrier/PortraitBackdrop', new Color(84, 80, 70, 255));
        this._setSpriteColor('PortraitCarrier/PortraitInnerPlate', new Color(110, 104, 92, 255));
        this._setSpriteColor('PortraitCarrier/PortraitGlow', new Color(126, 110, 82, 255));

        // Badge 系列
        this._setSpriteColor('InfoContent/HeaderRow/MetaColumn/RarityBadge', visual.soft);
        this._setSpriteColor('InfoContent/HeaderRow/MetaColumn/OverviewModeBadge', new Color(228, 219, 194, 255));

        // 三欄資訊卡：交替冷暖底色，增加視覺節奏
        this._setSpriteColor('InfoContent/OverviewSummaryModules/CoreStatsCard', new Color(236, 229, 212, 255));
        this._setSpriteColor('InfoContent/OverviewSummaryModules/RoleCard', new Color(228, 232, 220, 255));
        this._setSpriteColor('InfoContent/OverviewSummaryModules/TraitCard', new Color(241, 229, 208, 255));

        // 血脈摘要卡：維持 parchment 承載，crest 卡只做偏 jade 的閱讀變體
        this._setSpriteColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard', new Color(226, 226, 214, 255));
        this._setSpriteColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard', new Color(228, 232, 224, 255));

        // 覺醒進度條
        this._setSpriteColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineSummaryFields/AwakeningProgressGroup/AwakeningBarTrack/AwakeningBarFill', visual.accent);

        // Crest 命紋層次
        this._setSpriteColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/BloodlineCrestInnerRing', crestInner);
        this._setSpriteColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/BloodlineCrestGlow', crestGlow);
        this._setSpriteColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/BloodlineCrestFill', crestFill);
        this._setSpriteColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/BloodlineCrest', new Color(136, 160, 146, 255));
        this._setSpriteColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/BloodlineCrestFrame', crestFrame);

        // ── Labels ──
        // 姓名：拉亮到 parchment 白金，避免被 jade header 吃掉
        this._setLabelColor('InfoContent/HeaderRow/NameTitleColumn/NameLabel', new Color(248, 241, 222, 255));
        // 封號與 meta：維持暖棕，但略亮於 band
        this._setLabelColor('InfoContent/HeaderRow/NameTitleColumn/TitleLabel', new Color(214, 198, 154, 255));
        this._setLabelColor('InfoContent/HeaderRow/MetaColumn/MetaLabel', new Color(178, 158, 116, 255));
        this._setLabelColor('InfoContent/HeaderRow/MetaColumn/OverviewModeBadge/OverviewModeBadgeLabel', new Color(88, 72, 50, 255));

        // Section 標題：墨綠金色系
        this._setLabelColor('InfoContent/OverviewSummaryModules/CoreStatsCard/CoreStatsTitle', new Color(78, 108, 88, 255));
        this._setLabelColor('InfoContent/OverviewSummaryModules/RoleCard/RoleTitle', new Color(78, 108, 88, 255));
        this._setLabelColor('InfoContent/OverviewSummaryModules/TraitCard/TraitTitle', new Color(78, 108, 88, 255));
        this._setLabelColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineCardTitle', new Color(78, 108, 88, 255));
        // Crest 卡改回淺底後，標題回到 jade 墨綠
        this._setLabelColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard/CrestTitle', new Color(92, 122, 102, 255));

        // 數值文字
        this._setLabelColor('InfoContent/OverviewSummaryModules/CoreStatsCard/CoreStatsValue', new Color(48, 40, 28, 255));
        this._setLabelColor('InfoContent/OverviewSummaryModules/RoleCard/RoleValue', new Color(48, 40, 28, 255));
        this._setLabelColor('InfoContent/OverviewSummaryModules/TraitCard/TraitValue', new Color(48, 40, 28, 255));

        // 血脈區 labels（淺色底）
        this._setLabelColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineSummaryFields/BloodlineTitle', new Color(120, 102, 72, 255));
        this._setLabelColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineSummaryFields/BloodlineName', new Color(44, 38, 28, 255));
        this._setLabelColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineSummaryFields/AwakeningProgressGroup/AwakeningLabel', new Color(120, 102, 72, 255));
        this._setLabelColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineSummaryFields/PersonalityLabel', new Color(120, 102, 72, 255));
        this._setLabelColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineSummaryFields/PersonalityValue', new Color(66, 58, 44, 255));
        this._setLabelColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineBody', new Color(58, 50, 38, 255));

        // Crest 卡改回淺底後，說明與狀態字也回到可讀的暖棕／暖金
        this._setLabelColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard/CrestHint', new Color(128, 104, 68, 255));
        this._setLabelColor('InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard/BloodlineCrestCarrier/CrestStateLabel', new Color(176, 150, 102, 255));

        // Rarity badge 文字
        this._setLabelColor('InfoContent/HeaderRow/MetaColumn/RarityBadge/RarityBadgeLabel', new Color(255, 252, 230, 255));
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

            if (!spriteFrame) {
                return;
            }

            const mask = viewportNode.getComponent(Mask) || viewportNode.addComponent(Mask);
            mask.type = Mask.Type.GRAPHICS_RECT;

            const sprite = portraitNode.getComponent(Sprite) || portraitNode.addComponent(Sprite);
            sprite.spriteFrame = spriteFrame;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.color = new Color(255, 252, 246, 255);

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
            ) * 1.22;  // 放大 fill 比，讓人物更充滿舞台

            portraitTransform.setContentSize(
                Math.max(1, Math.floor(sourceWidth * fitScale)),
                Math.max(1, Math.floor(sourceHeight * fitScale)),
            );
            portraitNode.setPosition(0, -32);  // 稍微上移，讓臉部更凸顯
        } catch (error) {
            console.warn('[GeneralDetailOverviewShell] 載入武將立繪失敗', error);
        }
    }

    private async _applyDynamicRarityArtwork(tier: GeneralDetailRarityTier): Promise<void> {
        const art = RARITY_ART_PATH[tier] ?? RARITY_ART_PATH.common;
        await Promise.all([
            this._setNodeSpriteFrame('InfoContent/HeaderRow/MetaColumn/RarityBadge', art.badge),
            // this._setNodeSpriteFrame('PortraitCarrier/PortraitRarityFrame', art.portraitFrame), // 註解掉：拔除不合理的粗糙裝備框，改用暗景托底
        ]);
    }

    private _applyStoryCells(storeCells: Record<GeneralDetailStorySlot, string>): void {
        const SLOT_NODES: Array<[GeneralDetailStorySlot, string]> = [
            ['origin',    'StoryStrip/StoryCellOrigin'],
            ['faction',   'StoryStrip/StoryCellFaction'],
            ['role',      'StoryStrip/StoryCellRole'],
            ['awakening', 'StoryStrip/StoryCellAwakening'],
            ['bloodline', 'StoryStrip/StoryCellBloodline'],
            ['future',    'StoryStrip/StoryCellFuture'],
        ];

        for (const [slot, nodePath] of SLOT_NODES) {
            const cellNode = this._getNode(nodePath);
            if (!cellNode) continue;

            // 找或建立子 Label 節點
            let labelNode = cellNode.getChildByName('CellText');
            if (!labelNode) {
                labelNode = new Node('CellText');
                cellNode.addChild(labelNode);
            }

            let label = labelNode.getComponent(Label);
            if (!label) {
                label = labelNode.addComponent(Label);
                label.overflow = Label.Overflow.SHRINK;
                label.enableWrapText = true;
                label.lineHeight = 22;
                label.fontSize = 18;
                // 細白 + 淡金色，在深底上可見
                label.color = new Color(230, 218, 182, 255);
            }

            const transform = labelNode.getComponent(UITransform) || labelNode.addComponent(UITransform);
            const cellTransform = cellNode.getComponent(UITransform);
            if (cellTransform) {
                transform.setContentSize(cellTransform.width, cellTransform.height);
            }

            label.string = storeCells[slot] ?? '';
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

    private async _setNodeSpriteFrame(path: string, resourcePath: string): Promise<void> {
        const node = this._getNode(path);
        if (!node) {
            return;
        }

        const sprite = node.getComponent(Sprite);
        if (!sprite) {
            return;
        }

        try {
            const spriteFrame = await services().resource.loadSpriteFrame(resourcePath).catch(() => null);
            if (!spriteFrame) {
                return;
            }

            sprite.spriteFrame = spriteFrame;
            sprite.type = Sprite.Type.SIMPLE;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.color = Color.WHITE.clone();
        } catch (error) {
            console.warn('[GeneralDetailOverviewShell] 載入動態稀有度資產失敗', error);
        }
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
}
