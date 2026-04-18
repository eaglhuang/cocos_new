// @spec-source → 見 docs/cross-reference-index.md
import { Color } from 'cc';
import { BattleTactic, GAME_CONFIG, TerrainType } from '../../core/config/Constants';
import type { TileEffectState } from '../models/BattleState';

export type BattleSceneMode = 'normal' | 'flood' | 'fire' | 'rock' | 'ambush' | 'night';

export type BattleSceneBaseStyle = 'default' | 'flood-river';

export interface BattleScenePulseSource {
  readonly tileEffects: ReadonlyMap<string, { lane: number; depth: number }>;
}

export interface BattleSceneDisplayRule {
  resolveBackgroundId(explicitBackgroundId: string | null | undefined, encounterBackgroundId: string | null | undefined): string;
  resolveCellBaseStyle(terrain: TerrainType): BattleSceneBaseStyle;
  resolveOverlayState(effectState: TileEffectState): TileEffectState | null;
  resolvePulseColor(): Color;
  resolvePulseCells(source: BattleScenePulseSource): Array<{ lane: number; depth: number }>;
}

function resolveDefaultBackgroundId(
  explicitBackgroundId: string | null | undefined,
  encounterBackgroundId: string | null | undefined,
): string {
  if (explicitBackgroundId) {
    return explicitBackgroundId;
  }

  return encounterBackgroundId ?? 'bg_normal_day';
}

function resolveFloodBackgroundId(
  explicitBackgroundId: string | null | undefined,
  _encounterBackgroundId: string | null | undefined,
): string {
  if (explicitBackgroundId) {
    return explicitBackgroundId;
  }

  return 'bg_water';
}

function resolveNightBackgroundId(
  explicitBackgroundId: string | null | undefined,
  _encounterBackgroundId: string | null | undefined,
): string {
  if (explicitBackgroundId) {
    return explicitBackgroundId;
  }

  return 'bg_normal_night';
}

function resolveDefaultBaseStyle(): BattleSceneBaseStyle {
  return 'default';
}

function resolveFloodBaseStyle(terrain: TerrainType): BattleSceneBaseStyle {
  return terrain === TerrainType.River ? 'flood-river' : 'default';
}

function resolvePassThroughOverlayState(effectState: TileEffectState): TileEffectState | null {
  return effectState;
}

function resolveAllBoardCells(): Array<{ lane: number; depth: number }> {
  const cells: Array<{ lane: number; depth: number }> = [];
  for (let lane = 0; lane < GAME_CONFIG.GRID_LANES; lane++) {
    for (let depth = 0; depth < GAME_CONFIG.GRID_DEPTH; depth++) {
      cells.push({ lane, depth });
    }
  }
  return cells;
}

function resolveDefaultPulseCells(source: BattleScenePulseSource): Array<{ lane: number; depth: number }> {
  if (source.tileEffects.size > 0) {
    return Array.from(source.tileEffects.values()).map((effect) => ({ lane: effect.lane, depth: effect.depth }));
  }

  return resolveAllBoardCells();
}

function resolveUpperHalfPulseCells(source: BattleScenePulseSource): Array<{ lane: number; depth: number }> {
  if (source.tileEffects.size > 0) {
    return Array.from(source.tileEffects.values()).map((effect) => ({ lane: effect.lane, depth: effect.depth }));
  }

  const depthThreshold = Math.max(0, Math.floor(GAME_CONFIG.GRID_DEPTH / 2));
  return resolveAllBoardCells().filter((cell) => cell.depth <= depthThreshold);
}

