// @spec-source → 見 docs/cross-reference-index.md
import {
    _decorator,
    Component,
    director,
    ResolutionPolicy,
    sys,
    Enum,
    Label,
    Button,
    SpriteFrame,
    Sprite,
    Node,
    UIOpacity,
    UITransform,
    Widget,
    resources,
} from 'cc';
import { services } from '../../core/managers/ServiceLoader';
import { UIScreenPreviewHost } from '../components/UIScreenPreviewHost';
import { GeneralDetailComposite } from '../components/GeneralDetailComposite';
import { GeneralListComposite } from '../components/GeneralListComposite';
import { EliteTroopCodexComposite } from '../components/EliteTroopCodexComposite';
import { LobbyMissionDetailDialogComposite } from '../components/LobbyMissionDetailDialogComposite';
import { LobbyScene } from './LobbyScene';
import { BattleTactic } from '../../core/config/Constants';
import { DEFAULT_BATTLE_ENTRY_PARAMS, type BattleEntryParams } from '../../battle/models/BattleEntryParams';
import type { GeneralConfig } from '../../core/models/GeneralUnit';
import { getUIRarityMarkLabel } from '../core/UIRarityMark';
import { applyUIPreviewBinderState, type UIPreviewBinderState } from '../core/UIPreviewStateApplicator';
import { applyUIScreenRuntimeState } from '../core/UIScreenRuntimeStateRegistry';
import { LocalGachaService } from '../../core/services/LocalGachaService';
import { PlayerRosterService } from '../../core/services/PlayerRosterService';
import { UCUFLogger, LogCategory } from '../core/UCUFLogger';
import { showGachaResults, showGachaHistory, showGachaError, refreshCurrencyDisplay, attachCurrencyCheatPanel, detachCurrencyCheatPanel, detachRosterClearButton, ensureGlobalDevOverlay } from '../dev/GachaDevOverlay';

const { ccclass, property } = _decorator;

enum LoadingPreviewTarget {
    Disabled = 0,
    LobbyMain = 1,
    ShopMain = 2,
    Gacha = 3,
    DuelChallenge = 4,
    BattleScene = 5,
    GeneralDetailOverview = 6,
    SpiritTallyDetail = 7,
    GeneralList = 8,
    EliteTroopCodex = 9,
    LobbyMissionDetailDialog = 10,
    GeneralDetailSkills = 12,
    GeneralDetailStats = 13,
    GeneralDetailBloodline = 14,
    GeneralDetailBasics = 15,
    GeneralDetailAptitude = 16,
    GachaFromLobby = 17,
    CharacterDs3 = 18,
    GeneralDetailFromLobbyGeneralsButton = 19,
    GeneralDetailFromSceneGeneralListButton = 20,
}

type GeneralDetailPreviewTab = 'Overview' | 'Basics' | 'Stats' | 'Bloodline' | 'Skills' | 'Aptitude';

/**
 * LoadingScene - 中繼轉場場景
 * 
 * 核心功能：
 * 1. 顯示動態載入進度 (白模)
 * 2. 徹底釋放前一個場景的資源 (releaseUnusedAssets)
 * 3. 確保轉場過程中記憶體不會疊加 (A -> Loading -> B)
 */
@ccclass('LoadingScene')
export class LoadingScene extends Component {

    @property({ tooltip: '背景圖的 resources 路徑（不含副檔名）' })
    public bgTexturePath: string = 'textures/bg_normal_day';

    @property({ tooltip: '開發用：啟用後停留在 LoadingScene.scene，改為載入指定 screen-driven preview，不執行正常場景切換。' })
    public previewMode = false;

    @property({
        type: Enum(LoadingPreviewTarget),
        tooltip: '開發用：選擇要在 LoadingScene.scene 中預覽的 screen-driven UI。',
    })
    public previewTarget: LoadingPreviewTarget = LoadingPreviewTarget.Disabled;

    @property({ tooltip: '開發用：preview 的子狀態，例如 gacha 使用 hero / support / limited。' })
    public previewVariant = '';

    private _bgNode: Node | null = null;
    private _bgSpriteFrame: SpriteFrame | null = null;
    private _previewHost: UIScreenPreviewHost | null = null;
    private _previewViewportFitTimer: number | null = null;
    private readonly _previewGachaService = new LocalGachaService();
    private _previewGeneralListPanel: GeneralListComposite | null = null;
    private _generalsCatalog: GeneralConfig[] = [];

    private _setCaptureState(status: 'loading' | 'ready' | 'error', screenId: string, error?: unknown): void {
        const globalScope = globalThis as any;
        globalScope.__UI_CAPTURE_STATE__ = {
            status,
            screenId,
            timestamp: Date.now(),
            error: error ? String(error) : undefined,
        };

        try {
            sys.localStorage.setItem('UI_CAPTURE_STATE', JSON.stringify(globalScope.__UI_CAPTURE_STATE__));
        } catch {
            // localStorage 在部分環境可能不可用，不影響主流程
        }
    }

    private _applyPreviewParamsFromQuery(): void {
        const globalScope = globalThis as any;
        const search = globalScope?.window?.location?.search as string | undefined;
        if (!search || search.length <= 1) {
            return;
        }

        const query = new URLSearchParams(search);
        const mode = query.get('previewMode') ?? query.get('PREVIEW_MODE');
        const target = query.get('previewTarget') ?? query.get('PREVIEW_TARGET');
        const variant = query.get('previewVariant') ?? query.get('PREVIEW_VARIANT');

        if (mode === 'true' || mode === '1') {
            this.previewMode = true;
        }
        if (target) {
            const targetValue = parseInt(target, 10);
            if (!Number.isNaN(targetValue)) {
                this.previewTarget = targetValue;
            }
        }
        if (variant) {
            this.previewVariant = variant.trim();
        }
    }

    private _resolvePreviewScreenId(): string {
        switch (this.previewTarget) {
        case LoadingPreviewTarget.LobbyMain:
            return 'lobby-main-screen';
        case LoadingPreviewTarget.ShopMain:
            return 'shop-main-screen';
        case LoadingPreviewTarget.Gacha:
            return 'gacha-main-screen';
        case LoadingPreviewTarget.GachaFromLobby:
            return 'gacha-main-screen';
        case LoadingPreviewTarget.CharacterDs3:
            return 'character-ds3-main';
        case LoadingPreviewTarget.GeneralDetailFromLobbyGeneralsButton:
        case LoadingPreviewTarget.GeneralDetailFromSceneGeneralListButton:
            return 'character-ds3-main';
        case LoadingPreviewTarget.DuelChallenge:
            return 'duel-challenge-screen';
        case LoadingPreviewTarget.BattleScene:
            return 'battle-scene';
        case LoadingPreviewTarget.GeneralDetailOverview:
            return 'general-detail-unified-screen';
        case LoadingPreviewTarget.GeneralDetailStats:
            return 'general-detail-unified-screen';
        case LoadingPreviewTarget.GeneralDetailBloodline:
            return 'general-detail-unified-screen';
        case LoadingPreviewTarget.GeneralDetailBasics:
            return 'general-detail-unified-screen';
        case LoadingPreviewTarget.GeneralDetailAptitude:
            return 'general-detail-unified-screen';
        case LoadingPreviewTarget.GeneralList:
            return 'general-list-screen';
        case LoadingPreviewTarget.EliteTroopCodex:
            return 'elite-troop-codex-screen';
        case LoadingPreviewTarget.LobbyMissionDetailDialog:
            return 'lobby-mission-detail-dialog-screen';
        case LoadingPreviewTarget.GeneralDetailSkills:
            return 'general-detail-unified-screen';
        case LoadingPreviewTarget.SpiritTallyDetail:
            return 'spirit-tally-detail-screen';
        case LoadingPreviewTarget.Disabled:
        default:
            return 'lobby-main-screen';
        }
    }

