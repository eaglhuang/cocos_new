import { EVENT_NAMES, Faction, GAME_CONFIG } from '../../core/config/Constants';
import { services } from '../../core/managers/ServiceLoader';
import { GeneralUnit } from '../../core/models/GeneralUnit';
import type { TroopUnit } from '../../core/models/TroopUnit';
import type { BattleState } from '../models/BattleState';
import { BattleCombatResolver } from './BattleCombatResolver';
import type { BattleResult } from './BattleRuntimeContract';

export interface BattleDuelResolverContext {
  readonly state: BattleState;
  readonly combatResolver: BattleCombatResolver;
  getPlayerGeneralUnitId(): string | null;
  getEnemyGeneralUnitId(): string | null;
  setPlayerGeneralUnitId(unitId: string | null): void;
  setEnemyGeneralUnitId(unitId: string | null): void;
  checkVictory(): BattleResult;
}

export class BattleDuelResolver {
  constructor(private readonly context: BattleDuelResolverContext) {}

  public canPlayerGeneralDuel(): boolean {
    if (this.context.getPlayerGeneralUnitId()) return false;
    const playerGeneral = this.context.state.playerGeneral;
    if (!playerGeneral || playerGeneral.isDead()) return false;

    for (let lane = 0; lane < GAME_CONFIG.GRID_LANES; lane += 1) {
      const cell = this.context.state.getCell(lane, 0);
      if (!cell?.occupantId) {
        continue;
      }
      const unit = this.context.state.units.get(cell.occupantId);
      if (unit && unit.faction === Faction.Player) {
        return false;
      }
    }

    return true;
  }

  public isGeneralFacingEnemyGeneral(faction: Faction): boolean {
    const unitId = faction === Faction.Player
      ? this.context.getPlayerGeneralUnitId()
      : this.context.getEnemyGeneralUnitId();
    if (!unitId) return false;

    const unit = this.context.state.units.get(unitId);
    if (!unit) return false;

    const frontDepth = faction === Faction.Player ? GAME_CONFIG.GRID_DEPTH - 1 : 0;
    return unit.depth === frontDepth;
  }

  public evaluateDuelAcceptance(challengerFaction: Faction): {
    accepted: boolean;
    score: number;
    defenderFaction: Faction;
  } {
    const defenderFaction = challengerFaction === Faction.Player ? Faction.Enemy : Faction.Player;
    const challengerGeneral = this.context.state.getGeneral(challengerFaction);
    const defenderGeneral = this.context.state.getGeneral(defenderFaction);

    if (!challengerGeneral || !defenderGeneral) {
      return { accepted: false, score: 0, defenderFaction };
    }

    const challengerHpPct = Math.max(0, challengerGeneral.currentHp) / Math.max(1, challengerGeneral.maxHp);
    const defenderHpPct = Math.max(0, defenderGeneral.currentHp) / Math.max(1, defenderGeneral.maxHp);
    const hpAdvantage = defenderHpPct / Math.max(0.0001, challengerHpPct + defenderHpPct);

    const challengerUnits = this.context.combatResolver.getFactionUnits(challengerFaction);
    const defenderUnits = this.context.combatResolver.getFactionUnits(defenderFaction);
    const unitCountAdvantage = defenderUnits.length / Math.max(1, challengerUnits.length + defenderUnits.length);

    const calcPower = (units: TroopUnit[], general: GeneralUnit | null): number => {
      const unitPower = units.reduce((sum, unit) => {
        return sum + unit.getEffectiveAttack() + unit.getEffectiveMaxHp() * 0.1;
      }, 0);
      const generalPower = general
        ? (Math.max(0, general.currentHp) * 0.12 + general.attackBonus * 120)
        : 0;
      return unitPower + generalPower;
    };

    const challengerPower = calcPower(challengerUnits, challengerGeneral);
    const defenderPower = calcPower(defenderUnits, defenderGeneral);
    const powerAdvantage = defenderPower / Math.max(0.0001, challengerPower + defenderPower);

    const score = 0.45 * hpAdvantage + 0.35 * unitCountAdvantage + 0.2 * powerAdvantage;
    const accepted = score >= 0.58;

    return {
      accepted,
      score,
      defenderFaction,
    };
  }

