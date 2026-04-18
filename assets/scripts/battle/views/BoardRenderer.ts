// @spec-source → 見 docs/cross-reference-index.md
import { _decorator, Component, Node, Vec3, Vec4, MeshRenderer, primitives, utils, Material, Color, Layers, gfx, tween, Tween, resources, EffectAsset, assetManager, AssetManager, Texture2D, ImageAsset } from 'cc';
import { BattleTactic, Faction, GAME_CONFIG } from '../../core/config/Constants';
import { BattleState } from '../models/BattleState';
import { UCUFLogger, LogCategory } from '../../ui/core/UCUFLogger';
import { resolveBattleSceneDisplayRule, type BattleSceneBaseStyle } from '../shared/BattleSceneMode';
import { resolveBattleSceneMode, resolveBattleScenePulseColor, type BattleSceneMode } from '../shared/BattleSceneMode';

const { ccclass, property } = _decorator;

interface TileBuffFxView {
    node: Node;
    material: Material;
    frameNode: Node | null;
    frameMaterial: Material | null;
    rarity: "normal" | "rare";
    anim: {
        alpha: number;
        scale: number;
        frameAlpha: number;
        frameScale: number;
    };
}

interface CellView {
    root: Node;
    fillRenderer: MeshRenderer | null;
    overlayRenderer: MeshRenderer | null;
    borderEdgeRenderers: MeshRenderer[];
    borderMidRenderers: MeshRenderer[];
    borderInnerRenderers: MeshRenderer[];
}

interface ImpactFxView {
    id: string;
    lane: number;
    depth: number;
    boardRevision: number;
    node: Node;
    material: Material;
    tween: Tween<{ alpha: number; scale: number }>;
}

type SceneEffectOverlayKind = 'fire' | 'water' | 'rock';

@ccclass('BoardRenderer')
export class BoardRenderer extends Component {
    @property
    public cols: number = 5;

    @property
    public rows: number = 8;

    @property({ tooltip: '格子大小' })
    public cellSize: number = 1.0;

    @property({ tooltip: '格子間距' })
    public cellGap: number = 0.1;

    @property({ tooltip: '棋盤根節點 Y 軸旋轉（度）' })
    public boardYaw: number = 0;

    @property({ tooltip: '棋盤世界位置偏移 X' })
    public boardOffsetX: number = 0;

    @property({ tooltip: '棋盤世界位置偏移 Z' })
    public boardOffsetZ: number = 0;

    private boardRoot: Node | null = null;
    private cellNodes: Map<string, CellView> = new Map();
    private flashQuadMesh: any = null;  // 戰鬥擊中閃光用的 quad，在 onLoad 建立一次再充用
    private defaultFillMaterial: Material | null = null;
    private floodBaseFillMaterial: Material | null = null;
    private defaultBorderMaterial: Material | null = null;
    private defaultBorderMidMaterial: Material | null = null;
    private defaultBorderInnerMaterial: Material | null = null;
    private playerOccupiedFillMaterial: Material | null = null;
    private playerOccupiedBorderMaterial: Material | null = null;
    private playerOccupiedBorderMidMaterial: Material | null = null;
    private playerOccupiedBorderInnerMaterial: Material | null = null;
    private enemyOccupiedFillMaterial: Material | null = null;
    private enemyOccupiedBorderMaterial: Material | null = null;
    private enemyOccupiedBorderMidMaterial: Material | null = null;
    private enemyOccupiedBorderInnerMaterial: Material | null = null;
    private playerDeployHintFillMaterial: Material | null = null;
    private playerDeployHintBorderMaterial: Material | null = null;
    private playerDeployHintBorderMidMaterial: Material | null = null;
    private playerDeployHintBorderInnerMaterial: Material | null = null;
    private enemyDeployHintFillMaterial: Material | null = null;
    private enemyDeployHintBorderMaterial: Material | null = null;
    private enemyDeployHintBorderMidMaterial: Material | null = null;
    private enemyDeployHintBorderInnerMaterial: Material | null = null;
    private skillPreviewFillMaterial: Material | null = null;
    private readonly skillPreviewKeys = new Set<string>();
    private sceneEffectFireFillMaterial: Material | null = null;
    private sceneEffectWaterFillMaterial: Material | null = null;
    private floodRippleFillMaterial: Material | null = null;
    private lightningArcFillMaterial: Material | null = null;
    private poisonFogFillMaterial: Material | null = null;
    private windVortexFillMaterial: Material | null = null;
    private iceCrystalFillMaterial: Material | null = null;
    private sceneEffectRockFillMaterial: Material | null = null;
    private sceneEffectCampFillMaterial: Material | null = null;
    private sceneEffectForestFillMaterial: Material | null = null;
    private boardEffectAsset: EffectAsset | null = null;
    private isBoardEffectLoading: boolean = false;
    private isFloodRippleLoading: boolean = false;
    private floodRippleLoadRequested: boolean = false;
    private isLightningArcLoading: boolean = false;
    private lightningArcLoadRequested: boolean = false;
    private isPoisonFogLoading: boolean = false;
    private poisonFogLoadRequested: boolean = false;
    private isWindVortexLoading: boolean = false;
    private windVortexLoadRequested: boolean = false;
    private isIceCrystalLoading: boolean = false;
    private iceCrystalLoadRequested: boolean = false;
    private deployHintFaction: Faction | null = Faction.Player;
    private readonly tileBuffFxViews: Map<string, TileBuffFxView> = new Map();
    private readonly activeImpactFxViews: Map<string, ImpactFxView> = new Map();
    private boardRevision: number = 0;
    private impactFxSerial: number = 0;

    onLoad() {
        // 確保此節點本身也在 DEFAULT layer，Camera 才照得到
        this.node.layer = Layers.Enum.DEFAULT;
        this.flashQuadMesh = utils.MeshUtils.createMesh(primitives.quad()); // 建立一次後重用
        this.loadBoardEffect();
        this.initMaterials();
        this.createBoard('initial-load');
    }

