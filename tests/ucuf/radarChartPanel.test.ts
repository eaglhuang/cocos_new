/**
 * radarChartPanel.test.ts — UCUF RadarChartPanel 邏輯測試
 */

import { TestSuite, assert } from '../TestRunner';

class MockNode {
    name: string;
    children: MockNode[] = [];
    constructor(name = 'MockNode') { this.name = name; }
    addChild(child: MockNode): void { this.children.push(child); }
}

class MockRenderer {
    drawRadarChartCalls: Array<{ config: unknown }> = [];
    updateRadarChartCalls: Array<{ config: unknown }> = [];
    chartNode: MockNode = new MockNode('RadarChart');

    async drawRadarChart(_parent: unknown, config: unknown): Promise<MockNode> {
        this.drawRadarChartCalls.push({ config });
        return this.chartNode;
    }

    updateRadarChart(_chartNode: unknown, config: unknown): void {
        this.updateRadarChartCalls.push({ config });
    }

    async drawGrid(): Promise<MockNode> { return new MockNode(); }
    async drawProgressBar(): Promise<MockNode> { return new MockNode(); }
    updateProgressBar(): void { /* no-op */ }
}

const mockSkinResolver = {} as any;
const mockBinder       = {} as any;

export function createRadarChartPanelSuite(): TestSuite {
    const suite = new TestSuite('UCUF-RadarChartPanel', 2);

    const validData = {
        axes: ['統率', '武力', '智力', '政治', '魅力', '幸運'],
        layers: [
            { values: [0.8, 0.9, 0.7, 0.6, 0.75, 0.65], label: '實力' },
            { values: [1.0, 1.0, 0.8, 0.7, 0.9, 0.8], label: '資質' },
        ],
    };

    suite.test('dataSource 固定為 dualLayerStats', async () => {
        const { RadarChartPanel } = await import('../../assets/scripts/ui/core/panels/RadarChartPanel');
        const panel = new RadarChartPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        assert.equals('dualLayerStats', panel.dataSource);
    });

    suite.test('validateDataFormat：合法 6 軸 dualLayer 回傳 null', async () => {
        const { RadarChartPanel } = await import('../../assets/scripts/ui/core/panels/RadarChartPanel');
        const panel = new RadarChartPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        assert.equals(null, panel.validateDataFormat(validData));
    });

    suite.test('validateDataFormat：axes 長度非 6 回傳錯誤', async () => {
        const { RadarChartPanel } = await import('../../assets/scripts/ui/core/panels/RadarChartPanel');
        const panel = new RadarChartPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        const bad = { ...validData, axes: ['A', 'B', 'C', 'D', 'E'] };
        assert.notEquals(null, panel.validateDataFormat(bad));
    });

    suite.test('validateDataFormat：layer.values 長度非 6 回傳錯誤', async () => {
        const { RadarChartPanel } = await import('../../assets/scripts/ui/core/panels/RadarChartPanel');
        const panel = new RadarChartPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        const bad = {
            ...validData,
            layers: [{ values: [0.1, 0.2, 0.3], label: '實力' }],
        };
        assert.notEquals(null, panel.validateDataFormat(bad));
    });

    suite.test('validateDataFormat：value 超出 0~1 回傳錯誤', async () => {
        const { RadarChartPanel } = await import('../../assets/scripts/ui/core/panels/RadarChartPanel');
        const panel = new RadarChartPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        const bad = {
            ...validData,
            layers: [{ values: [1.2, 0.2, 0.3, 0.4, 0.5, 0.6], label: '實力' }],
        };
        assert.notEquals(null, panel.validateDataFormat(bad));
    });

    suite.test('onDataUpdate（首次）：呼叫 drawRadarChart', async () => {
        const { RadarChartPanel } = await import('../../assets/scripts/ui/core/panels/RadarChartPanel');
        const panel = new RadarChartPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        const renderer = new MockRenderer();
        panel.setServices({ renderer: renderer as any });

        panel.onDataUpdate(validData);
        await Promise.resolve();

        assert.equals(1, renderer.drawRadarChartCalls.length);
        assert.equals(0, renderer.updateRadarChartCalls.length);
        assert.equals(2, (renderer.drawRadarChartCalls[0].config as any).layers.length);
    });

    suite.test('onDataUpdate（第二次）：呼叫 updateRadarChart', async () => {
        const { RadarChartPanel } = await import('../../assets/scripts/ui/core/panels/RadarChartPanel');
        const panel = new RadarChartPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        const renderer = new MockRenderer();
        panel.setServices({ renderer: renderer as any });

        panel.onDataUpdate(validData);
        await Promise.resolve();

        panel.onDataUpdate({
            ...validData,
            layers: [{ values: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], label: '實力' }],
        });
        await Promise.resolve();

        assert.equals(1, renderer.drawRadarChartCalls.length);
        assert.equals(1, renderer.updateRadarChartCalls.length);
        assert.equals(1, (renderer.updateRadarChartCalls[0].config as any).layers.length);
    });

    suite.test('onMount：可讀取 radarSize 規格並套用到 draw config', async () => {
        const { RadarChartPanel } = await import('../../assets/scripts/ui/core/panels/RadarChartPanel');
        const panel = new RadarChartPanel(new MockNode() as any, mockSkinResolver, mockBinder);
        const renderer = new MockRenderer();
        panel.setServices({ renderer: renderer as any });

        await panel.onMount({ radarSize: 180 });
        panel.onDataUpdate(validData);
        await Promise.resolve();

        assert.equals(1, renderer.drawRadarChartCalls.length);
        assert.equals(180, (renderer.drawRadarChartCalls[0].config as any).size);
    });

    return suite;
}
