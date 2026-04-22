// @spec-source → 見 docs/cross-reference-index.md
import { _decorator, Button, Color, Component, Node, UITransform, Widget } from 'cc';
import { UIID, LayerType } from '../../core/config/UIConfig';
import type { GeneralConfig, GeneralDetailDefaultTab } from '../../core/models/GeneralUnit';
import { services } from '../../core/managers/ServiceLoader';
import type { UIManagedController } from '../../core/managers/UIManager';
import { SceneName } from '../../core/config/Constants';
import type { BattleEntryParams } from '../../battle/models/BattleEntryParams';
import { DEFAULT_BATTLE_ENTRY_PARAMS } from '../../battle/models/BattleEntryParams';
import type { EncounterConfig } from '../../battle/views/BattleSceneLoader';
import { BattleTactic } from '../../core/config/Constants';
import { GeneralListComposite } from '../components/GeneralListComposite';
import { GeneralDetailComposite } from '../components/GeneralDetailComposite';
import { EliteTroopCodexComposite, type EliteTroopCodexOpenPayload } from '../components/EliteTroopCodexComposite';
import { UIScreenPreviewHost } from '../components/UIScreenPreviewHost';
import { SolidBackground } from '../components/SolidBackground';
import { ToastMessage } from '../components/ToastMessage';

const { ccclass } = _decorator;

interface GeneralListOpenPayload {
    generals: GeneralConfig[];
    onSelectGeneral: (config: GeneralConfig) => void | Promise<void>;
}

interface ScreenButtonBinding {
    buttonId: string;
    handler: () => void;
}

@ccclass('LobbyScene')
export class LobbyScene extends Component {

    private _generals: GeneralConfig[] = [];
    private _encounters: EncounterConfig[] = [];
    private _listPanel: GeneralListComposite | null = null;
    private _detailPanel: GeneralDetailComposite | null = null;
    private _lobbyMainHost: UIScreenPreviewHost | null = null;
    private _shopMainHost: UIScreenPreviewHost | null = null;
    private _gachaMainHost: UIScreenPreviewHost | null = null;
    private _gachaHost: UIScreenPreviewHost | null = null;
    private _bloodlineMirrorAwakeningHost: UIScreenPreviewHost | null = null;
    private _eliteTroopCodexPanel: EliteTroopCodexComposite | null = null;
    private _ready = false;

    /** 等待 LobbyScene 資料初始化完成（供 headless smoke route 使用） */
    public async waitForReady(timeoutMs = 8000): Promise<boolean> {
        const start = Date.now();
        while (!this._ready && Date.now() - start < timeoutMs) {
            await new Promise<void>((r) => setTimeout(r, 80));
        }
        return this._ready;
    }

    async start() {
        // 為 LobbyScene 大背板生成穩定的組件背景
        const bgNode = this.node.getChildByName('Background');
        if (bgNode) {
            let bg = bgNode.getComponent(SolidBackground) || bgNode.addComponent(SolidBackground);
            bg.color = new Color(15, 20, 25, 255);
        }

        // 初始化子系統（列表與彈窗）
        const listNode = this.node.getChildByName('GeneralListPanel');
        this._listPanel = listNode?.getComponent(GeneralListComposite) || listNode?.addComponent(GeneralListComposite) || null;

        this._ensureWidget(listNode);

        const detailNode = this.node.getChildByName('GeneralDetailComposite');
        this._detailPanel = detailNode?.getComponent(GeneralDetailComposite) || detailNode?.addComponent(GeneralDetailComposite) || null;
        this._ensureWidget(detailNode);

        await this._mountLobbyMainHub();
        await this._mountSecondaryMainHubs();
        await this._mountEliteTroopCodexPanel();
        this._registerUIControllers();
        await services().ui.open(UIID.LobbyMain);

        // 動態注入輕提示系統 (Toast)
        const toastNode = new Node('ToastContainer');
        toastNode.layer = this.node.layer;
        toastNode.parent = this.node;
        this._ensureWidget(toastNode);
        toastNode.addComponent(ToastMessage);

        // 載入武將、技能與特效資料
        try {
            await Promise.all([
                services().loadSkills(),
                services().loadVfxEffects()
            ]);
            
            this._generals = await services().resource.loadJson<GeneralConfig[]>(
                'data/generals', { tags: ['LobbyScene'] }
            );
            const encounterEnvelope = await services().resource.loadJson<{ encounters: EncounterConfig[] }>(
                'data/encounters', { tags: ['LobbyScene'] }
            );
            this._encounters = encounterEnvelope.encounters ?? [];
        } catch (error) {
            console.error('[LobbyScene] 載入資料失敗:', error);
        }

        // 測試 Toast
        this.scheduleOnce(() => {
            services().event.emit('SHOW_TOAST', { message: '系統：水墨金屬 UI 已啟動 (v2.2)' });
        }, 1);

        this._ready = true;
    }

