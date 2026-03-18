import {
    _decorator, Component, Node, Material, Mesh, Color,
    MeshRenderer, ImageAsset, Texture2D, Layers, EffectAsset,
    Vec3, Vec4, tween, Tween, resources, utils, primitives, assetManager, AssetManager
} from "cc";

const { ccclass } = _decorator;

/** Pool 內部單一效果 slot 的狀態 */
interface EffectSlot {
    root: Node;
    /** 平貼地面的法陣根節點 */
    ringRoot: Node;
    /** 面向鏡頭的圖示根節點 */
    iconRoot: Node;
    /** 火花粒子根節點 */
    sparkRoot: Node;
    /** 中心環 */
    ringQuad: Node;
    /** 中心環柔光 */
    ringGlowQuad: Node;
    /** 主圖示（劍 / 補血符號） */
    mainQuad: Node;
    /** 主圖示柔光 */
    mainGlowQuad: Node;
    /** 箭頭層 */
    arrowQuad: Node;
    /** 箭頭柔光 */
    arrowGlowQuad: Node;
    /** HP 用的第二層箭頭 */
    arrowQuadSecondary: Node | null;
    /** HP 第二層箭頭柔光 */
    arrowGlowQuadSecondary: Node | null;
    /** 假粒子火花 */
    sparkQuads: Node[];
    /** 是否正在播放 */
    active: boolean;
    /** 環的面內旋轉角度 */
    ringAngle: number;
    /** Z 固定角：0=增益（箭頭向上）, 180=減益（貼圖上下翻，箭頭朝下）*/
    zRot: number;
    /** true=往上漂（增益），false=往下漂（減益）*/
    arrowUp: boolean;
    iconEulerBuf: Vec3;
    ringEulerBuf: Vec3;
    mainEulerBuf: Vec3;
    arrowEulerBuf: Vec3;
}

/**
 * 初始化設定：決定特效的貼圖、箭頭方向與顏色風格。
 */
export interface BuffEffectConfig {
    ringTexturePath: string;
    mainTexturePath: string;
    arrowTexturePath: string;
    arrowUp: boolean;
    useDualArrows?: boolean;
    ringColor?: Color;
    mainColor?: Color;
    arrowColor?: Color;
    label?: string;
}

@ccclass("BuffGainEffectPool")
export class BuffGainEffectPool extends Component {
    private static readonly TECHNIQUE_TRANSPARENT = 0;
    private static readonly TECHNIQUE_ADDITIVE = 1;
    private static readonly TECHNIQUE_OUTER_GLOW = 2;
    private static readonly POOL_SIZE = 4;
    private static readonly ROLL_DEG_PER_SEC = 120;
    private static readonly SWORD_Z_DEG = 270;
    private static readonly RING_SCALE = 0.72;
    private static readonly RING_ONLY_DURATION = 0.5;
    private static readonly SWORD_POP_DURATION = 0.18;
    private static readonly SWORD_IDLE_DURATION = 1.32;
    private static readonly RING_IDLE_DURATION = 1.5;
    private static readonly RING_FADE_DURATION = 1.0;
    private static readonly SPARK_DURATION = 2.0;
    private static readonly SPARK_COUNT = 10;
    private static readonly ARROW_DELAY = 1.0;
    private static readonly ARROW_POP_DURATION = 0.14;
    private static readonly FLOAT_FADE_DURATION = 1.0;
    private static readonly SWORD_POP_Y = 0.06;
    private static readonly SWORD_FLOAT_DISTANCE = 0.16;
    private static readonly ATK_ARROW_POP_Y = 0.26;
    private static readonly ATK_ARROW_FLOAT_DISTANCE = 0.16;
    private static readonly HP_MAIN_POP_Y = -0.01;
    private static readonly HP_MAIN_FLOAT_DISTANCE = 0.14;
    private static readonly HP_ARROW_POP_Y = 0.34;
    private static readonly HP_ARROW_FLOAT_DISTANCE = 0.14;
    private static readonly HP_ARROW_SECONDARY_OFFSET = 0.38;
    private static readonly MIN_DOWNWARD_ICON_Y = 0.08;
    private static readonly RING_GLOW_SCALE = 0.78;
    private static readonly MAIN_GLOW_SCALE = 0.46;
    private static readonly ARROW_GLOW_SCALE = 0.33;
    private static readonly ARROW_GLOW_SECONDARY_SCALE = 0.27;
    private static readonly RING_GLOW_ALPHA = 40;
    private static readonly MAIN_GLOW_ALPHA = 30;
    private static readonly ARROW_GLOW_ALPHA = 28;

