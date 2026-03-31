// @spec-source → 見 docs/cross-reference-index.md
import { Color, EffectAsset, Material, MeshRenderer, Node, primitives, renderer, resources, utils, Vec4 } from "cc";
import { setMaterialSafe } from "../utils/MaterialUtils";

// ─────────────────────────────────────────────────────────────────────────────
//  資料型別
// ─────────────────────────────────────────────────────────────────────────────

/** Shader 預熱優先級（類比 Unity ShaderVariantCollection 分批載入） */
export type ShaderPriority =
    | 'critical'   // 遊戲啟動時立即預熱（角色本體 Shader）
    | 'standard'   // 進入戰鬥場景前預熱（常用特效 Shader）
    | 'lazy';      // 隨 Prefab Bundle 懶載入（特殊武將技能）

/**
 * 服裝設定（JSON 可序列化），可存入玩家資料或設定檔。
 *
 * 對應 `unit-base.effect` 中的 uniform 參數（Tier 1 持久參數）。
 * 所有顏色以 RGBA 0.0–1.0 浮點數表示，方便 JSON 存讀。
 *
 * Unity 對照：相當於 MaterialPropertyBlock (per-renderer) + Preset 存檔
 */
export interface OutfitConfig {
    /** 主色調 — 乘以 diffuse 貼圖，實現隊伍染色 */
    primaryColor:     [number, number, number, number];
    /** 次色調 — 描邊 / 金屬零件等第二材質區域 */
    secondaryColor:   [number, number, number, number];
    /** 漸層頂端顏色（Y 軸高處） */
    gradientTop:      [number, number, number, number];
    /** 漸層底端顏色（Y 軸低處） */
    gradientBottom:   [number, number, number, number];
    /** 漸層世界座標 Y 範圍 [minY, maxY]（0 視角水平面） */
    gradientRange:    [number, number];
    /** 自發光顏色（用於高亮、稀有裝扮光暈） */
    emissionColor:    [number, number, number, number];
    /** 自發光強度（0 = 無，1 = 標準，> 1 = 過光） */
    emissionIntensity:number;
}

/** 預設服裝：白色無特效，方便作為 clone 起點 */
export const DEFAULT_OUTFIT: OutfitConfig = {
    primaryColor:     [1, 1, 1, 1],
    secondaryColor:   [0.6, 0.6, 0.6, 1],
    gradientTop:      [1, 1, 1, 1],
    gradientBottom:   [0.85, 0.85, 0.85, 1],
    gradientRange:    [0, 2],
    emissionColor:    [0, 0, 0, 0],
    emissionIntensity:0,
};

interface ShaderEntry {
    id:       string;
    /** resources/ 相對路徑，指向 .mtl 材質檔（不含副檔名） */
    matPath:  string;
    priority: ShaderPriority;
    /** 載入完成後的 base Material（clone 來源） */
    base:     Material | null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  MaterialSystem
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 材質 / Shader 管理系統
 *
 * 核心職責：
 *   1. **Shader 預熱 (Warmup)**：啟動時強制 GPU 編譯關鍵 Shader，消除首次渲染卡頓
 *   2. **Per-Entity Material 實例**：clone base material，讓每個單位有獨立參數空間
 *   3. **兩層參數模型**：
 *      - Tier 1（Outfit / 持久）：uniform properties，換裝時設值，`setProperty()` 呼叫
 *      - Tier 2（戰鬥 / 即時）：GPU Instanced Attributes，每幀可設，`setInstancedAttribute()` 呼叫
 *   4. **生命週期管理**：unit 死亡時 `releaseUnit()` 自動回收 cloned material
 *
 * Unity 對照：
 *   warmupShader    ≈ ShaderVariantCollection.WarmUp()
 *   getOrCreate     ≈ renderer.material（auto-clone）+ MaterialPropertyBlock
 *   Tier 1 setColor ≈ material.SetColor("_MainColor", color)
 *   Tier 2 instanced ≈ MaterialPropertyBlock.SetVector() 傳給 Graphics.DrawMeshInstanced
 *
 * 使用範例：
 *   // 初始化（在 BattleScene.start() 中 ServiceLoader.initialize() 之後）
 *   await services().material.warmupCritical(this.node);
 *
 *   // 為某個單位建立材質實例並套用服裝
 *   const mr = unitNode.getComponent(MeshRenderer)!;
 *   services().material.bindUnit("unit_001", "unit-base", mr);
 *   services().material.applyOutfit("unit_001", "unit-base", {
 *       ...DEFAULT_OUTFIT,
 *       primaryColor: [0.2, 0.5, 1.0, 1],  // 藍色隊伍染色
 *   });
 *
 *   // 受擊 Rim Light（Tier 2，即時）
 *   services().material.setRim("unit_001", "unit-base", new Color(255, 80, 0, 200));
 *   setTimeout(() => services().material.clearRim("unit_001", "unit-base"), 200);
 *
 *   // 死亡溶解（Tier 2，即時）
 *   services().material.setDissolve("unit_001", "unit-base", 0.8);
 *
 *   // 單位銷毀時
 *   services().material.releaseUnit("unit_001");
 */
export class MaterialSystem {

