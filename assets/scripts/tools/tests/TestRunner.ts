/**
 * TestRunner — 輕量 UnitTest 框架
 *
 * 設計目標：
 *   - 零外部依賴，純 TypeScript，可在 Cocos Creator 的 DevMode 啟動時執行（無需 Node.js）
 *   - 也可在 Node.js CLI 下執行（tools/run-tests.js wrapper）
 *   - 輸出類 Jest / Unity Test Runner 風格的 Green ✅ / Red ❌ 報告
 *
 * 使用方式：
 *   const suite = new TestSuite("FormulaSystem");
 *   suite.test("基本傷害計算", () => {
 *       assert.equals(10, formulaSystem.calculateDamage({...}));
 *   });
 *   suite.run();
 *
 * Unity 對照：
 *   TestSuite ≈ NUnit [TestFixture]
 *   suite.test() ≈ [Test] attribute
 *   assert.equals()  ≈ Assert.AreEqual()
 *   assert.isTrue()  ≈ Assert.IsTrue()
 */

// ─────────────────────────────────────────────────────────────────────────────
//  斷言工具（Assert）
// ─────────────────────────────────────────────────────────────────────────────

export class AssertionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AssertionError';
    }
}

export const assert = {
    /** 相等（使用 === 精確比較） */
    equals<T>(expected: T, actual: T, msg?: string): void {
        if (expected !== actual) {
            throw new AssertionError(
                msg || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
            );
        }
    },

    /** 不相等 */
    notEquals<T>(unexpected: T, actual: T, msg?: string): void {
        if (unexpected === actual) {
            throw new AssertionError(
                msg || `Expected value to differ from ${JSON.stringify(unexpected)}`
            );
        }
    },

    /** 值為 true */
    isTrue(value: boolean, msg?: string): void {
        if (!value) throw new AssertionError(msg || 'Expected true, got false');
    },

    /** 值為 false */
    isFalse(value: boolean, msg?: string): void {
        if (value) throw new AssertionError(msg || 'Expected false, got true');
    },

    /** 大於等於 */
    greaterOrEqual(min: number, actual: number, msg?: string): void {
        if (actual < min) {
            throw new AssertionError(
                msg || `Expected >= ${min}, got ${actual}`
            );
        }
    },

    /** 數值在指定範圍內（含兩端） */
    inRange(actual: number, min: number, max: number, msg?: string): void {
        if (actual < min || actual > max) {
            throw new AssertionError(
                msg || `Expected value in [${min}, ${max}], got ${actual}`
            );
        }
    },

    /** 陣列長度符合預期 */
    lengthEquals(expected: number, arr: ArrayLike<unknown>, msg?: string): void {
        if (arr.length !== expected) {
            throw new AssertionError(
                msg || `Expected length ${expected}, got ${arr.length}`
            );
        }
    },

    /** 字串包含子字串 */
    contains(haystack: string, needle: string, msg?: string): void {
        if (haystack.indexOf(needle) === -1) {
            throw new AssertionError(
                msg || `Expected "${haystack}" to contain "${needle}"`
            );
        }
    },

    /** 字串不包含子字串（用於 deprecated API 掃描） */
    notContains(haystack: string, needle: string, msg?: string): void {
        if (haystack.indexOf(needle) !== -1) {
            throw new AssertionError(
                msg || `Found banned string "${needle}" in content`
            );
        }
    },

    /** 呼叫應拋出例外 */
    throws(fn: () => unknown, msg?: string): void {
        let threw = false;
        try { fn(); } catch (_) { threw = true; }
        if (!threw) throw new AssertionError(msg || 'Expected function to throw');
    },

    /** 呼叫不應拋出例外 */
    doesNotThrow(fn: () => unknown, msg?: string): void {
        try {
            fn();
        } catch (e) {
            throw new AssertionError(msg || `Expected no throw, got: ${(e as Error).message}`);
        }
    },

    /** 值不為 null 也不為 undefined */
    isDefined<T>(value: T | null | undefined, msg?: string): void {
        if (value === null || value === undefined) {
            throw new AssertionError(msg || `Expected defined value, got ${value}`);
        }
    },
};

