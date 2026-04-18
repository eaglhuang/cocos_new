// @spec-source → 見 docs/cross-reference-index.md

/** 技能效果類型 */
export type SkillEffectType = "area-damage" | "stun-all";

export interface SkillEffectDef {
  /** 對應 GeneralUnit.skillId */
  id: string;
  /** 效果分類，決定執行路徑 */
  effectType: SkillEffectType;
  /** 各效果類型的參數 */
  params: {
    /** area-damage：傷害量 */
    damage?: number;
    /** stun-all：暈眩回合數 */
    turns?: number;
  };
}

/** 技能效果查找表（純資料，無執行邏輯） */
export const SKILL_EFFECT_TABLE: SkillEffectDef[] = [
  {
    id:         "zhang-fei-roar",
    effectType: "stun-all",
    params:     { turns: 1 },
  },
  {
    id:         "guan-yu-slash",
    effectType: "area-damage",
    params:     { damage: 70 },
  },
  {
    id:         "lu-bu-rampage",
    effectType: "area-damage",
    params:     { damage: 80 },
  },
  {
    id:         "cao-cao-tactics",
    effectType: "area-damage",
    params:     { damage: 50 },
  },
];

const _index = new Map<string, SkillEffectDef>(
  SKILL_EFFECT_TABLE.map(def => [def.id, def]),
);

/** 根據 skillId 取得效果定義；找不到時回傳 null */
export function lookupSkillEffect(skillId: string | null): SkillEffectDef | null {
  if (!skillId) return null;
  return _index.get(skillId) ?? null;
}
