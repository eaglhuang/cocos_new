import { BattleTactic, Faction, GAME_CONFIG, TerrainType } from '../../core/config/Constants';
import type { TroopUnit } from '../../core/models/TroopUnit';
import type { BattleState } from '../models/BattleState';
import { resolveBattleSceneMode, type BattleSceneMode } from './BattleSceneMode';

export interface BattleDamageAdjustment {
  damage: number;
  damageSource?: string;
}

export interface BattleDamageContext {
  kind: 'unit' | 'general';
  attacker: TroopUnit;
  baseDamage: number;
  state: BattleState;
}

export interface BattleTacticBehavior {
  applyStartOfBattle(state: BattleState): void;
  advanceTurn(state: BattleState): void;
  isFactionHiddenFrom(attackerFaction: Faction, targetFaction: Faction, state: BattleState): boolean;
  getEffectiveAttackRange(unit: TroopUnit, state: BattleState): number;
  resolveDamageAdjustment(context: BattleDamageContext): BattleDamageAdjustment;
}

const FLOOD_DEPTH_START = 2;
const FLOOD_DEPTH_END = 4;
const FIRE_DAMAGE_PER_TURN = 15;
const NIGHT_RAID_ATTACK_BONUS = 0.25;

function applyFloodAttackTerrain(state: BattleState): void {
  for (let lane = 0; lane < GAME_CONFIG.GRID_LANES; lane++) {
    const floodDepthStart = lane === 0 || lane === GAME_CONFIG.GRID_LANES - 1
      ? FLOOD_DEPTH_START + 1
      : FLOOD_DEPTH_START;
    const floodDepthEnd = lane === 0 || lane === GAME_CONFIG.GRID_LANES - 1
      ? FLOOD_DEPTH_END
      : FLOOD_DEPTH_END + 1;

    for (let depth = floodDepthStart; depth <= floodDepthEnd; depth++) {
      const cell = state.getCell(lane, depth);
      if (!cell) continue;

      cell.terrain = TerrainType.River;
      state.setTileEffect({
        id: `flood-${lane}-${depth}`,
        lane,
        depth,
        state: 'river-current',
        forcedMoveDirection: 'forward',
        forcedMoveSteps: 1,
        moveRangeDelta: -1,
        notes: 'scene-gambit:flood-attack',
      });
    }
  }
}

function applyFireAttackTerrain(state: BattleState): void {
  for (let lane = 1; lane <= 3; lane++) {
    for (let depth = 3; depth <= 4; depth++) {
      state.setTileEffect({
        id: `fire-${lane}-${depth}`,
        lane,
        depth,
        state: 'hazard-fire',
        damagePerTurn: FIRE_DAMAGE_PER_TURN,
        notes: 'scene-gambit:fire-attack',
      });
    }
  }
}

function applyRockSlideTerrain(state: BattleState): void {
  for (let lane = 1; lane <= 3; lane++) {
    state.setTileEffect({
      id: `rock-${lane}-4`,
      lane,
      depth: 4,
      state: 'hazard-rock',
      blocksMovement: true,
      forcedMoveDirection: 'backward',
      forcedMoveSteps: 1,
      notes: 'scene-gambit:rock-slide',
    });
  }
}

function applyAmbushAttackDecorations(state: BattleState): void {
  for (const cell of state.cells) {
    if (cell.terrain !== TerrainType.Forest) {
      continue;
    }

    state.setTileEffect({
      id: `ambush-${cell.lane}-${cell.depth}`,
      lane: cell.lane,
      depth: cell.depth,
      state: 'ambush-field',
      notes: 'scene-gambit:ambush-attack',
    });
  }
}

function applyNightRaidDecorations(state: BattleState): void {
  for (let lane = 1; lane <= 3; lane++) {
    for (let depth = 5; depth <= 7; depth++) {
      state.setTileEffect({
        id: `night-raid-${lane}-${depth}`,
        lane,
        depth,
        state: 'night-raid',
        notes: 'scene-gambit:night-raid-camp',
      });
    }
  }
}

