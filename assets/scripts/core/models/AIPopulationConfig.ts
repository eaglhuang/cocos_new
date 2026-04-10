/**
 * AIPopulationConfig.ts
 *
 * AI 陣營人口管控設定介面。
 * 對應規格書 §2.6「AI 陣營額外限制」。
 *
 * 設定值從 `assets/resources/data/ai-population-config.json` 載入，
 * 不寫死於程式碼，允許外部調整平衡。
 *
 * Unity 對照：類似 ScriptableObject 的 Balance Config，
 * 在 Unity 中你會做一個 [CreateAssetMenu] 的 SO 來管理這類數值。
 */

/**
 * AI 人口管控設定（從 JSON 載入）。
 */
export interface AIPopulationConfig {
    /**
     * 每位 AI 武將的終身繁殖上限。
     * 公式：3 + floor(vitality / 30)，有效值 0–5（vitality 0~60+）。
     * 此欄位為 base cap，vitality 加成由 getBreedingCap() 動態計算。
     */
    baseBreedingCap: number;

    /**
     * vitality 每增加多少點，breeding cap +1。
     * 預設值：30（對應 3 + floor(vitality/30)）。
     */
    vitalityPerCapBonus: number;

    /**
     * 單一支系最大存活人口上限。
     * 超額時支系 AI 優先走支系壓縮 + seed 重建策略。
     */
    branchPopulationCap: number;

    /**
     * 全域 AI 後裔存活人口預算（跨所有 AI 陣營）。
     * 超過時所有 AI 陣營暫停新生育，優先走 GC。
     */
    globalPopulationBudget: number;

    /**
     * 允許的最大世代深度（從史實武將算起）。
     * 超過此深度的後裔歸入非關鍵後裔，優先走 LineageSeed 壓縮。
     */
    maxGenerationDepth: number;

    /**
     * pending-delete 保留期（季數）。
     * C 類武將在隔離區保留此季數後，若仍符合 D 條件，升格為可 GC。
     * 預設值：2（保留 2 季）。
     */
    pendingDeleteRetentionSeasons: number;
}

/**
 * 根據 config + 武將 vitality 計算終身繁殖上限。
 * 公式：baseBreedingCap + floor(vitality / vitalityPerCapBonus)
 * 最高 5 次（由 config.baseBreedingCap + 上限規則決定）。
 */
export function getBreedingCap(config: AIPopulationConfig, vitality: number): number {
    const bonus = Math.floor(vitality / config.vitalityPerCapBonus);
    // 最高 5（baseBreedingCap 預設 3，bonus 最多 2 at vitality=60）
    return Math.min(config.baseBreedingCap + bonus, 5);
}

/** 預設設定（作為 fallback，JSON 載入前使用） */
export const DEFAULT_AI_POPULATION_CONFIG: AIPopulationConfig = {
    baseBreedingCap: 3,
    vitalityPerCapBonus: 30,
    branchPopulationCap: 50,
    globalPopulationBudget: 500,
    maxGenerationDepth: 8,
    pendingDeleteRetentionSeasons: 2,
};