    private config!: BuffEffectConfig;
    private slots: EffectSlot[] = [];
    private quadMesh: Mesh | null = null;
    private vfxEffectAsset: EffectAsset | null = null;
    private ringMaterial: Material | null = null;
    private ringGlowMaterial: Material | null = null;
    private mainMaterial: Material | null = null;
    private mainGlowMaterial: Material | null = null;
    private arrowMaterial: Material | null = null;
    private arrowGlowMaterial: Material | null = null;
    private sparkMaterial: Material | null = null;
    private ready = false;
    private cameraNode: Node | null = null;
    private cameraRollComp = 0;

    update(dt: number): void {
        for (const slot of this.slots) {
            if (!slot.active) continue;
            this.updateIconFacing(slot);
            slot.ringAngle += BuffGainEffectPool.ROLL_DEG_PER_SEC * dt;
            slot.ringEulerBuf.set(0, 0, slot.ringAngle);
            slot.mainEulerBuf.set(0, 0, BuffGainEffectPool.SWORD_Z_DEG - this.cameraRollComp);
            slot.arrowEulerBuf.set(0, 0, slot.zRot - this.cameraRollComp);
            slot.ringQuad.eulerAngles = slot.ringEulerBuf;
            slot.ringGlowQuad.eulerAngles = slot.ringEulerBuf;
            slot.mainQuad.eulerAngles = slot.mainEulerBuf;
            slot.mainGlowQuad.eulerAngles = slot.mainEulerBuf;
            slot.arrowQuad.eulerAngles = slot.arrowEulerBuf;
            slot.arrowGlowQuad.eulerAngles = slot.arrowEulerBuf;
            if (slot.arrowQuadSecondary) {
                slot.arrowQuadSecondary.eulerAngles = slot.arrowEulerBuf;
            }
            if (slot.arrowGlowQuadSecondary) {
                slot.arrowGlowQuadSecondary.eulerAngles = slot.arrowEulerBuf;
            }
        }
    }

    public setCameraNode(cameraNode: Node | null): void {
        this.cameraNode = cameraNode;
    }

