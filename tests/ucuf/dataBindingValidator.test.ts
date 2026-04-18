/**
 * dataBindingValidator.test.ts — DataBindingValidator 單元測試
 *
 * 涵蓋四類情境：
 *   missing-source   → panel 有 dataSource 但 state 中無對應 key
 *   format-mismatch  → panel.validateDataFormat() 回傳 false
 *   unused-key       → state 有 key 但無任何 panel 消費
 *   no-issues        → 所有綁定完全正確，回傳空陣列
 *
 * 不依賴 Cocos runtime。
 */

import { TestSuite, assert } from '../TestRunner';
import { DataBindingValidator } from '../../assets/scripts/ui/core/DataBindingValidator';
import type { IPanelDataContract, BindingIssue } from '../../assets/scripts/ui/core/DataBindingValidator';

// ─── Mock ChildPanel ──────────────────────────────────────────────────────────

function makePanel(dataSource: string, valid: boolean): IPanelDataContract {
    return {
        dataSource,
        validateDataFormat: (_data: unknown) => valid ? null : 'mock invalid data',
    };
}

export function createDataBindingValidatorSuite(): TestSuite {
    const suite = new TestSuite('UCUF-DataBindingValidator', 2);

    // ── no-issues ────────────────────────────────────────────────────────────

    suite.test('no-issues：state 與 panels 完全對應，回傳空陣列', () => {
        const state  = { hero: { name: '曹操' }, skill: { id: 1 } };
        const panels = [makePanel('hero', true), makePanel('skill', true)];
        const issues = DataBindingValidator.validate(state, panels);
        assert.equals(0, issues.length);
    });

    // ── missing-source ───────────────────────────────────────────────────────

    suite.test('missing-source：panel 有 dataSource 但 state 缺少該 key', () => {
        const state  = { hero: { name: '曹操' } };
        const panels = [makePanel('hero', true), makePanel('skill', true)];
        const issues = DataBindingValidator.validate(state, panels);
        const ms = issues.filter((i: BindingIssue) => i.kind === 'missing-source');
        assert.equals(1, ms.length);
        assert.equals('skill', ms[0].dataSource);
    });

    suite.test('missing-source：state 完全空白，每個 panel 各產生一個問題', () => {
        const state  = {};
        const panels = [makePanel('A', true), makePanel('B', true)];
        const issues = DataBindingValidator.validate(state, panels);
        const ms = issues.filter((i: BindingIssue) => i.kind === 'missing-source');
        assert.equals(2, ms.length);
    });

    // ── format-mismatch ───────────────────────────────────────────────────────

    suite.test('format-mismatch：validateDataFormat 回傳 false', () => {
        const state  = { hero: 'bad-format' };
        const panels = [makePanel('hero', false)];
        const issues = DataBindingValidator.validate(state, panels);
        const fm = issues.filter((i: BindingIssue) => i.kind === 'format-mismatch');
        assert.equals(1, fm.length);
        assert.equals('hero', fm[0].dataSource);
    });

    suite.test('format-mismatch：validateDataFormat 拋出例外時算作 mismatch', () => {
        const state  = { hero: {} };
        const panels: IPanelDataContract[] = [{
            dataSource:         'hero',
            validateDataFormat: (_: unknown) => { throw new Error('unexpected!'); },
        }];
        const issues = DataBindingValidator.validate(state, panels);
        const fm = issues.filter((i: BindingIssue) => i.kind === 'format-mismatch');
        assert.equals(1, fm.length);
    });

    // ── unused-key ────────────────────────────────────────────────────────────

    suite.test('unused-key：state 有 key 但無 panel 消費', () => {
        const state  = { hero: {}, extra: {} };
        const panels = [makePanel('hero', true)];
        const issues = DataBindingValidator.validate(state, panels);
        const uk = issues.filter((i: BindingIssue) => i.kind === 'unused-key');
        assert.equals(1, uk.length);
        assert.equals('extra', uk[0].dataSource);
    });

    suite.test('unused-key：state 完全沒被 panel 消費，每個 key 各產生一個問題', () => {
        const state  = { A: 1, B: 2 };
        const panels: IPanelDataContract[] = [];
        const issues = DataBindingValidator.validate(state, panels);
        const uk = issues.filter((i: BindingIssue) => i.kind === 'unused-key');
        assert.equals(2, uk.length);
    });

    // ── 複合情境 ──────────────────────────────────────────────────────────────

    suite.test('複合：missing + unused 同時出現', () => {
        const state  = { hero: {}, orphan: {} };
        const panels = [makePanel('hero', true), makePanel('missing-panel', true)];
        const issues = DataBindingValidator.validate(state, panels);
        const ms = issues.filter((i: BindingIssue) => i.kind === 'missing-source');
        const uk = issues.filter((i: BindingIssue) => i.kind === 'unused-key');
        assert.equals(1, ms.length); // 'missing-panel' 不在 state
        assert.equals(1, uk.length); // 'orphan' 不被任何 panel 消費
    });

    return suite;
}
