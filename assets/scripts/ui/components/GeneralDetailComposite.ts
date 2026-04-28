import { _decorator, Button, Color, Label, Node, Sprite, UIOpacity, UITransform, Widget } from 'cc';
import { CompositePanel } from '../core/CompositePanel';
import type { UITemplateBinder } from '../core/UITemplateBinder';
import type { ChildPanelBase } from '../core/ChildPanelBase';
import type { GeneralConfig, GeneralDetailDefaultTab, GeneralDetailRarityTier } from '../../core/models/GeneralUnit';
import { UIID } from '../../core/config/UIConfig';
import { services } from '../../core/managers/ServiceLoader';
import {
    buildGeneralDetailOverviewContentState,
    type GeneralDetailOverviewContentState,
} from './GeneralDetailOverviewMapper';
import { GeneralDetailOverviewChild } from './general-detail/GeneralDetailOverviewChild';
import { OVERVIEW_UNIFIED_CONTENT_CONTRACT_REF } from './general-detail/GeneralDetailOverviewBindPathPolicy';
import { GeneralDetailBasicsChild } from './general-detail/GeneralDetailBasicsChild';
import { GeneralDetailStatsChild } from './general-detail/GeneralDetailStatsChild';
import { GeneralDetailBloodlineChild } from './general-detail/GeneralDetailBloodlineChild';
import { GeneralDetailSkillsChild } from './general-detail/GeneralDetailSkillsChild';
import { GeneralDetailAptitudeChild } from './general-detail/GeneralDetailAptitudeChild';
import { CharacterDs3OverviewChild } from './character-ds3/CharacterDs3OverviewChild';
import { applyPortraitSoftMask, fitPortraitSpriteToLogicalFrame, getOrCreatePortraitArtworkSprite } from './portrait/PortraitSoftMask';
import { UCUFLogger, LogCategory } from '../core/UCUFLogger';
import { CocosCompositeRenderer } from '../platform/cocos/CocosCompositeRenderer';
import { UIVariantRouter } from '../core/UIVariantRouter';
import type { SpiritFamilyOverviewOpenPayload } from '../core/SpiritFamilyOverviewRoute';

const { ccclass } = _decorator;

type TabKey = 'Overview' | 'Stats' | 'Tactics' | 'Bloodline' | 'Equip' | 'Aptitude';
type UnifiedOverviewContentState = GeneralDetailOverviewContentState;

const TAB_ORDER: TabKey[] = ['Overview', 'Stats', 'Tactics', 'Bloodline', 'Equip', 'Aptitude'];
const PORTRAIT_ARTWORK_OVERLAY_HOST_NAME = 'PortraitArtworkOverlayHost';
const SPIRIT_FAMILY_SHORTCUT_ROOT_PATH = 'RightContentArea/ContentSlot/TabBloodlineContent/SpiritFamilyState';
const PORTRAIT_RARITY_BADGE_PATHS: Record<GeneralDetailRarityTier, string> = {
    common: 'sprites/ui_families/general_detail/icons/v3_parts/badge_rarity_common_flat',
    rare: 'sprites/ui_families/general_detail/icons/v3_parts/badge_rarity_rare_flat',
    epic: 'sprites/ui_families/general_detail/icons/v3_parts/badge_rarity_epic_flat',
    legendary: 'sprites/ui_families/general_detail/icons/v3_parts/badge_rarity_legendary_flat',
    mythic: 'sprites/ui_families/general_detail/icons/v3_parts/badge_rarity_legendary_flat',
};

interface ResolvedSpiritFamilyState {
    hasFamilyBranch: boolean;
    activeBranchUid: string | null;
    entryLabel: string;
}

@ccclass('GeneralDetailComposite')
export class GeneralDetailComposite extends CompositePanel {
    public onRequestClose: (() => void) | null = null;

    private _isMounted = false;
    private _activeTab: TabKey = 'Overview';
    private _currentConfig: GeneralConfig | null = null;
    private _currentBackgroundResource: string | null = null;
    private _currentPortraitRarityBadgeResource: string | null = null;
    private _gdBinder: UITemplateBinder | null = null;