    async initialize(config: BuffEffectConfig): Promise<void> {
        this.config = config;
        this.quadMesh = utils.MeshUtils.createMesh(primitives.quad());

        this.vfxEffectAsset = await this.loadEffectAsset();
        if (!this.vfxEffectAsset) {
            console.error(`[BuffGainEffectPool:${config.label ?? "?"}] 無法載入自訂 VFX EffectAsset，特效停用`);
            return;
        }

        const [ringMat, ringGlowMat, mainMat, mainGlowMat, arrowMat, arrowGlowMat] = await Promise.all([
            this.loadMaterial(config.ringTexturePath, config.ringColor ?? config.mainColor ?? new Color(255, 255, 255, 240), `${config.label ?? "?"}:ring`, BuffGainEffectPool.TECHNIQUE_TRANSPARENT, this.makeEffectParams(0.08, 0.02, 1.0, 1.0)),
            this.loadMaterial(config.ringTexturePath, this.withAlpha(config.ringColor ?? config.mainColor ?? new Color(255, 255, 255, 240), BuffGainEffectPool.RING_GLOW_ALPHA), `${config.label ?? "?"}:ringGlow`, BuffGainEffectPool.TECHNIQUE_OUTER_GLOW, this.makeEffectParams(0.18, 0.14, 0.82, 0.26)),
            this.loadMaterial(config.mainTexturePath, config.mainColor ?? new Color(255, 255, 255, 240), `${config.label ?? "?"}:main`, BuffGainEffectPool.TECHNIQUE_TRANSPARENT, this.makeEffectParams(0.08, 0.02, 1.0, 1.0)),
            this.loadMaterial(config.mainTexturePath, this.withAlpha(config.mainColor ?? new Color(255, 255, 255, 240), BuffGainEffectPool.MAIN_GLOW_ALPHA), `${config.label ?? "?"}:mainGlow`, BuffGainEffectPool.TECHNIQUE_OUTER_GLOW, this.makeEffectParams(0.18, 0.12, 0.84, 0.22)),
            this.loadMaterial(config.arrowTexturePath, config.arrowColor ?? config.mainColor ?? new Color(255, 255, 255, 240), `${config.label ?? "?"}:arrow`, BuffGainEffectPool.TECHNIQUE_TRANSPARENT, this.makeEffectParams(0.08, 0.02, 1.0, 1.0)),
            this.loadMaterial(config.arrowTexturePath, this.withAlpha(config.arrowColor ?? config.mainColor ?? new Color(255, 255, 255, 240), BuffGainEffectPool.ARROW_GLOW_ALPHA), `${config.label ?? "?"}:arrowGlow`, BuffGainEffectPool.TECHNIQUE_OUTER_GLOW, this.makeEffectParams(0.18, 0.12, 0.84, 0.2)),
        ]);
        if (!ringMat || !ringGlowMat || !mainMat || !mainGlowMat || !arrowMat || !arrowGlowMat) {
            console.error(`[BuffGainEffectPool:${config.label ?? "?"}] 無法載入特效材質，特效停用`);
            return;
        }
        this.ringMaterial = ringMat;
        this.ringGlowMaterial = ringGlowMat;
        this.mainMaterial = mainMat;
        this.mainGlowMaterial = mainGlowMat;
        this.arrowMaterial = arrowMat;
        this.arrowGlowMaterial = arrowGlowMat;
        this.sparkMaterial = this.createSparkMaterial(config.arrowColor ?? config.mainColor ?? new Color(255, 255, 255, 220));

        for (let i = 0; i < BuffGainEffectPool.POOL_SIZE; i++) {
            this.slots.push(this.buildSlot(i));
        }
        this.ready = true;
        console.log(`[BuffGainEffectPool:${config.label ?? "?"}] ✅ 初始化完成，Pool size=${BuffGainEffectPool.POOL_SIZE}`);
    }

    play(worldPos: Vec3): void {
        if (!this.ready) return;

        let slot = this.slots.find(s => !s.active);
        if (!slot) {
            slot = this.buildSlot(this.slots.length);
            this.slots.push(slot);
        }

        this.playSlot(slot, worldPos);
    }

