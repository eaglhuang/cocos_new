import type { BattleController } from '../controllers/BattleController';
import {
  requiresBattleSkillManualTargeting,
  resolveBattleSkillTargetMode,
} from '../skills/BattleSkillProfiles';
import {
  buildBattleSkillAimingMessage,
  getBattleSkillPresentation,
} from '../skills/BattleSkillPresentation';
import { BattleSkillTargetMode, SkillSourceType } from '../../shared/SkillRuntimeContract';
import { Faction, GAME_CONFIG } from '../../core/config/Constants';

/** 待確認目標的技能狀態 */
export interface PendingSkillTargeting {
  skillId: string;
  sourceType: SkillSourceType;
  targetMode: BattleSkillTargetMode;
}

/** BattleScene 傳入的依賴回調 */
export interface BattleSkillTargetingFlowContext {
  getCtrl(): BattleController | null;
  clearBoardSkillPreview(): void;
  setBoardSkillPreviewCells(cells: Array<{ lane: number; depth: number }>): void;
  showToast(msg: string, duration?: number): void;
  appendBattleLog(text: string): void;
  raycastBoardCell(screenX: number, screenY: number): { lane: number; depth: number } | null;
  refreshBattleViews(): void;
}

/**
 * BattleSkillTargetingFlow — 管理「技能選目標」的互動狀態機。
 *
 * 職責：
 *   1. 追蹤 `pendingSkillTargeting` 狀態
 *   2. 決定技能是否需要玩家手動選目標
 *   3. 處理點擊棋盤後的目標解析與技能發動
 *   4. 取消技能選目並清除棋盤預覽高亮
 *
 * 不含 Cocos 依賴，透過 BattleSkillTargetingFlowContext 回調操作視圖。
 */
export class BattleSkillTargetingFlow {
  private pendingSkillTargeting: PendingSkillTargeting | null = null;

  constructor(private readonly ctx: BattleSkillTargetingFlowContext) {}

  /** 目前是否有待確認目標的技能 */
  get isPending(): boolean {
    return !!this.pendingSkillTargeting;
  }

  /**
   * 開始技能流程。若技能不需手動選目標，直接發動；
   * 否則進入選目標模式。
   */
  beginPlayerSkillFlow(skillId: string, sourceType: SkillSourceType, sourceLabel: string): void {
    const ctrl = this.ctx.getCtrl();
    if (!ctrl) return;

    const general = ctrl.state.playerGeneral;
    if (!general?.canUseSkill()) {
      this.ctx.showToast(`${sourceLabel}蓄力中，SP 不足`, 1.5);
      return;
    }

    // 再次點選同一技能 → 取消
    if (this.pendingSkillTargeting?.skillId === skillId && this.pendingSkillTargeting.sourceType === sourceType) {
      this.cancelPendingSkillTargeting(true);
      return;
    }

    const targetMode = resolveBattleSkillTargetMode(skillId, BattleSkillTargetMode.EnemyAll);
    if (!this._requiresExplicitTarget(skillId, targetMode)) {
      const didCast = ctrl.triggerPlayerBattleSkill(skillId, sourceType, { targetMode });
      if (didCast) {
        this.ctx.showToast(`${sourceLabel}已發動`, 1.2);
        this.ctx.refreshBattleViews();
      } else {
        this.ctx.showToast(`${sourceLabel}發動失敗`, 1.5);
      }
      return;
    }

    this.pendingSkillTargeting = { skillId, sourceType, targetMode };
    this._syncPendingSkillPreview();
    this.ctx.showToast(this._buildTargetingPrompt(skillId, targetMode), 2.4);
    this.ctx.appendBattleLog(buildBattleSkillAimingMessage(skillId, sourceType));
  }

  /**
   * 處理棋盤點擊事件（當技能正在等待選目標時呼叫）。
   */
  handleSkillTargetClick(screenX: number, screenY: number): void {
    if (!this.pendingSkillTargeting) return;
    const ctrl = this.ctx.getCtrl();
    if (!ctrl) return;

    const sourceLabel = this.pendingSkillTargeting.sourceType === SkillSourceType.Ultimate ? '奧義' : '戰法';
    const cell = this.ctx.raycastBoardCell(screenX, screenY);
    if (!cell) return;

    const stateCell = ctrl.state.getCell(cell.lane, cell.depth);
    const targetUnitId = stateCell?.occupantId ?? null;
    const targetUnit = targetUnitId ? ctrl.state.units.get(targetUnitId) ?? null : null;
    const targetMode = this.pendingSkillTargeting.targetMode;

    if (this._requiresEnemyUnitTarget(targetMode)) {
      if (!targetUnit || targetUnit.faction !== Faction.Enemy) {
        this.ctx.showToast(`請點選敵方單位作為${sourceLabel}目標`, 1.5);
        return;
      }

      const didCast = ctrl.triggerPlayerBattleSkill(
        this.pendingSkillTargeting.skillId,
        this.pendingSkillTargeting.sourceType,
        { targetMode, targetUnitUid: targetUnit.id },
      );
      if (!didCast) {
        this.ctx.showToast(`${sourceLabel}發動失敗，請重新選擇目標`, 1.5);
        return;
      }

      this.ctx.showToast(`${sourceLabel}已發動`, 1.2);
      this.cancelPendingSkillTargeting(false);
      this.ctx.refreshBattleViews();
      return;
    }

    const didCast = ctrl.triggerPlayerBattleSkill(
      this.pendingSkillTargeting.skillId,
      this.pendingSkillTargeting.sourceType,
      { targetMode, targetTileId: `${cell.lane},${cell.depth}` },
    );
    if (!didCast) {
      this.ctx.showToast(`${sourceLabel}發動失敗，請重新選擇格位`, 1.5);
      return;
    }

    this.ctx.showToast(`${sourceLabel}已發動`, 1.2);
    this.cancelPendingSkillTargeting(false);
    this.ctx.refreshBattleViews();
  }

  /** 取消待確認目標的技能，清除棋盤預覽。 */
  cancelPendingSkillTargeting(showToast: boolean): void {
    if (!this.pendingSkillTargeting) return;
    this.pendingSkillTargeting = null;
    this.ctx.clearBoardSkillPreview();
    this.ctx.refreshBattleViews();
    if (showToast) {
      this.ctx.showToast('已取消技能選目標', 1.2);
    }
  }

  // ─── 私有輔助 ─────────────────────────────────────────────────────────────

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

  private _syncPendingSkillPreview(): void {
    const ctrl = this.ctx.getCtrl();
    if (!this.pendingSkillTargeting || !ctrl) {
      this.ctx.clearBoardSkillPreview();
      return;
    }

    const previewCells = this._requiresEnemyUnitTarget(this.pendingSkillTargeting.targetMode)
      ? ctrl.state.units
          ? Array.from(ctrl.state.units.values())
              .filter((unit) => unit.faction === Faction.Enemy && !unit.isDead())
              .map((unit) => ({ lane: unit.lane, depth: unit.depth }))
          : []
      : this._getAllBoardCells();
    this.ctx.setBoardSkillPreviewCells(previewCells);
    this.ctx.refreshBattleViews();
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
}
