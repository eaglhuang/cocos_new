// @spec-source → 見 docs/cross-reference-index.md
/**
 * UIManager.ts — 六層式 UI 管理器（M-1 分層架構 + M-2 快取協定）
 *
 * M-2 快取機制說明：
 *   UIConfig[uiId].cache = true 的面板（目前：ResultPopup）close 時標記為「已快取」。
 *   下次 open 時先呼叫 UILayer.resetState() 清除殘留資料，再重新顯示。
 *   這避免了頻繁 instantiate/destroy 造成的 GC 壓力。
 *
 *   對照 Unity ObjectPool：
 *     close  ≈ pool.Release(obj)   → 節點回池（deactivate + 標記快取）
 *     open   ≈ pool.Get()          → 取出物件 + OnSpawn() 重置狀態
 *
 * 統一管理所有 UI 頁面的開啟 / 關閉行為，依 LayerType 實施不同的語義：
 *
 * | 層級    | 行為模式 | Unity 對照               |
 * |---------|----------|--------------------------|
 * | Game    | 獨立顯示 | World Space Canvas        |
 * | UI      | 替換式   | 全螢幕主頁面互斥          |
 * | PopUp   | 堆疊式   | 多個同時疊加              |
 * | Dialog  | 佇列式   | 一次一個 + 遮罩，後者排隊 |
 * | System  | 覆蓋式   | 最高優先，不等候           |
 * | Notify  | 浮動式   | Toast / Loading           |
 *
 * 使用方式：
 *   1. 將場景中的 UILayer 元件 `register(UIID.BattleHUD, hudComponent)`
 *   2. 呼叫 `open(UIID.BattleHUD)` 依層級語義顯示
 *   3. 呼叫 `close(UIID.ResultPopup)` 關閉並自動推進 Dialog 佇列
 *
 * 參考來源：dgflash/oops-framework LayerManager
 */

import { Button, Color, instantiate, Node, UIOpacity, UITransform, Widget } from "cc";
import { SolidBackground } from "../../ui/components/SolidBackground";
import { UILayer } from "../../ui/layers/UILayer";
import { UIBackdropConfig, UIID, UIConfig, LayerType } from "../config/UIConfig";
import { services } from "./ServiceLoader";
import type { CompositePanel } from "../../ui/core/CompositePanel";

export interface UIManagedController {
    readonly node: Node;
    show(payload?: unknown): void | Promise<void>;
    hide(): void | Promise<void>;
    resetState?(): void;
}

// ─── 內部紀錄結構 ─────────────────────────────────────────────────────────────
interface UIEntry {
    readonly uiId: UIID;
    controller: UIManagedController;
    isOpen: boolean;
    /** 是否曾以快取模式關閉——下次 open 需先呼叫 resetState()（M-2） */
    wasCached: boolean;
}

const DEFAULT_UI_BACKDROP: Required<UIBackdropConfig> = {
    enabled: true,
    opacity: 180,
    blocksInput: true,
    closeOnTap: false,
};

export class UIManager {
    // 統一頁面登記表
    private readonly registry = new Map<UIID, UIEntry>();

    // LayerUI：目前顯示的替換式主頁面（同時只有一個）
    private currentUI: UIID | null = null;
    private readonly uiHistory: UIID[] = [];
    private _uiBackdropNode: Node | null = null;
    private _uiBackdropCloseOnTap = false;

    // LayerPopUp：堆疊式彈窗（可多個共存，LIFO 順序）
    private readonly popupStack: UIID[] = [];

    // LayerDialog：佇列式對話框
    private readonly dialogQueue: UIID[] = [];
    private activeDialog: UIID | null = null;

    /**
     * CompositePanel 登記表（M5），供場景切換時逐一 dispose。
     * key = 任意字串標識符（對應 screenId 或場景自定義的 id）
     */
    private readonly _compositePanels = new Map<string, CompositePanel>();

    /**
     * 各層級的父節點容器（供 openAsync 動態實例化時掛載子節點）。
     * 透過 setupLayers() 注入，由場景初始化時設定。
     * 對照 Unity：類似 Canvas 下各 Sort Order 分組的 GameObject。
     */
    private readonly layerContainers = new Map<LayerType, Node>();

    // ─── 公開 API ──────────────────────────────────────────────────────────────

