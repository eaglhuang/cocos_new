import type { BattleTactic } from '../../core/config/Constants';
import type { BattleState } from '../models/BattleState';
import type { BattleRuntimePhaseName, BattleRuntimePhaseOutcome } from './BattleRuntimeContract';

export interface BattleRuntimeContext {
  readonly state: BattleState;
  readonly battleTactic: BattleTactic;
  executePhase(phaseName: BattleRuntimePhaseName): BattleRuntimePhaseOutcome;
  finalizeTurnCycle(): void;
}