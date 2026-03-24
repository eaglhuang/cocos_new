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

import { UILayer } from "../../ui/layers/UILayer";
import { UIID, UIConfig, LayerType } from "../config/UIConfig";

// ─── 內部紀錄結構 ─────────────────────────────────────────────────────────────
interface UIEntry {
    readonly uiId: UIID;
    layer: UILayer;
    isOpen: boolean;
    /** 是否曾以快取模式關閉——下次 open 需先呼叫 resetState()（M-2） */
    wasCached: boolean;
}

export class UIManager {
    // 統一頁面登記表
    private readonly registry = new Map<UIID, UIEntry>();

    // LayerUI：目前顯示的替換式主頁面（同時只有一個）
    private currentUI: UIID | null = null;

    // LayerPopUp：堆疊式彈窗（可多個共存，LIFO 順序）
    private readonly popupStack: UIID[] = [];

    // LayerDialog：佇列式對話框
    private readonly dialogQueue: UIID[] = [];
    private activeDialog: UIID | null = null;

    // ─── 公開 API ──────────────────────────────────────────────────────────────

    /**
     * 將場景中的 UILayer 元件綁定到指定 UIID。
     * 必須在呼叫 open/close 之前完成（通常在 BattleScene.start() 或對應 View 的 onLoad 中執行）。
     */
    public register(uiId: UIID, layer: UILayer): void {
        this.registry.set(uiId, { uiId, layer, isOpen: false, wasCached: false });
    }

    /**
     * 開啟指定 UI，行為依 UIConfig[uiId].layer 的層級語義決定。
     * 若該 UI 之前以快取模式關閉，先呼叫 resetState() 清除殘留資料（M-2）。
     * @returns 若未 register 則回傳 false
     */
    public open(uiId: UIID): boolean {
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
                this._showEntry(entry);
                break;
            case LayerType.UI:
                this._openReplace(uiId, entry);
                break;
            case LayerType.PopUp:
                this._openStack(uiId, entry);
                break;
            case LayerType.Dialog:
                this._openQueue(uiId, entry);
                break;
        }
        return true;
    }

    /**
     * 關閉指定 UI，行為依層級語義決定。
     * Dialog 關閉後會自動推進佇列中的下一個對話框。
     * @returns 若未 register 或已關閉則回傳 false
     */
    public close(uiId: UIID): boolean {
        const entry = this.registry.get(uiId);
        if (!entry || !entry.isOpen) { return false; }

        const cfg = UIConfig[uiId];
        switch (cfg.layer) {
            case LayerType.Game:
            case LayerType.System:
            case LayerType.Notify:
                this._hideEntry(entry, cfg.cache);
                break;
            case LayerType.UI:
                this._hideEntry(entry, cfg.cache);
                if (this.currentUI === uiId) { this.currentUI = null; }
                break;
            case LayerType.PopUp:
                this._closeStack(uiId, entry);
                break;
            case LayerType.Dialog:
                this._closeQueue(uiId, entry);
                break;
        }
        return true;
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

    /**
     * 清除指定 UI 的快取標記（強制下次 open 不呼叫 resetState）。
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
    public closeAll(): void {
        this.registry.forEach(entry => {
            if (entry.isOpen) { this._hideEntry(entry, false); }
        });
        this.currentUI = null;
        this.popupStack.length = 0;
        this.dialogQueue.length = 0;
        this.activeDialog = null;
    }

    // ─── 私有層級行為實作 ──────────────────────────────────────────────────────

    /**
     * 顯示面板：若曾以快取模式關閉，先呼叫 resetState() 清除殘留狀態（M-2）。
     */
    private _showEntry(entry: UIEntry): void {
        if (entry.wasCached) {
            entry.layer.resetState();
            entry.wasCached = false;
        }
        entry.isOpen = true;
        entry.layer.show();
    }

    /**
     * 隱藏面板。
     * @param useCache 若為 true，標記為快取（下次 open 前呼叫 resetState）
     */
    private _hideEntry(entry: UIEntry, useCache?: boolean): void {
        entry.isOpen = false;
        entry.wasCached = useCache === true;
        entry.layer.hide();
    }

    /**
     * LayerUI 替換模式：先關閉目前主頁面，再開啟新頁面。
     * 對照 Unity：像切換主場景的 Canvas，不允許兩個主頁面同時存在。
     */
    private _openReplace(uiId: UIID, entry: UIEntry): void {
        if (this.currentUI && this.currentUI !== uiId) {
            const prev = this.registry.get(this.currentUI);
            if (prev) {
                const prevCfg = UIConfig[prev.uiId];
                this._hideEntry(prev, prevCfg.cache);
            }
        }
        this.currentUI = uiId;
        this._showEntry(entry);
    }

    /**
     * LayerPopUp 堆疊模式：推入堆疊後直接顯示。
     * 對照 Unity：多個 Panel 可同時疊加，但有記錄堆疊順序。
     */
    private _openStack(uiId: UIID, entry: UIEntry): void {
        if (!this.popupStack.includes(uiId)) {
            this.popupStack.push(uiId);
        }
        this._showEntry(entry);
    }

    /**
     * LayerPopUp 堆疊關閉：從堆疊中任意位置移除。
     */
    private _closeStack(uiId: UIID, entry: UIEntry): void {
        const idx = this.popupStack.indexOf(uiId);
        if (idx !== -1) { this.popupStack.splice(idx, 1); }
        const cfg = UIConfig[uiId];
        this._hideEntry(entry, cfg.cache);
    }

    /**
     * LayerDialog 佇列模式：若有正在顯示的對話框，則排隊等候；否則立即顯示。
     * 對照 Unity：類似 MessageQueue，保證對話框不互相打斷。
     */
    private _openQueue(uiId: UIID, entry: UIEntry): void {
        if (this.activeDialog !== null) {
            // 已有對話框在顯示，加入等候佇列
            if (!this.dialogQueue.includes(uiId)) {
                this.dialogQueue.push(uiId);
            }
            return;
        }
        this.activeDialog = uiId;
        this._showEntry(entry);
    }

    /**
     * LayerDialog 佇列關閉：關閉當前後自動顯示下一個等候中的對話框。
     */
    private _closeQueue(uiId: UIID, entry: UIEntry): void {
        const cfg = UIConfig[uiId];
        this._hideEntry(entry, cfg.cache);
        if (this.activeDialog === uiId) {
            this.activeDialog = null;
            const nextId = this.dialogQueue.shift();
            if (nextId !== undefined) {
                const nextEntry = this.registry.get(nextId);
                if (nextEntry) {
                    this.activeDialog = nextId;
                    this._showEntry(nextEntry);
                }
            }
        }
    }
}