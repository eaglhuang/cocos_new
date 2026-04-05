// @spec-source → 見 docs/cross-reference-index.md
/**
 * ResultPopup — 戰鬥結果彈出層
 *
 * ⭐ 已遷移至 Template + Binder 架構
 *
 * 佈局由 result-popup-main.json，皮膚由 result-popup-default.json。
 * 節點綁定由 UITemplateBinder 自動完成，元件只負責業務邏輯。
 *
 * Unity 對照：PopupController + Animator（狀態機:win/lose/draw）
 */
import { _decorator, Label, Node } from 'cc';
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';
import { UISpecLoader } from '../core/UISpecLoader';
import { UITemplateBinder } from '../core/UITemplateBinder';
import { services } from '../../core/managers/ServiceLoader';

const { ccclass } = _decorator;

/** 戰鬥結果類型 */
export type BattleResult = 'player-win' | 'enemy-win' | 'draw';

/** 各結果的顯示設定 */
const RESULT_CONFIG: Record<BattleResult, {
    titleI18nKey: string;
    descText: string;
    cardSkinSlot: string;
}> = {
    'player-win': {
        titleI18nKey: 'ui.result.victory',
        descText: '我方成功擊敗敵軍，取得大勝！',
        cardSkinSlot: 'popup.card.win',
    },
    'enemy-win': {
        titleI18nKey: 'ui.result.defeat',
        descText: '敵方突破防線，再接再厲！',
        cardSkinSlot: 'popup.card.lose',
    },
    'draw': {
        titleI18nKey: 'ui.result.draw',
        descText: '雙方勢均力敵，不分勝負。',
        cardSkinSlot: 'popup.card.bg',
    },
};

@ccclass('ResultPopup')
export class ResultPopup extends UIPreviewBuilder {

    private get _specLoader() { return services().specLoader; }
    private _initialized = false;
    private _binder: UITemplateBinder | null = null;

    // ── 生命週期 ─────────────────────────────────────────────

    async onLoad(): Promise<void> {
        this.node.active = false;
        await this._initialize();
    }

    private async _initialize(): Promise<void> {
        if (this._initialized) return;

        try {
            // 載入三層規格 + i18n
            const [fullScreen, i18n] = await Promise.all([
                this._specLoader.loadFullScreen('result-popup-screen'),
                this._specLoader.loadI18n(services().i18n.currentLocale),
            ]);

            // 建構節點樹
            await this.buildScreen(fullScreen.layout, fullScreen.skin, i18n);
            this._initialized = true;
        } catch (e) {
            console.warn('[ResultPopup] 規格載入失敗，退回白模模式', e);
            // 白模 fallback：仍然可以顯示文字
            this._initialized = true;
        }
    }

    // ── 覆寫建構點 ───────────────────────────────────────────

    protected onReady(binder: UITemplateBinder): void {
        this._binder = binder;
        binder.getButton('btnBack')?.node.on('click', this._onClickBack, this);
        binder.getButton('btnReplay')?.node.on('click', this._onClickReplay, this);
    }

    // ── 公開 API ─────────────────────────────────────────────

    public async showResult(result: BattleResult): Promise<void> {
        if (!this._initialized) {
            await this._initialize();
        }

        const config = RESULT_CONFIG[result];

        if (this._binder) {
            this._binder.setTexts({
                TitleLabel: this.t(config.titleI18nKey),
                DescLabel:  config.descText,
            });
        }

        await this._switchCardSkin(config.cardSkinSlot);

        if (this.node.parent) {
            this.node.setSiblingIndex(this.node.parent.children.length - 1);
        }

        this.node.active = true;
        this.playEnterTransition(this.node);
    }

    // ── 私有方法 ─────────────────────────────────────────────

    private async _switchCardSkin(skinSlot: string): Promise<void> {
        const cardNode = this._binder?.getNode('Card') ?? this.node.getChildByName('Card');
        if (!cardNode) return;

        try {
            const frame = await this.skinResolver.getSpriteFrame(skinSlot);
            if (frame) {
                const { Sprite } = await import('cc');
                const sprite = cardNode.getComponent(Sprite) ?? cardNode.addComponent(Sprite);
                sprite.spriteFrame = frame;
                sprite.type = Sprite.Type.SLICED;
                sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            }
        } catch {
            // fallback：保留現有背景
        }
    }

    // ── 按鈕回呼 ─────────────────────────────────────────────

    private _onClickBack(): void {
        this.playExitTransition(this.node, undefined, () => {
            this.node.active = false;
            this.node.emit('back');
        });
    }

    private _onClickReplay(): void {
        this.playExitTransition(this.node, undefined, () => {
            this.node.active = false;
            this.node.emit('replay');
        });
    }

    public resetState(): void {
        this._binder?.setTexts({ TitleLabel: '', DescLabel: '' });
    }
}
