export type BattleResult = "player-win" | "enemy-win" | "draw" | "ongoing";

export type BattleRuntimePhaseName =
  | 'enemy-deploy'
  | 'auto-move'
  | 'tile-effect'
  | 'combat-resolve'
  | 'special-resolve'
  | 'victory-check';

export interface BattleRuntimePhaseOutcome {
  result?: BattleResult;
  stopProcessing?: boolean;
}

export const TURN_BASED_RUNTIME_PHASE_ORDER: readonly BattleRuntimePhaseName[] = [
  'enemy-deploy',
  'auto-move',
  'tile-effect',
  'combat-resolve',
  'special-resolve',
  'victory-check',
];