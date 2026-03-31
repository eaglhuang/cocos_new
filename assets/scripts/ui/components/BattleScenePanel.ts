// @spec-source → 見 docs/cross-reference-index.md
/**
 * BattleScenePanel — 戰鬥場景 UI 總調度器
 *
 * 職責：
 *   1. 串聯 BattleHUD、TigerTallyPanel、BattleLogPanel、ActionCommandPanel、UnitInfoPanel
 *   2. 將 TigerTallyPanel.onCardSelect 接通 UnitInfoPanel.show()
 *   3. 監聽 TurnPhaseChanged：玩家部署階段啟用工具按鈕，非玩家階段禁用
 *   4. 提供遊戲內部 API（appendLog、setCards、setActiveUltimateCount）供 BattleScene 調用
 *
 * 掛載方式：放在戰鬥場景根節點，@property 綁定各子面板節點。
 *
 * Unity 對照：BattleUIManager（掛 Canvas 根的 Coordinator Component）
 */
import { _decorator, Component, Node, UITransform } from 'cc';
import { EVENT_NAMES, Faction, TurnPhase } from '../../core/config/Constants';
import { services } from '../../core/managers/ServiceLoader';
import { ActionCommandPanel } from './ActionCommandPanel';
import { BattleHUD } from './BattleHUD';
import { BattleLogPanel } from './BattleLogPanel';
import { TallyCardData, TigerTallyPanel } from './TigerTallyPanel';
import { UnitInfoPanel } from './UnitInfoPanel';

const { ccclass, property } = _decorator;

@ccclass('BattleScenePanel')
export class BattleScenePanel extends Component {

    // ── Inspector 綁定（對應 battle-scene-main.json 的各子面板）─────────

    /** Zone 1: TopBar HUD（回合、糧草、要塞血量） */
    @property(BattleHUD)
    battleHUD: BattleHUD = null!;

    /** Zone 3: 虎符卡片欄 */
    @property(TigerTallyPanel)
    tigerTallyPanel: TigerTallyPanel = null!;

    /** Zone 3 延伸: 點卡片後滑出的兵種資訊面板 */
    @property(UnitInfoPanel)
    unitInfoPanel: UnitInfoPanel = null!;

    /** Zone 5: 右側面板（控制列＋戰鬥日誌＋工具按鈕） */
    @property(BattleLogPanel)
    battleLogPanel: BattleLogPanel = null!;

    /** Zone 7: 奧義大圓 + 3個主動奧義小圓 */
    @property(ActionCommandPanel)
    actionCommandPanel: ActionCommandPanel = null!;

    // ── 私有狀態 ─────────────────────────────────────────────
    private readonly _unsubs: (() => void)[] = [];

    // ── 生命週期 ─────────────────────────────────────────────

    onLoad(): void {
        services().initialize(this.node);
        this._ensureSubPanels();
        this._wireCallbacks();
        this._subscribeEvents();
    }

    // ── 子面板自動尋找（Code-first 模式，Inspector 未綁定時使用）──────────

    /**
     * 在 Canvas 父節點下尋找或建立子面板。
     * Inspector 模式下 @property 已綁定，此方法只處理空缺的欄位。
     *
     * Unity 對照：GetComponentInChildren / FindObjectOfType（編輯器自動綁定 vs 執行期尋找）
     */
    private _ensureSubPanels(): void {
        const canvas = this.node.parent;
        if (!canvas) return;

        if (!this.tigerTallyPanel) {
            let n = canvas.getChildByName('TigerTallyPanel');
            if (!n) { n = new Node('TigerTallyPanel'); n.addComponent(UITransform); canvas.addChild(n); }
            this.tigerTallyPanel = n.getComponent(TigerTallyPanel) ?? n.addComponent(TigerTallyPanel);
        }

        if (!this.unitInfoPanel) {
            let n = canvas.getChildByName('UnitInfoPanel');
            if (!n) { n = new Node('UnitInfoPanel'); n.addComponent(UITransform); canvas.addChild(n); }
            this.unitInfoPanel = n.getComponent(UnitInfoPanel) ?? n.addComponent(UnitInfoPanel);
        }

        if (!this.actionCommandPanel) {
            let n = canvas.getChildByName('ActionCommandPanel');
            if (!n) { n = new Node('ActionCommandPanel'); n.addComponent(UITransform); canvas.addChild(n); }
            this.actionCommandPanel = n.getComponent(ActionCommandPanel) ?? n.addComponent(ActionCommandPanel);
        }
    }