    onDestroy(): void {
        this.clearActiveImpactFx('component-destroy');
        this.tileBuffFxViews.forEach((view) => {
            if (view.node?.isValid) {
                view.node.destroy();
            }
        });
        this.tileBuffFxViews.clear();
        this.cellNodes.clear();
        this.boardRoot = null;
    }

    public rebuildBoard(): void {
        if (!this.defaultFillMaterial) {
            this.initMaterials();
        }
        this.createBoard('manual-rebuild');
    }

    private loadBoardEffect(): void {
        if (this.boardEffectAsset || this.isBoardEffectLoading) {
            return;
        }

        this.isBoardEffectLoading = true;
        resources.load('effects/board-jelly', EffectAsset, (err, effectAsset) => {
            this.isBoardEffectLoading = false;
            if (!this.node?.isValid) {
                return;
            }
            if (err || !effectAsset) {
                UCUFLogger.warn(LogCategory.LIFECYCLE, '[BoardRenderer] 棋盤玻璃 Shader 載入失敗，暫用 fallback 材質', err?.message ?? err);
                return;
            }

            this.boardEffectAsset = effectAsset;
            this.initMaterials();
            this.createBoard('effect-asset-ready');
            UCUFLogger.info(LogCategory.LIFECYCLE, '[BoardRenderer] 棋盤玻璃 Shader 載入成功 style=shader-jelly-v4');
        });
    }

    private tryEnsureFloodRippleMaterial(battleTactic: BattleTactic): void {
        if (battleTactic !== BattleTactic.FloodAttack) {
            return;
        }
        if (this.floodRippleFillMaterial || this.isFloodRippleLoading || this.floodRippleLoadRequested) {
            return;
        }

        this.floodRippleLoadRequested = true;
        this.isFloodRippleLoading = true;
        this.loadFloodRippleMaterial()
            .then((material) => {
                if (!this.node?.isValid || !material) {
                    this.floodRippleLoadRequested = false;
                    return;
                }
                this.floodRippleFillMaterial = material;
                UCUFLogger.info(LogCategory.LIFECYCLE, '[BoardRenderer] Flood ripple material loaded (water-ripple.effect)');
            })
            .catch((error) => {
                this.floodRippleLoadRequested = false;
                UCUFLogger.warn(LogCategory.LIFECYCLE, '[BoardRenderer] Flood ripple material load failed, fallback to static fill.', error);
            })
            .finally(() => {
                this.isFloodRippleLoading = false;
            });
    }

    private async loadFloodRippleMaterial(): Promise<Material | null> {
        const vfxBundle = await this.ensureVfxCoreBundle();
        if (!vfxBundle) {
            return null;
        }

        const [effectAsset, mainTex, noiseTex, lineTex] = await Promise.all([
            this.loadBundleEffect(vfxBundle, 'shaders/water-ripple'),
            this.loadResourceTexture('textures/bg_water'),
            this.loadBundleTexture(vfxBundle, 'shaders/tex_noise_perlin'),
            this.loadBundleTexture(vfxBundle, 'shaders/tex_shader_line'),
        ]);
        if (!effectAsset) {
            return null;
        }

        const resolvedMain = mainTex ?? lineTex ?? noiseTex;
        if (!resolvedMain) {
            return null;
        }

        const resolvedNoise = noiseTex ?? resolvedMain;
        const resolvedFlow = noiseTex ?? lineTex ?? resolvedMain;
        const resolvedFoam = lineTex ?? noiseTex ?? resolvedMain;

        const material = new Material();
        material.initialize({ effectAsset, technique: 0 });
        material.setProperty('mainTexture', resolvedMain);
        material.setProperty('noiseTexture', resolvedNoise);
        material.setProperty('flowMap', resolvedFlow);
        material.setProperty('foamMap', resolvedFoam);
        material.setProperty('mainColor', new Vec4(0.5, 0.85, 1.0, 0.84));
        material.setProperty('uvTiling', new Vec4(1.0, 1.0, 0.0, 0.0));
        material.setProperty('flowParams', new Vec4(0.2, 0.09, 4.5, 0.12));
        material.setProperty('rippleParams', new Vec4(1.3, 1.1, 0.55, 0.0));
        material.setProperty('worldFlowParams', new Vec4(0.11, 0.11, 0.92, 0.72));
        material.setProperty('riverDir', new Vec4(0.92, 0.38, 1.08, 0.82));
        material.setProperty('foamParams', new Vec4(0.56, 0.2, 2.2, 0.45));

        return material;
    }

    private tryEnsureLightningArcMaterial(battleTactic: BattleTactic): void {
        if (battleTactic !== BattleTactic.NightRaid) {
            return;
        }
        if (this.lightningArcFillMaterial || this.isLightningArcLoading || this.lightningArcLoadRequested) {
            return;
        }

        this.lightningArcLoadRequested = true;
        this.isLightningArcLoading = true;
        this.loadLightningArcMaterial()
            .then((material) => {
                if (!this.node?.isValid || !material) {
                    this.lightningArcLoadRequested = false;
                    return;
                }
                this.lightningArcFillMaterial = material;
                UCUFLogger.info(LogCategory.LIFECYCLE, '[BoardRenderer] Lightning arc material loaded (lightning-arc.effect)');
            })
            .catch((error) => {
                this.lightningArcLoadRequested = false;
                UCUFLogger.warn(LogCategory.LIFECYCLE, '[BoardRenderer] Lightning arc material load failed, fallback to camp fill.', error);
            })
            .finally(() => {
                this.isLightningArcLoading = false;
            });
    }

