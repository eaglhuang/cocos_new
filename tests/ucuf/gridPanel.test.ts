/**
 * gridPanel.test.ts — UCUF GridPanel 邏輯測試
 *
 * 測試目標（純邏輯，不依賴 Cocos runtime）：
 *  - validateDataFormat 各種輸入情境
 *  - onMount 讀取 spec 欄位（gridColumns / cellFragmentRef）
 *  - onDataUpdate 觸發 renderer.drawGrid mock
 *  - services 注入驗證
 *  - dataSource 預設值
 *
 * 測試策略：
 *  - Mock ICompositeRenderer（攔截 drawGrid 呼叫，驗證參數）
 *  - Mock Node（場景圖容器，不依賴 Cocos runtime）
 */

import { TestSuite, assert } from '../TestRunner';

// ─── Mock 基礎設施 ────────────────────────────────────────────────────────────

class MockNode {
    name: string;
    children: MockNode[] = [];
    destroyed = false;

    constructor(name = 'MockNode') { this.name = name; }

    addChild(child: MockNode): void { this.children.push(child); }
    destroyAllChildren(): void { this.children = []; }
}

/** Mock ICompositeRenderer — 記錄 drawGrid 呼叫參數 */
class MockRenderer {
    drawGridCalls: Array<{ config: unknown }> = [];
    drawGridReturn: MockNode = new MockNode('GridContainer');

    async drawGrid(_parent: unknown, config: unknown): Promise<MockNode> {
        this.drawGridCalls.push({ config });
        _parent as MockNode;
        return this.drawGridReturn;
    }

    // 未使用的方法（GridPanel 不呼叫）
    async drawRadarChart(): Promise<MockNode> { return new MockNode(); }
    async drawProgressBar(): Promise<MockNode> { return new MockNode(); }
    updateRadarChart(): void { /* no-op */ }
    updateProgressBar(): void { /* no-op */ }
}

const mockSkinResolver = {} as any;
const mockBinder       = {} as any;

// ─── 測試套件 ─────────────────────────────────────────────────────────────────
export function createGridPanelSuite(): TestSuite {
    const suite = new TestSuite('UCUF-GridPanel', 2);

    // ── validateDataFormat ──────────────────────────────────────────────────

    suite.test('validateDataFormat：空陣列視為合法', async () => {
        const { GridPanel } = await import('../../assets/scripts/ui/core/panels/GridPanel');
        const panel = new GridPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        assert.equals(null, panel.validateDataFormat([]));
    });

    suite.test('validateDataFormat：帶資料的陣列視為合法', async () => {
        const { GridPanel } = await import('../../assets/scripts/ui/core/panels/GridPanel');
        const panel = new GridPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        assert.equals(null, panel.validateDataFormat([{ avatarSlot: 'a', name: 'b' }]));
    });

    suite.test('validateDataFormat：非陣列輸入回傳錯誤訊息', async () => {
        const { GridPanel } = await import('../../assets/scripts/ui/core/panels/GridPanel');
        const panel = new GridPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        const result = panel.validateDataFormat({ key: 'val' });
        assert.notEquals(null, result);
    });

    suite.test('validateDataFormat：null 輸入回傳錯誤訊息', async () => {
        const { GridPanel } = await import('../../assets/scripts/ui/core/panels/GridPanel');
        const panel = new GridPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        const result = panel.validateDataFormat(null);
        assert.notEquals(null, result);
    });

    suite.test('validateDataFormat：陣列元素為 number 時回傳錯誤訊息', async () => {
        const { GridPanel } = await import('../../assets/scripts/ui/core/panels/GridPanel');
        const panel = new GridPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        const result = panel.validateDataFormat([1 as any]);
        assert.notEquals(null, result);
    });

    suite.test('validateDataFormat：陣列元素為 null 時回傳錯誤訊息', async () => {
        const { GridPanel } = await import('../../assets/scripts/ui/core/panels/GridPanel');
        const panel = new GridPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        const result = panel.validateDataFormat([null as any]);
        assert.notEquals(null, result);
    });

    // ── dataSource ─────────────────────────────────────────────────────────

    suite.test('dataSource 預設值為 "grid"', async () => {
        const { GridPanel } = await import('../../assets/scripts/ui/core/panels/GridPanel');
        const panel = new GridPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        assert.equals('grid', panel.dataSource);
    });

    suite.test('dataSource 可透過建構子自訂', async () => {
        const { GridPanel } = await import('../../assets/scripts/ui/core/panels/GridPanel');
        const panel = new GridPanel(new MockNode() as any, mockSkinResolver, mockBinder, 'ancestors');
        assert.equals('ancestors', panel.dataSource);
    });

    // ── onMount spec 讀取 ───────────────────────────────────────────────────

    suite.test('onMount：無 renderer 時 console.warn 不 crash', async () => {
        const { GridPanel } = await import('../../assets/scripts/ui/core/panels/GridPanel');
        const panel = new GridPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        // _services 未注入 renderer → 應 warn 但不拋例外
        await panel.onMount({ gridColumns: 4 });
        assert.equals(null, (panel as any)._gridContainer);
    });

    suite.test('onMount：注入 renderer 後呼叫 drawGrid', async () => {
        const { GridPanel } = await import('../../assets/scripts/ui/core/panels/GridPanel');
        const panel    = new GridPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        const renderer = new MockRenderer();
        panel.setServices({ renderer: renderer as any });

        await panel.onMount({ gridColumns: 3 });

        assert.equals(1, renderer.drawGridCalls.length);
        assert.equals(3, (renderer.drawGridCalls[0].config as any).columns);
    });

    suite.test('onMount：gridColumns 預設值為 4', async () => {
        const { GridPanel } = await import('../../assets/scripts/ui/core/panels/GridPanel');
        const panel    = new GridPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        const renderer = new MockRenderer();
        panel.setServices({ renderer: renderer as any });

        await panel.onMount({});

        assert.equals(1, renderer.drawGridCalls.length);
        assert.equals(4, (renderer.drawGridCalls[0].config as any).columns);
    });

    // ── onDataUpdate ────────────────────────────────────────────────────────

    suite.test('onDataUpdate：格式正確不 crash', async () => {
        const { GridPanel } = await import('../../assets/scripts/ui/core/panels/GridPanel');
        const panel    = new GridPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        const renderer = new MockRenderer();
        panel.setServices({ renderer: renderer as any });
        await panel.onMount({ gridColumns: 4 });

        panel.onDataUpdate([{ name: 'A' }, { name: 'B' }]);
        assert.equals(2, (panel as any)._lastData.length);
    });

    suite.test('onDataUpdate：8 筆資料 + columns=4 → drawGrid 被呼叫 1 次', async () => {
        const { GridPanel } = await import('../../assets/scripts/ui/core/panels/GridPanel');
        const panel    = new GridPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        const renderer = new MockRenderer();
        panel.setServices({ renderer: renderer as any });
        await panel.onMount({ gridColumns: 4 });

        const data = Array.from({ length: 8 }, (_, i) => ({ id: i }));
        panel.onDataUpdate(data);

        // drawGrid 在 onMount 時呼叫 1 次
        assert.equals(1, renderer.drawGridCalls.length);
    });

    return suite;
}
