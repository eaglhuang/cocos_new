/**
 * agentGovernance.test.ts — UCUF M11 Agent 治理單元測試
 *
 * 涵蓋：
 *  - UCUFRuleRegistry register / unregister / getRulesByScope 合約
 *  - UCUFRuleRegistry onRuleAdded 事件觸發合約
 *  - UCUFRuleRegistry loadFromJson 批次載入合約
 *  - UCUFRuleRegistry 預載入 RT-01~RT-10 向後相容驗證
 *  - RuntimeRuleChecker.runScopeChecks 動態規則執行合約
 *
 * 不依賴 Cocos runtime；所有測試可在純 Node.js 環境（ts-node）執行。
 *
 * Unity 對照：unit tests for rule registry + dynamic dispatch pipeline
 */

import { TestSuite, assert } from '../TestRunner';
import { UCUFRuleRegistry } from '../../assets/scripts/ui/core/UCUFRuleRegistry';
import type { RuleEntry, IEventBus } from '../../assets/scripts/ui/core/UCUFRuleRegistry';
import { RuntimeRuleChecker } from '../../assets/scripts/ui/core/RuntimeRuleChecker';

// ─── StubEventBus（迴避 cc module 依賴）────────────────────────────────────────

class StubEventBus implements IEventBus {
    private _listeners = new Map<string, Array<(payload?: unknown) => void>>();
    private _emitted: Array<{ event: string; payload: unknown }> = [];

    on<T = unknown>(event: string, handler: (payload?: T) => void): () => void {
        const list = this._listeners.get(event) ?? [];
        list.push(handler as (payload?: unknown) => void);
        this._listeners.set(event, list);
        return () => {
            const current = this._listeners.get(event) ?? [];
            this._listeners.set(event, current.filter(h => h !== handler));
        };
    }

    emit<T = unknown>(event: string, payload?: T): void {
        this._emitted.push({ event, payload });
        const list = this._listeners.get(event) ?? [];
        list.forEach(h => h(payload));
    }

    /** Test helper: 取得某事件的全部 emit payload 清單 */
    emittedPayloads<T = unknown>(event: string): T[] {
        return this._emitted.filter(e => e.event === event).map(e => e.payload as T);
    }

    reset(): void {
        this._emitted = [];
    }
}

// ─── 輔助函式 ────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<RuleEntry> = {}): RuleEntry {
    return {
        id:            'RT-TEST',
        name:          'testRule',
        severity:      'warning',
        enabled:       true,
        triggerPoints: ['mount'],
        ...overrides,
    };
}

// ─────────────────────────────────────────────────────────────────────────────

