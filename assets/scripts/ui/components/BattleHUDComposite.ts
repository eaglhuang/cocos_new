// @spec-source → 見 docs/cross-reference-index.md  (UCUF M12)
/**
 * BattleHUDComposite — 戰鬥 HUD（CompositePanel 版）
 *
 * UCUF M12 — 將 BattleHUD（UIPreviewBuilder）遷移至 CompositePanel 架構。
 *
 * 遷移重點：
 *   - buildScreen(layout, skin, i18n) → mount('battle-hud-screen')
 *   - onReady(binder)                 → _onAfterBuildReady(binder)
 *   - onBuildComplete(rootNode)       → onBuildComplete(rootNode)（保留 SolidBackground HP bar 邏輯）
 *   - 公開 API 完全與原 BattleHUD 相同（向後相容）
 *
 * Unity 對照：GameHUDController，監聽事件更新各個 Binding
 */
import { _decorator, Button, Color, Label, Node, Sprite, UITransform, Vec3 } from 'cc';
import { EVENT_NAMES, Faction, GAME_CONFIG } from '../../core/config/Constants';
import { buildBattleSkillEffectMessage, buildBattleSkillUsedMessage } from '../../battle/skills/BattleSkillPresentation';
import { services } from '../../core/managers/ServiceLoader';
import { CompositePanel } from '../core/CompositePanel';
import { UITemplateBinder } from '../core/UITemplateBinder';
import { SolidBackground } from './SolidBackground';

const { ccclass } = _decorator;

@ccclass('BattleHUDComposite')
export class BattleHUDComposite extends CompositePanel {

    // ── 私有狀態 ─────────────────────────────────────────────
    private _isMounted = false;
    private _buildCompleted = false;
    private _playerGeneralMaxHp = 1;
    private _enemyGeneralMaxHp  = 1;
    private readonly _unsubs: Array<() => void> = [];
    private readonly _readyWaiters: Array<(ready: boolean) => void> = [];
    /** 暫存 refresh() 在 mount 完成前的呼叫參數，mount 後自動重播 */
    private _pendingRefreshArgs: [number, number, number, number, number, number, number] | null = null;
    private _pendingPlayerName: string | null = null;
    private _pendingEnemyName: string | null = null;
    private _pendingPlayerGeneralId: string | null = null;
    private _pendingEnemyGeneralId: string | null = null;
    private _pendingSceneGambitBadgeText: string | null = null;
    private _playerPortraitLoadSeq = 0;
    private _enemyPortraitLoadSeq = 0;
    private _persistentStatusMsg: string | null = null;

    // ── 節點引用（由 _onAfterBuildReady / onBuildComplete 填入）──
    private _turnLabel:           Label  | null = null;
    private _foodLabel:           Label  | null = null;
    private _statusLabel:         Label  | null = null;
    private _sceneGambitBadgeDock: Node   | null = null;
    private _sceneGambitBadgeLabel: Label | null = null;
    private _playerNameLabel:     Label  | null = null;
    private _enemyNameLabel:      Label  | null = null;
    private _playerFortressLabel: Label  | null = null;
    private _enemyFortressLabel:  Label  | null = null;
    // HP bar：以 SolidBackground 子節點 + 直接設 contentSize.width 取代 ProgressBar
    private _playerFortressFill:  Node   | null = null;
    private _enemyFortressFill:   Node   | null = null;
    private _playerFortressTotalW = 691;
    private _enemyFortressTotalW  = 691;
    private _playerPortraitNode:  Node | null = null;
    private _enemyPortraitNode:   Node | null = null;

    // ── 生命週期 ─────────────────────────────────────────────

    async onLoad(): Promise<void> {
        services().initialize(this.node);
        await this.show();
    }

    /**
     * 初次呼叫時掛載畫面，後續呼叫為 no-op。
     * 掛載完成後自動重播暫存的 refresh / setName / setGeneralId。
     */
    public async show(): Promise<void> {
        if (!this._isMounted) {
            await this.mount('battle-hud-screen');
            this._isMounted = true;
        }
        this._subscribeEvents();
        this._replayPendingCalls();
    }

