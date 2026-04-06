/**
 * SqliteAdapter.ts
 * 
 * DataStorageAdapter 的 Native 平台 stub 實作（Android/iOS）。
 * 
 * Unity 對照：類似 Unity 在 Android/iOS 上使用 SQLite 或 Application.persistentDataPath
 * 儲存本地資料庫的方案。
 * 
 * 注意：此 stub 供 Web preview 以外的原生平台使用。
 * 實際 SQLite 呼叫需搭配 Cocos Creator jsb（JSB = JavaScript Binding，
 * 對應 Unity 的 P/Invoke 機制）執行，目前以 TODO 標記。
 */

import {
  DataStorageAdapter,
  StorageQueryFilter,
  StorageStats,
} from './DataStorageAdapter';

/**
 * SqliteAdapter — Native 平台 SQLite stub
 * 
 * TODO: Native 平台
 * 待搭配 jsb.FileUtils 或第三方 SQLite 原生插件實作真正的讀寫邏輯。
 * 目前所有操作回傳空結果，不拋例外，用於 Web/editor 環境的 fallback。
 */
export class SqliteAdapter extends DataStorageAdapter {
  readonly adapterName = 'SQLite (stub)';

  private _initialized = false;

  async init(): Promise<void> {
    // TODO: Native 平台 — 開啟 SQLite 連線
    // jsb.fileUtils.getWritablePath() + 'game.db'
    console.warn('[SqliteAdapter] Native SQLite 尚未實作，使用 stub 模式。');
    this._initialized = true;
  }

  async get<T>(key: string): Promise<T | null> {
    // TODO: Native 平台 — SELECT value FROM kv WHERE key = ?
    void key;
    return null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    // TODO: Native 平台 — INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)
    void key;
    void value;
  }

  async delete(key: string): Promise<void> {
    // TODO: Native 平台 — DELETE FROM kv WHERE key = ?
    void key;
  }

  async clear(): Promise<void> {
    // TODO: Native 平台 — DELETE FROM kv
  }

  async query<T>(
    storeName: string,
    filters: StorageQueryFilter[],
    limit = 0,
    offset = 0
  ): Promise<T[]> {
    // TODO: Native 平台 — 動態組裝 SELECT SQL + WHERE 子句
    void storeName;
    void filters;
    void limit;
    void offset;
    return [];
  }

  async getStorageStats(): Promise<StorageStats> {
    // TODO: Native 平台 — 查詢 SQLite db_size pragma
    return { usedBytes: -1, quotaBytes: -1, recordCount: 0 };
  }

  async dispose(): Promise<void> {
    // TODO: Native 平台 — 關閉 SQLite 連線
    this._initialized = false;
  }
}
