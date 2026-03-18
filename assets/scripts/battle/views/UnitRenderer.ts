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
  Material,
  Mesh,
  MeshRenderer,
  Node,
  primitives,
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

const { ccclass, property } = _decorator;

interface UnitView {
  worldNode: Node;   // 世界空間根節點，負責移動 tween（Unity: Root Transform）
  visualNode: Node;  // 本地空間效果層，負責 bump / recoil / charge（Unity: Visual Child Transform）
  bodyNode: Node;
  accentNode: Node;
  labelNode: Node;
  attackLabel: Label;
  typeLabel: Label;
  hpLabel: Label;
  labelOpacity: UIOpacity;
  bottomNameLabel: Label | null;
  troopType: TroopType;
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
  labelNode: Node;
  attackLabel: Label;
  typeLabel: Label;
  hpLabel: Label;
  labelOpacity: UIOpacity;
  faction: Faction;
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
  public labelHeight = 1.05;

  @property({ tooltip: "主將 cube 相對小兵尺寸倍率" })
  public generalScaleMultiplier = 1.5;

  private boardRenderer: BoardRenderer | null = null;
  private worldCamera: Camera | null = null;
  private canvasNode: Node | null = null;
  private worldRoot: Node | null = null;
  private uiRoot: Node | null = null;
  private cubeMesh: Mesh | null = null;
  private playerMaterial: Material | null = null;
  private enemyMaterial: Material | null = null;
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
  private latestState: BattleState | null = null;

  onLoad(): void {
    this.cubeMesh = utils.MeshUtils.createMesh(primitives.box());
    this.node.layer = Layers.Enum.DEFAULT;
    this.ensureRoots();
  }