    protected onDestroy(): void {
        this.unmount();
        this._isMounted = false;
        this._unsubs.forEach(fn => fn());
    }

    // ── CompositePanel 鉤子 ───────────────────────────────────

    /**
     * buildScreen 完成後，綁定 Label 節點與頭像互動。
     * Unity 對照：MonoBehaviour.Start()
     */
    protected override _onAfterBuildReady(binder: UITemplateBinder): void {
        this._turnLabel           = binder.getLabel('TurnLabel');
        this._foodLabel           = binder.getLabel('FoodLabel');
        this._statusLabel         = binder.getLabel('StatusLabel');
        this._sceneGambitBadgeDock = binder.getNode('SceneGambitBadgeDock');
        this._sceneGambitBadgeLabel = binder.getLabel('SceneGambitBadgeLabel');
        this._playerNameLabel     = binder.getLabel('PlayerNameLabel');
        this._enemyNameLabel      = binder.getLabel('EnemyNameLabel');
        this._playerFortressLabel = binder.getLabel('PlayerFortressLabel');
        this._enemyFortressLabel  = binder.getLabel('EnemyFortressLabel');
        this._playerPortraitNode  = binder.getNode('PlayerPortrait');
        this._enemyPortraitNode   = binder.getNode('EnemyPortrait');

        this._bindPortraitInteraction(this._playerPortraitNode, 'player');
        this._bindPortraitInteraction(this._enemyPortraitNode,  'enemy');
    }

    /**
     * 節點樹建構完成後，建立 SolidBackground HP bar 填充子節點。
     * HP bar 使用非標準 Widget，不在 binder 系統內，需在此處處理。
     *
     * Unity 對照：Awake() — 取得物件引用並初始化非標準元件。
     */
    protected override onBuildComplete(rootNode: Node): void {
        this._playerFortressFill = this._ensureBarFill(rootNode, 'PlayerFortressBar', Color.GREEN);
        this._enemyFortressFill  = this._ensureBarFill(rootNode, 'EnemyFortressBar',  Color.RED);

        const playerBarTf = rootNode.getChildByPath('PlayerFortressBar')?.getComponent(UITransform);
        const enemyBarTf  = rootNode.getChildByPath('EnemyFortressBar')?.getComponent(UITransform);
        if (playerBarTf) this._playerFortressTotalW = playerBarTf.contentSize.width;
        if (enemyBarTf)  this._enemyFortressTotalW  = enemyBarTf.contentSize.width;

        this._buildCompleted = true;
        this._flushReadyWaiters(true);
    }

    // ── 公開 API（與原 BattleHUD 完全相同）──────────────────

    /**
     * 刷新 HUD 所有數據欄位。
     * 若 mount 尚未完成，呼叫會被暫存，待 mount 後自動重播。
     */
    public refresh(
        turn:       number,
        food:       number,
        maxFood:    number,
        playerHp:   number,
        playerMaxHp: number,
        enemyHp:    number,
        enemyMaxHp: number,
    ): void {
        if (!this._buildCompleted) {
            this._pendingRefreshArgs = [turn, food, maxFood, playerHp, playerMaxHp, enemyHp, enemyMaxHp];
            return;
        }
        this._playerGeneralMaxHp = playerMaxHp;
        this._enemyGeneralMaxHp  = enemyMaxHp;
        this._setTurn(turn);
        this._setFood(food, maxFood);
        this._setGeneralHealth(Faction.Player, playerHp);
        this._setGeneralHealth(Faction.Enemy,  enemyHp);
    }

    public setFood(food: number, maxFood: number): void {
        this._setFood(food, maxFood);
    }

    public setPlayerName(name: string): void {
        if (!this._buildCompleted) { this._pendingPlayerName = name; return; }
        if (this._playerNameLabel) this._playerNameLabel.string = name;
    }