    private async loadLightningArcMaterial(): Promise<Material | null> {
        const vfxBundle = await this.ensureVfxCoreBundle();
        if (!vfxBundle) {
            return null;
        }

        const [effectAsset, lineTex, noiseTex] = await Promise.all([
            this.loadBundleEffect(vfxBundle, 'shaders/lightning-arc'),
            this.loadBundleTexture(vfxBundle, 'shaders/tex_shader_line'),
            this.loadBundleTexture(vfxBundle, 'shaders/tex_noise_perlin'),
        ]);
        if (!effectAsset || !lineTex) {
            return null;
        }

        const resolvedNoise = noiseTex ?? lineTex;
        const material = new Material();
        material.initialize({ effectAsset, technique: 0 });
        material.setProperty('mainTexture', lineTex);
        material.setProperty('noiseTexture', resolvedNoise);
        material.setProperty('arcColor', new Vec4(0.62, 0.86, 1.0, 0.9));
        material.setProperty('uvTiling', new Vec4(1.35, 1.35, 0.0, 0.0));
        material.setProperty('arcParams', new Vec4(0.26, 9.0, 0.1, 1.0));
        material.setProperty('pulseParams', new Vec4(1.8, 0.4, 0.45, 0.68));
        material.setProperty('worldParams', new Vec4(0.14, 0.14, 0.9, 0.75));
        return material;
    }

    private tryEnsurePoisonFogMaterial(battleTactic: BattleTactic): void {
        if (battleTactic !== BattleTactic.AmbushAttack) {
            return;
        }
        if (this.poisonFogFillMaterial || this.isPoisonFogLoading || this.poisonFogLoadRequested) {
            return;
        }

        this.poisonFogLoadRequested = true;
        this.isPoisonFogLoading = true;
        this.loadPoisonFogMaterial()
            .then((material) => {
                if (!this.node?.isValid || !material) {
                    this.poisonFogLoadRequested = false;
                    return;
                }
                this.poisonFogFillMaterial = material;
                UCUFLogger.info(LogCategory.LIFECYCLE, '[BoardRenderer] Poison fog material loaded (poison-fog.effect)');
            })
            .catch((error) => {
                this.poisonFogLoadRequested = false;
                UCUFLogger.warn(LogCategory.LIFECYCLE, '[BoardRenderer] Poison fog material load failed, fallback to forest fill.', error);
            })
            .finally(() => {
                this.isPoisonFogLoading = false;
            });
    }

    private async loadPoisonFogMaterial(): Promise<Material | null> {
        const vfxBundle = await this.ensureVfxCoreBundle();
        if (!vfxBundle) {
            return null;
        }

        const [effectAsset, smokeTex, noiseTex, smokeCloudTex] = await Promise.all([
            this.loadBundleEffect(vfxBundle, 'shaders/poison-fog'),
            this.loadBundleTexture(vfxBundle, 'textures/smoke/tex_smoke_aura'),
            this.loadBundleTexture(vfxBundle, 'shaders/tex_noise_perlin'),
            this.loadBundleTexture(vfxBundle, 'textures/smoke/mep_smoke_cloud'),
        ]);
        if (!effectAsset) {
            return null;
        }

        const resolvedMain = smokeTex ?? smokeCloudTex ?? noiseTex;
        if (!resolvedMain) {
            return null;
        }

        const resolvedNoise = noiseTex ?? smokeCloudTex ?? resolvedMain;
        const material = new Material();
        material.initialize({ effectAsset, technique: 0 });
        material.setProperty('mainTexture', resolvedMain);
        material.setProperty('noiseTexture', resolvedNoise);
        material.setProperty('fogColor', new Vec4(0.44, 0.82, 0.54, 0.86));
        material.setProperty('uvTiling', new Vec4(1.18, 1.18, 0.0, 0.0));
        material.setProperty('flowParams', new Vec4(0.085, 0.035, 2.6, 0.72));
        material.setProperty('densityParams', new Vec4(0.4, 0.8, 0.56, 0.18));
        material.setProperty('pulseParams', new Vec4(0.58, 0.38, 0.24, 0.68));
        material.setProperty('worldParams', new Vec4(0.12, 0.12, 0.9, 0.82));
        return material;
    }

    private tryEnsureWindVortexMaterial(battleTactic: BattleTactic): void {
        if (battleTactic !== BattleTactic.RockSlide) {
            return;
        }
        if (this.windVortexFillMaterial || this.isWindVortexLoading || this.windVortexLoadRequested) {
            return;
        }

        this.windVortexLoadRequested = true;
        this.isWindVortexLoading = true;
        this.loadWindVortexMaterial()
            .then((material) => {
                if (!this.node?.isValid || !material) {
                    this.windVortexLoadRequested = false;
                    return;
                }
                this.windVortexFillMaterial = material;
                UCUFLogger.info(LogCategory.LIFECYCLE, '[BoardRenderer] Wind vortex material loaded (wind-vortex.effect)');
            })
            .catch((error) => {
                this.windVortexLoadRequested = false;
                UCUFLogger.warn(LogCategory.LIFECYCLE, '[BoardRenderer] Wind vortex material load failed, fallback to rock fill.', error);
            })
            .finally(() => {
                this.isWindVortexLoading = false;
            });
    }

