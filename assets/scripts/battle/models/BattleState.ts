// @spec-source → 見 docs/cross-reference-index.md
import { Faction, GAME_CONFIG, TerrainType } from "../../core/config/Constants";
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

/** encounters.json 中的地形配置：terrain[lane][depth] */
export type TerrainGrid = TerrainType[][];

export class BattleState {
  public readonly cells: GridCell[] = [];
  public readonly units = new Map<string, TroopUnit>();
  public readonly tileBuffs = new Map<string, TileBuff>();

  public playerGeneral: GeneralUnit | null = null;
  public enemyGeneral: GeneralUnit | null = null;
  public playerFortressHp = 500;
  public enemyFortressHp = 500;

  constructor() {
    for (let lane = 0; lane < GAME_CONFIG.GRID_LANES; lane++) {
      for (let depth = 0; depth < GAME_CONFIG.GRID_DEPTH; depth++) {
        this.cells.push({ lane, depth, terrain: TerrainType.Plain, occupantId: null });
      }
    }
  }

  /** 為新一局戰鬥重置所有狀態 */
  public reset(playerGeneral: GeneralUnit, enemyGeneral: GeneralUnit, terrainGrid?: TerrainGrid): void {
    this.units.clear();
    this.tileBuffs.clear();
    this.cells.forEach(cell => {
      cell.occupantId = null;
      cell.terrain = TerrainType.Plain;
    });

    this.playerGeneral = playerGeneral;
    this.enemyGeneral  = enemyGeneral;
    this.playerFortressHp = 500;
    this.enemyFortressHp  = 500;

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
