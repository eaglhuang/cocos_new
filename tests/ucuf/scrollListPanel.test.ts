/**
 * scrollListPanel.test.ts — UCUF ScrollListPanel 邏輯測試
 *
 * 測試目標（純邏輯，不依賴 Cocos runtime）：
 *  - validateDataFormat
 *  - onMount 呼叫 virtualizer.attach
 *  - onDataUpdate 呼叫 virtualizer.updateData
 *  - onItemRender callback 綁定
 *  - onUnmount 呼叫 virtualizer.detach
 */

import { TestSuite, assert } from '../TestRunner';

// ─── Mock 基礎設施 ────────────────────────────────────────────────────────────

class MockNode {
    name: string;
    children: MockNode[] = [];
    constructor(name = 'MockNode') { this.name = name; }
    addChild(child: MockNode): void { this.children.push(child); }
}

class MockVirtualizer {
    attachCalls: Array<{ totalCount: number; itemHeight: number; bufferCount: number | undefined }> = [];
    detachCalls = 0;
    updateDataCalls: number[] = [];
    recycleAllCalls = 0;
    onItemRender: ((index: number, node: unknown) => void) | null = null;

    attach(_scrollNode: unknown, totalCount: number, itemHeight: number, bufferCount?: number): void {
        this.attachCalls.push({ totalCount, itemHeight, bufferCount });
    }

    detach(): void {
        this.detachCalls++;
    }

    updateData(totalCount: number): void {
        this.updateDataCalls.push(totalCount);
    }

    getVisibleRange(): { start: number; end: number } {
        return { start: 0, end: 5 };
    }

    recycleAll(): void {
        this.recycleAllCalls++;
    }
}

const mockSkinResolver = {} as any;
const mockBinder       = {} as any;

// ─── 測試套件 ─────────────────────────────────────────────────────────────────
export function createScrollListPanelSuite(): TestSuite {
    const suite = new TestSuite('UCUF-ScrollListPanel', 2);

    suite.test('validateDataFormat：合法陣列回傳 null', async () => {
        const { ScrollListPanel } = await import('../../assets/scripts/ui/core/panels/ScrollListPanel');
        const panel = new ScrollListPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        assert.equals(null, panel.validateDataFormat([{ id: 1 }, { id: 2 }]));
    });

    suite.test('validateDataFormat：非陣列回傳錯誤', async () => {
        const { ScrollListPanel } = await import('../../assets/scripts/ui/core/panels/ScrollListPanel');
        const panel = new ScrollListPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        assert.notEquals(null, panel.validateDataFormat({ id: 1 }));
    });

    suite.test('validateDataFormat：元素為 number 回傳錯誤', async () => {
        const { ScrollListPanel } = await import('../../assets/scripts/ui/core/panels/ScrollListPanel');
        const panel = new ScrollListPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        assert.notEquals(null, panel.validateDataFormat([1 as any]));
    });

    suite.test('validateDataFormat：元素為 null 回傳錯誤', async () => {
        const { ScrollListPanel } = await import('../../assets/scripts/ui/core/panels/ScrollListPanel');
        const panel = new ScrollListPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        assert.notEquals(null, panel.validateDataFormat([null as any]));
    });

    suite.test('dataSource 預設值為 listItems', async () => {
        const { ScrollListPanel } = await import('../../assets/scripts/ui/core/panels/ScrollListPanel');
        const panel = new ScrollListPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        assert.equals('listItems', panel.dataSource);
    });

    suite.test('onMount：注入 virtualizer 後呼叫 attach（採用 spec itemHeight/bufferCount）', async () => {
        const { ScrollListPanel } = await import('../../assets/scripts/ui/core/panels/ScrollListPanel');
        const panel = new ScrollListPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        const virt  = new MockVirtualizer();
        panel.setServices({ virtualizer: virt as any });

        await panel.onMount({ itemHeight: 72, bufferCount: 3 });

        assert.equals(1, virt.attachCalls.length);
        assert.equals(72, virt.attachCalls[0].itemHeight);
        assert.equals(3,  virt.attachCalls[0].bufferCount);
    });

    suite.test('onMount：未注入 virtualizer 時不 crash', async () => {
        const { ScrollListPanel } = await import('../../assets/scripts/ui/core/panels/ScrollListPanel');
        const panel = new ScrollListPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        await panel.onMount({ itemHeight: 60 });
        assert.equals(0, (panel as any)._items.length);
    });

    suite.test('onDataUpdate：100 筆資料呼叫 updateData(100)', async () => {
        const { ScrollListPanel } = await import('../../assets/scripts/ui/core/panels/ScrollListPanel');
        const panel = new ScrollListPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        const virt  = new MockVirtualizer();
        panel.setServices({ virtualizer: virt as any });
        await panel.onMount({ itemHeight: 60, bufferCount: 2 });

        const data = Array.from({ length: 100 }, (_, i) => ({ id: i }));
        panel.onDataUpdate(data);

        assert.equals(1, virt.updateDataCalls.length);
        assert.equals(100, virt.updateDataCalls[0]);
    });

    suite.test('onItemRender callback：可讀取 _items[index] 資料', async () => {
        const { ScrollListPanel } = await import('../../assets/scripts/ui/core/panels/ScrollListPanel');
        class TestScrollListPanel extends ScrollListPanel {
            lastFilled: any = null;
            protected override _fillItem(_node: any, index: number, data: Record<string, unknown>): void {
                this.lastFilled = { index, data };
            }
        }

        const panel = new TestScrollListPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        const virt  = new MockVirtualizer();
        panel.setServices({ virtualizer: virt as any });
        await panel.onMount({ itemHeight: 60, bufferCount: 2 });

        panel.onDataUpdate([{ name: 'A' }, { name: 'B' }, { name: 'C' }]);
        virt.onItemRender?.(1, new MockNode('Item'));

        assert.equals(1, panel.lastFilled.index);
        assert.equals('B', panel.lastFilled.data.name);
    });

    suite.test('onUnmount：呼叫 virtualizer.detach 並清空 onItemRender', async () => {
        const { ScrollListPanel } = await import('../../assets/scripts/ui/core/panels/ScrollListPanel');
        const panel = new ScrollListPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        const virt  = new MockVirtualizer();
        panel.setServices({ virtualizer: virt as any });
        await panel.onMount({ itemHeight: 60, bufferCount: 2 });

        panel.onUnmount();

        assert.equals(1, virt.detachCalls);
        assert.equals(null, virt.onItemRender);
    });

    suite.test('onDataUpdate：空陣列呼叫 updateData(0)', async () => {
        const { ScrollListPanel } = await import('../../assets/scripts/ui/core/panels/ScrollListPanel');
        const panel = new ScrollListPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        const virt  = new MockVirtualizer();
        panel.setServices({ virtualizer: virt as any });
        await panel.onMount({ itemHeight: 60, bufferCount: 2 });

        panel.onDataUpdate([]);

        assert.equals(1, virt.updateDataCalls.length);
        assert.equals(0, virt.updateDataCalls[0]);
    });

    suite.test('dataSource 可透過建構子自訂', async () => {
        const { ScrollListPanel } = await import('../../assets/scripts/ui/core/panels/ScrollListPanel');
        const panel = new ScrollListPanel(new MockNode() as any, mockSkinResolver, mockBinder, 'skills');
        assert.equals('skills', panel.dataSource);
    });

    return suite;
}