function tickAmbushAttackFlags(state: BattleState): void {
  if (state.sceneFlags.stealthOpenTurns > 0) {
    state.sceneFlags.stealthOpenTurns = Math.max(0, state.sceneFlags.stealthOpenTurns - 1);
  }
}

function tickNightRaidFlags(state: BattleState): void {
  if (state.sceneFlags.nightRaidOpenTurns > 0) {
    state.sceneFlags.nightRaidOpenTurns = Math.max(0, state.sceneFlags.nightRaidOpenTurns - 1);
    if (state.sceneFlags.nightRaidOpenTurns === 0) {
      state.sceneFlags.nightRaid = false;
    }
  }
}

function resolveDefaultDamageAdjustment(context: BattleDamageContext): BattleDamageAdjustment {
  return {
    damage: context.baseDamage,
  };
}

function resolveNightRaidDamageAdjustment(context: BattleDamageContext): BattleDamageAdjustment {
  const isOpeningStrike =
    context.attacker.faction === Faction.Player
    && context.state.sceneFlags.nightRaid
    && context.state.sceneFlags.nightRaidOpenTurns > 0;

  if (!isOpeningStrike) {
    return {
      damage: context.baseDamage,
    };
  }

  return {
    damage: Math.max(1, Math.floor(context.baseDamage * (1 + NIGHT_RAID_ATTACK_BONUS))),
    damageSource: context.kind === 'unit' ? 'night-raid-opening-strike' : undefined,
  };
}

const DEFAULT_BATTLE_TACTIC_BEHAVIOR: BattleTacticBehavior = {
  applyStartOfBattle: () => undefined,
  advanceTurn: () => undefined,
  isFactionHiddenFrom: () => false,
  getEffectiveAttackRange: (unit: TroopUnit) => unit.attackRange,
  resolveDamageAdjustment: resolveDefaultDamageAdjustment,
};

export const BATTLE_TACTIC_BEHAVIOR_REGISTRY: Readonly<Record<BattleSceneMode, BattleTacticBehavior>> = {
  normal: DEFAULT_BATTLE_TACTIC_BEHAVIOR,
  flood: {
    ...DEFAULT_BATTLE_TACTIC_BEHAVIOR,
    applyStartOfBattle: applyFloodAttackTerrain,
  },
  fire: {
    ...DEFAULT_BATTLE_TACTIC_BEHAVIOR,
    applyStartOfBattle: applyFireAttackTerrain,
  },
  rock: {
    ...DEFAULT_BATTLE_TACTIC_BEHAVIOR,
    applyStartOfBattle: applyRockSlideTerrain,
  },
  ambush: {
    ...DEFAULT_BATTLE_TACTIC_BEHAVIOR,
    applyStartOfBattle: (state: BattleState) => {
      state.sceneFlags.stealthOpenTurns = 2;
      applyAmbushAttackDecorations(state);
    },
    advanceTurn: tickAmbushAttackFlags,
    isFactionHiddenFrom: (attackerFaction: Faction, targetFaction: Faction, state: BattleState) => (
      attackerFaction === Faction.Enemy
      && targetFaction === Faction.Player
      && state.sceneFlags.stealthOpenTurns > 0
    ),
  },
  night: {
    ...DEFAULT_BATTLE_TACTIC_BEHAVIOR,
    applyStartOfBattle: (state: BattleState) => {
      state.sceneFlags.nightRaid = true;
      state.sceneFlags.nightRaidOpenTurns = 2;
      applyNightRaidDecorations(state);
    },
    advanceTurn: tickNightRaidFlags,
    getEffectiveAttackRange: (unit: TroopUnit, state: BattleState) => {
      if (
        unit.faction === Faction.Enemy
        && state.sceneFlags.nightRaid
        && state.sceneFlags.nightRaidOpenTurns > 0
      ) {
        return Math.max(0, unit.attackRange - 1);
      }

      return unit.attackRange;
    },
    resolveDamageAdjustment: resolveNightRaidDamageAdjustment,
  },
};

export function resolveBattleTacticBehavior(battleTactic: BattleTactic): BattleTacticBehavior {
  return BATTLE_TACTIC_BEHAVIOR_REGISTRY[resolveBattleSceneMode(battleTactic)];
}