import { Faction, StatusEffect, TerrainType, TroopType } from '../assets/scripts/core/config/Constants';
import { GeneralUnit } from '../assets/scripts/core/models/GeneralUnit';
import { TroopUnit, type TroopStats } from '../assets/scripts/core/models/TroopUnit';
import type { BattleSkillExecutionContext } from '../assets/scripts/battle/skills/BattleSkillResolver';

export interface BattleSkillTestContextBundle {
  context: BattleSkillExecutionContext;
  damageLog: Array<{ unitId: string; damage: number; casterFaction: Faction }>;
  healLog: Array<{ unitId: string; amount: number; casterFaction: Faction }>;
  buffLog: Array<{ unitId: string; effect: StatusEffect; turns: number }>;
  linkLog: Array<{ primaryUnitId: string; linkedUnitIds: string[]; shareRatio: number; battleSkillId: string }>;
  counterLog: Array<{ unitId: string; battleSkillId: string; counterRatio: number; statusTurns: number; triggers: number; meleeOnly: boolean }>;
  resetLog: Array<{ unitId: string; battleSkillId: string; firstHitMultiplier: number; extraActions: number }>;
  effectLog: Array<{ skillId: string; casterFaction: Faction }>;
}

export function createTestUnit(
  id: string,
  faction: Faction,
  lane: number,
  depth: number,
  stats: Partial<TroopStats> = {},
): TroopUnit {
  const unit = new TroopUnit(id, stats.attackRange === 2 ? TroopType.Archer : TroopType.Infantry, faction, {
    hp: stats.hp ?? 100,
    attack: stats.attack ?? 30,
    defense: stats.defense ?? 10,
    moveRange: stats.moveRange ?? 1,
    attackRange: stats.attackRange ?? 1,
  });
  unit.moveTo(lane, depth);
  return unit;
}

export function createTestGeneral(
  id: string,
  faction: Faction,
  overrides: Partial<ConstructorParameters<typeof GeneralUnit>[0]> = {},
): GeneralUnit {
  return new GeneralUnit({
    id,
    name: id,
    faction,
    hp: overrides.hp ?? 1000,
    maxSp: overrides.maxSp ?? 100,
    initialSp: overrides.initialSp ?? 100,
    str: overrides.str ?? 100,
    int: overrides.int ?? 60,
    lea: overrides.lea ?? 90,
    luk: overrides.luk ?? 30,
    attackBonus: overrides.attackBonus ?? 0,
    skillId: overrides.skillId,
    battlePrimarySkillId: overrides.battlePrimarySkillId,
  });
}

export function createBattleSkillTestContext(options: {
  playerGeneral?: GeneralUnit;
  enemyGeneral?: GeneralUnit;
  units: TroopUnit[];
  terrainByCell?: Record<string, TerrainType>;
}): BattleSkillTestContextBundle {
  const unitsById = new Map(options.units.map((unit) => [unit.id, unit]));
  const damageLog: BattleSkillTestContextBundle['damageLog'] = [];
  const healLog: BattleSkillTestContextBundle['healLog'] = [];
  const buffLog: BattleSkillTestContextBundle['buffLog'] = [];
  const linkLog: BattleSkillTestContextBundle['linkLog'] = [];
  const counterLog: BattleSkillTestContextBundle['counterLog'] = [];
  const resetLog: BattleSkillTestContextBundle['resetLog'] = [];
  const effectLog: BattleSkillTestContextBundle['effectLog'] = [];

  const context: BattleSkillExecutionContext = {
    getFactionUnits: (faction: Faction) => options.units.filter((unit) => unit.faction === faction && !unit.isDead()),
    getOpposingUnits: (casterFaction: Faction) => options.units.filter((unit) => unit.faction !== casterFaction && !unit.isDead()),
    getBoardCells: () => {
      const cells: Array<{ lane: number; depth: number }> = [];
      for (let lane = 0; lane < 5; lane++) {
        for (let depth = 0; depth < 8; depth++) {
          cells.push({ lane, depth });
        }
      }
      return cells;
    },
    getUnit: (unitId: string) => unitsById.get(unitId) ?? null,
    getCasterGeneral: (casterFaction: Faction) => casterFaction === Faction.Player
      ? options.playerGeneral ?? null
      : options.enemyGeneral ?? null,
    getTerrain: (lane: number, depth: number) => options.terrainByCell?.[`${lane},${depth}`] ?? TerrainType.Plain,
    applyDamage: (unit: TroopUnit, damage: number, casterFaction: Faction) => {
      damageLog.push({ unitId: unit.id, damage, casterFaction });
      unit.takeDamage(damage);
    },
    healUnit: (unit: TroopUnit, amount: number, casterFaction: Faction) => {
      healLog.push({ unitId: unit.id, amount, casterFaction });
      unit.heal(amount);
    },
    applyBuff: (unit: TroopUnit, effect: StatusEffect, turns: number) => {
      buffLog.push({ unitId: unit.id, effect, turns });
    },
    registerDamageLink: (primaryUnit: TroopUnit, linkedUnits: TroopUnit[], shareRatio: number, battleSkillId: string) => {
      linkLog.push({
        primaryUnitId: primaryUnit.id,
        linkedUnitIds: linkedUnits.map((unit) => unit.id),
        shareRatio,
        battleSkillId,
      });
    },
    registerCounterReaction: (targetUnit: TroopUnit, battleSkillId: string, counterRatio: number, statusTurns: number, triggers: number, meleeOnly: boolean) => {
      counterLog.push({
        unitId: targetUnit.id,
        battleSkillId,
        counterRatio,
        statusTurns,
        triggers,
        meleeOnly,
      });
    },
    registerActionReset: (targetUnit: TroopUnit, battleSkillId: string, firstHitMultiplier: number, extraActions: number) => {
      resetLog.push({
        unitId: targetUnit.id,
        battleSkillId,
        firstHitMultiplier,
        extraActions,
      });
    },
    emitSkillEffect: (skillId: string, casterFaction: Faction) => {
      effectLog.push({ skillId, casterFaction });
    },
  };

  return {
    context,
    damageLog,
    healLog,
    buffLog,
    linkLog,
    counterLog,
    resetLog,
    effectLog,
  };
}
