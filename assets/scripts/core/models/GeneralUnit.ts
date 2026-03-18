import { Faction, TerrainType } from "../config/Constants";

/**
 * 武將資料模型 — 純資料，不依賴 Cocos 節點。
 * 武將的攻擊加成會透過 FormulaSystem 的 attackBonus 參數生效。
 */
export class GeneralUnit {
  public readonly id: string;
  public readonly name: string;
  public readonly faction: Faction;
  public readonly maxHp: number;
  public currentHp: number;
  
  // 新增屬性：能量 (SP) 系統
  public readonly maxSp: number;
  public currentSp: number;

  /** 技能識別字，用於 BattleController 分派對應技能邏輯 */
  public readonly skillId: string | null;

  /** 該武將提供給同陣營兵種的攻擊加成比例（例如 0.1 = +10%） */
  public readonly attackBonus: number;
  /** 該武將擅長的地形，在此地形上額外提供防禦加成 */
  public readonly preferredTerrain: TerrainType;
  /** 擅長地形上的額外防禦加成比例 */
  public readonly terrainDefenseBonus: number;

  constructor(config: GeneralConfig) {
    this.id = config.id;
    this.name = config.name;
    this.faction = config.faction;
    this.maxHp = config.hp;
    this.currentHp = config.hp;
    this.maxSp = config.maxSp ?? 100;
    this.currentSp = config.initialSp ?? 0;
    this.skillId = config.skillId ?? null;
    
    this.attackBonus = config.attackBonus ?? 0;
    this.preferredTerrain = config.preferredTerrain ?? TerrainType.Plain;
    this.terrainDefenseBonus = config.terrainDefenseBonus ?? 0;
  }

  public takeDamage(value: number): void {
    this.currentHp = Math.max(0, this.currentHp - value);
  }

  public heal(value: number): void {
    this.currentHp = Math.min(this.maxHp, this.currentHp + value);
  }

  public addSp(value: number): void {
    this.currentSp = Math.min(this.maxSp, this.currentSp + value);
  }

  public isDead(): boolean {
    return this.currentHp <= 0;
  }

  public canUseSkill(): boolean {
    return this.currentSp >= this.maxSp;
  }
}

export interface GeneralConfig {
  id: string;
  name: string;
  faction: Faction;
  hp: number;
  maxSp?: number;
  initialSp?: number;
  skillId?: string;
  attackBonus?: number;
  preferredTerrain?: TerrainType;
  terrainDefenseBonus?: number;
}
