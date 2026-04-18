/**
 * TurnFlowManager.ts — 回合推進與交互流程管理器
 *
 * [P3-R2b] 從 BattleScene.ts 抽取的回合驅動邏輯，包含：
 *   - 玩家結束回合後的 AI 執行流程
 *   - 部署確認 → 自動進入下一回合
 *   - 武將單挑挑戰系統
 *   - 射線偵測部署邏輯
 *   - 計謀按鈕佔位處理
 *
 * 依賴 BattleSceneContext 中的共享可變狀態（ctx），
 * BattleScene 建立此類並持有引用，委派所有流程控制呼叫。
 *
 * Unity 對照：BattleTurnController (MonoBehaviour, drives turn coroutines)
 */

import { Color, Component } from 'cc';
import { Faction, GAME_CONFIG } from '../../core/config/Constants';
import { geometry, Vec3 } from 'cc';
import { BattleSceneContext } from './BattleUIBridge';
import { BattleUIBridge } from './BattleUIBridge';
import { buildTacticSummary } from './BattleSceneLoader';

export class TurnFlowManager {
  constructor(
    private readonly ctx: BattleSceneContext,
    /** BattleScene Component 本身，用於 scheduleOnce */
    private readonly scene: Component,
    private readonly bridge: BattleUIBridge,
  ) {}

  // ── 回合推進 ─────────────────────────────────────────────────────────────

  public onEndTurn(): void {
    const c = this.ctx;
    if (!c.ctrl || c.isAdvancingTurn) return;

    c.battleLogPanel?.append('執行回合推進');
    c.isAdvancingTurn = true;
    c.boardRenderer?.setDeployHintFaction(Faction.Enemy);
    this.bridge.refreshBattleViews();

    this.bridge.showEnemyThinkingPanel();
    this.scene.scheduleOnce(() => {
      this.bridge.hideEnemyThinkingPanel();
      try {
        const result = c.ctrl?.advanceTurn();
        if (result === 'ongoing') {
          this.checkDuelChallenge();
        }
      } finally {
        const finalizeAdvance = () => {
          if (c.isDuelPanelActive) return;

          let attempts = 0;
          const maxAttempts = 12; // 每次 0.5s，最多 6s
          const poll = () => {
            if (!c.isDrainingCombatVisual) {
              c.isAdvancingTurn = false;
              this.bridge.playTurnBanner(Faction.Player);
              c.boardRenderer?.setDeployHintFaction(Faction.Player);
              return;
            }
            attempts += 1;
            if (attempts >= maxAttempts) {
              c.isAdvancingTurn = false;
              this.bridge.playTurnBanner(Faction.Player);
              c.boardRenderer?.setDeployHintFaction(Faction.Player);
              return;
            }
            this.scene.scheduleOnce(poll, 0.5);
          };

          // 保留原先的 2.3s 最小等待，然後開始輪詢
          this.scene.scheduleOnce(poll, 2.3);
        };
        this.scene.scheduleOnce(finalizeAdvance, 0); // trigger the finalize logic (schedules internal poll after 2.3s)
      }
    }, 2.0);
  }

  public onPlayerDeployed(): void {
    this.ctx.deployRuntime?.showToast('部署完成，等待敵軍行動...', 1.8);
    this.scene.scheduleOnce(() => this.onEndTurn(), 2.0);
  }

  public onTactics(): void {
    const general = this.ctx.pg;
    if (!general) {
      this.ctx.deployRuntime?.showToast('尚未載入我方主將戰法', 1.5);
      return;
    }

    const summary = buildTacticSummary(general);
    this.ctx.deployRuntime?.showToast(summary.message, summary.count > 0 ? 2.0 : 1.5);
    if (summary.count > 0) {
      this.ctx.battleLogPanel?.append(`戰法槽位：${summary.names.join('｜')}`);
    }
  }

  // ── 武將出陣請求 ──────────────────────────────────────────────────────────

  public onGeneralDuelRequest(): void {
    const c = this.ctx;
    if (!c.ctrl) return;
    const result = c.ctrl.startGeneralDuel();
    switch (result) {
      case 'ok':
        c.deployRuntime?.showToast('請點擊棋盤上的空格放置武將');
        c.battleLogPanel?.append('武將準備出陣，等待選擇位置...');
        break;
      case 'already-deployed':
        c.deployRuntime?.showToast('武將已在戰場上！');
        break;
      case 'front-blocked':
        c.deployRuntime?.showToast('前排有我方小兵，武將無法出陣！');
        break;
      case 'general-dead':
        c.deployRuntime?.showToast('武將已陣亡，無法出陣！');
        break;
    }
  }

