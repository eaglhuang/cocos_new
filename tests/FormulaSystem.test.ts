/**
 * FormulaSystem 單元測試
 *
 * 測試範圍：
 *   - calculateDamage：基本公式、互剋加成、地形修正、武將加成、最小傷害防呆
 *   - calculateGeneralAttack：武將化身攻擊力換算
 *   - calculateHeal：基本治療、floor value 防呆
 *   - getCounterMultiplier：所有互剋關係
 *
 * 執行方式：
 *   node tools/run-tests.js
 *   或在 Cocos DevMode 中由 TestEntryPoint.ts 觸發
 */

import { FormulaSystem, DamageContext } from '../../core/systems/FormulaSystem';
import { TroopType, TerrainType, COUNTER_MULTIPLIER, DISADVANTAGE_MULTIPLIER, MIN_DAMAGE } from '../../core/config/Constants';
import { TestSuite, assert } from './TestRunner';

// 每個 test 用全新的 FormulaSystem 實例（無狀態，所以可重用但明確隔離更清楚）
const formula = new FormulaSystem();

/** 建構標準 DamageContext 輔助，只Override必要欄位 */
function makeCtx(override: Partial<DamageContext>): DamageContext {
    return {
        attackerAttack:  100,
        defenderDefense: 50,
        attackerType:    TroopType.Infantry,
        defenderType:    TroopType.Archer,
        attackerTerrain: TerrainType.Plain,
        defenderTerrain: TerrainType.Plain,
        ...override,
    };
}

