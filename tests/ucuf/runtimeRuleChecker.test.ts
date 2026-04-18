/**
 * runtimeRuleChecker.test.ts — RuntimeRuleChecker 單元測試
 *
 * 每條規則 (RT-01 ~ RT-10) 均涵蓋「通過」與「失敗」兩種情境。
 * 採用輕量 Mock Node 物件代替 Cocos cc.Node（不依賴 cc runtime）。
 * reportRT04 / reportRT08 屬「回報型」規則，永遠回傳 passed:false，
 * 只驗證回傳結構正確即可。
 */

import { TestSuite, assert } from '../TestRunner';
import { RuntimeRuleChecker } from '../../assets/scripts/ui/core/RuntimeRuleChecker';
import type { Node } from 'cc';

// ─── Mock 輔助 ────────────────────────────────────────────────────────────────

/** 建立深度 n 的線性節點樹（以物件字面量模擬 cc.Node） */
function makeDeepNode(depth: number): Node {
    const root: Record<string, unknown> = { name: 'root', children: [] };
    let current = root;
    for (let i = 0; i < depth; i++) {
        const child: Record<string, unknown> = { name: `level${i + 1}`, children: [] };
        (current.children as unknown[]).push(child);
        current = child;
    }
    return root as unknown as Node;
}

