// @spec-source → 見 docs/cross-reference-index.md
import { EVENT_NAMES, Faction, GAME_CONFIG, TroopType } from "../../core/config/Constants";
import { services } from "../../core/managers/ServiceLoader";
import { GeneralUnit } from "../../core/models/GeneralUnit";
import { TroopUnit, type TroopStats } from "../../core/models/TroopUnit";
import { BattleState } from "../models/BattleState";
import { type BattleResult, BATTLE_FRONT_DEPTH } from "../BattleTypes";

export type { BattleResult };

export interface BattleGeneralDuelFlowContext {
  state: BattleState;
  onUnitKilled: (unit: TroopUnit, killer: TroopUnit | null, svc: ReturnType<typeof services>) => void;
}

export class BattleGeneralDuelFlow {
  private serial = 0;

  // 武將單挑狀態（所有權屬於此類別）
  public playerGeneralUnitId: string | null = null;
  public enemyGeneralUnitId: string | null = null;
  public isWaitingDuelPlacement = false;
  public duelRejectedFaction: Faction | null = null;
  public duelChallengeResolved = false;
  public generalSwapUsedThisTurn: Record<Faction, boolean> = {
    [Faction.Player]: false,
    [Faction.Enemy]:  false,
  };

  constructor(private readonly context: BattleGeneralDuelFlowContext) {}

  public resetForBattle(): void {
    this.playerGeneralUnitId   = null;
    this.enemyGeneralUnitId    = null;
    this.isWaitingDuelPlacement = false;
    this.duelRejectedFaction   = null;
    this.duelChallengeResolved = false;
    this.generalSwapUsedThisTurn[Faction.Player] = false;
    this.generalSwapUsedThisTurn[Faction.Enemy]  = false;
  }

  public resetSwapForTurn(): void {
    this.generalSwapUsedThisTurn[Faction.Player] = false;
    this.generalSwapUsedThisTurn[Faction.Enemy]  = false;
  }

  public getPlayerGeneralUnitId(): string | null {
    return this.playerGeneralUnitId;
  }

  public getEnemyGeneralUnitId(): string | null {
    return this.enemyGeneralUnitId;
  }

  public getDuelRejectedFaction(): Faction | null {
    return this.duelRejectedFaction;
  }

  public isDuelChallengeResolved(): boolean {
    return this.duelChallengeResolved;
  }

  public isGeneralUnit(unitId: string): boolean {
    return unitId === this.playerGeneralUnitId || unitId === this.enemyGeneralUnitId;
  }

  /**
   * 檢查玩家武將是否可以出陣（前排 depth=0 沒有我方小兵）。
   */
  public canPlayerGeneralDuel(): boolean {
    if (this.playerGeneralUnitId) return false;
    const pg = this.context.state.playerGeneral;
    if (!pg || pg.isDead()) return false;

    for (let lane = 0; lane < GAME_CONFIG.GRID_LANES; lane++) {
      const cell = this.context.state.getCell(lane, 0);
      if (cell?.occupantId) {
        const unit = this.context.state.units.get(cell.occupantId);
        if (unit && unit.faction === Faction.Player) return false;
      }
    }
    return true;
  }

  /**
   * 開始武將出陣流程：進入等待玩家選擇棋盤空格的狀態。
   * @returns "ok" | "already-deployed" | "front-blocked" | "general-dead"
   */
  public startGeneralDuel(): string {
    const pg = this.context.state.playerGeneral;
    if (!pg || pg.isDead()) return "general-dead";
    if (this.playerGeneralUnitId) return "already-deployed";
    if (this.isWaitingDuelPlacement) return "ok";
    if (!this.canPlayerGeneralDuel()) return "front-blocked";

    this.isWaitingDuelPlacement = true;
    return "ok";
  }

  /**
   * 玩家武將放置到指定格子（點擊棋盤後調用）。
   * @returns 成功回傳武將化身的 TroopUnit，失敗回傳 null
   */
  public placeGeneralOnBoard(lane: number, depth: number): TroopUnit | null {
    const cell = this.context.state.getCell(lane, depth);
    if (!cell || cell.occupantId) return null;

    const pg = this.context.state.playerGeneral;
    if (!pg || pg.isDead()) return null;

    const stats: TroopStats = {
      hp: pg.currentHp,
      attack: services().formula.calculateGeneralAttack({ str: pg.str, int: pg.int, lea: pg.lea, maxHp: pg.maxHp }),
      defense: 30,
      moveRange: 2,
      attackRange: 1,
    };
    const id = `player-general-${++this.serial}`;
    const unit = new TroopUnit(id, TroopType.Infantry, Faction.Player, stats);
    unit.currentHp = pg.currentHp;
    unit.moveTo(lane, depth);
    this.context.state.addUnit(unit);
    this.playerGeneralUnitId = id;
    this.isWaitingDuelPlacement = false;

    this.context.state.units.forEach(u => {
      if (u.faction === Faction.Player && u.id !== id) {
        u.attackBonus += u.attack;
      }
    });

    services().event.emit(EVENT_NAMES.GeneralDuelStart, {
      faction: Faction.Player,
      unitId: id,
      lane,
      depth,
    });
    services().event.emit(EVENT_NAMES.UnitDeployed, {
      unitId: id,
      faction: Faction.Player,
      type: TroopType.Infantry,
      lane,
      depth,
    });

    return unit;
  }

