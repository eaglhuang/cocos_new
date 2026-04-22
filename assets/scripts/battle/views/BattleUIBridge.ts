/**
 * BattleUIBridge.ts — 戰鬥 UI 連結器
 *
 * [P3-R2] 從 BattleScene.ts 抽取的 UI 事件訂閱與 UI 更新職責。
 * BattleScene 作為高層協調器，建立 BattleUIBridge 後透過它訂閱所有遊戲事件並驅動 UI 更新，
 * 不再需要在 BattleScene 中直接實作 700+ 行的 UI 事件處理邏輯。
 *
 * Unity 對照：BattleUIManager (Canvas 根的 Coordinator Component)
 *             + UIEventHandler (純事件轉接，無業務邏輯)
 */

import { Color, Component, EventKeyboard, EventMouse, EventTouch, Input, KeyCode, Node, input } from 'cc';
import { EVENT_NAMES, Faction, GAME_CONFIG, SP_PER_KILL, TroopType, TurnPhase } from '../../core/config/Constants';
import { services } from '../../core/managers/ServiceLoader';
import { GeneralUnit } from '../../core/models/GeneralUnit';
import { BattleController } from '../controllers/BattleController';
import { BattleScenePanel } from '../../ui/components/BattleScenePanel';
import type { DeployRuntimeLike } from '../../ui/components/DeployRuntimeApi';
import { UCUFLogger, LogCategory } from '../../ui/core/UCUFLogger';
import { BATTLE_TURN_FLOW_TIMING, BATTLE_VISUAL_TIMING } from './BattlePresentationTiming';
import { buildBattleSkillUsedMessage } from '../skills/BattleSkillPresentation';
import { SkillSourceType } from '../../shared/SkillRuntimeContract';
import {
  BATTLE_FLOW_FX,
  playBattleFlowEffectAtBoardCenter,
  playBattleFlowEffectAtCell,
  resolveBattleGeneralSkillEffectKey,
  resolveBattleResultEffectKey,
  resolveBattleUnitHitEffectKey,
} from './BattleFlowVfx';
import {
  playBattleAudio,
  resolveBattleGeneralAttackSfxKey,
  resolveBattleGeneralHitSfxKey,
  resolveBattleUnitAttackSfxKey,
  resolveBattleUnitHitSfxKey,
  type BattleAudioCue,
} from '../shared/BattleAudio';

// ── 型別補充 ─────────────────────────────────────────────────────────────────
// boardRenderer / unitRenderer 使用 any 以解耦 3D 渲染模組（可後續換強型別）
type BoardRenderer  = any;
type UnitRenderer   = any;

interface CombatVisualTask {
  id: number;
  label: string;
  run: () => Promise<void> | void;
}

export interface BattleHUDLike {
  node: Node;
  setFood?: (current: number, max: number) => void;
  setPlayerGeneralId?: (generalId: string) => void;
  setEnemyGeneralId?: (generalId: string) => void;
  setPlayerName?: (name: string) => void;
  setEnemyName?: (name: string) => void;
  refresh?: (...args: unknown[]) => void;
  waitUntilReady?: (timeoutMs?: number) => Promise<boolean>;
  playerSpBarNode?: Node | null;
  enemySpBarNode?: Node | null;
  clearPersistentStatus?: () => void;
  clearSceneGambitBadge?: () => void;
}

export interface BattleLogLike {
  node: Node;
  clear?: () => void;
  append?: (text: string) => void;
  waitUntilReady?: (timeoutMs?: number) => Promise<boolean>;
}

export interface DuelChallengeLike {
  node: Node;
  show?: (challengerName: string, defenderName: string, defenderWinRate: number) => void;
  waitUntilReady?: (timeoutMs?: number) => Promise<boolean>;
}

