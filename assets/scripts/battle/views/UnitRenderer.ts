import {
  _decorator,
  Camera,
  Color,
  Component,
  gfx,
  Graphics,
  HorizontalTextAlignment,
  Label,
  Layers,
  DirectionalLight,
  Material,
  Mesh,
  MeshRenderer,
  Node,
  Prefab,
  SkinnedMeshRenderer,
  Texture2D,
  primitives,
  instantiate,
  assetManager,
  tween,
  Tween,
  UIOpacity,
  UITransform,
  Size,
  utils,
  Vec3,
  VerticalTextAlignment,
} from "cc";
import { Faction, GAME_CONFIG, TroopType } from "../../core/config/Constants";
import { GeneralUnit } from "../../core/models/GeneralUnit";
import { TroopUnit } from "../../core/models/TroopUnit";
import { BattleState } from "../models/BattleState";
import { BoardRenderer } from "./BoardRenderer";
import { BuffGainEffectPool } from "./effects/BuffGainEffectPool";
import { services } from "../../core/managers/ServiceLoader";
import { FloatTextType } from "../../core/systems/FloatTextSystem";
import {
  DEFAULT_ENEMY_HERO_ASSET_ID,
  DEFAULT_PLAYER_HERO_ASSET_ID,
  HERO_UNIT_ASSET_CATALOG,
  HeroUnitAssetEntry,
  TROOP_UNIT_ASSET_CATALOG,
  TroopUnitAssetEntry,
} from "../../core/config/UnitAssetCatalog";

const { ccclass, property } = _decorator;

interface UnitView {
  worldNode: Node;   // 世界空間根節點，負責移動 tween（Unity: Root Transform）
  visualNode: Node;  // 本地空間效果層，負責 bump / recoil / charge（Unity: Visual Child Transform）
  bodyNode: Node;
  ringNode?: Node;
  accentNode: Node;
  formationRoot: Node;
  labelNode: Node;
  attackLabel: Label;
  typeLabel: Label;
  hpLabel: Label;
  labelOpacity: UIOpacity;
  bottomNameLabel: Label | null;
  troopType: TroopType;
  usingTroopFormation: boolean;
}

interface UnitShapeProfile {
  bodyScale: Vec3;
  accentScale: Vec3;
  accentOffset: Vec3;
  accentRotation: Vec3;
}

interface GeneralView {
  worldNode: Node;
  bodyNode: Node;
  modelRoot: Node;
  labelNode: Node;
  attackLabel: Label;
  typeLabel: Label;
  hpLabel: Label;
  labelOpacity: UIOpacity;
  faction: Faction;
  usingHeroModel: boolean;
  heroLoading: boolean;
}

interface BadgeView {
  rootNode: Node;
  attackLabel: Label;
  typeLabel: Label;
  hpLabel: Label;
  opacity: UIOpacity;
  bottomNameLabel: Label | null;  // 下排兵種名稱（將軍無用）
}

interface TileBuffView {
  node: Node;
  label: Label;
}

@ccclass("UnitRenderer")
export class UnitRenderer extends Component {
  @property({ tooltip: "cube 單位高度" })
  public unitHeight = 0.72;

  @property({ tooltip: "cube 單位寬度" })
  public unitScale = 0.56;

  @property({ tooltip: "頭頂資訊距離單位的高度" })
  public labelHeight = 0.55;

  @property({ tooltip: "主將 cube 相對小兵尺寸倍率" })
  public generalScaleMultiplier = 1.5;

  private boardRenderer: BoardRenderer | null = null;
  private worldCamera: Camera | null = null;
  private canvasNode: Node | null = null;
  private worldRoot: Node | null = null;
  private uiRoot: Node | null = null;
  private cubeMesh: Mesh | null = null;
  private discMesh: Mesh | null = null;  // 圓形陰影 mesh，對照 Unity: blob shadow disc
  private ringMesh: Mesh | null = null;  // Faction Ring mesh
  private atkGainPool: BuffGainEffectPool | null = null;
  private atkLossPool: BuffGainEffectPool | null = null;
  private hpGainPool:  BuffGainEffectPool | null = null;
  private hpLossPool:  BuffGainEffectPool | null = null;
  private readonly unitViews = new Map<string, UnitView>();
  private readonly movingUnits = new Set<string>();
  private readonly dyingUnits = new Set<string>();
  private readonly uiProjectionBuffer = new Vec3();
  // lateUpdate 每幀重用的 Vec3 暫存，避免動態分配（對照 Unity: 快取 Vector3 工具變數）
  private readonly screenPosBuf = new Vec3();
  private readonly uiWorldPosBuf = new Vec3();
  private readonly generalViews = new Map<Faction, GeneralView>();
  private readonly tileBuffViews = new Map<string, TileBuffView>();
  private readonly troopPrefabLoads = new Map<TroopType, Promise<Prefab | null>>();
  private readonly heroPrefabLoads = new Map<string, Promise<Prefab | null>>();
  private latestState: BattleState | null = null;

  onLoad(): void {
    this.cubeMesh = utils.MeshUtils.createMesh(primitives.box());
    // 建立圓形碟狀 mesh，用於地面陰影（far smaller than box）
    this.discMesh = utils.MeshUtils.createMesh(primitives.cylinder(0.5, 0.5, 0.01, { radialSegments: 20 }));
    // 建立六邊形環當作外發光
    this.ringMesh = utils.MeshUtils.createMesh(primitives.torus(0.40, 0.03, { radialSegments: 8, tubularSegments: 6 }));
    this.node.layer = Layers.Enum.DEFAULT;
    this.ensureRoots();
    this.ensureSceneKeyLight();
  }

  public initialize(boardRenderer: BoardRenderer | null, worldCamera: Camera | null, canvasNode: Node | null): void {
    this.boardRenderer = boardRenderer;
    this.worldCamera = worldCamera;
    this.canvasNode = canvasNode;
    this.ensureRoots();
    this.ensureSceneKeyLight();
    // FloatTextSystem 共用 3D→UI 座標轉換逻輯，需在 ensureRoots() 後設定
    if (this.uiRoot && this.worldCamera && this.canvasNode) {
      services().floatText.setup(this.uiRoot, this.worldCamera, this.canvasNode);
    }
    // fire-and-forget: 特效 Pool 初始化是非同步（需載入資源），不阻塞主流程
    void this.setupAllEffectPools();
  }

  public renderState(state: BattleState): void {
    this.ensureRoots();
    this.latestState = state;

    const activeIds = new Set<string>();
    state.units.forEach(unit => {
      if (unit.currentHp <= 0) return;
      activeIds.add(unit.id);

      let view = this.unitViews.get(unit.id);
      if (!view) {
        view = this.createUnitView(unit);
        this.unitViews.set(unit.id, view);
      }

      this.updateUnitView(view, unit);
    });

    this.unitViews.forEach((view, unitId) => {
      if (!activeIds.has(unitId) && !this.dyingUnits.has(unitId)) {
        view.worldNode.destroy();
        view.labelNode.destroy();
        this.unitViews.delete(unitId);
      }
    });

    this.updateGeneralViews(state);
    this.syncTileBuffViews(state);
  }

  public async playDeploy(unit: TroopUnit | null): Promise<void> {
    if (!unit) return;

    let view = this.unitViews.get(unit.id);
    if (!view) {
      view = this.createUnitView(unit);
      this.unitViews.set(unit.id, view);
    }

    // 等待 formation prefab 載入：確保部署動畫使用正確尺寸（Vec3.ONE）與面向
    // createUnitView 已呼叫過 ensureTroopFormation，這裡直接等 prefab 並建立
    if (!view.usingTroopFormation && !this.isGeneralAvatarUnit(unit)) {
      const entry = TROOP_UNIT_ASSET_CATALOG[unit.type];
      if (entry) {
        const prefab = await this.loadTroopPrefab(unit.type, entry);
        if (prefab && view.worldNode.isValid && view.formationRoot.children.length === 0) {
          this.buildTroopFormation(view, prefab, unit, entry);
        }
      }
    }

    // 以正確狀態（formation 已就緒）更新視圖，取得最終尺寸與面向
    this.updateUnitView(view, unit);

    const targetScale = view.worldNode.scale.clone();
    view.worldNode.setScale(new Vec3(targetScale.x * 0.01, targetScale.y * 0.01, targetScale.z * 0.01));
    const pos = view.worldNode.position.clone();
    view.worldNode.setPosition(new Vec3(pos.x, pos.y - 0.45, pos.z));

    tween(view.worldNode)
      .to(0.22, { scale: targetScale, position: pos })
      .start();
  }

  public animateMove(unit: TroopUnit | null, fromLane: number, fromDepth: number): void {
    if (!unit) return;

    let view = this.unitViews.get(unit.id);
    if (!view) {
      view = this.createUnitView(unit);
      this.unitViews.set(unit.id, view);
    }

    this.updateUnitView(view, unit);
    const fromPos = this.boardRenderer?.getCellWorldPosition(fromLane, fromDepth, this.unitHeight * 0.5);
    const toPos = this.boardRenderer?.getCellWorldPosition(unit.lane, unit.depth, this.unitHeight * 0.5);
    if (!fromPos || !toPos) return;

    // 停止該節點上一切進行中的 tween，避免多回合快速推進時舊 tween 的 .call() 把單位定位到前一回合的目標格
    Tween.stopAllByTarget(view.worldNode);
    this.movingUnits.add(unit.id);
    view.worldNode.setWorldPosition(fromPos);
    tween(view.worldNode)
      .to(2.0, { worldPosition: toPos })
      .call(() => {
        this.movingUnits.delete(unit.id);
        view?.worldNode.setWorldPosition(toPos);
      })
      .start();
  }

