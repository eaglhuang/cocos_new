// @spec-source → 見 docs/cross-reference-index.md
/**
 * BattleHUD — 戰鬥介面抬頭顯示器（新架構版）
 *
 * ⭐ 已遷移至 UIPreviewBuilder 架構
 *
 * 佈局由 battle-hud-main.json 定義，皮膚由 battle-hud-default.json 提供。
 * 業務邏輯（事件訂閱、HP/SP/DP 更新）完整保留。
 *
 * 節點查找策略：
 *   - 透過 id 欄位建立的節點，使用 this.node.getChildByName(id) 查找
 *   - ProgressBar 節點用 image type 佔位，由 BattleHUD 在 onBuildComplete 中
 *     動態加上 ProgressBar 組件（因為 UIPreviewBuilder 不處理 ProgressBar）
 *
 * Unity 對照：GameHUDController，監聽事件更新各個 Binding
 */
import { _decorator, Button, Label, Node, ProgressBar, UITransform } from 'cc';
import { EVENT_NAMES, Faction, GAME_CONFIG } from '../../core/config/Constants';
import { services } from '../../core/managers/ServiceLoader';
import { UIPreviewBuilder } from '../core/UIPreviewBuilder';
import { UISpecLoader } from '../core/UISpecLoader';

const { ccclass } = _decorator;

@ccclass('BattleHUD')
export class BattleHUD extends UIPreviewBuilder {

    // ── 私有狀態 ─────────────────────────────────────────────
    private _specLoader = new UISpecLoader();
    private _initialized = false;
    private _playerGeneralMaxHp = 1;
    private _enemyGeneralMaxHp  = 1;
    private readonly _unsubs: Array<() => void> = [];