    /**
     * 解析要載入的 screen 規格 ID。
     * 委派到 UIVariantRouter（M31）：先註冊路由，再依下列優先序解析：
     *   1. globalThis.__UCUF_GENERAL_DETAIL_VARIANT
     *   2. URL query: ?ui=ds3|unified
     *   3. localStorage: __ucuf_general_detail_variant === 'ds3'|'unified'
     * 2026-04-28：DS3 cutover Step 1 完成 layout flip，但因 DS3 ChildPanel data wiring 仍 WIP
     * 且 HTML vs DS3 視覺對齊尚未達 95%，default 暫時 revert 回 unified；DS3 仍可透過
     * `?ui=ds3` 或 localStorage 顯式進入做開發測試。Step 2 完成後再 flip default。
     */
    private static _resolveScreenId(): string {
        const LEGACY_SCREEN = 'general-detail-unified-screen';
        const DS3_SCREEN = 'character-ds3-main';
        UIVariantRouter.registerRoute('general-detail', {
            default: LEGACY_SCREEN,
            variants: { unified: LEGACY_SCREEN, ds3: DS3_SCREEN },
        });
        try {
            return UIVariantRouter.resolve('general-detail', LEGACY_SCREEN);
        } catch {
            return LEGACY_SCREEN;
        }
    }

    protected override _onAfterBuildReady(binder: UITemplateBinder): void {
        this._gdBinder = binder;
        this.setCompositeRenderer(new CocosCompositeRenderer());
        if (this._isDs3Active()) {
            // DS3 cutover (2026-04-28)：DS3 layout 沒有 unified-only 的 GeneralDetailRoot/RightTabBar
            // 等同名節點，因此跳過 unified-specific 靜態事件綁定。Tab 切換與資料綁定改由
            // DS3 ChildPanel（CharacterDs3OverviewChild 等，目前為骨架）負責，等 wiring 完成。
            UCUFLogger.info(LogCategory.LIFECYCLE, '[GeneralDetailComposite] DS3 mode: skip unified static events');
            return;
        }
        this._bindStaticEvents();
    }

    /** 目前 GeneralDetailComposite 是否以 DS3 layout 作為當前 screen。 */
    private _isDs3Active(): boolean {
        try {
            return GeneralDetailComposite._resolveScreenId() === 'character-ds3-main';
        } catch {
            return false;
        }
    }

    private _clearLegacySceneChildren(): void {
        for (const child of [...this.node.children]) {
            child.destroy();
        }
    }

