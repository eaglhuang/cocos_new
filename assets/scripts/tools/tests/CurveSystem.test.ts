/**
 * CurveSystem 單元測試
 *
 * 涵蓋範圍：
 *   - CurveAsset.evaluate：邊界夾值、線性插值、階梯插值
 *   - CurveGroup：add / getCurve / evaluate / has
 *   - CurveSystem：技能曲線衰減、Buff 強度曲線、未注冊時回傳 1.0
 *
 * 執行指令：node tools/run-tests.js
 */

import { CurveAsset, CurveGroup, CurveSystem } from '../../core/systems/CurveSystem';
import { TestSuite, assert } from './TestRunner';

export function createCurveSuite(): TestSuite {
    const suite = new TestSuite('CurveSystem');

    // ── CurveAsset：邊界夾值 ──────────────────────────────────────────────────

    suite.test('CurveAsset：t < 第一關鍵幀 → 取第一幀值', () => {
        const c = new CurveAsset([{ t: 0.2, v: 5 }, { t: 0.8, v: 10 }]);
        assert.equals(5, c.evaluate(0));
        assert.equals(5, c.evaluate(0.1));
    });

    suite.test('CurveAsset：t > 最後關鍵幀 → 取最後幀值', () => {
        const c = new CurveAsset([{ t: 0.2, v: 5 }, { t: 0.8, v: 10 }]);
        assert.equals(10, c.evaluate(1.0));
        assert.equals(10, c.evaluate(0.9));
    });

    suite.test('CurveAsset：t 剛好等於第一關鍵幀 t → 回傳第一幀值', () => {
        const c = new CurveAsset([{ t: 0, v: 1.0 }, { t: 1, v: 0.5 }]);
        assert.equals(1.0, c.evaluate(0));
    });

    suite.test('CurveAsset：t 剛好等於最後關鍵幀 t → 回傳最後幀值', () => {
        const c = new CurveAsset([{ t: 0, v: 1.0 }, { t: 1, v: 0.5 }]);
        assert.equals(0.5, c.evaluate(1));
    });

    // ── CurveAsset：線性插值 ──────────────────────────────────────────────────

    suite.test('CurveAsset 線性：中間點插值正確', () => {
        const c = new CurveAsset([{ t: 0, v: 0 }, { t: 1, v: 10 }]);
        const v = c.evaluate(0.5);
        assert.isTrue(Math.abs(v - 5) < 0.001, `expect ≈5, got ${v}`);
    });

    suite.test('CurveAsset 線性：三個關鍵幀，各段各自插值', () => {
        // 0→1(t:0~0.5) 然後 1→0(t:0.5~1.0)
        const c = new CurveAsset([
            { t: 0,   v: 0 },
            { t: 0.5, v: 1 },
            { t: 1.0, v: 0 },
        ]);
        const peak = c.evaluate(0.5);
        const quarter = c.evaluate(0.25);
        const threeQ  = c.evaluate(0.75);
        assert.isTrue(Math.abs(peak - 1) < 0.001, `peak expect 1, got ${peak}`);
        assert.isTrue(Math.abs(quarter - 0.5) < 0.001, `0.25 expect 0.5, got ${quarter}`);
        assert.isTrue(Math.abs(threeQ - 0.5) < 0.001, `0.75 expect 0.5, got ${threeQ}`);
    });

    suite.test('CurveAsset 線性：關鍵幀輸入不按順序，建構時自動排序', () => {
        const c = new CurveAsset([
            { t: 1,   v: 1.0 },
            { t: 0,   v: 0.0 },
            { t: 0.5, v: 0.5 },
        ]);
        const v = c.evaluate(0.5);
        assert.isTrue(Math.abs(v - 0.5) < 0.001, `expect 0.5, got ${v}`);
    });

    // ── CurveAsset：階梯插值 ──────────────────────────────────────────────────

    suite.test('CurveAsset 階梯：t 在區間內回傳前一幀值（不插值）', () => {
        const c = new CurveAsset([
            { t: 0,   v: 10 },
            { t: 0.5, v: 20 },
            { t: 1.0, v: 30 },
        ], "step");
        // t=0.3 在 [0, 0.5) 段 → 值為 10
        assert.equals(10, c.evaluate(0.3));
        // t=0.7 在 [0.5, 1.0) 段 → 值為 20
        assert.equals(20, c.evaluate(0.7));
        // t=1.0 → 最後幀 30
        assert.equals(30, c.evaluate(1.0));
    });

    // ── CurveAsset：防呆 ──────────────────────────────────────────────────────

    suite.test('CurveAsset：只有一個關鍵幀，任何 t 都回傳相同值', () => {
        const c = new CurveAsset([{ t: 0.5, v: 7 }]);
        assert.equals(7, c.evaluate(0));
        assert.equals(7, c.evaluate(0.5));
        assert.equals(7, c.evaluate(1));
    });

    suite.test('CurveAsset：空陣列建構應拋例外', () => {
        let threw = false;
        try { new CurveAsset([]); } catch { threw = true; }
        assert.isTrue(threw, 'expect constructor to throw with empty keyframes');
    });

    suite.test('CurveAsset length 屬性正確', () => {
        const c = new CurveAsset([{ t: 0, v: 1 }, { t: 0.5, v: 2 }, { t: 1, v: 3 }]);
        assert.equals(3, c.length);
    });

    // ── CurveGroup ───────────────────────────────────────────────────────────

    suite.test('CurveGroup：add + getCurve 可取到對應曲線', () => {
        const g = new CurveGroup();
        const c = new CurveAsset([{ t: 0, v: 1 }, { t: 1, v: 0 }]);
        g.add("damage", c);
        assert.isTrue(g.getCurve("damage") === c, 'getCurve should return same instance');
    });

    suite.test('CurveGroup：getCurve 不存在名稱回傳 undefined', () => {
        const g = new CurveGroup();
        assert.equals(undefined, g.getCurve("nonexist"));
    });

    suite.test('CurveGroup：evaluate 找到曲線時正確計算', () => {
        const g = new CurveGroup();
        g.add("damage", new CurveAsset([{ t: 0, v: 1.0 }, { t: 1, v: 0.5 }]));
        const v = g.evaluate("damage", 0.5);
        assert.isTrue(Math.abs(v - 0.75) < 0.001, `expect 0.75, got ${v}`);
    });

    suite.test('CurveGroup：evaluate 找不到名稱時回傳 fallback', () => {
        const g = new CurveGroup();
        assert.equals(1.0, g.evaluate("nonexist", 0.5));
        assert.equals(0.0, g.evaluate("nonexist", 0.5, 0.0));
    });

    suite.test('CurveGroup：has 正確回報曲線是否存在', () => {
        const g = new CurveGroup();
        g.add("test", new CurveAsset([{ t: 0, v: 1 }]));
        assert.isTrue(g.has("test"),    'has("test") should be true');
        assert.isTrue(!g.has("other"),   'has("other") should be false');
    });

    suite.test('CurveGroup：getCurveNames 回傳所有已加入名稱', () => {
        const g = new CurveGroup();
        g.add("a", new CurveAsset([{ t: 0, v: 1 }]));
        g.add("b", new CurveAsset([{ t: 0, v: 2 }]));
        const names = g.getCurveNames();
        assert.isTrue(names.includes("a") && names.includes("b"), 'should include a and b');
        assert.equals(2, names.length);
    });

    suite.test('CurveGroup：支援 chain add', () => {
        const g = new CurveGroup()
            .add("x", new CurveAsset([{ t: 0, v: 1 }]))
            .add("y", new CurveAsset([{ t: 0, v: 2 }]));
        assert.isTrue(g.has("x") && g.has("y"), 'chain add should register both curves');
    });

    // ── CurveSystem：技能曲線 ─────────────────────────────────────────────────

    suite.test('CurveSystem：未注冊技能 → 乘數回傳 1.0', () => {
        const cs = new CurveSystem();
        const mult = cs.getSkillDamageMultiplier("unknown-skill", 2, 5);
        assert.equals(1.0, mult);
    });

    suite.test('CurveSystem：技能傷害衰減曲線（距離越遠傷害越低）', () => {
        const cs = new CurveSystem();
        // 設計：距離 0 → 乘數 1.0，距離最大 → 乘數 0.3
        const group = new CurveGroup()
            .add("damage", new CurveAsset([{ t: 0, v: 1.0 }, { t: 1, v: 0.3 }]));
        cs.registerSkillCurves("fire-ball", group);

        const atZero = cs.getSkillDamageMultiplier("fire-ball", 0, 5);
        const atMax  = cs.getSkillDamageMultiplier("fire-ball", 5, 5);
        const atHalf = cs.getSkillDamageMultiplier("fire-ball", 2.5, 5);

        assert.isTrue(Math.abs(atZero - 1.0) < 0.001, `distance=0 expect 1.0, got ${atZero}`);
        assert.isTrue(Math.abs(atMax  - 0.3) < 0.001, `distance=max expect 0.3, got ${atMax}`);
        assert.isTrue(Math.abs(atHalf - 0.65) < 0.001, `distance=half expect 0.65, got ${atHalf}`);
    });

    suite.test('CurveSystem：distance > maxDistance 時 t 夾到 1', () => {
        const cs = new CurveSystem();
        const group = new CurveGroup()
            .add("damage", new CurveAsset([{ t: 0, v: 1.0 }, { t: 1, v: 0.0 }]));
        cs.registerSkillCurves("test", group);
        // distance 超過 maxDistance
        const mult = cs.getSkillDamageMultiplier("test", 999, 5);
        assert.isTrue(Math.abs(mult - 0.0) < 0.001, `expect 0.0, got ${mult}`);
    });

    suite.test('CurveSystem：maxDistance = 0 時不出現除零', () => {
        const cs = new CurveSystem();
        const group = new CurveGroup()
            .add("damage", new CurveAsset([{ t: 0, v: 1.0 }, { t: 1, v: 0.0 }]));
        cs.registerSkillCurves("test", group);
        const mult = cs.getSkillDamageMultiplier("test", 0, 0);
        // t=0 → evaluate(0) = 1.0
        assert.isTrue(Number.isFinite(mult), 'should not be NaN/Infinity');
    });

    // ── CurveSystem：Buff 曲線 ────────────────────────────────────────────────

    suite.test('CurveSystem：未注冊 Buff → 乘數回傳 1.0', () => {
        const cs = new CurveSystem();
        assert.equals(1.0, cs.getBuffValueMultiplier("poison", 0, 3));
    });

    suite.test('CurveSystem：Buff 強度遞增曲線（中毒每回合加劇）', () => {
        const cs = new CurveSystem();
        // 設計：第 0 回合乘數 0.5，第 3 回合乘數 1.5
        const group = new CurveGroup()
            .add("intensity", new CurveAsset([{ t: 0, v: 0.5 }, { t: 1, v: 1.5 }]));
        cs.registerBuffCurves("poison", group);

        const atStart = cs.getBuffValueMultiplier("poison", 0, 3);
        const atEnd   = cs.getBuffValueMultiplier("poison", 3, 3);
        const atMid   = cs.getBuffValueMultiplier("poison", 1, 3);

        assert.isTrue(Math.abs(atStart - 0.5) < 0.001, `turn=0 expect 0.5, got ${atStart}`);
        assert.isTrue(Math.abs(atEnd   - 1.5) < 0.001, `turn=max expect 1.5, got ${atEnd}`);
        // t = 1/3 ≈ 0.333 → v = 0.5 + 0.333*(1.5-0.5) = 0.833
        assert.isTrue(Math.abs(atMid - (0.5 + (1 / 3))) < 0.01, `turn=1 expect ≈0.833, got ${atMid}`);
    });

    suite.test('CurveSystem：clearAll 後所有曲線消失（回傳 1.0）', () => {
        const cs = new CurveSystem();
        const g = new CurveGroup().add("damage", new CurveAsset([{ t: 0, v: 0.1 }]));
        cs.registerSkillCurves("s1", g);
        cs.registerBuffCurves("b1", g);
        cs.clearAll();
        assert.equals(1.0, cs.getSkillDamageMultiplier("s1", 0, 1));
        assert.equals(1.0, cs.getBuffValueMultiplier("b1", 0, 1));
    });

    // ── 實際遊戲場景模擬 ──────────────────────────────────────────────────────

    suite.test('實戰模擬：張飛吼聲技能，近距傷害高遠距衰減', () => {
        const cs = new CurveSystem();
        // 吼聲：0格=100%, 2格=70%, 4格=30% — 非線性衰減
        const group = new CurveGroup().add("damage", new CurveAsset([
            { t: 0,    v: 1.0 },
            { t: 0.5,  v: 0.7 },
            { t: 1.0,  v: 0.3 },
        ]));
        cs.registerSkillCurves("zhang-fei-roar", group);

        const baseDmg = 200;
        const maxDist = 4;

        const d0 = baseDmg * cs.getSkillDamageMultiplier("zhang-fei-roar", 0, maxDist);
        const d2 = baseDmg * cs.getSkillDamageMultiplier("zhang-fei-roar", 2, maxDist);
        const d4 = baseDmg * cs.getSkillDamageMultiplier("zhang-fei-roar", 4, maxDist);

        assert.isTrue(d0 > d2 && d2 > d4, `傷害應遞減 d0=${d0}, d2=${d2}, d4=${d4}`);
        assert.isTrue(Math.abs(d0 - 200) < 0.1, `d0 expect 200, got ${d0}`);
        assert.isTrue(Math.abs(d4 - 60)  < 0.1, `d4 expect 60, got ${d4}`);
    });

    return suite;
}
