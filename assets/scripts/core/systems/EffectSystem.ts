// @spec-source → 見 docs/cross-reference-index.md
import { Animation, MeshRenderer, Node, ParticleSystem, Sprite, Vec3 } from "cc";
import { VfxEffectDef } from "../config/VfxEffectConfig";
import { PoolSystem } from "./PoolSystem";
import { services } from "../managers/ServiceLoader";
import { ParticleOverride, applyParticleOverride } from "../utils/ParticleUtils";
import { VFX_BLOCK_REGISTRY } from "../../tools/vfx-block-registry";

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
    /** vfx-effects.json 的快取表（key = 效果 key，如 'hit_enemy'）*/
    private effectTable = new Map<string, VfxEffectDef>();

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

    // ─────────────────────────────────────────
    //  FxGroup：批次粒子群組控制（S-2）
    //  Unity 對照：GetComponentsInChildren<ParticleSystem>().ForEach(ps => ps.Play())
    // ─────────────────────────────────────────

    /**
     * 播放節點樹下所有 ParticleSystem 與 Animation。
     * 適用於由多個子粒子系統組成的技能特效 Prefab（例如：主爆炸 + 碎片 + 光環三個子系統）。
     *
     * @param node  特效根節點
     * @param loop  若填入值，強制覆寫每個 ParticleSystem 的 loop 屬性後再播放
     */
    public playGroup(node: Node, loop?: boolean): void {
        try {
            this.sanitizeVfxNode(node);

            const systems = node.getComponentsInChildren(ParticleSystem);
            if (loop !== undefined) systems.forEach(ps => ps.loop = loop);
            systems.forEach(ps => {
                try {
                    ps.play();
                } catch (e) {
                    console.error(`[EffectSystem] ParticleSystem播放失敗 (${node.name}):`, e);
                }
            });

            node.getComponentsInChildren(Animation).forEach(a => {
                try {
                    a.play();
                } catch (e) {
                    console.error(`[EffectSystem] Animation播放失敗 (${node.name}):`, e);
                }
            });
        } catch (e) {
            // [QA/Vibe] 捕捉頂層崩潰，確保不中斷遊戲循環
            console.error(`[EffectSystem] playGroup 發生嚴重錯誤 (${node.name}):`, e);
        }
    }

    /**
     * [DEFENSIVE] 清理/校正 VFX 節點狀態。
     * 防止如 Simple.updateUVs 等底層渲染崩潰。
     * 也確保 Layer 設定正確（非 UI 特效不應處於 UI Layer）。
     */
    private sanitizeVfxNode(node: Node): void {
        // 1. 強制 Layer 校正：若父節點非 UI，則特效不應在 UI 層級
        const UI_LAYER = 1 << 25; // 常見 UI Layer mask
        if (node.layer >= UI_LAYER) {
            // console.warn(`[EffectSystem] 特效節點 "${node.name}" Layer 異常 (${node.layer})，重設為 Default`);
            node.layer = 1; // Default Layer
            node.walk((child: Node) => { child.layer = 1; });
        }

        // 2. 深度檢查渲染組件：防止底層內核在 updateUVs 或 render 階段崩潰
        node.walk((target: Node) => {
            // 檢查 Sprite
            const sprite = target.getComponent(Sprite);
            if (sprite && sprite.enabled && !sprite.spriteFrame) {
                console.error(`[EffectSystem:Sanitize] 節點 "${target.name}" 缺少 SpriteFrame，已強制停用以防止 Simple.updateUVs 崩潰`);
                sprite.enabled = false;
            }

            // 檢查 MeshRenderer (防止 Mesh 為空或材質無效)
            const mr = target.getComponent(MeshRenderer);
            if (mr && mr.enabled) {
                if (!mr.mesh) {
                    console.error(`[EffectSystem:Sanitize] 節點 "${target.name}" 缺少 Mesh，已強制停用 MeshRenderer`);
                    mr.enabled = false;
                }
                const mat = mr.getSharedMaterial(0);
                if (!mat) {
                    console.error(`[EffectSystem:Sanitize] 節點 "${target.name}" 缺少 Material，已強制停用 MeshRenderer`);
                    mr.enabled = false;
                }
            }
        });
    }

    /**
     * 停止節點樹下所有 ParticleSystem 與 Animation。
     *
     * @param node   特效根節點
     * @param clear  是否同時清除場景中已存在的粒子（預設 false，讓現有粒子自然消亡）
     */
    public stopGroup(node: Node, clear = false): void {
        node.getComponentsInChildren(ParticleSystem).forEach(ps => {
            ps.stop();
            if (clear) ps.clear();
        });
        node.getComponentsInChildren(Animation).forEach(a => a.stop());
    }

    /**
     * 設定節點樹下所有 ParticleSystem 的 loop 屬性。
     * 用於持續特效（Buff 光環）需要動態切換循環/單次播放時。
     *
     * @param node  特效根節點
     * @param loop  true = 持續循環，false = 播放一次後自動停止
     */
    public setGroupLoop(node: Node, loop: boolean): void {
        node.getComponentsInChildren(ParticleSystem).forEach(ps => ps.loop = loop);
    }

    // ─────────────────────────────────────────
    //  playOnce：一次性特效語義明確版（S-4）
    // ─────────────────────────────────────────

    /**
     * 播放一次性特效（播放後自動回收，無需手動 recycleEffect）。
     * 語義等同 playEffect(key, position, duration, parent)，
     * 但名稱更明確地表達「一次性播放後回收」的意圖，適用於：
     *   - UnitDied 觸發的死亡爆炸
     *   - UnitDamaged 觸發的受擊衝擊波
     *   - 技能命中的一次性衝擊環
     *
     * Unity 對照：Object.Instantiate(prefab, pos) + Object.Destroy(go, duration)
     *
     * @param key      PoolSystem 中的 Prefab key
     * @param position 世界座標
     * @param duration 自動回收的秒數（預設 2.0 秒）
     * @param parent   掛載的父節點（可選）
     * @returns        取出的節點，null 表示 key 未在 PoolSystem 中註冊
     */
    public playOnce(key: string, position: Vec3, duration: number = 2.0, parent?: Node): Node | null {
        return this.playEffect(key, position, duration, parent);
    }

    // ─────────────────────────────────────────
    //  playBlock：VFX Block Registry 整合（M-3）
    //  Unity 對照：Addressables.LoadAssetAsync<GameObject>(blockId) + PlayEffect
    // ─────────────────────────────────────────

    /**
     * 依 VFX Block Registry 中的 blockId 播放特效，並可套用粒子動態覆寫。
     *
     * 這是 S-1~S-4 工作的整合出口：
     *   blockId → 查 VFX_BLOCK_REGISTRY 取得 renderMode / audio
     *         → PoolSystem.acquire(blockId) 取出節點
     *         → applyParticleOverride() 套用覆寫參數（可選）
     *         → playGroup() 啟動粒子群組
     *         → duration 秒後自動 release 回 pool
     *
     * 若 blockId 有對應的 audio 欄位，自動透過 AudioSystem 播放音效。
     *
     * @param blockId   VFX_BLOCK_REGISTRY 中的 id（同時也是 PoolSystem 的 key）
     * @param position  世界座標
     * @param override  可選的粒子動態覆寫參數（顏色、速度、大小等）
     * @param duration  自動回收秒數（預設 2.0），0 = 不自動回收
     * @param parent    掛載父節點（可選）
     * @returns         節點實例，null 表示 blockId 未在 PoolSystem 中註冊
     */
    public playBlock(
        blockId: string,
        position: Vec3,
        override?: ParticleOverride,
        duration: number = 2.0,
        parent?: Node
    ): Node | null {
        // 1. 查詢 Block 定義（驗證 blockId 合法性）
        const block = VFX_BLOCK_REGISTRY.find(b => b.id === blockId);
        if (!block) {
            console.warn(`[EffectSystem] playBlock: blockId "${blockId}" 在 VFX_BLOCK_REGISTRY 中不存在`);
            return null;
        }

        // 2. 從物件池取出節點
        const node = this.poolSystem?.acquire(blockId);
        if (!node) {
            // 輸出 renderMode 協助診斷（例：開發者忘記為 cpu-only 的 Trail 積木建立 Prefab）
            console.warn(`[EffectSystem] playBlock: "${blockId}" 未在 PoolSystem 中註冊。renderMode=${block.renderMode}`);
            return null;
        }

        // 3. 定位
        node.active = true;
        if (parent) node.parent = parent;
        node.setWorldPosition(position);

        // 4. 套用粒子動態覆寫（若有）
        if (override) {
            node.getComponentsInChildren(ParticleSystem)
                .forEach(ps => applyParticleOverride(ps, override));
        }

        // 5. 播放粒子群組與動畫
        this.playGroup(node);

        // 7. 定時回收
        if (duration > 0) {
            setTimeout(() => {
                this.stopGroup(node, true);
                this.poolSystem?.release(blockId, node);
            }, duration * 1000);
        }

        return node;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // M-7 三位一體：VFX + 音效 + 浮字通知
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * 批量注冊 VFX 效果定義（從 vfx-effects.json 載入後呼叫）。
     * 建議在 ServiceLoader.loadVfxEffects() 中使用。
     */
    public registerEffects(table: Record<string, VfxEffectDef>): void {
        for (const [key, def] of Object.entries(table)) {
            this.effectTable.set(key, def);
        }
    }

    /**
     * 特效-音效-通知三位一體播放 API。
     *
     * 單一入口觸發「特效 + 音效 + 浮字」，防止視/聽/邏輯不一致。
     *
     * Unity 對照：類似 SkillEffect.Play(key, position)，將三個子系統的觸發
     * 封裝成一個語意完整的操作，設計師只需在 vfx-effects.json 配置。
     *
     * 使用範例：
     *   services().effect.playFullEffect('hit_enemy', targetWorldPos);
     *   services().effect.playFullEffect('skill_zhang_fei', casterPos);
     *
     * @param key       vfx-effects.json 中的效果鍵名
     * @param position  世界座標
     * @param override  可選的粒子動態覆寫參數
     */
    public playFullEffect(key: string, position: Vec3, override?: ParticleOverride): void {
        const def = this.effectTable.get(key);
        if (!def) {
            console.warn(`[EffectSystem] playFullEffect: key "${key}" 未在 effectTable 中找到（已呼叫 loadVfxEffects 嗎？）`);
            return;
        }

        // 1. 播放特效 Block
        this.playBlock(def.blockId, position, override, def.lifetime ?? 2.0);

        // 2. 播放音效
        if (def.audio) {
            services().audio.playSfx(def.audio);
        }

        // 3. 顯示 floatText 通知
        if (def.notify?.type === 'floatText') {
            services().floatText.show('status', def.notify.textKey, position);
        }
    }

    /** 查詢已注冊的效果定義（給開發工具或 debug 用）。 */
    public getEffectDef(key: string): VfxEffectDef | undefined {
        return this.effectTable.get(key);
    }

    /** 列出所有已注冊的效果鍵名。 */
    public getAllEffectKeys(): string[] {
        return Array.from(this.effectTable.keys());
    }
}