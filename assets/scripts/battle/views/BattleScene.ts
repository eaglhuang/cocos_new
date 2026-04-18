// @spec-source → 見 docs/cross-reference-index.md
import { _decorator, Component, Color, EventKeyboard, EventMouse, EventTouch, Input, KeyCode, Label, Node, Vec3, geometry, input } from "cc";
import {
  EVENT_NAMES,
  Faction,
  GAME_CONFIG,
  TroopType,
  SP_PER_KILL,
  Weather,
  BattleTactic,
} from "../../core/config/Constants";
import { services } from "../../core/managers/ServiceLoader";
import { BattleEntryParams, DEFAULT_BATTLE_ENTRY_PARAMS, formatBattleEntryLog } from '../models/BattleEntryParams';
import { GeneralUnit, GeneralConfig } from "../../core/models/GeneralUnit";
import { BattleController } from "../controllers/BattleController";
import { TerrainGrid } from "../models/BattleState";
import { BattleHUDComposite } from "../../ui/components/BattleHUDComposite";
import type { DeployRuntimeApi } from "../../ui/components/DeployRuntimeApi";
import { ResultPopupComposite } from "../../ui/components/ResultPopupComposite";
import { BattleLogComposite } from "../../ui/components/BattleLogComposite";
import { BattleScenePanel } from "../../ui/components/BattleScenePanel";
import { DuelChallengePanel } from "../../ui/components/DuelChallengePanel";
import { BoardRenderer } from "./BoardRenderer";
import { UnitRenderer } from "./UnitRenderer";
import { SceneBackground } from "./SceneBackground";
import { Camera, Layers, view } from "cc";
import { EncounterConfig, loadDamageFonts, prewarmVfxPools, loadEncounter, createGeneral, buildTallyCards, buildUltimateSkills, buildTacticSummary, loadBattleSkillMetadata } from './BattleSceneLoader';
import { setupCameraForBoard, initSceneBackground, troopName, addBackgroundSwitchUI, resolveSceneBackgroundId } from './BattleSceneSetup';
import { ensureDeployPanelRuntime, ensureHUD, ensureBattleLogPanel, ensureBattleScenePanel, ensureBoardRenderer, ensureUnitRenderer } from './BattleUIInitializer';
import {
  requiresBattleSkillManualTargeting,
  resolveBattleSkillProfile,
  resolveBattleSkillTargetMode,
} from '../skills/BattleSkillProfiles';
import {
  buildBattleSkillAimingMessage,
  buildBattleSkillUsedMessage,
  getBattleSkillPresentation,
} from '../skills/BattleSkillPresentation';
import { BattleSkillTargetMode, SkillSourceType } from '../../shared/SkillRuntimeContract';

const { ccclass, property } = _decorator;

interface PendingSkillTargeting {
  skillId: string;
  sourceType: SkillSourceType;
  targetMode: BattleSkillTargetMode;
}

/**
 * BattleScene — 戰鬥場景的入口元件。
 *
 * 職責：
 *   1. 初始化 ServiceLoader（DI 容器）
 *   2. 從 JSON 載入武將設定並建立 GeneralUnit
 *   3. 建立 BattleController 並啟動戰鬥
 *   4. 連結 BattleHUDComposite、Deploy runtime、ResultPopupComposite
 *   5. 維護簡易文字化的棋盤格狀態（作為 Demo 視覺佔位）
 *
 * 使用方式：掛載於場景根節點，並在 Inspector 中綁定各 UI 元件。
 */
@ccclass("BattleScene")
export class BattleScene extends Component {
  // ─── UI 元件綁定 ──────────────────────────────────────────────────────────
  @property(BattleHUDComposite)
  hud: BattleHUDComposite = null!;

  @property(Node)
  deployHost: Node = null!;

  @property(ResultPopupComposite)
  resultPopup: ResultPopupComposite = null!;

  /** 棋盤文字輸出節點（Debug 用 Label，可在 Inspector 中可選綁定） */
  @property(Label)
  gridDebugLabel: Label = null!;

  @property(BattleLogComposite)
  battleLogPanel: BattleLogComposite = null!;

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
  /** 玩家方主將（事件轉接層查詢武將資料） */
  private _pg: GeneralUnit | null = null;
  /** 敵方主將（事件轉接層查詢武將資料） */
  private _eg: GeneralUnit | null = null;
  private readonly unsubs: Array<() => void> = [];
  private isAdvancingTurn = false;
  private isDuelPanelActive = false;
  /** 每次呼叫 _onEndTurn 時遞增；用於 safety-timeout 比對，防止舊超時誤觸發 */
  private _advanceTurnGeneration = 0;
  private readonly combatVisualQueue: Array<() => void> = [];
  private isDrainingCombatVisual = false;
  /** 當前遭遇戰 ID（用於重開時保持同一關卡） */
  private currentEncounterId = "encounter-001";
  /** 本次戰場入口參數（啟動後不變） */
  private _battleParams: BattleEntryParams | null = null;
  /** 場景背景管理元件 */
  private sceneBackground: SceneBackground | null = null;
  private deployRuntime: DeployRuntimeApi | null = null;
  private pendingSkillTargeting: PendingSkillTargeting | null = null;

  private get _deployPanelRuntime(): DeployRuntimeApi | null {
    return this.deployRuntime;
  }

