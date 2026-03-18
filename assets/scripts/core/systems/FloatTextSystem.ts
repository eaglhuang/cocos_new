import { Camera, Color, Font, Label, Node, Tween, tween, UIOpacity, UITransform, Vec3 } from "cc";

/**
 * 飄字類型 — 決定外觀（顏色/大小/動畫速度）。
 *
 * 擴充方式：在此新增類型名稱，並在 FLOAT_CONFIGS 加入對應設定，無需修改任何其他程式碼。
 */
export type FloatTextType =
    | 'dmg_player'  // 我方單位受傷（紅）
    | 'dmg_enemy'   // 敵方單位受傷（藍）
    | 'dmg_crit'    // 暴擊傷害（橙紅，大字）
    | 'dmg_miss'    // 閃避/Miss（灰）
    | 'heal'        // 治療量（綠）
    | 'status'      // 狀態效果（中毒/暈眩/Buff，水藍）
    | 'hint';       // 場景提示 / Debug 用（半透明白）

interface FloatConfig {
    color: Color;
    fontSize: number;
    isBold: boolean;
    durationMs: number;    // 飄字存在總時長（毫秒）
    risePixels: number;    // 向上飄動的像素距離
    scalePop: number;      // 出現時的初始縮放（> 1 = 彈跳感）
    maxConcurrent: number; // 同類型同時存在上限；超過時強制回收最舊節點
    randomOffsetX: number; // ±隨機水平偏移（避免連擊飄字堆疊）
}

/**
 * 各類型外觀設定一覽 — 視覺調整只需改這裡，程式邏輯不要動
 */
const FLOAT_CONFIGS: Record<FloatTextType, FloatConfig> = {
    dmg_player: { color: new Color(255, 90,  90,  255), fontSize: 44, isBold: true,  durationMs: 900,  risePixels: 90,  scalePop: 1.2, maxConcurrent: 12, randomOffsetX: 40 },
    dmg_enemy:  { color: new Color(110, 180, 255, 255), fontSize: 44, isBold: true,  durationMs: 900,  risePixels: 90,  scalePop: 1.2, maxConcurrent: 12, randomOffsetX: 40 },
    dmg_crit:   { color: new Color(255, 60,  0,   255), fontSize: 60, isBold: true,  durationMs: 1000, risePixels: 120, scalePop: 1.6, maxConcurrent: 8,  randomOffsetX: 50 },
    dmg_miss:   { color: new Color(160, 160, 160, 255), fontSize: 34, isBold: false, durationMs: 800,  risePixels: 70,  scalePop: 1.0, maxConcurrent: 8,  randomOffsetX: 30 },
    heal:       { color: new Color(150, 255, 140, 255), fontSize: 40, isBold: false, durationMs: 1000, risePixels: 85,  scalePop: 1.1, maxConcurrent: 10, randomOffsetX: 30 },
    status:     { color: new Color(100, 220, 255, 255), fontSize: 30, isBold: false, durationMs: 1200, risePixels: 80,  scalePop: 1.0, maxConcurrent: 10, randomOffsetX: 20 },
    hint:       { color: new Color(255, 255, 200, 150), fontSize: 22, isBold: false, durationMs: 2000, risePixels: 40,  scalePop: 1.0, maxConcurrent: 6,  randomOffsetX: 0  },
};

interface PoolEntry {
    node: Node;
    label: Label;
    opacity: UIOpacity;
}

/**
 * 動態飄字系統 — 統一管理所有浮動文字
 *
 * 設計特性：
 *   1. 型別驅動：外觀設定（顏色/大小/動畫）集中在 FLOAT_CONFIGS，一目了然
 *   2. 物件池：每種類型維護獨立閒置池，避免 GC 卡頓
 *   3. maxConcurrent 硬上限：連擊時同類型超量則強制回收最舊節點，不讓飄字爆炸
 *   4. BMFont 支援：registerFont() 可替換系統字型（Phase 3 使用）
 *   5. 語系相容：registerFont() 可傳入 I18nSystem.getFont()，讓飄字跟隨語系字型切換
 *
 * Unity 對照：
 *   - 相當於 ObjectPool<TextMeshProUGUI> + AnimationCurve 驅動的浮動傷害數字系統
 *   - maxConcurrent ≈ 物件池的 maxSize + 強制回收最舊物件的 LRU 策略
 *   - registerFont  ≈ TMP_FontAsset 動態替換
 *
 * 使用方式：
 *   // 在 UnitRenderer.initialize() 後 setup
 *   services().floatText.setup(uiRoot, worldCamera, canvasNode);
 *
 *   // 顯示受傷飄字
 *   services().floatText.show('dmg_player', '-50', worldPos);
 *   services().floatText.showDamage(50, worldPos, isCrit);
 *
 *   // 顯示狀態效果
 *   services().floatText.showStatus('中毒', worldPos);
 *   services().floatText.showStatus(services().i18n.t('status.poison'), worldPos);
 */