    public async show(config: GeneralConfig): Promise<void> {
        UCUFLogger.info(LogCategory.LIFECYCLE, '[GeneralDetailComposite] show start', {
            generalId: config.id,
            generalName: config.name,
            isMounted: this._isMounted,
            previousTab: this._activeTab,
            nodeActive: this.node.active,
        });

        const parent = this.node.parent;
        if (parent) {
            this.node.setSiblingIndex(parent.children.length - 1);
        }

        // 必須在 mount/buildScreen 之前啟用節點，確保 Widget 計算時父容器尺寸正確
        this.node.active = true;

        if (!this._isMounted) {
            this._clearLegacySceneChildren();
            const screenId = GeneralDetailComposite._resolveScreenId();
            await this.mount(screenId);
            this._isMounted = true;
            UCUFLogger.info(LogCategory.LIFECYCLE, '[GeneralDetailComposite] mount completed', {
                childCount: this.node.children.length,
                screenId,
            });
        }
        this._currentConfig = config;

        if (this._isDs3Active()) {
            // DS3 cutover Step-1：layout 已掛載即視為「新畫面」可被使用者看到。
            // overview chrome / background / tab switching 仍依賴 unified 節點，DS3 不適用，先跳過。
            // ChildPanel data wiring 將在後續 turn 補齊（CharacterDs3OverviewChild 等目前是骨架）。
            (this.node as Node & { __generalDetailReadyTab?: string }).__generalDetailReadyTab = 'Overview';
            // 2026-04-28 (M16 階段 3)：smoke wiring — 直接實例化 CharacterDs3OverviewChild
            // 並把當前 GeneralConfig 餵進去，用 binder.getLabel(name) 寫到改名後的 Label 節點。
            // 這條路徑暫不走 fragment / slot 機制，待 layout 補 OverviewSlot 定義後再升級。
            try {
                if (this._gdBinder) {
                    const overviewHost = this._gdBinder.getNode('TabOverviewContent') ?? this.node;
                    const overviewChild = new CharacterDs3OverviewChild(overviewHost, this.skinResolver, this._gdBinder);
                    void overviewChild.onMount({}).then(() => {
                        overviewChild.onDataUpdate(config);
                    });
                }
            } catch (err) {
                UCUFLogger.warn(LogCategory.LIFECYCLE, '[GeneralDetailComposite] DS3 Overview smoke wiring failed', { err: String(err) });
            }
            UCUFLogger.info(LogCategory.LIFECYCLE, '[GeneralDetailComposite] DS3 show complete (chrome wiring pending)', {
                generalId: config.id,
                nodeActive: this.node.active,
                screenId: 'character-ds3-main',
            });
            return;
        }

        this._currentBackgroundResource = null;
        const overview = this._buildUnifiedOverviewState(config);
        await this._loadBackground(overview.backgroundResource);
        const entryTab = this._resolveEntryTab(config);
        UCUFLogger.info(LogCategory.LIFECYCLE, '[GeneralDetailComposite] resolved entry tab', {
            generalId: config.id,
            entryTab,
        });
        await this._switchToTab(entryTab);
        (this.node as Node & { __generalDetailReadyTab?: string }).__generalDetailReadyTab = entryTab;

        // 確保 GeneralDetailRoot 的 UIOpacity 為完全不透明
        // playEnterTransition 在 Editor Preview 中 tween 可能不執行，導致 opacity 停在 0
        // 暫時不使用 tween 動畫，直接同步設定 opacity=255
        const root = this._resolveMainRoot();
        if (root) {
            const uiOp = root.getComponent(UIOpacity);
            if (uiOp) {
                uiOp.opacity = 255;
            }
        }

        // 臨時 Preview 診斷已完成，恢復正式畫面輸出。

        UCUFLogger.info(LogCategory.LIFECYCLE, '[GeneralDetailComposite] show complete', {
            generalId: config.id,
            activeTab: this._activeTab,
            nodeActive: this.node.active,
            siblingIndex: this.node.getSiblingIndex(),
        });
    }

    public hide(): void {
        this.node.active = false;
    }

    public requestClose(): void {
        if (this.onRequestClose) {
            this.onRequestClose();
            return;
        }
        void services().ui.closeCurrentUI();
    }

    public override applyContentState(state: Record<string, unknown>): void {
        const config = state.config as GeneralConfig | undefined;
        if (config) {
            this._currentConfig = config;
            const overview = this._buildUnifiedOverviewState(config);
            this._applyOverviewChrome(overview);
            super.applyContentState({ config, overview });
            return;
        }

        super.applyContentState(state);
    }

    protected onDestroy(): void {
        if ((this.node as Node & { isValid?: boolean }).isValid) {
            this.unmount();
        }
        this._isMounted = false;
        this._gdBinder = null;
    }

    private _bindStaticEvents(): void {
        this._bindOptionalClick('TopCloseBtn', () => {
            this.requestClose();
        });

        for (const tab of TAB_ORDER) {
            this._bindClick(`RightTabBar/BtnTab${tab}`, () => {
                void this._switchToTab(tab);
            });
        }
    }

