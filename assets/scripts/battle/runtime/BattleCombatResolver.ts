import { EVENT_NAMES, Faction, GAME_CONFIG, SP_PER_KILL, StatusEffect, TerrainType, WEAK_ATTACK_MULTIPLIER } from '../../core/config/Constants';
import { services } from '../../core/managers/ServiceLoader';
import type { TroopUnit } from '../../core/models/TroopUnit';
import type { BattleState } from '../models/BattleState';
import { resolveBattleTacticBehavior } from '../shared/BattleTacticBehavior';

export interface BattleCombatAction {
  attackerId: string;
  targetId: string | null;
}

export interface BattleCombatResolverContext {
  readonly state: BattleState;
  getPlayerGeneralUnitId(): string | null;
  getEnemyGeneralUnitId(): string | null;
  setPlayerGeneralUnitId(unitId: string | null): void;
  setEnemyGeneralUnitId(unitId: string | null): void;
}

export class BattleCombatResolver {
  constructor(private readonly context: BattleCombatResolverContext) {}

  public getFactionUnits(faction: Faction): TroopUnit[] {
    const result: TroopUnit[] = [];
    this.context.state.units.forEach((unit) => {
      if (unit.faction === faction) {
        result.push(unit);
      }
    });
    return result;
  }

  public isCellMovementBlocked(lane: number, depth: number): boolean {
    return this.context.state.getTileEffect(lane, depth)?.blocksMovement === true;
  }

  public isGeneralUnit(unitId: string): boolean {
    return unitId === this.context.getPlayerGeneralUnitId() || unitId === this.context.getEnemyGeneralUnitId();
  }

  public buildAttackAction(
    unit: TroopUnit,
    options: { ignoreDeadOccupants?: boolean } = {},
  ): BattleCombatAction | null {
    const target = this.findCombatTarget(unit, options);
    if (target) {
      return { attackerId: unit.id, targetId: target.id };
    }
    if (this.canAttackGeneral(unit)) {
      return { attackerId: unit.id, targetId: null };
    }
    return null;
  }

  public damageEnemyGeneral(attacker: TroopUnit, svc: ReturnType<typeof services>): void {
    const tacticBehavior = resolveBattleTacticBehavior(this.context.state.battleTactic);
    const enemyFaction = attacker.faction === Faction.Player ? Faction.Enemy : Faction.Player;
    const general = this.context.state.getGeneral(enemyFaction);
    if (!general || general.isDead()) return;

    // 武將可以閃躲兵硬攻擊（對應 E-14 閃躲機率）
    const wasDodged = svc.formula.rollDodge(general.luk);
    if (wasDodged) {
      svc.event.emit(EVENT_NAMES.GeneralDamaged, {
        faction: enemyFaction,
        hp: general.currentHp,
        damage: 0,
        attackerId: attacker.id,
        wasDodged: true,
        isCrit: false,
      });
      return;
    }

    const damageAdjustment = tacticBehavior.resolveDamageAdjustment({
      kind: 'general',
      attacker,
      baseDamage: attacker.getEffectiveAttack(),
      state: this.context.state,
    });
    const atk = damageAdjustment.damage;
    let finalAttack = atk;
    const actionReset = this.context.state.getActionReset(attacker.id);
    if (actionReset?.firstHitPending) {
      finalAttack = Math.max(1, Math.floor(finalAttack * actionReset.firstHitMultiplier));
    }
    if (svc.buff.hasBuff(attacker.id, StatusEffect.Weak)) {
      finalAttack = Math.max(1, Math.floor(finalAttack * WEAK_ATTACK_MULTIPLIER));
    }
    general.takeDamage(finalAttack);
    svc.event.emit(EVENT_NAMES.GeneralDamaged, {
      faction: enemyFaction,
      hp: general.currentHp,
      damage: finalAttack,
      attackerId: attacker.id,
      wasDodged: false,
      isCrit: false,
    });
  }

