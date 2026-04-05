// @spec-source → 見 docs/cross-reference-index.md
/**
 * 記憶體管理器 (MemoryManager) — LRU 弱引用快取 + 場景批次釋放
 *
 * 【設計概念：兩層式帳目】
 *   1. active (records)   — refCount > 0 的資源；每次存取更新 lastUsedAt
 *   2. lruBuffer          — refCount 歸零後「軟釋放」的資源
 *                           超過 lruMaxSize 時觸發 onAssetEvicted（硬釋放通知）
 *
 *   強制釋放流程：
 *     notifyReleased(key) → refCount-- → 歸零 → 移入 lruBuffer → 超限時觸發 onAssetEvicted
 *
 *   再使用流程：
 *     notifyLoaded(key, ...) → 若在 lruBuffer → 移回 active → refCount = 1
 *
 * 【Scope 批次釋放】
 *   releaseByScope('battle') — 場景切換時一鍵清除所有 battle scope 資源。
 *   notifyLoaded(key, bundle, type, 'battle') 標記資源屬於 battle scope。
 *
 * 【Unity 對照】
 *   - records           ≈ Addressables tracked handles（active）
 *   - lruBuffer         ≈ soft-unload / 待釋放快取（仍佔記憶體但 refCount = 0）
 *   - releaseByScope()  ≈ Addressables.UnloadSceneAsync + 批次 Release by label
 *   - onAssetEvicted    ≈ 呼叫 Addressables.Release(handle) 的觸發節點
 *   - evictLRU()        ≈ Resources.UnloadUnusedAssets()
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
    /** 目前有效參照次數（每次 notifyLoaded +1；notifyReleased -1 至 0 時移入 lruBuffer） */
    refCount: number;
    /** 最後一次被存取（notifyLoaded / touch）的時間戳；LRU 排序依據 */
    lastUsedAt: number;
    /** 所屬 scope 標籤集合（可多個）；供 releaseByScope 批次釋放用 */
    readonly scopes: Set<string>;
}

// ─── 主類別 ──────────────────────────────────────────────────────────────────

export class MemoryManager {

    // ─── 帳目儲存 ────────────────────────────────────────────────────────────
    /** active 資源（refCount > 0） */
    private readonly records = new Map<string, AssetRecord>();
    /** 軟釋放 LRU 緩衝（refCount == 0；Map 插入順序 = 最舊在前） */
    private readonly _lruBuffer = new Map<string, AssetRecord>();
    /** scope → Set<key> 索引，供 releaseByScope 批次操作 */
    private readonly _scopeIndex = new Map<string, Set<string>>();

    // ─── 可調整閾值 ───────────────────────────────────────────────────────────

    /** active 資源數量 >= warningThreshold 時觸發 onThresholdExceeded（預設 200） */
    public warningThreshold = 200;

    /**
     * LRU buffer 最大筆數；超過時自動逐出最舊條目並觸發 onAssetEvicted（預設 50）。
     * Unity 對照：ObjectPool 的 maxSize —— pool 滿了才真正 Destroy 歸還物件。
     */
    public lruMaxSize = 50;

    // ─── 擴充 Hook ────────────────────────────────────────────────────────────

    /**
     * [Hook A] active 資源數量 >= warningThreshold 時觸發。
     * 可接入 UI 告警或主動呼叫 releaseByScope / evictLRU 降壓。
     */
    public onThresholdExceeded: ((count: number) => void) | null = null;

    /**
     * [Hook B] 資源 refCount 歸零移入 LRU buffer 時觸發（尚未真正從記憶體移除）。
     * 適合遙測上報或 debug 追蹤。
     */
    public onAssetFullyReleased: ((key: string, bundle: string) => void) | null = null;

    /**
     * [Hook C] LRU buffer 逐出條目時觸發（硬釋放節點）。
     * 在此 hook 呼叫 ResourceManager.forceRelease() 才能真正釋放 Cocos 記憶體。
     *
     * 範例（在 ServiceLoader 初始化後設置）：
     *   services().memory.onAssetEvicted = (key, bundle) => {
     *       services().resource.forceRelease(key, bundle);
     *   };
     *
     * Unity 對照：Addressables.Release(handle) 的實際呼叫點。
     */
    public onAssetEvicted: ((key: string, bundle: string) => void) | null = null;

