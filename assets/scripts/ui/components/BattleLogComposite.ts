// @spec-source → 見 docs/cross-reference-index.md (UCUF Wave 2)
/**
 * BattleLogComposite — 右側面板（控制列 + 戰鬥日誌）（CompositePanel 版）
 *
 * UCUF Wave 2 — 將 BattleLogPanel（UIPreviewBuilder）遷移至 CompositePanel 架構。
 *
 * 職責：
 *   1. 顯示滾動式戰鬥日誌
 *   2. BtnCollapse：折疊/展開日誌區（tween 0.3s）
 *   3. Auto/x2/⚙ 控制列位於日誌上方（常駐顯示）
 *
 * 遷移重點：
 *   - buildScreen() → mount('battle-log-screen')
 *   - onReady(binder) → _onAfterBuildReady(binder)
 *   - append() / clear() / waitUntilReady() 公開 API 相同
 *   - 控制列事件發射相同（AutoBattleToggled / BattleSpeedToggled）
 *
 * Unity 對照：BattleRightPanel，含 BattleLog + 控制列
 */
import { _decorator, Button, Label, Node, ScrollView, tween, UITransform } from "cc";
import { CompositePanel } from '../core/CompositePanel';
import { UITemplateBinder } from '../core/UITemplateBinder';
import { EVENT_NAMES, Faction } from '../../core/config/Constants';
import { services } from '../../core/managers/ServiceLoader';

const { ccclass, property } = _decorator;

@ccclass("BattleLogComposite")
export class BattleLogComposite extends CompositePanel {

    // ── Inspector 備用綁定（@property 優先；未綁定時由 _onAfterBuildReady 自動填入）──
    @property(Label)
    logLabel: Label = null!;

    @property(ScrollView)
    scrollView: ScrollView = null!;

    @property
    maxLines = 80;

    // ── 私有狀態 ─────────────────────────────────────────────────────────────
    private readonly _lines: string[] = [];
    private _contentNode: Node | null = null;
    private _collapsed = true;
    private _logPanelNode: Node | null = null;
    private _collapsedHeight = 0;
    private _expandedHeight = 410;
    private _isMounted = false;
    private readonly _readyWaiters: Array<(ready: boolean) => void> = [];
    // 控制列狀態
    private _isAuto   = false;  // 自動戰鬥開關
    private _speed    = 1;      // 遊戲速度（1 | 2）
    // 控制列節點引用（供視覺反饋使用）
    private _btnAuto:    Node | null = null;
    private _btnSpeed:   Node | null = null;

    // ── 生命週期 ─────────────────────────────────────────────────────────────

    async onLoad(): Promise<void> {
        services().initialize(this.node);
        await this.mount();
    }

    protected onDestroy(): void {
        this.unmount();
        this._isMounted = false;
    }

    // ── 公開 API ──────────────────────────────────────────────────────────────

    /**
     * 掛載並初始化面板。
     * 初次呼叫時掛載 screen；後續呼叫無效（已掛載）。
     */
    public async mount(): Promise<void> {
        if (this._isMounted) return;
        try {
            await super.mount('battle-log-screen');
            this._isMounted = true;
            this.clear();
        } catch (e) {
            console.warn('[BattleLogComposite] mount 失敗', e);
            this._isMounted = true;
            this._flushReadyWaiters(false);
        }
    }

    /** 清空日誌。Unity 對照：ClearLog() */
    public clear(): void {
        this._lines.length = 0;
        this._flush();
    }

    /**
     * 追加一行文字到日誌末尾。
     * 超出 maxLines 時自動刪除最舊一行。
     * Unity 對照：AppendLine(string text)
     */
    public append(text: string): void {
        if (!text) return;
        this._lines.push(text);
        while (this._lines.length > Math.max(1, this.maxLines)) {
            this._lines.shift();
        }
        this._flush();
    }

    public waitUntilReady(timeoutMs = 5000): Promise<boolean> {
        if (this._isMounted) {
            return Promise.resolve(true);
        }

        return new Promise<boolean>((resolve) => {
            let settled = false;
            const finish = (ready: boolean) => {
                if (settled) return;
                settled = true;
                resolve(ready);
            };

            this._readyWaiters.push(finish);
            this.scheduleOnce(() => finish(this._isMounted), Math.max(0, timeoutMs) / 1000);
        });
    }

    // ── CompositePanel 鉤子 ───────────────────────────────────

