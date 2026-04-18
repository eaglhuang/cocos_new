import { TestSuite, assert } from './TestRunner';
import {
    emitDeployDragDebug,
    shouldLogDeployDragMove,
} from '../assets/scripts/ui/components/DeployDragDebug';
import { UCUFLogger, LogLevel } from '../assets/scripts/ui/core/UCUFLogger';

/** 暫時覆蓋 console.log 並收集輸出，結束後還原。 */
function captureConsoleLog(fn: () => void): string[] {
    const captured: string[] = [];
    const orig = console.log;
    console.log = (...args: unknown[]) => { captured.push(args.map(a => String(a)).join(' ')); };
    try { fn(); } finally { console.log = orig; }
    return captured;
}

export function createDeployDragDebugSuite(): TestSuite {
    const suite = new TestSuite('DeployDragDebug');

    const savedLevel = UCUFLogger.getLevel();
    const restore = (): void => { UCUFLogger.setLevel(savedLevel); };

    // ── shouldLogDeployDragMove ───────────────────────────────────────────────

    suite.test('shouldLogDeployDragMove: 第一次 (lastLogged=0) 應可記錄', () => {
        assert.isTrue(shouldLogDeployDragMove(1000, 0, 120));
    });

    suite.test('shouldLogDeployDragMove: 間隔不足不應記錄', () => {
        assert.isFalse(shouldLogDeployDragMove(1080, 1000, 120));
    });

    suite.test('shouldLogDeployDragMove: 恰好到達 throttleMs 應可記錄', () => {
        assert.isTrue(shouldLogDeployDragMove(1120, 1000, 120));
    });

    suite.test('shouldLogDeployDragMove: throttleMs=0 時每次都可記錄', () => {
        assert.isTrue(shouldLogDeployDragMove(1001, 1000, 0));
    });

    // ── emitDeployDragDebug 委派 UCUFLogger ───────────────────────────────────

    suite.test('emitDeployDragDebug: INFO 級別時靜默（不應有 debug 輸出）', () => {
        UCUFLogger.setLevel(LogLevel.INFO);
        const logs = captureConsoleLog(() => {
            emitDeployDragDebug('DeployPanel', 'begin-drag', { lane: 1 });
        });
        restore();
        assert.lengthEquals(0, logs, 'INFO 級別時 DEBUG 訊息不應被輸出');
    });

    suite.test('emitDeployDragDebug: DEBUG 級別時應輸出（含 source/event）', () => {
        UCUFLogger.setLevel(LogLevel.DEBUG);
        const logs = captureConsoleLog(() => {
            emitDeployDragDebug('DeployPanel', 'begin-drag', { lane: 1 });
        });
        restore();
        assert.lengthEquals(1, logs, 'DEBUG 級別時應輸出一筆 log');
        assert.contains(logs[0], '[UCUF:drag]', 'log 應含分類前綴 [UCUF:drag]');
        assert.contains(logs[0], '[DeployPanel] begin-drag', 'log 應含 source/event');
    });

    suite.test('emitDeployDragDebug: payload 為 undefined 時也不拋錯', () => {
        UCUFLogger.setLevel(LogLevel.DEBUG);
        let threw = false;
        try { emitDeployDragDebug('TigerTallyComposite', 'emit-card-selected'); } catch { threw = true; }
        restore();
        assert.isFalse(threw, 'payload=undefined 不應拋出例外');
    });

    return suite;
}