    /** 所有已登錄的 Shader / Material 設定 */
    private registry = new Map<string, ShaderEntry>();

    /** per-unit material 實例：unitId → (shaderKey → Material clone) */
    private unitInstances = new Map<string, Map<string, Material>>();

    /** per-unit MeshRenderer 引用（用於 Tier 2 setInstancedAttribute） */
    private unitRenderers = new Map<string, Map<string, MeshRenderer>>();

    // ─────────────────────────────────────────
    //  登錄 / 查詢
    // ─────────────────────────────────────────

    /**
     * 登錄一個 Shader 設定。
     * `matPath` 指向 resources/ 下的 `.mtl` 材質檔案路徑（不含副檔名）。
     *
     * 建議在 BattleScene.start() 初期呼叫，集中管理所有 Shader 宣告。
     */
    registerShader(id: string, matPath: string, priority: ShaderPriority): void {
        this.registry.set(id, { id, matPath, priority, base: null });
    }

    // ─────────────────────────────────────────
    //  Shader 預熱（GPU 提前編譯）
    // ─────────────────────────────────────────

    /**
     * 預熱所有 `critical` 優先級的 Shader。
     * 在 BattleScene.start() 初期呼叫，消除首次渲染時的 Shader 編譯卡頓。
     *
     * 機制：
     *   1. 載入 .mtl 材質
     *   2. 建立 1×1 不可見 MeshRenderer，套用材質
     *   3. 讓 Cocos 渲染一次（觸發 GPU Shader 編譯）
     *   4. 600ms 後自動刪除暖機節點（GPU 已快取編譯結果）
     *
     * Unity 對照：ShaderVariantCollection.WarmUp() 的 Cocos 等效手動實作
     */
    async warmupCritical(hostNode: Node): Promise<void> {
        const criticals: ShaderEntry[] = [];
        this.registry.forEach(entry => {
            if (entry.priority === 'critical') criticals.push(entry);
        });
        await Promise.all(criticals.map(e => this.loadAndWarmup(e, hostNode)));
    }

    /** 預熱所有 `standard` 優先級的 Shader（進入戰鬥場景前呼叫） */
    async warmupStandard(hostNode: Node): Promise<void> {
        const standards: ShaderEntry[] = [];
        this.registry.forEach(entry => {
            if (entry.priority === 'standard') standards.push(entry);
        });
        await Promise.all(standards.map(e => this.loadAndWarmup(e, hostNode)));
    }

    private async loadAndWarmup(entry: ShaderEntry, hostNode: Node): Promise<void> {
        if (entry.base) return; // 已載入，跳過

        const mat = await this.loadMaterial(entry.matPath);
        entry.base = mat;

        // 建立不可見暖機節點：強制 GPU 在下一幀編譯 Shader
        const warmupNode = new Node(`__warmup_${entry.id}__`);
        warmupNode.parent = hostNode;
        warmupNode.active = true;

        // 建立最小 mesh 並套用材質
        const mr = warmupNode.addComponent(MeshRenderer);
        mr.mesh = utils.MeshUtils.createMesh(primitives.box({ width: 0.001, height: 0.001, length: 0.001 }));
        // 安全套用：若 Effect GLSL 有問題只 warn，不讓整個場景崩潰
        try {
            mr.material = mat;
        } catch (e) {
            console.warn(`[MaterialSystem] Shader "${entry.id}" 暖機失敗 — 材質套用錯誤:`, e);
            if (warmupNode.isValid) warmupNode.destroy();
            return;
        }

        // 移至鏡頭不可見的遠處，避免出現在畫面中
        warmupNode.setPosition(99999, 99999, 99999);

        // 600ms 後刪除（GPU 已完成 Shader 編譯，不影響遊戲）
        setTimeout(() => {
            if (warmupNode.isValid) warmupNode.destroy();
        }, 600);
    }