  public resolveCombat(attacker: TroopUnit, defender: TroopUnit, svc: ReturnType<typeof services>): void {
    const tacticBehavior = resolveBattleTacticBehavior(this.context.state.battleTactic);
    const attackerGeneral = this.context.state.getGeneral(attacker.faction);
    const aCell = this.context.state.getCell(attacker.lane, attacker.depth);
    const dCell = this.context.state.getCell(defender.lane, defender.depth);

    // 盾牆：防禦力加倍
    const effectiveDef = defender.defense * (defender.isShieldWallActive ? 2 : 1);

    let damage = svc.formula.calculateDamage({
      attackerAttack: attacker.getEffectiveAttack(),
      defenderDefense: effectiveDef,
      attackerType: attacker.type,
      defenderType: defender.type,
      attackerTerrain: aCell?.terrain ?? TerrainType.Plain,
      defenderTerrain: dCell?.terrain ?? TerrainType.Plain,
      attackBonus: attackerGeneral?.attackBonus,
    });

    const damageAdjustment = tacticBehavior.resolveDamageAdjustment({
      kind: 'unit',
      attacker,
      baseDamage: damage,
      state: this.context.state,
    });
    damage = damageAdjustment.damage;
    const actionReset = this.context.state.getActionReset(attacker.id);
    if (actionReset?.firstHitPending) {
      damage = Math.max(1, Math.floor(damage * actionReset.firstHitMultiplier));
    }
    if (svc.buff.hasBuff(attacker.id, StatusEffect.Weak)) {
      damage = Math.max(1, Math.floor(damage * WEAK_ATTACK_MULTIPLIER));
    }

    this.applyUnitDamage(defender, damage, attacker.faction, {
      attackerId: attacker.id,
      attackerLane: attacker.lane,
      attackerDepth: attacker.depth,
      damageSource: damageAdjustment.damageSource,
      allowDamageLink: true,
    });

    if (!defender.isDead()) {
      this.tryTriggerCounterReaction(defender, attacker, svc);
    }
  }

  public resolveActionResetAfterAttack(
    attacker: TroopUnit,
    didKill: boolean,
    actions: BattleCombatAction[],
  ): void {
    const actionReset = this.context.state.getActionReset(attacker.id);
    if (!actionReset) {
      return;
    }

    if (attacker.isDead()) {
      this.context.state.removeActionReset(attacker.id);
      return;
    }

    let nextState = {
      ...actionReset,
      firstHitPending: false,
    };

    if (didKill && nextState.remainingExtraActions > 0) {
      const followUpAction = this.buildAttackAction(attacker, { ignoreDeadOccupants: true });
      nextState.remainingExtraActions -= 1;
      if (followUpAction) {
        actions.push(followUpAction);
      }
    } else {
      nextState.remainingExtraActions = 0;
    }

    if (!nextState.firstHitPending && nextState.remainingExtraActions <= 0) {
      this.context.state.removeActionReset(attacker.id);
      return;
    }

    this.context.state.setActionReset(nextState);
  }

  public applyUnitDamage(
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
  ): void {
    const svc = services();
    unit.takeDamage(damage);
    svc.event.emit(EVENT_NAMES.UnitDamaged, {
      unitId: unit.id,
      damage,
      hp: unit.currentHp,
      attackerId: options.attackerId,
      attackerLane: options.attackerLane,
      attackerDepth: options.attackerDepth,
      defenderLane: unit.lane,
      defenderDepth: unit.depth,
      attackerFaction,
      damageSource: options.damageSource,
    });

    if (!options.allowDamageLink) {
      return;
    }

    const link = this.context.state.getDamageLink(unit.id);
    if (!link) {
      return;
    }

    const sharedDamage = Math.max(1, Math.floor(damage * link.shareRatio));
    for (const linkedUnitUid of link.linkedUnitUids) {
      const linkedUnit = this.context.state.units.get(linkedUnitUid);
      if (!linkedUnit || linkedUnit.isDead()) {
        continue;
      }
      linkedUnit.takeDamage(sharedDamage);
      svc.event.emit(EVENT_NAMES.UnitDamaged, {
        unitId: linkedUnit.id,
        damage: sharedDamage,
        hp: linkedUnit.currentHp,
        attackerId: options.attackerId,
        attackerLane: options.attackerLane,
        attackerDepth: options.attackerDepth,
        defenderLane: linkedUnit.lane,
        defenderDepth: linkedUnit.depth,
        attackerFaction,
        damageSource: `linked-share:${link.battleSkillId}`,
      });
      if (linkedUnit.isDead()) {
        if (linkedUnit.id === this.context.getPlayerGeneralUnitId()) {
          this.onGeneralUnitKilled(Faction.Player, svc);
        } else if (linkedUnit.id === this.context.getEnemyGeneralUnitId()) {
          this.onGeneralUnitKilled(Faction.Enemy, svc);
        }
        this.onUnitKilled(linkedUnit, null, svc);
      }
    }
  }

