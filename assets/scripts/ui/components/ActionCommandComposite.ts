// @spec-source → 見 docs/cross-reference-index.md (UCUF Wave 2)
/**
 * ActionCommandComposite — Zone 7: 奧義指令區（CompositePanel 版）
 *
 * UCUF Wave 2 — 將 ActionCommandPanel（UIPreviewBuilder）遷移至 CompositePanel 架構。
 *
 * 職責：
 *   1. 顯示奧義大圓（120px，含 SP 填充環）
 *   2. 顯示 3 個操作小圓：結束回合 / 計謀 / 單挑
 *   3. 監聽 GeneralSpChanged 事件更新 SP 環視覺與文字
 *   4. 奧義大圓點擊：SP < 100% 提示「奧義蓄力中」；SP >= 100% 彈出奧義選擇小窗
 *   5. 按鈕事件：endTurn / tactics / 單挑廣播
 *
 * 遷移重點：
 *   - buildScreen() → mount('action-command-screen')
 *   - onReady(binder) → _onAfterBuildReady(binder)
 *   - 保留 waitUntilReady() + setUltimateSkills() 公開 API
 *   - 事件發射相同（endTurn / tactics / GeneralDuelChallenge）
 *
 * Unity 對照：UltimateButtonController + ActionBtnGroup，但透過 CompositePanel 統一管理
 */
import { _decorator, Button, Label, Node, Sprite } from 'cc';
import { EVENT_NAMES, Faction } from '../../core/config/Constants';
import { services } from '../../core/managers/ServiceLoader';
import { CompositePanel } from '../core/CompositePanel';
import { UITemplateBinder } from '../core/UITemplateBinder';
import { UltimateSelectPopup, UltimateSkillItem } from './UltimateSelectPopup';
import { logBattleUIPosition } from './BattleUIDiag';

const { ccclass, property } = _decorator;

@ccclass('ActionCommandComposite')
export class ActionCommandComposite extends CompositePanel {

    /**
     * 奧義選擇小窗（Inspector 可選綁定；未綁定時在首次點擊時懶初始化）
     * Unity 對照：[SerializeField] UltimateSkillSelectPopup ultimateSelectPopup;
     */
    @property({ type: UltimateSelectPopup, tooltip: '可選綁定；不綁定也能使用（懶初始化）' })
    ultimateSelectPopup: UltimateSelectPopup | null = null;

    // ── 節點引用（由 _onAfterBuildReady 填入）──────────────────
    private _spRingSprite: Sprite | null = null;
    private _ultLabel:     Label  | null = null;
    private _spPctLabel:   Label  | null = null;
    private _tacticsLabel: Label  | null = null;
    private _ultimateBtnNode: Node | null = null;
    private _ultimatePopupHost: Node | null = null;
    private _ultimateSkills: UltimateSkillItem[] = [];
    private _tacticsSummaryLabel = '計謀';

    // ── 目前 SP 狀態 ──────────────────────────────────────────
    private _maxSp = 100;
    private _currentSp = 0;
    private _isMounted = false;

    private readonly _readyWaiters: Array<(ready: boolean) => void> = [];
    private readonly _unsubs: (() => void)[] = [];

    // ── 生命週期 ─────────────────────────────────────────────

    async onLoad(): Promise<void> {
        services().initialize(this.node);
        await this.mount();
    }

    protected onDestroy(): void {
        this.unmount();
        this._unsubs.forEach(fn => fn());
        this._unsubs.length = 0;
        this._isMounted = false;
    }

    // ── 公開 API ─────────────────────────────────────────────

    /**
     * 掛載並初始化面板。
     * 初次呼叫時掛載 screen；後續呼叫無效（已掛載）。
     */
    public async mount(): Promise<void> {
        if (this._isMounted) return;
        try {
            console.log('[ActionCommandComposite] mount() start — node:', this.node.name, 'parent:', this.node.parent?.name);
            await super.mount('action-command-screen');
            this._isMounted = true;
            this._subscribeEvents();
            // 診斷：mount 完成後記錄位置資訊
            const root = this.node.children[0];
            if (root) {
                logBattleUIPosition('ActionCommandComposite', root);
            }
        } catch (e) {
            console.warn('[ActionCommandComposite] mount 失敗', e);
            this._isMounted = true;
            this._flushReadyWaiters(false);
        }
    }

    public setUltimateSkills(skills: UltimateSkillItem[]): void {
        this._ultimateSkills = [...skills];
    }

