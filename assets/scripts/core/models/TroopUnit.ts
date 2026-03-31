// @spec-source → 見 docs/cross-reference-index.md
import { Faction, TroopType } from "../config/Constants";

export interface TroopStats {
  hp: number;
  attack: number;
  defense: number;
  moveRange?: number;
  attackRange?: number;
}

export class TroopUnit {
  public readonly id: string;
  public readonly type: TroopType;
  public readonly faction: Faction;
  public readonly maxHp: number;
  public readonly attack: number;
  public readonly defense: number;
  public currentHp: number;
  
  public lane = 0;
  public depth = 0;
  
  // 新增屬性：移動力與攻擊距離
  public readonly moveRange: number;
  public readonly attackRange: number;
  public attackBonus = 0;
  public maxHpBonus = 0;
  
  // 戰鬥狀態緩存 (可用於結算時的狀態，如盾牆加倍)
  public isShieldWallActive = false;

  constructor(id: string, type: TroopType, faction: Faction, stats: TroopStats) {
    this.id = id;
    this.type = type;
    this.faction = faction;
    this.maxHp = stats.hp;
    this.currentHp = stats.hp;
    this.attack = stats.attack;
    this.defense = stats.defense;
    
    this.moveRange = stats.moveRange ?? 1;
    this.attackRange = stats.attackRange ?? 1;
  }

  public moveTo(lane: number, depth: number): void {
    this.lane = lane;
    this.depth = depth;
  }

  public takeDamage(value: number): void {
    this.currentHp = Math.max(0, this.currentHp - value);
  }

  public heal(value: number): void {
    this.currentHp = Math.min(this.getEffectiveMaxHp(), this.currentHp + value);
  }

  public getEffectiveAttack(): number {
    return Math.max(1, this.attack + this.attackBonus);
  }

  public getEffectiveMaxHp(): number {
    return Math.max(1, this.maxHp + this.maxHpBonus);
  }

  public applyAttackMultiply(factor: number): number {
    const current = this.getEffectiveAttack();
    const next = Math.max(1, Math.floor(current * factor));
    const delta = next - current;
    this.attackBonus += delta;
    return delta;
  }

  public applyAttackDivide(factor: number): number {
    const current = this.getEffectiveAttack();
    const next = Math.max(1, Math.floor(current / factor));
    const delta = next - current;
    this.attackBonus += delta;
    return delta;
  }

  public applyHpMultiply(factor: number): number {
    const currentMax = this.getEffectiveMaxHp();
    const nextMax = Math.max(1, Math.floor(currentMax * factor));
    const delta = nextMax - currentMax;
    this.maxHpBonus += delta;

    this.currentHp = Math.max(1, Math.floor(this.currentHp * factor));
    this.currentHp = Math.min(this.currentHp, this.getEffectiveMaxHp());
    return delta;
  }

  public applyHpDivide(factor: number): number {
    const currentMax = this.getEffectiveMaxHp();
    const nextMax = Math.max(1, Math.floor(currentMax / factor));
    const delta = nextMax - currentMax;
    this.maxHpBonus += delta;

    this.currentHp = Math.max(1, Math.floor(this.currentHp / factor));
    this.currentHp = Math.min(this.currentHp, this.getEffectiveMaxHp());
    return delta;
  }

  public isDead(): boolean {
    return this.currentHp <= 0;
  }
}