export interface ResultPopupLike {
  node: Node;
  showResult?: (result: string) => Promise<void>;
  show?: (result: unknown) => Promise<void>;
  hide?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// 共享可變 Context：BattleScene 建立、Bridge 與 TurnFlowManager 共同讀寫
// ─────────────────────────────────────────────────────────────────────────────

export interface BattleSceneContext {
  hud:               BattleHUDLike | null;
  deployRuntime:     DeployRuntimeLike | null;
  battleLogPanel:    BattleLogLike | null;
  battleScenePanel:  BattleScenePanel | null;
  boardRenderer:     BoardRenderer | null;
  unitRenderer:      UnitRenderer | null;
  resultPopup:       ResultPopupLike | null;
  duelChallengePanel: DuelChallengeLike | null;
  ctrl:              BattleController | null;
  pg:                GeneralUnit | null;
  eg:                GeneralUnit | null;
  isAdvancingTurn:   boolean;
  isDuelPanelActive: boolean;
  combatVisualQueue: CombatVisualTask[];
  isDrainingCombatVisual: boolean;
  combatVisualTaskId: number;
  skillTargetingFlow?: {
    isPending: boolean;
    beginPlayerSkillFlow(skillId: string, sourceType: SkillSourceType, sourceLabel: string): void;
    handleSkillTargetClick(screenX: number, screenY: number): void;
    cancelPendingSkillTargeting(showToast: boolean): void;
  } | null;
  raycastBoardCell?: ((screenX: number, screenY: number) => { lane: number; depth: number } | null) | null;
  /**
   * 3D 主攝影機（setupCameraForBoard 後設置）。
   * 用 any 避免在 Bridge 裡 import Camera 模組，也防止 Cocos minifier
   * 混淆 BattleScene 私有方法名稱導致射線偵測靜默失敗。
   */
  boardCamera: any | null;
}

/** 建立空白的 BattleSceneContext（BattleScene 在 start() 前使用） */
export function createBattleSceneContext(): BattleSceneContext {
  return {
    hud: null, deployRuntime: null, battleLogPanel: null,
    battleScenePanel: null, boardRenderer: null, unitRenderer: null,
    resultPopup: null, duelChallengePanel: null,
    ctrl: null, pg: null, eg: null,
    isAdvancingTurn: false, isDuelPanelActive: false,
    combatVisualQueue: [], isDrainingCombatVisual: false,
    combatVisualTaskId: 0,
    boardCamera: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export class BattleUIBridge {
  private readonly unsubs: (() => void)[] = [];

  constructor(
    private readonly ctx: BattleSceneContext,
    /** 用於 scheduleOnce，需傳入 BattleScene Component 本身 */
    private readonly scene: Component,
  ) {}

  // ── 事件訂閱 ─────────────────────────────────────────────────────────────

  /**
   * 訂閱所有全局遊戲事件並更新 UI。
   * @param externalHandlers 由 TurnFlowManager 提供的回合/部署處理器
   */
  public subscribeEvents(externalHandlers: {
    onEndTurn:      () => void;
    onPlayerDeployed: () => void;
    onTactics:      () => void;
    onGeneralDuelRequest: () => void;
    onReplay:       () => void;
  }): void {
    this.unsubscribeEvents();
    const svc = services();
    const c = this.ctx;
    const actionCommandNode = (c.battleScenePanel?.actionCommandComposite ?? c.battleScenePanel?.actionCommandPanel)?.node ?? null;
    const bindNodeEvent = (node: Node | null | undefined, eventName: string, handler: (...args: any[]) => void): void => {
      if (!node) return;
      node.on(eventName, handler, this.scene);
      this.unsubs.push(() => node.off(eventName, handler, this.scene));
    };

    this.unsubs.push(
      svc.event.on(EVENT_NAMES.TurnPhaseChanged,        this._onTurnPhaseChanged.bind(this)),
      svc.event.on(EVENT_NAMES.UnitDeployed,            this._onUnitDeployed.bind(this)),
      svc.event.on(EVENT_NAMES.UnitDamaged,             this._onUnitDamaged.bind(this)),
      svc.event.on(EVENT_NAMES.UnitHealed,              this._onUnitHealed.bind(this)),
      svc.event.on(EVENT_NAMES.UnitMoved,               this._onUnitMoved.bind(this)),
      svc.event.on(EVENT_NAMES.UnitDied,                this._onUnitDied.bind(this)),
      svc.event.on(EVENT_NAMES.GeneralDamaged,          this._onGeneralDamaged.bind(this)),
      svc.event.on(EVENT_NAMES.GeneralSkillUsed,        this._onGeneralSkillUsed.bind(this)),
      svc.event.on(EVENT_NAMES.TileBuffSpawned,         this._onTileBuffSpawned.bind(this)),
      svc.event.on(EVENT_NAMES.TileBuffConsumed,        this._onTileBuffConsumed.bind(this)),
      svc.event.on(EVENT_NAMES.BattleEnded,             this._onBattleEnded.bind(this)),
      svc.event.on(EVENT_NAMES.RequestGeneralQuickView, this._onRequestGeneralQuickView.bind(this)),
      svc.event.on(EVENT_NAMES.UltimateSkillSelected,   this._onUltimateSkillSelected.bind(this)),
    );

    // 節點事件：由 TurnFlowManager 回呼轉接
    bindNodeEvent(c.deployRuntime?.node, 'endTurn', externalHandlers.onEndTurn);
    bindNodeEvent(c.deployRuntime?.node, 'playerDeployed', externalHandlers.onPlayerDeployed);
    bindNodeEvent(c.battleLogPanel?.node, 'endTurn', externalHandlers.onEndTurn);
    bindNodeEvent(c.battleLogPanel?.node, 'tactics', externalHandlers.onTactics);
    bindNodeEvent(actionCommandNode, 'endTurn', externalHandlers.onEndTurn);
    bindNodeEvent(actionCommandNode, 'tactics', externalHandlers.onTactics);
    bindNodeEvent(c.resultPopup?.node, 'replay', externalHandlers.onReplay);
    bindNodeEvent(c.deployRuntime?.node, 'generalDuel', externalHandlers.onGeneralDuelRequest);
    input.on(Input.EventType.TOUCH_END, this._onGlobalBoardTouchEnd, this);
    this.unsubs.push(() => input.off(Input.EventType.TOUCH_END, this._onGlobalBoardTouchEnd, this));
    input.on(Input.EventType.MOUSE_UP, this._onGlobalBoardMouseUp, this);
    this.unsubs.push(() => input.off(Input.EventType.MOUSE_UP, this._onGlobalBoardMouseUp, this));
    input.on(Input.EventType.KEY_UP, this._onGlobalKeyUp, this);
    this.unsubs.push(() => input.off(Input.EventType.KEY_UP, this._onGlobalKeyUp, this));
  }

  public unsubscribeEvents(): void {
    this.unsubs.forEach(fn => fn());
    this.unsubs.length = 0;
  }

  // ── 公開 UI 更新 API（供 TurnFlowManager 呼叫）────────────────────────────

  public refreshBattleViews(): void {
    const c = this.ctx;
    if (!c.ctrl) return;
    const state = c.ctrl.state;
    // 棋盤格狀態與兵種渲染（對應原 BattleScene.refreshBattleViews）
    c.boardRenderer?.renderState(state);
    c.unitRenderer?.renderState(state);
    // 更新 deploy runtime 的技能可發動狀態
    const pg = state.playerGeneral;
    if (pg && c.deployRuntime) {
      c.deployRuntime.updateSkillStatus(pg.canUseSkill() && c.ctrl.canUsePlayerSkills());
    }
  }

  public playTurnBanner(faction: Faction): void {
    // 全域去抖：避免短時間內被多個元件重複呼叫而導致重複提示
    const now = Date.now();
    const last = (globalThis as any).__lastTurnBannerTime ?? 0;
    if (now - last < BATTLE_TURN_FLOW_TIMING.turnBannerDebounceMs) return;
    (globalThis as any).__lastTurnBannerTime = now;

    const message = faction === Faction.Player ? '我方回合開始' : '敵方回合開始';
    const color   = faction === Faction.Player
      ? new Color(90, 190, 255, 255) : new Color(255, 110, 110, 255);
    this.ctx.deployRuntime?.showToast(message, BATTLE_TURN_FLOW_TIMING.turnBannerToastSec, { color });
  }

  public appendLog(text: string): void {
    if (this.ctx.battleScenePanel) {
      this.ctx.battleScenePanel.appendLog(text);
      return;
    }
    this.ctx.battleLogPanel?.append(text);
  }

  public showEnemyThinkingPanel(): void {
    const acPanel = (this.ctx.battleScenePanel?.actionCommandComposite ?? this.ctx.battleScenePanel?.actionCommandPanel) as any;
    acPanel?.showEnemyThinking?.();
  }

  public hideEnemyThinkingPanel(): void {
    const acPanel = (this.ctx.battleScenePanel?.actionCommandComposite ?? this.ctx.battleScenePanel?.actionCommandPanel) as any;
    acPanel?.hideEnemyThinking?.();
  }

  private _scheduleBattleAudio(cue: BattleAudioCue, delaySec = 0): Promise<void> {
    return new Promise((resolve) => {
      if (delaySec <= 0) {
        playBattleAudio(cue);
        resolve();
        return;
      }

      this.scene.scheduleOnce(() => {
        playBattleAudio(cue);
        resolve();
      }, delaySec);
    });
  }

  private _scheduleBattleUnitHitFeedback(lane: number, depth: number, damageSource?: string): Promise<void> {
    const hitAudioKey = resolveBattleUnitHitSfxKey(damageSource);
    const hitEffectKey = resolveBattleUnitHitEffectKey(damageSource);

    return new Promise((resolve) => {
      if (BATTLE_VISUAL_TIMING.recoilStartDelaySec <= 0) {
        playBattleAudio(hitAudioKey);
        playBattleFlowEffectAtCell(services().effect, this.ctx.boardRenderer, hitEffectKey, lane, depth, 0.9, 0.12);
        resolve();
        return;
      }

      this.scene.scheduleOnce(() => {
        playBattleAudio(hitAudioKey);
        playBattleFlowEffectAtCell(services().effect, this.ctx.boardRenderer, hitEffectKey, lane, depth, 0.9, 0.12);
        resolve();
      }, BATTLE_VISUAL_TIMING.recoilStartDelaySec);
    });
  }


  // ── 私有事件處理（對應 BattleScene 原有 on* 方法）─────────────────────────

  private _onTurnPhaseChanged(snap: { turn: number; playerFood: number; phase?: TurnPhase }): void {
    const c = this.ctx;
    c.deployRuntime?.updateDp(snap.playerFood);
    this.appendLog(`回合更新：第 ${snap.turn} 回合，糧草 ${snap.playerFood}`);
    // 若仍在回合推進或單挑面板開啟中，暫時不要顯示我方回合提示或切回 deployHint
    if (!c.isAdvancingTurn && !c.isDuelPanelActive) {
      c.boardRenderer?.setDeployHintFaction(Faction.Player);
      this.playTurnBanner(Faction.Player);
    }
    this.refreshBattleViews();
  }

  private _onUnitDeployed(data: { unitId: string; faction: Faction; type: TroopType; lane: number; unitName?: string }): void {
    const c = this.ctx;
    const snap = services().battle.getSnapshot();
    c.hud?.setFood(snap.playerFood, GAME_CONFIG.MAX_FOOD);
    c.deployRuntime?.updateDp(snap.playerFood);
    const side = data.faction === Faction.Player ? '我方' : '敵方';
    const unitName = data.unitName?.trim() || this.toTroopName(data.type);
    this.appendLog(`${side}部署 ${unitName}（路線 ${data.lane + 1}）`);
    if (data.faction === Faction.Player) {
      c.boardRenderer?.clearDeployHint();
      c.deployRuntime?.showToast(`我方已部署 ${unitName}（路線 ${data.lane + 1}）`);
    }
    this.refreshBattleViews();
    const unit = c.ctrl?.state.units.get(data.unitId) ?? null;
    c.unitRenderer?.playDeploy(unit);
  }

  private _onUnitDamaged(data: {
    unitId: string; damage: number; hp: number;
    attackerId: string | null; attackerLane: number | null; attackerDepth: number | null;
    defenderLane: number | null; defenderDepth: number | null; attackerFaction: Faction | null;
    damageSource?: string;
  }): void {
    const c = this.ctx;
    const unit = c.ctrl?.state.units.get(data.unitId);
    if (unit) {
      const side = unit.faction === Faction.Player ? '我方' : '敵方';
      const suffix = data.damageSource === 'night-raid-opening-strike'
        ? '（夜襲先制）'
        : data.damageSource
          ? `（${data.damageSource}）`
          : '';
      this.appendLog(`${side}${unit.name} 受到 ${data.damage} 傷害${suffix}，剩餘 HP ${Math.max(0, data.hp)}`);
      this._enqueueCombatVisual(`unit-damage:${data.unitId}`, async () => {
        UCUFLogger.debug(LogCategory.LIFECYCLE, `[BattleUIBridge][CombatVisual] unit-damage start unit=${data.unitId}`);
        const isRiverBoundaryDamage = typeof data.damageSource === 'string' && data.damageSource.startsWith('river-current:');
        const attackerUnit = data.attackerId ? c.ctrl?.state.units.get(data.attackerId) ?? null : null;
        const attackPromise = data.attackerId && data.defenderLane !== null && data.defenderDepth !== null && !isRiverBoundaryDamage
          ? (UCUFLogger.debug(LogCategory.LIFECYCLE, `[BattleUIBridge][CombatVisual] attacker-lunge attacker=${data.attackerId} target=${data.unitId}`), c.unitRenderer?.playAttackAnimationAsync(data.attackerId, data.defenderLane, data.defenderDepth) ?? Promise.resolve())
          : Promise.resolve();

        const hitPromise = isRiverBoundaryDamage
          ? (UCUFLogger.debug(LogCategory.LIFECYCLE, `[BattleUIBridge][CombatVisual] boundary-spin unit=${data.unitId}`), c.unitRenderer?.playBoundaryDamageSpinAsync(data.unitId) ?? Promise.resolve())
          : (UCUFLogger.debug(LogCategory.LIFECYCLE, `[BattleUIBridge][CombatVisual] defender-hit unit=${data.unitId}`), c.unitRenderer?.playHitAnimationAsync(data.unitId, data.attackerId) ?? Promise.resolve());

        const valuePromise = (UCUFLogger.debug(LogCategory.LIFECYCLE, `[BattleUIBridge][CombatVisual] damage-float unit=${data.unitId} hp=${data.hp}`), c.unitRenderer?.playValueChangeAsync(unit, data.damage, 'damage') ?? Promise.resolve());

        const hitLane = data.defenderLane ?? unit.lane;
        const hitDepth = data.defenderDepth ?? unit.depth;
        const hitFeedbackPromise = this._scheduleBattleUnitHitFeedback(hitLane, hitDepth, data.damageSource);
        const attackAudioPromise = data.attackerId && attackerUnit && !isRiverBoundaryDamage
          ? this._scheduleBattleAudio(resolveBattleUnitAttackSfxKey(attackerUnit.type))
          : Promise.resolve();

        await Promise.all([attackPromise, hitPromise, valuePromise, hitFeedbackPromise, attackAudioPromise]);

        if (data.hp > 0) {
          UCUFLogger.debug(LogCategory.LIFECYCLE, `[BattleUIBridge][CombatVisual] state-commit unit=${data.unitId}`);
          this.refreshBattleViews();
        }
        UCUFLogger.debug(LogCategory.LIFECYCLE, `[BattleUIBridge][CombatVisual] unit-damage end unit=${data.unitId}`);
      });
    }
  }

  private _onUnitHealed(data: { unitId: string; amount: number; hp: number }): void {
    const c = this.ctx;
    const unit = c.ctrl?.state.units.get(data.unitId);
    if (unit) {
      const side = unit.faction === Faction.Player ? '我方' : '敵方';
      this.appendLog(`${side}${unit.name} 回復 ${data.amount}，目前 HP ${Math.max(0, data.hp)}`);
    }
    this.refreshBattleViews();
  }

  private _onUnitMoved(data: {
    unitId: string; lane: number; depth: number; fromLane: number; fromDepth: number;
    swapWithUnitId?: string; swapDuration?: number; isSwapPassenger?: boolean;
    swapPartnerId?: string; swapPassengerFromLane?: number; swapPassengerFromDepth?: number;
    swapPassengerToLane?: number; swapPassengerToDepth?: number;
    forcedMove?: boolean; forcedMoveReason?: string;
  }): void {
    const c = this.ctx;
    const unit = c.ctrl?.state.units.get(data.unitId);
    if (unit) {
      const side = unit.faction === Faction.Player ? '我方' : '敵方';
      if (data.swapWithUnitId) {
        this.appendLog(`${side}${unit.name} 與友軍換位後推進到 L${data.lane + 1} D${data.depth}`);
        c.unitRenderer?.playSwapAdvanceAnimation(unit, data.swapWithUnitId, data.fromLane, data.fromDepth, data.swapDuration ?? BATTLE_VISUAL_TIMING.swapAdvanceMinSec,
          data.swapPassengerFromLane, data.swapPassengerFromDepth, data.swapPassengerToLane, data.swapPassengerToDepth);
      } else if (data.forcedMove) {
        this.appendLog(`${side}${unit.name} 受地格影響位移到 L${data.lane + 1} D${data.depth}`);
        c.unitRenderer?.animateMove(unit, data.fromLane, data.fromDepth, data.forcedMoveReason);
        playBattleFlowEffectAtCell(services().effect, c.boardRenderer, BATTLE_FLOW_FX.forcedMove, data.lane, data.depth, 0.95, 0.1);
      } else if (!data.isSwapPassenger) {
        this.appendLog(`${side}${unit.name} 前進到 L${data.lane + 1} D${data.depth}`);
        c.unitRenderer?.animateMove(unit, data.fromLane, data.fromDepth, data.forcedMoveReason);
      }
    }
    this.refreshBattleViews();
  }

  private _onUnitDied(data: { unitId: string; lane: number; depth: number; faction: Faction; type: TroopType }): void {
    const c = this.ctx;
    this.appendLog(`單位陣亡：${data.unitId}`);
    c.unitRenderer?.markDyingUnit?.(data.unitId);
    this._enqueueCombatVisual(`unit-death:${data.unitId}`, async () => {
      UCUFLogger.debug(LogCategory.LIFECYCLE, `[BattleUIBridge][CombatVisual] death start unit=${data.unitId}`);
      playBattleFlowEffectAtCell(services().effect, c.boardRenderer, BATTLE_FLOW_FX.deathBurst, data.lane, data.depth, 1.0, 0.16);
      playBattleFlowEffectAtCell(services().effect, c.boardRenderer, BATTLE_FLOW_FX.deathSmoke, data.lane, data.depth, 1.8, 0.05);
      await c.unitRenderer?.playDeathAsync(data.unitId);
      const killerFaction = data.faction === Faction.Player ? Faction.Enemy : Faction.Player;
      const isPlayerKiller = killerFaction === Faction.Player;
      const targetSpNode = isPlayerKiller ? c.hud?.playerSpBarNode ?? null : c.hud?.enemySpBarNode ?? null;
      c.unitRenderer?.playSpGainAnimation(data.lane, data.depth, SP_PER_KILL, isPlayerKiller, targetSpNode);
      this.refreshBattleViews();
      UCUFLogger.debug(LogCategory.LIFECYCLE, `[BattleUIBridge][CombatVisual] death end unit=${data.unitId}`);
    });
  }

  private _onGeneralDamaged(data: { faction: Faction; hp: number; damage?: number; attackerId?: string | null; isCrit?: boolean; wasDodged?: boolean }): void {
    const c = this.ctx;
    const target = data.faction === Faction.Player ? '我方主將' : '敵方主將';
    const maxHp = c.ctrl?.state.getGeneral(data.faction)?.maxHp ?? 0;
    if (data.wasDodged) {
      this.appendLog(`${target} 閃躲攻擊！`);
      this._enqueueCombatVisual(`general-dodge:${data.faction}`, async () => {
        UCUFLogger.debug(LogCategory.LIFECYCLE, `[BattleUIBridge][CombatVisual] general-dodge start faction=${data.faction}`);
        await c.unitRenderer?.playGeneralHitAnimationAsync(data.faction, data.attackerId || null);
        UCUFLogger.debug(LogCategory.LIFECYCLE, `[BattleUIBridge][CombatVisual] hud-commit faction=${data.faction} hp=${data.hp}`);
        services().event.emit(EVENT_NAMES.GeneralDamagedVisualCommitted, {
          faction: data.faction,
          hp: data.hp,
          maxHp,
        });
        this.refreshBattleViews();
        UCUFLogger.debug(LogCategory.LIFECYCLE, `[BattleUIBridge][CombatVisual] general-dodge end faction=${data.faction}`);
      });
      return;
    }
    const critLabel = data.isCrit ? '《暴擊》 ' : '';
    this.appendLog(`${target} ${critLabel}受到攻擊，剩餘 HP ${Math.max(0, data.hp)}`);
    this._enqueueCombatVisual(`general-damage:${data.faction}`, async () => {
      UCUFLogger.debug(LogCategory.LIFECYCLE, `[BattleUIBridge][CombatVisual] general-damage start faction=${data.faction}`);
      const attackerUnit = data.attackerId ? c.ctrl?.state.units.get(data.attackerId) ?? null : null;
      const attackPromise = data.attackerId
        ? (UCUFLogger.debug(LogCategory.LIFECYCLE, `[BattleUIBridge][CombatVisual] attacker-lunge-general attacker=${data.attackerId} targetFaction=${data.faction}`), c.unitRenderer?.playAttackGeneralAnimationAsync(data.attackerId, data.faction) ?? Promise.resolve())
        : Promise.resolve();
      const hitPromise = (UCUFLogger.debug(LogCategory.LIFECYCLE, `[BattleUIBridge][CombatVisual] general-hit faction=${data.faction}`), c.unitRenderer?.playGeneralHitAnimationAsync(data.faction, data.attackerId || null) ?? Promise.resolve());
      const valuePromise = data.damage && data.damage > 0
        ? (UCUFLogger.debug(LogCategory.LIFECYCLE, `[BattleUIBridge][CombatVisual] general-damage-float faction=${data.faction} hp=${data.hp}`), c.unitRenderer?.playGeneralValueChangeAsync(data.faction, data.damage, data.isCrit ?? false) ?? Promise.resolve())
        : Promise.resolve();

      const attackAudioPromise = data.attackerId && attackerUnit
        ? this._scheduleBattleAudio(resolveBattleGeneralAttackSfxKey())
        : Promise.resolve();
      const hitAudioPromise = this._scheduleBattleAudio(resolveBattleGeneralHitSfxKey(), BATTLE_VISUAL_TIMING.recoilStartDelaySec);

      await Promise.all([attackPromise, hitPromise, valuePromise, attackAudioPromise, hitAudioPromise]);
      UCUFLogger.debug(LogCategory.LIFECYCLE, `[BattleUIBridge][CombatVisual] hud-commit faction=${data.faction} hp=${data.hp}`);
      services().event.emit(EVENT_NAMES.GeneralDamagedVisualCommitted, {
        faction: data.faction,
        hp: data.hp,
        maxHp,
      });
      this.refreshBattleViews();
      UCUFLogger.debug(LogCategory.LIFECYCLE, `[BattleUIBridge][CombatVisual] general-damage end faction=${data.faction}`);
    });
  }

  private _onGeneralSkillUsed(data: { faction: Faction; skillId?: string; skillName?: string; sourceType?: SkillSourceType }): void {
    const skillId = data.skillId ?? data.skillName ?? null;
    if (!skillId) return;
    this.appendLog(buildBattleSkillUsedMessage(skillId, data.faction, data.sourceType));

    const effectKey = resolveBattleGeneralSkillEffectKey(data.sourceType);
    playBattleFlowEffectAtBoardCenter(services().effect, this.ctx.boardRenderer, effectKey, 1.35);
  }

  private _onTileBuffSpawned(): void { this.refreshBattleViews(); }

  private _onTileBuffConsumed(data: { unitId: string; faction: Faction; lane: number; depth: number; buffText: string; attackDelta: number; hpDelta: number }): void {
    const c = this.ctx;
    const deltaText = [
      data.attackDelta !== 0 ? `ATK ${data.attackDelta > 0 ? '+' : ''}${data.attackDelta}` : '',
      data.hpDelta !== 0 ? `HP ${data.hpDelta > 0 ? '+' : ''}${data.hpDelta}` : '',
    ].filter(Boolean).join(' ');
    const side = data.faction === Faction.Player ? '我方' : '敵方';
    this.appendLog(`${side}吃到 Buff：${data.buffText} ${deltaText}`);
    c.boardRenderer?.playBuffConsumeBurst(data.lane, data.depth);
    c.unitRenderer?.playBuffConsumeValue(data.lane, data.depth, deltaText || data.buffText);
    if (data.attackDelta !== 0 || data.hpDelta !== 0) {
      c.unitRenderer?.playBuffEffect(data.unitId, data.lane, data.depth, data.attackDelta, data.hpDelta);
    }
    this.refreshBattleViews();
  }

  private _onBattleEnded(data: { result: string }): void {
    const c = this.ctx;
    const effectKey = resolveBattleResultEffectKey(data.result);
    if (effectKey) {
      playBattleFlowEffectAtBoardCenter(services().effect, c.boardRenderer, effectKey, data.result === 'draw' ? 1.6 : 1.8);
    }
    c.resultPopup?.showResult(data.result as any);
    this.appendLog(`戰鬥結束：${data.result}`);
    c.boardRenderer?.clearDeployHint();
    c.hud?.clearPersistentStatus();
    c.hud?.clearSceneGambitBadge();
    this.refreshBattleViews();
    c.combatVisualQueue.length = 0;
    c.isDrainingCombatVisual = false;
    c.isAdvancingTurn = false;
    c.isDuelPanelActive = false;
    if (c.deployRuntime) c.deployRuntime.node.active = false;
  }

  private _onUltimateSkillSelected(data: { skillId?: string | null }): void {
    if (!this.ctx.ctrl || this.ctx.isAdvancingTurn) return;
    const skillId = data.skillId ?? null;
    if (!skillId) {
      this.ctx.deployRuntime?.showToast('尚未配置可施放奧義', 1.5);
      return;
    }

    this.ctx.skillTargetingFlow?.beginPlayerSkillFlow(skillId, SkillSourceType.Ultimate, '奧義');
  }

  private _onGlobalBoardTouchEnd(ev: EventTouch): void {
    if (!this.ctx.skillTargetingFlow?.isPending) return;
    const loc = ev.getLocation();
    this.ctx.skillTargetingFlow.handleSkillTargetClick(loc.x, loc.y);
  }

  private _onGlobalBoardMouseUp(ev: EventMouse): void {
    if (!this.ctx.skillTargetingFlow?.isPending) return;
    const loc = ev.getLocation();
    this.ctx.skillTargetingFlow.handleSkillTargetClick(loc.x, loc.y);
  }

  private _onGlobalKeyUp(ev: EventKeyboard): void {
    if (!this.ctx.skillTargetingFlow?.isPending) return;
    if (ev.keyCode !== KeyCode.ESCAPE) return;
    this.ctx.skillTargetingFlow.cancelPendingSkillTargeting(true);
  }

  private _onRequestGeneralQuickView(req: { side: 'player' | 'enemy'; isEnemy: boolean }): void {
    const unit = req.side === 'player' ? this.ctx.pg : this.ctx.eg;
    if (!unit) { UCUFLogger.warn(LogCategory.LIFECYCLE, '[BattleUIBridge] _onRequestGeneralQuickView: 武將資料尚未備妥'); return; }
    const data = {
      name: unit.name, title: req.isEnemy ? '敵方主將' : '我方主將',
      faction: req.isEnemy ? '敵方' : '玩家',
      hp: unit.currentHp, maxHp: unit.maxHp,
      atk: Math.round(unit.str * 10), def: Math.round(unit.lea * 10), spd: unit.luk, int: unit.int,
      skills: unit.skillId ? [`技能：${unit.skillId}`] : [], isEnemy: req.isEnemy,
    };
    services().event.emit(EVENT_NAMES.ShowGeneralQuickView, data);
  }

  // ── 戰鬥動畫佇列（委託給 TurnFlowManager 共享 ctx）────────────────────────

  private _enqueueCombatVisual(label: string, action: () => Promise<void> | void): void {
    const c = this.ctx;
    const task: CombatVisualTask = {
      id: ++c.combatVisualTaskId,
      label,
      run: action,
    };
    c.combatVisualQueue.push(task);
    UCUFLogger.debug(LogCategory.LIFECYCLE, `[BattleUIBridge][CombatVisual] enqueue id=${task.id} label=${label} queue=${c.combatVisualQueue.length}`);
    if (c.isDrainingCombatVisual) return;
    c.isDrainingCombatVisual = true;
    void this._drainCombatVisualQueue();
  }

  private async _drainCombatVisualQueue(): Promise<void> {
    const c = this.ctx;
    UCUFLogger.debug(LogCategory.LIFECYCLE, `[BattleUIBridge][CombatVisual] drain-start queue=${c.combatVisualQueue.length}`);
    await (c.unitRenderer?.waitForMovementIdle?.(BATTLE_VISUAL_TIMING.movementIdleMaxWaitMs) ?? Promise.resolve());

    while (c.combatVisualQueue.length > 0) {
      const task = c.combatVisualQueue.shift();
      if (!task) {
        break;
      }

      UCUFLogger.debug(LogCategory.LIFECYCLE, `[BattleUIBridge][CombatVisual] action-start id=${task.id} label=${task.label}`);
      try {
        await Promise.resolve(task.run());
      } catch (error) {
        UCUFLogger.error(LogCategory.LIFECYCLE, `[BattleUIBridge][CombatVisual] action-failed id=${task.id} label=${task.label}`, error);
      }
      UCUFLogger.debug(LogCategory.LIFECYCLE, `[BattleUIBridge][CombatVisual] action-end id=${task.id} label=${task.label} remaining=${c.combatVisualQueue.length}`);
    }

    c.isDrainingCombatVisual = false;
    UCUFLogger.debug(LogCategory.LIFECYCLE, `[BattleUIBridge][CombatVisual] drain-end`);
  }

  private toTroopName(type: TroopType): string {
    if (type === TroopType.Cavalry)  return '騎兵';
    if (type === TroopType.Infantry) return '步兵';
    if (type === TroopType.Shield)   return '盾兵';
    if (type === TroopType.Archer)   return '弓兵';
    if (type === TroopType.Pikeman)  return '長槍兵';
    if (type === TroopType.Engineer) return '工兵';
    if (type === TroopType.Medic)    return '醫護兵';
    return '水軍';
  }
}