    /**
     * 將場景中的 UILayer 元件綁定到指定 UIID。
     * 必須在呼叫 open/close 之前完成（通常在 BattleScene.start() 或對應 View 的 onLoad 中執行）。
     */
    public register(uiId: UIID, layerOrController: UILayer | UIManagedController): void {
        const controller = layerOrController instanceof UILayer
            ? this._createLayerController(layerOrController)
            : layerOrController;
        this.registry.set(uiId, { uiId, controller, isOpen: false, wasCached: false });
    }

    /**
     * 設定各層級的父節點容器，供 openAsync 動態實例化 Prefab 時掛載子節點。
     * 通常在 LobbyScene / BattleScene 的 onLoad 中呼叫一次。
     *
     * 對照 Unity：類似在 Canvas 下為每個 Sort Order 分層建立一個 GameObject 作為容器。
     *
     * @param containers 層級類型 → 對應 Node 的鍵值對，不需要設定所有層級
     */
    public setupLayers(containers: Partial<Record<LayerType, Node>>): void {
        for (const key of Object.keys(containers) as LayerType[]) {
            const node = containers[key];
            if (node) {
                this.layerContainers.set(key, node);
            }
        }
    }

    /**
     * 非同步開啟指定 UI。
     *
     * - 若 UIID 已透過 register() 登錄，直接呼叫 open()（同步路徑，無載入延遲）。
     * - 若尚未登錄但 UIConfig[uiId].prefab 存在，自動:
     *   1. 從 ResourceManager 載入 Prefab
     *   2. instantiate 節點
     *   3. 掛到對應層級的容器節點（若 setupLayers 已設定）
     *   4. 取得 UILayer 元件並 register
     *   5. 呼叫 open()
     *
     * 對照 Unity：類似 Addressables.InstantiateAsync + 取得 UI Component 後顯示的流程。
     *
     * @returns 成功開啟回傳 true；prefab 路徑不存在或載入失敗回傳 false
     */
    public async openAsync(uiId: UIID, payload?: unknown): Promise<boolean> {
        // 已登錄 → 直接走同步路徑
        if (this.registry.has(uiId)) {
            return this.open(uiId, payload);
        }

        const cfg = UIConfig[uiId];
        if (!cfg.prefab) {
            console.warn(`[UIManager] openAsync: "${uiId}" 未 register 且無 prefab 路徑，無法開啟`);
            return false;
        }

        let prefab;
        try {
            prefab = await services().resource.loadPrefab(cfg.prefab);
        } catch (e) {
            console.error(`[UIManager] openAsync: "${uiId}" prefab 載入失敗 (${cfg.prefab}):`, e);
            return false;
        }

        const node = instantiate(prefab);

        // 掛到層級容器（若場景已透過 setupLayers 提供）
        const container = this.layerContainers.get(cfg.layer);
        if (container) {
            container.addChild(node);
        } else {
            console.warn(`[UIManager] openAsync: "${uiId}" 無層級容器 (${cfg.layer})，節點未掛載場景，請確認 setupLayers() 已呼叫`);
        }

        const layer = node.getComponent(UILayer);
        if (!layer) {
            console.error(`[UIManager] openAsync: "${uiId}" 的 Prefab 缺少 UILayer 元件，請確認根節點掛有 UILayer（或其子類）`);
            node.destroy();
            return false;
        }

        this.register(uiId, layer);
        return this.open(uiId, payload);
    }

    /**
     * 開啟指定 UI，行為依 UIConfig[uiId].layer 的層級語義決定。
     * 若該 UI 之前以快取模式關閉，先呼叫 resetState() 清除殘留資料（M-2）。
     * @returns 若未 register 則回傳 false
     */
    public async open(uiId: UIID, payload?: unknown): Promise<boolean> {
        const entry = this.registry.get(uiId);
        if (!entry) {
            console.warn(`[UIManager] open: "${uiId}" not registered`);
            return false;
        }

        const cfg = UIConfig[uiId];
        switch (cfg.layer) {
            case LayerType.Game:
            case LayerType.System:
            case LayerType.Notify:
                await this._showEntry(entry, payload);
                break;
            case LayerType.UI:
                await this._openReplace(uiId, entry, payload);
                break;
            case LayerType.PopUp:
                await this._openStack(uiId, entry, payload);
                break;
            case LayerType.Dialog:
                await this._openQueue(uiId, entry, payload);
                break;
        }
        this._syncUIBackdrop();
        return true;
    }

