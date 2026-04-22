// @spec-source → 見 docs/cross-reference-index.md
import { Asset, assetManager, AssetManager, Font, ImageAsset, JsonAsset, Prefab, Rect, resources, SpriteFrame, Texture2D } from "cc";
import { MemoryManager } from "./MemoryManager";

export interface LoadOptions {
    tags?: string[];
  preferTextureFallback?: boolean;
}

export class ResourceManager {
  // 將 Cache 改為儲存原本的 Asset 物件，並將快取鍵值對應 Asset
  private jsonCache = new Map<string, JsonAsset>();
  private prefabCache = new Map<string, Prefab>();
  private spriteFrameCache = new Map<string, SpriteFrame[]>();
  private singleSpriteFrameCache = new Map<string, SpriteFrame>();
  private fontCache = new Map<string, Font>();
  
  // 管理資源綁定的標籤
  private pathTags = new Map<string, Set<string>>();

  /** 連動的記憶體管理器（由 ServiceLoader.initialize() 注入） */
  private memoryManager: MemoryManager | null = null;

  /**
   * 注入 MemoryManager，讓所有資源的 load/release 操作都通報記憶體管理器。
   * 由 ServiceLoader.initialize() 呼叫，不需要手動呼叫。
   */
  public bindMemoryManager(mm: MemoryManager): void {
    this.memoryManager = mm;
  }

