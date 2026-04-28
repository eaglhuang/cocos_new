// @spec-source → 見 docs/cross-reference-index.md
import { _decorator, Button, Color, Component, Label, Node, UITransform, Widget } from 'cc';
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
import { LobbyMissionDetailDialogComposite, type LobbyMissionDetailDialogOpenPayload, type MissionGeneralOption } from '../components/LobbyMissionDetailDialogComposite';
import { LocalGachaService } from '../../core/services/LocalGachaService';
import { PlayerRosterService } from '../../core/services/PlayerRosterService';
import { UIScreenPreviewHost } from '../components/UIScreenPreviewHost';
import { SolidBackground } from '../components/SolidBackground';
import { ToastMessage } from '../components/ToastMessage';
import { applyUIPreviewBinderState } from '../core/UIPreviewStateApplicator';
import { buildSpiritFamilyOverviewDisplayModel, type SpiritFamilyOverviewOpenPayload } from '../core/SpiritFamilyOverviewRoute';
import { UITemplateBinder } from '../core/UITemplateBinder';
import { UCUFLogger, LogCategory } from '../core/UCUFLogger';
import { showGachaHistory, showGachaResults, attachCurrencyCheatPanel, detachCurrencyCheatPanel, detachRosterClearButton, ensureGlobalDevOverlay, refreshCurrencyDisplay } from '../dev/GachaDevOverlay';

const { ccclass } = _decorator;

type GeneralDetailRuntimeTab = 'Overview' | 'Stats' | 'Tactics' | 'Bloodline' | 'Equip' | 'Aptitude';
type GeneralDetailEntrySmokeSource = 'ucuf-nav' | 'scene-button';

