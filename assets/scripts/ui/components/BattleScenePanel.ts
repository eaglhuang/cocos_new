// @spec-source → 見 docs/cross-reference-index.md
/**
 * BattleScenePanel — 戰鬥場景 UI 總調度器
 *
 * 職責：
 *   1. 串聯 BattleHUD、TigerTallyPanel、BattleLogPanel、ActionCommandPanel、UnitInfoPanel
 *   2. [P3-R1c] 訂閱 UI_EVENTS.CardSelected → 接通 UnitInfoPanel.show()（已從函式指標改為事件總線）
 *   3. 監聽 TurnPhaseChanged：玩家部署階段啟用工具按鈕，非玩家階段禁用
 *   4. 提供遊戲內部 API（appendLog、setCards、setActiveUltimateCount）供 BattleScene 調用
 *
 * 掛載方式：放在戰鬥場景根節點，@property 綁定各子面板節點。
 *
 * Unity 對照：BattleUIManager（掛 Canvas 根的 Coordinator Component）
 */
import { _decorator, Component, Node } from 'cc';
import { EVENT_NAMES, Faction, TurnPhase } from '../../core/config/Constants';
import { services } from '../../core/managers/ServiceLoader';
import { UI_EVENTS } from '../core/UIEvents';
import { ActionCommandComposite } from './ActionCommandComposite';
import type { BattleHUD } from './BattleHUD';
import { BattleHUDComposite } from './BattleHUDComposite';
import { BattleLogComposite } from './BattleLogComposite';
import type { TallyCardData } from './TigerTallyComposite';
import { TigerTallyDetailComposite } from './TigerTallyDetailComposite';
import { TigerTallyComposite } from './TigerTallyComposite';
import { UnitInfoComposite } from './UnitInfoComposite';
import { UltimateSkillItem } from './UltimateSelectPopup';
import { registerBattleUIDiag } from './BattleUIDiag';

const { ccclass, property } = _decorator;

@ccclass('BattleScenePanel')
export class BattleScenePanel extends Component {

    // ── Inspector 綁定（對應 battle-scene-main.json 的各子面板）─────────

    @property(Node)
    battleHUDHost: Node | null = null;

    @property(Node)
    tigerTallyHost: Node | null = null;

    @property(Node)
    unitInfoHost: Node | null = null;

    @property(Node)
    tigerTallyDetailHost: Node | null = null;

    @property(Node)
    battleLogHost: Node | null = null;

    @property(Node)
    actionCommandHost: Node | null = null;

    battleHUD: BattleHUD | null = null;
    battleHUDComposite: BattleHUDComposite | null = null;
    tigerTallyComposite: TigerTallyComposite | null = null;
    unitInfoComposite: UnitInfoComposite | null = null;
    tigerTallyDetailComposite: TigerTallyDetailComposite | null = null;
    battleLogComposite: BattleLogComposite | null = null;
    actionCommandComposite: ActionCommandComposite | null = null;

    // ── 私有狀態 ─────────────────────────────────────────────
    private readonly _unsubs: (() => void)[] = [];

    // ── 生命週期 ─────────────────────────────────────────────

