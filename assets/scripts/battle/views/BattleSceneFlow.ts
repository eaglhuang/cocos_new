import { Color } from 'cc';
import { Faction, GAME_CONFIG } from '../../core/config/Constants';
import { services } from '../../core/managers/ServiceLoader';
import type { BattleController } from '../controllers/BattleController';
import { createGeneral, loadEncounter } from './BattleSceneLoader';
import { buildSceneGambitSummary } from './BattleSceneGambitSummary';
import { BATTLE_TURN_FLOW_TIMING } from './BattlePresentationTiming';
import type { BattleEntryParams } from '../models/BattleEntryParams';
import type { TerrainGrid } from '../models/BattleState';
import type { GeneralUnit } from '../../core/models/GeneralUnit';
import type { BattleHUDComposite } from '../../ui/components/BattleHUDComposite';
import type { BattleLogComposite } from '../../ui/components/BattleLogComposite';
import type { DeployRuntimeApi } from '../../ui/components/DeployRuntimeApi';
import type { BoardRenderer } from './BoardRenderer';

export interface BattleSceneFlowContext {
  getCtrl(): BattleController | null;
  getBattleParams(): BattleEntryParams | null;
  getCurrentEncounterId(): string;
  getDeployRuntime(): DeployRuntimeApi | null;
  getHUD(): BattleHUDComposite | null;
  getBattleLogPanel(): BattleLogComposite | null;
  getBoardRenderer(): BoardRenderer | null;
  setPlayerGeneral(unit: GeneralUnit): void;
  setEnemyGeneral(unit: GeneralUnit): void;
  refreshBattleViews(): void;
  setIsAdvancingTurn(next: boolean): void;
  getIsAdvancingTurn(): boolean;
  setIsDrainingCombatVisual(next: boolean): void;
  clearCombatVisualQueue(): void;
  cancelPendingSkillTargeting(showToast: boolean): void;
}

/**
 * BattleSceneFlow — 管理 BattleScene 的場景級流程。
 *
 * 職責：
 *   1. 顯示回合開始 Banner
 *   2. 呈現 / 同步場景戰法摘要
 *   3. 回放後的整場重開
 *   4. 回合推進收尾時的狀態切換
 *
 * BattleScene 只保留生命週期與事件接線，具體流程由此 helper 執行。
 */
export class BattleSceneFlow {
  constructor(private readonly ctx: BattleSceneFlowContext) {}

  public onReplay(): void {
    void this.restartBattle();
  }

  public async restartBattle(): Promise<void> {
    const ctrl = this.ctx.getCtrl();
    if (!ctrl) return;

    this.ctx.setIsAdvancingTurn(false);
    this.ctx.clearCombatVisualQueue();
    this.ctx.setIsDrainingCombatVisual(false);
    this.ctx.cancelPendingSkillTargeting(false);

    const encounter = await loadEncounter(this.ctx.getCurrentEncounterId());
    const battleParams = this.ctx.getBattleParams();
    const pgId = encounter?.playerGeneralId ?? 'zhang-fei';
    const egId = encounter?.enemyGeneralId ?? 'lu-bu';
    const terrain: TerrainGrid | undefined = encounter?.terrain;

    const pg = await createGeneral(pgId, Faction.Player);
    const eg = await createGeneral(egId, Faction.Enemy);
    this.ctx.setPlayerGeneral(pg);
    this.ctx.setEnemyGeneral(eg);

    ctrl.initBattle(pg, eg, terrain, battleParams?.weather, battleParams?.battleTactic);

    const deployRuntime = this.ctx.getDeployRuntime();
    if (deployRuntime) {
      deployRuntime.node.active = true;
      deployRuntime.updateDp(GAME_CONFIG.INITIAL_FOOD);
    }

    const snap = services().battle.getSnapshot();
    const hud = this.ctx.getHUD();
    hud?.setPlayerGeneralId(pgId);
    hud?.setEnemyGeneralId(egId);
    hud?.setPlayerName(pg.name);
    hud?.setEnemyName(eg.name);
    hud?.refresh(
      snap.turn,
      snap.playerFood,
      GAME_CONFIG.MAX_FOOD,
      pg.currentHp,
      pg.maxHp,
      eg.currentHp,
      eg.maxHp,
    );

    const battleLogPanel = this.ctx.getBattleLogPanel();
    battleLogPanel?.clear();
    battleLogPanel?.append(`重新開始：第 ${snap.turn} 回合，糧草 ${snap.playerFood}`);
    this.presentSceneGambitFeedback();
    this.ctx.getBoardRenderer()?.setDeployHintFaction(Faction.Player);

    this.ctx.refreshBattleViews();
  }

  public presentSceneGambitFeedback(): void {
    this._syncSceneGambitSummary(true);
  }

  public syncSceneGambitStatus(): void {
    this._syncSceneGambitSummary(false);
  }

  public playTurnBanner(faction: Faction): void {
    // 全域去抖：避免短時間內被多個元件重複呼叫而導致重複提示
    const now = Date.now();
    const last = (globalThis as any).__lastTurnBannerTime ?? 0;
    if (now - last < BATTLE_TURN_FLOW_TIMING.turnBannerDebounceMs) return;
    (globalThis as any).__lastTurnBannerTime = now;

    const message = faction === Faction.Player ? '我方回合開始' : '敵方回合開始';
    const color = faction === Faction.Player
      ? new Color(90, 190, 255, 255)
      : new Color(255, 110, 110, 255);

    this.ctx.getDeployRuntime()?.showToast(message, BATTLE_TURN_FLOW_TIMING.turnBannerToastSec, {
      color,
    });
  }

  public finalizeAdvance(): void {
    this.ctx.setIsAdvancingTurn(false);
    this.playTurnBanner(Faction.Player);
    this.ctx.getBoardRenderer()?.setDeployHintFaction(Faction.Player);
    this.syncSceneGambitStatus();
  }

  private _syncSceneGambitSummary(withBattleLog: boolean): void {
    const ctrl = this.ctx.getCtrl();
    if (!ctrl) return;

    const summary = buildSceneGambitSummary(ctrl.state.battleTactic);
    const hud = this.ctx.getHUD();
    if (!summary) {
      hud?.clearPersistentStatus();
      hud?.clearSceneGambitBadge();
      return;
    }

    hud?.showPersistentStatus(`【${summary.label}】${summary.description}`);
    hud?.showSceneGambitBadge(summary.label);
    if (!withBattleLog) return;

    this.ctx.getBoardRenderer()?.playSceneGambitPulse(ctrl.state, ctrl.state.battleTactic);
    this.ctx.getBattleLogPanel()?.append(`【${summary.label}】${summary.description}`);
    this.ctx.getDeployRuntime()?.showToast(`${summary.label}已生效`, 1.8);
  }
}