export class FloatTextSystem {
    private uiRoot: Node | null = null;
    private worldCamera: Camera | null = null;
    private canvasNode: Node | null = null;

    /** 類型 → 閒置節點池 */
    private idlePool = new Map<FloatTextType, PoolEntry[]>();
    /** 類型 → 活躍中節點列表（用於 maxConcurrent 強制回收） */
    private activeList = new Map<FloatTextType, PoolEntry[]>();
    /** 類型 → 自訂字型（BMFont 或語系字型），未設定則使用系統字型 */
    private customFonts = new Map<FloatTextType, Font>();

    // ─────────────────────────────────────────
    //  初始化
    // ─────────────────────────────────────────

    /**
     * 由 UnitRenderer.initialize() 呼叫，提供 3D→UI 座標轉換所需的節點參照。
     * Unity 對照：相當於在 Canvas 上掛 FloatTextManager component 並拖拉 Camera 參照
     */
    setup(uiRoot: Node, worldCamera: Camera, canvasNode: Node): void {
        this.uiRoot = uiRoot;
        this.worldCamera = worldCamera;
        this.canvasNode = canvasNode;
    }

    /**
     * 為指定類型設定自訂字型（選配）。
     * 未呼叫則使用系統預設字型。
     *
     * 典型使用場景：
     *   Phase 3 - BMFont：services().floatText.registerFont('dmg_crit', critBmFont);
     *   語系字型：services().floatText.registerFont('status', services().i18n.getFont('body'));
     */
    registerFont(type: FloatTextType, font: Font): void {
        this.customFonts.set(type, font);
    }

    // ─────────────────────────────────────────
    //  主要入口
    // ─────────────────────────────────────────

    /**
     * 顯示飄字（統一入口）
     *
     * @param type     文字類型，決定顏色/大小/動畫
     * @param text     顯示內容（傷害數字、狀態名稱、提示文字…）
     * @param worldPos 3D 世界座標，自動轉換為 Canvas UI 座標
     */
    show(type: FloatTextType, text: string, worldPos: Vec3): void {
        if (!this.uiRoot || !this.worldCamera || !this.canvasNode) return;

        const config = FLOAT_CONFIGS[type];
        const uiPos = this.toUiPosition(worldPos);
        const entry = this.acquireEntry(type, config);

        // ── 設定外觀 ──
        const font = this.customFonts.get(type) ?? null;
        if (font) entry.label.font = font;
        entry.label.fontSize = config.fontSize;
        entry.label.isBold = config.isBold;
        entry.label.string = text;
        // alpha = 255 固定在 label.color，整體淡出由 UIOpacity 控制（避免相互干擾）
        entry.label.color = new Color(config.color.r, config.color.g, config.color.b, 255);
        entry.opacity.opacity = 255;

        // ── 加入場景，設定初始位置與縮放 ──
        entry.node.parent = this.uiRoot;
        entry.node.layer = this.canvasNode.layer;

        // 隨機水平偏移：連擊時避免多個飄字完全重疊
        const offsetX = (Math.random() - 0.5) * 2 * config.randomOffsetX;
        const startX = uiPos.x + offsetX;
        const startY = uiPos.y;
        entry.node.setPosition(startX, startY, 0);
        entry.node.setScale(config.scalePop, config.scalePop, 1);

        const duration = config.durationMs / 1000;

        // ── Tween 1：scale pop 縮回正常比例，再向上飄動 ──
        tween(entry.node)
            .to(0.15, { scale: new Vec3(1, 1, 1) })
            .to(duration - 0.15, { position: new Vec3(startX, startY + config.risePixels, 0) }, { easing: 'quadOut' })
            .call(() => this.releaseEntry(type, entry))
            .start();

        // ── Tween 2（獨立）：前半段不透明，後半段淡出 ──
        tween(entry.opacity)
            .delay(duration * 0.5)
            .to(duration * 0.5, { opacity: 0 })
            .start();
    }