    private _resolvePreviewBattleParams(): BattleEntryParams {
        const query = new URLSearchParams(globalThis?.window?.location?.search ?? '');
        const battleTactic = this._parseBattleTactic(query.get('battleTactic') ?? query.get('BATTLE_TACTIC'));

        return {
            ...DEFAULT_BATTLE_ENTRY_PARAMS,
            battleTactic,
        };
    }

    private _parseBattleTactic(rawValue: string | null): BattleTactic {
        switch ((rawValue ?? '').trim()) {
        case 'fire-attack':
            return BattleTactic.FireAttack;
        case 'flood-attack':
            return BattleTactic.FloodAttack;
        case 'rock-slide':
            return BattleTactic.RockSlide;
        case 'ambush-attack':
            return BattleTactic.AmbushAttack;
        case 'night-raid':
            return BattleTactic.NightRaid;
        default:
            return BattleTactic.Normal;
        }
    }

    onLoad() {
        this._applyPreviewParamsFromQuery();

        // [UI-2-0023] 支援從 sys.localStorage 注入 previewMode，方便 headless 自動化
        const storedPreviewMode = sys.localStorage.getItem('PREVIEW_MODE');
        if (storedPreviewMode === 'true') {
            this.previewMode = true;
            const storedTarget = sys.localStorage.getItem('PREVIEW_TARGET');
            if (storedTarget) {
                this.previewTarget = parseInt(storedTarget, 10);
            }
            const storedVariant = sys.localStorage.getItem('PREVIEW_VARIANT');
            if (storedVariant) {
                this.previewVariant = storedVariant.trim();
            }
        }

        if (this.previewMode) {
            this._applyPreviewViewportPolicy();
            this._buildPreviewHost();
            return;
        }
        this._buildUI();
    }

    start() {
        if (this.previewMode) {
            void this._startPreview().finally(() => {
                if (!this.isValid) {
                    return;
                }
                if (this.previewTarget === LoadingPreviewTarget.Gacha) {
                    ensureGlobalDevOverlay(this._previewGachaService, undefined, () => { PlayerRosterService.clear(); }, () => {
                        this._refreshPreviewGachaWalletState();
                    });
                    return;
                }
                ensureGlobalDevOverlay();
            });
            return;
        }
        ensureGlobalDevOverlay();
        this._startTransition();
    }

    /** 動態建立白模 UI */
    private _buildUI() {
        const root = this._resolveRootNode();

        // 建立背景節點
        this._bgNode = new Node('LoadingBackground');
        this._bgNode.layer = root.layer;
        root.addChild(this._bgNode);

        const tf = this._bgNode.addComponent(UITransform);
        tf.setContentSize(1920, 1080);
        
        const widget = this._bgNode.addComponent(Widget);
        widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
        widget.top = widget.bottom = widget.left = widget.right = 0;

        // 載入背景圖
        this._loadBackground();
    }

    private _buildPreviewHost() {
        const root = this._resolveRootNode();

        // Hide the static loading hint in preview mode so it does not cover the preview.
        const loadingHintLabel = root.getChildByName('LoadingHintLabel');
        if (loadingHintLabel) loadingHintLabel.active = false;

        let previewNode = root.getChildByName('UIScreenPreviewHost');
        if (!previewNode) {
            previewNode = new Node('UIScreenPreviewHost');
            previewNode.layer = root.layer;
            root.addChild(previewNode);
        }

        const tf = previewNode.getComponent(UITransform) ?? previewNode.addComponent(UITransform);
        tf.setContentSize(1920, 1080);

        const widget = previewNode.getComponent(Widget) ?? previewNode.addComponent(Widget);
        widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
        widget.top = widget.bottom = widget.left = widget.right = 0;

        this._previewHost = previewNode.getComponent(UIScreenPreviewHost) ?? previewNode.addComponent(UIScreenPreviewHost);
        this._startPreviewViewportFitLoop();
    }

    private _startPreviewViewportFitLoop(): void {
        if (typeof window === 'undefined') return;

        if (this._previewViewportFitTimer !== null) {
            window.clearInterval(this._previewViewportFitTimer);
            this._previewViewportFitTimer = null;
        }

        let attempts = 0;
        const tick = () => {
            if (!this.isValid || !this.previewMode) {
                if (this._previewViewportFitTimer !== null) {
                    window.clearInterval(this._previewViewportFitTimer);
                    this._previewViewportFitTimer = null;
                }
                return;
            }

            this._fitPreviewHostToViewport();
            attempts += 1;

            const wrapper = document.getElementById('GameDiv') as HTMLElement | null;
            if ((wrapper && wrapper.style.transform && wrapper.style.transform !== 'none') || attempts >= 20) {
                if (this._previewViewportFitTimer !== null) {
                    window.clearInterval(this._previewViewportFitTimer);
                    this._previewViewportFitTimer = null;
                }
            }
        };

        this._previewViewportFitTimer = window.setInterval(tick, 100);
        tick();
    }

    private _applyPreviewViewportPolicy(): void {
        if (typeof window === 'undefined') return;

        try {
            // Keep the design resolution fixed for editor/browser QA; the host wrapper handles browser fit.
            director.getScene();
            const designWidth = 1920;
            const designHeight = 1080;
            const view = (globalThis as any).cc?.view ?? null;
            if (view?.setDesignResolutionSize) {
                view.setDesignResolutionSize(designWidth, designHeight, ResolutionPolicy.SHOW_ALL);
            }
        } catch {
            // Keep the default flow when cc.view is unavailable in the preview environment.
        }
    }

    private _fitPreviewHostToViewport(): void {
        if (typeof document === 'undefined' || typeof window === 'undefined') return;

        const wrapper = document.getElementById('GameDiv') as HTMLElement | null;
        const contentWrap = document.querySelector('.contentWrap') as HTMLElement | null;
        if (!wrapper) return;

        const wrapperRect = wrapper.getBoundingClientRect();
        if (wrapperRect.width <= 0 || wrapperRect.height <= 0) return;

        const availableWidth = contentWrap?.clientWidth ?? window.innerWidth;
        const availableHeight = contentWrap?.clientHeight ?? window.innerHeight;
        if (availableWidth <= 0 || availableHeight <= 0) return;

        const scale = Math.min(1, availableWidth / wrapperRect.width, availableHeight / wrapperRect.height);
        wrapper.style.transformOrigin = 'top center';
        wrapper.style.transform = scale < 1 ? `scale(${scale})` : 'none';
    }

    onDestroy() {
        if (typeof window !== 'undefined' && this._previewViewportFitTimer !== null) {
            window.clearInterval(this._previewViewportFitTimer);
            this._previewViewportFitTimer = null;
        }
        detachCurrencyCheatPanel();
        detachRosterClearButton();
    }

    private _resolveRootNode(): Node {
        const canvas = director.getScene()?.getComponentInChildren('cc.Canvas') as any;
        return canvas ? canvas.node : this.node;
    }