    /**
     * 關閉指定 UI，行為依層級語義決定。
     * Dialog 關閉後會自動推進佇列中的下一個對話框。
     * @returns 若未 register 或已關閉則回傳 false
     */
    public async close(uiId: UIID): Promise<boolean> {
        const entry = this.registry.get(uiId);
        if (!entry || !entry.isOpen) { return false; }

        const cfg = UIConfig[uiId];
        switch (cfg.layer) {
            case LayerType.Game:
            case LayerType.System:
            case LayerType.Notify:
                await this._hideEntry(entry, cfg.cache);
                break;
            case LayerType.UI:
                await this._closeReplace(uiId, entry);
                break;
            case LayerType.PopUp:
                await this._closeStack(uiId, entry);
                break;
            case LayerType.Dialog:
                await this._closeQueue(uiId, entry);
                break;
        }
        this._syncUIBackdrop();
        return true;
    }

    public async closeCurrentUI(): Promise<boolean> {
        const targetUiId = this._getTopClosableUI();
        if (!targetUiId) {
            return false;
        }
        return this.close(targetUiId);
    }

    public async goBack(): Promise<boolean> {
        return this.closeCurrentUI();
    }

    /** 查詢指定 UI 是否目前處於開啟狀態 */
    public isOpen(uiId: UIID): boolean {
        return this.registry.get(uiId)?.isOpen ?? false;
    }

    /** 查詢指定 UI 是否目前處於快取狀態（已關閉但未 destroy，等待重新 open） */
    public isCached(uiId: UIID): boolean {
        return this.registry.get(uiId)?.wasCached ?? false;
    }

    /** 取得目前 LayerUI 顯示的替換式頁面 ID（若無則回傳 null） */
    public getCurrentUI(): UIID | null {
        return this.currentUI;
    }

    /** 取得 LayerPopUp 目前堆疊頂端的彈窗 ID（若無則回傳 null） */
    public peekPopup(): UIID | null {
        return this.popupStack.length > 0
            ? this.popupStack[this.popupStack.length - 1]
            : null;
    }

    /** 取得 LayerPopUp 目前堆疊深度 */
    public getPopupDepth(): number {
        return this.popupStack.length;
    }

    /** 取得 LayerDialog 佇列中等待的對話框數量（不含正在顯示的） */
    public getDialogQueueLength(): number {
        return this.dialogQueue.length;
    }

    /** 清除指定 UI 的快取標記（強制下次 open 不呼叫 resetState）。
     * 若未傳入 uiId，清除所有快取標記。
     */
    public clearCache(uiId?: UIID): void {
        if (uiId !== undefined) {
            const entry = this.registry.get(uiId);
            if (entry) { entry.wasCached = false; }
        } else {
            this.registry.forEach(e => { e.wasCached = false; });
        }
    }

    /** 關閉所有已開啟的 UI 並重置所有狀態 */
    public async closeAll(): Promise<void> {
        for (const entry of this.registry.values()) {
            if (entry.isOpen) {
                await this._hideEntry(entry, false);
            }
        }
        this.currentUI = null;
        this.uiHistory.length = 0;
        this.popupStack.length = 0;
        this.dialogQueue.length = 0;
        this.activeDialog = null;
        this._syncUIBackdrop();
    }

    // ─── CompositePanel 管理（M5） ──────────────────────────────────────────────

    /**
     * 登記一個 CompositePanel，後續場景切換時會自動呼叫 dispose。
     * 应在 CompositePanel.mount() 完成後由場景呼叫。
     *
     * Unity 對照：將 Component 登記到集中化的 SubsystemManager。
     */
    public registerCompositePanel(id: string, panel: CompositePanel): void {
        this._compositePanels.set(id, panel);
    }

    /**
     * 取消登記一個 CompositePanel（由場景主動取消，如 dispose 後）。
     */
    public unregisterCompositePanel(id: string): void {
        this._compositePanels.delete(id);
    }

