/**
 * BuffSystem 單元測試
 *
 * 測試範圍：
 *   - applyBuff：基本套用、重複效果取較長持續、多 unit 隔離
 *   - hasBuff：有效查詢、不存在 unit / 效果
 *   - tickBuff：倒計時遞減、過期自動移除、跨 unit 正確處理
 *   - clearUnit：陣亡清除所有效果
 *   - getBuffs：唯讀快照正確
 */

import { BuffSystem } from '../../core/systems/BuffSystem';
import { StatusEffect } from '../../core/config/Constants';
import { TestSuite, assert } from './TestRunner';

export function createBuffSuite(): TestSuite {
    const suite = new TestSuite('BuffSystem');

    // ── applyBuff ───────────────────────────────────────────────────────────

    suite.test('applyBuff：一般套用後 hasBuff 回傳 true', () => {
        const sys = new BuffSystem();
        sys.applyBuff('u1', StatusEffect.Stun, 2);
        assert.isTrue(sys.hasBuff('u1', StatusEffect.Stun));
    });

    suite.test('applyBuff：重複套用同效果 → 取較長持續時間', () => {
        const sys = new BuffSystem();
        sys.applyBuff('u1', StatusEffect.Stun, 1);
        sys.applyBuff('u1', StatusEffect.Stun, 3);  // 覆蓋為 3
        const buffs = sys.getBuffs('u1');
        assert.lengthEquals(1, buffs);
        assert.equals(3, (buffs as any[])[0].remainingTurns);
    });

    suite.test('applyBuff：重複套用較短持續時間 → 保留原本較長值', () => {
        const sys = new BuffSystem();
        sys.applyBuff('u1', StatusEffect.Stun, 5);
        sys.applyBuff('u1', StatusEffect.Stun, 2);  // 2 < 5 → 維持 5
        const buffs = sys.getBuffs('u1');
        assert.equals(5, (buffs as any[])[0].remainingTurns);
    });

    suite.test('applyBuff：不同 unit 互相隔離', () => {
        const sys = new BuffSystem();
        sys.applyBuff('u1', StatusEffect.Stun, 2);
        assert.isFalse(sys.hasBuff('u2', StatusEffect.Stun));
    });

    // ── hasBuff ─────────────────────────────────────────────────────────────

    suite.test('hasBuff：不存在的 unitId 回傳 false（不崩潰）', () => {
        const sys = new BuffSystem();
        assert.isFalse(sys.hasBuff('non-existent', StatusEffect.Stun));
    });

    suite.test('hasBuff：效果過期後回傳 false', () => {
        const sys = new BuffSystem();
        sys.applyBuff('u1', StatusEffect.Stun, 1);
        sys.tickBuff();  // 1 → 0，過期移除
        assert.isFalse(sys.hasBuff('u1', StatusEffect.Stun));
    });

    // ── tickBuff ─────────────────────────────────────────────────────────────

    suite.test('tickBuff：每次呼叫遞減 1 回合', () => {
        const sys = new BuffSystem();
        sys.applyBuff('u1', StatusEffect.Stun, 3);
        sys.tickBuff();
        // 3 → 2，仍存在
        assert.isTrue(sys.hasBuff('u1', StatusEffect.Stun));
        sys.tickBuff();
        // 2 → 1，仍存在
        assert.isTrue(sys.hasBuff('u1', StatusEffect.Stun));
        sys.tickBuff();
        // 1 → 0，過期移除
        assert.isFalse(sys.hasBuff('u1', StatusEffect.Stun));
    });

    suite.test('tickBuff：過期 unit 從 map 完整移除（getBuffs 回傳空陣列）', () => {
        const sys = new BuffSystem();
        sys.applyBuff('u1', StatusEffect.Stun, 1);
        sys.tickBuff();
        assert.lengthEquals(0, sys.getBuffs('u1'));
    });

    suite.test('tickBuff：多 unit 獨立倒計時', () => {
        const sys = new BuffSystem();
        sys.applyBuff('u1', StatusEffect.Stun, 1);
        sys.applyBuff('u2', StatusEffect.Stun, 2);
        sys.tickBuff();
        assert.isFalse(sys.hasBuff('u1', StatusEffect.Stun), 'u1 應已過期');
        assert.isTrue(sys.hasBuff('u2', StatusEffect.Stun),  'u2 應仍存在');
    });

    suite.test('tickBuff：無任何 buff 時不崩潰', () => {
        const sys = new BuffSystem();
        assert.doesNotThrow(() => sys.tickBuff());
    });

    // ── clearUnit ───────────────────────────────────────────────────────────

    suite.test('clearUnit：清除後 hasBuff 全部回傳 false', () => {
        const sys = new BuffSystem();
        sys.applyBuff('u1', StatusEffect.Stun, 5);
        sys.clearUnit('u1');
        assert.isFalse(sys.hasBuff('u1', StatusEffect.Stun));
        assert.lengthEquals(0, sys.getBuffs('u1'));
    });

    suite.test('clearUnit：不影響其他 unit', () => {
        const sys = new BuffSystem();
        sys.applyBuff('u1', StatusEffect.Stun, 3);
        sys.applyBuff('u2', StatusEffect.Stun, 3);
        sys.clearUnit('u1');
        assert.isTrue(sys.hasBuff('u2', StatusEffect.Stun));
    });

    suite.test('clearUnit：對不存在的 unitId 呼叫不崩潰', () => {
        const sys = new BuffSystem();
        assert.doesNotThrow(() => sys.clearUnit('ghost'));
    });

    // ── getBuffs ────────────────────────────────────────────────────────────

    suite.test('getBuffs：不存在的 unit 回傳空陣列（不崩潰）', () => {
        const sys = new BuffSystem();
        const buffs = sys.getBuffs('nobody');
        assert.lengthEquals(0, buffs);
    });

    suite.test('getBuffs：回傳所有套用效果', () => {
        const sys = new BuffSystem();
        sys.applyBuff('u1', StatusEffect.Stun, 2);
        const buffs = sys.getBuffs('u1');
        assert.lengthEquals(1, buffs);
    });

    return suite;
}