    public setEnemyName(name: string): void {
        if (!this._buildCompleted) { this._pendingEnemyName = name; return; }
        if (this._enemyNameLabel) this._enemyNameLabel.string = name;
    }

    public setPlayerGeneralId(generalId: string): void {
        this._pendingPlayerGeneralId = generalId;
        if (this._buildCompleted) this._refreshPortrait('player');
    }

    public setEnemyGeneralId(generalId: string): void {
        this._pendingEnemyGeneralId = generalId;
        if (this._buildCompleted) this._refreshPortrait('enemy');
    }

    public showPersistentStatus(msg: string): void {
        const nextMsg = msg.trim();
        this._persistentStatusMsg = nextMsg.length > 0 ? nextMsg : null;

        if (this._persistentStatusMsg) {
            this._showStatus(this._persistentStatusMsg);
            return;
        }

        this._clearStatus();
    }

    public clearPersistentStatus(): void {
        this._persistentStatusMsg = null;
        this._clearStatus();
    }

    /** SP bar 目前未使用，保留介面相容性 */
    public get playerSpBarNode(): Node | null { return null; }
    public get enemySpBarNode():  Node | null { return null; }

    /**
     * 等待 HUD 建構完成的 Promise。
     * @param timeoutMs  超時毫秒（預設 5000ms）
     */
    public waitUntilReady(timeoutMs = 5000): Promise<boolean> {
        if (this._buildCompleted) return Promise.resolve(true);
        return new Promise<boolean>((finish) => {
            this._readyWaiters.push(finish);
            this.scheduleOnce(() => finish(this._buildCompleted), Math.max(0, timeoutMs) / 1000);
        });
    }

    // ── 私有工具 ─────────────────────────────────────────────

    private _flushReadyWaiters(ready: boolean): void {
        for (const fn of this._readyWaiters) fn(ready);
        this._readyWaiters.length = 0;
    }

    /**
     * 確保 HP bar 容器下存在 SolidBackground 填充子節點。
     * 若已存在則直接回傳；若不存在則建立。
     */
    private _ensureBarFill(root: Node, barPath: string, color: Color): Node | null {
        const barNode = root.getChildByPath(barPath);
        if (!barNode) return null;

        const tf = barNode.getComponent(UITransform);
        const totalW = tf?.contentSize.width ?? 691;
        const totalH = tf?.contentSize.height ?? 20;

        let fillNode = barNode.getChildByPath('Fill');
        if (!fillNode) {
            fillNode = new Node('Fill');
            barNode.addChild(fillNode);
            const bg = fillNode.addComponent(SolidBackground);
            bg.setColor(color);
            const fillTf = fillNode.addComponent(UITransform);
            fillTf.setContentSize(totalW, totalH);

            const anchorPoint = fillNode.getComponent(UITransform) ?? fillTf;
            const pos = fillNode.position.clone();
            fillNode.setPosition(-(totalW / 2), pos.y, pos.z);
        }
        return fillNode;
    }

    /**
     * 訂閱戰鬥相關事件。
     * 呼叫前確保 services().event 已初始化。
     */
    private _subscribeEvents(): void {
        if (this._unsubs.length > 0) return; // 防止重複訂閱
        const ev = services().event;
        this._unsubs.push(
            ev.on(EVENT_NAMES.TurnPhaseChanged,  (d) => this._onTurnPhaseChanged(d as { turn: number; food: number; maxFood: number })),
            ev.on(EVENT_NAMES.GeneralDamaged,    (d) => this._onGeneralDamaged(d as { faction: Faction; hp: number; maxHp: number })),
            ev.on(EVENT_NAMES.GeneralSkillUsed,  (d) => this._onGeneralSkillUsed(d as { faction: Faction; skillId?: string; skillName?: string; sourceType?: any })),
            ev.on(EVENT_NAMES.GeneralSkillEffect,(d) => this._onSkillEffect(d as { faction: Faction; skillId: string })),
        );
    }