interface GeneralListOpenPayload {
    generals: GeneralConfig[];
    onSelectGeneral: (config: GeneralConfig) => void | Promise<void>;
    options?: {
        factionFilter?: 'all' | 'player' | 'enemy';
    };
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
    private _spiritFamilyOverviewHost: UIScreenPreviewHost | null = null;
    private _bloodlineMirrorLoadingHost: UIScreenPreviewHost | null = null;
    private _bloodlineMirrorAwakeningHost: UIScreenPreviewHost | null = null;
    private _characterDs3Host: UIScreenPreviewHost | null = null;
    private _eliteTroopCodexPanel: EliteTroopCodexComposite | null = null;
    private _missionDetailDialogPanel: LobbyMissionDetailDialogComposite | null = null;
    private readonly _singlePlayerModeToggleHandles: Array<{ root: Node; label: Label }> = [];
    private readonly _localGachaService = new LocalGachaService();
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
        await this._mountCharacterDs3Host();
        await this._mountEliteTroopCodexPanel();
        await this._mountLobbyMissionDetailDialogPanel();
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
        ensureGlobalDevOverlay(this._localGachaService, undefined, () => { PlayerRosterService.clear(); }, () => {
            this._refreshWalletPreviewState();
        });
    }

    protected onDestroy(): void {
        void services().ui.closeAll();
        detachCurrencyCheatPanel();
        detachRosterClearButton();
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

        this._configureLobbyMainHub(this._lobbyMainHost.binder);
        hostNode.active = false;
    }

    private _configureLobbyMainHub(binder: UITemplateBinder | null): void {
        const generalsButton = binder?.getButton('btnGenerals');
        const battleButton = binder?.getButton('btnBattle');
        const shopButton = binder?.getButton('btnShop');
        const gachaButton = binder?.getButton('btnGacha');
        const supportCardButton = binder?.getButton('btnSupportCard');
        const floodBattleButton = binder?.getButton('btnFloodBattle');
        const spiritFamilyOverviewButton = binder?.getButton('DispatchBoardActionButton');

        if (!binder || !generalsButton || !battleButton || !shopButton || !gachaButton || !supportCardButton || !floodBattleButton) {
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

        if (spiritFamilyOverviewButton) {
            spiritFamilyOverviewButton.node.off(Button.EventType.CLICK, this.onClickSpiritFamilyOverview, this);
            spiritFamilyOverviewButton.node.on(Button.EventType.CLICK, this.onClickSpiritFamilyOverview, this);
        }

        binder.setTexts({
            HeroWallTitle: '世家巡檢',
            DailyTitle: '今日世家總覽',
            DailyBody: '從君主層統覽麾下所有世家、主卡狀態與家族深度，再決定要進入哪一支。',
            DispatchBoardTitle: '世家總覽入口',
            DispatchBoardBody: '先看總覽，再進各家的英靈陳列室；武將命頁只在已形成分支時提供捷徑。',
            DispatchBoardActionLabel: '前往世家總覽',
        });
    }

    private async _mountSecondaryMainHubs(): Promise<void> {
        this._shopMainHost = await this._mountPreviewScreenHost('ShopMainHost', 'shop-main-screen', [
            { buttonId: 'btnClose', handler: () => { void services().ui.goBack(); } },
        ]);

        this._gachaMainHost = await this._mountPreviewScreenHost('GachaMainHost', 'gacha-main-screen', [
            { buttonId: 'Pull1Btn',      handler: () => { this._openUIOnNextTick(UIID.Gacha); } },
            { buttonId: 'Pull10Btn',     handler: () => { this._openUIOnNextTick(UIID.Gacha); } },
            { buttonId: 'HistoryBtn',    handler: () => { void this._showGachaHistory(); } },
            { buttonId: 'GoldSummonBtn', handler: () => { this._openUIOnNextTick(UIID.Gacha); } },
            { buttonId: 'UseTicketBtn',  handler: () => { this._openUIOnNextTick(UIID.Gacha); } },
        ]);

        this._gachaHost = await this._mountPreviewScreenHost('GachaHost', 'gacha-main-screen', [
            { buttonId: 'Pull1Btn',      handler: () => { void this._runLocalGacha(1); } },
            { buttonId: 'Pull10Btn',     handler: () => { void this._runLocalGacha(10); } },
            { buttonId: 'HistoryBtn',    handler: () => { void this._showGachaHistory(); } },
            { buttonId: 'GoldSummonBtn', handler: () => { void this._runGoldSummon(); } },
            { buttonId: 'UseTicketBtn',  handler: () => { void this._runTicketSummon(); } },
        ]);
        attachCurrencyCheatPanel(this._localGachaService, undefined, () => { PlayerRosterService.clear(); }, () => {
            this._refreshWalletPreviewState();
        });
        this._refreshWalletPreviewState();

        this._spiritFamilyOverviewHost = await this._mountPreviewScreenHost('SpiritFamilyOverviewHost', 'bloodline-mirror-loading-screen', [
            { buttonId: 'PrimaryActionButton', handler: () => { void services().ui.goBack(); } },
        ]);

        this._bloodlineMirrorLoadingHost = await this._mountPreviewScreenHost('BloodlineMirrorLoadingHost', 'bloodline-mirror-loading-screen', [
            { buttonId: 'PrimaryActionButton', handler: () => { void services().ui.goBack(); } },
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

    private async _mountLobbyMissionDetailDialogPanel(): Promise<void> {
        const panelNode = this.node.getChildByName('LobbyMissionDetailDialogComposite') ?? new Node('LobbyMissionDetailDialogComposite');
        panelNode.layer = this.node.layer;
        if (!panelNode.parent) {
            panelNode.parent = this.node;
        }

        this._ensureWidget(panelNode);
        const backgroundIndex = this.node.getChildByName('Background')?.getSiblingIndex() ?? -1;
        panelNode.setSiblingIndex(Math.max(backgroundIndex + 1, panelNode.getSiblingIndex()));

        this._missionDetailDialogPanel = panelNode.getComponent(LobbyMissionDetailDialogComposite) ?? panelNode.addComponent(LobbyMissionDetailDialogComposite);
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

    private async _mountCharacterDs3Host(): Promise<void> {
        this._characterDs3Host = await this._mountPreviewScreenHost('CharacterDs3Host', 'character-ds3-main');
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
        const gachaMainController = this._createPreviewScreenController(this._gachaMainHost, 'gacha-main-screen', () => {
            this._refreshWalletPreviewState();
        });
        const gachaController = this._createPreviewScreenController(this._gachaHost, 'gacha-main-screen', () => {
            this._applyGachaFlowPresentation(this._gachaHost, true);
            this._refreshWalletPreviewState();
        });
        const spiritFamilyOverviewController = this._createSpiritFamilyOverviewController();
        const bloodlineMirrorLoadingController = this._createPreviewScreenController(this._bloodlineMirrorLoadingHost, 'bloodline-mirror-loading-screen');
        const bloodlineMirrorAwakeningController = this._createPreviewScreenController(this._bloodlineMirrorAwakeningHost, 'bloodline-mirror-awakening-screen');
        const eliteTroopCodexController = this._createEliteTroopCodexController();
        const missionDetailDialogController = this._createLobbyMissionDetailDialogController();

        services().ui.register(UIID.LobbyMain, lobbyMainController);
        services().ui.register(UIID.GeneralList, generalListController);
        services().ui.register(UIID.GeneralDetail, generalDetailController);
        services().ui.register(UIID.ShopMain, shopMainController);
        services().ui.register(UIID.GachaMain, gachaMainController);
        services().ui.register(UIID.Gacha, gachaController);
        services().ui.register(UIID.SpiritFamilyOverview, spiritFamilyOverviewController);
        services().ui.register(UIID.BloodlineMirrorLoading, bloodlineMirrorLoadingController);
        services().ui.register(UIID.BloodlineMirrorAwakening, bloodlineMirrorAwakeningController);
        services().ui.register(UIID.EliteTroopCodex, eliteTroopCodexController);
        services().ui.register(UIID.LobbyMissionDetailDialog, missionDetailDialogController);
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

    private _createLobbyMissionDetailDialogController(): UIManagedController {
        if (!this._missionDetailDialogPanel) {
            throw new Error('[LobbyScene] LobbyMissionDetailDialogComposite cannot be registered before mount');
        }

        return {
            node: this._missionDetailDialogPanel.node,
            show: async (payload?: unknown) => {
                const dialogPayload = payload as LobbyMissionDetailDialogOpenPayload | undefined;
                const availableGenerals = dialogPayload?.availableGenerals?.length
                    ? dialogPayload.availableGenerals
                    : this._buildMissionDetailGeneralOptions();
                const resolvedGeneral = this._resolveMissionDetailSmokeGeneral(
                    dialogPayload?.previewVariant ?? '',
                    availableGenerals,
                    dialogPayload,
                );

                await this._missionDetailDialogPanel!.show({
                    ...dialogPayload,
                    availableGenerals,
                    selectedGeneralId: dialogPayload?.selectedGeneralId ?? resolvedGeneral?.id,
                    selectedGeneralLabel: dialogPayload?.selectedGeneralLabel ?? resolvedGeneral?.label,
                    selectedGeneralVolunteer: dialogPayload?.selectedGeneralVolunteer ?? resolvedGeneral?.volunteer,
                });
            },
            hide: () => {
                this._missionDetailDialogPanel!.hide();
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
                this._bringNodeToFront(host.node);
                await host.showScreen(screenId);
                onShown?.();
            },
            hide: () => {
                host.node.active = false;
            },
        };
    }

    private _createSpiritFamilyOverviewController(): UIManagedController {
        if (!this._spiritFamilyOverviewHost) {
            throw new Error('[LobbyScene] SpiritFamilyOverviewHost 尚未初始化，無法註冊至 UIManager');
        }

        return {
            node: this._spiritFamilyOverviewHost.node,
            show: async (payload?: unknown) => {
                const host = this._spiritFamilyOverviewHost!;
                host.node.active = true;
                this._bringNodeToFront(host.node);
                await host.showScreen('bloodline-mirror-loading-screen');
                this._applySpiritFamilyOverviewState(host.binder, payload as SpiritFamilyOverviewOpenPayload | undefined);
            },
            hide: () => {
                this._spiritFamilyOverviewHost!.node.active = false;
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

    private _applySpiritFamilyOverviewState(
        binder: UITemplateBinder | null,
        payload?: SpiritFamilyOverviewOpenPayload,
    ): void {
        if (!binder) {
            return;
        }

        const displayModel = buildSpiritFamilyOverviewDisplayModel(payload);
        applyUIPreviewBinderState(binder, {
            texts: displayModel.texts,
            actives: {
                UnownedVeil: false,
                PublicHero: true,
                SpiritHero: true,
            },
        });

        const storyPathMap = {
            origin: 'StoryStrip/StoryCellOrigin',
            bloodline: 'StoryStrip/StoryCellBloodline',
            trial: 'StoryStrip/StoryCellTrial',
            awakening: 'StoryStrip/StoryCellAwakening',
            future: 'StoryStrip/StoryCellFuture',
        } as const;

        for (const [key, basePath] of Object.entries(storyPathMap) as Array<[keyof typeof storyPathMap, string]>) {
            const storyCell = displayModel.storyCells[key];
            binder.setTextsByPath({
                [`${basePath}/StoryTitle`]: storyCell.title,
                [`${basePath}/StoryBody`]: storyCell.body,
            });
        }
    }

    private _bringNodeToFront(node: Node): void {
        const parent = node.parent;
        if (!parent) {
            return;
        }
        node.setSiblingIndex(parent.children.length - 1);
    }

    private _refreshWalletPreviewState(): void {
        const wallet = this._localGachaService.getWalletSnapshot();
        const gemText = `玉 ${wallet.gems.toLocaleString('zh-TW')}`;
        const goldText = `金 ${wallet.gold.toLocaleString('zh-TW')}`;
        const gachaBalanceText = `◈ ${wallet.gems.toLocaleString('zh-TW')}`;

        this._lobbyMainHost?.binder?.setTexts({
            ResourceGold: goldText,
            ResourceGem: gemText,
        });

        this._gachaMainHost?.binder?.setTexts({
            CostBalanceValue: gachaBalanceText,
        });

        this._gachaHost?.binder?.setTexts({
            CostBalanceValue: gachaBalanceText,
        });
    }

    private _createLobbyMainController(): UIManagedController {
        if (!this._lobbyMainHost) {
            throw new Error('[LobbyScene] LobbyMainHost 尚未初始化，無法註冊至 UIManager');
        }

        return {
            node: this._lobbyMainHost.node,
            show: async () => {
                this._lobbyMainHost!.node.active = true;
                this._bringNodeToFront(this._lobbyMainHost!.node);
                await this._lobbyMainHost!.showScreen('lobby-main-screen');
                this._configureLobbyMainHub(this._lobbyMainHost!.binder);
                this._refreshWalletPreviewState();
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
                    options: { factionFilter: 'all' },
                };

                this._listPanel!.onSelectGeneral = activePayload.onSelectGeneral;
                this._bringNodeToFront(this._listPanel!.node);
                await this._listPanel!.show(activePayload.generals, activePayload.options?.factionFilter ?? 'all');
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
        options: { factionFilter?: 'all' | 'player' | 'enemy' } = { factionFilter: 'all' },
    ): Promise<void> {
        await services().ui.open(UIID.GeneralList, {
            generals: this._generals,
            onSelectGeneral,
            options,
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

    private async _openCharacterDs3FromListSelection(config: GeneralConfig): Promise<void> {
        if (!this._characterDs3Host) {
            throw new Error('[LobbyScene] CharacterDs3Host 尚未初始化，無法開啟 DS3 人物頁');
        }

        if (services().ui.isOpen(UIID.GeneralList)) {
            await services().ui.closeCurrentUI();
        } else {
            this._listPanel?.hide();
        }

        this._characterDs3Host.node.active = true;
        this._bringNodeToFront(this._characterDs3Host.node);
        await this._characterDs3Host.showScreen('character-ds3-main');

        UCUFLogger.info(LogCategory.LIFECYCLE, '[LobbyScene] CharacterDs3 smoke selection opened screen host', {
            generalId: config.id,
            generalName: config.name,
            screenId: 'character-ds3-main',
        });
    }

    /** 「武將列表」按鈕：顯示玄家已取得武將（源自轉蛋 / PlayerRosterService） */
    public onClickGeneralList() {
        const roster = PlayerRosterService.getAll();
        const displayList = roster.length > 0 ? roster : this._generals;
        void services().ui.open(UIID.GeneralList, {
            generals: displayList,
            onSelectGeneral: (config: GeneralConfig) => this._openGeneralDetailDirect(config),
            options: { factionFilter: 'all' },
        } satisfies GeneralListOpenPayload);
    }

    /** 供 LoadingScene / headless preview 使用的武將列表 smoke route。 */
    public async previewGeneralListSmoke(): Promise<void> {
        await this._showGeneralListWithHandler((config: GeneralConfig) => this._openGeneralDetailDirect(config), {
            factionFilter: 'all',
        });
    }

    public async previewGeneralDetailEntrySmoke(source: GeneralDetailEntrySmokeSource, previewVariant = ''): Promise<void> {
        if (!this._listPanel) {
            throw new Error('[LobbyScene] GeneralListComposite 尚未初始化，無法執行正式入口 smoke route');
        }

        const smokeGeneral = this._resolveGeneralDetailSmokeGeneral(previewVariant || 'zhang-fei');
        if (!smokeGeneral) {
            throw new Error(`[LobbyScene] 正式入口 smoke route 找不到目標武將 variant=${previewVariant || '(default)'}`);
        }

        this._ensureSmokeGeneralInPlayerRoster(smokeGeneral);
        this._openGeneralListFromSmokeEntry(source);

        const opened = await this._waitForManagedUIOpen(UIID.GeneralList, this._listPanel.node);
        if (!opened) {
            throw new Error(`[LobbyScene] 正式入口 smoke route 未能從 ${source} 開啟 GeneralList`);
        }

        const selected = await this._selectRenderedGeneralById(smokeGeneral.id);
        if (!selected) {
            throw new Error(`[LobbyScene] 正式入口 smoke route failed to click general row: ${smokeGeneral.id}`);
        }

        UCUFLogger.info(LogCategory.LIFECYCLE, '[LobbyScene] formal general detail entry smoke selected general', {
            source,
            generalId: smokeGeneral.id,
            generalName: smokeGeneral.name,
        });
    }

    private _ensureSmokeGeneralInPlayerRoster(config: GeneralConfig): void {
        const roster = PlayerRosterService.getAll();
        if (roster.some((item) => item.id === config.id)) {
            return;
        }

        PlayerRosterService.replaceAll([
            config,
            ...roster.filter((item) => item.id !== config.id),
        ]);
        UCUFLogger.info(LogCategory.DATA, '[LobbyScene] formal general detail smoke seeded target general into preview roster', {
            generalId: config.id,
            generalName: config.name,
        });
    }

    private async _selectRenderedGeneralById(generalId: string, timeoutMs = 3000): Promise<boolean> {
        const startedAt = Date.now();
        while (Date.now() - startedAt < timeoutMs) {
            if (this._listPanel?.hasRenderedGeneralById(generalId)) {
                return this._listPanel.selectGeneralById(generalId);
            }
            await new Promise<void>((resolve) => setTimeout(resolve, 80));
        }
        return false;
    }

    private _openGeneralListFromSmokeEntry(source: GeneralDetailEntrySmokeSource): void {
        if (source === 'ucuf-nav') {
            const host = this._lobbyMainHost;
            const button = host?.binder?.getButton('btnGenerals') ?? null;
            if (!host || !button) {
                throw new Error('[LobbyScene] 正式入口 smoke route 找不到 lobby-main btnGenerals');
            }

            host.node.active = true;
            this._bringNodeToFront(host.node);
            this._configureLobbyMainHub(host.binder);
            button.node.emit(Button.EventType.CLICK, button);
            return;
        }

        const buttonNode = this.node.getChildByName('BtnGeneralList');
        const button = buttonNode?.getComponent(Button) ?? null;
        if (!buttonNode || !button) {
            throw new Error('[LobbyScene] 正式入口 smoke route 找不到 scene-authored BtnGeneralList');
        }

        const hasInspectorBinding = button.clickEvents.some((event) => (
            event.component === 'LobbyScene' && event.handler === 'onClickGeneralList'
        ));
        if (!hasInspectorBinding) {
            throw new Error('[LobbyScene] BtnGeneralList 未綁定 LobbyScene.onClickGeneralList');
        }

        this.onClickGeneralList();
    }

    public async previewCharacterDs3Smoke(previewVariant = ''): Promise<void> {
        if (!this._listPanel) {
            throw new Error('[LobbyScene] GeneralListComposite 尚未初始化，無法執行 CharacterDs3 smoke route');
        }

        const smokeGeneral = this._resolveCharacterDs3SmokeGeneral(previewVariant);
        if (!smokeGeneral) {
            throw new Error(`[LobbyScene] CharacterDs3 smoke route 找不到目標武將 variant=${previewVariant || '(default)'}`);
        }

        await this._showGeneralListWithHandler(
            (config: GeneralConfig) => this._openCharacterDs3FromListSelection(config),
            { factionFilter: 'all' },
        );

        const opened = await this._waitForManagedUIOpen(UIID.GeneralList, this._listPanel.node);
        if (!opened) {
            throw new Error('[LobbyScene] CharacterDs3 smoke route did not open GeneralList within timeout');
        }

        const selected = this._listPanel.selectGeneralById(smokeGeneral.id);
        if (!selected) {
            throw new Error(`[LobbyScene] CharacterDs3 smoke route failed to click general row: ${smokeGeneral.id}`);
        }

        await this._waitForCharacterDs3HostVisualReady(smokeGeneral);
    }

    /** 供 LoadingScene / headless preview 使用的大廳轉蛋 smoke route。 */
    public async previewGachaMainSmoke(): Promise<void> {
        this.onClickGachaMain();
        const opened = await this._waitForManagedUIOpen(UIID.GachaMain, this._gachaMainHost?.node ?? null);
        if (!opened) {
            throw new Error('[LobbyScene] GachaMain smoke route did not open UIID.GachaMain within timeout');
        }
    }

    public async previewMissionDetailSmoke(previewVariant = ''): Promise<void> {
        if (!this._missionDetailDialogPanel) {
            throw new Error('[LobbyScene] LobbyMissionDetailDialogComposite 尚未初始化，無法直接開啟大廳任務詳情');
        }

        const availableGenerals = this._buildMissionDetailGeneralOptions();
        const selectedGeneral = this._resolveMissionDetailSmokeGeneral(previewVariant, availableGenerals);

        await services().ui.open(UIID.LobbyMissionDetailDialog, {
            previewVariant,
            availableGenerals,
            selectedGeneralId: selectedGeneral?.id,
            selectedGeneralLabel: selectedGeneral?.label,
            selectedGeneralVolunteer: selectedGeneral?.volunteer,
        } satisfies LobbyMissionDetailDialogOpenPayload);
    }

    /** 「商城」按鈕 */
    public onClickShopMain() {
        this._openUIOnNextTick(UIID.ShopMain);
    }

    /** 「轉蛋」按鈕 */
    public onClickGachaMain() {
        this._openUIOnNextTick(UIID.GachaMain);
    }

    private async _waitForManagedUIOpen(uiId: UIID, hostNode: Node | null, timeoutMs = 2000): Promise<boolean> {
        const startedAt = Date.now();
        while (Date.now() - startedAt < timeoutMs) {
            if (services().ui.isOpen(uiId) && (!hostNode || hostNode.active)) {
                return true;
            }
            await new Promise<void>((resolve) => setTimeout(resolve, 80));
        }
        return false;
    }

    private async _waitForCharacterDs3HostVisualReady(config: GeneralConfig, timeoutMs = 4000): Promise<void> {
        const startedAt = Date.now();
        while (Date.now() - startedAt < timeoutMs) {
            if (this._isCharacterDs3HostVisualReady(config)) {
                return;
            }
            await new Promise<void>((resolve) => setTimeout(resolve, 80));
        }

        throw new Error(`[LobbyScene] CharacterDs3 smoke route timed out waiting for visual ready: ${config.id}`);
    }

    private _isCharacterDs3HostVisualReady(config: GeneralConfig): boolean {
        const hostNode = this._characterDs3Host?.node ?? null;
        if (!hostNode?.activeInHierarchy) {
            return false;
        }

        return this._hasDescendantLabelText(hostNode, config.name)
            && this._hasDescendantLabelText(hostNode, 'BIOGRAPHY')
            && this._hasDescendantLabelText(hostNode, '燕人武聖');
    }

    private _hasDescendantLabelText(root: Node, expectedText: string): boolean {
        const expected = expectedText.trim();
        if (!expected) {
            return false;
        }

        const label = root.getComponent(Label);
        if (label?.string.includes(expected)) {
            return true;
        }

        for (const child of root.children) {
            if (this._hasDescendantLabelText(child, expected)) {
                return true;
            }
        }

        return false;
    }

    private _mountSinglePlayerModeToggle(host: UIScreenPreviewHost | null): void {
        if (!host) {
            return;
        }

        const rootName = 'SinglePlayerModeToggle';
        const root = host.node.getChildByName(rootName) ?? new Node(rootName);
        root.layer = host.node.layer;
        if (!root.parent) {
            root.parent = host.node;
        }

        const transform = root.getComponent(UITransform) ?? root.addComponent(UITransform);
        transform.setContentSize(280, 56);
        const widget = root.getComponent(Widget) ?? root.addComponent(Widget);
        widget.isAlignTop = true;
        widget.top = 140;
        widget.isAlignRight = true;
        widget.right = 24;
        widget.isAlignLeft = false;
        widget.isAlignBottom = false;

        const background = root.getComponent(SolidBackground) ?? root.addComponent(SolidBackground);
        const button = root.getComponent(Button) ?? root.addComponent(Button);
        button.transition = Button.Transition.NONE;
        button.node.off(Button.EventType.CLICK, this.onClickSinglePlayerModeToggle, this);
        button.node.on(Button.EventType.CLICK, this.onClickSinglePlayerModeToggle, this);

        const labelNode = root.getChildByName('Label') ?? new Node('Label');
        labelNode.layer = host.node.layer;
        if (!labelNode.parent) {
            labelNode.parent = root;
        }
        const labelTransform = labelNode.getComponent(UITransform) ?? labelNode.addComponent(UITransform);
        labelTransform.setContentSize(260, 36);
        const labelWidget = labelNode.getComponent(Widget) ?? labelNode.addComponent(Widget);
        labelWidget.isAlignHorizontalCenter = true;
        labelWidget.horizontalCenter = 0;
        labelWidget.isAlignVerticalCenter = true;
        labelWidget.verticalCenter = 0;
        const label = labelNode.getComponent(Label) ?? labelNode.addComponent(Label);
        label.fontSize = 22;
        label.lineHeight = 28;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;

        this._singlePlayerModeToggleHandles.push({ root, label });
        this._syncSinglePlayerModeToggleVisual(root, label, background);
    }

    private _syncSinglePlayerModeToggleVisual(root: Node, label: Label, background: SolidBackground): void {
        const enabled = this._localGachaService.isSinglePlayerModeEnabled();
        label.string = enabled ? '單機模式：ON' : '單機模式：OFF';
        label.color = enabled ? new Color(240, 255, 240, 255) : new Color(255, 230, 220, 255);
        background.color = enabled ? new Color(52, 92, 58, 220) : new Color(96, 60, 54, 220);
        root.active = true;
    }

    private _refreshSinglePlayerModeToggleVisuals(): void {
        for (const handle of this._singlePlayerModeToggleHandles) {
            const background = handle.root.getComponent(SolidBackground);
            if (!background) continue;
            this._syncSinglePlayerModeToggleVisual(handle.root, handle.label, background);
        }
    }

    public onClickSinglePlayerModeToggle(): void {
        const enabled = this._localGachaService.toggleSinglePlayerModeEnabled();
        this._refreshSinglePlayerModeToggleVisuals();
        services().event.emit('SHOW_TOAST', {
            message: enabled ? '單機模式已開啟' : '單機模式已關閉',
            duration: 1.6,
        });
    }

    private async _showGachaHistory(): Promise<void> {
        try {
            const data = await this._localGachaService.getRecentPullHistory(30);
            showGachaHistory(data);
        } catch (error) {
            services().event.emit('SHOW_TOAST', {
                message: error instanceof Error ? error.message : '讀取紀錄失敗',
                duration: 2.0,
            });
        }
    }

    private async _runGoldSummon(): Promise<void> {
        try {
            const results = await this._localGachaService.performGoldSummon(
                1, this._generals, { factionFilter: 'player' });
            showGachaResults('金幣召喚', results, () => { void this._runGoldSummon(); });
            this._refreshSinglePlayerModeToggleVisuals();
            this._refreshWalletPreviewState();
            refreshCurrencyDisplay();
        } catch (error) {
            services().event.emit('SHOW_TOAST', {
                message: error instanceof Error ? error.message : '金幣召喚失敗',
                duration: 2.5,
            });
        }
    }

    private async _runTicketSummon(): Promise<void> {
        try {
            const results = await this._localGachaService.performTicketSummon(
                1, this._generals, { factionFilter: 'player' });
            showGachaResults('召喚券', results, () => { void this._runTicketSummon(); });
            this._refreshSinglePlayerModeToggleVisuals();
            this._refreshWalletPreviewState();
            refreshCurrencyDisplay();
        } catch (error) {
            services().event.emit('SHOW_TOAST', {
                message: error instanceof Error ? error.message : '召喚券失敗',
                duration: 2.5,
            });
        }
    }

    private async _runLocalGacha(drawCount: number): Promise<void> {
        try {
            const results = await this._localGachaService.performLocalGacha(
                'GENERAL_STANDARD_01',
                drawCount,
                drawCount * 100,
                this._generals,
                { factionFilter: 'player' },
            );
            showGachaResults(
                drawCount === 1 ? '單抽' : '十連抽',
                results,
                () => { void this._runLocalGacha(drawCount); },
            );
            this._refreshSinglePlayerModeToggleVisuals();
            this._refreshWalletPreviewState();
            refreshCurrencyDisplay();
        } catch (error) {
            const message = error instanceof Error ? error.message : '單機轉蛋失敗';
            services().event.emit('SHOW_TOAST', { message, duration: 2.5 });
        }
    }

    /** 「支援卡」按鈕 */
    public onClickSupportCard() {
        this.scheduleOnce(() => {
            void services().ui.openAsync(UIID.SupportCard);
        }, 0);
    }

    public onClickSpiritFamilyOverview() {
        this.scheduleOnce(() => {
            void services().ui.open(UIID.SpiritFamilyOverview, {
                origin: 'lobby',
            } satisfies SpiritFamilyOverviewOpenPayload);
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

    public async onClickGeneralDetailStatsSmoke(previewVariant = '') {
        await this._openGeneralDetailSmoke('Stats', previewVariant);
    }

    public async onClickGeneralDetailSkillsSmoke(previewVariant = '') {
        await this._openGeneralDetailSmoke('Skills', previewVariant);
    }

    public async onClickGeneralDetailBloodlineSmoke(previewVariant = '') {
        await this._openGeneralDetailSmoke('Bloodline', previewVariant);
    }

    public async onClickGeneralDetailBasicsSmoke(previewVariant = '') {
        await this._openGeneralDetailSmoke('Basics', previewVariant);
    }

    public async onClickGeneralDetailAptitudeSmoke(previewVariant = '') {
        await this._openGeneralDetailSmoke('Aptitude', previewVariant);
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

    private _buildMissionDetailGeneralOptions(): MissionGeneralOption[] {
        return this._generals.map((config) => ({
            id: config.id,
            label: config.name,
            volunteer: this._isMissionDetailVolunteerGeneral(config),
        }));
    }

    private _resolveMissionDetailSmokeGeneral(
        previewVariant: string,
        options: MissionGeneralOption[],
        payload?: LobbyMissionDetailDialogOpenPayload,
    ): MissionGeneralOption | null {
        const requestedId = payload?.selectedGeneralId?.trim() ?? '';
        const requestedLabel = payload?.selectedGeneralLabel?.trim() ?? '';
        const matchedById = requestedId ? options.find((item) => item.id === requestedId) ?? null : null;
        const matchedByLabel = requestedLabel ? options.find((item) => item.label === requestedLabel) ?? null : null;
        const matchedByVariant = this._matchMissionDetailGeneralByVariant(previewVariant, options);

        return matchedById
            ?? matchedByLabel
            ?? matchedByVariant
            ?? options[0]
            ?? null;
    }

    private _matchMissionDetailGeneralByVariant(
        previewVariant: string,
        options: MissionGeneralOption[],
    ): MissionGeneralOption | null {
        const requested = previewVariant.trim().toLowerCase();
        if (!requested) {
            return null;
        }

        const normalized = requested.replace(/[\s_-]/g, '');
        const preferredTokens: string[] = [];

        if (requested === 'guan-yu' || normalized === 'guanyu' || requested === 'smoke-guan-yu' || requested === '關羽') {
            preferredTokens.push('guan-yu', 'guanyu', '關羽');
        } else if (requested === 'zhao-yun' || normalized === 'zhaoyun') {
            preferredTokens.push('zhao-yun', 'zhaoyun', '趙雲');
        } else if (requested === 'zhang-fei' || normalized === 'zhangfei') {
            preferredTokens.push('zhang-fei', 'zhangfei', '張飛');
        } else if (requested !== 'default' && requested !== 'military' && requested !== 'domestic' && requested !== 'partial' && requested !== 'revealed' && requested !== 'full' && requested !== '50' && requested !== '50%' && requested !== '100' && requested !== '100%') {
            preferredTokens.push(requested, normalized);
        }

        if (preferredTokens.length === 0) {
            return null;
        }

        return options.find((option) => {
            const optionText = `${option.id} ${option.label}`.toLowerCase();
            return preferredTokens.some((token) => token && optionText.includes(token.toLowerCase()));
        }) ?? null;
    }

    private _isMissionDetailVolunteerGeneral(config: GeneralConfig): boolean {
        const text = [config.id, config.name, ...(config.alias ?? [])].join(' ').toLowerCase();
        return text.includes('guan-yu') || text.includes('guanyu') || text.includes('關羽');
    }

    private async _openGeneralDetailSmoke(defaultTab: GeneralDetailDefaultTab, previewVariant = '') {
        if (!this._detailPanel) {
            console.warn('[LobbyScene] GeneralDetailOverview smoke 失敗：detail panel 未就緒');
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

        await services().ui.open(UIID.GeneralDetail, {
            ...smokeGeneral,
            profilePresentation: {
                ...smokeGeneral.profilePresentation,
                defaultTab,
            },
        });

        await this._detailPanel.switchTab(this._resolveGeneralDetailRuntimeTab(defaultTab));
    }

    private _resolveGeneralDetailRuntimeTab(defaultTab: GeneralDetailDefaultTab): GeneralDetailRuntimeTab {
        switch (defaultTab) {
        case 'Overview':
        case 'Stats':
        case 'Bloodline':
        case 'Aptitude':
            return defaultTab;
        case 'Basics':
            return 'Equip';
        case 'Skills':
            return 'Tactics';
        case 'Extended':
            return 'Aptitude';
        default:
            return 'Overview';
        }
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

    private _resolveCharacterDs3SmokeGeneral(previewVariant: string): GeneralConfig | null {
        const requested = previewVariant.trim().toLowerCase();
        if (requested && requested !== 'default' && requested !== 'ds3' && requested !== 'zhang-fei' && requested !== 'zhangfei' && requested !== 'smoke-zhang-fei') {
            UCUFLogger.warn(LogCategory.LIFECYCLE, '[LobbyScene] CharacterDs3 smoke route currently renders the DS3 Zhang Fei capture target only; fallback to zhang-fei', {
                previewVariant,
            });
        }

        return this._resolveGeneralDetailSmokeGeneral('zhang-fei');
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