  public playSwapAdvanceAnimation(
    unit: TroopUnit | null,
    swapWithUnitId: string,
    fromLane: number,
    fromDepth: number,
    duration: number,
    swapPassengerFromLane?: number,
    swapPassengerFromDepth?: number,
    swapPassengerToLane?: number,
    swapPassengerToDepth?: number,
  ): void {
    if (!unit) return;

    let moverView = this.unitViews.get(unit.id);
    if (!moverView) {
      moverView = this.createUnitView(unit);
      this.unitViews.set(unit.id, moverView);
      this.updateUnitView(moverView, unit);
    }

    const passengerView = this.unitViews.get(swapWithUnitId);
    const moverFrom = this.boardRenderer?.getCellWorldPosition(fromLane, fromDepth, this.unitHeight * 0.5);
    const moverTo = this.boardRenderer?.getCellWorldPosition(unit.lane, unit.depth, this.unitHeight * 0.5);
    const passengerUnit = this.findUnitById(swapWithUnitId);
    const passengerTo = (swapPassengerToLane !== undefined && swapPassengerToDepth !== undefined)
      ? this.boardRenderer?.getCellWorldPosition(swapPassengerToLane, swapPassengerToDepth, this.unitHeight * 0.5)
      : (passengerUnit ? this.boardRenderer?.getCellWorldPosition(passengerUnit.lane, passengerUnit.depth, this.unitHeight * 0.5) : null);
    const passengerFrom = (swapPassengerFromLane !== undefined && swapPassengerFromDepth !== undefined)
      ? this.boardRenderer?.getCellWorldPosition(swapPassengerFromLane, swapPassengerFromDepth, this.unitHeight * 0.5)
      : (passengerView ? passengerView.worldNode.worldPosition.clone() : null);

    if (!moverFrom || !moverTo) return;

    Tween.stopAllByTarget(moverView.worldNode);
    this.movingUnits.add(unit.id);
    moverView.worldNode.setWorldPosition(moverFrom);

    const liftOffset = Math.max(0.28, this.unitHeight * 0.75);
    const midPos = moverFrom.clone().lerp(moverTo, 0.52);
    midPos.y += liftOffset;
    const moveDuration = Math.max(2.0, duration);

    tween(moverView.worldNode)
      .to(moveDuration * 0.48, { worldPosition: midPos }, { easing: "sineOut" })
      .to(moveDuration * 0.52, { worldPosition: moverTo }, { easing: "quadInOut" })
      .call(() => {
        this.movingUnits.delete(unit.id);
        moverView?.worldNode.setWorldPosition(moverTo);
      })
      .start();

    if (passengerView && passengerFrom && passengerTo) {
      Tween.stopAllByTarget(passengerView.worldNode);
      this.movingUnits.add(swapWithUnitId);
      passengerView.worldNode.setWorldPosition(passengerFrom);
      const passengerMid = passengerFrom.clone().lerp(passengerTo, 0.48);
      passengerMid.y += liftOffset * 0.55;

      tween(passengerView.worldNode)
        .to(moveDuration * 0.46, { worldPosition: passengerMid }, { easing: "sineOut" })
        .to(moveDuration * 0.54, { worldPosition: passengerTo }, { easing: "quadInOut" })
        .call(() => {
          this.movingUnits.delete(swapWithUnitId);
          passengerView?.worldNode.setWorldPosition(passengerTo);
        })
        .start();
    }
  }

  public playDeath(unitId: string): void {
    const view = this.unitViews.get(unitId);
    if (!view) return;

    this.dyingUnits.add(unitId);

    // 死亡消融特效 (Tier 2 Instancing Dissolve)
    const dissolveObj = { val: 0 };
    tween(dissolveObj)
      .to(0.4, { val: 1.0 }, {
        onUpdate: (target: any) => {
          services().material.setDissolve(`${unitId}_body`, "unit-base", target.val);
          services().material.setDissolve(`${unitId}_accent`, "unit-base", target.val);
        }
      })
      .call(() => {
        services().material.releaseUnit(`${unitId}_body`);
        services().material.releaseUnit(`${unitId}_accent`);
        view.worldNode.destroy();
        view.labelNode.destroy();
        this.unitViews.delete(unitId);
        this.dyingUnits.delete(unitId);
      })
      .start();

    // UI 血條/文字退隱保持原樣
    tween(view.labelOpacity)
      .to(0.3, { opacity: 0 })
      .start();
  }

  public playAttackAnimation(attackerId: string, defenderLane: number, defenderDepth: number): void {
    const attackerNode = this.resolveCombatNode(attackerId);
    if (!attackerNode) return;

    const attackerUnit = this.findUnitById(attackerId);
    if (!attackerUnit) return;

    if (attackerUnit.type === TroopType.Cavalry) {
      const targetPos = this.boardRenderer?.getCellWorldPosition(defenderLane, defenderDepth, attackerNode.worldPosition.y);
      if (targetPos) {
        this.playCavalryChargeAnimation(attackerNode, targetPos);
      }
      return;
    }
    this.bumpNodeForward(attackerNode, attackerUnit.faction, 0.38);
  }

  public playAttackGeneralAnimation(attackerId: string, defenderFaction: Faction): void {
    const attackerNode = this.resolveCombatNode(attackerId);
    const defenderNode = this.generalViews.get(defenderFaction)?.worldNode ?? null;
    if (!attackerNode || !defenderNode) return;

    const attackerUnit = this.findUnitById(attackerId);
    if (!attackerUnit) return;

    if (attackerUnit.type === TroopType.Cavalry) {
      this.playCavalryChargeAnimation(attackerNode, defenderNode.worldPosition);
      return;
    }
    this.bumpNodeForward(attackerNode, attackerUnit.faction, 0.38);
  }

  public playHitAnimation(defenderId: string, attackerId: string | null): void {
    const defenderView = this.unitViews.get(defenderId);
    const defenderNode = defenderView?.worldNode ?? null;
    const defenderUnit = this.findUnitById(defenderId);
    if (!defenderNode || !defenderUnit) return;

    this.recoilNode(defenderNode, defenderUnit.faction);

    // Rim Color 受擊閃爍（Tier 2 Instancing）
    services().material.setRim(`${defenderId}_body`, "unit-base", new Color(255, 80, 0, 200));
    services().material.setRim(`${defenderId}_accent`, "unit-base", new Color(255, 80, 0, 200));
    setTimeout(() => {
      // 確保仍存在才清空（可能已經死亡被銷毀）
      if (this.unitViews.has(defenderId)) {
        services().material.clearRim(`${defenderId}_body`, "unit-base");
        services().material.clearRim(`${defenderId}_accent`, "unit-base");
      }
    }, 200);
  }

  public playGeneralHitAnimation(defenderFaction: Faction, attackerId: string | null): void {
    const defenderNode = this.generalViews.get(defenderFaction)?.worldNode ?? null;
    if (!defenderNode) return;

    this.recoilNode(defenderNode, defenderFaction);
  }

  public playGeneralValueChange(defenderFaction: Faction, value: number): void {
    const generalView = this.generalViews.get(defenderFaction);
    if (!generalView) return;

    const worldPos = generalView.worldNode.worldPosition.clone();
    worldPos.y += this.unitHeight * 0.5;

    const isPlayerSide = defenderFaction === Faction.Player;
    this.spawnFloatText(`-${value}`, isPlayerSide ? 'dmg_player' : 'dmg_enemy', worldPos);
  }

  public playValueChange(unit: TroopUnit | null, value: number, kind: "damage" | "heal"): void {
    if (!unit || !this.uiRoot || !this.worldCamera || !this.canvasNode) return;

    let worldPos = this.boardRenderer?.getCellWorldPosition(unit.lane, unit.depth, this.unitHeight * 0.5);
    const view = unit ? this.unitViews.get(unit.id) : undefined;
    
    if (view && view.usingTroopFormation && view.formationRoot.children.length > 0) {
      // 找出所有活著的小兵模型（排除陰影節點）
      const soldiers = view.formationRoot.children.filter(c => c.name.startsWith("Soldier_"));
      if (soldiers.length > 0) {
        // 隨機抽選一個被攻擊的小兵身上冒出數字
        const randomSoldier = soldiers[Math.floor(Math.random() * soldiers.length)];
        worldPos = randomSoldier.worldPosition.clone();
        worldPos.y += this.unitHeight * 0.5; // 保留在小兵大約中段的高度
      }
    }

    if (!worldPos) return;

    // 延遲傷害數字跳出，配合攻擊方抵達的時刻 (0.08s)
    setTimeout(() => {
      const sign = kind === "heal" ? "+" : "-";
      const dmgType: FloatTextType = kind === "heal" ? 'heal' : (unit.faction === Faction.Player ? 'dmg_player' : 'dmg_enemy');
      this.spawnFloatText(`${sign}${value}`, dmgType, worldPos!);

      const currentView = this.unitViews.get(unit.id);
      if (currentView) {
        if (currentView.usingTroopFormation) {
          // 只針對實際的兵模型做受擊跳動，不要震動到陰影
          currentView.formationRoot.children.forEach(child => {
            if (child.name.startsWith("Soldier_")) {
              const originalPos = child.position.clone();
              Tween.stopAllByTarget(child);
              tween(child)
                .to(0.06, { position: new Vec3(originalPos.x, originalPos.y + 0.06, originalPos.z) })
                .to(0.1, { position: originalPos })
                .start();
            }
          });
        } else {
          const originalScale = currentView.worldNode.scale.clone();
          tween(currentView.worldNode)
            .to(0.08, { scale: new Vec3(originalScale.x * 1.15, originalScale.y * 0.9, originalScale.z * 1.15) })
            .to(0.12, { scale: originalScale })
            .start();
        }
      }
    }, 80); // 80ms == 0.08s
  }

