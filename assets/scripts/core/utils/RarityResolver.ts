// @spec-source → docs/資料中心架構規格書.md §3.3 (DC-0-0003)
import { GeneralConfig, GeneralDetailRarityTier, CharacterCategory } from '../models/GeneralUnit';

/** rarity-thresholds.json 的型別結構 */
interface RarityThresholds {
  axes: {
    maxStat: Record<string, number>;
    avg5: Record<string, number>;
  };
  excludeFromAvg: string[];
  categoryOverrides: Record<CharacterCategory, GeneralDetailRarityTier>;
  tierOrder: GeneralDetailRarityTier[];
}

/** 預設門檻（當外部 JSON 尚未載入時使用）*/
const DEFAULT_THRESHOLDS: RarityThresholds = {
  axes: {
    maxStat: { legendary: 95, epic: 80, rare: 65 },
    avg5: { legendary: 80, epic: 65, rare: 50 },
  },
  excludeFromAvg: ['luk'],
  categoryOverrides: { mythical: 'mythic', titled: 'legendary', civilian: 'common', general: 'common', famed: 'rare' },
  tierOrder: ['common', 'rare', 'epic', 'legendary', 'mythic'],
};

let _thresholds: RarityThresholds = DEFAULT_THRESHOLDS;

/** 供外部在載入 rarity-thresholds.json 後呼叫，注入門檻資料 */
export function setRarityThresholds(data: RarityThresholds): void {
  _thresholds = data;
}

/** 目前使用中的門檻（供測試讀取） */
export function getRarityThresholds(): RarityThresholds {
  return _thresholds;
}

/**
 * 從一個 axisThresholds（例如 maxStat 軸）解析對應 tier。
 * tiersInOrder 為由高到低排列。
 */
function resolveTierFromAxis(
  value: number,
  axisThresholds: Record<string, number>,
  tierOrder: GeneralDetailRarityTier[]
): GeneralDetailRarityTier {
  // 由高 tier 往低 tier 檢查，第一個 value >= 門檻 就採用
  const highToLow = [...tierOrder].reverse().filter(t => t in axisThresholds) as GeneralDetailRarityTier[];
  for (const tier of highToLow) {
    if (value >= axisThresholds[tier]) {
      return tier;
    }
  }
  return 'common';
}

/**
 * 取兩個 tier 中較高者（依 tierOrder 判斷）。
 */
function higherTier(a: GeneralDetailRarityTier, b: GeneralDetailRarityTier): GeneralDetailRarityTier {
  const order = _thresholds.tierOrder;
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}

/**
 * 計算武將六維去 excludeFromAvg 後的平均值（avg5）。
 */
function calcAvg5(config: GeneralConfig): number {
  const exclude = new Set(_thresholds.excludeFromAvg);
  const statFields: (keyof GeneralConfig)[] = ['str', 'int', 'lea', 'pol', 'cha', 'luk'];
  const values: number[] = [];
  for (const field of statFields) {
    if (!exclude.has(field as string)) {
      const v = config[field] as number | undefined;
      if (typeof v === 'number') values.push(v);
    }
  }
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * 計算武將六維中的最高值（maxStat）。
 */
function calcMaxStat(config: GeneralConfig): number {
  const statFields: (keyof GeneralConfig)[] = ['str', 'int', 'lea', 'pol', 'cha', 'luk'];
  let max = 0;
  for (const field of statFields) {
    const v = config[field] as number | undefined;
    if (typeof v === 'number' && v > max) max = v;
  }
  return max;
}

/**
 * 雙軸稀有度自動判定。
 *
 * 規則：
 * 1. 若 characterCategory 在 categoryOverrides 中，直接採用覆寫 tier（例如 mythical → mythic）
 * 2. 否則雙軸（maxStat + avg5）各自判定，取較高 tier
 *
 * Unity 對照：類似 ScriptableObject 中讀取外部 config 表的評分系統（如英雄品質自動計算）。
 */
export function resolveRarityTier(config: GeneralConfig): GeneralDetailRarityTier {
  // 若有 characterCategory override，直接回傳
  const cat = config.characterCategory as CharacterCategory | undefined;
  if (cat && _thresholds.categoryOverrides[cat]) {
    return _thresholds.categoryOverrides[cat];
  }

  const maxStat = calcMaxStat(config);
  const avg5 = calcAvg5(config);

  const tierByMax = resolveTierFromAxis(maxStat, _thresholds.axes.maxStat, _thresholds.tierOrder);
  const tierByAvg = resolveTierFromAxis(avg5, _thresholds.axes.avg5, _thresholds.tierOrder);

  return higherTier(tierByMax, tierByAvg);
}
