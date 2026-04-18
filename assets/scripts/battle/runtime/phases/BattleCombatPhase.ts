import { Faction, StatusEffect } from '../../../core/config/Constants';
import { services } from '../../../core/managers/ServiceLoader';
import type { TroopUnit } from '../../../core/models/TroopUnit';
import type { BattleState } from '../../models/BattleState';
import type { BattleCombatAction } from '../BattleCombatResolver';

export interface BattleCombatPhaseContext {
  readonly state: BattleState;
  readonly playerGeneralUnitId: string | null;
  readonly enemyGeneralUnitId: string | null;
  buildAttackAction(unit: TroopUnit, options?: { ignoreDeadOccupants?: boolean }): BattleCombatAction | null;
  damageEnemyGeneral(attacker: TroopUnit, svc: ReturnType<typeof services>): void;
  resolveCombat(attacker: TroopUnit, defender: TroopUnit, svc: ReturnType<typeof services>): void;
  resolveActionResetAfterAttack(attacker: TroopUnit, didKill: boolean, actions: BattleCombatAction[]): void;
  onGeneralUnitKilled(faction: Faction, svc: ReturnType<typeof services>): void;
  onUnitKilled(unit: TroopUnit, killer: TroopUnit | null, svc: ReturnType<typeof services>): void;
}

export function executeBattleCombatPhase(context: BattleCombatPhaseContext): void {
  const svc = services();

  const actions: BattleCombatAction[] = [];
  for (const [, unit] of context.state.units) {
    if (unit.attackRange === 0) continue;
    if (unit.isDead()) continue;
    if (svc.buff.hasBuff(unit.id, StatusEffect.Stun)) continue;
    const action = context.buildAttackAction(unit);
    if (action) {
      actions.push(action);
    }
  }

  const killed: TroopUnit[] = [];
  const killedIds = new Set<string>();

  for (let actionIndex = 0; actionIndex < actions.length; actionIndex += 1) {
    const { attackerId, targetId } = actions[actionIndex];
    const attacker = context.state.units.get(attackerId);
    if (!attacker) continue;
    if (attacker.isDead()) continue;

    if (targetId === null) {
      context.damageEnemyGeneral(attacker, svc);
      context.resolveActionResetAfterAttack(attacker, false, actions);
      continue;
    }

    const defender = context.state.units.get(targetId);
    if (!defender || defender.isDead()) continue;

    context.resolveCombat(attacker, defender, svc);
    context.resolveActionResetAfterAttack(attacker, defender.isDead(), actions);

    if (defender.isDead() && !killedIds.has(defender.id)) {
      killedIds.add(defender.id);
      killed.push(defender);
    }
    if (attacker.isDead() && !killedIds.has(attacker.id)) {
      killedIds.add(attacker.id);
      killed.push(attacker);
    }
  }

  for (const dead of killed) {
    const action = actions.find((item) => item.targetId === dead.id);
    const killer = action ? context.state.units.get(action.attackerId) : undefined;

    if (dead.id === context.playerGeneralUnitId) {
      context.onGeneralUnitKilled(Faction.Player, svc);
    } else if (dead.id === context.enemyGeneralUnitId) {
      context.onGeneralUnitKilled(Faction.Enemy, svc);
    }

    context.onUnitKilled(dead, killer ?? null, svc);
  }

  for (const [, unit] of context.state.units) {
    unit.isShieldWallActive = false;
  }
}