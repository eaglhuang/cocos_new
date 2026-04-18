// @spec-source → 見 docs/cross-reference-index.md  (UCUF M2)
/**
 * CompositePanel
 *
 * UCUF M2 — 組合式面板抽象基底。
 * 繼承 UIPreviewBuilder，加入 lazySlot 延遲載入與 tabRouting 切換機制。
 *
 * 核心概念：
 *   - lazySlot   → 在 buildScreen 時留空的插槽容器，由 switchSlot() 按需填入 fragment
 *   - tabRouting → Screen JSON 宣告的 Tab→slot+fragment 映射，供 UI 層事件驅動
 *   - ChildPanel → 掛載在每個 slotId 上的資料/視覺子面板，由子類用 registerChildPanel() 登記
 *
 * 生命週期（完整版）：
 *   1. mount(screenId)          → loadFullScreen + buildScreen（填充 _lazySlots）
 *   2. _onLazySlotCreated(...)  → 被 _buildNode 回呼，記錄 LazySlotEntry
 *   3. onReady(binder)          → buildScreen 完成後，存 binder，載入 defaultFragments
 *   4. switchSlot(slotId, frag) → 清空子節點，載入 fragment，呼叫 ChildPanel.onMount
 *   5. applyContentState(state) → 將 state 分派給各 ChildPanel.onDataUpdate
 *   6. unmount()                → 呼叫 ChildPanel.onUnmount，清空節點與快取
 *
 * Unity 對照：ContentSwitcher + TabController + SubPanelManager 的組合
 */
import { Node, tween, UIOpacity, UITransform, Widget } from 'cc';
import { UIPreviewBuilder }   from './UIPreviewBuilder';
import { UITemplateBinder }   from './UITemplateBinder';
import { ChildPanelBase, PanelServices } from './ChildPanelBase';
import { UILayoutNodeSpec, TabRoute, TransitionDef } from './UISpecTypes';
import { services }           from '../../core/managers/ServiceLoader';
import type { ICompositeRenderer } from './interfaces/ICompositeRenderer';
import type { IScrollVirtualizer } from './interfaces/IScrollVirtualizer';
import { UCUFLogger, LogCategory } from './UCUFLogger';
import type { AssetRefType } from './AssetRegistryEntry';
import { UINodePool } from './UINodePool';
import { EventSystem } from '../../core/systems/EventSystem';

// ─── 內部型別 ─────────────────────────────────────────────────────────────────

/** 一個 lazySlot 節點的快取條目 */
export interface LazySlotEntry {
    /** 原始 spec（含 name / lazySlot / defaultFragment / childType） */
    spec:    UILayoutNodeSpec;
    /** Cocos 節點，已建立並掛載於父節點下；初始子節點為空 */
    node:    Node;
    /** 建立時父節點的有效寬（用於 _buildNode 的 parentWidth 參數） */
    parentW: number;
    /** 建立時父節點的有效高 */
    parentH: number;
    /** 目前已載入的 fragmentId（供 NodePool release 時鍵値用） */
    currentFragmentId?: string;
}

// ─── 主類別 ──────────────────────────────────────────────────────────────────

export abstract class CompositePanel extends UIPreviewBuilder {

    // ── 私有狀態 ────────────────────────────────────────────────────────────

    /** key = spec.name（即 slotId 識別名） */
    private readonly _lazySlots  = new Map<string, LazySlotEntry>();

    /** Fragment Node 物件池（M8）：避免反覆 destroy / _buildNode */
    private readonly _nodePool = new UINodePool();

    /**
     * 面板私有事件匯流排（M9）。
     * 使用獨立 instance 避免跨面板事件碰撞，子類可透過 onSlotEvent() 訂閱。
     * Unity 對照：Component 內部的 event Action<T> 欄位。
     */
    private readonly _eventBus = new EventSystem();

    /**
     * 此面板的記憶體 scope ID（M9）。
     * 格式：`screen:{screenId}`。mount() 時設定，dispose() 時用於批次釋放。
     */
    private _scopeId: string | null = null;

    /** key = slotId；由子類透過 registerChildPanel() 登記 */
    protected readonly childPanels = new Map<string, ChildPanelBase>();