  public onGeneralUnitKilled(faction: Faction, svc: ReturnType<typeof services>): void {
    const general = this.context.state.getGeneral(faction);
    if (general) {
      general.currentHp = 0;
      svc.event.emit(EVENT_NAMES.GeneralDamaged, {
        faction,
        hp: 0,
        damage: 0,
        attackerId: null,
      });
    }
    if (faction === Faction.Player) {
      this.context.setPlayerGeneralUnitId(null);
    } else {
      this.context.setEnemyGeneralUnitId(null);
    }
  }

  public onUnitKilled(
    unit: TroopUnit,
    killer: TroopUnit | null,
    svc: ReturnType<typeof services>,
  ): void {
    if (!this.context.state.units.has(unit.id)) return;

    const { lane, depth, faction, type } = unit;
    this.context.state.removeUnit(unit.id);
    svc.buff.clearUnit(unit.id);
    svc.event.emit(EVENT_NAMES.UnitDied, { unitId: unit.id, lane, depth, faction, type });

    if (killer) {
      const general = this.context.state.getGeneral(killer.faction);
      if (general) {
        general.addSp(SP_PER_KILL);
        svc.event.emit(EVENT_NAMES.GeneralSpChanged, {
          faction: killer.faction,
          sp: general.currentSp,
          maxSp: general.maxSp,
        });
      }
    }
  }

  private findCombatTarget(
    unit: TroopUnit,
    options: { ignoreDeadOccupants?: boolean } = {},
  ): TroopUnit | null {
    const dir = this.getForwardDirection(unit);
    const effectiveAttackRange = this.getEffectiveAttackRange(unit);

    const enemyGeneralId = unit.faction === Faction.Player
      ? this.context.getEnemyGeneralUnitId()
      : this.context.getPlayerGeneralUnitId();
    if (enemyGeneralId) {
      const generalUnit = this.context.state.units.get(enemyGeneralId);
      if (generalUnit && !generalUnit.isDead() && !this.isUnitHiddenFrom(unit.faction, generalUnit)) {
        const dist = Math.max(
          Math.abs(unit.lane - generalUnit.lane),
          Math.abs(unit.depth - generalUnit.depth),
        );
        if (dist <= effectiveAttackRange) {
          return generalUnit;
        }
      }
    }

    if (this.isGeneralUnit(unit.id)) {
      const adjacentEnemy = this.findAdjacentEnemy(unit);
      if (adjacentEnemy) {
        return adjacentEnemy;
      }
    }

    for (let range = 1; range <= effectiveAttackRange; range += 1) {
      const cell = this.context.state.getCell(unit.lane, unit.depth + dir * range);
      if (!cell) {
        break;
      }
      if (!cell.occupantId) {
        continue;
      }
      const occupant = this.context.state.units.get(cell.occupantId);
      if (!occupant) {
        continue;
      }
      if (occupant.isDead()) {
        if (options.ignoreDeadOccupants) {
          continue;
        }
        break;
      }
      if (occupant.faction !== unit.faction && !this.isUnitHiddenFrom(unit.faction, occupant)) {
        return occupant;
      }
      break;
    }

    return null;
  }

  /** 找出武將單位周圍（含斜對角一格以內）的敵方目標 */
  private findAdjacentEnemy(unit: TroopUnit): TroopUnit | null {
    const dir = this.getForwardDirection(unit);
    // 優先正前方，其次斜前方，再其次側面
    const offsets = [
      { dl: 0, dd: dir },
      { dl: -1, dd: dir },
      { dl: 1, dd: dir },
      { dl: -1, dd: 0 },
      { dl: 1, dd: 0 },
    ];
    for (const { dl, dd } of offsets) {
      const cell = this.context.state.getCell(unit.lane + dl, unit.depth + dd);
      if (!cell?.occupantId) continue;
      const occ = this.context.state.units.get(cell.occupantId);
      if (occ && occ.faction !== unit.faction && !this.isUnitHiddenFrom(unit.faction, occ)) return occ;
    }
    return null;
  }