    // ── 節點引用（由 onBuildComplete 填入）──────────────────
    private _turnLabel:           Label       | null = null;
    private _foodLabel:           Label       | null = null;
    private _statusLabel:         Label       | null = null;
    private _playerNameLabel:     Label       | null = null;
    private _enemyNameLabel:      Label       | null = null;
    private _playerFortressLabel: Label       | null = null;
    private _enemyFortressLabel:  Label       | null = null;
    private _playerFortressBar:   ProgressBar | null = null;
    private _enemyFortressBar:    ProgressBar | null = null;

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
                this._specLoader.loadI18n('zh-TW'),
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
        } catch (e) {
            console.error('[BattleHUD] _initialize: 規格載入或建構失敗，退回白模', e);
            console.error('[BattleHUD] _initialize: 錯誤堆疊 →', (e as Error)?.stack ?? e);
            this._initialized = true;
        }
    }

    onDestroy(): void {
        this._unsubs.forEach(fn => fn());
        this._unsubs.length = 0;
    }

    // ── 覆寫建構點：綁定節點引用 ─────────────────────────────

    protected onBuildComplete(_rootNode: Node): void {
        // ── [UI-2-0026] 修復：搜尋範圍限定在 UIPreviewBuilder 建構的節點樹 ──
        // 舊方式 getChildByName() 會優先命中場景中遺留的同名 legacy 節點，
        // 改用只在 _rootNode 內做 BFS，確保綁定到正確的新節點。
        // Unity 對照：GetComponentInChildren<Text>() 但限制在特定子樹搜尋
        const findInBuilt = (name: string): Node | null => {
            const queue: Node[] = [_rootNode];
            while (queue.length > 0) {
                const cur = queue.shift()!;
                if (cur.name === name) return cur;
                queue.push(...cur.children);
            }
            return null;
        };

        // 逐項綁定並 log，方便追蹤哪個節點找不到
        const bindLabel = (name: string): Label | null => {
            const n = findInBuilt(name);
            if (!n) {
                console.warn(`[BattleHUD] onBuildComplete: 找不到節點 "${name}" — 請確認 battle-hud-main.json 中有對應的 name 欄位`);
                return null;
            }
            const lbl = n.getComponent(Label);
            if (!lbl) {
                console.warn(`[BattleHUD] onBuildComplete: 節點 "${name}" 找到但無 Label 組件`);
            }
            return lbl;
        };

        this._turnLabel           = bindLabel('TurnLabel');
        this._foodLabel           = bindLabel('FoodLabel');
        this._statusLabel         = bindLabel('StatusLabel');
        this._playerNameLabel     = bindLabel('PlayerName');
        this._enemyNameLabel      = bindLabel('EnemyName');
        this._playerFortressLabel = bindLabel('PlayerFortressLabel');
        this._enemyFortressLabel  = bindLabel('EnemyFortressLabel');

        // ProgressBar 組件：UIPreviewBuilder 建立了 image 節點，
        // 這裡在節點上加掛 ProgressBar 組件實現進度條功能
        this._playerFortressBar = this._ensureProgressBar(findInBuilt('PlayerFortressBar'));
        this._enemyFortressBar  = this._ensureProgressBar(findInBuilt('EnemyFortressBar'));

        if (!this._playerFortressBar) {
            console.warn('[BattleHUD] onBuildComplete: 找不到 PlayerFortressBar 節點，血條將無法顯示');
        }

        // 頭像點擊 → 開啟武將快覽彈窗（v3-5）
        // Unity 對照：portrait.onClick → UIManager.ShowPanel<GeneralInfoPopup>(data)
        const playerPortrait = findInBuilt('PlayerPortrait');
        const enemyPortrait  = findInBuilt('EnemyPortrait');
        playerPortrait?.on(Button.EventType.CLICK, () => this._onPortraitClick('player'), this);
        enemyPortrait?.on(Button.EventType.CLICK,  () => this._onPortraitClick('enemy'),  this);
        if (!playerPortrait) console.warn('[BattleHUD] onBuildComplete: 找不到 PlayerPortrait 節點');

        // ── [UI-2-0026] 隱藏場景舊版 HUD 直接子節點，避免與新節點樹重疊顯示 ──
        // Unity 對照：舊 GameObject 被新版 Prefab 取代時，把舊物件 SetActive(false)
        for (const child of this.node.children) {
            if (child !== _rootNode) {
                child.active = false;
            }
        }

        // ── 初始化所有 bind:"dynamic" 標籤，清除 {dynamic} 佔位符 ──
        if (this._turnLabel)           this._turnLabel.string           = '第 1 回合';
        if (this._foodLabel)           this._foodLabel.string           = 'DP -';
        if (this._playerFortressLabel) this._playerFortressLabel.string = '- / -';
        if (this._enemyFortressLabel)  this._enemyFortressLabel.string  = '- / -';
        if (this._playerNameLabel)     this._playerNameLabel.string     = '玩家';
        if (this._enemyNameLabel)      this._enemyNameLabel.string      = '敵方';
        if (this._statusLabel)         this._statusLabel.string         = '';

        console.log(
            '[BattleHUD] onBuildComplete 完成 —',
            `turnLabel:${!!this._turnLabel}`,
            `foodLabel:${!!this._foodLabel}`,
            `statusLabel:${!!this._statusLabel}`,
            `playerName:${!!this._playerNameLabel}`,
            `enemyName:${!!this._enemyNameLabel}`,
            `playerFortressLabel:${!!this._playerFortressLabel}`,
            `playerFortressBar:${!!this._playerFortressBar}`,
            `enemyFortressBar:${!!this._enemyFortressBar}`,
        );

        // 額外處理：若場景中有殘留的同名節點（不在 _rootNode 下），將其隱藏，避免與新 HUD 重複顯示
        try {
            const canvas = this.node.scene?.getChildByName('Canvas');
            if (canvas) {
                const namesToHide = [
                    'PlayerFortressLabel', 'EnemyFortressLabel', 'PlayerFortressBar', 'EnemyFortressBar',
                    'TurnLabel', 'FoodLabel', 'StatusLabel', 'PlayerPortrait', 'EnemyPortrait'
                ];

                const walk = (n: Node) => {
                    if (n === _rootNode) return; // skip new-built subtree
                    if (namesToHide.indexOf(n.name) >= 0) n.active = false;
                    for (const c of n.children) walk(c);
                };

                for (const child of canvas.children) walk(child);
            }
        } catch (e) {
            // 防禦性容錯：不影響正常流程
        }
    }

    /** 確保節點上有 ProgressBar 組件，回傳組件引用 */
    private _ensureProgressBar(node: Node | null): ProgressBar | null {
        if (!node) return null;
        return node.getComponent(ProgressBar) ?? node.addComponent(ProgressBar);
    }

    /** 深度查找子節點（跨多層 BFS） */
    private _deepFind(name: string): Node | null {
        const queue: Node[] = [this.node];
        while (queue.length > 0) {
            const cur = queue.shift()!;
            if (cur.name === name) return cur;
            queue.push(...cur.children);
        }
        return null;
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
            console.warn('[BattleHUD] refresh() 在初始化完成前被呼叫 — 數值可能無法顯示，請確認 BattleScene 的呼叫時序');
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

    public setFood(food: number, maxFood: number): void { this._setFood(food, maxFood); }

    public get playerSpBarNode(): Node | null { return null; }
    public get enemySpBarNode():  Node | null { return null; }

    /**
     * 玩家/敵方武將顯示名稱（由 BattleScene 在 start() 填入）
     * Unity 對照：HeroInfoDisplay.SetGeneralName(name)
     */
    public setPlayerName(name: string): void {
        if (this._playerNameLabel) this._playerNameLabel.string = name;
    }

    public setEnemyName(name: string): void {
        if (this._enemyNameLabel) this._enemyNameLabel.string = name;
    }

    /**
     * 頭像點擊：廣播 ShowGeneralQuickView 事件。
     * 由外部（BattleScene / GeneralQuickViewPanel）監聽並填入實際資料。
     *
     * Unity 對照：HeroPortraitButton.OnClick() → EventBus.Publish<ShowGeneralInfoEvent>(faction)
     */
    private _onPortraitClick(side: 'player' | 'enemy'): void {
        const isEnemy = side === 'enemy';
        // 僅廣播意圖，實際武將資料由 BattleScene 監聽後注入
        services().event.emit(EVENT_NAMES.ShowGeneralQuickView, { side, isEnemy });
        console.log(`[BattleHUD] 頭像點擊 → ${side}`);
    }

    // ── 內部更新方法 ─────────────────────────────────────────

    private _setTurn(turn: number): void {
        if (this._turnLabel) this._turnLabel.string = `第 ${turn} 回合`;
    }

    private _setFood(food: number, maxFood: number): void {
        if (this._foodLabel) this._foodLabel.string = `DP ${food} / ${maxFood}`;
    }

    private _setGeneralHealth(faction: Faction, hp: number): void {
        const max   = faction === Faction.Player ? this._playerGeneralMaxHp : this._enemyGeneralMaxHp;
        const ratio = max > 0 ? hp / max : 0;

        if (faction === Faction.Player) {
            if (this._playerFortressBar)   this._playerFortressBar.progress   = ratio;
            if (this._playerFortressLabel) this._playerFortressLabel.string   = `${hp} / ${max}`;
        } else {
            if (this._enemyFortressBar)    this._enemyFortressBar.progress    = ratio;
            if (this._enemyFortressLabel)  this._enemyFortressLabel.string    = `${hp} / ${max}`;
        }
    }

    private _showStatus(msg: string): void {
        if (this._statusLabel) this._statusLabel.string = msg;
    }

    private _clearStatus(): void {
        if (this._statusLabel) this._statusLabel.string = '';
    }
}