    /**
     * 記錄 mount()/switchSlot() 過程中載入的 spec ID（screenId / fragmentId）。
     * dispose() 時用於觸發資源釋放並清空追蹤器。
     * Unity 對照：Addressables 的 LoadAssetAsync handle 清單。
     */
    private readonly _loadedAssetPaths = new Set<string>();

    // ── M3 Services（由子類或外部呼叫 setCompositeRenderer / setScrollVirtualizer 注入）──

    /** 引擎渲染橋（ICompositeRenderer）；注入後 registerChildPanel 會自動傳給 ChildPanel */
    protected _compositeRenderer: ICompositeRenderer | undefined = undefined;

    /** 虛擬捲動橋（IScrollVirtualizer）；注入後 registerChildPanel 會自動傳給 ScrollListPanel */
    protected _scrollVirtualizer: IScrollVirtualizer | undefined = undefined;

    /** 當前畫面的 tabRouting 表（來自 UIScreenSpec） */
    private _tabRouting: Record<string, TabRoute> | null = null;

    /** 最近一次 buildScreen 完成後由 onReady 存入的 binder */
    private _binder: UITemplateBinder | null = null;

    /** 正在 mount 的 screenId（供重建用） */
    private _screenId: string | null = null;

    /** M7: onLocaleChanged 取消訂閱函數 */
    private _unsubLocale: (() => void) | null = null;

    // ── 公開 API ─────────────────────────────────────────────────────────────