  // ─── 生命週期 ─────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    console.log("[BattleScene] start() 開始執行");
    const isBattleCaptureMode = this._isBattleCaptureMode();
    // [UI-2-0026] 預設隱藏 gridDebugLabel，避免場景預設 active=true 時顯示 "label" 佔位符
    if (this.gridDebugLabel && !this.showGridDebug) {
      this.gridDebugLabel.node.active = false;
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
          loadBattleSkillMetadata(),
      ]);
      console.log("[BattleScene] ActionSystem + VFX 效果表載入完成");

      // 2.6 預熱 VFX 池（依據 VFX_BLOCK_REGISTRY 中定義的 prefabPath）
      // capture mode 只做靜態 UI / HUD 驗證，不需要把整批可選特效池都預熱進來，
      // 否則不存在的可選 prefab 會把 UI residual 報表洗成假噪音。
      if (!isBattleCaptureMode) {
        await prewarmVfxPools();
        console.log("[BattleScene] VFX 池預熱完成");
      } else {
        console.log("[BattleScene] capture mode 略過 VFX 池預熱");
      }

      // 2.7 解析戰場入口參數（統一 Lobby / Preview / Replay 路徑）
      const battleParams = this._resolveBattleParams();
      this._battleParams = battleParams;
      this.currentEncounterId = battleParams.encounterId;

      // 3. 從 encounters.json 讀取遭遇戰設定
      const encounter = await loadEncounter(this.currentEncounterId);
      const pgId = battleParams.playerGeneralId;
      const egId = battleParams.enemyGeneralId;
      const terrain: TerrainGrid | undefined = encounter?.terrain;
      const backgroundId = resolveSceneBackgroundId(
        battleParams.backgroundId,
        encounter?.backgroundId,
        battleParams.battleTactic ?? encounter?.battleTactic ?? BattleTactic.Normal,
      );

      // 4. 從 JSON 讀取武將設定（失敗時使用預設值）
      const pg = await createGeneral(pgId, Faction.Player);
      const eg = await createGeneral(egId, Faction.Enemy);
      // 存為類別欄位，供 RequestGeneralQuickView 事件轉接層查詢
      this._pg = pg;
      this._eg = eg;

      // 4.5 載入 BMFont 傷害數字與登錄 Shader
      await loadDamageFonts();
      services().material.registerShader('unit-base', 'effect:unit-base', 'critical');
      services().material.registerShader('heroine-toon', 'effect:heroine-toon', 'critical');
      await services().material.warmupCritical(this.node);

      // 5. 開始第一場戰鬥（含地形、天氣、戰法）
      this.ctrl.initBattle(pg, eg, terrain, battleParams.weather, battleParams.battleTactic);
      console.log("[BattleScene] 戰鬥已初始化");

      // 6. 連結 UI 元件（自動尋找，不依賴 Inspector 綁定）
      const canvas = this.getCanvasNode();
      this.deployRuntime = await ensureDeployPanelRuntime(this.deployHost);
      const hudResult    = ensureHUD(this.hud, this.resultPopup, canvas);
      this.hud           = (hudResult.hud          ?? this.hud)         as BattleHUDComposite;
      this.resultPopup   = (hudResult.resultPopup  ?? this.resultPopup) as ResultPopupComposite;
      this.battleLogPanel   = (ensureBattleLogPanel(this.battleLogPanel, canvas) ?? this.battleLogPanel) as BattleLogComposite;
      this.battleScenePanel = (ensureBattleScenePanel(this.battleScenePanel, canvas) ?? this.battleScenePanel) as BattleScenePanel;
      this.boardRenderer    = (ensureBoardRenderer(this.boardRenderer, this.node.scene, this.boardGapRatio, this.boardTargetDepth) ?? this.boardRenderer) as BoardRenderer;
      if (this.boardRenderer) {
          services().scene.registerBoardRenderer(this.boardRenderer);
      }

      // 6-1. 將已初始化的子面板注入 BattleScenePanel（補足 Inspector 未綁定的引用）
      this.battleScenePanel?.wirePanels({
          battleHUD:      this.hud       ?? undefined,
          battleLogPanel: this.battleLogPanel ?? undefined,
      });

      // 6-2. 填入虎符卡片初始資料（手牌卡組）
      const initialCards = buildTallyCards(battleParams.selectedCardIds);
      this.battleScenePanel?.setCards(initialCards);
      this.battleScenePanel?.setUltimateSkills(buildUltimateSkills(pg));
      this.battleScenePanel?.setTacticSummary(buildTacticSummary(pg).label);

      // 6-3. 印出正式入口 log（統一格式）
      const cardNames = initialCards.map(c => c.unitName);
      console.log(formatBattleEntryLog(battleParams, {
        playerName: pg.name,
        enemyName: eg.name,
        encounterName: encounter?.name ?? battleParams.encounterId,
        cardNames,
      }));
      this._deployPanelRuntime?.setTroopSlotButtonsVisible(false);
      console.log(`[BattleScene] 虎符卡片已設置：${initialCards.length} 張`);

      this.boardRenderer?.setDeployHintFaction(Faction.Player);
      setupCameraForBoard(this.node.scene!, this.getCanvasNode());
      this.unitRenderer = (ensureUnitRenderer(this.unitRenderer, this.node.scene, this.boardRenderer, this.getMainCamera(), canvas) ?? this.unitRenderer) as UnitRenderer;

      this._deployPanelRuntime?.setController(this.ctrl);
      this._deployPanelRuntime?.registerDragDropCallback((screenX, screenY) => this._doDeployRaycast(screenX, screenY));
      console.log(`[BattleScene] deployRuntime 已連結: ${!!this._deployPanelRuntime}`);

      const snap = services().battle.getSnapshot();
      // 初始化 DP 顯示（確保 deploy runtime 顯示正確的初始 DP）
      this._deployPanelRuntime?.updateDp(snap.playerFood);
      this.hud?.setPlayerGeneralId(pgId);
      this.hud?.setEnemyGeneralId(egId);
      this.hud?.setPlayerName(pg.name);
      this.hud?.setEnemyName(eg.name);
      this.hud?.refresh(
        snap.turn,
        snap.playerFood,
        GAME_CONFIG.MAX_FOOD,
        pg.currentHp,
        pg.maxHp,
        eg.currentHp,
        eg.maxHp,
      );
      if (isBattleCaptureMode && this.hud) {
        const hudReady = await this.hud.waitUntilReady(5000);
        if (!hudReady) {
          console.warn('[BattleScene] capture mode 等待 BattleHUD ready 逾時，將以目前畫面繼續截圖');
        }

        const [tallyReady, actionReady, logReady] = await Promise.all([
          Promise.resolve(true),
          Promise.resolve(true),
          this.battleLogPanel?.waitUntilReady?.(5000) ?? Promise.resolve(true),
        ]);

        if (!tallyReady || !actionReady || !logReady) {
          console.warn(
            `[BattleScene] capture mode UI ready 狀態不足 tally:${tallyReady} action:${actionReady} log:${logReady}`,
          );
        }

          const latestSnap = services().battle.getSnapshot();
          this.hud.setPlayerGeneralId(pgId);
          this.hud.setEnemyGeneralId(egId);
        this.hud.setPlayerName(pg.name);
        this.hud.setEnemyName(eg.name);
        this.hud.refresh(
          latestSnap.turn,
          latestSnap.playerFood,
          GAME_CONFIG.MAX_FOOD,
          pg.currentHp,
          pg.maxHp,
          eg.currentHp,
          eg.maxHp,
        );
      }
      console.log(`[BattleScene] HUD 已刷新: ${!!this.hud}`);
      this.battleLogPanel?.clear();
      this.battleLogPanel?.append(`第 ${snap.turn} 回合開始，糧草 ${snap.playerFood}`);
      this.presentSceneGambitFeedback();
      this.playTurnBanner(Faction.Player);

      // 8. 初始背景與切換功能（Debug UI）
      this.sceneBackground = await initSceneBackground(this.node.scene!, backgroundId);
      if (!isBattleCaptureMode) {
        addBackgroundSwitchUI(canvas, this.sceneBackground, this._deployPanelRuntime);
      }

      // 7. 訂閱事件，驅動 UI 更新
      const svc = services();
      this.unsubs.push(
        svc.event.on(EVENT_NAMES.TurnPhaseChanged, this.onTurnPhaseChanged.bind(this)),
        svc.event.on(EVENT_NAMES.UnitDeployed,     this.onUnitDeployed.bind(this)),
        svc.event.on(EVENT_NAMES.UnitDamaged,      this.onUnitDamaged.bind(this)),
        svc.event.on(EVENT_NAMES.UnitHealed,       this.onUnitHealed.bind(this)),
        svc.event.on(EVENT_NAMES.UnitMoved,        this.onUnitMoved.bind(this)),
        svc.event.on(EVENT_NAMES.UnitDied,         this.onUnitDied.bind(this)),
        svc.event.on(EVENT_NAMES.GeneralDamaged,   this.onGeneralDamaged.bind(this)),
        svc.event.on(EVENT_NAMES.GeneralSkillUsed, this.onGeneralSkillUsed.bind(this)),
        svc.event.on(EVENT_NAMES.TileBuffSpawned,  this.onTileBuffSpawned.bind(this)),
        svc.event.on(EVENT_NAMES.TileBuffConsumed, this.onTileBuffConsumed.bind(this)),
        svc.event.on(EVENT_NAMES.BattleEnded,      this.onBattleEnded.bind(this)),
        svc.event.on(EVENT_NAMES.UltimateSkillSelected, this._onUltimateSkillSelected.bind(this)),
      );
      this.refreshBattleViews();

      // 9. 監聯 ResultPopupComposite 的「再來一場」訊號
      this.resultPopup?.node.on("replay", this.onReplay, this);

      // 10. 監聽 deploy runtime / BattleLogPanel 的 UI 回合事件（驅動回合推進）
      this._deployPanelRuntime?.node.on('playerDeployed', this._onPlayerDeployed, this);
      this._deployPanelRuntime?.node.on('endTurn',        this._onEndTurn,        this);
      this.battleLogPanel?.node.on('endTurn',     this._onEndTurn,        this);
      this.battleScenePanel?.actionCommandComposite?.node.on('tactics', this._onTactics, this);
      input.on(Input.EventType.TOUCH_END, this._onGlobalBoardTouchEnd, this);
      input.on(Input.EventType.MOUSE_UP, this._onGlobalBoardMouseUp, this);
      input.on(Input.EventType.KEY_UP, this._onGlobalKeyUp, this);

      await this._signalCaptureReadyIfNeeded();

      console.log("[BattleScene] ✅ start() 全部完成");
    } catch (e) {
      console.error("[BattleScene] ❌ start() 發生錯誤:", e);
      this._signalCaptureErrorIfNeeded(e);
    }
  }

  onDestroy(): void {
    this.combatVisualQueue.length = 0;
    this.isDrainingCombatVisual = false;
    this.resultPopup?.node.off("replay", this.onReplay, this);
    this._deployPanelRuntime?.node.off('playerDeployed', this._onPlayerDeployed, this);
    this._deployPanelRuntime?.node.off('endTurn',        this._onEndTurn,        this);
    this.battleLogPanel?.node.off('endTurn',     this._onEndTurn,        this);
    this.battleScenePanel?.actionCommandComposite?.node.off('tactics', this._onTactics, this);
    input.off(Input.EventType.TOUCH_END, this._onGlobalBoardTouchEnd, this);
    input.off(Input.EventType.MOUSE_UP, this._onGlobalBoardMouseUp, this);
    input.off(Input.EventType.KEY_UP, this._onGlobalKeyUp, this);
    this.unsubs.forEach(fn => fn());
    this.unsubs.length = 0;
  }

  private _isBattleCaptureMode(): boolean {
    try {
      const globalScope = globalThis as any;
      const search = globalScope?.window?.location?.search as string | undefined;
      const query = new URLSearchParams(search ?? '');
      const queryMode = query.get('previewMode') ?? query.get('PREVIEW_MODE');
      const queryTarget = query.get('previewTarget') ?? query.get('PREVIEW_TARGET');

      let storedMode = '';
      let storedTarget = '';
      try {
        storedMode = globalScope?.window?.localStorage?.getItem('PREVIEW_MODE') ?? '';
        storedTarget = globalScope?.window?.localStorage?.getItem('PREVIEW_TARGET') ?? '';
      } catch {
        // localStorage 在部分 preview 環境可能不可用，不影響 query 判斷
      }

      const previewMode = queryMode === 'true' || queryMode === '1' || storedMode === 'true';
      const previewTarget = queryTarget ?? storedTarget;
      // target 5 = 直接 BattleScene preview；target 11 = BattleSceneFromLobby preview
      return previewMode && (previewTarget === '5' || previewTarget === '11');
    } catch {
      return false;
    }
  }

  /**
   * 統一解析戰場入口參數。
   * 優先讀 SceneManager 透傳的 data（Lobby 正式入口），
   * 若為空（Preview / capture / replay）則使用 DEFAULT_BATTLE_ENTRY_PARAMS。
   */
  private _resolveBattleParams(): BattleEntryParams {
    try {
      const sceneData = services().scene.getTargetScene()?.data;
      if (sceneData && typeof sceneData === 'object' && 'entrySource' in sceneData) {
        return sceneData as BattleEntryParams;
      }
    } catch {
      // SceneManager 可能尚未初始化（preview 直接 loadScene 場景時）
    }
    return { ...DEFAULT_BATTLE_ENTRY_PARAMS };
  }

  private _setBattleCaptureState(status: 'ready' | 'error', error?: unknown): void {
    const globalScope = globalThis as any;
    globalScope.__UI_CAPTURE_STATE__ = {
      status,
      screenId: 'battle-scene',
      timestamp: Date.now(),
      error: error ? String(error) : undefined,
    };

    try {
      globalScope?.window?.localStorage?.setItem(
        'UI_CAPTURE_STATE',
        JSON.stringify(globalScope.__UI_CAPTURE_STATE__),
      );
    } catch {
      // localStorage 不可用時略過，保留 window 全域訊號即可
    }
  }

  private async _signalCaptureReadyIfNeeded(): Promise<void> {
    if (!this._isBattleCaptureMode()) return;

    await new Promise<void>((resolve) => {
      this.scheduleOnce(() => resolve(), 0);
    });

    this._setBattleCaptureState('ready');
  }

  private _signalCaptureErrorIfNeeded(error: unknown): void {
    if (!this._isBattleCaptureMode()) return;
    this._setBattleCaptureState('error', error);
  }

  // ─── 事件處理 ─────────────────────────────────────────────────────────────

  private onTurnPhaseChanged(snap: { turn: number; playerFood: number }): void {
    this._deployPanelRuntime?.updateDp(snap.playerFood);
    this.battleLogPanel?.append(`回合更新：第 ${snap.turn} 回合，糧草 ${snap.playerFood}`);
    // 回合推進期間（敵方行動尚在播放）先不要切回玩家提示，避免「提早跳回合」體感。
    if (!this.isAdvancingTurn && !this.isDuelPanelActive) {
      this.boardRenderer?.setDeployHintFaction(Faction.Player);
      this.playTurnBanner(Faction.Player);
    }
    this._syncSceneGambitStatus();
    this.refreshBattleViews();
  }

  private onUnitDeployed(data: { unitId: string; faction: Faction; type: TroopType; lane: number }): void {
    // 部署後即時更新糧草顯示
    const snap = services().battle.getSnapshot();
    this.hud?.setFood(snap.playerFood, GAME_CONFIG.MAX_FOOD);
    this._deployPanelRuntime?.updateDp(snap.playerFood);
    const side = data.faction === Faction.Player ? "我方" : "敵方";
    this.battleLogPanel?.append(`${side}部署 ${troopName(data.type)}（路線 ${data.lane + 1}）`);
    if (data.faction === Faction.Player) {
      this._deployPanelRuntime?.showToast(`我方已部署 ${troopName(data.type)}（路線 ${data.lane + 1}）`);
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
    damageSource?: string;
  }): void {
    const unit = this.ctrl?.state.units.get(data.unitId);
    if (unit) {
      const side = unit.faction === Faction.Player ? "我方" : "敵方";
      const suffix = data.damageSource === 'night-raid-opening-strike'
        ? '（夜襲先制）'
        : data.damageSource
          ? `（${data.damageSource}）`
          : '';
      this.battleLogPanel?.append(`${side}${troopName(unit.type)} 受到 ${data.damage} 傷害${suffix}，剩餘 HP ${Math.max(0, data.hp)}`);

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
      this.battleLogPanel?.append(`${side}${troopName(unit.type)} 回復 ${data.amount}，目前 HP ${Math.max(0, data.hp)}`);
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
    forcedMove?: boolean;
    forcedMoveReason?: string;
  }): void {
    const unit = this.ctrl?.state.units.get(data.unitId);
    if (unit) {
      const side = unit.faction === Faction.Player ? "我方" : "敵方";
      if (data.swapWithUnitId) {
        this.battleLogPanel?.append(`${side}${troopName(unit.type)} 與友軍換位後推進到 L${data.lane + 1} D${data.depth}`);
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
      } else if (data.forcedMove) {
        this.battleLogPanel?.append(`${side}${troopName(unit.type)} 受地格影響位移到 L${data.lane + 1} D${data.depth}`);
        this.unitRenderer?.animateMove(unit, data.fromLane, data.fromDepth);
      } else if (!data.isSwapPassenger) {
        this.battleLogPanel?.append(`${side}${troopName(unit.type)} 前進到 L${data.lane + 1} D${data.depth}`);
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

  private onGeneralSkillUsed(data: { faction: Faction; skillId?: string; skillName?: string; sourceType?: SkillSourceType }): void {
    const skillId = data.skillId ?? data.skillName ?? null;
    if (!skillId) return;
    this.battleLogPanel?.append(buildBattleSkillUsedMessage(skillId, data.faction, data.sourceType));
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
    this.hud?.clearPersistentStatus();
    this.hud?.clearSceneGambitBadge();
    this.refreshBattleViews();
    this.combatVisualQueue.length = 0;
    this.isDrainingCombatVisual = false;
    // 禁用操作按鈕
    if (this._deployPanelRuntime) this._deployPanelRuntime.node.active = false;
  }

  private onReplay(): void {
    this.restartBattle();
  }

  private presentSceneGambitFeedback(): void {
    const ctrl = this.ctrl;
    if (!ctrl) return;

    const summary = this._buildSceneGambitSummary(ctrl.state.battleTactic);
    if (!summary) {
      this.hud?.clearPersistentStatus();
      this.hud?.clearSceneGambitBadge();
      return;
    }

    this.hud?.showPersistentStatus(`【${summary.label}】${summary.description}`);
    this.hud?.showSceneGambitBadge(summary.label);
    this.boardRenderer?.playSceneGambitPulse(ctrl.state, ctrl.state.battleTactic);
    const { label, description } = summary;
    this.battleLogPanel?.append(`【${label}】${description}`);
    this._deployPanelRuntime?.showToast(`${label}已生效`, 1.8);
  }

  private _syncSceneGambitStatus(): void {
    const ctrl = this.ctrl;
    if (!ctrl) return;

    const summary = this._buildSceneGambitSummary(ctrl.state.battleTactic);
    if (!summary) {
      this.hud?.clearPersistentStatus();
      this.hud?.clearSceneGambitBadge();
      return;
    }

    this.hud?.showPersistentStatus(`【${summary.label}】${summary.description}`);
    this.hud?.showSceneGambitBadge(summary.label);
  }

  private _buildSceneGambitSummary(battleTactic: BattleTactic): { label: string; description: string } | null {
    if (battleTactic === BattleTactic.Normal) {
      return null;
    }

    const labels: Record<string, string> = {
      [BattleTactic.FireAttack]: '火攻場勢',
      [BattleTactic.FloodAttack]: '水淹場勢',
      [BattleTactic.RockSlide]: '落石封路',
      [BattleTactic.AmbushAttack]: '森林伏兵',
      [BattleTactic.NightRaid]: '夜襲奇襲',
    };

    const descriptions: Record<string, string> = {
      [BattleTactic.FireAttack]: '中線火海已展開，停留其中的部隊會持續受傷。',
      [BattleTactic.FloodAttack]: '河道激流已成形，進入水域的部隊會被順流推移。',
      [BattleTactic.RockSlide]: '前方落石封鎖部分路線，部隊將被迫繞行。',
      [BattleTactic.AmbushAttack]: '前 2 回合我方伏兵隱匿，敵軍索敵會忽略我方潛伏單位。',
      [BattleTactic.NightRaid]: '前 2 回合夜襲生效：我方先制增傷，敵軍遠程視野受限。',
    };

    return {
      label: labels[battleTactic] ?? '場景戰法',
      description: descriptions[battleTactic] ?? '場景戰法已生效',
    };
  }

  private playTurnBanner(faction: Faction): void {
    // 全域去抖：避免短時間內被多個元件重複呼叫而導致重複提示
    const now = Date.now();
    const last = (globalThis as any).__lastTurnBannerTime ?? 0;
    if (now - last < 2500) return;
    (globalThis as any).__lastTurnBannerTime = now;

    const message = faction === Faction.Player ? "我方回合開始" : "敵方回合開始";
    const color = faction === Faction.Player
      ? new Color(90, 190, 255, 255)
      : new Color(255, 110, 110, 255);

    this._deployPanelRuntime?.showToast(message, 1.0, {
      color,
    });
  }

  // ─── 重新開局 ─────────────────────────────────────────────────────────────

  private async restartBattle(): Promise<void> {
    if (!this.ctrl) return;
    this.isAdvancingTurn = false;
    this.combatVisualQueue.length = 0;
    this.isDrainingCombatVisual = false;

    const encounter = await loadEncounter(this.currentEncounterId);
    const pgId = encounter?.playerGeneralId ?? "zhang-fei";
    const egId = encounter?.enemyGeneralId  ?? "lu-bu";
    const terrain: TerrainGrid | undefined = encounter?.terrain;

    const pg = await createGeneral(pgId, Faction.Player);
    const eg = await createGeneral(egId, Faction.Enemy);

    this.ctrl.initBattle(pg, eg, terrain, this._battleParams?.weather, this._battleParams?.battleTactic);

    if (this._deployPanelRuntime) {
      this._deployPanelRuntime.node.active = true;
    }
    this._deployPanelRuntime?.updateDp(GAME_CONFIG.INITIAL_FOOD);

    const snap = services().battle.getSnapshot();
    this.hud?.setPlayerGeneralId(pgId);
    this.hud?.setEnemyGeneralId(egId);
    this.hud?.setPlayerName(pg.name);
    this.hud?.setEnemyName(eg.name);
    this.hud?.refresh(
      snap.turn,
      snap.playerFood,
      GAME_CONFIG.MAX_FOOD,
      pg.currentHp,
      pg.maxHp,
      eg.currentHp,
      eg.maxHp,
    );
    this.battleLogPanel?.clear();
    this.battleLogPanel?.append(`重新開始：第 ${snap.turn} 回合，糧草 ${snap.playerFood}`);
    this.presentSceneGambitFeedback();
    this.boardRenderer?.setDeployHintFaction(Faction.Player);

    this.refreshBattleViews();
  }

  private getCanvasNode(): Node | null {
    return this.node.scene?.getChildByName("Canvas") ?? this.node.parent ?? null;
  }

  // ─── 回合推進（UI 事件驅動）──────────────────────────────────────────────

  private _onPlayerDeployed(): void {
    this._deployPanelRuntime?.showToast('部署完成，等待敵軍行動...', 1.8);
    this.scheduleOnce(() => this._onEndTurn(), 2.0);
  }

  private _onEndTurn(): void {
    if (!this.ctrl || this.isAdvancingTurn) return;
    this._cancelPendingSkillTargeting(false);

    this.battleLogPanel?.append('執行回合推進');
    this.isAdvancingTurn = true;
    this.boardRenderer?.setDeployHintFaction(Faction.Enemy);
    this.refreshBattleViews();

    // 安全保護：無論任何情況，20s 後強制解鎖（防止 scheduleOnce 衣喪失或其他意外）
    const gen = ++this._advanceTurnGeneration;
    this.scheduleOnce(() => {
      if (this.isAdvancingTurn && this._advanceTurnGeneration === gen) {
        console.warn('[BattleScene] isAdvancingTurn safety-reset（超時 20s），強制解鎖');
        this._doFinalizeAdvance();
      }
    }, 20);

    this._deployPanelRuntime?.showToast('敵軍思考中...', 2.0);
    this.scheduleOnce(() => {
      try {
        this.ctrl?.advanceTurn();
      } finally {
        // 原先的 2.3s 延遲仍保留作為最小等待時間，再進入排空輪詢
        this.scheduleOnce(() => this._pollFinalizeAdvance(0), 2.3);
      }
    }, 2.0);
  }

  private _onTactics(): void {
    if (!this.ctrl || this.isAdvancingTurn) return;

    const descriptor = this.ctrl.getPlayerSeedTacticDescriptor();
    if (!descriptor) {
      this._deployPanelRuntime?.showToast('尚未載入我方主將戰法', 1.5);
      return;
    }

    this._beginPlayerSkillFlow(descriptor.skillId, SkillSourceType.SeedTactic, '戰法');
  }

  private _onUltimateSkillSelected(data: { skillId?: string | null }): void {
    if (!this.ctrl || this.isAdvancingTurn) return;
    const skillId = data.skillId ?? null;
    if (!skillId) {
      this._deployPanelRuntime?.showToast('尚未配置可施放奧義', 1.5);
      return;
    }

    this._beginPlayerSkillFlow(skillId, SkillSourceType.Ultimate, '奧義');
  }

  /** 結束回合推進保護，切換回玩家回合 */
  private _doFinalizeAdvance(): void {
    this.isAdvancingTurn = false;
    this.playTurnBanner(Faction.Player);
    this.boardRenderer?.setDeployHintFaction(Faction.Player);
    this._syncSceneGambitStatus();
  }

  private _onGlobalBoardTouchEnd(ev: EventTouch): void {
    if (!this.pendingSkillTargeting) return;
    const loc = ev.getLocation();
    this._handleSkillTargetClick(loc.x, loc.y);
  }

  private _onGlobalBoardMouseUp(ev: EventMouse): void {
    if (!this.pendingSkillTargeting) return;
    const loc = ev.getLocation();
    this._handleSkillTargetClick(loc.x, loc.y);
  }

  private _onGlobalKeyUp(ev: EventKeyboard): void {
    if (!this.pendingSkillTargeting) return;
    if (ev.keyCode !== KeyCode.ESCAPE) return;
    this._cancelPendingSkillTargeting(true);
  }

  private _handleSkillTargetClick(screenX: number, screenY: number): void {
    if (!this.pendingSkillTargeting || !this.ctrl) return;
    const sourceLabel = this.pendingSkillTargeting.sourceType === SkillSourceType.Ultimate ? '奧義' : '戰法';

    const cell = this._raycastBoardCell(screenX, screenY);
    if (!cell) return;

    const stateCell = this.ctrl.state.getCell(cell.lane, cell.depth);
    const targetUnitId = stateCell?.occupantId ?? null;
    const targetUnit = targetUnitId ? this.ctrl.state.units.get(targetUnitId) ?? null : null;
    const targetMode = this.pendingSkillTargeting.targetMode;

    if (this._requiresEnemyUnitTarget(targetMode)) {
      if (!targetUnit || targetUnit.faction !== Faction.Enemy) {
        this._deployPanelRuntime?.showToast(`請點選敵方單位作為${sourceLabel}目標`, 1.5);
        return;
      }

      const didCast = this.ctrl.triggerPlayerBattleSkill(
        this.pendingSkillTargeting.skillId,
        this.pendingSkillTargeting.sourceType,
        {
          targetMode,
          targetUnitUid: targetUnit.id,
        },
      );
      if (!didCast) {
        this._deployPanelRuntime?.showToast(`${sourceLabel}發動失敗，請重新選擇目標`, 1.5);
        return;
      }

      this._deployPanelRuntime?.showToast(`${sourceLabel}已發動`, 1.2);
      this._cancelPendingSkillTargeting(false);
      this.refreshBattleViews();
      return;
    }

    const didCast = this.ctrl.triggerPlayerBattleSkill(
      this.pendingSkillTargeting.skillId,
      this.pendingSkillTargeting.sourceType,
      {
        targetMode,
        targetTileId: `${cell.lane},${cell.depth}`,
      },
    );
    if (!didCast) {
      this._deployPanelRuntime?.showToast(`${sourceLabel}發動失敗，請重新選擇格位`, 1.5);
      return;
    }

    this._deployPanelRuntime?.showToast(`${sourceLabel}已發動`, 1.2);
    this._cancelPendingSkillTargeting(false);
    this.refreshBattleViews();
  }

  private _requiresExplicitTarget(skillId: string, targetMode: BattleSkillTargetMode): boolean {
    if (!requiresBattleSkillManualTargeting(skillId)) {
      return false;
    }

    return [
      BattleSkillTargetMode.EnemySingle,
      BattleSkillTargetMode.Line,
      BattleSkillTargetMode.Fan,
      BattleSkillTargetMode.Area,
      BattleSkillTargetMode.Tile,
      BattleSkillTargetMode.AdjacentTiles,
    ].includes(targetMode);
  }

  private _requiresEnemyUnitTarget(targetMode: BattleSkillTargetMode): boolean {
    return [
      BattleSkillTargetMode.EnemySingle,
      BattleSkillTargetMode.Line,
      BattleSkillTargetMode.Fan,
    ].includes(targetMode);
  }

  private _buildTargetingPrompt(skillId: string, targetMode: BattleSkillTargetMode): string {
    const baseName = getBattleSkillPresentation(skillId).name;
    switch (targetMode) {
      case BattleSkillTargetMode.EnemySingle:
        return `請點選敵方單位施放 ${baseName}，按 Esc 取消`;
      case BattleSkillTargetMode.Line:
        return `請點選直線錨點敵軍施放 ${baseName}，按 Esc 取消`;
      case BattleSkillTargetMode.Fan:
        return `請點選扇形中心敵軍施放 ${baseName}，按 Esc 取消`;
      case BattleSkillTargetMode.Area:
        return `請點選範圍中心格位施放 ${baseName}，按 Esc 取消`;
      case BattleSkillTargetMode.Tile:
        return `請點選目標格位施放 ${baseName}，按 Esc 取消`;
      case BattleSkillTargetMode.AdjacentTiles:
        return `請點選相鄰範圍中心格位施放 ${baseName}，按 Esc 取消`;
      default:
        return `請點選目標格位施放 ${baseName}，按 Esc 取消`;
    }
  }

  private _cancelPendingSkillTargeting(showToast: boolean): void {
    if (!this.pendingSkillTargeting) return;
    this.pendingSkillTargeting = null;
    this.boardRenderer?.clearSkillPreview();
    this.refreshBattleViews();
    if (showToast) {
      this._deployPanelRuntime?.showToast('已取消技能選目標', 1.2);
    }
  }

  private _beginPlayerSkillFlow(skillId: string, sourceType: SkillSourceType, sourceLabel: string): void {
    if (!this.ctrl) return;
    const general = this.ctrl.state.playerGeneral;
    if (!general?.canUseSkill()) {
      this._deployPanelRuntime?.showToast(`${sourceLabel}蓄力中，SP 不足`, 1.5);
      return;
    }

    if (this.pendingSkillTargeting?.skillId === skillId && this.pendingSkillTargeting.sourceType === sourceType) {
      this._cancelPendingSkillTargeting(true);
      return;
    }

    const targetMode = resolveBattleSkillTargetMode(skillId, BattleSkillTargetMode.EnemyAll);
    if (!this._requiresExplicitTarget(skillId, targetMode)) {
      const didCast = this.ctrl.triggerPlayerBattleSkill(skillId, sourceType, { targetMode });
      if (didCast) {
        this._deployPanelRuntime?.showToast(`${sourceLabel}已發動`, 1.2);
        this.refreshBattleViews();
      } else {
        this._deployPanelRuntime?.showToast(`${sourceLabel}發動失敗`, 1.5);
      }
      return;
    }

    this.pendingSkillTargeting = { skillId, sourceType, targetMode };
    this._syncPendingSkillPreview();
    this._deployPanelRuntime?.showToast(this._buildTargetingPrompt(skillId, targetMode), 2.4);
    this.battleLogPanel?.append(buildBattleSkillAimingMessage(skillId, sourceType));
  }

  private _syncPendingSkillPreview(): void {
    if (!this.pendingSkillTargeting || !this.ctrl) {
      this.boardRenderer?.clearSkillPreview();
      return;
    }

    const previewCells = this._requiresEnemyUnitTarget(this.pendingSkillTargeting.targetMode)
      ? this.ctrl.state.units
          ? Array.from(this.ctrl.state.units.values())
              .filter((unit) => unit.faction === Faction.Enemy && !unit.isDead())
              .map((unit) => ({ lane: unit.lane, depth: unit.depth }))
          : []
      : this._getAllBoardCells();
    this.boardRenderer?.setSkillPreviewCells(previewCells);
    this.refreshBattleViews();
  }

  private _getAllBoardCells(): Array<{ lane: number; depth: number }> {
    const cells: Array<{ lane: number; depth: number }> = [];
    for (let lane = 0; lane < GAME_CONFIG.GRID_LANES; lane++) {
      for (let depth = 0; depth < GAME_CONFIG.GRID_DEPTH; depth++) {
        cells.push({ lane, depth });
      }
    }
    return cells;
  }

  /**
   * 輪詢等待戰鬥視覺佇列排空，再解除 isAdvancingTurn。
   * 若決鬥面板尚開著，延後重試而非直接 return（修復原本 isDuelPanelActive 鎖死的 bug）。
   */
  private _pollFinalizeAdvance(attempts: number): void {
    // 決鬥面板開著時排隊等待，而非直接 return 造成旗標永久卡死
    if (this.isDuelPanelActive) {
      this.scheduleOnce(() => this._pollFinalizeAdvance(attempts), 0.5);
      return;
    }

    const maxAttempts = 12; // 最多等待 12 × 0.5s = 6s
    if (!this.isDrainingCombatVisual || attempts >= maxAttempts) {
      // 視覺排空，或已達上限強制解鎖（避免長時間鎖死互動）
      this._doFinalizeAdvance();
      return;
    }

    this.scheduleOnce(() => this._pollFinalizeAdvance(attempts + 1), 0.5);
  }

  // ─── 拖曳部署射線偵測 ────────────────────────────────────────────────────

  /**
   * DeployPanel 拖曳放手後呼叫：螢幕座標 → 3D 射線 → 格子部署。
   * 映射自 TurnFlowManager.doDeployRaycast，使用 BattleScene 自身欄位。
   */
  private _doDeployRaycast(screenX: number, screenY: number): void {
    if (this.isAdvancingTurn) return;

    if (this.pendingSkillTargeting) {
      this._handleSkillTargetClick(screenX, screenY);
      return;
    }

    const firstCell = this._raycastBoardCell(screenX, screenY);
    if (!firstCell) return;

    if (this.ctrl?.isWaitingDuelPlacement) {
      const cell = firstCell;
      if (cell.depth < 0 || cell.depth >= GAME_CONFIG.GRID_DEPTH) return;
      const stateCell = this.ctrl.state.getCell(cell.lane, cell.depth);
      if (stateCell?.occupantId) { this._deployPanelRuntime?.showToast('無法在後方部署', 1.2); return; }
      const unit = this.ctrl.placeGeneralOnBoard(cell.lane, cell.depth);
      if (unit) {
        this._deployPanelRuntime?.showToast('武將出陣！全軍攻擊力加倍！');
        this.battleLogPanel?.append(`我方武將出陣至 L${cell.lane + 1} D${cell.depth}`);
        this.refreshBattleViews();
        this.unitRenderer?.playDeploy(unit);
      }
      return;
    }

    if (firstCell.depth === 0) {
      this._deployPanelRuntime?.selectLane(firstCell.lane);
    }
  }

  private _raycastBoardCell(screenX: number, screenY: number): { lane: number; depth: number } | null {

    const cam = this.getMainCamera();
    if (!cam) {
      console.warn('[BattleScene] _doDeployRaycast: boardCamera 為 null，請確認 setupCameraForBoard() 已執行');
      return;
    }

    const corrected = this.normalizeGameCanvasPoint(screenX, screenY);
    const ray = new geometry.Ray();
    const raycastCell = (x: number, y: number): { lane: number; depth: number } | null => {
      cam.screenPointToRay(x, y, ray);

      if (Math.abs(ray.d.y) < 0.0001) return null;
      const t = -ray.o.y / ray.d.y;
      if (t < 0) return null;

      const hitPoint = new Vec3();
      Vec3.scaleAndAdd(hitPoint, ray.o, ray.d, t);
      return (this.boardRenderer as any)?.getCellFromWorldPos?.(hitPoint) ?? null;
    };

    const candidates: Array<{ lane: number; depth: number } | null> = [];
    candidates.push(raycastCell(screenX, screenY));
    if (Math.abs(corrected.x - screenX) > 0.01 || Math.abs(corrected.y - screenY) > 0.01) {
      candidates.push(raycastCell(corrected.x, corrected.y));
    }

    return candidates.find((cell) => !!cell) ?? null;
  }

  private getMainCamera(): Camera | null {
    const camNode = this.node.scene?.getChildByName("Main Camera");
    return camNode?.getComponent(Camera) ?? null;
  }

  private normalizeGameCanvasPoint(screenX: number, screenY: number): { x: number; y: number } {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return { x: screenX, y: screenY };
    }

    const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement | null;
    if (!canvas) {
      return { x: screenX, y: screenY };
    }

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return { x: screenX, y: screenY };
    }

    const isCropped = rect.left < -0.5 || rect.top < -0.5;
    const isScaled = Math.abs(rect.width - canvas.width) > 0.5 || Math.abs(rect.height - canvas.height) > 0.5;
    if (!isCropped && !isScaled) {
      return { x: screenX, y: screenY };
    }

    const localX = (screenX - rect.left);
    const localY = (screenY - rect.top);
    const clampedX = Math.max(0, Math.min(localX, rect.width));
    const clampedY = Math.max(0, Math.min(localY, rect.height));

    const scaleX = rect.width > 0 ? (canvas.width / rect.width) : 1;
    const scaleY = rect.height > 0 ? (canvas.height / rect.height) : 1;
    const vp = view.getViewportRect();

    return {
      x: vp.x + clampedX * scaleX,
      y: vp.y + clampedY * scaleY,
    };
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
    if (pg && this._deployPanelRuntime) {
      this._deployPanelRuntime?.updateSkillStatus(pg.canUseSkill());
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
}
