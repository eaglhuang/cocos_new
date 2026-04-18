import { GAME_CONFIG, TROOP_DEPLOY_COST, type TroopType } from '../../../core/config/Constants';
import type { EnemyAI } from '../../controllers/EnemyAI';
import type { BattleState } from '../../models/BattleState';
import { BattleTurnManager } from '../BattleTurnManager';

export interface BattleEnemyDeployPhaseContext {
  readonly state: BattleState;
  readonly enemyAi: EnemyAI;
  readonly turnManager: BattleTurnManager;
  spawnEnemyUnit(type: TroopType, lane: number, depth: number): void;
  isCellMovementBlocked(lane: number, depth: number): boolean;
}

export function executeBattleEnemyDeployPhase(context: BattleEnemyDeployPhaseContext): void {
  const decisions = context.enemyAi.decideDeploy(context.state, context.turnManager.enemyFood);
  const deployDepth = GAME_CONFIG.GRID_DEPTH - 1;

  for (const decision of decisions) {
    if (context.state.getCell(decision.lane, deployDepth)?.occupantId) continue;
    if (context.isCellMovementBlocked(decision.lane, deployDepth)) continue;

    context.spawnEnemyUnit(decision.type, decision.lane, deployDepth);
    context.turnManager.enemyFood = Math.max(0, context.turnManager.enemyFood - TROOP_DEPLOY_COST[decision.type]);
  }
}