    /**
     * 掛載畫面：載入 Screen + Layout + Skin，建構節點樹，然後自動填入 defaultFragment。
     * @param screenId  Screen JSON 的 id（對應 ui-spec/screens/${screenId}.json）
     */
    async mount(screenId: string): Promise<void> {
        this._screenId = screenId;
        UCUFLogger.info(LogCategory.LIFECYCLE, '[CompositePanel] mount start', {
            panel: this.constructor.name,
            screenId,
        });
        // M9: scope auto-management — 建立 screen 專屬 scope，統一追蹤所有資源
        this._scopeId = `screen:${screenId}`;
        this._loadedAssetPaths.add(screenId);
        services().memory?.notifyLoaded(screenId, 'resources', 'json', this._scopeId);
        const [{ screen, layout, skin }, tokens] = await Promise.all([
            services().specLoader.loadFullScreen(screenId),
            services().specLoader.loadDesignTokens(),
        ]);
        this._tabRouting = screen.tabRouting ?? null;

        // buildScreen → _buildNode 過程中，lazySlot 節點會回呼 _onLazySlotCreated
        // 整棵樹建完後 onReady(binder) 被呼叫（已在下方覆寫）
        // M8：預載所有 skin slot 的 SpriteFrame（並行），避免 buildScreen 內逐一等待
        if (skin) {
            await this.skinResolver.preloadSlots(Object.keys(skin.slots));
        }

        // R29 runtime fix: canvas.safeAreaConstrained
        // 若 layout 宣告 safeAreaConstrained:true，表示此面板的 Widget 計算須以設計解析度為基準。
        // 問題根源：buildScreen 的 _postBuildPass 將所有 Widget 設為 AlignMode.ALWAYS，
        //           這使 TigerTallyRoot/ActionCommandRoot 等 Widget 每幀以實際 Canvas 寬
        //           （寬螢幕下 3063px）重新計算，把節點推到設計解析度範圍外。
        // 修復策略：buildScreen 完成後，找到宿主的第一個子節點（layout root），
        //           暫時將宿主 UITransform 設為 designWidth×designHeight，
        //           對整個子樹重跑一次 widget.updateAlignment()，
        //           然後把所有 Widget 設為 AlignMode.ONCE，使其不再因 ALWAYS 模式重算。
        const _safeAreaConstrained = layout.canvas?.safeAreaConstrained === true;
        const _safeDesignW = layout.canvas?.designWidth ?? 1920;
        const _safeDesignH = layout.canvas?.designHeight ?? 1080;
        UCUFLogger.info(LogCategory.LIFECYCLE, '[CompositePanel] mount safeArea flags', {
            panel: this.constructor.name,
            screenId,
            safeAreaConstrained: _safeAreaConstrained,
            designWidth: _safeDesignW,
            designHeight: _safeDesignH,
        });

        await this.buildScreen(layout, skin, undefined, tokens);

        // R29 post-build: 若 safeAreaConstrained，插入一個固定 designWidth×designHeight 的
        // 中介容器 (__safeArea)，使 layout root 子節點的 Widget 計算以設計解析度為基準。
        //
        // 問題根源：宿主（例如 TigerTallyPanel）有 Widget.left=0,right=0 撐到 Canvas 寬
        //           (FIXED_HEIGHT 模式下 1151px 視窗 → 3063px Canvas)，所有子節點 Widget
        //           以 3063px 計算，把設計解析度（1920px）左右邊的 UI 推到螢幕外。
        // 修復策略：在宿主與 layout root 之間插入一個 __safeArea 節點（UITransform=1920×1080，
        //           localPos=0,0，無 Widget），Widget 子節點以 1920px 對齊，永遠正確。
        //           宿主可繼續展寬至 3063px，不影響 __safeArea 的固定尺寸。
        if (_safeAreaConstrained) {
            const rootName = layout.root?.name;
            const rootChild = (rootName ? this.node.getChildByName(rootName) : null)
                ?? this.node.children[this.node.children.length - 1]
                ?? null;
            if (rootChild && rootChild.parent === this.node && rootChild.name !== '__safeArea') {
                const safeArea = new Node('__safeArea');
                safeArea.layer = this.node.layer;
                this.node.addChild(safeArea);                  // 先加入宿主
                const safeUT = safeArea.addComponent(UITransform);
                safeUT.setContentSize(_safeDesignW, _safeDesignH);
                safeArea.setPosition(0, 0, 0);                 // 掛於宿主中心（anchor=0.5,0.5）
                safeArea.addChild(rootChild);                  // 將 layout root 移入 __safeArea
                // 強制以 1920px parent 重跑一次 Widget 對齊
                const rootWidget = rootChild.getComponent(Widget);
                if (rootWidget) { rootWidget.updateAlignment(); }
                UCUFLogger.debug(LogCategory.LIFECYCLE,
                    `[CompositePanel] safeAreaConstrained: inserted __safeArea ${_safeDesignW}×${_safeDesignH} under "${this.node.name}", moved "${rootChild.name}" inside`);
            }
        }

        // 填入各 lazySlot 的 defaultFragment
        for (const [slotId, entry] of this._lazySlots) {
            if (entry.spec.defaultFragment) {
                await this.switchSlot(slotId, entry.spec.defaultFragment);
            }
        }

        UCUFLogger.info(LogCategory.LIFECYCLE, '[CompositePanel] mount complete', {
            panel: this.constructor.name,
            screenId,
            lazySlotCount: this._lazySlots.size,
            defaultFragments: [...this._lazySlots.entries()]
                .filter(([, entry]) => !!entry.spec.defaultFragment)
                .map(([slotId, entry]) => `${slotId}:${entry.spec.defaultFragment}`),
        });

        // M7: 訂閱語系切換事件 → 刷新所有已登記 ChildPanel 的靜態標籤
        const i18n = services().i18n;
        if (i18n) {
            // 取消前一次訂閱（防止 remount 重複）
            this._unsubLocale?.();
            this._unsubLocale = i18n.onLocaleChanged(() => {
                for (const [, panel] of this.childPanels) {
                    (panel as unknown as { _refreshLabels?: () => void })._refreshLabels?.();
                }
            });
        }
    }