    private async loadWindVortexMaterial(): Promise<Material | null> {
        const vfxBundle = await this.ensureVfxCoreBundle();
        if (!vfxBundle) {
            return null;
        }

        const [effectAsset, smokeTex, splitTex, noiseTex] = await Promise.all([
            this.loadBundleEffect(vfxBundle, 'shaders/wind-vortex'),
            this.loadBundleTexture(vfxBundle, 'textures/smoke/tex_smoke_stretched'),
            this.loadBundleTexture(vfxBundle, 'textures/trails/tex_trail_split'),
            this.loadBundleTexture(vfxBundle, 'shaders/tex_noise_perlin'),
        ]);
        if (!effectAsset) {
            return null;
        }

        const resolvedMain = smokeTex ?? splitTex ?? noiseTex;
        if (!resolvedMain) {
            return null;
        }

        const resolvedNoise = noiseTex ?? splitTex ?? resolvedMain;
        const material = new Material();
        material.initialize({ effectAsset, technique: 0 });
        material.setProperty('mainTexture', resolvedMain);
        material.setProperty('noiseTexture', resolvedNoise);
        material.setProperty('windColor', new Vec4(0.82, 0.9, 0.96, 0.84));
        material.setProperty('uvTiling', new Vec4(1.36, 1.36, 0.0, 0.0));
        material.setProperty('swirlParams', new Vec4(0.16, 0.72, 2.4, 0.28));
        material.setProperty('streakParams', new Vec4(3.8, 0.44, 0.24, 0.66));
        material.setProperty('pulseParams', new Vec4(0.9, 0.35, 0.42, 0.7));
        material.setProperty('worldParams', new Vec4(0.11, 0.11, 0.9, 0.82));
        return material;
    }

    private tryEnsureIceCrystalMaterial(battleTactic: BattleTactic): void {
        if (battleTactic !== BattleTactic.FloodAttack) {
            return;
        }
        if (this.iceCrystalFillMaterial || this.isIceCrystalLoading || this.iceCrystalLoadRequested) {
            return;
        }

        this.iceCrystalLoadRequested = true;
        this.isIceCrystalLoading = true;
        this.loadIceCrystalMaterial()
            .then((material) => {
                if (!this.node?.isValid || !material) {
                    this.iceCrystalLoadRequested = false;
                    return;
                }
                this.iceCrystalFillMaterial = material;
                UCUFLogger.info(LogCategory.LIFECYCLE, '[BoardRenderer] Ice crystal material loaded (ice-crystal.effect)');
            })
            .catch((error) => {
                this.iceCrystalLoadRequested = false;
                UCUFLogger.warn(LogCategory.LIFECYCLE, '[BoardRenderer] Ice crystal material load failed, fallback to water fill.', error);
            })
            .finally(() => {
                this.isIceCrystalLoading = false;
            });
    }

    private async loadIceCrystalMaterial(): Promise<Material | null> {
        const vfxBundle = await this.ensureVfxCoreBundle();
        if (!vfxBundle) {
            return null;
        }

        const [effectAsset, crystalTex, circleTex, noiseTex] = await Promise.all([
            this.loadBundleEffect(vfxBundle, 'shaders/ice-crystal'),
            this.loadBundleTexture(vfxBundle, 'textures/shapes/mep_shape_crystal'),
            this.loadBundleTexture(vfxBundle, 'shaders/tex_shader_circle'),
            this.loadBundleTexture(vfxBundle, 'shaders/tex_noise_perlin'),
        ]);
        if (!effectAsset) {
            return null;
        }

        const resolvedMain = crystalTex ?? circleTex ?? noiseTex;
        if (!resolvedMain) {
            return null;
        }

        const resolvedNoise = noiseTex ?? circleTex ?? resolvedMain;
        const material = new Material();
        material.initialize({ effectAsset, technique: 0 });
        material.setProperty('mainTexture', resolvedMain);
        material.setProperty('noiseTexture', resolvedNoise);
        material.setProperty('crystalColor', new Vec4(0.78, 0.92, 1.0, 0.9));
        material.setProperty('uvTiling', new Vec4(1.18, 1.18, 0.0, 0.0));
        material.setProperty('flowParams', new Vec4(0.06, 0.028, 2.1, 0.64));
        material.setProperty('facetParams', new Vec4(1.55, 0.32, 0.18, 0.72));
        material.setProperty('pulseParams', new Vec4(0.86, 0.42, 0.34, 0.74));
        material.setProperty('worldParams', new Vec4(0.12, 0.12, 0.9, 0.82));
        return material;
    }

    private ensureVfxCoreBundle(): Promise<AssetManager.Bundle | null> {
        const existing = assetManager.getBundle('vfx_core');
        if (existing) {
            return Promise.resolve(existing);
        }

        return new Promise((resolve) => {
            assetManager.loadBundle('vfx_core', (err, bundle) => {
                if (err || !bundle) {
                    resolve(null);
                    return;
                }
                resolve(bundle);
            });
        });
    }

    private loadBundleEffect(bundle: AssetManager.Bundle, effectPath: string): Promise<EffectAsset | null> {
        return new Promise((resolve) => {
            bundle.load(effectPath, EffectAsset, (err, effectAsset) => {
                if (err || !effectAsset) {
                    resolve(null);
                    return;
                }
                resolve(effectAsset);
            });
        });
    }

    private loadBundleTexture(bundle: AssetManager.Bundle, texturePath: string): Promise<Texture2D | null> {
        return new Promise((resolve) => {
            bundle.load(`${texturePath}/texture`, Texture2D, (err, texture) => {
                if (!err && texture) {
                    resolve(texture);
                    return;
                }
                bundle.load(texturePath, ImageAsset, (fallbackErr, imageAsset) => {
                    if (fallbackErr || !imageAsset) {
                        resolve(null);
                        return;
                    }
                    const fallbackTexture = new Texture2D();
                    fallbackTexture.image = imageAsset;
                    resolve(fallbackTexture);
                });
            });
        });
    }

    private loadResourceTexture(texturePath: string): Promise<Texture2D | null> {
        return new Promise((resolve) => {
            resources.load(`${texturePath}/texture`, Texture2D, (err, texture) => {
                if (!err && texture) {
                    resolve(texture);
                    return;
                }
                resources.load(texturePath, ImageAsset, (fallbackErr, imageAsset) => {
                    if (fallbackErr || !imageAsset) {
                        resolve(null);
                        return;
                    }
                    const fallbackTexture = new Texture2D();
                    fallbackTexture.image = imageAsset;
                    resolve(fallbackTexture);
                });
            });
        });
    }

