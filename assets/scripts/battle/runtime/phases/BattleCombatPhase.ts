import { Faction, StatusEffect } from '../../../core/config/Constants';
import { services } from '../../../core/managers/ServiceLoader';
import type { TroopUnit } from '../../../core/models/TroopUnit';
import type { BattleState } from '../../models/BattleState';
import type { BattleCombatAction } from '../BattleCombatResolver';

export interface BattleCombatPhaseContext {
  readonly state: BattleState;
  readonly actingFaction: Faction;
  readonly playerGeneralUnitId: string | null;
  readonly enemyGeneralUnitId: string | null;
  buildAttackAction(unit: TroopUnit, options?: { ignoreDeadOccupants?: boolean }): BattleCombatAction | null;
  damageEnemyGeneral(attacker: TroopUnit, svc: ReturnType<typeof services>): void;
  resolveCombat(attacker: TroopUnit, defender: TroopUnit, svc: ReturnType<typeof services>): void;
  advanceAfterKill(attacker: TroopUnit, svc: ReturnType<typeof services>): void;
  resolveActionResetAfterAttack(attacker: TroopUnit, didKill: boolean, actions: BattleCombatAction[]): void;
  onGeneralUnitKilled(faction: Faction, svc: ReturnType<typeof services>): void;
  onUnitKilled(unit: TroopUnit, killer: TroopUnit | null, svc: ReturnType<typeof services>): void;
}

export function executeBattleCombatPhase(context: BattleCombatPhaseContext): void {
  const svc = services();
  const actions: BattleCombatAction[] = buildFactionAttackActions(context, context.actingFaction, svc);

  for (let actionIndex = 0; actionIndex < actions.length; actionIndex += 1) {
    const { attackerId, targetId } = actions[actionIndex];
    const attacker = context.state.units.get(attackerId);
    if (!attacker) continue;
    if (attacker.isDead()) continue;

    if (targetId === null) {
      context.damageEnemyGeneral(attacker, svc);
      const previousLength = actions.length;
      context.resolveActionResetAfterAttack(attacker, false, actions);
      relocateFollowUpActions(actions, actionIndex, previousLength);
      continue;
    }

    const defender = context.state.units.get(targetId);
    if (!defender || defender.isDead()) continue;

    context.resolveCombat(attacker, defender, svc);
    const didKillDefender = defender.isDead();
    const previousLength = actions.length;

    if (didKillDefender) {
      resolveImmediateUnitDeath(context, defender, attacker, svc);
      context.advanceAfterKill(attacker, svc);
    }

    context.resolveActionResetAfterAttack(attacker, didKillDefender, actions);
    relocateFollowUpActions(actions, actionIndex, previousLength);

    if (attacker.isDead()) {
      resolveImmediateUnitDeath(context, attacker, defender, svc);
    }
  }

  for (const [, unit] of context.state.units) {
    unit.isShieldWallActive = false;
  }
}

function buildFactionAttackActions(
  context: BattleCombatPhaseContext,
  faction: Faction,
  svc: ReturnType<typeof services>,
): BattleCombatAction[] {
  const units: TroopUnit[] = [];

  for (const [, unit] of context.state.units) {
    if (unit.faction !== faction) continue;
    if (unit.attackRange === 0) continue;
    if (unit.isDead()) continue;
    if (svc.buff.hasBuff(unit.id, StatusEffect.Stun)) continue;
    units.push(unit);
  }

  units.sort((a, b) => {
    const depthDelta = faction === Faction.Player
      ? b.depth - a.depth
      : a.depth - b.depth;
    if (depthDelta !== 0) {
      return depthDelta;
    }
    return a.lane - b.lane;
  });

  const actions: BattleCombatAction[] = [];
  for (const unit of units) {
    const action = context.buildAttackAction(unit);
    if (action) {
      actions.push(action);
    }
  }

  return actions;
}

function resolveImmediateUnitDeath(
  context: BattleCombatPhaseContext,
  unit: TroopUnit,
  killer: TroopUnit | null,
  svc: ReturnType<typeof services>,
): void {
  if (!context.state.units.has(unit.id)) {
    return;
  }

  if (unit.id === context.playerGeneralUnitId) {
    context.onGeneralUnitKilled(Faction.Player, svc);
  } else if (unit.id === context.enemyGeneralUnitId) {
    context.onGeneralUnitKilled(Faction.Enemy, svc);
  }

  context.onUnitKilled(unit, killer, svc);
}

function relocateFollowUpActions(
  actions: BattleCombatAction[],
  currentActionIndex: number,
  previousLength: number,
): void {
  if (actions.length <= previousLength) {
    return;
  }

  const followUps = actions.splice(previousLength, actions.length - previousLength);
  actions.splice(currentActionIndex + 1, 0, ...followUps);
}