export function createFormulaSuite(): TestSuite {
    const suite = new TestSuite('FormulaSystem');

    // ── calculateDamage ─────────────────────────────────────────────────────

    suite.test('武將化身攻擊力（物理型）：STR×0.7 + LEA×0.3，保底 1', () => {
        // 張飛 str=90, lea=85 → 90×0.7 + 85×0.3 = 63 + 25.5 = 88
        assert.equals(88,  formula.calculateGeneralAttack({ str:  90, lea: 85 }));
        // 呂布 str=130, lea=95 → 130×0.7 + 95×0.3 = 91 + 28.5 = 119
        assert.equals(119, formula.calculateGeneralAttack({ str: 130, lea: 95 }));
        // 保底
        assert.equals(1,   formula.calculateGeneralAttack({ str: 0, lea: 0 }));
    });

    suite.test('武將化身攻擊力（謀略型）：INT×0.7 + LEA×0.3', () => {
        // 曹操 int=110, lea=80 → 110×0.7 + 80×0.3 = 77 + 24 = 101
        assert.equals(101, formula.calculateGeneralAttack({ int: 110, lea: 80 }));
    });

    suite.test('武將化身攻擊力（備用 fallback）：maxHp × 8%', () => {
        assert.equals(80, formula.calculateGeneralAttack({ maxHp: 1000 }));
        assert.equals(1,  formula.calculateGeneralAttack({ maxHp: 1 }));
    });

    suite.test('基本傷害 = max(MIN_DAMAGE, floor(atk - def))', () => {
        const dmg = formula.calculateDamage(makeCtx({ attackerAttack: 100, defenderDefense: 50 }));
        // Infantry vs Archer = 互剋（Infantry 剋 Shield，Archer 剋 Pikeman，Infantry vs Archer = 無關）
        // 無互剋、無地形、無加成 → 100 - 50 = 50
        assert.equals(50, dmg);
    });

    suite.test('互剋加成：騎兵 vs 步兵 應大於中立傷害', () => {
        const neutral = formula.calculateDamage(makeCtx({
            attackerType: TroopType.Engineer, // 無互剋鏈
            defenderType: TroopType.Engineer,
            attackerAttack: 100, defenderDefense: 20,
        }));
        const counter = formula.calculateDamage(makeCtx({
            attackerType: TroopType.Cavalry,
            defenderType: TroopType.Infantry,
            attackerAttack: 100, defenderDefense: 20,
        }));
        assert.isTrue(counter > neutral, `互剋傷害(${counter}) 應 > 中立傷害(${neutral})`);
        // 驗算：100 * 1.3 - 20 = 110
        assert.equals(110, counter);
    });

    suite.test('被剋弱化：步兵 被騎兵剋，傷害應小於中立', () => {
        const disadvantage = formula.calculateDamage(makeCtx({
            attackerType: TroopType.Infantry,
            defenderType: TroopType.Cavalry,  // Infantry 被 Cavalry 反剋
            attackerAttack: 100, defenderDefense: 20,
        }));
        // 100 * 0.7 - 20 = 50
        assert.equals(50, disadvantage);
    });

    suite.test('最小傷害防呆：極低攻擊力應回傳 MIN_DAMAGE', () => {
        const dmg = formula.calculateDamage(makeCtx({
            attackerAttack: 1,
            defenderDefense: 999,
        }));
        assert.equals(MIN_DAMAGE, dmg);
    });

    suite.test('地形攻擊加成（沙漠 +15%）提升輸出傷害', () => {
        const plain = formula.calculateDamage(makeCtx({ attackerTerrain: TerrainType.Plain }));
        const desert = formula.calculateDamage(makeCtx({ attackerTerrain: TerrainType.Desert }));
        assert.isTrue(desert > plain, `沙漠傷害(${desert}) 應 > 平原傷害(${plain})`);
    });

    suite.test('地形防禦加成（山地 +15%）降低承受傷害', () => {
        const plain = formula.calculateDamage(makeCtx({ defenderTerrain: TerrainType.Plain }));
        const mountain = formula.calculateDamage(makeCtx({ defenderTerrain: TerrainType.Mountain }));
        assert.isTrue(mountain < plain, `山地傷害(${mountain}) 應 < 平原傷害(${plain})`);
    });

    suite.test('武將攻擊加成(+50%)正確疊加', () => {
        const base = formula.calculateDamage(makeCtx({ attackerAttack: 100, defenderDefense: 0, attackBonus: 0 }));
        const boosted = formula.calculateDamage(makeCtx({ attackerAttack: 100, defenderDefense: 0, attackBonus: 0.5 }));
        // 100 * 1.5 = 150
        assert.equals(150, boosted);
        assert.isTrue(boosted > base);
    });

    suite.test('武將防禦加成(+30%)正確降低受到傷害', () => {
        const noBonus = formula.calculateDamage(makeCtx({ attackerAttack: 100, defenderDefense: 30, defenseBonus: 0 }));
        const bonus   = formula.calculateDamage(makeCtx({ attackerAttack: 100, defenderDefense: 30, defenseBonus: 0.3 }));
        assert.isTrue(bonus < noBonus, `有防禦加成(${bonus}) 應 < 無加成(${noBonus})`);
    });

    suite.test('傷害為整數（floor 驗證）', () => {
        // 101 * 1.3 - 50 * 1.15 = 131.3 - 57.5 = 73.8 → floor = 73
        const dmg = formula.calculateDamage(makeCtx({
            attackerAttack: 101, defenderDefense: 50,
            attackerType:    TroopType.Cavalry,
            defenderType:    TroopType.Infantry,
            defenderTerrain: TerrainType.Mountain,
        }));
        assert.equals(dmg, Math.floor(dmg), '傷害必須為整數');
    });

    // ── calculateHeal ───────────────────────────────────────────────────────

    suite.test('治療量 = max(floorValue, floor(maxHp * ratio))', () => {
        const heal = formula.calculateHeal(200);  // 200 * 0.12 = 24 > 20
        assert.equals(24, heal);
    });

    suite.test('治療 floorValue 防呆：極低 HP 仍回傳最低治療量', () => {
        const heal = formula.calculateHeal(10);  // 10 * 0.12 = 1.2 → max(20, 1) = 20
        assert.equals(20, heal);
    });

    suite.test('治療量為整數', () => {
        const heal = formula.calculateHeal(333);
        assert.equals(heal, Math.floor(heal), '治療量必須為整數');
    });

    // ── getCounterMultiplier ────────────────────────────────────────────────

    suite.test('互剋關係完整：騎兵剋步兵', () => {
        assert.equals(COUNTER_MULTIPLIER, formula.getCounterMultiplier(TroopType.Cavalry, TroopType.Infantry));
    });

    suite.test('互剋關係完整：步兵剋盾兵', () => {
        assert.equals(COUNTER_MULTIPLIER, formula.getCounterMultiplier(TroopType.Infantry, TroopType.Shield));
    });

    suite.test('互剋關係完整：盾兵剋弓兵', () => {
        assert.equals(COUNTER_MULTIPLIER, formula.getCounterMultiplier(TroopType.Shield, TroopType.Archer));
    });

    suite.test('互剋關係完整：弓兵剋長矛', () => {
        assert.equals(COUNTER_MULTIPLIER, formula.getCounterMultiplier(TroopType.Archer, TroopType.Pikeman));
    });

    suite.test('互剋關係完整：長矛剋騎兵', () => {
        assert.equals(COUNTER_MULTIPLIER, formula.getCounterMultiplier(TroopType.Pikeman, TroopType.Cavalry));
    });

    suite.test('被剋係數正確：步兵 被騎兵剋', () => {
        assert.equals(DISADVANTAGE_MULTIPLIER, formula.getCounterMultiplier(TroopType.Infantry, TroopType.Cavalry));
    });

    suite.test('無關係數 = 1.0', () => {
        // Engineer 不在互剋鏈中
        assert.equals(1.0, formula.getCounterMultiplier(TroopType.Engineer, TroopType.Medic));
    });

    // ── getCritChance / getDodgeChance ──────────────────────────────────────

    suite.test('getCritChance：LUK=0 = 基礎暴擊率 5%', () => {
        assert.equals(0.05, formula.getCritChance(0));
    });

    suite.test('getCritChance：LUK=50 → 0.05 + 50/200 = 0.30', () => {
        assert.equals(0.30, formula.getCritChance(50));
    });

    suite.test('getCritChance：LUK=200 → 0.05 + 1.0 = 1.05 → 上限 0.50', () => {
        assert.equals(0.50, formula.getCritChance(200));
    });

    suite.test('getCritChance：超高 LUK 不超過 0.50 上限', () => {
        assert.equals(0.50, formula.getCritChance(9999));
    });

    suite.test('getDodgeChance：LUK=0 = 基礎閃躲率 3%', () => {
        assert.equals(0.03, formula.getDodgeChance(0));
    });

    suite.test('getDodgeChance：LUK=100 → 0.03 + 100/400 = 0.28', () => {
        assert.equals(0.28, formula.getDodgeChance(100));
    });

    suite.test('getDodgeChance：LUK=148 → 0.03 + 148/400 = 0.40 → 上限', () => {
        // 0.03 + 0.37 = 0.40 剛好觸上限
        assert.equals(0.40, formula.getDodgeChance(148));
    });

    suite.test('getDodgeChance：超高 LUK 不超過 0.40 上限', () => {
        assert.equals(0.40, formula.getDodgeChance(9999));
    });

    return suite;
}