    private buildSlot(index: number): EffectSlot {
        const root = new Node(`BuffEffect_${index}`);
        root.layer = Layers.Enum.DEFAULT;
        this.node.addChild(root);

        const ringRoot = new Node(`RingRoot_${index}`);
        ringRoot.layer = Layers.Enum.DEFAULT;
        root.addChild(ringRoot);

        const iconRoot = new Node(`IconRoot_${index}`);
        iconRoot.layer = Layers.Enum.DEFAULT;
        root.addChild(iconRoot);

        const sparkRoot = new Node(`SparkRoot_${index}`);
        sparkRoot.layer = Layers.Enum.DEFAULT;
        root.addChild(sparkRoot);

        const zRot = this.config.arrowUp ? 180 : 0;
        const ringQuad = this.makeQuad("Ring", ringRoot, this.ringMaterial);
        const ringGlowQuad = this.makeQuad("RingGlow", ringRoot, this.ringGlowMaterial);
        const mainQuad = this.makeQuad("Main", iconRoot, this.mainMaterial);
        const mainGlowQuad = this.makeQuad("MainGlow", iconRoot, this.mainGlowMaterial);
        const arrowQuad = this.makeQuad("Arrow", iconRoot, this.arrowMaterial);
        const arrowGlowQuad = this.makeQuad("ArrowGlow", iconRoot, this.arrowGlowMaterial);
        const arrowQuadSecondary = this.config.useDualArrows ? this.makeQuad("ArrowSecondary", iconRoot, this.arrowMaterial) : null;
        const arrowGlowQuadSecondary = this.config.useDualArrows ? this.makeQuad("ArrowGlowSecondary", iconRoot, this.arrowGlowMaterial) : null;
        const sparkQuads: Node[] = [];
        for (let i = 0; i < BuffGainEffectPool.SPARK_COUNT; i++) {
            const spark = this.makeQuad(`Spark_${i}`, sparkRoot, this.sparkMaterial);
            spark.setScale(0.01, 0.01, 0.01);
            sparkQuads.push(spark);
        }
        ringRoot.setRotationFromEuler(-90, 0, 0);
        ringQuad.setRotationFromEuler(0, 0, 0);
        ringGlowQuad.setRotationFromEuler(0, 0, 0);
        mainQuad.setRotationFromEuler(0, 0, BuffGainEffectPool.SWORD_Z_DEG - this.cameraRollComp);
        mainGlowQuad.setRotationFromEuler(0, 0, BuffGainEffectPool.SWORD_Z_DEG - this.cameraRollComp);
        arrowQuad.setRotationFromEuler(0, 0, zRot - this.cameraRollComp);
        arrowGlowQuad.setRotationFromEuler(0, 0, zRot - this.cameraRollComp);
        arrowQuadSecondary?.setRotationFromEuler(0, 0, zRot - this.cameraRollComp);
        arrowGlowQuadSecondary?.setRotationFromEuler(0, 0, zRot - this.cameraRollComp);
        ringQuad.setScale(0.01, 0.01, 0.01);
        ringGlowQuad.setScale(0.01, 0.01, 0.01);
        mainQuad.setScale(0.01, 0.01, 0.01);
        mainGlowQuad.setScale(0.01, 0.01, 0.01);
        arrowQuad.setScale(0.01, 0.01, 0.01);
        arrowGlowQuad.setScale(0.01, 0.01, 0.01);
        arrowQuadSecondary?.setScale(0.01, 0.01, 0.01);
        arrowGlowQuadSecondary?.setScale(0.01, 0.01, 0.01);

        root.active = false;

        return {
            root, ringRoot, iconRoot, sparkRoot, ringQuad, ringGlowQuad, mainQuad, mainGlowQuad, arrowQuad, arrowGlowQuad, arrowQuadSecondary, arrowGlowQuadSecondary, sparkQuads,
            active: false,
            ringAngle: 0, zRot,
            arrowUp: this.config.arrowUp,
            iconEulerBuf: new Vec3(0, 0, 0),
            ringEulerBuf: new Vec3(0, 0, 0),
            mainEulerBuf: new Vec3(0, 0, BuffGainEffectPool.SWORD_Z_DEG),
            arrowEulerBuf: new Vec3(0, 0, zRot),
        };
    }

    private makeQuad(name: string, parent: Node, material: Material | null): Node {
        const n = new Node(name);
        n.layer = Layers.Enum.DEFAULT;
        parent.addChild(n);
        const mr = n.addComponent(MeshRenderer);
        mr.mesh = this.quadMesh;
        if (material) {
            mr.setSharedMaterial(material, 0);
        }
        return n;
    }