    /**
     * 切換 lazySlot 內容：清空舊節點，載入指定 fragment，呼叫對應 ChildPanel.onMount()。
     * @param slotId     lazySlot 的 name（即 UILayoutNodeSpec.name）
     * @param fragmentId 要載入的 fragment layout id（路徑相對於 ui-spec/layouts/）
     * @param transition 可選過渡動畫定義（覆寫 tabRouting 中宣告的動畫）
     */
    async switchSlot(slotId: string, fragmentId: string, transition?: TransitionDef): Promise<void> {
        const entry = this._lazySlots.get(slotId);
        if (!entry) {
            console.warn(`[CompositePanel] switchSlot: slotId "${slotId}" 未找到，請確認 lazySlot spec.name`);
            return;
        }
        UCUFLogger.info(LogCategory.LIFECYCLE, '[CompositePanel] switchSlot start', {
            panel: this.constructor.name,
            slotId,
            fragmentId,
            currentFragmentId: entry.currentFragmentId ?? null,
            existingChildren: entry.node.children.length,
            hasRegisteredChildPanel: this.childPanels.has(slotId),
        });
        const _tSwitch = UCUFLogger.perfBegin(`CompositePanel.switchSlot:${slotId}`);

        const panel = this.childPanels.get(slotId);
        const isSameFragment = entry.currentFragmentId === fragmentId;
        if (isSameFragment && entry.node.children.length > 0) {
            const fragLayout = await services().specLoader.loadLayout(fragmentId);
            const fragmentRootNode = entry.node.children[entry.node.children.length - 1] ?? null;
            if (this._binder && fragmentRootNode) {
                this._binder.bindLazyFragment(fragmentRootNode, fragLayout.root);
            }
            this._refreshRenderableTree(entry.node);
            if (panel) {
                await panel.onMount(fragLayout.root as unknown as Record<string, unknown>);
            }
            UCUFLogger.info(LogCategory.LIFECYCLE, '[CompositePanel] switchSlot reused fragment', {
                panel: this.constructor.name,
                slotId,
                fragmentId,
                childCount: entry.node.children.length,
            });
            this._eventBus.emit('slot:switched', { slotId, fragmentId, reused: true });
            UCUFLogger.perfEnd(`CompositePanel.switchSlot:${slotId}`, _tSwitch);
            return;
        }

        // M9: exit 動畫（若有舊節點且有 transition）
        if (transition?.exit && transition.exit !== 'none' && entry.node.children.length > 0) {
            await this._runTransition(entry.node, transition.exit, transition.duration ?? 0.2);
        }

        // 將舊子節點歸還 NodePool（若有記錄 currentFragmentId）
        // Unity 對照：ObjectPool.Release(go) — 停用並回收節點，避免直接 Destroy
        if (entry.currentFragmentId) {
            const oldFragId = entry.currentFragmentId;
            const children = [...entry.node.children];
            for (const child of children) {
                this._nodePool.release(oldFragId, child);
            }
        } else {
            // 尚無 fragmentId 記錄（首次載入），直接銷毀
            this._destroySlotChildrenSafely(entry.node);
        }
        entry.currentFragmentId = fragmentId;

        // 嘗試從 NodePool 取出可重用節點
        // Unity 對照：ObjectPool.Get() — 取出停用節點重新啟用
        const pooledNode = this._nodePool.acquire(fragmentId);

        // 載入 fragment layout（自動處理 $ref + 快取）
        this._loadedAssetPaths.add(fragmentId);
        // M9: 同步到 scope，讓 releaseByScope 能統一清理
        if (this._scopeId) {
            services().memory?.notifyLoaded(fragmentId, 'resources', 'json', this._scopeId);
        }
        const fragLayout = await services().specLoader.loadLayout(fragmentId);

        if (pooledNode) {
            // 命中 Pool：直接重新掛載，跳過 _buildNode 重建
            entry.node.addChild(pooledNode);
        } else {
            // 未命中 Pool：遞迴建構 fragment 節點樹
            await this._buildNode(fragLayout.root, entry.node, entry.parentW, entry.parentH);
        }

        // Fragment 節點的 Widget 在 _buildNode 中僅設定參數、不呼叫 updateAlignment()，
        // 必須補跑 _postBuildPass 讓 Widget 對齊 + Layout 重算，否則子節點尺寸/位置不正確。
        // Unity 對照：Instantiate prefab 後呼叫 Canvas.ForceUpdateCanvases()
        this._postBuildPass(entry.node);
        this._refreshRenderableTree(entry.node);

        // lazy fragment 是在 buildScreen 之後才動態掛進 slot；
        // 若不補建 path 索引，ChildPanel 的 content binder 會找不到 HeaderRow/... 這類節點。
        const fragmentRootNode = entry.node.children[entry.node.children.length - 1] ?? null;
        if (this._binder && fragmentRootNode) {
            this._binder.bindLazyFragment(fragmentRootNode, fragLayout.root);
        }

        // M9: enter 動畫（若有 transition）
        if (transition?.enter && transition.enter !== 'none') {
            await this._runTransition(entry.node, transition.enter, transition.duration ?? 0.2);
        }

        // 通知對應 ChildPanel（若已登記）
        if (panel) {
            await panel.onMount(fragLayout.root as unknown as Record<string, unknown>);
        }

        UCUFLogger.info(LogCategory.LIFECYCLE, '[CompositePanel] switchSlot complete', {
            panel: this.constructor.name,
            slotId,
            fragmentId,
            childCount: entry.node.children.length,
            pooledReuse: !!pooledNode,
            childPanelType: panel?.constructor.name ?? null,
        });

        // M9: 事件匯流排通知 slot 切換完成
        this._eventBus.emit('slot:switched', { slotId, fragmentId });

        UCUFLogger.perfEnd(`CompositePanel.switchSlot:${slotId}`, _tSwitch);
    }