  /**
   * 飄字委托至 FloatTextSystem，由其統一管理物件池、動畫、maxConcurrent
   * 外觀設定請修改 FloatTextSystem.ts 中的 FLOAT_CONFIGS
   */
  private spawnFloatText(text: string, type: FloatTextType, worldPos: Vec3): void {
    services().floatText.show(type, text, worldPos);
  }

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

  public playSpGainAnimation(
    fromLane: number,
    fromDepth: number,
    amount: number,
    isPlayer: boolean,
    targetUiNode: Node | null = null,
  ): void {
    if (!this.uiRoot || !this.worldCamera || !this.canvasNode) return;

    // 從擊敗的小兵位置產生
    const worldPos = this.boardRenderer?.getCellWorldPosition(fromLane, fromDepth, this.unitHeight * 0.5);
    if (!worldPos) return;

    const startPos = this.toUiPosition(worldPos);
    let endPos: Vec3;
    if (targetUiNode) {
      const uiTrans = this.uiRoot.getComponent(UITransform);
      const local = new Vec3();
      if (uiTrans) {
        uiTrans.convertToNodeSpaceAR(targetUiNode.worldPosition, local);
      }
      endPos = local;
    } else {
      const targetFaction = isPlayer ? Faction.Player : Faction.Enemy;
      const generalView = this.generalViews.get(targetFaction);
      const targetWorldPos = generalView?.worldNode.worldPosition.clone() ?? worldPos.clone();
      targetWorldPos.y += this.unitHeight * 0.8;
      endPos = this.toUiPosition(targetWorldPos);
    }

    const floatNode = new Node(`SP_GAIN`);
    floatNode.layer = this.canvasNode?.layer ?? Layers.Enum.UI_2D;
    this.uiRoot.addChild(floatNode);

    const tf = floatNode.addComponent(UITransform);
    tf.setContentSize(140, 36);
    const opacity = floatNode.addComponent(UIOpacity);
    opacity.opacity = 255;
    const label = floatNode.addComponent(Label);
    label.fontSize = 24;
    label.lineHeight = 26;
    label.string = `+${amount} SP`;
    label.color = new Color(255, 230, 80, 255); // 金黃色
    label.isBold = true;
    floatNode.setPosition(startPos);

    floatNode.setScale(new Vec3(1, 1, 1));

    // 先快後慢，並同步放大到三倍
    tween(floatNode)
      .to(0.18, {
        position: new Vec3(
          startPos.x + (endPos.x - startPos.x) * 0.72,
          startPos.y + (endPos.y - startPos.y) * 0.72 + 56,
          startPos.z,
        ),
        scale: new Vec3(2.2, 2.2, 2.2),
      }, { easing: "quadOut" })
      .to(0.42, { position: endPos, scale: new Vec3(3, 3, 3) }, { easing: "quadIn" })
      .call(() => {
        // 到達時閃一下，然後消失
        tween(floatNode)
          .to(0.1, { scale: new Vec3(1.5, 1.5, 1.5) })
          .to(0.1, { scale: new Vec3(0.1, 0.1, 0.1) })
          .call(() => floatNode.destroy())
          .start();
      })
      .start();
  }

  lateUpdate(): void {
    if (!this.uiRoot || !this.worldCamera) return;

    this.unitViews.forEach(view => {
      this.projectWorldLabel(view.worldNode, view.labelNode, this.labelHeight);
    });

    this.generalViews.forEach(view => {
      this.projectWorldLabel(view.worldNode, view.labelNode, this.labelHeight + 0.28);
    });

    this.tileBuffViews.forEach((view, key) => {
      const parts = key.split(",");
      const lane = parseInt(parts[0], 10);
      const depth = parseInt(parts[1], 10);
      const pos = this.boardRenderer?.getCellWorldPosition(lane, depth, 0.12);
      if (!pos) return;
      this.projectWorldPoint(pos, view.node);
    });
  }

  public playBuffConsumeValue(lane: number, depth: number, text: string): void {
    const worldPos = this.boardRenderer?.getCellWorldPosition(lane, depth, this.unitHeight * 0.5);
    if (!worldPos) return;
    this.spawnFloatText(text, 'status', worldPos);
  }

  /**
   * 根據 delta 分派到對應特效 Pool：ATK± / HP±。
   * 由 BattleScene.onTileBuffConsumed 呼叫。
   *
   * 對照 Unity：直接呼叫不同 ParticleSystem.Play() 實例
   */
  public playBuffEffect(unitId: string, lane: number, depth: number, attackDelta: number, hpDelta: number): void {
    const worldPos = this.boardRenderer?.getCellWorldPosition(lane, depth, 0.02);
    if (!worldPos) return;
    console.log(`[UnitRenderer] playBuffEffect unit=${unitId} lane=${lane} depth=${depth} atk=${attackDelta} hp=${hpDelta}`);
    if (attackDelta > 0) this.atkGainPool?.play(worldPos);
    if (attackDelta < 0) this.atkLossPool?.play(worldPos);
    if (hpDelta > 0)     this.hpGainPool?.play(worldPos);
    if (hpDelta < 0)     this.hpLossPool?.play(worldPos);
  }

  /** 建立 4 個 BuffGainEffectPool：ATK±、HP± 各自獨立，使用對應貼圖與顏色風格 */
  private async setupAllEffectPools(): Promise<void> {
    if (!this.worldRoot) return;

    const makePool = (label: string): BuffGainEffectPool => {
      const n = new Node(label);
      n.layer = Layers.Enum.DEFAULT;
      this.worldRoot!.addChild(n);
      const pool = n.addComponent(BuffGainEffectPool);
      pool.setCameraNode(this.worldCamera?.node ?? null);
      return pool;
    };

    const atkBuffRing = new Color(255, 212, 132, 255);
    const atkBuffMain = new Color(255, 244, 214, 255);
    const atkBuffArrow = new Color(255, 191, 96, 255);

    const healBuffRing = new Color(110, 255, 196, 255);
    const healBuffMain = new Color(210, 255, 236, 255);
    const healBuffArrow = new Color(144, 255, 206, 255);

    const debuffRing = new Color(96, 28, 28, 220);
    const debuffMain = new Color(190, 72, 72, 236);
    const debuffArrow = new Color(128, 42, 42, 220);

    this.atkGainPool = makePool("Pool_AtkGain");
    this.atkLossPool = makePool("Pool_AtkLoss");
    this.hpGainPool  = makePool("Pool_HpGain");
    this.hpLossPool  = makePool("Pool_HpLoss");

    await Promise.all([
      this.atkGainPool.initialize({ variant: "AtkGain", prefabPath: "fx/buff/buff_gain_3d", ringTexturePath: "vfx_core:textures/rings/tex_ring_addatk",  mainTexturePath: "vfx_core:textures/icons/tex_icon_addatk",  arrowTexturePath: "vfx_core:textures/shapes/tex_shape_arrow_addatk",  sparkTexturePath: "vfx_core:textures/glow/ex_hit_flash",  arrowUp: true,  mainScaleMultiplier: 0.78, ringColor: atkBuffRing, mainColor: atkBuffMain, arrowColor: atkBuffArrow, label: "AtkGain" }),
      this.atkLossPool.initialize({ variant: "AtkLoss", prefabPath: "fx/buff/buff_debuff_3d", ringTexturePath: "vfx_core:textures/rings/tex_ring_addatk",  mainTexturePath: "vfx_core:textures/icons/tex_icon_addatk",  arrowTexturePath: "vfx_core:textures/shapes/tex_shape_arrow_addatk",  sparkTexturePath: "vfx_core:textures/glow/ex_hit_flash",  arrowUp: false, mainScaleMultiplier: 0.78, ringColor: debuffRing, mainColor: debuffMain, arrowColor: debuffArrow, label: "AtkLoss" }),
      this.hpGainPool.initialize({ variant: "HpGain", prefabPath: "fx/buff/buff_gain_3d", ringTexturePath: "vfx_core:textures/rings/tex_ring_addlife", mainTexturePath: "vfx_core:textures/icons/tex_icon_addlife", arrowTexturePath: "vfx_core:textures/shapes/tex_shape_arrow_addlife", sparkTexturePath: "vfx_core:textures/rings/ex_energy_ring", arrowUp: true,  useDualArrows: true, mainRotationDeg: 90, ringColor: healBuffRing, mainColor: healBuffMain, arrowColor: healBuffArrow, label: "HpGain" }),
      this.hpLossPool.initialize({ variant: "HpLoss", prefabPath: "fx/buff/buff_debuff_3d", ringTexturePath: "vfx_core:textures/rings/tex_ring_addlife", mainTexturePath: "vfx_core:textures/icons/tex_icon_addlife", arrowTexturePath: "vfx_core:textures/shapes/tex_shape_arrow_addlife", sparkTexturePath: "vfx_core:textures/glow/ex_hit_flash", arrowUp: false, useDualArrows: true, mainRotationDeg: 90, ringColor: debuffRing, mainColor: debuffMain, arrowColor: debuffArrow, label: "HpLoss" }),
    ]);
    console.log("[UnitRenderer] ✅ 全部特效 Pool 初始化完成 (ATK±, HP±)");
  }

  private ensureRoots(): void {
    if (!this.worldRoot) {
      this.worldRoot = new Node("UnitWorldRoot");
      this.worldRoot.layer = Layers.Enum.DEFAULT;
      this.node.addChild(this.worldRoot);
    }

    if (!this.uiRoot && this.canvasNode) {
      // 為了避免層級與佈局變形影響，直接掛在 Canvas 底下
      let uiRoot = this.canvasNode.getChildByName("UnitOverlayRoot");
      if (!uiRoot) {
        uiRoot = new Node("UnitOverlayRoot");
        uiRoot.layer = this.canvasNode.layer;
        this.canvasNode.addChild(uiRoot);
        const tf = uiRoot.addComponent(UITransform);
        const canvasTf = this.canvasNode.getComponent(UITransform);
        if (canvasTf) {
          tf.setContentSize(canvasTf.contentSize);
        } else {
          tf.setContentSize(new Size(1920, 1080));
        }
        uiRoot.setPosition(Vec3.ZERO);
      }
      this.uiRoot = uiRoot;
    }
  }

