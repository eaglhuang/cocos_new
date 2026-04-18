// @spec-source → 見 docs/cross-reference-index.md
import { Faction, GAME_CONFIG, TerrainType, Weather, BattleTactic } from "../../core/config/Constants";
import { GeneralUnit } from "../../core/models/GeneralUnit";
import { TroopUnit } from "../../core/models/TroopUnit";

export interface GridCell {
  lane: number;
  depth: number;
  terrain: TerrainType;
  occupantId: string | null;
}

export interface TileBuff {
  id: string;
  lane: number;
  depth: number;
  stat: "attack" | "hp";
  op: "mul" | "div";
  factor: number;
  text: string;
  rarity: "normal" | "rare";
}

export type TileEffectState = 'hazard-fire' | 'hazard-rock' | 'river-current' | 'ambush-field' | 'night-raid';
export type TileEffectMoveDirection = 'forward' | 'backward';

export interface TileEffect {
  id: string;
  lane: number;
  depth: number;
  state: TileEffectState;
  damagePerTurn?: number;
  blocksMovement?: boolean;
  forcedMoveDirection?: TileEffectMoveDirection;
  forcedMoveSteps?: number;
  moveRangeDelta?: number;
  notes?: string;
}

export interface SceneBattleFlags {
  stealthOpenTurns: number;
  nightRaid: boolean;
  nightRaidOpenTurns: number;
}

export interface DamageLinkState {
  primaryUnitUid: string;
  linkedUnitUids: string[];
  shareRatio: number;
  battleSkillId: string;
}

export interface CounterReactionState {
  unitUid: string;
  battleSkillId: string;
  counterRatio: number;
  statusTurns: number;
  remainingTriggers: number;
  meleeOnly: boolean;
}

export interface ActionResetState {
  unitUid: string;
  battleSkillId: string;
  firstHitMultiplier: number;
  firstHitPending: boolean;
  remainingExtraActions: number;
}

/** encounters.json 中的地形配置：terrain[lane][depth] */
export type TerrainGrid = TerrainType[][];

export class BattleState {
  public readonly cells: GridCell[] = [];
  public readonly units = new Map<string, TroopUnit>();
  public readonly tileBuffs = new Map<string, TileBuff>();
  public readonly tileEffects = new Map<string, TileEffect>();
  public readonly damageLinks = new Map<string, DamageLinkState>();
  public readonly counterReactions = new Map<string, CounterReactionState>();
  public readonly actionResets = new Map<string, ActionResetState>();

  public playerGeneral: GeneralUnit | null = null;
  public enemyGeneral: GeneralUnit | null = null;
  public playerFortressHp = 500;
  public enemyFortressHp = 500;
  /** 營曜天氣（影響戰場修正預留欄位） */
  public weather: Weather = Weather.Clear;
  /** 場景戰法（特殊戰場規則預留欄位） */
  public battleTactic: BattleTactic = BattleTactic.Normal;
  public sceneFlags: SceneBattleFlags = { stealthOpenTurns: 0, nightRaid: false, nightRaidOpenTurns: 0 };

  constructor() {
    for (let lane = 0; lane < GAME_CONFIG.GRID_LANES; lane++) {
      for (let depth = 0; depth < GAME_CONFIG.GRID_DEPTH; depth++) {
        this.cells.push({ lane, depth, terrain: TerrainType.Plain, occupantId: null });
      }
    }
  }

  /** 為新一局戰鬥重置所有狀態 */
  public reset(
    playerGeneral: GeneralUnit,
    enemyGeneral: GeneralUnit,
    terrainGrid?: TerrainGrid,
    weather?: Weather,
    battleTactic?: BattleTactic,
  ): void {
    this.units.clear();
    this.tileBuffs.clear();
    this.tileEffects.clear();
    this.damageLinks.clear();
    this.counterReactions.clear();
    this.actionResets.clear();
    this.cells.forEach(cell => {
      cell.occupantId = null;
      cell.terrain = TerrainType.Plain;
    });

    this.playerGeneral = playerGeneral;
    this.enemyGeneral  = enemyGeneral;
    this.playerFortressHp = 500;
    this.enemyFortressHp  = 500;
    this.weather     = weather     ?? Weather.Clear;
    this.battleTactic = battleTactic ?? BattleTactic.Normal;
    this.sceneFlags = { stealthOpenTurns: 0, nightRaid: false, nightRaidOpenTurns: 0 };

    // 重置武將狀態
    playerGeneral.currentHp = playerGeneral.maxHp;
    playerGeneral.currentSp = 0;
    enemyGeneral.currentHp  = enemyGeneral.maxHp;
    enemyGeneral.currentSp  = 0;

    // 套用地形配置
    if (terrainGrid) {
      for (let lane = 0; lane < GAME_CONFIG.GRID_LANES; lane++) {
        for (let depth = 0; depth < GAME_CONFIG.GRID_DEPTH; depth++) {
          const t = terrainGrid[lane]?.[depth];
          if (t) {
            const cell = this.getCell(lane, depth);
            if (cell) cell.terrain = t;
          }
        }
      }
    }
  }

