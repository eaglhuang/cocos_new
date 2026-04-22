// @spec-source → 見 docs/cross-reference-index.md
import {
    _decorator,
    Component,
    director,
    sys,
    Enum,
    Label,
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
import { EliteTroopCodexComposite } from '../components/EliteTroopCodexComposite';
import { LobbyScene } from './LobbyScene';
import { BattleTactic } from '../../core/config/Constants';
import { DEFAULT_BATTLE_ENTRY_PARAMS, type BattleEntryParams } from '../../battle/models/BattleEntryParams';
import type { GeneralConfig } from '../../core/models/GeneralUnit';
import { getUIRarityMarkLabel } from '../core/UIRarityMark';
import { applyUIPreviewBinderState, type UIPreviewBinderState } from '../core/UIPreviewStateApplicator';

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
    GeneralDetailSkills = 12,
}

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
        case LoadingPreviewTarget.DuelChallenge:
            return 'duel-challenge-screen';
        case LoadingPreviewTarget.BattleScene:
            return 'battle-scene';
        case LoadingPreviewTarget.GeneralDetailOverview:
            return 'general-detail-unified-screen';
        case LoadingPreviewTarget.GeneralList:
            return 'general-list-screen';
        case LoadingPreviewTarget.EliteTroopCodex:
            return 'elite-troop-codex-screen';
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
            this._buildPreviewHost();
            return;
        }
        this._buildUI();
    }

    start() {
        if (this.previewMode) {
            void this._startPreview();
            return;
        }
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
            case LoadingPreviewTarget.GeneralList:
                await this._previewGeneralList();
                this._setCaptureState('ready', 'general-list-screen');
                return;
            case LoadingPreviewTarget.EliteTroopCodex:
                await this._previewEliteTroopCodex();
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
    }

    private async _previewShopMain(): Promise<void> {
        console.log('[LoadingScene] Preview target -> shop-main-screen');
        await this._previewHost?.showScreen('shop-main-screen');
    }

    private async _previewGacha(): Promise<void> {
        console.log('[LoadingScene] Preview target -> gacha-main-screen');
        await this._previewHost?.showScreen('gacha-main-screen');
        const previewState = await this._loadGachaPreviewState();
        if (previewState && this._previewHost?.binder) {
            applyUIPreviewBinderState(this._previewHost.binder, previewState);
        }
    }

    private async _previewDuelChallenge(): Promise<void> {
        console.log('[LoadingScene] Preview target -> duel-challenge-screen');
        await this._previewHost?.showScreen('duel-challenge-screen');
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
            throw new Error('[LoadingScene] LobbyScene 未能在 10 秒內完成初始化（generals 尚未載入）');
        }

        await lobbyScene.previewGeneralListSmoke();
        await this._delay(180);
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

    private async _previewGeneralDetailByTab(tab: 'Overview' | 'Skills'): Promise<void> {
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

        // 等待 LobbyScene 完成 async start()（generals 資料載入完畢），避免 360ms 固定等待不夠
        const isReady = await lobbyScene.waitForReady(10000);
        if (!isReady) {
            throw new Error('[LoadingScene] LobbyScene 未能在 10 秒內完成初始化（generals 尚未載入）');
        }

        if (tab === 'Skills') {
            await lobbyScene.onClickGeneralDetailSkillsSmoke(previewVariant);
        } else {
            await lobbyScene.onClickGeneralDetailOverviewSmoke(previewVariant);
        }

        await this._waitForGeneralDetailVisualReady(tab);
        await this._delay(180);

        this._setCaptureState('ready', 'general-detail-unified-screen');
    }

    private async _waitForGeneralDetailVisualReady(tab: 'Overview' | 'Skills'): Promise<void> {
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

    private async _loadGachaPreviewState(): Promise<UIPreviewBinderState | null> {
        try {
            const content = await services().resource.loadJson<any>(
                'ui-spec/content/gacha-preview-states-v1',
                { tags: ['LoadingScenePreview'] },
            );
            const defaultState = typeof content?.defaultState === 'string' ? content.defaultState : 'hero';
            const stateKey = this._resolveGachaPreviewStateKey(defaultState);
            return content?.states?.[stateKey] ?? content?.states?.[defaultState] ?? null;
        } catch (error) {
            console.warn('[LoadingScene] 載入 Gacha preview state 失敗', error);
            return null;
        }
    }

    private _resolveGachaPreviewStateKey(defaultState: string): string {
        const requested = this.previewVariant.trim().toLowerCase();
        if (requested === 'hero' || requested === 'support' || requested === 'limited') {
            return requested;
        }
        return defaultState;
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

        this._requireNonEmptyLabel(overviewContent, 'HeaderRow/NameTitleColumn/NameLabel');
        this._requireActiveNode(overviewContent, 'OverviewSummaryModules/CoreStatsCard');
        this._requireActiveNode(
            overviewContent,
            'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineSummaryCard',
        );
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

    private _requireActiveDescendant(root: Node, nodeName: string): Node {
        const node = this._findDescendantByName(root, nodeName);
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