  private updateGeneralViews(state: BattleState): void {
    this.updateSingleGeneralView(Faction.Player, state.playerGeneral);
    this.updateSingleGeneralView(Faction.Enemy, state.enemyGeneral);
  }

  private updateSingleGeneralView(faction: Faction, general: GeneralUnit | null): void {
    if (!general || general.currentHp <= 0 || this.hasGeneralAvatarOnBoard(faction)) {
      this.removeGeneralView(faction);
      return;
    }

    let view = this.generalViews.get(faction);
    if (!view) {
      view = this.createGeneralView(faction);
      this.generalViews.set(faction, view);
    }

    const centerLane = Math.floor(GAME_CONFIG.GRID_LANES / 2);
    const frontDepth = faction === Faction.Player ? 0 : GAME_CONFIG.GRID_DEPTH - 1;
    const inwardDepth = faction === Faction.Player ? 1 : GAME_CONFIG.GRID_DEPTH - 2;
    const front = this.boardRenderer?.getCellWorldPosition(centerLane, frontDepth, this.unitHeight * 0.75);
    const inward = this.boardRenderer?.getCellWorldPosition(centerLane, inwardDepth, this.unitHeight * 0.75);
    if (front && inward) {
      const step = inward.clone().subtract(front).multiplyScalar(1.05);
      const behind = front.clone().subtract(step);
      view.worldNode.setWorldPosition(behind);
    }

    this.alignNodeToFactionFacing(view.worldNode, faction);

    const baseScale = this.unitScale * this.generalScaleMultiplier;
    const hScale = this.unitHeight * this.generalScaleMultiplier;
    if (view.usingHeroModel) {
      view.worldNode.setScale(Vec3.ONE);
      view.bodyNode.active = false;
      this.applyGeneralHeroTransform(view, faction);
    } else {
      view.worldNode.setScale(Vec3.ONE);
      view.bodyNode.active = false;
      view.modelRoot.active = false;
      if (!view.heroLoading) {
        void this.ensureGeneralHeroModel(view, faction);
      }
    }

    view.attackLabel.string = `+${Math.round(general.attackBonus * 100)}%`;
    view.typeLabel.string = "將";
    view.hpLabel.string = `${Math.max(0, general.currentHp)}`;
    view.labelOpacity.opacity = 255;
    this.projectWorldLabel(view.worldNode, view.labelNode, this.labelHeight + 0.28);
  }

  private createGeneralView(faction: Faction): GeneralView {
    this.ensureRoots();

    const worldNode = new Node(`General_${faction}`);
    worldNode.layer = Layers.Enum.DEFAULT;
    this.worldRoot!.addChild(worldNode);

    const shadowNode = new Node("GeneralShadow");
    shadowNode.layer = Layers.Enum.DEFAULT;
    worldNode.addChild(shadowNode);
    shadowNode.setPosition(0, -(this.unitHeight * this.generalScaleMultiplier * 0.5) + 0.008, 0);
    shadowNode.setScale(new Vec3(0.28, 1.0, 0.22));
    const shadowMr = shadowNode.addComponent(MeshRenderer);
    shadowMr.mesh = this.discMesh ?? this.cubeMesh;
    const shadowMat = new Material();
    shadowMat.initialize({ effectName: 'builtin-unlit', technique: 1, states: { rasterizerState: { cullMode: gfx.CullMode.NONE } }});
    shadowMat.setProperty('mainColor', new Color(0, 0, 0, 90));
    shadowMr.setSharedMaterial(shadowMat, 0);

    const bodyNode = new Node("Body");
    bodyNode.layer = Layers.Enum.DEFAULT;
    worldNode.addChild(bodyNode);
    const mr = bodyNode.addComponent(MeshRenderer);
    mr.mesh = this.cubeMesh;
    
    // 使用 MaterialSystem 取代 createSolidMaterial
    const generalId = `General_${faction}`;
    services().material.bindUnit(generalId, "unit-base", mr);
    const outfitConfig = services().material.captureOutfit(generalId, "unit-base");
    outfitConfig.primaryColor = faction === Faction.Player ? [0.18, 0.82, 0.47, 1] : [0.92, 0.43, 0.43, 1];
    services().material.applyOutfit(generalId, "unit-base", outfitConfig);

    const labelNode = new Node(`GeneralLabel_${faction}`);
    labelNode.layer = this.canvasNode?.layer ?? Layers.Enum.UI_2D;
    this.uiRoot?.addChild(labelNode);
    const badge = this.buildBadge(labelNode, 186, 40);
    // 武將 HUD 標籤陣營色：玩家藍、敵軍紅
    badge.typeLabel.color = faction === Faction.Enemy
      ? new Color(255, 130, 130, 255)
      : new Color(160, 200, 255, 255);

    const modelRoot = new Node("ModelRoot");
    modelRoot.layer = Layers.Enum.DEFAULT;
    modelRoot.active = false;
    worldNode.addChild(modelRoot);

    const view: GeneralView = {
      worldNode,
      bodyNode,
      modelRoot,
      labelNode,
      attackLabel: badge.attackLabel,
      typeLabel: badge.typeLabel,
      hpLabel: badge.hpLabel,
      labelOpacity: badge.opacity,
      faction,
      usingHeroModel: false,
      heroLoading: false,
    };

    bodyNode.active = false;

    void this.ensureGeneralHeroModel(view, faction);

    return view;
  }

  private removeGeneralView(faction: Faction): void {
    const view = this.generalViews.get(faction);
    if (!view) return;
    services().material.releaseUnit(`General_${faction}`);
    view.worldNode.destroy();
    view.labelNode.destroy();
    this.generalViews.delete(faction);
  }

  private projectWorldLabel(worldNode: Node, labelNode: Node, yOffset: number): void {
    if (!this.uiRoot || !this.worldCamera || !this.canvasNode) return;

    // 加上高度偏移後投影到螢幕空間
    const worldPos = worldNode.worldPosition.clone();
    worldPos.y += yOffset;
    this.worldCamera.worldToScreen(worldPos, this.screenPosBuf);

    const uiCamera = this.canvasNode.getComponentInChildren(Camera);
    if (uiCamera) {
      uiCamera.screenToWorld(this.screenPosBuf, this.uiWorldPosBuf);
      const uiTrans = this.uiRoot.getComponent(UITransform);
      if (uiTrans) {
        uiTrans.convertToNodeSpaceAR(this.uiWorldPosBuf, this.uiProjectionBuffer);
        labelNode.setPosition(this.uiProjectionBuffer);
      }
    } else {
      // fallback：直接由 worldCamera 轉換
      this.worldCamera.convertToUINode(worldPos, this.uiRoot, this.uiProjectionBuffer);
      labelNode.setPosition(this.uiProjectionBuffer);
    }
  }

  private createUnitView(unit: TroopUnit): UnitView {
    this.ensureRoots();

    const worldNode = new Node(`Unit_${unit.id}`);
    worldNode.layer = Layers.Enum.DEFAULT;
    this.worldRoot!.addChild(worldNode);

    // 效果層：bump / recoil / charge 動畫在此子節點的 local position 播放，
    // 父節點 worldNode 的 worldPosition tween（移動）永遠不受影響。
    // 對照 Unity：就像在 Visual Object 子節點上播受擊動畫，Root 移動不中斷。
    const visualNode = new Node("Visual");
    visualNode.layer = Layers.Enum.DEFAULT;
    worldNode.addChild(visualNode);

    // 陰影（blob shadow）：不再建立於整體 WorldNode，改為掛載在每個士兵腳下或將軍腳下，以避免位置偏差
    // -- 此段移除 --

    // 主體
    const bodyNode = new Node("Body");
    bodyNode.layer = Layers.Enum.DEFAULT;
    visualNode.addChild(bodyNode);
    const mr = bodyNode.addComponent(MeshRenderer);
    mr.mesh = this.cubeMesh;
    services().material.bindUnit(`${unit.id}_body`, "unit-base", mr);

    // 配件 (Accent)
    const accentNode = new Node("Accent");
    accentNode.layer = Layers.Enum.DEFAULT;
    visualNode.addChild(accentNode);
    const accentMr = accentNode.addComponent(MeshRenderer);
    accentMr.mesh = this.cubeMesh;
    services().material.bindUnit(`${unit.id}_accent`, "unit-base", accentMr);

    // 陣營外發光環 Faction Ring
    const ringNode = new Node("FactionRing");
    ringNode.layer = Layers.Enum.DEFAULT;
    worldNode.addChild(ringNode);
    // 稍微高於陰影避免 z-fighting，並壓扁
    ringNode.setPosition(0, -(this.unitHeight * 0.5) + 0.02, 0);
    ringNode.setScale(new Vec3(0.85, 0.2, 0.85)); // 縮小六邊形底盤
    const ringMr = ringNode.addComponent(MeshRenderer);
    ringMr.mesh = this.ringMesh ?? this.cubeMesh; // 若 mesh 初始化失敗仍有備案
    const ringMat = new Material();
    ringMat.initialize({
      effectName: 'builtin-unlit',
      technique: 1, // transparent
      states: { rasterizerState: { cullMode: gfx.CullMode.NONE } },
    });
    // 給予透明陣營色
    if (unit.faction === Faction.Player) {
      ringMat.setProperty('mainColor', new Color(80, 160, 255, 180)); // 我軍藍發光
    } else {
      ringMat.setProperty('mainColor', new Color(255, 80, 80, 180));  // 敵軍紅發光
    }
    ringMr.setSharedMaterial(ringMat, 0);

    const formationRoot = new Node("Formation");
    formationRoot.layer = Layers.Enum.DEFAULT;
    formationRoot.active = false;
    visualNode.addChild(formationRoot);

    // 套用陣營配色 (Tier 1)
    const outfitConfig = services().material.captureOutfit(`${unit.id}_body`, "unit-base");
    if (unit.faction === Faction.Player) {
      outfitConfig.primaryColor = [0.15, 0.45, 1.0, 1]; // 我軍藍 bottom pad
      services().material.applyOutfit(`${unit.id}_body`, "unit-base", outfitConfig);
      
      outfitConfig.primaryColor = [0.8, 0.3, 0.3, 1]; // 配件對比色
      services().material.applyOutfit(`${unit.id}_accent`, "unit-base", outfitConfig);
    } else {
      outfitConfig.primaryColor = [0.8, 0.3, 0.3, 1]; // 敵軍紅
      services().material.applyOutfit(`${unit.id}_body`, "unit-base", outfitConfig);

      outfitConfig.primaryColor = [0.2, 0.7, 0.4, 1]; // 配件對比色
      services().material.applyOutfit(`${unit.id}_accent`, "unit-base", outfitConfig);
    }

    const labelNode = new Node(`UnitLabel_${unit.id}`);
    labelNode.layer = this.canvasNode?.layer ?? Layers.Enum.UI_2D;
    this.uiRoot?.addChild(labelNode);
    const badge = this.buildBadge(labelNode, 170, 34);

    // 敵軍單位：HUD 上方標籤顯示紅色，不需修改 badge.hpLabel（已是豉紅）
    if (unit.faction === Faction.Enemy) {
      badge.typeLabel.color = new Color(255, 130, 130, 255);
      if (badge.bottomNameLabel) {
        badge.bottomNameLabel.color = new Color(255, 160, 160, 255);
      }
    }

    const view: UnitView = {
      worldNode,
      visualNode,
      bodyNode,
      ringNode,
      accentNode,
      formationRoot,
      labelNode,
      attackLabel: badge.attackLabel,
      typeLabel: badge.typeLabel,
      hpLabel: badge.hpLabel,
      labelOpacity: badge.opacity,
      bottomNameLabel: badge.bottomNameLabel,
      troopType: unit.type,
      usingTroopFormation: false,
    };

    void this.ensureTroopFormation(view, unit);

    return view;
  }