// ─────────────────────────────────────────────────────────────────────────────
//  TestCase & TestSuite
// ─────────────────────────────────────────────────────────────────────────────

export interface TestCase {
    name: string;
    fn: () => void | Promise<void>;
}

export interface TestResult {
    suiteName:  string;
    caseName:   string;
    passed:     boolean;
    error?:     string;
    durationMs: number;
}

export class TestSuite {
    private cases: TestCase[] = [];

    constructor(public readonly name: string) {}

    /**
     * 登錄一個測試案例。
     * 支援同步與非同步（回傳 Promise）兩種測試函式。
     */
    test(name: string, fn: () => void | Promise<void>): this {
        this.cases.push({ name, fn });
        return this;
    }

    /** 跳過該測試（暫時標記為 skip，不執行但會在報告中顯示） */
    skip(name: string, _fn: () => void): this {
        this.cases.push({ name: `[SKIP] ${name}`, fn: () => {} });
        return this;
    }

    async run(): Promise<TestResult[]> {
        const results: TestResult[] = [];
        for (const tc of this.cases) {
            const start = Date.now();
            let passed = true;
            let error: string | undefined;
            try {
                const ret = tc.fn();
                if (ret instanceof Promise) await ret;
            } catch (e) {
                passed = false;
                error = (e as Error).message ?? String(e);
            }
            results.push({
                suiteName:  this.name,
                caseName:   tc.name,
                passed,
                error,
                durationMs: Date.now() - start,
            });
        }
        return results;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  TestRunner — 整合所有 Suite，輸出彙整報告
// ─────────────────────────────────────────────────────────────────────────────

export interface RunSummary {
    total:   number;
    passed:  number;
    failed:  number;
    skipped: number;
    results: TestResult[];
}

export class TestRunner {
    private suites: TestSuite[] = [];

    /** 登錄一個測試 Suite */
    register(suite: TestSuite): this {
        this.suites.push(suite);
        return this;
    }

    /** 執行所有已登錄的 Suite，回傳彙整報告 */
    async runAll(): Promise<RunSummary> {
        const allResults: TestResult[] = [];
        for (const suite of this.suites) {
            const results = await suite.run();
            allResults.push(...results);
        }
        return this.buildSummary(allResults);
    }

    private buildSummary(results: TestResult[]): RunSummary {
        let passed = 0;
        let failed = 0;
        let skipped = 0;

        for (const r of results) {
            if (r.caseName.indexOf('[SKIP]') === 0) { skipped++; continue; }
            r.passed ? passed++ : failed++;
        }

        // 印出報告（console 輸出可在 Cocos DevMode 看到）
        const divider = '═'.repeat(60);
        console.log(`\n${divider}`);
        console.log('  UnitTest Report');
        console.log(divider);

        let lastSuite = '';
        for (const r of results) {
            if (r.suiteName !== lastSuite) {
                console.log(`\n  📦 ${r.suiteName}`);
                lastSuite = r.suiteName;
            }
            if (r.caseName.indexOf('[SKIP]') === 0) {
                console.log(`    ⏭  ${r.caseName.replace('[SKIP] ', '')} (skipped)`);
            } else if (r.passed) {
                console.log(`    ✅ ${r.caseName} (${r.durationMs}ms)`);
            } else {
                console.log(`    ❌ ${r.caseName} (${r.durationMs}ms)`);
                console.log(`       └─ ${r.error}`);
            }
        }

        const statusLine = failed === 0
            ? `🟢  ALL PASS: ${passed} passed, ${skipped} skipped`
            : `🔴  FAILED: ${failed} failed / ${passed} passed / ${skipped} skipped`;

        console.log(`\n${divider}`);
        console.log(`  ${statusLine}`);
        console.log(`${divider}\n`);

        return { total: results.length, passed, failed, skipped, results };
    }
}

/** 全域預設 Runner 實例（方便直接 import 使用） */
export const globalRunner = new TestRunner();