    private async _switchToTab(tab: TabKey): Promise<void> {
        UCUFLogger.info(LogCategory.LIFECYCLE, '[GeneralDetailComposite] switchToTab start', {
            requestedTab: tab,
            currentTab: this._activeTab,
        });

        this._activeTab = tab;
        const isOverview = tab === 'Overview';
        this._setOverviewMode(isOverview);

        if (!this._gdBinder) {
            const message = '[GeneralDetailComposite] _switchToTab 前 binder 尚未就緒';
            UCUFLogger.error(LogCategory.LIFECYCLE, message, { tab });
            throw new Error(message);
        }

        const slotId = isOverview ? 'OverviewSlot' : 'ContentSlot';
        const slotNode = this.getSlotNode(slotId);
        if (!slotNode) {
            const message = `[GeneralDetailComposite] 找不到必要節點 ${slotId}`;
            UCUFLogger.error(LogCategory.LIFECYCLE, message, { tab });
            throw new Error(message);
        }

        UCUFLogger.info(LogCategory.LIFECYCLE, '[GeneralDetailComposite] creating child for tab', { tab });
        const child = this._createChild(tab, slotNode, this._gdBinder);
        UCUFLogger.info(LogCategory.LIFECYCLE, '[GeneralDetailComposite] registering child panel', { child: child.constructor.name, slot: slotId });
        this.registerChildPanel(slotId, child);

        UCUFLogger.info(LogCategory.LIFECYCLE, '[GeneralDetailComposite] switching slot to fragment for tab', { tab });
        await this.switchTab(tab);

        this._syncTabVisualState();
        this._syncPortraitVisibility();
        UCUFLogger.info(LogCategory.LIFECYCLE, '[GeneralDetailComposite] applying current data after tab switch', { activeTab: this._activeTab });
        this._applyCurrentData();
        UCUFLogger.info(LogCategory.LIFECYCLE, '[GeneralDetailComposite] switchToTab complete', {
            activeTab: this._activeTab,
            slotChildCount: slotNode.children.length,
            childType: child.constructor.name,
        });
    }

    private _createChild(tab: TabKey, slotNode: Node, binder: UITemplateBinder): ChildPanelBase {
        switch (tab) {
        case 'Overview': {
            const child = new GeneralDetailOverviewChild(slotNode, this.skinResolver, binder);
            child.setCustomProp('contentContractRef', OVERVIEW_UNIFIED_CONTENT_CONTRACT_REF);
            return child as unknown as ChildPanelBase;
        }
        case 'Stats':
            return new GeneralDetailStatsChild(slotNode, this.skinResolver, binder) as unknown as ChildPanelBase;
        case 'Bloodline':
            return new GeneralDetailBloodlineChild(slotNode, this.skinResolver, binder) as unknown as ChildPanelBase;
        case 'Tactics':
            return new GeneralDetailSkillsChild(slotNode, this.skinResolver, binder) as unknown as ChildPanelBase;
        case 'Equip':
            return new GeneralDetailBasicsChild(slotNode, this.skinResolver, binder) as unknown as ChildPanelBase;
        case 'Aptitude':
            return new GeneralDetailAptitudeChild(slotNode, this.skinResolver, binder) as unknown as ChildPanelBase;
        }
    }

