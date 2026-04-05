// @spec-source → 見 docs/cross-reference-index.md
/**
 * BattleHUD — 戰鬥介面抬頭顯示器
 *
 * ⭐ 已遷移至 Template + Binder 架構
 *
 * 佈局由 battle-hud-main.json，皮膚由 battle-hud-default.json。
 * 節點綁定由 UITemplateBinder 自動完成，元件只負責業務邏輯。
 * HP bar 因需 SolidBackground 仍在 onBuildComplete 中處理。
 *
 * Unity 對照：GameHUDController，監聽事件更新各個 Binding
 */
import { _decorator, Button, Color, Label, Node, UITransform, Vec3 } from 'cc';
import { EVENT_NAMES, Faction, GAME_CONFIG } from '../../core/config/Constants';
import { services } from '../../core/managers/ServiceLoader';
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';
import { UISpecLoader } from '../core/UISpecLoader';
import { UITemplateBinder } from '../core/UITemplateBinder';
import { SolidBackground } from './SolidBackground';

const { ccclass } = _decorator;

@ccclass('BattleHUD')
export class BattleHUD extends UIPreviewBuilder {

    // ── 私有狀態 ─────────────────────────────────────────────
    private get _specLoader() { return services().specLoader; }
    private _initialized = false;
    private _buildCompleted = false;
    private _playerGeneralMaxHp = 1;
    private _enemyGeneralMaxHp  = 1;
    private readonly _unsubs: Array<() => void> = [];
    private readonly _readyWaiters: Array<(ready: boolean) => void> = [];
    /** 暫存 refresh() 在初始化完成前的呼叫參數，onBuildComplete 後自動重播 */
    private _pendingRefreshArgs: [number, number, number, number, number, number, number] | null = null;
    private _pendingPlayerName: string | null = null;
    private _pendingEnemyName: string | null = null;

    // ── 節點引用（由 onBuildComplete 填入）──────────────────
    private _turnLabel:           Label  | null = null;
    private _foodLabel:           Label  | null = null;
    private _statusLabel:         Label  | null = null;
    private _playerNameLabel:     Label  | null = null;
    private _enemyNameLabel:      Label  | null = null;
    private _playerFortressLabel: Label  | null = null;
    private _enemyFortressLabel:  Label  | null = null;
    // HP bar：以 SolidBackground 子節點 + 直接設 contentSize.width 取代 ProgressBar
    private _playerFortressFill:  Node   | null = null;
    private _enemyFortressFill:   Node   | null = null;
    private _playerFortressTotalW = 691;  // 36% x 1920（onBuildComplete 後更新）
    private _enemyFortressTotalW  = 691;
    private _playerPortraitNode:  Node | null = null;
    private _enemyPortraitNode:   Node | null = null;

    // ── 生命週期 ─────────────────────────────────────────────

    async onLoad(): Promise<void> {
        await this._initialize();

        // 確保 ServiceLoader 已初始化
        services().initialize(this.node);
        this._subscribeEvents();
    }

    private async _initialize(): Promise<void> {
        if (this._initialized) return;

        console.log('[BattleHUD] _initialize: 開始載入 battle-hud-screen 規格');
        console.log(`[BattleHUD] _initialize: 掛載節點 name="${this.node?.name}" parent="${this.node?.parent?.name ?? 'null'}" active=${this.node?.active}`);
        try {
            const t0 = Date.now();
            const [fullScreen, i18n] = await Promise.all([
                this._specLoader.loadFullScreen('battle-hud-screen'),
                this._specLoader.loadI18n(services().i18n.currentLocale),
            ]);
            console.log(`[BattleHUD] _initialize: 規格載入完成 (${Date.now() - t0}ms) layout="${fullScreen?.layout?.id ?? '?'}" skin="${fullScreen?.skin?.id ?? '?'}"`);
            if (!fullScreen?.layout) {
                console.error('[BattleHUD] _initialize: fullScreen.layout 為 null/undefined，battle-hud-screen.json 可能缺少 layout 欄位或對應 layout JSON 不存在');
                this._initialized = true;
                return;
            }
            console.log('[BattleHUD] _initialize: 開始 buildScreen');
            await this.buildScreen(fullScreen.layout, fullScreen.skin, i18n);
            console.log('[BattleHUD] _initialize: buildScreen 完成');
            this._initialized = true;
            this._replayPendingRefresh();
            this._flushReadyWaiters(true);
        } catch (e) {
            console.error('[BattleHUD] _initialize: 規格載入或建構失敗，退回白模', e);
            console.error('[BattleHUD] _initialize: 錯誤堆疊 →', (e as Error)?.stack ?? e);
            this._initialized = true;
            this._flushReadyWaiters(false);
        }
    }