    private loadMaterial(path: string): Promise<Material> {
        return new Promise((resolve, reject) => {
            // 支援動態初始化 Effect（不需實體 .mtl 檔案）
            // 改用 resources.load(EffectAsset) 確保 EffectAsset 已被載入並註冊，
            // 避免 EffectAsset.get(name) 因時序問題查不到而建立空 passes 的 Material。
            // Unity 對照：相當於先 await Resources.LoadAsync<Shader> 再 new Material(shader)
            if (path.startsWith('effect:')) {
                const effectName = path.substring(7);
                resources.load(`effects/${effectName}`, EffectAsset, (err, effectAsset) => {
                    if (err || !effectAsset) {
                        // Fallback：嘗試從全域 registry 查（已被其他資產觸發載入的情況）
                        console.warn(`[MaterialSystem] resources.load effect "${effectName}" 失敗，嘗試全域 registry fallback:`, err);
                        const mat = new Material();
                        mat.initialize({ effectName });
                        if (mat.passes.length === 0) {
                            reject(new Error(`[MaterialSystem] Effect "${effectName}" 未找到且 passes 為空`));
                            return;
                        }
                        mat.addRef();
                        resolve(mat);
                        return;
                    }
                    const mat = new Material();
                    mat.initialize({ effectAsset });
                    mat.addRef();
                    resolve(mat);
                });
                return;
            }

            resources.load(path, Material, (err, mat) => {
                if (err || !mat) { reject(err || new Error(`Material not found: ${path}`)); return; }
                mat.addRef();
                resolve(mat);
            });
        });
    }

    // ─────────────────────────────────────────
    //  Per-Entity Material 實例管理
    // ─────────────────────────────────────────

    /**
     * 為指定 unit 綁定一個 Material 實例（clone base material）。
     * 若已綁定則直接回傳現有實例。
     *
     * @param unitId     唯一 ID（通常是 unit.id 或 generalId）
     * @param shaderKey  已登錄的 Shader ID
     * @param mr         此 unit 的 MeshRenderer（用於 Tier 2 setInstancedAttribute）
     * @returns          此 unit 的獨立 Material 實例
     */
    bindUnit(unitId: string, shaderKey: string, mr: MeshRenderer): Material | null {
        const existing = this.getInstanceMap(unitId).get(shaderKey);
        if (existing) return existing;

        const entry = this.registry.get(shaderKey);
        if (!entry?.base) {
            console.warn(`[MaterialSystem] Shader "${shaderKey}" 尚未載入，請先呼叫 warmupCritical()`);
            return null;
        }

        const instance = new Material();
        instance.copy(entry.base);
        instance.addRef();
        this.getInstanceMap(unitId).set(shaderKey, instance);

        // 存儲 MeshRenderer 引用（Tier 2 用）
        if (!this.unitRenderers.has(unitId)) this.unitRenderers.set(unitId, new Map());
        this.unitRenderers.get(unitId)!.set(shaderKey, mr);

        // 讓 MeshRenderer 使用此 per-unit 實例（使用 wrapper 避免不同引擎簽章或 deprecated）
        setMaterialSafe(mr, instance, 0);
        return instance;
    }

    /**
     * 釋放某個 unit 的所有 Material 實例（unit 死亡/銷毀時呼叫）。
     * 呼叫 `decRef()` 交由 Cocos GC 決定實際回收時機。
     */
    releaseUnit(unitId: string): void {
        const map = this.unitInstances.get(unitId);
        if (map) {
            map.forEach(mat => mat.decRef());
            map.clear();
        }
        this.unitInstances.delete(unitId);
        this.unitRenderers.delete(unitId);
    }

    // ─────────────────────────────────────────
    //  Tier 1：持久 Outfit 參數（uniform properties）
    // ─────────────────────────────────────────

    /**
     * 批次套用服裝設定。換裝/隊伍染色時呼叫一次即可。
     * 對應 unit-base.effect 中所有 u_ 開頭的 uniform 參數。
     */
    applyOutfit(unitId: string, shaderKey: string, outfit: OutfitConfig): void {
        const mat = this.getInstance(unitId, shaderKey);
        if (!mat) return;

        const [pr, pg, pb, pa] = outfit.primaryColor;
        const [sr, sg, sb, sa] = outfit.secondaryColor;
        const [tr, tg, tb, ta] = outfit.gradientTop;
        const [br, bg, bb, ba] = outfit.gradientBottom;
        const [er, eg, eb, ea] = outfit.emissionColor;

        mat.setProperty('u_primaryColor',    new Vec4(pr, pg, pb, pa));
        mat.setProperty('u_secondaryColor',  new Vec4(sr, sg, sb, sa));
        mat.setProperty('u_gradientTop',     new Vec4(tr, tg, tb, ta));
        mat.setProperty('u_gradientBottom',  new Vec4(br, bg, bb, ba));
        mat.setProperty('u_gradientRange',   new Vec4(outfit.gradientRange[0], outfit.gradientRange[1], 0, 0));
        mat.setProperty('u_emissionColor',   new Vec4(er, eg, eb, ea));
        mat.setProperty('u_emissionIntensity', outfit.emissionIntensity);
    }

