// @spec-source → 見 docs/cross-reference-index.md
/**
 * @deprecated
 * ActionCommandPanel — Zone 7: 奧義指令區（已廢止，請使用 ActionCommandComposite）
 *
 * 職責：
 *   1. 顯示奧義大圓（120px，含 SP 填充環）已遷移至 CompositePanel
 *   2. 顯示 3 個操作小圓已遷移
 *   3-5. 所有邏輯已遷移
 *
 * 遷移完成時間：2026-04-13 (Wave 2)
 * 預計刪除：2026-05-13 (Wave 2 全部遷移後)
 *
 * Unity 對照：UltimateButtonController + ActionBtnGroup
 */
import { _decorator, Button, Label, Node, Sprite } from 'cc';
import { EVENT_NAMES, Faction } from '../../core/config/Constants';
import { services } from '../../core/managers/ServiceLoader';
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';
import { UISpecLoader } from '../core/UISpecLoader';
import { UITemplateBinder } from '../core/UITemplateBinder';
import { UltimateSelectPopup, UltimateSkillItem } from './UltimateSelectPopup';

const { ccclass, property } = _decorator;
const ENEMY_THINKING_TOAST_KEY = 'battle.enemy-thinking';

@ccclass('ActionCommandPanel')
export class ActionCommandPanel extends UIPreviewBuilder {

    private get _specLoader() { return services().specLoader; }
    private _initialized = false;
    private _buildCompleted = false;
    private readonly _readyWaiters: Array<(ready: boolean) => void> = [];
    /**
     * 奧義選擇小窗（Inspector 可選綁定；未綁定時在首次點擊時懶初始化）
     * Unity 對照：[SerializeField] UltimateSkillSelectPopup ultimateSelectPopup;
     */
    @property({ type: UltimateSelectPopup, tooltip: '可選綁定；不綁定也能使用（懶初始化）' })
    ultimateSelectPopup: UltimateSelectPopup | null = null;

    // ── 節點引用（由 onReady 填入）──────────────────
    private _spRingSprite: Sprite | null = null;
    private _ultLabel:     Label  | null = null;
    private _spPctLabel:   Label  | null = null;
    private _ultimateBtnNode: Node | null = null;
    private _ultimatePopupHost: Node | null = null;
    private _ultimateSkills: UltimateSkillItem[] = [];

    // ── 目前 SP 狀態 ──────────────────────────────────────────
    private _maxSp = 100;
    private _currentSp = 0;
    private _enemyThinkingToastVisible = false;

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
            // [Vibe-QA] 增加對 ServiceLoader 狀態的確認
            const loader = this._specLoader;
            if (!loader) {
                console.warn('[ActionCommandPanel] specLoader 尚未就緒，延遲初始化');
                return;
            }

            // 1. 載入 UI 規格
            const [fullScreen, tokens] = await Promise.all([
                loader.loadFullScreen('action-command-screen'),
                loader.loadDesignTokens(),
            ]);
            
            // 2. 載入 I18n 字串（優先使用系統已載入的，否則才手動載入）
            let i18nData: Record<string, string> = {};
            try {
                i18nData = await loader.loadI18n(services().i18n.currentLocale);
            } catch (err) {
                console.warn('[ActionCommandPanel] I18n 載入失敗，使用 fallback', err);
            }
            
            // 3. 構建畫面
            await this.buildScreen(fullScreen.layout, fullScreen.skin, i18nData, tokens);
            this._initialized = true;
        } catch (e) {
            console.warn('[ActionCommandPanel] 規格載入失敗，退回白模', e);
            // 即便失敗也標記為已初始化，防止無限循環報錯
            this._initialized = true;
            this._flushReadyWaiters(false);
        }
    }

    onDestroy(): void {
        this.hideEnemyThinking();
        this._unsubs.forEach(fn => fn());
        this._unsubs.length = 0;
    }

    // ── 覆寫建構點：透過 binder 自動綁定節點引用 ─────────────────────────────

    protected onReady(binder: UITemplateBinder): void {
        // SP 環 Sprite（fillRange 由事件驅動）
        const spRingNode = binder.getNode('SpRing');
        this._spRingSprite = spRingNode?.getComponent(Sprite) ?? null;

        this._ultLabel      = binder.getLabel('UltLabel');
        this._spPctLabel    = binder.getLabel('SpPctLabel');
        // 奧義大圓點擊
        this._ultimateBtnNode = binder.getNode('UltimateBtn');
        this._ultimatePopupHost = binder.getNode('UltimatePopup');
        this._ultimateBtnNode?.on(Button.EventType.CLICK, this._onUltimateClick, this);

        // 結束回合、計謀、單挑
        binder.getNode('EndTurnBtn')?.on(Button.EventType.CLICK, this._onEndTurnClick, this);
        binder.getNode('TacticsBtn')?.on(Button.EventType.CLICK, this._onTacticsClick, this);
        binder.getNode('DuelBtn')?.on(Button.EventType.CLICK, this._onDuelClick, this);

        console.log(
            `[ActionCommandPanel] 綁定完成 — ring:${!!this._spRingSprite}` +
            ` ultLabel:${!!this._ultLabel}`
        );

        this._buildCompleted = true;
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

    public setUltimateSkills(skills: UltimateSkillItem[]): void {
        this._ultimateSkills = [...skills];
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

    /** 顯示「敵軍思考中」提示，沿用 ToastMessage 全域事件。 */
    public showEnemyThinking(): void {
        if (this._enemyThinkingToastVisible) return;
        this._enemyThinkingToastVisible = true;
        services().event.emit('SHOW_TOAST', {
            message: '敵軍思考中...',
            duration: 999,
            key: ENEMY_THINKING_TOAST_KEY,
        });
    }

    /** 收起「敵軍思考中」提示。 */
    public hideEnemyThinking(): void {
        if (!this._enemyThinkingToastVisible) return;
        this._enemyThinkingToastVisible = false;
        services().event.emit('HIDE_TOAST', { key: ENEMY_THINKING_TOAST_KEY });
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