    /**
     * 場景即將切換時呼叫：對所有已登記的 CompositePanel 呼叫 dispose()。
     * 應由 SceneManager.onSceneWillChange()（或對應場景的 onDestroy）呼叫。
     *
     * Unity 對照：SceneManager.sceneUnloaded 事件觸發的清理流程。
     */
    public onSceneWillChange(): void {
        for (const [id, panel] of this._compositePanels) {
            try {
                panel.dispose();
            } catch (e) {
                console.warn(`[UIManager] onSceneWillChange: panel "${id}" dispose 失敗:`, e);
            }
        }
        this._compositePanels.clear();
        this.currentUI = null;
        this.uiHistory.length = 0;
        this.popupStack.length = 0;
        this.dialogQueue.length = 0;
        this.activeDialog = null;
        if (this._uiBackdropNode) {
            this._uiBackdropNode.active = false;
        }
        this._uiBackdropCloseOnTap = false;
    }

    // ─── 私有層級行為實作 ──────────────────────────────────────────────────────

    /**
     * 顯示面板：若曾以快取模式關閉，先呼叫 resetState() 清除殘留狀態（M-2）。
     */
    private async _showEntry(entry: UIEntry, payload?: unknown): Promise<void> {
        if (entry.wasCached) {
            entry.controller.resetState?.();
            entry.wasCached = false;
        }
        entry.isOpen = true;
        await entry.controller.show(payload);
    }

    /**
     * 隱藏面板。
     * @param useCache 若為 true，標記為快取（下次 open 前呼叫 resetState）
     */
    private async _hideEntry(entry: UIEntry, useCache?: boolean): Promise<void> {
        entry.isOpen = false;
        entry.wasCached = useCache === true;

        const node = entry.controller.node;
        if (!node || !node.isValid) {
            return;
        }

        await entry.controller.hide();
    }

    /**
     * LayerUI 替換模式：先關閉目前主頁面，再開啟新頁面。
     * 對照 Unity：像切換主場景的 Canvas，不允許兩個主頁面同時存在。
     */
    private async _openReplace(uiId: UIID, entry: UIEntry, payload?: unknown): Promise<void> {
        if (this.currentUI === uiId) {
            await this._showEntry(entry, payload);
            return;
        }

        await this._closeTransientOverlays();

        if (this.currentUI) {
            const prev = this.registry.get(this.currentUI);
            if (prev && prev.isOpen) {
                this.uiHistory.push(this.currentUI);
                const prevCfg = UIConfig[prev.uiId];
                await this._hideEntry(prev, prevCfg.cache);
            }
        }

        this.currentUI = uiId;
        await this._showEntry(entry, payload);
    }

    private async _closeReplace(uiId: UIID, entry: UIEntry): Promise<void> {
        const cfg = UIConfig[uiId];
        if (this.currentUI === uiId) {
            await this._closeTransientOverlays();
        }
        await this._hideEntry(entry, cfg.cache);

        if (this.currentUI !== uiId) {
            this._removeFromUIHistory(uiId);
            return;
        }

        this.currentUI = null;
        const previousUI = this._popPreviousUI(uiId);
        if (previousUI) {
            const previousEntry = this.registry.get(previousUI);
            if (previousEntry) {
                this.currentUI = previousUI;
                await this._showEntry(previousEntry);
            }
        }
    }

    /**
     * LayerPopUp 堆疊模式：推入堆疊後直接顯示。
     * 對照 Unity：多個 Panel 可同時疊加，但有記錄堆疊順序。
     */
    private async _openStack(uiId: UIID, entry: UIEntry, payload?: unknown): Promise<void> {
        if (!this.popupStack.includes(uiId)) {
            this.popupStack.push(uiId);
        }
        await this._showEntry(entry, payload);
    }

    /**
     * LayerPopUp 堆疊關閉：從堆疊中任意位置移除。
     */
    private async _closeStack(uiId: UIID, entry: UIEntry): Promise<void> {
        const idx = this.popupStack.indexOf(uiId);
        if (idx !== -1) { this.popupStack.splice(idx, 1); }
        const cfg = UIConfig[uiId];
        await this._hideEntry(entry, cfg.cache);
    }

