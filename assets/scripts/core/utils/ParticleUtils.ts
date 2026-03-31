// @spec-source → 見 docs/cross-reference-index.md
/**
 * ParticleUtils — 粒子系統動態覆寫工具（S-3）
 *
 * 提供統一介面，在執行期程式化修改 3D ParticleSystem 的各項參數，
 * 避免在多處散落直接存取 ParticleSystem 的子模組屬性。
 *
 * Unity 對照：
 *   相當於在 Unity 中對 ParticleSystem.MainModule / EmissionModule 等
 *   sub-struct 進行動態修改，並以 struct 賦值回 ParticleSystem 的模式。
 *   Cocos 3.8 採物件參考模式，直接修改屬性即生效，不需重新賦值。
 *
 * 使用方式：
 *   import { applyParticleOverride } from '../utils/ParticleUtils';
 *   applyParticleOverride(ps, { startColor: new Color(255, 0, 0), startSpeed: 8 });
 *
 * Unit Test 說明（M-4 時補齊）：
 *   此函式為純邏輯函式（無引擎渲染依賴，僅設定屬性），
 *   可 mock ParticleSystem 物件後對每個覆寫欄位進行驗證。
 */

import { Burst, Color, CurveRange, GradientRange, ParticleSystem } from 'cc';

// ─────────────────────────────────────────────────────────
//  覆寫參數介面
// ─────────────────────────────────────────────────────────

/**
 * 可動態覆寫的粒子參數集合。
 * 所有欄位皆為可選——只填寫想修改的欄位即可。
 *
 * Unity 對照：
 *   startColor     ≈ MainModule.startColor (Color mode)
 *   startSpeed     ≈ MainModule.startSpeed (Constant mode)
 *   startLifetime  ≈ MainModule.startLifetime (Constant mode)
 *   rateOverTime   ≈ EmissionModule.rateOverTime (Constant mode)
 *   startSize      ≈ MainModule.startSize (Constant mode, uniform)
 *   gravityModifier≈ MainModule.gravityModifier (Constant mode, CPU-only)
 *   loop           ≈ MainModule.loop
 */
export interface ParticleOverride {
    /** 起始顏色（直接替換，不混合） */
    startColor?: Color;
    /** 起始速度（常數模式，m/s） */
    startSpeed?: number;
    /** 粒子生命週期（常數模式，秒） */
    startLifetime?: number;
    /** 每秒發射數量（常數模式） */
    rateOverTime?: number;
    /**
     * 起始大小（常數模式，均一縮放）。
     * ⚠️ Cocos 3.8 對應屬性為 startSizeX（非 Unity 的 startSize）。
     * 若粒子系統開啟了 startSize3D，需另外設定 startSizeY / startSizeZ。
     */
    startSize?: number;
    /**
     * 重力係數（常數模式）。
     * ⚠️ 注意：此屬性僅 CPU 渲染器支援，GPU 渲染器會忽略。
     */
    gravityModifier?: number;
    /** 是否循環播放 */
    loop?: boolean;
    /** 是否載入後自動播放 */
    playOnAwake?: boolean;
    /** 粒子容量 */
    capacity?: number;
    /** 發射持續時間 */
    duration?: number;
    /** 模擬速度倍率 */
    simulationSpeed?: number;
    /** 起始延遲 */
    startDelay?: number;
    /** 每移動距離發射量 */
    rateOverDistance?: number;
    /** 3D 模式下的 Y 軸起始尺寸 */
    startSizeY?: number;
    /** 3D 模式下的 Z 軸起始尺寸 */
    startSizeZ?: number;
    /** 形狀模組半徑 */
    shapeRadius?: number;
    /** 形狀模組角度 */
    shapeAngle?: number;
    /** Burst 覆寫 */
    bursts?: ParticleBurstOverride[];
}

export interface ParticleBurstOverride {
    time: number;
    count: number;
    repeatCount?: number;
    repeatInterval?: number;
}

// ─────────────────────────────────────────────────────────
//  核心 API
// ─────────────────────────────────────────────────────────

