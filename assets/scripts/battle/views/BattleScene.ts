// @spec-source → 見 docs/cross-reference-index.md
import { _decorator, Component, Color, Label, Node, UITransform, Vec3, Button, Sprite, Prefab, Widget } from "cc";
import {
  EVENT_NAMES,
  Faction,
  GAME_CONFIG,
  TroopType,
  TROOP_DEPLOY_COST,
  SP_PER_KILL,
} from "../../core/config/Constants";
import { services } from "../../core/managers/ServiceLoader";
import { GeneralUnit, GeneralConfig } from "../../core/models/GeneralUnit";
import { BattleController } from "../controllers/BattleController";
import { TerrainGrid } from "../models/BattleState";
import { BattleHUD } from "../../ui/components/BattleHUD";
import { DeployPanel } from "../../ui/components/DeployPanel";
import { ResultPopup } from "../../ui/components/ResultPopup";
import { BattleLogPanel } from "../../ui/components/BattleLogPanel";
import { BattleScenePanel } from "../../ui/components/BattleScenePanel";
import { TallyCardData } from "../../ui/components/TigerTallyPanel";
import { DuelChallengePanel } from "../../ui/components/DuelChallengePanel";
import { BoardRenderer } from "./BoardRenderer";
import { UnitRenderer } from "./UnitRenderer";
import { SceneBackground } from "./SceneBackground";
import { Camera, Layers, geometry, Graphics } from "cc";

const { ccclass, property } = _decorator;

/** encounters.json 中單一遭遇戰的設定結構 */
interface EncounterConfig {
  id: string;
  name: string;
  playerGeneralId: string;
  enemyGeneralId: string;
  terrain?: TerrainGrid;
  /** 對應 scene-backgrounds.json 中的 id，決定要顯示的背景圖 */
  backgroundId?: string;
}

/**

  private ensureBoardRenderer(): void {
 * BattleScene — 戰鬥場景的入口元件。
 *
 * 職責：
 *   1. 初始化 ServiceLoader（DI 容器）
 *   2. 從 JSON 載入武將設定並建立 GeneralUnit
 *   3. 建立 BattleController 並啟動戰鬥
 *   4. 連結 BattleHUD、DeployPanel、ResultPopup
 *   5. 維護簡易文字化的棋盤格狀態（作為 Demo 視覺佔位）
 *
 * 使用方式：掛載於場景根節點，並在 Inspector 中綁定各 UI 元件。
 */
@ccclass("BattleScene")
export class BattleScene extends Component {
  // ─── UI 元件綁定 ──────────────────────────────────────────────────────────
  @property(BattleHUD)
  hud: BattleHUD = null!;

  @property(DeployPanel)
  deployPanel: DeployPanel = null!;

  @property(ResultPopup)
  resultPopup: ResultPopup = null!;

  /** 棋盤文字輸出節點（Debug 用 Label，可在 Inspector 中可選綁定） */
  @property(Label)
  gridDebugLabel: Label = null!;

  @property(BattleLogPanel)
  battleLogPanel: BattleLogPanel = null!;

  /** 戰場UI總調度器：統一管理 TigerTallyPanel / ActionCommandPanel / UnitInfoPanel */
  @property(BattleScenePanel)
  battleScenePanel: BattleScenePanel = null!;

  @property(BoardRenderer)
  boardRenderer: BoardRenderer = null!;

  @property(DuelChallengePanel)
  duelChallengePanel: DuelChallengePanel = null!;

  @property(UnitRenderer)
  unitRenderer: UnitRenderer = null!;

  @property({ tooltip: "是否顯示中央 debug 棋盤文字" })
  showGridDebug = false;

  @property({ tooltip: "棋盤目標深度（格數較多時會自動縮小單格）" })
  boardTargetDepth = 6.8;

  @property({ tooltip: "棋盤格間距比例" })
  boardGapRatio = 0.1;

  @property({ tooltip: "2.5D 相機 FOV（度）" })
  cameraFov = 36;

  @property({ tooltip: "2.5D 相機俯角 Pitch（建議 -45 到 -60）" })
  cameraPitch = -50;

  @property({ tooltip: "2.5D 相機偏航 Yaw（左下到右上建議 -25 到 -40）" })
  cameraYaw = -36;

  @property({ tooltip: "依棋盤對角線縮放的相機距離係數" })
  cameraDistanceFactor = 1.06;

  @property({ tooltip: "相機注視點 X 偏移比例（相對棋盤寬）" })
  cameraLookOffsetXRatio = 0.08;

  @property({ tooltip: "相機注視點 Z 偏移比例（相對棋盤深）" })
  cameraLookOffsetZRatio = 0.18;

  // ─── 內部狀態 ─────────────────────────────────────────────────────────────
  private ctrl: BattleController | null = null;
  private readonly unsubs: Array<() => void> = [];
  private isAdvancingTurn = false;
  /** 單挑面板開啟中，暫停回合解鎖，直到玩家做出決定 */
  private isDuelPanelActive = false;
  private enemyThinkingPanel: Node | null = null;
  private readonly combatVisualQueue: Array<() => void> = [];
  private isDrainingCombatVisual = false;
  /** 當前遭遇戰 ID（用於重開時保持同一關卡） */
  private currentEncounterId = "encounter-001";
  /** 場景背景管理元件 */
  private sceneBackground: SceneBackground | null = null;

