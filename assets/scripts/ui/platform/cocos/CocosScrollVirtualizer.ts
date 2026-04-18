// @spec-source → 見 docs/cross-reference-index.md  (UCUF M3)
/**
 * CocosScrollVirtualizer
 *
 * UCUF M3 — IScrollVirtualizer 的 Cocos Creator 3.x 具體實作。
 * Pool-based 虛擬捲動：固定 pool 大小，滾動時回收 off-screen items 並重用於 on-screen。
 *
 * 策略（M3 基礎版）：
 *   pool size = Math.ceil(viewportH / itemHeight) + bufferCount × 2
 *   滾動偏移 → 計算 startIndex → 回收超出 [start−buffer, end+buffer] 的 items →
 *   從 pool 取節點填充入視 items → 觸發 onItemRender(index, node)
 *
 * M8 效能優化時可替換為 InfinitePool 或 Windowed Scroll 策略。
 *
 * Unity 對照：RecyclingListView（Asset Store）/ UGUI ScrollRect + ObjectPool
 */
import { Node, UITransform, ScrollView, EventTouch, Vec2 } from 'cc';
import type { IScrollVirtualizer } from '../../core/interfaces/IScrollVirtualizer';
import type { NodeHandle } from '../../core/interfaces/INodeFactory';

// ─── 內部型別 ─────────────────────────────────────────────────────────────────

interface PoolItem {
    node:  Node;
    /** 目前對應的資料索引（-1 = 未使用） */
    index: number;
}

// ─── 主類別 ──────────────────────────────────────────────────────────────────

export class CocosScrollVirtualizer implements IScrollVirtualizer {

    onItemRender: ((index: number, node: NodeHandle) => void) | null = null;

    private _scrollView:   ScrollView | null = null;
    private _contentNode:  Node | null       = null;
    private _pool:         PoolItem[]         = [];
    private _totalCount    = 0;
    private _itemHeight    = 60;
    private _bufferCount   = 2;
    private _poolSize      = 0;
    private _scrollHandler: ((event: EventTouch, customData: string) => void) | null = null;

    // ── IScrollVirtualizer ──────────────────────────────────────────────────

    attach(scrollNode: NodeHandle, totalCount: number, itemHeight: number, bufferCount = 2): void {
        const svNode = scrollNode as Node;
        this._scrollView  = svNode.getComponent(ScrollView);
        if (!this._scrollView) {
            console.warn('[CocosScrollVirtualizer] scrollNode 上找不到 ScrollView 元件');
            return;
        }

        this._totalCount  = totalCount;
        this._itemHeight  = itemHeight;
        this._bufferCount = bufferCount;

        // Content 節點（ScrollView.content）
        this._contentNode = this._scrollView.content as Node | null;
        if (!this._contentNode) {
            console.warn('[CocosScrollVirtualizer] ScrollView.content 為 null');
            return;
        }

        // 設定 Content 高度 = 資料總高
        this._setContentHeight(totalCount);

        // 計算 pool 大小：可視高 / item 高 + 緩衝 × 2
        const viewportH  = svNode.getComponent(UITransform)?.height ?? 400;
        const visibleCnt = Math.ceil(viewportH / itemHeight);
        this._poolSize   = visibleCnt + bufferCount * 2;

        // 初始化 pool
        this._pool = [];
        for (let i = 0; i < this._poolSize; i++) {
            const node = new Node(`VItem_${i}`);
            const ut   = node.addComponent(UITransform);
            ut.setContentSize(this._contentNode.getComponent(UITransform)?.width ?? 400, itemHeight);
            this._pool.push({ node, index: -1 });
        }

        // 初始排版
        this._refresh();

        // 監聽 scroll 事件
        this._scrollHandler = () => this._refresh();
        this._scrollView.node.on(ScrollView.EventType.SCROLLING, this._scrollHandler, this);
    }

    detach(): void {
        if (this._scrollView && this._scrollHandler) {
            this._scrollView.node.off(ScrollView.EventType.SCROLLING, this._scrollHandler, this);
        }
        this.recycleAll();
        this._pool        = [];
        this._scrollView  = null;
        this._contentNode = null;
        this._scrollHandler = null;
    }

    updateData(totalCount: number): void {
        this._totalCount = totalCount;
        this._setContentHeight(totalCount);
        this._refresh();
    }

    getVisibleRange(): { start: number; end: number } {
        if (!this._scrollView || !this._contentNode) {
            return { start: 0, end: Math.min(this._poolSize - 1, this._totalCount - 1) };
        }
        const scrollOffset = Math.abs(this._scrollView.getScrollOffset().y);
        const viewportH    = this._scrollView.node.getComponent(UITransform)?.height ?? 400;
        const start = Math.max(0, Math.floor(scrollOffset / this._itemHeight) - this._bufferCount);
        const end   = Math.min(
            this._totalCount - 1,
            Math.ceil((scrollOffset + viewportH) / this._itemHeight) + this._bufferCount,
        );
        return { start, end };
    }

    recycleAll(): void {
        if (!this._contentNode) return;
        for (const item of this._pool) {
            if (item.index >= 0) {
                this._contentNode.removeChild(item.node);
                item.index = -1;
            }
        }
    }

    // ── 內部 ────────────────────────────────────────────────────────────────

    private _setContentHeight(count: number): void {
        if (!this._contentNode) return;
        const ut = this._contentNode.getComponent(UITransform);
        if (ut) ut.setContentSize(ut.width, count * this._itemHeight);
    }

    /**
     * 重新排列 on-screen items：
     *  1. 計算目前可視範圍 [start, end]
     *  2. 回收超出範圍的 pool items
     *  3. 填充尚未建立的索引位
     */
    private _refresh(): void {
        if (!this._contentNode || this._totalCount === 0) return;
        const { start, end } = this.getVisibleRange();

        // 回收超出範圍
        for (const item of this._pool) {
            if (item.index >= 0 && (item.index < start || item.index > end)) {
                this._contentNode.removeChild(item.node);
                item.index = -1;
            }
        }

        // 找出還沒對應節點的索引
        const rendered = new Set(this._pool.filter(p => p.index >= 0).map(p => p.index));
        for (let i = start; i <= end; i++) {
            if (rendered.has(i)) continue;
            const free = this._pool.find(p => p.index === -1);
            if (!free) break; // pool 耗盡（不應發生，pool 夠大）
            free.index = i;
            // 定位：Cocos ScrollView content 的 Y 軸從頂部往下，origin 在左上
            free.node.setPosition(0, -((i + 0.5) * this._itemHeight), 0);
            this._contentNode.addChild(free.node);
            this.onItemRender?.(i, free.node);
        }
    }
}