/**
 * 將 ParticleOverride 參數套用到指定的 ParticleSystem。
 *
 * 只有 override 中有值的欄位才會被修改，其餘維持不變。
 * 修改後粒子系統需重新 play() 才會反映變動（若已在播放中，部分屬性即時生效）。
 *
 * @param ps       目標 ParticleSystem
 * @param override 要覆寫的參數集合（只填需要改動的欄位）
 *
 * @example
 * // 把一個火焰效果改成藍色低速版本
 * applyParticleOverride(ps, {
 *     startColor: new Color(64, 128, 255, 255),
 *     startSpeed: 2,
 *     rateOverTime: 30,
 * });
 */
export function applyParticleOverride(ps: ParticleSystem, override: ParticleOverride): void {
    if (override.startColor !== undefined) {
        // startColor 是 GradientRange，Color mode 時直接設定 color 屬性
        ps.startColor.color = override.startColor;
    }
    if (override.startSpeed !== undefined) {
        // startSpeed 是 CurveRange，Constant mode 時設定 constant 屬性
        ps.startSpeed.constant = override.startSpeed;
    }
    if (override.startLifetime !== undefined) {
        ps.startLifetime.constant = override.startLifetime;
    }
    if (override.startDelay !== undefined) {
        ps.startDelay.constant = override.startDelay;
    }
    if (override.rateOverTime !== undefined) {
        ps.rateOverTime.constant = override.rateOverTime;
    }
    if (override.rateOverDistance !== undefined) {
        ps.rateOverDistance.constant = override.rateOverDistance;
    }
    if (override.startSize !== undefined) {
        // Cocos 3.8 使用 startSizeX 作為均一縮放的起始大小
        // Unity 對照：ParticleSystem.main.startSize (Constant)
        ps.startSizeX.constant = override.startSize;
    }
    if (override.startSizeY !== undefined) {
        ps.startSizeY.constant = override.startSizeY;
    }
    if (override.startSizeZ !== undefined) {
        ps.startSizeZ.constant = override.startSizeZ;
    }
    if (override.gravityModifier !== undefined) {
        // GravityModifier 僅 CPU 渲染器有效，此處直接設定不做 renderer 檢查
        ps.gravityModifier.constant = override.gravityModifier;
    }
    if (override.loop !== undefined) {
        ps.loop = override.loop;
    }
    if (override.playOnAwake !== undefined) {
        ps.playOnAwake = override.playOnAwake;
    }
    if (override.capacity !== undefined) {
        ps.capacity = override.capacity;
    }
    if (override.duration !== undefined) {
        ps.duration = override.duration;
    }
    if (override.simulationSpeed !== undefined) {
        ps.simulationSpeed = override.simulationSpeed;
    }
    if (override.shapeRadius !== undefined && ps.shapeModule) {
        ps.shapeModule.radius = override.shapeRadius;
    }
    if (override.shapeAngle !== undefined && ps.shapeModule) {
        ps.shapeModule.angle = override.shapeAngle;
    }
    if (override.bursts !== undefined) {
        ps.bursts = override.bursts.map(spec => {
            const burst = new Burst();
            burst.time = spec.time;
            burst.repeatCount = spec.repeatCount ?? 1;
            burst.repeatInterval = spec.repeatInterval ?? 0;
            burst.count.constant = spec.count;
            return burst;
        });
    }
}

/**
 * 對一個節點樹下的所有 ParticleSystem 套用相同的覆寫參數。
 * 與 EffectSystem.playGroup() 搭配使用，先套用 override 再呼叫 playGroup。
 *
 * Unity 對照：foreach(ps in GetComponentsInChildren<ParticleSystem>()) { ... }
 *
 * @param systems  目標 ParticleSystem 陣列（由 node.getComponentsInChildren 取得）
 * @param override 要覆寫的參數集合
 */
export function applyGroupOverride(
    systems: ParticleSystem[],
    override: ParticleOverride,
): void {
    systems.forEach(ps => applyParticleOverride(ps, override));
}

/**
 * 重設粒子系統覆寫，重新播放（stop → clear → 套用覆寫 → play）。
 * 適用於需要在不同狀態間切換效果的持續型粒子（如 Buff 光環顏色變化）。
 *
 * @param ps       目標 ParticleSystem
 * @param override 新的覆寫參數
 */
export function resetAndApply(ps: ParticleSystem, override: ParticleOverride): void {
    ps.stop();
    ps.clear();
    applyParticleOverride(ps, override);
    ps.play();
}
