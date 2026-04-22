import { EVENT_NAMES, Faction, GAME_CONFIG, TroopType } from '../../../core/config/Constants';
import { services } from '../../../core/managers/ServiceLoader';
import type { TroopUnit } from '../../../core/models/TroopUnit';
import type { BattleState } from '../../models/BattleState';
import { BattleTurnManager } from '../BattleTurnManager';
import type { SkillExecutionResult } from '../../../shared/SkillRuntimeContract';

const FORWARD_DIR: Record<Faction, number> = {
  [Faction.Player]: 1,
  [Faction.Enemy]: -1,
};

const FRONT_DEPTH: Record<Faction, number> = {
  [Faction.Player]: GAME_CONFIG.GRID_DEPTH - 1,
  [Faction.Enemy]: 0,
};

export interface BattleSpecialResolvePhaseContext {
  readonly state: BattleState;
  readonly actingFaction: Faction;
  readonly turnManager: BattleTurnManager;
  castEnemySeedTactic(battleSkillId: string | null): SkillExecutionResult;
}

export function executeBattleSpecialResolvePhase(context: BattleSpecialResolvePhaseContext): void {
  const svc = services();
  const currentTurn = svc.battle.getSnapshot().turn;

  for (const [, unit] of context.state.units) {
    if (unit.faction !== context.actingFaction) {
      continue;
    }
    if (unit.type === TroopType.Medic) {
      resolveMedic(unit, context.state, svc);
    }
    if (unit.type === TroopType.Engineer) {
      resolveEngineer(unit, context.state, svc);
    }
  }

  const enemyGeneral = context.state.enemyGeneral;
  if (context.actingFaction === Faction.Enemy && enemyGeneral?.canUseSkill() && context.turnManager.canEnemyAutoCastSkill(currentTurn)) {
    const result = context.castEnemySeedTactic(enemyGeneral.skillId ?? enemyGeneral.battlePrimarySkillId ?? null);
    if (result.applied) {
      context.turnManager.markEnemyAutoSkillUsed(currentTurn);
      enemyGeneral.currentSp = 0;
      svc.event.emit(EVENT_NAMES.GeneralSpChanged, {
        faction: Faction.Enemy,
        sp: enemyGeneral.currentSp,
        maxSp: enemyGeneral.maxSp,
      });
      svc.event.emit(EVENT_NAMES.GeneralSkillUsed, {
        faction: Faction.Enemy,
        skillName: result.battleSkillId,
      });
    }
  }
}

function resolveMedic(medic: TroopUnit, state: BattleState, svc: ReturnType<typeof services>): void {
  const dir = FORWARD_DIR[medic.faction];
  const checks = [
    { lane: medic.lane, depth: medic.depth - dir },
    { lane: medic.lane - 1, depth: medic.depth },
    { lane: medic.lane + 1, depth: medic.depth },
  ];

  for (const { lane, depth } of checks) {
    const cell = state.getCell(lane, depth);
    if (!cell?.occupantId) continue;

    const ally = state.units.get(cell.occupantId);
    if (!ally || ally.faction !== medic.faction || ally.currentHp >= ally.getEffectiveMaxHp()) continue;

    const amount = svc.formula.calculateHeal(ally.getEffectiveMaxHp());
    ally.heal(amount);
    svc.event.emit(EVENT_NAMES.UnitHealed, {
      unitId: ally.id,
      amount,
      hp: ally.currentHp,
      sourceId: medic.id,
      lane: ally.lane,
      depth: ally.depth,
    });
  }
}

function resolveEngineer(engineer: TroopUnit, state: BattleState, svc: ReturnType<typeof services>): void {
  if (engineer.depth !== FRONT_DEPTH[engineer.faction]) return;

  const FORTRESS_DMG = 30;
  if (engineer.faction === Faction.Player) {
    state.enemyFortressHp = Math.max(0, state.enemyFortressHp - FORTRESS_DMG);
    svc.event.emit(EVENT_NAMES.FortressDamaged, { faction: Faction.Enemy, hp: state.enemyFortressHp });
  } else {
    state.playerFortressHp = Math.max(0, state.playerFortressHp - FORTRESS_DMG);
    svc.event.emit(EVENT_NAMES.FortressDamaged, { faction: Faction.Player, hp: state.playerFortressHp });
  }
}