    private playSlot(slot: EffectSlot, worldPos: Vec3): void {
        slot.active = true;
        slot.ringAngle = 0;
        slot.root.active = true;
        slot.root.setWorldPosition(worldPos);
        this.updateIconFacing(slot);

        const { ringRoot, ringQuad, ringGlowQuad, mainQuad, mainGlowQuad, arrowQuad, arrowGlowQuad, arrowQuadSecondary, arrowGlowQuadSecondary, iconRoot, sparkRoot, sparkQuads } = slot;

        Tween.stopAllByTarget(ringRoot);
        Tween.stopAllByTarget(ringQuad);
        Tween.stopAllByTarget(ringGlowQuad);
        Tween.stopAllByTarget(mainQuad);
        Tween.stopAllByTarget(mainGlowQuad);
        Tween.stopAllByTarget(arrowQuad);
        Tween.stopAllByTarget(arrowGlowQuad);
        if (arrowQuadSecondary) {
            Tween.stopAllByTarget(arrowQuadSecondary);
        }
        if (arrowGlowQuadSecondary) {
            Tween.stopAllByTarget(arrowGlowQuadSecondary);
        }
        Tween.stopAllByTarget(sparkRoot);
        for (const spark of sparkQuads) {
            Tween.stopAllByTarget(spark);
        }
        Tween.stopAllByTarget(iconRoot);

        ringRoot.setRotationFromEuler(-90, 0, 0);
        ringQuad.setRotationFromEuler(0, 0, 0);
        ringQuad.setScale(0.01, 0.01, 0.01);
        ringGlowQuad.setRotationFromEuler(0, 0, 0);
        ringGlowQuad.setScale(0.01, 0.01, 0.01);
        ringRoot.setPosition(0, 0.02, 0);
        ringQuad.setPosition(0, 0, 0);
        ringGlowQuad.setPosition(0, 0, 0);
        iconRoot.setPosition(0, 0.11, 0);
        sparkRoot.setPosition(0, 0.09, 0);
        const dir = slot.arrowUp ? 1 : -1;
        const isHpStyle = !!this.config.useDualArrows;
        const mainPopY = isHpStyle ? BuffGainEffectPool.HP_MAIN_POP_Y : BuffGainEffectPool.SWORD_POP_Y;
        const mainFloatDistance = isHpStyle ? BuffGainEffectPool.HP_MAIN_FLOAT_DISTANCE : BuffGainEffectPool.SWORD_FLOAT_DISTANCE;
        const arrowPopY = isHpStyle ? BuffGainEffectPool.HP_ARROW_POP_Y : BuffGainEffectPool.ATK_ARROW_POP_Y;
        const arrowFloatDistance = isHpStyle ? BuffGainEffectPool.HP_ARROW_FLOAT_DISTANCE : BuffGainEffectPool.ATK_ARROW_FLOAT_DISTANCE;
        mainQuad.setRotationFromEuler(0, 0, BuffGainEffectPool.SWORD_Z_DEG - this.cameraRollComp);
        mainQuad.setScale(0.01, 0.01, 0.01);
        mainQuad.setPosition(0, mainPopY, 0);
        mainGlowQuad.setRotationFromEuler(0, 0, BuffGainEffectPool.SWORD_Z_DEG - this.cameraRollComp);
        mainGlowQuad.setScale(0.01, 0.01, 0.01);
        mainGlowQuad.setPosition(0, mainPopY, 0);
        arrowQuad.setRotationFromEuler(0, 0, slot.zRot - this.cameraRollComp);
        arrowQuad.setScale(0.01, 0.01, 0.01);
        arrowQuad.setPosition(0, arrowPopY, 0);
        arrowGlowQuad.setRotationFromEuler(0, 0, slot.zRot - this.cameraRollComp);
        arrowGlowQuad.setScale(0.01, 0.01, 0.01);
        arrowGlowQuad.setPosition(0, arrowPopY, 0);
        if (arrowQuadSecondary) {
            arrowQuadSecondary.setRotationFromEuler(0, 0, slot.zRot - this.cameraRollComp);
            arrowQuadSecondary.setScale(0.01, 0.01, 0.01);
            arrowQuadSecondary.setPosition(0, arrowPopY + BuffGainEffectPool.HP_ARROW_SECONDARY_OFFSET, 0);
        }
        if (arrowGlowQuadSecondary) {
            arrowGlowQuadSecondary.setRotationFromEuler(0, 0, slot.zRot - this.cameraRollComp);
            arrowGlowQuadSecondary.setScale(0.01, 0.01, 0.01);
            arrowGlowQuadSecondary.setPosition(0, arrowPopY + BuffGainEffectPool.HP_ARROW_SECONDARY_OFFSET, 0);
        }
        for (const spark of sparkQuads) {
            spark.setScale(0.01, 0.01, 0.01);
            spark.setPosition(0, 0, 0);
        }

        const mainEndY = dir > 0
            ? mainPopY + mainFloatDistance
            : Math.max(BuffGainEffectPool.MIN_DOWNWARD_ICON_Y, mainPopY - mainFloatDistance);
        const arrowEndY = dir > 0
            ? arrowPopY + arrowFloatDistance
            : Math.max(BuffGainEffectPool.MIN_DOWNWARD_ICON_Y + 0.04, arrowPopY - arrowFloatDistance);
        const secondaryArrowEndY = dir > 0
            ? arrowPopY + BuffGainEffectPool.HP_ARROW_SECONDARY_OFFSET + arrowFloatDistance
            : Math.max(BuffGainEffectPool.MIN_DOWNWARD_ICON_Y + 0.12, arrowPopY + BuffGainEffectPool.HP_ARROW_SECONDARY_OFFSET - arrowFloatDistance);

        this.playSparkBursts(sparkQuads, isHpStyle);

        // 分鏡：
        // 0.0 ~ 0.5s  只有法陣旋轉 + 開始噴火花
        // 0.5s        小劍出現
        // 1.0s        箭頭出現
        // 1.0 ~ 2.0s  停留展示
        // 2.0 ~ 3.0s  小劍與箭頭一起上浮淡出，法陣同步淡出
        tween(ringQuad)
            .to(BuffGainEffectPool.RING_ONLY_DURATION, { scale: new Vec3(BuffGainEffectPool.RING_SCALE, BuffGainEffectPool.RING_SCALE, BuffGainEffectPool.RING_SCALE) }, { easing: "quadOut" })
            .delay(BuffGainEffectPool.RING_IDLE_DURATION)
            .to(BuffGainEffectPool.RING_FADE_DURATION, { scale: new Vec3(0.01, 0.01, 0.01) }, { easing: "quadIn" })
            .start();

        tween(ringGlowQuad)
            .to(BuffGainEffectPool.RING_ONLY_DURATION, { scale: new Vec3(BuffGainEffectPool.RING_GLOW_SCALE, BuffGainEffectPool.RING_GLOW_SCALE, BuffGainEffectPool.RING_GLOW_SCALE) }, { easing: "quadOut" })
            .delay(BuffGainEffectPool.RING_IDLE_DURATION)
            .to(BuffGainEffectPool.RING_FADE_DURATION, { scale: new Vec3(0.01, 0.01, 0.01) }, { easing: "quadIn" })
            .start();

        tween(mainQuad)
            .delay(BuffGainEffectPool.RING_ONLY_DURATION)
            .to(BuffGainEffectPool.SWORD_POP_DURATION, { scale: new Vec3(0.48, 0.48, 0.48), position: new Vec3(0, mainPopY, 0) }, { easing: "backOut" })
            .delay(BuffGainEffectPool.SWORD_IDLE_DURATION)
            .to(BuffGainEffectPool.FLOAT_FADE_DURATION, {
                scale: new Vec3(0.08, 0.08, 0.08),
                position: new Vec3(0, mainEndY, 0)
            }, { easing: "sineIn" })
            .call(() => {
                slot.root.active = false;
                slot.active = false;
            })
            .start();

        tween(mainGlowQuad)
            .delay(BuffGainEffectPool.RING_ONLY_DURATION)
            .to(BuffGainEffectPool.SWORD_POP_DURATION, { scale: new Vec3(BuffGainEffectPool.MAIN_GLOW_SCALE, BuffGainEffectPool.MAIN_GLOW_SCALE, BuffGainEffectPool.MAIN_GLOW_SCALE), position: new Vec3(0, mainPopY, 0) }, { easing: "backOut" })
            .delay(BuffGainEffectPool.SWORD_IDLE_DURATION)
            .to(BuffGainEffectPool.FLOAT_FADE_DURATION, {
                scale: new Vec3(0.1, 0.1, 0.1),
                position: new Vec3(0, mainEndY, 0)
            }, { easing: "sineIn" })
            .start();

        tween(arrowQuad)
            .delay(BuffGainEffectPool.ARROW_DELAY)
            .to(BuffGainEffectPool.ARROW_POP_DURATION, { scale: new Vec3(0.34, 0.34, 0.34), position: new Vec3(0, arrowPopY, 0) }, { easing: "backOut" })
            .delay(BuffGainEffectPool.FLOAT_FADE_DURATION - BuffGainEffectPool.ARROW_POP_DURATION)
            .to(BuffGainEffectPool.FLOAT_FADE_DURATION, {
                scale: new Vec3(0.06, 0.06, 0.06),
                position: new Vec3(0, arrowEndY, 0)
            }, { easing: "sineIn" })
            .start();

        tween(arrowGlowQuad)
            .delay(BuffGainEffectPool.ARROW_DELAY)
            .to(BuffGainEffectPool.ARROW_POP_DURATION, { scale: new Vec3(BuffGainEffectPool.ARROW_GLOW_SCALE, BuffGainEffectPool.ARROW_GLOW_SCALE, BuffGainEffectPool.ARROW_GLOW_SCALE), position: new Vec3(0, arrowPopY, 0) }, { easing: "backOut" })
            .delay(BuffGainEffectPool.FLOAT_FADE_DURATION - BuffGainEffectPool.ARROW_POP_DURATION)
            .to(BuffGainEffectPool.FLOAT_FADE_DURATION, {
                scale: new Vec3(0.08, 0.08, 0.08),
                position: new Vec3(0, arrowEndY, 0)
            }, { easing: "sineIn" })
            .start();

        if (arrowQuadSecondary) {
            tween(arrowQuadSecondary)
                .delay(BuffGainEffectPool.ARROW_DELAY)
                .to(BuffGainEffectPool.ARROW_POP_DURATION, {
                    scale: new Vec3(0.28, 0.28, 0.28),
                    position: new Vec3(0, arrowPopY + BuffGainEffectPool.HP_ARROW_SECONDARY_OFFSET, 0)
                }, { easing: "backOut" })
                .delay(BuffGainEffectPool.FLOAT_FADE_DURATION - BuffGainEffectPool.ARROW_POP_DURATION)
                .to(BuffGainEffectPool.FLOAT_FADE_DURATION, {
                    scale: new Vec3(0.05, 0.05, 0.05),
                    position: new Vec3(0, secondaryArrowEndY, 0)
                }, { easing: "sineIn" })
                .start();
        }

        if (arrowGlowQuadSecondary) {
            tween(arrowGlowQuadSecondary)
                .delay(BuffGainEffectPool.ARROW_DELAY)
                .to(BuffGainEffectPool.ARROW_POP_DURATION, {
                    scale: new Vec3(BuffGainEffectPool.ARROW_GLOW_SECONDARY_SCALE, BuffGainEffectPool.ARROW_GLOW_SECONDARY_SCALE, BuffGainEffectPool.ARROW_GLOW_SECONDARY_SCALE),
                    position: new Vec3(0, arrowPopY + BuffGainEffectPool.HP_ARROW_SECONDARY_OFFSET, 0)
                }, { easing: "backOut" })
                .delay(BuffGainEffectPool.FLOAT_FADE_DURATION - BuffGainEffectPool.ARROW_POP_DURATION)
                .to(BuffGainEffectPool.FLOAT_FADE_DURATION, {
                    scale: new Vec3(0.07, 0.07, 0.07),
                    position: new Vec3(0, secondaryArrowEndY, 0)
                }, { easing: "sineIn" })
                .start();
        }
    }

