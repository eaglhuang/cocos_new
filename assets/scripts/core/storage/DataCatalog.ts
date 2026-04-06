/**
 * DataCatalog.ts
 * 
 * L0 武將索引層 — App 啟動時載入輕量索引，提供快速查詢介面。
 * 
 * Unity 對照：類似 Unity 的 Resources.LoadAll() 或 Addressables 的 catalog，
 * 僅載入索引（metadata），不載入完整資產（詳細資料留給 DataPageLoader 按需載入）。
 * 
 * 效能目標：350 筆武將索引載入 < 100ms
 */

import { resources, JsonAsset } from 'cc';
import { GeneralDetailRarityTier } from '../models/GeneralUnit';

/** L0 索引項目 — 只含輕量查詢欄位 */
export interface GeneralIndexEntry {
  /** 武將唯一識別碼 */
  uid: string;
  /** 武將名稱 */
  name: string;
  /** 所屬勢力 */
  faction: string;
  /** 稀有度 */
  rarityTier: GeneralDetailRarityTier;
  /** 分頁 layer key（L1~L5 分層存取用） */
  layerKey: string;
}

/** DataCatalog 查詢過濾器 */
export interface CatalogFilter {
  faction?: string;
  rarityTier?: GeneralDetailRarityTier;
  layerKey?: string;
}

/**
 * DataCatalog — L0 輕量索引層
 * 
 * 用法：
 * ```typescript
 * const catalog = DataCatalog.getInstance();
 * await catalog.load();
 * const entry = catalog.find('guan-yu');
 * const shuGenerals = catalog.search({ faction: 'shu' });
 * ```
 */
export class DataCatalog {
  private static _instance: DataCatalog | null = null;

  private _index: Map<string, GeneralIndexEntry> = new Map();
  private _loaded = false;

  /** 取得 singleton 實體 */
  static getInstance(): DataCatalog {
    if (!DataCatalog._instance) {
      DataCatalog._instance = new DataCatalog();
    }
    return DataCatalog._instance;
  }

  /** 是否已載入完成 */
  get isLoaded(): boolean {
    return this._loaded;
  }

  /** 目前索引筆數 */
  get count(): number {
    return this._index.size;
  }

  /**
   * 從 resources 載入 generals-index.json。
   * App 啟動時應呼叫一次；重複呼叫為 no-op（除非 force = true）。
   */
  async load(force = false): Promise<void> {
    if (this._loaded && !force) return;

    const startMs = Date.now();

    const entries = await this._loadJsonFromResources<GeneralIndexEntry[]>(
      'data/generals-index'
    );

    this._index.clear();
    if (entries) {
      for (const entry of entries) {
        this._index.set(entry.uid, entry);
      }
    }

    this._loaded = true;
    const elapsed = Date.now() - startMs;
    if (elapsed > 100) {
      console.warn(`[DataCatalog] 載入耗時 ${elapsed}ms，超過 100ms 目標。`);
    }
  }

  /**
   * 依 uid 尋找索引項目。
   * @returns 找到的項目，或 null
   */
  find(uid: string): GeneralIndexEntry | null {
    return this._index.get(uid) ?? null;
  }

  /**
   * 依過濾條件搜尋索引。
   * 所有條件為 AND 邏輯。
   */
  search(filter: CatalogFilter): GeneralIndexEntry[] {
    const results: GeneralIndexEntry[] = [];
    for (const entry of this._index.values()) {
      if (filter.faction && entry.faction !== filter.faction) continue;
      if (filter.rarityTier && entry.rarityTier !== filter.rarityTier) continue;
      if (filter.layerKey && entry.layerKey !== filter.layerKey) continue;
      results.push(entry);
    }
    return results;
  }

  /**
   * 取得目前活躍頁（layerKey = 'L1'）的所有武將索引。
   * 供 DataPageLoader L1 預載使用。
   */
  getActivePage(): GeneralIndexEntry[] {
    return this.search({ layerKey: 'L1' });
  }

  /** 清除索引（用於測試或重置） */
  clear(): void {
    this._index.clear();
    this._loaded = false;
  }

  // ---- private helpers ----

  private _loadJsonFromResources<T>(path: string): Promise<T | null> {
    return new Promise<T | null>((resolve) => {
      resources.load(path, JsonAsset, (err, asset) => {
        if (err) {
          console.warn(`[DataCatalog] 載入失敗：${path}`, err);
          resolve(null);
          return;
        }
        // generals-index.json 格式為 { data: [...] } 或直接陣列
        const json = asset.json as { data?: T } | T;
        if (json && typeof json === 'object' && 'data' in (json as object)) {
          resolve((json as { data: T }).data);
        } else {
          resolve(json as T);
        }
      });
    });
  }
}