    private initMaterials() {
        // 預設格子：可見但低對比的基底；狀態效果由 overlay 材質另行疊加。
        this.defaultFillMaterial = this.createCellMaterial(
            new Color(62, 74, 86, 28),
            new Color(112, 130, 144, 92),
            new Color(188, 214, 226, 54),
            new Vec4(0.08, 0.14, 0.18, 0.56)
        );
        this.defaultBorderMaterial = this.defaultFillMaterial;
        this.defaultBorderMidMaterial = this.defaultFillMaterial;
        this.defaultBorderInnerMaterial = this.defaultFillMaterial;

        this.floodBaseFillMaterial = this.createCellMaterial(
            new Color(70, 108, 148, 34),
            new Color(132, 190, 238, 104),
            new Color(216, 242, 255, 72),
            new Vec4(0.1, 0.16, 0.22, 0.62)
        );

        this.playerOccupiedFillMaterial = this.createCellMaterial(
            new Color(132, 242, 180, 60),
            new Color(150, 248, 190, 120),
            new Color(210, 255, 226, 80),
            new Vec4(0.08, 0.145, 0.17, 0.62)
        );
        this.playerOccupiedBorderMaterial = this.playerOccupiedFillMaterial;
        this.playerOccupiedBorderMidMaterial = this.playerOccupiedFillMaterial;
        this.playerOccupiedBorderInnerMaterial = this.playerOccupiedFillMaterial;

        this.enemyOccupiedFillMaterial = this.createCellMaterial(
            new Color(242, 180, 180, 60),
            new Color(248, 188, 188, 120),
            new Color(255, 230, 230, 80),
            new Vec4(0.08, 0.145, 0.17, 0.62)
        );
        this.enemyOccupiedBorderMaterial = this.enemyOccupiedFillMaterial;
        this.enemyOccupiedBorderMidMaterial = this.enemyOccupiedFillMaterial;
        this.enemyOccupiedBorderInnerMaterial = this.enemyOccupiedFillMaterial;

        this.playerDeployHintFillMaterial = this.createCellMaterial(
            new Color(140, 246, 170, 14),
            new Color(160, 252, 184, 110),
            new Color(210, 255, 222, 78),
            new Vec4(0.095, 0.16, 0.19, 0.62)
        );
        this.playerDeployHintBorderMaterial = this.playerDeployHintFillMaterial;
        this.playerDeployHintBorderMidMaterial = this.playerDeployHintFillMaterial;
        this.playerDeployHintBorderInnerMaterial = this.playerDeployHintFillMaterial;

        this.enemyDeployHintFillMaterial = this.createCellMaterial(
            new Color(244, 154, 154, 7),
            new Color(252, 166, 166, 58),
            new Color(255, 228, 228, 46),
            new Vec4(0.085, 0.15, 0.175, 0.62)
        );
        this.enemyDeployHintBorderMaterial = this.enemyDeployHintFillMaterial;
        this.enemyDeployHintBorderMidMaterial = this.enemyDeployHintFillMaterial;
        this.enemyDeployHintBorderInnerMaterial = this.enemyDeployHintFillMaterial;

        this.skillPreviewFillMaterial = this.createCellMaterial(
            new Color(245, 212, 98, 36),
            new Color(255, 225, 135, 140),
            new Color(255, 246, 202, 110),
            new Vec4(0.11, 0.18, 0.22, 0.68)
        );

        this.sceneEffectFireFillMaterial = this.createCellMaterial(
            new Color(255, 112, 72, 42),
            new Color(255, 144, 88, 150),
            new Color(255, 214, 182, 110),
            new Vec4(0.09, 0.16, 0.2, 0.66)
        );
        this.sceneEffectWaterFillMaterial = this.createCellMaterial(
            new Color(72, 168, 255, 36),
            new Color(112, 196, 255, 138),
            new Color(212, 238, 255, 96),
            new Vec4(0.12, 0.18, 0.24, 0.7)
        );
        this.sceneEffectRockFillMaterial = this.createCellMaterial(
            new Color(150, 140, 126, 36),
            new Color(188, 176, 160, 120),
            new Color(232, 224, 214, 82),
            new Vec4(0.08, 0.14, 0.17, 0.6)
        );
        this.sceneEffectCampFillMaterial = this.createCellMaterial(
            new Color(220, 168, 84, 34),
            new Color(255, 208, 128, 118),
            new Color(255, 236, 186, 90),
            new Vec4(0.08, 0.14, 0.17, 0.58)
        );
        this.sceneEffectForestFillMaterial = this.createCellMaterial(
            new Color(68, 126, 82, 38),
            new Color(112, 176, 118, 124),
            new Color(188, 238, 198, 74),
            new Vec4(0.08, 0.14, 0.17, 0.6)
        );
    }

    private createCellMaterial(fillColor: Color, edgeColor: Color, highlightColor: Color, jellyParams: Vec4): Material {
        const material = new Material();

        if (this.boardEffectAsset) {
            material.initialize({
                effectAsset: this.boardEffectAsset,
                states: {
                    depthStencilState: { depthTest: true, depthWrite: false },
                    rasterizerState: { cullMode: gfx.CullMode.NONE }
                }
            });
            material.setProperty('fillColor', fillColor);
            material.setProperty('edgeColor', edgeColor);
            material.setProperty('highlightColor', highlightColor);
            material.setProperty('jellyParams', jellyParams);
            return material;
        }

        material.initialize({
            effectName: 'builtin-unlit',
            states: {
                blendState: { targets: [{ blend: true }] },
                depthStencilState: { depthTest: true, depthWrite: false },
                rasterizerState: { cullMode: gfx.CullMode.NONE }
            }
        });
        material.setProperty('mainColor', edgeColor);
        return material;
    }

