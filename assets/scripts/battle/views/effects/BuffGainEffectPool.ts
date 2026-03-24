import {
    _decorator, Component, Node, Material, Mesh, Color,
    MeshRenderer, ImageAsset, Texture2D, Layers, EffectAsset,
    JsonAsset, ParticleSystem, Prefab, instantiate,
    Vec3, Vec4, tween, Tween, resources, utils, primitives, assetManager, AssetManager
} from "cc";
import { BuffEffectPrefabController } from "./BuffEffectPrefabController";
import { applyParticleOverride, ParticleBurstOverride, ParticleOverride } from "../../../core/utils/ParticleUtils";
import {
    BuffEffectVariant,
    BuffParticleProfile,
    DEFAULT_BUFF_PARTICLE_PROFILES,
    ParticleColorValue,
    ParticleLayerProfile,
    normalizeBuffParticleProfileTable,
} from "./BuffParticleProfileConfig";

const { ccclass } = _decorator;

/** Pool 內部單一效果 slot 的狀態 */
interface EffectSlot {
    root: Node;
    prefabRoot: Node | null;
    controller: BuffEffectPrefabController | null;
    /** 平貼地面的法陣根節點 */
    ringRoot: Node;
    /** 面向鏡頭的圖示根節點 */
    iconRoot: Node;
    /** 火花粒子根節點 */
    sparkRoot: Node;
    /** 第二層粒子根節點 */
    accentRoot: Node;
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
    /** prefab 內的主粒子 */
    sparkParticles: ParticleSystem[];
    /** prefab 內的第二層粒子（可選） */
    accentParticles: ParticleSystem[];
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
    variant: BuffEffectVariant;
    prefabPath?: string;
    ringTexturePath: string;
    mainTexturePath: string;
    arrowTexturePath: string;
    sparkTexturePath?: string;
    arrowUp: boolean;
    useDualArrows?: boolean;
    mainRotationDeg?: number;
    mainScaleMultiplier?: number;
    ringColor?: Color;
    mainColor?: Color;
    arrowColor?: Color;
    label?: string;
}

@ccclass("BuffGainEffectPool")
export class BuffGainEffectPool extends Component {
    private static particleProfileCache: Promise<Record<BuffEffectVariant, BuffParticleProfile>> | null = null;
    private static readonly TECHNIQUE_TRANSPARENT = 0;
    private static readonly TECHNIQUE_ADDITIVE = 1;
    private static readonly TECHNIQUE_OUTER_GLOW = 2;
    private static readonly POOL_SIZE = 4;
    private static readonly ROLL_DEG_PER_SEC = 120;
    private static readonly SWORD_Z_DEG = 270;
    private static readonly RING_SCALE = 0.72;
    private static readonly RING_PULSE_SCALE = 0.84;
    private static readonly RING_ONLY_DURATION = 0.5;
    private static readonly SWORD_POP_DURATION = 0.18;
    private static readonly SWORD_IDLE_DURATION = 1.32;
    private static readonly RING_IDLE_DURATION = 1.5;
    private static readonly RING_FADE_DURATION = 1.0;
    private static readonly SPARK_DURATION = 2.2;
    private static readonly SPARK_COUNT = 14;
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
    private static readonly RING_GLOW_ALPHA = 64;
    private static readonly MAIN_GLOW_ALPHA = 72;
    private static readonly ARROW_GLOW_ALPHA = 68;

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
    private effectPrefab: Prefab | null = null;
    private particleProfiles: Record<BuffEffectVariant, BuffParticleProfile> = DEFAULT_BUFF_PARTICLE_PROFILES;
    private ringAspectScale = new Vec3(1, 1, 1);
    private mainAspectScale = new Vec3(1, 1, 1);
    private arrowAspectScale = new Vec3(1, 1, 1);
    private ready = false;
    private cameraNode: Node | null = null;
    private cameraRollComp = 0;

