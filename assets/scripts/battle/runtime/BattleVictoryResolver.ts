import { EVENT_NAMES } from '../../core/config/Constants';
import { services } from '../../core/managers/ServiceLoader';
import type { BattleState } from '../models/BattleState';
import type { BattleResult } from './BattleRuntimeContract';

export function resolveBattleVictory(state: BattleState): BattleResult {
  const svc = services();
  const playerGeneral = state.playerGeneral;
  const enemyGeneral = state.enemyGeneral;

  const playerLost = (playerGeneral?.isDead() ?? false)
    || state.playerFortressHp <= 0
    || svc.battle.isTurnLimitReached();

  const enemyLost = (enemyGeneral?.isDead() ?? false)
    || state.enemyFortressHp <= 0;

  let result: BattleResult = 'ongoing';
  if (playerLost && enemyLost) result = 'draw';
  else if (playerLost) result = 'enemy-win';
  else if (enemyLost) result = 'player-win';

  if (result !== 'ongoing') {
    svc.event.emit(EVENT_NAMES.BattleEnded, { result });
  }

  return result;
}