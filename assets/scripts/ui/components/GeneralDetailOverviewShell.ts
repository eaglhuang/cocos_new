import { _decorator, Label, Node, Sprite, SpriteFrame, Texture2D, UITransform, resources } from 'cc';
import type { GeneralConfig } from '../../core/models/GeneralUnit';
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';
import { buildGeneralDetailOverview } from './GeneralDetailOverviewMapper';
import { services } from '../../core/managers/ServiceLoader';

const { ccclass } = _decorator;

@ccclass('GeneralDetailOverviewShell')
export class GeneralDetailOverviewShell extends UIPreviewBuilder {
    private get _specLoader() { return services().specLoader; }
    private _isBuilt = false;

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

        this._setLabel('InfoContent/HeaderRow/NameLabel', overview.header.name);
        this._setLabel('InfoContent/HeaderRow/TitleLabel', overview.header.title);
        this._setLabel('InfoContent/HeaderRow/MetaColumn/RarityLabel', overview.header.meta);
        this._setLabel('UnownedPortraitHint', '點擊切換血脈面 / 故事層');

        this._setLabel('InfoContent/TopSummaryRow/CoreStatsCard/CoreStatsTitle', '核心能力');
        this._setLabel('InfoContent/TopSummaryRow/CoreStatsCard/CoreStatsValue', overview.cards.coreStatsSummary);
        this._setLabel('InfoContent/TopSummaryRow/RoleCard/RoleTitle', '角色定位');
        this._setLabel('InfoContent/TopSummaryRow/RoleCard/RoleValue', overview.cards.roleSummary);
        this._setLabel('InfoContent/TopSummaryRow/TraitCard/TraitTitle', '氣質與性格');
        this._setLabel('InfoContent/TopSummaryRow/TraitCard/TraitValue', overview.cards.traitSummary);

        this._setLabel('InfoContent/BloodlineSummaryFields/BloodlineTitle', overview.cards.bloodlineTitle);
        this._setLabel('InfoContent/BloodlineSummaryFields/BloodlineName', overview.cards.bloodlineName);
        this._setLabel('InfoContent/BloodlineSummaryFields/AwakeningLabel', `覺醒：${overview.cards.awakeningLabel}`);
        this._setLabel('InfoContent/BloodlineSummaryFields/PersonalityLabel', '血脈性格');
        this._setLabel('InfoContent/BloodlineSummaryFields/PersonalityValue', overview.cards.personalityValue);

        this._setLabel('InfoContent/BloodlineRow/BloodlineSummaryCard/BloodlineCardTitle', '血脈摘要');
        this._setLabel('InfoContent/BloodlineRow/BloodlineSummaryCard/BloodlineBody', [
            `父脈：${config.parentsSummary ?? '尚待補完'}`,
            `祖譜：${config.ancestorsSummary ?? '已通過 A.I. 補完祖譜'}`,
            `EP：${overview.summary.epValue}`,
        ].join('\n'));

        this._setLabel('InfoContent/BloodlineRow/BloodlineCrestCard/CrestTitle', '命紋與因子');
        this._setLabel('InfoContent/BloodlineRow/BloodlineCrestCard/CrestHint', '命紋靈獸 / 祖紋命篆預留區');

        overview.cards.storyBeats.forEach((beat, index) => {
            this._setLabel(`StoryStrip/StoryCell0${index + 1}/StoryText`, beat);
        });

        const progressNode = this._getNode('InfoContent/BloodlineSummaryFields/AwakeningBar');
        const progressTransform = progressNode?.getComponent(UITransform);
        if (progressTransform) {
            progressTransform.width = Math.max(160, Math.floor(260 * overview.cards.awakeningProgress));
        }

        const resId = config.id.replace(/-/g, '_');
        const portraitPath = `sprites/generals/${resId}_portrait`;
        this._loadPortrait(portraitPath);
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
