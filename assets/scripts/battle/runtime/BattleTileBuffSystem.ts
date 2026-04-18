import { EVENT_NAMES } from '../../core/config/Constants';
import { services } from '../../core/managers/ServiceLoader';
import type { TroopUnit } from '../../core/models/TroopUnit';
import type { BattleState } from '../models/BattleState';
import { BattleTurnManager } from './BattleTurnManager';

export function consumeBattleTileBuff(
  unit: TroopUnit,
  state: BattleState,
  turnManager: BattleTurnManager,
  svc: ReturnType<typeof services>,
): void {
  const buff = state.getTileBuff(unit.lane, unit.depth);
  if (!buff) return;

  let attackDelta = 0;
  let hpDelta = 0;
  if (buff.stat === 'attack') {
    attackDelta = buff.op === 'mul'
      ? unit.applyAttackMultiply(buff.factor)
      : unit.applyAttackDivide(buff.factor);
  } else {
    hpDelta = buff.op === 'mul'
      ? unit.applyHpMultiply(buff.factor)
      : unit.applyHpDivide(buff.factor);
  }

  state.removeTileBuff(unit.lane, unit.depth);
  turnManager.markTileBuffConsumed(unit.lane, unit.depth);
  svc.event.emit(EVENT_NAMES.TileBuffConsumed, {
    unitId: unit.id,
    faction: unit.faction,
    lane: unit.lane,
    depth: unit.depth,
    buffText: buff.text,
    attackDelta,
    hpDelta,
  });
}