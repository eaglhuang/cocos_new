/**
 * compositePanelDispose.test.ts — CompositePanel dispose() 型別合約測試
 *
 * 採用「型別合約測試」策略：CompositePanel 繼承 UIPreviewBuilder（cc.Component），
 * 無法在 Node.js 環境中直接實例化。本套件透過輕量 Stub 驗證 dispose() 的
 * 可觀測副作用（loadedAssetPathCount 歸零 + 路徑集清空）。
 *
 * 不依賴 Cocos runtime。
 *
 * Unity 對照：Teardown / OnDestroy 回呼的 contract test。
 */

import { TestSuite, assert } from '../TestRunner';
import type { LazySlotEntry } from '../../assets/scripts/ui/core/CompositePanel';

// ─── 輕量 Stub ────────────────────────────────────────────────────────────────
//
// 我們只需要驗證 _loadedAssetPaths Set 的 lifecycle 行為。
// 用一個最小化版本模擬 CompositePanel 的資源追蹤邏輯，
// 確保 dispose() 呼叫後 loadedAssetPathCount 歸零。
//

class CompositePanelStub {
    private readonly _loadedAssetPaths = new Set<string>();
    private _mounted = false;

    /** 模擬 mount() 追蹤 screenId */
    simulateMount(screenId: string): void {
        this._loadedAssetPaths.add(screenId);
        this._mounted = true;
    }

    /** 模擬 switchSlot() 追蹤 fragmentId */
    simulateSlotSwitch(fragmentId: string): void {
        this._loadedAssetPaths.add(fragmentId);
    }

    /** 對應 CompositePanel.loadedAssetPathCount getter */
    get loadedAssetPathCount(): number {
        return this._loadedAssetPaths.size;
    }

    /** 對應 CompositePanel.dispose() 核心邏輯 */
    dispose(): void {
        this._mounted = false;
        this._loadedAssetPaths.clear();
    }

    get isMountedState(): boolean {
        return this._mounted;
    }
}

export function createCompositePanelDisposeSuite(): TestSuite {
    const suite = new TestSuite('UCUF-CompositePanelDispose');

    // ── 資源追蹤 ────────────────────────────────────────────────────────────

    suite.test('mount 後 loadedAssetPathCount 為 1', () => {
        const stub = new CompositePanelStub();
        stub.simulateMount('screens/general-detail');
        assert.equals(1, stub.loadedAssetPathCount);
    });

    suite.test('mount + switchSlot 後 loadedAssetPathCount 為 2', () => {
        const stub = new CompositePanelStub();
        stub.simulateMount('screens/general-detail');
        stub.simulateSlotSwitch('fragments/attr');
        assert.equals(2, stub.loadedAssetPathCount);
    });

    suite.test('多次 switchSlot 相同 fragment 不重複計數', () => {
        const stub = new CompositePanelStub();
        stub.simulateMount('screens/main');
        stub.simulateSlotSwitch('fragments/attr');
        stub.simulateSlotSwitch('fragments/attr'); // 相同，不應重複
        assert.equals(2, stub.loadedAssetPathCount);
    });

    suite.test('不同 fragmentId 各自計數', () => {
        const stub = new CompositePanelStub();
        stub.simulateMount('screens/main');
        stub.simulateSlotSwitch('fragments/attr');
        stub.simulateSlotSwitch('fragments/skill');
        assert.equals(3, stub.loadedAssetPathCount);
    });

    // ── dispose() 清除 ───────────────────────────────────────────────────────

    suite.test('dispose() 後 loadedAssetPathCount 歸零', () => {
        const stub = new CompositePanelStub();
        stub.simulateMount('screens/general-detail');
        stub.simulateSlotSwitch('fragments/attr');
        stub.simulateSlotSwitch('fragments/skill');
        assert.equals(3, stub.loadedAssetPathCount);
        stub.dispose();
        assert.equals(0, stub.loadedAssetPathCount);
    });

    suite.test('空 panel dispose() 不拋出例外', () => {
        const stub = new CompositePanelStub();
        stub.dispose(); // 無任何追蹤路徑
        assert.equals(0, stub.loadedAssetPathCount);
    });

    suite.test('dispose() 後可再次 mount（重用場景）', () => {
        const stub = new CompositePanelStub();
        stub.simulateMount('screens/main');
        stub.dispose();
        assert.equals(0, stub.loadedAssetPathCount);
        stub.simulateMount('screens/other');
        assert.equals(1, stub.loadedAssetPathCount);
    });

    // ── LazySlotEntry 型別合約（確保 import 正確） ───────────────────────────

    suite.test('LazySlotEntry 型別包含目前 lazy slot 合約欄位', () => {
        const entry: LazySlotEntry = {
            spec: { name: 'AttrSlot', type: 'container', lazySlot: true },
            node: {} as any,
            parentW: 640,
            parentH: 360,
            currentFragmentId: 'fragments/layouts/tab-attributes',
        };
        assert.equals('AttrSlot', entry.spec.name);
        assert.equals('fragments/layouts/tab-attributes', entry.currentFragmentId);
    });

    return suite;
}
