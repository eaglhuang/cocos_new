import { BattleTactic } from "../../core/config/Constants";

export interface BattleSceneGambitSummary {
  label: string;
  description: string;
}

const SCENE_GAMBIT_LABELS: Partial<Record<BattleTactic, string>> = {
  [BattleTactic.FireAttack]: "火攻場勢",
  [BattleTactic.FloodAttack]: "水淹場勢",
  [BattleTactic.RockSlide]: "落石封路",
  [BattleTactic.AmbushAttack]: "森林伏兵",
  [BattleTactic.NightRaid]: "夜襲奇襲",
};

const SCENE_GAMBIT_DESCRIPTIONS: Partial<Record<BattleTactic, string>> = {
  [BattleTactic.FireAttack]: "中線火海已展開，停留其中的部隊會持續受傷。",
  [BattleTactic.FloodAttack]: "河道激流已成形，進入水域的部隊會被順流推移。",
  [BattleTactic.RockSlide]: "前方落石封鎖部分路線，部隊將被迫繞行。",
  [BattleTactic.AmbushAttack]: "前 2 回合我方伏兵隱匿，敵軍索敵會忽略我方潛伏單位。",
  [BattleTactic.NightRaid]: "前 2 回合夜襲生效：我方先制增傷，敵軍遠程視野受限。",
};

export function buildSceneGambitSummary(battleTactic: BattleTactic): BattleSceneGambitSummary | null {
  if (battleTactic === BattleTactic.Normal) {
    return null;
  }

  return {
    label: SCENE_GAMBIT_LABELS[battleTactic] ?? "場景戰法",
    description: SCENE_GAMBIT_DESCRIPTIONS[battleTactic] ?? "場景戰法已生效",
  };
}
