// @spec-source → 見 docs/cross-reference-index.md (UCUF Wave 2)
/**
 * DuelChallengeComposite — 武將單挑確認面板（CompositePanel 版）
 *
 * UCUF Wave 2 — 將 DuelChallengePanel（UIPreviewBuilder）遷移至 CompositePanel 架構。
 * 使用 dialog-confirm Template 進行參數化 UI 構建。
 *
 * 遷移重點：
 *   - 保留 Template resolver 邏輯但透過 mount() 統一入口
 *   - buildScreen(layout, skin, i18n) → mount('duel-challenge-screen')
 *   - show(challengerName, defenderName, score) API 相同
 *   - 事件發射 (duelAccepted / duelRejected) 相同
 *
 * Unity 對照：ConfirmDialog，但透過 CompositePanel 統一生命週期管理
 */
import { _decorator, Button, tween, UIOpacity, Node } from 'cc';
import { CompositePanel } from '../core/CompositePanel';
import { UITemplateResolver } from '../core/UITemplateResolver';
import { UITemplateBinder } from '../core/UITemplateBinder';
import { services } from '../../core/managers/ServiceLoader';

const { ccclass } = _decorator;

@ccclass('DuelChallengeComposite')
export class DuelChallengeComposite extends CompositePanel {

    private _resolver   = new UITemplateResolver();
    private _binder: UITemplateBinder | null = null;
    private _isMounted = false;

    // ── 生命週期 ─────────────────────────────────────────────

    protected onDestroy(): void {
        this.unmount();
        this._isMounted = false;
        this._binder = null;
    }

    // ── 公開 API ─────────────────────────────────────────────

    /**
     * 顯示單挑確認對話框。
     * 初次呼叫時掛載畫面；後續呼叫僅更新文字內容。
     */
    public async show(challengerName: string, defenderName: string, score: number): Promise<void> {
        if (!this._isMounted) {
            await this.mount('duel-challenge-screen');
            this._isMounted = true;
        }

        if (this._binder) {
            const level = score >= 0.6 ? '我方佔優' : score >= 0.4 ? '勢均力敵' : '我方劣勢';
            this._binder.setTexts({
                TextBody: `敵將 ${challengerName} 向 ${defenderName} 發起單挑！\n評估：${level}（評分 ${(score * 100).toFixed(0)}）\n接受可一決雌雄，拒絕則全軍攻防減半。`,
            });

            if (this.node.parent) {
                this.node.setSiblingIndex(this.node.parent.children.length - 1);
            }
        }

        this.node.active = true;
        const opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
        opacity.opacity = 0;
        tween(opacity).to(0.15, { opacity: 255 }).start();
    }

    public hide(): void {
        const opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
        tween(opacity)
            .to(0.12, { opacity: 0 })
            .call(() => { this.node.active = false; })
            .start();
    }

    // ── CompositePanel 鉤子 ───────────────────────────────────

    protected override _onAfterBuildReady(binder: UITemplateBinder): void {
        this._binder = binder;
        // Template dialog-confirm 產出 btnPrimary（接受）/ btnSecondary（拒絕）
        // Unity 對照：ConfirmDialog.okButton.onClick += OnAccept
        binder.getButton('btnPrimary')?.node.on(Button.EventType.CLICK, this._onAccept, this);
        binder.getButton('btnSecondary')?.node.on(Button.EventType.CLICK, this._onReject, this);
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
