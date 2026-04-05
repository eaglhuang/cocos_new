import { _decorator, Color, Label, Node, Sprite, SpriteFrame, Texture2D, UITransform, resources } from 'cc';
import type { GeneralConfig } from '../../core/models/GeneralUnit';
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';
import { UISpecLoader } from '../core/UISpecLoader';
import { buildGeneralDetailOverview } from './GeneralDetailOverviewMapper';
import { services } from '../../core/managers/ServiceLoader';

const { ccclass } = _decorator;

const BODY_COLOR = new Color(34, 46, 42, 255);
const META_COLOR = new Color(76, 99, 93, 255);
const NOTE_COLOR = new Color(53, 83, 78, 255);

@ccclass('GeneralDetailOverviewShell')
export class GeneralDetailOverviewShell extends UIPreviewBuilder {
    private get _specLoader() { return services().specLoader; }
    private _isBuilt = false;

    public async show(config: GeneralConfig): Promise<void> {
        this.node.active = true;

        if (!this._isBuilt) {
            this._destroyBuiltChildren();

            const { layout, skin } = await this._specLoader.loadFullScreen('general-detail-bloodline-v3-screen');
            const i18n = await this._specLoader.loadI18n('zh-TW');
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

        this._mountCardCopy('InfoContent/TopSummaryRow/CoreStatsCard', 'CoreStatsValue', overview.cards.coreStatsSummary, 24, BODY_COLOR);
        this._mountCardCopy('InfoContent/TopSummaryRow/RoleCard', 'RoleValue', overview.cards.roleSummary, 26, BODY_COLOR);
        this._mountCardCopy('InfoContent/TopSummaryRow/TraitCard', 'TraitValue', overview.cards.traitSummary, 22, NOTE_COLOR);

        this._setLabel('InfoContent/BloodlineSummaryFields/BloodlineTitle', overview.cards.bloodlineTitle);
        this._setLabel('InfoContent/BloodlineSummaryFields/BloodlineName', overview.cards.bloodlineName);
        this._setLabel('InfoContent/BloodlineSummaryFields/AwakeningLabel', `覺醒：${overview.cards.awakeningLabel}`);
        this._setLabel('InfoContent/BloodlineSummaryFields/PersonalityLabel', '血脈性格');
        this._setLabel('InfoContent/BloodlineSummaryFields/PersonalityValue', overview.cards.personalityValue);

        this._mountCardCopy('InfoContent/BloodlineRow/BloodlineSummaryCard', 'BloodlineBody', [
            `父母：${config.parentsSummary ?? '尚未公開'}`,
            `祖譜：${config.ancestorsSummary ?? '待展開 14 人矩陣'}`,
            `EP：${overview.summary.epValue}`,
        ].join('\n'), 20, META_COLOR, { top: 26, left: 22, right: 22, bottom: 22 });

        this._mountCardCopy('InfoContent/BloodlineRow/BloodlineCrestCard', 'CrestHint', '命紋靈獸 / 祖紋命篆預留區', 20, META_COLOR, {
            top: 24,
            left: 24,
            right: 24,
            bottom: 24,
        });

        overview.cards.storyBeats.forEach((beat, index) => {
            this._mountCardCopy(`StoryStrip/StoryCell0${index + 1}`, 'StoryText', beat, 18, BODY_COLOR, {
                top: 16,
                left: 12,
                right: 12,
                bottom: 12,
            });
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

    private _mountCardCopy(
        path: string,
        name: string,
        text: string,
        fontSize: number,
        color: Color,
        inset: { top: number; left: number; right: number; bottom: number } = { top: 18, left: 18, right: 18, bottom: 18 },
    ): void {
        const host = this._getNode(path);
        if (!host) return;

        let labelNode = host.getChildByName(name);
        if (!labelNode) {
            labelNode = new Node(name);
            labelNode.parent = host;
            labelNode.layer = host.layer;
        }

        const hostTransform = host.getComponent(UITransform);
        const transform = labelNode.getComponent(UITransform) || labelNode.addComponent(UITransform);
        const width = Math.max(20, (hostTransform?.width ?? 320) - inset.left - inset.right);
        const height = Math.max(20, (hostTransform?.height ?? 120) - inset.top - inset.bottom);

        transform.setAnchorPoint(0, 1);
        transform.setContentSize(width, height);
        labelNode.setPosition(-((hostTransform?.width ?? width) / 2) + inset.left, ((hostTransform?.height ?? height) / 2) - inset.top, 0);

        const label = labelNode.getComponent(Label) || labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 6;
        label.color = color;
        label.horizontalAlign = Label.HorizontalAlign.LEFT;
        label.verticalAlign = Label.VerticalAlign.TOP;
        label.overflow = Label.Overflow.SHRINK;
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
            sprite.color = Color.WHITE;
        } catch (error) {
            console.warn('[GeneralDetailOverviewShell] 載入立繪失敗', error);
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
