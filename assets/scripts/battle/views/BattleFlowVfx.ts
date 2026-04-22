import { Vec3 } from "cc";
import { SkillSourceType } from "../../shared/SkillRuntimeContract";

export const BATTLE_FLOW_FX = {
  hitDefault: 'battle_hit_default',
  hitNightRaid: 'battle_hit_night',
  deathBurst: 'battle_death_burst',
  deathSmoke: 'battle_death_vanish',
  forcedMove: 'battle_forced_move',
  skillSeed: 'battle_skill_seed',
  skillUltimate: 'battle_skill_ultimate',
  battleWin: 'battle_win',
  battleLose: 'battle_lose',
  battleDraw: 'battle_draw',
} as const;

export interface BattleFlowEffectSystem {
  getEffectDef(effectKey: string): unknown;
  playFullEffect(effectKey: string, position: Vec3): void;
  playBlock(effectKey: string, position: Vec3, override?: unknown, duration?: number): void;
}

export interface BattleFlowBoardRenderer {
  getCellWorldPosition(lane: number, depth: number, yOffset?: number): Vec3 | null | undefined;
  getBoardMetrics(): { center: Vec3 } | null | undefined;
}

export function resolveBattleUnitHitEffectKey(damageSource?: string): string {
  return damageSource === 'night-raid-opening-strike'
    ? BATTLE_FLOW_FX.hitNightRaid
    : BATTLE_FLOW_FX.hitDefault;
}

export function resolveBattleGeneralSkillEffectKey(sourceType?: SkillSourceType): string {
  return sourceType === SkillSourceType.Ultimate
    ? BATTLE_FLOW_FX.skillUltimate
    : BATTLE_FLOW_FX.skillSeed;
}

export function resolveBattleResultEffectKey(result: string): string | null {
  if (result === 'player-win') return BATTLE_FLOW_FX.battleWin;
  if (result === 'enemy-win') return BATTLE_FLOW_FX.battleLose;
  if (result === 'draw') return BATTLE_FLOW_FX.battleDraw;
  return null;
}

export function playBattleFlowEffectAtCell(
  effectSystem: BattleFlowEffectSystem,
  boardRenderer: BattleFlowBoardRenderer | null | undefined,
  effectKey: string,
  lane: number | null | undefined,
  depth: number | null | undefined,
  duration = 1.0,
  yOffset = 0.08,
): void {
  if (lane === null || lane === undefined || depth === null || depth === undefined) {
    return;
  }

  const position = boardRenderer?.getCellWorldPosition(lane, depth, yOffset);
  if (!position) {
    return;
  }

  if (effectSystem.getEffectDef(effectKey)) {
    effectSystem.playFullEffect(effectKey, position);
    return;
  }

  effectSystem.playBlock(effectKey, position, undefined, duration);
}

export function playBattleFlowEffectAtBoardCenter(
  effectSystem: BattleFlowEffectSystem,
  boardRenderer: BattleFlowBoardRenderer | null | undefined,
  effectKey: string,
  duration = 1.5,
): void {
  const metrics = boardRenderer?.getBoardMetrics();
  if (!metrics) {
    return;
  }

  const center = metrics.center.clone();
  center.y += 0.16;

  if (effectSystem.getEffectDef(effectKey)) {
    effectSystem.playFullEffect(effectKey, center);
    return;
  }

  effectSystem.playBlock(effectKey, center, undefined, duration);
}
