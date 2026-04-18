// @spec-source → 見 docs/cross-reference-index.md  (UCUF M3)
/**
 * IScrollVirtualizer
 *
 * UCUF M3 — 虛擬捲動抽象介面。
 * 封裝 Pool-based 節點回收/重用邏輯，讓 ScrollListPanel 不需直接操作引擎 API。
 *
 * 核心概念（類 Unity RecyclingListView）：
 *   1. attach()       → 綁定 ScrollView，計算 pool size = visibleCount + bufferCount×2
 *   2. onItemRender   → ScrollListPanel 設定此 callback，負責填充每個 item 資料
 *   3. updateData()   → 資料筆數變化時通知 virtualizer，更新 Content 節點高度
 *   4. detach()       → 清空 pool，解除 scroll event（供 onUnmount 呼叫）
 *
 * 效能特性（M3 Pool-based）：
 *   - 固定 pool 大小；不論 totalCount 多大，DOM/Node 數量恆定
 *   - M8 效能優化里程碑可替換為動態 pool 或 Infinite scroll 策略
 *
 * Unity 對照：RecyclingListView / ObjectPool + ContentSizeFitter 組合
 */
import type { NodeHandle } from './INodeFactory';

export interface IScrollVirtualizer {

    /**
     * 掛載到 ScrollView 節點，初始化節點 pool。
     * @param scrollNode   ScrollView 節點的 NodeHandle
     * @param totalCount   目前資料總筆數
     * @param itemHeight   每個 item 的固定高度（像素）
     * @param bufferCount  可視範圍外上下各緩衝的 item 數（預設 2）
     */
    attach(scrollNode: NodeHandle, totalCount: number, itemHeight: number, bufferCount?: number): void;

    /**
     * 解除掛載：全部 pool item 回收，解除 scroll event listener。
     * ScrollListPanel.onUnmount() 時呼叫。
     */
    detach(): void;

    /**
     * 通知資料筆數更新。
     * virtualizer 重新計算 Content 節點高度，並重排可視 item。
     * @param totalCount  新的資料總筆數
     */
    updateData(totalCount: number): void;

    /**
     * Item 渲染回呼（由 ScrollListPanel 在 onMount 時設定）。
     * 每當 item 節點進入可視區域（或從 pool 重用）時觸發。
     * @param index  資料索引（0-based）
     * @param node   可複用的 item 節點 NodeHandle，由 ScrollListPanel 填入資料
     */
    onItemRender: ((index: number, node: NodeHandle) => void) | null;

    /**
     * 取得目前可視資料的索引範圍（含 buffer）。
     * @returns { start: number, end: number }，inclusive，可用於預取資料
     */
    getVisibleRange(): { start: number; end: number };

    /**
     * 全部回收：所有 on-screen item 歸回 pool，不觸發 onItemRender。
     * 在 detach() 前或資料完全清空時呼叫。
     */
    recycleAll(): void;
}