    onDestroy(): void {
        this._unsubs.forEach(fn => fn());
        this._unsubs.length = 0;
    }

    // ── 覆寫建構點 ─────────────────────────────

    protected onReady(binder: UITemplateBinder): void {
        // 自動綁定所有標籤 — 不再需要手寫 BFS
        this._turnLabel           = binder.getLabel('TurnLabel');
        this._foodLabel           = binder.getLabel('FoodLabel');
        this._statusLabel         = binder.getLabel('StatusLabel');
        this._playerNameLabel     = binder.getLabel('PlayerName');
        this._enemyNameLabel      = binder.getLabel('EnemyName');
        this._playerFortressLabel = binder.getLabel('PlayerFortressLabel');
        this._enemyFortressLabel  = binder.getLabel('EnemyFortressLabel');

        // 初始文字（必須在 onReady 設定，onBuildComplete 時 binder 尚未綁定）
        this._turnLabel           && (this._turnLabel.string           = '第 1 回合');
        this._foodLabel           && (this._foodLabel.string           = '🌾 糧草 - / -');
        this._playerFortressLabel && (this._playerFortressLabel.string = '- / -');
        this._enemyFortressLabel  && (this._enemyFortressLabel.string  = '- / -');
        this._playerNameLabel     && (this._playerNameLabel.string     = this._pendingPlayerName ?? '玩家');
        this._enemyNameLabel      && (this._enemyNameLabel.string      = this._pendingEnemyName  ?? '敵方');
        this._statusLabel         && (this._statusLabel.string         = '');

        // 頭像點擊 → 開啟武將快覽彈窗（v3-5）
        this._playerPortraitNode = binder.getNode('PlayerPortrait');
        this._enemyPortraitNode  = binder.getNode('EnemyPortrait');
        this._bindPortraitInteraction(this._playerPortraitNode, 'player');
        this._bindPortraitInteraction(this._enemyPortraitNode, 'enemy');
    }

    protected onBuildComplete(_rootNode: Node): void {
        this._buildCompleted = true;

        // HP bar：SolidBackground 填充（UITemplateBinder 不處理此類特殊元件）
        const findInBuilt = (name: string): Node | null => {
            const queue: Node[] = [_rootNode];
            while (queue.length > 0) {
                const cur = queue.shift()!;
                if (cur.name === name) return cur;
                queue.push(...cur.children);
            }
            return null;
        };

        try {
            [this._playerFortressFill, this._playerFortressTotalW] = this._ensureBarFill(findInBuilt('PlayerFortressBar'), true);
            [this._enemyFortressFill,  this._enemyFortressTotalW]  = this._ensureBarFill(findInBuilt('EnemyFortressBar'),  false);
        } catch (e) {
            console.warn('[BattleHUD] _ensureBarFill 失敗', e);
        }

        // 隱藏非新建子樹（避免與 legacy 節點重疊）
        for (const child of this.node.children) {
            if (child !== _rootNode) child.active = false;
        }

        console.log('[BattleHUD] onBuildComplete 完成');
    }

