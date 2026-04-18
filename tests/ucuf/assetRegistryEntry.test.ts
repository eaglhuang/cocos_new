/**
 * assetRegistryEntry.test.ts — AssetRegistryEntry 型別合約 + registerDynamicAsset 測試
 *
 * 涵蓋：
 *   - AssetRegistryEntry / AssetRef / OrphanAsset / AssetAuditReport 型別結構
 *   - ChildPanelBase.registerDynamicAsset() callback 觸發機制
 *   - setDynamicAssetCallback() 注入後的回報路徑
 *
 * 不依賴 Cocos runtime。
 */

import { TestSuite, assert } from '../TestRunner';
import type {
    AssetRef,
    AssetRegistryEntry,
    OrphanAsset,
    AssetAuditReport,
    AssetRefType,
} from '../../assets/scripts/ui/core/AssetRegistryEntry';
import { ChildPanelBase } from '../../assets/scripts/ui/core/ChildPanelBase';
import type { Node } from 'cc';
import type { UISkinResolver } from '../../assets/scripts/ui/core/UISkinResolver';
import type { UITemplateBinder } from '../../assets/scripts/ui/core/UITemplateBinder';

// ─── Stub ChildPanel (minimal) ────────────────────────────────────────────────

class StubChildPanel extends ChildPanelBase {
    constructor() {
        super(
            {} as unknown as Node,
            {} as unknown as UISkinResolver,
            {} as unknown as UITemplateBinder,
        );
    }
    async onMount(_spec: Record<string, unknown>): Promise<void> {}
    onDataUpdate(_data: unknown): void {}
    validateDataFormat(_data: unknown): string | null { return null; }

    /** 暴露 protected 方法供測試呼叫 */
    public callRegisterDynamic(path: string, assetType?: AssetRefType): void {
        this.registerDynamicAsset(path, assetType);
    }
}