    private applyCellStyle(cellView: CellView, fillMaterial: Material | null, borderMaterial: Material | null): void {
        if (cellView.fillRenderer) {
            cellView.fillRenderer.enabled = true;
            const activeMaterial = fillMaterial ?? borderMaterial ?? this.defaultFillMaterial;
            if (activeMaterial) {
                cellView.fillRenderer.setSharedMaterial(activeMaterial, 0);
            }
        }
    }

    private applyCellOverlayStyle(cellView: CellView, overlayMaterial: Material | null): void {
        if (!cellView.overlayRenderer) {
            return;
        }

        if (!overlayMaterial) {
            cellView.overlayRenderer.enabled = false;
            return;
        }

        cellView.overlayRenderer.enabled = true;
        cellView.overlayRenderer.setSharedMaterial(overlayMaterial, 0);
    }

    public setDeployHintFaction(faction: Faction | null): void {
        this.deployHintFaction = faction;
    }

    public clearDeployHint(): void {
        this.deployHintFaction = null;
    }

    public setSkillPreviewCells(cells: Array<{ lane: number; depth: number }>): void {
        this.skillPreviewKeys.clear();
        cells.forEach((cell) => {
            this.skillPreviewKeys.add(`${cell.lane},${cell.depth}`);
        });
    }

    public clearSkillPreview(): void {
        this.skillPreviewKeys.clear();
    }

    private resolveCellBaseMaterial(baseStyle: BattleSceneBaseStyle): Material | null {
        if (baseStyle === 'flood-river') {
            return this.floodRippleFillMaterial ?? this.floodBaseFillMaterial ?? this.defaultFillMaterial;
        }

        return this.defaultFillMaterial;
    }

    private createBoard(reason: string) {
        this.boardRevision += 1;
        this.clearActiveImpactFx(`rebuild:${reason}:r${this.boardRevision}`);
        this.tileBuffFxViews.forEach((view) => {
            if (view.node?.isValid) {
                view.node.destroy();
            }
        });
        this.tileBuffFxViews.clear();
        this.cellNodes.clear(); // 清除舊引用，避免記錄已錄destroy的節點

        if (this.boardRoot?.isValid) {
            this.boardRoot.destroy();
        }
        this.boardRoot = null;

        this.boardRoot = new Node("BoardRoot");
        this.boardRoot.layer = Layers.Enum.DEFAULT;
        this.node.addChild(this.boardRoot);
        this.boardRoot.setPosition(new Vec3(this.boardOffsetX, 0, this.boardOffsetZ));
        this.boardRoot.setRotationFromEuler(new Vec3(0, this.boardYaw, 0));

        // 中心點偏移計算，讓整個棋盤置中
        const offsetX = (this.cols - 1) * (this.cellSize + this.cellGap) / 2;
        const offsetZ = (this.rows - 1) * (this.cellSize + this.cellGap) / 2;

        const quadMesh = utils.MeshUtils.createMesh(primitives.quad());
        const fillScale = Math.max(0.01, this.cellSize * 0.98);

        for (let x = 0; x < this.cols; x++) {
            for (let z = 0; z < this.rows; z++) {
            const cellNode = new Node(`Cell_${x}_${z}`);
                
                // 設定 3D 位置：X 為路徑 (lanes)，Z 為深度 (rows)。Y 保持 0 為地面
                const posX = x * (this.cellSize + this.cellGap) - offsetX;
                const posZ = z * (this.cellSize + this.cellGap) - offsetZ;
                cellNode.setPosition(new Vec3(posX, 0, posZ));
                
                // 網格平面的 quad 預設是朝上 (XY平面), 要在 3D 地面上需要旋轉向 X 軸 -90 度
                // 注意：縮放後再旋轉可以保持比例
                cellNode.setRotationFromEuler(new Vec3(-90, 0, 0));

                // DEFAULT layer 必須明確設定：UI Camera 照不到 DEFAULT，3D Camera 照得到
                cellNode.layer = Layers.Enum.DEFAULT;

                const fillNode = new Node('Fill');
                fillNode.layer = Layers.Enum.DEFAULT;
                fillNode.setPosition(new Vec3(0, 0, 0.001));
                fillNode.setScale(new Vec3(fillScale, fillScale, 1));
                const fillRenderer = fillNode.addComponent(MeshRenderer);
                fillRenderer.mesh = quadMesh;
                if (this.defaultFillMaterial) {
                    fillRenderer.setSharedMaterial(this.defaultFillMaterial, 0);
                }
                fillRenderer.enabled = true;
                cellNode.addChild(fillNode);

                const overlayNode = new Node('Overlay');
                overlayNode.layer = Layers.Enum.DEFAULT;
                overlayNode.setPosition(new Vec3(0, 0, 0.002));
                overlayNode.setScale(new Vec3(fillScale, fillScale, 1));
                const overlayRenderer = overlayNode.addComponent(MeshRenderer);
                overlayRenderer.mesh = quadMesh;
                overlayRenderer.enabled = false;
                cellNode.addChild(overlayNode);

                this.boardRoot.addChild(cellNode);
                const key = `${x},${z}`;
                this.cellNodes.set(key, {
                    root: cellNode,
                    fillRenderer,
                    overlayRenderer,
                    borderEdgeRenderers: [],
                    borderMidRenderers: [],
                    borderInnerRenderers: [],
                });
            }
        }

        UCUFLogger.info(
            LogCategory.LIFECYCLE,
            `[BoardRenderer] 棋盤建立完成 size=${this.cols}x${this.rows} cell=${this.cellSize.toFixed(2)} style=shader-jelly-v4 effectLoaded=${this.boardEffectAsset ? 1 : 0} reason=${reason} revision=${this.boardRevision}`,
        );
    }