  private updateUnitView(view: UnitView, unit: TroopUnit): void {
    const worldPos = this.boardRenderer?.getCellWorldPosition(unit.lane, unit.depth, this.unitHeight * 0.5);
    if (worldPos && !this.movingUnits.has(unit.id)) {
      view.worldNode.setWorldPosition(worldPos);
    }

    const profile = this.getShapeProfile(unit.type);
    if (view.usingTroopFormation) {
      // formation 模式：隱藏所有 cube fallback 顯示
      view.accentNode.active = false;
      view.bodyNode.active = false;
      view.formationRoot.active = true;
      this.applyTroopFormationTransform(view, unit);
      view.worldNode.setScale(Vec3.ONE);
    } else {
      view.bodyNode.active = true;
      view.accentNode.active = true;
      view.formationRoot.active = false;
      view.bodyNode.setScale(profile.bodyScale);
      view.bodyNode.setPosition(0, 0, 0); // 重置 cube 位置（formation 底板與 cube 共用 bodyNode）
      view.accentNode.setScale(profile.accentScale);
      view.accentNode.setPosition(profile.accentOffset);
      view.accentNode.setRotationFromEuler(profile.accentRotation);
      view.worldNode.setScale(new Vec3(this.unitScale, this.unitHeight, this.unitScale));
      void this.ensureTroopFormation(view, unit);
    }

    const attackBonus = unit.getEffectiveAttack() - unit.attack;
    const hpBonus = unit.getEffectiveMaxHp() - unit.maxHp;
    if (this.isGeneralAvatarUnit(unit)) {
      view.attackLabel.string = `攻 ${unit.getEffectiveAttack()}`;
      view.typeLabel.string = "將";
      view.hpLabel.string = `命 ${Math.max(0, unit.currentHp)}`;
    } else {
      view.attackLabel.string = `${unit.getEffectiveAttack()}`;
      view.typeLabel.string = this.toTroopShortName(unit.type);
      view.hpLabel.string = `${Math.max(0, unit.currentHp)}`;
    }
    view.attackLabel.color = attackBonus === 0
      ? new Color(245, 245, 245, 255)
      : new Color(110, 255, 120, 255);
    view.hpLabel.color = hpBonus === 0
      ? new Color(245, 245, 245, 255)
      : new Color(110, 255, 120, 255);
    view.troopType = unit.type;
    view.labelOpacity.opacity = 255;

    // 更新下排兵種名稱（小兵顯示完整對應名稱，將軍化身則顯示「將」）
    if (view.bottomNameLabel) {
      view.bottomNameLabel.string = this.isGeneralAvatarUnit(unit) ? "將" : this.toTroopName(unit.type);
    }

    // worldNode 統一控制所有單位面向（cube placeholder 與 formation 模式皆相同）
    // formationRoot 不再負責旋轉，各 soldier 以 0° local rotation 繼承 worldNode 方向
    this.alignNodeToFactionFacing(view.worldNode, unit.faction);
    this.projectWorldLabel(view.worldNode, view.labelNode, this.labelHeight);
  }

  private buildBadge(rootNode: Node, width: number, height: number): BadgeView {
    const rootTf = rootNode.addComponent(UITransform);
    rootTf.setContentSize(width, height * 2 + 10);
    const opacity = rootNode.addComponent(UIOpacity);
    opacity.opacity = 255;

    // 將 HUD 縮小 (原本尺寸偏大)
    rootNode.setScale(0.7, 0.7, 1);

    // 背景底板：提升頭頂資訊可讀性
    const bgNode = new Node("Bg");
    bgNode.layer = rootNode.layer;
    rootNode.addChild(bgNode);
    const bgTf = bgNode.addComponent(UITransform);
    bgTf.setContentSize(width + 10, height * 2 + 10);
    const bgGraphics = bgNode.addComponent(Graphics);
    bgGraphics.fillColor = new Color(0, 0, 0, 150);
    bgGraphics.roundRect(-bgTf.width/2, -bgTf.height/2, bgTf.width, bgTf.height, 5);
    bgGraphics.fill();

    const segmentHeight = height;
    let gap = 8;
    if (width > 180) gap = 12;
    
    // 上排：戰力 + 兵種符號 + 生命
    const totalGap = gap * 2;
    const sideWidth = Math.floor((width - 44 - totalGap) * 0.5);
    const centerWidth = width - sideWidth * 2 - totalGap;
    const offset = (centerWidth + gap) * 0.5 + sideWidth * 0.5;

    const attackLabel = this.createBadgeSegment(
      rootNode,
      "AttackBadge",
      -offset,
      sideWidth,
      segmentHeight,
      new Color(69, 36, 94, 0),
      new Color(109, 255, 105, 255),
      22,
    );
    // 將上排三塊徽章上移
    attackLabel.node.parent!.setPosition(-offset, segmentHeight / 2 + 2, 0);

    const typeLabel = this.createBadgeSegment(
      rootNode,
      "TypeBadge",
      0,
      centerWidth,
      segmentHeight,
      new Color(36, 38, 44, 0),
      new Color(245, 245, 245, 255),
      18,
    );
    typeLabel.node.parent!.setPosition(0, segmentHeight / 2 + 2, 0);

    const hpLabel = this.createBadgeSegment(
      rootNode,
      "HpBadge",
      offset,
      sideWidth,
      segmentHeight,
      new Color(44, 44, 48, 0),
      new Color(255, 104, 104, 255),
      22,
    );
    hpLabel.node.parent!.setPosition(offset, segmentHeight / 2 + 2, 0);

    // 下排：完整兵種名稱（由 updateUnitView 動態更新）
    const nameLabelNode = new Node("NameLabel");
    nameLabelNode.layer = rootNode.layer;
    rootNode.addChild(nameLabelNode);
    nameLabelNode.setPosition(0, -segmentHeight / 2 - 2, 0);
    const nameTf = nameLabelNode.addComponent(UITransform);
    nameTf.setContentSize(width, segmentHeight);
    const nameStrLabel = nameLabelNode.addComponent(Label);
    nameStrLabel.fontSize = 20;
    nameStrLabel.lineHeight = segmentHeight;
    nameStrLabel.horizontalAlign = HorizontalTextAlignment.CENTER;
    nameStrLabel.verticalAlign = VerticalTextAlignment.CENTER;
    nameStrLabel.color = new Color(255, 255, 255, 255);

    // 以擴充屬性保存引用，供 updateUnitView 快速更新
    (rootNode as any)._bottomNameLabel = nameStrLabel;

    return { rootNode, attackLabel, typeLabel, hpLabel, opacity, bottomNameLabel: nameStrLabel };
  }

  private findUnitById(unitId: string): TroopUnit | null {
    return this.latestState?.units.get(unitId) ?? null;
  }

  private hasGeneralAvatarOnBoard(faction: Faction): boolean {
    const prefix = faction === Faction.Player ? "player-general-" : "enemy-general-";
    for (const unitId of this.unitViews.keys()) {
      if (unitId.startsWith(prefix)) {
        return true;
      }
    }
    return false;
  }

  private isGeneralAvatarUnit(unit: TroopUnit): boolean {
    return unit.id.startsWith("player-general-") || unit.id.startsWith("enemy-general-");
  }