  // ── 射線偵測部署 ──────────────────────────────────────────────────────────

  /**
  * deploy runtime 拖曳放手後呼叫：螢幕座標 → 3D 射線 → 格子部署。
   * 此方法為同步，processDragEnd 依賴其同步性判斷是否成功。
   */
  public doDeployRaycast(screenX: number, screenY: number): void {
    const c = this.ctx;
    console.log(`[TurnFlowManager] doDeployRaycast screen=(${screenX.toFixed(0)},${screenY.toFixed(0)}) advancing=${c.isAdvancingTurn}`);

    if (c.isAdvancingTurn) {
      console.log('[TurnFlowManager] doDeployRaycast: 回合推進中，忽略');
      return;
    }

    // [Fix-Bug1] 使用 ctx.boardCamera 取代 (this.scene as any).getMainCamera?.()
    // 避免 Cocos minifier 混淆 private 方法名稱導致靜默失敗
    const cam = c.boardCamera;
    if (!cam) {
      console.warn('[TurnFlowManager] doDeployRaycast: boardCamera 為 null，無法射線偵測。請確認 setupCameraForBoard() 已執行');
      return;
    }

    const ray = new geometry.Ray();
    cam.screenPointToRay(screenX, screenY, ray);
    console.log(`[TurnFlowManager] ray.d=(${ray.d.x.toFixed(3)},${ray.d.y.toFixed(3)},${ray.d.z.toFixed(3)})`);

    if (Math.abs(ray.d.y) < 0.0001) {
      console.warn('[TurnFlowManager] doDeployRaycast: 射線平行地面，無法偵測');
      return;
    }
    const t = -ray.o.y / ray.d.y;
    if (t < 0) {
      console.warn(`[TurnFlowManager] doDeployRaycast: t=${t.toFixed(3)} < 0，射線打到背面`);
      return;
    }
    const hitPoint = new Vec3();
    Vec3.scaleAndAdd(hitPoint, ray.o, ray.d, t);
    console.log(`[TurnFlowManager] hitPoint=(${hitPoint.x.toFixed(2)},${hitPoint.y.toFixed(2)},${hitPoint.z.toFixed(2)})`);

    const cell = c.boardRenderer?.getCellFromWorldPos(hitPoint);
    if (!cell) {
      console.log('[TurnFlowManager] doDeployRaycast: 未命中任何格子（hitPoint 不在棋盤範圍內）');
      return;
    }
    console.log(`[TurnFlowManager] 命中格子 lane=${cell.lane} depth=${cell.depth}`);

    if (c.ctrl?.isWaitingDuelPlacement) {
      if (cell.depth < 0 || cell.depth >= GAME_CONFIG.GRID_DEPTH) return;
      const stateCell = c.ctrl.state.getCell(cell.lane, cell.depth);
      if (stateCell?.occupantId) { c.deployRuntime?.showToast('無法在後方部署', 1.2); return; }
      const unit = c.ctrl.placeGeneralOnBoard(cell.lane, cell.depth);
      if (unit) {
        c.deployRuntime?.showToast('武將出陣！全軍攻擊力加倍！');
        c.battleLogPanel?.append(`我方武將出陣至 L${cell.lane + 1} D${cell.depth}`);
        this.bridge.refreshBattleViews();
        c.unitRenderer?.playDeploy(unit);
      }
      return;
    }

    if (cell.depth === 0) {
      console.log(`[TurnFlowManager] 部署到 lane=${cell.lane}`);
      c.deployRuntime?.selectLane(cell.lane);
    } else {
      console.log(`[TurnFlowManager] depth=${cell.depth} 非部署列（需 depth=0），忽略`);
    }
  }


  // ── 武將單挑系統 ──────────────────────────────────────────────────────────

