import { _decorator, Label, Node, Sprite, SpriteFrame, Texture2D, UITransform, resources } from 'cc';
import type { GeneralConfig } from '../../core/models/GeneralUnit';
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';
import { UITemplateBinder } from '../core/UITemplateBinder';
import { buildGeneralDetailOverview } from './GeneralDetailOverviewMapper';
import { services } from '../../core/managers/ServiceLoader';

const { ccclass } = _decorator;

type LabelBinding = {
    path: string;
    text: string;
};

@ccclass('GeneralDetailOverviewShell')
export class GeneralDetailOverviewShell extends UIPreviewBuilder {
    private get _specLoader() { return services().specLoader; }
    private _isBuilt = false;

    protected onReady(_binder: UITemplateBinder): void {
        // 目前仍沿用 _setLabel / _getNode；等 Binder 批次 API 穩定後可再轉為 binder.setTexts(...)
    }

    public async show(config: GeneralConfig): Promise<void> {
        this.node.active = true;

        if (!this._isBuilt) {
            this._destroyBuiltChildren();

            const { layout, skin } = await this._specLoader.loadFullScreen('general-detail-bloodline-v3-screen');
            const i18n = await this._specLoader.loadI18n(services().i18n.currentLocale);
            const tokens = await this._specLoader.loadDesignTokens();

            await this.buildScreen(layout, skin, i18n, tokens);
            this._isBuilt = true;
        }

        this._populateUI(config);
    }

    public hide(): void {
        this.node.active = false;
    }

    private _populateUI(config: GeneralConfig): void {
        const overview = buildGeneralDetailOverview(config);

        this._applyLabels([
            { path: 'InfoContent/HeaderRow/NameLabel', text: overview.header.name },
            { path: 'InfoContent/HeaderRow/TitleLabel', text: overview.header.title },
            { path: 'InfoContent/HeaderRow/MetaColumn/RarityLabel', text: overview.header.meta },
            { path: 'OverviewStateChrome/PortraitModeHint', text: '點擊切換血脈面 / 故事層' },
            { path: 'InfoContent/HeaderRow/MetaColumn/OverviewModeBadge/OverviewModeBadgeLabel', text: '日常總覽' },
            { path: 'InfoContent/OverviewSummaryModules/CoreStatsCard/CoreStatsTitle', text: '核心能力' },
            { path: 'InfoContent/OverviewSummaryModules/CoreStatsCard/CoreStatsValue', text: overview.cards.coreStatsSummary },
            { path: 'InfoContent/OverviewSummaryModules/RoleCard/RoleTitle', text: '角色定位' },
            { path: 'InfoContent/OverviewSummaryModules/RoleCard/RoleValue', text: overview.cards.roleSummary },
            { path: 'InfoContent/OverviewSummaryModules/TraitCard/TraitTitle', text: '氣質與性格' },
            { path: 'InfoContent/OverviewSummaryModules/TraitCard/TraitValue', text: overview.cards.traitSummary },
            { path: 'InfoContent/BloodlineOverviewModules/BloodlineSummaryFields/BloodlineTitle', text: overview.cards.bloodlineTitle },
            { path: 'InfoContent/BloodlineOverviewModules/BloodlineSummaryFields/BloodlineName', text: overview.cards.bloodlineName },
            { path: 'InfoContent/BloodlineOverviewModules/BloodlineSummaryFields/AwakeningProgressGroup/AwakeningLabel', text: `覺醒：${overview.cards.awakeningLabel}` },
            { path: 'InfoContent/BloodlineOverviewModules/BloodlineSummaryFields/PersonalityLabel', text: '血脈性格' },
            { path: 'InfoContent/BloodlineOverviewModules/BloodlineSummaryFields/PersonalityValue', text: overview.cards.personalityValue },
            { path: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineCardTitle', text: '血脈摘要' },
            { path: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineSummaryCard/BloodlineBody', text: overview.cards.bloodlineBody },
            { path: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard/CrestTitle', text: overview.cards.crestTitle },
            { path: 'InfoContent/BloodlineOverviewModules/BloodlineRow/BloodlineCrestCard/CrestHint', text: overview.cards.crestHint },
        ]);

        this._applyStoryCells(overview.cards.storyCells);
        this._setAwakeningProgress(overview.cards.awakeningProgress);

        const resId = config.id.replace(/-/g, '_');
        const portraitPath = `sprites/generals/${resId}_portrait`;
        this._loadPortrait(portraitPath);
    }

    private _applyStoryCells(storyCells: Array<{ slot: string; text: string }>): void {
        const slotToPath: Record<string, string> = {
            origin: 'StoryStrip/StoryCellOrigin/StoryText',
            faction: 'StoryStrip/StoryCellFaction/StoryText',
            role: 'StoryStrip/StoryCellRole/StoryText',
            awakening: 'StoryStrip/StoryCellAwakening/StoryText',
            bloodline: 'StoryStrip/StoryCellBloodline/StoryText',
            future: 'StoryStrip/StoryCellFuture/StoryText',
        };

        const bindings: LabelBinding[] = storyCells
            .map((cell) => ({
                path: slotToPath[cell.slot],
                text: cell.text,
            }))
            .filter((binding) => Boolean(binding.path));

        this._applyLabels(bindings);
    }

    private _applyLabels(bindings: LabelBinding[]): void {
        for (const binding of bindings) {
            this._setLabel(binding.path, binding.text);
        }
    }

    private _setAwakeningProgress(progress: number): void {
        const fillNode = this._getNode('InfoContent/BloodlineOverviewModules/BloodlineSummaryFields/AwakeningProgressGroup/AwakeningBarTrack/AwakeningBarFill');
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

    private async _loadPortrait(path: string): Promise<void> {
        const portraitNode = this._getNode('PortraitImage');
        if (!portraitNode) return;

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

            const sprite = portraitNode.getComponent(Sprite) || portraitNode.addComponent(Sprite);
            sprite.spriteFrame = spriteFrame;
            sprite.sizeMode = Sprite.SizeMode.RAW;
        } catch (error) {
            console.warn('[GeneralDetailOverviewShell] 載入武將立繪失敗', error);
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
}
