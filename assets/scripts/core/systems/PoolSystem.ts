// @spec-source → 見 docs/cross-reference-index.md
import { instantiate, Node, Prefab, NodePool, Vec3 } from "cc";

/**
 * 物件池系統
 *
 * 封裝 Cocos NodePool，以字串 key 管理多組池，支援預熱與模板複製。
 *
 * Unity 對照：
 *   register  ≈ ObjectPool<T>.Create() + 預熱
 *   acquire   ≈ _pool.Get()
 *   release   ≈ _pool.Release(go)
 *   warmupEffect ≈ 預做一次 Play 確保 GPU 資源上傳
 *   acquireFromTemplate ≈ Instantiate(template) 但帶池管理
 */
export class PoolSystem {
    private pools = new Map<string, NodePool>();
    private prefabs = new Map<string, Prefab>();

    // ─────────────────────────────────────────
    //  基礎 API
    // ─────────────────────────────────────────

    public register(key: string, prefab: Prefab, warmupCount = 0): void {
        const existingPool = this.pools.get(key);
        if (existingPool) {
            existingPool.clear();
        }

        const pool = existingPool ?? new NodePool();
        this.pools.set(key, pool);
        this.prefabs.set(key, prefab);

        for (let i = 0; i < warmupCount; i += 1) {
            pool.put(instantiate(prefab));
        }
    }

    public acquire(key: string): Node | null {
        const pool = this.pools.get(key);
        const prefab = this.prefabs.get(key);
        if (!pool || !prefab) return null;
        return pool.size() > 0 ? pool.get() : instantiate(prefab);
    }

    public release(key: string, node: Node): void {
        const pool = this.pools.get(key);
        if (!pool) {
            node.destroy();
            return;
        }
        node.active = false;
        pool.put(node);
    }

    public isRegistered(key: string): boolean {
        return this.pools.has(key);
    }

    // ─────────────────────────────────────────
    //  特效便捷方法
    // ─────────────────────────────────────────

    /**
     * 預熱特效：取出節點，播放一幀，然後回收。
     * 確保粒子貼圖和材質在首次正式使用前已上傳 GPU，避免首幀卡頓。
     *
     * Unity 對照：先 Instantiate + SetActive(true) 一幀後呼叫 ReturnToPool
     *
     * @param key      已 register 的 Prefab key
     * @param position 預熱位置（畫面外即可，例如 Vec3(9999,0,0)）
     */
    public warmupEffect(key: string, position: Vec3): void {
        const node = this.acquire(key);
        if (!node) return;
        node.setWorldPosition(position);
        node.active = true;
        // 給 GPU 一幀時間上傳資源後回收
        setTimeout(() => this.release(key, node), 650);
    }

    /**
     * 從現有節點複製（無需 Prefab 引用）。
     * 適合動態生成的節點需要重複實例化時使用。
     *
     * Unity 對照：Instantiate(templateGameObject) + 掛到 parent
     *
     * @param templateNode  作為模板的節點
     * @param parent        複製後的父節點（null = 不設定父節點）
     */
    public acquireFromTemplate(templateNode: Node, parent: Node | null): Node {
        const key = `__tpl_${templateNode.name}`;
        if (!this.pools.has(key)) {
            this.pools.set(key, new NodePool());
        }

        const pool = this.pools.get(key)!;
        const node = pool.size() > 0 ? (pool.get() ?? instantiate(templateNode)) : instantiate(templateNode);
        if (parent) {
            node.parent = parent;
        }
        node.active = true;
        return node;
    }

    // ─────────────────────────────────────────
    //  清理
    // ─────────────────────────────────────────

    public clear(): void {
        this.pools.forEach((pool) => {
            // 確保 NodePool 內的節點真正被摧毀，釋放記憶體
            pool.clear();
        });
        this.pools.clear();
        // 釋放對 Prefab 的引用（真正的資源釋放交由 ResourceManager 處理）
        this.prefabs.clear();
    }
}