    /**
     * 在血條外框節點上建立 SolidBackground 填充子節點，回傳 [fillNode, totalWidth]。
     * Unity 對照：建立 Image Fill 子物件並以 RectTransform.sizeDelta.x 控制寬度
     */
    private _ensureBarFill(node: Node | null, isPlayer: boolean): [Node | null, number] {
        if (!node) return [null, 691];

        const tf = node.getComponent(UITransform);
        const totalW = (tf?.contentSize.width ?? 0) > 0 ? tf!.contentSize.width : 691;
        const totalH = (tf?.contentSize.height ?? 0) > 0 ? tf!.contentSize.height : 20;

        // 外框：深色半透明底板
        const bgSolid = node.getComponent(SolidBackground) ?? node.addComponent(SolidBackground);
        bgSolid.color = new Color(0, 0, 0, 160);

        // 填充子節點（從左往右縮放）
        let fillNode = node.getChildByName('HpBarFill');
        if (!fillNode) {
            fillNode = new Node('HpBarFill');
            fillNode.layer = node.layer;
            const fillTf = fillNode.addComponent(UITransform);
            fillTf.setContentSize(totalW, totalH);
            // anchor (0, 0.5)：左邊對齊，垂直置中
            fillTf.anchorX = 0;
            fillTf.anchorY = 0.5;
            // 將填充左緣對齊外框左緣：外框 anchor 預設 (0.5, 0.5)，左緣在 -totalW/2
            fillNode.setPosition(-totalW / 2, 0, 0);
            node.addChild(fillNode);
            // SolidBackground 在 addComponent 後即在 active 的節點上觸發 onLoad
            const fillSolid = fillNode.addComponent(SolidBackground);
            fillSolid.color = isPlayer
                ? new Color(50, 160, 255, 255)   // 藍色 — 我軍
                : new Color(220, 60,  60,  255);  // 紅色 — 敵軍
        }

        return [fillNode, totalW];
    }

    private _flushReadyWaiters(ready: boolean): void {
        while (this._readyWaiters.length > 0) {
            const resolve = this._readyWaiters.shift();
            resolve?.(ready);
        }
    }

    // ── 事件訂閱 ─────────────────────────────────────────────

    private _subscribeEvents(): void {
        const svc = services();
        this._unsubs.push(
            svc.event.on(EVENT_NAMES.TurnPhaseChanged,   this._onTurnPhaseChanged.bind(this)),
            svc.event.on(EVENT_NAMES.GeneralDamaged,     this._onGeneralDamaged.bind(this)),
            svc.event.on(EVENT_NAMES.GeneralSkillUsed,   this._onGeneralSkillUsed.bind(this)),
            svc.event.on(EVENT_NAMES.GeneralSkillEffect, this._onSkillEffect.bind(this)),
        );
    }

    private _onTurnPhaseChanged(snap: { turn: number; playerDp: number }): void {
        this._setTurn(snap.turn);
        this._setFood(snap.playerDp, GAME_CONFIG.MAX_DP);
        this._clearStatus();
    }

    private _onGeneralDamaged(data: { faction: Faction; hp: number }): void {
        this._setGeneralHealth(data.faction, data.hp);
    }

    private _onGeneralSkillUsed(data: { faction: Faction }): void {
        if (data.faction === Faction.Player) {
            this._showStatus('武將發動技能！');
        }
    }

    private _onSkillEffect(data: { skillId: string; faction: Faction }): void {
        if (data.skillId === 'zhang-fei-roar') {
            this._showStatus('⚡ 震吼！敵方全體暈眩 1 回合！盾牆瓦解！');
        }
    }

    // ── 公開 API（由 BattleScene 呼叫） ─────────────────────

    /**
     * 初始化並顯示 HUD 數值
     */
    public refresh(
        turn: number,
        food: number,
        maxFood: number,
        playerGeneralHp: number,
        playerGeneralMaxHp: number,
        enemyGeneralHp: number,
        enemyGeneralMaxHp: number,
    ): void {
        if (!this._initialized) {
            // [UI-2-0027] 初始化尚未完成（buildScreen 仍在非同步執行中），
            // 暫存參數，等 onBuildComplete 完成後由 _replayPendingRefresh() 自動重播。
            // Unity 對照：在 Awake 呼叫 Start() 期業務邏輯的 Deferred 處理
            console.warn('[BattleHUD] refresh() 在初始化完成前被呼叫 — 已暫存，初始化完成後將自動重播');
            this._pendingRefreshArgs = [turn, food, maxFood, playerGeneralHp, playerGeneralMaxHp, enemyGeneralHp, enemyGeneralMaxHp];
            return;
        }
        this._setTurn(turn);
        this._setFood(food, maxFood);
        this._playerGeneralMaxHp = Math.max(1, playerGeneralMaxHp);
        this._enemyGeneralMaxHp  = Math.max(1, enemyGeneralMaxHp);
        this._setGeneralHealth(Faction.Player, playerGeneralHp);
        this._setGeneralHealth(Faction.Enemy,  enemyGeneralHp);
        this._clearStatus();
        console.log(
            `[BattleHUD] refresh — 第${turn}回合 food:${food}/${maxFood}`,
            `playerHP:${playerGeneralHp}/${playerGeneralMaxHp}`,
            `enemyHP:${enemyGeneralHp}/${enemyGeneralMaxHp}`,
            `initialized:${this._initialized}`,
        );
    }

