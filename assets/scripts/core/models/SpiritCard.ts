/**
 * SpiritCard.ts
 * 
 * 已故武將的「魂卡」（Spirit_Card）快照介面。
 * 武將死亡時，由 GeneralArchiver 根據此介面建立快照，
 * 主體資料移至 L5 歸檔層，L1 活躍列表釋放。
 * 
 * Unity 對照：類似 ScriptableObject 記錄一個角色的「最後狀態」，
 * 作為歷史存檔使用，不再參與遊戲邏輯計算。
 */

export interface DeathContext {
    battleId: string;          // 死亡時的戰鬥 ID
    killedBy?: string;         // 擊殺者 uid（可能為空，如病故）
    cause: 'battle' | 'event' | 'age' | 'execution' | 'unknown';
    season: number;
    year: number;
    location?: string;         // 死亡地點名稱（可選）
}

export interface SpiritCard {
    uid: string;               // 武將 uid（保留，可反查歸檔資料）
    name: string;
    faction: string;
    characterCategory: 'military' | 'civil' | 'strategist' | 'other';
    rarityTier: 'S' | 'A' | 'B' | 'C' | 'D';
    gene_refs: string[];       // 基因 uid 列表（保留血脈傳承依據）
    ep_snapshot: number;       // 死亡時的最終 EP 值
    ageAtDeath?: number;       // 死亡年齡（可選）
    deathContext: DeathContext;
    archivedAt: number;        // 歸檔 Unix ms 時間戳
}