  // ─── 生命週期 ─────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    console.log("[BattleScene] start() 開始執行");
    // [UI-2-0026] 預設隱藏 gridDebugLabel，避免場景預設 active=true 時顯示 "label" 佔位符
    if (this.gridDebugLabel && !this.showGridDebug) {
      this.gridDebugLabel.node.active = false;
    } else if (!this.gridDebugLabel) {
      // fallback: 如果在 Inspector 未綁定，嘗試在 Canvas 下尋找並隱藏該節點，避免 designer 留下測試節點顯示
      const canvas = this.getCanvasNode();
      try {
        const maybe = canvas?.getChildByName('gridDebugLabel') ?? canvas?.getChildByName('GridDebugLabel');
        if (maybe) maybe.active = false;
      } catch (e) {
        // 忽略任何尋找錯誤
      }
    }
    try {
      // 1. 初始化服務容器（必須在所有 services() 呼叫之前）
      // 傳入 this.node 作為 hostNode，讓 AudioSystem 得以掛載 AudioSource
      services().initialize(this.node);
      console.log("[BattleScene] ServiceLoader 初始化完成");

      // 2. 建立控制器，載入兵種表
      this.ctrl = new BattleController();
      await this.ctrl.loadData();
      console.log("[BattleScene] BattleController 資料載入完成");

      // 2.5 載入技能定義至 ActionSystem（skills.json → action.registerSkills）
      // 並行載入 vfx-effects.json，兩者互不依賴，同時送出加速啟動
      await Promise.all([
          services().loadSkills(),
          services().loadVfxEffects(),
      ]);
      console.log("[BattleScene] ActionSystem + VFX 效果表載入完成");

      // 3. 從 encounters.json 讀取遭遇戰設定
      const encounter = await this.loadEncounter(this.currentEncounterId);
      const pgId = encounter?.playerGeneralId ?? "zhang-fei";
      const egId = encounter?.enemyGeneralId  ?? "lu-bu";
      const terrain: TerrainGrid | undefined = encounter?.terrain;
      const backgroundId = encounter?.backgroundId ?? "bg_normal_day";

      // 4. 從 JSON 讀取武將設定（失敗時使用預設值）
      const pg = await this.createGeneral(pgId, Faction.Player);
      const eg = await this.createGeneral(egId, Faction.Enemy);

      // 4.5 載入 BMFont 傷害數字與登錄 Shader
      await this.loadDamageFonts();
      services().material.registerShader('unit-base', 'effect:unit-base', 'critical');
      services().material.registerShader('heroine-toon', 'effect:heroine-toon', 'critical');
      await services().material.warmupCritical(this.node);

      // 5. 開始第一場戰鬥（含地形）
      this.ctrl.initBattle(pg, eg, terrain);
      console.log("[BattleScene] 戰鬥已初始化");

      // 6. 連結 UI 元件（自動尋找，不依賴 Inspector 綁定）
      this.ensureDeployPanel();
      this.ensureHUD();
      this.ensureBattleLogPanel();
      this.ensureBattleScenePanel();
      this.ensureBoardRenderer();

      // 6-1. 將已初始化的子面板注入 BattleScenePanel（補足 Inspector 未綁定的引用）
      this.battleScenePanel?.wirePanels({
          battleHUD:      this.hud       ?? undefined,
          battleLogPanel: this.battleLogPanel ?? undefined,
      });

      // 6-2. 填入虎符卡片初始資料（手牌卡組）
      const initialCards = this._buildTallyCards();
      this.battleScenePanel?.setCards(initialCards);
      console.log(`[BattleScene] 虎符卡片已設置：${initialCards.length} 張`);

      this.boardRenderer?.setDeployHintFaction(Faction.Player);
      this.setupCameraForBoard();
      this.ensureUnitRenderer();

      this.deployPanel?.setController(this.ctrl);
      // 登記拖曳放手回調：由 DeployPanel 在放手時主動傳座標給 BattleScene，確保射線座標正確
      this.deployPanel?.registerDragDropCallback((sx, sy) => this.doDeployRaycast(sx, sy));
      console.log(`[BattleScene] deployPanel 已連結: ${!!this.deployPanel}`);

      const snap = services().battle.getSnapshot();
      // 初始化 DP 顯示（確保 DeployPanel 顯示正確的初始 DP）
      this.deployPanel?.updateDp(snap.playerDp);
      this.hud?.refresh(
        snap.turn,
        snap.playerDp,
        GAME_CONFIG.MAX_DP,
        pg.currentHp,
        pg.maxHp,
        eg.currentHp,
        eg.maxHp,
      );
      console.log(`[BattleScene] HUD 已刷新: ${!!this.hud}`);
      this.battleLogPanel?.clear();
      this.battleLogPanel?.append(`第 ${snap.turn} 回合開始，DP ${snap.playerDp}`);
      this.playTurnBanner(Faction.Player);

      // 8. 初始背景與切換功能（Debug UI）
      await this.initSceneBackground(backgroundId);
      this.addBackgroundSwitchUI();

      // 7. 訂閱事件，驅動 UI 更新
      this.subscribeEvents();
      this.refreshBattleViews();

      // 8. 監聽 DeployPanel 的「結束回合」訊號
      this.deployPanel?.node.on("endTurn", this.onEndTurn, this);
      this.deployPanel?.node.on("playerDeployed", this.onPlayerDeployed, this);
      this.deployPanel?.node.on("generalDuel", this.onGeneralDuelRequest, this);

      // 8-1. 監聽 BattleLogPanel 的工具按鈕訊號（endTurn / tactics）
      this.battleLogPanel?.node.on("endTurn", this.onEndTurn, this);
      this.battleLogPanel?.node.on("tactics", this.onTactics, this);

      // 8.5 射線偵測改由 DeployPanel.dragDropCallback 驅動（承接放手座標）
      // 不再對同一個 TOUCH_END 注冊兩個監聽器，減少跡件相互影響

      // 9. 監聯 ResultPopup 的「再來一場」訊號
      this.resultPopup?.node.on("replay", this.onReplay, this);

      console.log("[BattleScene] ✅ start() 全部完成");
    } catch (e) {
      console.error("[BattleScene] ❌ start() 發生錯誤:", e);
    }
  }

  onDestroy(): void {
    this.combatVisualQueue.length = 0;
    this.isDrainingCombatVisual = false;
    this.deployPanel?.node.off("endTurn", this.onEndTurn, this);
    this.deployPanel?.node.off("playerDeployed", this.onPlayerDeployed, this);
    this.deployPanel?.node.off("generalDuel", this.onGeneralDuelRequest, this);
    this.battleLogPanel?.node.off("endTurn", this.onEndTurn, this);
    this.battleLogPanel?.node.off("tactics", this.onTactics, this);
    this.resultPopup?.node.off("replay", this.onReplay, this);
    this.unsubscribeEvents();
  }

  /** 由 DeployPanel 拖曳放手回調驅動：將螢幕座標轉為 3D 格子並部署 */
  private doDeployRaycast(screenX: number, screenY: number): void {
    if (this.isAdvancingTurn) return;

    const cam = this.getMainCamera();
    if (!cam) return;

    // 產生射線（使用 DeployPanel 傳來的準確放手座標）
    const ray = new geometry.Ray();
    cam.screenPointToRay(screenX, screenY, ray);

    // 因為地板在 Y = 0，平面法線為 Y 軸 (0, 1, 0)
    if (Math.abs(ray.d.y) < 0.0001) return;
    const t = -ray.o.y / ray.d.y;
    if (t < 0) return;
    
    const hitPoint = new Vec3();
    Vec3.scaleAndAdd(hitPoint, ray.o, ray.d, t);

    // 檢查點擊落在哪個格子
    const cell = this.boardRenderer?.getCellFromWorldPos(hitPoint);
    if (!cell) return;

    // ── 武將單挑模式：等待玩家點擊空格放置武將 ──────────────────────────
    if (this.ctrl?.isWaitingDuelPlacement) {
      if (cell.depth < 0 || cell.depth >= GAME_CONFIG.GRID_DEPTH) return;
      const stateCell = this.ctrl.state.getCell(cell.lane, cell.depth);
      if (stateCell?.occupantId) {
        this.deployPanel?.showToast("無法在後方部署", 1.2);
        return;
      }
      const unit = this.ctrl.placeGeneralOnBoard(cell.lane, cell.depth);
      if (unit) {
        this.deployPanel?.showToast("武將出陣！全軍攻擊力加倍！");
        this.battleLogPanel?.append(`我方武將出陣至 L${cell.lane + 1} D${cell.depth}`);
        this.refreshBattleViews();
        this.unitRenderer?.playDeploy(unit);
      }
      return;
    }

    // 如果是玩家的部署列 (depth = 0)
    if (cell.depth === 0) {
      if (this.deployPanel) {
        // 通知面板選取這個路線並執行部署
        this.deployPanel.selectLane(cell.lane);
      }
    }
  }

  // ─── 傷害數字字型載入 ────────────────────────────────────────────────────────
  private async loadDamageFonts(): Promise<void> {
    try {
      const res = services().resource;
      const [fontBao, fontJia, fontMiss, fontPu] = await Promise.all([
        res.loadFont("dmgFont/bmfont/bao"),
        res.loadFont("dmgFont/bmfont/jia"),
        res.loadFont("dmgFont/bmfont/miss"),
        res.loadFont("dmgFont/bmfont/pu")
        // ji.fnt 視需求可後續擴充
      ]);
      
      const floatText = services().floatText;
      if (floatText) {
        floatText.registerFont('dmg_crit', fontBao);
        floatText.registerFont('heal', fontJia);
        floatText.registerFont('dmg_player', fontPu);
        floatText.registerFont('dmg_enemy', fontPu);
        floatText.registerFont('dmg_miss', fontMiss);
      }
      console.log("[BattleScene] BMFonts 載入並註冊完成");
    } catch (e) {
      console.warn("[BattleScene] BMFonts 載入失敗, 退回使用預設字型:", e);
    }
  }

  // ─── 遭遇戰讀取 ───────────────────────────────────────────────────────────

  private async loadEncounter(encounterId: string): Promise<EncounterConfig | null> {
    try {
      const data = await services().resource.loadJson<{ encounters: EncounterConfig[] }>("data/encounters");
      return data.encounters.find(e => e.id === encounterId) ?? null;
    } catch {
      return null;
    }
  }

  // ─── 武將建立 ─────────────────────────────────────────────────────────────

  private async createGeneral(id: string, faction: Faction): Promise<GeneralUnit> {
    // str/int/lea 對應 E-12 規則：物理型 STR×0.7+LEA×0.3；謀略型 INT×0.7+LEA×0.3
    const DEFAULT: Record<string, GeneralConfig> = {
      "zhang-fei": { id: "zhang-fei", name: "張飛", faction: Faction.Player, hp: 1000, maxSp: 100, str:  90, lea: 85, luk: 40, attackBonus: 0.10, skillId: "zhang-fei-roar" },
      "guan-yu":   { id: "guan-yu",   name: "關羽", faction: Faction.Player, hp: 1200, maxSp: 100, str: 100, lea: 90, luk: 50, attackBonus: 0.15, skillId: "guan-yu-slash"  },
      "lu-bu":     { id: "lu-bu",     name: "呂布", faction: Faction.Enemy,  hp: 1500, maxSp: 100, str: 130, lea: 95, luk: 30, attackBonus: 0.20, skillId: "lu-bu-rampage"  },
      "cao-cao":   { id: "cao-cao",   name: "曹操", faction: Faction.Enemy,  hp: 1000, maxSp: 80,  int: 110, lea: 80, luk: 70, attackBonus: 0.08, skillId: "cao-cao-tactics" },
    };

    try {
      type GeneralsJson = GeneralConfig[];
      const list = await services().resource.loadJson<GeneralsJson>("data/generals");
      const cfg  = list.find(g => g.id === id);
      if (cfg) {
        // JSON 讀出的陣營是字串，需對應到 Faction enum
        return new GeneralUnit({ ...cfg, faction });
      }
    } catch {
      // 靜默失敗，使用預設值
    }

    return new GeneralUnit(DEFAULT[id]);
  }

  // ─── 事件訂閱 ─────────────────────────────────────────────────────────────

  private subscribeEvents(): void {
    const svc = services();
    this.unsubs.push(
      svc.event.on(EVENT_NAMES.TurnPhaseChanged, this.onTurnPhaseChanged.bind(this)),
      svc.event.on(EVENT_NAMES.UnitDeployed,     this.onUnitDeployed.bind(this)),
      svc.event.on(EVENT_NAMES.UnitDamaged,      this.onUnitDamaged.bind(this)),
      svc.event.on(EVENT_NAMES.UnitHealed,       this.onUnitHealed.bind(this)),
      svc.event.on(EVENT_NAMES.UnitMoved,        this.onUnitMoved.bind(this)),
      svc.event.on(EVENT_NAMES.UnitDied,         this.onUnitDied.bind(this)),
      svc.event.on(EVENT_NAMES.GeneralDamaged,   this.onGeneralDamaged.bind(this)),
      svc.event.on(EVENT_NAMES.TileBuffSpawned,  this.onTileBuffSpawned.bind(this)),
      svc.event.on(EVENT_NAMES.TileBuffConsumed, this.onTileBuffConsumed.bind(this)),
      svc.event.on(EVENT_NAMES.BattleEnded,      this.onBattleEnded.bind(this)),
    );
  }

  private unsubscribeEvents(): void {
    this.unsubs.forEach(fn => fn());
    this.unsubs.length = 0;
  }

  // ─── 事件處理 ─────────────────────────────────────────────────────────────

  private onTurnPhaseChanged(snap: { turn: number; playerDp: number }): void {
    this.deployPanel?.updateDp(snap.playerDp);
    this.battleLogPanel?.append(`回合更新：第 ${snap.turn} 回合，DP ${snap.playerDp}`);
    this.boardRenderer?.setDeployHintFaction(Faction.Player);
    this.playTurnBanner(Faction.Player);
    this.refreshBattleViews();
  }

  private onUnitDeployed(data: { unitId: string; faction: Faction; type: TroopType; lane: number }): void {
    // 部署後即時更新 DP 顯示
    const snap = services().battle.getSnapshot();
    this.hud?.setDp(snap.playerDp);
    this.deployPanel?.updateDp(snap.playerDp);
    const side = data.faction === Faction.Player ? "我方" : "敵方";
    this.battleLogPanel?.append(`${side}部署 ${this.toTroopName(data.type)}（路線 ${data.lane + 1}）`);
    if (data.faction === Faction.Player) {
      this.deployPanel?.showToast(`我方已部署 ${this.toTroopName(data.type)}（路線 ${data.lane + 1}）`);
    }
    this.refreshBattleViews();
    const unit = this.ctrl?.state.units.get(data.unitId) ?? null;
    this.unitRenderer?.playDeploy(unit);
  }

  private onUnitDamaged(data: {
    unitId: string;
    damage: number;
    hp: number;
    attackerId: string | null;
    attackerLane: number | null;
    attackerDepth: number | null;
    defenderLane: number | null;
    defenderDepth: number | null;
    attackerFaction: Faction | null;
  }): void {
    const unit = this.ctrl?.state.units.get(data.unitId);
    if (unit) {
      const side = unit.faction === Faction.Player ? "我方" : "敵方";
      this.battleLogPanel?.append(`${side}${this.toTroopName(unit.type)} 受到 ${data.damage} 傷害，剩餘 HP ${Math.max(0, data.hp)}`);

      this.enqueueCombatVisual(() => {
        this.unitRenderer?.playValueChange(unit, data.damage, "damage");
        this.unitRenderer?.playHitAnimation(data.unitId, data.attackerId);

        if (data.attackerId && data.defenderLane !== null && data.defenderDepth !== null) {
          this.unitRenderer?.playAttackAnimation(data.attackerId, data.defenderLane, data.defenderDepth);
        }
      });
    }
    this.refreshBattleViews();
  }

  private onUnitHealed(data: { unitId: string; amount: number; hp: number; sourceId: string; lane: number; depth: number }): void {
    const unit = this.ctrl?.state.units.get(data.unitId);
    if (unit) {
      const side = unit.faction === Faction.Player ? "我方" : "敵方";
      this.battleLogPanel?.append(`${side}${this.toTroopName(unit.type)} 回復 ${data.amount}，目前 HP ${Math.max(0, data.hp)}`);
    }
    this.refreshBattleViews();
  }

  private onUnitMoved(data: {
    unitId: string;
    lane: number;
    depth: number;
    fromLane: number;
    fromDepth: number;
    swapWithUnitId?: string;
    swapDuration?: number;
    isSwapPassenger?: boolean;
    swapPartnerId?: string;
    swapPassengerFromLane?: number;
    swapPassengerFromDepth?: number;
    swapPassengerToLane?: number;
    swapPassengerToDepth?: number;
  }): void {
    const unit = this.ctrl?.state.units.get(data.unitId);
    if (unit) {
      const side = unit.faction === Faction.Player ? "我方" : "敵方";
      if (data.swapWithUnitId) {
        this.battleLogPanel?.append(`${side}${this.toTroopName(unit.type)} 與友軍換位後推進到 L${data.lane + 1} D${data.depth}`);
        this.unitRenderer?.playSwapAdvanceAnimation(
          unit,
          data.swapWithUnitId,
          data.fromLane,
          data.fromDepth,
          data.swapDuration ?? 2.0,
          data.swapPassengerFromLane,
          data.swapPassengerFromDepth,
          data.swapPassengerToLane,
          data.swapPassengerToDepth,
        );
      } else if (!data.isSwapPassenger) {
        this.battleLogPanel?.append(`${side}${this.toTroopName(unit.type)} 前進到 L${data.lane + 1} D${data.depth}`);
        this.unitRenderer?.animateMove(unit, data.fromLane, data.fromDepth);
      }
    }
    this.refreshBattleViews();
  }

  private onUnitDied(data: { unitId: string; lane: number; depth: number; faction: Faction; type: TroopType }): void {
    this.battleLogPanel?.append(`單位陣亡：${data.unitId}`);
    this.unitRenderer?.playDeath(data.unitId);

    // D. 死亡動畫：向擊殺方的武將發射 SP 吸取特效
    const killerFaction = data.faction === Faction.Player ? Faction.Enemy : Faction.Player;
    const isPlayerKiller = killerFaction === Faction.Player;
    const targetSpNode = isPlayerKiller
      ? this.hud?.playerSpBarNode ?? null
      : this.hud?.enemySpBarNode ?? null;
    this.unitRenderer?.playSpGainAnimation(data.lane, data.depth, SP_PER_KILL, isPlayerKiller, targetSpNode);

    this.refreshBattleViews();
  }

  private onGeneralDamaged(data: { faction: Faction; hp: number; damage?: number; attackerId?: string | null; isCrit?: boolean; wasDodged?: boolean }): void {
    const target = data.faction === Faction.Player ? "我方主將" : "敵方主將";

    if (data.wasDodged) {
      this.battleLogPanel?.append(`${target} 閃躲攻擊！`);
      this.enqueueCombatVisual(() => {
        this.unitRenderer?.playGeneralHitAnimation(data.faction, data.attackerId || null);
      });
      return;
    }

    const critLabel = data.isCrit ? "《暴擊》 " : "";
    this.battleLogPanel?.append(`${target} ${critLabel}受到攻擊，剩餘 HP ${Math.max(0, data.hp)}`);

    this.enqueueCombatVisual(() => {
      if (data.damage && data.damage > 0) {
        this.unitRenderer?.playGeneralValueChange(data.faction, data.damage, data.isCrit ?? false);
      }

      if (data.attackerId) {
        this.unitRenderer?.playAttackGeneralAnimation(data.attackerId, data.faction);
      }

      this.unitRenderer?.playGeneralHitAnimation(data.faction, data.attackerId || null);
    });
  }

  private onTileBuffSpawned(): void {
    this.refreshBattleViews();
  }

  private onTileBuffConsumed(data: {
    unitId: string;
    faction: Faction;
    lane: number;
    depth: number;
    buffText: string;
    attackDelta: number;
    hpDelta: number;
  }): void {
    const deltaText = [
      data.attackDelta !== 0 ? `ATK ${data.attackDelta > 0 ? "+" : ""}${data.attackDelta}` : "",
      data.hpDelta !== 0 ? `HP ${data.hpDelta > 0 ? "+" : ""}${data.hpDelta}` : "",
    ].filter(Boolean).join(" ");

    const side = data.faction === Faction.Player ? "我方" : "敵方";
    this.battleLogPanel?.append(`${side}吃到 Buff：${data.buffText} ${deltaText}`);
    this.boardRenderer?.playBuffConsumeBurst(data.lane, data.depth);
    this.unitRenderer?.playBuffConsumeValue(data.lane, data.depth, deltaText || data.buffText);
    // Buff 特效：ATK±/HP± 各自分派到對應 Pool，內部直接分流
    if (data.attackDelta !== 0 || data.hpDelta !== 0) {
      this.unitRenderer?.playBuffEffect(data.unitId, data.lane, data.depth, data.attackDelta, data.hpDelta);
    }
    this.refreshBattleViews();
  }

  private enqueueCombatVisual(action: () => void): void {
    this.combatVisualQueue.push(action);
    if (this.isDrainingCombatVisual) return;
    
    // 如果有移動動畫尚未結束，延遲開始清空攻擊序列
    this.isDrainingCombatVisual = true;
    this.scheduleOnce(() => {
        this.drainCombatVisualQueue();
    }, 1.8);
  }

  private drainCombatVisualQueue(): void {
    const action = this.combatVisualQueue.shift();
    if (!action) {
      this.isDrainingCombatVisual = false;
      return;
    }

    action();
    this.scheduleOnce(() => this.drainCombatVisualQueue(), 0.5); // 每個攻擊招式之間隔 0.5 秒
  }

  private onBattleEnded(data: { result: string }): void {
    this.resultPopup?.showResult(data.result as any);
    this.battleLogPanel?.append(`戰鬥結束：${data.result}`);
    this.boardRenderer?.clearDeployHint();
    this.refreshBattleViews();
    this.combatVisualQueue.length = 0;
    this.isDrainingCombatVisual = false;
    // 禁用操作按鈕
    if (this.deployPanel) this.deployPanel.node.active = false;
  }

  private onEndTurn(): void {
    if (!this.ctrl || this.isAdvancingTurn) return;

    this.battleLogPanel?.append("執行回合推進");
    this.isAdvancingTurn = true;
    this.boardRenderer?.setDeployHintFaction(Faction.Enemy);
    this.refreshBattleViews();

    // 顯示「敵軍思考中...」面板，2 秒後执行敵軍行動
    this.showEnemyThinkingPanel();
    this.scheduleOnce(() => {
      this.hideEnemyThinkingPanel();
      try {
        const result = this.ctrl?.advanceTurn();
        if (result === "ongoing") {
          // 回合結束後檢查單挑條件
          this.checkDuelChallenge();
        }
      } finally {
        // 小兵移動動畫為 2s，加緩衝後解鎖玩家操作
        this.scheduleOnce(() => {
          // 若單挑面板開啟中，延後解鎖（由面板決策回調負責解鎖）
          if (this.isDuelPanelActive) return;
          this.isAdvancingTurn = false;
          this.playTurnBanner(Faction.Player);
          this.boardRenderer?.setDeployHintFaction(Faction.Player);
        }, 2.3);
      }
    }, 2.0);
  }

  private onPlayerDeployed(): void {
    this.deployPanel?.showToast("部署完成，等待敵軍行動...", 1.8);
    // 展示小兵落樣後等2秒再切入敵軍回合，避免節奏太快
    this.scheduleOnce(() => this.onEndTurn(), 2.0);
  }

  /**
   * 計謀按鈕 handler（placeholder）。
   * 未來將開啟計謀選擇 PopUp，目前先顯示 Toast 提示。
   */
  private onTactics(): void {
    this.deployPanel?.showToast("計謀系統開發中…", 1.5);
  }

  private onGeneralDuelRequest(): void {
    if (!this.ctrl) return;
    const result = this.ctrl.startGeneralDuel();
    switch (result) {
      case "ok":
        this.deployPanel?.showToast("請點擊棋盤上的空格放置武將");
        this.battleLogPanel?.append("武將準備出陣，等待選擇位置...");
        break;
      case "already-deployed":
        this.deployPanel?.showToast("武將已在戰場上！");
        break;
      case "front-blocked":
        this.deployPanel?.showToast("前排有我方小兵，武將無法出陣！");
        break;
      case "general-dead":
        this.deployPanel?.showToast("武將已陣亡，無法出陣！");
        break;
    }
  }

  /**
   * 回合結束後檢查雙方武將是否到達敵將面前，觸發對稱單挑挑戰。
   *
   * 當敵方發起挑戰（challengerFaction === Enemy）：
   *   → 顯示 DuelChallengePanel，由玩家決定接受或拒絕（互動式）
   *
   * 當我方發起挑戰（challengerFaction === Player）：
   *   → 敵方 AI 依「血量/兵力/總戰力」評分自動決策（同原邏輯）
   */
  private checkDuelChallenge(): void {
    if (!this.ctrl) return;
    if (this.ctrl.isDuelChallengeResolved()) return;

    let challengerFaction: Faction | null = null;
    if (this.ctrl.isGeneralFacingEnemyGeneral(Faction.Player)) {
      challengerFaction = Faction.Player;
      this.battleLogPanel?.append("我方武將已推進到敵將面前，發起單挑邀請！");
    } else if (this.ctrl.isGeneralFacingEnemyGeneral(Faction.Enemy)) {
      challengerFaction = Faction.Enemy;
      this.battleLogPanel?.append("敵方武將已推進到我將面前，發起單挑邀請！");
    }

    if (challengerFaction === null) return;

    if (challengerFaction === Faction.Enemy) {
      // 敵將挑戰玩家 → 顯示確認面板，由玩家決定
      this.showDuelChallengePanel();
    } else {
      // 我將挑戰敵將 → AI 自動決策
      this.resolveEnemyDuelDecision(challengerFaction);
    }
  }

  /**
   * 顯示武將單挑確認面板，等待玩家做出決定。
   * 玩家決定後透過 node 事件回調觸發最終結算。
   */
  private showDuelChallengePanel(): void {
    if (!this.ctrl) return;

    // 取得武將名稱用於顯示
    const state = this.ctrl.state;
    const playerGeneralName = state.playerGeneral?.name ?? "我方武將";
    const enemyGeneralName  = state.enemyGeneral?.name  ?? "敵方武將";

    // 計算我方防守評分（讓玩家知道勝算）
    const decision = this.ctrl.evaluateDuelAcceptance(Faction.Enemy);
    const playerScore = 1.0 - decision.score;  // decision.score 是挑戰方優勢，取反為防守方勝算

    this.isDuelPanelActive = true;

    if (this.duelChallengePanel) {
      this.duelChallengePanel.show(enemyGeneralName, playerGeneralName, playerScore);

      this.duelChallengePanel.node.once("duelAccepted", () => {
        this.onPlayerDuelDecision(true);
      }, this);

      this.duelChallengePanel.node.once("duelRejected", () => {
        this.onPlayerDuelDecision(false);
      }, this);
    } else {
      // 面板未掛載時（編輯器未設定），自動接受（不卡住遊戲流程）
      console.warn("[BattleScene] duelChallengePanel 未綁定，自動接受單挑");
      this.onPlayerDuelDecision(true);
    }
  }

  /**
   * 玩家在單挑面板中做出決定後的處理。
   * @param accepted 玩家是否接受單挑
   */
  private onPlayerDuelDecision(accepted: boolean): void {
    if (!this.ctrl) return;

    const duelResult = this.ctrl.resolveDuelChallenge(Faction.Enemy, accepted);
    this.showDuelResultToast(duelResult, accepted, Faction.Enemy);

    // 面板決定完成後，解鎖玩家回合
    this.isDuelPanelActive = false;
    this.isAdvancingTurn = false;
    this.playTurnBanner(Faction.Player);
    this.boardRenderer?.setDeployHintFaction(Faction.Player);
    this.refreshBattleViews();
  }

  /**
   * 我方武將挑戰敵將時，敵方 AI 自動決策。
   */
  private resolveEnemyDuelDecision(challengerFaction: Faction): void {
    if (!this.ctrl) return;

    const decision = this.ctrl.evaluateDuelAcceptance(challengerFaction);
    const defenderName = decision.defenderFaction === Faction.Player ? "我將" : "敵將";
    this.battleLogPanel?.append(
      `${defenderName} 單挑評估分數：${decision.score.toFixed(2)}（${decision.accepted ? "接受" : "拒絕"}）`
    );

    const duelResult = this.ctrl.resolveDuelChallenge(challengerFaction, decision.accepted);
    this.showDuelResultToast(duelResult, decision.accepted, decision.defenderFaction);
    this.refreshBattleViews();
  }

  /**
   * 根據單挑結果顯示對應提示訊息。
   */
  private showDuelResultToast(
    duelResult: string,
    accepted: boolean,
    defenderFaction: Faction,
  ): void {
    if (accepted) {
      if (duelResult === "player-win") {
        this.deployPanel?.showToast("單挑成立！我方武將獲勝！", 1.3, {
          color: new Color(90, 190, 255, 255),
        });
        this.battleLogPanel?.append("單挑成立！我方武將於單挑中獲勝！");
      } else if (duelResult === "enemy-win") {
        this.deployPanel?.showToast("單挑成立！敵方武將獲勝！", 1.3, {
          color: new Color(255, 110, 110, 255),
        });
        this.battleLogPanel?.append("單挑成立！敵方武將於單挑中獲勝！");
      } else {
        this.deployPanel?.showToast("單挑成立！雙方武將交鋒！");
        this.battleLogPanel?.append("單挑成立！雙方武將正面對決！");
      }
    } else {
      if (defenderFaction === Faction.Player) {
        this.deployPanel?.showToast("我將拒絕單挑！我方全軍攻防減半！");
        this.battleLogPanel?.append("我將拒絕單挑！我方全體攻擊力與生命力減半！");
      } else {
        this.deployPanel?.showToast("敵將拒絕單挑！敵方全軍攻防減半！");
        this.battleLogPanel?.append("敵將拒絕單挑！敵方全體攻擊力與生命力減半！");
      }
    }
  }

  private onReplay(): void {
    this.restartBattle();
  }

  private playTurnBanner(faction: Faction): void {
    const message = faction === Faction.Player ? "我方回合開始" : "敵方回合開始";
    const color = faction === Faction.Player
      ? new Color(90, 190, 255, 255)
      : new Color(255, 110, 110, 255);

    this.deployPanel?.showToast(message, 1.0, {
      color,
    });
  }

  /** 在畫面正中央顯示「敵軍思考中...」遮罩面板 */
  private showEnemyThinkingPanel(): void {
    const canvas = this.getCanvasNode();
    if (!canvas) return;

    if (!this.enemyThinkingPanel) {
      const panel = new Node("EnemyThinkingPanel");
      panel.layer = Layers.Enum.UI_2D;

      const tf = panel.addComponent(UITransform);
      tf.setContentSize(460, 100);

      // 圓角矩形半透明背景
      const gfx = panel.addComponent(Graphics);
      gfx.fillColor = new Color(20, 10, 10, 210);
      gfx.roundRect(-230, -50, 460, 100, 14);
      gfx.fill();

      // 邊框描線
      gfx.lineWidth = 2;
      gfx.strokeColor = new Color(200, 80, 80, 200);
      gfx.roundRect(-230, -50, 460, 100, 14);
      gfx.stroke();

      // 文字
      const lblNode = new Node("ThinkingLabel");
      lblNode.layer = Layers.Enum.UI_2D;
      panel.addChild(lblNode);
      lblNode.addComponent(UITransform).setContentSize(460, 100);
      const lbl = lblNode.addComponent(Label);
      lbl.string = "敵軍思考中...";
      lbl.fontSize = 40;
      lbl.isBold = true;
      lbl.color = new Color(255, 120, 120, 255);

      canvas.addChild(panel);
      this.enemyThinkingPanel = panel;
    }

    this.enemyThinkingPanel.setPosition(0, 0, 0);
    this.enemyThinkingPanel.active = true;
  }

  /** 隱藏「敵軍思考中...」面板 */
  private hideEnemyThinkingPanel(): void {
    if (this.enemyThinkingPanel) {
      this.enemyThinkingPanel.active = false;
    }
  }

  // ─── 重新開局 ─────────────────────────────────────────────────────────────

  private async restartBattle(): Promise<void> {
    if (!this.ctrl) return;
    this.isAdvancingTurn = false;
    this.combatVisualQueue.length = 0;
    this.isDrainingCombatVisual = false;

    const encounter = await this.loadEncounter(this.currentEncounterId);
    const pgId = encounter?.playerGeneralId ?? "zhang-fei";
    const egId = encounter?.enemyGeneralId  ?? "lu-bu";
    const terrain: TerrainGrid | undefined = encounter?.terrain;

    const pg = await this.createGeneral(pgId, Faction.Player);
    const eg = await this.createGeneral(egId, Faction.Enemy);

    this.ctrl.initBattle(pg, eg, terrain);

    this.deployPanel!.node.active = true;
    this.deployPanel?.updateDp(GAME_CONFIG.INITIAL_DP);

    const snap = services().battle.getSnapshot();
    this.playTurnBanner(Faction.Player);
    this.hud?.refresh(
      snap.turn,
      snap.playerDp,
      GAME_CONFIG.MAX_DP,
      pg.currentHp,
      pg.maxHp,
      eg.currentHp,
      eg.maxHp,
    );
    this.battleLogPanel?.clear();
    this.battleLogPanel?.append(`重新開始：第 ${snap.turn} 回合，DP ${snap.playerDp}`);
    this.boardRenderer?.setDeployHintFaction(Faction.Player);

    this.refreshBattleViews();
  }

  /**
   * 初始化場景背景系統：在場景根節點下建立 SceneBackground 元件，
   * 然後依遭遇戰設定的 backgroundId 載入對應底圖。
   */
  private async initSceneBackground(backgroundId: string): Promise<void> {
    const scene = this.node.scene;
    if (!scene) return;

    let bgNode = scene.getChildByName("SceneBackground");
    if (!bgNode) {
      bgNode = new Node("SceneBackground");
      scene.addChild(bgNode);
    }

    this.sceneBackground = bgNode.getComponent(SceneBackground) ?? bgNode.addComponent(SceneBackground);
    await this.sceneBackground.loadBackground(backgroundId);
  }

  private ensureDeployPanel(): void {
    if (!this.deployPanel) {
      // Inspector 未綁定時，自動在 Canvas 下尋找 Panel 節點並掛載 DeployPanel
      const canvas = this.getCanvasNode();
      const panelNode = canvas?.getChildByName("Panel");
      if (panelNode) {
        this.deployPanel = panelNode.getComponent(DeployPanel) ?? panelNode.addComponent(DeployPanel);
        console.log("[BattleScene] ensureDeployPanel: 自動找到/建立 DeployPanel");
      } else {
        console.warn("[BattleScene] ensureDeployPanel: 找不到 Canvas/Panel 節點");
      }
    }
  }

  private ensureHUD(): void {
    if (!this.hud) {
      // Inspector 未綁定時，自動在 Canvas 下尋找 HUD 節點並掛載 BattleHUD
      const canvas = this.getCanvasNode();
      const hudNode = canvas?.getChildByName("HUD");
      if (hudNode) {
        this.hud = hudNode.getComponent(BattleHUD) ?? hudNode.addComponent(BattleHUD);
        console.log("[BattleScene] ensureHUD: 自動找到/建立 BattleHUD");
      } else {
        console.warn("[BattleScene] ensureHUD: 找不到 Canvas/HUD 節點");
      }
    }
    // 確保 ResultPopup 也被找到
    if (!this.resultPopup) {
      const canvas = this.getCanvasNode();
      const popupNode = canvas?.getChildByName("Popup");
      if (popupNode) {
        this.resultPopup = popupNode.getComponent(ResultPopup) ?? popupNode.addComponent(ResultPopup);
        console.log("[BattleScene] ensureHUD: 自動找到/建立 ResultPopup");
      }
    }
  }

  private ensureBattleLogPanel(): void {
    if (this.battleLogPanel) return;

    const canvas = this.getCanvasNode(); // 其他 ensure* 方法跟此一致
    if (!canvas) return;

    let node = canvas.getChildByName("BattleLogPanel");
    if (!node) {
      node = new Node("BattleLogPanel");
      canvas.addChild(node);
      node.addComponent(UITransform);
    }

    // Fallback host 必須拉滿 Canvas，避免子面板 widget 以錯誤父尺寸計算導致錯位。
    const widget = node.getComponent(Widget) ?? node.addComponent(Widget);
    widget.isAlignTop = true;
    widget.isAlignBottom = true;
    widget.isAlignLeft = true;
    widget.isAlignRight = true;
    widget.top = 0;
    widget.bottom = 0;
    widget.left = 0;
    widget.right = 0;
    widget.alignMode = Widget.AlignMode.ALWAYS;

    this.battleLogPanel = node.getComponent(BattleLogPanel) ?? node.addComponent(BattleLogPanel);
  }

  /**
   * 確保 BattleScenePanel 組件存在。
   * Inspector 未綁定時，在 Canvas 根節點下尋找或新建 "BattleScenePanel" 節點。
   * BattleScenePanel 是新版 UI 總調度器，串聯 TigerTallyPanel、ActionCommandPanel、UnitInfoPanel。
   */
  private ensureBattleScenePanel(): void {
    if (this.battleScenePanel) return;

    const canvas = this.getCanvasNode();
    if (!canvas) {
      console.warn('[BattleScene] ensureBattleScenePanel: 找不到 Canvas 節點');
      return;
    }

    let node = canvas.getChildByName('BattleScenePanel');
    if (!node) {
      node = new Node('BattleScenePanel');
      canvas.addChild(node);
      node.addComponent(UITransform);
    }

    // 協調器 host 拉滿 Canvas，讓其下自動建立的子面板根節點對齊一致。
    const widget = node.getComponent(Widget) ?? node.addComponent(Widget);
    widget.isAlignTop = true;
    widget.isAlignBottom = true;
    widget.isAlignLeft = true;
    widget.isAlignRight = true;
    widget.top = 0;
    widget.bottom = 0;
    widget.left = 0;
    widget.right = 0;
    widget.alignMode = Widget.AlignMode.ALWAYS;

    this.battleScenePanel = node.getComponent(BattleScenePanel) ?? node.addComponent(BattleScenePanel);
    console.log('[BattleScene] ensureBattleScenePanel: BattleScenePanel 已就緒');
  }

  /**
   * 根據兵種資料（troops.json + Constants）建立虎符卡片初始資料。
   * 固定提供 4 張手牌：虎豹騎、陷陣營、大戟士、連弩手。
   *
   * Unity 對照：BattleHandManager.BuildInitialHand() → List<CardData>
   */
  private _buildTallyCards(): TallyCardData[] {
    // 各兵種的顯示資訊（對應 troops.json 中的 key）
    const slots: Array<{
        type: TroopType;
        name: string;
        sub: string;
        rarity: 'normal' | 'rare' | 'epic';
        traits: string[];
        desc: string;
    }> = [
        { type: TroopType.Cavalry,  name: '虎豹騎', sub: '重騎兵',  rarity: 'rare',   traits: ['衝鋒', '剋步兵'], desc: '機動性最強的精銳鐵騎，能快速突破敵陣。' },
        { type: TroopType.Infantry, name: '陷陣營', sub: '重步兵',  rarity: 'normal', traits: ['盾牆', '韌性'],   desc: '堅若磐石的步兵方陣，擅長穩守要地。' },
        { type: TroopType.Shield,   name: '大戟士', sub: '防禦盾兵', rarity: 'normal', traits: ['重甲', '剋弓兵'], desc: '以大盾與重甲著稱的防禦核心。' },
        { type: TroopType.Archer,   name: '連弩手', sub: '遠程弓兵', rarity: 'normal', traits: ['穿透', '遠程'],   desc: '善用強弩齊射的遠程打擊兵種。' },
    ];

    // 取得兵種數值（ctrl.state 持有兵種快照，fallback 至 troops.json 預設值）
    const troopData = this.ctrl?.state?.getTroopConfig?.() ?? {};

    return slots.map(s => {
        const stats = troopData[s.type] ?? {};
        return {
            unitType: s.type as string,
            unitName: s.name,
            unitSub: s.sub,
            atk:  stats.attack   ?? 0,
            def:  stats.defense  ?? 0,
            hp:   stats.hp       ?? 0,
            spd:  stats.moveRange ?? 1,
            cost: TROOP_DEPLOY_COST[s.type],
            rarity: s.rarity,
            traits: s.traits,
            abilities: [],
            desc: s.desc,
            isDisabled: false,
        } as TallyCardData;
    });
  }

  private ensureBoardRenderer(): void {
    if (!this.boardRenderer) {
      // 將棋盤放在場景最外層，不需要依附在 UI Canvas 下
      let node = this.node.scene?.getChildByName("BoardRenderer");
      if (!node) {
        node = new Node("BoardRenderer");
        this.node.scene?.addChild(node);
      }

      this.boardRenderer = node.getComponent(BoardRenderer) ?? node.addComponent(BoardRenderer);
    }

    // 與邏輯棋盤同步，避免渲染層寫死 5x8
    this.boardRenderer.cols = GAME_CONFIG.GRID_LANES;
    this.boardRenderer.rows = GAME_CONFIG.GRID_DEPTH;
    const totalCellFactor = this.boardRenderer.rows + Math.max(0, this.boardRenderer.rows - 1) * this.boardGapRatio;
    this.boardRenderer.cellSize = this.boardTargetDepth / totalCellFactor;
    this.boardRenderer.cellGap = this.boardRenderer.cellSize * this.boardGapRatio;
    this.boardRenderer.rebuildBoard();
  }

  private ensureUnitRenderer(): void {
    if (!this.unitRenderer) {
      let node = this.node.scene?.getChildByName("UnitRenderer");
      if (!node) {
        node = new Node("UnitRenderer");
        this.node.scene?.addChild(node);
      }

      this.unitRenderer = node.getComponent(UnitRenderer) ?? node.addComponent(UnitRenderer);
    }

    this.unitRenderer.initialize(this.boardRenderer, this.getMainCamera(), this.getCanvasNode());
  }

  private setupCameraForBoard(): void {
    const scene = this.node.scene;
    if (!scene) {
      console.warn("[BattleScene] setupCameraForBoard: 無法取得 scene");
      return;
    }

    // ── 尋找場景中預設的 Main Camera 來作為 3D 棋盤攝影機 ──────────────
    // 對照 Unity：直接調整預設的 Main Camera，不要再額外建新的 Camera 避免重複。
    let cam3dNode = scene.getChildByName("Main Camera");
    if (!cam3dNode) {
      console.warn("[BattleScene] 找不到 Main Camera，將回退建立新的 Camera");
      cam3dNode = new Node("Main Camera");
      scene.addChild(cam3dNode);
    }

    // 確保它在 DEFAULT layer
    cam3dNode.layer = Layers.Enum.DEFAULT;

    const cam = cam3dNode.getComponent(Camera) ?? cam3dNode.addComponent(Camera);

    // 透視投影，固定使用對齊示意圖後的相機參數
    cam.projection = Camera.ProjectionType.PERSPECTIVE;
    cam.fov        = 30;
    cam.near       = 0.5;
    cam.far        = 500;

    // 只渲染 DEFAULT layer 的節點（包含場景與棋盤 MeshRenderer）；
    // UI 會由 Canvas 下的 UI Camera 負責。
    cam.visibility = Layers.Enum.DEFAULT;
    cam.targetTexture = null;

    // DEPTH_ONLY：只清深度緩衝，讓 BGCamera（priority=-1）所畫的背景底圖透出來。
    // 對照 Unity：Main Camera ClearFlags = Depth only（背景已由 Background Camera 負責）。
    cam.clearFlags = Camera.ClearFlag.DEPTH_ONLY;

    // 註解掉代碼鎖死，讓你可以直接在編輯器 Scene 面板中移動 Main Camera
    // 等你微調出完美角度後，可以直接讓 Scene 的 Main Camera 保持著，或者再寫死回來
    /*
    const fixedCameraPosition = new Vec3(-3.80528, 7.598808, -7.911689);
    const fixedCameraEuler = new Vec3(-44.111815, -143.244049, 5.5);
    cam3dNode.setPosition(fixedCameraPosition);
    cam3dNode.setRotationFromEuler(fixedCameraEuler);
    */

    // ── 讓 Canvas 相機改用 DEPTH_ONLY，才能讓 3D 底層透出來 ──────────────────
    // 注意：Cocos 3.x UI 預設是由獨立的 Canvas Camera 渲染
    const canvas = this.getCanvasNode();
    if (canvas) {
      // 也有可能 UI Camera 直接是 Canvas 的子節點 "Camera"
      let uiCamNode = canvas.getChildByName("Camera");
      let uiCam = uiCamNode ? uiCamNode.getComponent(Camera) : canvas.getComponentInChildren(Camera);
      
      if (uiCam) {
        uiCam.clearFlags = Camera.ClearFlag.DEPTH_ONLY;
        uiCam.targetTexture = null;
      }
    }

    console.log(
      `[BattleScene] Main Camera 目前參數` +
      ` pos=(${cam3dNode.position.x.toFixed(3)}, ${cam3dNode.position.y.toFixed(3)}, ${cam3dNode.position.z.toFixed(3)})` +
      ` rot=(${cam3dNode.eulerAngles.x.toFixed(3)}, ${cam3dNode.eulerAngles.y.toFixed(3)}, ${cam3dNode.eulerAngles.z.toFixed(3)})` +
      ` fov=${cam.fov}°`
    );
  }

  private getCanvasNode(): Node | null {
    return this.node.scene?.getChildByName("Canvas") ?? this.node.parent ?? null;
  }

  private getMainCamera(): Camera | null {
    const camNode = this.node.scene?.getChildByName("Main Camera");
    return camNode?.getComponent(Camera) ?? null;
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

  // ─── Debug 棋盤文字視覺化 ─────────────────────────────────────────────────

  /**
   * 將當前棋盤狀態以純文字格式輸出到 gridDebugLabel，
   * 可在 Inspector 中選填此 Label Node 以便開發期間觀察戰況。
   *
   * 格式：每列代表一條路線，每格顯示第一個占位單位的陣營縮寫（P/E/·）
   */
  private refreshBattleViews(): void {
    if (!this.ctrl) return;

    this.updateGridDebug();
    this.boardRenderer?.renderState(this.ctrl.state);
    this.unitRenderer?.renderState(this.ctrl.state);
    
    // 更新 DeployPanel 的技能可發動狀態
    const pg = this.ctrl.state.playerGeneral;
    if (pg && this.deployPanel) {
      this.deployPanel.updateSkillStatus(pg.canUseSkill());
    }
  }

  private updateGridDebug(): void {
    if (!this.ctrl) return;

    const state = this.ctrl.state;
    const lanes = GAME_CONFIG.GRID_LANES;
    const depth = GAME_CONFIG.GRID_DEPTH;
    const rows: string[] = [];
    let playerCount = 0;
    let enemyCount = 0;

    rows.push("玩家 -> 敵方（深度 0 到 7）");
    rows.push("      0 1 2 3 4 5 6 7");

    for (let l = 0; l < lanes; l++) {
      const cells: string[] = [];
      for (let d = 0; d < depth; d++) {
        const cell = state.getCell(l, d);
        if (!cell?.occupantId) {
          cells.push("·");
        } else {
          const unit = state.units.get(cell.occupantId);
          if (unit?.faction === Faction.Player) {
            playerCount += 1;
            cells.push("P");
          } else {
            enemyCount += 1;
            cells.push("E");
          }
        }
      }
      rows.push(`L${l + 1} : ${cells.join(" ")}`);
    }

    rows.push("圖例：P=我方小兵 E=敵方小兵 ·=空格");
    rows.push(`場上小兵：我方 ${playerCount} / 敵方 ${enemyCount}`);

    const pg = state.playerGeneral;
    const eg = state.enemyGeneral;
    rows.push(`我方武將 HP:${pg?.currentHp ?? 0}  SP:${pg?.currentSp ?? 0}/${pg?.maxSp ?? 0}`);
    rows.push(`敵方武將 HP:${eg?.currentHp ?? 0}  SP:${eg?.currentSp ?? 0}/${eg?.maxSp ?? 0}`);
    rows.push(`我方堡壘:${state.playerFortressHp}  敵方堡壘:${state.enemyFortressHp}`);

    if (this.gridDebugLabel) {
      this.gridDebugLabel.node.active = this.showGridDebug;
      if (!this.showGridDebug) {
        this.gridDebugLabel.string = "";
        return;
      }

      this.gridDebugLabel.string = rows.join("\n");
    }
  }

  /**
   * 新增背景切換 Debug UI 按鈕。
   * 點擊時會在「白天平原」與「夜晚平原」之間切換，用於測試 SceneBackground。
   */
  private addBackgroundSwitchUI(): void {
    const canvas = this.getCanvasNode();
    if (!canvas) return;

    let debugRoot = canvas.getChildByName("DebugUI");
    if (!debugRoot) {
      debugRoot = new Node("DebugUI");
      debugRoot.layer = Layers.Enum.UI_2D;
      canvas.addChild(debugRoot);
    }

    const btnNode = new Node("BtnSwitchBG");
    btnNode.layer = Layers.Enum.UI_2D;
    debugRoot.addChild(btnNode);
    btnNode.setPosition(800, 480, 0); // 右上角

    const tf = btnNode.addComponent(UITransform);
    tf.setContentSize(160, 50);

    const sprite = btnNode.addComponent(Sprite);
    sprite.type = Sprite.Type.SIMPLE;
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.color = new Color(40, 40, 40, 200);

    const labelNode = new Node("Label");
    labelNode.layer = Layers.Enum.UI_2D;
    btnNode.addChild(labelNode);
    const lbl = labelNode.addComponent(Label);
    lbl.string = "切換背景";
    lbl.fontSize = 20;

    const btn = btnNode.addComponent(Button);
    let isNight = false;
    btn.node.on(Button.EventType.CLICK, () => {
      isNight = !isNight;
      const bgId = isNight ? "bg_normal_night" : "bg_normal_day";
      this.sceneBackground?.loadBackground(bgId).then(() => {
        this.deployPanel?.showToast(`背景已切換為：${isNight ? "夜晚" : "白天"}`);
      });
    }, this);
  }
}
