import {
  COUNTER_MULTIPLIER,
  DISADVANTAGE_MULTIPLIER,
  MIN_DAMAGE,
  TERRAIN_ATTACK_MOD,
  TERRAIN_DEFENSE_MOD,
  TerrainType,
  TroopType,
  TROOP_COUNTER_MAP,
} from "../config/Constants";

export interface DamageContext {
  attackerAttack: number;
  defenderDefense: number;
  attackerType: TroopType;
  defenderType: TroopType;
  attackerTerrain: TerrainType;
  defenderTerrain: TerrainType;
  attackBonus?: number;
  defenseBonus?: number;
}

export class FormulaSystem {
  public calculateDamage(context: DamageContext): number {
    const counterMultiplier = this.getCounterMultiplier(context.attackerType, context.defenderType);
    const attackTerrain = 1 + (TERRAIN_ATTACK_MOD[context.attackerTerrain] || 0);
    const defenseTerrain = 1 + (TERRAIN_DEFENSE_MOD[context.defenderTerrain] || 0);
    const attackBonus = 1 + (context.attackBonus || 0);
    const defenseBonus = 1 + (context.defenseBonus || 0);

    const effectiveAttack = context.attackerAttack * counterMultiplier * attackTerrain * attackBonus;
    const effectiveDefense = context.defenderDefense * defenseTerrain * defenseBonus;
    return Math.max(MIN_DAMAGE, Math.floor(effectiveAttack - effectiveDefense));
  }

  public calculateHeal(maxHp: number, ratio = 0.12, floorValue = 20): number {
    return Math.max(floorValue, Math.floor(maxHp * ratio));
  }

  public getCounterMultiplier(attackerType: TroopType, defenderType: TroopType): number {
    if (TROOP_COUNTER_MAP[attackerType] === defenderType) {
      return COUNTER_MULTIPLIER;
    }

    if (TROOP_COUNTER_MAP[defenderType] === attackerType) {
      return DISADVANTAGE_MULTIPLIER;
    }

    return 1;
  }
}