    // ─── 核心通報 API ─────────────────────────────────────────────────────────

    /**
     * 任何資源載入成功後呼叫此方法以記帳。
     * - 若 key 在 lruBuffer → 移回 active，refCount = 1
     * - 若 key 已在 active → refCount++，更新 lastUsedAt
     * - 否則新建記錄
     *
     * @param key       資源唯一識別鍵（通常是 bundle-relative 路徑）
     * @param bundle    所屬 bundle 名稱（不知道時傳 'resources'）
     * @param assetType 資源類型描述字串（供報表顯示用）
     * @param scope     資源所屬場景/生命週期 scope（可選）
     *                  用於 releaseByScope 批次釋放；例：'battle'、'lobby'
     */
    public notifyLoaded(key: string, bundle: string, assetType: string, scope?: string): void {
        // 若在 LRU buffer → 移回 active
        const lruRec = this._lruBuffer.get(key);
        if (lruRec) {
            this._lruBuffer.delete(key);
            lruRec.refCount = 1;
            lruRec.lastUsedAt = Date.now();
            if (scope) this._addKeyToScope(key, scope, lruRec);
            this.records.set(key, lruRec);
            return;
        }

        // 已在 active → refCount++ + 更新 lastUsedAt
        const existing = this.records.get(key);
        if (existing) {
            existing.refCount++;
            existing.lastUsedAt = Date.now();
            if (scope) this._addKeyToScope(key, scope, existing);
            return;
        }

        // 全新記錄
        const now = Date.now();
        const rec: AssetRecord = {
            key,
            bundle,
            assetType,
            loadedAt: now,
            lastUsedAt: now,
            refCount: 1,
            scopes: new Set(scope ? [scope] : []),
        };
        this.records.set(key, rec);
        if (scope) {
            const set = this._scopeIndex.get(scope);
            if (set) { set.add(key); } else { this._scopeIndex.set(scope, new Set([key])); }
        }

        if (this.records.size >= this.warningThreshold) {
            this.onThresholdExceeded?.(this.records.size);
        }
    }

    /**
     * 資源被釋放（decRef）時呼叫，更新帳目。
     * refCount 歸零時移入 LRU buffer（軟釋放）；超過 lruMaxSize 時觸發 onAssetEvicted。
     *
     * @param key 與 notifyLoaded 對應的資源鍵值
     */
    public notifyReleased(key: string): void {
        const rec = this.records.get(key);
        if (!rec) return;

        rec.refCount--;
        if (rec.refCount <= 0) {
            rec.refCount = 0;
            this.records.delete(key);
            this.onAssetFullyReleased?.(key, rec.bundle);
            // 移入 LRU 軟釋放 buffer（插入順序即為 LRU 排序：最舊在前）
            this._lruBuffer.set(key, rec);
            this._trimLruBuffer();
        }
    }

    // ─── Scope 批次釋放 ───────────────────────────────────────────────────────

    /**
     * 強制釋放指定 scope 下的所有資源（不進 LRU buffer，直接硬逐出）。
     * 適合場景切換時呼叫：
     *   services().memory.releaseByScope('battle');
     *
     * Unity 對照：Addressables.UnloadSceneAsync + 批次 Release by label
     *
     * @param scope 要釋放的 scope 識別字串（與 notifyLoaded 第 4 參數對應）
     */
    public releaseByScope(scope: string): void {
        const keys = this._scopeIndex.get(scope);
        if (!keys || keys.size === 0) return;

        for (const key of Array.from(keys)) {
            // active 資源 → 強制移除，硬逐出
            const active = this.records.get(key);
            if (active) {
                active.refCount = 0;
                this.records.delete(key);
                this.onAssetFullyReleased?.(key, active.bundle);
                this.onAssetEvicted?.(key, active.bundle);
                // 從其他 scope 索引清除此 key
                for (const s of active.scopes) {
                    if (s !== scope) this._scopeIndex.get(s)?.delete(key);
                }
                active.scopes.clear();
            }
            // LRU buffer 中的資源 → 直接硬逐出
            const lruRec = this._lruBuffer.get(key);
            if (lruRec) {
                this._lruBuffer.delete(key);
                this.onAssetEvicted?.(key, lruRec.bundle);
                for (const s of lruRec.scopes) {
                    if (s !== scope) this._scopeIndex.get(s)?.delete(key);
                }
                lruRec.scopes.clear();
            }
        }

        this._scopeIndex.delete(scope);
    }