    /**
     * LayerDialog 佇列模式：若有正在顯示的對話框，則排隊等候；否則立即顯示。
     * 對照 Unity：類似 MessageQueue，保證對話框不互相打斷。
     */
    private async _openQueue(uiId: UIID, entry: UIEntry, payload?: unknown): Promise<void> {
        if (this.activeDialog !== null) {
            // 已有對話框在顯示，加入等候佇列
            if (!this.dialogQueue.includes(uiId)) {
                this.dialogQueue.push(uiId);
            }
            return;
        }
        this.activeDialog = uiId;
        await this._showEntry(entry, payload);
    }

    /**
     * LayerDialog 佇列關閉：關閉當前後自動顯示下一個等候中的對話框。
     */
    private async _closeQueue(uiId: UIID, entry: UIEntry): Promise<void> {
        const cfg = UIConfig[uiId];
        await this._hideEntry(entry, cfg.cache);
        if (this.activeDialog === uiId) {
            this.activeDialog = null;
            const nextId = this.dialogQueue.shift();
            if (nextId !== undefined) {
                const nextEntry = this.registry.get(nextId);
                if (nextEntry) {
                    this.activeDialog = nextId;
                    await this._showEntry(nextEntry);
                }
            }
        }
    }

    private async _closeTransientOverlays(): Promise<void> {
        const activeDialogId = this.activeDialog;
        const popupIds = [...this.popupStack].reverse();

        this.activeDialog = null;
        this.dialogQueue.length = 0;
        this.popupStack.length = 0;

        if (activeDialogId) {
            const activeDialogEntry = this.registry.get(activeDialogId);
            if (activeDialogEntry?.isOpen) {
                const cfg = UIConfig[activeDialogId];
                await this._hideEntry(activeDialogEntry, cfg.cache);
            }
        }

        for (const popupId of popupIds) {
            const popupEntry = this.registry.get(popupId);
            if (!popupEntry?.isOpen) {
                continue;
            }
            const cfg = UIConfig[popupId];
            await this._hideEntry(popupEntry, cfg.cache);
        }
    }

    private _createLayerController(layer: UILayer): UIManagedController {
        return {
            node: layer.node,
            show: () => layer.show(),
            hide: () => layer.hide(),
            resetState: () => layer.resetState(),
        };
    }

    private _popPreviousUI(excludeUiId: UIID): UIID | null {
        while (this.uiHistory.length > 0) {
            const previousUiId = this.uiHistory.pop() ?? null;
            if (!previousUiId || previousUiId === excludeUiId) {
                continue;
            }
            if (!this.registry.has(previousUiId)) {
                continue;
            }
            return previousUiId;
        }
        return null;
    }

    private _removeFromUIHistory(uiId: UIID): void {
        for (let index = this.uiHistory.length - 1; index >= 0; index -= 1) {
            if (this.uiHistory[index] === uiId) {
                this.uiHistory.splice(index, 1);
            }
        }
    }

    private _resolveBackdropConfig(uiId: UIID | null): Required<UIBackdropConfig> | null {
        if (!uiId) {
            return null;
        }
        const cfg = UIConfig[uiId];
        const backdrop = cfg.backdrop;
        const needsDefaultBackdrop = cfg.layer === LayerType.UI
            || cfg.layer === LayerType.PopUp
            || cfg.layer === LayerType.Dialog
            || cfg.mask === true;

        if (backdrop?.enabled === false) {
            return null;
        }
        if (!backdrop && !needsDefaultBackdrop) {
            return null;
        }
        return {
            enabled: true,
            opacity: backdrop?.opacity ?? DEFAULT_UI_BACKDROP.opacity,
            blocksInput: backdrop?.blocksInput ?? DEFAULT_UI_BACKDROP.blocksInput,
            closeOnTap: backdrop?.closeOnTap ?? DEFAULT_UI_BACKDROP.closeOnTap,
        };
    }

    private _getBackdropOwnerUiId(): UIID | null {
        if (this.activeDialog) {
            const activeDialogEntry = this.registry.get(this.activeDialog);
            if (activeDialogEntry?.isOpen) {
                return this.activeDialog;
            }
        }

        for (let index = this.popupStack.length - 1; index >= 0; index -= 1) {
            const popupUiId = this.popupStack[index];
            const popupEntry = this.registry.get(popupUiId);
            if (popupEntry?.isOpen) {
                return popupUiId;
            }
        }

        if (this.currentUI) {
            const currentEntry = this.registry.get(this.currentUI);
            if (currentEntry?.isOpen) {
                return this.currentUI;
            }
        }

        return null;
    }

