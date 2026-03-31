---
name: ui-vibe-pipeline
description: 'Use for Cocos UI, JSON layout, skin manifest, atlas planning, 9-slice validation, Auto Atlas policy, preview generation, vibe coding workflow, and mass-producing UI screens with consistent structure.'
argument-hint: 'Describe the target screen, visual style, and whether you need layout spec, skin manifest, preview workflow, or validation.'
---

# UI Vibe Pipeline

## When to Use

- 建立新的 Cocos UI 畫面
- 從截圖或規格文字轉換為 layout + skin JSON
- 檢查 atlas 分組與九宮格正確性
- 產生預覽並驗證 UI 排版
- 批量生產 UI 畫面

## When NOT to Use

- 單純修復 runtime bug（無關 UI 生產流程）
- 手動調整單一 Prefab 節點

## Core Principle: 三層資料契約

**UI 的唯一真實來源不是 Prefab，而是三層 JSON**：

1. `assets/resources/ui-spec/layouts/*.json` — 結構、版位、Widget、Layout
2. `assets/resources/ui-spec/skins/*.json` — SpriteFrame、九宮格、字型、顏色、狀態圖
3. `assets/resources/ui-spec/screens/*.json` — 組裝：layout + skin + bundle + 驗證規則

## Global Design Tokens

`assets/resources/ui-spec/ui-design-tokens.json` 定義全遊戲的 UI 風格參數。
所有 skin manifest 應繼承這些值。

## Procedure

### 1. 確認系統規格

檢查 `docs/ui/systems/{系統名}/` 目錄：
- **有 spec.md** → 嚴格遵守
- **目錄為空** → 根據截圖或 design-brief 推斷

### 2. 產出 design-brief

執行 `/ui-generate-brief` 或手動撰寫 `artifacts/ui-source/{系統名}/design-brief.md`。

### 3. 產出/取得參考截圖

優先順序：
1. 人工提供的 `reference.png`
2. 外部 AI 設計截圖
3. Stitch MCP 設計稿
4. 自動產出：執行 `/ui-generate-reference`

### 4. 建立三層 JSON

根據截圖分析與 design-brief 產出：
- `ui-spec/layouts/{系統名}-main.json`
- `ui-spec/skins/{系統名}-default.json`
- `ui-spec/screens/{系統名}-screen.json`

### 5. 驗證

使用 `UIValidationRunner` 檢查：
- 九宮格 border 整數
- 百分比加總 ≤ 100%
- 觸控熱區 ≥ 44×44
- 文字溢出預警
- 缺 skin fallback 測試

### 6. 產出 TypeScript 組件

執行 `/ui-scaffold` 產出繼承 `UIPreviewBuilder` 的業務組件。

### 7. 瀏覽器驗證

執行 `/ui-verify` 自動截圖分析。

## 9-Slice Rules

1. border 必須是整數像素
2. 四角不放主陰影細節
3. 內容區至少保留 2px 安全帶
4. 邊緣加 2~4px bleed
5. 避免外框 glow 延伸進角區
6. 同一套框體的 normal/pressed/disabled border 必須一致

## Auto Atlas Rules

1. 共用 UI 小件 → `ui_common` bundle
2. 戰場 HUD → `battle_ui` bundle
3. 大廳 → `lobby_ui` bundle
4. 大面積背景 → 不進 Auto Atlas
5. 九宮格可進 atlas，但 bleed + padding 必須正確

## References

- [UI-vibe-pipeline.md](../../docs/ui/UI-vibe-pipeline.md)
- [ui-design-tokens.json](../../assets/resources/ui-spec/ui-design-tokens.json)
- [docs/ui/systems/README.md](../../docs/ui/systems/README.md)