    protected onDestroy(): void {
        void services().ui.closeAll();
    }

    private async _mountLobbyMainHub(): Promise<void> {
        const hostNode = this.node.getChildByName('LobbyMainHost') ?? new Node('LobbyMainHost');
        hostNode.layer = this.node.layer;
        if (!hostNode.parent) {
            hostNode.parent = this.node;
        }

        this._ensureWidget(hostNode);
        const backgroundIndex = this.node.getChildByName('Background')?.getSiblingIndex() ?? -1;
        hostNode.setSiblingIndex(Math.max(backgroundIndex + 1, 0));

        this._lobbyMainHost = hostNode.getComponent(UIScreenPreviewHost) ?? hostNode.addComponent(UIScreenPreviewHost);
        await this._lobbyMainHost.showScreen('lobby-main-screen');

        const binder = this._lobbyMainHost.binder;
        const generalsButton = binder?.getButton('btnGenerals');
        const battleButton = binder?.getButton('btnBattle');
        const shopButton = binder?.getButton('btnShop');
        const gachaButton = binder?.getButton('btnGacha');
        const supportCardButton = binder?.getButton('btnSupportCard');
        const floodBattleButton = binder?.getButton('btnFloodBattle');

        if (!generalsButton || !battleButton || !shopButton || !gachaButton || !supportCardButton || !floodBattleButton) {
            throw new Error('[LobbyScene] lobby-main-screen 缺少 btnGenerals / btnBattle / btnShop / btnGacha / btnSupportCard / btnFloodBattle 綁定');
        }

        generalsButton.node.off(Button.EventType.CLICK, this.onClickGeneralList, this);
        generalsButton.node.on(Button.EventType.CLICK, this.onClickGeneralList, this);

        battleButton.node.off(Button.EventType.CLICK, this.onClickEnterBattle, this);
        battleButton.node.on(Button.EventType.CLICK, this.onClickEnterBattle, this);

        shopButton.node.off(Button.EventType.CLICK, this.onClickShopMain, this);
        shopButton.node.on(Button.EventType.CLICK, this.onClickShopMain, this);

        gachaButton.node.off(Button.EventType.CLICK, this.onClickGachaMain, this);
        gachaButton.node.on(Button.EventType.CLICK, this.onClickGachaMain, this);

        supportCardButton.node.off(Button.EventType.CLICK, this.onClickSupportCard, this);
        supportCardButton.node.on(Button.EventType.CLICK, this.onClickSupportCard, this);

        floodBattleButton.node.off(Button.EventType.CLICK, this.onClickFloodBattle, this);
        floodBattleButton.node.on(Button.EventType.CLICK, this.onClickFloodBattle, this);

        hostNode.active = false;
    }