    onLoad(): void {
        services().initialize(this.node);
        this._ensureSubPanels();
        // [P3-R1c] _wireCallbacks() 已廢棄，由 _subscribeEvents() 中的事件總線取代
        this._subscribeEvents();
        // 註冊全域診斷函式 window.__battleUIDiag()
        registerBattleUIDiag();
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
        if (!canvas) {
            throw new Error('[BattleScenePanel] parent Canvas is missing; BattleScene.scene must keep BattleScenePanel under Canvas');
        }

        const resolveHost = (explicitHost: Node | null, name: string): Node => {
            const host = explicitHost ?? canvas.getChildByName(name);
            if (host) {
                return host;
            }
            throw new Error(`[BattleScenePanel] missing Canvas/${name} host; BattleScene.scene must provide static battle UI hosts`);
        };

        if (!this.tigerTallyComposite) {
            const n = resolveHost(this.tigerTallyHost, 'TigerTallyPanel');
            this.tigerTallyHost = n;
            this.tigerTallyComposite = n.getComponent(TigerTallyComposite);
            if (!this.tigerTallyComposite) {
                throw new Error('[BattleScenePanel] Canvas/TigerTallyPanel 缺少 TigerTallyComposite；不允許執行期自動補件');
            }
        }

        if (!this.unitInfoComposite) {
            const n = resolveHost(this.unitInfoHost, 'UnitInfoPanel');
            this.unitInfoHost = n;
            this.unitInfoComposite = n.getComponent(UnitInfoComposite);
            if (!this.unitInfoComposite) {
                throw new Error('[BattleScenePanel] Canvas/UnitInfoPanel 缺少 UnitInfoComposite；不允許執行期自動補件');
            }
        }

        if (!this.tigerTallyDetailComposite) {
            const n = resolveHost(this.tigerTallyDetailHost, 'TigerTallyDetailPanel');
            this.tigerTallyDetailHost = n;
            this.tigerTallyDetailComposite = n.getComponent(TigerTallyDetailComposite);
            if (!this.tigerTallyDetailComposite) {
                throw new Error('[BattleScenePanel] Canvas/TigerTallyDetailPanel 缺少 TigerTallyDetailComposite；不允許執行期自動補件');
            }
        }

        if (!this.actionCommandComposite) {
            const n = resolveHost(this.actionCommandHost, 'ActionCommandPanel');
            this.actionCommandHost = n;
            this.actionCommandComposite = n.getComponent(ActionCommandComposite);
            if (!this.actionCommandComposite) {
                throw new Error('[BattleScenePanel] Canvas/ActionCommandPanel 缺少 ActionCommandComposite；不允許執行期自動補件');
            }
        }

        if (!this.battleLogComposite) {
            const n = resolveHost(this.battleLogHost, 'BattleLogPanel');
            this.battleLogHost = n;
            this.battleLogComposite = n.getComponent(BattleLogComposite);
            if (!this.battleLogComposite) {
                throw new Error('[BattleScenePanel] Canvas/BattleLogPanel 缺少 BattleLogComposite；不允許執行期自動補件');
            }
        }

        if (!this.battleHUDComposite && !this.battleHUD) {
            // [Fix-DoubleHUD-v2] 場景節點名為 'HUD'（非 'BattleHUD'），需同時搜尋兩者
            // 若 ensureHUD() 已在 'HUD' 節點掛載 BattleHUDComposite，直接複用；
            // 不可新建 'BattleHUD' 節點否則會產生第二套 BattleHUDComposite 渲染。
            const n = this.battleHUDHost
                ?? canvas.getChildByName('BattleHUD')
                ?? canvas.getChildByName('HUD');
            if (!n) {
                throw new Error('[BattleScenePanel] missing Canvas/HUD host; BattleScene.scene must provide static HUD host');
            }
            this.battleHUDHost = n;
            const existingHUD = n.getComponent('BattleHUD') as BattleHUD | null;
            if (existingHUD) {
                this.battleHUD = existingHUD;
            } else {
                this.battleHUDComposite = n.getComponent(BattleHUDComposite);
                if (!this.battleHUDComposite) {
                    throw new Error('[BattleScenePanel] Canvas/HUD 缺少 BattleHUDComposite；不允許執行期自動補件');
                }
            }
        }
    }

    /**
     * 由外部（BattleScene）注入已初始化的子面板引用，覆蓋 @property 預設 null。
     * Code-first 模式或測試中可直接呼叫，Inspector 模式忽略此方法。
     *
     * Unity 對照：BattleUIManager.InjectPanels(hud, log, ...)
     */
    public wirePanels(options: {
        battleHUD?: BattleHUD | BattleHUDComposite;
        battleLogPanel?: BattleLogComposite;
    }): void {
        // [F-1] 僅在 Inspector 未綁定時才接受外部注入，防止 Code-first 實例覆蓋 Inspector 實例
        if (!this.battleHUDComposite && !this.battleHUD && options.battleHUD) {
            if (options.battleHUD instanceof BattleHUDComposite) {
                this.battleHUDComposite = options.battleHUD;
            } else {
                this.battleHUD = options.battleHUD;
            }
        }
        if (!this.battleLogComposite && options.battleLogPanel instanceof BattleLogComposite) {
            this.battleLogComposite = options.battleLogPanel;
        }
        // [P3-R1c] 已改用事件總線，無需再呼叫 _wireCallbacks()
    }

