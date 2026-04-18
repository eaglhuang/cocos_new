/**
 * ucufLogger.test.ts — UCUFLogger 單元測試
 *
 * 涵蓋：分級過濾、分類輸出、runtime 開關、全局 hook 安裝
 *
 * 不依賴 Cocos runtime，純 TypeScript Node.js 環境可執行。
 */

import { TestSuite, assert } from '../TestRunner';
import { UCUFLogger, LogLevel, LogCategory } from '../../assets/scripts/ui/core/UCUFLogger';

export function createUCUFLoggerSuite(): TestSuite {
    const suite = new TestSuite('UCUF-UCUFLogger');

    // ── 級別設定 ────────────────────────────────────────────────────────────

    suite.test('setLevel/getLevel 往返正確 (DEBUG)', () => {
        UCUFLogger.setLevel(LogLevel.DEBUG);
        assert.equals(LogLevel.DEBUG, UCUFLogger.getLevel());
    });

    suite.test('setLevel/getLevel 往返正確 (ERROR)', () => {
        UCUFLogger.setLevel(LogLevel.ERROR);
        assert.equals(LogLevel.ERROR, UCUFLogger.getLevel());
        // 重設回 INFO 避免影響其他測試
        UCUFLogger.setLevel(LogLevel.INFO);
    });

    suite.test('setLevel INFO 後 getLevel 回傳 INFO', () => {
        UCUFLogger.setLevel(LogLevel.INFO);
        assert.equals(LogLevel.INFO, UCUFLogger.getLevel());
    });

    // ── 分級過濾（靜默驗證——只確認不拋出例外） ──────────────────────────────

    suite.test('debug() 在 INFO 模式下不拋出例外', () => {
        UCUFLogger.setLevel(LogLevel.INFO);
        // 低於 minLevel 的訊息應靜默過濾，不拋出
        UCUFLogger.debug(LogCategory.LIFECYCLE, 'should be filtered');
        assert.equals(true, true); // reach here = pass
    });

    suite.test('warn() 在 INFO 模式下不拋出例外', () => {
        UCUFLogger.setLevel(LogLevel.INFO);
        UCUFLogger.warn(LogCategory.SKIN, 'test warning');
        assert.equals(true, true);
    });

    suite.test('error() 在所有模式下不拋出例外', () => {
        UCUFLogger.setLevel(LogLevel.ERROR);
        UCUFLogger.error(LogCategory.RULE, 'test error output');
        UCUFLogger.setLevel(LogLevel.INFO);
        assert.equals(true, true);
    });

    // ── showCategory 旗標 ────────────────────────────────────────────────────

    suite.test('showCategory 可設為 false（不拋出）', () => {
        const prev = UCUFLogger.showCategory;
        UCUFLogger.showCategory = false;
        UCUFLogger.info(LogCategory.DATA, 'test no-category');
        UCUFLogger.showCategory = prev;
        assert.equals(true, true);
    });

    // ── 效能計時 API ────────────────────────────────────────────────────────

    suite.test('perfBegin/perfEnd 不拋出例外', () => {
        const t = UCUFLogger.perfBegin('test-operation');
        assert.equals(true, typeof t === 'number');
        UCUFLogger.perfEnd('test-operation', t);
        assert.equals(true, true);
    });

    // ── 全局 hook 安裝 ───────────────────────────────────────────────────────

    suite.test('installGlobalHooks 不拋出例外', () => {
        UCUFLogger.installGlobalHooks();
        assert.equals(true, true);
    });

    suite.test('installGlobalHooks 安裝後 __ucuf_logger 可存取', () => {
        UCUFLogger.installGlobalHooks();
        const g = globalThis as Record<string, unknown>;
        const lg = g['__ucuf_logger'];
        assert.equals(true, lg === UCUFLogger);
    });

    // ── 分類 enum 值檢查 ─────────────────────────────────────────────────────

    suite.test('LogCategory.LIFECYCLE 值為 lifecycle', () => {
        assert.equals('lifecycle', LogCategory.LIFECYCLE);
    });

    suite.test('LogCategory.PERFORMANCE 值為 performance', () => {
        assert.equals('performance', LogCategory.PERFORMANCE);
    });

    return suite;
}
