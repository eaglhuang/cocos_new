import { Asset, Font, JsonAsset, Prefab, resources, SpriteFrame } from "cc";

export class ResourceManager {
  // 將 Cache 改為儲存原本的 Asset 物件，並將快取鍵值對應 Asset
  private jsonCache = new Map<string, JsonAsset>();
  private prefabCache = new Map<string, Prefab>();
  private spriteFrameCache = new Map<string, SpriteFrame[]>();
  private fontCache = new Map<string, Font>();

  public loadJson<T = any>(path: string): Promise<T> {
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
        resolve(asset.json as T);
      });
    });
  }

  public loadPrefab(path: string): Promise<Prefab> {
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
        resolve(asset);
      });
    });
  }

  public loadSpriteFrames(path: string): Promise<SpriteFrame[]> {
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
        resolve(validAssets.slice());
      });
    });
  }

  /**
   * 釋放指定路徑的資源，呼叫 decRef() 交由 Cocos GC 處理
   */
  /**
   * 載入字型，結果快取，使用 addRef 防止 GC
   * 取用後由 releaseAsset 或 clearCache 釋放
   */
  public loadFont(path: string): Promise<Font> {
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
        resolve(font);
      });
    });
  }

  public releaseAsset(path: string): void {
    if (this.jsonCache.has(path)) {
      this.jsonCache.get(path)?.decRef();
      this.jsonCache.delete(path);
    }
    if (this.prefabCache.has(path)) {
      this.prefabCache.get(path)?.decRef();
      this.prefabCache.delete(path);
    }
    if (this.spriteFrameCache.has(path)) {
      this.spriteFrameCache.get(path)?.forEach(asset => asset.decRef());
      this.spriteFrameCache.delete(path);
    }
    if (this.fontCache.has(path)) {
      this.fontCache.get(path)?.decRef();
      this.fontCache.delete(path);
    }
  }

  /**
   * 清空並釋放所有已快取的資源
   */
  public clearCache(): void {
    this.jsonCache.forEach(asset => asset.decRef());
    this.jsonCache.clear();

    this.prefabCache.forEach(asset => asset.decRef());
    this.prefabCache.clear();

    this.spriteFrameCache.forEach(assets => assets.forEach(asset => asset.decRef()));
    this.spriteFrameCache.clear();

    this.fontCache.forEach(font => font.decRef());
    this.fontCache.clear();
  }
}