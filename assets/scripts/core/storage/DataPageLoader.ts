/**
 * DataPageLoader.ts
 * 
 * L1-L5 分頁載入器 — 依 layer level 與 page cursor 實作按需載入。
 * 
 * Unity 對照：類似 Unity Addressables 的分批非同步載入（LoadAssetAsync），
 * 或 Pagination 模式的 ScriptableObject 分頁。
 * 差別在於這裡以武將資料的「存取頻率」分層，不以「資產類型」分層。
 * 
 * Layer 說明：
 *   L1 — 當前陣容（進入 Lobby 時預載，約 10-12 位）
 *   L2 — 武將倉庫（page cursor 懶載，每頁 20 位）
 *   L3 — 詳情頁（點進武將時載入完整 lore + stats）
 *   L4 — 故事條（開啟故事書時載入 storyStripCells）
 *   L5 — 基因樹（基因頁才載入 geneTree）
 * 
 * 效能目標：
 *   L1 預載 < 50ms（10-12 位）
 *   L2 每頁 < 50ms（20 位 / 頁）
 */

import { resources, JsonAsset } from 'cc';
import { DataCatalog } from './DataCatalog';
import { DataStorageAdapter } from './DataStorageAdapter';

/** 分頁游標 */
export interface PageCursor {
  /** 從第幾筆開始（0-based） */
  offset: number;
  /** 每頁筆數 */
  pageSize: number;
  /** 是否還有下一頁 */
  hasMore: boolean;
}

/** 分頁結果 */
export interface PageResult<T> {
  data: T[];
  cursor: PageCursor;
  /** 載入耗時（ms） */
  elapsedMs: number;
}

/** Layer 等級定義 */
export type LayerLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

/**
 * DataPageLoader — 分層分頁載入器
 */
export class DataPageLoader {
  private static _instance: DataPageLoader | null = null;

  private _catalog: DataCatalog;
  private _adapter: DataStorageAdapter | null = null;
  /** L3-L5 資料快取（uid → 完整資料） */
  private _detailCache: Map<string, unknown> = new Map();

  constructor(catalog: DataCatalog, adapter?: DataStorageAdapter) {
    this._catalog = catalog;
    this._adapter = adapter ?? null;
  }

  static getInstance(): DataPageLoader {
    if (!DataPageLoader._instance) {
      DataPageLoader._instance = new DataPageLoader(DataCatalog.getInstance());
    }
    return DataPageLoader._instance;
  }

  /**
   * L1：載入當前陣容武將（來自 DataCatalog L1 索引 + generals.json）。
   * 進入 Lobby 時呼叫，目標 < 50ms。
   */
  async loadL1Active<T>(): Promise<PageResult<T>> {
    const startMs = Date.now();
    const activeEntries = this._catalog.getActivePage();
    const uids = activeEntries.map(e => e.uid);

    // 從 resources/data/generals.json 載入全量資料，過濾出 L1 武將
    const allData = await this._loadJsonArray<T & { id?: string }>('data/generals');
    const filtered = allData.filter(item => {
      const id = (item as Record<string, unknown>).id as string;
      return uids.length === 0 || uids.includes(id);
    });

    const elapsed = Date.now() - startMs;
    if (elapsed > 50) {
      console.warn(`[DataPageLoader] L1 載入耗時 ${elapsed}ms，超過 50ms 目標。`);
    }

    return {
      data: filtered as T[],
      cursor: { offset: 0, pageSize: filtered.length, hasMore: false },
      elapsedMs: elapsed,
    };
  }

  /**
   * L2：以 page cursor 懶載武將倉庫。
   * 每次呼叫載入一頁（預設 20 筆）。
   * @param cursor 上次的游標；null 表示從頭載入
   * @param faction 可選的勢力過濾
   */
  async loadL2Page<T>(
    cursor: PageCursor | null,
    faction?: string
  ): Promise<PageResult<T>> {
    const startMs = Date.now();
    const pageSize = cursor?.pageSize ?? 20;
    const offset = cursor?.offset ?? 0;

    let entries = this._catalog.search(faction ? { faction } : {});
    const total = entries.length;
    entries = entries.slice(offset, offset + pageSize);
    const uids = entries.map(e => e.uid);

    // 從 generals.json 取出對應武將資料
    // 正式版可改用 adapter.query() 做資料庫層過濾
    const allData = await this._loadJsonArray<T & { id?: string }>('data/generals');
    const pageData = allData.filter(item => {
      const id = (item as Record<string, unknown>).id as string;
      return uids.includes(id);
    });

    const newOffset = offset + pageSize;
    const elapsed = Date.now() - startMs;
    if (elapsed > 50) {
      console.warn(`[DataPageLoader] L2 載入耗時 ${elapsed}ms，超過 50ms 目標。`);
    }

    return {
      data: pageData as T[],
      cursor: {
        offset: newOffset,
        pageSize,
        hasMore: newOffset < total,
      },
      elapsedMs: elapsed,
    };
  }

  /**
   * L3：載入武將完整詳情（lore + stats）。
   * 含快取，同一 uid 僅載入一次。
   */
  async loadL3Detail<T>(uid: string): Promise<T | null> {
    if (this._detailCache.has(uid)) {
      return this._detailCache.get(uid) as T;
    }

    const allData = await this._loadJsonArray<T & { id?: string }>('data/generals');
    const found = allData.find(item => {
      const id = (item as Record<string, unknown>).id as string;
      return id === uid;
    });

    if (found) {
      this._detailCache.set(uid, found);
    }
    return found ?? null;
  }

  /**
   * L4/L5：按需載入指定 layer 的補充資料（storyStripCells / geneTree）。
   * 從 master/ 對應檔案載入。
   */
  async loadLayerData<T>(uid: string, layer: 'L4' | 'L5'): Promise<T | null> {
    const cacheKey = `${layer}:${uid}`;
    if (this._detailCache.has(cacheKey)) {
      return this._detailCache.get(cacheKey) as T;
    }

    const path = layer === 'L4' ? 'data/master/generals-stories' : 'data/master/generals-base';
    const allData = await this._loadJsonArray<T & { id?: string }>(path);
    const found = allData.find(item => {
      const id = (item as Record<string, unknown>).id as string;
      return id === uid;
    });

    if (found) {
      this._detailCache.set(cacheKey, found);
    }
    return found ?? null;
  }

  /** 清除詳情快取（場景切換時呼叫） */
  clearCache(): void {
    this._detailCache.clear();
  }

  // ---- private helpers ----

  private _loadJsonArray<T>(path: string): Promise<T[]> {
    return new Promise<T[]>((resolve) => {
      resources.load(path, JsonAsset, (err, asset) => {
        if (err) {
          console.warn(`[DataPageLoader] 載入失敗：${path}`, err);
          resolve([]);
          return;
        }
        const json = asset.json as { data?: T[] } | T[];
        if (Array.isArray(json)) {
          resolve(json);
        } else if (json && typeof json === 'object' && Array.isArray((json as { data?: T[] }).data)) {
          resolve((json as { data: T[] }).data);
        } else {
          resolve([]);
        }
      });
    });
  }
}
