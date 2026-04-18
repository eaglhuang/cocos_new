// @spec-source → 見 docs/cross-reference-index.md
import { Animation, Camera, MeshRenderer, Node, ParticleSystem, Sprite, Vec3, director, tween, v3 } from "cc";
import { VfxBlockEntry, VfxEffectDef } from "../config/VfxEffectConfig";
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
        // 1. 強制 Layer 校正：3D 特效用 DEFAULT layer 才能被 3D Camera 渲染
        const DEFAULT_LAYER = 1 << 0;  // Layers.Enum.DEFAULT
        const UI_LAYER = 1 << 25;
        const needsLayerFix = node.layer >= UI_LAYER;

        if (needsLayerFix) {
            console.warn(`[EffectSystem:Sanitize] "${node.name}" Layer=${node.layer} 在 UI 層級，強制修正為 DEFAULT`);
        }

        // 對整棵節點樹設定 layer（即使當前正確也統一設定，防止子節點不一致）
        node.layer = DEFAULT_LAYER;
        node.walk((child: Node) => {
            child.layer = DEFAULT_LAYER;
        });

        // 2. 診斷 ParticleSystem 狀態
        const allPS = node.getComponentsInChildren(ParticleSystem);
        let enabledCount = 0;
        allPS.forEach(ps => {
            if (!ps.enabled) {
                // [TEMP-QA] 若 PS 被 BuffEffectPrefabController 停用，嘗試重新啟用
                // 除非是根節點上的「遺留」PS（通常被 disableLegacyRootParticle 明確停用）
                const isRootPS = ps.node === node;
                if (!isRootPS) {
                    console.warn(`[EffectSystem:Sanitize] 重新啟用被停用的 PS: "${ps.node.name}"`);
                    ps.enabled = true;
                    ps.playOnAwake = true;
                }
            }
            if (ps.enabled) enabledCount++;
        });

        if (enabledCount === 0 && allPS.length > 0) {
            console.error(`[EffectSystem:Sanitize] "${node.name}" 所有 ${allPS.length} 個 ParticleSystem 都被停用！特效將不可見。`);
        }

        // 3. 深度檢查渲染組件：防止底層內核在 updateUVs 或 render 階段崩潰
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
            const message = `[EffectSystem] playBlock: "${blockId}" 未在 PoolSystem 中註冊（prefab 載入失敗？）。renderMode=${block.renderMode}, prefabPath=${block.prefabPath ?? '未設定'}`;
            if (this._isPreviewMode()) {
                console.log(`${message} [preview mode skip]`);
            } else {
                console.error(message);
            }
            return null;
        }

        // 3. 定位
        node.active = true;
        if (parent) node.parent = parent;
        node.setWorldPosition(position);

        // 4. 先執行 sanitize（修正 layer / 重新啟用被停用的 PS）
        this.sanitizeVfxNode(node);

        // 5. 套用粒子動態覆寫（在 sanitize 之後，確保新啟用的 PS 也能接收到覆寫）
        const allPS = node.getComponentsInChildren(ParticleSystem);
        if (override) {
            allPS.filter(ps => ps.enabled).forEach(ps => applyParticleOverride(ps, override));
        }

        // 6. [TEMP-QA] 診斷日誌：確認粒子系統狀態
        const enabledPS = allPS.filter(ps => ps.enabled);
        console.log(`[EffectSystem:playBlock] "${blockId}" PS狀態: 全部=${allPS.length}, 啟用=${enabledPS.length}, Layer=${node.layer}, Pos=${position.toString()}`);
        enabledPS.forEach(ps => {
            const renderer = (ps as any).renderer;
            const hasTexture = renderer?._mainTexture != null;
            const hasMaterial = renderer?._cpuMaterial != null || renderer?._gpuMaterial != null;
            console.log(`  ↳ PS "${ps.node.name}": size=${ps.startSizeX.constant.toFixed(2)}, speed=${ps.startSpeed.constant.toFixed(2)}, rate=${ps.rateOverTime.constant}, tex=${hasTexture}, mat=${hasMaterial}, loop=${ps.loop}`);
        });

        // 7. 播放粒子群組與動畫（跳過重複 sanitize）
        try {
            allPS.filter(ps => ps.enabled).forEach(ps => {
                try { ps.play(); } catch (e) {
                    console.error(`[EffectSystem] PS播放失敗 "${ps.node.name}":`, e);
                }
            });
            node.getComponentsInChildren(Animation).forEach(a => {
                try { a.play(); } catch (e) {
                    console.error(`[EffectSystem] Animation播放失敗:`, e);
                }
            });
        } catch (e) {
            console.error(`[EffectSystem] playBlock 渲染啟動失敗 "${blockId}":`, e);
        }

        // 8. 定時回收
        if (duration > 0) {
            setTimeout(() => {
                this.stopGroup(node, true);
                this.poolSystem?.release(blockId, node);
            }, duration * 1000);
        }

        return node;
    }

    private _isPreviewMode(): boolean {
        try {
            const globalScope = globalThis as any;
            const search = globalScope?.window?.location?.search as string | undefined;
            const query = new URLSearchParams(search ?? '');
            const queryMode = query.get('previewMode') ?? query.get('PREVIEW_MODE');
            const storedMode = globalScope?.window?.localStorage?.getItem('PREVIEW_MODE') ?? '';
            return queryMode === 'true' || storedMode === 'true';
        } catch {
            return false;
        }
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
     * v2 起：若 def.blocks[] 存在且不為空，改用 playComposite() 依序播放多層積木；
     *         否則沿用 v1 的單 blockId 行為，保持完全向下相容。
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

        // 1. 播放特效（v2 多層 / v1 單層）
        if (def.blocks && def.blocks.length > 0) {
            this.playComposite(def.blocks, position, def.lifetime ?? 2.0, override);
        } else {
            this.playBlock(def.blockId, position, override, def.lifetime ?? 2.0);
        }

        // 2. 鏡頭震動（v2）
        if (def.cameraShake) {
            this.playCameraShake(def.cameraShake.strength, def.cameraShake.duration);
        }

        // 3. 播放音效
        if (def.audio) {
            services().audio.playSfx(def.audio);
        }

        // 4. 顯示 floatText 通知
        if (def.notify?.type === 'floatText') {
            services().floatText.show('status', def.notify.textKey, position);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Milestone 2：多層積木組合播放（v2）
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * 依照 blocks[] 定義依序播放多個 VFX Block，每個 block 可設定獨立延遲與參數。
     *
     * 設計意圖：讓配方設計師能在 vfx-effects.json 中疊加 3~5 個積木，
     * 形成「蓄氣 → 揮砍 → 衝擊波」等分層動態，而不需要手動建 compound prefab。
     *
     * @param blocks     積木序列（已通過 normalizeBlockEntries 驗證）
     * @param basePos    世界座標（各積木相對此點套用 offset）
     * @param lifetime   父 effect 的存活秒數（作為 block duration 的 fallback）
     * @param override   粒子動態覆寫（套用到所有 block）
     */
    public playComposite(
        blocks: readonly VfxBlockEntry[],
        basePos: Vec3,
        lifetime: number,
        override?: ParticleOverride,
    ): void {
        for (const entry of blocks) {
            const delayMs = Math.max(0, entry.delay) * 1000;
            const duration = entry.duration ?? lifetime;

            // 合併 override：塊級 scale 優先，否則沿用父級 override
            const blockOverride: ParticleOverride | undefined = (() => {
                if (!entry.scale && !entry.tintHex && !override) return undefined;
                return {
                    ...override,
                    ...(entry.scale !== undefined ? { startSizeX: entry.scale } : {}),
                };
            })();

            // 計算實際世界座標（套用 offset）
            const pos = entry.offset
                ? new Vec3(
                    basePos.x + entry.offset[0],
                    basePos.y + entry.offset[1],
                    basePos.z + entry.offset[2],
                )
                : basePos;

            if (delayMs <= 0) {
                this.playBlock(entry.blockId, pos, blockOverride, duration);
            } else {
                setTimeout(() => {
                    this.playBlock(entry.blockId, pos, blockOverride, duration);
                }, delayMs);
            }
        }
    }

    /**
     * 鏡頭震動（v2）。
     *
     * 取得場景主 Camera 節點後，用 tween 做 8 次 180° 交替位移再歸零，
     * 模擬爆炸後的搖晃感。不影響 Camera 的邏輯焦點，只移動節點位置。
     *
     * @param strength  震動振幅（世界單位）
     * @param duration  總持續秒數
     */
    public playCameraShake(strength: number, duration: number): void {
        const scene = director.getScene();
        if (!scene) return;

        // 尋找主攝影機節點（Camera component）
        const cameraNode = scene.getComponentInChildren(Camera)?.node;
        if (!cameraNode) {
            console.warn('[EffectSystem] playCameraShake: 找不到主 Camera 節點，跳過震動');
            return;
        }

        const origin = cameraNode.position.clone();
        const stepDuration = duration / 8;

        // 建立 8 步交替震動序列後回到原點
        const seq = tween(cameraNode)
            .to(stepDuration, { position: v3(origin.x + strength, origin.y, origin.z) })
            .to(stepDuration, { position: v3(origin.x - strength, origin.y, origin.z) })
            .to(stepDuration, { position: v3(origin.x, origin.y + strength * 0.6, origin.z) })
            .to(stepDuration, { position: v3(origin.x, origin.y - strength * 0.6, origin.z) })
            .to(stepDuration, { position: v3(origin.x + strength * 0.4, origin.y, origin.z) })
            .to(stepDuration, { position: v3(origin.x - strength * 0.4, origin.y, origin.z) })
            .to(stepDuration, { position: v3(origin.x, origin.y + strength * 0.2, origin.z) })
            .to(stepDuration, { position: origin });

        seq.start();
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