    /**
     * 透過 tabRouting 表切換 Tab，自動呼叫 switchSlot。
     * @param tabKey  TabRoute 的 key 名（與 tabRouting 的 key 對應）
     */
    async switchTab(tabKey: string): Promise<void> {
        if (!this._tabRouting) {
            console.warn(`[CompositePanel] switchTab: 此 CompositePanel 尚未設定 tabRouting`);
            return;
        }
        const route = this._tabRouting[tabKey];
        if (!route) {
            console.warn(`[CompositePanel] switchTab: tabKey "${tabKey}" 在 tabRouting 中不存在`);
            return;
        }
        UCUFLogger.info(LogCategory.LIFECYCLE, '[CompositePanel] switchTab', {
            panel: this.constructor.name,
            tabKey,
            slotId: route.slotId,
            fragment: route.fragment,
        });
        // M9: 將 tabRouting 上宣告的 transition 傳入 switchSlot
        await this.switchSlot(route.slotId, route.fragment, route.transition);
    }

    /**
     * 將資料狀態分派給所有已登記的 ChildPanel。
     * M9: 使用淺比對（_shallowDiff）跳過無變化的 panel，減少不必要更新。
     * @param state  key=dataSource, value=對應資料；缺少某個 key 時跳過對應 panel
     */
    applyContentState(state: Record<string, unknown>): void {
        const _tContent = UCUFLogger.perfBegin('CompositePanel.applyContentState');
        for (const [, panel] of this.childPanels) {
            const data = state[panel.dataSource];
            UCUFLogger.info(LogCategory.LIFECYCLE, '[CompositePanel] applyContentState evaluating panel', {
                panel: panel.constructor.name,
                dataSource: panel.dataSource,
            });
            if (data !== undefined) {
                // M9: diff-update — 淺比對，若無變化跳過
                const changedKeys = panel._shallowDiff(panel._lastData, data);
                if (panel._lastData !== null && changedKeys.length === 0) {
                    // 資料未變化，跳過更新
                    UCUFLogger.info(LogCategory.LIFECYCLE, '[CompositePanel] applyContentState skip panel (no changes)', {
                        panel: panel.constructor.name,
                        dataSource: panel.dataSource,
                    });
                    continue;
                }
                UCUFLogger.info(LogCategory.LIFECYCLE, '[CompositePanel] applyContentState dispatching update to panel', {
                    panel: panel.constructor.name,
                    dataSource: panel.dataSource,
                    changedKeys,
                });
                panel._lastData = data;
                panel.onDiffUpdate(data, changedKeys);
                UCUFLogger.info(LogCategory.LIFECYCLE, '[CompositePanel] applyContentState panel updated', {
                    panel: panel.constructor.name,
                    dataSource: panel.dataSource,
                    changedKeys,
                });
            }
        }
        UCUFLogger.perfEnd('CompositePanel.applyContentState', _tContent);
        // M9: 事件匯流排通知資料更新完成
        this._eventBus.emit('content:updated', { sources: Object.keys(state) });
    }

    /**
     * 訂閱面板事件匯流排（M9）。
     * 支援事件：`'slot:switched'` / `'content:updated'`
     * @returns 取消訂閱函數
     */
    onSlotEvent<T = unknown>(event: string, handler: (payload?: T) => void): () => void {
        return this._eventBus.on(event, handler);
    }

