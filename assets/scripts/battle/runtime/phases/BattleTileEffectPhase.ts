import { EVENT_NAMES, Faction } from '../../../core/config/Constants';
import { services } from '../../../core/managers/ServiceLoader';
import type { TroopUnit } from '../../../core/models/TroopUnit';
import type { BattleState } from '../../models/BattleState';

export interface BattleTileEffectPhaseContext {
  readonly state: BattleState;
  readonly actingFaction: Faction;
  readonly playerGeneralUnitId: string | null;
  readonly enemyGeneralUnitId: string | null;
  applyUnitDamage(
    unit: TroopUnit,
    damage: number,
    attackerFaction: Faction | null,
    options: {
      attackerId: string | null;
      attackerLane: number | null;
      attackerDepth: number | null;
      damageSource?: string;
      allowDamageLink: boolean;
    },
  ): void;
  onGeneralUnitKilled(faction: Faction, svc: ReturnType<typeof services>): void;
  onUnitKilled(unit: TroopUnit, killer: TroopUnit | null, svc: ReturnType<typeof services>): void;
}

export function executeBattleTileEffectPhase(context: BattleTileEffectPhaseContext): void {
  const svc = services();
  const killed: TroopUnit[] = [];
  const killedIds = new Set<string>();

  for (const [, unit] of context.state.units) {
    if (unit.faction !== context.actingFaction) {
      continue;
    }
    const effect = context.state.getTileEffect(unit.lane, unit.depth);
    if (!effect?.damagePerTurn || unit.isDead()) {
      continue;
    }

    context.applyUnitDamage(unit, effect.damagePerTurn, null, {
      attackerId: null,
      attackerLane: null,
      attackerDepth: null,
      damageSource: effect.state,
      allowDamageLink: true,
    });

    if (unit.isDead() && !killedIds.has(unit.id)) {
      killedIds.add(unit.id);
      killed.push(unit);
    }
  }

  for (const dead of killed) {
    if (dead.id === context.playerGeneralUnitId) {
      context.onGeneralUnitKilled(Faction.Player, svc);
    } else if (dead.id === context.enemyGeneralUnitId) {
      context.onGeneralUnitKilled(Faction.Enemy, svc);
    }
    context.onUnitKilled(dead, null, svc);
  }
}