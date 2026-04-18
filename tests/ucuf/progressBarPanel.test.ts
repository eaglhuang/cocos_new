/**
 * progressBarPanel.test.ts — UCUF ProgressBarPanel 邏輯測試
 */

import { TestSuite, assert } from '../TestRunner';

class MockNode {
    name: string;
    children: MockNode[] = [];
    constructor(name = 'MockNode') { this.name = name; }
    addChild(child: MockNode): void { this.children.push(child); }
}

class MockRenderer {
    drawProgressBarCalls: Array<{ config: unknown }> = [];
    updateProgressBarCalls: Array<{ current: number; max: number }> = [];

    async drawProgressBar(_parent: unknown, config: unknown): Promise<MockNode> {
        this.drawProgressBarCalls.push({ config });
        return new MockNode('ProgressBar');
    }

    updateProgressBar(_barNode: unknown, current: number, max: number): void {
        this.updateProgressBarCalls.push({ current, max });
    }

    async drawRadarChart(): Promise<MockNode> { return new MockNode(); }
    async drawGrid(): Promise<MockNode> { return new MockNode(); }
    updateRadarChart(): void { /* no-op */ }
}

const mockSkinResolver = {} as any;
const mockBinder       = {} as any;

async function flushAsync(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
}

export function createProgressBarPanelSuite(): TestSuite {
    const suite = new TestSuite('UCUF-ProgressBarPanel', 2);

    const valid = [
        { label: '統率', current: 85, max: 100 },
        { label: '武力', current: 90, max: 100 },
        { label: '智力', current: 70, max: 80 },
        { label: '政治', current: 55, max: 75 },
        { label: '魅力', current: 75, max: 90 },
        { label: '幸運', current: 65, max: 80 },
    ];

    suite.test('dataSource 固定為 progressBars', async () => {
        const { ProgressBarPanel } = await import('../../assets/scripts/ui/core/panels/ProgressBarPanel');
        const panel = new ProgressBarPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        assert.equals('progressBars', panel.dataSource);
    });

    suite.test('validateDataFormat：合法陣列回傳 null', async () => {
        const { ProgressBarPanel } = await import('../../assets/scripts/ui/core/panels/ProgressBarPanel');
        const panel = new ProgressBarPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        assert.equals(null, panel.validateDataFormat(valid));
    });

    suite.test('validateDataFormat：非陣列回傳錯誤', async () => {
        const { ProgressBarPanel } = await import('../../assets/scripts/ui/core/panels/ProgressBarPanel');
        const panel = new ProgressBarPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        assert.notEquals(null, panel.validateDataFormat({}));
    });

    suite.test('validateDataFormat：缺少欄位回傳錯誤', async () => {
        const { ProgressBarPanel } = await import('../../assets/scripts/ui/core/panels/ProgressBarPanel');
        const panel = new ProgressBarPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        assert.notEquals(null, panel.validateDataFormat([{ label: '統率', current: 80 }]));
    });

    suite.test('onDataUpdate（首次）：6 筆資料呼叫 drawProgressBar 6 次', async () => {
        const { ProgressBarPanel } = await import('../../assets/scripts/ui/core/panels/ProgressBarPanel');
        const panel = new ProgressBarPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        const renderer = new MockRenderer();
        panel.setServices({ renderer: renderer as any });

        panel.onDataUpdate(valid);
        await flushAsync();

        assert.equals(6, renderer.drawProgressBarCalls.length);
        assert.equals(0, renderer.updateProgressBarCalls.length);
    });

    suite.test('onDataUpdate（第二次）：更新已有節點走 updateProgressBar', async () => {
        const { ProgressBarPanel } = await import('../../assets/scripts/ui/core/panels/ProgressBarPanel');
        const panel = new ProgressBarPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        const renderer = new MockRenderer();
        panel.setServices({ renderer: renderer as any });

        panel.onDataUpdate(valid);
        await flushAsync();
        panel.onDataUpdate(valid.map((v) => ({ ...v, current: v.current - 5 })));
        await flushAsync();

        assert.equals(6, renderer.drawProgressBarCalls.length);
        assert.equals(6, renderer.updateProgressBarCalls.length);
    });

    suite.test('onDataUpdate：current > max 時應 clamp 到 max（update 時）', async () => {
        const { ProgressBarPanel } = await import('../../assets/scripts/ui/core/panels/ProgressBarPanel');
        const panel = new ProgressBarPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        const renderer = new MockRenderer();
        panel.setServices({ renderer: renderer as any });

        panel.onDataUpdate([{ label: '統率', current: 120, max: 100 }]);
        await flushAsync();
        panel.onDataUpdate([{ label: '統率', current: 130, max: 100 }]);
        await flushAsync();

        assert.equals(1, renderer.drawProgressBarCalls.length);
        assert.equals(1, renderer.updateProgressBarCalls.length);
        assert.equals(100, renderer.updateProgressBarCalls[0].current);
        assert.equals(100, renderer.updateProgressBarCalls[0].max);
    });

    suite.test('onMount：已有 lastData 時會自動渲染', async () => {
        const { ProgressBarPanel } = await import('../../assets/scripts/ui/core/panels/ProgressBarPanel');
        const panel = new ProgressBarPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        const renderer = new MockRenderer();
        panel.setServices({ renderer: renderer as any });

        panel.onDataUpdate([{ label: '統率', current: 80, max: 100 }]);
        await flushAsync();

        // 清空呼叫計數，驗證 onMount 會以 lastData 再渲染（若已有節點，走 update 路徑）
        renderer.drawProgressBarCalls = [];
        renderer.updateProgressBarCalls = [];
        await panel.onMount({});

        assert.equals(0, renderer.drawProgressBarCalls.length);
        assert.equals(1, renderer.updateProgressBarCalls.length);
    });

    return suite;
}