    /**
     * 卸載：通知所有 ChildPanel，清空節點，重設內部快取。
     * 呼叫後可再次呼叫 mount() 重建。
     */
    unmount(): void {
        // M7: 取消語系切換訂閱
        this._unsubLocale?.();
        this._unsubLocale = null;

        // 通知各 ChildPanel
        for (const [, panel] of this.childPanels) {
            panel.onUnmount();
        }
        // 清空 slot 節點的子節點
        for (const [, entry] of this._lazySlots) {
            this._destroySlotChildrenSafely(entry.node);
        }
        this._lazySlots.clear();
        this._nodePool.clear();
        this.childPanels.clear();
        this._binder     = null;
        this._tabRouting = null;
    }

    /**
     * 完整釋放：呼叫 unmount() 清理節點，並釋放已追蹤的載入資源。
     * 場景切換時由 UIManager.onSceneWillChange() 自動呼叫。
     *
     * Unity 對照：AddressableAssets.Release() + DestroyImmediate(gameObject)
     */
    dispose(): void {
        UCUFLogger.info(LogCategory.LIFECYCLE, `[CompositePanel] dispose: screenId="${this._screenId ?? '?'}"`);
        this.unmount();

        // M9: scope auto-management — 一鍵釋放該 screen 的所有資源
        if (this._scopeId) {
            try {
                services().memory?.releaseByScope(this._scopeId);
            } catch {
                // 釋放失敗不影響主流程
            }
            this._scopeId = null;
        } else {
            // fallback：逐一釋放（向後相容，無 scope 時）
            for (const path of this._loadedAssetPaths) {
                try {
                    services().resource.releaseByTag?.(path);
                } catch {
                    // 靜默忽略
                }
            }
        }
        this._loadedAssetPaths.clear();
    }

    /**
     * 取得已追蹤的載入資源路徑數量（供測試斷言使用）。
     * production 代碼不應依賴此方法。
     */
    get loadedAssetPathCount(): number {
        return this._loadedAssetPaths.size;
    }

    /**
     * 取得此面板的 scope ID（M9，供測試斷言使用）。
     * production 代碼不應直接依賴此方法。
     */
    get scopeId(): string | null {
        return this._scopeId;
    }

    // ── 私有工具 ─────────────────────────────────────────────────────────────

    /**
     * 執行節點的過渡動畫（M9）。
     * 支援 'fadeIn' / 'fadeOut' / 'none'；其餘值以 fadeIn 近似。
     * 透過 UIOpacity component 控制透明度；若節點無此 component 則即時切換。
     *
     * Unity 對照：CanvasGroup.alpha 淡入淡出 coroutine。
     */
    private _runTransition(node: Node, type: string, duration: number): Promise<void> {
        return new Promise<void>((resolve) => {
            if (type === 'none' || duration <= 0) { resolve(); return; }
            let opacity = node.getComponent(UIOpacity);
            if (!opacity) { opacity = node.addComponent(UIOpacity); }
            const isFadeIn = type === 'fadeIn';
            opacity.opacity = isFadeIn ? 0 : 255;
            tween(opacity)
                .to(duration, { opacity: isFadeIn ? 255 : 0 })
                .call(() => resolve())
                .start();
        });
    }

    private _destroySlotChildrenSafely(node: Node): void {
        const internalNode = node as Node & { _children?: Node[] | null; isValid?: boolean };
        if (!internalNode?.isValid) {
            return;
        }

        if (!Array.isArray(internalNode._children) || internalNode._children.length === 0) {
            return;
        }

        try {
            node.destroyAllChildren();
        } catch (error) {
            UCUFLogger.warn(LogCategory.LIFECYCLE, '[CompositePanel] destroyAllChildren skipped during teardown', {
                nodeName: node.name,
                error: String(error),
            });
        }
    }

    private _refreshRenderableTree(node: Node): void {
        const visit = (current: Node): void => {
            for (const component of current.components) {
                const renderable = component as {
                    markForUpdateRenderData?: (enable?: boolean) => void;
                    updateRenderData?: (force?: boolean) => void;
                };
                renderable.markForUpdateRenderData?.(true);
                renderable.updateRenderData?.(true);
            }

            for (const child of current.children) {
                visit(child);
            }
        };

        visit(node);
    }

    // ── 子類工具 ─────────────────────────────────────────────────────────────