    private async _mountSecondaryMainHubs(): Promise<void> {
        this._shopMainHost = await this._mountPreviewScreenHost('ShopMainHost', 'shop-main-screen', [
            { buttonId: 'btnClose', handler: () => { void services().ui.goBack(); } },
        ]);

        this._gachaMainHost = await this._mountPreviewScreenHost('GachaMainHost', 'gacha-main-screen', [
            { buttonId: 'BackBtn', handler: () => { void this._goBackToLobby(); } },
            { buttonId: 'DestinyShopBtn', handler: () => { void services().ui.open(UIID.ShopMain); } },
            { buttonId: 'Pull1Btn', handler: () => { this._openUIOnNextTick(UIID.Gacha); } },
            { buttonId: 'Pull10Btn', handler: () => { this._openUIOnNextTick(UIID.Gacha); } },
        ]);

        this._gachaHost = await this._mountPreviewScreenHost('GachaHost', 'gacha-main-screen', [
            { buttonId: 'BackBtn', handler: () => { void this._goBackToLobby(); } },
            { buttonId: 'DestinyShopBtn', handler: () => { void services().ui.open(UIID.ShopMain); } },
            { buttonId: 'Pull1Btn', handler: () => { void services().ui.goBack(); } },
            { buttonId: 'Pull10Btn', handler: () => { void services().ui.goBack(); } },
        ]);

        this._bloodlineMirrorAwakeningHost = await this._mountPreviewScreenHost('BloodlineMirrorAwakeningHost', 'bloodline-mirror-awakening-screen', [
            { buttonId: 'PrimaryActionButton', handler: () => { void services().ui.goBack(); } },
        ]);
    }

    private async _mountEliteTroopCodexPanel(): Promise<void> {
        const panelNode = this.node.getChildByName('EliteTroopCodexComposite') ?? new Node('EliteTroopCodexComposite');
        panelNode.layer = this.node.layer;
        if (!panelNode.parent) {
            panelNode.parent = this.node;
        }

        this._ensureWidget(panelNode);
        const backgroundIndex = this.node.getChildByName('Background')?.getSiblingIndex() ?? -1;
        panelNode.setSiblingIndex(Math.max(backgroundIndex + 1, panelNode.getSiblingIndex()));

        this._eliteTroopCodexPanel = panelNode.getComponent(EliteTroopCodexComposite) ?? panelNode.addComponent(EliteTroopCodexComposite);
        panelNode.active = false;
    }

    private async _mountPreviewScreenHost(
        hostName: string,
        screenId: string,
        bindings: ScreenButtonBinding[] = [],
    ): Promise<UIScreenPreviewHost> {
        const hostNode = this.node.getChildByName(hostName) ?? new Node(hostName);
        hostNode.layer = this.node.layer;
        if (!hostNode.parent) {
            hostNode.parent = this.node;
        }

        this._ensureWidget(hostNode);
        const backgroundIndex = this.node.getChildByName('Background')?.getSiblingIndex() ?? -1;
        hostNode.setSiblingIndex(Math.max(backgroundIndex + 1, hostNode.getSiblingIndex()));

        const host = hostNode.getComponent(UIScreenPreviewHost) ?? hostNode.addComponent(UIScreenPreviewHost);
        await host.showScreen(screenId);
        this._bindScreenButtons(host, bindings);
        hostNode.active = false;
        return host;
    }

    private _bindScreenButtons(host: UIScreenPreviewHost, bindings: ScreenButtonBinding[]): void {
        const binder = host.binder;
        if (!binder) {
            throw new Error(`[LobbyScene] ${host.node.name} 尚未建立 binder，無法綁定按鈕`);
        }

        for (const { buttonId, handler } of bindings) {
            const button = binder.getButton(buttonId);
            if (!button) {
                throw new Error(`[LobbyScene] ${host.node.name} 缺少 ${buttonId} 綁定`);
            }

            button.node.off(Button.EventType.CLICK, handler, this);
            button.node.on(Button.EventType.CLICK, handler, this);
        }
    }

    private _registerUIControllers(): void {
        services().ui.setupLayers({
            [LayerType.UI]: this.node,
            [LayerType.PopUp]: this.node,
            [LayerType.Dialog]: this.node,
        });

        const lobbyMainController = this._createLobbyMainController();
        const generalListController = this._createGeneralListController();
        const generalDetailController = this._createGeneralDetailController();
        const shopMainController = this._createPreviewScreenController(this._shopMainHost, 'shop-main-screen');
        const gachaMainController = this._createPreviewScreenController(this._gachaMainHost, 'gacha-main-screen');
        const gachaController = this._createPreviewScreenController(this._gachaHost, 'gacha-main-screen', () => {
            this._applyGachaFlowPresentation(this._gachaHost, true);
        });
        const bloodlineMirrorAwakeningController = this._createPreviewScreenController(this._bloodlineMirrorAwakeningHost, 'bloodline-mirror-awakening-screen');
        const eliteTroopCodexController = this._createEliteTroopCodexController();

        services().ui.register(UIID.LobbyMain, lobbyMainController);
        services().ui.register(UIID.GeneralList, generalListController);
        services().ui.register(UIID.GeneralDetail, generalDetailController);
        services().ui.register(UIID.ShopMain, shopMainController);
        services().ui.register(UIID.GachaMain, gachaMainController);
        services().ui.register(UIID.Gacha, gachaController);
        services().ui.register(UIID.BloodlineMirrorAwakening, bloodlineMirrorAwakeningController);
        services().ui.register(UIID.EliteTroopCodex, eliteTroopCodexController);
    }