    /**
     * 讀取目前 unit 的 Outfit 快照（可用於存檔或 UI 預覽）。
     * 注意：直接從 Material 屬性讀回，確保與 shader 同步。
     */
    captureOutfit(unitId: string, shaderKey: string): OutfitConfig {
        const mat = this.getInstance(unitId, shaderKey);
        if (!mat) return { ...DEFAULT_OUTFIT };

        const toTuple = (v: Vec4 | null): [number, number, number, number] =>
            v ? [v.x, v.y, v.z, v.w] : [1, 1, 1, 1];

        const primary   = mat.getProperty('u_primaryColor') as Vec4 | null;
        const secondary = mat.getProperty('u_secondaryColor') as Vec4 | null;
        const gradTop   = mat.getProperty('u_gradientTop') as Vec4 | null;
        const gradBot   = mat.getProperty('u_gradientBottom') as Vec4 | null;
        const gradRange = mat.getProperty('u_gradientRange') as Vec4 | null;
        const emission  = mat.getProperty('u_emissionColor') as Vec4 | null;
        const emInt     = mat.getProperty('u_emissionIntensity') as number | null;

        return {
            primaryColor:    toTuple(primary),
            secondaryColor:  toTuple(secondary),
            gradientTop:     toTuple(gradTop),
            gradientBottom:  toTuple(gradBot),
            gradientRange:   gradRange ? [gradRange.x, gradRange.y] : [0, 2],
            emissionColor:   toTuple(emission),
            emissionIntensity: emInt ?? 0,
        };
    }

    /** 便捷：設置單一 Vec4 顏色 uniform */
    setColor(unitId: string, shaderKey: string, propName: string, color: Color): void {
        const mat = this.getInstance(unitId, shaderKey);
        mat?.setProperty(propName, new Vec4(color.r / 255, color.g / 255, color.b / 255, color.a / 255));
    }

    /** 便捷：設置單一 float uniform */
    setFloat(unitId: string, shaderKey: string, propName: string, value: number): void {
        const mat = this.getInstance(unitId, shaderKey);
        mat?.setProperty(propName, value);
    }

    // ─────────────────────────────────────────
    //  Tier 2：即時戰鬥參數（GPU Instanced Attributes）
    // ─────────────────────────────────────────
    // 使用 MeshRenderer.setInstancedAttribute — 極低 CPU 開銷，直接傳給 GPU
    // 類比 Unity MaterialPropertyBlock，但在 GPU Instancing Pipeline 中運作

    /**
     * 設置受擊邊緣光（0.2 秒後呼叫 clearRim 恢復）。
     * Unity 對照：mr.GetPropertyBlock(block); block.SetColor("_RimColor", c); mr.SetPropertyBlock(block);
     */
    setRim(unitId: string, shaderKey: string, color: Color): void {
        const mr = this.getRenderer(unitId, shaderKey);
        if (!mr) return;
        mr.setInstancedAttribute('a_rimColor', [
            color.r / 255, color.g / 255, color.b / 255, color.a / 255
        ]);
    }

    clearRim(unitId: string, shaderKey: string): void {
        const mr = this.getRenderer(unitId, shaderKey);
        mr?.setInstancedAttribute('a_rimColor', [0, 0, 0, 0]);
    }

    /**
     * 設置溶解進度（0 = 完整，1 = 完全溶解）。
     * 典型用途：出場淡入（0→1 反向）、死亡淡出（0→1）。
     */
    setDissolve(unitId: string, shaderKey: string, progress: number): void {
        const mr = this.getRenderer(unitId, shaderKey);
        mr?.setInstancedAttribute('a_dissolve', [Math.max(0, Math.min(1, progress))]);
    }

    // ─────────────────────────────────────────
    //  私有工具
    // ─────────────────────────────────────────

    private getInstance(unitId: string, shaderKey: string): Material | null {
        return this.unitInstances.get(unitId)?.get(shaderKey) ?? null;
    }

    private getRenderer(unitId: string, shaderKey: string): MeshRenderer | null {
        return this.unitRenderers.get(unitId)?.get(shaderKey) ?? null;
    }

    private getInstanceMap(unitId: string): Map<string, Material> {
        if (!this.unitInstances.has(unitId)) this.unitInstances.set(unitId, new Map());
        return this.unitInstances.get(unitId)!;
    }
}
