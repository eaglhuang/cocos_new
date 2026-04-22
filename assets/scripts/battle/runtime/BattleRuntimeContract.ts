export type BattleResult = "player-win" | "enemy-win" | "draw" | "ongoing";

export type BattleRuntimePhaseName =
  | 'player-auto-move'
  | 'enemy-auto-move'
  | 'player-tile-effect'
  | 'enemy-tile-effect'
  | 'player-combat-resolve'
  | 'enemy-combat-resolve'
  | 'player-special-resolve'
  | 'enemy-special-resolve'
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
  'player-auto-move',
  'player-tile-effect',
  'player-combat-resolve',
  'player-special-resolve',
  'enemy-deploy',
  'enemy-auto-move',
  'enemy-tile-effect',
  'enemy-combat-resolve',
  'enemy-special-resolve',
  'auto-move',
  'tile-effect',
  'combat-resolve',
  'special-resolve',
  'victory-check',
];