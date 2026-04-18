import { TerrainType, TroopType } from '../../core/config/Constants';
import { GeneralUnit } from '../../core/models/GeneralUnit';
import { TroopUnit } from '../../core/models/TroopUnit';
import { FormulaSystem } from '../../core/systems/FormulaSystem';
import type { SkillScalingStat } from '../../shared/SkillRuntimeContract';
import type { BattleSkillExecutionContext } from './BattleSkillResolver';
import type { BattleSkillProfile } from './BattleSkillProfiles';

export class BattleSkillDamageResolver {
  constructor(private readonly formula = new FormulaSystem()) {}

  public resolveDamage(
    profile: BattleSkillProfile,
    caster: GeneralUnit,
    target: TroopUnit,
    context: BattleSkillExecutionContext,
    hitIndex: number,
  ): number {
    const scaledAttack = this.resolveScaledAttack(profile, caster, hitIndex);
    const rawDefense = profile.ignoreDefense ? 0 : target.defense * (target.isShieldWallActive ? 2 : 1);
    const penetration = profile.defensePenetrationRatio ?? 0;
    const defenderDefense = Math.floor(rawDefense * (1 - penetration));

    const baseDamage = this.formula.calculateDamage({
      attackerAttack: scaledAttack,
      defenderDefense,
      attackerType: this.resolveVirtualAttackerType(caster),
      defenderType: target.type,
      attackerTerrain: TerrainType.Plain,
      defenderTerrain: context.getTerrain(target.lane, target.depth),
      attackBonus: caster.attackBonus,
    });

    if (profile.critBonus) {
      return Math.max(1, Math.floor(baseDamage * (1 + profile.critBonus)));
    }
    return baseDamage;
  }

  private resolveScaledAttack(
    profile: BattleSkillProfile,
    caster: GeneralUnit,
    hitIndex: number,
  ): number {
    const baseAttack = this.resolveCasterAttack(caster, profile.scalingStat);
    const coefficientAttack = Math.max(1, Math.floor(baseAttack * profile.coefficient));
    const falloffMultiplier = this.resolveFalloffMultiplier(profile, hitIndex);
    return Math.max(1, Math.floor(coefficientAttack * falloffMultiplier));
  }

  private resolveCasterAttack(caster: GeneralUnit, scalingStat?: SkillScalingStat): number {
    if (scalingStat === 'int') {
      return this.formula.calculateGeneralAttack({
        int: caster.int,
        lea: caster.lea,
        maxHp: caster.maxHp,
      });
    }

    if (scalingStat === 'str') {
      return this.formula.calculateGeneralAttack({
        str: caster.str,
        lea: caster.lea,
        maxHp: caster.maxHp,
      });
    }

    if (scalingStat === 'lea') {
      return Math.max(1, Math.floor(caster.lea));
    }

    return caster.int > caster.str
      ? this.formula.calculateGeneralAttack({ int: caster.int, lea: caster.lea, maxHp: caster.maxHp })
      : this.formula.calculateGeneralAttack({ str: caster.str, lea: caster.lea, maxHp: caster.maxHp });
  }

  private resolveFalloffMultiplier(profile: BattleSkillProfile, hitIndex: number): number {
    if (profile.falloffRule !== 'linear-step') {
      return 1;
    }

    return Math.max(0.55, 1 - hitIndex * 0.1);
  }

  private resolveVirtualAttackerType(caster: GeneralUnit): TroopType {
    if (caster.int > caster.str) {
      return TroopType.Archer;
    }

    return TroopType.Infantry;
  }
}