    /**
     * 注入引擎渲染橋（ICompositeRenderer）。
     * 應在 mount() 前呼叫（通常在子類建構子或場景初始化時）。
     */
    setCompositeRenderer(renderer: ICompositeRenderer): void {
        this._compositeRenderer = renderer;
    }

    /**
     * 注入虛擬捲動橋（IScrollVirtualizer）。
     * 應在 mount() 前呼叫（通常在子類建構子或場景初始化時）。
     */
    setScrollVirtualizer(virtualizer: IScrollVirtualizer): void {
        this._scrollVirtualizer = virtualizer;
    }

    /**
     * 登記一個 ChildPanel，讓 switchSlot / applyContentState 能自動驅動它。
     * M3 新增：自動將 _compositeRenderer / _scrollVirtualizer 注入 ChildPanel.setServices()。
     * 通常在 _onAfterBuildReady() 或 onReady() 中呼叫。
     */
    protected registerChildPanel(slotId: string, panel: ChildPanelBase): void {
        this.childPanels.set(slotId, panel);
        const svc: PanelServices = {};
        if (this._compositeRenderer)  svc.renderer    = this._compositeRenderer;
        if (this._scrollVirtualizer)  svc.virtualizer = this._scrollVirtualizer;
        // M7: 注入 I18nSystem
        const i18n = services().i18n;
        if (i18n) svc.i18n = i18n;
        panel.setServices(svc);

        // M6：注入動態資源登記 callback
        panel.setDynamicAssetCallback((path: string, _assetType: AssetRefType) => {
            this._loadedAssetPaths.add(path);
        });
    }

    /**
     * 取得已登記的 ChildPanel（型別化版本）。
     * 子類可用: `const p = this.getChildPanel<AttributePanel>('AttrSlot');`
     */
    protected getChildPanel<T extends ChildPanelBase>(slotId: string): T | undefined {
        return this.childPanels.get(slotId) as T | undefined;
    }

    /**
     * 取得 lazySlot 對應的 Cocos Node（供子類手動操作）。
     * 若 slot 尚未建立則回傳 undefined。
     */
    protected getSlotNode(slotId: string): Node | undefined {
        return this._lazySlots.get(slotId)?.node;
    }

    /**
     * 更新 lazySlot 記錄的父容器尺寸（parentW / parentH）。
     * 當子類在 mount 完成後動態改變容器 Widget（例如 Overview 全螢幕擴展），
     * 必須呼叫此方法更新記錄，否則後續 switchSlot 的 _buildNode
     * 仍會使用初始（較小的）容器尺寸來計算子節點佈局。
     */
    protected updateSlotParentSize(slotId: string, newW: number, newH: number): void {
        const entry = this._lazySlots.get(slotId);
        if (entry) {
            entry.parentW = newW;
            entry.parentH = newH;
        }
    }

    /**
     * 取得當前 tabRouting 表（唯讀）。
     */
    protected get tabRouting(): Readonly<Record<string, TabRoute>> | null {
        return this._tabRouting;
    }

    /**
     * 子類應覆寫此鉤子而非 onReady()，以避免破壞 binder 存儲邏輯。
     * 對應 UIPreviewBuilder.onReady() 的功能，但在 binder 已存入 _binder 後才呼叫。
     * Unity 對照：MonoBehaviour.Start()
     */
    protected _onAfterBuildReady(_binder: UITemplateBinder): void { /* 子類覆寫 */ }

    // ── UIPreviewBuilder 覆寫 ─────────────────────────────────────────────────

    /**
     * 攔截 buildScreen 後的 onReady 鉤子：存 binder，供後續 slot 操作使用。
     * 子類不應再覆寫 onReady，請改用 _onAfterBuildReady()。
     */
    protected override onReady(binder: UITemplateBinder): void {
        this._binder = binder;
        this._onAfterBuildReady(binder);
    }

    /**
     * lazySlot 節點建立時的回呼：記錄到 _lazySlots 供後續 switchSlot 使用。
     * Unity 對照：EditorWindow 的 OnEnable() 中登記 slot 容器。
     */
    protected override _onLazySlotCreated(
        spec:    UILayoutNodeSpec,
        node:    Node,
        w:       number,
        h:       number,
    ): void {
        this._lazySlots.set(spec.name, { spec, node, parentW: w, parentH: h });
    }
}
