import { StatusEffect } from "../config/Constants";

interface BuffEntry {
  effect: StatusEffect;
  remainingTurns: number;
}

/**
 * BuffSystem — 管理所有單位的狀態效果。
 * 
 * 使用方式：
 *   services().buff.applyBuff("unit-001", StatusEffect.Stun, 1);
 *   services().buff.hasBuff("unit-001", StatusEffect.Stun); // true
 *   services().buff.tickBuff(); // 每回合結束後呼叫，倒計時並清除過期效果
 */
export class BuffSystem {
  /** key = unitId，value = 該單位身上的所有狀態效果列表 */
  private readonly buffs = new Map<string, BuffEntry[]>();

  /**
   * 對指定單位施加狀態效果。
   * 若同一效果已存在，取持續時間較長的那個（刷新不疊加）。
   */
  public applyBuff(unitId: string, effect: StatusEffect, turns: number): void {
    if (!this.buffs.has(unitId)) {
      this.buffs.set(unitId, []);
    }

    const list = this.buffs.get(unitId)!;
    const existing = list.find(b => b.effect === effect);

    if (existing) {
      existing.remainingTurns = Math.max(existing.remainingTurns, turns);
    } else {
      list.push({ effect, remainingTurns: turns });
    }
  }

  /**
   * 查詢指定單位是否患有某種狀態效果。
   */
  public hasBuff(unitId: string, effect: StatusEffect): boolean {
    const list = this.buffs.get(unitId);
    if (!list) return false;
    return list.some(b => b.effect === effect);
  }

  /**
   * 獲取某個單位身上所有列表（只讀）。
   */
  public getBuffs(unitId: string): Readonly<BuffEntry[]> {
    return this.buffs.get(unitId) ?? [];
  }

  /**
   * 每回合結束後呼叫：遞減所有 remainingTurns，移除已過期的效果。
   */
  public tickBuff(): void {
    for (const [unitId, list] of this.buffs) {
      for (const b of list) {
        b.remainingTurns -= 1;
      }

      // 清除過期（remainingTurns <= 0）的效果
      const active = list.filter(b => b.remainingTurns > 0);
      if (active.length === 0) {
        this.buffs.delete(unitId);
      } else {
        this.buffs.set(unitId, active);
      }
    }
  }

  /**
   * 清除指定單位的所有狀態效果（例如陣亡時）。
   */
  public clearUnit(unitId: string): void {
    this.buffs.delete(unitId);
  }

  /**
   * 清除所有狀態效果（戰鬥結束/重置時）。
   */
  public clearAll(): void {
    this.buffs.clear();
  }
}
