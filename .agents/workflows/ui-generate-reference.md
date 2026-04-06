---
description: 根據系統規格描述和風格參考圖，自動產生 UI 遊戲截圖作為佈局參考
---

## Context Budget Guard

- 進 workflow 前先看 `.agents/skills/context-budget-guard/SKILL.md`
- 先跑 `node tools_node/check-context-budget.js --changed --emit-keep-note`
- 大型 `.md` / `.json` 變更先跑 `node tools_node/summarize-structured-diff.js --git <file>`
- 收工前跑 `node tools_node/report-turn-usage.js --changed --emit-final-line`，並在 final answer 補上 `Token 量級：少 / 中 / 大（估算）`
# UI 參考截圖自動產出流程

此 workflow 在 `artifacts/ui-source/{系統名}/reference.png` 不存在時，
自動根據 design-brief.md 和風格參考圖產生一張 UI 遊戲截圖，
作為後續 layout JSON 分析和美術審閱的參考。

## 使用時機
- 尚未有人工截圖或外部 AI 設計圖時
- 在 `/ui-generate-brief` 之後自動串接
- 需要快速產出視覺參考供策劃確認時

## 前提條件
- `artifacts/ui-source/{系統名}/design-brief.md` 已存在
- `assets/resources/ui-spec/ui-design-tokens.json` 已存在

## 步驟

### 1. 讀取 design-brief.md

提取：
- 畫面中文名稱
- 功能描述（用於 prompt 組成）
- 設計參考配色與風格

### 2. 讀取 ui-design-tokens.json

提取主題色系，用於 prompt 中指定色調：
- 背景色：`colors.background`
- 主色調：`colors.primary` + `colors.secondary`
- 文字色：`colors.textPrimary`

### 3. 檢查風格參考圖

檢查 `artifacts/ui-source/{系統名}/style-reference.png` 是否存在：
- 存在 → 在 generate_image 中同時傳入作為參考
- 不存在 → 僅使用文字 prompt

### 4. 組合 prompt 並產圖

使用 `generate_image` 工具，prompt 格式：

```
UI game screen design for a Three Kingdoms strategy RPG game.
Screen: {畫面中文名稱}
Style: Dark theme, background {background hex}, 
       primary accent {primary hex}, gold accents {secondary hex}.
Layout: {從 design-brief 提取的節點清單描述}
Requirements:
- Landscape orientation 1920x1024
- Clean, modern mobile game UI
- Chinese text labels
- No device frame
- High quality game interface mockup
```

若有 style-reference.png，作為 ImagePaths 傳入。

### 5. 儲存截圖

將產出的圖片複製到：
```
artifacts/ui-source/{系統名}/reference.png
```

### 6. 提示美術審閱

輸出訊息：
```
✅ 已產出 UI 參考截圖：artifacts/ui-source/{系統名}/reference.png
📋 請美術或策劃確認：
   - 整體佈局是否合理？
   - 配色是否符合預期？
   - 需要修改的話，可替換此圖或修改 design-brief.md 後重新執行
```

## 注意事項
- 此截圖為 AI 產出的參考圖，非最終設計
- 若人工已提供 reference.png，此 workflow 會自動跳過
- 產出的截圖會保留在 artifacts/ 中，不進 Cocos 打包

