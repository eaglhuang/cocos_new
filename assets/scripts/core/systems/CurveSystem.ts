/**
 * CurveSystem — 可視化數值曲線系統
 *
 * Unity 對照：
 *   - AnimationCurve + Keyframe 的 TypeScript 純邏輯版
 *   - 設計師可於 Inspector 視覺化編輯，程式只需 curve.evaluate(t) 取值
 *
 * 本版本為純 TypeScript，不依賴 cc 引擎（可直接 Node.js 測試）
 * 若之後需要與 Cocos Inspector 整合，可用 @property(CurveRange) 包裝。
 *
 * 用法範例：
 *   const c = new CurveAsset([{ t: 0, v: 1.0 }, { t: 1, v: 0.3 }]);
 *   const v = c.evaluate(0.5); // ≈ 0.65，線性插值
 */

// ─── 核心資料結構 ──────────────────────────────────────────────────────────────

/**
 * 曲線關鍵幀：(t, v) 對
 *  - t：時間軸 0~1（正規化）
 *  - v：當下數值（任意正負浮點數）
 */
export interface CurveKeyframe {
    t: number;
    v: number;
}

/**
 * 插值模式
 *   - Linear：線性插值（預設，效能佳，適合攻擊力衰減等）
 *   - Step：階梯型（t < next.t 就使用前一幀值，適合技能觸發點）
 */
export type CurveInterpolation = "linear" | "step";

// ─── CurveAsset ───────────────────────────────────────────────────────────────

/**
 * 單條曲線資產
 *
 * Unity 對照：AnimationCurve
 *   - Unity：AnimationCurve.Evaluate(time)
 *   - Cocos：CurveRange.evaluate(time, ratio)
 *   - 本類：CurveAsset.evaluate(t)
 */
export class CurveAsset {
    private keyframes: CurveKeyframe[];
    private interpolation: CurveInterpolation;

    /** @param keyframes 至少一個關鍵幀；建構時自動按 t 排序 */
    constructor(keyframes: CurveKeyframe[], interpolation: CurveInterpolation = "linear") {
        if (keyframes.length === 0) {
            throw new Error("[CurveAsset] 至少需要一個關鍵幀");
        }
        this.keyframes = [...keyframes].sort((a, b) => a.t - b.t);
        this.interpolation = interpolation;
    }

    /**
     * 依正規化時間 t（0~1）取得曲線值
     *
     * 邊界規則：
     *   - t < 第一個關鍵幀 → 夾回第一個關鍵幀值
     *   - t > 最後關鍵幀   → 夾回最後關鍵幀值
     *   - 中間：依 interpolation 模式插值
     */
    public evaluate(t: number): number {
        const kf = this.keyframes;

        // 邊界：夾值
        if (t <= kf[0].t) return kf[0].v;
        if (t >= kf[kf.length - 1].t) return kf[kf.length - 1].v;

        // 找到前後兩個關鍵幀
        for (let i = 0; i < kf.length - 1; i++) {
            const a = kf[i];
            const b = kf[i + 1];
            if (t >= a.t && t <= b.t) {
                if (this.interpolation === "step") {
                    return a.v;
                }
                // Linear interpolation
                const ratio = (t - a.t) / (b.t - a.t);
                return a.v + ratio * (b.v - a.v);
            }
        }

        return kf[kf.length - 1].v;
    }

    /** 回傳所有關鍵幀（唯讀副本） */
    public getKeyframes(): Readonly<CurveKeyframe[]> {
        return this.keyframes;
    }

    /** 關鍵幀數量 */
    public get length(): number {
        return this.keyframes.length;
    }
}

// ─── CurveGroup ───────────────────────────────────────────────────────────────

/**
 * 多條曲線的具名集合
 *
 * Unity 對照：自訂 ScriptableObject 包含多個 AnimationCurve 欄位
 *
 * 用途：
 *   - 一個技能可有「傷害衰減曲線」「範圍曲線」「冷卻曲線」三條
 *   - 統一用 CurveGroup 管理，透過名稱查詢
 */
export class CurveGroup {
    private curves = new Map<string, CurveAsset>();

    /**
     * 加入一條具名曲線
     * @param name 曲線名稱（如 "damage"、"range"、"cooldown"）
     */
    public add(name: string, curve: CurveAsset): this {
        this.curves.set(name, curve);
        return this;  // 支援 chain：group.add("dmg", c1).add("range", c2)
    }