    private updateIconFacing(slot: EffectSlot): void {
        if (!this.cameraNode) {
            return;
        }

        const iconWorld = slot.iconRoot.worldPosition;
        const cameraWorld = this.cameraNode.worldPosition;
        const dx = cameraWorld.x - iconWorld.x;
        const dz = cameraWorld.z - iconWorld.z;
        if (Math.abs(dx) < 0.0001 && Math.abs(dz) < 0.0001) {
            return;
        }

        const yaw = Math.atan2(dx, dz) * 180 / Math.PI;
        this.cameraRollComp = this.cameraNode.eulerAngles.z;
        slot.iconEulerBuf.set(0, yaw, 0);
        slot.iconRoot.setRotationFromEuler(slot.iconEulerBuf);
        slot.sparkRoot.setRotationFromEuler(slot.iconEulerBuf);
    }

    private playSparkBursts(sparkQuads: Node[], isHpStyle: boolean): void {
        const radius = isHpStyle ? 0.30 : 0.26;
        for (let i = 0; i < sparkQuads.length; i++) {
            const spark = sparkQuads[i];
            const angle = (i / sparkQuads.length) * Math.PI * 2 + Math.random() * 0.35;
            const startX = Math.cos(angle) * radius;
            const startY = 0.02 + Math.random() * 0.08;
            const startZ = Math.sin(angle) * 0.04;
            const endX = startX * (1.1 + Math.random() * 0.25);
            const endY = startY + 0.10 + Math.random() * 0.16;
            const delay = Math.random() * 1.25;
            const peakScale = 0.03 + Math.random() * 0.025;

            tween(spark)
                .delay(delay)
                .to(0.10, {
                    scale: new Vec3(peakScale, peakScale, peakScale),
                    position: new Vec3(startX, startY, startZ)
                }, { easing: "quadOut" })
                .to(0.75, {
                    scale: new Vec3(0.001, 0.001, 0.001),
                    position: new Vec3(endX, endY, startZ)
                }, { easing: "quadIn" })
                .start();
        }
    }