    private _replayPendingCalls(): void {
        if (this._pendingRefreshArgs) {
            this.refresh(...this._pendingRefreshArgs);
            this._pendingRefreshArgs = null;
        }
        if (this._pendingPlayerName !== null) {
            this.setPlayerName(this._pendingPlayerName);
            this._pendingPlayerName = null;
        }
        if (this._pendingEnemyName !== null) {
            this.setEnemyName(this._pendingEnemyName);
            this._pendingEnemyName = null;
        }
        if (this._pendingPlayerGeneralId !== null) {
            this._refreshPortrait('player');
        }
        if (this._pendingEnemyGeneralId !== null) {
            this._refreshPortrait('enemy');
        }
        if (this._pendingSceneGambitBadgeText !== null) {
            this.showSceneGambitBadge(this._pendingSceneGambitBadgeText);
            this._pendingSceneGambitBadgeText = null;
        }
    }

    public showSceneGambitBadge(text: string): void {
        const nextText = text.trim();
        this._pendingSceneGambitBadgeText = nextText.length > 0 ? nextText : null;

        if (!this._buildCompleted) {
            return;
        }

        const visible = this._pendingSceneGambitBadgeText !== null;
        if (this._sceneGambitBadgeDock) {
            this._sceneGambitBadgeDock.active = visible;
        }
        if (this._sceneGambitBadgeLabel && this._pendingSceneGambitBadgeText !== null) {
            this._sceneGambitBadgeLabel.string = this._pendingSceneGambitBadgeText;
        }
    }

    public clearSceneGambitBadge(): void {
        this._pendingSceneGambitBadgeText = null;
        if (this._sceneGambitBadgeDock) {
            this._sceneGambitBadgeDock.active = false;
        }
        if (this._sceneGambitBadgeLabel) {
            this._sceneGambitBadgeLabel.string = '';
        }
    }

    // ── 事件處理 ─────────────────────────────────────────────

    private _onTurnPhaseChanged(d: { turn: number; food: number; maxFood: number }): void {
        this._setTurn(d.turn);
        this._setFood(d.food, d.maxFood);
    }

    private _onGeneralDamaged(d: { faction: Faction; hp: number; maxHp: number }): void {
        if (d.faction === Faction.Player) this._playerGeneralMaxHp = d.maxHp;
        else                              this._enemyGeneralMaxHp  = d.maxHp;
        this._setGeneralHealth(d.faction, d.hp);
    }

    private _onGeneralSkillUsed(d: { faction: Faction; skillId?: string; skillName?: string; sourceType?: any }): void {
        const skillId = d.skillId ?? d.skillName ?? null;
        const fallback = d.faction === Faction.Player ? '我方使用技能' : '敵方使用技能';
        this._flashStatus(skillId ? buildBattleSkillUsedMessage(skillId, d.faction, d.sourceType) : fallback);
    }

    private _onSkillEffect(d: { faction: Faction; skillId: string }): void {
        this._flashStatus(buildBattleSkillEffectMessage(d.skillId));
    }

    // ── 頭像互動 ─────────────────────────────────────────────

    private _onPortraitClick(side: 'player' | 'enemy'): void {
        const isEnemy = side === 'enemy';
        services().event.emit(EVENT_NAMES.RequestGeneralQuickView, { side, isEnemy });
        console.log(`[BattleHUDComposite] 頭像點擊 → ${side}`);
    }

    private _bindPortraitInteraction(node: Node | null, side: 'player' | 'enemy'): void {
        if (!node) return;
        const defaultScale = node.scale.clone();
        const pressedScale = new Vec3(defaultScale.x * 1.05, defaultScale.y * 1.05, defaultScale.z);

        node.on(Button.EventType.CLICK, () => this._onPortraitClick(side), this);
        node.on(Node.EventType.TOUCH_START, () => { node.setScale(pressedScale); }, this);
        const resetScale = () => node.setScale(defaultScale);
        node.on(Node.EventType.TOUCH_END,   resetScale, this);
        node.on(Node.EventType.TOUCH_CANCEL,resetScale, this);
    }