    private _resolveEntryTab(config: GeneralConfig): TabKey {
        const preferredTab = config.profilePresentation?.defaultTab as GeneralDetailDefaultTab | undefined;
        switch (preferredTab) {
        case 'Overview':
        case 'Stats':
        case 'Bloodline':
        case 'Aptitude':
            return preferredTab;
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

    private _buildUnifiedOverviewState(config: GeneralConfig): UnifiedOverviewContentState {
        return buildGeneralDetailOverviewContentState(config);
    }

    private _applyCurrentData(): void {
        if (!this._currentConfig) {
            return;
        }

        const overview = this._buildUnifiedOverviewState(this._currentConfig);
        this._applyOverviewChrome(overview);
        super.applyContentState({
            config: this._currentConfig,
            overview,
        });
        this._syncSpiritFamilyShortcut();
    }

    private _applyOverviewChrome(state: UnifiedOverviewContentState): void {
        void this._loadBackground(state.backgroundResource);
        void this._loadPortrait(state.portraitResource);
        void this._loadPortraitRarityBadge(state.rarityTier);

        // Overview visual pass — 將 Shell 時代的 sprite color / opacity / label color 套用到 Unified 節點
        // 注意：由呼叫端在 super.applyContentState 之後執行，以免被重建覆蓋。
    }

    private async _loadBackground(resourcePath: string): Promise<void> {
        const normalizedPath = resourcePath.trim();
        if (!normalizedPath) {
            const message = '[GeneralDetailComposite] 背景資源路徑空白';
            UCUFLogger.error(LogCategory.DATA, message);
            throw new Error(message);
        }

        if (this._currentBackgroundResource === normalizedPath) {
            return;
        }

        const node = this._requireNode('BackgroundFull');
        const sprite = node.getComponent(Sprite) || node.addComponent(Sprite);
        const frame = await services().resource.loadSpriteFrame(normalizedPath, { preferTextureFallback: true }).catch(() => null);
        if (!frame) {
            const message = `[GeneralDetailComposite] 載入 BackgroundFull spriteFrame 失敗: ${normalizedPath}`;
            UCUFLogger.error(LogCategory.DATA, message);
            throw new Error(message);
        }

        sprite.spriteFrame = frame;
        sprite.type = Sprite.Type.SIMPLE;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.color = Color.WHITE;
        this._currentBackgroundResource = normalizedPath;
        UCUFLogger.info(LogCategory.DATA, '[GeneralDetailComposite] loadBackground complete', {
            resourcePath: normalizedPath,
        });
    }

    private async _loadPortrait(resourcePath: string): Promise<void> {
        const normalizedPath = resourcePath.trim();
        UCUFLogger.info(LogCategory.DATA, '[GeneralDetailComposite] loadPortrait start', {
            resourcePath: normalizedPath,
        });
        const node = this._requireNode('PortraitImage');
        const portraitOverlayHost = this._getOrCreatePortraitArtworkOverlayHost(node);
        const sprite = getOrCreatePortraitArtworkSprite(portraitOverlayHost);
        if (!sprite) {
            UCUFLogger.error(LogCategory.DATA, '[GeneralDetailComposite] 無法建立 PortraitArtwork sprite');
            return;
        }
        const frame = await services().resource.loadSpriteFrame(normalizedPath, { preferTextureFallback: true }).catch(() => null);
        if (!frame) {
            UCUFLogger.error(LogCategory.DATA,
                `[GeneralDetailComposite] 載入 PortraitImage spriteFrame 失敗: ${normalizedPath}`);
            return;
        }

        sprite.spriteFrame = frame;
        sprite.type = Sprite.Type.SIMPLE;
        sprite.color = Color.WHITE;
        const hostTransform = node.getComponent(UITransform);
        const overlayHostTransform = portraitOverlayHost.getComponent(UITransform);
        UCUFLogger.info(LogCategory.DATA, '[GeneralDetailComposite] portrait spriteFrame assigned', {
            resourcePath: normalizedPath,
            frameWidth: frame.width,
            frameHeight: frame.height,
            originalWidth: frame.originalSize.width,
            originalHeight: frame.originalSize.height,
            offsetX: frame.offset.x,
            offsetY: frame.offset.y,
            hostNode: node.name,
            hostWidth: hostTransform?.width,
            hostHeight: hostTransform?.height,
            overlayHostNode: portraitOverlayHost.name,
            overlayHostWidth: overlayHostTransform?.width,
            overlayHostHeight: overlayHostTransform?.height,
        });
        fitPortraitSpriteToLogicalFrame(sprite);
        const carrierNode = sprite.node.parent;
        const carrierTransform = carrierNode?.getComponent(UITransform);
        const requestedCarrierShiftX = this._currentConfig?.profilePresentation?.portraitCarrierShiftX ?? 0;
        let appliedCarrierShiftX = 0;
        if (carrierNode && carrierTransform && overlayHostTransform) {
            const maxCarrierShiftX = Math.max(0, (overlayHostTransform.width - carrierTransform.width) * 0.5);
            appliedCarrierShiftX = Math.max(-maxCarrierShiftX, Math.min(maxCarrierShiftX, requestedCarrierShiftX));
            carrierNode.setPosition(appliedCarrierShiftX, carrierNode.position.y, carrierNode.position.z);
        }
        UCUFLogger.info(LogCategory.DATA, '[GeneralDetailComposite] portrait fit applied', {
            resourcePath: normalizedPath,
            overlayHostNode: portraitOverlayHost.name,
            carrierNode: carrierNode?.name ?? null,
            carrierWidth: carrierTransform?.width ?? null,
            carrierHeight: carrierTransform?.height ?? null,
            requestedCarrierShiftX,
            appliedCarrierShiftX,
            hostPositionX: node.position.x,
            hostWorldPositionX: node.worldPosition.x,
            carrierPositionX: carrierNode?.position.x ?? null,
            carrierWorldPositionX: carrierNode?.worldPosition.x ?? null,
            portraitNode: sprite.node.name,
            portraitScaleX: sprite.node.scale.x,
            portraitScaleY: sprite.node.scale.y,
            portraitPositionX: sprite.node.position.x,
            portraitPositionY: sprite.node.position.y,
            portraitWorldPositionX: sprite.node.worldPosition.x,
            portraitWorldPositionY: sprite.node.worldPosition.y,
            portraitSizeMode: sprite.sizeMode,
        });
        await applyPortraitSoftMask(sprite);
        this._syncPortraitVisibility();
        UCUFLogger.info(LogCategory.DATA, '[GeneralDetailComposite] loadPortrait complete', {
            resourcePath,
            nodeActive: node.active,
        });
    }

    private async _loadPortraitRarityBadge(tier: GeneralDetailRarityTier): Promise<void> {
        const resourcePath = PORTRAIT_RARITY_BADGE_PATHS[tier] ?? PORTRAIT_RARITY_BADGE_PATHS.legendary;
        if (this._currentPortraitRarityBadgeResource === resourcePath) {
            return;
        }

        const node = this._findPortraitRarityBadgeNode();
        if (!node) {
            const message = '[GeneralDetailComposite] 缺少必要節點 PortraitRarityBadge';
            UCUFLogger.error(LogCategory.LIFECYCLE, message);
            throw new Error(message);
        }
        const sprite = node.getComponent(Sprite) || node.addComponent(Sprite);
        const frame = await services().resource.loadSpriteFrame(resourcePath, { preferTextureFallback: true }).catch(() => null);
        if (!frame) {
            UCUFLogger.error(LogCategory.DATA, '[GeneralDetailComposite] 載入 PortraitRarityBadge spriteFrame 失敗', {
                resourcePath,
                tier,
            });
            return;
        }

        sprite.spriteFrame = frame;
        sprite.type = Sprite.Type.SIMPLE;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.color = Color.WHITE;
        this._currentPortraitRarityBadgeResource = resourcePath;
        UCUFLogger.info(LogCategory.DATA, '[GeneralDetailComposite] portrait rarity badge assigned', {
            resourcePath,
            tier,
            frameWidth: frame.width,
            frameHeight: frame.height,
        });
    }

    private _findPortraitRarityBadgeNode(): Node | null {
        const candidates = [
            'PortraitRarityBadge',
            'PortraitCarrier/PortraitRarityBadge',
        ];

        for (const path of candidates) {
            const node = this.node.getChildByPath(this._mainPath(path));
            if (node) {
                return node;
            }
        }

        return null;
    }

    /**
     * 切換 Overview 模式。
     * enabled=true 時顯示 OverviewSlot、隱藏 ContentSlot。
     * enabled=false 時還原，保持右側只有一組 tab + 一個內容容器。
     */
    private _setOverviewMode(enabled: boolean): void {
        UCUFLogger.info(LogCategory.LIFECYCLE, '[GeneralDetailComposite] _setOverviewMode', { enabled });

        const overviewSlot = this.getSlotNode('OverviewSlot');
        if (overviewSlot) {
            overviewSlot.active = enabled;
            const opacity = overviewSlot.getComponent(UIOpacity) || overviewSlot.addComponent(UIOpacity);
            opacity.opacity = enabled ? 255 : 0;
        }

        const contentSlot = this.getSlotNode('ContentSlot');
        if (contentSlot) {
            contentSlot.active = !enabled;
        }
    }

    /**
     * 依當前 tab 同步 PortraitImage 可見性。
     * Overview 模式下 portrait 顯示（OverviewSlot 的 fragment 處理右側資訊）。
     * Bloodline tab 隱藏 portrait（bloodline fragment 自帶完整佈局）。
     */
    private _syncPortraitVisibility(): void {
        const portrait = this.node.getChildByPath(this._mainPath('PortraitImage'));
        const visible = this._activeTab !== 'Bloodline';
        if (portrait) {
            portrait.active = visible;
        }

        const overlayHost = this._resolveMainRoot()?.getChildByName(PORTRAIT_ARTWORK_OVERLAY_HOST_NAME);
        if (portrait && overlayHost) {
            this._syncPortraitArtworkOverlayHost(portrait, overlayHost);
        }
        if (overlayHost) {
            overlayHost.active = visible;
        }
    }

    private _getOrCreatePortraitArtworkOverlayHost(hostNode: Node): Node {
        const parent = hostNode.parent;
        if (!parent) {
            return hostNode;
        }

        let overlayHost = parent.getChildByName(PORTRAIT_ARTWORK_OVERLAY_HOST_NAME);
        if (!overlayHost) {
            overlayHost = new Node(PORTRAIT_ARTWORK_OVERLAY_HOST_NAME);
            overlayHost.parent = parent;
        }

        this._syncPortraitArtworkOverlayHost(hostNode, overlayHost);
        return overlayHost;
    }

    private _syncPortraitArtworkOverlayHost(hostNode: Node, overlayHost: Node): void {
        const hostTransform = hostNode.getComponent(UITransform);
        const overlayTransform = overlayHost.getComponent(UITransform) || overlayHost.addComponent(UITransform);
        overlayTransform.setAnchorPoint(0.5, 0.5);
        if (hostTransform) {
            overlayTransform.setContentSize(hostTransform.contentSize.width, hostTransform.contentSize.height);
        }

        overlayHost.layer = hostNode.layer;
        overlayHost.setPosition(hostNode.position.x, hostNode.position.y, hostNode.position.z);
        overlayHost.active = hostNode.active;

        const parent = hostNode.parent;
        if (parent && overlayHost.parent !== parent) {
            overlayHost.parent = parent;
        }
        if (parent) {
            overlayHost.setSiblingIndex(Math.min(parent.children.length - 1, hostNode.getSiblingIndex() + 1));
        }
    }

    private _syncTabVisualState(): void {
        const activeLabelColor = this.skinResolver.resolveColor('#FFE088');
        const inactiveLabelColor = this.skinResolver.resolveColor('#B0A880');
        const activeEnLabelColor = this.skinResolver.resolveColor('#D0C5AF');
        const inactiveEnLabelColor = this.skinResolver.resolveColor('#6B6456');
        const activeSpriteColor = this.skinResolver.resolveColor('#FFFFFF');
        const inactiveSpriteColor = this.skinResolver.resolveColor('#4D4635');

        for (const tab of TAB_ORDER) {
            const isActive = tab === this._activeTab;
            const button = this._requireNode(`RightTabBar/BtnTab${tab}`);
            const opacity = button.getComponent(UIOpacity) || button.addComponent(UIOpacity);
            const label = button.getChildByName('Label')?.getComponent(Label);
            const enLabel = button.getChildByName('EnLabel')?.getComponent(Label);
            this.setButtonVisualState(button, isActive ? 'selected' : 'normal');
            button.setScale(isActive ? 1.06 : 1, isActive ? 1.06 : 1, 1);
            opacity.opacity = isActive ? 255 : 224;
            const sprite = button.getComponent(Sprite);
            if (sprite) {
                sprite.color = isActive ? activeSpriteColor : inactiveSpriteColor;
            }
            if (label) {
                label.color = isActive ? activeLabelColor : inactiveLabelColor;
            }
            if (enLabel) {
                enLabel.color = isActive ? activeEnLabelColor : inactiveEnLabelColor;
            }
        }
    }

    private _syncSpiritFamilyShortcut(): void {
        const shortcutRoot = this.node.getChildByPath(this._mainPath(SPIRIT_FAMILY_SHORTCUT_ROOT_PATH));
        if (!shortcutRoot) {
            return;
        }

        const spiritFamilyState = this._resolveSpiritFamilyState(this._currentConfig);
        const shouldShow = this._activeTab === 'Bloodline' && spiritFamilyState.hasFamilyBranch;
        shortcutRoot.active = shouldShow;
        if (!shouldShow) {
            return;
        }

        const hint = spiritFamilyState.activeBranchUid
            ? `已形成世家分支，可前往英靈陳列室管理（${spiritFamilyState.activeBranchUid}）。`
            : '已形成世家分支，可前往英靈陳列室管理。';
        this._setOptionalLabel(`${SPIRIT_FAMILY_SHORTCUT_ROOT_PATH}/SpiritFamilyHint`, hint);
        this._setOptionalLabel(
            `${SPIRIT_FAMILY_SHORTCUT_ROOT_PATH}/SpiritFamilyEntryButton/SpiritFamilyEntryLabel`,
            spiritFamilyState.entryLabel,
        );

        const buttonNode = this.node.getChildByPath(
            this._mainPath(`${SPIRIT_FAMILY_SHORTCUT_ROOT_PATH}/SpiritFamilyEntryButton`),
        );
        if (!buttonNode) {
            return;
        }

        const button = buttonNode.getComponent(Button) || buttonNode.addComponent(Button);
        button.node.off(Button.EventType.CLICK, this._onSpiritFamilyShortcutClick, this);
        button.node.on(Button.EventType.CLICK, this._onSpiritFamilyShortcutClick, this);
    }

    private _onSpiritFamilyShortcutClick(): void {
        const spiritFamilyState = this._resolveSpiritFamilyState(this._currentConfig);
        if (!spiritFamilyState.hasFamilyBranch) {
            return;
        }

        const payload: SpiritFamilyOverviewOpenPayload = {
            origin: 'general-detail',
            generalName: this._currentConfig?.name,
            branchUid: spiritFamilyState.activeBranchUid ?? undefined,
            entryLabel: spiritFamilyState.entryLabel,
        };
        void services().ui.open(UIID.SpiritFamilyOverview, payload);
    }

    private _resolveSpiritFamilyState(config: GeneralConfig | null): ResolvedSpiritFamilyState {
        const rawState = config?.spiritFamilyState;
        const activeBranchUid = rawState?.activeBranchUid?.trim() || '';
        return {
            hasFamilyBranch: rawState?.hasFamilyBranch ?? activeBranchUid.length > 0,
            activeBranchUid: activeBranchUid.length > 0 ? activeBranchUid : null,
            entryLabel: rawState?.entryLabel?.trim() || '查看世家',
        };
    }

    private _bindClick(path: string, handler: () => void): void {
        const node = this._requireNode(path);
        const button = node.getComponent(Button) || node.addComponent(Button);
        button.node.off(Button.EventType.CLICK);
        button.node.on(Button.EventType.CLICK, handler, this);
    }

    private _bindOptionalClick(path: string, handler: () => void): void {
        const fullPath = this._mainPath(path);
        const node = this.node.getChildByPath(fullPath);
        if (!node) {
            return;
        }

        const button = node.getComponent(Button) || node.addComponent(Button);
        button.node.off(Button.EventType.CLICK);
        button.node.on(Button.EventType.CLICK, handler, this);
    }

    private _setLabel(path: string, text: string): void {
        this._requireLabel(path).string = text;
    }

    private _setOptionalLabel(path: string, text: string): void {
        const label = this.node.getChildByPath(this._mainPath(path))?.getComponent(Label);
        if (label) {
            label.string = text;
        }
    }

    private _resolveMainRoot(): Node | null {
        const safeAreaRoot = this.node.getChildByPath('__safeArea/GeneralDetailRoot');
        if (safeAreaRoot) {
            return safeAreaRoot;
        }
        return this.node.getChildByName('GeneralDetailRoot');
    }

    private _mainPath(path: string): string {
        const rootPath = this._resolveMainRoot()?.parent?.name === '__safeArea'
            ? '__safeArea/GeneralDetailRoot'
            : 'GeneralDetailRoot';
        return `${rootPath}/${path}`;
    }

    private _requireNode(path: string): Node {
        const fullPath = this._mainPath(path);
        const node = this.node.getChildByPath(fullPath);
        if (!node) {
            UCUFLogger.error(LogCategory.LIFECYCLE, `[GeneralDetailComposite] 缺少必要節點 ${fullPath}`);
            throw new Error(`[GeneralDetailComposite] 缺少必要節點 ${fullPath}`);
        }
        return node;
    }

    private _requireLabel(path: string): Label {
        const fullPath = this._mainPath(path);
        const label = this._requireNode(path).getComponent(Label);
        if (!label) {
            UCUFLogger.error(LogCategory.LIFECYCLE, `[GeneralDetailComposite] 必要 Label 缺失 ${fullPath}`);
            throw new Error(`[GeneralDetailComposite] 必要 Label 缺失 ${fullPath}`);
        }
        return label;
    }

}