  private normalizeResourcePath(path: string): string {
    return path
      .trim()
      .replace(/\\/g, '/')
      .replace(/^db:\/\/assets\/resources\//i, '')
      .replace(/^assets\/resources\//i, '')
      .replace(/^resources\//i, '')
      .replace(/^\/+/, '')
      .replace(/\.(png|jpg|jpeg|webp)$/i, '')
      .replace(/\/+/g, '/');
  }

  private buildSpriteFrameCandidates(path: string): string[] {
    const normalizedPath = this.normalizeResourcePath(path);
    const basePath = normalizedPath.replace(/\/spriteFrame$/, '');
    const candidates = new Set<string>();

    if (normalizedPath.endsWith('/spriteFrame')) {
      candidates.add(normalizedPath);
      candidates.add(basePath);
      candidates.add(`${basePath}.png`);
      candidates.add(`${basePath}.png/spriteFrame`);
    } else {
      candidates.add(normalizedPath);
      candidates.add(`${basePath}/spriteFrame`);
      candidates.add(`${basePath}.png`);
      candidates.add(`${basePath}.png/spriteFrame`);
    }

    return [...candidates].filter(candidate => candidate.length > 0);
  }

  private buildTextureCandidates(path: string): string[] {
    const normalizedPath = this.normalizeResourcePath(path);
    const basePath = normalizedPath.replace(/\/spriteFrame$/, '');
    if (!basePath) {
      return [];
    }

    const candidates = new Set<string>();
    candidates.add(basePath);
    candidates.add(`${basePath}/texture`);
    candidates.add(`${basePath}.png`);
    candidates.add(`${basePath}.png/texture`);
    return [...candidates];
  }

  /**
   * 將路徑加上指定標籤
   */
  private tagAsset(path: string, tags?: string[]) {
    if (!tags || tags.length === 0) return;
    if (!this.pathTags.has(path)) {
      this.pathTags.set(path, new Set());
    }
    const set = this.pathTags.get(path)!;
    tags.forEach(t => set.add(t));
  }

  public loadJson<T = any>(path: string, options?: LoadOptions): Promise<T> {
    this.tagAsset(path, options?.tags);
    const cached = this.jsonCache.get(path);
    if (cached) {
      return Promise.resolve(cached.json as T);
    }

    return new Promise((resolve, reject) => {
      resources.load(path, JsonAsset, (error, asset) => {
        if (error || !asset) {
          reject(error || new Error(`load json failed: ${path}`));
          return;
        }

        asset.addRef();
        this.jsonCache.set(path, asset);
        this.memoryManager?.notifyLoaded(path, 'resources', 'JsonAsset');
        resolve(asset.json as T);
      });
    });
  }

  public loadPrefab(path: string, options?: LoadOptions): Promise<Prefab> {
    this.tagAsset(path, options?.tags);
    const cached = this.prefabCache.get(path);
    if (cached) {
      return Promise.resolve(cached);
    }

    return new Promise((resolve, reject) => {
      resources.load(path, Prefab, (error, asset) => {
        if (error || !asset) {
          reject(error || new Error(`load prefab failed: ${path}`));
          return;
        }

        asset.addRef();
        this.prefabCache.set(path, asset);
        this.memoryManager?.notifyLoaded(path, 'resources', 'Prefab');
        resolve(asset);
      });
    });
  }

  /**
   * 從指定 bundle 載入 Prefab（非 resources bundle）。
   * Unity 對照：Addressables.LoadAssetAsync<GameObject>(key) 從指定 Group 載入。
   */
  public loadBundlePrefab(bundleName: string, path: string, options?: LoadOptions): Promise<Prefab> {
    const cacheKey = `${bundleName}:${path}`;
    this.tagAsset(cacheKey, options?.tags);
    const cached = this.prefabCache.get(cacheKey);
    if (cached) {
      return Promise.resolve(cached);
    }

    return new Promise((resolve, reject) => {
      const doLoad = (bundle: AssetManager.Bundle) => {
        bundle.load(path, Prefab, (error, asset) => {
          if (error || !asset) {
            reject(error || new Error(`load bundle prefab failed: ${bundleName}:${path}`));
            return;
          }
          asset.addRef();
          this.prefabCache.set(cacheKey, asset);
          this.memoryManager?.notifyLoaded(cacheKey, bundleName, 'Prefab');
          resolve(asset);
        });
      };

      const existing = assetManager.getBundle(bundleName);
      if (existing) {
        doLoad(existing);
      } else {
        assetManager.loadBundle(bundleName, (err, bundle) => {
          if (err || !bundle) {
            reject(err || new Error(`loadBundle failed: ${bundleName}`));
            return;
          }
          doLoad(bundle);
        });
      }
    });
  }

  public loadSpriteFrames(path: string, options?: LoadOptions): Promise<SpriteFrame[]> {
    this.tagAsset(path, options?.tags);
    const cached = this.spriteFrameCache.get(path);
    if (cached) {
      return Promise.resolve(cached.slice());
    }

    return new Promise((resolve, reject) => {
      resources.loadDir(path, SpriteFrame, (error, assets) => {
        if (error) {
          reject(error);
          return;
        }

        const validAssets = assets || [];
        validAssets.forEach(asset => asset.addRef());
        this.spriteFrameCache.set(path, validAssets);
        this.memoryManager?.notifyLoaded(path, 'resources', 'SpriteFrame[]');
        resolve(validAssets.slice());
      });
    });
  }

  public loadSpriteFrame(path: string, options?: LoadOptions): Promise<SpriteFrame> {
    this.tagAsset(path, options?.tags);

    const normalizedPath = this.normalizeResourcePath(path);
    const cacheKey = normalizedPath.endsWith('/spriteFrame') ? normalizedPath : `${normalizedPath}/spriteFrame`;
    const spriteFrameCandidates = this.buildSpriteFrameCandidates(path);
    const textureCandidates = this.buildTextureCandidates(path);
    const preferTextureFallback = !!options?.preferTextureFallback && !normalizedPath.endsWith('/spriteFrame');

    const cached = this.singleSpriteFrameCache.get(cacheKey);
    if (cached) return Promise.resolve(cached);

    return new Promise((resolve, reject) => {
      const failures: string[] = [];

      const tryLoadTexture = (index: number) => {
        if (index >= textureCandidates.length) {
          reject(new Error(`load spriteFrame failed: ${cacheKey} (raw: ${path}) | attempts=${failures.join(' ; ')}`));
          return;
        }

        const candidate = textureCandidates[index];
        resources.load(candidate, Texture2D, (textureError, textureAsset) => {
          if (textureError || !textureAsset) {
            failures.push(`Texture2D:${candidate}`);
            tryLoadTexture(index + 1);
            return;
          }

          const frame = new SpriteFrame();
          frame.packable = false;
          const width = Math.max(1, (textureAsset as any).width ?? 0);
          const height = Math.max(1, (textureAsset as any).height ?? 0);
          frame.rect = new Rect(0, 0, width, height);
          if (!(textureAsset as any).loaded) {
            (textureAsset as any).loaded = true;
          }
          frame.texture = textureAsset;
          frame.name = candidate.split('/').pop() ?? 'generated-sprite-frame';
          frame.addRef();
          this.singleSpriteFrameCache.set(cacheKey, frame);
          this.memoryManager?.notifyLoaded(cacheKey, 'resources', 'SpriteFrame(Texture2D fallback)');
          resolve(frame);
        });
      };

      const tryLoadSpriteFrame = (index: number) => {
        if (index >= spriteFrameCandidates.length) {
          tryLoadTexture(0);
          return;
        }

        const candidate = spriteFrameCandidates[index];
        resources.load(candidate, SpriteFrame, (error, asset) => {
          if (error || !asset) {
            failures.push(`SpriteFrame:${candidate}`);
            tryLoadSpriteFrame(index + 1);
            return;
          }

          asset.addRef();
          this.singleSpriteFrameCache.set(cacheKey, asset);
          this.memoryManager?.notifyLoaded(cacheKey, 'resources', 'SpriteFrame');
          resolve(asset);
        });
      };

      if (preferTextureFallback) {
        tryLoadTexture(0);
        return;
      }

      tryLoadSpriteFrame(0);
    });
  }

  public loadFont(path: string, options?: LoadOptions): Promise<Font> {
    this.tagAsset(path, options?.tags);
    const cached = this.fontCache.get(path);
    if (cached) return Promise.resolve(cached);

    return new Promise((resolve, reject) => {
      resources.load(path, Font, (error, font) => {
        if (error || !font) {
          reject(error || new Error(`load font failed: ${path}`));
          return;
        }
        font.addRef();
        this.fontCache.set(path, font);
        this.memoryManager?.notifyLoaded(path, 'resources', 'Font');
        resolve(font);
      });
    });
  }

  public loadImageAsset(path: string, options?: LoadOptions): Promise<ImageAsset> {
    this.tagAsset(path, options?.tags);
    return new Promise((resolve, reject) => {
      resources.load(path, ImageAsset, (error, asset) => {
        if (error || !asset) {
          reject(error || new Error(`load image asset failed: ${path}`));
          return;
        }
        // ImageAsset 通常不直接 addRef，但為了記帳通報
        this.memoryManager?.notifyLoaded(path, 'resources', 'ImageAsset');
        resolve(asset);
      });
    });
  }

  public releaseAsset(path: string): void {
    let released = false;
    const spriteFrameCandidates = this.buildSpriteFrameCandidates(path);
    if (this.jsonCache.has(path)) {
      this.jsonCache.get(path)?.decRef();
      this.jsonCache.delete(path);
      released = true;
    }
    if (this.prefabCache.has(path)) {
      this.prefabCache.get(path)?.decRef();
      this.prefabCache.delete(path);
      released = true;
    }
    if (this.spriteFrameCache.has(path)) {
      this.spriteFrameCache.get(path)?.forEach(asset => asset.decRef());
      this.spriteFrameCache.delete(path);
      released = true;
    }
    if (this.fontCache.has(path)) {
      this.fontCache.get(path)?.decRef();
      this.fontCache.delete(path);
      released = true;
    }
    spriteFrameCandidates.forEach(candidate => {
      const asset = this.singleSpriteFrameCache.get(candidate);
      if (!asset) {
        return;
      }
      asset.decRef();
      this.singleSpriteFrameCache.delete(candidate);
      this.memoryManager?.notifyReleased(candidate);
      released = true;
    });
    
    if (released) {
      this.pathTags.delete(path);
      this.memoryManager?.notifyReleased(path);
    }
  }

  /**
   * 根據單一標籤，全域釋放符合該標籤的所有資源
   */
  public releaseByTag(tag: string): void {
    const pathsToRelease: string[] = [];
    this.pathTags.forEach((tags, path) => {
      if (tags.has(tag)) {
        pathsToRelease.push(path);
      }
    });

    pathsToRelease.forEach(path => {
      this.releaseAsset(path);
    });
  }

  /**
   * 強制釋放指定路徑的資源（忽略 ref-count，直接從快取清除並通知 assetManager 釋放）。
   * 主要供 MemoryManager 在記憶體壓力時呼叫（M8 P3 onEvict 流程）。
   *
   * 與 releaseAsset() 的差異：
   *   - releaseAsset: 呼叫 asset.decRef()（仍走 ref-count 機制）
   *   - forceRelease:  直接從快取刪除 + assetManager.releaseAsset（繞過 ref-count）
   *
   * Unity 對照：Resources.UnloadAsset(asset)
   */
  public forceRelease(path: string): void {
    const tryRelease = (asset: Asset | undefined | null): void => {
      if (asset) {
        try { assetManager.releaseAsset(asset); } catch { /* silent */ }
      }
    };

    if (this.jsonCache.has(path)) {
      tryRelease(this.jsonCache.get(path));
      this.jsonCache.delete(path);
    }
    if (this.prefabCache.has(path)) {
      tryRelease(this.prefabCache.get(path));
      this.prefabCache.delete(path);
    }
    if (this.spriteFrameCache.has(path)) {
      this.spriteFrameCache.get(path)?.forEach(a => tryRelease(a));
      this.spriteFrameCache.delete(path);
    }
    if (this.fontCache.has(path)) {
      tryRelease(this.fontCache.get(path));
      this.fontCache.delete(path);
    }
    // singleSpriteFrameCache 可能以衍生 cacheKey 存入，逐一掃描
    for (const [key, frame] of this.singleSpriteFrameCache) {
      if (key === path || key.startsWith(`${path}/`)) {
        tryRelease(frame);
        this.singleSpriteFrameCache.delete(key);
      }
    }

    this.pathTags.delete(path);
    this.memoryManager?.notifyReleased(path);
  }

  // ─── DC-2-0004: 分層分頁載入 API ──────────────────────────────────────────

  private _pageLoader: import('../storage/DataPageLoader').DataPageLoader | null = null;

  /**
   * 注入 DataPageLoader（由 ServiceLoader.initialize() 呼叫）。
   * Unity 對照：相當於在 GameManager 中注入 Addressables IResourceLocator。
   */
  public bindPageLoader(loader: import('../storage/DataPageLoader').DataPageLoader): void {
    this._pageLoader = loader;
  }

  /**
   * 分層分頁載入武將資料。統一對外暴露分層載入接口，底層委託 DataPageLoader。
   *
   * Unity 對照：Addressables.LoadAssetsAsync<T>(label, callback)，
   * 搭配課程 Group / layer 來控制何時載入哪批資源。
   *
   * @param layer  層級：'L1'（陣容）| 'L2'（倉庫分頁）| 'L3'（詳情）| 'L4'（故事）| 'L5'（基因）
   * @param page   L2 使用的 page 編號（0-based），其他層忽略；負數表示接續上一頁 cursor
   * @param options 可選：{ uid?: string; faction?: string }
   * @returns PageResult<T> 分頁結果（含 data + cursor + elapsedMs）
   * @throws 若 DataPageLoader 未初始化（bindPageLoader 尚未呼叫）則丟出 Error
   */
  public async loadPagedData<T>(
    layer: import('../storage/DataPageLoader').LayerLevel,
    page: number = 0,
    options?: { uid?: string; faction?: string }
  ): Promise<import('../storage/DataPageLoader').PageResult<T>> {
    if (!this._pageLoader) {
      throw new Error(
        '[ResourceManager] loadPagedData: DataPageLoader 未初始化，請先呼叫 bindPageLoader()。'
      );
    }

    switch (layer) {
      case 'L1':
        return this._pageLoader.loadL1Active<T>();

      case 'L2': {
        const pageSize = 20;
        const cursor = page > 0
          ? { offset: page * pageSize, pageSize, hasMore: true }
          : null;
        return this._pageLoader.loadL2Page<T>(cursor, options?.faction);
      }

      case 'L3': {
        const uid = options?.uid;
        if (!uid) throw new Error('[ResourceManager] loadPagedData L3 需要 options.uid');
        const detail = await this._pageLoader.loadL3Detail<T>(uid);
        return {
          data: detail ? [detail] : [],
          cursor: { offset: 0, pageSize: 1, hasMore: false },
          elapsedMs: 0,
        };
      }

      case 'L4':
      case 'L5': {
        const uid = options?.uid;
        if (!uid) throw new Error(`[ResourceManager] loadPagedData ${layer} 需要 options.uid`);
        const data = await this._pageLoader.loadLayerData<T>(uid, layer);
        return {
          data: data ? [data] : [],
          cursor: { offset: 0, pageSize: 1, hasMore: false },
          elapsedMs: 0,
        };
      }

      default:
        throw new Error(`[ResourceManager] loadPagedData: 未知 layer "${String(layer)}"`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  /** Returns current cache entry counts for observability / debug. */
  public getCacheStats(): {
    json: number;
    prefab: number;
    spriteFrames: number;
    singleSpriteFrame: number;
    font: number;
    total: number;
  } {
    const json = this.jsonCache.size;
    const prefab = this.prefabCache.size;
    const spriteFrames = this.spriteFrameCache.size;
    const singleSpriteFrame = this.singleSpriteFrameCache.size;
    const font = this.fontCache.size;
    return { json, prefab, spriteFrames, singleSpriteFrame, font, total: json + prefab + spriteFrames + singleSpriteFrame + font };
  }

  public clearCache(): void {
    this.jsonCache.forEach((_, path) => this.memoryManager?.notifyReleased(path));
    this.jsonCache.forEach(asset => asset.decRef());
    this.jsonCache.clear();

    this.prefabCache.forEach((_, path) => this.memoryManager?.notifyReleased(path));
    this.prefabCache.forEach(asset => asset.decRef());
    this.prefabCache.clear();

    this.spriteFrameCache.forEach((_, path) => this.memoryManager?.notifyReleased(path));
    this.spriteFrameCache.forEach(assets => assets.forEach(asset => asset.decRef()));
    this.spriteFrameCache.clear();

    this.fontCache.forEach((_, path) => this.memoryManager?.notifyReleased(path));
    this.fontCache.forEach(font => font.decRef());
    this.fontCache.clear();
    
    this.singleSpriteFrameCache.forEach((_, path) => this.memoryManager?.notifyReleased(path));
    this.singleSpriteFrameCache.forEach(asset => asset.decRef());
    this.singleSpriteFrameCache.clear();
    
    // 清除標籤紀錄
    this.pathTags.clear();
  }
}