    private _createEliteTroopCodexController(): UIManagedController {
        if (!this._eliteTroopCodexPanel) {
            throw new Error('[LobbyScene] EliteTroopCodexComposite 尚未初始化，無法註冊至 UIManager');
        }

        return {
            node: this._eliteTroopCodexPanel.node,
            show: async (payload?: unknown) => {
                await this._eliteTroopCodexPanel!.show(payload as EliteTroopCodexOpenPayload | undefined);
            },
            hide: () => {
                this._eliteTroopCodexPanel!.hide();
            },
        };
    }

    private _createGeneralDetailController(): UIManagedController {
        if (!this._detailPanel) {
            throw new Error('[LobbyScene] GeneralDetailComposite 尚未初始化，無法註冊至 UIManager');
        }

        return {
            node: this._detailPanel.node,
            show: async (payload?: unknown) => {
                const config = payload as GeneralConfig | undefined;
                if (!config) {
                    throw new Error('[LobbyScene] GeneralDetail 開啟時缺少 GeneralConfig payload');
                }
                this._detailPanel!.onRequestClose = null;
                await this._detailPanel!.show(config);
            },
            hide: () => {
                this._detailPanel!.hide();
            },
        };
    }

    private _createPreviewScreenController(
        host: UIScreenPreviewHost | null,
        screenId: string,
        onShown?: () => void,
    ): UIManagedController {
        if (!host) {
            throw new Error(`[LobbyScene] ${screenId} host 尚未初始化，無法註冊至 UIManager`);
        }

        return {
            node: host.node,
            show: async () => {
                host.node.active = true;
                await host.showScreen(screenId);
                onShown?.();
            },
            hide: () => {
                host.node.active = false;
            },
        };
    }

    private _applyGachaFlowPresentation(host: UIScreenPreviewHost | null, flowMode: boolean): void {
        if (!host?.binder) {
            return;
        }

        host.binder.setActives({
            PoolTabBar: !flowMode,
            FeaturedBanner: true,
            PityInfoBar: !flowMode,
            RateInfoBtn: !flowMode,
            CurrencyBar: !flowMode,
            PullButtons: !flowMode,
            DivinationTokenBar: !flowMode,
        });
    }

    private _openUIOnNextTick(uiId: UIID): void {
        this.scheduleOnce(() => {
            void services().ui.open(uiId);
        }, 0);
    }

    private async _goBackToLobby(): Promise<void> {
        const wentBack = await services().ui.goBack();
        if (!wentBack) {
            await services().ui.open(UIID.LobbyMain);
        }
    }

    private _createLobbyMainController(): UIManagedController {
        if (!this._lobbyMainHost) {
            throw new Error('[LobbyScene] LobbyMainHost 尚未初始化，無法註冊至 UIManager');
        }

        return {
            node: this._lobbyMainHost.node,
            show: async () => {
                this._lobbyMainHost!.node.active = true;
                await this._lobbyMainHost!.showScreen('lobby-main-screen');
            },
            hide: () => {
                this._lobbyMainHost!.node.active = false;
            },
        };
    }