    private createSparkMaterial(color: Color): Material {
        const mat = new Material();
        if (!this.vfxEffectAsset) {
            return mat;
        }
        mat.initialize({
            effectAsset: this.vfxEffectAsset,
            technique: BuffGainEffectPool.TECHNIQUE_ADDITIVE,
        });
        mat.setProperty("mainColor", color);
        mat.setProperty("effectParams", this.makeEffectParams(0.12, 0.08, 1.04, 0.52));
        mat.setProperty("uvTransform", new Vec4(1, 1, 0, 0));
        return mat;
    }

    private makeEffectParams(alphaCutoff: number, alphaSoftness: number, colorBoost: number, alphaBoost: number): Vec4 {
        return new Vec4(alphaCutoff, alphaSoftness, colorBoost, alphaBoost);
    }

    private withAlpha(color: Color, alpha: number): Color {
        return new Color(color.r, color.g, color.b, alpha);
    }

    private loadEffectAsset(): Promise<EffectAsset | null> {
        if (this.vfxEffectAsset) {
            return Promise.resolve(this.vfxEffectAsset);
        }

        return new Promise(resolve => {
            resources.load("effects/vfx-buff-quad", EffectAsset, (err, effectAsset) => {
                if (err || !effectAsset) {
                    console.warn("[BuffGainEffectPool] 自訂 effect 載入失敗:", err?.message);
                    resolve(null);
                    return;
                }
                resolve(effectAsset);
            });
        });
    }