    protected override _onAfterBuildReady(binder: UITemplateBinder): void {
        // 日誌捲動區
        if (!this.scrollView) {
            this.scrollView = binder.getScrollView('ScrollView') ?? null!;
        }

        // 日誌 Label（ContentNode → LogLabel）
        if (!this.logLabel) {
            this.logLabel = binder.getLabel('LogLabel') ?? null!;
        }
        this._contentNode = binder.getNode('ContentNode');

        // 可折疊的日誌面板節點
        this._logPanelNode = binder.getNode('BattleLogPanel');
        const tf = this._logPanelNode?.getComponent(UITransform);
        if (tf) {
            this._expandedHeight = tf.height;
        }

        // ── 控制列按鈕（BtnAuto / BtnSpeed / BtnSetting）────────────────────
        this._btnAuto  = binder.getNode('BtnAuto');
        this._btnSpeed = binder.getNode('BtnSpeed');
        this._btnAuto?.on(Button.EventType.CLICK,    this._onAutoClick,    this);
        this._btnSpeed?.on(Button.EventType.CLICK,   this._onSpeedClick,   this);
        binder.getNode('BtnSetting')?.on(Button.EventType.CLICK, this._onSettingClick, this);

        // BtnCollapse：折疊 / 展開日誌
        binder.getNode('BtnCollapse')?.on(Button.EventType.CLICK, this._onCollapseClick, this);

        console.log(
            `[BattleLogComposite] 綁定完成 — ` +
            `scrollView:${!!this.scrollView} label:${!!this.logLabel} contentNode:${!!this._contentNode}`
        );

        this._applyCollapsedState(this._collapsed, false);
        this._flushReadyWaiters(true);
    }

    // ── 私有：日誌刷新 ───────────────────────────────────────────────────────

    private _flush(): void {
        if (!this.logLabel) return;
        this.logLabel.string = this._lines.join('\n');

        const contentTf = this._contentNode?.getComponent(UITransform);
        if (contentTf) {
            const lineH = this.logLabel.lineHeight || 18;
            const estimated = Math.max(180, this._lines.length * lineH + 24);
            contentTf.setContentSize(contentTf.width, estimated);
        }
        this.scrollView?.scrollToBottom(0.05);
    }

    // ── 私有：按鈕事件處理 ───────────────────────────────────────────────────

    private _onAutoClick(): void {
        this._isAuto = !this._isAuto;
        const op = this._btnAuto?.getComponent('cc.UIOpacity') as any;
        if (op) op.opacity = this._isAuto ? 180 : 255;
        services().event.emit(EVENT_NAMES.AutoBattleToggled, this._isAuto);
        console.log(`[BattleLogComposite] AutoBattle → ${this._isAuto}`);
    }

    private _onSpeedClick(): void {
        this._speed = this._speed === 1 ? 2 : 1;
        const op = this._btnSpeed?.getComponent('cc.UIOpacity') as any;
        if (op) op.opacity = this._speed === 2 ? 180 : 255;
        services().event.emit(EVENT_NAMES.BattleSpeedToggled, this._speed);
        console.log(`[BattleLogComposite] BattleSpeed → ${this._speed}x`);
    }

    private _onSettingClick(): void {
        services().event.emit(EVENT_NAMES.ShowSettingsRequested);
        console.log('[BattleLogComposite] ShowSettings requested');
    }

    private _onCollapseClick(): void {
        this._collapsed = !this._collapsed;
        this._applyCollapsedState(this._collapsed, true);
    }

    private _applyCollapsedState(collapsed: boolean, animated: boolean): void {
        const panelNode = this._logPanelNode;
        if (!panelNode) return;

        const tf = panelNode.getComponent(UITransform);
        if (!tf) return;

        const targetH = collapsed ? this._collapsedHeight : this._expandedHeight;

        if (!collapsed) {
            panelNode.active = true;
        }

        if (!animated) {
            tf.height = targetH;
            panelNode.active = !collapsed;
            return;
        }

        tween(tf)
            .to(0.3, { height: targetH } as any, { easing: 'quadOut' })
            .call(() => {
                if (panelNode && collapsed) panelNode.active = false;
            })
            .start();
    }

    private _flushReadyWaiters(ready: boolean): void {
        while (this._readyWaiters.length > 0) {
            const resolve = this._readyWaiters.shift();
            resolve?.(ready);
        }
    }
}
