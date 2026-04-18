import { EVENT_NAMES, Faction, StatusEffect, TroopType } from '../../../core/config/Constants';
import { services } from '../../../core/managers/ServiceLoader';
import type { TroopUnit } from '../../../core/models/TroopUnit';
import type { BattleState } from '../../models/BattleState';
import { consumeBattleTileBuff } from '../BattleTileBuffSystem';
import { BattleTurnManager } from '../BattleTurnManager';

const FORWARD_DIR: Record<Faction, number> = {
  [Faction.Player]: 1,
  [Faction.Enemy]: -1,
};

export interface BattleAutoMovePhaseContext {
  readonly state: BattleState;
  readonly turnManager: BattleTurnManager;
  getFactionUnits(faction: Faction): TroopUnit[];
  isCellMovementBlocked(lane: number, depth: number): boolean;
  isGeneralUnit(unitId: string): boolean;
}

export function executeBattleAutoMovePhase(context: BattleAutoMovePhaseContext): void {
  const svc = services();

  const playerUnits = context.getFactionUnits(Faction.Player);
  playerUnits.sort((a, b) => b.depth - a.depth);
  for (const unit of playerUnits) {
    stepMoveUnit(unit, svc, context);
  }

  const enemyUnits = context.getFactionUnits(Faction.Enemy);
  enemyUnits.sort((a, b) => a.depth - b.depth);
  for (const unit of enemyUnits) {
    stepMoveUnit(unit, svc, context);
  }
}

function stepMoveUnit(unit: TroopUnit, svc: ReturnType<typeof services>, context: BattleAutoMovePhaseContext): void {
  if (svc.buff.hasBuff(unit.id, StatusEffect.Stun)) {
    unit.isShieldWallActive = false;
    return;
  }
  if (svc.buff.hasBuff(unit.id, StatusEffect.Rooted)) {
    return;
  }

  const dir = FORWARD_DIR[unit.faction];
  const slowPenalty = svc.buff.hasBuff(unit.id, StatusEffect.Slow) ? 1 : 0;
  const moveBudget = Math.max(0, unit.getEffectiveMoveRange() - slowPenalty);

  for (let step = 0; step < moveBudget; step++) {
    const nextDepth = unit.depth + dir;
    const nextCell = context.state.getCell(unit.lane, nextDepth);
    if (!nextCell) break;
    if (context.isCellMovementBlocked(unit.lane, nextDepth)) break;

    if (nextCell.occupantId) {
      const blocker = context.state.units.get(nextCell.occupantId)!;

      if (
        blocker.faction === unit.faction
        && context.isGeneralUnit(unit.id)
        && !context.isGeneralUnit(blocker.id)
        && context.turnManager.canUseGeneralSwap(unit.faction)
      ) {
        const previousLane = unit.lane;
        const previousDepth = unit.depth;

        context.state.getCell(previousLane, previousDepth)!.occupantId = blocker.id;
        nextCell.occupantId = unit.id;

        blocker.moveTo(previousLane, previousDepth);
        unit.moveTo(unit.lane, nextDepth);
        context.turnManager.markGeneralSwapUsed(unit.faction);

        svc.event.emit(EVENT_NAMES.UnitMoved, {
          unitId: blocker.id,
          lane: blocker.lane,
          depth: blocker.depth,
          fromLane: unit.lane,
          fromDepth: nextDepth,
          isSwapPassenger: true,
          swapPartnerId: unit.id,
        });
        svc.event.emit(EVENT_NAMES.UnitMoved, {
          unitId: unit.id,
          lane: unit.lane,
          depth: unit.depth,
          fromLane: previousLane,
          fromDepth: previousDepth,
          swapWithUnitId: blocker.id,
          swapDuration: 2.0,
          swapPassengerFromLane: blocker.lane,
          swapPassengerFromDepth: nextDepth,
          swapPassengerToLane: previousLane,
          swapPassengerToDepth: previousDepth,
        });

        consumeBattleTileBuff(unit, context.state, context.turnManager, svc);
        applyTileEffectOnEnter(unit, dir, svc, context);
        continue;
      }

      if (blocker.faction !== unit.faction && unit.type === TroopType.Shield) {
        unit.isShieldWallActive = true;
      }
      break;
    }

    const prevLane = unit.lane;
    const prevDepth = unit.depth;
    context.state.getCell(unit.lane, unit.depth)!.occupantId = null;
    unit.moveTo(unit.lane, nextDepth);
    nextCell.occupantId = unit.id;
    svc.event.emit(EVENT_NAMES.UnitMoved, {
      unitId: unit.id,
      lane: unit.lane,
      depth: nextDepth,
      fromLane: prevLane,
      fromDepth: prevDepth,
    });
    consumeBattleTileBuff(unit, context.state, context.turnManager, svc);
    applyTileEffectOnEnter(unit, dir, svc, context);
  }
}

function applyTileEffectOnEnter(
  unit: TroopUnit,
  moveDir: number,
  svc: ReturnType<typeof services>,
  context: BattleAutoMovePhaseContext,
): void {
  const effect = context.state.getTileEffect(unit.lane, unit.depth);
  if (!effect?.forcedMoveSteps) {
    return;
  }

  const pushDir = effect.forcedMoveDirection === 'backward' ? -moveDir : moveDir;
  forceMoveUnit(unit, pushDir, effect.forcedMoveSteps, svc, context, `${effect.state}:enter`);
}

function forceMoveUnit(
  unit: TroopUnit,
  dir: number,
  steps: number,
  svc: ReturnType<typeof services>,
  context: BattleAutoMovePhaseContext,
  reason: string,
): void {
  for (let index = 0; index < steps; index++) {
    const nextDepth = unit.depth + dir;
    const nextCell = context.state.getCell(unit.lane, nextDepth);
    if (!nextCell || nextCell.occupantId || context.isCellMovementBlocked(unit.lane, nextDepth)) {
      break;
    }

    const prevLane = unit.lane;
    const prevDepth = unit.depth;
    context.state.getCell(unit.lane, unit.depth)!.occupantId = null;
    unit.moveTo(unit.lane, nextDepth);
    nextCell.occupantId = unit.id;
    svc.event.emit(EVENT_NAMES.UnitMoved, {
      unitId: unit.id,
      lane: unit.lane,
      depth: unit.depth,
      fromLane: prevLane,
      fromDepth: prevDepth,
      forcedMove: true,
      forcedMoveReason: reason,
    });
  }
}