    private clearActiveImpactFx(reason: string): void {
        if (this.activeImpactFxViews.size > 0) {
            UCUFLogger.debug(
                LogCategory.LIFECYCLE,
                `[BoardRenderer] clearActiveImpactFx reason=${reason} count=${this.activeImpactFxViews.size} revision=${this.boardRevision}`,
            );
        }

        this.activeImpactFxViews.forEach((view) => {
            try {
                view.tween.stop();
            } catch {
                // Tween 在停止或完成邊界再 stop 可能拋例外；此處只需確保 cleanup 繼續。
            }
            if (view.node?.isValid) {
                view.node.destroy();
            }
        });
        this.activeImpactFxViews.clear();
    }

    private finishImpactFx(id: string): void {
        const view = this.activeImpactFxViews.get(id);
        if (!view) {
            return;
        }

        this.activeImpactFxViews.delete(id);
        if (view.node?.isValid) {
            view.node.destroy();
        }
    }

    private failImpactFx(id: string, reason: string, error?: unknown): void {
        const view = this.activeImpactFxViews.get(id);
        if (!view) {
            return;
        }

        UCUFLogger.error(
            LogCategory.LIFECYCLE,
            `[BoardRenderer] Impact FX lifecycle 異常 id=${id} lane=${view.lane} depth=${view.depth} fxRevision=${view.boardRevision} currentRevision=${this.boardRevision} reason=${reason}`,
            error ?? '',
        );

        try {
            view.tween.stop();
        } catch {
            // cleanup path
        }
        this.finishImpactFx(id);
    }

    public getBoardMetrics(): { width: number; depth: number; center: Vec3 } {
        const width = this.cols * this.cellSize + Math.max(0, this.cols - 1) * this.cellGap;
        const depth = this.rows * this.cellSize + Math.max(0, this.rows - 1) * this.cellGap;
        const center = (this.boardRoot?.worldPosition ?? this.node.worldPosition).clone();
        return { width, depth, center };
    }

    public getCellWorldPosition(lane: number, depth: number, yOffset = 0): Vec3 {
        const cellNode = this.cellNodes.get(`${lane},${depth}`);
        // 雙重 null guard：cellNode 可能未找到，root 節點可能已被銷毀
        if (!cellNode || !cellNode.root || !cellNode.root.isValid) {
            if (cellNode && (!cellNode.root || !cellNode.root.isValid)) {
                UCUFLogger.warn(LogCategory.LIFECYCLE, `[BoardRenderer] getCellWorldPosition: 格 (${lane},${depth}) 的 root 節點無效或已銷毀`);
            }
            return new Vec3(this.node.worldPosition.x, this.node.worldPosition.y + yOffset, this.node.worldPosition.z);
        }
        const base = cellNode.root.worldPosition;
        return new Vec3(base.x, base.y + yOffset, base.z);
    }

    public getCellFromWorldPos(pos: Vec3): { lane: number; depth: number } | null {
        // 使用 totalSize（格子+縫隙）作為判定寬度，避免落在縫隙漏偵測
        const totalSize = this.cellSize + this.cellGap;
        let best: { key: string; dist: number } | null = null;
        for (const [key, cellView] of this.cellNodes.entries()) {
            // null guard：根節點可能在場景切換時被銷毀
            if (!cellView?.root || !cellView.root.isValid) {
                UCUFLogger.warn(LogCategory.LIFECYCLE, `[BoardRenderer] getCellFromWorldPos: 格 ${key} 的 root 節點無效，跳過`);
                continue;
            }
            const dx = Math.abs(cellView.root.worldPosition.x - pos.x);
            const dz = Math.abs(cellView.root.worldPosition.z - pos.z);
            if (dx <= totalSize * 0.55 && dz <= totalSize * 0.55) {
                const dist = dx + dz;
                if (!best || dist < best.dist) best = { key, dist };
            }
        }
        if (!best) {
            return null;
        }
        const parts = best.key.split(',');
        return { lane: parseInt(parts[0], 10), depth: parseInt(parts[1], 10) };
    }

    public playCellImpact(lane: number, depth: number, tint = new Color(255, 220, 140, 200)): void {
        if (!this.boardRoot?.isValid) {
            UCUFLogger.error(LogCategory.LIFECYCLE, `[BoardRenderer] playCellImpact: boardRoot 無效 lane=${lane} depth=${depth} revision=${this.boardRevision}`);
            return;
        }

        const cellNode = this.cellNodes.get(`${lane},${depth}`);
        if (!cellNode) {
            UCUFLogger.error(LogCategory.LIFECYCLE, `[BoardRenderer] playCellImpact: 找不到格資料 lane=${lane} depth=${depth} revision=${this.boardRevision}`);
            return;
        }
        // null guard：root 節點可能已被銷毀（例如棋盤重建時）
        if (!cellNode.root || !cellNode.root.isValid) {
            UCUFLogger.error(LogCategory.LIFECYCLE, `[BoardRenderer] playCellImpact: 格 (${lane},${depth}) 的 root 節點無效，revision=${this.boardRevision}`);
            return;
        }

        const flashNode = new Node(`Impact_${lane}_${depth}`);
        flashNode.layer = Layers.Enum.DEFAULT;
        flashNode.setPosition(new Vec3(cellNode.root.position.x, 0.035, cellNode.root.position.z));
        flashNode.setRotationFromEuler(new Vec3(-90, 0, 0));
        this.boardRoot.addChild(flashNode);

        const flashMaterial = new Material();
        flashMaterial.initialize({
            effectName: 'builtin-unlit',
            states: {
                blendState: { targets: [{ blend: true }] },
                depthStencilState: { depthTest: true, depthWrite: false },
                rasterizerState: { cullMode: gfx.CullMode.NONE }
            }
        });

        const mr = flashNode.addComponent(MeshRenderer);
        mr.mesh = this.flashQuadMesh;  // 重用已建立的 quad mesh
        mr.setSharedMaterial(flashMaterial, 0);
        const impactId = `${lane},${depth}#${++this.impactFxSerial}`;
        const anim = { alpha: tint.a, scale: 0.72 };
        flashNode.setScale(new Vec3(this.cellSize * anim.scale, this.cellSize * anim.scale, 1));

        const impactTween = tween(anim)
            .to(0.22, { alpha: 0, scale: 1.35 }, {
                onUpdate: () => {
                    try {
                        const view = this.activeImpactFxViews.get(impactId);
                        if (!view) {
                            return;
                        }
                        if (view.boardRevision !== this.boardRevision) {
                            this.failImpactFx(impactId, 'board revision changed during onUpdate');
                            return;
                        }
                        if (!flashNode.isValid || !this.boardRoot?.isValid) {
                            this.failImpactFx(impactId, 'flash node invalid during onUpdate');
                            return;
                        }
                        flashMaterial.setProperty('mainColor', new Color(tint.r, tint.g, tint.b, anim.alpha));
                        flashNode.setScale(new Vec3(this.cellSize * anim.scale, this.cellSize * anim.scale, 1));
                    } catch (error) {
                        this.failImpactFx(impactId, 'onUpdate threw', error);
                        return;
                    }
                }
            })
            .call(() => {
                this.finishImpactFx(impactId);
            })
            .start();

        this.activeImpactFxViews.set(impactId, {
            id: impactId,
            lane,
            depth,
            boardRevision: this.boardRevision,
            node: flashNode,
            material: flashMaterial,
            tween: impactTween,
        });
    }

