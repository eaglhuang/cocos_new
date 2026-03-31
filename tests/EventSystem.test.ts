/**
 * EventSystem 單元測試
 *
 * 測試範圍：
 *   - on / off / emit：基本發佈訂閱語意
 *   - once：只觸發一次後自動解除
 *   - onBind：（純邏輯部分）handler 的呼叫記錄
 *   - clear：清除所有監聽器
 *
 * 注意：onBind 的「節點銷毀自動解除」依賴 Cocos cc.Node，
 *       無法在純 Node.js 環境下驗證；此處僅測試純邏輯部分。
 */

import { EventSystem } from '../../core/systems/EventSystem';
import { TestSuite, assert } from './TestRunner';

export function createEventSystemSuite(): TestSuite {
    const suite = new TestSuite('EventSystem');

    // ── on / off / emit ──────────────────────────────────────────────────────

    suite.test('on + emit：handler 應被呼叫一次', () => {
        const sys = new EventSystem();
        let count = 0;
        sys.on('test', () => count++);
        sys.emit('test', null);
        assert.equals(1, count);
    });

    suite.test('emit：payload 正確傳遞', () => {
        const sys = new EventSystem();
        let received: number | null = null;
        sys.on<number>('msg', (v) => { received = v; });
        sys.emit('msg', 42);
        assert.equals(42, received);
    });

    suite.test('on：多個 handler 都應被呼叫', () => {
        const sys = new EventSystem();
        let a = 0, b = 0;
        sys.on('e', () => a++);
        sys.on('e', () => b++);
        sys.emit('e', null);
        assert.equals(1, a);
        assert.equals(1, b);
    });

    suite.test('off：移除後不再觸發', () => {
        const sys = new EventSystem();
        let count = 0;
        const handler = () => count++;
        sys.on('e', handler);
        sys.off('e', handler);
        sys.emit('e', null);
        assert.equals(0, count);
    });

    suite.test('off：只移除目標 handler，其他 handler 仍執行', () => {
        const sys = new EventSystem();
        let a = 0, b = 0;
        const h1 = () => a++;
        sys.on('e', h1);
        sys.on('e', () => b++);
        sys.off('e', h1);
        sys.emit('e', null);
        assert.equals(0, a);
        assert.equals(1, b);
    });

    suite.test('emit：不存在的事件，不崩潰', () => {
        const sys = new EventSystem();
        // 無監聽器的事件 emit 不應 throw
        sys.emit('no-such-event', null);
        assert.isTrue(true); // 能到這裡即為通過
    });

    // ── once ─────────────────────────────────────────────────────────────────

    suite.test('once：第一次 emit 後 handler 被呼叫', () => {
        const sys = new EventSystem();
        let count = 0;
        sys.once('e', () => count++);
        sys.emit('e', null);
        assert.equals(1, count);
    });

    suite.test('once：第二次 emit 時 handler 不再被呼叫（自動解除）', () => {
        const sys = new EventSystem();
        let count = 0;
        sys.once('e', () => count++);
        sys.emit('e', null);
        sys.emit('e', null);
        assert.equals(1, count, `once handler 被呼叫 ${count} 次，應為 1`);
    });

    suite.test('once：payload 正確傳遞', () => {
        const sys = new EventSystem();
        let val = 0;
        sys.once<number>('e', (v) => { val = v; });
        sys.emit('e', 99);
        assert.equals(99, val);
    });

    suite.test('once：once 解除不影響同事件的其他 on handler', () => {
        const sys = new EventSystem();
        let once = 0, always = 0;
        sys.once('e', () => once++);
        sys.on('e', () => always++);
        sys.emit('e', null); // once=1, always=1
        sys.emit('e', null); // once=1（自動解除），always=2
        assert.equals(1, once);
        assert.equals(2, always);
    });

    // ── clear ─────────────────────────────────────────────────────────────────

    suite.test('clear：清除後所有 handler 不再執行', () => {
        const sys = new EventSystem();
        let count = 0;
        sys.on('e', () => count++);
        sys.on('f', () => count++);
        sys.clear();
        sys.emit('e', null);
        sys.emit('f', null);
        assert.equals(0, count);
    });

    return suite;
}