    /**
     * 由外部（BattleScene）注入已初始化的子面板引用，覆蓋 @property 預設 null。
     * Code-first 模式或測試中可直接呼叫，Inspector 模式忽略此方法。
     *
     * Unity 對照：BattleUIManager.InjectPanels(hud, log, ...)
     */
    public wirePanels(options: {
        battleHUD?: BattleHUD;
        battleLogPanel?: BattleLogPanel;
    }): void {
        if (options.battleHUD)    this.battleHUD    = options.battleHUD;
        if (options.battleLogPanel) this.battleLogPanel = options.battleLogPanel;
        // tigerTallyPanel / unitInfoPanel / actionCommandPanel 已由 _ensureSubPanels 自動建立
        this._wireCallbacks();
    }

    onDestroy(): void {
        this._unsubs.forEach(fn => fn());
        this._unsubs.length = 0;
    }

    // ── 串接各子面板 ─────────────────────────────────────────

    private _wireCallbacks(): void {
        // 虎符卡片點擊 → 顯示兵種詳情面板
        if (this.tigerTallyPanel) {
            this.tigerTallyPanel.onCardSelect = (index, data) => {
                this._onCardSelected(index, data);
            };
        }
    }

    private _subscribeEvents(): void {
        this._unsubs.push(
            services().event.on(EVENT_NAMES.TurnPhaseChanged, this._onTurnPhaseChanged.bind(this)),
        );
    }

    // ── 公開 API（供 BattleScene 調用）────────────────────────

    /**
     * 設置虎符卡片資料（部署時或換將時調用）。
     * Unity 對照：battleUIManager.RefreshHandCards(cards)
     */
    public setCards(cards: TallyCardData[]): void {
        this.tigerTallyPanel?.setCards(cards);
    }

    /**
     * 追加一行戰鬥日誌。
     * Unity 對照：battleLogPanel.AppendLine(text)
     */
    public appendLog(text: string): void {
        this.battleLogPanel?.append(text);
    }

    /**
     * 設定玩家武將的主動奧義槽數（0~3）。
     * Unity 對照：actionCommandPanel.SetActiveSkillCount(count)
     */
    public setActiveUltimateCount(count: number): void {
        this.actionCommandPanel?.setActiveUltimateCount(count);
    }

    // ── 私有事件處理 ─────────────────────────────────────────

    /** 卡片選中：顯示兵種詳情面板 */
    private _onCardSelected(_index: number, data: TallyCardData): void {
        this.unitInfoPanel?.show(data);
    }

    /**
     * TurnPhaseChanged handler：
     *   - PlayerDeploy 階段：ActionCommand 互動啟用
     *   - 非玩家階段：暫時禁用，避免錯誤輸入
     *
     * Unity 對照：BattleUIManager.OnPhaseChanged(TurnPhase phase)
     */
    private _onTurnPhaseChanged(data: { phase: TurnPhase; faction: Faction }): void {
        const isPlayerTurn = data.phase === TurnPhase.PlayerDeploy
            && data.faction === Faction.Player;

        if (this.actionCommandPanel) {
            this.actionCommandPanel.node.active = isPlayerTurn;
        }

        // 日誌補充：標示回合切換
        const phaseLabel = isPlayerTurn ? '玩家回合' : '等待中…';
        this.appendLog(`【${phaseLabel}】`);
    }
}