  public resolveAcceptedGeneralDuel(
    challengerFaction: Faction,
    defenderFaction: Faction,
    svc: ReturnType<typeof services>,
  ): BattleResult {
    const challengerGeneral = this.context.state.getGeneral(challengerFaction);
    const defenderGeneral = this.context.state.getGeneral(defenderFaction);
    if (!challengerGeneral || !defenderGeneral) {
      return this.context.checkVictory();
    }

    const challengerUnitId = challengerFaction === Faction.Player
      ? this.context.getPlayerGeneralUnitId()
      : this.context.getEnemyGeneralUnitId();
    const defenderUnitId = defenderFaction === Faction.Player
      ? this.context.getPlayerGeneralUnitId()
      : this.context.getEnemyGeneralUnitId();
    const challengerUnit = challengerUnitId ? this.context.state.units.get(challengerUnitId) ?? null : null;
    const defenderUnit = defenderUnitId ? this.context.state.units.get(defenderUnitId) ?? null : null;

    const getAttack = (general: GeneralUnit, unit: TroopUnit | null): number => {
      if (unit) {
        return unit.getEffectiveAttack();
      }
      return svc.formula.calculateGeneralAttack({
        str: general.str,
        int: general.int,
        lea: general.lea,
        maxHp: general.maxHp,
      });
    };

    const challengerAttack = getAttack(challengerGeneral, challengerUnit);
    const defenderAttack = getAttack(defenderGeneral, defenderUnit);

    while (!challengerGeneral.isDead() && !defenderGeneral.isDead()) {
      const defenderDodged = svc.formula.rollDodge(defenderGeneral.luk);
      let attackDmg = challengerAttack;
      let challengerCrit = false;
      if (defenderDodged) {
        attackDmg = 0;
      } else {
        challengerCrit = svc.formula.rollCrit(challengerGeneral.luk);
        if (challengerCrit) {
          attackDmg = Math.floor(attackDmg * GAME_CONFIG.GENERAL_CRIT_DAMAGE_MULTIPLIER);
        }
        defenderGeneral.takeDamage(attackDmg);
      }
      svc.event.emit(EVENT_NAMES.GeneralDamaged, {
        faction: defenderFaction,
        hp: defenderGeneral.currentHp,
        damage: attackDmg,
        attackerId: challengerUnit?.id ?? null,
        isCrit: challengerCrit,
        wasDodged: defenderDodged,
      });

      if (defenderUnit) {
        defenderUnit.currentHp = defenderGeneral.currentHp;
      }

      if (defenderGeneral.isDead()) {
        break;
      }

      const challengerDodged = svc.formula.rollDodge(challengerGeneral.luk);
      let defenseDmg = defenderAttack;
      let defenderCrit = false;
      if (challengerDodged) {
        defenseDmg = 0;
      } else {
        defenderCrit = svc.formula.rollCrit(defenderGeneral.luk);
        if (defenderCrit) {
          defenseDmg = Math.floor(defenseDmg * GAME_CONFIG.GENERAL_CRIT_DAMAGE_MULTIPLIER);
        }
        challengerGeneral.takeDamage(defenseDmg);
      }
      svc.event.emit(EVENT_NAMES.GeneralDamaged, {
        faction: challengerFaction,
        hp: challengerGeneral.currentHp,
        damage: defenseDmg,
        attackerId: defenderUnit?.id ?? null,
        isCrit: defenderCrit,
        wasDodged: challengerDodged,
      });

      if (challengerUnit) {
        challengerUnit.currentHp = challengerGeneral.currentHp;
      }
    }

    if (challengerGeneral.isDead() && challengerUnit) {
      this.context.combatResolver.onGeneralUnitKilled(challengerFaction, svc);
      this.context.combatResolver.onUnitKilled(challengerUnit, null, svc);
    }

    if (defenderGeneral.isDead() && defenderUnit) {
      this.context.combatResolver.onGeneralUnitKilled(defenderFaction, svc);
      this.context.combatResolver.onUnitKilled(defenderUnit, null, svc);
    }

    return this.context.checkVictory();
  }

  public applyDuelPenalty(faction: Faction): void {
    this.context.state.units.forEach((unit) => {
      if (unit.faction !== faction) return;
      const atkLoss = -Math.floor(unit.getEffectiveAttack() / 2);
      unit.attackBonus += atkLoss;
      const hpLoss = -Math.floor(unit.getEffectiveMaxHp() / 2);
      unit.maxHpBonus += hpLoss;
      unit.currentHp = Math.max(1, Math.floor(unit.currentHp / 2));
      unit.currentHp = Math.min(unit.currentHp, unit.getEffectiveMaxHp());
      unit.currentHp = Math.max(1, unit.currentHp);
    });

    const general = this.context.state.getGeneral(faction);
    if (general) {
      general.currentHp = Math.max(1, Math.floor(general.currentHp / 2));
    }

    services().event.emit(EVENT_NAMES.DuelPenaltyApplied, { faction });
  }
}