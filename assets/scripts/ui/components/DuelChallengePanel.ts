// @spec-source → 見 docs/cross-reference-index.md
/**
 * DuelChallengePanel — 武將單挑確認 UI
 *
 * ⭐ 使用 dialog-confirm Template（驗證組件屋架構可用性）
 *
 * Template: dialog-confirm（assets/resources/ui-spec/templates/dialog-confirm.json）
 * Skin:     duel-challenge-default.json（保留既有視覺風格）
 * 本元件只包含業務邏輯（show/hide + 事件發射），不含任何視覺排版代碼。
 *
 * Unity 對照：ConfirmDialog + UnityEvent，但 Cocos 用 Node.emit() 做事件回調。
 */
import { _decorator, Button, tween, UIOpacity } from 'cc';
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';
import { UITemplateResolver } from '../core/UITemplateResolver';
import { UITemplateBinder } from '../core/UITemplateBinder';
import { services } from '../../core/managers/ServiceLoader';

const { ccclass } = _decorator;

@ccclass('DuelChallengePanel')
export class DuelChallengePanel extends UIPreviewBuilder {

    private get _specLoader() { return services().specLoader; }
    private _resolver   = new UITemplateResolver();
    private _binder: UITemplateBinder | null = null;
    private _isBuilt = false;

    async onLoad(): Promise<void> {
        this.node.active = false;
        await this._build();
    }

    private async _build(): Promise<void> {
        if (this._isBuilt) return;
        try {
            // ✅ 使用 dialog-confirm Template + 傳入自訂參數
            // Unity 對照：Instantiate(confirmDialogPrefab) + 設定 Title/Buttons
            const [template, skin, i18n] = await Promise.all([
                this._specLoader.loadTemplate('dialog-confirm'),
                this._specLoader.loadSkin('duel-challenge-default'),
                this._specLoader.loadI18n('zh-TW'),
            ]);
            const layout = await this._resolver.resolve(template, {
                title:        'UI_DUEL_TITLE',
                buttons:      'yes-no',
                confirmLabel: 'UI_DUEL_ACCEPT',
                cancelLabel:  'UI_DUEL_REJECT',
                closable:     false,
                width:        560,
                height:       320,
            });
            await this.buildScreen(layout, skin, i18n);
            this._isBuilt = true;
        } catch (e) {
            console.warn('[DuelChallengePanel] Template 載入失敗，退回白模', e);
            this._isBuilt = true;
        }
    }

    protected onReady(binder: UITemplateBinder): void {
        this._binder = binder;
        // Template dialog-confirm 產出 btnPrimary（接受）/ btnSecondary（拒絕）
        // Unity 對照：ConfirmDialog.okButton.onClick += OnAccept
        binder.getButton('btnPrimary')?.node.on(Button.EventType.CLICK,   this._onAccept, this);
        binder.getButton('btnSecondary')?.node.on(Button.EventType.CLICK, this._onReject, this);
    }

    // ── 公開 API ─────────────────────────────────────────────

    show(challengerName: string, defenderName: string, score: number): void {
        if (!this._binder) return;

        const level = score >= 0.6 ? '我方佔優' : score >= 0.4 ? '勢均力敵' : '我方劣勢';
        // Template body 節點 id = 'TextBody'（來自 text-body widget）
        this._binder.setTexts({
            TextBody: `敵將 ${challengerName} 向 ${defenderName} 發起單挑！\n評估：${level}（評分 ${(score * 100).toFixed(0)}）\n接受可一決雌雄，拒絕則全軍攻防減半。`,
        });

        if (this.node.parent) {
            this.node.setSiblingIndex(this.node.parent.children.length - 1);
        }
        this.node.active = true;

        const opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
        opacity.opacity = 0;
        tween(opacity).to(0.15, { opacity: 255 }).start();
    }

    hide(): void {
        const opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
        tween(opacity)
            .to(0.12, { opacity: 0 })
            .call(() => { this.node.active = false; })
            .start();
    }

    // ── 按鈕回調 ─────────────────────────────────────────────

    private _onAccept(): void {
        this.hide();
        this.node.emit('duelAccepted');
    }

    private _onReject(): void {
        this.hide();
        this.node.emit('duelRejected');
    }
}
