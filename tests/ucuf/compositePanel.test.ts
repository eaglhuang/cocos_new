/**
 * compositePanel.test.ts — UCUF CompositePanel 核心邏輯測試
 *
 * 測試目標（純邏輯，不依賴 Cocos runtime）：
 *  - lazySlot spec 欄位結構正確性
 *  - TabRoute 型別結構
 *  - tabRouting 在 UIScreenSpec 中的欄位宣告
 *  - LazySlotEntry 結構
 *
 * 注意：CompositePanel 繼承 UIPreviewBuilder（cc.Component），無法在 Node.js 環境
 * 中直接實例化（cc 模組不可用）。本套件採用「型別合約測試」策略：
 *  - 驗證 spec 結構 / 型別欄位 / 業務邏輯運算（不涉及 cc 呼叫）
 *  - 需要 Cocos runtime 的行為測試（mount / switchSlot / applyContentState）
 *    標記為 SKIP，改為 integration test 在 Editor 中執行
 *
 * Unity 對照：TabController 的靜態契約測試（Inspector 欄位結構驗證）
 */

import { TestSuite, assert } from '../TestRunner';
import type {
    UILayoutNodeSpec,
    UIScreenSpec,
    TabRoute,
} from '../../assets/scripts/ui/core/UISpecTypes';
import type { LazySlotEntry } from '../../assets/scripts/ui/core/CompositePanel';

// ─── 建立測試套件 ─────────────────────────────────────────────────────────────
export function createCompositePanelSuite(): TestSuite {
    const suite = new TestSuite('UCUF-CompositePanel');

    // ── lazySlot spec 欄位 ───────────────────────────────────────────────────

    suite.test('UILayoutNodeSpec.lazySlot 欄位可設為 true', () => {
        const spec: UILayoutNodeSpec = {
            name: 'AttrSlot',
            type: 'container',
            width: 400,
            height: 600,
            lazySlot: true,
        };
        assert.equals(true, spec.lazySlot);
    });

    suite.test('UILayoutNodeSpec.defaultFragment 欄位可設為字串', () => {
        const spec: UILayoutNodeSpec = {
            name: 'AttrSlot',
            type: 'container',
            width: 400,
            height: 600,
            lazySlot: true,
            defaultFragment: 'fragments/layouts/tab-attributes',
        };
        assert.equals('fragments/layouts/tab-attributes', spec.defaultFragment);
    });

    suite.test('UILayoutNodeSpec.childType 欄位可設為字串', () => {
        const spec: UILayoutNodeSpec = {
            name: 'AttrSlot',
            type: 'container',
            width: 400,
            height: 600,
            lazySlot: true,
            childType: 'AttributePanel',
        };
        assert.equals('AttributePanel', spec.childType);
    });

    suite.test('lazySlot 未設時預設為 undefined', () => {
        const spec: UILayoutNodeSpec = {
            name: 'NormalContainer',
            type: 'container',
            width: 200,
            height: 200,
        };
        assert.equals(undefined, spec.lazySlot);
        assert.equals(undefined, spec.defaultFragment);
        assert.equals(undefined, spec.childType);
    });

    // ── TabRoute 型別 ────────────────────────────────────────────────────────

    suite.test('TabRoute 結構可正確建立', () => {
        const route: TabRoute = {
            slotId:   'TabContentSlot',
            fragment: 'fragments/layouts/tab-attributes',
        };
        assert.equals('TabContentSlot', route.slotId);
        assert.equals('fragments/layouts/tab-attributes', route.fragment);
    });

    // ── UIScreenSpec.tabRouting ──────────────────────────────────────────────

    suite.test('UIScreenSpec.tabRouting 可宣告多個 Tab', () => {
        const routing: Record<string, TabRoute> = {
            Basics: { slotId: 'ContentSlot', fragment: 'fragments/layouts/tab-basics' },
            Stats:  { slotId: 'ContentSlot', fragment: 'fragments/layouts/tab-stats' },
        };
        assert.equals(2, Object.keys(routing).length);
        assert.equals('fragments/layouts/tab-basics', routing['Basics'].fragment);
        assert.equals('ContentSlot', routing['Stats'].slotId);
    });

    suite.test('UIScreenSpec tabRouting 欄位為選填', () => {
        // 確認無 tabRouting 的 UIScreenSpec 部份結構可接受
        const partialScreen: Partial<UIScreenSpec> = {
            id: 'daily-person-detail',
            layout: 'layouts/daily-person-detail',
            skin: 'skins/daily-person-detail',
        };
        assert.equals(undefined, (partialScreen as any).tabRouting);
    });

    // ── LazySlotEntry 結構 ───────────────────────────────────────────────────

    suite.test('LazySlotEntry 欄位完整可建立（mock Node）', () => {
        const mockNode = {} as any;  // mock cc.Node (無 cc runtime)
        const spec: UILayoutNodeSpec = {
            name: 'AttrSlot',
            type: 'container',
            width: 400,
            height: 600,
            lazySlot: true,
            defaultFragment: 'fragments/layouts/tab-attributes',
        };
        const entry: LazySlotEntry = {
            spec,
            node:    mockNode,
            parentW: 800,
            parentH: 1200,
        };
        assert.equals('AttrSlot', entry.spec.name);
        assert.equals(800, entry.parentW);
        assert.equals(1200, entry.parentH);
        assert.equals(true, entry.spec.lazySlot);
    });

    // ── tabRouting 路由查詢邏輯（純函數） ────────────────────────────────────

    suite.test('tabRouting 查詢：存在的 key 回傳正確 TabRoute', () => {
        const routing: Record<string, TabRoute> = {
            Basics: { slotId: 'ContentSlot', fragment: 'fragments/layouts/tab-basics' },
            Skills: { slotId: 'ContentSlot', fragment: 'fragments/layouts/tab-skills' },
        };
        const route = routing['Skills'];
        assert.equals('fragments/layouts/tab-skills', route.fragment);
    });

    suite.test('tabRouting 查詢：不存在的 key 回傳 undefined', () => {
        const routing: Record<string, TabRoute> = {
            Basics: { slotId: 'ContentSlot', fragment: 'fragments/layouts/tab-basics' },
        };
        const route = routing['NonExistent'];
        assert.equals(undefined, route);
    });

    return suite;
}
