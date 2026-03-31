// @spec-source → 見 docs/cross-reference-index.md
/**
 * 記憶體管理器 (MemoryManager) — 追蹤層空殼，預留完整擴充點
 *
 * 【目前職責】
 *   作為所有資源載入/釋放的「通報中心」，維護一份 AssetRecord 清單。
 *   不實作任何實際的記憶體操作，只做帳目追蹤與 hook 轉發。
 *
 * 【未來擴充方向（依優先度）】
 *   1. LRU 弱引用快取 — 記憶體壓力時自動卸載最久未用的 bundle 資源
 *   2. 場景切換批次釋放 — releaseByScope(scope) 一鍵釋放戰鬥場景相關資源
 *   3. 記憶體上限警示 — trackedCount 超過 warningThreshold 時觸發 onThresholdExceeded
 *   4. 接入 Cocos cc.sys.totalMemory 或 profiler API 取得真實佔用量
 *   5. 編輯器工具整合 — 透過 getReport() 在工具面板即時顯示資源清單
 *
 * 【Unity 對照】
 *   - AssetRecord         ≈ Addressables AssetReference + RefCount
 *   - notifyLoaded()      ≈ Addressables.LoadAssetAsync<T>().Completed handler（追蹤側）
 *   - notifyReleased()    ≈ Addressables.Release(handle)（追蹤側）
 *   - getReport()         ≈ Unity Profiler → Memory → All Objects 清單
 *   - onThresholdExceeded ≈ Profiler.logFile 的記憶體警示回調
 *   - releaseByScope()    ≈ Addressables.UnloadSceneAsync + 批次 Release
 */

// ─── 資料結構 ────────────────────────────────────────────────────────────────

/** 單一資源的追蹤記錄 */
export interface AssetRecord {
    /** 資源唯一鍵值（路徑，或 bundle:path 的組合鍵） */
    readonly key: string;
    /** 所屬 bundle 名稱；'resources' 代表 Cocos 內建 resources 資料夾 */
    readonly bundle: string;
    /** 資源類型描述（'Texture2D' / 'AudioClip' / 'Prefab' / 'JsonAsset' / 'Font'…） */
    readonly assetType: string;
    /** 首次載入的時間戳 (ms, Date.now()) */
    readonly loadedAt: number;
    /** 目前有效參照次數（每次 notifyLoaded 對同 key +1，notifyReleased -1 至 0 時移除） */
    refCount: number;
}

// ─── 主類別 ──────────────────────────────────────────────────────────────────

export class MemoryManager {

    // ─── 追蹤帳目 ────────────────────────────────────────────────────────────
    private records = new Map<string, AssetRecord>();

    // ─── 擴充 Hook（預留點，目前皆為 null）────────────────────────────────────

    /**
     * [擴充點 A] 追蹤資源數量超過 warningThreshold 時觸發。
     * 掛上此 hook 可接入 UI 告警或強制觸發 GC。
     *
     * 未來實作範例：
     *   services().memory.onThresholdExceeded = (count) => {
     *       console.error(`[MemoryManager] 資源數 ${count} 超過警戒值，建議釋放閒置 bundle`);
     *       services().memory.releaseByScope('vfx_preview');
     *   };
     */
    public onThresholdExceeded: ((count: number) => void) | null = null;

    /**
     * [擴充點 B] 每次資源的 refCount 歸零並從清單移除後觸發。
     * 可用於 LRU 計時器啟動、遙測上報等。
     */
    public onAssetFullyReleased: ((key: string, bundle: string) => void) | null = null;

    /**
     * [擴充點 C] 場景切換前後的批次釋放 hook。
     * 未來由 SceneManager / BattleScene 觸發。
     *
     * 預留介面範例：
     *   releaseByScope(scope: string): void  // 按 scope tag 批次 decRef + 通知
     */

    /** 追蹤數量警示閾值（預設 200，可由外部修改） */
    public warningThreshold = 200;

    // ─── 核心通報 API ─────────────────────────────────────────────────────────

    /**
     * 任何資源載入成功後呼叫此方法，通知記憶體管理器記帳。
     * 同一 key 重複通報時 refCount++，不重複建立記錄。
     *
     * @param key       資源的唯一識別鍵（通常是 bundle-relative 路徑）
     * @param bundle    所屬 bundle 名稱（不知道時傳 'resources'）
     * @param assetType 資源類型描述字串（純文字，供報表顯示用）
     */
    public notifyLoaded(key: string, bundle: string, assetType: string): void {
        const existing = this.records.get(key);
        if (existing) {
            existing.refCount++;
            return;
        }

        this.records.set(key, {
            key,
            bundle,
            assetType,
            loadedAt: Date.now(),
            refCount: 1,
        });

        // 超過閾值時觸發擴充 hook
        if (this.records.size >= this.warningThreshold) {
            this.onThresholdExceeded?.(this.records.size);
        }
    }

    /**
     * 資源被釋放（decRef 後）時呼叫此方法，通知記憶體管理器更新帳目。
     * refCount 歸零時從清單移除，並觸發 onAssetFullyReleased hook。
     *
     * @param key 與 notifyLoaded 對應的資源鍵值
     */
    public notifyReleased(key: string): void {
        const rec = this.records.get(key);
        if (!rec) return;

        rec.refCount--;
        if (rec.refCount <= 0) {
            this.records.delete(key);
            this.onAssetFullyReleased?.(key, rec.bundle);
        }
    }

    // ─── 報表 API ─────────────────────────────────────────────────────────────

    /** 取得所有追蹤資源的快照陣列（可用於 debug 面板或工具） */
    public getReport(): AssetRecord[] {
        return Array.from(this.records.values());
    }

    /** 取得指定 bundle 下的所有追蹤資源 */
    public getByBundle(bundleName: string): AssetRecord[] {
        return this.getReport().filter(r => r.bundle === bundleName);
    }

    /** 取得目前已追蹤的資源總數 */
    public get trackedCount(): number {
        return this.records.size;
    }

    /**
     * 輸出可讀報表到 Console（開發除錯用）。
     * Unity 對照：Addressables → Event Viewer → 手動 Log snapshot
     */
    public printReport(): void {
        const items = this.getReport();
        console.log(`[MemoryManager] 追蹤資源共 ${items.length} 筆：`);
        items.forEach(r => {
            console.log(`  [${r.bundle}] ${r.assetType} | ref:${r.refCount} | ${r.key}`);
        });
    }

    /**
     * 清除所有追蹤記錄（僅清帳，不釋放實際資源）。
     * 適合測試或場景完整重置後呼叫。
     */
    public clearRecords(): void {
        this.records.clear();
    }
}
