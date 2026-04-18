// @spec-source → 見 docs/cross-reference-index.md
import { EVENT_NAMES, GAME_CONFIG } from "../../core/config/Constants";
import { services } from "../../core/managers/ServiceLoader";
import { TroopUnit } from "../../core/models/TroopUnit";
import { BattleState, type TileBuff } from "../models/BattleState";

export interface BattleTileBuffRule {
  id: string;
  stat: "attack" | "hp";
  op: "mul" | "div";
  text: string;
}

export interface BattleTileBuffConfig {
  spawn: {
    minPerTurn: number;
    maxPerTurn: number;
    factorMin: number;
    factorMax: number;
    rareFactorThreshold: number;
  };
  rules: BattleTileBuffRule[];
}

export interface BattleTileBuffLifecycleContext {
  state: BattleState;
  getTileBuffConfig: () => BattleTileBuffConfig;
  getBuffConsumedSinceLastSpawn: () => boolean;
  setBuffConsumedSinceLastSpawn: (value: boolean) => void;
  getBlockedBuffSpawnCells: () => Set<string>;
  randomInt: (min: number, max: number) => number;
}

export class BattleTileBuffLifecycleManager {
  private static readonly MIN_EMPTY_CELLS_FOR_BUFF_SPAWN = 10;

  constructor(private readonly context: BattleTileBuffLifecycleContext) {}

  public resetForBattle(): void {
    this.context.setBuffConsumedSinceLastSpawn(true);
    this.context.getBlockedBuffSpawnCells().clear();
  }

  public spawnTileBuffsForTurn(): void {
    if (!this.context.getBuffConsumedSinceLastSpawn()) return;
    this.context.setBuffConsumedSinceLastSpawn(false);

    const cfg = this.context.getTileBuffConfig().spawn;
    const rulePool = this.context.getTileBuffConfig().rules;
    if (rulePool.length === 0) return;
    const count = this.context.randomInt(cfg.minPerTurn, cfg.maxPerTurn);
    const available: Array<{ lane: number; depth: number }> = [];

    for (let lane = 0; lane < GAME_CONFIG.GRID_LANES; lane++) {
      for (let depth = 1; depth < GAME_CONFIG.GRID_DEPTH - 1; depth++) {
        const cell = this.context.state.getCell(lane, depth);
        if (!cell || cell.occupantId) continue;
        if (this.context.state.getTileBuff(lane, depth)) continue;
        if (this.context.getBlockedBuffSpawnCells().has(`${lane},${depth}`)) continue;
        available.push({ lane, depth });
      }
    }

    if (available.length < BattleTileBuffLifecycleManager.MIN_EMPTY_CELLS_FOR_BUFF_SPAWN) {
      return;
    }

    const spawnCount = Math.min(count, available.length);
    for (let i = 0; i < spawnCount; i++) {
      const pick = this.context.randomInt(0, available.length - 1);
      const cell = available.splice(pick, 1)[0];
      const rule = rulePool[this.context.randomInt(0, rulePool.length - 1)];
      const factor = this.context.randomInt(cfg.factorMin, cfg.factorMax);
      const text = rule.text.replace("{factor}", `${factor}`);
      const buff: TileBuff = {
        id: `${rule.id}-${Date.now()}-${i}`,
        lane: cell.lane,
        depth: cell.depth,
        stat: rule.stat,
        op: rule.op,
        factor,
        text,
        rarity: factor >= cfg.rareFactorThreshold ? "rare" : "normal",
      };
      this.context.state.setTileBuff(buff);
      services().event.emit(EVENT_NAMES.TileBuffSpawned, buff);
    }

    this.context.getBlockedBuffSpawnCells().clear();
  }

  public consumeTileBuff(unit: TroopUnit): void {
    const buff = this.context.state.getTileBuff(unit.lane, unit.depth);
    if (!buff) return;

    let attackDelta = 0;
    let hpDelta = 0;
    if (buff.stat === "attack") {
      attackDelta = buff.op === "mul"
        ? unit.applyAttackMultiply(buff.factor)
        : unit.applyAttackDivide(buff.factor);
    } else {
      hpDelta = buff.op === "mul"
        ? unit.applyHpMultiply(buff.factor)
        : unit.applyHpDivide(buff.factor);
    }

    this.context.state.removeTileBuff(unit.lane, unit.depth);
    this.context.getBlockedBuffSpawnCells().add(`${unit.lane},${unit.depth}`);
    this.context.setBuffConsumedSinceLastSpawn(true);
    services().event.emit(EVENT_NAMES.TileBuffConsumed, {
      unitId: unit.id,
      faction: unit.faction,
      lane: unit.lane,
      depth: unit.depth,
      buffText: buff.text,
      attackDelta,
      hpDelta,
    });
  }
}