    private _createGeneralListController(): UIManagedController {
        if (!this._listPanel) {
            throw new Error('[LobbyScene] GeneralListComposite 尚未初始化，無法註冊至 UIManager');
        }

        let lastPayload: GeneralListOpenPayload | null = null;
        this._listPanel.onRequestClose = () => {
            void services().ui.closeCurrentUI();
        };

        return {
            node: this._listPanel.node,
            show: async (payload?: unknown) => {
                const nextPayload = payload as GeneralListOpenPayload | undefined;
                if (nextPayload) {
                    lastPayload = nextPayload;
                }

                const activePayload = lastPayload ?? {
                    generals: this._generals,
                    onSelectGeneral: (config: GeneralConfig) => this._openGeneralDetailDirect(config),
                };

                this._listPanel!.onSelectGeneral = activePayload.onSelectGeneral;
                await this._listPanel!.show(activePayload.generals);
            },
            hide: () => {
                this._listPanel!.node.active = false;
            },
        };
    }

    private _ensureWidget(node: Node | null | undefined) {
        if (!node) return;
        node.layer = this.node.layer;
        const ut = node.getComponent(UITransform) || node.addComponent(UITransform);
        ut.setContentSize(1920, 1080);
        const widget = node.getComponent(Widget) || node.addComponent(Widget);
        widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
        widget.top = widget.bottom = widget.left = widget.right = 0;
    }

    // ──────────────────────────────────────────
    // Button Click Event 回呼（由 scene-flow-builder 或 Inspector 綁定）
    // ──────────────────────────────────────────

    private async _showGeneralListWithHandler(
        onSelectGeneral: (config: GeneralConfig) => void | Promise<void>,
    ): Promise<void> {
        await services().ui.open(UIID.GeneralList, {
            generals: this._generals,
            onSelectGeneral,
        } satisfies GeneralListOpenPayload);
    }

    private async _openGeneralDetailDirect(config: GeneralConfig): Promise<void> {
        if (!this._detailPanel) {
            throw new Error('[LobbyScene] GeneralDetailComposite 尚未初始化，無法直接開啟武將詳情');
        }
        this._detailPanel.onRequestClose = () => {
            this._detailPanel?.hide();
        };
        await this._detailPanel.show(config);
    }

    /** 「武將列表」按鈕 */
    public onClickGeneralList() {
        void this._showGeneralListWithHandler((config: GeneralConfig) => this._openGeneralDetailDirect(config));
    }

    /** 供 LoadingScene / headless preview 使用的武將列表 smoke route。 */
    public async previewGeneralListSmoke(): Promise<void> {
        await this._showGeneralListWithHandler((config: GeneralConfig) => this._openGeneralDetailDirect(config));
    }

    /** 「商城」按鈕 */
    public onClickShopMain() {
        this._openUIOnNextTick(UIID.ShopMain);
    }

    /** 「轉蛋」按鈕 */
    public onClickGachaMain() {
        this._openUIOnNextTick(UIID.GachaMain);
    }

    /** 「支援卡」按鈕 */
    public onClickSupportCard() {
        this.scheduleOnce(() => {
            void services().ui.openAsync(UIID.SupportCard);
        }, 0);
    }

    /** 「虎符圖鑑」按鈕 / 入口 */
    public onClickEliteTroopCodex() {
        void this._openEliteTroopCodex();
    }

    /** 「進入戰鬥」按鈕 */
    /** 最小 smoke route：走既有武將列表 callback 鏈，驗證 General Detail 指定 tab。 */
    public async onClickGeneralDetailOverviewSmoke(previewVariant = '') {
        await this._openGeneralDetailSmoke('Overview', previewVariant);
    }

    public async onClickGeneralDetailSkillsSmoke(previewVariant = '') {
        await this._openGeneralDetailSmoke('Skills', previewVariant);
    }

    /** 供 LoadingScene / headless preview 使用的虎符圖鑑 smoke route。 */
    public async onClickEliteTroopCodexSmoke(previewVariant = ''): Promise<void> {
        await this._openEliteTroopCodex(this._resolveEliteTroopCodexSmokeIndex(previewVariant));
    }

    private async _openEliteTroopCodex(selectedIndex?: number): Promise<void> {
        const payload = typeof selectedIndex === 'number'
            ? { selectedIndex }
            : undefined;
        await services().ui.open(UIID.EliteTroopCodex, payload);
    }

