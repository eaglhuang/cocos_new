// @spec-source → docs/UCUF規範文件.md §6  (UCUF M6)
/**
 * AssetRegistryEntry — UCUF 資源登記簿型別定義
 *
 * UCUF M6：提供靜態收集（CLI 掃描 layout/skin JSON）與動態登記
 * （ChildPanel runtime 載入）兩種資源追蹤路徑的共用型別。
 *
 * 靜態收集：由 `tools_node/collect-asset-registry.js` 掃描所有 screen spec，
 * 遞迴解析 layout $ref + skin themeStack + tabRouting fragments，
 * 輸出完整 AssetRegistryEntry[] 供 `audit-asset-usage.js` 比對。
 *
 * 動態登記：ChildPanelBase.registerDynamicAsset() 在 runtime 追蹤
 * 非 spec-declared 的動態載入資源（例如根據武將 ID 載入特定立繪）。
 *
 * Unity 對照：Addressable Asset 的 AssetReference + AssetEntry 概念。
 */

// ─── 資源引用型別 ──────────────────────────────────────────────────────────────

/** 資源類型 */
export type AssetRefType = 'spriteFrame' | 'layout' | 'skin' | 'fragment' | 'recipe' | 'dynamic';

/** 單筆資源引用 */
export interface AssetRef {
    /** 資源類型 */
    type: AssetRefType;

    /** 資源路徑（相對於 assets/resources/） */
    path: string;

    /** 引用來源（哪個 JSON 宣告了此引用） */
    registeredIn: string;
}

// ─── 登記簿條目 ────────────────────────────────────────────────────────────────

/** 單個 Screen 的完整資源登記簿 */
export interface AssetRegistryEntry {
    /** Screen spec ID */
    screenId: string;

    /** Layout spec ID */
    layoutId: string;

    /** Skin manifest ID */
    skinId: string;

    /** 此 screen 引用的所有資源 */
    assets: AssetRef[];

    /** 引用存在但實體檔案缺失 */
    missing: AssetRef[];

    /** 動態載入的資源（runtime 登記，非靜態宣告） */
    dynamic: AssetRef[];
}

// ─── 審計報告 ──────────────────────────────────────────────────────────────────

/** 孤兒資源（實體存在但無任何 screen 引用） */
export interface OrphanAsset {
    /** 檔案路徑（相對於 assets/resources/） */
    path: string;

    /** 所在目錄 */
    directory: string;
}

/** 完整的審計報告 */
export interface AssetAuditReport {
    /** 掃描時間 */
    timestamp: string;

    /** 所有 screen 的 registry 條目 */
    entries: AssetRegistryEntry[];

    /** 孤兒資源列表 */
    orphans: OrphanAsset[];

    /** 統計摘要 */
    summary: {
        totalScreens:   number;
        totalAssets:     number;
        totalMissing:    number;
        totalOrphans:    number;
        totalDynamic:    number;
    };
}
