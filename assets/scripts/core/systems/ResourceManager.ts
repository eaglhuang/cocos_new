// @spec-source → 見 docs/cross-reference-index.md
import { Asset, assetManager, AssetManager, Font, ImageAsset, JsonAsset, Prefab, resources, SpriteFrame, Texture2D } from "cc";
import { MemoryManager } from "./MemoryManager";

export interface LoadOptions {
    tags?: string[];
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
    } else {
      candidates.add(normalizedPath);
      candidates.add(`${basePath}/spriteFrame`);
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
          frame.texture = textureAsset;
          // 防禦性檢查：確保 textureAsset 存在且有內容，避免 _applySpriteSize 報錯
          if (textureAsset && (textureAsset as any).width !== undefined) {
             frame.name = candidate.split('/').pop() ?? 'generated-sprite-frame';
          } else {
             frame.name = 'invalid-frame';
          }
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
