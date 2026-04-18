import type { BattleRuntimeContext } from '../BattleRuntimeContext';
import type { BattleRuntimePhaseName, BattleRuntimePhaseOutcome } from '../BattleRuntimeContract';

export interface BattlePhaseExecutor {
  readonly phaseName: BattleRuntimePhaseName;
  execute(context: BattleRuntimeContext): BattleRuntimePhaseOutcome;
}

export class CallbackBattlePhaseExecutor implements BattlePhaseExecutor {
  constructor(
    public readonly phaseName: BattleRuntimePhaseName,
    private readonly handler: (context: BattleRuntimeContext) => BattleRuntimePhaseOutcome,
  ) {}

  public execute(context: BattleRuntimeContext): BattleRuntimePhaseOutcome {
    return this.handler(context);
  }
}

export function createBattlePhaseExecutor(
  phaseName: BattleRuntimePhaseName,
  handler: (context: BattleRuntimeContext) => BattleRuntimePhaseOutcome,
): BattlePhaseExecutor {
  return new CallbackBattlePhaseExecutor(phaseName, handler);
}