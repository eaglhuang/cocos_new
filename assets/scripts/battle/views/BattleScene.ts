// @spec-source → 見 docs/cross-reference-index.md
import { _decorator, Component, Label, Node, Vec3, geometry } from "cc";
import {
  Faction,
  GAME_CONFIG,
  BattleTactic,
} from "../../core/config/Constants";
import { services } from "../../core/managers/ServiceLoader";
import { BattleEntryParams, DEFAULT_BATTLE_ENTRY_PARAMS, formatBattleEntryLog } from '../models/BattleEntryParams';
import { GeneralUnit } from "../../core/models/GeneralUnit";
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
import { Camera, view } from "cc";
import { loadDamageFonts, prewarmVfxPools, prewarmBattleAudioClips, loadEncounter, createGeneral, buildTallyCards, buildUltimateSkills, buildTacticSummary, loadBattleSkillMetadata } from './BattleSceneLoader';
import { BattleSkillTargetingFlow } from './BattleSkillTargetingFlow';
import { BattleSceneFlow } from './BattleSceneFlow';
import { BattleUIBridge, createBattleSceneContext } from './BattleUIBridge';
import { TurnFlowManager } from './TurnFlowManager';
import { setupCameraForBoard, initSceneBackground, addBackgroundSwitchUI, resolveSceneBackgroundId } from './BattleSceneSetup';
import { ensureDeployPanelRuntime, ensureHUD, ensureBattleLogPanel, ensureBattleScenePanel, ensureBoardRenderer, ensureUnitRenderer } from './BattleUIInitializer';

