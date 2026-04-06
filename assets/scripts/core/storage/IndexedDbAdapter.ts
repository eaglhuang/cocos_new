/**
 * IndexedDbAdapter.ts
 * 
 * DataStorageAdapter 的 Web 平台實作，使用 IndexedDB API。
 * 
 * Unity 對照：類似 Unity WebGL 平台下的 PlayerPrefs（底層對應 LocalStorage / IndexedDB）。
 * 差別在於 IndexedDB 是非同步且支援結構化資料查詢。
 */

import {
  DataStorageAdapter,
  StorageQueryFilter,
  StorageStats,
} from './DataStorageAdapter';

const DB_NAME = '3KLifeData';
const DB_VERSION = 1;

// 預設 object store 名稱
const STORE_KV = 'kv'; // 通用 key-value store

/**
 * IndexedDbAdapter — Web 平台 IndexedDB 實作
 */
export class IndexedDbAdapter extends DataStorageAdapter {
  readonly adapterName = 'IndexedDB';

  private _db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this._db) return;
    this._db = await this._openDatabase();
  }

  async get<T>(key: string): Promise<T | null> {
    const store = this._getStore(STORE_KV, 'readonly');
    return new Promise<T | null>((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result?.value as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async set<T>(key: string, value: T): Promise<void> {
    const store = this._getStore(STORE_KV, 'readwrite');
    return new Promise<void>((resolve, reject) => {
      const req = store.put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async delete(key: string): Promise<void> {
    const store = this._getStore(STORE_KV, 'readwrite');
    return new Promise<void>((resolve, reject) => {
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clear(): Promise<void> {
    const store = this._getStore(STORE_KV, 'readwrite');
    return new Promise<void>((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async query<T>(
    storeName: string,
    filters: StorageQueryFilter[],
    limit = 0,
    offset = 0
  ): Promise<T[]> {
    // IndexedDB 不原生支援複合查詢；這裡以全掃描 + JS 過濾實作。
    // 大資料集建議改用 IDBIndex 優化。
    const store = this._getStore(STORE_KV, 'readonly');
    return new Promise<T[]>((resolve, reject) => {
      const results: T[] = [];
      let skipped = 0;
      const req = store.openCursor();

      req.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (!cursor) {
          resolve(results);
          return;
        }

        const record = cursor.value?.value as Record<string, unknown>;
        if (record && this._matchFilters(record, filters)) {
          if (skipped < offset) {
            skipped++;
          } else if (limit === 0 || results.length < limit) {
            results.push(record as unknown as T);
          }
        }
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getStorageStats(): Promise<StorageStats> {
    const count = await this._countRecords();
    let usedBytes = -1;
    let quotaBytes = -1;

    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      usedBytes = est.usage ?? -1;
      quotaBytes = est.quota ?? -1;
    }

    return { usedBytes, quotaBytes, recordCount: count };
  }

  async dispose(): Promise<void> {
    if (this._db) {
      this._db.close();
      this._db = null;
    }
  }

  // ---- private helpers ----

  private _openDatabase(): Promise<IDBDatabase> {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_KV)) {
          db.createObjectStore(STORE_KV, { keyPath: 'key' });
        }
      };

      req.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
      req.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
    });
  }

  private _getStore(storeName: string, mode: IDBTransactionMode): IDBObjectStore {
    if (!this._db) throw new Error('[IndexedDbAdapter] 尚未初始化，請先呼叫 init()。');
    const tx = this._db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  }

  private _matchFilters(record: Record<string, unknown>, filters: StorageQueryFilter[]): boolean {
    for (const f of filters) {
      const fieldVal = record[f.field];
      switch (f.op) {
        case '==': if (fieldVal !== f.value) return false; break;
        case '!=': if (fieldVal === f.value) return false; break;
        case '>':  if ((fieldVal as number) <= (f.value as number)) return false; break;
        case '>=': if ((fieldVal as number) < (f.value as number)) return false; break;
        case '<':  if ((fieldVal as number) >= (f.value as number)) return false; break;
        case '<=': if ((fieldVal as number) > (f.value as number)) return false; break;
        case 'in':
          if (!Array.isArray(f.value) || !f.value.includes(fieldVal)) return false;
          break;
        case 'contains':
          if (typeof fieldVal !== 'string' || !fieldVal.includes(String(f.value))) return false;
          break;
      }
    }
    return true;
  }

  private _countRecords(): Promise<number> {
    const store = this._getStore(STORE_KV, 'readonly');
    return new Promise<number>((resolve, reject) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
}