    /**
     * 依名稱取得曲線；不存在則回傳 undefined
     */
    public getCurve(name: string): CurveAsset | undefined {
        return this.curves.get(name);
    }

    /**
     * 取值快捷方法：等同 getCurve(name)?.evaluate(t) ?? fallback
     * 找不到曲線時回傳 fallback（預設 1.0）
     */
    public evaluate(name: string, t: number, fallback = 1.0): number {
        const c = this.curves.get(name);
        return c ? c.evaluate(t) : fallback;
    }

    /** 所有已加入的曲線名稱 */
    public getCurveNames(): string[] {
        return Array.from(this.curves.keys());
    }

    /** 是否有此名稱的曲線 */
    public has(name: string): boolean {
        return this.curves.has(name);
    }
}

// ─── CurveSystem（服務層）──────────────────────────────────────────────────────

/**
 * CurveSystem — 管理並應用技能/Buff 的數值曲線
 *
 * 掛在 ServiceLoader 中，ActionSystem 和 BuffSystem 透過 services().curve 取用。
 *
 * 設計原則：
 *   - 曲線僅作為「乘數」或「修正值」，原始公式仍由 FormulaSystem 負責
 *   - 避免業務邏輯進入 CurveSystem，保持純計算
 */
export class CurveSystem {
    private skillCurves  = new Map<string, CurveGroup>();
    private buffCurves   = new Map<string, CurveGroup>();

    // ── 技能曲線 ───────────────────────────────────────────────────────────────

    /**
     * 注冊技能曲線組
     * @param skillId  技能 ID（對應 skills.json 的 id）
     * @param group    CurveGroup 實例
     */
    public registerSkillCurves(skillId: string, group: CurveGroup): void {
        this.skillCurves.set(skillId, group);
    }

    /**
     * 計算技能傷害乘數，依曲線衰減
     *
     * 用法：
     *   const mult = curve.getSkillDamageMultiplier("zhang-fei-roar", distance, maxDistance);
     *   const finalDmg = baseDmg * mult;
     *
     * @param skillId     技能 ID
     * @param distance    當前距離（格數、比例皆可）
     * @param maxDistance 最大距離（用於正規化為 0~1）
     * @returns 乘數（預設 1.0 = 無衰減）
     */
    public getSkillDamageMultiplier(skillId: string, distance: number, maxDistance: number): number {
        const group = this.skillCurves.get(skillId);
        if (!group) return 1.0;
        const t = maxDistance > 0 ? Math.min(1, Math.max(0, distance / maxDistance)) : 0;
        return group.evaluate("damage", t, 1.0);
    }

    /** 取得技能曲線組（供進階取值用） */
    public getSkillCurves(skillId: string): CurveGroup | undefined {
        return this.skillCurves.get(skillId);
    }

    // ── Buff 曲線 ──────────────────────────────────────────────────────────────

    /**
     * 注冊 Buff 曲線組
     * @param buffType  Buff 類型字串（對應 StatusEffect 或自訂字串）
     */
    public registerBuffCurves(buffType: string, group: CurveGroup): void {
        this.buffCurves.set(buffType, group);
    }

    /**
     * 計算 Buff 當前回合的數值乘數
     *
     * 用法：
     *   const mult = curve.getBuffValueMultiplier("poison", currentTurn, totalTurns);
     *   const dmg = baseDmg * mult;
     *
     * @param buffType     Buff ID（對應 StatusEffect 或自訂字串）
     * @param currentTurn  當前是第幾回合（0-based）
     * @param totalTurns   Buff 持續總回合數
     * @returns 乘數（預設 1.0）
     */
    public getBuffValueMultiplier(buffType: string, currentTurn: number, totalTurns: number): number {
        const group = this.buffCurves.get(buffType);
        if (!group) return 1.0;
        const t = totalTurns > 0 ? Math.min(1, Math.max(0, currentTurn / totalTurns)) : 0;
        return group.evaluate("intensity", t, 1.0);
    }

    /** 取得 Buff 曲線組 */
    public getBuffCurves(buffType: string): CurveGroup | undefined {
        return this.buffCurves.get(buffType);
    }

    /** 清除所有已注冊的曲線（場景切換時呼叫） */
    public clearAll(): void {
        this.skillCurves.clear();
        this.buffCurves.clear();
    }
}
