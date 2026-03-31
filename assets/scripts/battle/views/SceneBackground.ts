// @spec-source → 見 docs/cross-reference-index.md
import {
    _decorator, Component, Node, Camera, Color,
    MeshRenderer, Material, ImageAsset, Texture2D, JsonAsset, resources, gfx
} from "cc";
import { utils, primitives } from "cc";

const { ccclass } = _decorator;

/** scene-backgrounds.json 中單條背景設定 */
interface BackgroundEntry {
    id: string;
    path: string;
    timeOfDay: string;
    label: string;
}

/**
 * SceneBackground — 場景背景底圖管理員
 *
 * ■ 對照 Unity：
 *   Unity 多相機疊加 → Cocos Camera.priority（數字越小越先渲染）。
 *   Background Camera (depth=-1, ClearFlags=Solid Color) + Unlit Quad Mesh
 *   等同建立一個「永遠在最底層」的背景相機。
 *
 * ■ 層級架構（渲染順序）：
 *   priority= -1 │ BGCamera (正交) → 渲染 BACKGROUND_LAYER → 背景底圖 Quad
 *   priority=  0 │ Main 3D Camera  → 渲染 DEFAULT layer   → 棋盤、棋子
 *   priority=  1 │ UI Camera       → 渲染 UI_2D layer     → HUD、面板
 *
 * ■ 為何用獨立 Camera + Layer 而非把圖放在 Canvas？
 *   Canvas 的 Sprite 是 UI_2D layer，由 UI Camera (priority=1) 渲染，
 *   永遠覆蓋在 3D 內容上方（即使 siblingIndex=0 也只是 UI 最底部）。
 *   獨立的 BGCamera (priority=-1) 才能讓背景真正「在 3D 物件之下」。
 *
 * ■ 天氣特效擴充可行性分析：
 *   ✅ 雨滴／雪花：掛 ParticleSystem 在 weatherRoot（BACKGROUND_LAYER），
 *                  由 BGCamera 渲染，不影響 3D 棋盤。
 *   ✅ 水窪／倒影：weatherRoot 下加 MeshRenderer Quad + 透明材質即可。
 *   ⚠️  動態陰影：需 Shadow Map 或 Projector，Cocos 3.x 支援但設定較複雜，
 *                  建議未來版本再實作。
 */
@ccclass("SceneBackground")
export class SceneBackground extends Component {
    /**
     * 背景專屬 Layer（User Layer bit 8 = 256）。
     * 對照 Unity：Layer 8 命名為 "Background"。
     * 只有 BGCamera.visibility 包含此 bit；
     * Main 3D Camera 與 UI Camera 均不包含，三者完全隔離不互擾。
     */
    private static readonly BG_LAYER = 1 << 8;

    /** 背景正交相機 */
    private bgCamera: Camera | null = null;

    /** 背景底圖的 MeshRenderer（3D Quad，不受光照影響） */
    private bgMeshRenderer: MeshRenderer | null = null;

    /** 背景底圖材質（builtin-unlit） */
    private bgMaterial: Material | null = null;

    /** 天氣特效根節點（預留給未來雨、雪、陰影等效果） */
    private weatherRoot: Node | null = null;

    onLoad(): void {
        this.setupBGCamera();
        this.setupBGMesh();
        this.setupWeatherRoot();
    }

    // ─── 公開 API ──────────────────────────────────────────────────────────────

    /**
     * 根據 backgroundId 從 scene-backgrounds.json 讀取設定並載入底圖。
     * 在 BattleScene.start() 中呼叫；replay 時可再次呼叫以切換背景。
     */
    async loadBackground(id: string): Promise<void> {
        const entry = await this.fetchEntry(id);
        if (!entry) return;
        await this.applyTexture(entry.path, entry.label);
    }

    /** 取得天氣特效根節點（供外部掛載粒子系統、雨滴 Quad 等效果節點） */
    getWeatherRoot(): Node | null {
        return this.weatherRoot;
    }

    // ─── 私有：初始化 ──────────────────────────────────────────────────────────

    /**
     * 建立背景正交相機。
     * 對照 Unity：新增一個 Orthographic Camera，depth設為 -1，
     * ClearFlags=Solid Color，Culling Mask 只含 Background layer。
     */
    private setupBGCamera(): void {
        let camNode = this.node.getChildByName("BGCamera");
        if (!camNode) {
            camNode = new Node("BGCamera");
            this.node.addChild(camNode);
        }
        // 正交相機放在 +Z=10，預設 local forward 為 -Z → 朝向 z=0 的 BGMesh
        camNode.setPosition(0, 0, 10);

        const cam = camNode.getComponent(Camera) ?? camNode.addComponent(Camera);
        cam.projection  = Camera.ProjectionType.ORTHO;
        // SOLID_COLOR：優先清黑色，再由底圖 Quad 覆蓋（接手原本 Main Camera 的職責）
        cam.clearFlags  = Camera.ClearFlag.SOLID_COLOR;
        cam.clearColor  = new Color(0, 0, 0, 255);
        // orthoHeight=1 → 相機垂直可見範圍為 2 世界單位；BGMesh 縮放對應匹配
        cam.orthoHeight = 1;
        cam.near        = 0.1;
        cam.far         = 20;
        // 只渲染 BACKGROUND_LAYER：3D 棋盤（DEFAULT）與 UI（UI_2D）均不可見
        cam.visibility  = SceneBackground.BG_LAYER;
        // priority=-1 → 最先渲染（最底層）
        cam.priority    = -1;

        this.bgCamera = cam;
    }