    private _loadBackground() {
        if (!this.bgTexturePath || !this._bgNode || !this._bgNode.isValid) return;

        // 💡 Cocos 3.x 技巧：resources.load 載入 SpriteFrame。
        const path = this.bgTexturePath;
        
        console.log(`[LoadingScene] 嘗試載入背景: ${path}`);
        
        resources.load<SpriteFrame>(path, SpriteFrame, (err, sf) => {
            if (!this._bgNode || !this._bgNode.isValid || !this.isValid) return;
            if (err) {
                // 備援：嘗試強制 /spriteFrame 後綴
                resources.load<SpriteFrame>(path + '/spriteFrame', SpriteFrame, (err2, sf2) => {
                    if (err2) {
                        console.warn(`[LoadingScene] 背景圖載入失敗: ${path}，Fallback 黑畫面。`);
                        return;
                    }
                    this._applySpriteFrame(sf2);
                });
                return;
            }
            this._applySpriteFrame(sf);
        });
    }

    private _applySpriteFrame(sf: SpriteFrame) {
        if (!this._bgNode || !this._bgNode.isValid || !this.isValid) return;

        this._bgSpriteFrame = sf;
        this._bgSpriteFrame.addRef();
        
        let spr = this._bgNode.getComponent(Sprite);
        if (!spr) spr = this._bgNode.addComponent(Sprite);
        spr.spriteFrame = this._bgSpriteFrame;
    }

    private async _startPreview(): Promise<void> {
        if (!this._previewHost) {
            this._buildPreviewHost();
        }

        const fallbackScreenId = this._resolvePreviewScreenId();
        this._setCaptureState('loading', fallbackScreenId);

        try {
            switch (this.previewTarget) {
            case LoadingPreviewTarget.LobbyMain:
                await this._previewLobbyMain();
                this._setCaptureState('ready', 'lobby-main-screen');
                return;
            case LoadingPreviewTarget.ShopMain:
                await this._previewShopMain();
                this._setCaptureState('ready', 'shop-main-screen');
                return;
            case LoadingPreviewTarget.Gacha:
                await this._previewGacha();
                this._setCaptureState('ready', 'gacha-main-screen');
                return;
            case LoadingPreviewTarget.GachaFromLobby:
                await this._previewGachaFromLobby();
                this._setCaptureState('ready', 'gacha-main-screen');
                return;
            case LoadingPreviewTarget.CharacterDs3:
                await this._previewCharacterDs3();
                this._setCaptureState('ready', 'character-ds3-main');
                return;
            case LoadingPreviewTarget.DuelChallenge:
                await this._previewDuelChallenge();
                this._setCaptureState('ready', 'duel-challenge-screen');
                return;
            case LoadingPreviewTarget.BattleScene:
                await this._previewBattleScene();
                return;
            case LoadingPreviewTarget.GeneralDetailOverview:
                await this._previewGeneralDetailOverview();
                return;
            case LoadingPreviewTarget.GeneralDetailStats:
                await this._previewGeneralDetailStats();
                return;
            case LoadingPreviewTarget.GeneralDetailBloodline:
                await this._previewGeneralDetailBloodline();
                return;
            case LoadingPreviewTarget.GeneralDetailBasics:
                await this._previewGeneralDetailBasics();
                return;
            case LoadingPreviewTarget.GeneralDetailAptitude:
                await this._previewGeneralDetailAptitude();
                return;
            case LoadingPreviewTarget.GeneralDetailFromLobbyGeneralsButton:
                await this._previewGeneralDetailFromLobbyEntry('ucuf-nav');
                return;
            case LoadingPreviewTarget.GeneralDetailFromSceneGeneralListButton:
                await this._previewGeneralDetailFromLobbyEntry('scene-button');
                return;
            case LoadingPreviewTarget.GeneralList:
                await this._previewGeneralList();
                this._setCaptureState('ready', 'general-list-screen');
                return;
            case LoadingPreviewTarget.EliteTroopCodex:
                await this._previewEliteTroopCodex();
                return;
            case LoadingPreviewTarget.LobbyMissionDetailDialog:
                await this._previewLobbyMissionDetailDialog();
                this._setCaptureState('ready', 'lobby-mission-detail-dialog-screen');
                return;
            case LoadingPreviewTarget.GeneralDetailSkills:
                await this._previewGeneralDetailSkills();
                return;
            case LoadingPreviewTarget.SpiritTallyDetail:
                await this._previewSpiritTallyDetail();
                this._setCaptureState('ready', 'spirit-tally-detail-screen');
                return;
            case LoadingPreviewTarget.Disabled:
            default:
                console.warn('[LoadingScene] previewMode=true 但 previewTarget 未指定，預設載入 lobby-main-screen');
                await this._previewLobbyMain();
                this._setCaptureState('ready', 'lobby-main-screen');
                return;
            }
        } catch (error) {
            this._setCaptureState('error', fallbackScreenId, error);
            throw error;
        }
    }

    private async _previewLobbyMain(): Promise<void> {
        console.log('[LoadingScene] Preview target -> lobby-main-screen');
        await this._previewHost?.showScreen('lobby-main-screen');

        const binder = this._previewHost?.binder;
        const gachaButton = binder?.getButton('btnGacha');
        if (!gachaButton) {
            throw new Error('[LoadingScene] lobby-main-screen is missing btnGacha binding');
        }

        gachaButton.node.off(Button.EventType.CLICK, this._onPreviewLobbyGachaClick, this);
        gachaButton.node.on(Button.EventType.CLICK, this._onPreviewLobbyGachaClick, this);

        // Generals button: show the player roster stored in PlayerRosterService.
        const generalsButton = binder?.getButton('btnGenerals');
        if (generalsButton) {
            generalsButton.node.off(Button.EventType.CLICK, this._onPreviewLobbyGeneralsClick, this);
            generalsButton.node.on(Button.EventType.CLICK, this._onPreviewLobbyGeneralsClick, this);
        }
    }

    private _onPreviewLobbyGeneralsClick(): void {
        void this._showPreviewGeneralList();
    }

    private async _showPreviewGeneralList(): Promise<void> {
        // Prefer the player roster; fall back to the full generals catalog when empty.
        let roster = PlayerRosterService.getAll();
        if (roster.length === 0) {
            if (this._generalsCatalog.length === 0) {
                try {
                    const data = await services().resource.loadJson<GeneralConfig[]>('data/generals', { tags: ['GeneralListPreview'] });
                    this._generalsCatalog = Array.isArray(data) ? data : ((data as any)?.data ?? []);
                } catch (err) {
                    UCUFLogger.warn(LogCategory.DATA, '[LoadingScene] Failed to load generals catalog', err);
                }
            }
            roster = this._generalsCatalog;
        }

        // Lazily create the GeneralListComposite panel.
        if (!this._previewGeneralListPanel || !this._previewGeneralListPanel.node.isValid) {
            const root = this._resolveRootNode();
            const listNode = new Node('GeneralListPanel');
            listNode.layer = root.layer;
            root.addChild(listNode);

            const tf = listNode.addComponent(UITransform);
            tf.setContentSize(1920, 1080);
            const w = listNode.addComponent(Widget);
            w.isAlignTop = w.isAlignBottom = w.isAlignLeft = w.isAlignRight = true;
            w.top = w.bottom = w.left = w.right = 0;

            this._previewGeneralListPanel = listNode.addComponent(GeneralListComposite);
            this._previewGeneralListPanel.onRequestClose = () => {
                this._previewGeneralListPanel?.node && (this._previewGeneralListPanel.node.active = false);
            };
        }

        this._previewGeneralListPanel.node.active = true;
        // roster already contains the player roster or the full catalog fallback; always show in all mode.
        await this._previewGeneralListPanel.show(roster, 'all');
        UCUFLogger.info(LogCategory.DATA, `[LoadingScene] General list shown with ${roster.length} entries`);
    }

