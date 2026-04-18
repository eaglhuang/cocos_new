import { TURN_BASED_RUNTIME_PHASE_ORDER } from '../BattleRuntimeContract';
import type { BattlePhaseExecutor } from '../phases/BattlePhaseExecutor';
import type { BattleTempoController } from './BattleTempoController';

export class TurnBasedTempoController implements BattleTempoController {
  public resolveTurnPlan(phaseExecutors: readonly BattlePhaseExecutor[]): readonly BattlePhaseExecutor[] {
    const executorsByPhase = new Map(phaseExecutors.map((executor) => [executor.phaseName, executor]));

    return TURN_BASED_RUNTIME_PHASE_ORDER
      .map((phaseName) => executorsByPhase.get(phaseName) ?? null)
      .filter((executor): executor is BattlePhaseExecutor => executor !== null);
  }
}