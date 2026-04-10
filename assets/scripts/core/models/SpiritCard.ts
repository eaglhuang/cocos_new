/**
 * SpiritCard.ts
 *
 * 已故武將的「魂卡」（Spirit_Card）快照介面。
 * 武將死亡時，由 GeneralArchiver 根據此介面建立快照，
 * 主體資料移至 L5 歸檔層，L1 活躍列表釋放。
 *
 * Unity 對照：類似 ScriptableObject 記錄一個角色的「最後狀態」，
 * 作為歷史存檔使用，不再參與遊戲邏輯計算。
 *
 * 2026-04-08 擴充（§2.6 長局單機生命周期）：
 *   - lifecycleClass：A/B/C/D 分類標記
 *   - resurrectionEligible：復活資格旗標
 *   - parentUids：父母 uid（血脈索引）
 *   - birthYear / deathYear：出生/死亡年份
 *   - rarityTier 型別修正：對齊 GeneralUnit 的 5 級制
 */

import { GeneralLifecycleClass } from './GeneralLifecycle';

export interface DeathContext {
    battleId: string;          // 死亡時的戰鬥 ID
    killedBy?: string;         // 擊殺者 uid（可能為空，如病故）
    cause: 'battle' | 'event' | 'age' | 'execution' | 'unknown';
    season: number;
    year: number;
    location?: string;         // 死亡地點名稱（可選）
}

/** 對齊 GeneralUnit 的 GeneralDetailRarityTier 5 級制 */
export type SpiritCardRarityTier = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface SpiritCard {
    uid: string;               // 武將 uid（保留，可反查歸檔資料）
    name: string;
    faction: string;
    characterCategory: 'military' | 'civil' | 'strategist' | 'other';
    /** 核心稀有度（5 級制，對齊 GeneralUnit.GeneralDetailRarityTier） */
    rarityTier: SpiritCardRarityTier;
    gene_refs: string[];       // 基因 uid 列表（保留血脈傳承依據）
    ep_snapshot: number;       // 死亡時的最終 EP 值
    ageAtDeath?: number;       // 死亡年齡（可選）
    deathContext: DeathContext;
    archivedAt: number;        // 歸檔 Unix ms 時間戳

    // --- 2026-04-08 長局生命周期擴充欄位 ---

    /** 生命周期分類（A/B/C/D），決定 GC 路由 */
    lifecycleClass: GeneralLifecycleClass;
    /** 是否具備復活資格（A 類永遠 true；D 類永遠 false） */
    resurrectionEligible: boolean;
    /** 父母 uid [父, 母]（血脈索引；史實武將填 ['', '']） */
    parentUids: [string, string];
    /** 出生年份（遊戲內年份） */
    birthYear?: number;
    /** 死亡年份（遊戲內年份，通常與 deathContext.year 相同） */
    deathYear?: number;
}