    private _resolveEliteTroopCodexSmokeIndex(previewVariant: string): number | undefined {
        const trimmed = previewVariant.trim();
        if (!trimmed) {
            return undefined;
        }

        if (/^\d+$/.test(trimmed)) {
            const selectedIndex = Math.max(0, parseInt(trimmed, 10) - 1);
            return selectedIndex;
        }

        return undefined;
    }

    private async _openGeneralDetailSmoke(defaultTab: GeneralDetailDefaultTab, previewVariant = '') {
        if (!this._listPanel || !this._detailPanel) {
            console.warn('[LobbyScene] GeneralDetailOverview smoke 失敗：list/detail panel 未就緒');
            return;
        }
        if (this._generals.length === 0) {
            console.warn('[LobbyScene] GeneralDetailOverview smoke 失敗：尚未載入武將資料');
            return;
        }

        const smokeGeneral = this._resolveGeneralDetailSmokeGeneral(previewVariant);
        if (!smokeGeneral) {
            console.warn(`[LobbyScene] GeneralDetailOverview smoke 失敗：找不到對應武將 variant=${previewVariant || '(default)'}`);
            return;
        }

        // smoke route 與正式產品流共用同一段 list-open controller path，避免繞過 LobbyMain → GeneralList 的入口邏輯
        await this._showGeneralListWithHandler(async (config: GeneralConfig) => {
            await services().ui.open(UIID.GeneralDetail, {
                ...config,
                profilePresentation: {
                    ...config.profilePresentation,
                    defaultTab,
                },
            });
        });

        await Promise.resolve(this._listPanel.onSelectGeneral?.(smokeGeneral));
    }

    private _resolveGeneralDetailSmokeGeneral(previewVariant: string): GeneralConfig | null {
        const requested = previewVariant.trim().toLowerCase();
        let preferredId: string | null = null;

        if (requested === 'zhen-ji' || requested === 'zhenji' || requested === 'smoke-zhen-ji') {
            preferredId = 'zhen-ji';
        } else if (requested === 'zhao-yun' || requested === 'zhaoyun') {
            preferredId = 'zhao-yun';
        } else if (requested === 'zhang-fei' || requested === 'zhangfei' || requested === 'smoke-zhang-fei') {
            preferredId = 'zhang-fei';
        } else if (requested && requested !== 'default' && requested !== 'zhang-fei' && requested !== 'zhangfei' && requested !== 'smoke-zhang-fei') {
            preferredId = requested;
        }

        return (preferredId ? this._generals.find((item) => item.id === preferredId) : null)
            ?? this._generals[0]
            ?? null;
    }

    public onClickEnterBattle() {
        services().scene.switchScene(SceneName.Battle, this._buildBattleEntryParams());
    }

    public onClickFloodBattle() {
        services().scene.switchScene(SceneName.Battle, this._buildBattleEntryParams(BattleTactic.FloodAttack));
    }

    /** 「退出」按鈕 */
    public onClickExit() {
        services().scene.switchScene(SceneName.Login);
    }

    private _buildBattleEntryParams(battleTactic?: BattleTactic): BattleEntryParams {
        const encounter = this._encounters[0];
        if (!encounter) {
            return {
                ...DEFAULT_BATTLE_ENTRY_PARAMS,
                entrySource: 'lobby',
                battleTactic: battleTactic ?? DEFAULT_BATTLE_ENTRY_PARAMS.battleTactic,
            };
        }

        return {
            entrySource: 'lobby',
            encounterId: encounter.id,
            playerGeneralId: encounter.playerGeneralId,
            enemyGeneralId: encounter.enemyGeneralId,
            playerEquipment: [...(encounter.playerEquipment ?? [])],
            enemyEquipment: [...(encounter.enemyEquipment ?? [])],
            selectedCardIds: [],
            weather: encounter.weather ?? DEFAULT_BATTLE_ENTRY_PARAMS.weather,
            battleTactic: battleTactic ?? encounter.battleTactic ?? DEFAULT_BATTLE_ENTRY_PARAMS.battleTactic,
            backgroundId: battleTactic === BattleTactic.FloodAttack ? undefined : encounter.backgroundId,
        };
    }
}