  public checkDuelChallenge(): void {
    const c = this.ctx;
    if (!c.ctrl || c.ctrl.isDuelChallengeResolved()) return;

    let challengerFaction: Faction | null = null;
    if (c.ctrl.isGeneralFacingEnemyGeneral(Faction.Player)) {
      challengerFaction = Faction.Player;
      c.battleLogPanel?.append('我方武將已推進到敵將面前，發起單挑邀請！');
    } else if (c.ctrl.isGeneralFacingEnemyGeneral(Faction.Enemy)) {
      challengerFaction = Faction.Enemy;
      c.battleLogPanel?.append('敵方武將已推進到我將面前，發起單挑邀請！');
    }
    if (challengerFaction === null) return;

    if (challengerFaction === Faction.Enemy) {
      this._showDuelChallengePanel();
    } else {
      this._resolveEnemyDuelDecision(challengerFaction);
    }
  }

  private _showDuelChallengePanel(): void {
    const c = this.ctx;
    if (!c.ctrl) return;
    const state = c.ctrl.state;
    const playerGeneralName = state.playerGeneral?.name ?? '我方武將';
    const enemyGeneralName  = state.enemyGeneral?.name  ?? '敵方武將';
    const decision = c.ctrl.evaluateDuelAcceptance(Faction.Enemy);
    const playerScore = 1.0 - decision.score;
    c.isDuelPanelActive = true;
    if (c.duelChallengePanel) {
      c.duelChallengePanel.show(enemyGeneralName, playerGeneralName, playerScore);
      c.duelChallengePanel.node.once('duelAccepted', () => this._onPlayerDuelDecision(true), this.scene);
      c.duelChallengePanel.node.once('duelRejected', () => this._onPlayerDuelDecision(false), this.scene);
    } else {
      console.warn('[TurnFlowManager] duelChallengePanel 未綁定，自動接受單挑');
      this._onPlayerDuelDecision(true);
    }
  }

  private _onPlayerDuelDecision(accepted: boolean): void {
    const c = this.ctx;
    if (!c.ctrl) return;
    const duelResult = c.ctrl.resolveDuelChallenge(Faction.Enemy, accepted);
    this._showDuelResultToast(duelResult, accepted, Faction.Enemy);
    c.isDuelPanelActive = false;
    c.isAdvancingTurn = false;
    this.bridge.playTurnBanner(Faction.Player);
    c.boardRenderer?.setDeployHintFaction(Faction.Player);
    this.bridge.refreshBattleViews();
  }

  private _resolveEnemyDuelDecision(challengerFaction: Faction): void {
    const c = this.ctx;
    if (!c.ctrl) return;
    const decision = c.ctrl.evaluateDuelAcceptance(challengerFaction);
    const defenderName = decision.defenderFaction === Faction.Player ? '我將' : '敵將';
    c.battleLogPanel?.append(
      `${defenderName} 單挑評估分數：${decision.score.toFixed(2)}（${decision.accepted ? '接受' : '拒絕'}）`
    );
    const duelResult = c.ctrl.resolveDuelChallenge(challengerFaction, decision.accepted);
    this._showDuelResultToast(duelResult, decision.accepted, decision.defenderFaction);
    this.bridge.refreshBattleViews();
  }

  private _showDuelResultToast(duelResult: string, accepted: boolean, defenderFaction: Faction): void {
    const c = this.ctx;
    if (accepted) {
      if (duelResult === 'player-win') {
        c.deployRuntime?.showToast('單挑成立！我方武將獲勝！', 1.3, { color: new Color(90, 190, 255, 255) });
        c.battleLogPanel?.append('單挑成立！我方武將於單挑中獲勝！');
      } else if (duelResult === 'enemy-win') {
        c.deployRuntime?.showToast('單挑成立！敵方武將獲勝！', 1.3, { color: new Color(255, 110, 110, 255) });
        c.battleLogPanel?.append('單挑成立！敵方武將於單挑中獲勝！');
      } else {
        c.deployRuntime?.showToast('單挑成立！雙方武將交鋒！'); c.battleLogPanel?.append('單挑成立！雙方武將正面對決！');
      }
    } else {
      if (defenderFaction === Faction.Player) {
        c.deployRuntime?.showToast('我將拒絕單挑！我方全軍攻防減半！');
        c.battleLogPanel?.append('我將拒絕單挑！我方全體攻擊力與生命力減半！');
      } else {
        c.deployRuntime?.showToast('敵將拒絕單挑！敵方全軍攻防減半！');
        c.battleLogPanel?.append('敵將拒絕單挑！敵方全體攻擊力與生命力減半！');
      }
    }
  }
}