  private createBadgeSegment(
    rootNode: Node,
    name: string,
    x: number,
    width: number,
    height: number,
    background: Color,
    textColor: Color,
    fontSize: number,
  ): Label {
    const segmentNode = new Node(name);
    segmentNode.layer = this.canvasNode?.layer ?? Layers.Enum.UI_2D;
    rootNode.addChild(segmentNode);
    segmentNode.setPosition(new Vec3(x, 0, 0));

    const tf = segmentNode.addComponent(UITransform);
    tf.setContentSize(width, height);

    const bgNode = new Node("Background");
    bgNode.layer = segmentNode.layer;
    segmentNode.addChild(bgNode);
    const bgTf = bgNode.addComponent(UITransform);
    bgTf.setContentSize(width, height);

    const graphics = bgNode.addComponent(Graphics);
    graphics.fillColor = background;
    graphics.roundRect(-width * 0.5, -height * 0.5, width, height, 7);
    graphics.fill();

    const textNode = new Node("Text");
    textNode.layer = segmentNode.layer;
    segmentNode.addChild(textNode);
    const textTf = textNode.addComponent(UITransform);
    textTf.setContentSize(width, height);

    const label = textNode.addComponent(Label);
    label.string = "";
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 2;
    label.color = textColor;
    label.isBold = true;
    label.horizontalAlign = HorizontalTextAlignment.CENTER;
    label.verticalAlign = VerticalTextAlignment.CENTER;
    return label;
  }

  private resolveCombatNode(id: string | null): Node | null {
    if (!id) return null;
    // unitViews 包含一般小兵及武將化身（ID 格式："player-general-N" / "enemy-general-N"）
    return this.unitViews.get(id)?.worldNode ?? null;
  }

  private syncTileBuffViews(state: BattleState): void {
    if (!this.uiRoot) return;

    const activeKeys = new Set<string>();
    state.tileBuffs.forEach(buff => {
      const key = `${buff.lane},${buff.depth}`;
      activeKeys.add(key);
      let view = this.tileBuffViews.get(key);
      if (!view) {
        const node = new Node(`TileBuff_${key}`);
        node.layer = this.canvasNode?.layer ?? Layers.Enum.UI_2D;
        this.uiRoot.addChild(node);
        const tf = node.addComponent(UITransform);
        tf.setContentSize(180, 32);
        const label = node.addComponent(Label);
        label.fontSize = 20;
        label.lineHeight = 22;
        label.isBold = true;
        label.color = new Color(245, 255, 130, 255);
        label.horizontalAlign = HorizontalTextAlignment.CENTER;
        label.verticalAlign = VerticalTextAlignment.CENTER;

        node.setScale(new Vec3(1, 1, 1));
        tween(node)
          .to(0.45, { scale: new Vec3(1.25, 1.25, 1) }, { easing: "quadOut" })
          .to(0.55, { scale: new Vec3(0.95, 0.95, 1) }, { easing: "quadIn" })
          .union()
          .repeatForever()
          .start();

        view = { node, label };
        this.tileBuffViews.set(key, view);
      }
      view.label.string = buff.rarity === "rare" ? `★ ${buff.text}` : buff.text;

      let color;
      if (buff.op === "div") {
        color = buff.rarity === "rare" ? new Color(255, 90, 90, 255) : new Color(255, 130, 130, 255);
      } else {
        color = buff.rarity === "rare" ? new Color(255, 225, 110, 255) : new Color(170, 255, 170, 255);
      }
      view.label.color = color;
    });

    this.tileBuffViews.forEach((view, key) => {
      if (activeKeys.has(key)) return;
      view.node.destroy();
      this.tileBuffViews.delete(key);
    });
  }

  private projectWorldPoint(worldPos: Vec3, targetNode: Node): void {
    if (!this.uiRoot || !this.worldCamera || !this.canvasNode) return;

    this.worldCamera.worldToScreen(worldPos, this.screenPosBuf);
    const uiCamera = this.canvasNode.getComponentInChildren(Camera);
    if (uiCamera) {
      uiCamera.screenToWorld(this.screenPosBuf, this.uiWorldPosBuf);
      const uiTrans = this.uiRoot.getComponent(UITransform);
      if (uiTrans) {
        uiTrans.convertToNodeSpaceAR(this.uiWorldPosBuf, this.uiProjectionBuffer);
        targetNode.setPosition(this.uiProjectionBuffer);
      }
      return;
    }

    this.worldCamera.convertToUINode(worldPos, this.uiRoot, this.uiProjectionBuffer);
    targetNode.setPosition(this.uiProjectionBuffer);
  }

  private bumpNodeForward(node: Node, faction: Faction, distance: number): void {
    const visual = node.getChildByName("Visual");
    if (visual) {
      // worldNode 已經依據陣營轉向，使其 local 的 +X 軸正對著前方（敵方）
      // 因此在 Visual 的 local 空間中，往前衝就是沿著正 X 軸移動
      const ws = node.worldScale;
      // 攻擊方往前撞擊 -> 撞上後停頓(Hit Stop, 頓幀) -> 彈回
      const localBump = new Vec3(distance / ws.x, 0, 0);
      Tween.stopAllByTarget(visual);
      tween(visual)
        .to(0.08, { position: localBump }, { easing: "quadIn" })
        .delay(0.08) // 打擊頓幀
        .to(0.12, { position: new Vec3() }, { easing: "quadOut" })
        .start();
    } else {
      // 將軍節點（無 Visual 子節點）：直接動世界座標
      const worldPos = node.worldPosition;
      let forward = this.getBoardForwardVector(faction) || new Vec3(0, 0, 1);
      const bumpPos = worldPos.clone().add(forward.clone().normalize().multiplyScalar(distance));
      tween(node)
        .to(0.08, { worldPosition: bumpPos }, { easing: "quadIn" })
        .delay(0.08) // 打擊頓幀
        .to(0.12, { worldPosition: worldPos.clone() }, { easing: "quadOut" })
        .start();
    }
  }

  private recoilNode(node: Node, defenderFaction: Faction): void {
    const visual = node.getChildByName("Visual");
    if (visual) {
      // worldNode 已經轉向前方 (+X為正前)
      // 受擊彈退就是在 local 空間往 -X 移動
      const ws = node.worldScale;
      const localRecoil = new Vec3(-0.2 / ws.x, 0, 0);
      Tween.stopAllByTarget(visual);
      tween(visual)
        .delay(0.08) // 等待攻擊方撞過來才播放受擊
        .to(0.06, { position: localRecoil }, { easing: "quadOut" }) // 擊退
        .delay(0.06) // 受擊頓幀
        .to(0.12, { position: new Vec3() }, { easing: "quadIn" }) // 歸位
        .start();
    } else {
      // 將軍節點（無 Visual 子節點）：直接動世界座標
      const worldPos = node.worldPosition;
      let forward = this.getBoardForwardVector(defenderFaction) || new Vec3(0, 0, 1);
      let recoilDir = forward.clone().multiplyScalar(-0.2);
      const recoilPos = worldPos.clone().add(recoilDir);
      tween(node)
        .delay(0.08)
        .to(0.06, { worldPosition: recoilPos }, { easing: "quadOut" })
        .delay(0.06)
        .to(0.12, { worldPosition: worldPos.clone() }, { easing: "quadIn" })
        .start();
    }
  }

  private getShapeProfile(type: TroopType): UnitShapeProfile {
    if (type === TroopType.Cavalry) {
      return {
        bodyScale: new Vec3(0.78, 0.72, 1.35),
        accentScale: new Vec3(0.36, 0.42, 0.55),
        accentOffset: new Vec3(0, 0.28, 0.46),
        accentRotation: new Vec3(0, 0, 0),
      };
    }
    if (type === TroopType.Shield) {
      return {
        bodyScale: new Vec3(0.92, 1.02, 0.82),
        accentScale: new Vec3(0.42, 0.82, 0.18),
        accentOffset: new Vec3(0.45, 0.0, 0),
        accentRotation: new Vec3(0, 0, 0),
      };
    }
    if (type === TroopType.Archer) {
      return {
        bodyScale: new Vec3(0.72, 1.15, 0.62),
        accentScale: new Vec3(0.12, 0.85, 0.5),
        accentOffset: new Vec3(0.34, 0.05, 0),
        accentRotation: new Vec3(0, 0, 26),
      };
    }
    if (type === TroopType.Pikeman) {
      return {
        bodyScale: new Vec3(0.78, 1.08, 0.68),
        accentScale: new Vec3(0.1, 1.5, 0.1),
        accentOffset: new Vec3(0.38, 0.28, 0),
        accentRotation: new Vec3(0, 0, 20),
      };
    }
    if (type === TroopType.Engineer) {
      return {
        bodyScale: new Vec3(0.92, 0.82, 0.82),
        accentScale: new Vec3(0.48, 0.28, 0.48),
        accentOffset: new Vec3(-0.12, 0.48, 0),
        accentRotation: new Vec3(0, 0, 0),
      };
    }
    if (type === TroopType.Medic) {
      return {
        bodyScale: new Vec3(0.82, 1.0, 0.72),
        accentScale: new Vec3(0.24, 0.24, 0.24),
        accentOffset: new Vec3(0, 0.7, 0),
        accentRotation: new Vec3(0, 0, 45),
      };
    }
    if (type === TroopType.Navy) {
      return {
        bodyScale: new Vec3(1.25, 0.52, 1.1),
        accentScale: new Vec3(0.35, 0.58, 0.35),
        accentOffset: new Vec3(0, 0.34, 0),
        accentRotation: new Vec3(0, 0, 0),
      };
    }

    return {
      bodyScale: new Vec3(0.88, 0.98, 0.76),
      accentScale: new Vec3(0.2, 0.52, 0.2),
      accentOffset: new Vec3(0, 0.64, 0),
      accentRotation: new Vec3(0, 0, 0),
    };
  }

