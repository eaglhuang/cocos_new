/**
 * skinLayers.test.ts — UCUF skinLayers / compositeImageLayers 型別與邏輯測試
 *
 * 測試目標：
 *  - SkinLayerDef / CompositeImageLayerDef 結構正確性
 *  - skinLayers zOrder 排序邏輯
 *  - 超過 12 層警告條件
 *  - compositeImageLayers 基本結構
 *
 * Unity 對照：Editor 模式下 additionalMaterial stack 的獨立單元測試
 */

import { TestSuite, assert } from '../TestRunner';
import type { SkinLayerDef, CompositeImageLayerDef, UILayoutNodeSpec } from '../../assets/scripts/ui/core/UISpecTypes';

// ─── 建立測試套件 ─────────────────────────────────────────────────────────────
export function createSkinLayersSuite(): TestSuite {
    const suite = new TestSuite('UCUF-skinLayers');

    // ── SkinLayerDef 結構 ────────────────────────────────────────────────────

    suite.test('SkinLayerDef 基本 2 層結構可正確建立', () => {
        const layers: SkinLayerDef[] = [
            { layerId: 'bg', slotId: 'panel-bg', zOrder: 0 },
            { layerId: 'overlay', slotId: 'panel-overlay', zOrder: 1, opacity: 0.5 },
        ];
        assert.equals(2, layers.length);
        assert.equals('bg', layers[0].layerId);
        assert.equals(0, layers[0].zOrder);
        assert.equals(0.5, layers[1].opacity!);
    });

    suite.test('SkinLayerDef 選填欄位預設為 undefined', () => {
        const layer: SkinLayerDef = { layerId: 'base', slotId: 'slot-a', zOrder: 0 };
        assert.equals(undefined, layer.expand);
        assert.equals(undefined, layer.blendMode);
        assert.equals(undefined, layer.opacity);
    });

    // ── zOrder 排序邏輯 ─────────────────────────────────────────────────────

    suite.test('skinLayers 依 zOrder 排序後順序正確', () => {
        const layers: SkinLayerDef[] = [
            { layerId: 'top', slotId: 'slot-c', zOrder: 10 },
            { layerId: 'bottom', slotId: 'slot-a', zOrder: -1 },
            { layerId: 'mid', slotId: 'slot-b', zOrder: 5 },
        ];
        const sorted = [...layers].sort((a, b) => a.zOrder - b.zOrder);
        assert.equals('bottom', sorted[0].layerId);
        assert.equals('mid', sorted[1].layerId);
        assert.equals('top', sorted[2].layerId);
    });

    // ── 12 層上限警告 ────────────────────────────────────────────────────────

    suite.test('skinLayers 超過 12 層觸發警告條件', () => {
        const layers: SkinLayerDef[] = [];
        for (let i = 0; i < 15; i++) {
            layers.push({ layerId: `layer-${i}`, slotId: `slot-${i}`, zOrder: i });
        }
        assert.isTrue(layers.length > 12, '超過 12 層應為 true');
    });

    suite.test('skinLayers 恰好 12 層不觸發警告', () => {
        const layers: SkinLayerDef[] = [];
        for (let i = 0; i < 12; i++) {
            layers.push({ layerId: `layer-${i}`, slotId: `slot-${i}`, zOrder: i });
        }
        assert.isFalse(layers.length > 12, '恰好 12 層不應觸發');
    });

    // ── zOrder 重複偵測 ─────────────────────────────────────────────────────

    suite.test('skinLayers zOrder 重複可被偵測', () => {
        const layers: SkinLayerDef[] = [
            { layerId: 'a', slotId: 'slot-a', zOrder: 1 },
            { layerId: 'b', slotId: 'slot-b', zOrder: 1 },
            { layerId: 'c', slotId: 'slot-c', zOrder: 2 },
        ];
        const zOrders = layers.map(l => l.zOrder);
        const unique = new Set(zOrders);
        assert.isTrue(unique.size !== zOrders.length, '應偵測到重複 zOrder');
    });

    suite.test('skinLayers zOrder 唯一時通過', () => {
        const layers: SkinLayerDef[] = [
            { layerId: 'a', slotId: 'slot-a', zOrder: 0 },
            { layerId: 'b', slotId: 'slot-b', zOrder: 1 },
        ];
        const zOrders = layers.map(l => l.zOrder);
        const unique = new Set(zOrders);
        assert.equals(unique.size, zOrders.length, 'zOrder 應唯一');
    });

    // ── CompositeImageLayerDef 結構 ──────────────────────────────────────────

    suite.test('CompositeImageLayerDef 基本結構', () => {
        const layers: CompositeImageLayerDef[] = [
            { spriteSlotId: 'portrait-base', zOrder: 0 },
            { spriteSlotId: 'portrait-glow', zOrder: 1, opacity: 0.8, tint: '#FF0000' },
        ];
        assert.equals(2, layers.length);
        assert.equals('portrait-glow', layers[1].spriteSlotId);
        assert.equals('#FF0000', layers[1].tint!);
    });

    // ── UILayoutNodeSpec 整合 ────────────────────────────────────────────────

    suite.test('UILayoutNodeSpec 可附加 skinLayers', () => {
        const spec: Partial<UILayoutNodeSpec> = {
            name: 'test-panel',
            type: 'panel',
            skinLayers: [
                { layerId: 'bg', slotId: 'panel-bg-texture', zOrder: 0, expand: true },
            ],
        };
        assert.isTrue(Array.isArray(spec.skinLayers));
        assert.equals(1, spec.skinLayers!.length);
        assert.isTrue(spec.skinLayers![0].expand === true);
    });

    suite.test('composite-image 節點含 compositeImageLayers', () => {
        const spec: Partial<UILayoutNodeSpec> = {
            name: 'hero-portrait',
            type: 'composite-image',
            compositeImageLayers: [
                { spriteSlotId: 'base', zOrder: 0 },
                { spriteSlotId: 'frame', zOrder: 1 },
            ],
        };
        assert.equals('composite-image', spec.type);
        assert.equals(2, spec.compositeImageLayers!.length);
    });

    return suite;
}
