/**
 * DataStorageAdapter.ts
 * 
 * 資料儲存抽象層，統一 Web (IndexedDB) 與 Native (SQLite) 的存取介面。
 * 
 * Unity 對照：類似 Unity 的 PersistentDataPath + PlayerPrefs 的組合，
 * 但以非同步 key-value store 為核心，並支援結構化查詢。
 */

export interface StorageQueryFilter {
  /** 欄位名稱 */
  field: string;
  /** 比較運算符 */
  op: '==' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'contains';
  /** 比較值 */
  value: unknown;
}

export interface StorageStats {
  /** 目前已使用的儲存空間（bytes）；若不支援則為 -1 */
  usedBytes: number;
  /** 配額上限（bytes）；若不支援則為 -1 */
  quotaBytes: number;
  /** 資料筆數 */
  recordCount: number;
}

/**
 * DataStorageAdapter — 儲存後端抽象基類
 * 
 * 所有具體實作（IndexedDB、SQLite）必須繼承此類並實作所有 abstract 方法。
 */
export abstract class DataStorageAdapter {
  /** 後端識別名稱，用於日誌與 debug */
  abstract readonly adapterName: string;

  /**
   * 初始化儲存後端（開啟資料庫連線等）。
   * 必須在使用任何其他方法前呼叫。
   */
  abstract init(): Promise<void>;

  /**
   * 依 key 讀取一筆資料。
   * @param key 資料鍵
   * @returns 資料值（型別由呼叫端強制轉型），找不到時回傳 null
   */
  abstract get<T>(key: string): Promise<T | null>;

  /**
   * 寫入一筆資料。
   * @param key 資料鍵
   * @param value 資料值（任意可序列化物件）
   */
  abstract set<T>(key: string, value: T): Promise<void>;

  /**
   * 刪除一筆資料。
   * @param key 資料鍵
   */
  abstract delete(key: string): Promise<void>;

  /**
   * 清除所有資料（危險操作，主要用於測試或重置）。
   */
  abstract clear(): Promise<void>;

  /**
   * 以過濾條件查詢多筆資料。
   * @param storeName 資料集名稱（類似 table/collection）
   * @param filters 過濾條件陣列（AND 邏輯）
   * @param limit 最多回傳筆數（0 = 不限）
   * @param offset 跳過筆數（分頁用）
   */
  abstract query<T>(
    storeName: string,
    filters: StorageQueryFilter[],
    limit?: number,
    offset?: number
  ): Promise<T[]>;

  /**
   * 取得儲存空間統計資訊。
   */
  abstract getStorageStats(): Promise<StorageStats>;

  /**
   * 釋放資源（關閉資料庫連線等）。
   * 建議在 onDestroy 或 App 關閉前呼叫。
   */
  abstract dispose(): Promise<void>;
}