    private _onPreviewLobbyGachaClick(): void {
        void this._previewGacha();
    }

    private async _previewShopMain(): Promise<void> {
        console.log('[LoadingScene] Preview target -> shop-main-screen');
        await this._previewHost?.showScreen('shop-main-screen');
    }

    private async _previewGacha(): Promise<void> {
        console.log('[LoadingScene] Preview target -> gacha-main-screen');
        await this._previewHost?.showScreen('gacha-main-screen');
        if (this._previewHost?.binder) {
            await applyUIScreenRuntimeState(this._previewHost.binder, 'gacha-main-screen', {
                previewVariant: this.previewVariant,
                tags: ['LoadingScenePreview'],
            });
            this._refreshPreviewGachaWalletState();
        }
        // Load the real generals catalog for gacha odds on the first preview only.
        if (this._generalsCatalog.length === 0) {
            try {
                const data = await services().resource.loadJson<GeneralConfig[]>('data/generals', { tags: ['GachaPreview'] });
                this._generalsCatalog = Array.isArray(data) ? data : ((data as any)?.data ?? []);
                UCUFLogger.info(LogCategory.DATA, `[LoadingScene] Loaded ${this._generalsCatalog.length} generals for gacha preview`);
            } catch (err) {
                UCUFLogger.warn(LogCategory.DATA, '[LoadingScene] Failed to load generals catalog for gacha preview', err);
            }
        }
        this._wireGachaPreviewButtons();
        attachCurrencyCheatPanel(this._previewGachaService, undefined, () => { PlayerRosterService.clear(); }, () => {
            this._refreshPreviewGachaWalletState();
        });
    }

    private _wireGachaPreviewButtons(): void {
        const binder = this._previewHost?.binder;
        if (!binder) return;

        // TopBar is hidden in the layout spec (active:false) to match the HTML
        // parity baseline, but the preview still needs the BackBtn accessible.
        const topBar = binder.getNode('TopBar');
        if (topBar) {
            topBar.active = true;
        }

        const btnBindings: Array<[string, () => void]> = [
            ['Pull1Btn',      () => { void this._onPreviewGachaPull(1); }],
            ['Pull10Btn',     () => { void this._onPreviewGachaPull(10); }],
            ['HistoryBtn',    () => { this._onPreviewGachaHistory(); }],
            ['GoldSummonBtn', () => { void this._onPreviewGoldSummon(); }],
            ['UseTicketBtn',  () => { void this._onPreviewTicketSummon(); }],
            ['BackBtn',       () => { void this._onPreviewGachaBack(); }],
        ];
        for (const [id, handler] of btnBindings) {
            const btn = binder.getButton(id);
            if (!btn) {
                UCUFLogger.warn(LogCategory.DATA, `[LoadingScene] gacha preview: button not found: ${id}`);
                continue;
            }
            btn.node.on(Button.EventType.CLICK, handler, this);
        }
    }

    private _refreshPreviewGachaWalletState(): void {
        if (!this._previewHost?.binder) {
            return;
        }

        const wallet = this._previewGachaService.getWalletSnapshot();
        this._previewHost.binder.setTexts({
            CostBalanceValue: `◈ ${wallet.gems.toLocaleString('zh-TW')}`,
        });
    }

    private static readonly GEMS_COST_PER_PULL = 100;
    private static readonly GACHA_POOL_ID = 'GENERAL_STANDARD_01';

    private async _onPreviewGachaPull(count: number): Promise<void> {
        const cost = LoadingScene.GEMS_COST_PER_PULL * count;
        try {
            const results = await this._previewGachaService.performLocalGacha(
                LoadingScene.GACHA_POOL_ID,
                count,
                cost,
                this._generalsCatalog,
                { factionFilter: 'all' },
            );
            PlayerRosterService.addGenerals(results.map(r => r.general));
            this._refreshPreviewGachaWalletState();
            refreshCurrencyDisplay();
            showGachaResults(
                count === 1 ? '單抽' : '十連抽',
                results,
                () => { void this._onPreviewGachaPull(count); },
            );
        } catch (err) {
            showGachaError(this._formatGachaError(err));
        }
    }

    private _onPreviewGachaHistory(): void {
        void this._previewGachaService.getRecentPullHistory(30).then((data) => {
            showGachaHistory(data);
        }).catch(() => {
            showGachaError('讀取紀錄失敗');
        });
    }

    private async _onPreviewGachaBack(): Promise<void> {
        await this._previewLobbyMain();
    }

    private async _onPreviewGoldSummon(): Promise<void> {
        try {
            const results = await this._previewGachaService.performGoldSummon(
                1, this._generalsCatalog, { factionFilter: 'all' },
            );
            PlayerRosterService.addGenerals(results.map(r => r.general));
            this._refreshPreviewGachaWalletState();
            refreshCurrencyDisplay();
            showGachaResults('金幣召喚', results, () => { void this._onPreviewGoldSummon(); });
        } catch (err) {
            showGachaError(this._formatGachaError(err));
        }
    }

    private async _onPreviewTicketSummon(): Promise<void> {
        try {
            const results = await this._previewGachaService.performTicketSummon(
                1, this._generalsCatalog, { factionFilter: 'all' },
            );
            PlayerRosterService.addGenerals(results.map(r => r.general));
            this._refreshPreviewGachaWalletState();
            refreshCurrencyDisplay();
            showGachaResults('召喚券', results, () => { void this._onPreviewTicketSummon(); });
        } catch (err) {
            showGachaError(this._formatGachaError(err));
        }
    }

    private _formatGachaError(err: unknown): string {
        const raw = err instanceof Error ? err.message : String(err);
        return raw
            .replace(/^gems\b/, '🔹 鑽石')
            .replace(/^gold\b/, '🪙 金幣')
            .replace(/^tickets\b/, '🎫 召喚券');
    }

    private _emitPreviewToast(message: string): void {
        UCUFLogger.info(LogCategory.DATA, `[LoadingScene] preview toast: ${message}`);
        try {
            services().event.emit('SHOW_TOAST', { message, duration: 2.5 });
        } catch {
            // services may not be fully initialized in preview mode yet.
        }
    }

    private async _previewDuelChallenge(): Promise<void> {
        console.log('[LoadingScene] Preview target -> duel-challenge-screen');
        await this._previewHost?.showScreen('duel-challenge-screen');
    }

