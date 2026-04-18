/**
 * TabBindPathPolicy
 *
 * 通用 Tab 綁定路徑政策協議（protocol）。
 *
 * 每個 Tab 的 BindPathPolicy 模組應提供一個實作此介面的物件，
 * 供 UIContentBinder、regression script 及 DI 系統統一驗證 alias 覆蓋率與路徑解析。
 *
 * 目前實作：
 * - Overview → GeneralDetailOverviewBindPathPolicy.overviewBindPathPolicy
 *
 * 未來其他 tab（Basics、Stats、Bloodline 等）升級至 contract-driven binding
 * 時，應在各自 BindPathPolicy 檔案中 export 同名 policy 物件。
 */

export interface TabBindPathPolicy {
    /** 從 field key 到 unified fragment 節點路徑的明確映射（可選，方便靜態驗證） */
    readonly aliases?: Readonly<Record<string, string>>;

    /**
     * 根據渲染目標解析 field 的綁定路徑。
     * @param fieldKey - content schema 的 field key
     * @param schemaBindPath - schema 內的 bindPath（通常為 shell 坐標系）
     * @param target - 渲染目標字串（如 'shell' | 'unified'）
     * @returns 解析後的節點路徑字串
     */
    resolveForTarget(fieldKey: string, schemaBindPath: string, target: string): string;
}