  /** O(1) 索引直算取格 */
  public getCell(lane: number, depth: number): GridCell | null {
    if (lane < 0 || lane >= GAME_CONFIG.GRID_LANES || depth < 0 || depth >= GAME_CONFIG.GRID_DEPTH) {
      return null;
    }
    return this.cells[lane * GAME_CONFIG.GRID_DEPTH + depth];
  }

  public getGeneral(faction: Faction): GeneralUnit | null {
    return faction === Faction.Player ? this.playerGeneral : this.enemyGeneral;
  }

  public addUnit(unit: TroopUnit): void {
    this.units.set(unit.id, unit);
    const cell = this.getCell(unit.lane, unit.depth);
    if (cell) cell.occupantId = unit.id;
  }

  public removeUnit(unitId: string): void {
    const unit = this.units.get(unitId);
    if (!unit) return;
    const cell = this.getCell(unit.lane, unit.depth);
    if (cell?.occupantId === unitId) cell.occupantId = null;
    this.units.delete(unitId);
    this.removeDamageLinksForUnit(unitId);
    this.removeCounterReaction(unitId);
    this.removeActionReset(unitId);
  }

  public setTileBuff(buff: TileBuff): void {
    this.tileBuffs.set(`${buff.lane},${buff.depth}`, buff);
  }

  public getTileBuff(lane: number, depth: number): TileBuff | null {
    return this.tileBuffs.get(`${lane},${depth}`) ?? null;
  }

  public removeTileBuff(lane: number, depth: number): TileBuff | null {
    const key = `${lane},${depth}`;
    const buff = this.tileBuffs.get(key) ?? null;
    if (buff) {
      this.tileBuffs.delete(key);
    }
    return buff;
  }

  public setTileEffect(effect: TileEffect): void {
    this.tileEffects.set(`${effect.lane},${effect.depth}`, effect);
  }

  public getTileEffect(lane: number, depth: number): TileEffect | null {
    return this.tileEffects.get(`${lane},${depth}`) ?? null;
  }

  public removeTileEffect(lane: number, depth: number): TileEffect | null {
    const key = `${lane},${depth}`;
    const effect = this.tileEffects.get(key) ?? null;
    if (effect) {
      this.tileEffects.delete(key);
    }
    return effect;
  }

  public setDamageLink(link: DamageLinkState): void {
    this.damageLinks.set(link.primaryUnitUid, link);
  }

  public getDamageLink(primaryUnitUid: string): DamageLinkState | null {
    return this.damageLinks.get(primaryUnitUid) ?? null;
  }

  public removeDamageLinksForUnit(unitId: string): void {
    this.damageLinks.delete(unitId);
    for (const [primaryUnitUid, link] of this.damageLinks.entries()) {
      if (!link.linkedUnitUids.includes(unitId)) {
        continue;
      }
      const remainingLinked = link.linkedUnitUids.filter((linkedUid) => linkedUid !== unitId);
      if (!remainingLinked.length) {
        this.damageLinks.delete(primaryUnitUid);
        continue;
      }
      this.damageLinks.set(primaryUnitUid, {
        ...link,
        linkedUnitUids: remainingLinked,
      });
    }
  }

  public setCounterReaction(state: CounterReactionState): void {
    this.counterReactions.set(state.unitUid, state);
  }

  public getCounterReaction(unitUid: string): CounterReactionState | null {
    return this.counterReactions.get(unitUid) ?? null;
  }

  public removeCounterReaction(unitUid: string): void {
    this.counterReactions.delete(unitUid);
  }

  public setActionReset(state: ActionResetState): void {
    this.actionResets.set(state.unitUid, state);
  }

  public getActionReset(unitUid: string): ActionResetState | null {
    return this.actionResets.get(unitUid) ?? null;
  }

  public removeActionReset(unitUid: string): void {
    this.actionResets.delete(unitUid);
  }

  /** 取得指定路線上指定陣營的所有單位，依 depth 排序 */
  public getUnitsInLane(lane: number, faction: Faction): TroopUnit[] {
    const result: TroopUnit[] = [];
    this.units.forEach(unit => {
      if (unit.lane === lane && unit.faction === faction) result.push(unit);
    });
    result.sort((a, b) => a.depth - b.depth);
    return result;
  }
}
