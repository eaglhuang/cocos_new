---
description: 端到端 UI 生產管線：Stitch 設計 → AI 貼圖 → 代碼產出 → 瀏覽器驗證
---

# 端到端 UI 生產管線

此 workflow 整合 Stitch MCP 設計、AI 貼圖產生、代碼自動產出與瀏覽器自動驗證，
實現從策劃需求到完整 UI 畫面的一站式自動化流程。

## 使用時機
- 策劃提出新 UI 畫面需求時
- 需要從零建立完整的 UI 功能畫面時

## 步驟

### Phase 1：UI 設計（Stitch MCP）

1. **產出設計稿**：使用 `mcp_StitchMCP_generate_screen_from_text` 產出初版畫面設計
   - projectId: `9626793790266375265`（主戰場畫面重設計）
   - 依需求描述生成 DESKTOP 或 MOBILE 版型

2. **套用設計系統**：使用 `mcp_StitchMCP_apply_design_system` 套用三國帝王風設計系統
   - 確保色系、字型、圓角統一

3. **迭代修正**：若設計不滿意，使用 `mcp_StitchMCP_edit_screens` 微調
   - 可多次迭代直到策劃確認

4. **擷取設計參考**：截圖作為佈局參考，分析比例數值

### Phase 2：貼圖產出

5. **建立貼圖清單**：在 `tools/ui-asset-list.json` 新增此畫面需要的貼圖
   - 每張貼圖定義 `key`、`prompt`、`size`、`sliced` 參數
   - 遵循九宮格安全規範（8px 邊距 padding）

6. **產生貼圖**：使用 `generate_image` 工具逐張產圖
   - prompt 中明確指定「適合九宮格拉伸、中央區域使用可重複紋理」
   - 輸出至 `assets/bundles/ui/sprites/{模組名}/`

7. **設定 SpriteFrame**：（手動或未來自動化）
   - 在 Cocos Creator 中設定各圖的九宮格切割參數（borderTop/Bottom/Left/Right）

### Phase 3：代碼產出

8. **產出 UILayoutConfig JSON**：根據設計稿分析，產出佈局配置
   - 放置於 `assets/resources/ui-layouts/{screen-id}.json`
   - 欄寬使用百分比（自適應）

9. **執行 /ui-scaffold**：觸發 ui-scaffold workflow 產出 TypeScript 組件

### Phase 4：驗證

10. **執行 /ui-verify**：觸發 ui-verify workflow 自動截圖驗證
    - 若失敗，自動修正 JSON 配置或代碼並重試

11. **最終確認**：將截圖嵌入 walkthrough 供人工最終確認

## 產出物清單

完成此 workflow 後，應產出：
- [ ] Stitch 設計稿截圖（參考用）
- [ ] `tools/ui-asset-list.json` 新增條目
- [ ] `assets/bundles/ui/sprites/{module}/` 下的 PNG 貼圖
- [ ] `assets/resources/ui-layouts/{screen-id}.json` 佈局配置
- [ ] `assets/scripts/ui/components/{ScreenName}Panel.ts` 組件代碼
- [ ] `tests/{ScreenName}Panel.test.ts` 單元測試
- [ ] 瀏覽器驗證通過截圖