    public setTacticSummary(label: string): void {
        this._tacticsSummaryLabel = label.trim() || '計謀';
        if (this._tacticsLabel) {
            this._tacticsLabel.string = this._tacticsSummaryLabel;
        }
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
        // SP 環 Sprite（fillRange 由事件驅動）
        const spRingNode = binder.getNode('SpRing');
        this._spRingSprite = spRingNode?.getComponent(Sprite) ?? null;

        this._ultLabel      = binder.getLabel('UltLabel');
        this._spPctLabel    = binder.getLabel('SpPctLabel');
        this._tacticsLabel  = binder.getLabel('TacticsLabel');
        if (this._tacticsLabel) {
            this._tacticsLabel.string = this._tacticsSummaryLabel;
        }
        
        // 奧義大圓點擊
        this._ultimateBtnNode = binder.getNode('UltimateBtn');
        this._ultimatePopupHost = binder.getNode('UltimatePopup');
        this._ultimateBtnNode?.on(Button.EventType.CLICK, this._onUltimateClick, this);

        // 結束回合、計謀、單挑
        binder.getNode('EndTurnBtn')?.on(Button.EventType.CLICK, this._onEndTurnClick, this);
        binder.getNode('TacticsBtn')?.on(Button.EventType.CLICK, this._onTacticsClick, this);
        binder.getNode('DuelBtn')?.on(Button.EventType.CLICK, this._onDuelClick, this);

        console.log(
            `[ActionCommandComposite] 綁定完成 — ring:${!!this._spRingSprite}` +
            ` ultLabel:${!!this._ultLabel}`
        );

        // 診斷：_onAfterBuildReady 時記錄詳細位置
        const root = this.node.children[0];
        if (root) {
            logBattleUIPosition('ActionCommandComposite._onAfterBuildReady', root);
        }

        this._flushReadyWaiters(true);
    }

    // ── 事件訂閱 ─────────────────────────────────────────────

    private _subscribeEvents(): void {
        this._unsubs.push(
            services().event.on(EVENT_NAMES.GeneralSpChanged, this._onSpChanged.bind(this)),
        );
    }

    /** GeneralSpChanged handler — 只更新玩家方 SP 環 */
    private _onSpChanged(data: { faction: Faction; sp: number; maxSp: number }): void {
        if (data.faction !== Faction.Player) return;

        this._currentSp = data.sp;
        this._maxSp     = data.maxSp > 0 ? data.maxSp : 100;

        const ratio   = Math.min(1, this._currentSp / this._maxSp);
        const pct     = Math.round(ratio * 100);
        const isReady = pct >= 100;

        // 更新 SP 填充環（Sprite Filled radial）
        if (this._spRingSprite) {
            this._spRingSprite.fillRange = ratio;
        }

        // 更新奧義標籤（SP滿→發動，SP未滿→奧義）
        if (this._ultLabel) {
            this._ultLabel.string = isReady ? '發動' : '奧義';
        }

        // 更新 SP 百分比數字（SP 滿時隱藏）
        if (this._spPctLabel) {
            this._spPctLabel.node.active = !isReady;
            if (!isReady) this._spPctLabel.string = `SP ${pct}%`;
        }
    }

    // ── 按鈕事件 ─────────────────────────────────────────────

    /**
     * 奧義大圓點擊：
     *   SP >= 100% → 開啟 UltimateSelectPopup（起中展開小窗）
     *   SP < 100%  → toast 提示「奧義蓄力中」
     *
     * Unity 對照：UltimateButton.OnClick() → 檢查 sp >= maxSp → ShowSkillSelectPopup()
     */
    private _onUltimateClick(): void {
        const isReady = this._maxSp > 0 && this._currentSp >= this._maxSp;
        if (!isReady) {
            services().event.emit(EVENT_NAMES.ShowToast, { text: '奧義蓄力中，SP 不足' });
            return;
        }

        if (!this.ultimateSelectPopup) {
            const popupNode = this._ultimatePopupHost ?? new Node('UltimateSelectPopup');
            if (!popupNode.parent) {
                this.node.addChild(popupNode);
            }
            this.ultimateSelectPopup = popupNode.getComponent(UltimateSelectPopup) ?? popupNode.addComponent(UltimateSelectPopup);
        }

        const skills = this._ultimateSkills.length > 0
            ? this._ultimateSkills
            : [{ skillId: 'unassigned-ultimate', label: '未配置奧義', costSp: this._maxSp }];

        this.ultimateSelectPopup.show(skills, this._ultimateBtnNode ?? undefined);
    }

    /** 結束回合：通知父節點（BattleScene 監聽 this.node 的 'endTurn' 事件） */
    private _onEndTurnClick(): void {
        this.node.emit('endTurn');
    }

    /** 計謀：通知父節點 */
    private _onTacticsClick(): void {
        this.node.emit('tactics');
    }

    /**
     * 單挑：廣播全域事件
     * Unity 對照：DuelButton.OnClick() → EventManager.TriggerEvent(GameEventType.DuelChallenge)
     */
    private _onDuelClick(): void {
        services().event.emit(EVENT_NAMES.GeneralDuelChallenge, { faction: Faction.Player });
    }

    private _flushReadyWaiters(ready: boolean): void {
        while (this._readyWaiters.length > 0) {
            const resolve = this._readyWaiters.shift();
            resolve?.(ready);
        }
    }
}
