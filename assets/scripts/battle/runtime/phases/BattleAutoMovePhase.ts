import { BattleTactic, EVENT_NAMES, Faction, StatusEffect, TroopType } from '../../../core/config/Constants';
import { services } from '../../../core/managers/ServiceLoader';
import type { TroopUnit } from '../../../core/models/TroopUnit';
import type { BattleState } from '../../models/BattleState';
import { BattleTurnManager } from '../BattleTurnManager';
import { resolveBattleTacticBehavior } from '../../shared/BattleTacticBehavior';

const FORWARD_DIR: Record<Faction, number> = {
  [Faction.Player]: 1,
  [Faction.Enemy]: -1,
};

export interface BattleAutoMovePhaseContext {
  readonly state: BattleState;
  readonly actingFaction: Faction;
  readonly turnManager: BattleTurnManager;
  consumeTileBuff(unit: TroopUnit): void;
  getFactionUnits(faction: Faction): TroopUnit[];
  isCellMovementBlocked(lane: number, depth: number): boolean;
  isGeneralUnit(unitId: string): boolean;
}

export function executeBattleAutoMovePhase(context: BattleAutoMovePhaseContext): void {
  const svc = services();
  const units = context.getFactionUnits(context.actingFaction);
  units.sort((a, b) => {
    const depthDelta = context.actingFaction === Faction.Player
      ? b.depth - a.depth
      : a.depth - b.depth;
    if (depthDelta !== 0) {
      return depthDelta;
    }
    return a.lane - b.lane;
  });

  for (const unit of units) {
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
  const tacticMoveRange = resolveBattleTacticBehavior(context.state.battleTactic).getEffectiveMoveRange(unit, context.state);
  const isFloodBattle = context.state.battleTactic === BattleTactic.FloodAttack;
  const baseMoveRange = isFloodBattle ? 1 : tacticMoveRange;
  let remainingMoveBudget = Math.max(0, baseMoveRange - slowPenalty);
  if (!isFloodBattle) {
    remainingMoveBudget += resolveTileMoveRangeDelta(context.state, unit.lane, unit.depth);
  }

  while (remainingMoveBudget > 0) {
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
        context.turnManager.markUnitMoved(blocker.id);
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
        context.turnManager.markUnitMoved(unit.id);

        context.consumeTileBuff(unit);
        remainingMoveBudget -= 1;
        remainingMoveBudget += applyTileEffectOnEnter(unit, dir, svc, context);
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
    context.turnManager.markUnitMoved(unit.id);
    context.consumeTileBuff(unit);
    remainingMoveBudget -= 1;
    remainingMoveBudget += applyTileEffectOnEnter(unit, dir, svc, context);
  }
}

function applyTileEffectOnEnter(
  unit: TroopUnit,
  moveDir: number,
  svc: ReturnType<typeof services>,
  context: BattleAutoMovePhaseContext,
): number {
  const effect = context.state.getTileEffect(unit.lane, unit.depth);
  if (!effect?.forcedMoveSteps) {
    return resolveTileMoveRangeDelta(context.state, unit.lane, unit.depth);
  }

  const pushDir = effect.forcedMoveDirection === 'backward' ? -moveDir : moveDir;
  forceMoveUnit(unit, pushDir, effect.forcedMoveSteps, svc, context, `${effect.state}:enter`);
  return resolveTileMoveRangeDelta(context.state, unit.lane, unit.depth);
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
    context.turnManager.markUnitMoved(unit.id);
  }
}

function resolveTileMoveRangeDelta(state: BattleState, lane: number, depth: number): number {
  return state.getTileEffect(lane, depth)?.moveRangeDelta ?? 0;
}