    private _syncUIBackdrop(): void {
        const activeUiId = this._getBackdropOwnerUiId();
        const backdropConfig = this._resolveBackdropConfig(activeUiId);
        if (!activeUiId || !backdropConfig) {
            if (this._uiBackdropNode) {
                this._uiBackdropNode.active = false;
            }
            this._uiBackdropCloseOnTap = false;
            return;
        }

        const entry = this.registry.get(activeUiId);
        const activeCfg = UIConfig[activeUiId];
        const hostNode = entry?.controller.node ?? null;
        const container = this.layerContainers.get(LayerType.UI) ?? hostNode?.parent ?? null;
        if (!hostNode || !container) {
            if (this._uiBackdropNode) {
                this._uiBackdropNode.active = false;
            }
            this._uiBackdropCloseOnTap = false;
            return;
        }

        const backdropNode = this._ensureUIBackdropNode(container);
        backdropNode.active = true;
        backdropNode.layer = container.layer;
        backdropNode.setSiblingIndex(Math.max(0, hostNode.getSiblingIndex()));
        hostNode.setSiblingIndex(backdropNode.getSiblingIndex() + 1);

        const backdropFill = backdropNode.getComponent(SolidBackground) ?? backdropNode.addComponent(SolidBackground);
        backdropFill.color = new Color(0, 0, 0, 255);

        const backdropOpacity = backdropNode.getComponent(UIOpacity) ?? backdropNode.addComponent(UIOpacity);
        backdropOpacity.opacity = backdropConfig.opacity;

        const blockerButton = backdropNode.getComponent(Button) ?? backdropNode.addComponent(Button);
        blockerButton.transition = Button.Transition.NONE;
        const shouldBlockInput = activeCfg.layer !== LayerType.UI
            ? (backdropConfig.blocksInput || backdropConfig.closeOnTap)
            : backdropConfig.closeOnTap;
        blockerButton.enabled = shouldBlockInput;
        blockerButton.interactable = shouldBlockInput;

        this._uiBackdropCloseOnTap = shouldBlockInput && backdropConfig.closeOnTap;
    }

    private _ensureUIBackdropNode(container: Node): Node {
        if (this._uiBackdropNode?.isValid) {
            if (this._uiBackdropNode.parent !== container) {
                this._uiBackdropNode.parent = container;
            }
            return this._uiBackdropNode;
        }

        const backdropNode = new Node('__ui-backdrop');
        backdropNode.layer = container.layer;
        backdropNode.parent = container;

        const transform = backdropNode.addComponent(UITransform);
        transform.setContentSize(1920, 1080);

        const widget = backdropNode.addComponent(Widget);
        widget.isAlignTop = true;
        widget.isAlignBottom = true;
        widget.isAlignLeft = true;
        widget.isAlignRight = true;
        widget.top = 0;
        widget.bottom = 0;
        widget.left = 0;
        widget.right = 0;

        const backdropFill = backdropNode.addComponent(SolidBackground);
        backdropFill.color = new Color(0, 0, 0, 255);

        const opacity = backdropNode.addComponent(UIOpacity);
        opacity.opacity = DEFAULT_UI_BACKDROP.opacity;

        const blockerButton = backdropNode.addComponent(Button);
        blockerButton.transition = Button.Transition.NONE;
        blockerButton.node.on(Button.EventType.CLICK, () => {
            if (!this._uiBackdropCloseOnTap) {
                return;
            }
            void this.closeCurrentUI();
        });

        this._uiBackdropNode = backdropNode;
        return backdropNode;
    }

    private _getTopClosableUI(): UIID | null {
        if (this.activeDialog) {
            const activeDialogEntry = this.registry.get(this.activeDialog);
            if (activeDialogEntry?.isOpen) {
                return this.activeDialog;
            }
        }

        for (let index = this.popupStack.length - 1; index >= 0; index -= 1) {
            const popupUiId = this.popupStack[index];
            const popupEntry = this.registry.get(popupUiId);
            if (popupEntry?.isOpen) {
                return popupUiId;
            }
        }

        if (this.currentUI) {
            const currentEntry = this.registry.get(this.currentUI);
            if (currentEntry?.isOpen) {
                return this.currentUI;
            }
        }

        return null;
    }
}