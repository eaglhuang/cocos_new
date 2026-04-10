/**
 * FamilyBranchSummary.ts
 *
 * 已滅絕支系的壓縮摘要介面。
 * 當一個血脈支系所有後裔皆亡且皆為 D 類時，
 * BranchCompactor 會產出此摘要，取代完整個體資料，
 * 大幅縮減長局儲存佔用。
 *
 * Unity 對照：類似 "Addressables" 卸載不再需要的 Asset Bundle，
 * 只保留 bundle 的 catalog entry，而非整包 bundle。
 */

/**
 * 支系成員的最小血脈索引（只保留 uid + 父母鏈，不保留完整個體）。
 */
export interface LineageNode {
    uid: string;
    parentUids: [string, string]; // [父 uid, 母 uid]
    birthYear: number;
    deathYear: number;
    rarityTier: string;
}

/**
 * 已滅絕支系的壓縮摘要。
 * 由 BranchCompactor 在支系判定為完全滅絕時產出。
 */
export interface FamilyBranchSummary {
    /** 支系根源武將 uid（支系創始人） */
    branchRootUid: string;
    /** 支系名稱（通常等於根源武將姓名 + 支） */
    branchName: string;
    /** 滅絕時的年-季（如 "120-Q3"） */
    extinctAt: string;
    /** 從根源到最後一代的世代數 */
    generationCount: number;
    /** 支系總成員數（含已滅絕） */
    memberCount: number;
    /** 支系中最高 rarityTier 武將 uid */
    highestRarityUid: string;
    /** 保留 3–5 個代表性基因 id，供族譜追蹤 */
    geneHighlights: string[];
    /** 支系代表事件（最多 5 條，如「xx年滅 xxxx」） */
    representativeEvents: string[];
    /** 最小血脈索引（支系所有成員的 LineageNode） */
    lineageNodes: LineageNode[];
    /** 壓縮完成的 Unix ms 時間戳 */
    compactedAt: number;
    /**
     * （可選）Lineage Seed 字串：
     * 若支系屬非關鍵 AI 後裔，可進一步壓縮為 seed，
     * 需要時透過 LineageSeedStore 重建基本資料。
     */
    lineageSeed?: string;
}