  public initialize(boardRenderer: BoardRenderer | null, worldCamera: Camera | null, canvasNode: Node | null): void {
    this.boardRenderer = boardRenderer;
    this.worldCamera = worldCamera;
    this.canvasNode = canvasNode;
    this.ensureRoots();
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

  public playDeploy(unit: TroopUnit | null): void {
    if (!unit) return;

    let view = this.unitViews.get(unit.id);
    if (!view) {
      view = this.createUnitView(unit);
      this.unitViews.set(unit.id, view);
      this.updateUnitView(view, unit);
    }

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

    const targetPos = this.boardRenderer?.getCellWorldPosition(defenderLane, defenderDepth, attackerNode.worldPosition.y);
    if (!targetPos) return;

    const attackerUnit = this.findUnitById(attackerId);
    if (attackerUnit?.type === TroopType.Cavalry) {
      this.playCavalryChargeAnimation(attackerNode, targetPos);
      return;
    }
    this.bumpNodeTowards(attackerNode, targetPos, 0.38);
  }

  public playAttackGeneralAnimation(attackerId: string, defenderFaction: Faction): void {
    const attackerNode = this.resolveCombatNode(attackerId);
    const defenderNode = this.generalViews.get(defenderFaction)?.worldNode ?? null;
    if (!attackerNode || !defenderNode) return;

    const attackerUnit = this.findUnitById(attackerId);
    if (attackerUnit?.type === TroopType.Cavalry) {
      this.playCavalryChargeAnimation(attackerNode, defenderNode.worldPosition);
      return;
    }
    this.bumpNodeTowards(attackerNode, defenderNode.worldPosition, 0.38);
  }

  public playHitAnimation(defenderId: string, attackerId: string | null): void {
    const defenderNode = this.unitViews.get(defenderId)?.worldNode ?? null;
    if (!defenderNode) return;

    this.recoilNode(defenderNode, attackerId);

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

    this.recoilNode(defenderNode, attackerId);
  }

  public playGeneralValueChange(defenderFaction: Faction, value: number): void {
    const generalView = this.generalViews.get(defenderFaction);
    if (!generalView) return;

    const worldPos = generalView.worldNode.worldPosition.clone();
    worldPos.y += this.labelHeight + 0.5;

    const isPlayerSide = defenderFaction === Faction.Player;
    this.spawnFloatText(`-${value}`, isPlayerSide ? 'dmg_player' : 'dmg_enemy', worldPos);
  }

  public playValueChange(unit: TroopUnit | null, value: number, kind: "damage" | "heal"): void {
    if (!unit || !this.uiRoot || !this.worldCamera || !this.canvasNode) return;

    const worldPos = this.boardRenderer?.getCellWorldPosition(unit.lane, unit.depth, this.labelHeight + 0.35);
    if (!worldPos) return;

    const sign = kind === "heal" ? "+" : "-";
    const dmgType: FloatTextType = kind === "heal" ? 'heal' : (unit.faction === Faction.Player ? 'dmg_player' : 'dmg_enemy');
    this.spawnFloatText(`${sign}${value}`, dmgType, worldPos);

    const view = this.unitViews.get(unit.id);
    if (view) {
      const originalScale = view.worldNode.scale.clone();
      tween(view.worldNode)
        .to(0.08, { scale: new Vec3(originalScale.x * 1.15, originalScale.y * 0.9, originalScale.z * 1.15) })
        .to(0.12, { scale: originalScale })
        .start();
    }

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
    const worldPos = this.boardRenderer?.getCellWorldPosition(fromLane, fromDepth, this.labelHeight + 0.35);
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
      targetWorldPos.y += this.labelHeight + 0.8;
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
    const worldPos = this.boardRenderer?.getCellWorldPosition(lane, depth, this.labelHeight * 0.75);
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

    const red = new Color(255, 110, 110, 255);
    const warm = new Color(255, 236, 196, 255);
    const lifeGlow = new Color(188, 255, 218, 255);

    this.atkGainPool = makePool("Pool_AtkGain");
    this.atkLossPool = makePool("Pool_AtkLoss");
    this.hpGainPool  = makePool("Pool_HpGain");
    this.hpLossPool  = makePool("Pool_HpLoss");

    await Promise.all([
      this.atkGainPool.initialize({ ringTexturePath: "vfx_core:textures/rings/tex_ring_addatk",  mainTexturePath: "vfx_core:textures/icons/tex_icon_addatk",  arrowTexturePath: "vfx_core:textures/shapes/tex_shape_arrow_addatk",  arrowUp: true,  ringColor: warm, mainColor: warm, arrowColor: warm, label: "AtkGain" }),
      this.atkLossPool.initialize({ ringTexturePath: "vfx_core:textures/rings/tex_ring_addatk",  mainTexturePath: "vfx_core:textures/icons/tex_icon_addatk",  arrowTexturePath: "vfx_core:textures/shapes/tex_shape_arrow_addatk",  arrowUp: false, ringColor: red,  mainColor: red,  arrowColor: red,  label: "AtkLoss" }),
      this.hpGainPool.initialize({ ringTexturePath: "vfx_core:textures/rings/tex_ring_addlife", mainTexturePath: "vfx_core:textures/icons/tex_icon_addlife", arrowTexturePath: "vfx_core:textures/shapes/tex_shape_arrow_addlife", arrowUp: true,  useDualArrows: true, ringColor: lifeGlow, mainColor: lifeGlow, arrowColor: lifeGlow, label: "HpGain" }),
      this.hpLossPool.initialize({ ringTexturePath: "vfx_core:textures/rings/tex_ring_addlife", mainTexturePath: "vfx_core:textures/icons/tex_icon_addlife", arrowTexturePath: "vfx_core:textures/shapes/tex_shape_arrow_addlife", arrowUp: false, useDualArrows: true, ringColor: red,  mainColor: red,  arrowColor: red,  label: "HpLoss" }),
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

      const targetDepth = faction === Faction.Player ? GAME_CONFIG.GRID_DEPTH - 1 : 0;
      const target = this.boardRenderer?.getCellWorldPosition(centerLane, targetDepth, this.unitHeight * 0.75);
      if (target) {
        view.worldNode.lookAt(target);
      }
    }

    const baseScale = this.unitScale * this.generalScaleMultiplier;
    const hScale = this.unitHeight * this.generalScaleMultiplier;
    view.worldNode.setScale(new Vec3(baseScale, hScale, baseScale));
    view.bodyNode.setScale(new Vec3(1, 1.15, 1));

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

    return {
      worldNode,
      bodyNode,
      labelNode,
      attackLabel: badge.attackLabel,
      typeLabel: badge.typeLabel,
      hpLabel: badge.hpLabel,
      labelOpacity: badge.opacity,
      faction,
    };
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

  private initMaterials(): void {
    this.playerMaterial = this.createSolidMaterial(new Color(58, 184, 110, 255));
    this.enemyMaterial  = this.createSolidMaterial(new Color(214, 100, 100, 255));
  }

  private createSolidMaterial(color: Color): Material {
    const material = new Material();
    material.initialize({
      effectName: "builtin-unlit",
      states: {
        depthStencilState: { depthTest: true, depthWrite: true },
        rasterizerState: { cullMode: gfx.CullMode.NONE },
      },
    });
    material.setProperty("mainColor", color);
    return material;
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

    // 套用陣營配色 (Tier 1)
    const outfitConfig = services().material.captureOutfit(`${unit.id}_body`, "unit-base");
    if (unit.faction === Faction.Player) {
      outfitConfig.primaryColor = [0.2, 0.7, 0.4, 1]; // 友軍綠
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

    return {
      worldNode,
      visualNode,
      bodyNode,
      accentNode,
      labelNode,
      attackLabel: badge.attackLabel,
      typeLabel: badge.typeLabel,
      hpLabel: badge.hpLabel,
      labelOpacity: badge.opacity,
      bottomNameLabel: badge.bottomNameLabel,
      troopType: unit.type,
    };
  }

  private updateUnitView(view: UnitView, unit: TroopUnit): void {
    const worldPos = this.boardRenderer?.getCellWorldPosition(unit.lane, unit.depth, this.unitHeight * 0.5);
    if (worldPos && !this.movingUnits.has(unit.id)) {
      view.worldNode.setWorldPosition(worldPos);
    }

    const profile = this.getShapeProfile(unit.type);
    view.bodyNode.setScale(profile.bodyScale);
    view.accentNode.setScale(profile.accentScale);
    view.accentNode.setPosition(profile.accentOffset);
    view.accentNode.setRotationFromEuler(profile.accentRotation);
    view.worldNode.setScale(new Vec3(this.unitScale, this.unitHeight, this.unitScale));

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

    this.projectWorldLabel(view.worldNode, view.labelNode, this.labelHeight);
  }

  private buildBadge(rootNode: Node, width: number, height: number): BadgeView {
    const rootTf = rootNode.addComponent(UITransform);
    rootTf.setContentSize(width, height * 2 + 10);
    const opacity = rootNode.addComponent(UIOpacity);
    opacity.opacity = 255;

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

  private bumpNodeTowards(node: Node, targetWorldPos: Vec3, distance: number): void {
    const worldPos = node.worldPosition;
    const direction = targetWorldPos.clone().subtract(worldPos);
    direction.y = 0;
    if (direction.lengthSqr() <= 0.0001) return;
    direction.normalize().multiplyScalar(distance);

    const visual = node.getChildByName("Visual");
    if (visual) {
      // 小兵：動畫播在 Visual 子節點的本地空間，父節點的移動 tween 不中斷
      // 對照 Unity：hit-react 播在 Visual GameObject，Root 上的移動 Animator 繼續運作
      const ws = node.worldScale;
      const localBump = new Vec3(direction.x / ws.x, 0, direction.z / ws.z);
      Tween.stopAllByTarget(visual);
      tween(visual)
        .to(0.07, { position: localBump }, { easing: "quadOut" })
        .to(0.1, { position: new Vec3() }, { easing: "quadIn" })
        .start();
    } else {
      // 將軍節點（無 Visual 子節點）：直接動世界座標，將軍沒有移動 tween
      const bumpPos = worldPos.clone().add(direction);
      tween(node)
        .to(0.07, { worldPosition: bumpPos }, { easing: "quadOut" })
        .to(0.1, { worldPosition: worldPos.clone() }, { easing: "quadIn" })
        .start();
    }
  }

  private recoilNode(node: Node, attackerId: string | null): void {
    const worldPos = node.worldPosition;
    const attackerNode = this.resolveCombatNode(attackerId);
    let recoilDir = new Vec3(0, 0, -0.18);

    if (attackerNode) {
      recoilDir = worldPos.clone().subtract(attackerNode.worldPosition);
      recoilDir.y = 0;
      if (recoilDir.lengthSqr() > 0.0001) {
        recoilDir.normalize().multiplyScalar(0.2);
      }
    }

    const visual = node.getChildByName("Visual");
    if (visual) {
      // 小兵：受擊彈退播在 Visual 本地空間，移動 tween 不中斷
      const ws = node.worldScale;
      const localRecoil = new Vec3(recoilDir.x / ws.x, 0, recoilDir.z / ws.z);
      Tween.stopAllByTarget(visual);
      tween(visual)
        .to(0.05, { position: localRecoil }, { easing: "quadOut" })
        .to(0.08, { position: new Vec3() }, { easing: "quadIn" })
        .start();
    } else {
      // 將軍節點（無 Visual 子節點）：直接動世界座標
      const recoilPos = worldPos.clone().add(recoilDir);
      tween(node)
        .to(0.05, { worldPosition: recoilPos }, { easing: "quadOut" })
        .to(0.08, { worldPosition: worldPos.clone() }, { easing: "quadIn" })
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
    const direction = targetWorldPos.clone().subtract(worldPos);
    direction.y = 0;
    if (direction.lengthSqr() <= 0.0001) return;
    direction.normalize();

    const visual = node.getChildByName("Visual");
    if (visual) {
      // 衝鋒動畫播在 Visual 本地空間：不呼叫 stopAllByTarget(node)，移動 tween 照常進行
      // 對照 Unity：Animator 在 Visual Child 播 charge clip，Root Motion 繼續讓怪物移動
      const ws = node.worldScale;
      const liftLocal = new Vec3(0, 0.18 / ws.y, 0);
      const chargeLocal = new Vec3(direction.x * 0.5 / ws.x, 0, direction.z * 0.5 / ws.z);
      Tween.stopAllByTarget(visual);
      tween(visual)
        .parallel(
          tween<Node>()
            .to(0.11, { position: liftLocal }, { easing: "quadOut" })
            .to(0.08, { position: chargeLocal }, { easing: "quadIn" })
            .to(0.13, { position: new Vec3() }, { easing: "quadOut" }),
          tween<Node>()
            .to(0.11, { eulerAngles: new Vec3(-18, 0, 0) }, { easing: "quadOut" })
            .to(0.08, { eulerAngles: new Vec3(12, 0, 0) }, { easing: "quadIn" })
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
            .to(0.13, { worldPosition: originalPos }, { easing: "quadOut" }),
          tween<Node>()
            .to(0.11, { eulerAngles: new Vec3(originalEuler.x - 18, originalEuler.y, originalEuler.z) }, { easing: "quadOut" })
            .to(0.08, { eulerAngles: new Vec3(originalEuler.x + 12, originalEuler.y, originalEuler.z) }, { easing: "quadIn" })
            .to(0.13, { eulerAngles: originalEuler }, { easing: "quadOut" }),
        )
        .start();
    }
  }
}