    private loadMaterial(texturePath: string, color: Color, tag: string, technique: number, effectParams: Vec4): Promise<Material | null> {
        return new Promise(resolve => {
            if (!texturePath) {
                resolve(null);
                return;
            }

            if (!this.vfxEffectAsset) {
                resolve(null);
                return;
            }

            const mat = new Material();
            mat.initialize({
                effectAsset: this.vfxEffectAsset,
                technique,
            });
            mat.setProperty("mainColor", color);
            mat.setProperty("effectParams", effectParams);
            mat.setProperty("uvTransform", new Vec4(1, 1, 0, 0));

            const parts = texturePath.split(':');
            let bundleName = "resources";
            let realPath = texturePath;
            if (parts.length === 2) {
                bundleName = parts[0];
                realPath = parts[1];
            }

            const doLoad = (bundle: AssetManager.Bundle) => {
                bundle.load(realPath + '/texture', Texture2D, (err, tex) => {
                    if (err || !tex) {
                        bundle.load(realPath, ImageAsset, (err2, img) => {
                            if (err2 || !img) {
                                console.warn(`[BuffGainEffectPool:${tag}] load asset failed (${texturePath}):`, err2?.message);
                                resolve(null);
                                return;
                            }
                            const fallbackTex = new Texture2D();
                            fallbackTex.image = img;
                            mat.setProperty('mainTexture', fallbackTex);
                            resolve(mat);
                        });
                        return;
                    }
                    mat.setProperty('mainTexture', tex);
                    resolve(mat);
                });
            };

            if (bundleName === "resources") {
                doLoad(resources);
            } else {
                let existingBundle = assetManager.getBundle(bundleName);
                if (existingBundle) {
                    doLoad(existingBundle);
                } else {
                    assetManager.loadBundle(bundleName, (err, bundle) => {
                        if (err || !bundle) {
                            console.warn(`[BuffGainEffectPool:${tag}] Bundle 載入失敗 (${bundleName}):`, err?.message);
                            resolve(null);
                            return;
                        }
                        doLoad(bundle);
                    });
                }
            }
        });
    }
}
