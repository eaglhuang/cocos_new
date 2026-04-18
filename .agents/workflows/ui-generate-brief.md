---
doc_id: doc_ai_0003
description: 根據系統規格書自動產生 UI 設計簡報（design-brief.md），供後續截圖產生或 AI 佈局分析使用
---

## Context Budget Guard

- 進 workflow 前先看 `.agents/skills/context-budget-guard/SKILL.md` (doc_agentskill_0006)
- 先跑 `node tools_node/check-context-budget.js --changed --emit-keep-note`
- 大型 `.md` / `.json` 變更先跑 `node tools_node/summarize-structured-diff.js --git <file>`
- 收工前跑 `node tools_node/report-turn-usage.js --changed --emit-final-line`，並在 final answer 補上 `Token 量級：少 / 中 / 大（估算）`
# UI 設計簡報自動產出流程

此 workflow 根據已有的系統規格書或 UI 規格書，自動產出結構化的 design-brief.md，
作為 UI 截圖產生、佈局分析、layout JSON 建立的輸入。

## 使用時機
- 開始一個新的 UI 畫面開發前
- 需要自動化產出 design-brief 而非手動撰寫時
- 已有系統規格書但尚未開始 UI 工作時

## 前提條件
- 系統規格書存在於 `docs/` 目錄下（如 `docs/經濟系統.md (doc_spec_0032)` (doc_spec_0032)、`docs/戰場部署系統.md (doc_spec_0040)` (doc_spec_0040)）
- UI 規格書存在於 `docs/ui/` 目錄下（選用）
- 設計風格參數存在於 `assets/resources/ui-spec/ui-design-tokens.json`

## 步驟

// turbo-all

### 1. 確認目標系統

確認要產出 design-brief 的 UI 系統名稱，例如：
- `general-list`（武將列表）
- `battle-hud`（戰鬥介面）
- `shop-main`（商城主頁）

### 2. 檢查規格來源

依優先順序查找規格文件：

```
docs/ui/{系統名}/spec.md          ← UI 專屬規格（最優先）
docs/ui/{系統名}/                 ← 目錄存在但無 spec.md → 用截圖
docs/{系統規格書名稱}.md          ← 通用系統規格書
```

**規則**：
- 若 `docs/ui/{系統名}/spec.md` 存在 → **嚴格遵守**規格內容
- 若目錄存在但為空 → 使用參考截圖 + AI 自行推斷
- 若都不存在 → 提示用戶先建立規格或提供截圖

### 3. 讀取設計風格參數

讀取 `assets/resources/ui-spec/ui-design-tokens.json`，提取：
- 配色方案（primary / secondary / background）
- 字型規範（headline / body / label）
- 間距與圓角
- 互動區域最小尺寸

### 4. 產出 design-brief.md

在 `artifacts/ui-source/{系統名}/` 建立 `design-brief.md`，格式如下：

```markdown
# {畫面中文名稱}

## 來源規格
- 主規格：`docs/ui/{系統名}/spec.md`
- 系統規格：`docs/{系統規格書名稱}.md`

## 功能描述
（從規格書中提取的核心功能列表）

## 規格約束
（從規格書中提取的 UI 約束條件）

## 互動規則
（按鈕點擊、滑動、狀態切換等互動行為）

## 設計參考
- 配色：使用 ui-design-tokens.json 的 {具體配色}
- 字型：標題用 {headlineFont}，內文用 {bodyFont}
- 圓角：{preferredCorner}
- 最小觸控目標：{minTouchTarget}px

## 截圖說明
（若有 reference.png，描述參考截圖的風格與偏好）

## 節點清單（AI 推薦）
（根據功能描述，推薦的 UI 節點結構）
```

### 5. 確認是否需要產生截圖

檢查 `artifacts/ui-source/{系統名}/reference.png` 是否存在：
- 存在 → 跳過截圖產生，直接使用
- 不存在 → 觸發 `/ui-generate-reference` 自動產圖