    // ─────────────────────────────────────────
    //  便捷方法
    // ─────────────────────────────────────────

    /** 顯示傷害數字（isCrit 為 true 時使用暴擊外觀） */
    showDamage(value: number, worldPos: Vec3, isCrit = false): void {
        this.show(isCrit ? 'dmg_crit' : 'dmg_player', `${value}`, worldPos);
    }

    /** 顯示閃避/Miss */
    showMiss(worldPos: Vec3): void {
        this.show('dmg_miss', 'Miss', worldPos);
    }

    /**
     * 顯示狀態效果文字（中毒、暈眩、詛咒…）
     * 建議搭配 I18nSystem：showStatus(services().i18n.t('status.poison'), worldPos)
     */
    showStatus(text: string, worldPos: Vec3): void {
        this.show('status', text, worldPos);
    }

    /** 顯示場景提示文字（Debug 用，半透明） */
    showHint(text: string, worldPos: Vec3): void {
        this.show('hint', text, worldPos);
    }

    // ─────────────────────────────────────────
    //  私有：物件池管理
    // ─────────────────────────────────────────

    private acquireEntry(type: FloatTextType, config: FloatConfig): PoolEntry {
        // 優先取閒置節點（動畫已結束的）
        const idle = this.getIdle(type);
        if (idle.length > 0) {
            const entry = idle.pop()!;
            Tween.stopAllByTarget(entry.node);
            Tween.stopAllByTarget(entry.opacity);
            this.getActive(type).push(entry);
            return entry;
        }

        const active = this.getActive(type);

        // 未達上限：建立新節點
        if (active.length < config.maxConcurrent) {
            const entry = this.createEntry();
            active.push(entry);
            return entry;
        }

        // 超過上限：強制回收最舊的活躍節點（LRU 策略）
        // 避免大量連擊時讓節點數量無限增長
        const oldest = active.shift()!;
        Tween.stopAllByTarget(oldest.node);
        Tween.stopAllByTarget(oldest.opacity);
        active.push(oldest);
        return oldest;
    }

    private releaseEntry(type: FloatTextType, entry: PoolEntry): void {
        const active = this.activeList.get(type);
        if (active) {
            const idx = active.indexOf(entry);
            if (idx >= 0) active.splice(idx, 1);
        }
        // 脫離場景、重置狀態、歸還閒置池
        entry.node.parent = null;
        entry.node.setScale(1, 1, 1);
        entry.label.string = '';
        this.getIdle(type).push(entry);
    }

    private createEntry(): PoolEntry {
        const node = new Node('FloatText');
        const tf = node.addComponent(UITransform);
        tf.setContentSize(220, 60);
        const opacity = node.addComponent(UIOpacity);
        const label = node.addComponent(Label);
        label.lineHeight = 60;
        label.overflow = Label.Overflow.NONE;
        return { node, label, opacity };
    }

    private getActive(type: FloatTextType): PoolEntry[] {
        if (!this.activeList.has(type)) this.activeList.set(type, []);
        return this.activeList.get(type)!;
    }

    private getIdle(type: FloatTextType): PoolEntry[] {
        if (!this.idlePool.has(type)) this.idlePool.set(type, []);
        return this.idlePool.get(type)!;
    }

    // ─────────────────────────────────────────
    //  私有：3D 世界座標 → Canvas UI 座標
    // ─────────────────────────────────────────

    /**
     * 將 3D 世界座標轉換為 Canvas 本地座標。
     * 邏輯與 UnitRenderer.toUiPosition() 完全一致，集中在此，不再分散。
     */
    private toUiPosition(worldPos: Vec3): Vec3 {
        const uiPos = new Vec3();
        const screenPos = new Vec3();
        this.worldCamera!.worldToScreen(worldPos, screenPos);
        const uiCamera = this.canvasNode!.getComponentInChildren(Camera);
        if (uiCamera) {
            const uiWorldPos = new Vec3();
            uiCamera.screenToWorld(screenPos, uiWorldPos);
            const uiTrans = this.uiRoot!.getComponent(UITransform);
            if (uiTrans) {
                uiTrans.convertToNodeSpaceAR(uiWorldPos, uiPos);
            }
        } else {
            this.worldCamera!.convertToUINode(worldPos, this.uiRoot!, uiPos);
        }
        return uiPos;
    }
}
