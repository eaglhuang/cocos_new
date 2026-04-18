// @spec-source → 見 docs/cross-reference-index.md  (UCUF M3)
/**
 * ScrollListPanel
 *
 * UCUF M3 — 虛擬捲動列表 ChildPanel，委託 IScrollVirtualizer 管理 pool-based 節點回收。
 *
 * 資料格式（dataSource 由建構子指定，預設 'listItems'）：
 *   ```json
 *   [
 *     { "icon": "skill_fire",    "name": "烈焰衝", "desc": "對敵陣..." },
 *     { "icon": "skill_thunder", "name": "雷霆斬", "desc": "..." },
 *     ...
 *   ]
 *   ```
 *
 * 視覺行為：
 *   - onMount 時讀取 spec.itemHeight / spec.bufferCount，並呼叫 virtualizer.attach()
 *   - onDataUpdate 時只呼叫 virtualizer.updateData()，不直接操作節點
 *   - virtualizer 觸發 onItemRender(index, node) 時，呼叫此 panel 的 _fillItem()
 *   - onUnmount 時呼叫 virtualizer.detach()
 *
 * 子類可覆寫 _fillItem() 以加入業務邏輯（如設定 Label/Sprite）。
 * 不直接 import cc 渲染元件（H-04 合規）。
 *
 * Unity 對照：RecyclingListView + ContentFiller delegate
 */
import type { Node } from 'cc';
import { ChildPanelBase } from '../ChildPanelBase';
import type { UISkinResolver } from '../UISkinResolver';
import type { UITemplateBinder } from '../UITemplateBinder';

export class ScrollListPanel extends ChildPanelBase {

    override dataSource: string;

    private _items:       Record<string, unknown>[] = [];
    private _itemHeight   = 60;
    private _bufferCount  = 2;

    constructor(
        hostNode: Node,
        skinResolver: UISkinResolver,
        binder: UITemplateBinder,
        dataSource = 'listItems',
    ) {
        super(hostNode, skinResolver, binder);
        this.dataSource = dataSource;
    }

    // ─── ChildPanelBase 實作 ───────────────────────────────────────────────

    async onMount(spec: Record<string, unknown>): Promise<void> {
        this._itemHeight  = (spec['itemHeight']  as number | undefined) ?? 60;
        this._bufferCount = (spec['bufferCount'] as number | undefined) ?? 2;

        if (!this._services.virtualizer) {
            console.warn('[ScrollListPanel] _services.virtualizer 未注入，無法啟用虛擬捲動');
            return;
        }

        const virt = this._services.virtualizer;

        // 設定 onItemRender callback（virtualizer 觸發時填入資料）
        virt.onItemRender = (index: number, node: unknown) => {
            this._fillItem(node as Node, index, this._items[index] ?? {});
        };

        virt.attach(this.hostNode, this._items.length, this._itemHeight, this._bufferCount);

        if (this._items.length > 0) {
            virt.updateData(this._items.length);
        }
    }

    onDataUpdate(data: unknown): void {
        const err = this.validateDataFormat(data);
        if (err) {
            console.warn(`[ScrollListPanel] 資料格式錯誤：${err}`);
            return;
        }
        this._items = data as Record<string, unknown>[];
        if (this._services.virtualizer) {
            this._services.virtualizer.updateData(this._items.length);
        }
    }

    validateDataFormat(data: unknown): string | null {
        if (!Array.isArray(data)) return '期望 Array 但收到非陣列';
        for (let index = 0; index < data.length; index++) {
            const item = data[index];
            if (!item || typeof item !== 'object' || Array.isArray(item)) {
                return `第 ${index} 筆資料必須為 object`;
            }
        }
        return null;
    }

    override onUnmount(): void {
        if (this._services.virtualizer) {
            this._services.virtualizer.onItemRender = null;
            this._services.virtualizer.detach();
        }
    }

    // ─── 子類擴充 ─────────────────────────────────────────────────────────

    /**
     * 填充單一 list item 的資料（可被子類覆寫以加入業務邏輯）。
     * 預設 no-op；子類應覆寫此方法設定 Label.string / Sprite.spriteFrame 等。
     *
     * H-04：子類實作時請用字串形式 getComponent('cc.Label') 或保持此方法在 panel 層，
     *        cc rendering component 的 API 呼叫移至 platform/cocos/ 實作類。
     */
    protected _fillItem(_node: Node, _index: number, _data: Record<string, unknown>): void {
        // 子類覆寫
    }
}
