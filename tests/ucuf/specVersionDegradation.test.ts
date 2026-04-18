/**
 * specVersionDegradation.test.ts — UCUF M9-P2 spec version degradation tests
 *
 * 目的：驗證 UISpecLoader 的 specVersion forward-compat guard 邏輯：
 *   - specVersion 超過 CURRENT_SPEC_VERSION → 發出 warn，不拋出例外（graceful degradation）
 *   - specVersion 正常、為 null 或欄位不存在 → 靜默通過
 *
 * 設計說明：
 *   - 使用純 Node.js stub，不需要 Cocos runtime
 *   - checkSpecVersion() 完整複製 UISpecLoader.ts line 82-84 的邏輯
 *   - CURRENT_SPEC_VERSION = 1（對應 UISpecTypes.ts line 486）
 *
 * 對應原始碼：
 *   UISpecLoader.ts line 82:
 *     if (typeof (spec as any).specVersion === 'number' && (spec as any).specVersion > CURRENT_SPEC_VERSION) {
 *         console.warn(`[UISpecLoader] loadLayout: "${layoutId}" specVersion=... 超過引擎支援上限 ...`);
 *     }
 */

import { TestSuite, assert } from '../TestRunner';

// ─── Stub ─────────────────────────────────────────────────────────────────────

/** 鏡像 UISpecTypes.ts 的常數 */
const CURRENT_SPEC_VERSION = 1;

interface CheckResult {
    warned: boolean;
    warnMessage: string;
}

/**
 * 鏡像 UISpecLoader 的 specVersion 檢查邏輯。
 * 返回是否觸發 warn 及 warn 訊息內容，供測試斷言。
 */
function checkSpecVersion(spec: Record<string, unknown>, layoutId = 'test-layout'): CheckResult {
    let warned = false;
    let warnMessage = '';

    if (typeof spec.specVersion === 'number' && spec.specVersion > CURRENT_SPEC_VERSION) {
        warnMessage = `[UISpecLoader] loadLayout: "${layoutId}" specVersion=${spec.specVersion} 超過引擎支援上限 ${CURRENT_SPEC_VERSION}，部分功能可能無法正常運作`;
        warned = true;
    }

    return { warned, warnMessage };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

export function createSpecVersionDegradationSuite(): TestSuite {
    const suite = new TestSuite('UCUF-M9-SpecVersionDegradation');

    suite.test('T01: 無 specVersion 欄位應靜默通過', () => {
        const result = checkSpecVersion({ id: 'layout-a', version: 1 });
        assert.isFalse(result.warned, '無 specVersion 欄位不應觸發 warn');
    });

    suite.test('T02: specVersion 等於 CURRENT_SPEC_VERSION 應靜默通過', () => {
        const result = checkSpecVersion({ specVersion: 1 });
        assert.isFalse(result.warned, 'specVersion === CURRENT_SPEC_VERSION 不應觸發 warn');
    });

    suite.test('T03: specVersion 小於 CURRENT_SPEC_VERSION 應靜默通過', () => {
        // 舊版 spec 向後相容
        const result = checkSpecVersion({ specVersion: 0 });
        assert.isFalse(result.warned, 'specVersion < CURRENT_SPEC_VERSION 不應觸發 warn');
    });

    suite.test('T04: specVersion > CURRENT_SPEC_VERSION（specVersion: 2）應觸發 warn', () => {
        const result = checkSpecVersion({ specVersion: 2 });
        assert.isTrue(result.warned, 'specVersion=2 > 1 應觸發 warn');
    });

    suite.test('T05: specVersion: 999 應觸發 warn 且不拋出例外（graceful degradation）', () => {
        assert.doesNotThrow(() => {
            const result = checkSpecVersion({ specVersion: 999 });
            assert.isTrue(result.warned, 'specVersion=999 應觸發 warn');
        }, 'specVersion=999 不應拋出例外');
    });

    suite.test('T06: warn 訊息應包含 specVersion 值與 CURRENT_SPEC_VERSION', () => {
        const result = checkSpecVersion({ specVersion: 2 }, 'my-layout');
        assert.isTrue(result.warnMessage.includes('2'), `warn 應含 specVersion 值，實際：${result.warnMessage}`);
        assert.isTrue(result.warnMessage.includes(String(CURRENT_SPEC_VERSION)),
            `warn 應含 CURRENT_SPEC_VERSION，實際：${result.warnMessage}`);
        assert.isTrue(result.warnMessage.includes('my-layout'),
            `warn 應含 layoutId，實際：${result.warnMessage}`);
    });

    suite.test('T07: specVersion 為字串時不應觸發 warn（類型守衛）', () => {
        // UISpecLoader 使用 typeof === 'number' guard，字串不應觸發
        const result = checkSpecVersion({ specVersion: '999' as unknown as number });
        assert.isFalse(result.warned, 'specVersion 為字串時 typeof guard 應攔截，不觸發 warn');
    });

    suite.test('T08: specVersion 為 null 時不應觸發 warn（類型守衛）', () => {
        const result = checkSpecVersion({ specVersion: null as unknown as number });
        assert.isFalse(result.warned, 'specVersion=null 不應觸發 warn');
    });

    return suite;
}
