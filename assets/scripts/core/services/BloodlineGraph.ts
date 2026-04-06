/**
 * BloodlineGraph.ts
 * 
 * 血統圖服務 — 從 PersonRegistry 提供祖先查詢、EP 計算、後代查詢。
 * 
 * Unity 對照：類似一個自定義的 Graph Traversal System，
 * 以 Dictionary<uid, PersonRecord> 取代嵌套 ScriptableObject 樹，
 * 等同於把 GameObject 樹壓平成 Adjacency List 的圖走訪問題。
 * 
 * 記憶體優勢：
 *   5 代 500 位 + 2000 虛擬祖先，扁平結構 < 嵌套結構的 30% 記憶體使用量。
 *   （嵌套時每個節點含完整 GeneralConfig copy；扁平只存 uid + 輕量 PersonRecord）
 */

import { resources, JsonAsset } from 'cc';
import { PersonRecord, BloodlineLink, PersonRegistryData } from '../models/PersonRegistry';

export class BloodlineGraph {
  private static _instance: BloodlineGraph | null = null;

  /** uid → PersonRecord 的快速索引 */
  private _persons: Map<string, PersonRecord> = new Map();
  /** child_uid → BloodlineLink[] 的出邊索引（向上查祖先） */
  private _parentLinks: Map<string, BloodlineLink[]> = new Map();
  /** parent_uid → BloodlineLink[] 的入邊索引（向下查後代） */
  private _childLinks: Map<string, BloodlineLink[]> = new Map();

  private _loaded = false;

  static getInstance(): BloodlineGraph {
    if (!BloodlineGraph._instance) {
      BloodlineGraph._instance = new BloodlineGraph();
    }
    return BloodlineGraph._instance;
  }

  /** 是否已載入 */
  get isLoaded(): boolean {
    return this._loaded;
  }

  /** 載入 person-registry.json */
  async loadRegistry(force = false): Promise<void> {
    if (this._loaded && !force) return;
    const data = await this._loadJson<PersonRegistryData>('data/person-registry');
    if (!data) {
      console.warn('[BloodlineGraph] person-registry.json 不存在或為空。');
      this._loaded = true;
      return;
    }

    this._persons.clear();
    this._parentLinks.clear();
    this._childLinks.clear();

    for (const p of data.persons ?? []) {
      this._persons.set(p.uid, p);
    }

    for (const link of data.links ?? []) {
      if (!this._parentLinks.has(link.child_uid)) {
        this._parentLinks.set(link.child_uid, []);
      }
      this._parentLinks.get(link.child_uid)!.push(link);

      if (!this._childLinks.has(link.parent_uid)) {
        this._childLinks.set(link.parent_uid, []);
      }
      this._childLinks.get(link.parent_uid)!.push(link);
    }

    this._loaded = true;
  }

  /**
   * 取得指定武將的祖先 uid 鏈（BFS 廣度優先，按世代排列）。
   * @param uid 武將 uid
   * @param depth 最大世代深度（預設 3，涵蓋 14 位祖先）
   * @returns 祖先 uid 陣列（含指定深度內所有祖先，由近至遠）
   */
  getAncestorChain(uid: string, depth = 3): string[] {
    const result: string[] = [];
    const queue: Array<{ uid: string; gen: number }> = [{ uid, gen: 0 }];
    const visited = new Set<string>([uid]);

    while (queue.length > 0) {
      const { uid: current, gen } = queue.shift()!;
      if (gen >= depth) continue;

      const parents = this._parentLinks.get(current) ?? [];
      for (const link of parents) {
        if (!visited.has(link.parent_uid)) {
          visited.add(link.parent_uid);
          result.push(link.parent_uid);
          queue.push({ uid: link.parent_uid, gen: gen + 1 });
        }
      }
    }

    return result;
  }

  /**
   * 計算武將的血統 EP（根據 PersonRegistry 的 ep_base 遞迴加權）。
   * 公式：本人 ep_base + Σ(祖先 ep_base * 0.5^世代)
   * @param uid 武將 uid
   * @param maxDepth 計算深度（預設 3）
   */
  calculateEP(uid: string, maxDepth = 3): number {
    const person = this._persons.get(uid);
    if (!person) return 0;

    let totalEP = person.ep_base;
    const queue: Array<{ uid: string; gen: number }> = [{ uid, gen: 0 }];
    const visited = new Set<string>([uid]);

    while (queue.length > 0) {
      const { uid: current, gen } = queue.shift()!;
      if (gen >= maxDepth) continue;

      const parents = this._parentLinks.get(current) ?? [];
      for (const link of parents) {
        if (!visited.has(link.parent_uid)) {
          visited.add(link.parent_uid);
          const ancestor = this._persons.get(link.parent_uid);
          if (ancestor) {
            const weight = Math.pow(0.5, gen + 1);
            totalEP += ancestor.ep_base * weight;
          }
          queue.push({ uid: link.parent_uid, gen: gen + 1 });
        }
      }
    }

    return Math.round(totalEP);
  }

  /**
   * 取得指定武將的所有後代 uid 陣列。
   * @param uid 武將 uid
   * @param maxDepth 最大深度（預設 3）
   */
  getDescendants(uid: string, maxDepth = 3): string[] {
    const result: string[] = [];
    const queue: Array<{ uid: string; gen: number }> = [{ uid, gen: 0 }];
    const visited = new Set<string>([uid]);

    while (queue.length > 0) {
      const { uid: current, gen } = queue.shift()!;
      if (gen >= maxDepth) continue;

      const children = this._childLinks.get(current) ?? [];
      for (const link of children) {
        if (!visited.has(link.child_uid)) {
          visited.add(link.child_uid);
          result.push(link.child_uid);
          queue.push({ uid: link.child_uid, gen: gen + 1 });
        }
      }
    }

    return result;
  }

  /**
   * 依 uid 查詢 PersonRecord。
   */
  getPerson(uid: string): PersonRecord | null {
    return this._persons.get(uid) ?? null;
  }

  /** 清除快取 */
  clear(): void {
    this._persons.clear();
    this._parentLinks.clear();
    this._childLinks.clear();
    this._loaded = false;
  }

  // ---- private helpers ----

  private _loadJson<T>(path: string): Promise<T | null> {
    return new Promise<T | null>((resolve) => {
      resources.load(path, JsonAsset, (err, asset) => {
        if (err) {
          resolve(null);
          return;
        }
        resolve(asset.json as T);
      });
    });
  }
}