export function createAgentGovernanceSuite(): TestSuite {
    const suite = new TestSuite('UCUFRuleRegistry (M11 Agent Governance)');

    // ── Builtin pre-registration ──────────────────────────────────────────────

    suite.test('constructor pre-registers RT-01 through RT-10', () => {
        const reg = new UCUFRuleRegistry();
        const all = reg.getAllRules();
        const ids = all.map(r => r.id);
        for (let i = 1; i <= 10; i++) {
            const ruleId = i < 10 ? `RT-0${i}` : `RT-${i}`;
            assert.isTrue(ids.includes(ruleId), `RT-0${i} should be pre-registered`);
        }
        // Should have exactly 10 builtins
        assert.equals(10, all.length, 'Should have exactly 10 builtin rules');
    });

    suite.test('constructor pre-registration does not emit onRuleAdded events', () => {
        const bus = new StubEventBus();
        new UCUFRuleRegistry(bus);
        const emitted = bus.emittedPayloads('ucuf-rule-added');
        assert.equals(0, emitted.length, 'Pre-registration should not emit events');
    });

    // ── register ──────────────────────────────────────────────────────────────

    suite.test('register adds a new rule retrievable by getRuleById', () => {
        const reg = new UCUFRuleRegistry();
        const entry = makeEntry({ id: 'RT-99', name: 'customRule' });
        reg.register(entry);
        const found = reg.getRuleById('RT-99');
        assert.isDefined(found, 'Registered rule should be retrievable by id');
        assert.equals('customRule', found!.name);
    });

    suite.test('register overwrites existing rule with same id', () => {
        const reg = new UCUFRuleRegistry();
        reg.register(makeEntry({ id: 'RT-01', name: 'overrideRule', severity: 'error' }));
        const found = reg.getRuleById('RT-01');
        assert.equals('overrideRule', found!.name, 'Overwritten name should reflect update');
        assert.equals('error', found!.severity);
    });

    suite.test('register emits ucuf-rule-added event via eventBus', () => {
        const bus = new StubEventBus();
        const reg = new UCUFRuleRegistry(bus);
        const entry = makeEntry({ id: 'RT-99' });
        reg.register(entry);
        const payloads = bus.emittedPayloads<RuleEntry>('ucuf-rule-added');
        assert.equals(1, payloads.length, 'Should emit exactly one event');
        assert.equals('RT-99', payloads[0].id);
    });

    // ── unregister ────────────────────────────────────────────────────────────

    suite.test('unregister removes rule from registry', () => {
        const reg = new UCUFRuleRegistry();
        reg.register(makeEntry({ id: 'RT-99' }));
        reg.unregister('RT-99');
        const found = reg.getRuleById('RT-99');
        assert.equals(undefined, found, 'Unregistered rule should not be retrievable');
    });

    suite.test('unregister on non-existent id is silent (no throw)', () => {
        const reg = new UCUFRuleRegistry();
        reg.unregister('RT-NON-EXISTENT'); // should not throw
        assert.isTrue(true);
    });

    // ── getRulesByScope ───────────────────────────────────────────────────────

    suite.test('getRulesByScope returns rules matching triggerPoint', () => {
        const reg = new UCUFRuleRegistry();
        reg.register(makeEntry({ id: 'RT-A', triggerPoints: ['mount', 'switchSlot'] }));
        reg.register(makeEntry({ id: 'RT-B', triggerPoints: ['applyContentState'] }));
        const mountRules = reg.getRulesByScope('mount');
        const ids = mountRules.map(r => r.id);
        assert.isTrue(ids.includes('RT-A'), 'RT-A should be in mount scope');
        assert.isTrue(!ids.includes('RT-B'), 'RT-B should not be in mount scope');
    });

    suite.test('getRulesByScope excludes disabled rules', () => {
        const reg = new UCUFRuleRegistry();
        reg.register(makeEntry({ id: 'RT-DISABLED', enabled: false, triggerPoints: ['mount'] }));
        const mountRules = reg.getRulesByScope('mount');
        const ids = mountRules.map(r => r.id);
        assert.isTrue(!ids.includes('RT-DISABLED'), 'Disabled rules should be excluded');
    });

    suite.test('getRulesByScope returns empty array for unknown scope', () => {
        const reg = new UCUFRuleRegistry();
        const result = reg.getRulesByScope('unknown-scope-xyz');
        assert.equals(0, result.length, 'Unknown scope should return empty array');
    });

    // ── getAllRules ───────────────────────────────────────────────────────────

    suite.test('getAllRules includes both enabled and disabled rules', () => {
        const reg = new UCUFRuleRegistry();
        reg.register(makeEntry({ id: 'RT-ON',  enabled: true  }));
        reg.register(makeEntry({ id: 'RT-OFF', enabled: false }));
        const all = reg.getAllRules();
        const ids = all.map(r => r.id);
        assert.isTrue(ids.includes('RT-ON'),  'getAllRules should include enabled rules');
        assert.isTrue(ids.includes('RT-OFF'), 'getAllRules should include disabled rules');
    });

    // ── onRuleAdded ───────────────────────────────────────────────────────────

    suite.test('onRuleAdded handler is called when register() is invoked', () => {
        const bus = new StubEventBus();
        const reg = new UCUFRuleRegistry(bus);
        const received: RuleEntry[] = [];
        reg.onRuleAdded(entry => { if (entry) { received.push(entry); } });
        reg.register(makeEntry({ id: 'RT-NEW' }));
        assert.equals(1, received.length, 'onRuleAdded handler should fire once');
        assert.equals('RT-NEW', received[0].id);
    });

    suite.test('onRuleAdded unsubscribe stops future notifications', () => {
        const bus = new StubEventBus();
        const reg = new UCUFRuleRegistry(bus);
        const received: RuleEntry[] = [];
        const unsubscribe = reg.onRuleAdded(entry => { if (entry) { received.push(entry); } });
        reg.register(makeEntry({ id: 'RT-A' }));
        unsubscribe();
        reg.register(makeEntry({ id: 'RT-B' }));
        assert.equals(1, received.length, 'After unsubscribe, no more callbacks');
    });

    suite.test('onRuleAdded without eventBus returns noop and prints warn', () => {
        const reg = new UCUFRuleRegistry(); // no bus
        const unsubscribe = reg.onRuleAdded(() => { /* noop */ });
        // Should not throw — just return a no-op function
        unsubscribe(); // should not throw
        assert.isTrue(true);
    });

    // ── loadFromJson ──────────────────────────────────────────────────────────

    suite.test('loadFromJson registers all valid entries', () => {
        const reg = new UCUFRuleRegistry();
        const startCount = reg.getAllRules().length;
        reg.loadFromJson({
            version: '1.0.0',
            rules: [
                { id: 'RT-11', name: 'customDepthCheck', severity: 'warning', enabled: true, triggerPoints: ['mount'] },
                { id: 'RT-12', name: 'customSlotCheck',  severity: 'error',   enabled: true, triggerPoints: ['switchSlot'] },
            ],
        });
        const endCount = reg.getAllRules().length;
        assert.equals(startCount + 2, endCount, 'Both entries should be registered');
    });

    suite.test('loadFromJson skips entries missing id or name', () => {
        const reg = new UCUFRuleRegistry();
        const startCount = reg.getAllRules().length;
        reg.loadFromJson({
            rules: [
                { id: 'RT-VALID', name: 'valid', severity: 'warning', enabled: true, triggerPoints: [] },
                { name: 'missing-id',  severity: 'warning', enabled: true, triggerPoints: [] },
                { id:   'RT-NNAME',                         enabled: true, triggerPoints: [] },
            ],
        });
        const endCount = reg.getAllRules().length;
        assert.equals(startCount + 1, endCount, 'Only the valid entry should be registered');
    });

    suite.test('loadFromJson uses defaults for optional fields', () => {
        const reg = new UCUFRuleRegistry();
        reg.loadFromJson({ rules: [{ id: 'RT-MIN', name: 'minEntry' }] });
        const entry = reg.getRuleById('RT-MIN');
        assert.isDefined(entry);
        assert.equals('warning', entry!.severity, 'Default severity should be warning');
        assert.isTrue(entry!.enabled, 'Default enabled should be true');
        assert.equals(0, entry!.triggerPoints.length, 'Default triggerPoints should be empty');
    });

    suite.test('loadFromJson triggers onRuleAdded for each valid entry', () => {
        const bus = new StubEventBus();
        const reg = new UCUFRuleRegistry(bus);
        const received: string[] = [];
        reg.onRuleAdded(e => { if (e) { received.push(e.id); } });
        reg.loadFromJson({
            rules: [
                { id: 'RT-11', name: 'r11', enabled: true, triggerPoints: [] },
                { id: 'RT-12', name: 'r12', enabled: true, triggerPoints: [] },
            ],
        });
        assert.equals(2, received.length, 'Should fire onRuleAdded for each loaded entry');
        assert.isTrue(received.includes('RT-11'));
        assert.isTrue(received.includes('RT-12'));
    });

    // ── RuntimeRuleChecker.runScopeChecks ──────────────────────────────────────

    suite.test('runScopeChecks returns empty array when no registry set', () => {
        // Reset to ensure no registry injected
        RuntimeRuleChecker.setRegistry(null as unknown as UCUFRuleRegistry);
        const results = RuntimeRuleChecker.runScopeChecks('mount', {});
        assert.equals(0, results.length, 'Without registry, runScopeChecks returns []');
    });

    suite.test('runScopeChecks calls checkFn and returns RuleResult', () => {
        const reg = new UCUFRuleRegistry();
        // Register a rule with a known checkFn
        reg.register({
            id: 'RT-DYN',
            name: 'dynamicCheck',
            severity: 'warning',
            enabled: true,
            triggerPoints: ['mount'],
            checkFn: (ctx: unknown) => (ctx as { ok: boolean }).ok === true,
        });
        RuntimeRuleChecker.setRegistry(reg);
        const passResults = RuntimeRuleChecker.runScopeChecks('mount', { ok: true });
        const dynPass = passResults.find(r => r.ruleId === 'RT-DYN');
        assert.isDefined(dynPass, 'Should include RT-DYN result in mount scope');
        assert.isTrue(dynPass!.passed, 'checkFn returning true should yield passed=true');

        const failResults = RuntimeRuleChecker.runScopeChecks('mount', { ok: false });
        const dynFail = failResults.find(r => r.ruleId === 'RT-DYN');
        assert.isDefined(dynFail);
        assert.isTrue(!dynFail!.passed, 'checkFn returning false should yield passed=false');
    });

    suite.test('runScopeChecks skips rules without checkFn', () => {
        const reg = new UCUFRuleRegistry();
        // RT-01 has no checkFn (built-in static)
        RuntimeRuleChecker.setRegistry(reg);
        const results = RuntimeRuleChecker.runScopeChecks('mount', {});
        // None of the builtin RT-01~RT-10 have checkFn, so results should be empty
        assert.equals(0, results.length, 'Rules without checkFn should not appear in runScopeChecks');
    });

    suite.test('runScopeChecks handles checkFn that throws (does not propagate)', () => {
        const reg = new UCUFRuleRegistry();
        reg.register({
            id: 'RT-THROW',
            name: 'throwingRule',
            severity: 'error',
            enabled: true,
            triggerPoints: ['mount'],
            checkFn: () => { throw new Error('intentional'); },
        });
        RuntimeRuleChecker.setRegistry(reg);
        let threw = false;
        try {
            const results = RuntimeRuleChecker.runScopeChecks('mount', {});
            const r = results.find(r => r.ruleId === 'RT-THROW');
            assert.isDefined(r);
            assert.isTrue(!r!.passed, 'Throwing checkFn should be treated as failed');
        } catch {
            threw = true;
        }
        assert.isTrue(!threw, 'runScopeChecks should not propagate checkFn exceptions');
    });

    return suite;
}