  private async ensureTroopFormation(view: UnitView, unit: TroopUnit): Promise<void> {
    if (this.isGeneralAvatarUnit(unit)) {
      return;
    }
    if (view.usingTroopFormation || view.formationRoot.children.length > 0) {
      return;
    }

    const entry = TROOP_UNIT_ASSET_CATALOG[unit.type];
    if (!entry) {
      return;
    }

    const prefab = await this.loadTroopPrefab(unit.type, entry);
    if (!prefab || !view.worldNode.isValid || view.formationRoot.children.length > 0) {
      return;
    }

    this.buildTroopFormation(view, prefab, unit, entry);
  }

  private loadTroopPrefab(type: TroopType, entry: TroopUnitAssetEntry): Promise<Prefab | null> {
    const cached = this.troopPrefabLoads.get(type);
    if (cached) {
      return cached;
    }

    const pending = new Promise<Prefab | null>((resolve) => {
      const resolveByUuid = (): void => {
        assetManager.loadAny({ uuid: entry.sceneUuid }, (error, asset) => {
          if (error || !(asset instanceof Prefab)) {
            console.warn(`[UnitRenderer] 載入小兵 prefab 失敗: ${entry.glbPath}`, error ?? new Error("asset is not Prefab"));
            resolve(null);
            return;
          }
          resolve(asset);
        });
      };

      if (entry.prefabPath) {
        services().resource.loadPrefab(entry.prefabPath)
          .then(prefab => resolve(prefab))
          .catch(() => resolveByUuid());
        return;
      }

      resolveByUuid();
    });

    this.troopPrefabLoads.set(type, pending);
    return pending;
  }

  private buildTroopFormation(view: UnitView, prefab: Prefab, unit: TroopUnit, entry: TroopUnitAssetEntry): void {
    const offsets = this.getTroopFormationOffsets(entry);

    offsets.forEach((offset, index) => {
      const soldier = instantiate(prefab);
      soldier.name = `Soldier_${index}`;
      soldier.layer = Layers.Enum.DEFAULT;
      view.formationRoot.addChild(soldier);
      this.applyDefaultLayerRecursively(soldier);
      // GLB 如实顯色，陣營區別由底板（bodyNode）顏色處理而非染 shader
      this.normalizeModelVisuals(soldier);
      soldier.setPosition(offset);
      soldier.setRotationFromEuler(0, entry.soldierYawOffset ?? 0, 0);
      soldier.setScale(entry.modelScale, entry.modelScale, entry.modelScale);

      // 給每個小兵加上專屬腳下陰影。將其加在 formationRoot 之下以避免受到小兵旋轉 (soldierYawOffset) 影響
      // 這樣可以保持統一的光影方向與形狀（皆為相對於棋盤朝向的橢圓）
      const soldierShadow = new Node(`Shadow_${index}`);
      soldierShadow.layer = Layers.Enum.DEFAULT;
      soldierShadow.setPosition(offset.x, 0.01, offset.z);
      // 隨同小兵模型縮小一併縮減陰影面積，使其不超過小兵真正的腳步寬度
      // 讀取 config，如果沒有個別設定（如騎兵的特製橢圓）就套用預設的放大版小扁圓形
      const shadowScaleX = entry.shadowScaleX ?? 0.28;
      const shadowScaleZ = entry.shadowScaleZ ?? 0.22;
      soldierShadow.setScale(new Vec3(shadowScaleX, 0.02, shadowScaleZ));
      const shadowMr = soldierShadow.addComponent(MeshRenderer);
      shadowMr.mesh = this.discMesh ?? this.cubeMesh;
      const shadowMat = new Material();
      shadowMat.initialize({
        effectName: 'builtin-unlit',
        technique: 1, // transparent blend
        states: { rasterizerState: { cullMode: gfx.CullMode.NONE } },
      });
      shadowMat.setProperty('mainColor', new Color(0, 0, 0, 90));
      shadowMr.setSharedMaterial(shadowMat, 0);
      view.formationRoot.addChild(soldierShadow);
    });

    view.usingTroopFormation = true;
    view.bodyNode.active = false;
    view.accentNode.active = false;
    view.formationRoot.active = true;
    view.worldNode.setScale(Vec3.ONE);
    this.applyTroopFormationTransform(view, unit);
  }

  private applyTroopFormationTransform(view: UnitView, unit: TroopUnit): void {
    const entry = TROOP_UNIT_ASSET_CATALOG[unit.type];
    if (!entry) {
      return;
    }
    view.formationRoot.setPosition(0, entry.heightOffset, 0);
    // 面向旋轉由 worldNode 統一負責，formationRoot 只需歸零
    view.formationRoot.setRotationFromEuler(0, 0, 0);
  }

  private getTroopFormationOffsets(entry: TroopUnitAssetEntry): Vec3[] {
      const dx = entry.spacingX * 0.5;
      const dz = entry.spacingZ * 0.5;
      
      // 依據需求：「所有小兵的陣型應該都是正面的 2x2，請不要擺出斜的隊形」
      // 因為攝影機與棋盤呈現約 45 度的等角視角 (isometric)，直接沿著世界的 X, Z 軸排會導致畫面上看起來是菱形(斜的)。
      // 因此我們將相對於兵團中心的座標旋轉 45 度，使其在視覺上抵銷畫面的斜角，變成正對攝影機的 2x2 方陣。
      const angle = -45 * (Math.PI / 180);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const rotate = (x: number, z: number) => {
          return new Vec3(
              x * cos - z * sin,
              0,
              x * sin + z * cos
          );
      };

      return [
        rotate(-dx, dz),
        rotate(dx, dz),
        rotate(-dx, -dz),
        rotate(dx, -dz),
      ];
    }

  private async ensureGeneralHeroModel(view: GeneralView, faction: Faction): Promise<void> {
    if (view.usingHeroModel || view.heroLoading || view.modelRoot.children.length > 0) {
      return;
    }

    view.heroLoading = true;

    const heroId = faction === Faction.Player ? DEFAULT_PLAYER_HERO_ASSET_ID : DEFAULT_ENEMY_HERO_ASSET_ID;
    const entry = HERO_UNIT_ASSET_CATALOG[heroId];
    if (!entry) {
      view.heroLoading = false;
      return;
    }

    const prefab = await this.loadHeroPrefab(heroId, entry);
    if (!prefab || !view.worldNode.isValid || view.modelRoot.children.length > 0) {
      view.heroLoading = false;
      view.bodyNode.active = false;
      view.modelRoot.active = false;
      return;
    }

    const hero = instantiate(prefab);
    hero.name = `${heroId}_Model`;
    hero.layer = Layers.Enum.DEFAULT;
    view.modelRoot.addChild(hero);
    this.applyDefaultLayerRecursively(hero);
    // 武將保持原色（不染色），陣營由 HUD 標籤顏色區別
    this.normalizeModelVisuals(hero);
    hero.setPosition(0, 0, 0);
    hero.setRotationFromEuler(0, 0, 0);
    hero.setScale(entry.modelScale, entry.modelScale, entry.modelScale);

    view.usingHeroModel = true;
    view.heroLoading = false;
    view.bodyNode.active = false;
    view.modelRoot.active = true;
    this.applyGeneralHeroTransform(view, faction);
  }

  private loadHeroPrefab(heroId: string, entry: HeroUnitAssetEntry): Promise<Prefab | null> {
    const cached = this.heroPrefabLoads.get(heroId);
    if (cached) {
      return cached;
    }

    const pending = new Promise<Prefab | null>((resolve) => {
      const resolveByUuid = (): void => {
        if (!entry.sceneUuid) {
          console.warn(`[UnitRenderer] 載入武將 prefab 失敗: ${entry.glbPath}`);
          this.heroPrefabLoads.delete(heroId);
          resolve(null);
          return;
        }
        assetManager.loadAny({ uuid: entry.sceneUuid }, (error, asset) => {
          if (error || !(asset instanceof Prefab)) {
            console.warn(`[UnitRenderer] 載入武將 prefab 失敗: ${entry.glbPath}`, error ?? new Error("asset is not Prefab"));
            this.heroPrefabLoads.delete(heroId);
            resolve(null);
            return;
          }
          resolve(asset);
        });
      };

      if (entry.prefabPath) {
        services().resource.loadPrefab(entry.prefabPath)
          .then(prefab => resolve(prefab))
          .catch(() => resolveByUuid());
        return;
      }

      resolveByUuid();
    });

    this.heroPrefabLoads.set(heroId, pending);
    return pending;
  }

  private applyGeneralHeroTransform(view: GeneralView, faction: Faction): void {
    const heroId = faction === Faction.Player ? DEFAULT_PLAYER_HERO_ASSET_ID : DEFAULT_ENEMY_HERO_ASSET_ID;
    const entry = HERO_UNIT_ASSET_CATALOG[heroId];
    if (!entry) {
      return;
    }

    view.modelRoot.setPosition(0, entry.heightOffset, 0);
    view.modelRoot.setRotationFromEuler(0, entry.yawOffset, 0);
  }

  private alignNodeToFactionFacing(node: Node, faction: Faction, yawOffsetDeg: number = 0): boolean {
    // 計算棋盤前方向量並只套用 Y 軸旋轉
    const forward = this.getBoardForwardVector(faction);
    if (!forward) {
      return false;
    }

    // 本專案所有 troop / hero GLB 模型的視覺正面為 local +X 方向
    // 需要求 R_y(theta) 使得 R_y(theta) * (+X_local) = forward_world
    // 即：cos(theta) = f_x, -sin(theta) = f_z  →  theta = atan2(-f_z, f_x)
    // 驗證（boardYaw=0）：
    //   player forward=(0,0,+1) → atan2(-1, 0) = -90° → local +X 指向 +Z（面向敵方 depth 增大方向）✓
    //   enemy  forward=(0,0,-1) → atan2( 1, 0) = +90° → local +X 指向 -Z（面向我方 depth 減小方向）✓
    const RAD2DEG = 180 / Math.PI;
    const yawRad = Math.atan2(-forward.z, forward.x);
    const yawDeg = yawRad * RAD2DEG + yawOffsetDeg;

    node.setRotationFromEuler(0, yawDeg, 0);
    return true;
  }

