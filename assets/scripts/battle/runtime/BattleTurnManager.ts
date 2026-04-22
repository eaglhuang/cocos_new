import { Faction, GAME_CONFIG } from '../../core/config/Constants';

export class BattleTurnManager {
  public enemyFood = GAME_CONFIG.INITIAL_FOOD;
  public playerDeployCountThisTurn = 0;
  public readonly movedUnitIdsThisTurn = new Set<string>();
  public readonly generalSwapUsedThisTurn: Record<Faction, boolean> = {
    [Faction.Player]: false,
    [Faction.Enemy]: false,
  };
  public buffConsumedSinceLastSpawn = true;
  public readonly blockedBuffSpawnCells = new Set<string>();
  public enemyGeneralLastAutoSkillTurn = -1;

  public resetForBattle(): void {
    this.enemyFood = GAME_CONFIG.INITIAL_FOOD;
    this.playerDeployCountThisTurn = 0;
    this.movedUnitIdsThisTurn.clear();
    this.generalSwapUsedThisTurn[Faction.Player] = false;
    this.generalSwapUsedThisTurn[Faction.Enemy] = false;
    this.buffConsumedSinceLastSpawn = true;
    this.blockedBuffSpawnCells.clear();
    this.enemyGeneralLastAutoSkillTurn = -1;
  }

  public canDeployPlayer(): boolean {
    return this.playerDeployCountThisTurn < GAME_CONFIG.MAX_PLAYER_DEPLOY_PER_TURN;
  }

  public notePlayerDeployment(): void {
    this.playerDeployCountThisTurn += 1;
  }

  public refreshForNextTurn(): void {
    this.enemyFood = Math.min(this.enemyFood + GAME_CONFIG.FOOD_PER_TURN, GAME_CONFIG.MAX_FOOD);
    this.playerDeployCountThisTurn = 0;
    this.movedUnitIdsThisTurn.clear();
    this.generalSwapUsedThisTurn[Faction.Player] = false;
    this.generalSwapUsedThisTurn[Faction.Enemy] = false;
  }

  public markUnitMoved(unitId: string): void {
    this.movedUnitIdsThisTurn.add(unitId);
  }

  public hasUnitMovedThisTurn(unitId: string): boolean {
    return this.movedUnitIdsThisTurn.has(unitId);
  }

  public canUseGeneralSwap(faction: Faction): boolean {
    return !this.generalSwapUsedThisTurn[faction];
  }

  public markGeneralSwapUsed(faction: Faction): void {
    this.generalSwapUsedThisTurn[faction] = true;
  }

  public canSpawnTileBuffs(): boolean {
    return this.buffConsumedSinceLastSpawn;
  }

  public beginTileBuffSpawnCycle(): void {
    this.buffConsumedSinceLastSpawn = false;
  }

  public markTileBuffConsumed(lane: number, depth: number): void {
    this.blockedBuffSpawnCells.add(`${lane},${depth}`);
    this.buffConsumedSinceLastSpawn = true;
  }

  public clearBlockedBuffSpawnCells(): void {
    this.blockedBuffSpawnCells.clear();
  }

  public canEnemyAutoCastSkill(currentTurn: number): boolean {
    return currentTurn > this.enemyGeneralLastAutoSkillTurn + 1;
  }

  public markEnemyAutoSkillUsed(turn: number): void {
    this.enemyGeneralLastAutoSkillTurn = turn;
  }
}