// 戰法 → 顯示策略：同一個模式只對應一套視覺規則，避免 view/controller 到處寫 switch。
export const BATTLE_SCENE_DISPLAY_RULES: Readonly<Record<BattleSceneMode, BattleSceneDisplayRule>> = {
  normal: {
    resolveBackgroundId: resolveDefaultBackgroundId,
    resolveCellBaseStyle: resolveDefaultBaseStyle,
    resolveOverlayState: resolvePassThroughOverlayState,
    resolvePulseColor: () => new Color(255, 220, 140, 180),
    resolvePulseCells: resolveDefaultPulseCells,
  },
  flood: {
    resolveBackgroundId: resolveFloodBackgroundId,
    resolveCellBaseStyle: resolveFloodBaseStyle,
    resolveOverlayState: resolvePassThroughOverlayState,
    resolvePulseColor: () => new Color(96, 182, 255, 170),
    resolvePulseCells: resolveDefaultPulseCells,
  },
  fire: {
    resolveBackgroundId: resolveDefaultBackgroundId,
    resolveCellBaseStyle: resolveDefaultBaseStyle,
    resolveOverlayState: resolvePassThroughOverlayState,
    resolvePulseColor: () => new Color(255, 154, 90, 180),
    resolvePulseCells: resolveDefaultPulseCells,
  },
  rock: {
    resolveBackgroundId: resolveDefaultBackgroundId,
    resolveCellBaseStyle: resolveDefaultBaseStyle,
    resolveOverlayState: resolvePassThroughOverlayState,
    resolvePulseColor: () => new Color(178, 166, 150, 180),
    resolvePulseCells: resolveDefaultPulseCells,
  },
  ambush: {
    resolveBackgroundId: resolveNightBackgroundId,
    resolveCellBaseStyle: resolveDefaultBaseStyle,
    resolveOverlayState: resolvePassThroughOverlayState,
    resolvePulseColor: () => new Color(122, 206, 144, 160),
    resolvePulseCells: resolveUpperHalfPulseCells,
  },
  night: {
    resolveBackgroundId: resolveNightBackgroundId,
    resolveCellBaseStyle: resolveDefaultBaseStyle,
    resolveOverlayState: resolvePassThroughOverlayState,
    resolvePulseColor: () => new Color(120, 150, 255, 170),
    resolvePulseCells: resolveUpperHalfPulseCells,
  },
};

export function resolveBattleSceneMode(battleTactic: BattleTactic): BattleSceneMode {
  switch (battleTactic) {
    case BattleTactic.FloodAttack:
      return 'flood';
    case BattleTactic.FireAttack:
      return 'fire';
    case BattleTactic.RockSlide:
      return 'rock';
    case BattleTactic.AmbushAttack:
      return 'ambush';
    case BattleTactic.NightRaid:
      return 'night';
    default:
      return 'normal';
  }
}

export function resolveBattleSceneDisplayRule(battleTactic: BattleTactic): BattleSceneDisplayRule {
  return BATTLE_SCENE_DISPLAY_RULES[resolveBattleSceneMode(battleTactic)];
}

export function resolveBattleSceneBackgroundId(
  explicitBackgroundId: string | null | undefined,
  encounterBackgroundId: string | null | undefined,
  battleTactic: BattleTactic,
): string {
  return resolveBattleSceneDisplayRule(battleTactic).resolveBackgroundId(explicitBackgroundId, encounterBackgroundId);
}

export function resolveBattleSceneCellBaseStyle(battleTactic: BattleTactic, terrain: TerrainType): BattleSceneBaseStyle {
  return resolveBattleSceneDisplayRule(battleTactic).resolveCellBaseStyle(terrain);
}

export function resolveBattleSceneOverlayState(battleTactic: BattleTactic, effectState: TileEffectState): TileEffectState | null {
  return resolveBattleSceneDisplayRule(battleTactic).resolveOverlayState(effectState);
}

export function resolveBattleScenePulseColor(battleTactic: BattleTactic): Color {
  return resolveBattleSceneDisplayRule(battleTactic).resolvePulseColor();
}

export function resolveBattleScenePulseCells(source: BattleScenePulseSource, battleTactic: BattleTactic): Array<{ lane: number; depth: number }> {
  return resolveBattleSceneDisplayRule(battleTactic).resolvePulseCells(source);
}

export function isFloodSceneMode(mode: BattleSceneMode): boolean {
  return mode === 'flood';
}

export function resolveBattleSceneRiverTerrainVariant(mode: BattleSceneMode, terrain: TerrainType): 'default' | 'flood-river' {
  if (mode === 'flood' && terrain === TerrainType.River) {
    return 'flood-river';
  }

  return 'default';
}