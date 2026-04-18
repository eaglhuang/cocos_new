import type { BattlePhaseExecutor } from '../phases/BattlePhaseExecutor';

export interface BattleTempoController {
  resolveTurnPlan(phaseExecutors: readonly BattlePhaseExecutor[]): readonly BattlePhaseExecutor[];
}