    private _refreshPortrait(side: 'player' | 'enemy'): void {
        void this._applyPortrait(side);
    }

    private async _applyPortrait(side: 'player' | 'enemy'): Promise<void> {
        const portraitNode = side === 'player' ? this._playerPortraitNode : this._enemyPortraitNode;
        const generalId    = side === 'player' ? this._pendingPlayerGeneralId : this._pendingEnemyGeneralId;
        const fallbackPath = this._getPortraitFallbackPath(side);

        if (!portraitNode) return;

        const loadSeq = side === 'player'
            ? ++this._playerPortraitLoadSeq
            : ++this._enemyPortraitLoadSeq;

        const portraitPath = generalId ? this._buildPortraitPath(generalId) : fallbackPath;
        const spriteFrame = await services().resource.loadSpriteFrame(portraitPath).catch(async (error) => {
            if (portraitPath !== fallbackPath) {
                console.warn(`[BattleHUDComposite] ${side} portrait 載入失敗，退回 placeholder: ${portraitPath}`, error);
            }
            return services().resource.loadSpriteFrame(fallbackPath).catch(() => null);
        });

        const latestSeq = side === 'player' ? this._playerPortraitLoadSeq : this._enemyPortraitLoadSeq;
        if (loadSeq !== latestSeq || !spriteFrame) return;

        const sprite = portraitNode.getComponent(Sprite) ?? portraitNode.addComponent(Sprite);
        sprite.spriteFrame = spriteFrame;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    }

    private _buildPortraitPath(generalId: string): string {
        return `sprites/generals/${generalId.replace(/-/g, '_')}_portrait`;
    }

    private _getPortraitFallbackPath(side: 'player' | 'enemy'): string {
        return side === 'player'
            ? 'sprites/battle/portrait_player_placeholder'
            : 'sprites/battle/portrait_enemy_placeholder';
    }

    // ── 內部更新 ─────────────────────────────────────────────

    private _setTurn(turn: number): void {
        if (this._turnLabel) this._turnLabel.string = `第 ${turn} 回合`;
    }

    private _setFood(food: number, maxFood: number): void {
        if (this._foodLabel) this._foodLabel.string = `🌾 糧草 ${food} / ${maxFood}`;
    }

    private _setGeneralHealth(faction: Faction, hp: number): void {
        const max   = faction === Faction.Player ? this._playerGeneralMaxHp : this._enemyGeneralMaxHp;
        const ratio = max > 0 ? hp / max : 0;

        if (faction === Faction.Player) {
            this._setBarFillRatio(this._playerFortressFill, this._playerFortressTotalW, ratio);
            if (this._playerFortressLabel) this._playerFortressLabel.string = `${hp} / ${max}`;
        } else {
            this._setBarFillRatio(this._enemyFortressFill, this._enemyFortressTotalW, ratio);
            if (this._enemyFortressLabel) this._enemyFortressLabel.string = `${hp} / ${max}`;
        }
    }

    private _setBarFillRatio(fillNode: Node | null, totalW: number, ratio: number): void {
        if (!fillNode) return;
        const tf = fillNode.getComponent(UITransform);
        if (!tf) return;
        const w = Math.max(0, Math.min(totalW, totalW * ratio));
        tf.setContentSize(w, tf.contentSize.height);
    }

    private _showStatus(msg: string): void {
        if (this._statusLabel) this._statusLabel.string = msg;
    }

    private _flashStatus(msg: string): void {
        this._showStatus(msg);
        this.scheduleOnce(() => {
            if (this._persistentStatusMsg) {
                this._showStatus(this._persistentStatusMsg);
                return;
            }

            this._clearStatus();
        }, GAME_CONFIG.SKILL_STATUS_DISPLAY_MS / 1000);
    }

    private _clearStatus(): void {
        if (this._statusLabel) this._statusLabel.string = '';
    }
}
