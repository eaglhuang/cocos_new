import { JsonAsset, resources } from 'cc';
import { DataCatalog } from './DataCatalog';
import { DataStorageAdapter, StorageQueryFilter } from './DataStorageAdapter';

export interface PageCursor {
  offset: number;
  pageSize: number;
  hasMore: boolean;
}

export interface PageResult<T> {
  data: T[];
  cursor: PageCursor;
  elapsedMs: number;
}

export type LayerLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

export class DataPageLoader {
  private static _instance: DataPageLoader | null = null;

  private readonly _catalog: DataCatalog;
  private readonly _adapter: DataStorageAdapter | null;
  private readonly _detailCache = new Map<string, unknown>();
  private readonly _jsonCache = new Map<string, unknown[]>();

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

  async loadL1Active<T>(): Promise<PageResult<T>> {
    const startMs = Date.now();
    const activeEntries = this._catalog.getActivePage();
    const uids = activeEntries.map((entry) => entry.uid);

    if (this._adapter && uids.length > 0) {
      const data = await this._queryByIds<T>(uids);
      return {
        data,
        cursor: { offset: 0, pageSize: data.length, hasMore: false },
        elapsedMs: Date.now() - startMs,
      };
    }

    const allData = await this._loadJsonArrayCached<T & { id?: string }>('data/generals');
    const data = allData.filter((item) => {
      const id = (item as Record<string, unknown>).id as string | undefined;
      return !!id && uids.includes(id);
    }) as T[];

    return {
      data,
      cursor: { offset: 0, pageSize: data.length, hasMore: false },
      elapsedMs: Date.now() - startMs,
    };
  }

  async loadL2Page<T>(cursor: PageCursor | null, faction?: string): Promise<PageResult<T>> {
    const startMs = Date.now();
    const pageSize = cursor?.pageSize ?? 20;
    const offset = cursor?.offset ?? 0;

    const entries = this._catalog.search(faction ? { faction } : {});
    const total = entries.length;
    const pageEntries = entries.slice(offset, offset + pageSize);
    const uids = pageEntries.map((entry) => entry.uid);

    const data = this._adapter
      ? await this._queryByIds<T>(uids)
      : (await this._loadJsonArrayCached<T & { id?: string }>('data/generals')).filter((item) => {
          const id = (item as Record<string, unknown>).id as string | undefined;
          return !!id && uids.includes(id);
        }) as T[];

    const nextOffset = offset + pageSize;
    return {
      data,
      cursor: {
        offset: nextOffset,
        pageSize,
        hasMore: nextOffset < total,
      },
      elapsedMs: Date.now() - startMs,
    };
  }

  async loadL3Detail<T>(uid: string): Promise<T | null> {
    if (this._detailCache.has(uid)) {
      return this._detailCache.get(uid) as T;
    }

    const allData = await this._loadJsonArrayCached<T & { id?: string }>('data/generals');
    const found = allData.find((item) => {
      const id = (item as Record<string, unknown>).id as string | undefined;
      return id === uid;
    }) ?? null;

    if (found) {
      this._detailCache.set(uid, found);
    }
    return found as T | null;
  }

  async loadLayerData<T>(uid: string, layer: 'L4' | 'L5'): Promise<T | null> {
    const cacheKey = `${layer}:${uid}`;
    if (this._detailCache.has(cacheKey)) {
      return this._detailCache.get(cacheKey) as T;
    }

    const resourcePath = layer === 'L4' ? 'data/master/generals-stories' : 'data/master/generals-base';
    const allData = await this._loadJsonArrayCached<T & { id?: string }>(resourcePath);
    const found = allData.find((item) => {
      const id = (item as Record<string, unknown>).id as string | undefined;
      return id === uid;
    }) ?? null;

    if (found) {
      this._detailCache.set(cacheKey, found);
    }
    return found as T | null;
  }

  clearCache(): void {
    this._detailCache.clear();
    this._jsonCache.clear();
  }

  private async _queryByIds<T>(uids: string[]): Promise<T[]> {
    if (!this._adapter || uids.length === 0) {
      return [];
    }

    const filters: StorageQueryFilter[] = [{ field: 'id', op: 'in', value: uids }];
    return this._adapter.query<T>('generals', filters);
  }

  private async _loadJsonArrayCached<T>(resourcePath: string): Promise<T[]> {
    if (this._jsonCache.has(resourcePath)) {
      return this._jsonCache.get(resourcePath) as T[];
    }

    const data = await this._loadJsonArray<T>(resourcePath);
    this._jsonCache.set(resourcePath, data as unknown[]);
    return data;
  }

  private _loadJsonArray<T>(resourcePath: string): Promise<T[]> {
    return new Promise<T[]>((resolve) => {
      resources.load(resourcePath, JsonAsset, (err, asset) => {
        if (err || !asset) {
          console.warn(`[DataPageLoader] load failed: ${resourcePath}`, err);
          resolve([]);
          return;
        }

        const json = asset.json as { data?: T[] } | T[];
        if (Array.isArray(json)) {
          resolve(json);
          return;
        }

        if (json && typeof json === 'object' && Array.isArray((json as { data?: T[] }).data)) {
          resolve((json as { data: T[] }).data);
          return;
        }

        resolve([]);
      });
    });
  }
}