export function createAssetRegistryEntrySuite(): TestSuite {
    const suite = new TestSuite('UCUF-AssetRegistryEntry');

    // ── AssetRef 型別合約 ────────────────────────────────────────────────────

    suite.test('AssetRef 可建立 spriteFrame 型別', () => {
        const ref: AssetRef = {
            type:         'spriteFrame',
            path:         'sprites/ui_general/zhang-fei-portrait',
            registeredIn: 'skins/general-detail-unified-default',
        };
        assert.equals('spriteFrame', ref.type);
        assert.equals('sprites/ui_general/zhang-fei-portrait', ref.path);
    });

    suite.test('AssetRef 可建立 fragment 型別', () => {
        const ref: AssetRef = {
            type:         'fragment',
            path:         'ui-spec/fragments/layouts/gd-tab-overview',
            registeredIn: 'screens/general-detail-unified-screen',
        };
        assert.equals('fragment', ref.type);
    });

    suite.test('AssetRef 可建立 dynamic 型別', () => {
        const ref: AssetRef = {
            type:         'dynamic',
            path:         'sprites/generals/lu-bu-sprite',
            registeredIn: 'runtime:GeneralDetailComposite',
        };
        assert.equals('dynamic', ref.type);
    });

    // ── AssetRegistryEntry 型別合約 ──────────────────────────────────────────

    suite.test('AssetRegistryEntry 可建立最小有效條目', () => {
        const entry: AssetRegistryEntry = {
            screenId: 'general-detail-unified-screen',
            layoutId: 'general-detail-unified-main',
            skinId:   'general-detail-unified-default',
            assets:   [],
            missing:  [],
            dynamic:  [],
        };
        assert.equals('general-detail-unified-screen', entry.screenId);
        assert.equals(0, entry.assets.length);
        assert.equals(0, entry.missing.length);
        assert.equals(0, entry.dynamic.length);
    });

    suite.test('AssetRegistryEntry 可含多筆 assets', () => {
        const entry: AssetRegistryEntry = {
            screenId: 'test-screen',
            layoutId: 'test-layout',
            skinId:   'test-skin',
            assets: [
                { type: 'layout',    path: 'ui-spec/layouts/test-layout', registeredIn: 'screen' },
                { type: 'skin',      path: 'ui-spec/skins/test-skin',    registeredIn: 'screen' },
                { type: 'fragment',  path: 'ui-spec/fragments/tab-a',    registeredIn: 'layout' },
            ],
            missing:  [],
            dynamic:  [],
        };
        assert.equals(3, entry.assets.length);
        assert.equals('layout', entry.assets[0].type);
    });

    // ── OrphanAsset 型別合約 ─────────────────────────────────────────────────

    suite.test('OrphanAsset 可建立條目', () => {
        const orphan: OrphanAsset = {
            path:      'sprites/obsolete/old-banner.png',
            directory: 'sprites/obsolete',
        };
        assert.equals('sprites/obsolete/old-banner.png', orphan.path);
    });

    // ── AssetAuditReport 型別合約 ────────────────────────────────────────────

    suite.test('AssetAuditReport 可建立完整報告', () => {
        const report: AssetAuditReport = {
            timestamp:  '2026-04-12T00:00:00.000Z',
            entries:    [],
            orphans:    [],
            summary: {
                totalScreens:  0,
                totalAssets:   0,
                totalMissing:  0,
                totalOrphans:  0,
                totalDynamic:  0,
            },
        };
        assert.equals(0, report.summary.totalScreens);
        assert.equals('2026-04-12T00:00:00.000Z', report.timestamp);
    });

    // ── registerDynamicAsset callback 機制 ──────────────────────────────────

    suite.test('setDynamicAssetCallback 未注入時 registerDynamicAsset 不拋出', () => {
        const panel = new StubChildPanel();
        // callback 未注入，不應 throw
        assert.doesNotThrow(() => panel.callRegisterDynamic('sprites/test'));
    });

    suite.test('setDynamicAssetCallback 注入後 registerDynamicAsset 觸發 callback', () => {
        const panel = new StubChildPanel();
        const captured: Array<{ path: string; type: AssetRefType }> = [];

        panel.setDynamicAssetCallback((path, assetType) => {
            captured.push({ path, type: assetType });
        });

        panel.callRegisterDynamic('sprites/generals/cao-cao');
        assert.equals(1, captured.length);
        assert.equals('sprites/generals/cao-cao', captured[0].path);
        assert.equals('dynamic', captured[0].type);
    });

    suite.test('registerDynamicAsset 可自訂 assetType', () => {
        const panel = new StubChildPanel();
        const captured: Array<{ path: string; type: AssetRefType }> = [];

        panel.setDynamicAssetCallback((path, assetType) => {
            captured.push({ path, type: assetType });
        });

        panel.callRegisterDynamic('sprites/portraits/liu-bei', 'spriteFrame');
        assert.equals(1, captured.length);
        assert.equals('spriteFrame', captured[0].type);
    });

    suite.test('registerDynamicAsset 多次呼叫累積回報', () => {
        const panel = new StubChildPanel();
        const paths: string[] = [];

        panel.setDynamicAssetCallback((path) => { paths.push(path); });

        panel.callRegisterDynamic('sprites/a');
        panel.callRegisterDynamic('sprites/b');
        panel.callRegisterDynamic('sprites/c');

        assert.equals(3, paths.length);
        assert.equals('sprites/a', paths[0]);
        assert.equals('sprites/c', paths[2]);
    });

    suite.test('callback 替換後使用新 callback', () => {
        const panel = new StubChildPanel();
        const first:  string[] = [];
        const second: string[] = [];

        panel.setDynamicAssetCallback((p) => { first.push(p); });
        panel.callRegisterDynamic('sprites/x');

        panel.setDynamicAssetCallback((p) => { second.push(p); });
        panel.callRegisterDynamic('sprites/y');

        assert.equals(1, first.length);
        assert.equals(1, second.length);
        assert.equals('sprites/x', first[0]);
        assert.equals('sprites/y', second[0]);
    });

    return suite;
}