  private getBoardForwardVector(faction: Faction): Vec3 | null {
    if (!this.boardRenderer) {
      return null;
    }

    const centerLane = Math.floor(GAME_CONFIG.GRID_LANES / 2);
    const fromDepth = faction === Faction.Player ? 0 : GAME_CONFIG.GRID_DEPTH - 1;
    const toDepth = faction === Faction.Player ? 1 : GAME_CONFIG.GRID_DEPTH - 2;
    const from = this.boardRenderer.getCellWorldPosition(centerLane, fromDepth, 0);
    const to = this.boardRenderer.getCellWorldPosition(centerLane, toDepth, 0);
    const forward = to.subtract(from);
    forward.y = 0;
    if (forward.lengthSqr() <= 0.0001) {
      return null;
    }
    forward.normalize();
    return forward;
  }

  private normalizeModelVisuals(root: Node, tint: Color = new Color(255, 255, 255, 255)): void {
    const meshRenderers = root.getComponentsInChildren(MeshRenderer);
    meshRenderers.forEach(renderer => this.rebindRendererToUnlit(renderer, tint));

    const skinnedRenderers = root.getComponentsInChildren(SkinnedMeshRenderer);
    skinnedRenderers.forEach(renderer => this.rebindRendererToUnlit(renderer, tint));
  }

  private rebindRendererToUnlit(renderer: MeshRenderer | SkinnedMeshRenderer, tint: Color = new Color(255, 255, 255, 255)): void {
    const anyRenderer = renderer as any;
    const sharedMaterials = Array.isArray(anyRenderer.sharedMaterials)
      ? anyRenderer.sharedMaterials
      : (Array.isArray(anyRenderer.materials) ? anyRenderer.materials : []);

    if (!sharedMaterials || sharedMaterials.length === 0) {
      return;
    }

    sharedMaterials.forEach((sourceMaterial: Material | null, index: number) => {
      const unlitMaterial = this.createTexturedUnlitMaterial(sourceMaterial, tint);
      this.setRendererMaterialSafe(anyRenderer, unlitMaterial, index);
    });

    if ('shadowCastingMode' in anyRenderer) {
      anyRenderer.shadowCastingMode = 0;
    }
    if ('shadowReceivingMode' in anyRenderer) {
      anyRenderer.shadowReceivingMode = 0;
    }
  }

  private createTexturedUnlitMaterial(sourceMaterial: Material | null, tint: Color = new Color(255, 255, 255, 255)): Material {
    const mat = new Material();
    mat.initialize({
      effectName: 'builtin-unlit',
      defines: { USE_TEXTURE: true },
      states: {
        rasterizerState: { cullMode: gfx.CullMode.NONE },
      },
    });

    const texture = this.tryExtractMainTexture(sourceMaterial);
    if (texture) {
      mat.setProperty('mainTexture', texture);
    }
    mat.setProperty('mainColor', tint);
    return mat;
  }

  private tryExtractMainTexture(sourceMaterial: Material | null): Texture2D | null {
    if (!sourceMaterial) {
      return null;
    }

    const propertyNames = ['mainTexture', 'albedoMap', 'baseColorMap', 'diffuseMap'];
    const anyMaterial = sourceMaterial as any;
    for (const propertyName of propertyNames) {
      try {
        const value = anyMaterial.getProperty?.(propertyName);
        if (value instanceof Texture2D) {
          return value;
        }
      } catch {
        // ignore unsupported property name
      }
    }

    return null;
  }

  private setRendererMaterialSafe(renderer: any, mat: Material, index: number): void {
    try {
      if (typeof renderer.setSharedMaterial === 'function') {
        renderer.setSharedMaterial(mat, index);
        return;
      }
      if (typeof renderer.setMaterial === 'function') {
        try {
          renderer.setMaterial(mat, index);
          return;
        } catch {
          renderer.setMaterial(index, mat);
          return;
        }
      }
      if (Array.isArray(renderer.sharedMaterials)) {
        const copy = renderer.sharedMaterials.slice();
        copy[index] = mat;
        renderer.sharedMaterials = copy;
        return;
      }
      if (Array.isArray(renderer.materials)) {
        const copy = renderer.materials.slice();
        copy[index] = mat;
        renderer.materials = copy;
      }
    } catch (error) {
      console.warn('[UnitRenderer] 無法套用保底材質', error);
    }
  }

  private ensureSceneKeyLight(): void {
    const scene = this.node.scene;
    if (!scene) {
      return;
    }

    const existing = scene.getComponentInChildren(DirectionalLight);
    if (existing) {
      const anyLight = existing as any;
      if (typeof anyLight.illuminance === 'number' && anyLight.illuminance < 30000) {
        anyLight.illuminance = 45000;
      }
      return;
    }

    const lightNode = new Node('RuntimeKeyLight');
    lightNode.layer = Layers.Enum.DEFAULT;
    scene.addChild(lightNode);
    lightNode.setRotationFromEuler(-52, -28, 0);

    const light = lightNode.addComponent(DirectionalLight) as any;
    if (light) {
      if ('illuminance' in light) {
        light.illuminance = 45000;
      }
      if ('color' in light) {
        light.color = new Color(255, 244, 228, 255);
      }
    }
  }

  private applyDefaultLayerRecursively(root: Node): void {
    root.layer = Layers.Enum.DEFAULT;
    root.children.forEach(child => this.applyDefaultLayerRecursively(child));
  }

  private toTroopName(type: TroopType): string {
    if (type === TroopType.Cavalry) return "騎兵";
    if (type === TroopType.Infantry) return "步兵";
    if (type === TroopType.Shield) return "盾兵";
    if (type === TroopType.Archer) return "弓兵";
    if (type === TroopType.Pikeman) return "長槍兵";
    if (type === TroopType.Engineer) return "工兵";
    if (type === TroopType.Medic) return "醫護兵";
    return "水軍";
  }

  private toTroopShortName(type: TroopType): string {
    if (type === TroopType.Cavalry) return "騎";
    if (type === TroopType.Infantry) return "步";
    if (type === TroopType.Shield) return "盾";
    if (type === TroopType.Archer) return "弓";
    if (type === TroopType.Pikeman) return "槍";
    if (type === TroopType.Engineer) return "工";
    if (type === TroopType.Medic) return "醫";
    return "水";
  }

  private playCavalryChargeAnimation(node: Node, targetWorldPos: Vec3): void {
    const worldPos = node.worldPosition;
    // 取得衝鋒的世界方向
    const direction = targetWorldPos.clone().subtract(worldPos);
    direction.y = 0;
    if (direction.lengthSqr() <= 0.0001) return;
    direction.normalize();

    const visual = node.getChildByName("Visual");
    if (visual) {
      const ws = node.worldScale;
      // 在 visual 的 local 空間，正前方是 +X 軸。所以衝鋒方向是正 X
      const liftLocal = new Vec3(0, 0.18 / ws.y, 0);
      const chargeLocal = new Vec3(0.5 / ws.x, 0, 0); // 取代依照方向計算，一律往 local +X 衝
      
      Tween.stopAllByTarget(visual);
      tween(visual)
        .parallel(
          tween<Node>()
            .to(0.11, { position: liftLocal }, { easing: "quadOut" })
            .to(0.08, { position: chargeLocal }, { easing: "quadIn" }) // 衝撞
            .delay(0.08) // 打擊頓幀
            .to(0.13, { position: new Vec3() }, { easing: "quadOut" }),
          tween<Node>()
            // 上揚：繞著 local Z 軸旋轉 (因為 local +X 是前方)
            .to(0.11, { eulerAngles: new Vec3(0, 0, 18) }, { easing: "quadOut" })
            // 前傾衝刺：繞著 local Z 軸反向旋轉
            .to(0.08, { eulerAngles: new Vec3(0, 0, -12) }, { easing: "quadIn" })
            .delay(0.08)
            .to(0.13, { eulerAngles: new Vec3() }, { easing: "quadOut" }),
        )
        .start();
    } else {
      // 將軍騎兵（無 Visual 子節點）：fallback 直接動世界座標
      const originalPos = worldPos.clone();
      const originalEuler = node.eulerAngles.clone();
      const liftPos = originalPos.clone().add(new Vec3(0, 0.18, 0));
      const impactPos = originalPos.clone().add(direction.clone().multiplyScalar(0.5));
      Tween.stopAllByTarget(node);
      tween(node)
        .parallel(
          tween<Node>()
            .to(0.11, { worldPosition: liftPos }, { easing: "quadOut" })
            .to(0.08, { worldPosition: impactPos }, { easing: "quadIn" })
            .delay(0.08)
            .to(0.13, { worldPosition: originalPos }, { easing: "quadOut" }),
          tween<Node>()
            // 將軍沒有 visual，所以旋轉比較複雜，這裡簡化處理或者保持原本的 X 軸
            .to(0.11, { eulerAngles: new Vec3(originalEuler.x, originalEuler.y, originalEuler.z + 18) }, { easing: "quadOut" })
            .to(0.08, { eulerAngles: new Vec3(originalEuler.x, originalEuler.y, originalEuler.z - 12) }, { easing: "quadIn" })
            .delay(0.08)
            .to(0.13, { eulerAngles: originalEuler }, { easing: "quadOut" }),
        )
        .start();
    }
  }
}