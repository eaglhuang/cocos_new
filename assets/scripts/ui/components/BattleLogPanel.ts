// @spec-source → 見 docs/cross-reference-index.md
/**
 * BattleLogPanel — Zone 5: 右側面板（控制列 + 戰鬥日誌）
 *
 * 職責：
 *   1. 顯示滾動式戰鬥日誌
 *   2. BtnCollapse：折疊/展開日誌區（tween 0.3s）
 *   3. Auto/x2/⚙ 控制列位於日誌上方（常駐顯示）
 *
 * 注意（v3）：結束回合 / 計謀 / 單挑 已移至 ActionCommandPanel (Zone 7)，
 * 不再由 BattleLogPanel 處理。
 *
 * 架構模式：繼承 UIPreviewBuilder，在 onReady(binder) 透過自動綁定取得節點引用
 * Unity 對照：BattleRightPanel（含 BattleLog + CollapseArrow）
 * 規格書：見 battle-log-{main/default/screen}.json (battle_ui bundle)
 */
import { _decorator, Button, Label, Node, ScrollView, tween, UITransform } from "cc";
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';
import { UISpecLoader } from '../core/UISpecLoader';
import { UITemplateBinder } from '../core/UITemplateBinder';
import { EVENT_NAMES, Faction } from '../../core/config/Constants';
import { services } from '../../core/managers/ServiceLoader';

const { ccclass, property } = _decorator;

@ccclass("BattleLogPanel")
export class BattleLogPanel extends UIPreviewBuilder {

    // ── Inspector 備用綁定（@property 優先；未綁定時由 onReady 自動填入）──
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
    private _logPanelNode: Node | null = null;   // BattleLogPanel 子節點（可折疊區段）
    private _collapsedHeight = 0;
    private _expandedHeight = 410;
    private _initialized = false;
    private _buildCompleted = false;
    private readonly _readyWaiters: Array<(ready: boolean) => void> = [];
    // 控制列狀態
    private _isAuto   = false;  // 自動戰鬥開關
    private _speed    = 1;      // 遊戲速度（1 | 2）
    // 控制列節點引用（供視覺反饋使用）
    private _btnAuto:    Node | null = null;
    private _btnSpeed:   Node | null = null;

    private get _specLoader() { return services().specLoader; }

    // ── 生命週期 ─────────────────────────────────────────────────────────────

    async onLoad(): Promise<void> {
        services().initialize(this.node);
        await this._initialize();
        this.clear();
    }

    private async _initialize(): Promise<void> {
        if (this._initialized) return;
        try {
            const [fullScreen, i18n, tokens] = await Promise.all([
                this._specLoader.loadFullScreen('battle-log-screen'),
                this._specLoader.loadI18n(services().i18n.currentLocale),
                this._specLoader.loadDesignTokens(),
            ]);
            await this.buildScreen(fullScreen.layout, fullScreen.skin, i18n, tokens);
            this._initialized = true;
        } catch (e) {
            console.warn('[BattleLogPanel] 規格載入失敗，退回白模', e);
            this._initialized = true;
            this._flushReadyWaiters(false);
        }
    }

    // ── 覆寫建構點：透過 binder 自動綁定節點引用 ─────────────────────────────

    protected onReady(binder: UITemplateBinder): void {
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
            `[BattleLogPanel] 綁定完成 — ` +
            `scrollView:${!!this.scrollView} label:${!!this.logLabel} contentNode:${!!this._contentNode}`
        );

        this._applyCollapsedState(this._collapsed, false);

        this._buildCompleted = true;
        this._flushReadyWaiters(true);
    }

    // ── 公開 API ──────────────────────────────────────────────────────────────

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
        if (this._buildCompleted) {
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
            this.scheduleOnce(() => finish(this._buildCompleted), Math.max(0, timeoutMs) / 1000);
        });
    }

    // ── 私有：日誌刷新 ───────────────────────────────────────────────────────

    private _flush(): void {
        if (!this.logLabel) return;
        this.logLabel.string = this._lines.join('\n');

        // 依內容行數動態調整 ContentNode 高度，再捲至底部
        const contentTf = this._contentNode?.getComponent(UITransform);
        if (contentTf) {
            const lineH = this.logLabel.lineHeight || 18;
            const estimated = Math.max(180, this._lines.length * lineH + 24);
            contentTf.setContentSize(contentTf.width, estimated);
        }
        this.scrollView?.scrollToBottom(0.05);
    }

    // ── 私有：按鈕事件處理 ───────────────────────────────────────────────────

    /** 自動戰鬥開關（Auto） */
    private _onAutoClick(): void {
        this._isAuto = !this._isAuto;
        // 視覺反饋：開啟時降低透明度（模擬按下狀態）
        const op = this._btnAuto?.getComponent('cc.UIOpacity') as any;
        if (op) op.opacity = this._isAuto ? 180 : 255;
        services().event.emit(EVENT_NAMES.AutoBattleToggled, this._isAuto);
        console.log(`[BattleLogPanel] AutoBattle → ${this._isAuto}`);
    }

    /** 戰鬥速度切換（x1 ↔ x2） */
    private _onSpeedClick(): void {
        this._speed = this._speed === 1 ? 2 : 1;
        const op = this._btnSpeed?.getComponent('cc.UIOpacity') as any;
        if (op) op.opacity = this._speed === 2 ? 180 : 255;
        services().event.emit(EVENT_NAMES.BattleSpeedToggled, this._speed);
        console.log(`[BattleLogPanel] BattleSpeed → ${this._speed}x`);
    }

    /** 開啟設定面板 */
    private _onSettingClick(): void {
        services().event.emit(EVENT_NAMES.ShowSettingsRequested);
        console.log('[BattleLogPanel] ShowSettings requested');
    }

    /**
     * 折疊 / 展開日誌面板。
     * tween 0.3s 動畫改變 BattleLogPanel 子節點的 height。
     * Unity 對照：ToggleLogPanel() 搭配 DOTween
     */
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

