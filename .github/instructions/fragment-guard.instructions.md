---
applyTo: "assets/resources/ui-spec/fragments/**"
---

# Fragment Guard

## 修改 Fragment 前的強制步驟

1. **查影響範圍**：修改任何 `fragments/layouts/` 或 `fragments/widgets/` 之前，必須先執行：
   ```bash
   node tools_node/build-fragment-usage-map.js --query <fragment-ref>
   ```
   確認哪些 layout / screen 會受影響。

2. **不可變欄位**：Fragment 中的 `type` 欄位為不可覆寫（immutable）。在 `$ref` 引用端不得同時宣告不同的 `type`，否則 `validate-ui-specs.js --strict` 會報錯（規則 `no-override-immutable`）。

3. **Widget Registry 同步**：若新增或刪除 `fragments/widgets/` 下的 JSON，必須同步更新 `fragments/widget-registry.json`，並執行：
   ```bash
   node tools_node/validate-widget-registry.js
   ```

4. **Layout Fragment 命名**：Layout fragment 檔名使用 `<screen-prefix>-<section-name>.json` 格式（例如 `gdv3-header-row.json`），保持可追溯至所屬畫面。

5. **Regression 驗證**：若修改的 fragment 被 regression check script 涵蓋，修改後必須執行對應的 regression check。

## Merge 語意提醒

- `$ref` 合併邏輯：`{ ...fragment, ...node }`，node 端的屬性會覆寫 fragment 同名屬性
- 若 `$ref` 引用端只有 `{ "$ref": "..." }`，則 fragment 整體就是該節點
- 若需要覆寫部分屬性（如 `name`、`width`、`widget`），在引用端直接宣告即可