  private canAttackGeneral(unit: TroopUnit): boolean {
    if (this.isFactionHiddenFrom(unit.faction, unit.faction === Faction.Player ? Faction.Enemy : Faction.Player)) {
      return false;
    }
    const generalDepth = unit.faction === Faction.Player ? GAME_CONFIG.GRID_DEPTH : -1;
    const distanceToGeneral = Math.abs(generalDepth - unit.depth);
    return distanceToGeneral <= this.getEffectiveAttackRange(unit);
  }

  private isUnitHiddenFrom(attackerFaction: Faction, target: TroopUnit): boolean {
    return this.isFactionHiddenFrom(attackerFaction, target.faction);
  }

  private isFactionHiddenFrom(attackerFaction: Faction, targetFaction: Faction): boolean {
    return resolveBattleTacticBehavior(this.context.state.battleTactic).isFactionHiddenFrom(attackerFaction, targetFaction, this.context.state);
  }

  private getEffectiveAttackRange(unit: TroopUnit): number {
    return resolveBattleTacticBehavior(this.context.state.battleTactic).getEffectiveAttackRange(unit, this.context.state);
  }

  private getForwardDirection(unit: TroopUnit): number {
    return unit.faction === Faction.Player ? 1 : -1;
  }

  private tryTriggerCounterReaction(
    defender: TroopUnit,
    attacker: TroopUnit,
    svc: ReturnType<typeof services>,
  ): void {
    const reaction = this.context.state.getCounterReaction(defender.id);
    if (!reaction || reaction.remainingTriggers <= 0) {
      return;
    }
    if (reaction.meleeOnly && attacker.attackRange > 1) {
      return;
    }
    if (attacker.isDead()) {
      return;
    }

    const defenderGeneral = this.context.state.getGeneral(defender.faction);
    const defenderCell = this.context.state.getCell(defender.lane, defender.depth);
    const attackerCell = this.context.state.getCell(attacker.lane, attacker.depth);
    const counterDamage = svc.formula.calculateDamage({
      attackerAttack: Math.max(1, Math.floor(defender.getEffectiveAttack() * reaction.counterRatio)),
      defenderDefense: attacker.defense * (attacker.isShieldWallActive ? 2 : 1),
      attackerType: defender.type,
      defenderType: attacker.type,
      attackerTerrain: defenderCell?.terrain ?? TerrainType.Plain,
      defenderTerrain: attackerCell?.terrain ?? TerrainType.Plain,
      attackBonus: defenderGeneral?.attackBonus,
    });

    this.applyUnitDamage(attacker, counterDamage, defender.faction, {
      attackerId: defender.id,
      attackerLane: defender.lane,
      attackerDepth: defender.depth,
      damageSource: `counter:${reaction.battleSkillId}`,
      allowDamageLink: true,
    });

    svc.buff.applyBuff(attacker.id, StatusEffect.Weak, reaction.statusTurns);
    svc.event.emit(EVENT_NAMES.BuffApplied, {
      unitId: attacker.id,
      effect: StatusEffect.Weak,
      turns: reaction.statusTurns,
    });

    if (attacker.isDead()) {
      if (attacker.id === this.context.getPlayerGeneralUnitId()) {
        this.onGeneralUnitKilled(Faction.Player, svc);
      } else if (attacker.id === this.context.getEnemyGeneralUnitId()) {
        this.onGeneralUnitKilled(Faction.Enemy, svc);
      }
      this.onUnitKilled(attacker, defender, svc);
    }

    if (reaction.remainingTriggers <= 1) {
      this.context.state.removeCounterReaction(defender.id);
      return;
    }

    this.context.state.setCounterReaction({
      ...reaction,
      remainingTriggers: reaction.remainingTriggers - 1,
    });
  }
}