    onDestroy(): void {
        this._unsubs.forEach(fn => fn());
        this._unsubs.length = 0;
    }

    // ── 串接各子面板 ─────────────────────────────────────────

    private _subscribeEvents(): void {
        this._unsubs.push(
            // [P3-R1c] 訂閱 UI_EVENTS.CardSelected（由 TigerTallyPanel._onCardClick 發送）
            // 取代舊有的 onCardSelect 函式指標注入，消除 _wireCallbacks 的時序依賴
            services().event.on(UI_EVENTS.CardSelected, (payload: { index: number; data: TallyCardData }) => {
                this._onCardSelected(payload.index, payload.data);
            }),
            services().event.on(EVENT_NAMES.TurnPhaseChanged, this._onTurnPhaseChanged.bind(this)),
        );
    }

    // ── 公開 API（供 BattleScene 調用）────────────────────────

    /**
     * 設置虎符卡片資料（部署時或換將時調用）。
     * Unity 對照：battleUIManager.RefreshHandCards(cards)
     */
    public setCards(cards: TallyCardData[]): void {
        if (this.tigerTallyComposite) {
            this.tigerTallyComposite.setCards(cards);
        }
    }

    /**
     * 追加一行戰鬥日誌。
     * Unity 對照：battleLogPanel.AppendLine(text)
     */
    public appendLog(text: string): void {
        if (this.battleLogComposite) {
            this.battleLogComposite.append(text);
        }
    }

    /**
     * 設定玩家武將的奧義技能列表（ActionCommandPanel 已不再有 setActiveUltimateCount，
     * 改由 setUltimateSkills 驅動顯示槽位數量）。
     */
    public setUltimateSkills(skills: UltimateSkillItem[]): void {
        if (this.actionCommandComposite) {
            this.actionCommandComposite.setUltimateSkills(skills);
        }
    }

    public setTacticSummary(label: string): void {
        if (this.actionCommandComposite) {
            this.actionCommandComposite.setTacticSummary(label);
        }
    }

    // ── 私有事件處理 ─────────────────────────────────────────

    /** 卡片選中：顯示兵種詳情面板 */
    private _onCardSelected(_index: number, data: TallyCardData): void {
        if (this.unitInfoComposite?.isVisible) {
            this.unitInfoComposite.hide();
        }

        if (this.tigerTallyDetailComposite) {
            void this.tigerTallyDetailComposite.show(data);
            return;
        }

        if (this.unitInfoComposite) {
            void this.unitInfoComposite.show(data);
        }
    }

    /**
     * TurnPhaseChanged handler：
     *   - PlayerDeploy 階段：ActionCommand 互動啟用
     *   - 非玩家階段：暫時禁用，避免錯誤輸入
     *
     * Unity 對照：BattleUIManager.OnPhaseChanged(TurnPhase phase)
     */
    private _onTurnPhaseChanged(data: { phase: TurnPhase; faction?: Faction }): void {
        // [Fix-ActionCmd] TurnPhaseChanged payload 是 {turn, phase, playerFood}，不含 faction
        // 原先的 data.faction === Faction.Player 永遠是 undefined === 0 = false
        // → ActionCommandPanel 在每次 TurnPhaseChanged 後都被強制隱藏
        const isPlayerTurn = data.phase === TurnPhase.PlayerDeploy;

        const actionCmd = this.actionCommandComposite;
        if (actionCmd) {
            actionCmd.node.active = isPlayerTurn;
        }

        // 日誌補充：標示回合切換
        const phaseLabel = isPlayerTurn ? '玩家回合' : '等待中…';
        this.appendLog(`【${phaseLabel}】`);
    }
}
