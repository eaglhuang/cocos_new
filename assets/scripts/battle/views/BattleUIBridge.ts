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

import { Color, Component, Node } from 'cc';
import { EVENT_NAMES, Faction, GAME_CONFIG, TroopType, TurnPhase } from '../../core/config/Constants';
import { services } from '../../core/managers/ServiceLoader';
import { GeneralUnit } from '../../core/models/GeneralUnit';
import { BattleController } from '../controllers/BattleController';
import { BattleScenePanel } from '../../ui/components/BattleScenePanel';
import type { DeployRuntimeLike } from '../../ui/components/DeployRuntimeApi';
import { UCUFLogger, LogCategory } from '../../ui/core/UCUFLogger';

// ── 型別補充 ─────────────────────────────────────────────────────────────────
// boardRenderer / unitRenderer 使用 any 以解耦 3D 渲染模組（可後續換強型別）
type BoardRenderer  = any;
type UnitRenderer   = any;

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
  combatVisualQueue: (() => void)[];
  isDrainingCombatVisual: boolean;
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
    const svc = services();
    this.unsubs.push(
      svc.event.on(EVENT_NAMES.TurnPhaseChanged,        this._onTurnPhaseChanged.bind(this)),
      svc.event.on(EVENT_NAMES.UnitDeployed,            this._onUnitDeployed.bind(this)),
      svc.event.on(EVENT_NAMES.UnitDamaged,             this._onUnitDamaged.bind(this)),
      svc.event.on(EVENT_NAMES.UnitHealed,              this._onUnitHealed.bind(this)),
      svc.event.on(EVENT_NAMES.UnitMoved,               this._onUnitMoved.bind(this)),
      svc.event.on(EVENT_NAMES.UnitDied,                this._onUnitDied.bind(this)),
      svc.event.on(EVENT_NAMES.GeneralDamaged,          this._onGeneralDamaged.bind(this)),
      svc.event.on(EVENT_NAMES.TileBuffSpawned,         this._onTileBuffSpawned.bind(this)),
      svc.event.on(EVENT_NAMES.TileBuffConsumed,        this._onTileBuffConsumed.bind(this)),
      svc.event.on(EVENT_NAMES.BattleEnded,             this._onBattleEnded.bind(this)),
      svc.event.on(EVENT_NAMES.RequestGeneralQuickView, this._onRequestGeneralQuickView.bind(this)),
    );

    // 節點事件：由 TurnFlowManager 回呼轉接
    const c = this.ctx;
    c.deployRuntime?.node.on('endTurn',       externalHandlers.onEndTurn,            this.scene);
    c.deployRuntime?.node.on('playerDeployed',externalHandlers.onPlayerDeployed,      this.scene);
    c.battleLogPanel?.node.on('endTurn',    externalHandlers.onEndTurn,            this.scene);
    c.battleLogPanel?.node.on('tactics',    externalHandlers.onTactics,            this.scene);
    (c.battleScenePanel?.actionCommandComposite ?? c.battleScenePanel?.actionCommandPanel)?.node.on('endTurn',  externalHandlers.onEndTurn,  this.scene);
    (c.battleScenePanel?.actionCommandComposite ?? c.battleScenePanel?.actionCommandPanel)?.node.on('tactics',  externalHandlers.onTactics,  this.scene);
    c.resultPopup?.node.on('replay',        externalHandlers.onReplay,             this.scene);
    c.deployRuntime?.node.on('generalDuel',   externalHandlers.onGeneralDuelRequest, this.scene);
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
      c.deployRuntime.updateSkillStatus(pg.canUseSkill());
    }
  }

  public playTurnBanner(faction: Faction): void {
    // 全域去抖：避免短時間內被多個元件重複呼叫而導致重複提示
    const now = Date.now();
    const last = (globalThis as any).__lastTurnBannerTime ?? 0;
    if (now - last < 2500) return;
    (globalThis as any).__lastTurnBannerTime = now;

    const message = faction === Faction.Player ? '我方回合開始' : '敵方回合開始';
    const color   = faction === Faction.Player
      ? new Color(90, 190, 255, 255) : new Color(255, 110, 110, 255);
    this.ctx.deployRuntime?.showToast(message, 1.0, { color });
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

  private _onUnitDeployed(data: { unitId: string; faction: Faction; type: TroopType; lane: number }): void {
    const c = this.ctx;
    const snap = services().battle.getSnapshot();
    c.hud?.setFood(snap.playerFood, GAME_CONFIG.MAX_FOOD);
    c.deployRuntime?.updateDp(snap.playerFood);
    const side = data.faction === Faction.Player ? '我方' : '敵方';
    this.appendLog(`${side}部署 ${this.toTroopName(data.type)}（路線 ${data.lane + 1}）`);
    if (data.faction === Faction.Player) {
      c.deployRuntime?.showToast(`我方已部署 ${this.toTroopName(data.type)}（路線 ${data.lane + 1}）`);
    }
    this.refreshBattleViews();
    const unit = c.ctrl?.state.units.get(data.unitId) ?? null;
    c.unitRenderer?.playDeploy(unit);
  }

  private _onUnitDamaged(data: {
    unitId: string; damage: number; hp: number;
    attackerId: string | null; attackerLane: number | null; attackerDepth: number | null;
    defenderLane: number | null; defenderDepth: number | null; attackerFaction: Faction | null;
  }): void {
    const c = this.ctx;
    const unit = c.ctrl?.state.units.get(data.unitId);
    if (unit) {
      const side = unit.faction === Faction.Player ? '我方' : '敵方';
      this.appendLog(`${side}${this.toTroopName(unit.type)} 受到 ${data.damage} 傷害，剩餘 HP ${Math.max(0, data.hp)}`);
      this._enqueueCombatVisual(() => {
        c.unitRenderer?.playValueChange(unit, data.damage, 'damage');
        c.unitRenderer?.playHitAnimation(data.unitId, data.attackerId);
        if (data.attackerId && data.defenderLane !== null && data.defenderDepth !== null) {
          c.unitRenderer?.playAttackAnimation(data.attackerId, data.defenderLane, data.defenderDepth);
        }
      });
    }
    this.refreshBattleViews();
  }

  private _onUnitHealed(data: { unitId: string; amount: number; hp: number }): void {
    const c = this.ctx;
    const unit = c.ctrl?.state.units.get(data.unitId);
    if (unit) {
      const side = unit.faction === Faction.Player ? '我方' : '敵方';
      this.appendLog(`${side}${this.toTroopName(unit.type)} 回復 ${data.amount}，目前 HP ${Math.max(0, data.hp)}`);
    }
    this.refreshBattleViews();
  }

  private _onUnitMoved(data: {
    unitId: string; lane: number; depth: number; fromLane: number; fromDepth: number;
    swapWithUnitId?: string; swapDuration?: number; isSwapPassenger?: boolean;
    swapPartnerId?: string; swapPassengerFromLane?: number; swapPassengerFromDepth?: number;
    swapPassengerToLane?: number; swapPassengerToDepth?: number;
  }): void {
    const c = this.ctx;
    const unit = c.ctrl?.state.units.get(data.unitId);
    if (unit) {
      const side = unit.faction === Faction.Player ? '我方' : '敵方';
      if (data.swapWithUnitId) {
        this.appendLog(`${side}${this.toTroopName(unit.type)} 與友軍換位後推進到 L${data.lane + 1} D${data.depth}`);
        c.unitRenderer?.playSwapAdvanceAnimation(unit, data.swapWithUnitId, data.fromLane, data.fromDepth, data.swapDuration ?? 2.0,
          data.swapPassengerFromLane, data.swapPassengerFromDepth, data.swapPassengerToLane, data.swapPassengerToDepth);
      } else if (!data.isSwapPassenger) {
        this.appendLog(`${side}${this.toTroopName(unit.type)} 前進到 L${data.lane + 1} D${data.depth}`);
        c.unitRenderer?.animateMove(unit, data.fromLane, data.fromDepth);
      }
    }
    this.refreshBattleViews();
  }

  private _onUnitDied(data: { unitId: string; lane: number; depth: number; faction: Faction; type: TroopType }): void {
    const c = this.ctx;
    this.appendLog(`單位陣亡：${data.unitId}`);
    c.unitRenderer?.playDeath(data.unitId);
    const killerFaction = data.faction === Faction.Player ? Faction.Enemy : Faction.Player;
    const isPlayerKiller = killerFaction === Faction.Player;
    const targetSpNode = isPlayerKiller ? c.hud?.playerSpBarNode ?? null : c.hud?.enemySpBarNode ?? null;
    const SP_PER_KILL = 20;
    c.unitRenderer?.playSpGainAnimation(data.lane, data.depth, SP_PER_KILL, isPlayerKiller, targetSpNode);
    this.refreshBattleViews();
  }

  private _onGeneralDamaged(data: { faction: Faction; hp: number; damage?: number; attackerId?: string | null; isCrit?: boolean; wasDodged?: boolean }): void {
    const c = this.ctx;
    const target = data.faction === Faction.Player ? '我方主將' : '敵方主將';
    if (data.wasDodged) {
      this.appendLog(`${target} 閃躲攻擊！`);
      this._enqueueCombatVisual(() => { c.unitRenderer?.playGeneralHitAnimation(data.faction, data.attackerId || null); });
      return;
    }
    const critLabel = data.isCrit ? '《暴擊》 ' : '';
    this.appendLog(`${target} ${critLabel}受到攻擊，剩餘 HP ${Math.max(0, data.hp)}`);
    this._enqueueCombatVisual(() => {
      if (data.damage && data.damage > 0) c.unitRenderer?.playGeneralValueChange(data.faction, data.damage, data.isCrit ?? false);
      if (data.attackerId) c.unitRenderer?.playAttackGeneralAnimation(data.attackerId, data.faction);
      c.unitRenderer?.playGeneralHitAnimation(data.faction, data.attackerId || null);
    });
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
    c.resultPopup?.showResult(data.result as any);
    this.appendLog(`戰鬥結束：${data.result}`);
    c.boardRenderer?.clearDeployHint();
    this.refreshBattleViews();
    c.combatVisualQueue.length = 0;
    c.isDrainingCombatVisual = false;
    if (c.deployRuntime) c.deployRuntime.node.active = false;
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

  private _enqueueCombatVisual(action: () => void): void {
    const c = this.ctx;
    c.combatVisualQueue.push(action);
    if (c.isDrainingCombatVisual) return;
    c.isDrainingCombatVisual = true;
    this.scene.scheduleOnce(() => { this._drainCombatVisualQueue(); }, 1.8);
  }

  private _drainCombatVisualQueue(): void {
    const c = this.ctx;
    const action = c.combatVisualQueue.shift();
    if (!action) { c.isDrainingCombatVisual = false; return; }
    action();
    this.scene.scheduleOnce(() => this._drainCombatVisualQueue(), 0.5);
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