    // ─── LRU 手動控制 ─────────────────────────────────────────────────────────

    /**
     * 手動觸發 LRU buffer 逐出，釋放記憶體壓力。
     * 不帶參數時清空整個 LRU buffer；帶 count 時只逐出最舊的 count 筆。
     *
     * Unity 對照：Resources.UnloadUnusedAssets()
     *
     * @param count 最多逐出幾筆（省略代表全部清空）
     * @returns 實際逐出筆數
     */
    public evictLRU(count?: number): number {
        const target = count ?? this._lruBuffer.size;
        let evicted = 0;
        for (const [key, rec] of this._lruBuffer) {
            if (evicted >= target) break;
            this._lruBuffer.delete(key);
            for (const s of rec.scopes) { this._scopeIndex.get(s)?.delete(key); }
            this.onAssetEvicted?.(key, rec.bundle);
            evicted++;
        }
        return evicted;
    }

    // ─── 報表 API ─────────────────────────────────────────────────────────────

    /** 取得所有 active 追蹤資源的快照陣列（可用於 debug 面板或工具） */
    public getReport(): AssetRecord[] {
        return Array.from(this.records.values());
    }

    /** 取得 LRU buffer（軟釋放待逐出）的快照陣列 */
    public getLruReport(): AssetRecord[] {
        return Array.from(this._lruBuffer.values());
    }

    /** 取得指定 bundle 下的所有 active 追蹤資源 */
    public getByBundle(bundleName: string): AssetRecord[] {
        return this.getReport().filter(r => r.bundle === bundleName);
    }

    /** 取得指定 scope 下所有已追蹤的資源 key 列表（active + lruBuffer 均計） */
    public getByScope(scope: string): string[] {
        return Array.from(this._scopeIndex.get(scope) ?? []);
    }

    /** 取得目前 active 追蹤的資源總數 */
    public get trackedCount(): number {
        return this.records.size;
    }

    /** 取得 LRU buffer 目前的資源總數 */
    public get lruBufferCount(): number {
        return this._lruBuffer.size;
    }

    /**
     * 輸出可讀報表到 Console（開發除錯用）。
     * Unity 對照：Addressables → Event Viewer → 手動 Log snapshot
     */
    public printReport(): void {
        const items = this.getReport();
        console.log(`[MemoryManager] active:${items.length} lruBuffer:${this._lruBuffer.size}`);
        items.forEach(r => {
            const sc = r.scopes.size > 0 ? ` scope:[${[...r.scopes].join(',')}]` : '';
            console.log(`  [${r.bundle}] ${r.assetType} | ref:${r.refCount}${sc} | ${r.key}`);
        });
    }

    /**
     * 清除所有追蹤記錄，包含 LRU buffer 與 scope 索引（僅清帳，不釋放實際資源）。
     * 適合測試或場景完整重置後呼叫。
     */
    public clearRecords(): void {
        this.records.clear();
        this._lruBuffer.clear();
        this._scopeIndex.clear();
    }

    // ─── 私有輔助 ─────────────────────────────────────────────────────────────

    /** 將 key 加入 scope 索引，並在 rec.scopes 上登記 */
    private _addKeyToScope(key: string, scope: string, rec: AssetRecord): void {
        rec.scopes.add(scope);
        const set = this._scopeIndex.get(scope);
        if (set) { set.add(key); } else { this._scopeIndex.set(scope, new Set([key])); }
    }

    /** LRU buffer 超過 lruMaxSize 時，逐出最舊（最早插入）的條目 */
    private _trimLruBuffer(): void {
        while (this._lruBuffer.size > this.lruMaxSize) {
            const oldest = this._lruBuffer.keys().next().value as string;
            const rec = this._lruBuffer.get(oldest)!;
            this._lruBuffer.delete(oldest);
            for (const s of rec.scopes) { this._scopeIndex.get(s)?.delete(oldest); }
            this.onAssetEvicted?.(oldest, rec.bundle);
        }
    }
}
