// @spec-source → 見 docs/cross-reference-index.md
/**
 * ActionCommandPanel — Zone 7: 奧義指令區 (v3)
 *
 * 職責：
 *   1. 顯示奧義大圓（120px，含 SP 填充環，Sprite.Type.FILLED radial）
 *   2. 顯示 3 個操作小圓：結束回合 / 計謀 / 單挑（各 80px）
 *   3. 監聽 GeneralSpChanged 事件更新 SP 環視覺與文字
 *   4. 奧義大圓點擊：SP < 100% 提示「奧義蓄力中」；SP >= 100% 彈出奧義選擇小窗
 *   5. 結束回合 → emit 'endTurn'；計謀 → emit 'tactics'；單挑 → 廣播 GeneralDuelChallenge
 *
 * Unity 對照：UltimateButtonController（大圓 SP 環） + ActionBtnGroup（EndTurn/Tactics/Duel）
 * Cocos SP 環實作：Sprite.type = FILLED, sprite.fillRange = 0.0~1.0
 */
import { _decorator, Button, Label, Node, Sprite } from 'cc';
import { EVENT_NAMES, Faction } from '../../core/config/Constants';
import { services } from '../../core/managers/ServiceLoader';
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';
import { UISpecLoader } from '../core/UISpecLoader';

const { ccclass } = _decorator;

@ccclass('ActionCommandPanel')
export class ActionCommandPanel extends UIPreviewBuilder {

    private readonly _specLoader = new UISpecLoader();
    private _initialized = false;

    // ── 節點引用（由 onBuildComplete 填入）──────────────────
    private _spRingSprite:   Sprite | null = null;
    private _ultLabel:       Label  | null = null;
    private _spPctLabel:     Label  | null = null;
    private _ultimatePopup:  Node   | null = null;

    // ── 目前 SP 狀態 ──────────────────────────────────────────
    private _maxSp = 100;
    private _currentSp = 0;

    private readonly _unsubs: (() => void)[] = [];

    // ── 生命週期 ─────────────────────────────────────────────

    async onLoad(): Promise<void> {
        services().initialize(this.node);
        await this._initialize();
        this._subscribeEvents();
    }

    private async _initialize(): Promise<void> {
        if (this._initialized) return;
        try {
            const [fullScreen, i18n] = await Promise.all([
                this._specLoader.loadFullScreen('action-command-screen'),
                this._specLoader.loadI18n('zh-TW'),
            ]);
            await this.buildScreen(fullScreen.layout, fullScreen.skin, i18n);
            this._initialized = true;
        } catch (e) {
            console.warn('[ActionCommandPanel] 規格載入失敗，退回白模', e);
            this._initialized = true;
        }
    }

    onDestroy(): void {
        this._unsubs.forEach(fn => fn());
        this._unsubs.length = 0;
    }

    // ── 覆寫建構點：綁定節點引用 ─────────────────────────────

    protected onBuildComplete(_rootNode: Node): void {
        const find = (name: string) => this._deepFind(name);

        // SP 環 Sprite（fillRange 由事件驅動）
        const spRingNode = find('SpRing');
        this._spRingSprite = spRingNode?.getComponent(Sprite) ?? null;

        this._ultLabel      = find('UltLabel')?.getComponent(Label) ?? null;
        this._spPctLabel    = find('SpPctLabel')?.getComponent(Label) ?? null;
        this._ultimatePopup = find('UltimatePopup');

        // 奧義大圓點擊
        find('UltimateBtn')?.on(Button.EventType.CLICK, this._onUltimateClick, this);

        // 結束回合、計謀、單挑
        find('EndTurnBtn')?.on(Button.EventType.CLICK, this._onEndTurnClick, this);
        find('TacticsBtn')?.on(Button.EventType.CLICK, this._onTacticsClick, this);
        find('DuelBtn')?.on(Button.EventType.CLICK, this._onDuelClick, this);

        // 奧義選擇彈窗預設隱藏
        if (this._ultimatePopup) this._ultimatePopup.active = false;

        console.log(
            `[ActionCommandPanel] 綁定完成 — ring:${!!this._spRingSprite}` +
            ` ultLabel:${!!this._ultLabel} popup:${!!this._ultimatePopup}`
        );
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
     *   SP >= 100% → 開啟奧義選擇彈窗
     *   SP < 100%  → toast 提示「奧義蓄力中」
     *
     * Unity 對照：UltimateButton.OnClick() → 檢查 sp >= maxSp → ShowSkillSelectPopup()
     */
    private _onUltimateClick(): void {
        const isReady = this._maxSp > 0 && this._currentSp >= this._maxSp;
        if (!isReady) {
            console.log('[ActionCommandPanel] 奧義蓄力中，SP 不足無法發動');
            return;
        }
        // 切換彈窗顯示
        if (this._ultimatePopup) {
            this._ultimatePopup.active = !this._ultimatePopup.active;
        }
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

    // ── 工具：BFS 深度搜尋節點 ───────────────────────────────
    private _deepFind(name: string): Node | null {
        const queue: Node[] = [this.node];
        while (queue.length > 0) {
            const cur = queue.shift()!;
            if (cur.name === name) return cur;
            queue.push(...cur.children);
        }
        return null;
    }
}
