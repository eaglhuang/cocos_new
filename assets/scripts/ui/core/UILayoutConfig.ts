// @spec-source → 見 docs/cross-reference-index.md
/**
 * UILayoutConfig — 已棄用，請改用 UISpecTypes.ts
 *
 * 此檔案的型別已被 UISpecTypes.ts 的三層契約架構取代：
 *   - UILayoutConfig → UILayoutSpec (layout JSON)
 *   - UINodeDef     → UILayoutNodeSpec
 *   - LayoutDef     → LayoutDef (重新定義於 UISpecTypes)
 *   - WidgetDef     → WidgetDef (重新定義於 UISpecTypes)
 *
 * 保留此檔案僅為向下相容過渡期使用。
 * 新代碼請一律 import from './UISpecTypes'。
 *
 * @deprecated 使用 UISpecTypes.ts 取代
 */

// 重新匯出新型別，維持舊 import 路徑可用
export {
    resolveSize,
    type UILayoutSpec as UILayoutConfig,
    type UILayoutNodeSpec as UINodeDef,
    type LayoutDef,
    type WidgetDef,
} from './UISpecTypes';
