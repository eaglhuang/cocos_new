// @spec-source → 見 docs/cross-reference-index.md
import {
  Faction,
  GAME_CONFIG,
  TroopType,
  TROOP_COUNTER_MAP,
} from "../../core/config/Constants";
import { BattleState } from "../models/BattleState";

export interface DeployDecision {
  type: TroopType;
  lane: number;
}

/** AI 可使用的兵種池（從 MVP 三兵種開始） */
const AI_USABLE_TYPES: TroopType[] = [
  TroopType.Cavalry,
  TroopType.Infantry,
  TroopType.Shield,
  TroopType.Archer,
  TroopType.Pikeman,
];

export class EnemyAI {
  /**
   * 根據當前棋盤狀態與可用 DP 決定本回合部署。
   * 策略：以計數器兵種對抗玩家最多的兵種；無對手時隨機。
   */
  public decideDeploy(state: BattleState, availableDp: number): DeployDecision[] {
    const decisions: DeployDecision[] = [];
    const deployDepth = GAME_CONFIG.GRID_DEPTH - 1;

    for (let i = 0; i < GAME_CONFIG.MAX_ENEMY_DEPLOY_PER_TURN; i++) {
      const freeLanes = this.getFreeLanes(state, deployDepth);
      if (freeLanes.length === 0) break;

      const type = this.pickCounterType(state, availableDp);
      if (!type) break;

      const lane = freeLanes[Math.floor(Math.random() * freeLanes.length)];
      decisions.push({ type, lane });
    }

    return decisions;
  }

  /** 找出對玩家最多兵種有剋制優勢的兵種 */
  private pickCounterType(state: BattleState, availableDp: number): TroopType | null {
    const affordable = AI_USABLE_TYPES;
    if (affordable.length === 0) return null;

    // 統計玩家各兵種數量
    const counts = new Map<TroopType, number>();
    state.units.forEach(unit => {
      if (unit.faction === Faction.Player) {
        counts.set(unit.type, (counts.get(unit.type) ?? 0) + 1);
      }
    });

    // 找出玩家最多的兵種
    let mostCommon: TroopType | null = null;
    let maxCount = 0;
    counts.forEach((count, type) => {
      if (count > maxCount) { mostCommon = type; maxCount = count; }
    });

    // 找出可購買的對抗兵種（TROOP_COUNTER_MAP[counter] === mostCommon 表示 counter 剋 mostCommon）
    // 僅有 AI_COUNTER_STRATEGY_CHANCE 的機率才嘗試對抗；將軍不是全知全能
    if (mostCommon && Math.random() < GAME_CONFIG.AI_COUNTER_STRATEGY_CHANCE) {
      for (const aiType of affordable) {
        if (TROOP_COUNTER_MAP[aiType] === mostCommon) return aiType;
      }
    }

    // 無法剋制時隨機選
    return affordable[Math.floor(Math.random() * affordable.length)];
  }

  private getFreeLanes(state: BattleState, deployDepth: number): number[] {
    const free: number[] = [];
    for (let lane = 0; lane < GAME_CONFIG.GRID_LANES; lane++) {
      if (!state.getCell(lane, deployDepth)?.occupantId) free.push(lane);
    }
    return free;
  }
}