    /**
     * 重播在 buildScreen 完成前暫存的 refresh() 呼叫。
     * 由 onBuildComplete 末尾觸發，確保首幀數值正確顯示。
     */
    private _replayPendingRefresh(): void {
        if (!this._pendingRefreshArgs) return;
        const [turn, food, maxFood, phpHp, phpMax, ehp, eMax] = this._pendingRefreshArgs;
        this._pendingRefreshArgs = null;
        // 直接呼叫內部方法，繞過 _initialized 檢查（此時節點樹已建立完成）
        this._setTurn(turn);
        this._setFood(food, maxFood);
        this._playerGeneralMaxHp = Math.max(1, phpMax);
        this._enemyGeneralMaxHp  = Math.max(1, eMax);
        this._setGeneralHealth(Faction.Player, phpHp);
        this._setGeneralHealth(Faction.Enemy,  ehp);
        this._clearStatus();
        console.log(`[BattleHUD] _replayPendingRefresh 完成 — 第${turn}回合 food:${food}/${maxFood}`);
    }

    public setFood(food: number, maxFood: number): void { this._setFood(food, maxFood); }

    public get playerSpBarNode(): Node | null { return null; }
    public get enemySpBarNode():  Node | null { return null; }

    /**
     * 玩家/敵方武將顯示名稱（由 BattleScene 在 start() 填入）
     * Unity 對照：HeroInfoDisplay.SetGeneralName(name)
     */
    public setPlayerName(name: string): void {
        this._pendingPlayerName = name;
        if (this._playerNameLabel) this._playerNameLabel.string = name;
    }

    public setEnemyName(name: string): void {
        this._pendingEnemyName = name;
        if (this._enemyNameLabel) this._enemyNameLabel.string = name;
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

    /**
     * 頭像點擊：廣播 RequestGeneralQuickView 意圖事件（僅攜帶 side / isEnemy）。
     * BattleScene 訂閱此事件後，注入完整的武將資料，再廣播 ShowGeneralQuickView。
     *
     * Unity 對照：HeroPortraitButton.OnClick() → EventBus.Publish<RequestGeneralInfoEvent>(faction)
     */
    private _onPortraitClick(side: 'player' | 'enemy'): void {
        const isEnemy = side === 'enemy';
        services().event.emit(EVENT_NAMES.RequestGeneralQuickView, { side, isEnemy });
        console.log(`[BattleHUD] 頭像點擊 → ${side}`);
    }

    private _bindPortraitInteraction(node: Node | null, side: 'player' | 'enemy'): void {
        if (!node) return;

        const defaultScale = node.scale.clone();
        const pressedScale = new Vec3(defaultScale.x * 1.05, defaultScale.y * 1.05, defaultScale.z);

        node.on(Button.EventType.CLICK, () => this._onPortraitClick(side), this);
        node.on(Node.EventType.TOUCH_START, () => {
            node.setScale(pressedScale);
        }, this);

        const resetScale = () => node.setScale(defaultScale);
        node.on(Node.EventType.TOUCH_END, resetScale, this);
        node.on(Node.EventType.TOUCH_CANCEL, resetScale, this);
    }

    // ── 內部更新方法 ─────────────────────────────────────────

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

    /** 依 ratio (0~1) 直接設定填充子節點的寬度（從左往右）*/
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

    private _clearStatus(): void {
        if (this._statusLabel) this._statusLabel.string = '';
    }
}
