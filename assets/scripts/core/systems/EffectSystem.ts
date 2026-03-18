import { Animation, Node, ParticleSystem, Vec3 } from "cc";
import { PoolSystem } from "./PoolSystem";
import { services } from "../managers/ServiceLoader";

/**
 * 視覺特效系統
 *
 * 統一管理特效 Prefab 的播放、定時自動回收。
 * 底層依賴 PoolSystem 做節點複用，避免 GC 壓力。
 *
 * Unity 對照：
 *   playEffect  ≈ Instantiate(prefab) + ParticleSystem.Play() + 定時 Destroy/Return to Pool
 *   recycleEffect ≈ 手動 ReturnToPool
 *   showDamageText ≈ 產生 World Space Canvas 文字飄字
 *
 * 使用方式：
 *   services().effect.playEffect("Boom", targetPos, 1.5, parentNode);
 *   services().effect.recycleEffect("FireAura", auraNode);
 */
export class EffectSystem {
    private poolSystem: PoolSystem | null = null;

    public setup(poolSystem: PoolSystem): void {
        this.poolSystem = poolSystem;
    }

    // ─────────────────────────────────────────
    //  主要 API
    // ─────────────────────────────────────────

    /**
     * 播放指定特效 Prefab，duration 秒後自動停止粒子並回收節點。
     * duration=0 表示不自動回收，需呼叫方手動 recycleEffect()。
     *
     * Unity 對照：
     *   Instantiate(prefab, position, rotation)
     *   + GetComponentsInChildren<ParticleSystem>().Play()
     *   + Destroy(go, duration)
     *
     * @param key      PoolSystem 中的 Prefab key
     * @param position 世界座標
     * @param duration 自動回收的秒數（0 = 不自動回收）
     * @param parent   掛載的父節點（可選）
     * @returns        取出的節點，null 表示 key 未在 PoolSystem 中註冊
     */
    public playEffect(key: string, position: Vec3, duration: number, parent?: Node): Node | null {
        const node = this.poolSystem?.acquire(key);
        if (!node) {
            console.warn(`[EffectSystem] key 未在 PoolSystem 中註冊: ${key}`);
            return null;
        }

        node.active = true;
        if (parent) node.parent = parent;
        node.setWorldPosition(position);

        this.playAllParticles(node);
        this.playAllAnimations(node);

        if (duration > 0) {
            // 使用 setTimeout 而非 scheduleOnce，因為 EffectSystem 不是 Component
            setTimeout(() => {
                this.stopAllParticles(node);
                this.stopAllAnimations(node);
                this.poolSystem?.release(key, node);
            }, duration * 1000);
        }

        return node;
    }

    /**
     * 手動停止特效並回收到物件池。
     * 用於 duration=0 的持續性特效（如 Buff 光環）。
     */
    public recycleEffect(key: string, node: Node): void {
        if (!this.poolSystem) {
            node.destroy();
            return;
        }
        this.stopAllParticles(node);
        this.stopAllAnimations(node);
        this.poolSystem.release(key, node);
    }

    /**
     * 傷害飄字入口（此版本將邏輯委託給 FloatTextSystem）
     * Unity 對照：在 World Space Canvas 上 Instantiate 飄字 Prefab
     */
    public showDamageText(position: Vec3, value: number, isCrit = false): void {
        services().floatText.showDamage(value, position, isCrit);
    }

    // ─────────────────────────────────────────
    //  內部工具：遞迴控制粒子與動畫
    // ─────────────────────────────────────────

    /** 播放節點樹下所有 ParticleSystem */
    public playAllParticles(node: Node): void {
        node.getComponentsInChildren(ParticleSystem).forEach(p => p.play());
    }

    /** 停止並清除節點樹下所有 ParticleSystem */
    public stopAllParticles(node: Node): void {
        node.getComponentsInChildren(ParticleSystem).forEach(p => { p.stop(); p.clear(); });
    }

    /** 播放節點樹下所有 Animation */
    public playAllAnimations(node: Node): void {
        node.getComponentsInChildren(Animation).forEach(a => a.play());
    }

    /** 停止節點樹下所有 Animation */
    public stopAllAnimations(node: Node): void {
        node.getComponentsInChildren(Animation).forEach(a => a.stop());
    }
}