    /**
     * 建立底圖 Quad Mesh。
     * 對照 Unity：建立一個 Plane GameObject 掛 MeshRenderer，
     * 材質使用 Unlit/Texture Shader，置於相機正前方使其填滿畫面。
     */
    private setupBGMesh(): void {
        let meshNode = this.node.getChildByName("BGMesh");
        if (!meshNode) {
            meshNode = new Node("BGMesh");
            this.node.addChild(meshNode);
        }

        // 此節點只有 BGCamera 看得到（同 BG_LAYER）
        meshNode.layer = SceneBackground.BG_LAYER;
        meshNode.setPosition(0, 0, 0);

        // 以 16:9 比例縮放 Quad，使其完整填滿 orthoHeight=1 的正交視野：
        // 垂直可見範圍 = 2 世界單位 → meshScaleY=2（負號翻轉 UV，修正貼圖上下顛倒）
        // 水平可見範圍 = 2*(16/9) ≈ 3.556 → meshScaleX=3.556
        // 對照 Unity：primitives.quad() UV (0,0) 在左下，但引擎座標 Y 朝上，需翻轉
        const aspect = 16 / 9;
        meshNode.setScale(aspect * 2, -2, 1);

        const mr = meshNode.getComponent(MeshRenderer) ?? meshNode.addComponent(MeshRenderer);
        // primitives.quad()：以原點為中心的單位四邊形，UV (0,0)~(1,1)
        mr.mesh = utils.MeshUtils.createMesh(primitives.quad());

        // builtin-unlit：純貼圖渲染，不受場景光照影響
        // 對照 Unity：Unlit/Texture shader
        // ⚠️ 必須在 defines 中開啟 USE_TEXTURE，否則 shader 忽略 mainTexture，只輸出白色 mainColor
        const mat = new Material();
        mat.initialize({
            effectName: "builtin-unlit",
            defines: { USE_TEXTURE: true },
            states: {
                rasterizerState: { cullMode: gfx.CullMode.NONE },
                depthStencilState: { depthTest: false, depthWrite: false },
            }
        });
        mr.setSharedMaterial(mat, 0);

        this.bgMeshRenderer = mr;
        this.bgMaterial = mat;
    }

    /** 建立天氣特效根節點（目前為空，供未來擴充） */
    private setupWeatherRoot(): void {
        let root = this.node.getChildByName("WeatherRoot");
        if (!root) {
            root = new Node("WeatherRoot");
            this.node.addChild(root);
        }
        // 天氣效果與底圖同層，由 BGCamera 渲染
        root.layer = SceneBackground.BG_LAYER;
        this.weatherRoot = root;
    }

    // ─── 私有：資料載入 ────────────────────────────────────────────────────────

    /** 從 scene-backgrounds.json 讀取指定 id 的背景設定 */
    private fetchEntry(id: string): Promise<BackgroundEntry | null> {
        return new Promise(resolve => {
            resources.load("data/scene-backgrounds", JsonAsset, (err, jsonAsset) => {
                if (err || !jsonAsset?.json) {
                    console.warn("[SceneBackground] 無法讀取 scene-backgrounds.json:", err?.message);
                    resolve(null);
                    return;
                }
                const list = (jsonAsset.json as { backgrounds: BackgroundEntry[] }).backgrounds ?? [];
                const entry = list.find(b => b.id === id) ?? null;
                if (!entry) {
                    console.warn(`[SceneBackground] 找不到背景設定: id="${id}"`);
                }
                resolve(entry);
            });
        });
    }

    /**
     * 載入底圖並套用到材質的 mainTexture 屬性。
     * 對照 Unity：Resources.Load<Texture2D>(path)。
     * Cocos Creator 中 PNG（type=texture）的正確載入路徑：
     *   resources.load(path, ImageAsset) → 包裝成 Texture2D → 套用到材質。
     * 不需要 SpriteFrame（那是 UI/2D 用），純 3D 材質直接用 Texture2D 即可。
     */
    private applyTexture(path: string, label: string): Promise<void> {
        return new Promise(resolve => {
            resources.load(path, ImageAsset, (err, imageAsset) => {
                if (err || !imageAsset) {
                    console.warn(`[SceneBackground] 底圖載入失敗 (${path}):`, err?.message);
                    resolve();
                    return;
                }
                const tex = new Texture2D();
                tex.image = imageAsset;
                this.bgMaterial?.setProperty("mainTexture", tex);
                console.log(`[SceneBackground] ✅ 背景底圖載入成功: ${label}`);
                resolve();
            });
        });
    }
}