const { ccclass, property } = _decorator;


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
  /** 當前遭遇戰 ID（用於重開時保持同一關卡） */
  private currentEncounterId = "encounter-001";
  /** 本次戰場入口參數（啟動後不變） */
  private _battleParams: BattleEntryParams | null = null;
  /** 場景背景管理元件 */
  private sceneBackground: SceneBackground | null = null;
  private deployRuntime: DeployRuntimeApi | null = null;
  private skillTargetingFlow: BattleSkillTargetingFlow | null = null;
  private readonly sceneContext = createBattleSceneContext();
  private battleUIBridge: BattleUIBridge | null = null;
  private turnFlowManager: TurnFlowManager | null = null;
  private sceneFlow: BattleSceneFlow | null = null;

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
          prewarmBattleAudioClips(),
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
      this.sceneContext.hud = this.hud;
      this.sceneContext.deployRuntime = this._deployPanelRuntime;
      this.sceneContext.battleLogPanel = this.battleLogPanel;
      this.sceneContext.battleScenePanel = this.battleScenePanel;
      this.sceneContext.boardRenderer = this.boardRenderer;
      this.sceneContext.unitRenderer = this.unitRenderer;
      this.sceneContext.resultPopup = this.resultPopup;
      this.sceneContext.duelChallengePanel = this.duelChallengePanel;
      this.sceneContext.ctrl = this.ctrl;
      this.sceneContext.pg = pg;
      this.sceneContext.eg = eg;
      this.sceneContext.boardCamera = this.getMainCamera();
      this.sceneContext.raycastBoardCell = (screenX, screenY) => this._raycastBoardCell(screenX, screenY);
      this.skillTargetingFlow = new BattleSkillTargetingFlow({
        getCtrl: () => this.ctrl,
        clearBoardSkillPreview: () => this.boardRenderer?.clearSkillPreview(),
        setBoardSkillPreviewCells: (cells) => this.boardRenderer?.setSkillPreviewCells(cells),
        showToast: (msg, duration) => this._deployPanelRuntime?.showToast(msg, duration),
        appendBattleLog: (text) => this.battleLogPanel?.append(text),
        raycastBoardCell: (screenX, screenY) => this._raycastBoardCell(screenX, screenY),
        refreshBattleViews: () => this.refreshBattleViews(),
      });
      this.sceneContext.skillTargetingFlow = this.skillTargetingFlow;
      this.battleUIBridge = new BattleUIBridge(this.sceneContext, this);
      this.turnFlowManager = new TurnFlowManager(this.sceneContext, this, this.battleUIBridge);
      this.sceneFlow = new BattleSceneFlow({
        getCtrl: () => this.ctrl,
        getBattleParams: () => this._battleParams,
        getCurrentEncounterId: () => this.currentEncounterId,
        getDeployRuntime: () => this._deployPanelRuntime,
        getHUD: () => this.hud,
        getBattleLogPanel: () => this.battleLogPanel,
        getBoardRenderer: () => this.boardRenderer,
        setPlayerGeneral: (unit) => {
          this._pg = unit;
          this.sceneContext.pg = unit;
        },
        setEnemyGeneral: (unit) => {
          this._eg = unit;
          this.sceneContext.eg = unit;
        },
        refreshBattleViews: () => this.refreshBattleViews(),
        setIsAdvancingTurn: (next) => { this.sceneContext.isAdvancingTurn = next; },
        getIsAdvancingTurn: () => this.sceneContext.isAdvancingTurn,
        setIsDrainingCombatVisual: (next) => { this.sceneContext.isDrainingCombatVisual = next; },
        clearCombatVisualQueue: () => { this.sceneContext.combatVisualQueue.length = 0; },
        cancelPendingSkillTargeting: (showToast) => this.skillTargetingFlow?.cancelPendingSkillTargeting(showToast),
      });

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
      this.sceneContext.unitRenderer = this.unitRenderer;
      this.sceneContext.boardCamera = this.getMainCamera();
      console.log(`[BattleScene] unitRenderer 已連結: ${!!this.unitRenderer}`);

      this._deployPanelRuntime?.setController(this.ctrl);
      this._deployPanelRuntime?.registerDragDropCallback((screenX, screenY) => this.turnFlowManager?.doDeployRaycast(screenX, screenY));
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
      this.battleUIBridge?.subscribeEvents({
        onEndTurn: () => this._onEndTurn(),
        onPlayerDeployed: () => this._onPlayerDeployed(),
        onTactics: () => this._onTactics(),
        onGeneralDuelRequest: () => this._onGeneralDuelRequest(),
        onReplay: () => this.onReplay(),
      });
      this.refreshBattleViews();

      await this._signalCaptureReadyIfNeeded();

      console.log("[BattleScene] ✅ start() 全部完成");
    } catch (e) {
      console.error("[BattleScene] ❌ start() 發生錯誤:", e);
      this._signalCaptureErrorIfNeeded(e);
    }
  }

  onDestroy(): void {
    this.sceneContext.combatVisualQueue.length = 0;
    this.sceneContext.isDrainingCombatVisual = false;
    this.sceneContext.isAdvancingTurn = false;
    this.sceneContext.isDuelPanelActive = false;
    this.skillTargetingFlow?.cancelPendingSkillTargeting(false);
    this.battleUIBridge?.unsubscribeEvents();
    this.sceneContext.skillTargetingFlow = null;
    this.sceneContext.raycastBoardCell = null;
    this.battleUIBridge = null;
    this.turnFlowManager = null;
    this.sceneFlow = null;
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

  private onReplay(): void {
    this.sceneFlow?.onReplay();
  }

  private presentSceneGambitFeedback(): void {
    this.sceneFlow?.presentSceneGambitFeedback();
  }

  private _syncSceneGambitStatus(): void {
    this.sceneFlow?.syncSceneGambitStatus();
  }

  private playTurnBanner(faction: Faction): void {
    this.sceneFlow?.playTurnBanner(faction);
  }

  // ─── 重新開局 ─────────────────────────────────────────────────────────────

  private async restartBattle(): Promise<void> {
    await this.sceneFlow?.restartBattle();
  }

  private getCanvasNode(): Node | null {
    return this.node.scene?.getChildByName("Canvas") ?? this.node.parent ?? null;
  }

  // ─── 回合推進（UI 事件驅動）──────────────────────────────────────────────

  private _onPlayerDeployed(): void {
    this.turnFlowManager?.onPlayerDeployed();
  }

  private _onEndTurn(): void {
    this.turnFlowManager?.onEndTurn();
  }

  private _onTactics(): void {
    this.turnFlowManager?.onTactics();
  }

  private _onGeneralDuelRequest(): void {
    this.turnFlowManager?.onGeneralDuelRequest();
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

