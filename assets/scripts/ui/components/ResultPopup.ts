// @spec-source → 見 docs/cross-reference-index.md
/**
 * ResultPopup — 戰鬥結果彈出層（新架構版）
 *
 * ⭐ 已遷移至 UIPreviewBuilder 架構
 *
 * 繼承 UIPreviewBuilder，佈局由 result-popup-main.json 定義，
 * 皮膚由 result-popup-default.json 提供（三種卡片背景：預設/勝利/失敗）。
 *
 * 業務職責（保留於此）：
 *   - 依據戰果切換卡片背景（skinSlot）
 *   - 更新標題與描述文字
 *   - 發出 "replay" 事件
 *
 * 呼叫方式：
 *   const popup = services().ui.show<ResultPopup>(UIID.ResultPopup);
 *   await popup.showResult('player-win');
 *
 * Unity 對照：PopupController + Animator（狀態機:win/lose/draw）
 */
import { _decorator, Label, Node, Color } from 'cc';
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';
import { UISpecLoader } from '../core/UISpecLoader';
import { UISkinResolver } from '../core/UISkinResolver';

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

    private _specLoader = new UISpecLoader();
    private _initialized = false;

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
                this._specLoader.loadI18n('zh-TW'),
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

    protected onBuildComplete(_rootNode: Node): void {
        // 按鈕事件
        this.node.on('onClickBack',   this.onClickBack,   this);
        this.node.on('onClickReplay', this.onClickReplay, this);
    }

    // ── 公開 API ─────────────────────────────────────────────

    /**
     * 顯示戰鬥結果彈窗
     * @param result 戰鬥結果
     */
    public async showResult(result: BattleResult): Promise<void> {
        if (!this._initialized) {
            await this._initialize();
        }

        const config = RESULT_CONFIG[result];

        // 更新標題
        const titleLabel = this.node.getChildByPath('Card/TitleLabel')?.getComponent(Label);
        if (titleLabel) {
            titleLabel.string = this.t(config.titleI18nKey);
        }

        // 更新描述（目前寫死，未來可加入 i18n key）
        const descLabel = this.node.getChildByPath('Card/DescLabel')?.getComponent(Label);
        if (descLabel) {
            descLabel.string = config.descText;
        }

        // 切換卡片背景 skin（依勝負結果）
        await this._switchCardSkin(config.cardSkinSlot);

        // 推到最頂層
        if (this.node.parent) {
            this.node.setSiblingIndex(this.node.parent.children.length - 1);
        }

        this.node.active = true;
        this.playEnterTransition(this.node);
    }

    // ── 私有方法 ─────────────────────────────────────────────

    /**
     * 切換卡片背景到對應的 skin slot
     * 失敗時靜默（仍顯示文字）
     */
    private async _switchCardSkin(skinSlot: string): Promise<void> {
        const cardNode = this.node.getChildByName('Card');
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

    private onClickBack(): void {
        this.playExitTransition(this.node, undefined, () => {
            this.node.active = false;
            this.node.emit('back');
        });
    }

    private onClickReplay(): void {
        this.playExitTransition(this.node, undefined, () => {
            this.node.active = false;
            this.node.emit('replay');
        });
    }

    // ── resetState (UILayer 協定) ─────────────────────────────

    /** 從快取取出前重置：清除文字殘留 */
    public resetState(): void {
        const titleLabel = this.node.getChildByPath('Card/TitleLabel')?.getComponent(Label);
        const descLabel  = this.node.getChildByPath('Card/DescLabel')?.getComponent(Label);
        if (titleLabel) titleLabel.string = '';
        if (descLabel)  descLabel.string  = '';
    }
}
