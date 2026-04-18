// @spec-source → 見 docs/cross-reference-index.md
import { Faction, GAME_CONFIG } from "../core/config/Constants";

/** 戰鬥結果型別（全域唯一定義，從此由此匯出） */
export type BattleResult = "player-win" | "enemy-win" | "draw" | "ongoing";

/** 可以對敵將發動攻擊的最前線 depth */
export const BATTLE_FRONT_DEPTH: Record<Faction, number> = {
  [Faction.Player]: GAME_CONFIG.GRID_DEPTH - 1, // depth 7
  [Faction.Enemy]:  0,
};
