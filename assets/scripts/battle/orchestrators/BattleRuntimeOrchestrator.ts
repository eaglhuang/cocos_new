import type { BattleRuntimeContext } from '../runtime/BattleRuntimeContext';
import type { BattleResult } from '../runtime/BattleRuntimeContract';
import type { BattlePhaseExecutor } from '../runtime/phases/BattlePhaseExecutor';
import type { BattleTempoController } from '../runtime/tempo/BattleTempoController';

export class BattleRuntimeOrchestrator {
  constructor(private readonly tempoController: BattleTempoController) {}

  public executeTurnCycle(
    context: BattleRuntimeContext,
    phaseExecutors: readonly BattlePhaseExecutor[],
  ): BattleResult {
    const turnPlan = this.tempoController.resolveTurnPlan(phaseExecutors);
    let result: BattleResult = 'ongoing';

    for (const executor of turnPlan) {
      const phaseOutcome = executor.execute(context);
      if (phaseOutcome.result) {
        result = phaseOutcome.result;
      }

      if (phaseOutcome.stopProcessing || result !== 'ongoing') {
        return result;
      }
    }

    context.finalizeTurnCycle();
    return result;
  }
}