    private async _previewCharacterDs3(): Promise<void> {
        UCUFLogger.info(LogCategory.LIFECYCLE, '[LoadingScene] Preview target -> LobbyScene CharacterDs3 smoke route', {
            previewVariant: this.previewVariant,
        });

        await new Promise<void>((resolve, reject) => {
            director.loadScene('LobbyScene', (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });

        const lobbyScene = director.getScene()?.getComponentInChildren(LobbyScene) ?? null;
        if (!lobbyScene) {
            throw new Error('LobbyScene component not found after CharacterDs3 preview load');
        }

        const isReady = await lobbyScene.waitForReady(10000);
        if (!isReady) {
            throw new Error('[LoadingScene] LobbyScene not ready within 10s (character ds3 smoke route)');
        }

        await lobbyScene.previewCharacterDs3Smoke(this.previewVariant);
        await this._delay(180);
    }

    private async _previewGeneralDetailFromLobbyEntry(source: 'ucuf-nav' | 'scene-button'): Promise<void> {
        UCUFLogger.info(LogCategory.LIFECYCLE, '[LoadingScene] Preview target -> LobbyScene formal GeneralDetail entry smoke route', {
            source,
            previewVariant: this.previewVariant,
        });

        await new Promise<void>((resolve, reject) => {
            director.loadScene('LobbyScene', (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });

        const lobbyScene = director.getScene()?.getComponentInChildren(LobbyScene) ?? null;
        if (!lobbyScene) {
            throw new Error('LobbyScene component not found after formal GeneralDetail entry preview load');
        }

        const isReady = await lobbyScene.waitForReady(10000);
        if (!isReady) {
            throw new Error('[LoadingScene] LobbyScene not ready within 10s (formal GeneralDetail entry route)');
        }

        await lobbyScene.previewGeneralDetailEntrySmoke(source, this.previewVariant || 'zhang-fei');
        await this._waitForGeneralDetailVisualReady('Overview');
        await this._delay(180);
        this._setCaptureState('ready', 'character-ds3-main');
    }

    private async _previewBattleScene(): Promise<void> {
        console.log('[LoadingScene] Preview target -> BattleScene.scene');
        services().scene.setNextScene('BattleScene', this._resolvePreviewBattleParams());
        await new Promise<void>((resolve, reject) => {
            director.loadScene('BattleScene', (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    }

    private async _previewGeneralDetailOverview(): Promise<void> {
        console.log('[LoadingScene] Preview target -> LobbyScene GeneralDetailOverview smoke route');
        await this._previewGeneralDetailByTab('Overview');
    }

    private async _previewGeneralDetailSkills(): Promise<void> {
        console.log('[LoadingScene] Preview target -> LobbyScene GeneralDetailSkills smoke route');
        await this._previewGeneralDetailByTab('Skills');
    }

    private async _previewGeneralDetailStats(): Promise<void> {
        await this._previewGeneralDetailByTab('Stats');
    }

    private async _previewGeneralDetailBloodline(): Promise<void> {
        await this._previewGeneralDetailByTab('Bloodline');
    }

    private async _previewGeneralDetailBasics(): Promise<void> {
        await this._previewGeneralDetailByTab('Basics');
    }

    private async _previewGeneralDetailAptitude(): Promise<void> {
        await this._previewGeneralDetailByTab('Aptitude');
    }

    private async _previewGeneralList(): Promise<void> {
        console.log('[LoadingScene] Preview target -> LobbyScene GeneralList smoke route');

        await new Promise<void>((resolve, reject) => {
            director.loadScene('LobbyScene', (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });

        const lobbyScene = director.getScene()?.getComponentInChildren(LobbyScene) ?? null;
        if (!lobbyScene) {
            throw new Error('LobbyScene component not found after preview load');
        }

        const isReady = await lobbyScene.waitForReady(10000);
        if (!isReady) {
            throw new Error('[LoadingScene] LobbyScene not ready within 10s (generals not loaded)');
        }

        await lobbyScene.previewGeneralListSmoke();
        await this._delay(180);
        this._fitPreviewHostToViewport();
        await this._delay(80);
        this._fitPreviewHostToViewport();
    }

    private async _previewGachaFromLobby(): Promise<void> {
        UCUFLogger.info(LogCategory.LIFECYCLE, '[LoadingScene] Preview target -> LobbyScene GachaMain smoke route');

        await new Promise<void>((resolve, reject) => {
            director.loadScene('LobbyScene', (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });

        const lobbyScene = director.getScene()?.getComponentInChildren(LobbyScene) ?? null;
        if (!lobbyScene) {
            throw new Error('LobbyScene component not found after preview load');
        }

        const isReady = await lobbyScene.waitForReady(10000);
        if (!isReady) {
            throw new Error('[LoadingScene] LobbyScene not ready within 10s (gacha hosts not loaded)');
        }

        await lobbyScene.previewGachaMainSmoke();
        await this._delay(180);
        this._fitPreviewHostToViewport();
        await this._delay(80);
        this._fitPreviewHostToViewport();
    }

    private async _previewEliteTroopCodex(): Promise<void> {
        console.log('[LoadingScene] Preview target -> LobbyScene EliteTroopCodex smoke route');

        await new Promise<void>((resolve, reject) => {
            director.loadScene('LobbyScene', (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });

        const lobbyScene = director.getScene()?.getComponentInChildren(LobbyScene) ?? null;
        if (!lobbyScene) {
            throw new Error('LobbyScene component not found after preview load');
        }

        const isReady = await lobbyScene.waitForReady(10000);
        if (!isReady) {
            throw new Error('[LoadingScene] LobbyScene not ready within 10s (EliteTroopCodex data not loaded)');
        }

        await lobbyScene.onClickEliteTroopCodexSmoke(this.previewVariant);
        await this._waitForEliteTroopCodexVisualReady();
        await this._delay(180);

        this._setCaptureState('ready', 'elite-troop-codex-screen');
    }

    private async _previewLobbyMissionDetailDialog(): Promise<void> {
        console.log('[LoadingScene] Preview target -> LobbyScene LobbyMissionDetailDialog smoke route');

        await new Promise<void>((resolve, reject) => {
            director.loadScene('LobbyScene', (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });

        const lobbyScene = director.getScene()?.getComponentInChildren(LobbyScene) ?? null;
        if (!lobbyScene) {
            throw new Error('LobbyScene component not found after preview load');
        }

        const isReady = await lobbyScene.waitForReady(10000);
        if (!isReady) {
            throw new Error('[LoadingScene] LobbyScene not ready within 10s (mission dialog data not loaded)');
        }

        await lobbyScene.previewMissionDetailSmoke(this.previewVariant);
        await this._waitForLobbyMissionDetailDialogVisualReady(this.previewVariant);
        await this._delay(180);
    }

    private async _previewGeneralDetailByTab(tab: GeneralDetailPreviewTab): Promise<void> {
        const previewVariant = this.previewVariant.trim();

        await new Promise<void>((resolve, reject) => {
            director.loadScene('LobbyScene', (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });

        const lobbyScene = director.getScene()?.getComponentInChildren(LobbyScene) ?? null;
        if (!lobbyScene) {
            throw new Error('LobbyScene component not found after preview load');
        }

        // Wait for async start() so the generals data is fully loaded before smoke routing.
        const isReady = await lobbyScene.waitForReady(10000);
        if (!isReady) {
            throw new Error('[LoadingScene] LobbyScene not ready within 10s (generals not loaded)');
        }

        switch (tab) {
        case 'Overview':
            await lobbyScene.onClickGeneralDetailOverviewSmoke(previewVariant);
            break;
        case 'Stats':
            await lobbyScene.onClickGeneralDetailStatsSmoke(previewVariant);
            break;
        case 'Bloodline':
            await lobbyScene.onClickGeneralDetailBloodlineSmoke(previewVariant);
            break;
        case 'Basics':
            await lobbyScene.onClickGeneralDetailBasicsSmoke(previewVariant);
            break;
        case 'Aptitude':
            await lobbyScene.onClickGeneralDetailAptitudeSmoke(previewVariant);
            break;
        case 'Skills':
            await lobbyScene.onClickGeneralDetailSkillsSmoke(previewVariant);
            break;
        }

        await this._waitForGeneralDetailVisualReady(tab);
        await this._delay(180);

        this._setCaptureState('ready', 'general-detail-unified-screen');
    }

    private async _waitForGeneralDetailVisualReady(tab: GeneralDetailPreviewTab): Promise<void> {
        const startedAt = Date.now();
        let lastError: Error | null = null;

        while (Date.now() - startedAt < 2500) {
            const detailPanel = director.getScene()?.getComponentInChildren(GeneralDetailComposite) ?? null;
            if (!detailPanel || !detailPanel.node.active) {
                lastError = new Error(
                    `[LoadingScene] GeneralDetail preview missing active GeneralDetailComposite; tab=${tab} active=${detailPanel?.node?.active ?? false}`,
                );
                await this._delay(120);
                continue;
            }

            try {
                if (tab === 'Skills') {
                    this._assertGeneralDetailSkillsVisualReady(detailPanel);
                } else if (tab === 'Stats') {
                    this._assertGeneralDetailStatsVisualReady(detailPanel);
                } else if (tab === 'Bloodline') {
                    this._assertGeneralDetailBloodlineVisualReady(detailPanel);
                } else if (tab === 'Basics') {
                    this._assertGeneralDetailBasicsVisualReady(detailPanel);
                } else if (tab === 'Aptitude') {
                    this._assertGeneralDetailAptitudeVisualReady(detailPanel);
                } else {
                    this._assertGeneralDetailOverviewVisualReady(detailPanel);
                }
                return;
            } catch (error) {
                lastError = error instanceof Error
                    ? error
                    : new Error(String(error));
                await this._delay(120);
            }
        }

        throw lastError ?? new Error(`[LoadingScene] GeneralDetail preview readiness timed out: tab=${tab}`);
    }

    private async _waitForLobbyMissionDetailDialogVisualReady(previewVariant: string): Promise<void> {
        const startedAt = Date.now();
        let lastError: Error | null = null;
        const highIntelVariant = this._isLobbyMissionDetailHighIntelVariant(previewVariant);

        while (Date.now() - startedAt < 2500) {
            const dialogPanel = director.getScene()?.getComponentInChildren(LobbyMissionDetailDialogComposite) ?? null;
            if (!dialogPanel || !dialogPanel.node.activeInHierarchy) {
                lastError = new Error(
                    `[LoadingScene] LobbyMissionDetailDialog preview missing active LobbyMissionDetailDialogComposite; active=${dialogPanel?.node?.active ?? false}`,
                );
                await this._delay(120);
                continue;
            }

            const root = dialogPanel.node.getChildByPath('__safeArea/LobbyMissionDetailDialogRoot')
                ?? dialogPanel.node.getChildByName('LobbyMissionDetailDialogRoot');
            if (!root || !root.activeInHierarchy) {
                lastError = new Error('[LoadingScene] LobbyMissionDetailDialog preview missing LobbyMissionDetailDialogRoot');
                await this._delay(120);
                continue;
            }

            try {
                this._requireMissionDetailNonEmptyLabel(root, 'DialogCard/HeaderBar/DialogTitleLabel');
                this._requireMissionDetailNonEmptyLabel(root, 'DialogCard/ScrollView/ScrollContent/OverviewPanel/MissionTitleLabel');
                this._requireMissionDetailNonEmptyLabel(root, 'DialogCard/ScrollView/ScrollContent/IntelPanel/IntelBodyLabel');
                this._requireMissionDetailNonEmptyLabel(root, 'DialogCard/ScrollView/ScrollContent/RewardPanel/RewardBaseLabel');
                this._requireMissionDetailNonEmptyLabel(root, 'DialogCard/ScrollView/ScrollContent/RewardPanel/RewardPerfectLabel');
                this._requireMissionDetailNode(root, 'DialogCard/FooterBar/AiDelegateToggle');
                this._requireMissionDetailNode(root, 'DialogCard/ScrollView/ScrollContent/AssignmentPanel/GeneralSelectButton');

                const fogMask = root.getChildByPath('DialogCard/ScrollView/ScrollContent/IntelPanel/IntelFogMask');
                if (!fogMask) {
                    throw new Error('[LoadingScene] LobbyMissionDetailDialog preview missing IntelFogMask');
                }
                if (highIntelVariant && fogMask.activeInHierarchy) {
                    throw new Error('[LoadingScene] LobbyMissionDetailDialog preview should hide IntelFogMask in 100% intel mode');
                }
                if (!highIntelVariant && !fogMask.activeInHierarchy) {
                    throw new Error('[LoadingScene] LobbyMissionDetailDialog preview should show IntelFogMask in partial intel mode');
                }

                return;
            } catch (error) {
                lastError = error instanceof Error
                    ? error
                    : new Error(String(error));
                await this._delay(120);
            }
        }

        throw lastError ?? new Error('[LoadingScene] LobbyMissionDetailDialog preview readiness timed out');
    }

    private _requireMissionDetailNode(root: Node, path: string): Node {
        const node = root.getChildByPath(path);
        if (!node || !node.activeInHierarchy) {
            throw new Error(`[LoadingScene] LobbyMissionDetailDialog preview missing active node: ${path}`);
        }
        return node;
    }

    private _requireMissionDetailNonEmptyLabel(root: Node, path: string): void {
        const node = this._requireMissionDetailNode(root, path);
        const label = node.getComponent(Label);
        if (!label || !label.string.trim()) {
            throw new Error(`[LoadingScene] LobbyMissionDetailDialog preview missing label content: ${path}`);
        }
    }

    private _isLobbyMissionDetailHighIntelVariant(previewVariant: string): boolean {
        const requested = previewVariant.trim().toLowerCase();
        if (!requested) {
            return false;
        }

        const normalized = requested.replace(/[\s_-]/g, '');
        return requested === 'domestic'
            || requested === 'revealed'
            || requested === 'full'
            || requested === '100'
            || requested === '100%'
            || requested === 'smoke-domestic-revealed'
            || normalized === '100';
    }

    private async _waitForEliteTroopCodexVisualReady(): Promise<void> {
        const startedAt = Date.now();
        let lastError: Error | null = null;

        while (Date.now() - startedAt < 2500) {
            const codexPanel = director.getScene()?.getComponentInChildren(EliteTroopCodexComposite) ?? null;
            if (!codexPanel || !codexPanel.node.activeInHierarchy) {
                lastError = new Error(
                    `[LoadingScene] EliteTroopCodex preview missing active EliteTroopCodexComposite; active=${codexPanel?.node?.active ?? false}`,
                );
                await this._delay(120);
                continue;
            }

            const root = codexPanel.node.getChildByPath('__safeArea/EliteTroopCodexRoot')
                ?? codexPanel.node.getChildByName('EliteTroopCodexRoot');
            if (!root || !root.activeInHierarchy) {
                lastError = new Error('[LoadingScene] EliteTroopCodex preview missing EliteTroopCodexRoot');
                await this._delay(120);
                continue;
            }

            try {
                this._requireNonEmptyLabel(root, 'HeaderRow/CodexTitle');
                this._requireNonEmptyLabel(root, 'HeaderRow/CodexSubtitle');
                this._requireActiveNode(root, 'RightDetailPanel/DetailContent/SelectedTroopBannerShell/SelectedTroopBannerArt');
                this._requireActiveNode(root, 'RightDetailPanel/DetailContent/SelectedTroopCrestShell/SelectedTroopCrestArt');

                const bannerArt = root.getChildByPath('RightDetailPanel/DetailContent/SelectedTroopBannerShell/SelectedTroopBannerArt')?.getComponent(Sprite);
                const crestArt = root.getChildByPath('RightDetailPanel/DetailContent/SelectedTroopCrestShell/SelectedTroopCrestArt')?.getComponent(Sprite);
                if (!bannerArt?.spriteFrame) {
                    throw new Error('[LoadingScene] EliteTroopCodex preview missing banner spriteFrame');
                }
                if (!crestArt?.spriteFrame) {
                    throw new Error('[LoadingScene] EliteTroopCodex preview missing crest spriteFrame');
                }

                const listContent = root.getChildByPath('CenterGridPanel/TroopList/view/Content');
                if (!listContent || !listContent.activeInHierarchy || listContent.children.length < 34) {
                    throw new Error(
                        `[LoadingScene] EliteTroopCodex preview list not ready: childCount=${listContent?.children.length ?? 0}`,
                    );
                }

                const firstRow = listContent.children[0];
                if (!firstRow) {
                    throw new Error('[LoadingScene] EliteTroopCodex preview missing first row');
                }
                const firstRowArt = firstRow.getChildByPath('CardArtShell/CardArt')?.getComponent(Sprite);
                if (!firstRowArt?.spriteFrame) {
                    throw new Error('[LoadingScene] EliteTroopCodex preview missing first row spriteFrame');
                }

                return;
            } catch (error) {
                lastError = error instanceof Error
                    ? error
                    : new Error(String(error));
                await this._delay(120);
            }
        }

        throw lastError ?? new Error('[LoadingScene] EliteTroopCodex preview readiness timed out');
    }

    private async _previewSpiritTallyDetail(): Promise<void> {
        console.log('[LoadingScene] Preview target -> spirit-tally-detail-screen');
        await this._previewHost?.showScreen('spirit-tally-detail-screen');
        const previewState = await this._loadSpiritTallyDetailPreviewState();
        if (previewState && this._previewHost?.binder) {
            applyUIPreviewBinderState(this._previewHost.binder, previewState);
        }
        await this._delay(180);
    }

    private _toPreviewText(value: unknown): string {
        if (typeof value === 'string') {
            return value;
        }
        if (typeof value === 'number') {
            return String(value);
        }
        return '';
    }

    private async _loadSpiritTallyDetailPreviewState(): Promise<UIPreviewBinderState | null> {
        try {
            const generals = await services().resource.loadJson<GeneralConfig[]>('data/generals', { tags: ['LoadingScenePreview'] });
            const smokeGeneral = this._resolvePreviewGeneral(generals, this.previewVariant);
            if (!smokeGeneral) {
                return null;
            }

            const rarityTier = smokeGeneral.rarityTier ?? 'rare';

            return {
                texts: {
                    HeroName: smokeGeneral.name || '\u5c07\u9b42\u540d\u9304',
                    TallyTitle: smokeGeneral.title || smokeGeneral.awakeningTitle || '\u5c07\u9b42\u547d\u93e1',
                    SpiritRank: getUIRarityMarkLabel(rarityTier),
                },
                rarityDocks: [
                    {
                        tier: rarityTier,
                        binding: {
                            dockNodeName: 'SpiritRankDock',
                            underlayNodeName: 'SpiritRankUnderlay',
                            badgeNodeName: 'SpiritRankBadge',
                            labelNodeName: 'SpiritRank',
                        },
                    },
                ],
            };
        } catch (error) {
            console.warn('[LoadingScene] 載入 SpiritTallyDetail preview state 失敗', error);
            return null;
        }
    }

    private _resolvePreviewGeneral(generals: GeneralConfig[], previewVariant: string): GeneralConfig | null {
        const requested = previewVariant.trim().toLowerCase();
        let preferredId: string | null = null;

        if (requested === 'zhen-ji' || requested === 'zhenji' || requested === 'smoke-zhen-ji') {
            preferredId = 'zhen-ji';
        } else if (requested === 'zhao-yun' || requested === 'zhaoyun') {
            preferredId = 'zhao-yun';
        } else if (requested === 'zhang-fei' || requested === 'zhangfei' || requested === 'smoke-zhang-fei') {
            preferredId = 'zhang-fei';
        } else if (requested && requested !== 'default') {
            preferredId = requested;
        }

        return (preferredId ? generals.find((item) => item.id === preferredId) : null)
            ?? generals[0]
            ?? null;
    }

    private _assertGeneralDetailOverviewVisualReady(detailPanel: GeneralDetailComposite): void {
        // DS3 cutover (2026-04-28)：DS3 layout 沒有 GeneralDetailRoot 等 unified-only 節點，
        // 偵測到 DS3 layout 已掛載即視為「ready」（chrome wiring 仍待 ChildPanel 補齊）。
        const ds3Root = detailPanel.node.getChildByName('CharacterDs3Main');
        if (ds3Root && ds3Root.activeInHierarchy) {
            return;
        }

        const root = detailPanel.node.getChildByPath('__safeArea/GeneralDetailRoot')
            ?? detailPanel.node.getChildByName('GeneralDetailRoot');
        if (!root) {
            throw new Error('[LoadingScene] GeneralDetailOverview preview missing GeneralDetailRoot');
        }

        const overviewSlot = root.getChildByName('OverviewSlot')
            ?? root.getChildByPath('RightContentArea/OverviewSlot');
        const overviewContent = overviewSlot?.activeInHierarchy
            ? overviewSlot.getChildByName('OverviewTabContent')
            : null;

        if (!overviewContent?.activeInHierarchy) {
            throw new Error('[LoadingScene] GeneralDetailOverview preview missing active OverviewSlot/OverviewTabContent');
        }

        this._requireNonEmptyLabel(overviewContent, 'HeaderRow/NameTitleColumn/NameTitleRow/NameLabel');
        this._requireActiveNode(overviewContent, 'OverviewSummaryModules/CoreStatsCard');
        this._requireActiveNode(overviewContent, 'BloodlineOverviewModules');
        this._assertGeneralDetailOverviewPortraitReady(root);
    }

    private _requireActiveNode(root: Node, path: string): Node {
        const node = root.getChildByPath(path);
        if (!node || !node.activeInHierarchy) {
            throw new Error(`[LoadingScene] GeneralDetailOverview preview missing active node: ${path}`);
        }
        return node;
    }

    private _requireNonEmptyLabel(root: Node, path: string): void {
        const node = this._requireActiveNode(root, path);
        const label = node.getComponent(Label);
        if (!label || !label.string.trim()) {
            throw new Error(`[LoadingScene] GeneralDetailOverview preview missing label content: ${path}`);
        }
    }

    private _assertGeneralDetailOverviewPortraitReady(root: Node): void {
        const portraitNode = this._requireActiveNode(root, 'PortraitImage');
        const sprite = portraitNode.getComponent(Sprite);
        if (!sprite?.spriteFrame) {
            throw new Error('[LoadingScene] GeneralDetailOverview preview missing portrait spriteFrame: PortraitImage');
        }

        const portraitArtwork = root.getChildByPath('PortraitArtworkOverlayHost/PortraitArtworkCarrier/PortraitArtwork')
            ?? root.getChildByPath('PortraitImage/PortraitArtworkCarrier/PortraitArtwork');
        if (!portraitArtwork || !portraitArtwork.activeInHierarchy) {
            throw new Error('[LoadingScene] GeneralDetailOverview preview missing active PortraitArtwork child: PortraitArtworkOverlayHost/PortraitArtworkCarrier/PortraitArtwork');
        }

        const portraitArtworkSprite = portraitArtwork.getComponent(Sprite);
        if (!portraitArtworkSprite?.spriteFrame) {
            throw new Error('[LoadingScene] GeneralDetailOverview preview missing portrait artwork spriteFrame: PortraitArtwork');
        }

        const opacity = portraitNode.getComponent(UIOpacity);
        if (opacity && opacity.opacity <= 0) {
            throw new Error('[LoadingScene] GeneralDetailOverview preview portrait opacity is zero: PortraitImage');
        }

        const transform = portraitNode.getComponent(UITransform);
        if (!transform || transform.width < 64 || transform.height < 64) {
            throw new Error(
                `[LoadingScene] GeneralDetailOverview preview portrait collapsed: PortraitImage size=${transform?.width ?? 'null'}x${transform?.height ?? 'null'}`,
            );
        }
    }

    private _assertGeneralDetailSkillsVisualReady(detailPanel: GeneralDetailComposite): void {
        const root = detailPanel.node.getChildByPath('__safeArea/GeneralDetailRoot')
            ?? detailPanel.node.getChildByName('GeneralDetailRoot');
        if (!root) {
            throw new Error('[LoadingScene] GeneralDetailSkills preview missing GeneralDetailRoot');
        }

        this._requireActiveDescendant(root, 'PrimarySkillCard');
        this._requireNonEmptyDescendantLabel(root, 'PrimarySkillValue');
        this._requireActiveDescendant(root, 'LearnedSkillsCard');
        this._requireNonEmptyDescendantLabel(root, 'LearnedSkillsValue');
        this._requireActiveDescendant(root, 'LockedSkillsCard');
        this._requireNonEmptyDescendantLabel(root, 'LockedSkillsValue');
        this._requireNonEmptyDescendantLabel(root, 'SkillNoteValue');
    }

    private _assertGeneralDetailStatsVisualReady(detailPanel: GeneralDetailComposite): void {
        const root = detailPanel.node.getChildByPath('__safeArea/GeneralDetailRoot')
            ?? detailPanel.node.getChildByName('GeneralDetailRoot');
        if (!root) {
            throw new Error('[LoadingScene] GeneralDetailStats preview missing GeneralDetailRoot');
        }

        const readyTab = (detailPanel.node as Node & { __generalDetailReadyTab?: string }).__generalDetailReadyTab;
        if (readyTab !== 'Stats') {
            throw new Error(`[LoadingScene] GeneralDetail preview not ready for Stats: ${readyTab ?? 'null'}`);
        }
    }

    private _assertGeneralDetailBloodlineVisualReady(detailPanel: GeneralDetailComposite): void {
        const root = detailPanel.node.getChildByPath('__safeArea/GeneralDetailRoot')
            ?? detailPanel.node.getChildByName('GeneralDetailRoot');
        if (!root) {
            throw new Error('[LoadingScene] GeneralDetailBloodline preview missing GeneralDetailRoot');
        }

        this._requireActiveDescendant(root, 'BloodlineSummaryCard');
        this._requireNonEmptyDescendantLabel(root, 'EpRatingValue');
        this._requireNonEmptyDescendantLabel(root, 'AwakeningValue');
        this._requireActiveDescendant(root, 'AncestorTree');
    }

    private _assertGeneralDetailBasicsVisualReady(detailPanel: GeneralDetailComposite): void {
        const root = detailPanel.node.getChildByPath('__safeArea/GeneralDetailRoot')
            ?? detailPanel.node.getChildByName('GeneralDetailRoot');
        if (!root) {
            throw new Error('[LoadingScene] GeneralDetailBasics preview missing GeneralDetailRoot');
        }

        this._requireNonEmptyDescendantLabel(root, 'UidValue');
        this._requireNonEmptyDescendantLabel(root, 'NameValue');
        this._requireNonEmptyDescendantLabel(root, 'RoleValue');
        this._requireNonEmptyDescendantLabel(root, 'SourceValue');
    }

    private _assertGeneralDetailAptitudeVisualReady(detailPanel: GeneralDetailComposite): void {
        const root = detailPanel.node.getChildByPath('__safeArea/GeneralDetailRoot')
            ?? detailPanel.node.getChildByName('GeneralDetailRoot');
        if (!root) {
            throw new Error('[LoadingScene] GeneralDetailAptitude preview missing GeneralDetailRoot');
        }

        this._requireActiveDescendant(root, 'TroopCard');
        this._requireNonEmptyDescendantLabel(root, 'TroopValue');
        this._requireNonEmptyDescendantLabel(root, 'PreferredTerrainValue');
        this._requireNonEmptyDescendantLabel(root, 'TerrainBonusValue');
    }

    private _requireActiveDescendant(root: Node, nodeName: string): Node {
        const node = this._findActiveDescendantByName(root, nodeName)
            ?? this._findDescendantByName(root, nodeName);
        if (!node || !node.activeInHierarchy) {
            throw new Error(`[LoadingScene] GeneralDetail preview missing active descendant: ${nodeName}`);
        }
        return node;
    }

    private _requireNonEmptyDescendantLabel(root: Node, nodeName: string): void {
        const node = this._requireActiveDescendant(root, nodeName);
        const label = node.getComponent(Label);
        if (!label || !label.string.trim()) {
            throw new Error(`[LoadingScene] GeneralDetail preview missing label content: ${nodeName}`);
        }
    }

    private _findDescendantByName(root: Node, nodeName: string): Node | null {
        if (root.name === nodeName) {
            return root;
        }

        for (const child of root.children) {
            const match = this._findDescendantByName(child, nodeName);
            if (match) {
                return match;
            }
        }

        return null;
    }

    private _findActiveDescendantByName(root: Node, nodeName: string): Node | null {
        if (root.name === nodeName && root.activeInHierarchy) {
            return root;
        }

        for (const child of root.children) {
            const match = this._findActiveDescendantByName(child, nodeName);
            if (match) {
                return match;
            }
        }

        return null;
    }

    private _delay(ms: number): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }

    private async _startTransition() {
        const target = services().scene.getTargetScene();
        if (!target.name) return;

        console.log(`[LoadingScene] 資源清理完畢，開始預載入 ${target.name}...`);

        // 徹底釋放舊資源
        // @ts-ignore
        const resBundle = resources as any;
        if (typeof resBundle.releaseAll === 'function') resBundle.releaseAll();

        if (sys.isNative) {
            // @ts-ignore
            if (typeof garbageCollect === 'function') garbageCollect();
        }

        // 預載入目標場景
        director.preloadScene(target.name, (completedCount, totalCount) => {
            // 此處可更新進度條 UI
        }, async (error) => {
            if (error) {
                console.error(`[LoadingScene] 載入場景 ${target.name}失敗:`, error);
                return;
            }

            // ⚠️ 關鍵：切換前釋放 LoadingScene 自身的資源
            if (this._bgSpriteFrame) {
                this._bgSpriteFrame.decRef();
                this._bgSpriteFrame = null;
            }

            // 正式進入目標場景
            director.loadScene(target.name);
        });
    }
}
