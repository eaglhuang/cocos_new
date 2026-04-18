/**
 * UINodePool — Fragment Node 物件池
 *
 * 以 fragmentId 為桶（bucket）儲存已卸載的 Cocos 節點，
 * 供 CompositePanel.switchSlot() 重複利用節點，避免反覆 destroy / _buildNode。
 *
 * 使用規則：
 *   - release  : 從父節點移除、停用節點，放入對應桶；超出 maxPerBucket 時丟棄
 *   - acquire  : 取出桶內第一個節點（null 代表池空，需重建）
 *   - clear    : 全部丟棄已停用節點（unmount 或 dispose 時呼叫）
 *
 * Unity 對照：ObjectPool<T>（UnityEngine.Pool）
 */
import { Node } from 'cc';

/** 每個 fragmentId 最多保留的備用節點數 */
const MAX_PER_BUCKET = 3;

export class UINodePool {

    /** key = fragmentId，value = 已停用的備用節點列表 */
    private readonly _buckets = new Map<string, Node[]>();

    /**
     * 從池中取出指定 fragmentId 的節點（reuse）。
     * @returns 節點（已從池移除，尚未重新掛載）；池空時回傳 null
     */
    acquire(fragmentId: string): Node | null {
        const bucket = this._buckets.get(fragmentId);
        if (!bucket || bucket.length === 0) return null;
        const node = bucket.pop()!;
        node.active = true;
        return node;
    }

    /**
     * 將節點歸還池中（停用並從父節點卸除）。
     * @param fragmentId 此節點對應的 fragment id
     * @param node       要回收的節點
     */
    release(fragmentId: string, node: Node): void {
        // 先從父節點卸除，避免 GC 時仍在同一棵樹中
        node.removeFromParent();
        node.active = false;

        let bucket = this._buckets.get(fragmentId);
        if (!bucket) {
            bucket = [];
            this._buckets.set(fragmentId, bucket);
        }

        if (bucket.length < MAX_PER_BUCKET) {
            bucket.push(node);
        } else {
            // 超出上限，直接銷毀
            node.destroy();
        }
    }

    /**
     * 清空所有桶，銷毀所有已停用節點。
     * 應在 CompositePanel.unmount() / dispose() 時呼叫。
     */
    clear(): void {
        for (const bucket of this._buckets.values()) {
            for (const node of bucket) {
                node.destroy();
            }
        }
        this._buckets.clear();
    }
}