    update(dt: number): void {
        for (const slot of this.slots) {
            if (!slot.active) continue;
            this.updateIconFacing(slot);
            slot.ringAngle += BuffGainEffectPool.ROLL_DEG_PER_SEC * dt;
            slot.ringEulerBuf.set(0, 0, slot.ringAngle);
            slot.mainEulerBuf.set(0, 0, this.getMainRotationDeg() - this.cameraRollComp);
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

        const [ringMat, ringGlowMat, mainMat, mainGlowMat, arrowMat, arrowGlowMat, sparkMat, prefab, ringAspect, mainAspect, arrowAspect, particleProfiles] = await Promise.all([
            this.loadMaterial(config.ringTexturePath, this.withAlpha(config.ringColor ?? config.mainColor ?? new Color(255, 255, 255, 240), 196), `${config.label ?? "?"}:ring`, BuffGainEffectPool.TECHNIQUE_ADDITIVE, this.makeEffectParams(0.05, 0.05, 1.06, 0.92)),
            this.loadMaterial(config.ringTexturePath, this.withAlpha(config.ringColor ?? config.mainColor ?? new Color(255, 255, 255, 240), BuffGainEffectPool.RING_GLOW_ALPHA), `${config.label ?? "?"}:ringGlow`, BuffGainEffectPool.TECHNIQUE_OUTER_GLOW, this.makeEffectParams(0.14, 0.14, 1.08, 0.42)),
            this.loadMaterial(config.mainTexturePath, this.withAlpha(config.mainColor ?? new Color(255, 255, 255, 240), 180), `${config.label ?? "?"}:main`, BuffGainEffectPool.TECHNIQUE_ADDITIVE, this.makeEffectParams(0.04, 0.06, 1.1, 0.86)),
            this.loadMaterial(config.mainTexturePath, this.withAlpha(config.mainColor ?? new Color(255, 255, 255, 240), BuffGainEffectPool.MAIN_GLOW_ALPHA), `${config.label ?? "?"}:mainGlow`, BuffGainEffectPool.TECHNIQUE_OUTER_GLOW, this.makeEffectParams(0.12, 0.16, 1.14, 0.44)),
            this.loadMaterial(config.arrowTexturePath, this.withAlpha(config.arrowColor ?? config.mainColor ?? new Color(255, 255, 255, 240), 172), `${config.label ?? "?"}:arrow`, BuffGainEffectPool.TECHNIQUE_ADDITIVE, this.makeEffectParams(0.04, 0.06, 1.08, 0.84)),
            this.loadMaterial(config.arrowTexturePath, this.withAlpha(config.arrowColor ?? config.mainColor ?? new Color(255, 255, 255, 240), BuffGainEffectPool.ARROW_GLOW_ALPHA), `${config.label ?? "?"}:arrowGlow`, BuffGainEffectPool.TECHNIQUE_OUTER_GLOW, this.makeEffectParams(0.12, 0.16, 1.12, 0.4)),
            this.loadMaterial(config.sparkTexturePath ?? config.arrowTexturePath, this.withAlpha(config.arrowColor ?? config.mainColor ?? new Color(255, 255, 255, 220), 144), `${config.label ?? "?"}:spark`, BuffGainEffectPool.TECHNIQUE_ADDITIVE, this.makeEffectParams(0.08, 0.10, 1.15, 0.54)),
            this.loadPrefab(config.prefabPath),
            this.loadTextureAspect(config.ringTexturePath),
            this.loadTextureAspect(config.mainTexturePath),
            this.loadTextureAspect(config.arrowTexturePath),
            this.loadParticleProfiles(),
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
        this.sparkMaterial = sparkMat ?? this.createSparkMaterial(config.arrowColor ?? config.mainColor ?? new Color(255, 255, 255, 220));
        this.effectPrefab = prefab;
        this.particleProfiles = particleProfiles;
        this.ringAspectScale = this.makeAspectScale(ringAspect);
        this.mainAspectScale = this.makeAspectScale(mainAspect);
        this.arrowAspectScale = this.makeAspectScale(arrowAspect);

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

        const prefabRoot = this.effectPrefab ? instantiate(this.effectPrefab) : null;
        if (prefabRoot) {
            prefabRoot.name = `PrefabRoot_${index}`;
            prefabRoot.layer = Layers.Enum.DEFAULT;
            prefabRoot.setPosition(0, 0, 0);
            prefabRoot.setRotationFromEuler(0, 0, 0);
            prefabRoot.setScale(1, 1, 1);
            root.addChild(prefabRoot);
        }

        const controller = prefabRoot ? (prefabRoot.getComponent(BuffEffectPrefabController) ?? prefabRoot.addComponent(BuffEffectPrefabController)) : null;
        controller?.ensureStructure();

        const ringRoot = controller?.ringRoot ?? this.getOrCreateChild(prefabRoot ?? root, `RingRoot_${index}`, 'RingRoot');
        ringRoot.layer = Layers.Enum.DEFAULT;

        const iconRoot = controller?.iconRoot ?? this.getOrCreateChild(prefabRoot ?? root, `IconRoot_${index}`, 'IconRoot');
        iconRoot.layer = Layers.Enum.DEFAULT;

        const sparkRoot = controller?.sparkPS ?? this.resolveSparkRoot(prefabRoot, root, index);
        sparkRoot.layer = Layers.Enum.DEFAULT;
        const accentRoot = controller?.accentPS ?? this.getOrCreateChild(prefabRoot ?? root, `AccentPS_${index}`, 'AccentPS');
        accentRoot.layer = Layers.Enum.DEFAULT;

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
        if (!prefabRoot) {
            for (let i = 0; i < BuffGainEffectPool.SPARK_COUNT; i++) {
                const spark = this.makeQuad(`Spark_${i}`, sparkRoot, this.sparkMaterial);
                spark.setScale(0.01, 0.01, 0.01);
                sparkQuads.push(spark);
            }
        }
        const sparkParticles = sparkRoot.getComponentsInChildren(ParticleSystem);
        const accentParticles = accentRoot.getComponentsInChildren(ParticleSystem);
        ringRoot.setRotationFromEuler(-90, 0, 0);
        ringQuad.setRotationFromEuler(0, 0, 0);
        ringGlowQuad.setRotationFromEuler(0, 0, 0);
        mainQuad.setRotationFromEuler(0, 0, this.getMainRotationDeg() - this.cameraRollComp);
        mainGlowQuad.setRotationFromEuler(0, 0, this.getMainRotationDeg() - this.cameraRollComp);
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
            root, prefabRoot, controller, ringRoot, iconRoot, sparkRoot, accentRoot, ringQuad, ringGlowQuad, mainQuad, mainGlowQuad, arrowQuad, arrowGlowQuad, arrowQuadSecondary, arrowGlowQuadSecondary, sparkQuads, sparkParticles, accentParticles,
            active: false,
            ringAngle: 0, zRot,
            arrowUp: this.config.arrowUp,
            iconEulerBuf: new Vec3(0, 0, 0),
            ringEulerBuf: new Vec3(0, 0, 0),
            mainEulerBuf: new Vec3(0, 0, this.getMainRotationDeg()),
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

        const { ringRoot, ringQuad, ringGlowQuad, mainQuad, mainGlowQuad, arrowQuad, arrowGlowQuad, arrowQuadSecondary, arrowGlowQuadSecondary, iconRoot, sparkRoot, accentRoot, sparkQuads, sparkParticles, accentParticles } = slot;

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
        Tween.stopAllByTarget(accentRoot);
        for (const spark of sparkQuads) {
            Tween.stopAllByTarget(spark);
        }
        sparkParticles.forEach(ps => {
            ps.stop();
            ps.clear();
        });
        accentParticles.forEach(ps => {
            ps.stop();
            ps.clear();
        });
        Tween.stopAllByTarget(iconRoot);

        ringRoot.setRotationFromEuler(-90, 0, 0);
        ringQuad.setRotationFromEuler(0, 0, 0);
        ringQuad.setScale(this.scaledAspect(this.ringAspectScale, 0.01));
        ringGlowQuad.setRotationFromEuler(0, 0, 0);
        ringGlowQuad.setScale(this.scaledAspect(this.ringAspectScale, 0.01));
        ringRoot.setPosition(0, 0.02, 0);
        ringQuad.setPosition(0, 0, 0);
        ringGlowQuad.setPosition(0, 0, 0);
        iconRoot.setPosition(0, 0.11, 0);
        sparkRoot.setPosition(0, 0.09, 0);
        accentRoot.setPosition(0, 0.1, 0);
        const dir = slot.arrowUp ? 1 : -1;
        const isHpStyle = !!this.config.useDualArrows;
        const mainPopY = isHpStyle ? BuffGainEffectPool.HP_MAIN_POP_Y : BuffGainEffectPool.SWORD_POP_Y;
        const mainFloatDistance = isHpStyle ? BuffGainEffectPool.HP_MAIN_FLOAT_DISTANCE : BuffGainEffectPool.SWORD_FLOAT_DISTANCE;
        const arrowPopY = isHpStyle ? BuffGainEffectPool.HP_ARROW_POP_Y : BuffGainEffectPool.ATK_ARROW_POP_Y;
        const arrowFloatDistance = isHpStyle ? BuffGainEffectPool.HP_ARROW_FLOAT_DISTANCE : BuffGainEffectPool.ATK_ARROW_FLOAT_DISTANCE;
        mainQuad.setRotationFromEuler(0, 0, this.getMainRotationDeg() - this.cameraRollComp);
        mainQuad.setScale(this.scaledMainAspect(0.01));
        mainQuad.setPosition(0, mainPopY, 0);
        mainGlowQuad.setRotationFromEuler(0, 0, this.getMainRotationDeg() - this.cameraRollComp);
        mainGlowQuad.setScale(this.scaledMainAspect(0.01));
        mainGlowQuad.setPosition(0, mainPopY, 0);
        arrowQuad.setRotationFromEuler(0, 0, slot.zRot - this.cameraRollComp);
        arrowQuad.setScale(this.scaledAspect(this.arrowAspectScale, 0.01));
        arrowQuad.setPosition(0, arrowPopY, 0);
        arrowGlowQuad.setRotationFromEuler(0, 0, slot.zRot - this.cameraRollComp);
        arrowGlowQuad.setScale(this.scaledAspect(this.arrowAspectScale, 0.01));
        arrowGlowQuad.setPosition(0, arrowPopY, 0);
        if (arrowQuadSecondary) {
            arrowQuadSecondary.setRotationFromEuler(0, 0, slot.zRot - this.cameraRollComp);
            arrowQuadSecondary.setScale(this.scaledAspect(this.arrowAspectScale, 0.01));
            arrowQuadSecondary.setPosition(0, arrowPopY + BuffGainEffectPool.HP_ARROW_SECONDARY_OFFSET, 0);
        }
        if (arrowGlowQuadSecondary) {
            arrowGlowQuadSecondary.setRotationFromEuler(0, 0, slot.zRot - this.cameraRollComp);
            arrowGlowQuadSecondary.setScale(this.scaledAspect(this.arrowAspectScale, 0.01));
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

        this.playSparkBursts(slot, isHpStyle);

        // 分鏡：
        // 0.0 ~ 0.5s  只有法陣旋轉 + 開始噴火花
        // 0.5s        小劍出現
        // 1.0s        箭頭出現
        // 1.0 ~ 2.0s  停留展示
        // 2.0 ~ 3.0s  小劍與箭頭一起上浮淡出，法陣同步淡出
        tween(ringQuad)
            .to(BuffGainEffectPool.RING_ONLY_DURATION, { scale: this.scaledAspect(this.ringAspectScale, BuffGainEffectPool.RING_SCALE) }, { easing: "quadOut" })
            .to(0.32, { scale: this.scaledAspect(this.ringAspectScale, BuffGainEffectPool.RING_PULSE_SCALE) }, { easing: "sineOut" })
            .to(0.28, { scale: this.scaledAspect(this.ringAspectScale, BuffGainEffectPool.RING_SCALE) }, { easing: "sineInOut" })
            .delay(BuffGainEffectPool.RING_IDLE_DURATION)
            .to(BuffGainEffectPool.RING_FADE_DURATION, { scale: this.scaledAspect(this.ringAspectScale, 0.01) }, { easing: "quadIn" })
            .start();

        tween(ringGlowQuad)
            .to(BuffGainEffectPool.RING_ONLY_DURATION, { scale: this.scaledAspect(this.ringAspectScale, BuffGainEffectPool.RING_GLOW_SCALE) }, { easing: "quadOut" })
            .to(0.32, { scale: this.scaledAspect(this.ringAspectScale, BuffGainEffectPool.RING_GLOW_SCALE * 1.12) }, { easing: "sineOut" })
            .to(0.28, { scale: this.scaledAspect(this.ringAspectScale, BuffGainEffectPool.RING_GLOW_SCALE) }, { easing: "sineInOut" })
            .delay(BuffGainEffectPool.RING_IDLE_DURATION)
            .to(BuffGainEffectPool.RING_FADE_DURATION, { scale: this.scaledAspect(this.ringAspectScale, 0.01) }, { easing: "quadIn" })
            .start();

        tween(mainQuad)
            .delay(BuffGainEffectPool.RING_ONLY_DURATION)
            .to(BuffGainEffectPool.SWORD_POP_DURATION, { scale: this.scaledMainAspect(0.48), position: new Vec3(0, mainPopY, 0) }, { easing: "backOut" })
            .to(0.18, { scale: this.scaledMainAspect(0.54) }, { easing: "sineOut" })
            .to(0.16, { scale: this.scaledMainAspect(0.48) }, { easing: "sineInOut" })
            .delay(BuffGainEffectPool.SWORD_IDLE_DURATION - 0.34)
            .to(BuffGainEffectPool.FLOAT_FADE_DURATION, {
                scale: this.scaledMainAspect(0.08),
                position: new Vec3(0, mainEndY, 0)
            }, { easing: "sineIn" })
            .call(() => {
                slot.root.active = false;
                slot.active = false;
            })
            .start();

        tween(mainGlowQuad)
            .delay(BuffGainEffectPool.RING_ONLY_DURATION)
            .to(BuffGainEffectPool.SWORD_POP_DURATION, { scale: this.scaledMainAspect(BuffGainEffectPool.MAIN_GLOW_SCALE), position: new Vec3(0, mainPopY, 0) }, { easing: "backOut" })
            .to(0.18, { scale: this.scaledMainAspect(BuffGainEffectPool.MAIN_GLOW_SCALE * 1.15) }, { easing: "sineOut" })
            .to(0.16, { scale: this.scaledMainAspect(BuffGainEffectPool.MAIN_GLOW_SCALE) }, { easing: "sineInOut" })
            .delay(BuffGainEffectPool.SWORD_IDLE_DURATION - 0.34)
            .to(BuffGainEffectPool.FLOAT_FADE_DURATION, {
                scale: this.scaledMainAspect(0.1),
                position: new Vec3(0, mainEndY, 0)
            }, { easing: "sineIn" })
            .start();

        tween(arrowQuad)
            .delay(BuffGainEffectPool.ARROW_DELAY)
            .to(BuffGainEffectPool.ARROW_POP_DURATION, { scale: this.scaledAspect(this.arrowAspectScale, 0.34), position: new Vec3(0, arrowPopY, 0) }, { easing: "backOut" })
            .delay(BuffGainEffectPool.FLOAT_FADE_DURATION - BuffGainEffectPool.ARROW_POP_DURATION)
            .to(BuffGainEffectPool.FLOAT_FADE_DURATION, {
                scale: this.scaledAspect(this.arrowAspectScale, 0.06),
                position: new Vec3(0, arrowEndY, 0)
            }, { easing: "sineIn" })
            .start();

        tween(arrowGlowQuad)
            .delay(BuffGainEffectPool.ARROW_DELAY)
            .to(BuffGainEffectPool.ARROW_POP_DURATION, { scale: this.scaledAspect(this.arrowAspectScale, BuffGainEffectPool.ARROW_GLOW_SCALE), position: new Vec3(0, arrowPopY, 0) }, { easing: "backOut" })
            .delay(BuffGainEffectPool.FLOAT_FADE_DURATION - BuffGainEffectPool.ARROW_POP_DURATION)
            .to(BuffGainEffectPool.FLOAT_FADE_DURATION, {
                scale: this.scaledAspect(this.arrowAspectScale, 0.08),
                position: new Vec3(0, arrowEndY, 0)
            }, { easing: "sineIn" })
            .start();

        if (arrowQuadSecondary) {
            tween(arrowQuadSecondary)
                .delay(BuffGainEffectPool.ARROW_DELAY)
                .to(BuffGainEffectPool.ARROW_POP_DURATION, {
                    scale: this.scaledAspect(this.arrowAspectScale, 0.28),
                    position: new Vec3(0, arrowPopY + BuffGainEffectPool.HP_ARROW_SECONDARY_OFFSET, 0)
                }, { easing: "backOut" })
                .delay(BuffGainEffectPool.FLOAT_FADE_DURATION - BuffGainEffectPool.ARROW_POP_DURATION)
                .to(BuffGainEffectPool.FLOAT_FADE_DURATION, {
                    scale: this.scaledAspect(this.arrowAspectScale, 0.05),
                    position: new Vec3(0, secondaryArrowEndY, 0)
                }, { easing: "sineIn" })
                .start();
        }

        if (arrowGlowQuadSecondary) {
            tween(arrowGlowQuadSecondary)
                .delay(BuffGainEffectPool.ARROW_DELAY)
                .to(BuffGainEffectPool.ARROW_POP_DURATION, {
                    scale: this.scaledAspect(this.arrowAspectScale, BuffGainEffectPool.ARROW_GLOW_SECONDARY_SCALE),
                    position: new Vec3(0, arrowPopY + BuffGainEffectPool.HP_ARROW_SECONDARY_OFFSET, 0)
                }, { easing: "backOut" })
                .delay(BuffGainEffectPool.FLOAT_FADE_DURATION - BuffGainEffectPool.ARROW_POP_DURATION)
                .to(BuffGainEffectPool.FLOAT_FADE_DURATION, {
                    scale: this.scaledAspect(this.arrowAspectScale, 0.07),
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

    private playSparkBursts(slot: EffectSlot, isHpStyle: boolean): void {
        const { sparkRoot, accentRoot, sparkQuads, sparkParticles, accentParticles } = slot;
        const profile = this.getVariantParticleProfile();
        if (sparkParticles.length > 0 || accentParticles.length > 0) {
            const primaryColor = this.getSparkParticleColor(profile);
            const accentColor = this.getAccentParticleColor(profile);
            sparkRoot.setPosition(0, profile.spark.startY, 0);
            accentRoot.setPosition(0, profile.accent.startY, 0);
            this.playPrefabParticles(sparkParticles, primaryColor, profile.spark);
            this.playPrefabParticles(accentParticles, accentColor, profile.accent);
            tween(sparkRoot)
                .to(BuffGainEffectPool.SPARK_DURATION, { position: new Vec3(0, profile.spark.floatY, 0) }, { easing: "sineOut" })
                .start();
            tween(accentRoot)
                .to(BuffGainEffectPool.SPARK_DURATION, { position: new Vec3(0, profile.accent.floatY, 0) }, { easing: "sineOut" })
                .start();
            return;
        }

        sparkRoot.setPosition(0, profile.spark.startY, 0);
        tween(sparkRoot)
            .to(BuffGainEffectPool.SPARK_DURATION, { position: new Vec3(0, profile.spark.floatY, 0) }, { easing: "sineOut" })
            .start();
        const radius = profile.spark.quadRadius;
        const activeCount = Math.min(profile.spark.quadCount, sparkQuads.length);
        for (let i = 0; i < sparkQuads.length; i++) {
            const spark = sparkQuads[i];
            if (i >= activeCount) {
                spark.setScale(0.001, 0.001, 0.001);
                continue;
            }
            const angle = (i / sparkQuads.length) * Math.PI * 2 + Math.random() * 0.45;
            const swirl = Math.random() > 0.5 ? 1 : -1;
            const startRadius = radius * (0.45 + Math.random() * 0.55);
            const startX = Math.cos(angle) * startRadius;
            const startY = 0.01 + Math.random() * 0.08;
            const startZ = Math.sin(angle) * 0.06;
            const endX = startX + Math.cos(angle + swirl * 0.5) * (0.05 + Math.random() * 0.12);
            const endY = startY + profile.spark.quadRise + Math.random() * 0.14;
            const endZ = startZ + swirl * (0.02 + Math.random() * 0.04);
            const delay = Math.random() * 1.05;
            const peakScale = 0.02 + Math.random() * 0.03;
            const settleScale = peakScale * (0.55 + Math.random() * 0.2);

            tween(spark)
                .delay(delay)
                .to(0.10, {
                    scale: new Vec3(peakScale, peakScale, peakScale),
                    position: new Vec3(startX, startY, startZ)
                }, { easing: "quadOut" })
                .to(0.22, {
                    scale: new Vec3(settleScale, settleScale, settleScale),
                    position: new Vec3(startX * 0.82, startY + 0.08, startZ * 0.82)
                }, { easing: "sineOut" })
                .to(0.85, {
                    scale: new Vec3(0.001, 0.001, 0.001),
                    position: new Vec3(endX, endY, endZ)
                }, { easing: "quadIn" })
                .start();
        }
    }

    private makeAspectScale(aspect: number): Vec3 {
        const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
        return new Vec3(safeAspect, 1, 1);
    }

    private scaledAspect(base: Readonly<Vec3>, scalar: number): Vec3 {
        return new Vec3(base.x * scalar, base.y * scalar, base.z * scalar);
    }

    private scaledMainAspect(scalar: number): Vec3 {
        return this.scaledAspect(this.mainAspectScale, scalar * this.getMainScaleMultiplier());
    }

    private getMainRotationDeg(): number {
        return this.config.mainRotationDeg ?? BuffGainEffectPool.SWORD_Z_DEG;
    }

    private getMainScaleMultiplier(): number {
        return this.config.mainScaleMultiplier ?? 1;
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

    private loadTextureAspect(texturePath: string): Promise<number> {
        return new Promise(resolve => {
            if (!texturePath) {
                resolve(1);
                return;
            }

            const parts = texturePath.split(':');
            let bundleName = 'resources';
            let realPath = texturePath;
            if (parts.length === 2) {
                bundleName = parts[0];
                realPath = parts[1];
            }

            const onImage = (bundle: AssetManager.Bundle) => {
                bundle.load(realPath, ImageAsset, (err, img) => {
                    if (err || !img) {
                        resolve(1);
                        return;
                    }
                    resolve(img.width > 0 && img.height > 0 ? img.width / img.height : 1);
                });
            };

            if (bundleName === 'resources') {
                onImage(resources);
            } else {
                const existingBundle = assetManager.getBundle(bundleName);
                if (existingBundle) {
                    onImage(existingBundle);
                } else {
                    assetManager.loadBundle(bundleName, (err, bundle) => {
                        if (err || !bundle) {
                            resolve(1);
                            return;
                        }
                        onImage(bundle);
                    });
                }
            }
        });
    }

    private loadPrefab(prefabPath?: string): Promise<Prefab | null> {
        if (!prefabPath) {
            return Promise.resolve(null);
        }

        return new Promise(resolve => {
            resources.load(prefabPath, Prefab, (err, prefab) => {
                if (err || !prefab) {
                    console.warn(`[BuffGainEffectPool] prefab 載入失敗 (${prefabPath}):`, err?.message);
                    resolve(null);
                    return;
                }
                resolve(prefab);
            });
        });
    }

    private getOrCreateChild(parent: Node, fallbackName: string, logicalName: string): Node {
        const existing = parent.getChildByName(logicalName) ?? parent.getChildByName(fallbackName);
        if (existing) {
            existing.name = logicalName;
            return existing;
        }
        const node = new Node(logicalName);
        node.layer = Layers.Enum.DEFAULT;
        parent.addChild(node);
        return node;
    }

    private resolveSparkRoot(prefabRoot: Node | null, root: Node, index: number): Node {
        if (!prefabRoot) {
            const node = new Node(`SparkRoot_${index}`);
            node.layer = Layers.Enum.DEFAULT;
            root.addChild(node);
            return node;
        }

        const named = prefabRoot.getChildByName('SparkPS');
        if (named) {
            return named;
        }

        const particleNode = prefabRoot.children.find(child => child.getComponent(ParticleSystem));
        if (particleNode) {
            particleNode.name = 'SparkPS';
            return particleNode;
        }

        const node = new Node('SparkPS');
        node.layer = Layers.Enum.DEFAULT;
        prefabRoot.addChild(node);
        return node;
    }

    private playPrefabParticles(systems: ParticleSystem[], color: Color, profile: ParticleLayerProfile): void {
        systems.forEach(ps => {
            const bursts: ParticleBurstOverride[] = [{ time: profile.burstTime, count: profile.burstCount }];
            ps.clear();
            ps.stop();
            const override: ParticleOverride = {
                startColor: color,
                startLifetime: profile.startLifetime,
                startSpeed: profile.startSpeed,
                startSize: profile.startSize,
                startSizeY: profile.startSize,
                startSizeZ: profile.startSize,
                startDelay: profile.startDelay,
                rateOverTime: profile.rateOverTime,
                capacity: profile.capacity,
                duration: Math.max(profile.startLifetime + 0.35, 1),
                simulationSpeed: profile.simulationSpeed,
                gravityModifier: profile.gravityModifier,
                loop: false,
                playOnAwake: false,
                shapeRadius: profile.shapeRadius,
                shapeAngle: profile.shapeAngle,
                bursts,
            };
            applyParticleOverride(ps, override);
            ps.play();
        });
    }

    private getSparkParticleColor(profile: BuffParticleProfile): Color {
        return this.colorTupleToColor(profile.spark.color)
            ?? this.withAlpha(this.config.arrowColor ?? this.config.mainColor ?? new Color(255, 210, 120, 255), 232);
    }

    private getAccentParticleColor(profile: BuffParticleProfile): Color {
        return this.colorTupleToColor(profile.accent.color)
            ?? this.withAlpha(this.config.ringColor ?? this.config.arrowColor ?? new Color(255, 232, 160, 255), 180);
    }

    private getVariantParticleProfile(): BuffParticleProfile {
        return this.particleProfiles[this.config.variant] ?? DEFAULT_BUFF_PARTICLE_PROFILES[this.config.variant];
    }

    private colorTupleToColor(value?: ParticleColorValue): Color | null {
        if (!value || value.length !== 4) {
            return null;
        }
        return new Color(value[0], value[1], value[2], value[3]);
    }

    private loadParticleProfiles(): Promise<Record<BuffEffectVariant, BuffParticleProfile>> {
        if (BuffGainEffectPool.particleProfileCache) {
            return BuffGainEffectPool.particleProfileCache;
        }

        BuffGainEffectPool.particleProfileCache = new Promise(resolve => {
            resources.load("data/buff-particle-profiles", JsonAsset, (err, asset) => {
                if (err || !asset?.json) {
                    console.warn("[BuffGainEffectPool] buff-particle-profiles.json 載入失敗，改用內建 fallback:", err?.message);
                    resolve(DEFAULT_BUFF_PARTICLE_PROFILES);
                    return;
                }

                const table = normalizeBuffParticleProfileTable(asset.json);
                resolve(table.variants);
            });
        });

        return BuffGainEffectPool.particleProfileCache;
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