  /**
   * 判斷武將是否已到達敵將面前（可觸發單挑邀請）。
   */
  public isGeneralFacingEnemyGeneral(faction: Faction): boolean {
    const unitId = faction === Faction.Player ? this.playerGeneralUnitId : this.enemyGeneralUnitId;
    if (!unitId) return false;
    const unit = this.context.state.units.get(unitId);
    if (!unit) return false;
    const frontDepth = BATTLE_FRONT_DEPTH[faction];
    return unit.depth === frontDepth;
  }

  /**
   * 處理單挑邀請結果。
   */
  public resolveDuelChallenge(challengerFaction: Faction, accepted: boolean): void {
    const svc = services();
    const defenderFaction = challengerFaction === Faction.Player ? Faction.Enemy : Faction.Player;
    this.duelChallengeResolved = true;

    svc.event.emit(EVENT_NAMES.GeneralDuelChallenge, {
      challengerFaction,
      defenderFaction,
    });

    if (accepted) {
      svc.event.emit(EVENT_NAMES.GeneralDuelAccepted, {
        challengerFaction,
        defenderFaction,
      });
      this.resolveAcceptedGeneralDuel(challengerFaction, defenderFaction, svc);
      return;
    }

    this.duelRejectedFaction = defenderFaction;
    this.applyDuelPenalty(defenderFaction);
    svc.event.emit(EVENT_NAMES.GeneralDuelRejected, {
      rejectedFaction: defenderFaction,
    });
    // 結果由 BattleController.resolveDuelChallenge() 呼叫 checkVictory() 統一處理
  }

  /**
   * 單挑接受決策（由防守方視角評估）：
   * score = 0.45 * 主將血量優勢 + 0.35 * 場上兵力優勢 + 0.2 * 總戰力優勢
   */
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

    const challengerUnits = this.collectFactionUnits(challengerFaction);
    const defenderUnits = this.collectFactionUnits(defenderFaction);
    const unitCountAdvantage = defenderUnits.length / Math.max(1, challengerUnits.length + defenderUnits.length);

    const calcPower = (units: TroopUnit[], general: GeneralUnit | null): number => {
      const unitPower = units.reduce((sum, u) => {
        return sum + u.getEffectiveAttack() + u.getEffectiveMaxHp() * 0.1;
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

  /**
   * 武將化身陣亡 → 同步至武將本體，標記武將死亡。
   */
  public onGeneralUnitKilled(faction: Faction): void {
    const svc = services();
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
      this.playerGeneralUnitId = null;
    } else {
      this.enemyGeneralUnitId = null;
    }
  }

  private resolveAcceptedGeneralDuel(
    challengerFaction: Faction,
    defenderFaction: Faction,
    svc: ReturnType<typeof services>,
  ): void {
    const challengerGeneral = this.context.state.getGeneral(challengerFaction);
    const defenderGeneral = this.context.state.getGeneral(defenderFaction);
    if (!challengerGeneral || !defenderGeneral) return;

    const challengerUnitId = challengerFaction === Faction.Player ? this.playerGeneralUnitId : this.enemyGeneralUnitId;
    const defenderUnitId = defenderFaction === Faction.Player ? this.playerGeneralUnitId : this.enemyGeneralUnitId;
    const challengerUnit = challengerUnitId ? this.context.state.units.get(challengerUnitId) ?? null : null;
    const defenderUnit = defenderUnitId ? this.context.state.units.get(defenderUnitId) ?? null : null;

    const getAttack = (general: GeneralUnit, unit: TroopUnit | null): number => {
      if (unit) return unit.getEffectiveAttack();
      return services().formula.calculateGeneralAttack({ str: general.str, int: general.int, lea: general.lea, maxHp: general.maxHp });
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

      if (defenderGeneral.isDead()) break;

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
      this.onGeneralUnitKilled(challengerFaction);
      this.context.onUnitKilled(challengerUnit, null, svc);
    }

    if (defenderGeneral.isDead() && defenderUnit) {
      this.onGeneralUnitKilled(defenderFaction);
      this.context.onUnitKilled(defenderUnit, null, svc);
    }
    // 結果由 BattleController.resolveDuelChallenge() 呼叫 checkVictory() 統一處理
  }

  private applyDuelPenalty(faction: Faction): void {
    this.context.state.units.forEach(unit => {
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

  private checkVictory(): BattleResult {
    const svc = services();
    const pg = this.context.state.playerGeneral;
    const eg = this.context.state.enemyGeneral;

    const playerLost = (pg?.isDead() ?? false) || svc.battle.isTurnLimitReached();
    const enemyLost = (eg?.isDead() ?? false);

    let result: BattleResult = "ongoing";
    if (playerLost && enemyLost) result = "draw";
    else if (playerLost) result = "enemy-win";
    else if (enemyLost) result = "player-win";

    // BattleEnded 事件由 BattleController.checkVictory() 統一發出，此處不 emit
    return result;
  }

  private collectFactionUnits(faction: Faction): TroopUnit[] {
    const result: TroopUnit[] = [];
    this.context.state.units.forEach(unit => {
      if (unit.faction === faction) result.push(unit);
    });
    return result;
  }
}
