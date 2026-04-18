import { _decorator, Button, Color, Label, Node, Sprite, UIOpacity } from 'cc';
import { CompositePanel } from '../core/CompositePanel';
import type { UITemplateBinder } from '../core/UITemplateBinder';
import type { ChildPanelBase } from '../core/ChildPanelBase';
import type { GeneralConfig, GeneralDetailDefaultTab } from '../../core/models/GeneralUnit';
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
import { GeneralDetailExtendedChild } from './general-detail/GeneralDetailExtendedChild';
import { UCUFLogger, LogCategory } from '../core/UCUFLogger';

const { ccclass } = _decorator;

type TabKey = 'Overview' | 'Basics' | 'Stats' | 'Bloodline' | 'Skills' | 'Aptitude' | 'Extended';
type UnifiedOverviewContentState = Omit<GeneralDetailOverviewContentState, 'portraitModeHint'>;

const TAB_ORDER: TabKey[] = ['Overview', 'Basics', 'Stats', 'Bloodline', 'Skills', 'Aptitude', 'Extended'];

@ccclass('GeneralDetailComposite')
export class GeneralDetailComposite extends CompositePanel {
    private _isMounted = false;
    private _activeTab: TabKey = 'Overview';
    private _currentConfig: GeneralConfig | null = null;
    private _currentBackgroundResource: string | null = null;
    private _gdBinder: UITemplateBinder | null = null;

    protected override _onAfterBuildReady(binder: UITemplateBinder): void {
        this._gdBinder = binder;
        this._bindStaticEvents();
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
            await this.mount('general-detail-unified-screen');
            this._isMounted = true;
            UCUFLogger.info(LogCategory.LIFECYCLE, '[GeneralDetailComposite] mount completed', {
                childCount: this.node.children.length,
            });
        }
        this._currentConfig = config;
        this._currentBackgroundResource = null;
        const overview = this._buildUnifiedOverviewState(config);
        await this._loadBackground(overview.backgroundResource);
        const entryTab = this._resolveEntryTab(config);
        UCUFLogger.info(LogCategory.LIFECYCLE, '[GeneralDetailComposite] resolved entry tab', {
            generalId: config.id,
            entryTab,
        });
        await this._switchToTab(entryTab);

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
        this._bindOptionalClick('RightTabBar/BtnClose', () => this.hide());
        this._bindOptionalClick('TopCloseBtn', () => this.hide());
        this._bindClick('ClickBlocker', () => this.hide());

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
            return child;
        }
        case 'Basics':
            return new GeneralDetailBasicsChild(slotNode, this.skinResolver, binder);
        case 'Stats':
            return new GeneralDetailStatsChild(slotNode, this.skinResolver, binder);
        case 'Bloodline':
            return new GeneralDetailBloodlineChild(slotNode, this.skinResolver, binder);
        case 'Skills':
            return new GeneralDetailSkillsChild(slotNode, this.skinResolver, binder);
        case 'Aptitude':
            return new GeneralDetailAptitudeChild(slotNode, this.skinResolver, binder);
        case 'Extended':
            return new GeneralDetailExtendedChild(slotNode, this.skinResolver, binder);
        }
    }

    private _resolveEntryTab(config: GeneralConfig): TabKey {
        const preferredTab = config.profilePresentation?.defaultTab as GeneralDetailDefaultTab | undefined;
        if (preferredTab && TAB_ORDER.includes(preferredTab as TabKey)) {
            return preferredTab as TabKey;
        }
        return 'Overview';
    }

    private _buildUnifiedOverviewState(config: GeneralConfig): UnifiedOverviewContentState {
        const { portraitModeHint: _portraitModeHint, ...overview } = buildGeneralDetailOverviewContentState(config);
        return overview;
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
    }

    private _applyOverviewChrome(state: UnifiedOverviewContentState): void {
        void this._loadBackground(state.backgroundResource);
        void this._loadPortrait(state.portraitResource);

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
        const frame = await services().resource.loadSpriteFrame(normalizedPath).catch(() => null);
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
        UCUFLogger.info(LogCategory.DATA, '[GeneralDetailComposite] loadPortrait start', {
            resourcePath,
        });
        const node = this._requireNode('PortraitImage');

        const sprite = node.getComponent(Sprite) || node.addComponent(Sprite);
        const frame = await services().resource.loadSpriteFrame(resourcePath).catch(() => null);
        if (!frame) {
            UCUFLogger.error(LogCategory.DATA,
                `[GeneralDetailComposite] 載入 PortraitImage spriteFrame 失敗: ${resourcePath}`);
            return;
        }

        sprite.spriteFrame = frame;
        sprite.type = Sprite.Type.SIMPLE;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.color = Color.WHITE;
        this._syncPortraitVisibility();
        UCUFLogger.info(LogCategory.DATA, '[GeneralDetailComposite] loadPortrait complete', {
            resourcePath,
            nodeActive: node.active,
        });
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
        if (!portrait) return;
        portrait.active = this._activeTab !== 'Bloodline';
    }

    private _syncTabVisualState(): void {
        for (const tab of TAB_ORDER) {
            const isActive = tab === this._activeTab;
            const iconActive = this._requireNode(`RightTabBar/BtnTab${tab}/IconActive`);
            const iconInactive = this._requireNode(`RightTabBar/BtnTab${tab}/IconInactive`);
            if (iconActive) iconActive.active = isActive;
            if (iconInactive) iconInactive.active = !isActive;
        }
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