export function createRuntimeRuleCheckerSuite(): TestSuite {
    const suite = new TestSuite('UCUF-RuntimeRuleChecker');

    // ── RT-01 節點深度 ───────────────────────────────────────────────────────

    suite.test('RT-01 PASS：深度 4 不超過預設上限 8', () => {
        const root  = makeDeepNode(4);
        const result = RuntimeRuleChecker.checkRT01_nodeDepth(root, 8);
        assert.equals(true, result.passed);
        assert.equals('RT-01', result.ruleId);
        assert.equals('warning', result.severity);
    });

    suite.test('RT-01 FAIL：深度 10 超過上限 8', () => {
        const root  = makeDeepNode(10);
        const result = RuntimeRuleChecker.checkRT01_nodeDepth(root, 8);
        assert.equals(false, result.passed);
        assert.equals('RT-01', result.ruleId);
    });

    suite.test('RT-01 PASS：單一根節點（深度 0）', () => {
        const root  = makeDeepNode(0);
        const result = RuntimeRuleChecker.checkRT01_nodeDepth(root, 8);
        assert.equals(true, result.passed);
    });

    // ── RT-02 重複 dataSource ──────────────────────────────────────────────

    suite.test('RT-02 PASS：無重複 dataSource', () => {
        const result = RuntimeRuleChecker.checkRT02_duplicateDataSource(['A', 'B', 'C']);
        assert.equals(true, result.passed);
        assert.equals('error', result.severity);
    });

    suite.test('RT-02 FAIL：有重複 dataSource', () => {
        const result = RuntimeRuleChecker.checkRT02_duplicateDataSource(['A', 'B', 'A']);
        assert.equals(false, result.passed);
        assert.equals('RT-02', result.ruleId);
    });

    // ── RT-03 skinLayer slot ───────────────────────────────────────────────

    suite.test('RT-03 PASS：所有 slot 均存在 manifest', () => {
        const known  = new Set(['bg', 'frame', 'icon']);
        const result = RuntimeRuleChecker.checkRT03_skinLayerSlotExists(['bg', 'frame'], known);
        assert.equals(true, result.passed);
    });

    suite.test('RT-03 FAIL：有 slot 不在 manifest 中', () => {
        const known  = new Set(['bg', 'frame']);
        const result = RuntimeRuleChecker.checkRT03_skinLayerSlotExists(['bg', 'missing-slot'], known);
        assert.equals(false, result.passed);
        assert.equals('error', result.severity);
    });

    // ── RT-04 回報型（always failed） ─────────────────────────────────────

    suite.test('RT-04 回傳 passed:false + ruleId RT-04', () => {
        const result = RuntimeRuleChecker.reportRT04_fragmentLoadFailed('slotA', 'frag/x', new Error('404'));
        assert.equals(false, result.passed);
        assert.equals('RT-04', result.ruleId);
        assert.equals('error', result.severity);
    });

    // ── RT-05 重複 widget siblings ────────────────────────────────────────

    suite.test('RT-05 PASS：無重複 widget', () => {
        const children = [
            { name: 'NodeA', widgetHash: 'hash1' },
            { name: 'NodeB', widgetHash: 'hash2' },
        ];
        const result = RuntimeRuleChecker.checkRT05_duplicateWidgetSiblings('Parent', children);
        assert.equals(true, result.passed);
    });

    suite.test('RT-05 FAIL：兩個 sibling 使用相同 widgetHash', () => {
        const children = [
            { name: 'NodeA', widgetHash: 'hash1' },
            { name: 'NodeB', widgetHash: 'hash1' },
        ];
        const result = RuntimeRuleChecker.checkRT05_duplicateWidgetSiblings('Parent', children);
        assert.equals(false, result.passed);
        assert.equals('warning', result.severity);
    });

    // ── RT-06 composite-image layers ──────────────────────────────────────

    suite.test('RT-06 PASS：10 層不超過預設上限 12', () => {
        const result = RuntimeRuleChecker.checkRT06_compositeImageLayerCount('Image', 10);
        assert.equals(true, result.passed);
    });

    suite.test('RT-06 FAIL：15 層超過上限 12', () => {
        const result = RuntimeRuleChecker.checkRT06_compositeImageLayerCount('Image', 15);
        assert.equals(false, result.passed);
        assert.equals('warning', result.severity);
    });

    // ── RT-07 ChildPanel config ────────────────────────────────────────────

    suite.test('RT-07 PASS：config 包含所有必要欄位', () => {
        const config = { skinKey: 'hero', dataSource: 'hero', tabKey: 'tab' };
        const result = RuntimeRuleChecker.checkRT07_childPanelConfig('HeroPanel', config, ['skinKey', 'dataSource']);
        assert.equals(true, result.passed);
    });

    suite.test('RT-07 FAIL：config 缺少必要欄位', () => {
        const config = { skinKey: 'hero' };
        const result = RuntimeRuleChecker.checkRT07_childPanelConfig('HeroPanel', config, ['skinKey', 'dataSource']);
        assert.equals(false, result.passed);
        assert.equals('error', result.severity);
    });

    // ── RT-08 回報型（always failed） ─────────────────────────────────────

    suite.test('RT-08 回傳 passed:false + ruleId RT-08', () => {
        const result = RuntimeRuleChecker.reportRT08_tabRoutingFragmentFailed('tabA', 'frag/attr', new Error('not found'));
        assert.equals(false, result.passed);
        assert.equals('RT-08', result.ruleId);
        assert.equals('error', result.severity);
    });

    // ── RT-09 content state key match ────────────────────────────────────

    suite.test('RT-09 PASS：所有 stateKeys 都有對應 dataSource', () => {
        const stateKeys        = ['hero', 'skill'];
        const registeredSources = ['hero', 'skill'];
        const result = RuntimeRuleChecker.checkRT09_contentStateKeyMatch(stateKeys, registeredSources);
        assert.equals(true, result.passed);
    });

    suite.test('RT-09 FAIL：有 stateKey 不在 registeredSources 中', () => {
        const stateKeys        = ['hero', 'unknown'];
        const registeredSources = ['hero'];
        const result = RuntimeRuleChecker.checkRT09_contentStateKeyMatch(stateKeys, registeredSources);
        assert.equals(false, result.passed);
        assert.equals('warning', result.severity);
    });

    // ── RT-10 skinSlot 路徑唯一性 ────────────────────────────────────────

    suite.test('RT-10 PASS：相同 slotId 指向相同路徑', () => {
        const pairs = [
            { slotId: 'bg',    path: 'ui/bg_default' },
            { slotId: 'frame', path: 'ui/frame_gold' },
        ];
        const result = RuntimeRuleChecker.checkRT10_skinSlotPathUnique(pairs);
        assert.equals(true, result.passed);
    });

    suite.test('RT-10 FAIL：相同 slotId 但路徑不同', () => {
        const pairs = [
            { slotId: 'bg', path: 'ui/bg_default' },
            { slotId: 'bg', path: 'ui/bg_premium' },
        ];
        const result = RuntimeRuleChecker.checkRT10_skinSlotPathUnique(pairs);
        assert.equals(false, result.passed);
        assert.equals('error', result.severity);
    });

    return suite;
}