    public playBuffConsumeBurst(lane: number, depth: number): void {
        this.playCellImpact(lane, depth, new Color(110, 255, 140, 220));
    }

    public playSceneGambitPulse(state: BattleState, battleTactic: BattleTactic): void {
        const sceneRule = resolveBattleSceneDisplayRule(battleTactic);
        const pulseColor = sceneRule.resolvePulseColor();
        const targetCells = sceneRule.resolvePulseCells(state);

        for (const cell of targetCells) {
            this.playCellImpact(cell.lane, cell.depth, pulseColor);
        }
    }

    /**
     * 接收 BattleState 快照並更新畫面
     * 不負責邏輯判定，僅作為 View 層負責渲染。
     */
    public renderState(state: BattleState) {
        this.tryEnsureFloodRippleMaterial(state.battleTactic);
        this.tryEnsureLightningArcMaterial(state.battleTactic);
        this.tryEnsurePoisonFogMaterial(state.battleTactic);
        this.tryEnsureWindVortexMaterial(state.battleTactic);
        this.tryEnsureIceCrystalMaterial(state.battleTactic);

        // 先將所有格子重置為預設基底與空 overlay；狀態只疊在 overlay，不改變格子是否存在。
        const sceneRule = resolveBattleSceneDisplayRule(state.battleTactic);
        state.cells.forEach((cell) => {
            const cellView = this.cellNodes.get(`${cell.lane},${cell.depth}`);
            if (!cellView) {
                return;
            }

            const baseMaterial = this.resolveCellBaseMaterial(sceneRule.resolveCellBaseStyle(cell.terrain));
            this.applyCellStyle(cellView, baseMaterial, baseMaterial);
            this.applyCellOverlayStyle(cellView, null);
        });

        // 取出棋盤上有單位的格子並設置為高亮
        // state 的小兵
        state.units.forEach(unit => {
            if (unit.currentHp > 0) {
                const key = `${unit.lane},${unit.depth}`;
                const cellNode = this.cellNodes.get(key);
                if (cellNode) {
                    if (unit.faction === Faction.Player) {
                        // this.applyCellStyle(cellNode, this.playerOccupiedFillMaterial, this.playerOccupiedBorderMaterial);
                    } else {
                        // this.applyCellStyle(cellNode, this.enemyOccupiedFillMaterial, this.enemyOccupiedBorderMaterial);
                    }
                }
            }
        });

        state.tileEffects.forEach((effect) => {
            const cellNode = this.cellNodes.get(`${effect.lane},${effect.depth}`);
            if (!cellNode) return;
            const overlayState = sceneRule.resolveOverlayState(effect.state);
            if (!overlayState) return;
            const overlayMaterial = this.resolveSceneEffectMaterial(overlayState);
            if (!overlayMaterial) return;
            this.applyCellOverlayStyle(cellNode, overlayMaterial);
        });

        // 玩家部署提示 (只在玩家回合顯示)
        if (this.deployHintFaction === Faction.Player) {
            const deployDepth = 0;
            for (let lane = 0; lane < GAME_CONFIG.GRID_LANES; lane++) {
                const cell = state.getCell(lane, deployDepth);
                if (!cell || cell.occupantId) continue;

                const cellNode = this.cellNodes.get(`${lane},${deployDepth}`);
                if (!cellNode) continue;
                this.applyCellOverlayStyle(cellNode, this.playerDeployHintFillMaterial);
            }
        }

        this.skillPreviewKeys.forEach((key) => {
            const cellNode = this.cellNodes.get(key);
            if (!cellNode) return;
            this.applyCellOverlayStyle(cellNode, this.skillPreviewFillMaterial);
        });

        this.syncTileBuffFx(state);
    }

    private resolveSceneEffectMaterial(state: string): Material | null {
        switch (state) {
            case 'hazard-fire':
                return this.sceneEffectFireFillMaterial;
            case 'river-current':
                return this.iceCrystalFillMaterial ?? this.sceneEffectWaterFillMaterial;
            case 'hazard-rock':
                return this.windVortexFillMaterial ?? this.sceneEffectRockFillMaterial;
            case 'night-raid':
                return this.lightningArcFillMaterial ?? this.sceneEffectCampFillMaterial;
            case 'ambush-field':
                return this.poisonFogFillMaterial ?? this.sceneEffectForestFillMaterial;
            default:
                return null;
        }
    }

    private syncTileBuffFx(_state: BattleState): void {
        // 因需求變更，移除地板光暈特效，改由 UnitRenderer 的文字伸縮替代
        // 為了相容性保留空方法，確保呼叫正常
        return;
    }
}
